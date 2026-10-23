-- Seguimiento de planes: instantánea de cantidades, cambio/desasignación
-- sin borrar consumos ni alterar existencias históricas.
begin;

alter table public.asignacion_plan_lote
  add column if not exists componentes jsonb;
-- Las asignaciones anteriores conservan una referencia a la composición actual
-- del plan (no es posible reconstruir versiones históricas no guardadas).
update public.asignacion_plan_lote a
set componentes=coalesce((
  select jsonb_agg(jsonb_build_object(
    'id',d.id,'producto_id',d.producto_id,
    'cantidad_diaria',d.cantidad_diaria,'unidad_id',d.unidad_id
  ) order by d.id)
  from public.detalle_plan_consumo d where d.plan_id=a.plan_id
),'[]'::jsonb)
where a.componentes is null;
alter table public.asignacion_plan_lote
  alter column componentes set default '[]'::jsonb,
  alter column componentes set not null;
alter table public.asignacion_plan_lote
  add constraint sgic_asignacion_componentes_array check (jsonb_typeof(componentes)='array');

-- Garantiza una sola asignación vigente por lote aun bajo concurrencia.
create unique index if not exists sgic_asignacion_lote_unica_vigente
on public.asignacion_plan_lote(lote_id) where activo;

-- Una sustitución se aplica desde hoy. No modifica el consumo de jornadas cerradas.
create or replace function public.sgic_asignar_plan(
  p_plan_id bigint,p_lote_id bigint,p_inicio date default current_date
) returns bigint language plpgsql security definer set search_path='' as $fn$
declare
  a uuid:=sgic_private.actor(true);
  v_actual public.asignacion_plan_lote%rowtype;
  v_r bigint; v_hoy date:=(now() at time zone 'America/Santiago')::date;
  v_componentes jsonb;
begin
  if p_inicio is distinct from v_hoy then
    raise exception 'El cambio de plan se aplica desde hoy (%). No se permiten fechas retroactivas ni futuras.',v_hoy;
  end if;
  perform 1 from public.lote where id=p_lote_id and estado='ACTIVO' for update;
  if not found then raise exception 'El lote no existe o no está activo'; end if;
  perform 1 from public.plan_consumo where id=p_plan_id and activo;
  if not found then raise exception 'El plan no existe o está inactivo'; end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id',d.id,'producto_id',d.producto_id,
    'cantidad_diaria',d.cantidad_diaria,'unidad_id',d.unidad_id
  ) order by d.id),'[]'::jsonb) into v_componentes
  from public.detalle_plan_consumo d
  join public.producto p on p.id=d.producto_id
  where d.plan_id=p_plan_id and p.activo and p.apto_plan;
  if jsonb_array_length(v_componentes)=0
     or jsonb_array_length(v_componentes)<>(select count(*) from public.detalle_plan_consumo where plan_id=p_plan_id)
  then raise exception 'El plan no contiene alimentos habilitados'; end if;

  select * into v_actual from public.asignacion_plan_lote
  where lote_id=p_lote_id and activo for update;
  if found then
    if v_actual.plan_id=p_plan_id then raise exception 'Ese plan ya está asignado al lote'; end if;
    if v_actual.fecha_inicio>v_hoy then raise exception 'La asignación anterior comienza en el futuro'; end if;
    if exists (
      select 1 from public.consumo c
      where c.lote_id=p_lote_id and c.fecha=v_hoy and c.origen='PLAN'
        and c.observaciones='PLAN_ASIGNACION:'||v_actual.id
    ) then
      raise exception 'Ya se confirmó la alimentación de hoy. Cambia el plan a partir de mañana.';
    end if;
    update public.asignacion_plan_lote
    set activo=false,
      fecha_fin=case when fecha_inicio=v_hoy then v_hoy else v_hoy-1 end,
      observaciones=case when fecha_inicio=v_hoy
        then concat_ws(' | ',nullif(observaciones,''),'SGIC_SIN_EJECUCION')
        else observaciones end
    where id=v_actual.id;
    perform sgic_private.audit(a,'FINALIZAR','asignacion_plan_lote',v_actual.id,
      jsonb_build_object('motivo','CAMBIO_PLAN','nuevo_plan_id',p_plan_id,'fecha',v_hoy));
  end if;

  insert into public.asignacion_plan_lote(lote_id,plan_id,fecha_inicio,componentes)
  values(p_lote_id,p_plan_id,v_hoy,v_componentes) returning id into v_r;
  perform sgic_private.audit(a,'ASIGNAR','asignacion_plan_lote',v_r,
    jsonb_build_object('plan_id',p_plan_id,'lote_id',p_lote_id,'fecha',v_hoy,
      'anterior_id',v_actual.id));
  return v_r;
