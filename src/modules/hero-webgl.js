// Real-Time GPU Ping-Pong Fluid / Smoke-Water Cursor Reveal Shader (WebGL1)
// Mirrors the swirling, curling smoke/water reveal effect in the reference video:
// - 256x256 ping-pong fluid density + velocity FBO simulation (8-bit encoded velocity for 100% WebGL1 compatibility)
// - Sweeping cursor paints directional swirling fluid plumes that curl via vorticity/curl-noise,
//   drift gently upward, refract & reveal hero-reveal.png (water splash arcs & crystal droplets),
//   cast subtle translucent vapor wisps along the fluid rim, and dissipate back into pure dark studio.

const QUAD_VERT = `
attribute vec2 aPos;
varying vec2 vUv;
void main() {
  vUv = aPos * 0.5 + 0.5;
  gl_Position = vec4(aPos, 0.0, 1.0);
}
`

// Pass 1: Advect velocity field with curl-noise vorticity & inject cursor impulse
const VEL_FRAG = `
precision highp float;
varying vec2 vUv;
uniform sampler2D uVel;
uniform vec2 uTexel;
uniform vec2 uPoint;
uniform vec2 uDelta;
uniform float uRadius;
uniform float uTime;
uniform float uSplat;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}
float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
    mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
    u.y
  );
}
vec2 curl(vec2 p) {
  float e = 0.02;
  float n1 = noise(p + vec2(0.0, e));
  float n2 = noise(p - vec2(0.0, e));
  float n3 = noise(p + vec2(e, 0.0));
  float n4 = noise(p - vec2(e, 0.0));
  return vec2(n1 - n2, -(n3 - n4)) / (2.0 * e);
}

vec2 dec(vec2 c) { return (c - 0.5) * 2.0; }
vec2 enc(vec2 v) { return clamp(v * 0.5 + 0.5, 0.0, 1.0); }

void main() {
  vec2 vel = dec(texture2D(uVel, vUv).xy);
  // Semi-Lagrangian backtrace advection
  vec2 prevUv = clamp(vUv - vel * 0.0085, 0.002, 0.998);
  vec2 adv = dec(texture2D(uVel, prevUv).xy);

  // Subtle organic curl turbulence + gentle upward thermal buoyancy (smoke/water motion)
  vec2 turb = curl(vUv * 5.2 + vec2(uTime * 0.14, -uTime * 0.19)) * 0.045;
  adv = adv * 0.955 + turb * 0.18 + vec2(0.0, 0.0045);

  // Cursor directional velocity injection
  if (uSplat > 0.001) {
    vec2 diff = vUv - uPoint;
    float d2 = dot(diff, diff);
    float w = exp(-d2 / max(uRadius * uRadius, 0.0002)) * uSplat;
    adv += uDelta * w * 1.85;
  }

  adv = clamp(adv, -1.0, 1.0);
  gl_FragColor = vec4(enc(adv), 0.5, 1.0);
}
`

