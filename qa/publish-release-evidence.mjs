/* Publish a small, credential-free proof record through the Checks API as
 * well as the normal artifact. Some review sandboxes can reach api.github.com
 * but not Pages or the Azure host that serves Actions artifacts. These image
 * chunks let a reviewer inspect actual PUBLIC-browser screenshots without
 * committing generated files or granting any additional permissions.
 */
import { existsSync, readFileSync, appendFileSync } from 'node:fs'
import sharp from 'sharp'

const dir = 'qa/shots/release'
const path = `${dir}/report.json`
if (!existsSync(path)) {
  console.error('::error::No public release report was produced.')
  process.exit(1)
}
const report = JSON.parse(readFileSync(path, 'utf8'))
const passed = report.checks.filter((c) => c.passed).length
const summary = `${report.status}: ${passed}/${report.checks.length} checks; ${Object.keys(report.assets).length} matching assets; commit ${report.commit}; built ${report.builtAt}; ${report.url}`
console.log(`::${report.status === 'passed' ? 'notice' : 'error'} title=Public release proof::${summary}`)
for (const failed of report.checks.filter((c) => !c.passed)) {
  const detail = `${failed.name}: ${failed.detail || report.error || 'failed'}`.replaceAll('%', '%25').replaceAll('\n', '%0A').replaceAll('\r', '%0D')
  console.log(`::error title=Public release failure::${detail}`)
}
for (const row of report.logoutTraffic || []) console.log(`::notice title=Logout transport::${JSON.stringify(row)}`)
// Keep each annotation below the Checks API's 4096-character truncation.
const json = Buffer.from(JSON.stringify(report)).toString('base64')
const reportParts = Math.ceil(json.length / 3000)
for (let part = 0; part < reportParts; part++) {
  console.log(`::notice title=release-report ${part + 1}/${reportParts}::${json.slice(part * 3000, (part + 1) * 3000)}`)
}

if (process.env.GITHUB_STEP_SUMMARY) {
  appendFileSync(process.env.GITHUB_STEP_SUMMARY, `## Public V2 release proof\n\n${summary}\n\nScreenshots and full checksums: **public-release-proof** artifact.\n`)
}

// Viewport screenshots only, never auth/session dumps. Login screenshots were
// taken before typing; Settings hides the test account email before capture.
const names = [
  'mobile-login', 'mobile-today', 'mobile-achievements', 'mobile-habit-detail',
  'desktop-login', 'desktop-today', 'desktop-calendar', 'desktop-settings',
]
for (const name of names) {
  if (!existsSync(`${dir}/${name}.png`)) continue
  const image = await sharp(`${dir}/${name}.png`)
    .resize({ width: name.startsWith('mobile') ? 390 : 1440, withoutEnlargement: true })
    .webp({ quality: 70 }).toBuffer()
  const data = image.toString('base64')
  const count = Math.ceil(data.length / 3000)
  for (let part = 0; part < count; part++) {
    console.log(`::notice title=release-image ${name} ${part + 1}/${count}::${data.slice(part * 3000, (part + 1) * 3000)}`)
  }
}
if (report.status !== 'passed') process.exitCode = 1
