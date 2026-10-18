// Snapshot storage (IndexedDB, on this device) and export (ZIP with images, CSV, GeoJSON, training dataset).
const DB = 'mangrove-live-id', STORE = 'snaps';
let dbp;

function db() {
  if (!dbp) dbp = new Promise((res, rej) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => { const s = r.result.createObjectStore(STORE, { keyPath: 'id' }); s.createIndex('ts', 'ts'); };
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
  });
  return dbp;
}
async function tx(mode, fn) {
  const d = await db();
  return new Promise((res, rej) => {
    const t = d.transaction(STORE, mode); const s = t.objectStore(STORE);
    const out = fn(s); t.oncomplete = () => res(out?.result ?? out); t.onerror = () => rej(t.error);
  });
}

export const put = (snap) => tx('readwrite', (s) => s.put(snap));
export const del = (id) => tx('readwrite', (s) => s.delete(id));
export const clearAll = () => tx('readwrite', (s) => s.clear());
export const get = (id) => tx('readonly', (s) => s.get(id));
export async function all() {
  const d = await db();
  return new Promise((res, rej) => {
    const out = []; const r = d.transaction(STORE).objectStore(STORE).index('ts').openCursor(null, 'prev');
    r.onsuccess = () => { const c = r.result; if (c) { out.push(c.value); c.continue(); } else res(out); };
    r.onerror = () => rej(r.error);
  });
}

const csvEsc = (v) => { const s = v == null ? '' : String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
const stamp = (ts) => new Date(ts).toISOString().replace(/[:.]/g, '-').slice(0, 19);

async function loadJSZip(url) {
  if (window.JSZip) return window.JSZip;
  await new Promise((res, rej) => { const s = document.createElement('script'); s.src = url; s.onload = res; s.onerror = rej; document.head.appendChild(s); });
  return window.JSZip;
}

export async function exportZip(snaps, jszipUrl, { verifiedOnly = false } = {}) {
  const JSZip = await loadJSZip(jszipUrl);
  const zip = new JSZip();
  const cols = ['id', 'timestamp_utc', 'label', 'verified_label', 'scientific_name', 'common_name', 'category', 'confidence', 'engine',
    'bbox_x', 'bbox_y', 'bbox_w', 'bbox_h', 'lat', 'lon', 'gps_accuracy_m', 'gps_source', 'altitude_m', 'site', 'survey', 'source', 'notes', 'frame_file', 'crop_file'];
  const rows = [cols.join(',')]; const feats = [];
  for (const s of snaps) {
    const base = `${stamp(s.ts)}_${s.label}_${s.id.slice(0, 6)}`;
    const frame = `frames/${base}.jpg`, crop = `crops/${base}.jpg`;
    zip.file(frame, s.frame); zip.file(crop, s.crop);
    const finalLabel = s.verified || s.label;
    if (finalLabel !== 'false_positive' && (!verifiedOnly || s.verified)) zip.file(`dataset/${s.kind}/${finalLabel}/${base}.jpg`, s.crop);
    const b = s.bboxN || {};
    rows.push([s.id, new Date(s.ts).toISOString(), s.label, s.verified || '', s.sci, s.common, s.cat, s.conf?.toFixed(3), s.engine,
      b.x?.toFixed(4), b.y?.toFixed(4), b.w?.toFixed(4), b.h?.toFixed(4), s.gps?.lat, s.gps?.lon, s.gps?.acc, s.gps ? 'ground-station browser GPS' : '',
      s.alt, s.site, s.survey, s.source, s.notes, frame, crop].map(csvEsc).join(','));
    if (s.gps) feats.push({ type: 'Feature', geometry: { type: 'Point', coordinates: [s.gps.lon, s.gps.lat] },
      properties: { id: s.id, time: new Date(s.ts).toISOString(), label: finalLabel, scientific: s.sci, category: s.cat, confidence: s.conf, site: s.site, frame } });
  }
  zip.file('snapshots.csv', rows.join('\n'));
  zip.file('snapshots.geojson', JSON.stringify({ type: 'FeatureCollection', features: feats }, null, 1));
  zip.file('README.txt', [
    'Mangrove Live ID export — Canopy Geospatial Solutions',
    'frames/  : full video frame with the identification drawn on it',
    'crops/   : the identified region only',
    'dataset/ : crops sorted as dataset/<tile|bird>/<label>/ — use with training/prepare_dataset.py',
    'GPS is the ground-station (browser) position at snap time, not the drone position.',
    'Use tools/geotag_from_srt.py with the DJI .SRT flight file to replace it with drone coordinates.',
  ].join('\n'));
  return zip.generateAsync({ type: 'blob' }, null);
}
