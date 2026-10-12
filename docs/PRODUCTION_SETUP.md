# Configuración inicial y administración de usuarios

## 1. Datos del entorno

- **Aplicación:** https://sgic-terneros.pages.dev/
- **Proyecto:** [SGIC-Terneros Producción](https://supabase.com/dashboard/project/mtecrgoyrfclnlctenss)
- **Región:** `sa-east-1`.
- **Identidad:** Supabase Auth por correo y contraseña.
- **Autorización:** tabla `public.perfil` con `rol` (`ADMIN` o `OPERADOR`) y `activo`.

La base utiliza las 14 migraciones SQL disponibles en `supabase/migrations/`. No ejecutar scripts de datos de ejemplo en producción.

## 2. Inicio de sesión

1. Abrir la aplicación web.
2. Ingresar el correo y la contraseña de la cuenta creada en Supabase Auth del proyecto correcto.
3. El sistema comprueba la sesión y consulta el perfil propio por RLS.
4. Si el perfil no existe o `activo=false`, el ingreso se deniega con un mensaje de autorización. Solicitar habilitación al administrador.
5. Utilizar **Salir** para terminar la sesión.

## 3. Primera habilitación administrativa

**Procedimiento de arranque, aplicable solo cuando aún no exista un ADMIN activo.** El trigger de alta de Auth registra cuentas nuevas como `OPERADOR` y `activo=false`.

1. Abrir [Authentication → Users](https://supabase.com/dashboard/project/mtecrgoyrfclnlctenss/auth/users) y crear el primer usuario o verificar el usuario existente.
2. Confirmar su dirección de correo.
3. Abrir [SQL Editor](https://supabase.com/dashboard/project/mtecrgoyrfclnlctenss/sql/new).
4. Ejecutar la siguiente instrucción con el correo correspondiente, verificando que sea la identidad correcta:

~~~sql
update public.perfil p
set rol = 'ADMIN', activo = true
from auth.users u
where p.id = u.id
  and lower(u.email) = lower('CORREO_ADMINISTRADOR')
  and u.email_confirmed_at is not null
  and (u.banned_until is null or u.banned_until <= now())
returning p.rol, p.activo;
~~~

5. Comprobar **una fila** con `ADMIN` y `true`. El cambio se audita mediante el trigger del perfil.
6. Cerrar la sesión si ya estaba iniciada y volver a entrar a la aplicación.

**Operación recurrente:** esta consulta manual no se requiere para nuevos operadores; el administrador utiliza **Administración → Usuarios**.

## 4. Alta de familiares u operadores

1. Crear la identidad en Supabase Auth según el procedimiento de invitación/alta configurado.
2. Acceder a **Administración → Usuarios** con perfil ADMIN.
3. Identificar la cuenta pendiente, asignar `OPERADOR` o `ADMIN` y activar el acceso según sus funciones.
4. Comprobar que pueda iniciar sesión y visualizar únicamente las operaciones permitidas.
5. Para retirar el acceso, desactivar su perfil. La aplicación registra el cambio de permisos.

Evitar compartir cuentas: cada integrante debe utilizar credenciales propias.

## 5. Configurar el uso cotidiano

1. Crear razas, proveedores, categorías de producto, unidades de medida y categorías de gasto desde **Catálogos**.
2. Registrar productos, presentaciones y equivalencias comerciales antes de comprar insumos.
3. Registrar lotes y animales desde sus módulos, con DIIO válido y costos de adquisición según corresponda.
4. Confirmar compras de insumos para reflejar existencias y PMP; los borradores no alteran stock.
5. Registrar consumos, tratamientos, pesajes y operaciones de venta desde sus módulos.
6. Consultar **Solicitudes pendientes** para resolver compras/ventas en borrador.
7. Consultar **Historial y auditoría** para revisar operaciones y cambios.

## 6. Verificaciones de funcionamiento

- Al iniciar sesión, el perfil se muestra con el rol correcto.
- El botón **Actualizar** vuelve a consultar los datos de la pantalla y no modifica registros.
- Compras confirmadas crean movimientos de inventario; borradores no lo hacen.
- Un animal vendido o fallecido conserva su historial y deja de contarse como activo.
- **Animales → Sincronizar con SIPECweb** permite revisar diferencias con un `.xls` exportado por SAG en modo **solo lectura**.

## 7. Seguridad y respaldo

Mantener contraseñas individuales, una o dos cuentas administrativas y respaldos externos cifrados. El plan Free no incluye copias diarias automáticas administradas equivalentes a los planes de pago: planificar exportaciones y comprobar restauración. No cargar archivos empresariales en scripts de demostración.

Ver [arquitectura](./CLOUD_MIGRATION.md), [reglas operativas](./OPERACIONES_SUPABASE.md) y [continuidad](./PRODUCTION_READINESS.md).
