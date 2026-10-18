// YOLO (Ultralytics, ONNX export) object detector running in a Web Worker with onnxruntime-web.
// Works with the stock COCO model (birds) or a custom-trained model (e.g. egret, cormorant, nest ...).
let ort, session, inputName, cfg, ep = 'none';
let canvas, ctx, keepIdx = null;

async function createSession(url, providers) {
  return ort.InferenceSession.create(url, { executionProviders: providers, graphOptimizationLevel: 'all' });
}

async function init(m) {
  cfg = m.detector;
  ort = await import(m.libs.ort + 'ort.webgpu.min.mjs');
  ort.env.wasm.wasmPaths = m.libs.ort;
  ort.env.logLevel = 'error';
  const order = [];
  if (m.preferGPU && self.navigator?.gpu) order.push(['webgpu']);
  order.push(['wasm']);
  let lastErr;
  for (const p of order) {
    try {
      session = await createSession(cfg.url, p);
      ep = p[0];
      // Warm up once so the first live frame is not slow (and so a broken GPU path falls back here).
      const S = cfg.imgsz;
      await session.run({ [session.inputNames[0]]: new ort.Tensor('float32', new Float32Array(3 * S * S), [1, 3, S, S]) });
      break;
    } catch (e) { lastErr = e; session = null; }
  }
  if (!session) throw lastErr || new Error('Could not create detector session');
  inputName = session.inputNames[0];
  canvas = new OffscreenCanvas(cfg.imgsz, cfg.imgsz);
  ctx = canvas.getContext('2d', { willReadFrequently: true });
  keepIdx = cfg.keep && cfg.keep.length ? cfg.keep.map((n) => cfg.labels.indexOf(n)).filter((i) => i >= 0) : null;
  return { ep, labels: cfg.labels };
}

function preprocess(bmp) {
  const S = cfg.imgsz;
  const r = Math.min(S / bmp.width, S / bmp.height);
  const nw = Math.round(bmp.width * r), nh = Math.round(bmp.height * r);
  const dx = (S - nw) / 2, dy = (S - nh) / 2;
  ctx.fillStyle = 'rgb(114,114,114)';
  ctx.fillRect(0, 0, S, S);
  ctx.drawImage(bmp, dx, dy, nw, nh);
  const px = ctx.getImageData(0, 0, S, S).data;
  const n = S * S, f = new Float32Array(3 * n);
  for (let i = 0, j = 0; i < n; i++, j += 4) {
    f[i] = px[j] / 255; f[i + n] = px[j + 1] / 255; f[i + 2 * n] = px[j + 2] / 255;
  }
  return { tensor: new ort.Tensor('float32', f, [1, 3, S, S]), r, dx, dy };
}

function iou(a, b) {
  const x1 = Math.max(a.x, b.x), y1 = Math.max(a.y, b.y);
  const x2 = Math.min(a.x + a.w, b.x + b.w), y2 = Math.min(a.y + a.h, b.y + b.h);
  const inter = Math.max(0, x2 - x1) * Math.max(0, y2 - y1);
  return inter / (a.w * a.h + b.w * b.h - inter + 1e-9);
}

function postprocess(out, meta, W, H, conf, iouThr) {
  // Ultralytics detect output: [1, 4 + nc, N] with cx, cy, w, h in input pixels.
  const [, C, N] = out.dims; const d = out.data; const nc = C - 4;
  const cands = [];
  const classes = keepIdx || [...Array(nc).keys()];
  for (let i = 0; i < N; i++) {
    let best = -1, bs = conf;
    for (const c of classes) { const s = d[(4 + c) * N + i]; if (s > bs) { bs = s; best = c; } }
    if (best < 0) continue;
    const cx = d[i], cy = d[N + i], w = d[2 * N + i], h = d[3 * N + i];
    let x = (cx - w / 2 - meta.dx) / meta.r, y = (cy - h / 2 - meta.dy) / meta.r;
    let bw = w / meta.r, bh = h / meta.r;
    x = Math.max(0, x); y = Math.max(0, y); bw = Math.min(W - x, bw); bh = Math.min(H - y, bh);
    cands.push({ x, y, w: bw, h: bh, score: bs, cls: best, label: cfg.labels[best] });
  }
  cands.sort((a, b) => b.score - a.score);
  const keep = [];
  for (const c of cands) {
    if (keep.every((k) => k.cls !== c.cls || iou(k, c) < iouThr)) keep.push(c);
    if (keep.length >= 100) break;
  }
  return keep;
}

self.onmessage = async (e) => {
  const m = e.data;
  try {
    if (m.type === 'init') {
      const r = await init(m);
      self.postMessage({ type: 'ready', ...r });
    } else if (m.type === 'detect') {
      const t0 = performance.now();
      const { bitmap } = m;
      const W = bitmap.width, H = bitmap.height;
      const meta = preprocess(bitmap);
      bitmap.close();
      const res = await session.run({ [inputName]: meta.tensor });
      const out = res[session.outputNames[0]];
      const dets = postprocess(out, meta, W, H, m.conf, m.iou ?? 0.45);
      self.postMessage({ type: 'result', id: m.id, dets, W, H, ms: performance.now() - t0 });
    }
  } catch (err) {
    self.postMessage({ type: 'error', id: m.id, message: String(err?.message || err) });
  }
};
