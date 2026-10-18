import * as KB from './kb.js';
import * as SRC from './sources.js';
import * as SN from './snaps.js';

const COCO = ['person','bicycle','car','motorcycle','airplane','bus','train','truck','boat','traffic light','fire hydrant','stop sign','parking meter','bench','bird','cat','dog','horse','sheep','cow','elephant','bear','zebra','giraffe','backpack','umbrella','handbag','tie','suitcase','frisbee','skis','snowboard','sports ball','kite','baseball bat','baseball glove','skateboard','surfboard','tennis racket','bottle','wine glass','cup','fork','knife','spoon','bowl','banana','apple','sandwich','orange','broccoli','carrot','hot dog','pizza','donut','cake','chair','couch','potted plant','bed','dining table','toilet','tv','laptop','mouse','remote','keyboard','cell phone','microwave','oven','toaster','sink','refrigerator','book','clock','vase','scissors','teddy bear','hair drier','toothbrush'];

const $ = (s) => document.querySelector(s);
const video = $('#video'), overlay = $('#overlay'), octx = overlay.getContext('2d');

// ---------- settings ----------
const DEFAULTS = { tile: 0.45, nest: 0.4, bird: 0.35, birdsp: 0.35, cool: 15, rows: 3, int: 1500, gpu: true, bg: false, sound: true,
  cats: { mangrove: true, associate: true, bird: true, nest: true }, survey: '', site: KB.SITES[0], alt: '', gps: false };
let S = (() => { try { return { ...DEFAULTS, ...JSON.parse(localStorage.getItem('mlid-settings') || '{}') }; } catch { return { ...DEFAULTS }; } })();
const save = () => { try { localStorage.setItem('mlid-settings', JSON.stringify(S)); } catch {} };

// ---------- state ----------
let cfg, detW, spW;
const st = { ai: true, autosnap: true, detReady: false, spReady: false, detBusy: false, spBusy: false, lastSp: 0,
  dets: [], detAt: 0, tiles: [], birds: [], spAt: 0, detMs: 0, spMs: 0, srcName: '', gps: null, lastSnap: new Map(), lastSnapAt: 0,
  focus: null, frameW: 0, frameH: 0, birdEngine: 'clip' };
let reqId = 0; const pending = new Map();

// ---------- boot ----------
async function boot() {
  bindUI();
  cfg = await (await fetch('models/config.json', { cache: 'no-cache' })).json();
  if (cfg.detector.labels === 'coco') cfg.detector.labels = COCO;
  st.birdEngine = cfg.bird.engine;
  refreshCount(); renderStrip(); renderTally();

  detW = new Worker(new URL('./detector.worker.js', import.meta.url), { type: 'module' });
  detW.onmessage = onDet;
  detW.postMessage({ type: 'init', detector: { ...cfg.detector, url: new URL(cfg.detector.url, location.href).href }, libs: cfg.libs, preferGPU: S.gpu });
  chip('#st-det', 'busy', 'loading…');

  spW = new Worker(new URL('./species.worker.js', import.meta.url), { type: 'module' });
  spW.onmessage = onSp;
  const abs = (o) => (o.url ? { ...o, url: new URL(o.url, location.href).href } : o);
  spW.postMessage({ type: 'init', libs: cfg.libs, preferGPU: S.gpu, clipModel: cfg.clipModel, clipDtypeGPU: cfg.clipDtypeGPU,
    localModelPath: cfg.localModelPath, tile: abs(cfg.tile), bird: abs(cfg.bird),
    tileClasses: KB.allTileClasses().map(({ id, prompts }) => ({ id, prompts })),
    birdClasses: KB.allBirdClasses().map(({ id, prompts }) => ({ id, prompts })) });
  chip('#st-sp', 'busy', 'loading…');
  requestAnimationFrame(tick);
}

function chip(sel, cls, text) { const c = $(sel); c.className = 'chip ' + (cls || ''); c.querySelector('span').textContent = text; }
function toast(t, ms = 2200) { const e = $('#toast'); e.textContent = t; e.classList.add('on'); clearTimeout(e._t); e._t = setTimeout(() => e.classList.remove('on'), ms); }

