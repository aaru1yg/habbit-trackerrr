/* ============================================================
   LOCAL SUPABASE STUB — for verification, never for production.

   This sandbox cannot reach supabase.co, so the only way to drive
   the *real* @supabase/supabase-js client through a real sign-up,
   sign-in, write, read and merge is to give it a server to talk
   to. This implements the handful of GoTrue and PostgREST routes
   the app actually uses, in memory.

   It is deliberately NOT a Supabase emulator. It exists so that
   browser verification exercises genuine HTTP through the genuine
   SDK rather than a mocked-out module. Row level security is the
   database's job and is tested for real by
   .github/workflows/verify-supabase.yml against the live project.

   Run:  node qa/supabase-stub.mjs [port]
   ============================================================ */
import { createServer } from 'node:http'
import { randomUUID, createHash } from 'node:crypto'

const PORT = Number(process.argv[2] || 54321)

/* ---- in-memory tables ---- */
const users = new Map()       // email -> { id, email, password, confirmed, meta }
const tokens = new Map()      // access_token -> user id
const userState = new Map()   // user_id -> { doc, revision, updated_at, created_at }

const b64url = (o) => Buffer.from(JSON.stringify(o)).toString('base64url')

/** A structurally valid JWT. Unsigned: nothing here verifies it, and the
 *  client only ever parses the payload for `exp` and `sub`. */
function mintToken(user) {
  const now = Math.floor(Date.now() / 1000)
  const jwt = [
    b64url({ alg: 'HS256', typ: 'JWT' }),
    b64url({ sub: user.id, email: user.email, role: 'authenticated', iat: now, exp: now + 3600, aud: 'authenticated' }),
    createHash('sha256').update(user.id + now).digest('base64url').slice(0, 43),
  ].join('.')
  tokens.set(jwt, user.id)
  return jwt
}

const publicUser = (u) => ({
  id: u.id,
  aud: 'authenticated',
  role: 'authenticated',
  email: u.email,
  email_confirmed_at: u.confirmed ? new Date().toISOString() : null,
  confirmed_at: u.confirmed ? new Date().toISOString() : null,
  phone: '',
  created_at: u.created_at,
  updated_at: new Date().toISOString(),
  app_metadata: { provider: 'email', providers: ['email'] },
  user_metadata: u.meta || {},
  identities: [],
})

function session(u) {
  const access_token = mintToken(u)
  return {
    access_token,
    token_type: 'bearer',
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    refresh_token: 'refresh-' + randomUUID(),
    user: publicUser(u),
  }
}

const caller = (req) => {
  const raw = req.headers.authorization?.replace(/^Bearer\s+/i, '') || ''
  const id = tokens.get(raw)
  return id ? [...users.values()].find((u) => u.id === id) || null : null
}

/* ---- tiny helpers ---- */
function send(res, code, body, extra = {}) {
  const payload = body === null ? '' : JSON.stringify(body)
  res.writeHead(code, {
    'content-type': 'application/json',
    'access-control-allow-origin': '*',
    'access-control-allow-headers': '*',
    'access-control-allow-methods': 'GET,POST,PATCH,DELETE,PUT,OPTIONS',
    'access-control-expose-headers': 'content-range, x-supabase-api-version',
    ...extra,
  })
  res.end(payload)
}
const authErr = (res, code, msg) => send(res, code, { error: msg, error_description: msg, message: msg, msg })
const restErr = (res, code, message, pgCode) => send(res, code, { code: pgCode, message, details: null, hint: null })

const readBody = (req) => new Promise((resolve) => {
  let s = ''
  req.on('data', (c) => { s += c })
  req.on('end', () => { try { resolve(s ? JSON.parse(s) : {}) } catch { resolve({}) } })
})

/** Parse PostgREST's `col=eq.value` filters. */
function filters(url) {
  const out = {}
  for (const [k, v] of url.searchParams) {
    if (k === 'select' || k === 'order' || k === 'limit') continue
    const m = /^eq\.(.*)$/.exec(v)
    if (m) out[k] = m[1]
  }
  return out
}

