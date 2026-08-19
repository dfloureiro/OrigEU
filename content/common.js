// Shared logic loaded before each site adapter. Exposes window.OrigEU.
(function () {
  const PROCESSED_ATTR = 'data-origeu-processed';

  // Which badge kinds the user wants to see (popup/popup.js writes this).
  // Mirrors lib/settings.js — duplicated here because content scripts can't
  // use ES module imports the way the background/popup scripts do.
  const SETTINGS_KEY = 'origeu_settings';
  const DEFAULT_SETTINGS = { eu: true, detail: 'long', hideUnknown: false };
  const KIND_CLASS = { eu: 'origeu-pill--kind-eu' };
  const UNKNOWN_CLASS = 'origeu-pill--eu-unknown';
  let currentSettings = { ...DEFAULT_SETTINGS };

  // Country code -> label/flag translation lives in content/countries.js
  // (loaded before this file -- see manifest.json), not here: labels are a
  // render-time concern now that the database stores ISO codes rather than
  // free-text names (see git history, backend/d1/migrations/0005_country_codes.sql).
  const { countryLabel, flagFromCode } = window.OrigEUCountries;

  function esc(s) {
    const div = document.createElement('div');
    div.textContent = s ?? '';
    return div.innerHTML;
  }

  async function loadSettings() {
    try {
      const stored = await chrome.storage.local.get(SETTINGS_KEY);
      currentSettings = { ...DEFAULT_SETTINGS, ...(stored[SETTINGS_KEY] || {}) };
    } catch (err) {
      currentSettings = { ...DEFAULT_SETTINGS };
    }
  }

  // Toggling in the popup updates already-rendered badges immediately (no
  // page refresh needed) by hiding/showing the relevant pills in place —
  // the data behind them was already fetched, so there's nothing to redo.
  function applyVisibility() {
    for (const [kind, cls] of Object.entries(KIND_CLASS)) {
      const show = currentSettings[kind] !== false;
      document.querySelectorAll(`.${cls}`).forEach((el) => {
        el.style.display = show ? '' : 'none';
      });
    }
    // Unknown-origin badges have their own independent toggle, layered on
    // top of the main "eu" kind toggle above — skip if that already hid
    // everything, so re-enabling it doesn't get overridden back to hidden.
    if (currentSettings.eu !== false) {
      document.querySelectorAll(`.${UNKNOWN_CLASS}`).forEach((el) => {
        el.style.display = currentSettings.hideUnknown ? 'none' : '';
      });
    }
  }

  // Same live-update idea as applyVisibility(), but for the badge's text
  // content rather than its display: euPill() stashes the minimal facts
  // needed to redraw a badge (status/country/region) on the element itself
  // as data-origeu-state, so switching short/long form in the popup updates
  // already-rendered badges in place instead of requiring a page refresh.
  function applyDetailLevel() {
    const long = currentSettings.detail !== 'short';
    document.querySelectorAll(`.${KIND_CLASS.eu}[data-origeu-state]`).forEach((el) => {
      let state;
      try {
        state = JSON.parse(el.getAttribute('data-origeu-state'));
      } catch (err) {
        return;
      }
      const textEl = el.querySelector('.origeu-pill__text');
      if (textEl) textEl.textContent = computeBadgeText(state, long);
    });
  }

  if (chrome.storage && chrome.storage.onChanged) {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === 'local' && changes[SETTINGS_KEY]) {
        currentSettings = { ...DEFAULT_SETTINGS, ...(changes[SETTINGS_KEY].newValue || {}) };
        applyVisibility();
        applyDetailLevel();
      }
    });
  }

  function requestLookup(payload) {
    return new Promise((resolve) => {
      try {
        chrome.runtime.sendMessage({ type: 'ORIGEU_LOOKUP', payload }, (response) => {
          if (chrome.runtime.lastError) {
            resolve(null);
            return;
          }
          resolve(response || null);
        });
      } catch (err) {
        resolve(null);
      }
    });
  }

  // Routed through the background worker (not fetched here directly) so a
  // strict page CSP on a supermarket site can't block it the way it could
  // block a content-script-initiated fetch() — see background/background.js.
  function requestSuggestion(payload) {
    return new Promise((resolve) => {
      try {
        chrome.runtime.sendMessage({ type: 'ORIGEU_SUBMIT_SUGGESTION', payload }, (response) => {
          if (chrome.runtime.lastError) {
            resolve({ ok: false, error: chrome.runtime.lastError.message });
            return;
          }
          resolve(response || { ok: false, error: 'sem resposta' });
        });
      } catch (err) {
        resolve({ ok: false, error: err.message });
      }
    });
  }

  function pill(className, text, tooltipText, tooltipLinks, kind, tooltipNote) {
    const el = document.createElement('span');
    const classes = ['origeu-pill', className];
    if (kind && KIND_CLASS[kind]) classes.push(KIND_CLASS[kind]);
    el.className = classes.join(' ');
    // Text lives in its own child span (not el.textContent directly) so
    // CSS can truncate it with an ellipsis in compact/listing contexts —
    // text-overflow: ellipsis on a flex container holding a bare text
    // node doesn't reliably show the "…" in Chrome, but it does on a
    // dedicated child with its own overflow/white-space (see common.css).
    const textEl = document.createElement('span');
    textEl.className = 'origeu-pill__text';
    textEl.textContent = text;
    el.appendChild(textEl);
    if (kind && currentSettings[kind] === false) el.style.display = 'none';
    if (className === UNKNOWN_CLASS && currentSettings.hideUnknown) el.style.display = 'none';
    if (tooltipText) {
      el.setAttribute('data-origeu-tip', tooltipText);
      el.setAttribute('aria-label', tooltipText);
      el.tabIndex = 0;
      if (tooltipNote) {
        el.setAttribute('data-origeu-tip-note', tooltipNote);
      }
      if (tooltipLinks && tooltipLinks.length > 0) {
        el.setAttribute('data-origeu-tip-links', JSON.stringify(tooltipLinks));
      }
    }
    return el;
  }

  // The per-brand citation URL recorded in the backoffice (when there is
  // one), shown as a real clickable link in the tooltip — not a generic
  // "visit this source's homepage" link like the old third-party sources
  // needed, since the own database can point at the exact page a fact
  // came from.
  function citationLink(result) {
    const sig = result && result.euSignals && result.euSignals[0];
    return sig && sig.sourceUrl ? [{ url: sig.sourceUrl, label: chrome.i18n.getMessage('citationLinkLabel') }] : [];
  }

  // The short factual blurb recorded per-brand in the backoffice (when
  // there is one), shown as an extra line in the tooltip alongside the
  // citation link above. Picked by language here at render time (same
  // navigator.language signal as content/countries.js's labels), not
  // earlier in the background lookup — that result gets cached client-side
  // for up to 30 days (lib/cache.js), so baking the language choice in
  // there would lock a badge to whichever language was current on first
  // lookup. Falls back to whichever language has a note when the
  // preferred one is missing, rather than showing nothing.
  function brandNote(result) {
    const sig = result && result.euSignals && result.euSignals[0];
    if (!sig) return null;
    const preferPt = (navigator.language || '').toLowerCase().startsWith('pt');
    return (preferPt ? (sig.notesPt || sig.notesEn) : (sig.notesEn || sig.notesPt)) || null;
  }

  // Badge text for a given (status, country, region) triple, honoring the
  // short/long display setting. "Short" is just the flag/icon — the badge's
  // original, compact-only look. "Long" spells it out ("OrigEU ❤️ Portugal
  // 🇵🇹") so it reads on its own even on a dense listing page. Pulled out
  // of euPill() so applyDetailLevel() can also call it, to redraw
  // already-rendered badges in place when the setting changes.
  function computeBadgeText(state, long) {
    if (state.status === 'eu') {
      const label = countryLabel(state.code) || 'UE';
      const flag = flagFromCode(state.code) || '🇪🇺';
      return long ? chrome.i18n.getMessage('badgeEu', [label, flag]) : flag;
    }
    if (state.status === 'non-eu') {
      if (state.region === 'efta') {
        const label = countryLabel(state.code) || 'EFTA';
        const flag = flagFromCode(state.code) || '🇪🇺';
        return long ? chrome.i18n.getMessage('badgeEfta', [label, flag]) : flag;
      }
      const label = countryLabel(state.code);
      return long ? (label ? chrome.i18n.getMessage('badgeNonEuCountry', [label]) : chrome.i18n.getMessage('badgeNonEuGeneric')) : '🌍';
    }
    return long ? chrome.i18n.getMessage('badgeUnknown') : '🇪🇺?';
  }

  function euPill(result, productName) {
    const link = citationLink(result);
    const note = brandNote(result);
    const state = (result && result.euStatus !== 'unknown')
      ? { status: result.euStatus, code: result.euCountryCode || null, region: result.euRegion || null }
      : { status: 'unknown', code: null, region: null };
    const long = currentSettings.detail !== 'short';
    const text = computeBadgeText(state, long);

    let className;
    let tooltip;
    if (state.status === 'eu') {
      className = 'origeu-pill--eu-yes';
      tooltip = chrome.i18n.getMessage('tooltipEu', [countryLabel(state.code) || 'UE']);
    } else if (state.status === 'non-eu' && state.region === 'efta') {
      className = 'origeu-pill--eu-efta';
      const label = countryLabel(state.code) || 'EFTA';
      tooltip = chrome.i18n.getMessage('tooltipEfta', [label]);
    } else if (state.status === 'non-eu') {
      className = 'origeu-pill--eu-no';
      const label = countryLabel(state.code);
      tooltip = label
        ? chrome.i18n.getMessage('tooltipNonEuCountry', [label])
        : chrome.i18n.getMessage('tooltipNonEuGeneric');
    } else {
      className = UNKNOWN_CLASS;
      tooltip = chrome.i18n.getMessage('tooltipUnknown');
    }

    const el = pill(className, text, tooltip, link, 'eu', note);
    el.setAttribute('data-origeu-state', JSON.stringify(state));
    if (state.status === 'unknown') {
      el.setAttribute('data-origeu-suggest', productName || '');
    }
    return el;
  }

  function loadingBadges(full) {
    const wrap = document.createElement('span');
    wrap.className = full ? 'origeu-badges origeu-badges--full' : 'origeu-badges';
    wrap.appendChild(pill('origeu-pill--loading', full ? chrome.i18n.getMessage('loadingBadgeFull') : '…', chrome.i18n.getMessage('tooltipLoading')));
    return wrap;
  }

  function renderBadges(result, full, productName) {
    const wrap = document.createElement('span');
    wrap.className = full ? 'origeu-badges origeu-badges--full' : 'origeu-badges';
    wrap.appendChild(euPill(result, productName));
    if (full) {
      citationLink(result).forEach((l) => {
        const link = document.createElement('a');
        link.href = l.url;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.textContent = l.label;
        link.style.fontSize = '11px';
        link.style.marginLeft = '4px';
        link.style.color = '#666';
        wrap.appendChild(link);
      });
    }
    return wrap;
  }

  async function annotate(container, name, options) {
    const full = Boolean(options && options.full);
    // Optional: insert before a specific sibling instead of at the end —
    // e.g. continente.pt anchors its "add to cart" button after
    // everything else in the tile body, so appending put the badge below
    // it instead of in the more natural spot right after the price.
    // insertBefore(node, null) behaves exactly like appendChild, so this
    // is a no-op for sites that don't pass one.
    const insertBeforeEl = options && options.insertBefore;
    if (container.getAttribute(PROCESSED_ATTR) === 'true') return;
    container.setAttribute(PROCESSED_ATTR, 'true');

    const placeholder = loadingBadges(full);
    container.insertBefore(placeholder, insertBeforeEl || null);

    console.debug('[OrigEU] name', name);
    const result = await requestLookup({ name });
    console.debug('[OrigEU] result', name, result);
    const finalBadges = renderBadges(result, full, name);
    placeholder.replaceWith(finalBadges);
  }

  function scanListing(config) {
    const cards = Array.from(document.querySelectorAll(config.cardSelector));
    // Some sites (e.g. continente.pt) wrap the real product tile in an
    // outer element that also matches cardSelector — a broader fallback
    // pattern meant for sites that don't have a nested tile at all, but
    // which doubles up every badge on ones that do. Keep only the
    // innermost match per product: skip any card that contains another
    // matched card.
    const leafCards = cards.filter((card) => !cards.some((other) => other !== card && card.contains(other)));
    leafCards.forEach((card) => {
      const target = config.getInjectTarget(card) || card;
      if (target.getAttribute(PROCESSED_ATTR) === 'true') return;
      const name = config.getName(card);
      if (!name) return;
      const insertBefore = config.getInjectBefore ? config.getInjectBefore(card, target) : null;
      annotate(target, name, { full: false, insertBefore });
    });
  }

  function scanProductPage(config) {
    if (!config.isProductPage()) return;
    const name = config.getProductName();
    if (!name) return;
    const target = config.getProductInjectTarget();
    if (!target) return;
    annotate(target, name, { full: true });
  }

  // Page-type detection helper for adapters: many PDP templates embed
  // schema.org Product JSON-LD for SEO, which is a decent "this is a
  // product page" signal even when a site's CSS classes are unverified.
  function hasProductJsonLd(root) {
    const scripts = (root || document).querySelectorAll('script[type="application/ld+json"]');
    for (const script of scripts) {
      let data;
      try {
        data = JSON.parse(script.textContent);
      } catch (err) {
        continue;
      }
      const items = Array.isArray(data) ? data : [data];
      for (const item of items) {
        const candidates = [item, ...(item?.['@graph'] || [])];
        for (const node of candidates) {
          if (!node || typeof node !== 'object') continue;
          const type = node['@type'];
          if (type === 'Product' || (Array.isArray(type) && type.includes('Product'))) return true;
        }
      }
    }
    return false;
  }

  // Custom hover popover for badge details. Native `title` tooltips are
  // slow to appear, unstyled, and (on some sites) get clipped by a card's
  // `overflow: hidden`. This one is appended directly to <body> so it's
  // never clipped by an ancestor, and appears instantly.
  let tooltipEl = null;
  let hideTimer = null;

  function cancelHide() {
    if (hideTimer) {
      clearTimeout(hideTimer);
      hideTimer = null;
    }
  }

  function hideTooltip() {
    if (tooltipEl) tooltipEl.style.display = 'none';
  }

  function scheduleHide() {
    cancelHide();
    hideTimer = setTimeout(hideTooltip, 150);
  }

  function ensureTooltipEl() {
    if (!tooltipEl) {
      tooltipEl = document.createElement('div');
      tooltipEl.className = 'origeu-tooltip';
      tooltipEl.addEventListener('mouseenter', cancelHide);
      tooltipEl.addEventListener('mouseleave', scheduleHide);
      document.body.appendChild(tooltipEl);
    }
    return tooltipEl;
  }

  function positionTooltip(target, tip) {
    const rect = target.getBoundingClientRect();
    const tipRect = tip.getBoundingClientRect();
    let top = rect.top - tipRect.height - 8;
    if (top < 8) top = rect.bottom + 8;
    let left = rect.left + rect.width / 2 - tipRect.width / 2;
    left = Math.max(8, Math.min(left, window.innerWidth - tipRect.width - 8));
    tip.style.top = `${Math.round(top)}px`;
    tip.style.left = `${Math.round(left)}px`;
  }

  function showTooltip(target) {
    if (suggestEl && suggestEl.style.display === 'block') return;
    const text = target.getAttribute('data-origeu-tip');
    if (!text) return;
    cancelHide();
    const tip = ensureTooltipEl();
    tip.textContent = text;
    const note = target.getAttribute('data-origeu-tip-note');
    if (note) {
      const noteEl = document.createElement('div');
      noteEl.className = 'origeu-tooltip__note';
      noteEl.textContent = note;
      tip.appendChild(noteEl);
    }
    const linksRaw = target.getAttribute('data-origeu-tip-links');
    if (linksRaw) {
      let links = [];
      try {
        links = JSON.parse(linksRaw);
      } catch (err) {
        links = [];
      }
      for (const l of links) {
        const link = document.createElement('a');
        link.href = l.url;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.textContent = l.label || l.url;
        link.className = 'origeu-tooltip__link';
        tip.appendChild(link);
      }
    }
    tip.style.display = 'block';
    positionTooltip(target, tip);
  }

  function tipTarget(el) {
    return el && el.closest ? el.closest('[data-origeu-tip]') : null;
  }

  document.addEventListener('mouseover', (e) => {
    const target = tipTarget(e.target);
    if (target) showTooltip(target);
  });
  document.addEventListener('mouseout', (e) => {
    if (tipTarget(e.target)) scheduleHide();
  });
  document.addEventListener('focusin', (e) => {
    const target = tipTarget(e.target);
    if (target) showTooltip(target);
  });
  document.addEventListener('focusout', (e) => {
    if (tipTarget(e.target)) hideTooltip();
  });
  window.addEventListener('scroll', hideTooltip, true);
  window.addEventListener('resize', hideTooltip);

  // Click-to-suggest panel for "unknown" badges: lets you submit a brand
  // straight from the page instead of a trip to the (Access-gated)
  // backoffice. Posts to a public queue (SUGGESTIONS_URL) that never
  // touches the real brand list directly — suggestions sit in
  // pending_brands until reviewed and promoted from the backoffice.
  // Appended to <body> for the same overflow-clipping reasons as the
  // tooltip above, but unlike the tooltip it only closes on an explicit
  // action (submit, ×, outside click, Escape) since it holds form state.
  let suggestEl = null;

  function closeSuggestForm() {
    if (suggestEl) suggestEl.style.display = 'none';
  }

  function positionSuggestForm(target, panel) {
    const rect = target.getBoundingClientRect();
    const panelRect = panel.getBoundingClientRect();
    let top = rect.bottom + 8;
    if (top + panelRect.height > window.innerHeight - 8) top = Math.max(8, rect.top - panelRect.height - 8);
    const left = Math.max(8, Math.min(rect.left, window.innerWidth - panelRect.width - 8));
    panel.style.top = `${Math.round(top)}px`;
    panel.style.left = `${Math.round(left)}px`;
  }

  // Splits a comma-separated field into resolved ISO codes. Each entry can
  // be a code ("PT") or a name ("Portugal") — resolveCountryInput
  // (content/countries.js) tries a code match first, then a name->code
  // reverse lookup, so either works without a picker or a hardcoded name
  // table. Whatever doesn't resolve is kept as-is (uppercased) rather than
  // dropped, so the server's validation still catches and reports it.
  function resolveCountriesField(rawValue) {
    return rawValue.split(',').map((s) => s.trim()).filter(Boolean).map((entry) => {
      const code = window.OrigEUCountries.resolveCountryInput(entry);
      return { entry, code };
    });
  }

  // Lets you type an ISO 3166-1 alpha-2 code OR a country name directly
  // (comma-separated for more than one) and shows what it resolved to
  // live, as confirmation — no picker, no curated list of "supported"
  // countries to maintain or to silently leave something out of: any real
  // code or name works, and unresolved input is flagged so a typo is
  // obvious before submitting, rather than needing a search-by-name list
  // just to avoid typos.
  function attachCountryCodeConfirm(inputEl) {
    const confirm = document.createElement('div');
    confirm.className = 'origeu-suggest__country-confirm';
    inputEl.insertAdjacentElement('afterend', confirm);

    function update() {
      const resolved = resolveCountriesField(inputEl.value);
      if (!resolved.length) {
        confirm.textContent = '';
        return;
      }
      confirm.innerHTML = resolved
        .map(({ entry, code }) => {
          const label = code ? window.OrigEUCountries.countryLabel(code) : `"${esc(entry)}"?`;
          return `<span class="${code ? '' : 'origeu-suggest__country-confirm--unknown'}">${esc(label)}</span>`;
        })
        .join(', ');
    }

    inputEl.addEventListener('input', update);
  }

  function buildSuggestForm() {
    const panel = document.createElement('div');
    panel.className = 'origeu-suggest';
    panel.innerHTML = `
      <div class="origeu-suggest__header">
        <span>${chrome.i18n.getMessage('suggestTitle')}</span>
        <button type="button" class="origeu-suggest__close" aria-label="${chrome.i18n.getMessage('suggestClose')}">×</button>
      </div>
      <form>
        <label>${chrome.i18n.getMessage('suggestBrandLabel')}
          <input name="name" required maxlength="200">
        </label>
        <label>${chrome.i18n.getMessage('suggestCountryLabel')}
          <input name="countries" id="origeuSuggestCountries" autocomplete="off" placeholder="Portugal" maxlength="200">
        </label>
        <label>${chrome.i18n.getMessage('suggestSourceLabel')}
          <input name="source" type="url" placeholder="https://...">
        </label>
        <label>${chrome.i18n.getMessage('suggestNotesLabel')}
          <textarea name="notes" rows="2" maxlength="1000"></textarea>
        </label>
        <p class="origeu-suggest__hint">${chrome.i18n.getMessage('suggestHint')}</p>
        <div class="origeu-suggest__error" hidden></div>
        <div class="origeu-suggest__success" hidden>${chrome.i18n.getMessage('suggestSuccess')}</div>
        <button type="submit" class="origeu-suggest__submit">${chrome.i18n.getMessage('suggestSubmit')}</button>
      </form>
    `;
    document.body.appendChild(panel);
    panel.querySelector('.origeu-suggest__close').addEventListener('click', closeSuggestForm);
    attachCountryCodeConfirm(panel.querySelector('#origeuSuggestCountries'));

    const form = panel.querySelector('form');
    const errorEl = panel.querySelector('.origeu-suggest__error');
    const successEl = panel.querySelector('.origeu-suggest__success');
    const submitBtn = panel.querySelector('.origeu-suggest__submit');

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      errorEl.hidden = true;
      const name = form.name.value.trim();
      if (!name) return;
      submitBtn.disabled = true;
      submitBtn.textContent = chrome.i18n.getMessage('suggestSubmitting');
      const response = await requestSuggestion({
        name,
        countries: resolveCountriesField(form.countries.value).map(({ entry, code }) => code || entry.toUpperCase()),
        source: form.source.value.trim() || null,
        notes: form.notes.value.trim() || null
      });
      submitBtn.disabled = false;
      submitBtn.textContent = chrome.i18n.getMessage('suggestSubmit');
      if (response.ok) {
        form.hidden = true;
        successEl.hidden = false;
        setTimeout(closeSuggestForm, 2000);
      } else {
        errorEl.textContent = response.error || chrome.i18n.getMessage('suggestGenericError');
        errorEl.hidden = false;
      }
    });

    return panel;
  }

  function openSuggestForm(target) {
    hideTooltip();
    cancelHide();
    if (!suggestEl) suggestEl = buildSuggestForm();
    const form = suggestEl.querySelector('form');
    form.hidden = false;
    form.reset();
    form.name.value = target.getAttribute('data-origeu-suggest') || '';
    suggestEl.querySelector('.origeu-suggest__error').hidden = true;
    suggestEl.querySelector('.origeu-suggest__success').hidden = true;
    suggestEl.style.display = 'block';
    positionSuggestForm(target, suggestEl);
    form.name.focus();
  }

  document.addEventListener('click', (e) => {
    const target = e.target.closest && e.target.closest('[data-origeu-suggest]');
    if (target) {
      e.preventDefault();
      openSuggestForm(target);
      return;
    }
    if (suggestEl && suggestEl.style.display !== 'none' && !suggestEl.contains(e.target)) {
      closeSuggestForm();
    }
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeSuggestForm();
  });

  async function init(siteConfig) {
    const run = () => {
      if (siteConfig.listing) scanListing(siteConfig.listing);
      if (siteConfig.product) scanProductPage(siteConfig.product);
    };

    await loadSettings();
    run();

    const observer = new MutationObserver(() => run());
    observer.observe(document.body, { childList: true, subtree: true });

    // Belt-and-braces: some SPA-ish listing pages update without triggering
    // observable structural mutations near the root (e.g. virtualized lists).
    setInterval(run, 2000);
  }

  window.OrigEU = { init, hasProductJsonLd };
})();
