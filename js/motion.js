/* =====================================================================
   KisanKart — motion layer (Kage-style)
   ---------------------------------------------------------------------
   Techniques borrowed from the ThreeUI Kage document and applied to the
   store's own markup:

     1. Preloader   — #pre with a 1px progress bar, fades once the hero
                       media is ready (never longer than ~2.6s)
     2. Word reveals — display headings split into masked words that rise
                       at a reading pace (--word-delay), accessible label kept
     3. Grouped stagger — [data-rv] elements fade/rise 85ms apart per parent
     4. Parallax + Ken Burns — hero media drifts with scroll and eases its
                       scale after each slide change (rAF lerp, transforms only)
     6. Grain        — canvas-generated film grain, overlay blended

   Everything is transform/opacity based and fully disabled under
   prefers-reduced-motion (the loader just hides immediately).
   ===================================================================== */
(() => {
  'use strict';

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const REDUCE = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const lerp = (a, b, t) => a + (b - a) * t;

  /* ── 2. Word reveals ─────────────────────────────────────────────── */
  const WORD_TARGETS = '.hero__title, .section__title, .display, .promo__title, .footer__lead, .stats__title';

  /* Split every text node into masked words, keeping inline wrappers such as
     the lime <em> intact so colour accents survive. */
  const splitWords = (heading) => {
    if (heading.dataset.wordReady) return;
    heading.dataset.wordReady = '1';
    heading.setAttribute('aria-label', heading.textContent.trim().replace(/\s+/g, ' '));
    heading.classList.add('word-reveal');
    let index = 0;
    const walk = (node) => {
      Array.from(node.childNodes).forEach((child) => {
        if (child.nodeType === Node.ELEMENT_NODE) { if (child.tagName !== 'BR') walk(child); return; }
        if (child.nodeType !== Node.TEXT_NODE || !child.textContent.trim()) return;
        const frag = document.createDocumentFragment();
        child.textContent.split(/(\s+)/).forEach((part) => {
          if (!part) return;
          if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(' ')); return; }
          const mask = document.createElement('span');
          mask.className = 'word-mask';
          mask.setAttribute('aria-hidden', 'true');
          const word = document.createElement('span');
          word.className = 'word';
          word.textContent = part;
          word.style.setProperty('--word-delay', `${index++ * 72}ms`);
          mask.appendChild(word);
          frag.appendChild(mask);
        });
        child.replaceWith(frag);
      });
    };
    walk(heading);
  };

  /* ── 3. Grouped reveals ──────────────────────────────────────────── */
  const RV_TARGETS = [
    '.section__label', '.section__sub', '.section__head .btn', '.promo__content p', '.promo__content .btn',
    '.features li', '.bento__ring', '.stats li', '.solution', '.article', '.benefit', '.crop-card', '.cat-card',
    '.brand-chip', '.newsletter__form', '.footer__follow', '.footer__cta .btn', '.footer__col',
  ].join(', ');

  const wireReveals = () => {
    $$(WORD_TARGETS).forEach((h) => { if (!h.closest('.hero')) splitWords(h); });
    $$(RV_TARGETS).forEach((el) => { if (!el.hasAttribute('data-rv')) el.setAttribute('data-rv', 'up'); });

    const items = $$('[data-rv], .word-reveal').filter((el) => !el.closest('.hero'));
    const groups = new Map();
    items.forEach((el) => {
      const key = el.parentElement;
      groups.set(key, [...(groups.get(key) || []), el]);
    });
    groups.forEach((arr) => arr.forEach((el, i) => { el.dataset.rvd = Math.min(i * 85, 680); }));

    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (!en.isIntersecting) return;
        io.unobserve(en.target);
        const delay = parseFloat(en.target.dataset.rvd || 0);
        setTimeout(() => en.target.classList.add('rv-in'), delay);
      });
    }, { rootMargin: '0px 0px -10% 0px', threshold: 0.04 });
    items.forEach((el) => io.observe(el));

    // Safety net: anything already in view when the observer is throttled
    const sweep = () => items.forEach((el) => {
      if (!el.classList.contains('rv-in') && el.getBoundingClientRect().top < window.innerHeight) el.classList.add('rv-in');
    });
    window.addEventListener('scroll', sweep, { passive: true });
  };

  /* Hero headings: split now, revealed when their slide becomes active */
  const wireHeroWords = () => {
    $$('.hero__title').forEach(splitWords);
    const revealActive = () => {
      $$('.hero__slide').forEach((slide) => {
        const title = $('.hero__title', slide);
        if (!title) return;
        if (slide.classList.contains('is-active')) {
          // restart the word cascade for the incoming slide
          title.classList.remove('rv-in');
          void title.offsetWidth;
          title.classList.add('rv-in');
        } else title.classList.remove('rv-in');
      });
      kenBurns.scale = 1.08; // restart the slow push-in on each slide
    };
    document.addEventListener('hero:slide', revealActive);
    return revealActive;
  };

  /* ── 4. Parallax + Ken Burns (single rAF loop, transforms only) ──── */
  const kenBurns = { scale: 1.08, y: 0, target: 0 };
  const startParallax = () => {
    const hero = $('.hero');
    if (!hero) return;
    const bento = $$('.bento__card--img img');
    const tick = () => {
      const rect = hero.getBoundingClientRect();
      const inView = rect.bottom > 0 && rect.top < window.innerHeight;
      if (inView) {
        kenBurns.target = Math.max(0, -rect.top) * 0.22; // media drifts slower than the page
        kenBurns.y = lerp(kenBurns.y, kenBurns.target, 0.12);
        kenBurns.scale = lerp(kenBurns.scale, 1, 0.012);
        hero.style.setProperty('--py', `${kenBurns.y.toFixed(2)}px`);
        hero.style.setProperty('--ps', kenBurns.scale.toFixed(4));
      }
      bento.forEach((img) => {
        const r = img.parentElement.getBoundingClientRect();
        if (r.bottom < 0 || r.top > window.innerHeight) return;
        const p = (r.top + r.height / 2 - window.innerHeight / 2) / window.innerHeight; // -0.5 … 0.5
        img.style.setProperty('--py', `${(p * -28).toFixed(2)}px`);
      });
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  };

  /* ── 6. Grain (Kage's seeded canvas noise) ───────────────────────── */
  const makeGrain = () => {
    const el = $('#grain');
    if (!el) return;
    const S = 180, c = document.createElement('canvas');
    c.width = c.height = S;
    const ctx = c.getContext('2d');
    const im = ctx.createImageData(S, S), d = im.data;
    let seed = 9;
    const rand = () => { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    for (let i = 0; i < S * S; i++) { const v = 110 + rand() * 90; d[i * 4] = d[i * 4 + 1] = d[i * 4 + 2] = v; d[i * 4 + 3] = 255; }
    ctx.putImageData(im, 0, 0);
    el.style.backgroundImage = `url(${c.toDataURL()})`;
  };

  /* ── 1. Preloader ────────────────────────────────────────────────── */
  const runPreloader = (onDone) => {
    const pre = $('#pre'), fill = $('#pre-fill'), pct = $('#pre-pct');
    if (!pre) { onDone(); return; }
    if (REDUCE) { pre.classList.add('done'); document.body.classList.remove('is-locked'); onDone(); return; }
    document.body.classList.add('is-locked');
    const start = performance.now();
    let progress = 0, ready = false, finished = false;

    const media = $('.hero__slide.is-active .hero__media') || $('.hero__media');
    const markReady = () => { ready = true; };
    if (media) {
      if (media.tagName === 'VIDEO') { if (media.readyState >= 3) markReady(); else media.addEventListener('canplay', markReady, { once: true }); }
      else if (media.complete) markReady(); else media.addEventListener('load', markReady, { once: true });
    } else markReady();
    setTimeout(markReady, 2200); // never hold the page hostage

    const finish = () => {
      if (finished) return;
      finished = true;
      pre.classList.add('done');
      document.body.classList.remove('is-locked');
      onDone();
    };
    const step = () => {
      const elapsed = performance.now() - start;
      const cap = ready ? 100 : 88;
      progress = Math.min(cap, progress + (cap - progress) * 0.085 + 0.4);
      fill.style.right = `${100 - progress}%`;
      pct.textContent = `${Math.round(progress)}%`;
      if (progress >= 99.5 && elapsed > 1100) { fill.style.right = '0%'; pct.textContent = '100%'; setTimeout(finish, 260); return; }
      requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
    setTimeout(finish, 3600); // hard stop: rAF can be throttled in background tabs
  };

  const init = () => {
    if (REDUCE) { $('#pre')?.classList.add('done'); $$(WORD_TARGETS).forEach((h) => h.classList.add('rv-in')); return; }
    const revealHero = wireHeroWords();
    makeGrain();
    wireReveals();
    startParallax();
    runPreloader(() => { document.body.classList.add('is-ready'); revealHero(); });
  };

  document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', init) : init();
})();
