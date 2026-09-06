import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { assertPublicBundle } from '../qa/build-proof.mjs'

const jwt = (role) => [
  Buffer.from(JSON.stringify({ alg: 'HS256' })).toString('base64url'),
  Buffer.from(JSON.stringify({ role })).toString('base64url'),
  'not-a-real-signature',
].join('.')

describe('public release safety', () => {
  it('accepts public Supabase keys', () => {
    expect(() => assertPublicBundle(`sb_publishable_public-example ${jwt('anon')}`)).not.toThrow()
  })
  it('rejects encoded service-role JWTs without printing them', () => {
    expect(() => assertPublicBundle(jwt('service_role'))).toThrow(/Private JWT/)
  })
  it('rejects secret keys and private key material', () => {
    expect(() => assertPublicBundle('sb_secret_not-a-real-key')).toThrow(/Private credential/)
    expect(() => assertPublicBundle('-----BEGIN PRIVATE KEY-----')).toThrow(/Private credential/)
  })
  it('rejects test passwords if they ever reach a bundle', () => {
    expect(() => assertPublicBundle('test-only-sentinel', ['test-only-sentinel'])).toThrow(/test credential/)
  })
  it('all literal artwork paths used by screens actually exist', () => {
    const walk = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
      entry.isDirectory() ? walk(join(dir, entry.name)) : [join(dir, entry.name)])
    for (const path of walk('src').filter((p) => /\.(jsx|js)$/.test(p))) {
      for (const match of readFileSync(path, 'utf8').matchAll(/['"](art\/[\w-]+\.(?:webp|png|svg))['"]/g)) {
        expect(existsSync(join('public', match[1])), `${path}: ${match[1]}`).toBe(true)
      }
    }
  })
})
