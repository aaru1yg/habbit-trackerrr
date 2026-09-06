# Supabase setup — making cloud accounts real

The app ships with a **local-only** fallback. It becomes a genuine multi-user
cloud app only after the steps below are completed against a real Supabase
project. Until then the UI honestly reports "Local only" and does not offer
accounts.

---

## 1. Create the project

1. Go to <https://supabase.com/dashboard> → **New project**.
2. Pick a name, a strong database password (store it in a password manager —
   it is **never** needed by this app), and a region near your users.
3. Wait for provisioning to finish.

## 2. Apply the schema

1. Open **SQL Editor → New query**.
2. Paste the entire contents of [`schema.sql`](./schema.sql) and click **Run**.
3. Confirm success. The script is idempotent — re-running it is safe.

This creates `profiles` and `user_state`, enables **and forces** Row Level
Security on both, adds `auth.uid()`-scoped policies for
select/insert/update/delete (8 in total, `authenticated` role only), revokes
all table access from the `anon` role, adds the supporting indexes, installs
the signup trigger, and creates `delete_own_account()`.

> The exact same file is executed against a real PostgreSQL engine in CI by
> `npm run test:schema`, which asserts that User B cannot read, update or
> delete User A's rows. If that job is green, the SQL in this repo is known
> to parse, run, and isolate correctly.

## 3. Verify RLS is actually on

**Database → Tables** → for both `profiles` and `user_state` the
**RLS enabled** badge must be present. If it is not, the schema did not apply.

You can also confirm in SQL:

```sql
select c.relname,
       c.relrowsecurity      as rls_enabled,
       c.relforcerowsecurity as rls_forced
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
 where n.nspname = 'public'
   and c.relname in ('profiles', 'user_state');
-- both rows must show rls_enabled = true AND rls_forced = true

select tablename, policyname, cmd, roles
  from pg_policies
 where schemaname = 'public'
 order by tablename, cmd;
-- expect 8 rows (4 per table), every one with roles = {authenticated}
```

## 4. Collect the two public values

**Project Settings → API**:

| Value | Where it goes |
| --- | --- |
| Project URL | `VITE_SUPABASE_URL` |
| `anon` / `publishable` key | `VITE_SUPABASE_PUBLISHABLE_KEY` |

> **Never** copy the `service_role` key into this project. Anything prefixed
> `VITE_` is compiled into the public JavaScript bundle. The publishable key is
> designed to be public; its power is limited entirely by the RLS policies
> applied in step 2.

## 5. Configure redirect URLs

**Authentication → URL Configuration**:

- **Site URL**: `https://aaru1yg.github.io/habbit-trackerrr/`
- **Redirect URLs** — add both:
  - `https://aaru1yg.github.io/habbit-trackerrr/`
  - `http://localhost:5173/`

Email confirmation and password-reset links will refuse to work if the
deployed origin is missing here.

## 6. Email settings

**Authentication → Providers → Email**:

- Keep **Confirm email** ON for a real production app. The UI handles the
  unverified state and offers a resend action.
- If you want frictionless testing first, you may temporarily turn it OFF.

> Supabase's built-in SMTP is rate-limited to a few emails per hour and is not
> intended for production. For real users, configure a custom SMTP provider
> under **Project Settings → Auth → SMTP Settings**.

## 7. Google OAuth (optional)

**Authentication → Providers → Google** → enable, then paste the client ID and
secret from a Google Cloud OAuth consent screen. Set the authorised redirect
URI to the value Supabase displays on that page.

## 8. Local development

```bash
cp .env.example .env
# fill in the two values from step 4
npm run dev
```

`.env` is gitignored. Do not commit it.

## 9. GitHub Pages / CI

The Pages workflow reads the same two values from repository secrets.

**Repo → Settings → Secrets and variables → Actions → New repository secret**:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

The deploy workflow fails the build if either is missing, and additionally
asserts that no `service_role` reference reached the bundle — so a
misconfigured deploy is never published silently.

## 10. Verify it is genuinely live

After deploying, in a clean browser profile:

1. Create account A → confirm email if enabled → sign in.
2. Create a habit. Reload. It must still be there.
3. Sign out. Create account B. B must see **none** of A's data.
4. Sign in as A in a second browser. A's habit must appear.

Isolation can also be checked directly in the dashboard: **Table Editor →
user_state** should contain one row per user, each with a distinct `user_id`.
