begin;
-- Keep commercial units separate from stock units. Categories suggest a use;
-- plan eligibility is an explicit product setting, not a category restriction.
alter table public.producto add column tipo_insumo text not null default 'OTRO'
 check(tipo_insumo in ('LECHE','CONCENTRADO','FORRAJE','CAMA','MEDICAMENTO','OTRO')),
 add column apto_plan boolean not null default false;
update public.producto p set apto_plan=true where exists(select 1 from public.detalle_plan_consumo d where d.producto_id=p.id);
alter table public.producto alter column costo_promedio type numeric(18,6);
alter table public.movimiento_inventario alter column costo_unitario type numeric(18,6);
alter table public.detalle_compra_insumo alter column precio_unitario type numeric(18,6);
alter table public.detalle_consumo alter column costo_unitario type numeric(18,6);
alter table public.compra_insumo alter column proveedor_id drop not null;
alter table public.tratamiento alter column animal_id drop not null;
alter table public.tratamiento add column lote_id bigint references public.lote(id),
 add constraint tratamiento_destino check(animal_id is not null or lote_id is not null);
create index tratamiento_lote_idx on public.tratamiento(lote_id);
create table public.ingreso_insumo (
 id bigint generated always as identity primary key, solicitud uuid not null unique,
 producto_id bigint not null references public.producto(id), compra_id bigint references public.compra_insumo(id),
 tipo text not null check(tipo in ('COMPRA','INICIAL')), fecha date not null,
 cantidad numeric(12,3) not null check(cantidad>0), unidad_ingreso text not null,
 factor numeric(12,3) not null check(factor>0), cantidad_base numeric(12,3) not null check(cantidad_base>0),
 precio_unitario numeric(18,6) not null check(precio_unitario>=0), total numeric(12,2) not null check(total>=0),
 usuario_id uuid not null references auth.users(id), creado_en timestamptz not null default now()
);
create index ingreso_insumo_producto_idx on public.ingreso_insumo(producto_id);
create index ingreso_insumo_compra_idx on public.ingreso_insumo(compra_id);
create table public.uso_insumo (
 id bigint generated always as identity primary key, solicitud uuid not null unique,
 producto_id bigint not null references public.producto(id), fecha date not null,
 cantidad numeric(12,3) not null check(cantidad>0), costo_total numeric(12,2) not null,
 finalidad text not null check(finalidad in ('ALIMENTACION','CAMA','TRATAMIENTO','PERDIDA','OTRO')),
 lote_id bigint references public.lote(id), animal_id bigint references public.animal(id), motivo text not null,
 consumo_id bigint references public.consumo(id), tratamiento_id bigint references public.tratamiento(id), gasto_id bigint references public.gasto(id),
 usuario_id uuid not null references auth.users(id), creado_en timestamptz not null default now()
);
create index uso_insumo_producto_idx on public.uso_insumo(producto_id);
create index uso_insumo_lote_idx on public.uso_insumo(lote_id);
alter table public.ingreso_insumo enable row level security;
alter table public.uso_insumo enable row level security;
revoke all on public.ingreso_insumo,public.uso_insumo from anon,authenticated;
grant select on public.ingreso_insumo,public.uso_insumo to authenticated;
create policy ingreso_lectura on public.ingreso_insumo for select to authenticated using(exists(select 1 from public.perfil where id=(select auth.uid()) and activo));
create policy uso_lectura on public.uso_insumo for select to authenticated using(exists(select 1 from public.perfil where id=(select auth.uid()) and activo));

create function sgic_private.ingresar_insumo(p jsonb) returns bigint
language plpgsql security definer set search_path='' as $fn$
declare a uuid:=sgic_private.actor(true); r bigint; prod public.producto%rowtype;
 pid bigint:=nullif(p->>'producto_id','')::bigint; sid uuid:=(p->>'solicitud')::uuid;
 qty numeric:=(p->>'cantidad')::numeric; factor numeric:=coalesce((p->>'factor')::numeric,1);
 precio numeric:=(p->>'precio_unitario')::numeric; base numeric; total numeric;
 tipo text:=p->>'tipo'; clase text:=p->>'tipo_insumo'; unidad text:=p->>'unidad';
 v_nombre text:=trim(p->>'nombre'); cid bigint; uid bigint; compra bigint; proveedor bigint;
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
   proveedor:=nullif(p->>'proveedor_id','')::bigint;
   if proveedor is not null and not exists(select 1 from public.proveedor where id=proveedor and activo) then raise exception 'Proveedor no disponible'; end if;
   if proveedor is null and nullif(trim(p->>'proveedor_nombre'),'') is not null then
     insert into public.proveedor(nombre) values(trim(p->>'proveedor_nombre')) returning id into proveedor;
   end if;
   insert into public.compra_insumo(proveedor_id,fecha,numero_documento,estado,total)
     values(proveedor,v_fecha,nullif(trim(p->>'documento'),''),'CONFIRMADA',total) returning id into compra;
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

