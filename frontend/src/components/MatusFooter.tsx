type MatusFooterProps = {
  dark?: boolean
}

/** Marca discreta y consistente en las vistas pública y autenticada. */
export function MatusFooter({ dark = false }: MatusFooterProps) {
  const year = new Date().getFullYear()

  return (
    <footer
      aria-label="Pie de página de Matus Company"
      className={`relative w-full shrink-0 border-t ${dark
        ? 'border-white/10 text-emerald-50/70'
        : 'border-slate-200/80 bg-white/40 text-slate-500'}`}
    >
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-emerald-500/35 to-transparent"
      />
      <div className="mx-auto flex w-full max-w-[1440px] flex-col items-center justify-between gap-4 px-4 py-5 sm:flex-row sm:px-7 lg:px-9">
        <div className="flex items-center gap-3">
          <span
            aria-hidden="true"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-600 via-emerald-700 to-teal-900 text-white shadow-sm shadow-emerald-950/20"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"
              strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6">
              <path d="M4.5 18V6l7.5 8 7.5-8v12" />
            </svg>
          </span>
          <div className="leading-tight">
            <div className={`text-sm font-semibold tracking-tight ${dark ? 'text-white' : 'text-slate-900'}`}>
              Matus <span className={dark ? 'text-emerald-300' : 'text-emerald-700'}>Company</span>
            </div>
            <p className={`mt-0.5 text-[11px] tracking-wide ${dark ? 'text-emerald-100/55' : 'text-slate-500'}`}>
              Tecnología para la gestión ganadera
            </p>
          </div>
        </div>
        <p className="text-center text-xs leading-5 sm:text-right">
          © {year} Matus Company <span aria-hidden="true" className="px-1 opacity-50">·</span> SGIC-Terneros
        </p>
      </div>
    </footer>
  )
}
