# SGIC-Terneros — Operación sobre Supabase

Versión de desarrollo: 12 de octubre de 2026.

## Arquitectura

React/Vite se publica en Cloudflare Pages y usa Supabase Auth para el inicio de sesión. El modelo de negocio se implementa en PostgreSQL. Todas las entidades expuestas conservan RLS; la lectura requiere un perfil activo y las escrituras se ejecutan por procedimientos RPC con comprobación explícita de identidad. No se publica ninguna clave privada en React. El backend Django se mantiene solo como referencia de las reglas originales.

- Administrador: catálogos, ingresos de ganado, bajas, división de lotes, compras/confirmaciones, ajustes, gastos, ventas y permisos de usuarios.
- Operador: pesajes, consumos de alimentación, consumos desde plan y tratamientos sanitarios.
- Auditoría: cada escritura registra una acción y referencia de negocio; el historial se consulta únicamente como administrador.
- Base de datos: transacciones atómicas y bloqueos de fila en compras de insumos, stock, lotes y ventas.

## Funciones y flujos

| Dominio | Procedimiento principal | Resultado |
|---|---|---|
| Catálogos | sgic_catalogo | Razas, proveedores, categorías, unidades, productos, lotes y planes |
| Animales | sgic_registrar_compra_animales | Compra de 1–200 DIIO, lote nuevo o incorporación excepcional |
| Pesajes | sgic_registrar_peso | Historial de peso con fecha |
| Mortalidad | sgic_fallecimiento | Estado FALLECIDO y conteo recalculado |
| Lotes | sgic_dividir_lote | Transferencia con DIIO explícitos y trazabilidad del origen |
| Presentaciones | sgic_presentacion / sgic_conversion | Factor comercial y equivalencias de unidad |
| Inventario | sgic_crear_compra_insumo / sgic_confirmar_compra_insumo | Borrador, entrada en kardex y nuevo PMP |
| Stock | sgic_ajustar_stock | Corrección firmada con justificación |
| Alimentación | sgic_registrar_consumo / sgic_consumo_desde_plan | Descuento de inventario e imputación de costo |
| Sanidad | sgic_registrar_tratamiento | Descuento valorizado del producto y costo por animal |
| Planes | sgic_plan_detalle / sgic_asignar_plan | Definición de ración y asignación por lote |
| Gastos | sgic_registrar_gasto | Gasto general o imputado al lote |
| Ventas | sgic_borrador_venta / sgic_confirmar_borrador_venta / sgic_anular_borrador_venta | Borrador, confirmación o anulación |
| Venta inmediata | sgic_confirmar_venta | Confirma de forma directa una selección DIIO |
| Correcciones | sgic_actualizar_producto / sgic_rectificar_animal | Actualizaciones auditadas, sin alterar compras históricas |
| Usuarios | sgic_listar_usuarios / sgic_autorizar_usuario | Habilitación, baja y cambio de rol administrativo |

## Invariantes

1. DIIO único; animal adquirido mantiene su costo original.
2. Borradores de insumos y venta no generan movimientos ni cambios de estado.
3. Una compra de insumos confirmada aumenta stock y recalcula PMP:
   PMP = (stock anterior × PMP anterior + cantidad base × precio base) / stock final.
4. Salidas de insumos y tratamientos aplican el PMP vigente; rechazan stock insuficiente.
5. Toda operación que altera stock crea movimiento de kardex y registro de auditoría en la misma transacción.
6. La venta confirmada identifica DIIO explícitos, marca animales VENDIDO, congela costo/utilidad por lote y cierra los lotes sin animales activos.
7. En ventas parciales, el costo compartido acumulado ya reconocido se resta antes de asignar el saldo a animales activos; no se reconoce dos veces.
8. Por ahora **se bloquea la división** de un lote que tenga consumos, sanidad, gastos o ventas históricos. Se requiere un algoritmo validado de redistribución para habilitarla en esos casos.
9. La ejecución diaria de un mismo plan se puede registrar **solo una vez por lote/asignación/fecha**.
10. El gasto general sin lote no se redistribuye automáticamente; por tanto la utilidad realizada no incluye esos gastos ni descuentos comerciales no registrados.

## Datos de demostración

El proyecto contiene 18 animales ficticios (DIIO con prefijo DEMO), 2 lotes y productos de ejemplo. La compra DEMO-COT-001 sigue **en borrador**; se corrigieron sus precios unitarios base para que su total coincida con el detalle. Confirmarla generaría movimientos reales sobre el entorno de prueba.

Los procesos no eliminan registros históricos. Ejecutar ensayos solamente con transacciones que terminan en ROLLBACK y nunca con credenciales empresariales productivas.

## Validaciones realizadas

- PostgreSQL: pruebas transaccionales revertidas de compras, precio promedio, inventario, consumos, venta parcial y cierre de lotes.
- Se verificó que dos ventas parciales sucesivas reconocen el costo compartido solo una vez.
- Compra de animales, pesajes, fallecimiento y división de lote verificados con ROLLBACK.
- Confirmación y anulación de borradores de venta verificadas sin alterar definitivamente DIIO.
- Ejecución de plan, prevención de consumo duplicado, autorización de usuario y prevención de baja del último administrador.
- Catálogos, presentaciones, conversiones, actualización de producto y rectificación auditada.
- Prueba de rechazo de identidad no autorizada; anónimo no puede ejecutar RPC ni modificar tablas.
- React/Vite: verificación de compilación por GitHub Actions en el PR correspondiente.

## Riesgos pendientes antes de operación real

- Pruebas automáticas con dos sesiones concurrentes reales; los bloqueos PostgreSQL fueron revisados, pero la prueba de carga no se ejecutó.
- Prueba E2E en navegador, desde login hasta cada formulario, sobre una instancia de ensayo independiente.
- Ciclo completo de respaldos, restauración y eventual reversión de errores operativos (las ventas confirmadas no admiten anulación directa).
- Habilitar **Leaked Password Protection** en Supabase Authentication, que sigue marcado por el Security Advisor.
- El asesor de Supabase avisa que hay RPC SECURITY DEFINER invocables por authenticated; esto es intencionado para escritura con RLS cerrado, con funciones explícitamente autorizadas, búsqueda SQL fija y verificación de rol. Requieren revisión de seguridad independiente antes de usar datos sensibles.
- Tratamiento de idempotencia de solicitudes ante fallos de red; evitar reenviar una operación sin comprobar el historial.
- Vista de reportes: rentabilidad realizada por lote, no conciliación contable ni declaración tributaria.
- Paginación y exportación de datos grandes, validación de unidades clínicas, respaldo de adjuntos y pruebas de estrés.

**Estado:** Módulos operativos esenciales implementados y validados a nivel de SQL/compilación. Se conserva el rótulo *entorno de prueba* hasta finalizar las verificaciones y políticas de operación mencionadas.
