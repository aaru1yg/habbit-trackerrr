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
const passNames = []
const skipped = []
const check = (name, ok, detail = '') => {
  if (ok) { pass++; passNames.push(name); console.log(`  ✓ ${name}`) }
  else { fail++; failures.push(`${name}${detail ? ` — ${detail}` : ''}`); console.log(`  ✗ ${name}${detail ? ` — ${detail}` : ''}`) }
  return ok
}
const skip = (name, why) => { skipped.push(`${name} — ${why}`); console.log(`  ⊘ ${name} (skipped: ${why})`) }
/* Emit a GitHub annotation directly. Raw logs/artifacts are served from blob
 * storage that some environments cannot reach; annotations come from the API. */
const note = (msg) => {
  console.log(`    ${msg}`)
  if (process.env.GITHUB_ACTIONS) console.log(`::notice::DIAG ${msg}`)
}

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

/* Validate the shape of supplied test credentials before spending network
 * calls, so a malformed secret reports as a config error rather than
 * resurfacing later as a confusing "Invalid login credentials". */
function preflight() {
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  const problems = []
  for (const [label, creds] of [['TEST_A', preA], ['TEST_B', preB]]) {
    if (!creds) continue
    if (!EMAIL_RE.test(creds.email)) {
      const at = (creds.email.match(/@/g) || []).length
      problems.push(
        `${label}_EMAIL is not a valid email address ` +
        `(length=${creds.email.length}, "@" count=${at}` +
        `${at === 0 ? ' — the value contains no "@" at all' : ''}` +
        `${/\s/.test(creds.email) ? ', contains whitespace' : ''}` +
        `${/^["']|["']$/.test(creds.email) ? ', wrapped in quotes' : ''})`
      )
    }
    if (!creds.password) problems.push(`${label}_PASSWORD is empty`)
  }
  if (problems.length) {
    console.log('  ✗ test credential preflight failed\n')
    for (const p of problems) {
      console.log(`    • ${p}`)
      if (process.env.GITHUB_ACTIONS) console.log(`::error::${p}`)
    }
    console.log('')
    console.log('    Fix the repository secret, then re-run. Values are never printed —')
    console.log('    only their shape, so the secret itself stays protected.')
    process.exit(2)
  }
}

