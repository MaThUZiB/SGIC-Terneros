import test from 'node:test'
import assert from 'node:assert/strict'
import { calcularRacionDiaria, sugerenciaPorAnimal } from '../src/utils/dailyRation.ts'

const lineas=[{id:1,producto_id:10,cantidad_diaria:4},{id:2,producto_id:20,cantidad_diaria:1.5}]

test('el plan original utiliza totales por lote sin multiplicar por terneros',()=>{
  const r=calcularRacionDiaria(lineas,{},'LOTE',23,{10:50,20:10})
  assert.equal(r.lineas[0].cantidad,4)
  assert.equal(r.lineas[1].cantidad,1.5)
  assert.equal(r.lineas[0].porAnimal,0.17391)
  assert.deepEqual(r.errores,[])
})
test('la ración por animal multiplica por el número vigente de cabezas',()=>{
  const r=calcularRacionDiaria(lineas,{'1':'0,125','2':'0,5'},'ANIMAL',23,{10:50,20:20})
  assert.deepEqual(r.lineas.map(l=>l.cantidad),[2.875,11.5])
  assert.equal(r.stockInsuficiente.length,0)
})
test('la sugerencia individual reproduce los totales anteriores con redondeo de stock',()=>{
  const entradas=sugerenciaPorAnimal(lineas,23)
  const r=calcularRacionDiaria(lineas,entradas,'ANIMAL',23,{10:50,20:10})
  assert.deepEqual(r.lineas.map(l=>l.cantidad),[4,1.5])
})
test('el stock insuficiente se valida sumando todas las líneas del mismo producto',()=>{
  const duplicado=[lineas[0],{id:3,producto_id:10,cantidad_diaria:3}]
  const r=calcularRacionDiaria(duplicado,{},'LOTE',10,{10:6})
  assert.deepEqual(r.stockInsuficiente,[{productoId:10,requerido:7,disponible:6}])
})
test('rechaza cantidades inválidas, cero total y lotes sin animales en modo por ternero',()=>{
  assert.ok(calcularRacionDiaria(lineas,{'1':'-1'},'LOTE',5).errores.length)
  assert.ok(calcularRacionDiaria(lineas,{'1':'0','2':'0'},'LOTE',5).errores.length)
  assert.ok(calcularRacionDiaria(lineas,{'1':'0.25'},'ANIMAL',0).errores.length)
  assert.ok(calcularRacionDiaria(lineas,{'1':'1.00001'},'LOTE',5).errores.length)
})
