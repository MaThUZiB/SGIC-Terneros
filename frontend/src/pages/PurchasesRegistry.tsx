import { useEffect,useState } from 'react'
import { supabase } from '../api/supabase'
import { Pagination } from '../components/Pagination'
import { PAGE_SIZE,pageRange } from '../utils/pagination'

type CompraAnimal={id:number;fecha:string;total:number;proveedor_id:number|null}
type CompraInsumo={id:number;fecha:string;total:number;proveedor_id:number|null;estado:string;numero_documento:string|null}
type AnimalDetail={compra_id:number;animal_id:number}
type SupplyDetail={compra_id:number;producto_id:number;cantidad:number;cantidad_base:number;subtotal:number}
type Named={id:number;nombre?:string;diio?:string}
type Props={
  revision:number;providers:Named[];products:Named[];animals:Named[];
  onPending:()=>void
}
const money=(n:number)=>new Intl.NumberFormat('es-CL',{style:'currency',currency:'CLP',maximumFractionDigits:0}).format(n)
const number=(n:number)=>new Intl.NumberFormat('es-CL',{maximumFractionDigits:3}).format(n)
const date=(value:string)=>value.split('-').reverse().join('/')

/** Consultas de compras y sus detalles limitadas a la página visible. */
export function PurchasesRegistry({revision,providers,products,animals,onPending}:Props){
  const [type,setType]=useState<'animales'|'insumos'>('animales')
  const [page,setPage]=useState(0)
  const [total,setTotal]=useState(0)
  const [animalRows,setAnimalRows]=useState<CompraAnimal[]>([])
  const [supplyRows,setSupplyRows]=useState<CompraInsumo[]>([])
  const [animalDetails,setAnimalDetails]=useState<AnimalDetail[]>([])
  const [supplyDetails,setSupplyDetails]=useState<SupplyDetail[]>([])
  const [loading,setLoading]=useState(true)
  const [error,setError]=useState('')
  const [retry,setRetry]=useState(0)
  useEffect(()=>setPage(0),[type])
  useEffect(()=>{
    if(!supabase)return
    let active=true
    async function load(){
      if(!supabase)return
      setLoading(true);setError('')
      const {from,to}=pageRange(page)
      try{
        const animal=type==='animales'
        const response=animal
          ?await supabase.from('compra_animal').select('id,fecha,total,proveedor_id',{count:'exact'}).order('fecha',{ascending:false}).order('id',{ascending:false}).range(from,to)
          :await supabase.from('compra_insumo').select('id,fecha,total,proveedor_id,estado,numero_documento',{count:'exact'}).order('fecha',{ascending:false}).order('id',{ascending:false}).range(from,to)
        if(response.error)throw new Error(response.error.message)
        if(!active)return
        const count=response.count??0
        if(from>=count&&page>0){setPage(Math.max(0,Math.ceil(count/PAGE_SIZE)-1));return}
        const ids=(response.data??[]).map(row=>row.id)
        if(animal){
          let details:AnimalDetail[]=[]
          if(ids.length){
            const d=await supabase.from('detalle_compra_animal').select('compra_id,animal_id').in('compra_id',ids)
            if(d.error)throw new Error(d.error.message)
            details=(d.data??[]) as AnimalDetail[]
          }
          if(!active)return
          setAnimalRows((response.data??[]) as CompraAnimal[])
          setAnimalDetails(details)
        }else{
          let details:SupplyDetail[]=[]
          if(ids.length){
            const d=await supabase.from('detalle_compra_insumo').select('compra_id,producto_id,cantidad,cantidad_base,subtotal').in('compra_id',ids)
            if(d.error)throw new Error(d.error.message)
            details=(d.data??[]) as SupplyDetail[]
          }
          if(!active)return
          setSupplyRows((response.data??[]) as CompraInsumo[])
          setSupplyDetails(details)
        }
        setTotal(count)
      }catch(e){if(active)setError(e instanceof Error?e.message:'No se pudieron consultar las compras.')}
      finally{if(active)setLoading(false)}
    }
    void load()
    return ()=>{active=false}
  },[type,page,revision,retry])

  const provider=(id:number|null)=>providers.find(p=>p.id===id)?.nombre??'Proveedor no especificado'
  const product=(id:number)=>products.find(p=>p.id===id)?.nombre??'Insumo #'+id
  const diio=(id:number)=>animals.find(a=>a.id===id)?.diio??'DIIO #'+id

  return <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
    <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
      <h2 className="font-semibold">Compras</h2>
      <div role="group" aria-label="Tipo de compras" className="flex gap-1 rounded-lg bg-slate-100 p-1">
        <button type="button" aria-pressed={type==='animales'} onClick={()=>setType('animales')}
          className={'rounded-md px-3 py-2 text-sm font-medium '+(type==='animales'?'bg-white text-emerald-900 shadow-sm':'text-slate-600')}>Animales</button>
        <button type="button" aria-pressed={type==='insumos'} onClick={()=>setType('insumos')}
          className={'rounded-md px-3 py-2 text-sm font-medium '+(type==='insumos'?'bg-white text-emerald-900 shadow-sm':'text-slate-600')}>Insumos</button>
      </div>
    </header>
    {error&&<div role="alert" className="px-4 py-4 text-sm text-rose-800">No se pudieron cargar las compras: {error}
      <button type="button" onClick={()=>setRetry(x=>x+1)} className="ml-2 rounded-lg border border-rose-300 px-3 py-2">Reintentar</button>
    </div>}
    {loading&&!error&&<p role="status" className="px-4 py-6 text-sm text-slate-500">Cargando compras…</p>}
    {!loading&&!error&&total===0&&<p className="px-4 py-7 text-sm text-slate-500">Sin compras registradas.</p>}
    {!loading&&!error&&<div className="divide-y divide-slate-100">
      {type==='animales'&&animalRows.map(c=>{
        const list=animalDetails.filter(d=>d.compra_id===c.id)
        return <article key={c.id} className="space-y-2 px-4 py-3">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div><h3 className="text-sm font-semibold">Compra de animales #{c.id}</h3>
              <p className="mt-1 text-xs text-slate-500">{date(c.fecha)} · {provider(c.proveedor_id)}</p></div>
            <strong className="tabular-nums">{money(c.total)}</strong>
          </div>
          <details className="text-xs text-slate-600"><summary className="cursor-pointer py-1">{list.length} animales · Ver DIIO</summary>
            <p className="mt-2 break-words leading-5">{list.map(d=>diio(d.animal_id)).join(', ')||'Sin detalles asociados'}</p>
          </details>
        </article>
      })}
      {type==='insumos'&&supplyRows.map(c=>{
        const list=supplyDetails.filter(d=>d.compra_id===c.id)
        return <article key={c.id} className="space-y-2 px-4 py-3">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div><h3 className="text-sm font-semibold">Compra de insumos #{c.id}</h3>
              <p className="mt-1 text-xs text-slate-500">{date(c.fecha)} · {provider(c.proveedor_id)}</p></div>
            <strong className="tabular-nums">{money(c.total)}</strong>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-xs">
            <span className={c.estado==='BORRADOR'?'font-medium text-amber-800':'text-slate-500'}>{c.estado==='BORRADOR'?'Pendiente':c.estado}</span>
            {c.numero_documento&&<span className="text-slate-500">Documento {c.numero_documento}</span>}
            {c.estado==='BORRADOR'&&<button type="button" onClick={onPending} className="min-h-10 font-semibold text-amber-800 underline underline-offset-4">Revisar solicitud</button>}
          </div>
          <details className="text-xs text-slate-600"><summary className="cursor-pointer py-1">{list.length} productos · Ver detalle</summary>
            <div className="mt-2 space-y-2">{list.length?list.map((d,i)=>
              <p key={i}>{product(d.producto_id)} · {number(d.cantidad)} presentaciones / {number(d.cantidad_base)} unidades · {money(d.subtotal)}</p>
            ):<p>Sin detalles asociados</p>}</div>
          </details>
        </article>
      })}
    </div>}
    {!loading&&!error&&<Pagination page={page} total={total} onChange={setPage} label={'compras de '+type}/>}
  </section>
}
