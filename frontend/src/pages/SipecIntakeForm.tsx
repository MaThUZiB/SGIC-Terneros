import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../api/supabase'
import { parseClpAmount } from '../utils/clpInput'
import { OperationConfirmDialog, type ConfirmDetails } from '../components/OperationConfirmDialog'
import type { SipecAnimal } from '../utils/sipecSpreadsheet'

type IncomeType = 'COMPRA' | 'INICIAL' | 'TRASLADO' | 'NACIMIENTO'
type Row = SipecAnimal & { selected: boolean; precio: string }
type Option = { id: number; nombre?: string; codigo?: string; estado?: string }
const money = (value: number) => new Intl.NumberFormat('es-CL', {
  style:'currency',currency:'CLP',maximumFractionDigits:2,
}).format(value)
const localDate = () => {
  const d=new Date()
  return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-')
}
const MAX_BATCH=200
function validPrice(value:string):boolean{return parseClpAmount(value)!==null}
function normalize(value:string):string{
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toUpperCase()
}

export function SipecIntakeForm({animales,onCancel,onSuccess}:{
  animales:SipecAnimal[];onCancel:()=>void;onSuccess:(id:number)=>void
}){
  const [rows,setRows]=useState<Row[]>(()=>animales.map(a=>({...a,selected:true,precio:''})))
  const [tipo,setTipo]=useState<IncomeType>('INICIAL')
  const [fecha,setFecha]=useState(localDate)
  const [loteId,setLoteId]=useState('')
  const [loteCodigo,setLoteCodigo]=useState('')
  const [proveedorId,setProveedorId]=useState('')
  const [documento,setDocumento]=useState('')
  const [bulk,setBulk]=useState('')
  const [pastedPrices,setPastedPrices]=useState('')
  const [mapRaza,setMapRaza]=useState<Record<string,string>>({})
  const [lotes,setLotes]=useState<Option[]>([])
  const [razas,setRazas]=useState<Option[]>([])
  const [proveedores,setProveedores]=useState<Option[]>([])
  const [error,setError]=useState('')
  const [loading,setLoading]=useState(true)
  const [busy,setBusy]=useState(false)
  const [confirm,setConfirm]=useState<ConfirmDetails|null>(null)

  useEffect(()=>{
    let live=true
    async function load(){
      if(!supabase){if(live){setError('Supabase no está disponible.');setLoading(false)}return}
      const [l,r,p]=await Promise.all([
        supabase.from('lote').select('id,codigo,estado').eq('estado','ACTIVO').order('codigo').limit(500),
        supabase.from('raza').select('id,nombre').order('nombre').limit(500),
        supabase.from('proveedor').select('id,nombre').eq('activo',true).order('nombre').limit(500),
      ])
      if(!live)return
      const failure=l.error||r.error||p.error
      if(failure)setError('No se pudieron cargar los catálogos: '+failure.message)
      else{
        setLotes((l.data??[]) as Option[])
        setRazas((r.data??[]) as Option[])
        setProveedores((p.data??[]) as Option[])
        const maps:Record<string,string>={}
        const names=[...new Set(animales.map(a=>a.raza))]
        for(const name of names){
          const match=((r.data??[]) as Option[]).find(x=>normalize(x.nombre||'')===normalize(name))
          maps[name]=match?String(match.id):'AUTO'
        }
        setMapRaza(maps)
      }
      setLoading(false)
    }
    void load()
    return()=>{live=false}
  },[animales])

  const selected=useMemo(()=>rows.filter(r=>r.selected),[rows])
  const selectedTotal=useMemo(()=>selected.reduce((sum,r)=>sum+(validPrice(r.precio)?Math.round((parseClpAmount(r.precio)??0)*100):0),0)/100,[selected])
  const missing=selected.filter(r=>!validPrice(r.precio))
  const distinctRazas=useMemo(()=>[...new Set(rows.map(r=>r.raza))],[rows])
  const labels:Record<IncomeType,string>={
    COMPRA:'Compra de animales',INICIAL:'Existencias iniciales',
    TRASLADO:'Traslado desde otro predio',NACIMIENTO:'Nacimiento en el predio',
  }
  function updateRow(diio:string,patch:Partial<Row>){
    setRows(old=>old.map(r=>r.diio===diio?{...r,...patch}:r))
    setError('')
  }
  function applyBulk(){
    if(!validPrice(bulk)){setError('Introduce un valor positivo válido (máximo dos decimales).');return}
    setRows(old=>old.map(r=>r.selected?{...r,precio:bulk}:r))
    setError('')
  }
  function applyPastedPrices(){
    const values=pastedPrices.replace(/\r/g,'').split(/\n/).map(v=>v.trim()).filter(Boolean)
    if(!values.length||values.length!==selected.length){
      setError('Pega exactamente un precio por cada DIIO seleccionado, en el mismo orden de la tabla.');return
    }
    if(values.some(v=>!validPrice(v))){
      setError('Los importes deben ser positivos. Admite 180000, 180.000 o 180.000,50.');return
    }
    const changes=new Map(selected.map((r,i)=>[r.diio,values[i]]))
    setRows(old=>old.map(r=>changes.has(r.diio)?{...r,precio:changes.get(r.diio)!}:r))
    setPastedPrices('');setError('')
  }
  function prepare(){
    setError('')
    if(selected.length<1) {setError('Selecciona al menos un DIIO nuevo.');return}
    if(selected.length>MAX_BATCH){setError('Selecciona como máximo 200 animales por operación.');return}
    if(!loteId && (!loteCodigo.trim()||loteCodigo.trim().length>30)){
      setError('Selecciona un lote existente o escribe un código nuevo (máximo 30 caracteres).');return
    }
    if(loteId && loteCodigo.trim()){setError('Selecciona un lote existente o crea uno nuevo, no ambos.');return}
    if(!/^\d{4}-\d{2}-\d{2}$/.test(fecha)){setError('Indica una fecha válida.');return}
    if(missing.length){setError('Falta un valor económico positivo para '+missing.length+' DIIO. Ejemplo: '+missing.slice(0,3).map(r=>r.diio).join(', '));return}
    if(selected.some(r=>!['MACHO','HEMBRA'].includes(r.sexo))){
      setError('Hay animales sin sexo válido; revisa los datos SIPECweb.');return
    }
    if(selected.some(r=>r.fechaNacimiento && r.fechaNacimiento>fecha)){
      setError('La fecha de incorporación no puede ser anterior al nacimiento.');return
    }
    if(selected.some(r=>!mapRaza[r.raza])){setError('Asigna una raza SGIC a cada raza del archivo.');return}
    setConfirm({
      title:'Paso 3 de 3 · Guardar animales en SGIC',
      description:'Tipo: '+labels[tipo]+
        '\nAnimales: '+selected.length+
        '\nValor base total: '+money(selectedTotal)+
        '\nLote: '+(loteId?(lotes.find(l=>String(l.id)===loteId)?.codigo||loteId):loteCodigo.trim())+
        '\nLa incorporación creará animales activos y actualizará el conteo del lote de forma atómica. '+ 
        (tipo==='COMPRA'?'Se registrará también una compra de animales.':'No se generará una compra contable.')+
        '\nLa operación no puede revertirse desde esta pantalla.',
      confirmLabel:'Guardar '+selected.length+' animales',
    })
  }
  async function execute(){
    if(busy||!supabase)return
    setBusy(true);setError('')
    try{
      // Revalidar los DIIO antes de escribir; la base mantiene también UNIQUE(diio).
      const diios=selected.map(r=>r.diio)
      const {data:duplicates,error:lookupError}=await supabase.from('animal').select('diio').in('diio',diios)
      if(lookupError)throw Error('No fue posible verificar DIIO existentes: '+lookupError.message)
      if((duplicates??[]).length)throw Error('Hay DIIO ya registrados: '+(duplicates??[]).map(x=>x.diio).slice(0,5).join(', ')+'. Actualiza la exportación.')
      const params={
        p_tipo:tipo,p_fecha:fecha,
        p_lote_id:loteId?Number(loteId):null,p_lote_codigo:loteId?'':loteCodigo.trim(),
        p_proveedor_id:tipo==='COMPRA'&&proveedorId?Number(proveedorId):null,
        p_documento:documento.trim()||null,
        p_animales:selected.map(r=>({
          diio:r.diio,sexo:r.sexo,fecha_nacimiento:r.fechaNacimiento,
          raza_id:mapRaza[r.raza]==='AUTO'?null:Number(mapRaza[r.raza]),
          raza_nombre:r.raza,
          raza_sipec:r.raza,categoria_sipec:r.categoria,
          establecimiento_sipec:r.establecimiento,
          valor_base:parseClpAmount(r.precio),
        })),
      }
      const result=await supabase.rpc('sgic_incorporar_desde_sipec',params)
      if(result.error)throw Error(result.error.message)
      setConfirm(null)
      onSuccess(Number(result.data))
    }catch(e){setConfirm(null);setError((e instanceof Error?e.message:'No se pudo incorporar el ganado')+
      '. No repitas la operación sin comprobar los DIIO.')}
    finally{setBusy(false)}
  }

  return <section className="space-y-5 rounded-xl border border-emerald-200 bg-emerald-50/30 p-4 sm:p-6">
    <div className="flex flex-wrap items-start justify-between gap-2">
      <div><h3 className="text-lg font-semibold text-slate-900">Incorporar animales seleccionados</h3>
        <p className="mt-1 text-sm text-slate-600">Completa lote, fecha, raza y valor de cada animal. Después pulsa «Paso 3: revisar y guardar animales» y confirma el resumen.</p></div>
      <button type="button" onClick={onCancel} disabled={busy} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 disabled:opacity-60">Volver a comparación</button>
    </div>
    {loading&&<p role="status" className="text-sm text-slate-600">Cargando lotes, razas y proveedores…</p>}
    {error&&<div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div>}
    {!loading&&<>
      <div className="grid gap-4 md:grid-cols-2">
        <label className="space-y-1 text-sm font-semibold">Tipo de ingreso
          <select value={tipo} onChange={e=>setTipo(e.target.value as IncomeType)}
            className="block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-normal">
            {Object.entries(labels).map(([id,label])=><option key={id} value={id}>{label}</option>)}
          </select>
        </label>
        <label className="space-y-1 text-sm font-semibold">Fecha de incorporación
          <input type="date" value={fecha} onChange={e=>setFecha(e.target.value)}
            className="block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-normal"/>
        </label>
        <label className="space-y-1 text-sm font-semibold">Lote existente
          <select value={loteId} onChange={e=>{setLoteId(e.target.value);if(e.target.value)setLoteCodigo('')}}
            className="block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-normal">
            <option value="">Crear uno nuevo</option>
            {lotes.map(l=><option key={l.id} value={l.id}>{l.codigo}</option>)}
          </select>
        </label>
        {!loteId&&<label className="space-y-1 text-sm font-semibold">Código del nuevo lote
          <input maxLength={30} value={loteCodigo} onChange={e=>setLoteCodigo(e.target.value)} placeholder="Ej. LOTE-OCT-2026"
            className="block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-normal"/>
        </label>}
        {tipo==='COMPRA'&&<label className="space-y-1 text-sm font-semibold">Proveedor (opcional)
          <select value={proveedorId} onChange={e=>setProveedorId(e.target.value)}
            className="block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-normal">
            <option value="">No especificado</option>
            {proveedores.map(p=><option key={p.id} value={p.id}>{p.nombre}</option>)}
          </select>
        </label>}
        <label className="space-y-1 text-sm font-semibold">Documento de referencia (opcional)
          <input maxLength={140} value={documento} onChange={e=>setDocumento(e.target.value)} placeholder="FMA, folio interno o documento"
            className="block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-normal"/>
        </label>
      </div>
      <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">
        {tipo==='COMPRA'?'Se registrarán animales, precios de compra y compra de ganado.':
          tipo==='INICIAL'?'Registra existencias iniciales con su valorización base sin generar una compra.':
          tipo==='TRASLADO'?'El costo base debe ser el valor histórico transferido; no se reconoce una nueva compra.':
          'Se incorpora el animal con el costo base asignado de acuerdo con el criterio de valorización del predio.'}
        {' '}Para no perder el valor del activo, cada animal debe tener un monto positivo antes de confirmar.
      </div>
      <div>
        <h4 className="font-semibold text-slate-900">Homologación de razas</h4>
        <p className="mt-1 text-xs text-slate-600">Asigna una raza existente o crea automáticamente la raza SAG al confirmar; las nuevas razas se crean dentro de la misma transacción.</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {distinctRazas.map(name=><label key={name} className="block rounded-lg border border-slate-200 bg-white p-3 text-xs font-semibold">
            <span className="block truncate" title={name}>{name}</span>
            <select value={mapRaza[name]||'AUTO'} onChange={e=>setMapRaza(old=>({...old,[name]:e.target.value}))}
              className="mt-2 w-full rounded-lg border border-slate-300 px-2 py-2 text-sm font-normal">
              <option value="AUTO">Crear raza SAG: {name}</option>
              {razas.map(r=><option key={r.id} value={r.id}>{r.nombre}</option>)}
            </select>
          </label>)}
        </div>
      </div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h4 className="font-semibold text-slate-900">Tabla de valorización</h4>
          <p className="text-xs text-slate-500">Escribe 180000 o 180.000; el punto separa miles y la coma indica decimales.</p>
          <p className="text-xs text-slate-600">Seleccionados: {selected.length} / {rows.length} · Sin valor válido: {missing.length}</p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <label className="text-xs font-semibold">Precio común (CLP)
            <input type="text" inputMode="decimal" autoComplete="off" value={bulk} onChange={e=>setBulk(e.target.value)}
              className="mt-1 block w-36 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"/>
          </label>
          <button type="button" onClick={applyBulk} className="rounded-lg border border-emerald-300 bg-emerald-100 px-3 py-2 text-sm font-semibold text-emerald-900">Aplicar a seleccionados</button>
        </div>
      </div>
      <details className="rounded-lg border border-slate-200 bg-white p-3">
        <summary className="cursor-pointer text-sm font-semibold text-slate-800">Pegar columna de precios desde Excel</summary>
        <p className="mt-2 text-xs text-slate-600">Copia una columna de importes CLP (por ejemplo 180000 o 180.000). Los valores se asignan en orden a los DIIO seleccionados; deben coincidir las cantidades.</p>
        <textarea value={pastedPrices} onChange={e=>setPastedPrices(e.target.value)} rows={4}
          aria-label="Columna de precios por DIIO" placeholder={'180000\n195000\n175000'}
          className="mt-2 w-full rounded-lg border border-slate-300 p-2 font-mono text-sm"/>
        <button type="button" onClick={applyPastedPrices} className="mt-2 rounded-lg bg-slate-800 px-4 py-2 text-sm font-semibold text-white">Aplicar precios de columna</button>
      </details>
      <div className="max-h-[480px] overflow-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="sticky top-0 z-10 bg-slate-100 text-xs uppercase text-slate-600">
            <tr><th className="p-3">
              <input type="checkbox" aria-label="Seleccionar todos los animales" checked={rows.every(r=>r.selected)}
                onChange={e=>setRows(old=>old.map(r=>({...r,selected:e.target.checked})))}/>
            </th><th className="p-3">DIIO</th><th className="p-3">Raza SAG</th>
              <th className="p-3">Sexo</th><th className="p-3">Nacimiento</th>
              <th className="p-3">Valor base (CLP)</th></tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map(r=><tr key={r.diio} className={r.selected?'':'opacity-50'}>
              <td className="p-3"><input type="checkbox" aria-label={'Seleccionar DIIO '+r.diio}
                checked={r.selected} onChange={e=>updateRow(r.diio,{selected:e.target.checked})}/></td>
              <td className="p-3 font-mono font-semibold">{r.diio}</td>
              <td className="p-3">{r.raza}</td>
              <td className="p-3">{r.sexo}</td>
              <td className="p-3">{r.fechaNacimiento||'—'}</td>
              <td className="p-3"><input type="text" inputMode="decimal" autoComplete="off"
                aria-label={'Valor base DIIO '+r.diio} disabled={!r.selected}
                value={r.precio} onChange={e=>updateRow(r.diio,{precio:e.target.value})}
                className={'w-36 rounded-lg border p-2 disabled:bg-slate-100 '+(r.selected&&!validPrice(r.precio)?'border-amber-400':'border-slate-300')}/></td>
            </tr>)}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-4">
        <div><p className="text-xs text-slate-600">Valor económico de {selected.length} animales</p>
          <p className="text-xl font-bold tabular-nums">{money(selectedTotal)}</p></div>
        <button type="button" onClick={prepare} disabled={busy||Boolean(error&&error.startsWith('No se pudieron'))}
          className="rounded-xl bg-emerald-800 px-5 py-3 text-sm font-bold text-white hover:bg-emerald-900 disabled:opacity-50">
          Paso 3: revisar y guardar animales
        </button>
      </div>
    </>}
    <OperationConfirmDialog details={confirm} busy={busy} onCancel={()=>setConfirm(null)} onConfirm={()=>{void execute()}}/>
  </section>
}
