import { useEffect, useState } from 'react'
import { supabase } from '../api/supabase'

type Plan = { id: number; nombre: string; descripcion: string | null; activo: boolean }
type Detail = { id: number; plan_id: number; producto_id: number; cantidad_diaria: number; unidad_id: number }
type Assign = { id: number; plan_id: number; lote_id: number; fecha_inicio: string; fecha_fin: string | null; activo: boolean }
type Named = { id: number; nombre?: string; codigo?: string }

export function PlansOverview() {
  const [planes, setPlanes] = useState<Plan[]>([])
  const [detalles, setDetalles] = useState<Detail[]>([])
  const [asignaciones, setAsignaciones] = useState<Assign[]>([])
  const [productos, setProductos] = useState<Named[]>([])
  const [unidades, setUnidades] = useState<Named[]>([])
  const [lotes, setLotes] = useState<Named[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let current = true
    async function run() {
      if (!supabase) return
      const tables = await Promise.all([
        supabase.from('plan_consumo').select('id,nombre,descripcion,activo').order('nombre'),
        supabase.from('detalle_plan_consumo').select('id,plan_id,producto_id,cantidad_diaria,unidad_id'),
        supabase.from('asignacion_plan_lote').select('id,plan_id,lote_id,fecha_inicio,fecha_fin,activo'),
        supabase.from('producto').select('id,nombre'),
        supabase.from('unidad_medida').select('id,nombre,codigo'),
        supabase.from('lote').select('id,codigo'),
      ])
      if (!current) return
      const failure = tables.find(item => item.error)
      if (failure?.error) setError('No fue posible consultar la composición de los planes: ' + failure.error.message)
      else {
        setPlanes((tables[0].data ?? []) as Plan[])
        setDetalles((tables[1].data ?? []) as Detail[])
        setAsignaciones((tables[2].data ?? []) as Assign[])
        setProductos((tables[3].data ?? []) as Named[])
        setUnidades((tables[4].data ?? []) as Named[])
        setLotes((tables[5].data ?? []) as Named[])
      }
      setLoading(false)
    }
    void run()
    return () => { current = false }
  }, [])

  const productName = (id: number) => productos.find(x => x.id === id)?.nombre ?? `Producto #${id}`
  const unitName = (id: number) => unidades.find(x => x.id === id)?.codigo ?? unidades.find(x => x.id === id)?.nombre ?? ''
  const lotName = (id: number) => lotes.find(x => x.id === id)?.codigo ?? `Lote #${id}`
  return <section className="space-y-5">
    <header className="rounded-2xl border border-slate-200 bg-white p-6">
      <p className="text-xs font-semibold uppercase tracking-widest text-emerald-700">Producción · alimentación</p>
      <h2 className="mt-2 text-2xl font-semibold tracking-tight">Planes de alimentación</h2>
      <p className="mt-2 text-sm text-slate-600">Consulta la composición diaria de cada plan y a qué lotes está asignado. La planificación no descuenta inventario por sí sola.</p>
    </header>
    {loading && <p className="p-6 text-sm text-slate-500">Cargando planes…</p>}
    {error && <p role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-700">{error}</p>}
    {!loading && !error && planes.length === 0 && <p className="rounded-2xl bg-white p-8 text-sm text-slate-500">Todavía no existen planes. Puedes crearlos en «Crear nuevo registro» en este módulo.</p>}
    {!loading && !error && planes.map(plan => {
      const lines = detalles.filter(d => d.plan_id === plan.id)
      const assigns = asignaciones.filter(a => a.plan_id === plan.id)
      return <details key={plan.id} open={planes.length === 1} className="group rounded-2xl border border-slate-200 bg-white shadow-sm">
        <summary className="cursor-pointer list-none p-5 sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-semibold text-slate-900">{plan.nombre}</h3>
              <p className="mt-1 text-sm text-slate-500">{plan.descripcion || 'Sin descripción'} · {lines.length} ingredientes · {assigns.filter(a => a.activo).length} asignaciones activas</p>
            </div>
            <span className="rounded-xl bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-800">{plan.activo ? 'Activo' : 'Inactivo'} · Ver detalle</span>
          </div>
        </summary>
        <div className="grid gap-6 border-t border-slate-100 p-5 sm:p-6 lg:grid-cols-2">
          <div>
            <h4 className="mb-3 text-sm font-semibold">Composición diaria por lote</h4>
            {lines.length === 0 ? <p className="text-sm text-slate-500">Sin productos definidos.</p> :
              <div className="space-y-2">{lines.map(line => <div key={line.id} className="flex justify-between gap-4 rounded-xl bg-slate-50 p-3 text-sm">
                <span>{productName(line.producto_id)}</span><strong className="whitespace-nowrap">{Number(line.cantidad_diaria).toLocaleString('es-CL')} {unitName(line.unidad_id)}/día</strong>
              </div>)}</div>}
          </div>
          <div>
            <h4 className="mb-3 text-sm font-semibold">Lotes asignados</h4>
            {assigns.length === 0 ? <p className="text-sm text-slate-500">Sin lotes asignados.</p> :
              <div className="space-y-2">{assigns.map(a => <div key={a.id} className="rounded-xl bg-slate-50 p-3 text-sm">
                <div className="flex justify-between gap-3"><span className="font-semibold">{lotName(a.lote_id)}</span><span className={a.activo ? 'text-emerald-700' : 'text-slate-500'}>{a.activo ? 'Vigente' : 'Terminada'}</span></div>
                <p className="mt-1 text-xs text-slate-500">Desde {a.fecha_inicio}{a.fecha_fin ? ' hasta ' + a.fecha_fin : ''}</p>
              </div>)}</div>}
          </div>
        </div>
      </details>
    })}
  </section>
}
