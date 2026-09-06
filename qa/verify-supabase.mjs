#!/usr/bin/env node
/* LIVE Supabase verification — the proof script.
 *
 * This performs the checks that cannot be faked: it creates two real accounts
 * against the real project, writes real rows, reloads, and attempts a
 * cross-user read that MUST be refused by Row Level Security.
 *
 * It never prints the anon key and never needs the service-role key.
 *
 * Usage:
 *   VITE_SUPABASE_URL=... VITE_SUPABASE_ANON_KEY=... node qa/verify-supabase.mjs
 *
 * Exit code 0 only if every check passes. Anything else means the backend is
 * NOT ready to be called live.
 */
import { createClient } from '@supabase/supabase-js'

const URL = process.env.VITE_SUPABASE_URL?.trim()
const KEY = process.env.VITE_SUPABASE_ANON_KEY?.trim()

if (!URL || !KEY) {
  console.error('✗ VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY must be set.')
  process.exit(2)
}

let pass = 0
let fail = 0
const failures = []
const check = (name, ok, detail = '') => {
  if (ok) { pass++; console.log(`  ✓ ${name}`) }
  else { fail++; failures.push(`${name}${detail ? ` — ${detail}` : ''}`); console.log(`  ✗ ${name}${detail ? ` — ${detail}` : ''}`) }
}

const stamp = Date.now()
const userA = { email: `qa-a-${stamp}@example.com`, password: `Qa!${stamp}aA` }
const userB = { email: `qa-b-${stamp}@example.com`, password: `Qa!${stamp}bB` }

const mkClient = () => createClient(URL, KEY, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
})

async function signUpOrIn(client, creds) {
  const up = await client.auth.signUp({ email: creds.email, password: creds.password })
  if (up.error) return { error: up.error }
  if (up.data.session) return { session: up.data.session, confirmed: true }
  // Email confirmation is on → we cannot complete an automated session.
  const inRes = await client.auth.signInWithPassword(creds)
  if (inRes.error) return { error: inRes.error, needsConfirmation: true }
  return { session: inRes.data.session, confirmed: true }
}

