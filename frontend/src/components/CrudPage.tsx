import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { api, extraerError } from '../api/client'
import { Boton, Card, MensajeError, Modal, Spinner, Tabla, type Columna } from './ui'

export interface Opcion {
  value: number | string
  label: string
}

export interface CampoDef {
  name: string
  label: string
  type?: 'text' | 'number' | 'date' | 'textarea' | 'select' | 'checkbox' | 'email'
  required?: boolean
  step?: string
  placeholder?: string
  opciones?: Opcion[]
  opcionesEndpoint?: string
  endpointFiltro?: { campo: string; param: string }
  opcionesLabelField?: string
  defaultValue?: unknown
  ayuda?: string
  ocultoEnEdicion?: boolean
}

export interface FiltroDef {
  label: string
  param: string
  opciones: Opcion[]
}

interface CrudPageProps {
  titulo: string
  endpoint: string
  columnas: Columna<any>[]
  campos: CampoDef[]
  puedeCrear?: boolean
  puedeEditar?: boolean
  puedeEliminar?: boolean
  filtros?: FiltroDef[]
  accionesExtra?: (row: any, recargar: () => void) => ReactNode
  onRowClick?: (row: any) => void
  etiquetaCrear?: string
}

type Valores = Record<string, unknown>

function valoresIniciales(campos: CampoDef[]): Valores {
  const v: Valores = {}
  for (const c of campos) {
    if (c.defaultValue !== undefined) v[c.name] = c.defaultValue
    else if (c.type === 'checkbox') v[c.name] = true
    else v[c.name] = ''
  }
  return v
}