end $fn$;
revoke all on function public.sgic_asignar_plan(bigint,bigint,date) from public,anon;
grant execute on function public.sgic_asignar_plan(bigint,bigint,date) to authenticated;

-- Desasignar significa cerrar la vigencia, nunca borrar el historial.
create or replace function public.sgic_desasignar_plan(
  p_lote_id bigint,p_fecha date default current_date
) returns bigint language plpgsql security definer set search_path='' as $fn$
declare
  a uuid:=sgic_private.actor(true);
  v_hoy date:=(now() at time zone 'America/Santiago')::date;
  v_actual public.asignacion_plan_lote%rowtype; v_consumido boolean;
begin
  if p_fecha is distinct from v_hoy then
    raise exception 'La desasignación solo se aplica desde hoy (%)',v_hoy;
  end if;
  perform 1 from public.lote where id=p_lote_id for update;
  if not found then raise exception 'Lote inexistente'; end if;
  select * into v_actual from public.asignacion_plan_lote
  where lote_id=p_lote_id and activo for update;
  if not found then raise exception 'El lote no tiene un plan activo'; end if;
  if v_actual.fecha_inicio>v_hoy then
    raise exception 'La asignación comienza en el futuro';
  end if;
  select exists(
    select 1 from public.consumo c
    where c.lote_id=p_lote_id and c.fecha=v_hoy and c.origen='PLAN'
      and c.observaciones='PLAN_ASIGNACION:'||v_actual.id
  ) into v_consumido;
  update public.asignacion_plan_lote
  set activo=false,
    fecha_fin=case when v_consumido or fecha_inicio=v_hoy then v_hoy else v_hoy-1 end,
    observaciones=case when not v_consumido and fecha_inicio=v_hoy
      then concat_ws(' | ',nullif(observaciones,''),'SGIC_SIN_EJECUCION')
      else observaciones end
  where id=v_actual.id;
  perform sgic_private.audit(a,'DESASIGNAR','asignacion_plan_lote',v_actual.id,
    jsonb_build_object('lote_id',p_lote_id,'fecha',v_hoy,'alimentacion_hoy',v_consumido));
  return v_actual.id;
end $fn$;
revoke all on function public.sgic_desasignar_plan(bigint,date) from public,anon;
grant execute on function public.sgic_desasignar_plan(bigint,date) to authenticated;

-- Consume la composición congelada en la asignación. Se serializa con cambios
-- de plan bloqueando primero el lote y luego la asignación.
create or replace function sgic_private.confirmar_alimentacion(p jsonb) returns bigint
language plpgsql security definer set search_path='' as $fn$
declare a uuid:=sgic_private.actor(); asign public.asignacion_plan_lote%rowtype;
  r bigint; v_fecha date:=(p->>'fecha')::date; v_lote bigint;
  d record; qty numeric; costo numeric; prod public.producto%rowtype;
  positivos integer:=0; v_hoy date:=(now() at time zone 'America/Santiago')::date;
