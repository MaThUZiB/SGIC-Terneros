import {test} from 'node:test'
import assert from 'node:assert/strict'
import {parseClpAmount} from '../src/utils/clpInput.ts'

test('interpreta importes enteros CLP sin separadores o con puntos de miles',()=>{
  assert.equal(parseClpAmount('100000'),100000)
  assert.equal(parseClpAmount('100.000'),100000)
  assert.equal(parseClpAmount('1.250.000'),1250000)
  assert.equal(parseClpAmount(' 180.000 '),180000)
})

test('acepta centavos mediante coma chilena o punto decimal no ambiguo',()=>{
  assert.equal(parseClpAmount('180.000,50'),180000.5)
  assert.equal(parseClpAmount('180000,50'),180000.5)
  assert.equal(parseClpAmount('180000.50'),180000.5)
  assert.equal(parseClpAmount('100.00'),100)
})

test('rechaza precios negativos, nulos, notación científica y separadores inconsistentes',()=>{
  for(const amount of ['', '0', '-100', '1e6', '100.0000', '100,000',
    '100.00.000', '100 000', 'foo', '$180.000', 'NaN', 'Infinity']){
    assert.equal(parseClpAmount(amount),null,'Importe inválido: '+amount)
  }
})

test('respeta capacidad del campo numeric(12,2)',()=>{
  assert.equal(parseClpAmount('9.999.999.999,99'),9999999999.99)
  assert.equal(parseClpAmount('10.000.000.000'),null)
})