create function sgic_private.usar_insumo(p jsonb) returns bigint
language plpgsql security definer set search_path='' as $fn$
declare a uuid:=sgic_private.actor(); sid uuid:=(p->>'solicitud')::uuid; r bigint;
 pid bigint:=(p->>'producto_id')::bigint; qty numeric:=(p->>'cantidad')::numeric;
 lid bigint:=nullif(p->>'lote_id','')::bigint; aid bigint:=nullif(p->>'animal_id','')::bigint;
 finalidad text:=p->>'finalidad'; v_fecha date:=(p->>'fecha')::date; motivo text:=trim(p->>'motivo');
 prod public.producto%rowtype; costo numeric; cid bigint; tid bigint; gid bigint; categoria bigint;
begin
 if sid is null then raise exception 'Identificador requerido'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(sid::text,0));
 select id into r from public.uso_insumo where solicitud=sid; if found then return r; end if;
 if finalidad is null or finalidad not in ('ALIMENTACION','CAMA','TRATAMIENTO','PERDIDA','OTRO') or v_fecha is null or v_fecha>current_date or motivo is null or length(motivo)<3
  or qty is null or qty<=0 or qty<>round(qty,3) or qty::text='NaN' then raise exception 'Completa finalidad, fecha, cantidad y motivo'; end if;
 if aid is not null then
   if finalidad<>'TRATAMIENTO' or lid is not null then raise exception 'Selecciona un animal o un lote'; end if;
   select lote_id into lid from public.animal where id=aid and estado='ACTIVO';
   if not found then raise exception 'Animal no activo'; end if;
 end if;
 if lid is not null then
   perform 1 from public.lote where id=lid and estado='ACTIVO' for update;
   if not found then raise exception 'Lote no activo'; end if;
 end if;
 if aid is not null and not exists(select 1 from public.animal where id=aid and estado='ACTIVO' and lote_id=lid) then raise exception 'El animal cambió de estado o lote'; end if;
 if finalidad='TRATAMIENTO' and lid is null then raise exception 'El tratamiento necesita animal o lote'; end if;
 select * into prod from public.producto where id=pid and activo for update;
 if not found then raise exception 'Insumo no disponible'; end if;
 insert into public.uso_insumo(solicitud,producto_id,fecha,cantidad,costo_total,finalidad,lote_id,animal_id,motivo,usuario_id)
 values(sid,pid,v_fecha,qty,0,finalidad,lid,aid,motivo,a) returning id into r;
 costo:=sgic_private.stock_salida(pid,qty,a,'USO_'||finalidad,r);
 if finalidad='ALIMENTACION' then
   insert into public.consumo(lote_id,fecha,origen,usuario_id,observaciones) values(lid,v_fecha,'REAL',a,motivo) returning id into cid;
   insert into public.detalle_consumo(consumo_id,producto_id,cantidad,unidad_id,costo_unitario,costo_total) values(cid,pid,qty,prod.unidad_base_id,prod.costo_promedio,costo);
 elsif finalidad='TRATAMIENTO' then
   insert into public.tratamiento(animal_id,lote_id,producto_id,fecha,cantidad,costo_total,motivo) values(aid,lid,pid,v_fecha,qty,costo,motivo) returning id into tid;
 else
   insert into public.categoria_gasto(nombre) values(case finalidad when 'CAMA' then 'Material de cama utilizado' when 'PERDIDA' then 'Pérdida de inventario' else 'Otros insumos utilizados' end)
   on conflict(nombre) do update set nombre=excluded.nombre returning id into categoria;
   insert into public.gasto(categoria_id,lote_id,fecha,nombre,detalle,monto)
   values(categoria,lid,v_fecha,left(prod.nombre,120),motivo,costo) returning id into gid;
 end if;
 update public.uso_insumo set costo_total=costo,consumo_id=cid,tratamiento_id=tid,gasto_id=gid where id=r;
 perform sgic_private.audit(a,'UTILIZAR','uso_insumo',r,jsonb_build_object('finalidad',finalidad,'cantidad',qty,'costo',costo,'lote',lid));
 return r;
