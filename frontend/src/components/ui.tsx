import type { ReactNode } from 'react'

export function Boton({
  children,
  onClick,
  variante = 'primario',
  tipo = 'button',
  disabled,
  className = '',
}: {
  children: ReactNode
  onClick?: () => void
  variante?: 'primario' | 'secundario' | 'peligro' | 'exito' | 'plano'
  tipo?: 'button' | 'submit'
  disabled?: boolean
  className?: string
}) {
  const estilos: Record<string, string> = {
    primario: 'bg-emerald-600 text-white hover:bg-emerald-700',
    secundario: 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-50',
    peligro: 'bg-red-600 text-white hover:bg-red-700',
    exito: 'bg-sky-600 text-white hover:bg-sky-700',
    plano: 'text-emerald-700 hover:bg-emerald-50',
  }
  return (
    <button
      type={tipo}
      onClick={onClick}
      disabled={disabled}
      className={`rounded-md px-3 py-1.5 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${estilos[variante]} ${className}`}
    >
      {children}
    </button>
  )
}

export function Card({ title, children, acciones }: { title?: string; children: ReactNode; acciones?: ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
      {(title || acciones) && (
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
          {title && <h3 className="text-sm font-semibold text-slate-700">{title}</h3>}
          {acciones}
        </div>
      )}
      <div className="p-5">{children}</div>
    </div>
  )
}

export function Modal({
  abierto,
  titulo,
  onClose,
  children,
  ancho = 'max-w-2xl',
}: {
  abierto: boolean
  titulo: string
  onClose: () => void
  children: ReactNode
  ancho?: string
}) {
  if (!abierto) return null
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/50 p-4">
      <div className={`mt-10 w-full ${ancho} rounded-xl bg-white shadow-xl`}>
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
          <h3 className="text-base font-semibold text-slate-800">{titulo}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700" aria-label="Cerrar">
            ✕
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  )
}

export function Badge({ children, color = 'slate' }: { children: ReactNode; color?: string }) {
  const colores: Record<string, string> = {
    slate: 'bg-slate-100 text-slate-700',
    green: 'bg-emerald-100 text-emerald-700',
    red: 'bg-red-100 text-red-700',
    blue: 'bg-sky-100 text-sky-700',
    amber: 'bg-amber-100 text-amber-700',
  }
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${colores[color] ?? colores.slate}`}>
      {children}
    </span>
  )
}

export function Spinner({ texto = 'Cargando...' }: { texto?: string }) {
  return <div className="py-8 text-center text-sm text-slate-500">{texto}</div>
}

export function MensajeError({ mensaje }: { mensaje: string }) {
  return <div className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">{mensaje}</div>
}

export function EstadoVacio({ texto = 'Sin registros' }: { texto?: string }) {
  return <div className="py-8 text-center text-sm text-slate-400">{texto}</div>
}

export interface Columna<T> {
  key: string
  label: string
  render?: (row: T) => ReactNode
}

export function Tabla<T extends { id: number }>({
  columnas,
  datos,
  acciones,
  onRowClick,
}: {
  columnas: Columna<T>[]
  datos: T[]
  acciones?: (row: T) => ReactNode
  onRowClick?: (row: T) => void
}) {
  if (datos.length === 0) return <EstadoVacio />
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-slate-100 text-sm">
        <thead>
          <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
            {columnas.map((c) => (
              <th key={c.key} className="px-3 py-2 font-medium">
                {c.label}
              </th>
            ))}
            {acciones && <th className="px-3 py-2 text-right font-medium">Acciones</th>}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-50">
          {datos.map((row) => (
            <tr
              key={row.id}
              className={`hover:bg-slate-50 ${onRowClick ? 'cursor-pointer' : ''}`}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
            >
              {columnas.map((c) => (
                <td key={c.key} className="px-3 py-2 text-slate-700">
                  {c.render ? c.render(row) : String((row as Record<string, unknown>)[c.key] ?? '')}
                </td>
              ))}
              {acciones && (
                <td className="px-3 py-2 text-right" onClick={(e) => onRowClick && e.stopPropagation()}>
                  {acciones(row)}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}