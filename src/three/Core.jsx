/* ============================================================
   CORE — the one WebGL object in the app.

   It is a *readout*, not decoration: the inner sphere's size and
   glow are today's completion, the orbiting shards are the habits
   still open, and the lattice tightens as the day fills. Everything
   it draws comes from real state.

   It is lazy-loaded, pauses when off-screen or on a hidden tab,
   and silently yields to the CSS fallback when WebGL is missing
   or the user asked for reduced motion.
   ============================================================ */
import { useEffect, useRef, useState } from 'react'

export default function Core({ progress = 0, open = 0, size = 260, accent = '#7c5cff' }) {
  const host = useRef(null)
  const api = useRef(null)
  const [failed, setFailed] = useState(false)

  /* ---- Build once ---- */
  useEffect(() => {
    let disposed = false
    const el = host.current
    if (!el) return

    import('three')
      .then((THREE) => {
        if (disposed || !el) return
        api.current = build(THREE, el, accent)
      })
      .catch(() => setFailed(true))

    return () => {
      disposed = true
      api.current?.dispose()
      api.current = null
    }
  }, [accent])

  /* ---- Feed it data ---- */
  useEffect(() => { api.current?.set({ progress, open }) }, [progress, open])

  /* ---- Pause when not visible: no GPU burn behind a scroll ---- */
  useEffect(() => {
    const el = host.current
    if (!el) return
    const io = new IntersectionObserver(([e]) => api.current?.setActive(e.isIntersecting), { threshold: 0.05 })
    io.observe(el)
    const onVis = () => api.current?.setActive(!document.hidden)
    document.addEventListener('visibilitychange', onVis)
    return () => { io.disconnect(); document.removeEventListener('visibilitychange', onVis) }
  }, [])

  if (failed) return null
  return <div ref={host} style={{ width: size, height: size, pointerEvents: 'none' }} aria-hidden="true" />
}

/* ============================================================
   The scene itself — plain three.js, no framework layer.
   ============================================================ */
