-- Verificación transaccional sin datos DEMO previos. No deja registros de negocio.
-- Requiere un ADMIN activo. Las secuencias pueden avanzar aunque se reviertan las filas.
begin;
select set_config('request.jwt.claim.sub',
 (select id::text from public.perfil where activo and rol='ADMIN' order by creado_el limit 1),true);
set local role authenticated;
do $test$
declare
 v_ingreso bigint; v_lote bigint; v_animal bigint; v_categoria bigint; v_unidad bigint;
 v_producto bigint; v_proveedor bigint; v_consumo bigint; v_tratamiento bigint;
 v_rechazado boolean:=false; v_anteriores bigint;
begin
 v_ingreso:=public.sgic_incorporar_desde_sipec('INICIAL',current_date,null,'QA-INICIO-REVERTIDO',null,null,
 '[{"diio":"099999983","sexo":"MACHO","raza_nombre":"QA RAZA REVERTIDA","valor_base":180000}]');
 select lote_id into v_lote from public.ingreso_sipec where id=v_ingreso;
 select id into v_animal from public.animal where diio='099999983';
 if (select cantidad_actual from public.lote where id=v_lote)<>1
   or (select precio_adquisicion from public.animal where id=v_animal)<>180000 then
   raise exception 'Ingreso o conteo incorrecto'; end if;
 select count(*) into v_anteriores from public.ingreso_sipec;
 begin
   perform public.sgic_incorporar_desde_sipec('INICIAL',current_date,null,'QA-DUP-REVERTIDO',null,null,
   '[{"diio":"099999984","sexo":"MACHO","raza_nombre":"QA RAZA REVERTIDA","valor_base":100000},
     {"diio":"099999983","sexo":"MACHO","raza_nombre":"QA RAZA REVERTIDA","valor_base":100000}]');
 exception when unique_violation then v_rechazado:=true;
 end;
 if not v_rechazado or exists(select 1 from public.animal where diio='099999984')
   or (select count(*) from public.ingreso_sipec)<>v_anteriores
   or exists(select 1 from public.lote where codigo='QA-DUP-REVERTIDO') then
   raise exception 'No se rechazó el duplicado de forma atómica'; end if;
 v_categoria:=public.sgic_catalogo('categoria_producto','QA ALIMENTO REVERTIDO');
 v_unidad:=public.sgic_catalogo('unidad_medida','QA KILOGRAMO','{"codigo":"QA-KG","tipo":"MASA"}');
 v_producto:=public.sgic_catalogo('producto','QA PRODUCTO REVERTIDO',
   jsonb_build_object('categoria_id',v_categoria,'unidad_base_id',v_unidad));
 v_proveedor:=public.sgic_catalogo('proveedor','QA PROVEEDOR REVERTIDO');
 perform public.sgic_comprar_insumo(v_proveedor,
   jsonb_build_array(jsonb_build_object('producto_id',v_producto,'cantidad',20,'cantidad_base',20,'precio_unitario',1000)),
   current_date,'QA REVERTIDO');
 if (select stock_actual from public.producto where id=v_producto)<>20
   or (select costo_promedio from public.producto where id=v_producto)<>1000 then
   raise exception 'Compra, stock o costo promedio incorrectos'; end if;
 v_consumo:=public.sgic_registrar_consumo(v_lote,v_producto,5,current_date);
 v_tratamiento:=public.sgic_registrar_tratamiento(v_animal,v_producto,1,'QA verificación reversible',current_date);
 if (select stock_actual from public.producto where id=v_producto)<>14
   or (select sum(costo_total) from public.detalle_consumo where consumo_id=v_consumo)<>5000
   or (select costo_total from public.tratamiento where id=v_tratamiento)<>1000 then
   raise exception 'Consumo, v_tratamiento o costos incorrectos'; end if;
end;
$test$;
select 'PASS: ingreso SIPEC, duplicados y atomicidad, catálogos, compra, stock, alimentación y tratamiento' as resultado;
rollback;
