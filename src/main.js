import Lenis from 'lenis'
import './styles/main.css'
import { VARIANTS, PDP_GALLERY, SPIRAL_PHOTOS } from './data/catalog.js'
import { createMarkCanvas, getMarkSvgMarkup } from './modules/mark-webgl.js'
import { initHeroShader } from './modules/hero-webgl.js'
import {
  buildDonutCADPath,
  buildCardElevationSvg,
  buildPdpDimsSvg,
  buildIsoTableMorphSvg,
} from './modules/cad-engine.js'

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

// ============================================================================
// Global State
// ============================================================================
const STORAGE_KEY = 'vela_donut_cart_v1'
let cart = loadCart()
let currentRoute = 'home' // 'home' | 'pdp' | 'checkout' | 'about'
let currentPdpSize = 'III'
let storeOpen = false
let cartOpen = false
let mobileMenuOpen = false
let selectedCardSize = 'III'
const glazedDonuts = new Set()

function loadCart() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    const parsed = JSON.parse(raw || '[]')
    if (Array.isArray(parsed)) return parsed.filter((i) => VARIANTS[i.size] && i.qty > 0)
  } catch {}
  return []
}
function saveCart() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cart))
  } catch {}
}

// ============================================================================
// DOM References
// ============================================================================
const $ = (s, root = document) => root.querySelector(s)
const $$ = (s, root = document) => Array.from(root.querySelectorAll(s))

const headerEl = $('#site-header')
const headerTitleEl = $('#header-title')
const preloaderEl = $('#preloader')
const preloaderMarkEl = $('#preloader-mark')
const preloaderCountEl = $('#preloader-count')
const soonEl = $('#soon-pill')

const heroEl = $('#hero')
const heroGlEl = $('#hero-gl')
const storyEl = $('#story')
const collectionEl = $('#collection')
const footerEl = $('#footer')

const storeDrawer = $('#store-drawer')
const pdpView = $('#pdp')
const cartDrawer = $('#cart-drawer')
const checkoutView = $('#checkout-view')
const aboutView = $('#about-view')
const mobileMenuEl = $('#mobile-menu')

$('#header-logo').innerHTML = getMarkSvgMarkup()
$('#about-mark').innerHTML = getMarkSvgMarkup()

// ============================================================================
// Lenis Smooth Scroll
// ============================================================================
const lenis = new Lenis({
  lerp: 0.1,
  smoothWheel: true,
})

function setScrollLock(locked) {
  document.documentElement.classList.toggle('is-locked', locked)
  if (locked) lenis.stop()
  else lenis.start()
}

// ============================================================================
// 1. Preloader (WebGL1 SDF Mark + Circular Iris Wipe)
// ============================================================================
function runPreloader() {
  const mark = createMarkCanvas(preloaderMarkEl, { size: 176 })
  const skipFast = reducedMotion || sessionStorage.getItem('vela_preloaded') === '1'
  const dur = skipFast ? 0.55 : 2.15

  setScrollLock(true)
  mark.play({
    duration: dur,
    onProgress: (p) => {
      preloaderCountEl.textContent = `${Math.round(p * 100)}%`
    },
    onDone: () => {
      sessionStorage.setItem('vela_preloaded', '1')
      if (reducedMotion) {
        preloaderEl.classList.add('is-done')
        setScrollLock(currentRoute !== 'home')
        return
      }
      const start = performance.now()
      const wipeMs = 780
      const step = (now) => {
        const t = Math.min(1, (now - start) / wipeMs)
        const ease = 1 - Math.pow(1 - t, 3.2)
        preloaderEl.style.setProperty('--hole', `${(ease * 86).toFixed(2)}vmax`)
        if (t < 1) requestAnimationFrame(step)
        else {
          preloaderEl.classList.add('is-done')
          setScrollLock(currentRoute !== 'home')
        }
      }
      requestAnimationFrame(step)
    },
  })
}

// ============================================================================
// 2. Hero WebGL1 Interactive Fluid Steam / Vapor Reveal Shader
// ============================================================================
initHeroShader(heroGlEl, heroEl, '/img/hero-reveal.png')

