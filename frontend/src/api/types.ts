export interface Usuario {
  id: number
  username: string
  email: string
  first_name: string
  last_name: string
  es_administrador: boolean
  es_superuser: boolean
  grupos: string[]
}

export interface Producto {
  id: number
  nombre: string
  categoria: number
  categoria_nombre?: string
  unidad_base: number
  unidad_base_codigo?: string
  stock_actual: string
  stock_minimo: string
  costo_promedio: string
  activo: boolean
  observaciones?: string | null
}

export interface Lote {
  id: number
  codigo: string
  lote_origen?: number | null
  lote_origen_codigo?: string | null
  fecha_ingreso: string
  cantidad_original: number
  cantidad_actual: number
  estado: 'ACTIVO' | 'CERRADO'
  observaciones?: string | null
  animales_count?: number
}

export interface Animal {
  id: number
  diio: string
  lote: number
  lote_codigo?: string
  raza: number
  raza_nombre?: string
  sexo: string
  fecha_nacimiento?: string | null
  edad_aproximada_dias: number
  fecha_adquisicion: string
  precio_adquisicion: string
  peso_ingreso_kg?: string | null
  estado: 'ACTIVO' | 'VENDIDO' | 'FALLECIDO'
  observaciones?: string | null
}

export interface ResumenDashboard {
  animales_activos: number
  animales_fallecidos: number
  lotes_activos: number
  valor_inventario: number
  ventas_confirmadas_total: number
  utilidad_total: number
  stock_relevante: StockItem[]
  alertas_stock: StockItem[]
}

export interface StockItem {
  id: number
  nombre: string
  unidad_base: string
  stock_actual: number
  stock_minimo: number
  costo_promedio: number
  valor: number
  equivalencias: { presentacion: string; cantidad: number }[]
}

export interface CostoLote {
  lote_id: number
  lote_codigo: string
  estado: string
  animales_considerados: number
  animales_activos: number
  costo: {
    adquisicion: number
    alimentacion: number
    sanidad: number
    gastos_imputables: number
    costo_total: number
  }
  costo_promedio_animal: number
  venta_total: number
  costo_reconocido: number
  utilidad: number
  margen_porcentaje: number
  peso_vendido_kg: number
  utilidad_promedio_animal: number
}

export interface Paginado<T> {
  count: number
  next: string | null
  previous: string | null
  results: T[]
}