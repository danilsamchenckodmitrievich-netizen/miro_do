(() => {
'use strict';

const $ = s => document.querySelector(s);
const board = $('#board'), world = $('#world'), items = $('#items'), selLayer = $('#sel');
const marquee = $('#marquee'), cursorsLayer = $('#cursors'), propsEl = $('#props');

const PRESETS = ['1', '2', '3', '4', '5', '6'];
const STICKY = ['#fff59d', '#ffcc80', '#f8bbd0', '#e1bee7', '#bbdefb', '#b2ebf2', '#c8e6c9', '#ffffff'];
const USER_COLORS = ['#e53935', '#d81b60', '#8e24aa', '#3949ab', '#1e88e5', '#00897b', '#43a047', '#f4511e', '#6d4c41'];
const CONNECTABLE = new Set(['card', 'sticky', 'shape', 'text', 'group', 'link', 'file']);
const TEXT_EDIT = new Set(['card', 'sticky', 'shape', 'text', 'group', 'arrow']);
const SIDES = { top: [0, -1], right: [1, 0], bottom: [0, 1], left: [-1, 0] };
const OPPOSITE = { top: 'bottom', bottom: 'top', left: 'right', right: 'left' };
const DEFAULT_SIZE = { card: [260, 140], sticky: [200, 200], text: [240, 36], rect: [160, 110], ellipse: [140, 140], diamond: [150, 150], group: [480, 320] };
const SNAP = 10;
const EMBEDDABLE = /(^|\.)(youtube\.com|youtu\.be|vimeo\.com|figma\.com|spotify\.com|loom\.com|codepen\.io|codesandbox\.io|excalidraw\.com|wikipedia\.org|docs\.google\.com)$|google\.[a-z.]+\/maps/;

const ICON = {
  external: '<svg viewBox="0 0 24 24"><path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/></svg>',
  download: '<svg viewBox="0 0 24 24"><path d="M12 4v11M7 10l5 5 5-5M5 20h14"/></svg>',
  edit: '<svg viewBox="0 0 24 24"><path d="M4 20h4L19 9l-4-4L4 16z"/><path d="m13.5 6.5 4 4"/></svg>',
  front: '<svg viewBox="0 0 24 24"><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M4 16V5a1 1 0 0 1 1-1h11"/></svg>',
  back: '<svg viewBox="0 0 24 24"><rect x="4" y="4" width="12" height="12" rx="2"/><path d="M20 8v11a1 1 0 0 1-1 1H8"/></svg>',
  copy: '<svg viewBox="0 0 24 24"><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/></svg>',
  trash: '<svg viewBox="0 0 24 24"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/></svg>',
  curve: '<svg viewBox="0 0 24 24"><path d="M4 18C4 9 20 15 20 6"/></svg>',
  straight: '<svg viewBox="0 0 24 24"><path d="M4 19 20 5"/></svg>',
  elbow: '<svg viewBox="0 0 24 24"><path d="M4 18h8V6h8"/></svg>',
  endNone: '<svg viewBox="0 0 24 24"><path d="M4 12h16"/></svg>',
  endOne: '<svg viewBox="0 0 24 24"><path d="M4 12h15M14 7l5 5-5 5"/></svg>',
  endBoth: '<svg viewBox="0 0 24 24"><path d="M5 12h14M10 7l-5 5 5 5M14 7l5 5-5 5"/></svg>',
  label: '<svg viewBox="0 0 24 24"><rect x="3" y="7" width="18" height="10" rx="3"/><path d="M7 12h10"/></svg>',
  globe: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 2.5 3.5 5.5 3.5 9s-1 6.5-3.5 9c-2.5-2.5-3.5-5.5-3.5-9S9.5 5.5 12 3z"/></svg>',
  card: '<svg viewBox="0 0 24 24"><rect x="3.5" y="4.5" width="17" height="15" rx="3"/><path d="M7.5 9h9M7.5 12.5h9M7.5 16h5"/></svg>',
  fill: '<svg class="row-icon" viewBox="0 0 24 24"><path d="M5 12 12 5l7 7-7 7z"/><path d="M5 12h14"/></svg>',
  pen: '<svg class="row-icon" viewBox="0 0 24 24"><path d="M4 20l1-5L16 4l4 4L9 19z"/></svg>',
  child: '<svg viewBox="0 0 24 24"><rect x="3" y="8" width="7" height="8" rx="2"/><rect x="15" y="4" width="6" height="6" rx="1.5"/><rect x="15" y="14" width="6" height="6" rx="1.5"/><path d="M10 12h2c1 0 1.5-.5 1.5-1.5V8.5c0-1 .5-1.5 1.5-1.5M13.5 12v3.5c0 1 .5 1.5 1.5 1.5"/></svg>',
};

// ---------- utils ----------
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const escBr = s => esc(s).replace(/\n/g, '<br>');
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const isPreset = c => /^[1-6]$/.test(c || '');
const ink = c => !c ? 'var(--ink)' : isPreset(c) ? `var(--c${c})` : c;
const safeUrl = u => /^https?:\/\//i.test(u || '') ? u : '#';
const safeSrc = u => /^(https?:|data:|blob:)/i.test(u || '') ? u : '';
const fmtSize = n => !n ? '' : n < 1024 ? n + ' Б' : n < 1048576 ? (n / 1024).toFixed(0) + ' КБ' : (n / 1048576).toFixed(1) + ' МБ';
const stamp = () => new Date().toISOString().replace(/\D/g, '').slice(0, 14);
const store = {
  get(k) { try { return localStorage.getItem('miro-do:' + k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem('miro-do:' + k, v); } catch { /* storage unavailable */ } },
};
// board data can hold images, so it lives in IndexedDB rather than the 5 MB localStorage
const idb = (() => {
  let dbp = null;
  const open = () => dbp || (dbp = new Promise((res, rej) => {
    const r = indexedDB.open('miro-do', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('kv');
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  }));
  const run = async (mode, fn) => {
    const db = await open();
    return new Promise((res, rej) => {
      const t = db.transaction('kv', mode), req = fn(t.objectStore('kv'));
      t.oncomplete = () => res(req.result);
      t.onerror = () => rej(t.error);
    });
  };
  return {
    get: k => run('readonly', s => s.get(k)).catch(() => undefined),
    set: (k, v) => run('readwrite', s => s.put(v, k)).catch(() => {}),
  };
})();

// ---------- identity ----------
let boardId = location.hash.slice(1);
if (!boardId) { boardId = Math.random().toString(36).slice(2, 10); history.replaceState(null, '', '#' + boardId); }
addEventListener('hashchange', () => location.reload());
const clientId = Math.random().toString(36).slice(2, 10);
let userName = store.get('name') || 'Гость ' + Math.floor(100 + Math.random() * 900);
const userColor = store.get('color') || USER_COLORS[Math.floor(Math.random() * USER_COLORS.length)];
store.set('name', userName); store.set('color', userColor);

// ---------- state ----------
let objs = new Map();
let meta = { title: 'Без названия' };
const view = { x: innerWidth / 2, y: innerHeight / 2, z: 1 };
let tool = 'select', selected = new Set(), editingId = null, drag = null, spaceDown = false, hoverId = null;
let stickyFill = STICKY[0];
let snapOn = store.get('snap') !== '0';
let minimapOn = store.get('minimap') !== '0';
const undoStack = [], redoStack = [];
let snapshot = null;
const pointers = new Map();
const snapIf = v => snapOn ? Math.round(v / SNAP) * SNAP : v;

const serialize = () => JSON.stringify([...objs.values()]);
const zs = () => [...objs.values()].map(o => o.z || 0);
const maxZ = () => Math.max(0, ...zs());
const minZ = () => Math.min(0, ...zs());
const selectionObjs = () => [...selected].map(id => objs.get(id)).filter(Boolean);

// ---------- markdown ----------
if (window.DOMPurify) {
  DOMPurify.addHook('afterSanitizeAttributes', n => {
    if (n.tagName === 'A') { n.setAttribute('target', '_blank'); n.setAttribute('rel', 'noopener noreferrer'); }
  });
}
const mdCache = new Map();
function md(text) {
  text = text || '';
  if (mdCache.has(text)) return mdCache.get(text);
  let html;
  if (!window.marked || !window.DOMPurify) {
    html = `<p>${escBr(text)}</p>`;
  } else {
    // pull formulas out first so markdown does not mangle underscores and asterisks inside them
    const math = [];
    let src = text.replace(/\$\$([\s\S]+?)\$\$|\$([^\s$](?:[^$\n]*?[^\s$])?)\$/g, (m, block, inline) => {
      math.push([block ?? inline, block !== undefined]);
      return `§§${math.length - 1}§§`;
    });
    src = src.replace(/==([^=\n]+)==/g, '<mark>$1</mark>');
    html = DOMPurify.sanitize(marked.parse(src, { gfm: true, breaks: true }));
    html = html.replace(/§§(\d+)§§/g, (m, i) => {
      const [tex, block] = math[+i];
      if (!window.katex) return esc(tex);
      try { return katex.renderToString(tex, { displayMode: block, throwOnError: false, strict: false }); } catch { return esc(tex); }
    });
  }
  if (mdCache.size > 400) mdCache.clear();
  mdCache.set(text, html);
  return html;
}
function toggleTask(o, index) {
  let i = -1;
  o.text = o.text.replace(/^(\s*(?:[-*+]|\d+\.)\s+\[)([ xX])(\])/gm, (m, a, c, b) => (++i === index ? a + (c === ' ' ? 'x' : ' ') + b : m));
}

// ---------- history ----------
function beginChange() { if (snapshot === null) snapshot = serialize(); }
function endChange() {
  if (snapshot === null) return;
  if (serialize() !== snapshot) {
    undoStack.push(snapshot);
    if (undoStack.length > 100) undoStack.shift();
    redoStack.length = 0;
  }
  snapshot = null;
}
function restore(json) {
  const next = new Map(JSON.parse(json).map(o => [o.id, o]));
  objs.forEach((o, id) => { if (!next.has(id)) { removeEl(id); sync.del(id); } });
  next.forEach((o, id) => { const cur = objs.get(id); if (!cur || JSON.stringify(cur) !== JSON.stringify(o)) sync.dirty(id); });
  objs = next;
  selected = new Set([...selected].filter(id => objs.has(id)));
  renderAll(); renderProps(); saveSoon();
}
function undo() { finishEdit(); if (!undoStack.length) return; redoStack.push(serialize()); restore(undoStack.pop()); }
function redo() { finishEdit(); if (!redoStack.length) return; undoStack.push(serialize()); restore(redoStack.pop()); }

// ---------- persistence ----------
let saveTimer = 0;
function saveSoon() { clearTimeout(saveTimer); saveTimer = setTimeout(saveNow, 400); }
function saveNow() {
  idb.set('board:' + boardId, serialize());
  idb.set('meta:' + boardId, JSON.stringify(meta));
  let list = [];
  try { list = JSON.parse(store.get('recent') || '[]'); } catch { /* corrupted list */ }
  list = list.filter(b => b.id !== boardId);
  list.unshift({ id: boardId, title: meta.title, t: Date.now() });
  store.set('recent', JSON.stringify(list.slice(0, 40)));
}
function normalize(o) {
  if (o.type === 'image') { o.type = 'file'; o.mime = o.mime || 'image/png'; o.name = o.name || 'image.png'; }
  if (o.type === 'arrow') { o.style = o.style || 'curve'; o.ends = o.ends || 'end'; o.label = o.label || ''; }
  return o;
}

// ---------- mutations ----------
function setObj(o) {
  objs.set(o.id, o);
  sync.dirty(o.id);
  renderObj(o);
  if (o.type !== 'arrow') renderLinked(o.id);
  saveSoon(); scheduleUI();
}
function removeObj(id) {
  if (!objs.has(id)) return;
  objs.delete(id); removeEl(id); sync.del(id); selected.delete(id);
  [...objs.values()].forEach(a => { if (a.type === 'arrow' && (a.a.id === id || a.b.id === id)) removeObj(a.id); });
  saveSoon(); scheduleUI();
}
function addObj(o) { o.id = o.id || uid(); o.z = maxZ() + 1; setObj(o); return o; }

// ---------- geometry ----------
const toWorld = e => ({ x: (e.clientX - view.x) / view.z, y: (e.clientY - view.y) / view.z });
const center = o => ({ x: o.x + o.w / 2, y: o.y + o.h / 2 });
const intersects = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
const contains = (g, o) => o.x >= g.x && o.y >= g.y && o.x + o.w <= g.x + g.w && o.y + o.h <= g.y + g.h;
function sidePoint(o, s) {
  return s === 'top' ? { x: o.x + o.w / 2, y: o.y } : s === 'bottom' ? { x: o.x + o.w / 2, y: o.y + o.h }
    : s === 'left' ? { x: o.x, y: o.y + o.h / 2 } : { x: o.x + o.w, y: o.y + o.h / 2 };
}
function autoSide(o, toward) {
  const c = center(o), dx = (toward.x - c.x) / (o.w || 1), dy = (toward.y - c.y) / (o.h || 1);
  return Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'bottom' : 'top');
}
function nearestSide(o, p) {
  let best = 'right', bd = Infinity;
  for (const s in SIDES) { const q = sidePoint(o, s), d = Math.hypot(q.x - p.x, q.y - p.y); if (d < bd) { bd = d; best = s; } }
  return best;
}
function edgeGeom(e) {
  const na = e.a.id && objs.get(e.a.id), nb = e.b.id && objs.get(e.b.id);
  const ra = na ? center(na) : e.a, rb = nb ? center(nb) : e.b;
  const sa = na ? (e.a.side && e.a.side !== 'auto' ? e.a.side : autoSide(na, rb)) : null;
  const sb = nb ? (e.b.side && e.b.side !== 'auto' ? e.b.side : autoSide(nb, ra)) : null;
  const p1 = na ? sidePoint(na, sa) : { x: e.a.x, y: e.a.y };
  const p2 = nb ? sidePoint(nb, sb) : { x: e.b.x, y: e.b.y };
  const d = Math.hypot(p2.x - p1.x, p2.y - p1.y) || 1;
  const u = { x: (p2.x - p1.x) / d, y: (p2.y - p1.y) / d };
  const n1 = sa ? { x: SIDES[sa][0], y: SIDES[sa][1] } : u;
  const n2 = sb ? { x: SIDES[sb][0], y: SIDES[sb][1] } : { x: -u.x, y: -u.y };
  const k = clamp(d * 0.45, 30, 220);
  return {
    p1, p2, n1, n2, sa, sb,
    c1: { x: p1.x + n1.x * k, y: p1.y + n1.y * k },
    c2: { x: p2.x + n2.x * k, y: p2.y + n2.y * k },
  };
}
function edgePath(e, g) {
  const { p1, p2, c1, c2, n1, n2 } = g;
  if (e.style === 'straight') return { d: `M${p1.x} ${p1.y}L${p2.x} ${p2.y}`, mid: { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 }, from1: p2, from2: p1, pts: [p1, p2] };
  if (e.style === 'elbow') {
    const off = 26;
    const a = { x: p1.x + n1.x * off, y: p1.y + n1.y * off }, b = { x: p2.x + n2.x * off, y: p2.y + n2.y * off };
    const pts = Math.abs(n1.x) >= Math.abs(n1.y)
      ? [p1, a, { x: (a.x + b.x) / 2, y: a.y }, { x: (a.x + b.x) / 2, y: b.y }, b, p2]
      : [p1, a, { x: a.x, y: (a.y + b.y) / 2 }, { x: b.x, y: (a.y + b.y) / 2 }, b, p2];
    return { d: 'M' + pts.map(q => `${q.x} ${q.y}`).join('L'), mid: { x: (pts[2].x + pts[3].x) / 2, y: (pts[2].y + pts[3].y) / 2 }, from1: a, from2: b, pts };
  }
  return {
    d: `M${p1.x} ${p1.y}C${c1.x} ${c1.y} ${c2.x} ${c2.y} ${p2.x} ${p2.y}`,
    mid: { x: (p1.x + 3 * c1.x + 3 * c2.x + p2.x) / 8, y: (p1.y + 3 * c1.y + 3 * c2.y + p2.y) / 8 },
    from1: c1, from2: c2, pts: [p1, p2, c1, c2],
  };
}
function boundsOf(list) {
  if (!list.length) return null;
  let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
  list.forEach(o => { x1 = Math.min(x1, o.x); y1 = Math.min(y1, o.y); x2 = Math.max(x2, o.x + o.w); y2 = Math.max(y2, o.y + o.h); });
  return { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
}

// ---------- rendering ----------
function getEl(o) {
  let el = document.getElementById('o-' + o.id);
  if (!el) {
    el = document.createElement('div');
    el.id = 'o-' + o.id; el.dataset.id = o.id;
    items.appendChild(el);
  }
  const live = selected.size === 1 && selected.has(o.id) && (o.type === 'link' || o.type === 'file');
  el.className = 'obj ' + o.type + (selected.has(o.id) ? ' selected' : '') + (live ? ' live' : '');
  return el;
}
function removeEl(id) { document.getElementById('o-' + id)?.remove(); }

function domainOf(url) { try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return url; } }
function embedUrl(url) {
  try {
    const u = new URL(url), h = u.hostname.replace(/^(www|m)\./, '');
    if (h === 'youtube.com' && u.searchParams.get('v')) return 'https://www.youtube-nocookie.com/embed/' + u.searchParams.get('v');
    if (h === 'youtube.com' && u.pathname.startsWith('/shorts/')) return 'https://www.youtube-nocookie.com/embed/' + u.pathname.split('/')[2];
    if (h === 'youtu.be') return 'https://www.youtube-nocookie.com/embed' + u.pathname;
    if (h === 'vimeo.com' && /^\/\d+/.test(u.pathname)) return 'https://player.vimeo.com/video' + u.pathname;
    if (h === 'figma.com') return 'https://www.figma.com/embed?embed_host=share&url=' + encodeURIComponent(url);
    if (h === 'open.spotify.com' && !u.pathname.startsWith('/embed')) return 'https://open.spotify.com/embed' + u.pathname;
    if (h === 'loom.com') return url.replace('/share/', '/embed/');
    if (h === 'codepen.io') return url.replace('/pen/', '/embed/');
  } catch { /* not a URL */ }
  return url;
}
const isEmbeddable = url => { try { const u = new URL(url); return EMBEDDABLE.test(u.hostname) || EMBEDDABLE.test(u.hostname + u.pathname); } catch { return false; } };
const favicon = dom => `https://icons.duckduckgo.com/ip3/${encodeURIComponent(dom)}.ico`;
const blobCache = new Map();
function blobify(src) {
  if (!src.startsWith('data:')) return src;
  if (blobCache.has(src)) return blobCache.get(src);
  try {
    const [head, b64] = src.split(','), mime = head.slice(5).split(';')[0];
    const bin = atob(b64), arr = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    const url = URL.createObjectURL(new Blob([arr], { type: mime }));
    blobCache.set(src, url);
    return url;
  } catch { return src; }
}

function shapeSvg(o) {
  const st = `style="fill:${o.color ? `color-mix(in srgb, ${ink(o.color)} 28%, var(--card-bg))` : 'var(--card-bg)'};stroke:${ink(o.stroke)}"`;
  const a = `${st} stroke-width="2" vector-effect="non-scaling-stroke"`;
  const body = o.shape === 'ellipse' ? `<ellipse cx="50" cy="50" rx="50" ry="50" ${a}/>`
    : o.shape === 'diamond' ? `<polygon points="50,0 100,50 50,100 0,50" ${a}/>`
    : `<rect x="0" y="0" width="100" height="100" rx="4" ${a}/>`;
  return `<svg viewBox="0 0 100 100" preserveAspectRatio="none">${body}</svg>`;
}
function smoothPath(pts) {
  if (!pts.length) return '';
  if (pts.length < 3) return `M${pts[0][0]} ${pts[0][1]}` + pts.slice(1).map(p => `L${p[0]} ${p[1]}`).join('') + (pts.length === 1 ? 'l0.01 0' : '');
  let d = `M${pts[0][0]} ${pts[0][1]}`;
  for (let i = 1; i < pts.length - 1; i++) {
    d += `Q${pts[i][0]} ${pts[i][1]} ${(pts[i][0] + pts[i + 1][0]) / 2} ${(pts[i][1] + pts[i + 1][1]) / 2}`;
  }
  const l = pts[pts.length - 1];
  return d + `L${l[0]} ${l[1]}`;
}
function linkHTML(o) {
  const dom = domainOf(o.url), href = esc(safeUrl(o.url));
  const head = `<div class="node-head"><img class="fav" src="${favicon(dom)}" alt="" onerror="this.style.visibility='hidden'">`
    + `<span class="dom">${esc(dom)}</span><a class="open" href="${href}" target="_blank" rel="noopener" title="Открыть в новой вкладке">${ICON.external}</a></div>`;
  if (o.embed) {
    return head + `<div class="node-body"><iframe src="${esc(safeUrl(embedUrl(o.url)))}" loading="lazy" referrerpolicy="no-referrer"`
      + ` sandbox="allow-scripts allow-same-origin allow-popups allow-forms allow-presentation" allow="autoplay; encrypted-media; picture-in-picture; fullscreen"></iframe><div class="shield"></div></div>`;
  }
  return head + `<div class="node-body preview"><img class="fav-big" src="${favicon(dom)}" alt="" onerror="this.style.visibility='hidden'">`
    + `<div class="ltitle">${esc(o.title || dom)}</div><div class="lurl">${esc(o.url)}</div></div>`;
}
function fileHTML(o) {
  const src = safeSrc(o.src), mime = o.mime || '', name = o.name || 'файл';
  const label = `<div class="file-label">${esc(name)}</div>`;
  if (mime.startsWith('image/')) return label + `<img src="${esc(src)}" alt="" draggable="false">`;
  if (mime.startsWith('video/')) return label + `<video src="${esc(src)}" controls preload="metadata"></video>`;
  const open = `<a class="open" href="${esc(src)}" download="${esc(name)}" title="Скачать">${ICON.download}</a>`;
  if (mime === 'application/pdf') {
    return `<div class="file-box"><div class="node-head"><span class="ficon" style="width:22px;height:22px;border-radius:6px;font-size:8px">PDF</span>`
      + `<span class="dom">${esc(name)}</span>${open}</div><div class="node-body"><iframe src="${esc(blobify(src))}"></iframe><div class="shield"></div></div></div>`;
  }
  const ext = (name.includes('.') ? name.split('.').pop() : 'file').slice(0, 4).toUpperCase();
  const audio = mime.startsWith('audio/') ? `<audio src="${esc(src)}" controls preload="metadata"></audio>` : '';
  return label + `<div class="file-box"><div class="file-row"><div class="ficon">${esc(ext)}</div><div class="finfo">`
    + `<div class="fname">${esc(name)}</div><div class="fsize">${fmtSize(o.size)}</div>${audio}</div>${open}</div></div>`;
}
function nodeHTML(o) {
  switch (o.type) {
    case 'card': return `<div class="md">${md(o.text)}</div>`;
    case 'sticky': return `<div class="label">${escBr(o.text)}</div>`;
    case 'shape': return shapeSvg(o) + `<div class="label">${escBr(o.text)}</div>`;
    case 'text': return `<div class="label" style="color:${ink(o.stroke)};font-size:${o.fs || 24}px">${escBr(o.text)}</div>`;
    case 'group': return `<div class="group-label">${esc(o.label || 'Группа')}</div>`;
    case 'link': return linkHTML(o);
    case 'file': return fileHTML(o);
    case 'pen': {
      const d = smoothPath(o.pts);
      return `<svg width="100%" height="100%" viewBox="0 0 ${o.vw} ${o.vh}" preserveAspectRatio="none">`
        + `<path class="hit" d="${d}" stroke-width="16" vector-effect="non-scaling-stroke"/>`
        + `<path d="${d}" fill="none" style="stroke:${ink(o.stroke)}" stroke-width="${o.sw || 3}" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke"/></svg>`;
    }
  }
  return '';
}
const nodeSig = o => [o.type, o.text, o.color, o.stroke, o.label, o.url, o.embed, o.title, o.name, o.mime,
  o.src ? o.src.length + o.src.slice(-24) : '', o.shape, o.fs, o.sw, o.pts ? o.pts.length : 0, o.vw, o.vh].join('\u0001');
function nodeStyle(o) {
  let s = `left:${o.x}px;top:${o.y}px;width:${o.w}px;z-index:${o.type === 'group' ? o.z - 1e6 : o.z};`;
  if (o.type !== 'text') s += `height:${o.h}px;`;
  if (o.type === 'sticky') s += `background:${o.color};`;
  else if (o.color && ['card', 'group', 'link', 'file'].includes(o.type)) s += `--node-color:${ink(o.color)};`;
  return s;
}
function fitText(el, o) {
  const lab = el.querySelector('.label');
  if (!lab) return;
  let fs = o.type === 'sticky' ? 28 : 20;
  const round = o.type === 'shape' && o.shape !== 'rect';
  lab.style.maxWidth = round ? '72%' : '';
  const maxH = round ? o.h * 0.75 : o.h;
  lab.style.fontSize = fs + 'px';
  while (fs > 8 && lab.offsetHeight > maxH) { fs--; lab.style.fontSize = fs + 'px'; }
}
function renderObj(o) {
  if (o.type === 'arrow') return renderArrow(o);
  const el = getEl(o);
  el.style.cssText = nodeStyle(o);
  if (editingId === o.id) return;
  const sig = nodeSig(o);
  if (el._sig !== sig) { el._sig = sig; el._size = ''; el.innerHTML = nodeHTML(o); }
  const size = o.w + 'x' + o.h;
  if (el._size !== size) {
    el._size = size;
    if (o.type === 'sticky' || o.type === 'shape') fitText(el, o);
    if (o.type === 'text') {
      const h = el.offsetHeight;
      if (h && Math.abs(h - o.h) > 0.5) { o.h = h; el._size = o.w + 'x' + o.h; renderLinked(o.id); }
    }
  }
}
function arrowHead(tip, from, size) {
  const ang = Math.atan2(tip.y - from.y, tip.x - from.x);
  const p = a => `${tip.x - size * Math.cos(ang + a)},${tip.y - size * Math.sin(ang + a)}`;
  return `${tip.x},${tip.y} ${p(0.42)} ${p(-0.42)}`;
}
function renderArrow(o) {
  const g = edgeGeom(o), P = edgePath(o, g);
  const pad = 26, xs = P.pts.map(q => q.x), ys = P.pts.map(q => q.y);
  o.x = Math.min(...xs) - pad; o.y = Math.min(...ys) - pad;
  o.w = Math.max(...xs) - o.x + pad; o.h = Math.max(...ys) - o.y + pad;
  const el = getEl(o);
  el.style.cssText = `left:${o.x}px;top:${o.y}px;width:${o.w}px;height:${o.h}px;z-index:${o.z}`;
  if (editingId === o.id) return;
  const sw = o.sw || 2, col = ink(o.stroke), hs = 10 + sw * 2;
  const heads = (o.ends !== 'none' ? `<polygon class="head" points="${arrowHead(g.p2, P.from2, hs)}" style="fill:${col};stroke:${col}" stroke-width="1" stroke-linejoin="round"/>` : '')
    + (o.ends === 'both' ? `<polygon class="head" points="${arrowHead(g.p1, P.from1, hs)}" style="fill:${col};stroke:${col}" stroke-width="1" stroke-linejoin="round"/>` : '');
  el.innerHTML = `<svg width="${o.w}" height="${o.h}"><g transform="translate(${-o.x} ${-o.y})">`
    + `<path class="hit" d="${P.d}" stroke-width="18"/>`
    + `<path class="line" d="${P.d}" fill="none" style="stroke:${col}" stroke-width="${sw}" stroke-linejoin="round" stroke-linecap="round"/>${heads}</g></svg>`
    + (o.label ? `<div class="edge-label" style="left:${P.mid.x - o.x}px;top:${P.mid.y - o.y}px">${escBr(o.label)}</div>` : '');
}
function renderLinked(id) {
  objs.forEach(a => { if (a.type === 'arrow' && (a.a.id === id || a.b.id === id)) renderArrow(a); });
}
function renderAll() {
  items.querySelectorAll('.obj').forEach(el => { if (!objs.has(el.dataset.id)) el.remove(); });
  objs.forEach(o => { if (o.type !== 'arrow') renderObj(o); });
  objs.forEach(o => { if (o.type === 'arrow') renderObj(o); });
  scheduleUI();
}

// ---------- view ----------
function applyView() {
  world.style.transform = `translate(${view.x}px,${view.y}px) scale(${view.z})`;
  world.style.setProperty('--inv', 1 / view.z);
  const g = 22 * view.z;
  board.style.backgroundSize = `${g}px ${g}px`;
  board.style.backgroundPosition = `${view.x}px ${view.y}px`;
  board.style.backgroundImage = view.z < 0.3 ? 'none' : '';
  $('#zoomlabel').textContent = Math.round(view.z * 100) + '%';
  scheduleUI();
}
function zoomAt(sx, sy, factor) {
  const nz = clamp(view.z * factor, 0.08, 4);
  const wx = (sx - view.x) / view.z, wy = (sy - view.y) / view.z;
  view.z = nz; view.x = sx - wx * nz; view.y = sy - wy * nz;
  applyView();
}
function animateTo(t, ms = 280) {
  const s = { ...view }, t0 = performance.now();
  cancelAnimationFrame(animateTo.raf);
  const step = now => {
    const k = Math.min(1, (now - t0) / ms), e = 1 - Math.pow(1 - k, 3);
    view.x = s.x + (t.x - s.x) * e; view.y = s.y + (t.y - s.y) * e; view.z = s.z + (t.z - s.z) * e;
    applyView();
    if (k < 1) animateTo.raf = requestAnimationFrame(step);
  };
  animateTo.raf = requestAnimationFrame(step);
}
function viewFor(b, maxZoom = 1.2) {
  const m = 110, z = clamp(Math.min((innerWidth - m * 2) / Math.max(b.w, 1), (innerHeight - m * 2) / Math.max(b.h, 1)), 0.08, maxZoom);
  return { z, x: innerWidth / 2 - (b.x + b.w / 2) * z, y: innerHeight / 2 - (b.y + b.h / 2) * z };
}
function fitView(anim = true) {
  const b = boundsOf([...objs.values()]);
  const t = b ? viewFor(b) : { x: innerWidth / 2, y: innerHeight / 2, z: 1 };
  if (anim) animateTo(t); else { Object.assign(view, t); applyView(); }
}
const viewCenter = () => ({ x: (innerWidth / 2 - view.x) / view.z, y: (innerHeight / 2 - view.y) / view.z });

// ---------- selection UI, props, minimap ----------
let uiQueued = false;
function scheduleUI() {
  if (uiQueued) return;
  uiQueued = true;
  requestAnimationFrame(() => {
    uiQueued = false;
    renderSelection(); drawMinimap();
    $('#hint').hidden = objs.size > 0;
  });
}
function select(ids) {
  selected = new Set(ids);
  items.querySelectorAll('.obj').forEach(el => {
    const o = objs.get(el.dataset.id);
    el.classList.toggle('selected', selected.has(el.dataset.id));
    el.classList.toggle('live', selected.size === 1 && selected.has(el.dataset.id) && (o?.type === 'link' || o?.type === 'file'));
  });
  renderProps(); scheduleUI();
}
function renderSelection() {
  let html = '';
  const list = selectionObjs();
  const editingBox = editingId && list.length === 1;
  if (list.length && !editingBox) {
    if (list.length === 1 && list[0].type === 'arrow') {
      const g = edgeGeom(list[0]);
      html += `<div class="handle" data-handle="a" style="left:${g.p1.x}px;top:${g.p1.y}px"></div><div class="handle" data-handle="b" style="left:${g.p2.x}px;top:${g.p2.y}px"></div>`;
    } else {
      const b = boundsOf(list);
      if (list.length > 1) html += `<div class="frame" style="left:${b.x - 6}px;top:${b.y - 6}px;width:${b.w + 12}px;height:${b.h + 12}px"></div>`;
      if (list.length === 1 && list[0].type !== 'pen') {
        [['nw', b.x, b.y], ['ne', b.x + b.w, b.y], ['sw', b.x, b.y + b.h], ['se', b.x + b.w, b.y + b.h]]
          .forEach(([h, x, y]) => { html += `<div class="handle" data-handle="${h}" style="left:${x}px;top:${y}px"></div>`; });
      }
    }
  }
  if (!drag && !editingId && (tool === 'select' || tool === 'arrow')) {
    const ids = new Set();
    if (hoverId && objs.has(hoverId)) ids.add(hoverId);
    if (list.length === 1 && CONNECTABLE.has(list[0].type)) ids.add(list[0].id);
    ids.forEach(id => {
      const o = objs.get(id);
      for (const s in SIDES) { const p = sidePoint(o, s); html += `<div class="dot" data-connect="${s}" data-node="${id}" style="left:${p.x}px;top:${p.y}px"></div>`; }
    });
  }
  selLayer.innerHTML = html;
  positionProps(list);
}
function positionProps(list) {
  if (!list.length || editingId || !propsEl.innerHTML) { propsEl.hidden = true; return; }
  propsEl.hidden = false;
  propsEl.classList.toggle('ghost', !!drag && drag.mode !== 'pinch');
  const b = boundsOf(list);
  const top = b.y * view.z + view.y, bottom = (b.y + b.h) * view.z + view.y;
  const lift = list.some(o => o.type === 'group' || o.type === 'file') ? 42 : 14;
  let y = top - propsEl.offsetHeight - lift;
  if (y < 72) y = Math.min(bottom + 14, innerHeight - propsEl.offsetHeight - 70);
  const half = propsEl.offsetWidth / 2;
  const x = clamp((b.x + b.w / 2) * view.z + view.x, half + 12, innerWidth - half - 12);
  propsEl.style.left = x + 'px';
  propsEl.style.top = Math.max(72, y) + 'px';
}
const btn = (act, icon, tip, on, cls = '') => `<button data-act="${act}" data-tip="${tip}" class="${on ? 'on ' : ''}${cls}">${icon}</button>`;
function swatchRow(kind, values, cur, title) {
  return values.map(c => `<button class="sw${c === cur ? ' on' : ''}${c ? '' : ' none'}" data-${kind}="${c}" style="--swatch:${c ? ink(c) : 'none'}" title="${title}"></button>`).join('');
}
function renderProps() {
  const list = selectionObjs();
  if (!list.length) { propsEl.innerHTML = ''; scheduleUI(); return; }
  const one = list.length === 1 ? list[0] : null;
  const parts = [];
  const fillable = list.find(o => ['card', 'group', 'link', 'file', 'shape'].includes(o.type));
  if (fillable) parts.push(ICON.fill + swatchRow('fill', ['', ...PRESETS], fillable.color || '', 'Цвет'));
  const st = list.find(o => o.type === 'sticky');
  if (st) parts.push(swatchRow('sticky', STICKY, st.color, 'Цвет стикера'));
  const strokable = list.find(o => ['text', 'pen', 'arrow', 'shape'].includes(o.type));
  if (strokable) parts.push(ICON.pen + swatchRow('stroke', ['', ...PRESETS], strokable.stroke || '', 'Цвет линии'));
  if (one?.type === 'arrow') {
    parts.push(btn('style-curve', ICON.curve, 'Кривая', one.style === 'curve') + btn('style-straight', ICON.straight, 'Прямая', one.style === 'straight') + btn('style-elbow', ICON.elbow, 'Ломаная', one.style === 'elbow'));
    parts.push(btn('ends-none', ICON.endNone, 'Без стрелки', one.ends === 'none') + btn('ends-end', ICON.endOne, 'Стрелка', one.ends === 'end') + btn('ends-both', ICON.endBoth, 'В обе стороны', one.ends === 'both'));
    parts.push(btn('edit', ICON.label, 'Подпись (Enter)'));
  }
  if (one?.type === 'link') parts.push(btn('link-open', ICON.external, 'Открыть сайт') + btn('link-embed', one.embed ? ICON.card : ICON.globe, one.embed ? 'Показать превью' : 'Встроить сайт') + btn('link-edit', ICON.edit, 'Изменить ссылку'));
  if (one?.type === 'file') parts.push(btn('file-open', ICON.download, 'Скачать'));
  if (one && TEXT_EDIT.has(one.type) && one.type !== 'arrow') parts.push(btn('edit', ICON.edit, 'Редактировать (Enter)'));
  if (one && ['card', 'sticky', 'shape'].includes(one.type)) parts[parts.length - 1] += btn('child', ICON.child, 'Связанная карточка (Tab)');
  parts.push(btn('front', ICON.front, 'Вперёд ( ] )') + btn('back', ICON.back, 'Назад ( [ )') + btn('duplicate', ICON.copy, 'Дублировать (Ctrl+D)') + btn('delete', ICON.trash, 'Удалить (Del)', false, 'danger'));
  propsEl.innerHTML = parts.join('<span class="sep"></span>');
  scheduleUI();
}
propsEl.addEventListener('pointerdown', e => e.preventDefault());
propsEl.addEventListener('click', e => {
  const b = e.target.closest('button');
  if (!b) return;
  const d = b.dataset;
  if (!('fill' in d || 'stroke' in d || 'sticky' in d)) return;
  beginChange();
  selectionObjs().forEach(o => {
    if ('fill' in d && ['card', 'group', 'link', 'file', 'shape'].includes(o.type)) o.color = d.fill;
    if ('stroke' in d && ['text', 'pen', 'arrow', 'shape'].includes(o.type)) o.stroke = d.stroke;
    if ('sticky' in d && o.type === 'sticky') o.color = stickyFill = d.sticky;
    setObj(o);
  });
  endChange(); renderProps();
});

const mini = $('#minimap'), mctx = mini.getContext('2d');
let miniMap = null;
function drawMinimap() {
  mini.classList.toggle('off', !minimapOn);
  if (!minimapOn || getComputedStyle(mini).display === 'none') return;
  const dpr = devicePixelRatio || 1, W = 220, H = 140;
  if (mini.width !== W * dpr) { mini.width = W * dpr; mini.height = H * dpr; }
  mctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const cs = getComputedStyle(document.documentElement), v = n => cs.getPropertyValue(n).trim();
  const col = c => !c ? v('--line-strong') : isPreset(c) ? v('--c' + c) : c;
  const vp = { x: -view.x / view.z, y: -view.y / view.z, w: innerWidth / view.z, h: innerHeight / view.z };
  const b = boundsOf([...objs.values(), vp]);
  const pad = 10, s = Math.min((W - pad * 2) / b.w, (H - pad * 2) / b.h);
  const ox = pad + (W - pad * 2 - b.w * s) / 2 - b.x * s, oy = pad + (H - pad * 2 - b.h * s) / 2 - b.y * s;
  miniMap = { s, ox, oy };
  mctx.clearRect(0, 0, W, H);
  [...objs.values()].sort((a, c) => (a.type === 'group' ? -1e9 : a.z) - (c.type === 'group' ? -1e9 : c.z)).forEach(o => {
    const r = [ox + o.x * s, oy + o.y * s, Math.max(1.5, o.w * s), Math.max(1.5, o.h * s)];
    if (o.type === 'group') { mctx.strokeStyle = col(o.color); mctx.lineWidth = 1; mctx.strokeRect(...r); return; }
    if (o.type === 'arrow' || o.type === 'pen') return;
    mctx.fillStyle = o.type === 'sticky' ? o.color : o.type === 'text' ? v('--muted') : col(o.color);
    mctx.globalAlpha = o.type === 'text' ? 0.5 : 0.9;
    mctx.fillRect(...r);
  });
  mctx.globalAlpha = 1;
  mctx.strokeStyle = v('--accent'); mctx.lineWidth = 1.5;
  mctx.strokeRect(ox + vp.x * s, oy + vp.y * s, vp.w * s, vp.h * s);
}
function miniNavigate(e) {
  if (!miniMap) return;
  const r = mini.getBoundingClientRect();
  const wx = (e.clientX - r.left - miniMap.ox) / miniMap.s, wy = (e.clientY - r.top - miniMap.oy) / miniMap.s;
  view.x = innerWidth / 2 - wx * view.z; view.y = innerHeight / 2 - wy * view.z;
  applyView();
}
mini.addEventListener('pointerdown', e => { mini.setPointerCapture(e.pointerId); miniNavigate(e); });
mini.addEventListener('pointermove', e => { if (e.buttons) miniNavigate(e); });

// ---------- tools ----------
function setTool(t) {
  tool = t;
  board.className = 'tool-' + t;
  document.querySelectorAll('#toolbar [data-tool]').forEach(b => b.classList.toggle('active', b.dataset.tool === t));
  if (t !== 'select') select([]);
  scheduleUI();
}
$('#toolbar').addEventListener('click', e => {
  const b = e.target.closest('[data-tool]');
  if (b) setTool(b.dataset.tool);
});

function objectAt(e, exclude) {
  for (const el of document.elementsFromPoint(e.clientX, e.clientY)) {
    if (el === board) break;
    const h = el.closest?.('.obj');
    if (h && h.dataset.id !== exclude) return objs.get(h.dataset.id);
  }
  return null;
}
let targetEl = null;
function highlight(o) {
  const el = o && document.getElementById('o-' + o.id);
  if (el === targetEl) return;
  targetEl?.classList.remove('target');
  targetEl = el; targetEl?.classList.add('target');
}
function makeNode(type, x, y, extra = {}) {
  const [w, h] = DEFAULT_SIZE[type === 'shape' ? extra.shape : type] || DEFAULT_SIZE.card;
  const base = {
    card: { type: 'card', text: '', color: '' },
    sticky: { type: 'sticky', text: '', color: stickyFill },
    text: { type: 'text', text: '', stroke: '', fs: 24 },
    shape: { type: 'shape', shape: 'rect', text: '', color: '', stroke: '' },
    group: { type: 'group', label: 'Группа', color: '' },
  }[type];
  return addObj({ ...base, w, h, x, y, ...extra });
}

// ---------- pointer handling ----------
function startMove(hit, p, e) {
  if (e.shiftKey) {
    const s = new Set(selected);
    s.has(hit.id) ? s.delete(hit.id) : s.add(hit.id);
    select(s);
    if (!s.has(hit.id)) return;
  } else if (!selected.has(hit.id)) select([hit.id]);
  const ids = new Set(selected);
  selected.forEach(id => {
    const g = objs.get(id);
    if (g?.type === 'group') objs.forEach(o => { if (o.id !== g.id && o.type !== 'arrow' && contains(g, o)) ids.add(o.id); });
  });
  const orig = new Map();
  ids.forEach(id => { const o = objs.get(id); if (o) orig.set(id, o.type === 'arrow' ? { a: { ...o.a }, b: { ...o.b } } : { x: o.x, y: o.y }); });
  beginChange();
  drag = { mode: 'move', start: p, ids, orig, anchor: hit.type === 'arrow' ? null : hit.id };
}

board.addEventListener('pointerdown', e => {
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (pointers.size === 2) { startPinch(); return; }
  if (pointers.size > 2) return;
  if (e.target.closest('textarea, [contenteditable="true"]')) return;
  const objEl = e.target.closest('.obj');
  if (objEl && selected.has(objEl.dataset.id) && e.target.closest('video, audio')) return;
  e.preventDefault();
  if (document.activeElement && document.activeElement !== document.body && !board.contains(document.activeElement)) document.activeElement.blur();
  finishEdit();
  closePopovers();
  board.setPointerCapture(e.pointerId);
  const p = toWorld(e);

  if (e.button === 1 || e.button === 2 || tool === 'hand' || spaceDown) {
    drag = { mode: 'pan', sx: e.clientX, sy: e.clientY, vx: view.x, vy: view.y };
    board.classList.add('panning');
    return;
  }
  const dot = e.target.closest('[data-connect]');
  if (dot) {
    beginChange();
    const o = addObj({ type: 'arrow', a: { id: dot.dataset.node, side: dot.dataset.connect, x: p.x, y: p.y }, b: { x: p.x, y: p.y }, stroke: '', style: 'curve', ends: 'end', label: '' });
    drag = { mode: 'edge', id: o.id, fromDot: true, start: p };
    return;
  }
  const handle = e.target.closest('[data-handle]');
  if (handle) {
    const id = [...selected][0], h = handle.dataset.handle;
    beginChange();
    drag = h === 'a' || h === 'b' ? { mode: 'arrowEnd', k: h, id } : { mode: 'resize', h, id, orig: { ...objs.get(id) }, start: p };
    return;
  }
  const hit = objEl && objs.get(objEl.dataset.id);
  if (tool === 'select' && hit) {
    const a = e.target.closest('a[href]');
    if (a && a.getAttribute('href') !== '#') {
      drag = { mode: 'press', hit, start: p, sx: e.clientX, sy: e.clientY, action: () => openHref(a) };
      return;
    }
    const cb = e.target.closest('input[type="checkbox"]');
    if (cb && hit.type === 'card') {
      const index = [...objEl.querySelectorAll('input[type="checkbox"]')].indexOf(cb);
      drag = { mode: 'press', hit, start: p, sx: e.clientX, sy: e.clientY, action: () => { beginChange(); toggleTask(hit, index); setObj(hit); endChange(); } };
      return;
    }
  }
  switch (tool) {
    case 'select':
      if (hit) startMove(hit, p, e);
      else {
        if (!e.shiftKey) select([]);
        drag = { mode: 'marquee', sx: e.clientX, sy: e.clientY, start: p, base: new Set(selected) };
      }
      break;
    case 'card': case 'group': case 'rect': case 'ellipse': case 'diamond': {
      beginChange();
      const shape = ['rect', 'ellipse', 'diamond'].includes(tool);
      const s = { x: snapIf(p.x), y: snapIf(p.y) };
      const o = makeNode(shape ? 'shape' : tool, s.x, s.y, shape ? { shape: tool, w: 1, h: 1 } : { w: 1, h: 1 });
      drag = { mode: 'create', id: o.id, start: s };
      break;
    }
    case 'sticky': case 'text': {
      beginChange();
      const [w, h] = DEFAULT_SIZE[tool];
      const o = makeNode(tool, snapIf(p.x - (tool === 'text' ? 4 : w / 2)), snapIf(p.y - h / 2));
      endChange();
      setTool('select'); select([o.id]); startEdit(o.id);
      break;
    }
    case 'link':
      setTool('select');
      createLinkAt(p);
      break;
    case 'arrow': {
      beginChange();
      const a = hit && CONNECTABLE.has(hit.type) ? { id: hit.id, side: 'auto', x: p.x, y: p.y } : { x: p.x, y: p.y };
      const o = addObj({ type: 'arrow', a, b: { x: p.x, y: p.y }, stroke: '', style: 'curve', ends: 'end', label: '' });
      drag = { mode: 'edge', id: o.id, fromDot: false, start: p };
      break;
    }
    case 'pen':
      beginChange();
      drag = { mode: 'pen', pts: [[p.x, p.y]], id: null };
      break;
    case 'eraser':
      beginChange();
      drag = { mode: 'erase' };
      if (hit) removeObj(hit.id);
      break;
  }
});

board.addEventListener('pointermove', e => {
  if (pointers.has(e.pointerId)) pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  const p = toWorld(e);
  sync.cursor(p);
  if (!drag) {
    let h = null;
    const dot = e.target.closest?.('[data-connect]');
    if (dot) h = dot.dataset.node;
    else if (tool === 'select' || tool === 'arrow') {
      const el = e.target.closest?.('.obj');
      if (el && CONNECTABLE.has(objs.get(el.dataset.id)?.type)) h = el.dataset.id;
    }
    if (h !== hoverId) { hoverId = h; scheduleUI(); }
    return;
  }
  switch (drag.mode) {
    case 'pinch': return movePinch();
    case 'pan':
      view.x = drag.vx + e.clientX - drag.sx; view.y = drag.vy + e.clientY - drag.sy;
      applyView();
      break;
    case 'press':
      if (Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) > 4) startMove(drag.hit, drag.start, e);
      break;
    case 'move': {
      let dx = p.x - drag.start.x, dy = p.y - drag.start.y;
      if (snapOn && !e.altKey && drag.anchor) {
        const g = drag.orig.get(drag.anchor);
        dx = snapIf(g.x + dx) - g.x; dy = snapIf(g.y + dy) - g.y;
      }
      drag.ids.forEach(id => {
        const o = objs.get(id), g = drag.orig.get(id);
        if (!o || !g) return;
        if (o.type === 'arrow') {
          for (const k of ['a', 'b']) if (!o[k].id) { o[k].x = g[k].x + dx; o[k].y = g[k].y + dy; }
        } else { o.x = g.x + dx; o.y = g.y + dy; }
        setObj(o);
      });
      break;
    }
    case 'marquee': {
      const x = Math.min(e.clientX, drag.sx), y = Math.min(e.clientY, drag.sy);
      Object.assign(marquee.style, { display: 'block', left: x + 'px', top: y + 'px', width: Math.abs(e.clientX - drag.sx) + 'px', height: Math.abs(e.clientY - drag.sy) + 'px' });
      const r = { x: Math.min(p.x, drag.start.x), y: Math.min(p.y, drag.start.y), w: Math.abs(p.x - drag.start.x), h: Math.abs(p.y - drag.start.y) };
      const ids = new Set(drag.base);
      objs.forEach(o => {
        if (o.type === 'group' ? contains(r, o) : o.type === 'arrow' ? contains(r, { ...edgePath(o, edgeGeom(o)).mid, w: 0, h: 0 }) : intersects(r, o)) ids.add(o.id);
      });
      select(ids);
      break;
    }
    case 'create': {
      const o = objs.get(drag.id);
      let w = snapIf(p.x) - drag.start.x, h = snapIf(p.y) - drag.start.y;
      if (e.shiftKey) { const m = Math.max(Math.abs(w), Math.abs(h)); w = Math.sign(w || 1) * m; h = Math.sign(h || 1) * m; }
      o.x = Math.min(drag.start.x, drag.start.x + w); o.y = Math.min(drag.start.y, drag.start.y + h);
      o.w = Math.max(1, Math.abs(w)); o.h = Math.max(1, Math.abs(h));
      setObj(o);
      break;
    }
    case 'edge':
    case 'arrowEnd': {
      const o = objs.get(drag.id);
      if (!o) break;
      const k = drag.mode === 'edge' ? 'b' : drag.k, other = o[k === 'a' ? 'b' : 'a'];
      const hit = objectAt(e, o.id);
      const target = hit && CONNECTABLE.has(hit.type) && hit.id !== other.id ? hit : null;
      const side = target && (drag.mode === 'edge' && !drag.fromDot ? 'auto' : nearestSide(target, p));
      o[k] = target ? { id: target.id, side, x: p.x, y: p.y } : { x: p.x, y: p.y };
      highlight(target);
      setObj(o);
      break;
    }
    case 'resize': {
      const o = objs.get(drag.id), g = drag.orig, h = drag.h;
      const dx = p.x - drag.start.x, dy = p.y - drag.start.y;
      let x1 = g.x, y1 = g.y, x2 = g.x + g.w, y2 = g.y + g.h;
      if (h.includes('w')) x1 = snapIf(x1 + dx); else x2 = snapIf(x2 + dx);
      if (h.includes('n')) y1 = snapIf(y1 + dy); else y2 = snapIf(y2 + dy);
      let w = Math.max(30, x2 - x1), hh = Math.max(24, y2 - y1);
      const isImage = o.type === 'file' && (o.mime || '').startsWith('image/');
      if ((isImage || o.type === 'sticky') !== e.shiftKey) {
        const r = g.w / g.h;
        if (w / hh > r) hh = w / r; else w = hh * r;
      }
      o.w = w; o.x = h.includes('w') ? g.x + g.w - w : g.x;
      if (o.type !== 'text') { o.h = hh; o.y = h.includes('n') ? g.y + g.h - hh : g.y; }
      else o.fs = clamp(Math.round((g.fs || 24) * w / g.w), 8, 200);
      setObj(o);
      break;
    }
    case 'pen': {
      const last = drag.pts[drag.pts.length - 1];
      if (Math.hypot(p.x - last[0], p.y - last[1]) * view.z < 2) break;
      drag.pts.push([p.x, p.y]);
      drawPen(drag);
      break;
    }
    case 'erase': {
      const hit = objectAt(e);
      if (hit && hit.type !== 'group') removeObj(hit.id);
      break;
    }
  }
});

function drawPen(d) {
  const sw = 3, pad = sw + 2;
  const xs = d.pts.map(q => q[0]), ys = d.pts.map(q => q[1]);
  const x = Math.min(...xs) - pad, y = Math.min(...ys) - pad;
  const w = Math.max(...xs) - x + pad, h = Math.max(...ys) - y + pad;
  const o = d.id ? objs.get(d.id) : { type: 'pen', stroke: '', sw, id: uid(), z: maxZ() + 1 };
  Object.assign(o, { x, y, w, h, vw: w, vh: h, pts: d.pts.map(q => [+(q[0] - x).toFixed(1), +(q[1] - y).toFixed(1)]) });
  d.id = o.id;
  setObj(o);
}

function endPointer(e) {
  pointers.delete(e.pointerId);
  if (!drag) return;
  if (drag.mode === 'pinch') { if (pointers.size < 2) drag = null; return; }
  const d = drag;
  drag = null;
  board.classList.remove('panning');
  marquee.style.display = 'none';
  highlight(null);
  let after = null;
  switch (d.mode) {
    case 'press': d.action(); break;
    case 'create': {
      const o = objs.get(d.id);
      if (o.w < 12 && o.h < 12) {
        const [w, h] = DEFAULT_SIZE[o.type === 'shape' ? o.shape : o.type];
        Object.assign(o, { w, h, x: snapIf(d.start.x - w / 2), y: snapIf(d.start.y - h / 2) });
        setObj(o);
      }
      setTool('select'); select([o.id]);
      if (o.type === 'card') after = () => startEdit(o.id);
      break;
    }
    case 'edge': {
      const o = objs.get(d.id);
      if (!o) break;
      const g = edgeGeom(o), len = Math.hypot(g.p2.x - g.p1.x, g.p2.y - g.p1.y);
      if (!o.b.id) {
        if (d.fromDot && len > 40) {
          // dropped on empty canvas: create a connected node there, like Obsidian Canvas
          const src = objs.get(o.a.id);
          const type = ['card', 'sticky', 'shape'].includes(src?.type) ? src.type : 'card';
          const side = OPPOSITE[o.a.side] || 'left';
          const [w, h] = type === 'card' ? [src.w, src.h] : DEFAULT_SIZE[type === 'shape' ? src.shape : type];
          const pt = { x: o.b.x, y: o.b.y };
          const x = side === 'left' ? pt.x : side === 'right' ? pt.x - w : pt.x - w / 2;
          const y = side === 'top' ? pt.y : side === 'bottom' ? pt.y - h : pt.y - h / 2;
          const n = makeNode(type, snapIf(x), snapIf(y), type === 'shape' ? { shape: src.shape, w, h, color: src.color, stroke: src.stroke } : { w, h, color: src.color });
          o.b = { id: n.id, side, x: pt.x, y: pt.y };
          setObj(o);
          after = () => { select([n.id]); startEdit(n.id); };
        } else if (len < 14) removeObj(o.id);
      }
      if (tool === 'arrow') setTool('select');
      break;
    }
    case 'pen':
      if (d.pts.length === 1) { d.pts.push([d.pts[0][0] + 0.5, d.pts[0][1]]); drawPen(d); }
      break;
  }
  endChange();
  if (after) after();
  scheduleUI();
}
board.addEventListener('pointerup', endPointer);
board.addEventListener('pointercancel', endPointer);
board.addEventListener('contextmenu', e => e.preventDefault());

function startPinch() {
  if (drag && drag.mode !== 'pinch') { drag = null; marquee.style.display = 'none'; endChange(); }
  const [a, b] = [...pointers.values()];
  drag = { mode: 'pinch', d0: Math.hypot(a.x - b.x, a.y - b.y), z0: view.z, m0: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, vx: view.x, vy: view.y };
}
function movePinch() {
  const [a, b] = [...pointers.values()];
  if (!b) return;
  const d = Math.hypot(a.x - b.x, a.y - b.y), m = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  const nz = clamp(drag.z0 * d / drag.d0, 0.08, 4);
  const wx = (drag.m0.x - drag.vx) / drag.z0, wy = (drag.m0.y - drag.vy) / drag.z0;
  view.z = nz; view.x = m.x - wx * nz; view.y = m.y - wy * nz;
  applyView();
}

board.addEventListener('wheel', e => {
  const sc = e.target.closest('.md, textarea');
  if (sc && !e.ctrlKey && sc.scrollHeight > sc.clientHeight + 1) {
    const up = e.deltaY < 0;
    if (up ? sc.scrollTop > 0 : sc.scrollTop + sc.clientHeight < sc.scrollHeight - 1) return;
  }
  e.preventDefault();
  const mouseWheel = e.deltaX === 0 && Number.isInteger(e.deltaY) && Math.abs(e.deltaY) >= 50;
  if (e.ctrlKey || e.metaKey) zoomAt(e.clientX, e.clientY, Math.exp(-e.deltaY * 0.01));
  else if (e.shiftKey) { view.x -= e.deltaY || e.deltaX; applyView(); }
  else if (mouseWheel) zoomAt(e.clientX, e.clientY, Math.exp(-e.deltaY * 0.0015));
  else { view.x -= e.deltaX; view.y -= e.deltaY; applyView(); }
}, { passive: false });

// ---------- editing ----------
board.addEventListener('dblclick', e => {
  if (e.target.closest('textarea, [contenteditable="true"], [data-connect], [data-handle]')) return;
  const el = e.target.closest('.obj');
  if (el) { startEdit(el.dataset.id); return; }
  if (tool !== 'select') return;
  const p = toWorld(e);
  beginChange();
  const o = makeNode('card', snapIf(p.x - 130), snapIf(p.y - 70));
  endChange();
  select([o.id]); startEdit(o.id);
});
function selectAll(el) {
  const r = document.createRange(); r.selectNodeContents(el);
  const s = getSelection(); s.removeAllRanges(); s.addRange(r);
}
function startEdit(id) {
  const o = objs.get(id);
  if (!o) return;
  if (o.type === 'link') { editLink(o); return; }
  if (o.type === 'file') { openFile(o); return; }
  if (!TEXT_EDIT.has(o.type)) return;
  finishEdit();
  beginChange();
  editingId = id;
  const el = document.getElementById('o-' + id);
  let field;
  if (o.type === 'card') {
    el.innerHTML = '<textarea class="card-edit" spellcheck="false" placeholder="Пишите в Markdown…"></textarea>';
    field = el.firstChild;
    field.value = o.text || '';
    field.addEventListener('input', () => { o.text = field.value; sync.dirty(o.id); saveSoon(); });
    field.focus();
    field.setSelectionRange(field.value.length, field.value.length);
  } else {
    if (o.type === 'arrow') {
      field = el.querySelector('.edge-label');
      if (!field) {
        const P = edgePath(o, edgeGeom(o));
        el.insertAdjacentHTML('beforeend', `<div class="edge-label" style="left:${P.mid.x - o.x}px;top:${P.mid.y - o.y}px"></div>`);
        field = el.querySelector('.edge-label');
      }
    } else field = el.querySelector(o.type === 'group' ? '.group-label' : '.label');
    field.contentEditable = 'true';
    field.addEventListener('input', () => {
      const v = field.innerText;
      if (o.type === 'group' || o.type === 'arrow') o.label = v; else o.text = v;
      if (o.type === 'sticky' || o.type === 'shape') fitText(el, o);
      if (o.type === 'text') { o.h = el.offsetHeight; renderLinked(o.id); }
      sync.dirty(o.id); saveSoon();
    });
    field.focus();
    selectAll(field);
  }
  field.addEventListener('blur', finishEdit, { once: true });
  scheduleUI();
}
function finishEdit() {
  if (!editingId) return;
  const id = editingId;
  editingId = null;
  const o = objs.get(id), el = document.getElementById('o-' + id);
  if (o && el) {
    if (o.type === 'card') { const t = el.querySelector('textarea'); if (t) o.text = t.value; }
    else if (o.type === 'arrow') { const l = el.querySelector('.edge-label'); o.label = l ? l.innerText.trim() : ''; }
    else if (o.type === 'group') { const l = el.querySelector('.group-label'); o.label = (l?.innerText || '').trim() || 'Группа'; }
    else { const l = el.querySelector('.label'); if (l) o.text = l.innerText.replace(/\n$/, ''); }
    el._sig = '';
    if (o.type === 'text' && !o.text.trim()) removeObj(id); else setObj(o);
  }
  getSelection()?.removeAllRanges();
  endChange();
  renderProps();
}
function addChild(o) {
  if (!o || !['card', 'sticky', 'shape'].includes(o.type)) return;
  finishEdit();
  beginChange();
  const kids = [...objs.values()].filter(a => a.type === 'arrow' && a.a.id === o.id && a.b.id).map(a => objs.get(a.b.id)).filter(k => k && k.x > o.x + o.w);
  const y = kids.length ? Math.max(...kids.map(k => k.y + k.h)) + 30 : o.y;
  const child = makeNode(o.type, o.x + o.w + 100, y, { w: o.w, h: o.h, shape: o.shape, color: o.color, stroke: o.stroke });
  addObj({ type: 'arrow', a: { id: o.id, side: 'right', x: 0, y: 0 }, b: { id: child.id, side: 'left', x: 0, y: 0 }, stroke: '', style: 'curve', ends: 'end', label: '' });
  endChange();
  select([child.id]);
  const b = boundsOf([o, child]), vb = { x: -view.x / view.z, y: -view.y / view.z, w: innerWidth / view.z, h: innerHeight / view.z };
  if (!contains(vb, b)) animateTo({ ...view, x: innerWidth / 2 - (child.x + child.w / 2) * view.z, y: innerHeight / 2 - (child.y + child.h / 2) * view.z });
  startEdit(child.id);
}

// ---------- links & files ----------
function normalizeUrl(s) {
  s = (s || '').trim();
  if (!s) return '';
  if (!/^https?:\/\//i.test(s)) s = 'https://' + s.replace(/^\/+/, '');
  try { return new URL(s).href; } catch { return ''; }
}
async function createLinkAt(p, preset) {
  const url = normalizeUrl(preset ?? await ask('Ссылка на сайт', 'https://…'));
  if (!url) return;
  const embed = isEmbeddable(url);
  const [w, h] = embed ? [480, 320] : [320, 200];
  beginChange();
  const o = addObj({ type: 'link', url, embed, color: '', x: snapIf(p.x - w / 2), y: snapIf(p.y - h / 2), w, h });
  endChange();
  setTool('select'); select([o.id]);
}
async function editLink(o) {
  const url = normalizeUrl(await ask('Изменить ссылку', 'https://…', o.url));
  if (!url || url === o.url) return;
  beginChange(); o.url = url; setObj(o); endChange();
}
function openHref(a) {
  if (a.hasAttribute('download')) {
    const t = document.createElement('a');
    t.href = a.href; t.download = a.getAttribute('download'); t.rel = 'noopener';
    document.body.appendChild(t); t.click(); t.remove();
  } else window.open(a.href, '_blank', 'noopener');
}
function openFile(o) {
  const a = document.createElement('a');
  a.href = safeSrc(o.src); a.setAttribute('download', o.name || 'file');
  openHref(a);
}
const readDataURL = blob => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(blob); });
async function prepImage(file) {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
    const k = Math.min(1, 1600 / Math.max(img.width, img.height));
    let blob = file;
    if (k < 1 || file.size > 1.5e6) {
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      const type = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
      blob = await new Promise(res => c.toBlob(res, type, 0.86));
    }
    const w = Math.min(440, img.width);
    return { blob, w, h: Math.round(w * img.height / img.width) };
  } finally { URL.revokeObjectURL(url); }
}
async function addFile(file, at) {
  const name = file.name || `Pasted image ${stamp()}.png`;
  const ext = name.includes('.') ? name.split('.').pop().toLowerCase() : '';
  if (ext === 'canvas' || ext === 'json') { importText(await file.text(), at); return; }
  if (file.type.startsWith('text/') || ['md', 'markdown', 'txt', 'csv'].includes(ext)) {
    const text = (await file.text()).slice(0, 50000);
    const h = clamp(text.split('\n').length * 24 + 40, 120, 560);
    beginChange();
    const o = makeNode('card', snapIf(at.x - 200), snapIf(at.y - h / 2), { w: 400, h, text });
    endChange(); select([o.id]);
    return;
  }
  const mime = file.type || 'application/octet-stream';
  let blob = file, w = 320, h = 96;
  if (/^image\/(png|jpeg|webp|bmp)$/.test(mime)) ({ blob, w, h } = await prepImage(file));
  else if (mime.startsWith('image/')) { w = 360; h = 260; }
  else if (mime === 'application/pdf') { w = 460; h = 600; }
  else if (mime.startsWith('video/')) { w = 480; h = 270; }
  else if (mime.startsWith('audio/')) { w = 340; h = 120; }
  if (!sync.on && blob.size > 15e6) { toast('Файл больше 15 МБ: подключите Supabase, чтобы загружать большие файлы'); return; }
  if (blob.size > 50e6) { toast('Файл больше 50 МБ'); return; }
  toast(sync.on ? 'Загружаю «' + name + '»…' : 'Добавляю «' + name + '»…');
  const src = await sync.upload(blob, name) || await readDataURL(blob);
  beginChange();
  const o = addObj({ type: 'file', name, mime: blob.type || mime, size: blob.size, src, color: '', x: snapIf(at.x - w / 2), y: snapIf(at.y - h / 2), w, h });
  endChange();
  setTool('select'); select([o.id]);
  toast('Готово');
}
$('#file-upload').addEventListener('change', e => {
  const c = viewCenter();
  [...e.target.files].forEach((f, i) => addFile(f, { x: c.x + i * 40, y: c.y + i * 40 }));
  e.target.value = '';
});
board.addEventListener('dragover', e => e.preventDefault());
board.addEventListener('drop', e => {
  e.preventDefault();
  const p = toWorld(e);
  const files = [...e.dataTransfer.files];
  if (files.length) { files.forEach((f, i) => addFile(f, { x: p.x + i * 40, y: p.y + i * 40 })); return; }
  const url = e.dataTransfer.getData('text/uri-list') || e.dataTransfer.getData('text/plain');
  if (/^https?:\/\/\S+$/i.test(url.trim())) createLinkAt(p, url.trim());
});