// ============================================================================
// 3. Footer WebGL1 Blooming Mark
// ============================================================================
const footerMark = createMarkCanvas($('#footer-mark'), { size: 360 })
let footerPlayed = false
const footerIO = new IntersectionObserver(
  (entries) => {
    if (entries[0]?.isIntersecting && !footerPlayed) {
      footerPlayed = true
      footerMark.play({ duration: 2.35 })
    }
  },
  { threshold: 0.2 }
)
footerIO.observe(footerEl)

// ============================================================================
// 4. Cursor-Following "COMING SOON" Pill
// ============================================================================
let soonVisible = false
let soonX = 0, soonY = 0, curSoonX = 0, curSoonY = 0

$$('[data-soon]').forEach((el) => {
  el.addEventListener('pointerenter', () => {
    soonVisible = true
    soonEl.classList.add('is-visible')
    const onLight = headerEl.dataset.theme === 'light' && !storeOpen
    soonEl.classList.toggle('is-dark', onLight)
  })
  el.addEventListener('pointerleave', () => {
    soonVisible = false
    soonEl.classList.remove('is-visible')
  })
  el.addEventListener('click', (e) => e.preventDefault())
})
window.addEventListener('pointermove', (e) => {
  soonX = e.clientX + 14
  soonY = e.clientY + 14
})

// ============================================================================
// 5. Story 6-Act Scroll Choreography
// ============================================================================
const act2El = $('#story-act2')
const act3El = $('#story-act3')
const act4El = $('#story-act4')
const act56El = $('#story-act56')

const splitLefts = $$('.split-l', act2El)
const splitRights = $$('.split-r', act2El)
const wipeStageEl = $('#wipe-stage')
const wipePhotoWrap = $('#wipe-photo-wrap')
const wipeCadWrap = $('#wipe-cad-wrap')
const wipeCadSvg = $('#wipe-cad-svg')

const spinCadWrap = $('#spin-cad-wrap')
const spinCadSvg = $('#spin-cad-svg')
const spinNumEl = $('#spin-num')
const spinBeatEls = $$('[data-beat]')
const spinTitleEls = $$('[data-beat-title]')

const spiralStage = $('#spiral-stage')
const spiralMobileTrack = $('#spiral-mobile-track')
const spiralMobileProgress = $('#spiral-mobile-progress')

const sizesFlankEl = $('#sizes-flank')
const sizeCardEl = $('#size-card')
const blueprintStageEl = $('#blueprint-stage')
const blueprintSvg = $('#blueprint-svg')

// Exact top-down Donut V (III) torus CAD plan matched to donut-top.png
const topDownPath = buildDonutCADPath({
  size: 3,
  yaw: 0,
  pitch: Math.PI / 2,
  cx: 400,
  cy: 400,
  scale: 245,
})
wipeCadSvg.innerHTML = `<path d="${topDownPath}" stroke="#5c7065" stroke-width="1.35" stroke-linecap="round" stroke-linejoin="round" fill="none" />`

const spiralNodes = SPIRAL_PHOTOS.map((item, i) => {
  const el = document.createElement('figure')
  el.className = 'spiral__item'
  el.innerHTML = `<img src="${item.src}" alt="${item.alt}" loading="lazy" />`
  spiralStage.appendChild(el)

  const mob = document.createElement('figure')
  mob.className = 'spiral__mob-card'
  mob.innerHTML = `<img src="${item.src}" alt="${item.alt}" loading="lazy" />`
  spiralMobileTrack.appendChild(mob)

  return {
    el,
    angleOffset: i * 1.18,
    phase: i / SPIRAL_PHOTOS.length,
    radiusFactor: 0.72 + (i % 3) * 0.22,
  }
})

spiralMobileTrack.addEventListener('scroll', () => {
  const max = Math.max(1, spiralMobileTrack.scrollWidth - spiralMobileTrack.clientWidth)
  const pct = 20 + (spiralMobileTrack.scrollLeft / max) * 80
  spiralMobileProgress.style.width = `${pct.toFixed(1)}%`
})

$('#card-svg-I').innerHTML = buildCardElevationSvg(1)
$('#card-svg-II').innerHTML = buildCardElevationSvg(2)
$('#card-svg-III').innerHTML = buildCardElevationSvg(3)

