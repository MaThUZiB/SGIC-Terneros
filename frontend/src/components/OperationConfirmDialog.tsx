import { useEffect, useRef } from 'react'

export interface ConfirmDetails {
  title: string
  description: string
  confirmLabel: string
  danger?: boolean
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

  useEffect(() => {
    if (!details) return
    cancelRef.current?.focus()
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !busy) onCancel()
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
    <div className="modal-viewport fixed inset-0 z-50 flex items-center justify-center bg-slate-950/65 p-4 backdrop-blur-[3px]"
      onMouseDown={event => { if (event.target === event.currentTarget && !busy) onCancel() }}>
      <section role="alertdialog" aria-modal="true" aria-labelledby="confirm-title" aria-describedby="confirm-desc"
        className="modal-panel w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-4 shadow-2xl sm:p-8">
        <div className={`mb-4 flex h-12 w-12 items-center justify-center rounded-2xl ${details.danger ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-800'}`}>
          <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" className="h-6 w-6">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 3 2.5 20h19L12 3Zm0 6v4m0 4h.01"/>
          </svg>
        </div>
        <h2 id="confirm-title" className="text-xl font-semibold tracking-tight text-slate-900">{details.title}</h2>
        <p id="confirm-desc" className="mt-3 whitespace-pre-line text-sm leading-7 text-slate-600">{details.description}</p>
        <div className="mt-7 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
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
