import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseLines, searchProducts, factorEmpaqueTotal, cajasPequenasEnGrande, isValidCode, validate, toDoc, empaqueSugerido } from '../src/lib.js'

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

test('factor de empaque según tipo de empaque', () => {
  const f = (o) => ({ nombre: 'a', forma: 'x', unidad: 'z', unidadesPorCajaMenor: 30, unidadesPorCajaMaster: 300, ...o })
  assert.equal(factorEmpaqueTotal(f({ empaque: 'ambas' })), 300)
  assert.equal(factorEmpaqueTotal(f({ empaque: 'pequena' })), 30)
  assert.equal(factorEmpaqueTotal(f({ empaque: 'grande', unidadesPorCajaMenor: '' })), 300)
  assert.equal(cajasPequenasEnGrande(f({ empaque: 'ambas' })), 10)
  assert.equal(cajasPequenasEnGrande(f({ empaque: 'grande' })), 0)
  assert.ok(validate(f({ empaque: 'ambas', unidadesPorCajaMaster: 20 })).unidadesPorCajaMaster)
  assert.deepEqual(validate(f({ empaque: 'grande', unidadesPorCajaMenor: '' })), {})
  assert.ok(validate(f({ empaque: 'grande', unidadesPorCajaMaster: '' })).unidadesPorCajaMaster)
  assert.deepEqual(validate(f({ empaque: 'pequena', unidadesPorCajaMaster: '' })), {})
  const d = toDoc('1-10-46-6006', f({ empaque: 'grande', unidadesPorCajaMenor: '' }))
  assert.equal(d.unidades_por_caja_menor, null)
  assert.equal(d.tiene_caja_menor, false)
  assert.equal(d.factor_empaque_total, 300)
  assert.equal(toDoc('c', f({ empaque: 'ambas', unidadesPorCajaMaster: 200 })).cajas_por_caja_master, null)
  assert.equal(empaqueSugerido('Jarabe'), 'grande')
  assert.equal(empaqueSugerido('Comprimido'), 'pequena')
})

test('limpia clase y columnas numéricas del reporte', () => {
  const r = parseLines(['1-10-16-0010 CN PARACETAMOL 500 MG, TABLETA 128.500 480.000 332.300'])
  assert.equal(r[0].nombre, 'PARACETAMOL 500 MG, TABLETA')
})
