// ---- Round 32 helpers (3D Camera Tracker): EffectCraft's crates/effects/src/camera_tracker.rs (the settings, the
//      solve keys, the track points, the targets), engine/src/analysis/camera_track.rs (the analysis in the
//      background: step 1 tracks features through the layer, step 2 solves the camera) and engine/src/cmd/camera_cmds.rs
//      (Create Text / Solid on a target, Delete Points) on Lumina's side; the tracking and the solve run in
//      workers/camtrack.js. Lumina has no 3D camera layers yet (After Effects Round A8), so a layer made on a target
//      gets the Camera Track Pin effect: it lays the layer on the target's plane through the solved camera, frame by frame.
const CT_K = [['lumina_camtrack', 'lct_undistort'], ['lumina_gen', 'lg_put'], ['kernels', 'fill']];
const CT_SHOT = ['fixed', 'variable', 'specify'], CT_METHOD = ['auto', 'typical', 'flat', 'tripod'];
const CT_METHOD_NAME = { auto: 'Auto Detect', typical: 'Typical', flat: 'Mostly Flat Scene', tripod: 'Tripod Pan' };
// tracks / solves: content-keyed analyses (tracks key: what the frames are made from; solve key: the tracks and the solve
// settings); fail: why a solve failed; want: the analysis the screen asks for; job: the one running; last: each
// tracker's keys as last drawn; saved: keys read from a project file; tool: picking points on the preview; sel: the
// selected points; hits: the points drawn on the overlay (overlay pixels)
const CT = { worker: null, seq: 0, wait: new Map(), tracks: new Map(), solves: new Map(), fail: new Map(), cancelled: new Set(),
  want: null, job: null, grab: null, last: {}, saved: {}, tool: null, sel: { uid: null, ids: new Set() }, hits: [], hover: null, menu: null };
