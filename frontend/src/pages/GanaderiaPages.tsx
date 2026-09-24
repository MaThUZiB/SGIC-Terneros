import { useNavigate } from 'react-router-dom'
import { api, extraerError } from '../api/client'
import { CrudPage } from '../components/CrudPage'
import { Badge, MensajeError } from '../components/ui'
import { fecha, moneda, numero } from '../utils/format'

const SEXO_OPCIONES = [
  { value: 'M', label: 'Macho' },
  { value: 'H', label: 'Hembra' },
]

const ESTADO_ANIMAL = [
  { value: 'ACTIVO', label: 'Activo' },
  { value: 'VENDIDO', label: 'Vendido' },
  { value: 'FALLECIDO', label: 'Fallecido' },
]

export function RazasPage() {
  return (
    <CrudPage
      titulo="Razas"
      endpoint="/ganaderia/razas/"
      columnas={[{ key: 'nombre', label: 'Nombre' }]}
      campos={[{ name: 'nombre', label: 'Nombre', required: true }]}
    />
  )
}

export function AnimalesPage() {
  const navigate = useNavigate()

  async function marcarFallecido(animalId: number, diio: string) {
    if (!window.confirm(`¿Marcar como fallecido el animal ${diio}?`)) return
    try {
      await api.post(`/ganaderia/animales/${animalId}/marcar_fallecido/`, {})
      window.location.reload()
    } catch (e) {
      window.alert(extraerError(e))
    }
  }

  return (
    <CrudPage
      titulo="Animales"
      description="Registro y seguimiento del ganado"
      endpoint="/ganaderia/animales/"
      columnas={[
        { key: 'diio', label: 'DIIO' },
        { key: 'lote_codigo', label: 'Lote' },
        { key: 'raza_nombre', label: 'Raza', ocultaEnMovil: true },
        {
          key: 'sexo',
          label: 'Sexo',
          render: (a) => (a.sexo === 'M' ? 'Macho' : a.sexo === 'H' ? 'Hembra' : a.sexo),
          ocultaEnMovil: true,
        },
        {
          key: 'estado',
          label: 'Estado',
          render: (a) => (
            <Badge color={a.estado === 'ACTIVO' ? 'green' : a.estado === 'VENDIDO' ? 'blue' : 'red'}>
              {a.estado}
            </Badge>
          ),
        },
        { key: 'edad_aproximada_dias', label: 'Edad (días)', ocultaEnMovil: true },
        { key: 'precio_adquisicion', label: 'Precio', render: (a) => moneda(a.precio_adquisicion), ocultaEnMovil: true },
        { key: 'peso_ingreso_kg', label: 'Peso kg', render: (a) => (a.peso_ingreso_kg ? numero(a.peso_ingreso_kg) : '—'), ocultaEnMovil: true },
      ]}
      filtros={[{ label: 'Estado', param: 'estado', opciones: ESTADO_ANIMAL }]}
      campos={[
        { name: 'diio', label: 'DIIO', required: true },
        {
          name: 'lote',
          label: 'Lote',
          type: 'select',
          required: true,
          opcionesEndpoint: '/ganaderia/lotes/',
          opcionesLabelField: 'codigo',
        },
        {
          name: 'raza',
          label: 'Raza',
          type: 'select',
          required: true,
          opcionesEndpoint: '/ganaderia/razas/',
          opcionesLabelField: 'nombre',
        },
        { name: 'sexo', label: 'Sexo', type: 'select', required: true, opciones: SEXO_OPCIONES },
        { name: 'fecha_nacimiento', label: 'Fecha nacimiento', type: 'date' },
        { name: 'edad_aproximada_dias', label: 'Edad aprox. (días)', type: 'number', defaultValue: 0 },
        { name: 'fecha_adquisicion', label: 'Fecha adquisición', type: 'date', required: true },
        { name: 'precio_adquisicion', label: 'Precio adquisición', type: 'number', step: '0.01', required: true },
        { name: 'peso_ingreso_kg', label: 'Peso ingreso (kg)', type: 'number', step: '0.01' },
        { name: 'estado', label: 'Estado', type: 'select', opciones: ESTADO_ANIMAL, defaultValue: 'ACTIVO' },
        { name: 'observaciones', label: 'Observaciones', type: 'textarea' },
      ]}
      accionesExtra={(a) =>
        a.estado === 'ACTIVO' ? (
          <button
            className="rounded-lg px-3 py-2 text-sm font-medium text-red-600 ring-1 ring-inset ring-red-200 transition hover:bg-red-50"
            onClick={() => void marcarFallecido(a.id, a.diio)}
          >
            Fallecido
          </button>
        ) : null
      }
    />
  )
}

export function LotesPage() {
  const navigate = useNavigate()
  return (
    <CrudPage
      titulo="Lotes"
      description="Agrupaciones de animales y seguimiento de costos"
      endpoint="/ganaderia/lotes/"
      onRowClick={(l) => navigate(`/lotes/${l.id}`)}
      columnas={[
        { key: 'codigo', label: 'Código' },
        { key: 'fecha_ingreso', label: 'Ingreso', render: (l) => fecha(l.fecha_ingreso) },
        { key: 'cantidad_original', label: 'Original', ocultaEnMovil: true },
        { key: 'cantidad_actual', label: 'Actual' },
        {
          key: 'estado',
          label: 'Estado',
          render: (l) => <Badge color={l.estado === 'ACTIVO' ? 'green' : 'slate'}>{l.estado}</Badge>,
        },
        { key: 'lote_origen_codigo', label: 'Origen', render: (l) => l.lote_origen_codigo ?? '—', ocultaEnMovil: true },
      ]}
      campos={[
        { name: 'codigo', label: 'Código', required: true },
        { name: 'fecha_ingreso', label: 'Fecha ingreso', type: 'date', required: true },
        { name: 'cantidad_original', label: 'Cantidad original', type: 'number', defaultValue: 0 },
        { name: 'cantidad_actual', label: 'Cantidad actual', type: 'number', defaultValue: 0 },
        {
          name: 'estado',
          label: 'Estado',
          type: 'select',
          opciones: [
            { value: 'ACTIVO', label: 'Activo' },
            { value: 'CERRADO', label: 'Cerrado' },
          ],
          defaultValue: 'ACTIVO',
        },
        { name: 'observaciones', label: 'Observaciones', type: 'textarea' },
      ]}
    />
  )
}

export function PesajesPage() {
  return (
    <CrudPage
      titulo="Pesajes"
      description="Registro de peso de los animales"
      endpoint="/ganaderia/pesos-animales/"
      columnas={[
        { key: 'animal_diio', label: 'Animal' },
        { key: 'fecha', label: 'Fecha', render: (p) => fecha(p.fecha) },
        { key: 'peso_kg', label: 'Peso (kg)', render: (p) => numero(p.peso_kg) },
        { key: 'observaciones', label: 'Observaciones', render: (p) => p.observaciones ?? '—', ocultaEnMovil: true },
      ]}
      campos={[
        {
          name: 'animal',
          label: 'Animal',
          type: 'select',
          required: true,
          opcionesEndpoint: '/ganaderia/animales/?estado=ACTIVO',
          opcionesLabelField: 'diio',
        },
        { name: 'fecha', label: 'Fecha', type: 'date', required: true },
        { name: 'peso_kg', label: 'Peso (kg)', type: 'number', step: '0.01', required: true },
        { name: 'observaciones', label: 'Observaciones', type: 'textarea' },
      ]}
    />
  )
}