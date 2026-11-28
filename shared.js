const ENGINE_NAMES = {
  UE5: 'Unreal Engine 5',
  UE4: 'Unreal Engine 4',
  UE3: 'Unreal Engine 3',
  Unity: 'Unity',
};

const ENGINE_ORDER = ['UE5', 'UE4', 'UE3', 'Unity'];

const HTML_ESCAPES = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

function escapeHtml(text) {
  return String(text).replace(/[&<>"']/g, (character) => HTML_ESCAPES[character]);
}

function highlightMatch(text, query) {
  if (!query) return escapeHtml(text);

  const start = text.toLowerCase().indexOf(query);
  if (start < 0) return escapeHtml(text);

  const end = start + query.length;

  return escapeHtml(text.slice(0, start)) + '<mark>' + escapeHtml(text.slice(start, end)) + '</mark>' + escapeHtml(text.slice(end));
}

function timeAgo(seconds) {
  const elapsed = Math.max(0, Date.now() / 1000 - seconds);

  const units = [
    [31536000, 'y'],
    [2592000, 'mo'],
    [604800, 'w'],
    [86400, 'd'],
    [3600, 'h'],
    [60, 'm'],
  ];

  for (const [unitSeconds, suffix] of units) {
    if (elapsed >= unitSeconds) return Math.floor(elapsed / unitSeconds) + suffix + ' ago';
  }

  return 'just now';
}

function initials(name) {
  const words = name.replace(/[^A-Za-z0-9 ]/g, ' ').split(/\s+/).filter(Boolean);
  if (words.length > 1) return (words[0][0] + words[1][0]).toUpperCase();

  return (words[0] || '?').slice(0, 2).toUpperCase();
}

const THUMB_PARALLEL_LOADS = 4;

const thumbSources = new Map();
const thumbWaiting = new Map();
const thumbQueue = [];

let thumbsInFlight = 0;
let thumbWorkerFailed = false;

const thumbWorker = typeof OffscreenCanvas === 'undefined' ? null : new Worker('thumbs-worker.js');

function loadThumbDirectly(image) {
  image.onerror = () => image.remove();
  image.src = image.dataset.thumb;
}

function applyThumb(image, source) {
  if (!source) {
    image.remove();
    return;
  }

  const decoder = new Image();
  decoder.src = source;

  decoder
    .decode()
    .catch(() => {})
    .then(() => {
      image.src = source;
    });
}

function pumpThumbQueue() {
  while (thumbsInFlight < THUMB_PARALLEL_LOADS && thumbQueue.length) {
    thumbsInFlight++;
    thumbWorker.postMessage(thumbQueue.pop());
  }
}

function requestThumb(image) {
  const url = image.dataset.thumb;

  if (thumbSources.has(url)) {
    applyThumb(image, thumbSources.get(url));
    return;
  }

  if (!thumbWorker || thumbWorkerFailed) {
    loadThumbDirectly(image);
    return;
  }

  const waiting = thumbWaiting.get(url);
  if (waiting) {
    waiting.push(image);
    return;
  }

  thumbWaiting.set(url, [image]);
  thumbQueue.push(url);
  pumpThumbQueue();
}

if (thumbWorker) {
  thumbWorker.onmessage = ({ data }) => {
    thumbsInFlight--;

    const source = data.blob ? URL.createObjectURL(data.blob) : null;
    thumbSources.set(data.url, source);

    for (const image of thumbWaiting.get(data.url) || []) applyThumb(image, source);

    thumbWaiting.delete(data.url);
    pumpThumbQueue();
  };

  thumbWorker.onerror = () => {
    thumbWorkerFailed = true;
    thumbQueue.length = 0;

    for (const images of thumbWaiting.values()) {
      for (const image of images) loadThumbDirectly(image);
    }

    thumbWaiting.clear();
  };
}

const thumbObserver = new IntersectionObserver(
  (entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;

      thumbObserver.unobserve(entry.target);
      requestThumb(entry.target);
    }
  },
  { rootMargin: '200px' },
);

function forEachThumb(node, callback) {
  if (node.nodeType !== Node.ELEMENT_NODE) return;

  if (node.matches('img[data-thumb]')) callback(node);

  for (const image of node.querySelectorAll('img[data-thumb]')) callback(image);
}

new MutationObserver((mutations) => {
  for (const mutation of mutations) {
    for (const node of mutation.removedNodes) forEachThumb(node, (image) => thumbObserver.unobserve(image));

    for (const node of mutation.addedNodes) forEachThumb(node, (image) => thumbObserver.observe(image));
  }
}).observe(document.documentElement, { childList: true, subtree: true });

function thumbHtml(game) {
  const imageUrl = encodeURI(DS_DATA_ROOT + game.directory + 'image.jpg');
  const fallback = '<span class="thumb-fallback">' + escapeHtml(initials(game.name)) + '</span>';

  if (!thumbSources.has(imageUrl)) {
    return '<div class="thumb">' + fallback + '<img data-thumb="' + escapeHtml(imageUrl) + '" alt="" decoding="async"></div>';
  }

  const source = thumbSources.get(imageUrl);
  if (!source) return '<div class="thumb">' + fallback + '</div>';

  return '<div class="thumb">' + fallback + '<img src="' + source + '" alt="" decoding="async"></div>';
}

const EXTERNAL_ICON =
  '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" aria-hidden="true">' +
  '<path d="M7 17L17 7M8 7h9v9"></path></svg>';

function gameUrl(game) {
  return 'viewer.html?hash=' + encodeURIComponent(game.hash);
}

function uploaderLinkHtml(name, link, query = '') {
  const profileUrl = /^https?:\/\//i.test(link || '') ? link : 'https://github.com/' + encodeURIComponent(name);

  return (
    '<a class="uploader-link" href="' + escapeHtml(profileUrl) + '" target="_blank" rel="noopener noreferrer" title="' + escapeHtml(name) + ' on GitHub">' +
    highlightMatch(name, query) + '</a>'
  );
}

function updateStripEdges(strip) {
  const maxScroll = strip.scrollWidth - strip.clientWidth;

  strip.toggleAttribute('data-more-left', strip.scrollLeft > 1);
  strip.toggleAttribute('data-more-right', strip.scrollLeft < maxScroll - 1);
}

function enableHorizontalStrip(strip) {
  strip.classList.add('strip');

  strip.addEventListener(
    'wheel',
    (event) => {
      const canScroll = strip.scrollWidth > strip.clientWidth;
      if (!canScroll || Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;

      strip.scrollLeft += event.deltaY;
      event.preventDefault();
    },
    { passive: false },
  );

  strip.addEventListener('scroll', () => updateStripEdges(strip), { passive: true });

  new ResizeObserver(() => updateStripEdges(strip)).observe(strip);

  updateStripEdges(strip);
}

function isTyping(event) {
  const target = event.target;

  return target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target.isContentEditable;
}

let toastTimer = 0;

function showToast(message) {
  let toast = document.getElementById('toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'toast';
    toast.className = 'toast';
    toast.setAttribute('role', 'status');
    document.body.appendChild(toast);
  }

  toast.textContent = message;
  toast.setAttribute('data-visible', '');

  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.removeAttribute('data-visible'), 1400);
}

function copyText(text, message) {
  navigator.clipboard.writeText(text).then(
    () => showToast(message),
    () => showToast('Copy failed'),
  );
}
