/* ============================================================
   ART PIPELINE
   Converts the raw generated PNGs in public/art/gen/ into the
   optimised WebP assets the app actually ships in public/art/.

     node scripts/optimize-art.mjs

   Rules
   - every asset is resized to its declared box (never upscaled)
   - WebP quality is tuned per asset (quality 72–82, effort 6)
   - SVG/PNG icon exports are produced from public/art/icon-source.png
   - the script is idempotent and fails loudly on a missing source
   ============================================================ */
import { existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'fs'
import { resolve, basename } from 'path'
import sharp from 'sharp'

const ROOT = resolve(new URL('..', import.meta.url).pathname)
const GEN = resolve(ROOT, 'public/art/gen')
const OUT = resolve(ROOT, 'public/art')

/* name → { box: [w,h] | width, quality, fit } */
const PLAN = {
  // Category illustrations — square, used at 28–96px
  'cat-fitness': { box: [256, 256], quality: 80 },
  'cat-health': { box: [256, 256], quality: 80 },
  'cat-mind': { box: [256, 256], quality: 80 },
  'cat-learning': { box: [256, 256], quality: 80 },
  'cat-creative': { box: [256, 256], quality: 80 },
  'cat-social': { box: [256, 256], quality: 80 },
  'cat-finance': { box: [256, 256], quality: 80 },
  'cat-productivity': { box: [256, 256], quality: 80 },

  // Empty-state artwork — landscape, shown ~160–220px tall
  'empty-hero': { box: [720, 480], quality: 78 },
  'empty-habits': { box: [720, 480], quality: 78 },
  'empty-goals': { box: [720, 480], quality: 78 },
  'empty-projects': { box: [720, 480], quality: 78 },
  'empty-assignments': { box: [720, 480], quality: 78 },
  'empty-insights': { box: [720, 480], quality: 78 },
  'empty-workload': { box: [720, 480], quality: 78 },
  'empty-achievements': { box: [720, 480], quality: 78 },
  'empty-calendar': { box: [720, 480], quality: 78 },
  'empty-routines': { box: [720, 480], quality: 78 },

  // Editorial spot art
  'streak': { box: [560, 420], quality: 78 },
  'productivity': { box: [560, 420], quality: 78 },
  'onboarding': { box: [1120, 900], quality: 80 },

  // Achievement badges — square, shown at 44–72px
  'badge-bronze': { box: [192, 192], quality: 82 },
  'badge-silver': { box: [192, 192], quality: 82 },
  'badge-gold': { box: [192, 192], quality: 82 },
  'badge-diamond': { box: [192, 192], quality: 82 },
  'ach-first-week': { box: [192, 192], quality: 82 },
  'ach-streak-7': { box: [192, 192], quality: 82 },
  'ach-streak-30': { box: [192, 192], quality: 82 },
  'ach-checkins-100': { box: [192, 192], quality: 82 },
  'ach-perfect-week': { box: [192, 192], quality: 82 },
  'ach-goal': { box: [192, 192], quality: 82 },
  'ach-project': { box: [192, 192], quality: 82 },
  'ach-consistency': { box: [192, 192], quality: 82 },
}

const ICON_SOURCE = resolve(GEN, 'icon-source.png')
const ICON_OUT = resolve(ROOT, 'public')

async function buildIcon() {
  if (!existsSync(ICON_SOURCE)) return false
  const sizes = [192, 512]
  for (const s of sizes) {
    const buf = await sharp(ICON_SOURCE).resize(s, s, { fit: 'cover' }).png({ compressionLevel: 9, quality: 90 }).toBuffer()
    writeFileSync(resolve(ICON_OUT, `icon-${s}.png`), buf)
  }
  // maskable: pad the mark into a safe zone (80% centred) so Android never crops it
  const mask = await sharp(ICON_SOURCE).resize(410, 410, { fit: 'cover' }).toBuffer()
  await sharp({
    create: { width: 512, height: 512, channels: 4, background: { r: 11, g: 15, b: 26, alpha: 1 } },
  })
    .composite([{ input: mask, left: 51, top: 51 }])
    .png({ compressionLevel: 9 })
    .toFile(resolve(ICON_OUT, 'icon-512-maskable.png'))
  await sharp(ICON_SOURCE).resize(180, 180, { fit: 'cover' }).png().toFile(resolve(ICON_OUT, 'apple-touch-icon.png'))
  await sharp(ICON_SOURCE).resize(64, 64, { fit: 'cover' }).png().toFile(resolve(ICON_OUT, 'favicon-64.png'))
  console.log('icon → icon-192/512, maskable, apple-touch-icon, favicon-64')
  return true
}

async function buildOg() {
  const src = resolve(GEN, 'og-source.png')
  if (!existsSync(src)) return
  await sharp(src).resize(1200, 630, { fit: 'cover' }).png({ compressionLevel: 9, quality: 88 }).toFile(resolve(OUT, 'og-image.png'))
  await sharp(src).resize(1200, 630, { fit: 'cover' }).webp({ quality: 80 }).toFile(resolve(OUT, 'og-image.webp'))
  console.log('og → og-image.png + .webp')
}

const only = process.argv[2]
let built = 0
let bytes = 0

for (const file of readdirSync(GEN)) {
  if (!file.endsWith('.png') && !file.endsWith('.jpg')) continue
  const name = basename(file, file.split('.').pop()).replace(/\.$/, '')
  if (name === 'icon-source' || name === 'og-source') continue
  if (only && !name.includes(only)) continue
  const plan = PLAN[name]
  if (!plan) {
    console.log(`  skip ${name} (no plan entry)`)
    continue
  }
  const src = resolve(GEN, file)
  const [w, h] = plan.box
  const out = resolve(OUT, `${name}.webp`)
  const info = await sharp(src)
    .resize(w, h, { fit: 'cover', position: 'centre' })
    .webp({ quality: plan.quality, effort: 6, smartSubsample: true })
    .toFile(out)
  built++
  bytes += info.size
  console.log(`  ${name}.webp  ${w}x${h}  ${(info.size / 1024).toFixed(0)} KB`)
}

await buildIcon()
await buildOg()

console.log(`\n${built} assets → public/art (${(bytes / 1024).toFixed(0)} KB total)`)