// ---------- clipboard, layers ----------
function pasteObjs(list, dx, dy) {
  if (!list.length) return [];
  beginChange();
  const map = new Map(list.map(o => [o.id, uid()]));
  const out = [];
  let z = maxZ();
  [...list].sort((a, b) => (a.type === 'arrow') - (b.type === 'arrow') || (a.type !== 'group') - (b.type !== 'group') || (a.z || 0) - (b.z || 0)).forEach(src => {
    const o = normalize(JSON.parse(JSON.stringify(src)));
    o.id = map.get(src.id); o.z = ++z;
    if (o.type === 'arrow') {
      for (const k of ['a', 'b']) {
        o[k].x = (o[k].x || 0) + dx; o[k].y = (o[k].y || 0) + dy;
        if (o[k].id) { if (map.has(o[k].id)) o[k].id = map.get(o[k].id); else delete o[k].id; }
      }
    } else { o.x += dx; o.y += dy; }
    objs.set(o.id, o); out.push(o);
  });
  out.forEach(o => { if (o.type !== 'arrow') setObj(o); });
  out.forEach(o => { if (o.type === 'arrow') setObj(o); });
  select(out.map(o => o.id));
  endChange();
  return out;
}
function deleteSelected() { if (!selected.size) return; beginChange(); [...selected].forEach(removeObj); select([]); endChange(); }
function reorder(front) {
  const list = selectionObjs().sort((a, b) => a.z - b.z);
  if (!list.length) return;
  beginChange();
  let z = front ? maxZ() : minZ() - list.length;
  list.forEach(o => { o.z = ++z; setObj(o); });
  endChange();
}
function clipboardPayload() {
  const ids = new Set(selected);
  // copy the arrows that connect copied nodes too
  objs.forEach(o => { if (o.type === 'arrow' && o.a.id && o.b.id && ids.has(o.a.id) && ids.has(o.b.id)) ids.add(o.id); });
  return 'MIRODO:' + JSON.stringify([...ids].map(id => objs.get(id)).filter(Boolean));
}
let pasteShift = 0;
document.addEventListener('copy', e => {
  if (editingId || !selected.size || e.target.closest?.('input')) return;
  e.preventDefault();
  e.clipboardData.setData('text/plain', clipboardPayload());
  pasteShift = 0;
});
document.addEventListener('cut', e => {
  if (editingId || !selected.size || e.target.closest?.('input')) return;
  e.preventDefault();
  e.clipboardData.setData('text/plain', clipboardPayload());
  pasteShift = -30;
  deleteSelected();
});
document.addEventListener('paste', e => {
  if (editingId || e.target.closest?.('input')) return;
  const c = viewCenter();
  const files = [...e.clipboardData.files];
  if (files.length) { e.preventDefault(); files.forEach((f, i) => addFile(f, { x: c.x + i * 40, y: c.y + i * 40 })); return; }
  const text = e.clipboardData.getData('text/plain');
  if (!text) return;
  e.preventDefault();
  const t = text.trim();
  if (t.startsWith('MIRODO:')) {
    try { pasteShift += 30; pasteObjs(JSON.parse(t.slice(7)), pasteShift, pasteShift); } catch { /* not our payload */ }
  } else if (t.startsWith('{') && t.includes('"nodes"')) importText(t, c);
  else if (/^https?:\/\/\S+$/i.test(t)) createLinkAt(c, t);
  else {
    const h = clamp(t.split('\n').length * 24 + 40, 100, 480);
    beginChange();
    const o = makeNode('card', snapIf(c.x - 160), snapIf(c.y - h / 2), { w: 320, h, text: t.slice(0, 20000) });
    endChange(); select([o.id]);
  }
});