export function CrudPage({
  titulo,
  endpoint,
  columnas,
  campos,
  puedeCrear = true,
  puedeEditar = true,
  puedeEliminar = true,
  filtros = [],
  accionesExtra,
  onRowClick,
  etiquetaCrear = 'Nuevo',
}: CrudPageProps) {
  const [datos, setDatos] = useState<any[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [pagina, setPagina] = useState(1)
  const [haySiguiente, setHaySiguiente] = useState(false)
  const [filtrosActivos, setFiltrosActivos] = useState<Record<string, string>>({})

  const [modalAbierto, setModalAbierto] = useState(false)
  const [editando, setEditando] = useState<any | null>(null)
  const [valores, setValores] = useState<Valores>({})
  const [guardando, setGuardando] = useState(false)
  const [errorForm, setErrorForm] = useState('')
  const [opcionesDinamicas, setOpcionesDinamicas] = useState<Record<string, Opcion[]>>({})

  const cargar = useCallback(async () => {
    setCargando(true)
    setError('')
    try {
      const params: Record<string, string | number> = { page: pagina }
      for (const [k, v] of Object.entries(filtrosActivos)) {
        if (v) params[k] = v
      }
      const { data } = await api.get(endpoint, { params })
      if (Array.isArray(data)) {
        setDatos(data)
        setHaySiguiente(false)
      } else {
        setDatos(data.results ?? [])
        setHaySiguiente(Boolean(data.next))
      }
    } catch (e) {
      setError(extraerError(e))
    } finally {
      setCargando(false)
    }
  }, [endpoint, pagina, filtrosActivos])

  useEffect(() => {
    void cargar()
  }, [cargar])

  const opcionesPorCampo = useMemo(() => {
    const mapa: Record<string, Opcion[]> = {}
    for (const c of campos) {
      if (c.opciones) mapa[c.name] = c.opciones
      if (opcionesDinamicas[c.name]) mapa[c.name] = opcionesDinamicas[c.name]
    }
    return mapa
  }, [campos, opcionesDinamicas])

  useEffect(() => {
    const conEndpoint = campos.filter((c) => c.opcionesEndpoint && !c.opciones)
    if (conEndpoint.length === 0) return
    let activo = true
    void (async () => {
      const resultado: Record<string, Opcion[]> = {}
      await Promise.all(
        conEndpoint.map(async (c) => {
          try {
            const { data } = await api.get(c.opcionesEndpoint as string)
            const lista = Array.isArray(data) ? data : (data.results ?? [])
            const labelField = c.opcionesLabelField ?? 'nombre'
            resultado[c.name] = lista.map((item: Record<string, unknown>) => ({
              value: item.id as number,
              label: String(item[labelField] ?? item.id),
            }))
          } catch {
            resultado[c.name] = []
          }
        }),
      )
      if (activo) setOpcionesDinamicas((prev) => ({ ...prev, ...resultado }))
    })()
    return () => {
      activo = false
    }
  }, [campos])

  function abrirCrear() {
    setEditando(null)
    setValores(valoresIniciales(campos))
    setErrorForm('')
    setModalAbierto(true)
  }

  function abrirEditar(row: any) {
    const v: Valores = {}
    for (const c of campos) {
      const valor = (row as Record<string, unknown>)[c.name]
      v[c.name] = valor ?? (c.type === 'checkbox' ? false : '')
    }
    setEditando(row)
    setValores(v)
    setErrorForm('')
    setModalAbierto(true)
  }

  function limpiarVacios(v: Valores): Valores {
    const salida: Valores = {}
    for (const [k, valor] of Object.entries(v)) {
      if (valor === '') salida[k] = null
      else salida[k] = valor
    }
    return salida
  }

  async function guardar() {
    setGuardando(true)
    setErrorForm('')
    try {
      const payload = limpiarVacios(valores)
      if (editando) {
        await api.patch(`${endpoint}${editando.id}/`, payload)
      } else {
        await api.post(endpoint, payload)
      }
      setModalAbierto(false)
      await cargar()
    } catch (e) {
      setErrorForm(extraerError(e))
    } finally {
      setGuardando(false)
    }
  }

  async function eliminar(row: any) {
    if (!window.confirm(`¿Eliminar el registro #${row.id}?`)) return
    try {
      await api.delete(`${endpoint}${row.id}/`)
      await cargar()
    } catch (e) {
      setError(extraerError(e))
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-xl font-semibold text-slate-800">{titulo}</h1>
        <div className="flex flex-wrap items-end gap-3">
          {filtros.map((f) => (
            <label key={f.param} className="flex flex-col text-xs text-slate-500">
              {f.label}
              <select
                className="mt-1 rounded-md border border-slate-300 px-2 py-1.5 text-sm text-slate-700"
                value={filtrosActivos[f.param] ?? ''}
                onChange={(e) => {
                  setPagina(1)
                  setFiltrosActivos((prev) => ({ ...prev, [f.param]: e.target.value }))
                }}
              >
                <option value="">Todos</option>
                {f.opciones.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
          ))}
          {puedeCrear && <Boton onClick={abrirCrear}>+ {etiquetaCrear}</Boton>}
        </div>
      </div>

      {error && <MensajeError mensaje={error} />}

      <Card>
        {cargando ? (
          <Spinner />
        ) : (
          <>
            <Tabla
              columnas={columnas}
              datos={datos}
              acciones={
                puedeEditar || puedeEliminar || accionesExtra
                  ? (row) => (
                      <div className="flex justify-end gap-2">
                        {accionesExtra?.(row, cargar)}
                        {puedeEditar && (
                          <Boton variante="secundario" onClick={() => abrirEditar(row)}>
                            Editar
                          </Boton>
                        )}
                        {puedeEliminar && (
                          <Boton variante="peligro" onClick={() => void eliminar(row)}>
                            Eliminar
                          </Boton>
                        )}
                      </div>
                    )
                  : undefined
              }
              onRowClick={onRowClick}
            />
            {(pagina > 1 || haySiguiente) && (
              <div className="mt-4 flex items-center justify-between text-sm text-slate-500">
                <Boton variante="secundario" disabled={pagina <= 1} onClick={() => setPagina((p) => p - 1)}>
                  Anterior
                </Boton>
                <span>Página {pagina}</span>
                <Boton variante="secundario" disabled={!haySiguiente} onClick={() => setPagina((p) => p + 1)}>
                  Siguiente
                </Boton>
              </div>
            )}
          </>
        )}
      </Card>

      <Modal
        abierto={modalAbierto}
        titulo={editando ? `Editar ${titulo}` : `Nuevo ${titulo}`}
        onClose={() => setModalAbierto(false)}
      >
        <div className="space-y-4">
          {errorForm && <MensajeError mensaje={errorForm} />}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {campos
              .filter((c) => !(editando && c.ocultoEnEdicion))
              .map((c) => (
                <label key={c.name} className={c.type === 'textarea' ? 'sm:col-span-2' : ''}>
                  <span className="text-sm font-medium text-slate-600">
                    {c.label} {c.required && <span className="text-red-500">*</span>}
                  </span>
                  <CampoInput
                    campo={c}
                    valor={valores[c.name]}
                    opciones={opcionesPorCampo[c.name] ?? c.opciones ?? []}
                    onChange={(v) => setValores((prev) => ({ ...prev, [c.name]: v }))}
                  />
                  {c.ayuda && <span className="mt-1 block text-xs text-slate-400">{c.ayuda}</span>}
                </label>
              ))}
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Boton variante="secundario" onClick={() => setModalAbierto(false)}>
              Cancelar
            </Boton>
            <Boton onClick={() => void guardar()} disabled={guardando}>
              {guardando ? 'Guardando...' : 'Guardar'}
            </Boton>
          </div>
        </div>
      </Modal>
    </div>
  )
}

function CampoInput({
  campo,
  valor,
  opciones,
  onChange,
}: {
  campo: CampoDef
  valor: unknown
  opciones: Opcion[]
  onChange: (v: unknown) => void
}) {
  const base = 'mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700'
  if (campo.type === 'select') {
    return (
      <select className={base} value={String(valor ?? '')} onChange={(e) => onChange(e.target.value)}>
        <option value="">— Seleccionar —</option>
        {opciones.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    )
  }
  if (campo.type === 'checkbox') {
    return (
      <input
        type="checkbox"
        className="mt-2 h-4 w-4 rounded border-slate-300"
        checked={Boolean(valor)}
        onChange={(e) => onChange(e.target.checked)}
      />
    )
  }
  if (campo.type === 'textarea') {
    return (
      <textarea
        className={base}
        rows={3}
        value={String(valor ?? '')}
        placeholder={campo.placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
    )
  }
  return (
    <input
      className={base}
      type={campo.type ?? 'text'}
      step={campo.step}
      value={String(valor ?? '')}
      placeholder={campo.placeholder}
      onChange={(e) => onChange(e.target.value)}
    />
  )
}