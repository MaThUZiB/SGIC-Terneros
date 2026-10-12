# Datos de demostración para SGIC-Terneros

## Naturaleza del conjunto de pruebas

El archivo [demo_20261012.sql](./demo_20261012.sql) contiene únicamente datos **ficticios**. Se instaló en el proyecto de desarrollo de Supabase el 12/10/2026 para verificar el modelo de datos y la interfaz. No representa animales, proveedores, compras o gastos reales de una empresa.

La carga incluye 18 animales con DIIO que comienza en `DEMO-`, dos lotes, dos proveedores ficticios, seis productos, dos compras de animales, una compra de insumos en **BORRADOR**, y dos planes de consumo. No inventa movimientos confirmados ni ingresos de venta. Los precios y pesos son ejemplos.

El script cancela toda la transacción si detecta registros previos en entidades clave, para evitar contaminar una instalación con datos existentes. **No volver a ejecutarlo sobre un proyecto con información operativa**.

## Credenciales y administrador

No se incluyen contraseñas ni correos personales en el repositorio.

1. Abrir **Supabase Dashboard → Authentication → Users → Add user** y registrar un email real. Usar una contraseña larga y exclusiva, y verificar el correo cuando corresponda.
2. El trigger `sgic_auth_user_created` crea el perfil inactivo con rol `OPERADOR`.
3. En **SQL Editor** desde una sesión administrativa, activar un perfil previamente verificado:

```sql
update public.perfil p
set rol = 'ADMIN', activo = true
from auth.users u
where u.id = p.id
  and u.email = '<correo-confirmado>'
  and u.email_confirmed_at is not null
returning p.id, p.rol, p.activo;
```

Comprobar que se actualiza exactamente **una fila** y que el trigger de auditoría deja evidencia en `registro_auditoria`. No asignar rol ni credenciales desde el frontend.

4. Configurar el modo Supabase en el frontend con `VITE_AUTH_PROVIDER=supabase`, URL del proyecto y clave **publishable**. Nunca publicar `service_role`.
5. Probar inicio/cierre de sesión y rechazo de perfiles inactivos antes de pasar a producción.

## Lectura protegida

La migración `20261012140100_sgic_readonly_active_profiles.sql` habilita lecturas de tablas de dominio para perfiles activos. El registro de auditoría solo es visible a ADMIN. Se mantienen denegadas las escrituras directas desde el navegador; deberán incorporarse mediante RPC/Edge Functions con pruebas transaccionales.

## Verificaciones

- Demo cargada: 18 animales, 2 lotes, 6 productos y compras por CLP $3.220.000 en adquisición, coincidiendo entre compras y detalle de animales.
- RLS: 28 tablas protegidas; con rol `authenticated` pero sin identidad válida, **0 animales visibles**.
- Usuario anónimo: no tiene privilegio SELECT en `animal`.
- Usuario autenticado: sin permiso INSERT en `animal`.
- Comportamiento con cuenta real aún pendiente de validación.

No utilizar estas cifras para contabilidad, decisiones ganaderas ni evaluación financiera.
