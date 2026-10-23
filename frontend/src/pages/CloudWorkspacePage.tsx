import { CatalogOverview } from './CatalogOverview'
import { useWorkspaceNavigation } from '../hooks/useWorkspaceNavigation'
import { TableScroll } from '../components/TableScroll'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../api/supabase'
import { useAuth } from '../auth/AuthContext'
import { OperationalModules, OperationsHistory, getModuleActions } from './OperationalModules'
import { SidebarNavigation, moduleTitles } from '../components/SidebarNavigation'
import { DomainRecords } from './DomainRecords'
import { UserManagement } from './UserManagement'
import { ProfitabilityReport } from './ProfitabilityReport'
import { SupplyHistory } from './SupplyHistory'
import { StockPresentations } from '../components/StockPresentations'
import type { PresentacionStock } from '../utils/presentationStock'
import { SupplyOperations, supplyActions } from './SupplyOperations'
import { PlansOverview } from './PlansOverview'
import { PendingRequests } from './PendingRequests'
import { SipecSyncPreview } from './SipecSyncPreview'
import { SaleIndividualPrices } from './SaleIndividualPrices'
import { AnimalCard, type AnimalRecord } from './AnimalCard'
import { MatusFooter } from '../components/MatusFooter'

type Animal = AnimalRecord
type Lote = { id: number; codigo: string; cantidad_actual: number; estado: string }
type Producto = { id: number; nombre: string; stock_actual: number; stock_minimo: number; costo_promedio: number; tipo_insumo:string; unidad_medida:{codigo:string}|null }
type Proveedor = { id: number; nombre: string }
type CompraAnimal = { id: number; fecha: string; total: number; proveedor_id: number|null }
type CompraInsumo = { id: number; proveedor_id: number; fecha: string; total: number; estado: string; numero_documento: string | null }
type DetalleCompraAnimal = { compra_id:number; animal_id:number }
type DetalleCompraInsumo = { compra_id:number; producto_id:number; cantidad:number; cantidad_base:number; subtotal:number }
type Datos = {
  animales: Animal[]; razas: {id:number;nombre:string}[]; lotes: Lote[]; productos: Producto[]; presentaciones: PresentacionStock[]
  proveedores: Proveedor[]; comprasAnimal: CompraAnimal[]; comprasInsumo: CompraInsumo[]; detalleAnimales: DetalleCompraAnimal[]; detalleInsumos: DetalleCompraInsumo[]
}
const formatoDinero = (n: number) => new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(n)
const formatoCantidad = (n: number) => new Intl.NumberFormat('es-CL', { maximumFractionDigits: 3 }).format(n)
function Indicador({ nombre, valor, nota, onClick }: { nombre: string; valor: string; nota: string; onClick:()=>void }) {
  return (
    <button type="button" onClick={onClick} className="group w-full rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-md focus-visible:ring-2 focus-visible:ring-emerald-500">
      <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">{nombre}</p>
      <p className="mt-3 text-2xl font-semibold tracking-tight text-slate-900">{valor}</p>
      <p className="mt-2 text-xs text-slate-500">{nota} <span className="font-semibold text-emerald-700 group-hover:underline">· Ver detalle →</span></p>
    </button>
  )
}

