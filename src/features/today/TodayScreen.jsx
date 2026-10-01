/* ============================================================
   TODAY — one screen that answers one question: what now?

   v4 spread this across TodayHero, NowRing, NextAction, AiCoach,
   AdaptiveHome, AdaptiveCommandCenter, ExecutionPanels,
   PlanningPanel, FocusMode and TodayWorkList — ten components
   with four different opinions about priority. This is the one
   opinion, computed by nextUp() in compute.js.
   ============================================================ */
import { lazy, Suspense, useMemo, useState } from 'react'
import { Link } from '../../app/router.jsx'
import { useStore, useActions } from '../../core/store.jsx'
import {
  dayScore, scheduled, nextUp, sortByUrgency, workStatus, lifetime,
} from '../../core/compute.js'
import { today, fmtLong, greeting, lastDays, fmtInitial, countdown } from '../../core/date.js'
import {
  Surface, Panel, Button, Badge, Empty, Columns, SectionHead, Num,
} from '../../ui/index.jsx'
import {
  IconPlus, IconFlame, IconSpark, IconChevron, IconMood, IconLayers, IconWork, IconFace,
} from '../../ui/icons.jsx'
import { webglAvailable } from '../../three/capability.js'
import HabitRow from '../habits/HabitRow.jsx'
import WorkCard from '../work/WorkCard.jsx'
import HabitForm from '../habits/HabitForm.jsx'

const Core = lazy(() => import('../../three/Core.jsx'))

export default function TodayScreen() {
  const state = useStore()
  const actions = useActions()
  const [adding, setAdding] = useState(false)
  const d = today()

  const { habits, checkins, work, moods, profile } = state

  const due = useMemo(() => habits.filter((h) => !h.archivedAt && scheduled(h, d)), [habits, d])
  const score = useMemo(() => dayScore(habits, checkins, d), [habits, checkins, d])
  const queue = useMemo(() => nextUp(state, d), [state, d])
  const openWork = useMemo(
    () => sortByUrgency(work.filter((w) => !w.doneAt && !w.archivedAt)).slice(0, 3),
    [work]
  )
  const week = useMemo(() => lastDays(7, d), [d])
  const weekData = useMemo(
    () => week.map((x) => {
      const s = dayScore(habits, checkins, x)
      return { value: Math.round(s.ratio * 100), title: `${x}: ${s.done}/${s.due}` }
    }),
    [week, habits, checkins]
  )
  const stats = useMemo(() => lifetime(state, d), [state, d])

  const pct = Math.round(score.ratio * 100)
  const openCount = score.due - score.done
  const isEmpty = habits.length === 0 && work.length === 0

  if (isEmpty) return <FirstRun onAdd={() => setAdding(true)} adding={adding} onClose={() => setAdding(false)} />

  return (
    <div className="stack stack--loose">
      {/* ---------- Hero ---------- */}
      <Surface variant="lit" className="hero rise d2" style={{ '--i': 0 }}>
        <div className="hero__copy">
          <div>
            <div className="hero__greet">{greeting(profile.name)}</div>
            <div className="hero__date">{fmtLong(d)}</div>
          </div>

          <p className="hero__line">{headline(score, queue, stats)}</p>

          <div className="hero__stats">
            <Figure value={`${score.done}/${score.due}`} label="Habits today" />
            <Figure value={<><Num value={stats.bestStreak} /></>} label="Best streak" icon={<IconFlame size={13} />} />
            <Figure value={<Num value={openWork.length} />} label="Open work" />
          </div>
        </div>

        <div className="hero__core">
          <CoreVisual progress={score.ratio} open={openCount} />
          <div className="hero__coreLabel">
            <span className="hero__coreNum num"><Num value={pct} />%</span>
            <span className="eyebrow" style={{ marginTop: 4 }}>of today</span>
          </div>
        </div>
      </Surface>

      {/* ---------- Next up ---------- */}
      {queue.length > 0 && (
        <section className="rise" style={{ '--i': 1 }}>
          <SectionHead
            eyebrow="Start here"
            title="Next up"
            sub="Ranked by deadline pressure, then by the streaks you'd break"
          />
          <Surface variant="flat" className="d1">
            {queue.map((q) =>
              q.type === 'habit' ? (
                <HabitRow key={`h${q.id}`} habit={q.item} checkins={checkins} day={d} compact />
              ) : (
                <NextWorkRow key={`w${q.id}`} item={q.item} reason={q.reason} />
              )
            )}
          </Surface>
        </section>
      )}

      {/* ---------- Habits ---------- */}
      <section className="rise" style={{ '--i': 2 }}>
        <SectionHead
          eyebrow="Repeat"
          title="Today's habits"
          sub={due.length ? `${score.done} done · ${score.partial} started · ${due.length - score.done - score.partial} untouched` : undefined}
          action={<Button size="sm" icon={<IconPlus size={15} />} onClick={() => setAdding(true)}>Habit</Button>}
        />
        {due.length === 0 ? (
          <Surface variant="flat" className="d1">
            <Empty
              icon={<IconSpark size={24} />}
              title={habits.length ? 'Nothing scheduled today' : 'No habits yet'}
              body={habits.length
                ? 'Your cadences give you today off. Enjoy it, or add something new.'
                : 'Add the first thing you want to repeat. One is enough to start.'}
              action={<Button variant="primary" icon={<IconPlus size={16} />} onClick={() => setAdding(true)}>Add a habit</Button>}
            />
          </Surface>
        ) : (
          <Surface variant="flat" className="d1">
            {due.map((h) => <HabitRow key={h.id} habit={h} checkins={checkins} day={d} />)}
          </Surface>
        )}
      </section>

      {/* ---------- Work + week + mood ---------- */}
      <div className="grid grid--2 rise" style={{ '--i': 3 }}>
        <section>
          <SectionHead
            eyebrow="Finish"
            title="Priority work"
            action={<Link to="work" className="btn btn--ghost btn--sm">All work <IconChevron size={13} /></Link>}
          />
          {openWork.length === 0 ? (
            <Surface variant="flat" className="d1">
              <Empty title="Nothing open" body="Every project and task is done or archived." />
            </Surface>
          ) : (
            <div className="stack stack--tight">
              {openWork.map((w, _i) => <WorkCard key={w.id} item={w} depth={1} />)}
            </div>
          )}
        </section>

        <div className="stack">
          <Panel title="Last 7 days" sub={`${Math.round(weekData.reduce((s, x) => s + x.value, 0) / 7)}% average`}>
            <Columns data={weekData} labels={week.map(fmtInitial)} height={88} />
          </Panel>
          <MoodCard day={d} value={moods[d]} onSet={(patch) => actions.setMood(d, patch)} />
        </div>
      </div>

      <HabitForm open={adding} onClose={() => setAdding(false)} />
    </div>
  )
}

