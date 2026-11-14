// Lumina's 3D Camera Tracker engine (EffectCraft Round 32), a Web Worker so Lumina stays usable while it runs.
// Ported from EffectCraft (github.com/storytold/effectcraft, MIT): crates/track/src/klt.rs (Shi–Tomasi corners,
// pyramidal Lucas–Kanade with a forward–backward check), camtrack/features.rs (long feature tracks through the clip),
// camtrack/linalg.rs, geometry.rs (8-point essential matrix in RANSAC, homography decomposition, triangulation),
// bundle.rs (sparse Levenberg–Marquardt bundle adjustment with the Schur complement over the points, Huber loss),
// solver.rs (keyframes, two-view start, incremental resection and triangulation, focal length search, tripod pans,
// lens distortion), fit.rs (robust homography) and camtrack.rs (the solve's types). Rayon's parallel loops run in
// order here. Camera space is x right, y down, z forward; a camera is (R, C, f) with X_cam = R (X − C) and
// pixel u = f x / z + w / 2.
'use strict';

// ================================================================ small linear algebra (linalg.rs)
const I3 = () => [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const scale = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = a => Math.sqrt(dot(a, a));
const normalize = a => { const n = norm(a); return n > 0 ? scale(a, 1 / n) : a; };
const mv = (m, v) => [dot(m[0], v), dot(m[1], v), dot(m[2], v)];
const mtv = (m, v) => [m[0][0] * v[0] + m[1][0] * v[1] + m[2][0] * v[2], m[0][1] * v[0] + m[1][1] * v[1] + m[2][1] * v[2], m[0][2] * v[0] + m[1][2] * v[1] + m[2][2] * v[2]];
function mm(a, b) {
  const o = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) o[i][j] = a[i][0] * b[0][j] + a[i][1] * b[1][j] + a[i][2] * b[2][j];
  return o;
}
const mt = a => [[a[0][0], a[1][0], a[2][0]], [a[0][1], a[1][1], a[2][1]], [a[0][2], a[1][2], a[2][2]]];
const madd = (a, b, k) => a.map((r, i) => r.map((v, j) => v + k * b[i][j]));
const mscale = (a, k) => a.map(r => r.map(v => v * k));
const det3 = m => m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1]) - m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0]) + m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0]);
const skew = v => [[0, -v[2], v[1]], [v[2], 0, -v[0]], [-v[1], v[0], 0]];
const outer = (a, b) => [[a[0] * b[0], a[0] * b[1], a[0] * b[2]], [a[1] * b[0], a[1] * b[1], a[1] * b[2]], [a[2] * b[0], a[2] * b[1], a[2] * b[2]]];
const col = (m, j) => [m[0][j], m[1][j], m[2][j]];
const fromCols = (a, b, c) => [[a[0], b[0], c[0]], [a[1], b[1], c[1]], [a[2], b[2], c[2]]];
function inv3(m) {
  const d = det3(m); if (Math.abs(d) < 1e-300) return null;
  const c = (r0, c0, r1, c1) => m[r0][c0] * m[r1][c1] - m[r0][c1] * m[r1][c0];
  return mscale([[c(1, 1, 2, 2), -c(0, 1, 2, 2), c(0, 1, 1, 2)], [-c(1, 0, 2, 2), c(0, 0, 2, 2), -c(0, 0, 1, 2)], [c(1, 0, 2, 1), -c(0, 0, 2, 1), c(0, 0, 1, 1)]], 1 / d);
}
// Rodrigues' formula and its inverse
function rodrigues(w) {
  const th = norm(w), k = skew(w);
  if (th < 1e-12) return madd(I3(), k, 1);
  return madd(madd(I3(), k, Math.sin(th) / th), mm(k, k), (1 - Math.cos(th)) / (th * th));
}
function logRot(r) {
  const c = Math.min(1, Math.max(-1, (r[0][0] + r[1][1] + r[2][2] - 1) * 0.5)), th = Math.acos(c);
  const v = [r[2][1] - r[1][2], r[0][2] - r[2][0], r[1][0] - r[0][1]];
  if (th < 1e-9) return scale(v, 0.5);
  if (Math.PI - th < 1e-6) {
    const b = madd(r, I3(), 1); let j = 0; for (let i = 1; i < 3; i++) if (b[i][i] > b[j][j]) j = i;
    return scale(normalize(col(b, j)), th);
  }
  return scale(v, th / (2 * Math.sin(th)));
}
function nearestRotation(m) {
  const [u, , v] = svd3(m); let r = mm(u, mt(v));
  if (det3(r) < 0) { const u2 = u.map(row => [row[0], row[1], -row[2]]); r = mm(u2, mt(v)); }
  return r;
}
const slerp = (a, b, t) => mm(rodrigues(scale(logRot(mm(b, mt(a))), t)), a);
// one-sided Jacobi SVD (unnormalised, unsorted factors)
function jacobiFactors(a, m, n) {
  const rows = Math.max(m, n), u = new Float64Array(rows * n), v = new Float64Array(n * n);
  for (let i = 0; i < m * n; i++) u[i] = a[i];
  for (let i = 0; i < n; i++) v[i * n + i] = 1;
  for (let sweep = 0; sweep < 60; sweep++) {
    let off = 0;
    for (let p = 0; p < n; p++) for (let q = p + 1; q < n; q++) {
      let alpha = 0, beta = 0, gamma = 0;
      for (let r = 0; r < rows; r++) { const x = u[r * n + p], y = u[r * n + q]; alpha += x * x; beta += y * y; gamma += x * y; }
      if (gamma === 0) continue;
      const c0 = Math.abs(gamma) / Math.max(Math.sqrt(alpha * beta), 1e-300); off = Math.max(off, c0);
      if (c0 < 1e-15) continue;
      const zeta = (beta - alpha) / (2 * gamma), t = zeta === 0 ? 1 : Math.sign(zeta) / (Math.abs(zeta) + Math.sqrt(1 + zeta * zeta));
      const c = 1 / Math.sqrt(1 + t * t), s = c * t;
      for (let r = 0; r < rows; r++) { const x = u[r * n + p], y = u[r * n + q]; u[r * n + p] = c * x - s * y; u[r * n + q] = s * x + c * y; }
      for (let r = 0; r < n; r++) { const x = v[r * n + p], y = v[r * n + q]; v[r * n + p] = c * x - s * y; v[r * n + q] = s * x + c * y; }
    }
    if (off < 1e-15) break;
  }
  const s = new Float64Array(n);
  for (let j = 0; j < n; j++) { let t = 0; for (let r = 0; r < rows; r++) t += u[r * n + j] * u[r * n + j]; s[j] = Math.sqrt(t); }
  return [u, s, v];
}
// thin SVD A = U diag(s) Vᵀ, s descending
function svd(a, m, n) {
  const rows = Math.max(m, n), [u, s, v] = jacobiFactors(a, m, n);
  for (let j = 0; j < n; j++) if (s[j] > 1e-300) for (let r = 0; r < rows; r++) u[r * n + j] /= s[j];
  const order = [...Array(n).keys()].sort((a, b) => s[b] - s[a]);
  const u2 = new Float64Array(rows * n), v2 = new Float64Array(n * n), s2 = new Float64Array(n);
  order.forEach((j, k) => { for (let r = 0; r < rows; r++) u2[r * n + k] = u[r * n + j]; for (let r = 0; r < n; r++) v2[r * n + k] = v[r * n + j]; s2[k] = s[j]; });
  return [u2, s2, v2];
}
function svd3(m) {
  const [u, s, v] = svd([...m[0], ...m[1], ...m[2]], 3, 3), g = x => [[x[0], x[1], x[2]], [x[3], x[4], x[5]], [x[6], x[7], x[8]]];
  const um = g(u);
  if (s[2] < 1e-300) { const c = cross(col(um, 0), col(um, 1)); for (let r = 0; r < 3; r++) um[r][2] = c[r]; }
  return [um, [s[0], s[1], s[2]], g(v)];
}
// the unit x minimising |A x| (the right singular vector of the smallest singular value; ties: the last)
function nullVector(a, m, n) {
  const [, s, v] = jacobiFactors(a, m, n); let k = 0;
  for (let i = 1; i < n; i++) if (s[i] <= s[k]) k = i;
  const o = new Array(n); for (let r = 0; r < n; r++) o[r] = v[r * n + k]; return o;
}
// cyclic Jacobi eigen-decomposition: eigenvalues ascending, eigenvectors as the columns of a row-major n × n
function symEigen(a0, n) {
  const a = Float64Array.from(a0), v = new Float64Array(n * n);
  for (let i = 0; i < n; i++) v[i * n + i] = 1;
  for (let it = 0; it < 100; it++) {
    let off = 0; for (let p = 0; p < n; p++) for (let q = p + 1; q < n; q++) off += a[p * n + q] * a[p * n + q];
    if (off < 1e-30) break;
    for (let p = 0; p < n; p++) for (let q = p + 1; q < n; q++) {
      const apq = a[p * n + q]; if (Math.abs(apq) < 1e-300) continue;
      const theta = (a[q * n + q] - a[p * n + p]) / (2 * apq), t = theta === 0 ? 1 : Math.sign(theta) / (Math.abs(theta) + Math.sqrt(theta * theta + 1));
      const c = 1 / Math.sqrt(t * t + 1), s = t * c;
      for (let k = 0; k < n; k++) { const akp = a[k * n + p], akq = a[k * n + q]; a[k * n + p] = c * akp - s * akq; a[k * n + q] = s * akp + c * akq; }
      for (let k = 0; k < n; k++) { const apk = a[p * n + k], aqk = a[q * n + k]; a[p * n + k] = c * apk - s * aqk; a[q * n + k] = s * apk + c * aqk; }
      for (let k = 0; k < n; k++) { const vkp = v[k * n + p], vkq = v[k * n + q]; v[k * n + p] = c * vkp - s * vkq; v[k * n + q] = s * vkp + c * vkq; }
    }
  }
  const order = [...Array(n).keys()].sort((x, y) => a[x * n + x] - a[y * n + y]), vals = order.map(j => a[j * n + j]), vecs = new Float64Array(n * n);
  order.forEach((j, k) => { for (let r = 0; r < n; r++) vecs[r * n + k] = v[r * n + j]; });
  return [vals, vecs];
}
// A x = b for a symmetric positive definite A (n × n, row-major) in place, by (banded) Cholesky
function cholSolve(a, n, b) {
  let band = Math.max(0, n - 1);
  if (b.every(Number.isFinite)) {
    band = 0;
    outer: for (let i = n - 1; i >= 0; i--) for (let j = 0; j < Math.max(0, i - band); j++) if (a[i * n + j] !== 0) {
      band = i - j; if (band >= Math.floor(n / 2)) { band = Math.max(0, n - 1); break outer; } break;
    }
  }
  for (let j = 0; j < n; j++) {
    let d = a[j * n + j];
    for (let k = Math.max(0, j - band); k < j; k++) d -= a[j * n + k] * a[j * n + k];
    if (!(d > 0) || !Number.isFinite(d)) return false;
    d = Math.sqrt(d); a[j * n + j] = d;
    for (let i = j + 1; i < Math.min(n, j + 1 + band); i++) {
      let s = a[i * n + j]; const s0 = Math.max(0, i - band);
      for (let k = s0; k < j; k++) s -= a[i * n + k] * a[j * n + k];
      a[i * n + j] = s / d;
    }
  }
  for (let i = 0; i < n; i++) { let s = b[i]; for (let k = Math.max(0, i - band); k < i; k++) s -= a[i * n + k] * b[k]; b[i] = s / a[i * n + i]; }
  for (let i = n - 1; i >= 0; i--) { let s = b[i]; const e = Math.min(n, i + band + 1); for (let k = i + 1; k < e; k++) s -= a[k * n + i] * b[k]; b[i] = s / a[i * n + i]; }
  for (let i = 0; i < n; i++) if (!Number.isFinite(b[i])) return false;
  return true;
}
// Euler angles (degrees) [x, y, z] with m = Rz Ry Rx (After Effects' Orientation order), for a camera kept for later
function eulerXYZ(m) {
  const sy = Math.min(1, Math.max(-1, -m[2][0])), y = Math.asin(sy);
  const [x, z] = Math.abs(sy) < 0.999999 ? [Math.atan2(m[2][1], m[2][2]), Math.atan2(m[1][0], m[0][0])] : [Math.atan2(-m[1][2], m[1][1]), 0];
  const d = 180 / Math.PI; return [x * d, y * d, z * d];
}

