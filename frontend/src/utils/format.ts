export function moneda(valor: number | string | null | undefined): string {
  const n = typeof valor === 'string' ? Number(valor) : (valor ?? 0)
  if (Number.isNaN(n)) return '$0'
  return n.toLocaleString('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 })
}

export function numero(valor: number | string | null | undefined, decimales = 2): string {
  const n = typeof valor === 'string' ? Number(valor) : (valor ?? 0)
  if (Number.isNaN(n)) return '0'
  return n.toLocaleString('es-CL', { minimumFractionDigits: 0, maximumFractionDigits: decimales })
}

export function fecha(valor: string | null | undefined): string {
  if (!valor) return '—'
  const d = new Date(valor)
  if (Number.isNaN(d.getTime())) return valor
  return d.toLocaleDateString('es-CL')
}

export function fechaHora(valor: string | null | undefined): string {
  if (!valor) return '—'
  const d = new Date(valor)
  if (Number.isNaN(d.getTime())) return valor
  return d.toLocaleString('es-CL')
}

export function hoy(): string {
  const d = new Date()
  const mes = String(d.getMonth() + 1).padStart(2, '0')
  const dia = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${mes}-${dia}`
}

export function extraerLista<T>(data: T[] | { results: T[] }): T[] {
  return Array.isArray(data) ? data : data.results
}