import {test} from 'node:test'
import assert from 'node:assert/strict'
import {normalizeSipecLegacyXml} from '../src/utils/sipecSpreadsheet.ts'

const raw = `<xml version>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:x="urn:schemas-    microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
 <Worksheet ss:Name="Libro1"><Table>
 <Row><Cell><Data ss:Type="String">NUMERO_DIIO</Data></Cell></Row>
 <Row><Cell><Data ss:Type="String">000000123</Data></Cell></Row>
 </Table></Worksheet></Workbook>`

test('normaliza únicamente las irregularidades XML conocidas de SIPECweb', () => {
  const normalized = normalizeSipecLegacyXml(raw)
  assert.ok(normalized.startsWith('<Workbook'))
  assert.ok(normalized.includes('xmlns:x="urn:schemas-microsoft-com:office:excel"'))
  assert.ok(normalized.includes('>000000123<'), 'preserva ceros del DIIO')
  assert.ok(normalized.includes('xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"'))
  assert.ok(!normalized.includes('<xml version>'))
})

test('acepta comillas simples en el namespace inválido', () => {
  const value = "<Workbook xmlns:x='urn:schemas-    microsoft-com:office:excel'></Workbook>"
  assert.equal(normalizeSipecLegacyXml(value),
    "<Workbook xmlns:x='urn:schemas-microsoft-com:office:excel'></Workbook>")
})

test('no altera un namespace distinto ni los datos de animales', () => {
  const xml = '<Workbook xmlns:x="urn:vendor-    no-related"><Data>000000123</Data></Workbook>'
  assert.equal(normalizeSipecLegacyXml(xml), xml)
})

test('no cambia exportaciones XML ya correctas', () => {
  const value = '<Workbook xmlns:x="urn:schemas-microsoft-com:office:excel"></Workbook>'
  assert.equal(normalizeSipecLegacyXml(value), value)
})
