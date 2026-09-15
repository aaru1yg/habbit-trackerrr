/* Step 4G-3: PageContainer width-family API. */
import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import PageContainer from '../src/components/shell/PageContainer.jsx'
import { readFileSync } from 'node:fs'

const css = () => readFileSync('src/components/shell/shell.css', 'utf8')

describe('Step 4G-3: PageContainer width-family API', () => {
  it('default (no size) renders app-page without a width-family modifier', () => {
    const { container } = render(<PageContainer><div data-testid="c" /></PageContainer>)
    const page = container.querySelector('.app-page')
    expect(page).toBeTruthy()
    // Padded/showcase/etc. modifiers are unrelated; only the four width
    // families should be absent when size is not set.
    for (const f of ['narrow', 'detail', 'workspace', 'wide']) {
      expect(page.classList.contains(`app-page--${f}`), `unexpected .app-page--${f}`).toBe(false)
    }
  })

  it('size="narrow" applies .app-page--narrow', () => {
    const { container } = render(<PageContainer size="narrow"><div /></PageContainer>)
    expect(container.querySelector('.app-page--narrow')).toBeTruthy()
  })

  it('size="detail" applies .app-page--detail', () => {
    const { container } = render(<PageContainer size="detail"><div /></PageContainer>)
    expect(container.querySelector('.app-page--detail')).toBeTruthy()
  })

  it('size="workspace" applies .app-page--workspace', () => {
    const { container } = render(<PageContainer size="workspace"><div /></PageContainer>)
    expect(container.querySelector('.app-page--workspace')).toBeTruthy()
  })

  it('size="wide" applies .app-page--wide', () => {
    const { container } = render(<PageContainer size="wide"><div /></PageContainer>)
    expect(container.querySelector('.app-page--wide')).toBeTruthy()
  })

  it('each size variant sets --app-content-max to the canonical pixel value', () => {
    const c = css()
    expect(c).toMatch(/\.app-page--narrow\s*\{\s*--app-content-max:\s*720px\s*;?\s*\}/)
    expect(c).toMatch(/\.app-page--detail\s*\{\s*--app-content-max:\s*880px\s*;?\s*\}/)
    expect(c).toMatch(/\.app-page--workspace\s*\{\s*--app-content-max:\s*980px\s*;?\s*\}/)
    expect(c).toMatch(/\.app-page--wide\s*\{\s*--app-content-max:\s*1240px\s*;?\s*\}/)
  })

  it('inner .screen resets so the PageContainer owns outer width', () => {
    const c = css()
    // .app-page .screen sets max-width:none, margin:0, padding:0 to neutralize
    // the legacy .screen{max-width:var(--content-max)} rule.
    expect(c).toMatch(/\.app-page\s+\.screen[^}]*max-width:\s*none/)
    expect(c).toMatch(/\.app-page\s+\.screen[^}]*margin-left:\s*0/)
  })

  it('PageContainer no longer bumps --app-content-max to 1280px at wide breakpoints (Step 4G-3 removed blanket bump)', () => {
    const c = css()
    // The removed rule was: @media (min-width: 1280px) { :root { --app-content-max: 1280px } }
    expect(c).not.toMatch(/--app-content-max:\s*1280px/)
  })
})
