import { useEffect, useRef, useState } from 'react'
import { OperationalModules } from './OperationalModules'

export type AnimalRecord = {
  id:number; diio:string; lote_id:number; raza_id:number; sexo:string; estado:string
  precio_adquisicion:number; peso_ingreso_kg:number|null; fecha_nacimiento:string|null
  fecha_adquisicion:string; edad_aproximada_dias:number|null; observaciones:string|null
}
const money=(value:number)=>new Intl.NumberFormat('es-CL',{style:'currency',currency:'CLP',maximumFractionDigits:0}).format(value)
const date=(value:string|null)=>value?value.split('-').reverse().join('/'):'No registrada'

export function AnimalCard({animal,raza,lote,esAdmin,initialAction,onClose,onChanged}:{
  animal:AnimalRecord;raza:string;lote:string;esAdmin:boolean;initialAction?:string;onClose:()=>void;onChanged:()=>void
}){
  const [action,setAction]=useState<string|null>(initialAction??null)
  const [notice,setNotice]=useState('')
  const heading=useRef<HTMLHeadingElement>(null)
  useEffect(()=>{heading.current?.focus()},[])
  return <section aria-label={'Ficha del ternero '+animal.diio} className="space-y-5 rounded-2xl border border-emerald-300 bg-white p-5 shadow-sm sm:p-7">
    <div className="flex items-start justify-between gap-4">
      <div><p className="text-xs font-semibold uppercase tracking-widest text-emerald-700">Ficha individual</p>
        <h2 ref={heading} tabIndex={-1} className="mt-2 text-xl font-semibold outline-none">Ternero · {animal.diio}</h2>
        <p className={'mt-2 text-sm font-semibold '+(animal.estado==='FALLECIDO'?'text-rose-700':'text-slate-700')}>{animal.estado}</p>
      </div>
      <button type="button" onClick={onClose} disabled={Boolean(action)} aria-label="Cerrar ficha del ternero" className="rounded-lg border px-3 py-2 disabled:opacity-50">Cerrar ×</button>
    </div>
    <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {Object.entries({'Raza':raza,'Lote':lote,'Sexo':animal.sexo,'Valor base / adquisición':money(animal.precio_adquisicion),
        'Nacimiento':date(animal.fecha_nacimiento),'Fecha de ingreso':date(animal.fecha_adquisicion),
        'Edad aproximada al ingreso':animal.edad_aproximada_dias!=null?`${animal.edad_aproximada_dias} días`:'No registrada',
        'Peso inicial':animal.peso_ingreso_kg!=null?`${animal.peso_ingreso_kg} kg`:'No registrado'}).map(([name,value])=>
        <div key={name} className="rounded-xl bg-slate-50 p-3"><dt className="text-xs text-slate-500">{name}</dt><dd className="mt-1 font-semibold">{value}</dd></div>)}
    </dl>
    <div><h3 className="text-sm font-semibold">Observaciones</h3><p className="mt-1 whitespace-pre-wrap text-sm text-slate-600">{animal.observaciones||'Sin observaciones registradas.'}</p></div>
    {notice&&<p role="status" className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-900">{notice}</p>}
    {animal.estado==='ACTIVO'&&!action&&<div className="flex flex-wrap gap-2">
      <button type="button" onClick={()=>setAction('peso')} className="rounded-xl border border-emerald-200 px-4 py-2 text-sm font-semibold text-emerald-900">Registrar pesaje</button>
      {esAdmin&&<><button type="button" onClick={()=>setAction('animalRectificar')} className="rounded-xl border px-4 py-2 text-sm">Rectificar sexo</button>
        <button type="button" onClick={()=>setAction('fallecimiento')} className="rounded-xl bg-rose-700 px-4 py-2 text-sm font-semibold text-white">Marcar como fallecido</button></>}
    </div>}
    {action&&<OperationalModules key={action} esAdmin={esAdmin} module="animales" initialAction={action} initialAnimalId={animal.id}
      onClose={()=>setAction(null)} onChanged={()=>{
        setNotice(action==='fallecimiento'?'Fallecimiento registrado. Se conserva la ficha y se actualizó el lote.':'Datos registrados correctamente.')
        setAction(null);onChanged()
      }}/>} 
  </section>
}
