/** Compact visual control with a larger touch target. */
export function CloseButton({onClick,disabled=false,label='Cerrar formulario'}:{onClick:()=>void;disabled?:boolean;label?:string}){
 return <button type="button" onClick={onClick} disabled={disabled} aria-label={label} title={label} className="close-control group inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 disabled:opacity-40"><svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="m6 6 12 12M18 6 6 18"/></svg></button>
}
