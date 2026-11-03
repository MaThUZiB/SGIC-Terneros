import { useState } from 'react'
import type { Asignacion, ComponentePlan } from '../utils/feedingTracking'

type Plan = { id:number; nombre:string; descripcion:string|null; activo:boolean; modo_racion:'LOTE'|'ANIMAL' }
type Detalle = ComponentePlan & {plan_id:number}
type Lote = { id:number; codigo:string; cantidad_actual:number; estado:string }
type Producto = {id:number;nombre:string}
type Unidad = {id:number;codigo:string}
type Props = {
  planes:Plan[]; detalles:Detalle[]; asignaciones:Asignacion[]; lotes:Lote[];
  productos:Producto[]; unidades:Unidad[]; esAdmin:boolean; busy:boolean;
  onAssign:(loteId:number,planId:number)=>void
  onManage:(plan:Plan,accion:'ELIMINAR'|'ARCHIVAR'|'REACTIVAR')=>void
  onOpenLote:(loteId:number)=>void
  onModeChange:(planId:number,modo:'LOTE'|'ANIMAL')=>void
}
const formato=(n:number)=>new Intl.NumberFormat('es-CL',{maximumFractionDigits:3}).format(n)
const fecha=(s:string)=>s.split('-').reverse().join('-')
const control='w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-emerald-700'
const normalizar=(valor:string)=>valor.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('es').trim()

