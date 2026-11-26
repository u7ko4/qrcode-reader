import {QRCode} from '../window/QRCode.mjs';

const panel = document.getElementById('panel');
const results = document.getElementById('results');
const status = document.getElementById('status');
const progress = document.getElementById('progress');

const qrcode = new QRCode();

let token = '';

const report = () => {
  if (token) {
    parent.postMessage({
      method: 'inline-height',
      token,
      height: Math.ceil(panel.getBoundingClientRect().height)
    }, '*');
  }
};
new ResizeObserver(report).observe(panel);

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
    a.href = match[0];
    a.textContent = match[0];
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.className = 'link';
    a.title = 'Open in a new tab';
    fragment.append(a);
    index = match.index + match[0].length;
  }
  if (index < content.length) {
    fragment.append(content.slice(index));
  }

  return fragment;
};

const render = list => {
  for (const e of list) {
    const div = document.createElement('div');
    div.className = 'entry';

    if (e.symbol) {
      const symbol = document.createElement('span');
      symbol.className = 'symbol';
      symbol.textContent = 'Type: ' + e.symbol;
      div.append(symbol);
    }
    const pre = document.createElement('pre');
    pre.append(urlify(e.data));
    div.append(pre);
    results.append(div);
  }
};

// this page is rendered inside a web page, so the extension APIs are limited
// to the parent (content script) which knows how to reach the background script
const save = list => parent.postMessage({
  method: 'inline-save',
  token,
  list: list.map(e => ({
    data: e.data,
    symbol: e.symbol
  }))
}, '*');

const scan = async href => {
  results.textContent = '';
  status.textContent = 'Reading the image...';
  progress.value = 0;

  let url;

  try {
    const response = await fetch(href);
    if (response.ok === false) {
      throw Error('Cannot load this image (HTTP ' + response.status + ')');
    }
    url = URL.createObjectURL(await response.blob());
    const img = await new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(Error('Cannot read this image file'));
      image.src = url;
    });

    status.textContent = 'Scanning the image...';

    // the detection engines run in a module worker so the page stays responsive
    await qrcode.ready();

    const bitmap = await createImageBitmap(img);
    let found = [];
    try {
      [found] = await qrcode.run(bitmap, 'image', (value, label) => {
        progress.value = value;
        if (label) {
          status.textContent = 'Scanning the image (' + label + ')...';
        }
      });
    }
    finally {
      bitmap.close();
    }

    // the same code might be detected by multiple decoders
    const list = [];
    for (const e of found) {
      if (list.every(o => o.data !== e.data)) {
        list.push(e);
      }
    }

    if (list.length) {
      status.textContent = '';
      render(list);
      save(list);
    }
    else {
      status.textContent = 'Cannot detect any type of barcode in this image';
    }
  }
  catch (e) {
    status.textContent = e.message || 'Cannot read this image';
  }
  finally {
    if (url) {
      URL.revokeObjectURL(url);
    }
    progress.value = 1;
  }
};

window.addEventListener('message', e => {
  if (e.source === parent && e.data && e.data.method === 'inline-init') {
    token = e.data.token;
    scan(e.data.href).then(report);
  }
});

document.getElementById('close').addEventListener('click', () => parent.postMessage({
  method: 'inline-close',
  token
}, '*'));

// open links in a new tab (or window based on the preference)
document.addEventListener('click', e => {
  const a = e.target.closest && e.target.closest('a.link');
  if (a && /^https?:/.test(a.href)) {
    e.preventDefault();
    parent.postMessage({
      method: 'inline-open',
      token,
      url: a.href
    }, '*');
  }
}, true);

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    parent.postMessage({
      method: 'inline-close',
      token
    }, '*');
  }
});

parent.postMessage({
  method: 'inline-ready'
}, '*');
