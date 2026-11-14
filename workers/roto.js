// Roto Brush & Refine Edge's engine for Lumina (EffectCraft Round 31), run in a Web Worker so the editor stays
// responsive while frames are segmented. Ported from EffectCraft's crates/track/src/roto.rs, roto/gmm.rs,
// roto/maxflow.rs, roto/matting.rs, roto/refine.rs and crates/raster/src/flow.rs (MIT licence), which follow these
// published methods:
//   - interactive graph cuts (Boykov & Jolly, ICCV 2001) with GrabCut's iterated colour models (Rother, Kolmogorov &
//     Blake, SIGGRAPH 2004); the min cut by Boykov–Kolmogorov (PAMI 2004);
//   - coarse to fine: a reduced copy, then a full-resolution cut in a band round the boundary (Lombaert et al. 2005);
//   - propagation in the spirit of Video SnapCut (Bai et al. 2009): the previous frame's matte warped by block-matching
//     optical flow, re-cut in a band of Search Radius pixels;
//   - exact distance transforms (Felzenszwalb & Huttenlocher 2012), the colour guided filter (He, Sun & Tang 2010) and
//     closed-form matting (Levin, Lischinski & Weiss 2008) solved with box filters (He et al., CVPR 2010) for Refine Edge.
// Only the classic engine: EffectCraft's trained models (MobileSAM, SAM 2) need a download, which Lumina doesn't do.
//
// Images are { w, h, rgb: Float32Array(3n) straight 0..1, a: Float32Array(n) }. Mattes are Uint8Array (0/1).
'use strict';

// ------------------------------------------------------------------ colour models (roto/gmm.rs)
const REG = 2e-4;
function det3(m) { return m[0] * (m[4] * m[8] - m[5] * m[7]) - m[1] * (m[3] * m[8] - m[5] * m[6]) + m[2] * (m[3] * m[7] - m[4] * m[6]); }
function inv3(m) {
  const d = det3(m); if (Math.abs(d) < 1e-30) return null;
  return [(m[4] * m[8] - m[5] * m[7]) / d, (m[2] * m[7] - m[1] * m[8]) / d, (m[1] * m[5] - m[2] * m[4]) / d,
    (m[5] * m[6] - m[3] * m[8]) / d, (m[0] * m[8] - m[2] * m[6]) / d, (m[2] * m[3] - m[0] * m[5]) / d,
    (m[3] * m[7] - m[4] * m[6]) / d, (m[1] * m[6] - m[0] * m[7]) / d, (m[0] * m[4] - m[1] * m[3]) / d];
}
class Stats {
  constructor() { this.n = 0; this.s = [0, 0, 0]; this.ss = [0, 0, 0, 0, 0, 0, 0, 0, 0]; }
  add(r, g, b) { const c = [r, g, b]; this.n++; for (let i = 0; i < 3; i++) { this.s[i] += c[i]; for (let j = 0; j < 3; j++) this.ss[i * 3 + j] += c[i] * c[j]; } }
  mean() { const n = Math.max(this.n, 1); return [this.s[0] / n, this.s[1] / n, this.s[2] / n]; }
  cov() {
    const n = Math.max(this.n, 1), m = this.mean(), c = new Array(9);
    for (let i = 0; i < 3; i++) { for (let j = 0; j < 3; j++) c[i * 3 + j] = this.ss[i * 3 + j] / n - m[i] * m[j]; c[i * 4] += REG; }
    return c;
  }
}
function principal(c) {
  let v = [.577, .577, .577], lambda = 0;
  for (let it = 0; it < 40; it++) {
    const w = [c[0] * v[0] + c[1] * v[1] + c[2] * v[2], c[3] * v[0] + c[4] * v[1] + c[5] * v[2], c[6] * v[0] + c[7] * v[1] + c[8] * v[2]];
    const n = Math.sqrt(w[0] * w[0] + w[1] * w[1] + w[2] * w[2]); if (n < 1e-30) break;
    lambda = n; v = [w[0] / n, w[1] / n, w[2] / n];
  }
  return [v, lambda];
}
// a Gaussian mixture: comps [{ weight, mean[3], inv[9], logNorm }]
class Gmm {
  constructor(comps = []) { this.comps = comps; }
  isEmpty() { return !this.comps.length; }
  static fit(xs0, k, maxSamples) {   // xs0: Float32Array of r, g, b triples
    const total = xs0.length / 3; if (!total) return new Gmm();
    const stride = Math.max(1, Math.ceil(total / Math.max(1, maxSamples))), n = Math.ceil(total / stride), xs = new Float32Array(n * 3);
    for (let i = 0, j = 0; i < total; i += stride, j++) { xs[j * 3] = xs0[i * 3]; xs[j * 3 + 1] = xs0[i * 3 + 1]; xs[j * 3 + 2] = xs0[i * 3 + 2]; }
    const label = new Uint8Array(n); let ncl = 1;
    while (ncl < k) {
      const st = Array.from({ length: ncl }, () => new Stats());
      for (let i = 0; i < n; i++) st[label[i]].add(xs[i * 3], xs[i * 3 + 1], xs[i * 3 + 2]);
      let best = -1, bestL = 0, axis = [0, 0, 0];
      st.forEach((s, c) => { if (s.n < 2) return; const [v, l] = principal(s.cov()); if (l > bestL) { best = c; bestL = l; axis = v; } });
      if (best < 0 || bestL <= REG * 1.01) break;
      const m = st[best].mean(), thr = axis[0] * m[0] + axis[1] * m[1] + axis[2] * m[2];
      for (let i = 0; i < n; i++) if (label[i] === best && axis[0] * xs[i * 3] + axis[1] * xs[i * 3 + 1] + axis[2] * xs[i * 3 + 2] > thr) label[i] = ncl;
      ncl++;
    }
    let g = Gmm.fromLabels(xs, label, ncl);
    for (let it = 0; it < 3; it++) {
      for (let i = 0; i < n; i++) label[i] = g.best(xs[i * 3], xs[i * 3 + 1], xs[i * 3 + 2]);
      const ng = Gmm.fromLabels(xs, label, g.comps.length); if (ng.isEmpty()) break; g = ng;
    }
    return g;
  }
  static fromLabels(xs, label, k) {
    const st = Array.from({ length: k }, () => new Stats()), n = label.length;
    for (let i = 0; i < n; i++) st[label[i]].add(xs[i * 3], xs[i * 3 + 1], xs[i * 3 + 2]);
    const total = Math.max(1, st.reduce((a, s) => a + s.n, 0)), comps = [];
    for (const s of st) {
      if (s.n < 1) continue;
      const c = s.cov(), inv = inv3(c); if (!inv) continue;
      const det = Math.max(det3(c), 1e-300), weight = s.n / total;
      comps.push({ weight, mean: s.mean(), inv, logNorm: -Math.log(weight) + .5 * Math.log(det) });
    }
    return new Gmm(comps);
  }
  static compCost(g, r, gg, b) {
    const d0 = r - g.mean[0], d1 = gg - g.mean[1], d2 = b - g.mean[2], v = g.inv;
    return g.logNorm + .5 * (d0 * (v[0] * d0 + v[1] * d1 + v[2] * d2) + d1 * (v[3] * d0 + v[4] * d1 + v[5] * d2) + d2 * (v[6] * d0 + v[7] * d1 + v[8] * d2));
  }
  best(r, g, b) { let bi = 0, bv = Infinity; this.comps.forEach((c, i) => { const v = Gmm.compCost(c, r, g, b); if (v < bv) { bv = v; bi = i; } }); return bi; }
  cost(r, g, b) {
    const cs = this.comps; if (!cs.length) return 10;
    const n = Math.min(cs.length, 16); let m = Infinity; const costs = new Float64Array(n);
    for (let i = 0; i < n; i++) { costs[i] = Gmm.compCost(cs[i], r, g, b); if (costs[i] < m) m = costs[i]; }
    let s = 0; for (let i = 0; i < n; i++) s += Math.exp(m - costs[i]);
    return Math.min(60, Math.max(-20, m - Math.log(s)));
  }
}

