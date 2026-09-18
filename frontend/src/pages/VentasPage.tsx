import { useCallback, useEffect, useState } from 'react'
import { api, extraerError } from '../api/client'
import { Boton, Card, MensajeError, Modal, Spinner, Tabla, Badge } from '../components/ui'
import { fecha, moneda, numero } from '../utils/format'

const ESTADO_COLOR: Record<string, string> = {
  BORRADOR: 'amber',
  CONFIRMADA: 'green',
  ANULADA: 'red',
}

interface FilaVenta {
  lote: string
  cantidad_animales: string
}

export function VentasPage() {
  const [datos, setDatos] = useState<any[]>([])
  const [lotes, setLotes] = useState<{ value: number; label: string }[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [abierto, setAbierto] = useState(false)
  const [verDetalle, setVerDetalle] = useState<any | null>(null)
  const [guardando, setGuardando] = useState(false)
  const [errorForm, setErrorForm] = useState('')
  const [form, setForm] = useState({
    fecha: '',
    comprador: '',
    peso_total_kg: '',
    precio_kg: '',
    total_venta: '',
    observaciones: '',
  })
  const [filas, setFilas] = useState<FilaVenta[]>([{ lote: '', cantidad_animales: '1' }])

  const cargar = useCallback(async () => {
    setCargando(true)
    setError('')
    try {
      const { data } = await api.get('/ventas/ventas/')
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
        const { data } = await api.get('/ganaderia/lotes/', { params: { estado: 'ACTIVO' } })
        const lista = Array.isArray(data) ? data : data.results
        setLotes(lista.map((l: any) => ({ value: l.id, label: `${l.codigo} (${l.cantidad_actual} activos)` })))
      } catch {
        setLotes([])
      }
    })()
  }, [])

  async function guardar() {
    setGuardando(true)
    setErrorForm('')
    try {
      const totalCalculado =
        form.total_venta || (form.peso_total_kg && form.precio_kg
          ? String(Number(form.peso_total_kg) * Number(form.precio_kg))
          : '')
      await api.post('/ventas/ventas/', {
        fecha: form.fecha,
        comprador: form.comprador,
        peso_total_kg: form.peso_total_kg || null,
        precio_kg: form.precio_kg || null,
        total_venta: totalCalculado || null,
        observaciones: form.observaciones,
        detalles: filas.map((f) => ({ lote: Number(f.lote), cantidad_animales: Number(f.cantidad_animales) })),
      })
      setAbierto(false)
      setForm({ fecha: '', comprador: '', peso_total_kg: '', precio_kg: '', total_venta: '', observaciones: '' })
      setFilas([{ lote: '', cantidad_animales: '1' }])
      await cargar()
    } catch (e) {
      setErrorForm(extraerError(e))
    } finally {
      setGuardando(false)
    }
  }

  async function accion(id: number, accionNombre: 'confirmar' | 'anular') {
    try {
      await api.post(`/ventas/ventas/${id}/${accionNombre}/`, {})
      await cargar()
    } catch (e) {
      setError(extraerError(e))
    }
  }

  async function abrirVer(v: any) {
    try {
      const { data } = await api.get(`/ventas/ventas/${v.id}/`)
      setVerDetalle(data)
    } catch (e) {
      setError(extraerError(e))
    }
  }

  const totalMostrado =
    form.total_venta ||
    (form.peso_total_kg && form.precio_kg ? String(Number(form.peso_total_kg) * Number(form.precio_kg)) : '')

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-slate-800">Ventas</h1>
        <Boton onClick={() => setAbierto(true)}>+ Nueva venta</Boton>
      </div>

      {error && <MensajeError mensaje={error} />}
      <Card>
        {cargando ? (
          <Spinner />
        ) : (
          <Tabla<any>
            columnas={[
              { key: 'id', label: '#' },
              { key: 'fecha', label: 'Fecha', render: (v) => fecha(v.fecha) },
              { key: 'comprador', label: 'Comprador', render: (v) => v.comprador || '—' },
              { key: 'peso_total_kg', label: 'Peso kg', render: (v) => (v.peso_total_kg ? numero(v.peso_total_kg) : '—') },
              { key: 'precio_kg', label: 'Precio/kg', render: (v) => (v.precio_kg ? moneda(v.precio_kg) : '—') },
              { key: 'total_venta', label: 'Total', render: (v) => moneda(v.total_venta) },
              {
                key: 'estado',
                label: 'Estado',
                render: (v) => <Badge color={ESTADO_COLOR[v.estado]}>{v.estado}</Badge>,
              },
            ]}
            datos={datos}
            acciones={(v) => (
              <div className="flex justify-end gap-2">
                <Boton variante="secundario" onClick={() => void abrirVer(v)}>
                  Ver
                </Boton>
                {v.estado === 'BORRADOR' && (
                  <>
                    <Boton variante="exito" onClick={() => void accion(v.id, 'confirmar')}>
                      Confirmar
                    </Boton>
                    <Boton variante="peligro" onClick={() => void accion(v.id, 'anular')}>
                      Anular
                    </Boton>
                  </>
                )}
              </div>
            )}
          />
        )}
      </Card>

      <Modal abierto={abierto} titulo="Nueva venta" onClose={() => setAbierto(false)} ancho="max-w-3xl">
        <div className="space-y-4">
          {errorForm && <MensajeError mensaje={errorForm} />}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="text-sm font-medium text-slate-600">Fecha *</span>
              <input
                type="date"
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                value={form.fecha}
                onChange={(e) => setForm({ ...form, fecha: e.target.value })}
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-slate-600">Comprador</span>
              <input
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                value={form.comprador}
                onChange={(e) => setForm({ ...form, comprador: e.target.value })}
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-slate-600">Peso total (kg)</span>
              <input
                type="number"
                step="0.01"
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                value={form.peso_total_kg}
                onChange={(e) => setForm({ ...form, peso_total_kg: e.target.value })}
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-slate-600">Precio por kg</span>
              <input
                type="number"
                step="0.01"
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                value={form.precio_kg}
                onChange={(e) => setForm({ ...form, precio_kg: e.target.value })}
              />
            </label>
            <label className="block sm:col-span-2">
              <span className="text-sm font-medium text-slate-600">
                Total venta (si se deja vacío se calcula con peso × precio)
              </span>
              <input
                type="number"
                step="0.01"
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                value={form.total_venta}
                onChange={(e) => setForm({ ...form, total_venta: e.target.value })}
              />
              {totalMostrado && <span className="text-xs text-slate-400">Total estimado: {moneda(totalMostrado)}</span>}
            </label>
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm font-semibold text-slate-700">Lotes vendidos</span>
              <Boton
                variante="secundario"
                onClick={() => setFilas((f) => [...f, { lote: '', cantidad_animales: '1' }])}
              >
                + Agregar lote
              </Boton>
            </div>
            <div className="space-y-2">
              {filas.map((fila, i) => (
                <div key={i} className="grid grid-cols-1 gap-2 sm:grid-cols-10">
                  <select
                    className="rounded-md border border-slate-300 px-2 py-1.5 text-sm sm:col-span-7"
                    value={fila.lote}
                    onChange={(e) =>
                      setFilas((f) => f.map((x, idx) => (idx === i ? { ...x, lote: e.target.value } : x)))
                    }
                  >
                    <option value="">Lote</option>
                    {lotes.map((l) => (
                      <option key={l.value} value={l.value}>
                        {l.label}
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    min="1"
                    placeholder="Animales"
                    className="rounded-md border border-slate-300 px-2 py-1.5 text-sm sm:col-span-2"
                    value={fila.cantidad_animales}
                    onChange={(e) =>
                      setFilas((f) => f.map((x, idx) => (idx === i ? { ...x, cantidad_animales: e.target.value } : x)))
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
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
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
              disabled={guardando || !form.fecha || filas.some((f) => !f.lote || !f.cantidad_animales)}
            >
              {guardando ? 'Guardando...' : 'Guardar venta'}
            </Boton>
          </div>
        </div>
      </Modal>

      <Modal abierto={Boolean(verDetalle)} titulo={`Venta #${verDetalle?.id ?? ''}`} onClose={() => setVerDetalle(null)}>
        {verDetalle && (
          <div className="space-y-3 text-sm">
            <div className="text-slate-500">
              {verDetalle.comprador || 'Sin comprador'} · {fecha(verDetalle.fecha)} ·{' '}
              <Badge color={ESTADO_COLOR[verDetalle.estado]}>{verDetalle.estado}</Badge>
            </div>
            <table className="min-w-full divide-y divide-slate-100">
              <thead>
                <tr className="text-left text-xs uppercase text-slate-400">
                  <th className="py-1">Lote</th>
                  <th className="py-1">Animales</th>
                  <th className="py-1">Ingreso</th>
                  <th className="py-1">Costo</th>
                  <th className="py-1">Utilidad</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {verDetalle.detalles?.map((d: any) => (
                  <tr key={d.id}>
                    <td className="py-1">{d.lote_codigo}</td>
                    <td className="py-1">{d.cantidad_animales}</td>
                    <td className="py-1">{moneda(d.ingreso)}</td>
                    <td className="py-1">{moneda(d.costo_reconocido)}</td>
                    <td className="py-1">{moneda(d.utilidad)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="text-right font-semibold">Total: {moneda(verDetalle.total_venta)}</div>
          </div>
        )}
      </Modal>
    </div>
  )
}