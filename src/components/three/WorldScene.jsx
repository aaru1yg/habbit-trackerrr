/* ============================================================
   WORLD SCENE — the ambient environment behind the product (L3).

   One coherent space (spec §5): deep ink, subtle drifting dust,
   distant translucent planes, two soft volumetric-looking glows.
   It never carries information — losing it must cost the user
   nothing but atmosphere, and the CSS backdrop already covers
   that on every device.

   Cost controls:
   - reached only through WorldLayer's lazy import + capability gate
   - ~10k triangles max, no textures beyond 2 canvas sprites
   - pixel ratio capped at 1.25; antialias off
   - pauses offscreen and when the tab is hidden (scenePresence)
   - full disposal on unmount; any GL failure renders nothing
   ============================================================ */
import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { getCapability, particleBudget } from '../../lib/capability.js'
import { scenePresence } from '../../lib/spatial.js'

const readColor = (cssVar, fallback) => {
  try {
    const v = getComputedStyle(document.documentElement).getPropertyValue(cssVar).trim()
    return v || fallback
  } catch {
    return fallback
  }
}

const softDisc = (colorInner) => {
  const c = document.createElement('canvas')
  c.width = 128
  c.height = 128
  const g = c.getContext('2d')
  const grad = g.createRadialGradient(64, 64, 2, 64, 64, 62)
  grad.addColorStop(0, colorInner)
  grad.addColorStop(0.42, 'rgba(120,96,255,0.20)')
  grad.addColorStop(1, 'rgba(0,0,0,0)')
  g.fillStyle = grad
  g.fillRect(0, 0, 128, 128)
  return new THREE.CanvasTexture(c)
}