// ---------- worker messages ----------
function onDet(e) {
  const m = e.data;
  if (m.type === 'ready') { st.detReady = true; chip('#st-det', 'ok', m.ep === 'webgpu' ? 'GPU' : 'CPU'); return; }
  if (m.type === 'error') { console.error('detector', m.message); if (!st.detReady) chip('#st-det', 'err', 'failed'); const f = pending.get(m.id); f?.close?.(); pending.delete(m.id); st.detBusy = false; return; }
  if (m.type === 'result') {
    const frame = pending.get(m.id); pending.delete(m.id);
    st.dets = m.dets.filter((d) => d.score >= S.bird * 0.7); st.detAt = performance.now(); st.detMs = m.ms; st.frameW = m.W; st.frameH = m.H;
    st.detBusy = false;
    // If birds aren't being classified to species (or the classifier isn't ready yet), snap straight from detections.
    if (frame && (!st.spReady || st.birdEngine === 'none')) {
      const cands = m.dets.filter((d) => d.score >= S.bird).map((d) => {
        const inf = KB.info(st.birdEngine === 'none' ? d.label : 'bird');
        return { label: inf.id, conf: d.score, rect: d, kind: 'bird', engine: 'yolo', cat: inf.cat };
      }).filter((c) => S.cats[c.cat]);
      considerSnaps(frame, cands);
    }
    frame?.close();
  }
}

function onSp(e) {
  const m = e.data;
  if (m.type === 'status') { chip('#st-sp', 'busy', m.text); return; }
  if (m.type === 'ready') { st.spReady = true; chip('#st-sp', 'ok', `${m.tileEngine === 'clip' ? 'zero-shot' : 'custom'} · ${m.device === 'webgpu' ? 'GPU' : 'CPU'}`); return; }
  if (m.type === 'error') {
    console.error('species', m.message);
    if (!st.spReady) { chip('#st-sp', 'err', 'failed'); toast('Species model failed to load: ' + m.message, 6000); }
    const p = pending.get(m.id); p?.frame?.close?.(); pending.delete(m.id); st.spBusy = false; return;
  }
  if (m.type === 'result') {
    const p = pending.get(m.id); pending.delete(m.id); st.spBusy = false; st.spMs = m.ms;
    if (!p) return;
    st.tiles = p.tiles.map((r, i) => ({ rect: r, top: m.tiles[i] || [] }));
    st.birds = p.birds.map((r, i) => ({ rect: r, top: m.birds[i] || [] }));
    st.spAt = performance.now();
    const cands = [];
    for (const t of st.tiles) {
      const b = t.top[0]; if (!b) continue; const inf = KB.info(b.id);
      if (inf.cat === 'background' || !S.cats[inf.cat]) continue;
      if (b.p >= (inf.cat === 'nest' ? S.nest : S.tile)) cands.push({ label: b.id, conf: b.p, rect: t.rect, kind: 'tile', engine: cfg.tile.engine, cat: inf.cat, alt: t.top });
    }
    if (S.cats.bird) for (const bd of st.birds) {
      const b = bd.top[0]; if (!b || bd.rect.score < S.bird) continue;
      const species = b.p >= S.birdsp;
      cands.push({ label: species ? b.id : 'bird', conf: species ? b.p : bd.rect.score, rect: bd.rect.box || bd.rect, kind: 'bird', engine: species ? cfg.bird.engine : 'yolo', cat: 'bird', alt: bd.top });
    }
    considerSnaps(p.frame, cands);
    p.frame.close();
    renderInView();
  }
}

// ---------- main loop ----------
let lastDraw = 0;
function tick(t) {
  requestAnimationFrame(tick);
  draw();
  if (!st.ai || video.readyState < 2 || !video.videoWidth) return;
  if (st.detReady && !st.detBusy && (S.cats.bird || S.cats.nest)) runDetect();
  if (st.spReady && !st.spBusy && t - st.lastSp > S.int) runSpecies(t);
  if (t - lastDraw > 500) { lastDraw = t; $('#st-perf span').textContent = `${st.detMs ? Math.round(1000 / st.detMs) + ' fps' : '–'} · ${st.spMs ? (st.spMs / 1000).toFixed(1) + ' s' : '–'}`; }
}

async function runDetect() {
  st.detBusy = true;
  try {
    const bmp = await createImageBitmap(video);
    const keep = await createImageBitmap(bmp);
    const id = ++reqId; pending.set(id, keep);
    detW.postMessage({ type: 'detect', id, bitmap: bmp, conf: Math.min(S.bird * 0.7, 0.25) }, [bmp]);
  } catch (e) { st.detBusy = false; console.warn(e); }
}

function tileRects(W, H) {
  const rows = Math.max(1, S.rows | 0), th = H / rows, cols = Math.max(1, Math.round(W / th)), tw = W / cols;
  const r = [];
  for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) r.push({ x: x * tw, y: y * th, w: tw, h: th });
  return r;
}

