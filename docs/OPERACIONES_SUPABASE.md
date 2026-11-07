# Manual de operación — SGIC-Terneros

Este documento describe la operación vigente sobre React/Vite y Supabase. Las acciones están integradas en cada módulo de la barra lateral. Los formularios con transacciones irreversibles muestran una confirmación integrada en la aplicación; cerrar la ventana mediante **×** descarta solamente la edición local no enviada.

## 1. Navegación

| Área | Módulos |
|---|---|
| General | Resumen |
| Ganadería | Animales, Lotes |
| Abastecimiento | Inventario, Compras, Solicitudes pendientes |
| Producción | Alimentación, Sanidad |
| Finanzas | Ventas, Gastos, Rentabilidad |
| Administración | Catálogos, Historial y auditoría, Usuarios |

En escritorio la navegación es lateral fija; en pantallas pequeñas se abre desde el botón de menú. Cada módulo presenta una acción principal y registros compactos; las opciones menos frecuentes, columnas adicionales e información económica se muestran al abrir sus detalles. Al abrir un formulario se oculta el listado de ese módulo para evitar funciones repetidas. **Actualizar** vuelve a consultar los datos desde Supabase sin ejecutar altas, modificaciones ni bajas.

## 2. Roles de acceso

- **Administrador (ADMIN):** crea catálogos, registra compras de animales e insumos, bajas, divisiones, ajustes, rectificaciones, gastos y ventas; autoriza solicitudes y usuarios; compara exportaciones SIPECweb e incorpora animales supervisadamente.
- **Operador (OPERADOR):** registra consumos aproximados por período y tratamientos sanitarios; consulta los registros permitidos. Los pesajes se gestionan desde la ficha del animal según los permisos de cada acción.
- Las funciones SQL validan la identidad y los permisos del perfil. Ocultar un botón no es el mecanismo de protección de datos.

## 3. Preparación de datos maestros

1. Entrar con una cuenta ADMIN.
2. En **Catálogos**, crear razas, proveedores, unidades y categorías relevantes.
3. Registrar productos con unidad base y stock mínimo.
4. En **Inventario**, crear presentaciones comerciales y conversiones cuando correspondan.
5. En **Alimentación**, registrar consumos consolidados por lote y rango de fechas; no se crean recetas diarias ni se asignan planes.

Las categorías y las unidades tienen que corresponder al uso real; registrar una presentación comercial no equivale a comprar stock.

## 4. Animales y lotes

### Registrar adquisición de animales

1. Abrir **Animales → Comprar animales**.
2. Seleccionar lote existente o indicar un código para lote nuevo, según la operación autorizada.
3. Elegir proveedor si procede, fecha y raza, e introducir DIIO único, sexo, edad aproximada, precio de adquisición y peso inicial opcional.
4. Para una compra de varios animales, agregarlos a la lista del formulario y revisar cada DIIO y su precio.
5. Confirmar el registro. La operación crea compra, detalle, animales y estado de lote dentro de una misma transacción mediante `sgic_registrar_compra_animales`.
6. Consultar el listado de animales y la compra registrada.

La compra manual sigue disponible como alternativa. **Sincronizar con SIPECweb** permite además incorporar DIIO nuevos mediante un proceso separado que distingue compras de existencias iniciales, traslados y nacimientos.

### Registrar pesaje

1. Abrir **Animales → Registrar pesaje**.
2. Elegir DIIO, peso en kg y fecha.
3. Guardar y comprobar el historial de pesajes.

### Fallecimiento, rectificación y división

- **Fallecimiento (ADMIN):** identificar el DIIO y detallar causa/motivo, revisar el diálogo de confirmación. El animal pasa a `FALLECIDO` y deja de contarse como activo.
- **Rectificación (ADMIN):** seleccionar animal, indicar sexo válido y justificar la corrección. Se conserva el DIIO y costo de adquisición.
- **Lotes → Dividir lote (ADMIN):** elegir lote origen, nuevo código y animales seleccionados; no se permite la división cuando existen antecedentes de costos/ventas que impidan una atribución correcta.
- El listado de animales permite filtrar `TODOS`, `ACTIVO`, `FALLECIDO` y `VENDIDO`; los fallecidos tienen diferenciación visual.

