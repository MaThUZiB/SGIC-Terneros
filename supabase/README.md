# Supabase — SGIC-Terneros

El sistema utiliza Supabase Auth, PostgreSQL, RLS y funciones SQL para operaciones transaccionales. Frontend: React/Vite publicado en Cloudflare Pages. La implementación Django queda como referencia histórica.

**Proyecto de ensayo:** rsqdtslkndgtaejkaoju (región São Paulo). **No utilizar datos empresariales reales hasta finalizar las verificaciones de seguridad y recuperación.**

## Infraestructura y migraciones

Las migraciones versionadas están en [migrations/](./migrations/) y fueron aplicadas a Supabase en orden secuencial. El esquema incluye 29 tablas públicas con RLS activado. Las políticas permiten consultar datos a perfiles activos, pero las tablas empresariales no conceden INSERT/UPDATE/DELETE directos al navegador. Todas las operaciones críticas requieren llamar a RPC autorizadas.

Las funciones de inventario, compras, pesajes, lotes, planes alimentarios, consumos, sanidad, gastos y ventas se describen en [Operaciones Supabase](../docs/OPERACIONES_SUPABASE.md).

### Uso de las migraciones

- Los archivos SQL contienen exactamente las versiones registradas en el historial remoto.
- No reaplicar el esquema base sobre tablas existentes.
- Antes de migrar otro entorno, verificar las versiones mediante la CLI y la base enlazada.
- Las semillas DEMO viven en [seeds/](./seeds/); **no** deben desplegarse automáticamente en ambientes productivos.

## Estado de la base de ensayo

- 18 animales ficticios con identificadores DEMO, 2 lotes, 6 productos y compras de prueba.
- Un administrador activo y verificado.
- Ninguna venta ni consumo de inventario confirmado permanentemente durante la fase de pruebas SQL.
- Se reparó el borrador DEMO-COT-001 para que los precios por unidad base y sus subtotales concilien.
- Pruebas SQL de regresión: [operational_smoke_rollback.sql](./tests/operational_smoke_rollback.sql). Los cambios terminan con ROLLBACK.

## Alta de usuarios

1. Crear/invitar el usuario desde Supabase Dashboard → Authentication → Users, con correo verificado y contraseña segura.
2. El trigger crea su perfil como OPERADOR inactivo.
3. Un administrador puede habilitarlo, cambiar su rol o desactivarlo en la sección **Usuarios** de React; el cambio se audita y nunca se puede desactivar al último administrador activo.
4. El login del frontend verifica Supabase Auth y la activación del perfil. Nunca almacenar service_role ni contraseñas de PostgreSQL en el cliente.

## Riesgos pendientes

El Security Advisor informa avisos para funciones SECURITY DEFINER públicas invocables por authenticated. Estas RPC tienen GRANT específicos para usuarios autenticados, identidad y rol verificados contra tablas de servidor, search_path fijo y auditoría. Esta arquitectura requiere auditoría externa y pruebas de penetración antes de su puesta en marcha empresarial.

Está pendiente activar **Leaked Password Protection** desde la configuración de Supabase Auth. También faltan pruebas de usuarios concurrentes reales, ensayos de restauración/backups, pruebas de interfaz autenticada extremo a extremo y mecanismos de idempotencia para evitar duplicaciones por reintentos de red.

**Estado:** módulos operativos centrales implementados y pruebas de SQL/compilación superadas. La publicación es todavía un entorno de demostración, no un sistema validado para operación empresarial.
