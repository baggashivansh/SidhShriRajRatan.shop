document.addEventListener("DOMContentLoaded", () => {
  initCurrentYear();
  initGalleryScroller();
  initTestimonialsScroller();
  initLazyImages();
});

/* =============================== ==========
   Footer year
========================================= */

function initCurrentYear() {
  const yearEl = document.getElementById("year");
  if (yearEl) {
    yearEl.textContent = new Date().getFullYear();
  }
}

/* =========================================
   Generic horizontal infinite scroller
   Used for:
   - Gallery (drag + arrows)
   - Testimonials (auto only)
========================================= */

function createHorizontalLooper(options) {
  const {
    wrapper,          // HTMLElement (outer container)
    track,            // HTMLElement (inner flex track)
    autoSpeed = 0.3, // px per millisecond
    allowDrag = true,
    pauseOnHover = true
  } = options;

  if (!wrapper || !track) return null;

  // Ensure required styles
  wrapper.style.overflow = "hidden";
  track.style.display = "flex";
  track.style.willChange = "transform";

  const originalItems = Array.from(track.children);
  if (!originalItems.length) return null;

  // Duplicate items once so we can loop seamlessly
  originalItems.forEach((item) => {
    const clone = item.cloneNode(true);
    track.appendChild(clone);
  });

  let translateX = 0;               // current position
  let lastTime = performance.now(); // last frame time
  let widthHalf = track.getBoundingClientRect().width / 2; // width of original set

  // Update width on resize (and a bit after images load)
  function recalcWidth() {
    const rect = track.getBoundingClientRect();
    if (rect.width > 0) {
      widthHalf = rect.width / 2;
    }
  }
  window.addEventListener("resize", recalcWidth);
  setTimeout(recalcWidth, 500);
  setTimeout(recalcWidth, 1200);

  // State flags
  let isDragging = false;
  let isHovering = false;
  let dragStartX = 0;
  let dragStartTranslate = 0;
  let currentAutoSpeed = autoSpeed;

  // Main animation loop
  function loop(now) {
    const dt = now - lastTime;
    lastTime = now;

    if (!isDragging && !isHovering) {
      translateX -= currentAutoSpeed * dt;
    }

    // Wrap around to create infinite loop
    if (widthHalf > 0) {
      if (translateX <= -widthHalf) translateX += widthHalf;
      if (translateX >= 0) translateX -= widthHalf;
    }

    track.style.transform = `translateX(${Math.round(translateX)}px)`;
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);

  /* ----- Drag & touch (optional) ----- */

  if (allowDrag) {
    track.addEventListener("pointerdown", (e) => {
      // Prevent native browser gestures (image drag / gesture start)
      // without this, touch gestures may be intercepted by the UA.
      e.preventDefault();

      isDragging = true;
      dragStartX = e.clientX;
      dragStartTranslate = translateX;
      track.style.cursor = "grabbing";
      currentAutoSpeed = 0;
      try { track.setPointerCapture(e.pointerId); } catch (_) {}
    });

    track.addEventListener("pointermove", (e) => {
      if (!isDragging) return;
      const deltaX = e.clientX - dragStartX;
      translateX = dragStartTranslate + deltaX;
    });

    function endDrag(e) {
      if (!isDragging) return;
      isDragging = false;
      track.style.cursor = "";
      currentAutoSpeed = autoSpeed;
      try { track.releasePointerCapture && track.releasePointerCapture(e.pointerId); } catch (_) {}
    }

    track.addEventListener("pointerup", endDrag);
    track.addEventListener("pointercancel", endDrag);
    track.addEventListener("pointerleave", endDrag);

    // Fallback for environments without Pointer Events (older Safari)
    if (!window.PointerEvent) {
      track.addEventListener('touchstart', (ev) => {
        const t = ev.touches[0];
        isDragging = true;
        dragStartX = t.clientX;
        dragStartTranslate = translateX;
        currentAutoSpeed = 0;
      }, { passive: false });

      track.addEventListener('touchmove', (ev) => {
        if (!isDragging) return;
        ev.preventDefault(); // keep horizontal dragging from becoming a native pan
        const t = ev.touches[0];
        const deltaX = t.clientX - dragStartX;
        translateX = dragStartTranslate + deltaX;
      }, { passive: false });

      track.addEventListener('touchend', () => {
        isDragging = false;
        currentAutoSpeed = autoSpeed;
      });
      track.addEventListener('touchcancel', () => {
        isDragging = false;
        currentAutoSpeed = autoSpeed;
      });
    }
  }

  /* ----- Pause on hover (optional) ----- */

  if (pauseOnHover) {
    wrapper.addEventListener("mouseenter", () => {
      isHovering = true;
    });
    wrapper.addEventListener("mouseleave", () => {
      isHovering = false;
    });
  }

  // Return API for manual nudges (next/prev buttons)
  function getItemWidth() {
    const first = track.querySelector(":scope > *");
    return first ? first.getBoundingClientRect().width : 280;
  }

  return {
    nudge(direction = 1, factor = 0.95) {
      // direction: 1 = next (left), -1 = prev (right)
      const w = getItemWidth();
      translateX -= direction * w * factor;
    }
  };
}