## 5. Compras de insumos e inventario

### Compra con confirmación inmediata

1. En **Compras → Comprar insumos**, seleccionar proveedor, producto y opcionalmente presentación.
2. Introducir cantidad, precio por presentación (o unidad base cuando no se usa presentación), documento y fecha.
3. Añadir las líneas necesarias; comprobar equivalencias de cantidad base, importes y total.
4. Seleccionar **confirmar ahora**, revisar el diálogo de confirmación y registrar.
5. Comprobar la compra y **Inventario**: la operación `sgic_comprar_insumo` actualiza stock, kardex y PMP de forma atómica.

### Borrador y aprobación

1. Al registrar la compra, seleccionar el modo **borrador**.
2. El borrador conserva detalles, pero **no incrementa existencias**.
3. Un ADMIN entra en **Solicitudes pendientes**, revisa las líneas y confirma o anula.
4. La confirmación ejecuta `sgic_confirmar_compra_insumo`; la anulación de borrador utiliza `sgic_anular_borrador_insumo`.

### Ajuste de inventario

1. Abrir **Inventario → Ajustar stock**.
2. Elegir producto, indicar variación positiva/negativa y motivo obligatorio.
3. Confirmar la operación.
4. Comprobar existencias y movimiento de kardex. La operación no admite stock final negativo.

El **precio medio ponderado** se calcula sobre cantidades base:  
`PMP = (existencia anterior × PMP anterior + cantidad de entrada × costo unitario base) / existencia final`.  
El saldo se concilia como `entradas − salidas + ajustes firmados`; los registros de tipo `SALIDA` se guardan con cantidad positiva y deben restarse para conciliar.

## 6. Alimentación y sanidad

### Registrar alimentación mediante suministros (vigente)

1. Entrar en **Alimentación** y pulsar **Registrar alimentación**.
2. Elegir el lote y las fechas desde/hasta. Se puede reconstruir una semana anterior a la incorporación de los DIIO.
3. La frecuencia inicial es **2 suministros al día** para el lote completo. “Suministro” designa cada entrega de leche o concentrado; “toma” suele usarse específicamente para la leche.
4. Seleccionar los insumos y escribir la **cantidad por suministro**, no por ternero. Opcionalmente usar presentaciones (sacos); SGIC convierte automáticamente a la unidad base.
5. SGIC calcula la **cantidad total de cada insumo = cantidad por suministro × 2 × días inclusivos**. Ejemplo: 3 kg por suministro durante 7 días equivalen a 42 kg para ese lote. El costo se muestra como orientativo según el PMP.
6. Si se desea repetir la combinación, un administrador puede usar **Guardar esta combinación como pauta reutilizable**. Otros usuarios pueden cargarla como base desde **Usar una pauta guardada**. Archivar una pauta conserva el historial.
7. Elegir el **tipo de registro**:
   - **Planificación (sin exigir stock):** permite meses futuros y almacena una previsión. Nunca reserva ni descuenta productos, incluso si se proyecta una demanda superior al inventario actual.
   - **Consumo realizado (descontar stock):** requiere fechas finalizadas y stock suficiente; registra el total como salida única y como costo real del lote.
   - **Estimación histórica (sin descuento):** permite reconstruir períodos pasados sin modificar stock ni rentabilidad.
8. Revisar las cantidades. En modo planificación, SGIC muestra la demanda proyectada acumulada de los lotes, las existencias y el **faltante estimado**, que es solo un aviso y nunca impide guardar.
9. Confirmar y revisar el historial. Una planificación puede coexistir con el consumo confirmado de las mismas fechas; el stock se descuenta únicamente por la operación real.

**Caso de ejemplo:** tres lotes planifican en conjunto **1000 kg de leche**, mientras que el inventario tiene **200 kg**. Se registran los tres planes y un faltante orientativo de **800 kg**, sin alterar las 200 unidades existentes. Posteriormente los consumos reales se descuentan conforme se registren y exista stock suficiente.

Los cálculos se ejecutan de nuevo en PostgreSQL. Se rechazan planes solapados del mismo lote, consumos confirmados duplicados, y salidas reales que excedan el inventario. **La tarea automática diaria antigua no está activa.**

### Tratamiento sanitario