// Pass 2: Advect & diffuse fluid dye/vapor density mask + inject cursor & ambient rising plumes
const DYE_FRAG = `
precision highp float;
varying vec2 vUv;
uniform sampler2D uDye;
uniform sampler2D uVel;
uniform vec2 uTexel;
uniform vec2 uPoint;
uniform float uRadius;
uniform float uSplat;
uniform float uTime;
uniform float uAmbient;

vec2 dec(vec2 c) { return (c - 0.5) * 2.0; }

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}
float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
    mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
    u.y
  );
}

void main() {
  vec2 vel = dec(texture2D(uVel, vUv).xy);
  // Perturb advection slightly with fine turbulence for organic wispy edges
  float n = noise(vUv * 12.0 + vec2(uTime * 0.35, -uTime * 0.45)) - 0.5;
  vec2 flow = vel * 0.011 + vec2(n * 0.0022, 0.0018);
  vec2 prevUv = clamp(vUv - flow, 0.002, 0.998);

  // Soft 5-tap diffusion gives smooth water-ink / vapor expansion
  float c  = texture2D(uDye, prevUv).r;
  float l  = texture2D(uDye, prevUv - vec2(uTexel.x, 0.0)).r;
  float r  = texture2D(uDye, prevUv + vec2(uTexel.x, 0.0)).r;
  float t  = texture2D(uDye, prevUv + vec2(0.0, uTexel.y)).r;
  float b  = texture2D(uDye, prevUv - vec2(0.0, uTexel.y)).r;
  float dye = (c * 0.72 + (l + r + t + b) * 0.07) * 0.976;

  // Cursor fluid splat
  if (uSplat > 0.001) {
    vec2 diff = vUv - uPoint;
    float d2 = dot(diff, diff);
    float splat = exp(-d2 / max(uRadius * uRadius, 0.0002)) * uSplat;
    dye = min(1.0, dye + splat * 0.85);
  }

  // Gentle periodic ambient water-smoke wisps drifting above the bottles even before hovering
  if (uAmbient > 0.01) {
    float t1 = uTime * 0.55;
    vec2 p1 = vec2(0.42 + sin(t1 * 0.8) * 0.16, 0.48 + cos(t1 * 0.65) * 0.10);
    vec2 p2 = vec2(0.56 + cos(t1 * 0.7) * 0.13, 0.56 + sin(t1 * 0.9) * 0.09);
    float w1 = exp(-dot(vUv - p1, vUv - p1) / 0.0042) * (0.5 + 0.5 * sin(t1 * 1.4));
    float w2 = exp(-dot(vUv - p2, vUv - p2) / 0.0036) * (0.5 + 0.5 * cos(t1 * 1.15));
    dye = min(1.0, dye + (w1 + w2) * 0.085 * uAmbient);
  }

  gl_FragColor = vec4(dye, dye, dye, 1.0);
}
`

// Pass 3: Display composite — refracts & reveals hero-reveal.png through the swirling fluid mask
// PLUS adds crisp delicate translucent smoke/water-vapor wisps along the active fluid contours!
const DISPLAY_FRAG = `
precision highp float;
varying vec2 vUv;
uniform sampler2D uReveal;
uniform sampler2D uDye;
uniform vec2 uTexel;
uniform vec2 uResolution;
uniform float uImgAspect;
uniform vec2 uObjPos;
uniform float uTime;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}
float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
    mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
    u.y
  );
}
float fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 4; i++) {
    v += a * noise(p);
    p *= 2.05;
    a *= 0.5;
  }
  return v;
}

void main() {
  // Screen UV (y=0 top for image sampling)
  vec2 screenUv = vec2(vUv.x, 1.0 - vUv.y);

  // Sample swirling fluid mask + gradient for subtle liquid refraction
  float d  = texture2D(uDye, vUv).r;
  float dx = texture2D(uDye, vUv + vec2(uTexel.x * 2.0, 0.0)).r - texture2D(uDye, vUv - vec2(uTexel.x * 2.0, 0.0)).r;
  float dy = texture2D(uDye, vUv + vec2(0.0, uTexel.y * 2.0)).r - texture2D(uDye, vUv - vec2(0.0, uTexel.y * 2.0)).r;
  vec2 refractOff = vec2(dx, -dy) * 0.022;

  // Exact CSS object-fit: cover UV mapping so hero-reveal.png locks pixel-for-pixel onto hero-bare.png
  float canvasAspect = uResolution.x / max(uResolution.y, 1.0);
  vec2 scale = vec2(1.0);
  if (canvasAspect > uImgAspect) scale.y = uImgAspect / canvasAspect;
  else scale.x = canvasAspect / uImgAspect;
  vec2 imgUv = (screenUv + refractOff - uObjPos) * scale + uObjPos;

  vec3 rev = texture2D(uReveal, clamp(imgUv, 0.0, 1.0)).rgb;

  // Wispy curl-textured fluid edge mask (organic billowing smoke/water tendrils)
  float f = fbm(vUv * 5.8 + vec2(uTime * 0.14, -uTime * 0.22));
  float f2 = fbm(vUv * 11.5 - vec2(uTime * 0.18, uTime * 0.15));
  float smokeNoise = mix(f, f2, 0.35);
  float mask = smoothstep(0.08, 0.48, d + (smokeNoise - 0.5) * 0.24 * smoothstep(0.02, 0.30, d));

  // Luminous foreground reveal (glossy cascading donut sprinkles & sugar pearls)
  float revLum = dot(rev, vec3(0.299, 0.587, 0.114));
  float subjectAlpha = smoothstep(0.03, 0.22, revLum) * mask;

  // Soft billowing translucent vapor/smoke tendrils curling strictly inside the active fluid plume
  float vaporBody = smoothstep(0.05, 0.52, d) * smoothstep(0.32, 0.88, smokeNoise) * 0.14;
  float ripple = clamp(length(vec2(dx, dy)) * 1.15, 0.0, 1.0) * smoothstep(0.06, 0.40, d) * smoothstep(0.25, 0.78, f) * 0.11;

  vec3 vaporCol = vec3(0.84, 0.82, 0.75);
  vec3 brassRim = vec3(0.76, 0.62, 0.40);
  vec3 outRgb = rev * subjectAlpha + vaporCol * vaporBody + brassRim * ripple * 0.95;
  float outA = clamp(max(subjectAlpha, vaporBody + ripple), 0.0, 1.0);

  gl_FragColor = vec4(outRgb, outA);
}
`

