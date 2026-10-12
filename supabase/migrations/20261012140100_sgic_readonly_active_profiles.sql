-- Lectura SGIC habilitada SOLO para cuentas Supabase activas.
-- Las tablas empresariales conservan INSERT/UPDATE/DELETE denegados.
begin;
do $policy$
declare target_table text;
begin
  foreach target_table in array array[
   'raza','lote','animal','peso_animal','proveedor','compra_animal','detalle_compra_animal',
   'categoria_producto','unidad_medida','producto','presentacion_producto','conversion_producto',
   'movimiento_inventario','compra_insumo','detalle_compra_insumo',
   'plan_consumo','detalle_plan_consumo','asignacion_plan_lote',
   'consumo','detalle_consumo','tratamiento','categoria_gasto','gasto',
   'venta','detalle_venta','animal_venta'
  ] loop
    execute format('grant select on table public.%I to authenticated',target_table);
    execute format($create$
      create policy lectura_usuario_activo on public.%I
      for select to authenticated
      using (
        exists(
          select 1 from public.perfil perfil_sgic
          where perfil_sgic.id = (select auth.uid()) and perfil_sgic.activo = true
        )
      )$create$,target_table);
  end loop;
end $policy$;

grant select on table public.registro_auditoria to authenticated;
create policy lectura_auditoria_admin on public.registro_auditoria
  for select to authenticated
  using (
    exists (
      select 1 from public.perfil p
      where p.id=(select auth.uid()) and p.activo = true and p.rol='ADMIN'
    )
  );
commit;
