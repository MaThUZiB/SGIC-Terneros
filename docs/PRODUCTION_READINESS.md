# Control operativo, calidad y continuidad

## 1. Objetivo

Establecer verificaciones para mantener SGIC-Terneros disponible y consistente durante su uso cotidiano. El sistema utiliza Supabase Free y Cloudflare Pages, por lo que el respaldo fuera de la plataforma es una responsabilidad operativa.

## 2. Controles existentes

- Identidades de Supabase Auth y perfiles `ADMIN`/`OPERADOR` con activación explícita.
- Row Level Security en las tablas de dominio; lecturas protegidas por permisos.
- Mutaciones de negocio mediante RPC SQL que validan autorización, reglas y transacciones.
- DIIO único, restricciones de importes y cantidades, claves foráneas e índices.
- Kardex con entradas, salidas y ajustes; existencias y PMP en la tabla de productos.
- Trazabilidad de acciones y cambios de perfil en `registro_auditoria`.
- GitHub Actions: `npm run test:sipec`, `npm run build` y `npm audit --omit=dev --audit-level=high`.
- El lector SIPECweb no modifica registros ni almacena el archivo.

## 3. Checklist de puesta en servicio y revisiones periódicas

### Accesos

- [ ] Confirmar que exista al menos un ADMIN activo que pueda iniciar sesión.
- [ ] Verificar que cada integrante use una cuenta propia.
- [ ] Probar que un OPERADOR no pueda ejecutar funciones administrativas.
- [ ] Revisar usuarios inactivos y deshabilitar identidades sin uso.
- [ ] Revisar los avisos del **Security Advisor** del proyecto. La existencia de funciones `SECURITY DEFINER` expuestas a roles autenticados exige mantener sus controles internos de autorización.

### Integridad de datos

- [ ] Ejecutar las consultas de solo lectura de `supabase/tests/integrity_audit.sql`.
- [ ] Revisar stock contra kardex: `ENTRADA` suma, `SALIDA` resta y `AJUSTE` conserva el signo.
- [ ] Comprobar cantidades de lotes frente a animales activos.
- [ ] Comparar total de compras contra la suma de sus detalles.
- [ ] Revisar DIIO duplicados y productos con existencias negativas.
- [ ] Verificar que borradores no generen movimientos hasta su confirmación.

### Operación y despliegue

- [ ] Verificar que GitHub Actions concluya exitosamente antes de fusionar a `main`.
- [ ] Confirmar que Cloudflare Pages despliegue la versión correcta y que el inicio de sesión funcione.
- [ ] Probar al menos una consulta de cada módulo tras cambios estructurales.
- [ ] Cuando se modifiquen RPC, revisar conflictos de concurrencia sobre inventario y venta de DIIO.
- [ ] No considerar una compilación correcta equivalente a una prueba funcional completa en navegador.

## 4. Respaldo proporcional al uso

1. Definir quién realiza el respaldo.
2. Programar una exportación **semanal** de datos PostgreSQL y otra antes de migraciones o cambios mayores.
3. Usar el procedimiento oficial `supabase db dump` o un mecanismo compatible con el plan contratado, protegiendo las credenciales.
4. Almacenar copias cifradas fuera de Supabase, con acceso limitado.
5. Identificar fecha, proyecto y versión del esquema en cada copia.
6. Probar una restauración periódicamente en un proyecto separado y sin datos empresariales.
7. Registrar resultado y duración de la recuperación.

**No se presume que exista respaldo automático diario en Supabase Free.** Consultar [respaldos oficiales](https://supabase.com/docs/guides/platform/backups). No almacenar contraseñas ni dumps reales en GitHub.

## 5. Diagnóstico de incidentes

| Situación | Verificación inicial |
|---|---|
| No se puede iniciar sesión | Auth, correo confirmado, rol y `perfil.activo` |
| Inventario no cambia | Estado de compra, líneas y movimientos de kardex |
| Operación rechazada | Mensaje RPC, restricciones, rol y existencia disponible |
| Descuadre de lotes | Conteo de `animal` activo por `lote_id` |
| Diferencia de compra | Unidades base, presentaciones, precios y subtotales |
| Archivo SIPEC no reconocido | XML Spreadsheet 2003, namespaces normalizados y validaciones |
| Página desactualizada | Actualizar módulo o comprobar publicación de Cloudflare |

## 6. Mejoras pendientes

- Incorporación definitiva de DIIO desde SIPECweb con aprobación, lote y costo validado; **no implementada**.
- Sincronización directa con SIPECweb: **no implementada** y condicionada a un mecanismo autorizado por el SAG.
- Pruebas E2E automatizadas de navegador, recuperación completa y concurrencia real ampliada.
- Automatización de respaldos y comprobación programada de restauración.
- Evaluación de políticas adicionales de contraseñas, acceso y monitoreo según necesidades del predio.

La documentación operativa principal se encuentra en [README](../README.md), [manual de operaciones](./OPERACIONES_SUPABASE.md) y [configuración de acceso](./PRODUCTION_SETUP.md).