export function initHeroShader(canvas, heroEl, revealSrc) {
  if (!canvas || !heroEl) return () => {}
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  if (reduced) return () => {}

  const gl = canvas.getContext('webgl', { alpha: true, premultipliedAlpha: true, antialias: true })
  if (!gl) return () => {}

  function compile(type, src) {
    const s = gl.createShader(type)
    gl.shaderSource(s, src)
    gl.compileShader(s)
    return s
  }
  function makeProgram(fragSrc) {
    const p = gl.createProgram()
    gl.attachShader(p, compile(gl.VERTEX_SHADER, QUAD_VERT))
    gl.attachShader(p, compile(gl.FRAGMENT_SHADER, fragSrc))
    gl.bindAttribLocation(p, 0, 'aPos')
    gl.linkProgram(p)
    return p
  }

  const velProg = makeProgram(VEL_FRAG)
  const dyeProg = makeProgram(DYE_FRAG)
  const dispProg = makeProgram(DISPLAY_FRAG)

  const quad = gl.createBuffer()
  gl.bindBuffer(gl.ARRAY_BUFFER, quad)
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW)
  gl.enableVertexAttribArray(0)
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0)

  const SIM = 256
  function createFBO(initRgba) {
    const tex = gl.createTexture()
    gl.bindTexture(gl.TEXTURE_2D, tex)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, SIM, SIM, 0, gl.RGBA, gl.UNSIGNED_BYTE, initRgba)
    const fbo = gl.createFramebuffer()
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo)
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0)
    return { tex, fbo }
  }

  // Zero-velocity initial buffer (128, 128 = 0.0 encoded)
  const zeroVel = new Uint8Array(SIM * SIM * 4)
  for (let i = 0; i < zeroVel.length; i += 4) {
    zeroVel[i] = 128; zeroVel[i + 1] = 128; zeroVel[i + 2] = 128; zeroVel[i + 3] = 255
  }
  const zeroDye = new Uint8Array(SIM * SIM * 4)

  let velA = createFBO(zeroVel), velB = createFBO(zeroVel)
  let dyeA = createFBO(zeroDye), dyeB = createFBO(zeroDye)
  gl.bindFramebuffer(gl.FRAMEBUFFER, null)

  // Reveal texture
  const revTex = gl.createTexture()
  gl.bindTexture(gl.TEXTURE_2D, revTex)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)

  let loaded = false
  let imgAspect = 1600 / 1200
  const img = new Image()
  img.crossOrigin = 'anonymous'
  img.onload = () => {
    imgAspect = (img.naturalWidth || 1600) / (img.naturalHeight || 1200)
    gl.bindTexture(gl.TEXTURE_2D, revTex)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img)
    loaded = true
  }
  img.src = revealSrc

  // Queue pointer splats so fast mouse gestures draw continuous silky trails
  const splats = []
  let lastPx = null, lastPy = null
  let lastInteractAt = 0

  function queuePointer(clientX, clientY) {
    const r = canvas.getBoundingClientRect()
    if (!r.width || !r.height) return
    const x = (clientX - r.left) / r.width
    const y = 1.0 - (clientY - r.top) / r.height // GL bottom-up UV
    lastInteractAt = performance.now()

    if (lastPx === null) {
      splats.push({ x, y, dx: 0, dy: 0.25, strength: 0.9 })
    } else {
      const dx = x - lastPx
      const dy = y - lastPy
      const dist = Math.hypot(dx, dy)
      const steps = Math.min(8, Math.max(1, Math.ceil(dist / 0.018)))
      for (let i = 1; i <= steps; i++) {
        const f = i / steps
        splats.push({
          x: lastPx + dx * f,
          y: lastPy + dy * f,
          dx: Math.max(-1, Math.min(1, dx * 24)),
          dy: Math.max(-1, Math.min(1, dy * 24)),
          strength: Math.min(1.0, 0.45 + dist * 9.0),
        })
      }
    }
    lastPx = x
    lastPy = y
  }

  const onMove = (e) => queuePointer(e.clientX, e.clientY)
  const onLeave = () => { lastPx = null; lastPy = null }
  const onTouch = (e) => {
    const t = e.touches[0]
    if (t) queuePointer(t.clientX, t.clientY)
  }

  heroEl.addEventListener('pointermove', onMove)
  heroEl.addEventListener('pointerleave', onLeave)
  heroEl.addEventListener('touchmove', onTouch, { passive: true })

  function resize() {
    const r = canvas.getBoundingClientRect()
    const dpr = 1
    canvas.width = Math.max(1, Math.round(r.width * dpr))
    canvas.height = Math.max(1, Math.round(r.height * dpr))
  }
  resize()
  window.addEventListener('resize', resize)

  let inView = true
  const io = new IntersectionObserver((entries) => {
    inView = entries[0]?.isIntersecting ?? true
  }, { threshold: 0.01 })
  io.observe(heroEl)

  // Uniform lookups
  const uVel = {
    vel: gl.getUniformLocation(velProg, 'uVel'),
    texel: gl.getUniformLocation(velProg, 'uTexel'),
    point: gl.getUniformLocation(velProg, 'uPoint'),
    delta: gl.getUniformLocation(velProg, 'uDelta'),
    radius: gl.getUniformLocation(velProg, 'uRadius'),
    time: gl.getUniformLocation(velProg, 'uTime'),
    splat: gl.getUniformLocation(velProg, 'uSplat'),
  }
  const uDye = {
    dye: gl.getUniformLocation(dyeProg, 'uDye'),
    vel: gl.getUniformLocation(dyeProg, 'uVel'),
    texel: gl.getUniformLocation(dyeProg, 'uTexel'),
    point: gl.getUniformLocation(dyeProg, 'uPoint'),
    radius: gl.getUniformLocation(dyeProg, 'uRadius'),
    splat: gl.getUniformLocation(dyeProg, 'uSplat'),
    time: gl.getUniformLocation(dyeProg, 'uTime'),
    ambient: gl.getUniformLocation(dyeProg, 'uAmbient'),
  }
  const uDisp = {
    reveal: gl.getUniformLocation(dispProg, 'uReveal'),
    dye: gl.getUniformLocation(dispProg, 'uDye'),
    texel: gl.getUniformLocation(dispProg, 'uTexel'),
    res: gl.getUniformLocation(dispProg, 'uResolution'),
    imgAspect: gl.getUniformLocation(dispProg, 'uImgAspect'),
    objPos: gl.getUniformLocation(dispProg, 'uObjPos'),
    time: gl.getUniformLocation(dispProg, 'uTime'),
  }

  function stepSim(nowSec, s, ambientAmt) {
    gl.viewport(0, 0, SIM, SIM)
    const rad = window.innerWidth <= 768 ? 0.095 : 0.072

    // 1. Velocity pass
    gl.bindFramebuffer(gl.FRAMEBUFFER, velB.fbo)
    gl.useProgram(velProg)
    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, velA.tex)
    gl.uniform1i(uVel.vel, 0)
    gl.uniform2f(uVel.texel, 1 / SIM, 1 / SIM)
    gl.uniform2f(uVel.point, s ? s.x : 0.5, s ? s.y : 0.5)
    gl.uniform2f(uVel.delta, s ? s.dx : 0, s ? s.dy : 0)
    gl.uniform1f(uVel.radius, rad)
    gl.uniform1f(uVel.time, nowSec)
    gl.uniform1f(uVel.splat, s ? s.strength : 0)
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
    ;[velA, velB] = [velB, velA]

    // 2. Dye/Vapor pass
    gl.bindFramebuffer(gl.FRAMEBUFFER, dyeB.fbo)
    gl.useProgram(dyeProg)
    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, dyeA.tex)
    gl.uniform1i(uDye.dye, 0)
    gl.activeTexture(gl.TEXTURE1)
    gl.bindTexture(gl.TEXTURE_2D, velA.tex)
    gl.uniform1i(uDye.vel, 1)
    gl.uniform2f(uDye.texel, 1 / SIM, 1 / SIM)
    gl.uniform2f(uDye.point, s ? s.x : 0.5, s ? s.y : 0.5)
    gl.uniform1f(uDye.radius, rad * 1.05)
    gl.uniform1f(uDye.splat, s ? s.strength : 0)
    gl.uniform1f(uDye.time, nowSec)
    gl.uniform1f(uDye.ambient, ambientAmt)
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
    ;[dyeA, dyeB] = [dyeB, dyeA]
  }

  let raf = 0
  const t0 = performance.now()

  function tick(now) {
    raf = requestAnimationFrame(tick)
    if (!loaded || !inView || document.documentElement.classList.contains('is-locked')) return
    const sec = (now - t0) / 1000
    const idleTime = (now - lastInteractAt) / 1000
    const ambientAmt = lastInteractAt === 0 || idleTime > 1.8 ? 1.0 : 0.25

    if (splats.length > 0) {
      // Apply queued interpolated cursor steps
      const batch = splats.splice(0, 4)
      for (let i = 0; i < batch.length; i++) {
        stepSim(sec, batch[i], i === 0 ? ambientAmt : 0)
      }
    } else {
      stepSim(sec, null, ambientAmt)
    }

    // 3. Display composite to screen
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
    gl.viewport(0, 0, canvas.width, canvas.height)
    gl.clearColor(0, 0, 0, 0)
    gl.clear(gl.COLOR_BUFFER_BIT)

    gl.useProgram(dispProg)
    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, revTex)
    gl.uniform1i(uDisp.reveal, 0)
    gl.activeTexture(gl.TEXTURE1)
    gl.bindTexture(gl.TEXTURE_2D, dyeA.tex)
    gl.uniform1i(uDisp.dye, 1)
    gl.uniform2f(uDisp.texel, 1 / SIM, 1 / SIM)
    gl.uniform2f(uDisp.res, canvas.width, canvas.height)
    gl.uniform1f(uDisp.imgAspect, imgAspect)
    gl.uniform2f(uDisp.objPos, window.innerWidth <= 768 ? 0.46 : 0.5, 1.0)
    gl.uniform1f(uDisp.time, sec)
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
  }
  raf = requestAnimationFrame(tick)

  return () => {
    cancelAnimationFrame(raf)
    window.removeEventListener('resize', resize)
    heroEl.removeEventListener('pointermove', onMove)
    heroEl.removeEventListener('pointerleave', onLeave)
    heroEl.removeEventListener('touchmove', onTouch)
    io.disconnect()
  }
}