function selectCardSize(size) {
  selectedCardSize = size
  const v = VARIANTS[size]
  $('#card-title').textContent = v.title
  $('#card-dims').textContent = v.dims
  $('#card-mat').textContent = v.material
  const cta = $('#card-cta')
  cta.textContent = `ORDER FROM ${v.priceFormatted}`
  cta.dataset.size = size
  cta.href = `/donut-v?size=${size}`
  $$('[data-card-size]').forEach((btn) => {
    const active = btn.dataset.cardSize === size
    btn.classList.toggle('is-selected', active)
    btn.setAttribute('aria-checked', String(active))
  })
}
$$('[data-card-size]').forEach((btn) => {
  btn.addEventListener('click', () => selectCardSize(btn.dataset.cardSize))
})

function clamp01(v) {
  return Math.min(1, Math.max(0, v))
}

function sectionProgress(el) {
  const r = el.getBoundingClientRect()
  const span = Math.max(1, r.height - window.innerHeight)
  return clamp01(-r.top / span)
}

let lastSpinKey = ''
let lastIsoKey = ''
let lastBeatIdx = -1

function updateScrollChoreography() {
  if (currentRoute !== 'home') return

  const vh = window.innerHeight
  const vw = window.innerWidth
  const isMobile = vw <= 768

  const heroRect = heroEl.getBoundingClientRect()
  const storyRect = storyEl.getBoundingClientRect()
  const colRect = collectionEl.getBoundingClientRect()
  const footerRect = footerEl.getBoundingClientRect()

  const heroScrollP = clamp01(-heroRect.top / Math.max(1, heroRect.height * 0.65))
  const inPaper = storyRect.top <= 90 && colRect.top > 90
  headerEl.dataset.theme = inPaper ? 'light' : 'dark'
  headerEl.classList.toggle('is-folded', heroScrollP > 0.35 && aboutView.hidden)
  headerEl.classList.toggle('is-hidden-footer', footerRect.top < vh * 0.48)

  if (!isMobile) {
    const scale = 1 - heroScrollP * 0.76
    headerTitleEl.style.transform = `scale(${scale.toFixed(4)})`
    headerTitleEl.style.opacity = footerRect.top < vh * 0.6 ? '0' : '1'
  } else {
    headerTitleEl.style.transform = ''
    headerTitleEl.style.opacity = mobileMenuOpen || heroScrollP > 0.6 ? '0' : '1'
  }

  // Act 2: Parting Editorial Copy + Descending Top-Down Donut -> Torus CAD Wipe
  const p2 = sectionProgress(act2El)
  const partP = clamp01((p2 - 0.02) / 0.44)
  const spreadPx = partP * (isMobile ? 76 : 255)
  const copyFade = 1 - clamp01((p2 - 0.62) / 0.25)

  for (let i = 0; i < splitLefts.length; i++) {
    splitLefts[i].style.transform = `translate3d(${(-spreadPx).toFixed(1)}px, 0, 0)`
    splitLefts[i].style.opacity = copyFade.toFixed(3)
    splitRights[i].style.transform = `translate3d(${spreadPx.toFixed(1)}px, 0, 0)`
    splitRights[i].style.opacity = copyFade.toFixed(3)
  }

  const descY = (1 - clamp01(p2 / 0.45)) * -52
  const wipeScale = 0.72 + clamp01(p2 / 0.55) * 0.28
  const wipeOpacity = clamp01(p2 / 0.16)
  wipeStageEl.style.transform = `translate(-50%, calc(-50% + ${descY.toFixed(1)}vh)) scale(${wipeScale.toFixed(3)})`
  wipeStageEl.style.opacity = wipeOpacity.toFixed(3)

  const wipeCut = clamp01((p2 - 0.44) / 0.46) * 100
  wipePhotoWrap.style.clipPath = `inset(${wipeCut.toFixed(1)}% 0 0 0)`
  wipeCadWrap.style.clipPath = `inset(0 0 ${(100 - wipeCut).toFixed(1)}% 0)`

  // Act 3: Scroll-Scrubbed Torus CAD Rotation & 3 Beats
  const p3 = sectionProgress(act3El)
  const spinKey = Math.round(p3 * 120)
  if (spinKey !== lastSpinKey) {
    lastSpinKey = spinKey
    const easeP3 = p3 * p3 * (3 - 2 * p3)
    const pitch = (Math.PI / 2) * (1 - clamp01(easeP3 * 1.12))
    const yaw = easeP3 * Math.PI * 0.9
    const roll = (1 - clamp01(easeP3 * 1.5)) * 0.08
    const d = buildDonutCADPath({
      size: 3,
      yaw,
      pitch,
      roll,
      cx: 400,
      cy: 420,
      scale: 220 + easeP3 * 22,
    })
    spinCadSvg.innerHTML = `<path d="${d}" stroke="#5c7065" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" fill="none" />`
  }

  const out3 = clamp01((p3 - 0.86) / 0.14)
  spinCadWrap.style.transform = `scale(${(1 - out3 * 0.14).toFixed(3)}) rotate(${(-out3 * 6).toFixed(2)}deg)`
  spinCadWrap.style.filter = out3 > 0.01 ? `blur(${(out3 * 6).toFixed(1)}px)` : 'none'
  spinCadWrap.style.opacity = (1 - out3 * 0.85).toFixed(3)

  const beatIdx = p3 < 0.34 ? 0 : p3 < 0.68 ? 1 : 2
  if (beatIdx !== lastBeatIdx) {
    lastBeatIdx = beatIdx
    spinNumEl.textContent = `0${beatIdx + 1}`
    spinBeatEls.forEach((b, idx) => b.classList.toggle('is-active', idx === beatIdx))
    spinTitleEls.forEach((t, idx) => t.classList.toggle('is-active', idx === beatIdx))
  }

  // Act 4: 3D Photo Spiral Vortex (Desktop)
  if (!isMobile) {
    const p4 = sectionProgress(act4El)
    const rX = Math.min(vw * 0.36, 520)
    const rY = Math.min(vh * 0.32, 300)

    for (let i = 0; i < spiralNodes.length; i++) {
      const n = spiralNodes[i]
      const local = (p4 * 1.45 + n.phase) % 1.25
      const depth = local - 0.15
      const angle = n.angleOffset + p4 * Math.PI * 2.15 + depth * 1.4
      const spread = (0.18 + Math.max(0, depth) * 1.15) * n.radiusFactor
      const tx = Math.cos(angle) * rX * spread
      const ty = Math.sin(angle) * rY * spread
      const tz = -720 + depth * 1100
      const rotZ = Math.cos(angle) * 14
      const op = clamp01(depth * 3.2) * (1 - clamp01((depth - 0.82) / 0.25))

      n.el.style.transform = `translate3d(${tx.toFixed(1)}px, ${ty.toFixed(1)}px, ${tz.toFixed(1)}px) rotateZ(${rotZ.toFixed(1)}deg)`
      n.el.style.opacity = op.toFixed(3)
    }
  }

  // Act 5 & Act 6: Floating Card -> Isometric Cafe Table Blueprint Morph
  const p56 = sectionProgress(act56El)
  const cardIn = clamp01(p56 / 0.24)
  const cardInEase = 1 - Math.pow(1 - cardIn, 3)
  const cardOut = clamp01((p56 - 0.54) / 0.14)

  const tilt = (1 - cardInEase) * -6.5
  const scaleC = 0.84 + cardInEase * 0.16 - cardOut * 0.06
  const yC = (1 - cardInEase) * 110
  const cardOpacity = cardInEase * (1 - cardOut)

  sizeCardEl.style.transform = `translate3d(0, ${yC.toFixed(1)}px, 0) rotate(${tilt.toFixed(2)}deg) scale(${scaleC.toFixed(3)})`
  sizeCardEl.style.opacity = cardOpacity.toFixed(3)
  sizeCardEl.style.pointerEvents = cardOpacity > 0.35 ? 'auto' : 'none'
  sizesFlankEl.style.opacity = (clamp01((p56 - 0.14) / 0.14) * (1 - cardOut)).toFixed(3)

  const isoT = clamp01((p56 - 0.56) / 0.38)
  const isoOpacity = clamp01((p56 - 0.54) / 0.14)
  blueprintStageEl.style.opacity = isoOpacity.toFixed(3)

  if (isoOpacity > 0.01) {
    const isoKey = Math.round(isoT * 60)
    if (isoKey !== lastIsoKey) {
      lastIsoKey = isoKey
      blueprintSvg.innerHTML = buildIsoTableMorphSvg(isoT)
    }
  }
}

