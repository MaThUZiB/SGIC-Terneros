# Seguimiento alimentario por lote

## Flujo de trabajo

1. En **Alimentación → Gestión de planes**, consulta el catálogo de planes activos y archivados, su composición diaria, número de lotes asignados e historial. Crea planes con **Crear nuevo registro** y agrega sus ingredientes con **Agregar producto a plan**. La cantidad del plan maestro corresponde **al lote completo**.
2. Desde **Gestión de planes**, abre un plan y elige **Asignar** para vincularlo con un lote activo; también puedes cambiar o desasignar el plan desde **Seguimiento por lote**. La asignación no altera el inventario.
3. Cada día, usa **Confirmar alimentación del día**. Por defecto, el formulario recibe la cantidad total diaria congelada para el lote. Opcionalmente selecciona **Por ternero** e ingresa la ración individual de cada insumo; el sistema multiplica por los animales actualmente registrados, redondea la cantidad total a tres decimales y permite editarla antes de confirmar. Registra cero para omitir un insumo. El formulario muestra costo estimado y alerta si el stock no alcanza. Solo al confirmar se descuentan existencias y se imputa el costo real.
4. En **Seguimiento por lote** consulta el consumo total y durante la vigencia del plan, los días registrados o sin registro, el costo acumulado y los movimientos recientes.
5. Si cambias la dieta, selecciona otro plan y pulsa **Cambiar plan**; si suspendes la planificación, pulsa **Desasignar**. Ambas acciones conservan asignaciones y consumos anteriores.

También puedes abrir la ficha desde **Lotes → Seguimiento alimentario**.

## Cambio y desasignación

- Solo un usuario **ADMIN** activo puede cambiar o desasignar planes.
- Los cambios se aplican en la **fecha actual de Chile**; no se editan fechas históricas ni se programan reemplazos futuros desde esta versión.
- Si hoy ya se confirmó la alimentación del lote mediante un plan, no se permite asignar otro plan hasta mañana. Se puede desasignar el actual después de confirmar hoy, conservando ese consumo.
- Una asignación terminada queda inactiva, con fecha de finalización y auditoría. **No se borra ni se revierte el inventario.**
- Una asignación creada y sustituida el mismo día sin ejecutar queda marcada `SGIC_SIN_EJECUCION` y no se suma como un día planificado.
- Cada asignación guarda una **instantánea de sus ingredientes y cantidades**. Añadir productos al plan maestro no altera la programación de lotes ya asignados. Las asignaciones anteriores a esta versión reciben la composición vigente al instalar la migración, porque sus versiones históricas no se habían guardado.

## Cómo leer los indicadores

- **Días con plan:** jornadas transcurridas durante las asignaciones de ese lote.
- **Días registrados:** jornadas del plan con al menos un movimiento de alimentación `PLAN` o `REAL`.
- **Días sin registro:** diferencia entre días programados y días registrados. No significa que los animales no hayan comido.
- **Planificado por producto:** cantidad diaria congelada × jornadas aplicables.
- **Registrado durante plan:** total registrado en fechas que tienen un plan activo, incluyendo entradas manuales.
- **Total registrado y costo:** incluye también alimentación manual fuera de los intervalos del plan.
- Un movimiento manual adicional del mismo producto y día **se suma al consumo registrado**: evita introducir dos veces el mismo alimento.

Los acumulados se calculan sobre las tablas `consumo` y `detalle_consumo`. El panel pagina la lectura del historial; si supera 10.000 filas por tabla, muestra una advertencia de que las cifras pueden ser parciales.

## Consideraciones operativas

- La programación diaria se define por **lote**, no por ternero. Si cambia la cantidad de animales, revisa manualmente las raciones antes de confirmar el consumo. El sistema indica cuando el conteo actual difiere del original.
- Solo la confirmación real de alimentación o un consumo manual descuenta inventario. Asignar, cambiar y desasignar no genera salidas ni entradas.
- La base de datos evita una segunda confirmación desde plan para el mismo lote y fecha, incluso después de un cambio de asignación.
- No confundas cantidad entregada al lote con cantidad efectivamente ingerida por cada animal.

## Implementación técnica

- UI: `frontend/src/pages/PlansOverview.tsx`; ficha desde `CloudWorkspacePage.tsx`.
- Cálculo: `frontend/src/utils/feedingTracking.ts`; pruebas `frontend/tests/feedingTracking.test.mjs`.
- Confirmación: `SupplyOperations.tsx` utiliza `sgic_confirmar_alimentacion` y la instantánea `asignacion_plan_lote.componentes`.
- Migraciones de Supabase:
  - `20261023145858_seguimiento_y_cambio_planes_lotes.sql`
  - `20261023150059_consumo_plan_unico_por_lote_dia.sql`

## Eliminar, archivar y reactivar un plan maestro

En **Planes disponibles**, un administrador puede:

- **Eliminar** un plan que nunca haya sido asignado: se borran el plan y sus líneas de composición; se pide confirmación explícita.
- **Archivar** un plan sin asignaciones vigentes: deja de ofrecerse para nuevas asignaciones, pero conserva su historial de lotes y consumos. Si está vigente en algún lote, primero hay que cambiarlo o desasignarlo.
- **Reactivar** un plan archivado: vuelve a estar disponible para futuras asignaciones sin alterar las anteriores.

Estas operaciones están protegidas por la RPC `sgic_gestionar_plan`, que valida permisos ADMIN y ejecuta cambios atómicos y auditados.

## Cálculo diario y límites del modelo vigente

- **Total del lote** (por defecto): `cantidad_a_descontar = cantidad_diaria_configurada`. No hay multiplicación automática; esto mantiene los planes anteriores sin cambios de significado.
- **Por ternero** (opción de registro diario): `cantidad_a_descontar = redondear_3(cantidad_por_ternero × animales_activos_actuales)`. Esta opción usa el censo actual, solo permite confirmar hoy y no modifica el plan maestro ni la instantánea de su asignación. La sugerencia inicial deriva de la cantidad total del plan / censo actual, por lo que editarla es necesario si cambia la ración individual.
- La previsualización muestra cantidades por alimento, equivalencia aproximada por cabeza, stock insuficiente y costo calculado al costo promedio actual. Los datos pueden cambiar antes de confirmar, por lo que Supabase vuelve a validar existencias y fecha en la operación transaccional.
- Las cantidades son **unidades base del inventario** (kg, l, etc.), no número de sacos ni volumen de leche reconstituida si el producto almacenado es sustituto en polvo.
- No se registran automáticamente días sin confirmación. El registro manual y la confirmación del plan son movimientos separados: no vuelvas a registrar manualmente la misma entrega que ya confirmaste desde el plan.

### Evolución recomendada del cálculo

El próximo paso para un modelo duradero es permitir **planes maestros con tipo de dosis persistente** (`por animal` o `por lote`), congelar esa elección en cada asignación y guardar el censo utilizado en cada ejecución. Así, una reducción del lote mantendría la ración individual sin cambiar manualmente el plan maestro. Para sustitutos lácteos sería útil configurar una **equivalencia por producto** entre litros preparados y kg de polvo consumido, evitando contabilizar dos veces el mismo alimento. Requiere migración versionada y revisión de reportes históricos; estos cambios no se activan automáticamente con la interfaz actual.