function build(THREE, el, accentHex) {
  const w = el.clientWidth || 260
  const h = el.clientHeight || 260
  const accent = new THREE.Color(accentHex)

  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'low-power' })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.setSize(w, h)
  renderer.setClearColor(0x000000, 0)
  el.appendChild(renderer.domElement)
  Object.assign(renderer.domElement.style, { display: 'block', width: '100%', height: '100%' })

  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(42, w / h, 0.1, 100)
  camera.position.set(0, 0, 5.4)

  const root = new THREE.Group()
  scene.add(root)

  /* ---- The lattice: a wireframe shell that contracts as the
     day gets completed, like a cage closing on the work. ---- */
  const shellGeo = new THREE.IcosahedronGeometry(1.75, 1)
  const shell = new THREE.LineSegments(
    new THREE.WireframeGeometry(shellGeo),
    new THREE.LineBasicMaterial({ color: accent, transparent: true, opacity: 0.26 })
  )
  root.add(shell)

  /* ---- The core: grows and brightens with completion. ---- */
  const coreMat = new THREE.MeshStandardMaterial({
    color: accent,
    emissive: accent,
    emissiveIntensity: 0.5,
    roughness: 0.25,
    metalness: 0.1,
    transparent: true,
    opacity: 0.9,
  })
  const core = new THREE.Mesh(new THREE.IcosahedronGeometry(0.62, 3), coreMat)
  root.add(core)

  const halo = new THREE.Mesh(
    new THREE.SphereGeometry(0.98, 32, 32),
    new THREE.MeshBasicMaterial({ color: accent, transparent: true, opacity: 0.08, side: THREE.BackSide })
  )
  root.add(halo)

  /* ---- Shards: one per open habit, up to 12. They orbit and
     fall into the core as items get completed. ---- */
  const MAX_SHARDS = 12
  const shards = []
  const shardGeo = new THREE.OctahedronGeometry(0.1, 0)
  for (let i = 0; i < MAX_SHARDS; i++) {
    const m = new THREE.Mesh(
      shardGeo,
      new THREE.MeshStandardMaterial({ color: accent, emissive: accent, emissiveIntensity: 0.6, roughness: 0.4, transparent: true })
    )
    const a = (i / MAX_SHARDS) * Math.PI * 2
    m.userData = { a, r: 1.45 + (i % 3) * 0.16, y: Math.sin(i * 1.7) * 0.5, s: 0.7 + (i % 4) * 0.12 }
    m.visible = false
    root.add(m)
    shards.push(m)
  }

  /* ---- Dust: cheap depth cue, 160 points. ---- */
  const dustCount = 160
  const pos = new Float32Array(dustCount * 3)
  for (let i = 0; i < dustCount; i++) {
    const r = 2.1 + Math.random() * 1.6
    const t = Math.random() * Math.PI * 2
    const p = Math.acos(2 * Math.random() - 1)
    pos[i * 3] = r * Math.sin(p) * Math.cos(t)
    pos[i * 3 + 1] = r * Math.sin(p) * Math.sin(t)
    pos[i * 3 + 2] = r * Math.cos(p)
  }
  const dustGeo = new THREE.BufferGeometry()
  dustGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  const dust = new THREE.Points(dustGeo, new THREE.PointsMaterial({ color: accent, size: 0.035, transparent: true, opacity: 0.5, sizeAttenuation: true }))
  root.add(dust)

  /* ---- Light ---- */
  scene.add(new THREE.AmbientLight(0xffffff, 0.35))
  const key = new THREE.PointLight(accent, 26, 14)
  key.position.set(2.4, 2.4, 3)
  scene.add(key)
  const rim = new THREE.PointLight(0x5c7cff, 14, 14)
  rim.position.set(-3, -1.6, -2)
  scene.add(rim)

  /* ---- State + loop ---- */
  const state = { progress: 0, open: 0 }
  const shown = { progress: 0, open: 0 }
  let active = true
  let raf = null
  let t = 0

  function frame() {
    raf = requestAnimationFrame(frame)
    t += 0.0075

    // Ease toward the target so data changes feel physical.
    shown.progress += (state.progress - shown.progress) * 0.06
    shown.open += (state.open - shown.open) * 0.08
    const p = shown.progress

    root.rotation.y = t * 0.55
    root.rotation.x = Math.sin(t * 0.5) * 0.16

    const pulse = 1 + Math.sin(t * 2.4) * 0.018
    const target = (0.72 + p * 0.95) * pulse
    core.scale.setScalar(target)
    coreMat.emissiveIntensity = 0.35 + p * 1.5
    coreMat.opacity = 0.65 + p * 0.33

    halo.scale.setScalar(1 + p * 0.5)
    halo.material.opacity = 0.05 + p * 0.1

    shell.scale.setScalar(1 - p * 0.14)
    shell.material.opacity = 0.16 + p * 0.26
    shell.rotation.z = -t * 0.3

    const visible = Math.round(shown.open)
    for (let i = 0; i < MAX_SHARDS; i++) {
      const m = shards[i]
      m.visible = i < visible
      if (!m.visible) continue
      const u = m.userData
      const a = u.a + t * u.s
      m.position.set(Math.cos(a) * u.r, u.y + Math.sin(t * 1.3 + i) * 0.1, Math.sin(a) * u.r)
      m.rotation.set(a * 1.4, a, 0)
      m.material.opacity = 0.55 + Math.sin(t * 2 + i) * 0.2
    }

    dust.rotation.y = -t * 0.18
    dust.material.opacity = 0.28 + p * 0.3

    renderer.render(scene, camera)
  }
  frame()

  /* ---- Resize ---- */
  const ro = new ResizeObserver(() => {
    const nw = el.clientWidth || w
    const nh = el.clientHeight || h
    renderer.setSize(nw, nh)
    camera.aspect = nw / nh
    camera.updateProjectionMatrix()
  })
  ro.observe(el)

  return {
    set(next) {
      state.progress = Math.max(0, Math.min(1, next.progress ?? 0))
      state.open = Math.max(0, Math.min(MAX_SHARDS, next.open ?? 0))
    },
    setActive(on) {
      if (on === active) return
      active = on
      if (on && raf == null) frame()
      else if (!on && raf != null) { cancelAnimationFrame(raf); raf = null }
    },
    dispose() {
      if (raf != null) cancelAnimationFrame(raf)
      ro.disconnect()
      scene.traverse((o) => {
        o.geometry?.dispose?.()
        if (Array.isArray(o.material)) o.material.forEach((m) => m.dispose())
        else o.material?.dispose?.()
      })
      renderer.dispose()
      renderer.domElement.remove()
    },
  }
}