// ------------------------------------------------------------------ min cut / max flow (roto/maxflow.rs)
const NONE = -1, TERMINAL = -2, ORPHAN = -3;
class Graph {
  constructor(n, edgesHint) {
    this.n = n; this.first = new Int32Array(n).fill(NONE); this.parent = new Int32Array(n).fill(NONE); this.trCap = new Float64Array(n);
    this.isSink = new Uint8Array(n); this.active = new Uint8Array(n); this.ts = new Uint32Array(n); this.dist = new Uint32Array(n);
    const cap = Math.max(16, edgesHint * 2); this.head = new Int32Array(cap); this.next = new Int32Array(cap); this.rCap = new Int32Array(cap); this.na = 0;
    this.flow = 0; this.time = 0;
    this.q = new Int32Array(n + 1); this.qh = 0; this.qt = 0; this.qn = 0;
    this.o = new Int32Array(n + 1); this.oh = 0; this.ot = 0; this.on = 0;
  }
  addT(i, source, sink) {
    const d = this.trCap[i]; let s = source, t = sink;
    if (d > 0) s += d; else t -= d;
    this.flow += Math.min(s, t); this.trCap[i] = s - t;
  }
  grow() {
    const cap = this.head.length * 2, g = a => { const b = new Int32Array(cap); b.set(a); return b; };
    this.head = g(this.head); this.next = g(this.next); this.rCap = g(this.rCap);
  }
  addEdge(i, j, cap, rev) {
    if (this.na + 2 > this.head.length) this.grow();
    const a = this.na; this.na += 2;
    this.head[a] = j; this.next[a] = this.first[i]; this.rCap[a] = cap; this.first[i] = a;
    this.head[a + 1] = i; this.next[a + 1] = this.first[j]; this.rCap[a + 1] = rev; this.first[j] = a + 1;
  }
  setActive(i) { if (!this.active[i]) { this.active[i] = 1; this.q[this.qt] = i; this.qt = (this.qt + 1) % this.q.length; this.qn++; } }
  popActive() { const i = this.q[this.qh]; this.qh = (this.qh + 1) % this.q.length; this.qn--; return i; }
  makeOrphan(i) { this.parent[i] = ORPHAN; this.o[this.ot] = i; this.ot = (this.ot + 1) % this.o.length; this.on++; }
  maxflow() {
    const { parent, trCap, isSink, ts, dist, head, next, rCap, first } = this;
    for (let i = 0; i < this.n; i++) if (trCap[i] !== 0) { isSink[i] = trCap[i] < 0 ? 1 : 0; parent[i] = TERMINAL; ts[i] = 0; dist[i] = 1; this.setActive(i); }
    let current = -1;
    for (;;) {
      let i;
      if (current >= 0 && this.parent[current] !== NONE) { i = current; current = -1; }
      else {
        current = -1;
        for (;;) {
          if (!this.qn) return this.flow;
          i = this.popActive(); this.active[i] = 0;
          if (this.parent[i] !== NONE) break;
        }
      }
      let found = NONE;
      const its = this.ts[i], idist = this.dist[i];
      let a = this.first[i];
      if (!this.isSink[i]) {
        while (a !== NONE) {
          if (this.rCap[a] > 0) {
            const j = this.head[a];
            if (this.parent[j] === NONE) { this.isSink[j] = 0; this.parent[j] = a ^ 1; this.ts[j] = its; this.dist[j] = idist + 1; this.setActive(j); }
            else if (this.isSink[j]) { found = a; break; }
            else if (this.ts[j] <= its && this.dist[j] > idist) { this.parent[j] = a ^ 1; this.ts[j] = its; this.dist[j] = idist + 1; }
          }
          a = this.next[a];
        }
      } else {
        while (a !== NONE) {
          if (this.rCap[a ^ 1] > 0) {
            const j = this.head[a];
            if (this.parent[j] === NONE) { this.isSink[j] = 1; this.parent[j] = a ^ 1; this.ts[j] = its; this.dist[j] = idist + 1; this.setActive(j); }
            else if (!this.isSink[j]) { found = a ^ 1; break; }
            else if (this.ts[j] <= its && this.dist[j] > idist) { this.parent[j] = a ^ 1; this.ts[j] = its; this.dist[j] = idist + 1; }
          }
          a = this.next[a];
        }
      }
      this.time = (this.time + 1) >>> 0;
      if (found !== NONE) { current = i; this.augment(found); this.adopt(); }
    }
  }
  augment(middle) {
    const { parent, head, rCap } = this;
    let b = rCap[middle], i = head[middle ^ 1];
    for (;;) { const a = parent[i]; if (a === TERMINAL) break; b = Math.min(b, rCap[a ^ 1]); i = head[a]; }
    b = Math.min(b, this.trCap[i]);
    i = head[middle];
    for (;;) { const a = parent[i]; if (a === TERMINAL) break; b = Math.min(b, rCap[a]); i = head[a]; }
    b = Math.min(b, -this.trCap[i]);
    rCap[middle ^ 1] += b; rCap[middle] -= b;
    i = head[middle ^ 1];
    for (;;) {
      const a = parent[i]; if (a === TERMINAL) break;
      rCap[a] += b; rCap[a ^ 1] -= b;
      if (rCap[a ^ 1] === 0) this.makeOrphan(i);
      i = head[a];
    }
    this.trCap[i] -= b; if (this.trCap[i] === 0) this.makeOrphan(i);
    i = head[middle];
    for (;;) {
      const a = parent[i]; if (a === TERMINAL) break;
      rCap[a ^ 1] += b; rCap[a] -= b;
      if (rCap[a] === 0) this.makeOrphan(i);
      i = head[a];
    }
    this.trCap[i] += b; if (this.trCap[i] === 0) this.makeOrphan(i);
    this.flow += b;
  }
  originDist(j) {
    const { parent, head, ts, dist } = this, time = this.time;
    let d = 0, k = j;
    for (;;) {
      if (ts[k] === time) { d += dist[k]; break; }
      const a = parent[k]; d += 1;
      if (a === TERMINAL) { ts[k] = time; dist[k] = 1; break; }
      if (a === ORPHAN || a === NONE) return -1;
      k = head[a];
    }
    let dd = d; k = j;
    while (ts[k] !== time) { ts[k] = time; dist[k] = dd; dd--; k = head[parent[k]]; }
    return d;
  }
  adopt() {
    const { parent, head, next, rCap, isSink, ts, dist, first } = this;
    while (this.on) {
      const i = this.o[this.oh]; this.oh = (this.oh + 1) % this.o.length; this.on--;
      const sink = isSink[i];
      let best = NONE, bestD = 0xffffffff, a = first[i];
      while (a !== NONE) {
        const cap = sink ? rCap[a] : rCap[a ^ 1];
        if (cap > 0) {
          const j = head[a];
          if (isSink[j] === sink && parent[j] !== NONE) { const d = this.originDist(j); if (d >= 0 && d < bestD) { best = a; bestD = d; } }
        }
        a = next[a];
      }
      if (best !== NONE) { parent[i] = best; ts[i] = this.time; dist[i] = bestD + 1; continue; }
      ts[i] = 0;
      a = first[i];
      while (a !== NONE) {
        const j = head[a];
        if (isSink[j] === sink && parent[j] !== NONE) {
          const cap = sink ? rCap[a] : rCap[a ^ 1];
          if (cap > 0) this.setActive(j);
          const pa = parent[j];
          if (pa !== TERMINAL && pa !== ORPHAN && head[pa] === i) this.makeOrphan(j);
        }
        a = next[a];
      }
      parent[i] = NONE;
    }
  }
  source(i) { return this.parent[i] !== NONE && !this.isSink[i]; }
}

