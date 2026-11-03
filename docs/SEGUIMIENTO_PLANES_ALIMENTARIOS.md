# Alimentación automática por lote — SGIC Terneros

## Flujo diario sin confirmaciones

1. En **Alimentación → Gestión de planes** crea el plan maestro.
2. Los planes **nuevos** calculan por defecto la ración **por ternero y día**. Antes de asignarlo se puede cambiar a una cantidad fija **por lote**. Los planes anteriores mantienen la interpretación histórica «total del lote».
3. Añade alimentos desde **Añadir alimento al plan**, expresando sus cantidades en la **unidad base del inventario** (kg, l, etc.). Para un plan por ternero, la cantidad representa lo previsto por animal por día.
4. Asigna el plan a uno o varios lotes activos. Desde esa fecha, **no se necesita confirmar cada jornada**.
5. SGIC ejecuta automáticamente la salida de inventario al cierre de cada día, después de las **23:00 hora de Chile**, mediante un proceso programado en Supabase. La tarea revisa también los últimos siete días para reintentar fallos de stock o interrupciones.
6. **Seguimiento por lote** permite ver los cargos, costos, fechas pendientes, historial de planes y errores. El plan puede cambiarse o desasignarse, sin borrar registros anteriores.

## Fórmulas

- Plan por ternero: `consumo_programado_producto = redondear(gramos_o_kilos_diarios_por_ternero × animales_actuales, 3 decimales)`.
- Plan fijo por lote: `consumo_programado_producto = cantidad_diaria_configurada`.
- Costo imputado: cantidad descontada en unidad base × costo promedio ponderado vigente.
- **No** conviertas litros de leche reconstituida en kg de sustituto sin una equivalencia configurada y validada. El proceso actual utiliza unidades base, no sacos comerciales ni litros preparados si el inventario lleva kilogramos de polvo.

## Seguridad de inventario y reintentos

- El cargo se ejecuta en la base de datos, sin que el usuario tenga la aplicación abierta.
- Hay una restricción única de consumo `PLAN` por lote y fecha. La tarea también usa un bloqueo transaccional: reintentar **no duplica salidas**.
- Antes del cargo se valida el stock de **cada insumo sumando todas las líneas**. Si falta un producto o el plan es inválido, **todo el cargo del lote se revierte** y la jornada queda como **ERROR** en `sgic_alimentacion_auto_evento`.
- Si se ingresa stock después, la tarea vuelve a intentar la fecha pendiente durante un máximo de siete días.
- Si ya existe un registro manual `REAL` del lote y día, se evita el cargo automático de ese día por riesgo de duplicación, dejando estado `OMITIDO_MANUAL` para revisión.
- Las acciones automáticas se registran con `usuario_id = NULL` (no se atribuyen falsamente a una persona). La observación del consumo contiene asignación, modo y censo usado. Los movimientos manuales mantienen su usuario.
- La tarea no crea cargos para fechas anteriores al 3 de noviembre de 2026 y nunca procesa fechas futuras.
- Los lotes cerrados no reciben cargos nuevos.

## Precisión contable

Los movimientos automáticos son **consumo teórico o programado imputado al lote**. Son una provisión operativa para descontar stock y costear la alimentación, **no evidencia de ingesta real**. Si se entregó menos, hubo desperdicio o alimento sobrante, hay que realizar un ajuste identificado (y mantener ese historial). La tarea no puede inferir cambios de dieta, ayunos, sobrantes, pérdidas de leche preparada o alimentos suministrados parcialmente.

En un día de reintento atrasado, el censo y costo promedio disponibles pueden ser posteriores a la fecha histórica. El sistema conserva el censo usado en la bitácora, pero conviene registrar las bajas/altas de animales oportunamente para reducir desfases. No backfill más de siete días sin una conciliación.

## Implementación

- Migración: `supabase/migrations/20261103094500_alimentacion_automatica_diaria.sql`.
- Scheduler: `pg_cron`, trabajo `sgic-alimentacion-automatica`, cada hora al minuto 15 UTC. Un control de hora local aplica el cargo de hoy a partir de las 23:00 de Chile.
- Funciones privadas: `sgic_private.ejecutar_alimentacion_programada()`, `sgic_private.aplicar_alimentacion_automatica(date)`.
- Registro de alertas: `public.sgic_alimentacion_auto_evento` (RLS de solo lectura para perfiles activos).
- UI: `frontend/src/pages/PlansOverview.tsx` y `PlanCatalog.tsx`. El botón de confirmación manual ya no se ofrece y se retiran los permisos de ejecución a las RPC manuales del plan.
- Se conserva la composición y modalidad en cada asignación; cambiar un plan con historial obliga a crear otro para preservar su trazabilidad.

## Ajustes futuros

Valorar una conciliación diaria entre **alimento programado**, **alimento entregado** y **mermas/sobrantes** que no requiera confirmar la jornada normal, pero permita correcciones excepcionales sin duplicar consumo. Para leche, incorporar recetas verificadas de litros preparados a kg de polvo. También conviene capturar censos históricos y asignaciones futuras para recalcular reintentos de forma exacta.
