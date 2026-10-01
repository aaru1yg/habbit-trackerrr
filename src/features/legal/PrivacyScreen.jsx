/* ============================================================
   PRIVACY — a description of what this app actually does.

   Every claim here is checkable against the source. If the app
   ever gains a network call, an account or an analytics script,
   this page has to change in the same commit.
   ============================================================ */
import { Link } from '../../app/router.jsx'
import { STORAGE_KEY } from '../../core/schema.js'
import { IconBack } from '../../ui/icons.jsx'

export const LEGAL_UPDATED = '1 October 2026'

export default function PrivacyScreen() {
  return (
    <article className="legal">
      <Link to="settings" className="btn btn--ghost btn--sm" style={{ marginBottom: 'var(--s5)' }}>
        <IconBack size={15} /> Settings
      </Link>

      <header className="legal__head">
      <h1>Privacy</h1>
      <p className="legal__meta">Last updated {LEGAL_UPDATED}</p>
      </header>

      <div className="legal__cols">
      <nav className="legal__toc" aria-label="On this page">
        <span className="legal__toch">Contents</span>
        <a href="#short">The short version</a>
        <a href="#collect">What is stored</a>
        <a href="#where">Where it is stored</a>
        <a href="#network">Network activity</a>
        <a href="#control">Your control</a>
        <a href="#children">Children</a>
        <a href="#changes">Changes</a>
      </nav>

      <div className="legal__body">

      <section id="short">
        <h2>The short version</h2>
        <p>
          Habit OS has no account system, no server of its own and no analytics.
          Everything you enter stays in your browser&rsquo;s local storage on the
          device you entered it on. We cannot read it, because it is never sent
          anywhere.
        </p>
        <p>
          There is no company behind this page collecting anything from you. If
          you clear your browser data, your habits are gone, and nobody has a copy.
          That is the trade: complete privacy, and you own the backups.
        </p>
      </section>

      <section id="collect">
        <h2>What is stored</h2>
        <p>
          The app writes a single entry to your browser&rsquo;s local storage under
          the key <strong>{STORAGE_KEY}</strong>. It contains exactly what you typed in:
        </p>
        <ul>
          <li>Your habits: name, icon, area, cadence, target, cue and notes.</li>
          <li>Your check-ins: which day, and the value you recorded.</li>
          <li>Your work: titles, notes, deadlines, task lists and time or progress log entries.</li>
          <li>Your goals: title, reason, target date, and which habits and work are linked to them.</li>
          <li>Your mood entries: the day, a 1 to 5 rating, and an optional note.</li>
          <li>Your preferences: display name, theme, motion setting and week start.</li>
        </ul>
        <p>
          Two further small keys record whether the sidebar is expanded and when
          you last exported a backup. That is the complete list.
        </p>

        <h3>What is not collected</h3>
        <p>
          No email address, no password, no name beyond the one you optionally type
          for the greeting, no location, no contacts, no device fingerprint, no
          advertising identifier, no IP logging and no behavioural telemetry. There
          are no cookies, because there is no server to send them to.
        </p>
      </section>

      <section id="where">
        <h2>Where it is stored</h2>
        <p>
          In your browser, on your device. Local storage is scoped to the site, so
          other sites cannot read it. It is not synchronised to any cloud service
          by this app.
        </p>
        <p>
          Your browser or operating system may include local storage in its own
          device backup, for example an encrypted phone backup. That is between you
          and your device vendor; the app is not involved.
        </p>
        <p>
          Using Habit OS on a second device gives you a second, separate set of
          data. They do not sync. Moving data between devices means exporting a
          backup file from one and importing it on the other.
        </p>
      </section>

      <section id="network">
        <h2>Network activity</h2>
        <p>
          Once the page has loaded, the app makes no network requests. It does not
          call an API, because there is no API.
        </p>
        <p>
          Loading the page itself does involve the host serving it. The app is
          published on GitHub Pages, so GitHub serves the HTML, JavaScript, CSS and
          fonts, and like any web host it can see the request. Their handling of
          that is covered by GitHub&rsquo;s own privacy statement. Fonts are bundled
          and served from the same origin, so no font CDN sees you.
        </p>
        <p>
          A service worker caches those files so the app keeps working offline. The
          cache holds application code only, never your habit data.
        </p>
      </section>

      <section id="control">
        <h2>Your control</h2>
        <p>
          Settings has an <strong>Export</strong> button that writes everything to a
          JSON file you keep, and an <strong>Import</strong> button that reads one
          back. The format is plain, readable JSON, not a proprietary blob.
        </p>
        <p>
          <strong>Reset app</strong> in Settings erases the stored entry immediately.
          Clearing site data in your browser does the same thing. Neither needs our
          permission or involvement, and there is no retention period, because there
          is nothing retained anywhere else.
        </p>
      </section>

      <section id="children">
        <h2>Children</h2>
        <p>
          The app collects nothing from anyone, so it collects nothing from children.
          It is not directed at children, and it carries no advertising.
        </p>
      </section>

      <section id="changes">
        <h2>Changes</h2>
        <p>
          If the app ever gains a feature that sends data anywhere, such as optional
          cloud sync, this page will be updated in the same release and the change
          will be visible in the project&rsquo;s commit history. Sync would be
          something you switch on, never a default.
        </p>
        <p>
          Questions are best raised as an issue on the project&rsquo;s GitHub
          repository, which is also where you can read the source and confirm all of
          the above for yourself.
        </p>
      </section>
      </div>
      </div>
    </article>
  )
}
