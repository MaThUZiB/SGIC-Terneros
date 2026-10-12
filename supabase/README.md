# Supabase — Base de datos, autenticación y funciones

## 1. Alcance

La base activa de SGIC-Terneros utiliza **Supabase PostgreSQL** con Auth, RLS y funciones SQL RPC. El frontend React/Vite se publica en Cloudflare Pages.

**Proyecto productivo:** `mtecrgoyrfclnlctenss` · región `sa-east-1`. Los archivos de esta carpeta son la referencia versionada para reproducir el esquema y verificar sus invariantes.

## 2. Organización

- `migrations/`: 14 migraciones SQL del esquema relacional, RLS, perfiles, funciones, índices y correcciones incrementales.
- `tests/integrity_audit.sql`: controles de solo lectura de stock, lotes, compras y DIIO.
- `tests/operational_smoke_rollback.sql`: ensayos transaccionales que se revierten; revisar instrucciones antes de ejecutar.
- `seeds/demo_20261012.sql`: **exclusivamente datos ficticios para entornos aislados**. No ejecutar en producción.
- `seeds/README.md`: instrucciones y restricciones de las semillas.

## 3. Modelo de seguridad

1. Supabase Auth identifica al usuario.
2. El trigger `sgic_auth_user_created` crea `public.perfil` con rol `OPERADOR` y `activo=false`.
3. Un ADMIN habilitado autoriza cuentas y roles desde la sección **Usuarios**; para el primer administrador se usa [configuración inicial](../docs/PRODUCTION_SETUP.md).
4. Las tablas del esquema `public` están protegidas por RLS. La lectura depende de perfiles autorizados.
5. Las funciones RPC de negocio verifican identidad/rol, ejecutan mutaciones atómicas y generan auditoría.
6. En el cliente solo se utiliza clave `sb_publishable_` y URL pública. Nunca publicar `service_role`, `sb_secret_` o credenciales PostgreSQL.

## 4. Instalación del esquema

1. Crear un proyecto Supabase autorizado para el entorno.
2. Verificar la compatibilidad de PostgreSQL y Supabase Auth.
3. Aplicar las migraciones SQL **en orden de versión**, sin ejecutar scripts demo.
4. Comprobar funciones y objetos registrados contra las migraciones.
5. Revisar RLS, grants y los avisos de Security Advisor.
6. Crear y habilitar al primer administrador.
7. Ejecutar las comprobaciones de [integridad](./tests/integrity_audit.sql) sin alterar información.

**Regla:** una migración aplicada no se edita retroactivamente. Toda evolución del esquema requiere una nueva migración revisable y aplicada controladamente.

## 5. Reglas transaccionales principales

- `sgic_registrar_compra_animales` registra compras y DIIO únicos por lote.
- `sgic_comprar_insumo` confirma compras directas y actualiza kardex/PMP.
- `sgic_crear_compra_insumo` guarda compras en borrador; `sgic_confirmar_compra_insumo` confirma y `sgic_anular_borrador_insumo` anula antes de afectar stock.
- `sgic_ajustar_stock` aplica ajustes firmados con motivo; no admite stock negativo.
- `sgic_registrar_consumo` y `sgic_consumo_desde_plan` imputan consumo y valorización.
- `sgic_registrar_tratamiento` descuenta insumos sanitarios y registra costo.
- `sgic_confirmar_venta` y `sgic_confirmar_borrador_venta` reconocen ventas por DIIO, costos y estados; las ventas no pueden confirmarse dos veces.
- `sgic_autorizar_usuario` administra activación y rol con autorización de ADMIN.

Las RPC no son una API pública anónima: su acceso requiere cuenta válida y se controla dentro de la base.

## 6. Operación segura

- Ejecutar `supabase/tests/integrity_audit.sql` periódicamente; los movimientos `SALIDA` contienen cantidades positivas y deben restarse al conciliar.
- Mantener backups fuera de la plataforma. No copiar bases operativas a entornos no autorizados.
- No ejecutar pruebas que alteren datos reales; las transacciones de ensayo deben revertirse explícitamente.
- Mantener acceso restringido a SQL Editor y revisar las funciones `SECURITY DEFINER` con permiso para usuarios autenticados.
- La lectura de un Excel SIPECweb se realiza en el **frontend** y no necesita tablas adicionales ni cargar el archivo en PostgreSQL.

Consultar [manual de operación](../docs/OPERACIONES_SUPABASE.md), [despliegue](../docs/CLOUD_MIGRATION.md) y [continuidad](../docs/PRODUCTION_READINESS.md).
