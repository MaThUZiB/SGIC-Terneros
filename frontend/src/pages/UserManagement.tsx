import { useEffect, useState } from 'react'
import { supabase } from '../api/supabase'
type Row = { id: string; email: string; nombre: string; rol: 'ADMIN' | 'OPERADOR'; activo: boolean }
export function UserManagement() {
  const [rows,setRows]=useState<Row[]>([])
  const [error,setError]=useState('')
  const [ok,setOk]=useState('')
  const [working,setWorking]=useState('')
  const [loading,setLoading]=useState(true)
  async function reload(){
    if(!supabase){setError('Supabase no disponible');setLoading(false);return}
    setLoading(true)
    const result=await supabase.rpc('sgic_listar_usuarios')
    if(result.error)setError('No fue posible consultar los usuarios autorizados')
    else {setRows((result.data||[]) as Row[]);setError('')}
    setLoading(false)
  }
  useEffect(()=>{void reload()},[])
  async function change(u:Row,rol:'ADMIN'|'OPERADOR',activo:boolean){
    if(!supabase)return
    if(!window.confirm('¿Confirmas el cambio administrativo de permisos de '+u.email+'?'))return
    setWorking(u.id);setError('');setOk('')
    const result=await supabase.rpc('sgic_autorizar_usuario',{p_usuario_id:u.id,p_rol:rol,p_activo:activo})
    if(result.error)setError(result.error.message)
    else{setOk('Permisos modificados y registrados en auditoría.');await reload()}
    setWorking('')
  }
  return <div className="space-y-5">
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold">Usuarios y permisos</h2>
      <p className="mt-2 text-sm leading-6 text-slate-600">
        Las cuentas se crean o invitan desde Supabase Authentication. Aquí puedes activar,
        suspender o cambiar su rol. Los cambios se validan en PostgreSQL y quedan auditados.
      </p>
      {error&&<p role="alert" className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {ok&&<p role="status" className="mt-4 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">{ok}</p>}
      {loading&&<p className="mt-4 text-sm text-slate-500">Cargando usuarios…</p>}
      <div className="mt-5 space-y-3">
        {rows.map(u=><div key={u.id} className="grid gap-4 rounded-xl border border-slate-200 p-4 sm:grid-cols-[minmax(0,1fr)_150px_110px] sm:items-center">
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-slate-900">{u.nombre||u.email}</div>
            <div className="truncate text-xs text-slate-500">{u.email}</div>
          </div>
          <label className="text-xs font-medium text-slate-500">Rol
            <select value={u.rol} disabled={working===u.id} onChange={e=>void change(u,e.target.value as 'ADMIN'|'OPERADOR',u.activo)}
              className="mt-1 block w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800">
              <option value="ADMIN">Administrador</option><option value="OPERADOR">Operador</option>
            </select>
          </label>
          <label className="flex items-center gap-3 text-sm font-medium">
            <input type="checkbox" checked={u.activo} disabled={working===u.id}
              onChange={e=>void change(u,u.rol,e.target.checked)}
              className="h-4 w-4 accent-emerald-800"/> Activo
          </label>
        </div>)}
      </div>
      {!loading&&rows.length===0&&!error&&<p className="text-sm text-slate-500">No hay perfiles registrados.</p>}
      <button onClick={()=>void reload()} className="mt-5 rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50">Actualizar usuarios</button>
    </div>
  </div>
}
