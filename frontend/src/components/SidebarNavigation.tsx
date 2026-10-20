import { useEffect } from 'react'

export type ModuleId =
  | 'resumen' | 'animales' | 'lotes' | 'inventario' | 'compras' | 'planes'
  | 'sanidad' | 'ventas' | 'gastos' | 'pendientes'
  | 'historial' | 'usuarios' | 'rentabilidad' | 'catalogos'

export type NavigationGroup = { label: string; entries: { id: ModuleId; title: string; icon: string; adminOnly?: boolean }[] }

export const navigationGroups: NavigationGroup[] = [
  { label:'General',entries:[{id:'resumen',title:'Resumen',icon:'home'}]},
  { label:'Ganadería',entries:[
    {id:'animales',title:'Animales',icon:'animals'},
    {id:'lotes',title:'Lotes',icon:'layers'},
  ]},
  { label:'Abastecimiento',entries:[
    {id:'inventario',title:'Inventario',icon:'box'},
    {id:'compras',title:'Compras',icon:'cart'},
    {id:'pendientes',title:'Solicitudes pendientes',icon:'inbox'},
  ]},
  { label:'Producción',entries:[
    {id:'planes',title:'Alimentación',icon:'sprout'},
    {id:'sanidad',title:'Sanidad',icon:'heart'},
  ]},
  { label:'Finanzas',entries:[
    {id:'ventas',title:'Ventas',icon:'receipt'},
    {id:'gastos',title:'Gastos',icon:'wallet'},
    {id:'rentabilidad',title:'Rentabilidad',icon:'chart'},
  ]},
  { label:'Administración',entries:[
    {id:'catalogos',title:'Configuración',icon:'settings',adminOnly:true},
    {id:'historial',title:'Historial y auditoría',icon:'history'},
    {id:'usuarios',title:'Usuarios',icon:'users',adminOnly:true},
  ]},
]

export const moduleTitles = Object.fromEntries(
  navigationGroups.flatMap(group=>group.entries.map(item=>[item.id,item.title]))
) as Record<ModuleId,string>

const paths: Record<string,string> = {
  home:'M3 10.5 12 3l9 7.5V21h-6V10.5m4 10.5v-6h4v6',
  animals:'M4 16V8l4-3 3 2 3-2 6 3v8l-3 3H7l-3-3Zm4-11v4m9-4v4M8 13h.01M16 13h.01M10 16h4',
  layers:'m3 7 9-4 9 4-9 4-9-4Zm0 5 9 4 9-4M3 17l9 4 9-4',
  box:'m12 3 9 5v9l-9 5-9-5V8l9-5Zm-9 5 9 5 9-5m-9 5v9',
  cart:'M3 4h2l2 12h12l2-9H6m3 14h.01M18 21h.01',
  inbox:'M4 4h16l2 13v4H2v-4L4 4Zm-2 13h7l2 3h2l2-3h7',
  sprout:'M12 21V9m0 5C5 14 4 10 4 5c6 0 8 3 8 9Zm0-3c0-5 3-7 8-7 0 5-3 7-8 7Z',
  heart:'M20.5 8.5c0 5-8.5 11-8.5 11S3.5 13.5 3.5 8.5a4.5 4.5 0 0 1 8.5-2 4.5 4.5 0 0 1 8.5 2ZM9 12h6m-3-3v6',
  receipt:'M5 3h14v18l-3-2-4 2-4-2-3 2V3Zm4 5h6m-6 4h6m-6 4h4',
  wallet:'M3 6h17v15H3V6Zm0 4h17m-4 4h4m-16-9h13',
  chart:'M4 20V5m0 15h17M8 16l4-5 3 2 5-7',
  settings:'M4 5h16M4 12h16M4 19h16M8 3v4m8 3v4m-5 3v4',
  history:'M4 12a8 8 0 1 0 2-5M4 4v5h5m3-2v5l4 2',
  users:'M16 19h6v-2a4 4 0 0 0-4-4h-2M8 19H2v-2a4 4 0 0 1 4-4h2m4-1a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm5-7a3 3 0 0 1 0 6',
}

function SidebarIcon({name}:{name:string}){
  return <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d={paths[name]??paths.box}/>
  </svg>
}

export function SidebarNavigation({
  current, esAdmin, open, onClose, onNavigate,
}:{
  current:ModuleId; esAdmin:boolean; open:boolean; onClose:()=>void; onNavigate:(id:ModuleId)=>void
}){
  useEffect(()=>{
    if(!open)return
    const closeOnEscape=(event:KeyboardEvent)=>{if(event.key==='Escape')onClose()}
    document.addEventListener('keydown',closeOnEscape)
    return()=>document.removeEventListener('keydown',closeOnEscape)
  },[open,onClose])

  useEffect(()=>{
    if(!open)return
    const previous=document.body.style.overflow
    document.body.style.overflow='hidden'
    return()=>{document.body.style.overflow=previous}
  },[open])

  function body(){
    return <>
      <div className="flex items-center gap-3 border-b border-slate-800 px-5 py-6">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-emerald-500 font-bold text-slate-950">SG</span>
        <div><div className="text-base font-bold tracking-tight text-white">SGIC-Terneros</div>
          <div className="mt-0.5 text-xs text-slate-400">Gestión ganadera</div></div>
        <button type="button" onClick={onClose} aria-label="Cerrar menú" className="ml-auto rounded-lg p-2 text-slate-300 hover:bg-slate-800 lg:hidden">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 5l14 14M19 5 5 19"/></svg>
        </button>
      </div>
      <nav aria-label="Módulos del sistema" className="min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain px-3 py-5">
        {navigationGroups.map(group=>{
          const visible=group.entries.filter(entry=>esAdmin||!entry.adminOnly)
          if(!visible.length)return null
          return <div key={group.label}>
            <p className="mb-2 px-3 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">{group.label}</p>
            <div className="space-y-0.5">{visible.map(entry=><button type="button" key={entry.id}
              onClick={()=>{onNavigate(entry.id);onClose()}} aria-current={current===entry.id?'page':undefined}
              className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition-colors ${current===entry.id
                ?'bg-emerald-500/20 text-emerald-200 ring-1 ring-emerald-500/40'
                :'text-slate-300 hover:bg-slate-800 hover:text-white'}`}>
              <SidebarIcon name={entry.icon}/><span>{entry.title}</span>
              {current===entry.id&&<span className="ml-auto h-2 w-2 rounded-full bg-emerald-400" aria-hidden="true"/>}
            </button>)}</div>
          </div>
        })}
      </nav>
      <div className="border-t border-slate-800 px-5 py-4 text-xs text-slate-400">Panel de administración · Supabase</div>
    </>
  }

  return <>
    <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col bg-slate-950 shadow-xl lg:flex">
      {body()}
    </aside>
    {open&&<div className="fixed inset-0 z-50 lg:hidden">
      <button type="button" className="absolute inset-0 h-full w-full bg-slate-950/70" aria-label="Cerrar navegación" onClick={onClose}/>
      <aside className="mobile-navigation relative flex h-full w-[min(92vw,320px)] flex-col bg-slate-950 shadow-2xl" aria-label="Menú principal">
        {body()}
      </aside>
    </div>}
  </>
}
