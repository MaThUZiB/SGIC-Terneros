-- Prueba de integración reversible de ingreso SIPECweb y venta con detalle económico.
-- Ejecutar exclusivamente en un entorno de ensayo con al menos un ADMIN habilitado.
-- Todas las filas empresariales de prueba se revierten al finalizar.
-- Las secuencias identity pueden avanzar pese al rollback (comportamiento normal de PostgreSQL).
begin;
select set_config('request.jwt.claim.sub',(
  select id::text from public.perfil where activo and rol='ADMIN' order by creado_el limit 1
),true);
set local role authenticated;

do $test$
declare
  v_ingreso_a bigint;
  v_ingreso_b bigint;
  v_animal_a bigint;
  v_animal_b bigint;
  v_venta bigint;
begin
  v_ingreso_a:=public.sgic_incorporar_desde_sipec(
    'INICIAL',current_date,null,'SIPEC-SMOKE-INICIAL',null,null,
    '[{"diio":"099999981","sexo":"MACHO","fecha_nacimiento":"2026-01-01",
      "raza_nombre":"RAZA PRUEBA SIPEC","raza_sipec":"RAZA PRUEBA SIPEC",
      "categoria_sipec":"TERNERO","valor_base":180000}]'::jsonb);
  v_ingreso_b:=public.sgic_incorporar_desde_sipec(
    'COMPRA',current_date,null,'SIPEC-SMOKE-COMPRA',null,'REFERENCIA-SMOKE',
    '[{"diio":"099999982","sexo":"HEMBRA","fecha_nacimiento":"2026-01-02",
      "raza_nombre":"RAZA PRUEBA SIPEC","raza_sipec":"RAZA PRUEBA SIPEC",
      "categoria_sipec":"TERNERA","valor_base":120000}]'::jsonb);

  if (select count(*) from public.compra_animal ca
    where ca.observaciones in ('Ingreso SIPECweb #'||v_ingreso_a,'Ingreso SIPECweb #'||v_ingreso_b))<>1
  then raise exception 'La existencia inicial no debe crear compra';end if;

  select id into v_animal_a from public.animal where diio='099999981';
  select id into v_animal_b from public.animal where diio='099999982';
  v_venta:=public.sgic_venta_precios_individuales(
    jsonb_build_array(
      jsonb_build_object('animal_id',v_animal_a,'precio_venta',250000),
      jsonb_build_object('animal_id',v_animal_b,'precio_venta',170000)
    ),'SMOKE TEST',current_date);

  if (select total_venta from public.venta where id=v_venta)<>420000
    or (select sum(ingreso) from public.detalle_venta where venta_id=v_venta)<>420000
    or (select count(*) from public.venta_precio_animal where venta_id=v_venta)<>2
    or (select max(ingreso) from public.detalle_venta where venta_id=v_venta)<>250000
  then raise exception 'La venta individual no conserva importes por DIIO/lote'; end if;

  if (select count(*) from public.animal where id in (v_animal_a,v_animal_b) and estado='VENDIDO')<>2
  then raise exception 'La venta no actualizó el estado de los DIIO';end if;
end;
$test$;

rollback;
-- Comprobar por separado que no persistan registros con DIIO 099999981 y 099999982.
