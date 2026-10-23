import test from 'node:test'
import assert from 'node:assert/strict'
import { calcularPresentacionesEquivalentes, nombrePresentacionPlural } from '../src/utils/presentationStock.ts'

test('muestra 250 kg como diez sacos equivalentes de 25 kg', () => {
  assert.equal(calcularPresentacionesEquivalentes(250, 25), 10)
  assert.equal(nombrePresentacionPlural('saco', 10), 'sacos')
})

test('admite existencias parciales sin tratarlas como sacos cerrados', () => {
  assert.equal(calcularPresentacionesEquivalentes(120, 25), 4.8)
  assert.equal(nombrePresentacionPlural('bolsa de 25 kg', 4.8), 'bolsas de 25 kg')
})

test('soporta presentaciones de medicamentos y unidad base', () => {
  assert.equal(calcularPresentacionesEquivalentes(1000, 100), 10)
  assert.equal(nombrePresentacionPlural('frasco', 10), 'frascos')
  assert.equal(nombrePresentacionPlural('frasco', 1), 'frasco')
})

test('no calcula equivalencias con stock o factores inválidos', () => {
  assert.equal(calcularPresentacionesEquivalentes(-1, 25), null)
  assert.equal(calcularPresentacionesEquivalentes(10, 0), null)
  assert.equal(calcularPresentacionesEquivalentes(Number.NaN, 25), null)
})
