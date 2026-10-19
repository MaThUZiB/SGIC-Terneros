import { useId, useState } from 'react'

export type AnimalChoice = { id: number | string; diio: string; detail: string }

/** Only a chosen result supplies an ID; typing never silently selects an animal. */
export function AnimalSearch({ options, value, onChange, disabled = false, inputId, entity = 'animal' }: {
  options: AnimalChoice[]; value: string; onChange: (id: string) => void; disabled?: boolean; inputId?:string; entity?:'animal'|'insumo'
}) {
  const id = useId()
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const chosen = options.find(o => String(o.id) === value)
  const matches = query.trim() ? options.filter(o => o.diio.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())) : []
  const shown = matches.slice(0, 20)
  function select(option: AnimalChoice) {
    onChange(String(option.id)); setQuery(''); setOpen(false)
  }
  return <div className="relative" onBlur={e => { if (!e.currentTarget.contains(e.relatedTarget)) setOpen(false) }}>
    <input id={inputId} role="combobox" aria-label={entity==='animal'?'Buscar animal por DIIO':'Buscar insumo por nombre'} aria-autocomplete="list"
      aria-expanded={open && !chosen} aria-controls={id}
      aria-activedescendant={open && shown[active] ? `${id}-${active}` : undefined}
      autoComplete="off" disabled={disabled} required value={chosen ? chosen.diio : query}
      placeholder={entity==='animal'?'Escribe parte del DIIO para buscar':'Escribe parte del nombre'}
      className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5"
      ref={input => { input?.setCustomValidity(chosen ? '' : 'Escribe y selecciona una coincidencia.'); }}
      onFocus={() => setOpen(true)}
      onChange={e => { setQuery(e.target.value); onChange(''); setOpen(true); setActive(0) }}
      onKeyDown={e => {
        if (e.key === 'Escape') { setOpen(false); return }
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
          e.preventDefault(); setOpen(true)
          setActive(i => Math.max(0, Math.min(shown.length - 1, i + (e.key === 'ArrowDown' ? 1 : -1))))
        }
        if (e.key === 'Enter' && !chosen) { e.preventDefault(); if (open && shown[active]) select(shown[active]) }
      }}/>
    {chosen && <div className="mt-2 flex items-center justify-between gap-3 rounded-lg bg-emerald-50 p-3 text-xs text-emerald-900">
      <span>{chosen.detail}</span>
      <button type="button" disabled={disabled} onClick={() => { onChange(''); setQuery(''); setOpen(true) }}>Cambiar {entity}</button>
    </div>}
    {open && !chosen && <div className="mt-2 rounded-xl border border-slate-200 bg-white p-2 shadow-sm">
      <div id={id} role="listbox" aria-label={entity==='animal'?'Coincidencias de DIIO':'Coincidencias de insumos'} className="max-h-60 overflow-auto">
        {shown.map((o, i) => <button type="button" role="option" aria-selected={i === active} id={`${id}-${i}`} key={o.id}
          onMouseDown={e => e.preventDefault()} onClick={() => select(o)}
          className={'block w-full rounded-lg p-3 text-left text-sm hover:bg-emerald-50 ' + (i === active ? 'bg-emerald-50' : '')}>
          <span className="block font-mono font-semibold">{o.diio}</span><span className="text-xs text-slate-600">{o.detail}</span>
        </button>)}
      </div>
      <p role="status" className="p-2 text-xs text-slate-500">{!query.trim() ? 'Escribe para buscar coincidencias.' : !matches.length ? 'No hay coincidencias disponibles.' : `${matches.length} coincidencias${matches.length > 20 ? ' · se muestran 20; escribe más para precisar' : ''}.`}</p>
    </div>}
  </div>
}
