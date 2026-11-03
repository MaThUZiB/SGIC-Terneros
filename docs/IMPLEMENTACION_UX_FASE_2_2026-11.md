# SGIC Terneros · Segunda fase de simplificación UX/UI

Fecha: 3 de noviembre de 2026

## Alcance

Se implementa la segunda fase del documento `AUDITORIA_UX_UI_SIMPLIFICACION_2026-11.md` en la aplicación React conectada a **Supabase** (entorno de producción). No se cambia el funcionamiento de la alimentación automática ni sus reglas de registro y costo. No se altera el backend Django heredado, que no es la interfaz usada cuando `usaSupabase` es verdadero.

### 1. Navegación móvil

- El menú lateral móvil y el botón hamburguesa de la cabecera se sustituyen por una barra inferior de **cuatro destinos**: **Inicio**, **Animales**, **Inventario**, **Más**.
- **Más** abre una hoja inferior con los demás módulos por grupo, respetando la visibilidad por rol.
- **Cerrar sesión** está en `Más` en móvil; permanece en cabecera en escritorio.
- Escritorio a partir de `lg`: se conserva el menú lateral completo.
- Hoja accesible: `role="dialog"`, `aria-modal`, etiqueta del panel, gestión de foco, tabulación interna, Escape para cerrar y retorno de foco.
- Barra con blancos táctiles de al menos 44 píxeles, alto mínimo de 60 píxeles y espacio inferior compatible con `safe-area-inset-bottom`. Se añade espacio bajo el contenido y el pie para evitar que la barra tape controles.
- Etiquetas truncadas sin desbordar cuando se aplica zoom de accesibilidad.

### 2. Paginación real y búsquedas

| Vista | Fuente | Estado |
| --- | --- | --- |
| Registro de animales | `sgic_animales_busqueda` en Supabase, `select(...,{count:'exact'}).range(...)` | 20 resultados por página, búsqueda global por DIIO/raza/lote y filtro de estado |
| Inventario | `producto` en Supabase, contador exacto y filtro `ilike` | 20 productos por página |
| Compras | `compra_animal` / `compra_insumo` y detalles de las compras visibles | 20 compras por página y cambio de tipo sin listas simultáneas |
| Registros de ventas, gastos y sanidad | `venta`, `gasto`, `tratamiento` | 20 por página; nombres asociados consultados solo para IDs visibles |
| Historial general | tabla seleccionada en `OperationsHistory` | 20 registros por página y contador exacto |
| Resumen económico / ganadero | lecturas completas de catálogos mediante rangos de 1.000 | Se eliminan los cortes silenciosos de 1.000 animales y 500 productos en los indicadores |

Las páginas se ordenan de forma estable por fecha/ID o nombre/ID. Las consultas se vuelven a ejecutar al cambiar de página, búsqueda, filtro o actualización del módulo; una respuesta antigua no reemplaza una consulta posterior. Una página desaparecida por un cambio de datos redirige a la última válida. No se inventan cantidades a partir de los registros visibles.

El tamaño de página está centralizado en `src/utils/pagination.ts`. Los contadores son los de la base, sujetos a los permisos RLS de quien inicia sesión.

### 3. Vista de animales segura para búsqueda

Nueva migración: `20261103113000_vista_animales_paginacion.sql`. Crea la vista `public.sgic_animales_busqueda` con `security_invoker=true`, combina nombres de raza y lote para búsqueda y requiere rol `authenticated`. Hereda las políticas RLS de `animal`, `raza` y `lote`. No concede lectura a `anon`.

Verificaciones realizadas: SELECT de usuario autenticado y recuentos funcionales; también se inspeccionaron privilegios de lectura y opción `security_invoker`. La migración quedó aplicada en Supabase Producción.

### 4. Presentación móvil

- Animales: fichas con DIIO, estado, lote y raza; datos secundarios plegables; acceso a la ficha individual conservado.
- Inventario: fichas con nombre, stock y alerta de mínimo; costos, valorización y presentaciones bajo demanda.
- Rentabilidad: fichas por lote con indicadores principales y desglose opcional. La tabla completa sigue disponible en pantallas medianas y grandes.
- Historial de operaciones: ficha por registro con sus campos bajo demanda; la tabla queda para pantallas medianas o grandes.
- Las restantes tablas mantienen desplazamiento bidireccional y región accesible mediante teclado hasta ser rediseñadas individualmente.

### 5. Accesibilidad y límites de validación

- Enlace `Ir al contenido` visible al recibir foco y objetivo válido en `main`.
- Accesos inferiores con `aria-current` y selector de estado con `aria-pressed`.
- Anuncios de carga, error y cantidad; errores con recuperación mediante `Reintentar`.
- Paginador con anterior/siguiente, número de página, rango de registros y botones deshabilitados en extremos.
- La preferencia `prefers-reduced-motion` y fuente mínima de 16 px para entradas móviles ya existentes se mantienen.
- Se añaden pruebas automáticas de rangos de paginación y destinos de navegación móvil.

### 6. Comprobaciones de QA para dispositivo físico

**No afirmar como realizadas si solo se ha pasado CI**. Validar en el navegador de producción cuando se disponga de una sesión de prueba: iPhone X 375 × 812, teléfono estrecho 320 × 568, 390 × 844, escritorio, zoom al 200 %, teclado externo y lector de pantalla.

Recorrido sugerido: abrir Más, desplazarse por sus categorías, volver con Escape, elegir un módulo, comprobar que la barra no cubre guardar/confirmar, buscar un DIIO que no aparezca en la primera página, filtrar fallecidos, avanzar/retroceder 20 registros, consultar compras e historial y abrir información ampliada de rentabilidad.

### 7. Alcance no modificado

No se modifica el stock, el valor base, las ventas, la alimentación programada, ni los permisos administrativos. No se ejecutan acciones de escritura al consultar un listado. Las pantallas heredadas de Django no forman parte de esta versión de Supabase.

La vista de rentabilidad de base de datos todavía limita su consulta a 500 lotes por ejecución; para volúmenes superiores se necesitará una ruta separada de agregación total y detalle paginado. El seguimiento alimentario ya dispone de lectura por tramos y advertencia para históricos superiores a su máximo configurado. Los asesores de Supabase conservan avisos preexistentes sobre funciones RPC privilegiadas e índices de claves foráneas; esta fase no altera sus permisos ni introduce nuevas funciones privilegiadas.
