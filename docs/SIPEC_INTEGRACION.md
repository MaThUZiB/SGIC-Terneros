# SIPECweb — conciliación de animales por DIIO

## 1. Objetivo y alcance

La función **Animales → Sincronizar con SIPECweb** permite revisar una exportación de animales del SAG y contrastar los DIIO del documento con los animales registrados en SGIC-Terneros.

**Implementado:** carga de archivo, validación del formato, detección de duplicados y previsualización de diferencias. **No implementado:** incorporación definitiva desde el archivo, modificación automática de estados ni consulta directa a servicios del SAG.

El archivo se procesa localmente en el navegador; no se sube ni se almacena en Supabase. La base solo recibe consultas de lectura de DIIO y estado de animales autorizadas por RLS.

## 2. Exportación desde SIPECweb

1. Ingresar al portal SIPECweb con la cuenta SAG autorizada para el predio.
2. Acceder a la consulta de animales y generar la exportación **Excel (.xls)** de animales presentes.
3. Guardar el archivo sin modificar los DIIO y sin convertir a CSV/PDF.
4. Volver a SGIC-Terneros e iniciar sesión con perfil `ADMIN`.
5. Entrar a **Animales → Sincronizar con SIPECweb**.
6. Elegir el archivo `.xls` o su equivalente `.xml` y esperar el procesamiento.
7. Revisar los contadores y las tablas de DIIO nuevos, existentes y ausentes.
8. Cerrar el formulario al terminar; no se confirman cambios empresariales.

## 3. Formato admitido

**Contenedor:** XML Spreadsheet 2003 (texto XML con extensión `.xls`); no es un libro Excel binario ni `.xlsx`. El parser está en `frontend/src/utils/sipecSpreadsheet.ts`; la vista en `frontend/src/pages/SipecSyncPreview.tsx`.

Campos:

| Columna SAG | Uso en SGIC |
|---|---|
| `NUMERO_DIIO` | Identificador individual, validado y almacenado temporalmente como **texto** |
| `RAZA` | Dato descriptivo para futura homologación |
| `SEXO` | Información asociada al animal |
| `CATEGORIA` | Categoría pecuaria SAG, visible en la comparación |
| `FECHA_NACIMIENTO` | Fecha normalizada cuando es válida |
| `ESTABLECIMIENTO` | Referencia textual de la exportación; no se interpreta como RUP destino |
| `GLOSA_PABCO` | Dato descriptivo opcional |
| `CANTIDAD` | Campo informativo de la exportación; **no** representa un alta múltiple por cada fila |

El parser verifica la presencia de los encabezados esenciales, fechas, DIIO numéricos de 7 a 15 cifras y duplicados. Los DIIO conservan todos los ceros iniciales. Se limita la carga a 8 MB, 15.000 filas XML y la comparación contra un máximo de 25.000 registros SGIC; la tabla muestra hasta 100 filas por vista.

**Compatibilidad SAG:** algunas exportaciones utilizan una etiqueta preliminar `<xml version>` y espacios internos en `xmlns:x`. El lector normaliza **solo esas firmas conocidas** antes de interpretar el XML, sin alterar valores de celdas. La regresión está cubierta por `frontend/tests/sipecSpreadsheet.test.mjs` y `npm run test:sipec`.

## 4. Criterio de conciliación

Sea `E` el conjunto de DIIO exportados en el archivo y `S` el conjunto registrado en SGIC:

- **DIIO nuevos:** `E − S`; presentes en el archivo y no registrados en SGIC.
- **Ya registrados:** `E ∩ S`; aparecen en ambos sistemas.
- **Ausentes de la exportación:** DIIO de `S` con estado ACTIVO no contenidos en `E`. **No** se marcan automáticamente como vendidos, trasladados o fallecidos.

La comparación utiliza identificadores, **no** restas de cantidades totales. Una exportación posterior puede tener animales nuevos y otros ausentes simultáneamente.

## 5. Interpretación operativa y límites

- La exportación de animales presentes es una instantánea de consulta; no acredita por sí sola una compra, el pago de un animal ni la recepción administrativa de un FMA.
- No se puede inferir del archivo una fecha de traslado, RUP de origen/destino, número de FMA, proveedor o costo pagado.
- La presencia en SGIC debe reconciliarse con la recepción oficial de movimientos en SIPECweb: animales en tránsito no equivalen automáticamente a existencias recepcionadas.
- Para incorporar DIIO en una etapa futura deberán resolverse: homologación de razas, lote interno, fecha y costo de adquisición, control de duplicados y confirmación explícita transaccional.
- No se almacena contraseña SAG ni se efectúa scraping del portal.

## 6. Pruebas

1. Utilizar una exportación `.xls` válida y comprobar que los DIIO conservan ceros iniciales.
2. Confirmar el número de animales válidos y las observaciones de validación.
3. En una base sin animales, comprobar que todos los DIIO del archivo figuren como nuevos.
4. Ejecutar nuevamente la misma exportación y verificar que el proceso no añada animales.
5. Probar un archivo corrupto o en formato no admitido y verificar el mensaje controlado.
6. Ejecutar `npm run test:sipec` y `npm run build`.

## 7. Interoperabilidad oficial

No hay una API SAG pública integrada en SGIC. Una sincronización automática requeriría confirmar ante el SAG un servicio o convenio de interoperabilidad autorizado para el RUP. La modalidad operativa disponible es la exportación manual desde SIPECweb más comparación asistida en SGIC.

Fuentes institucionales: [SIPECweb SAG](https://www.sag.gob.cl/ambitos-de-accion/sistema-oficial-de-informacion-pecuaria-sipecweb) y [Manual SIPECweb para titulares de RUP](https://www.sag.gob.cl/sites/default/files/MANUAL%20USUARIO%20EXTERNO%20TITULAR%20SIPECWEB%20OCT%202024.pdf).
