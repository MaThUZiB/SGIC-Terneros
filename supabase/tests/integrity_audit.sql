-- SGIC-Terneros: auditoría de consistencia para ejecutar en Supabase SQL Editor.
-- Solo consultas SELECT: no modifica animales, existencias, precios ni contabilidad.
-- Interpretación del kardex: ENTRADA suma, SALIDA resta, AJUSTE conserva su signo.
with
  ledger as (
    select producto_id, sum(case
      when tipo = 'ENTRADA' then cantidad
      when tipo = 'SALIDA' then -cantidad
      when tipo = 'AJUSTE' then cantidad
      else 0 end) as saldo
    from public.movimiento_inventario group by producto_id
  ),
  existencias as (
    select count(*)::bigint as n from public.producto p
    left join ledger m on m.producto_id = p.id
    where abs(p.stock_actual - coalesce(m.saldo,0)) > 0.001
  ),
  lotes as (
    select count(*)::bigint as n from public.lote l
    where l.cantidad_actual <> (
      select count(*) from public.animal a
      where a.lote_id = l.id and a.estado = 'ACTIVO'
    )
  ),
  compras_insumos as (
    select count(*)::bigint as n from public.compra_insumo c
    where abs(c.total - coalesce((
      select sum(d.subtotal) from public.detalle_compra_insumo d
      where d.compra_id=c.id
    ),0)) > 0.01
  ),
  compras_animales as (
    select count(*)::bigint as n from public.compra_animal c
    where abs(c.total - coalesce((
      select sum(d.precio_adquisicion) from public.detalle_compra_animal d
      where d.compra_id=c.id
    ),0)) > 0.01
  )
select 'Kardex contra stock' as control, n as incidencias from existencias
union all
select 'Animales activos contra conteo de lotes', n from lotes
union all
select 'Total contra detalle de compras de insumos', n from compras_insumos
union all
select 'Total contra detalle de compras animales', n from compras_animales
union all
select 'Productos con stock negativo', count(*) from public.producto where stock_actual < 0
union all
select 'DIIO duplicados',count(*) from (
  select diio from public.animal group by diio having count(*) > 1
) duplicados
order by control;

-- Censo de datos de prueba: no los elimina ni transforma.
select count(*) filter (where diio like 'DEMO-%') as animales_demo,
       count(*) filter (where diio not like 'DEMO-%') as animales_no_demo,
       count(*) as total
from public.animal;
