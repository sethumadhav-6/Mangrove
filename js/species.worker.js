// Species classifier worker.
//  engine "clip"     : zero-shot CLIP (transformers.js) against the Kerala prompt lists in kb.js.
//  engine "yolo-cls" : a custom Ultralytics classification model (ONNX) trained on your own drone tiles.
// Tiles (canopy patches) and bird crops can each use a different engine.

let T = null;          // transformers.js module
let ort = null;        // onnxruntime-web module (for yolo-cls)
let clip = null;       // { processor, vision, tile: {ids, emb}, bird: {ids, emb} }
const yolo = {};       // engine sessions keyed by 'tile' | 'bird'
let cfg, device = 'wasm';

const post = (o) => self.postMessage(o);
const status = (text) => post({ type: 'status', text });

function toF32(t) {
  const d = t.data;
  if (d instanceof Float32Array) return d;
  if (d instanceof Uint16Array) { // IEEE half floats
    const o = new Float32Array(d.length);
    for (let i = 0; i < d.length; i++) {
      const h = d[i], s = h & 0x8000 ? -1 : 1, e = (h >> 10) & 0x1f, f = h & 0x3ff;
      o[i] = e === 0 ? s * 2 ** -14 * (f / 1024) : e === 31 ? (f ? NaN : s * Infinity) : s * 2 ** (e - 15) * (1 + f / 1024);
    }
    return o;
  }
  return Float32Array.from(d);
}

function normRows(arr, n, dim) {
  for (let r = 0; r < n; r++) {
    let s = 0; for (let k = 0; k < dim; k++) s += arr[r * dim + k] ** 2;
    s = Math.sqrt(s) || 1; for (let k = 0; k < dim; k++) arr[r * dim + k] /= s;
  }
  return arr;
}

async function hash(str) {
  const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
  return [...new Uint8Array(b)].slice(0, 12).map((x) => x.toString(16).padStart(2, '0')).join('');
}

async function loadWithFallback(Cls, model, tries) {
  let last;
  for (const t of tries) {
    try { return await Cls.from_pretrained(model, { device: t.device, dtype: t.dtype, progress_callback: progress }); }
    catch (e) { last = e; }
  }
  throw last;
}

let lastPct = -1;
function progress(p) {
  if (p.status === 'progress' && p.total) {
    const pct = Math.round((p.loaded / p.total) * 100);
    if (pct !== lastPct && pct % 5 === 0) { lastPct = pct; status(`Downloading ${p.file?.split('/').pop()} ${pct}%`); }
  }
}

// Class embedding = mean of its prompt embeddings (prompt ensembling), re-normalised. Cached in Cache Storage.
async function classEmbeddings(model, classes) {
  const key = await hash(model + JSON.stringify(classes.map((c) => [c.id, c.prompts])));
  const url = `https://cache.local/emb/${key}.json`;
  let cache = null;
  try { cache = await caches.open('mlid-text-emb'); const hit = await cache.match(url); if (hit) { const j = await hit.json(); return { ids: j.ids, dim: j.dim, emb: new Float32Array(j.emb) }; } } catch {}

  status('Preparing species prompts (one-time)…');
  const tok = await T.AutoTokenizer.from_pretrained(model);
  const text = await loadWithFallback(T.CLIPTextModelWithProjection, model, [{ device: 'wasm', dtype: 'q8' }, { device: 'wasm', dtype: 'fp32' }]);
  const texts = [], owner = [];
  classes.forEach((c, i) => c.prompts.forEach((p) => { texts.push(p); owner.push(i); }));
  let all = null, dim = 0;
  for (let s = 0; s < texts.length; s += 32) {
    const batch = texts.slice(s, s + 32);
    const inp = tok(batch, { padding: true, truncation: true });
    const { text_embeds } = await text(inp);
    dim = text_embeds.dims[1];
    if (!all) all = new Float32Array(texts.length * dim);
    all.set(toF32(text_embeds), s * dim);
  }
  normRows(all, texts.length, dim);
  const emb = new Float32Array(classes.length * dim);
  const cnt = new Array(classes.length).fill(0);
  owner.forEach((ci, ti) => { cnt[ci]++; for (let k = 0; k < dim; k++) emb[ci * dim + k] += all[ti * dim + k]; });
  normRows(emb, classes.length, dim);
  try { await text.dispose?.(); } catch {}
  const ids = classes.map((c) => c.id);
  try { await cache?.put(url, new Response(JSON.stringify({ ids, dim, emb: Array.from(emb) }))); } catch {}
  return { ids, dim, emb };
}

async function initClip(m) {
  if (!T) {
    T = await import(m.libs.transformers);
    T.env.allowLocalModels = !!m.localModelPath;
    if (m.localModelPath) { T.env.localModelPath = m.localModelPath; T.env.allowRemoteModels = false; }
    if (m.libs.transformersWasm) T.env.backends.onnx.wasm.wasmPaths = m.libs.transformersWasm;
  }
  const model = m.clipModel;
  const tries = [];
  if (device === 'webgpu') tries.push({ device: 'webgpu', dtype: m.clipDtypeGPU || 'fp16' }, { device: 'webgpu', dtype: 'fp32' });
  tries.push({ device: 'wasm', dtype: 'q8' });
  status('Loading CLIP vision model…');
  const processor = await T.AutoProcessor.from_pretrained(model);
  const vision = await loadWithFallback(T.CLIPVisionModelWithProjection, model, tries);
  clip = { processor, vision };
  if (m.tileClasses) clip.tile = await classEmbeddings(model, m.tileClasses);
  if (m.birdClasses) clip.bird = await classEmbeddings(model, m.birdClasses);
}

