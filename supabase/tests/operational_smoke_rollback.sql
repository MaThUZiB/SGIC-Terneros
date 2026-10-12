-- PRUEBA REGRESIVA DE DESARROLLO. Ejecutar únicamente desde el SQL Editor
-- con un administrador existente y el dataset DEMO cargado.
-- TODAS LAS OPERACIONES SE REVIERTEN MEDIANTE ROLLBACK.
begin;
select set_config('request.jwt.claim.sub',
  (select id::text from public.perfil where rol='ADMIN' and activo order by creado_el limit 1),
  true);
set local role authenticated;

do $test$
declare
  v_prod bigint; v_prov bigint; v_lote bigint; v_compra bigint; v_venta bigint;
  v_ids bigint[]; v_stock numeric; v_total numeric; v_original numeric;
  v_ref bigint; v_rechazado boolean:=false;
begin
  select id into v_prod from public.producto where nombre='Sustituto lácteo DEMO';
  select id into v_prov from public.proveedor where nombre like 'Proveedor DEMO%' order by id limit 1;
  select id into v_lote from public.lote where codigo='DEMO-2026-A';
  select array_agg(id order by id) into v_ids from public.animal
   where lote_id=v_lote and estado='ACTIVO' and diio like 'DEMO-%';
  if v_prod is null or v_prov is null or v_lote is null or array_length(v_ids,1)<>10 then
    raise exception 'Dataset DEMO original no disponible. Prueba cancelada.';
  end if;
  select stock_actual into v_original from public.producto where id=v_prod;
  v_compra:=public.sgic_crear_compra_insumo(v_prov,
    jsonb_build_array(jsonb_build_object('producto_id',v_prod,'cantidad',20,
      'cantidad_base',20,'precio_unitario',1000)),
    current_date,'PRUEBA-ROLLBACK');
  if (select estado from public.compra_insumo where id=v_compra)<>'BORRADOR' then
    raise exception 'Compra no permanece en borrador'; end if;
  perform public.sgic_confirmar_compra_insumo(v_compra);
  select stock_actual into v_stock from public.producto where id=v_prod;
  if v_stock<>v_original+20 then raise exception 'Entrada de stock incorrecta'; end if;
  perform public.sgic_registrar_consumo(v_lote,v_prod,5,current_date);
  select stock_actual into v_stock from public.producto where id=v_prod;
  if v_stock<>v_original+15 then raise exception 'Consumo / stock incorrecto'; end if;
  v_venta:=public.sgic_borrador_venta(v_ids[1:2],450000,'PRUEBA',current_date);
  if (select count(*) from public.animal where id=any(v_ids[1:2]) and estado='ACTIVO')<>2 then
    raise exception 'Borrador modificó animales'; end if;
  perform public.sgic_confirmar_borrador_venta(v_venta);
  if (select count(*) from public.animal_venta av
       join public.detalle_venta d on d.id=av.detalle_venta_id
       where d.venta_id=v_venta)<>2 then
    raise exception 'DIIO de venta inconsistentes'; end if;
  perform public.sgic_confirmar_venta(v_ids[3:10],1800000,'PRUEBA',current_date);
  select sum(d.costo_reconocido) into v_total from public.detalle_venta d
    where d.lote_id=v_lote and d.venta_id in
      (select id from public.venta where comprador='PRUEBA');
  if v_total<>1700000+5000 then
    raise exception 'Costo reconocido dos veces o valor incorrecto: %',v_total; end if;

  begin
    perform public.sgic_autorizar_usuario(auth.uid(),'OPERADOR',false);
  exception when others then v_rechazado:=true;
  end;
  if not v_rechazado then raise exception 'Se pudo desactivar el último administrador'; end if;
end
$test$;
select 'PASS: purchase, PMP, stock, consumption, sales, DIIO, cost pool and privileges; all rolled back' resultado;
rollback;