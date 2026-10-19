import { useEffect, useState, useId, Children, isValidElement, cloneElement, type ReactElement, type ReactNode, type FormEvent } from 'react'
import { supabase } from '../api/supabase'
import { AnimalSearch } from '../components/AnimalSearch'
import { OperationConfirmDialog, type ConfirmDetails } from '../components/OperationConfirmDialog'
import { parseClpAmount } from '../utils/clpInput'

type Row = { id:number; nombre?:string; codigo?:string; diio?:string; estado?:string; activo?:boolean; producto_id?:number; unidad_base_id?:number; stock_actual?:number; costo_promedio?:number; tipo_insumo?:string; apto_plan?:boolean; plan_id?:number; lote_id?:number; cantidad_diaria?:number; fecha_inicio?:string; fecha_fin?:string }
const types:Record<string,string>={LECHE:'Leche / sustituto lácteo',CONCENTRADO:'Concentrado',FORRAJE:'Forraje (heno / ensilaje)',CAMA:'Material de cama (paja)',MEDICAMENTO:'Medicamento',OTRO:'Otro insumo'}
export const supplyActions=['ingresoInsumo','usoInsumo','perdidaInsumo','configInsumo','consumoPlan','tratamiento','consumo']
const titles:Record<string,string>={ingresoInsumo:'Ingresar insumos',usoInsumo:'Registrar uso',perdidaInsumo:'Registrar pérdida',configInsumo:'Uso en planes',consumoPlan:'Confirmar alimentación del día',tratamiento:'Registrar tratamiento',consumo:'Registrar alimentación real'}
const today=()=>new Date().toLocaleDateString('en-CA',{timeZone:'America/Santiago'})
const money=(n:number)=>new Intl.NumberFormat('es-CL',{style:'currency',currency:'CLP',maximumFractionDigits:2}).format(n)
const num=(s:string)=>/^\d+([.,]\d{1,3})?$/.test(s)?Number(s.replace(',','.')):NaN
const cls='w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-3'
function Field({label,children}:{label:string;children:ReactNode}){const id=useId();return <div className="block min-w-0 space-y-1.5 text-sm"><label htmlFor={id} className="block font-medium">{label}</label>{Children.map(children,(child,i)=>i===0&&isValidElement(child)?cloneElement(child as ReactElement<{id?:string}>,{id}):child)}</div>}

