-- Presentaciones, conversiones, rectificaciones documentadas y protección del costo histórico.
begin;

create or replace function public.sgic_presentacion(p_producto_id bigint,p_nombre text,p_cantidad_base numeric)
returns bigint language plpgsql security definer set search_path=''
as $fn$
declare a uuid; r bigint; v_unidad bigint;
begin
  a:=sgic_private.actor(true);
  if p_cantidad_base is null or p_cantidad_base<=0 or length(trim(coalesce(p_nombre,'')))<2 then
    raise exception 'Presentación debe tener nombre y equivalencia positiva'; end if;
  select unidad_base_id into v_unidad from public.producto where id=p_producto_id and activo;
  if not found then raise exception 'Producto no disponible'; end if;
  insert into public.presentacion_producto(producto_id,nombre,cantidad_base,unidad_base_id)
  values(p_producto_id,trim(p_nombre),p_cantidad_base,v_unidad) returning id into r;
  perform sgic_private.audit(a,'CREAR','presentacion_producto',r,
    jsonb_build_object('producto_id',p_producto_id,'cantidad_base',p_cantidad_base));
  return r;
end;
$fn$;
revoke all on function public.sgic_presentacion(bigint,text,numeric) from public,anon;
grant execute on function public.sgic_presentacion(bigint,text,numeric) to authenticated;

create or replace function public.sgic_conversion(p_producto_id bigint,p_unidad_origen_id bigint,p_cantidad_origen numeric,
 p_unidad_destino_id bigint,p_cantidad_destino numeric)
returns bigint language plpgsql security definer set search_path=''
as $fn$
declare a uuid; r bigint; v_tipo text; v_origen_tipo text; v_destino_tipo text;
begin
  a:=sgic_private.actor(true);
  if p_cantidad_origen is null or p_cantidad_origen<=0 or p_cantidad_destino is null or p_cantidad_destino<=0 then
    raise exception 'Equivalencias deben ser positivas'; end if;
  select u.tipo into v_tipo from public.producto p join public.unidad_medida u on u.id=p.unidad_base_id
  where p.id=p_producto_id and p.activo;
  select tipo into v_origen_tipo from public.unidad_medida where id=p_unidad_origen_id;
  select tipo into v_destino_tipo from public.unidad_medida where id=p_unidad_destino_id;
  if v_tipo is null or v_origen_tipo is distinct from v_tipo or v_destino_tipo is distinct from v_tipo then
    raise exception 'Las unidades deben tener la misma dimensión que la unidad base'; end if;
  insert into public.conversion_producto(producto_id,cantidad_origen,unidad_origen_id,cantidad_destino,unidad_destino_id)
  values(p_producto_id,p_cantidad_origen,p_unidad_origen_id,p_cantidad_destino,p_unidad_destino_id)
  returning id into r;
  perform sgic_private.audit(a,'CREAR','conversion_producto',r,
    jsonb_build_object('producto_id',p_producto_id,'origen',p_cantidad_origen,'destino',p_cantidad_destino));
  return r;
end;
$fn$;
revoke all on function public.sgic_conversion(bigint,bigint,numeric,bigint,numeric) from public,anon;
grant execute on function public.sgic_conversion(bigint,bigint,numeric,bigint,numeric) to authenticated;

create or replace function public.sgic_actualizar_producto(p_producto_id bigint,p_nombre text,p_stock_minimo numeric,p_activo boolean)
returns boolean language plpgsql security definer set search_path=''
as $fn$
declare a uuid; v public.producto%rowtype;
begin
  a:=sgic_private.actor(true);
  select * into v from public.producto where id=p_producto_id for update;
  if not found then raise exception 'Producto no existe'; end if;
  if length(trim(coalesce(p_nombre,'')))<2 or p_stock_minimo is null or p_stock_minimo<0 or p_activo is null then
    raise exception 'Datos del producto inválidos'; end if;
  if not p_activo and v.stock_actual>0 then raise exception 'No se desactiva un producto con stock'; end if;
  update public.producto set nombre=trim(p_nombre),stock_minimo=p_stock_minimo,activo=p_activo where id=p_producto_id;
  perform sgic_private.audit(a,'ACTUALIZAR','producto',p_producto_id,
    jsonb_build_object('antes',jsonb_build_object('nombre',v.nombre,'stock_minimo',v.stock_minimo,'activo',v.activo),
                       'despues',jsonb_build_object('nombre',p_nombre,'stock_minimo',p_stock_minimo,'activo',p_activo)));
  return true;
end;
$fn$;
revoke all on function public.sgic_actualizar_producto(bigint,text,numeric,boolean) from public,anon;
grant execute on function public.sgic_actualizar_producto(bigint,text,numeric,boolean) to authenticated;

create or replace function public.sgic_rectificar_animal(p_animal_id bigint,p_sexo text,p_observacion text)
returns boolean language plpgsql security definer set search_path=''
as $fn$
declare a uuid; v public.animal%rowtype;
begin
  a:=sgic_private.actor(true);
  select * into v from public.animal where id=p_animal_id for update;
  if not found then raise exception 'Animal no existe'; end if;
  if p_sexo not in ('MACHO','HEMBRA') or length(trim(coalesce(p_observacion,'')))<5 then
     raise exception 'Rectificación exige sexo válido y motivo';
  end if;
  update public.animal set sexo=p_sexo,
    observaciones=concat_ws(E'\n',v.observaciones,'Rectificación: '||p_observacion)
  where id=p_animal_id;
  perform sgic_private.audit(a,'RECTIFICAR','animal',p_animal_id,
    jsonb_build_object('sexo_anterior',v.sexo,'sexo_nuevo',p_sexo,'motivo',p_observacion));
  return true;
end;
$fn$;
revoke all on function public.sgic_rectificar_animal(bigint,text,text) from public,anon;
grant execute on function public.sgic_rectificar_animal(bigint,text,text) to authenticated;

commit;