import { CatalogOverview } from './CatalogOverview'
import { useWorkspaceNavigation } from '../hooks/useWorkspaceNavigation'
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
import type { PresentacionStock } from '../utils/presentationStock'
import { SupplyOperations, supplyActions } from './SupplyOperations'
import { FeedingPeriods } from './FeedingPeriods'
import { PendingRequests } from './PendingRequests'
import { SipecSyncPreview } from './SipecSyncPreview'
import { SaleIndividualPrices } from './SaleIndividualPrices'
import { AnimalCard, type AnimalRecord } from './AnimalCard'
import { MatusFooter } from '../components/MatusFooter'
import { PaginatedRegistry } from './PaginatedRegistry'
import { PurchasesRegistry } from './PurchasesRegistry'

type Animal = AnimalRecord
type Lote = { id: number; codigo: string; cantidad_actual: number; estado: string }
type Producto = { id: number; nombre: string; stock_actual: number; stock_minimo: number; costo_promedio: number; tipo_insumo:string; unidad_medida:{codigo:string}|null }
type Proveedor = { id: number; nombre: string }
type Datos = {
  animales: Animal[]; razas: {id:number;nombre:string}[]; lotes: Lote[]; productos: Producto[]; presentaciones: PresentacionStock[]
  proveedores: Proveedor[]
}
const formatoDinero = (n: number) => new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(n)
const formatoCantidad = (n: number) => new Intl.NumberFormat('es-CL', { maximumFractionDigits: 3 }).format(n)
function Indicador({ nombre, valor, nota, onClick }: { nombre: string; valor: string; nota: string; onClick:()=>void }) {
  return (
    <button type="button" onClick={onClick} aria-label={nombre+': '+valor+'. '+nota}
      className="group w-full rounded-xl border border-slate-200 bg-white px-4 py-4 text-left transition hover:border-emerald-400 hover:bg-emerald-50/40 focus-visible:ring-2 focus-visible:ring-emerald-500">
      <p className="text-xs font-medium text-slate-500">{nombre}</p>
      <div className="mt-1 flex items-center justify-between gap-3">
        <p className="text-xl font-semibold tabular-nums tracking-tight text-slate-900">{valor}</p>
        <span className="text-sm text-emerald-700 opacity-60 group-hover:opacity-100" aria-hidden="true">↗</span>
      </div>
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
  // También cerrar «Más» al navegar con Atrás/Adelante del navegador.
  useEffect(()=>setMenuOpen(false),[tab])
  const [datos, setDatos] = useState<Datos | null>(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [revision, setRevision] = useState(0)
  const [supplyNotice,setSupplyNotice]=useState<{module:'compras'|'inventario';message:string}|null>(null)
  const [seguimientoLoteId,setSeguimientoLoteId]=useState<number|null>(null)
  const [buscarLotes,setBuscarLotes]=useState('')
  const [mostrarTodosLotes,setMostrarTodosLotes]=useState(false)

  useEffect(() => {
    let vigente = true

    async function cargarTodos<T>(tabla:string,columnas:string,soloActivas=false):Promise<T[]>{
      const all:T[]=[]
      const size=1000
      for(let inicio=0;inicio<200000;inicio+=size){
        let query=supabase!.from(tabla).select(columnas).order('id',{ascending:true}).range(inicio,inicio+size-1)
        if(soloActivas)query=query.eq('activa',true)
        const result=await query
        if(result.error)throw new Error(result.error.message)
        const items=(result.data??[]) as unknown as T[]
        all.push(...items)
        if(items.length<size)return all
      }
      throw new Error('La consulta excede el máximo esperado. Usa filtros en el registro.')
    }

    async function cargar() {
      if (!supabase) {
        setError('Falta configurar el cliente Supabase.')
        setCargando(false)
        return
      }

      setCargando(true)
      setError('')
      try {
        const [a,l,p,pr,ra,pp] = await Promise.all([
          cargarTodos<Animal>('animal','id,diio,lote_id,raza_id,sexo,estado,precio_adquisicion,peso_ingreso_kg,fecha_nacimiento,fecha_adquisicion,edad_aproximada_dias,observaciones'),
          cargarTodos<Lote>('lote','id,codigo,cantidad_actual,estado'),
          cargarTodos<Producto>('producto','id,nombre,stock_actual,stock_minimo,costo_promedio,tipo_insumo,unidad_medida(codigo)'),
          cargarTodos<Proveedor>('proveedor','id,nombre'),
          cargarTodos<{id:number;nombre:string}>('raza','id,nombre'),
          cargarTodos<PresentacionStock>('presentacion_producto','id,producto_id,nombre,cantidad_base,activa',true),
        ])
        if (vigente) {
          setDatos({
            animales:a,
            razas:ra,
            lotes:l.sort((a,b)=>a.codigo.localeCompare(b.codigo,'es')),
            productos:p,
            presentaciones:pp,
            proveedores:pr,
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
  const bajas = (datos?.animales ?? []).filter(a=>a.estado==='FALLECIDO').reduce((s,a)=>s+Number(a.precio_adquisicion),0)
  const adquisiciones = (datos?.animales ?? []).filter(a=>a.estado==='ACTIVO').reduce((s, a) => s + Number(a.precio_adquisicion), 0)
  const valorStock = (datos?.productos ?? []).reduce((s, p) => s + Number(p.stock_actual) * Number(p.costo_promedio), 0)
  const demo = (datos?.animales ?? []).some(a => a.diio.startsWith('DEMO-'))
  const animalesActivos = (datos?.animales ?? []).filter(a => a.estado === 'ACTIVO').length
  const faltantes = (datos?.productos ?? []).filter(p => Number(p.stock_actual) <= Number(p.stock_minimo)).length
  const lotesFiltrados=(datos?.lotes??[]).filter(l=>l.codigo.toLocaleLowerCase('es').includes(buscarLotes.trim().toLocaleLowerCase('es')))
  const lotesVisibles=mostrarTodosLotes?lotesFiltrados:lotesFiltrados.slice(0,12)

  const availableActions=getModuleActions(tab,esAdmin)
  const visibleActions=tab==='animales'&&esAdmin
    ? [...availableActions,{id:'sipecSync',label:'Importar desde SIPECweb'}]
    : tab==='ventas'&&esAdmin
      ? [...availableActions,{id:'ventaIndividual',label:'Venta con precios por DIIO'}]
      : availableActions

  function salir() {
    logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className="sgic-shell min-h-screen bg-[#f4f7f6] text-slate-900 lg:flex">
      <a href="#sgic-contenido" className="sr-only focus:not-sr-only fixed left-3 top-3 z-[100] rounded-lg bg-emerald-950 px-4 py-3 font-semibold text-white">Ir al contenido</a>
      <SidebarNavigation current={tab} esAdmin={esAdmin} open={menuOpen}
        onClose={()=>setMenuOpen(false)} onOpen={()=>setMenuOpen(true)} onNavigate={abrirModulo} onLogout={salir}/>
      <div className="flex min-h-screen min-w-0 flex-1 flex-col">
        <header className="app-header border-b border-slate-200 bg-white">
          <div className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-3 px-4 py-3 sm:flex-nowrap sm:py-4 sm:px-7 lg:px-9">
            <div className="flex w-full min-w-0 items-center gap-3 sm:w-auto">
              <div className="min-w-0">
                <h1 className="truncate text-lg font-semibold tracking-tight text-slate-900">{moduleTitles[tab]}</h1>
              </div>
            </div>
            <div className="flex w-full shrink-0 items-center justify-end gap-3 sm:w-auto sm:gap-5">
              <button type="button" onClick={()=>setRevision(x=>x+1)}
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50">Actualizar</button>
              <div className="hidden text-right md:block">
                <div className="text-sm font-semibold">{user?.username}</div>
                <div className="text-xs text-slate-500">{esAdmin?'Administrador':'Operador'}</div>
              </div>
              <button type="button" onClick={salir} className="hidden rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 lg:inline-flex">Salir</button>
            </div>
          </div>
        </header>
        <main id="sgic-contenido" tabIndex={-1} className="app-main mx-auto w-full min-w-0 max-w-[1440px] flex-1 space-y-4 px-3 py-4 sm:px-6 lg:px-8 lg:py-6">

          {demo&&<div role="status" className="rounded-xl border border-amber-200 bg-amber-50 px-5 py-3 text-sm text-amber-950">
            <strong>Entorno de demostración.</strong> Los registros DEMO son ficticios y no corresponden a operaciones empresariales reales.
          </div>}
        {supplyNotice?.module===tab&&<div role="status" className="flex items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-5 py-3 text-sm text-emerald-950"><span>{supplyNotice.message}</span><button type="button" className="shrink-0 font-semibold underline" onClick={()=>setSupplyNotice(null)}>Cerrar aviso</button></div>}
        {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}
        {cargando && !datos && <div className="py-14 text-center text-sm text-slate-500">Cargando información desde Supabase…</div>}

        {!error && datos && (
          <>
            {visibleActions.length>0&&<section aria-label={'Acciones de '+moduleTitles[tab]} className="space-y-3">
              {tab!=='catalogos'&&tab!=='planes'&&!operation&&<div className="flex flex-wrap items-center gap-2">
                <button type="button" onClick={()=>openOperation(visibleActions[0].id)}
                  className="rounded-lg bg-emerald-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800">
                  + {visibleActions[0].label}
                </button>
                {visibleActions.length>1&&<details>
                  <summary className="cursor-pointer rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-700">Otras acciones</summary>
                  <div className="mt-2 flex flex-wrap gap-2 rounded-lg border border-slate-200 bg-white p-2 shadow-sm">
                    {visibleActions.slice(1).map(item=><button type="button" key={item.id}
                      onClick={()=>openOperation(item.id)} className="rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-slate-100">{item.label}</button>)}
                  </div>
                </details>}
              </div>}
              {operation&&<button type="button" onClick={closeOperation} className="text-sm font-medium text-emerald-800 hover:underline">← Volver a {moduleTitles[tab]}</button>}
              {operation==='sipecSync'&&tab==='animales'&&esAdmin&&
                <SipecSyncPreview onClose={closeOperation} onChanged={()=>setRevision(x=>x+1)} onNavigate={abrirModulo}/>}
              {operation==='ventaIndividual'&&tab==='ventas'&&esAdmin&&
                <SaleIndividualPrices onClose={closeOperation} onChanged={()=>setRevision(x=>x+1)}/>}
              {operation&&supplyActions.includes(operation)&&availableActions.some(item=>item.id===operation)&&<SupplyOperations key={operation} action={operation} onClose={closeOperation} onChanged={()=>setRevision(x=>x+1)} onCompleted={module=>{setSupplyNotice({module,message:module==='compras'?'Compra de insumos guardada. El inventario y el historial de compras se actualizaron.':'Existencia inicial registrada. El inventario ya refleja el ingreso.'});abrirModulo(module)}}/>}
              {operation&&!supplyActions.includes(operation)&&operation!=='sipecSync'&&operation!=='ventaIndividual'&&availableActions.some(item=>item.id===operation)&&
                <OperationalModules key={tab+':'+operation+':'+catalogType} initialCatalogType={catalogType} module={tab} initialAction={operation}
                  esAdmin={esAdmin} onChanged={()=>setRevision(x=>x+1)} onClose={closeOperation}/>}
            </section>}
            {tab==='catalogos'&&esAdmin&&!operation&&<CatalogOverview onCreate={type=>openOperation('catalogo',type)} onNavigate={abrirModulo}/>}
            {(tab==='ventas'||tab==='sanidad'||tab==='gastos')&&<DomainRecords module={tab} revision={revision}/>}
            {tab==='inventario'&&<SupplyHistory revision={revision}/>}
            {tab === 'historial' && <OperationsHistory esAdmin={esAdmin} />}
            {tab === 'pendientes' && <PendingRequests esAdmin={esAdmin} onChanged={() => setRevision(x => x + 1)} />}
            {tab === 'planes' && <FeedingPeriods key={revision} initialLoteId={seguimientoLoteId} onSelectLote={setSeguimientoLoteId} />}
            {tab === 'usuarios' && esAdmin && <UserManagement />}
            {tab === 'rentabilidad' && <ProfitabilityReport bajasPorLote={(datos?.animales??[]).filter(a=>a.estado==='FALLECIDO').reduce<Record<number,number>>((totals,a)=>{totals[a.lote_id]=(totals[a.lote_id]??0)+Number(a.precio_adquisicion);return totals},{})}/>}
            {tab === 'resumen' && (
              <div className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-3">
                  <Indicador nombre="Animales activos" valor={formatoCantidad(animalesActivos)} nota="Ver animales" onClick={()=>abrirModulo("animales","ACTIVO")} />
                  <Indicador nombre="Lotes activos" valor={String(datos.lotes.filter(l => l.estado === 'ACTIVO').length)} nota="Ver lotes" onClick={()=>abrirModulo("lotes")} />
                  <Indicador nombre="Alertas de stock" valor={String(faltantes)} nota="Ver inventario" onClick={()=>abrirModulo("inventario")} />
                </div>
                <details className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm">
                  <summary className="cursor-pointer font-medium text-slate-700">Indicadores de valoración</summary>
                  <div className="mt-3 grid gap-3 sm:grid-cols-3">
                    <Indicador nombre="Ganado activo" valor={formatoDinero(adquisiciones)} nota="Valor de adquisición" onClick={()=>abrirModulo("compras")} />
                    <Indicador nombre="Bajas por fallecimiento" valor={formatoDinero(bajas)} nota="Valor de adquisición" onClick={()=>abrirModulo("animales","FALLECIDO")} />
                    <Indicador nombre="Existencias" valor={formatoDinero(valorStock)} nota="Costo promedio" onClick={()=>abrirModulo("inventario")} />
                  </div>
                </details>
                <div className="grid gap-3 lg:grid-cols-2">
                  <section className="rounded-xl border border-slate-200 bg-white p-4">
                    <div className="flex items-center justify-between gap-2"><h2 className="font-semibold">Lotes</h2><button type="button" onClick={()=>abrirModulo('lotes')} className="text-xs font-medium text-emerald-800 hover:underline">Ver todos</button></div>
                    <div className="mt-3 space-y-1.5">
                      {datos.lotes.slice(0,6).map(l => (
                        <button type="button" onClick={()=>abrirModulo("lotes")} key={l.id} className="flex w-full items-center justify-between rounded-xl bg-slate-50 px-4 py-3 text-left text-sm hover:bg-emerald-50">
                          <div className="min-w-0"><span className="font-medium">{l.codigo}</span><span className="ml-2 text-xs text-slate-500">{formatoCantidad(l.cantidad_actual)} animales</span></div>
                          <Estado valor={l.estado} />
                        </button>
                      ))}
                      {datos.lotes.length>6&&<p className="px-3 py-2 text-xs text-slate-500">+{datos.lotes.length-6} lotes más</p>}
                       {datos.lotes.length === 0 && <TablaVacia texto="Sin lotes registrados." />}
                    </div>
                  </section>
                  <section className="rounded-xl border border-slate-200 bg-white p-4">
                    <div className="flex items-center justify-between gap-2"><h2 className="font-semibold">Stock bajo <span className="ml-1 text-xs font-normal text-slate-500">({faltantes})</span></h2><button type="button" onClick={()=>abrirModulo('inventario')} className="text-xs font-medium text-emerald-800 hover:underline">Inventario</button></div>
                    <div className="mt-3 space-y-1.5">
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

            {tab==='lotes' && <section className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-sm font-semibold">Lotes <span className="font-normal text-slate-500">({lotesFiltrados.length})</span></h2>
                <input type="search" value={buscarLotes} onChange={e=>{setBuscarLotes(e.target.value);setMostrarTodosLotes(false)}}
                  placeholder="Buscar lote" aria-label="Buscar lote" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm sm:w-56"/>
              </div>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {lotesVisibles.map(l=><article key={l.id} className="rounded-lg border border-slate-200 px-4 py-3">
                  <div className="flex items-center justify-between gap-2"><strong className="text-sm">{l.codigo}</strong><Estado valor={l.estado}/></div>
                  <p className="mt-1 text-sm text-slate-600">{formatoCantidad(l.cantidad_actual)} animales</p>
                  <div className="mt-3 flex flex-wrap gap-3 text-xs font-semibold">
                    <button type="button" onClick={()=>abrirModulo('animales','TODOS',l.codigo)} className="text-emerald-800 hover:underline">Ver animales</button>
                    <button type="button" onClick={()=>{setSeguimientoLoteId(l.id);abrirModulo('planes')}} className="text-slate-600 hover:underline">Consumos</button>
                  </div>
                </article>)}
                {lotesFiltrados.length===0&&<TablaVacia texto="No se encontraron lotes."/>}
              </div>
              {!mostrarTodosLotes&&lotesFiltrados.length>12&&<button type="button" className="mt-4 text-sm font-medium text-emerald-800 hover:underline" onClick={()=>setMostrarTodosLotes(true)}>Mostrar los {lotesFiltrados.length} lotes</button>}
            </section>}
            {tab==='animales'&&animalCard&&fichaAnimal&&<AnimalCard key={animalCard.id}
              animal={fichaAnimal} raza={razasPorId.get(fichaAnimal.raza_id)??'Sin raza'} lote={lotesPorId.get(fichaAnimal.lote_id)??'Sin lote'}
              esAdmin={esAdmin} action={animalCard.action??null} onAction={setAnimalAction} onClose={closeAnimal} onChanged={()=>setRevision(x=>x+1)}/>}
            {(tab==='animales'||tab==='inventario')&&<PaginatedRegistry key={tab}
              type={tab} search={buscar} filter={filtroAnimal} onFilter={setFiltroAnimal}
              onOpenAnimal={openAnimal} revision={revision} presentaciones={datos.presentaciones}/>}
            
            {tab==='compras'&&<PurchasesRegistry revision={revision}
              providers={datos.proveedores} products={datos.productos} animals={datos.animales}
              onPending={()=>abrirModulo('pendientes')}/>}
          </>
        )}

        </main>
        <MatusFooter />
      </div>
    </div>
  )
}