export function SupplyOperations({action,onClose,onChanged}:{action:string;onClose:()=>void;onChanged:()=>void}){
 const [lists,setLists]=useState<Record<string,Row[]>>({})
 const [v,setV]=useState<Record<string,string>>({fecha:today(),tipo:'COMPRA',unidad:'kg',tipo_insumo:'LECHE',factor:'1',finalidad:action==='perdidaInsumo'?'PERDIDA':action==='tratamiento'?'TRATAMIENTO':'ALIMENTACION',destino:action==='tratamiento'?'animal':'lote'})
 const [fresh,setFresh]=useState(false),[pack,setPack]=useState(false),[eligible,setEligible]=useState(true)
 const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState(''),[ok,setOk]=useState('')
 const [request,setRequest]=useState(()=>crypto.randomUUID())
 const [confirm,setConfirm]=useState<ConfirmDetails|null>(null),[payload,setPayload]=useState<Record<string,unknown>|null>(null)
 const [amounts,setAmounts]=useState<Record<string,string>>({})
 const intake=action==='ingresoInsumo',plan=action==='consumoPlan',config=action==='configInsumo'
 async function load(){
  if(!supabase)return
  const keys=['producto','unidad_medida','lote','animal','proveedor','asignacion_plan_lote','detalle_plan_consumo','plan_consumo']
  const results=await Promise.all(keys.map(k=>supabase!.from(k).select('*').order('id').limit(1000)))
  const bad=results.find(r=>r.error)
  if(bad?.error){setError(bad.error.message);setLoading(false);return}
  setLists(Object.fromEntries(keys.map((k,i)=>[k,results[i].data??[]])));setLoading(false)
 }
 useEffect(()=>{void load()},[])
 const set=(k:string,x:string)=>setV(prev=>({...prev,[k]:x,...(k==='finalidad'&&x==='TRATAMIENTO'&&prev.destino==='general'?{destino:'lote'}:{})}))
 const products=(lists.producto??[]).filter(p=>p.activo)
 const product=products.find(p=>String(p.id)===v.producto_id)
 const unit=(p?:Row)=>lists.unidad_medida?.find(u=>u.id===p?.unidad_base_id)?.codigo??''
 const assign=lists.asignacion_plan_lote?.find(a=>String(a.id)===v.asignacion_id)
 const details=(lists.detalle_plan_consumo??[]).filter(d=>d.plan_id===assign?.plan_id)
 const qty=num(v.cantidad??''),factor=pack?num(v.factor??''):1
 const price=v.precio==='0'?0:parseClpAmount(v.precio??'')
 const base=qty*factor, total=qty*(price??NaN)
 const stockUnit=fresh?v.unidad:unit(product)
 function input(k:string,label:string,optional=false,type='text'){return <Field label={label}><input className={cls} required={!optional} type={type} max={type==='date'?today():undefined} inputMode={['cantidad','factor','precio'].includes(k)?'decimal':undefined} value={v[k]??''} onChange={e=>set(k,e.target.value)}/></Field>}
 function select(k:string,label:string,options:{id:number|string;label:string}[],optional=false){return <Field label={label}><select className={cls} required={!optional} value={v[k]??''} onChange={e=>set(k,e.target.value)}><option value="">{optional?'Sin especificar':'Seleccionar'}</option>{options.map(o=><option key={o.id} value={o.id}>{o.label}</option>)}</select></Field>}
 function chooseProduct(id:string){
  set('producto_id',id);const p=products.find(x=>String(x.id)===id);setEligible(p?.apto_plan??false)
  if(action==='usoInsumo')set('finalidad',p?.tipo_insumo==='CAMA'?'CAMA':p?.tipo_insumo==='MEDICAMENTO'?'TRATAMIENTO':p?.apto_plan?'ALIMENTACION':'OTRO')
 }
 function prepare(e:FormEvent){
  e.preventDefault();setError('');setOk('')
  try{
   let p:Record<string,unknown>={...v,solicitud:request}
   let description=''
   if(plan){
    if(!assign||!details.length)throw Error('Selecciona una asignación con alimentos.')
    const rows=details.map(d=>({detalle_id:d.id,cantidad:num(amounts[d.id]??String(d.cantidad_diaria))}))
    if(rows.some(x=>!Number.isFinite(x.cantidad)||x.cantidad<0)||!rows.some(x=>x.cantidad>0))throw Error('Revisa las cantidades. Puedes usar cero para omitir un alimento.')
    p={asignacion_id:assign.id,fecha:v.fecha,detalles:rows}
    description=rows.map(d=>{const line=details.find(x=>x.id===d.detalle_id)!;const prod=products.find(x=>x.id===line.producto_id);return `${prod?.nombre}: ${d.cantidad} ${unit(prod)}`}).join('\n')+'\nSe descontarán estas cantidades una sola vez para esta asignación y fecha.'
   }else if(config){
    if(!product)throw Error('Selecciona un insumo.')
    p={producto_id:product.id,apto_plan:eligible};description=`${product.nombre}: ${eligible?'disponible':'no disponible'} para planes de alimentación.`
   }else{
    if((!fresh||!intake)&&!product)throw Error('Escribe el nombre y selecciona una coincidencia.')
    if(!Number.isFinite(qty)||qty<=0)throw Error('Cantidad positiva, con hasta tres decimales, sin separadores de miles.')
    p.cantidad=qty
    if(intake){
     if(price===null||!Number.isFinite(base)||base<=0||Math.abs(base*1000-Math.round(base*1000))>0.00001)throw Error('Revisa precio y equivalencia. El stock admite hasta tres decimales.')
     p={...p,producto_id:fresh?null:product!.id,precio_unitario:price,factor,presentacion:pack?v.presentacion:null,apto_plan:eligible}
     description=`${fresh?v.nombre:product?.nombre}\n${qty} ${pack?v.presentacion:stockUnit} × ${money(price)} = ${money(total)}\nIngresan ${base} ${stockUnit}.\n${v.tipo==='INICIAL'?'Se registra como existencia inicial, sin generar una compra.':'Se registra la compra y se actualiza el inventario.'}`
    }else{
     if(qty>Number(product!.stock_actual))throw Error('La cantidad supera el stock disponible.')
     const treatment=v.finalidad==='TRATAMIENTO'
     p.producto_id=product!.id;p.animal_id=treatment&&v.destino==='animal'?v.animal_id:null;p.lote_id=v.destino==='lote'?v.lote_id:null
     if(treatment&&v.destino==='general')throw Error('Selecciona un animal o lote para el tratamiento.')
     if(v.destino==='lote'&&!v.lote_id)throw Error('Selecciona un lote o el destino general del predio.')
     if(treatment&&v.destino==='animal'&&!v.animal_id)throw Error('Selecciona el animal en las coincidencias.')
     description=`${product!.nombre}: ${qty} ${unit(product)}\nCosto: ${money(qty*Number(product!.costo_promedio))}\nDestino: ${v.destino==='general'?'General del predio':v.destino==='animal'?lists.animal?.find(a=>String(a.id)===v.animal_id)?.diio:lists.lote?.find(l=>String(l.id)===v.lote_id)?.codigo}\n${v.finalidad==='PERDIDA'?'Se registra una pérdida.':'Se registra el uso.'} El stock se descontará una sola vez.`
    }
   }
   setPayload(p);setConfirm({title:titles[action],description,confirmLabel:'Confirmar registro',danger:action==='perdidaInsumo'})
  }catch(e){setError(e instanceof Error?e.message:'Revisa los datos.')}
 }
 async function save(){
  if(!supabase||!payload||busy)return
  setBusy(true);setError('')
  const method=intake?'sgic_ingresar_insumo':config?'sgic_configurar_insumo':plan?'sgic_confirmar_alimentacion':'sgic_usar_insumo'
  try{
   const r=await supabase.rpc(method,{p:payload});if(r.error)throw Error(r.error.message)
   setConfirm(null);setOk('Registro guardado. Existencias e historial actualizados.');setRequest(crypto.randomUUID());setV(prev=>({...prev,cantidad:'',precio:'',motivo:'',nombre:''}));await load();onChanged()
  }catch(e){setConfirm(null);setError(e instanceof Error?e.message:'No se pudo registrar. Puedes reintentar sin duplicar el ingreso o uso.')}
  finally{setBusy(false)}
 }
 return <section className="rounded-2xl border border-emerald-200 bg-white p-4 shadow-sm sm:p-7">
  <div className="mb-5 flex items-start justify-between gap-3"><div><h2 className="text-xl font-semibold">{titles[action]}</h2><p className="mt-2 text-sm text-slate-600">{intake?'Crea el insumo aquí mismo. Proveedor y presentación son opcionales.':plan?'Revisa lo realmente entregado al lote. Las cantidades son totales por lote y día.':config?'La categoría sugiere el uso, pero puedes habilitar un forraje u otro insumo para alimentación.':'Registra la cantidad utilizada y su destino. El costo queda asociado al lote o al predio.'}</p></div><button type="button" disabled={busy} onClick={onClose} className="rounded-xl border px-3 py-2" aria-label="Cerrar formulario">✕</button></div>
  {error&&<p role="alert" className="mb-4 rounded-xl bg-red-50 p-3 text-red-800">{error}</p>}{ok&&<p role="status" className="mb-4 rounded-xl bg-emerald-50 p-3 text-emerald-900">{ok}</p>}
  <form onSubmit={prepare}><fieldset disabled={busy||loading} className="max-w-2xl min-w-0 space-y-4">
   {intake&&<><div className="grid grid-cols-2 gap-2">{[['COMPRA','Compra'],['INICIAL','Existencia inicial']].map(([id,label])=><button type="button" key={id} aria-pressed={v.tipo===id} onClick={()=>set('tipo',id)} className={'rounded-xl border p-3 text-sm '+(v.tipo===id?'bg-emerald-900 text-white':'bg-white')}>{label}</button>)}</div><label className="flex items-center gap-3 py-2"><input type="checkbox" checked={fresh} onChange={e=>{setFresh(e.target.checked);setEligible(e.target.checked?['LECHE','CONCENTRADO'].includes(v.tipo_insumo):product?.apto_plan??false)}}/> Crear un insumo nuevo</label></>}
   {!plan&&(!intake||!fresh)&&<div><p className="mb-2 text-sm font-medium">Insumo</p><AnimalSearch entity="insumo" options={products.map(p=>({id:p.id,diio:p.nombre!,detail:`${types[p.tipo_insumo??'OTRO']} · Disponible: ${p.stock_actual} ${unit(p)}`}))} value={v.producto_id??''} onChange={chooseProduct} disabled={busy||loading}/>{!loading&&!products.length&&<p className="mt-2 text-sm text-slate-600">Aún no hay insumos. {intake?'Marca «Crear un insumo nuevo».':'Registra primero un ingreso en Inventario.'}</p>}</div>}
   {intake&&fresh&&<>{input('nombre','Nombre del insumo')}<Field label="Tipo de insumo"><select className={cls} value={v.tipo_insumo} onChange={e=>{set('tipo_insumo',e.target.value);setEligible(['LECHE','CONCENTRADO'].includes(e.target.value));set('unidad',e.target.value==='CAMA'?'bolo':e.target.value==='MEDICAMENTO'?'ml':'kg')}}>{Object.entries(types).map(([id,label])=><option key={id} value={id}>{label}</option>)}</select></Field>{select('unidad','Unidad para controlar existencias',[{id:'kg',label:'Kilogramos (kg)'},{id:'l',label:'Litros (l)'},{id:'ml',label:'Mililitros (ml)'},{id:'unidad',label:'Unidades'},{id:'bolo',label:'Bolos'}])}</>}
   {(config||(intake&&fresh))&&<label className="flex items-center gap-3 rounded-xl bg-slate-50 p-3 text-sm"><input type="checkbox" checked={eligible} onChange={e=>setEligible(e.target.checked)}/> Disponible para planes de alimentación</label>}
   {intake&&<><label className="flex items-center gap-3 py-2 text-sm"><input type="checkbox" checked={pack} onChange={e=>setPack(e.target.checked)}/> Ingresar por saco, envase u otra presentación</label>{pack&&<div className="grid gap-4 rounded-xl bg-slate-50 p-4 sm:grid-cols-2">{input('presentacion','Nombre (ej. saco)')}{input('factor',`Cada presentación contiene (${stockUnit||'unidad base'})`)}</div>}</>}
   {plan&&<><Field label="Plan y lote"><select className={cls} required value={v.asignacion_id??''} onChange={e=>{set('asignacion_id',e.target.value);setAmounts({})}}><option value="">Seleccionar asignación</option>{(lists.asignacion_plan_lote??[]).filter(a=>a.activo).map(a=><option key={a.id} value={a.id}>{lists.plan_consumo?.find(p=>p.id===a.plan_id)?.nombre} · {lists.lote?.find(l=>l.id===a.lote_id)?.codigo}</option>)}</select></Field>{details.map(d=>{const p=products.find(p=>p.id===d.producto_id);return <Field key={d.id} label={`${p?.nombre??'Insumo inactivo'} · ${unit(p)} totales para el lote`}><input className={cls} required inputMode="decimal" value={amounts[d.id]??String(d.cantidad_diaria)} onChange={e=>setAmounts(prev=>({...prev,[d.id]:e.target.value}))}/><span className="block text-xs text-slate-500">Plan: {d.cantidad_diaria} · Disponible: {p?.stock_actual??0} {unit(p)}. Cero omite este alimento.</span></Field>})}</>}
   {!intake&&!config&&!plan&&<>{action==='usoInsumo'&&select('finalidad','Uso',[{id:'ALIMENTACION',label:'Alimentación'},{id:'CAMA',label:'Cama'},{id:'TRATAMIENTO',label:'Tratamiento sanitario'},{id:'OTRO',label:'Otro uso'}])}<Field label="Destino"><select className={cls} value={v.destino} onChange={e=>set('destino',e.target.value)}>{v.finalidad==='TRATAMIENTO'&&<option value="animal">Animal individual</option>}<option value="lote">Lote</option>{v.finalidad!=='TRATAMIENTO'&&<option value="general">General del predio</option>}</select></Field>{v.destino==='lote'&&select('lote_id','Lote',(lists.lote??[]).filter(l=>l.estado==='ACTIVO').map(l=>({id:l.id,label:l.codigo!})))}{v.finalidad==='TRATAMIENTO'&&v.destino==='animal'&&<AnimalSearch options={(lists.animal??[]).filter(a=>a.estado==='ACTIVO').map(a=>({id:a.id,diio:a.diio!,detail:lists.lote?.find(l=>l.id===a.lote_id)?.codigo??''}))} value={v.animal_id??''} onChange={x=>set('animal_id',x)}/>} {input('motivo',v.finalidad==='PERDIDA'?'Motivo de la pérdida':'Motivo / observación')}</>}
   {!plan&&!config&&input('cantidad',`Cantidad (${intake&&pack?v.presentacion||'presentaciones':stockUnit||'unidad base'})`)}
   {intake&&<>{input('precio',`${v.tipo==='INICIAL'?'Valor':'Precio'} por ${pack?v.presentacion||'presentación':stockUnit||'unidad'} (CLP)`)}{v.tipo==='INICIAL'&&<p className="text-xs text-slate-600">Usa el costo conocido de la existencia inicial. Puedes indicar 0 si no está valorizada.</p>}{v.tipo==='COMPRA'&&<details className="rounded-xl border p-3"><summary className="cursor-pointer py-1 text-sm font-medium">Proveedor y documento (opcionales)</summary><div className="mt-3 space-y-3">{select('proveedor_id','Proveedor existente',(lists.proveedor??[]).filter(p=>p.activo).map(p=>({id:p.id,label:p.nombre!})),true)}{!v.proveedor_id&&input('proveedor_nombre','Nombre de proveedor nuevo',true)}{input('documento','Documento',true)}</div></details>}{Number.isFinite(total)&&Number.isFinite(base)&&<p className="rounded-xl bg-emerald-50 p-4 text-sm text-emerald-950">Ingresan <strong>{base} {stockUnit}</strong> · Total: <strong>{money(total)}</strong></p>}</>}
   {!config&&input('fecha','Fecha',false,'date')}
   {!intake&&!config&&!plan&&product&&Number.isFinite(qty)&&<p className="text-sm text-slate-600">Costo del uso: {money(qty*Number(product.costo_promedio))} · Quedarán {Number(product.stock_actual)-qty} {unit(product)}.</p>}
   <button disabled={loading||busy} className="w-full rounded-xl bg-emerald-900 px-5 py-3 font-semibold text-white disabled:opacity-50">{busy?'Registrando…':'Revisar y confirmar'}</button>
  </fieldset></form>
  <OperationConfirmDialog details={confirm} busy={busy} onCancel={()=>setConfirm(null)} onConfirm={()=>{void save()}}/>
 </section>
}
