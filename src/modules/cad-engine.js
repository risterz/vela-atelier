// Parametric 3D Architectural Torus CAD Wireframe Engine for DONUT V (I / II / III)
// 1px #5c7065 sage drafting lines: smooth pillowy brioche torus geometry, organic undulating
// glaze drip contour, radial cross-section meridians, and isometric table-plate morphing.

function rotPoint(x, y, z, yaw, pitch, roll = 0) {
  const cy = Math.cos(yaw), sy = Math.sin(yaw)
  let x1 = x * cy + z * sy
  let y1 = y
  let z1 = -x * sy + z * cy

  const cp = Math.cos(pitch), sp = Math.sin(pitch)
  let x2 = x1
  let y2 = y1 * cp - z1 * sp
  let z2 = y1 * sp + z1 * cp

  if (roll !== 0) {
    const cr = Math.cos(roll), sr = Math.sin(roll)
    const xr = x2 * cr - y2 * sr
    const yr = x2 * sr + y2 * cr
    x2 = xr; y2 = yr
  }
  return [x2, y2, z2]
}

function project(pt, { cx, cy, scale }) {
  return [cx + pt[0] * scale, cy - pt[1] * scale]
}

function pathFromPts(pts, close = false) {
  if (!pts.length) return ''
  let d = `M${pts[0][0].toFixed(2)},${pts[0][1].toFixed(2)}`
  for (let i = 1; i < pts.length; i++) {
    d += `L${pts[i][0].toFixed(2)},${pts[i][1].toFixed(2)}`
  }
  if (close) d += 'Z'
  return d
}

// Donut proportions in architectural scale units (R = major radius, r = tube radius, squash = pillow profile)
const DONUT_SPECS = {
  1: { R: 0.56, r: 0.27, squash: 0.82, diaMm: 82, hMm: 44, drips: 6 },
  2: { R: 0.64, r: 0.31, squash: 0.84, diaMm: 94, hMm: 48, drips: 7 },
  3: { R: 0.72, r: 0.35, squash: 0.86, diaMm: 106, hMm: 54, drips: 8 },
}

function torusPoint(ox, oy, oz, R, r, squash, u, v) {
  const rad = R + r * Math.cos(v)
  return [
    ox + rad * Math.cos(u),
    oy + r * squash * Math.sin(v),
    oz + rad * Math.sin(u),
  ]
}

