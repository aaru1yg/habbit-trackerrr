import puppeteer from 'puppeteer-core'
const browser = await puppeteer.launch({
  args: ['--no-sandbox', '--disable-gpu', '--hide-scrollbars', '--force-device-scale-factor=1'],
  executablePath: '/tmp/chromium', headless: true,
  env: { ...process.env, LD_LIBRARY_PATH: '/tmp/libs' },
})
const page = await browser.newPage()
await page.setViewport({ width: 512, height: 512, deviceScaleFactor: 1 })
await page.goto('file:///tmp/maskable.html')
await page.screenshot({ path: 'public/icon-512-maskable.png' })
await browser.close()
console.log('maskable done')
