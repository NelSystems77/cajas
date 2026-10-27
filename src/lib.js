// Lógica pura (sin DOM): códigos, parseo de líneas del PDF, búsqueda y cálculo de empaques.

// Formatos admitidos: X-XX-XX-XXXX  o  XXX-XX-XXXX (dígitos o letras mayúsculas).
const SEG = '[0-9A-Z]'
const build = (dash) =>
  `(?:${[
    [1, 2, 2, 4],
    [3, 2, 4],
  ]
    .map((g) => g.map((n) => `${SEG}{${n}}`).join(dash))
    .join('|')})`
const CODE_SRC = build('-')
// Tolera espacios alrededor de los guiones, frecuentes al extraer texto de PDF.
const SPACED_SRC = build('\\s*-\\s*')
// Sin lookbehind (Safari < 16.4 no lo soporta): el carácter previo se captura en el grupo 1.
const FIND_SRC = `(^|[^0-9A-Za-z-])(${SPACED_SRC})(?![0-9A-Za-z-])`

export const normalizeCode = (c) => c.replace(/\s+/g, '').toUpperCase()

export function isValidCode(c) {
  return new RegExp(`^${CODE_SRC}$`).test(normalizeCode(c))
}

// Quita columnas numéricas finales (existencia, cuota, consumo) y la clase inicial (CN, AM…).
const cleanName = (s) =>
  s.trim()
    .replace(/(?:\s+-?\d[\d.,]*)+\s*$/, '')
    .replace(/^[A-Z]{2}\s+(?=\S{2})/, '')
    .replace(/^[\s|:;,.\-–—·•]+|[\s|:;,.\-–—·•]+$/g, '').replace(/\s{2,}/g, ' ')

/** Recibe líneas de texto (ya agrupadas por fila) y devuelve [{codigo, nombre}]. */
export function parseLines(lines) {
  const found = new Map()
  const add = (codigo, nombre) => {
    const prev = found.get(codigo)
    if (!prev || nombre.length > prev.nombre.length) found.set(codigo, { codigo, nombre })
  }
  lines.forEach((line, i) => {
    const re = new RegExp(FIND_SRC, 'g')
    const hits = [...line.matchAll(re)]
    if (!hits.length) return
    hits.forEach((m, k) => {
      const start = m.index + m[1].length
      const end = start + m[2].length
      const next = hits[k + 1]?.index ?? line.length
      let nombre = cleanName(line.slice(end, next))
      // Código al final de la fila: el nombre suele estar antes.
      if (!nombre && hits.length === 1) nombre = cleanName(line.slice(0, start))
      // Nombre en la línea siguiente (sin código).
      if (!nombre && lines[i + 1] && !new RegExp(FIND_SRC).test(lines[i + 1])) {
        nombre = cleanName(lines[i + 1])
      }
      add(normalizeCode(m[2]), nombre)
    })
  })
  return [...found.values()].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
}

const fold = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

/** Busca por código (con o sin guiones, parcial) o por nombre (todas las palabras). */
export function searchProducts(products, query) {
  const q = fold(query.trim())
  if (!q) return products
  const compact = q.replace(/[\s-]/g, '')
  const codeLike = /\d/.test(compact) && /^[0-9a-z]+$/.test(compact)
  const tokens = q.split(/\s+/)
  return products.filter((p) => {
    if (codeLike && p.codigo.replace(/-/g, '').toLowerCase().includes(compact)) return true
    const name = fold(p.nombre)
    return tokens.every((t) => name.includes(t))
  })
}

export const UNIDADES = ['Tableta', 'Cápsula', 'Frasco', 'Sobre', 'Ampolla', 'Inhalador', 'Tubo', 'Vial', 'Parche', 'Supositorio', 'Jeringa', 'Botella']
export const FORMAS = ['Comprimido', 'Cápsula', 'Jarabe', 'Suspensión', 'Solución', 'Ampolla', 'Inhalador', 'Crema', 'Ungüento', 'Gotas', 'Frasco', 'Botella', 'Supositorio', 'Parche', 'Polvo', 'Otro']

// Unidad de dispensa sugerida según la forma farmacéutica (el usuario puede cambiarla).
const UNIDAD_POR_FORMA = {
  Comprimido: 'Tableta', Cápsula: 'Cápsula', Jarabe: 'Frasco', Suspensión: 'Frasco', Solución: 'Frasco',
  Ampolla: 'Ampolla', Inhalador: 'Inhalador', Crema: 'Tubo', Ungüento: 'Tubo', Gotas: 'Frasco',
  Frasco: 'Frasco', Botella: 'Botella', Supositorio: 'Supositorio', Parche: 'Parche', Polvo: 'Sobre',
}
export const unidadSugerida = (forma) => UNIDAD_POR_FORMA[forma] ?? ''

