import type { ModuleId } from '../components/SidebarNavigation'

/** Accesos de configuración sin textos introductorios redundantes. */
export function CatalogOverview({onCreate,onNavigate}:{onCreate:(type:string)=>void;onNavigate:(module:ModuleId)=>void}){
 const catalogs=[
  {id:'raza',title:'Razas'},
  {id:'proveedor',title:'Proveedores'},
  {id:'categoria_gasto',title:'Categorías de gastos'},
 ]
 return <section className="mx-auto w-full max-w-4xl space-y-4">
  <header><h2 className="text-lg font-semibold">Configuración</h2></header>
  <div className="grid gap-3 sm:grid-cols-3">{catalogs.map(c=>
   <button type="button" key={c.id} onClick={()=>onCreate(c.id)}
    className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-4 text-left text-sm font-semibold hover:border-emerald-400 hover:bg-emerald-50/30">
    {c.title}<span aria-hidden="true" className="text-lg font-normal text-emerald-700">+</span>
   </button>
  )}</div>
  <div className="rounded-xl border border-slate-200 bg-white p-4">
   <h3 className="text-sm font-semibold">Configuración por módulo</h3>
   <div className="mt-3 flex flex-wrap gap-2">
    <button type="button" onClick={()=>onNavigate('inventario')} className="rounded-lg border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50">Inventario</button>
    <button type="button" onClick={()=>onNavigate('planes')} className="rounded-lg border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50">Alimentación</button>
   </div>
  </div>
  <details className="rounded-xl border border-slate-200 bg-white px-4 py-3">
   <summary className="cursor-pointer text-sm font-medium text-slate-700">Opciones avanzadas</summary>
   <div className="mt-3 flex flex-wrap gap-2">
    {[{id:'unidad_medida',label:'Unidades de medida'},{id:'categoria_producto',label:'Categorías de producto'},{id:'producto',label:'Producto sin existencias'}].map(c=>
     <button type="button" key={c.id} onClick={()=>onCreate(c.id)} className="rounded-lg border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50">{c.label}</button>
    )}
   </div>
  </details>
 </section>
}