const server = createServer(async (req, res) => {
  if (req.method === 'OPTIONS') return send(res, 204, null)
  const url = new URL(req.url, `http://localhost:${PORT}`)
  const path = url.pathname
  const body = ['POST', 'PATCH', 'PUT'].includes(req.method) ? await readBody(req) : {}

  /* ---------------- GoTrue ---------------- */

  if (path === '/auth/v1/settings') {
    return send(res, 200, { external: { email: true, google: false }, disable_signup: false, mailer_autoconfirm: true })
  }

  if (path === '/auth/v1/signup') {
    const email = String(body.email || '').trim().toLowerCase()
    const password = String(body.password || '')
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return authErr(res, 400, 'Unable to validate email address: invalid format')
    if (password.length < 8) return authErr(res, 422, 'Password should be at least 8 characters')
    if (users.has(email)) return authErr(res, 422, 'User already registered')
    const u = {
      id: randomUUID(), email, password, confirmed: true,
      created_at: new Date().toISOString(),
      meta: body.data || {},
    }
    users.set(email, u)
    // Auto-confirm, like a project with email confirmation switched off.
    return send(res, 200, session(u))
  }

  if (path === '/auth/v1/token') {
    const grant = url.searchParams.get('grant_type')
    if (grant === 'password') {
      const email = String(body.email || '').trim().toLowerCase()
      const u = users.get(email)
      if (!u || u.password !== String(body.password || '')) {
        return authErr(res, 400, 'Invalid login credentials')
      }
      return send(res, 200, session(u))
    }
    if (grant === 'refresh_token') {
      const u = [...users.values()][0]
      if (!u) return authErr(res, 401, 'Invalid Refresh Token')
      return send(res, 200, session(u))
    }
    return authErr(res, 400, 'Unsupported grant type')
  }

  if (path === '/auth/v1/user') {
    const u = caller(req)
    if (!u) return authErr(res, 401, 'invalid claim: missing sub claim')
    if (req.method === 'PUT') {
      if (body.password) {
        if (String(body.password).length < 8) return authErr(res, 422, 'Password should be at least 8 characters')
        u.password = body.password
      }
      if (body.data) u.meta = { ...u.meta, ...body.data }
      return send(res, 200, publicUser(u))
    }
    return send(res, 200, publicUser(u))
  }

  if (path === '/auth/v1/logout') {
    const raw = req.headers.authorization?.replace(/^Bearer\s+/i, '') || ''
    tokens.delete(raw)
    return send(res, 204, null)
  }

  if (path === '/auth/v1/recover' || path === '/auth/v1/resend') {
    // Always a success shape: real GoTrue does not leak whether the
    // address exists, and neither does the UI copy.
    return send(res, 200, {})
  }

  /* ---------------- PostgREST ---------------- */

  if (path === '/rest/v1/rpc/delete_own_account') {
    const u = caller(req)
    if (!u) return restErr(res, 401, 'permission denied', '42501')
    userState.delete(u.id)
    users.delete(u.email)
    return send(res, 204, null)
  }

  if (path === '/rest/v1/user_state') {
    const u = caller(req)
    // Stands in for RLS: with no authenticated caller, nothing matches.
    if (!u) return restErr(res, 401, 'permission denied for table user_state', '42501')
    const f = filters(url)
    const single = String(req.headers.accept || '').includes('pgrst.object')
    const own = (id) => id === u.id // a caller can only ever reach their own row

    if (req.method === 'GET') {
      const row = userState.get(u.id)
      const match = row && (!f.user_id || own(f.user_id))
      if (single) {
        if (!match) return send(res, 406, { code: 'PGRST116', message: 'The result contains 0 rows' })
        return send(res, 200, { user_id: u.id, ...row })
      }
      return send(res, 200, match ? [{ user_id: u.id, ...row }] : [])
    }

    if (req.method === 'POST') {
      if (userState.has(u.id)) {
        return restErr(res, 409, 'duplicate key value violates unique constraint "user_state_pkey"', '23505')
      }
      const now = new Date().toISOString()
      const row = { doc: body.doc ?? {}, revision: body.revision ?? 1, schema_version: body.schema_version ?? 5, updated_at: now, created_at: now }
      userState.set(u.id, row)
      return send(res, 201, single ? { user_id: u.id, ...row } : [{ user_id: u.id, ...row }])
    }

    if (req.method === 'PATCH') {
      const row = userState.get(u.id)
      // The compare half of compare-and-swap: a revision filter that does
      // not match updates zero rows, exactly as Postgres would.
      const revOk = f.revision === undefined || String(row?.revision) === String(f.revision)
      if (!row || !revOk) {
        if (single) return send(res, 406, { code: 'PGRST116', message: 'The result contains 0 rows' })
        return send(res, 200, [])
      }
      Object.assign(row, {
        doc: body.doc ?? row.doc,
        revision: body.revision ?? row.revision,
        schema_version: body.schema_version ?? row.schema_version,
        updated_at: new Date().toISOString(), // trigger-equivalent
      })
      return send(res, 200, single ? { user_id: u.id, ...row } : [{ user_id: u.id, ...row }])
    }

    if (req.method === 'DELETE') {
      userState.delete(u.id)
      return send(res, 204, null)
    }
  }

  send(res, 404, { message: `stub: no route for ${req.method} ${path}` })
})

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[supabase-stub] listening on http://0.0.0.0:${PORT}`)
})
