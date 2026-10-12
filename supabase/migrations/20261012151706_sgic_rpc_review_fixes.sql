-- Correcciones tras revisión estática; migraciones anteriores se conservan inmutables.
begin;
create or replace function public.sgic_registrar_compra_animales(
  p_lote_codigo text,p_proveedor_id bigint,p_animales jsonb,p_fecha date default current_date,p_lote_id bigint default null
) returns bigint language plpgsql security definer set search_path=''
as $fn$
declare a uuid; v_lote bigint; v_compra bigint; v_animal bigint; item jsonb; v_total numeric(12,2):=0; n integer:=0;
  precio numeric(12,2); peso numeric(8,2);
begin
  a := sgic_private.actor(true);
  if jsonb_typeof(p_animales)<>'array' or jsonb_array_length(p_animales)=0 or jsonb_array_length(p_animales)>200 then
    raise exception 'Incluya entre 1 y 200 animales'; end if;
  if p_lote_id is null then
    if nullif(trim(p_lote_codigo),'') is null then raise exception 'Indique código de lote nuevo'; end if;
    insert into public.lote(codigo,fecha_ingreso,cantidad_original,cantidad_actual)
    values(trim(p_lote_codigo),p_fecha,0,0) returning id into v_lote;
  else
    select id into v_lote from public.lote where id=p_lote_id and estado='ACTIVO' for update;
    if v_lote is null then raise exception 'Lote existente no disponible'; end if;
  end if;
  if p_proveedor_id is not null and not exists(select 1 from public.proveedor where id=p_proveedor_id and activo) then
    raise exception 'Proveedor inválido';
  end if;
  insert into public.compra_animal(fecha,proveedor_id,total) values(p_fecha,p_proveedor_id,0) returning id into v_compra;
  for item in select value from jsonb_array_elements(p_animales) loop
    precio := (item->>'precio_adquisicion')::numeric;
    peso := nullif(item->>'peso_ingreso_kg','')::numeric;
    if nullif(trim(item->>'diio'),'') is null or precio is null or precio<0 or
       not exists(select 1 from public.raza where id=(item->>'raza_id')::bigint) then
      raise exception 'Animal sin DIIO, raza o precio válido'; end if;
    insert into public.animal(diio,lote_id,raza_id,sexo,edad_aproximada_dias,fecha_adquisicion,precio_adquisicion,peso_ingreso_kg)
    values(trim(item->>'diio'),v_lote,(item->>'raza_id')::bigint,
      coalesce(nullif(item->>'sexo',''),'MACHO'),coalesce((item->>'edad_aproximada_dias')::integer,0),
      p_fecha,precio,peso) returning id into v_animal;
    insert into public.detalle_compra_animal(compra_id,animal_id,precio_adquisicion,peso_compra)
    values(v_compra,v_animal,precio,peso);
    v_total:=v_total+precio; n:=n+1;
  end loop;
  update public.compra_animal set total=v_total where id=v_compra;
  update public.lote set cantidad_original=cantidad_original+n,cantidad_actual=cantidad_actual+n where id=v_lote;
  perform sgic_private.audit(a,'CREAR','compra_animal',v_compra,
    jsonb_build_object('lote_id',v_lote,'animales',n,'total',v_total));
  return v_compra;
end;
$fn$;

create or replace function public.sgic_registrar_consumo(p_lote_id bigint,p_producto_id bigint,p_cantidad numeric,p_fecha date default current_date)
returns bigint language plpgsql security definer set search_path=''
as $fn$
declare a uuid; r bigint; v_unidad bigint; v_costo numeric; v_pmp numeric;
begin
  a:=sgic_private.actor();
  if not exists(select 1 from public.lote where id=p_lote_id and estado='ACTIVO') then
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

    v_ultimo:= not exists(select 1 from public.animal
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
commit;