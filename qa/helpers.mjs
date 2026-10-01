/* Browser launch helpers for the screenshot run. Nothing else lives here:
   the QA surface is one script, so a helper with no caller is just rot. */
import { existsSync } from 'fs'
import puppeteer from 'puppeteer-core'

export const VIEWPORTS = {
  mobile: { width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  desktop: { width: 1440, height: 900, deviceScaleFactor: 1 },
}

const BASE_ARGS = [
  '--no-sandbox', '--disable-gpu', '--hide-scrollbars',
  '--force-color-profile=srgb', '--disable-lcd-text',
  '--enable-features=OverlayScrollbar',
]

/** Look for a usable system chromium first (CHROMIUM_PATH or common installs). */
function systemChromium() {
  if (process.env.CHROMIUM_PATH && existsSync(process.env.CHROMIUM_PATH)) return process.env.CHROMIUM_PATH
  const known = [
    '/tmp/chromium',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
  ]
  return known.find((p) => existsSync(p)) || null
}

/** Fall back to the bundled @sparticuz/chromium (devDependency) when no system
 *  chromium exists — e.g. a fresh CI runner or a stripped-down container. */
async function bundledChromium() {
  const { default: chromium } = await import('@sparticuz/chromium')
  const executablePath = await chromium.executablePath()
  return { executablePath, args: [...chromium.args, ...BASE_ARGS] }
}

export async function launch() {
  const env = { ...process.env }
  if (process.env.QA_LIBRARY_PATH) env.LD_LIBRARY_PATH = process.env.QA_LIBRARY_PATH
  const system = systemChromium()
  if (system) {
    return puppeteer.launch({ args: BASE_ARGS, executablePath: system, headless: true, env })
  }
  const bundled = await bundledChromium()
  return puppeteer.launch({ args: bundled.args, executablePath: bundled.executablePath, headless: true, env })
}
