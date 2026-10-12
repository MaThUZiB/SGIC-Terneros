# Evaluación preliminar: integración SAG SIPECweb con SGIC-Terneros

**Estado:** estudio de factibilidad, **no implementada**. La posibilidad de consultar el RUP automáticamente depende de un mecanismo de acceso oficialmente autorizado por el SAG.

## Necesidad

Al recibir un movimiento de animales de otro establecimiento hacia el **Rol Único Pecuario (RUP)** del predio familiar, SGIC debería poder identificar los bovinos asociados a la transferencia y proponer su incorporación por DIIO sin tener que transcribir uno a uno.

## Evidencia disponible del SAG

- SIPECweb permite a titulares de establecimiento gestionar movimientos, existencias, DIIO y predios con RUP: [SAG — SIPECweb](https://www.sag.gob.cl/ambitos-de-accion/sistema-oficial-de-informacion-pecuaria-sipecweb).
- Los movimientos entre RUP se respaldan mediante **Formulario de Movimiento Animal (FMA)**, en formatos individual (DIIO) o por lote: [SAG — Registro de Movimiento Animal](https://www.sag.gob.cl/ambitos-de-accion/registro-de-movimiento-animal).
- El SAG indica que el FMA electrónico se registra en el establecimiento destino, y que existen plazos para rechazar/corregir movimientos: [SAG — Obtener FMA](https://www.sag.gob.cl/guia-de-tramite/obtencion-del-formulario-de-movimiento-animal-fma).
- El [Manual SIPECweb para titulares de RUP, octubre 2024](https://www.sag.gob.cl/sites/default/files/MANUAL%20USUARIO%20EXTERNO%20TITULAR%20SIPECWEB%20OCT%202024.pdf) documenta **Exportar a Excel** desde *Establecimientos → Consultar Información → Animales vivos presentes* (pág. 94), *Movimientos de animales con DIIO → Entrada/Salida* (pág. 97), y *Identificación animal con DIIO → Consulta animales (exportar datos)* (pág. 84). Es viable un importador de archivos Excel autorizado sin usar credenciales SAG en el frontend.
- El mismo manual explica que para **Recepción movimientos animales con DIIO** hay que seleccionar los FMA *en tránsito* y recepcionarlos (págs. 131–132). El DIIO permanece asignado al origen en SIPEC hasta esa recepción. SGIC debe distinguir movimientos anunciados de animales oficialmente presentes.
- La documentación pública consultada **no expone una API oficial de consulta de movimientos para desarrolladores de software privados**. Esto no demuestra que no exista una integración privada o por convenio; se debe consultar al SAG: [Acceso oficial a SIPECweb](https://www.sag.gob.cl/ambitos-de-accion/acceso-directo-sipecweb).

## Integración recomendable, por etapas

1. **Importación Excel oficialmente disponible:** permitir al titular iniciar sesión en SIPECweb, consultar los animales vivos presentes o los movimientos de **Entrada** del RUP y pulsar **Exportar**. En SGIC, cargar ese `.xlsx`, previsualizar las columnas y confirmar el lote de DIIO. Guardar fecha de exportación y evitar sobrescribir datos internos. FMA asistido como respaldo.
2. **Conciliación:** cotejar RUP de destino, folio FMA cuando figure en el archivo, DIIO y estado de recepción. Usar estados `EN_TRANSITO`, `RECIBIDO_SAG` y `INCORPORADO_SGIC`. **No registrar como presente** un animal con FMA no recepcionado por destino. Detectar DIIO duplicados antes de aplicar, con operación auditada y transaccional.
3. **Separar traslado de compra:** un FMA registra el movimiento oficial, no el precio pagado. Precio, proveedor, lote interno, peso y estado comercial se capturan aparte, nunca se infieren del SAG. No registrar una compra por cada movimiento automáticamente.
4. **Sincronización oficial futura:** preguntar a la oficina SAG de la jurisdicción o a soporte SIPECweb si hay API, web service, convenio o exportación de movimientos **recibidos por RUP** para titulares. Si la respuesta es positiva, implementar adaptador server-side con autorización formal, mínimo alcance, paginación y control de duplicados `(RUP destino, folio FMA, DIIO)`. No colocar credenciales SIPEC en React ni Supabase público.
5. **Evitar scraping automático y guardar credenciales SAG** hasta tener consentimiento y autorización institucional. El SAG es el registro oficial y SGIC es una réplica auxiliar interna.

## Preguntas concretas para el SAG

«Somos titulares de un predio con RUP y desarrollamos una aplicación interna de administración ganadera. ¿SIPECweb dispone de API, web service o exportación (CSV/XLSX) autorizada para consultar formularios FMA recibidos en nuestro RUP y sus DIIO? En caso afirmativo, ¿qué requisitos de autorización y documentación técnica se exigen a un desarrollador tercero?»

**Decisión:** diseñar ahora la estructura de conciliación e importación manual solo si el titular la prioriza; no programar llamadas directas a endpoints internos no documentados.