/* =========================================
   Gallery: auto + drag + arrows
========================================= */

function initGalleryScroller() {
  const wrapper = document.getElementById("galleryWrapper");
  const track = document.getElementById("galleryTrack");
  const prevBtn = document.getElementById("galleryPrev");
  const nextBtn = document.getElementById("galleryNext");

  // disable image dragging/select for elements inside our tracks
  disableImageDragAndSelect('#galleryTrack, #testimonialsTrack');

  const loop = createHorizontalLooper({
    wrapper,
    track,
    autoSpeed: 0.15, // slightly faster than testimonials
    allowDrag: true,
    pauseOnHover: true
  });

  if (!loop) return;

  // Arrow controls
  if (prevBtn) {
    prevBtn.addEventListener("click", () => loop.nudge(-1));
  }
  if (nextBtn) {
    nextBtn.addEventListener("click", () => loop.nudge(1));
  }

  // Keyboard support when wrapper is focused
  if (wrapper) {
    wrapper.tabIndex = 0;
    wrapper.addEventListener("keydown", (e) => {
      if (e.key === "ArrowLeft") loop.nudge(-1);
      if (e.key === "ArrowRight") loop.nudge(1);
    });
  }
}

/* =========================================
   Testimonials: auto only, pause on hover
========================================= */

function initTestimonialsScroller() {
  const wrapper = document.getElementById("testimonialsWrapper");
  const track = document.getElementById("testimonialsTrack");

  createHorizontalLooper({
    wrapper,
    track,
    autoSpeed: 0.1,  // a bit calmer
    allowDrag: false,
    pauseOnHover: true
  });
}

/* =========================================
   Lazy-load images (simple, safe)
========================================= */

function initLazyImages() {
  const images = document.querySelectorAll("img");
  images.forEach((img, index) => {
    // keep first couple of images eager (logo, hero)
    if (index <= 2) return;
    if (!img.hasAttribute("loading")) {
      img.setAttribute("loading", "lazy");
    }
  });
}

/* =========================================
   Small utility: disable image dragging/select
   (keeps pointer events focused on our track)
========================================= */

function disableImageDragAndSelect(selector = '#galleryTrack img, #testimonialsTrack img') {
  try {
    document.querySelectorAll(selector).forEach(el => {
      // For <img> elements set draggable=false
      if (el.tagName && el.tagName.toLowerCase() === 'img') {
        el.draggable = false;
      }
      // CSS-level protections (inline) to avoid selection/drag
      el.style.userSelect = 'none';
      el.style.webkitUserDrag = 'none';
      el.style.MozUserSelect = 'none';
    });
  } catch (err) {
    // silent fallback — don't break the rest of the script
  }
}