// ============================================================================
// 6. Interactive "Glaze the Donut" Studio (Click 3 Glaze Bowls -> Coat Donuts!)
// ============================================================================
function initInteractiveStudio() {
  const promptEl = $('#studio-prompt')
  const statusEl = $('#studio-status')
  const resetBtn = $('#studio-reset')
  const hits = $$('.studio__hit')

  function syncStudioHud() {
    const count = glazedDonuts.size
    if (count === 0) {
      promptEl.textContent = 'CLICK A GLAZE'
      statusEl.textContent = 'FINISH THE TRIO'
      resetBtn.classList.add('is-hidden')
    } else if (count < 3) {
      promptEl.textContent = `${count} / 3 GLAZED`
      statusEl.textContent = 'SELECT NEXT GLAZE'
      resetBtn.classList.remove('is-hidden')
    } else {
      promptEl.textContent = '3 / 3 GLAZED'
      statusEl.textContent = 'BOX COMPLETE'
      resetBtn.classList.remove('is-hidden')
    }
  }

  hits.forEach((btn) => {
    const id = Number(btn.dataset.tube)
    const lying = $(`#studio-lying-${id}`)
    const slot = $(`#studio-slot-${id}`)

    btn.addEventListener('pointerenter', () => lying?.classList.add('is-hover'))
    btn.addEventListener('pointerleave', () => lying?.classList.remove('is-hover'))
    btn.addEventListener('click', () => {
      if (glazedDonuts.has(id)) return
      glazedDonuts.add(id)
      btn.disabled = true
      lying?.classList.remove('is-hover')
      lying?.classList.add('is-placed')
      slot?.classList.add('is-placed')
      syncStudioHud()
    })
  })

  resetBtn.addEventListener('click', () => {
    glazedDonuts.clear()
    hits.forEach((btn) => {
      const id = Number(btn.dataset.tube)
      btn.disabled = false
      $(`#studio-lying-${id}`)?.classList.remove('is-placed', 'is-hover')
      $(`#studio-slot-${id}`)?.classList.remove('is-placed')
    })
    syncStudioHud()
  })
}
initInteractiveStudio()

