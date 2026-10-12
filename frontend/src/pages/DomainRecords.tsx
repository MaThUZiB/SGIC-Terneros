import { useEffect, useState } from 'react'
import { supabase } from '../api/supabase'

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
  useEffect(()=>{
    let active=true
    async function load(){
      if(!supabase)return
      setLoading(true)
      const [main,animal,product,lote]=await Promise.all([
        supabase.from(config[module].table).select('*').order('fecha',{ascending:false}).limit(200),
        supabase.from('animal').select('id,diio').limit(1000),
        supabase.from('producto').select('id,nombre').limit(500),
        supabase.from('lote').select('id,codigo').limit(500),
      ])
      if(!active)return
      const failure=[main.error,animal.error,product.error,lote.error].find(Boolean)
      if(failure){setError('No se pudieron cargar los registros: '+failure.message)}
      else{
        setError('')
        setRows((main.data??[]) as Item[])
        setNames({
          animales:(animal.data??[]) as Named[],productos:(product.data??[]) as Named[],lotes:(lote.data??[]) as Named[],
        })
      }
      setLoading(false)
    }
    void load()
    return()=>{active=false}
  },[module,revision])

  const label=(source:'animales'|'productos'|'lotes',value:unknown)=>{
    const id=Number(value)
    const found=names[source].find(item=>item.id===id)
    return found?.diio??found?.nombre??found?.codigo??'#'+asText(value)
  }
  return <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
    <div className="border-b border-slate-100 px-5 py-5 sm:px-6">
      <h2 className="font-semibold text-slate-900">{config[module].title}</h2>
      <p className="mt-1 text-sm text-slate-500">{config[module].description}</p>
    </div>
    {loading&&<p className="px-6 py-8 text-sm text-slate-500">Cargando registros…</p>}
    {error&&<p role="alert" className="px-6 py-5 text-sm text-red-700">{error}</p>}
    {!loading&&!error&&rows.length===0&&<p className="px-6 py-8 text-sm text-slate-500">No hay registros en este módulo.</p>}
    {!loading&&!error&&rows.length>0&&<div className="divide-y divide-slate-100">
      {rows.map(item=><div key={String(item.id)} className="flex flex-wrap items-center justify-between gap-4 px-5 py-4 hover:bg-slate-50 sm:px-6">
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
          <div><p className="font-semibold text-slate-900">{label('animales',item.animal_id)} · {label('productos',item.producto_id)}</p>
            <p className="mt-1 text-xs text-slate-500">{asText(item.fecha)} · {asText(item.motivo)}</p></div>
          <strong>{clp(item.costo_total)}</strong>
        </>}
      </div>)}
    </div>}
  </section>
}
