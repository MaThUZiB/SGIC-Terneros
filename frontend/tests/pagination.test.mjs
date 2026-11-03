import { test } from 'node:test'
import { strict as assert } from 'node:assert'
import { PAGE_SIZE,pageCount,pageRange,pageLabel } from '../src/utils/pagination.ts'

test('postgrest uses inclusive offsets across pages',()=>{
  assert.equal(PAGE_SIZE,20)
  assert.deepEqual(pageRange(0),{from:0,to:19})
  assert.deepEqual(pageRange(1),{from:20,to:39})
  assert.deepEqual(pageRange(4),{from:80,to:99})
})
test('empty and partial pages have accurate accessible labels',()=>{
  assert.equal(pageCount(0),1)
  assert.equal(pageCount(70),4)
  assert.equal(pageLabel(0,0),'0 resultados')
  assert.equal(pageLabel(3,70),'61–70 de 70')
  assert.equal(pageLabel(0,70),'1–20 de 70')
})
test('ranges avoid negative page and invalid sizes',()=>{
  assert.deepEqual(pageRange(-1),{from:0,to:19})
  assert.deepEqual(pageRange(0,0),{from:0,to:0})
})
