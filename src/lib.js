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

export const UNIDADES = ['Tableta', 'Cápsula', 'Frasco', 'Sobre', 'Ampolla', 'Inhalador', 'Tubo', 'Vial', 'Parche', 'Supositorio', 'Jeringa']
export const FORMAS = ['Comprimido', 'Cápsula', 'Jarabe', 'Suspensión', 'Solución', 'Ampolla', 'Inhalador', 'Crema', 'Ungüento', 'Gotas', 'Supositorio', 'Parche', 'Polvo', 'Otro']

export const plural = (n, unidad) => {
  const u = unidad.toLowerCase()
  return n === 1 ? u : /[aeiou]$/.test(u) ? `${u}s` : `${u}es`
}

/** Unidades totales de una caja grande (o de la caja pequeña si no hay embalaje colectivo). */
export function factorEmpaqueTotal({ unidadesPorCajaMenor, tieneCajaMaster, cajasPorCajaMaster }) {
  const u = Number(unidadesPorCajaMenor) || 0
  if (!tieneCajaMaster) return u
  return u * (Number(cajasPorCajaMaster) || 0)
}

export function validate(f) {
  const e = {}
  if (!f.nombre.trim()) e.nombre = 'Ingresa el nombre del medicamento'
  if (!f.forma) e.forma = 'Selecciona la forma farmacéutica'
  if (!f.concentracion.trim()) e.concentracion = 'Ingresa la concentración (ej. 500 mg)'
  if (!f.unidad) e.unidad = 'Selecciona la unidad mínima'
  const isInt = (v) => Number.isInteger(Number(v)) && Number(v) >= 1
  if (!isInt(f.unidadesPorCajaMenor)) e.unidadesPorCajaMenor = 'Debe ser un entero de 1 o más'
  if (f.tieneCajaMaster && !isInt(f.cajasPorCajaMaster)) e.cajasPorCajaMaster = 'Debe ser un entero de 1 o más'
  return e
}

/** Documento de Firestore según el esquema propuesto. */
export function toDoc(codigo, f) {
  return {
    id_presentacion: codigo,
    codigo,
    nombre_comercial: f.nombre.trim(),
    forma_farmaceutica: f.forma,
    concentracion: f.concentracion.trim(),
    unidad_dispensa: f.unidad,
    unidades_por_caja_menor: Number(f.unidadesPorCajaMenor),
    tiene_caja_master: !!f.tieneCajaMaster,
    cajas_por_caja_master: f.tieneCajaMaster ? Number(f.cajasPorCajaMaster) : null,
    factor_empaque_total: factorEmpaqueTotal(f),
  }
}

export function fromDoc(d) {
  return {
    nombre: d.nombre_comercial ?? '',
    forma: d.forma_farmaceutica ?? '',
    concentracion: d.concentracion ?? '',
    unidad: d.unidad_dispensa ?? '',
    unidadesPorCajaMenor: d.unidades_por_caja_menor ?? '',
    tieneCajaMaster: !!d.tiene_caja_master,
    cajasPorCajaMaster: d.cajas_por_caja_master ?? '',
  }
}
