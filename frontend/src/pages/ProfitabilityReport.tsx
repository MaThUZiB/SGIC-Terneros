import { TableScroll } from '../components/TableScroll'
import { useEffect, useState } from 'react'
import { supabase } from '../api/supabase'

type Row={
 lote_id:number; codigo:string; estado:string; cantidad_actual:number;
 adquisicion:number; alimentacion:number; sanidad:number; gastos_imputables:number;
 ingresos_venta:number; costo_reconocido:number; utilidad_ventas:number
}
const format=(v:number)=>new Intl.NumberFormat('es-CL',{style:'currency',currency:'CLP',maximumFractionDigits:0}).format(v)
const sum=(rows:Row[],key:keyof Row)=>rows.reduce((acc,x)=>acc+Number(x[key]||0),0)
function Stat({title,value,help}:{title:string;value:string;help:string}){
 return <section aria-label={title+': '+value+'. '+help} className="rounded-xl border border-slate-200 bg-white p-4">
   <p className="text-xs font-medium text-slate-500">{title}</p>
   <p className="mt-1 text-xl font-semibold tabular-nums tracking-tight">{value}</p>
 </section>
}
export function ProfitabilityReport({bajasPorLote={}}:{bajasPorLote?:Record<number,number>}){
 const [rows,setRows]=useState<Row[]>([])
 const [loading,setLoading]=useState(true)
 const [error,setError]=useState('')
 const [desglose,setDesglose]=useState(false)
 useEffect(()=>{
  let mounted=true
  async function run(){
   if(!supabase){if(mounted){setError('Sin conexión a Supabase');setLoading(false)}return}
   const result=await supabase.from('sgic_rentabilidad_lote').select('*').order('codigo').limit(500)
   if(mounted){
    if(result.error)setError('No fue posible calcular el reporte de rentabilidad.')
    else setRows((result.data||[]) as Row[])
    setLoading(false)
   }
  }
  void run()
  return ()=>{mounted=false}
 },[])
 const bajas=Object.values(bajasPorLote).reduce((s,n)=>s+n,0)
 const ingresos=sum(rows,'ingresos_venta')
 const costo=sum(rows,'costo_reconocido')
 const margen=ingresos>0?((ingresos-costo)/ingresos*100).toFixed(1):'0.0'
 return <div className="space-y-4">
  <header className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3">
   <h2 className="text-lg font-semibold">Rentabilidad</h2>
   <details className="text-xs text-slate-600"><summary className="cursor-pointer">Cómo se calcula</summary>
    <p className="mt-2 max-w-xl leading-5">La utilidad considera ventas confirmadas y costos reconocidos. Los gastos generales sin asignación no se distribuyen entre lotes; las bajas se presentan por separado.</p>
   </details>
  </header>
  {error&&<p role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-800">{error}</p>}
  {loading&&<p className="text-sm text-slate-500">Calculando cifras…</p>}
  {!loading&&!error&&<>
   <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
    <Stat title="Ingresos" value={format(ingresos)} help="Ventas confirmadas"/>
    <Stat title="Costo reconocido" value={format(costo)} help="Costo reconocido de ventas"/>
    <Stat title="Utilidad realizada" value={format(ingresos-costo)} help="Antes de gastos generales sin asignación"/>
    <Stat title="Margen" value={margen+' %'} help="Utilidad sobre ingresos confirmados"/>
   </div>
   <details className="rounded-xl border border-slate-200 bg-white px-4 py-3">
    <summary className="cursor-pointer text-sm font-medium">Otros indicadores</summary>
    <div className="mt-3 grid gap-3 sm:grid-cols-2">
     <Stat title="Bajas por fallecimiento" value={format(bajas)} help="Adquisición de animales fallecidos, ya incluida en costos históricos"/>
     <Stat title="Ventas menos bajas" value={format(ingresos-costo-bajas)} help="Indicador complementario; no equivale a utilidad completa por crianza"/>
    </div>
   </details>
   <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
     <h3 className="font-semibold">Lotes ({rows.length})</h3>
     <button type="button" onClick={()=>setDesglose(x=>!x)} aria-pressed={desglose}
      className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium hover:bg-slate-50">
      {desglose?'Vista simple':'Ver desglose completo'}
     </button>
    </div>
    {!rows.length?<p className="p-5 text-sm text-slate-500">Sin lotes registrados.</p>:<>
     <div className="divide-y divide-slate-100 md:hidden">
      {rows.map(r=><article key={r.lote_id} className="space-y-3 px-4 py-4">
       <div className="flex items-center justify-between gap-3">
        <h4 className="font-semibold">{r.codigo}</h4>
        <span className="text-xs text-slate-600">{r.cantidad_actual} animales</span>
       </div>
       <dl className="grid grid-cols-2 gap-3 text-sm">
        <div><dt className="text-xs text-slate-500">Costo acumulado</dt>
         <dd className="mt-1 font-medium tabular-nums">{format(Number(r.adquisicion)+Number(r.alimentacion)+Number(r.sanidad)+Number(r.gastos_imputables))}</dd></div>
        <div><dt className="text-xs text-slate-500">Ventas</dt><dd className="mt-1 font-medium tabular-nums">{format(r.ingresos_venta)}</dd></div>
        <div className="col-span-2"><dt className="text-xs text-slate-500">Utilidad realizada</dt>
         <dd className="mt-1 text-lg font-semibold tabular-nums">{format(r.utilidad_ventas)}</dd></div>
       </dl>
       {desglose&&<dl className="grid grid-cols-2 gap-2 border-t border-slate-100 pt-3 text-xs">
        {([
          ['Adquisición',r.adquisicion],['Bajas incluidas',bajasPorLote[r.lote_id]??0],
          ['Alimentación',r.alimentacion],['Sanidad',r.sanidad],
          ['Otros gastos',r.gastos_imputables],['Costo reconocido',r.costo_reconocido],
        ] as [string,number][]).map(([label,value])=><div key={label}>
          <dt className="text-slate-500">{label}</dt><dd className="font-medium tabular-nums">{format(value)}</dd>
        </div>)}
       </dl>}
      </article>)}
     </div>
     <div className="hidden md:block">
      <TableScroll><table className="min-w-full text-left text-sm">
     <thead><tr>
      <th className="whitespace-nowrap p-3 text-xs text-slate-500">Lote</th>
      <th className="whitespace-nowrap p-3 text-xs text-slate-500">Animales</th>
      {desglose&&['Adquisición','Bajas (incluidas)','Alimentación','Sanidad','Gastos'].map(t=><th key={t} className="whitespace-nowrap p-3 text-xs text-slate-500">{t}</th>)}
      <th className="whitespace-nowrap p-3 text-xs text-slate-500">Costo total</th>
      <th className="whitespace-nowrap p-3 text-xs text-slate-500">Ventas</th>
      {desglose&&<th className="whitespace-nowrap p-3 text-xs text-slate-500">Costo reconocido</th>}
      <th className="whitespace-nowrap p-3 text-xs text-slate-500">Utilidad</th>
     </tr></thead>
     <tbody className="divide-y divide-slate-100">{rows.map(r=><tr key={r.lote_id} className="hover:bg-slate-50">
      <td className="whitespace-nowrap p-3 font-semibold">{r.codigo}</td><td className="p-3 tabular-nums">{r.cantidad_actual}</td>
      {desglose&&<>
       <td className="whitespace-nowrap p-3">{format(r.adquisicion)}</td>
       <td className="whitespace-nowrap p-3 text-rose-800">{format(bajasPorLote[r.lote_id]??0)}</td>
       <td className="whitespace-nowrap p-3">{format(r.alimentacion)}</td>
       <td className="whitespace-nowrap p-3">{format(r.sanidad)}</td>
       <td className="whitespace-nowrap p-3">{format(r.gastos_imputables)}</td>
      </>}
      <td className="whitespace-nowrap p-3 font-medium">{format(Number(r.adquisicion)+Number(r.alimentacion)+Number(r.sanidad)+Number(r.gastos_imputables))}</td>
      <td className="whitespace-nowrap p-3">{format(r.ingresos_venta)}</td>
      {desglose&&<td className="whitespace-nowrap p-3">{format(r.costo_reconocido)}</td>}
      <td className="whitespace-nowrap p-3 font-semibold">{format(r.utilidad_ventas)}</td>
     </tr>)}</tbody>
      </table></TableScroll>
     </div>
    </>}
   </section>
  </>}
 </div>
}
