import { useId, useMemo, useState, type ChangeEvent } from 'react'
import { supabase } from '../api/supabase'
import { SipecIntakeForm } from './SipecIntakeForm'
import { parseSipecSpreadsheetXml, type SipecAnimal, type SipecReport } from '../utils/sipecSpreadsheet'

type Existing = { diio: string; estado: string }
type Filter = 'nuevos' | 'existentes' | 'ausentes' | 'todos'
const MAX_BYTES = 8 * 1024 * 1024
const PAGE_SIZE = 700
const MAX_EXISTING = 25000

async function readSipecExport(file: File): Promise<SipecReport> {
  if (file.size > MAX_BYTES) throw new Error('El archivo supera 8 MB. Exporta un listado más pequeño desde SIPECweb.')
  const bytes = await file.arrayBuffer()
  let xml: string
  try {
    xml = new TextDecoder('utf-8', {fatal:true}).decode(bytes)
  } catch {
    xml = new TextDecoder('windows-1252').decode(bytes)
  }
  return parseSipecSpreadsheetXml(xml)
}

async function readRegisteredAnimals(): Promise<Existing[]> {
  if (!supabase) throw new Error('La conexión a Supabase no está configurada.')
  const records: Existing[] = []
  for (let offset = 0; offset < MAX_EXISTING; offset += PAGE_SIZE) {
    const {data, error} = await supabase.from('animal')
      .select('diio,estado').order('id').range(offset, offset + PAGE_SIZE - 1)
    if (error) throw new Error('No fue posible consultar los DIIO de SGIC: ' + error.message)
    const current = (data ?? []) as Existing[]
    records.push(...current)
    if (current.length < PAGE_SIZE) return records
  }
  throw new Error('El inventario supera el límite de comparación de ' + MAX_EXISTING + ' animales. No se generó un resultado parcial.')
}

function SummaryCard({title,value,tone,onClick,selected}:{
  title:string;value:number;tone:'green'|'slate'|'amber'|'blue';onClick:()=>void;selected:boolean
}){
  const toneClass = {
    green:'border-emerald-200 bg-emerald-50 text-emerald-900',
    slate:'border-slate-200 bg-slate-50 text-slate-800',
    amber:'border-amber-200 bg-amber-50 text-amber-900',
    blue:'border-blue-200 bg-blue-50 text-blue-900',
  }[tone]
  return <button type="button" onClick={onClick} aria-pressed={selected}
    className={'rounded-xl border p-4 text-left transition hover:shadow-md focus-visible:outline-2 focus-visible:outline-emerald-600 ' +
      toneClass + (selected?' ring-2 ring-offset-2 ring-slate-700':'')}>
    <div className="text-xs font-semibold uppercase tracking-wide">{title}</div>
    <div className="mt-2 text-2xl font-bold tabular-nums">{value.toLocaleString('es-CL')}</div>
  </button>
}

