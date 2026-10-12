# Migraciones Supabase de SGIC-Terneros

Estado: **esquema inicial versionado, aún no aplicado ni validado en un proyecto Supabase**. El backend Django continúa siendo la implementación operativa de referencia.

## Orden

1. `supabase/migrations/20261012140000_initial_schema.sql`: 28 tablas de dominio, identificadores, claves foráneas, controles de estado y cantidad, DIIO único, relaciones de venta individual y auditoría.
2. `supabase/migrations/20261012140100_security_baseline.sql`: activa Row Level Security y revoca acceso directo desde los roles públicos `anon` y `authenticated` sobre las tablas empresariales. Solo permite que un usuario autenticado consulte su propio perfil.

**Advertencia:** No insertar datos de operación real aún. Faltan funciones transaccionales, autorización administrativa, semillas de datos, pruebas automatizadas y conversión del frontend. El estado de seguridad es deliberadamente restrictivo.

## Aplicación futura

Para un **proyecto Supabase de desarrollo vacío**, verificar primero que no existan tablas con estos nombres y confirmar que el esquema esté listo:

```bash
supabase login
supabase link --project-ref <id-del-proyecto-de-desarrollo>
supabase db push
```

No ejecutar `db push` contra una base productiva ni copiar información real hasta completar auditoría, backup y prueba de restauración.

## Validaciones mínimas

- SQL válido y sin relaciones faltantes; verificación en una instancia PostgreSQL limpia con Supabase.
- `animal.diio` único; lote original y derivado; FK correctas.
- Restricciones de cantidad, precios, estados y movimientos.
- Usuario anónimo: ninguna tabla del negocio accesible.
- Usuario autenticado: solo lectura de su propio perfil; no puede modificar `rol`.
- Ventas parciales: vinculación individual a `animal_venta`; costos consistentes sin doble reconocimiento (pendiente implementación).
- Inventario y auditoría: operaciones atómicas en funciones confiables (pendiente implementación).

## Reglas de implementación

No exponer claves privilegiadas a React. Definir RLS y `GRANT` explícitos antes de exponer cada operación. Las funciones con `SECURITY DEFINER` deberán tener `search_path` seguro y verificaciones de rol en servidor. Mantener migraciones secuenciales y no modificar migraciones ya aplicadas.

[Manual de arquitectura en Notion](https://app.notion.com/p/3f7b5e350d7181f5957df2b6c8b54634).
