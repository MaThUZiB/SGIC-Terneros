import { CrudPage } from '../components/CrudPage'
import { fechaHora } from '../utils/format'

export function AuditoriaPage() {
  return (
    <CrudPage
      titulo="Registros de auditoría"
      endpoint="/auditoria/registros-auditoria/"
      puedeCrear={false}
      puedeEditar={false}
      puedeEliminar={false}
      columnas={[
        { key: 'fecha_hora', label: 'Fecha', render: (r) => fechaHora(r.fecha_hora) },
        { key: 'usuario_username', label: 'Usuario', render: (r) => r.usuario_username ?? '—' },
        { key: 'accion', label: 'Acción' },
        { key: 'modelo', label: 'Modelo' },
        { key: 'objeto_id', label: 'Objeto' },
      ]}
      campos={[]}
    />
  )
}