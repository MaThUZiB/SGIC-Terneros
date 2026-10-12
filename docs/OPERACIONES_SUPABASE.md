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

En escritorio la navegación es lateral fija; en pantallas pequeñas se abre desde el botón de menú. Las tarjetas del resumen enlazan a los módulos correspondientes. **Actualizar** vuelve a consultar los datos desde Supabase sin ejecutar altas, modificaciones ni bajas.

## 2. Roles de acceso

- **Administrador (ADMIN):** crea catálogos, registra compras de animales e insumos, bajas, divisiones, ajustes, rectificaciones, gastos y ventas; autoriza solicitudes y usuarios; revisa SIPECweb.
- **Operador (OPERADOR):** registra pesajes, consumos manuales o desde plan y tratamientos sanitarios; consulta registros permitidos.
- Las funciones SQL validan la identidad y los permisos del perfil. Ocultar un botón no es el mecanismo de protección de datos.

## 3. Preparación de datos maestros

1. Entrar con una cuenta ADMIN.
2. En **Catálogos**, crear razas, proveedores, unidades y categorías relevantes.
3. Registrar productos con unidad base y stock mínimo.
4. En **Inventario**, crear presentaciones comerciales y conversiones cuando correspondan.
5. En **Alimentación**, crear planes, añadir sus productos y asignarlos a lotes activos cuando existan.

Las categorías y las unidades tienen que corresponder al uso real; registrar una presentación comercial no equivale a comprar stock.

## 4. Animales y lotes

### Registrar adquisición de animales

1. Abrir **Animales → Comprar animales**.
2. Seleccionar lote existente o indicar un código para lote nuevo, según la operación autorizada.
3. Elegir proveedor si procede, fecha y raza, e introducir DIIO único, sexo, edad aproximada, precio de adquisición y peso inicial opcional.
4. Para una compra de varios animales, agregarlos a la lista del formulario y revisar cada DIIO y su precio.
5. Confirmar el registro. La operación crea compra, detalle, animales y estado de lote dentro de una misma transacción mediante `sgic_registrar_compra_animales`.
6. Consultar el listado de animales y la compra registrada.

Las entradas por DIIO no deben confundirse con SIPECweb: **Sincronizar con SIPECweb** solo compara archivos oficiales y no crea compras.

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

### Consumo real de alimentación

1. Abrir **Alimentación → Registrar consumo**.
2. Seleccionar lote activo, producto, cantidad en unidad base y fecha.
3. Registrar. Se descuenta stock al PMP vigente y se imputa costo al lote.

### Consumo desde plan

1. Crear el plan y su composición mediante **Alimentación → Crear plan** y **Añadir alimento al plan**.
2. Asignarlo a un lote activo y registrar el inicio.
3. En **Aplicar plan**, seleccionar la asignación y fecha.
4. El procedimiento `sgic_consumo_desde_plan` genera consumo y salidas del inventario según los detalles del plan; no debe registrarse dos veces la ejecución del mismo plan y fecha.

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

### Borrador de venta

1. Abrir **Ventas → Solicitar venta** y seleccionar los DIIO y condiciones económicas.
2. Guardar como borrador: los animales siguen activos.
3. Un ADMIN resuelve la solicitud en **Solicitudes pendientes** mediante confirmación o anulación.

**Solicitudes pendientes** gestiona actualmente **solo compras de insumos y ventas en borrador**; otras operaciones no utilizan un flujo general de aprobación.

### Informes

- **Rentabilidad:** consulta costos e ingresos acumulados por lote.
- **Historial y auditoría:** permite revisar eventos de creación, confirmación, baja, ajustes y autorizaciones conforme a los permisos.
- El costo reconocido de ventas parciales no debe duplicarse en sucesivas operaciones.

## 8. Conciliación SIPECweb

1. Exportar el `.xls` desde SIPECweb.
2. En **Animales → Sincronizar con SIPECweb**, cargarlo con cuenta ADMIN.
3. Revisar DIIO nuevos, existentes, ausentes y observaciones.
4. Cerrar el panel o elegir otro archivo.

**No se ejecuta ninguna mutación de animales.** La ausencia en el Excel no se traduce en venta, fallecimiento ni traslado. Ver [manual SIPECweb](./SIPEC_INTEGRACION.md).

## 9. Comprobaciones y resolución de errores

- **Acceso denegado:** comprobar cuenta Auth, correo confirmado, perfil activo y rol.
- **DIIO ya existente:** cotejar el identificador en Animales antes de registrar la adquisición.
- **Stock insuficiente:** comprobar compras confirmadas, presentaciones y movimientos; un borrador no modifica existencias.
- **Importe incoherente:** revisar la unidad base frente a la presentación comercial.
- **Error de archivo SIPEC:** verificar exportación XML Spreadsheet 2003 (`.xls`), límites y columnas.
- **Datos de pantalla desactualizados:** pulsar **Actualizar**, que únicamente recarga las consultas.

Las pruebas de integridad se documentan en [controles productivos](./PRODUCTION_READINESS.md); no ejecutar scripts de semillas en producción.
