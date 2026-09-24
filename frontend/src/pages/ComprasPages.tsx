import { useCallback, useEffect, useState } from 'react'
import { api, extraerError } from '../api/client'
import { CrudPage } from '../components/CrudPage'
import { Boton, Card, MensajeError, Modal, PageHeader, Spinner, Tabla, Badge } from '../components/ui'
import { fecha, moneda, numero } from '../utils/format'

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

export function ProveedoresPage() {
  return (
    <CrudPage
      titulo="Proveedores"
      endpoint="/compra-animales/proveedores/"
      columnas={[
        { key: 'nombre', label: 'Nombre' },
        { key: 'rut', label: 'RUT' },
        { key: 'telefono', label: 'Teléfono' },
        { key: 'email', label: 'Email' },
        { key: 'activo', label: 'Activo', render: (r) => (r.activo ? 'Sí' : 'No') },
      ]}
      campos={[
        { name: 'nombre', label: 'Nombre', required: true },
        { name: 'rut', label: 'RUT' },
        { name: 'telefono', label: 'Teléfono' },
        { name: 'email', label: 'Email', type: 'email' },
        { name: 'direccion', label: 'Dirección' },
        { name: 'activo', label: 'Activo', type: 'checkbox', defaultValue: true },
      ]}
    />
  )
}

const ESTADO_COLOR: Record<string, string> = {
  BORRADOR: 'amber',
  CONFIRMADA: 'green',
  ANULADA: 'red',
}

interface CompraInsumo {
  id: number
  fecha: string
  proveedor_nombre: string | null
  numero_documento: string | null
  estado: string
  total: string
  detalles: any[]
}

interface FilaDetalle {
  producto: string
  presentacion: string
  cantidad: string
  precio_unitario: string
}