end $fn$;

create function sgic_private.configurar_insumo(p jsonb) returns boolean
language plpgsql security definer set search_path='' as $fn$
declare a uuid:=sgic_private.actor(true); pid bigint:=(p->>'producto_id')::bigint;
begin
 update public.producto set apto_plan=(p->>'apto_plan')::boolean where id=pid and activo;
 if not found then raise exception 'Insumo no disponible'; end if;
 perform sgic_private.audit(a,'CONFIGURAR','producto',pid,p); return true;
end $fn$;

create function sgic_private.confirmar_alimentacion(p jsonb) returns bigint
language plpgsql security definer set search_path='' as $fn$
declare a uuid:=sgic_private.actor(); asign public.asignacion_plan_lote%rowtype;
 r bigint; v_fecha date:=(p->>'fecha')::date; d record; qty numeric; costo numeric; prod public.producto%rowtype; positivos integer:=0;
begin
 select * into asign from public.asignacion_plan_lote where id=(p->>'asignacion_id')::bigint for share;
 if not found or not asign.activo or v_fecha is null or v_fecha>current_date or v_fecha<asign.fecha_inicio or (asign.fecha_fin is not null and v_fecha>asign.fecha_fin) then raise exception 'Asignación o fecha no vigente'; end if;
 perform 1 from public.lote where id=asign.lote_id and estado='ACTIVO' for update;
 if not found then raise exception 'Lote no activo'; end if;
 if exists(select 1 from public.consumo where lote_id=asign.lote_id and fecha=v_fecha and origen='PLAN' and observaciones='PLAN_ASIGNACION:'||asign.id) then
   raise exception 'Este plan ya se registró en esa fecha'; end if;
 if jsonb_typeof(p->'detalles') is distinct from 'array' then raise exception 'Detalle requerido'; end if;
 if jsonb_array_length(p->'detalles')<>(select count(*) from public.detalle_plan_consumo where plan_id=asign.plan_id)
 or exists(select 1 from jsonb_array_elements(p->'detalles') x where not exists(select 1 from public.detalle_plan_consumo d where d.id=(x->>'detalle_id')::bigint and d.plan_id=asign.plan_id))
 or (select count(distinct x->>'detalle_id') from jsonb_array_elements(p->'detalles') x)<>jsonb_array_length(p->'detalles') then raise exception 'El plan cambió; vuelve a cargarlo'; end if;
 insert into public.consumo(lote_id,fecha,origen,usuario_id,observaciones) values(asign.lote_id,v_fecha,'PLAN',a,'PLAN_ASIGNACION:'||asign.id) returning id into r;
 for d in select * from public.detalle_plan_consumo where plan_id=asign.plan_id order by producto_id,id for share loop
   select (x->>'cantidad')::numeric into qty from jsonb_array_elements(p->'detalles') x where (x->>'detalle_id')::bigint=d.id;
   if qty is null or qty<0 or qty<>round(qty,3) or qty::text='NaN' then raise exception 'Cantidad inválida'; end if;
   if qty=0 then continue; end if;
   select * into prod from public.producto where id=d.producto_id and activo and apto_plan for update;
   if not found then raise exception 'Insumo no habilitado para el plan'; end if;
   costo:=sgic_private.stock_salida(d.producto_id,qty,a,'CONSUMO_PLAN',r);
   insert into public.detalle_consumo(consumo_id,producto_id,cantidad,unidad_id,costo_unitario,costo_total) values(r,d.producto_id,qty,prod.unidad_base_id,prod.costo_promedio,costo);
   positivos:=positivos+1;
 end loop;
 if positivos=0 then raise exception 'Registra al menos una cantidad mayor que cero'; end if;
 perform sgic_private.audit(a,'CONFIRMAR','consumo',r,p); return r;
end $fn$;

