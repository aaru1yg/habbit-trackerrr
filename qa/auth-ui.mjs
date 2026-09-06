/* Auth UI QA — verifies the *client* behaviour that does not need a live
 * Supabase project: gating, honest local-only reporting, validation, error
 * surfacing, and mobile layout of the auth screen.
 *
 * This deliberately does NOT claim the backend works. Live signup/login must
 * be proven separately against the real project.
 *
 * Usage: node qa/auth-ui.mjs [baseUrl]
 */
import { mkdirSync } from 'fs'
import { launch, newPage, check, results, sleep } from './helpers.mjs'

const BASE = process.argv[2] || 'http://localhost:4173'

async function run() {
  mkdirSync('qa/shots', { recursive: true })
  const browser = await launch()
  console.log(`\nAuth UI QA → ${BASE}\n`)

  // ---- mobile auth screen layout ----
  {
    const page = await newPage(browser, { width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true })
    await page.goto(BASE, { waitUntil: 'networkidle0' })
    await sleep(800)

    const g = await page.evaluate(() => {
      const card = document.querySelector('.auth-card')
      if (!card) return null
      const r = card.getBoundingClientRect()
      const submit = document.querySelector('.auth-submit')
      const sr = submit?.getBoundingClientRect()
      return {
        vw: window.innerWidth,
        vh: window.innerHeight,
        cardLeft: r.left,
        cardRight: r.right,
        submitBottom: sr?.bottom ?? null,
        submitVisible: sr ? sr.bottom <= window.innerHeight + 1 : false,
        docScrollW: document.documentElement.scrollWidth,
        hasBrandVisible: getComputedStyle(document.querySelector('.auth-brand')).display !== 'none',
        title: document.querySelector('.auth-title')?.textContent?.trim(),
      }
    })

    check('auth screen renders when Supabase config is present', !!g)
    if (g) {
      check('mobile: shows Welcome back', /welcome back/i.test(g.title || ''), g.title)
      check('mobile: no horizontal overflow', g.docScrollW <= g.vw + 1, `scrollW=${g.docScrollW}`)
      check('mobile: primary action inside viewport', g.submitVisible)
      check('mobile: brand split panel hidden (focused column)', g.hasBrandVisible === false)
    }
    await page.screenshot({ path: 'qa/shots/auth-390x844.png' })

    // ---- client-side validation, before any network call ----
    await page.evaluate(() => {
      const set = (sel, v) => {
        const el = document.querySelector(sel)
        const d = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
        d.call(el, v)
        el.dispatchEvent(new Event('input', { bubbles: true }))
      }
      set('#auth-email', 'not-an-email')
      set('#auth-password', 'short')
      document.querySelector('.auth-submit').click()
    })
    await sleep(400)
    const invalidEmail = await page.evaluate(() => document.querySelector('.auth-alert-bad')?.textContent || '')
    check('invalid email is rejected with a friendly message', /valid email/i.test(invalidEmail), invalidEmail)

    await page.evaluate(() => {
      const d = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
      const el = document.querySelector('#auth-email')
      d.call(el, 'real@example.com')
      el.dispatchEvent(new Event('input', { bubbles: true }))
      document.querySelector('.auth-submit').click()
    })
    await sleep(400)
    const weakPw = await page.evaluate(() => document.querySelector('.auth-alert-bad')?.textContent || '')
    check('weak password is rejected with a friendly message', /8 characters/i.test(weakPw), weakPw)

    // ---- network failure surfaces as human language, not a raw error ----
    await page.evaluate(() => {
      const d = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
      const p = document.querySelector('#auth-password')
      d.call(p, 'longenoughpassword')
      p.dispatchEvent(new Event('input', { bubbles: true }))
      document.querySelector('.auth-submit').click()
    })
    await sleep(2500)
    const netErr = await page.evaluate(() => document.querySelector('.auth-alert-bad')?.textContent || '')
    check('unreachable backend shows a friendly error', netErr.length > 0 && !/TypeError|fetch|undefined|\[object/i.test(netErr), netErr)
    await page.screenshot({ path: 'qa/shots/auth-error-390x844.png' })

    // ---- navigation between modes ----
    await page.evaluate(() => {
      const b = [...document.querySelectorAll('.auth-link')].find((x) => /create account/i.test(x.textContent))
      b?.click()
    })
    await sleep(400)
    check('can switch to Create account', await page.evaluate(() => /create your account/i.test(document.querySelector('.auth-title')?.textContent || '')))

    await page.evaluate(() => {
      const b = [...document.querySelectorAll('.auth-link')].find((x) => /sign in/i.test(x.textContent))
      b?.click()
    })
    await sleep(300)
    await page.evaluate(() => {
      const b = [...document.querySelectorAll('.auth-link')].find((x) => /forgot/i.test(x.textContent))
      b?.click()
    })
    await sleep(400)
    check('can reach Forgot password', await page.evaluate(() => /reset your password/i.test(document.querySelector('.auth-title')?.textContent || '')))

    await page.close()
  }

  // ---- desktop split composition ----
  {
    const page = await newPage(browser, { width: 1440, height: 900, deviceScaleFactor: 1 })
    await page.goto(BASE, { waitUntil: 'networkidle0' })
    await sleep(800)
    const g = await page.evaluate(() => {
      const brand = document.querySelector('.auth-brand')
      const card = document.querySelector('.auth-card')
      return {
        brandVisible: brand ? getComputedStyle(brand).display !== 'none' : false,
        cardWidth: card?.getBoundingClientRect().width ?? 0,
        overflow: document.documentElement.scrollWidth <= window.innerWidth + 1,
      }
    })
    check('desktop: split brand panel is shown', g.brandVisible)
    check('desktop: form column stays a comfortable width', g.cardWidth > 200 && g.cardWidth <= 420, `w=${g.cardWidth}`)
    check('desktop: no horizontal overflow', g.overflow)
    await page.screenshot({ path: 'qa/shots/auth-1440x900.png' })
    await page.close()
  }

  await browser.close()
  console.log(`\n${results.pass} passed, ${results.fail} failed`)
  if (results.fail) {
    for (const f of results.failures) console.log(`  ✗ ${f}`)
    process.exit(1)
  }
}

run().catch((e) => { console.error(e); process.exit(1) })
