/* ============================================================
   TERMS — short, accurate, and specific to a local-only app.
   No clauses about accounts, billing or uptime, because there
   are no accounts, no billing and no server to be up.
   ============================================================ */
import { Link } from '../../app/router.jsx'
import { IconBack } from '../../ui/icons.jsx'
import { LEGAL_UPDATED } from './PrivacyScreen.jsx'

export default function TermsScreen() {
  return (
    <article className="legal">
      <Link to="settings" className="btn btn--ghost btn--sm" style={{ marginBottom: 'var(--s5)' }}>
        <IconBack size={15} /> Settings
      </Link>

      <header className="legal__head">
      <h1>Terms</h1>
      <p className="legal__meta">Last updated {LEGAL_UPDATED}</p>
      </header>

      <div className="legal__cols">
      <nav className="legal__toc" aria-label="On this page">
        <span className="legal__toch">Contents</span>
        <a href="#use">Using the app</a>
        <a href="#data">Your data is your responsibility</a>
        <a href="#warranty">No warranty</a>
        <a href="#liability">Liability</a>
        <a href="#health">Not health advice</a>
        <a href="#code">Source and licence</a>
        <a href="#changes">Changes</a>
      </nav>

      <div className="legal__body">

      <section id="use">
        <h2>Using the app</h2>
        <p>
          Habit OS is free to use. There is no account to register, nothing to buy,
          no subscription and no usage limit. You do not need permission to use it
          for anything, including work.
        </p>
        <p>
          Because the app runs entirely in your browser, using it does not create a
          relationship with any service provider. There is nothing to sign up for
          and nothing to cancel.
        </p>
      </section>

      <section id="data">
        <h2>Your data is your responsibility</h2>
        <p>
          Everything you record is stored in your browser and nowhere else. No copy
          exists anywhere we can reach, which means we cannot restore anything for
          you.
        </p>
        <p>
          Data can be lost in ordinary ways: clearing site data, browsing in a
          private window, a browser evicting storage under pressure, uninstalling
          the browser, or losing the device. If your history matters to you, use
          <strong> Export</strong> in Settings and keep the file somewhere safe.
          That is the only backup there is.
        </p>
      </section>

      <section id="warranty">
        <h2>No warranty</h2>
        <p>
          The app is provided as is, without warranty of any kind, express or
          implied, including any warranty of merchantability, fitness for a
          particular purpose or non-infringement.
        </p>
        <p>
          It is not guaranteed to be free of defects, and it may change or stop
          being published at any time. Since it runs locally, a copy you have
          already loaded will keep working offline.
        </p>
      </section>

      <section id="liability">
        <h2>Liability</h2>
        <p>
          To the fullest extent permitted by law, the authors are not liable for any
          loss or damage arising from use of the app, including lost data, missed
          deadlines or any indirect or consequential loss.
        </p>
        <p>
          Some jurisdictions do not allow certain exclusions, so parts of this may
          not apply to you. Nothing here limits rights that cannot be limited by law.
        </p>
      </section>

      <section id="health">
        <h2>Not health advice</h2>
        <p>
          Habit OS records what you tell it and does arithmetic on it. Streaks,
          consistency rates and the mood correlation are descriptions of your own
          entries, not clinical measurements.
        </p>
        <p>
          The correlation shown in Insights is a correlation, not a cause, and the
          app says so where it appears. None of it is medical, psychological or
          professional advice. For health decisions, talk to a qualified
          practitioner.
        </p>
      </section>

      <section id="code">
        <h2>Source and licence</h2>
        <p>
          The source is published on GitHub. You are welcome to read it, run it
          yourself, fork it or learn from it, under the terms of the licence in the
          repository.
        </p>
        <p>
          Contributions and bug reports are welcome through the repository&rsquo;s
          issue tracker.
        </p>
      </section>

      <section id="changes">
        <h2>Changes</h2>
        <p>
          These terms may be updated as the app changes. The date at the top of this
          page records the most recent revision, and the full history is in the
          repository. Continuing to use the app after a change means you accept it.
        </p>
      </section>
      </div>
      </div>
    </article>
  )
}
