import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { randomBytes } from 'node:crypto'
import { assertPublicBundle, assertPerformanceBudget, BUDGETS } from '../qa/build-proof.mjs'

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

describe('V4 performance budgets (docs/V4-AUDIT.md §7)', () => {
  const fixture = (name, mk) => {
    const dir = join('node_modules', '.cache', 'budget-fixture', name)
    rmSync(dir, { recursive: true, force: true })
    mkdirSync(join(dir, 'assets'), { recursive: true })
    mk(dir)
    return dir
  }

  it('accepts an artifact whose initial JS/CSS fit and never references three.js', () => {
    const dir = fixture('ok', (root) => {
      writeFileSync(join(root, 'assets', 'index-abc.js'), 'console.log(1)')
      writeFileSync(join(root, 'assets', 'index-abc.css'), 'body{}')
      writeFileSync(join(root, 'index.html'), '<script type="module" src="/assets/index-abc.js"></script><link rel="stylesheet" href="/assets/index-abc.css">')
    })
    expect(() => assertPerformanceBudget(dir)).not.toThrow()
  })

  it('rejects an initial JS payload over budget (incompressible bytes)', () => {
    const over = Math.ceil(BUDGETS.initialJsGzip * 1.25)
    const dir = fixture('over-js', (root) => {
      writeFileSync(join(root, 'assets', 'index-big.js'), randomBytes(over))
      writeFileSync(join(root, 'assets', 'index-abc.css'), 'body{}')
      writeFileSync(join(root, 'index.html'), '<script type="module" src="/assets/index-big.js"></script><link rel="stylesheet" href="/assets/index-abc.css">')
    })
    expect(() => assertPerformanceBudget(dir)).toThrow(/initial JS/)
  })

  it('rejects three.js being referenced from index.html (WebGL must stay lazy)', () => {
    const dir = fixture('three-eager', (root) => {
      writeFileSync(join(root, 'assets', 'index-abc.js'), 'x')
      writeFileSync(join(root, 'assets', 'three.module-xyz.js'), 'y')
      writeFileSync(join(root, 'assets', 'index-abc.css'), 'body{}')
      writeFileSync(join(root, 'index.html'), '<script type="module" src="/assets/index-abc.js"></script><link rel="modulepreload" href="/assets/three.module-xyz.js"><link rel="stylesheet" href="/assets/index-abc.css">')
    })
    expect(() => assertPerformanceBudget(dir)).toThrow(/lazy-only/)
  })

  it('refuses to silently pass when the probe matches nothing', () => {
    const dir = fixture('empty', (root) => {
      writeFileSync(join(root, 'index.html'), '<html></html>')
    })
    expect(() => assertPerformanceBudget(dir)).toThrow(/no initial JS\/CSS/)
  })
})