// ================================================================ a deterministic generator (xorshift, 32 bits)
class Rng {
  constructor(seed) { this.s = (seed ^ 0x9e3779b9) >>> 0 || 1; }
  next() { let x = this.s; x ^= x << 13; x >>>= 0; x ^= x >>> 17; x ^= x << 5; x >>>= 0; return (this.s = x); }
  below(n) { return this.next() % Math.max(1, n); }
  sample(n, k, out) { out.length = 0; let guard = 0; while (out.length < k && guard++ < 1000) { const c = this.below(n); if (!out.includes(c)) out.push(c); } return out; }
}

// ================================================================ luma pyramids and KLT (klt.rs, plane.rs)
const plane = (w, h) => ({ w, h, d: new Float32Array(w * h) });
const pAt = (p, x, y) => p.d[(y < 0 ? 0 : y >= p.h ? p.h - 1 : y) * p.w + (x < 0 ? 0 : x >= p.w ? p.w - 1 : x)];
function downsample(p) {
  const w = Math.max(1, Math.ceil(p.w / 2)), h = Math.max(1, Math.ceil(p.h / 2)), o = plane(w, h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) o.d[y * w + x] = (pAt(p, 2 * x, 2 * y) + pAt(p, 2 * x + 1, 2 * y) + pAt(p, 2 * x, 2 * y + 1) + pAt(p, 2 * x + 1, 2 * y + 1)) * 0.25;
  return o;
}
function gradients(p) {
  const gx = plane(p.w, p.h), gy = plane(p.w, p.h), { w, h, d } = p;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x;
    if (x > 0 && y > 0 && x + 1 < w && y + 1 < h) { gx.d[i] = 0.5 * (d[i + 1] - d[i - 1]); gy.d[i] = 0.5 * (d[i + w] - d[i - w]); }
    else { gx.d[i] = 0.5 * (pAt(p, x + 1, y) - pAt(p, x - 1, y)); gy.d[i] = 0.5 * (pAt(p, x, y + 1) - pAt(p, x, y - 1)); }
  }
  return [gx, gy];
}
// luma of 8-bit RGBA averaged over factor × factor blocks (0..1)
function lumaPlane(img, f) {
  const w = Math.max(1, Math.ceil(img.w / f)), h = Math.max(1, Math.ceil(img.h / f)), p = plane(w, h), s = img.d;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let t = 0, n = 0;
    for (let yy = y * f; yy < Math.min((y + 1) * f, img.h); yy++) for (let xx = x * f; xx < Math.min((x + 1) * f, img.w); xx++) {
      const i = (yy * img.w + xx) * 4; t += 0.2126 * s[i] + 0.7152 * s[i + 1] + 0.0722 * s[i + 2]; n++;
    }
    p.d[y * w + x] = n ? t / n / 255 : 0;
  }
  return p;
}
// unit: layer pixels per level-0 pixel (the analysis factor over the grid scale)
function pyramid(base, unit, levels) {
  const lv = [base];
  for (let i = 0; i < levels; i++) { const last = lv[lv.length - 1]; if (last.w < 16 || last.h < 16) break; lv.push(downsample(last)); }
  return { levels: lv, grads: lv.map(gradients), unit };
}
const analysisFactor = (w, h, maxSide) => Math.max(1, Math.ceil(Math.max(w, h, 1) / Math.max(maxSide, 16)));
// Shi–Tomasi score (smaller eigenvalue of the structure tensor over a (2r+1)² window)
function cornerScores(p, gx, gy, r) {
  const { w, h } = p, W1 = w + 1, sxx = new Float64Array(W1 * (h + 1)), sxy = new Float64Array(W1 * (h + 1)), syy = new Float64Array(W1 * (h + 1));
  for (let y = 0; y < h; y++) {
    let axx = 0, axy = 0, ayy = 0;
    for (let x = 0; x < w; x++) {
      const i = y * w + x, dx = gx.d[i], dy = gy.d[i]; axx += dx * dx; axy += dx * dy; ayy += dy * dy;
      const o = (y + 1) * W1 + x + 1, up = y * W1 + x + 1; sxx[o] = sxx[up] + axx; sxy[o] = sxy[up] + axy; syy[o] = syy[up] + ayy;
    }
  }
  const out = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    const y0 = Math.max(0, y - r), y1 = Math.min(h, y + r + 1);
    for (let x = 0; x < w; x++) {
      const x0 = Math.max(0, x - r), x1 = Math.min(w, x + r + 1);
      const bs = s => s[y1 * W1 + x1] - s[y0 * W1 + x1] - s[y1 * W1 + x0] + s[y0 * W1 + x0];
      const a = bs(sxx), b = bs(sxy), c = bs(syy), tr = 0.5 * (a + c), dd = Math.sqrt(0.25 * (a - c) * (a - c) + b * b);
      out[y * w + x] = Math.max(0, tr - dd);
    }
  }
  return out;
}
// good features to track in level 0 (level-0 coordinates, pixel centres), strongest first
function goodFeatures(pyr, o, inside) {
  const p = pyr.levels[0], [gx, gy] = pyr.grads[0], score = cornerScores(p, gx, gy, Math.max(1, o.window)), { w, h } = p;
  const b = Math.min(o.border, Math.floor(w / 4), Math.floor(h / 4)), cands = []; let best = 0;
  for (let y = b; y < h - b; y++) for (let x = b; x < w - b; x++) {
    const v = score[y * w + x]; if (v <= 1e-9) continue;
    let isMax = true;
    n: for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dy) continue;
      const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
      const q = score[yy * w + xx]; if (q > v || (q === v && (dy < 0 || (dy === 0 && dx < 0)))) { isMax = false; break n; }
    }
    if (!isMax) continue;
    if (inside && !inside(x + 0.5, y + 0.5)) continue;
    best = Math.max(best, v); cands.push([v, x, y]);
  }
  const thr = best * o.quality, keep = cands.filter(c => c[0] >= thr).sort((a, b) => b[0] - a[0] || a[2] - b[2] || a[1] - b[1]);
  const md = Math.max(1, o.minDistance), cell = md, gw = Math.ceil(w / cell) + 1, gh = Math.ceil(h / cell) + 1, grid = Array.from({ length: gw * gh }, () => []), out = [];
  for (const [, x, y] of keep) {
    const cx0 = x + 0.5, cy0 = y + 0.5, cx = Math.floor(cx0 / cell), cy = Math.floor(cy0 / cell); let ok = true;
    g: for (let yy = Math.max(0, cy - 1); yy <= Math.min(gh - 1, cy + 1); yy++) for (let xx = Math.max(0, cx - 1); xx <= Math.min(gw - 1, cx + 1); xx++)
      for (const q of grid[yy * gw + xx]) if ((q[0] - cx0) ** 2 + (q[1] - cy0) ** 2 < md * md) { ok = false; break g; }
    if (ok) { grid[cy * gw + cx].push([cx0, cy0]); out.push([cx0, cy0]); if (out.length >= o.maxFeatures) break; }
  }
  return out;
}
// the bilinear taps shared by a (2r+1)² window centred at c (edges repeated)
const TAP = { xs0: new Int32Array(64), xs1: new Int32Array(64), ys0: new Int32Array(64), ys1: new Int32Array(64), tx: 0, ty: 0 };
function taps(p, cx, cy, r) {
  const fx = cx - 0.5, fy = cy - 0.5, x0 = Math.floor(fx), y0 = Math.floor(fy), wm = p.w - 1, hm = p.h - 1;
  TAP.tx = fx - x0; TAP.ty = fy - y0;
  for (let d = -r, k = 0; d <= r; d++, k++) {
    TAP.xs0[k] = Math.min(Math.max(x0 + d, 0), wm); TAP.xs1[k] = Math.min(Math.max(x0 + d + 1, 0), wm);
    TAP.ys0[k] = Math.min(Math.max(y0 + d, 0), hm) * p.w; TAP.ys1[k] = Math.min(Math.max(y0 + d + 1, 0), hm) * p.w;
  }
}
const WIN = { v: new Float64Array(4096), gx: new Float64Array(4096), gy: new Float64Array(4096) };
function lkPoint(A, B, px, py, gux, guy, o) {
  const top = Math.min(A.levels.length, B.levels.length) - 1; if (top < 0) return null;
  const r = o.radius, side = 2 * r + 1, n = side * side, s0 = 1 << top;
  let g0 = gux / s0, g1 = guy / s0;
  const win = WIN.v, wgx = WIN.gx, wgy = WIN.gy;
  for (let l = top; l >= 0; l--) {
    const s = 1 << l, ia = A.levels[l], ib = B.levels[l], gx = A.grads[l][0], gy = A.grads[l][1], c0 = px / s, c1 = py / s;
    if (c0 < -1 || c1 < -1 || c0 > ia.w + 1 || c1 > ia.h + 1) return null;
    let gxx = 0, gxy = 0, gyy = 0, k = 0;
    taps(ia, c0, c1, r);
    const tx = TAP.tx, ty = TAP.ty;
    for (let j = 0; j < side; j++) {
      const y0 = TAP.ys0[j], y1 = TAP.ys1[j];
      for (let i = 0; i < side; i++) {
        const x0 = TAP.xs0[i], x1 = TAP.xs1[i];
        const bl = d => { const a = d[y0 + x0], b = d[y0 + x1], c = d[y1 + x0], e = d[y1 + x1], t = a + (b - a) * tx, bo = c + (e - c) * tx; return t + (bo - t) * ty; };
        win[k] = bl(ia.d); const ix = wgx[k] = bl(gx.d), iy = wgy[k] = bl(gy.d);
        gxx += ix * ix; gxy += ix * iy; gyy += iy * iy; k++;
      }
    }
    const det = gxx * gyy - gxy * gxy, tr = 0.5 * (gxx + gyy), mineig = (tr - Math.sqrt(0.25 * (gxx - gyy) ** 2 + gxy * gxy)) / n;
    if (mineig < o.minEigen || Math.abs(det) < 1e-18) return null;
    let v0 = 0, v1 = 0;
    for (let it = 0; it < o.iterations; it++) {
      let bx = 0, by = 0; k = 0;
      taps(ib, c0 + g0 + v0, c1 + g1 + v1, r);
      const tx2 = TAP.tx, ty2 = TAP.ty, d = ib.d;
      for (let j = 0; j < side; j++) {
        const y0 = TAP.ys0[j], y1 = TAP.ys1[j];
        for (let i = 0; i < side; i++) {
          const x0 = TAP.xs0[i], x1 = TAP.xs1[i], a = d[y0 + x0], b = d[y0 + x1], c = d[y1 + x0], e = d[y1 + x1], t = a + (b - a) * tx2, bo = c + (e - c) * tx2;
          const diff = win[k] - (t + (bo - t) * ty2); bx += diff * wgx[k]; by += diff * wgy[k]; k++;
        }
      }
      const nx = (gyy * bx - gxy * by) / det, ny = (gxx * by - gxy * bx) / det;
      v0 += nx; v1 += ny;
      if (!Number.isFinite(v0) || !Number.isFinite(v1)) return null;
      if (nx * nx + ny * ny < o.epsilon * o.epsilon) break;
    }
    if (l > 0) { g0 = 2 * (g0 + v0); g1 = 2 * (g1 + v1); } else { g0 += v0; g1 += v1; }
  }
  const qx = px + g0, qy = py + g1, l0 = B.levels[0];
  if (qx < 0 || qy < 0 || qx > l0.w || qy > l0.h) return null;
  return [qx, qy];
}
// track level-0 points from pyramid a to b; null for the lost ones (forward–backward check)
function track(a, b, pts, o) {
  return pts.map(p => {
    const q = lkPoint(a, b, p[0], p[1], 0, 0, o); if (!q) return null;
    if (o.fbMax > 0) {
      const back = lkPoint(b, a, q[0], q[1], p[0] - q[0], p[1] - q[1], o);
      if (!back || (back[0] - p[0]) ** 2 + (back[1] - p[1]) ** 2 > o.fbMax * o.fbMax) return null;
    }
    return q;
  });
}