// ------------------------------------------------------------------ matte utilities (roto/matting.rs)
const BIG = 1e12;
function dt1(f, n, d, v, z) {
  if (!n) return;
  const ff = q => f[q] + q * q;
  let k = 0; v[0] = 0; z[0] = -Infinity; z[1] = Infinity;
  for (let q = 1; q < n; q++) {
    let s = (ff(q) - ff(v[k])) / (2 * (q - v[k]));
    while (s <= z[k]) { if (k === 0) break; k--; s = (ff(q) - ff(v[k])) / (2 * (q - v[k])); }
    k++; v[k] = q; z[k] = s; z[k + 1] = Infinity;
  }
  k = 0;
  for (let q = 0; q < n; q++) { while (z[k + 1] < q) k++; const p = v[k], dd = q - p; d[q] = dd * dd + f[p]; }
}
// Euclidean distance from every pixel to the nearest one where seed is set
function distance(seed, w, h) {
  const n = w * h, g = new Float32Array(n); if (!n) return g;
  for (let i = 0; i < n; i++) g[i] = seed[i] ? 0 : BIG;
  const m = Math.max(w, h), f = new Float64Array(m), d = new Float64Array(m), v = new Int32Array(m), z = new Float64Array(m + 1);
  for (let x = 0; x < w; x++) { for (let y = 0; y < h; y++) f[y] = g[y * w + x]; dt1(f, h, d, v, z); for (let y = 0; y < h; y++) g[y * w + x] = d[y]; }
  for (let y = 0; y < h; y++) { const o = y * w; for (let x = 0; x < w; x++) f[x] = g[o + x]; dt1(f, w, d, v, z); for (let x = 0; x < w; x++) g[o + x] = d[x]; }
  for (let i = 0; i < n; i++) g[i] = Math.sqrt(g[i]);
  return g;
}
// signed distance to a binary matte's edge: positive inside, negative outside
function signedDistance(m, w, h) {
  const n = w * h, fg = new Uint8Array(n), bg = new Uint8Array(n);
  for (let i = 0; i < n; i++) { if (m[i]) fg[i] = 1; else bg[i] = 1; }
  const din = distance(bg, w, h), dout = distance(fg, w, h), out = new Float32Array(n);
  for (let i = 0; i < n; i++) out[i] = m[i] ? din[i] - .5 : .5 - dout[i];
  return out;
}
// mean over the (2r+1)² window (averaging only the pixels inside)
function boxMean(src, w, h, r) {
  const n = w * h, out = new Float32Array(n); if (!n) return out;
  const tmp = new Float64Array(n);
  for (let y = 0; y < h; y++) {
    const o = y * w; let acc = 0;
    for (let x = 0; x < Math.min(r, w); x++) acc += src[o + x];
    for (let x = 0; x < w; x++) { if (x + r < w) acc += src[o + x + r]; if (x > r) acc -= src[o + x - r - 1]; tmp[o + x] = acc; }
  }
  const pre = new Float64Array(w * (h + 1));
  for (let y = 0; y < h; y++) { const a = y * w, b = (y + 1) * w; for (let x = 0; x < w; x++) pre[b + x] = pre[a + x] + tmp[a + x]; }
  for (let y = 0; y < h; y++) {
    const a = Math.max(0, y - r), b = Math.min(h, y + r + 1), cy = b - a;
    for (let x = 0; x < w; x++) { const cx = Math.min(x + r + 1, w) - Math.max(0, x - r); out[y * w + x] = (pre[b * w + x] - pre[a * w + x]) / (cx * cy); }
  }
  return out;
}
function gauss(src, w, h, sigma) {
  if (sigma < .3) return Float32Array.from(src);
  const r = Math.max(1, Math.round((Math.sqrt(4 * sigma * sigma + 1) - 1) / 2));
  return boxMean(boxMean(boxMean(src, w, h, r), w, h, r), w, h, r);
}
function inv3f(m) {
  let d = m[0] * (m[4] * m[8] - m[5] * m[7]) - m[1] * (m[3] * m[8] - m[5] * m[6]) + m[2] * (m[3] * m[7] - m[4] * m[6]);
  if (Math.abs(d) < 1e-20) d = 1e-20;
  return [(m[4] * m[8] - m[5] * m[7]) / d, (m[2] * m[7] - m[1] * m[8]) / d, (m[1] * m[5] - m[2] * m[4]) / d,
    (m[5] * m[6] - m[3] * m[8]) / d, (m[0] * m[8] - m[2] * m[6]) / d, (m[2] * m[3] - m[0] * m[5]) / d,
    (m[3] * m[7] - m[4] * m[6]) / d, (m[1] * m[6] - m[0] * m[7]) / d, (m[0] * m[4] - m[1] * m[3]) / d];
}
const chan = (rgb, c, n) => { const o = new Float32Array(n); for (let i = 0; i < n; i++) o[i] = rgb[i * 3 + c]; return o; };
const mul = (a, b) => { const o = new Float32Array(a.length); for (let i = 0; i < a.length; i++) o[i] = a[i] * b[i]; return o; };
// the colour guided filter of p with the guide rgb (He et al. 2010, 3.5)
function guidedFilter(rgb, p, w, h, r, eps) {
  const n = w * h, bm = v => boxMean(v, w, h, r), ir = chan(rgb, 0, n), ig = chan(rgb, 1, n), ib = chan(rgb, 2, n);
  const mr = bm(ir), mg = bm(ig), mb = bm(ib), mp = bm(p), mrp = bm(mul(ir, p)), mgp = bm(mul(ig, p)), mbp = bm(mul(ib, p));
  const vrr = bm(mul(ir, ir)), vrg = bm(mul(ir, ig)), vrb = bm(mul(ir, ib)), vgg = bm(mul(ig, ig)), vgb = bm(mul(ig, ib)), vbb = bm(mul(ib, ib));
  const a0 = new Float32Array(n), a1 = new Float32Array(n), a2 = new Float32Array(n), bb = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const c0 = mrp[i] - mr[i] * mp[i], c1 = mgp[i] - mg[i] * mp[i], c2 = mbp[i] - mb[i] * mp[i];
    const s01 = vrg[i] - mr[i] * mg[i], s02 = vrb[i] - mr[i] * mb[i], s12 = vgb[i] - mg[i] * mb[i];
    const v = inv3f([vrr[i] - mr[i] * mr[i] + eps, s01, s02, s01, vgg[i] - mg[i] * mg[i] + eps, s12, s02, s12, vbb[i] - mb[i] * mb[i] + eps]);
    const x0 = c0 * v[0] + c1 * v[3] + c2 * v[6], x1 = c0 * v[1] + c1 * v[4] + c2 * v[7], x2 = c0 * v[2] + c1 * v[5] + c2 * v[8];
    a0[i] = x0; a1[i] = x1; a2[i] = x2; bb[i] = mp[i] - x0 * mr[i] - x1 * mg[i] - x2 * mb[i];
  }
  const ma0 = bm(a0), ma1 = bm(a1), ma2 = bm(a2), mbb = bm(bb), out = new Float32Array(n);
  for (let i = 0; i < n; i++) out[i] = ma0[i] * ir[i] + ma1[i] * ig[i] + ma2[i] * ib[i] + mbb[i];
  return out;
}
// closed-form matting: the alpha minimising αᵀLα with the known pixels fixed, by conjugate gradients
function closedForm(rgb, init, known, w, h, r, eps, iters) {
  const n = w * h;
  if (!n || known.every(k => k)) return Float32Array.from(init);
  const bm = v => boxMean(v, w, h, r), ic = [chan(rgb, 0, n), chan(rgb, 1, n), chan(rgb, 2, n)], mu = ic.map(bm);
  const cov = [[], [], []];
  for (let a = 0; a < 3; a++) for (let b = a; b < 3; b++) { const m = bm(mul(ic[a], ic[b])); cov[a][b] = m; cov[b][a] = m; }
  const inv = new Float32Array(n * 9);
  for (let i = 0; i < n; i++) {
    const s = new Array(9);
    for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) s[a * 3 + b] = cov[a][b][i] - mu[a][i] * mu[b][i] + (a === b ? eps : 0);
    inv.set(inv3f(s), i * 9);
  }
  const cnt = new Float32Array(n);
  for (let i = 0; i < n; i++) { const x = i % w, y = (i / w) | 0; cnt[i] = (Math.min(x + r, w - 1) - Math.max(x - r, 0) + 1) * (Math.min(y + r, h - 1) - Math.max(y - r, 0) + 1); }
  const ab0 = new Float32Array(n), ab1 = new Float32Array(n), ab2 = new Float32Array(n), ab3 = new Float32Array(n);
  const lap = x => {
    const pm = bm(x), ipm = [0, 1, 2].map(c => bm(mul(ic[c], x)));
    for (let i = 0; i < n; i++) {
      const c0 = ipm[0][i] - mu[0][i] * pm[i], c1 = ipm[1][i] - mu[1][i] * pm[i], c2 = ipm[2][i] - mu[2][i] * pm[i], o = i * 9;
      const a0 = inv[o] * c0 + inv[o + 1] * c1 + inv[o + 2] * c2, a1 = inv[o + 3] * c0 + inv[o + 4] * c1 + inv[o + 5] * c2, a2 = inv[o + 6] * c0 + inv[o + 7] * c1 + inv[o + 8] * c2;
      ab0[i] = a0; ab1[i] = a1; ab2[i] = a2; ab3[i] = pm[i] - a0 * mu[0][i] - a1 * mu[1][i] - a2 * mu[2][i];
    }
    const s0 = bm(ab0), s1 = bm(ab1), s2 = bm(ab2), sb = bm(ab3), out = new Float32Array(n);
    for (let i = 0; i < n; i++) out[i] = cnt[i] * (x[i] - s0[i] * ic[0][i] - s1[i] * ic[1][i] - s2[i] * ic[2][i] - sb[i]);
    return out;
  };
  const a0 = new Float32Array(n); for (let i = 0; i < n; i++) if (known[i]) a0[i] = init[i];
  const la0 = lap(a0), x = new Float32Array(n); for (let i = 0; i < n; i++) if (!known[i]) x[i] = init[i];
  const lx = lap(x), res = new Float64Array(n);
  for (let i = 0; i < n; i++) res[i] = known[i] ? 0 : -la0[i] - lx[i];
  const p = Float64Array.from(res); let rs = 0; for (let i = 0; i < n; i++) rs += res[i] * res[i];
  const rs0 = Math.max(rs, 1e-30), pf = new Float32Array(n);
  for (let it = 0; it < iters; it++) {
    if (rs <= rs0 * 1e-8) break;
    for (let i = 0; i < n; i++) pf[i] = p[i];
    const ap = lap(pf); let pap = 0;
    for (let i = 0; i < n; i++) { if (known[i]) ap[i] = 0; pap += p[i] * ap[i]; }
    if (pap <= 1e-30) break;
    const alpha = rs / pap; let rsNew = 0;
    for (let i = 0; i < n; i++) { x[i] += alpha * p[i]; res[i] -= alpha * ap[i]; rsNew += res[i] * res[i]; }
    const beta = rsNew / rs; rs = rsNew;
    for (let i = 0; i < n; i++) p[i] = res[i] + beta * p[i];
  }
  const out = new Float32Array(n); for (let i = 0; i < n; i++) out[i] = known[i] ? init[i] : Math.min(1, Math.max(0, x[i]));
  return out;
}
function contrast(a, pc) { if (pc <= 0) return; const k = 1 / (1 - .99 * Math.min(1, Math.max(0, pc / 100))); for (let i = 0; i < a.length; i++) a[i] = Math.min(1, Math.max(0, .5 + (a[i] - .5) * k)); }
function shiftSoft(a, pc) { if (Math.abs(pc) < 1e-9) return; const g = Math.pow(2, -pc / 50); for (let i = 0; i < a.length; i++) a[i] = Math.pow(Math.min(1, Math.max(0, a[i])), g); }
// estimate each listed pixel's pure foreground colour from nearby pure background / foreground (I = αF + (1 − α)B)
function decontaminatePx(rgb, alpha, region, w, h, radius, amount) {
  const n = w * h, map = new Float32Array(n);
  let any = false; for (let i = 0; i < n; i++) if (region[i]) { any = true; break; }
  if (!any || amount <= 0) return map;
  const lo = new Float32Array(n), hi = new Float32Array(n);
  for (let i = 0; i < n; i++) { lo[i] = alpha[i] < .02 ? 1 : 0; hi[i] = alpha[i] > .98 ? 1 : 0; }
  const est = m => {
    const out = new Float32Array(n * 3), has = new Uint8Array(n); let r = Math.max(2, radius);
    for (let pass = 0; pass < 4; pass++) {
      const cnt = boxMean(m, w, h, r), sums = [0, 1, 2].map(c => { const v = new Float32Array(n); for (let i = 0; i < n; i++) v[i] = rgb[i * 3 + c] * m[i]; return boxMean(v, w, h, r); });
      let missing = false;
      for (let i = 0; i < n; i++) if (region[i] && !has[i]) {
        if (cnt[i] > 1e-4) { has[i] = 1; out[i * 3] = sums[0][i] / cnt[i]; out[i * 3 + 1] = sums[1][i] / cnt[i]; out[i * 3 + 2] = sums[2][i] / cnt[i]; }
        else missing = true;
      }
      if (!missing) break; r *= 2;
    }
    return [out, has];
  };
  const [bgc, bgh] = est(lo), [fgc, fgh] = est(hi);
  for (let i = 0; i < n; i++) {
    if (!region[i]) continue;
    const a = Math.min(1, Math.max(0, alpha[i])); if (a <= 0 || a >= 1) continue;
    const c = [rgb[i * 3], rgb[i * 3 + 1], rgb[i * 3 + 2]]; let f;
    if (bgh[i]) {
      f = [0, 1, 2].map(k => Math.min(1, Math.max(0, (c[k] - (1 - a) * bgc[i * 3 + k]) / a)));
      if (fgh[i]) { const t = Math.min(1, Math.max(0, (.25 - a) / .25)); for (let k = 0; k < 3; k++) f[k] += (fgc[i * 3 + k] - f[k]) * t; }
    } else if (fgh[i]) f = [fgc[i * 3], fgc[i * 3 + 1], fgc[i * 3 + 2]];
    else f = c;
    let d = 0;
    for (let k = 0; k < 3; k++) { const v = c[k] + (f[k] - c[k]) * amount; d = Math.max(d, Math.abs(v - c[k])); rgb[i * 3 + k] = v; }
    map[i] = Math.min(1, d);
  }
  return map;
}
function sample(p, w, h, x, y) {
  if (!w || !h) return 0;
  const fx = Math.min(w - 1, Math.max(0, x - .5)), fy = Math.min(h - 1, Math.max(0, y - .5)), x0 = Math.floor(fx), y0 = Math.floor(fy);
  const x1 = Math.min(x0 + 1, w - 1), y1 = Math.min(y0 + 1, h - 1), tx = fx - x0, ty = fy - y0;
  const top = p[y0 * w + x0] + (p[y0 * w + x1] - p[y0 * w + x0]) * tx, bot = p[y1 * w + x0] + (p[y1 * w + x1] - p[y1 * w + x0]) * tx;
  return top + (bot - top) * ty;
}
function motionBlur(a, w, h, v, samples) {
  const n = Math.max(2, samples); if (Math.hypot(v[0], v[1]) < .25) return Float32Array.from(a);
  const out = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) {
    const x = i % w + .5, y = ((i / w) | 0) + .5; let s = 0;
    for (let k = 0; k < n; k++) { const t = k / (n - 1) - .5; s += sample(a, w, h, x - v[0] * t, y - v[1] * t); }
    out[i] = s / n;
  }
  return out;
}

