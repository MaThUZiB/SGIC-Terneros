# Supabase — migración pendiente

Este directorio inicia la migración controlada desde Django. No hay esquema productivo, autenticación conectada ni políticas RLS desplegadas.

## Reglas obligatorias

- Toda tabla expuesta por Data API debe habilitar RLS y políticas explícitas por operación.
- No almacenar `service_role`, contraseñas ni claves privadas en el frontend ni en Git.
- La lógica de stock/PMP, confirmaciones, costos y auditoría debe ejecutarse atómicamente en PostgreSQL.
- Identificar DIIO de animales vendidos, evitando seleccionar arbitrariamente los primeros por ID.
- Migraciones y pruebas deben revisarse antes de aplicar datos reales.

Ver [plan de migración](../docs/CLOUD_MIGRATION.md).
