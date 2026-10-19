(() => {
'use strict';

const $ = s => document.querySelector(s);
const board = $('#board'), world = $('#world'), items = $('#items'), selLayer = $('#sel');
const marquee = $('#marquee'), cursorsLayer = $('#cursors'), propsEl = $('#props');

const FILLS = ['#fff59d', '#ffcc80', '#f8bbd0', '#e1bee7', '#bbdefb', '#b2ebf2', '#c8e6c9', '#ffffff', '#e0e0e0', '#424242'];
const STROKES = ['#1e1e24', '#e53935', '#fb8c00', '#fdd835', '#43a047', '#1e88e5', '#8e24aa', '#9e9e9e'];
const USER_COLORS = ['#e53935', '#d81b60', '#8e24aa', '#3949ab', '#1e88e5', '#00897b', '#43a047', '#f4511e', '#6d4c41'];
const TEXT_TYPES = ['sticky', 'shape', 'text'];
const LS = k => 'miro-do:' + k;

// ---------- identity ----------
let boardId = location.hash.slice(1);
if (!boardId) { boardId = Math.random().toString(36).slice(2, 10); history.replaceState(null, '', '#' + boardId); }
addEventListener('hashchange', () => location.reload());
const clientId = Math.random().toString(36).slice(2, 10);
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const store = {
  get(k) { try { return localStorage.getItem(LS(k)); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(LS(k), v); } catch { /* storage unavailable */ } },
};
let userName = store.get('name') || 'Гость ' + Math.floor(100 + Math.random() * 900);
const userColor = store.get('color') || USER_COLORS[Math.floor(Math.random() * USER_COLORS.length)];
store.set('name', userName); store.set('color', userColor);

// ---------- state ----------
let objs = new Map();
const view = { x: innerWidth / 2, y: innerHeight / 2, z: 1 };
let tool = 'select', selected = new Set(), editingId = null, drag = null, spaceDown = false;
let fill = FILLS[0], shapeFill = '#ffffff', stroke = STROKES[0];
const undoStack = [], redoStack = [];
let snapshot = null;
const pointers = new Map();

const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const serialize = () => JSON.stringify([...objs.values()]);
const zs = () => [...objs.values()].map(o => o.z || 0);
const maxZ = () => Math.max(0, ...zs());
const minZ = () => Math.min(0, ...zs());

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
  renderAll(); saveSoon();
}
function undo() { finishEdit(); if (!undoStack.length) return; redoStack.push(serialize()); restore(undoStack.pop()); }
function redo() { finishEdit(); if (!redoStack.length) return; undoStack.push(serialize()); restore(redoStack.pop()); }

// ---------- persistence ----------
let saveTimer = 0;
function saveSoon() { clearTimeout(saveTimer); saveTimer = setTimeout(() => store.set('board:' + boardId, serialize()), 300); }
function loadLocal() {
  const raw = store.get('board:' + boardId);
  if (!raw) return false;
  try { objs = new Map(JSON.parse(raw).map(o => [o.id, o])); return true; } catch { return false; }
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
function clipToBox(o, p) {
  const c = center(o), dx = p.x - c.x, dy = p.y - c.y;
  if (!dx && !dy) return c;
  const hw = o.w / 2 + 6, hh = o.h / 2 + 6;
  let t;
  if (o.type === 'shape' && o.shape === 'ellipse') t = 1 / Math.sqrt((dx * dx) / (hw * hw) + (dy * dy) / (hh * hh));
  else if (o.type === 'shape' && o.shape === 'diamond') t = 1 / (Math.abs(dx) / hw + Math.abs(dy) / hh);
  else t = Math.min(dx ? hw / Math.abs(dx) : Infinity, dy ? hh / Math.abs(dy) : Infinity);
  if (t >= 1) return c;
  return { x: c.x + dx * t, y: c.y + dy * t };
}
function endRef(end) { const t = end.id && objs.get(end.id); return t ? center(t) : { x: end.x, y: end.y }; }
function arrowPts(o) {
  const ra = endRef(o.a), rb = endRef(o.b);
  const ta = o.a.id && objs.get(o.a.id), tb = o.b.id && objs.get(o.b.id);
  return [ta ? clipToBox(ta, rb) : ra, tb ? clipToBox(tb, ra) : rb];
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
  el.className = 'obj ' + o.type + (selected.has(o.id) ? ' selected' : '');
  return el;
}
function removeEl(id) { document.getElementById('o-' + id)?.remove(); }

function shapeSvg(o) {
  const a = `fill="${o.color}" stroke="${o.stroke}" stroke-width="2" vector-effect="non-scaling-stroke"`;
  const body = o.shape === 'ellipse' ? `<ellipse cx="50" cy="50" rx="50" ry="50" ${a}/>`
    : o.shape === 'diamond' ? `<polygon points="50,0 100,50 50,100 0,50" ${a}/>`
    : `<rect x="0" y="0" width="100" height="100" rx="3" ${a}/>`;
  return `<svg viewBox="0 0 100 100" preserveAspectRatio="none">${body}</svg>`;
}
function smoothPath(pts) {
  if (!pts.length) return '';
  if (pts.length < 3) return `M${pts[0][0]} ${pts[0][1]}` + pts.slice(1).map(p => `L${p[0]} ${p[1]}`).join('') + (pts.length === 1 ? 'l0.01 0' : '');
  let d = `M${pts[0][0]} ${pts[0][1]}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const mx = (pts[i][0] + pts[i + 1][0]) / 2, my = (pts[i][1] + pts[i + 1][1]) / 2;
    d += `Q${pts[i][0]} ${pts[i][1]} ${mx} ${my}`;
  }
  const l = pts[pts.length - 1];
  return d + `L${l[0]} ${l[1]}`;
}
function fitText(el, o) {
  const lab = el.querySelector('.label');
  if (!lab) return;
  let fs = o.type === 'sticky' ? 28 : 20;
  const maxH = o.type === 'shape' && o.shape !== 'rect' ? o.h * 0.75 : o.h;
  lab.style.maxWidth = o.type === 'shape' && o.shape !== 'rect' ? '72%' : '';
  lab.style.fontSize = fs + 'px';
  while (fs > 8 && lab.offsetHeight > maxH) { fs--; lab.style.fontSize = fs + 'px'; }
}

function renderObj(o) {
  if (o.type === 'arrow') return renderArrow(o);
  const el = getEl(o);
  el.style.cssText = `left:${o.x}px;top:${o.y}px;width:${o.w}px;z-index:${o.z}` + (o.type === 'text' ? '' : `;height:${o.h}px`);
  if (editingId === o.id) return;
  switch (o.type) {
    case 'sticky':
      el.style.background = o.color;
      el.style.color = o.color === '#424242' ? '#fff' : '';
      el.innerHTML = `<div class="label">${esc(o.text)}</div>`;
      fitText(el, o);
      break;
    case 'shape':
      el.style.color = o.color === '#424242' ? '#fff' : '';
      el.innerHTML = shapeSvg(o) + `<div class="label">${esc(o.text)}</div>`;
      fitText(el, o);
      break;
    case 'text': {
      el.innerHTML = `<div class="label" style="color:${o.stroke};font-size:${o.fs || 24}px">${esc(o.text)}</div>`;
      const h = el.offsetHeight;
      if (h && Math.abs(h - o.h) > 0.5) { o.h = h; renderLinked(o.id); }
      break;
    }
    case 'pen':
      el.innerHTML = `<svg width="100%" height="100%" viewBox="0 0 ${o.vw} ${o.vh}" preserveAspectRatio="none">`
        + `<path class="hit" d="${smoothPath(o.pts)}" stroke-width="16" vector-effect="non-scaling-stroke"/>`
        + `<path d="${smoothPath(o.pts)}" fill="none" stroke="${o.stroke}" stroke-width="${o.sw || 3}" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke"/></svg>`;
      break;
    case 'image':
      el.innerHTML = `<img src="${esc(o.src)}" alt="" draggable="false">`;
      break;
  }
}
function renderArrow(o) {
  const [a, b] = arrowPts(o);
  const pad = 20, sw = o.sw || 2;
  o.x = Math.min(a.x, b.x) - pad; o.y = Math.min(a.y, b.y) - pad;
  o.w = Math.abs(a.x - b.x) + pad * 2; o.h = Math.abs(a.y - b.y) + pad * 2;
  const el = getEl(o);
  el.style.cssText = `left:${o.x}px;top:${o.y}px;width:${o.w}px;height:${o.h}px;z-index:${o.z}`;
  const ax = a.x - o.x, ay = a.y - o.y, bx = b.x - o.x, by = b.y - o.y;
  const ang = Math.atan2(by - ay, bx - ax), s = 10 + sw * 2;
  const head = [[bx, by], [bx - s * Math.cos(ang - 0.42), by - s * Math.sin(ang - 0.42)], [bx - s * Math.cos(ang + 0.42), by - s * Math.sin(ang + 0.42)]];
  const ex = bx - s * 0.8 * Math.cos(ang), ey = by - s * 0.8 * Math.sin(ang);
  el.innerHTML = `<svg width="${o.w}" height="${o.h}">`
    + `<path class="hit" d="M${ax} ${ay}L${bx} ${by}" stroke-width="16"/>`
    + `<path d="M${ax} ${ay}L${ex} ${ey}" stroke="${o.stroke}" stroke-width="${sw}" stroke-linecap="round" fill="none"/>`
    + `<polygon points="${head.map(p => p.join(',')).join(' ')}" fill="${o.stroke}" stroke="${o.stroke}" stroke-linejoin="round" stroke-width="1"/></svg>`;
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
  const g = 24 * view.z;
  board.style.backgroundSize = `${g}px ${g}px`;
  board.style.backgroundPosition = `${view.x}px ${view.y}px`;
  $('#zoomlabel').textContent = Math.round(view.z * 100) + '%';
  scheduleUI();
}
function zoomAt(sx, sy, factor) {
  const nz = clamp(view.z * factor, 0.1, 4);
  const wx = (sx - view.x) / view.z, wy = (sy - view.y) / view.z;
  view.z = nz; view.x = sx - wx * nz; view.y = sy - wy * nz;
  applyView();
}
function fitView() {
  const b = boundsOf([...objs.values()]);
  if (!b) { view.x = innerWidth / 2; view.y = innerHeight / 2; view.z = 1; return applyView(); }
  const m = 100;
  view.z = clamp(Math.min((innerWidth - m * 2) / b.w, (innerHeight - m * 2) / b.h), 0.1, 1.5);
  view.x = innerWidth / 2 - (b.x + b.w / 2) * view.z;
  view.y = innerHeight / 2 - (b.y + b.h / 2) * view.z;
  applyView();
}
const viewCenter = () => ({ x: (innerWidth / 2 - view.x) / view.z, y: (innerHeight / 2 - view.y) / view.z });

// ---------- UI: selection, props, minimap ----------
let uiQueued = false;
function scheduleUI() {
  if (uiQueued) return;
  uiQueued = true;
  requestAnimationFrame(() => { uiQueued = false; renderSelection(); drawMinimap(); });
}
function select(ids) {
  selected = new Set(ids);
  items.querySelectorAll('.obj').forEach(el => el.classList.toggle('selected', selected.has(el.dataset.id)));
  renderProps(); scheduleUI();
}
function renderSelection() {
  selLayer.innerHTML = '';
  const list = [...selected].map(id => objs.get(id)).filter(Boolean);
  if (!list.length || editingId && list.length === 1 && list[0].type !== 'text') return;
  if (list.length === 1 && list[0].type === 'arrow') {
    const [a, b] = arrowPts(list[0]);
    selLayer.innerHTML = `<div class="handle" data-handle="a" style="left:${a.x}px;top:${a.y}px"></div><div class="handle" data-handle="b" style="left:${b.x}px;top:${b.y}px"></div>`;
    return;
  }
  const b = boundsOf(list);
  let html = `<div class="frame" style="left:${b.x - 4}px;top:${b.y - 4}px;width:${b.w + 8}px;height:${b.h + 8}px"></div>`;
  if (list.length === 1) {
    [['nw', b.x, b.y], ['ne', b.x + b.w, b.y], ['sw', b.x, b.y + b.h], ['se', b.x + b.w, b.y + b.h]]
      .forEach(([h, x, y]) => { html += `<div class="handle" data-handle="${h}" style="left:${x}px;top:${y}px"></div>`; });
  }
  selLayer.innerHTML = html;
}
function renderProps() {
  const list = [...selected].map(id => objs.get(id)).filter(Boolean);
  if (!list.length) { propsEl.hidden = true; return; }
  const hasFill = list.some(o => o.type === 'sticky' || o.type === 'shape');
  const hasStroke = list.some(o => ['shape', 'text', 'pen', 'arrow'].includes(o.type));
  const curFill = list.find(o => o.color)?.color, curStroke = list.find(o => o.stroke)?.stroke;
  let html = '';
  if (hasFill) html += FILLS.map(c => `<button class="sw${c === curFill ? ' on' : ''}" data-fill="${c}" style="background:${c}" title="Заливка"></button>`).join('') + '<span class="sep"></span>';
  if (hasStroke) html += STROKES.map(c => `<button class="sw ring${c === curStroke ? ' on' : ''}" data-stroke="${c}" style="border-color:${c}" title="Цвет линии"></button>`).join('') + '<span class="sep"></span>';
  html += `<button data-act="front" title="На передний план (])"><svg viewBox="0 0 24 24"><rect x="8" y="8" width="12" height="12" rx="1"/><path d="M4 16V5a1 1 0 0 1 1-1h11"/></svg></button>`
    + `<button data-act="back" title="На задний план ([)"><svg viewBox="0 0 24 24"><rect x="4" y="4" width="12" height="12" rx="1"/><path d="M20 8v11a1 1 0 0 1-1 1H8"/></svg></button>`
    + `<button data-act="duplicate" title="Дублировать (Ctrl+D)"><svg viewBox="0 0 24 24"><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/></svg></button>`
    + `<button data-act="delete" title="Удалить (Delete)"><svg viewBox="0 0 24 24"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/></svg></button>`;
  propsEl.innerHTML = html;
  propsEl.hidden = false;
}
propsEl.addEventListener('pointerdown', e => e.preventDefault());
propsEl.addEventListener('click', e => {
  const b = e.target.closest('button');
  if (!b) return;
  if (b.dataset.fill || b.dataset.stroke) {
    beginChange();
    selected.forEach(id => {
      const o = objs.get(id);
      if (b.dataset.fill && o.type === 'sticky') o.color = fill = b.dataset.fill;
      if (b.dataset.fill && o.type === 'shape') o.color = shapeFill = b.dataset.fill;
      if (b.dataset.stroke && o.stroke !== undefined) o.stroke = stroke = b.dataset.stroke;
      setObj(o);
    });
    endChange(); renderProps();
  }
});

const mini = $('#minimap'), mctx = mini.getContext('2d');
let miniMap = null;
function drawMinimap() {
  if (getComputedStyle(mini).display === 'none') return;
  const W = mini.width, H = mini.height;
  const vp = { x: -view.x / view.z, y: -view.y / view.z, w: innerWidth / view.z, h: innerHeight / view.z };
  const b = boundsOf([...objs.values(), vp]);
  const pad = 8, s = Math.min((W - pad * 2) / b.w, (H - pad * 2) / b.h);
  const ox = pad + (W - pad * 2 - b.w * s) / 2 - b.x * s, oy = pad + (H - pad * 2 - b.h * s) / 2 - b.y * s;
  miniMap = { s, ox, oy };
  mctx.clearRect(0, 0, W, H);
  [...objs.values()].sort((a, c) => a.z - c.z).forEach(o => {
    mctx.fillStyle = o.type === 'sticky' || o.type === 'shape' ? o.color : o.type === 'image' ? '#b0bec5' : (o.stroke || '#9e9e9e');
    mctx.globalAlpha = o.type === 'arrow' || o.type === 'pen' || o.type === 'text' ? 0.5 : 1;
    mctx.fillRect(ox + o.x * s, oy + o.y * s, Math.max(1.5, o.w * s), Math.max(1.5, o.h * s));
  });
  mctx.globalAlpha = 1;
  mctx.strokeStyle = '#4262ff'; mctx.lineWidth = 1.5;
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
}
$('#toolbar').addEventListener('click', e => {
  const b = e.target.closest('button');
  if (b?.dataset.tool) setTool(b.dataset.tool);
});

function objectAt(e, exclude) {
  for (const el of document.elementsFromPoint(e.clientX, e.clientY)) {
    const h = el.closest?.('.obj');
    if (h && h.dataset.id !== exclude) return objs.get(h.dataset.id);
    if (el === board) break;
  }
  return null;
}
function anchor(hit, p) { return hit && hit.type !== 'arrow' ? { id: hit.id, x: p.x, y: p.y } : { x: p.x, y: p.y }; }
let targetEl = null;
function highlight(o) {
  const el = o && document.getElementById('o-' + o.id);
  if (el === targetEl) return;
  targetEl?.classList.remove('target');
  targetEl = el; targetEl?.classList.add('target');
}

function createAt(type, p, extra = {}) {
  const base = {
    sticky: { type: 'sticky', w: 200, h: 200, color: fill === '#ffffff' ? FILLS[0] : fill, text: '' },
    text: { type: 'text', w: 240, h: 36, stroke, text: '', fs: 24 },
  }[type];
  const o = { ...base, ...extra };
  o.x = p.x - (type === 'text' ? 4 : o.w / 2); o.y = p.y - (type === 'text' ? 18 : o.h / 2);
  return addObj(o);
}

// ---------- pointer handling ----------
board.addEventListener('pointerdown', e => {
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (pointers.size === 2) { startPinch(); return; }
  if (pointers.size > 2) return;
  if (editingId && e.target.closest('[contenteditable="true"]')) return;
  finishEdit();
  $('#menu').hidden = true; $('#help').hidden = true;
  board.setPointerCapture(e.pointerId);
  const p = toWorld(e);
  const handle = e.target.closest('[data-handle]');
  const hitEl = e.target.closest('.obj');
  const hit = hitEl && objs.get(hitEl.dataset.id);

  if (e.button === 1 || e.button === 2 || tool === 'hand' || spaceDown) {
    drag = { mode: 'pan', sx: e.clientX, sy: e.clientY, vx: view.x, vy: view.y };
    board.classList.add('panning');
    return;
  }
  if (handle) {
    const id = [...selected][0];
    beginChange();
    const h = handle.dataset.handle;
    drag = h === 'a' || h === 'b' ? { mode: 'arrowEnd', k: h, id } : { mode: 'resize', h, id, orig: { ...objs.get(id) }, start: p };
    return;
  }
  switch (tool) {
    case 'select':
      if (hit) {
        if (e.shiftKey) { const s = new Set(selected); s.has(hit.id) ? s.delete(hit.id) : s.add(hit.id); select(s); }
        else if (!selected.has(hit.id)) select([hit.id]);
        beginChange();
        drag = { mode: 'move', last: p };
      } else {
        if (!e.shiftKey) select([]);
        drag = { mode: 'marquee', sx: e.clientX, sy: e.clientY, start: p, base: new Set(selected) };
      }
      break;
    case 'sticky':
    case 'text': {
      beginChange();
      const o = createAt(tool, p);
      setTool('select'); select([o.id]);
      startEdit(o.id, true);
      break;
    }
    case 'rect': case 'ellipse': case 'diamond': {
      beginChange();
      const o = addObj({ type: 'shape', shape: tool, x: p.x, y: p.y, w: 1, h: 1, color: shapeFill, stroke, text: '' });
      drag = { mode: 'create', id: o.id, start: p };
      break;
    }
    case 'arrow': {
      beginChange();
      const o = addObj({ type: 'arrow', a: anchor(hit, p), b: { x: p.x, y: p.y }, stroke, sw: 2 });
      drag = { mode: 'arrow', id: o.id, start: p };
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
  if (!drag) return;
  switch (drag.mode) {
    case 'pinch': return movePinch();
    case 'pan':
      view.x = drag.vx + e.clientX - drag.sx; view.y = drag.vy + e.clientY - drag.sy;
      applyView();
      break;
    case 'move': {
      const dx = p.x - drag.last.x, dy = p.y - drag.last.y;
      drag.last = p;
      selected.forEach(id => {
        const o = objs.get(id);
        if (!o) return;
        if (o.type === 'arrow') {
          // ends attached to moving objects follow them; ends attached to static objects detach
          const pts = arrowPts(o);
          ['a', 'b'].forEach((k, i) => {
            if (o[k].id && selected.has(o[k].id)) return;
            o[k] = { x: (o[k].id ? pts[i].x : o[k].x) + dx, y: (o[k].id ? pts[i].y : o[k].y) + dy };
          });
        } else { o.x += dx; o.y += dy; }
        setObj(o);
      });
      break;
    }
    case 'marquee': {
      const x = Math.min(e.clientX, drag.sx), y = Math.min(e.clientY, drag.sy);
      Object.assign(marquee.style, { display: 'block', left: x + 'px', top: y + 'px', width: Math.abs(e.clientX - drag.sx) + 'px', height: Math.abs(e.clientY - drag.sy) + 'px' });
      const r = { x: Math.min(p.x, drag.start.x), y: Math.min(p.y, drag.start.y), w: Math.abs(p.x - drag.start.x), h: Math.abs(p.y - drag.start.y) };
      const ids = new Set(drag.base);
      objs.forEach(o => { if (intersects(r, o)) ids.add(o.id); });
      select(ids);
      break;
    }
    case 'create': {
      const o = objs.get(drag.id);
      let w = p.x - drag.start.x, h = p.y - drag.start.y;
      if (e.shiftKey) { const m = Math.max(Math.abs(w), Math.abs(h)); w = Math.sign(w || 1) * m; h = Math.sign(h || 1) * m; }
      o.x = Math.min(drag.start.x, drag.start.x + w); o.y = Math.min(drag.start.y, drag.start.y + h);
      o.w = Math.max(1, Math.abs(w)); o.h = Math.max(1, Math.abs(h));
      setObj(o);
      break;
    }
    case 'arrow':
    case 'arrowEnd': {
      const o = objs.get(drag.id);
      const hit = objectAt(e, o.id);
      const k = drag.mode === 'arrow' ? 'b' : drag.k;
      const other = o[k === 'a' ? 'b' : 'a'];
      const target = hit && hit.type !== 'arrow' && hit.id !== other.id ? hit : null;
      o[k] = anchor(target, p);
      highlight(target);
      setObj(o);
      break;
    }
    case 'resize': {
      const o = objs.get(drag.id), g = drag.orig, h = drag.h;
      const dx = p.x - drag.start.x, dy = p.y - drag.start.y;
      let x1 = g.x, y1 = g.y, x2 = g.x + g.w, y2 = g.y + g.h;
      if (h.includes('w')) x1 += dx; else x2 += dx;
      if (h.includes('n')) y1 += dy; else y2 += dy;
      let w = Math.max(20, x2 - x1), hh = Math.max(20, y2 - y1);
      if (o.type === 'image' || o.type === 'sticky' && !e.shiftKey || e.shiftKey && o.type !== 'sticky') {
        const r = g.w / g.h;
        if (w / hh > r) hh = w / r; else w = hh * r;
      }
      o.w = w; o.x = h.includes('w') ? g.x + g.w - w : g.x;
      if (o.type !== 'text') { o.h = hh; o.y = h.includes('n') ? g.y + g.h - hh : g.y; }
      if (o.type === 'text') o.fs = clamp(Math.round((g.fs || 24) * w / g.w), 8, 200);
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
      if (hit) removeObj(hit.id);
      break;
    }
  }
});

function drawPen(d) {
  const sw = 3, pad = sw + 2;
  const xs = d.pts.map(q => q[0]), ys = d.pts.map(q => q[1]);
  const x = Math.min(...xs) - pad, y = Math.min(...ys) - pad;
  const w = Math.max(...xs) - x + pad, h = Math.max(...ys) - y + pad;
  const o = d.id ? objs.get(d.id) : { type: 'pen', stroke, sw, id: uid(), z: maxZ() + 1 };
  Object.assign(o, { x, y, w, h, vw: w, vh: h, pts: d.pts.map(q => [+(q[0] - x).toFixed(1), +(q[1] - y).toFixed(1)]) });
  d.id = o.id;
  setObj(o);
}

function endPointer(e) {
  pointers.delete(e.pointerId);
  if (!drag) return;
  if (drag.mode === 'pinch') { if (pointers.size < 2) drag = null; return; }
  const d = drag; drag = null;
  board.classList.remove('panning');
  marquee.style.display = 'none';
  highlight(null);
  if (d.mode === 'create') {
    const o = objs.get(d.id);
    if (o.w < 8 && o.h < 8) { o.w = 160; o.h = 110; if (o.shape !== 'rect') o.h = 140, o.w = 140; o.x = d.start.x - o.w / 2; o.y = d.start.y - o.h / 2; setObj(o); }
    setTool('select'); select([o.id]);
  }
  if (d.mode === 'arrow') {
    const o = objs.get(d.id), [a, b] = arrowPts(o);
    if (Math.hypot(a.x - b.x, a.y - b.y) < 10 && !o.b.id) removeObj(o.id);
    else { setTool('select'); select([o.id]); }
  }
  if (d.mode === 'pen' && d.pts.length === 1) { d.pts.push([d.pts[0][0] + 0.5, d.pts[0][1]]); drawPen(d); }
  endChange();
}
board.addEventListener('pointerup', endPointer);
board.addEventListener('pointercancel', endPointer);
board.addEventListener('contextmenu', e => e.preventDefault());

function startPinch() {
  if (drag && drag.mode !== 'pinch') { const d = drag; drag = null; marquee.style.display = 'none'; if (d.mode === 'create' || d.mode === 'arrow' || d.mode === 'pen') endChange(); }
  const [a, b] = [...pointers.values()];
  drag = { mode: 'pinch', d0: Math.hypot(a.x - b.x, a.y - b.y), z0: view.z, m0: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, vx: view.x, vy: view.y };
}
function movePinch() {
  const [a, b] = [...pointers.values()];
  if (!b) return;
  const d = Math.hypot(a.x - b.x, a.y - b.y), m = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  const nz = clamp(drag.z0 * d / drag.d0, 0.1, 4);
  const wx = (drag.m0.x - drag.vx) / drag.z0, wy = (drag.m0.y - drag.vy) / drag.z0;
  view.z = nz; view.x = m.x - wx * nz; view.y = m.y - wy * nz;
  applyView();
}

board.addEventListener('wheel', e => {
  e.preventDefault();
  if (e.ctrlKey || e.metaKey) zoomAt(e.clientX, e.clientY, Math.exp(-e.deltaY * 0.01));
  else if (e.shiftKey || Math.abs(e.deltaX) > Math.abs(e.deltaY)) { view.x -= e.deltaX || e.deltaY; applyView(); }
  else zoomAt(e.clientX, e.clientY, Math.exp(-e.deltaY * 0.0015));
}, { passive: false });

// ---------- text editing ----------
board.addEventListener('dblclick', e => {
  const el = e.target.closest('.obj');
  if (el) { startEdit(el.dataset.id); return; }
  if (tool === 'select') {
    beginChange();
    const o = createAt('sticky', toWorld(e));
    select([o.id]); startEdit(o.id, true);
  }
});
function startEdit(id, fresh) {
  const o = objs.get(id);
  if (!o || !TEXT_TYPES.includes(o.type)) return;
  if (!fresh) beginChange();
  editingId = id;
  const el = document.getElementById('o-' + id);
  const lab = el.querySelector('.label');
  lab.contentEditable = 'true';
  lab.focus();
  const r = document.createRange(); r.selectNodeContents(lab);
  const s = getSelection(); s.removeAllRanges(); s.addRange(r);
  lab.addEventListener('input', () => {
    o.text = lab.innerText;
    if (o.type !== 'text') fitText(el, o);
    else { o.h = el.offsetHeight; renderLinked(o.id); }
    sync.dirty(o.id); scheduleUI();
  });
  lab.addEventListener('blur', finishEdit, { once: true });
  scheduleUI();
}
function finishEdit() {
  if (!editingId) return;
  const id = editingId; editingId = null;
  const o = objs.get(id), el = document.getElementById('o-' + id);
  if (o && el) {
    o.text = el.querySelector('.label').innerText.replace(/\n$/, '');
    if (o.type === 'text' && !o.text.trim()) removeObj(id); else setObj(o);
  }
  getSelection().removeAllRanges();
  endChange();
}

// ---------- clipboard, layers ----------
const selectionObjs = () => [...selected].map(id => objs.get(id)).filter(Boolean);
function pasteObjs(list, dx, dy) {
  if (!list.length) return;
  beginChange();
  const map = new Map(list.map(o => [o.id, uid()]));
  const out = [];
  let z = maxZ();
  [...list].sort((a, b) => (a.type === 'arrow') - (b.type === 'arrow') || a.z - b.z).forEach(src => {
    const o = JSON.parse(JSON.stringify(src));
    o.id = map.get(src.id); o.z = ++z;
    if (o.type === 'arrow') {
      for (const k of ['a', 'b']) {
        o[k].x += dx; o[k].y += dy;
        if (o[k].id) { if (map.has(o[k].id)) o[k].id = map.get(o[k].id); else delete o[k].id; }
      }
    } else { o.x += dx; o.y += dy; }
    objs.set(o.id, o); out.push(o);
  });
  out.forEach(o => setObj(o));
  select(out.map(o => o.id));
  endChange();
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

let pasteShift = 0;
document.addEventListener('copy', e => {
  if (editingId || !selected.size) return;
  e.preventDefault();
  e.clipboardData.setData('text/plain', 'MIRODO:' + JSON.stringify(selectionObjs()));
  pasteShift = 0;
});
document.addEventListener('cut', e => {
  if (editingId || !selected.size) return;
  e.preventDefault();
  e.clipboardData.setData('text/plain', 'MIRODO:' + JSON.stringify(selectionObjs()));
  pasteShift = -24;
  deleteSelected();
});
document.addEventListener('paste', e => {
  if (editingId) return;
  const files = [...e.clipboardData.files].filter(f => f.type.startsWith('image/'));
  if (files.length) { e.preventDefault(); files.forEach((f, i) => addImage(f, { x: viewCenter().x + i * 30, y: viewCenter().y + i * 30 })); return; }
  const text = e.clipboardData.getData('text/plain');
  if (!text) return;
  e.preventDefault();
  if (text.startsWith('MIRODO:')) {
    try { pasteShift += 24; pasteObjs(JSON.parse(text.slice(7)), pasteShift, pasteShift); } catch { /* not ours */ }
  } else {
    beginChange();
    const o = createAt('sticky', viewCenter(), { text: text.slice(0, 2000) });
    select([o.id]); endChange();
  }
});

// ---------- images ----------
function addImage(file, at) {
  const reader = new FileReader();
  reader.onload = () => {
    const img = new Image();
    img.onload = () => {
      const max = 1200, k = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      const src = file.type === 'image/png' || file.type === 'image/gif' ? c.toDataURL('image/png') : c.toDataURL('image/jpeg', 0.85);
      const w = Math.min(400, img.width), h = w * img.height / img.width;
      beginChange();
      const o = addObj({ type: 'image', src, x: at.x - w / 2, y: at.y - h / 2, w, h });
      setTool('select'); select([o.id]);
      endChange();
    };
    img.src = reader.result;
  };
  reader.readAsDataURL(file);
}
$('#file-image').addEventListener('change', e => { [...e.target.files].forEach(f => addImage(f, viewCenter())); e.target.value = ''; });
board.addEventListener('dragover', e => e.preventDefault());
board.addEventListener('drop', e => {
  e.preventDefault();
  const p = toWorld(e);
  [...e.dataTransfer.files].filter(f => f.type.startsWith('image/')).forEach((f, i) => addImage(f, { x: p.x + i * 30, y: p.y + i * 30 }));
});

// ---------- keyboard ----------
const TOOL_KEYS = { v: 'select', h: 'hand', n: 'sticky', r: 'rect', o: 'ellipse', d: 'diamond', t: 'text', a: 'arrow', p: 'pen', e: 'eraser' };
const KEY_CODES = { KeyV: 'v', KeyH: 'h', KeyN: 'n', KeyR: 'r', KeyO: 'o', KeyD: 'd', KeyT: 't', KeyA: 'a', KeyP: 'p', KeyE: 'e', KeyZ: 'z', KeyY: 'y' };
document.addEventListener('keydown', e => {
  if (editingId) {
    if (e.key === 'Escape') document.activeElement.blur();
    return;
  }
  if (e.target.closest?.('input, textarea')) return;
  const k = KEY_CODES[e.code] || e.key.toLowerCase();
  const mod = e.ctrlKey || e.metaKey;
  if (e.code === 'Space') { if (!spaceDown) { spaceDown = true; board.classList.add('panning'); } e.preventDefault(); return; }
  if (mod && k === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); return; }
  if (mod && k === 'y') { e.preventDefault(); redo(); return; }
  if (mod && k === 'a') { e.preventDefault(); setTool('select'); select([...objs.keys()]); return; }
  if (mod && k === 'd') { e.preventDefault(); pasteObjs(selectionObjs(), 24, 24); return; }
  if (mod && (e.key === '=' || e.key === '+')) { e.preventDefault(); zoomAt(innerWidth / 2, innerHeight / 2, 1.2); return; }
  if (mod && e.key === '-') { e.preventDefault(); zoomAt(innerWidth / 2, innerHeight / 2, 1 / 1.2); return; }
  if (mod && e.key === '0') { e.preventDefault(); zoomAt(innerWidth / 2, innerHeight / 2, 1 / view.z); return; }
  if (mod) return;
  if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); deleteSelected(); return; }
  if (e.key === 'Escape') { select([]); setTool('select'); return; }
  if (e.key === 'Enter' && selected.size === 1) { e.preventDefault(); startEdit([...selected][0]); return; }
  if (e.key === ']') return reorder(true);
  if (e.key === '[') return reorder(false);
  if (e.key === '!' || e.shiftKey && e.code === 'Digit1') return fitView();
  if (e.key === '+' || e.key === '=') return zoomAt(innerWidth / 2, innerHeight / 2, 1.2);
  if (e.key === '-') return zoomAt(innerWidth / 2, innerHeight / 2, 1 / 1.2);
  if (e.key.startsWith('Arrow') && selected.size) {
    e.preventDefault();
    const step = e.shiftKey ? 10 : 1, dx = { ArrowLeft: -step, ArrowRight: step }[e.key] || 0, dy = { ArrowUp: -step, ArrowDown: step }[e.key] || 0;
    beginChange();
    selectionObjs().forEach(o => { if (o.type === 'arrow') { for (const q of ['a', 'b']) if (!o[q].id) { o[q].x += dx; o[q].y += dy; } } else { o.x += dx; o.y += dy; } setObj(o); });
    endChange();
    return;
  }
  if (TOOL_KEYS[k]) setTool(TOOL_KEYS[k]);
});
document.addEventListener('keyup', e => { if (e.code === 'Space') { spaceDown = false; if (!drag) board.classList.remove('panning'); } });

// ---------- top bar actions ----------
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg; t.hidden = false;
  clearTimeout(toast.t); toast.t = setTimeout(() => { t.hidden = true; }, 2200);
}
document.addEventListener('click', e => {
  const b = e.target.closest('[data-act]');
  if (!b) return;
  const act = b.dataset.act;
  if (act !== 'menu') $('#menu').hidden = true;
  switch (act) {
    case 'undo': undo(); break;
    case 'redo': redo(); break;
    case 'menu': $('#menu').hidden = !$('#menu').hidden; break;
    case 'help': $('#help').hidden = !$('#help').hidden; break;
    case 'share':
      navigator.clipboard?.writeText(location.href).then(() => toast(sync.on ? 'Ссылка скопирована — отправьте её коллегам' : 'Ссылка скопирована (совместная работа включится после настройки Supabase)'), () => prompt('Ссылка на доску:', location.href));
      break;
    case 'new': location.hash = Math.random().toString(36).slice(2, 10); break;
    case 'export': {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([serialize()], { type: 'application/json' }));
      a.download = `miro-do-${boardId}.json`; a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
      break;
    }
    case 'import': $('#file-json').click(); break;
    case 'image': $('#file-image').click(); break;
    case 'rename': {
      const n = prompt('Ваше имя на доске:', userName);
      if (n && n.trim()) { userName = n.trim().slice(0, 30); store.set('name', userName); sync.track(); renderUsers(); }
      break;
    }
    case 'clear':
      if (objs.size && confirm('Удалить все объекты с доски? Это можно отменить через Ctrl+Z.')) { beginChange(); [...objs.keys()].forEach(removeObj); select([]); endChange(); }
      break;
    case 'zoomin': zoomAt(innerWidth / 2, innerHeight / 2, 1.2); break;
    case 'zoomout': zoomAt(innerWidth / 2, innerHeight / 2, 1 / 1.2); break;
    case 'zoomreset': zoomAt(innerWidth / 2, innerHeight / 2, 1 / view.z); break;
    case 'fit': fitView(); break;
    case 'front': reorder(true); break;
    case 'back': reorder(false); break;
    case 'duplicate': pasteObjs(selectionObjs(), 24, 24); break;
    case 'delete': deleteSelected(); break;
  }
});
$('#file-json').addEventListener('change', async e => {
  const f = e.target.files[0]; e.target.value = '';
  if (!f) return;
  try {
    const list = JSON.parse(await f.text());
    if (!Array.isArray(list)) throw 0;
    const b = boundsOf(list.filter(o => o.type !== 'arrow')) || { x: 0, y: 0, w: 0, h: 0 }, c = viewCenter();
    pasteObjs(list, c.x - (b.x + b.w / 2), c.y - (b.y + b.h / 2));
    toast('Импортировано объектов: ' + list.length);
  } catch { toast('Не удалось прочитать файл'); }
});

