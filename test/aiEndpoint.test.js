import { describe, expect, it, vi } from 'vitest'
import { createAiHandler } from '../server/aiEndpoint.js'
function req(body, headers={authorization:'Bearer token'}) { const events={}; return { method:'POST',headers,on:(e,fn)=>{events[e]=fn},emit(){events.data?.(JSON.stringify(body));events.end?.()} } }
function res(){return {headers:{},setHeader(k,v){this.headers[k]=v},end(v){this.body=JSON.parse(v)}}}
describe('server AI boundary',()=>{
 it('rejects unauthorized requests',async()=>{const r=res();await createAiHandler({apiKey:'x'})(req({},{}),r);expect(r.body.error).toBe('unauthorized')})
 it('filters fields before provider invocation',async()=>{let sent;const r=res();const fetchImpl=vi.fn(async(u,o)=>{sent=JSON.parse(o.body);return {ok:true,json:async()=>({choices:[{message:{content:'{"summary":"ok","evidence":[],"recommendations":[]}'}}]})}});const q=req({context:{title:'Task',password:'x'},allowedFields:['title','password']});const p=createAiHandler({apiKey:'x',verifyUser:async()=>({id:'u'}),fetchImpl});const promise=p(q,r);await new Promise(resolve=>setTimeout(resolve,0));q.emit();await promise;expect(sent.messages[1].content).toContain('title');expect(sent.messages[1].content).not.toContain('password')})
 it('returns provider failure safely',async()=>{const r=res();const q=req({context:{title:'x'},allowedFields:['title']});const p=createAiHandler({apiKey:'x',verifyUser:async()=>({id:'u'}),fetchImpl:async()=>({ok:false})});const promise=p(q,r);await new Promise(resolve=>setTimeout(resolve,0));q.emit();await promise;expect(r.body.error).toBe('provider-failure')})
})