async function runSpecies(t) {
  st.spBusy = true; st.lastSp = t;
  try {
    const bmp = await createImageBitmap(video);
    const frame = await createImageBitmap(bmp);
    const W = bmp.width, H = bmp.height;
    const tiles = (S.cats.mangrove || S.cats.associate || S.cats.nest) && cfg.tile.engine !== 'none' ? tileRects(W, H) : [];
    const birds = (S.cats.bird && st.birdEngine !== 'none' && performance.now() - st.detAt < 1500)
      ? st.dets.filter((d) => d.score >= S.bird).slice(0, 8).map((d) => {
          // pad bird boxes so the classifier sees some context; keep at least 48 px
          const p = Math.max(d.w, d.h) * 0.25, s = Math.max(48, Math.max(d.w, d.h) + 2 * p);
          const cx = d.x + d.w / 2, cy = d.y + d.h / 2;
          const x = Math.max(0, cx - s / 2), y = Math.max(0, cy - s / 2);
          return { x, y, w: Math.min(s, W - x), h: Math.min(s, H - y), score: d.score, box: d };
        })
      : [];
    if (!tiles.length && !birds.length) { st.spBusy = false; frame.close(); bmp.close(); return; }
    const id = ++reqId; pending.set(id, { frame, tiles, birds });
    spW.postMessage({ type: 'classify', id, bitmap: bmp, tiles, birds: birds.map(({ x, y, w, h }) => ({ x, y, w, h })) }, [bmp]);
  } catch (e) { st.spBusy = false; console.warn(e); }
}

// ---------- drawing ----------
function videoBox() {
  const cw = overlay.clientWidth, ch = overlay.clientHeight, vw = video.videoWidth, vh = video.videoHeight;
  if (!vw) return null;
  const s = Math.min(cw / vw, ch / vh);
  return { s, ox: (cw - vw * s) / 2, oy: (ch - vh * s) / 2 };
}

function label(ctx, text, x, y, color, size = 12) {
  ctx.font = `600 ${size}px 'IBM Plex Sans', sans-serif`;
  const w = ctx.measureText(text).width + 10, h = size + 8;
  const ly = y - h < 0 ? y : y - h;
  ctx.fillStyle = color; ctx.fillRect(x, ly, w, h);
  ctx.fillStyle = '#06140e'; ctx.fillText(text, x + 5, ly + size + 2);
}

const shortName = (inf) => (inf.sci && inf.cat !== 'bird' && inf.cat !== 'nest' ? inf.sci : inf.common);

function draw() {
  const dpr = devicePixelRatio || 1, cw = overlay.clientWidth, ch = overlay.clientHeight;
  if (overlay.width !== Math.round(cw * dpr) || overlay.height !== Math.round(ch * dpr)) { overlay.width = Math.round(cw * dpr); overlay.height = Math.round(ch * dpr); }
  octx.setTransform(dpr, 0, 0, dpr, 0, 0); octx.clearRect(0, 0, cw, ch);
  const vb = videoBox(); if (!vb || !st.ai) return;
  const now = performance.now();
  const map = (r) => ({ x: vb.ox + r.x * vb.s, y: vb.oy + r.y * vb.s, w: r.w * vb.s, h: r.h * vb.s });

  if (now - st.spAt < Math.max(4000, S.int * 3)) for (const t of st.tiles) {
    const b = t.top[0]; if (!b) continue; const inf = KB.info(b.id);
    const isBg = inf.cat === 'background';
    if (isBg && !S.bg) continue;
    if (!isBg && !S.cats[inf.cat]) continue;
    const thr = inf.cat === 'nest' ? S.nest : S.tile;
    const strong = !isBg && b.p >= thr;
    const r = map(t.rect), col = KB.CATEGORIES[inf.cat].color;
    octx.strokeStyle = col; octx.globalAlpha = strong ? 0.95 : 0.35; octx.lineWidth = strong ? 2 : 1;
    octx.setLineDash(strong ? [] : [4, 4]); octx.strokeRect(r.x + 2, r.y + 2, r.w - 4, r.h - 4); octx.setLineDash([]);
    if (strong || isBg || b.p >= thr * 0.7) label(octx, `${shortName(inf)} ${Math.round(b.p * 100)}%`, r.x + 3, r.y + 3 + 20, col, 11);
    octx.globalAlpha = 1;
  }

  if (now - st.detAt < 1500) for (const d of st.dets) {
    const r = map(d);
    let name = st.birdEngine === 'none' ? KB.info(d.label).common : 'Bird', col = KB.CATEGORIES[KB.info(st.birdEngine === 'none' ? d.label : 'bird').cat].color;
    const m = st.birds.find((b) => b.box && iou(b.box, d) > 0.3) || st.birds.find((b) => iou(b.rect, d) > 0.15);
    if (m && m.top[0] && m.top[0].p >= S.birdsp && now - st.spAt < 4000) name = KB.info(m.top[0].id).common;
    octx.strokeStyle = col; octx.lineWidth = 2; octx.strokeRect(r.x, r.y, r.w, r.h);
    label(octx, `${name} ${Math.round(d.score * 100)}%`, r.x, r.y, col);
  }
}
function iou(a, b) {
  const x1 = Math.max(a.x, b.x), y1 = Math.max(a.y, b.y), x2 = Math.min(a.x + a.w, b.x + b.w), y2 = Math.min(a.y + a.h, b.y + b.h);
  const i = Math.max(0, x2 - x1) * Math.max(0, y2 - y1); return i / (a.w * a.h + b.w * b.h - i + 1e-9);
}

