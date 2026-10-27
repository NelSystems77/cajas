import * as pdfjs from 'pdfjs-dist'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import { parseLines } from './lib.js'

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl

/** Agrupa los fragmentos de texto de una página en filas (misma coordenada Y). */
function pageToLines(items) {
  const rows = []
  for (const it of items) {
    if (!it.str?.trim()) continue
    const x = it.transform[4]
    const y = it.transform[5]
    const row = rows.find((r) => Math.abs(r.y - y) < 3)
    if (row) row.cells.push({ x, str: it.str })
    else rows.push({ y, cells: [{ x, str: it.str }] })
  }
  return rows
    .sort((a, b) => b.y - a.y)
    .map((r) =>
      r.cells
        .sort((a, b) => a.x - b.x)
        .map((c) => c.str.trim())
        .join(' '),
    )
}

export async function extractProducts(file, onProgress) {
  const data = new Uint8Array(await file.arrayBuffer())
  const pdf = await pdfjs.getDocument({ data }).promise
  const lines = []
  for (let n = 1; n <= pdf.numPages; n++) {
    const page = await pdf.getPage(n)
    const content = await page.getTextContent()
    lines.push(...pageToLines(content.items))
    onProgress?.(n, pdf.numPages)
  }
  return parseLines(lines)
}
