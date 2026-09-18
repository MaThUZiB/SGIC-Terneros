import { useCallback, useEffect, useState } from 'react'
import { api, extraerError } from '../api/client'
import { CrudPage } from '../components/CrudPage'
import { Boton, Card, MensajeError, Modal, Spinner, Tabla, Badge } from '../components/ui'
import { useAuth } from '../auth/AuthContext'
import { fechaHora, moneda, numero } from '../utils/format'

const TIPO_MOV = [
  { value: 'ENTRADA', label: 'Entrada' },
  { value: 'SALIDA', label: 'Salida' },
  { value: 'AJUSTE', label: 'Ajuste' },
]

export function CategoriasProductosPage() {
  return (
    <CrudPage
      titulo="Categorías de productos"
      endpoint="/inventario/categorias-productos/"
      columnas={[
        { key: 'nombre', label: 'Nombre' },
        { key: 'descripcion', label: 'Descripción' },
        { key: 'activo', label: 'Activo', render: (r) => (r.activo ? 'Sí' : 'No') },
      ]}
      campos={[
        { name: 'nombre', label: 'Nombre', required: true },
        { name: 'descripcion', label: 'Descripción', type: 'textarea' },
        { name: 'activo', label: 'Activo', type: 'checkbox', defaultValue: true },
      ]}
    />
  )
}

export function UnidadesMedidaPage() {
  return (
    <CrudPage
      titulo="Unidades de medida"
      endpoint="/inventario/unidades-medida/"
      columnas={[
        { key: 'codigo', label: 'Código' },
        { key: 'nombre', label: 'Nombre' },
        { key: 'tipo', label: 'Tipo' },
        { key: 'decimales', label: 'Decimales' },
      ]}
      campos={[
        { name: 'codigo', label: 'Código', required: true },
        { name: 'nombre', label: 'Nombre', required: true },
        { name: 'tipo', label: 'Tipo', required: true, ayuda: 'Ej: masa, volumen, unidad' },
        { name: 'decimales', label: 'Decimales', type: 'number', defaultValue: 2 },
      ]}
    />
  )
}

export function ProductosPage() {
  return (
    <CrudPage
      titulo="Productos"
      endpoint="/inventario/productos/"
      columnas={[
        { key: 'nombre', label: 'Producto' },
        { key: 'categoria_nombre', label: 'Categoría' },
        { key: 'unidad_base_codigo', label: 'Unidad' },
        { key: 'stock_actual', label: 'Stock', render: (r) => numero(r.stock_actual, 3) },
        { key: 'stock_minimo', label: 'Mínimo', render: (r) => numero(r.stock_minimo, 3) },
        { key: 'costo_promedio', label: 'Costo prom.', render: (r) => moneda(r.costo_promedio) },
        { key: 'activo', label: 'Activo', render: (r) => (r.activo ? 'Sí' : 'No') },
      ]}
      campos={[
        { name: 'nombre', label: 'Nombre', required: true },
        {
          name: 'categoria',
          label: 'Categoría',
          type: 'select',
          required: true,
          opcionesEndpoint: '/inventario/categorias-productos/',
        },
        {
          name: 'unidad_base',
          label: 'Unidad base',
          type: 'select',
          required: true,
          opcionesEndpoint: '/inventario/unidades-medida/',
          opcionesLabelField: 'codigo',
        },
        { name: 'stock_actual', label: 'Stock actual', type: 'number', step: '0.001', defaultValue: 0 },
        { name: 'stock_minimo', label: 'Stock mínimo', type: 'number', step: '0.001', defaultValue: 0 },
        { name: 'costo_promedio', label: 'Costo promedio', type: 'number', step: '0.01', defaultValue: 0 },
        { name: 'activo', label: 'Activo', type: 'checkbox', defaultValue: true },
        { name: 'observaciones', label: 'Observaciones', type: 'textarea' },
      ]}
    />
  )
}

interface Movimiento {
  id: number
  producto: number
  producto_nombre: string
  tipo: string
  cantidad: string
  costo_unitario: string
  costo_total: string
  fecha_hora: string
  referencia_tipo: string
  observaciones: string | null
}

