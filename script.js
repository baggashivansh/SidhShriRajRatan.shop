// script.js — full updated script (drop-in). Preserves original image sizes,
// supports gallery + testimonials auto scrollers, avoids double-cloning, supports lazy-load,
// drag on gallery, pause-on-hover, and robust recompute logic.

document.addEventListener("DOMContentLoaded", () => {
  initCurrentYear();
  initGalleryScroller();
  initTestimonialsScroller();
  initLazyImages();
});

/* ===============================
   Footer year
   =============================== */
function initCurrentYear() {
  const yearEl = document.getElementById("year");
  if (yearEl) yearEl.textContent = new Date().getFullYear();
}

/* ======================================================
   createHorizontalLooper (single, robust implementation)
   - preserves image sizing (does not overwrite img width/height)
   - detects pre-duplicated markup and avoids double-cloning
   - optional lazy-loading of images (uses data-src if present)
   - supports pointer/touch drag and pause-on-hover
   ====================================================== */
function createHorizontalLooper(options) {
  const {
    wrapper,
    track,
    autoSpeed = 0.3,    // px per millisecond
    allowDrag = true,
    pauseOnHover = true,
    enableLazy = true
  } = options || {};

  if (!wrapper || !track) return null;

  // minimal required styles that do not change image sizes
  wrapper.style.overflow = wrapper.style.overflow || "hidden";
  track.style.display = track.style.display || "flex";
  track.style.willChange = track.style.willChange || "transform";

  // children snapshot at start
  let children = Array.from(track.children);
  if (!children.length) return null;

  // detect if track already contains duplicated sequence (first half equals second half)
  function isAlreadyDuplicated(arr) {
    const n = arr.length;
    if (n < 2 || n % 2 !== 0) return false;
    const half = n / 2;
    for (let i = 0; i < half; i++) {
      if (arr[i].outerHTML !== arr[i + half].outerHTML) return false;
    }
    return true;
  }

  let originalCount = children.length;
  if (isAlreadyDuplicated(children)) {
    originalCount = children.length / 2;
    children = children.slice(0, originalCount);
  } else {
    // clone original set once
    const snapshot = children.slice();
    snapshot.forEach(item => {
      const clone = item.cloneNode(true);
      track.appendChild(clone);
    });
    children = Array.from(track.children).slice(0, snapshot.length);
    originalCount = snapshot.length;
  }

  // lazy-prep images without changing sizing
  if (enableLazy) {
    const imgs = track.querySelectorAll("img");
    imgs.forEach(img => {
      if (!img.hasAttribute("loading")) img.setAttribute("loading", "lazy");
      if (!img.dataset.src && img.src) img.dataset.src = img.src;
      img.draggable = false;
    });

    // IntersectionObserver scoped to wrapper for lazy loading
    try {
      const io = new IntersectionObserver((entries, obs) => {
        entries.forEach(e => {
          if (e.isIntersecting) {
            const el = e.target;
            const src = el.dataset && el.dataset.src;
            if (src && el.src !== src) el.src = src;
            obs.unobserve(el);
          }
        });
      }, { root: wrapper, rootMargin: "400px" });

      track.querySelectorAll("img").forEach(img => io.observe(img));
    } catch (e) {
      // silently fallback if IO not available
    }
  }

  // helpers to compute width of original set
  function getGapPx(el) {
    try {
      const s = window.getComputedStyle(el).gap;
      return s ? parseFloat(s) : 0;
    } catch (e) {
      return 0;
    }
  }

  function computeOriginalWidth() {
    const gap = getGapPx(track);
    const cur = Array.from(track.children).slice(0, originalCount);
    const measured = cur.map(el => el.getBoundingClientRect().width || 0);
    const sum = measured.reduce((a, b) => a + b, 0);
    return sum + Math.max(0, (cur.length - 1)) * gap;
  }

  let widthOriginal = computeOriginalWidth();

  function recalcWidth() {
    const w = computeOriginalWidth();
    if (w > 0) widthOriginal = w;
  }

  // re-run on common events
  window.addEventListener("resize", recalcWidth);
  window.addEventListener("orientationchange", recalcWidth);
  setTimeout(recalcWidth, 200);
  setTimeout(recalcWidth, 800);
  setTimeout(recalcWidth, 1600);

  if ("ResizeObserver" in window) {
    try {
      const ro = new ResizeObserver(recalcWidth);
      ro.observe(track);
      ro.observe(wrapper);
    } catch (e) {}
  }

  // animation state
  let translateX = 0;
  let lastTime = performance.now();
  let isDragging = false;
  let isHovering = false;
  let dragStartX = 0;
  let dragStartTranslate = 0;
  let currentAutoSpeed = autoSpeed;

  function loop(now) {
    const dt = now - lastTime;
    lastTime = now;

    if (!isDragging && !isHovering) {
      translateX -= currentAutoSpeed * dt;
    }

    if (widthOriginal > 0) {
      if (translateX <= -widthOriginal) translateX += widthOriginal;
      if (translateX >= 0) translateX -= widthOriginal;
    }

    track.style.transform = `translateX(${Math.round(translateX)}px)`;
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);

  /* Drag & touch handling (preserves img sizing) */
  if (allowDrag) {
    track.addEventListener("pointerdown", (e) => {
      if (e.button && e.button !== 0) return;
      e.preventDefault();
      isDragging = true;
      dragStartX = e.clientX || e.pageX;
      dragStartTranslate = translateX;
      track.style.cursor = "grabbing";
      currentAutoSpeed = 0;
      try { track.setPointerCapture && track.setPointerCapture(e.pointerId); } catch (_) {}
    });

    track.addEventListener("pointermove", (e) => {
      if (!isDragging) return;
      const clientX = e.clientX || e.pageX;
      const delta = clientX - dragStartX;
      translateX = dragStartTranslate + delta;
    });

    function endDrag(e) {
      if (!isDragging) return;
      isDragging = false;
      track.style.cursor = "";
      currentAutoSpeed = autoSpeed;
      try { e && e.pointerId && track.releasePointerCapture && track.releasePointerCapture(e.pointerId); } catch (_) {}
    }

    track.addEventListener("pointerup", endDrag);
    track.addEventListener("pointercancel", endDrag);
    track.addEventListener("pointerleave", endDrag);

    // fallback for older browsers without PointerEvent
    if (!window.PointerEvent) {
      track.addEventListener("touchstart", (ev) => {
        const t = ev.touches && ev.touches[0];
        if (!t) return;
        isDragging = true;
        dragStartX = t.clientX;
        dragStartTranslate = translateX;
        currentAutoSpeed = 0;
      }, { passive: false });

      track.addEventListener("touchmove", (ev) => {
        if (!isDragging) return;
        ev.preventDefault();
        const t = ev.touches && ev.touches[0];
        if (!t) return;
        const delta = t.clientX - dragStartX;
        translateX = dragStartTranslate + delta;
      }, { passive: false });

      track.addEventListener("touchend", () => {
        isDragging = false;
        currentAutoSpeed = autoSpeed;
      });
      track.addEventListener("touchcancel", () => {
        isDragging = false;
        currentAutoSpeed = autoSpeed;
      });
    }
  }

  if (pauseOnHover) {
    wrapper.addEventListener("mouseenter", () => { isHovering = true; });
    wrapper.addEventListener("mouseleave", () => { isHovering = false; });
  }

  function getItemWidth() {
    const first = track.querySelector(":scope > *");
    return first ? first.getBoundingClientRect().width : 280;
  }

  return {
    nudge(direction = 1, factor = 0.95) {
      const w = getItemWidth();
      translateX -= direction * w * factor;
    },
    _recompute() { recalcWidth(); }
  };
}

