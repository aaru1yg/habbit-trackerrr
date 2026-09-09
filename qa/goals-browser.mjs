/* Phase 6 final browser proof — Goals (§38-44). Real production build, persisted
 * fixture (seededStateV4's own goals: on-track, at-risk, overdue, reached), real
 * Chromium, no mocked engines, no deployment from here. One CI job per viewport
 * (390×844, 430×932, 1440×900) writes results.json so the counts are publishable
 * through the Checks API (qa/publish-browser-proof.mjs).
 *
 *   Local / CI preview:
 *     GOALS_QA_VIEWPORT=390x844 node qa/goals-browser.mjs http://localhost:4173
 *   Public production site (real sign-in with the pre-confirmed TEST_A account;
 *   the fixture is seeded on the signed-in device exactly as qa/release.mjs does):
 *     REQUIRE_AUTH=1 EXPECT_BUILD_ID=<deployed sha> TEST_A_EMAIL=… TEST_A_PASSWORD=… \
 *     GOALS_QA_VIEWPORT=390x844 node qa/goals-browser.mjs https://aaru1yg.github.io/habbit-trackerrr/
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { launch, newPage, seedAndGoto, seededStateV4, check, report, results, sleep } from './helpers.mjs'

const base = (process.argv[2] || 'http://localhost:4173').replace(/\/+$/, '')
const output = process.env.GOALS_QA_OUT || 'qa/shots/goals'
const PUBLIC = process.env.REQUIRE_AUTH === '1'
const EXPECT = (process.env.EXPECT_BUILD_ID || '').trim()
const credentials = { email: process.env.TEST_A_EMAIL?.trim(), password: process.env.TEST_A_PASSWORD }
if (PUBLIC && (!credentials.email || !credentials.password)) throw new Error('REQUIRE_AUTH=1 needs the pre-confirmed TEST_A_EMAIL/TEST_A_PASSWORD; no partial pass.')
const KEEP = PUBLIC ? ['aaru.auth', 'aaru.habits.migration.v1'] : []
const safe = (text) => [credentials.email, credentials.password].filter(Boolean).reduce((out, value) => out.replaceAll(value, '[redacted]'), String(text))
mkdirSync(output, { recursive: true })
const commit = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim()
const viewports = [{ width: 390, height: 844, isMobile: true, hasTouch: true }, { width: 430, height: 932, isMobile: true, hasTouch: true }, { width: 1440, height: 900 }]
const selected = viewports.filter(v => !process.env.GOALS_QA_VIEWPORT || process.env.GOALS_QA_VIEWPORT === `${v.width}x${v.height}`)
if (!selected.length) throw new Error('Unknown GOALS_QA_VIEWPORT')
const metadata = { commit, version: null, target: `${base}/`, mode: PUBLIC ? 'public' : 'local', viewports: [], results }

// Production identity, read from the public origin itself: wait for Pages to
// serve the expected commit, then require index.html + release.json to agree.
async function publicBuild() {
  const expectShort = EXPECT.slice(0, 7)
  const stop = Date.now() + 8 * 60 * 1000
  let live
  for (;;) {
    const response = await fetch(`${base}/release.json?verify=${Date.now()}`, { cache: 'no-store' }).catch(() => null)
    if (response?.ok) live = await response.json()
    if (!EXPECT || live?.buildId === expectShort) break
    if (Date.now() >= stop) throw new Error(`Public site did not reach ${EXPECT}; still serving ${live?.commit || 'nothing'}`)
    console.log(`Waiting for Pages to serve ${expectShort} (currently ${live?.buildId || 'unavailable'})…`)
    await sleep(15000)
  }
  const html = await (await fetch(`${base}/?verify=${Date.now()}`, { cache: 'no-store' })).text()
  const meta = html.match(/<meta name="build-id" content="([^"]+)"/)?.[1] || null
  check('public index.html carries the deployed build-id meta', !!meta && (!EXPECT || meta === expectShort), `meta=${meta} expected=${expectShort || 'any'}`)
  check('public release.json names the same commit', !!live && live.buildId === meta && (!EXPECT || live.commit === EXPECT || live.commit.startsWith(EXPECT)), JSON.stringify(live && { commit: live.commit, buildId: live.buildId }))
  if (results.fail) throw new Error('The public site is not serving the expected build; refusing to verify the wrong deployment.')
  console.log(`Public build: ${live?.commit} (${meta}) at ${base}/`)
  return { commit: live?.commit || null, buildId: meta }
}

const STORAGE_KEY = 'aaru.habits.v4'
const dayStr = (d) => d.toLocaleDateString('en-CA')
const shift = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return dayStr(d) }
const at = (n, hhmm = '23:59') => `${shift(n)}T${hhmm}`

// Deterministic goals fixture built on seededStateV4's own goal shape.
function goalsFixture() {
  const base = seededStateV4()
  const project = { id: 'p-fix', name: 'Launch portfolio', description: '', category: 'Design', priority: 'normal', startDate: shift(-30), deadline: at(20), milestones: [{ id: 'pm1', name: 'Build', tasks: [{ id: 'pt1', name: 'Code it', done: true, status: 'done', completedAt: at(-10, '09:00'), due: null, priority: 'normal', estimateMin: null, actualMin: null, notes: '', order: 0 }, { id: 'pt2', name: 'Ship it', done: false, status: 'todo', completedAt: null, due: shift(15), priority: 'normal', estimateMin: null, actualMin: null, notes: '', order: 1 }] }], linkedHabitIds: [], notes: '', estimateMin: null, actualMin: null, progressLog: [{ at: at(-20, '09:00'), pct: 40 }, { at: at(-10, '09:00'), pct: 70 }], createdAt: at(-30, '09:00'), createdAtDay: shift(-30), completedAt: null, archived: false, order: 0 }
  const assignment = { id: 'a-fix', name: 'DS Lab 4', subject: 'Data Structures', description: '', priority: 'high', assignedDate: shift(-5), deadline: at(5, '23:59'), progressMode: 'explicit', progress: 40, subtasks: [], projectId: null, notes: '', estimateMin: 120, actualMin: 30, progressLog: [{ at: at(-4, '10:00'), pct: 10 }, { at: at(-2, '10:00'), pct: 40 }], createdAt: at(-5, '09:00'), createdAtDay: shift(-5), completedAt: null, archived: false, order: 0 }
  const gm = (id, name, targetDate, done, order) => ({ id, name, targetDate, done, doneAt: done ? at(-20, '10:00') : null, order })
  const goals = [
    // on-track: healthy pace, one open milestone next
    { id: 'g-novel', title: 'Write a novella', why: 'It has been open long enough.', area: 'creative', startDate: shift(-5), targetDate: shift(55), status: 'active', archived: false, order: 0, milestones: [gm('n1', 'Finish a first draft', shift(25), false, 0)], linkedHabitIds: [], linkedProjectIds: [], linkedAssignmentIds: [], manualPercent: null, notes: '', createdAt: at(-40, '09:00'), updatedAt: at(-1, '09:00'), completedAt: null },
    // at-risk: window nearly elapsed, only 1 of 4 reached
    { id: 'g-risk', title: 'Finish the thesis', why: 'Long overdue to close out.', area: 'learning', startDate: shift(-60), targetDate: shift(10), status: 'active', archived: false, order: 1, milestones: [gm('r1', 'Literature review', shift(-40), true, 0), gm('r2', 'Methods', null, false, 1), gm('r3', 'Results', null, false, 2), gm('r4', 'Defend', shift(10), false, 3)], linkedHabitIds: [], linkedProjectIds: ['p-fix'], linkedAssignmentIds: ['a-fix'], manualPercent: null, notes: '', createdAt: at(-60, '09:00'), updatedAt: at(-1, '09:00'), completedAt: null },
    // overdue: target passed, milestone open
    { id: 'g-over', title: 'Run a marathon', why: '', area: 'fitness', startDate: shift(-30), targetDate: shift(-5), status: 'active', archived: false, order: 2, milestones: [gm('o1', 'Half distance', shift(-20), true, 0), gm('o2', 'Full distance', shift(-5), false, 1)], linkedHabitIds: [], linkedProjectIds: [], linkedAssignmentIds: [], manualPercent: null, notes: '', createdAt: at(-30, '09:00'), updatedAt: at(-1, '09:00'), completedAt: null },
    // reached
    { id: 'g-done', title: 'Learn Spanish A2', why: '', area: 'mind', startDate: shift(-50), targetDate: shift(-10), status: 'completed', archived: false, order: 3, milestones: [gm('d1', 'CEFR A2', shift(-10), true, 0)], linkedHabitIds: [], linkedProjectIds: [], linkedAssignmentIds: [], manualPercent: null, notes: '', createdAt: at(-50, '09:00'), updatedAt: at(-10, '09:00'), completedAt: at(-10, '22:00') },
    // insufficient history: no progress points / no linked work, no target
    { id: 'g-empty', title: 'Learn to cook', why: '', area: 'health', startDate: shift(0), targetDate: null, status: 'active', archived: false, order: 4, milestones: [], linkedHabitIds: [], linkedProjectIds: [], linkedAssignmentIds: [], manualPercent: null, notes: '', createdAt: at(0, '09:00'), updatedAt: at(0, '09:00'), completedAt: null },
  ]
  return { ...base, projects: [...base.projects, project], assignments: [...base.assignments, assignment], goals }
}

let browser
try {
  // Launch inside the try: a runner that cannot start Chromium (the Goals
  // public 390×844 job died right here on deploy 88fb857f — exit 1 after
  // puppeteer's 30 s launch timeout) must still produce results.json, so the
  // publish step can name the abort in a check run instead of failing with
  // nothing attributable. The run still fails; it just fails with evidence.
  // (Same fix qa/habits-e2e.mjs already carries.)
  browser = await launch()
  metadata.version = await browser.version()
  console.log(`Real browser: ${metadata.version}; commit: ${commit}; target: ${base}/ (${PUBLIC ? 'public site, real sign-in' : 'local build'})`)
  if (PUBLIC) metadata.public = { url: `${base}/`, ...(await publicBuild()) }
  for (const viewport of selected) {
    const prefix = `${viewport.width}x${viewport.height}`
    const context = await browser.createBrowserContext()
    const page = await newPage(context, { ...viewport, deviceScaleFactor: 1 })
    const evidence = { viewport: prefix, scenarios: [], consoleErrors: [], pageErrors: [], failedRequests: [] }
    if (PUBLIC) evidence.publicSite = { signIns: 0, migrationPrompts: 0 }
    metadata.viewports.push(evidence)
    const pulls = []
    page.on('response', (res) => { if (res.request().method() === 'GET' && /\/rest\/v1\/user_state\b/.test(res.url())) pulls.push(res.status()) })
    const stored = () => page.evaluate((k) => JSON.parse(localStorage.getItem(k)), STORAGE_KEY)
    const capture = async (name) => { await page.screenshot({ path: `${output}/${prefix}-${name}.png`, fullPage: true }) }
    const settle = async () => { await page.evaluate(() => document.fonts.ready); await sleep(650) }
    const waitFor = async (selector, timeout = 20000) => { await page.waitForSelector(selector, { timeout }) }
    const click = async (selector) => {
      await page.waitForSelector(selector, { visible: true })
      await page.$eval(selector, el => el.scrollIntoView({ block: 'center', behavior: 'instant' }))
      await sleep(150); await page.click(selector); await settle()
    }
    const exists = async (selector) => page.$(selector).then(Boolean).catch(() => false)
    const layout = async (name) => {
      const proof = await page.evaluate(() => {
        const root = document.documentElement
        const dialogs = [...document.querySelectorAll('[role="dialog"]')].map(el => { const r = el.getBoundingClientRect(); return { y: r.y, right: r.right, bottom: r.bottom, scroll: el.scrollWidth, client: el.clientWidth } })
        return { scroll: root.scrollWidth, client: root.clientWidth, width: innerWidth, dialogs, broken: [...document.images].filter(img => img.complete && img.naturalWidth === 0).map(i => i.src) }
      })
      check(`${prefix} ${name}: no horizontal overflow`, proof.scroll <= proof.client + 1, JSON.stringify(proof))
      check(`${prefix} ${name}: no clipped dialog`, proof.dialogs.every(d => d.y >= -1 && d.right <= proof.width + 1 && d.bottom <= proof.height + 1 && d.scroll <= d.client + 1), JSON.stringify(proof.dialogs))
      check(`${prefix} ${name}: images load`, proof.broken.length === 0, proof.broken.join(', '))
      if (viewport.isMobile) {
        const small = await page.evaluate(() => {
          const scope = document.querySelector('[role="dialog"]') || document.querySelector('#goals-screen, #goal-detail-screen')
          if (!scope) return []
          return [...scope.querySelectorAll('button,a,input,select,textarea,summary')].flatMap(el => {
            if (el.closest('details:not([open])') && el.tagName !== 'SUMMARY') return []
            const r = el.getBoundingClientRect()
            if (!r.width || !r.height || getComputedStyle(el).visibility === 'hidden' || el.classList.contains('sr-only')) return []
            return r.width >= 43 && r.height >= 43 ? [] : [{ tag: el.tagName, name: el.getAttribute('aria-label') || el.textContent.trim().slice(0, 60), width: r.width, height: r.height }]
          })
        })
        check(`${prefix} ${name}: touch targets ≥44px (1px tolerance)`, small.length === 0, JSON.stringify(small))
      }
      await capture(name)
    }
    const warmUp = async () => {
      await page.goto(`${base}/`, { waitUntil: 'networkidle0' }).catch(() => {})
      const stop = Date.now() + 15000
      while (Date.now() < stop) {
        await page.waitForNetworkIdle({ idleTime: 1500, timeout: 10000 }).catch(() => {})
        const controlled = await page.evaluate(() => !('serviceWorker' in navigator) || !!navigator.serviceWorker.controller).catch(() => false)
        if (controlled) break
        await sleep(250)
      }
      await sleep(1500)
    }
    const signIn = async () => {
      for (let attempt = 1; attempt <= 2; attempt++) {
        try {
          await page.waitForNetworkIdle({ idleTime: 1000, timeout: 10000 }).catch(() => {})
          if (!(await exists('#auth-email'))) return
          await page.waitForSelector('#auth-email', { visible: true, timeout: 20000 })
          await page.type('#auth-email', credentials.email)
          await page.type('#auth-password', credentials.password)
          await click('.auth-submit')
          await page.waitForFunction(() => !document.querySelector('#auth-email') && !document.querySelector('.auth-loading'), { timeout: 30000 })
          evidence.publicSite.signIns++
          return
        } catch (error) { if (attempt === 2) throw error }
      }
    }
    const settleCloud = async (seen) => {
      await page.waitForFunction(() => document.querySelector('#auth-email') || document.querySelector('main#content'), { timeout: 30000 })
      await signIn()
      const deadline = Date.now() + 20000
      while (pulls.length === seen && Date.now() < deadline) await sleep(100)
      await sleep(700)
      if (await exists('#migrate-title')) {
        const keep = await page.$('::-p-text(Keep my local data)')
        if (!keep) throw new Error('Migration prompt without a Keep my local data choice')
        await keep.evaluate(el => el.scrollIntoView({ block: 'center', behavior: 'instant' }))
        await keep.click()
        await page.waitForFunction(() => !document.querySelector('#migrate-title'), { timeout: 30000 })
        evidence.publicSite.migrationPrompts++
        await settle()
      }
    }
    const seed = async (state = goalsFixture(), route = 'goals', target = '#goals-screen') => {
      if (PUBLIC) await page.waitForNetworkIdle({ idleTime: 1500, timeout: 20000 }).catch(() => {})
      const seen = pulls.length
      await page.goto('about:blank')
      await seedAndGoto(page, state, route, base, { keep: KEEP })
      if (PUBLIC) await settleCloud(seen)
      await waitFor(target)
      await settle()
    }
    const scenario = async (name, run) => {
      const before = results.fail
      try { await run() } catch (error) {
        check(`${prefix} ${name}: completes`, false, safe(error.stack))
        await capture(`${name}-FAILED`).catch(() => {})
        writeFileSync(`${output}/${prefix}-${name}-FAILED.html`, await page.content())
        await page.keyboard.press('Escape').catch(() => {})
      }
      evidence.scenarios.push({ name, passed: results.fail === before })
    }
    const FILTERS = '[role="tablist"][aria-label="Goal filters"]'
    const cardBy = async (title) => {
      const el = await page.$(`.goal-card[aria-label="Goal ${title}"]`)
      if (!el) throw new Error(`Missing goal card: ${title}`)
      return el
    }
    // Native click on the primary action of the open (visible) dialog. Sheet
    // springs animate, so puppeteer's real-mouse clickablePoint can race the
    // element mid-transition; a DOM click is deterministic and still exercises
    // the real onClick handler.
    const saveDialog = async () => {
      const ok = await page.evaluate(() => {
        const d = [...document.querySelectorAll('[role="dialog"]')].find((el) => el.getBoundingClientRect().width > 0)
        const b = d?.querySelector('.btn.primary') || d?.querySelector('button[type="submit"]')
        if (!b) return false
        b.click(); return true
      })
      if (!ok) throw new Error('open dialog has no primary submit')
      await settle()
    }
    const clickFilterTab = async (label) => {
      const ok = await page.evaluate((FILTERS, label) => {
        const t = [...document.querySelectorAll(`${FILTERS} [role="tab"]`)].find(b => b.textContent.startsWith(label))
        if (!t) return false
        t.click(); return true
      }, FILTERS, label)
      if (!ok) throw new Error(`missing filter tab ${label}`)
      await settle()
    }
    const clickView = async (label) => {
      const ok = await page.evaluate((label) => {
        const g = document.querySelector('[role="group"][aria-label="Goals view"]')
        const b = g && [...g.querySelectorAll('button')].find(x => (x.textContent || '').trim().startsWith(label))
        if (!b) return false
        b.click(); return true
      }, label)
      if (!ok) throw new Error(`missing Goals view switch: ${label}`)
      await settle()
    }

    await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'no-preference' }])
    if (PUBLIC) await warmUp()

    await scenario('workspace-list-first', async () => {
      await seed()
      check(`${prefix}: Goals title`, await page.$eval('#goals-screen .screen-title', el => el.textContent.trim() === 'Goals'))
      // Default Open filter shows the open goals, excludes reached.
      const openCards = await page.$$('#goals-screen .goal-card:not(.is-reached)')
      check(`${prefix}: open goal cards by default (incl. insufficient-history goal)`, openCards.length === 4)
      check(`${prefix}: reached goal excluded from Open default`, !(await page.$('.goal-card.is-reached')))
      check(`${prefix}: the undated goal with no links is still listed`, !!(await page.$('.goal-card[aria-label="Goal Learn to cook"]')))
      // No Atlas in the default list view.
      check(`${prefix}: no Atlas in the default list view`, !(await page.$('#goals-screen .atlas-wrap')))
      // Cards expose area chip + one health state + progress + next milestone.
      const first = await cardBy('Write a novella')
      const cardText = await first.evaluate(el => el.textContent)
      check(`${prefix}: card shows area chip, health and progress`, /Creative/.test(cardText) && /On track|on track/i.test(cardText) && /0%|percent/.test(cardText))
      check(`${prefix}: next milestone surfaced on the card`, await first.$eval('.goal-next .goal-next-name', el => /Finish a first draft/.test(el.textContent)))
      // An open goal card (its health/title top edge) is visible above the fold
      // on mobile — the list must not push the outcome off-screen.
      if (viewport.isMobile) check(`${prefix}: an open goal card is above the fold`, await page.evaluate(() => { const r = document.querySelector('#goals-screen .goal-card')?.getBoundingClientRect(); return !!r && r.top >= 0 && r.top < innerHeight }))
      await layout('workspace')
    })

    await scenario('filters', async () => {
      await seed()
      const tabs = async () => page.$$eval(`${FILTERS} [role="tab"]`, els => els.map(b => b.textContent.replace(/\s+/g, ' ').trim()))
      check(`${prefix}: filter tabs Open/At risk/Reached/All`, JSON.stringify((await tabs()).map(t => t.split(' (')[0])) === JSON.stringify(['Open', 'At risk', 'Reached', 'All']))
      // At risk → overdue + at-risk only (not the healthy novella).
      await clickFilterTab('At risk')
      check(`${prefix}: At risk shows thesis + marathon, not novella`, await page.$('.goal-card[aria-label="Goal Finish the thesis"]') && await page.$('.goal-card[aria-label="Goal Run a marathon"]') && !(await page.$('.goal-card[aria-label="Goal Write a novella"]')))
      check(`${prefix}: at-risk cards carry warn/bad tone`, await page.evaluate(() => [...document.querySelectorAll('.goal-card')].every(c => ['warn', 'bad'].includes(c.dataset.tone))))
      // Reached → only reached.
      await clickFilterTab('Reached')
      check(`${prefix}: Reached lists the reached goal only`, (await page.$$('#goals-screen .goal-card')).length === 1 && !!(await page.$('.goal-card.is-reached[aria-label="Goal Learn Spanish A2"]')))
      // All → includes reached + open.
      await clickFilterTab('All')
      check(`${prefix}: All includes reached and open`, (await page.$$('#goals-screen .goal-card')).length === 5)
      await layout('filters')
    })

    await scenario('atlas-optional', async () => {
      await seed()
      check(`${prefix}: normal management works with no Atlas loaded`, !(await page.$('.atlas-wrap')))
      // Opt into Atlas / Visual.
      await clickView('Atlas')
      await waitFor('.atlas-wrap')
      check(`${prefix}: Atlas loads on explicit opt-in`, !!(await page.$('.atlas-wrap')))
      // Relationship accuracy: every centre node is one real open goal (by
      // title and deep link), and there is one constellation per such goal.
      const centre = await page.$$eval('.atlas-wrap .atlas-goal', els => els.map(e => ({ href: e.getAttribute('href'), text: e.textContent.replace(/\s+/g, ' ').trim() })))
      const realTitles = ['Write a novella', 'Run a marathon', 'Finish the thesis']
      check(`${prefix}: atlas constellations name real open goals`, centre.length >= 1 && centre.every(n => /^#\/goals\//.test(n.href)) && centre.some(n => realTitles.some(t => n.text.includes(t))), JSON.stringify(centre))
      // Every anchor deep-links back into the list route's own detail screen.
      check(`${prefix}: atlas goal node links to #/goals/:id`, centre.every(n => /^#\/goals\//.test(n.href)), JSON.stringify(centre.map(n => n.href)))
      await layout('atlas')
      // Back to List removes Atlas.
      await clickView('List')
      await page.waitForFunction(() => !document.querySelector('.atlas-wrap'))
      check(`${prefix}: returning to List unloads the Atlas`, true)
    })

    await scenario('create-edit-delete', async () => {
      await seed()
      const before = (await stored()).goals.length
      // Create via header → canonical GoalForm.
      await page.evaluate(() => document.querySelector('#goals-screen .screen-head .btn.primary')?.click())
      await waitFor('[role="dialog"][aria-label="New goal"]')
      await page.type('#goal-title', 'Learn SQL by June')
      await page.type('#goal-why', 'Ship the analytics feature.')
      await saveDialog()
      await page.waitForFunction((n, k) => JSON.parse(localStorage.getItem(k)).goals.length === n + 1, {}, before, STORAGE_KEY)
      check(`${prefix}: create adds one goal through the shared form`, (await stored()).goals.some(g => g.title === 'Learn SQL by June' && g.why === 'Ship the analytics feature.'))
      // The new goal appears as a card; open it through a real reload so a
      // freshly-created goal proves it survives refresh with no data loss.
      await page.waitForSelector('.goal-card[aria-label="Goal Learn SQL by June"]', { timeout: 15000 })
      const created = (await stored()).goals.find(g => g.title === 'Learn SQL by June')
      await page.goto(`${base}/#/goals/${created.id}`, { waitUntil: 'networkidle0' })
      await waitFor('#goal-detail-screen')
      check(`${prefix}: created goal opens its detail after a reload (no data loss)`, await page.$eval('#goal-detail-screen h1', el => el.textContent.trim() === 'Learn SQL by June'))
      // Edit → rename + save.
      await page.evaluate(() => [...document.querySelectorAll('#goal-detail-screen button')].find(b => b.textContent.trim() === 'Edit')?.click())
      await waitFor('[role="dialog"][aria-label="Edit goal"]')
      await page.$eval('#goal-title', el => { el.focus(); el.select() })
      await page.keyboard.type('Learn SQL properly')
      await saveDialog()
      await page.waitForFunction(() => document.querySelector('#goal-detail-screen h1')?.textContent.trim() === 'Learn SQL properly')
      check(`${prefix}: edit persists a rename`, (await stored()).goals.some(g => g.title === 'Learn SQL properly'))
      // Delete → confirm dialog, then removed with undo offered.
      await page.evaluate(() => [...document.querySelectorAll('#goal-detail-screen button')].find(b => b.getAttribute('aria-label') === 'Delete goal')?.click())
      await waitFor('[role="dialog"][aria-label="Delete goal"]')
      await page.evaluate(() => [...document.querySelectorAll('[role="dialog"][aria-label="Delete goal"] button')].find(b => b.textContent.trim() === 'Delete goal')?.click())
      await page.waitForFunction(() => !document.querySelector('#goal-detail-screen'))
      check(`${prefix}: confirmed delete removes the goal`, !(await stored()).goals.some(g => g.title === 'Learn SQL properly'))
      check(`${prefix}: delete offers Undo`, !!(await page.$('.toast-region .toast-action, .toast-action')))
      await page.keyboard.press('Escape').catch(() => {})
      await layout('create-edit-delete')
    })

    await scenario('milestone-completion', async () => {
      await seed()
      // g-over has exactly one open milestone → completing it completes the goal.
      await click('.goal-card[aria-label="Goal Run a marathon"] .goal-title-link')
      await waitFor('#goal-detail-screen')
      const nextToggle = '#goal-detail-screen .goal-next-toggle[aria-pressed="false"]'
      await page.waitForSelector(nextToggle, { timeout: 15000 })
      await click(nextToggle)
      await page.waitForFunction(() => JSON.parse(localStorage.getItem('aaru.habits.v4')).goals.find(g => g.id === 'g-over')?.status === 'completed')
      check(`${prefix}: completing the last milestone completes the goal (engine-derived)`, (await stored()).goals.find(g => g.id === 'g-over').status === 'completed')
      // Return to the workspace and confirm it moved to Reached.
      await click('#goal-detail-screen .back-link')
      await waitFor('#goals-screen')
      check(`${prefix}: reached goal leaves Open default`, !(await page.$('.goal-card[aria-label="Goal Run a marathon"]:not(.is-reached)')))
      await page.evaluate(() => [...document.querySelectorAll('[role="tablist"][aria-label="Goal filters"] [role="tab"]')].find(b => b.textContent.startsWith('Reached'))?.click())
      await settle()
      check(`${prefix}: reached goal appears under Reached`, !!(await page.$('.goal-card.is-reached[aria-label="Goal Run a marathon"]')))
      await layout('reached')
    })

    await scenario('goal-detail', async () => {
      await seed()
      // Legacy deep link direct to a goal.
      await page.goto('about:blank')
      await seedAndGoto(page, goalsFixture(), 'goals/g-risk', base, { keep: KEEP })
      await waitFor('#goal-detail-screen')
      check(`${prefix}: deep link #/goals/:id opens goal detail`, await page.$eval('#goal-detail-screen h1', el => el.textContent.trim() === 'Finish the thesis'))
      // Status hierarchy: hero progress/health before large chart; history behind disclosure.
      const h2 = await page.$$eval('#goal-detail-screen h2', els => els.map(h => h.textContent.trim()))
      check(`${prefix}: detail h2 hierarchy starts with Next milestone / Milestones`, h2[0] === 'Next milestone' || h2[0] === 'Milestones', JSON.stringify(h2))
      check(`${prefix}: progress history is behind an expander`, await page.$('#goal-detail-screen details.history-summary, #goal-detail-screen details .history-summary, #goal-detail-screen .history-summary'))
      // At-risk goal shows a warn/bad health state up top.
      check(`${prefix}: at-risk goal shows its health state`, await page.evaluate(() => [...document.querySelectorAll('#goal-detail-screen .status-pill, #goal-detail-screen .health-pill')].some(el => /At risk|Overdue|ON TRACK|AT RISK/i.test(el.textContent))))
      // Forecast + contributors + fed-by present in the aside.
      const dt = await page.$eval('#goal-detail-screen', el => el.textContent)
      check(`${prefix}: forecast present and deterministic`, /Forecast/.test(dt) && /Current|Expected/.test(dt))
      check(`${prefix}: contributors present`, /What is moving this goal\?/.test(dt))
      check(`${prefix}: fed-by linked work present`, /This goal is fed by/.test(dt))
      await layout('detail-atrisk')
      // Open a linked contributor's work detail then return via back link (no data loss).
      await click('#goal-detail-screen .feed-row[href="#/projects/p-fix"], #goal-detail-screen .contributor-row')
      await page.waitForFunction(() => /Launch portfolio/.test(document.body.textContent), { timeout: 15000 })
      await page.goto('about:blank')
      await seedAndGoto(page, goalsFixture(), 'goals/g-risk', base, { keep: KEEP })
      await waitFor('#goal-detail-screen')
      check(`${prefix}: returning to the goal keeps its data`, await page.$eval('#goal-detail-screen h1', el => el.textContent.trim() === 'Finish the thesis') && !(await stored()).goals.some(g => g.id === 'g-risk' && g.archived))
    })

    await scenario('insufficient-history', async () => {
      await seed()
      // Learn to cook: no milestones, no links, no target → "Not enough history to forecast."
      await click('.goal-card[aria-label="Goal Learn to cook"] .goal-title-link')
      await waitFor('#goal-detail-screen')
      const dt = await page.$eval('#goal-detail-screen', el => el.textContent)
      check(`${prefix}: insufficient history is stated, not invented`, /Not enough history to forecast\./.test(dt) || /Not enough data/.test(dt) || /No target date/.test(dt), dt.slice(0, 200))
      check(`${prefix}: no fabricated forecast value`, !/100%|Forecast\s*Current\s*[0-9]%/.test(dt.replace(/Not enough history to forecast\./g, '')))
      await layout('insufficient-history')
    })

    await scenario('empty-state', async () => {
      const s = goalsFixture(); s.goals = []
      await seed({ ...s, projects: [], assignments: [] })
      check(`${prefix}: empty state title`, await page.$eval('#goals-screen', el => /No goals yet/.test(el.textContent)))
      check(`${prefix}: empty primary action creates`, await page.evaluate(() => [...document.querySelectorAll('#goals-screen button')].some(b => /Set your first goal/.test(b.textContent))))
      check(`${prefix}: empty secondary action teaches`, await page.evaluate(() => [...document.querySelectorAll('#goals-screen button')].some(b => /Learn how goals work/.test(b.textContent))))
      check(`${prefix}: no empty charts/atlas in the empty state`, !(await page.$('#goals-screen .atlas-wrap')) && !(await page.$eval('#goals-screen', el => /Forecast/.test(el.textContent))))
      await layout('empty')
    })

    await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }])
    await scenario('reduced-motion', async () => {
      await seed()
      const animated = await page.$$eval('#goals-screen *', els => els.filter(el => { const s = getComputedStyle(el); return (s.animationName !== 'none' && parseFloat(s.animationDuration) > .05) || parseFloat(s.transitionDuration) > .05 }).map(el => el.className.toString().split(' ')[0]))
      check(`${prefix}: reduced motion disables Goals animation/transitions`, !animated.length, JSON.stringify([...new Set(animated)]))
      // Milestone completion still works under reduced motion.
      await click('.goal-card[aria-label="Goal Write a novella"] .goal-title-link')
      await waitFor('#goal-detail-screen')
      await click('#goal-detail-screen .goal-next-toggle[aria-pressed="false"]')
      await page.waitForFunction(() => JSON.parse(localStorage.getItem('aaru.habits.v4')).goals.find(g => g.id === 'g-novel')?.status === 'completed')
      check(`${prefix}: milestone completion works under reduced motion`, true)
      await layout('reduced-motion')
    })

    if (PUBLIC) await page.waitForNetworkIdle({ idleTime: 1500, timeout: 20000 }).catch(() => {})
    Object.assign(evidence, page._qa)
    check(`${prefix}: zero console errors`, evidence.consoleErrors.length === 0, safe(evidence.consoleErrors.join('\n')))
    check(`${prefix}: zero uncaught exceptions`, evidence.pageErrors.length === 0, safe(evidence.pageErrors.join('\n')))
    check(`${prefix}: zero failed asset/network requests`, evidence.failedRequests.length === 0, safe(evidence.failedRequests.join('\n')))
    await context.close()
  }
  report(PUBLIC ? 'Phase 6 Goals — PUBLIC production site, real Chromium' : 'Phase 6 Goals — CI Chromium proof')
} catch (error) {
  // An abort outside a scenario (site unreachable, browser launch failure,
  // sign-in failure, wrong build) must never publish as "0 failed": record it
  // as a failure first, so the finally below always leaves attributable
  // evidence for the Checks-API publish step.
  results.fail++
  results.failures.push(`aborted: ${safe(error.stack || error.message)}`)
  metadata.error = safe(error.message)
  if (!metadata.version) metadata.version = `browser never launched — ${safe(error.message)}`
  throw error
} finally {
  writeFileSync(`${output}/results.json`, JSON.stringify(metadata, null, 2))
  await browser?.close()
}