/* ---------------- Pieces ---------------------------------- */

function Figure({ value, label, icon }) {
  return (
    <div className="stat stat--sm">
      <span className="stat__v num row" style={{ gap: 5 }}>{icon}{value}</span>
      <span className="stat__k">{label}</span>
    </div>
  )
}

function CoreVisual({ progress, open }) {
  const [ok] = useState(webglAvailable)
  const p = Math.round(progress * 100)
  const fallback = (
    <div className="hero__css" style={{ '--p': p }} aria-hidden="true">
      <div className="hero__cssOrbit" />
      <div className="hero__cssRing" />
      <div className="hero__cssOrb" />
    </div>
  )
  if (!ok) return fallback
  return <Suspense fallback={fallback}><Core progress={progress} open={open} size={268} /></Suspense>
}

function NextWorkRow({ item, reason }) {
  const st = workStatus(item)
  return (
    <Link to={`work/${item.id}`} className="erow">
      <span className="erow__icon" aria-hidden="true">
        {item.kind === 'project' ? <IconLayers size={16} /> : <IconWork size={16} />}
      </span>
      <div className="erow__main">
        <span className="erow__title">{item.title}</span>
        <div className="erow__meta">
          <Badge tone={st.tone}>{st.label}</Badge>
          {item.deadline && <span>{countdown(item.deadline)}</span>}
          {reason && <span className="faint">{reason}</span>}
        </div>
      </div>
      <IconChevron size={16} />
    </Link>
  )
}


function MoodCard({ value, onSet }) {
  return (
    <Panel
      title="How did it feel?"
      sub={value?.mood ? 'Logged — tap to change' : 'One tap, used in Insights'}
      action={<IconMood size={18} />}
    >
      <div className="mood">
        {[1, 2, 3, 4, 5].map((level, i) => (
          <button
            key={i}
            type="button"
            className="mood__btn"
            aria-pressed={value?.mood === i + 1}
            aria-label={`Mood ${i + 1} of 5`}
            onClick={() => onSet({ mood: value?.mood === i + 1 ? null : i + 1 })}
          >
            <IconFace level={level} size={22} />
          </button>
        ))}
      </div>
    </Panel>
  )
}

function headline(score, queue, stats) {
  if (score.due === 0) return 'No habits are due today. Work and goals are still waiting below.'
  if (score.done === score.due) return `Every habit is done. That is ${stats.perfectDays === 1 ? 'your first' : `perfect day #${stats.perfectDays}`}.`
  const urgent = queue.find((q) => q.type === 'work' && q.status?.rank <= 1)
  if (urgent) return `${urgent.item.title} needs attention first — ${urgent.reason?.toLowerCase() || 'it is due'}.`
  const left = score.due - score.done
  return `${left} habit${left === 1 ? '' : 's'} left. The fastest win is at the top of the list.`
}

/* ---------------- First run ------------------------------- */

function FirstRun({ onAdd, adding, onClose }) {
  const { profile } = useStore()
  const actions = useActions()
  return (
    <>
      <div className="onboard">
        <Surface variant="float" className="onboard__card">
          <div className="onboard__mark"><IconSpark size={32} /></div>
          <h1 style={{ fontSize: 'var(--fs-2xl)', marginBottom: 'var(--s3)' }}>
            {profile.name ? `Welcome, ${profile.name}.` : 'Welcome to Habit OS.'}
          </h1>
          <p className="muted" style={{ marginBottom: 'var(--s6)' }}>
            Three nouns, nothing more: <strong>habits</strong> you repeat, <strong>work</strong> you finish,
            and <strong>goals</strong> they add up to. It starts completely empty —
            every number you ever see here will be one you made.
          </p>

          {!profile.name && (
            <input
              className="input"
              placeholder="What should I call you?"
              style={{ marginBottom: 'var(--s4)', textAlign: 'center' }}
              onBlur={(e) => e.target.value.trim() && actions.setProfile({ name: e.target.value.trim() })}
              onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
            />
          )}

          <Button variant="primary" size="lg" block icon={<IconPlus size={18} />} onClick={onAdd}>
            Add your first habit
          </Button>
          <p className="tiny faint" style={{ marginTop: 'var(--s4)' }}>
            Everything stays in this browser. Export a backup any time from Settings.
          </p>
        </Surface>
      </div>
      <HabitForm open={adding} onClose={onClose} />
    </>
  )
}
