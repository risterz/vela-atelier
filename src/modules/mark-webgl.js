// WebGL1 SDF 12-Dot Blooming Aperture Mark (matches OTTO's exact organic metaball shader architecture)
// Renders a crisp #f2f2f2 square with 12 soft-boolean #1e1b1a circles rotating & blooming outward from a bud.

const VERT = `
attribute vec2 a;
void main() {
  gl_Position = vec4(a, 0.0, 1.0);
}
`

const FRAG = `
precision highp float;
uniform vec3 uDrop[12];
uniform float uSigma;
uniform float uPlate;
uniform float uPx;
uniform float uSize;

const vec3 PAPER = vec3(0.9529, 0.9373, 0.9020);
const vec3 INK   = vec3(0.0588, 0.1098, 0.0902);

void main() {
  vec2 p = vec2(gl_FragCoord.x, uSize - gl_FragCoord.y) * uPx;
  float s = max(uSigma, uPx * 0.4);
  float clear = 1.0;

  for (int i = 0; i < 12; i++) {
    float r = uDrop[i].z;
    float d = length(p - uDrop[i].xy) - r + (s * s) / (2.0 * max(r, 0.05));
    float a = (1.0 - exp(-(r * r) / (2.0 * s * s))) / (1.0 + exp(min(d / (s * 0.56), 30.0)));
    clear *= (1.0 - a);
  }

  float w = max(0.0625, uPx / (s * 2.5066));
  float ink = clamp(0.5 + ((1.0 - clear) - 0.4667 - 0.0333 * w) / w, 0.0, 1.0);

  vec2 q = abs(p - 9.0) - uPlate;
  float plateAlpha = clamp(0.5 - max(q.x, q.y) / uPx, 0.0, 1.0);
  float alpha = max(plateAlpha, ink);

  vec3 col = mix(PAPER, INK, ink);
  gl_FragColor = vec4(col * alpha, alpha);
}
`

const LARGE = { ring: 5.375, r: 2.486 }
const SMALL = { ring: 6.865, r: 0.995 }
const BUD = 4.4
const TWIST = 1.5

function clamp01(t) {
  return Math.min(1, Math.max(0, t))
}
function mix(a, b, t) {
  return a + (b - a) * t
}
function smoothstep(a, b, t) {
  const x = clamp01((t - a) / (b - a))
  return x * x * (3 - 2 * x)
}
function cubicAt(t, a, b) {
  return 3 * (1 - t) * (1 - t) * t * a + 3 * (1 - t) * t * t * b + t * t * t
}
function bezierEase(x, ax, ay, bx, by) {
  let lo = 0, hi = 1
  for (let i = 0; i < 18; i++) {
    const mid = (lo + hi) * 0.5
    if (cubicAt(mid, ax, bx) < x) lo = mid
    else hi = mid
  }
  return cubicAt((lo + hi) * 0.5, ay, by)
}

function drawFallback2D(canvas, t) {
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  const S = canvas.width
  const scale = S / 18
  const p = clamp01((t - 0.1) / 2.4)
  const bud = smoothstep(0, 0.1, p)
  const plate = 9 * bezierEase(Math.min(1, t / 0.95), 0.43, 0.195, 0.02, 1)

  ctx.clearRect(0, 0, S, S)
  ctx.fillStyle = '#f3efe6'
  ctx.fillRect((9 - plate) * scale, (9 - plate) * scale, plate * 2 * scale, plate * 2 * scale)

  ctx.fillStyle = '#0f1c17'
  for (let i = 0; i < 12; i++) {
    const large = i % 2 === 1
    const e = bezierEase(clamp01((p - 0.02 - (i / 12) * 0.08) / 0.9), 0.2, 0.2, 0.1, 1)
    const angle = -Math.PI / 2 + (i / 12) * Math.PI * 2 + (1 - e) * TWIST
    const ring = (large ? LARGE.ring : SMALL.ring) * e
    const cx = (9 + Math.cos(angle) * ring) * scale
    const cy = (9 + Math.sin(angle) * ring) * scale
    const r = (large ? mix(BUD * bud, LARGE.r, e) : SMALL.r * smoothstep(0.35, 1, e)) * scale
    if (r > 0.2) {
      ctx.beginPath()
      ctx.arc(cx, cy, r, 0, Math.PI * 2)
      ctx.fill()
    }
  }
}

