import { useId, type ReactNode } from 'react'

/** Native two-axis scrolling keeps touch gestures and pinch zoom available. */
export function TableScroll({children,className=''}:{children:ReactNode;className?:string}){
  const hint=useId()
  return <div className="min-w-0 max-w-full">
    <p id={hint} className="border-b border-slate-100 bg-slate-50 px-3 py-2 text-xs text-slate-600">
      Desliza la tabla ↔ ↕ para ver columnas y filas.
    </p>
    <div role="region" aria-label="Tabla de información desplazable" aria-describedby={hint}
      tabIndex={0} className={'table-scroll '+className}>{children}</div>
  </div>
}
