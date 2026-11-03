# Auditoría UX/UI de SGIC Terneros — 3 de noviembre de 2026

**Actualización de fase 2:** se implementaron la barra inferior móvil con «Más», paginación en los registros principales, fichas móviles para animales, inventario, rentabilidad e historial y mejoras de navegación por teclado. Documentación y pruebas: [Implementación UX — fase 2](IMPLEMENTACION_UX_FASE_2_2026-11.md). Los apartados de deuda que siguen describen hallazgos originales de la auditoría, no tareas necesariamente pendientes.

## Alcance

Revisión de la aplicación actualmente utilizada con Supabase (`CloudWorkspacePage` y componentes asociados), sus flujos de animales, lotes, inventario, compras, alimentación, ventas, sanidad, gastos, rentabilidad, solicitudes, configuración, auditoría y usuarios. También se revisaron los formularios de SIPECweb, la venta por DIIO, la navegación y las fichas individuales.

El frontend conserva una ruta alternativa de pantallas Django cuando `usaSupabase=false`. Esa ruta no es la utilizada en producción y **no se ha rediseñado** en esta intervención, para evitar duplicar cambios y alterar pantallas no activas.

## Diagnóstico transversal

| Prioridad | Hallazgo | Riesgo visual/operativo | Cambio |
|---|---|---|---|
| Alta | Exceso de subtítulos, instrucciones y avisos repetidos | Relega los datos importantes y multiplica el desplazamiento | Encabezados breves y ayuda opcional bajo `details` |
| Alta | Mezcla de administración y observación en Alimentación | Permite confundir seguimiento con asignación | Seguimiento de solo lectura; gestión de asignaciones en Catálogo |
| Alta | Barra con todas las acciones disponibles desplegadas | Saturación y decisiones poco jerarquizadas | Dos accesos principales y «Más acciones»; alimentación usa acciones internas al catálogo |
| Alta | Demasiada información histórica abierta al mismo tiempo | Resultados y estado del lote no se encuentran fácilmente | Historial, calendario y bitácora desplegables |
| Media | Panel de resumen con banner textual y cinco tarjetas explicadas | Demasiado texto para valores sencillos | Se suprime el banner y se muestran indicadores compactos |
| Media | Tabla de rentabilidad de 11 columnas por defecto | Difícil de leer, especialmente en móvil | Vista inicial de cinco columnas y desglose explícito |
| Media | Pantallas de configuración y pendientes con párrafos por ítem | Desplazamiento excesivo y acciones difusas | Accesos concisos y detalles plegables |
| Media | Formularios con explicación de todo el flujo al abrirlos | Distracción durante la captura | Ayuda bajo demanda; validaciones y confirmaciones se conservan |
| Media | Menú lateral con títulos y pie decorativos y demasiado espacio | Menos módulos visibles sin desplazar | Menú más compacto |
| Media | Datos secundarios en ocho tarjetas en ficha animal | Repite fondos y hace lenta la lectura | Cuatro campos principales y «Más información» |
| Baja | Mensajes de estado redundantes en compras e importación | Compite con la acción principal | Copys reducidos y mantenimiento de advertencias críticas |

## Resultado implementado en esta PR

- **Resumen:** números prioritarios, menos bloques, lotes recientes limitados a seis con navegación al listado completo, stock crítico visible.
- **Animales:** conserva filtros por estado, búsqueda DIIO, conteos y fichas; la ficha individual mantiene en primer plano estado, raza, lote, sexo y valor base, con el resto bajo demanda.
- **Lotes:** conteo en una línea y enlaces directos a animales y al seguimiento; sin párrafo introductorio.
- **Inventario y compras:** controles de entrada se mantienen, explicaciones secundarias se ocultan hasta solicitar ayuda.
- **Gestión de planes:** concentra crear plan, añadir alimentos, asignar, cambiar, desasignar y administrar el plan; opciones peligrosas siguen teniendo confirmación.
- **Seguimiento por lote:** exclusivamente consulta. Conserva selección del lote, plan activo, cantidades, indicadores, costos, calendario, registros y bitácora. El calendario, historial y bitácora se despliegan al pedirlos.
- **Finanzas:** rentabilidad básica con ingresos, costos, utilidad, margen; desglose y otros indicadores accesibles sin ocupar la vista inicial.
- **Solicitudes pendientes:** tarjeta compacta con tipo, fecha y monto; contenido detallado desplegable; aprobación/rechazo siempre disponibles al responsable.
- **Sanidad, ventas y gastos:** cabeceras compactas y filas resumidas.
- **Auditoría/historial:** un selector de tabla sustituye a doce botones simultáneos.
- **Usuarios y configuración:** menos texto, controles administrativos sin pérdida de funcionalidad.
- **SIPECweb y venta por DIIO:** ayudas opcionales, mensajes más breves. Se mantiene la advertencia de que un Excel SIPEC no es prueba de traspaso ni da de baja animales automáticamente.
- **Navegación:** menos espacio vertical y decoración superflua.

## Reglas visuales a mantener

1. Cada vista debe tener **un encabezado claro** y, cuando corresponda, una acción primaria.
2. Evitar tarjetas anidadas para información secundaria: usar divisores o `details`.
3. Mostrar la cantidad y el estado junto al nombre del objeto, sin frases explicativas si no agregan valor.
4. Reservar alertas visibles para **errores, stock insuficiente, duplicados o acciones irreversibles**.
5. Las confirmaciones peligrosas no se ocultan ni se eliminan.
6. Conservar buen contraste, controles táctiles, scroll horizontal en tablas grandes y navegación con teclado.
7. Mantener los componentes administrativos fuera de las vistas de solo seguimiento.

## Deuda de interfaz / segunda fase

- **Paginación real:** el panel de animales consulta como máximo 1000 filas; también hay límites en otras consultas. El contador local puede dejar de representar el total de la base si se supera el límite. Se recomienda total `count:'exact'`, paginación y filtros en servidor antes de ampliar el número de lotes.
- **Tabla de animales en móvil:** evaluar vista resumida de columnas clave en vez de desplazar siete columnas; conservar DIIO, lote, estado y acciones disponibles.
- **Accesibilidad visual:** probar de forma manual con iPhone X/375 px, teclado, zoom 200%, lector de pantalla y contraste. El CI comprueba código y tests, no evalúa la presentación visual en un navegador real.
- **Componentización:** `CloudWorkspacePage` y `OperationalModules` concentran muchos módulos; separar a futuro en componentes de presentación y de datos para reducir regresiones de cambios visuales.
- **Navegación por procedimientos:** evaluar accesos rápidos específicos por rol (administrador/operador), después de observar patrones de uso real, sin agregar más opciones permanentes.
- **Prueba de usabilidad:** medir tiempos para registrar un animal, ingresar insumo, asignar plan, revisar consumo y obtener rentabilidad; ajustar a partir de errores o pasos innecesarios.

## Verificación funcional

Los cambios son del frontend y no modifican tablas, saldos, consumos ni reglas de negocio. Validar con GitHub Actions (pruebas, TypeScript, Vite y auditoría de dependencias). Recomendada inspección visual final con capturas del navegador en móvil y escritorio: el CI no sustituye la revisión visual.