// ---------- in-view list & species card ----------
function renderInView() {
  const agg = new Map();
  for (const t of st.tiles) { const b = t.top[0]; if (!b) continue; const inf = KB.info(b.id); if (inf.cat === 'background' || !S.cats[inf.cat]) continue;
    const a = agg.get(b.id) || { id: b.id, inf, p: 0, n: 0 }; a.p = Math.max(a.p, b.p); a.n++; agg.set(b.id, a); }
  for (const d of st.birds) { const b = d.top[0]; const id = b && b.p >= S.birdsp ? b.id : 'bird'; const inf = KB.info(id);
    const a = agg.get(id) || { id, inf, p: 0, n: 0 }; a.p = Math.max(a.p, b ? b.p : 0); a.n++; agg.set(id, a); }
  const list = [...agg.values()].sort((a, b) => b.p - a.p);
  const ul = $('#inview');
  if (!list.length) { ul.innerHTML = '<li class="muted">Nothing above threshold in view.</li>'; return; }
  ul.innerHTML = '';
  for (const a of list) {
    const li = document.createElement('li'); li.className = 'item'; li.style.setProperty('--c', KB.CATEGORIES[a.inf.cat].color);
    li.innerHTML = `<span class="nm"></span><span class="sc">${Math.round(a.p * 100)}%${a.n > 1 ? ' · ×' + a.n : ''}</span><span class="sub"></span>`;
    li.querySelector('.nm').textContent = a.inf.common || a.id;
    li.querySelector('.sub').textContent = a.inf.sci || '';
    li.onclick = () => showCard(a.id);
    ul.appendChild(li);
  }
  if (!st.focus || !agg.has(st.focus)) showCard(list[0].id, true);
}

function showCard(id, auto) {
  if (!auto) st.focus = id;
  const inf = KB.info(id), c = $('#card'); c.hidden = false;
  c.style.setProperty('--c', KB.CATEGORIES[inf.cat].color);
  const rows = [['Family', inf.family], ['Malayalam', inf.ml], ['In Kerala', inf.kerala], ['Look for', inf.cues]].filter((r) => r[1]);
  c.innerHTML = `<div class="cat">${KB.CATEGORIES[inf.cat].label}</div><h3></h3><div class="cn"></div><dl></dl>`;
  c.querySelector('h3').textContent = inf.sci || inf.common;
  c.querySelector('.cn').textContent = inf.sci ? inf.common : '';
  const dl = c.querySelector('dl');
  for (const [k, v] of rows) { const dt = document.createElement('dt'); dt.textContent = k; const dd = document.createElement('dd'); dd.textContent = v; dl.append(dt, dd); }
}

// ---------- auto-snap ----------
function considerSnaps(frame, cands) {
  if (!st.autosnap || !cands.length) return;
  const now = Date.now();
  cands.sort((a, b) => b.conf - a.conf);
  let taken = 0;
  for (const c of cands) {
    if (taken >= 3) break;
    // tiles: one snap per label per cooldown; birds & nests: per label and per frame region (so a flock gets several)
    const cell = c.kind === 'tile' ? '' : `:${Math.floor(((c.rect.x + c.rect.w / 2) / frame.width) * 3)}${Math.floor(((c.rect.y + c.rect.h / 2) / frame.height) * 3)}`;
    const key = c.label + cell;
    if (now - (st.lastSnap.get(key) || 0) < S.cool * 1000) continue;
    if (now - st.lastSnapAt < 600 && taken === 0 && st.lastSnapAt) continue;
    st.lastSnap.set(key, now); st.lastSnapAt = now; taken++;
    snap(frame, c);
  }
}

