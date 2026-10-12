# Evaluación preliminar: integración SAG SIPECweb con SGIC-Terneros

**Estado:** estudio de factibilidad, **no implementada**. La posibilidad de consultar el RUP automáticamente depende de un mecanismo de acceso oficialmente autorizado por el SAG.

## Necesidad

Al recibir un movimiento de animales de otro establecimiento hacia el **Rol Único Pecuario (RUP)** del predio familiar, SGIC debería poder identificar los bovinos asociados a la transferencia y proponer su incorporación por DIIO sin tener que transcribir uno a uno.

## Evidencia disponible del SAG

- SIPECweb permite a titulares de establecimiento gestionar movimientos, existencias, DIIO y predios con RUP: [SAG — SIPECweb](https://www.sag.gob.cl/ambitos-de-accion/sistema-oficial-de-informacion-pecuaria-sipecweb).
- Los movimientos entre RUP se respaldan mediante **Formulario de Movimiento Animal (FMA)**, en formatos individual (DIIO) o por lote: [SAG — Registro de Movimiento Animal](https://www.sag.gob.cl/ambitos-de-accion/registro-de-movimiento-animal).
- El SAG indica que el FMA electrónico se registra en el establecimiento destino, y que existen plazos para rechazar/corregir movimientos: [SAG — Obtener FMA](https://www.sag.gob.cl/guia-de-tramite/obtencion-del-formulario-de-movimiento-animal-fma).
- La documentación pública consultada **no expone una API oficial de consulta de movimientos para desarrolladores de software privados**. Esto no demuestra que no exista una integración privada o por convenio; se debe consultar al SAG: [Acceso oficial a SIPECweb](https://www.sag.gob.cl/ambitos-de-accion/acceso-directo-sipecweb).

## Integración recomendable, por etapas

1. **FMA asistido, sin acceso automático al SAG:** incluir módulo «Movimientos SAG» con RUP del predio, RUP origen, folio de FMA, fecha de llegada, tipo de movimiento e identificadores DIIO. Permitir revisar el conjunto antes de incorporarlo. Aceptar importación estructurada solo si SIPECweb ofrece una exportación autorizada; en otro caso, carga por FMA, incluso pegado de varios DIIO, sin prometer lectura automatizada de PDF.
2. **Conciliación:** consulta local de DIIO existentes; rechazo de duplicados; cotejo RUP destino y folio; movimiento `PENDIENTE`, `REVISADO` y `APLICADO`. Solo al confirmar se agregan los animales, con registro de auditoría y transacción atómica.
3. **Separar traslado de compra:** un FMA registra el movimiento oficial, no el precio pagado. Precio, proveedor, lote interno, peso y estado comercial se capturan aparte, nunca se infieren del SAG. No registrar una compra por cada movimiento automáticamente.
4. **Sincronización oficial futura:** preguntar a la oficina SAG de la jurisdicción o a soporte SIPECweb si hay API, web service, convenio o exportación de movimientos **recibidos por RUP** para titulares. Si la respuesta es positiva, implementar adaptador server-side con autorización formal, mínimo alcance, paginación y control de duplicados `(RUP destino, folio FMA, DIIO)`. No colocar credenciales SIPEC en React ni Supabase público.
5. **Evitar scraping automático y guardar credenciales SAG** hasta tener consentimiento y autorización institucional. El SAG es el registro oficial y SGIC es una réplica auxiliar interna.

## Preguntas concretas para el SAG

«Somos titulares de un predio con RUP y desarrollamos una aplicación interna de administración ganadera. ¿SIPECweb dispone de API, web service o exportación (CSV/XLSX) autorizada para consultar formularios FMA recibidos en nuestro RUP y sus DIIO? En caso afirmativo, ¿qué requisitos de autorización y documentación técnica se exigen a un desarrollador tercero?»

**Decisión:** diseñar ahora la estructura de conciliación e importación manual solo si el titular la prioriza; no programar llamadas directas a endpoints internos no documentados.
