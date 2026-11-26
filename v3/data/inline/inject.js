'use strict';

/* Injects a panel with the decoding result of an image right below it */
{
  if (window.__qrcodeReaderInline !== true) {
    window.__qrcodeReaderInline = true;

    const ID = 'qrcode-reader-panel';
    const MARGIN = 8;
    const MAX_WIDTH = 460;

    let active = null;

    const close = () => {
      if (active) {
        window.removeEventListener('message', active.listen);
        cancelAnimationFrame(active.raf);
        active.host.remove();
        active = null;
      }
    };

    // document coordinates of the panel; the image is looked up again on every
    // frame so that the panel stays right below the image when the page reflows
    const position = (img, width) => {
      const rect = img && img.isConnected ? img.getBoundingClientRect() : null;

      return {
        left: Math.max(MARGIN, Math.min(
          rect ? rect.left + window.scrollX : window.scrollX + window.innerWidth - width - MARGIN,
          Math.max(document.documentElement.scrollWidth, window.innerWidth) - width - MARGIN
        )),
        top: (rect ? rect.bottom + window.scrollY : window.scrollY) + MARGIN
      };
    };

    const show = href => {
      close();

      const img = [...document.images].find(image => {
        try {
          return image.currentSrc === href || new URL(image.src, location.href).href === href;
        }
        catch (e) {
          return false;
        }
      });
      const rect = img ? img.getBoundingClientRect() : null;

      const max = Math.min(MAX_WIDTH, Math.max(220, window.innerWidth - 2 * MARGIN));
      const width = Math.max(220, Math.min(max, rect ? Math.max(rect.width, 300) : 340));
      const token = Math.random().toString(36).slice(2) + Date.now();

      const host = document.createElement('div');
      host.id = ID;
      for (const [name, value] of Object.entries({
        position: 'absolute',
        'z-index': '2147483647',
        display: 'block',
        width: width + 'px',
        height: 'auto',
        'min-width': '0',
        'min-height': '0',
        'max-width': 'none',
        'max-height': 'none',
        margin: '0',
        padding: '0',
        border: '0',
        transform: 'none',
        'text-align': 'left',
        'line-height': '1.5',
        'font-size': '14px',
        background: 'transparent'
      })) {
        host.style.setProperty(name, value, 'important');
      }

      const root = host.attachShadow({
        mode: 'open'
      });
      const style = document.createElement('style');
      style.textContent = `
        .arrow {
          position: absolute;
          top: -7px;
          left: 12px;
          width: 0;
          height: 0;
          border: 7px solid transparent;
          border-top: none;
          border-bottom-color: #ffd19e;
        }
        .frame {
          display: block;
          width: 100%;
          border: 0;
          border-radius: 6px;
          box-shadow: 0 2px 12px rgba(0, 0, 0, .35);
          background-color: #fff;
          color-scheme: light;
        }
      `;
      const arrow = document.createElement('div');
      arrow.className = 'arrow';
      const frame = document.createElement('iframe');
      frame.className = 'frame';
      frame.title = 'QR Code Reader';
      frame.setAttribute('allowtransparency', 'true');
      frame.style.height = '64px';
      frame.src = chrome.runtime.getURL('data/inline/index.html');

      const listen = e => {
        if (e.source !== frame.contentWindow || !e.data) {
          return;
        }
        if (e.data.method === 'inline-ready') {
          frame.contentWindow.postMessage({
            method: 'inline-init',
            href,
            token
          }, '*');
        }
        else if (e.data.token === token && e.data.method === 'inline-height') {
          frame.style.height = Math.max(40, Math.min(e.data.height, Math.round(window.innerHeight * .75))) + 'px';
        }
        else if (e.data.token === token && e.data.method === 'inline-close') {
          close();
        }
        else if (e.data.token === token && e.data.method === 'inline-open') {
          chrome.runtime.sendMessage({
            method: 'open-url',
            url: e.data.url
          }).catch(() => {});
        }
        else if (e.data.token === token && e.data.method === 'inline-save') {
          chrome.runtime.sendMessage({
            method: 'save-results',
            list: e.data.list
          }).catch(() => {});
        }
      };
      window.addEventListener('message', listen);

      root.append(style, arrow, frame);
      document.documentElement.append(host);

      let placed = null;
      const place = () => {
        const {left, top} = position(img, width);
        if (placed === null || placed.left !== left || placed.top !== top) {
          placed = {left, top};
          host.style.setProperty('top', top + 'px', 'important');
          host.style.setProperty('left', left + 'px', 'important');
        }
      };
      place();

      const track = () => {
        if (!active) {
          return;
        }
        place();
        active.raf = requestAnimationFrame(track);
      };

      active = {
        host,
        listen,
        raf: img ? requestAnimationFrame(track) : 0
      };
    };

    chrome.runtime.onMessage.addListener((request, sender, response) => {
      if (request && request.method === 'inline-scan' && request.href) {
        try {
          show(request.href);
        }
        catch (e) {
          console.warn('QR Code Reader:', e);
        }
        response({
          done: true
        });
      }
    });
  }
}
