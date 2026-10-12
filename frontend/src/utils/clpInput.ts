/**
 * Interpreta importes positivos CLP escritos con teclado, sin los controles de
 * incremento/decremento de <input type="number">. Permite:
 *   180000, 180.000, 180000,50, 180.000,50 y 180000.50
 * El punto seguido de tres dígitos se trata como separador de miles (es-CL).
 * Se rechazan importes ambiguos, negativos y con más de dos decimales.
 */
export function parseClpAmount(input: string): number | null {
  const raw=input.trim()
  if (!raw) return null
  let canonical: string
  if (/^\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?$/.test(raw)) {
    canonical=raw.replace(/\./g,'').replace(',','.')
  } else if (/^\d+(?:[.,]\d{1,2})?$/.test(raw)) {
    canonical=raw.replace(',','.')
  } else {
    return null
  }
  const amount=Number(canonical)
  if (!Number.isFinite(amount) || amount<=0 || amount>9999999999.99) return null
  return amount
}
