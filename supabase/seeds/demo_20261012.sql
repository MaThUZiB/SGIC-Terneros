-- SGIC Terneros: datos FICTICIOS de demostración, no información empresarial real.
-- Ejecutar explícitamente SOLO en el proyecto de desarrollo.
-- No incluir en supabase/migrations: este archivo nunca debe ejecutarse automáticamente en producción.
-- La carga es atómica y se niega a ejecutarse sobre datos existentes.
begin;
do $demo$
declare
  v_raza_angus bigint;
  v_raza_hereford bigint;
  v_proveedor_a bigint;
  v_proveedor_b bigint;
  v_lote_a bigint;
  v_lote_b bigint;
  v_compra_a bigint;
  v_compra_b bigint;
  v_animal bigint;
  v_categoria_alimento bigint;
  v_categoria_sanidad bigint;
  v_categoria_limpieza bigint;
  v_kg bigint;
  v_l bigint;
  v_ml bigint;
  v_leche bigint;
  v_concentrado bigint;
  v_heno bigint;
  v_minerales bigint;
  v_plan_a bigint;
  v_plan_b bigint;
  v_compra_insumo bigint;
  v_presentacion_leche bigint;
  v_presentacion_concentrado bigint;
  v_i integer;
begin
  if exists(select 1 from public.animal)
     or exists(select 1 from public.lote)
     or exists(select 1 from public.compra_animal)
     or exists(select 1 from public.producto)
     or exists(select 1 from public.proveedor) then
    raise exception 'Carga DEMO cancelada: ya existen datos de negocio. No se modificó nada.';
  end if;

  insert into public.raza(nombre) values ('Angus') returning id into v_raza_angus;
  insert into public.raza(nombre) values ('Hereford') returning id into v_raza_hereford;

  insert into public.proveedor(nombre,activo)
    values ('Proveedor DEMO - Criadero Norte',true)
    returning id into v_proveedor_a;
  insert into public.proveedor(nombre,activo)
    values ('Proveedor DEMO - Feria Regional',true)
    returning id into v_proveedor_b;

  insert into public.lote(codigo,fecha_ingreso,cantidad_original,cantidad_actual,estado,observaciones)
    values ('DEMO-2026-A',date '2026-09-15',10,10,'ACTIVO','Lote ficticio de demostración')
    returning id into v_lote_a;
  insert into public.lote(codigo,fecha_ingreso,cantidad_original,cantidad_actual,estado,observaciones)
    values ('DEMO-2026-B',date '2026-09-20',8,8,'ACTIVO','Lote ficticio de demostración')
    returning id into v_lote_b;

  insert into public.compra_animal(fecha,proveedor_id,total,observaciones)
    values (date '2026-09-15',v_proveedor_a,1700000,'DEMO - compra ficticia de diez terneros')
    returning id into v_compra_a;
  insert into public.compra_animal(fecha,proveedor_id,total,observaciones)
    values (date '2026-09-20',v_proveedor_b,1520000,'DEMO - compra ficticia de ocho terneros')
    returning id into v_compra_b;

  for v_i in 1..10 loop
    insert into public.animal(
      diio,lote_id,raza_id,sexo,edad_aproximada_dias,fecha_adquisicion,
      precio_adquisicion,peso_ingreso_kg,estado,observaciones
    ) values (
      'DEMO-' || lpad(v_i::text,6,'0'),v_lote_a,v_raza_angus,
      case when v_i % 3 = 0 then 'HEMBRA' else 'MACHO' end,
      65,date '2026-09-15',170000,70+(v_i%5), 'ACTIVO','Animal ficticio para pruebas'
    ) returning id into v_animal;
    insert into public.detalle_compra_animal(compra_id,animal_id,precio_adquisicion,peso_compra)
      values(v_compra_a,v_animal,170000,70+(v_i%5));
  end loop;

  for v_i in 11..18 loop
    insert into public.animal(
      diio,lote_id,raza_id,sexo,edad_aproximada_dias,fecha_adquisicion,
      precio_adquisicion,peso_ingreso_kg,estado,observaciones
    ) values (
      'DEMO-' || lpad(v_i::text,6,'0'),v_lote_b,v_raza_hereford,
      case when v_i % 4 = 0 then 'HEMBRA' else 'MACHO' end,
      80,date '2026-09-20',190000,82+(v_i%6), 'ACTIVO','Animal ficticio para pruebas'
    ) returning id into v_animal;
    insert into public.detalle_compra_animal(compra_id,animal_id,precio_adquisicion,peso_compra)
      values(v_compra_b,v_animal,190000,82+(v_i%6));
  end loop;

  insert into public.categoria_producto(nombre,descripcion) values
     ('Alimentación DEMO','Categoría de prueba: no usar como fuente de costos reales')
     returning id into v_categoria_alimento;
  insert into public.categoria_producto(nombre,descripcion) values
     ('Sanidad DEMO','Categoría de prueba')
     returning id into v_categoria_sanidad;
  insert into public.categoria_producto(nombre,descripcion) values
     ('Limpieza DEMO','Categoría de prueba')
     returning id into v_categoria_limpieza;

  insert into public.unidad_medida(codigo,nombre,tipo,decimales) values
    ('kg','Kilogramo','MASA',3) returning id into v_kg;
  insert into public.unidad_medida(codigo,nombre,tipo,decimales) values
    ('L','Litro','VOLUMEN',3) returning id into v_l;
  insert into public.unidad_medida(codigo,nombre,tipo,decimales) values
    ('ml','Mililitro','VOLUMEN',3) returning id into v_ml;

  insert into public.producto(nombre,categoria_id,unidad_base_id,stock_actual,stock_minimo,costo_promedio,observaciones)
     values('Sustituto lácteo DEMO',v_categoria_alimento,v_kg,0,25,0,'Sin existencias; compras en borrador no afectan stock')
     returning id into v_leche;
  insert into public.producto(nombre,categoria_id,unidad_base_id,stock_actual,stock_minimo,costo_promedio,observaciones)
     values('Concentrado iniciador DEMO',v_categoria_alimento,v_kg,0,50,0,'Sin existencias')
     returning id into v_concentrado;
  insert into public.producto(nombre,categoria_id,unidad_base_id,stock_actual,stock_minimo,costo_promedio)
     values('Heno DEMO',v_categoria_alimento,v_kg,0,50,0)
     returning id into v_heno;
  insert into public.producto(nombre,categoria_id,unidad_base_id,stock_actual,stock_minimo,costo_promedio)
     values('Sales minerales DEMO',v_categoria_alimento,v_kg,0,5,0)
     returning id into v_minerales;
  insert into public.producto(nombre,categoria_id,unidad_base_id,stock_actual,stock_minimo,costo_promedio)
     values('Vacuna veterinaria DEMO',v_categoria_sanidad,v_ml,0,100,0);
  insert into public.producto(nombre,categoria_id,unidad_base_id,stock_actual,stock_minimo,costo_promedio)
     values('Desinfectante DEMO',v_categoria_limpieza,v_l,0,10,0);

  insert into public.presentacion_producto(producto_id,nombre,cantidad_base,unidad_base_id)
     values(v_leche,'Saco de 25 kg DEMO',25,v_kg)
     returning id into v_presentacion_leche;
  insert into public.presentacion_producto(producto_id,nombre,cantidad_base,unidad_base_id)
     values(v_concentrado,'Saco de 25 kg DEMO',25,v_kg)
     returning id into v_presentacion_concentrado;

  -- Compra a proveedor en BORRADOR: no suma stock ni crea movimientos.
  insert into public.compra_insumo(proveedor_id,fecha,numero_documento,estado,total,observaciones)
     values(v_proveedor_a,date '2026-10-05','DEMO-COT-001','BORRADOR',525000,
            'Precios inventados exclusivamente para pruebas')
     returning id into v_compra_insumo;
  insert into public.detalle_compra_insumo(
    compra_id,producto_id,presentacion_id,cantidad,cantidad_base,precio_unitario,subtotal
  ) values
    (v_compra_insumo,v_leche,v_presentacion_leche,8,200,1800,360000),
    (v_compra_insumo,v_concentrado,v_presentacion_concentrado,10,250,660,165000);

  insert into public.plan_consumo(nombre,descripcion,observaciones)
     values('Plan de inicio DEMO','Referencia de alimentación; no descuenta inventario.',
            'No generar consumos hasta implementar operación transaccional')
     returning id into v_plan_a;
  insert into public.plan_consumo(nombre,descripcion)
     values('Plan crecimiento DEMO','Referencia para pruebas, sin consumo automático')
     returning id into v_plan_b;
  insert into public.detalle_plan_consumo(plan_id,producto_id,cantidad_diaria,unidad_id) values
    (v_plan_a,v_leche,0.250,v_kg),
    (v_plan_a,v_concentrado,0.500,v_kg),
    (v_plan_b,v_concentrado,1.500,v_kg),
    (v_plan_b,v_heno,0.900,v_kg),
    (v_plan_b,v_minerales,0.020,v_kg);
  insert into public.asignacion_plan_lote(lote_id,plan_id,fecha_inicio) values
    (v_lote_a,v_plan_a,date '2026-09-15'),
    (v_lote_b,v_plan_b,date '2026-09-20');

  insert into public.categoria_gasto(nombre,descripcion) values
     ('Flete DEMO','Categoría ficticia de transporte'),
     ('Comisión de feria DEMO','Categoría ficticia de comercialización');

  raise notice 'Carga ficticia terminada: 18 animales, 2 lotes, 6 productos, 2 compras animales, 1 borrador insumos';
end
$demo$;
commit;
