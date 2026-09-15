/* ============================================================
   ACHIEVEMENTS (Step 7D — Records, Achievements, Advanced).
   Earned, not awarded. Nothing unlocks unless the data proves
   it. Tiers use identity palette only (no semantic good/warn/bad,
   no 3D badge treatments, no glow keyframes).
   ============================================================ */
import { useMemo, useState } from 'react'
import { useStore } from '../store.jsx'
import SectionCard, { CardHead } from '../components/ui/SectionCard.jsx'
import ProgressRing from '../components/ui/ProgressRing.jsx'
import AnimatedNumber from '../components/ui/AnimatedNumber.jsx'
import { achievementSummary } from '../lib/achievements.js'
import { prettyDate } from '../lib/dates.js'
import { Link } from '../lib/router.jsx'
import {
  IconTrophy, IconLock, IconCheck, IconFlame,
  IconShield, IconKey, IconAward, IconSparkle, IconTarget,
} from '../lib/icons.jsx'

const TIER_ORDER = ['bronze', 'silver', 'gold', 'diamond']

/* Tier icons → identity only. Badges never render 3D or glow. */
const TIER_ICON = {
  bronze: IconFlame,
  silver: IconShield,
  gold: IconKey,
  diamond: IconTrophy,
}

export default function AchievementsScreen() {
  const { state } = useStore()
  const [tier, setTier] = useState('all')

  const summary = useMemo(() => achievementSummary(state), [state])
  const shown = tier === 'all'
    ? summary.items
    : summary.items.filter((i) => i.tier === tier)

  const unlockedPct = Math.round(summary.completion * 100)

  return (
    <div className="screen" id="achievements-screen">
      <header className="screen-head">
        <div>
          <p className="insights-eyebrow">Achievements</p>
          <h1 className="screen-title">Earned, not awarded</h1>
          <p className="screen-sub">
            Every badge here is computed from what you actually did.
            Nothing unlocks on time alone.
          </p>
        </div>
      </header>

      <div className="stack">
        {/* ---------- Hero ---------- */}
        <SectionCard className="pad ach-hero">
          <div className="ach-hero-inner">
            <ProgressRing
              pct={unlockedPct}
              size={132}
              stroke={10}
              label={`${summary.unlocked} of ${summary.total} achievements unlocked`}
              /* identity color by tier-most-unlocked — never semantic */
              color="var(--brand-accent)"
            >
              <div className="ach-ring-inner">
                <div className="ach-ring-num">
                  <AnimatedNumber value={summary.unlocked} />
                  <span className="ach-ring-den"> / {summary.total}</span>
                </div>
                <div className="ach-ring-lbl">unlocked</div>
              </div>
            </ProgressRing>

            <div className="ach-hero-copy">
              <p className="ach-hero-lead">
                {summary.unlocked === 0
                  ? 'No badges yet. The first lands with your first recorded check-in.'
                  : summary.unlocked === summary.total
                    ? 'Every badge unlocked. That reflects consistent real behavior.'
                    : `${summary.total - summary.unlocked} left to unlock.`}
              </p>

              <div className="ach-tiers" role="list" aria-label="Unlocked by tier">
                {TIER_ORDER.map((t) => {
                  const total = summary.byTier[t] || 0
                  const got = summary.earnedByTier[t] || 0
                  const TierIcon = TIER_ICON[t] || IconAward
                  return (
                    <div key={t} className="ach-tier" role="listitem" data-tier={t}>
                      <TierIcon size={14} aria-hidden="true" />
                      <span className="tnum ach-tier-count">{got}/{total}</span>
                      <span className="ach-tier-name">{t}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </SectionCard>

        {/* ---------- Most recently earned ---------- */}
        {summary.recent.length > 0 && (
          <SectionCard className="pad">
            <CardHead
              eyebrow="Recently earned"
              title="Your last unlocks"
              sub="Computed from real check-ins, project completions, and reflections."
            />
            <ul className="ach-recent" aria-label="Recently earned achievements">
              {summary.recent.map((a) => (
                <li key={a.id} className="ach-recent-row" data-tier={a.tier}>
                  <span className="ach-art-sm" data-tier={a.tier} aria-hidden="true">
                    {(() => {
                      const I = TIER_ICON[a.tier] || IconAward
                      return <I size={16} />
                    })()}
                  </span>
                  <div className="ach-recent-body">
                    <p className="ach-title">{a.title}</p>
                    <p className="ach-sub">{prettyDate(a.earnedOn)}{a.detail ? ` · ${a.detail}` : ''}</p>
                  </div>
                  <span className="ach-earned-tag"><IconCheck size={13} /> Earned</span>
                </li>
              ))}
            </ul>
          </SectionCard>
        )}

        {/* ---------- Filters ---------- */}
        <div className="seg ach-filter" role="group" aria-label="Filter achievements by tier">
          {['all', ...TIER_ORDER].map((t) => (
            <button
              key={t}
              type="button"
              className={`seg-btn${tier === t ? ' active' : ''}`}
              aria-pressed={tier === t}
              onClick={() => setTier(t)}
            >
              {t === 'all' ? 'All' : t[0].toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>

        {/* ---------- Grid ---------- */}
        {shown.length === 0 ? (
          <SectionCard className="pad">
            <CardHead
              eyebrow="Nothing here"
              title="No achievements in this tier yet"
              sub="Pick another tier or keep logging — every badge is earned from real data."
            />
          </SectionCard>
        ) : (
          <ul className="ach-grid" aria-label={`${tier === 'all' ? 'All achievements' : tier + ' tier achievements'}`}>
            {shown.map((a, i) => (
              <AchievementCard key={a.id} item={a} index={i} />
            ))}
          </ul>
        )}

        {/* ---------- Closest to unlocking ---------- */}
        {summary.nextUp.length > 0 && (
          <SectionCard className="pad">
            <CardHead
              eyebrow="In reach"
              title="Closest to unlocking"
              sub="Progress computed from your data — not predictions."
            >
              <Link to="/insights" className="btn ghost sm">
                Insights <IconSparkle size={13} />
              </Link>
            </CardHead>
            <ul className="ach-next" aria-label="Next achievements">
              {summary.nextUp.map((a) => (
                <li key={a.id} className="ach-next-row">
                  <div className="ach-next-head">
                    <div className="ach-next-title">
                      {(() => { const I = TIER_ICON[a.tier] || IconTarget; return <I size={13} aria-hidden="true" /> })()}
                      <p className="ach-title">{a.title}</p>
                    </div>
                    <span className="tnum ach-next-pct">{Math.round(a.progress * 100)}%</span>
                  </div>
                  <div className="meter" role="progressbar"
                       aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(a.progress * 100)}
                       aria-label={`${a.title}: ${Math.round(a.progress * 100)}%`}>
                    <i style={{ width: `${Math.round(a.progress * 100)}%` }} />
                  </div>
                  <p className="ach-sub">{a.detail}</p>
                </li>
              ))}
            </ul>
          </SectionCard>
        )}
      </div>
    </div>
  )
}

/* ---------------------------------------------------------- */

function AchievementCard({ item, index }) {
  const pct = Math.round(item.progress * 100)
  const TierIcon = TIER_ICON[item.tier] || IconAward
  return (
    <li
      className={`ach-card${item.earned ? ' is-earned' : ''}`}
      data-tier={item.tier}
      data-locked={item.earned ? undefined : 'true'}
      style={{ animationDelay: `${Math.min(index, 12) * 30}ms` }}
      aria-label={`${item.title} — ${item.earned ? 'earned' : `${pct}% toward unlock`}`}
    >
      <div className="ach-art" data-tier={item.tier} aria-hidden="true">
        <TierIcon size={24} />
        {item.earned && (
          <span className="ach-art-check" aria-hidden="true"><IconCheck size={12} /></span>
        )}
      </div>

      <div className="ach-body">
        <div className="ach-card-head">
          <p className="ach-name">{item.title}</p>
          <span className={`ach-badge${item.earned ? ' is-earned' : ''}`} data-tier={item.tier}>
            {item.tier}
          </span>
        </div>
        <p className="ach-desc">{item.description}</p>

        {item.earned ? (
          <p className="ach-meta">
            <IconCheck size={12} /> Earned {item.earnedOn ? prettyDate(item.earnedOn) : 'just now'}
          </p>
        ) : (
          <div className="ach-lock">
            <div className="meter" role="progressbar"
                 aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
              <i style={{ width: `${pct}%` }} />
            </div>
            <p className="ach-meta">
              <IconLock size={12} /> {item.detail || `${pct}% complete`}
            </p>
          </div>
        )}
      </div>
    </li>
  )
}
