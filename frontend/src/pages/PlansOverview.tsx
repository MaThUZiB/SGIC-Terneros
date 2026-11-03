import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../api/supabase'
import { OperationConfirmDialog, type ConfirmDetails } from '../components/OperationConfirmDialog'
import { TableScroll } from '../components/TableScroll'
import { PlanCatalog } from './PlanCatalog'
import {
  calcularSeguimientoLote,
  type Asignacion, type ComponentePlan, type Consumo, type DetalleConsumo, type EventoAutomatico
} from '../utils/feedingTracking'

type Plan = { id:number; nombre:string; descripcion:string|null; activo:boolean; modo_racion:'LOTE'|'ANIMAL' }
type Detail = ComponentePlan & {plan_id:number}
type Producto = { id:number; nombre:string }
type Unidad = { id:number; nombre:string; codigo:string }
type Lote = { id:number; codigo:string; cantidad_actual:number; cantidad_original:number; estado:string }
type Confirmacion = { kind:'assign'|'unassign'|'manage'; details:ConfirmDetails; planId?:number; loteId:number; accion?:'ELIMINAR'|'ARCHIVAR'|'REACTIVAR' }
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

export function PlansOverview({esAdmin=false,initialLoteId,onSelectLote,onCreatePlan,onAddFood,onViewTracking}:{
  esAdmin?:boolean;initialLoteId?:number|null;onSelectLote?:(loteId:number)=>void;
  onCreatePlan?:()=>void;onAddFood?:()=>void;onViewTracking?:()=>void
}){
  const [planes,setPlanes]=useState<Plan[]>([])
  const [detalles,setDetalles]=useState<Detail[]>([])
  const [asignaciones,setAsignaciones]=useState<Asignacion[]>([])
  const [productos,setProductos]=useState<Producto[]>([])
  const [unidades,setUnidades]=useState<Unidad[]>([])
  const [lotes,setLotes]=useState<Lote[]>([])
  const [consumos,setConsumos]=useState<Consumo[]>([])
  const [detalleConsumos,setDetalleConsumos]=useState<DetalleConsumo[]>([])
  const [eventos,setEventos]=useState<EventoAutomatico[]>([])
  const [seleccion,setSeleccion]=useState(String(initialLoteId??''))
  const [vista,setVista]=useState<'planes'|'lotes'>(initialLoteId?'lotes':'planes')
  const [busy,setBusy]=useState(false)
  const [loading,setLoading]=useState(true)
  const [error,setError]=useState('')
  const [advertencia,setAdvertencia]=useState('')
  const [aviso,setAviso]=useState('')
  const [limitado,setLimitado]=useState(false)
  const [confirmacion,setConfirmacion]=useState<Confirmacion|null>(null)

  const cargar=useCallback(async()=>{
    if(!supabase){setError('Supabase no está configurado.');setLoading(false);return}
    setLoading(true);setError('');setAdvertencia('')
    try{
      // El catálogo maestro no debe depender del historial de consumo ni de otras tablas.
      const planesResult=await supabase.from('plan_consumo')
        .select('id,nombre,descripcion,activo,modo_racion').order('nombre')
      if(planesResult.error)throw Error('No se pudieron consultar los planes: '+planesResult.error.message)
      setPlanes((planesResult.data??[]) as Plan[])

      const otros=await Promise.allSettled([
        supabase.from('detalle_plan_consumo').select('id,plan_id,producto_id,cantidad_diaria,unidad_id'),
        supabase.from('asignacion_plan_lote').select('id,plan_id,lote_id,fecha_inicio,fecha_fin,activo,observaciones,componentes,modo_racion').order('id'),
        supabase.from('producto').select('id,nombre'),
        supabase.from('unidad_medida').select('id,nombre,codigo'),
        supabase.from('lote').select('id,codigo,cantidad_actual,cantidad_original,estado').order('codigo'),
        paginar('consumo','id,lote_id,fecha,origen,observaciones'),
        paginar('detalle_consumo','id,consumo_id,producto_id,cantidad,costo_total'),
        supabase.from('sgic_alimentacion_auto_evento').select('id,lote_id,asignacion_id,fecha,estado,animales,detalle').order('fecha',{ascending:false}).limit(1000)
      ])
      const fallas:string[]=[]
      function resultado<T>(indice:number,nombre:string):T[]{
        const r=otros[indice]
        if(r.status==='rejected'){
          fallas.push(nombre);return []
        }
        const v=r.value as unknown as {data:T[]|null;error?:{message:string}|null}
        if(v.error){fallas.push(nombre+': '+v.error.message);return []}
        return v.data??[]
      }
      function historial(indice:number,nombre:string):Awaited<ReturnType<typeof paginar>>{
        const r=otros[indice]
        if(r.status==='rejected'){fallas.push(nombre);return {datos:[],limitado:false}}
        return r.value as Awaited<ReturnType<typeof paginar>>
      }
      setDetalles(resultado<Detail>(0,'Composición de planes'))
      setAsignaciones(resultado<Asignacion>(1,'Asignaciones de planes'))
      setProductos(resultado<Producto>(2,'Productos'))
      setUnidades(resultado<Unidad>(3,'Unidades'))
      const lotesCargados=resultado<Lote>(4,'Lotes')
      setLotes(lotesCargados)
      setSeleccion(prev=>prev||String(initialLoteId??lotesCargados.find(x=>x.estado==='ACTIVO')?.id??lotesCargados[0]?.id??''))
      const cs=historial(5,'Historial de consumo')
      const ds=historial(6,'Detalle de consumos')
      setConsumos(cs.datos as Consumo[])
      setDetalleConsumos(ds.datos as DetalleConsumo[])
      setLimitado(cs.limitado||ds.limitado)
      setEventos(resultado<EventoAutomatico>(7,'Bitácora automática'))
      if(fallas.length)setAdvertencia('Los planes se cargaron, pero faltan datos complementarios: '+fallas.join(' · ')+'.')
    }catch(e){
      setError(e instanceof Error?e.message:'No se pudo consultar el catálogo alimentario.')
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
  const resumen=useMemo(()=>calcularSeguimientoLote(Number(seleccion),asignaciones,consumos,detalleConsumos,hoy(),eventos,lote?.cantidad_actual??0),[seleccion,asignaciones,consumos,detalleConsumos,eventos,lote?.cantidad_actual])
  const detallesPorConsumo=useMemo(()=>{
    const grupos=new Map<number,DetalleConsumo[]>()
    for(const d of detalleConsumos){const lista=grupos.get(d.consumo_id)??[];lista.push(d);grupos.set(d.consumo_id,lista)}
    return grupos
  },[detalleConsumos])

  function solicitarCambio(loteId:number,planId:number){
    const objetivo=lotes.find(l=>l.id===loteId)
    const actual=vigentes.find(a=>a.lote_id===loteId)
    if(!objetivo||!planId)return setError('Selecciona un lote y un plan.')
    if(objetivo.estado!=='ACTIVO')return setError('Solo se pueden asignar planes a lotes activos.')
    if(actual?.plan_id===planId)return setError('El lote ya tiene asignado ese plan.')
    const p=planes.find(x=>x.id===planId)
    if(!p?.activo)return setError('Selecciona un plan activo.')
    if(!detalles.some(d=>d.plan_id===p.id))return setError('El plan aún no tiene alimentos definidos.')
    setError('');setAviso('')
    setConfirmacion({kind:'assign',planId:p.id,loteId:objetivo.id,details:{
      title:actual?'Cambiar plan del lote':'Asignar plan al lote',
      description:'La modificación se aplica desde hoy. Los consumos ya registrados y sus costos no se borrarán. El inventario se descuenta automáticamente al cierre del día. Si ya se registró el plan anterior hoy, el cambio se deberá hacer mañana.',
      confirmLabel:actual?'Cambiar plan':'Asignar plan',
      summary:[{label:'Lote',value:objetivo.codigo},{label:'Plan anterior',value:actual?planNombre(actual.plan_id):'Sin plan'},{label:'Nuevo plan',value:p.nombre,emphasis:true}]
    }})
  }
  function solicitarDesasignar(loteId:number){
    const objetivo=lotes.find(l=>l.id===loteId)
    const asignacion=vigentes.find(a=>a.lote_id===loteId)
    if(!objetivo||!asignacion)return
    setError('');setAviso('')
    setConfirmacion({kind:'unassign',loteId:objetivo.id,details:{
      title:'Desasignar plan alimentario',
      description:'Se terminará la vigencia del plan desde hoy. La asignación y todos los consumos anteriores permanecerán en el historial. Si ya se registró alimentación hoy, ese día se conserva como ejecutado.',
      confirmLabel:'Confirmar desasignación',danger:true,
      summary:[{label:'Lote',value:objetivo.codigo},{label:'Plan a finalizar',value:planNombre(asignacion.plan_id)}]
    }})
  }
  function solicitarGestionPlan(p:Plan,accion:'ELIMINAR'|'ARCHIVAR'|'REACTIVAR'){
    const asignados=asignaciones.filter(a=>a.plan_id===p.id)
    const activos=asignados.filter(a=>a.activo)
    if(accion==='ELIMINAR'&&asignados.length)return setError('Este plan tiene historial de asignaciones. Solo puede archivarse.')
    if(accion==='ARCHIVAR'&&activos.length)return setError('Primero cambia o desasigna el plan de los lotes que lo utilizan.')
    setError('');setAviso('')
    setConfirmacion({kind:'manage',loteId:0,planId:p.id,accion,details:{
      title:accion==='ELIMINAR'?'Eliminar plan definitivamente':accion==='ARCHIVAR'?'Archivar plan':'Reactivar plan',
      description:accion==='ELIMINAR'
        ?'Se borrará el plan del catálogo y sus ingredientes. Esta acción no se puede deshacer y solo está permitida si nunca se asignó a un lote.'
        :accion==='ARCHIVAR'
        ?'El plan dejará de aparecer como opción para nuevas asignaciones. Conservarás su historial y los consumos de los lotes.'
        :'El plan volverá a estar disponible para nuevas asignaciones. No cambia ninguna asignación existente.',
      confirmLabel:accion==='ELIMINAR'?'Eliminar definitivamente':accion==='ARCHIVAR'?'Archivar plan':'Reactivar plan',
      danger:accion==='ELIMINAR',
      summary:[{label:'Plan',value:p.nombre},{label:'Asignaciones históricas',value:String(asignados.length)}]
    }})
  }
  async function ejecutar(){
    if(!supabase||busy||!confirmacion)return
    setBusy(true);setError('')
    try{
      const cambio=confirmacion
      const rpc=cambio.kind==='assign'
        ?await supabase.rpc('sgic_asignar_plan',{p_lote_id:cambio.loteId,p_plan_id:cambio.planId!,p_inicio:hoy()})
        :cambio.kind==='unassign'
        ?await supabase.rpc('sgic_desasignar_plan',{p_lote_id:cambio.loteId,p_fecha:hoy()})
        :await supabase.rpc('sgic_gestionar_plan',{p_plan_id:cambio.planId!,p_accion:cambio.accion!})
      if(rpc.error)throw rpc.error
      setConfirmacion(null)
      setAviso(cambio.kind==='assign'?'Asignación actualizada. El historial anterior se conserva.':cambio.kind==='unassign'?'Plan desasignado. No se alteró el inventario ni los consumos anteriores.':cambio.accion==='ELIMINAR'?'Plan eliminado.':cambio.accion==='ARCHIVAR'?'Plan archivado.':'Plan reactivado.')
      await cargar()
    }catch(e){setConfirmacion(null);setError(e instanceof Error?e.message:'No se pudo guardar el cambio.')}
    finally{setBusy(false)}
  }
  const erroresAutomaticos=eventos.filter(e=>e.estado==='ERROR')
  const eventosLote=eventos.filter(e=>e.lote_id===lote?.id)
  const planActivoLote=vigente?planes.find(p=>p.id===vigente.plan_id):null
  const componentesVigentes=vigente?.componentes??[]
  const totalLotesConPlan=new Set(vigentes.map(a=>a.lote_id)).size
  return <section className="space-y-5">
    <header className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3">
      <div><h2 className="text-lg font-semibold">Alimentación</h2>
        <p className="text-xs text-slate-500">{vista==='planes'?'Planes y asignaciones':'Consulta del consumo por lote'}</p></div>
      <button type="button" onClick={()=>void cargar()} disabled={loading||busy} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50">Actualizar</button>
    </header>
    {error&&<div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900">{error}</div>}
    {advertencia&&<div role="alert" className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">{advertencia}</div>}
    {aviso&&<div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">{aviso}</div>}
    {erroresAutomaticos.length>0&&<div role="alert" className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
      <strong>{erroresAutomaticos.length} jornadas pendientes · Revisar inventario</strong>
      <details className="mt-2"><summary className="cursor-pointer text-xs font-medium">Ver causas</summary>
        <div className="mt-2 space-y-1">{erroresAutomaticos.slice(0,10).map(e=><p key={e.id} className="text-xs">{lotes.find(l=>l.id===e.lote_id)?.codigo??'Lote #'+e.lote_id} · {fecha(e.fecha)} · {e.detalle}</p>)}</div>
      </details>
    </div>}
    {limitado&&<div role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">El historial supera los 10.000 registros consultados. Los totales pueden ser parciales; consulta el histórico completo antes de tomar decisiones de costos.</div>}
    {loading?<p className="rounded-xl bg-white p-6 text-sm text-slate-600">Calculando seguimiento alimentario…</p>:<>
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm">
        <span><strong className="tabular-nums">{planes.length}</strong> planes</span>
        <span><strong className="tabular-nums">{totalLotesConPlan}</strong> lotes con plan</span>
        <span className="text-slate-500">{lotes.filter(x=>x.estado==='ACTIVO'&&!vigentes.some(a=>a.lote_id===x.id)).length} lotes sin plan</span>
      </div>
      <nav aria-label="Vistas de alimentación" className="flex flex-wrap gap-2 border-b border-slate-200 pb-3">
        <button type="button" aria-pressed={vista==='planes'} onClick={()=>setVista('planes')}
          className={'rounded-xl px-4 py-2.5 text-sm font-semibold '+(vista==='planes'?'bg-emerald-900 text-white':'border border-slate-200 bg-white text-slate-700')}>Gestión de planes</button>
        <button type="button" aria-pressed={vista==='lotes'} onClick={()=>{onViewTracking?.();setVista('lotes')}}
          className={'rounded-xl px-4 py-2.5 text-sm font-semibold '+(vista==='lotes'?'bg-emerald-900 text-white':'border border-slate-200 bg-white text-slate-700')}>Seguimiento por lote</button>
      </nav>
      {vista==='lotes'&&<>
      <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
          <div className="min-w-0 flex-1">
            <label htmlFor="seguimiento-lote" className="mb-1 block text-xs font-semibold text-slate-600">Lote</label>
            <select id="seguimiento-lote" className={control+' max-w-lg'} value={seleccion} onChange={e=>{setSeleccion(e.target.value);onSelectLote?.(Number(e.target.value));setError('');setAviso('')}}>
              {lotes.length===0&&<option value="">Sin lotes</option>}
              {lotes.map(x=><option key={x.id} value={x.id}>{x.codigo} · {x.cantidad_actual} animales · {x.estado==='ACTIVO'?'Activo':'Cerrado'}</option>)}
            </select>
          </div>
          {vigente&&<span className="text-xs font-medium text-emerald-800">Consumo automático</span>}
        </div>
        {lote&&<>
          <div className="mb-5 rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Plan vigente</p>
                <p className="mt-1 font-semibold text-slate-900">{planActivoLote?.nombre??'Sin plan asignado'}</p>
                <p className="mt-1 text-xs text-slate-600">{vigente?'Desde '+fecha(vigente.fecha_inicio):'Sin plan vigente'} · {lote.cantidad_actual} animales</p>
              </div>
              <span className={'rounded-full px-3 py-1 text-xs font-semibold '+(vigente?'bg-emerald-100 text-emerald-800':'bg-slate-200 text-slate-700')}>{vigente?'Asignado':'Sin asignar'}</span>
            </div>
            {componentesVigentes.length>0&&<div className="mt-3 flex flex-wrap gap-2">{componentesVigentes.map(c=><span key={c.id} className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs">{productoNombre(c.producto_id)} · {cantidad(Number(c.cantidad_diaria)*(vigente?.modo_racion==='ANIMAL'?(lote?.cantidad_actual??0):1))} {unidadNombre(c.unidad_id)}/día</span>)}</div>}
            {lote.cantidad_original!==lote.cantidad_actual&&vigente?.modo_racion==='LOTE'&&<p className="mt-2 text-xs text-amber-800">Ración fija: el número de animales ha cambiado; revisa este plan en Gestión.</p>}
          </div>
        </>}
      </div>
      {lote&&<div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ['Días con plan',resumen.diasProgramados],
            ['Días registrados',resumen.diasRegistrados],
            ['Pendientes',resumen.diasSinRegistro],
            ['Costo acumulado',clp(resumen.costoTotal)]
          ].map(([label,value])=><div key={label} className="rounded-xl border border-slate-200 bg-white px-4 py-3">
            <p className="text-xs text-slate-500">{label}</p>
            <p className="mt-1 text-xl font-semibold tabular-nums">{value}</p>
          </div>)}
        </div>
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
            <h3 className="font-semibold">Consumo por producto</h3>
            <details className="text-xs text-slate-500"><summary className="cursor-pointer">Cómo se calcula</summary>
              <p className="mt-2 max-w-lg">Planificado: ración × días (y animales, si corresponde). Registrado: movimiento imputado al lote. No equivale a ingesta medida.</p>
            </details>
          </div>
          {resumen.productos.length===0?<p className="p-5 text-sm text-slate-500">Aún no hay cantidades programadas ni consumos registrados.</p>:
            <TableScroll><table className="min-w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr>{['Insumo','Previsto','Durante plan','Total','Costo'].map(c=><th className="whitespace-nowrap p-3" key={c}>{c}</th>)}</tr></thead>
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
        <div className="grid gap-3 lg:grid-cols-2">
          <details className="rounded-xl border border-slate-200 bg-white p-4">
            <summary className="cursor-pointer font-semibold">Calendario · últimas 21 jornadas</summary>
            {resumen.diasRecientes.length===0?<p className="text-sm text-slate-500">Sin días programados hasta la fecha.</p>:
              <div className="max-h-80 space-y-2 overflow-y-auto">{resumen.diasRecientes.map(d=><div key={d.fecha} className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2.5 text-sm">
                <span>{fecha(d.fecha)}</span>
                <span className={'text-xs font-semibold '+(d.confirmadoPlan?'text-emerald-800':d.registrado?'text-sky-800':'text-amber-800')}>
                  {d.confirmadoPlan?'Plan registrado'+(d.registros>1?' · otros registros':''):d.registrado?'Registro manual':'Pendiente de cierre automático'}
                </span>
              </div>)}</div>}
          </details>
          <details className="rounded-xl border border-slate-200 bg-white p-4">
            <summary className="cursor-pointer font-semibold">Historial de planes · {asignacionesLote.length}</summary>
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
          </details>
        </div>
        <details className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <summary className="cursor-pointer px-4 py-3 font-semibold">Movimientos de alimentación · {resumen.ultimosRegistros.length}</summary>
          {resumen.ultimosRegistros.length===0?<p className="p-5 text-sm text-slate-500">Aún no hay consumos registrados para este lote.</p>:
            <TableScroll><table className="min-w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="p-3">Fecha</th><th className="p-3">Tipo</th><th className="p-3">Detalle</th><th className="p-3 text-right">Costo</th></tr></thead>
              <tbody className="divide-y divide-slate-100">{resumen.ultimosRegistros.map(c=>{
                const lineas=detallesPorConsumo.get(c.id)??[]
                return <tr key={c.id}>
                  <td className="whitespace-nowrap p-3">{fecha(c.fecha)}</td>
                  <td className="p-3">{c.origen==='PLAN'?(c.observaciones?.startsWith('AUTO_PLAN_')?'Automático (estimado)':'Desde plan (histórico)'):'Manual'}</td>
                  <td className="p-3">{lineas.map(d=>productoNombre(d.producto_id)+' '+cantidad(Number(d.cantidad))).join(' · ')||'Sin detalles'}</td>
                  <td className="whitespace-nowrap p-3 text-right">{clp(lineas.reduce((s,d)=>s+Number(d.costo_total),0))}</td>
                </tr>
              })}</tbody>
            </table></TableScroll>}
        </details>
      </div>}
      {lote&&eventosLote.length>0&&<details className="rounded-xl border border-slate-200 bg-white p-4">
        <summary className="cursor-pointer font-semibold">Ejecuciones automáticas · {eventosLote.length}</summary>
        <div className="mt-3 max-h-48 space-y-2 overflow-auto">{eventosLote.slice(0,15).map(e=><div key={e.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2 text-xs">
          <span>{fecha(e.fecha)} · {e.animales} animales</span>
          <span className={e.estado==='APLICADO'?'text-emerald-800':'text-amber-800'}>{e.estado==='APLICADO'?'Inventario descontado':e.estado==='ERROR'?'Pendiente: '+e.detalle:'Registro manual previo'}</span>
        </div>)}</div>
      </details>}
      </>}
      {vista==='planes'&&<PlanCatalog planes={planes} detalles={detalles} asignaciones={asignaciones} lotes={lotes}
        productos={productos} unidades={unidades} esAdmin={esAdmin} busy={busy}
        onAssign={(loteId,planId)=>solicitarCambio(loteId,planId)}
        onUnassign={solicitarDesasignar}
        onCreatePlan={()=>onCreatePlan?.()}
        onAddFood={()=>onAddFood?.()}
        onManage={solicitarGestionPlan}
        onModeChange={async(planId,modo)=>{if(!supabase)return;setBusy(true);setError('');try{const result=await supabase.rpc('sgic_configurar_modo_plan',{p_plan_id:planId,p_modo:modo});if(result.error)throw result.error;setAviso('Modalidad de cálculo actualizada.');await cargar()}catch(e){setError(e instanceof Error?e.message:'No se pudo modificar el plan')}finally{setBusy(false)}}}
        onOpenLote={loteId=>{setSeleccion(String(loteId));onSelectLote?.(loteId);onViewTracking?.();setVista('lotes')}}/>}
    </>}
    <OperationConfirmDialog details={confirmacion?.details??null} onCancel={()=>setConfirmacion(null)} onConfirm={()=>void ejecutar()} busy={busy}/>
  </section>
}
