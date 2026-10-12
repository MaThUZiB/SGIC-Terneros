// Exportación SIPECweb (XML Spreadsheet 2003 con extensión .xls).
// El procesamiento se realiza exclusivamente en el navegador; no transmite el archivo.
const NS = 'urn:schemas-microsoft-com:office:spreadsheet'
const HEADER_DIIO = 'NUMERO_DIIO'
const REQUIRED_HEADERS = [HEADER_DIIO, 'RAZA', 'SEXO', 'CATEGORIA', 'FECHA_NACIMIENTO', 'ESTABLECIMIENTO']
const MAX_ROWS = 15000

export type SipecAnimal = {
  diio: string
  raza: string
  categoria: string
  fechaNacimiento: string | null
  establecimiento: string
  sexo: string
  glosaPabco: string
}

export type SipecIssue = { fila: number; mensaje: string }
export type SipecReport = {
  animales: SipecAnimal[]
  problemas: SipecIssue[]
  filasLeidas: number
  encabezados: string[]
}

function clean(value: string | null | undefined): string {
  return (value || '').replace(/\u00a0/g, ' ').trim()
}

function isoDate(value: string): string | null {
  if (!value) return null
  const dmy = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(value)
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  let year: number
  let month: number
  let day: number
  if (dmy) {
    day = Number(dmy[1])
    month = Number(dmy[2])
    year = Number(dmy[3])
  } else if (iso) {
    year = Number(iso[1])
    month = Number(iso[2])
    day = Number(iso[3])
  } else return null
  if (year < 1900 || year > 2100 || month < 1 || month > 12 || day < 1 || day > 31) return null
  const parsed = new Date(Date.UTC(year, month - 1, day))
  if (parsed.getUTCFullYear() !== year || parsed.getUTCMonth() + 1 !== month || parsed.getUTCDate() !== day) return null
  return String(year).padStart(4, '0') + '-' + String(month).padStart(2, '0') + '-' + String(day).padStart(2, '0')
}

function cells(row: Element): string[] {
  const result: string[] = []
  for (const cell of Array.from(row.getElementsByTagNameNS(NS, 'Cell'))) {
    const index = Number(cell.getAttributeNS(NS, 'Index'))
    if (Number.isInteger(index) && index > 0 && index <= 100) {
      while (result.length < index - 1) result.push('')
    }
    const data = cell.getElementsByTagNameNS(NS, 'Data')[0]
    result.push(clean(data?.textContent))
  }
  return result
}

export function parseSipecSpreadsheetXml(source: string): SipecReport {
  if (source.length > 10_000_000) throw new Error('El archivo es demasiado grande para una previsualización segura.')
  if (/<!DOCTYPE|<!ENTITY/i.test(source)) throw new Error('No se aceptan archivos con declaraciones DTD o entidades externas.')

  // SIPECweb genera el prefijo no estándar <xml version>, previo al Workbook.
  const normalized = source.replace(/^\uFEFF?\s*<xml\s+version\s*>/i, '').trim()
  const xml = new DOMParser().parseFromString(normalized, 'application/xml')
  if (xml.getElementsByTagName('parsererror').length || xml.getElementsByTagNameNS('*', 'parsererror').length) {
    throw new Error('El archivo no es un XML de Excel válido. Exporta nuevamente desde SIPECweb.')
  }
  if (xml.documentElement.localName !== 'Workbook' || xml.documentElement.namespaceURI !== NS) {
    throw new Error('Formato no admitido. Esta acción acepta los .xls XML (Excel 2003) exportados por SIPECweb, no archivos PDF ni Excel binario.')
  }

  const rows = Array.from(xml.getElementsByTagNameNS(NS, 'Row'))
  if (rows.length < 2) throw new Error('El archivo no contiene un listado de animales.')
  if (rows.length - 1 > MAX_ROWS) throw new Error('La exportación supera el límite de ' + MAX_ROWS + ' filas.')
  const headers = cells(rows[0]).map(value => value.toUpperCase().replace(/\s+/g, '_'))
  if (new Set(headers).size !== headers.length) throw new Error('La exportación tiene encabezados repetidos.')
  for (const required of REQUIRED_HEADERS) {
    if (!headers.includes(required)) throw new Error('La exportación no contiene la columna requerida: ' + required)
  }

  const valueOf = (row: string[], field: string) => row[headers.indexOf(field)] || ''
  const seen = new Set<string>()
  const animales: SipecAnimal[] = []
  const problemas: SipecIssue[] = []
  for (let i = 1; i < rows.length; i++) {
    const values = cells(rows[i])
    if (values.every(value => !value)) continue
    const fila = i + 1
    const diio = valueOf(values, HEADER_DIIO)
    if (!/^\d{7,15}$/.test(diio)) {
      problemas.push({fila, mensaje: 'DIIO vacío o inválido. Se conserva como texto para no perder ceros.'})
      continue
    }
    if (seen.has(diio)) {
      problemas.push({fila, mensaje: 'DIIO duplicado dentro del archivo: ' + diio})
      continue
    }
    seen.add(diio)
    const rawDate = valueOf(values, 'FECHA_NACIMIENTO')
    const fechaNacimiento = isoDate(rawDate)
    if (rawDate && !fechaNacimiento) problemas.push({fila, mensaje: 'Fecha de nacimiento no reconocida para DIIO ' + diio})
    const sexo = valueOf(values, 'SEXO').toUpperCase()
    if (sexo !== 'MACHO' && sexo !== 'HEMBRA') {
      problemas.push({fila, mensaje: 'Sexo no reconocido para DIIO ' + diio})
    }
    animales.push({
      diio,
      raza: valueOf(values, 'RAZA'),
      categoria: valueOf(values, 'CATEGORIA'),
      fechaNacimiento,
      establecimiento: valueOf(values, 'ESTABLECIMIENTO'),
      sexo,
      glosaPabco: valueOf(values, 'GLOSA_PABCO'),
    })
  }
  if (!animales.length) throw new Error('No se encontraron DIIO válidos en la exportación.')
  return {animales, problemas, filasLeidas: rows.length - 1, encabezados: headers}
}
