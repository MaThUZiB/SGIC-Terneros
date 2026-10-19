begin;
create or replace function sgic_private.ingresar_insumo(p jsonb) returns bigint
language plpgsql security definer set search_path='' as $fn$
declare a uuid:=sgic_private.actor(true); r bigint; prod public.producto%rowtype;
 pid bigint:=nullif(p->>'producto_id','')::bigint; sid uuid:=(p->>'solicitud')::uuid;
 qty numeric:=(p->>'cantidad')::numeric; factor numeric:=coalesce((p->>'factor')::numeric,1);
 precio numeric:=(p->>'precio_unitario')::numeric; base numeric; total numeric;
 tipo text:=p->>'tipo'; clase text:=p->>'tipo_insumo'; unidad text:=p->>'unidad';
 v_nombre text:=trim(p->>'nombre'); cid bigint; uid bigint; compra bigint; v_proveedor bigint;
 v_fecha date:=(p->>'fecha')::date; pack bigint; packname text:=nullif(trim(p->>'presentacion'),'');
begin
 if sid is null then raise exception 'Identificador requerido'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(sid::text,0));
 select id into r from public.ingreso_insumo where solicitud=sid; if found then return r; end if;
 if tipo is null or tipo not in ('COMPRA','INICIAL') or v_fecha is null or v_fecha>current_date then raise exception 'Tipo o fecha de ingreso inválidos'; end if;
 if qty is null or qty<=0 or qty<>round(qty,3) or factor<=0 or factor<>round(factor,3)
   or precio is null or precio<0 or precio<>round(precio,6) or precio::text='NaN' or qty::text='NaN' or factor::text='NaN' then raise exception 'Cantidad, equivalencia o precio inválidos'; end if;
 if packname is null and factor<>1 then raise exception 'Indica el nombre de la presentación'; end if;
 base:=qty*factor; total:=round(qty*precio,2);
 if base<>round(base,3) then raise exception 'La existencia admite hasta tres decimales'; end if;
 if pid is null then
   if v_nombre is null or length(v_nombre)<2 or length(v_nombre)>120 or clase is null or clase not in ('LECHE','CONCENTRADO','FORRAJE','CAMA','MEDICAMENTO','OTRO')
     or unidad is null or unidad not in ('kg','l','ml','unidad','bolo') then raise exception 'Completa nombre, tipo y unidad del insumo'; end if;
   perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(lower(v_nombre),1));
   if exists(select 1 from public.producto where lower(trim(nombre))=lower(trim(p->>'nombre'))) then raise exception 'Ya existe un insumo con ese nombre. Selecciónalo en el buscador'; end if;
   insert into public.categoria_producto(nombre) values(case clase when 'LECHE' then 'Leche y sustitutos' when 'CONCENTRADO' then 'Concentrados' when 'FORRAJE' then 'Forrajes' when 'CAMA' then 'Material de cama' when 'MEDICAMENTO' then 'Medicamentos' else 'Otros insumos' end)
     on conflict(nombre) do update set activo=true returning id into cid;
   insert into public.unidad_medida(codigo,nombre,tipo,decimales) values(unidad,unidad,case when unidad='kg' then 'MASA' when unidad in ('l','ml') then 'VOLUMEN' else 'UNIDAD' end,3)
     on conflict(codigo) do update set codigo=excluded.codigo returning id into uid;
   insert into public.producto(nombre,categoria_id,unidad_base_id,tipo_insumo,apto_plan)
     values(v_nombre,cid,uid,clase,coalesce((p->>'apto_plan')::boolean,clase in ('LECHE','CONCENTRADO'))) returning id into pid;
 end if;
 select * into prod from public.producto where id=pid and activo for update;
 if not found then raise exception 'Insumo no disponible'; end if;
 select codigo into unidad from public.unidad_medida where id=prod.unidad_base_id;
 if packname is not null then
   select id into pack from public.presentacion_producto where producto_id=pid and nombre=packname and cantidad_base=factor and activa limit 1;
   if pack is null then insert into public.presentacion_producto(producto_id,nombre,cantidad_base,unidad_base_id) values(pid,packname,factor,prod.unidad_base_id) returning id into pack; end if;
 end if;
 if tipo='COMPRA' then
   v_proveedor:=nullif(p->>'proveedor_id','')::bigint;
   if v_proveedor is not null and not exists(select 1 from public.proveedor where id=v_proveedor and activo) then raise exception 'Proveedor no disponible'; end if;
   if v_proveedor is null and nullif(trim(p->>'proveedor_nombre'),'') is not null then
     insert into public.proveedor(nombre) values(trim(p->>'proveedor_nombre')) returning id into v_proveedor;
   end if;
   insert into public.compra_insumo(proveedor_id,fecha,numero_documento,estado,total)
     values(v_proveedor,v_fecha,nullif(trim(p->>'documento'),''),'CONFIRMADA',total) returning id into compra;
   insert into public.detalle_compra_insumo(compra_id,producto_id,presentacion_id,cantidad,cantidad_base,precio_unitario,subtotal)
     values(compra,pid,pack,qty,base,round(precio/factor,6),total);
 end if;
 insert into public.ingreso_insumo(solicitud,producto_id,compra_id,tipo,fecha,cantidad,unidad_ingreso,factor,cantidad_base,precio_unitario,total,usuario_id)
   values(sid,pid,compra,tipo,v_fecha,qty,coalesce(packname,unidad),factor,base,precio,total,a) returning id into r;
 update public.producto set stock_actual=stock_actual+base,
   costo_promedio=round((stock_actual*costo_promedio+total)/(stock_actual+base),6) where id=pid;
 insert into public.movimiento_inventario(producto_id,tipo,cantidad,costo_unitario,costo_total,usuario_id,referencia_tipo,referencia_id,observaciones)
   values(pid,'ENTRADA',base,round(total/base,6),total,a,'INGRESO_'||tipo,r,'Fecha de ingreso: '||v_fecha);
 perform sgic_private.audit(a,'INGRESAR','ingreso_insumo',r,jsonb_build_object('tipo',tipo,'cantidad_base',base,'total',total));
 return r;
end $fn$;


commit;
