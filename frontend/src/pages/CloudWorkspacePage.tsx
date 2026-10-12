import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../api/supabase'
import { useAuth } from '../auth/AuthContext'
import { OperationalModules, OperationsHistory } from './OperationalModules'
import { UserManagement } from './UserManagement'

type Animal = {
  id: number; diio: string; lote_id: number; sexo: string; estado: string
  precio_adquisicion: number; peso_ingreso_kg: number | null
}
type Lote = { id: number; codigo: string; cantidad_actual: number; estado: string }
type Producto = { id: number; nombre: string; stock_actual: number; stock_minimo: number; costo_promedio: number }
type Proveedor = { id: number; nombre: string }
type CompraAnimal = { id: number; fecha: string; total: number }
type CompraInsumo = { id: number; fecha: string; total: number; estado: string; numero_documento: string | null }
type Datos = {
  animales: Animal[]; lotes: Lote[]; productos: Producto[]
  proveedores: Proveedor[]; comprasAnimal: CompraAnimal[]; comprasInsumo: CompraInsumo[]
}
type Pestaña = 'resumen' | 'animales' | 'inventario' | 'compras' | 'operaciones' | 'historial' | 'usuarios'

const formatoDinero = (n: number) => new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(n)
const formatoCantidad = (n: number) => new Intl.NumberFormat('es-CL', { maximumFractionDigits: 3 }).format(n)
const tabs: { id: Pestaña; label: string }[] = [
  { id: 'resumen', label: 'Resumen' },
  { id: 'animales', label: 'Animales' },
  { id: 'inventario', label: 'Inventario' },
  { id: 'compras', label: 'Compras' },
  { id: 'operaciones', label: 'Operaciones' },
  { id: 'historial', label: 'Historial y auditoría' },
  { id: 'usuarios', label: 'Usuarios' },
]

function Indicador({ nombre, valor, nota }: { nombre: string; valor: string; nota: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">{nombre}</p>
      <p className="mt-3 text-2xl font-semibold tracking-tight text-slate-900">{valor}</p>
      <p className="mt-2 text-xs text-slate-500">{nota}</p>
    </div>
  )
}

