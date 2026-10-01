# Supabase setup

Habit OS works with no account at all. Everything in this document is about
the optional half: backing a user's data up to their own account so it follows
them to a second device.

If you skip this, the app still builds and runs — it just reports
"This device only" and never offers a sign-in form.

---

## 1. Create the project

1. Create a project at <https://supabase.com/dashboard>.
2. Note the **Project URL** and the **publishable** (anon) key from
   *Project Settings → API*.

The publishable key is designed to be public. It ends up compiled into the
JavaScript bundle that every visitor downloads, and that is fine: its entire
authority is bounded by the row level security policies in `schema.sql`.

> The **service_role** key is the opposite of that. It bypasses RLS entirely.
> It must never appear in a `VITE_` variable, in this repository, or anywhere
> near the frontend.

## 2. Apply the schema

Open *SQL Editor → New query*, paste the whole of [`schema.sql`](./schema.sql),
and run it. It is idempotent, so re-running it after an edit is safe.

It creates:

| Object | Purpose |
| --- | --- |
| `public.profiles` | One row per auth user, created automatically on signup. |
| `public.user_state` | The user's app document as a single owned `jsonb` row. |
| `handle_new_user()` | Trigger that creates the profile row. |
| `touch_updated_at()` | Keeps `updated_at` server-authoritative and `created_at` immutable. |
| `delete_own_account()` | Lets a signed-in user erase their own account. Acts only on `auth.uid()`. |

Row level security is **enabled and forced** on both tables, with four
`auth.uid()`-scoped policies each, and the `anon` role is explicitly revoked
from both. The database enforces isolation; the frontend is not trusted to.

Verify it took, with the queries at the bottom of `schema.sql`. You should see
`rls_enabled` and `rls_forced` true for both tables, and eight policies, all
scoped to `authenticated`.

## 3. Configure auth

In *Authentication → Providers*, keep **Email** enabled.

In *Authentication → URL Configuration*, add every origin the app is served
from to **Redirect URLs**, including the trailing path if you deploy to a
subdirectory:

```
http://localhost:5173/
https://<your-custom-domain>/
https://<user>.github.io/<repo>/
```

The app derives its own redirect target from `window.location` (see
`src/cloud/config.js`), so it works on all three without a rebuild — but
Supabase will refuse any origin not on this list.

**Google sign-in is off by default.** Enabling the button is a separate,
deliberate step: configure the Google provider in Supabase, then build with
`VITE_SUPABASE_GOOGLE=true`. The button is hidden otherwise, because offering
a sign-in method that is not configured just sends people to an error page.

## 4. Build with the config

Locally, copy `.env.example` to `.env.local` and fill it in. `.env.local` is
gitignored.

```bash
cp .env.example .env.local
npm run dev
```

In CI, the values come from repository secrets `VITE_SUPABASE_URL` and
`VITE_SUPABASE_PUBLISHABLE_KEY`. `.github/workflows/deploy.yml` injects them at
build time and then **asserts that the real host and key are present in the
emitted bundle**, so a misconfigured secret fails the deploy instead of
shipping a login screen that cannot work.

`.github/workflows/verify-supabase.yml` goes further and performs a genuine
round-trip against the live project: sign up, write a document, read it back,
confirm another user cannot see it, then delete the account.

---

## How sync behaves

| Situation | What happens |
| --- | --- |
| No account | Status reads "This device only". Nothing is sent anywhere. |
| Sign in, account empty | This device's data seeds the account. |
| Sign in, device empty | The account's data is adopted. |
| Sign in, both hold data, identical | Nothing is written and nothing is asked. |
| Sign in, both hold data, different | The user is asked once: combine, keep this device, or keep the account. The answer is remembered per account per device. |
| Edit while signed in | Debounced write, 1.2 s after the last change. |
| Two devices write at once | The second write fails its compare-and-swap on `revision`, re-reads, merges, and writes again. Neither side's edits are dropped. |
| Offline | Status reads "Offline". Edits stay local and are sent on reconnect. |
| Tab regains focus | The document is re-read, so a change made on another device shows up. |

Deletions are recorded as tombstones in the document (`deleted`), because a
merge unions by id and would otherwise resurrect anything another device still
remembered. Tombstones are pruned after 180 days.

## What is stored

The `doc` column holds exactly what the app holds: profile (display name,
theme, motion preference, week start), habits, check-ins, work items and their
tasks, goals, mood entries, and the tombstone map. No analytics, no device
fingerprints, no behavioural logs.

The only other personal data is what Supabase Auth keeps in `auth.users`: the
email address, a password hash, and timestamps.
