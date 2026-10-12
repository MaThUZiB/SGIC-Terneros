-- Movimiento de inventario y operaciones de insumos, alimentación, salud y gastos.
begin;
create or replace function sgic_private.stock_entrada(p_producto bigint,p_cantidad numeric,p_precio numeric,p_actor uuid,p_referencia text,p_id bigint)
returns numeric language plpgsql security invoker set search_path=''
as $fn$
declare v public.producto%rowtype; v_nuevo numeric; v_pmp numeric; v_costo numeric;
begin
  if p_cantidad is null or p_cantidad<=0 or p_precio is null or p_precio<0 then raise exception 'Cantidad y costo inválidos'; end if;
  select * into v from public.producto where id=p_producto and activo=true for update;
  if not found then raise exception 'Producto inactivo o inexistente'; end if;
  v_nuevo:=v.stock_actual+p_cantidad;
  v_pmp:=round((v.stock_actual*v.costo_promedio+p_cantidad*p_precio)/v_nuevo,2);
  v_costo:=round(p_cantidad*p_precio,2);
  update public.producto set stock_actual=v_nuevo,costo_promedio=v_pmp where id=p_producto;
  insert into public.movimiento_inventario(producto_id,tipo,cantidad,costo_unitario,costo_total,
      usuario_id,referencia_tipo,referencia_id)
  values(p_producto,'ENTRADA',p_cantidad,p_precio,v_costo,p_actor,p_referencia,p_id);
  return v_costo;
end;
$fn$;
revoke all on function sgic_private.stock_entrada(bigint,numeric,numeric,uuid,text,bigint) from public,anon,authenticated;

create or replace function sgic_private.stock_salida(p_producto bigint,p_cantidad numeric,p_actor uuid,p_referencia text,p_id bigint)
returns numeric language plpgsql security invoker set search_path=''
as $fn$
declare v public.producto%rowtype; v_costo numeric;
begin
  if p_cantidad is null or p_cantidad<=0 then raise exception 'Cantidad debe ser positiva'; end if;
  select * into v from public.producto where id=p_producto and activo=true for update;
  if not found then raise exception 'Producto inactivo o inexistente'; end if;
  if v.stock_actual<p_cantidad then raise exception 'Stock insuficiente para % (actual %, solicitado %)',v.nombre,v.stock_actual,p_cantidad; end if;
  v_costo:=round(p_cantidad*v.costo_promedio,2);
  update public.producto set stock_actual=stock_actual-p_cantidad where id=p_producto;
  insert into public.movimiento_inventario(producto_id,tipo,cantidad,costo_unitario,costo_total,
      usuario_id,referencia_tipo,referencia_id)
  values(p_producto,'SALIDA',p_cantidad,v.costo_promedio,v_costo,p_actor,p_referencia,p_id);
  return v_costo;
end;
$fn$;
revoke all on function sgic_private.stock_salida(bigint,numeric,uuid,text,bigint) from public,anon,authenticated;

create or replace function public.sgic_crear_compra_insumo(p_proveedor_id bigint,p_detalles jsonb,p_fecha date default current_date,p_documento text default null)
returns bigint language plpgsql security definer set search_path=''
as $fn$
declare a uuid; item jsonb; r bigint; v_producto bigint; v_cantidad numeric; v_base numeric;
        v_unit numeric; v_total numeric:=0; v_presentation bigint;
begin
  a:=sgic_private.actor(true);
  if jsonb_typeof(p_detalles)<>'array' or jsonb_array_length(p_detalles)=0 or jsonb_array_length(p_detalles)>100 then
    raise exception 'Debe registrar de 1 a 100 productos'; end if;
  if not exists(select 1 from public.proveedor where id=p_proveedor_id and activo) then raise exception 'Proveedor inválido'; end if;
  insert into public.compra_insumo(proveedor_id,fecha,numero_documento,estado,total)
  values(p_proveedor_id,p_fecha,p_documento,'BORRADOR',0) returning id into r;
  for item in select value from jsonb_array_elements(p_detalles) loop
    v_producto:=(item->>'producto_id')::bigint;
    v_cantidad:=(item->>'cantidad')::numeric;
    v_presentation:=nullif(item->>'presentacion_id','')::bigint;
    v_base:=coalesce((item->>'cantidad_base')::numeric,v_cantidad);
    v_unit:=(item->>'precio_unitario')::numeric;
    if v_cantidad is null or v_cantidad<=0 or v_base is null or v_base<=0 or v_unit is null or v_unit<0 then
      raise exception 'Línea de compra inválida'; end if;
    if not exists(select 1 from public.producto where id=v_producto and activo) then
      raise exception 'Producto inexistente o inactivo'; end if;
    if v_presentation is not null and not exists(
       select 1 from public.presentacion_producto where id=v_presentation and producto_id=v_producto and activa)
    then raise exception 'Presentación no corresponde al producto'; end if;
    insert into public.detalle_compra_insumo(compra_id,producto_id,presentacion_id,cantidad,cantidad_base,precio_unitario,subtotal)
    values(r,v_producto,v_presentation,v_cantidad,v_base,v_unit,round(v_base*v_unit,2));
    v_total:=v_total+round(v_base*v_unit,2);
  end loop;
  update public.compra_insumo set total=v_total where id=r;
  perform sgic_private.audit(a,'CREAR','compra_insumo',r,jsonb_build_object('total',v_total,'estado','BORRADOR'));
  return r;
