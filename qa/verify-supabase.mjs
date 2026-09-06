#!/usr/bin/env node
/* LIVE Supabase verification — the proof script.
 *
 * Performs the checks that cannot be faked: it talks to the real project,
 * creates/uses real accounts, writes real rows, re-authenticates with a fresh
 * client, and attempts cross-user reads/writes that MUST be refused by Row
 * Level Security.
 *
 * It never prints the publishable key, an access token, or a password, and it
 * never needs the service-role key.
 *
 * Usage:
 *   VITE_SUPABASE_URL=... VITE_SUPABASE_PUBLISHABLE_KEY=... node qa/verify-supabase.mjs
 *
 * With "Confirm email" ENABLED (the secure default), a freshly signed-up
 * address cannot log in until the emailed link is clicked, so an unattended
 * run cannot complete the two-user matrix on throwaway addresses. Supply two
 * PRE-CONFIRMED accounts to get the full proof:
 *
 *   TEST_A_EMAIL / TEST_A_PASSWORD
 *   TEST_B_EMAIL / TEST_B_PASSWORD
 *
 * Exit code 0 only if every attempted check passed AND the isolation matrix
 * actually ran. Anything else means the backend is NOT proven.
 */
import { createClient } from '@supabase/supabase-js'

const URL_ = process.env.VITE_SUPABASE_URL?.trim()
const KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim()

if (!URL_ || !KEY) {
  console.error('✗ VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY must be set.')
  process.exit(2)
}

let pass = 0
let fail = 0
const failures = []
const skipped = []
const check = (name, ok, detail = '') => {
  if (ok) { pass++; console.log(`  ✓ ${name}`) }
  else { fail++; failures.push(`${name}${detail ? ` — ${detail}` : ''}`); console.log(`  ✗ ${name}${detail ? ` — ${detail}` : ''}`) }
  return ok
}
const skip = (name, why) => { skipped.push(`${name} — ${why}`); console.log(`  ⊘ ${name} (skipped: ${why})`) }

const mkClient = () => createClient(URL_, KEY, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
})

const stamp = Date.now()
const throwaway = {
  email: `qa-signup-${stamp}@example.com`,
  password: `Qa!${stamp}Xy`,
}

const preA = process.env.TEST_A_EMAIL && process.env.TEST_A_PASSWORD
  ? { email: process.env.TEST_A_EMAIL.trim(), password: process.env.TEST_A_PASSWORD }
  : null
const preB = process.env.TEST_B_EMAIL && process.env.TEST_B_PASSWORD
  ? { email: process.env.TEST_B_EMAIL.trim(), password: process.env.TEST_B_PASSWORD }
  : null

