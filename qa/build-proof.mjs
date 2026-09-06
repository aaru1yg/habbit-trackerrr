/* Production artifact safety + verifiable build inventory.
 * Run after Vite: node qa/build-proof.mjs [dist]. Never prints credential values.
 */
import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { resolve, relative } from 'node:path'
import { pathToFileURL } from 'node:url'
import { createHash } from 'node:crypto'
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
  if (!readFileSync(resolve(root, 'sw.js'), 'utf8').includes(`aaru-habits-v7-${buildId}`)) {
    throw new Error('Service worker build identity does not match.')
  }
  writeFileSync(resolve(root, 'release.json'), JSON.stringify({ commit, buildId, builtAt, files }, null, 2) + '\n')
  console.log(`Build proof: ${commit}; ${Object.keys(files).length} SHA-256 checksums; no private credentials.`)
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) buildProof(process.argv[2])
