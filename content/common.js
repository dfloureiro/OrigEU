// Shared logic loaded before each site adapter. Exposes window.BuyEU.
(function () {
  const PROCESSED_ATTR = 'data-buyeu-processed';

  function requestLookup(payload) {
    return new Promise((resolve) => {
      try {
        chrome.runtime.sendMessage({ type: 'BUYEU_LOOKUP', payload }, (response) => {
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

  function pill(className, text, title) {
    const el = document.createElement('span');
    el.className = `buyeu-pill ${className}`;
    el.textContent = text;
    if (title) el.title = title;
    return el;
  }

  function euPill(result, full) {
    const curated = result && result.euSource === 'curated';

    if (!result || result.euStatus === 'unknown') {
      return pill('buyeu-pill--eu-unknown', full ? '🇪🇺 Origem desconhecida' : '🇪🇺?',
        'BuyEU: não foi possível determinar o país de origem deste produto (sem dados de origem na Open Food Facts nem correspondência na lista de marcas).');
    }
    if (result.euStatus === 'eu') {
      const label = result.euCountryLabel || 'UE';
      const source = curated
        ? 'marca identificada como europeia pela lista curada da escolho.eu.'
        : 'confirmado nos dados. Fonte: Open Food Facts.';
      return pill('buyeu-pill--eu-yes', full ? `🇪🇺 Origem: ${label}` : '🇪🇺',
        `BuyEU: produto de origem ${label} (União Europeia), ${source}`);
    }
    if (result.euStatus === 'eu-likely') {
      const label = result.euCountryLabel || 'UE';
      return pill('buyeu-pill--eu-likely', full ? `🇪🇺 Provável: ${label}` : '🇪🇺~',
        `BuyEU: origem de fabrico não confirmada, mas o produto está registado como vendido apenas em ${label} — sinal indicativo, não uma garantia. Fonte: Open Food Facts.`);
    }
    const source = curated
      ? 'marca identificada como não-europeia pela lista curada da escolho.eu.'
      : 'origem indicada fora da União Europeia. Fonte: Open Food Facts.';
    return pill('buyeu-pill--eu-no', full ? '🌍 Origem fora da UE' : '🌍', `BuyEU: ${source}`);
  }

  function freePill(status, kind, full) {
    const labels = {
      gluten: { free: 'Sem glúten', no: 'Contém glúten', short: 'SG', shortNo: 'G' },
      lactose: { free: 'Sem lactose', no: 'Contém leite', short: 'SL', shortNo: 'L' }
    };
    const l = labels[kind];
    if (status === 'free') {
      return pill('buyeu-pill--free-yes', full ? `✓ ${l.free}` : l.short,
        kind === 'lactose'
          ? 'BuyEU: rotulado como isento de lactose. Fonte: Open Food Facts.'
          : 'BuyEU: rotulado como isento de glúten. Fonte: Open Food Facts.');
    }
    if (status === 'contains') {
      return pill('buyeu-pill--free-no', full ? `${l.no}` : l.shortNo,
        kind === 'lactose'
          ? 'BuyEU: contém leite (usado como indicador aproximado de lactose; não confirma nem exclui isenção de lactose). Fonte: Open Food Facts.'
          : 'BuyEU: contém glúten, segundo os dados. Fonte: Open Food Facts.');
    }
    return pill('buyeu-pill--free-unknown', full ? `${l.short}?` : `${l.short}?`,
      'BuyEU: informação não disponível nos dados consultados.');
  }

  function loadingBadges(full) {
    const wrap = document.createElement('span');
    wrap.className = full ? 'buyeu-badges buyeu-badges--full' : 'buyeu-badges';
    wrap.appendChild(pill('buyeu-pill--loading', full ? 'BuyEU a verificar…' : '…', 'BuyEU: a consultar dados.'));
    return wrap;
  }

  function renderBadges(result, full) {
    const wrap = document.createElement('span');
    wrap.className = full ? 'buyeu-badges buyeu-badges--full' : 'buyeu-badges';
    wrap.appendChild(euPill(result, full));
    wrap.appendChild(freePill(result ? result.gluten : 'unknown', 'gluten', full));
    wrap.appendChild(freePill(result ? result.lactose : 'unknown', 'lactose', full));
    if (full && result && result.offUrl) {
      const link = document.createElement('a');
      link.href = result.offUrl;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.textContent = 'ver na Open Food Facts';
      link.style.fontSize = '11px';
      link.style.marginLeft = '4px';
      link.style.color = '#666';
      wrap.appendChild(link);
    }
    return wrap;
  }

  async function annotate(container, identity, options) {
    const full = Boolean(options && options.full);
    if (container.getAttribute(PROCESSED_ATTR) === 'true') return;
    container.setAttribute(PROCESSED_ATTR, 'true');

    const placeholder = loadingBadges(full);
    container.appendChild(placeholder);

    console.debug('[BuyEU] identity', identity);
    const result = await requestLookup(identity);
    console.debug('[BuyEU] result', identity, result);
    const finalBadges = renderBadges(result, full);
    placeholder.replaceWith(finalBadges);
  }

  function scanListing(config) {
    const cards = document.querySelectorAll(config.cardSelector);
    cards.forEach((card) => {
      if (card.getAttribute(PROCESSED_ATTR) === 'true') return;
      const identity = config.getIdentity(card);
      if (!identity || (!identity.barcode && !identity.name)) return;
      const target = config.getInjectTarget(card) || card;
      annotate(target, identity, { full: false });
    });
  }

  function scanProductPage(config) {
    if (!config.isProductPage()) return;
    const identity = config.getProductIdentity();
    if (!identity || (!identity.barcode && !identity.name)) return;
    const target = config.getProductInjectTarget();
    if (!target) return;
    annotate(target, identity, { full: true });
  }

  const BARCODE_RE = /^\d{8}$|^\d{12,14}$/;

  function looksLikeBarcode(value) {
    return typeof value === 'string' && BARCODE_RE.test(value.trim());
  }

  // Best-effort extraction of a GTIN/EAN from schema.org Product JSON-LD,
  // which many SFCC-based storefronts embed on PDPs for SEO.
  function findJsonLdBarcode(root) {
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
          const isProduct = type === 'Product' || (Array.isArray(type) && type.includes('Product'));
          if (!isProduct) continue;
          for (const field of ['gtin13', 'gtin', 'gtin14', 'gtin12', 'gtin8', 'sku']) {
            if (looksLikeBarcode(node[field])) return String(node[field]).trim();
          }
        }
      }
    }
    return null;
  }

  function init(siteConfig) {
    const run = () => {
      if (siteConfig.listing) scanListing(siteConfig.listing);
      if (siteConfig.product) scanProductPage(siteConfig.product);
    };

    run();

    const observer = new MutationObserver(() => run());
    observer.observe(document.body, { childList: true, subtree: true });

    // Belt-and-braces: some SPA-ish listing pages update without triggering
    // observable structural mutations near the root (e.g. virtualized lists).
    setInterval(run, 2000);
  }

  window.BuyEU = { init, looksLikeBarcode, findJsonLdBarcode };
})();
