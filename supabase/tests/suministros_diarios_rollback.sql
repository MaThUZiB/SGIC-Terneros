-- Pruebas transaccionales de pautas y suministros (sin modificar datos productivos).
-- Aplicar solo después de la migración pautas_y_suministros_diarios.
begin;
do $test$
declare
 v_actor uuid; v_lote bigint; v_producto bigint; v_stock numeric;
 v_pauta bigint; v_periodo bigint; v_estimacion bigint; v_legacy bigint;
 v_payload jsonb; v_inicio date:=(now() at time zone 'America/Santiago')::date-23;
 v_rechazado boolean:=false;
begin
 select p.id into v_actor from public.perfil p join auth.users u on u.id=p.id
 where p.rol='ADMIN' and p.activo and u.email_confirmed_at is not null limit 1;
 select id into v_lote from public.lote order by id limit 1;
 select id,stock_actual into v_producto,v_stock from public.producto
 where activo and tipo_insumo in ('LECHE','CONCENTRADO') and stock_actual>=5 order by id limit 1;
 if v_actor is null or v_lote is null or v_producto is null then
   raise exception 'Faltan administrador, lote o stock para la prueba';
 end if;
 perform set_config('request.jwt.claim.sub',v_actor::text,true);
 v_pauta:=public.sgic_guardar_pauta_alimentacion(jsonb_build_object(
   'nombre','TEST SUMINISTROS '||gen_random_uuid(),'suministros_dia',2,
   'detalles',jsonb_build_array(jsonb_build_object(
     'producto_id',v_producto,'cantidad_por_suministro',0.125))));
 assert (select activo from public.pauta_alimentacion where id=v_pauta),'Pauta no creada';
 v_payload:=jsonb_build_object(
   'solicitud',gen_random_uuid(),'lote_id',v_lote,'pauta_id',v_pauta,
   'fecha_inicio',v_inicio::text,'fecha_fin',(v_inicio+6)::text,
   'suministros_dia',2,'descontar_stock',true,
   'detalles',jsonb_build_array(jsonb_build_object(
     'producto_id',v_producto,'cantidad_por_suministro',0.125)));
 v_periodo:=public.sgic_registrar_periodo_alimentacion(v_payload);
 assert (select estado='DESCONTADO' and suministros_dia=2 and pauta_id=v_pauta
         from public.periodo_alimentacion where id=v_periodo),'Período incorrecto';
 assert (select cantidad_por_suministro=0.125 and cantidad_total=1.75
         from public.detalle_periodo_alimentacion where periodo_id=v_periodo),
   '0.125 kg por suministro × 2 × 7 días debe dar 1.75 kg';
 assert (select stock_actual=v_stock-1.75 from public.producto where id=v_producto),
   'Descuento de stock no coincide con consumo total';
 assert (select count(*)=1 from public.movimiento_inventario m
         join public.periodo_alimentacion p on p.consumo_id=m.referencia_id
         where p.id=v_periodo and m.referencia_tipo='CONSUMO_PERIODO'),
   'Movimiento de inventario duplicado o ausente';
 assert public.sgic_registrar_periodo_alimentacion(v_payload)=v_periodo,'Falló idempotencia';
 assert (select stock_actual=v_stock-1.75 from public.producto where id=v_producto),
   'Reintento duplicó descuento';
 begin
   perform public.sgic_registrar_periodo_alimentacion(
     v_payload||jsonb_build_object('solicitud',gen_random_uuid()));
 exception when others then v_rechazado:=true; end;
 assert v_rechazado,'Se permitió período solapado';
 v_estimacion:=public.sgic_registrar_periodo_alimentacion(jsonb_build_object(
   'solicitud',gen_random_uuid(),'lote_id',v_lote,
   'fecha_inicio',(v_inicio+7)::text,'fecha_fin',(v_inicio+13)::text,
   'suministros_dia',2,'descontar_stock',false,
   'detalles',jsonb_build_array(jsonb_build_object(
      'producto_id',v_producto,'cantidad_por_suministro',0.125))));
 assert (select estado='ESTIMADO' and consumo_id is null from public.periodo_alimentacion
         where id=v_estimacion),'Estimación descontó inventario';
 assert (select cantidad_total=1.75 from public.detalle_periodo_alimentacion
         where periodo_id=v_estimacion),'Estimación de 7 días incorrecta';
 assert (select stock_actual=v_stock-1.75 from public.producto where id=v_producto),
   'Una estimación no debe descontar stock';
 v_legacy:=public.sgic_registrar_periodo_alimentacion(jsonb_build_object(
   'solicitud',gen_random_uuid(),'lote_id',v_lote,
   'fecha_inicio',(v_inicio+14)::text,'fecha_fin',(v_inicio+20)::text,
   'descontar_stock',false,'detalles',
   jsonb_build_array(jsonb_build_object('producto_id',v_producto,'cantidad',5))));
 assert (select cantidad_total=5 and cantidad_por_suministro is null
         from public.detalle_periodo_alimentacion where periodo_id=v_legacy),
   'Se perdió compatibilidad con cantidad global anterior';
 assert public.sgic_archivar_pauta_alimentacion(v_pauta),'No se archivó la pauta';
 assert (select pauta_id=v_pauta from public.periodo_alimentacion
         where id=v_periodo),'Archivar pauta afectó historial';
end $test$;
select 'PASS: cálculo de suministros, stock, idempotencia, pautas y estimaciones' as resultado;
rollback;