function annotate(ctx, W, H, items, ts) {
  const sc = W / 1280;
  for (const it of items) {
    const inf = KB.info(it.label), col = KB.CATEGORIES[inf.cat]?.color || '#fff';
    ctx.strokeStyle = col; ctx.lineWidth = Math.max(2, 3 * sc); ctx.strokeRect(it.rect.x, it.rect.y, it.rect.w, it.rect.h);
    label(ctx, `${shortName(inf)} ${Math.round(it.conf * 100)}%`, it.rect.x, it.rect.y, col, Math.round(16 * sc));
  }
  const bh = Math.round(30 * sc); ctx.fillStyle = 'rgba(6,20,14,.78)'; ctx.fillRect(0, H - bh, W, bh);
  ctx.fillStyle = '#e4efe9'; ctx.font = `${Math.round(14 * sc)}px 'IBM Plex Mono', monospace`;
  const gps = st.gps ? `${st.gps.lat.toFixed(5)}, ${st.gps.lon.toFixed(5)} ±${Math.round(st.gps.acc)}m (GS)` : 'no GPS';
  const txt = `Canopy GS · Mangrove Live ID | ${new Date(ts).toLocaleString('en-IN', { hour12: false })} | ${gps} | ${S.site || ''}${S.alt ? ' | ' + S.alt + ' m AGL' : ''}`;
  ctx.fillText(txt, Math.round(10 * sc), H - Math.round(10 * sc));
}

const blobOf = (cv, q = 0.9) => new Promise((r) => cv.toBlob(r, 'image/jpeg', q));

async function snap(frame, c) {
  const ts = Date.now();
  const W = Math.min(frame.width, 1920), sc = W / frame.width, H = Math.round(frame.height * sc);
  const full = document.createElement('canvas'); full.width = W; full.height = H;
  const fx = full.getContext('2d'); fx.drawImage(frame, 0, 0, W, H);
  const R = { x: c.rect.x * sc, y: c.rect.y * sc, w: c.rect.w * sc, h: c.rect.h * sc };
  // crop with context padding
  const pad = 0.12 * Math.max(R.w, R.h);
  const cx = Math.max(0, R.x - pad), cy = Math.max(0, R.y - pad), cw = Math.min(W - cx, R.w + 2 * pad), chh = Math.min(H - cy, R.h + 2 * pad);
  const cs = Math.min(1, 640 / Math.max(cw, chh));
  const crop = document.createElement('canvas'); crop.width = Math.round(cw * cs); crop.height = Math.round(chh * cs);
  crop.getContext('2d').drawImage(full, cx, cy, cw, chh, 0, 0, crop.width, crop.height);
  annotate(fx, W, H, [{ ...c, rect: R }], ts);

  const inf = KB.info(c.label);
  const rec = {
    id: crypto.randomUUID(), ts, label: c.label, sci: inf.sci || '', common: inf.common || c.label, cat: c.kind === 'manual' ? 'manual' : inf.cat,
    kind: c.kind === 'tile' ? 'tile' : c.kind, conf: c.conf, engine: c.engine,
    alternatives: (c.alt || []).map((a) => ({ id: a.id, p: +a.p.toFixed(3) })),
    bboxN: { x: c.rect.x / frame.width, y: c.rect.y / frame.height, w: c.rect.w / frame.width, h: c.rect.h / frame.height },
    gps: st.gps ? { ...st.gps } : null, alt: S.alt, site: S.site, survey: S.survey, source: st.srcName,
    frame: await blobOf(full, 0.88), crop: await blobOf(crop, 0.92), verified: '', notes: '',
  };
  await SN.put(rec);
  flash(); beep(); addThumb(rec, true); refreshCount(); renderTally();
  toast(`Snapped: ${rec.common}${rec.sci && rec.sci !== rec.common ? ' (' + rec.sci + ')' : ''} · ${Math.round(rec.conf * 100)}%`);
}

async function manualSnap() {
  if (!video.videoWidth) return;
  const frame = await createImageBitmap(video);
  await snap(frame, { label: 'manual', conf: 1, rect: { x: 0, y: 0, w: frame.width, h: frame.height }, kind: 'manual', engine: 'manual' });
  frame.close();
}

function flash() { const f = $('#flash'); f.classList.add('on'); requestAnimationFrame(() => requestAnimationFrame(() => f.classList.remove('on'))); }
let actx;
function beep() {
  if (!S.sound) return;
  try { actx ??= new AudioContext(); const o = actx.createOscillator(), g = actx.createGain(); o.frequency.value = 1320; g.gain.value = 0.06;
    o.connect(g).connect(actx.destination); o.start(); g.gain.exponentialRampToValueAtTime(0.0001, actx.currentTime + 0.12); o.stop(actx.currentTime + 0.13); } catch {}
}