// ------------------------------------------------------------------ optical flow (raster/flow.rs, block matching)
function planeLuma(img) { const n = img.w * img.h, d = new Float32Array(n), c = img.rgb, a = img.a; for (let i = 0; i < n; i++) d[i] = (.2126 * c[i * 3] + .7152 * c[i * 3 + 1] + .0722 * c[i * 3 + 2] + .25) * a[i]; return { w: img.w, h: img.h, d }; }
function planeHalf(p) {
  const w = Math.max(1, p.w >> 1), h = Math.max(1, p.h >> 1), d = new Float32Array(w * h), W = p.w, H = p.h, s = p.d;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const X = x * 2, Y = y * 2, g = (dx, dy) => s[Math.min(Y + dy, H - 1) * W + Math.min(X + dx, W - 1)];
    d[y * w + x] = (g(0, 0) + g(1, 0) + g(0, 1) + g(1, 1)) * .25;
  }
  return { w, h, d };
}
function sad(a, b, bx, by, bs, dx, dy) {
  let s = 0; const aw = a.w, ah = a.h, bw = b.w, bh = b.h, ad = a.d, bd = b.d;
  for (let y = by; y < by + bs; y++) {
    const ya = (y < 0 ? 0 : y >= ah ? ah - 1 : y) * aw, yb0 = y + dy, yb = (yb0 < 0 ? 0 : yb0 >= bh ? bh - 1 : yb0) * bw;
    for (let x = bx; x < bx + bs; x++) { const xa = x < 0 ? 0 : x >= aw ? aw - 1 : x, xb0 = x + dx, xb = xb0 < 0 ? 0 : xb0 >= bw ? bw - 1 : xb0; s += Math.abs(ad[ya + xa] - bd[yb + xb]); }
  }
  return s;
}
// block-matching flow from a to b (one vector per block × block tile, a → b)
function blockFlow(A, B, block, radius) {
  const bs = Math.max(2, block), win = Math.max(4, block), wo = (bs >> 1) - (win >> 1), w = A.w, h = A.h;
  const cols = Math.max(1, Math.ceil(w / bs)), rows = Math.max(1, Math.ceil(h / bs)), v = new Float32Array(cols * rows * 2);
  const flow = { block: bs, cols, rows, v };
  if (A.w !== B.w || A.h !== B.h || w < bs || h < bs || w < win || h < win) return flow;
  const pa = [planeLuma(A)], pb = [planeLuma(B)], big = Math.max(bs, win) * 2;
  while (pa.length < 4 && (pa.at(-1).w >> 1) >= big && (pa.at(-1).h >> 1) >= big) { pa.push(planeHalf(pa.at(-1))); pb.push(planeHalf(pb.at(-1))); }
  const top = pa.length - 1, N = cols * rows;
  let cur = new Int32Array(N * 2);
  for (let level = top; level >= 0; level--) {
    const la = pa[level], lb = pb[level], k = 1 << level, lbs = Math.max(4, Math.trunc(win / k)), r = level === top ? radius : 1, prev = cur;
    cur = new Int32Array(N * 2);
    for (let i = 0; i < N; i++) {
      const c = i % cols, rr = (i / cols) | 0, bx = Math.trunc((c * bs + wo) / k), by = Math.trunc((rr * bs + wo) / k);
      const seeds = [[0, 0]];
      if (level !== top) for (const [dc, dr] of [[0, 0], [-1, 0], [1, 0], [0, -1], [0, 1]]) {
        const nc = c + dc, nr = rr + dr;
        if (nc >= 0 && nr >= 0 && nc < cols && nr < rows) { const j = (nr * cols + nc) * 2; seeds.push([prev[j] * 2, prev[j + 1] * 2]); }
      }
      seeds.sort((p, q) => p[0] - q[0] || p[1] - q[1]);
      let bx0 = 0, by0 = 0, be = Infinity, last = null;
      for (const s of seeds) {
        if (last && last[0] === s[0] && last[1] === s[1]) continue; last = s;
        for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
          const d0 = s[0] + dx, d1 = s[1] + dy, e = Math.fround(sad(la, lb, bx, by, lbs, d0, d1) + 1e-4 * (Math.abs(d0) + Math.abs(d1)));
          if (e < be) { be = e; bx0 = d0; by0 = d1; }
        }
      }
      cur[i * 2] = bx0; cur[i * 2 + 1] = by0;
    }
  }
  const la = pa[0], lb = pb[0], fine = new Float32Array(N * 2);
  for (let i = 0; i < N; i++) {
    const bx = (i % cols) * bs + wo, by = ((i / cols) | 0) * bs + wo, d0 = cur[i * 2], d1 = cur[i * 2 + 1], e0 = sad(la, lb, bx, by, win, d0, d1);
    const fit = (em, ep) => { const den = em - 2 * e0 + ep; return den > 1e-6 ? Math.min(.5, Math.max(-.5, .5 * (em - ep) / den)) : 0; };
    fine[i * 2] = d0 + fit(sad(la, lb, bx, by, win, d0 - 1, d1), sad(la, lb, bx, by, win, d0 + 1, d1));
    fine[i * 2 + 1] = d1 + fit(sad(la, lb, bx, by, win, d0, d1 - 1), sad(la, lb, bx, by, win, d0, d1 + 1));
  }
  for (let i = 0; i < N; i++) {
    const c = i % cols, r = (i / cols) | 0, xs = [], ys = [];
    for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) { const nc = c + dc, nr = r + dr; if (nc >= 0 && nr >= 0 && nc < cols && nr < rows) { xs.push(fine[(nr * cols + nc) * 2]); ys.push(fine[(nr * cols + nc) * 2 + 1]); } }
    xs.sort((a, b) => a - b); ys.sort((a, b) => a - b);
    v[i * 2] = xs[xs.length >> 1]; v[i * 2 + 1] = ys[ys.length >> 1];
  }
  return flow;
}
function flowAt(F, x, y) {
  const b = F.block, fx = Math.min(F.cols - 1, Math.max(0, x / b - .5)), fy = Math.min(F.rows - 1, Math.max(0, y / b - .5));
  const x0 = Math.floor(fx), y0 = Math.floor(fy), x1 = Math.min(x0 + 1, F.cols - 1), y1 = Math.min(y0 + 1, F.rows - 1), tx = fx - x0, ty = fy - y0, o = [0, 0];
  for (let k = 0; k < 2; k++) {
    const g = (c, r) => F.v[(r * F.cols + c) * 2 + k];
    const top = g(x0, y0) + (g(x1, y0) - g(x0, y0)) * tx, bot = g(x0, y1) + (g(x1, y1) - g(x0, y1)) * tx; o[k] = top + (bot - top) * ty;
  }
  return o;
}