// ---------- users / cursors ----------
let presence = {};
function renderUsers() {
  const others = Object.entries(presence).filter(([k]) => k !== clientId).map(([, v]) => v);
  const me = `<div class="avatar me" data-act="rename" style="background:${userColor}" title="${esc(userName)} (вы) — нажмите, чтобы сменить имя">${esc(userName[0].toUpperCase())}</div>`;
  $('#users').innerHTML = others.slice(0, 5).map(u => `<div class="avatar" style="background:${u.color}" title="${esc(u.name)}">${esc((u.name || '?')[0].toUpperCase())}</div>`).join('')
    + (others.length > 5 ? `<div class="avatar" style="background:#757575">+${others.length - 5}</div>` : '') + me;
}
const cursors = new Map();
function showCursor(c) {
  if (c.id === clientId) return;
  let el = cursors.get(c.id)?.el;
  if (!el) {
    el = document.createElement('div');
    el.className = 'cursor';
    cursorsLayer.appendChild(el);
  }
  el.innerHTML = `<svg viewBox="0 0 24 24"><path d="M3 2l17 9-7.5 1.8L9 20z" fill="${c.color}" stroke="#fff" stroke-width="1.5"/></svg><span style="background:${c.color}">${esc(c.name)}</span>`;
  el.style.left = c.x + 'px'; el.style.top = c.y + 'px';
  clearTimeout(cursors.get(c.id)?.t);
  cursors.set(c.id, { el, t: setTimeout(() => { el.remove(); cursors.delete(c.id); }, 8000) });
}