// ============================================================================
// 7. 3-Column PDP (/donut-v?size=I|II|III)
// ============================================================================
const pdpThumbsEl = $('#pdp-thumbs')
const pdpStackEl = $('#pdp-stack')
const pdpDotsEl = $('#pdp-mob-dots')
const pdpCounterEl = $('#pdp-counter')
const pdpCenterEl = $('#pdp-center')
const pdpCadEl = $('#pdp-cad')

function initPdpGallery() {
  pdpThumbsEl.innerHTML = ''
  pdpStackEl.innerHTML = ''
  pdpDotsEl.innerHTML = ''

  PDP_GALLERY.forEach((item, i) => {
    const tb = document.createElement('button')
    tb.type = 'button'
    tb.className = `pdp__thumb${i === 0 ? ' is-active' : ''}`
    tb.setAttribute('aria-label', `View photo ${i + 1} of ${PDP_GALLERY.length}`)
    tb.innerHTML = `<img src="${item.src}" alt="${item.alt}" />`
    tb.addEventListener('click', () => scrollPdpToPhoto(i))
    pdpThumbsEl.appendChild(tb)

    const fig = document.createElement('figure')
    fig.className = 'pdp__photo'
    fig.dataset.photoIdx = String(i)
    fig.innerHTML = `<img src="${item.src}" alt="${item.alt}" />`
    pdpStackEl.appendChild(fig)

    const dot = document.createElement('span')
    dot.className = i === 0 ? 'is-active' : ''
    pdpDotsEl.appendChild(dot)
  })

  const photos = $$('.pdp__photo', pdpStackEl)
  const io = new IntersectionObserver(
    (entries) => {
      let best = null
      for (const e of entries) {
        if (e.isIntersecting && (!best || e.intersectionRatio > best.intersectionRatio)) best = e
      }
      if (!best) return
      const idx = Number(best.target.dataset.photoIdx)
      pdpCounterEl.textContent = `${idx + 1}/${PDP_GALLERY.length}`
      $$('.pdp__thumb', pdpThumbsEl).forEach((t, k) => t.classList.toggle('is-active', k === idx))
    },
    { root: pdpCenterEl, threshold: [0.35, 0.6, 0.85] }
  )
  photos.forEach((p) => io.observe(p))
}
initPdpGallery()

function scrollPdpToPhoto(idx) {
  const target = pdpStackEl.children[idx]
  if (target) target.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'start' })
}

