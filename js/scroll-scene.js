/* =====================================================================
   KisanKart — smooth scrolling
   ---------------------------------------------------------------------
   Wheel input is eased with a lerp (Lenis-style) while native scrolling
   stays intact for keyboard, scrollbar and touch, so sticky headers,
   anchors and IntersectionObservers keep working. Skipped under
   prefers-reduced-motion.
   ===================================================================== */
(() => {
  'use strict';
  const REDUCE = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (REDUCE) return;
  const lerp = (a, b, t) => a + (b - a) * t;

  /* ── 1. Smooth wheel scrolling ───────────────────────────────────── */
  const smooth = { target: window.scrollY, current: window.scrollY, active: false, velocity: 0 };
  const maxScroll = () => document.documentElement.scrollHeight - window.innerHeight;
  const scrollsInside = (el) => {
    if (!(el instanceof Element)) return false;
    for (let n = el; n && n !== document.body; n = n.parentElement) {
      const cs = getComputedStyle(n);
      if (/(auto|scroll)/.test(cs.overflowY) && n.scrollHeight > n.clientHeight + 1) return true;
      if (/(auto|scroll)/.test(cs.overflowX) && n.scrollWidth > n.clientWidth + 1) return true;
    }
    return false;
  };

  let lastStep = 0;
  const step = (now) => {
    const diff = smooth.target - smooth.current;
    if (Math.abs(diff) < 0.4) { smooth.current = smooth.target; smooth.active = false; smooth.velocity = 0; return; }
    // frame-rate independent easing: same feel at 30, 60 or 120 fps
    const dt = Math.min(100, lastStep ? now - lastStep : 16.7);
    lastStep = now;
    const next = lerp(smooth.current, smooth.target, 1 - Math.pow(0.82, dt / 16.7));
    smooth.velocity = next - smooth.current;
    smooth.current = next;
    // 'instant' bypasses the page's CSS scroll-behavior:smooth, which would
    // otherwise re-animate every frame and make the scroll lag and stick
    window.scrollTo({ top: smooth.current, behavior: 'instant' });
    requestAnimationFrame(step);
  };

  window.addEventListener('wheel', (e) => {
    if (e.ctrlKey || document.body.classList.contains('no-scroll') || scrollsInside(e.target)) return;
    e.preventDefault();
    const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? window.innerHeight : 1;
    if (!smooth.active) { smooth.current = window.scrollY; smooth.target = window.scrollY; }
    smooth.target = Math.max(0, Math.min(maxScroll(), smooth.target + e.deltaY * unit));
    if (!smooth.active) {
      smooth.active = true; lastStep = 0;
      // respond on this very event: move a first step immediately, then ease the rest
      smooth.current = lerp(smooth.current, smooth.target, 0.25);
      window.scrollTo({ top: smooth.current, behavior: 'instant' });
      requestAnimationFrame(step);
    }
  }, { passive: false });

  // Keep in sync when the page is scrolled by other means (keys, scrollbar, anchors)
  window.addEventListener('scroll', () => { if (!smooth.active) { smooth.current = smooth.target = window.scrollY; } }, { passive: true });

})();