1. En **Sanidad → Registrar tratamiento**, seleccionar DIIO activo y producto sanitario.
2. Indicar cantidad, fecha y motivo.
3. Registrar. Se descuenta el producto y se imputa su costo al animal.

## 7. Gastos, ventas y rentabilidad

### Gastos

1. Entrar en **Gastos → Registrar gasto**.
2. Seleccionar categoría, lote si corresponde, concepto, monto y fecha.
3. Registrar y revisar el listado de gastos.

### Venta confirmada

1. Abrir **Ventas → Registrar venta**.
2. Seleccionar los DIIO activos correspondientes.
3. Introducir comprador si procede, monto y fecha.
4. Revisar la confirmación. El procedimiento de venta confirma ingreso y costo reconocido, marca los animales `VENDIDO` e impide vender el mismo DIIO nuevamente.

### Venta con precio individual por DIIO

1. Entrar a **Ventas → Venta con precios por DIIO** como ADMIN.
2. Filtrar por DIIO o lote y seleccionar los animales activos.
3. Introducir comprador opcional y fecha.
4. Completar la columna editable **Precio venta**, o aplicar un precio común a los seleccionados.
5. Revisar el ingreso total y el cuadro de confirmación.
6. Confirmar la venta. Se guardan los precios individuales, se reconocen costos y utilidad por lote y los animales quedan `VENDIDO`.

Este flujo confirma directamente; los borradores corresponden al formulario **Solicitar venta**.

### Borrador de venta

1. Abrir **Ventas → Solicitar venta** y seleccionar los DIIO y condiciones económicas.
2. Guardar como borrador: los animales siguen activos.
3. Un ADMIN resuelve la solicitud en **Solicitudes pendientes** mediante confirmación o anulación.

**Solicitudes pendientes** gestiona actualmente **solo compras de insumos y ventas en borrador**; otras operaciones no utilizan un flujo general de aprobación.

### Informes

- **Rentabilidad:** consulta costos e ingresos acumulados por lote.
- **Historial y auditoría:** permite revisar eventos de creación, confirmación, baja, ajustes y autorizaciones conforme a los permisos.
- El costo reconocido de ventas parciales no debe duplicarse en sucesivas operaciones.

## 8. Conciliación e incorporación desde SIPECweb

1. Exportar el `.xls` oficial desde SIPECweb.
2. En **Animales → Sincronizar con SIPECweb**, cargarlo con cuenta ADMIN.
3. Revisar los DIIO nuevos, existentes, ausentes y observaciones. **Esta comparación no escribe datos.**
4. Seleccionar **Incorporar DIIO nuevos con valorización**.
5. Elegir tipo de ingreso: Compra, Existencia inicial, Traslado o Nacimiento.
6. Elegir lote, fecha y documento opcional. En Compra puede seleccionarse un proveedor.
7. Homologar razas y completar el valor base de cada DIIO en la tabla editable. Se permite aplicar un mismo precio o pegar una columna de importes.
8. Revisar y confirmar la operación. El sistema valida los DIIO de nuevo y registra ingreso, animales, valor base y actualización del lote en una transacción.
9. Comprobar el resultado en Animales y en Auditoría.

Solo el tipo **Compra** genera `compra_animal` y su detalle. Otros tipos guardan el valor económico base sin simular una compraventa. La ausencia del DIIO en el XLS no genera bajas; los animales con valor desconocido no se confirman como cero.

Ver [manual SIPECweb](./SIPEC_INTEGRACION.md).

## 9. Comprobaciones y resolución de errores

- **Acceso denegado:** comprobar cuenta Auth, correo confirmado, perfil activo y rol.
- **DIIO ya existente:** cotejar el identificador en Animales antes de registrar la adquisición.
- **Stock insuficiente:** comprobar compras confirmadas, presentaciones y movimientos; un borrador no modifica existencias.
- **Importe incoherente:** revisar la unidad base frente a la presentación comercial.
- **Error de archivo SIPEC:** verificar exportación XML Spreadsheet 2003 (`.xls`), límites y columnas.
- **Datos de pantalla desactualizados:** pulsar **Actualizar**, que únicamente recarga las consultas.

Las pruebas de integridad se documentan en [controles productivos](./PRODUCTION_READINESS.md); no ejecutar scripts de semillas en producción.
