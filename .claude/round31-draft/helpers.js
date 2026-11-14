// ---- Round 31 helpers (Roto Brush & Refine Edge): EffectCraft's crates/effects/src/roto.rs (the strokes, the chain of
//      frames from the base frame out, the frozen mattes) on Lumina's side; the segmentation itself runs in
//      workers/roto.js (track/src/roto.rs and its modules), and shaders/lumina_roto.wgsl lays the matte over the frame ----
const ROTO_K = [['lumina_roto', 'lr_apply'], ['kernels', 'warp_blend'], ['kernels', 'fill']];
const ROTO_SPAN = 20, ROTO_GRID = 2048, ROTO_FINAL_MAX = 900 * 2 ** 20;
// want: the frame on screen; queue: other frames asked for (Work out every frame, Freeze, export); have: the chain keys
// the worker holds a segmentation for; outline: each frame's matte edge for the overlay; final: each frame's matte
const ROTO = { worker: null, seq: 0, wait: new Map(), have: new Set(), outline: new Map(), final: new Map(), finalBytes: 0,
  want: null, queue: [], busy: false, grab: null, plan: null, tool: null, last: {}, frozen: {}, rgba: new Map(), hash: new WeakMap(), errors: 0 };
function rotoW() {
  if (!ROTO.worker) {
    ROTO.worker = new Worker(new URL('workers/roto.js', location.href));
    ROTO.worker.onmessage = e => { const r = ROTO.wait.get(e.data.id); ROTO.wait.delete(e.data.id); r?.(e.data.res || { error: 'no answer' }); };
    ROTO.worker.onerror = e => { console.warn('roto worker:', e.message); for (const r of ROTO.wait.values()) r({ error: e.message }); ROTO.wait.clear(); };
  }
  return ROTO.worker;
}
const rotoCall = (op, m = {}, tr = []) => new Promise(r => { const id = ++ROTO.seq; ROTO.wait.set(id, r); rotoW().postMessage({ ...m, id, op }, tr); });
// FNV-1a over a string, twice (two seeds), as 16 hex digits
function rotoHash(s) {
  let a = 0x811c9dc5, b = 0x9747b28c;
  for (let i = 0; i < s.length; i++) { const c = s.charCodeAt(i); a = Math.imul(a ^ c, 16777619); b = Math.imul(b ^ c, 2246822519); }
  return (a >>> 0).toString(16).padStart(8, '0') + (b >>> 0).toString(16).padStart(8, '0');
}
const rotoSegKind = k => k === 'fg' || k === 'bg';
const rotoEmpty = d => !d || d.base == null || !d.strokes?.some(s => rotoSegKind(s.k));
const rotoInSpan = (d, g) => !rotoEmpty(d) && g >= d.span[0] && g <= d.span[1];
// the layer's frames (layer frame g is timeline time start + g / fps)
const rotoFrame = (L, T) => Math.floor((T - (L.start || 0)) * S.fps + 1e-6);
const rotoTime = (L, g) => (L.start || 0) + g / S.fps + 1e-4;
function rotoLimits(L) { const [a, b] = liveRange(L), s = L.start || 0; return [Math.max(0, Math.ceil((a - s) * S.fps - 1e-6)), Math.max(0, Math.floor((b - s) * S.fps - 1e-6))]; }
// the layer's own pixel grid (EffectCraft's layer_grid): the layer box at gs grid pixels a layer pixel, and M, frame
// pixel → grid pixel (3 × 3 rows)
function rotoGrid(E) {
  const bw = E.bw, bh = E.bh; if (!(bw > 0 && bh > 0)) return null;
  const inv = m3inv(m3of(E.m)); if (!inv) return null;
  const gs = Math.min(1, E.w / bw, E.h / bh, ROTO_GRID / Math.max(bw, bh)), gw = Math.max(1, Math.round(bw * gs)), gh = Math.max(1, Math.round(bh * gs));
  return { gs, gw, gh, bw, bh, M: m3mul(m3s(gs, gs), m3mul(m3t(bw / 2, bh / 2), inv)) };
}
// the effect's input on the grid, read back (8-bit straight RGBA, gw × gh)
function rotoRead(E, img, G) {
  const wp = fxWarp(E, img, G.M), R = E.read(wp, Math.max(E.w, E.h)), d = new Uint8Array(G.gw * G.gh * 4);
  for (let y = 0; y < G.gh; y++) d.set(R.d.subarray(y * R.w * 4, (y * R.w + G.gw) * 4), y * G.gw * 4);
  E.free(wp); return { w: G.gw, h: G.gh, d };
}
// what a frame's segmentation depends on besides the strokes: the layer's content (not where it sits), the effects
// before this one, the grid and the Roto Brush Propagation settings (EffectCraft's seed)
const ROTO_PLACE = new Set(['x', 'y', 'scale', 'rotation', 'rotX', 'rotY', 'opacity', 'volume']);
function rotoSeed(E, q, G) {
  const L = E.L, own = new Set((L.fx || []).slice(E.idx).map(f => `fx${f.uid}_`)), keep = o => Object.fromEntries(Object.entries(o || {}).filter(([k]) => !ROTO_PLACE.has(k) && ![...own].some(p => k.startsWith(p))));
  const before = (L.fx || []).slice(0, E.idx).filter(f => f.on !== false).map(f => JSON.stringify(f));
  return rotoHash(JSON.stringify([L.kind, L.media, L.text, L.shape, L.src, keep(L.p), keep(L.keys), L.mask, before, G.gw, G.gh,
    q('searchRadius'), q('motionThreshold'), q('motionDamping'), q('quality')]));
}
function rotoStrokeHash(s) { let h = ROTO.hash.get(s); if (!h) { h = rotoHash(JSON.stringify(s)); ROTO.hash.set(s, h); } return h; }
// the chain (RotoData::chain_keys): the base frame's key from the seed and its strokes, every other frame's from its
// neighbour towards the base, its own strokes and which source frame it shows
function rotoChain(E, q, f, G) {
  const L = E.L, d = f.roto, seed = rotoSeed(E, q, G), at = {};
  for (const s of d.strokes) (at[s.f] ||= []).push(s);
  const stamp = g => L.kind === 'video' ? Math.round(srcTime(L, rotoTime(L, g)) * 1000) : 0;
  const key = (prev, g) => rotoHash(prev + '|' + g + '|' + stamp(g) + '|' + (at[g] || []).map(rotoStrokeHash).join(','));
  const keys = new Map(), k0 = key(seed, d.base); keys.set(d.base, k0);
  for (let g = d.base + 1, k = k0; g <= d.span[1]; g++) { k = key(k, g); keys.set(g, k); }
  for (let g = d.base - 1, k = k0; g >= d.span[0]; g--) { k = key(k, g); keys.set(g, k); }
  const rr = d.strokes.filter(s => s.k === 'refine').reduce((m, s) => Math.max(m, s.r), 0);
  const opts = { scale: G.gs, searchRadius: Math.max(0, q('searchRadius')), motionThreshold: q('motionThreshold'), motionDamping: q('motionDamping'), best: q('quality') === 1 };
  return { d, keys, at, rr, opts, src: g => g === d.base || !rotoInSpan(d, g) ? null : g > d.base ? g - 1 : g + 1 };
}
// the matte settings (refine::MatteParams)
const rotoMP = q => ({ rbFeather: Math.max(0, q('rbFeather')), rbContrast: q('rbContrast'), rbShift: q('rbShift'), rbChatter: q('rbChatter'),
  smooth: Math.max(0, q('smooth')), feather: Math.max(0, q('reFeather')), contrast: q('reContrast'), shift: q('reShift'), chatter: q('reChatter'),
  motionBlur: !!q('motionBlur'), mbSamples: clamp(Math.round(q('mbSamples')), 1, 64), shutterAngle: q('shutterAngle'), higherQuality: !!q('higherQuality'),
  decontaminate: !!q('decontaminate'), decontamination: q('deconAmount'), extendWhereSmoothed: !!q('extendSmoothed'), increaseRadius: Math.max(0, q('deconRadius')) });
