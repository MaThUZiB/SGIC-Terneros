import { useNavigate } from 'react-router-dom'
import { CrudPage } from '../components/CrudPage'
import { Badge } from '../components/ui'
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
  return (
    <CrudPage
      titulo="Animales"
      endpoint="/ganaderia/animales/"
      columnas={[
        { key: 'diio', label: 'DIIO' },
        { key: 'lote_codigo', label: 'Lote' },
        { key: 'raza_nombre', label: 'Raza' },
        {
          key: 'sexo',
          label: 'Sexo',
          render: (a) => (a.sexo === 'M' ? 'Macho' : a.sexo === 'H' ? 'Hembra' : a.sexo),
        },
        {
          key: 'estado',
          label: 'Estado',
          render: (a) => (
            <Badge
              color={a.estado === 'ACTIVO' ? 'green' : a.estado === 'VENDIDO' ? 'blue' : 'red'}
            >
              {a.estado}
            </Badge>
          ),
        },
        { key: 'edad_aproximada_dias', label: 'Edad (días)' },
        { key: 'precio_adquisicion', label: 'Precio', render: (a) => moneda(a.precio_adquisicion) },
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
    />
  )
}

export function LotesPage() {
  const navigate = useNavigate()
  return (
    <CrudPage
      titulo="Lotes"
      endpoint="/ganaderia/lotes/"
      onRowClick={(l) => navigate(`/lotes/${l.id}`)}
      columnas={[
        { key: 'codigo', label: 'Código' },
        { key: 'fecha_ingreso', label: 'Fecha ingreso', render: (l) => fecha(l.fecha_ingreso) },
        { key: 'cantidad_original', label: 'Original' },
        { key: 'cantidad_actual', label: 'Actual' },
        {
          key: 'animales_count',
          label: 'Animales',
          render: (l) => numero(l.animales_count ?? 0, 0),
        },
        {
          key: 'estado',
          label: 'Estado',
          render: (l) => <Badge color={l.estado === 'ACTIVO' ? 'green' : 'slate'}>{l.estado}</Badge>,
        },
        { key: 'lote_origen_codigo', label: 'Origen', render: (l) => l.lote_origen_codigo ?? '—' },
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
