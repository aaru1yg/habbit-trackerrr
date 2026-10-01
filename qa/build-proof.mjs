/* Production artifact safety + verifiable build inventory.
 * Run after Vite: node qa/build-proof.mjs [dist]. Never prints credential values.
 */
import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { resolve, relative } from 'node:path'
import { pathToFileURL } from 'node:url'
import { createHash } from 'node:crypto'
import { gzipSync } from 'node:zlib'
import { execFileSync } from 'node:child_process'

export const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex')

export function assertPublicBundle(text, privateValues = []) {
  if (/service_role|sb_secret_[a-zA-Z0-9_-]+|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/.test(text)) {
    throw new Error('Private credential material found in public build (value redacted).')
  }
  for (const jwt of text.matchAll(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g)) {
    try {
      const payload = JSON.parse(Buffer.from(jwt[0].split('.')[1], 'base64url').toString())
      if (payload.role === 'service_role') throw new Error('Private JWT found in public build (value redacted).')
    } catch (error) {
      if (error.message.startsWith('Private JWT')) throw error
    }
  }
  if (privateValues.some((value) => value && text.includes(value))) {
    throw new Error('A test credential was found in public build (value redacted).')
  }
}

export function fileInventory(root) {
  const files = {}
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = resolve(dir, entry.name)
      if (entry.isDirectory()) walk(path)
      else if (entry.isFile() && entry.name !== 'release.json') {
        files[relative(root, path).replaceAll('\\', '/')] = sha256(readFileSync(path))
      }
    }
  }
  walk(root)
  return files
}

/**
 * Performance budgets, enforced on the artifact.
 *
 * These are ratchets, not aspirations: they sit just above what the build
 * currently costs, so any regression has to be argued for rather than drift
 * in unnoticed. At the time of writing the redesign ships 76 kB of initial
 * JS and 8 kB of CSS gzipped; three.js and the whole 3D layer are gone, and
 * every screen except Today is a lazy chunk.
 *
 * If you legitimately need more, raise the number in the same commit that
 * spends it and say why.
 */
export const BUDGETS = { initialJsGzip: 96 * 1024, initialCssGzip: 16 * 1024 }

export function assertPerformanceBudget(dir = 'dist') {
  const root = resolve(dir)
  const html = readFileSync(resolve(root, 'index.html'), 'utf8')
  const assets = [...html.matchAll(/(?:src|href)="[^"]*?\/assets\/([^"]+?)"/g)].map((m) => m[1])
  let js = 0
  let css = 0
  for (const name of assets) {
    const bytes = readFileSync(resolve(root, 'assets', name))
    const gz = gzipSync(bytes).length
    if (name.endsWith('.js')) js += gz
    if (name.endsWith('.css')) css += gz
  }
  if (!js || !css) throw new Error('Perf budget probe found no initial JS/CSS in index.html — asset regex or build output changed.')
  // Only Today is eager. Every other screen must stay behind React.lazy, or
  // the initial bundle quietly absorbs the whole app again.
  const eagerScreens = assets.filter((name) => /(Habits|Work|Goals|Insights|Settings|Privacy|Terms)(Screen|Detail)/.test(name))
  if (eagerScreens.length) {
    throw new Error(`Perf budget: ${eagerScreens.join(', ')} are referenced from index.html and must stay lazy.`)
  }
  if (js > BUDGETS.initialJsGzip) {
    throw new Error(`Perf budget: initial JS ${(js / 1024).toFixed(1)} kB gzip exceeds ${(BUDGETS.initialJsGzip / 1024).toFixed(0)} kB.`)
  }
  if (css > BUDGETS.initialCssGzip) {
    throw new Error(`Perf budget: initial CSS ${(css / 1024).toFixed(1)} kB gzip exceeds ${(BUDGETS.initialCssGzip / 1024).toFixed(0)} kB.`)
  }
  console.log(`Perf budget OK: initial JS ${(js / 1024).toFixed(1)} kB gz, CSS ${(css / 1024).toFixed(1)} kB gz, screens lazy.`)
}

export function buildProof(dir = 'dist') {
  const root = resolve(dir)
  const files = fileInventory(root)
  const code = Object.keys(files).filter((path) => /\.(?:js|css|html|json|svg)$/.test(path))
    .map((path) => readFileSync(resolve(root, path), 'utf8')).join('\n')
  assertPublicBundle(code, [process.env.TEST_A_PASSWORD, process.env.TEST_B_PASSWORD])
  const commit = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim()
  const html = readFileSync(resolve(root, 'index.html'), 'utf8')
  const buildId = html.match(/<meta name="build-id" content="([^"]+)"/)?.[1]
  const builtAt = html.match(/<meta name="build-time" content="([^"]+)"/)?.[1]
  if (buildId !== commit.slice(0, 7) || !builtAt) throw new Error('Build metadata does not match the checked-out commit.')
  if (!readFileSync(resolve(root, 'sw.js'), 'utf8').includes(`habit-os-v8-${buildId}`)) {
    throw new Error('Service worker build identity does not match.')
  }
  writeFileSync(resolve(root, 'release.json'), JSON.stringify({ commit, buildId, builtAt, files }, null, 2) + '\n')
  assertPerformanceBudget(root)
  console.log(`Build proof: ${commit}; ${Object.keys(files).length} SHA-256 checksums; no private credentials.`)
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) buildProof(process.argv[2])
