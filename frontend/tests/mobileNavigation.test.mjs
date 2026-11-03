import { test } from 'node:test'
import { strict as assert } from 'node:assert'
import { MOBILE_PRIMARY_MODULES,isMobilePrimaryModule,isMobileMoreModule } from '../src/utils/mobileNavigation.ts'

test('mobile navigation has exactly three primary module actions plus More',()=>{
  assert.deepEqual([...MOBILE_PRIMARY_MODULES],['resumen','animales','inventario'])
  assert.equal(MOBILE_PRIMARY_MODULES.length,3)
})
test('other business modules are reached through the fourth action',()=>{
  for(const module of ['planes','compras','lotes','sanidad','ventas','rentabilidad','usuarios','historial']){
    assert.equal(isMobileMoreModule(module),true)
  }
  assert.equal(isMobilePrimaryModule('resumen'),true)
  assert.equal(isMobileMoreModule('inventario'),false)
})
