-- El catálogo de planes se consultaba junto con esta bitácora.
-- La política anterior llamaba sgic_private.actor(), cuya ejecución está
-- correctamente restringida para authenticated. Provocaba 42501 al cargar.
-- Reutilizar el mismo criterio de lectura que los maestros de SGIC.
begin;
drop policy if exists sgic_alimentacion_auto_lectura
  on public.sgic_alimentacion_auto_evento;

create policy sgic_alimentacion_auto_lectura
  on public.sgic_alimentacion_auto_evento
  for select to authenticated
  using (
    exists (
      select 1 from public.perfil perfil_sgic
      where perfil_sgic.id=(select auth.uid())
        and perfil_sgic.activo=true
    )
  );
commit;
