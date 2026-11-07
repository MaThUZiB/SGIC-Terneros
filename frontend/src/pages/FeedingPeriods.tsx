import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../api/supabase'
import { OperationConfirmDialog, type ConfirmDetails } from '../components/OperationConfirmDialog'

type Lote = { id:number; codigo:string; estado:string }
type Insumo = { id:number; nombre:string; tipo_insumo:string; unidad_base_id:number; stock_actual:number; costo_promedio:number }
type Unidad = { id:number; codigo:string }
type Presentacion = { id:number; producto_id:number; nombre:string; cantidad_base:number; activa:boolean }
type Periodo = { id:number; lote_id:number; fecha_inicio:string; fecha_fin:string; suministros_dia:number; pauta_id:number|null; estado:'ESTIMADO'|'DESCONTADO'; observaciones:string|null; creado_en:string }
type Detalle = { id:number; periodo_id:number; producto_id:number; cantidad_por_suministro:number|null; cantidad_total:number; costo_referencia:number }
type Linea = { key:string; producto_id:string; cantidad:string; presentacion_id:string }
type Pauta = { id:number; nombre:string; suministros_dia:number; detalles:{producto_id:number;cantidad_por_suministro:number}[]; activo:boolean }
const SUMINISTROS_DIARIOS=2

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
const dias=(start:string,end:string)=>Math.round((Date.parse(end+'T00:00:00Z')-Date.parse(start+'T00:00:00Z'))/86400000)+1
const redondear=(n:number)=>Math.round((n+Number.EPSILON)*1000)/1000

