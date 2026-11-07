-- Transactional integration test. Never commits test records.
begin;
select set_config('request.jwt.claim.sub',(select id::text from public.perfil where rol='ADMIN' and activo limit 1),true);
set local role authenticated;
do $test$
declare p jsonb; id1 bigint; pid bigint; bolo bigint; med bigint; lid bigint; periodo bigint; r bigint; before_count bigint; caught boolean;
begin
 p:=jsonb_build_object('solicitud',gen_random_uuid(),'tipo','COMPRA','fecha',current_date,'nombre','TEST_INSUMOS_LECHE','tipo_insumo','LECHE','unidad','kg','cantidad',4,'precio_unitario',60000,'factor',25,'presentacion','saco');
 id1:=public.sgic_ingresar_insumo(p);
 select producto_id into pid from public.ingreso_insumo where id=id1;
 assert (select stock_actual=100 and costo_promedio=2400 from public.producto where id=pid),'Sacos, stock o costo';
 assert (select total=240000 from public.compra_insumo where id=(select compra_id from public.ingreso_insumo where id=id1)),'Total compra';
 assert public.sgic_ingresar_insumo(p)=id1,'Reintento idempotente';
 assert (select stock_actual=100 from public.producto where id=pid),'Stock duplicado';
 select count(*) into before_count from public.compra_insumo;
 r:=public.sgic_ingresar_insumo(jsonb_build_object('solicitud',gen_random_uuid(),'tipo','INICIAL','fecha',current_date,'nombre','TEST_INSUMOS_PAJA','tipo_insumo','CAMA','unidad','bolo','cantidad',2,'precio_unitario',35000));
 select producto_id into bolo from public.ingreso_insumo where id=r;
 assert (select count(*)=before_count from public.compra_insumo),'Inicial generó compra';
 lid:=public.sgic_catalogo('lote','TEST_INSUMOS_LOTE','{}');
 p:=jsonb_build_object('solicitud',gen_random_uuid(),'producto_id',bolo,'cantidad',0.5,'finalidad','CAMA','fecha',current_date,'lote_id',lid,'motivo','Cama del lote');
 r:=public.sgic_usar_insumo(p);
 assert public.sgic_usar_insumo(p)=r,'Uso duplicado';
 assert (select stock_actual=1.5 from public.producto where id=bolo),'Medio bolo';
 assert (select costo_total=17500 and gasto_id is not null and consumo_id is null from public.uso_insumo where id=r),'Clasificación cama';
 assert (select alimentacion=0 and gastos_imputables=17500 from public.sgic_rentabilidad_lote where lote_id=lid),'Cama duplicada en alimentación';
 caught:=false;
 begin perform public.sgic_usar_insumo(p||jsonb_build_object('solicitud',gen_random_uuid(),'cantidad',5)); exception when others then caught:=true; end;
 assert caught,'Stock insuficiente permitido';
 assert (select stock_actual=1.5 from public.producto where id=bolo),'Salida fallida modificó stock';
 r:=public.sgic_ingresar_insumo(jsonb_build_object('solicitud',gen_random_uuid(),'tipo','COMPRA','fecha',current_date,'nombre','TEST_INSUMOS_MED','tipo_insumo','MEDICAMENTO','unidad','ml','cantidad',1,'precio_unitario',100,'factor',300,'presentacion','frasco'));
 select producto_id into med from public.ingreso_insumo where id=r;
 assert (select total=100 from public.ingreso_insumo where id=r),'Redondeo cambió total comercial';
 r:=public.sgic_usar_insumo(jsonb_build_object('solicitud',gen_random_uuid(),'producto_id',med,'cantidad',10,'finalidad','TRATAMIENTO','fecha',current_date,'lote_id',lid,'motivo','Tratamiento lote'));
 assert (select stock_actual=290 from public.producto where id=med),'Tratamiento descontó dos veces';
 assert (select sanidad=3.33 from public.sgic_rentabilidad_lote where lote_id=lid),'Tratamiento por lote ausente de costos';
 p:=jsonb_build_object(
   'solicitud',gen_random_uuid(),'lote_id',lid,
   'fecha_inicio',((now() at time zone 'America/Santiago')::date-1)::text,
   'fecha_fin',((now() at time zone 'America/Santiago')::date)::text,
   'descontar_stock',true,
   'detalles',jsonb_build_array(jsonb_build_object('producto_id',pid,'cantidad',7))
 );
 periodo:=public.sgic_registrar_periodo_alimentacion(p);
 assert (select estado='DESCONTADO' and consumo_id is not null from public.periodo_alimentacion where id=periodo),
   'No registró consumo por período';
 assert (select stock_actual=93 from public.producto where id=pid),'No descontó 7 kg en período';
 assert public.sgic_registrar_periodo_alimentacion(p)=periodo,'Reintento duplicó período';
 assert (select stock_actual=93 from public.producto where id=pid),'Reintento descontó stock dos veces';
 caught:=false;
 begin
   perform public.sgic_registrar_periodo_alimentacion(p||jsonb_build_object('solicitud',gen_random_uuid()));
 exception when others then caught:=true;
 end;
 assert caught,'Se permitió superponer un período para el mismo lote';
 assert (select stock_actual=93 from public.producto where id=pid),'Período superpuesto alteró existencias';
 p:=jsonb_build_object(
   'solicitud',gen_random_uuid(),'lote_id',lid,
   'fecha_inicio',((now() at time zone 'America/Santiago')::date-4)::text,
   'fecha_fin',((now() at time zone 'America/Santiago')::date-3)::text,
   'descontar_stock',false,
   'detalles',jsonb_build_array(jsonb_build_object('producto_id',pid,'cantidad',10))
 );
 r:=public.sgic_registrar_periodo_alimentacion(p);
 assert (select estado='ESTIMADO' and consumo_id is null from public.periodo_alimentacion where id=r),
   'No guardó estimación sin consumo contable';
 assert (select stock_actual=93 from public.producto where id=pid),'La estimación alteró inventario';
 caught:=false;begin update public.producto set stock_actual=999 where id=pid;exception when insufficient_privilege then caught:=true;end;
 assert caught,'DML directo permitido';
end $test$;
reset role;
select set_config('request.jwt.claim.sub','',true);
set local role authenticated;
do $test$ declare caught boolean:=false; begin
 begin perform public.sgic_ingresar_insumo('{}');exception when insufficient_privilege then caught:=true;end;
 assert caught,'RPC sin identidad permitido';
end $test$;
reset role;
select 'PASS: purchase, initial stock, fractions, costs, treatment, feeding periods, retries, RLS and authorization' as result;
rollback;
