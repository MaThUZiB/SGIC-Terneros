import { CloseButton } from './CloseButton'
import { useEffect, useRef } from 'react'

export interface ConfirmDetails {
  title: string
  description: string
  confirmLabel: string
  danger?: boolean
  summary?: {label:string;value:string;emphasis?:boolean}[]
}

export function OperationConfirmDialog({
  details, onCancel, onConfirm, busy = false,
}: {
  details: ConfirmDetails | null
  onCancel: () => void
  onConfirm: () => void
  busy?: boolean
}) {
  const cancelRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLElement>(null)

  useEffect(() => {
    if (!details) return
    cancelRef.current?.focus()
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !busy) onCancel()
      if(event.key==='Tab'){
        const items=panelRef.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')
        if(!items?.length)return
        const first=items[0],last=items[items.length-1]
        if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus()}
        else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus()}
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [details, busy, onCancel])

  const isOpen=Boolean(details)
  useEffect(()=>{
    if(!isOpen)return
    const previous=document.body.style.overflow
    document.body.style.overflow='hidden'
    return()=>{document.body.style.overflow=previous}
  },[isOpen])

  if (!details) return null

  return (
    <div className="modal-viewport fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-[3px]"
      onMouseDown={event => { if (event.target === event.currentTarget && !busy) onCancel() }}>
      <section ref={panelRef} role="alertdialog" aria-modal="true" aria-labelledby="confirm-title" aria-describedby="confirm-desc"
        className="modal-panel w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl sm:p-7">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className={'mb-2 text-[11px] font-semibold uppercase tracking-widest '+(details.danger?'text-rose-700':'text-slate-400')}>{details.danger?'Confirmar cambio':'Revisar operación'}</p>
            <h2 id="confirm-title" className="text-xl font-semibold tracking-tight text-slate-900">{details.title}</h2>
          </div>
          <CloseButton onClick={onCancel} disabled={busy} label="Cerrar confirmación"/>
        </div>
        {details.summary&&<dl className="mb-4 overflow-hidden rounded-xl border border-slate-200 bg-slate-50/60">
          {details.summary.map((row,i)=><div key={i} className={'flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 px-4 py-3 '+(row.emphasis?'border-t border-slate-200 bg-white':'')}>
            <dt className={'text-sm '+(row.emphasis?'font-semibold text-slate-800':'text-slate-500')}>{row.label}</dt>
            <dd className={'m-0 max-w-full text-right '+(row.emphasis?'text-xl font-semibold tabular-nums text-slate-900':'text-sm font-medium text-slate-800')}>{row.value}</dd>
          </div>)}
        </dl>}
        <p id="confirm-desc" className="whitespace-pre-line text-sm leading-6 text-slate-500">{details.description}</p>
        <div className="mt-6 flex flex-col-reverse gap-2 border-t border-slate-100 pt-5 sm:flex-row sm:justify-end">
          <button type="button" ref={cancelRef} disabled={busy} onClick={onCancel}
            className="rounded-xl border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60">
            Volver sin cambios
          </button>
          <button type="button" disabled={busy} onClick={onConfirm}
            className={`rounded-xl px-5 py-3 text-sm font-semibold text-white disabled:opacity-60 ${details.danger ? 'bg-rose-700 hover:bg-rose-800' : 'bg-emerald-800 hover:bg-emerald-900'}`}>
            {busy ? 'Procesando…' : details.confirmLabel}
          </button>
        </div>
      </section>
    </div>
  )
}