revoke all on function sgic_private.ingresar_insumo(jsonb) from public,anon,authenticated;
grant execute on function sgic_private.ingresar_insumo(jsonb) to authenticated;
create function public.sgic_ingresar_insumo(p jsonb) returns bigint language sql security invoker set search_path='' as $fn$ select sgic_private.ingresar_insumo(p); $fn$;
revoke all on function public.sgic_ingresar_insumo(jsonb) from public,anon;
grant execute on function public.sgic_ingresar_insumo(jsonb) to authenticated;

revoke all on function sgic_private.usar_insumo(jsonb) from public,anon,authenticated;
grant execute on function sgic_private.usar_insumo(jsonb) to authenticated;
create function public.sgic_usar_insumo(p jsonb) returns bigint language sql security invoker set search_path='' as $fn$ select sgic_private.usar_insumo(p); $fn$;
revoke all on function public.sgic_usar_insumo(jsonb) from public,anon;
grant execute on function public.sgic_usar_insumo(jsonb) to authenticated;

revoke all on function sgic_private.configurar_insumo(jsonb) from public,anon,authenticated;
grant execute on function sgic_private.configurar_insumo(jsonb) to authenticated;
create function public.sgic_configurar_insumo(p jsonb) returns boolean language sql security invoker set search_path='' as $fn$ select sgic_private.configurar_insumo(p); $fn$;
revoke all on function public.sgic_configurar_insumo(jsonb) from public,anon;
grant execute on function public.sgic_configurar_insumo(jsonb) to authenticated;

revoke all on function sgic_private.confirmar_alimentacion(jsonb) from public,anon,authenticated;
grant execute on function sgic_private.confirmar_alimentacion(jsonb) to authenticated;
create function public.sgic_confirmar_alimentacion(p jsonb) returns bigint language sql security invoker set search_path='' as $fn$ select sgic_private.confirmar_alimentacion(p); $fn$;
revoke all on function public.sgic_confirmar_alimentacion(jsonb) from public,anon;
grant execute on function public.sgic_confirmar_alimentacion(jsonb) to authenticated;
grant usage on schema sgic_private to authenticated;
create or replace function sgic_private.finalizar_venta(
  p_animal_ids bigint[],p_total numeric,p_comprador text,p_fecha date,p_venta_existente bigint
) returns bigint language plpgsql security invoker set search_path=''
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

  if p_venta_existente is null then
    insert into public.venta(fecha,comprador,total_venta,estado)
    values(p_fecha,nullif(trim(p_comprador),''),p_total,'CONFIRMADA') returning id into v_venta;
  else
    update public.venta set estado='CONFIRMADA'
    where id=p_venta_existente and estado='BORRADOR' and total_venta=p_total
    returning id into v_venta;
    if v_venta is null then raise exception 'Borrador de venta no disponible'; end if;
  end if;

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
         left join public.animal an on an.id=t.animal_id where coalesce(t.lote_id,an.lote_id)=v_lote),0)
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

revoke all on function sgic_private.finalizar_venta(bigint[],numeric,text,date,bigint) from public,anon,authenticated;

create or replace view public.sgic_rentabilidad_lote
with (security_invoker=true)
as
select l.id as lote_id,l.codigo,l.estado,l.cantidad_actual,
  coalesce((select sum(a.precio_adquisicion) from public.animal a where a.lote_id=l.id),0)::numeric(14,2) adquisicion,
  coalesce((select sum(dc.costo_total) from public.detalle_consumo dc
    join public.consumo co on co.id=dc.consumo_id where co.lote_id=l.id),0)::numeric(14,2) alimentacion,
  coalesce((select sum(t.costo_total) from public.tratamiento t
    left join public.animal a on a.id=t.animal_id where coalesce(t.lote_id,a.lote_id)=l.id),0)::numeric(14,2) sanidad,
  coalesce((select sum(g.monto) from public.gasto g where g.lote_id=l.id),0)::numeric(14,2) gastos_imputables,
  coalesce((select sum(d.ingreso) from public.detalle_venta d
    join public.venta v on v.id=d.venta_id where d.lote_id=l.id and v.estado='CONFIRMADA'),0)::numeric(14,2) ingresos_venta,
  coalesce((select sum(d.costo_reconocido) from public.detalle_venta d
    join public.venta v on v.id=d.venta_id where d.lote_id=l.id and v.estado='CONFIRMADA'),0)::numeric(14,2) costo_reconocido,
  coalesce((select sum(d.utilidad) from public.detalle_venta d
    join public.venta v on v.id=d.venta_id where d.lote_id=l.id and v.estado='CONFIRMADA'),0)::numeric(14,2) utilidad_ventas
