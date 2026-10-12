begin;
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
    -- Si la línea viene por presentación y no declara cantidad base,
    -- se convierte mediante el factor de esa presentación.
    if v_presentation is not null and nullif(item->>'cantidad_base','') is null then
      select v_cantidad*cantidad_base into v_base from public.presentacion_producto
      where id=v_presentation and producto_id=v_producto and activa;
    end if;
    if v_base is null or v_base<=0 then raise exception 'Conversión de presentación inválida'; end if;
    insert into public.detalle_compra_insumo(compra_id,producto_id,presentacion_id,cantidad,cantidad_base,precio_unitario,subtotal)
    values(r,v_producto,v_presentation,v_cantidad,v_base,v_unit,round(v_base*v_unit,2));
    v_total:=v_total+round(v_base*v_unit,2);
  end loop;
  update public.compra_insumo set total=v_total where id=r;
  perform sgic_private.audit(a,'CREAR','compra_insumo',r,jsonb_build_object('total',v_total,'estado','BORRADOR'));
  return r;
end;
$fn$;
commit;