/* ======================================================
   Gallery initializer
   - supports IDs (#galleryWrapper / #galleryTrack) or class fallback (.gallery-wrapper / .gallery-track)
   - preserves image size (does not set img width/height)
   ====================================================== */
function initGalleryScroller() {
  const wrapper = document.getElementById("galleryWrapper") || document.querySelector(".gallery-wrapper");
  const track = document.getElementById("galleryTrack") || document.querySelector(".gallery-track");

  if (!wrapper || !track) return;

  disableImageDragAndSelect("#galleryTrack img, #testimonialsTrack img, .gallery-track img, .testimonials-track img");

  const loop = createHorizontalLooper({
    wrapper,
    track,
    autoSpeed: 0.15, // adjust px/ms to tune speed
    allowDrag: true,
    pauseOnHover: true,
    enableLazy: true
  });

  if (!loop) return;

  // keyboard support for accessibility (left/right arrows)
  if (wrapper) {
    if (!wrapper.hasAttribute("tabindex")) wrapper.tabIndex = 0;
    wrapper.addEventListener("keydown", (e) => {
      if (e.key === "ArrowLeft") loop.nudge(-1);
      if (e.key === "ArrowRight") loop.nudge(1);
    });
  }
}

/* ======================================================
   Testimonials initializer
   - supports class-based markup from your index (.testimonials-wrapper / .testimonials-track)
   - avoids double clone and forces recompute after load
   ====================================================== */
