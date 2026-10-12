-- SGIC-Terneros: registrar y confirmar insumos en una sola transacción.
-- Si el kardex o el PMP falla, la compra completa se revierte.
begin;
create or replace function public.sgic_comprar_insumo(
  p_proveedor_id bigint,
  p_detalles jsonb,
  p_fecha date default current_date,
  p_documento text default null
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  v_actor uuid;
  v_compra_id bigint;
begin
  v_actor := sgic_private.actor(true);
  v_compra_id := public.sgic_crear_compra_insumo(
    p_proveedor_id => p_proveedor_id,
    p_detalles => p_detalles,
    p_fecha => p_fecha,
    p_documento => p_documento
  );
  if not public.sgic_confirmar_compra_insumo(v_compra_id) then
    raise exception 'La compra no se pudo confirmar';
  end if;
  return v_compra_id;
end;
$fn$;
revoke all on function public.sgic_comprar_insumo(bigint,jsonb,date,text)
  from public, anon, authenticated;
grant execute on function public.sgic_comprar_insumo(bigint,jsonb,date,text)
  to authenticated;
commit;