export const plural = (n, unidad) => {
  const u = (unidad || 'unidad').toLowerCase()
  return n === 1 ? u : /[aeiou]$/.test(u) ? `${u}s` : `${u}es`
}

// Cómo viene empacado el producto.
export const EMPAQUES = {
  pequena: 'pequena', // sólo caja pequeña
  ambas: 'ambas', // cajas pequeñas dentro de una caja grande
  grande: 'grande', // sólo caja grande (sin caja pequeña), p. ej. jarabes, frascos
}
const FORMAS_SOLO_GRANDE = ['Jarabe', 'Suspensión', 'Solución', 'Frasco', 'Botella', 'Gotas']
export const empaqueSugerido = (forma) => (FORMAS_SOLO_GRANDE.includes(forma) ? EMPAQUES.grande : EMPAQUES.pequena)

export const usaCajaPequena = (f) => f.empaque !== EMPAQUES.grande
export const usaCajaGrande = (f) => f.empaque !== EMPAQUES.pequena

const FEMENINAS = ['tableta', 'cápsula', 'ampolla', 'botella', 'jeringa']
/** "Cuántas"/"Cuántos" según el género de la unidad. */
export const cuantas = (unidad) => (!unidad || FEMENINAS.includes(unidad.toLowerCase()) ? 'Cuántas' : 'Cuántos')

/** Unidades totales de la caja más grande que maneja el producto. */
export function factorEmpaqueTotal(f) {
  return usaCajaGrande(f) ? Number(f.unidadesPorCajaMaster) || 0 : Number(f.unidadesPorCajaMenor) || 0
}

/** Cajas pequeñas que caben en la grande (puede no ser entero). */
export function cajasPequenasEnGrande(f) {
  if (f.empaque !== EMPAQUES.ambas) return 0
  const m = Number(f.unidadesPorCajaMenor)
  const g = Number(f.unidadesPorCajaMaster)
  return m > 0 && g > 0 ? g / m : 0
}

export function validate(f) {
  const e = {}
  if (!f.nombre.trim()) e.nombre = 'Ingresa el nombre del medicamento'
  if (!f.forma) e.forma = 'Selecciona la forma farmacéutica'
  if (!f.unidad) e.unidad = 'Selecciona la unidad'
  const isInt = (v) => Number.isInteger(Number(v)) && Number(v) >= 1
  const msg = 'Ingresa un número entero de 1 o más'
  if (usaCajaPequena(f) && !isInt(f.unidadesPorCajaMenor)) e.unidadesPorCajaMenor = msg
  if (usaCajaGrande(f)) {
    if (!isInt(f.unidadesPorCajaMaster)) e.unidadesPorCajaMaster = msg
    else if (f.empaque === EMPAQUES.ambas && isInt(f.unidadesPorCajaMenor) && Number(f.unidadesPorCajaMaster) < Number(f.unidadesPorCajaMenor))
      e.unidadesPorCajaMaster = 'La caja grande debe tener igual o más que la pequeña'
  }
  return e
}

/** Documento de Firestore según el esquema propuesto. */
export function toDoc(codigo, f) {
  const cajas = cajasPequenasEnGrande(f)
  return {
    id_presentacion: codigo,
    codigo,
    nombre_comercial: f.nombre.trim(),
    forma_farmaceutica: f.forma,
    unidad_dispensa: f.unidad,
    tipo_empaque: f.empaque,
    tiene_caja_menor: usaCajaPequena(f),
    unidades_por_caja_menor: usaCajaPequena(f) ? Number(f.unidadesPorCajaMenor) : null,
    tiene_caja_master: usaCajaGrande(f),
    unidades_por_caja_master: usaCajaGrande(f) ? Number(f.unidadesPorCajaMaster) : null,
    // Sólo si la caja grande contiene un número exacto de cajas pequeñas.
    cajas_por_caja_master: Number.isInteger(cajas) && cajas > 0 ? cajas : null,
    factor_empaque_total: factorEmpaqueTotal(f),
  }
}

export function fromDoc(d) {
  const master = d.unidades_por_caja_master ?? (d.cajas_por_caja_master ? d.cajas_por_caja_master * d.unidades_por_caja_menor : '')
  const empaque = d.tipo_empaque ?? (d.tiene_caja_master ? EMPAQUES.ambas : EMPAQUES.pequena)
  return {
    nombre: d.nombre_comercial ?? '',
    forma: d.forma_farmaceutica ?? '',
    unidad: d.unidad_dispensa ?? '',
    empaque,
    unidadesPorCajaMenor: d.unidades_por_caja_menor ?? '',
    unidadesPorCajaMaster: master,
  }
}
