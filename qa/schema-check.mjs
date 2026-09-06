#!/usr/bin/env node
/* Executes supabase/schema.sql against a real PostgreSQL engine (PGlite) and
 * asserts the objects and, critically, the RLS policies actually behave.
 *
 * This is NOT a substitute for the live-project proof in verify-supabase.mjs
 * — it cannot test Supabase Auth. What it does prove is that the SQL parses,
 * runs cleanly, is idempotent, and that the isolation predicates genuinely
 * deny cross-user access at the database level.
 *
 * Usage: node qa/schema-check.mjs
 */
import { readFileSync } from 'fs'
import { PGlite } from '@electric-sql/pglite'

let pass = 0, fail = 0
const failures = []
const check = (name, ok, detail = '') => {
  if (ok) { pass++; console.log(`  ✓ ${name}`) }
  else { fail++; failures.push(`${name}${detail ? ` — ${detail}` : ''}`); console.log(`  ✗ ${name}${detail ? ` — ${detail}` : ''}`) }
}

const UID_A = '11111111-1111-1111-1111-111111111111'
const UID_B = '22222222-2222-2222-2222-222222222222'

/* Supabase provides auth.uid() and the auth.users table. Recreate just enough
 * of that contract so the real schema can run unmodified. */
const SUPABASE_SHIM = `
create schema if not exists auth;
create table if not exists auth.users (
  id uuid primary key,
  email text unique,
  raw_user_meta_data jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);
-- auth.uid() reads the request JWT claims, exactly as it does on Supabase.
create or replace function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;
do $$ begin
  create role anon nologin;
exception when duplicate_object then null; end $$;
do $$ begin
  create role authenticated nologin;
exception when duplicate_object then null; end $$;
`

const db = new PGlite()

/** Run as a given user by setting the JWT claim + switching role. */
async function asUser(uid, fn) {
  await db.exec(`set local role authenticated;`)
  await db.query(`select set_config('request.jwt.claim.sub', $1, true)`, [uid])
  return fn()
}

