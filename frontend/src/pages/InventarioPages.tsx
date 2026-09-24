import { useCallback, useEffect, useState } from 'react'
import { api, extraerError } from '../api/client'
import { CrudPage } from '../components/CrudPage'
import { Boton, Card, Campo, inputCls, MensajeError, Modal, PageHeader, Spinner, Tabla, Badge } from '../components/ui'
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
        { key: 'descripcion', label: 'Descripción', ocultaEnMovil: true },
        { key: 'activo', label: 'Activo', render: (r) => (r.activo ? 'Sí' : 'No'), ocultaEnMovil: true },
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
        { key: 'tipo', label: 'Tipo', ocultaEnMovil: true },
        { key: 'decimales', label: 'Decimales', ocultaEnMovil: true },
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
      description="Insumos con stock y costo promedio (PMP)"
      endpoint="/inventario/productos/"
      columnas={[
        { key: 'nombre', label: 'Producto' },
        { key: 'categoria_nombre', label: 'Categoría', ocultaEnMovil: true },
        { key: 'unidad_base_codigo', label: 'Unidad', ocultaEnMovil: true },
        { key: 'stock_actual', label: 'Stock', render: (r) => numero(r.stock_actual, 3) },
        { key: 'stock_minimo', label: 'Mín.', render: (r) => numero(r.stock_minimo, 3), ocultaEnMovil: true },
        { key: 'costo_promedio', label: 'Costo prom.', render: (r) => moneda(r.costo_promedio), ocultaEnMovil: true },
        { key: 'activo', label: 'Activo', render: (r) => (r.activo ? 'Sí' : 'No'), ocultaEnMovil: true },
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

export function PresentacionesPage() {
  return (
    <CrudPage
      titulo="Presentaciones de productos"
      description="Equivalencias de empaques (ej. saco de 25 kg)"
      endpoint="/inventario/presentaciones-productos/"
      columnas={[
        { key: 'nombre', label: 'Presentación' },
        { key: 'producto', label: 'Producto' },
        { key: 'cantidad_base', label: 'Cantidad base', render: (r) => numero(r.cantidad_base, 3) },
        { key: 'activa', label: 'Activa', render: (r) => (r.activa ? 'Sí' : 'No'), ocultaEnMovil: true },
      ]}
      campos={[
        { name: 'nombre', label: 'Nombre', required: true },
        {
          name: 'producto',
          label: 'Producto',
          type: 'select',
          required: true,
          opcionesEndpoint: '/inventario/productos/',
        },
        { name: 'cantidad_base', label: 'Cantidad base', type: 'number', step: '0.001', required: true },
        {
          name: 'unidad_base',
          label: 'Unidad base',
          type: 'select',
          required: true,
          opcionesEndpoint: '/inventario/unidades-medida/',
          opcionesLabelField: 'codigo',
        },
        { name: 'activa', label: 'Activa', type: 'checkbox', defaultValue: true },
      ]}
    />
  )
}

export function ConversionesPage() {
  return (
    <CrudPage
      titulo="Conversiones de productos"
      description="Equivalencias entre unidades de un producto"
      endpoint="/inventario/conversiones-productos/"
      columnas={[
        { key: 'producto', label: 'Producto' },
        {
          key: 'cantidad_origen',
          label: 'Origen',
          render: (r) => `${numero(r.cantidad_origen, 3)} ${
            String(r.unidad_origen_codigo ?? '') || String(r.unidad_origen)
          }`,
        },
        {
          key: 'cantidad_destino',
          label: 'Destino',
          render: (r) => `${numero(r.cantidad_destino, 3)} ${
            String(r.unidad_destino_codigo ?? '') || String(r.unidad_destino)
          }`,
        },
        { key: 'activa', label: 'Activa', render: (r) => (r.activa ? 'Sí' : 'No'), ocultaEnMovil: true },
      ]}
      campos={[
        {
          name: 'producto',
          label: 'Producto',
          type: 'select',
          required: true,
          opcionesEndpoint: '/inventario/productos/',
        },
        { name: 'cantidad_origen', label: 'Cantidad origen', type: 'number', step: '0.0001', required: true },
        {
          name: 'unidad_origen',
          label: 'Unidad origen',
          type: 'select',
          required: true,
          opcionesEndpoint: '/inventario/unidades-medida/',
          opcionesLabelField: 'codigo',
        },
        { name: 'cantidad_destino', label: 'Cantidad destino', type: 'number', step: '0.0001', required: true },
        {
          name: 'unidad_destino',
          label: 'Unidad destino',
          type: 'select',
          required: true,
          opcionesEndpoint: '/inventario/unidades-medida/',
          opcionesLabelField: 'codigo',
        },
        { name: 'activa', label: 'Activa', type: 'checkbox', defaultValue: true },
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
    <div className="space-y-5">
      <PageHeader
        titulo="Movimientos de inventario"
        descripcion="Entradas, salidas y ajustes de stock"
        acciones={
          <div className="flex flex-wrap items-end gap-2">
            <div className="flex flex-col text-xs text-slate-500">
              <span className="font-medium">Tipo</span>
              <select
                className="mt-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
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
            </div>
            {esAdmin && <Boton onClick={() => setAbierto(true)}>+ Ajuste manual</Boton>}
          </div>
        }
      />

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
              { key: 'cantidad', label: 'Cant.', render: (m) => numero(m.cantidad, 3), ocultaEnMovil: true },
              { key: 'costo_total', label: 'Costo', render: (m) => moneda(m.costo_total), ocultaEnMovil: true },
              {
                key: 'referencia_tipo',
                label: 'Referencia',
                render: (m) => (m.referencia_tipo ? m.referencia_tipo.replace('_', ' ') : '—'),
                ocultaEnMovil: true,
              },
            ]}
            datos={datos}
          />
        )}
      </Card>

      <Modal abierto={abierto} titulo="Ajuste manual de inventario" onClose={() => setAbierto(false)}>
        <div className="space-y-4">
          {errorForm && <MensajeError mensaje={errorForm} />}
          <Campo label="Producto" requerido>
            <select
              className={inputCls}
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
          </Campo>
          <Campo label="Cantidad (negativa para restar)" requerido>
            <input
              type="number"
              step="0.001"
              className={inputCls}
              value={form.cantidad}
              onChange={(e) => setForm({ ...form, cantidad: e.target.value })}
            />
          </Campo>
          <Campo label="Motivo">
            <input
              className={inputCls}
              value={form.motivo}
              onChange={(e) => setForm({ ...form, motivo: e.target.value })}
            />
          </Campo>
          <Campo label="Observaciones">
            <textarea
              rows={2}
              className={inputCls}
              value={form.observaciones}
              onChange={(e) => setForm({ ...form, observaciones: e.target.value })}
            />
          </Campo>
          <div className="flex justify-end gap-2 pt-1">
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