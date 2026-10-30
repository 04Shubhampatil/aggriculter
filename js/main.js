/* =====================================================================
   KisanKart — main.js
   ---------------------------------------------------------------------
   Structure:
     1. Utilities & formatting
     2. Persistent state (cart / wishlist in localStorage)
     3. Rendering functions (pure DOM builders)
     4. Shop / search / filter / sort
     5. Overlays (drawers, modals, toasts)
     6. Hero carousel
     7. Event wiring (delegated) & init
   ===================================================================== */
(() => {
  'use strict';

  /* ---------------------------------------------------------------
     1. Utilities
     --------------------------------------------------------------- */
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const PLACEHOLDER = 'assets/images/placeholder.svg';
  const REDUCED_MOTION = window.matchMedia('(prefers-reduced-motion: reduce)');

  const fmt = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });
  const rupee = (n) => fmt.format(n);
  const discountPct = (p) => Math.round(((p.mrp - p.price) / p.mrp) * 100);
  const escapeHtml = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const byId = (id) => PRODUCTS.find((p) => p.id === id);
  const catName = (slug) => (CATEGORIES.find((c) => c.slug === slug) || {}).name || slug;
  const cropName = (slug) => (CROPS.find((c) => c.slug === slug) || {}).name || slug;

  const debounce = (fn, ms = 150) => {
    let t;
    return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
  };

  const starsHtml = (rating) => {
    const full = Math.floor(rating);
    const half = rating - full >= 0.5 ? 1 : 0;
    return '★'.repeat(full) + (half ? '½' : '') + '☆'.repeat(5 - full - half);
  };

  /* ---------------------------------------------------------------
     2. Persistent state
     Both cart and wishlist are validated on load so that corrupted or
     stale localStorage never breaks rendering.
     --------------------------------------------------------------- */
  const STORAGE = { cart: 'kisankart.cart.v1', wishlist: 'kisankart.wishlist.v1' };

  const readStorage = (key, validator) => {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return validator(parsed) ? parsed : null;
    } catch {
      return null;
    }
  };
  const writeStorage = (key, value) => {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage unavailable (private mode / quota) — state stays in memory */ }
  };

  const isValidCart = (v) =>
    Array.isArray(v) && v.every((i) => i && typeof i.id === 'string' && Number.isInteger(i.qty) && i.qty > 0 && byId(i.id));
  const isValidWishlist = (v) => Array.isArray(v) && v.every((id) => typeof id === 'string' && byId(id));

  const state = {
    cart: readStorage(STORAGE.cart, isValidCart) || [],
    wishlist: readStorage(STORAGE.wishlist, isValidWishlist) || [],
    shop: { query: '', category: null, crop: null, collection: null, sort: 'popular' },
    lastFocus: null,
  };

  const saveCart = () => writeStorage(STORAGE.cart, state.cart);
  const saveWishlist = () => writeStorage(STORAGE.wishlist, state.wishlist);

  const cartQty = () => state.cart.reduce((n, i) => n + i.qty, 0);
  const cartSubtotal = () => state.cart.reduce((n, i) => n + byId(i.id).price * i.qty, 0);
  const cartMrpTotal = () => state.cart.reduce((n, i) => n + byId(i.id).mrp * i.qty, 0);
  const inWishlist = (id) => state.wishlist.includes(id);
  const inCart = (id) => state.cart.some((i) => i.id === id);

  /* ---------------------------------------------------------------
     3. Rendering
     --------------------------------------------------------------- */
  const productCard = (p) => {
    const pct = discountPct(p);
    return `
      <article class="product" data-id="${p.id}">
        <div class="product__media">
          <img class="product__img" src="${p.image}" alt="${escapeHtml(p.name)}" loading="lazy" width="400" height="400" />
          ${pct > 0 ? `<span class="product__badge">${pct}% OFF</span>` : ''}
          <button class="product__wish ${inWishlist(p.id) ? 'is-active' : ''}" type="button" data-action="wish" data-id="${p.id}"
            aria-pressed="${inWishlist(p.id)}" aria-label="${inWishlist(p.id) ? 'Remove from wishlist' : 'Add to wishlist'}: ${escapeHtml(p.name)}">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s-7-4.5-9-9a5 5 0 0 1 9-3 5 5 0 0 1 9 3c-2 4.5-9 9-9 9z"/></svg>
          </button>
          <button class="product__quick" type="button" data-action="quick" data-id="${p.id}">Quick view</button>
        </div>
        <div class="product__body">
          <span class="product__brand">${escapeHtml(p.brand)}</span>
          <h3 class="product__title"><button type="button" data-action="quick" data-id="${p.id}">${escapeHtml(p.name)}</button></h3>
          <div class="rating" aria-label="Rated ${p.rating} out of 5 by ${p.reviews} demo reviews">
            <span class="rating__stars" aria-hidden="true">${starsHtml(p.rating)}</span>
            <span>${p.rating} (${p.reviews.toLocaleString('en-IN')})</span>
          </div>
          <div class="product__price">
            <span class="price">${rupee(p.price)}</span>
            ${p.mrp > p.price ? `<span class="mrp"><span class="sr-only">Original price </span>${rupee(p.mrp)}</span>` : ''}
            ${p.mrp > p.price ? `<span class="save">You save ${rupee(p.mrp - p.price)}</span>` : ''}
          </div>
          <button class="btn btn--primary btn--sm product__cart ${inCart(p.id) ? 'is-added' : ''}" type="button" data-action="add" data-id="${p.id}">
            ${inCart(p.id) ? 'Added · Add more' : 'Add to cart'}
          </button>
        </div>
      </article>`;
  };

  /* Shared IntersectionObserver for sections (.reveal) and cards (.reveal-card). */
  const revealIO = ('IntersectionObserver' in window && !REDUCED_MOTION.matches)
    ? new IntersectionObserver((entries) => {
        entries.forEach((en) => {
          if (!en.isIntersecting) return;
          const el = en.target;
          el.classList.add('is-visible');
          revealIO.unobserve(el);
          // Cards drop the helper class once revealed so hover transforms are unaffected
          if (el.classList.contains('reveal-card')) setTimeout(() => el.classList.remove('reveal-card', 'is-visible'), 900);
        });
      }, { rootMargin: '0px 0px -8% 0px', threshold: 0.05 })
    : null;

  /* Stagger-reveal the cards of a freshly rendered grid */
  const revealCards = (root) => {
    if (!revealIO) return;
    $$('.product', root).forEach((card, i) => {
      card.classList.add('reveal-card');
      card.style.setProperty('--i', Math.min(i, 11));
      revealIO.observe(card);
    });
  };

  const renderGrid = (el, products) => { el.innerHTML = products.map(productCard).join(''); revealCards(el); };

  const renderCategoryNav = () => {
    const chevron = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>';
    $('#catNav').innerHTML = CATEGORIES.map((c, i) => `
      <li class="catnav__item">
        <button class="catnav__link" type="button" data-action="catmenu" aria-expanded="false" aria-controls="catmenu-${i}" data-category="${c.slug}">
          ${escapeHtml(c.nav || c.name)} ${chevron}
        </button>
        <div class="catnav__menu" id="catmenu-${i}">
          <button class="catnav__all" type="button" data-category="${c.slug}">All ${escapeHtml(c.name)}</button>
          ${c.sub.map((s) => `<button type="button" data-category="${c.slug}" data-sub="${escapeHtml(s)}">${escapeHtml(s)}</button>`).join('')}
        </div>
      </li>`).join('');

    $('#mobNavList').innerHTML = CATEGORIES.map((c, i) => `
      <li>
        <button class="mobnav__toggle" type="button" data-action="mobtoggle" aria-expanded="false" aria-controls="mobsub-${i}">
          <span class="mobnav__icon" aria-hidden="true">${c.icon}</span>${escapeHtml(c.name)} ${chevron}
        </button>
        <div class="mobnav__sub" id="mobsub-${i}"><div>
          <button class="mobnav__all" type="button" data-category="${c.slug}">All ${escapeHtml(c.name)}</button>
          ${c.sub.map((s) => `<button type="button" data-category="${c.slug}" data-sub="${escapeHtml(s)}">${escapeHtml(s)}</button>`).join('')}
        </div></div>
      </li>`).join('');

    $('#footerCategories').innerHTML = CATEGORIES.map((c) => `<li><button type="button" class="link" data-category="${c.slug}">${escapeHtml(c.name)}</button></li>`).join('');
  };

  const renderCategoryCards = () => {
    $('#categoryCards').innerHTML = CATEGORIES.map((c) => `
      <button class="cat-card" type="button" role="listitem" data-category="${c.slug}">
        <img class="cat-card__img" src="${c.image}" alt="" loading="lazy" width="300" height="300" />
        <span class="cat-card__name">${escapeHtml(c.name)}</span>
      </button>`).join('');
  };

  const renderCrops = () => {
    $('#cropCards').innerHTML = CROPS.map((c) => {
      const count = PRODUCTS.filter((p) => p.crops.includes(c.slug)).length;
      return `
      <button class="crop-card" type="button" role="listitem" data-crop="${c.slug}" aria-label="${escapeHtml(c.name)}: ${count} products">
        <span class="crop-card__icon" aria-hidden="true">${c.icon}</span>
        <span>${escapeHtml(c.name)}</span>
        <span class="crop-card__count" aria-hidden="true">${count} products</span>
      </button>`;
    }).join('');
  };

  const renderSolutions = () => {
    $('#solutionCards').innerHTML = SOLUTIONS.map((s) => `
      <button class="solution" type="button" data-category="${s.category}">
        <span class="solution__icon" aria-hidden="true">${s.svg}</span>
        <h3>${escapeHtml(s.title)}</h3>
        <p>${escapeHtml(s.text)}</p>
        <span class="solution__link">Browse →</span>
      </button>`).join('');
  };

  const renderStats = () => {
    const el = $('#statsRow');
    if (!el) return;
    const avg = (PRODUCTS.reduce((n, p) => n + p.rating, 0) / PRODUCTS.length).toFixed(1);
    const reviews = PRODUCTS.reduce((n, p) => n + p.reviews, 0);
    const maxOff = Math.max(...PRODUCTS.map(discountPct));
    const stats = [
      { value: `${PRODUCTS.length}+`, label: 'Demo products listed' },
      { value: reviews.toLocaleString('en-IN'), label: 'Sample reviews (demo)' },
      { value: `${avg}★`, label: 'Average demo rating' },
      { value: `${maxOff}%`, label: 'Top discount today' },
    ];
    el.innerHTML = stats.map((s) => `<li><b>${s.value}</b><span>${escapeHtml(s.label)}</span></li>`).join('');
  };

  const renderBrands = () => {
    $('#brandRow').innerHTML = BRANDS.map((b) => `<div class="brand-chip">${escapeHtml(b)}</div>`).join('');
  };

  const renderArticles = () => {
    $('#articleCards').innerHTML = ARTICLES.map((a, i) => `
      <article class="article">
        <img class="article__img" src="${a.image}" alt="" loading="lazy" width="800" height="500" />
        <div class="article__body">
          <div class="article__meta"><b>${escapeHtml(a.tag)}</b><span>${a.time}</span></div>
          <h3>${escapeHtml(a.title)}</h3>
          <p>${escapeHtml(a.text)}</p>
          <button class="article__link" type="button" data-info="article" data-index="${i}">Read article →</button>
        </div>
      </article>`).join('');
  };

  /* Cart drawer */
  const renderCart = () => {
    const items = $('#cartItems');
    const qty = cartQty();
    $('#cartTitleCount').textContent = qty ? `(${qty} item${qty > 1 ? 's' : ''})` : '';
    $('#cartFoot').hidden = qty === 0;

    if (!qty) {
      items.innerHTML = `<div class="drawer__empty"><span class="empty__icon" aria-hidden="true">🛒</span><p>Your cart is empty.</p><p>Add seeds, nutrition or equipment to get started.</p></div>`;
    } else {
      items.innerHTML = state.cart.map((i) => {
        const p = byId(i.id);
        return `
        <div class="cart-item" data-id="${p.id}">
          <img class="cart-item__img" src="${p.image}" alt="" width="72" height="72" loading="lazy" />
          <div>
            <div class="cart-item__brand">${escapeHtml(p.brand)}</div>
            <div class="cart-item__title">${escapeHtml(p.name)}</div>
            <div class="cart-item__row">
              <div class="qty" aria-label="Quantity for ${escapeHtml(p.name)}">
                <button type="button" data-action="dec" data-id="${p.id}" aria-label="Decrease quantity">−</button>
                <span aria-live="polite">${i.qty}</span>
                <button type="button" data-action="inc" data-id="${p.id}" aria-label="Increase quantity">+</button>
              </div>
              <span class="cart-item__price">${rupee(p.price * i.qty)}</span>
            </div>
            <button class="cart-item__remove" type="button" data-action="remove" data-id="${p.id}">Remove</button>
          </div>
        </div>`;
      }).join('');
    }

    const subtotal = cartSubtotal();
    $('#cartSubtotal').textContent = rupee(subtotal);
    $('#cartSavings').textContent = rupee(cartMrpTotal() - subtotal);
    $('#cartDelivery').textContent = subtotal >= 999 ? 'Free (demo)' : 'Calculated at checkout';
    $('#cartTotal').textContent = rupee(subtotal);
    updateBadge('#cartCount', qty);
  };

  const renderWishlist = () => {
    const el = $('#wishlistItems');
    const n = state.wishlist.length;
    $('#wlTitleCount').textContent = n ? `(${n})` : '';
    if (!n) {
      el.innerHTML = `<div class="drawer__empty"><span class="empty__icon" aria-hidden="true">♡</span><p>Nothing saved yet.</p><p>Tap the heart on any product to keep it here.</p></div>`;
    } else {
      el.innerHTML = state.wishlist.map((id) => {
        const p = byId(id);
        return `
        <div class="cart-item" data-id="${p.id}">
          <img class="cart-item__img" src="${p.image}" alt="" width="72" height="72" loading="lazy" />
          <div>
            <div class="cart-item__brand">${escapeHtml(p.brand)}</div>
            <div class="cart-item__title">${escapeHtml(p.name)}</div>
            <div class="cart-item__row">
              <span class="cart-item__price">${rupee(p.price)}</span>
              <button class="btn btn--primary btn--sm" type="button" data-action="add" data-id="${p.id}">Add to cart</button>
            </div>
            <button class="cart-item__remove" type="button" data-action="wish" data-id="${p.id}">Remove</button>
          </div>
        </div>`;
      }).join('');
    }
    updateBadge('#wishlistCount', n);
  };

  const updateBadge = (sel, n) => {
    const b = $(sel);
    b.textContent = n;
    b.classList.toggle('is-visible', n > 0);
    b.classList.remove('bump');
    void b.offsetWidth; // restart animation
    if (n > 0) b.classList.add('bump');
  };

  /* Keep card buttons in sync without re-rendering whole grids */
  const syncProductButtons = (id) => {
    $$(`.product[data-id="${id}"]`).forEach((card) => {
      const wish = $('.product__wish', card);
      const on = inWishlist(id);
      wish.classList.toggle('is-active', on);
      wish.setAttribute('aria-pressed', on);
      wish.setAttribute('aria-label', `${on ? 'Remove from wishlist' : 'Add to wishlist'}: ${byId(id).name}`);
      const add = $('.product__cart', card);
      add.classList.toggle('is-added', inCart(id));
      add.textContent = inCart(id) ? 'Added · Add more' : 'Add to cart';
    });
  };

  /* ---------------------------------------------------------------
     4. Shop: search, filters, sort
     --------------------------------------------------------------- */
  const SORTERS = {
    popular: (a, b) => b.popularity - a.popularity,
    'price-asc': (a, b) => a.price - b.price,
    'price-desc': (a, b) => b.price - a.price,
    discount: (a, b) => discountPct(b) - discountPct(a),
    rating: (a, b) => b.rating - a.rating || b.reviews - a.reviews,
  };

  const matchesQuery = (p, q) => {
    const hay = `${p.name} ${p.brand} ${catName(p.category)} ${p.crops.map(cropName).join(' ')} ${p.description}`.toLowerCase();
    return q.split(/\s+/).filter(Boolean).every((w) => hay.includes(w));
  };

  const filteredProducts = () => {
    const { query, category, crop, collection, sort } = state.shop;
    let list = PRODUCTS.slice();
    if (collection === 'deals') list = list.filter((p) => p.deal);
    if (collection === 'bestsellers') list = list.filter((p) => p.bestSeller);
    if (category) list = list.filter((p) => p.category === category);
    if (crop) list = list.filter((p) => p.crops.includes(crop));
    if (query) list = list.filter((p) => matchesQuery(p, query.toLowerCase()));
    return list.sort(SORTERS[sort] || SORTERS.popular);
  };

  const shopTitle = () => {
    const { query, category, crop, collection } = state.shop;
    if (query) return `Results for “${query}”`;
    if (category && crop) return `${catName(category)} for ${cropName(crop)}`;
    if (category) return catName(category);
    if (crop) return `Products for ${cropName(crop)}`;
    if (collection === 'deals') return "Today's best deals";
    if (collection === 'bestsellers') return 'Best sellers';
    return 'All products';
  };

  const closeIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>';

  const renderShop = ({ scroll = true } = {}) => {
    const section = $('#shop');
    const list = filteredProducts();
    const { query, category, crop, collection } = state.shop;

    section.hidden = false;
    $('#shopTitle').textContent = shopTitle();
    $('#shopCount').textContent = `${list.length} product${list.length === 1 ? '' : 's'}`;
    $('#sortSelect').value = state.shop.sort;

    const chips = [];
    if (query) chips.push({ key: 'query', label: `“${query}”` });
    if (category) chips.push({ key: 'category', label: catName(category) });
    if (crop) chips.push({ key: 'crop', label: `Crop: ${cropName(crop)}` });
    if (collection) chips.push({ key: 'collection', label: collection === 'deals' ? 'Deals' : 'Best sellers' });
    $('#shopChips').innerHTML = chips.map((c) => `
      <button class="chip" type="button" data-action="chip" data-key="${c.key}" aria-label="Remove filter ${escapeHtml(c.label)}">
        ${escapeHtml(c.label)} ${closeIcon}
      </button>`).join('');

    renderGrid($('#shopGrid'), list);
    $('#shopEmpty').hidden = list.length > 0;
    if (!list.length) {
      $('#shopEmptyLinks').innerHTML = CATEGORIES.slice(0, 5).map((c) => `<button class="btn btn--ghost btn--sm" type="button" data-category="${c.slug}">${escapeHtml(c.name)}</button>`).join('');
    }
    $$('.crop-card').forEach((el) => el.classList.toggle('is-active', el.dataset.crop === crop));

    if (scroll) section.scrollIntoView({ behavior: REDUCED_MOTION.matches ? 'auto' : 'smooth', block: 'start' });
  };

  const setShop = (patch, opts) => {
    Object.assign(state.shop, patch);
    renderShop(opts);
  };

  const clearShop = () => {
    state.shop = { query: '', category: null, crop: null, collection: null, sort: 'popular' };
    $('#searchInput').value = '';
    $('#shop').hidden = true;
    $$('.crop-card').forEach((el) => el.classList.remove('is-active'));
    $('#categories').scrollIntoView({ behavior: REDUCED_MOTION.matches ? 'auto' : 'smooth' });
  };

  /* Search suggestions */
  let suggestIndex = -1;
  const renderSuggestions = (q) => {
    const box = $('#searchSuggest');
    const input = $('#searchInput');
    const term = q.trim().toLowerCase();
    suggestIndex = -1;
    if (term.length < 2) { box.hidden = true; input.setAttribute('aria-expanded', 'false'); return; }

    const hi = (text) => escapeHtml(text).replace(new RegExp(`(${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'ig'), '<mark>$1</mark>');
    const terms = SEARCH_TERMS.filter((t) => t.label.toLowerCase().includes(term)).slice(0, 3);
    // Rank products whose name/brand match above those matching only in the description
    const nameHit = (p) => `${p.name} ${p.brand}`.toLowerCase().includes(term);
    const products = PRODUCTS.filter((p) => matchesQuery(p, term)).sort((a, b) => nameHit(b) - nameHit(a) || b.popularity - a.popularity).slice(0, 5);
    const items = [
      ...terms.map((t) => `<li role="option" data-type="${t.type}" data-slug="${t.slug}"><span class="sug__icon" aria-hidden="true">${t.type === 'crop' ? '🌾' : '📂'}</span><span>${hi(t.label)}</span><span class="sug__type">${t.type}</span></li>`),
      ...products.map((p) => `<li role="option" data-type="product" data-id="${p.id}"><img src="${p.image}" alt="" loading="lazy" width="36" height="36" /><span>${hi(p.name)}</span><span class="sug__type">${rupee(p.price)}</span></li>`),
    ];
    if (!items.length) items.push(`<li role="option" data-type="search" data-q="${escapeHtml(q)}"><span class="sug__icon" aria-hidden="true">🔍</span><span>Search for “${escapeHtml(q)}”</span></li>`);
    box.innerHTML = items.join('');
    box.hidden = false;
    input.setAttribute('aria-expanded', 'true');
  };

  const chooseSuggestion = (li) => {
    const { type, slug, id, q } = li.dataset;
    hideSuggestions();
    if (type === 'category') { $('#searchInput').value = ''; setShop({ query: '', category: slug, crop: null, collection: null }); }
    else if (type === 'crop') { $('#searchInput').value = ''; setShop({ query: '', crop: slug, category: null, collection: null }); }
    else if (type === 'product') { openQuickView(id); }
    else { setShop({ query: q, category: null, crop: null, collection: null }); }
  };

  const hideSuggestions = () => {
    $('#searchSuggest').hidden = true;
    $('#searchInput').setAttribute('aria-expanded', 'false');
    suggestIndex = -1;
  };

  /* ---------------------------------------------------------------
     5. Overlays: drawers, modals, toasts
     --------------------------------------------------------------- */
  const backdrop = $('#backdrop');
  let openOverlay = null;

  const focusableIn = (el) => $$('a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])', el).filter((n) => !n.hidden && n.offsetParent !== null);

  const openPanel = (id) => {
    if (openOverlay && openOverlay !== id) closePanel({ keepBackdrop: true });
    const el = $(`#${id}`);
    state.lastFocus = document.activeElement;
    openOverlay = id;
    el.hidden = false;
    backdrop.hidden = false;
    document.body.classList.add('no-scroll');
    void el.offsetWidth; // force reflow so the slide-in / fade transition runs from the hidden state
    el.classList.add('is-open');
    backdrop.classList.add('is-open');
    const trigger = $(`[aria-controls="${id}"]`);
    if (trigger) trigger.setAttribute('aria-expanded', 'true');
    const first = focusableIn(el)[0];
    setTimeout(() => (first || el).focus(), 60);
  };

  const closePanel = ({ keepBackdrop = false } = {}) => {
    if (!openOverlay) return;
    const el = $(`#${openOverlay}`);
    const id = openOverlay;
    openOverlay = null;
    el.classList.remove('is-open');
    const trigger = $(`[aria-controls="${id}"]`);
    if (trigger) trigger.setAttribute('aria-expanded', 'false');
    if (!keepBackdrop) {
      backdrop.classList.remove('is-open');
      document.body.classList.remove('no-scroll');
    }
    const done = () => { el.hidden = true; if (!keepBackdrop) backdrop.hidden = true; };
    REDUCED_MOTION.matches ? done() : setTimeout(done, 300);
    if (state.lastFocus && !keepBackdrop) state.lastFocus.focus();
  };

  /* Trap Tab inside the open overlay */
  const trapFocus = (e) => {
    if (e.key !== 'Tab' || !openOverlay) return;
    const nodes = focusableIn($(`#${openOverlay}`));
    if (!nodes.length) return;
    const first = nodes[0], last = nodes[nodes.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  };

  const openQuickView = (id) => {
    const p = byId(id);
    if (!p) return;
    const pct = discountPct(p);
    $('#qvContent').innerHTML = `
      <div class="qv">
        <img class="qv__img" src="${p.image.replace('w=640', 'w=800')}" alt="${escapeHtml(p.name)}" width="800" height="800" />
        <div>
          <span class="qv__brand">${escapeHtml(p.brand)} · ${escapeHtml(catName(p.category))}</span>
          <h2 class="qv__title" id="qvTitle">${escapeHtml(p.name)}</h2>
          <div class="rating" aria-label="Rated ${p.rating} out of 5 by ${p.reviews} demo reviews">
            <span class="rating__stars" aria-hidden="true">${starsHtml(p.rating)}</span>
            <span>${p.rating} · ${p.reviews.toLocaleString('en-IN')} demo reviews</span>
          </div>
          <div class="qv__price">
            <span class="price">${rupee(p.price)}</span>
            ${p.mrp > p.price ? `<span class="mrp">${rupee(p.mrp)}</span><span class="save">${pct}% off · save ${rupee(p.mrp - p.price)}</span>` : ''}
          </div>
          <p class="qv__desc">${escapeHtml(p.description)}</p>
          <div class="qv__meta">
            <span><b>Pack:</b> ${escapeHtml(p.pack)}</span>
            ${p.crops.length ? `<span><b>Suitable crops:</b> ${p.crops.map(cropName).join(', ')}</span>` : ''}
          </div>
          <div class="qv__actions">
            <button class="btn btn--primary" type="button" data-action="add" data-id="${p.id}">Add to cart</button>
            <button class="btn btn--ghost" type="button" data-action="wish" data-id="${p.id}" aria-pressed="${inWishlist(p.id)}">
              ${inWishlist(p.id) ? '♥ Saved' : '♡ Save to wishlist'}
            </button>
          </div>
          <p class="qv__note">Prices, ratings and reviews are sample data for demonstration only.</p>
        </div>
      </div>`;
    openPanel('quickView');
  };

  const INFO = {
    'Track order': 'Order tracking will be available once this demo is connected to an order backend.',
    Returns: 'Demo policy placeholder: unopened products can typically be returned within 7 days of delivery. Pesticides and seeds with broken seals are usually non-returnable.',
    Shipping: 'Delivery timelines depend on your pincode and will be confirmed at checkout when a backend is connected.',
    FAQ: 'Frequently asked questions will be listed here. For dosage or crop-specific guidance, always follow the product label.',
    Contact: 'This is a placeholder. Replace with your real support email, phone number and working hours.',
    'Privacy policy': 'Placeholder privacy policy. This demo stores only your cart and wishlist in your browser (localStorage) and sends nothing to a server.',
    'Terms of use': 'Placeholder terms of use for the KisanKart demo storefront.',
    'Refund policy': 'Placeholder refund policy. No payments are collected on this demo site.',
    'Pesticide safety': 'Always read the label, wear protective equipment, respect pre-harvest intervals and keep products away from children and animals.',
    Account: 'Sign in and account features are not part of this frontend demo. Your cart and wishlist are saved in this browser automatically.',
    Checkout: 'This demo does not process payments or place real orders. Connect a backend to complete checkout.',
    Social: 'Social profiles are placeholders in this demo. Replace these buttons with links to your real channels.',
  };

  const openInfo = (title, text) => {
    $('#infoTitle').textContent = title;
    $('#infoText').textContent = text;
    openPanel('infoModal');
  };

  /* Toasts */
  const toast = (message, { type = 'success', action, onAction, timeout = 3200 } = {}) => {
    const host = $('#toasts');
    const el = document.createElement('div');
    el.className = `toast toast--${type}`;
    el.setAttribute('role', 'status');
    el.innerHTML = `<span>${escapeHtml(message)}</span>${action ? `<button class="toast__action" type="button">${escapeHtml(action)}</button>` : ''}`;
    const remove = () => { el.classList.add('is-leaving'); setTimeout(() => el.remove(), 220); };
    if (action) $('.toast__action', el).addEventListener('click', () => { onAction?.(); remove(); }, { once: true });
    host.appendChild(el);
    while (host.children.length > 3) host.firstElementChild.remove();
    setTimeout(remove, timeout);
  };

  /* ---------------------------------------------------------------
     Cart & wishlist mutations
     --------------------------------------------------------------- */
  const addToCart = (id, qty = 1) => {
    const p = byId(id);
    if (!p) return;
    const line = state.cart.find((i) => i.id === id);
    if (line) line.qty += qty; else state.cart.push({ id, qty });
    saveCart();
    renderCart();
    syncProductButtons(id);
    toast(`${p.name.split('—')[0].trim()} added to cart`, { action: 'View cart', onAction: () => openPanel('cartDrawer') });
  };

  const setQty = (id, qty) => {
    const idx = state.cart.findIndex((i) => i.id === id);
    if (idx === -1) return;
    if (qty <= 0) {
      const [removed] = state.cart.splice(idx, 1);
      toast('Removed from cart', { type: 'info', action: 'Undo', onAction: () => { state.cart.splice(idx, 0, removed); saveCart(); renderCart(); syncProductButtons(id); } });
    } else {
      state.cart[idx].qty = Math.min(qty, 99);
    }
    saveCart();
    renderCart();
    syncProductButtons(id);
  };

  const toggleWishlist = (id) => {
    const p = byId(id);
    if (!p) return;
    const on = inWishlist(id);
    state.wishlist = on ? state.wishlist.filter((x) => x !== id) : [...state.wishlist, id];
    saveWishlist();
    renderWishlist();
    syncProductButtons(id);
    // keep the quick-view button label in sync if it is open
    const qvBtn = $('#qvContent [data-action="wish"]');
    if (qvBtn && qvBtn.dataset.id === id) { qvBtn.textContent = on ? '♡ Save to wishlist' : '♥ Saved'; qvBtn.setAttribute('aria-pressed', !on); }
    toast(on ? 'Removed from wishlist' : 'Saved to wishlist', { type: on ? 'info' : 'success' });
  };

  /* ---------------------------------------------------------------
     6. Hero carousel
     --------------------------------------------------------------- */
  // Slides only change on user action (arrows, numbers, swipe). Pressing the
  // play control starts the 6s auto-rotation; pressing it again stops it.
  const hero = { index: 0, timer: null, paused: false, userPaused: true, interval: 6000 };

  /* Last two words of a hero title get the lime accent */
  const accentTitle = (title) => {
    const words = escapeHtml(title).split(' ');
    const tail = words.splice(-2).join(' ');
    return `${words.join(' ')} <em>${tail}</em>`;
  };

  /* Slide media: a muted looping video (poster = still) or a still image.
     The first slide's media loads eagerly; the rest lazily. Videos only
     play while their slide is active (see goSlide) and never autoplay when
     the user prefers reduced motion. */
  const heroMedia = (s, i) => {
    if (s.video) {
      return `<video class="hero__media" muted loop playsinline preload="${i === 0 ? 'auto' : 'metadata'}" poster="${s.image}" aria-label="${escapeHtml(s.alt)}">
        <source src="${s.video}" type="video/mp4" />
      </video>`;
    }
    return `<img class="hero__media" src="${s.image}" alt="${escapeHtml(s.alt)}" width="1728" height="930" ${i === 0 ? 'fetchpriority="high"' : 'loading="lazy"'} />`;
  };

  const renderHero = () => {
    $('#heroTrack').innerHTML = HERO_SLIDES.map((s, i) => `
      <div class="hero__slide ${i === 0 ? 'is-active' : ''}" role="group" aria-roledescription="slide" aria-label="${i + 1} of ${HERO_SLIDES.length}" ${i !== 0 ? 'aria-hidden="true"' : ''}>
        ${heroMedia(s, i)}
        <div class="hero__scrim" aria-hidden="true"></div>
        <div class="container"><div class="hero__content">
          <span class="hero__tag">${escapeHtml(s.tag)}</span>
          <h${i === 0 ? 1 : 2} class="hero__title">${accentTitle(s.title)}</h${i === 0 ? 1 : 2}>
          <p class="hero__text">${escapeHtml(s.text)}</p>
          <div class="hero__cta">
            <button class="btn btn--accent btn--lg" type="button" data-category="${s.primary.category}">${escapeHtml(s.primary.label)}</button>
            <a class="btn btn--glass btn--lg" href="${s.secondary.target}">${escapeHtml(s.secondary.label)}</a>
          </div>
          <ul class="hero__stats" aria-label="Catalogue highlights">
            <li><b>${PRODUCTS.length}</b><span>demo products</span></li>
            <li><b>${CATEGORIES.length}</b><span>categories</span></li>
            <li><b>${CROPS.length}</b><span>crops covered</span></li>
          </ul>
        </div></div>
      </div>`).join('');
  };

  const goSlide = (n) => {
    const slides = $$('.hero__slide');
    hero.index = (n + slides.length) % slides.length;
    slides.forEach((s, i) => { s.classList.toggle('is-active', i === hero.index); s.setAttribute('aria-hidden', i !== hero.index); });
    syncHeroVideos();
    document.dispatchEvent(new CustomEvent('hero:slide', { detail: hero.index }));
  };

  /* Play only the active slide's video; pause the rest (and everything under reduced motion). */
  const syncHeroVideos = () => {
    $$('.hero__slide').forEach((slide, i) => {
      const video = $('video', slide);
      if (!video) return;
      if (i === hero.index && !REDUCED_MOTION.matches && !document.hidden) video.play().catch(() => {});
      else video.pause();
    });
  };

  const startHero = () => {
    stopHero();
    if (hero.userPaused || REDUCED_MOTION.matches || document.hidden) return;
    hero.timer = setInterval(() => goSlide(hero.index + 1), hero.interval);
  };
  const stopHero = () => { clearInterval(hero.timer); hero.timer = null; };

  /* ---------------------------------------------------------------
     7. Events & init
     --------------------------------------------------------------- */
  /* Dropdowns are position:fixed so they escape the chip row's horizontal
     scroll clipping. The header is their containing block (it always carries a
     backdrop-filter), so coordinates are measured from the header's box. */
  const positionCatMenu = (li) => {
    const menu = $('.catnav__menu', li);
    const header = $('#header').getBoundingClientRect();
    const item = li.getBoundingClientRect();
    const maxLeft = header.width - menu.offsetWidth - 8;
    li.style.setProperty('--mx', `${Math.round(Math.max(0, Math.min(item.left - header.left, maxLeft)))}px`);
    li.style.setProperty('--my', `${Math.round(item.bottom - header.top + 6)}px`);
  };

  const closeCatMenus = () => $$('.catnav__item.is-open').forEach((li) => { li.classList.remove('is-open'); $('.catnav__link', li).setAttribute('aria-expanded', 'false'); });

  const bindEvents = () => {
    /* Delegated click handler for the whole document */
    document.addEventListener('click', (e) => {
      const btn = e.target.closest('button, [data-category], [data-crop]');

      // Close desktop dropdowns when clicking elsewhere
      if (!e.target.closest('.catnav__item')) closeCatMenus();
      if (!e.target.closest('.search')) hideSuggestions();
      if (!btn) return;

      const { action, id } = btn.dataset;

      if (action === 'add') return addToCart(id);
      if (action === 'wish') return toggleWishlist(id);
      if (action === 'quick') return openQuickView(id);
      if (action === 'inc') return setQty(id, (state.cart.find((i) => i.id === id)?.qty || 0) + 1);
      if (action === 'dec') return setQty(id, (state.cart.find((i) => i.id === id)?.qty || 0) - 1);
      if (action === 'remove') return setQty(id, 0);

      if (action === 'catmenu') {
        const li = btn.closest('.catnav__item');
        const open = li.classList.contains('is-open');
        closeCatMenus();
        if (!open) { positionCatMenu(li); li.classList.add('is-open'); btn.setAttribute('aria-expanded', 'true'); }
        return;
      }
      if (action === 'mobtoggle') {
        const sub = $(`#${btn.getAttribute('aria-controls')}`);
        const open = sub.classList.toggle('is-open');
        btn.setAttribute('aria-expanded', open);
        return;
      }
      if (action === 'chip') {
        const key = btn.dataset.key;
        if (key === 'query') $('#searchInput').value = '';
        setShop({ [key]: key === 'query' ? '' : null }, { scroll: false });
        return;
      }

      if (btn.dataset.category !== undefined) {
        const sub = btn.dataset.sub;
        closeCatMenus();
        if (openOverlay === 'mobileNav') closePanel();
        $('#searchInput').value = '';
        setShop({ query: '', category: btn.dataset.category, crop: null, collection: null });
        if (sub) toast(`Showing all ${catName(btn.dataset.category)} — “${sub}” is a demo sub-category`, { type: 'info' });
        return;
      }
      if (btn.dataset.crop !== undefined) {
        $('#searchInput').value = '';
        setShop({ query: '', crop: btn.dataset.crop, category: null, collection: null });
        return;
      }
      if (btn.dataset.shop) {
        $('#searchInput').value = '';
        setShop({ query: '', category: null, crop: null, collection: btn.dataset.shop });
        return;
      }
      if (btn.dataset.info) {
        if (btn.dataset.info === 'article') {
          const a = ARTICLES[Number(btn.dataset.index)];
          return openInfo(a.title, `${a.text} Full articles are not included in this frontend demo.`);
        }
        return openInfo(btn.textContent.trim(), INFO[btn.dataset.info] || 'Content placeholder.');
      }
      if (btn.dataset.close) return closePanel();
      if (btn.dataset.slide !== undefined) { goSlide(Number(btn.dataset.slide)); startHero(); }
    });

    $('#accountBtn').addEventListener('click', () => openInfo('Account', INFO.Account));
    $('#cartBtn').addEventListener('click', () => (openOverlay === 'cartDrawer' ? closePanel() : openPanel('cartDrawer')));
    $('#wishlistBtn').addEventListener('click', () => (openOverlay === 'wishlistDrawer' ? closePanel() : openPanel('wishlistDrawer')));
    $('#menuBtn').addEventListener('click', () => openPanel('mobileNav'));
    backdrop.addEventListener('click', () => closePanel());
    $$('.modal').forEach((m) => m.addEventListener('click', (e) => { if (e.target === m) closePanel(); }));
    $('#checkoutBtn').addEventListener('click', () => openInfo('Checkout', INFO.Checkout));
    $('#clearCartBtn').addEventListener('click', () => {
      const backup = state.cart.slice();
      state.cart = []; saveCart(); renderCart(); backup.forEach((i) => syncProductButtons(i.id));
      toast('Cart cleared', { type: 'info', action: 'Undo', onAction: () => { state.cart = backup; saveCart(); renderCart(); backup.forEach((i) => syncProductButtons(i.id)); } });
    });
    $('#shopClear').addEventListener('click', clearShop);
    $('#sortSelect').addEventListener('change', (e) => setShop({ sort: e.target.value }, { scroll: false }));

    /* Keyboard: Escape closes overlays/menus, arrows move through suggestions */
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        if (openOverlay) return closePanel();
        if (!$('#searchSuggest').hidden) return hideSuggestions();
        closeCatMenus();
      }
      trapFocus(e);
    });

    /* Search */
    const input = $('#searchInput');
    const suggest = $('#searchSuggest');
    input.addEventListener('input', debounce(() => renderSuggestions(input.value), 120));
    input.addEventListener('focus', () => { if (input.value.trim().length >= 2) renderSuggestions(input.value); });
    input.addEventListener('keydown', (e) => {
      if (suggest.hidden) return;
      const items = $$('li', suggest);
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        suggestIndex = (suggestIndex + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
        items.forEach((li, i) => li.setAttribute('aria-selected', i === suggestIndex));
        items[suggestIndex].scrollIntoView({ block: 'nearest' });
      } else if (e.key === 'Enter' && suggestIndex >= 0) {
        e.preventDefault();
        chooseSuggestion(items[suggestIndex]);
      }
    });
    suggest.addEventListener('click', (e) => { const li = e.target.closest('li'); if (li) chooseSuggestion(li); });
    $('#searchForm').addEventListener('submit', (e) => {
      e.preventDefault();
      hideSuggestions();
      const q = input.value.trim();
      if (!q) { input.focus(); return; }
      setShop({ query: q, category: null, crop: null, collection: null });
    });

    /* Newsletter validation */
    const form = $('#newsletterForm');
    const email = $('#newsEmail');
    const err = $('#newsError');
    const setError = (msg) => { err.textContent = msg; err.classList.remove('is-success'); email.setAttribute('aria-invalid', 'true'); };
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const v = email.value.trim();
      if (!v) return setError('Please enter your email address.');
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)) return setError('That email address doesn’t look right. Example: name@example.com');
      email.removeAttribute('aria-invalid');
      err.textContent = 'Thanks! This demo does not send emails, but your address passed validation.';
      err.classList.add('is-success');
      form.reset();
      toast('Subscribed (demo)', { type: 'success' });
    });
    email.addEventListener('input', () => { if (email.getAttribute('aria-invalid')) { err.textContent = ''; email.removeAttribute('aria-invalid'); } });

    /* Hero controls */
    $('#heroPrev').addEventListener('click', () => { goSlide(hero.index - 1); startHero(); });
    $('#heroNext').addEventListener('click', () => { goSlide(hero.index + 1); startHero(); });
    const heroEl = $('.hero');
    heroEl.addEventListener('mouseenter', stopHero);
    heroEl.addEventListener('mouseleave', startHero);
    heroEl.addEventListener('focusin', stopHero);
    heroEl.addEventListener('focusout', startHero);
    document.addEventListener('visibilitychange', () => { startHero(); syncHeroVideos(); });
    REDUCED_MOTION.addEventListener?.('change', startHero);

    // Touch swipe for the hero
    let touchX = null;
    heroEl.addEventListener('touchstart', (e) => { touchX = e.touches[0].clientX; }, { passive: true });
    heroEl.addEventListener('touchend', (e) => {
      if (touchX === null) return;
      const dx = e.changedTouches[0].clientX - touchX;
      if (Math.abs(dx) > 50) { goSlide(hero.index + (dx < 0 ? 1 : -1)); startHero(); }
      touchX = null;
    });

    /* Sticky header shadow + back-to-top (single passive scroll listener) */
    const header = $('#header');
    const backTop = $('#backTop');
    let ticking = false;
    let revealCheck = () => {};
    /* Frosted strip height tracks the floating bar (gap + header). Measured only
       when the header's size changes, never inside the scroll handler. */
    const glassTop = $('#glassTop');
    const sizeGlass = () => {
      const gap = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--glass-gap')) || 14;
      document.documentElement.style.setProperty('--glass-h', `${header.offsetHeight + gap}px`);
    };
    sizeGlass();
    if ('ResizeObserver' in window) new ResizeObserver(sizeGlass).observe(header); else window.addEventListener('resize', debounce(sizeGlass, 100));

    let scrolled = false;
    const onScroll = () => {
      const y = window.scrollY;
      revealCheck();
      const next = y > 20;
      if (next !== scrolled) { // toggle classes only on state change to avoid style churn
        scrolled = next;
        header.classList.toggle('is-stuck', next);
        document.body.classList.toggle('is-scrolled', next);
      }
      const show = y > 600;
      if (show && backTop.hidden) backTop.hidden = false;
      backTop.classList.toggle('is-visible', show);
      ticking = false;
    };
    window.addEventListener('scroll', () => { if (!ticking) { requestAnimationFrame(onScroll); ticking = true; } }, { passive: true });
    backTop.addEventListener('click', () => window.scrollTo({ top: 0, behavior: REDUCED_MOTION.matches ? 'auto' : 'smooth' }));
    // Hover / keyboard focus on a chip: place its dropdown before CSS shows it
    const catNav = $('#catNav');
    const markScrollable = () => catNav.classList.toggle('is-scrollable', catNav.scrollWidth > catNav.clientWidth + 1 && catNav.scrollLeft + catNav.clientWidth < catNav.scrollWidth - 1);
    markScrollable();
    window.addEventListener('resize', debounce(markScrollable, 100));
    catNav.addEventListener('scroll', markScrollable, { passive: true });
    catNav.addEventListener('mouseover', (e) => { const li = e.target.closest('.catnav__item'); if (li && !li.contains(e.relatedTarget)) positionCatMenu(li); });
    catNav.addEventListener('focusin', (e) => { const li = e.target.closest('.catnav__item'); if (li) positionCatMenu(li); });

    /* Broken image fallback (capture phase because error doesn't bubble) */
    document.addEventListener('error', (e) => {
      const img = e.target;
      if (img.tagName === 'IMG' && !img.dataset.fallback) { img.dataset.fallback = '1'; img.src = PLACEHOLDER; }
    }, true);

    /* Scroll-triggered reveals: IntersectionObserver first, with a cheap
       position check as a safety net so content never stays hidden if the
       observer is throttled (background tab, programmatic jumps). */
    const revealEls = $$('.reveal');
    if (revealIO) {
      revealEls.forEach((el) => revealIO.observe(el));
      revealCheck = () => revealEls.forEach((el) => {
        if (!el.classList.contains('is-visible') && el.getBoundingClientRect().top < window.innerHeight) { el.classList.add('is-visible'); revealIO.unobserve(el); }
      });
      revealCheck();
    } else {
      revealEls.forEach((el) => el.classList.add('is-visible'));
    }
  };

  const init = () => {
    renderCategoryNav();
    renderHero();
    renderCategoryCards();
    renderGrid($('#dealsGrid'), PRODUCTS.filter((p) => p.deal).sort(SORTERS.discount).slice(0, 10));
    renderCrops();
    renderGrid($('#bestGrid'), PRODUCTS.filter((p) => p.bestSeller).sort(SORTERS.popular).slice(0, 10));
    renderSolutions();
    renderBrands();
    renderArticles();
    renderStats();
    renderCart();
    renderWishlist();
    $('#year').textContent = new Date().getFullYear();
    bindEvents();
    startHero();
    syncHeroVideos();
  };

  document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', init) : init();
})();