// ---------- import / export ----------
function download(name, text, type) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type }));
  a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1500);
}
const fileBase = () => (meta.title || 'board').replace(/[\\/:*?"<>|]+/g, '_').slice(0, 60);
function toCanvas() {
  const nodes = [], edges = [];
  const col = c => (c ? { color: c } : {});
  [...objs.values()].sort((a, b) => (a.type === 'group' ? -1 : 0) - (b.type === 'group' ? -1 : 0) || a.z - b.z).forEach(o => {
    const base = { id: o.id, x: Math.round(o.x), y: Math.round(o.y), width: Math.round(o.w), height: Math.round(o.h) };
    switch (o.type) {
      case 'card': nodes.push({ ...base, type: 'text', text: o.text || '', ...col(o.color) }); break;
      case 'sticky': nodes.push({ ...base, type: 'text', text: o.text || '', color: o.color }); break;
      case 'shape': nodes.push({ ...base, type: 'text', text: o.text || '', ...col(o.color) }); break;
      case 'text': nodes.push({ ...base, type: 'text', text: o.text || '' }); break;
      case 'group': nodes.push({ ...base, type: 'group', label: o.label || '', ...col(o.color) }); break;
      case 'link': nodes.push({ ...base, type: 'link', url: o.url, ...col(o.color) }); break;
      case 'file': nodes.push({ ...base, type: 'file', file: o.name || 'file', ...col(o.color) }); break;
    }
  });
  objs.forEach(o => {
    if (o.type !== 'arrow' || !o.a.id || !o.b.id) return;
    const g = edgeGeom(o);
    edges.push({
      id: o.id, fromNode: o.a.id, fromSide: g.sa, toNode: o.b.id, toSide: g.sb,
      fromEnd: o.ends === 'both' ? 'arrow' : 'none', toEnd: o.ends === 'none' ? 'none' : 'arrow',
      ...(o.stroke ? { color: o.stroke } : {}), ...(o.label ? { label: o.label } : {}),
    });
  });
  return { nodes, edges };
}
function fromCanvas(c) {
  const out = [];
  let z = 0;
  (c.nodes || []).forEach(n => {
    const base = { id: n.id, x: n.x || 0, y: n.y || 0, w: n.width || 250, h: n.height || 60, color: n.color || '', z: n.type === 'group' ? z++ - 1e5 : z++ };
    if (n.type === 'text') out.push({ ...base, type: 'card', text: n.text || '' });
    else if (n.type === 'group') out.push({ ...base, type: 'group', label: n.label || 'Группа' });
    else if (n.type === 'link') out.push({ ...base, type: 'link', url: n.url || '', embed: isEmbeddable(n.url || '') });
    else if (n.type === 'file') out.push({ ...base, type: 'card', text: `📎 **${n.file}**${n.subpath || ''}` });
  });
  (c.edges || []).forEach(e => out.push({
    id: e.id || uid(), type: 'arrow', z: z++, stroke: e.color || '', style: 'curve', label: e.label || '',
    ends: e.fromEnd === 'arrow' ? 'both' : e.toEnd === 'none' ? 'none' : 'end',
    a: { id: e.fromNode, side: e.fromSide || 'auto', x: 0, y: 0 }, b: { id: e.toNode, side: e.toSide || 'auto', x: 0, y: 0 },
  }));
  return out;
}
function importText(text, at) {
  try {
    const data = JSON.parse(text);
    const list = Array.isArray(data) ? data : Array.isArray(data.objs) ? data.objs : data.nodes ? fromCanvas(data) : null;
    if (!list) throw new Error('unknown format');
    const b = boundsOf(list.filter(o => o.type !== 'arrow')) || { x: 0, y: 0, w: 0, h: 0 };
    const out = pasteObjs(list, at.x - (b.x + b.w / 2), at.y - (b.y + b.h / 2));
    if (Array.isArray(data.objs) && data.title && objs.size === out.length) setTitle(data.title);
    toast('Импортировано объектов: ' + out.length);
    setTimeout(() => fitView(), 50);
  } catch (err) { console.error(err); toast('Не удалось прочитать файл'); }
}
$('#file-import').addEventListener('change', async e => {
  const f = e.target.files[0];
  e.target.value = '';
  if (f) importText(await f.text(), viewCenter());
});

// ---------- dialogs, popovers, toast ----------
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg; t.hidden = false;
  clearTimeout(toast.t); toast.t = setTimeout(() => { t.hidden = true; }, 2400);
}
function ask(title, placeholder, value = '') {
  return new Promise(resolve => {
    const m = $('#modal'), f = $('#modal-form'), input = $('#modal-input');
    $('#modal-title').textContent = title;
    input.placeholder = placeholder; input.value = value;
    m.hidden = false;
    setTimeout(() => { input.focus(); input.select(); });
    const done = v => { m.hidden = true; f.onsubmit = null; m.onclick = null; m.onkeydown = null; resolve(v); };
    f.onsubmit = e => { e.preventDefault(); done(input.value); };
    m.onclick = e => { if (e.target === m || e.target.dataset.m === 'cancel') done(null); };
    m.onkeydown = e => { if (e.key === 'Escape') done(null); };
  });
}
function closePopovers(except) {
  ['#menu', '#boards-panel'].forEach(s => { if (s !== except) $(s).hidden = true; });
}
function togglePopover(sel) { closePopovers(sel); $(sel).hidden = !$(sel).hidden; }
function renderBoards() {
  let list = [];
  try { list = JSON.parse(store.get('recent') || '[]'); } catch { /* corrupted list */ }
  const ago = t => {
    const m = Math.round((Date.now() - t) / 60000);
    return m < 1 ? 'сейчас' : m < 60 ? m + ' мин' : m < 1440 ? Math.round(m / 60) + ' ч' : Math.round(m / 1440) + ' дн';
  };
  $('#boards-list').innerHTML = list.map(b => `<button class="pop-item board-item${b.id === boardId ? ' current' : ''}" data-board="${esc(b.id)}">`
    + `<span class="bi-title">${esc(b.title || 'Без названия')}</span><span class="bi-time">${ago(b.t)}</span></button>`).join('') || '<div class="empty">Пока пусто</div>';
}
$('#boards-list').addEventListener('click', e => {
  const b = e.target.closest('[data-board]');
  if (b && b.dataset.board !== boardId) location.hash = b.dataset.board;
});
function setTitle(t) {
  meta.title = (t || '').trim().slice(0, 80) || 'Без названия';
  $('#title').value = meta.title;
  document.title = meta.title + ' · Miro Do';
}
$('#title').addEventListener('input', e => {
  meta.title = e.target.value.trim() || 'Без названия';
  document.title = meta.title + ' · Miro Do';
  saveSoon(); sync.saveMeta();
});
$('#title').addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === 'Escape') e.target.blur(); });
$('#title').addEventListener('blur', () => setTitle(meta.title));

