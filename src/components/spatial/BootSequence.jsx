/* ============================================================
   BOOT SEQUENCE — "you enter Habit OS" (spec §6).

   A cold-load cinematic: dark screen → planes rise from depth →
   mark → editorial headline → the environment resolves and the
   workspace is already there. The app renders behind it from the
   first frame; the overlay is pure presentation and:

     - plays at most once per browser session (sessionStorage)
     - skips itself for reduced motion, low tiers and automation
       (navigator.webdriver) — deterministic for e2e, calm for users
     - is skippable instantly (click / Enter / Escape / Skip button)
     - never touches auth, store or router — it just fades
   ============================================================ */
import { useEffect, useRef, useState } from 'react'
import { prefersReducedMotion, getCapability } from '../../lib/capability.js'
import { BrandMark } from '../layout/Navigation.jsx'

const SESSION_KEY = 'aaru.boot.v4'
const HOLD_MS = 1420   // sequence length before it dissolves
const FADE_MS = 420    // dissolve itself

const sessionSeen = () => {
  try { return sessionStorage.getItem(SESSION_KEY) === '1' } catch { return true }
}
const markSeen = () => {
  try { sessionStorage.setItem(SESSION_KEY, '1') } catch { /* private mode: fine */ }
}

export default function BootSequence() {
  const [visible, setVisible] = useState(false)
  const [out, setOut] = useState(false)
  const timers = useRef([])

  useEffect(() => {
    let forced = null
    try { forced = localStorage.getItem('aaru.boot') } catch { /* ok */ }

    const automation = typeof navigator !== 'undefined' && navigator.webdriver === true
    // QA hooks (both device-scoped, both deterministic for e2e):
    //   localStorage['aaru.boot'] = 'on'  → always play (even in automation)
    //   localStorage['aaru.boot'] = 'off' → never play
    const skip = forced === 'on'
      ? false
      : forced === 'off'
      || prefersReducedMotion()
      || getCapability().tier === 'low'
      || automation
      || sessionSeen()

    if (skip) return undefined

    markSeen()
    setVisible(true)
    // While the cinematic is up it owns the keyboard: '/' must not slip
    // behind the overlay and open the search palette mid-entry.
    window.__aaruBoot = true

    const t1 = setTimeout(() => setOut(true), HOLD_MS)
    const t2 = setTimeout(() => { setVisible(false); window.__aaruBoot = false }, HOLD_MS + FADE_MS)
    timers.current = [t1, t2]

    const finish = () => {
      window.__aaruBoot = false
      setOut(true)
      timers.current.push(setTimeout(() => setVisible(false), FADE_MS))
    }
    const onKey = (e) => {
      if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ' || e.key === '/') {
        e.preventDefault()
        e.stopPropagation()
        finish()
      }
    }
    window.addEventListener('keydown', onKey, { capture: true })
    return () => {
      window.__aaruBoot = false
      window.removeEventListener('keydown', onKey, { capture: true })
      timers.current.forEach(clearTimeout)
      timers.current = []
    }
  }, [])

  if (!visible) return null

  return (
    <div
      className={`boot${out ? ' is-out' : ''}`}
      onPointerDown={() => {
        window.__aaruBoot = false
        setOut(true)
        timers.current.push(setTimeout(() => setVisible(false), FADE_MS))
      }}
    >
      <div className="boot-space" aria-hidden="true">
        <span className="boot-plane p1" />
        <span className="boot-plane p2" />
        <span className="boot-plane p3" />
        <span className="boot-plane p4" />
      </div>
      <div className="boot-inner" aria-hidden="true">
        <span className="boot-mark"><BrandMark size={34} /></span>
        <h1 className="boot-title">
          <span>SMALL THINGS.</span>
          <span>DONE DAILY.</span>
        </h1>
        <p className="boot-sub">Habit OS — your personal productivity environment.</p>
      </div>
      <button type="button" className="boot-skip" onClick={(e) => {
        e.stopPropagation()
        window.__aaruBoot = false
        setOut(true)
        timers.current.push(setTimeout(() => setVisible(false), FADE_MS))
      }}>
        Skip intro
      </button>
    </div>
  )
}
