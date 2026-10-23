-- Solo eliminar planes nunca utilizados; archivar los que tienen historial.
begin;
create or replace function public.sgic_gestionar_plan(
 p_plan_id bigint, p_accion text
) returns text language plpgsql security definer set search_path='' as $fn$
declare v_actor uuid:=sgic_private.actor(true); v_plan public.plan_consumo%rowtype;
 v_asignaciones integer; v_consumos integer;
begin
 if p_accion not in ('ELIMINAR','ARCHIVAR','REACTIVAR') or p_accion is null then
  raise exception 'Acción de plan no válida'; end if;
 select * into v_plan from public.plan_consumo where id=p_plan_id for update;
 if not found then raise exception 'Plan inexistente'; end if;
 select count(*) into v_asignaciones from public.asignacion_plan_lote where plan_id=p_plan_id;
 if p_accion='ELIMINAR' then
  if v_asignaciones>0 then
   raise exception 'El plan tiene asignaciones históricas. Archívalo para conservar la trazabilidad.';
  end if;
  delete from public.detalle_plan_consumo where plan_id=p_plan_id;
  delete from public.plan_consumo where id=p_plan_id;
  perform sgic_private.audit(v_actor,'ELIMINAR','plan_consumo',p_plan_id,
   jsonb_build_object('nombre',v_plan.nombre,'sin_asignaciones',true));
  return 'ELIMINADO';
 end if;
 if p_accion='ARCHIVAR' then
  if exists(select 1 from public.asignacion_plan_lote where plan_id=p_plan_id and activo) then
   raise exception 'El plan sigue asignado a un lote. Cambia o desasigna esos lotes antes de archivarlo.';
  end if;
  if not v_plan.activo then raise exception 'El plan ya está archivado'; end if;
  update public.plan_consumo set activo=false where id=p_plan_id;
  perform sgic_private.audit(v_actor,'ARCHIVAR','plan_consumo',p_plan_id,
   jsonb_build_object('nombre',v_plan.nombre));
  return 'ARCHIVADO';
 end if;
 if v_plan.activo then raise exception 'El plan ya está activo'; end if;
 update public.plan_consumo set activo=true where id=p_plan_id;
 perform sgic_private.audit(v_actor,'REACTIVAR','plan_consumo',p_plan_id,
  jsonb_build_object('nombre',v_plan.nombre));
 return 'REACTIVADO';
end $fn$;
revoke all on function public.sgic_gestionar_plan(bigint,text) from public,anon;
grant execute on function public.sgic_gestionar_plan(bigint,text) to authenticated;
commit;