// ------------------------------------------------------------------ strokes (roto.rs)
const ON = 1, OFF = 2, HARD_FG = ON, HARD_BG = OFF;
function segDist(px, py, a, b) {
  const dx = b[0] - a[0], dy = b[1] - a[1], l2 = dx * dx + dy * dy;
  const t = l2 > 0 ? Math.min(1, Math.max(0, ((px - a[0]) * dx + (py - a[1]) * dy) / l2)) : 0;
  return Math.hypot(px - a[0] - dx * t, py - a[1] - dy * t);
}
// every pixel a stroke covers (at the matte's scale); strokes are { k: 'fg'|'bg'|'refine'|'erase', r, p: [[x, y], …] } in layer pixels
function sweep(s, scale, w, h, paint) {
  const pts = s.p.map(p => [p[0] * scale, p[1] * scale]), r = Math.max(.5, s.r * scale);
  const segs = pts.length === 1 ? [[pts[0], pts[0]]] : pts.slice(1).map((p, i) => [pts[i], p]);
  for (const [a, b] of segs) {
    const x0 = Math.max(0, Math.floor(Math.min(a[0], b[0]) - r)), x1 = Math.min(w, Math.ceil(Math.max(a[0], b[0]) + r));
    const y0 = Math.max(0, Math.floor(Math.min(a[1], b[1]) - r)), y1 = Math.min(h, Math.ceil(Math.max(a[1], b[1]) + r));
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) if (segDist(x + .5, y + .5, a, b) <= r) paint(y * w + x);
  }
}
// ON where an `on` stroke covers a pixel, OFF where an `off` one does; the last one painted wins
function resolve(strokes, on, off, scale, w, h) {
  const m = new Uint8Array(w * h);
  for (const s of strokes) { const v = s.k === on ? ON : s.k === off ? OFF : 0; if (v) sweep(s, scale, w, h, i => { m[i] = v; }); }
  return m;
}

