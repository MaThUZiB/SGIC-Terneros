begin;
create or replace function public.sgic_registrar_tratamiento(p_animal_id bigint,p_producto_id bigint,p_cantidad numeric,p_motivo text,p_fecha date default current_date)
returns bigint language plpgsql security definer set search_path=''
as $fn$
declare a uuid; r bigint; v_costo numeric; v_lote bigint;
begin
  a:=sgic_private.actor();
  select lote_id into v_lote from public.animal where id=p_animal_id and estado='ACTIVO';
  if v_lote is null then raise exception 'Animal no activo'; end if;
  perform 1 from public.lote where id=v_lote and estado='ACTIVO' for update;
  if not found or not exists(select 1 from public.animal where id=p_animal_id and estado='ACTIVO') then
    raise exception 'Animal no activo'; end if;
  if length(trim(coalesce(p_motivo,'')))<3 then raise exception 'Motivo obligatorio'; end if;
  if p_cantidad is null or p_cantidad<=0 then raise exception 'Cantidad positiva obligatoria'; end if;
  insert into public.tratamiento(animal_id,producto_id,fecha,cantidad,motivo)
  values(p_animal_id,p_producto_id,p_fecha,p_cantidad,trim(p_motivo)) returning id into r;
  v_costo:=sgic_private.stock_salida(p_producto_id,p_cantidad,a,'TRATAMIENTO',r);
  update public.tratamiento set costo_total=v_costo where id=r;
  perform sgic_private.audit(a,'CREAR','tratamiento',r,jsonb_build_object('animal_id',p_animal_id,'costo',v_costo));
  return r;
end;
$fn$;

create or replace function public.sgic_registrar_gasto(p_categoria_id bigint,p_lote_id bigint,p_nombre text,p_monto numeric,p_fecha date default current_date)
returns bigint language plpgsql security definer set search_path=''
as $fn$
declare a uuid; r bigint;
begin
  a:=sgic_private.actor(true);
  if p_monto is null or p_monto<0 or length(trim(coalesce(p_nombre,'')))<3 then
    raise exception 'Gasto inválido'; end if;
  if p_lote_id is not null and not exists (
     select 1 from public.lote where id=p_lote_id and estado='ACTIVO' for update) then
    raise exception 'No se permite imputar gastos nuevos a lotes cerrados'; end if;
  insert into public.gasto(categoria_id,lote_id,fecha,nombre,monto)
  values(p_categoria_id,p_lote_id,p_fecha,trim(p_nombre),p_monto) returning id into r;
  perform sgic_private.audit(a,'CREAR','gasto',r,jsonb_build_object('monto',p_monto,'lote',p_lote_id));
  return r;
end;
$fn$;

create or replace function public.sgic_registrar_consumo(p_lote_id bigint,p_producto_id bigint,p_cantidad numeric,p_fecha date default current_date)
returns bigint language plpgsql security definer set search_path=''
as $fn$
declare a uuid; r bigint; v_unidad bigint; v_costo numeric; v_pmp numeric;
begin
  a:=sgic_private.actor();
  if not exists(select 1 from public.lote where id=p_lote_id and estado='ACTIVO' for update) then
    raise exception 'Lote no activo'; end if;
  select unidad_base_id into v_unidad from public.producto where id=p_producto_id and activo;
  if not found then raise exception 'Producto no disponible'; end if;
  insert into public.consumo(lote_id,fecha,origen,usuario_id) values(p_lote_id,p_fecha,'REAL',a) returning id into r;
  v_costo:=sgic_private.stock_salida(p_producto_id,p_cantidad,a,'CONSUMO',r);
  select costo_unitario into v_pmp from public.movimiento_inventario
  where referencia_tipo='CONSUMO' and referencia_id=r and producto_id=p_producto_id
  order by id desc limit 1;
  insert into public.detalle_consumo(consumo_id,producto_id,cantidad,unidad_id,costo_unitario,costo_total)
  values(r,p_producto_id,p_cantidad,v_unidad,v_pmp,v_costo);
  perform sgic_private.audit(a,'CREAR','consumo',r,jsonb_build_object('lote_id',p_lote_id,'costo',v_costo));
  return r;
end;
$fn$;

-- Consumo habitual desde una asignación, una sola aplicación por día.
create unique index if not exists sgic_consumo_plan_unico
on public.consumo(lote_id,fecha,observaciones)
where origen='PLAN';

