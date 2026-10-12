import { useEffect, useState, type FormEvent } from 'react'
import type { ModuleId } from '../components/SidebarNavigation'
import { OperationConfirmDialog, type ConfirmDetails } from '../components/OperationConfirmDialog'
import { supabase } from '../api/supabase'

type Opt = { id: number | string; nombre?: string; codigo?: string; diio?: string; estado?: string; activo?: boolean; lote_id?: number; producto_id?: number; total?: number; numero_documento?: string | null; cantidad_base?: number }
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
  compraInsumo: {title:'Crear compra de insumos',role:'ADMIN',help:'El precio se introduce por saco/presentación cuando lo seleccionas, o por unidad base. Por defecto la compra actualiza stock y PMP. Puedes guardar un borrador.',fields:[F('proveedor_id','Proveedor','proveedor'),F('producto_id','Producto','producto'),F('presentacion_id','Presentación opcional','presentacion_producto',undefined,true),F('cantidad','Cantidad (unidades base o presentaciones)',undefined,'number'),F('precio','Precio unitario de compra',undefined,'number'),F('documento','Documento (opcional)',undefined,'text',true),F('fecha','Fecha',undefined,'date'),F('confirmar_ahora','Al registrar','modo_compra')]},
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
  animalRectificar:{title:'Rectificación de animal',role:'ADMIN',help:'Selecciona un sexo válido y explica el motivo (mínimo cinco caracteres). No necesita fecha; DIIO y costo se conservan.',fields:[F('animal_id','DIIO','animal'),F('sexo','Sexo','sexo'),F('motivo','Motivo de rectificación')]},
  catalogo:{title:'Crear maestro / catálogo',role:'ADMIN',help:'Registra proveedores, razas, unidades, productos, categorías, lotes o planes.',fields:[F('tipo','Tipo','tipo'),F('nombre','Nombre / código')]},
}
const contextualActions: Partial<Record<ModuleId,string[]>> = {
  animales:['compraAnimal','peso','fallecimiento','animalRectificar'],
  lotes:['division','catalogo'],
  inventario:['ajuste','presentacion','conversion','productoEditar','catalogo'],
  compras:['compraInsumo'],
  planes:['consumo','consumoPlan','planDetalle','asignarPlan','catalogo'],
  sanidad:['tratamiento'],
  ventas:['venta','borradorVenta'],
  gastos:['gasto'],
  catalogos:['catalogo'],
}
const contextualLabels:Record<string,string>={
  compraAnimal:'Compra manual de animales',peso:'Registrar pesaje',fallecimiento:'Fallecimiento',
  animalRectificar:'Rectificar',division:'Dividir lote',compraInsumo:'Comprar insumos',
  ajuste:'Ajustar stock',presentacion:'Crear presentación',conversion:'Crear conversión',
  productoEditar:'Editar producto',catalogo:'Crear nuevo registro',
  consumo:'Registrar consumo',consumoPlan:'Aplicar plan',planDetalle:'Añadir alimento al plan',
  asignarPlan:'Asignar plan',tratamiento:'Registrar tratamiento',venta:'Registrar venta',
  borradorVenta:'Solicitar venta',gasto:'Registrar gasto',
}
export function getModuleActions(module:ModuleId,esAdmin:boolean){
  return (contextualActions[module]??[]).filter(id=>esAdmin||S[id].role==='TODOS')
    .map(id=>({id,label:contextualLabels[id]??S[id].title}))
}
const catalogs = [
  {id:'raza',nombre:'Raza'},{id:'proveedor',nombre:'Proveedor'},
  {id:'categoria_producto',nombre:'Categoría producto'},{id:'categoria_gasto',nombre:'Categoría gasto'},
  {id:'unidad_medida',nombre:'Unidad de medida'},{id:'producto',nombre:'Producto'},
  {id:'plan_consumo',nombre:'Plan de consumo'},{id:'lote',nombre:'Lote vacío'},
]
const fechaLocal=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`}
const base=():Record<string,string>=>({fecha:fechaLocal(),confirmar_ahora:'SI'})
const n = (v: string) => Number(v.replace(',','.'))
const optionalN = (v: string) => v ? n(v) : null
const money=(v:number)=>new Intl.NumberFormat('es-CL',{style:'currency',currency:'CLP',maximumFractionDigits:2}).format(v)
const round2=(v:number)=>Math.round((v+Number.EPSILON)*100)/100
function purchaseLine(v:Record<string,string>,lists:Lists):Record<string,unknown>|null {
  if(!v.producto_id&&!v.cantidad&&!v.precio&&!v.presentacion_id)return null
  const cantidad=n(v.cantidad),precio=n(v.precio)
  if(!v.producto_id||!v.cantidad||!v.precio||!Number.isFinite(cantidad)||cantidad<=0||!Number.isFinite(precio)||precio<=0)
    throw Error('Completa producto, cantidad positiva y precio válido.')
  const pack=v.presentacion_id?(lists.presentacion_producto||[]).find(x=>String(x.id)===v.presentacion_id):undefined
  if(v.presentacion_id&&(!pack||String(pack.producto_id)!==v.producto_id))throw Error('Presentación no válida para el producto.')
  const factor=pack?Number(pack.cantidad_base):1
  if(!Number.isFinite(factor)||factor<=0)throw Error('Factor de presentación inválido.')
  const cantidadBase=Math.round(cantidad*factor*1000)/1000
  const precioBase=round2(precio/factor)
  if(cantidadBase<=0||precioBase<=0)throw Error('Cantidad o precio demasiado pequeño.')
  return {producto_id:Number(v.producto_id),cantidad,presentacion_id:optionalN(v.presentacion_id),cantidad_base:cantidadBase,precio_unitario:precioBase}
}
const subtotal=(i:Record<string,unknown>)=>round2(Number(i.cantidad_base)*Number(i.precio_unitario))
const boxClass='w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-emerald-700'
function label(o: Opt, source: string) {
  if(source==='animal') return o.diio || String(o.id)
  if(source==='lote') return o.codigo || String(o.id)
  if(source==='asignacion_plan_lote') return 'Asignación #' + o.id + ' · lote ' + String(o.lote_id)
  if(source==='venta') return 'Venta #' + o.id
  if(source==='compra') return '#' + o.id + ' · ' + (o.numero_documento || 'Borrador') + ' · ' + String(o.total)
  return o.nombre || o.codigo || String(o.id)
}
async function callOperation(op: string, v: Record<string,string>, selected: number[], batchAnimals: Record<string,unknown>[], batchItems: Record<string,unknown>[], lists:Lists) {
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
      if(v.tipo==='lote')extra.fecha_ingreso=v.fecha||fechaLocal()
      if(v.tipo==='plan_consumo')extra.descripcion=v.descripcion||null
      params={p_tipo:v.tipo,p_nombre:v.nombre,p_opciones:extra};break
    }
    case 'compraAnimal':
      method='sgic_registrar_compra_animales'
      params={p_lote_codigo:v.lote_codigo||'',p_lote_id:optionalN(v.lote_id),
        p_proveedor_id:optionalN(v.proveedor_id),p_fecha:v.fecha,p_animales:[...batchAnimals,...(v.diio?.trim()?[{
          diio:v.diio.trim(),raza_id:n(v.raza_id),sexo:v.sexo||'MACHO',
          edad_aproximada_dias:n(v.edad||'0'),precio_adquisicion:n(v.precio),
          peso_ingreso_kg:v.peso||null
        }]:[])]};break
    case 'peso':method='sgic_registrar_peso';params={p_animal_id:n(v.animal_id),p_peso:n(v.peso),p_fecha:v.fecha};break
    case 'fallecimiento':method='sgic_fallecimiento';params={p_animal_id:n(v.animal_id),p_motivo:v.motivo};break
    case 'division':method='sgic_dividir_lote';params={p_lote_id:n(v.lote_id),p_codigo:v.codigo,p_animales:selected};break
    case 'compraInsumo':{
      const actual=purchaseLine(v,lists)
      const items=[...batchItems,...(actual?[actual]:[])]
      if(!items.length)throw Error('Añade al menos un producto.')
      method=v.confirmar_ahora==='NO'?'sgic_crear_compra_insumo':'sgic_comprar_insumo'
      params={p_proveedor_id:n(v.proveedor_id),p_fecha:v.fecha,p_documento:v.documento||null,p_detalles:items}
      break
    }
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
export function OperationalModules({
  esAdmin, onChanged, module, initialAction, onClose,
}:{
  esAdmin:boolean; onChanged:()=>void; module:ModuleId; initialAction:string; onClose:()=>void
}){
  const allowed=getModuleActions(module,esAdmin)
  const action=initialAction
  const fixedCatalogType=action==='catalogo'
    ? module==='lotes'?'lote':module==='inventario'?'producto':module==='planes'?'plan_consumo':null
    :null
  const initialValues=()=>({...base(),...(fixedCatalogType?{tipo:fixedCatalogType}:{})})
  const [lists,setLists]=useState<Lists>({})
  const [values,setValues]=useState<Record<string,string>>(initialValues)
  const [selected,setSelected]=useState<number[]>([])
  const [batchAnimals,setBatchAnimals]=useState<Record<string,unknown>[]>([])
  const [batchItems,setBatchItems]=useState<Record<string,unknown>[]>([])
  const [loading,setLoading]=useState(true)
  const [busy,setBusy]=useState(false)
  const [error,setError]=useState('')
  const [ok,setOk]=useState('')
  const [confirmDetails,setConfirmDetails]=useState<ConfirmDetails|null>(null)
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
  const more:Field[]=action==='catalogo'?
    values.tipo==='producto'?[F('categoria_id','Categoría de producto','categoria_producto'),F('unidad_base_id','Unidad base','unidad_medida'),F('stock_minimo','Stock mínimo',undefined,'number',true)]:
    values.tipo==='unidad_medida'?[F('codigo','Código abreviado'),F('tipo_unidad','Tipo (MASA / VOLUMEN)')]:
    values.tipo==='proveedor'?[F('rut','RUT',undefined,'text',true),F('email','Email',undefined,'email',true)]:
    values.tipo==='plan_consumo'?[F('descripcion','Descripción',undefined,'text',true)]:
    values.tipo==='lote'?[F('fecha','Fecha',undefined,'date')]:[] :[]
  function options(source:string){
    if(source==='tipo')return catalogs
    if(source==='estado_activo')return [{id:'SI',nombre:'Activo'},{id:'NO',nombre:'Inactivo'}]
    if(source==='modo_compra')return [{id:'SI',nombre:'Confirmar ahora: ingresar stock y actualizar PMP'},{id:'NO',nombre:'Enviar a Solicitudes pendientes: no ingresa inventario'}]
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
      if(batchAnimals.some(item=>item.diio===values.diio.trim())){setError('DIIO repetido en el detalle del lote.');return}
      setBatchAnimals(prev=>[...prev,{
        diio:values.diio,raza_id:n(values.raza_id),sexo:values.sexo||'MACHO',
        edad_aproximada_dias:n(values.edad),precio_adquisicion:n(values.precio),
        peso_ingreso_kg:values.peso||null
      }])
      setValues(prev=>({...prev,diio:'',raza_id:'',sexo:'',edad:'',precio:'',peso:''}))
    }else if(action==='compraInsumo'){
      try {
        const line=purchaseLine(values,lists)
        if(!line)throw Error('Completa un producto.')
        setBatchItems(prev=>[...prev,line])
        setValues(prev=>({...prev,producto_id:'',presentacion_id:'',cantidad:'',precio:''}))
      }catch(e){setError(e instanceof Error?e.message:'Línea inválida')}
    }
  }
  async function submit(e:FormEvent){
    e.preventDefault();if(busy)return
    if(action==='compraAnimal'){
      const partial=['diio','raza_id','sexo','edad','precio','peso'].some(k=>Boolean((values[k]||'').trim()))
      if(!partial && !batchAnimals.length){setError('Agrega al menos un animal.');return}
      if(partial && (!values.diio?.trim() || !values.raza_id || !values.precio || !values.edad)){
        setError('Completa el último animal o deja sus campos vacíos para registrar el detalle agregado.');return
      }
    }
    prepareSubmit()
  }
  function prepareSubmit(){
    if((action==='venta'||action==='borradorVenta'||action==='division')&&selected.length===0){setError('Seleccione al menos un DIIO activo');return}
    if(action==='animalRectificar'&&(!values.animal_id||!['MACHO','HEMBRA'].includes(values.sexo)||(values.motivo||'').trim().length<5)){
      setError('Selecciona un animal y su sexo correcto. Explica el motivo con al menos 5 caracteres.');return
    }
    let details:ConfirmDetails|null=null
    if(action==='compraInsumo'){
      try {
        const current=purchaseLine(values,lists)
        const items=[...batchItems,...(current?[current]:[])]
        if(!items.length)throw Error('Agrega al menos un producto.')
        const amount=items.reduce((sum,item)=>sum+subtotal(item),0)
        const immediate=values.confirmar_ahora!=='NO'
        details={
          title:immediate?'Confirmar compra':'Enviar solicitud de compra',
          description:immediate
            ?`Monto: ${money(amount)}. Se actualizarán las existencias, el kardex y el costo promedio. Revisa los precios antes de continuar.`
            :`Monto: ${money(amount)}. La compra quedará en Solicitudes pendientes y no modificará el inventario.`,
          confirmLabel:immediate?'Confirmar compra':'Enviar a pendientes'
        }
      }catch(e){setError(e instanceof Error?e.message:'Compra inválida');return}
    }else if(action==='fallecimiento'){
      details={title:'Registrar fallecimiento',description:'El animal quedará identificado como fallecido y se descontará del conteo del lote. El historial se conservará.',confirmLabel:'Confirmar fallecimiento',danger:true}
    }else if(action==='ajuste'){
      details={title:'Aplicar ajuste al inventario',description:`Variación de ${values.delta||'0'} unidades. Motivo: ${values.motivo||'Sin motivo'}. Quedará registrada en el kardex y la auditoría.`,confirmLabel:'Aplicar ajuste',danger:n(values.delta||'0')<0}
    }else if(action==='venta'||action==='confirmarVenta'){
      details={title:'Confirmar venta',description:'Se cerrará la venta de los DIIO seleccionados y se reconocerán sus costos. No puede deshacerse directamente.',confirmLabel:'Confirmar venta',danger:true}
    }else if(action==='borradorVenta'){
      details={title:'Solicitar aprobación de venta',description:'Los animales no cambiarán de estado hasta la aprobación en Solicitudes pendientes.',confirmLabel:'Enviar solicitud'}
    }else if(action==='animalRectificar'){
      details={title:'Guardar rectificación',description:'Se corregirá el sexo registrado y se conservará el motivo en la auditoría.',confirmLabel:'Guardar corrección'}
    }
    if(details){setConfirmDetails(details);return}
    void executeOperation()
  }
  async function executeOperation(){
    if(busy)return
    setConfirmDetails(null)
    setBusy(true);setError('');setOk('')
    try{
      const result=await callOperation(action,values,selected,batchAnimals,batchItems,lists)
      setOk(action==='compraInsumo' ? (values.confirmar_ahora==='NO' ? `Solicitud #${result} enviada a Pendientes. No modifica inventario.` : `Compra #${result} confirmada. Stock, kardex y PMP actualizados.`) : 'Operación registrada. Referencia: '+String(result??'confirmada'))
      setValues(initialValues());setSelected([]);setBatchAnimals([]);setBatchItems([]);await refresh();onChanged()
    }catch(e){
      setError((e instanceof Error?e.message:'Error desconocido') + (action==='animalRectificar'?'. Selecciona sexo y un motivo con al menos cinco caracteres.':'. Comprueba el historial antes de repetir, por si ya se registró.'))
    }finally{setBusy(false)}
  }
  let preview:Record<string,unknown>|null=null
  try{if(action==='compraInsumo')preview=purchaseLine(values,lists)}catch{/* la validación muestra el mensaje al enviar */}
  const previewItems=action==='compraInsumo'?[...batchItems,...(preview?[preview]:[])]:[]
  const previewTotal=previewItems.reduce((sum,item)=>sum+subtotal(item),0)
  const precioPresentacion=action==='compraInsumo'&&Boolean(values.presentacion_id)
  const candidates=(lists.animal||[]).filter(o=>o.estado==='ACTIVO'&&(action!=='division'||String(o.lote_id)===values.lote_id))
  if(!allowed.some(item=>item.id===action)) return null
  const panelTitle=action==='catalogo'&&fixedCatalogType
    ?fixedCatalogType==='lote'?'Crear lote':fixedCatalogType==='producto'?'Crear producto':'Crear plan de alimentación'
    :S[action].title
  return <section className="rounded-2xl border border-emerald-200 bg-white p-5 shadow-md shadow-emerald-900/5 sm:p-7" aria-label={panelTitle}>
    <div className="mb-5 flex flex-wrap items-start justify-between gap-4 border-b border-slate-100 pb-5">
      <div>
        <p className="mb-2 text-xs font-bold uppercase tracking-widest text-emerald-700">Nueva operación · {panelTitle}</p>
        <h2 className="text-xl font-semibold tracking-tight text-slate-900">{panelTitle}</h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">{S[action].help}</p>
      </div>
      <button type="button" onClick={onClose} disabled={busy} aria-label="Cerrar formulario" title="Cerrar formulario"
        className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 disabled:opacity-50">
        <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
      </button>
    </div>
    {error&&<p role="alert" className="mb-4 rounded-xl bg-red-50 p-3 text-sm text-red-800">{error}</p>}
    {ok&&<p role="status" className="mb-4 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-900">{ok}</p>}
    <div className="max-w-3xl">
        <form onSubmit={submit} className="space-y-4">
          {S[action].fields.concat(more).map(f=>f.key==='tipo'&&fixedCatalogType?null:
            <label key={f.key} className="block text-sm">
              <span className="mb-1.5 block font-medium">{action==='compraInsumo'&&f.key==='precio'
                ?(precioPresentacion?'Precio de cada presentación (CLP)':'Precio por unidad base (CLP)')
                :f.label}</span>
              {f.source?
                <select className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5" disabled={loading||busy}
                  required={!f.optional && !(action==='compraInsumo'&&batchItems.length>0&&f.key==='producto_id') && !(action==='compraAnimal'&&batchAnimals.length>0&&['raza_id','sexo'].includes(f.key))} value={values[f.key]||''} onChange={e=>setValues({...values,[f.key]:e.target.value})}>
                  <option value="">Seleccionar {f.optional?'(opcional)':''}</option>
                  {options(f.source).map(o=><option key={o.id} value={o.id}>{label(o,f.source!)}</option>)}
                </select>:
                <input className="w-full rounded-xl border border-slate-300 px-3 py-2.5" type={f.type==='number'?'text':f.type||'text'} inputMode={f.type==='number'?'decimal':undefined}
                  pattern={f.type==='number'?'-?[0-9]+([.,][0-9]+)?':undefined}
                  disabled={busy} required={!f.optional && !(action==='compraInsumo'&&batchItems.length>0&&['cantidad','precio'].includes(f.key)) && !(action==='compraAnimal'&&batchAnimals.length>0&&['diio','edad','precio'].includes(f.key))} minLength={action==='animalRectificar'&&f.key==='motivo'?5:undefined} value={values[f.key]??(f.type==='date'?fechaLocal():'')}
                  onChange={e=>setValues({...values,[f.key]:e.target.value})}/>}
            </label>)}
          {action==='compraInsumo'&&<div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-950">
            <p className="font-semibold">Resumen de compra</p>
            <p className="mt-1">{precioPresentacion?'El precio ingresado corresponde a cada saco o presentación.':'El precio corresponde a cada unidad base del producto.'}</p>
            {preview&&<p className="mt-1">Cantidad base: {String(preview.cantidad_base)} · costo por unidad base: {money(Number(preview.precio_unitario))}.</p>}
            <p className="mt-2 font-semibold">Importe total: {money(previewTotal)}</p>
            <p className="mt-1 text-xs">Si confirmas ahora se actualizarán inventario y PMP. Si guardas borrador, sus existencias no cambian.</p>
          </div>}
          {(action==='compraAnimal'||action==='compraInsumo')&&<div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
            <p className="text-sm font-semibold text-emerald-950">
              Detalles agregados: {action==='compraAnimal'?batchAnimals.length:batchItems.length}
            </p>
            {(action==='compraAnimal'?batchAnimals:batchItems).map((entry,i)=>
              <div key={i} className="mt-2 flex items-center justify-between gap-3 rounded-lg bg-white px-3 py-2 text-xs">
                <span>{String(entry.diio||entry.producto_id)} · {action==='compraInsumo'?`${String(entry.cantidad_base)} unidades base · ${money(subtotal(entry))}`:String(entry.precio_adquisicion||0)}</span>
                <button type="button" onClick={()=>{
                  if(action==='compraAnimal')setBatchAnimals(prev=>prev.filter((_,j)=>i!==j))
                  else setBatchItems(prev=>prev.filter((_,j)=>i!==j))
                }} className="font-semibold text-red-700">Quitar</button>
              </div>)}
            <button type="button" disabled={busy} onClick={addLine}
              className="mt-3 rounded-xl border border-emerald-700 px-3 py-2 text-sm font-semibold text-emerald-800 hover:bg-white">
              + Agregar otro {action==='compraAnimal'?'ternero':'producto'}
            </button>
            <p className="mt-2 text-xs text-emerald-900">Se incluirá el formulario actual solo cuando contenga datos completos. Todos los detalles se registran en una transacción.</p>
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
            {busy?'Registrando…':action==='compraInsumo'?(values.confirmar_ahora==='NO'?'Guardar borrador':'Comprar y actualizar inventario'):'Registrar operación'}
          </button>
        </form>
    </div>
    <OperationConfirmDialog details={confirmDetails} busy={busy} onConfirm={()=>{void executeOperation()}} onCancel={()=>setConfirmDetails(null)}/>
  </section>
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