// ---------- search ----------
const searchInput = $('#search-input');
let results = [], ri = -1;
const textOf = o => [o.text, o.label, o.url, o.name].filter(Boolean).join(' ').toLowerCase();
function runSearch() {
  const q = searchInput.value.trim().toLowerCase();
  results = q ? [...objs.values()].filter(o => textOf(o).includes(q)).sort((a, b) => a.y - b.y || a.x - b.x) : [];
  ri = -1;
  $('#search-count').textContent = q ? (results.length ? '0/' + results.length : 'нет') : '';
  if (results.length) nextResult(1);
}
function nextResult(dir) {
  if (!results.length) return;
  ri = (ri + dir + results.length) % results.length;
  const o = results[ri];
  select([o.id]);
  animateTo(viewFor(o, Math.max(view.z, 0.9)));
  $('#search-count').textContent = `${ri + 1}/${results.length}`;
}
searchInput.addEventListener('input', runSearch);
searchInput.addEventListener('keydown', e => {
  if (e.key === 'Enter') { e.preventDefault(); nextResult(e.shiftKey ? -1 : 1); }
  if (e.key === 'Escape') { $('#search').hidden = true; searchInput.blur(); }
});
function openSearch() { closePopovers(); $('#search').hidden = false; searchInput.focus(); searchInput.select(); }