/** Catálogo y asignaciones: cada plan es independiente de su seguimiento por lote. */
export function PlanCatalog({planes,detalles,asignaciones,lotes,productos,unidades,esAdmin,busy,onAssign,onManage,onOpenLote,onModeChange}:Props){
  const [busqueda,setBusqueda]=useState('')
  const [filtro,setFiltro]=useState<'TODOS'|'ACTIVOS'|'ARCHIVADOS'>('TODOS')
  const [seleccion,setSeleccion]=useState<number|null>(null)
  const [destino,setDestino]=useState('')
  const consulta=normalizar(busqueda)
  const visibles=planes.filter(p=>
    (filtro==='TODOS'||(filtro==='ACTIVOS'?p.activo:!p.activo))&&
    normalizar(p.nombre+' '+(p.descripcion??'')).includes(consulta)
  )
  const actual=visibles.find(p=>p.id===seleccion)??visibles[0]??null
  const componentes=actual?detalles.filter(d=>d.plan_id===actual.id):[]
  const asignacionesPlan=actual?asignaciones.filter(a=>a.plan_id===actual.id):[]
  const vigentes=asignacionesPlan.filter(a=>a.activo)
  const ocupados=new Set(asignaciones.filter(a=>a.activo).map(a=>a.lote_id))
  const producto=(id:number)=>productos.find(p=>p.id===id)?.nombre??'Insumo #'+id
  const unidad=(id:number)=>unidades.find(u=>u.id===id)?.codigo??''
  return <section className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
    <div className="min-w-0 rounded-2xl border border-slate-200 bg-white p-5">
      <h3 className="text-lg font-semibold">Catálogo de planes</h3>
      <p className="mt-1 text-sm text-slate-600">Hay <strong className="tabular-nums">{planes.length} planes registrados</strong>. Selecciona uno para ver sus alimentos, lotes e historial.</p>
      <label htmlFor="buscar-plan" className="sr-only">Buscar planes</label>
      <input id="buscar-plan" type="search" value={busqueda} onChange={e=>setBusqueda(e.target.value)} className={control+' mt-4'} placeholder="Buscar plan por nombre o descripción"/>
      <div className="mt-3 flex flex-wrap gap-2">{([['TODOS','Todos'],['ACTIVOS','Activos'],['ARCHIVADOS','Archivados']] as const).map(([id,label])=>
        <button type="button" key={id} aria-pressed={filtro===id} onClick={()=>{setFiltro(id);setSeleccion(null);setDestino('')}} className={'rounded-lg px-3 py-2 text-xs font-semibold '+(filtro===id?'bg-slate-900 text-white':'border border-slate-200 text-slate-700')}>{label}</button>
      )}</div>
      <p className="mt-3 text-xs text-slate-500" role="status">{visibles.length} de {planes.length} planes visibles.</p>
      {visibles.length===0?<div className="mt-4 space-y-3 text-sm text-slate-500">
        <p>{planes.length===0?'No hay planes disponibles para esta cuenta.':consulta?'No hay planes que coincidan con la búsqueda.':'No hay planes con el estado seleccionado.'}</p>
        {(consulta||filtro!=='TODOS')&&<button type="button" className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-800" onClick={()=>{setBusqueda('');setFiltro('TODOS');setSeleccion(null)}}>Limpiar búsqueda y filtros</button>}
      </div>:
      <div className="mt-4 max-h-[680px] space-y-2 overflow-y-auto pr-1">
        {visibles.map(p=>{
          const asignadas=asignaciones.filter(a=>a.plan_id===p.id)
          const actuales=asignadas.filter(a=>a.activo)
          return <button type="button" key={p.id} aria-current={actual?.id===p.id?'true':undefined} onClick={()=>{setSeleccion(p.id);setDestino('')}}
            className={'w-full rounded-xl border p-4 text-left '+(actual?.id===p.id?'border-emerald-600 bg-emerald-50':'border-slate-200 hover:border-emerald-300')}>
            <span className="flex flex-wrap items-center justify-between gap-2"><strong className="min-w-0 break-words text-sm">{p.nombre}</strong>
              <span className={'rounded-full px-2 py-1 text-xs '+(p.activo?'bg-emerald-100 text-emerald-800':'bg-slate-200 text-slate-700')}>{p.activo?'Activo':'Archivado'}</span></span>
            <span className="mt-2 block text-xs text-slate-600">{detalles.filter(d=>d.plan_id===p.id).length} alimentos · {actuales.length} lotes vigentes · {asignadas.length} asignaciones históricas · {p.modo_racion==='ANIMAL'?'Por ternero':'Por lote'}</span>
            {actuales.length>0&&<span className="mt-2 block break-words text-xs text-emerald-800">{actuales.map(a=>lotes.find(l=>l.id===a.lote_id)?.codigo??'Lote #'+a.lote_id).join(' · ')}</span>}
          </button>
        })}
      </div>}
    </div>
    <div className="min-w-0 space-y-5 rounded-2xl border border-slate-200 bg-white p-5">
      {!actual?<p className="text-sm text-slate-500">Selecciona un plan para ver su gestión.</p>:<>
        <header><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Detalle del plan</p>
          <h3 className="mt-2 break-words text-xl font-semibold">{actual.nombre}</h3>
          <p className="mt-2 text-sm text-slate-600">{actual.descripcion||'Sin descripción'}</p>
        </header>
        <div className="rounded-xl bg-slate-50 p-4">
          <h4 className="text-sm font-semibold">Ración diaria · {actual.modo_racion==='ANIMAL'?'por ternero':'total por lote'}</h4>
          <p className="mt-1 text-xs leading-5 text-slate-500">{actual.modo_racion==='ANIMAL'?'Cada día se multiplica esta dosis por los animales actuales del lote.':'Estas cantidades se descuentan fijas por lote y día.'} Cada asignación conserva su propia modalidad y composición.</p>
          {esAdmin&&asignacionesPlan.length===0&&<div className="mt-3 flex flex-wrap items-center gap-2">
            <label htmlFor="modo-plan" className="text-xs font-semibold">Modalidad del plan</label>
            <select id="modo-plan" className="rounded-lg border border-slate-300 bg-white px-2 py-2 text-sm" disabled={busy}
              value={actual.modo_racion} onChange={e=>onModeChange(actual.id,e.target.value as 'LOTE'|'ANIMAL')}>
              <option value="ANIMAL">Por ternero (automático según censo)</option>
              <option value="LOTE">Cantidad fija por lote</option>
            </select>
          </div>}
          {componentes.length===0?<p className="mt-3 text-sm text-amber-800">Plan sin alimentos. Agrega productos desde «Agregar producto a plan» antes de asignarlo.</p>:
            <div className="mt-3 space-y-2">{componentes.map(d=><div key={d.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-2 text-sm last:border-0">
              <span>{producto(d.producto_id)}</span><strong className="tabular-nums">{formato(Number(d.cantidad_diaria))} {unidad(d.unidad_id)}/{actual.modo_racion==='ANIMAL'?'ternero':'lote'} por día</strong>
            </div>)}</div>}
        </div>
        <section><h4 className="text-sm font-semibold">Lotes con este plan ({vigentes.length})</h4>
          {vigentes.length===0?<p className="mt-2 text-sm text-slate-500">Ningún lote tiene este plan vigente.</p>:
          <div className="mt-3 space-y-2">{vigentes.map(a=>{
            const l=lotes.find(x=>x.id===a.lote_id)
            return <div key={a.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 p-3">
              <div><p className="text-sm font-semibold">{l?.codigo??'Lote #'+a.lote_id}</p>
                <p className="mt-1 text-xs text-slate-500">{l?.cantidad_actual??'—'} animales · Desde {fecha(a.fecha_inicio)}</p>
              </div>
              <button type="button" className="rounded-lg border border-emerald-300 px-3 py-2 text-xs font-semibold text-emerald-800" onClick={()=>onOpenLote(a.lote_id)}>Ver seguimiento</button>
            </div>
          })}</div>}
        </section>
        {esAdmin&&actual.activo&&<section className="rounded-xl border border-slate-200 p-4">
          <h4 className="text-sm font-semibold">Asignar plan a un lote</h4>
          <p className="mt-1 text-xs text-slate-500">Puedes asignarlo a un lote sin plan o sustituir otro vigente. Los consumos se descontarán automáticamente al cierre de cada jornada, sin confirmarlos.</p>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <select className={control} aria-label="Lote al que asignar el plan" value={destino} onChange={e=>setDestino(e.target.value)}>
              <option value="">Seleccionar lote activo</option>
              {lotes.filter(l=>l.estado==='ACTIVO'&&!vigentes.some(a=>a.lote_id===l.id)).map(l=>
                <option key={l.id} value={l.id}>{l.codigo} · {l.cantidad_actual} animales{ocupados.has(l.id)?' · Reemplazar plan':''}</option>
              )}
            </select>
            <button type="button" disabled={!destino||!componentes.length||busy} onClick={()=>{onAssign(Number(destino),actual.id);setDestino('')}} className="shrink-0 rounded-xl bg-emerald-900 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">Asignar</button>
          </div>
        </section>}
        <section><h4 className="text-sm font-semibold">Historial de asignaciones ({asignacionesPlan.length})</h4>
          {asignacionesPlan.length===0?<p className="mt-2 text-xs text-slate-500">Todavía no se ha asignado este plan.</p>:
          <div className="mt-2 max-h-44 space-y-1 overflow-y-auto">{[...asignacionesPlan].sort((a,b)=>b.id-a.id).map(a=>
            <p key={a.id} className="text-xs leading-6 text-slate-600">{lotes.find(l=>l.id===a.lote_id)?.codigo??'Lote #'+a.lote_id} · {fecha(a.fecha_inicio)}{a.fecha_fin?' al '+fecha(a.fecha_fin):''} · {a.activo?'Vigente':'Finalizado'}</p>
          )}</div>}
        </section>
        {esAdmin&&<div className="flex flex-wrap gap-2 border-t border-slate-200 pt-4">
          {actual.activo?<button type="button" disabled={busy||vigentes.length>0} onClick={()=>onManage(actual,'ARCHIVAR')} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold disabled:opacity-50">Archivar</button>:
            <button type="button" disabled={busy} onClick={()=>onManage(actual,'REACTIVAR')} className="rounded-lg border border-emerald-300 px-3 py-2 text-sm font-semibold text-emerald-800">Reactivar</button>}
          {asignacionesPlan.length===0&&<button type="button" disabled={busy} onClick={()=>onManage(actual,'ELIMINAR')} className="rounded-lg border border-rose-300 px-3 py-2 text-sm font-semibold text-rose-800">Eliminar</button>}
        </div>}
      </>}
    </div>
  </section>
}
