# SIPECweb — Conciliación e incorporación valorizada de animales

## 1. Alcance

SGIC-Terneros utiliza archivos **XML Spreadsheet 2003 (.xls)** exportados desde la consulta de animales presentes en SIPECweb. La integración es **manual**: el administrador descarga el archivo oficial y lo selecciona desde **Animales → Sincronizar con SIPECweb**.

El proceso se divide en dos acciones independientes:

1. **Conciliación (solo lectura):** comparar DIIO oficiales contra los registros existentes sin efectuar cambios.
2. **Incorporación supervisada:** seleccionar DIIO nuevos, elegir un tipo de ingreso, asignar lote, fecha, raza y valor económico individual, revisar y confirmar una única transacción.

No se dispone de API oficial SAG conectada a SGICweb ni se efectúa scraping del portal. No se almacenan archivos ni contraseñas de SIPECweb en el servidor.

## 2. Exportar y comparar animales

1. Acceder a SIPECweb con credenciales autorizadas.
2. Abrir la consulta de animales presentes y descargar el archivo Excel XLS.
3. Mantener el archivo original; no convertirlo a PDF, CSV ni XLSX.
4. Ingresar a SGIC-Terneros con rol ADMIN.
5. Seleccionar **Animales → Sincronizar con SIPECweb** y cargar el archivo.
6. Revisar **DIIO nuevos**, **ya registrados** y **activos en SGIC ausentes de la exportación**.
7. Revisar raza, sexo, categoría, fecha de nacimiento, establecimiento y observaciones.
8. Si solo se necesita conciliar, cerrar la pantalla. Esta primera acción no modifica registros.

La comparación se basa en el conjunto de identificadores, no en restar el total de una exportación al de otra. Un DIIO ausente no constituye una venta, fallecimiento o traslado automático.

## 3. Incorporación valorizada de DIIO nuevos

Una vez comprobados los resultados:

1. Seleccionar **Continuar: completar valores y guardar**.
2. Elegir el **tipo de ingreso**:
   - **Compra:** genera compra de animales, detalle de compra y animales activos.
   - **Existencia inicial:** registra animales con valor base; **no** genera compra.
   - **Traslado:** utiliza el costo histórico transferido; **no** genera una compra nueva.
   - **Nacimiento:** utiliza un costo base definido conforme al criterio de valorización del predio; **no** genera compra.
3. Seleccionar un lote activo o introducir un código para crear uno nuevo.
4. Revisar la fecha de incorporación y el documento de referencia opcional (FMA, folio o documento interno).
5. Para una compra, seleccionar proveedor si se dispone de él.
6. Homologar cada raza SAG con el catálogo de SGIC. Se puede escoger una raza existente o registrar la raza SAG como nueva dentro de la misma transacción.
7. En la tabla editable, seleccionar los DIIO y completar su **valor base (CLP)** uno a uno. Es posible aplicar un valor común o pegar una columna de precios en el orden visible de la selección. Los campos monetarios son de escritura directa (sin flechas ni incrementos con la rueda del ratón); admiten importes como `180000`, `180.000` y `180.000,50`.
8. Revisar el número de animales, valor total, lote y tipo de ingreso.
9. Pulsar **Paso 3: revisar y guardar animales** y aceptar el diálogo final.
10. Comprobar el resultado en Animales y en el historial. Solo los DIIO seleccionados y confirmados pasan a formar parte de SGIC.

**Reglas:** cada animal debe tener un valor económico positivo y una raza asignada. Se permiten hasta **200 DIIO por operación**. No se guarda un precio desconocido como cero ni se genera automáticamente una compra para tipos no comerciales. Si no se conoce aún el valor de un animal, su incorporación debe esperar a completar la valorización.

La aplicación verifica DIIO previamente registrados antes de llamar a la función SQL. La base aplica también una restricción de unicidad de DIIO; un error cancela toda la transacción y no incorpora un subconjunto.

## 4. Estructuras de datos y contabilidad

La migración `20261012194500_sipec_ingreso_y_venta_valorizada.sql` incorpora:

- `ingreso_sipec`: tipo, fecha, lote, proveedor cuando corresponda, referencia, cantidad, valor total, usuario responsable.
- `ingreso_sipec_animal`: relación DIIO/ingreso, valor base y campos descriptivos originales del SAG.
- La RPC `sgic_incorporar_desde_sipec`: ejecución transaccional autenticada exclusivamente para ADMIN.

Por compatibilidad con el motor económico vigente, `animal.precio_adquisicion` conserva el **valor base de incorporación**, tanto para compras como para existencias iniciales, traslados y nacimientos. En ingresos no comerciales no debe interpretarse ese valor como un pago de compra; el tipo queda explicitado en `ingreso_sipec`.

El registro inicial no crea un costo acumulado por alimentación o sanidad; esos costos se imputan mediante las operaciones normales de SGIC.