// ---------- keyboard ----------
const TOOL_KEYS = { v: 'select', h: 'hand', c: 'card', n: 'sticky', t: 'text', r: 'rect', o: 'ellipse', d: 'diamond', g: 'group', a: 'arrow', p: 'pen', e: 'eraser', l: 'link' };
document.addEventListener('keydown', e => {
  if (editingId) {
    const o = objs.get(editingId);
    if (e.key === 'Escape' || (e.key === 'Enter' && (e.ctrlKey || e.metaKey))) { e.preventDefault(); document.activeElement.blur(); }
    else if (e.key === 'Tab' && o?.type === 'card') {
      e.preventDefault();
      const t = e.target, s = t.selectionStart;
      t.setRangeText('  ', s, t.selectionEnd, 'end');
      t.dispatchEvent(new Event('input'));
    } else if (e.key === 'Tab' && o && ['sticky', 'shape'].includes(o.type)) { e.preventDefault(); addChild(o); }
    else if (e.key === 'Enter' && !e.shiftKey && (o?.type === 'group' || o?.type === 'arrow')) { e.preventDefault(); document.activeElement.blur(); }
    return;
  }
  if (!$('#modal').hidden || !$('#help').hidden) { if (e.key === 'Escape') { $('#help').hidden = true; } return; }
  if (e.target.closest?.('input, textarea')) return;
  const k = e.code.startsWith('Key') ? e.code.slice(3).toLowerCase() : e.key.toLowerCase();
  const mod = e.ctrlKey || e.metaKey;
  if (e.code === 'Space') { if (!spaceDown) { spaceDown = true; board.classList.add('panning'); } e.preventDefault(); return; }
  if (mod) {
    if (k === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); }
    else if (k === 'y') { e.preventDefault(); redo(); }
    else if (k === 'a') { e.preventDefault(); setTool('select'); select([...objs.keys()]); }
    else if (k === 'd') { e.preventDefault(); pasteObjs(selectionObjs(), 30, 30); }
    else if (k === 'f') { e.preventDefault(); openSearch(); }
    else if (k === 's') { e.preventDefault(); saveNow(); toast('Сохранено'); }
    else if (e.key === '=' || e.key === '+') { e.preventDefault(); zoomAt(innerWidth / 2, innerHeight / 2, 1.2); }
    else if (e.key === '-') { e.preventDefault(); zoomAt(innerWidth / 2, innerHeight / 2, 1 / 1.2); }
    else if (e.key === '0') { e.preventDefault(); const c = viewCenter(); animateTo({ z: 1, x: innerWidth / 2 - c.x, y: innerHeight / 2 - c.y }); }
    return;
  }
  if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); deleteSelected(); return; }
  if (e.key === 'Escape') { select([]); setTool('select'); closePopovers(); $('#search').hidden = true; return; }
  if (e.key === 'Enter' && selected.size === 1) { e.preventDefault(); startEdit([...selected][0]); return; }
  if (e.key === 'Tab' && selected.size === 1) { e.preventDefault(); addChild(objs.get([...selected][0])); return; }
  if (e.key === ']') return reorder(true);
  if (e.key === '[') return reorder(false);
  if (e.key === '?') { $('#help').hidden = false; return; }
  if (e.key === '!' || (e.shiftKey && e.code === 'Digit1')) return fitView();
  if (e.key === '+' || e.key === '=') return zoomAt(innerWidth / 2, innerHeight / 2, 1.2);
  if (e.key === '-') return zoomAt(innerWidth / 2, innerHeight / 2, 1 / 1.2);
  if (e.key.startsWith('Arrow') && selected.size) {
    e.preventDefault();
    const step = e.shiftKey ? 20 : 2;
    const dx = { ArrowLeft: -step, ArrowRight: step }[e.key] || 0, dy = { ArrowUp: -step, ArrowDown: step }[e.key] || 0;
    beginChange();
    selectionObjs().forEach(o => {
      if (o.type === 'arrow') { for (const q of ['a', 'b']) if (!o[q].id) { o[q].x += dx; o[q].y += dy; } } else { o.x += dx; o.y += dy; }
      setObj(o);
    });
    endChange();
    return;
  }
  if (k === 'u') { $('#file-upload').click(); return; }
  if (TOOL_KEYS[k]) setTool(TOOL_KEYS[k]);
});
document.addEventListener('keyup', e => { if (e.code === 'Space') { spaceDown = false; if (!drag) board.classList.remove('panning'); } });

