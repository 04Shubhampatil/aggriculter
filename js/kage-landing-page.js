/* =====================================================================
   KageLandingPage — vanilla port of the ThreeUI React component
   ---------------------------------------------------------------------
   Faithful to the registered sources (ThreeUI source bundle
   `kage-landing-page`):

     src/shaders/landing-pages/LandingPages.tsx     → KageLandingPage()
     src/shaders/landing-pages/LandingPageFrame.tsx → the sandboxed <iframe>
     src/shaders/landing-pages/pageTypography.ts    → usePageTypography(),
                                                      applyPageCustomization(),
                                                      postPageCustomization()
     src/shaders/landing-pages/pageRecipes.ts       → KAGE_TYPOGRAPHY, px(), n()

   The packaged document `landing-pages/kage.html` is served byte-exact
   (SHA-256 c8e06b90397a…) and is never rewritten: the typography and colour
   controls are one <style> appended to the frame's own <head> after load,
   exactly as the React frame does it. No React is used in this project.
   ===================================================================== */
(() => {
  'use strict';

  /* ── pageRecipes.ts helpers ──────────────────────────────────────── */
  const n = (value) => Number(value.toFixed(3));
  const px = (value) => `${n(value)}px`;

  /* ── fonts (pageRecipes.ts / pageTypography.ts) ──────────────────── */
  const ONEST = { value: 'onest', label: 'Onest', stack: "'Onest', system-ui, -apple-system, 'Helvetica Neue', sans-serif" };
  const INSTRUMENT_SERIF = { value: 'instrument-serif', label: 'Instrument Serif', stack: '"Instrument Serif", Georgia, serif', google: 'Instrument+Serif' };
  const NEWSREADER = { value: 'newsreader', label: 'Newsreader', stack: '"Newsreader", Georgia, serif', google: 'Newsreader:wght@200..700' };
  const GEIST = { value: 'geist', label: 'Geist', stack: '"Geist", system-ui, -apple-system, "Segoe UI", Helvetica, Arial, sans-serif', google: 'Geist:wght@100..900' };

  /* ── KAGE_TYPOGRAPHY recipe (pageRecipes.ts) ─────────────────────── */
  const KAGE_TYPOGRAPHY = {
    headingFonts: [ONEST, INSTRUMENT_SERIF, NEWSREADER, GEIST],
    bodyFonts: [ONEST, GEIST, NEWSREADER, INSTRUMENT_SERIF],
    headingWeights: ['400', '500', '600', '700'],
    headingWeight: '400',
    bodyWeights: ['300', '400', '500', '600'],
    bodyWeight: '300',
    primaryColor: '#e0231c',
    headingSize: [30, 46, 72],
    bodySize: [13, 17, 24],
    headingLetterSpacing: [-0.06, -0.012, 0.12],
    css: (type) => `
:root {
  --vermilion: ${type.primary};
  --ember: ${type.retone('#ff5a3c')};
}
body { font-family: ${type.body}; }
body, .body, .body-lg, .num { font-weight: ${type.bodyWeight}; }
h1:not(.jp), h2:not(.jp), h3:not(.jp), .display:not(.jp) {
  font-family: ${type.heading};
  font-weight: ${type.headingWeight};
}
.display { letter-spacing: ${type.headingLetterSpacing}em; }
.h-hero { font-size: clamp(26px, 3.05vw, ${px(type.headingSize)}); }
.h-sec { font-size: clamp(30px, 4vw, ${px((type.headingSize * 60) / 46)}); }
.body-lg { font-size: clamp(14px, 1.02vw, ${px(type.bodySize)}); }
.body { font-size: ${px(Math.max(11, type.bodySize - 3))}; }
`,
  };

  /* ── colour maths (pageTypography.ts) ────────────────────────────── */
  const clamp01 = (value) => Math.min(1, Math.max(0, value));

  function normalizeHex(value, fallback) {
    if (typeof value !== 'string') return fallback;
    const match = value.trim().match(/^#([\da-f]{3}|[\da-f]{6})$/i);
    if (!match) return fallback;
    const digits = match[1].toLowerCase();
    return `#${digits.length === 3 ? digits.replace(/./g, (d) => d + d) : digits}`;
  }

  function hexToHsl(hex) {
    const [red, green, blue] = [1, 3, 5].map((index) => Number.parseInt(hex.slice(index, index + 2), 16) / 255);
    const max = Math.max(red, green, blue);
    const min = Math.min(red, green, blue);
    const l = (max + min) / 2;
    const delta = max - min;
    if (delta === 0) return { h: 0, s: 0, l };
    const s = delta / (1 - Math.abs(2 * l - 1));
    const base = max === red
      ? ((green - blue) / delta) % 6
      : max === green ? (blue - red) / delta + 2 : (red - green) / delta + 4;
    return { h: (base * 60 + 360) % 360, s, l };
  }

  function hslToRgb({ h, s, l }) {
    const c = (1 - Math.abs(2 * l - 1)) * s;
    const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
    const m = l - c / 2;
    const [r, g, b] = h < 60 ? [c, x, 0]
      : h < 120 ? [x, c, 0]
      : h < 180 ? [0, c, x]
      : h < 240 ? [0, x, c]
      : h < 300 ? [x, 0, c]
      : [c, 0, x];
    return [r + m, g + m, b + m].map((channel) => Math.round(clamp01(channel) * 255));
  }

  const hslToHex = (hsl) => `#${hslToRgb(hsl).map((channel) => channel.toString(16).padStart(2, '0')).join('')}`;

  function colorShift(base, target) {
    const from = hexToHsl(base);
    const to = hexToHsl(target);
    return {
      hue: to.h - from.h,
      saturation: from.s > 0.01 ? Math.min(3, to.s / from.s) : 1,
      lightness: from.l > 0.01 ? Math.min(3, to.l / from.l) : 1,
    };
  }

  /* ── option resolution (pageTypography.ts) ───────────────────────── */
  const selectFont = (value, options) => options.find((option) => option.value === value) ?? options[0];
  const selectWeight = (value, options, fallback) => (options.includes(value) ? value : fallback);
  const clampRange = (value, [min, fallback, max]) => (Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback);

  function fontHrefFor(fonts) {
    const families = [...new Set(fonts.map((font) => font.google).filter(Boolean))];
    if (!families.length) return undefined;
    return `https://fonts.googleapis.com/css2?${families.map((family) => `family=${family}`).join('&')}&display=swap`;
  }

  /* usePageTypography(recipe, props) → LandingPageCustomization */
  function pageTypography(recipe, props) {
    const { headingFont, bodyFont, headingWeight, bodyWeight, primaryColor, headingSize, bodySize, headingLetterSpacing } = props;
    const heading = selectFont(headingFont, recipe.headingFonts);
    const body = selectFont(bodyFont, recipe.bodyFonts);
    const primary = normalizeHex(primaryColor, recipe.primaryColor);
    const untouched = primary === recipe.primaryColor;
    const shift = colorShift(recipe.primaryColor, primary);

    const retone = (hex) => {
      if (untouched) return hex;
      const source = hexToHsl(normalizeHex(hex, hex));
      return hslToHex({
        h: (source.h + shift.hue + 360) % 360,
        s: clamp01(source.s * shift.saturation),
        l: clamp01(source.l * shift.lightness),
      });
    };

    const retoneRgba = (color) => {
      if (untouched) return color;
      const match = color.match(/^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)\s*(?:[,/]\s*([\d.]+%?)\s*)?\)$/i);
      if (!match) return color;
      const hex = `#${[match[1], match[2], match[3]].map((channel) => Math.round(Number(channel)).toString(16).padStart(2, '0')).join('')}`;
      const [red, green, blue] = [1, 3, 5].map((index) => Number.parseInt(retone(hex).slice(index, index + 2), 16));
      return match[4] === undefined ? `rgb(${red}, ${green}, ${blue})` : `rgba(${red}, ${green}, ${blue}, ${match[4]})`;
    };

    const filter = (baseHex = recipe.primaryColor) => {
      if (untouched) return 'none';
      const local = colorShift(baseHex, retone(baseHex));
      return [
        `hue-rotate(${local.hue.toFixed(2)}deg)`,
        `saturate(${Math.max(0, local.saturation).toFixed(3)})`,
        `brightness(${Math.min(2, Math.max(0.2, local.lightness)).toFixed(3)})`,
      ].join(' ');
    };

    const type = {
      heading: heading.stack,
      body: body.stack,
      headingWeight: selectWeight(headingWeight, recipe.headingWeights, recipe.headingWeight),
      bodyWeight: selectWeight(bodyWeight, recipe.bodyWeights, recipe.bodyWeight),
      primary,
      headingSize: clampRange(headingSize, recipe.headingSize),
      bodySize: clampRange(bodySize, recipe.bodySize),
      headingLetterSpacing: clampRange(headingLetterSpacing, recipe.headingLetterSpacing),
      retone,
      retoneRgba,
      filter,
    };

    return { css: recipe.css(type), fontHref: fontHrefFor([heading, body]), inlineStyles: recipe.inlineStyles?.(type) };
  }

  /* ── injection (pageTypography.ts) ───────────────────────────────── */
  const STYLE_ID = 'threeui-page-typography';
  const FONT_LINK_ID = 'threeui-page-typography-fonts';
  const MESSAGE_TYPE = 'threeui-page-customization';

  function postPageCustomization(frame, customization) {
    frame?.contentWindow?.postMessage({ type: MESSAGE_TYPE, css: customization?.css ?? '', fontHref: customization?.fontHref }, '*');
  }

  /* Appended to the frame's own head rather than written into the document,
     so the packaged file stays byte-exact. Re-appending keeps the sheet last
     in the head so it wins at equal specificity without a single !important. */
  function applyPageCustomization(frame, customization) {
    let frameDocument = null;
    try { frameDocument = frame?.contentDocument; } catch { /* cross-origin frame: handled by postMessage */ }
    if (!frameDocument?.head) return;

    const existingLink = frameDocument.getElementById(FONT_LINK_ID);
    if (customization?.fontHref) {
      const link = existingLink ?? frameDocument.createElement('link');
      link.id = FONT_LINK_ID;
      link.rel = 'stylesheet';
      if (link.getAttribute('href') !== customization.fontHref) link.href = customization.fontHref;
      if (!existingLink) frameDocument.head.append(link);
    } else {
      existingLink?.remove();
    }

    if (!customization?.css) {
      frameDocument.getElementById(STYLE_ID)?.remove();
      return;
    }

    const style = frameDocument.getElementById(STYLE_ID) ?? frameDocument.createElement('style');
    style.id = STYLE_ID;
    if (style.textContent !== customization.css) style.textContent = customization.css;
    frameDocument.head.append(style);

    for (const override of customization.inlineStyles ?? []) {
      for (const element of frameDocument.querySelectorAll(override.selector)) {
        for (const [property, value] of Object.entries(override.styles)) element.style.setProperty(property, value);
      }
    }
  }

  /* ── background presentation (LandingPageFrame.tsx) ──────────────── */
  const BACKGROUND_PRESENTATION_STYLE_ID = 'threeui-background-presentation';

  /* Reuse a complete page as a scene-only background: the document stays
     untouched on disk; its UI is suppressed only inside this frame. */
  function applyBackgroundPresentation(frame, backgroundCanvasSelector, backgroundVisualSelector) {
    let doc = null;
    try { doc = frame?.contentDocument; } catch { /* cross-origin */ }
    if (!doc) return;

    doc.getElementById(BACKGROUND_PRESENTATION_STYLE_ID)?.remove();
    doc.querySelectorAll('[data-threeui-background-layer]').forEach((element) => {
      element.removeAttribute('data-threeui-background-layer');
      element.removeAttribute('data-threeui-background-fill');
    });

    if (!backgroundCanvasSelector) {
      doc.documentElement.removeAttribute('data-threeui-presentation');
      return;
    }

    const canvas = doc.querySelector(backgroundCanvasSelector);
    if (!canvas) return;

    canvas.setAttribute('data-threeui-background-layer', '');
    canvas.setAttribute('data-threeui-background-fill', '');
    if (backgroundVisualSelector) {
      doc.querySelectorAll(backgroundVisualSelector).forEach((element) => element.setAttribute('data-threeui-background-layer', ''));
    }

    doc.documentElement.setAttribute('data-threeui-presentation', 'background');
    const presentationStyle = doc.createElement('style');
    presentationStyle.id = BACKGROUND_PRESENTATION_STYLE_ID;
    presentationStyle.textContent = `
    html[data-threeui-presentation="background"],
    html[data-threeui-presentation="background"] body {
      width: 100% !important;
      height: 100% !important;
      min-height: 100% !important;
      overflow: hidden !important;
    }
    html[data-threeui-presentation="background"] body * {
      visibility: hidden !important;
      pointer-events: none !important;
    }
    html[data-threeui-presentation="background"] [data-threeui-background-layer],
    html[data-threeui-presentation="background"] [data-threeui-background-layer] * {
      visibility: visible !important;
    }
    html[data-threeui-presentation="background"] [data-threeui-background-fill] {
      position: fixed !important;
      inset: 0 !important;
      width: 100vw !important;
      height: 100vh !important;
      max-width: none !important;
      max-height: none !important;
      margin: 0 !important;
      transform: none !important;
    }
  `;
    doc.head.appendChild(presentationStyle);

    // The original renderer may have measured a section-sized canvas.
    // Re-run its authored resize path after the layer becomes full-frame.
    frame.contentWindow?.requestAnimationFrame(() => {
      frame.contentWindow?.dispatchEvent(new Event('resize'));
    });
  }

  /* ── LandingPageFrame (LandingPageFrame.tsx) ─────────────────────── */
  const URL_FRAME_SANDBOX = 'allow-downloads allow-forms allow-modals allow-popups allow-same-origin allow-scripts';

  function LandingPageFrame({ mount, className = '', customization, sourceUrl, title, style = {}, backgroundCanvasSelector, backgroundVisualSelector, applyScene }) {
    const wrapper = document.createElement('div');
    wrapper.className = `threeui-background landing-page-frame${className ? ` ${className}` : ''}`;
    wrapper.dataset.state = 'loading';
    Object.assign(wrapper.style, { position: 'relative', overflow: 'hidden', background: '#080808', pointerEvents: 'auto' }, style);

    const frame = document.createElement('iframe');
    frame.title = title;
    frame.src = sourceUrl;
    frame.setAttribute('sandbox', URL_FRAME_SANDBOX);
    frame.loading = 'eager';
    // A background presentation begins life as the complete source page. Keep it
    // sealed until load has installed the scene-only CSS so its UI never flashes.
    const sealed = Boolean(backgroundCanvasSelector);
    Object.assign(frame.style, { position: 'absolute', inset: '0', display: 'block', width: '100%', height: '100%', border: '0', background: '#080808', opacity: sealed ? '0' : '1', pointerEvents: sealed ? 'none' : 'auto' });
    frame.addEventListener('load', () => {
      applyPageCustomization(frame, customization);
      postPageCustomization(frame, customization);
      applyBackgroundPresentation(frame, backgroundCanvasSelector, backgroundVisualSelector);
      applyScene?.(frame);
      wrapper.dataset.state = 'ready';
      frame.style.opacity = '1';
      frame.style.pointerEvents = 'auto';
    });

    wrapper.appendChild(frame);
    mount.appendChild(wrapper);

    // Same contract as the React effect: re-apply when the customization changes.
    return {
      element: wrapper,
      frame,
      update(nextCustomization) {
        customization = nextCustomization;
        applyPageCustomization(frame, customization);
        postPageCustomization(frame, customization);
        applyBackgroundPresentation(frame, backgroundCanvasSelector, backgroundVisualSelector);
        applyScene?.(frame);
      },
    };
  }

  /* ── KageLandingPage (LandingPages.tsx) ──────────────────────────── */
  const TYPOGRAPHY_KEYS = ['headingFont', 'bodyFont', 'headingWeight', 'bodyWeight', 'primaryColor', 'headingSize', 'bodySize', 'headingLetterSpacing'];

  function splitTypographyProps(props) {
    const type = {};
    const rest = {};
    for (const [key, value] of Object.entries(props)) (TYPOGRAPHY_KEYS.includes(key) ? type : rest)[key] = value;
    return [type, rest];
  }

  function KageLandingPage(props = {}) {
    const [type, frame] = splitTypographyProps(props);
    const customization = pageTypography(KAGE_TYPOGRAPHY, type);
    const instance = LandingPageFrame({
      ...frame,
      customization,
      title: 'Kage — Where stillness reveals the unseen',
      sourceUrl: frame.sourceUrl || 'landing-pages/kage.html',
    });
    instance.setTypography = (nextType) => instance.update(pageTypography(KAGE_TYPOGRAPHY, { ...type, ...nextType }));
    return instance;
  }

  window.ThreeUI = Object.assign(window.ThreeUI || {}, { KageLandingPage, LandingPageFrame, KAGE_TYPOGRAPHY, pageTypography, applyPageCustomization, applyBackgroundPresentation });
})();
