begin;
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

revoke all on function sgic_private.finalizar_venta(bigint[],numeric,text,date,bigint) from public,anon,authenticated;

create or replace function public.sgic_confirmar_venta(p_animal_ids bigint[],p_total numeric,
 p_comprador text,p_fecha date default current_date)
returns bigint language plpgsql security definer set search_path=''
as $fn$
begin
  return sgic_private.finalizar_venta(p_animal_ids,p_total,p_comprador,p_fecha,null);
end;
$fn$;
revoke all on function public.sgic_confirmar_venta(bigint[],numeric,text,date) from public,anon;
grant execute on function public.sgic_confirmar_venta(bigint[],numeric,text,date) to authenticated;

create table public.venta_borrador_animal(
  venta_id bigint not null references public.venta(id) on delete restrict,
  animal_id bigint not null references public.animal(id) on delete restrict,
  primary key(venta_id,animal_id)
);
create index venta_borrador_animal_animal_idx on public.venta_borrador_animal(animal_id);
alter table public.venta_borrador_animal enable row level security;
revoke all on public.venta_borrador_animal from public,anon,authenticated;
grant select on public.venta_borrador_animal to authenticated;
create policy lectura_venta_borrador_activos on public.venta_borrador_animal for select to authenticated
using (exists(select 1 from public.perfil p where p.id=(select auth.uid()) and p.activo=true));

create or replace function public.sgic_borrador_venta(p_animal_ids bigint[],p_total numeric,p_comprador text,p_fecha date default current_date)
returns bigint language plpgsql security definer set search_path=''
as $fn$
declare a uuid; v_count integer; v_venta bigint;
begin
  a:=sgic_private.actor(true);
  v_count:=coalesce(array_length(p_animal_ids,1),0);
  if v_count=0 or v_count>200 or p_total is null or p_total<0 then raise exception 'Seleccione DIIO y monto válido'; end if;
  if (select count(distinct x) from unnest(p_animal_ids) x)<>v_count or
     (select count(*) from public.animal where id=any(p_animal_ids) and estado='ACTIVO')<>v_count then
    raise exception 'Selección DIIO inválida o con animales no activos'; end if;
  insert into public.venta(fecha,comprador,total_venta,estado)
    values(p_fecha,nullif(trim(p_comprador),''),p_total,'BORRADOR') returning id into v_venta;
  insert into public.venta_borrador_animal(venta_id,animal_id)
    select v_venta,id from public.animal where id=any(p_animal_ids);
  perform sgic_private.audit(a,'CREAR','venta',v_venta,jsonb_build_object('estado','BORRADOR','animal_ids',p_animal_ids));
  return v_venta;
end;
$fn$;
revoke all on function public.sgic_borrador_venta(bigint[],numeric,text,date) from public,anon;
grant execute on function public.sgic_borrador_venta(bigint[],numeric,text,date) to authenticated;

create or replace function public.sgic_confirmar_borrador_venta(p_venta_id bigint)
returns bigint language plpgsql security definer set search_path=''
as $fn$
declare a uuid; v public.venta%rowtype; v_ids bigint[];
begin
  a:=sgic_private.actor(true);
  select * into v from public.venta where id=p_venta_id and estado='BORRADOR' for update;
  if not found then raise exception 'La venta no está en BORRADOR'; end if;
  select array_agg(animal_id order by animal_id) into v_ids
    from public.venta_borrador_animal where venta_id=p_venta_id;
  if v_ids is null then raise exception 'Borrador sin DIIO asignados'; end if;
  return sgic_private.finalizar_venta(v_ids,v.total_venta,v.comprador,v.fecha,p_venta_id);
end;
$fn$;
revoke all on function public.sgic_confirmar_borrador_venta(bigint) from public,anon;
grant execute on function public.sgic_confirmar_borrador_venta(bigint) to authenticated;

create or replace function public.sgic_anular_borrador_venta(p_venta_id bigint)
returns boolean language plpgsql security definer set search_path=''
as $fn$
declare a uuid;
begin
  a:=sgic_private.actor(true);
  update public.venta set estado='ANULADA' where id=p_venta_id and estado='BORRADOR';
  if not found then raise exception 'Solo pueden anularse ventas en borrador'; end if;
  perform sgic_private.audit(a,'ANULAR','venta',p_venta_id,jsonb_build_object('estado','ANULADA'));
  return true;
end;
$fn$;
revoke all on function public.sgic_anular_borrador_venta(bigint) from public,anon;
grant execute on function public.sgic_anular_borrador_venta(bigint) to authenticated;

-- Vista financiera con permisos del invocador y RLS de todas las tablas consultadas.
create or replace view public.sgic_rentabilidad_lote
with (security_invoker=true)
as
select l.id as lote_id,l.codigo,l.estado,l.cantidad_actual,
  coalesce((select sum(a.precio_adquisicion) from public.animal a where a.lote_id=l.id),0)::numeric(14,2) adquisicion,
  coalesce((select sum(dc.costo_total) from public.detalle_consumo dc
    join public.consumo co on co.id=dc.consumo_id where co.lote_id=l.id),0)::numeric(14,2) alimentacion,
  coalesce((select sum(t.costo_total) from public.tratamiento t
    join public.animal a on a.id=t.animal_id where a.lote_id=l.id),0)::numeric(14,2) sanidad,
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

commit;