// ---------- strip, tally, gallery ----------
const urls = new Set();
const objUrl = (b) => { const u = URL.createObjectURL(b); urls.add(u); return u; };
function addThumb(rec, isNew) {
  const strip = $('#strip');
  const d = document.createElement('div'); d.className = 'th' + (isNew ? ' new' : '');
  d.style.setProperty('--c', rec.cat === 'manual' ? '#fff' : KB.CATEGORIES[rec.cat]?.color);
  d.innerHTML = '<img alt=""><span></span>';
  d.querySelector('img').src = objUrl(rec.crop);
  d.querySelector('span').textContent = rec.verified ? KB.info(rec.verified).common : rec.common;
  d.onclick = () => openDetail(rec.id);
  strip.prepend(d);
  while (strip.children.length > 30) strip.lastChild.remove();
}
async function renderStrip() { const all = await SN.all(); $('#strip').innerHTML = ''; all.slice(0, 30).reverse().forEach((r) => addThumb(r)); }
async function refreshCount() { $('#snap-count').textContent = (await SN.all()).length; }
async function renderTally() {
  const all = (await SN.all()).filter((r) => !S.survey || r.survey === S.survey);
  const m = new Map(); for (const r of all) { const k = r.verified || r.label; if (k === 'false_positive') continue; m.set(k, (m.get(k) || 0) + 1); }
  const ul = $('#tally'); if (!m.size) { ul.innerHTML = '<li class="muted">None yet.</li>'; return; }
  ul.innerHTML = '';
  [...m.entries()].sort((a, b) => b[1] - a[1]).forEach(([k, n]) => { const li = document.createElement('li'); const s = document.createElement('span'); s.textContent = KB.info(k).common; li.append(s); const b = document.createElement('b'); b.textContent = n; li.append(b); ul.append(li); });
}

async function openGallery() {
  const dlg = $('#gallery'); if (!dlg.open) dlg.showModal();
  const cat = $('#g-cat').value, unv = $('#g-unv').checked;
  const all = (await SN.all()).filter((r) => (!cat || r.cat === cat) && (!unv || !r.verified));
  const g = $('#g-grid'); g.innerHTML = all.length ? '' : '<p class="muted">No snaps yet.</p>';
  for (const r of all) {
    const el = document.createElement('div'); el.className = 'g'; el.style.setProperty('--c', r.cat === 'manual' ? '#fff' : KB.CATEGORIES[r.cat]?.color);
    el.innerHTML = '<img alt="" loading="lazy"><div><b></b><span></span></div>';
    el.querySelector('img').src = objUrl(r.crop);
    el.querySelector('b').textContent = r.verified ? KB.info(r.verified).common : r.common;
    el.querySelector('span').innerHTML = `${Math.round(r.conf * 100)}% · ${new Date(r.ts).toLocaleTimeString('en-IN', { hour12: false })}${r.verified ? ' · <span class="v">✓ verified</span>' : ''}`;
    el.onclick = () => openDetail(r.id);
    g.append(el);
  }
}

function labelOptions(sel, current) {
  sel.innerHTML = '';
  const add = (parent, v, t) => { const o = document.createElement('option'); o.value = v; o.textContent = t; if (v === current) o.selected = true; parent.append(o); };
  add(sel, '', '— not verified —'); add(sel, 'false_positive', '✗ False positive');
  const groups = [['True mangroves', KB.MANGROVES], ['Associate flora', KB.ASSOCIATES], ['Nests', KB.NESTS], ['Birds', [{ id: 'bird', common: 'Bird (unknown species)' }, ...KB.BIRDS]]];
  for (const [name, list] of groups) { const og = document.createElement('optgroup'); og.label = name; list.forEach((s) => add(og, s.id, s.sci && name !== 'Birds' && name !== 'Nests' ? `${s.sci} — ${s.common}` : s.common)); sel.append(og); }
}

