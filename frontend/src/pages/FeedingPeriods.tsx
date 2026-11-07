import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../api/supabase'
import { OperationConfirmDialog, type ConfirmDetails } from '../components/OperationConfirmDialog'

type Lote = { id:number; codigo:string; estado:string }
type Insumo = { id:number; nombre:string; tipo_insumo:string; unidad_base_id:number; stock_actual:number; costo_promedio:number }
type Unidad = { id:number; codigo:string }
type Presentacion = { id:number; producto_id:number; nombre:string; cantidad_base:number; activa:boolean }
type Periodo = { id:number; lote_id:number; fecha_inicio:string; fecha_fin:string; estado:'ESTIMADO'|'DESCONTADO'; observaciones:string|null; creado_en:string }
type Detalle = { id:number; periodo_id:number; producto_id:number; cantidad_total:number; costo_referencia:number }
type Linea = { key:string; producto_id:string; cantidad:string; presentacion_id:string }

const hoy=()=>new Date().toLocaleDateString('en-CA',{timeZone:'America/Santiago'})
function haceDias(dias:number) {
  const date=new Date(hoy()+'T12:00:00Z')
  date.setUTCDate(date.getUTCDate()-dias)
  return date.toISOString().slice(0,10)
}
const nuevaLinea=():Linea=>({key:crypto.randomUUID(),producto_id:'',cantidad:'',presentacion_id:''})
const clp=(value:number)=>new Intl.NumberFormat('es-CL',{style:'currency',currency:'CLP',maximumFractionDigits:0}).format(value)
const numero=(value:number)=>new Intl.NumberFormat('es-CL',{maximumFractionDigits:3}).format(value)
const fecha=(value:string)=>value.split('-').reverse().join('/')
const field='w-full min-w-0 rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100'
const asNumber=(value:string)=>Number(value.replace(',','.'))

