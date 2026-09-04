import puppeteer from 'puppeteer-core'
const browser = await puppeteer.launch({
  args: ['--no-sandbox', '--disable-gpu', '--hide-scrollbars'],
  executablePath: '/tmp/chromium',
  headless: true,
  env: { ...process.env, LD_LIBRARY_PATH: '/tmp/libs' },
})
try {
  const page = await browser.newPage()
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 })
  await page.goto('http://localhost:5173', { waitUntil: 'networkidle0', timeout: 30000 })
  await new Promise(r => setTimeout(r, 2500))
  await page.screenshot({ path: 'qa/baseline-mobile.png', fullPage: false })
  const errors = []
  page.on('pageerror', e => errors.push(e.message))
  console.log('baseline captured, jsErrors:', errors.length)
} finally { await browser.close() }
