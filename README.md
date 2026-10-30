# KisanKart — Agriculture E-commerce Demo

A premium, responsive agriculture storefront built with **HTML5, CSS3 and vanilla JavaScript (ES6+)** — no frameworks, no build step. The structure and shopping flow are inspired by Indian agri-input marketplaces; all branding, data and code are original.

> **Demo data notice:** every product, price, discount, rating, review count and brand name is sample data for demonstration only. Nothing is live or verified. Checkout does not place orders or collect payment.

## Run it

Open `index.html` directly in a browser, or serve the folder:

```bash
npx serve .
```

Product photos are loaded from Unsplash (license-free). If an image fails to load (offline, blocked), a local SVG placeholder is swapped in automatically.

## Project structure

```
index.html            Page markup — all sections, drawers, modals
css/style.css         Design tokens (:root), mobile-first layout, components, breakpoints
js/data.js            Shared dataset: PRODUCTS, CATEGORIES, CROPS, HERO_SLIDES, SOLUTIONS, BRANDS, ARTICLES
js/main.js            State (localStorage), rendering, shop/search/filter/sort, overlays, carousel, events
assets/images/        logo.svg, placeholder.svg
```

## Implemented features

**Homepage sections** — announcement bar · sticky header with search · 12-category navigation (desktop dropdowns, mobile drawer) · 3-slide hero carousel · shop by category · promotional banner · today's best deals · shop by crop · best sellers · farming solutions · brands row · knowledge articles · service benefits · newsletter · footer.

**Working interactions**
- Search with live suggestions (categories, crops, products), keyboard navigation, results view and empty state
- Category, crop and collection (deals / best sellers) filtering with removable filter chips
- Sorting by popularity, price (asc/desc), discount and rating
- Cart drawer: add, remove, quantity +/−, undo, clear, accurate subtotal / savings / total
- Wishlist drawer with toggle on every card and in quick view
- Cart and wishlist persisted to `localStorage` (validated on load; corrupt data is discarded)
- Product quick-view modal
- Hero carousel: prev/next, dots, autoplay with pause button, pause on hover/focus/hidden tab, swipe, reduced-motion aware
- Mobile navigation with collapsible sub-menus
- Newsletter email validation with error associated to the input
- Toast notifications (with "View cart" / "Undo" actions)
- Back-to-top button, sticky header shadow, scroll-reveal via IntersectionObserver
- Focus trap + Escape to close for all drawers/modals; focus returns to the trigger

**Accessibility** — semantic landmarks, skip link, labelled icon buttons, `aria-expanded`/`aria-pressed`/`aria-live` where relevant, visible focus rings, 44px touch targets, `prefers-reduced-motion` support.

**Performance** — lazy-loaded below-the-fold images, `fetchpriority="high"` on the first hero image, fixed aspect ratios to prevent layout shift, one passive scroll listener, event delegation for all product cards, no external JS dependencies (only the Inter web font).

## Design language

Rounded white shell on a sage canvas, deep-forest hero card, lime accent (`#C9F25A`), pill controls, outlined section labels, dark bento tiles and a featured deal tile. Display type is Bricolage Grotesque, body is Outfit. The homepage hero reuses the ThreeUI Kage document as a scene-only background (`backgroundCanvasSelector: '#gl'`), so the live Three.js temple world animates behind the campaign copy; the document's own UI and wordmark are suppressed inside the frame only.

## Kage landing page (ThreeUI `<KageLandingPage />`)

`kage.html` hosts the ThreeUI Kage temple experience, ported from the registered source bundle `kage-landing-page` without React:

- `landing-pages/kage.html` — canonical document, byte-exact (SHA-256 `c8e06b90397a…`), served inside a sandboxed iframe exactly as `LandingPageFrame.tsx` does
- `landing-pages/secret-pathways-assets/` — `fonts.css`, `three.min.js` and the 14 `.webp` assets, every hash verified against the bundle
- `js/kage-landing-page.js` — vanilla port of `KageLandingPage`, `LandingPageFrame`, `usePageTypography` and the `KAGE_TYPOGRAPHY` recipe; the configured props (Onest 400/300, `#e0231c`, 46/17, −0.012em) are applied as one stylesheet appended to the frame's `<head>`
- `css/threeui.css` — the shared ThreeUI stylesheet

It must be served over HTTP (same origin) for the frame customization to apply.

## Customising

- **Products / categories / crops:** edit `js/data.js`. Each product needs `id, name, brand, category, crops, price, mrp, rating, reviews, image, pack, description, popularity, deal, bestSeller`.
- **Colours / spacing / type:** edit the tokens at the top of `css/style.css`.
- **Images:** drop files into `assets/images/` and point `image` fields at them.

## Known limitations

- No backend: no authentication, real checkout, order tracking or email sending.
- Sub-category links filter by their parent category (sub-categories are illustrative).
- Articles open a short summary modal; full article pages are not included.
- Product photography is generic stock imagery, not actual product packaging.
