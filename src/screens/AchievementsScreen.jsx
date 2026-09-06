/* ============================================================
   ACHIEVEMENTS
   A reward screen that stays honest: nothing unlocks unless the
   data proves it, and every locked card shows real progress or
   says plainly that it has not started.
   ============================================================ */
import { useEffect, useMemo, useState } from 'react'
import { useStore } from '../store.jsx'
import SectionCard, { CardHead } from '../components/ui/SectionCard.jsx'
import ProgressRing from '../components/ui/ProgressRing.jsx'
import AnimatedNumber from '../components/ui/AnimatedNumber.jsx'
import EmptyState from '../components/ui/EmptyState.jsx'
import Burst from '../components/motion/Burst.jsx'
import AnimateOnView from '../components/motion/AnimateOnView.jsx'
import { achievementSummary } from '../lib/achievements.js'
import { prettyDate } from '../lib/dates.js'
import { Link } from '../lib/router.jsx'
import { IconTrophy, IconLock, IconCheck, IconSparkle } from '../lib/icons.jsx'

const TIER_ORDER = ['bronze', 'silver', 'gold', 'diamond']

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
          <h1 className="screen-title">Achievements</h1>
          <p className="screen-sub">
            Earned from your own data — nothing here is assumed.
          </p>
        </div>
      </header>

      <div className="stack">
        {/* ---------- Hero ---------- */}
        <SectionCard className="pad-lg ach-hero">
          <div className="ach-hero-inner">
            <ProgressRing
              pct={unlockedPct}
              size={148}
              stroke={12}
              label={`${summary.unlocked} of ${summary.total} achievements unlocked`}
            >
              <div>
                <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1.9rem', lineHeight: 1 }}>
                  <AnimatedNumber value={summary.unlocked} />
                  <span style={{ color: 'var(--text-3)', fontSize: '1rem' }}> / {summary.total}</span>
                </div>
                <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-3)', marginTop: 4 }}>unlocked</div>
              </div>
            </ProgressRing>

            <div className="ach-hero-copy">
              <p className="eyebrow">Your record</p>
              <p className="ach-hero-line">
                {summary.unlocked === 0
                  ? 'Nothing unlocked yet. The first one lands with your first check-in.'
                  : summary.unlocked === summary.total
                    ? 'Every achievement unlocked. That is a genuinely rare thing.'
                    : `${summary.total - summary.unlocked} left to unlock.`}
              </p>

              <div className="ach-tiers" aria-label="Unlocked by tier">
                {TIER_ORDER.map((t) => {
                  const total = summary.byTier[t] || 0
                  const got = summary.earnedByTier[t] || 0
                  return (
                    <div key={t} className="ach-tier" data-tier={t}>
                      <span className="ach-tier-dot" aria-hidden="true" />
                      <span className="tnum">{got}/{total}</span>
                      <span className="ach-tier-name">{t}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </SectionCard>

        {/* ---------- Newly earned ---------- */}
        {summary.recent.length > 0 && (
          <SectionCard className="pad" delay={0.04}>
            <CardHead title="Most recently earned" />
            <div className="ach-recent">
              {summary.recent.map((a) => (
                <div key={a.id} className="ach-recent-row">
                  <AchievementArt tier={a.tier} earned />
                  <div style={{ minWidth: 0 }}>
                    <p className="ach-title">{a.title}</p>
                    <p className="ach-sub">{prettyDate(a.earnedOn)}</p>
                  </div>
                  <span className="ach-earned-tag"><IconCheck size={13} /> Earned</span>
                </div>
              ))}
            </div>
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
        {summary.items.length === 0 || shown.length === 0 ? (
          <SectionCard>
            <EmptyState
              art="art/empty-achievements.webp"
              icon={<IconTrophy size={40} />}
              title="No achievements in this tier"
            >
              Pick another tier, or start logging — every achievement here is earned from real data.
            </EmptyState>
          </SectionCard>
        ) : (
          <div className="ach-grid">
            {shown.map((a, i) => (
              <AchievementCard key={a.id} item={a} index={i} />
            ))}
          </div>
        )}

        {/* ---------- Next up ---------- */}
        {summary.nextUp.length > 0 && (
          <SectionCard className="pad" delay={0.06}>
            <CardHead title="Closest to unlocking">
              <Link to="insights" className="btn ghost sm">Your data <IconSparkle size={14} /></Link>
            </CardHead>
            <div className="ach-next">
              {summary.nextUp.map((a) => (
                <div key={a.id} className="ach-next-row">
                  <div className="ach-next-head">
                    <p className="ach-title">{a.title}</p>
                    <span className="tnum ach-next-pct">{Math.round(a.progress * 100)}%</span>
                  </div>
                  <div className="meter" role="img" aria-label={`${a.title}: ${Math.round(a.progress * 100)} percent`}>
                    <i style={{ width: `${Math.round(a.progress * 100)}%` }} />
                  </div>
                  <p className="ach-sub">{a.detail}</p>
                </div>
              ))}
            </div>
          </SectionCard>
        )}
      </div>
    </div>
  )
}

/* ---------------------------------------------------------- */

/* Honest rarity names for the existing rule tiers — the tier still comes
   from the achievement rules themselves; this is presentation, nothing more. */
const RARITY = { bronze: 'common', silver: 'rare', gold: 'epic', diamond: 'legendary' }

function AchievementCard({ item, index }) {
  const pct = Math.round(item.progress * 100)
  const [fresh, setFresh] = useState(false)
  const [burst, setBurst] = useState(0)

  /* celebrate only trophies that flip while this screen is open */
  useEffect(() => {
    const on = (e) => {
      if (e.detail?.kind === 'unlock' && e.detail?.id === item.id) {
        setFresh(true)
        setBurst((b) => b + 1)
      }
    }
    window.addEventListener('aaru:feedback', on)
    return () => window.removeEventListener('aaru:feedback', on)
  }, [item.id])

  return (
    <div
      className={`ach-card badge3d${item.earned ? ' is-earned' : ''}${fresh ? ' is-fresh' : ''}`}
      data-tier={item.tier}
      data-rarity={RARITY[item.tier] || 'common'}
      data-locked={item.earned ? undefined : 'true'}
      style={{ animationDelay: `${Math.min(index, 11) * 40}ms` }}
    >
      <div className="ach-card-top">
        <span className="ach-medal">
          {item.earned ? (
            <AnimateOnView effect="medal-shine" className="ach-medal-inner">
              <AchievementArt tier={item.tier} earned={item.earned} />
            </AnimateOnView>
          ) : (
            <AchievementArt tier={item.tier} earned={item.earned} />
          )}
          <Burst fire={burst} count={14} spread={40} size={4} />
        </span>
        <div style={{ minWidth: 0 }}>
          <p className="ach-title">{item.title}</p>
          <p className="ach-sub">{item.blurb}</p>
          {RARITY[item.tier] && (
            <span className={`rarity-label rarity-${RARITY[item.tier]}`} aria-label={`Rarity: ${RARITY[item.tier].toUpperCase()}`}>
              <i className="rarity-dot" aria-hidden="true" />
              {RARITY[item.tier].toUpperCase()}
            </span>
          )}
        </div>
      </div>

      <p className="ach-detail">{item.detail}</p>

      {item.earned ? (
        <p className="ach-earned-tag">
          <IconCheck size={13} /> Earned{item.earnedOn ? ` · ${prettyDate(item.earnedOn)}` : ''}
        </p>
      ) : (
        <div className="ach-locked-progress">
          <div className="meter" role="img" aria-label={`${item.title}: ${pct} percent of the way`}>
            <i style={{ width: `${pct}%` }} />
          </div>
          <span className="tnum">{pct}%</span>
        </div>
      )}
    </div>
  )
}

/** Badge artwork, with a quiet fallback if the asset is unavailable. */
function AchievementArt({ tier, earned }) {
  const [failed, setFailed] = useState(false)
  if (failed) {
    return (
      <span
        aria-hidden="true"
        className={`badge-fallback${earned ? ' is-earned' : ''}`}
        style={earned ? { background: 'linear-gradient(135deg, var(--accent-1), var(--accent-2))' } : undefined}
      >
        {earned ? <IconTrophy size={17} /> : <IconLock size={15} />}
      </span>
    )
  }
  return (
    <img
      src={`art/badge-${tier}.webp`}
      alt=""
      width={44}
      height={44}
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
      className="ach-art"
      style={earned ? undefined : { filter: 'grayscale(1)', opacity: 0.42 }}
    />
  )
}