// ================================================================ step 1: long feature tracks (features.rs)
class TrackAnalyzer {
  // size: the layer size (pixels); gs: grid pixels a layer pixel (the frames come on the layer's grid)
  constructor(size, gs, detailed) { Object.assign(this, { size, gs, detailed, prev: null, active: [], tracks: [], frame: 0, unit: 1 }); }
  params() { return this.detailed ? [1280, 900] : [720, 500]; }
  push(img) {
    const [maxSide, want] = this.params(), f = analysisFactor(img.w, img.h, maxSide), pyr = pyramid(lumaPlane(img, f), f / this.gs, 4), k = this.frame, prev = this.prev;
    this.unit = pyr.unit;
    if (prev && prev.levels[0].w === pyr.levels[0].w && prev.levels[0].h === pyr.levels[0].h) {
      const q = track(prev, pyr, this.active.map(a => a[1]), { radius: 6, iterations: 30, epsilon: 0.005, fbMax: 0.5, minEigen: 1e-5 }), next = [];
      this.active.forEach(([ti], i) => { const p = q[i]; if (p) { this.tracks[ti].pts.push(p[0] * pyr.unit, p[1] * pyr.unit); next.push([ti, p]); } });
      this.active = next;
    } else this.active = [];
    // re-detect where there are no features
    if (this.active.length < want * 0.85) {
      const W0 = pyr.levels[0].w, H0 = pyr.levels[0].h, md = Math.min(40, Math.max(5, Math.max(W0, H0) / Math.sqrt(want) * 0.6)), cell = md;
      const gw = Math.ceil(W0 / cell) + 1, gh = Math.ceil(H0 / cell) + 1, occ = new Uint8Array(gw * gh);
      for (const [, p] of this.active) {
        const cx = Math.floor(p[0] / cell), cy = Math.floor(p[1] / cell);
        for (let yy = Math.max(0, cy - 1); yy <= Math.min(gh - 1, cy + 1); yy++) for (let xx = Math.max(0, cx - 1); xx <= Math.min(gw - 1, cx + 1); xx++) occ[yy * gw + xx] = 1;
      }
      const free = (x, y) => { const i = Math.floor(y / cell) * gw + Math.floor(x / cell); return i < occ.length && !occ[i]; };
      for (const p of goodFeatures(pyr, { maxFeatures: want - Math.min(want, this.active.length), minDistance: md, quality: 0.001, window: 2, border: 8 }, free)) {
        const id = this.tracks.length; this.tracks.push({ id, start: k, pts: [p[0] * pyr.unit, p[1] * pyr.unit] }); this.active.push([id, p]);
      }
    }
    this.prev = pyr; this.frame++;
    return this.active.length;
  }
  // tracks of at least three frames, renumbered, rounded to 1/100 pixel: { tracks: [{ id, start, n }], pts: Float32Array }
  finish(start, fd) {
    const keep = this.tracks.filter(t => t.pts.length >= 6), n = keep.reduce((s, t) => s + t.pts.length, 0), pts = new Float32Array(n), list = [];
    let o = 0;
    keep.forEach((t, i) => { list.push({ id: i, start: t.start, n: t.pts.length / 2, o }); for (const v of t.pts) pts[o++] = Math.round(v * 100) / 100; });
    return { version: 1, size: this.size, start, fd, frames: this.frame, factor: this.unit, detailed: this.detailed, tracks: list, pts };
  }
}

// ================================================================ two- and multi-view geometry (geometry.rs)
function normalizer(p) {
  const n = Math.max(1, p.length); let cx = 0, cy = 0; for (const q of p) { cx += q[0]; cy += q[1]; } cx /= n; cy /= n;
  let d = 0; for (const q of p) d += Math.hypot(q[0] - cx, q[1] - cy); d /= n;
  const s = d > 1e-12 ? Math.SQRT2 / d : 1;
  return [[s, 0, -s * cx], [0, s, -s * cy], [0, 0, 1]];
}
const h2 = (m, p) => mv(m, [p[0], p[1], 1]);
function essential8pt(x1, x2) {
  const n = Math.min(x1.length, x2.length); if (n < 8) return null;
  const t1 = normalizer(x1.slice(0, n)), t2 = normalizer(x2.slice(0, n)), a = new Float64Array(n * 9);
  for (let i = 0; i < n; i++) { const p = h2(t1, x1[i]), q = h2(t2, x2[i]); a.set([q[0] * p[0], q[0] * p[1], q[0], q[1] * p[0], q[1] * p[1], q[1], p[0], p[1], 1], i * 9); }
  const e = nullVector(a, n, 9), en = [[e[0], e[1], e[2]], [e[3], e[4], e[5]], [e[6], e[7], e[8]]];
  const E = mm(mt(t2), mm(en, t1)), [u, s, v] = svd3(E), m = (s[0] + s[1]) * 0.5;
  if (!(m > 0) || !Number.isFinite(m)) return null;
  return mm(u, mm([[1, 0, 0], [0, 1, 0], [0, 0, 0]], mt(v)));
}
function sampson2(e, p, q) {
  const x1 = [p[0], p[1], 1], x2 = [q[0], q[1], 1], ex1 = mv(e, x1), etx2 = mtv(e, x2), num = dot(x2, ex1);
  const den = ex1[0] * ex1[0] + ex1[1] * ex1[1] + etx2[0] * etx2[0] + etx2[1] * etx2[1];
  return den < 1e-300 ? Infinity : num * num / den;
}
function ransacEssential(x1, x2, thr, iterations, seed) {
  const n = Math.min(x1.length, x2.length); if (n < 8) return null;
  const t2 = thr * thr, rng = new Rng(seed), idx = [], s1 = [], s2 = [];
  let best = null, maxIter = iterations, it = 0;
  while (it < maxIter) {
    it++; rng.sample(n, 8, idx); if (idx.length < 8) break;
    idx.forEach((i, k) => { s1[k] = x1[i]; s2[k] = x2[i]; });
    const e = essential8pt(s1, s2); if (!e) continue;
    let c = 0, err = 0; for (let i = 0; i < n; i++) { const d = sampson2(e, x1[i], x2[i]); if (d < t2) { c++; err += d; } }
    if (!best || c > best[0] || (c === best[0] && err < best[1])) {
      best = [c, err, e];
      const pg = (c / n) ** 8;
      if (pg > 1e-9) { const need = Math.ceil(Math.log(0.01) / Math.log(Math.max(1 - pg, 1e-12))); if (Number.isFinite(need)) maxIter = Math.min(maxIter, Math.max(need, 30)); }
    }
  }
  if (!best) return null;
  let e = best[2]; const inl = new Array(n);
  for (let r = 0; r < 2; r++) {
    for (let i = 0; i < n; i++) inl[i] = sampson2(e, x1[i], x2[i]) < t2;
    const a = [], b = []; for (let i = 0; i < n; i++) if (inl[i]) { a.push(x1[i]); b.push(x2[i]); }
    const e2 = essential8pt(a, b); if (!e2) break; e = e2;
  }
  for (let i = 0; i < n; i++) inl[i] = sampson2(e, x1[i], x2[i]) < t2;
  return [e, inl];
}
function decomposeEssential(e) {
  let [u, , v] = svd3(e);
  if (det3(u) < 0) u = u.map(r => [r[0], r[1], -r[2]]);
  if (det3(v) < 0) v = v.map(r => [r[0], r[1], -r[2]]);
  const w = [[0, -1, 0], [1, 0, 0], [0, 0, 1]], r1 = mm(u, mm(w, mt(v))), r2 = mm(u, mm(mt(w), mt(v))), t = col(u, 2);
  return [[r1, t], [r1, scale(t, -1)], [r2, t], [r2, scale(t, -1)]];
}
// a camera pose { r, c }: X_cam = R (X − C)
const POSE0 = { r: I3(), c: [0, 0, 0] };
const poseFromRt = (r, t) => ({ r, c: scale(mtv(r, t), -1) });
const poseT = p => scale(mv(p.r, p.c), -1);
const toCam = (p, x) => mv(p.r, sub(x, p.c));
// linear (DLT) triangulation from normalised observations: views [[pose, [x, y]]]
function triangulate(views) {
  if (views.length < 2) return null;
  const ata = new Float64Array(16);
  for (const [p, x] of views) {
    const t = poseT(p), rows = [[p.r[0][0], p.r[0][1], p.r[0][2], t[0]], [p.r[1][0], p.r[1][1], p.r[1][2], t[1]], [p.r[2][0], p.r[2][1], p.r[2][2], t[2]]];
    for (const a of [[0, 1, 2, 3].map(j => x[0] * rows[2][j] - rows[0][j]), [0, 1, 2, 3].map(j => x[1] * rows[2][j] - rows[1][j])]) {
      const nr2 = Math.max(Math.sqrt(a[0] * a[0] + a[1] * a[1] + a[2] * a[2] + a[3] * a[3]), 1e-300) ** 2;
      for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) ata[i * 4 + j] += a[i] * a[j] / nr2;
    }
  }
  const [, v] = symEigen(ata, 4), h = [v[0], v[4], v[8], v[12]];
  if (Math.abs(h[3]) < 1e-12) return null;
  const X = [h[0] / h[3], h[1] / h[3], h[2] / h[3]];
  return X.every(Number.isFinite) ? X : null;
}
const rayAngle = (a, b, x) => Math.acos(Math.min(1, Math.max(-1, dot(normalize(sub(x, a)), normalize(sub(x, b))))));
function reproj2(pose, x, o) { const c = toCam(pose, x); if (c[2] <= 1e-9) return null; const u = c[0] / c[2] - o[0], v = c[1] / c[2] - o[1]; return u * u + v * v; }
function selectPose(cands, x1, x2) {
  if (x1.length !== x2.length || !x1.length) return null;
  let best = null;
  for (const [r, t] of cands) {
    const p2 = poseFromRt(r, t); let c = 0;
    for (let i = 0; i < x1.length; i++) { const x = triangulate([[POSE0, x1[i]], [p2, x2[i]]]); if (x && x[2] > 0 && toCam(p2, x)[2] > 0) c++; }
    if (!best || c > best[1]) best = [p2, c];
  }
  return best;
}
// a calibrated planar homography H ~ R + t nᵀ / d into its motions [R, t/d, n] (Ma et al. §5.3.3)
function decomposeHomography(h, x1, x2) {
  const [, s] = svd3(h); if (s[1] <= 1e-12) return [];
  let hn = mscale(h, 1 / s[1]);
  const pos = x1.filter((p, i) => dot([x2[i][0], x2[i][1], 1], mv(hn, [p[0], p[1], 1])) > 0).length;
  if (pos * 2 < x1.length) hn = mscale(hn, -1);
  const hth = mm(mt(hn), hn), [vals, vecs] = symEigen([...hth[0], ...hth[1], ...hth[2]], 3);
  const v1 = [vecs[2], vecs[5], vecs[8]], v2 = [vecs[1], vecs[4], vecs[7]], v3 = [vecs[0], vecs[3], vecs[6]];
  const s1 = Math.max(vals[2], 1), s3 = Math.min(1, Math.max(0, vals[0]));
  if (s1 - s3 < 1e-10) return [[nearestRotation(hn), [0, 0, 0], [0, 0, 1]]];
  const k = Math.sqrt(s1 - s3), a1 = Math.sqrt(1 - s3), a3 = Math.sqrt(s1 - 1), out = [];
  for (const u of [scale(add(scale(v1, a1), scale(v3, a3)), 1 / k), scale(sub(scale(v1, a1), scale(v3, a3)), 1 / k)]) {
    const uu = fromCols(v2, u, cross(v2, u)), hv2 = mv(hn, v2), hu = mv(hn, u), ww = fromCols(hv2, hu, cross(hv2, hu));
    const r = mm(ww, mt(uu)), n = cross(v2, u), t = mv(madd(hn, r, -1), n);
    for (const sg of [1, -1]) {
      const n2 = scale(n, sg), t2 = scale(t, sg), front = x1.filter(p => dot(n2, [p[0], p[1], 1]) > 0).length;
      if (front * 2 >= x1.length) out.push([r, t2, n2]);
    }
  }
  return out;
}
// least-squares plane: [centroid, unit normal, RMS in-plane spread]
function fitPlane(p) {
  if (p.length < 3) return null;
  const k = 1 / p.length, c = scale(p.reduce(add, [0, 0, 0]), k), cov = new Float64Array(9);
  for (const q of p) { const d = sub(q, c); for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) cov[i * 3 + j] += d[i] * d[j] * k; }
  const [vals, vecs] = symEigen(cov, 3); if (vals[1] <= 1e-18) return null;
  return [c, normalize([vecs[0], vecs[3], vecs[6]]), Math.sqrt(Math.max(0, vals[1] + vals[2]))];
}
function procrustes(a, b) {
  if (a.length < 2) return null;
  let m = [[0, 0, 0], [0, 0, 0], [0, 0, 0]]; for (let i = 0; i < a.length; i++) m = madd(m, outer(b[i], a[i]), 1);
  const [u, , v] = svd3(m); let r = mm(u, mt(v));
  if (det3(r) < 0) r = mm(u.map(row => [row[0], row[1], -row[2]]), mt(v));
  return r;
}

