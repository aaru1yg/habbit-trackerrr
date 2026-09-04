import chromium from '@sparticuz/chromium'
import puppeteer from 'puppeteer-core'
process.env.LD_LIBRARY_PATH = '/tmp/libs'
const execPath = await chromium.executablePath()
const browser = await puppeteer.launch({
  args: [...chromium.args, '--no-sandbox', '--disable-gpu'],
  executablePath: execPath,
  headless: true,
  env: { ...process.env, LD_LIBRARY_PATH: '/tmp/libs' },
})
const page = await browser.newPage()
await page.setContent('<h1 style="font-family:sans-serif">hello world</h1>')
console.log('text:', await page.evaluate(() => document.body.innerText))
await page.screenshot({ path: '/tmp/ptest.png' })
await browser.close()
console.log('SUCCESS')
