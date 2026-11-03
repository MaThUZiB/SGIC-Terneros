-- Vista de solo lectura para búsqueda paginada de animales.
-- security_invoker conserva las políticas RLS de animal, raza y lote.
create or replace view public.sgic_animales_busqueda
with (security_invoker=true)
as
select
  a.id, a.diio, a.lote_id, a.raza_id, a.sexo, a.estado,
  a.precio_adquisicion, a.peso_ingreso_kg, a.fecha_nacimiento,
  a.fecha_adquisicion, a.edad_aproximada_dias, a.observaciones,
  r.nombre as raza_nombre, l.codigo as lote_codigo,
  concat_ws(' ',a.diio,r.nombre,l.codigo) as busqueda
from public.animal a
left join public.raza r on r.id=a.raza_id
left join public.lote l on l.id=a.lote_id;

revoke all on public.sgic_animales_busqueda from public, anon;
grant select on public.sgic_animales_busqueda to authenticated;

comment on view public.sgic_animales_busqueda is
'Listado de animales para paginacion con total exacto y busqueda por DIIO, raza o lote; conserva RLS de tablas base.';