async function openDetail(id) {
  const r = await SN.get(id); if (!r) return;
  const dlg = $('#detail');
  $('#d-title').textContent = r.verified ? KB.info(r.verified).common : r.common;
  const fu = objUrl(r.frame); $('#d-img').src = fu; $('#d-dl').href = fu; $('#d-dl').download = `${r.label}_${r.ts}.jpg`;
  const meta = [['Predicted', `${r.common}${r.sci ? ' (' + r.sci + ')' : ''}`], ['Confidence', `${Math.round(r.conf * 100)}% · ${r.engine}`],
    ['Alternatives', (r.alternatives || []).slice(1).map((a) => `${KB.info(a.id).common} ${Math.round(a.p * 100)}%`).join(', ') || '–'],
    ['Time', new Date(r.ts).toLocaleString('en-IN', { hour12: false })], ['GPS (GS)', r.gps ? `${r.gps.lat.toFixed(6)}, ${r.gps.lon.toFixed(6)} ±${Math.round(r.gps.acc)} m` : '–'],
    ['Site', r.site || '–'], ['Survey', r.survey || '–'], ['Altitude', r.alt ? r.alt + ' m AGL' : '–'], ['Source', r.source || '–']];
  const dl = $('#d-meta'); dl.innerHTML = '';
  for (const [k, v] of meta) { const dt = document.createElement('dt'); dt.textContent = k; const dd = document.createElement('dd'); dd.textContent = v; dl.append(dt, dd); }
  labelOptions($('#d-label'), r.verified); $('#d-notes').value = r.notes || '';
  $('#d-save').onclick = async () => { r.verified = $('#d-label').value; r.notes = $('#d-notes').value; await SN.put(r); dlg.close(); toast('Saved'); renderTally(); if ($('#gallery').open) openGallery(); renderStrip(); };
  $('#d-del').onclick = async () => { await SN.del(r.id); dlg.close(); refreshCount(); renderTally(); renderStrip(); if ($('#gallery').open) openGallery(); };
  dlg.showModal();
}

