import { describe, expect, it, vi } from 'vitest'
import { privacyContext, createAiProvider, createSupabaseAiProvider, validateAiResponse, fallbackExplanation, buildCoachContext } from '../src/lib/ai.js'
describe('optional AI safety boundary',()=>{
 it('allowlists minimum context and excludes credentials',()=>expect(privacyContext({title:'Task',progress:50,password:'secret',token:'x'})).toEqual({title:'Task',progress:50}))
 it('builds context from facts only',()=>expect(buildCoachContext({}, { title:'Task', risk:'AT RISK' })).toEqual(expect.objectContaining({title:'Task',risk:'AT RISK'})))
 it('works without AI enabled',async()=>expect((await createAiProvider({enabled:false}).explain({summary:'Real'})).provider).toBe('off'))
 it('falls back when provider fails',async()=>expect((await createAiProvider({enabled:true,provider:{explain:async()=>{throw new Error('offline')}}}).explain({title:'Task',risk:'AT RISK',progress:40,expectedProgress:70})).summary).toBe('AI explanation unavailable.'))
 it('rejects unstructured responses',()=>expect(validateAiResponse('free text').valid).toBe(false))
 it('returns explicit unavailable fallback',()=>expect(fallbackExplanation({}).evidence[0]).toBe('Not enough data to determine this.'))
 it('targets the authenticated Supabase function without exposing a secret',async()=>{const fetchImpl=vi.fn(async()=>({ok:true,json:async()=>({result:{summary:'ok',evidence:[],recommendations:[]}})})); const supabase={supabaseUrl:'https://project.supabase.co',auth:{getSession:async()=>({data:{session:{access_token:'session-token'}}})}}; await createSupabaseAiProvider({supabase,fetchImpl}).explain({title:'Task'}); expect(fetchImpl.mock.calls[0][0]).toBe('https://project.supabase.co/functions/v1/ai'); expect(fetchImpl.mock.calls[0][1].headers.authorization).toBe('Bearer session-token')})
})