// ---------- actions ----------
function applyTheme() {
  const t = store.get('theme');
  if (t) document.documentElement.dataset.theme = t; else delete document.documentElement.dataset.theme;
  scheduleUI();
}
function updateChecks() {
  $('#snap-check').classList.toggle('on', snapOn);
  $('#minimap-check').classList.toggle('on', minimapOn);
}
document.addEventListener('click', e => {
  const b = e.target.closest('[data-act]');
  if (!b) return;
  const act = b.dataset.act;
  const one = selected.size === 1 ? objs.get([...selected][0]) : null;
  if (!['menu', 'boards', 'toggle-snap', 'toggle-minimap'].includes(act)) closePopovers();
  switch (act) {
    case 'undo': undo(); break;
    case 'redo': redo(); break;
    case 'menu': updateChecks(); togglePopover('#menu'); break;
    case 'boards': renderBoards(); togglePopover('#boards-panel'); break;
    case 'search': if ($('#search').hidden) openSearch(); else $('#search').hidden = true; break;
    case 'search-next': nextResult(1); break;
    case 'search-prev': nextResult(-1); break;
    case 'help': $('#help').hidden = false; break;
    case 'help-close': $('#help').hidden = true; break;
    case 'theme': {
      const cur = document.documentElement.dataset.theme || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
      store.set('theme', cur === 'dark' ? 'light' : 'dark');
      applyTheme();
      break;
    }
    case 'share':
      navigator.clipboard?.writeText(location.href).then(
        () => toast(sync.on ? 'Ссылка скопирована: отправьте её, чтобы работать вместе' : 'Ссылка скопирована (совместная работа включится после подключения Supabase)'),
        () => ask('Ссылка на доску', '', location.href));
      break;
    case 'new': location.hash = Math.random().toString(36).slice(2, 10); break;
    case 'export': download(fileBase() + '.json', JSON.stringify({ app: 'miro-do', version: 2, title: meta.title, objs: [...objs.values()] }), 'application/json'); break;
    case 'export-canvas': download(fileBase() + '.canvas', JSON.stringify(toCanvas(), null, '\t'), 'application/json'); toast('Положите файл в хранилище Obsidian, чтобы открыть его как Canvas'); break;
    case 'import': $('#file-import').click(); break;
    case 'upload': $('#file-upload').click(); break;
    case 'toggle-snap': snapOn = !snapOn; store.set('snap', snapOn ? '1' : '0'); updateChecks(); break;
    case 'toggle-minimap': minimapOn = !minimapOn; store.set('minimap', minimapOn ? '1' : '0'); updateChecks(); scheduleUI(); break;
    case 'rename':
      ask('Ваше имя на доске', 'Имя', userName).then(n => {
        if (!n || !n.trim()) return;
        userName = n.trim().slice(0, 30); store.set('name', userName); sync.track(); renderUsers();
      });
      break;
    case 'clear':
      if (objs.size && confirm('Удалить все объекты с доски? Это можно отменить через Ctrl+Z.')) { beginChange(); [...objs.keys()].forEach(removeObj); select([]); endChange(); }
      break;
    case 'zoomin': zoomAt(innerWidth / 2, innerHeight / 2, 1.2); break;
    case 'zoomout': zoomAt(innerWidth / 2, innerHeight / 2, 1 / 1.2); break;
    case 'zoomreset': { const c = viewCenter(); animateTo({ z: 1, x: innerWidth / 2 - c.x, y: innerHeight / 2 - c.y }); break; }
    case 'fit': fitView(); break;
    case 'front': reorder(true); break;
    case 'back': reorder(false); break;
    case 'duplicate': pasteObjs(selectionObjs(), 30, 30); break;
    case 'delete': deleteSelected(); break;
    case 'edit': if (one) startEdit(one.id); break;
    case 'child': addChild(one); break;
    case 'link-open': if (one) window.open(safeUrl(one.url), '_blank', 'noopener'); break;
    case 'link-edit': if (one) editLink(one); break;
    case 'link-embed':
      if (one) {
        beginChange();
        one.embed = !one.embed;
        if (one.embed && one.h < 260) { one.w = Math.max(one.w, 480); one.h = 320; }
        setObj(one); endChange(); renderProps();
      }
      break;
    case 'file-open': if (one) openFile(one); break;
    default:
      if (one && act.startsWith('style-')) { beginChange(); one.style = act.slice(6); setObj(one); endChange(); renderProps(); }
      if (one && act.startsWith('ends-')) { beginChange(); one.ends = act.slice(5); setObj(one); endChange(); renderProps(); }
  }
});
document.addEventListener('pointerdown', e => {
  if (!e.target.closest('.popover, [data-act="menu"], [data-act="boards"], [data-act="search"]')) closePopovers();
});

