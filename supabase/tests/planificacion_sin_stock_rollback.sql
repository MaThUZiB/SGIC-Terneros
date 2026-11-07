-- La planificación NO exige inventario. Ejecutar dentro de transacción; revierte todo al terminar.
begin;
do $test$
declare
 v_actor uuid; v_lotes bigint[]; v_producto bigint; v_ultimo bigint;
 v_today date:=(now() at time zone 'America/Santiago')::date;
 v_inicio date:=v_today; v_fin date:=v_today+49;
 v_por_suministro numeric; v_id bigint; v_payload jsonb;
 v_ids bigint[]:=array[]::bigint[]; v_rechazado boolean;
begin
 select p.id into v_actor from public.perfil p join auth.users u on u.id=p.id
 where p.rol='ADMIN' and p.activo and u.email_confirmed_at is not null limit 1;
 select array_agg(id order by id) into v_lotes from
   (select id from public.lote order by id limit 3) t;
 if v_actor is null or array_length(v_lotes,1)<3 then raise exception 'Faltan datos para test'; end if;
 perform set_config('request.jwt.claim.sub',v_actor::text,true);
 select coalesce(max(id),0)+1 into v_producto from public.producto;
 insert into public.producto(id,nombre,categoria_id,unidad_base_id,stock_actual,costo_promedio,tipo_insumo)
 values(v_producto,'Leche simulada - prueba planificación',11,11,200,2500,'LECHE');

 for i in 1..3 loop
   v_por_suministro:=case i when 1 then 2 when 2 then 3 else 5 end;
   v_payload:=jsonb_build_object('solicitud',gen_random_uuid(),'lote_id',v_lotes[i],
     'fecha_inicio',v_inicio::text,'fecha_fin',v_fin::text,'suministros_dia',2,
     'tipo_registro','PLANIFICADO','descontar_stock',false,
     'detalles',jsonb_build_array(jsonb_build_object('producto_id',v_producto,
       'cantidad_por_suministro',v_por_suministro)));
   v_id:=public.sgic_registrar_periodo_alimentacion(v_payload);
   v_ids:=array_append(v_ids,v_id);
   assert (select estado='PLANIFICADO' and consumo_id is null
     from public.periodo_alimentacion where id=v_id),'Un plan creó consumo real';
   assert public.sgic_registrar_periodo_alimentacion(v_payload)=v_id, 'Idempotencia de plan falló';
 end loop;
 assert (select sum(cantidad_total)=1000 from public.detalle_periodo_alimentacion
   where periodo_id=any(v_ids)),'Demanda agregada de tres lotes debe ser 1000 kg';
 assert (select stock_actual=200 from public.producto where id=v_producto),
   'La planificación descontó inventario';
 assert (select count(*)=0 from public.movimiento_inventario where producto_id=v_producto),
   'Planificar generó un movimiento de inventario';
 assert (select count(*)=0 from public.consumo where lote_id=any(v_lotes)),
   'La planificación generó consumo real';

 v_rechazado:=false;
 begin
   perform public.sgic_registrar_periodo_alimentacion(jsonb_build_object(
     'solicitud',gen_random_uuid(),'lote_id',v_lotes[1],
     'fecha_inicio',v_today::text,'fecha_fin',v_fin::text,
     'suministros_dia',2,'tipo_registro','PLANIFICADO','descontar_stock',false,
     'detalles',jsonb_build_array(jsonb_build_object('producto_id',v_producto,
       'cantidad_por_suministro',2))));
 exception when others then v_rechazado:=true;end;
 assert v_rechazado,'El sistema permitió dos planificaciones solapadas en el mismo lote';

 v_rechazado:=false;
 begin
   perform public.sgic_registrar_periodo_alimentacion(jsonb_build_object(
     'solicitud',gen_random_uuid(),'lote_id',v_lotes[1],
     'fecha_inicio',v_today::text,'fecha_fin',v_fin::text,
     'suministros_dia',2,'tipo_registro','DESCONTADO','descontar_stock',true,
     'detalles',jsonb_build_array(jsonb_build_object('producto_id',v_producto,
       'cantidad_por_suministro',2))));
 exception when others then v_rechazado:=true;end;
 assert v_rechazado,'Se permitió descontar consumo futuro';

 v_rechazado:=false;
 begin
   perform public.sgic_registrar_periodo_alimentacion(jsonb_build_object(
     'solicitud',gen_random_uuid(),'lote_id',v_lotes[1],
     'fecha_inicio',v_today::text,'fecha_fin',v_today::text,
     'suministros_dia',2,'tipo_registro','DESCONTADO','descontar_stock',true,
     'detalles',jsonb_build_array(jsonb_build_object('producto_id',v_producto,
       'cantidad_por_suministro',101))));
 exception when others then v_rechazado:=true;end;
 assert v_rechazado,'Se permitió registrar consumo real superior al stock';

 v_ultimo:=public.sgic_registrar_periodo_alimentacion(jsonb_build_object(
   'solicitud',gen_random_uuid(),'lote_id',v_lotes[1],
   'fecha_inicio',v_today::text,'fecha_fin',v_today::text,
   'suministros_dia',2,'tipo_registro','DESCONTADO','descontar_stock',true,
   'detalles',jsonb_build_array(jsonb_build_object('producto_id',v_producto,
     'cantidad_por_suministro',2))));
 assert (select estado='DESCONTADO' and consumo_id is not null
   from public.periodo_alimentacion where id=v_ultimo),'No se guardó consumo real bajo planificación';
 assert (select stock_actual=196 from public.producto where id=v_producto),
   'Consumo real no descontó únicamente 4kg';
 assert (select count(*)=3 from public.periodo_alimentacion where id=any(v_ids)),
   'Un consumo real alteró las planificaciones';

end $test$;
select 'PASS: 3 lotes planifican 1000 kg con 200 kg stock; sin descuento; consumo real independiente' as resultado;
rollback;
