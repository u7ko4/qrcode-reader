// ==UserScript==
// @name            QR Code Reader
// @namespace       https://webextension.org/listing/qrcode-reader.html
// @version         0.3.6
// @description     hover over an image and click the QR button in its corner to read the QR code (or barcode) on it; the result is rendered right below the image and http urls become clickable and open in a new tab
// @author          Joue Quroi
// @homepageURL     https://webextension.org/listing/qrcode-reader.html
// @supportURL      https://github.com/joue-quroi/qrcode-reader/issues
// @license         MPL-2.0
// @match           *://*/*
// @grant           GM_addStyle
// @grant           GM_openInTab
// @grant           GM_registerMenuCommand
// @grant           GM_xmlhttpRequest
// @connect         *
// @require         https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.min.js
// @run-at          document-idle
// @updateURL       https://raw.githubusercontent.com/joue-quroi/qrcode-reader/master/qrcode-reader.user.js
// @downloadURL     https://raw.githubusercontent.com/joue-quroi/qrcode-reader/master/qrcode-reader.user.js
// ==/UserScript==

/* global jsQR */

'use strict';

{
  const ID = 'qrcode-reader-panel';
  const MARGIN = 8;
  const MAX_WIDTH = 460;
  const MIN_SIZE = 64;
  // the same sweep the extension uses to improve the detection rate
  const FILTERS = ['', 'invert(1)', 'contrast(200%)', 'grayscale(100%)', 'contrast(50%)', 'grayscale(50%)'];

  const CSS = `
    .qrcr-host {
      all: initial;
      position: absolute !important;
      z-index: 2147483647 !important;
      display: block !important;
      margin: 0 !important;
      padding: 0 !important;
      border: 0 !important;
      background: transparent !important;
      text-align: left !important;
    }
    .qrcr-panel {
      font-family: Arial, "Helvetica Neue", Helvetica, sans-serif !important;
      font-size: 14px !important;
      line-height: 1.5 !important;
      color: #000 !important;
      background-color: #fff !important;
      border-radius: 6px !important;
      box-shadow: 0 2px 12px rgba(0, 0, 0, .35) !important;
      overflow: hidden !important;
    }
    .qrcr-head {
      display: flex !important;
      align-items: center !important;
      justify-content: space-between !important;
      gap: 8px !important;
      height: 32px !important;
      padding: 0 8px !important;
      background-color: #ffd19e !important;
      user-select: none !important;
    }
    .qrcr-name {
      font-size: 13px !important;
    }
    .qrcr-close {
      cursor: pointer !important;
      padding: 0 5px !important;
      border-radius: 3px !important;
      font-size: 12px !important;
      line-height: 18px !important;
    }
    .qrcr-close:hover {
      background-color: rgba(0, 0, 0, .1) !important;
      color: red !important;
    }
    .qrcr-progress {
      display: block !important;
      width: 100% !important;
      height: 3px !important;
      margin: 0 !important;
      border: none !important;
      background-color: transparent !important;
    }
    .qrcr-progress[value="1"] {
      display: none !important;
    }
    .qrcr-progress::-moz-progress-bar {
      background-color: red !important;
    }
    .qrcr-progress::-webkit-progress-value {
      background-color: red !important;
    }
    .qrcr-status {
      padding: 8px 10px !important;
    }
    .qrcr-status:empty {
      display: none !important;
    }
    .qrcr-results {
      display: flex !important;
      flex-direction: column !important;
    }
    .qrcr-results:not(:empty) {
      padding: 8px !important;
      gap: 6px !important;
    }
    .qrcr-entry {
      display: grid !important;
      grid-gap: 4px !important;
    }
    .qrcr-symbol {
      font-size: 12px !important;
      color: #666 !important;
    }
    .qrcr-entry pre {
      font-family: inherit !important;
      font-size: 13px !important;
      margin: 0 !important;
      padding: 8px !important;
      white-space: pre-wrap !important;
      overflow-wrap: anywhere !important;
      background-color: #f5ebe0 !important;
      max-height: 200px !important;
      overflow: auto !important;
    }
    .qrcr-link {
      color: #07c !important;
      text-decoration: underline !important;
      cursor: pointer !important;
    }
    .qrcr-button {
      all: initial;
      position: fixed !important;
      display: block !important;
      margin: 0 !important;
      padding: 0 !important;
    }
    .qrcr-button button {
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
      width: 100% !important;
      height: 100% !important;
      margin: 0 !important;
      padding: 0 !important;
      border: 0 !important;
      border-radius: 6px !important;
      background-color: rgba(0, 0, 0, .55) !important;
      box-shadow: 0 2px 6px rgba(0, 0, 0, .35) !important;
      color: #fff !important;
      opacity: .75 !important;
      cursor: pointer !important;
      transition: opacity .15s ease, background-color .15s ease !important;
      -webkit-backdrop-filter: blur(2px) !important;
      backdrop-filter: blur(2px) !important;
    }
    .qrcr-button button:hover,
    .qrcr-button button:focus-visible {
      background-color: rgba(0, 0, 0, .85) !important;
      opacity: 1 !important;
      outline: none !important;
    }
    .qrcr-button svg {
      display: block !important;
      width: 16px !important;
      height: 16px !important;
      pointer-events: none !important;
    }
  `;

  const style = () => {
    if (typeof GM_addStyle === 'function') {
      try {
        Promise.resolve(GM_addStyle(CSS)).catch(() => {});
        return;
      }
      catch (e) {}
    }
    const s = document.createElement('style');
    s.textContent = CSS;
    (document.head || document.documentElement).append(s);
  };

  const open = url => {
    if (typeof GM_openInTab === 'function') {
      GM_openInTab(url, {
        active: true
      });
    }
    else {
      window.open(url, '_blank', 'noopener');
    }
  };

  // turns http(s) urls into clickable links
  const urlify = content => {
    const fragment = document.createDocumentFragment();
    const regex = /(https?:\/\/[^\s]+)/gi;

    let index = 0;
    for (const match of content.matchAll(regex)) {
      if (match.index > index) {
        fragment.append(content.slice(index, match.index));
      }
      const a = document.createElement('a');
      a.className = 'qrcr-link';
      a.href = match[0];
      a.textContent = match[0];
      a.title = 'Open in a new tab';
      fragment.append(a);
      index = match.index + match[0].length;
    }
    if (index < content.length) {
      fragment.append(content.slice(index));
    }

    return fragment;
  };

  /* --------------------------- decoders --------------------------- */

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d', {
    willReadFrequently: true
  });

  let detector;
  const nativeDetector = () => {
    if (detector === undefined) {
      if (typeof BarcodeDetector === 'function') {
        detector = BarcodeDetector.getSupportedFormats()
          .then(formats => formats.length ? new BarcodeDetector({formats}) : null)
          .catch(() => null);
      }
      else {
        detector = Promise.resolve(null);
      }
    }
    return detector;
  };

  const nativeScan = async () => {
    const barcodeDetector = await nativeDetector();
    if (!barcodeDetector) {
      return [];
    }
    const barcodes = await barcodeDetector.detect(canvas);

    return barcodes.map(b => ({
      symbol: b.format.toUpperCase().replace('_', '-'),
      data: b.rawValue
    }));
  };

  const jsqr = () => {
    let decoder = null;
    try {
      decoder = jsQR; /* the library that @require loads */
    }
    catch (e) {}
    if (typeof decoder !== 'function') {
      decoder = typeof window.jsQR === 'function' ? window.jsQR : null;
    }
    if (!decoder) {
      return [];
    }
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const result = decoder(data.data, data.width, data.height, {
      inversionAttempts: 'dontInvert'
    });

    return result && result.data ? [{
      symbol: 'QR Code',
      data: result.data
    }] : [];
  };

  const scan = async (source, progress) => {
    canvas.width = source.naturalWidth || source.width;
    canvas.height = source.naturalHeight || source.height;
    if (!canvas.width || !canvas.height) {
      throw Error('Cannot read this image');
    }

    let percent = 0;
    for (const filter of FILTERS) {
      // decoding works on luminance, so transparent areas are painted first
      // (with the filter applied, which is what an inverted code needs)
      ctx.filter = filter;
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(source, 0, 0, canvas.width, canvas.height);

      // the same code may be reported by more than one decoder
      const results = [];
      for (const found of [...await nativeScan(), ...jsqr()]) {
        if (results.every(o => o.data !== found.data)) {
          results.push(found);
        }
      }

      percent += 1 / FILTERS.length;
      progress(percent);

      if (results.length) {
        return results;
      }
    }

    return [];
  };

  /* ------------------------ image loading ------------------------ */

  const request = url => {
    if (/^(data|blob):/.test(url)) {
      return fetch(url, {
        cache: 'no-store'
      }).then(r => {
        if (r.ok === false) {
          throw Error('Cannot load this image (HTTP ' + r.status + ')');
        }
        return r.blob();
      });
    }

    return new Promise((resolve, reject) => GM_xmlhttpRequest({
      method: 'GET',
      url,
      responseType: 'blob',
      onload: r => {
        if (r.response && (r.status === 0 || (r.status >= 200 && r.status < 300))) {
          resolve(r.response);
        }
        else {
          reject(Error('Cannot load this image (HTTP ' + r.status + ')'));
        }
      },
      onerror: () => reject(Error('Cannot load this image')),
      ontimeout: () => reject(Error('Cannot load this image (timeout)'))
    }));
  };

  // cross-origin images taint the canvas, so the bits are re-fetched instead
  const prepare = async target => {
    if (target.tagName !== 'IMG') {
      return {
        source: target
      };
    }
    if (target.complete === false) {
      await new Promise(resolve => {
        target.addEventListener('load', resolve, {
          once: true
        });
        setTimeout(resolve, 5000);
      });
    }

    try {
      const probe = document.createElement('canvas');
      probe.width = probe.height = 1;
      const pctx = probe.getContext('2d');
      pctx.drawImage(target, 0, 0, 1, 1);
      pctx.getImageData(0, 0, 1, 1);

      return {
        source: target
      };
    }
    catch (e) {
      // createImageBitmap() cannot handle every format (SVG for instance), so the
      // fetched bits are handed to an image element instead
      const objectUrl = URL.createObjectURL(await request(target.currentSrc || target.src));
      try {
        const image = new Image();
        await new Promise((resolve, reject) => {
          image.onload = resolve;
          image.onerror = () => reject(Error('Cannot read this image file'));
          image.src = objectUrl;
        });

        return {
          source: image,
          objectUrl
        };
      }
      catch (error) {
        URL.revokeObjectURL(objectUrl);
        throw error;
      }
    }
  };

  /* --------------------------- panel --------------------------- */

  let active = null;

  const close = () => {
    if (active === null) {
      return;
    }
    cancelAnimationFrame(active.raf);
    document.removeEventListener('keydown', active.onkey, true);
    active.host.remove();
    active = null;
  };

  const position = (target, width) => {
    const rect = target && target.isConnected ? target.getBoundingClientRect() : null;

    return {
      left: Math.max(MARGIN, Math.min(
        rect ? rect.left + window.scrollX : window.scrollX + window.innerWidth - width - MARGIN,
        Math.max(document.documentElement.scrollWidth, window.innerWidth) - width - MARGIN
      )),
      top: (rect ? rect.bottom + window.scrollY : window.scrollY) + MARGIN
    };
  };

  const create = target => {
    close();

    const rect = target.getBoundingClientRect();
    const max = Math.min(MAX_WIDTH, Math.max(220, window.innerWidth - 2 * MARGIN));
    const width = Math.max(220, Math.min(max, Math.max(rect.width, 300)));

    const host = document.createElement('div');
    host.id = ID;
    host.className = 'qrcr-host';
    // the stylesheet can be dropped by a strict page CSP, so the important bits
    // are set inline as well
    for (const [name, value] of Object.entries({
      position: 'absolute',
      'z-index': '2147483647',
      display: 'block',
      margin: '0',
      padding: '0',
      border: '0',
      background: 'transparent',
      width: width + 'px'
    })) {
      host.style.setProperty(name, value, 'important');
    }

    const panel = document.createElement('div');
    panel.className = 'qrcr-panel';
    panel.innerHTML = '<div class="qrcr-head">' +
      '<span class="qrcr-name">QR Code Reader</span>' +
      '<span class="qrcr-close" title="Close">&#10005;</span>' +
      '</div>' +
      '<progress class="qrcr-progress" value="0" max="1"></progress>' +
      '<div class="qrcr-status">Reading the image...</div>' +
      '<div class="qrcr-results"></div>';
    host.append(panel);
    document.documentElement.append(host);

    const progress = panel.querySelector('.qrcr-progress');
    const status = panel.querySelector('.qrcr-status');
    const results = panel.querySelector('.qrcr-results');

    panel.querySelector('.qrcr-close').addEventListener('click', close);
    panel.addEventListener('click', e => {
      const a = e.target.closest && e.target.closest('a.qrcr-link');
      if (a) {
        e.preventDefault();
        e.stopPropagation();
        open(a.href);
      }
    }, true);

    const onkey = e => {
      if (e.key === 'Escape') {
        close();
      }
    };
    document.addEventListener('keydown', onkey, true);

    let placed = null;
    const place = () => {
      const {left, top} = position(target, width);
      if (placed === null || placed.left !== left || placed.top !== top) {
        placed = {left, top};
        host.style.setProperty('left', left + 'px', 'important');
        host.style.setProperty('top', top + 'px', 'important');
      }
    };
    place();

    active = {
      host,
      progress,
      status,
      results,
      onkey,
      raf: 0
    };

    const track = () => {
      if (active === null) {
        return;
      }
      place();
      active.raf = requestAnimationFrame(track);
    };
    active.raf = requestAnimationFrame(track);

    return active;
  };

  const run = async target => {
    const {status, progress, results} = create(target);

    let bitmap = null;
    try {
      status.textContent = 'Reading the image...';
      const prepared = await prepare(target);
      bitmap = prepared.objectUrl;

      status.textContent = 'Scanning the image...';
      const found = await scan(prepared.source, percent => progress.value = percent);

      if (found.length === 0) {
        status.textContent = 'Cannot detect any type of barcode in this image';
      }
      else {
        status.textContent = '';
        for (const e of found) {
          const entry = document.createElement('div');
          entry.className = 'qrcr-entry';

          if (e.symbol) {
            const symbol = document.createElement('span');
            symbol.className = 'qrcr-symbol';
            symbol.textContent = 'Type: ' + e.symbol;
            entry.append(symbol);
          }
          const pre = document.createElement('pre');
          pre.append(urlify(e.data));
          entry.append(pre);
          results.append(entry);
        }
      }
    }
    catch (e) {
      status.textContent = e.message || 'Cannot read this image';
    }
    finally {
      progress.value = 1;
      if (bitmap) {
        URL.revokeObjectURL(bitmap);
      }
    }
  };

  /* ---------------------------- hover ---------------------------- */

  const SIZE = 28;
  const INSET = 6;

  let last = null;
  let badge = null;
  let frame = 0;
  let pointer = null;
  let queued = 0;

  const hideBadge = () => {
    if (badge === null) {
      return;
    }
    cancelAnimationFrame(frame);
    frame = 0;
    badge.host.remove();
    badge = null;
  };

  const inside = (rect, x, y) => (
    x >= rect.left - 1 && x <= rect.right + 1 && y >= rect.top - 1 && y <= rect.bottom + 1
  );

  // keeps the button glued to the bottom-right corner of the image while the
  // page scrolls or reflows, and drops it once the pointer is no longer on it
  const place = () => {
    if (badge === null) {
      return;
    }
    const {host, anchor} = badge;
    const rect = anchor.isConnected ? anchor.getBoundingClientRect() : null;

    if (!rect || rect.width === 0 || rect.height === 0) {
      hideBadge();
      return;
    }
    if (pointer && !inside(rect, pointer.x, pointer.y) &&
        !inside(host.getBoundingClientRect(), pointer.x, pointer.y)) {
      hideBadge();
      return;
    }
    if (rect.right < 0 || rect.bottom < 0 || rect.left > window.innerWidth || rect.top > window.innerHeight) {
      hideBadge();
      return;
    }

    host.style.setProperty('left', Math.max(MARGIN, Math.min(
      rect.right - SIZE - INSET,
      window.innerWidth - SIZE - MARGIN
    )) + 'px', 'important');
    host.style.setProperty('top', Math.max(MARGIN, Math.min(
      rect.bottom - SIZE - INSET,
      window.innerHeight - SIZE - MARGIN
    )) + 'px', 'important');
    frame = requestAnimationFrame(place);
  };

  const scannable = el => {
    if (!el || (el.tagName !== 'IMG' && el.tagName !== 'CANVAS')) {
      return false;
    }
    const rect = el.getBoundingClientRect();

    return rect.width >= MIN_SIZE && rect.height >= MIN_SIZE;
  };

  // the badge lives in the root stacking context; matching the outermost
  // stacking context around the image (plus one) keeps it just above the image
  // without covering page chrome (headers, dialogs, floating widgets)
  const layer = target => {
    let z = 'auto';
    for (let el = target; el; el = el.parentElement || el.getRootNode().host) {
      const value = getComputedStyle(el).zIndex;
      if (value !== 'auto') {
        z = value;
      }
    }
    const n = parseInt(z, 10);

    return Number.isInteger(n) ? String(Math.min(n + 1, 2147483647)) : 'auto';
  };

  const showBadge = target => {
    if (badge && badge.anchor === target) {
      return;
    }
    hideBadge();

    last = target;

    const host = document.createElement('div');
    host.className = 'qrcr-button';
    // the stylesheet can be dropped by a strict page CSP, so the important bits
    // are set inline as well
    for (const [name, value] of Object.entries({
      position: 'fixed',
      'z-index': layer(target),
      display: 'block',
      width: SIZE + 'px',
      height: SIZE + 'px',
      margin: '0',
      padding: '0'
    })) {
      host.style.setProperty(name, value, 'important');
    }

    const button = document.createElement('button');
    button.type = 'button';
    button.title = 'Scan QR Code';
    button.setAttribute('aria-label', 'Scan this image for a QR code');
    button.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true">' +
      '<path fill="currentColor" d="M3 11h8V3H3v8zm2-6h4v4H5V5zM3 21h8v-8H3v8zm2-6h4v4H5v-4z' +
      'M13 3v8h8V3h-8zm6 6h-4V5h4v4zM13 13h2v2h-2zM15 15h2v2h-2zM13 17h2v2h-2z' +
      'M17 13h2v2h-2zM19 15h2v2h-2zM17 17h2v2h-2zM19 19h2v2h-2z"/></svg>';
    // the page's own image handlers must not see the interaction
    for (const type of ['pointerdown', 'mousedown', 'mouseup', 'dblclick']) {
      button.addEventListener(type, e => e.stopPropagation(), true);
    }
    button.addEventListener('click', e => {
      e.preventDefault();
      e.stopPropagation();
      const target = badge.anchor;
      hideBadge();
      run(target);
    });
    host.append(button);
    document.documentElement.append(host);

    badge = {host, anchor: target};
    place();
  };

  const updateBadge = el => {
    if (badge && (el === badge.host || badge.host.contains(el))) {
      return;
    }
    if (scannable(el)) {
      showBadge(el);
    }
    else {
      hideBadge();
    }
  };

  // the pointer position is sampled per frame; it is also used by place() to
  // detect that the image moved away under a stationary cursor
  document.addEventListener('mousemove', e => {
    pointer = {
      x: e.clientX,
      y: e.clientY,
      target: e.target
    };
    if (queued === 0) {
      queued = requestAnimationFrame(() => {
        queued = 0;
        if (pointer) {
          updateBadge(pointer.target);
        }
      });
    }
  }, true);

  const leave = () => {
    pointer = null;
    cancelAnimationFrame(queued);
    queued = 0;
    hideBadge();
  };
  document.documentElement.addEventListener('mouseleave', leave);
  window.addEventListener('blur', leave);

  if (typeof GM_registerMenuCommand === 'function') {
    GM_registerMenuCommand('Scan the last hovered image', () => {
      if (last && last.isConnected) {
        run(last);
      }
      else {
        alert('Hover over an image first');
      }
    });
  }

  style();
}