// ================================================================ robust homography (fit.rs, solve.rs)
function solveLinear(a, b) {
  const n = b.length, m = a.map((r, i) => [...r, b[i]]);
  for (let c = 0; c < n; c++) {
    let p = c; for (let r = c + 1; r < n; r++) if (Math.abs(m[r][c]) > Math.abs(m[p][c])) p = r;
    if (Math.abs(m[p][c]) < 1e-12) return null;
    [m[c], m[p]] = [m[p], m[c]];
    for (let r = 0; r < n; r++) if (r !== c) { const f = m[r][c] / m[c][c]; if (f) for (let k = c; k <= n; k++) m[r][k] -= f * m[c][k]; }
  }
  return m.map((r, i) => r[n] / r[i]);
}
const hApply = (h, p) => { const w = h[2][0] * p[0] + h[2][1] * p[1] + h[2][2]; return [(h[0][0] * p[0] + h[0][1] * p[1] + h[0][2]) / w, (h[1][0] * p[0] + h[1][1] * p[1] + h[1][2]) / w]; };
function homographyLS(src, dst) {
  const n = Math.min(src.length, dst.length); if (n < 4) return null;
  const cen = p => { let x = 0, y = 0; for (let i = 0; i < n; i++) { x += p[i][0]; y += p[i][1]; } return [x / n, y / n]; };
  const cs = cen(src), cd = cen(dst), nrm = (p, c) => { let d = 0; for (let i = 0; i < n; i++) d += Math.hypot(p[i][0] - c[0], p[i][1] - c[1]); d /= n; return d > 1e-12 ? Math.SQRT2 / d : 1; };
  const ks = nrm(src, cs), kd = nrm(dst, cd), A = Array.from({ length: 8 }, () => new Array(8).fill(0)), B = new Array(8).fill(0);
  for (let i = 0; i < n; i++) {
    const x = (src[i][0] - cs[0]) * ks, y = (src[i][1] - cs[1]) * ks, u = (dst[i][0] - cd[0]) * kd, v = (dst[i][1] - cd[1]) * kd;
    for (const [r, t] of [[[x, y, 1, 0, 0, 0, -u * x, -u * y], u], [[0, 0, 0, x, y, 1, -v * x, -v * y], v]])
      for (let a = 0; a < 8; a++) { B[a] += r[a] * t; for (let b = 0; b < 8; b++) A[a][b] += r[a] * r[b]; }
  }
  const h = solveLinear(A, B); if (!h) return null;
  const hn = [[h[0], h[1], h[2]], [h[3], h[4], h[5]], [h[6], h[7], 1]], ts = [[ks, 0, -ks * cs[0]], [0, ks, -ks * cs[1]], [0, 0, 1]], tdi = [[1 / kd, 0, cd[0]], [0, 1 / kd, cd[1]], [0, 0, 1]];
  const m = mm(tdi, mm(hn, ts)); if (Math.abs(m[2][2]) < 1e-12) return null;
  const o = mscale(m, 1 / m[2][2]); return o.flat().every(Number.isFinite) ? o : null;
}
function ransacHomography(src, dst, threshold, iterations, seed) {
  const n = Math.min(src.length, dst.length), k = 4; if (n < k) return null;
  const t2 = threshold * threshold, r2 = (h, i) => { const m = hApply(h, src[i]); return (m[0] - dst[i][0]) ** 2 + (m[1] - dst[i][1]) ** 2; };
  const count = h => { let c = 0, e = 0; for (let i = 0; i < n; i++) { const r = r2(h, i); if (r < t2) { c++; e += r; } } return [c, e]; };
  let best = null;
  if (n === k) { const h = homographyLS(src, dst); if (!h) return null; best = [...count(h), h]; }
  else {
    const rng = new Rng(seed), idx = []; let maxIter = Math.max(1, iterations), it = 0;
    while (it < maxIter) {
      it++; rng.sample(n, k, idx); if (idx.length < k) continue;
      const h = homographyLS(idx.map(i => src[i]), idx.map(i => dst[i])); if (!h) continue;
      const [c, e] = count(h);
      if (!best || c > best[0] || (c === best[0] && e < best[1])) {
        best = [c, e, h]; const pg = (c / n) ** k;
        if (pg > 1e-9 && pg < 1) { const need = Math.ceil(Math.log(0.01) / Math.log(1 - pg)); if (Number.isFinite(need)) maxIter = Math.min(maxIter, Math.max(need, it + 1)); }
        else if (pg >= 1) break;
      }
    }
  }
  if (!best) return null;
  let h = best[2], inl = src.map((_, i) => r2(h, i) < t2);
  for (let r = 0; r < 2; r++) {
    const s2 = [], d2 = []; for (let i = 0; i < n; i++) if (inl[i]) { s2.push(src[i]); d2.push(dst[i]); }
    if (s2.length < k) break;
    const hh = homographyLS(s2, d2); if (hh) h = hh;
    inl = src.map((_, i) => r2(h, i) < t2);
  }
  return { h, inliers: inl };
}

// ================================================================ lens distortion (camtrack.rs)
const DIST_NONE = { k1: 0, k2: 0, radius: 0 };
const distForSize = size => ({ k1: 0, k2: 0, radius: 0.5 * Math.hypot(size[0], size[1]) });
const distNone = d => d.radius <= 0 || (d.k1 === 0 && d.k2 === 0);
function distort(d, p) {
  if (d.radius <= 0) return p;
  const r2 = (p[0] * p[0] + p[1] * p[1]) / (d.radius * d.radius), s = 1 + d.k1 * r2 + d.k2 * r2 * r2;
  return [p[0] * s, p[1] * s];
}
function undistort(d, q) {
  if (distNone(d)) return q;
  let p = q;
  for (let i = 0; i < 30; i++) { const r2 = (p[0] * p[0] + p[1] * p[1]) / (d.radius * d.radius), s = 1 + d.k1 * r2 + d.k2 * r2 * r2; if (Math.abs(s) < 1e-6) break; p = [q[0] / s, q[1] / s]; }
  return p;
}
function distJac(d, p) {
  if (d.radius <= 0) return [[[1, 0], [0, 1]], [[0, 0], [0, 0]]];
  const R2 = d.radius * d.radius, r2 = (p[0] * p[0] + p[1] * p[1]) / R2, s = 1 + d.k1 * r2 + d.k2 * r2 * r2, dd = (d.k1 + 2 * d.k2 * r2) * 2 / R2;
  return [[[s + p[0] * dd * p[0], p[0] * dd * p[1]], [p[1] * dd * p[0], s + p[1] * dd * p[1]]], [[p[0] * r2, p[0] * r2 * r2], [p[1] * r2, p[1] * r2 * r2]]];
}

