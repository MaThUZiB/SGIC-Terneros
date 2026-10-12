# SGIC-Terneros — Puesta en marcha de producción

**Proyecto activo:** [SGIC-Terneros Producción](https://supabase.com/dashboard/project/mtecrgoyrfclnlctenss) · Región `sa-east-1` · Supabase Free · costo de creación informado: US$0/mes.

**Aplicación:** https://sgic-terneros.pages.dev/ · repositorio `MaThUZiB/SGIC-Terneros`, rama `main`.

## Instalación efectuada

- Se creó un proyecto Supabase **nuevo**, sin importar información ni cuentas desde la instancia anterior.
- Se aplicaron las **14 migraciones** existentes en `supabase/migrations` por orden cronológico. Se ajustó el historial de versiones remoto para coincidir con los nombres versionados en GitHub.
- Se verificaron las tablas de negocio, RLS, funciones RPC y registros vacíos: **0 animales, 0 lotes, 0 productos, 0 razas, 0 compras, 0 movimientos de inventario, 0 auditorías y 0 usuarios Auth/perfiles**.
- **No se ejecutó** `supabase/seeds/demo_20261012.sql` ni se copiaron registros, contraseñas o usuarios de `rsqdtslkndgtaejkaoju`.
- Para asegurar el cambio sin acceso al panel Cloudflare, el frontend compilado para producción toma la URL y clave **pública** `sb_publishable_` de la nueva instancia desde `frontend/src/api/supabase.ts`. Las variables antiguas de Cloudflare se ignoran en ese build; no se guardaron claves secretas.
- No es necesario crear razas, proveedores o artículos ficticios de inicio. El administrador podrá introducir los catálogos reales.

## Alta inicial del administrador (requiere intervención del titular)

1. Abrir [Supabase Producción → Authentication → Users](https://supabase.com/dashboard/project/mtecrgoyrfclnlctenss/auth/users).
2. Crear/invitar el correo del administrador **en el proyecto nuevo** y configurar una contraseña exclusiva (diferente de la cuenta del proyecto anterior). Comprobar la confirmación del correo de acuerdo con el flujo elegido.
3. El trigger `sgic_auth_user_created` genera automáticamente un `perfil` inicial `OPERADOR` e `activo=false`.
4. Abrir [SQL Editor de producción](https://supabase.com/dashboard/project/mtecrgoyrfclnlctenss/sql/new) y ejecutar, sustituyendo el correo indicado:

```sql
update public.perfil p
set rol = 'ADMIN', activo = true
from auth.users u
where u.id = p.id
  and lower(u.email) = lower('REEMPLAZAR_CORREO_ADMIN')
  and u.email_confirmed_at is not null
  and (u.banned_until is null or u.banned_until <= now())
returning p.id, p.rol, p.activo;
```

5. Verificar **una fila** con `ADMIN` y `true`. Si retorna cero filas, comprobar registro y confirmación del correo antes de reintentar.
6. Esperar el despliegue de Cloudflare desde `main`. Cerrar sesión de la app anterior (si existía), entrar a https://sgic-terneros.pages.dev/, iniciar sesión **con la cuenta creada en el nuevo Supabase**, comprobar que todas las listas partan vacías y crear los catálogos reales desde Administración.
7. En la cuenta del titular habilitar a los demás familiares con el rol adecuado usando la interfaz de Usuarios (solo un administrador puede autorizar).
8. Opcional pero recomendable: en Cloudflare Pages → Settings → Variables, sustituir también las variables `VITE_SUPABASE_URL` y `VITE_SUPABASE_PUBLISHABLE_KEY` antiguas para evitar confusión futura, aunque el build de producción ya utiliza el proyecto nuevo.

## Cierre del proyecto antiguo

El proyecto `rsqdtslkndgtaejkaoju` era solo para pruebas; todos sus registros son descartables según autorización expresa del titular. **No se migra absolutamente nada**.

Después de validar inicio de sesión y consultas contra el proyecto nuevo, el titular puede eliminar el antiguo desde el Dashboard de Supabase (Project Settings → General → Delete project). Esta acción es irreversible. La integración de ChatGPT disponible no expone una operación de eliminación de proyectos: **no se ha eliminado**.

## Mantenimiento proporcional para cinco usuarios familiares

- Cada persona utiliza su propio usuario de Auth; mínimo privilegio ADMIN/OPERADOR.
- Exportar datos a una copia externa cifrada semanalmente y antes de modificaciones importantes. Supabase Free no garantiza los respaldos diarios administrados de los planes de pago.
- Evitar pruebas destructivas en producción. Verificar cambios mediante transacciones revertidas o usando otros proyectos de prueba cuando sea necesario.
- Conservar archivos de migración en GitHub; no versionar contraseñas ni tokens secretos.
- El acceso a la nueva base está protegido por RLS; sin crear una cuenta Auth autorizada, nadie puede operar desde el navegador.

## Verificaciones pendientes

La base nueva está completamente vacía. La prueba E2E autenticada se realizará **después de crear el administrador**. No interpretar 0 registros como error mientras no se carguen catálogos/animales.
