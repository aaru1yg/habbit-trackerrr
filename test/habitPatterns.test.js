import { describe, expect, it } from 'vitest'
import { weekdayPattern, timePattern, trendAnalysis, streakPattern, workloadInteraction, PATTERN_THRESHOLDS } from '../src/lib/habitPatterns.js'
const habit={id:'h',name:'Read',schedule:{type:'daily'},archived:false}; const state={habits:[habit],checkins:{h:{'2026-09-01':{done:true,at:'2026-09-01T08:00:00'},'2026-09-02':{done:true,at:'2026-09-02T08:00:00'}}},projects:[],assignments:[]}
describe('habit pattern intelligence',()=>{
 it('documents conservative thresholds',()=>expect(PATTERN_THRESHOLDS.weekdayObservations).toBe(3))
 it('does not infer weekday patterns from tiny samples',()=>expect(weekdayPattern(state,habit,10).enough).toBe(false))
 it('requires timestamped completions for time patterns',()=>expect(timePattern(state,habit,10).enough).toBe(false))
 it('returns explicit insufficient trend state',()=>expect(trendAnalysis(state,habit,3)).toMatchObject({id:'INSUFFICIENT DATA'}))
 it('does not claim streak behavior from one run',()=>expect(streakPattern(state,habit).enough).toBe(false))
 it('safely suppresses workload comparisons without two groups',()=>expect(workloadInteraction(state,habit,10).enough).toBe(false))
})