export function FeedingPeriods({initialLoteId,onSelectLote}:{
  initialLoteId?:number|null; onSelectLote?:(loteId:number|null)=>void
}) {
  const [lotes,setLotes]=useState<Lote[]>([])
  const [productos,setProductos]=useState<Insumo[]>([])
  const [unidades,setUnidades]=useState<Unidad[]>([])
  const [presentaciones,setPresentaciones]=useState<Presentacion[]>([])
  const [periodos,setPeriodos]=useState<Periodo[]>([])
  const [detalles,setDetalles]=useState<Detalle[]>([])
  const [filtroLote,setFiltroLote]=useState(String(initialLoteId??''))
  const [nuevo,setNuevo]=useState(false)
  const [seleccion,setSeleccion]=useState<number|null>(null)
  const [loteId,setLoteId]=useState(String(initialLoteId??''))
  const [inicio,setInicio]=useState(haceDias(6))
  const [fin,setFin]=useState(hoy())
  const [descontar,setDescontar]=useState(true)
  const [observaciones,setObservaciones]=useState('')
  const [lineas,setLineas]=useState<Linea[]>([nuevaLinea()])
  const [solicitud,setSolicitud]=useState(()=>crypto.randomUUID())
  const [confirmacion,setConfirmacion]=useState<ConfirmDetails|null>(null)
  const [cargando,setCargando]=useState(true)
  const [guardando,setGuardando]=useState(false)
  const [error,setError]=useState('')
  const [aviso,setAviso]=useState('')

  const cargar=useCallback(async()=>{
    if(!supabase){setError('Sin conexión con Supabase.');setCargando(false);return}
    setCargando(true)
    const result=await Promise.all([
      supabase.from('lote').select('id,codigo,estado').order('codigo').limit(3000),
      supabase.from('producto').select('id,nombre,tipo_insumo,unidad_base_id,stock_actual,costo_promedio')
        .in('tipo_insumo',['LECHE','CONCENTRADO']).eq('activo',true).order('nombre').limit(2000),
      supabase.from('unidad_medida').select('id,codigo').limit(1000),
      supabase.from('presentacion_producto').select('id,producto_id,nombre,cantidad_base,activa').eq('activa',true).limit(2000),
      supabase.from('periodo_alimentacion').select('id,lote_id,fecha_inicio,fecha_fin,estado,observaciones,creado_en')
        .order('fecha_fin',{ascending:false}).order('id',{ascending:false}).limit(2000),
      supabase.from('detalle_periodo_alimentacion').select('id,periodo_id,producto_id,cantidad_total,costo_referencia').limit(10000)
    ])
    const failed=result.find(r=>r.error)
    if(failed?.error){setError('No se pudo consultar Alimentación: '+failed.error.message)}
    else {
      setLotes((result[0].data??[]) as Lote[])
      setProductos((result[1].data??[]) as Insumo[])
      setUnidades((result[2].data??[]) as Unidad[])
      setPresentaciones((result[3].data??[]) as Presentacion[])
      setPeriodos((result[4].data??[]) as Periodo[])
      setDetalles((result[5].data??[]) as Detalle[])
      setError('')
    }
    setCargando(false)
  },[])
  useEffect(()=>{void cargar()},[cargar])
  useEffect(()=>{if(initialLoteId){setFiltroLote(String(initialLoteId));setLoteId(String(initialLoteId))}},[initialLoteId])

  const unidad=(p:Insumo|undefined)=>unidades.find(u=>u.id===p?.unidad_base_id)?.codigo??'unidad'
  const factor=(linea:Linea)=>{
    const presentation=presentaciones.find(pr=>String(pr.id)===linea.presentacion_id&&String(pr.producto_id)===linea.producto_id)
    return presentation?Number(presentation.cantidad_base):1
  }
  const calculadas=useMemo(()=>lineas.map(linea=>{
    const producto=productos.find(p=>String(p.id)===linea.producto_id)
    const total=Math.round(asNumber(linea.cantidad)*factor(linea)*1000)/1000
    return {linea,producto,total,costo:producto?total*Number(producto.costo_promedio):0}
  }),[lineas,productos,presentaciones])
  const visibles=periodos.filter(p=>!filtroLote||String(p.lote_id)===filtroLote)
  const detalleSeleccionado=seleccion===null?null:periodos.find(p=>p.id===seleccion)??null
  const seleccionDetalles=detalles.filter(d=>d.periodo_id===seleccion)
  const nombreLote=(id:number)=>lotes.find(l=>l.id===id)?.codigo??'Lote #'+id
  const nombreProducto=(id:number)=>productos.find(p=>p.id===id)?.nombre??'Insumo #'+id
  const costo=(id:number)=>detalles.filter(d=>d.periodo_id===id).reduce((total,d)=>total+Number(d.costo_referencia),0)
  const dias=(start:string,end:string)=>Math.round((Date.parse(end+'T00:00:00Z')-Date.parse(start+'T00:00:00Z'))/86400000)+1

  function cambiarLinea(key:string,patch:Partial<Linea>){
    setLineas(prev=>prev.map(l=>l.key===key?{...l,...patch}:l))
  }
  function preparar(){
    setError('');setAviso('')
    if(!loteId||!lotes.some(l=>String(l.id)===loteId)){setError('Selecciona un lote.');return}
    if(!inicio||!fin||inicio>fin||fin>hoy()||dias(inicio,fin)>366){setError('Revisa las fechas. El período no puede terminar en el futuro ni superar 366 días.');return}
    if(lineas.length===0||calculadas.some(({linea,producto,total})=>!linea.producto_id||!producto||!Number.isFinite(total)||total<=0||Math.abs(total-asNumber(linea.cantidad)*factor(linea))>0.00001)){
      setError('Selecciona los insumos e ingresa cantidades positivas de hasta tres decimales en la unidad base.');return
    }
    if(new Set(lineas.map(l=>l.producto_id)).size!==lineas.length){setError('Un mismo insumo solo puede agregarse una vez por período.');return}
    if(descontar&&calculadas.some(x=>x.producto&&x.total>Number(x.producto.stock_actual))){
      setError('No existe stock suficiente para descontar todos los insumos. Para reconstruir semanas antiguas, puedes guardar solamente una estimación.');return
    }
    const resumen=calculadas.map(x=>x.producto?.nombre+': '+numero(x.total)+' '+unidad(x.producto)).join('\n')
    setConfirmacion({
      title:descontar?'Confirmar consumo y descontar inventario':'Guardar estimación histórica',
      description:nombreLote(Number(loteId))+' · '+fecha(inicio)+' al '+fecha(fin)+'\n'+resumen+
        (descontar?'\nSe descontará el stock una sola vez, no diariamente.':'\nNo se modificarán existencias ni rentabilidad contabilizada.'),
      confirmLabel:descontar?'Registrar consumo':'Guardar estimación',
      summary:[{label:'Total referencial',value:clp(calculadas.reduce((s,x)=>s+x.costo,0)),emphasis:true}]
    })
  }
  async function guardar(){
    if(!supabase||guardando||!confirmacion)return
    setGuardando(true)
    const payload={
      solicitud,lote_id:Number(loteId),fecha_inicio:inicio,fecha_fin:fin,
      descontar_stock:descontar,observaciones:observaciones.trim(),
      detalles:calculadas.map(x=>({producto_id:x.producto!.id,cantidad:x.total}))
    }
    try{
      const result=await supabase.rpc('sgic_registrar_periodo_alimentacion',{p:payload})
      if(result.error)throw Error(result.error.message)
      setConfirmacion(null);setNuevo(false);setSeleccion(Number(result.data))
      setSolicitud(crypto.randomUUID());setLineas([nuevaLinea()]);setObservaciones('')
      setAviso(descontar?'Consumo registrado. El stock y los costos del lote fueron actualizados.':'Estimación guardada sin descontar inventario.')
      await cargar()
    }catch(e){setConfirmacion(null);setError(e instanceof Error?e.message:'No se pudo guardar el período.')}
    finally{setGuardando(false)}
  }

  return <section className="space-y-4" aria-label="Consumo de alimentación por período">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h2 className="text-base font-semibold">Consumos por período</h2>
        <p className="mt-1 text-xs text-slate-500">Totales aproximados por lote, sin cálculos automáticos por animal ni por jornada.</p>
      </div>
      {!nuevo&&<button type="button" onClick={()=>{setNuevo(true);setAviso('');setError('');setLoteId(filtroLote)}} className="rounded-lg bg-emerald-900 px-4 py-2.5 text-sm font-semibold text-white">+ Registrar período</button>}
    </div>
    {error&&<p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>}
    {aviso&&<p role="status" className="rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-900">{aviso}</p>}
    {nuevo&&<div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
      <div className="mb-4 flex items-center justify-between gap-3"><h3 className="text-base font-semibold">Nuevo período</h3>
        <button type="button" onClick={()=>{setNuevo(false);setError('')}} className="rounded-lg border border-slate-200 px-3 py-2 text-sm">Cancelar</button></div>
      <form onSubmit={e=>{e.preventDefault();preparar()}} className="mx-auto max-w-3xl space-y-5">
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="space-y-1.5 text-sm"><span className="font-medium">Lote</span>
            <select className={field} required value={loteId} onChange={e=>setLoteId(e.target.value)}>
              <option value="">Seleccionar lote</option>{lotes.map(l=><option value={l.id} key={l.id}>{l.codigo}</option>)}
            </select>
          </label>
          <label className="space-y-1.5 text-sm"><span className="font-medium">Desde</span>
            <input className={field} type="date" max={hoy()} required value={inicio} onChange={e=>setInicio(e.target.value)}/>
          </label>
          <label className="space-y-1.5 text-sm"><span className="font-medium">Hasta</span>
            <input className={field} type="date" max={hoy()} required value={fin} onChange={e=>setFin(e.target.value)}/>
          </label>
        </div>
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3"><h4 className="text-sm font-semibold">Alimentos consumidos durante el período</h4>
            <button type="button" disabled={lineas.length>=20} onClick={()=>setLineas(old=>[...old,nuevaLinea()])} className="text-xs font-semibold text-emerald-800 disabled:opacity-50">+ Añadir insumo</button>
          </div>
          {calculadas.map(({linea,producto,total},index)=><div key={linea.key} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <div className="grid gap-3 sm:grid-cols-[minmax(0,2fr)_minmax(0,1.2fr)_minmax(0,0.8fr)_auto] sm:items-end">
              <label className="space-y-1 text-sm"><span className="text-xs font-medium">Insumo {index+1}</span>
                <select className={field} required value={linea.producto_id} onChange={e=>cambiarLinea(linea.key,{producto_id:e.target.value,presentacion_id:''})}>
                  <option value="">Seleccionar</option>{productos.map(p=><option value={p.id} key={p.id}>{p.nombre}</option>)}
                </select>
              </label>
              <label className="space-y-1 text-sm"><span className="text-xs font-medium">Medida</span>
                <select className={field} value={linea.presentacion_id} onChange={e=>cambiarLinea(linea.key,{presentacion_id:e.target.value})}>
                  <option value="">Unidad base ({unidad(producto)})</option>
                  {presentaciones.filter(pr=>String(pr.producto_id)===linea.producto_id).map(pr=><option value={pr.id} key={pr.id}>{pr.nombre} ({numero(Number(pr.cantidad_base))} {unidad(producto)})</option>)}
                </select>
              </label>
              <label className="space-y-1 text-sm"><span className="text-xs font-medium">Cantidad</span>
                <input className={field} required inputMode="decimal" placeholder="0" value={linea.cantidad} onChange={e=>cambiarLinea(linea.key,{cantidad:e.target.value})}/>
              </label>
              <button type="button" title="Quitar insumo" aria-label="Quitar insumo" disabled={lineas.length===1} onClick={()=>setLineas(old=>old.filter(l=>l.key!==linea.key))}
                className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-600 disabled:opacity-30">Quitar</button>
            </div>
            {producto&&Number.isFinite(total)&&total>0&&<p className="mt-2 text-xs text-slate-600">Total del período: {numero(total)} {unidad(producto)} · Stock disponible: {numero(Number(producto.stock_actual))} {unidad(producto)}</p>}
          </div>)}
        </div>
        <label className="flex items-start gap-3 rounded-lg border border-slate-200 px-4 py-3 text-sm">
          <input type="checkbox" checked={descontar} onChange={e=>setDescontar(e.target.checked)} className="mt-1 accent-emerald-900"/>
          <span><strong>Descontar del inventario al registrar</strong>
            <span className="mt-1 block text-xs text-slate-600">Desmarca esta opción para reconstruir una semana antigua que ya no corresponde descontar del stock actual. Esa estimación no se imputará a rentabilidad.</span>
          </span>
        </label>
        <details className="rounded-lg border border-slate-200 px-4 py-3 text-sm"><summary className="cursor-pointer font-medium">Observaciones (opcional)</summary>
          <textarea className={field+' mt-3'} maxLength={500} rows={2} value={observaciones} onChange={e=>setObservaciones(e.target.value)} placeholder="Ej. consumo reconstruido de la semana de llegada"/>
        </details>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
          <p className="text-sm text-slate-600">{inicio&&fin&&inicio<=fin?dias(inicio,fin)+' días · ':''}Costo orientativo: <strong>{clp(calculadas.reduce((s,x)=>s+(Number.isFinite(x.costo)?x.costo:0),0))}</strong></p>
          <button type="submit" disabled={guardando||cargando} className="rounded-lg bg-emerald-900 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50">Revisar período</button>
        </div>
      </form>
    </div>}
    <div className="rounded-xl border border-slate-200 bg-white">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
        <h3 className="text-sm font-semibold">Historial de períodos <span className="font-normal text-slate-500">({visibles.length})</span></h3>
        <label className="flex items-center gap-2 text-xs text-slate-600"><span>Filtrar lote</span>
          <select className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm" value={filtroLote}
            onChange={e=>{setFiltroLote(e.target.value);setSeleccion(null);onSelectLote?.(e.target.value?Number(e.target.value):null)}}>
            <option value="">Todos</option>{lotes.map(l=><option key={l.id} value={l.id}>{l.codigo}</option>)}
          </select>
        </label>
      </div>
      {cargando?<p className="p-5 text-sm text-slate-500">Cargando períodos…</p>:visibles.length===0?
        <p className="p-6 text-sm text-slate-500">No hay períodos registrados para este filtro.</p>:
        <div className="divide-y divide-slate-100">{visibles.map(p=><div key={p.id}>
          <button type="button" aria-expanded={seleccion===p.id} onClick={()=>setSeleccion(s=>s===p.id?null:p.id)}
            className="flex w-full flex-wrap items-center justify-between gap-3 px-4 py-3 text-left transition hover:bg-slate-50">
            <span><strong className="text-sm">{nombreLote(p.lote_id)}</strong>
              <span className="mt-1 block text-xs text-slate-500">{fecha(p.fecha_inicio)} — {fecha(p.fecha_fin)} · {dias(p.fecha_inicio,p.fecha_fin)} días</span>
            </span>
            <span className="flex items-center gap-3"><span className="text-right"><strong className="block text-sm">{clp(costo(p.id))}</strong><small className="text-xs text-slate-500">{p.estado==='DESCONTADO'?'Stock descontado':'Solo estimación'}</small></span><span className="text-slate-500">{seleccion===p.id?'−':'+'}</span></span>
          </button>
          {detalleSeleccionado?.id===p.id&&<div className="border-t border-slate-100 bg-slate-50 px-4 py-4">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Detalle del período</h4>
            <div className="mt-3 space-y-2">{seleccionDetalles.map(d=><div key={d.id} className="flex flex-wrap justify-between gap-2 text-sm">
              <span>{nombreProducto(d.producto_id)}</span><span className="font-medium">{numero(Number(d.cantidad_total))} {unidad(productos.find(x=>x.id===d.producto_id))}</span>
            </div>)}</div>
            {p.observaciones&&<p className="mt-3 text-xs text-slate-600">{p.observaciones}</p>}
            <p className="mt-3 text-xs text-slate-500">Cantidades globales aproximadas. No representan una medición individual ni un registro diario.</p>
          </div>}
        </div>)}</div>}
    </div>
    <OperationConfirmDialog details={confirmacion} busy={guardando} onCancel={()=>setConfirmacion(null)} onConfirm={()=>{void guardar()}}/>
  </section>
}