export function createMarkCanvas(canvas, { size = 320 } = {}) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  const px = Math.round(size * dpr)
  canvas.width = px
  canvas.height = px

  const gl = canvas.getContext('webgl', {
    alpha: true,
    premultipliedAlpha: true,
    antialias: false,
    depth: false,
    stencil: false,
  })

  if (!gl) {
    return {
      draw(t) { drawFallback2D(canvas, t) },
      play({ duration = 2.5, onProgress, onDone } = {}) {
        const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
        if (reduced) {
          drawFallback2D(canvas, duration)
          onProgress?.(1)
          onDone?.()
          return () => {}
        }
        let raf = 0, start = 0
        const loop = (now) => {
          if (!start) start = now
          const elapsed = (now - start) / 1000
          const prog = clamp01(elapsed / duration)
          drawFallback2D(canvas, Math.min(elapsed, duration))
          onProgress?.(prog)
          if (elapsed < duration) raf = requestAnimationFrame(loop)
          else onDone?.()
        }
        raf = requestAnimationFrame(loop)
        return () => cancelAnimationFrame(raf)
      },
    }
  }

  function compile(type, src) {
    const s = gl.createShader(type)
    gl.shaderSource(s, src)
    gl.compileShader(s)
    return s
  }

  const prog = gl.createProgram()
  gl.attachShader(prog, compile(gl.VERTEX_SHADER, VERT))
  gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FRAG))
  gl.bindAttribLocation(prog, 0, 'a')
  gl.linkProgram(prog)
  gl.useProgram(prog)

  const buf = gl.createBuffer()
  gl.bindBuffer(gl.ARRAY_BUFFER, buf)
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW)
  gl.enableVertexAttribArray(0)
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0)

  const uDrop = gl.getUniformLocation(prog, 'uDrop')
  const uSigma = gl.getUniformLocation(prog, 'uSigma')
  const uPlate = gl.getUniformLocation(prog, 'uPlate')
  const uPx = gl.getUniformLocation(prog, 'uPx')
  const uSize = gl.getUniformLocation(prog, 'uSize')
  const drops = new Float32Array(36)

  gl.viewport(0, 0, px, px)
  gl.uniform1f(uPx, 18 / px)
  gl.uniform1f(uSize, px)

  function draw(t) {
    const p = clamp01((t - 0.1) / 2.4)
    const bud = smoothstep(0, 0.1, p)
    for (let i = 0; i < 12; i++) {
      const large = i % 2 === 1
      const e = bezierEase(clamp01((p - 0.02 - (i / 12) * 0.08) / 0.9), 0.2, 0.2, 0.1, 1)
      const angle = -Math.PI / 2 + (i / 12) * Math.PI * 2 + (1 - e) * TWIST
      const ring = (large ? LARGE.ring : SMALL.ring) * e
      drops[i * 3]     = 9 + Math.cos(angle) * ring
      drops[i * 3 + 1] = 9 + Math.sin(angle) * ring
      drops[i * 3 + 2] = large ? mix(BUD * bud, LARGE.r, e) : SMALL.r * smoothstep(0.35, 1, e)
    }
    gl.uniform3fv(uDrop, drops)
    gl.uniform1f(uSigma, 0.34 * (1 - smoothstep(0.72, 0.98, p)))
    gl.uniform1f(uPlate, 9 * bezierEase(Math.min(1, t / 0.95), 0.43, 0.195, 0.02, 1))
    gl.clearColor(0, 0, 0, 0)
    gl.clear(gl.COLOR_BUFFER_BIT)
    gl.drawArrays(gl.TRIANGLES, 0, 3)
  }

  return {
    draw,
    play({ duration = 2.5, onProgress, onDone } = {}) {
      const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      if (reduced) {
        draw(duration)
        onProgress?.(1)
        onDone?.()
        return () => {}
      }
      let raf = 0
      let start = 0
      const loop = (now) => {
        if (!start) start = now
        const elapsed = (now - start) / 1000
        const prog = clamp01(elapsed / duration)
        draw(Math.min(elapsed, duration))
        onProgress?.(prog)
        if (elapsed < duration) {
          raf = requestAnimationFrame(loop)
        } else {
          draw(duration)
          onDone?.()
        }
      }
      raf = requestAnimationFrame(loop)
      return () => cancelAnimationFrame(raf)
    },
  }
}

// Crisp static SVG version of the 12-dot blooming square mark (for header 18x18 & About modal)
export function getMarkSvgMarkup() {
  const dots = []
  for (let i = 0; i < 12; i++) {
    const large = i % 2 === 1
    const angle = -Math.PI / 2 + (i / 12) * Math.PI * 2
    const ring = large ? LARGE.ring : SMALL.ring
    const r = large ? LARGE.r : SMALL.r
    const cx = (9 + Math.cos(angle) * ring).toFixed(2)
    const cy = (9 + Math.sin(angle) * ring).toFixed(2)
    dots.push(`<circle cx="${cx}" cy="${cy}" r="${r.toFixed(2)}" fill="currentColor" />`)
  }
  return `<svg viewBox="0 0 18 18" aria-hidden="true">
    <rect width="18" height="18" fill="var(--mark-bg, #f3efe6)" />
    <g style="color: var(--mark-ink, #0f1c17)">${dots.join('')}</g>
  </svg>`
}
