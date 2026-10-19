import { TableScroll } from '../components/TableScroll'
import { useEffect, useState } from 'react'
import { supabase } from '../api/supabase'

type Row = {
  lote_id:number; codigo:string; estado:string; cantidad_actual:number;
  adquisicion:number; alimentacion:number; sanidad:number; gastos_imputables:number;
  ingresos_venta:number; costo_reconocido:number; utilidad_ventas:number
}
const format = (v:number) => new Intl.NumberFormat('es-CL',{style:'currency',currency:'CLP',maximumFractionDigits:0}).format(v)
const sum = (r:Row[],key:keyof Row) => r.reduce((acc,x)=>acc+Number(x[key]||0),0)
function Stat({title,value,help}:{title:string;value:string;help:string}){
 return <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
  <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{title}</p>
  <p className="mt-3 text-2xl font-semibold tracking-tight text-slate-900">{value}</p>
  <p className="mt-1 text-xs leading-5 text-slate-500">{help}</p>
 </section>
}
export function ProfitabilityReport({bajasPorLote={}}:{bajasPorLote?:Record<number,number>}){
 const [rows,setRows]=useState<Row[]>([])
 const [loading,setLoading]=useState(true)
 const [error,setError]=useState('')
 useEffect(()=>{
  let mounted=true
  async function run(){
    if(!supabase)return
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
 return <div className="space-y-5">
  <div className="rounded-2xl border border-slate-200 bg-white p-6">
   <h2 className="text-lg font-semibold">Costos y rentabilidad por lote</h2>
   <p className="mt-2 text-sm leading-6 text-slate-600">
    Costos históricos de adquisición, alimentación, sanidad y gastos imputables.
    La utilidad solo refleja ventas confirmadas y su costo reconocido; los gastos generales
    no asignados no se distribuyen entre lotes.
   </p>
  </div>
  {error&&<p role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-800">{error}</p>}
  {loading&&<p className="text-sm text-slate-500">Calculando cifras...</p>}
  {!loading&&!error&&<>
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      <Stat title="Ingreso confirmado" value={format(ingresos)} help="Ventas con estado confirmado" />
      <Stat title="Costo reconocido" value={format(costo)} help="Adquisición y costos ya imputados a ventas" />
      <Stat title="Utilidad realizada" value={format(ingresos-costo)} help="Antes de gastos generales sin asignación" />
      <Stat title="Bajas por fallecimiento" value={format(bajas)} help="Solo adquisición. Ya incluida en el costo histórico; no se vuelve a sumar como gasto." />
      <Stat title="Ventas menos bajas de adquisición" value={format(ingresos-costo-bajas)} help="Resultado de ventas descontando la adquisición de fallecidos. No calcula costos de crianza individuales." />
      <Stat title="Margen realizado" value={margen+' %'} help="Utilidad / ingreso de ventas confirmadas" />
    </div>
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 p-5"><h3 className="font-semibold">Desglose de costos</h3></div>
      {!rows.length?<p className="p-5 text-sm text-slate-500">No existen lotes registrados.</p>:
      <TableScroll><table className="min-w-full text-left text-sm">
        <thead><tr>{['Lote','Activos','Adquisición histórica','Bajas incluidas en adquisición','Alimentación','Sanidad','Gastos','Costo total','Ventas','Costo reconocido','Utilidad'].map(t=>
          <th className="whitespace-nowrap p-3 text-xs uppercase tracking-wide text-slate-500" key={t}>{t}</th>)}</tr></thead>
        <tbody className="divide-y divide-slate-100">{rows.map(r=><tr key={r.lote_id} className="hover:bg-slate-50">
          <td className="p-3 font-semibold">{r.codigo}</td><td className="p-3">{r.cantidad_actual}</td>
          <td className="whitespace-nowrap p-3">{format(r.adquisicion)}</td>
          <td className="whitespace-nowrap p-3 text-rose-800">{format(bajasPorLote[r.lote_id]??0)}</td>
          <td className="whitespace-nowrap p-3">{format(r.alimentacion)}</td>
          <td className="whitespace-nowrap p-3">{format(r.sanidad)}</td>
          <td className="whitespace-nowrap p-3">{format(r.gastos_imputables)}</td>
          <td className="whitespace-nowrap p-3 font-medium">{format(Number(r.adquisicion)+Number(r.alimentacion)+Number(r.sanidad)+Number(r.gastos_imputables))}</td>
          <td className="whitespace-nowrap p-3">{format(r.ingresos_venta)}</td>
          <td className="whitespace-nowrap p-3">{format(r.costo_reconocido)}</td>
          <td className="whitespace-nowrap p-3 font-semibold">{format(r.utilidad_ventas)}</td>
        </tr>)}</tbody>
      </table></TableScroll>}
    </div>
    <p className="text-xs text-slate-500">Nota: las cifras de utilidad excluyen gastos generales no imputados y descuentos comerciales no registrados.</p>
  </>}
 </div>
}
