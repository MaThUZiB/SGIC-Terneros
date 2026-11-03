import { pageCount, pageLabel, PAGE_SIZE } from '../utils/pagination'

type Props={
  page:number;total:number;onChange:(page:number)=>void;
  size?:number;label?:string;disabled?:boolean
}
export function Pagination({page,total,onChange,size=PAGE_SIZE,label='registros',disabled=false}:Props){
  const pages=pageCount(total,size)
  if(pages<=1)return <p className="px-4 py-3 text-xs text-slate-500" role="status" aria-live="polite">{pageLabel(0,total,size)}</p>
  return <nav aria-label={'Paginación de '+label} className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-4 py-3">
    <span className="text-xs text-slate-600" role="status" aria-live="polite">{pageLabel(page,total,size)} · Página {page+1} de {pages}</span>
    <div className="flex gap-2">
      <button type="button" disabled={disabled||page<=0} onClick={()=>onChange(page-1)}
        className="min-h-11 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-800 disabled:opacity-40">Anterior</button>
      <button type="button" disabled={disabled||page>=pages-1} onClick={()=>onChange(page+1)}
        className="min-h-11 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-800 disabled:opacity-40">Siguiente</button>
    </div>
  </nav>
}
