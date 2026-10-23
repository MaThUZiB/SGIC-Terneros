/** El stock se conserva en la unidad base; las presentaciones son equivalencias de consulta. */
export type PresentacionStock = {
  id: number
  producto_id: number
  nombre: string
  cantidad_base: number
  activa: boolean
}

export function calcularPresentacionesEquivalentes(stock: number, cantidadBase: number): number | null {
  if (!Number.isFinite(stock) || stock < 0 || !Number.isFinite(cantidadBase) || cantidadBase <= 0) {
    return null
  }
  return stock / cantidadBase
}

/** Pluraliza la primera palabra del nombre comercial sin modificar su descripción. */
export function nombrePresentacionPlural(nombre: string, cantidad: number): string {
  const limpio = nombre.trim()
  if (!limpio) return 'presentaciones'
  if (cantidad === 1) return limpio

  return limpio.replace(/^\S+/u, palabra => {
    const texto = palabra.toLocaleLowerCase('es-CL')
    if (texto.endsWith('s')) return palabra
    if (texto.endsWith('z')) return palabra.slice(0, -1) + 'ces'
    if (/[aeiouáéíóú]$/iu.test(palabra)) return palabra + 's'
    return palabra + 'es'
  })
}
