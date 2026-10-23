/** Resumen derivado de consumos reales; la asignación no genera salidas de stock. */
export type ComponentePlan = { id:number; producto_id:number; cantidad_diaria:number; unidad_id:number }
export type Asignacion = {
  id:number; lote_id:number; plan_id:number; fecha_inicio:string;
  fecha_fin:string|null; activo:boolean; observaciones?:string|null;
  componentes:ComponentePlan[]
}
export type Consumo = {
  id:number; lote_id:number|null; fecha:string; origen:string;
  observaciones:string|null
}
export type DetalleConsumo = {
  id:number; consumo_id:number; producto_id:number;
  cantidad:number; costo_total:number
}
export type DiaAlimentacion = {
  fecha:string; asignacionId:number; registrado:boolean; confirmadoPlan:boolean;
  registros:number
}
export type ProductoAcumulado = {
  productoId:number; planificado:number; realDurantePlan:number;
  realTotal:number; costoTotal:number
}
export type SeguimientoLote = {
  diasProgramados:number; diasRegistrados:number; diasSinRegistro:number;
  diasConfirmadosPlan:number; diasConRegistroManual:number;
  costoTotal:number; registrosTotales:number; diasRecientes:DiaAlimentacion[];
  productos:ProductoAcumulado[]; diasSinPlanConConsumo:number;
  ultimosRegistros:Consumo[]; periodosAnalizados:number
}
const MS_DIA = 86_400_000
const diaNumero=(fecha:string)=>Date.parse(fecha+'T00:00:00Z')/MS_DIA
const diaISO=(dia:number)=>new Date(dia*MS_DIA).toISOString().slice(0,10)
const sinEjecucion=(a:Asignacion)=>a.observaciones?.includes('SGIC_SIN_EJECUCION')===true
export function asignacionEnFecha(a:Asignacion,fecha:string):boolean{
  return a.fecha_inicio<=fecha && (!a.fecha_fin || fecha<=a.fecha_fin) &&
    !(sinEjecucion(a)&&a.fecha_inicio===a.fecha_fin)
}
export function calcularSeguimientoLote(
  loteId:number, asignaciones:Asignacion[], consumos:Consumo[],
  detalles:DetalleConsumo[], hoy:string, fallback:ComponentePlan[]=[]
):SeguimientoLote {
  const delLote=asignaciones.filter(a=>a.lote_id===loteId)
    .sort((a,b)=>b.fecha_inicio.localeCompare(a.fecha_inicio)||b.id-a.id)
  const movimientos=consumos.filter(c=>c.lote_id===loteId && (c.origen==='PLAN'||c.origen==='REAL'))
  const fechas=new Map<string,Consumo[]>()
  for(const c of movimientos){
    const lista=fechas.get(c.fecha)??[]
    lista.push(c);fechas.set(c.fecha,lista)
  }
  const movimientoIds=new Set(movimientos.map(c=>c.id))
  const totales=new Map<number,ProductoAcumulado>()
  const producto=(id:number)=>{
    let entry=totales.get(id)
    if(!entry){entry={productoId:id,planificado:0,realDurantePlan:0,realTotal:0,costoTotal:0};totales.set(id,entry)}
    return entry
  }
  let costoTotal=0
  for(const d of detalles){
    if(!movimientoIds.has(d.consumo_id))continue
    const entry=producto(d.producto_id)
    entry.realTotal+=Number(d.cantidad)
    entry.costoTotal+=Number(d.costo_total)
    costoTotal+=Number(d.costo_total)
  }
  const primera=delLote.length?Math.min(...delLote.map(a=>diaNumero(a.fecha_inicio))):NaN
  const ultimo=diaNumero(hoy)
  // Acotar fechas anómalas sin perder los acumulados reales de la BD.
  const maxDias=7300
  const inicio=Number.isFinite(primera)&&Number.isFinite(ultimo)?Math.max(primera,ultimo-maxDias+1):ultimo+1
  const dias:DiaAlimentacion[]=[]
  let programados=0,registrados=0,confirmados=0,manuales=0
  const idsEnDiasPlanificados=new Set<number>()
  for(let n=inicio;n<=ultimo;n++){
    const fecha=diaISO(n)
    const asignacion=delLote.find(a=>asignacionEnFecha(a,fecha))
    if(!asignacion)continue
    programados++
    const components=asignacion.componentes?.length?asignacion.componentes:fallback.filter(c=>c.id===asignacion.plan_id)
    for(const c of components)producto(c.producto_id).planificado+=Number(c.cantidad_diaria)
    const entradas=fechas.get(fecha)??[]
    const confirmacion=entradas.some(c=>c.origen==='PLAN'&&c.observaciones==='PLAN_ASIGNACION:'+asignacion.id)
    const manual=entradas.some(c=>c.origen==='REAL')
    if(entradas.length)registrados++
    if(confirmacion)confirmados++
    if(manual)manuales++
    entradas.forEach(c=>idsEnDiasPlanificados.add(c.id))
    dias.push({fecha,asignacionId:asignacion.id,registrado:entradas.length>0,confirmadoPlan:confirmacion,registros:entradas.length})
  }
  for(const d of detalles){
    if(!idsEnDiasPlanificados.has(d.consumo_id))continue
    producto(d.producto_id).realDurantePlan+=Number(d.cantidad)
  }
  const sinPlan=[...fechas].filter(([fecha])=>!delLote.some(a=>asignacionEnFecha(a,fecha))).length
  return {
    diasProgramados:programados, diasRegistrados:registrados,
    diasSinRegistro:programados-registrados,diasConfirmadosPlan:confirmados,
    diasConRegistroManual:manuales,costoTotal,registrosTotales:movimientos.length,
    diasRecientes:dias.slice(-21).reverse(),
    productos:[...totales.values()].sort((a,b)=>a.productoId-b.productoId),
    diasSinPlanConConsumo:sinPlan,
    ultimosRegistros:[...movimientos].sort((a,b)=>b.fecha.localeCompare(a.fecha)||b.id-a.id).slice(0,20),
    periodosAnalizados:Math.min(maxDias,Math.max(0,ultimo-inicio+1))
  }
}
