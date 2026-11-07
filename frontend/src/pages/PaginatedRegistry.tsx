import { useEffect, useState } from 'react'
import { supabase } from '../api/supabase'
import { Pagination } from '../components/Pagination'
import { TableScroll } from '../components/TableScroll'
import { StockPresentations } from '../components/StockPresentations'
import type { PresentacionStock } from '../utils/presentationStock'
import { PAGE_SIZE,pageRange } from '../utils/pagination'
import type { AnimalRecord } from './AnimalCard'

type AnimalFilter='TODOS'|'ACTIVO'|'FALLECIDO'|'VENDIDO'
type AnimalRow=AnimalRecord & {raza_nombre:string|null;lote_codigo:string|null}
type Producto={
  id:number;nombre:string;stock_actual:number;stock_minimo:number;costo_promedio:number
  tipo_insumo:string;unidad_medida:{codigo:string}|null
}
type Props={
  type:'animales'|'inventario';search:string;filter:AnimalFilter;
  onFilter:(f:AnimalFilter)=>void;onOpenAnimal:(id:number)=>void;
  revision:number;presentaciones:PresentacionStock[]
}
const format=(n:number)=>new Intl.NumberFormat('es-CL',{maximumFractionDigits:3}).format(n)
const money=(n:number)=>new Intl.NumberFormat('es-CL',{style:'currency',currency:'CLP',maximumFractionDigits:0}).format(n)
const states:AnimalFilter[]=['TODOS','ACTIVO','FALLECIDO','VENDIDO']
const labels:Record<AnimalFilter,string>={TODOS:'Todos',ACTIVO:'Activos',FALLECIDO:'Fallecidos',VENDIDO:'Vendidos'}
const animalColumns='id,diio,lote_id,raza_id,sexo,estado,precio_adquisicion,peso_ingreso_kg,fecha_nacimiento,fecha_adquisicion,edad_aproximada_dias,observaciones,raza_nombre,lote_codigo'

function Status({estado}:{estado:string}){
  return <span className={'rounded-full px-2.5 py-1 text-xs font-semibold '+(estado==='ACTIVO'?'bg-emerald-50 text-emerald-800':estado==='FALLECIDO'?'bg-rose-50 text-rose-800':'bg-slate-100 text-slate-700')}>{estado}</span>
}