async function main() {
  console.log(`\nLIVE Supabase verification → ${URL_}\n`)

  // ================= 1. reachability =================
  // Raw fetch first: a supabase-js query that fails to connect returns
  // { error } rather than throwing, which is indistinguishable from a
  // legitimate RLS refusal and would produce a FALSE PASS.
  try {
    const res = await fetch(`${URL_}/auth/v1/health`, { headers: { apikey: KEY } })
    check('Supabase Auth endpoint reachable', res.status < 500, `HTTP ${res.status}`)
    if (res.status >= 500) throw new Error(`HTTP ${res.status}`)
  } catch (e) {
    check('Supabase Auth endpoint reachable', false, e.message)
    console.log('\n✗ Cannot reach the project — nothing below could be verified.')
    process.exit(1)
  }

  // ================= 2. schema applied =================
  const anon = mkClient()
  const { error: schemaErr } = await anon.from('user_state').select('user_id').limit(1)
  if (schemaErr && /does not exist|schema cache|could not find the table/i.test(schemaErr.message)) {
    check('schema applied (user_state reachable)', false, schemaErr.message)
    console.log('\n✗ Run supabase/schema.sql in the SQL Editor first.')
    process.exit(1)
  }
  check('schema applied (user_state reachable)', true)

  const { error: profErr } = await anon.from('profiles').select('id').limit(1)
  check('schema applied (profiles reachable)', !profErr || !/does not exist/i.test(profErr.message))

  // ================= 3. anonymous is locked out =================
  const { data: anonRows } = await anon.from('user_state').select('*')
  check('anonymous cannot read user_state (RLS + grants)',
    !anonRows || anonRows.length === 0,
    anonRows ? `LEAKED ${anonRows.length} rows` : '')
  const { data: anonProfiles } = await anon.from('profiles').select('*')
  check('anonymous cannot read profiles',
    !anonProfiles || anonProfiles.length === 0,
    anonProfiles ? `LEAKED ${anonProfiles.length} rows` : '')

  // ================= 4. real signup =================
  const suClient = mkClient()
  const su = await suClient.auth.signUp({ email: throwaway.email, password: throwaway.password })
  const rateLimited = /rate limit|too many requests/i.test(su.error?.message || '')
  let signupOk = false
  if (rateLimited) {
    // Supabase's built-in SMTP allows only a few messages per hour. That is a
    // project quota, not an application defect, so it must not read as a fail.
    skip('signup creates a real user', 'Supabase email rate limit — retry later or configure custom SMTP')
  } else {
    signupOk = check('signup creates a real user', !su.error && !!su.data?.user, su.error?.message)
  }
  const confirmRequired = signupOk && !su.data.session
  if (confirmRequired) {
    console.log('    ↳ no session returned → "Confirm email" is ENABLED (expected for this project)')
  }

  // Unverified users must not be able to log in.
  if (confirmRequired) {
    const { error: preConfirmErr } = await mkClient().auth
      .signInWithPassword({ email: throwaway.email, password: throwaway.password })
    check('unconfirmed account cannot sign in yet', !!preConfirmErr, 'login succeeded before confirmation')
  }

  // Email-sending checks consume the same hourly SMTP quota as signup, so skip
  // them when we are already throttled rather than compounding the problem.
  if (rateLimited) {
    skip('password reset request', 'email quota already exhausted this hour')
    skip('verification resend', 'email quota already exhausted this hour')
  } else {
    const { error: resetErr } = await mkClient().auth
      .resetPasswordForEmail(throwaway.email, { redirectTo: 'https://aaru1yg.github.io/habbit-trackerrr/' })
    const resetLimited = /rate limit|too many requests/i.test(resetErr?.message || '')
    if (resetLimited) skip('password reset request', 'Supabase email rate limit')
    else check('password reset request accepted by Supabase', !resetErr, resetErr?.message)

    const { error: resendErr } = await mkClient().auth
      .resend({ type: 'signup', email: throwaway.email })
    const resendLimited = /rate limit|too many requests/i.test(resendErr?.message || '')
    if (resendLimited) skip('verification resend', 'Supabase email rate limit')
    else check('verification resend accepted by Supabase', !resendErr, resendErr?.message)
  }

  // ================= 5. authenticated flows =================
  if (!preA || !preB) {
    console.log('')
    skip('login / session persistence', 'no pre-confirmed test accounts supplied')
    skip('cloud persistence', 'no pre-confirmed test accounts supplied')
    skip('two-user RLS isolation', 'no pre-confirmed test accounts supplied')
    console.log('')
    console.log('⚠ "Confirm email" is enabled, so throwaway signups cannot log in unattended.')
    console.log('  To complete login / persistence / isolation, create two users ONCE')
    console.log('  (Supabase Dashboard → Authentication → Users → Add user →')
    console.log('   tick "Auto Confirm User"), then add them as repository secrets:')
    console.log('    TEST_A_EMAIL / TEST_A_PASSWORD')
    console.log('    TEST_B_EMAIL / TEST_B_PASSWORD')
    console.log('  Auto-confirmed users send no email, so no quota is consumed.')
    console.log('')
    console.log(`${pass} passed, ${fail} failed, ${skipped.length} skipped`)
    if (fail) { failures.forEach((f) => console.log(`  ✗ ${f}`)); process.exit(1) }
    console.log('\n⚠ PARTIAL: connectivity, schema, anon lockout and signup verified.')
    console.log('  Login, persistence and isolation are NOT yet proven.')
    process.exit(3)
  }

  // ---- User A: login ----
  const clientA = mkClient()
  const { data: aData, error: aErr } = await clientA.auth
    .signInWithPassword({ email: preA.email, password: preA.password })
  if (!check('User A can log in', !aErr && !!aData?.session, aErr?.message)) {
    console.log('\n✗ Cannot continue without a User A session.')
    process.exit(1)
  }
  const uidA = aData.session.user.id
  check('User A session carries an access token', !!aData.session.access_token)
  check('User A email is confirmed', !!(aData.session.user.email_confirmed_at || aData.session.user.confirmed_at))

  // profile row exists (signup trigger)
  const { data: profA } = await clientA.from('profiles').select('id').eq('id', uidA).maybeSingle()
  check('profile row exists for User A (signup trigger)', !!profA)

  // ---- cloud write ----
  const marker = `A-habit-${stamp}`
  const docA = {
    version: 4,
    profile: { name: 'QA User A' },
    habits: [{ id: `h-${stamp}`, name: marker, order: 0, updatedAt: new Date().toISOString() }],
    checkins: {}, moods: {}, projects: [], assignments: [], routines: [],
  }
  const { error: wErr } = await clientA.from('user_state')
    .upsert({ user_id: uidA, doc: docA, revision: 1 }, { onConflict: 'user_id' })
  check('User A can write their own row', !wErr, wErr?.message)

  // ---- persistence via a brand-new client + fresh login (multi-browser) ----
  const clientA2 = mkClient()
  const { error: reErr } = await clientA2.auth
    .signInWithPassword({ email: preA.email, password: preA.password })
  check('User A can log in again from a fresh client (session persistence)', !reErr, reErr?.message)
  const { data: reread } = await clientA2.from('user_state').select('doc, updated_at').eq('user_id', uidA).maybeSingle()
  check('User A data readable from a second independent client (multi-browser sync)',
    reread?.doc?.habits?.[0]?.name === marker,
    `got ${reread?.doc?.habits?.[0]?.name}`)
  check('server stamped updated_at on write', !!reread?.updated_at)

  // ---- true session persistence: restore a stored session and refresh it ----
  // This is what "stay logged in across a reload" actually depends on: the
  // persisted refresh token must mint a NEW valid access token without a
  // password. Re-running signInWithPassword would not prove that.
  const restored = mkClient()
  const { data: setData, error: setErr } = await restored.auth.setSession({
    access_token: aData.session.access_token,
    refresh_token: aData.session.refresh_token,
  })
  check('stored session can be restored without a password (reload survives)',
    !setErr && !!setData?.session, setErr?.message)

  const { data: refreshed, error: refErr } = await restored.auth.refreshSession()
  check('refresh token mints a new access token (long-lived session)',
    !refErr && !!refreshed?.session?.access_token, refErr?.message)
  check('refreshed token differs from the original',
    refreshed?.session?.access_token && refreshed.session.access_token !== aData.session.access_token)

  const { data: restoredRead } = await restored.from('user_state').select('doc').eq('user_id', uidA).maybeSingle()
  check('restored session can read the user\u2019s cloud data',
    restoredRead?.doc?.habits?.[0]?.name === marker)

  // ---- local -> cloud migration, using the app\u2019s real merge engine ----
  // Simulates: device holds local-only data, account already holds cloud data,
  // user picks "merge". Both sides must survive; nothing may be lost.
  const { mergeDocs, summarise } = await import('../src/lib/cloud/merge.js')
  const localOnly = {
    version: 4,
    profile: { name: 'QA User A' },
    habits: [{ id: `local-${stamp}`, name: `local-habit-${stamp}`, order: 1, updatedAt: new Date().toISOString() }],
    checkins: { [`local-${stamp}`]: { '2026-01-01': { done: true } } },
    moods: {}, projects: [], assignments: [], routines: [],
  }
  const cloudNow = (await clientA.from('user_state').select('doc').eq('user_id', uidA).maybeSingle()).data?.doc
  const merged = mergeDocs(localOnly, cloudNow)
  const mSum = summarise(merged)
  check('merge keeps both local and cloud habits (no data loss)', mSum.habits === 2, `habits=${mSum.habits}`)
  check('merge preserves local check-ins', mSum.checkins >= 1, `checkins=${mSum.checkins}`)

  const { error: mErr } = await clientA.from('user_state')
    .upsert({ user_id: uidA, doc: merged, revision: 2 }, { onConflict: 'user_id' })
  check('merged document persists to the cloud', !mErr, mErr?.message)

  const { data: afterMerge } = await mkClient().auth
    .signInWithPassword({ email: preA.email, password: preA.password })
    .then(() => clientA2.from('user_state').select('doc').eq('user_id', uidA).maybeSingle())
  const names = (afterMerge?.doc?.habits || []).map((h) => h.name)
  check('migrated data is readable back from the cloud',
    names.includes(marker) && names.includes(`local-habit-${stamp}`),
    `got [${names.join(', ')}]`)

  // ---- User B ----
  const clientB = mkClient()
  const { data: bData, error: bErr } = await clientB.auth
    .signInWithPassword({ email: preB.email, password: preB.password })
  if (!check('User B can log in (separate account)', !bErr && !!bData?.session, bErr?.message)) {
    console.log('\n✗ Cannot run the isolation matrix without User B.')
    process.exit(1)
  }
  const uidB = bData.session.user.id
  check('User A and User B are distinct users', uidA !== uidB)

  await clientB.from('user_state').upsert(
    { user_id: uidB, doc: { version: 4, habits: [{ id: 'hB', name: `B-habit-${stamp}` }] }, revision: 1 },
    { onConflict: 'user_id' }
  )

  // ================= 6. THE ISOLATION MATRIX =================
  console.log('\n  — two-user isolation —')

  const { data: bReadsA } = await clientB.from('user_state').select('*').eq('user_id', uidA)
  check('User B CANNOT read User A rows', !bReadsA || bReadsA.length === 0,
    bReadsA?.length ? `LEAKED ${bReadsA.length} rows` : '')

  const { data: bAll } = await clientB.from('user_state').select('*')
  const leaked = (bAll || []).filter((r) => r.user_id !== uidB)
  check('User B unfiltered SELECT returns only their own row', leaked.length === 0,
    leaked.length ? `LEAKED ${leaked.length} foreign rows` : '')

  const { data: modData } = await clientB.from('user_state')
    .update({ doc: { hacked: true } }).eq('user_id', uidA).select()
  check('User B CANNOT modify User A rows', !modData || modData.length === 0)

  const { data: delData } = await clientB.from('user_state')
    .delete().eq('user_id', uidA).select()
  check('User B CANNOT delete User A rows', !delData || delData.length === 0)

  const { error: forgeErr, data: forgeData } = await clientB.from('user_state')
    .insert({ user_id: uidA, doc: { forged: true } }).select()
  check('User B CANNOT insert a row owned by User A (WITH CHECK)',
    !!forgeErr || !forgeData || forgeData.length === 0)

  const { data: bProfiles } = await clientB.from('profiles').select('*')
  const profLeak = (bProfiles || []).filter((r) => r.id !== uidB)
  check('User B CANNOT read other profiles', profLeak.length === 0,
    profLeak.length ? `LEAKED ${profLeak.length}` : '')

  // A's data must be intact after every attempt above
  const { data: afterAttack } = await clientA2.from('user_state').select('doc').eq('user_id', uidA).maybeSingle()
  check('User A data intact after all User B attempts',
    afterAttack?.doc?.habits?.[0]?.name === marker)

  // ================= 7. logout =================
  await clientB.auth.signOut()
  const { data: afterOut } = await clientB.auth.getSession()
  check('User B logout clears the session', !afterOut?.session)
  const { data: postOutRows } = await clientB.from('user_state').select('*')
  check('signed-out client can no longer read any rows',
    !postOutRows || postOutRows.length === 0,
    postOutRows?.length ? `LEAKED ${postOutRows.length}` : '')

  // ================= 8. cleanup =================
  // Leave the project tidy so repeat runs start from a known state. Each user
  // deletes only their OWN row, which RLS permits.
  const { error: cleanAErr } = await clientA2.from('user_state').delete().eq('user_id', uidA)
  check('User A can delete their own row (cleanup)', !cleanAErr, cleanAErr?.message)

  // ================= summary =================
  console.log(`\n${pass} passed, ${fail} failed${skipped.length ? `, ${skipped.length} skipped` : ''}`)
  if (fail) {
    console.log('\nFAILURES:')
    failures.forEach((f) => console.log(`  ✗ ${f}`))
    console.log('\n⚠ Backend is NOT verified. Do not claim auth/cloud is live.')
    process.exit(1)
  }
  console.log('\n✅ LIVE verification PASSED — real auth, cloud persistence and')
  console.log('   database-enforced two-user isolation confirmed against the real project.')
  console.log(`   (throwaway signup used: ${throwaway.email} — delete it from the dashboard)`)
}

main().catch((e) => { console.error(e); process.exit(1) })