function setPdpSize(size, { scrollToVariant = true, updateUrl = true } = {}) {
  const safe = VARIANTS[size] ? size : 'III'
  currentPdpSize = safe
  const v = VARIANTS[safe]

  $('#pdp-title').textContent = v.title
  $('#pdp-price').textContent = v.priceFormatted
  $('#pdp-mob-price').textContent = v.priceFormatted
  $('#pdp-copy').textContent = v.copy

  const numSize = safe === 'I' ? 1 : safe === 'II' ? 2 : 3
  pdpCadEl.innerHTML = buildPdpDimsSvg(numSize, 1)

  $$('[data-pdp-size]').forEach((btn) => {
    const active = btn.dataset.pdpSize === safe
    btn.classList.toggle('is-active', active)
    btn.setAttribute('aria-checked', String(active))
  })

  if (scrollToVariant) scrollPdpToPhoto(v.pdpImageIndex)
  if (updateUrl && currentRoute === 'pdp') {
    history.replaceState({ route: 'pdp', size: safe }, '', `/donut-v?size=${safe}`)
  }
}

$$('[data-pdp-size]').forEach((btn) => {
  btn.addEventListener('click', () => setPdpSize(btn.dataset.pdpSize))
})

$$('.pdp__acc-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    const expanded = btn.getAttribute('aria-expanded') === 'true'
    btn.setAttribute('aria-expanded', String(!expanded))
    btn.querySelector('.pdp__acc-sign').textContent = expanded ? '+' : '−'
    btn.nextElementSibling.hidden = expanded
  })
})

$('#pdp-add').addEventListener('click', () => {
  addToCart(currentPdpSize)
  openCart()
})

// ============================================================================
// 8. Cart & Morning Batch Reservation Checkout
// ============================================================================
function cartCount() {
  return cart.reduce((sum, item) => sum + item.qty, 0)
}
function cartSubtotal() {
  return cart.reduce((sum, item) => sum + VARIANTS[item.size].price * item.qty, 0)
}

function addToCart(size) {
  const existing = cart.find((i) => i.size === size)
  if (existing) existing.qty += 1
  else cart.push({ size, qty: 1 })
  saveCart()
  renderCart()
}

function updateQty(size, delta) {
  const idx = cart.findIndex((i) => i.size === size)
  if (idx === -1) return
  cart[idx].qty += delta
  if (cart[idx].qty <= 0) cart.splice(idx, 1)
  saveCart()
  renderCart()
}

function removeFromCart(size) {
  cart = cart.filter((i) => i.size !== size)
  saveCart()
  renderCart()
}

function renderCart() {
  const count = cartCount()
  const sub = cartSubtotal()
  $$('.cart-count').forEach((el) => (el.textContent = String(count)))
  $('#cart-subtotal').textContent = `€${sub}`
  $('#co-subtotal').textContent = `€${sub}`
  $('#btn-checkout').disabled = count === 0

  const cartItemsEl = $('#cart-items')
  const coItemsEl = $('#checkout-items')

  if (count === 0) {
    cartItemsEl.innerHTML = `
      <div class="cart-empty">
        <p class="t12s">Your box is empty.</p>
        <button type="button" class="link-under t12" data-empty-browse>VIEW DONUT V</button>
      </div>
    `
    $('[data-empty-browse]', cartItemsEl)?.addEventListener('click', () => {
      closeCart()
      navigate('pdp', { size: 'III' })
    })
    coItemsEl.innerHTML = `
      <div class="cart-empty">
        <p class="t12s">No pastries selected yet.</p>
        <a href="/donut-v?size=III" class="link-under t12" data-nav="pdp" data-size="III">SELECT DONUT V</a>
      </div>
    `
    return
  }

  cartItemsEl.innerHTML = cart
    .map((item) => {
      const v = VARIANTS[item.size]
      return `
        <div class="cart-row">
          <div class="cart-row__thumb"><img src="${v.thumb}" alt="${v.title}" /></div>
          <div class="cart-row__info">
            <span class="t12">${v.title} · ${v.flavor}</span>
            <div class="cart-row__controls">
              <div class="qty-step t12">
                <button type="button" data-qty-dec="${v.id}" aria-label="Decrease quantity">−</button>
                <span>${item.qty}</span>
                <button type="button" data-qty-inc="${v.id}" aria-label="Increase quantity">+</button>
              </div>
              <button type="button" class="cart-remove t12s" data-qty-rem="${v.id}">Remove</button>
            </div>
          </div>
          <span class="t12">€${v.price * item.qty}</span>
        </div>
      `
    })
    .join('')

  coItemsEl.innerHTML = cart
    .map((item) => {
      const v = VARIANTS[item.size]
      return `
        <div class="co-row">
          <div class="co-row__thumb"><img src="${v.thumb}" alt="${v.title}" /></div>
          <div class="co-row__meta">
            <span class="t12">${v.title} · ${v.flavor}</span>
            <span class="t12s is-grey">${v.dims}</span>
            <button type="button" class="cart-remove t12s" style="align-self:flex-start" data-qty-rem="${v.id}">Remove</button>
          </div>
          <div class="qty-step t12">
            <button type="button" data-qty-dec="${v.id}" aria-label="Decrease quantity">−</button>
            <span>${item.qty}</span>
            <button type="button" data-qty-inc="${v.id}" aria-label="Increase quantity">+</button>
          </div>
          <span class="co-row__price t12">€${v.price * item.qty}</span>
        </div>
      `
    })
    .join('')

  ;[cartItemsEl, coItemsEl].forEach((container) => {
    $$('[data-qty-dec]', container).forEach((b) => b.addEventListener('click', () => updateQty(b.dataset.qtyDec, -1)))
    $$('[data-qty-inc]', container).forEach((b) => b.addEventListener('click', () => updateQty(b.dataset.qtyInc, 1)))
    $$('[data-qty-rem]', container).forEach((b) => b.addEventListener('click', () => removeFromCart(b.dataset.qtyRem)))
  })
}
renderCart()

