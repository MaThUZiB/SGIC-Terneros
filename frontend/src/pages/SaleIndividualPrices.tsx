import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../api/supabase'
import { OperationConfirmDialog, type ConfirmDetails } from '../components/OperationConfirmDialog'

type Animal = {id:number;diio:string;lote_id:number;precio_adquisicion:number}
type Lote = {id:number;codigo:string}
type PriceMap = Record<number,string>
const money=(v:number)=>new Intl.NumberFormat('es-CL',{style:'currency',currency:'CLP',maximumFractionDigits:2}).format(v)
const dateNow=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`}
function validPrice(v:string){const n=Number(v);return v.trim()!=='' && Number.isFinite(n) && n>0 && n<=9999999999.99 && /^\d+(?:\.\d{1,2})?$/.test(v.trim())}
const PAGE=500
export function SaleIndividualPrices({onClose,onChanged}:{
  onClose:()=>void;onChanged:()=>void
}){
  const [animales,setAnimales]=useState<Animal[]>([])
  const [lotes,setLotes]=useState<Lote[]>([])
  const [selected,setSelected]=useState<number[]>([])
  const [prices,setPrices]=useState<PriceMap>({})
  const [bulk,setBulk]=useState('')
  const [search,setSearch]=useState('')
  const [comprador,setComprador]=useState('')
  const [fecha,setFecha]=useState(dateNow)
  const [loading,setLoading]=useState(true)
  const [busy,setBusy]=useState(false)
  const [error,setError]=useState('')
  const [ok,setOk]=useState('')
  const [confirm,setConfirm]=useState<ConfirmDetails|null>(null)
  async function load(){
    if(!supabase){setError('Supabase no está configurado.');setLoading(false);return}
    setLoading(true)
    try{
      const l=await supabase.from('lote').select('id,codigo').order('codigo').limit(500)
      if(l.error)throw Error(l.error.message)
      const all:Animal[]=[]
      for(let i=0;i<25000;i+=PAGE){
        const r=await supabase.from('animal').select('id,diio,lote_id,precio_adquisicion')
          .eq('estado','ACTIVO').order('id').range(i,i+PAGE-1)
        if(r.error)throw Error(r.error.message)
        all.push(...(r.data??[]) as Animal[])
        if((r.data??[]).length<PAGE)break
        if(i===24500)throw Error('Se superó el límite de consulta de animales activos.')
      }
      setAnimales(all);setLotes((l.data??[]) as Lote[])
    }catch(e){setError('No fue posible cargar animales activos: '+(e instanceof Error?e.message:'error'))}
    finally{setLoading(false)}
  }
  useEffect(()=>{void load()},[])

  const selectedSet=useMemo(()=>new Set(selected),[selected])
  const selectedAnimals=useMemo(()=>animales.filter(a=>selectedSet.has(a.id)),[animales,selectedSet])
  const total=selectedAnimals.reduce((sum,a)=>sum+(validPrice(prices[a.id]??'')?Math.round(Number(prices[a.id])*100):0),0)/100
  const missing=selectedAnimals.filter(a=>!validPrice(prices[a.id]??''))
  const shown=animales.filter(a=>a.diio.toLowerCase().includes(search.trim().toLowerCase())||
    (lotes.find(l=>l.id===a.lote_id)?.codigo??'').toLowerCase().includes(search.trim().toLowerCase()))
  const selectVisible=shown.slice(0,500).map(a=>a.id)
  function applyAll(){
    if(!validPrice(bulk)){setError('Introduce un valor de venta válido, positivo y con máximo dos decimales.');return}
    setPrices(prev=>({...prev,...Object.fromEntries(selected.map(id=>[id,bulk]))}))
    setError('')
  }
  function prepare(){
    setError('');setOk('')
    if(!selected.length){setError('Selecciona al menos un DIIO activo.');return}
    if(selected.length>200){setError('La venta admite hasta 200 animales por operación.');return}
    if(missing.length){setError('Asigna un precio de venta válido para cada uno de los '+missing.length+' DIIO pendientes.');return}
    if(!/^\d{4}-\d{2}-\d{2}$/.test(fecha)){setError('Selecciona una fecha válida.');return}
    setConfirm({
      title:'Confirmar venta con precios individuales',
      description:'Animales: '+selected.length+'\nIngreso total: '+money(total)+
        '\nLos importes por DIIO quedarán guardados; se distribuirán por lote para calcular la utilidad. '+
        'Los animales pasarán a VENDIDO. Esta operación no se puede revertir desde la aplicación.',
      confirmLabel:'Confirmar venta',danger:true,
    })
  }
  async function execute(){
    if(!supabase||busy)return
    setBusy(true);setError('')
    try{
      const result=await supabase.rpc('sgic_venta_precios_individuales',{
        p_animales:selectedAnimals.map(a=>({animal_id:a.id,precio_venta:Number(prices[a.id])})),
        p_comprador:comprador,p_fecha:fecha,
      })
      if(result.error)throw Error(result.error.message)
      const ventaId=Number(result.data)
      setConfirm(null);setOk('Venta #'+ventaId+' confirmada. Total: '+money(total)+'. Los precios por DIIO quedaron registrados.')
      setSelected([]);setPrices({});onChanged()
      await load()
    }catch(e){setConfirm(null);setError((e instanceof Error?e.message:'La venta no pudo completarse')+
      '. Verifica la lista de vendidos antes de volver a confirmar.')}
    finally{setBusy(false)}
  }
  return <section aria-label="Venta con precios individuales" className="space-y-5 rounded-2xl border border-emerald-200 bg-white p-5 shadow-sm sm:p-7">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><h2 className="text-xl font-semibold">Venta con precios por DIIO</h2>
        <p className="mt-1 text-sm text-slate-600">Selecciona animales activos y asigna un precio de venta a cada uno.</p></div>
      <button type="button" onClick={onClose} disabled={busy} className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold disabled:opacity-50">Cerrar</button>
    </div>
    {error&&<p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    {ok&&<p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{ok}</p>}
    {loading?<p role="status" className="text-sm text-slate-500">Consultando animales disponibles…</p>:<>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm font-semibold">Comprador (opcional)
          <input value={comprador} onChange={e=>setComprador(e.target.value)} maxLength={150}
            className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 font-normal"/>
        </label>
        <label className="text-sm font-semibold">Fecha de venta
          <input type="date" value={fecha} onChange={e=>setFecha(e.target.value)}
            className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 font-normal"/>
        </label>
      </div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <label className="text-sm font-semibold">Buscar DIIO o lote
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="DIIO o lote"
            className="mt-1 block w-56 rounded-lg border border-slate-300 px-3 py-2 font-normal"/>
        </label>
        <div className="flex flex-wrap items-end gap-2">
          <label className="text-xs font-semibold">Precio común CLP
            <input type="number" min="0.01" step="0.01" value={bulk} onChange={e=>setBulk(e.target.value)}
              className="mt-1 block w-32 rounded-lg border border-slate-300 px-3 py-2 text-sm"/>
          </label>
          <button type="button" onClick={applyAll} className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-900">Aplicar a seleccionados</button>
        </div>
      </div>
      <p className="text-xs text-slate-600">Seleccionados: {selected.length} · Sin precio: {missing.length} · Activos disponibles: {animales.length}</p>
      <div className="max-h-[450px] overflow-auto rounded-xl border border-slate-200">
        <table className="w-full min-w-[740px] text-left text-sm">
          <thead className="sticky top-0 bg-slate-100 text-xs uppercase text-slate-600">
            <tr><th className="p-3"><input type="checkbox" aria-label="Seleccionar animales visibles"
              checked={Boolean(selectVisible.length)&&selectVisible.every(id=>selectedSet.has(id))}
              onChange={e=>setSelected(prev=>e.target.checked?[...new Set([...prev,...selectVisible])]:prev.filter(id=>!selectVisible.includes(id)))} /></th>
              <th className="p-3">DIIO</th><th className="p-3">Lote</th>
              <th className="p-3">Costo base</th><th className="p-3">Precio venta</th></tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {shown.slice(0,500).map(a=><tr key={a.id}>
              <td className="p-3"><input type="checkbox" aria-label={'Seleccionar DIIO '+a.diio}
                checked={selectedSet.has(a.id)}
                onChange={e=>{setSelected(prev=>e.target.checked?[...prev,a.id]:prev.filter(id=>id!==a.id));setError('')}}/></td>
              <td className="p-3 font-mono font-semibold">{a.diio}</td>
              <td className="p-3">{lotes.find(l=>l.id===a.lote_id)?.codigo||a.lote_id}</td>
              <td className="p-3 tabular-nums">{money(a.precio_adquisicion)}</td>
              <td className="p-3"><input aria-label={'Precio de venta DIIO '+a.diio} type="number" min="0.01" step="0.01"
                disabled={!selectedSet.has(a.id)} value={prices[a.id]??''}
                onChange={e=>setPrices(prev=>({...prev,[a.id]:e.target.value}))}
                className={'w-40 rounded-lg border p-2 disabled:bg-slate-50 '+(selectedSet.has(a.id)&&!validPrice(prices[a.id]??'')?'border-amber-400':'border-slate-300')}/></td>
            </tr>)}
            {shown.length===0&&<tr><td colSpan={5} className="p-7 text-center text-slate-500">No hay animales para mostrar.</td></tr>}
          </tbody>
        </table>
      </div>
      {shown.length>500&&<p className="text-xs text-amber-800">Se muestran 500 coincidencias. Filtra por DIIO o lote para encontrar otros animales.</p>}
      <div className="flex flex-wrap items-center justify-between gap-4 border-t border-slate-200 pt-4">
        <div><p className="text-sm text-slate-600">Ingreso estimado de venta</p>
          <p className="text-2xl font-bold tabular-nums">{money(total)}</p></div>
        <button type="button" onClick={prepare} disabled={busy}
          className="rounded-xl bg-emerald-800 px-5 py-3 font-semibold text-white hover:bg-emerald-900 disabled:opacity-50">
          Revisar venta
        </button>
      </div>
      <p className="text-xs leading-5 text-slate-500">Esta venta guarda el precio individual por DIIO y calcula el resultado por lote. Las ventas tradicionales y los borradores existentes continúan disponibles.</p>
    </>}
    <OperationConfirmDialog details={confirm} onCancel={()=>setConfirm(null)} onConfirm={()=>{void execute()}} busy={busy}/>
  </section>
}