// ================================================================ bundle adjustment (bundle.rs)
// a camera { r, c, f, dist }; an observation { cam, pt, u, v } (pixels from the principal point)
// focal: 'fixed' | 'shared' | ['per', k] (per camera, prior k on consecutive log focal lengths)
const BEHIND = 1e6;
const huber = (e2, k) => e2 <= k * k ? e2 : 2 * k * Math.sqrt(e2) - k * k;
const validCam = c => c.f > 0 && Number.isFinite(c.f) && c.r.flat().concat(c.c).every(Number.isFinite) && [c.dist.k1, c.dist.k2, c.dist.radius].every(Number.isFinite);
function residual(c, x, u, v) {
  const p = toCam(c, x); if (!(p[2] > 1e-9) || !p.every(Number.isFinite)) return null;
  const q = distort(c.dist, [c.f * p[0] / p[2], c.f * p[1] / p[2]]), r = [q[0] - u, q[1] - v];
  return Number.isFinite(r[0]) && Number.isFinite(r[1]) ? r : null;
}
function priorCost(cams, o) {
  if (!Array.isArray(o.focal)) return 0;
  let s = 0; for (let i = 0; i + 1 < cams.length; i++) s += (o.focal[1] * (Math.log(cams[i].f) - Math.log(cams[i + 1].f))) ** 2; return s;
}
function baCost(cams, pts, obs, o) {
  let s = 0;
  for (const ob of obs) { const r = residual(cams[ob.cam], pts[ob.pt], ob.u, ob.v); s += r ? huber(r[0] * r[0] + r[1] * r[1], o.huber) : BEHIND; }
  return s + priorCost(cams, o);
}
function baLayout(ncam, o) {
  const per = Array.isArray(o.focal), d = o.fixCenters ? 3 : 6, start = new Int32Array(ncam).fill(-1), fidx = new Int32Array(ncam).fill(-1);
  let n = 0;
  for (let i = 0; i < ncam; i++) { if (!o.fixed?.[i]) { start[i] = n; n += d; } if (per) fidx[i] = n++; }
  const shared = o.focal === 'shared' ? n++ : -1, dist = o.distortion ? (n += 2) - 2 : -1;
  return { start, fidx, shared, dist, n, rotOnly: !!o.fixCenters };
}
function baAdjust(cams, pts, obs, o) {
  const l = baLayout(cams.length, o), n = l.n, npts = pts.length, byPt = Array.from({ length: npts }, () => []);
  obs.forEach((ob, i) => byPt[ob.pt].push(i));
  let cur = baCost(cams, pts, obs, o); if (!Number.isFinite(cur)) throw new Error('bundle adjustment cost is not finite');
  const initial = cur; let lambda = 1e-4, iters = 0;
  if (n === 0 && o.fixPoints) return { initial, cost: cur, iterations: 0 };
  const jc = [];   // the camera-side Jacobian entries of one observation: [index, d r0, d r1]
  for (let it = 0; it < o.maxIter; it++) {
    iters++;
    const S = new Float64Array(n * n), bc = new Float64Array(n), systems = new Array(npts);
    for (let j = 0; j < npts; j++) {
      const ps = { v: [[0, 0, 0], [0, 0, 0], [0, 0, 0]], bp: [0, 0, 0], w: [] };
      for (const oi of byPt[j]) {
        const ob = obs[oi], ci = ob.cam, c = cams[ci], xc = toCam(c, pts[j]); if (xc[2] <= 1e-9) continue;
        const iz = 1 / xc[2], p0 = [c.f * xc[0] * iz, c.f * xc[1] * iz], pd = distort(c.dist, p0), r = [pd[0] - ob.u, pd[1] - ob.v];
        const e = Math.hypot(r[0], r[1]), w = e <= o.huber ? 1 : o.huber / e;
        const a0 = [[c.f * iz, 0, -c.f * xc[0] * iz * iz], [0, c.f * iz, -c.f * xc[1] * iz * iz]], [dj, dk] = distJac(c.dist, p0);
        const a = [0, 1].map(i => [0, 1, 2].map(k => dj[i][0] * a0[0][k] + dj[i][1] * a0[1][k]));
        const pp = [dj[0][0] * p0[0] + dj[0][1] * p0[1], dj[1][0] * p0[0] + dj[1][1] * p0[1]];
        jc.length = 0;
        const s = l.start[ci];
        if (s >= 0) {
          const sk = skew(xc);
          for (let k = 0; k < 3; k++) { const g = [-sk[0][k], -sk[1][k], -sk[2][k]]; jc.push([s + k, dot(a[0], g), dot(a[1], g)]); }
          if (!l.rotOnly) for (let k = 0; k < 3; k++) { const g = [-c.r[0][k], -c.r[1][k], -c.r[2][k]]; jc.push([s + 3 + k, dot(a[0], g), dot(a[1], g)]); }
        }
        if (l.fidx[ci] >= 0) jc.push([l.fidx[ci], pp[0], pp[1]]);
        if (l.shared >= 0) jc.push([l.shared, pp[0], pp[1]]);
        if (l.dist >= 0) { jc.push([l.dist, dk[0][0], dk[1][0]]); jc.push([l.dist + 1, dk[0][1], dk[1][1]]); }
        const jx = o.fixPoints ? [[0, 0, 0], [0, 0, 0]] : [mtv(c.r, a[0]), mtv(c.r, a[1])];
        for (const [ia, ja0, ja1] of jc) {
          bc[ia] -= w * (ja0 * r[0] + ja1 * r[1]);
          for (const [ib, jb0, jb1] of jc) S[ia * n + ib] += w * (ja0 * jb0 + ja1 * jb1);
        }
        if (!o.fixPoints) {
          for (let a1 = 0; a1 < 3; a1++) {
            ps.bp[a1] -= w * (jx[0][a1] * r[0] + jx[1][a1] * r[1]);
            for (let b1 = 0; b1 < 3; b1++) ps.v[a1][b1] += w * (jx[0][a1] * jx[0][b1] + jx[1][a1] * jx[1][b1]);
          }
          for (const [ia, ja0, ja1] of jc) {
            const wv = [w * (ja0 * jx[0][0] + ja1 * jx[1][0]), w * (ja0 * jx[0][1] + ja1 * jx[1][1]), w * (ja0 * jx[0][2] + ja1 * jx[1][2])];
            const repeats = ia === l.shared || (l.dist >= 0 && (ia === l.dist || ia === l.dist + 1)), found = repeats ? ps.w.find(e => e[0] === ia) : null;
            if (found) found[1] = add(found[1], wv); else ps.w.push([ia, wv]);
          }
        }
      }
      systems[j] = ps;
    }
    // the focal prior
    if (Array.isArray(o.focal)) {
      const k = o.focal[1];
      for (let i = 0; i + 1 < cams.length; i++) {
        const r = k * (Math.log(cams[i].f) - Math.log(cams[i + 1].f)), ia = l.fidx[i], ib = l.fidx[i + 1];
        for (const [x, g] of [[ia, k], [ib, -k]]) { if (x < 0) continue; bc[x] -= g * r; for (const [y, h] of [[ia, k], [ib, -k]]) if (y >= 0) S[x * n + y] += g * h; }
      }
    }
    let md = 0; for (let i = 0; i < n; i++) md += S[i * n + i]; const meanDiag = Math.max(md / Math.max(n, 1), 1e-12);
    let accepted = false;
    for (let t = 0; t < 12; t++) {
      const s = S.slice(), rhs = bc.slice();
      for (let i = 0; i < n; i++) { const d = s[i * n + i]; s[i * n + i] = d + lambda * Math.max(d, 1e-6 * meanDiag); }
      const vinv = o.fixPoints ? null : systems.map(ps => {
        const v = ps.v.map(r => r.slice()), vd = (v[0][0] + v[1][1] + v[2][2]) / 3;
        for (let k = 0; k < 3; k++) v[k][k] += lambda * Math.max(v[k][k], 1e-6 * Math.max(vd, 1e-12)) + 1e-12;
        return inv3(v);
      });
      // the Schur complement over the points: S −= W V⁻¹ Wᵀ, rhs −= W V⁻¹ bp
      if (!o.fixPoints) for (let j = 0; j < npts; j++) {
        const vi = vinv[j], ps = systems[j]; if (!vi) continue;
        const vb = mv(vi, ps.bp), wv = ps.w.map(e => mv(vi, e[1]));
        for (let a = 0; a < ps.w.length; a++) {
          const [ia, wa] = ps.w[a]; rhs[ia] -= dot(wa, vb);
          for (let b = a; b < ps.w.length; b++) { const [ib, wb] = ps.w[b], d = dot(wv[a], wb); s[ia * n + ib] -= d; if (ia !== ib) s[ib * n + ia] -= d; }
        }
      }
      const dc = rhs;
      if (n > 0 && !cholSolve(s, n, dc)) { lambda *= 10; continue; }
      const nc = cams.map((c, i) => {
        let { r, c: cc, f, dist } = c; const st = l.start[i];
        if (st >= 0) { r = mm(rodrigues([dc[st], dc[st + 1], dc[st + 2]]), r); if (!l.rotOnly) cc = add(cc, [dc[st + 3], dc[st + 4], dc[st + 5]]); }
        if (l.fidx[i] >= 0) f *= Math.exp(Math.min(0.5, Math.max(-0.5, dc[l.fidx[i]])));
        if (l.shared >= 0) f *= Math.exp(Math.min(0.5, Math.max(-0.5, dc[l.shared])));
        if (l.dist >= 0) dist = { ...dist, k1: dist.k1 + Math.min(0.2, Math.max(-0.2, dc[l.dist])), k2: dist.k2 + Math.min(0.2, Math.max(-0.2, dc[l.dist + 1])) };
        return { r, c: cc, f, dist };
      });
      const np = o.fixPoints ? pts : pts.map((x, j) => {
        const vi = vinv[j]; if (!vi) return x;
        let b = systems[j].bp; for (const [ia, w] of systems[j].w) b = sub(b, scale(w, dc[ia]));
        return add(x, mv(vi, b));
      });
      if (!nc.every(validCam) || !np.every(x => x.every(Number.isFinite))) { lambda *= 4; continue; }
      const c2 = baCost(nc, np, obs, o);
      if (Number.isFinite(c2) && c2 < cur) {
        for (let i = 0; i < cams.length; i++) cams[i] = nc[i];
        if (!o.fixPoints) for (let j = 0; j < npts; j++) pts[j] = np[j];
        const gain = cur - c2; cur = c2; lambda = Math.max(lambda / 3, 1e-9);
        accepted = gain > 1e-6 * Math.max(cur, 1e-12);
        if (!accepted) return { initial, cost: cur, iterations: iters };
        break;
      }
      lambda *= 4;
    }
    if (!accepted) break;
  }
  return { initial, cost: cur, iterations: iters };
}