$('#checkout-form').addEventListener('submit', (e) => {
  e.preventDefault()
  const name = $('#co-name').value.trim()
  const email = $('#co-email').value.trim()
  const fb = $('#co-feedback')

  if (cartCount() === 0) {
    fb.textContent = 'Add a Donut V edition before reserving your morning batch.'
    return
  }
  if (!name) {
    fb.textContent = 'Please enter your name.'
    $('#co-name').focus()
    return
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    fb.textContent = 'Please enter a valid email address.'
    $('#co-email').focus()
    return
  }

  const summary = cart.map((i) => `${i.qty} × ${VARIANTS[i.size].title}`).join(', ')
  fb.textContent = `Reserved for ${name} (${summary}). Morning batch confirmation will be sent to ${email}.`
  $('#checkout-form').reset()
})

// ============================================================================
// 9. Drawers & SPA Routing (/, /donut-v?size=I|II|III, /checkout, /about)
// ============================================================================
function openStore() {
  closeCart()
  closeMobileMenu()
  storeOpen = true
  storeDrawer.hidden = false
  $('#btn-store').setAttribute('aria-expanded', 'true')
  setScrollLock(true)
}
function closeStore() {
  if (!storeOpen) return
  storeOpen = false
  storeDrawer.hidden = true
  $('#btn-store').setAttribute('aria-expanded', 'false')
  if (currentRoute === 'home') setScrollLock(false)
}

function openCart() {
  closeStore()
  closeMobileMenu()
  cartOpen = true
  cartDrawer.hidden = false
  $('#btn-cart').setAttribute('aria-expanded', 'true')
  setScrollLock(true)
}
function closeCart() {
  if (!cartOpen) return
  cartOpen = false
  cartDrawer.hidden = true
  $('#btn-cart').setAttribute('aria-expanded', 'false')
  if (currentRoute === 'home') setScrollLock(false)
}

function openMobileMenu() {
  closeStore()
  closeCart()
  mobileMenuOpen = true
  mobileMenuEl.hidden = false
  $('#btn-mobile-menu').textContent = 'CLOSE'
  $('#btn-mobile-menu').setAttribute('aria-expanded', 'true')
  headerEl.dataset.theme = 'dark'
  headerTitleEl.style.opacity = '0'
  setScrollLock(true)
}
function closeMobileMenu() {
  if (!mobileMenuOpen) return
  mobileMenuOpen = false
  mobileMenuEl.hidden = true
  $('#btn-mobile-menu').textContent = 'MENU'
  $('#btn-mobile-menu').setAttribute('aria-expanded', 'false')
  if (currentRoute === 'home') {
    setScrollLock(false)
    updateScrollChoreography()
  } else if (currentRoute === 'pdp') {
    headerEl.dataset.theme = 'light'
  }
}

