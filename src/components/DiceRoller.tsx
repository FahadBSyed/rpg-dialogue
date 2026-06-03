import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { useGameStore } from '../store/gameStore'
import type { DiceSize } from '../store/gameStore'

// Colour a die's value label by what it means mechanically.
function valueColor(v: number): string {
  if (v === 1) return '#c25450'        // fail
  if (v % 2 !== 0) return '#d6a93f'    // odd → stress
  return '#6ab06a'                     // clean
}

const DIE_RADIUS = 0.78

function makeGeometry(size: DiceSize): THREE.BufferGeometry {
  switch (size) {
    case 'd4':  return new THREE.TetrahedronGeometry(DIE_RADIUS * 1.15)
    case 'd6':  return new THREE.BoxGeometry(DIE_RADIUS * 1.25, DIE_RADIUS * 1.25, DIE_RADIUS * 1.25)
    case 'd8':  return new THREE.OctahedronGeometry(DIE_RADIUS * 1.1)
    case 'd12': return new THREE.DodecahedronGeometry(DIE_RADIUS)
    case 'd10': return makeD10(DIE_RADIUS)
  }
}

// Pentagonal trapezohedron (a real d10 shape) — three.js has no primitive.
function makeD10(r: number): THREE.BufferGeometry {
  const a = (Math.PI * 2) / 10
  const h = 0.105
  const v: number[][] = []
  for (let i = 0; i < 10; i++) {
    v.push([Math.cos(a * i), Math.sin(a * i), h * (i % 2 ? 1 : -1)])
  }
  v.push([0, 0, 1]) // 10: top apex
  v.push([0, 0, -1]) // 11: bottom apex
  const faces = [
    [0, 2, 10], [2, 4, 10], [4, 6, 10], [6, 8, 10], [8, 0, 10],
    [1, 3, 11], [3, 5, 11], [5, 7, 11], [7, 9, 11], [9, 1, 11],
    [0, 1, 2], [1, 2, 3], [2, 3, 4], [3, 4, 5], [4, 5, 6],
    [5, 6, 7], [6, 7, 8], [7, 8, 9], [8, 9, 0], [9, 0, 1],
  ]
  const pos: number[] = []
  for (const f of faces) {
    for (const idx of f) {
      pos.push(v[idx][0] * r, v[idx][1] * r, v[idx][2] * r)
    }
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.computeVertexNormals()
  g.rotateX(Math.PI / 2)
  return g
}

function makeNumberSprite(value: number): THREE.Sprite {
  const c = document.createElement('canvas')
  c.width = c.height = 128
  const ctx = c.getContext('2d')!
  ctx.clearRect(0, 0, 128, 128)
  ctx.font = 'bold 86px Georgia, serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.lineWidth = 6
  ctx.strokeStyle = 'rgba(0,0,0,0.85)'
  ctx.strokeText(String(value), 64, 70)
  ctx.fillStyle = valueColor(value)
  ctx.fillText(String(value), 64, 70)
  const tex = new THREE.CanvasTexture(c)
  tex.anisotropy = 4
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, opacity: 0, depthTest: false })
  return new THREE.Sprite(mat)
}

interface Die {
  mesh: THREE.Mesh
  edges: THREE.LineSegments
  label: THREE.Sprite
  vel: THREE.Vector3
  angVel: THREE.Vector3
}

