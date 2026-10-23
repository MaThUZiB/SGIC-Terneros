import { calcularPresentacionesEquivalentes, nombrePresentacionPlural, type PresentacionStock } from '../utils/presentationStock'

const formato = new Intl.NumberFormat('es-CL', { maximumFractionDigits: 3 })
const cantidadMostrada = (n: number) => n > 0 && n < 0.001 ? 'menos de 0,001' : formato.format(n)

function Equivalencia({ stock, unidad, presentacion }: {
  stock: number
  unidad: string
  presentacion: PresentacionStock
}) {
  const cantidad = calcularPresentacionesEquivalentes(stock, Number(presentacion.cantidad_base))
  if (cantidad === null) return null

  return <div className="text-xs leading-5" title="Equivalencia calculada sobre el stock en unidades base. No representa un conteo de envases cerrados.">
    <span className="font-medium text-emerald-800">
      {cantidadMostrada(cantidad)} {nombrePresentacionPlural(presentacion.nombre, cantidad)} equivalentes
    </span>
    <span className="text-slate-500"> · {formato.format(Number(presentacion.cantidad_base))} {unidad} por presentación</span>
  </div>
}

export function StockPresentations({ stock, unidad, presentaciones }: {
  stock: number
  unidad: string
  presentaciones: PresentacionStock[]
}) {
  const validas = presentaciones.filter(p => p.activa && Number.isFinite(Number(p.cantidad_base)) && Number(p.cantidad_base) > 0)
  if (!validas.length) return null

  const [principal, ...otras] = validas
  return <div className="mt-1 space-y-1">
    <Equivalencia stock={stock} unidad={unidad} presentacion={principal}/>
    {otras.length > 0 && <details className="text-xs text-slate-600">
      <summary className="cursor-pointer font-medium hover:text-emerald-800">Otras presentaciones ({otras.length})</summary>
      <div className="mt-1 space-y-1 border-l-2 border-slate-200 pl-2">
        {otras.map(p => <Equivalencia key={p.id} stock={stock} unidad={unidad} presentacion={p}/>)}
      </div>
    </details>}
  </div>
}