export function FeedingPeriods({initialLoteId,onSelectLote,esAdmin}:{
  initialLoteId?:number|null; onSelectLote?:(loteId:number|null)=>void; esAdmin:boolean
}) {
  const [lotes,setLotes]=useState<Lote[]>([])
  const [productos,setProductos]=useState<Insumo[]>([])
  const [unidades,setUnidades]=useState<Unidad[]>([])
  const [presentaciones,setPresentaciones]=useState<Presentacion[]>([])
  const [periodos,setPeriodos]=useState<Periodo[]>([])
  const [detalles,setDetalles]=useState<Detalle[]>([])
  const [pautas,setPautas]=useState<Pauta[]>([])
  const [pautaId,setPautaId]=useState('')
  const [nombrePauta,setNombrePauta]=useState('')
  const [guardandoPauta,setGuardandoPauta]=useState(false)
  const [pautaArchivo,setPautaArchivo]=useState<number|null>(null)
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
      supabase.from('periodo_alimentacion').select('id,lote_id,fecha_inicio,fecha_fin,suministros_dia,pauta_id,estado,observaciones,creado_en')
        .order('fecha_fin',{ascending:false}).order('id',{ascending:false}).limit(2000),
      supabase.from('detalle_periodo_alimentacion').select('id,periodo_id,producto_id,cantidad_por_suministro,cantidad_total,costo_referencia').limit(10000),
      supabase.from('pauta_alimentacion').select('id,nombre,suministros_dia,detalles,activo').order('nombre').limit(300)
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
      setPautas((result[6].data??[]) as Pauta[])
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
  const cantidadDias=inicio&&fin&&inicio<=fin?dias(inicio,fin):0
  const calculadas=useMemo(()=>lineas.map(linea=>{
    const producto=productos.find(p=>String(p.id)===linea.producto_id)
    const base=asNumber(linea.cantidad)*factor(linea)
    const porSuministro=redondear(base)
    const total=redondear(porSuministro*SUMINISTROS_DIARIOS*cantidadDias)
    return {linea,producto,base,porSuministro,total,costo:producto?total*Number(producto.costo_promedio):0}
  }),[lineas,productos,presentaciones,cantidadDias])
  const visibles=periodos.filter(p=>!filtroLote||String(p.lote_id)===filtroLote)
  const detalleSeleccionado=seleccion===null?null:periodos.find(p=>p.id===seleccion)??null
  const seleccionDetalles=detalles.filter(d=>d.periodo_id===seleccion)
  const nombreLote=(id:number)=>lotes.find(l=>l.id===id)?.codigo??'Lote #'+id
  const nombreProducto=(id:number)=>productos.find(p=>p.id===id)?.nombre??'Insumo #'+id
  const costo=(id:number)=>detalles.filter(d=>d.periodo_id===id).reduce((total,d)=>total+Number(d.costo_referencia),0)

  function cambiarLinea(key:string,patch:Partial<Linea>){
    setPautaId('')
    setLineas(prev=>prev.map(l=>l.key===key?{...l,...patch}:l))
  }
  function aplicarPauta(id:string){
    setPautaId(id)
    const pauta=pautas.find(p=>String(p.id)===id&&p.activo&&p.suministros_dia===SUMINISTROS_DIARIOS)
    if(!pauta)return
    setLineas(pauta.detalles.map(d=>({key:crypto.randomUUID(),producto_id:String(d.producto_id),cantidad:String(d.cantidad_por_suministro),presentacion_id:''})))
    setError('')
  }
  function validarLineas():string|null {
    if(lineas.length===0||calculadas.some(({linea,producto,base,porSuministro})=>!linea.producto_id||!producto||!Number.isFinite(base)||base<=0||porSuministro<=0||Math.abs(base-porSuministro)>0.000001))
      return 'Ingresa cantidades positivas por suministro, con hasta tres decimales en la unidad base.'
    if(new Set(lineas.map(l=>l.producto_id)).size!==lineas.length)
      return 'Cada insumo solo puede agregarse una vez a la pauta.'
    return null
  }
  async function guardarPauta() {
    if(!supabase||guardandoPauta)return
    const problema=validarLineas()
    if(problema){setError(problema);return}
    if(nombrePauta.trim().length<3){setError('Escribe un nombre de pauta de al menos tres caracteres.');return}
    setGuardandoPauta(true);setError('');setAviso('')
    try{
      const result=await supabase.rpc('sgic_guardar_pauta_alimentacion',{
        p:{nombre:nombrePauta.trim(),suministros_dia:SUMINISTROS_DIARIOS,
          detalles:calculadas.map(x=>({producto_id:x.producto!.id,cantidad_por_suministro:x.porSuministro}))}
      })
      if(result.error)throw Error(result.error.message)
      setPautaId(String(result.data));setNombrePauta('')
      setAviso('Pauta guardada. Puedes reutilizarla en otros lotes o períodos sin generar consumos automáticamente.')
      await cargar()
    }catch(e){setError(e instanceof Error?e.message:'No se pudo guardar la pauta.')}
    finally{setGuardandoPauta(false)}
  }
  async function archivarPauta(id:number) {
    if(!supabase||!esAdmin||pautaArchivo!==null)return
    setPautaArchivo(id);setError('')
    try{
      const result=await supabase.rpc('sgic_archivar_pauta_alimentacion',{p_id:id})
      if(result.error)throw Error(result.error.message)
      if(pautaId===String(id))setPautaId('')
      setAviso('Pauta archivada. Los consumos históricos permanecen intactos.')
      await cargar()
    }catch(e){setError(e instanceof Error?e.message:'No se pudo archivar la pauta.')}
    finally{setPautaArchivo(null)}
  }
  function preparar(){
    setError('');setAviso('')
    if(!loteId||!lotes.some(l=>String(l.id)===loteId)){setError('Selecciona un lote.');return}
    if(!inicio||!fin||inicio>fin||fin>hoy()||dias(inicio,fin)>366){setError('Revisa las fechas. El período no puede terminar en el futuro ni superar 366 días.');return}
    const problema=validarLineas()
    if(problema){setError(problema);return}
    if(descontar&&calculadas.some(x=>x.producto&&x.total>Number(x.producto.stock_actual))){
      setError('No existe stock suficiente para descontar todos los insumos. Para reconstruir semanas antiguas, puedes guardar solamente una estimación.');return
    }
    const resumen=calculadas.map(x=>x.producto?.nombre+': '+numero(x.porSuministro)+' '+unidad(x.producto)+' por suministro → '+numero(x.total)+' '+unidad(x.producto)+' total').join('\n')
    setConfirmacion({
      title:descontar?'Confirmar consumo y descontar inventario':'Guardar estimación histórica',
      description:nombreLote(Number(loteId))+' · '+fecha(inicio)+' al '+fecha(fin)+' · '+cantidadDias+' días × '+SUMINISTROS_DIARIOS+' suministros diarios\n'+resumen+
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
      suministros_dia:SUMINISTROS_DIARIOS,pauta_id:pautaId?Number(pautaId):null,
      descontar_stock:descontar,observaciones:observaciones.trim(),
      detalles:calculadas.map(x=>({producto_id:x.producto!.id,cantidad_por_suministro:x.porSuministro}))
    }
    try{
      const result=await supabase.rpc('sgic_registrar_periodo_alimentacion',{p:payload})
      if(result.error)throw Error(result.error.message)
      setConfirmacion(null);setNuevo(false);setSeleccion(Number(result.data))
      setSolicitud(crypto.randomUUID());setLineas([nuevaLinea()]);setObservaciones('');setPautaId('')
      setAviso(descontar?'Consumo registrado. El stock y los costos del lote fueron actualizados.':'Estimación guardada sin descontar inventario.')
      await cargar()
    }catch(e){setConfirmacion(null);setError(e instanceof Error?e.message:'No se pudo guardar el período.')}
    finally{setGuardando(false)}
  }

  return <section className="space-y-4" aria-label="Consumo de alimentación por período">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h2 className="text-base font-semibold">Alimentación por suministros</h2>
        <p className="mt-1 text-xs text-slate-500">Indica cuánto recibe el lote en cada suministro; SGIC calcula el consumo acumulado por fechas.</p>
      </div>
      {!nuevo&&<button type="button" onClick={()=>{setNuevo(true);setAviso('');setError('');setLoteId(filtroLote)}} className="rounded-lg bg-emerald-900 px-4 py-2.5 text-sm font-semibold text-white">+ Registrar alimentación</button>}
    </div>
    {error&&<p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>}
    {aviso&&<p role="status" className="rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-900">{aviso}</p>}
    {nuevo&&<div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
      <div className="mb-4 flex items-center justify-between gap-3"><h3 className="text-base font-semibold">Nuevo período de alimentación</h3>
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
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
          <p className="text-sm font-semibold text-slate-900">{SUMINISTROS_DIARIOS} suministros diarios para el lote</p>
          <p className="mt-1 text-xs text-slate-600">Cantidad por suministro × {SUMINISTROS_DIARIOS} × {cantidadDias||'—'} días = consumo total estimado. No se exige ingresar los terneros individualmente.</p>
        </div>
        {pautas.some(p=>p.activo&&p.suministros_dia===SUMINISTROS_DIARIOS)&&<label className="block space-y-1 text-sm">
          <span className="font-medium">Usar una pauta guardada (opcional)</span>
          <select className={field} value={pautaId} onChange={e=>aplicarPauta(e.target.value)}>
            <option value="">Crear sin pauta</option>
            {pautas.filter(p=>p.activo&&p.suministros_dia===SUMINISTROS_DIARIOS).map(p=><option key={p.id} value={p.id}>{p.nombre}</option>)}
          </select>
        </label>}
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3"><h4 className="text-sm font-semibold">Cantidad por suministro (lote completo)</h4>
            <button type="button" disabled={lineas.length>=20} onClick={()=>{setPautaId('');setLineas(old=>[...old,nuevaLinea()])}} className="text-xs font-semibold text-emerald-800 disabled:opacity-50">+ Añadir insumo</button>
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
              <label className="space-y-1 text-sm"><span className="text-xs font-medium">Por suministro</span>
                <input className={field} required inputMode="decimal" placeholder="0" value={linea.cantidad} onChange={e=>cambiarLinea(linea.key,{cantidad:e.target.value})}/>
              </label>
              <button type="button" title="Quitar insumo" aria-label="Quitar insumo" disabled={lineas.length===1} onClick={()=>{setPautaId('');setLineas(old=>old.filter(l=>l.key!==linea.key))}}
                className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-600 disabled:opacity-30">Quitar</button>
            </div>
            {producto&&Number.isFinite(total)&&total>0&&<p className="mt-2 text-xs text-slate-600">
              {numero(redondear(asNumber(linea.cantidad)*factor(linea)))} {unidad(producto)} × {SUMINISTROS_DIARIOS} suministros × {cantidadDias} días = <strong>{numero(total)} {unidad(producto)} en el período</strong>
              <span className="block mt-1">Stock disponible: {numero(Number(producto.stock_actual))} {unidad(producto)}</span>
            </p>}
          </div>)}
        </div>
        {esAdmin&&<details className="rounded-lg border border-slate-200 px-4 py-3 text-sm">
          <summary className="cursor-pointer font-medium">Guardar esta combinación como pauta reutilizable</summary>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <input type="text" maxLength={100} className={field} value={nombrePauta}
              onChange={e=>setNombrePauta(e.target.value)} placeholder="Ej. Alimentación de inicio"/>
            <button type="button" disabled={guardandoPauta||cargando} onClick={()=>{void guardarPauta()}}
              className="shrink-0 rounded-lg border border-emerald-900 px-4 py-2 text-sm font-semibold text-emerald-900 disabled:opacity-50">
              {guardandoPauta?'Guardando…':'Guardar pauta'}
            </button>
          </div>
          <p className="mt-2 text-xs text-slate-500">La pauta solo guarda las cantidades por suministro para reutilizarlas. No genera consumos ni descuenta inventario por sí sola.</p>
        </details>}
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
          <p className="text-sm text-slate-600">{cantidadDias>0?cantidadDias+' días · '+(cantidadDias*SUMINISTROS_DIARIOS)+' suministros · ':''}Costo orientativo: <strong>{clp(calculadas.reduce((s,x)=>s+(Number.isFinite(x.costo)?x.costo:0),0))}</strong></p>
          <button type="submit" disabled={guardando||cargando} className="rounded-lg bg-emerald-900 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50">Revisar período</button>
        </div>
      </form>
    </div>}
    {pautas.some(p=>p.activo)&&<details className="rounded-xl border border-slate-200 bg-white px-4 py-3">
      <summary className="cursor-pointer text-sm font-semibold">Pautas de alimentación guardadas ({pautas.filter(p=>p.activo).length})</summary>
      <div className="mt-3 divide-y divide-slate-100">
        {pautas.filter(p=>p.activo).map(p=><div key={p.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
          <div><p className="text-sm font-medium">{p.nombre}</p><p className="mt-0.5 text-xs text-slate-500">
            {p.suministros_dia} suministros/día · {p.detalles.length} insumo(s)
          </p></div>
          <div className="flex gap-3">
            <button type="button" disabled={p.suministros_dia!==SUMINISTROS_DIARIOS}
              onClick={()=>{setNuevo(true);aplicarPauta(String(p.id));setLoteId(filtroLote);setError('');setAviso('')}}
              className="text-sm font-semibold text-emerald-800 disabled:opacity-50">Usar pauta</button>
            {esAdmin&&<button type="button" disabled={pautaArchivo!==null} onClick={()=>{void archivarPauta(p.id)}}
              className="text-sm text-slate-500 hover:text-rose-700 disabled:opacity-50">Archivar</button>}
          </div>
        </div>)}
      </div>
    </details>}
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
              <span className="mt-1 block text-xs text-slate-500">{fecha(p.fecha_inicio)} — {fecha(p.fecha_fin)} · {dias(p.fecha_inicio,p.fecha_fin)} días · {p.suministros_dia} suministros/día</span>
            </span>
            <span className="flex items-center gap-3"><span className="text-right"><strong className="block text-sm">{clp(costo(p.id))}</strong><small className="text-xs text-slate-500">{p.estado==='DESCONTADO'?'Stock descontado':'Solo estimación'}</small></span><span className="text-slate-500">{seleccion===p.id?'−':'+'}</span></span>
          </button>
          {detalleSeleccionado?.id===p.id&&<div className="border-t border-slate-100 bg-slate-50 px-4 py-4">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Detalle del período</h4>
            <div className="mt-3 space-y-2">{seleccionDetalles.map(d=><div key={d.id} className="flex flex-wrap justify-between gap-2 text-sm">
              <span>{nombreProducto(d.producto_id)}{d.cantidad_por_suministro!==null&&<small className="mt-1 block text-slate-500">{numero(Number(d.cantidad_por_suministro))} {unidad(productos.find(x=>x.id===d.producto_id))} por suministro</small>}</span><span className="font-medium">{numero(Number(d.cantidad_total))} {unidad(productos.find(x=>x.id===d.producto_id))} total</span>
            </div>)}</div>
            {p.observaciones&&<p className="mt-3 text-xs text-slate-600">{p.observaciones}</p>}
            <p className="mt-3 text-xs text-slate-500">Cantidades globales aproximadas. No representan una medición individual ni un registro diario.</p>
          </div>}
        </div>)}</div>}
    </div>
    <OperationConfirmDialog details={confirmacion} busy={guardando} onCancel={()=>setConfirmacion(null)} onConfirm={()=>{void guardar()}}/>
  </section>
}
