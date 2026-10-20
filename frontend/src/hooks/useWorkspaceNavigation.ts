import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { moduleTitles, type ModuleId } from '../components/SidebarNavigation'

type Patch=Record<string,string|null>
export type AnimalFilter='TODOS'|'ACTIVO'|'FALLECIDO'|'VENDIDO'
const canonical=(search:string)=>{const p=new URLSearchParams(search);p.sort();return p.toString()}

/** The URL is the source of truth for Back, Forward, reload and shared links. */
export function useWorkspaceNavigation(){
  const [params]=useSearchParams()
  const location=useLocation()
  const navigate=useNavigate()
  const requested=params.get('modulo')??'resumen'
  const tab:ModuleId=Object.hasOwn(moduleTitles,requested)?requested as ModuleId:'resumen'
  const rawFilter=params.get('estado')??'TODOS'
  const filtroAnimal:AnimalFilter=['TODOS','ACTIVO','FALLECIDO','VENDIDO'].includes(rawFilter)?rawFilter as AnimalFilter:'TODOS'
  const id=Number(params.get('animal'))
  const rawAction=params.get('accion')??''
  const cardAction=['peso','animalRectificar','fallecimiento'].includes(rawAction)?rawAction:undefined
  const animalCard=tab==='animales'&&Number.isSafeInteger(id)&&id>0?{id,action:cardAction}:null
  const operation=animalCard?null:params.get('operacion')
  const buscar=params.get('buscar')??''
  function target(patch:Patch){
    const next=new URLSearchParams(params)
    for(const [key,value] of Object.entries(patch)){if(value)next.set(key,value);else next.delete(key)}
    next.sort()
    const query=next.toString()
    return query?'?'+query:''
  }
  function change(patch:Patch,replace=false){
    const search=target(patch)
    if(canonical(search)===canonical(location.search))return
    navigate({pathname:location.pathname,search},{replace,state:replace?location.state:{sgicPreviousSearch:location.search}})
  }
  function close(patch:Patch){
    const search=target(patch)
    const previous=location.state?.sgicPreviousSearch
    // Only go back when the previous entry is the matching internal parent.
    if(typeof previous==='string'&&canonical(previous)===canonical(search))navigate(-1)
    else change(patch,true)
  }
  function abrirModulo(modulo:ModuleId,estado?:AnimalFilter,busqueda=''){
    change({modulo:modulo==='resumen'?null:modulo,estado:estado&&estado!=='TODOS'?estado:null,
      buscar:busqueda||null,animal:null,accion:null,operacion:null,catalogo:null})
  }
  return {tab,operation,catalogType:params.get('catalogo'),animalCard,buscar,filtroAnimal,abrirModulo,
    setBuscar:(value:string)=>change({buscar:value||null},true),
    setFiltroAnimal:(value:AnimalFilter)=>change({estado:value==='TODOS'?null:value}),
    openOperation:(value:string,catalogType?:string)=>change({operacion:value,catalogo:catalogType??null,animal:null,accion:null}),
    closeOperation:()=>close({operacion:null,catalogo:null}),
    openAnimal:(value:number)=>change({animal:String(value),accion:null,operacion:null,catalogo:null}),
    closeAnimal:()=>close({animal:null,accion:null}),
    setAnimalAction:(value:string|null,replace=false)=>value||replace?change({accion:value},replace):close({accion:null}),
  }
}