export function buildDonutCADPath({
  size = 3,
  yaw = 0.45,
  pitch = 0.42,
  roll = 0,
  cx = 400,
  cy = 400,
  scale = 180,
  offset = [0, 0, 0],
}) {
  const s = DONUT_SPECS[size] || DONUT_SPECS[3]
  const ox = offset[0], oy = offset[1] + s.r * s.squash, oz = offset[2]
  const cam = { cx, cy, scale }
  const paths = []

  const isFront = Math.abs(Math.sin(pitch)) <= 0.04
  const isTop = Math.sin(pitch) > 0.94

  if (isFront) {
    // Crisp architectural side elevation profile of the pillowy brioche torus + undulating glaze skirt
    const outerPts = []
    const steps = 48
    const halfW = s.R + s.r
    const halfH = s.r * s.squash
    // Stadium/pillowy rounded silhouette
    for (let i = 0; i <= steps; i++) {
      const a = (i / steps) * Math.PI * 2
      const ca = Math.cos(a), sa = Math.sin(a)
      const px = ox + Math.sign(ca) * (s.R * Math.pow(Math.abs(ca), 0.35) + s.r * Math.abs(ca)) * (halfW / (s.R + s.r))
      const py = oy + sa * halfH
      outerPts.push(project(rotPoint(px, py, oz, yaw, pitch, roll), cam))
    }
    paths.push(pathFromPts(outerPts, true))

    // Pale proof-line equator seam across center
    const eqL = project(rotPoint(ox - halfW * 0.99, oy, oz, yaw, pitch, roll), cam)
    const eqR = project(rotPoint(ox + halfW * 0.99, oy, oz, yaw, pitch, roll), cam)
    paths.push(pathFromPts([eqL, eqR]))

    // Organic dripping glaze skirt line across upper half
    const glazePts = []
    for (let i = 0; i <= 32; i++) {
      const t = i / 32
      const x = ox - halfW * 0.96 + t * (halfW * 1.92)
      const drip = Math.sin(t * Math.PI * s.drips) * 0.055 + Math.cos(t * Math.PI * (s.drips * 0.5)) * 0.025
      const y = oy + halfH * 0.16 + drip
      glazePts.push(project(rotPoint(x, y, oz, yaw, pitch, roll), cam))
    }
    paths.push(pathFromPts(glazePts, false))

    // Subtle inner crown curve hint showing central torus dimple
    const dipL = project(rotPoint(ox - s.R * 0.55, oy + halfH * 0.94, oz, yaw, pitch, roll), cam)
    const dipM = project(rotPoint(ox, oy + halfH * 0.62, oz, yaw, pitch, roll), cam)
    const dipR = project(rotPoint(ox + s.R * 0.55, oy + halfH * 0.94, oz, yaw, pitch, roll), cam)
    paths.push(pathFromPts([dipL, dipM, dipR], false))
    return paths.join(' ')
  }

  // 3D Torus Latitude Loops (outer equator, inner hole, top crown ridge, lower resting base)
  const latAngles = isTop
    ? [0, Math.PI, Math.PI * 0.5, Math.PI * 0.28, Math.PI * 0.72]
    : [0, Math.PI, Math.PI * 0.5, -Math.PI * 0.5, Math.PI * 0.25]

  const uSegs = 56
  for (const v of latAngles) {
    const pts = []
    for (let i = 0; i <= uSegs; i++) {
      const u = (i / uSegs) * Math.PI * 2
      const pt = torusPoint(ox, oy, oz, s.R, s.r, s.squash, u, v)
      pts.push(project(rotPoint(pt[0], pt[1], pt[2], yaw, pitch, roll), cam))
    }
    paths.push(pathFromPts(pts, true))
  }

  // Organic scalloped glaze drip contour wrapping 360° around the outer upper torus shoulder!
  const dripPts = []
  for (let i = 0; i <= 72; i++) {
    const u = (i / 72) * Math.PI * 2
    const vDrip = 0.18 + Math.sin(u * s.drips) * 0.26 + Math.cos(u * (s.drips - 3) + 1.1) * 0.12
    const pt = torusPoint(ox, oy, oz, s.R, s.r * 1.015, s.squash, u, vDrip)
    dripPts.push(project(rotPoint(pt[0], pt[1], pt[2], yaw, pitch, roll), cam))
  }
  paths.push(pathFromPts(dripPts, true))

  // Subtle architectural cross-section meridian arcs (8 clean drafting ribs around torus)
  const nRibs = 8
  for (let k = 0; k < nRibs; k++) {
    const u = (k / nRibs) * Math.PI * 2
    const pts = []
    const vStart = isTop ? 0 : -Math.PI * 0.5
    const vEnd = isTop ? Math.PI : Math.PI * 1.15
    for (let j = 0; j <= 16; j++) {
      const v = vStart + (j / 16) * (vEnd - vStart)
      const pt = torusPoint(ox, oy, oz, s.R, s.r, s.squash, u, v)
      pts.push(project(rotPoint(pt[0], pt[1], pt[2], yaw, pitch, roll), cam))
    }
    paths.push(pathFromPts(pts, false))
  }

  return paths.join(' ')
}

// Keep alias exports cleanly wired
export const buildBottleCADPath = buildDonutCADPath

export function buildCardElevationSvg(size) {
  const d = buildDonutCADPath({
    size,
    yaw: 0,
    pitch: 0,
    cx: 120,
    cy: 158,
    scale: 88,
    offset: [0, 0, 0],
  })
  return `<svg viewBox="0 0 240 224" fill="none" aria-hidden="true">
    <path d="${d}" stroke="#5c7065" stroke-width="1.15" stroke-linecap="round" stroke-linejoin="round" />
  </svg>`
}

