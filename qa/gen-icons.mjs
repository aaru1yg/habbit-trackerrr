/* Rasterise the brand mark to the PNG sizes the manifest declares.
   No sharp dependency: render the SVG in the QA browser instead. */
import { writeFileSync, readFileSync } from 'fs'
import { launch } from './helpers.mjs'

const svg = readFileSync('public/favicon.svg', 'utf8')
const maskable = svg.replace('x="13" y="13" width="17" height="17"', 'x="17" y="17" width="13" height="13"')
  .replace('x="34" y="13" width="17" height="17"', 'x="34" y="17" width="13" height="13"')
  .replace('x="13" y="34" width="17" height="17"', 'x="17" y="34" width="13" height="13"')
  .replace('x="34" y="34" width="17" height="17"', 'x="34" y="34" width="13" height="13"')
  .replace('rx="14"', 'rx="0"')

const browser = await launch()
const page = await browser.newPage()
for (const [file, size, source] of [
  ['public/favicon-64.png', 64, svg],
  ['public/icon-192.png', 192, svg],
  ['public/icon-512.png', 512, svg],
  ['public/apple-touch-icon.png', 180, svg],
  ['public/icon-512-maskable.png', 512, maskable],
]) {
  await page.setViewport({ width: size, height: size, deviceScaleFactor: 1 })
  await page.setContent(`<style>html,body{margin:0;padding:0}svg{display:block;width:${size}px;height:${size}px}</style>${source}`)
  const buf = await page.screenshot({ omitBackground: true })
  writeFileSync(file, buf)
  console.log('wrote', file, size)
}
await browser.close()