function ctW() {
  if (!CT.worker) {
    CT.worker = new Worker(new URL('workers/camtrack.js', location.href));
    CT.worker.onmessage = e => {
      if (e.data.progress != null) { if (CT.job) { CT.job.sp = e.data.progress; drawOverlay(); } return; }
      const r = CT.wait.get(e.data.id); CT.wait.delete(e.data.id); r?.(e.data.res || { error: 'no answer' });
    };
    CT.worker.onerror = e => { console.warn('camera tracker worker:', e.message); for (const r of CT.wait.values()) r({ error: e.message }); CT.wait.clear(); };
  }
  return CT.worker;
}
const ctCall = (op, m = {}, tr = []) => new Promise(r => { const id = ++CT.seq; CT.wait.set(id, r); ctW().postMessage({ ...m, id, op }, tr); });
// a solve can't be stopped from outside: Cancel ends the worker (a new one starts with the next analysis)
function ctReset() { CT.worker?.terminate(); CT.worker = null; for (const r of CT.wait.values()) r({ error: 'cancelled' }); CT.wait.clear(); }
// the solve settings (camera_tracker::settings) and what a solve depends on besides the tracks (solve_key)
function ctSettings(f, q) {
  return { shot: CT_SHOT[q('shotType')] || 'fixed', hfov: q('hfov'), method: CT_METHOD[q('solveMethod')] || 'auto',
    deleted: [...new Set(f.deleted || [])].sort((a, b) => a - b), lens: !!(q('lensDistortion') || q('detailed')) };
}
const ctSolveKey = (tk, st) => rotoHash(tk + '|' + st.shot + '|' + (st.shot === 'specify' ? (+st.hfov).toFixed(4) : '') + '|' + st.method + '|' + st.deleted.join(',') + (st.lens ? '|lens' : ''));
// what the tracks are made from: the layer's content (not where it sits), the effects before this one, the grid, the
// frames analysed and which source frames they show, Detailed Analysis (analysis::tracks_key)
function ctTracksKey(E, G, detailed, lo, hi) {
  const L = E.L, after = (L.fx || []).slice(E.idx).map(f => `fx${f.uid}_`), keep = o => Object.fromEntries(Object.entries(o || {}).filter(([k]) => !ROTO_PLACE.has(k) && !after.some(p => k.startsWith(p))));
  const before = (L.fx || []).slice(0, E.idx).filter(f => f.on !== false).map(f => JSON.stringify(f));
  const stamp = g => L.kind === 'video' ? Math.round(srcTime(L, rotoTime(L, g)) * 1000) : 0;
  return rotoHash(JSON.stringify(['camtrack', L.kind, L.media, L.text, L.shape, L.src, keep(L.p), keep(L.keys), L.mask, before, G.gw, G.gh, !!detailed, lo, hi, stamp(lo), stamp(hi), S.fps]));
}
// ---- the solve on the main thread: frames, projection, targets (camtrack.rs)
const ctRod = w => {
  const th = Math.hypot(w[0], w[1], w[2]), K = [[0, -w[2], w[1]], [w[2], 0, -w[0]], [-w[1], w[0], 0]], I = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
  if (th < 1e-12) return I.map((r, i) => r.map((v, j) => v + K[i][j]));
  const a = Math.sin(th) / th, b = (1 - Math.cos(th)) / (th * th), KK = m3mul(K, K);
  return I.map((r, i) => r.map((v, j) => v + a * K[i][j] + b * KK[i][j]));
};
const ctSub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], ctAdd = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]], ctSc = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
const ctDot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2], ctCross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const ctNorm = a => { const n = Math.hypot(a[0], a[1], a[2]); return n > 0 ? ctSc(a, 1 / n) : a; };
const ctMv = (m, v) => [ctDot(m[0], v), ctDot(m[1], v), ctDot(m[2], v)], ctMtv = (m, v) => [0, 1, 2].map(j => m[0][j] * v[0] + m[1][j] * v[1] + m[2][j] * v[2]);
// the analysed frame showing at timeline time T (held at the ends)
function ctFrameIdx(sol, L, T) { return clamp(rotoFrame(L, T) - sol.start, 0, sol.frames.length - 1); }
function ctCam(sol, k) { const c = sol.frames[k]; return c && (c.R ||= ctRod(c.rot), c); }
const ctDistNone = d => !d || d.radius <= 0 || (d.k1 === 0 && d.k2 === 0);
// a world point on frame k → layer pixels (through the lens distortion unless `ideal`); null behind the camera
function ctProject(sol, k, X, ideal) {
  const c = ctCam(sol, k); if (!c) return null;
  const p = ctMv(c.R, ctSub(X, c.center)); if (p[2] <= 1e-9) return null;
  let u = c.focal * p[0] / p[2], v = c.focal * p[1] / p[2];
  const d = sol.distortion;
  if (!ideal && !ctDistNone(d)) { const r2 = (u * u + v * v) / (d.radius * d.radius), s = 1 + d.k1 * r2 + d.k2 * r2 * r2; u *= s; v *= s; }
  return [u + sol.size[0] / 2, v + sol.size[1] / 2, p[2]];
}
// the points tracked on frame k: [{ id, x, y, z }] (layer pixels, camera depth)
function ctVisible(sol, k, ideal) {
  const out = [];
  for (const p of sol.points) if (p.first - 0 <= k && k <= p.last) { const q = ctProject(sol, k, p.pos, ideal); if (q) out.push({ id: p.id, x: q[0], y: q[1], z: q[2] }); }
  return out;
}
const ctMedianZ = v => { const z = v.map(p => p.z).sort((a, b) => a - b); return z.length ? z[z.length >> 1] : 1; };
const ctTargetRadius = (pct, z, mz) => clamp(6 * pct / 100 * (mz / Math.max(z, 1e-9)), 1.5, 40);
// a point's own colour (After Effects draws each target in its own colour)
function ctColor(id) {
  let h = Math.imul(id, 0x9e3779b9) ^ 0x5bd1e995; h ^= h >>> 15; h >>>= 0;
  const hue = (h % 360) / 60, x = 1 - Math.abs(hue % 2 - 1), i = Math.floor(hue);
  const [r, g, b] = i === 0 ? [1, x, 0] : i === 1 ? [x, 1, 0] : i === 2 ? [0, 1, x] : i === 3 ? [0, x, 1] : i === 4 ? [x, 0, 1] : [1, 0, x];
  return [.25 + .75 * r, .25 + .75 * g, .25 + .75 * b].map(v => Math.round(v * 255));
}
// least-squares plane through points: [centroid, unit normal, RMS in-plane spread] (geometry::fit_plane)
function ctFitPlane(P) {
  if (P.length < 3) return null;
  const k = 1 / P.length, c = ctSc(P.reduce(ctAdd, [0, 0, 0]), k), a = [0, 0, 0, 0, 0, 0, 0, 0, 0];
  for (const q of P) { const d = ctSub(q, c); for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) a[i * 3 + j] += d[i] * d[j] * k; }
  const v = [1, 0, 0, 0, 1, 0, 0, 0, 1];
  for (let it = 0; it < 60; it++) {
    let off = a[1] * a[1] + a[2] * a[2] + a[5] * a[5]; if (off < 1e-30) break;
    for (const [p, q] of [[0, 1], [0, 2], [1, 2]]) {
      const apq = a[p * 3 + q]; if (Math.abs(apq) < 1e-300) continue;
      const th = (a[q * 4] - a[p * 4]) / (2 * apq), t = th === 0 ? 1 : Math.sign(th) / (Math.abs(th) + Math.sqrt(th * th + 1)), cs = 1 / Math.sqrt(t * t + 1), sn = t * cs;
      for (let r = 0; r < 3; r++) { const x = a[r * 3 + p], y = a[r * 3 + q]; a[r * 3 + p] = cs * x - sn * y; a[r * 3 + q] = sn * x + cs * y; }
      for (let r = 0; r < 3; r++) { const x = a[p * 3 + r], y = a[q * 3 + r]; a[p * 3 + r] = cs * x - sn * y; a[q * 3 + r] = sn * x + cs * y; }
      for (let r = 0; r < 3; r++) { const x = v[r * 3 + p], y = v[r * 3 + q]; v[r * 3 + p] = cs * x - sn * y; v[r * 3 + q] = sn * x + cs * y; }
    }
  }
  const o = [0, 1, 2].sort((x, y) => a[x * 4] - a[y * 4]);
  if (a[o[1] * 4] <= 1e-18) return null;
  return [c, ctNorm([v[o[0]], v[3 + o[0]], v[6 + o[0]]]), Math.sqrt(Math.max(0, a[o[1] * 4] + a[o[2] * 4]))];
}
// the target: the plane through points `ids` seen from frame k, facing the camera, sized by their spread
// (CameraSolve::target)
function ctTarget(sol, ids, k) {
  const P = ids.map(i => sol.points.find(p => p.id === i)?.pos).filter(Boolean), cam = ctCam(sol, k), fp = cam && ctFitPlane(P); if (!fp) return null;
  let [c, n, spread] = fp; if (ctDot(n, ctSub(cam.center, c)) < 0) n = ctSc(n, -1);
  return { center: c, normal: n, size: Math.max(spread * 2, Math.hypot(...ctSub(cam.center, c)) * 0.12) };
}
// a layer lying on a plane facing the camera: its x axis along the camera's right, projected on the plane; y = z × x
// (camera_track::plane_orientation)
function ctPlaneAxes(normal, right) {
  const z = ctSc(normal, -1); let x = ctSub(right, ctSc(z, ctDot(right, z)));
  if (Math.hypot(...x) < 1e-9) { x = Math.abs(z[0]) < .9 ? [1, 0, 0] : [0, 1, 0]; x = ctSub(x, ctSc(z, ctDot(x, z))); }
  x = ctNorm(x); return { x, y: ctCross(z, x) };
}
// the solve and tracks a tracker effect has now (or the keys it had when the project was saved)
function ctOf(f) {
  const k = CT.last[f.uid] || CT.saved[f.uid]; if (!k) return {};
  return { job: CT.last[f.uid], tracks: CT.tracks.get(k.tk), sol: CT.solves.get(k.sk), fail: CT.fail.get(k.sk), tk: k.tk, sk: k.sk };
}
function ctStatus(f) {
  const { job, sol, fail, tracks, tk } = ctOf(f), j = CT.job;
  if (j && j.f === f) return j.step === 1 ? `Analyzing in background (step 1 of 2): ${j.n || 0} of ${j.m} frames` : 'Solving camera (step 2 of 2)…';
  if (sol) {
    const solved = sol.frames.filter(x => x.solved).length, part = solved < sol.frames.length ? ` · Partial solve: ${solved} of ${sol.frames.length} frames` : '';
    return `Method used: ${CT_METHOD_NAME[sol.methodUsed] || sol.methodUsed} · Average error: ${sol.averageError.toFixed(2)} pixels${part}`;
  }
  if (fail) return 'Unable to solve camera: try another Solve Method or Shot Type';
  if (CT.want?.f === f) return tracks ? 'Waiting to solve' : 'Waiting to analyze';
  if (tk && CT.cancelled.has(tk)) return 'Not analyzed: click Analyze';
  return job ? 'Waiting to analyze' : 'Not analyzed: click Analyze';
}
// ---- the analysis, in the background: the tracker the screen shows first, one at a time
function ctWant(job) {
  if (CT.job && CT.job.sk === job.sk && CT.job.f === job.f) return;
  if (!CT.want || CT.want.sk !== job.sk || CT.want.f !== job.f) CT.want = job;
  queueMicrotask(ctPump);
}
// Analyze (again): forget a failed or cancelled analysis of what the effect shows now
function ctAnalyze(L, f) {
  const { tk, sk } = ctOf(f); if (tk) CT.cancelled.delete(tk); if (sk) CT.fail.delete(sk);
  const j = CT.last[f.uid]; if (j) ctWant(j); else refresh();
}
function ctCancel(f) {
  const j = CT.job; if (j?.f === f) { j.cancel = true; if (j.step === 2) ctReset(); }
  if (CT.want?.f === f) { CT.cancelled.add(CT.want.tk); CT.want = null; }
  inspector(); drawOverlay();
}
async function ctPump() {
  if (CT.job || !CT.want) return;
  const job = CT.job = CT.want; CT.want = null;
  job.step = CT.tracks.has(job.tk) ? 2 : 1; job.n = 0; job.m = job.hi - job.lo + 1; inspector(); drawOverlay();
  try {
    if (job.step === 1) {
      const jid = ++CT.seq;
      await ctCall('begin', { jid, size: [job.G.bw, job.G.bh], gs: job.G.gs, detailed: job.detailed });
      for (let g = job.lo; g <= job.hi; g++) {
        if (job.cancel) { ctCall('drop', { jid }); throw 'cancel'; }
        const img = await ctGrab(job, g); if (!img) throw new Error('a frame could not be read');
        const r = await ctCall('push', { jid, img }, [img.d.buffer]); if (r.error) throw new Error(r.error);
        job.n = g - job.lo + 1; if (job.n % 4 === 0) { drawOverlay(); inspector(); }
      }
      const r = await ctCall('finish', { jid, start: job.lo, fd: 1 / S.fps }); if (r.error) throw new Error(r.error);
      CT.tracks.set(job.tk, r.tracks); job.step = 2; inspector(); drawOverlay();
    }
    const r = await ctCall('solve', { tracks: CT.tracks.get(job.tk), settings: job.st });
    if (job.cancel) throw 'cancel';
    if (r.error) CT.fail.set(job.sk, r.error); else { CT.solves.set(job.sk, r.solve); job.ms = r.ms; }
  } catch (e) {
    if (e === 'cancel' || job.cancel) CT.cancelled.add(job.tk);
    else CT.fail.set(job.sk, String(e?.message || e));
  } finally {
    CT.job = null; refresh();
    if (CT.solves.has(job.sk) && S.sel === job.L.id) notice('Camera solved. Click inside three track points (or Select track points), then right-click to place text or a solid in the scene.');
    ctPump();
  }
}
// the effect's input at layer frame g on the grid (fxApply in grab mode stops at this effect; rotoGrab's way)
async function ctGrab(job, g) {
  const { L, f } = job, T = rotoTime(L, g);
  if (L.kind === 'video' && L.media) for (let i = 0; i < 40 && !vfFrame(L, srcTime(L, T)); i++) { await vfSettle(); await new Promise(r => setTimeout(r, 15)); }
  await fxWarm(f.id); await fxWarmUsed();
  const r = RT[L.id] || (ensureRT(L), RT[L.id]) || (RT[L.id] = {}), keep = { m: r.m, box: r.box }, at = VF_AT, rt = renderT, lc = layerCanvas('ctgrab');
  CT.grab = { uid: f.uid, out: null }; VF_AT = T; renderT = T;
  try { paintLayer(L, T, lc.cx); fxApply(L, T, lc); }
  finally { VF_AT = at; renderT = rt; r.m = keep.m; r.box = keep.box; }
  const out = CT.grab.out; CT.grab = null; return out;
}
// export waits for the analyses the frames need
async function ctWarmAll() {
  const t0 = performance.now();
  while ((CT.job || CT.want) && performance.now() - t0 < 30 * 60e3) await new Promise(r => setTimeout(r, 100));
}
// ---- Undistort Footage and Render Track Points, drawn into the frame
function ctUndistortRun(E, img, G, d) {
  const Mi = m3inv(G.M) || m3t(0, 0);
  return E.run('lumina_camtrack', 'lct_undistort', fxP({ 0: [G.gw, G.gh, 0, 0] }, { 0: G.M[0], 1: G.M[1], 2: Mi[0], 3: Mi[1], 4: [G.gs, d.k1, d.k2, d.radius], 5: [G.bw / 2, G.bh / 2, G.bw, G.bh] }), img);
}
let CT_CV = null;
function ctRenderPoints(E, img, sol, k, ideal, pct) {
  const w = E.w, h = E.h; if (!CT_CV) CT_CV = document.createElement('canvas');
  if (CT_CV.width !== w || CT_CV.height !== h) { CT_CV.width = w; CT_CV.height = h; }
  const cx = CT_CV.getContext('2d', { willReadFrequently: true }); cx.setTransform(1, 0, 0, 1, 0, 0); cx.clearRect(0, 0, w, h);
  const m = DOMMatrix.fromMatrix(E.m).translate(-E.bw / 2, -E.bh / 2), pts = ctVisible(sol, k, ideal), mz = ctMedianZ(pts), sc = E.sc;
  for (const p of pts) {
    const q = m.transformPoint(new DOMPoint(p.x, p.y)), r = ctTargetRadius(pct, p.z, mz) * sc, [cr, cg, cb] = ctColor(p.id);
    cx.strokeStyle = cx.fillStyle = `rgb(${cr},${cg},${cb})`; cx.lineWidth = Math.max(1, r * .25);
    cx.beginPath(); cx.arc(q.x, q.y, r, 0, Math.PI * 2); cx.stroke();
    cx.beginPath(); cx.arc(q.x, q.y, Math.max(.8, r * .2), 0, Math.PI * 2); cx.fill();
  }
  const d = cx.getImageData(0, 0, w, h).data;
  for (let i = 0; i < d.length; i += 4) { const a = d[i + 3]; if (a < 255) { d[i] = d[i] * a / 255; d[i + 1] = d[i + 1] * a / 255; d[i + 2] = d[i + 2] * a / 255; } }
  return E.run('lumina_gen', 'lg_put', fxP({ 0: [1, 0, 0, 0] }), img, E.texFrom8(d, w, h));
}
// ---- Camera Track Pin: the layer's box laid on its target's plane through the tracker's solved camera
function ctPinQuad(pin, E, k1) {
  const src = byId(pin.lid), r = src && RT[src.id], tf = src?.fx?.find(x => x.uid === pin.uid);
  if (!tf || tf.on === false || !r?.m || !r.box) return undefined;
  const { sol } = ctOf(tf); if (!sol) return undefined;
  const k = ctFrameIdx(sol, src, E.T), ideal = !!tf.undistort && !ctDistNone(sol.distortion);
  const hw = pin.size * k1 / 2, hh = hw * (E.bh / Math.max(E.bw, 1e-9)), m = DOMMatrix.fromMatrix(r.m).translate(-r.box.w / 2, -r.box.h / 2), out = [];
  for (const [a, b] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
    const X = ctAdd(pin.c, ctAdd(ctSc(pin.x, a * hw), ctSc(pin.y, b * hh))), q = ctProject(sol, k, X, ideal); if (!q) return null;
    const s = m.transformPoint(new DOMPoint(q[0] * r.box.w / sol.size[0], q[1] * r.box.h / sol.size[1])); out.push([s.x, s.y]);
  }
  return out;
}
// ---- the project file: the analyses the trackers use (track positions as base64 floats)
function ctB64(a) { const b = new Uint8Array(a.buffer, a.byteOffset, a.byteLength); let s = ''; for (let i = 0; i < b.length; i += 32768) s += String.fromCharCode.apply(null, b.subarray(i, i + 32768)); return btoa(s); }
function ctUnB64(s) { const b = Uint8Array.from(atob(s), c => c.charCodeAt(0)); return new Float32Array(b.buffer, 0, b.length >> 2); }
function ctSave() {
  const out = { keys: {}, tracks: {}, solves: {} };
  for (const L of S.layers) for (const f of L.fx || []) {
    if (f.id !== 'cameratracker') continue;
    const k = CT.last[f.uid] || CT.saved[f.uid]; if (!k) continue;
    out.keys[f.uid] = { tk: k.tk, sk: k.sk };
    const t = CT.tracks.get(k.tk), s = CT.solves.get(k.sk);
    if (t) out.tracks[k.tk] = { ...t, pts: ctB64(t.pts) };
    if (s) out.solves[k.sk] = JSON.parse(JSON.stringify(s, (key, v) => key === 'R' ? undefined : v));
  }
  return Object.keys(out.keys).length ? out : undefined;
}
function ctLoad(d) {
  if (!d) return;
  for (const [k, t] of Object.entries(d.tracks || {})) if (!CT.tracks.has(k)) CT.tracks.set(k, { ...t, pts: ctUnB64(t.pts) });
  for (const [k, s] of Object.entries(d.solves || {})) if (!CT.solves.has(k)) CT.solves.set(k, s);
  Object.assign(CT.saved, d.keys || {});
}