async function initYolo(which, spec, libs) {
  if (!ort) { ort = await import(libs.ort + 'ort.webgpu.min.mjs'); ort.env.wasm.wasmPaths = libs.ort; }
  const providers = device === 'webgpu' ? ['webgpu', 'wasm'] : ['wasm'];
  let s;
  try { s = await ort.InferenceSession.create(spec.url, { executionProviders: providers }); }
  catch { s = await ort.InferenceSession.create(spec.url, { executionProviders: ['wasm'] }); }
  yolo[which] = { session: s, spec, canvas: new OffscreenCanvas(spec.imgsz, spec.imgsz) };
}

function cropToImageData(bmp, r, maxSide = 336) {
  const sc = Math.min(1, maxSide / Math.max(r.w, r.h));
  const w = Math.max(8, Math.round(r.w * sc)), h = Math.max(8, Math.round(r.h * sc));
  const c = new OffscreenCanvas(w, h); const x = c.getContext('2d');
  x.drawImage(bmp, r.x, r.y, r.w, r.h, 0, 0, w, h);
  return x.getImageData(0, 0, w, h);
}

function topk(scores, ids, k = 3) {
  return ids.map((id, i) => ({ id, p: scores[i] })).sort((a, b) => b.p - a.p).slice(0, k);
}

async function clipClassify(bmp, rects, bank) {
  if (!rects.length) return [];
  const imgs = rects.map((r) => { const d = cropToImageData(bmp, r); return new T.RawImage(d.data, d.width, d.height, 4).rgb(); });
  const out = [];
  for (let s = 0; s < imgs.length; s += 8) {
    const batch = imgs.slice(s, s + 8);
    const inp = await clip.processor(batch);
    const { image_embeds } = await clip.vision(inp);
    const dim = image_embeds.dims[1]; const e = normRows(toF32(image_embeds), batch.length, dim);
    const nC = bank.ids.length;
    for (let b = 0; b < batch.length; b++) {
      const logits = new Float32Array(nC); let mx = -1e9;
      for (let c = 0; c < nC; c++) {
        let dot = 0; for (let k = 0; k < dim; k++) dot += e[b * dim + k] * bank.emb[c * dim + k];
        logits[c] = 100 * dot; if (logits[c] > mx) mx = logits[c];
      }
      let sum = 0; for (let c = 0; c < nC; c++) { logits[c] = Math.exp(logits[c] - mx); sum += logits[c]; }
      for (let c = 0; c < nC; c++) logits[c] /= sum;
      out.push(topk(logits, bank.ids));
    }
  }
  return out;
}

async function yoloClassify(bmp, rects, which) {
  const { session, spec, canvas } = yolo[which];
  const S = spec.imgsz; const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const res = [];
  for (const r of rects) {
    // Ultralytics classify transform: resize shortest side to S, centre crop S x S, scale 0..1.
    const sc = S / Math.min(r.w, r.h); const cw = S / sc, ch = S / sc;
    const sx = r.x + (r.w - cw) / 2, sy = r.y + (r.h - ch) / 2;
    ctx.drawImage(bmp, sx, sy, cw, ch, 0, 0, S, S);
    const px = ctx.getImageData(0, 0, S, S).data; const n = S * S; const f = new Float32Array(3 * n);
    for (let i = 0, j = 0; i < n; i++, j += 4) { f[i] = px[j] / 255; f[i + n] = px[j + 1] / 255; f[i + 2 * n] = px[j + 2] / 255; }
    const o = await session.run({ [session.inputNames[0]]: new ort.Tensor('float32', f, [1, 3, S, S]) });
    const p = toF32(o[session.outputNames[0]]);
    res.push(topk(p, spec.labels));
  }
  return res;
}

self.onmessage = async (e) => {
  const m = e.data;
  try {
    if (m.type === 'init') {
      cfg = m;
      device = m.preferGPU && self.navigator?.gpu && (await navigator.gpu.requestAdapter()) ? 'webgpu' : 'wasm';
      const needClip = m.tile?.engine === 'clip' || m.bird?.engine === 'clip';
      if (needClip) await initClip({ ...m, clipModel: m.clipModel, tileClasses: m.tile?.engine === 'clip' ? m.tileClasses : null, birdClasses: m.bird?.engine === 'clip' ? m.birdClasses : null });
      if (m.tile?.engine === 'yolo-cls') await initYolo('tile', m.tile, m.libs);
      if (m.bird?.engine === 'yolo-cls') await initYolo('bird', m.bird, m.libs);
      post({ type: 'ready', device, tileEngine: m.tile?.engine, birdEngine: m.bird?.engine });
    } else if (m.type === 'classify') {
      const t0 = performance.now();
      const { bitmap, tiles = [], birds = [] } = m;
      let tileRes = [], birdRes = [];
      if (tiles.length && cfg.tile?.engine === 'clip') tileRes = await clipClassify(bitmap, tiles, clip.tile);
      if (tiles.length && cfg.tile?.engine === 'yolo-cls') tileRes = await yoloClassify(bitmap, tiles, 'tile');
      if (birds.length && cfg.bird?.engine === 'clip') birdRes = await clipClassify(bitmap, birds, clip.bird);
      if (birds.length && cfg.bird?.engine === 'yolo-cls') birdRes = await yoloClassify(bitmap, birds, 'bird');
      bitmap.close();
      post({ type: 'result', id: m.id, tiles: tileRes, birds: birdRes, ms: performance.now() - t0 });
    }
  } catch (err) {
    post({ type: 'error', id: m.id, message: String(err?.message || err) });
  }
};