export default function WorldScene({ className = '', style }) {
  const hostRef = useRef(null)

  useEffect(() => {
    const host = hostRef.current
    if (!host) return undefined

    const cap = getCapability()
    let renderer
    try {
      renderer = new THREE.WebGLRenderer({ alpha: true, antialias: false, powerPreference: 'low-power' })
    } catch {
      return undefined // the CSS backdrop carries the world alone
    }

    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.25))
    renderer.setClearColor(0x000000, 0)
    const canvas = renderer.domElement
    canvas.style.width = '100%'
    canvas.style.height = '100%'
    canvas.style.display = 'block'
    canvas.setAttribute('aria-hidden', 'true')
    host.appendChild(canvas)

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(46, 1, 0.1, 90)
    camera.position.set(0, 0, 10)

    const accent1 = new THREE.Color(readColor('--accent-1', '#7048f5'))
    const accent2 = new THREE.Color(readColor('--accent-2', '#22d3ee'))
    const text = new THREE.Color(readColor('--text', '#f4f6ff'))

    /* -- drifting dust: extremely subtle, one draw call -- */
    const budget = Math.max(0.35, particleBudget())
    const COUNT = Math.floor((cap.tier === 'high' ? 420 : 160) * budget)
    const pos = new Float32Array(COUNT * 3)
    const drift = new Float32Array(COUNT)
    for (let i = 0; i < COUNT; i += 1) {
      pos[i * 3] = (Math.random() - 0.5) * 34
      pos[i * 3 + 1] = (Math.random() - 0.5) * 20
      pos[i * 3 + 2] = -4 - Math.random() * 30
      drift[i] = 0.16 + Math.random() * 0.5
    }
    const dustGeo = new THREE.BufferGeometry()
    dustGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    const dustMat = new THREE.PointsMaterial({
      color: text, size: 0.05, transparent: true, opacity: 0.32,
      blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true,
    })
    const dust = new THREE.Points(dustGeo, dustMat)
    scene.add(dust)

    /* -- distant translucent planes: the "architecture" of the space -- */
    const planes = []
    const planeDefs = [
      { w: 16, h: 9, x: -7.5, y: 2.2, z: -22, ry: 0.5, c: accent1, o: 0.05 },
      { w: 12, h: 16, x: 8.8, y: -1.5, z: -17, ry: -0.62, c: accent2, o: 0.042 },
      { w: 20, h: 7, x: 1.5, y: -4.6, z: -27, ry: 0.16, c: text, o: 0.028 },
      { w: 9, h: 12, x: -11, y: -2.8, z: -12, ry: 0.85, c: accent1, o: 0.035 },
    ]
    const planeGeos = []
    const planeMats = []
    for (const d of planeDefs) {
      const geo = new THREE.PlaneGeometry(d.w, d.h, 1, 1)
      const mat = new THREE.MeshBasicMaterial({
        color: d.c, transparent: true, opacity: d.o, side: THREE.DoubleSide, depthWrite: false,
      })
      const mesh = new THREE.Mesh(geo, mat)
      mesh.position.set(d.x, d.y, d.z)
      mesh.rotation.set(0, d.ry, 0.04)
      scene.add(mesh)
      planes.push({ mesh, base: { ...d } })
      planeGeos.push(geo)
      planeMats.push(mat)
    }

    /* -- two soft glows for volumetric-looking light -- */
    const tex1 = softDisc('rgba(190,170,255,0.55)')
    const tex2 = softDisc('rgba(120,220,255,0.42)')
    const glowMat1 = new THREE.SpriteMaterial({ map: tex1, transparent: true, opacity: 0.32, blending: THREE.AdditiveBlending, depthWrite: false })
    const glowMat2 = new THREE.SpriteMaterial({ map: tex2, transparent: true, opacity: 0.24, blending: THREE.AdditiveBlending, depthWrite: false })
    const glow1 = new THREE.Sprite(glowMat1)
    glow1.scale.setScalar(22)
    glow1.position.set(-7, 4, -18)
    const glow2 = new THREE.Sprite(glowMat2)
    glow2.scale.setScalar(16)
    glow2.position.set(9, -4.5, -14)
    scene.add(glow1, glow2)

    /* -- sizing -- */
    const resize = () => {
      const w = window.innerWidth || 1
      const h = window.innerHeight || 1
      renderer.setSize(w, h, false)
      camera.aspect = w / h
      camera.updateProjectionMatrix()
    }
    resize()
    window.addEventListener('resize', resize)

    /* -- pointer parallax (fine pointers; half the hero's amplitude) -- */
    let tX = 0
    let tY = 0
    const onPointer = (e) => {
      if (cap.touch) return
      tX = (e.clientX / (window.innerWidth || 1) - 0.5)
      tY = (e.clientY / (window.innerHeight || 1) - 0.5)
    }
    window.addEventListener('pointermove', onPointer, { passive: true })

    /* -- lifecycle: pause offscreen / hidden via scenePresence -- */
    const presence = scenePresence(host)
    let live = presence.live()
    const off = presence.subscribe((v) => { live = v })

    const clock = new THREE.Clock()
    let alive = true
    let raf = 0
    let cx = 0
    let cy = 0

    const tick = () => {
      if (!alive) return
      raf = requestAnimationFrame(tick)
      if (!live) return
      const t = clock.getElapsedTime()

      cx += (tX - cx) * 0.02
      cy += (tY - cy) * 0.02
      camera.position.x = cx * 1.1 + Math.sin(t * 0.04) * 0.4
      camera.position.y = -cy * 0.7 + Math.cos(t * 0.03) * 0.22
      camera.lookAt(0, 0, -8)

      dust.rotation.y = t * 0.008
      const arr = dustGeo.attributes.position.array
      for (let i = 0; i < COUNT; i += 1) {
        arr[i * 3 + 1] += drift[i] * 0.0022
        if (arr[i * 3 + 1] > 10) arr[i * 3 + 1] = -10
      }
      dustGeo.attributes.position.needsUpdate = true

      for (let i = 0; i < planes.length; i += 1) {
        const { mesh, base } = planes[i]
        mesh.rotation.y = base.ry + Math.sin(t * 0.05 + i) * 0.03
        mesh.position.y = base.y + Math.cos(t * 0.04 + i * 2) * 0.12
      }

      glowMat1.opacity = 0.28 + Math.sin(t * 0.12) * 0.05
      glowMat2.opacity = 0.2 + Math.sin(t * 0.1 + 2) * 0.045

      renderer.render(scene, camera)
    }
    tick()

    return () => {
      alive = false
      cancelAnimationFrame(raf)
      off()
      presence.dispose()
      window.removeEventListener('resize', resize)
      window.removeEventListener('pointermove', onPointer)
      dustGeo.dispose(); dustMat.dispose()
      for (const g of planeGeos) g.dispose()
      for (const m of planeMats) m.dispose()
      tex1.dispose(); tex2.dispose()
      glowMat1.dispose(); glowMat2.dispose()
      renderer.dispose()
      canvas.remove()
    }
  }, [])

  return (
    <div
      ref={hostRef}
      className={`world-scene ${className}`.trim()}
      style={style}
      aria-hidden="true"
    />
  )
}