function Estado({ valor }: { valor: string }) {
  const activo = valor === 'ACTIVO' || valor === 'ACTIVA' || valor === 'CONFIRMADA'
  const fallecido = valor === 'FALLECIDO'
  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${activo ? 'bg-emerald-50 text-emerald-700' : fallecido ? 'bg-rose-100 text-rose-800' : 'bg-slate-100 text-slate-600'}`}>
      {valor}
    </span>
  )
}

function TablaVacia({ texto }: { texto: string }) {
  return <p className="rounded-xl bg-slate-50 px-5 py-9 text-center text-sm text-slate-500">{texto}</p>
}

export function CloudWorkspacePage() {
  const { user, esAdmin, logout } = useAuth()
  const navigate = useNavigate()
  const {tab,operation,catalogType,animalCard,buscar,filtroAnimal,abrirModulo,setBuscar,setFiltroAnimal,
    openOperation,closeOperation,openAnimal,closeAnimal,setAnimalAction}=useWorkspaceNavigation()
  const [menuOpen,setMenuOpen] = useState(false)
  const [datos, setDatos] = useState<Datos | null>(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [revision, setRevision] = useState(0)
  const [supplyNotice,setSupplyNotice]=useState<{module:'compras'|'inventario';message:string}|null>(null)
  const [seguimientoLoteId,setSeguimientoLoteId]=useState<number|null>(null)
  const [asignacionDiaId,setAsignacionDiaId]=useState<number|null>(null)

  useEffect(() => {
    let vigente = true

    async function cargar() {
      if (!supabase) {
        setError('Falta configurar el cliente Supabase.')
        setCargando(false)
        return
      }

      setCargando(true)
      setError('')
      try {
        const [a, l, p, pr, ca, ci, da, di, ra, pp] = await Promise.all([
          supabase.from('animal').select('id,diio,lote_id,raza_id,sexo,estado,precio_adquisicion,peso_ingreso_kg,fecha_nacimiento,fecha_adquisicion,edad_aproximada_dias,observaciones').order('diio').limit(1000),
          supabase.from('lote').select('id,codigo,cantidad_actual,estado').order('codigo').limit(500),
          supabase.from('producto').select('id,nombre,stock_actual,stock_minimo,costo_promedio,tipo_insumo,unidad_medida(codigo)').order('nombre').limit(500),
          supabase.from('proveedor').select('id,nombre').order('nombre').limit(200),
          supabase.from('compra_animal').select('id,fecha,total,proveedor_id').order('fecha', { ascending: false }).limit(300),
          supabase.from('compra_insumo').select('id,fecha,total,estado,numero_documento,proveedor_id').order('fecha', { ascending: false }).limit(300),
          supabase.from('detalle_compra_animal').select('compra_id,animal_id').limit(1000),
          supabase.from('detalle_compra_insumo').select('compra_id,producto_id,cantidad,cantidad_base,subtotal').limit(1000),
          supabase.from('raza').select('id,nombre').order('nombre').limit(1000),
          supabase.from('presentacion_producto').select('id,producto_id,nombre,cantidad_base,activa').eq('activa',true).order('id',{ascending:false}).limit(1000),
        ])
        const fallo = [a.error, l.error, p.error, pr.error, ca.error, ci.error, da.error, di.error, ra.error, pp.error].find(Boolean)
        if (fallo) throw new Error(fallo.message)
        if (vigente) {
          setDatos({
            animales: (a.data ?? []) as Animal[],
            razas: ra.data??[],
            lotes: (l.data ?? []) as Lote[],
            productos: (p.data ?? []) as unknown as Producto[],
            presentaciones: (pp.data ?? []) as PresentacionStock[],
            proveedores: (pr.data ?? []) as Proveedor[],
            comprasAnimal: (ca.data ?? []) as CompraAnimal[],
            comprasInsumo: (ci.data ?? []) as CompraInsumo[],
            detalleAnimales:(da.data??[]) as DetalleCompraAnimal[],
            detalleInsumos:(di.data??[]) as DetalleCompraInsumo[],
          })
        }
      } catch {
        if (vigente) setError('No fue posible cargar los registros. Verifique la conexión y los permisos de la cuenta.')
      } finally {
        if (vigente) setCargando(false)
      }
    }

    void cargar()
    return () => { vigente = false }
  }, [revision])

  const lotesPorId = useMemo(() => new Map((datos?.lotes ?? []).map(l => [l.id, l.codigo])), [datos])
  const razasPorId = new Map((datos?.razas??[]).map(r=>[r.id,r.nombre]))
  const fichaAnimal = datos?.animales.find(a=>a.id===animalCard?.id)
  const listaAnimales = (datos?.animales ?? []).filter(a =>
    (filtroAnimal==='TODOS'||a.estado===filtroAnimal) && (a.diio.toLowerCase().includes(buscar.trim().toLowerCase()) || (razasPorId.get(a.raza_id)??'').toLowerCase().includes(buscar.trim().toLowerCase()) ||
    (lotesPorId.get(a.lote_id) ?? '').toLowerCase().includes(buscar.toLowerCase())),
  )
  const listaProductos = (datos?.productos ?? []).filter(p => p.nombre.toLowerCase().includes(buscar.toLowerCase()))
  const presentacionesPorProducto = useMemo(() => {
    const agrupadas = new Map<number, PresentacionStock[]>()
    for (const presentacion of datos?.presentaciones ?? []) {
      const lista = agrupadas.get(presentacion.producto_id) ?? []
      lista.push(presentacion)
      agrupadas.set(presentacion.producto_id, lista)
    }
    return agrupadas
  }, [datos])
  const bajas = (datos?.animales ?? []).filter(a=>a.estado==='FALLECIDO').reduce((s,a)=>s+Number(a.precio_adquisicion),0)
  const adquisiciones = (datos?.animales ?? []).filter(a=>a.estado==='ACTIVO').reduce((s, a) => s + Number(a.precio_adquisicion), 0)
  const valorStock = (datos?.productos ?? []).reduce((s, p) => s + Number(p.stock_actual) * Number(p.costo_promedio), 0)
  const demo = (datos?.animales ?? []).some(a => a.diio.startsWith('DEMO-'))
  const animalesActivos = (datos?.animales ?? []).filter(a => a.estado === 'ACTIVO').length
  const faltantes = (datos?.productos ?? []).filter(p => Number(p.stock_actual) <= Number(p.stock_minimo)).length

  const availableActions=getModuleActions(tab,esAdmin)
  const visibleActions=tab==='animales'&&esAdmin
    ? [{id:'sipecSync',label:'Sincronizar con SIPECweb'},...availableActions]
    : tab==='ventas'&&esAdmin
      ? [...availableActions,{id:'ventaIndividual',label:'Venta con precios por DIIO'}]
      : availableActions

  function salir() {
    logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className="sgic-shell min-h-screen bg-[#f4f7f6] text-slate-900 lg:flex">
      <SidebarNavigation current={tab} esAdmin={esAdmin} open={menuOpen}
        onClose={()=>setMenuOpen(false)} onNavigate={abrirModulo}/>
      <div className="flex min-h-screen min-w-0 flex-1 flex-col">
        <header className="app-header border-b border-slate-200 bg-white">
          <div className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-3 px-4 py-3 sm:flex-nowrap sm:py-4 sm:px-7 lg:px-9">
            <div className="flex w-full min-w-0 items-center gap-3 sm:w-auto">
              <button type="button" aria-label="Abrir menú principal" aria-expanded={menuOpen}
                className="rounded-xl border border-slate-200 p-2.5 text-slate-700 hover:bg-slate-50 lg:hidden"
                onClick={()=>setMenuOpen(true)}>
                <svg aria-hidden="true" width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 6h16M4 12h16M4 18h16"/></svg>
              </button>
              <div className="min-w-0">
                <div className="text-[11px] font-semibold uppercase tracking-widest text-emerald-700">SGIC · Gestión integral</div>
                <h1 className="truncate text-xl font-semibold tracking-tight text-slate-900">{moduleTitles[tab]}</h1>
              </div>
            </div>
            <div className="flex w-full shrink-0 items-center justify-end gap-3 sm:w-auto sm:gap-5">
              <button type="button" onClick={()=>setRevision(x=>x+1)}
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50">Actualizar</button>
              <div className="hidden text-right md:block">
                <div className="text-sm font-semibold">{user?.username}</div>
                <div className="text-xs text-slate-500">{esAdmin?'Administrador':'Operador'}</div>
              </div>
              <button type="button" onClick={salir} className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">Salir</button>
            </div>
          </div>
        </header>
        <main className="app-main mx-auto w-full min-w-0 max-w-[1440px] flex-1 space-y-4 px-3 py-4 sm:px-7 lg:px-9 lg:py-8">
          {tab==='resumen'&&<section className="rounded-3xl bg-gradient-to-r from-emerald-950 via-emerald-900 to-teal-800 px-6 py-7 text-white shadow-lg sm:px-9">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-200">Centro de operaciones</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">Control ganadero</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-emerald-100">
              Accede a la gestión del ganado, inventario, producción y finanzas desde el menú lateral.
            </p>
          </section>}
          {demo&&<div role="status" className="rounded-xl border border-amber-200 bg-amber-50 px-5 py-3 text-sm text-amber-950">
            <strong>Entorno de demostración.</strong> Los registros DEMO son ficticios y no corresponden a operaciones empresariales reales.
          </div>}
        {supplyNotice?.module===tab&&<div role="status" className="flex items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-5 py-3 text-sm text-emerald-950"><span>{supplyNotice.message}</span><button type="button" className="shrink-0 font-semibold underline" onClick={()=>setSupplyNotice(null)}>Cerrar aviso</button></div>}
        {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}
        {cargando && !datos && <div className="py-14 text-center text-sm text-slate-500">Cargando información desde Supabase…</div>}

        {!error && datos && (
          <>
            {visibleActions.length>0&&<section aria-label={'Acciones de '+moduleTitles[tab]} className="space-y-4">
              {tab!=='catalogos'&&<div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-sm sm:px-5">
                <div>
                  <h2 className="text-sm font-semibold text-slate-900">Acciones de {moduleTitles[tab]}</h2>
                  <p className="mt-1 text-xs text-slate-500">Selecciona una acción para abrir su formulario aquí.</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {visibleActions.map(item=><button type="button" key={item.id}
                    onClick={()=>{if(item.id==='consumoPlan')setAsignacionDiaId(null);operation===item.id?closeOperation():openOperation(item.id)}}
                    aria-expanded={operation===item.id}
                    className={`rounded-xl border px-3.5 py-2.5 text-sm font-semibold transition ${operation===item.id
                      ?'border-emerald-800 bg-emerald-800 text-white'
                      :'border-emerald-200 bg-emerald-50 text-emerald-900 hover:border-emerald-500 hover:bg-emerald-100'}`}>
                    {item.label}
                  </button>)}
                </div>
              </div>}
              {operation==='sipecSync'&&tab==='animales'&&esAdmin&&
                <SipecSyncPreview onClose={closeOperation} onChanged={()=>setRevision(x=>x+1)} onNavigate={abrirModulo}/>}
              {operation==='ventaIndividual'&&tab==='ventas'&&esAdmin&&
                <SaleIndividualPrices onClose={closeOperation} onChanged={()=>setRevision(x=>x+1)}/>}
              {operation&&supplyActions.includes(operation)&&availableActions.some(item=>item.id===operation)&&<SupplyOperations key={operation+':'+String(asignacionDiaId)} action={operation} initialAsignacionId={operation==='consumoPlan'?asignacionDiaId:null} onClose={closeOperation} onChanged={()=>setRevision(x=>x+1)} onCompleted={module=>{setSupplyNotice({module,message:module==='compras'?'Compra de insumos guardada. El inventario y el historial de compras se actualizaron.':'Existencia inicial registrada. El inventario ya refleja el ingreso.'});abrirModulo(module)}}/>}
              {operation&&!supplyActions.includes(operation)&&operation!=='sipecSync'&&operation!=='ventaIndividual'&&availableActions.some(item=>item.id===operation)&&
                <OperationalModules key={tab+':'+operation+':'+catalogType} initialCatalogType={catalogType} module={tab} initialAction={operation}
                  esAdmin={esAdmin} onChanged={()=>setRevision(x=>x+1)} onClose={closeOperation}/>}
            </section>}
            {tab==='catalogos'&&esAdmin&&!operation&&<CatalogOverview onCreate={type=>openOperation('catalogo',type)} onNavigate={abrirModulo}/>}
            {(tab==='ventas'||tab==='sanidad'||tab==='gastos')&&<DomainRecords module={tab} revision={revision}/>}
            {tab==='inventario'&&<SupplyHistory revision={revision}/>}
            {tab === 'historial' && <OperationsHistory esAdmin={esAdmin} />}
            {tab === 'pendientes' && <PendingRequests esAdmin={esAdmin} onChanged={() => setRevision(x => x + 1)} />}
            {tab === 'planes' && <PlansOverview key={revision} esAdmin={esAdmin} initialLoteId={seguimientoLoteId} onChanged={()=>setRevision(x=>x+1)} onConfirmDaily={id=>{setAsignacionDiaId(id);openOperation('consumoPlan')}} />}
            {tab === 'usuarios' && esAdmin && <UserManagement />}
            {tab === 'rentabilidad' && <ProfitabilityReport bajasPorLote={(datos?.animales??[]).filter(a=>a.estado==='FALLECIDO').reduce<Record<number,number>>((totals,a)=>{totals[a.lote_id]=(totals[a.lote_id]??0)+Number(a.precio_adquisicion);return totals},{})}/>}
            {tab === 'resumen' && (
              <div className="space-y-6">
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                  <Indicador nombre="Animales activos" valor={formatoCantidad(animalesActivos)} nota="Identificados por DIIO" onClick={()=>abrirModulo("animales","ACTIVO")} />
                  <Indicador nombre="Lotes activos" valor={String(datos.lotes.filter(l => l.estado === 'ACTIVO').length)} nota="Agrupaciones operativas" onClick={()=>abrirModulo("lotes")} />
                  <Indicador nombre="Valor base del ganado activo" valor={formatoDinero(adquisiciones)} nota="Adquisición de animales activos" onClick={()=>abrirModulo("compras")} />
                  <Indicador nombre="Bajas por fallecimiento" valor={formatoDinero(bajas)} nota="Valor de adquisición · separado del ganado activo" onClick={()=>abrirModulo("animales","FALLECIDO")} />
                  <Indicador nombre="Valor del stock" valor={formatoDinero(valorStock)} nota="Existencia × costo promedio" onClick={()=>abrirModulo("inventario")} />
                </div>
                <div className="grid gap-5 lg:grid-cols-2">
                  <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                    <h2 className="font-semibold">Estado de lotes</h2>
                    <div className="mt-5 space-y-3">
                      {datos.lotes.map(l => (
                        <button type="button" onClick={()=>abrirModulo("lotes")} key={l.id} className="flex w-full items-center justify-between rounded-xl bg-slate-50 px-4 py-3 text-left text-sm hover:bg-emerald-50">
                          <div><div className="font-semibold">{l.codigo}</div><div className="mt-1 text-xs text-slate-500">{formatoCantidad(l.cantidad_actual)} animales</div></div>
                          <Estado valor={l.estado} />
                        </button>
                      ))}
                      {datos.lotes.length === 0 && <TablaVacia texto="No existen lotes registrados." />}
                    </div>
                  </section>
                  <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                    <h2 className="font-semibold">Inventario y alertas</h2>
                    <p className="mt-3 text-sm text-slate-600">
                      {faltantes} de {datos.productos.length} productos están en o bajo el mínimo definido.
                    </p>
                    <div className="mt-5 space-y-3">
                      {datos.productos.filter(p => Number(p.stock_actual) <= Number(p.stock_minimo)).slice(0,5).map(p => (
                        <button key={p.id} type="button" onClick={()=>abrirModulo("inventario")} className="flex w-full items-center justify-between rounded-xl bg-amber-50 px-4 py-3 text-left text-sm text-amber-950 hover:bg-amber-100">
                          <span className="font-medium">{p.nombre}</span><span>{formatoCantidad(p.stock_actual)} disponibles</span>
                        </button>
                      ))}
                      {faltantes === 0 && <TablaVacia texto="No existen alertas de stock." />}
                    </div>
                  </section>
                </div>
              </div>
            )}

            {tab==='lotes' && <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
              <h2 className="text-lg font-semibold">Registro de lotes</h2>
              <p className="mb-5 mt-1 text-sm text-slate-500">Existencias y estado de cada agrupación ganadera.</p>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {datos.lotes.map(l=><article key={l.id} className="rounded-xl border border-slate-200 bg-slate-50 p-5">
                  <div className="flex justify-between gap-3"><strong>{l.codigo}</strong><Estado valor={l.estado}/></div>
                  <p className="mt-4 text-2xl font-semibold">{formatoCantidad(l.cantidad_actual)}</p>
                  <p className="text-sm text-slate-500">animales registrados actualmente</p>
                  <button type="button" onClick={()=>abrirModulo('animales','TODOS',l.codigo)}
                    className="mt-4 text-sm font-semibold text-emerald-700 hover:underline">Ver animales del lote →</button>
                  <button type="button" onClick={()=>{setSeguimientoLoteId(l.id);abrirModulo('planes')}} className="mt-3 block text-sm font-semibold text-emerald-700 hover:underline">Seguimiento alimentario →</button>
                </article>)}
                {datos.lotes.length===0&&<TablaVacia texto="Todavía no se han creado lotes."/>}
              </div>
            </section>}
            {tab==='animales'&&animalCard&&fichaAnimal&&<AnimalCard key={animalCard.id}
              animal={fichaAnimal} raza={razasPorId.get(fichaAnimal.raza_id)??'Sin raza'} lote={lotesPorId.get(fichaAnimal.lote_id)??'Sin lote'}
              esAdmin={esAdmin} action={animalCard.action??null} onAction={setAnimalAction} onClose={closeAnimal} onChanged={()=>setRevision(x=>x+1)}/>}
            {(tab === 'animales' || tab === 'inventario') && (
              <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="flex flex-col gap-3 border-b border-slate-100 p-5 sm:flex-row sm:items-center sm:justify-between">
                  <div><h2 className="font-semibold">{tab === 'animales' ? 'Registro de animales' : 'Existencias de inventario'}</h2><p className="mt-1 text-xs text-slate-500">{tab === 'inventario' ? 'Cantidades en unidad base y equivalencias comerciales (no un conteo de envases sellados).' : 'Consultar registros y movimientos'}</p></div>
                  <input aria-label="Filtrar registros" value={buscar} onChange={e => setBuscar(e.target.value)} placeholder={tab==='animales'?"Escribe DIIO, raza o lote":"Buscar producto"}
                    className="rounded-xl border border-slate-200 px-4 py-2 text-sm outline-none focus:border-emerald-600 sm:w-72" />
                </div>
                {tab==='animales'&&<div className="flex flex-wrap gap-2 border-b border-slate-100 px-5 py-3" aria-label="Filtrar animales por estado">
                  {(['TODOS','ACTIVO','FALLECIDO','VENDIDO'] as const).map(state=><button key={state} type="button" onClick={()=>setFiltroAnimal(state)}
                    className={`rounded-full border px-3.5 py-2 text-xs font-semibold ${filtroAnimal===state?'border-emerald-900 bg-emerald-900 text-white':'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'}`}>
                    {state==='TODOS'?'Todos':state==='ACTIVO'?'Activos':state==='FALLECIDO'?'Fallecidos':'Vendidos'}
                  </button>)}
                </div>}
                <TableScroll>
                  {tab === 'animales' ? (
                    listaAnimales.length === 0 ? <TablaVacia texto="No se encontraron animales." /> : (
                      <table className="min-w-full text-left text-sm">
                        <thead className="text-xs uppercase tracking-wide text-slate-500"><tr><th className="p-4">DIIO / ficha</th><th className="p-4">Raza</th><th className="p-4">Lote</th><th className="p-4">Sexo</th><th className="p-4">Peso inicial</th><th className="p-4">Valor base</th><th className="p-4">Estado</th></tr></thead>
                        <tbody className="divide-y divide-slate-100">
                          {listaAnimales.map(a => <tr key={a.id} className={a.estado==='FALLECIDO'?'bg-rose-50/70 hover:bg-rose-100':'hover:bg-slate-50'}><td className="p-4 font-semibold"><button type="button" className="text-emerald-800 underline underline-offset-4" aria-label={'Abrir ficha DIIO '+a.diio} onClick={()=>openAnimal(a.id)}>{a.diio}</button></td><td className="p-4">{razasPorId.get(a.raza_id)??'—'}</td><td className="p-4">{lotesPorId.get(a.lote_id) ?? '—'}</td><td className="p-4">{a.sexo}</td><td className="p-4">{a.peso_ingreso_kg != null ? `${formatoCantidad(a.peso_ingreso_kg)} kg` : '—'}</td><td className="p-4">{formatoDinero(a.precio_adquisicion)}</td><td className="p-4"><Estado valor={a.estado} /></td></tr>)}
                        </tbody>
                      </table>
                    )
                  ) : (
                    listaProductos.length === 0 ? <TablaVacia texto="No se encontraron productos." /> : (
                      <table className="min-w-full text-left text-sm">
                        <thead className="text-xs uppercase tracking-wide text-slate-500"><tr><th className="p-4">Producto</th><th className="p-4">Existencia</th><th className="p-4">Mínimo</th><th className="p-4">PMP</th><th className="p-4">Valorización</th></tr></thead>
                        <tbody className="divide-y divide-slate-100">
                          {listaProductos.map(p => <tr key={p.id} className="hover:bg-slate-50"><td className="p-4 font-semibold">{p.nombre}</td><td className="p-4"><div className="font-semibold">{formatoCantidad(p.stock_actual)} {p.unidad_medida?.codigo}</div><StockPresentations stock={Number(p.stock_actual)} unidad={p.unidad_medida?.codigo ?? 'unidad'} presentaciones={presentacionesPorProducto.get(p.id) ?? []}/></td><td className="p-4">{formatoCantidad(p.stock_minimo)} {p.unidad_medida?.codigo}</td><td className="p-4">{formatoDinero(p.costo_promedio)}</td><td className="p-4">{formatoDinero(p.stock_actual * p.costo_promedio)}</td></tr>)}
                        </tbody>
                      </table>
                    )
                  )}
                </TableScroll>
              </section>
            )}

            {tab === 'compras' && (
              <div className="grid gap-5 lg:grid-cols-2">
                <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                  <h2 className="font-semibold">Compras de animales</h2>
                  <div className="mt-4 space-y-3">
                    {datos.comprasAnimal.map(c => {
                      const list=datos.detalleAnimales.filter(d=>d.compra_id===c.id)
                        .map(d=>datos.animales.find(a=>a.id===d.animal_id)?.diio??'DIIO #'+d.animal_id)
                      const proveedor=datos.proveedores.find(p=>p.id===c.proveedor_id)?.nombre??'Proveedor sin especificar'
                      return <div key={c.id} className="rounded-xl border border-slate-100 bg-slate-50 p-4 text-sm">
                        <div className="flex items-start justify-between gap-4"><div><div className="font-semibold">Compra de animales #{c.id}</div><div className="mt-1 text-xs text-slate-500">{c.fecha} · {proveedor}</div></div><strong>{formatoDinero(c.total)}</strong></div>
                        <p className="mt-2 text-xs text-slate-600">{list.length} animales · {list.slice(0,5).join(', ')}{list.length>5?' y otros '+(list.length-5):''}</p>
                      </div>
                    })}
                    {datos.comprasAnimal.length === 0 && <TablaVacia texto="Sin compras registradas." />}
                  </div>
                </section>
                <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                  <h2 className="font-semibold">Compras de insumos</h2>
                  <div className="mt-4 space-y-3">
                    {datos.comprasInsumo.map(c => {
                      const lines=datos.detalleInsumos.filter(d=>d.compra_id===c.id)
                      const provider=datos.proveedores.find(p=>p.id===c.proveedor_id)?.nombre??'Proveedor sin especificar'
                      return <div key={c.id} className="rounded-xl border border-slate-100 bg-slate-50 p-4 text-sm">
                        <div className="flex items-start justify-between gap-4"><div><div className="font-semibold">Compra de insumos #{c.id} · {provider}</div><div className="mt-1 text-xs text-slate-500">{c.fecha} · <span className={c.estado==='BORRADOR'?'font-semibold text-amber-800':'text-emerald-700'}>{c.estado==='BORRADOR'?'PENDIENTE':c.estado}</span> {c.numero_documento?'· '+c.numero_documento:''}</div></div><strong>{formatoDinero(c.total)}</strong></div>
                        <div className="mt-3 space-y-1">{lines.map(d=><p key={d.producto_id+'-'+d.subtotal} className="text-xs text-slate-600">
                          {datos.productos.find(p=>p.id===d.producto_id)?.nombre??'Producto #'+d.producto_id} · {formatoCantidad(d.cantidad)} presentaciones / {formatoCantidad(d.cantidad_base)} unidades base · {formatoDinero(d.subtotal)}
                        </p>)}</div>
                        {c.estado==='BORRADOR'&&<button type="button" onClick={()=>abrirModulo('pendientes')} className="mt-3 text-xs font-semibold text-amber-800 hover:underline">Revisar solicitud →</button>}
                      </div>
                    })}
                    {datos.comprasInsumo.length === 0 && <TablaVacia texto="Sin compras registradas." />}
                  </div>
                </section>
              </div>
            )}
          </>
        )}

        </main>
        <MatusFooter />
      </div>
    </div>
  )
}
