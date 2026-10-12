-- Seguridad inicial: ninguna tabla de negocio queda disponible directamente al cliente.
-- Exponer lectura del perfil propio como única excepción temporal.
begin;
do $$
declare t text;
begin
 foreach t in array array[
 'perfil','raza','lote','animal','peso_animal','proveedor','compra_animal',
 'detalle_compra_animal','categoria_producto','unidad_medida','producto',
 'presentacion_producto','conversion_producto','movimiento_inventario',
 'compra_insumo','detalle_compra_insumo','plan_consumo','detalle_plan_consumo',
 'asignacion_plan_lote','consumo','detalle_consumo','tratamiento',
 'categoria_gasto','gasto','venta','detalle_venta','animal_venta','registro_auditoria'
 ] loop
   execute format('alter table public.%I enable row level security', t);
   execute format('revoke all on table public.%I from anon, authenticated', t);
 end loop;
end $$;
grant select on table public.perfil to authenticated;
create policy perfil_solo_lectura_propia
  on public.perfil for select to authenticated
  using (id = (select auth.uid()));
-- No se permite escribir perfiles ni roles mediante Data API.
-- No abrir políticas CRUD empresariales hasta implementar y probar autorización.
commit;
