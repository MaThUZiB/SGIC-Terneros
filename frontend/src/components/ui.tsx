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
    primario: 'bg-emerald-600 text-white hover:bg-emerald-700 active:bg-emerald-800',
    secundario: 'bg-white text-slate-700 ring-1 ring-inset ring-slate-300 hover:bg-slate-50',
    peligro: 'bg-white text-red-600 ring-1 ring-inset ring-red-200 hover:bg-red-50',
    exito: 'bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-300 hover:bg-emerald-100',
    plano: 'text-emerald-700 hover:bg-emerald-50',
  }
  return (
    <button
      type={tipo}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center justify-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-medium transition focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50 ${estilos[variante]} ${className}`}
    >
      {children}
    </button>
  )
}

export function Card({
  title,
  children,
  acciones,
}: {
  title?: string
  children: ReactNode
  acciones?: ReactNode
}) {
  return (
    <div className="rounded-xl border border-slate-200/80 bg-white shadow-sm">
      {(title || acciones) && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-3 sm:px-5">
          {title && <h3 className="text-sm font-semibold text-slate-700">{title}</h3>}
          {acciones}
        </div>
      )}
      <div className="p-4 sm:p-5">{children}</div>
    </div>
  )
}

export function PageHeader({
  titulo,
  descripcion,
  acciones,
}: {
  titulo: string
  descripcion?: string
  acciones?: ReactNode
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-slate-800 sm:text-2xl">{titulo}</h1>
        {descripcion && <p className="mt-0.5 text-sm text-slate-500">{descripcion}</p>}
      </div>
      {acciones && <div className="flex flex-wrap gap-2">{acciones}</div>}
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
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/40 backdrop-blur-sm p-3 sm:p-6">
      <div
        className={`mt-4 w-full ${ancho} rounded-xl bg-white shadow-2xl sm:mt-14`}
        role="dialog"
        aria-modal="true"
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white px-4 py-3 sm:px-5">
          <h3 className="text-base font-semibold text-slate-800">{titulo}</h3>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
            aria-label="Cerrar"
          >
            ✕
          </button>
        </div>
        <div className="p-4 sm:p-5">{children}</div>
      </div>
    </div>
  )
}

export function Badge({ children, color = 'slate' }: { children: ReactNode; color?: string }) {
  const colores: Record<string, string> = {
    slate: 'bg-slate-100 text-slate-600 ring-slate-200',
    green: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
    red: 'bg-red-50 text-red-600 ring-red-200',
    blue: 'bg-sky-50 text-sky-700 ring-sky-200',
    amber: 'bg-amber-50 text-amber-700 ring-amber-200',
  }
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${colores[color] ?? colores.slate}`}
    >
      {children}
    </span>
  )
}

export function Spinner({ texto = 'Cargando...' }: { texto?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-10 text-sm text-slate-500">
      <span className="h-6 w-6 animate-spin rounded-full border-2 border-emerald-200 border-t-emerald-600" />
      {texto}
    </div>
  )
}

export function MensajeError({ mensaje }: { mensaje: string }) {
  return (
    <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
      {mensaje}
    </div>
  )
}

export function EstadoVacio({ texto = 'Sin registros' }: { texto?: string }) {
  return <div className="py-10 text-center text-sm text-slate-400">{texto}</div>
}

export interface Columna<T> {
  key: string
  label: string
  render?: (row: T) => ReactNode
  /** Oculta la columna en pantallas chicas (menos de 640px). */
  ocultaEnMovil?: boolean
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
  const claseCelda = (c: Columna<T>) => `px-3 py-2.5 align-middle ${c.ocultaEnMovil ? 'hidden sm:table-cell' : ''}`
  return (
    <div className="-mx-1 overflow-x-auto px-1">
      <table className="min-w-full divide-y divide-slate-100 text-sm">
        <thead>
          <tr className="text-left text-[11px] uppercase tracking-wide text-slate-400">
            {columnas.map((c) => (
              <th key={c.key} className={`${claseCelda(c)} font-semibold`}>
                {c.label}
              </th>
            ))}
            {acciones && <th className="px-3 py-2.5 text-right font-semibold">Acciones</th>}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {datos.map((row) => (
            <tr
              key={row.id}
              className={`transition hover:bg-slate-50/70 ${onRowClick ? 'cursor-pointer' : ''}`}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
            >
              {columnas.map((c) => (
                <td key={c.key} className={`${claseCelda(c)} text-slate-700`}>
                  {c.render ? c.render(row) : String((row as Record<string, unknown>)[c.key] ?? '')}
                </td>
              ))}
              {acciones && (
                <td
                  className="whitespace-nowrap px-3 py-2.5 text-right"
                  onClick={(e) => onRowClick && e.stopPropagation()}
                >
                  <div className="inline-flex flex-wrap justify-end gap-1.5">{acciones(row)}</div>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function Campo({
  label,
  children,
  className = '',
  ayuda,
  requerido,
}: {
  label: string
  children: ReactNode
  className?: string
  ayuda?: string
  requerido?: boolean
}) {
  return (
    <label className={`block ${className}`}>
      <span className="text-sm font-medium text-slate-600">
        {label} {requerido && <span className="text-red-500">*</span>}
      </span>
      {children}
      {ayuda && <span className="mt-1 block text-xs text-slate-400">{ayuda}</span>}
    </label>
  )
}

export const inputCls =
  'mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm transition placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20'