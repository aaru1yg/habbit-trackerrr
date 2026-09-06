/* ============================================================
   PROGRESS CORE SCENE — the WebGL layer of the signature object.

   A quiet energy field that sits *behind* the SVG Progress Core:
   two additive rings, a wireframe core and a particle shell whose
   glow and density follow real progress. It adds depth and life;
   it never carries data the 2D core does not already show.

   Cost controls (spec §22):
   - reached only through a lazy chunk (three never enters the
     initial bundle) and only on capable devices (SceneLayer)
   - pixel ratio capped at 1.5; antialias only on high tier
   - the loop pauses offscreen and when the tab is hidden
   - every geometry/material/texture is disposed on unmount
   - any runtime failure renders nothing: the SVG core stands
   ============================================================ */
import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { getCapability } from '../../lib/capability.js'

const readColor = (cssVar, fallback) => {
  try {
    const v = getComputedStyle(document.documentElement).getPropertyValue(cssVar).trim()
    return v || fallback
  } catch {
    return fallback
  }
}

export default function ProgressCoreScene({ pct = 0, theme = 'midnight', className = '', style }) {
  const hostRef = useRef(null)
  const pctRef = useRef(pct)
  pctRef.current = pct == null ? 0 : Math.max(0, Math.min(100, pct))

  useEffect(() => {
    const host = hostRef.current
    if (!host) return undefined

    const cap = getCapability()
    let renderer
    try {
      renderer = new THREE.WebGLRenderer({
        alpha: true,
        antialias: cap.tier === 'high',
        powerPreference: 'low-power',
      })
    } catch {
      return undefined // no context: the SVG core carries the moment
    }

    const dpr = Math.min(window.devicePixelRatio || 1, cap.tier === 'high' ? 1.5 : 1)
    renderer.setPixelRatio(dpr)
    renderer.setClearColor(0x000000, 0)
    const canvas = renderer.domElement
    canvas.style.width = '100%'
    canvas.style.height = '100%'
    canvas.style.display = 'block'
    canvas.setAttribute('aria-hidden', 'true')
    host.appendChild(canvas)

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 60)
    camera.position.set(0, 0, 8.6)

    const accent1 = new THREE.Color(readColor('--accent-1', '#7048f5'))
    const accent2 = new THREE.Color(readColor('--accent-2', '#22d3ee'))
    const lift = new THREE.Color(readColor('--accent-1-lift', '#b3a0ff'))

    /* -- rings -- */
    const ringGeo = new THREE.TorusGeometry(2.06, 0.026, 8, 110)
    const ringMat = new THREE.MeshBasicMaterial({
      color: accent1, transparent: true, opacity: 0.42,
      blending: THREE.AdditiveBlending, depthWrite: false,
    })
    const ring = new THREE.Mesh(ringGeo, ringMat)
    ring.rotation.set(Math.PI / 2.35, 0.35, 0)
    scene.add(ring)

    const ring2Geo = new THREE.TorusGeometry(2.48, 0.015, 8, 110)
    const ring2Mat = new THREE.MeshBasicMaterial({
      color: accent2, transparent: true, opacity: 0.3,
      blending: THREE.AdditiveBlending, depthWrite: false,
    })
    const ring2 = new THREE.Mesh(ring2Geo, ring2Mat)
    ring2.rotation.set(Math.PI / 1.8, -0.5, 0.4)
    scene.add(ring2)

    /* -- wireframe core: the "object" the progress fills -- */
    const coreGeo = new THREE.IcosahedronGeometry(1.34, 1)
    const coreMat = new THREE.MeshBasicMaterial({
      color: lift, wireframe: true, transparent: true, opacity: 0.24,
      blending: THREE.AdditiveBlending, depthWrite: false,
    })
    const core = new THREE.Mesh(coreGeo, coreMat)
    scene.add(core)

    /* -- particle shell -- */
    const COUNT = cap.tier === 'high' ? 240 : 110
    const positions = new Float32Array(COUNT * 3)
    const speeds = new Float32Array(COUNT)
    for (let i = 0; i < COUNT; i += 1) {
      const rad = 2.9 + Math.random() * 1.2
      const theta = Math.random() * Math.PI * 2
      const phi = Math.acos(2 * Math.random() - 1)
      positions[i * 3] = rad * Math.sin(phi) * Math.cos(theta)
      positions[i * 3 + 1] = rad * Math.sin(phi) * Math.sin(theta) * 0.62
      positions[i * 3 + 2] = rad * Math.cos(phi) * 0.7
      speeds[i] = 0.35 + Math.random() * 0.85
    }
    const partGeo = new THREE.BufferGeometry()
    partGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    const partMat = new THREE.PointsMaterial({
      color: accent2, size: 0.045, transparent: true, opacity: 0.5,
      blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true,
    })
    const points = new THREE.Points(partGeo, partMat)
    scene.add(points)

    /* -- central glow sprite (canvas texture, theme-tinted) -- */
    const glowCanvas = document.createElement('canvas')
    glowCanvas.width = 128
    glowCanvas.height = 128
    const gtx = glowCanvas.getContext('2d')
    const grad = gtx.createRadialGradient(64, 64, 4, 64, 64, 62)
    grad.addColorStop(0, 'rgba(255,255,255,0.85)')
    grad.addColorStop(0.32, 'rgba(160,130,255,0.34)')
    grad.addColorStop(1, 'rgba(0,0,0,0)')
    gtx.fillStyle = grad
    gtx.fillRect(0, 0, 128, 128)
    const glowTex = new THREE.CanvasTexture(glowCanvas)
    const glowMat = new THREE.SpriteMaterial({
      map: glowTex, color: accent1, transparent: true, opacity: 0.4,
      blending: THREE.AdditiveBlending, depthWrite: false,
    })
    const glow = new THREE.Sprite(glowMat)
    glow.scale.setScalar(3.2)
    scene.add(glow)

    /* -- sizing -- */
    const resize = () => {
      const w = host.clientWidth || 1
      const h = host.clientHeight || 1
      renderer.setSize(w, h, false)
      camera.aspect = w / h
      camera.updateProjectionMatrix()
    }
    resize()
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(resize) : null
    ro?.observe(host)

    /* -- pointer parallax (fine pointers only) -- */
    let targetX = 0
    let targetY = 0
    const onPointer = (e) => {
      if (cap.touch) return
      targetX = (e.clientX / (window.innerWidth || 1) - 0.5) * 0.5
      targetY = (e.clientY / (window.innerHeight || 1) - 0.5) * 0.32
    }
    window.addEventListener('pointermove', onPointer, { passive: true })

    /* -- pause offscreen / hidden -- */
    let visible = true
    let io = null
    if (typeof IntersectionObserver !== 'undefined') {
      io = new IntersectionObserver((entries) => {
        visible = entries.some((en) => en.isIntersecting)
      }, { rootMargin: '80px' })
      io.observe(host)
    }
    const onVis = () => { visible = document.visibilityState !== 'hidden' && visible }
    document.addEventListener('visibilitychange', onVis)

    /* -- loop -- */
    const clock = new THREE.Clock()
    let smooth = pctRef.current / 100
    let raf = 0
    let alive = true

    const tick = () => {
      if (!alive) return
      raf = requestAnimationFrame(tick)
      if (!visible) return
      const t = clock.getElapsedTime()
      const target = pctRef.current / 100
      smooth += (target - smooth) * 0.06

      ring.rotation.z = t * 0.12
      ring.rotation.x = Math.PI / 2.35 + Math.sin(t * 0.22) * 0.12
      ring2.rotation.z = -t * 0.08
      ring2.rotation.y = Math.sin(t * 0.18) * 0.24
      core.rotation.y = t * 0.16
      core.rotation.x = Math.sin(t * 0.3) * 0.2
      core.scale.setScalar(0.9 + smooth * 0.3)
      coreMat.opacity = 0.14 + smooth * 0.3
      points.rotation.y = t * 0.05
      partMat.opacity = 0.26 + smooth * 0.42
      glowMat.opacity = 0.22 + smooth * 0.42
      glow.scale.setScalar(3.1 + smooth * 2.4 + Math.sin(t * 0.8) * 0.08)
      ringMat.opacity = 0.3 + smooth * 0.3

      camera.position.x += (targetX - camera.position.x) * 0.045
      camera.position.y += (-targetY - camera.position.y) * 0.045
      camera.lookAt(0, 0, 0)
      renderer.render(scene, camera)
    }
    tick()

    return () => {
      alive = false
      cancelAnimationFrame(raf)
      window.removeEventListener('pointermove', onPointer)
      document.removeEventListener('visibilitychange', onVis)
      ro?.disconnect()
      io?.disconnect()
      ringGeo.dispose(); ringMat.dispose()
      ring2Geo.dispose(); ring2Mat.dispose()
      coreGeo.dispose(); coreMat.dispose()
      partGeo.dispose(); partMat.dispose()
      glowTex.dispose(); glowMat.dispose()
      renderer.dispose()
      canvas.remove()
    }
  }, [theme])

  return (
    <div
      ref={hostRef}
      className={className}
      style={{ position: 'absolute', inset: 0, pointerEvents: 'none', ...style }}
      aria-hidden="true"
    />
  )
}