## 5. Estructura del XLS del SAG

| Campo SAG | Función |
|---|---|
| `NUMERO_DIIO` | Identificador único **como texto**, conservando ceros iniciales |
| `RAZA` | Homologación o alta de raza en catálogo |
| `SEXO` | Macho/Hembra |
| `CATEGORIA` | Categoría SAG descriptiva |
| `FECHA_NACIMIENTO` | Fecha de nacimiento, usada para cálculo de edad al ingresar |
| `ESTABLECIMIENTO` | Texto informativo; no inferir RUP de destino |
| `GLOSA_PABCO` | Dato descriptivo opcional |
| `CANTIDAD` | Campo informativo; no multiplicar el número de animales |

El parser en `frontend/src/utils/sipecSpreadsheet.ts` admite el namespace anómalo de algunas exportaciones SAG, normalizando únicamente las firmas conocidas antes de interpretarlas. Se rechazan archivos XML incompatibles, DIIO inválidos y duplicados. El archivo está limitado a 8 MB y 15.000 filas; la comparación consulta hasta 25.000 animales de SGIC.

## 6. Venta con precios individuales

En **Ventas → Venta con precios por DIIO**, un ADMIN puede seleccionar animales activos y asignar importes económicos individuales. La RPC `sgic_venta_precios_individuales` confirma la venta utilizando las mismas reglas de autorización y costo por lote, guarda precios por DIIO en `venta_precio_animal` y distribuye ingreso/utilidad de cada lote según los importes asignados.

El formulario admite hasta 200 animales por venta. La venta estándar y los borradores existentes siguen disponibles. La venta individual se confirma directamente, sin crear borrador.

## 7. Límites y responsabilidades

- Una exportación de existencias no acredita una compraventa ni el pago de un animal.
- La fecha de nacimiento no sustituye la fecha del traslado, de compra o de recepción del FMA.
- `ESTABLECIMIENTO` es el texto del archivo y no debe utilizarse como un RUP de destino verificado.
- La recepción formal del movimiento debe realizarse en SIPECweb conforme a la normativa SAG; esta función no modifica los movimientos oficiales.
- Los animales existentes en SGIC no se sobrescriben al importar otra exportación.
- El archivo XLS solo se analiza en el navegador; la RPC recibe los datos seleccionados para registrarlos.

## 8. Verificación técnica

1. Ejecutar `npm run test:sipec` y `npm run build` desde `frontend/`.
2. Comparar una exportación real y comprobar los ceros iniciales del DIIO.
3. Confirmar que la carga de archivo **sin presionar incorporar** no realice escritura alguna.
4. Verificar valores por animal, costo total, homologación, lote y tipo.
5. En un entorno controlado, probar que un ingreso inicial no cree compra y un ingreso tipo compra sí genere su detalle contable.
6. Probar rechazo de DIIO repetido y autorización insuficiente.
7. Para ventas con precios individuales, comprobar que la suma de ingresos por lote iguale la suma de precios por DIIO, y que cada animal pase a VENDIDO.
8. Utilizar pruebas SQL transaccionales revertidas o un proyecto separado; nunca dejar animales sintéticos en producción.

Fuentes: [SIPECweb SAG](https://www.sag.gob.cl/ambitos-de-accion/sistema-oficial-de-informacion-pecuaria-sipecweb) · [Manual institucional](https://www.sag.gob.cl/sites/default/files/MANUAL%20USUARIO%20EXTERNO%20TITULAR%20SIPECWEB%20OCT%202024.pdf).

## 9. Continuar después de guardar

La confirmación muestra el número de ingreso y accesos a los pasos siguientes:

1. **Ver animales guardados:** comprobar DIIO, lote y valor base en el registro.
2. **Preparar productos:** registrar categorías, unidades de medida, proveedores y productos en Catálogos con los datos reales del predio.
3. **Registrar insumos:** registrar las compras y confirmarlas para generar existencias y costo promedio. Un borrador todavía no ingresa stock.
4. **Alimentación:** registrar consumos reales por lote o configurar y asignar un plan. El consumo descuenta inventario y acumula su costo.

Los tratamientos se registran desde Sanidad y descuentan los productos utilizados. Los gastos se registran con su categoría y lote cuando corresponda. La importación de animales no inventa existencias de insumos ni costos históricos.

Verificación del 14 de octubre de 2026: incorporación inicial y por compra, valorización, conteos, rechazo atómico de DIIO duplicados, compra de insumos, stock, consumo, tratamiento y venta por DIIO comprobados mediante transacciones revertidas. Los scripts están en `supabase/tests/sipec_ingreso_venta_rollback.sql` y `supabase/tests/sipec_operacion_inicial_rollback.sql`. La aceptación desde una sesión ADMIN en navegador sigue siendo una verificación distinta.
