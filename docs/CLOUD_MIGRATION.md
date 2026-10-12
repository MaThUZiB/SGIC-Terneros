# Arquitectura objetivo y secuencia de migración

**Estado (12/10/2026):** esquema PostgreSQL y control de roles activos en un proyecto Supabase de desarrollo; frontend con autenticación Supabase opcional y portal de transición. Los módulos de negocio Django aún no han sido migrados. No publicar como aplicación de producción.

## Componentes

- GitHub: código fuente, pull requests y revisiones.
- Cloudflare Pages: publicación del frontend React/Vite en `frontend/dist`.
- Supabase Free: PostgreSQL, Auth, RLS, Storage y funciones transaccionales.
- Django: referencia de reglas actuales durante la transición; no ejecutable en Pages.

## Flujo de datos futuro

```mermaid
flowchart TD
 Browser[React en Cloudflare Pages] --> Auth[Supabase Auth]
 Browser --> Data[Data API + RLS]
 Browser --> Fn[Edge Functions autenticadas]
 Data --> DB[(PostgreSQL)]
 Fn --> RPC[RPC transaccionales]
 RPC --> DB
 RPC --> Audit[Registro de auditoría]
 Audit --> DB
```

## Configuración de Cloudflare Pages

1. Conectar repositorio GitHub y seleccionar `main` tras fusionar y validar el PR.
2. Root directory: `frontend`.
3. Build command: `npm ci && npm run build`.
4. Build output directory: `dist`.
5. Definir `VITE_AUTH_PROVIDER=supabase`, `VITE_SUPABASE_URL` y la clave pública `VITE_SUPABASE_PUBLISHABLE_KEY`. No configurar variables privilegiadas.
6. El archivo `frontend/public/_redirects` cubre rutas de React Router en Cloudflare Pages.
7. En modo Supabase, únicamente el login y el portal de transición funcionan sin Django. Las páginas CRUD heredadas no se exponen en este modo. Para las operaciones antiguas debe usarse el modo Django local.

## Migración funcional por fases

1. Inventario: exportar contratos Django, modelos y reglas actuales; definir invariantes de DIIO, stock, PMP y costos.
2. Datos: crear migraciones versionadas en `supabase/migrations`; restricciones SQL, FK, índices y política RLS deny-by-default.
3. Identidad: integrar Supabase Auth y autorización por roles verificados del servidor.
4. Transacciones: implementar compra de animales, compra insumos, consumos, división de lotes, fallecimiento, ventas y auditoría con RPC atómicas, validación de actor y control de concurrencia.
5. UI: sustituir gradualmente axios/Django y el contexto de autenticación por clientes Supabase sin conservar tokens Django en localStorage.
6. Calidad: pruebas RLS, privilegios, integridad, reversas y conflictos concurrentes; pruebas visuales y responsivas.
7. Operación: exportaciones cifradas, restauración ensayada, pausas del plan Free, monitoreo y decisión de continuidad.

## Criterios de liberación

- Prohibido acceder a tablas empresariales sin sesión y sin RLS.
- La clave `service_role` nunca se expone en el navegador.
- Todo movimiento de inventario genera movimiento y auditoría en la misma transacción.
- Una venta confirmada reconoce costos una sola vez y registra DIIO explícitos.
- Pruebas de restauración documentadas antes de cargar datos empresariales reales.

**Manual de arquitectura:** [Notion](https://app.notion.com/p/3f7b5e350d7181f5957df2b6c8b54634).

## Identidades y permisos implementados

- Trigger privado crea perfil de cada usuario Auth con rol `OPERADOR` e `activo=false`.
- Un administrador habilita usuarios de forma controlada desde SQL Editor; ninguna clave secreta se publica en React.
- Cambios de rol/estado generan auditoría y solo el perfil propio es visible por RLS.
- React usa el SDK oficial de Supabase con versión bloqueada; ingreso con correo/contraseña, validación de sesión y perfil. Las rutas empresariales Django quedan excluidas del modo Supabase.
- Ver [procedimiento operativo](../supabase/README.md) para alta de administrador e instrucciones de validación.