// ---------- users / cursors ----------
let presence = {};
function renderUsers() {
  const others = Object.entries(presence).filter(([k]) => k !== clientId).map(([, v]) => v);
  const me = `<div class="avatar me" data-act="rename" style="background:${userColor}" title="${esc(userName)} (вы)">${esc(userName[0].toUpperCase())}</div>`;
  $('#users').innerHTML = others.slice(0, 5).map(u => `<div class="avatar" style="background:${esc(u.color)}" title="${esc(u.name)}">${esc((u.name || '?')[0].toUpperCase())}</div>`).join('')
    + (others.length > 5 ? `<div class="avatar" style="background:#757575">+${others.length - 5}</div>` : '') + me;
}
const cursors = new Map();
function showCursor(c) {
  if (!c || c.id === clientId) return;
  let el = cursors.get(c.id)?.el;
  if (!el) { el = document.createElement('div'); el.className = 'cursor'; cursorsLayer.appendChild(el); }
  el.innerHTML = `<svg viewBox="0 0 24 24"><path d="M3 2l17 9-7.5 1.8L9 20z" fill="${esc(c.color)}" stroke="#fff" stroke-width="1.5"/></svg><span style="background:${esc(c.color)}">${esc(c.name)}</span>`;
  el.style.left = c.x + 'px'; el.style.top = c.y + 'px';
  clearTimeout(cursors.get(c.id)?.t);
  cursors.set(c.id, { el, t: setTimeout(() => { el.remove(); cursors.delete(c.id); }, 8000) });
}