function initTestimonialsScroller() {
  const wrapper = document.getElementById("testimonialsWrapper") || document.querySelector(".testimonials-wrapper");
  const track = document.getElementById("testimonialsTrack") || document.querySelector(".testimonials-track");

  if (!wrapper || !track) return;

  // prepare images inside testimonials for lazy-load (if any)
  const imgs = Array.from(track.querySelectorAll("img"));
  imgs.forEach(img => {
    if (!img.hasAttribute("loading")) img.setAttribute("loading", "lazy");
    if (!img.dataset.src && img.src) img.dataset.src = img.src;
    img.draggable = false;
  });

  const loop = createHorizontalLooper({
    wrapper,
    track,
    autoSpeed: 0.10,
    allowDrag: false,
    pauseOnHover: true,
    enableLazy: true
  });

  if (!loop) return;

  function recomputeSoon() {
    try { loop._recompute && loop._recompute(); } catch (e) {}
    setTimeout(() => { try { loop._recompute && loop._recompute(); } catch (e) {} }, 250);
    setTimeout(() => { try { loop._recompute && loop._recompute(); } catch (e) {} }, 800);
  }

  imgs.forEach(img => img.addEventListener("load", recomputeSoon, { passive: true }));

  if ("ResizeObserver" in window) {
    try {
      const ro = new ResizeObserver(recomputeSoon);
      ro.observe(track);
      ro.observe(wrapper);
    } catch (e) {}
  }

  window.addEventListener("load", recomputeSoon);
  window.addEventListener("resize", recomputeSoon);
  window.addEventListener("orientationchange", recomputeSoon);

  // quick sanity log
  setTimeout(() => {
    const visible = Array.from(track.children).some(ch => ch.getBoundingClientRect().width > 0);
    if (!visible) {
      console.warn("Testimonials scroller: no visible testimonial items. Ensure testimonials-track children are visible and not pre-duplicated twice.");
    }
  }, 900);
}

/* =========================================
   Global lazy image helper (keeps first few eager)
   ========================================= */
function initLazyImages() {
  const images = document.querySelectorAll("img");
  images.forEach((img, index) => {
    if (index <= 2) return; // keep first few eager
    if (!img.hasAttribute("loading")) img.setAttribute("loading", "lazy");
    if (!img.dataset.src && img.src) img.dataset.src = img.src;
  });
}

/* =========================================
   Utility: disable image dragging/select
   ========================================= */
function disableImageDragAndSelect(selector = '#galleryTrack img, #testimonialsTrack img') {
  try {
    document.querySelectorAll(selector).forEach(el => {
      if (el.tagName && el.tagName.toLowerCase() === "img") el.draggable = false;
      el.style.userSelect = "none";
      el.style.webkitUserDrag = "none";
      el.style.MozUserSelect = "none";
    });
  } catch (err) {
    // silent fallback
  }
}
