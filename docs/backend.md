# The account backend

Everything in the app works without this. Habits, check-ins, work items,
goals, moods and the whole history live in the browser under the key
`aaru.os.v5`, and the app is built so that a missing backend costs you
sync and nothing else. The backend exists only to copy that document
between your devices.

Read this if sign-in is failing, or if you are pointing the app at a new
Supabase project.

---

## What is wrong right now

The deployed site cannot sign anyone in. The cause is not in the code.

The published build points at the Supabase project
`vtillcfcexbkggqjveyj`, and that hostname no longer resolves:

```
$ getent hosts supabase.com                              # the platform
216.150.1.193   supabase.com
$ getent hosts supabase.co                               # the project domain
76.76.21.21     supabase.co
$ getent hosts vtillcfcexbkggqjveyj.supabase.co          # this project
(NXDOMAIN)
$ getent hosts zzzznonexistentproject99.supabase.co      # a made-up ref
(NXDOMAIN)
```

DNS works from that machine, `supabase.co` itself resolves, and there is
no wildcard that answers for every name. The project's hostname is
simply not published, and it behaves exactly like a project reference
that was invented on the spot. In the browser this surfaces as
`net::ERR_NAME_NOT_RESOLVED`, which the Supabase client reports as a bare
`Failed to fetch`, which is what became "Can't reach the server".

Supabase was operational throughout; there is an unrelated open incident
about latency in the eastern US, and latency does not remove a DNS
record.