end;
$fn$;
revoke all on function public.sgic_crear_compra_insumo(bigint,jsonb,date,text) from public,anon;
grant execute on function public.sgic_crear_compra_insumo(bigint,jsonb,date,text) to authenticated;

create or replace function public.sgic_confirmar_compra_insumo(p_compra_id bigint)
returns boolean language plpgsql security definer set search_path=''
as $fn$
declare a uuid; v public.compra_insumo%rowtype; det record; v_total numeric:=0; n integer:=0;
begin
  a:=sgic_private.actor(true);
  select * into v from public.compra_insumo where id=p_compra_id for update;
  if not found or v.estado<>'BORRADOR' then raise exception 'Solo compras en borrador'; end if;
  -- Se ordenan los productos para bloquear filas en orden consistente y reducir deadlocks.
  for det in select * from public.detalle_compra_insumo
      where compra_id=p_compra_id order by producto_id,id loop
    if det.cantidad_base<=0 or abs(det.subtotal-round(det.cantidad_base*det.precio_unitario,2))>0.01 then
      raise exception 'Detalle de compra # % no coincide con cantidad base por precio unitario', det.id; end if;
    perform sgic_private.stock_entrada(det.producto_id,det.cantidad_base,det.precio_unitario,a,'COMPRA_INSUMO',p_compra_id);
    v_total:=v_total+det.subtotal; n:=n+1;
  end loop;
  if n=0 then raise exception 'Compra sin productos'; end if;
  if abs(v_total-v.total)>0.01 then raise exception 'Total de compra inconsistente'; end if;
  update public.compra_insumo set estado='CONFIRMADA' where id=p_compra_id;
  perform sgic_private.audit(a,'CONFIRMAR','compra_insumo',p_compra_id,
    jsonb_build_object('total',v_total,'productos',n));
  return true;
end;
$fn$;
revoke all on function public.sgic_confirmar_compra_insumo(bigint) from public,anon;
grant execute on function public.sgic_confirmar_compra_insumo(bigint) to authenticated;

create or replace function public.sgic_anular_borrador_insumo(p_compra_id bigint)
returns boolean language plpgsql security definer set search_path=''
as $fn$
declare a uuid;
begin
  a:=sgic_private.actor(true);
  update public.compra_insumo set estado='ANULADA' where id=p_compra_id and estado='BORRADOR';
  if not found then raise exception 'Solo se anulan compras sin confirmar'; end if;
  perform sgic_private.audit(a,'ANULAR','compra_insumo',p_compra_id,'{}'::jsonb);
  return true;
end;
$fn$;
revoke all on function public.sgic_anular_borrador_insumo(bigint) from public,anon;
grant execute on function public.sgic_anular_borrador_insumo(bigint) to authenticated;

create or replace function public.sgic_ajustar_stock(p_producto_id bigint,p_delta numeric,p_motivo text)
returns bigint language plpgsql security definer set search_path=''
as $fn$
declare a uuid; v public.producto%rowtype; r bigint;
begin
  a:=sgic_private.actor(true);
  if p_delta is null or p_delta=0 or length(trim(coalesce(p_motivo,'')))<5 then
    raise exception 'Cantidad distinta de cero y motivo obligatorio'; end if;
  select * into v from public.producto where id=p_producto_id and activo for update;
  if not found or v.stock_actual+p_delta<0 then raise exception 'Producto inválido o stock insuficiente'; end if;
  update public.producto set stock_actual=stock_actual+p_delta where id=p_producto_id;
  insert into public.movimiento_inventario(producto_id,tipo,cantidad,costo_unitario,costo_total,usuario_id,referencia_tipo,observaciones)
  values(p_producto_id,'AJUSTE',p_delta,v.costo_promedio,round(p_delta*v.costo_promedio,2),a,'AJUSTE_MANUAL',p_motivo)
  returning id into r;
  perform sgic_private.audit(a,'AJUSTAR','producto',p_producto_id,jsonb_build_object('delta',p_delta,'motivo',p_motivo));
  return r;
end;
$fn$;
revoke all on function public.sgic_ajustar_stock(bigint,numeric,text) from public,anon;
grant execute on function public.sgic_ajustar_stock(bigint,numeric,text) to authenticated;