// ---------- UI wiring ----------
function bindUI() {
  // tabs
  document.querySelectorAll('.tabs button').forEach((b) => b.onclick = () => {
    document.querySelectorAll('.tabs button').forEach((x) => x.setAttribute('aria-selected', x === b));
    ['live', 'survey', 'settings'].forEach((t) => $('#tab-' + t).hidden = t !== b.dataset.tab);
  });
  // settings
  const ranges = { '#s-tile': ['tile', (v) => Math.round(v * 100) + '%'], '#s-nest': ['nest', (v) => Math.round(v * 100) + '%'], '#s-bird': ['bird', (v) => Math.round(v * 100) + '%'],
    '#s-birdsp': ['birdsp', (v) => Math.round(v * 100) + '%'], '#s-cool': ['cool', (v) => v + ' s'], '#s-rows': ['rows', (v) => v], '#s-int': ['int', (v) => v + ' ms'] };
  for (const [sel, [k, fmt]] of Object.entries(ranges)) {
    const i = $(sel), o = i.nextElementSibling; i.value = S[k]; o.textContent = fmt(+S[k]);
    i.oninput = () => { S[k] = +i.value; o.textContent = fmt(S[k]); save(); };
  }
  for (const [sel, k] of [['#s-gpu', 'gpu'], ['#s-bg', 'bg'], ['#s-sound', 'sound']]) { const i = $(sel); i.checked = S[k]; i.onchange = () => { S[k] = i.checked; save(); }; }
  document.querySelectorAll('[data-cat]').forEach((i) => { i.checked = S.cats[i.dataset.cat]; i.onchange = () => { S.cats[i.dataset.cat] = i.checked; save(); }; });
  // survey
  const site = $('#sv-site'); KB.SITES.forEach((s) => { const o = document.createElement('option'); o.textContent = s; site.append(o); }); site.value = S.site;
  site.onchange = () => { S.site = site.value; save(); };
  $('#sv-name').value = S.survey; $('#sv-name').oninput = (e) => { S.survey = e.target.value.trim(); save(); renderTally(); };
  $('#sv-alt').value = S.alt; $('#sv-alt').oninput = (e) => { S.alt = e.target.value; save(); };
  const gps = $('#sv-gps'); gps.checked = S.gps; gps.onchange = () => { S.gps = gps.checked; save(); setGps(); }; setGps();

  // sources
  let chosen = null;
  document.querySelectorAll('.src').forEach((b) => b.onclick = async () => {
    chosen = b.dataset.src;
    document.querySelectorAll('.src').forEach((x) => x.classList.toggle('sel', x === b));
    if (chosen === 'screen') return go({});
    $('#src-form').hidden = false;
    $('#f-cam').hidden = chosen !== 'camera'; $('#f-url').hidden = !['whep', 'hls'].includes(chosen); $('#f-file').hidden = chosen !== 'file';
    if (chosen === 'whep') { $('#src-url').placeholder = 'http://localhost:8889/drone/whep'; $('#src-url').value = localStorage.getItem('mlid-whep') || ''; }
    if (chosen === 'hls') { $('#src-url').placeholder = 'https://your-relay.example/drone/index.m3u8'; $('#src-url').value = localStorage.getItem('mlid-hls') || ''; }
    if (chosen === 'camera') {
      const cams = await SRC.listCameras(); const sel = $('#cam-select'); sel.innerHTML = '';
      cams.forEach((c, i) => { const o = document.createElement('option'); o.value = c.deviceId; o.textContent = c.label || `Camera ${i + 1}`; sel.append(o); });
      if (!cams.length) sel.innerHTML = '<option value="">No video device found</option>';
    }
  });
  $('#src-cancel').onclick = () => { $('#src-form').hidden = true; document.querySelectorAll('.src').forEach((x) => x.classList.remove('sel')); };
  $('#src-form').onsubmit = (e) => {
    e.preventDefault();
    const opts = {};
    if (chosen === 'camera') opts.deviceId = $('#cam-select').value;
    if (chosen === 'whep' || chosen === 'hls') { opts.url = $('#src-url').value.trim(); try { localStorage.setItem('mlid-' + chosen, opts.url); } catch {} if (!opts.url) return toast('Enter the stream URL'); }
    if (chosen === 'file') { opts.file = $('#src-file').files[0]; if (!opts.file) return toast('Choose a video file'); }
    go(opts);
  };
  async function go(opts) {
    try {
      await SRC.start(video, chosen, opts, cfg?.libs || {});
      $('#empty').hidden = true;
      st.srcName = { camera: 'Capture: ' + ($('#cam-select').selectedOptions[0]?.textContent || 'camera'), screen: 'Screen share', whep: 'WebRTC: ' + opts.url, hls: 'HLS: ' + opts.url, file: 'File: ' + opts.file?.name }[chosen];
      $('#src-name').textContent = st.srcName;
      video.onended = stopFeed;
      const tr = video.srcObject?.getVideoTracks?.()[0]; if (tr) tr.onended = stopFeed;
    } catch (err) { toast('Could not start feed: ' + (err.message || err), 6000); console.error(err); }
  }
  $('#btn-stop').onclick = stopFeed;
  $('#ai-on').onchange = (e) => { st.ai = e.target.checked; };
  $('#snap-on').onchange = (e) => { st.autosnap = e.target.checked; };
  $('#btn-snap').onclick = manualSnap;
  $('#btn-gallery').onclick = openGallery;
  $('#g-cat').onchange = openGallery; $('#g-unv').onchange = openGallery;
  $('#g-export').onclick = async () => {
    toast('Building ZIP…');
    const all = await SN.all(); if (!all.length) return toast('No snaps to export');
    const blob = await SN.exportZip(all, cfg.libs.jszip, { verifiedOnly: $('#g-vonly').checked });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = `mangrove-live-id_${(S.survey || 'survey').replace(/\W+/g, '-')}_${new Date().toISOString().slice(0, 10)}.zip`; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  };
  $('#g-clear').onclick = async () => {
    const b = $('#g-clear');
    if (b.dataset.armed) { await SN.clearAll(); delete b.dataset.armed; b.textContent = 'Clear all'; openGallery(); refreshCount(); renderTally(); renderStrip(); return; }
    b.dataset.armed = '1'; b.textContent = 'Click again to delete all'; setTimeout(() => { delete b.dataset.armed; b.textContent = 'Clear all'; }, 4000);
  };
  document.querySelectorAll('[data-close]').forEach((b) => b.onclick = () => b.closest('dialog').close());
  $('#gallery').addEventListener('close', () => { for (const u of urls) URL.revokeObjectURL(u); urls.clear(); renderStrip(); });
  addEventListener('keydown', (e) => {
    if (e.target.matches('input, textarea, select') || document.querySelector('dialog[open]')) return;
    if (e.key === 's' || e.key === 'S') manualSnap();
    if (e.key === ' ') { e.preventDefault(); $('#ai-on').click(); }
  });
}

function stopFeed() {
  SRC.stop(video); $('#empty').hidden = false; $('#src-form').hidden = true; $('#src-name').textContent = 'No feed';
  st.dets = []; st.tiles = []; st.birds = []; $('#inview').innerHTML = '<li class="muted">Start a feed to see identifications.</li>';
}

let gpsWatch = null;
function setGps() {
  if (gpsWatch != null) { navigator.geolocation.clearWatch(gpsWatch); gpsWatch = null; }
  if (!S.gps || !navigator.geolocation) { st.gps = null; chip('#st-gps', '', 'off'); return; }
  chip('#st-gps', 'busy', 'waiting');
  gpsWatch = navigator.geolocation.watchPosition(
    (p) => { st.gps = { lat: p.coords.latitude, lon: p.coords.longitude, acc: p.coords.accuracy }; chip('#st-gps', 'ok', `±${Math.round(p.coords.accuracy)} m`); },
    (err) => { st.gps = null; chip('#st-gps', 'err', err.code === 1 ? 'denied' : 'no fix'); },
    { enableHighAccuracy: true, maximumAge: 5000 });
}

boot();