**What this does not tell us.** NXDOMAIN does not distinguish a paused
project from a deleted one. Supabase's own troubleshooting guide says a
paused project stops serving its hostname and resolves as NXDOMAIN even
though the project still exists
([troubleshooting guide](https://supabase.com/docs/guides/troubleshooting/nxdomain-error-connecting-to-a-supabase-project)).
Both states look identical from outside. Only the dashboard can tell you which one this is, which is why
step 1 below is to go and look rather than to guess.

---

## Step 1: find out which it is

Open <https://supabase.com/dashboard/org/_/> and find the project in the
list. You are looking for one of three things.

| What you see | What it means | Go to |
|---|---|---|
| Status **Paused**, with a **Restore** button | The data is intact on disk | Step 2A |
| The project is not in the list at all | Deleted, or in a different organisation | Step 2B |
| Status **Paused** but no working restore | Free projects release their infrastructure, including the API hostname, after a long enough pause | Step 2B |

Check every organisation you belong to before concluding it is gone, and
check whether you are signed into the same account that created it.

Free projects are paused after a stretch with no API requests. The
project had been serving a site that nobody had to visit, so this is the
ordinary outcome rather than anything going wrong.

---

## Step 2A: the project is paused

Restore it from the dashboard and wait for the status to read **Active**
before testing. Restores usually take under three minutes, and querying
during the restore is the classic way to scare yourself with empty
tables.

If it comes back on the same project reference, nothing else needs to
change: the existing repository secrets still point at it, and the next
deploy will pass the reachability check on its own. Confirm with:

```
getent hosts vtillcfcexbkggqjveyj.supabase.co
```

If that answers, you are done. If the project reference changed, treat it
as step 2B from "Point the app at it" onwards.

---

## Step 2B: the project is gone

### Create it

New project in the dashboard. Pick the region closest to the people using
it. Note the project reference from the address bar.

### Create the schema

Open **SQL Editor → New query**, paste the whole of
[`supabase/schema.sql`](../supabase/schema.sql), and run it. It is
written to be re-runnable, so running it twice is safe. It creates:

- `public.user_state`, one row per user, holding the whole document as
  jsonb, with `revision` as a compare-and-swap token
- `public.profiles`, one row per user, filled in automatically on signup
  by the `handle_new_user` trigger
- row level security **enabled and forced** on both tables, with four
  `auth.uid()` policies each, so the publishable key cannot reach
  another person's row
- `touch_updated_at`, so timestamps come from the server clock rather
  than from whatever a device thinks the time is
- `delete_own_account()`, so the delete button in Settings removes the
  login and the data together or not at all

Then run the verification queries commented at the bottom of the file.
You want RLS enabled and forced on both tables, and eight policies, all
scoped to `authenticated`. If RLS is off, stop and fix that before
putting the publishable key anywhere public: the key is the only thing
standing between a stranger and the table, and it is not a secret.

### Point the app at it

In **Project Settings → API**, copy the project URL and the publishable
key. The publishable key is designed to ship in client JavaScript, and
it does. The `service_role` key is not, must never be used here, and the
deploy fails on purpose if it ever appears in the bundle.

In GitHub, under **Settings → Secrets and variables → Actions**:

| Name | Kind | Value |
|---|---|---|
| `VITE_SUPABASE_URL` | Secret | `https://<ref>.supabase.co` |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Secret | the publishable key |
| `VITE_SUPABASE_GOOGLE` | Variable | `true`, only after the section below works |

With no secrets set the build still succeeds and deploys a local-only
app, with a warning in the log and legal pages that say so. That is a
supported state, not a broken one.

### Tell Supabase where the app lives

**Authentication → URL Configuration**:

- Site URL: `https://aaru1yg.github.io/habbit-trackerrr/`
- Redirect URLs: add `https://aaru1yg.github.io/habbit-trackerrr/**`

Email confirmations and password resets fail with a redirect error if
this is wrong, and the error arrives in the user's mail client rather
than the app, so it is worth getting right the first time.

If you move to a custom domain, add that origin here too rather than
replacing this one, so both keep working during the switch.

---

## Google sign-in

You asked for this and it is not currently set up. The button stays
hidden until `VITE_SUPABASE_GOOGLE` is `true`, so there is no dead
control in the meantime, and the app withdraws it again if the backend
turns out to be unreachable.

Three places have to agree. Doing them out of order is the usual reason
this fails.

**1. Google Cloud.** Create a project at
<https://console.cloud.google.com/>, then **APIs & Services → OAuth
consent screen**. External, fill in the app name, your support email and
a developer email. While it is in Testing, only accounts you add as test
users can sign in; publish it when you want anyone to.

Then **Credentials → Create credentials → OAuth client ID → Web
application**:

- Authorised JavaScript origins: `https://aaru1yg.github.io`
  (origin only, no path, no trailing slash)
- Authorised redirect URIs:
  `https://<ref>.supabase.co/auth/v1/callback`

The redirect URI points at Supabase, not at the site. Google returns the
user to Supabase, and Supabase returns them to the app. Pointing it at
the GitHub Pages URL is the single most common mistake here and produces
`redirect_uri_mismatch`.

**2. Supabase.** **Authentication → Sign In / Providers → Google**.
Enable it and paste the client ID and client secret. Confirm the
callback URL shown on that screen is character-for-character the one you
gave Google.

**3. This repository.** Set the `VITE_SUPABASE_GOOGLE` variable to
`true` and re-run the deploy. The button appears.

Note that the app asks Supabase to return to `redirectTo()`, which is
the current origin plus the deployment's base path. On GitHub Pages that
is `https://aaru1yg.github.io/habbit-trackerrr/`, which is why the
wildcard in the redirect allowlist above matters.

---

## Checking it actually works

Deploy, then run the smoke test against the live site:

```
SITE=https://aaru1yg.github.io/habbit-trackerrr/ \
EXPECT_BUILD=$(git rev-parse HEAD) \
node qa/live-smoke.mjs
```

It reads the project host from the privacy page, which publishes it
deliberately, and probes it. The check that would have caught the
current outage is `the account backend is reachable`. It runs a control
request first and reports that it cannot tell, rather than failing,
when the machine running it has no outbound network.

A green smoke test proves the site is served correctly and the backend
answers. It does not prove row level security is right, because it never
signs in. For that, `qa/verify-supabase.mjs` signs two separate users in
against a real project and checks that neither can read the other's row.
It needs credentials and has never been run against a live project. Run
it once after setting this up:

```
VITE_SUPABASE_URL=https://<ref>.supabase.co \
VITE_SUPABASE_PUBLISHABLE_KEY=<key> \
node qa/verify-supabase.mjs
```

Run that way it proves the schema is applied and that a signed-out
stranger can read nothing. The two-user isolation matrix, which is the
part that actually proves RLS, is skipped unless you also create two
confirmed accounts once and pass them in:

```
TEST_A_EMAIL=... TEST_A_PASSWORD=... \
TEST_B_EMAIL=... TEST_B_PASSWORD=... \
```

The script tells you which checks it skipped and why, rather than
reporting a pass it did not earn.

---

## If you would rather not run a backend

Delete the two secrets. The next deploy produces a local-only build.
There is no sign-in form and nothing to sign in to; the Account screen
stays in the navigation and explains that the build runs without a
server, and points at the export and import in Settings so backups are
still your own. Privacy and terms describe a build with no account
system, because they read the same flag at build time. Nothing else
about the app changes.