function applyRoute(route, { size = 'III', push = true } = {}) {
  closeStore()
  closeCart()
  closeMobileMenu()

  currentRoute = route
  pdpView.hidden = route !== 'pdp'
  checkoutView.hidden = route !== 'checkout'
  aboutView.hidden = route !== 'about'

  document.documentElement.classList.toggle('is-page', route === 'pdp')
  document.documentElement.classList.toggle('is-dark-overlay', route === 'checkout' || route === 'about')

  headerEl.classList.remove('is-hidden-footer')
  headerEl.classList.toggle('is-about', route === 'about')

  if (route === 'home') {
    headerEl.classList.remove('is-folded')
    headerTitleEl.style.opacity = '1'
    setScrollLock(false)
    document.title = 'VELA — Donut V (III)'
    if (push) history.pushState({ route: 'home' }, '', '/')
    updateScrollChoreography()
  } else if (route === 'pdp') {
    headerEl.dataset.theme = 'light'
    headerEl.classList.add('is-folded')
    headerTitleEl.style.opacity = '0'
    setScrollLock(true)
    setPdpSize(size, { scrollToVariant: true, updateUrl: false })
    document.title = `VELA — ${VARIANTS[currentPdpSize].title}`
    if (push) history.pushState({ route: 'pdp', size: currentPdpSize }, '', `/donut-v?size=${currentPdpSize}`)
  } else if (route === 'checkout') {
    headerEl.dataset.theme = 'dark'
    headerEl.classList.add('is-folded')
    headerTitleEl.style.opacity = '0'
    setScrollLock(true)
    renderCart()
    document.title = 'VELA — Checkout'
    if (push) history.pushState({ route: 'checkout' }, '', '/checkout')
  } else if (route === 'about') {
    headerEl.dataset.theme = 'dark'
    headerEl.classList.remove('is-folded')
    headerTitleEl.style.opacity = '0'
    setScrollLock(true)
    document.title = 'VELA — About'
    if (push) history.pushState({ route: 'about' }, '', '/about')
  }
}

function navigate(route, opts = {}) {
  applyRoute(route, { ...opts, push: true })
}

document.addEventListener('click', (e) => {
  const nav = e.target.closest('[data-nav]')
  if (nav) {
    e.preventDefault()
    const target = nav.dataset.nav
    const size = nav.dataset.size || 'III'
    if (target === 'home' && currentRoute === 'home') lenis.scrollTo(0)
    else navigate(target, { size })
    return
  }
  if (e.target.closest('[data-open-store]')) { e.preventDefault(); openStore(); return }
  if (e.target.closest('[data-close-store]')) { closeStore(); return }
  if (e.target.closest('[data-close-cart]')) { closeCart(); return }
})

$('#btn-store').addEventListener('click', () => (storeOpen ? closeStore() : openStore()))
$('#btn-cart').addEventListener('click', () => (cartOpen ? closeCart() : openCart()))
$('#btn-checkout').addEventListener('click', () => { if (cartCount() > 0) navigate('checkout') })
$('#btn-mobile-menu').addEventListener('click', () => (mobileMenuOpen ? closeMobileMenu() : openMobileMenu()))

window.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return
  if (cartOpen) closeCart()
  else if (storeOpen) closeStore()
  else if (mobileMenuOpen) closeMobileMenu()
  else if (currentRoute !== 'home') navigate('home')
})

window.addEventListener('popstate', () => syncFromLocation())

function syncFromLocation() {
  const path = location.pathname.replace(/\/+$/, '') || '/'
  const params = new URLSearchParams(location.search)
  if (path === '/donut-v') applyRoute('pdp', { size: params.get('size') || 'III', push: false })
  else if (path === '/checkout') applyRoute('checkout', { push: false })
  else if (path === '/about') applyRoute('about', { push: false })
  else applyRoute('home', { push: false })
}

// ============================================================================
// 10. Main RAF Loop
// ============================================================================
function raf(time) {
  lenis.raf(time)
  updateScrollChoreography()
  if (soonVisible) {
    curSoonX += (soonX - curSoonX) * 0.22
    curSoonY += (soonY - curSoonY) * 0.22
    soonEl.style.transform = `translate3d(${curSoonX.toFixed(1)}px, ${curSoonY.toFixed(1)}px, 0)`
  }
  requestAnimationFrame(raf)
}
requestAnimationFrame(raf)

syncFromLocation()
runPreloader()