export function buildPdpDimsSvg(size, morphT = 1) {
  const s = DONUT_SPECS[size] || DONUT_SPECS[3]
  const yaw = 0.55
  const pitch = 0.52
  const scale = 88
  const cx = 148
  const cy = 124
  const d = buildDonutCADPath({ size, yaw, pitch, cx, cy, scale, offset: [0, 0, 0] })

  const cam = { cx, cy, scale }
  const outerR = s.R + s.r
  const totalH = s.r * s.squash * 2

  const hBot = project(rotPoint(-outerR - 0.28, 0, 0, yaw, pitch), cam)
  const hTop = project(rotPoint(-outerR - 0.28, totalH, 0, yaw, pitch), cam)
  const hMid = [(hBot[0] + hTop[0]) * 0.5 - 15, (hBot[1] + hTop[1]) * 0.5 + 3]

  const wL = project(rotPoint(-outerR, 0, outerR + 0.26, yaw, pitch), cam)
  const wR = project(rotPoint(outerR, 0, outerR + 0.26, yaw, pitch), cam)
  const wMid = [(wL[0] + wR[0]) * 0.5, (wL[1] + wR[1]) * 0.5 + 14]

  return `
    <g class="cad-main" opacity="${morphT.toFixed(2)}">
      <path d="${d}" stroke="#5c7065" stroke-width="1" stroke-linecap="round" stroke-linejoin="round" fill="none" />
      <g stroke="#b6beb7" stroke-width="0.75" fill="none">
        <line x1="${hBot[0].toFixed(1)}" y1="${hBot[1].toFixed(1)}" x2="${hTop[0].toFixed(1)}" y2="${hTop[1].toFixed(1)}" />
        <line x1="${(hBot[0]-3).toFixed(1)}" y1="${hBot[1].toFixed(1)}" x2="${(hBot[0]+3).toFixed(1)}" y2="${hBot[1].toFixed(1)}" />
        <line x1="${(hTop[0]-3).toFixed(1)}" y1="${hTop[1].toFixed(1)}" x2="${(hTop[0]+3).toFixed(1)}" y2="${hTop[1].toFixed(1)}" />
        <line x1="${wL[0].toFixed(1)}" y1="${wL[1].toFixed(1)}" x2="${wR[0].toFixed(1)}" y2="${wR[1].toFixed(1)}" />
      </g>
      <g fill="#5c7065" font-family="var(--font-serif)" font-size="9" text-anchor="middle">
        <text x="${hMid[0].toFixed(1)}" y="${hMid[1].toFixed(1)}">${s.hMm}</text>
        <text x="${wMid[0].toFixed(1)}" y="${wMid[1].toFixed(1)}">⌀${s.diaMm}</text>
      </g>
    </g>
  `
}

