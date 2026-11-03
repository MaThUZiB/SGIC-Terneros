import { useEffect, useRef } from 'react'

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
  plus:'M12 5v14M5 12h14',
}

function SidebarIcon({name}:{name:string}){
  return <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d={paths[name]??paths.box}/>
  </svg>
}

export function SidebarNavigation({
  current, esAdmin, open, onClose, onOpen, onNavigate,
}:{
  current:ModuleId; esAdmin:boolean; open:boolean; onClose:()=>void; onOpen:()=>void; onNavigate:(id:ModuleId)=>void
}){
  const sheetRef=useRef<HTMLElement>(null)
  const moreRef=useRef<HTMLButtonElement>(null)
  const directos:ModuleId[]=['resumen','animales','inventario']
  const currentIsMore=!directos.includes(current)
  useEffect(()=>{
    if(!open)return
    sheetRef.current?.querySelector<HTMLButtonElement>('[data-menu-close]')?.focus()
    const onKeyDown=(event:KeyboardEvent)=>{
      if(event.key==='Escape'){
        event.preventDefault();onClose();moreRef.current?.focus()
      }
      if(event.key!=='Tab'||!sheetRef.current)return
      const elements=Array.from(sheetRef.current.querySelectorAll<HTMLElement>('button:not([disabled])'))
      if(!elements.length)return
      const first=elements[0],last=elements[elements.length-1]
      if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus()}
      else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus()}
    }
    document.addEventListener('keydown',onKeyDown)
    return()=>document.removeEventListener('keydown',onKeyDown)
  },[open,onClose])

  useEffect(()=>{
    if(!open)return
    const previous=document.body.style.overflow
    document.body.style.overflow='hidden'
    return()=>{document.body.style.overflow=previous}
  },[open])

  function body(){
    return <>
      <div className="flex items-center gap-3 border-b border-slate-800 px-4 py-4">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-emerald-500 text-sm font-bold text-slate-950">SG</span>
        <div className="text-sm font-bold tracking-tight text-white">SGIC Terneros</div>

      </div>
      <nav aria-label="Módulos del sistema" className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain px-3 py-4">
        {navigationGroups.map(group=>{
          const visible=group.entries.filter(entry=>esAdmin||!entry.adminOnly)
          if(!visible.length)return null
          return <div key={group.label}>
            <p className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-wider text-slate-400">{group.label}</p>
            <div className="space-y-0.5">{visible.map(entry=><button type="button" key={entry.id}
              onClick={()=>{onNavigate(entry.id);onClose()}} aria-current={current===entry.id?'page':undefined}
              className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors ${current===entry.id
                ?'bg-emerald-500/20 text-emerald-200 ring-1 ring-emerald-500/40'
                :'text-slate-300 hover:bg-slate-800 hover:text-white'}`}>
              <SidebarIcon name={entry.icon}/><span>{entry.title}</span>
              {current===entry.id&&<span className="ml-auto h-2 w-2 rounded-full bg-emerald-400" aria-hidden="true"/>}
            </button>)}</div>
          </div>
        })}
      </nav>
    </>
  }

  return <>
    {/* Escritorio: navegación lateral completa. */}
    <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col bg-slate-950 shadow-xl lg:flex">
      {body()}
    </aside>

    {/* Móvil: tres destinos habituales y un cuarto acceso a todos los módulos. */}
    {open&&<div className="fixed inset-0 z-40 lg:hidden">
      <button type="button" tabIndex={-1} aria-label="Cerrar más módulos"
        className="absolute inset-0 h-full w-full bg-slate-950/50" onClick={onClose}/>
      <section ref={sheetRef} role="dialog" aria-modal="true" aria-labelledby="mobile-more-title"
        className="sgic-more-panel absolute inset-x-2 max-h-[min(68dvh,600px)] overflow-y-auto overscroll-contain rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl sm:inset-x-6">
        <div className="mb-3 flex items-center justify-between border-b border-slate-100 pb-3">
          <h2 id="mobile-more-title" className="text-base font-semibold">Más módulos</h2>
          <button type="button" data-menu-close onClick={()=>{onClose();moreRef.current?.focus()}}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm" aria-label="Cerrar más módulos">Cerrar</button>
        </div>
        <nav aria-label="Otros módulos" className="space-y-4">
          {navigationGroups.map(group=>{
            const entries=group.entries.filter(entry=>!directos.includes(entry.id)&&(esAdmin||!entry.adminOnly))
            if(!entries.length)return null
            return <div key={group.label}>
              <h3 className="mb-2 text-xs font-semibold text-slate-500">{group.label}</h3>
              <div className="grid grid-cols-2 gap-2">
                {entries.map(entry=><button type="button" key={entry.id}
                  aria-current={current===entry.id?'page':undefined}
                  onClick={()=>{onNavigate(entry.id);onClose()}}
                  className={`flex min-h-12 items-center gap-2 rounded-xl border px-3 py-3 text-left text-sm font-medium ${current===entry.id?'border-emerald-800 bg-emerald-50 text-emerald-900':'border-slate-200 bg-white text-slate-700'}`}>
                  <span className="shrink-0"><SidebarIcon name={entry.icon}/></span><span className="min-w-0 break-words">{entry.title}</span>
                </button>)}
              </div>
            </div>
          })}
        </nav>
      </section>
    </div>}
    <nav aria-label="Navegación principal móvil" className="sgic-bottom-nav fixed inset-x-0 bottom-0 z-50 grid grid-cols-4 border-t border-slate-200 bg-white shadow-[0_-4px_24px_rgba(15,23,42,0.08)] lg:hidden">
      {directos.map(id=>{
        const entry=navigationGroups.flatMap(g=>g.entries).find(e=>e.id===id)!
        return <button type="button" key={id} onClick={()=>{onNavigate(id);if(open)onClose()}}
          aria-current={current===id?'page':undefined}
          className={`flex min-h-[60px] flex-col items-center justify-center gap-1 px-1 text-[11px] font-medium ${current===id?'text-emerald-800':'text-slate-600'}`}>
          <SidebarIcon name={entry.icon}/><span>{id==='resumen'?'Inicio':entry.title}</span>
        </button>
      })}
      <button type="button" ref={moreRef} aria-haspopup="dialog" aria-expanded={open}
        aria-label={currentIsMore?'Más módulos, sección actual: '+moduleTitles[current]:'Más módulos'}
        onClick={()=>open?onClose():onOpen()}
        className={`flex min-h-[60px] flex-col items-center justify-center gap-1 px-1 text-[11px] font-medium ${open||currentIsMore?'text-emerald-800':'text-slate-600'}`}>
        <SidebarIcon name="plus"/><span>Más</span>
      </button>
    </nav>
  </>
}