// ------------------------------------------------------------------ segmentation (roto.rs)
const GAMMA = 50, PRIOR = 1, K = 16, INF = 2 ** 40, COMPONENTS = 5, MAX_SAMPLES = 24000;
const NB = [[1, 0, 1], [0, 1, 1], [1, 1, 1], [-1, 1, 1], [-1, 0, 0], [0, -1, 0], [-1, -1, 0], [1, -1, 0]];
function beta(rgb, free, w, h) {
  let s = 0, n = 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x; if (!free[i]) continue;
    for (const [dx, dy] of [[1, 0], [0, 1]]) {
      const nx = x + dx, ny = y + dy;
      if (nx < w && ny < h) { const j = ny * w + nx, a = Math.fround(rgb[i * 3] - rgb[j * 3]), b = Math.fround(rgb[i * 3 + 1] - rgb[j * 3 + 1]), c = Math.fround(rgb[i * 3 + 2] - rgb[j * 3 + 2]); s += Math.fround(a * a + b * b + c * c); n++; }
    }
  }
  return s <= 1e-12 ? 1 : n / (2 * s);
}
// one min cut over the free pixels (the others keep their labels); prior: [P(foreground) per pixel, its weight]
function cut(rgb, w, h, labels, free, hard, fg, bg, prior) {
  const N = w * h, idx = new Int32Array(N).fill(-1), nodes = [];
  for (let i = 0; i < N; i++) if (free[i]) { idx[i] = nodes.length; nodes.push(i); }
  if (!nodes.length) return;
  const b = beta(rgb, free, w, h), g = new Graph(nodes.length, nodes.length * 4), SQ2 = Math.SQRT2;
  for (let n = 0; n < nodes.length; n++) {
    const i = nodes[n], x = i % w, y = (i / w) | 0, r0 = rgb[i * 3], g0 = rgb[i * 3 + 1], b0 = rgb[i * 3 + 2];
    let cf = fg.cost(r0, g0, b0), cb = bg.cost(r0, g0, b0);
    if (prior) { const pf = Math.min(.98, Math.max(.02, prior[0][i])); cf += prior[1] * -Math.log(pf); cb += prior[1] * -Math.log(1 - pf); }
    const m = Math.min(cf, cb); let src = Math.round((cb - m) * K), snk = Math.round((cf - m) * K);
    if (hard[i] === HARD_FG) { src = INF; snk = 0; } else if (hard[i] === HARD_BG) { src = 0; snk = INF; }
    g.addT(n, src, snk);
    for (const [dx, dy, fwd] of NB) {
      const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      const j = ny * w + nx, a = Math.fround(r0 - rgb[j * 3]), bb = Math.fround(g0 - rgb[j * 3 + 1]), c = Math.fround(b0 - rgb[j * 3 + 2]);
      const d2 = Math.fround(a * a + bb * bb + c * c), dist = dx && dy ? SQ2 : 1, wt = Math.round(GAMMA / dist * Math.exp(-b * d2) * K) | 0;
      if (wt <= 0) continue;
      if (idx[j] < 0) { if (labels[j]) g.addT(n, wt, 0); else g.addT(n, 0, wt); }
      else if (fwd) g.addEdge(n, idx[j], wt, wt);
    }
  }
  g.maxflow();
  for (let n = 0; n < nodes.length; n++) labels[nodes[n]] = g.source(n) ? 1 : 0;
}
function samples(rgb, n, sel) {
  let c = 0; for (let i = 0; i < n; i++) if (sel(i)) c++;
  const out = new Float32Array(c * 3); let k = 0;
  for (let i = 0; i < n; i++) if (sel(i)) { out[k++] = rgb[i * 3]; out[k++] = rgb[i * 3 + 1]; out[k++] = rgb[i * 3 + 2]; }
  return out;
}
function fitModels(rgb, labels) { const n = labels.length; return [Gmm.fit(samples(rgb, n, i => labels[i] !== 0), COMPONENTS, MAX_SAMPLES), Gmm.fit(samples(rgb, n, i => labels[i] === 0), COMPONENTS, MAX_SAMPLES)]; }
// keep the foreground parts that touch the seeds; fill small enclosed holes (under 2 % of the foreground)
function clean(labels, seeds, bgSeeds, w, h) {
  const n = w * h, comp = new Int32Array(n).fill(-1), HOLE = -2, stack = [];
  let fgArea = 0;
  for (let start = 0; start < n; start++) {
    if (comp[start] !== -1) continue;
    const lab = labels[start]; comp[start] = start; stack.push(start);
    const members = []; let seeded = false, edge = false, bgs = false;
    while (stack.length) {
      const i = stack.pop(); members.push(i);
      seeded ||= !!seeds[i]; bgs ||= !!bgSeeds[i];
      const x = i % w, y = (i / w) | 0; edge ||= x === 0 || y === 0 || x === w - 1 || y === h - 1;
      for (const [dx, dy] of NB) {
        const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const j = ny * w + nx; if (comp[j] === -1 && labels[j] === lab) { comp[j] = start; stack.push(j); }
      }
    }
    if (lab) { if (seeded) fgArea += members.length; else for (const i of members) labels[i] = 0; }
    else if (!edge && !bgs) for (const i of members) comp[i] = HOLE;
  }
  const seen = new Uint8Array(n);
  for (let start = 0; start < n; start++) {
    if (comp[start] !== HOLE || seen[start] || labels[start]) continue;
    const members = [start]; seen[start] = 1;
    for (let k = 0; k < members.length; k++) {
      const i = members[k], x = i % w, y = (i / w) | 0;
      for (const [dx, dy] of NB) {
        const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const j = ny * w + nx; if (!seen[j] && comp[j] === HOLE && !labels[j]) { seen[j] = 1; members.push(j); }
      }
    }
    const enclosed = members.every(i => {
      const x = i % w, y = (i / w) | 0;
      return NB.every(([dx, dy]) => { const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= w || ny >= h) return false; const j = ny * w + nx; return labels[j] !== 0 || comp[j] === HOLE; });
    });
    if (enclosed && members.length < .02 * fgArea) for (const i of members) labels[i] = 1;
  }
}
function downsampleRgb(rgb, w, h, f) {
  const cw = Math.ceil(w / f), ch = Math.ceil(h / f), out = new Float32Array(cw * ch * 3);
  for (let cy = 0; cy < ch; cy++) for (let cx = 0; cx < cw; cx++) {
    let s0 = 0, s1 = 0, s2 = 0, n = 0;
    for (let y = cy * f; y < Math.min((cy + 1) * f, h); y++) for (let x = cx * f; x < Math.min((cx + 1) * f, w); x++) { const i = (y * w + x) * 3; s0 += rgb[i]; s1 += rgb[i + 1]; s2 += rgb[i + 2]; n++; }
    const o = (cy * cw + cx) * 3; out[o] = s0 / n; out[o + 1] = s1 / n; out[o + 2] = s2 / n;
  }
  return [out, cw, ch];
}
function initialModels(rgb, hard, fgs, strokes, prior, opts, w, h) {
  const n = w * h;
  if (prior) {
    const f = Gmm.fit(samples(rgb, n, i => hard[i] === HARD_FG || (!hard[i] && prior.soft[i] >= .5)), COMPONENTS, MAX_SAMPLES);
    const b = Gmm.fit(samples(rgb, n, i => hard[i] === HARD_BG || (!hard[i] && prior.soft[i] < .5)), COMPONENTS, MAX_SAMPLES);
    return [f.isEmpty() ? prior.fg : f, b.isEmpty() ? prior.bg : b];
  }
  const fgc = samples(rgb, n, i => hard[i] === HARD_FG);
  let bgc = samples(rgb, n, i => hard[i] === HARD_BG);
  if (!bgc.length) {
    // no background strokes: what is far from the foreground strokes
    const d = distance(fgs, w, h), r = strokes.filter(s => s.k === 'fg').reduce((m, s) => Math.max(m, s.r), 1) * opts.scale;
    const far = Math.fround(Math.max(4 * r, .25 * Math.max(w, h)));
    bgc = samples(rgb, n, i => d[i] > far);
    if (!bgc.length) bgc = samples(rgb, n, i => hard[i] !== HARD_FG);
  }
  return [Gmm.fit(fgc, COMPONENTS, MAX_SAMPLES), Gmm.fit(bgc, COMPONENTS, MAX_SAMPLES)];
}
// pixels deep inside a soft matte (more than r from its edge), else the matte itself
function coreOf(soft, w, h, r) {
  const n = w * h, bin = new Uint8Array(n); for (let i = 0; i < n; i++) bin[i] = soft[i] >= .5 ? 1 : 0;
  const sd = signedDistance(bin, w, h), core = new Uint8Array(n); let any = false;
  for (let i = 0; i < n; i++) if (sd[i] > r) { core[i] = 1; any = true; }
  return any ? core : bin;
}
function finish(img, rgb, labels, strokes, warpedRefine, opts, refineRadius) {
  const w = img.w, h = img.h, n = w * h, [fg, bg] = fitModels(rgb, labels);
  const painted = resolve(strokes, 'refine', 'erase', opts.scale, w, h);
  const near = warpedRefine && warpedRefine.some(v => v) ? signedDistance(labels, w, h) : null;
  const rr = Math.fround(refineRadius * opts.scale + 2), refine = new Uint8Array(n);
  for (let i = 0; i < n; i++) { const carried = !!(warpedRefine && near && warpedRefine[i] && Math.abs(near[i]) <= rr); refine[i] = (carried && painted[i] !== OFF) || painted[i] === ON ? 1 : 0; }
  return { w, h, matte: labels, refine, fg, bg };
}
// a frame from its strokes (and a propagated prior): GrabCut on a reduced copy, then a full-resolution cut in a band
function segment(img, strokes, prior, opts, refineRadius) {
  const w = img.w, h = img.h, n = w * h;
  if (!n) return { w, h, matte: new Uint8Array(0), refine: new Uint8Array(0), fg: new Gmm(), bg: new Gmm() };
  const rgb = img.rgb, hard = resolve(strokes, 'fg', 'bg', opts.scale, w, h);
  const fgs = new Uint8Array(n), bgs = new Uint8Array(n);
  for (let i = 0; i < n; i++) { fgs[i] = hard[i] === HARD_FG ? 1 : 0; bgs[i] = hard[i] === HARD_BG ? 1 : 0; }
  const softPrior = prior ? (prior.weight > PRIOR ? prior.soft : gauss(prior.soft, w, h, Math.max(1, opts.searchRadius * opts.scale / 4))) : null;
  const pw = prior ? prior.weight : PRIOR;
  let [fgm, bgm] = initialModels(rgb, hard, fgs, strokes, prior, opts, w, h);
  const iters = opts.best ? 4 : 3, work = opts.best ? 960 : 480, f = Math.max(1, Math.ceil(Math.max(w, h) / work));
  const labels = new Uint8Array(n);
  for (let i = 0; i < n; i++) labels[i] = hard[i] ? (hard[i] === HARD_FG ? 1 : 0) : softPrior ? (softPrior[i] >= .5 ? 1 : 0) : fgs[i];
  if (f > 1) {
    const [crgb, cw, ch] = downsampleRgb(rgb, w, h, f), chard = new Uint8Array(cw * ch), cprior = softPrior ? new Float32Array(cw * ch) : null;
    for (let cy = 0; cy < ch; cy++) for (let cx = 0; cx < cw; cx++) {
      let anyf = false, anyb = false, s = 0, k = 0;
      for (let y = cy * f; y < Math.min((cy + 1) * f, h); y++) for (let x = cx * f; x < Math.min((cx + 1) * f, w); x++) {
        const i = y * w + x; anyf ||= hard[i] === HARD_FG; anyb ||= hard[i] === HARD_BG; if (softPrior) s += softPrior[i]; k++;
      }
      chard[cy * cw + cx] = anyf && !anyb ? HARD_FG : anyb && !anyf ? HARD_BG : 0;
      if (cprior) cprior[cy * cw + cx] = s / k;
    }
    const cl = new Uint8Array(cw * ch);
    for (let i = 0; i < cw * ch; i++) cl[i] = cprior ? (cprior[i] >= .5 ? 1 : 0) : chard[i] === HARD_FG ? 1 : 0;
    const free = new Uint8Array(cw * ch).fill(1);
    for (let it = 0; it < iters; it++) {
      cut(crgb, cw, ch, cl, free, chard, fgm, bgm, cprior ? [cprior, pw] : null);
      if (it + 1 < iters) { const [a, b] = fitModels(crgb, cl); if (!a.isEmpty() && !b.isEmpty()) { fgm = a; bgm = b; } }
    }
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const i = y * w + x; labels[i] = hard[i] ? (hard[i] === HARD_FG ? 1 : 0) : cl[((y / f) | 0) * cw + ((x / f) | 0)]; }
    const [a, b] = fitModels(rgb, labels); if (!a.isEmpty() && !b.isEmpty()) { fgm = a; bgm = b; }
    // the full-resolution band
    const sd = signedDistance(labels, w, h), band = f + 1.5, freeB = new Uint8Array(n);
    for (let i = 0; i < n; i++) freeB[i] = Math.abs(sd[i]) <= band ? 1 : 0;
    cut(rgb, w, h, labels, freeB, hard, fgm, bgm, softPrior ? [softPrior, pw] : null);
  } else {
    const free = new Uint8Array(n).fill(1);
    for (let it = 0; it < iters; it++) {
      cut(rgb, w, h, labels, free, hard, fgm, bgm, softPrior ? [softPrior, pw] : null);
      if (it + 1 < iters) { const [a, b] = fitModels(rgb, labels); if (!a.isEmpty() && !b.isEmpty()) { fgm = a; bgm = b; } }
    }
  }
  const seeds = Uint8Array.from(fgs);
  if (softPrior) { const core = coreOf(softPrior, w, h, opts.searchRadius * opts.scale); for (let i = 0; i < n; i++) seeds[i] |= core[i]; }
  clean(labels, seeds, bgs, w, h);
  return finish(img, rgb, labels, strokes, prior ? prior.refine : null, opts, refineRadius);
}
// the previous frame's segmentation warped onto the next by optical flow (next → prev), Motion Threshold / Damping
function warpPrior(prevImg, prev, nextImg, opts) {
  const w = nextImg.w, h = nextImg.h, n = w * h, flow = blockFlow(nextImg, prevImg, 8, 4);
  const thr = Math.max(0, opts.motionThreshold / 100 * opts.searchRadius * opts.scale), damp = Math.min(1, Math.max(0, 1 - opts.motionDamping / 100));
  const src = new Float32Array(prev.matte.length); for (let i = 0; i < src.length; i++) src[i] = prev.matte[i];
  const same = prev.w === w && prev.h === h, soft = new Float32Array(n), refine = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    const x = i % w + .5, y = ((i / w) | 0) + .5, v = flowAt(flow, x, y); let vx = v[0], vy = v[1];
    if (Math.hypot(vx, vy) < thr) { vx *= damp; vy *= damp; }
    const sx = x + vx, sy = y + vy;
    soft[i] = same ? sample(src, prev.w, prev.h, sx, sy) : 0;
    const ix = Math.floor(Math.min(Math.max(prev.w, 1) - 1, Math.max(0, sx))), iy = Math.floor(Math.min(Math.max(prev.h, 1) - 1, Math.max(0, sy)));
    refine[i] = prev.refine[iy * prev.w + ix] || 0;
  }
  return { soft, fg: prev.fg, bg: prev.bg, refine, weight: PRIOR };
}
// propagate: warp the previous frame's segmentation, re-cut in a band of Search Radius pixels round the warped edge;
// strokes on the frame re-cut the whole frame with the warped matte as a soft prior instead
function propagate(prevImg, prev, nextImg, strokes, opts, refineRadius) {
  const w = nextImg.w, h = nextImg.h, n = w * h, prior = warpPrior(prevImg, prev, nextImg, opts);
  if (strokes.some(s => s.k === 'fg' || s.k === 'bg')) return segment(nextImg, strokes, prior, opts, refineRadius);
  const rgb = nextImg.rgb, labels = new Uint8Array(n); for (let i = 0; i < n; i++) labels[i] = prior.soft[i] >= .5 ? 1 : 0;
  const sd = signedDistance(labels, w, h), r = Math.fround(Math.max(2, opts.searchRadius * opts.scale)), free = new Uint8Array(n);
  for (let i = 0; i < n; i++) free[i] = Math.abs(sd[i]) <= r ? 1 : 0;
  const soft = gauss(prior.soft, w, h, Math.max(1, r / 4));
  const [fg, bg] = prev.fg.isEmpty() || prev.bg.isEmpty() ? fitModels(rgb, labels) : [prev.fg, prev.bg];
  cut(rgb, w, h, labels, free, new Uint8Array(n), fg, bg, [soft, PRIOR]);
  const seeds = coreOf(prior.soft, w, h, r);
  clean(labels, seeds, new Uint8Array(n), w, h);
  return finish(nextImg, rgb, labels, strokes, prior.refine, opts, refineRadius);
}