// ---------- Supabase sync ----------
const sync = (() => {
  const cfg = window.MIRO_CONFIG || {};
  const dirtySet = new Set(), delSet = new Set();
  let sb = null, channel = null, ready = false, flushing = false, lastCursor = 0;
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
  };
  function setStatus(on, text) { const s = $('#status'); s.className = 'pill ' + (on ? 'on' : 'off'); s.textContent = text; }

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
      setStatus(true, 'Онлайн');
    } catch (err) {
      console.error(err);
      ups.forEach(u => { if (!delSet.has(u.id)) dirtySet.add(u.id); });
      dels.forEach(id => delSet.add(id));
      setStatus(false, 'Нет связи');
    }
    flushing = false;
  }

  function onRemote(payload) {
    if (payload.eventType === 'DELETE') {
      const old = payload.old || {};
      if (old.board_id && old.board_id !== boardId) return;
      if (!objs.has(old.id)) return;
      objs.delete(old.id); removeEl(old.id); selected.delete(old.id);
      objs.forEach(a => { if (a.type === 'arrow' && (a.a.id === old.id || a.b.id === old.id)) renderArrow(a); });
      saveSoon(); scheduleUI();
      return;
    }
    const row = payload.new;
    if (!row || row.board_id !== boardId || row.data?._by === clientId) return;
    if (editingId === row.id || (drag && selected.has(row.id))) return;
    const o = row.data; delete o._by;
    objs.set(o.id, o);
    renderObj(o);
    if (o.type !== 'arrow') renderLinked(o.id);
    saveSoon(); scheduleUI();
  }

  async function start() {
    if (!cfg.url || !cfg.key || !window.supabase) { setStatus(false, 'Офлайн'); return; }
    sb = window.supabase.createClient(cfg.url, cfg.key);
    api.on = true;
    setStatus(false, 'Подключение…');
    const { data, error } = await sb.from('board_objects').select('id,data').eq('board_id', boardId);
    if (error) { console.error(error); setStatus(false, 'Ошибка сервера'); sb = null; api.on = false; return; }
    if (data.length) {
      objs = new Map(data.map(r => { delete r.data._by; return [r.id, r.data]; }));
      selected.clear(); renderAll(); saveSoon();
    } else {
      objs.forEach((o, id) => dirtySet.add(id));
    }
    channel = sb.channel('board:' + boardId, { config: { presence: { key: clientId }, broadcast: { self: false } } })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'board_objects', filter: `board_id=eq.${boardId}` }, onRemote)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'board_objects', filter: `board_id=eq.${boardId}` }, onRemote)
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'board_objects' }, onRemote)
      .on('broadcast', { event: 'cursor' }, ({ payload }) => showCursor(payload))
      .on('presence', { event: 'sync' }, () => {
        presence = {};
        Object.entries(channel.presenceState()).forEach(([k, v]) => { presence[k] = v[0]; });
        Object.keys(Object.fromEntries(cursors)).forEach(id => { if (!presence[id]) { cursors.get(id).el.remove(); cursors.delete(id); } });
        renderUsers();
      })
      .subscribe(status => {
        if (status === 'SUBSCRIBED') { ready = true; api.track(); setStatus(true, 'Онлайн'); flush(); }
        else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') { ready = false; setStatus(false, 'Нет связи'); }
      });
    setInterval(flush, 120);
  }
  api.start = start;
  return api;
})();

// ---------- boot ----------
function seed() {
  const notes = [
    ['Привет! Это Miro Do 👋', FILLS[0], -380, -100],
    ['Двойной клик — написать текст', FILLS[1], -100, -100],
    ['Колесо мыши — масштаб, пробел + мышь — двигать холст', FILLS[4], 180, -100],
  ];
  notes.forEach(([text, color, x, y], i) => objs.set('seed' + i, { id: 'seed' + i, type: 'sticky', x, y, w: 200, h: 200, color, text, z: i + 1 }));
  objs.set('seed3', { id: 'seed3', type: 'arrow', a: { id: 'seed0', x: 0, y: 0 }, b: { id: 'seed1', x: 0, y: 0 }, stroke: STROKES[0], sw: 2, z: 4 });
}
if (!loadLocal()) seed();
setTool('select');
renderAll();
applyView();
renderUsers();
if (objs.size) fitView();
sync.start();
addEventListener('resize', scheduleUI);
window.miroDebug = { get objs() { return objs; }, view };
})();