create or replace function public.sgic_registrar_consumo(p_lote_id bigint,p_producto_id bigint,p_cantidad numeric,p_fecha date default current_date)
returns bigint language plpgsql security definer set search_path=''
as $fn$
declare a uuid; r bigint; v_unidad bigint; v_costo numeric; v_pmp numeric;
begin
  a:=sgic_private.actor();
  if not exists(select 1 from public.lote where id=p_lote_id and estado='ACTIVO') then
    raise exception 'Lote no activo'; end if;
  select unidad_base_id,costo_promedio into v_unidad,v_pmp from public.producto where id=p_producto_id and activo;
  if not found then raise exception 'Producto no disponible'; end if;
  insert into public.consumo(lote_id,fecha,origen,usuario_id) values(p_lote_id,p_fecha,'REAL',a) returning id into r;
  v_costo:=sgic_private.stock_salida(p_producto_id,p_cantidad,a,'CONSUMO',r);
  insert into public.detalle_consumo(consumo_id,producto_id,cantidad,unidad_id,costo_unitario,costo_total)
  values(r,p_producto_id,p_cantidad,v_unidad,v_pmp,v_costo);
  perform sgic_private.audit(a,'CREAR','consumo',r,jsonb_build_object('lote_id',p_lote_id,'costo',v_costo));
  return r;
end;
$fn$;
revoke all on function public.sgic_registrar_consumo(bigint,bigint,numeric,date) from public,anon;
grant execute on function public.sgic_registrar_consumo(bigint,bigint,numeric,date) to authenticated;

create or replace function public.sgic_registrar_tratamiento(p_animal_id bigint,p_producto_id bigint,p_cantidad numeric,p_motivo text,p_fecha date default current_date)
returns bigint language plpgsql security definer set search_path=''
as $fn$
declare a uuid; r bigint; v_costo numeric;
begin
  a:=sgic_private.actor();
  if not exists(select 1 from public.animal where id=p_animal_id and estado='ACTIVO') then
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
revoke all on function public.sgic_registrar_tratamiento(bigint,bigint,numeric,text,date) from public,anon;
grant execute on function public.sgic_registrar_tratamiento(bigint,bigint,numeric,text,date) to authenticated;

create or replace function public.sgic_registrar_gasto(p_categoria_id bigint,p_lote_id bigint,p_nombre text,p_monto numeric,p_fecha date default current_date)
returns bigint language plpgsql security definer set search_path=''
as $fn$
declare a uuid; r bigint;
begin
  a:=sgic_private.actor(true);
  if p_monto is null or p_monto<0 or length(trim(coalesce(p_nombre,'')))<3 then raise exception 'Gasto inválido'; end if;
  insert into public.gasto(categoria_id,lote_id,fecha,nombre,monto)
  values(p_categoria_id,p_lote_id,p_fecha,trim(p_nombre),p_monto) returning id into r;
  perform sgic_private.audit(a,'CREAR','gasto',r,jsonb_build_object('monto',p_monto,'lote',p_lote_id));
  return r;
end;
$fn$;
revoke all on function public.sgic_registrar_gasto(bigint,bigint,text,numeric,date) from public,anon;
grant execute on function public.sgic_registrar_gasto(bigint,bigint,text,numeric,date) to authenticated;

create or replace function public.sgic_plan_detalle(p_plan_id bigint,p_producto_id bigint,p_cantidad_diaria numeric)
returns bigint language plpgsql security definer set search_path=''
as $fn$
declare a uuid; r bigint; v_unidad bigint;
begin
  a:=sgic_private.actor(true);
  if p_cantidad_diaria is null or p_cantidad_diaria<=0 then raise exception 'Cantidad diaria positiva requerida'; end if;
  select unidad_base_id into v_unidad from public.producto where id=p_producto_id and activo;
  if not found then raise exception 'Producto no disponible'; end if;
  insert into public.detalle_plan_consumo(plan_id,producto_id,cantidad_diaria,unidad_id)
  values(p_plan_id,p_producto_id,p_cantidad_diaria,v_unidad) returning id into r;
  perform sgic_private.audit(a,'CREAR','detalle_plan_consumo',r,jsonb_build_object('plan_id',p_plan_id,'cantidad',p_cantidad_diaria));
  return r;
end;
$fn$;
revoke all on function public.sgic_plan_detalle(bigint,bigint,numeric) from public,anon;
grant execute on function public.sgic_plan_detalle(bigint,bigint,numeric) to authenticated;

create or replace function public.sgic_asignar_plan(p_plan_id bigint,p_lote_id bigint,p_inicio date default current_date)
returns bigint language plpgsql security definer set search_path=''
as $fn$
declare a uuid; r bigint;
begin
  a:=sgic_private.actor(true);
  if not exists(select 1 from public.plan_consumo where id=p_plan_id and activo) or
     not exists(select 1 from public.lote where id=p_lote_id and estado='ACTIVO') then
    raise exception 'Plan o lote no disponible'; end if;
  update public.asignacion_plan_lote set activo=false,fecha_fin=p_inicio
  where lote_id=p_lote_id and activo and fecha_inicio<=p_inicio;
  insert into public.asignacion_plan_lote(lote_id,plan_id,fecha_inicio)
  values(p_lote_id,p_plan_id,p_inicio) returning id into r;
  perform sgic_private.audit(a,'ASIGNAR','asignacion_plan_lote',r,jsonb_build_object('plan_id',p_plan_id,'lote_id',p_lote_id));
  return r;
end;
$fn$;
revoke all on function public.sgic_asignar_plan(bigint,bigint,date) from public,anon;
grant execute on function public.sgic_asignar_plan(bigint,bigint,date) to authenticated;
commit;