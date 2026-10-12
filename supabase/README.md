# Supabase: esquema y control de acceso

**Proyecto de desarrollo:** `rsqdtslkndgtaejkaoju` (São Paulo). Las migraciones fueron aplicadas y verificadas el 12 de octubre de 2026. Se cargaron datos de demostración ficticios; no hay datos ganaderos reales.

## Migraciones SQL (orden versionado)

1. `20261012133036_initial_schema_sgic_20261012.sql`: 28 tablas, relaciones, unicidad DIIO, restricciones e historial de ventas.
2. `20261012133041_security_baseline_sgic_20261012.sql`: 28 tablas con RLS; negocio denegado a `anon` y `authenticated`; lectura del perfil propio.
3. `20261012133137_auth_profiles_roles_sgic_20261012.sql`: perfil automático al crear cuentas Auth, inactivo por defecto, auditoría de permisos en esquema privado.
4. `20261012140100_sgic_readonly_active_profiles.sql`: lectura de registros para cuentas activas; solo ADMIN consulta auditoría; escrituras directas denegadas.

Las marcas de versión de los archivos coinciden con el historial de migraciones remoto. La carpeta `seeds/` contiene exclusivamente datos opcionales para demostración, no migraciones productivas.

## Datos de prueba

Ver [documentación de datos sintéticos y primera cuenta administradora](./seeds/README.md). La contraseña no se guarda en este repositorio. Las compras de insumos están en borrador, por lo que la existencia de productos continúa en cero hasta implementar una operación de confirmación transaccional.

## Verificaciones ejecutadas

- 28 tablas creadas y 28 con RLS; ambas migraciones de base reaplicadas tras detectar que el proyecto estaba vacío al iniciar la segunda fase.
- No había cuentas Auth ni perfiles al concluir la verificación.
- `anon` y `authenticated` no pueden leer `animal`; `authenticated` no puede actualizar `perfil`, solo consultarlo mediante su propia identidad.
- Dos triggers administrativos instalados y funciones `SECURITY DEFINER` privadas, sin permiso de ejecución directo para usuarios.
- Asesor de seguridad: 27 avisos **informativos** por tablas con RLS y sin políticas; esto es intencionado hasta migrar cada módulo y abrir permisos controlados.
- La comprobación completa de alta de usuario mediante Auth real queda pendiente (no se han creado cuentas artificiales).

## Puesta en marcha de identidades

1. En Supabase Dashboard → Authentication → Users, crear o invitar la cuenta autorizada. El trigger crea el perfil como `OPERADOR` e `inactivo`.
2. Para establecer el primer administrador, ejecutar **solo en SQL Editor con privilegios administrativos**, sustituyendo el correo de ejemplo:

```sql
update public.perfil
set rol = 'ADMIN', activo = true
where id = (select id from auth.users where email = 'administrador@ejemplo.cl')
returning id, rol, activo;
```

3. Comprobar que devolvió exactamente una fila y que existe evento `PERMISOS` en `registro_auditoria`.
4. Para aprobar operadores, habilitar `activo=true` por identidad verificada mediante un procedimiento administrativo. No conceder privilegios desde formularios React.
5. Configurar `VITE_AUTH_PROVIDER=supabase`, `VITE_SUPABASE_URL` y la **clave publishable** en el entorno de frontend. Nunca usar `service_role` o contraseña de PostgreSQL.
6. El login permite ingresar solamente a usuarios con perfil activo. En modo Supabase se presenta temporalmente un portal de migración, no módulos de negocio incompletos.

## Límites de alcance

Supabase está conectado para identidad y base, **no** para movimientos reales. Los procesos de inventario/PMP, ventas, compras, consumos, costos y auditoría de transacciones empresariales requieren RPC/Edge Functions atómicas, permisos RLS específicos y pruebas de concurrencia antes de exponerse.

Antes de aplicar migraciones adicionales mediante CLI, revisar `supabase migration list` y confirmar historial del proyecto seleccionado. Nunca volver a ejecutar el esquema inicial sobre tablas existentes.

[Manual técnico en Notion](https://app.notion.com/p/3f7b5e350d7181f5957df2b6c8b54634)