create or replace function public.sgic_consumo_desde_plan(p_asignacion_id bigint,p_fecha date default current_date)
returns bigint language plpgsql security definer set search_path=''
as $fn$
declare a uuid; r bigint; v public.asignacion_plan_lote%rowtype;
  item record; v_costo numeric; v_pmp numeric; n integer:=0; v_total numeric:=0;
  v_ref text := 'PLAN_ASIGNACION:' || p_asignacion_id;
begin
  a:=sgic_private.actor();
  select * into v from public.asignacion_plan_lote where id=p_asignacion_id;
  if not found or not v.activo or p_fecha<v.fecha_inicio or
     (v.fecha_fin is not null and p_fecha>v.fecha_fin) then
    raise exception 'Asignación de plan no vigente'; end if;
  perform 1 from public.lote where id=v.lote_id and estado='ACTIVO' for update;
  if not found then raise exception 'Lote no activo'; end if;
  if exists(select 1 from public.consumo where lote_id=v.lote_id and fecha=p_fecha
    and origen='PLAN' and observaciones=v_ref) then
    raise exception 'El plan ya fue consumido en esta fecha'; end if;
  insert into public.consumo(lote_id,fecha,origen,usuario_id,observaciones)
    values(v.lote_id,p_fecha,'PLAN',a,v_ref) returning id into r;
  for item in
    select dp.producto_id,dp.cantidad_diaria,dp.unidad_id
    from public.detalle_plan_consumo dp where dp.plan_id=v.plan_id order by dp.producto_id,dp.id
  loop
    v_costo:=sgic_private.stock_salida(item.producto_id,item.cantidad_diaria,a,'CONSUMO_PLAN',r);
    select costo_unitario into v_pmp from public.movimiento_inventario
     where referencia_tipo='CONSUMO_PLAN' and referencia_id=r and producto_id=item.producto_id
     order by id desc limit 1;
    insert into public.detalle_consumo(consumo_id,producto_id,cantidad,unidad_id,costo_unitario,costo_total)
      values(r,item.producto_id,item.cantidad_diaria,item.unidad_id,v_pmp,v_costo);
    v_total:=v_total+v_costo; n:=n+1;
  end loop;
  if n=0 then raise exception 'Plan sin productos'; end if;
  perform sgic_private.audit(a,'CREAR','consumo',r,
    jsonb_build_object('asignacion_id',p_asignacion_id,'total',v_total,'origen','PLAN'));
  return r;
end;
$fn$;
revoke all on function public.sgic_consumo_desde_plan(bigint,date) from public,anon;
grant execute on function public.sgic_consumo_desde_plan(bigint,date) to authenticated;

create or replace function public.sgic_listar_usuarios()
returns table(id uuid,email text,nombre text,rol text,activo boolean)
language plpgsql security definer set search_path=''
as $fn$
begin
  perform sgic_private.actor(true);
  return query select p.id,u.email::text,p.nombre,p.rol,p.activo
    from public.perfil p join auth.users u on u.id=p.id order by u.created_at desc;
end;
$fn$;
revoke all on function public.sgic_listar_usuarios() from public,anon;
grant execute on function public.sgic_listar_usuarios() to authenticated;

create or replace function public.sgic_autorizar_usuario(p_usuario_id uuid,p_rol text,p_activo boolean)
returns boolean language plpgsql security definer set search_path=''
as $fn$
declare a uuid; v public.perfil%rowtype;
begin
  a:=sgic_private.actor(true);
  if p_rol not in ('ADMIN','OPERADOR') or p_activo is null then
    raise exception 'Rol o estado no permitido'; end if;
  -- Serializa las modificaciones de roles para impedir desactivar a todos los administradores.
  perform pg_catalog.pg_advisory_xact_lock(785637146);
  select * into v from public.perfil where id=p_usuario_id for update;
  if not found then raise exception 'Perfil no encontrado'; end if;
  if v.rol='ADMIN' and v.activo and (p_rol<>'ADMIN' or not p_activo)
    and (select count(*) from public.perfil where rol='ADMIN' and activo)<=1 then
    raise exception 'El sistema necesita al menos un administrador activo'; end if;
  update public.perfil set rol=p_rol,activo=p_activo where id=p_usuario_id;
  -- El trigger sgic_audit_perfil registra los cambios de permisos.
  return true;
end;
$fn$;
revoke all on function public.sgic_autorizar_usuario(uuid,text,boolean) from public,anon;
grant execute on function public.sgic_autorizar_usuario(uuid,text,boolean) to authenticated;

commit;