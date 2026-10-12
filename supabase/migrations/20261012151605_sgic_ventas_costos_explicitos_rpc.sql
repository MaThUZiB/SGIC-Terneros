-- Confirmación irreversible de venta con DIIO explícito y costos compartidos no repetidos.
begin;
create or replace function public.sgic_confirmar_venta(
  p_animal_ids bigint[],p_total numeric,p_comprador text,p_fecha date default current_date
) returns bigint language plpgsql security definer set search_path=''
as $fn$
declare a uuid; v_total_animales integer; v_venta bigint; v_lote bigint;
  v_n integer; v_activos integer; v_ingreso numeric; v_asignado numeric:=0;
  v_shared numeric; v_prev_shared numeric; v_costo_base numeric; v_asignacion numeric;
  v_costo numeric; v_detalle bigint; v_ultimo boolean:=false;
begin
  a:=sgic_private.actor(true);
  v_total_animales:=coalesce(array_length(p_animal_ids,1),0);
  if v_total_animales=0 or v_total_animales>200 or p_total is null or p_total<0 then
    raise exception 'Indique animales y monto de venta válido'; end if;
  if (select count(distinct x) from unnest(p_animal_ids) x) <> v_total_animales then
    raise exception 'DIIO repetido en selección de venta'; end if;
  -- Bloquear lotes en orden consistente para ventas concurrentes en el mismo lote.
  perform 1 from public.lote
   where id in(select distinct lote_id from public.animal where id=any(p_animal_ids))
   order by id for update;
  if (select count(*) from public.animal where id=any(p_animal_ids) and estado='ACTIVO')<>v_total_animales then
    raise exception 'Uno o más animales ya no están activos'; end if;

  insert into public.venta(fecha,comprador,total_venta,estado)
  values(p_fecha,nullif(trim(p_comprador),''),p_total,'CONFIRMADA') returning id into v_venta;

  for v_lote in
    select distinct lote_id from public.animal where id=any(p_animal_ids) order by lote_id
  loop
    select count(*) into v_n from public.animal
      where id=any(p_animal_ids) and lote_id=v_lote and estado='ACTIVO';
    select count(*) into v_activos from public.animal
      where lote_id=v_lote and estado='ACTIVO';
    if v_activos<v_n or v_n=0 then raise exception 'Cantidades por lote incoherentes'; end if;
    select coalesce(sum(precio_adquisicion),0) into v_costo_base from public.animal
      where id=any(p_animal_ids) and lote_id=v_lote;
    -- Bolsón histórico de costos imputables al lote (sin adquisición).
    select
       coalesce((select sum(dc.costo_total) from public.detalle_consumo dc
         join public.consumo co on co.id=dc.consumo_id where co.lote_id=v_lote),0)
       +coalesce((select sum(t.costo_total) from public.tratamiento t
         join public.animal an on an.id=t.animal_id where an.lote_id=v_lote),0)
       +coalesce((select sum(g.monto) from public.gasto g where g.lote_id=v_lote),0)
    into v_shared;
    -- Las ventas anteriores ya reconocieron una fracción de ese bolsón.
    select
      coalesce((select sum(dv.costo_reconocido) from public.detalle_venta dv
        join public.venta ve on ve.id=dv.venta_id
        where dv.lote_id=v_lote and ve.estado='CONFIRMADA'),0)
      -coalesce((select sum(an.precio_adquisicion)
         from public.animal_venta av
         join public.animal an on an.id=av.animal_id
         join public.detalle_venta dv on dv.id=av.detalle_venta_id
         join public.venta ve on ve.id=dv.venta_id
         where dv.lote_id=v_lote and ve.estado='CONFIRMADA'),0)
    into v_prev_shared;
    v_asignacion:=case when v_n=v_activos
      then round(greatest(0,v_shared-v_prev_shared),2)
      else round(greatest(0,v_shared-v_prev_shared)*v_n/v_activos,2) end;
    v_costo:=round(v_costo_base+v_asignacion,2);

    v_ultimo:= (select count(distinct lote_id)=1 from public.animal
      where id=any(p_animal_ids) and lote_id>v_lote);
    if v_ultimo then v_ingreso:=p_total-v_asignado;
    else v_ingreso:=round(p_total*v_n/v_total_animales,2); end if;
    v_asignado:=v_asignado+v_ingreso;
    insert into public.detalle_venta(venta_id,lote_id,cantidad_animales,ingreso,costo_reconocido,utilidad)
    values(v_venta,v_lote,v_n,v_ingreso,v_costo,v_ingreso-v_costo) returning id into v_detalle;
    insert into public.animal_venta(animal_id,detalle_venta_id)
      select id,v_detalle from public.animal where id=any(p_animal_ids) and lote_id=v_lote and estado='ACTIVO';
    update public.animal set estado='VENDIDO'
      where id=any(p_animal_ids) and lote_id=v_lote and estado='ACTIVO';
    update public.lote set cantidad_actual=cantidad_actual-v_n where id=v_lote;
    update public.lote set estado='CERRADO' where id=v_lote and cantidad_actual=0;
  end loop;
  perform sgic_private.audit(a,'CONFIRMAR','venta',v_venta,
    jsonb_build_object('cantidad',v_total_animales,'ingreso',p_total,'animal_ids',p_animal_ids));
  return v_venta;
end;
$fn$;
revoke all on function public.sgic_confirmar_venta(bigint[],numeric,text,date) from public,anon;
grant execute on function public.sgic_confirmar_venta(bigint[],numeric,text,date) to authenticated;

-- Bloquear gastos tardíos en lotes completamente cerrados.
create or replace function public.sgic_registrar_gasto(p_categoria_id bigint,p_lote_id bigint,p_nombre text,p_monto numeric,p_fecha date default current_date)
returns bigint language plpgsql security definer set search_path=''
as $fn$
declare a uuid; r bigint;
begin
  a:=sgic_private.actor(true);
  if p_monto is null or p_monto<0 or length(trim(coalesce(p_nombre,'')))<3 then
    raise exception 'Gasto inválido'; end if;
  if p_lote_id is not null and not exists (
     select 1 from public.lote where id=p_lote_id and estado='ACTIVO') then
    raise exception 'No se permite imputar gastos nuevos a lotes cerrados'; end if;
  insert into public.gasto(categoria_id,lote_id,fecha,nombre,monto)
  values(p_categoria_id,p_lote_id,p_fecha,trim(p_nombre),p_monto) returning id into r;
  perform sgic_private.audit(a,'CREAR','gasto',r,jsonb_build_object('monto',p_monto,'lote',p_lote_id));
  return r;
end;
$fn$;
revoke all on function public.sgic_registrar_gasto(bigint,bigint,text,numeric,date) from public,anon;
grant execute on function public.sgic_registrar_gasto(bigint,bigint,text,numeric,date) to authenticated;
commit;