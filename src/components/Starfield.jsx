import { useEffect, useRef } from 'react'

// Lightweight animated starfield. Twinkling stars + a couple of slow drifting
// "shooting" specks for that futuristic space feel.
export default function Starfield() {
  const ref = useRef(null)

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    // Some environments (e.g. jsdom) have no 2D canvas — bail gracefully.
    if (!ctx) return
    let raf
    let w, h, dpr
    let stars = []

    const resize = () => {
      dpr = Math.min(2, window.devicePixelRatio || 1)
      w = canvas.clientWidth
      h = canvas.clientHeight
      canvas.width = w * dpr
      canvas.height = h * dpr
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      const count = Math.min(160, Math.floor((w * h) / 12000))
      stars = Array.from({ length: count }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        r: 0.4 + Math.random() * 1.4,
        base: 0.25 + Math.random() * 0.6,
        speed: 0.2 + Math.random() * 0.8,
        phase: Math.random() * Math.PI * 2,
        drift: (Math.random() - 0.5) * 0.12,
        hue: Math.random() < 0.25 ? 265 : Math.random() < 0.5 ? 190 : 0,
      }))
    }

    let t = 0
    const draw = () => {
      t += 0.02
      ctx.clearRect(0, 0, w, h)
      for (const s of stars) {
        const twinkle = 0.55 + 0.45 * Math.sin(t * s.speed + s.phase)
        const alpha = Math.max(0, Math.min(1, s.base * twinkle))
        // gentle horizontal drift, wrapped
        s.x += s.drift
        if (s.x < 0) s.x = w
        else if (s.x > w) s.x = 0
        ctx.beginPath()
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2)
        ctx.fillStyle = s.hue
          ? `hsla(${s.hue}, 100%, ${60 + twinkle * 20}%, ${alpha})`
          : `rgba(255,255,255,${alpha})`
        if (s.r > 1.2) {
          ctx.shadowBlur = 8
          ctx.shadowColor = s.hue ? `hsla(${s.hue},100%,70%,0.8)` : 'rgba(180,200,255,0.8)'
        } else {
          ctx.shadowBlur = 0
        }
        ctx.fill()
        ctx.shadowBlur = 0
      }
      raf = requestAnimationFrame(draw)
    }

    resize()
    draw()
    window.addEventListener('resize', resize)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', resize)
    }
  }, [])

  return <canvas ref={ref} className="starfield" style={{ width: '100%', height: '100%' }} />
}
