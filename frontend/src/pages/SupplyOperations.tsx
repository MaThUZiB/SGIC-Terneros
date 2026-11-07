import { CloseButton } from '../components/CloseButton'
import { useEffect, useState, useId, Children, isValidElement, cloneElement, type ReactElement, type ReactNode, type FormEvent } from 'react'
import { supabase } from '../api/supabase'
import { AnimalSearch } from '../components/AnimalSearch'
import { OperationConfirmDialog, type ConfirmDetails } from '../components/OperationConfirmDialog'
import { parseClpAmount } from '../utils/clpInput'

type Row = { id:number; nombre?:string; codigo?:string; diio?:string; estado?:string; activo?:boolean; producto_id?:number; unidad_base_id?:number; stock_actual?:number; costo_promedio?:number; tipo_insumo?:string; cantidad_base?:number; activa?:boolean; fecha?:string; precio_unitario?:number; unidad_ingreso?:string; factor?:number; lote_id?:number }
type PurchaseEntry = {fecha:string;precio_unitario:number;unidad_ingreso:string;factor:number}
const types:Record<string,string>={LECHE:'Leche / sustituto lácteo',CONCENTRADO:'Concentrado',FORRAJE:'Forraje (heno / ensilaje)',CAMA:'Material de cama (paja)',MEDICAMENTO:'Medicamento',OTRO:'Otro insumo'}
export const supplyActions=['ingresoInsumo','usoInsumo','perdidaInsumo','tratamiento']
const titles:Record<string,string>={ingresoInsumo:'Ingresar insumos',usoInsumo:'Registrar uso',perdidaInsumo:'Registrar pérdida',tratamiento:'Registrar tratamiento'}
const today=()=>new Date().toLocaleDateString('en-CA',{timeZone:'America/Santiago'})
const money=(n:number)=>new Intl.NumberFormat('es-CL',{style:'currency',currency:'CLP',maximumFractionDigits:2}).format(n)
const num=(s:string)=>/^\d+([.,]\d{1,3})?$/.test(s)?Number(s.replace(',','.')):NaN
const cls='w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-3'
function Field({label,children}:{label:string;children:ReactNode}){const id=useId();return <div className="block min-w-0 space-y-1.5 text-sm"><label htmlFor={id} className="block font-medium">{label}</label>{Children.map(children,(child,i)=>i===0&&isValidElement(child)?cloneElement(child as ReactElement<{id?:string}>,{id}):child)}</div>}

