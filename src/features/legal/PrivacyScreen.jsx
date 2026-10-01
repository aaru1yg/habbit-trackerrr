/* ============================================================
   PRIVACY — a description of what this app actually does.

   Every claim here is checkable against the source. If the app
   ever gains a network call, an account or an analytics script,
   this page has to change in the same commit.

   It did: optional cloud sync landed, and this page was rewritten
   in that release. The page also reads `cloudConfigured`, so a
   build published without credentials says so rather than
   describing an account system it does not have.
   ============================================================ */
import { Link } from '../../app/router.jsx'
import { STORAGE_KEY } from '../../core/schema.js'
import { IconBack } from '../../ui/icons.jsx'
import { cloudConfigured, SUPABASE_URL } from '../../cloud/config.js'

export const LEGAL_UPDATED = '1 October 2026'

/** The project ref is the public hostname the browser already connects to. */
const projectHost = () => {
  try { return new URL(SUPABASE_URL).host } catch { return null }
}

export default function PrivacyScreen() {
  const host = projectHost()

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
          <a href="#local">What is stored on your device</a>
          <a href="#account">What is stored in your account</a>
          <a href="#who">Who can read it</a>
          <a href="#network">Network activity</a>
          <a href="#control">Your control</a>
          <a href="#retention">Retention and deletion</a>
          <a href="#children">Children</a>
          <a href="#changes">Changes</a>
        </nav>

        <div className="legal__body">

          <section id="short">
            <h2>The short version</h2>
            <p>
              Habit OS works without an account. Used that way, everything you enter stays in
              your browser&rsquo;s local storage on the device you entered it on, it is never
              sent anywhere, and nobody else can read it.
            </p>
            <p>
              Signing in is optional and it is the only thing that changes this. If you create
              an account, a copy of your data is stored in that account so it can reach your
              other devices. You can remove that copy, or delete the account outright, at any
              time, and your device keeps its own copy either way.
            </p>
            <p>
              There is no analytics, no advertising, no tracking and no profiling, with or
              without an account. Nothing about you is sold or shared with anyone.
            </p>
            {!cloudConfigured && (
              <p>
                <strong>This particular build has no account system.</strong> It was published
                without cloud credentials, so the sign-in screen does not appear and the
                &ldquo;in your account&rdquo; sections below do not apply to it at all.
              </p>
            )}
          </section>

          <section id="local">
            <h2>What is stored on your device</h2>
            <p>
              The app writes a single entry to your browser&rsquo;s local storage under the key{' '}
              <strong>{STORAGE_KEY}</strong>. It contains exactly what you typed in:
            </p>
            <ul>
              <li>Your habits: name, icon, area, cadence, target, cue and notes.</li>
              <li>Your check-ins: which day, and the value you recorded.</li>
              <li>Your work: titles, notes, deadlines, task lists and time or progress log entries.</li>
              <li>Your goals: title, reason, target date, and which habits and work are linked to them.</li>
              <li>Your mood entries: the day, a 1 to 5 rating, and an optional note.</li>
              <li>Your preferences: display name, theme, motion setting and week start.</li>
              <li>
                A list of the identifiers of things you have deleted, with the time of deletion.
                This exists so that deleting something on one device does not get undone by
                another device that still remembers it. It holds identifiers and timestamps
                only, never the content of what was deleted, and entries are discarded after
                180 days.
              </li>
            </ul>
            <p>
              Three further small keys record whether the sidebar is expanded, when you last
              exported a backup, and {cloudConfigured
                ? 'how you previously chose to combine this device\u2019s data with your account.'
                : 'nothing else.'}
              {cloudConfigured && ' If you sign in, your browser also stores your session token so you stay signed in, under the key '}
              {cloudConfigured && <strong>aaru.auth</strong>}
              {cloudConfigured && '.'}
            </p>

            <h3>What is never collected</h3>
            <p>
              No location, no contacts, no device fingerprint, no advertising identifier and no
              behavioural telemetry. The app does not record which screens you visit, how long
              you spend in it, or what you click. There are no third-party scripts, no
              trackers and no advertising cookies.
            </p>
          </section>

          <section id="account">
            <h2>What is stored in your account</h2>
            {cloudConfigured ? (
              <>
                <p>
                  Only if you choose to sign in. An account stores two things, and nothing else.
                </p>
                <p>
                  <strong>Your document.</strong> The same data listed above, as one JSON record
                  belonging to your user id. It is the app&rsquo;s own data structure, copied
                  verbatim. Nothing is derived from it, analysed, or enriched.
                </p>
                <p>
                  <strong>Your sign-in details.</strong> Your email address, a hash of your
                  password (never the password itself), and timestamps for when the account was
                  created, confirmed and last signed in. If you chose to enter a display name at
                  sign-up it is stored with the account.
                </p>
                <p>
                  Hosting is provided by Supabase{host ? <> on the project at <strong data-project-host>{host}</strong></> : null},
                  acting as a data processor. Supabase operates the database and authentication
                  service; it does not use your data for its own purposes. Their infrastructure
                  necessarily processes the IP address your requests come from, as any web
                  service does.
                </p>
              </>
            ) : (
              <p>
                Not applicable to this build: it has no account system, so there is no account
                and nothing is stored outside your browser.
              </p>
            )}
          </section>

          <section id="who">
            <h2>Who can read it</h2>
            <p>
              Without an account: only you, on that device. The data never leaves it.
            </p>
            {cloudConfigured && (
              <>
                <p>
                  With an account: only you. Every row in the database is owned by exactly one
                  user id, and row level security is enabled and enforced at the database level
                  on every table, scoped to the signed-in user. The key compiled into this
                  app&rsquo;s JavaScript is a public, restricted one whose entire authority is
                  bounded by those rules, which is why it is safe for it to be public. A request
                  for somebody else&rsquo;s data returns nothing, because the database refuses
                  it, not because the app chooses not to ask.
                </p>
                <p>
                  The policies are part of the published source, in{' '}
                  <strong>supabase/schema.sql</strong>, and are verified on every deployment.
                </p>
              </>
            )}
            <p>
              Nothing is sold, rented, shared for advertising, or handed to data brokers. There
              is no analytics provider to share it with.
            </p>
          </section>

          <section id="network">
            <h2>Network activity</h2>
            <p>
              Loading the page involves the host serving it. The app is published as static
              files, so the host serves the HTML, JavaScript, CSS and fonts, and like any web
              host it can see the request. Fonts are bundled and served from the same origin,
              so no font CDN sees you.
            </p>
            <p>
              {cloudConfigured
                ? 'With no account signed in, the app makes no further network requests: your data is never sent. Once you sign in, it exchanges your document with your account \u2014 when you sign in, shortly after you make a change, and when you return to the tab \u2014 and nothing else.'
                : 'Once the page has loaded, the app makes no network requests at all. It does not call an API, because this build has none.'}
            </p>
            <p>
              A service worker caches the application files so the app keeps working offline.
              The cache holds application code only, never your habit data.
            </p>
          </section>

          <section id="control">
            <h2>Your control</h2>
            <p>
              Settings has an <strong>Export</strong> button that writes everything to a JSON
              file you keep, and an <strong>Import</strong> button that reads one back. The
              format is plain, readable JSON, not a proprietary blob.
            </p>
            <p>
              <strong>Reset app</strong> in Settings erases the stored entry immediately.
              Clearing site data in your browser does the same thing.
            </p>
            {cloudConfigured && (
              <p>
                On the <Link to="account">account page</Link> you can sign out, which leaves this
                device&rsquo;s copy untouched; <strong>remove the cloud copy</strong>, which
                deletes the stored document but keeps your account; or{' '}
                <strong>delete your account</strong>, which erases the account and everything in
                it permanently. None of these touch the copy in this browser.
              </p>
            )}
          </section>

          <section id="retention">
            <h2>Retention and deletion</h2>
            <p>
              Data on your device is kept until you delete it. There is no expiry and no
              server-side retention period to wait out.
            </p>
            {cloudConfigured && (
              <p>
                Data in your account is kept until you remove it. Deleting your account runs in
                a single database transaction that removes your document, your profile row and
                your authentication record together. It is immediate and it is not recoverable,
                so export a backup first if you might want one.
              </p>
            )}
          </section>

          <section id="children">
            <h2>Children</h2>
            <p>
              The app is not directed at children and carries no advertising. Without an account
              it collects nothing from anyone. {cloudConfigured && 'Creating an account requires an email address, so accounts are intended for adults.'}
            </p>
          </section>

          <section id="changes">
            <h2>Changes</h2>
            <p>
              This page is updated in the same release as any change to what the app does with
              your data, and the change is visible in the project&rsquo;s commit history. Cloud
              sync was added as an optional feature and this page was rewritten for it; sync is
              something you switch on by signing in, never a default.
            </p>
            <p>
              Questions are best raised as an issue on the project&rsquo;s GitHub repository,
              which is also where you can read the source and confirm all of the above for
              yourself.
            </p>
          </section>

        </div>
      </div>
    </article>
  )
}
