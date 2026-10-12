import { useEffect, useState, type FormEvent } from 'react'
import { supabase } from '../api/supabase'

type Opt = { id: number | string; nombre?: string; codigo?: string; diio?: string; estado?: string; activo?: boolean; lote_id?: number; producto_id?: number; total?: number; numero_documento?: string | null }
type Lists = Record<string, Opt[]>
type Field = { key: string; label: string; source?: string; type?: string; optional?: boolean }
type Spec = { title: string; role: 'ADMIN' | 'TODOS'; fields: Field[]; help: string }
const F = (key: string, label: string, source?: string, type?: string, optional?: boolean): Field => ({key,label,source,type,optional})
const S: Record<string, Spec> = {
  compraAnimal: { title:'Compra / ingreso de ternero',role:'ADMIN',help:'DIIO único. Para agregar a lote existente, deja vacío el código de lote nuevo.',
    fields:[F('lote_id','Lote existente (opcional)','lote',undefined,true),F('lote_codigo','Código de lote nuevo',undefined,'text',true),F('proveedor_id','Proveedor','proveedor',undefined,true),
      F('diio','DIIO'),F('raza_id','Raza','raza'),F('sexo','Sexo','sexo'),F('edad','Edad aproximada (días)',undefined,'number'),F('precio','Costo adquisición (CLP)',undefined,'number'),F('peso','Peso inicial (kg)',undefined,'number',true),F('fecha','Fecha',undefined,'date')] },
  peso: {title:'Registrar pesaje',role:'TODOS',help:'Registra la evolución de peso del animal.',fields:[F('animal_id','DIIO','animal'),F('peso','Peso (kg)',undefined,'number'),F('fecha','Fecha',undefined,'date')]},
  fallecimiento: {title:'Registrar fallecimiento',role:'ADMIN',help:'La baja del animal actualiza el conteo y conserva su trazabilidad.',fields:[F('animal_id','DIIO','animal'),F('motivo','Causa / observaciones')]},
  division: {title:'Dividir lote',role:'ADMIN',help:'Selecciona el lote y marca los DIIO que se trasladarán. Se impide dividir lotes con costos o ventas históricas.',fields:[F('lote_id','Lote de origen','lote'),F('codigo','Código lote derivado')]},
  compraInsumo: {title:'Crear compra de insumos',role:'ADMIN',help:'Borrador: el precio es por unidad base del producto. No mueve inventario hasta su confirmación.',fields:[F('proveedor_id','Proveedor','proveedor'),F('producto_id','Producto','producto'),F('presentacion_id','Presentación opcional','presentacion_producto',undefined,true),F('cantidad','Cantidad (unidades base o presentaciones)',undefined,'number'),F('precio','Precio por unidad base',undefined,'number'),F('documento','Documento (opcional)',undefined,'text',true),F('fecha','Fecha',undefined,'date')]},
  confirmar: {title:'Confirmar compra / actualizar PMP',role:'ADMIN',help:'La operación genera el kardex y recalcula costo promedio ponderado. Rechaza borradores con totales inconsistentes.',fields:[F('compra_id','Compra pendiente','compra')]},
  anular: {title:'Anular compra borrador',role:'ADMIN',help:'Una compra confirmada no puede anularse.',fields:[F('compra_id','Compra pendiente','compra')]},
  ajuste: {title:'Ajuste de stock',role:'ADMIN',help:'Variación positiva o negativa, con motivo trazable y validación de existencias.',fields:[F('producto_id','Producto','producto'),F('delta','Variación (+/-)',undefined,'number'),F('motivo','Motivo')]},
  consumo: {title:'Alimentación / consumo real',role:'TODOS',help:'Descuenta stock al PMP actual y registra su costo por lote.',fields:[F('lote_id','Lote','lote'),F('producto_id','Producto','producto'),F('cantidad','Cantidad (unidad base)',undefined,'number'),F('fecha','Fecha',undefined,'date')]},
  tratamiento: {title:'Tratamiento sanitario',role:'TODOS',help:'Imputa al animal el costo del producto descontado desde inventario.',fields:[F('animal_id','DIIO','animal'),F('producto_id','Producto sanitario','producto'),F('cantidad','Cantidad (unidad base)',undefined,'number'),F('motivo','Motivo'),F('fecha','Fecha',undefined,'date')]},
  gasto: {title:'Registrar gasto',role:'ADMIN',help:'Asocia gastos al lote o registra un gasto general.',fields:[F('categoria_id','Categoría','categoria_gasto'),F('lote_id','Lote (opcional)','lote',undefined,true),F('nombre','Concepto'),F('monto','Monto (CLP)',undefined,'number'),F('fecha','Fecha',undefined,'date')]},
  borradorVenta:{title:'Preparar venta (borrador)',role:'ADMIN',help:'Selecciona los DIIO y el valor de venta sin cambiar sus estados. Puedes confirmar o anular más adelante.',fields:[F('comprador','Comprador',undefined,'text',true),F('total','Monto venta (CLP)',undefined,'number'),F('fecha','Fecha',undefined,'date')]},
  confirmarVenta:{title:'Confirmar venta borrador',role:'ADMIN',help:'Congela el ingreso, los costos y los animales seleccionados. Es una operación irreversible.',fields:[F('venta_id','Borrador pendiente','venta')]},
  anularVenta:{title:'Anular venta borrador',role:'ADMIN',help:'Anula el borrador sin modificar el estado de los animales.',fields:[F('venta_id','Borrador pendiente','venta')]},
  venta: {title:'Confirmar venta por DIIO',role:'ADMIN',help:'Selecciona los animales exactos y registra ingreso y costos reconocidos. No se puede deshacer una venta confirmada.',fields:[F('comprador','Comprador',undefined,'text',true),F('total','Monto de venta (CLP)',undefined,'number'),F('fecha','Fecha',undefined,'date')]},
  planDetalle:{title:'Agregar producto a plan',role:'ADMIN',help:'La cantidad se expresa en la unidad base del producto.',fields:[F('plan_id','Plan','plan_consumo'),F('producto_id','Producto','producto'),F('cantidad','Cantidad diaria',undefined,'number')]},
  consumoPlan:{title:'Ejecutar consumo desde plan',role:'TODOS',help:'Aplica el plan diario, descuenta stock y evita repetirlo en la misma fecha.',fields:[F('asignacion_id','Asignación vigente','asignacion_plan_lote'),F('fecha','Fecha',undefined,'date')]},
  asignarPlan:{title:'Asignar plan alimentario a lote',role:'ADMIN',help:'Asigna la alimentación planificada a un lote activo.',fields:[F('plan_id','Plan','plan_consumo'),F('lote_id','Lote','lote'),F('fecha','Fecha de inicio',undefined,'date')]},
  presentacion:{title:'Presentación comercial',role:'ADMIN',help:'Equivalencia entre envase comercial y unidad base del producto.',fields:[F('producto_id','Producto','producto'),F('nombre','Nombre de presentación'),F('cantidad','Cantidad en unidad base',undefined,'number')]},
  conversion:{title:'Conversión de unidades',role:'ADMIN',help:'Solo se admiten conversiones dentro de la misma dimensión (masa o volumen).',fields:[F('producto_id','Producto','producto'),F('origen_id','Unidad origen','unidad_medida'),F('origen_cantidad','Cantidad origen',undefined,'number'),F('destino_id','Unidad destino','unidad_medida'),F('destino_cantidad','Cantidad destino',undefined,'number')]},
  productoEditar:{title:'Actualizar producto',role:'ADMIN',help:'Corrige nombre, stock mínimo o estado, sin alterar movimientos históricos.',fields:[F('producto_id','Producto','producto'),F('nombre','Nombre actualizado'),F('minimo','Stock mínimo',undefined,'number'),F('activo','Estado','estado_activo')]},
  animalRectificar:{title:'Rectificación de animal',role:'ADMIN',help:'Rectifica el sexo con justificación y auditoría; DIIO y costo de compra permanecen inalterados.',fields:[F('animal_id','DIIO','animal'),F('sexo','Sexo','sexo'),F('motivo','Motivo de rectificación')]},
  catalogo:{title:'Crear maestro / catálogo',role:'ADMIN',help:'Registra proveedores, razas, unidades, productos, categorías, lotes o planes.',fields:[F('tipo','Tipo','tipo'),F('nombre','Nombre / código')]},
}
const groups: Record<string, string[]> = {
  Ganadería:['compraAnimal','peso','fallecimiento','division','animalRectificar'],
  Inventario:['compraInsumo','confirmar','anular','ajuste','presentacion','conversion','productoEditar'],
  Producción:['consumo','consumoPlan','tratamiento','planDetalle','asignarPlan'],
  Finanzas:['borradorVenta','confirmarVenta','anularVenta','venta','gasto'],
  Catálogos:['catalogo'],
}
const catalogs = [
  {id:'raza',nombre:'Raza'},{id:'proveedor',nombre:'Proveedor'},
  {id:'categoria_producto',nombre:'Categoría producto'},{id:'categoria_gasto',nombre:'Categoría gasto'},
  {id:'unidad_medida',nombre:'Unidad de medida'},{id:'producto',nombre:'Producto'},
  {id:'plan_consumo',nombre:'Plan de consumo'},{id:'lote',nombre:'Lote vacío'},
]
const base: Record<string,string> = {fecha:new Date().toLocaleDateString('en-CA')}
const n = (v: string) => Number(v)
const optionalN = (v: string) => v ? Number(v) : null
const boxClass='w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-emerald-700'
function label(o: Opt, source: string) {
  if(source==='animal') return o.diio || String(o.id)
  if(source==='lote') return o.codigo || String(o.id)
  if(source==='asignacion_plan_lote') return 'Asignación #' + o.id + ' · lote ' + String(o.lote_id)
  if(source==='venta') return 'Venta #' + o.id
  if(source==='compra') return '#' + o.id + ' · ' + (o.numero_documento || 'Borrador') + ' · ' + String(o.total)
  return o.nombre || o.codigo || String(o.id)
}
async function callOperation(op: string, v: Record<string,string>, selected: number[], batchAnimals: Record<string,unknown>[], batchItems: Record<string,unknown>[]) {
  if(!supabase) throw Error('Supabase no está configurado')
  let method = ''
  let params: Record<string,unknown> = {}
  switch(op){
    case 'presentacion':method='sgic_presentacion';params={p_producto_id:n(v.producto_id),p_nombre:v.nombre,p_cantidad_base:n(v.cantidad)};break
    case 'conversion':method='sgic_conversion';params={p_producto_id:n(v.producto_id),p_unidad_origen_id:n(v.origen_id),p_cantidad_origen:n(v.origen_cantidad),p_unidad_destino_id:n(v.destino_id),p_cantidad_destino:n(v.destino_cantidad)};break
    case 'productoEditar':method='sgic_actualizar_producto';params={p_producto_id:n(v.producto_id),p_nombre:v.nombre,p_stock_minimo:n(v.minimo),p_activo:v.activo==='SI'};break
    case 'animalRectificar':method='sgic_rectificar_animal';params={p_animal_id:n(v.animal_id),p_sexo:v.sexo,p_observacion:v.motivo};break
    case 'catalogo':{
      method='sgic_catalogo'
      const extra:Record<string,unknown>={}
      if(v.tipo==='producto'){extra.categoria_id=n(v.categoria_id);extra.unidad_base_id=n(v.unidad_base_id);extra.stock_minimo=n(v.stock_minimo||'0')}
      if(v.tipo==='unidad_medida'){extra.codigo=v.codigo;extra.tipo=v.tipo_unidad}
      if(v.tipo==='proveedor'){extra.rut=v.rut||null;extra.email=v.email||null}
      if(v.tipo==='lote')extra.fecha_ingreso=v.fecha||base.fecha
      if(v.tipo==='plan_consumo')extra.descripcion=v.descripcion||null
      params={p_tipo:v.tipo,p_nombre:v.nombre,p_opciones:extra};break
    }
    case 'compraAnimal':
      method='sgic_registrar_compra_animales'
      params={p_lote_codigo:v.lote_codigo||'',p_lote_id:optionalN(v.lote_id),
        p_proveedor_id:optionalN(v.proveedor_id),p_fecha:v.fecha,p_animales:[...batchAnimals,{
          diio:v.diio,raza_id:n(v.raza_id),sexo:v.sexo||'MACHO',
          edad_aproximada_dias:n(v.edad||'0'),precio_adquisicion:n(v.precio),
          peso_ingreso_kg:v.peso||null
        }]};break
    case 'peso':method='sgic_registrar_peso';params={p_animal_id:n(v.animal_id),p_peso:n(v.peso),p_fecha:v.fecha};break
    case 'fallecimiento':method='sgic_fallecimiento';params={p_animal_id:n(v.animal_id),p_motivo:v.motivo};break
    case 'division':method='sgic_dividir_lote';params={p_lote_id:n(v.lote_id),p_codigo:v.codigo,p_animales:selected};break
    case 'compraInsumo':
      method='sgic_crear_compra_insumo'
      params={p_proveedor_id:n(v.proveedor_id),p_fecha:v.fecha,p_documento:v.documento||null,
        p_detalles:[...batchItems,{producto_id:n(v.producto_id),cantidad:n(v.cantidad),
          presentacion_id:optionalN(v.presentacion_id),
          ...(v.presentacion_id?{}:{cantidad_base:n(v.cantidad)}),precio_unitario:n(v.precio)}]};break
    case 'confirmar':method='sgic_confirmar_compra_insumo';params={p_compra_id:n(v.compra_id)};break
    case 'anular':method='sgic_anular_borrador_insumo';params={p_compra_id:n(v.compra_id)};break
    case 'ajuste':method='sgic_ajustar_stock';params={p_producto_id:n(v.producto_id),p_delta:n(v.delta),p_motivo:v.motivo};break
    case 'consumo':method='sgic_registrar_consumo';params={p_lote_id:n(v.lote_id),p_producto_id:n(v.producto_id),p_cantidad:n(v.cantidad),p_fecha:v.fecha};break
    case 'tratamiento':method='sgic_registrar_tratamiento';params={p_animal_id:n(v.animal_id),p_producto_id:n(v.producto_id),p_cantidad:n(v.cantidad),p_motivo:v.motivo,p_fecha:v.fecha};break
    case 'gasto':method='sgic_registrar_gasto';params={p_categoria_id:n(v.categoria_id),p_lote_id:optionalN(v.lote_id),p_nombre:v.nombre,p_monto:n(v.monto),p_fecha:v.fecha};break
    case 'borradorVenta':method='sgic_borrador_venta';params={p_animal_ids:selected,p_total:n(v.total),p_comprador:v.comprador||'',p_fecha:v.fecha};break
    case 'confirmarVenta':method='sgic_confirmar_borrador_venta';params={p_venta_id:n(v.venta_id)};break
    case 'anularVenta':method='sgic_anular_borrador_venta';params={p_venta_id:n(v.venta_id)};break
    case 'venta':method='sgic_confirmar_venta';params={p_animal_ids:selected,p_total:n(v.total),p_comprador:v.comprador||'',p_fecha:v.fecha};break
    case 'planDetalle':method='sgic_plan_detalle';params={p_plan_id:n(v.plan_id),p_producto_id:n(v.producto_id),p_cantidad_diaria:n(v.cantidad)};break
    case 'consumoPlan':method='sgic_consumo_desde_plan';params={p_asignacion_id:n(v.asignacion_id),p_fecha:v.fecha};break
    case 'asignarPlan':method='sgic_asignar_plan';params={p_plan_id:n(v.plan_id),p_lote_id:n(v.lote_id),p_inicio:v.fecha};break
    default:throw Error('Operación no soportada')
  }
  const result=await supabase.rpc(method,params)
  if(result.error) throw Error(result.error.message)
  return result.data
}
export function OperationalModules({esAdmin,onChanged}:{esAdmin:boolean;onChanged:()=>void}){
  const [group,setGroup]=useState(esAdmin?'Ganadería':'Producción')
  const [action,setAction]=useState(esAdmin?'compraAnimal':'consumo')
  const [lists,setLists]=useState<Lists>({})
  const [values,setValues]=useState<Record<string,string>>({...base})
  const [selected,setSelected]=useState<number[]>([])
  const [batchAnimals,setBatchAnimals]=useState<Record<string,unknown>[]>([])
  const [batchItems,setBatchItems]=useState<Record<string,unknown>[]>([])
  const [loading,setLoading]=useState(true)
  const [busy,setBusy]=useState(false)
  const [error,setError]=useState('')
  const [ok,setOk]=useState('')
  async function refresh(){
    if(!supabase)return
    setLoading(true)
    const keys=['animal','lote','raza','proveedor','producto','venta','compra_insumo','categoria_producto','unidad_medida','categoria_gasto','plan_consumo','asignacion_plan_lote','presentacion_producto']
    const results=await Promise.all(keys.map(k=>supabase!.from(k).select('*').order('id',{ascending:true}).limit(1000)))
    const next:Lists={}
    results.forEach((r,i)=>{next[keys[i]==='compra_insumo'?'compra':keys[i]]=(r.data||[]) as Opt[]})
    setLists(next)
    if(results.some(r=>r.error))setError('No fue posible cargar todos los catálogos')
    setLoading(false)
  }
  useEffect(()=>{void refresh()},[])
  function pick(g:string){
    setGroup(g)
    const next=groups[g].find(x=>esAdmin||S[x].role==='TODOS')
    if(next)setAction(next)
    setValues({...base});setSelected([]);setBatchAnimals([]);setBatchItems([]);setError('');setOk('')
  }
  const more:Field[]=action==='catalogo'?
    values.tipo==='producto'?[F('categoria_id','Categoría de producto','categoria_producto'),F('unidad_base_id','Unidad base','unidad_medida'),F('stock_minimo','Stock mínimo',undefined,'number',true)]:
    values.tipo==='unidad_medida'?[F('codigo','Código abreviado'),F('tipo_unidad','Tipo (MASA / VOLUMEN)')]:
    values.tipo==='proveedor'?[F('rut','RUT',undefined,'text',true),F('email','Email',undefined,'email',true)]:
    values.tipo==='plan_consumo'?[F('descripcion','Descripción',undefined,'text',true)]:
    values.tipo==='lote'?[F('fecha','Fecha',undefined,'date')]:[] :[]
  function options(source:string){
    if(source==='tipo')return catalogs
    if(source==='estado_activo')return [{id:'SI',nombre:'Activo'},{id:'NO',nombre:'Inactivo'}]
    if(source==='sexo')return [{id:'MACHO',nombre:'Macho'},{id:'HEMBRA',nombre:'Hembra'}]
    const arr=lists[source]||[]
    if(source==='compra'||source==='venta')return arr.filter(o=>o.estado==='BORRADOR')
    if(source==='presentacion_producto')return arr.filter(o=>o.activo!==false && String(o.producto_id)===values.producto_id)
    if(source==='asignacion_plan_lote')return arr.filter(o=>o.activo!==false)
    if(source==='lote'||source==='animal')return arr.filter(o=>o.estado==='ACTIVO')
    return arr.filter(o=>o.activo!==false)
  }
  function addLine(){
    setError('')
    if(action==='compraAnimal'){
      if(!values.diio||!values.raza_id||!values.precio||!values.edad){
        setError('Completa DIIO, raza, precio y edad antes de agregar al lote');return
      }
      setBatchAnimals(prev=>[...prev,{
        diio:values.diio,raza_id:n(values.raza_id),sexo:values.sexo||'MACHO',
        edad_aproximada_dias:n(values.edad),precio_adquisicion:n(values.precio),
        peso_ingreso_kg:values.peso||null
      }])
      setValues(prev=>({...prev,diio:'',raza_id:'',sexo:'',edad:'',precio:'',peso:''}))
    }else if(action==='compraInsumo'){
      if(!values.producto_id||!values.cantidad||!values.precio){
        setError('Completa producto, cantidad y precio antes de agregar el detalle');return
      }
      setBatchItems(prev=>[...prev,{
        producto_id:n(values.producto_id),cantidad:n(values.cantidad),
        presentacion_id:optionalN(values.presentacion_id),
        ...(values.presentacion_id?{}:{cantidad_base:n(values.cantidad)}),
        precio_unitario:n(values.precio)
      }])
      setValues(prev=>({...prev,producto_id:'',presentacion_id:'',cantidad:'',precio:''}))
    }
  }
  async function submit(e:FormEvent){
    e.preventDefault();if(busy)return
    if((action==='venta'||action==='borradorVenta'||action==='division')&&selected.length===0){setError('Seleccione al menos un DIIO activo');return}
    if(['venta','confirmarVenta','fallecimiento','confirmar','ajuste'].includes(action)&&
      !window.confirm('Esta operación registrará cambios auditados. ¿Confirmas?'))return
    setBusy(true);setError('');setOk('')
    try{
      const result=await callOperation(action,values,selected,batchAnimals,batchItems)
      setOk('Operación registrada. Referencia: '+String(result??'confirmada'))
      setValues({...base});setSelected([]);setBatchAnimals([]);setBatchItems([]);await refresh();onChanged()
    }catch(e){
      setError((e instanceof Error?e.message:'Error desconocido')+'. Comprueba el historial antes de repetir, por si ya se registró.')
    }finally{setBusy(false)}
  }
  const candidates=(lists.animal||[]).filter(o=>o.estado==='ACTIVO'&&(action!=='division'||String(o.lote_id)===values.lote_id))
  return <div className="space-y-5">
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
      {Object.keys(groups).filter(g=>esAdmin||['Ganadería','Producción'].includes(g)).map(g=>
        <button key={g} onClick={()=>pick(g)} className={'rounded-2xl border p-4 text-left font-semibold '+(group===g?'border-emerald-700 bg-emerald-50 text-emerald-950':'border-slate-200 bg-white text-slate-700')}>{g}</button>)}
    </div>
    <div className="grid gap-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm lg:grid-cols-[240px_minmax(0,1fr)] sm:p-7">
      <aside className="space-y-2">
        <h2 className="pb-2 text-sm font-semibold uppercase tracking-wider text-slate-500">Acciones</h2>
        {groups[group].filter(k=>esAdmin||S[k].role==='TODOS').map(k=>
          <button key={k} onClick={()=>{setAction(k);setValues({...base});setSelected([]);setBatchAnimals([]);setBatchItems([]);setError('');setOk('')}}
            className={'w-full rounded-xl px-3 py-3 text-left text-sm font-medium '+(action===k?'bg-emerald-900 text-white':'text-slate-600 hover:bg-slate-50')}>{S[k].title}</button>)}
      </aside>
      <section className="space-y-4">
        <div><h2 className="text-lg font-semibold">{S[action].title}</h2><p className="mt-2 text-sm leading-6 text-slate-500">{S[action].help}</p></div>
        {error&&<p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-800">{error}</p>}
        {ok&&<p role="status" className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-900">{ok}</p>}
        <form onSubmit={submit} className="space-y-4">
          {S[action].fields.concat(more).map(f=>
            <label key={f.key} className="block text-sm">
              <span className="mb-1.5 block font-medium">{f.label}</span>
              {f.source?
                <select className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5" disabled={loading||busy}
                  required={!f.optional} value={values[f.key]||''} onChange={e=>setValues({...values,[f.key]:e.target.value})}>
                  <option value="">Seleccionar {f.optional?'(opcional)':''}</option>
                  {options(f.source).map(o=><option key={o.id} value={o.id}>{label(o,f.source!)}</option>)}
                </select>:
                <input className="w-full rounded-xl border border-slate-300 px-3 py-2.5" type={f.type||'text'}
                  min={f.type==='number'&&f.key!=='delta'?'0':undefined} step={f.type==='number'?'any':undefined}
                  disabled={busy} required={!f.optional} value={values[f.key]??(f.type==='date'?base.fecha:'')}
                  onChange={e=>setValues({...values,[f.key]:e.target.value})}/>}
            </label>)}
          {(action==='compraAnimal'||action==='compraInsumo')&&<div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
            <p className="text-sm font-semibold text-emerald-950">
              Detalles agregados: {action==='compraAnimal'?batchAnimals.length:batchItems.length}
            </p>
            {(action==='compraAnimal'?batchAnimals:batchItems).map((entry,i)=>
              <div key={i} className="mt-2 flex items-center justify-between gap-3 rounded-lg bg-white px-3 py-2 text-xs">
                <span>{String(entry.diio||entry.producto_id)} · {String(entry.precio_adquisicion||entry.precio_unitario||0)}</span>
                <button type="button" onClick={()=>{
                  if(action==='compraAnimal')setBatchAnimals(prev=>prev.filter((_,j)=>i!==j))
                  else setBatchItems(prev=>prev.filter((_,j)=>i!==j))
                }} className="font-semibold text-red-700">Quitar</button>
              </div>)}
            <button type="button" disabled={busy} onClick={addLine}
              className="mt-3 rounded-xl border border-emerald-700 px-3 py-2 text-sm font-semibold text-emerald-800 hover:bg-white">
              + Agregar otro {action==='compraAnimal'?'ternero':'producto'}
            </button>
            <p className="mt-2 text-xs text-emerald-900">Al registrar se incluye también el formulario actual. Todos los detalles se guardan en una sola transacción.</p>
          </div>}
          {(action==='venta'||action==='borradorVenta'||action==='division')&&<fieldset className="rounded-xl border border-slate-200 p-4">
            <legend className="px-2 text-sm font-semibold">Seleccionar animales ({selected.length})</legend>
            <div className="max-h-64 space-y-2 overflow-auto">
              {candidates.map(o=><label key={o.id} className="flex items-center gap-3 rounded-lg p-2 text-sm hover:bg-slate-50">
                <input type="checkbox" checked={selected.includes(Number(o.id))} onChange={e=>setSelected(e.target.checked?[...selected,Number(o.id)]:selected.filter(x=>x!==Number(o.id)))}/>
                <span>{o.diio}</span><span className="ml-auto text-xs text-slate-500">Lote {o.lote_id}</span>
              </label>)}
            </div>
          </fieldset>}
          <p className="rounded-xl bg-amber-50 p-3 text-xs leading-6 text-amber-900">Las operaciones producen cambios reales. Compras confirmadas, fallecimientos y ventas no admiten eliminación directa.</p>
          <button disabled={loading||busy} className="w-full rounded-xl bg-emerald-900 px-5 py-3 font-semibold text-white hover:bg-emerald-800 disabled:opacity-50">
            {busy?'Registrando…':'Registrar operación'}
          </button>
        </form>
      </section>
    </div>
  </div>
}
const views:Record<string,string[]> = {
  movimiento_inventario:['tipo','fecha_hora','producto_id','cantidad','costo_total','referencia_tipo'],
  peso_animal:['fecha','animal_id','peso_kg'],
  presentacion_producto:['producto_id','nombre','cantidad_base','activa'],
  conversion_producto:['producto_id','unidad_origen_id','cantidad_origen','unidad_destino_id','cantidad_destino','activa'],
  consumo:['fecha','lote_id','origen'],
  tratamiento:['fecha','animal_id','motivo','costo_total'],
  gasto:['fecha','nombre','monto','lote_id'],
  venta:['fecha','comprador','estado','total_venta'],
  detalle_venta:['venta_id','lote_id','cantidad_animales','ingreso','costo_reconocido','utilidad'],
  plan_consumo:['nombre','activo'],
  asignacion_plan_lote:['lote_id','plan_id','fecha_inicio','activo'],
  registro_auditoria:['fecha_hora','accion','modelo','objeto_id'],
}
export function OperationsHistory({esAdmin}:{esAdmin:boolean}){
  const [view,setView]=useState('movimiento_inventario')
  const [data,setData]=useState<Record<string,unknown>[]>([])
  const [failure,setFailure]=useState('')
  useEffect(()=>{
    let mounted=true
    async function load(){
      if(!supabase)return
      const result=await supabase.from(view).select('*').order('id',{ascending:false}).limit(250)
      if(mounted){
        if(result.error){setFailure(result.error.message);setData([])}
        else{setFailure('');setData((result.data||[]) as Record<string,unknown>[])}
      }
    }
    void load()
    return()=>{mounted=false}
  },[view])
  return <section className="space-y-4">
    <div className="flex flex-wrap gap-2">
      {Object.keys(views).filter(t=>esAdmin||t!=='registro_auditoria').map(t=>
        <button key={t} onClick={()=>setView(t)} className={'rounded-xl border px-3 py-2 text-sm '+(t===view?'border-emerald-900 bg-emerald-900 text-white':'border-slate-200 bg-white text-slate-700')}>
          {t.replaceAll('_',' ')}
        </button>)}
    </div>
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <h2 className="border-b border-slate-100 p-5 font-semibold">Historial · {view.replaceAll('_',' ')}</h2>
      {failure&&<p className="p-5 text-sm text-red-700">{failure}</p>}
      {!failure&&!data.length&&<p className="p-5 text-sm text-slate-500">Sin registros</p>}
      {!failure&&data.length>0&&<div className="overflow-x-auto"><table className="min-w-full text-left text-sm">
        <thead><tr>{['id',...views[view]].map(f=><th key={f} className="whitespace-nowrap p-3 text-xs uppercase text-slate-500">{f.replaceAll('_',' ')}</th>)}</tr></thead>
        <tbody className="divide-y divide-slate-100">{data.map((r,i)=><tr key={String(r.id||i)}>
          {['id',...views[view]].map(f=><td key={f} className="whitespace-nowrap p-3">{r[f]===null?'—':String(r[f]??'')}</td>)}
        </tr>)}</tbody>
      </table></div>}
    </div>
  </section>
}
