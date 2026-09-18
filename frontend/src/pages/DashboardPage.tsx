import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, extraerError } from '../api/client'
import type { ResumenDashboard } from '../api/types'
import { Card, MensajeError, Spinner } from '../components/ui'
import { moneda, numero } from '../utils/format'

export function DashboardPage() {
  const [resumen, setResumen] = useState<ResumenDashboard | null>(null)
  const [error, setError] = useState('')
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    void (async () => {
      try {
        const { data } = await api.get<ResumenDashboard>('/dashboard/resumen/')
        setResumen(data)
      } catch (e) {
        setError(extraerError(e))
      } finally {
        setCargando(false)
      }
    })()
  }, [])

  if (cargando) return <Spinner />
  if (error) return <MensajeError mensaje={error} />
  if (!resumen) return null

  const tarjetas = [
    { label: 'Animales activos', valor: numero(resumen.animales_activos, 0), color: 'text-emerald-700' },
    { label: 'Lotes activos', valor: numero(resumen.lotes_activos, 0), color: 'text-sky-700' },
    { label: 'Animales fallecidos', valor: numero(resumen.animales_fallecidos, 0), color: 'text-red-600' },
    { label: 'Valor inventario', valor: moneda(resumen.valor_inventario), color: 'text-slate-800' },
    { label: 'Ventas confirmadas', valor: moneda(resumen.ventas_confirmadas_total), color: 'text-emerald-700' },
    { label: 'Utilidad total', valor: moneda(resumen.utilidad_total), color: 'text-emerald-700' },
  ]

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-semibold text-slate-800">Dashboard</h1>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {tarjetas.map((t) => (
          <div key={t.label} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="text-xs uppercase tracking-wide text-slate-400">{t.label}</div>
            <div className={`mt-1 text-2xl font-bold ${t.color}`}>{t.valor}</div>
          </div>
        ))}
      </div>

      {resumen.alertas_stock.length > 0 && (
        <Card title="Alertas de stock (bajo mínimo)">
          <div className="space-y-2">
            {resumen.alertas_stock.map((s) => (
              <div
                key={s.id}
                className="flex items-center justify-between rounded-md bg-red-50 px-4 py-2 text-sm"
              >
                <span className="font-medium text-red-700">{s.nombre}</span>
                <span className="text-red-600">
                  {numero(s.stock_actual)} / min {numero(s.stock_minimo)} {s.unidad_base}
                </span>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card
        title="Stock de insumos"
        acciones={
          <Link to="/productos" className="text-sm font-medium text-emerald-700 hover:underline">
            Ver productos
          </Link>
        }
      >
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-100 text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="px-3 py-2 font-medium">Producto</th>
                <th className="px-3 py-2 font-medium">Stock</th>
                <th className="px-3 py-2 font-medium">Mínimo</th>
                <th className="px-3 py-2 font-medium">Costo promedio</th>
                <th className="px-3 py-2 font-medium">Valor</th>
                <th className="px-3 py-2 font-medium">Equivalencias</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {resumen.stock_relevante.map((s) => (
                <tr key={s.id} className="hover:bg-slate-50">
                  <td className="px-3 py-2 font-medium text-slate-700">{s.nombre}</td>
                  <td className="px-3 py-2 text-slate-600">
                    {numero(s.stock_actual)} {s.unidad_base}
                  </td>
                  <td className="px-3 py-2 text-slate-500">{numero(s.stock_minimo)}</td>
                  <td className="px-3 py-2 text-slate-600">{moneda(s.costo_promedio)}</td>
                  <td className="px-3 py-2 text-slate-600">{moneda(s.valor)}</td>
                  <td className="px-3 py-2 text-slate-500">
                    {s.equivalencias.length === 0
                      ? '—'
                      : s.equivalencias
                          .map((eq) => `${numero(eq.cantidad)} ${eq.presentacion}`)
                          .join(', ')}
                  </td>
                </tr>
              ))}
              {resumen.stock_relevante.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-3 py-6 text-center text-slate-400">
                    Sin productos registrados
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}