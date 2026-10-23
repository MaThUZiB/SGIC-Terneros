import test from 'node:test'
import assert from 'node:assert/strict'
import { calcularSeguimientoLote, asignacionEnFecha } from '../src/utils/feedingTracking.ts'

const snapshot = [{id:2,producto_id:5,cantidad_diaria:4,unidad_id:1}]
const base={id:10,lote_id:1,plan_id:3,fecha_inicio:'2026-10-20',fecha_fin:null,activo:true,observaciones:null,componentes:snapshot}

test('una asignación por sí sola nunca registra consumos ni costos',()=>{
  const report=calcularSeguimientoLote(1,[base],[],[],'2026-10-22')
  assert.equal(report.diasProgramados,3)
  assert.equal(report.diasSinRegistro,3)
  assert.equal(report.productos[0].planificado,12)
  assert.equal(report.productos[0].realTotal,0)
  assert.equal(report.costoTotal,0)
})

test('suma consumos confirmados y manuales sin duplicar días con registro',()=>{
  const c=[{id:1,lote_id:1,fecha:'2026-10-20',origen:'PLAN',observaciones:'PLAN_ASIGNACION:10'},
    {id:2,lote_id:1,fecha:'2026-10-20',origen:'REAL',observaciones:null},
    {id:3,lote_id:1,fecha:'2026-10-22',origen:'PLAN',observaciones:'PLAN_ASIGNACION:10'}]
  const d=[{id:1,consumo_id:1,producto_id:5,cantidad:4,costo_total:500},
    {id:2,consumo_id:2,producto_id:5,cantidad:1,costo_total:100},
    {id:3,consumo_id:3,producto_id:5,cantidad:3,costo_total:400}]
  const report=calcularSeguimientoLote(1,[base],c,d,'2026-10-22')
  assert.equal(report.diasRegistrados,2)
  assert.equal(report.diasSinRegistro,1)
  assert.equal(report.diasConfirmadosPlan,2)
  assert.equal(report.productos[0].realDurantePlan,8)
  assert.equal(report.costoTotal,1000)
})

test('cambio de plan excluye días anteriores y conserva los valores originales',()=>{
  const previo={...base,id:10,fecha_fin:'2026-10-21',activo:false}
  const nuevo={...base,id:11,plan_id:9,fecha_inicio:'2026-10-22',
    componentes:[{id:3,producto_id:7,cantidad_diaria:2,unidad_id:1}]}
  const report=calcularSeguimientoLote(1,[previo,nuevo],[],[],'2026-10-23')
  assert.equal(report.diasProgramados,4)
  assert.equal(report.productos.find(x=>x.productoId===5)?.planificado,8)
  assert.equal(report.productos.find(x=>x.productoId===7)?.planificado,4)
})

test('asignación reemplazada antes de consumirse no cuenta un día ficticio',()=>{
  const abortada={...base,fecha_inicio:'2026-10-23',fecha_fin:'2026-10-23',
    activo:false,observaciones:'SGIC_SIN_EJECUCION'}
  assert.equal(asignacionEnFecha(abortada,'2026-10-23'),false)
  assert.equal(calcularSeguimientoLote(1,[abortada],[],[],'2026-10-23').diasProgramados,0)
})

test('consumo fuera de plan se suma al total pero no a la ejecución planificada',()=>{
  const c=[{id:8,lote_id:1,fecha:'2026-10-19',origen:'REAL',observaciones:null}]
  const d=[{id:9,consumo_id:8,producto_id:5,cantidad:5,costo_total:200}]
  const report=calcularSeguimientoLote(1,[base],c,d,'2026-10-20')
  assert.equal(report.productos[0].realTotal,5)
  assert.equal(report.productos[0].realDurantePlan,0)
  assert.equal(report.diasSinPlanConConsumo,1)
})