// ================================================================ the solve (solver.rs)
const KF = 1 << 17;   // outlier keys: track index × KF + frame
function makeData(T, deleted) {
  const n = T.frames, c = [T.size[0] * 0.5, T.size[1] * 0.5], del = new Set(deleted || []), tracks = [], byFrame = Array.from({ length: n }, () => []);
  for (const tr of T.tracks) {
    if (del.has(tr.id) || tr.n < 3) continue;
    const ti = tracks.length, pts = [];
    for (let i = 0; i < tr.n; i++) { const p = [T.pts[tr.o + 2 * i] - c[0], T.pts[tr.o + 2 * i + 1] - c[1]]; pts.push(p); if (tr.start + i < n) byFrame[tr.start + i].push([ti, p]); }
    tracks.push({ id: tr.id, start: tr.start, pts });
  }
  return { n, w: T.size[0], tracks, byFrame, noise: Math.max(0.5 * T.factor, 0.5) };
}
const at = (d, ti, k) => { const t = d.tracks[ti], i = k - t.start; return i >= 0 && i < t.pts.length ? t.pts[i] : null; };
const inlierThr = d => 4 * d.noise;
function keyframes(d) {
  let first = -1; for (let k = 0; k < d.n; k++) if (d.byFrame[k].length >= 8) { first = k; break; }
  if (first < 0) return [];
  const kf = [first]; let last = first, j = first + 1;
  while (j < d.n) {
    const base = d.byFrame[last], disp = [];
    for (const [ti, p] of base) { const q = at(d, ti, j); if (q) disp.push(Math.hypot(q[0] - p[0], q[1] - p[1])); }
    if (disp.length < 24 && j > last + 1) { last = j - 1; kf.push(last); continue; }
    disp.sort((a, b) => a - b);
    const med = disp[disp.length >> 1] || 0, ratio = disp.length / Math.max(1, base.length);
    if (med > 0.015 * d.w || ratio < 0.7 || disp.length < 24 || j - last >= 12) { last = j; kf.push(j); }
    j++;
  }
  let lastf = -1; for (let k = d.n - 1; k >= 0; k--) if (d.byFrame[k].length >= 8) { lastf = k; break; }
  if (lastf >= 0 && kf[kf.length - 1] < lastf) kf.push(lastf);
  return kf;
}
const sortedKeys = m => [...m.keys()].sort((a, b) => a - b);
class Recon {
  constructor() { this.cams = new Map(); this.pts = new Map(); this.outliers = new Set(); }
  clone() { const r = new Recon(); r.cams = new Map(this.cams); r.pts = new Map(this.pts); r.outliers = new Set(this.outliers); return r; }
  observations(d, frames) {
    const cams = frames.map(k => this.cams.get(k)), pidx = new Map(), pts = [], ids = [], obs = [];
    frames.forEach((k, ci) => {
      for (const [ti, uv] of d.byFrame[k]) {
        const x = this.pts.get(ti); if (!x || this.outliers.has(ti * KF + k)) continue;
        let pi = pidx.get(ti); if (pi === undefined) { pi = pts.length; pidx.set(ti, pi); pts.push(x); ids.push(ti); }
        obs.push({ cam: ci, pt: pi, u: uv[0], v: uv[1] });
      }
    });
    return [cams, pts, obs, ids];
  }
  adjust(d, frames, cfg, focal, iters) {
    const [cams, pts, obs, ids] = this.observations(d, frames); if (!obs.length) return Infinity;
    const fixed = cams.map((_, i) => i === 0);
    const rep = baAdjust(cams, pts, obs, { focal, fixPoints: false, fixCenters: cfg.kind === 'tripod', fixed, huber: d.noise, maxIter: iters, distortion: cfg.distortion });
    frames.forEach((k, i) => this.cams.set(k, cams[i]));
    ids.forEach((ti, i) => this.pts.set(ti, pts[i]));
    return rep.cost;
  }
  reject(d) {
    const thr2 = inlierThr(d) ** 2, count = new Map();
    for (const [k, c] of this.cams) for (const [ti, uv] of d.byFrame[k]) {
      const x = this.pts.get(ti); if (!x || this.outliers.has(ti * KF + k)) continue;
      const r = residual(c, x, uv[0], uv[1]);
      if (r && r[0] * r[0] + r[1] * r[1] <= thr2) count.set(ti, (count.get(ti) || 0) + 1); else this.outliers.add(ti * KF + k);
    }
    for (const ti of [...this.pts.keys()]) if ((count.get(ti) || 0) < 2) this.pts.delete(ti);
  }
  triangulate(d, kind, minAngle, check) {
    const seen = new Map();
    for (const k of sortedKeys(this.cams)) for (const [ti] of d.byFrame[k]) if (!this.pts.has(ti)) { let s = seen.get(ti); if (!s) seen.set(ti, s = []); s.push(k); }
    const thr2 = (inlierThr(d) * check) ** 2;
    for (const [ti, ks] of seen) {
      if (ks.length < 2) continue;
      const views = ks.map(k => { const c = this.cams.get(k), uv = at(d, ti, k); return [c, [uv[0] / c.f, uv[1] / c.f], uv]; });
      let x;
      if (kind === 'tripod') x = normalize(views.reduce((a, [p, o]) => add(a, normalize(mtv(p.r, [o[0], o[1], 1]))), [0, 0, 0]));
      else {
        x = triangulate(views.map(v => [v[0], v[1]])); if (!x) continue;
        if (rayAngle(views[0][0].c, views[views.length - 1][0].c, x) * 180 / Math.PI < minAngle) continue;
      }
      let ok = true;
      for (const [c, , uv] of views) { const r = residual(c, x, uv[0], uv[1]); if (!r || r[0] * r[0] + r[1] * r[1] > thr2) { ok = false; break; } }
      if (ok) this.pts.set(ti, x);
    }
  }
  // resect frame k from the existing points starting at init
  register(d, k, init, cfg) {
    const pts = [], obs = [], ids = [];
    for (const [ti, uv] of d.byFrame[k]) { const x = this.pts.get(ti); if (x) { obs.push({ cam: 0, pt: pts.length, u: uv[0], v: uv[1] }); pts.push(x); ids.push(ti); } }
    if (obs.length < 6) return false;
    const thr2 = inlierThr(d) ** 2, opts = h => ({ focal: cfg.perFrameF ? ['per', 0] : 'fixed', fixPoints: true, fixCenters: cfg.kind === 'tripod', fixed: [false], huber: h, maxIter: 40, distortion: false });
    const inliers = c => obs.filter(o => { const r = residual(c, pts[o.pt], o.u, o.v); return r && r[0] * r[0] + r[1] * r[1] <= thr2; });
    let best = null, nearest = null, nd = Infinity;
    for (const [kk, c] of this.cams) { const dd = Math.abs(kk - k); if (dd < nd) { nd = dd; nearest = c; } }
    for (const start of [init, nearest]) {
      if (!start || (best && best[0] >= 0.8 * obs.length)) break;
      const cams = [start];
      try { baAdjust(cams, pts, obs, opts(inlierThr(d) * 4)); baAdjust(cams, pts, obs, opts(d.noise)); } catch { return false; }
      const inl = inliers(cams[0]).length;
      if (!best || inl > best[0]) best = [inl, cams[0]];
    }
    if (!best) return false;
    const [inl, cam] = best; if (inl < 6 || inl < 0.5 * obs.length) return false;
    const cams = [cam];
    try { baAdjust(cams, pts, inliers(cam), opts(d.noise)); } catch { return false; }
    for (const o of obs) { const r = residual(cams[0], pts[o.pt], o.u, o.v); if (!(r && r[0] * r[0] + r[1] * r[1] <= thr2)) this.outliers.add(ids[o.pt] * KF + k); }
    this.cams.set(k, cams[0]);
    return true;
  }
  score(d) {
    const thr = inlierThr(d); let s = 0, n = 0;
    for (const [k, c] of this.cams) for (const [ti, uv] of d.byFrame[k]) {
      n++; const x = this.pts.get(ti), r = x && residual(c, x, uv[0], uv[1]); s += r ? Math.min(Math.hypot(r[0], r[1]), thr) : thr;
    }
    return n ? s / n : Infinity;
  }
  error(d) {
    let s = 0, n = 0;
    for (const [k, c] of this.cams) for (const [ti, uv] of d.byFrame[k]) {
      const x = this.pts.get(ti); if (!x || this.outliers.has(ti * KF + k)) continue;
      const r = residual(c, x, uv[0], uv[1]); if (r) { s += Math.hypot(r[0], r[1]); n++; }
    }
    return [n ? s / n : Infinity, n];
  }
}
// interpolated / extrapolated starting camera for frame k
function predict(r, k) {
  const ks = sortedKeys(r.cams); let bi = -1; for (let i = 0; i < ks.length; i++) if (ks[i] < k) bi = i;
  const ai = ks.findIndex(x => x > k), before = bi >= 0 ? ks[bi] : null, after = ai >= 0 ? ks[ai] : null;
  if (before != null && after != null) {
    const a = r.cams.get(before), b = r.cams.get(after), t = (k - before) / (after - before);
    return { r: slerp(a.r, b.r, t), c: add(scale(a.c, 1 - t), scale(b.c, t)), f: a.f * (b.f / a.f) ** t, dist: a.dist };
  }
  const extra = (a, p, t) => { const dr = logRot(mm(a.r, mt(p.r))); return { r: mm(rodrigues(scale(dr, Math.min(t, 2))), a.r), c: add(a.c, scale(sub(a.c, p.c), Math.min(t, 2))), f: a.f, dist: a.dist }; };
  if (before != null) {
    const a = r.cams.get(before); if (bi < 1) return a;
    const kp = ks[bi - 1]; return extra(a, r.cams.get(kp), (k - before) / (before - kp));
  }
  if (after != null) {
    const b = r.cams.get(after); if (ai + 1 >= ks.length) return b;
    const kn = ks[ai + 1]; return extra(b, r.cams.get(kn), (after - k) / (kn - after));
  }
  return null;
}
const shared = (d, a, b) => d.byFrame[a].map(([ti, p]) => { const q = at(d, ti, b); return q && [ti, p, q]; }).filter(Boolean);
// two-view starts of frames a, b at focal length f: [pose of b, Map(track → point)]
function initPair(d, a, b, f, useE, useH) {
  const sh = shared(d, a, b); if (sh.length < 12) return [];
  const x1 = sh.map(s => [s[1][0] / f, s[1][1] / f]), x2 = sh.map(s => [s[2][0] / f, s[2][1] / f]), thr = 2 * d.noise / f, cands = [];
  if (useE) {
    const re = ransacEssential(x1, x2, thr, 400, a * 7919 + b);
    if (re) {
      const p1 = [], p2 = []; re[1].forEach((ok, i) => { if (ok) { p1.push(x1[i]); p2.push(x2[i]); } });
      const sp = selectPose(decomposeEssential(re[0]), p1, p2); if (sp) cands.push(sp[0]);
    }
  }
  if (useH) {
    const fit = ransacHomography(sh.map(s => s[1]), sh.map(s => s[2]), 2 * d.noise, 500, a * 31 + b);
    if (fit) {
      const h = fit.h, hn = [[h[0][0], h[0][1], h[0][2] / f], [h[1][0], h[1][1], h[1][2] / f], [h[2][0] * f, h[2][1] * f, h[2][2]]];
      const p1 = [], p2 = []; fit.inliers.forEach((ok, i) => { if (ok) { p1.push(x1[i]); p2.push(x2[i]); } });
      for (const [r, td] of decomposeHomography(hn, p1, p2)) if (norm(td) > 1e-6) cands.push(poseFromRt(r, normalize(td)));
    }
  }
  const thr2 = (inlierThr(d) / f) ** 2, out = [];
  for (const pose of cands) {
    const pts = new Map();
    sh.forEach((s, i) => {
      const x = triangulate([[POSE0, x1[i]], [pose, x2[i]]]); if (!x) return;
      const e1 = reproj2(POSE0, x, x1[i]), e2 = reproj2(pose, x, x2[i]);
      if (e1 != null && e1 < thr2 && e2 != null && e2 < thr2 && rayAngle([0, 0, 0], pose.c, x) * 180 / Math.PI > 0.3) pts.set(s[0], x);
    });
    if (pts.size >= 10 && pts.size * 3 >= sh.length) out.push([pose, pts]);
  }
  return out;
}
const F_PRIOR = 30;
const cam0 = (pose, f) => ({ r: pose.r, c: pose.c, f, dist: DIST_NONE });
function grow(d, kfs, j, init, f, cfg) {
  const a = kfs[0], b = kfs[j], r = new Recon();
  r.cams.set(a, cam0(POSE0, f)); r.cams.set(b, cam0(init[0], f)); r.pts = new Map(init[1]);
  const inner = frames => { r.adjust(d, frames, cfg, cfg.perFrameF && frames.length > 2 ? ['per', F_PRIOR] : 'fixed', 10); r.reject(d); };
  try { inner([a, b]); } catch { return null; }
  const order = [...kfs.slice(1, j), ...kfs.slice(j + 1)]; let done = 0;
  for (const k of order) {
    const start = predict(r, k); if (!start) return null;
    if (!r.register(d, k, start, cfg)) break;
    r.triangulate(d, cfg.kind, 1, 1); done++;
    const frames = sortedKeys(r.cams);
    if (done % 3 === 0 || frames.length <= 6) try { inner(frames); } catch { return null; }
  }
  try { inner(sortedKeys(r.cams)); } catch { return null; }
  return r.cams.size >= 2 && r.pts.size >= 8 ? r : null;
}
function growTripod(d, kfs, f, cfg) {
  const r = new Recon(), ray = p => normalize([p[0] / f, p[1] / f, 1]);
  r.cams.set(kfs[0], cam0(POSE0, f));
  for (let i = 0; i + 1 < kfs.length; i++) {
    const a = kfs[i], b = kfs[i + 1], sh = shared(d, a, b); if (sh.length < 6) break;
    const ra = sh.map(s => ray(s[1])), rb = sh.map(s => ray(s[2]));
    let rel = procrustes(ra, rb); if (!rel) return null;
    const errs = ra.map((x, i) => norm(sub(rb[i], mv(rel, x)))), sorted = [...errs].sort((p, q) => p - q), lim = Math.max(sorted[sorted.length >> 1] * 3, inlierThr(d) / f);
    const ia = [], ib = []; errs.forEach((e, i) => { if (e <= lim) { ia.push(ra[i]); ib.push(rb[i]); } });
    if (ia.length >= 4) { rel = procrustes(ia, ib); if (!rel) return null; }
    r.cams.set(b, { r: mm(rel, r.cams.get(a).r), c: [0, 0, 0], f, dist: DIST_NONE });
  }
  r.triangulate(d, 'tripod', 0, 20);
  const frames = sortedKeys(r.cams), focal = cfg.perFrameF && frames.length > 2 ? ['per', F_PRIOR] : 'fixed';
  try { r.adjust(d, frames, cfg, focal, 15); r.reject(d); r.triangulate(d, 'tripod', 0, 1); r.adjust(d, frames, cfg, focal, 15); } catch { return null; }
  return r.cams.size >= 2 && r.pts.size >= 8 ? r : null;
}
const focalOf = (w, hfov) => w * 0.5 / Math.tan(Math.min(170, Math.max(1, hfov)) * Math.PI / 360);
function bestInit(d, kfs, f, method) {
  const useE = method !== 'flat', useH = method !== 'typical';
  let best = null;
  for (let j = 1; j < Math.min(kfs.length, 6); j++) {
    const cands = [...initPair(d, kfs[0], kfs[j], f, useE, false).map(c => [c, false]), ...(useH ? initPair(d, kfs[0], kfs[j], f, false, true).map(c => [c, true]) : [])];
    for (const [c, isH] of cands) {
      const ang = [...c[1].values()].map(x => rayAngle([0, 0, 0], c[0].c, x) * 180 / Math.PI).sort((a, b) => a - b), med = ang[ang.length >> 1] || 0;
      const score = c[1].size * Math.min(med, 4);
      if (!best || score > best[0]) best = [score, j, c, isH];
    }
  }
  return best && [best[1], best[2], best[3]];
}
function initCandidates(d, kfs, f, method) {
  const b = bestInit(d, kfs, f, method); if (!b) return [];
  const out = [b];
  if (method === 'auto' || method === 'flat') for (const c of initPair(d, kfs[0], kfs[b[0]], f, false, true))
    if (out.every(o => norm(logRot(mm(o[1][0].r, mt(c[0].r)))) > 1e-3 || norm(sub(o[1][0].c, c[0].c)) > 1e-3)) out.push([b[0], c, true]);
  return out;
}
function general(d, kfs, f, method, cfg) {
  let best = null;
  for (const [j, init, isH] of initCandidates(d, kfs, f, method)) {
    const r = grow(d, kfs, j, init, f, cfg); if (!r) continue;
    const [, n] = r.error(d); if (!n) continue;
    const a = { err: r.score(d) / Math.max(r.cams.size / kfs.length, 0.05), recon: r, method: isH ? 'flat' : 'typical' };
    if (!best || a.err < best.err) best = a;
  }
  return best;
}
function tripod(d, kfs, f, cfg) {
  const r = growTripod(d, kfs, f, cfg); if (!r) return null;
  return { err: r.score(d) / Math.max(r.cams.size / kfs.length, 0.05), recon: r, method: 'tripod' };
}
// the focal length minimising eval(f): a log-spaced scan of angles of view, then golden-section refinement
function searchFocal(w, ev, tick) {
  const fs = [8, 12, 16, 20, 25, 30, 36, 43, 51, 60, 70, 82, 96, 112].map(a => focalOf(w, a)), errs = fs.map(f => { tick?.(); return ev(f); });
  let i = 0; for (let k = 1; k < fs.length; k++) if (errs[k] < errs[i]) i = k;
  let lo = Math.log(fs[Math.min(i + 1, fs.length - 1)]), hi = Math.log(fs[Math.max(i - 1, 0)]); if (lo > hi) [lo, hi] = [hi, lo];
  const g = 0.61803398875; let x1 = hi - g * (hi - lo), x2 = lo + g * (hi - lo), e1 = ev(Math.exp(x1)), e2 = ev(Math.exp(x2));
  for (let k = 0; k < 7; k++) {
    tick?.();
    if (e1 < e2) { hi = x2; x2 = x1; e2 = e1; x1 = hi - g * (hi - lo); e1 = ev(Math.exp(x1)); }
    else { lo = x1; x1 = x2; e1 = e2; x2 = lo + g * (hi - lo); e2 = ev(Math.exp(x2)); }
  }
  const best = e1 < e2 ? [x1, e1] : [x2, e2];
  return best[1] <= errs[i] ? Math.exp(best[0]) : fs[i];
}
function covRatio(p) {
  if (p.length < 3) return 1;
  const k = 1 / p.length, c = scale(p.reduce(add, [0, 0, 0]), k), cov = new Float64Array(9);
  for (const q of p) { const d = sub(q, c); for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) cov[i * 3 + j] += d[i] * d[j] * k; }
  const [vals] = symEigen(cov, 3); return Math.sqrt(Math.max(0, vals[0]) / Math.max(vals[1], 1e-300));
}
function undistortedTracks(T, dist) {
  const c = [T.size[0] * 0.5, T.size[1] * 0.5], pts = new Float32Array(T.pts.length);
  for (let i = 0; i < pts.length; i += 2) { const q = undistort(dist, [T.pts[i] - c[0], T.pts[i + 1] - c[1]]); pts[i] = q[0] + c[0]; pts[i + 1] = q[1] + c[1]; }
  return { ...T, pts };
}
// settings: { shot: 'fixed' | 'variable' | 'specify', hfov, method: 'auto' | 'typical' | 'flat' | 'tripod', deleted, lens }
function solve(T, s, progress = () => { }) {
  if (!s.lens) { const c = solveCore(T, s, progress); return finish(c.d, T, s, c.r, c.method, c.kind); }
  // lens distortion: solve, adjust (k1, k2) jointly on the raw tracks, then solve again on tracks undistorted with the
  // estimate and adjust jointly once more
  let dist = distForSize(T.size), out = null;
  for (let pass = 0; pass < 2; pass++) {
    const c = solveCore(pass ? undistortedTracks(T, dist) : T, s, progress), d = makeData(T, s.deleted); d.noise = c.d.noise;
    const r = c.r; for (const [k, cam] of r.cams) r.cams.set(k, { ...cam, dist });
    const cfg = { ...c.cfg, distortion: true }, all = sortedKeys(r.cams), frames = all.length <= 160 ? all : c.kfs.filter(k => r.cams.has(k));
    if (frames.length < 2) throw new Error('the camera could not be solved (not enough parallax or features)');
    r.outliers.clear(); r.adjust(d, frames, cfg, c.focal, 30); r.outliers.clear(); r.reject(d); r.adjust(d, frames, cfg, c.focal, 30);
    dist = r.cams.get(frames[0]).dist;
    for (const [k, cam] of r.cams) r.cams.set(k, { ...cam, dist });
    if (frames.length < all.length) {
      const base = r.clone(), rcfg = { ...cfg, distortion: false };
      for (const k of all) {
        if (frames.includes(k)) continue;
        const local = new Recon(); local.cams = new Map(base.cams); local.pts = base.pts;
        if (local.register(d, k, local.cams.get(k), rcfg)) r.cams.set(k, local.cams.get(k));
      }
      r.reject(d);
    }
    out = finish(d, T, s, r, c.method, c.kind); out.distortion = dist;
  }
  return out;
}
function solveCore(T, s, progress) {
  const d = makeData(T, s.deleted);
  if (d.n < 2) throw new Error('the clip must be at least two frames long');
  const kfs = keyframes(d);
  if (kfs.length < 2) throw new Error('not enough features were tracked to solve the camera');
  const fixedF = s.shot === 'specify' ? focalOf(d.w, s.hfov > 0 ? s.hfov : 40) : null, variable = s.shot === 'variable';
  const gcfg = { kind: 'general', perFrameF: variable, distortion: false }, tcfg = { ...gcfg, kind: 'tripod' };
  const mini = kfs.slice(0, 10), tryG = s.method !== 'tripod', tryT = s.method === 'auto' || s.method === 'tripod';
  let ticks = 0; const tick = () => progress(Math.min(0.9, ++ticks / 60));
  const results = [];
  if (tryG) {
    const f = fixedF ?? searchFocal(d.w, f => general(d, mini, f, s.method, gcfg)?.err ?? Infinity, tick);
    const a = general(d, kfs, f, s.method, gcfg); if (a) results.push([a, f]);
  }
  let plausible = true;
  if (s.method === 'auto' && results.length) {
    // (a rotation also looks like a flat scene to the general solve, whose focal length is then unreliable: the quick
    // check tries a few angles of view as well)
    const quick = Math.min(...[results[0][1], ...[25, 36, 51, 70, 96].map(a => focalOf(d.w, a))].map(f => tripod(d, mini, f, { ...tcfg, perFrameF: false })?.err ?? Infinity));
    plausible = quick <= 3 * results[0][0].err + d.noise;
  }
  if (tryT && plausible) {
    const f = fixedF ?? searchFocal(d.w, f => tripod(d, mini, f, tcfg)?.err ?? Infinity, tick);
    const a = tripod(d, kfs, f, tcfg); if (a) results.push([a, f]);
  }
  // Auto Detect keeps the tripod model when it explains the tracks about as well
  const gi = results.findIndex(r => r[0].method !== 'tripod'), ti = results.findIndex(r => r[0].method === 'tripod');
  let pick;
  if (gi >= 0 && ti >= 0) {
    const eg = results[gi][0].err, et = results[ti][0].err, rg = results[gi][0].recon, cs = [...rg.cams.values()].map(c => c.c);
    let base = 0; for (const a of cs) for (const b of cs) base = Math.max(base, norm(sub(a, b)));
    const c0 = rg.cams.get(sortedKeys(rg.cams)[0]).c, depth = [...rg.pts.values()].map(x => norm(sub(x, c0))).sort((a, b) => a - b), med = depth[depth.length >> 1] || 1;
    pick = et <= Math.max(eg * 1.25, eg + 0.05 * d.noise) || base / med < 0.01 ? ti : gi;
  } else if (gi >= 0) pick = gi; else if (ti >= 0) pick = ti;
  else throw new Error('the camera could not be solved (not enough parallax or features)');
  const att = results[pick][0], kind = att.method === 'tripod' ? 'tripod' : 'general', cfg = { kind, perFrameF: variable, distortion: false }, r = att.recon;
  const focal = fixedF != null ? 'fixed' : variable ? ['per', F_PRIOR] : 'shared';
  progress(0.92);
  // keyframes: adjust with the focal length free, reject, re-estimate the tracking noise, re-triangulate, adjust again
  const kfFrames = sortedKeys(r.cams);
  r.adjust(d, kfFrames, cfg, focal, 40); r.reject(d);
  const res = [];
  for (const [k, c] of r.cams) for (const [ti, uv] of d.byFrame[k]) {
    if (r.outliers.has(ti * KF + k)) continue;
    const x = r.pts.get(ti), e = x && residual(c, x, uv[0], uv[1]); if (e) res.push(Math.hypot(e[0], e[1]));
  }
  if (res.length > 20) {
    res.sort((a, b) => a - b);
    const sigma = res[res.length >> 1] / 1.1774, floor = 0.05 * Math.max(T.factor, 1);
    d.noise = Math.min(d.noise, Math.max(floor, 1.5 * sigma));
    r.outliers.clear(); r.reject(d);
  }
  r.triangulate(d, kind, 1, 1); r.adjust(d, kfFrames, cfg, focal, 40); r.reject(d); r.adjust(d, kfFrames, cfg, focal, 20);
  progress(0.95);
  // every other frame: resect from the points
  const near = k => { let m = Infinity; for (const c of r.cams.keys()) m = Math.min(m, Math.abs(c - k)); return m; };
  const todo = [...Array(d.n).keys()].filter(k => !r.cams.has(k)).sort((a, b) => near(a) - near(b)), base = r.clone(), got = [];
  for (const k of todo) {
    const local = new Recon(); local.cams = new Map(base.cams); local.pts = base.pts;
    const st = predict(local, k); if (st && local.register(d, k, st, cfg)) got.push([k, local.cams.get(k)]);
  }
  for (const [k, c] of got) r.cams.set(k, c);
  progress(0.97);
  r.triangulate(d, kind, 1, 1);
  const all = sortedKeys(r.cams); r.reject(d);
  if (all.length <= 160) { r.adjust(d, all, cfg, focal, 25); r.reject(d); }
  else {
    const base2 = r.clone(), got2 = [];
    for (const k of all) {
      if (kfFrames.includes(k)) continue;
      const local = new Recon(); local.cams = new Map(base2.cams); local.pts = base2.pts;
      if (local.register(d, k, local.cams.get(k), cfg)) got2.push([k, local.cams.get(k)]);
    }
    for (const [k, c] of got2) r.cams.set(k, c);
    r.reject(d);
  }
  const method = att.method === 'tripod' ? 'tripod' : s.method === 'auto' ? (covRatio([...r.pts.values()]) < 0.08 ? 'flat' : 'typical') : s.method;
  return { d, r, method, kind, cfg, focal, kfs: kfFrames };
}
// the canonical solve: the first solved camera at the origin looking along +z, scaled so the median depth of its
// points is 1; unsolved frames interpolated
function finish(d, T, s, r, method, kind) {
  const ks = sortedKeys(r.cams); if (!ks.length) throw new Error('the camera could not be solved (no frame was solved)');
  const k0 = ks[0], c0 = r.cams.get(k0);
  const depths = d.byFrame[k0].map(([ti]) => r.pts.get(ti)).filter(Boolean).map(x => toCam(c0, x)[2]).filter(z => z > 0).sort((a, b) => a - b);
  const sc = kind === 'tripod' ? 1 : (depths[depths.length >> 1] > 1e-12 ? depths[depths.length >> 1] : 1);
  const r0 = c0.r, cc = c0.c, toWorld = x => scale(mv(r0, sub(x, cc)), 1 / sc);
  const frames = Array.from({ length: d.n }, () => null);
  for (const [k, c] of r.cams) frames[k] = { rot: logRot(mm(c.r, mt(r0))), center: toWorld(c.c), focal: c.f, solved: true };
  for (let k = 0; k < d.n; k++) {
    if (frames[k]?.solved) continue;
    let a = -1, b = -1; for (const x of ks) { if (x < k) a = x; else if (x > k && b < 0) b = x; }
    if (a >= 0 && b >= 0) {
      const t = (k - a) / (b - a), fa = frames[a], fb = frames[b];
      frames[k] = { rot: logRot(slerp(rodrigues(fa.rot), rodrigues(fb.rot), t)), center: add(scale(fa.center, 1 - t), scale(fb.center, t)), focal: fa.focal + (fb.focal - fa.focal) * t, solved: false };
    } else frames[k] = { ...frames[a >= 0 ? a : b], solved: false };
  }
  const points = []; let esum = 0, en = 0;
  for (const ti of sortedKeys(r.pts)) {
    const x = r.pts.get(ti), t = d.tracks[ti]; let s1 = 0, n1 = 0;
    t.pts.forEach((uv, i) => {
      const k = t.start + i; if (r.outliers.has(ti * KF + k)) return;
      const c = r.cams.get(k), e = c && residual(c, x, uv[0], uv[1]); if (e) { s1 += Math.hypot(e[0], e[1]); n1++; }
    });
    if (n1 < 2) continue;
    esum += s1; en += n1;
    points.push({ id: t.id, pos: toWorld(x), error: s1 / n1, first: t.start, last: t.start + t.pts.length - 1 });
  }
  return { version: 1, size: T.size, start: T.start, fd: T.fd, shot: s.shot, methodUsed: method, averageError: en ? esum / en : 0, frames, points, distortion: null, solvedFrames: ks.length };
}