begin
  select lote_id into v_lote from public.asignacion_plan_lote
    where id=(p->>'asignacion_id')::bigint;
  if v_lote is null then raise exception 'Asignación inexistente'; end if;
  perform 1 from public.lote where id=v_lote and estado='ACTIVO' for update;
  if not found then raise exception 'Lote no activo'; end if;
  select * into asign from public.asignacion_plan_lote
    where id=(p->>'asignacion_id')::bigint for share;
  if not found or not asign.activo or v_fecha is null or v_fecha>v_hoy
     or v_fecha<asign.fecha_inicio
     or (asign.fecha_fin is not null and v_fecha>asign.fecha_fin) then
    raise exception 'La asignación o fecha no está vigente';
  end if;
  if exists(select 1 from public.consumo c
    where c.lote_id=asign.lote_id and c.fecha=v_fecha and c.origen='PLAN'
      and c.observaciones='PLAN_ASIGNACION:'||asign.id) then
    raise exception 'El plan ya se registró en esa fecha';
  end if;
  if jsonb_typeof(p->'detalles') is distinct from 'array'
     or jsonb_array_length(asign.componentes)=0 then raise exception 'Detalle requerido'; end if;
  if jsonb_array_length(p->'detalles')<>jsonb_array_length(asign.componentes)
     or exists(select 1 from jsonb_array_elements(p->'detalles') x
       where not exists(select 1 from jsonb_array_elements(asign.componentes) dp
         where (dp->>'id')::bigint=(x->>'detalle_id')::bigint))
     or (select count(distinct x->>'detalle_id') from jsonb_array_elements(p->'detalles') x)
         <>jsonb_array_length(p->'detalles') then
    raise exception 'El plan cambió; vuelve a cargarlo';
  end if;
  insert into public.consumo(lote_id,fecha,origen,usuario_id,observaciones)
  values(asign.lote_id,v_fecha,'PLAN',a,'PLAN_ASIGNACION:'||asign.id) returning id into r;

  for d in select (elem->>'id')::bigint id,
      (elem->>'producto_id')::bigint producto_id
    from jsonb_array_elements(asign.componentes) elem
    order by (elem->>'producto_id')::bigint,(elem->>'id')::bigint
  loop
    select (x->>'cantidad')::numeric into qty from jsonb_array_elements(p->'detalles') x
      where (x->>'detalle_id')::bigint=d.id;
    if qty is null or qty<0 or qty<>round(qty,3) or qty::text='NaN' then
      raise exception 'Cantidad inválida';
    end if;
    if qty=0 then continue; end if;
    select * into prod from public.producto
      where id=d.producto_id and activo and apto_plan for update;
    if not found then raise exception 'Insumo no habilitado para el plan'; end if;
    costo:=sgic_private.stock_salida(d.producto_id,qty,a,'CONSUMO_PLAN',r);
    insert into public.detalle_consumo(
      consumo_id,producto_id,cantidad,unidad_id,costo_unitario,costo_total)
    values(r,d.producto_id,qty,prod.unidad_base_id,prod.costo_promedio,costo);
    positivos:=positivos+1;
  end loop;
  if positivos=0 then raise exception 'Registra al menos una cantidad mayor que cero'; end if;
  perform sgic_private.audit(a,'CONFIRMAR','consumo',r,p);
  return r;
end $fn$;
revoke all on function sgic_private.confirmar_alimentacion(jsonb) from public,anon;
grant execute on function sgic_private.confirmar_alimentacion(jsonb) to authenticated;

-- El formulario legado utiliza esta RPC: ambas rutas deben respetar la misma
-- validación, stock y snapshot.
create or replace function public.sgic_consumo_desde_plan(
  p_asignacion_id bigint,p_fecha date default current_date
) returns bigint language plpgsql security invoker set search_path='' as $fn$
declare v_componentes jsonb; v_detalles jsonb;
begin
  select componentes into v_componentes from public.asignacion_plan_lote
    where id=p_asignacion_id;
  select coalesce(jsonb_agg(jsonb_build_object(
    'detalle_id',(x->>'id')::bigint,'cantidad',(x->>'cantidad_diaria')::numeric
  )),'[]'::jsonb) into v_detalles
  from jsonb_array_elements(coalesce(v_componentes,'[]'::jsonb)) x;
  return sgic_private.confirmar_alimentacion(jsonb_build_object(
    'asignacion_id',p_asignacion_id,'fecha',p_fecha,'detalles',v_detalles));
end $fn$;
revoke all on function public.sgic_consumo_desde_plan(bigint,date) from public,anon;
grant execute on function public.sgic_consumo_desde_plan(bigint,date) to authenticated;

commit;