export function SipecSyncPreview({onClose,onChanged}:{onClose:()=>void;onChanged:()=>void}) {
  const inputId = useId()
  const [report,setReport] = useState<SipecReport|null>(null)
  const [filename,setFilename] = useState('')
  const [existing,setExisting] = useState<Existing[]>([])
  const [busy,setBusy] = useState(false)
  const [error,setError] = useState('')
  const [filter,setFilter] = useState<Filter>('nuevos')
  const [incorporando,setIncorporando] = useState(false)
  const [success,setSuccess] = useState('')

  const comparison = useMemo(()=>{
    const byDiio = new Map(existing.map(item=>[item.diio,item]))
    const listed = new Set(report?.animales.map(item=>item.diio)??[])
    return {
      nuevos:report?.animales.filter(item=>!byDiio.has(item.diio))??[],
      existentes:report?.animales.filter(item=>byDiio.has(item.diio))??[],
      ausentes:existing.filter(item=>item.estado==='ACTIVO'&&!listed.has(item.diio)),
      byDiio,
    }
  },[report,existing])

  const shown = useMemo(()=>{
    if (!report) return []
    if (filter==='ausentes') return comparison.ausentes.map(x=>({diio:x.diio,raza:'—',categoria:'—',fechaNacimiento:null,establecimiento:'—',sexo:'—',glosaPabco:''}))
    if (filter==='existentes') return comparison.existentes
    if (filter==='nuevos') return comparison.nuevos
    return report.animales
  },[filter,report,comparison])

  async function selectFile(event:ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0]
    event.currentTarget.value=''
    if (!file || busy) return
    setReport(null);setExisting([]);setFilename('');setError('');setSuccess('');setIncorporando(false);setBusy(true)
    try {
      const parsed = await readSipecExport(file)
      const registered = await readRegisteredAnimals()
      setReport(parsed)
      setExisting(registered)
      setFilename(file.name)
      setFilter('nuevos')
    } catch (e) {
      setError(e instanceof Error?e.message:'No se pudo leer el archivo.')
    } finally {
      setBusy(false)
    }
  }

  function reset(){
    setReport(null);setExisting([]);setFilename('');setError('');setFilter('nuevos');setSuccess('');setIncorporando(false)
  }

  async function afterIncorporate(id:number){
    setIncorporando(false)
    setSuccess('Ingreso SIPECweb #'+id+' confirmado. La operación ya está registrada en Supabase.')
    onChanged()
    try {setExisting(await readRegisteredAnimals())} catch (e) {setError(e instanceof Error?e.message:'No fue posible actualizar el inventario.')}
    setFilter('existentes')
  }

  return <section aria-label="Sincronizar con SIPECweb" className="space-y-5 rounded-2xl border border-emerald-200 bg-white p-5 shadow-sm sm:p-7">
    <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-5">
      <div>
        <p className="text-xs font-bold uppercase tracking-widest text-emerald-700">Animales · Conciliación con SAG</p>
        <h2 className="mt-2 text-xl font-semibold">Sincronizar con SIPECweb</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
          Carga el archivo Excel XML (.xls) generado por «Consulta de animales» de SIPECweb.
          Compara sus DIIO con el registro de SGIC y revisa las diferencias.
        </p>
      </div>
      <button type="button" onClick={onClose} disabled={busy||incorporando} aria-label="Cerrar sincronización" title="Cerrar"
        className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 text-slate-500 hover:bg-rose-50 hover:text-rose-700 disabled:opacity-50">
        <svg aria-hidden="true" width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
      </button>
    </div>

    <div role="status" className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm leading-6 text-blue-950">
      <strong>Conciliación y registro supervisado.</strong> La carga del XLS solo lee y compara los DIIO; no modifica animales.
      Si decides incorporar nuevos DIIO, deberás completar y revisar sus valores económicos y confirmar expresamente la operación.
      El archivo se procesa en el navegador y no se almacena en Supabase.
    </div>

    <div className="rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 p-5">
      <label htmlFor={inputId} className="mb-3 block text-sm font-semibold text-slate-800">Exportación de SIPECweb</label>
      <input id={inputId} type="file" accept=".xls,.xml,application/vnd.ms-excel,application/xml,text/xml"
        onChange={event=>{void selectFile(event)}} disabled={busy||incorporando}
        className="block w-full max-w-lg text-sm text-slate-600 file:mr-4 file:rounded-lg file:border-0 file:bg-emerald-800 file:px-4 file:py-2.5 file:font-semibold file:text-white hover:file:bg-emerald-900 disabled:opacity-50"/>
      <p className="mt-3 text-xs leading-5 text-slate-500">
        Acepta el .xls de SIPECweb (Excel XML 2003); no el PDF de «Imprimir animales presentes».
        Conserva los ceros iniciales de cada DIIO. Límite: 8 MB.
      </p>
    </div>

    {busy&&<p role="status" className="rounded-xl bg-emerald-50 p-4 text-sm text-emerald-900">Leyendo exportación y comparando DIIO registrados…</p>}
    {error&&<p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-800">{error}</p>}
    {success&&<p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-900">{success}</p>}

    {report&&<div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="break-all text-sm text-slate-600"><strong>Archivo revisado:</strong> {filename} · {report.filasLeidas} filas examinadas</p>
        <button type="button" onClick={reset} disabled={incorporando} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50">Elegir otro archivo</button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard title="DIIO nuevos" value={comparison.nuevos.length} tone="green"
          onClick={()=>setFilter('nuevos')} selected={filter==='nuevos'}/>
        <SummaryCard title="Ya registrados" value={comparison.existentes.length} tone="slate"
          onClick={()=>setFilter('existentes')} selected={filter==='existentes'}/>
        <SummaryCard title="No aparecen en archivo" value={comparison.ausentes.length} tone="amber"
          onClick={()=>setFilter('ausentes')} selected={filter==='ausentes'}/>
        <SummaryCard title="Total DIIO válidos" value={report.animales.length} tone="blue"
          onClick={()=>setFilter('todos')} selected={filter==='todos'}/>
      </div>

      {comparison.nuevos.length>0&&!incorporando&&<button type="button" onClick={()=>setIncorporando(true)}
        className="rounded-xl bg-emerald-800 px-5 py-3 text-sm font-semibold text-white hover:bg-emerald-900">
        Incorporar DIIO nuevos con valorización ({comparison.nuevos.length})
      </button>}
      {incorporando&&<SipecIntakeForm animales={comparison.nuevos} onCancel={()=>setIncorporando(false)}
        onSuccess={id=>{void afterIncorporate(id)}}/>}

      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-950">
        <strong>Importante:</strong> este listado es una fotografía, no una constancia de traspaso.
        La columna ESTABLECIMIENTO no identifica necesariamente el RUP de destino.
        Los DIIO que no aparecen en el archivo pueden corresponder a filtros, ventas, traslados u otros cambios:
        no se marcan automáticamente como bajas. La exportación no contiene precio ni folio FMA.
      </div>

      {report.problemas.length>0&&<div className="rounded-xl border border-orange-200 bg-orange-50 p-4">
        <p className="font-semibold text-orange-900">{report.problemas.length} observaciones de validación</p>
        <ul className="mt-2 space-y-1 text-sm text-orange-900">
          {report.problemas.slice(0,10).map((issue,i)=><li key={i}>Fila {issue.fila}: {issue.mensaje}</li>)}
        </ul>
        {report.problemas.length>10&&<p className="mt-2 text-xs text-orange-800">Se muestran las primeras diez observaciones.</p>}
      </div>}

      <div className="overflow-hidden rounded-xl border border-slate-200">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 bg-slate-50 p-4">
          <h3 className="font-semibold text-slate-900">
            {filter==='nuevos'?'DIIO no registrados':filter==='existentes'?'Coinciden con SGIC':filter==='ausentes'?'Activos en SGIC no presentes en archivo':'Todos los animales exportados'}
          </h3>
          <span className="text-xs text-slate-500">{shown.length} coincidencias · máximo 100 filas en pantalla</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[830px] text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-600">
              <tr><th className="px-4 py-3">DIIO</th><th className="px-4 py-3">Raza</th><th className="px-4 py-3">Sexo</th>
                <th className="px-4 py-3">Categoría SAG</th><th className="px-4 py-3">Nacimiento</th>
                <th className="px-4 py-3">Establecimiento</th><th className="px-4 py-3">Estado SGIC</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {shown.slice(0,100).map((item:SipecAnimal)=><tr key={item.diio} className="hover:bg-slate-50">
                <td className="px-4 py-3 font-mono font-semibold">{item.diio}</td>
                <td className="px-4 py-3">{item.raza||'—'}</td>
                <td className="px-4 py-3">{item.sexo||'—'}</td>
                <td className="px-4 py-3">{item.categoria||'—'}</td>
                <td className="px-4 py-3 whitespace-nowrap">{item.fechaNacimiento||'—'}</td>
                <td className="px-4 py-3">{item.establecimiento||'—'}</td>
                <td className="px-4 py-3">
                  {comparison.byDiio.get(item.diio)?.estado||'No registrado'}
                </td>
              </tr>)}
              {!shown.length&&<tr><td colSpan={7} className="p-7 text-center text-slate-500">No hay animales en este grupo.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
      <p className="text-xs leading-5 text-slate-500">
        La vista de comparación no escribe datos. Solo el formulario de incorporación, tras la confirmación explícita,
        registra animales con tipo de ingreso, lote, fecha y valorización. Una compra solo se genera cuando el tipo es Compra.
      </p>
    </div>}
  </section>
}
