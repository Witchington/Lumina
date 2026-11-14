// ---- Round 30 helpers (Audio-driven): EffectCraft's generate3/audio.rs (the FFT, the audio window, the baseline, the
//      marks) and fx_gen2.rs's marks (fg2_segs coverage, a hard core and a soft halo, through fg2_marks) ----
const AUDIO_K = [['fx_gen2', 'fg2_segs'], ['fx_gen2', 'fg2_marks'], ['kernels', 'fill']];
const AU_RATE = 48000, AU = new Map();   // media id → { L, R } (48 kHz) once decoded, or { busy } while it is
// a media file's sound, decoded once at 48 kHz (left and right; mono files give the same channel twice)
function auDecode(mid) {
  const have = AU.get(mid); if (have) return have.busy || Promise.resolve(have);
  const m = MEDIA[mid]; if (!m?.url) return Promise.resolve(null);
  const busy = (async () => {
    try {
      const dec = await new OfflineAudioContext(2, 1, AU_RATE).decodeAudioData(await (await fetch(m.url)).arrayBuffer());
      const L = dec.getChannelData(0), R = dec.numberOfChannels > 1 ? dec.getChannelData(1) : L, e = { L, R };
      AU.set(mid, e); return e;
    } catch { const e = { L: new Float32Array(0), R: new Float32Array(0) }; AU.set(mid, e); return e; }
  })();
  AU.set(mid, { busy });
  busy.then(() => { if (!S.playing && !S.exporting) requestAnimationFrame(() => { if (!S.playing) render(); }); });
  return busy;
}
// the layers whose sound an audio effect can follow: footage with sound
const auLayers = L => S.layers.filter(M => M !== L && M.media && (M.kind === 'audio' || (M.kind === 'video' && !M.freeze)));
const auPick = (id, label) => ({ id, label, type: 'pick', def: 0, opts: L => [[0, 'None'], ...auLayers(L).map(M => [M.id, esc(M.name || M.kind)])] });
// every audio layer an audio effect follows decoded (export and the self-test wait on it)
async function auWarmAll() {
  const ids = new Set(); for (const L of S.layers) for (const f of L.fx || []) if (f.on !== false && FX[f.id]?.audio && f.audioLayer) ids.add(f.audioLayer);
  for (const id of ids) { const M = byId(id); if (M?.media) await auDecode(M.media); }
}
// audio_window: dur ms of the audio layer's sound centred on the composition time (+ offset ms), mono or one channel,
// at its volume; silence outside the layer. null when there is no audio layer or it is still decoding (the layer then
// passes through, and is drawn again once the sound is in)
function auWindow(E, id, durMs, offMs, ch) {
  const M = id ? byId(id) : null; if (!M?.media) return null;
  const pcm = AU.get(M.media); if (!pcm || pcm.busy) { auDecode(M.media); return null; }
  const dur = Math.max(.001, durMs / 1000), n = clamp(Math.floor(dur * AU_RATE), 16, 1 << 16), t0 = E.T + offMs / 1000 - dur * .5;
  const out = new Float64Array(n), [a, b] = liveRange(M), vol = val(M, 'volume', clamp(E.T, a, b));
  const { L: cl, R: cr } = pcm, len = cl.length, t1 = t0 + n / AU_RATE;
  // source time through the window: srcTime at its two ends, in between in a straight line (a few ms)
  const s0 = srcTime(M, clamp(t0, a, b)), s1 = srcTime(M, clamp(t1, a, b));
  for (let i = 0; i < n; i++) {
    const t = t0 + i / AU_RATE; if (t < a || t >= b) continue;
    const s = s0 + (s1 - s0) * (t - Math.max(t0, a)) / Math.max(1e-9, Math.min(t1, b) - Math.max(t0, a)), k = Math.floor(s * AU_RATE);
    if (k < 0 || k >= len) continue;
    out[i] = vol * (ch === 1 ? cl[k] : ch === 2 ? cr[k] : (cl[k] + cr[k]) * .5);
  }
  return out;
}
// fft: in-place iterative radix-2 (re, im lengths a power of two)
function auFFT(re, im) {
  const n = re.length; if (n < 2) return;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1; while (j & bit) { j ^= bit; bit >>= 1; } j |= bit;
    if (i < j) { let t = re[i]; re[i] = re[j]; re[j] = t; t = im[i]; im[i] = im[j]; im[j] = t; }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = -2 * Math.PI / len, ws = Math.sin(ang), wc = Math.cos(ang), h = len >> 1;
    for (let st = 0; st < n; st += len) {
      let cr = 1, ci = 0;
      for (let k = 0; k < h; k++) {
        const a = st + k, b = a + h, tr = re[b] * cr - im[b] * ci, ti = re[b] * ci + im[b] * cr;
        re[b] = re[a] - tr; im[b] = im[a] - ti; re[a] += tr; im[a] += ti;
        const ncr = cr * wc - ci * ws; ci = cr * ws + ci * wc; cr = ncr;
      }
    }
  }
}
// compute_fft_mags: Hann window, zero-padded to a power of two (64 at least), magnitudes × 4 / samples
function auMags(x) {
  const m = x.length; let n = 64; while (n < m) n <<= 1;
  const re = new Float64Array(n), im = new Float64Array(n), den = Math.max(m, 2) - 1;
  for (let i = 0; i < m; i++) re[i] = x[i] * (.5 - .5 * Math.cos(2 * Math.PI * i / den));
  auFFT(re, im);
  const sc = 4 / Math.max(m, 1), bins = n / 2 + 1, mags = new Float64Array(bins);
  for (let k = 0; k < bins; k++) mags[k] = Math.hypot(re[k], im[k]) * sc;
  return { hz: AU_RATE / n, mags };
}
// the drawing baseline (Baseline): the layer's mask, or the line from Start Point to End Point, or with Use Polar Path a
// circle round Start Point (half the distance to End Point); .at(u) → [point, unit normal] in frame pixels
function auBaseline(E, q) {
  const polar = q('polar'), M = q('path') === 1 && !polar ? fxMaskPoly(E) : null;
  const pts = M && M.pts.length > 1 ? M.pts : [q('startPoint'), q('endPoint')], closed = !!(M && M.pts.length > 1);
  const n = pts.length, c = fxPolyCum(pts, closed), len = c[c.length - 1] || 0, ctr = pts[0], rad = n > 1 ? fxSegLen(pts[0], pts[1]) : 1;
  return {
    at(u) {
      if (polar) { const a = u * 2 * Math.PI - Math.PI * .5, co = Math.cos(a), si = Math.sin(a); return [[ctr[0] + co * rad * .5, ctr[1] + si * rad * .5], [co, si]]; }
      // util::poly_point_at: the point at distance u · len, and its segment's direction (normal = (d.y, −d.x))
      const s = Math.max(0, u * len); let lo = 0, hi = c.length - 2;
      while (lo < hi) { const mid = (lo + hi) >> 1; if (c[mid + 1] >= s) hi = mid; else lo = mid + 1; }
      const a = pts[lo], b = pts[(lo + 1) % n], l = c[lo + 1] - c[lo], t = l > 0 ? Math.min(1, (s - c[lo]) / l) : 0;
      const d = l > 0 ? [(b[0] - a[0]) / l, (b[1] - a[1]) / l] : [1, 0];
      return [[a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t], [d[1], -d[0]]];
    } };
}
// draw_marks: segments [ax, ay, bx, by, r, v] as a hard core in the Inside colour and a soft halo (Softness) fading to
// the Outside colour, over the layer (Composite on original) or alone
function auMarks(E, img, q, segs, thick, soft) {
  const comp = q('onOriginal'), halo = soft > 0 ? thick * soft + .5 : 0, it = fxItems(E, 10);
  for (const s of segs) { const p = s[4] + halo + 1; fxItemPush(it, [Math.min(s[0], s[2]) - p, Math.min(s[1], s[3]) - p, Math.max(s[0], s[2]) + p, Math.max(s[1], s[3]) + p], s); }
  const D = fxItemData(it); if (!D) return comp ? img : E.clear(img);
  const core = [1, 0, -3e38, 1], cov = E.run('fx_gen2', 'fg2_segs', fxP({ 0: [D.at, 10, it.tx, 2] }, { 0: core, 1: soft > 0 ? [1, halo, -3e38, 0] : core }), img, null, null, E.data(D.d));
  return E.run('fx_gen2', 'fg2_marks', fxP({ 0: [comp ? 1 : 0, 0, 0, 0] }, { 0: [...q('insideColor'), 1], 1: [...q('outsideColor'), 1] }), img, cov);
}
// the settings both effects share (registry.rs's order)
const AU_HEAD = [
  auPick('audioLayer', 'Audio layer'),
  { id: 'startPoint', label: 'Start point', type: 'pt', def: [.1, .5] },
  { id: 'endPoint', label: 'End point', type: 'pt', def: [.9, .5] },
  { id: 'path', label: 'Path', type: 'pick', def: 0, opts: [[0, 'None'], [1, 'Mask']] },
  { id: 'polar', label: 'Use polar path', type: 'check', def: false }];
const AU_DISPLAY = [[0, 'Digital'], [1, 'Analog lines'], [2, 'Analog dots']];
