/* Evidence-only fallback for environments that can reach GitHub's Checks API
 * but not the Azure artifact redirects. Original full-size PNGs remain in
 * the workflow artifact. Encoded JPEG previews are retrievable from check
 * annotations, without committing generated files or deploying anything. */
import { readFileSync, readdirSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import sharp from 'sharp'

const dir = 'qa/shots/workspace'
const result = JSON.parse(readFileSync(`${dir}/results.json`, 'utf8'))
const viewport = process.env.WORK_QA_VIEWPORT
const repo = process.env.GITHUB_REPOSITORY
if (!repo || !viewport) throw new Error('CI repository/viewport required')
const api = (path, method, body) => JSON.parse(execFileSync('gh', ['api', path, '--method', method, '--input', '-'], { input: JSON.stringify(body), encoding: 'utf8' }))
const annotations = result.results.failures.map(message => ({ path: 'qa/workspace-e2e.mjs', start_line: 1, end_line: 1, annotation_level: 'failure', title: 'Work browser finding', message }))
const images = []
for (const file of readdirSync(dir).filter(name => name.startsWith(`${viewport}-`) && name.endsWith('.png') && !name.includes('legacy-'))) {
  const bytes = await sharp(`${dir}/${file}`).resize({ width: 1000, withoutEnlargement: true }).jpeg({ quality: 65 }).toBuffer()
  const encoded = bytes.toString('base64')
  const parts = Math.ceil(encoded.length / 55000)
  images.push({ file, parts, bytes: bytes.length })
  for (let i = 0; i < parts; i++) annotations.push({ path: 'qa/workspace-e2e.mjs', start_line: 1, end_line: 1, annotation_level: 'notice', title: `CI_IMAGE:${file}:${i + 1}/${parts}`, message: 'CI-rendered screenshot preview; original PNG in workflow artifact.', raw_details: encoded.slice(i * 55000, (i + 1) * 55000) })
}
const output = {
  title: `Real Chromium ${viewport}: ${result.results.pass} passed / ${result.results.fail} failed`,
  summary: `${result.version}\n\nTested commit: ${result.commit}\n\n[Full workflow evidence](https://github.com/${repo}/actions/runs/${process.env.GITHUB_RUN_ID})\n\nOriginal PNGs are in the viewport artifact. JPEG annotation previews provide an API-only review fallback.`,
  text: JSON.stringify({ ...result, images }),
}
const run = api(`repos/${repo}/check-runs`, 'POST', { name: `Work visual evidence ${viewport}`, head_sha: process.env.GITHUB_SHA, status: 'completed', conclusion: result.results.fail ? 'failure' : 'success', output: { ...output, annotations: annotations.slice(0, 50) } })
for (let i = 50; i < annotations.length; i += 50) api(`repos/${repo}/check-runs/${run.id}`, 'PATCH', { output: { ...output, annotations: annotations.slice(i, i + 50) } })
console.log(`Published ${result.results.fail} findings and ${images.length} CI screenshot previews in check ${run.id}.`)
