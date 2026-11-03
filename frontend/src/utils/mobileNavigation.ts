/** Tres destinos directos y la cuarta pestaña "Más" en el pie móvil. */
export const MOBILE_PRIMARY_MODULES=['resumen','animales','inventario'] as const

export function isMobilePrimaryModule(module:string){
  return (MOBILE_PRIMARY_MODULES as readonly string[]).includes(module)
}
export function isMobileMoreModule(module:string){
  return !isMobilePrimaryModule(module)
}
