import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useStore } from '../store.jsx'
import { STARTER_HABITS, categoryOf } from '../lib/schedule.js'
import { requestNotificationPermission, notificationState, notificationsSupported } from '../lib/reminders.js'
import { BrandMark } from './layout/Navigation.jsx'
import { IconCheck, IconChevronRight, IconBell } from '../lib/icons.jsx'
import { BUILD_ID } from '../lib/buildInfo.js'

/* 3-step onboarding: name → starter habits → optional reminder. Fast, skippable. */
export default function Onboarding() {
  const { state, dispatch } = useStore()
  const [step, setStep] = useState(0)
  const [name, setName] = useState('')
  const [picked, setPicked] = useState([])
  const [reminder, setReminder] = useState('08:00')
  const [finishing, setFinishing] = useState(false)

  const finish = async (withReminder) => {
    setFinishing(true)
    let reminderTime = null
    if (withReminder && reminder) {
      const perm = notificationsSupported() ? await requestNotificationPermission() : 'denied'
      reminderTime = perm === 'granted' ? reminder : null
    }
    for (let i = 0; i < picked.length; i++) {
      const p = STARTER_HABITS.find((s) => s.name === picked[i])
      dispatch({
        type: 'ADD_HABIT',
        habit: {
          name: p.name,
          category: p.category,
          schedule: { type: 'daily' },
          reminder: reminderTime,
          notes: '',
        },
      })
    }
    dispatch({ type: 'SET_PROFILE', patch: { name: name.trim(), onboarded: true } })
  }

  const togglePick = (n) => {
    setPicked((p) => (p.includes(n) ? p.filter((x) => x !== n) : p.length >= 3 ? p : [...p, n]))
  }

  return (
    <div
      className="onboarding"
      style={{
        position: 'fixed', inset: 0, zIndex: 100, overflowY: 'auto',
        background: 'var(--bg)', display: 'flex', flexDirection: 'column',
        paddingTop: 'max(6vh, env(safe-area-inset-top))', paddingBottom: 'max(32px, env(safe-area-inset-bottom))',
      }}
      role="dialog"
      aria-modal="true"
      aria-label="Welcome"
    >
      <div style={{ width: 'min(480px, 100% - 48px)', margin: '0 auto', display: 'flex', flexDirection: 'column', flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 40 }}>
          <BrandMark size={30} />
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1.05rem' }}>Aaru Habits</span>
        </div>

        <AnimatePresence mode="wait">
          {step === 0 && (
            <motion.div key="s0" initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }} transition={{ duration: 0.25 }}>
              <StepsDots step={step} />
              <h1 style={{ fontSize: '1.65rem', margin: '16px 0 8px' }}>What should we call you?</h1>
              <p style={{ color: 'var(--text-2)', fontSize: 'var(--fs-sm)', marginBottom: 20 }}>
                Just for greetings. It stays on your device.
              </p>
              <input
                className="field"
                autoFocus
                placeholder="Your name"
                maxLength={40}
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && setStep(1)}
              />
              <div style={{ display: 'flex', gap: 10, marginTop: 28 }}>
                <button className="btn primary" onClick={() => setStep(1)}>
                  Continue <IconChevronRight size={16} />
                </button>
                <button className="btn ghost" onClick={() => setStep(1)}>Skip</button>
              </div>
            </motion.div>
          )}

          {step === 1 && (
            <motion.div key="s1" initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }} transition={{ duration: 0.25 }}>
              <StepsDots step={step} />
              <h1 style={{ fontSize: '1.65rem', margin: '16px 0 8px' }}>Pick a few to start</h1>
              <p style={{ color: 'var(--text-2)', fontSize: 'var(--fs-sm)', marginBottom: 20 }}>
                Up to three. You can change everything later — nothing is pre-filled.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {STARTER_HABITS.map((s) => {
                  const on = picked.includes(s.name)
                  const cat = categoryOf(s.category)
                  return (
                    <button
                      key={s.name}
                      className="starter-habit"
                      onClick={() => togglePick(s.name)}
                      aria-pressed={on}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 12, minHeight: 56,
                        padding: '10px 14px', borderRadius: 16,
                        border: `1.5px solid ${on ? 'var(--accent-1)' : 'var(--border)'}`,
                        background: on ? 'var(--accent-soft)' : 'var(--surface-2)',
                        textAlign: 'left',
                      }}
                    >
                      <span className="dot" style={{ width: 9, height: 9, borderRadius: 99, background: `var(${cat.cssVar})`, flex: 'none' }} />
                      <span style={{ flex: 1, fontWeight: 600, fontSize: 'var(--fs-sm)' }}>{s.name}</span>
                      <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-3)' }}>{cat.label}</span>
                      <span
                        aria-hidden="true"
                        style={{
                          width: 22, height: 22, borderRadius: 99, display: 'grid', placeItems: 'center', flex: 'none',
                          background: on ? 'linear-gradient(135deg, var(--accent-1), var(--accent-2))' : 'var(--track)',
                          color: 'var(--accent-ink)',
                        }}
                      >
                        {on && <IconCheck size={13} />}
                      </span>
                    </button>
                  )
                })}
              </div>
              <div style={{ display: 'flex', gap: 10, marginTop: 28 }}>
                <button className="btn primary" onClick={() => setStep(2)} disabled={!picked.length}>
                  Continue <IconChevronRight size={16} />
                </button>
                <button className="btn ghost" onClick={() => { setPicked([]); setStep(2) }}>Skip</button>
              </div>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div key="s2" initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }} transition={{ duration: 0.25 }}>
              <StepsDots step={step} />
              <h1 style={{ fontSize: '1.65rem', margin: '16px 0 8px' }}>A daily nudge?</h1>
              <p style={{ color: 'var(--text-2)', fontSize: 'var(--fs-sm)', marginBottom: 20 }}>
                Your browser will ask for notification permission — that&rsquo;s the only time we ask. Reminders arrive while the app is open.
              </p>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 24 }}>
                <label className="field-label" htmlFor="ob-reminder" style={{ margin: 0 }}>Remind me at</label>
                <input
                  id="ob-reminder"
                  type="time"
                  className="field"
                  style={{ width: 140 }}
                  value={reminder}
                  onChange={(e) => setReminder(e.target.value)}
                />
              </div>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <button className="btn primary" onClick={() => finish(true)} disabled={finishing}>
                  <IconBell size={16} /> Set reminder &amp; finish
                </button>
                <button className="btn ghost" onClick={() => finish(false)} disabled={finishing}>
                  Maybe later
                </button>
              </div>
              {notificationState() === 'denied' && (
                <p style={{ color: 'var(--warn)', fontSize: 'var(--fs-xs)', marginTop: 14 }}>
                  Notifications are blocked in your browser, so the reminder will show in-app instead.
                </p>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        <p style={{ marginTop: 'auto', paddingTop: 40, color: 'var(--text-3)', fontSize: 'var(--fs-xs)' }}>
          {picked.length > 0 ? `${picked.length} habit${picked.length === 1 ? '' : 's'} ready to add` : 'No habits picked yet — you can add them any time.'}
          <span data-build-id={BUILD_ID} style={{ opacity: 0.75 }}> · build {BUILD_ID}</span>
        </p>
      </div>
    </div>
  )
}

function StepsDots({ step }) {
  return (
    <div style={{ display: 'flex', gap: 6 }} aria-label={`Step ${step + 1} of 3`}>
      {[0, 1, 2].map((i) => (
        <span key={i} style={{
          height: 4, flex: 1, maxWidth: 44, borderRadius: 99,
          background: i <= step ? 'linear-gradient(90deg, var(--accent-1), var(--accent-2))' : 'var(--track)',
        }} />
      ))}
    </div>
  )
}