async function main() {
  console.log(`\nLIVE Supabase verification → ${URL}\n`)

  // ---- 1. reachability ----
  // Probe with raw fetch first. A supabase-js query that fails to connect
  // returns { error } rather than throwing, which would otherwise be
  // indistinguishable from a legitimate RLS refusal and produce a FALSE PASS.
  try {
    const res = await fetch(`${URL}/auth/v1/health`, { headers: { apikey: KEY } })
    check('Supabase endpoint reachable over the network', res.ok || res.status < 500,
      `HTTP ${res.status}`)
    if (!res.ok && res.status >= 500) throw new Error(`HTTP ${res.status}`)
  } catch (e) {
    check('Supabase endpoint reachable over the network', false, e.message)
    console.log('\n✗ Cannot reach the Supabase project — no further check can be trusted.')
    console.log('  Nothing below this line was verified. Do NOT claim auth is live.')
    process.exit(1)
  }

  const anon = mkClient()
  const { error: schemaErr } = await anon.from('user_state').select('user_id').limit(1)
  if (schemaErr && /relation .* does not exist|schema cache|could not find the table/i.test(schemaErr.message)) {
    check('schema applied (user_state table exists)', false, schemaErr.message)
    console.log('\n✗ Run supabase/schema.sql in the SQL Editor first.')
    process.exit(1)
  }
  check('schema applied (user_state table exists)', true)

  // ---- 2. anonymous access must be denied by RLS ----
  const { data: anonRows } = await anon.from('user_state').select('*')
  check('anonymous cannot read any user_state rows (RLS)', !anonRows || anonRows.length === 0,
    anonRows ? `returned ${anonRows.length} rows` : '')

  // ---- 3. real account A ----
  const clientA = mkClient()
  const a = await signUpOrIn(clientA, userA)
  if (a.error) {
    check('User A can sign up', false, a.error.message)
    if (a.needsConfirmation) {
      console.log('\n⚠ Email confirmation appears to be ENABLED.')
      console.log('  Automated end-to-end proof needs it OFF, or a pre-confirmed test user.')
      console.log('  Disable: Authentication → Providers → Email → Confirm email.')
    }
    process.exit(1)
  }
  check('User A can sign up and obtain a session', !!a.session)
  const uidA = a.session.user.id

  // ---- 4. profile row auto-created by the signup trigger ----
  const { data: profA } = await clientA.from('profiles').select('id').eq('id', uidA).maybeSingle()
  check('profile row auto-created for User A', !!profA)

  // ---- 5. A writes real data ----
  const docA = { version: 4, habits: [{ id: 'hA', name: 'User A private habit', order: 0 }], checkins: {}, moods: {}, projects: [], assignments: [], routines: [], profile: { name: 'A' } }
  const { error: wErr } = await clientA.from('user_state')
    .upsert({ user_id: uidA, doc: docA, revision: 1 }, { onConflict: 'user_id' })
  check('User A can write their own row', !wErr, wErr?.message)

  // ---- 6. persistence: fresh client + fresh sign-in sees the data ----
  const clientA2 = mkClient()
  const { error: reErr } = await clientA2.auth.signInWithPassword(userA)
  check('User A can sign in again (session persistence path)', !reErr, reErr?.message)
  const { data: reread } = await clientA2.from('user_state').select('doc').eq('user_id', uidA).maybeSingle()
  check('User A data survives a brand-new client/session',
    reread?.doc?.habits?.[0]?.name === 'User A private habit')

  // ---- 7. real account B ----
  const clientB = mkClient()
  const b = await signUpOrIn(clientB, userB)
  check('User B can sign up (separate account)', !!b.session, b.error?.message)
  if (!b.session) process.exit(1)
  const uidB = b.session.user.id
  check('User A and User B have distinct ids', uidA !== uidB)

  // ---- 8. THE ISOLATION TEST ----
  const { data: bReadsA } = await clientB.from('user_state').select('*').eq('user_id', uidA)
  check('User B CANNOT read User A rows (RLS select)', !bReadsA || bReadsA.length === 0,
    bReadsA?.length ? `LEAKED ${bReadsA.length} rows` : '')

  const { data: bAll } = await clientB.from('user_state').select('*')
  const leaked = (bAll || []).filter((r) => r.user_id !== uidB)
  check('User B unfiltered select returns only their own rows', leaked.length === 0,
    leaked.length ? `LEAKED ${leaked.length} foreign rows` : '')

  const { error: modErr, data: modData } = await clientB.from('user_state')
    .update({ doc: { hacked: true } }).eq('user_id', uidA).select()
  check('User B CANNOT modify User A rows', !!modErr || !modData || modData.length === 0)

  const { data: delData } = await clientB.from('user_state').delete().eq('user_id', uidA).select()
  check('User B CANNOT delete User A rows', !delData || delData.length === 0)

  // A's data must be intact after B's attempts
  const { data: afterAttack } = await clientA2.from('user_state').select('doc').eq('user_id', uidA).maybeSingle()
  check('User A data intact after User B attack attempts',
    afterAttack?.doc?.habits?.[0]?.name === 'User A private habit')

  const { data: bProfiles } = await clientB.from('profiles').select('*')
  const profLeak = (bProfiles || []).filter((r) => r.id !== uidB)
  check('User B cannot read other profiles', profLeak.length === 0)

  // ---- 9. account deletion actually removes cloud data ----
  const { error: delFnErr } = await clientB.rpc('delete_own_account')
  check('delete_own_account() runs for the caller', !delFnErr, delFnErr?.message)
  const clientBGone = mkClient()
  const { error: goneErr } = await clientBGone.auth.signInWithPassword(userB)
  check('deleted account can no longer sign in', !!goneErr)

  console.log(`\n${pass} passed, ${fail} failed`)
  if (fail) {
    console.log('\nFAILURES:')
    failures.forEach((f) => console.log(`  ✗ ${f}`))
    console.log('\n⚠ Backend is NOT verified. Do not claim auth/cloud is live.')
    process.exit(1)
  }
  console.log('\n✅ Live Supabase verification PASSED — auth, persistence and RLS isolation confirmed.')
  console.log(`   (test accounts used: ${userA.email}, ${userB.email} — delete A from the dashboard)`)
}

main().catch((e) => { console.error(e); process.exit(1) })