export function ComprasInsumosPage() {
  const productos = useOpciones('/inventario/productos/')
  const proveedores = useOpciones('/compra-animales/proveedores/')
  const [presentaciones, setPresentaciones] = useState<any[]>([])

  const [datos, setDatos] = useState<CompraInsumo[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [abierto, setAbierto] = useState(false)
  const [verDetalle, setVerDetalle] = useState<CompraInsumo | null>(null)
  const [errorForm, setErrorForm] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [form, setForm] = useState({ proveedor: '', fecha: '', numero_documento: '', observaciones: '' })
  const [filas, setFilas] = useState<FilaDetalle[]>([{ producto: '', presentacion: '', cantidad: '1', precio_unitario: '' }])

  const cargar = useCallback(async () => {
    setCargando(true)
    setError('')
    try {
      const { data } = await api.get('/compra-insumos/compras-insumos/')
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
        const { data } = await api.get('/inventario/presentaciones-productos/')
        setPresentaciones(Array.isArray(data) ? data : data.results)
      } catch {
        setPresentaciones([])
      }
    })()
  }, [])

  function nuevaFila() {
    setFilas((f) => [...f, { producto: '', presentacion: '', cantidad: '1', precio_unitario: '' }])
  }

  function actualizarFila(i: number, campo: keyof FilaDetalle, valor: string) {
    setFilas((f) => f.map((fila, idx) => (idx === i ? { ...fila, [campo]: valor } : fila)))
  }

  async function guardar() {
    setGuardando(true)
    setErrorForm('')
    try {
      await api.post('/compra-insumos/compras-insumos/', {
        proveedor: Number(form.proveedor),
        fecha: form.fecha,
        numero_documento: form.numero_documento,
        observaciones: form.observaciones,
        detalles: filas.map((f) => ({
          producto: Number(f.producto),
          presentacion: f.presentacion ? Number(f.presentacion) : null,
          cantidad: f.cantidad,
          precio_unitario: f.precio_unitario,
        })),
      })
      setAbierto(false)
      setForm({ proveedor: '', fecha: '', numero_documento: '', observaciones: '' })
      setFilas([{ producto: '', presentacion: '', cantidad: '1', precio_unitario: '' }])
      await cargar()
    } catch (e) {
      setErrorForm(extraerError(e))
    } finally {
      setGuardando(false)
    }
  }

  async function accion(id: number, accionNombre: 'confirmar' | 'anular') {
    try {
      await api.post(`/compra-insumos/compras-insumos/${id}/${accionNombre}/`, {})
      await cargar()
    } catch (e) {
      setError(extraerError(e))
    }
  }

  async function abrirVer(compra: CompraInsumo) {
    try {
      const { data } = await api.get(`/compra-insumos/compras-insumos/${compra.id}/`)
      setVerDetalle(data)
    } catch (e) {
      setError(extraerError(e))
    }
  }

  const presentacionesDe = (productoId: string) =>
    presentaciones.filter((p) => String(p.producto) === productoId)

  const totalEstimado = filas.reduce((acc, f) => {
    const cant = Number(f.cantidad) || 0
    const precio = Number(f.precio_unitario) || 0
    return acc + cant * precio
  }, 0)

  return (
    <div className="space-y-4">
      <PageHeader
        titulo="Compras de insumos"
        descripcion="Registradas de mercancías e insumos"
        acciones={<Boton onClick={() => setAbierto(true)}>+ Nueva compra</Boton>}
      />

      {error && <MensajeError mensaje={error} />}
      <Card>
        {cargando ? (
          <Spinner />
        ) : (
          <Tabla<CompraInsumo>
            columnas={[
              { key: 'id', label: '#', render: (c) => c.id },
              { key: 'fecha', label: 'Fecha', render: (c) => fecha(c.fecha) },
              { key: 'proveedor_nombre', label: 'Proveedor', render: (c) => c.proveedor_nombre ?? '—' },
              { key: 'numero_documento', label: 'Documento', render: (c) => c.numero_documento ?? '—' },
              {
                key: 'estado',
                label: 'Estado',
                render: (c) => <Badge color={ESTADO_COLOR[c.estado]}>{c.estado}</Badge>,
              },
              { key: 'total', label: 'Total', render: (c) => moneda(c.total) },
            ]}
            datos={datos}
            acciones={(c) => (
              <div className="flex justify-end gap-2">
                <Boton variante="secundario" onClick={() => void abrirVer(c)}>
                  Ver
                </Boton>
                {c.estado === 'BORRADOR' && (
                  <>
                    <Boton variante="exito" onClick={() => void accion(c.id, 'confirmar')}>
                      Confirmar
                    </Boton>
                    <Boton variante="peligro" onClick={() => void accion(c.id, 'anular')}>
                      Anular
                    </Boton>
                  </>
                )}
              </div>
            )}
          />
        )}
      </Card>

      <Modal abierto={abierto} titulo="Nueva compra de insumos" onClose={() => setAbierto(false)} ancho="max-w-4xl">
        <div className="space-y-4">
          {errorForm && <MensajeError mensaje={errorForm} />}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <label className="block">
              <span className="text-sm font-medium text-slate-600">Proveedor *</span>
              <select
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                value={form.proveedor}
                onChange={(e) => setForm({ ...form, proveedor: e.target.value })}
              >
                <option value="">— Seleccionar —</option>
                {proveedores.map((p) => (
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
              <span className="text-sm font-medium text-slate-600">N° documento</span>
              <input
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                value={form.numero_documento}
                onChange={(e) => setForm({ ...form, numero_documento: e.target.value })}
              />
            </label>
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm font-semibold text-slate-700">Detalles</span>
              <Boton variante="secundario" onClick={nuevaFila}>
                + Agregar línea
              </Boton>
            </div>
            <div className="space-y-2">
              {filas.map((fila, i) => (
                <div key={i} className="grid grid-cols-1 gap-2 rounded-lg border border-slate-200 p-3 sm:grid-cols-12">
                  <select
                    className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm focus:border-emerald-500 focus:outline-none sm:col-span-4"
                    value={fila.producto}
                    onChange={(e) => actualizarFila(i, 'producto', e.target.value)}
                  >
                    <option value="">Producto</option>
                    {productos.map((p) => (
                      <option key={p.value} value={p.value}>
                        {p.label}
                      </option>
                    ))}
                  </select>
                  <select
                    className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm focus:border-emerald-500 focus:outline-none sm:col-span-3"
                    value={fila.presentacion}
                    onChange={(e) => actualizarFila(i, 'presentacion', e.target.value)}
                    disabled={!fila.producto}
                  >
                    <option value="">Unidad base</option>
                    {presentacionesDe(fila.producto).map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.nombre} ({numero(p.cantidad_base, 3)})
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    step="0.001"
                    placeholder="Cantidad"
                    className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm focus:border-emerald-500 focus:outline-none sm:col-span-2"
                    value={fila.cantidad}
                    onChange={(e) => actualizarFila(i, 'cantidad', e.target.value)}
                  />
                  <input
                    type="number"
                    step="0.01"
                    placeholder="Precio unit."
                    className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm focus:border-emerald-500 focus:outline-none sm:col-span-2"
                    value={fila.precio_unitario}
                    onChange={(e) => actualizarFila(i, 'precio_unitario', e.target.value)}
                  />
                  <button
                    className="text-red-500 hover:text-red-700 sm:col-span-1"
                    onClick={() => setFilas((f) => f.filter((_, idx) => idx !== i))}
                    disabled={filas.length === 1}
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
            <div className="mt-2 text-right text-sm text-slate-500">
              Total estimado: <span className="font-semibold text-slate-700">{moneda(totalEstimado)}</span>
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
              disabled={guardando || !form.proveedor || !form.fecha || filas.some((f) => !f.producto || !f.cantidad)}
            >
              {guardando ? 'Guardando...' : 'Guardar compra'}
            </Boton>
          </div>
        </div>
      </Modal>

      <Modal abierto={Boolean(verDetalle)} titulo={`Compra #${verDetalle?.id ?? ''}`} onClose={() => setVerDetalle(null)}>
        {verDetalle && (
          <div className="space-y-2 text-sm">
            <div className="text-slate-500">
              {verDetalle.proveedor_nombre ?? 'Sin proveedor'} · {fecha(verDetalle.fecha)} ·{' '}
              <Badge color={ESTADO_COLOR[verDetalle.estado]}>{verDetalle.estado}</Badge>
            </div>
            <table className="min-w-full divide-y divide-slate-100">
              <thead>
                <tr className="text-left text-xs uppercase text-slate-400">
                  <th className="py-1">Producto</th>
                  <th className="py-1">Cantidad base</th>
                  <th className="py-1">Precio</th>
                  <th className="py-1">Subtotal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {verDetalle.detalles?.map((d: any) => (
                  <tr key={d.id}>
                    <td className="py-1">{d.producto_nombre}</td>
                    <td className="py-1">{numero(d.cantidad_base, 3)}</td>
                    <td className="py-1">{moneda(d.precio_unitario)}</td>
                    <td className="py-1">{moneda(d.subtotal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="text-right font-semibold">Total: {moneda(verDetalle.total)}</div>
          </div>
        )}
      </Modal>
    </div>
  )
}

interface FilaAnimal {
  diio: string
  raza: string
  sexo: string
  fecha_nacimiento: string
  edad_aproximada_dias: string
  precio_adquisicion: string
  peso_ingreso_kg: string
}

const FILA_ANIMAL_VACIA: FilaAnimal = {
  diio: '',
  raza: '',
  sexo: 'M',
  fecha_nacimiento: '',
  edad_aproximada_dias: '0',
  precio_adquisicion: '',
  peso_ingreso_kg: '',
}

export function ComprasAnimalesPage() {
  const razas = useOpciones('/ganaderia/razas/')
  const proveedores = useOpciones('/compra-animales/proveedores/')
  const lotes = useOpciones('/ganaderia/lotes/', 'codigo')

  const [datos, setDatos] = useState<any[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [abierto, setAbierto] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [errorForm, setErrorForm] = useState('')
  const [modo, setModo] = useState<'nuevo' | 'existente'>('nuevo')
  const [form, setForm] = useState({
    fecha: '',
    proveedor: '',
    observaciones: '',
    codigo: '',
    fecha_ingreso: '',
    lote: '',
  })
  const [animales, setAnimales] = useState<FilaAnimal[]>([{ ...FILA_ANIMAL_VACIA }])
  const [recordSel, setRecordSel] = useState<any | null>(null)


  const cargar = useCallback(async () => {
    setCargando(true)
    setError('')
    try {
      const { data } = await api.get('/compra-animales/compras-animales/')
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

  function actualizarAnimal(i: number, campo: keyof FilaAnimal, valor: string) {
    setAnimales((a) => a.map((fila, idx) => (idx === i ? { ...fila, [campo]: valor } : fila)))
  }

  async function guardar() {
    setGuardando(true)
    setErrorForm('')
    try {
      const payload: Record<string, unknown> = {
        fecha: form.fecha,
        proveedor: form.proveedor ? Number(form.proveedor) : null,
        observaciones: form.observaciones,
        animales: animales.map((a) => ({
          diio: a.diio,
          raza: Number(a.raza),
          sexo: a.sexo,
          fecha_nacimiento: a.fecha_nacimiento || null,
          edad_aproximada_dias: Number(a.edad_aproximada_dias || 0),
          precio_adquisicion: a.precio_adquisicion,
          peso_ingreso_kg: a.peso_ingreso_kg || null,
        })),
      }
      if (modo === 'nuevo') {
        payload.lote_nuevo = {
          codigo: form.codigo,
          fecha_ingreso: form.fecha_ingreso || form.fecha,
        }
      } else {
        payload.lote = Number(form.lote)
      }
      await api.post('/compra-animales/compras-animales/', payload)
      setAbierto(false)
      setForm({ fecha: '', proveedor: '', observaciones: '', codigo: '', fecha_ingreso: '', lote: '' })
      setAnimales([{ ...FILA_ANIMAL_VACIA }])
      await cargar()
    } catch (e) {
      setErrorForm(extraerError(e))
    } finally {
      setGuardando(false)
    }
  }

  const totalEstimado = animales.reduce((acc, a) => acc + (Number(a.precio_adquisicion) || 0), 0)
  const formularioValido =
    form.fecha &&
    animales.every((a) => a.diio && a.raza && a.sexo && a.precio_adquisicion) &&
    (modo === 'nuevo' ? form.codigo : form.lote)

  return (
    <div className="space-y-4">
      <PageHeader
        titulo="Compras de animales"
        descripcion="Adquisición de ganado y creación de lotes"
        acciones={<Boton onClick={() => setAbierto(true)}>+ Nueva compra</Boton>}
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
              { key: 'proveedor_nombre', label: 'Proveedor', render: (c) => c.proveedor_nombre ?? '—' },
              { key: 'detalles', label: 'Animales', render: (c) => numero(c.detalles?.length ?? 0, 0), ocultaEnMovil: true },
              { key: 'total', label: 'Total', render: (c) => moneda(c.total), ocultaEnMovil: true },
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

      <Modal abierto={!!recordSel} titulo={`Compra #${recordSel?.id ?? ''}`} onClose={() => setRecordSel(null)}>
        {recordSel && (
          <div className="space-y-4">
            <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-xs font-medium uppercase text-slate-400">Fecha</dt>
                <dd className="font-medium text-slate-700">{fecha(recordSel.fecha)}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase text-slate-400">Proveedor</dt>
                <dd className="font-medium text-slate-700">{recordSel.proveedor_nombre ?? '—'}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase text-slate-400">Total</dt>
                <dd className="font-medium text-emerald-600">{moneda(recordSel.total)}</dd>
              </div>
              {recordSel.observaciones && (
                <div className="sm:col-span-2">
                  <dt className="text-xs font-medium uppercase text-slate-400">Observaciones</dt>
                  <dd className="text-slate-700">{recordSel.observaciones}</dd>
                </div>
              )}
            </dl>
            {recordSel.detalles && recordSel.detalles.length > 0 && (
              <div>
                <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Animales ({recordSel.detalles.length})
                </div>
                <div className="overflow-x-auto rounded-lg border border-slate-200">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 text-xs uppercase text-slate-400">
                      <tr>
                        <th className="px-3 py-2">DIIO</th>
                        <th className="px-3 py-2">Raza</th>
                        <th className="px-3 py-2">Sexo</th>
                        <th className="px-3 py-2 text-right">Precio</th>
                        <th className="hidden px-3 py-2 sm:table-cell">Peso</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {(recordSel.detalles as any[]).map((d, i) => {
                        const an = d.animal_detail ?? {}
                        return (
                          <tr key={i}>
                            <td className="px-3 py-2 font-medium text-slate-700">{an.diio ?? d.animal}</td>
                            <td className="px-3 py-2 text-slate-600">{an.raza_nombre ?? '—'}</td>
                            <td className="px-3 py-2 text-slate-600">
                              {an.sexo === 'M' ? 'Macho' : an.sexo === 'H' ? 'Hembra' : an.sexo ?? '—'}
                            </td>
                            <td className="px-3 py-2 text-right text-slate-700">{moneda(d.precio_adquisicion)}</td>
                            <td className="hidden px-3 py-2 text-slate-600 sm:table-cell">
                              {an.peso_ingreso_kg ? `${numero(an.peso_ingreso_kg)} kg` : '—'}
                            </td>
                          </tr>
                        )
                      })}
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

      <Modal abierto={abierto} titulo="Nueva compra de animales" onClose={() => setAbierto(false)} ancho="max-w-5xl">
        <div className="space-y-4">
          {errorForm && <MensajeError mensaje={errorForm} />}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <label className="block">
              <span className="text-sm font-medium text-slate-600">Fecha compra *</span>
              <input
                type="date"
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                value={form.fecha}
                onChange={(e) => setForm({ ...form, fecha: e.target.value })}
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-slate-600">Proveedor</span>
              <select
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                value={form.proveedor}
                onChange={(e) => setForm({ ...form, proveedor: e.target.value })}
              >
                <option value="">— Sin proveedor —</option>
                {proveedores.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="rounded-lg border border-slate-200 p-3">
            <div className="mb-2 flex gap-2">
              <button
                className={`rounded-md px-3 py-1 text-sm ${modo === 'nuevo' ? 'bg-emerald-600 text-white' : 'bg-slate-100'}`}
                onClick={() => setModo('nuevo')}
              >
                Lote nuevo
              </button>
              <button
                className={`rounded-md px-3 py-1 text-sm ${modo === 'existente' ? 'bg-emerald-600 text-white' : 'bg-slate-100'}`}
                onClick={() => setModo('existente')}
              >
                Incorporar a lote existente
              </button>
            </div>
            {modo === 'nuevo' ? (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className="text-sm font-medium text-slate-600">Código de lote *</span>
                  <input
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                    value={form.codigo}
                    onChange={(e) => setForm({ ...form, codigo: e.target.value })}
                  />
                </label>
                <label className="block">
                  <span className="text-sm font-medium text-slate-600">Fecha ingreso</span>
                  <input
                    type="date"
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                    value={form.fecha_ingreso}
                    onChange={(e) => setForm({ ...form, fecha_ingreso: e.target.value })}
                  />
                </label>
              </div>
            ) : (
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
            )}
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm font-semibold text-slate-700">Animales</span>
              <Boton variante="secundario" onClick={() => setAnimales((a) => [...a, { ...FILA_ANIMAL_VACIA }])}>
                + Agregar animal
              </Boton>
            </div>
            <div className="space-y-2">
              {animales.map((fila, i) => (
                <div key={i} className="grid grid-cols-1 gap-2 rounded-lg border border-slate-200 p-3 lg:grid-cols-12">
                  <input
                    placeholder="DIIO *"
                    className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm focus:border-emerald-500 focus:outline-none lg:col-span-2"
                    value={fila.diio}
                    onChange={(e) => actualizarAnimal(i, 'diio', e.target.value)}
                  />
                  <select
                    className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm focus:border-emerald-500 focus:outline-none lg:col-span-2"
                    value={fila.raza}
                    onChange={(e) => actualizarAnimal(i, 'raza', e.target.value)}
                  >
                    <option value="">Raza *</option>
                    {razas.map((r) => (
                      <option key={r.value} value={r.value}>
                        {r.label}
                      </option>
                    ))}
                  </select>
                  <select
                    className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm focus:border-emerald-500 focus:outline-none lg:col-span-1"
                    value={fila.sexo}
                    onChange={(e) => actualizarAnimal(i, 'sexo', e.target.value)}
                  >
                    <option value="M">M</option>
                    <option value="H">H</option>
                  </select>
                  <input
                    type="date"
                    className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm focus:border-emerald-500 focus:outline-none lg:col-span-2"
                    value={fila.fecha_nacimiento}
                    onChange={(e) => actualizarAnimal(i, 'fecha_nacimiento', e.target.value)}
                  />
                  <input
                    type="number"
                    placeholder="Edad días"
                    className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm focus:border-emerald-500 focus:outline-none lg:col-span-1"
                    value={fila.edad_aproximada_dias}
                    onChange={(e) => actualizarAnimal(i, 'edad_aproximada_dias', e.target.value)}
                  />
                  <input
                    type="number"
                    step="0.01"
                    placeholder="Precio *"
                    className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm focus:border-emerald-500 focus:outline-none lg:col-span-2"
                    value={fila.precio_adquisicion}
                    onChange={(e) => actualizarAnimal(i, 'precio_adquisicion', e.target.value)}
                  />
                  <input
                    type="number"
                    step="0.01"
                    placeholder="Peso kg"
                    className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm focus:border-emerald-500 focus:outline-none lg:col-span-1"
                    value={fila.peso_ingreso_kg}
                    onChange={(e) => actualizarAnimal(i, 'peso_ingreso_kg', e.target.value)}
                  />
                  <button
                    className="text-red-500 hover:text-red-700"
                    onClick={() => setAnimales((a) => a.filter((_, idx) => idx !== i))}
                    disabled={animales.length === 1}
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
            <div className="mt-2 text-right text-sm text-slate-500">
              Total estimado: <span className="font-semibold text-slate-700">{moneda(totalEstimado)}</span>
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
            <Boton onClick={() => void guardar()} disabled={guardando || !formularioValido}>
              {guardando ? 'Guardando...' : 'Guardar compra'}
            </Boton>
          </div>
        </div>
      </Modal>
    </div>
  )
}