function Estado({ valor }: { valor: string }) {
  const activo = valor === 'ACTIVO' || valor === 'ACTIVA' || valor === 'CONFIRMADA'
  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${activo ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
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
  const [tab, setTab] = useState<Pestaña>('resumen')
  const [datos, setDatos] = useState<Datos | null>(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [buscar, setBuscar] = useState('')
  const [revision, setRevision] = useState(0)

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
        const [a, l, p, pr, ca, ci] = await Promise.all([
          supabase.from('animal').select('id,diio,lote_id,sexo,estado,precio_adquisicion,peso_ingreso_kg').order('diio').limit(1000),
          supabase.from('lote').select('id,codigo,cantidad_actual,estado').order('codigo').limit(500),
          supabase.from('producto').select('id,nombre,stock_actual,stock_minimo,costo_promedio').order('nombre').limit(500),
          supabase.from('proveedor').select('id,nombre').order('nombre').limit(200),
          supabase.from('compra_animal').select('id,fecha,total').order('fecha', { ascending: false }).limit(300),
          supabase.from('compra_insumo').select('id,fecha,total,estado,numero_documento').order('fecha', { ascending: false }).limit(300),
        ])
        const fallo = [a.error, l.error, p.error, pr.error, ca.error, ci.error].find(Boolean)
        if (fallo) throw new Error(fallo.message)
        if (vigente) {
          setDatos({
            animales: (a.data ?? []) as Animal[],
            lotes: (l.data ?? []) as Lote[],
            productos: (p.data ?? []) as Producto[],
            proveedores: (pr.data ?? []) as Proveedor[],
            comprasAnimal: (ca.data ?? []) as CompraAnimal[],
            comprasInsumo: (ci.data ?? []) as CompraInsumo[],
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
  const listaAnimales = (datos?.animales ?? []).filter(a =>
    a.diio.toLowerCase().includes(buscar.toLowerCase()) ||
    (lotesPorId.get(a.lote_id) ?? '').toLowerCase().includes(buscar.toLowerCase()),
  )
  const listaProductos = (datos?.productos ?? []).filter(p => p.nombre.toLowerCase().includes(buscar.toLowerCase()))
  const adquisiciones = (datos?.animales ?? []).reduce((s, a) => s + Number(a.precio_adquisicion), 0)
  const valorStock = (datos?.productos ?? []).reduce((s, p) => s + Number(p.stock_actual) * Number(p.costo_promedio), 0)
  const demo = (datos?.animales ?? []).some(a => a.diio.startsWith('DEMO-'))
  const animalesActivos = (datos?.animales ?? []).filter(a => a.estado === 'ACTIVO').length
  const faltantes = (datos?.productos ?? []).filter(p => Number(p.stock_actual) <= Number(p.stock_minimo)).length

  function salir() {
    logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className="min-h-screen bg-[#f4f7f6] text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-8">
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-xl bg-emerald-900 font-bold text-white">SG</div>
            <div>
              <div className="text-base font-bold tracking-tight">SGIC-Terneros</div>
              <div className="text-xs text-slate-500">Gestión integral de crianza</div>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="hidden text-right sm:block">
              <div className="text-sm font-medium">{user?.username}</div>
              <div className="text-xs text-slate-500">{esAdmin ? 'Administrador' : 'Operador'}</div>
            </div>
            <button onClick={salir} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium hover:bg-slate-50">Salir</button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-8">
        <section className="rounded-3xl bg-gradient-to-r from-emerald-950 via-emerald-900 to-teal-800 px-6 py-8 text-white shadow-lg sm:px-9">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-200">Centro de operaciones</p>
          <h1 className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">Control ganadero</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-emerald-100">
            Gestiona animales, lotes, compras, inventario, alimentación y ventas con autorización por roles,
            registros de auditoría y funciones transaccionales en PostgreSQL.
          </p>
        </section>

        {demo && (
          <div role="status" className="rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-950">
            <strong>Entorno de demostración.</strong> Los registros identificados como DEMO son ficticios y no representan operaciones empresariales reales.
          </div>
        )}

        <nav aria-label="Módulos de consulta" className="flex gap-2 overflow-x-auto border-b border-slate-200 pb-3">
          {tabs.filter(t => esAdmin || t.id !== 'usuarios').map(t => (
            <button key={t.id} onClick={() => { setTab(t.id); setBuscar('') }}
              aria-current={tab === t.id ? 'page' : undefined}
              className={`whitespace-nowrap rounded-xl px-4 py-2.5 text-sm font-semibold transition ${tab === t.id ? 'bg-emerald-900 text-white' : 'text-slate-600 hover:bg-white'}`}>
              {t.label}
            </button>
          ))}
          <button onClick={() => setRevision(x => x + 1)} className="ml-auto whitespace-nowrap rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">
            Actualizar
          </button>
        </nav>

        {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}
        {cargando && <div className="py-14 text-center text-sm text-slate-500">Cargando información desde Supabase…</div>}

        {!cargando && !error && datos && (
          <>
            {tab === 'operaciones' && <OperationalModules esAdmin={esAdmin} onChanged={() => setRevision(x => x + 1)} />}
            {tab === 'historial' && <OperationsHistory esAdmin={esAdmin} />}
            {tab === 'usuarios' && esAdmin && <UserManagement />}
            {tab === 'resumen' && (
              <div className="space-y-6">
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                  <Indicador nombre="Animales activos" valor={formatoCantidad(animalesActivos)} nota="Identificados por DIIO" />
                  <Indicador nombre="Lotes activos" valor={String(datos.lotes.filter(l => l.estado === 'ACTIVO').length)} nota="Agrupaciones operativas" />
                  <Indicador nombre="Adquisiciones" valor={formatoDinero(adquisiciones)} nota="Suma de precios de los animales registrados" />
                  <Indicador nombre="Valor del stock" valor={formatoDinero(valorStock)} nota="Existencia × costo promedio" />
                </div>
                <div className="grid gap-5 lg:grid-cols-2">
                  <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                    <h2 className="font-semibold">Estado de lotes</h2>
                    <div className="mt-5 space-y-3">
                      {datos.lotes.map(l => (
                        <div key={l.id} className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3 text-sm">
                          <div><div className="font-semibold">{l.codigo}</div><div className="mt-1 text-xs text-slate-500">{formatoCantidad(l.cantidad_actual)} animales</div></div>
                          <Estado valor={l.estado} />
                        </div>
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
                        <div key={p.id} className="flex items-center justify-between rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-950">
                          <span className="font-medium">{p.nombre}</span><span>{formatoCantidad(p.stock_actual)} disponibles</span>
                        </div>
                      ))}
                      {faltantes === 0 && <TablaVacia texto="No existen alertas de stock." />}
                    </div>
                  </section>
                </div>
              </div>
            )}

            {(tab === 'animales' || tab === 'inventario') && (
              <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="flex flex-col gap-3 border-b border-slate-100 p-5 sm:flex-row sm:items-center sm:justify-between">
                  <div><h2 className="font-semibold">{tab === 'animales' ? 'Registro de animales' : 'Existencias de inventario'}</h2><p className="mt-1 text-xs text-slate-500">Consulta de solo lectura</p></div>
                  <input aria-label="Filtrar registros" value={buscar} onChange={e => setBuscar(e.target.value)} placeholder="Buscar por DIIO, lote o producto"
                    className="rounded-xl border border-slate-200 px-4 py-2 text-sm outline-none focus:border-emerald-600 sm:w-72" />
                </div>
                <div className="overflow-x-auto">
                  {tab === 'animales' ? (
                    listaAnimales.length === 0 ? <TablaVacia texto="No se encontraron animales." /> : (
                      <table className="min-w-full text-left text-sm">
                        <thead className="text-xs uppercase tracking-wide text-slate-500"><tr><th className="p-4">DIIO</th><th className="p-4">Lote</th><th className="p-4">Sexo</th><th className="p-4">Peso inicial</th><th className="p-4">Adquisición</th><th className="p-4">Estado</th></tr></thead>
                        <tbody className="divide-y divide-slate-100">
                          {listaAnimales.map(a => <tr key={a.id} className="hover:bg-slate-50"><td className="p-4 font-semibold">{a.diio}</td><td className="p-4">{lotesPorId.get(a.lote_id) ?? '—'}</td><td className="p-4">{a.sexo}</td><td className="p-4">{a.peso_ingreso_kg != null ? `${formatoCantidad(a.peso_ingreso_kg)} kg` : '—'}</td><td className="p-4">{formatoDinero(a.precio_adquisicion)}</td><td className="p-4"><Estado valor={a.estado} /></td></tr>)}
                        </tbody>
                      </table>
                    )
                  ) : (
                    listaProductos.length === 0 ? <TablaVacia texto="No se encontraron productos." /> : (
                      <table className="min-w-full text-left text-sm">
                        <thead className="text-xs uppercase tracking-wide text-slate-500"><tr><th className="p-4">Producto</th><th className="p-4">Existencia</th><th className="p-4">Mínimo</th><th className="p-4">PMP</th><th className="p-4">Valorización</th></tr></thead>
                        <tbody className="divide-y divide-slate-100">
                          {listaProductos.map(p => <tr key={p.id} className="hover:bg-slate-50"><td className="p-4 font-semibold">{p.nombre}</td><td className="p-4">{formatoCantidad(p.stock_actual)}</td><td className="p-4">{formatoCantidad(p.stock_minimo)}</td><td className="p-4">{formatoDinero(p.costo_promedio)}</td><td className="p-4">{formatoDinero(p.stock_actual * p.costo_promedio)}</td></tr>)}
                        </tbody>
                      </table>
                    )
                  )}
                </div>
              </section>
            )}

            {tab === 'compras' && (
              <div className="grid gap-5 lg:grid-cols-2">
                <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                  <h2 className="font-semibold">Compras de animales</h2>
                  <div className="mt-4 space-y-3">
                    {datos.comprasAnimal.map(c => <div key={c.id} className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 p-4 text-sm"><div><div className="font-semibold">Compra #{c.id}</div><div className="mt-1 text-xs text-slate-500">{c.fecha}</div></div><strong>{formatoDinero(c.total)}</strong></div>)}
                    {datos.comprasAnimal.length === 0 && <TablaVacia texto="Sin compras registradas." />}
                  </div>
                </section>
                <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                  <h2 className="font-semibold">Compras de insumos</h2>
                  <div className="mt-4 space-y-3">
                    {datos.comprasInsumo.map(c => <div key={c.id} className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 p-4 text-sm"><div><div className="font-semibold">{c.numero_documento ?? `Compra #${c.id}`}</div><div className="mt-1 text-xs text-slate-500">{c.fecha} · {c.estado}</div></div><strong>{formatoDinero(c.total)}</strong></div>)}
                    {datos.comprasInsumo.length === 0 && <TablaVacia texto="Sin compras registradas." />}
                  </div>
                </section>
              </div>
            )}
          </>
        )}

        <footer className="border-t border-slate-200 pt-5 text-xs leading-6 text-slate-500">
          SGIC-Terneros · Consultas autorizadas con Supabase Auth y RLS.
          Las acciones autorizadas ejecutan funciones PostgreSQL transaccionales y registran auditoría. Verifica las operaciones antes de confirmar.
        </footer>
      </main>
    </div>
  )
}