// ------------------------------------------------------------------ the soft matte (roto/refine.rs)
function shifted(seg, px) {
  const n = seg.w * seg.h, out = new Float32Array(n);
  if (Math.abs(px) < .25) { for (let i = 0; i < n; i++) out[i] = seg.matte[i]; return out; }
  const sd = signedDistance(seg.matte, seg.w, seg.h); for (let i = 0; i < n; i++) out[i] = sd[i] > -px ? 1 : 0;
  return out;
}
const centroid = s => { let sx = 0, sy = 0, n = 0; for (let i = 0; i < s.matte.length; i++) if (s.matte[i]) { sx += i % s.w + .5; sy += ((i / s.w) | 0) + .5; n++; } return n ? [sx / n, sy / n] : null; };
function matteAlpha(rgb, seg, prev, next, p, bandRadius, scale) {
  const w = seg.w, h = seg.h, n = w * h, same = s => s && s.w === w && s.h === h;
  prev = same(prev) ? prev : null; next = same(next) ? next : null;
  const shiftPx = p.rbShift / 100 * 10 * scale;
  let a = shifted(seg, shiftPx);
  const nb = [prev, next].filter(Boolean).map(s => shifted(s, shiftPx));
  if (p.rbChatter > 0 && nb.length) {
    const k = Math.min(1, Math.max(0, p.rbChatter / 100)) * (nb.length / (nb.length + 1));
    for (let i = 0; i < n; i++) { let m = 0; for (const v of nb) m += v[i]; m /= nb.length; a[i] += (m - a[i]) * k; }
  }
  if (p.rbFeather > 0) a = gauss(a, w, h, p.rbFeather * scale / 2);
  contrast(a, p.rbContrast);
  if (seg.refine.length === n && seg.refine.some(v => v)) {
    const r = Math.max(2, Math.round(bandRadius)), eps = Math.fround(2e-4 * (1 + Math.max(0, p.smooth)));
    let x0 = w, y0 = h, x1 = 0, y1 = 0;
    for (let i = 0; i < n; i++) if (seg.refine[i]) { const x = i % w, y = (i / w) | 0; x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x + 1); y1 = Math.max(y1, y + 1); }
    const pad = 2 * r + 2; x0 = Math.max(0, x0 - pad); y0 = Math.max(0, y0 - pad); x1 = Math.min(w, x1 + pad); y1 = Math.min(h, y1 + pad);
    const cw = x1 - x0, ch = y1 - y0, cn = cw * ch, cimg = new Float32Array(cn * 3), cp = new Float32Array(cn), band = new Uint8Array(cn), outside = new Uint8Array(cn);
    for (let j = 0; j < cn; j++) { const i = (y0 + ((j / cw) | 0)) * w + x0 + j % cw; cimg[j * 3] = rgb[i * 3]; cimg[j * 3 + 1] = rgb[i * 3 + 1]; cimg[j * 3 + 2] = rgb[i * 3 + 2]; cp[j] = a[i]; band[j] = seg.refine[i] ? 1 : 0; outside[j] = band[j] ? 0 : 1; }
    let q = guidedFilter(cimg, cp, cw, ch, r, eps);
    for (let j = 0; j < cn; j++) q[j] = band[j] ? Math.min(1, Math.max(0, q[j])) : cp[j];
    if (p.higherQuality) q = closedForm(cimg, q, outside, cw, ch, 1, Math.fround(1e-5 * (1 + Math.max(0, p.smooth))), 50);
    if (p.smooth > 1) q = gauss(q, cw, ch, (p.smooth - 1) * .5 * scale);
    if (p.feather > 0) q = gauss(q, cw, ch, p.feather * scale / 2);
    contrast(q, p.contrast); shiftSoft(q, p.shift);
    const din = distance(outside, cw, ch);
    for (let j = 0; j < cn; j++) { if (!band[j]) continue; const wgt = Math.min(1, Math.max(0, din[j] / 2)), i = (y0 + ((j / cw) | 0)) * w + x0 + j % cw; a[i] += (q[j] - a[i]) * wgt; }
    if (p.chatter > 0 && nb.length) {
      const k = Math.min(1, Math.max(0, p.chatter / 100)) * .5, soft = nb.map(v => gauss(v, w, h, Math.max(1, r / 2)));
      for (let i = 0; i < n; i++) if (seg.refine[i]) { let m = 0; for (const v of soft) m += v[i]; m /= soft.length; a[i] += (m - a[i]) * k; }
    }
  }
  if (p.motionBlur) {
    const c = centroid(seg), pa = prev && centroid(prev), nb2 = next && centroid(next);
    const v = pa && nb2 ? [(nb2[0] - pa[0]) / 2, (nb2[1] - pa[1]) / 2] : pa && c ? [c[0] - pa[0], c[1] - pa[1]] : nb2 && c ? [nb2[0] - c[0], nb2[1] - c[1]] : null;
    if (v) { const s = p.shutterAngle / 360; a = motionBlur(a, w, h, [v[0] * s, v[1] * s], p.mbSamples); }
  }
  for (let i = 0; i < n; i++) a[i] = Math.min(1, Math.max(0, a[i]));
  return a;
}
function decontaminate(rgb, alpha, band, w, h, p, bandRadius, scale) {
  const n = w * h; if (!p.decontaminate) return new Float32Array(n);
  const grow = p.increaseRadius * scale, has = band.length === n && band.some(v => v);
  let inBand;
  if (has && grow > .5) { const d = distance(band, w, h); inBand = new Uint8Array(n); for (let i = 0; i < n; i++) inBand[i] = d[i] <= grow ? 1 : 0; }
  else inBand = has ? band : new Uint8Array(n);
  const region = new Uint8Array(n); for (let i = 0; i < n; i++) region[i] = alpha[i] > .004 && alpha[i] < .996 && (inBand[i] || p.extendWhereSmoothed) ? 1 : 0;
  const radius = Math.round(Math.max(bandRadius + grow, 4 * scale));
  return decontaminatePx(rgb, alpha, region, w, h, radius, Math.min(1, Math.max(0, p.decontamination / 100)));
}