export function SupplyOperations({action,onClose,onChanged,onCompleted}:{action:string;onClose:()=>void;onChanged:()=>void;onCompleted?:(module:'compras'|'inventario')=>void;initialAsignacionId?:number|null}){
 const [lists,setLists]=useState<Record<string,Row[]>>({})
 const [v,setV]=useState<Record<string,string>>({fecha:today(),tipo:'COMPRA',unidad:'kg',tipo_insumo:'LECHE',factor:'1',finalidad:action==='perdidaInsumo'?'PERDIDA':action==='tratamiento'?'TRATAMIENTO':'OTRO',destino:action==='tratamiento'?'animal':'lote',})
 const [fresh,setFresh]=useState(false),[pack,setPack]=useState(false)
 const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState(''),[ok,setOk]=useState('')
 const [request,setRequest]=useState(()=>crypto.randomUUID())
 const [confirm,setConfirm]=useState<ConfirmDetails|null>(null),[payload,setPayload]=useState<Record<string,unknown>|null>(null)
 const [history,setHistory]=useState<PurchaseEntry[]>([]),[historyLoading,setHistoryLoading]=useState(false)
 const intake=action==='ingresoInsumo'
 async function load(){
  if(!supabase)return
  const keys=['producto','unidad_medida','lote','animal','proveedor','presentacion_producto']
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
 const presentations=(lists.presentacion_producto??[]).filter(p=>p.producto_id===product?.id&&p.activa)
 const duplicate=(lists.producto??[]).find(p=>p.nombre?.trim().toLocaleLowerCase()===v.nombre?.trim().toLocaleLowerCase())
 useEffect(()=>{
  if(!intake||fresh||!v.producto_id||!supabase){setHistory([]);setHistoryLoading(false);return}
  let active=true
  const selected=v.producto_id
  setHistory([]);setHistoryLoading(true)
  void (async()=>{
   const result=await supabase!.from('ingreso_insumo').select('fecha,precio_unitario,unidad_ingreso,factor')
    .eq('producto_id',Number(selected)).eq('tipo','COMPRA').order('id',{ascending:false}).limit(100)
   if(!active)return
   setHistoryLoading(false)
   if(result.error){setError('No se pudo consultar el último precio de compra.');return}
   const rows=(result.data??[]) as PurchaseEntry[]
   setHistory(rows)
   const selectedProduct=products.find(p=>String(p.id)===selected)
   const baseUnit=unit(selectedProduct)
   const last=rows[0]
   const saved=(lists.presentacion_producto??[]).filter(p=>p.producto_id===selectedProduct?.id&&p.activa)
   const lastIsPack=!!last&&(Number(last.factor)!==1||last.unidad_ingreso!==baseUnit)
   const initialPack=lastIsPack
    ? {nombre:last.unidad_ingreso,factor:Number(last.factor)}
    : !last&&saved.length ? {nombre:saved[0].nombre??'',factor:Number(saved[0].cantidad_base)} : null
   const matching=initialPack&&rows.find(h=>h.unidad_ingreso===initialPack.nombre&&Number(h.factor)===initialPack.factor)
   setPack(!!initialPack)
   setV(prev=>prev.producto_id===selected?{...prev,
    presentacion:initialPack?.nombre??'',factor:String(initialPack?.factor??1),
    precio:initialPack?(matching?String(matching.precio_unitario):''):(last?String(last.precio_unitario):'')} : prev)
  })().catch(()=>{
   if(active){setHistoryLoading(false);setError('No se pudo consultar el historial de compras.')}
  })
  return ()=>{active=false}
 },[intake,fresh,v.producto_id,lists.presentacion_producto])

 const qty=num(v.cantidad??''),factor=pack?num(v.factor??''):1
 const price=v.precio==='0'?0:parseClpAmount(v.precio??'')
 const base=qty*factor, total=qty*(price??NaN)
 const stockUnit=fresh?v.unidad:unit(product)
 const previousPrice=history.find(h=>h.unidad_ingreso===(pack?v.presentacion:stockUnit)&&Number(h.factor)===(pack?Number(v.factor):1))
 function choosePresentation(id:string){
  const chosen=presentations.find(p=>String(p.id)===id)
  if(!chosen){setV(prev=>({...prev,presentacion:'',factor:'1',precio:''}));return}
  const match=history.find(h=>h.unidad_ingreso===chosen.nombre&&Number(h.factor)===Number(chosen.cantidad_base))
  setV(prev=>({...prev,presentacion:chosen.nombre??'',factor:String(chosen.cantidad_base),precio:match?String(match.precio_unitario):''}))
 }
 function changePack(next:boolean){
  setPack(next)
  if(!next){
   const lastBase=history.find(h=>h.unidad_ingreso===stockUnit&&Number(h.factor)===1)
   setV(prev=>({...prev,presentacion:'',factor:'1',precio:lastBase?String(lastBase.precio_unitario):''}))
   return
  }
  const first=history.find(h=>Number(h.factor)!==1||h.unidad_ingreso!==stockUnit)
  const presentation=first?{nombre:first.unidad_ingreso,factor:Number(first.factor)}:
   presentations[0]?{nombre:presentations[0].nombre??'',factor:Number(presentations[0].cantidad_base)}:null
  const match=presentation&&history.find(h=>h.unidad_ingreso===presentation.nombre&&Number(h.factor)===presentation.factor)
  setV(prev=>({...prev,presentacion:presentation?.nombre??'',factor:String(presentation?.factor??1),precio:match?String(match.precio_unitario):''}))
 }
 function toggleFresh(next:boolean){
  setFresh(next);setPack(false);setHistory([])
  setV(prev=>({...prev,producto_id:'',nombre:'',cantidad:'',precio:'',presentacion:'',factor:'1'}))

 }

 function input(k:string,label:string,optional=false,type='text'){return <Field label={label}><input className={cls} required={!optional} type={type} max={type==='date'?today():undefined} inputMode={['cantidad','factor','precio'].includes(k)?'decimal':undefined} value={v[k]??''} onChange={e=>{const x=e.target.value;if(intake&&pack&&(k==='presentacion'||k==='factor'))setV(prev=>({...prev,[k]:x,precio:''}));else set(k,x)}}/></Field>}
 function select(k:string,label:string,options:{id:number|string;label:string}[],optional=false){return <Field label={label}><select className={cls} required={!optional} value={v[k]??''} onChange={e=>set(k,e.target.value)}><option value="">{optional?'Sin especificar':'Seleccionar'}</option>{options.map(o=><option key={o.id} value={o.id}>{o.label}</option>)}</select></Field>}
 function chooseProduct(id:string){
  setV(prev=>({...prev,producto_id:id,precio:'',presentacion:'',factor:'1'}));setPack(false);setHistory([]);setError('');const p=products.find(x=>String(x.id)===id)
  if(action==='usoInsumo')set('finalidad',p?.tipo_insumo==='CAMA'?'CAMA':p?.tipo_insumo==='MEDICAMENTO'?'TRATAMIENTO':'OTRO')
 }
 function prepare(e:FormEvent){
  e.preventDefault();setError('');setOk('')
  try{
   let p:Record<string,unknown>={...v,solicitud:request}
   let description=''
   let summary:ConfirmDetails['summary']
   if((!fresh||!intake)&&!product)throw Error('Escribe el nombre y selecciona una coincidencia.')
    if(intake&&fresh&&duplicate)throw Error('Este insumo ya existe. Selecciónalo en el buscador para evitar duplicados.')
    if(intake&&!fresh&&historyLoading)throw Error('Espera a que termine la consulta de precios anteriores.')
    if(!Number.isFinite(qty)||qty<=0)throw Error('Cantidad positiva, con hasta tres decimales, sin separadores de miles.')
    p.cantidad=qty
    if(intake){
     if(price===null||!Number.isFinite(base)||base<=0||Math.abs(base*1000-Math.round(base*1000))>0.00001)throw Error('Revisa precio y equivalencia. El stock admite hasta tres decimales.')
     p={...p,producto_id:fresh?null:product!.id,precio_unitario:price,factor,presentacion:pack?v.presentacion:null}
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
   if(intake)summary=[{label:'Insumo',value:fresh?v.nombre:product?.nombre??''},{label:'Cantidad de ingreso',value:`${qty} ${pack?v.presentacion:stockUnit}`},{label:'Precio unitario',value:money(price??0)},...(pack?[{label:'Existencia que ingresa',value:`${base} ${stockUnit}`}]:[]),{label:'Total',value:money(total),emphasis:true}]
   if(intake)description=v.tipo==='INICIAL'?'Se incorporará la existencia inicial con su valor, sin generar una compra.':'Se registrará la compra y se actualizarán las existencias.'
   setPayload(p);setConfirm({summary,title:titles[action],description,confirmLabel:'Confirmar registro',danger:action==='perdidaInsumo'})
  }catch(e){setError(e instanceof Error?e.message:'Revisa los datos.')}
 }
 async function save(){
  if(!supabase||!payload||busy)return
  setBusy(true);setError('')
  const method=intake?'sgic_ingresar_insumo':'sgic_usar_insumo'
  try{
   const r=await supabase.rpc(method,{p:payload});if(r.error)throw Error(r.error.message)
   setConfirm(null);setRequest(crypto.randomUUID());onChanged()
   if(intake&&onCompleted){onCompleted(v.tipo==='INICIAL'?'inventario':'compras');return}
   setOk('Registro guardado. Existencias e historial actualizados.');setV(prev=>({...prev,cantidad:'',precio:'',motivo:'',nombre:''}));await load()
  }catch(e){setConfirm(null);setError(e instanceof Error?e.message:'No se pudo registrar. Puedes reintentar sin duplicar el ingreso o uso.')}
  finally{setBusy(false)}
 }
 return <section className="operation-panel rounded-xl border border-slate-200 bg-white p-4 sm:p-6">
  <div className="mb-4 flex items-start justify-between gap-3 border-b border-slate-100 pb-4"><div className="min-w-0"><h2 className="text-lg font-semibold">{titles[action]}</h2><details className="mt-2 text-xs text-slate-600"><summary className="cursor-pointer font-medium">Ayuda</summary><p className="mt-2 leading-5">{intake?'Selecciona un insumo o crea uno nuevo; los existentes recuperan su último precio.':'Registra la cantidad y su destino.'}</p></details></div><CloseButton onClick={onClose} disabled={busy}/></div>
  {error&&<p role="alert" className="mb-4 rounded-xl bg-red-50 p-3 text-red-800">{error}</p>}{ok&&<p role="status" className="mb-4 rounded-xl bg-emerald-50 p-3 text-emerald-900">{ok}</p>}
  <form onSubmit={prepare}><fieldset disabled={busy||loading} className="mx-auto w-full max-w-2xl min-w-0 space-y-4">
   {intake&&<><div className="grid grid-cols-2 gap-2">{[['COMPRA','Compra'],['INICIAL','Existencia inicial']].map(([id,label])=><button type="button" key={id} aria-pressed={v.tipo===id} onClick={()=>set('tipo',id)} className={'rounded-xl border p-3 text-sm '+(v.tipo===id?'bg-emerald-900 text-white':'bg-white')}>{label}</button>)}</div><label className="flex items-center gap-3 py-2"><input type="checkbox" checked={fresh} onChange={e=>toggleFresh(e.target.checked)}/> Crear un insumo nuevo</label></>}
   {(!intake||!fresh)&&<div><p className="mb-2 text-sm font-medium">Insumo</p><AnimalSearch entity="insumo" options={products.map(p=>({id:p.id,diio:p.nombre!,detail:`${types[p.tipo_insumo??'OTRO']} · Disponible: ${p.stock_actual} ${unit(p)}`}))} value={v.producto_id??''} onChange={chooseProduct} disabled={busy||loading}/>{!loading&&!products.length&&<p className="mt-2 text-sm text-slate-600">Aún no hay insumos. {intake?'Marca «Crear un insumo nuevo».':'Registra primero un ingreso en Inventario.'}</p>}</div>}
   {intake&&fresh&&<>{input('nombre','Nombre del insumo')}{duplicate&&<div role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">Ya existe «{duplicate.nombre}». {duplicate.activo?<button type="button" onClick={()=>{toggleFresh(false);chooseProduct(String(duplicate.id))}} className="font-semibold underline">Usar este insumo existente</button>:'Actívalo desde Catálogos antes de volver a comprarlo.'}</div>}<Field label="Tipo de insumo"><select className={cls} value={v.tipo_insumo} onChange={e=>{set('tipo_insumo',e.target.value);set('unidad',e.target.value==='CAMA'?'bolo':e.target.value==='MEDICAMENTO'?'ml':'kg')}}>{Object.entries(types).map(([id,label])=><option key={id} value={id}>{label}</option>)}</select></Field>{select('unidad','Unidad para controlar existencias',[{id:'kg',label:'Kilogramos (kg)'},{id:'l',label:'Litros (l)'},{id:'ml',label:'Mililitros (ml)'},{id:'unidad',label:'Unidades'},{id:'bolo',label:'Bolos'}])}</>}

   {intake&&<>
    {!fresh&&product&&<p className="text-xs text-slate-600">Existencia: {product.stock_actual} {stockUnit}</p>}
    <label className="flex items-center gap-3 py-2 text-sm"><input type="checkbox" checked={pack} onChange={e=>changePack(e.target.checked)}/> Ingresar por saco, envase u otra presentación</label>
    {pack&&<div className="space-y-4 rounded-xl bg-slate-50 p-4">
     {!fresh&&presentations.length>0&&<Field label="Presentaciones guardadas"><select className={cls} value={presentations.find(p=>p.nombre===v.presentacion&&Number(p.cantidad_base)===Number(v.factor))?.id??''} onChange={e=>choosePresentation(e.target.value)}>
      <option value="">Nueva o personalizada</option>{presentations.map(p=><option key={p.id} value={p.id}>{p.nombre} · {p.cantidad_base} {stockUnit}</option>)}
     </select></Field>}
     <div className="grid gap-4 sm:grid-cols-2">{input('presentacion','Presentación (ej. saco)')}{input('factor','Contenido por presentación ('+(stockUnit||'unidad base')+')')}</div>
     {!fresh&&<details className="text-xs text-slate-500"><summary className="cursor-pointer">Sobre las presentaciones</summary><p className="mt-1">Cambiar una equivalencia crea una presentación nueva sin alterar compras anteriores.</p></details>}
    </div>}
   </>}
   {!intake&&<>{action==='usoInsumo'&&select('finalidad','Uso',[{id:'CAMA',label:'Cama'},{id:'TRATAMIENTO',label:'Tratamiento sanitario'},{id:'OTRO',label:'Otro uso'}])}<Field label="Destino"><select className={cls} value={v.destino} onChange={e=>set('destino',e.target.value)}>{v.finalidad==='TRATAMIENTO'&&<option value="animal">Animal individual</option>}<option value="lote">Lote</option>{v.finalidad!=='TRATAMIENTO'&&<option value="general">General del predio</option>}</select></Field>{v.destino==='lote'&&select('lote_id','Lote',(lists.lote??[]).filter(l=>l.estado==='ACTIVO').map(l=>({id:l.id,label:l.codigo!})))}{v.finalidad==='TRATAMIENTO'&&v.destino==='animal'&&<AnimalSearch options={(lists.animal??[]).filter(a=>a.estado==='ACTIVO').map(a=>({id:a.id,diio:a.diio!,detail:lists.lote?.find(l=>l.id===a.lote_id)?.codigo??''}))} value={v.animal_id??''} onChange={x=>set('animal_id',x)}/>} {input('motivo',v.finalidad==='PERDIDA'?'Motivo de la pérdida':'Motivo / observación')}</>}
   {input('cantidad',`Cantidad (${intake&&pack?v.presentacion||'presentaciones':stockUnit||'unidad base'})`)}
   {intake&&<>{input('precio',`${v.tipo==='INICIAL'?'Valor':'Precio'} por ${pack?v.presentacion||'presentación':stockUnit||'unidad'} (CLP)`)}{!fresh&&product&&<p className="text-xs text-slate-600">{historyLoading?'Consultando precio de compra anterior…':previousPrice?'Último precio para esta presentación: '+money(Number(previousPrice.precio_unitario))+' ('+previousPrice.fecha+'). Puedes editarlo para esta compra.':'Sin precio anterior para esta presentación. Ingresa el precio actual.'}</p>}{v.tipo==='INICIAL'&&<p className="text-xs text-slate-600">Usa el costo conocido de la existencia inicial. Puedes indicar 0 si no está valorizada.</p>}{v.tipo==='COMPRA'&&<details className="rounded-xl border p-3"><summary className="cursor-pointer py-1 text-sm font-medium">Proveedor y documento (opcionales)</summary><div className="mt-3 space-y-3">{select('proveedor_id','Proveedor existente',(lists.proveedor??[]).filter(p=>p.activo).map(p=>({id:p.id,label:p.nombre!})),true)}{!v.proveedor_id&&input('proveedor_nombre','Nombre de proveedor nuevo',true)}{input('documento','Documento',true)}</div></details>}{Number.isFinite(total)&&Number.isFinite(base)&&<p className="rounded-xl bg-emerald-50 p-4 text-sm text-emerald-950">Ingresan <strong>{base} {stockUnit}</strong> · Total: <strong>{money(total)}</strong></p>}</>}
   {input('fecha','Fecha',false,'date')}
   {!intake&&product&&Number.isFinite(qty)&&<p className="text-sm text-slate-600">Costo del uso: {money(qty*Number(product.costo_promedio))} · Quedarán {Number(product.stock_actual)-qty} {unit(product)}.</p>}
   <button disabled={loading||busy||(intake&&!fresh&&historyLoading)} className="w-full rounded-xl bg-emerald-900 px-5 py-3 font-semibold text-white disabled:opacity-50">{busy?'Registrando…':'Revisar y confirmar'}</button>
  </fieldset></form>
  <OperationConfirmDialog details={confirm} busy={busy} onCancel={()=>setConfirm(null)} onConfirm={()=>{void save()}}/>
 </section>
}