export function MovimientosPage() {
  const { esAdmin } = useAuth()
  const [datos, setDatos] = useState<Movimiento[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [tipo, setTipo] = useState('')
  const [abierto, setAbierto] = useState(false)
  const [opcionesProductos, setOpcionesProductos] = useState<{ value: number; label: string }[]>([])
  const [form, setForm] = useState({ producto: '', cantidad: '', motivo: 'Ajuste manual', observaciones: '' })
  const [errorForm, setErrorForm] = useState('')
  const [guardando, setGuardando] = useState(false)

  const cargar = useCallback(async () => {
    setCargando(true)
    setError('')
    try {
      const { data } = await api.get('/inventario/movimientos-inventario/', {
        params: tipo ? { tipo } : {},
      })
      setDatos(Array.isArray(data) ? data : data.results)
    } catch (e) {
      setError(extraerError(e))
    } finally {
      setCargando(false)
    }
  }, [tipo])

  useEffect(() => {
    void cargar()
  }, [cargar])

  useEffect(() => {
    void (async () => {
      try {
        const { data } = await api.get('/inventario/productos/')
        const lista = Array.isArray(data) ? data : data.results
        setOpcionesProductos(lista.map((p: { id: number; nombre: string }) => ({ value: p.id, label: p.nombre })))
      } catch {
        setOpcionesProductos([])
      }
    })()
  }, [])

  async function guardarAjuste() {
    setGuardando(true)
    setErrorForm('')
    try {
      await api.post('/inventario/movimientos-inventario/ajuste/', {
        producto: Number(form.producto),
        cantidad: form.cantidad,
        motivo: form.motivo,
        observaciones: form.observaciones,
      })
      setAbierto(false)
      setForm({ producto: '', cantidad: '', motivo: 'Ajuste manual', observaciones: '' })
      await cargar()
    } catch (e) {
      setErrorForm(extraerError(e))
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-xl font-semibold text-slate-800">Movimientos de inventario</h1>
        <div className="flex items-end gap-3">
          <label className="flex flex-col text-xs text-slate-500">
            Tipo
            <select
              className="mt-1 rounded-md border border-slate-300 px-2 py-1.5 text-sm"
              value={tipo}
              onChange={(e) => setTipo(e.target.value)}
            >
              <option value="">Todos</option>
              {TIPO_MOV.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>
          {esAdmin && <Boton onClick={() => setAbierto(true)}>+ Ajuste manual</Boton>}
        </div>
      </div>

      {error && <MensajeError mensaje={error} />}
      <Card>
        {cargando ? (
          <Spinner />
        ) : (
          <Tabla<Movimiento>
            columnas={[
              { key: 'fecha_hora', label: 'Fecha', render: (m) => fechaHora(m.fecha_hora) },
              { key: 'producto_nombre', label: 'Producto' },
              {
                key: 'tipo',
                label: 'Tipo',
                render: (m) => (
                  <Badge color={m.tipo === 'ENTRADA' ? 'green' : m.tipo === 'SALIDA' ? 'red' : 'amber'}>
                    {m.tipo}
                  </Badge>
                ),
              },
              { key: 'cantidad', label: 'Cantidad', render: (m) => numero(m.cantidad, 3) },
              { key: 'costo_unitario', label: 'Costo unit.', render: (m) => moneda(m.costo_unitario) },
              { key: 'costo_total', label: 'Costo total', render: (m) => moneda(m.costo_total) },
              { key: 'referencia_tipo', label: 'Referencia' },
            ]}
            datos={datos}
          />
        )}
      </Card>

      <Modal abierto={abierto} titulo="Ajuste manual de inventario" onClose={() => setAbierto(false)}>
        <div className="space-y-4">
          {errorForm && <MensajeError mensaje={errorForm} />}
          <label className="block">
            <span className="text-sm font-medium text-slate-600">Producto *</span>
            <select
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              value={form.producto}
              onChange={(e) => setForm({ ...form, producto: e.target.value })}
            >
              <option value="">— Seleccionar —</option>
              {opcionesProductos.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-sm font-medium text-slate-600">Cantidad * (negativa para restar)</span>
            <input
              type="number"
              step="0.001"
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              value={form.cantidad}
              onChange={(e) => setForm({ ...form, cantidad: e.target.value })}
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-slate-600">Motivo</span>
            <input
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              value={form.motivo}
              onChange={(e) => setForm({ ...form, motivo: e.target.value })}
            />
          </label>
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
            <Boton onClick={() => void guardarAjuste()} disabled={guardando || !form.producto || !form.cantidad}>
              {guardando ? 'Guardando...' : 'Registrar ajuste'}
            </Boton>
          </div>
        </div>
      </Modal>
    </div>
  )
}