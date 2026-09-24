import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { api, extraerError } from '../api/client'
import type { CostoLote } from '../api/types'
import { Boton, Card, MensajeError, Modal, PageHeader, Spinner, Tabla, Badge } from '../components/ui'
import { fecha, moneda, numero, hoy } from '../utils/format'

interface AnimalLote {
  id: number
  diio: string
  raza_nombre: string
  sexo: string
  estado: string
  peso_ingreso_kg: string | null
  precio_adquisicion: string
}

export function LoteDetallePage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [costo, setCosto] = useState<CostoLote | null>(null)
  const [lote, setLote] = useState<any | null>(null)
  const [error, setError] = useState('')
  const [cargando, setCargando] = useState(true)

  const [dividirAbierto, setDividirAbierto] = useState(false)
  const [seleccion, setSeleccion] = useState<number[]>([])
  const [nuevoCodigo, setNuevoCodigo] = useState('')
  const [fechaDivision, setFechaDivision] = useState(hoy())
  const [formError, setFormError] = useState('')
  const [procesando, setProcesando] = useState(false)

  const cargar = useCallback(async () => {
    if (!id) return
    setCargando(true)
    setError('')
    try {
      const [rc, rl] = await Promise.all([
        api.get(`/dashboard/costos-lote/${id}/`),
        api.get(`/ganaderia/lotes/${id}/`),
      ])
      setCosto(rc.data)
      setLote(rl.data)
    } catch (e) {
      setError(extraerError(e))
    } finally {
      setCargando(false)
    }
  }, [id])

  useEffect(() => {
    void cargar()
  }, [cargar])

  async function marcarFallecido(animal: AnimalLote) {
    if (!window.confirm(`¿Marcar como fallecido el animal ${animal.diio}?`)) return
    try {
      await api.post(`/ganaderia/animales/${animal.id}/marcar_fallecido/`, {})
      await cargar()
    } catch (e) {
      setError(extraerError(e))
    }
  }

  async function dividir() {
    setProcesando(true)
    setFormError('')
    try {
      await api.post(`/ganaderia/lotes/${id}/dividir/`, {
        nuevo_codigo: nuevoCodigo,
        animales_ids: seleccion,
        fecha: fechaDivision,
      })
      setDividirAbierto(false)
      setSeleccion([])
      setNuevoCodigo('')
      await cargar()
    } catch (e) {
      setFormError(extraerError(e))
    } finally {
      setProcesando(false)
    }
  }

  if (cargando) return <Spinner />
  if (error) return <MensajeError mensaje={error} />
  if (!costo || !lote) return null

  const animalesActivos: AnimalLote[] = (lote.animales ?? []).filter((a: AnimalLote) => a.estado === 'ACTIVO')

  const desglose = [
    { label: 'Adquisición', valor: costo.costo.adquisicion },
    { label: 'Alimentación', valor: costo.costo.alimentacion },
    { label: 'Sanidad', valor: costo.costo.sanidad },
    { label: 'Gastos imputables', valor: costo.costo.gastos_imputables },
    { label: 'Costo total', valor: costo.costo.costo_total, destacado: true },
  ]

  return (
    <div className="space-y-5">
      <div>
          <button className="mb-2 text-sm font-medium text-emerald-700 hover:underline" onClick={() => navigate('/lotes')}>
            ← Volver a lotes
          </button>
          <PageHeader
            titulo={`Lote ${costo.lote_codigo}`}
            acciones={
              <div className="flex items-center gap-3">
                <Badge color={costo.estado === 'ACTIVO' ? 'green' : 'slate'}>{costo.estado}</Badge>
                {costo.estado === 'ACTIVO' && (
                  <Boton onClick={() => setDividirAbierto(true)}>Dividir lote</Boton>
                )}
              </div>
            }
          />
        </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Tarjeta label="Animales (activos)" valor={`${costo.animales_activos} / ${costo.animales_considerados}`} />
        <Tarjeta label="Costo total" valor={moneda(costo.costo.costo_total)} />
        <Tarjeta label="Costo promedio/animal" valor={moneda(costo.costo_promedio_animal)} />
        <Tarjeta label="Venta acumulada" valor={moneda(costo.venta_total)} />
        <Tarjeta label="Costo reconocido" valor={moneda(costo.costo_reconocido)} />
        <Tarjeta label="Utilidad" valor={moneda(costo.utilidad)} color="text-emerald-700" />
        <Tarjeta label="Margen" valor={`${numero(costo.margen_porcentaje)}%`} color="text-emerald-700" />
        <Tarjeta label="Peso vendido" valor={`${numero(costo.peso_vendido_kg)} kg`} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card title="Desglose de costos">
          <div className="space-y-2">
            {desglose.map((d) => (
              <div
                key={d.label}
                className={`flex items-center justify-between rounded-md px-3 py-2 text-sm ${
                  d.destacado ? 'bg-emerald-50 font-semibold text-emerald-800' : 'bg-slate-50 text-slate-600'
                }`}
              >
                <span>{d.label}</span>
                <span>{moneda(d.valor)}</span>
              </div>
            ))}
          </div>
        </Card>

        <Card title={`Animales activos (${animalesActivos.length})`}>
          <Tabla<AnimalLote>
            columnas={[
              { key: 'diio', label: 'DIIO' },
              { key: 'raza_nombre', label: 'Raza' },
              { key: 'sexo', label: 'Sexo' },
              {
                key: 'peso_ingreso_kg',
                label: 'Peso ing.',
                render: (a) => (a.peso_ingreso_kg ? `${numero(a.peso_ingreso_kg)} kg` : '—'),
              },
            ]}
            datos={animalesActivos}
            acciones={(a) => (
              <Boton variante="peligro" onClick={() => void marcarFallecido(a)}>
                Fallecido
              </Boton>
            )}
          />
        </Card>
      </div>

      <Modal abierto={dividirAbierto} titulo="Dividir lote" onClose={() => setDividirAbierto(false)}>
        <div className="space-y-4">
          {formError && <MensajeError mensaje={formError} />}
          <label className="block">
            <span className="text-sm font-medium text-slate-600">Código del nuevo lote *</span>
            <input
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
              value={nuevoCodigo}
              onChange={(e) => setNuevoCodigo(e.target.value)}
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-slate-600">Fecha</span>
            <input
              type="date"
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
              value={fechaDivision}
              onChange={(e) => setFechaDivision(e.target.value)}
            />
          </label>
          <div>
            <span className="text-sm font-medium text-slate-600">
              Animales a mover ({seleccion.length} seleccionados)
            </span>
            <div className="mt-2 max-h-56 space-y-1 overflow-y-auto rounded-lg border border-slate-200 p-2">
              {animalesActivos.map((a) => (
                <label key={a.id} className="flex items-center gap-2 rounded px-2 py-1 text-sm hover:bg-slate-50">
                  <input
                    type="checkbox"
                    checked={seleccion.includes(a.id)}
                    onChange={(e) =>
                      setSeleccion((s) => (e.target.checked ? [...s, a.id] : s.filter((x) => x !== a.id)))
                    }
                  />
                  {a.diio} · {a.raza_nombre}
                </label>
              ))}
              {animalesActivos.length === 0 && <div className="p-2 text-sm text-slate-400">Sin animales activos</div>}
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Boton variante="secundario" onClick={() => setDividirAbierto(false)}>
              Cancelar
            </Boton>
            <Boton onClick={() => void dividir()} disabled={procesando || !nuevoCodigo || seleccion.length === 0}>
              {procesando ? 'Dividiendo...' : 'Dividir'}
            </Boton>
          </div>
        </div>
      </Modal>
    </div>
  )
}

function Tarjeta({ label, valor, color = 'text-slate-800' }: { label: string; valor: string; color?: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="text-xs uppercase tracking-wide text-slate-400">{label}</div>
      <div className={`mt-1 text-lg font-bold ${color}`}>{valor}</div>
    </div>
  )
}