/** Listados con paginación real: cada página y contador se consultan en PostgreSQL. */
export function PaginatedRegistry({type,search,filter,onFilter,onOpenAnimal,revision,presentaciones}:Props){
  const [page,setPage]=useState(0)
  const [term,setTerm]=useState(search.trim())
  const [animals,setAnimals]=useState<AnimalRow[]>([])
  const [products,setProducts]=useState<Producto[]>([])
  const [count,setCount]=useState(0)
  const [counts,setCounts]=useState<Record<AnimalFilter,number>>({TODOS:0,ACTIVO:0,FALLECIDO:0,VENDIDO:0})
  const [loading,setLoading]=useState(true)
  const [error,setError]=useState('')
  const [retry,setRetry]=useState(0)
  const [mostrarDetalle,setMostrarDetalle]=useState(false)

  useEffect(()=>{
    const id=window.setTimeout(()=>setTerm(search.trim().slice(0,120)),250)
    return ()=>window.clearTimeout(id)
  },[search])
  useEffect(()=>{setPage(0)},[term,filter,type])

  useEffect(()=>{
    if(!supabase)return
    const db=supabase
    let active=true
    async function loadCounts(){
      if(type!=='animales'||!supabase)return
      const results=await Promise.all(states.map(async state=>{
        let q=db.from('sgic_animales_busqueda').select('id',{head:true,count:'exact'})
        if(state!=='TODOS')q=q.eq('estado',state)
        return q
      }))
      if(!active)return
      if(results.every(r=>!r.error)){
        setCounts(Object.fromEntries(states.map((state,i)=>[state,results[i].count??0])) as Record<AnimalFilter,number>)
      }
    }
    void loadCounts()
    return ()=>{active=false}
  },[type,revision,retry])

  useEffect(()=>{
    if(!supabase)return
    let active=true
    async function load(){
      if(!supabase)return
      setLoading(true);setError('')
      const {from,to}=pageRange(page)
      try{
        if(type==='animales'){
          let query=supabase.from('sgic_animales_busqueda')
            .select(animalColumns,{count:'exact'}).order('diio',{ascending:true}).order('id',{ascending:true}).range(from,to)
          if(filter!=='TODOS')query=query.eq('estado',filter)
          if(term)query=query.ilike('busqueda','%'+term+'%')
          const {data,count:total,error:failure}=await query
          if(failure)throw new Error(failure.message)
          if(!active)return
          if((total??0)<=from&&page>0){setPage(Math.max(0,Math.ceil((total??0)/PAGE_SIZE)-1));return}
          setAnimals((data??[]) as AnimalRow[])
          setCount(total??0)
        }else{
          let query=supabase.from('producto')
            .select('id,nombre,stock_actual,stock_minimo,costo_promedio,tipo_insumo,unidad_medida(codigo)',{count:'exact'})
            .order('nombre',{ascending:true}).order('id',{ascending:true}).range(from,to)
          if(term)query=query.ilike('nombre','%'+term+'%')
          const {data,count:total,error:failure}=await query
          if(failure)throw new Error(failure.message)
          if(!active)return
          if((total??0)<=from&&page>0){setPage(Math.max(0,Math.ceil((total??0)/PAGE_SIZE)-1));return}
          setProducts((data??[]) as unknown as Producto[])
          setCount(total??0)
        }
      }catch(e){
        if(active){setError(e instanceof Error?e.message:'No se pudieron cargar los registros.');setCount(0)}
      }finally{if(active)setLoading(false)}
    }
    void load()
    return ()=>{active=false}
  },[type,term,filter,page,revision,retry])

  return <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
      <h2 className="font-semibold">{type==='animales'?'Listado':'Existencias'}</h2>
      <div className="flex items-center gap-3">
        <span role="status" aria-live="polite" className="text-xs tabular-nums text-slate-600">
          {loading?'Cargando…':error?'Error':format(count)+' resultados'}
        </span>
        <button type="button" aria-pressed={mostrarDetalle} onClick={()=>setMostrarDetalle(x=>!x)}
          className="hidden rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 md:block">
          {mostrarDetalle?'Vista simple':'Más columnas'}
        </button>
      </div>
    </div>
    {type==='animales'&&<div className="flex flex-wrap gap-2 border-b border-slate-100 px-4 py-3" aria-label="Filtrar animales por estado">
      {states.map(state=><button key={state} type="button" aria-pressed={filter===state}
        onClick={()=>onFilter(state)}
        className={'min-h-10 rounded-lg border px-3 py-2 text-xs font-semibold '+(filter===state?'border-emerald-900 bg-emerald-900 text-white':'border-slate-200 bg-slate-50 text-slate-700')}>
        {labels[state]} ({format(counts[state])})
      </button>)}
    </div>}
    {error&&<div role="alert" className="px-4 py-5 text-sm text-rose-800">
      No fue posible cargar el listado: {error}
      <button type="button" onClick={()=>setRetry(x=>x+1)} className="ml-3 rounded-lg border border-rose-300 px-3 py-2 font-medium">Reintentar</button>
    </div>}
    {loading&&!error&&<p role="status" className="px-4 py-6 text-sm text-slate-500">Consultando registros…</p>}
    {!loading&&!error&&count===0&&<p className="px-4 py-7 text-sm text-slate-500">No se encontraron registros.</p>}
    {!loading&&!error&&type==='animales'&&animals.length>0&&<>
      <div className="divide-y divide-slate-100 md:hidden" aria-label="Animales encontrados">
        {animals.map(a=><article key={a.id} className="space-y-2 px-4 py-3">
          <div className="flex items-center justify-between gap-2">
            <button type="button" onClick={()=>onOpenAnimal(a.id)}
              aria-label={'Abrir ficha DIIO '+a.diio}
              className="min-h-11 text-left text-sm font-semibold text-emerald-800 underline underline-offset-4">{a.diio}</button>
            <Status estado={a.estado}/>
          </div>
          <div className="flex flex-wrap gap-x-3 gap-y-1 text-sm text-slate-700">
            <span>{a.lote_codigo??'Sin lote'}</span>
            <span className="text-slate-500">{a.raza_nombre??'Sin raza'}</span>
          </div>
          <details className="text-xs text-slate-600"><summary className="cursor-pointer py-1">Más datos</summary>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <p>Sexo: {a.sexo}</p><p>Peso inicial: {a.peso_ingreso_kg!=null?format(a.peso_ingreso_kg)+' kg':'—'}</p>
              <p className="col-span-2">Valor base: {money(a.precio_adquisicion)}</p>
            </div>
          </details>
        </article>)}
      </div>
      <div className="hidden md:block">
        <TableScroll><table className="min-w-full text-left text-sm">
          <thead><tr>{['DIIO / ficha','Raza','Lote',...(mostrarDetalle?['Sexo','Peso inicial','Valor base']:[]),'Estado'].map(label=><th scope="col" key={label} className="p-3 text-xs font-semibold text-slate-600">{label}</th>)}</tr></thead>
          <tbody className="divide-y divide-slate-100">{animals.map(a=><tr key={a.id} className="hover:bg-slate-50">
            <td className="p-3 font-semibold"><button type="button" onClick={()=>onOpenAnimal(a.id)} aria-label={'Abrir ficha DIIO '+a.diio}
              className="min-h-10 text-emerald-800 underline underline-offset-4">{a.diio}</button></td>
            <td className="p-3">{a.raza_nombre??'—'}</td><td className="p-3">{a.lote_codigo??'—'}</td>
            {mostrarDetalle&&<><td className="p-3">{a.sexo}</td><td className="p-3">{a.peso_ingreso_kg!=null?format(a.peso_ingreso_kg)+' kg':'—'}</td>
            <td className="p-3 tabular-nums">{money(a.precio_adquisicion)}</td></>}<td className="p-3"><Status estado={a.estado}/></td>
          </tr>)}</tbody>
        </table></TableScroll>
      </div>
    </>}
    {!loading&&!error&&type==='inventario'&&products.length>0&&<>
      <div className="divide-y divide-slate-100 md:hidden" aria-label="Productos de inventario">
        {products.map(p=>{
          const unit=p.unidad_medida?.codigo??'unidad'
          const low=Number(p.stock_actual)<=Number(p.stock_minimo)
          return <article key={p.id} className="space-y-2 px-4 py-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <strong className="min-w-0 break-words text-sm">{p.nombre}</strong>
              {low&&<span className="rounded-full bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-900">Stock bajo</span>}
            </div>
            <p className="text-xl font-semibold tabular-nums">{format(p.stock_actual)} <span className="text-xs font-normal text-slate-500">{unit}</span></p>
            <details className="text-xs text-slate-600"><summary className="cursor-pointer py-1">Costos y presentaciones</summary>
              <div className="mt-2 space-y-2">
                <p>Mínimo: {format(p.stock_minimo)} {unit}</p>
                <p>Costo promedio: {money(p.costo_promedio)}</p>
                <p>Valorización: {money(p.stock_actual*p.costo_promedio)}</p>
                <StockPresentations stock={Number(p.stock_actual)} unidad={unit} presentaciones={presentaciones.filter(x=>x.producto_id===p.id)}/>
              </div>
            </details>
          </article>
        })}
      </div>
      <div className="hidden md:block">
        <TableScroll><table className="min-w-full text-left text-sm">
          <thead><tr>{['Producto','Existencia','Estado',...(mostrarDetalle?['Mínimo','PMP','Valorización']:[])].map(label=><th scope="col" key={label} className="p-3 text-xs font-semibold text-slate-600">{label}</th>)}</tr></thead>
          <tbody className="divide-y divide-slate-100">{products.map(p=>{
            const unit=p.unidad_medida?.codigo??'unidad'
            return <tr key={p.id} className="hover:bg-slate-50">
              <td className="p-3 font-semibold">{p.nombre}</td>
              <td className="p-3"><div className="font-semibold tabular-nums">{format(p.stock_actual)} {unit}</div>
                {mostrarDetalle&&<StockPresentations stock={Number(p.stock_actual)} unidad={unit} presentaciones={presentaciones.filter(x=>x.producto_id===p.id)}/>}</td>
              <td className="p-3 text-xs">{Number(p.stock_actual)<=Number(p.stock_minimo)?<span className="font-semibold text-amber-800">Stock bajo</span>:<span className="text-slate-500">Normal</span>}</td>
              {mostrarDetalle&&<><td className="p-3">{format(p.stock_minimo)} {unit}</td>
                <td className="p-3 tabular-nums">{money(p.costo_promedio)}</td>
                <td className="p-3 tabular-nums">{money(p.stock_actual*p.costo_promedio)}</td></>}
            </tr>
          })}</tbody>
        </table></TableScroll>
      </div>
    </>}
    {!loading&&!error&&<Pagination page={page} total={count} onChange={setPage} label={type} disabled={loading}/>}
  </section>
}
