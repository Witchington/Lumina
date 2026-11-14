// ---- Round 29 helpers (Utility & Text): EffectCraft's utility.rs, utility2.rs, ocio/effects.rs + ocio/space.rs (Color
//      Profile Converter), ocio/program.rs + fx_lut.rs (colour programs for fx_lut.wgsl's fxl_point), textfx.rs + fx_text.rs
//      (Numbers, Timecode) and footage.rs (cineon_log_to_lin, in shaders/lumina_util.wgsl) ----
const UTIL_K = [['lumina_util', 'lu_point']], LUT_K = [['fx_color', 'fxl_point']];
const TEXT_K = [['fx_gen2', 'fg2_segs'], ['fx_gen2', 'fg2_text'], ['fx_text', 'ftx_text'], ['kernels', 'fill']];
// ocio/space.rs: 3 × 3 matrices (rows) in f64, primaries and whites (xy)
const cpMul = (A, B) => A.map(r => [0, 1, 2].map(j => r[0] * B[0][j] + r[1] * B[1][j] + r[2] * B[2][j]));
const cpInv = m => m3inv(m) || [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
const cpVec = (m, v) => m.map(r => r[0] * v[0] + r[1] * v[1] + r[2] * v[2]);
const CP_D65 = [.3127, .3290], CP_ACESW = [.32168, .33767];
const CP_PRIMS = { rec709: [[.640, .330], [.300, .600], [.150, .060]], rec2020: [[.708, .292], [.170, .797], [.131, .046]],
  p3: [[.680, .320], [.265, .690], [.150, .060]], ap0: [[.7347, .2653], [0, 1], [.0001, -.0770]], ap1: [[.713, .293], [.165, .830], [.128, .044]] };
// transfer functions as fx_lut.rs's tf_code: [code, gamma]
const CP_TF = { linear: [0, 0], srgb: [1, 0], g24: [2, 2.4] };
// ocio/effects.rs's PROFILES and profile(): [primaries, white, transfer, linear by default]. Lumina's working space is
// sRGB (not linear), so Project Working Space is sRGB
const CP_PROFILES = [['Project Working Space', 'rec709', CP_D65, 'srgb', false], ['sRGB IEC61966-2.1', 'rec709', CP_D65, 'srgb', false],
  ['HDTV (Rec. 709)', 'rec709', CP_D65, 'g24', false], ['Rec. 2020', 'rec2020', CP_D65, 'g24', false], ['Display P3', 'p3', CP_D65, 'srgb', false],
  ['ACEScg', 'ap1', CP_ACESW, 'linear', true], ['ACES2065-1', 'ap0', CP_ACESW, 'linear', true]];
// rgb_to_xyz: linear RGB → XYZ with the space's own white
function cpRgbXyz(prims, w) {
  const xyz = c => [c[0] / c[1], 1, (1 - c[0] - c[1]) / c[1]], P = prims.map(xyz), M = [0, 1, 2].map(r => P.map(p => p[r]));
  const s = cpVec(cpInv(M), xyz(w));
  return M.map(r => r.map((v, j) => v * s[j]));
}
// Bradford adaptation from white src to white dst
function cpBradford(src, dst) {
  if (src[0] === dst[0] && src[1] === dst[1]) return [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
  const MB = [[.8951, .2664, -.1614], [-.7502, 1.7135, .0367], [.0389, -.0685, 1.0296]], xyz = c => [c[0] / c[1], 1, (1 - c[0] - c[1]) / c[1]];
  const s = cpVec(MB, xyz(src)), d = cpVec(MB, xyz(dst));
  return cpMul(cpInv(MB), cpMul([[d[0] / s[0], 0, 0], [0, d[1] / s[1], 0], [0, 0, d[2] / s[2]]], MB));
}
// Space::to_ref: linear RGB → XYZ D65 (Bradford-adapted when adapt)
const cpToRef = (p, adapt) => { const m = cpRgbXyz(CP_PRIMS[p[1]], p[2]); return adapt ? cpMul(cpBradford(p[2], CP_D65), m) : m; };
// ocio/program.rs's Color Profile Converter program (Decode, Matrix, Gamut / Max0, Encode; empty when it changes nothing)
function cpProgram(q) {
  const ii = clamp(q('inputProfile'), 0, 6), oi = clamp(q('outputProfile'), 0, 6), inp = CP_PROFILES[ii], out = CP_PROFILES[oi], intent = q('intent');
  const inLin = q('linearizeIn') || inp[4] && ii === 0, outLin = q('linearizeOut') || out[4] && oi === 0;
  const dec = inLin ? 'linear' : inp[3], enc = outLin ? 'linear' : out[3];
  // Absolute Colorimetric keeps the source white (no adaptation); the others adapt
  const m = intent === 3 ? cpMul(cpInv(cpToRef(out, false)), cpToRef(inp, false)) : cpMul(cpInv(cpToRef(out, true)), cpToRef(inp, true));
  const ident = dec === enc && m.every((r, i) => r.every((v, j) => Math.abs(v - (i === j ? 1 : 0)) < 1e-9));
  if (ident) return null;
  const d = [];
  if (dec !== 'linear') d.push(1, ...CP_TF[dec]);
  d.push(3, ...m.flat());
  if (intent === 0) d.push(6, ...cpToRef(out, true)[1]);
  else if (intent === 2) d.push(7);
  if (enc !== 'linear') d.push(2, ...CP_TF[enc]);
  d.push(0);
  return d;
}
// Apply Color LUT's program for fxl_point: one LUT op (tetrahedral, forward), then the table as fx_lut.rs's push_lut lays
// it out (n1, n3, domain min, domain max, the 1D table, the lattice red fastest). Kept with the LUT once made
function lutProgram(l) {
  if (l._prog) return l._prog;
  const n1 = l.n1 || 0, n3 = l.N || 0, d1 = l.d1 || [], d3 = l.raw || l.data || [], P = new Float32Array(6 + 8 + n1 * 3 + n3 * n3 * n3 * 3);
  P.set([8, 6, 2, 0, -1, 0, n1, n3, ...(l.dmin || [0, 0, 0]), ...(l.dmax || [1, 1, 1])]);
  P.set(d1.length ? d1 : [], 14); P.set(d3.length ? d3 : [], 14 + n1 * 3);
  return (l._prog = P);
}
// textfx.rs's stroke-font layout: grid unit and stroke radius for a font size, advance and ink edge, line width
const txUnit = size => size * .7 / 6, txWeight = size => Math.max(size * .045, .35);
function txAdvance(c, prop) {
  if (c === ' ') return 3; if (!prop) return 5.6;
  let lo = Infinity, hi = -Infinity; for (const s of fxGlyph(c)) for (const q of s) { lo = Math.min(lo, q[0]); hi = Math.max(hi, q[0]); }
  return lo > hi ? 3 : hi - lo + 1.6;
}
const txInkLeft = (c, prop) => prop ? Math.min(Math.min(...fxGlyph(c).flat().map(q => q[0]), Infinity), 4) - .8 : .8;
function txLineWidth(text, size, tracking, prop) {
  const u = txUnit(size), cs = [...text]; if (!cs.length) return 0;
  return cs.reduce((a, c) => a + txAdvance(c, prop) * u, 0) + tracking * (cs.length - 1) - 1.6 * u;
}
// layout_line: the glyph polylines (frame pixels) of a line whose baseline starts at origin
function txLayout(text, origin, size, tracking, prop) {
  const u = txUnit(size), out = []; let x = origin[0];
  for (const c of text) {
    const left = txInkLeft(c, prop);
    for (const s of fxGlyph(c)) out.push(s.map(q => [x + (q[0] - left - .8) * u, origin[1] + (q[1] - 6) * u]));
    x += txAdvance(c, prop) * u + tracking;
  }
  return out;
}
// timecode(): HH:MM:SS:FF at a whole frame rate
function txTimecode(frames, fps) {
  const fr = Math.max(1, Math.round(fps)), f = Math.abs(frames), p = v => String(v).padStart(2, '0');
  const s = `${p(Math.floor(f / (fr * 3600)))}:${p(Math.floor(f / (fr * 60)) % 60)}:${p(Math.floor(f / fr) % 60)}:${p(f % fr)}`;
  return frames < 0 ? '-' + s : s;
}
// drop_frame(): the SMPTE drop-frame label at 30 or 60
function txDropFrame(frames, nominal) {
  const drop = nominal / 15, perMin = nominal * 60 - drop, per10 = perMin * 10 + drop, f = Math.max(0, frames), d = Math.floor(f / per10), m = f % per10;
  const adj = m > drop ? f + drop * 9 * d + drop * Math.floor((m - drop) / perMin) : f + drop * 9 * d, p = v => String(v).padStart(2, '0');
  return `${p(Math.floor(adj / (nominal * 3600)))};${p(Math.floor(adj / (nominal * 60)) % 60)};${p(Math.floor(adj / nominal) % 60)};${p(adj % nominal)}`;
}
const TX_MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const TX_DAYS = ['Saturday', 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
// date_from_days: the proleptic Gregorian date of a day count since 2000-01-01 (a Saturday), for any count (the calendar
// repeats every 400 years); the weekday Saturday-indexed
function txDate(days) {
  const cyc = Math.floor(days / 146097), rest = days - cyc * 146097, d = new Date(Date.UTC(2000, 0, 1) + rest * 864e5);
  return [d.getUTCFullYear() + cyc * 400, d.getUTCMonth() + 1, d.getUTCDate(), (d.getUTCDay() + 1) % 7];
}
// numbers_text: what Numbers shows (time in seconds into the layer)
function txNumbers(q, time, seed) {
  const kind = q('type'), dp = clamp(Math.round(q('decimals')), 0, 10), cur = q('currentTime');
  let v = q('value');
  if (q('random')) v = fxH(Math.floor(time * S.fps) >>> 0, 17, seed) * q('value');
  const t = cur ? time + v : v, p2 = n => String(n).padStart(2, '0');
  switch (kind) {
    case 1: { const s = Math.abs(v).toFixed(dp), [ip, fp] = s.split('.'); return (v < 0 ? '-' : '') + ip.padStart(5, '0') + (fp != null ? '.' + fp : ''); }
    case 2: case 3: case 4: { const fps = [30, 25, 24][kind - 2]; return txTimecode(Math.floor(t * fps + 1e-6), fps); }
    case 5: { const s = Math.floor(t), a = Math.abs(s); return (s < 0 ? '-' : '') + `${p2(Math.floor(a / 3600))}:${p2(Math.floor(a / 60) % 60)}:${p2(a % 60)}`; }
    case 6: case 7: case 8: {
      const [y, m, d, wd] = txDate(Math.floor(v));
      if (kind === 6) return `${p2(m)}/${p2(d)}/${p2(((y % 100) + 100) % 100)}`;
      if (kind === 7) return `${TX_MONTHS[m - 1].slice(0, 3)} ${d}, ${y}`;
      return `${TX_DAYS[wd]}, ${TX_MONTHS[m - 1]} ${d}, ${y}`;
    }
    case 9: { const i = Math.sign(v) * Math.round(Math.abs(v)); return i < 0 ? '-' + (-i).toString(16).toUpperCase() : i.toString(16).toUpperCase(); }
    default: return (cur ? t : v).toFixed(dp);
  }
}
// text_coverage on the graphics card (fg2_segs): the glyph strokes at radius r → fill (x); with a stroke of width sw the
// outer (y) and inner (z) edges of its ring
function txCoverage(E, img, polys, r, sw) {
  const it = fxItems(E, 10), pad = r + Math.max(0, sw) * .5 + 1, inner = r - sw * .5 > .05;
  for (const pl of polys) {
    const segs = pl.length === 1 ? [[pl[0], pl[0]]] : pl.slice(1).map((b, i) => [pl[i], b]);
    for (const [a, b] of segs) fxItemPush(it, [Math.min(a[0], b[0]) - pad, Math.min(a[1], b[1]) - pad, Math.max(a[0], b[0]) + pad, Math.max(a[1], b[1]) + pad], [a[0], a[1], b[0], b[1], r, 1]);
  }
  const D = fxItemData(it); if (!D) return { cov: E.clear(img), inner };
  const cov = E.run('fx_gen2', 'fg2_segs', fxP({ 0: [D.at, 10, it.tx, sw > 0 ? 3 : 1] }, { 0: [1, 0, .05, 1], 1: [1, sw * .5, .05, 1], 2: [1, -sw * .5, .05, 1] }), img, null, null, E.data(D.d));
  return { cov, inner };
}
