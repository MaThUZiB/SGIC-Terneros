import { useId, type ReactNode } from 'react'

/** Native two-axis scrolling keeps touch gestures and pinch zoom available. */
export function TableScroll({children,className=''}:{children:ReactNode;className?:string}){
  const hint=useId()
  return <div className="min-w-0 max-w-full">
    <p id={hint} className="sr-only">
      Tabla desplazable en ambas direcciones; utiliza el gesto de deslizamiento o las flechas del teclado.
    </p>
    <div role="region" aria-label="Tabla de información desplazable" aria-describedby={hint}
      tabIndex={0} className={'table-scroll '+className}>{children}</div>
  </div>
}
