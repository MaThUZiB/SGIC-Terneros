import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../api/supabase'
import { OperationConfirmDialog, type ConfirmDetails } from '../components/OperationConfirmDialog'
import { TableScroll } from '../components/TableScroll'
import {
  calcularSeguimientoLote,
  type Asignacion, type ComponentePlan, type Consumo, type DetalleConsumo
} from '../utils/feedingTracking'

type Plan = { id:number; nombre:string; descripcion:string|null; activo:boolean }
type Detail = ComponentePlan & {plan_id:number}
type Producto = { id:number; nombre:string }
type Unidad = { id:number; nombre:string; codigo:string }
type Lote = { id:number; codigo:string; cantidad_actual:number; cantidad_original:number; estado:string }
type Confirmacion = { kind:'assign'|'unassign'; details:ConfirmDetails; planId?:number; loteId:number }
const hoy=()=>new Date().toLocaleDateString('en-CA',{timeZone:'America/Santiago'})
const clp=(n:number)=>new Intl.NumberFormat('es-CL',{style:'currency',currency:'CLP',maximumFractionDigits:0}).format(n)
const cantidad=(n:number)=>new Intl.NumberFormat('es-CL',{maximumFractionDigits:3}).format(n)
const fecha=(s:string)=>s.split('-').reverse().join('-')
const control='w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-emerald-700'

async function paginar(tabla:'consumo'|'detalle_consumo',columnas:string){
  if(!supabase)throw Error('Sin conexión a Supabase')
  const datos:Record<string,unknown>[]=[]
  const tamano=500
  const maximo=10000
  for(let offset=0;offset<maximo;offset+=tamano){
    const result=await supabase.from(tabla).select(columnas).order('id').range(offset,offset+tamano-1)
    if(result.error)throw result.error
    const filas=(result.data??[]) as unknown as Record<string,unknown>[]
    datos.push(...filas)
    if(filas.length<tamano)return {datos,limitado:false}
  }
  return {datos,limitado:true}
}