// ------------------------------------------------------------------ the outline for the overlay (marching squares)
// segments [x0, y0, x1, y1, …] in matte pixels along the 0.5 level of a 0/1 matte (pixel centres at +.5)
function outline(m, w, h) {
  const out = [], at = (x, y) => (x < 0 || y < 0 || x >= w || y >= h) ? 0 : m[y * w + x];
  for (let y = -1; y < h; y++) for (let x = -1; x < w; x++) {
    const a = at(x, y), b = at(x + 1, y), c = at(x + 1, y + 1), d = at(x, y + 1), code = a | b << 1 | c << 2 | d << 3;
    if (!code || code === 15) continue;
    const cx = x + 1, cy = y + 1, T = [cx, cy - .5], R = [cx + .5, cy], B = [cx, cy + .5], L = [cx - .5, cy], add = (p, q) => out.push(p[0], p[1], q[0], q[1]);
    switch (code) {
      case 1: case 14: add(L, T); break; case 2: case 13: add(T, R); break; case 3: case 12: add(L, R); break; case 4: case 11: add(R, B); break;
      case 5: add(L, T); add(R, B); break; case 6: case 9: add(T, B); break; case 7: case 8: add(L, B); break; case 10: add(T, R); add(L, B); break;
    }
  }
  return Float32Array.from(out);
}

// ------------------------------------------------------------------ the worker: frames in, mattes out
// IMGS: chain key → image (the last few, for propagation and Refine Edge); SEGS: chain key → segmentation
const IMGS = new Map(), SEGS = new Map(), IMG_MAX = 10;
let segBytes = 0; const SEG_MAX = 400 * 2 ** 20;
const lru = (m, k) => { const v = m.get(k); if (v !== undefined) { m.delete(k); m.set(k, v); } return v; };
function imgOf(o) {   // an 8-bit straight RGBA grid from the page
  const n = o.w * o.h, rgb = new Float32Array(n * 3), a = new Float32Array(n), d = o.d;
  for (let i = 0; i < n; i++) { rgb[i * 3] = d[i * 4] / 255; rgb[i * 3 + 1] = d[i * 4 + 1] / 255; rgb[i * 3 + 2] = d[i * 4 + 2] / 255; a[i] = d[i * 4 + 3] / 255; }
  return { w: o.w, h: o.h, rgb, a };
}
function putImg(k, img) { IMGS.delete(k); IMGS.set(k, img); while (IMGS.size > IMG_MAX) IMGS.delete(IMGS.keys().next().value); }
function putSeg(k, s, evicted) {
  const old = SEGS.get(k); if (old) { segBytes -= old.matte.length * 2; SEGS.delete(k); }
  SEGS.set(k, s); segBytes += s.matte.length * 2;
  while (segBytes > SEG_MAX && SEGS.size > 1) { const [ok, ov] = SEGS.entries().next().value; SEGS.delete(ok); segBytes -= ov.matte.length * 2; evicted.push(ok); }
}
function onStep(m) {
  const evicted = [];
  if (m.img) putImg(m.key, imgOf(m.img));
  if (m.prevImg) putImg(m.prevKey, imgOf(m.prevImg));
  const img = lru(IMGS, m.key); if (!img) return { need: 'img' };
  let seg;
  if (m.root) seg = segment(img, m.strokes, null, m.opts, m.rr);
  else {
    const prev = lru(SEGS, m.prevKey); if (!prev) return { need: 'seg' };
    const pimg = lru(IMGS, m.prevKey); if (!pimg) return { need: 'prev' };
    if (pimg.w !== img.w || pimg.h !== img.h) return { need: 'size' };
    seg = propagate(pimg, prev, img, m.strokes, m.opts, m.rr);
  }
  putSeg(m.key, seg, evicted);
  let area = 0; for (let i = 0; i < seg.matte.length; i++) area += seg.matte[i];
  return { ok: true, area, outline: outline(seg.matte, seg.w, seg.h), band: seg.refine.some(v => v) ? outline(seg.refine, seg.w, seg.h) : null, evicted };
}
// the final matte of a frame (with its neighbours' segmentations), and the decontaminated edge colours: alpha (8 bit),
// and for every partly see-through pixel its colour (and the decontamination map)
function onFinal(m) {
  if (m.img) putImg(m.key, imgOf(m.img));
  const img = lru(IMGS, m.key); if (!img) return { need: 'img' };
  let alpha, band;
  if (m.frozen) {   // frozen mattes: only the edge colours are worked out again
    const n = img.w * img.h; alpha = new Float32Array(n); for (let i = 0; i < n; i++) alpha[i] = m.frozen.a[i] / 255; band = m.frozen.b;
  } else {
    const seg = lru(SEGS, m.key); if (!seg) return { need: 'seg' };
    const nb = k => k ? SEGS.get(k) || null : null;
    alpha = matteAlpha(img.rgb, seg, nb(m.prevKey), nb(m.nextKey), m.mp, m.rr * m.scale, m.scale); band = seg.refine;
  }
  const w = img.w, h = img.h, n = w * h, rgb = Float32Array.from(img.rgb);
  const map = decontaminate(rgb, alpha, band, w, h, m.mp, m.rr * m.scale, m.scale);
  const a8 = new Uint8Array(n); let np = 0;
  for (let i = 0; i < n; i++) { const v = Math.round(alpha[i] * 255); a8[i] = v; if (v > 0 && v < 255) np++; }
  const idx = new Uint32Array(np), col = new Uint8Array(np * 3), mp8 = new Uint8Array(np); let k = 0;
  for (let i = 0; i < n; i++) { const v = a8[i]; if (v > 0 && v < 255) { idx[k] = i; col[k * 3] = Math.round(rgb[i * 3] * 255); col[k * 3 + 1] = Math.round(rgb[i * 3 + 1] * 255); col[k * 3 + 2] = Math.round(rgb[i * 3 + 2] * 255); mp8[k] = Math.round(map[i] * 255); k++; } }
  const out = { ok: true, w, h, a8, idx, col, map: mp8 };
  if (m.wantBand) out.b8 = Uint8Array.from(band);
  return out;
}
const OPS = {
  step: onStep, final: onFinal,
  has: m => ({ segs: m.keys.filter(k => SEGS.has(k)), imgs: m.keys.filter(k => IMGS.has(k)) }),
  clear: () => { IMGS.clear(); SEGS.clear(); segBytes = 0; return { ok: true }; },
  // the self-test's direct checks of the engine on made-up pictures
  test: m => {
    const img = imgOf(m.img), seg = segment(img, m.strokes, null, m.opts, 0);
    let out = { matte: seg.matte };
    if (m.next) { const nx = imgOf(m.next); out.next = propagate(img, seg, nx, [], m.opts, 0).matte; const F = blockFlow(nx, img, 8, 4); out.flow = flowAt(F, m.at[0], m.at[1]); }
    return out;
  },
  gmm: m => { const g = Gmm.fit(Float32Array.from(m.xs), 5, 24000); return { k: g.comps.length, near: g.cost(...m.a), far: g.cost(...m.b) }; },
  flowTest: m => { const g = new Graph(2, 1); g.addT(0, m.s0, 0); g.addT(1, 0, m.t1); g.addEdge(0, 1, m.c, m.c); const f = g.maxflow(); return { flow: f, a: g.source(0), b: g.source(1) }; },
};
if (typeof self !== 'undefined' && typeof WorkerGlobalScope !== 'undefined' && self instanceof WorkerGlobalScope) {
  self.onmessage = e => {
    const { id, op } = e.data; let res;
    try { res = OPS[op](e.data); } catch (err) { res = { error: String(err && err.stack || err) }; }
    const tr = [];
    for (const v of Object.values(res || {})) if (ArrayBuffer.isView(v)) tr.push(v.buffer);
    self.postMessage({ id, res }, tr);
  };
}
