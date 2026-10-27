import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseLines, searchProducts, factorEmpaqueTotal, cajasPequenasEnGrande, isValidCode, validate, toDoc } from '../src/lib.js'

test('detecta ambos formatos de código', () => {
  assert.ok(isValidCode('1-05-12-3456'))
  assert.ok(isValidCode('105-12-3456'))
  assert.ok(!isValidCode('12-05-2024'))
  assert.ok(!isValidCode('1-05-12-34567'))
})

test('parsea código + nombre en la misma fila, en cualquier orden', () => {
  const r = parseLines([
    '1-05-12-3456 PARACETAMOL 500 MG TABLETA',
    'AMOXICILINA 500 MG CAPSULA 105 - 12 - 3457',
    'texto sin código',
    'Fecha 12-05-2024',
  ])
  assert.deepEqual(r.map((x) => x.codigo).sort(), ['1-05-12-3456', '105-12-3457'])
  assert.equal(r.find((x) => x.codigo === '1-05-12-3456').nombre, 'PARACETAMOL 500 MG TABLETA')
  assert.equal(r.find((x) => x.codigo === '105-12-3457').nombre, 'AMOXICILINA 500 MG CAPSULA')
})

test('toma el nombre de la línea siguiente y deduplica', () => {
  const r = parseLines(['2-01-01-0001', 'IBUPROFENO 400 MG', '2-01-01-0001 IBUPROFENO 400 MG TABLETA'])
  assert.equal(r.length, 1)
  assert.equal(r[0].nombre, 'IBUPROFENO 400 MG TABLETA')
})

test('búsqueda por código parcial/sin guiones y por nombre sin acentos', () => {
  const p = [{ codigo: '1-05-12-3456', nombre: 'Paracetamol' }, { codigo: '105-12-3457', nombre: 'Cápsula X' }]
  assert.equal(searchProducts(p, '1051234').length, 2)
  assert.equal(searchProducts(p, '105-12-3457').length, 1)
  assert.equal(searchProducts(p, 'capsula').length, 1)
  assert.equal(searchProducts(p, 'para').length, 1)
})

test('factor de empaque y cajas pequeñas por grande', () => {
  assert.equal(factorEmpaqueTotal({ unidadesPorCajaMenor: 30, tieneCajaMaster: true, unidadesPorCajaMaster: 300 }), 300)
  assert.equal(factorEmpaqueTotal({ unidadesPorCajaMenor: 30, tieneCajaMaster: false, unidadesPorCajaMaster: 300 }), 30)
  assert.equal(cajasPequenasEnGrande({ unidadesPorCajaMenor: 30, unidadesPorCajaMaster: 300 }), 10)
  const base = { nombre: 'a', forma: 'x', unidad: 'z', unidadesPorCajaMenor: 28, tieneCajaMaster: true }
  assert.ok(validate({ ...base, unidadesPorCajaMaster: 20 }).unidadesPorCajaMaster)
  assert.deepEqual(validate({ ...base, unidadesPorCajaMaster: 200 }), {})
  assert.equal(toDoc('1-10-04-0045', { ...base, unidadesPorCajaMaster: 280 }).cajas_por_caja_master, 10)
  assert.equal(toDoc('1-10-04-0045', { ...base, unidadesPorCajaMaster: 200 }).cajas_por_caja_master, null)
})

test('limpia clase y columnas numéricas del reporte', () => {
  const r = parseLines(['1-10-16-0010 CN PARACETAMOL 500 MG, TABLETA 128.500 480.000 332.300'])
  assert.equal(r[0].nombre, 'PARACETAMOL 500 MG, TABLETA')
})