export function PlansOverview({esAdmin=false,initialLoteId,onSelectLote,onConfirmDaily}:{
  esAdmin?:boolean;initialLoteId?:number|null;onSelectLote?:(loteId:number)=>void;
  onConfirmDaily?:(asignacionId:number)=>void
}){
  const [planes,setPlanes]=useState<Plan[]>([])
  const [detalles,setDetalles]=useState<Detail[]>([])
  const [asignaciones,setAsignaciones]=useState<Asignacion[]>([])
  const [productos,setProductos]=useState<Producto[]>([])
  const [unidades,setUnidades]=useState<Unidad[]>([])
  const [lotes,setLotes]=useState<Lote[]>([])
  const [consumos,setConsumos]=useState<Consumo[]>([])
  const [detalleConsumos,setDetalleConsumos]=useState<DetalleConsumo[]>([])
  const [seleccion,setSeleccion]=useState(String(initialLoteId??''))
  const [nuevoPlan,setNuevoPlan]=useState('')
  const [busy,setBusy]=useState(false)
  const [loading,setLoading]=useState(true)
  const [error,setError]=useState('')
  const [aviso,setAviso]=useState('')
  const [limitado,setLimitado]=useState(false)
  const [confirmacion,setConfirmacion]=useState<Confirmacion|null>(null)

  const cargar=useCallback(async()=>{
    if(!supabase){setError('Supabase no está configurado.');setLoading(false);return}
    setLoading(true);setError('')
    try{
      const resultados=await Promise.all([
        supabase.from('plan_consumo').select('id,nombre,descripcion,activo').order('nombre'),
        supabase.from('detalle_plan_consumo').select('id,plan_id,producto_id,cantidad_diaria,unidad_id'),
        supabase.from('asignacion_plan_lote').select('id,plan_id,lote_id,fecha_inicio,fecha_fin,activo,observaciones,componentes').order('id'),
        supabase.from('producto').select('id,nombre'),
        supabase.from('unidad_medida').select('id,nombre,codigo'),
        supabase.from('lote').select('id,codigo,cantidad_actual,cantidad_original,estado').order('codigo'),
        paginar('consumo','id,lote_id,fecha,origen,observaciones'),
        paginar('detalle_consumo','id,consumo_id,producto_id,cantidad,costo_total')
      ])
      for(const result of resultados.slice(0,6)){
        if('error' in result && result.error)throw result.error
      }
      const [p,d,a,pr,u,l]=resultados
      const cs=resultados[6] as Awaited<ReturnType<typeof paginar>>
      const ds=resultados[7] as Awaited<ReturnType<typeof paginar>>
      setPlanes((p as {data:unknown}).data as Plan[]??[])
      setDetalles((d as {data:unknown}).data as Detail[]??[])
      setAsignaciones((a as {data:unknown}).data as Asignacion[]??[])
      setProductos((pr as {data:unknown}).data as Producto[]??[])
      setUnidades((u as {data:unknown}).data as Unidad[]??[])
      const lotesCargados=((l as {data:unknown}).data as Lote[]??[])
      setLotes(lotesCargados)
      setSeleccion(prev=>prev||String(initialLoteId??lotesCargados.find(x=>x.estado==='ACTIVO')?.id??lotesCargados[0]?.id??''))
      setConsumos(cs.datos as Consumo[])
      setDetalleConsumos(ds.datos as DetalleConsumo[])
      setLimitado(cs.limitado||ds.limitado)
    }catch(e){
      setError(e instanceof Error?e.message:'No se pudo consultar el seguimiento alimentario.')
    }finally{setLoading(false)}
  },[initialLoteId])
  useEffect(()=>{void cargar()},[cargar])

  const lote=lotes.find(x=>String(x.id)===seleccion)
  const vigentes=asignaciones.filter(a=>a.activo)
  const vigente=vigentes.find(a=>a.lote_id===lote?.id)
  const asignacionesLote=asignaciones.filter(a=>a.lote_id===lote?.id)
    .sort((a,b)=>b.fecha_inicio.localeCompare(a.fecha_inicio)||b.id-a.id)
  const planNombre=(id:number)=>planes.find(p=>p.id===id)?.nombre??'Plan #'+id
  const productoNombre=(id:number)=>productos.find(p=>p.id===id)?.nombre??'Insumo #'+id
  const unidadNombre=(id:number)=>unidades.find(u=>u.id===id)?.codigo??''
  const resumen=useMemo(()=>calcularSeguimientoLote(Number(seleccion),asignaciones,consumos,detalleConsumos,hoy()),[seleccion,asignaciones,consumos,detalleConsumos])
  const detallesPorConsumo=useMemo(()=>{
    const grupos=new Map<number,DetalleConsumo[]>()
    for(const d of detalleConsumos){const lista=grupos.get(d.consumo_id)??[];lista.push(d);grupos.set(d.consumo_id,lista)}
    return grupos
  },[detalleConsumos])

  function solicitarCambio(){
    if(!lote||!nuevoPlan)return setError('Selecciona un lote y un plan.')
    if(lote.estado!=='ACTIVO')return setError('Solo se pueden asignar planes a lotes activos.')
    if(vigente?.plan_id===Number(nuevoPlan))return setError('El lote ya tiene asignado ese plan.')
    const p=planes.find(x=>x.id===Number(nuevoPlan))
    if(!p?.activo)return setError('Selecciona un plan activo.')
    if(!detalles.some(d=>d.plan_id===p.id))return setError('El plan aún no tiene alimentos definidos.')
    setError('');setAviso('')
    setConfirmacion({kind:'assign',planId:p.id,loteId:lote.id,details:{
      title:vigente?'Cambiar plan del lote':'Asignar plan al lote',
      description:'La modificación se aplica desde hoy. Los consumos ya registrados y sus costos no se borrarán. No se descuenta inventario hasta confirmar la alimentación diaria. Si hoy ya se confirmó el plan anterior, el cambio se deberá hacer mañana.',
      confirmLabel:vigente?'Cambiar plan':'Asignar plan',
      summary:[{label:'Lote',value:lote.codigo},{label:'Plan anterior',value:vigente?planNombre(vigente.plan_id):'Sin plan'},{label:'Nuevo plan',value:p.nombre,emphasis:true}]
    }})
  }
  function solicitarDesasignar(){
    if(!lote||!vigente)return
    setError('');setAviso('')
    setConfirmacion({kind:'unassign',loteId:lote.id,details:{
      title:'Desasignar plan alimentario',
      description:'Se terminará la vigencia del plan desde hoy. La asignación y todos los consumos anteriores permanecerán en el historial. Si ya se registró alimentación hoy, ese día se conserva como ejecutado.',
      confirmLabel:'Confirmar desasignación',danger:true,
      summary:[{label:'Lote',value:lote.codigo},{label:'Plan a finalizar',value:planNombre(vigente.plan_id)}]
    }})
  }
  async function ejecutar(){
    if(!supabase||busy||!confirmacion)return
    setBusy(true);setError('')
    try{
      const cambio=confirmacion
      const rpc=cambio.kind==='assign'
        ?await supabase.rpc('sgic_asignar_plan',{p_lote_id:cambio.loteId,p_plan_id:cambio.planId!,p_inicio:hoy()})
        :await supabase.rpc('sgic_desasignar_plan',{p_lote_id:cambio.loteId,p_fecha:hoy()})
      if(rpc.error)throw rpc.error
      setConfirmacion(null);setNuevoPlan('')
      setAviso(cambio.kind==='assign'?'Asignación actualizada. El historial anterior se conserva.':'Plan desasignado. No se alteró el inventario ni los consumos anteriores.')
      await cargar()
    }catch(e){setConfirmacion(null);setError(e instanceof Error?e.message:'No se pudo guardar el cambio.')}
    finally{setBusy(false)}
  }
  const confirmacionHoy=Boolean(vigente)&&consumos.some(c=>c.lote_id===lote?.id&&c.fecha===hoy()&&c.origen==='PLAN')
  const planActivoLote=vigente?planes.find(p=>p.id===vigente.plan_id):null
  const componentesVigentes=vigente?.componentes??[]
  const totalLotesConPlan=new Set(vigentes.map(a=>a.lote_id)).size
  return <section className="space-y-5">
    <header className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
      <p className="text-xs font-semibold uppercase tracking-widest text-emerald-700">Producción · alimentación</p>
      <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Planes y seguimiento por lote</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">Consulta lo programado frente al consumo registrado, costos acumulados y días pendientes. Un plan asignado no descuenta inventario: se descuenta al confirmar el consumo real.</p>
        </div>
        <button type="button" onClick={()=>void cargar()} disabled={loading||busy} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">Actualizar datos</button>
      </div>
    </header>
    {error&&<div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900">{error}</div>}
    {aviso&&<div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">{aviso}</div>}
    {limitado&&<div role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">El historial supera los 10.000 registros consultados. Los totales pueden ser parciales; consulta el histórico completo antes de tomar decisiones de costos.</div>}
    {loading?<p className="rounded-xl bg-white p-6 text-sm text-slate-600">Calculando seguimiento alimentario…</p>:<>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-4"><p className="text-xs text-slate-500">Planes definidos</p><strong className="mt-2 block text-2xl">{planes.length}</strong></div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4"><p className="text-xs text-slate-500">Lotes con plan vigente</p><strong className="mt-2 block text-2xl">{totalLotesConPlan}</strong></div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4"><p className="text-xs text-slate-500">Lotes sin plan vigente</p><strong className="mt-2 block text-2xl">{lotes.filter(x=>x.estado==='ACTIVO'&&!vigentes.some(a=>a.lote_id===x.id)).length}</strong></div>
      </div>
      <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0 flex-1">
            <label htmlFor="seguimiento-lote" className="mb-2 block text-sm font-semibold">Seguimiento del lote</label>
            <select id="seguimiento-lote" className={control+' max-w-lg'} value={seleccion} onChange={e=>{setSeleccion(e.target.value);onSelectLote?.(Number(e.target.value));setNuevoPlan('');setError('');setAviso('')}}>
              {lotes.length===0&&<option value="">Sin lotes</option>}
              {lotes.map(x=><option key={x.id} value={x.id}>{x.codigo} · {x.cantidad_actual} animales · {x.estado==='ACTIVO'?'Activo':'Cerrado'}</option>)}
            </select>
          </div>
          {vigente&&lote?.estado==='ACTIVO'&&onConfirmDaily&&<button type="button" onClick={()=>onConfirmDaily(vigente.id)} disabled={confirmacionHoy} className="rounded-xl bg-emerald-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800 disabled:cursor-default disabled:bg-slate-400">{confirmacionHoy?'Alimentación de hoy confirmada':'Confirmar alimentación del día'}</button>}
        </div>
        {lote&&<>
          <div className="mb-5 rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Plan vigente</p>
                <p className="mt-1 font-semibold text-slate-900">{planActivoLote?.nombre??'Sin plan asignado'}</p>
                <p className="mt-1 text-xs text-slate-600">{vigente?'Desde '+fecha(vigente.fecha_inicio):'Puedes asignar un plan a este lote para comenzar su seguimiento.'} · {lote.cantidad_actual} animales activos</p>
              </div>
              <span className={'rounded-full px-3 py-1 text-xs font-semibold '+(vigente?'bg-emerald-100 text-emerald-800':'bg-slate-200 text-slate-700')}>{vigente?'Asignado':'Sin asignar'}</span>
            </div>
            {componentesVigentes.length>0&&<div className="mt-3 flex flex-wrap gap-2">{componentesVigentes.map(c=><span key={c.id} className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs">{productoNombre(c.producto_id)}: {cantidad(Number(c.cantidad_diaria))} {unidadNombre(c.unidad_id)}/día</span>)}</div>}
            {lote.cantidad_original!==lote.cantidad_actual&&vigente&&<p className="mt-3 text-xs font-medium text-amber-800">Atención: este lote pasó de {lote.cantidad_original} a {lote.cantidad_actual} animales. La ración está definida para el lote completo y no se recalcula automáticamente; revisa las cantidades al confirmar la alimentación.</p>}
          </div>
          {esAdmin&&lote.estado==='ACTIVO'&&<div className="mb-4 grid gap-3 rounded-xl border border-slate-200 p-4 md:grid-cols-[1fr_auto] md:items-end">
            <div><label htmlFor="nuevo-plan" className="mb-2 block text-sm font-semibold">{vigente?'Cambiar a otro plan':'Asignar plan'}</label>
              <select id="nuevo-plan" value={nuevoPlan} onChange={e=>setNuevoPlan(e.target.value)} className={control}>
                <option value="">Seleccionar plan</option>
                {planes.filter(p=>p.activo&&p.id!==vigente?.plan_id).map(p=><option value={p.id} key={p.id}>{p.nombre}</option>)}
              </select>
              <p className="mt-2 text-xs text-slate-500">Aplicación desde hoy. El plan anterior queda en el historial; no se altera el stock.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={solicitarCambio} disabled={!nuevoPlan||busy} className="rounded-xl bg-emerald-900 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{vigente?'Cambiar plan':'Asignar plan'}</button>
              {vigente&&<button type="button" onClick={solicitarDesasignar} disabled={busy} className="rounded-xl border border-rose-300 px-4 py-2.5 text-sm font-semibold text-rose-800 hover:bg-rose-50">Desasignar</button>}
            </div>
          </div>}
        </>}
      </div>
      {lote&&<div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ['Días con plan',resumen.diasProgramados,'Desde las fechas de asignación'],
            ['Días registrados',resumen.diasRegistrados,String(resumen.diasConfirmadosPlan)+' desde plan; '+String(resumen.diasConRegistroManual)+' con registro manual'],
            ['Días sin registro',resumen.diasSinRegistro,'No implica que no se alimentó'],
            ['Costo registrado',clp(resumen.costoTotal),'Alimentación imputada al lote']
          ].map(([label,value,nota])=><div key={label} className="rounded-2xl border border-slate-200 bg-white p-4">
            <p className="text-xs font-medium text-slate-500">{label}</p>
            <p className="mt-2 text-2xl font-semibold tabular-nums">{value}</p>
            <p className="mt-1 text-xs leading-5 text-slate-500">{nota}</p>
          </div>)}
        </div>
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <div className="border-b border-slate-100 p-5"><h3 className="font-semibold">Consumo acumulado por producto</h3>
            <p className="mt-1 text-xs leading-5 text-slate-500">Planificado: cantidades diarias congeladas en cada asignación × días de vigencia. Real durante plan: consumos registrados en esas fechas. Total real: incluye consumos fuera de un plan. Los valores no representan necesariamente alimento ingerido individualmente.</p>
          </div>
          {resumen.productos.length===0?<p className="p-5 text-sm text-slate-500">Aún no hay cantidades programadas ni consumos registrados.</p>:
            <TableScroll><table className="min-w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr>{['Insumo','Planificado','Registrado durante plan','Total registrado','Costo registrado'].map(c=><th className="whitespace-nowrap p-3" key={c}>{c}</th>)}</tr></thead>
              <tbody className="divide-y divide-slate-100">{resumen.productos.map(p=>{
                const unidad=unidades.find(u=>asignaciones.flatMap(a=>a.componentes??[]).some(c=>c.producto_id===p.productoId&&c.unidad_id===u.id))?.codigo??''
                return <tr key={p.productoId}><td className="p-3 font-semibold">{productoNombre(p.productoId)}</td>
                  <td className="whitespace-nowrap p-3 tabular-nums">{cantidad(p.planificado)} {unidad}</td>
                  <td className="whitespace-nowrap p-3 tabular-nums">{cantidad(p.realDurantePlan)} {unidad}</td>
                  <td className="whitespace-nowrap p-3 tabular-nums">{cantidad(p.realTotal)} {unidad}</td>
                  <td className="whitespace-nowrap p-3 tabular-nums">{clp(p.costoTotal)}</td></tr>
              })}</tbody>
            </table></TableScroll>}
          {resumen.diasSinPlanConConsumo>0&&<p className="px-5 pb-4 text-xs text-amber-800">Hay registros de alimentación en {resumen.diasSinPlanConConsumo} día(s) sin un plan vigente. Están incluidos en el total real, pero no en el comparativo durante plan.</p>}
        </section>
        <div className="grid gap-4 lg:grid-cols-2">
          <section className="rounded-2xl border border-slate-200 bg-white p-5">
            <h3 className="font-semibold">Calendario de seguimiento</h3>
            <p className="mb-4 mt-1 text-xs text-slate-500">Últimos 21 días planificados hasta hoy; no incluye fechas futuras.</p>
            {resumen.diasRecientes.length===0?<p className="text-sm text-slate-500">Sin días programados hasta la fecha.</p>:
              <div className="max-h-80 space-y-2 overflow-y-auto">{resumen.diasRecientes.map(d=><div key={d.fecha} className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2.5 text-sm">
                <span>{fecha(d.fecha)}</span>
                <span className={'text-xs font-semibold '+(d.confirmadoPlan?'text-emerald-800':d.registrado?'text-sky-800':'text-amber-800')}>
                  {d.confirmadoPlan?'Plan confirmado'+(d.registros>1?' · otros registros':''):d.registrado?'Registro manual':'Sin registro'}
                </span>
              </div>)}</div>}
          </section>
          <section className="rounded-2xl border border-slate-200 bg-white p-5">
            <h3 className="font-semibold">Historial de asignaciones</h3>
            <p className="mb-4 mt-1 text-xs text-slate-500">Los cambios no eliminan la composición ni el historial de consumos.</p>
            {asignacionesLote.length===0?<p className="text-sm text-slate-500">Este lote aún no tiene planes asignados.</p>:
              <div className="max-h-80 space-y-2 overflow-y-auto">{asignacionesLote.map(a=><div key={a.id} className="rounded-xl border border-slate-200 p-3 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <strong>{planNombre(a.plan_id)}</strong>
                  <span className={'text-xs font-semibold '+(a.activo?'text-emerald-800':'text-slate-500')}>{a.activo?'Vigente':'Finalizado'}</span>
                </div>
                <p className="mt-1 text-xs text-slate-500">{fecha(a.fecha_inicio)}{a.fecha_fin?' hasta '+fecha(a.fecha_fin):' en adelante'}</p>
                {a.observaciones?.includes('SGIC_SIN_EJECUCION')&&<p className="mt-1 text-xs text-amber-800">Reemplazado o desasignado el mismo día, sin ejecución</p>}
                <p className="mt-2 text-xs text-slate-600">{(a.componentes??[]).map(c=>productoNombre(c.producto_id)+' '+cantidad(Number(c.cantidad_diaria))+' '+unidadNombre(c.unidad_id)+'/día').join(' · ')||'Sin ingredientes registrados'}</p>
              </div>)}</div>}
          </section>
        </div>
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <div className="border-b border-slate-100 p-5"><h3 className="font-semibold">Últimos consumos registrados</h3>
            <p className="mt-1 text-xs text-slate-500">Movimientos reales que descuentan inventario y acumulan costos para el lote.</p>
          </div>
          {resumen.ultimosRegistros.length===0?<p className="p-5 text-sm text-slate-500">Aún no hay consumos registrados para este lote.</p>:
            <TableScroll><table className="min-w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="p-3">Fecha</th><th className="p-3">Tipo</th><th className="p-3">Detalle</th><th className="p-3 text-right">Costo</th></tr></thead>
              <tbody className="divide-y divide-slate-100">{resumen.ultimosRegistros.map(c=>{
                const lineas=detallesPorConsumo.get(c.id)??[]
                return <tr key={c.id}>
                  <td className="whitespace-nowrap p-3">{fecha(c.fecha)}</td>
                  <td className="p-3">{c.origen==='PLAN'?'Desde plan':'Manual'}</td>
                  <td className="p-3">{lineas.map(d=>productoNombre(d.producto_id)+' '+cantidad(Number(d.cantidad))).join(' · ')||'Sin detalles'}</td>
                  <td className="whitespace-nowrap p-3 text-right">{clp(lineas.reduce((s,d)=>s+Number(d.costo_total),0))}</td>
                </tr>
              })}</tbody>
            </table></TableScroll>}
        </section>
      </div>}
      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <h3 className="font-semibold">Planes disponibles</h3>
        <p className="mt-1 text-xs text-slate-500">Composición nominal de los planes maestros. Cada nueva asignación conserva su propia versión de cantidades.</p>
        {planes.length===0?<p className="mt-4 text-sm text-slate-500">No existen planes. Crea uno desde «Crear nuevo registro» y agrega sus alimentos.</p>:
          <div className="mt-4 grid gap-3 md:grid-cols-2">{planes.map(p=><details key={p.id} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <summary className="cursor-pointer text-sm font-semibold">{p.nombre} <span className="ml-2 text-xs font-normal text-slate-500">{p.activo?'Activo':'Inactivo'}</span></summary>
            <p className="mt-2 text-xs text-slate-600">{p.descripcion??'Sin descripción'}</p>
            <div className="mt-3 space-y-1 text-xs text-slate-700">{detalles.filter(d=>d.plan_id===p.id).map(d=><p key={d.id}>{productoNombre(d.producto_id)} · {cantidad(Number(d.cantidad_diaria))} {unidadNombre(d.unidad_id)}/día</p>)}</div>
          </details>)}</div>}
      </section>
    </>}
    <OperationConfirmDialog details={confirmacion?.details??null} onCancel={()=>setConfirmacion(null)} onConfirm={()=>void ejecutar()} busy={busy}/>
  </section>
}
