import { useEffect, useState } from 'react'
import { supabase } from '../api/supabase'
import { OperationConfirmDialog, type ConfirmDetails } from '../components/OperationConfirmDialog'

type Purchase = { id:number; proveedor_id:number; fecha:string; numero_documento:string|null; total:number; estado:string }
type Sale = { id:number; fecha:string; comprador:string|null; total_venta:number; estado:string }
type PurchaseLine = { id:number; compra_id:number; producto_id:number; cantidad:number; cantidad_base:number; subtotal:number }
type SaleAnimal = { venta_id:number; animal_id:number }
type Named = { id:number; nombre?:string; diio?:string }
type Pending = { type:'compra'|'venta'; id:number; date:string; amount:number; title:string; description:string; lines:string[] }
const money=(v:number)=>new Intl.NumberFormat('es-CL',{style:'currency',currency:'CLP',maximumFractionDigits:0}).format(v)

export function PendingRequests({ esAdmin, onChanged }:{ esAdmin:boolean; onChanged:()=>void }) {
  const [items,setItems]=useState<Pending[]>([])
  const [busy,setBusy]=useState(false)
  const [loading,setLoading]=useState(true)
  const [error,setError]=useState('')
  const [success,setSuccess]=useState('')
  const [confirmation,setConfirmation]=useState<ConfirmDetails|null>(null)
  const [selection,setSelection]=useState<{type:'compra'|'venta';id:number;action:'aprobar'|'rechazar'}|null>(null)

  async function reload() {
    if(!supabase)return
    setLoading(true)
    const r=await Promise.all([
      supabase.from('compra_insumo').select('id,proveedor_id,fecha,numero_documento,total,estado').eq('estado','BORRADOR').order('fecha',{ascending:false}),
      supabase.from('venta').select('id,fecha,comprador,total_venta,estado').eq('estado','BORRADOR').order('fecha',{ascending:false}),
      supabase.from('detalle_compra_insumo').select('id,compra_id,producto_id,cantidad,cantidad_base,subtotal'),
      supabase.from('venta_borrador_animal').select('venta_id,animal_id'),
      supabase.from('producto').select('id,nombre'),
      supabase.from('proveedor').select('id,nombre'),
      supabase.from('animal').select('id,diio'),
    ])
    setLoading(false)
    const failure=r.find(x=>x.error)
    if(failure?.error) {setError('No se pudo cargar el listado: '+failure.error.message);return}
    const purchases=(r[0].data??[]) as Purchase[]
    const sales=(r[1].data??[]) as Sale[]
    const details=(r[2].data??[]) as PurchaseLine[]
    const saleAnimals=(r[3].data??[]) as SaleAnimal[]
    const products=(r[4].data??[]) as Named[]
    const providers=(r[5].data??[]) as Named[]
    const animals=(r[6].data??[]) as Named[]
    const name=(x:number,list:Named[],key:'nombre'|'diio'='nombre')=>list.find(z=>z.id===x)?.[key]??'#'+x
    setError('')
    setItems([
      ...purchases.map(p=>({
        type:'compra' as const,id:p.id,date:p.fecha,amount:Number(p.total),
        title:'Compra de insumos · '+(providers.find(z=>z.id===p.proveedor_id)?.nombre??'Proveedor #'+p.proveedor_id),
        description:p.numero_documento?'Documento '+p.numero_documento:'Sin documento',
        lines:details.filter(d=>d.compra_id===p.id).map(d=>
          `${name(d.producto_id,products)} · ${Number(d.cantidad).toLocaleString('es-CL')} unidades comerciales · ${Number(d.cantidad_base).toLocaleString('es-CL')} unidades base · ${money(Number(d.subtotal))}`),
      })),
      ...sales.map(v=>({
        type:'venta' as const,id:v.id,date:v.fecha,amount:Number(v.total_venta),
        title:'Venta de animales · '+(v.comprador||'Comprador sin especificar'),
        description:'DIIO seleccionados',
        lines:saleAnimals.filter(a=>a.venta_id===v.id).map(a=>name(a.animal_id,animals,'diio')),
      })),
    ].sort((a,b)=>b.date.localeCompare(a.date)||b.id-a.id))
  }

  useEffect(()=>{void reload()},[])
  function ask(item:Pending,action:'aprobar'|'rechazar') {
    if(!esAdmin)return
    setSelection({type:item.type,id:item.id,action})
    setConfirmation({
      title:action==='aprobar'?'Aprobar solicitud #'+item.id:'Rechazar solicitud #'+item.id,
      description:`${item.title}\nTotal: ${money(item.amount)}\n\n${action==='aprobar'
        ?(item.type==='compra'
          ?'Se ingresarán las existencias, se recalculará el PMP y se generará kardex. Verifica los precios de todas las líneas antes de aprobar.'
          :'Se confirmará la venta, descontando los animales seleccionados y reconociendo sus costos. No se puede deshacer directamente.')
        :'La solicitud se anulará sin afectar el inventario ni los animales.'}`,
      confirmLabel:action==='aprobar'?'Aprobar y ejecutar':'Rechazar solicitud',
      danger:action==='rechazar'||item.type==='venta',
    })
  }
  async function resolve() {
    if(!selection||!supabase||busy)return
    setBusy(true);setError('');setSuccess('')
    const fn=selection.type==='compra'
      ?(selection.action==='aprobar'?'sgic_confirmar_compra_insumo':'sgic_anular_borrador_insumo')
      :(selection.action==='aprobar'?'sgic_confirmar_borrador_venta':'sgic_anular_borrador_venta')
    const params=selection.type==='compra'?{p_compra_id:selection.id}:{p_venta_id:selection.id}
    const { error:rpcError }=await supabase.rpc(fn,params)
    setBusy(false);setConfirmation(null);setSelection(null)
    if(rpcError){setError('No se pudo resolver la solicitud: '+rpcError.message);return}
    setSuccess('Solicitud #'+selection.id+' '+(selection.action==='aprobar'?'aprobada y aplicada.':'rechazada.')+' Se registró el resultado en la auditoría.')
    await reload();onChanged()
  }
  return <section className="space-y-5">
    <header className="rounded-2xl border border-slate-200 bg-white p-6">
      <p className="text-xs font-semibold uppercase tracking-widest text-emerald-700">Revisión de operaciones</p>
      <h2 className="mt-2 text-2xl font-semibold tracking-tight">Solicitudes pendientes</h2>
      <p className="mt-2 text-sm leading-6 text-slate-600">Aquí se agrupan las operaciones preparadas que necesitan aprobación. Actualmente incluye compras de insumos y ventas de animales. Las demás operaciones se registran directamente con los permisos correspondientes.</p>
    </header>
    {error&&<p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</p>}
    {success&&<p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">{success}</p>}
    {loading&&<p className="rounded-xl bg-white p-6 text-sm text-slate-500">Cargando solicitudes…</p>}
    {!loading&&!error&&items.length===0&&<p className="rounded-2xl bg-white p-8 text-sm text-slate-500">No hay solicitudes pendientes.</p>}
    {!loading&&items.map(item=><article key={item.type+'-'+item.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-xs font-semibold uppercase tracking-widest text-slate-500">{item.type==='compra'?'Solicitud de compra':'Solicitud de venta'} · #{item.id}</div>
          <h3 className="mt-2 text-lg font-semibold">{item.title}</h3>
          <p className="mt-1 text-sm text-slate-500">{item.date} · {item.description}</p>
        </div>
        <div className="text-right"><p className="text-xl font-semibold">{money(item.amount)}</p><p className="text-xs text-amber-700">Pendiente de decisión</p></div>
      </div>
      <div className="mt-5 rounded-xl bg-slate-50 p-4">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">Contenido de la solicitud</p>
        {item.lines.length?item.lines.map((line,i)=><p key={i} className="py-1 text-sm text-slate-700">{line}</p>):<p className="text-sm text-slate-500">Sin detalles asociados</p>}
      </div>
      {esAdmin&&<div className="mt-5 flex flex-wrap gap-2">
        <button type="button" onClick={()=>ask(item,'aprobar')} disabled={busy}
          className="rounded-xl bg-emerald-800 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-900 disabled:opacity-50">Aprobar y ejecutar</button>
        <button type="button" onClick={()=>ask(item,'rechazar')} disabled={busy}
          className="rounded-xl border border-rose-200 px-4 py-2.5 text-sm font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-50">Rechazar</button>
      </div>}
    </article>)}
    <OperationConfirmDialog details={confirmation} busy={busy} onConfirm={()=>{void resolve()}} onCancel={()=>{setConfirmation(null);setSelection(null)}}/>
  </section>
}
