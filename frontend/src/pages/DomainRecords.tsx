import { useEffect, useState } from 'react'
import { supabase } from '../api/supabase'
import { Pagination } from '../components/Pagination'
import { PAGE_SIZE,pageRange } from '../utils/pagination'

type RecordModule='ventas'|'gastos'|'sanidad'
type Item=Record<string,unknown>
type Named={id:number;nombre?:string;diio?:string;codigo?:string}
const clp=(value:unknown)=>new Intl.NumberFormat('es-CL',{style:'currency',currency:'CLP',maximumFractionDigits:0}).format(Number(value||0))
const asText=(value:unknown)=>value==null?'—':String(value)
const config:Record<RecordModule,{table:string;title:string;description:string}>={
  ventas:{table:'venta',title:'Ventas registradas',description:'Ventas confirmadas, pendientes y anuladas. Las solicitudes se aprueban desde Solicitudes pendientes.'},
  gastos:{table:'gasto',title:'Gastos registrados',description:'Gastos generales y asociados a los lotes.'},
  sanidad:{table:'tratamiento',title:'Tratamientos realizados',description:'Historial de tratamientos aplicados a los animales.'},
}

export function DomainRecords({module,revision}:{module:RecordModule;revision:number}){
  const [rows,setRows]=useState<Item[]>([])
  const [names,setNames]=useState<{animales:Named[];productos:Named[];lotes:Named[]}>({animales:[],productos:[],lotes:[]})
  const [loading,setLoading]=useState(true)
  const [error,setError]=useState('')
  const [page,setPage]=useState(0)
  const [total,setTotal]=useState(0)
  useEffect(()=>setPage(0),[module])
  useEffect(()=>{
    let active=true
    async function load(){
      if(!supabase)return
      setLoading(true);setError('')
      try{
        const {from,to}=pageRange(page)
        const main=await supabase.from(config[module].table)
          .select('*',{count:'exact'}).order('fecha',{ascending:false}).order('id',{ascending:false}).range(from,to)
        if(main.error)throw new Error(main.error.message)
        if(!active)return
        const count=main.count??0
        if(from>=count&&page>0){setPage(Math.max(0,Math.ceil(count/PAGE_SIZE)-1));return}
        const records=(main.data??[]) as Item[]
        const ids=(key:string)=>[...new Set(records.map(item=>Number(item[key])).filter(x=>Number.isSafeInteger(x)&&x>0))]
        const getNames=async(table:string,columns:string,values:number[]):Promise<Named[]>=>{
          if(!values.length)return []
          const result=await supabase!.from(table).select(columns).in('id',values)
          if(result.error)throw new Error(result.error.message)
          return (result.data??[]) as unknown as Named[]
        }
        const [animals,products,lotes]=await Promise.all([
          getNames('animal','id,diio',ids('animal_id')),
          getNames('producto','id,nombre',ids('producto_id')),
          getNames('lote','id,codigo',ids('lote_id')),
        ])
        if(!active)return
        setRows(records);setTotal(count)
        setNames({animales:animals,productos:products,lotes})
      }catch(e){
        if(active){setError('No se pudieron consultar los registros: '+(e instanceof Error?e.message:'error de consulta'));setRows([])}
      }finally{if(active)setLoading(false)}
    }
    void load()
    return()=>{active=false}
  },[module,revision,page])

  const label=(source:'animales'|'productos'|'lotes',value:unknown)=>{
    const id=Number(value)
    const found=names[source].find(item=>item.id===id)
    return found?.diio??found?.nombre??found?.codigo??'#'+asText(value)
  }
  return <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
       <h2 className="text-sm font-semibold text-slate-900">{config[module].title}</h2>
       {!loading&&!error&&<span className="text-xs text-slate-500">{total} registrados</span>}
     </div>
    {loading&&<p className="px-6 py-8 text-sm text-slate-500">Cargando registros…</p>}
    {error&&<p role="alert" className="px-6 py-5 text-sm text-red-700">{error}</p>}
    {!loading&&!error&&rows.length===0&&<p className="px-6 py-8 text-sm text-slate-500">No hay registros en este módulo.</p>}
    {!loading&&!error&&rows.length>0&&<div className="divide-y divide-slate-100">
      {rows.map(item=><div key={String(item.id)} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 hover:bg-slate-50">
        {module==='ventas'&&<>
          <div><p className="font-semibold text-slate-900">Venta #{asText(item.id)} · {asText(item.comprador||'Sin comprador')}</p>
            <p className="mt-1 text-xs text-slate-500">{asText(item.fecha)} · Estado: <span className={item.estado==='CONFIRMADA'?'text-emerald-700':item.estado==='BORRADOR'?'text-amber-800':'text-slate-600'}>{item.estado==='BORRADOR'?'Pendiente':asText(item.estado)}</span></p></div>
          <strong>{clp(item.total_venta)}</strong>
        </>}
        {module==='gastos'&&<>
          <div><p className="font-semibold text-slate-900">{asText(item.nombre)}</p>
            <p className="mt-1 text-xs text-slate-500">{asText(item.fecha)} · {item.lote_id?label('lotes',item.lote_id):'Gasto general'}</p></div>
          <strong>{clp(item.monto)}</strong>
        </>}
        {module==='sanidad'&&<>
          <div><p className="font-semibold text-slate-900">{item.animal_id?label('animales',item.animal_id):'Lote '+label('lotes',item.lote_id)} · {label('productos',item.producto_id)}</p>
            <p className="mt-1 text-xs text-slate-500">{asText(item.fecha)} · {asText(item.motivo)}</p></div>
          <strong>{clp(item.costo_total)}</strong>
        </>}
      </div>)}
    </div>}
    {!loading&&!error&&<Pagination page={page} total={total} onChange={setPage} label={config[module].title}/>}
  </section>
}
