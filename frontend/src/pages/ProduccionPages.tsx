import { useCallback, useEffect, useState } from 'react'
import { api, extraerError } from '../api/client'
import { CrudPage } from '../components/CrudPage'
import { Boton, Card, MensajeError, Modal, PageHeader, Spinner, Tabla, Badge } from '../components/ui'
import { fecha, moneda, numero, hoy } from '../utils/format'

interface Opcion {
  value: number
  label: string
}

function useOpciones(ruta: string, labelField = 'nombre') {
  const [opciones, setOpciones] = useState<Opcion[]>([])
  useEffect(() => {
    void (async () => {
      try {
        const { data } = await api.get(ruta)
        const lista = Array.isArray(data) ? data : data.results
        setOpciones(
          lista.map((i: Record<string, unknown>) => ({
            value: i.id as number,
            label: String(i[labelField] ?? i.id),
          })),
        )
      } catch {
        setOpciones([])
      }
    })()
  }, [ruta, labelField])
  return opciones
}

interface FilaConsumo {
  producto: string
  cantidad: string
}

export function ConsumosPage() {
  const productos = useOpciones('/inventario/productos/')
  const lotes = useOpciones('/ganaderia/lotes/', 'codigo')

  const [datos, setDatos] = useState<any[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [abierto, setAbierto] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [errorForm, setErrorForm] = useState('')
  const [form, setForm] = useState({ fecha: '', lote: '', origen: 'REAL', observaciones: '' })
  const [filas, setFilas] = useState<FilaConsumo[]>([{ producto: '', cantidad: '' }])
  const [recordSel, setRecordSel] = useState<any | null>(null)

  const cargar = useCallback(async () => {
    setCargando(true)
    setError('')
    try {
      const { data } = await api.get('/consumos/consumos/')
      setDatos(Array.isArray(data) ? data : data.results)
    } catch (e) {
      setError(extraerError(e))
    } finally {
      setCargando(false)
    }
  }, [])

  useEffect(() => {
    void cargar()
  }, [cargar])

  async function guardar() {
    setGuardando(true)
    setErrorForm('')
    try {
      await api.post('/consumos/consumos/', {
        fecha: form.fecha,
        lote: form.lote ? Number(form.lote) : null,
        origen: form.origen,
        observaciones: form.observaciones,
        detalles: filas.map((f) => ({ producto: Number(f.producto), cantidad: f.cantidad })),
      })
      setAbierto(false)
      setForm({ fecha: '', lote: '', origen: 'REAL', observaciones: '' })
      setFilas([{ producto: '', cantidad: '' }])
      await cargar()
    } catch (e) {
      setErrorForm(extraerError(e))
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div className="space-y-4">
      <PageHeader
        titulo="Consumos de insumos"
        descripcion="Salidas de stock por consumo del ganado"
        acciones={<Boton onClick={() => setAbierto(true)}>+ Nuevo consumo</Boton>}
      />

      {error && <MensajeError mensaje={error} />}
      <Card>
        {cargando ? (
          <Spinner />
        ) : (
          <Tabla<any>
            columnas={[
              { key: 'id', label: '#' },
              { key: 'fecha', label: 'Fecha', render: (c) => fecha(c.fecha) },
              { key: 'lote_codigo', label: 'Lote', render: (c) => c.lote_codigo ?? '—' },
              {
                key: 'origen',
                label: 'Origen',
                render: (c) => <Badge color={c.origen === 'PLAN' ? 'blue' : 'slate'}>{c.origen}</Badge>,
              },
              { key: 'detalles', label: 'Ítems', render: (c) => numero(c.detalles?.length ?? 0, 0), ocultaEnMovil: true },
              { key: 'observaciones', label: 'Observaciones', render: (c) => c.observaciones ?? '—', ocultaEnMovil: true },
            ]}
            datos={datos}
            acciones={(c) => (
              <Boton variante="secundario" onClick={() => setRecordSel(c)}>
                Ver
              </Boton>
            )}
          />
        )}
      </Card>

      <Modal abierto={!!recordSel} titulo={`Consumo #${recordSel?.id ?? ''}`} onClose={() => setRecordSel(null)}>
        {recordSel && (
          <div className="space-y-4">
            <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-3">
              <div>
                <dt className="text-xs font-medium uppercase text-slate-400">Fecha</dt>
                <dd className="font-medium text-slate-700">{fecha(recordSel.fecha)}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase text-slate-400">Lote</dt>
                <dd className="font-medium text-slate-700">{recordSel.lote_codigo ?? 'General'}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase text-slate-400">Origen</dt>
                <dd className="font-medium text-slate-700">{recordSel.origen ?? '—'}</dd>
              </div>
              {recordSel.observaciones && (
                <div className="sm:col-span-3">
                  <dt className="text-xs font-medium uppercase text-slate-400">Observaciones</dt>
                  <dd className="text-slate-700">{recordSel.observaciones}</dd>
                </div>
              )}
            </dl>
            {recordSel.detalles && recordSel.detalles.length > 0 && (
              <div>
                <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Detalle ({recordSel.detalles.length})
                </div>
                <div className="overflow-x-auto rounded-lg border border-slate-200">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 text-xs uppercase text-slate-400">
                      <tr>
                        <th className="px-3 py-2">Producto</th>
                        <th className="px-3 py-2 text-right">Cantidad</th>
                        <th className="px-3 py-2 text-right">Costo unitario</th>
                        <th className="px-3 py-2 text-right">Costo total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {(recordSel.detalles as any[]).map((d, i) => (
                        <tr key={i}>
                          <td className="px-3 py-2 font-medium text-slate-700">{d.producto_nombre ?? '—'}</td>
                          <td className="px-3 py-2 text-right text-slate-600">{numero(d.cantidad, 3)}</td>
                          <td className="px-3 py-2 text-right text-slate-600">{moneda(d.costo_unitario)}</td>
                          <td className="px-3 py-2 text-right font-medium text-slate-700">{moneda(d.costo_total)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
            <div className="flex justify-end">
              <Boton variante="secundario" onClick={() => setRecordSel(null)}>
                Cerrar
              </Boton>
            </div>
          </div>
        )}
      </Modal>

      <Modal abierto={abierto} titulo="Nuevo consumo" onClose={() => setAbierto(false)} ancho="max-w-3xl">
        <div className="space-y-4">
          {errorForm && <MensajeError mensaje={errorForm} />}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <label className="block">
              <span className="text-sm font-medium text-slate-600">Fecha *</span>
              <input
                type="date"
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                value={form.fecha}
                onChange={(e) => setForm({ ...form, fecha: e.target.value })}
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-slate-600">Lote</span>
              <select
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                value={form.lote}
                onChange={(e) => setForm({ ...form, lote: e.target.value })}
              >
                <option value="">— General —</option>
                {lotes.map((l) => (
                  <option key={l.value} value={l.value}>
                    {l.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-sm font-medium text-slate-600">Origen</span>
              <select
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                value={form.origen}
                onChange={(e) => setForm({ ...form, origen: e.target.value })}
              >
                <option value="REAL">Real</option>
                <option value="PLAN">Plan</option>
                <option value="AJUSTE">Ajuste</option>
              </select>
            </label>
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm font-semibold text-slate-700">Detalles</span>
              <Boton variante="secundario" onClick={() => setFilas((f) => [...f, { producto: '', cantidad: '' }])}>
                + Agregar línea
              </Boton>
            </div>
            <div className="space-y-2">
              {filas.map((fila, i) => (
                <div key={i} className="grid grid-cols-1 gap-2 sm:grid-cols-10">
                  <select
                    className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm focus:border-emerald-500 focus:outline-none sm:col-span-6"
                    value={fila.producto}
                    onChange={(e) =>
                      setFilas((f) => f.map((x, idx) => (idx === i ? { ...x, producto: e.target.value } : x)))
                    }
                  >
                    <option value="">Producto</option>
                    {productos.map((p) => (
                      <option key={p.value} value={p.value}>
                        {p.label}
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    step="0.001"
                    placeholder="Cantidad base"
                    className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm focus:border-emerald-500 focus:outline-none sm:col-span-3"
                    value={fila.cantidad}
                    onChange={(e) =>
                      setFilas((f) => f.map((x, idx) => (idx === i ? { ...x, cantidad: e.target.value } : x)))
                    }
                  />
                  <button
                    className="text-red-500 hover:text-red-700"
                    onClick={() => setFilas((f) => f.filter((_, idx) => idx !== i))}
                    disabled={filas.length === 1}
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          </div>

          <label className="block">
            <span className="text-sm font-medium text-slate-600">Observaciones</span>
            <textarea
              rows={2}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
              value={form.observaciones}
              onChange={(e) => setForm({ ...form, observaciones: e.target.value })}
            />
          </label>

          <div className="flex justify-end gap-2">
            <Boton variante="secundario" onClick={() => setAbierto(false)}>
              Cancelar
            </Boton>
            <Boton
              onClick={() => void guardar()}
              disabled={guardando || !form.fecha || filas.some((f) => !f.producto || !f.cantidad)}
            >
              {guardando ? 'Guardando...' : 'Registrar consumo'}
            </Boton>
          </div>
        </div>
      </Modal>
    </div>
  )
}

export function TratamientosPage() {
  const animales = useOpciones('/ganaderia/animales/?estado=ACTIVO', 'diio')
  const productos = useOpciones('/inventario/productos/')

  const [datos, setDatos] = useState<any[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [abierto, setAbierto] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [errorForm, setErrorForm] = useState('')
  const [form, setForm] = useState({
    animal: '',
    producto: '',
    fecha: '',
    cantidad: '',
    motivo: '',
    observaciones: '',
  })

  const cargar = useCallback(async () => {
    setCargando(true)
    setError('')
    try {
      const { data } = await api.get('/sanidad/tratamientos/')
      setDatos(Array.isArray(data) ? data : data.results)
    } catch (e) {
      setError(extraerError(e))
    } finally {
      setCargando(false)
    }
  }, [])

  useEffect(() => {
    void cargar()
  }, [cargar])

  async function guardar() {
    setGuardando(true)
    setErrorForm('')
    try {
      await api.post('/sanidad/tratamientos/', {
        animal: Number(form.animal),
        producto: Number(form.producto),
        fecha: form.fecha,
        cantidad: form.cantidad || null,
        motivo: form.motivo,
        observaciones: form.observaciones,
      })
      setAbierto(false)
      setForm({ animal: '', producto: '', fecha: '', cantidad: '', motivo: '', observaciones: '' })
      await cargar()
    } catch (e) {
      setErrorForm(extraerError(e))
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div className="space-y-4">
      <PageHeader
        titulo="Tratamientos"
        descripcion="Salidas de insumos veterinarios por sanidad"
        acciones={<Boton onClick={() => setAbierto(true)}>+ Nuevo tratamiento</Boton>}
      />

      {error && <MensajeError mensaje={error} />}
      <Card>
        {cargando ? (
          <Spinner />
        ) : (
          <Tabla<any>
            columnas={[
              { key: 'id', label: '#' },
              { key: 'animal_diio', label: 'Animal' },
              { key: 'producto_nombre', label: 'Producto' },
              { key: 'fecha', label: 'Fecha', render: (t) => fecha(t.fecha) },
              { key: 'cantidad', label: 'Cantidad', render: (t) => (t.cantidad ? numero(t.cantidad, 3) : '—') },
              { key: 'costo_total', label: 'Costo', render: (t) => moneda(t.costo_total) },
              { key: 'motivo', label: 'Motivo' },
            ]}
            datos={datos}
          />
        )}
      </Card>

      <Modal abierto={abierto} titulo="Nuevo tratamiento" onClose={() => setAbierto(false)}>
        <div className="space-y-4">
          {errorForm && <MensajeError mensaje={errorForm} />}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="text-sm font-medium text-slate-600">Animal *</span>
              <select
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                value={form.animal}
                onChange={(e) => setForm({ ...form, animal: e.target.value })}
              >
                <option value="">— Seleccionar —</option>
                {animales.map((a) => (
                  <option key={a.value} value={a.value}>
                    {a.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-sm font-medium text-slate-600">Producto *</span>
              <select
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                value={form.producto}
                onChange={(e) => setForm({ ...form, producto: e.target.value })}
              >
                <option value="">— Seleccionar —</option>
                {productos.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-sm font-medium text-slate-600">Fecha *</span>
              <input
                type="date"
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                value={form.fecha}
                onChange={(e) => setForm({ ...form, fecha: e.target.value })}
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-slate-600">Cantidad (descuenta stock)</span>
              <input
                type="number"
                step="0.001"
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                value={form.cantidad}
                onChange={(e) => setForm({ ...form, cantidad: e.target.value })}
              />
            </label>
            <label className="block sm:col-span-2">
              <span className="text-sm font-medium text-slate-600">Motivo *</span>
              <input
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                value={form.motivo}
                onChange={(e) => setForm({ ...form, motivo: e.target.value })}
              />
            </label>
            <label className="block sm:col-span-2">
              <span className="text-sm font-medium text-slate-600">Observaciones</span>
              <textarea
                rows={2}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                value={form.observaciones}
                onChange={(e) => setForm({ ...form, observaciones: e.target.value })}
              />
            </label>
          </div>
          <div className="flex justify-end gap-2">
            <Boton variante="secundario" onClick={() => setAbierto(false)}>
              Cancelar
            </Boton>
            <Boton
              onClick={() => void guardar()}
              disabled={guardando || !form.animal || !form.producto || !form.fecha || !form.motivo}
            >
              {guardando ? 'Guardando...' : 'Registrar tratamiento'}
            </Boton>
          </div>
        </div>
      </Modal>
    </div>
  )
}

export function PlanesPage() {
  const [tab, setTab] = useState<'planes' | 'detalles' | 'asignaciones'>('planes')

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {(
          [
            ['planes', 'Planes'],
            ['detalles', 'Detalles de plan'],
            ['asignaciones', 'Asignaciones a lotes'],
          ] as const
        ).map(([valor, label]) => (
          <button
            key={valor}
            className={`rounded-md px-3 py-1.5 text-sm font-medium ${
              tab === valor ? 'bg-emerald-600 text-white' : 'bg-white text-slate-600 border border-slate-300'
            }`}
            onClick={() => setTab(valor)}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'planes' && (
        <CrudPage
          titulo="Planes de alimentación"
          endpoint="/alimentacion/planes-consumo/"
          columnas={[
            { key: 'nombre', label: 'Nombre' },
            { key: 'descripcion', label: 'Descripción' },
            { key: 'activo', label: 'Activo', render: (r) => (r.activo ? 'Sí' : 'No') },
          ]}
          campos={[
            { name: 'nombre', label: 'Nombre', required: true },
            { name: 'descripcion', label: 'Descripción', type: 'textarea' },
            { name: 'activo', label: 'Activo', type: 'checkbox', defaultValue: true },
            { name: 'observaciones', label: 'Observaciones', type: 'textarea' },
          ]}
        />
      )}

      {tab === 'detalles' && (
        <CrudPage
          titulo="Detalles de plan"
          endpoint="/alimentacion/detalles-planes-consumo/"
          columnas={[
            { key: 'plan', label: 'Plan' },
            { key: 'producto_nombre', label: 'Producto' },
            { key: 'cantidad_diaria', label: 'Cantidad diaria', render: (r) => numero(r.cantidad_diaria, 3) },
            { key: 'unidad_codigo', label: 'Unidad' },
          ]}
          campos={[
            {
              name: 'plan',
              label: 'Plan',
              type: 'select',
              required: true,
              opcionesEndpoint: '/alimentacion/planes-consumo/',
            },
            {
              name: 'producto',
              label: 'Producto',
              type: 'select',
              required: true,
              opcionesEndpoint: '/inventario/productos/',
            },
            { name: 'cantidad_diaria', label: 'Cantidad diaria', type: 'number', step: '0.001', required: true },
            {
              name: 'unidad',
              label: 'Unidad',
              type: 'select',
              opcionesEndpoint: '/inventario/unidades-medida/',
              opcionesLabelField: 'codigo',
            },
            { name: 'observaciones', label: 'Observaciones', type: 'textarea' },
          ]}
        />
      )}

      {tab === 'asignaciones' && <AsignacionesTabla />}
    </div>
  )
}

function AsignacionesTabla() {
  const [datos, setDatos] = useState<any[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [abierto, setAbierto] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [errorForm, setErrorForm] = useState('')
  const [planes, setPlanes] = useState<Opcion[]>([])
  const [lotes, setLotes] = useState<Opcion[]>([])
  const [form, setForm] = useState({ lote: '', plan: '', fecha_inicio: '', fecha_fin: '', observaciones: '' })

  const cargar = useCallback(async () => {
    setCargando(true)
    setError('')
    try {
      const { data } = await api.get('/alimentacion/asignaciones-planes-lotes/')
      setDatos(Array.isArray(data) ? data : data.results)
    } catch (e) {
      setError(extraerError(e))
    } finally {
      setCargando(false)
    }
  }, [])

  useEffect(() => {
    void cargar()
  }, [cargar])

  useEffect(() => {
    void (async () => {
      try {
        const [rp, rl] = await Promise.all([
          api.get('/alimentacion/planes-consumo/'),
          api.get('/ganaderia/lotes/'),
        ])
        const lp = Array.isArray(rp.data) ? rp.data : rp.data.results
        const ll = Array.isArray(rl.data) ? rl.data : rl.data.results
        setPlanes(lp.map((p: any) => ({ value: p.id, label: p.nombre })))
        setLotes(ll.map((l: any) => ({ value: l.id, label: l.codigo })))
      } catch {
        /* noop */
      }
    })()
  }, [])

  async function crear() {
    setGuardando(true)
    setErrorForm('')
    try {
      await api.post('/alimentacion/asignaciones-planes-lotes/', {
        lote: Number(form.lote),
        plan: Number(form.plan),
        fecha_inicio: form.fecha_inicio,
        fecha_fin: form.fecha_fin || null,
        activo: true,
        observaciones: form.observaciones,
      })
      setAbierto(false)
      setForm({ lote: '', plan: '', fecha_inicio: '', fecha_fin: '', observaciones: '' })
      await cargar()
    } catch (e) {
      setErrorForm(extraerError(e))
    } finally {
      setGuardando(false)
    }
  }

  async function generar(row: any) {
    const fechaGen = window.prompt('Fecha para generar el consumo (YYYY-MM-DD)', hoy())
    if (!fechaGen) return
    try {
      await api.post(`/alimentacion/asignaciones-planes-lotes/${row.id}/generar_consumo/`, { fecha: fechaGen })
      await cargar()
    } catch (e) {
      setError(extraerError(e))
    }
  }

  async function finalizar(row: any) {
    const fechaFin = window.prompt('Fecha de finalización (YYYY-MM-DD)', hoy())
    if (!fechaFin) return
    try {
      await api.post(`/alimentacion/asignaciones-planes-lotes/${row.id}/finalizar/`, { fecha_fin: fechaFin })
      await cargar()
    } catch (e) {
      setError(extraerError(e))
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-800">Asignaciones a lotes</h2>
        <Boton onClick={() => setAbierto(true)}>+ Nueva asignación</Boton>
      </div>
      {error && <MensajeError mensaje={error} />}
      <Card>
        {cargando ? (
          <Spinner />
        ) : (
          <Tabla<any>
            columnas={[
              { key: 'lote_codigo', label: 'Lote' },
              { key: 'plan_nombre', label: 'Plan' },
              { key: 'fecha_inicio', label: 'Inicio', render: (r) => fecha(r.fecha_inicio) },
              { key: 'fecha_fin', label: 'Fin', render: (r) => (r.fecha_fin ? fecha(r.fecha_fin) : '—') },
              {
                key: 'activo',
                label: 'Activa',
                render: (r) => <Badge color={r.activo ? 'green' : 'slate'}>{r.activo ? 'Sí' : 'No'}</Badge>,
              },
            ]}
            datos={datos}
            acciones={(r) => (
              <div className="flex justify-end gap-2">
                {r.activo && (
                  <>
                    <Boton variante="exito" onClick={() => void generar(r)}>
                      Generar consumo
                    </Boton>
                    <Boton variante="secundario" onClick={() => void finalizar(r)}>
                      Finalizar
                    </Boton>
                  </>
                )}
              </div>
            )}
          />
        )}
      </Card>

      <Modal abierto={abierto} titulo="Nueva asignación" onClose={() => setAbierto(false)}>
        <div className="space-y-4">
          {errorForm && <MensajeError mensaje={errorForm} />}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="text-sm font-medium text-slate-600">Lote *</span>
              <select
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                value={form.lote}
                onChange={(e) => setForm({ ...form, lote: e.target.value })}
              >
                <option value="">— Seleccionar —</option>
                {lotes.map((l) => (
                  <option key={l.value} value={l.value}>
                    {l.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-sm font-medium text-slate-600">Plan *</span>
              <select
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                value={form.plan}
                onChange={(e) => setForm({ ...form, plan: e.target.value })}
              >
                <option value="">— Seleccionar —</option>
                {planes.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-sm font-medium text-slate-600">Fecha inicio *</span>
              <input
                type="date"
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                value={form.fecha_inicio}
                onChange={(e) => setForm({ ...form, fecha_inicio: e.target.value })}
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-slate-600">Fecha fin</span>
              <input
                type="date"
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                value={form.fecha_fin}
                onChange={(e) => setForm({ ...form, fecha_fin: e.target.value })}
              />
            </label>
          </div>
          <div className="flex justify-end gap-2">
            <Boton variante="secundario" onClick={() => setAbierto(false)}>
              Cancelar
            </Boton>
            <Boton onClick={() => void crear()} disabled={guardando || !form.lote || !form.plan || !form.fecha_inicio}>
              {guardando ? 'Guardando...' : 'Crear asignación'}
            </Boton>
          </div>
        </div>
      </Modal>
    </div>
  )
}