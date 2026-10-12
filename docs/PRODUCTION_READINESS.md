# Auditoría histórica del proyecto de pruebas — SGIC-Terneros

> **Solo histórico:** este informe revisó la base de pruebas `rsqdtslkndgtaejkaoju`. Desde el 12/10/2026 existe un proyecto de producción **nuevo y vacío** `mtecrgoyrfclnlctenss`, cuyas migraciones se aplicaron sin copiar datos ni usuarios. Consultar [puesta en marcha de producción](./PRODUCTION_SETUP.md). Las cifras DEMO de este documento no describen el nuevo entorno.


Fecha de revisión: 12 de octubre de 2026. Entorno revisado: `rsqdtslkndgtaejkaoju` (Supabase Free). Código del frontend: Cloudflare Pages conectado a `main`.

## Resultado

La revisión estática y las consultas SQL verificaron la configuración general de RLS, el aislamiento de lectura sin sesión, los permisos RPC expuestos y varios invariantes empresariales. La base tiene 23 animales: 18 con DIIO `DEMO-` y 5 sin ese prefijo. El tamaño aproximado de PostgreSQL al revisar fue **13 MB** (independiente de la métrica de logs).

La auditoría de seis comprobaciones de integridad informó **cero discrepancias**: stock contra movimientos firmados; animales activos contra el conteo por lote; totales de compras de insumos; totales de compras de animales; stock negativo; DIIO repetidos.

Se verificó el comportamiento transaccional dentro de un `BEGIN … ROLLBACK` con autorización administrativa: rechazo de ajustes de stock que producirían valores negativos, venta de un animal de prueba con reconocimiento del DIIO y rechazo de un segundo intento de venta. La operación fue revertida: ninguna venta de prueba quedó guardada. Esta prueba **no sustituye pruebas concurrentes**, pruebas de carga ni una prueba E2E desde navegador.

El informe de seguridad de Supabase presenta 26 avisos de funciones `SECURITY DEFINER` ejecutables por `authenticated`; todas son superficies privilegiadas y requieren revisión periódica de sus validaciones. `anon` no tiene permiso de ejecución sobre esas RPC. El asesor también advierte que **Leaked Password Protection** está deshabilitada.

## Condiciones pendientes antes de operaciones reales

1. **Aislar los datos de demostración:** el proyecto contiene 18 animales DEMO y sus compras, lotes e inventario relacionados. Mantenerlos en el entorno de pruebas o iniciar operaciones reales en un proyecto Supabase de producción vacío con las mismas migraciones. Nunca borrar en cascada ni editar la información existente sin plan y copia segura. Hay además datos sin prefijo DEMO cuya naturaleza debe confirmar el titular.
2. **Respaldo y restauración:** en Supabase Free no se incluyen respaldos diarios automáticos como los que existen en planes de pago. Configurar exportaciones regulares de la base (p. ej., CLI `supabase db dump`), guardarlas cifradas fuera del proyecto y ejecutar al menos una restauración de prueba antes de producción. Ver [guía oficial de respaldos](https://supabase.com/docs/guides/platform/backups).
3. **Protección de acceso:** habilitar protección contra contraseñas filtradas en el panel Auth de Supabase si el plan la ofrece; utilizar contraseña administrativa exclusiva y rotar cualquier contraseña previamente compartida. Mantener MFA y principio de mínimo privilegio según disponibilidad.
4. **Pruebas E2E:** comprobar desde la web publicada, con sesión real, creación y consulta de animales, ingresos de inventario y kardex, consumos, aprobación/rechazo de solicitudes, ventas parciales, errores de conexión y recuperación tras cierre del navegador.
5. **Concurrencia:** ejecutar pruebas de dos confirmaciones simultáneas sobre el mismo lote/stock y confirmar que no existe sobregiro, venta duplicada ni desajuste de PMP.
6. **Auditoría y seguridad continuas:** revisar avisos del Security Advisor y ejecutar el script de diagnóstico [integrity_audit.sql](../supabase/tests/integrity_audit.sql), junto con una revisión de dependencias npm y accesos de Cloudflare.
7. **Logs / cuota:** el usuario observó «40 GB / 100 GB» en Supabase, pero esta conexión no expone el contador de facturación. Es imprescindible identificar la etiqueta exacta en Usage antes de interpretar si corresponde a logs ingeridos, logs consultados u otra métrica. [Documentación de uso de logs](https://supabase.com/docs/guides/platform/manage-your-usage/logs).

## Estado de autorización para producción

**No aprobado todavía para cargar información empresarial definitiva.** La base presenta integridad en las comprobaciones descritas, pero faltan separación de datos DEMO, un procedimiento de restauración practicado y validaciones end-to-end y de concurrencia. Hasta resolverlas, operar con información ficticia y preservar los registros existentes.

## Revisión de interfaz

- El botón de cierre del formulario operativo utiliza un icono × en la esquina superior, con nombre accesible y estado deshabilitado durante operaciones en curso.
