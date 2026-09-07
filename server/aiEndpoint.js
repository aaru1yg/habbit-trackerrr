/* Minimal server-side AI boundary. Deploy behind an authenticated serverless
 * runtime; this module never exposes the provider key to the browser. */
const MAX_BYTES = 12000
const WINDOW_MS = 60_000
const MAX_REQUESTS = 10
const buckets = new Map()
export function createAiHandler({ verifyUser, fetchImpl = fetch, apiKey = process.env.OPENAI_API_KEY, model = process.env.OPENAI_MODEL || 'gpt-4o-mini' } = {}) {
  return async function handle(req, res) {
    if (req.method !== 'POST') return send(res, 405, { error: 'method-not-allowed' })
    if (!apiKey) return send(res, 503, { error: 'ai-unavailable' })
    const auth = req.headers?.authorization || ''
    if (!auth.startsWith('Bearer ') || !verifyUser) return send(res, 401, { error: 'unauthorized' })
    let user; try { user = await verifyUser(auth.slice(7)) } catch { return send(res, 401, { error: 'unauthorized' }) }
    if (!user?.id) return send(res, 401, { error: 'unauthorized' })
    const key = user.id; const now = Date.now(); const bucket = buckets.get(key) || { at: now, count: 0 }; if (now - bucket.at > WINDOW_MS) { bucket.at = now; bucket.count = 0 } if (++bucket.count > MAX_REQUESTS) return send(res, 429, { error: 'rate-limited' }); buckets.set(key, bucket)
    const raw = await readBody(req); if (!raw || raw.length > MAX_BYTES) return send(res, 413, { error: 'payload-too-large' })
    let body; try { body = JSON.parse(raw) } catch { return send(res, 400, { error: 'invalid-json' }) }
    if (!body.context || typeof body.context !== 'object' || !Array.isArray(body.allowedFields)) return send(res, 400, { error: 'invalid-request' })
    const safe = {}; const forbidden = /password|token|secret|service.?role|auth/i; for (const field of body.allowedFields.slice(0, 30)) if (!forbidden.test(field) && Object.prototype.hasOwnProperty.call(body.context, field)) safe[field] = body.context[field]
    try { const abort = new AbortController(); const timer = setTimeout(() => abort.abort(), 10000); const r = await fetchImpl('https://api.openai.com/v1/chat/completions', { method:'POST', signal:abort.signal, headers:{'content-type':'application/json',authorization:`Bearer ${apiKey}`}, body:JSON.stringify({ model, temperature:0, response_format:{type:'json_object'}, messages:[{role:'system',content:'Explain only the supplied facts. Return JSON with summary, evidence array, recommendations array. Never invent numbers, dates, names, or actions.'},{role:'user',content:JSON.stringify(safe)}] }) }); clearTimeout(timer); if(!r.ok) return send(res,502,{error:'provider-failure'}); const data=await r.json(); return send(res,200,{result:JSON.parse(data.choices?.[0]?.message?.content || '{}')}) } catch { return send(res,502,{error:'provider-failure'}) }
  }
}
function readBody(req) { return new Promise((resolve) => { let out=''; req.on('data', c => { out += c; if(out.length > MAX_BYTES) req.destroy() }); req.on('end',()=>resolve(out)); req.on('error',()=>resolve(null)) }) }
function send(res, code, body) { res.statusCode=code; res.setHeader?.('content-type','application/json'); res.end?.(JSON.stringify(body)); return body }
export const __test = { buckets }