async function main() {
  console.log(`\nLIVE Supabase verification → ${URL_}\n`)
  preflight()

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
  // Supabase signup validates email-domain deliverability and rejects reserved
  // or non-deliverable domains (error code email_address_invalid, e.g.
  // @example.com since 2026-09). That is a platform email policy, not an application defect,
  // so it gets the same honest treatment as the SMTP rate limit: a loud skip,
  // never a fake pass. Real signup/login remains covered by the pre-confirmed
  // TEST_A/TEST_B flows below.
  const addressRejected = su.error?.code === 'email_address_invalid'
    || /email address.*is invalid/i.test(su.error?.message || '')
  let signupOk = false
  if (rateLimited) {
    // Supabase's built-in SMTP allows only a few messages per hour. That is a
    // project quota, not an application defect, so it must not read as a fail.
    skip('signup creates a real user', 'Supabase email rate limit — retry later or configure custom SMTP')
  } else if (addressRejected) {
    skip('signup creates a real user', 'backend rejects throwaway email domains (email_address_invalid) — platform email policy, not an app defect')
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
    // Diagnose without ever printing the password. Distinguishes a wrong
    // password from an unconfirmed/nonexistent user, and reports the shape of
    // the configured values so a stray quote or newline in a secret is visible.
    const shape = (v) => v
      ? `len=${v.length} first=${v[0]} last=${v[v.length - 1]}` +
        (/^["']|["']$/.test(v) ? ' ⚠ WRAPPED IN QUOTES' : '') +
        (/\s/.test(v) ? ' ⚠ CONTAINS WHITESPACE' : '')
      : 'EMPTY'
    // Describe the email's STRUCTURE without printing it — GitHub masks the
    // secret value anyway, so the shape is the only usable signal.
    const emailShape = (v) => {
      if (!v) return 'EMPTY'
      const parts = v.split('@')
      return [
        `len=${v.length}`,
        `at_count=${parts.length - 1}`,
        parts.length === 2 ? `local_len=${parts[0].length}` : 'NO_SINGLE_@',
        parts.length === 2 ? `domain="${parts[1]}"` : '',
        parts.length === 2 && parts[1].includes('.') ? 'has_dot_in_domain' : '⚠ NO_DOT_IN_DOMAIN',
        /\s/.test(v) ? '⚠ WHITESPACE' : '',
        /^["']|["']$/.test(v) ? '⚠ QUOTED' : '',
        /[<>,;]/.test(v) ? '⚠ HAS_<>,;' : '',
        v !== v.trim() ? '⚠ UNTRIMMED' : '',
      ].filter(Boolean).join(' ')
    }
    note(`TEST_B_EMAIL shape: ${emailShape(process.env.TEST_B_EMAIL)}`)
    note(`TEST_A_EMAIL shape: ${emailShape(process.env.TEST_A_EMAIL)} (works)`)
    note(`TEST_B_PASSWORD: ${shape(process.env.TEST_B_PASSWORD)}`)
    note(`TEST_A_EMAIL: ${preA.email} (this one worked)`)
    note(`TEST_A_PASSWORD: ${shape(process.env.TEST_A_PASSWORD)}`)
    note(`A and B are the same email: ${preA.email === preB.email}`)

    // Does the account exist at all? A reset request on a real address is
    // accepted; this does not reveal the password and is rate-limit tolerant.
    const { error: probeErr } = await mkClient().auth.resetPasswordForEmail(preB.email)
    if (probeErr && /rate limit/i.test(probeErr.message)) {
      note('existence probe inconclusive (email rate limit)')
    } else {
      note(`password-reset probe for TEST_B_EMAIL: ${probeErr ? 'rejected — ' + probeErr.message : 'accepted (address is known to Supabase)'}`)
    }
    console.log('')
    console.log('    Most likely causes, in order:')
    console.log('      1. TEST_B_PASSWORD does not match the password set for that user.')
    console.log('      2. The user was created but "Auto Confirm User" was left unticked.')
    console.log('      3. The secret value picked up surrounding quotes or a trailing newline.')
    console.log('')
    console.log('✗ Cannot run the isolation matrix without User B.')
    process.exit(1)
  }
  const uidB = bData.session.user.id
  check('User A and User B are distinct users', uidA !== uidB)

  // ---- User B cloud write + read-back from an independent client ----
  const markerB = `B-habit-${stamp}`
  const { error: bwErr } = await clientB.from('user_state').upsert(
    {
      user_id: uidB,
      doc: {
        version: 4,
        profile: { name: 'QA User B' },
        habits: [{ id: `hB-${stamp}`, name: markerB, order: 0, updatedAt: new Date().toISOString() }],
        checkins: {}, moods: {}, projects: [], assignments: [], routines: [],
      },
      revision: 1,
    },
    { onConflict: 'user_id' }
  )
  check('User B can write their own row', !bwErr, bwErr?.message)

  const clientB2 = mkClient()
  const { error: bReErr } = await clientB2.auth
    .signInWithPassword({ email: preB.email, password: preB.password })
  check('User B can log in again from a fresh client', !bReErr, bReErr?.message)
  const { data: bReread } = await clientB2.from('user_state')
    .select('doc').eq('user_id', uidB).maybeSingle()
  check('User B cloud read-back from a second independent client',
    bReread?.doc?.habits?.[0]?.name === markerB,
    `got ${bReread?.doc?.habits?.[0]?.name}`)

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

  // ---- the reverse direction: A must not reach B either ----
  // Isolation is only proven if it holds symmetrically; testing one direction
  // could pass on an accidentally asymmetric policy.
  console.log('\n  — reverse direction (A → B) —')

  const { data: aReadsB } = await clientA2.from('user_state').select('*').eq('user_id', uidB)
  check('User A CANNOT read User B rows', !aReadsB || aReadsB.length === 0,
    aReadsB?.length ? `LEAKED ${aReadsB.length} rows` : '')

  const { data: aAll } = await clientA2.from('user_state').select('*')
  const aLeaked = (aAll || []).filter((r) => r.user_id !== uidA)
  check('User A unfiltered SELECT returns only their own row', aLeaked.length === 0,
    aLeaked.length ? `LEAKED ${aLeaked.length} foreign rows` : '')

  const { data: aMod } = await clientA2.from('user_state')
    .update({ doc: { hacked: true } }).eq('user_id', uidB).select()
  check('User A CANNOT update User B rows', !aMod || aMod.length === 0)

  const { data: aDel } = await clientA2.from('user_state')
    .delete().eq('user_id', uidB).select()
  check('User A CANNOT delete User B rows', !aDel || aDel.length === 0)

  const { error: aForgeErr, data: aForge } = await clientA2.from('user_state')
    .insert({ user_id: uidB, doc: { forged: true } }).select()
  check('User A CANNOT forge a row owned by User B (WITH CHECK)',
    !!aForgeErr || !aForge || aForge.length === 0)

  const { data: aProfiles } = await clientA2.from('profiles').select('*')
  const aProfLeak = (aProfiles || []).filter((r) => r.id !== uidA)
  check('User A CANNOT read other profiles', aProfLeak.length === 0,
    aProfLeak.length ? `LEAKED ${aProfLeak.length}` : '')

  // B's data must survive everything A just attempted
  const { data: bIntact } = await clientB2.from('user_state')
    .select('doc').eq('user_id', uidB).maybeSingle()
  check('User B data intact after all User A attempts',
    bIntact?.doc?.habits?.[0]?.name === markerB,
    `got ${bIntact?.doc?.habits?.[0]?.name}`)

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
  const { error: cleanBErr } = await clientB2.from('user_state').delete().eq('user_id', uidB)
  check('User B can delete their own row (cleanup)', !cleanBErr, cleanBErr?.message)

  // ================= summary =================
  const summary = `${pass} passed, ${fail} failed${skipped.length ? `, ${skipped.length} skipped` : ''}`
  console.log(`\n${summary}`)
  // GitHub caps ::notice:: annotations per step, which truncates long runs.
  // Emit the roll-up and any failures as warnings/errors so the outcome is
  // always retrievable via the API even when individual notices are dropped.
  if (process.env.GITHUB_ACTIONS) {
    console.log(`::warning::RESULT ${summary}`)
    const names = (arr) => arr.join(' | ')
    if (failures.length) console.log(`::error::FAILED: ${names(failures)}`)
    if (skipped.length) console.log(`::warning::SKIPPED: ${names(skipped)}`)
    // Compact roll-up of everything that passed, in one annotation.
    console.log(`::warning::PASSED(${passNames.length}): ${names(passNames)}`)
  }
  if (fail) {
    console.log('\nFAILURES:')
    failures.forEach((f) => console.log(`  ✗ ${f}`))
    console.log('\n⚠ Backend is NOT verified. Do not claim auth/cloud is live.')
    process.exit(1)
  }
  console.log('\n✅ LIVE verification PASSED — real auth, cloud persistence and')
  console.log('   database-enforced two-user isolation confirmed against the real project.')
  if (signupOk) console.log(`   (throwaway signup used: ${throwaway.email} — delete it from the dashboard)`)
}

main().catch((e) => { console.error(e); process.exit(1) })
