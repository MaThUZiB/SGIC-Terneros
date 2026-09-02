# SGIC-Terneros
> **Sistema de Gestión y Control de Inventarios para Unidades de Crianza de Terneros**

---

##  Contexto del Proyecto

La crianza y recría de terneros es una etapa crítica en la producción ganadera. Un manejo inadecuado en la alimentación, vacunación o control de insumos impacta directamente en la tasa de mortalidad, el desarrollo corporal del animal y los costos operativos de la explotación agrícola.

Para garantizar la viabilidad técnica y económica del predio, es indispensable contar con trazabilidad sobre los recursos consumidos, el stock disponible de alimento/medicamentos y los movimientos de inventario en tiempo real.

---

##  Problemática Identificada

En la gestión tradicional de criaderos de terneros es habitual encontrar las siguientes ineficiencias:

* **Registro Manual e Informal:** Dependencia de anotaciones en papel o planillas Excel descentralizadas, propensas a errores de digitación o pérdida de datos.
* **Falta de Control de Stock y Mermas:** Dificultad para rastrear el consumo real de leche, sustitutos lacteos, concentrados, vacunas y remedios, generando quiebres de stock no planificados o vencimiento de insumos.
* **Incertidumbre en Costos Operativos:** Imposibilidad de determinar con exactitud el Costo Promedio Ponderado (PMP) por insumo o el costo acumulado de alimentación y tratamiento asignado por lote o ternero.
* **Toma de Decisiones Reactiva:** Ausencia de indicadores en tiempo real que permitan anticipar compras, auditar discrepancias en bodega o evaluar la eficiencia de conversión alimenticia.

---

##  Solución Propuesta

**SGIC-Terneros** es una plataforma web modular diseñada para centralizar, automatizar y auditar la gestión de inventario y datos maestros en explotaciones de crianza de terneros.

### Objetivos Clave de la Plataforma:

1. **Gestión de Datos Maestros:** Centralización de categorías, unidades de medida (peso, volumen, dosis), presentaciones comerciales y catálogo de productos con niveles de stock crítico.
2. **Control Estricto de Movimientos:** Módulo de trazabilidad para registrar entradas (compras, recepciones), salidas (consumo por lote, aplicaciones sanitarias) y ajustes de inventario (mermas, vencimientos).
3. **Valorización de Inventario:** Cálculo automático del costo medio ponderado de insumos para reflejar el impacto financiero real del consumo.
4. **Arquitectura Escalable y Segura:** Diseñado bajo un esquema decoupling (Backend RESTful en Django 5 + Frontend en React) con autenticación por tokens (JWT), control de roles y base de datos relacional robusta (PostgreSQL).