// ================================================================ the worker's messages
const JOBS = new Map();
const OPS = {
  // a new analysis: { jid, size: [layer w, h], gs, detailed }
  begin(m) { JOBS.set(m.jid, new TrackAnalyzer(m.size, m.gs, !!m.detailed)); return { ok: true }; },
  // the next frame on the layer's grid: { jid, img: { w, h, d } }
  push(m) { const a = JOBS.get(m.jid); if (!a) return { error: 'no such analysis' }; return { active: a.push(m.img), frame: a.frame }; },
  finish(m) { const a = JOBS.get(m.jid); JOBS.delete(m.jid); if (!a) return { error: 'no such analysis' }; const t = a.finish(m.start, m.fd); return { tracks: t, transfer: [t.pts.buffer] }; },
  drop(m) { JOBS.delete(m.jid); return { ok: true }; },
  solve(m) {
    const t0 = Date.now();
    const sol = solve(m.tracks, m.settings, p => self.postMessage?.({ id: m.id, progress: p }));
    return { solve: sol, ms: Date.now() - t0 };
  },
  // tests
  klt(m) {
    const W = m.w || 160, H = m.h || 120, img = (dx, dy) => { const d = new Uint8Array(W * H * 4); for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const v = Math.round(255 * TEX(x + 0.5 - dx, y + 0.5 - dy)), i = (y * W + x) * 4; d[i] = d[i + 1] = d[i + 2] = v; d[i + 3] = 255; } return { w: W, h: H, d }; };
    const a = pyramid(lumaPlane(img(0, 0), 1), 1, 3), b = pyramid(lumaPlane(img(6.3, -4.2), 1), 1, 3);
    const pts = goodFeatures(a, { maxFeatures: 60, minDistance: 8, quality: 0.01, window: 2, border: 6 }), q = track(a, b, pts, { radius: 5, iterations: 20, epsilon: 0.01, minEigen: 1e-5, fbMax: 1 });
    const errs = pts.map((p, i) => q[i] && Math.hypot(q[i][0] - p[0] - 6.3, q[i][1] - p[1] + 4.2)).filter(e => e != null).sort((x, y) => x - y);
    return { features: pts.length, tracked: errs.length, median: errs[errs.length >> 1] };
  },
  synth(m) { return synthTest(m); },
};
// value noise for the KLT test
function TEX(x, y) {
  const hh = (i, j) => { let v = (Math.imul(i, 73856093) ^ Math.imul(j, 19349663)) >>> 0; v ^= v >>> 13; v = Math.imul(v, 0x5bd1e995) >>> 0; v ^= v >>> 15; return (v % 1000) / 1000; };
  const nz = (x, y, cell) => {
    const fx = x / cell, fy = y / cell, i = Math.floor(fx), j = Math.floor(fy), tx = fx - i, ty = fy - j, sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
    const a = hh(i, j) + (hh(i + 1, j) - hh(i, j)) * sx, b = hh(i, j + 1) + (hh(i + 1, j + 1) - hh(i, j + 1)) * sx; return a + (b - a) * sy;
  };
  return 0.2 + 0.4 * nz(x + 1000, y + 1000, 9) + 0.3 * nz(x + 1000, y + 1000, 4);
}
// a made-up scene seen by a known moving camera: tracks with noise, solved, compared with the truth
function synthTest(m) {
  const W = 1280, H = 720, N = m.frames || 60, hfov = m.hfov || 50, f = focalOf(W, hfov), rng = new Rng(7), rnd = () => rng.next() / 4294967296;
  const pts3 = []; for (let i = 0; i < (m.points || 400); i++) pts3.push(m.flat ? [(rnd() - 0.5) * 8, 1.5 + (rnd() - 0.5) * 0.01, 4 + rnd() * 6] : [(rnd() - 0.5) * 8, (rnd() - 0.5) * 4, 4 + rnd() * 6]);
  const cams = []; for (let k = 0; k < N; k++) { const t = k / (N - 1); cams.push({ r: rodrigues(m.tripod ? [0.02 * t, 0.25 * t, 0] : [0.02 * t, 0.12 * t, 0.01 * t]), c: m.tripod ? [0, 0, 0] : [1.2 * t, -0.1 * t, 0.4 * t] }); }
  const list = [], flat = []; let o = 0;
  pts3.forEach((X, id) => {
    let start = -1, run = [];
    const flush = () => { if (run.length >= 6) { list.push({ id: list.length, start, n: run.length / 2, o }); flat.push(...run); o += run.length; } run = []; start = -1; };
    for (let k = 0; k < N; k++) {
      const c = toCam(cams[k], X); let ok = c[2] > 0.1;
      const u = f * c[0] / c[2] + W / 2, v = f * c[1] / c[2] + H / 2; ok = ok && u > 2 && v > 2 && u < W - 2 && v < H - 2;
      if (ok) {
        if (start < 0) start = k;
        const q = m.k1 ? distort({ k1: m.k1, k2: 0, radius: 0.5 * Math.hypot(W, H) }, [u - W / 2, v - H / 2]) : [u - W / 2, v - H / 2];
        run.push(q[0] + W / 2 + (rnd() - 0.5) * (m.noise ?? 0.6), q[1] + H / 2 + (rnd() - 0.5) * (m.noise ?? 0.6));
      } else flush();
    }
    flush();
  });
  const T = { version: 1, size: [W, H], start: 0, fd: 1 / 30, frames: N, factor: 1, detailed: false, tracks: list, pts: Float32Array.from(flat) };
  const t0 = Date.now(), sol = solve(T, { shot: m.shot || 'fixed', hfov: m.specify || 0, method: m.method || 'auto', deleted: [], lens: !!m.lens });
  const hf = 2 * Math.atan(W * 0.5 / sol.frames[0].focal) * 180 / Math.PI;
  // the camera path's shape: the solved centres against the truth after a similarity (scale from the first to last)
  const c0 = cams[0].c, cN = cams[N - 1].c, s0 = sol.frames[0].center, sN = sol.frames[N - 1].center, k = norm(sub(cN, c0)) / Math.max(norm(sub(sN, s0)), 1e-9);
  return { k1: sol.distortion?.k1, ms: Date.now() - t0, method: sol.methodUsed, err: sol.averageError, hfov: hf, points: sol.points.length, solved: sol.solvedFrames, frames: N, tracks: list.length, scaleRatio: m.tripod ? null : k };
}
const isWorker = typeof self !== 'undefined' && typeof self.postMessage === 'function' && typeof module === 'undefined';
if (isWorker) self.onmessage = e => {
  const m = e.data, op = OPS[m.op];
  let res; try { res = op ? op(m) : { error: 'unknown op ' + m.op }; } catch (err) { res = { error: err.message || String(err) }; }
  const tr = res.transfer || []; delete res.transfer;
  self.postMessage({ id: m.id, res }, tr);
};
if (typeof module !== 'undefined') module.exports = { OPS, solve, TrackAnalyzer, rodrigues, toCam, focalOf, eulerXYZ, fitPlane, distort, undistort };