from public.lote l;
revoke all on public.sgic_rentabilidad_lote from public,anon;
grant select on public.sgic_rentabilidad_lote to authenticated;

create or replace function public.sgic_dividir_lote(p_lote_id bigint,p_codigo text,p_animales bigint[])
returns bigint language plpgsql security definer set search_path=''
as $fn$
declare a uuid; v_n integer; v_lote bigint; v_codigo text; v_nuevo bigint;
begin
  a:=sgic_private.actor(true);
  v_n:=coalesce(array_length(p_animales,1),0);
  if v_n=0 or v_n>200 then raise exception 'Seleccione animales activos'; end if;
  select id,codigo into v_lote,v_codigo from public.lote where id=p_lote_id and estado='ACTIVO' for update;
  if v_lote is null then raise exception 'Lote no activo'; end if;
  if (select count(distinct x) from unnest(p_animales) x)<>v_n or
     (select count(*) from public.animal where id=any(p_animales) and lote_id=p_lote_id and estado='ACTIVO')<>v_n
  then raise exception 'Selección de animales inválida'; end if;
  -- Bloquear divisiones cuando existen costos compartidos o ventas previas:
  -- requieren una política explícita de reasignación histórica.
  if exists(select 1 from public.consumo where lote_id=p_lote_id)
     or exists(select 1 from public.gasto where lote_id=p_lote_id)
     or exists(select 1 from public.tratamiento t left join public.animal an on an.id=t.animal_id where coalesce(t.lote_id,an.lote_id)=p_lote_id)
     or exists(select 1 from public.detalle_venta where lote_id=p_lote_id)
  then raise exception 'Lote con costos o ventas históricos: división no permitida sin reasignación'; end if;
  insert into public.lote(codigo,lote_origen_id,fecha_ingreso,cantidad_original,cantidad_actual)
  values(trim(p_codigo),p_lote_id,current_date,v_n,v_n) returning id into v_nuevo;
  update public.animal set lote_id=v_nuevo where id=any(p_animales) and lote_id=p_lote_id and estado='ACTIVO';
  update public.lote set cantidad_actual=cantidad_actual-v_n where id=p_lote_id;
  update public.lote set estado='CERRADO' where id=p_lote_id and cantidad_actual=0;
  perform sgic_private.audit(a,'DIVIDIR','lote',p_lote_id,jsonb_build_object('derivado',v_nuevo,'cantidad',v_n));
  return v_nuevo;
end;
$fn$;
revoke all on function public.sgic_dividir_lote(bigint,text,bigint[]) from public,anon;
grant execute on function public.sgic_dividir_lote(bigint,text,bigint[]) to authenticated;
create or replace function public.sgic_plan_detalle(p_plan_id bigint,p_producto_id bigint,p_cantidad_diaria numeric)
returns bigint language plpgsql security definer set search_path=''
as $fn$
declare a uuid; r bigint; v_unidad bigint;
begin
  a:=sgic_private.actor(true);
  if p_cantidad_diaria is null or p_cantidad_diaria<=0 then raise exception 'Cantidad diaria positiva requerida'; end if;
  select unidad_base_id into v_unidad from public.producto where id=p_producto_id and activo and apto_plan;
  if not found then raise exception 'Producto no disponible'; end if;
  insert into public.detalle_plan_consumo(plan_id,producto_id,cantidad_diaria,unidad_id)
  values(p_plan_id,p_producto_id,p_cantidad_diaria,v_unidad) returning id into r;
  perform sgic_private.audit(a,'CREAR','detalle_plan_consumo',r,jsonb_build_object('plan_id',p_plan_id,'cantidad',p_cantidad_diaria));
  return r;
end;
$fn$;
revoke all on function public.sgic_plan_detalle(bigint,bigint,numeric) from public,anon;
grant execute on function public.sgic_plan_detalle(bigint,bigint,numeric) to authenticated;


commit;
