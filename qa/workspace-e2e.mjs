/* Phase 4 final browser proof. Uses the real production app and persisted
 * fixture; no mocked engines, no remote user data, no deployment. Each CI
 * matrix job saves screenshots, browser version, DOM failures and results. */
import { mkdirSync, writeFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { launch, newPage, seedAndGoto, check, report, results, sleep } from './helpers.mjs'
import { workspaceFixture } from '../test/workspace.fixture.js'

const base = process.argv[2] || 'http://localhost:4173'
const output = 'qa/shots/workspace'
mkdirSync(output, { recursive: true })
const browser = await launch()
const version = await browser.version()
const commit = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim()
console.log(`Real browser: ${version}; commit: ${commit}`)
const viewports = [{ width: 390, height: 844, isMobile: true, hasTouch: true }, { width: 430, height: 932, isMobile: true, hasTouch: true }, { width: 1440, height: 900 }]
const selected = viewports.filter(v => !process.env.WORK_QA_VIEWPORT || process.env.WORK_QA_VIEWPORT === `${v.width}x${v.height}`)
if (!selected.length) throw new Error('Unknown WORK_QA_VIEWPORT')
const metadata = { commit, version, viewports: [], results }

try {
  for (const viewport of selected) {
    const prefix = `${viewport.width}x${viewport.height}`
    const page = await newPage(browser, { ...viewport, deviceScaleFactor: 1 })
    const evidence = { viewport: prefix, scenarios: [], consoleErrors: [], pageErrors: [], failedRequests: [] }
    metadata.viewports.push(evidence)
    const capture = async name => {
      await page.screenshot({ path: `${output}/${prefix}-${name}.png`, fullPage: true })
    }
    const settle = async () => {
      await page.evaluate(() => document.fonts.ready)
      await sleep(650)
    }
    const goto = async (route, target = '#work-screen') => {
      await page.evaluate(to => { location.hash = `#/${to}`; scrollTo(0, 0) }, route)
      await page.waitForFunction(to => location.hash === `#/${to}`, {}, route)
      await page.waitForSelector(target)
      await settle()
    }
    // Native pointer input, not element.click(): detect occlusion and real hit targets.
    const click = async selector => {
      await page.waitForSelector(selector, { visible: true })
      await page.$eval(selector, el => el.scrollIntoView({ block: 'center', behavior: 'instant' }))
      await sleep(150)
      await page.click(selector)
      await settle()
    }
    const clickText = async (text, scope = '#work-screen', tag = 'button') => {
      const found = await page.evaluate((text, scope, tag) => {
        document.querySelectorAll('[data-qa-click]').forEach(el => el.removeAttribute('data-qa-click'))
        const el = [...document.querySelectorAll(`${scope} ${tag}`)].find(el => el.textContent.trim() === text && el.getBoundingClientRect().height > 0)
        if (!el) return false
        el.dataset.qaClick = 'true'
        return true
      }, text, scope, tag)
      if (!found) throw new Error(`Missing ${tag}: ${text} (${scope})`)
      await click('[data-qa-click="true"]')
    }
    const layout = async name => {
      const proof = await page.evaluate(() => {
        const root = document.documentElement
        const dialogs = [...document.querySelectorAll('[role="dialog"]')].map(el => {
          const r = el.getBoundingClientRect()
          return { title: el.getAttribute('aria-labelledby'), x: r.x, y: r.y, right: r.right, bottom: r.bottom, scroll: el.scrollWidth, client: el.clientWidth }
        })
        return { scroll: root.scrollWidth, client: root.clientWidth, width: innerWidth, height: innerHeight, dialogs,
          brokenImages: [...document.images].filter(img => img.complete && img.naturalWidth === 0).map(img => img.src) }
      })
      check(`${prefix} ${name}: no horizontal overflow`, proof.scroll <= proof.client + 1, JSON.stringify(proof))
      check(`${prefix} ${name}: no clipped dialog`, proof.dialogs.every(d => d.x >= -1 && d.y >= -1 && d.right <= proof.width + 1 && d.bottom <= proof.height + 1 && d.scroll <= d.client + 1), JSON.stringify(proof.dialogs))
      check(`${prefix} ${name}: images load`, proof.brokenImages.length === 0, proof.brokenImages.join(', '))
      if (viewport.isMobile) {
        const small = await page.evaluate(() => {
          const scope = document.querySelector('[role="dialog"]') || document.querySelector('#work-screen, #project-detail, #assignment-detail')
          if (!scope) return []
          return [...scope.querySelectorAll('button,a,input,select,textarea,summary')].flatMap(el => {
            if (el.closest('details:not([open])') && el.tagName !== 'SUMMARY') return []
            const r = el.getBoundingClientRect(), cs = getComputedStyle(el)
            if (!r.width || !r.height || cs.visibility === 'hidden' || el.classList.contains('sr-only')) return []
            const label = el.closest('label')
            const lr = label?.getBoundingClientRect()
            if (lr && lr.width >= 43 && lr.height >= 43) return []
            return r.width >= 43 && r.height >= 43 ? [] : [{ tag: el.tagName, name: el.getAttribute('aria-label') || el.textContent.trim().slice(0, 70), width: r.width, height: r.height }]
          })
        })
        check(`${prefix} ${name}: touch targets at least 44px (1px rounding tolerance)`, small.length === 0, JSON.stringify(small))
      }
      await capture(name)
    }
    const seed = async (state = workspaceFixture(), route = 'work') => {
      await seedAndGoto(page, state, route, base)
      await page.waitForSelector('#work-screen')
      await settle()
    }
    const scenario = async (name, run) => {
      const before = results.fail
      try { await run() } catch (error) {
        check(`${prefix} ${name}: completes`, false, error.stack)
        await capture(`${name}-FAILED`).catch(() => {})
        writeFileSync(`${output}/${prefix}-${name}-FAILED.html`, await page.content())
        // A failed scenario must not strand a modal over all later journeys.
        await page.keyboard.press('Escape').catch(() => {})
      }
      evidence.scenarios.push({ name, passed: results.fail === before })
    }
    // Standard-motion and reduced-motion layouts both run on each CI viewport.
    await scenario('normal-motion', async () => {
      await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'no-preference' }])
      await seed()
      const summary = await page.$$eval('.workspace-summary a', els => els.map(el => el.textContent))
      check(`${prefix}: At Risk / Due Soon / Active Work visible`, ['At risk', 'Due soon', 'Active work'].every(label => summary.some(t => t.includes(label))))
      check(`${prefix}: canonical Work opens with Overview selected`, await page.$eval('.workspace-tabs a[aria-current="page"]', el => el.textContent === 'Overview'))
      check(`${prefix}: no default gallery`, !(await page.$('.gal-grid')))
      const top = await page.$eval('.workspace-active', el => el.getBoundingClientRect().top)
      check(`${prefix}: active work starts above fold`, top < viewport.height - 80, `top=${top}`)
      await layout('overview-normal')
    })
    await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }])
    await scenario('views-reduced-motion', async () => {
      await seed()
      const animated = await page.$$eval('.workspace *', els => els.filter(el => {
        const s = getComputedStyle(el)
        return s.animationName !== 'none' && parseFloat(s.animationDuration) > .01 || parseFloat(s.transitionDuration) > .01
      }).map(el => el.className))
      check(`${prefix}: reduced motion disables Work animation/transitions`, !animated.length, JSON.stringify(animated))
      await layout('overview-reduced')
      for (const view of ['deliverables', 'projects', 'workload', 'deadlines']) {
        await click(`.workspace-tabs a[href="#/work?view=${view}"]`)
        check(`${prefix}: ${view} switches and is selected`, await page.$eval(`.workspace-tabs a[href="#/work?view=${view}"]`, el => el.getAttribute('aria-current') === 'page'))
        await layout(view)
      }
    })
    await scenario('assignment-focus-dialogs', async () => {
      await seed(workspaceFixture(), 'work?view=deliverables')
      await click('[aria-label="View Submit DSA report"]')
      await page.waitForSelector('#assignment-detail')
      check(`${prefix}: assignment deadline/progress/subtasks present`, await page.$eval('#assignment-detail', el => ['Deadline', 'Progress', 'Next action', 'Subtasks'].every(t => el.textContent.includes(t))))
      await layout('assignment-detail')
      await clickText('Start Focus', '#assignment-detail')
      await page.waitForSelector('[role="dialog"] .focus-mode')
      check(`${prefix}: chosen assignment owns Focus`, await page.$eval('[role="dialog"]', el => el.textContent.includes('Submit DSA report')))
      await layout('focus-dialog')
      await clickText('Start', '[role="dialog"]')
      await page.waitForFunction(() => [...document.querySelectorAll('[role="dialog"] button')].some(el => el.textContent === 'Pause'))
      check(`${prefix}: Focus starts`, true)
      for (let i = 0; i < 12; i++) await page.keyboard.press('Tab')
      check(`${prefix}: dialog traps keyboard focus`, await page.evaluate(() => !!document.activeElement.closest('[role="dialog"]')))
      await page.keyboard.press('Escape')
      await page.waitForSelector('[role="dialog"]', { hidden: true })
      check(`${prefix}: Escape closes Focus and restores trigger`, await page.evaluate(() => document.activeElement.textContent === 'Start Focus'))
      await goto('work?view=deliverables')
      await click('[aria-label="Actions for Submit DSA report"]')
      await layout('item-actions-dialog')
      await page.keyboard.press('Escape')
      await goto('work')
      await clickText('Create work', '#work-screen .head-actions')
      await layout('create-work-dialog')
      await page.keyboard.press('Escape')
      await page.waitForSelector('[role="dialog"]', { hidden: true })
    })
    await scenario('project-tasks-deep-links-gallery', async () => {
      await seed(workspaceFixture(), 'work?view=projects')
      await clickText('Gallery / spatial')
      await page.waitForSelector('.gal-grid')
      check(`${prefix}: gallery mounts only after selection`, (await page.$$('.gal-item')).length > 0)
      await layout('project-gallery')
      await clickText('List')
      check(`${prefix}: gallery unmounts for List`, !(await page.$('.gal-grid')))
      await click('[aria-label="View Habit OS"]')
      await page.waitForSelector('#project-detail')
      await layout('project-detail')
      await goto('projects/p1?task=t1', '#work-task-t1')
      await page.waitForFunction(() => document.activeElement.id === 'work-task-t1')
      check(`${prefix}: task deep link focuses real editor`, true)
      await layout('task-deep-link')
      await goto('projects/p1?milestone=m1', '#work-milestone-m1')
      await page.waitForFunction(() => document.activeElement.id === 'work-milestone-m1')
      check(`${prefix}: milestone deep link works`, true)
      await click('[aria-label="Mark Finish API layer done"]')
      await page.waitForFunction(() => JSON.parse(localStorage.getItem('aaru.habits.v4')).projects[0].milestones[0].tasks[0].done)
      check(`${prefix}: task completion persists`, true)
    })
    await scenario('workload-overload-plan-recover', async () => {
      await seed(workspaceFixture(), 'work?view=workload')
      check(`${prefix}: single overload explanation`, (await page.$$('.workspace-overload')).length === 1)
      check(`${prefix}: seven capacity days`, (await page.$$('.workspace-days button')).length === 7)
      await click('.workspace-days button:nth-child(2)')
      check(`${prefix}: workload day selection works`, await page.$eval('.workspace-days button:nth-child(2)', el => el.getAttribute('aria-pressed') === 'true'))
      await clickText('Plan', '.workspace-overload')
      await page.waitForSelector('[role="dialog"] .planning-panel')
      await layout('plan-dialog')
      await page.keyboard.press('Escape')
      await page.waitForSelector('[role="dialog"]', { hidden: true })
      await clickText('Recover', '.workspace-overload')
      await page.waitForSelector('[role="dialog"]')
      check(`${prefix}: recovery remains suggestion-only`, await page.$eval('[role="dialog"]', el => el.textContent.includes('nothing moves automatically')))
      await layout('recover-dialog')
      await page.keyboard.press('Escape')
    })
    await scenario('deadlines-filters-keyboard-completed', async () => {
      await seed()
      await click('.workspace-horizons a[href*="horizon=today"]')
      await page.waitForSelector('#deadlines-heading')
      check(`${prefix}: Today horizon filters deadline groups`, await page.$$eval('.workspace-deadline-group h3', els => els.length === 1 && els[0].textContent === 'Today'))
      await click('[aria-label="View Submit DSA report"]')
      await page.waitForSelector('#assignment-detail')
      check(`${prefix}: deadline opens original assignment link`, await page.evaluate(() => location.hash === '#/assignments/a1'))
      await goto('work?view=deliverables')
      await page.$eval('.workspace-filters button', el => el.focus())
      await page.keyboard.press('Enter')
      await page.waitForFunction(() => location.hash.includes('filter=all'))
      check(`${prefix}: keyboard operates filters`, true)
      await clickText('Overdue', '.workspace-filters')
      check(`${prefix}: overdue filter contains only overdue work`, await page.$$eval('.workspace-row-title', els => els.length === 1 && els[0].textContent === 'Overdue lab'))
      await clickText('Completed', '.workspace-filters')
      check(`${prefix}: completed work is quiet and separate`, await page.$$eval('.workspace-row', els => els.length === 1 && els[0].classList.contains('is-complete') && els[0].textContent.includes('Delivered paper')))
      await layout('completed')
      await clickText('Active', '.workspace-filters')
      await page.type('.workspace-search input', 'DSA')
      check(`${prefix}: local work filter works`, await page.$$eval('.workspace-row-title', els => els.length === 1 && els[0].textContent === 'Submit DSA report'))
      await page.focus('.workspace-tabs a[href="#/work?view=projects"]')
      await page.keyboard.press('Enter')
      await page.waitForSelector('#projects-heading')
      check(`${prefix}: keyboard operates Work navigation`, true)
    })
    await scenario('legacy-routes-and-empty-state', async () => {
      await seed()
      for (const [route, selectedView] of [['projects', 'projects'], ['assignments', 'deliverables'], ['workload', 'workload'], ['timeline', 'deadlines']]) {
        await goto(route)
        check(`${prefix}: legacy ${route} selects ${selectedView}`, await page.$eval('.workspace-tabs a[aria-current="page"]', el => el.getAttribute('href')).then(href => href === `#/work?view=${selectedView}`))
        await layout(`legacy-${route}`)
      }
      const empty = { ...workspaceFixture(), projects: [], assignments: [] }
      await seed(empty)
      check(`${prefix}: empty state has guidance without analytics`, await page.$eval('#work-screen', el => el.textContent.includes('Your work starts here.') && !el.querySelector('.workspace-capacity')))
      await layout('empty')
      await clickText('Create project', '#work-screen .head-actions')
      await layout('create-project-dialog')
      await page.keyboard.press('Escape')
    })
    Object.assign(evidence, page._qa)
    check(`${prefix}: zero console errors`, evidence.consoleErrors.length === 0, evidence.consoleErrors.join('\n'))
    check(`${prefix}: zero uncaught exceptions`, evidence.pageErrors.length === 0, evidence.pageErrors.join('\n'))
    check(`${prefix}: zero failed asset/network requests`, evidence.failedRequests.length === 0, evidence.failedRequests.join('\n'))
    await page.close()
  }
  report('Phase 4 Work — CI Chromium proof')
} finally {
  writeFileSync(`${output}/results.json`, JSON.stringify(metadata, null, 2))
  await browser.close()
}
