/** Cálculo de entrega diaria: las cantidades enviadas a Supabase SIEMPRE son totales del lote. */
export type ModoRacion = 'LOTE'|'ANIMAL'
export type LineaRacion = { id:number; producto_id:number; cantidad_diaria:number }
export type ResultadoRacion = {
  lineas:{detalle_id:number;producto_id:number;ingresado:number;cantidad:number;porAnimal:number}[]
  errores:string[]; stockInsuficiente:{productoId:number;requerido:number;disponible:number}[]
}
const redondear=(n:number,decimales:number)=>Math.round((n+Number.EPSILON)*10**decimales)/10**decimales
function leerCantidad(valor:string|undefined):number{
  if(valor===undefined||!valor.trim())return NaN
  return Number(valor.trim().replace(',','.'))
}
export function calcularRacionDiaria(
  componentes:LineaRacion[],
  entradas:Record<string,string>,
  modo:ModoRacion,
  cabezas:number,
  stockPorProducto:Record<number,number>={}
):ResultadoRacion{
  const errores:string[]=[]
  const lineas=componentes.map(d=>{
    const valor=leerCantidad(entradas[d.id]??String(d.cantidad_diaria))
    if(!Number.isFinite(valor)||valor<0){
      errores.push('Ingresa cantidades válidas, mayores o iguales a cero.')
    }
    const normal=Number.isFinite(valor)&&valor>=0?valor:0
    if(modo==='LOTE'&&Math.abs(normal-redondear(normal,3))>1e-8)
      errores.push('Las entregas totales del lote admiten hasta tres decimales.')
    if(modo==='ANIMAL'&&Math.abs(normal-redondear(normal,5))>1e-8)
      errores.push('Las raciones por ternero admiten hasta cinco decimales.')
    const cantidad=redondear(modo==='ANIMAL'?normal*cabezas:normal,3)
    return {detalle_id:d.id,producto_id:d.producto_id,ingresado:normal,
      cantidad,porAnimal:cabezas>0?redondear(cantidad/cabezas,5):0}
  })
  if(modo==='ANIMAL'&&(!Number.isInteger(cabezas)||cabezas<=0))
    errores.push('No se puede calcular por ternero sin animales activos en el lote.')
  if(!lineas.some(l=>l.cantidad>0))errores.push('Registra una cantidad positiva en al menos un alimento.')
  // Las existencias deben compararse por PRODUCTO: un insumo puede aparecer en varias líneas.
  const necesarios=new Map<number,number>()
  for(const l of lineas)necesarios.set(l.producto_id,(necesarios.get(l.producto_id)??0)+l.cantidad)
  const stockInsuficiente=[...necesarios].flatMap(([productoId,requerido])=>{
    const disponible=stockPorProducto[productoId]
    return Number.isFinite(disponible)&&requerido>disponible+0.000001
      ? [{productoId,requerido:redondear(requerido,3),disponible}]:[]
  })
  return {lineas,errores:[...new Set(errores)],stockInsuficiente}
}
/** Convierte la ración total existente en sugerencia editable por animal (sin alterar el plan). */
export function sugerenciaPorAnimal(componentes:LineaRacion[],cabezas:number):Record<string,string>{
  if(!Number.isInteger(cabezas)||cabezas<=0)return {}
  return Object.fromEntries(componentes.map(d=>[String(d.id),String(redondear(Number(d.cantidad_diaria)/cabezas,5))]))
}