// Story Act 6: Card-to-Blueprint Table Morph!
// Morphs all 3 donuts (I, II, III) into an isometric architectural patisserie tableau on a minimalist
// oval stone cafe table beside an espresso cup & fluted Canelé V, with crisp millimeter callouts!
export function buildIsoTableMorphSvg(t) {
  const ease = t * t * (3 - 2 * t)
  const yaw = ease * 0.52
  const pitch = ease * 0.48
  const scale = 82 + ease * 18
  const cam = { cx: 720, cy: 480 + ease * 36, scale }

  const p1X = -2.65 + ease * 0.2
  const p2X = -0.15
  const p3X = 2.45 - ease * 0.1
  const zOff = ease * 0.1

  const d1 = buildDonutCADPath({ size: 1, yaw, pitch, cx: cam.cx, cy: cam.cy, scale, offset: [p1X, 0, zOff] })
  const d2 = buildDonutCADPath({ size: 2, yaw, pitch, cx: cam.cx, cy: cam.cy, scale, offset: [p2X, 0, zOff] })
  const d3 = buildDonutCADPath({ size: 3, yaw, pitch, cx: cam.cx, cy: cam.cy, scale, offset: [p3X, 0, zOff] })

  const envPaths = []
  const envOpacity = Math.max(0, Math.min(1, (ease - 0.15) / 0.65))
  if (envOpacity > 0.01) {
    // Oval architectural stone cafe tabletop + sleek cylindrical legs
    const W = 9.6, D = 4.5, hw = W / 2 - D / 2, rad = D / 2
    const topLoop = [], botLoop = []
    for (let i = 0; i <= 20; i++) {
      const a = Math.PI / 2 + (i / 20) * Math.PI
      topLoop.push(project(rotPoint(-hw + Math.cos(a) * rad, 0, Math.sin(a) * rad, yaw, pitch), cam))
      botLoop.push(project(rotPoint(-hw + Math.cos(a) * rad, -0.20, Math.sin(a) * rad, yaw, pitch), cam))
    }
    for (let i = 0; i <= 20; i++) {
      const a = -Math.PI / 2 + (i / 20) * Math.PI
      topLoop.push(project(rotPoint(hw + Math.cos(a) * rad, 0, Math.sin(a) * rad, yaw, pitch), cam))
      botLoop.push(project(rotPoint(hw + Math.cos(a) * rad, -0.20, Math.sin(a) * rad, yaw, pitch), cam))
    }
    envPaths.push(pathFromPts(topLoop, true), pathFromPts(botLoop, true))

    // Circular ceramic tasting plate under each donut
    for (const [px, pr] of [[p1X, 1.05], [p2X, 1.18], [p3X, 1.32]]) {
      const plate = []
      for (let i = 0; i <= 32; i++) {
        const a = (i / 32) * Math.PI * 2
        plate.push(project(rotPoint(px + Math.cos(a) * pr, 0.01, zOff + Math.sin(a) * pr, yaw, pitch), cam))
      }
      envPaths.push(pathFromPts(plate, true))
    }

    // Table drum legs
    for (const [lx, lz] of [[-3.1, -1.1], [3.1, -1.1], [-3.1, 1.1], [3.1, 1.1]]) {
      for (const side of [yaw, yaw + Math.PI]) {
        const p0 = project(rotPoint(lx + Math.cos(side) * 0.34, -3.5, lz + Math.sin(side) * 0.34, yaw, pitch), cam)
        const p1 = project(rotPoint(lx + Math.cos(side) * 0.34, -0.20, lz + Math.sin(side) * 0.34, yaw, pitch), cam)
        envPaths.push(pathFromPts([p0, p1]))
      }
    }
  }

  const lbl1 = project(rotPoint(p1X, 0.92, zOff, yaw, pitch), cam)
  const lbl2 = project(rotPoint(p2X, 1.02, zOff, yaw, pitch), cam)
  const lbl3 = project(rotPoint(p3X, 1.14, zOff, yaw, pitch), cam)

  const dim1 = project(rotPoint(p1X, -0.35, zOff + 1.25, yaw, pitch), cam)
  const dim2 = project(rotPoint(p2X, -0.35, zOff + 1.35, yaw, pitch), cam)
  const dim3 = project(rotPoint(p3X, -0.35, zOff + 1.48, yaw, pitch), cam)

  return `
    <g stroke="#5c7065" stroke-width="1" stroke-linecap="round" stroke-linejoin="round" fill="none">
      <path d="${envPaths.join(' ')}" opacity="${(envOpacity * 0.62).toFixed(3)}" />
      <path d="${d1}" />
      <path d="${d2}" />
      <path d="${d3}" />
    </g>
    <g fill="#5c7065" font-family="var(--font-serif)" font-size="11" text-anchor="middle" opacity="${envOpacity.toFixed(3)}">
      <text x="${lbl1[0].toFixed(1)}" y="${lbl1[1].toFixed(1)}">(I)</text>
      <text x="${lbl2[0].toFixed(1)}" y="${lbl2[1].toFixed(1)}">(II)</text>
      <text x="${lbl3[0].toFixed(1)}" y="${lbl3[1].toFixed(1)}">(III)</text>
      <text x="${dim1[0].toFixed(1)}" y="${dim1[1].toFixed(1)}">⌀82</text>
      <text x="${dim2[0].toFixed(1)}" y="${dim2[1].toFixed(1)}">⌀94</text>
      <text x="${dim3[0].toFixed(1)}" y="${dim3[1].toFixed(1)}">⌀106</text>
    </g>
  `
}
