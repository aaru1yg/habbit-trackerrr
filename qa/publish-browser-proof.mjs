/* Evidence-only fallback for environments that can reach GitHub's Checks API
 * but not the Azure artifact redirects (the same pattern qa/publish-work-proof.mjs
 * established for Phase 4). Reads the results.json a matrix browser job wrote and
 * posts one check run per viewport: "<name> <viewport>" titled
 * "Real Chromium <viewport>: N passed / M failed", with the full JSON in the
 * check text, every DOM failure as an annotation, and JPEG previews of the
 * CI-rendered screenshots split across notice annotations. Original PNGs stay in
 * the workflow artifact. Nothing is committed or deployed.
 *
 *   QA_PROOF_DIR=qa/shots/habits QA_PROOF_NAME="Habits visual evidence" \
 *   QA_PROOF_SCRIPT=qa/habits-e2e.mjs QA_PROOF_VIEWPORT=390x844 node qa/publish-browser-proof.mjs
 * QA_PROOF_SHA (optional) attaches the check run to a specific commit — a
 * workflow_run-triggered public verification reports against the deployed sha.
 */
import { readFileSync, readdirSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import sharp from 'sharp'

const dir = process.env.QA_PROOF_DIR
const name = process.env.QA_PROOF_NAME
const script = process.env.QA_PROOF_SCRIPT
const viewport = process.env.QA_PROOF_VIEWPORT
const repo = process.env.GITHUB_REPOSITORY
if (!dir || !name || !script || !viewport || !repo) throw new Error('QA_PROOF_DIR, QA_PROOF_NAME, QA_PROOF_SCRIPT, QA_PROOF_VIEWPORT and GITHUB_REPOSITORY are required')

const result = JSON.parse(readFileSync(`${dir}/results.json`, 'utf8'))
const api = (path, method, body) => JSON.parse(execFileSync('gh', ['api', path, '--method', method, '--input', '-'], { input: JSON.stringify(body), encoding: 'utf8' }))
const annotations = result.results.failures.map(message => ({ path: script, start_line: 1, end_line: 1, annotation_level: 'failure', title: `${name} finding`, message }))
const images = []
for (const file of readdirSync(dir).filter(f => f.startsWith(`${viewport}-`) && f.endsWith('.png'))) {
  const bytes = await sharp(`${dir}/${file}`).resize({ width: 1000, withoutEnlargement: true }).jpeg({ quality: 65 }).toBuffer()
  const encoded = bytes.toString('base64')
  const parts = Math.ceil(encoded.length / 55000)
  images.push({ file, parts, bytes: bytes.length })
  for (let i = 0; i < parts; i++) annotations.push({ path: script, start_line: 1, end_line: 1, annotation_level: 'notice', title: `CI_IMAGE:${file}:${i + 1}/${parts}`, message: 'CI-rendered screenshot preview; original PNG in workflow artifact.', raw_details: encoded.slice(i * 55000, (i + 1) * 55000) })
}
const output = {
  title: `Real Chromium ${viewport}: ${result.results.pass} passed / ${result.results.fail} failed`,
  summary: `${result.version}\n\nTested commit: ${result.commit}${result.target ? `\n\nTarget: ${result.target} (${result.mode}${result.public ? `, serving ${result.public.commit}` : ''})` : ''}\n\n[Full workflow evidence](https://github.com/${repo}/actions/runs/${process.env.GITHUB_RUN_ID})\n\nOriginal PNGs are in the viewport artifact. JPEG annotation previews provide an API-only review fallback.`,
  text: JSON.stringify({ ...result, images }),
}
const run = api(`repos/${repo}/check-runs`, 'POST', { name: `${name} ${viewport}`, head_sha: process.env.QA_PROOF_SHA || process.env.GITHUB_SHA, status: 'completed', conclusion: result.results.fail ? 'failure' : 'success', output: { ...output, annotations: annotations.slice(0, 50) } })
for (let i = 50; i < annotations.length; i += 50) api(`repos/${repo}/check-runs/${run.id}`, 'PATCH', { output: { ...output, annotations: annotations.slice(i, i + 50) } })
console.log(`Published ${result.results.fail} findings and ${images.length} CI screenshot previews in check ${run.id}.`)