const rotoNeedsNb = mp => mp.rbChatter > 0 || mp.chatter > 0 || mp.motionBlur;
// the frames a frame's final matte reads: itself, and its neighbours in the span when Reduce Chatter or motion blur is on
const rotoFrames = (C, g, mp) => [g, ...(rotoNeedsNb(mp) ? [g - 1, g + 1].filter(x => rotoInSpan(C.d, x)) : [])];
const rotoFinalKey = (C, g, mp) => rotoHash(rotoFrames(C, g, mp).map(x => C.keys.get(x)).join('|') + JSON.stringify(mp) + '|' + C.rr);
function rotoFinalPut(k, v) {
  const old = ROTO.final.get(k); if (old) { ROTO.finalBytes -= old.bytes; ROTO.final.delete(k); }
  v.bytes = v.a8.length + v.idx.length * 8; ROTO.final.set(k, v); ROTO.finalBytes += v.bytes;
  for (const [kk, e] of ROTO.final) { if (ROTO.finalBytes <= ROTO_FINAL_MAX || ROTO.final.size < 2) break; ROTO.final.delete(kk); ROTO.finalBytes -= e.bytes; }
}
const rotoLru = (m, k) => { const v = m.get(k); if (v !== undefined) { m.delete(k); m.set(k, v); } return v; };
// the grid picture the kernel reads: rgb the decontaminated edge colour of each partly see-through pixel (or the
// map), a the matte (kept for the last few frames shown)
function rotoRGBA(fin, view) {
  const id = fin.key + (view ? 'm' : 'c'), had = rotoLru(ROTO.rgba, id); if (had) return had;
  const n = fin.w * fin.h, o = new Uint8Array(n * 4), { a8, idx, col, map } = fin;
  for (let i = 0; i < n; i++) o[i * 4 + 3] = a8[i];
  for (let k = 0; k < idx.length; k++) { const i = idx[k] * 4; if (view) o[i] = o[i + 1] = o[i + 2] = map[k]; else { o[i] = col[k * 3]; o[i + 1] = col[k * 3 + 1]; o[i + 2] = col[k * 3 + 2]; } }
  ROTO.rgba.set(id, o); while (ROTO.rgba.size > 4) ROTO.rgba.delete(ROTO.rgba.keys().next().value);
  return o;
}
function rotoApply(E, img, G, fin, view, decon) {
  if (fin.w !== G.gw || fin.h !== G.gh) return img;
  const tex = E.texFrom8(rotoRGBA(fin, view), G.gw, G.gh);
  return E.run('lumina_roto', 'lr_apply', fxP({ 0: [view ? 1 : 0, 0, G.gw, G.gh], 1: [decon ? 1 : 0, 0, 0, 0] }, { 0: G.M[0], 1: G.M[1] }), img, tex);
}
// ---- the work: the frame on screen first, then anything queued; one frame's segmentation (or final matte) at a time
// a job: { L, f, g, C, G, mp, fk, final (the matte, not only the segmentation), frozen, done() }
function rotoWant(job) {
  const w = ROTO.want;
  if (!w || w.fk !== job.fk || w.f !== job.f || w.final !== job.final || w.g !== job.g) ROTO.want = job;
  rotoPump();
}
const rotoQueued = () => ROTO.want || ROTO.queue.length;
async function rotoPump() {
  if (ROTO.busy) return; ROTO.busy = true;
  try {
    for (;;) {
      const job = ROTO.want || ROTO.queue[0]; if (!job) break;
      let done = false;
      try { done = await rotoWork(job); } catch (e) { console.warn('roto:', e); ROTO.errors++; done = true; job.failed = String(e.message || e); }
      if (done) {
        if (ROTO.want === job) ROTO.want = null; else ROTO.queue = ROTO.queue.filter(x => x !== job);
        job.done?.(job);
      }
    }
  } finally { ROTO.busy = false; }
}
// the next piece of work for a job; true once it is finished
async function rotoWork(job) {
  const { L, f, C } = job;
  if (!S.layers.includes(L) || !L.fx?.includes(f) || f.roto !== C.d) return true;   // the strokes changed: the job is stale
  if (job.frozen) return rotoFinalFrozen(job);
  for (const g of job.final ? rotoFrames(C, job.g, job.mp) : [job.g]) {
    const k = C.keys.get(g); if (!k) continue;
    if (ROTO.have.has(k)) continue;
    // the frames on the way: from the nearest one the worker already has (or the base frame) out to g
    const path = [g]; let x = g;
    for (;;) { const s = C.src(x); if (s == null) break; if (ROTO.have.has(C.keys.get(s))) break; path.push(s); x = s; }
    await rotoStep(job, path[path.length - 1]);
    return false;
  }
  // (Freeze also needs the Refine Edge band, which a matte made for the screen leaves out)
  if (!job.final || (ROTO.final.has(job.fk) && (!job.band || ROTO.final.get(job.fk).b8))) return true;
  const nb = rotoFrames(C, job.g, job.mp), k = C.keys.get(job.g), prevKey = nb.includes(job.g - 1) ? C.keys.get(job.g - 1) : null, nextKey = nb.includes(job.g + 1) ? C.keys.get(job.g + 1) : null;
  const ask = img => rotoCall('final', { key: k, prevKey, nextKey, mp: job.mp, rr: C.rr, scale: job.G.gs, img, wantBand: !!job.band }, img ? [img.d.buffer] : []);
  let r = await ask(null);
  if (r.need === 'img') { const img = await rotoGrab(job, job.g); if (!img) return true; r = await ask(img); }
  if (r.need === 'seg') { ROTO.have.delete(k); return false; }
  if (r.error) throw new Error(r.error);
  rotoFinalPut(job.fk, { key: job.fk, w: r.w, h: r.h, a8: r.a8, idx: r.idx, col: r.col, map: r.map, b8: r.b8 });
  return true;
}
// one frame's segmentation: the root cut from its strokes, or carried on from its neighbour towards the base
async function rotoStep(job, g) {
  const { C } = job, key = C.keys.get(g), s = C.src(g), prevKey = s == null ? null : C.keys.get(s), root = s == null;
  const send = (img, prevImg) => rotoCall('step', { key, prevKey, root, strokes: C.at[g] || [], opts: C.opts, rr: C.rr, img, prevImg },
    [img?.d.buffer, prevImg?.d.buffer].filter(Boolean));
  const img = await rotoGrab(job, g); if (!img) { job.failed = 'the frame could not be read'; return; }
  let r = await send(img, null);
  if (r.need === 'prev') { const p = await rotoGrab(job, s); if (!p) return; r = await send(null, p); }
  if (r.need === 'img') { const i2 = await rotoGrab(job, g); if (!i2) return; r = await send(i2, null); }
  if (r.need === 'seg') { ROTO.have.delete(prevKey); return; }
  if (r.error) throw new Error(r.error);
  if (r.ok) {
    ROTO.have.add(key); for (const k of r.evicted || []) ROTO.have.delete(k);
    ROTO.outline.set(key, { o: r.outline, band: r.band, gs: C.opts.scale, area: r.area });
    while (ROTO.outline.size > 600) ROTO.outline.delete(ROTO.outline.keys().next().value);
  }
}
// the effect's input at layer frame g on the grid: the layer painted at that moment and the effects before this one
// run (fxApply in grab mode stops at this effect). Video frames are decoded first.
async function rotoGrab(job, g) {
  const { L, f } = job, T = rotoTime(L, g);
  if (L.kind === 'video' && L.media) for (let i = 0; i < 40 && !vfFrame(L, srcTime(L, T)); i++) { await vfSettle(); await new Promise(r => setTimeout(r, 15)); }
  await fxWarm(f.id); await fxWarmUsed();
  const r = RT[L.id] || (ensureRT(L), RT[L.id]) || (RT[L.id] = {}), keep = { m: r.m, box: r.box }, at = VF_AT, rt = renderT, lc = layerCanvas('rotograb');
  ROTO.grab = { uid: f.uid, out: null };
  VF_AT = T; renderT = T;
  try { paintLayer(L, T, lc.cx); fxApply(L, T, lc); }
  finally { VF_AT = at; renderT = rt; r.m = keep.m; r.box = keep.box; }
  const out = ROTO.grab.out; ROTO.grab = null;
  return out;
}
// a frozen frame's final matte: the frozen alpha, with the edge colours decontaminated again (that needs the picture)
async function rotoFinalFrozen(job) {
  if (ROTO.final.has(job.fk)) return true;
  const fr = job.frozen, img = await rotoGrab(job, job.g); if (!img) return true;
  const r = await rotoCall('final', { key: 'frozen:' + job.fk, frozen: { a: fr.a, b: fr.b }, mp: job.mp, rr: job.C.rr, scale: job.G.gs, img }, [img.d.buffer]);
  if (r.error) throw new Error(r.error);
  rotoFinalPut(job.fk, { key: job.fk, w: r.w, h: r.h, a8: r.a8, idx: r.idx, col: r.col, map: r.map });
  return true;
}
// ---- Freeze: every frame's final matte and Refine Edge band kept in the project (run-length coded, base64)
function rotoRLE(a) {
  const out = []; for (let i = 0; i < a.length;) { const v = a[i]; let n = 1; while (i + n < a.length && a[i + n] === v && n < 65535) n++; out.push(n & 255, n >> 8, v); i += n; }
  let s = ''; const b = Uint8Array.from(out); for (let i = 0; i < b.length; i += 32768) s += String.fromCharCode.apply(null, b.subarray(i, i + 32768));
  return btoa(s);
}
function rotoUnRLE(str, n) {
  const b = Uint8Array.from(atob(str), c => c.charCodeAt(0)), o = new Uint8Array(n); let k = 0;
  for (let i = 0; i + 2 < b.length && k < n; i += 3) { const run = b[i] | b[i + 1] << 8; o.fill(b[i + 2], k, Math.min(n, k + run)); k += run; }
  return o;
}
// what the frozen mattes depend on: every chain key and the matte settings (frozen_key)
const rotoFrozenKey = (C, mp) => rotoHash([...C.keys.entries()].sort((a, b) => a[0] - b[0]).map(e => e.join(':')).join(',') + JSON.stringify(mp));
function rotoFrozenAt(f, C, mp, g, G) {
  const F = f.frozen && ROTO.frozen[f.frozen]; if (!F || F.w !== G.gw || F.h !== G.gh || F.key !== rotoFrozenKey(C, mp)) return null;
  const fr = F.frames[g]; if (!fr) return null;
  const n = F.w * F.h; return fr.dec || (fr.dec = { a: rotoUnRLE(fr.a, n), b: rotoUnRLE(fr.b, n) });
}
// plan mode: a render at frame g that only works out what that frame needs (the same code path as the screen)
async function rotoPlan(L, f, g, final, band) {
  ROTO.plan = { uid: f.uid, job: null, final, band };
  const r = RT[L.id] || (ensureRT(L), RT[L.id]) || (RT[L.id] = {}), keep = { m: r.m, box: r.box }, at = VF_AT, rt = renderT, T = rotoTime(L, g), lc = layerCanvas('rotoplan');
  VF_AT = T; renderT = T;
  try { await fxWarm(f.id); await fxWarmUsed(); paintLayer(L, T, lc.cx); fxApply(L, T, lc); }
  finally { VF_AT = at; renderT = rt; r.m = keep.m; r.box = keep.box; }
  const job = ROTO.plan.job; ROTO.plan = null; return job;
}
// every frame of the span worked out (Work out every frame, Freeze, export): resolves with the jobs once all are done
async function rotoAll(L, f, { final = true, band = false, progress } = {}) {
  const d = f.roto; if (rotoEmpty(d)) return [];
  const jobs = [];
  for (let g = d.span[0]; g <= d.span[1]; g++) {
    const job = await rotoPlan(L, f, g, final, band); if (!job) continue;
    jobs.push(new Promise(res => { job.done = res; ROTO.queue.push(job); }));
  }
  rotoPump();
  let n = 0; return Promise.all(jobs.map(p => p.then(j => { progress?.(++n, jobs.length); return j; })));
}
async function rotoFreeze(L, f) {
  if (rotoEmpty(f.roto)) return toast('Paint over the object with the Roto Brush first.');
  f.frozen = null; ROTO.status = 'Freezing…'; inspector();
  const jobs = await rotoAll(L, f, { band: true, progress: (n, m) => { ROTO.status = `Freezing… ${n} of ${m} frames`; } });
  const frames = {}; let size = null, key = null;
  for (const j of jobs) {
    const fin = ROTO.final.get(j.fk); if (!fin || !fin.b8) continue;
    frames[j.g] = { a: rotoRLE(fin.a8), b: rotoRLE(fin.b8) }; size = [fin.w, fin.h]; key = rotoFrozenKey(j.C, j.mp);
  }
  ROTO.status = '';
  if (!size) { inspector(); return toast('Nothing to freeze yet.'); }
  const id = 'rf' + f.uid + '_' + Date.now().toString(36);
  ROTO.frozen[id] = { key, w: size[0], h: size[1], frames }; f.frozen = id; commit(); inspector();
  notice(`Froze ${Object.keys(frames).length} frames of the Roto Brush matte. They are kept in the project.`);
}
// export: every Roto Brush frame in the video worked out before recording starts
async function rotoWarmAll() {
  for (const L of S.layers) for (const f of L.fx || []) if (f.id === 'rotobrush' && f.on !== false && !rotoEmpty(f.roto)) {
    notice('Roto Brush: working out the mattes before exporting…');
    await rotoAll(L, f, { progress: (n, m) => { ROTO.status = `Working out the Roto Brush mattes: ${n} of ${m}`; } });
    ROTO.status = '';
  }
}
// ---- the strokes (roto.stroke): the first foreground or background stroke sets the base frame and a span of 20
// frames each side; later strokes outside the span stretch it. Points and radius in layer pixels
function rotoAddStroke(L, f, s, g) {
  if (f.frozen) { toast('This Roto Brush is frozen. Unfreeze it to paint again.'); return false; }
  const d = f.roto ? { ...f.roto, span: [...f.roto.span], strokes: [...f.roto.strokes] } : { base: null, span: [g, g], strokes: [] }, [lo, hi] = rotoLimits(L);
  if (d.base == null) { if (rotoSegKind(s.k)) { d.base = g; d.span = [Math.max(lo, g - ROTO_SPAN), Math.max(g, Math.min(hi, g + ROTO_SPAN))]; } }
  else d.span = [Math.min(d.span[0], g), Math.max(d.span[1], g)];
  d.strokes.push({ k: s.k, f: g, r: +s.r.toFixed(2), p: s.p.map(p => [+p[0].toFixed(2), +p[1].toFixed(2)]) });
  f.roto = d; return true;
}