export function DiceRoller() {
  const pendingRoll = useGameStore((s) => s.pendingRoll)
  const commitRoll = useGameStore((s) => s.commitRoll)
  const containerRef = useRef<HTMLDivElement>(null)
  const skipRef = useRef(false)

  useEffect(() => {
    if (!pendingRoll || !containerRef.current) return
    const { rolls, diceSize } = pendingRoll
    const container = containerRef.current
    skipRef.current = false
    let committed = false
    const commitOnce = () => {
      if (committed) return
      committed = true
      commitRoll()
    }

    const w = container.clientWidth
    const h = container.clientHeight

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setSize(w, h)
    container.appendChild(renderer.domElement)

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(42, w / h, 0.1, 100)
    camera.position.set(0, 4.2, 6.2)
    camera.lookAt(0, 0.4, 0)

    scene.add(new THREE.AmbientLight(0xbfae8a, 0.55))
    const key = new THREE.DirectionalLight(0xfff0d8, 1.0)
    key.position.set(3, 8, 5)
    scene.add(key)
    const warm = new THREE.PointLight(0xff8040, 0.6, 30)
    warm.position.set(-2, 2, 3)
    scene.add(warm)

    const geo = makeGeometry(diceSize)
    const mat = new THREE.MeshStandardMaterial({
      color: 0x2b2620,
      roughness: 0.72,
      metalness: 0.12,
      flatShading: true,
    })
    const edgeMat = new THREE.LineBasicMaterial({ color: 0x6a5a38, transparent: true, opacity: 0.5 })

    const n = rolls.length
    const restY = DIE_RADIUS * 0.95
    const dice: Die[] = rolls.map((value, i) => {
      const mesh = new THREE.Mesh(geo, mat)
      const spread = (i - (n - 1) / 2) * 1.7
      mesh.position.set(spread + (Math.random() - 0.5) * 0.4, 4.5 + Math.random() * 1.5, (Math.random() - 0.5) * 0.8)
      mesh.quaternion.setFromEuler(new THREE.Euler(Math.random() * 6, Math.random() * 6, Math.random() * 6))
      scene.add(mesh)

      const edges = new THREE.LineSegments(new THREE.EdgesGeometry(geo, 25), edgeMat)
      mesh.add(edges)

      const label = makeNumberSprite(value)
      label.scale.set(1.1, 1.1, 1.1)
      scene.add(label)

      return {
        mesh,
        edges,
        label,
        vel: new THREE.Vector3((Math.random() - 0.5) * 1.5, 0, (Math.random() - 0.5) * 1.5),
        angVel: new THREE.Vector3((Math.random() - 0.5) * 14, (Math.random() - 0.5) * 14, (Math.random() - 0.5) * 14),
      }
    })

    const G = 22
    const SETTLE = 1.3      // seconds of tumble
    const REVEAL = 1.9      // labels fully shown by here
    const DONE = 2.5        // commit
    let last = performance.now()
    let elapsed = 0
    let raf = 0

    const tmpQ = new THREE.Quaternion()
    const tmpE = new THREE.Euler()

    function frame(now: number) {
      const dt = Math.min((now - last) / 1000, 0.05)
      last = now
      elapsed += dt

      if (skipRef.current) {
        commitOnce()
        return
      }

      const settling = elapsed < SETTLE
      dice.forEach((d) => {
        if (settling) {
          d.vel.y -= G * dt
          d.mesh.position.addScaledVector(d.vel, dt)
          if (d.mesh.position.y < restY) {
            d.mesh.position.y = restY
            d.vel.y *= -0.42
            d.vel.x *= 0.7
            d.vel.z *= 0.7
            d.angVel.multiplyScalar(0.55)
          }
          tmpE.set(d.angVel.x * dt, d.angVel.y * dt, d.angVel.z * dt)
          tmpQ.setFromEuler(tmpE)
          d.mesh.quaternion.premultiply(tmpQ)
        } else {
          // ease to rest
          d.mesh.position.y += (restY - d.mesh.position.y) * 0.2
          d.angVel.multiplyScalar(0.8)
        }

        // label floats above the die and fades in during the reveal window
        d.label.position.set(d.mesh.position.x, d.mesh.position.y + DIE_RADIUS + 0.55, d.mesh.position.z)
        const target = elapsed > SETTLE ? Math.min((elapsed - SETTLE) / (REVEAL - SETTLE), 1) : 0
        const m = d.label.material as THREE.SpriteMaterial
        m.opacity += (target - m.opacity) * 0.25
      })

      renderer.render(scene, camera)

      if (elapsed >= DONE) {
        commitOnce()
        return
      }
      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)

    function onResize() {
      const ww = container.clientWidth
      const hh = container.clientHeight
      renderer.setSize(ww, hh)
      camera.aspect = ww / hh
      camera.updateProjectionMatrix()
    }
    window.addEventListener('resize', onResize)

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', onResize)
      dice.forEach((d) => {
        ;(d.label.material as THREE.SpriteMaterial).map?.dispose()
        ;(d.label.material as THREE.SpriteMaterial).dispose()
        d.edges.geometry.dispose()
      })
      geo.dispose()
      mat.dispose()
      edgeMat.dispose()
      renderer.dispose()
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement)
      }
    }
  }, [pendingRoll, commitRoll])

  if (!pendingRoll) return null

  return (
    <div
      style={styles.overlay}
      onClick={() => { skipRef.current = true }}
      title="click to skip"
    >
      <div ref={containerRef} style={styles.canvas} />
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed',
    inset: 0,
    backgroundColor: 'rgba(0,0,0,0.55)',
    zIndex: 40,
    cursor: 'pointer',
  },
  canvas: {
    width: '100%',
    height: '100%',
  },
}
