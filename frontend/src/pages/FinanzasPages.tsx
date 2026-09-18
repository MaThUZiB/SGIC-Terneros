import { CrudPage } from '../components/CrudPage'
import { moneda } from '../utils/format'

export function CategoriasGastosPage() {
  return (
    <CrudPage
      titulo="Categorías de gasto"
      endpoint="/gastos/categorias-gastos/"
      columnas={[
        { key: 'nombre', label: 'Nombre' },
        { key: 'descripcion', label: 'Descripción' },
      ]}
      campos={[
        { name: 'nombre', label: 'Nombre', required: true },
        { name: 'descripcion', label: 'Descripción', type: 'textarea' },
      ]}
    />
  )
}

export function GastosPage() {
  return (
    <CrudPage
      titulo="Gastos"
      endpoint="/gastos/gastos/"
      columnas={[
        { key: 'fecha', label: 'Fecha' },
        { key: 'nombre', label: 'Nombre' },
        { key: 'categoria_nombre', label: 'Categoría' },
        { key: 'lote_codigo', label: 'Lote', render: (g) => g.lote_codigo ?? 'General' },
        { key: 'monto', label: 'Monto', render: (g) => moneda(g.monto) },
      ]}
      campos={[
        {
          name: 'categoria',
          label: 'Categoría',
          type: 'select',
          required: true,
          opcionesEndpoint: '/gastos/categorias-gastos/',
        },
        {
          name: 'lote',
          label: 'Lote (opcional)',
          type: 'select',
          opcionesEndpoint: '/ganaderia/lotes/',
          opcionesLabelField: 'codigo',
          ayuda: 'Dejar vacío para gasto general',
        },
        { name: 'fecha', label: 'Fecha', type: 'date', required: true },
        { name: 'nombre', label: 'Nombre', required: true },
        { name: 'monto', label: 'Monto', type: 'number', step: '0.01', required: true },
        { name: 'detalle', label: 'Detalle', type: 'textarea' },
        { name: 'observaciones', label: 'Observaciones', type: 'textarea' },
      ]}
    />
  )
}