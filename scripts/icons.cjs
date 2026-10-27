const { chromium } = require('playwright')
const { readFileSync } = require('node:fs')
const svg = readFileSync('public/icon.svg', 'utf8')
;(async () => {
const b = await chromium.launch()
for (const s of [192, 512]) {
  const p = await b.newPage({ viewport: { width: s, height: s } })
  await p.setContent(`<style>body{margin:0}svg{width:${s}px;height:${s}px;display:block}</style>${svg}`)
  await p.screenshot({ path: `public/icon-${s}.png` })
}
await b.close()
})()