// ---------- Supabase sync ----------
const sync = (() => {
  const cfg = window.MIRO_CONFIG || {};
  const dirtySet = new Set(), delSet = new Set();
  let sb = null, channel = null, ready = false, flushing = false, lastCursor = 0, metaTimer = 0;
  const api = {
    on: false,
    dirty(id) { if (sb) dirtySet.add(id); },
    del(id) { if (sb) { dirtySet.delete(id); delSet.add(id); } },
    cursor(p) {
      if (!ready || Date.now() - lastCursor < 50) return;
      lastCursor = Date.now();
      channel.send({ type: 'broadcast', event: 'cursor', payload: { id: clientId, name: userName, color: userColor, x: p.x, y: p.y } });
    },
    track() { if (ready) channel.track({ name: userName, color: userColor }); },
    saveMeta() {
      if (!sb) return;
      clearTimeout(metaTimer);
      metaTimer = setTimeout(() => sb.from('boards').upsert({ id: boardId, title: meta.title, updated_at: new Date().toISOString() })
        .then(({ error }) => { if (error) console.error(error); }), 500);
    },
    async upload(blob, name) {
      if (!sb) return null;
      const path = `${boardId}/${uid()}-${name.replace(/[^\w.\-]+/g, '_').slice(-80)}`;
      const { error } = await sb.storage.from('board-files').upload(path, blob, { contentType: blob.type || 'application/octet-stream' });
      if (error) { console.error(error); return null; }
      return sb.storage.from('board-files').getPublicUrl(path).data.publicUrl;
    },
  };
  function setStatus(state, text) {
    const s = $('#status');
    s.className = 'status ' + state;
    s.querySelector('span').textContent = text;
    s.title = text;
  }

  async function flush() {
    if (!ready || flushing || (!dirtySet.size && !delSet.size)) return;
    flushing = true;
    const now = new Date().toISOString();
    const ups = [...dirtySet].map(id => objs.get(id)).filter(Boolean)
      .map(o => ({ board_id: boardId, id: o.id, data: { ...o, _by: clientId }, updated_at: now }));
    const dels = [...delSet];
    dirtySet.clear(); delSet.clear();
    try {
      if (ups.length) { const { error } = await sb.from('board_objects').upsert(ups); if (error) throw error; }
      if (dels.length) { const { error } = await sb.from('board_objects').delete().eq('board_id', boardId).in('id', dels); if (error) throw error; }
      setStatus('on', 'Онлайн');
    } catch (err) {
      console.error(err);
      ups.forEach(u => { if (!delSet.has(u.id)) dirtySet.add(u.id); });
      dels.forEach(id => delSet.add(id));
      setStatus('err', 'Нет связи');
    }
    flushing = false;
  }

  function onRemote(payload) {
    if (payload.eventType === 'DELETE') {
      const old = payload.old || {};
      if ((old.board_id && old.board_id !== boardId) || !objs.has(old.id)) return;
      objs.delete(old.id); removeEl(old.id); selected.delete(old.id);
      objs.forEach(a => { if (a.type === 'arrow' && (a.a.id === old.id || a.b.id === old.id)) renderArrow(a); });
      saveSoon(); scheduleUI();
      return;
    }
    const row = payload.new;
    if (!row || row.board_id !== boardId || row.data?._by === clientId) return;
    if (editingId === row.id || (drag && drag.ids?.has(row.id))) return;
    const o = normalize(row.data);
    delete o._by;
    objs.set(o.id, o);
    renderObj(o);
    if (o.type !== 'arrow') renderLinked(o.id);
    saveSoon(); scheduleUI();
  }

  async function start() {
    if (!cfg.url || !cfg.key || !window.supabase) { setStatus('', 'Офлайн'); return; }
    sb = window.supabase.createClient(cfg.url, cfg.key);
    api.on = true;
    setStatus('', 'Подключение…');
    const [{ data, error }, metaRes] = await Promise.all([
      sb.from('board_objects').select('id,data').eq('board_id', boardId),
      sb.from('boards').select('title').eq('id', boardId).maybeSingle(),
    ]);
    if (error) { console.error(error); setStatus('err', 'Ошибка сервера'); sb = null; api.on = false; return; }
    if (data.length) {
      objs = new Map(data.map(r => { const o = normalize(r.data); delete o._by; return [r.id, o]; }));
      selected.clear(); renderAll(); saveSoon();
      fitView(false);
    } else {
      objs.forEach((o, id) => dirtySet.add(id));
    }
    if (metaRes.data?.title) setTitle(metaRes.data.title); else api.saveMeta();
    channel = sb.channel('board:' + boardId, { config: { presence: { key: clientId }, broadcast: { self: false } } })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'board_objects', filter: `board_id=eq.${boardId}` }, onRemote)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'board_objects', filter: `board_id=eq.${boardId}` }, onRemote)
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'board_objects' }, onRemote)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'boards', filter: `id=eq.${boardId}` }, ({ new: row }) => {
        if (row?.title && document.activeElement !== $('#title')) { setTitle(row.title); saveSoon(); }
      })
      .on('broadcast', { event: 'cursor' }, ({ payload }) => showCursor(payload))
      .on('presence', { event: 'sync' }, () => {
        presence = {};
        Object.entries(channel.presenceState()).forEach(([k, v]) => { presence[k] = v[0]; });
        [...cursors.keys()].forEach(id => { if (!presence[id]) { cursors.get(id).el.remove(); cursors.delete(id); } });
        renderUsers();
      })
      .subscribe(status => {
        if (status === 'SUBSCRIBED') { ready = true; api.track(); setStatus('on', 'Онлайн'); flush(); }
        else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') { ready = false; setStatus('err', 'Нет связи'); }
      });
    setInterval(flush, 120);
  }
  api.start = start;
  return api;
})();

// ---------- boot ----------
function seed() {
  const add = o => objs.set(o.id, { z: objs.size + 1, ...o });
  add({ id: 'g1', type: 'group', label: 'Добро пожаловать в Miro Do', color: '6', x: -560, y: -300, w: 1120, h: 600, z: -1 });
  add({ id: 'c1', type: 'card', color: '6', x: -520, y: -250, w: 320, h: 230,
    text: '# Miro Do\nДоска как **Miro**, связи как в **Obsidian Canvas**.\n\n- Двойной клик по холсту: новая карточка\n- Потяните за точку на краю: связь\n- Tab: связанная карточка' });
  add({ id: 'c2', type: 'card', color: '4', x: -80, y: -260, w: 300, h: 170,
    text: '## Markdown и формулы\n==Выделение==, `код`, [ссылки](https://jsoncanvas.org)\n\n$$F_{\\text{тр}} = \\mu \\cdot N$$' });
  add({ id: 'c3', type: 'card', color: '2', x: -80, y: -20, w: 300, h: 170,
    text: '## Задачи\n- [x] Создать доску\n- [ ] Вставить ссылку или файл\n- [ ] Пригласить друзей' });
  add({ id: 's1', type: 'sticky', color: '#fff59d', x: 310, y: -250, w: 200, h: 200, text: 'Стикеры, фигуры и рисование тоже здесь' });
  add({ id: 'e1', type: 'arrow', a: { id: 'c1', side: 'right' }, b: { id: 'c2', side: 'left' }, stroke: '', style: 'curve', ends: 'end', label: '' });
  add({ id: 'e2', type: 'arrow', a: { id: 'c1', side: 'right' }, b: { id: 'c3', side: 'left' }, stroke: '', style: 'curve', ends: 'end', label: '' });
  add({ id: 'e3', type: 'arrow', a: { id: 'c2', side: 'right' }, b: { id: 's1', side: 'left' }, stroke: '6', style: 'curve', ends: 'end', label: 'и ещё' });
}
(async () => {
  let raw = await idb.get('board:' + boardId);
  if (raw === undefined) raw = store.get('board:' + boardId);
  const m = await idb.get('meta:' + boardId);
  if (m) { try { meta = { ...meta, ...JSON.parse(m) }; } catch { /* corrupted meta */ } }
  let list = null;
  if (raw) { try { list = JSON.parse(raw); } catch { /* corrupted board */ } }
  if (list) objs = new Map(list.map(normalize).map(o => [o.id, o]));
  else seed();
  setTitle(meta.title);
  setTool('select');
  renderAll(); applyView(); renderUsers();
  if (objs.size) fitView(false);
  sync.start();
  addEventListener('resize', scheduleUI);
  window.miroDebug = { get objs() { return objs; }, view };
})();
})();