async function main() {
  console.log('\nSchema execution + RLS behaviour check (real PostgreSQL via PGlite)\n')

  await db.exec(SUPABASE_SHIM)
  const sql = readFileSync('supabase/schema.sql', 'utf8')

  // ---- 1. the schema actually executes ----
  try {
    await db.exec(sql)
    check('schema.sql executes without error', true)
  } catch (e) {
    check('schema.sql executes without error', false, e.message)
    console.log('\nCannot continue — the schema does not run.')
    process.exit(1)
  }

  // ---- 2. idempotent ----
  try {
    await db.exec(sql)
    check('schema.sql is idempotent (re-run is clean)', true)
  } catch (e) {
    check('schema.sql is idempotent (re-run is clean)', false, e.message)
  }

  // ---- 3. tables ----
  const tables = await db.query(
    `select tablename from pg_tables where schemaname='public' order by tablename`
  )
  const names = tables.rows.map((r) => r.tablename)
  check('creates public.profiles', names.includes('profiles'))
  check('creates public.user_state', names.includes('user_state'))

  // ---- 4. RLS enabled AND forced ----
  const rls = await db.query(`
    select c.relname, c.relrowsecurity, c.relforcerowsecurity
      from pg_class c join pg_namespace n on n.oid=c.relnamespace
     where n.nspname='public' and c.relname in ('profiles','user_state')`)
  for (const r of rls.rows) {
    check(`${r.relname}: RLS enabled`, r.relrowsecurity === true)
    check(`${r.relname}: RLS forced (owner cannot bypass)`, r.relforcerowsecurity === true)
  }

  // ---- 5. policies: 4 per table, authenticated only ----
  const pol = await db.query(
    `select tablename, cmd, roles::text from pg_policies where schemaname='public'`
  )
  check('8 policies exist (4 per table)', pol.rows.length === 8, `found ${pol.rows.length}`)
  const cmds = (t) => pol.rows.filter((r) => r.tablename === t).map((r) => r.cmd).sort()
  check('user_state covers SELECT/INSERT/UPDATE/DELETE',
    JSON.stringify(cmds('user_state')) === JSON.stringify(['DELETE', 'INSERT', 'SELECT', 'UPDATE']),
    cmds('user_state').join(','))
  check('profiles covers SELECT/INSERT/UPDATE/DELETE',
    JSON.stringify(cmds('profiles')) === JSON.stringify(['DELETE', 'INSERT', 'SELECT', 'UPDATE']),
    cmds('profiles').join(','))
  check('every policy is scoped to the authenticated role',
    pol.rows.every((r) => r.roles.includes('authenticated')))

  // ---- 6. indexes ----
  const idx = await db.query(
    `select indexname from pg_indexes where schemaname='public'`
  )
  const inames = idx.rows.map((r) => r.indexname)
  check('index on user_state.updated_at', inames.includes('user_state_updated_at_idx'))
  check('GIN index on user_state.doc', inames.includes('user_state_doc_gin_idx'))
  check('index on profiles.updated_at', inames.includes('profiles_updated_at_idx'))

  // ---- 7. signup trigger creates the profile ----
  await db.query(
    `insert into auth.users (id, email, raw_user_meta_data) values ($1,$2,$3)`,
    [UID_A, 'a@example.com', JSON.stringify({ display_name: 'User A' })]
  )
  await db.query(`insert into auth.users (id, email) values ($1,$2)`, [UID_B, 'b@example.com'])
  const profs = await db.query(`select id, display_name from public.profiles order by id`)
  check('signup trigger auto-creates a profile row', profs.rows.length === 2, `found ${profs.rows.length}`)
  check('signup trigger copies display_name from metadata',
    profs.rows.find((r) => r.id === UID_A)?.display_name === 'User A')

  // ---- 8. constraints ----
  let rejected = false
  try {
    await db.query(`insert into public.user_state (user_id, doc) values ($1, $2::jsonb)`, [UID_A, '"a string"'])
  } catch { rejected = true }
  check('rejects a non-object doc (check constraint)', rejected)

  // ---- 9. THE ISOLATION TESTS (the whole point) ----
  await db.exec('begin')
  await asUser(UID_A, async () => {
    await db.query(
      `insert into public.user_state (user_id, doc) values ($1, $2::jsonb)`,
      [UID_A, JSON.stringify({ habits: [{ id: 'hA', name: 'A private habit' }] })]
    )
  })
  await db.exec('commit')

  await db.exec('begin')
  await asUser(UID_B, async () => {
    await db.query(
      `insert into public.user_state (user_id, doc) values ($1, $2::jsonb)`,
      [UID_B, JSON.stringify({ habits: [{ id: 'hB', name: 'B private habit' }] })]
    )
  })
  await db.exec('commit')

  // B tries to read A
  await db.exec('begin')
  await asUser(UID_B, async () => {
    const r = await db.query(`select * from public.user_state where user_id = $1`, [UID_A])
    check('User B CANNOT read User A rows', r.rows.length === 0, `leaked ${r.rows.length}`)

    const all = await db.query(`select user_id from public.user_state`)
    const foreign = all.rows.filter((x) => x.user_id !== UID_B)
    check('User B unfiltered SELECT returns only their own row',
      all.rows.length === 1 && foreign.length === 0,
      `saw ${all.rows.length} rows, ${foreign.length} foreign`)

    const upd = await db.query(
      `update public.user_state set doc = '{"hacked":true}'::jsonb where user_id = $1 returning user_id`, [UID_A])
    check('User B CANNOT update User A rows', upd.rows.length === 0)

    const del = await db.query(`delete from public.user_state where user_id = $1 returning user_id`, [UID_A])
    check('User B CANNOT delete User A rows', del.rows.length === 0)

    const p = await db.query(`select id from public.profiles`)
    check('User B CANNOT read other profiles', p.rows.length === 1 && p.rows[0].id === UID_B,
      `saw ${p.rows.length}`)
  })
  await db.exec('commit')

  // B cannot forge a row owned by A
  await db.exec('begin')
  let forgeBlocked = false
  try {
    await asUser(UID_B, async () => {
      await db.query(`insert into public.user_state (user_id, doc) values ($1,'{}'::jsonb)`, [
        '33333333-3333-3333-3333-333333333333',
      ])
    })
  } catch { forgeBlocked = true }
  await db.exec('rollback')
  check('User B CANNOT insert a row owned by someone else (WITH CHECK)', forgeBlocked)

  // A's data intact after all of B's attempts
  await db.exec('begin')
  await asUser(UID_A, async () => {
    const r = await db.query(`select doc from public.user_state where user_id=$1`, [UID_A])
    check('User A data intact after User B attack attempts',
      r.rows[0]?.doc?.habits?.[0]?.name === 'A private habit')
    check('User A can read their own row', r.rows.length === 1)
  })
  await db.exec('commit')

  // anon sees nothing
  await db.exec('begin')
  await db.exec(`set local role anon;`)
  let anonBlocked
  try {
    const r = await db.query(`select * from public.user_state`)
    anonBlocked = r.rows.length === 0
  } catch { anonBlocked = true } // privilege revoked entirely
  await db.exec('rollback')
  check('anonymous role can read nothing', anonBlocked)

  // ---- 10. generated columns + updated_at trigger ----
  await db.exec('begin')
  await asUser(UID_A, async () => {
    const r = await db.query(`select habit_count from public.user_state where user_id=$1`, [UID_A])
    check('generated habit_count reflects the document', r.rows[0]?.habit_count === 1,
      `got ${r.rows[0]?.habit_count}`)
  })
  await db.exec('commit')

  console.log(`\n${pass} passed, ${fail} failed`)
  if (fail) {
    console.log('\nFAILURES:')
    failures.forEach((f) => console.log(`  ✗ ${f}`))
    process.exit(1)
  }
  console.log('\n✅ schema.sql runs on real PostgreSQL and enforces user isolation at the database level.')
}

main().catch((e) => { console.error(e); process.exit(1) })
