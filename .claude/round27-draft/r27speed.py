import io
p = r'D:\Lumina\Lumina.html'
raw = io.open(p, 'rb').read(); crlf = b'\r\n' in raw
s = raw.decode('utf-8').replace('\r\n', '\n')
def rep(a, b):
    global s
    assert s.count(a) == 1, (a[:80], s.count(a)); s = s.replace(a, b)

# reused work arrays (grow only), so big sprite tables aren't made anew every frame
rep("""function fxPutSprite(R, i, stride, shape, x, y, r, c0, c1, c2, c3, rot = 0, dx = 0, dy = 0) {
  const o = i * stride, b = o + stride - 4;
  R[o] = shape;""", """const FX_SCRATCH = {};
const fxScratch = (name, n) => { let a = FX_SCRATCH[name]; if (!a || a.length < n) a = FX_SCRATCH[name] = new Float32Array(Math.ceil(n * 1.25) + 64); return a; };
function fxPutSprite(R, i, stride, shape, x, y, r, c0, c1, c2, c3, rot = 0, dx = 0, dy = 0) {
  const o = i * stride, b = o + stride - 4;
  if (b > o + 11) R.fill(0, o + 11, b);
  R[o] = shape;""")
rep("""      const at = nt + 1 + ni, d = new Float32Array(at + (b - a) * stride);""",
    """      const at = nt + 1 + ni, len = at + (b - a) * stride, d = fxScratch('spriteData', len).subarray(0, len);""")

# CC Rainfall: refracting drops need only the tint's first three fields (stride 18)
rep("""  const lw = E.bw, lh = E.bh, s = E.sc, t = E.t, ox = off[0] - lw * .5, oy = off[1] - lh * .5, m = E.m, lp = fxLpOf(E), sz = Math.max(size, .2), stride = 24, R = new Float32Array(n * stride);""",
    """  const lw = E.bw, lh = E.bh, s = E.sc, t = E.t, ox = off[0] - lw * .5, oy = off[1] - lh * .5, m = E.m, lp = fxLpOf(E), sz = Math.max(size, .2), stride = 18, R = fxScratch('sprites', n * stride);""")
rep("""  const lw = E.bw, lh = E.bh, s = E.sc, t = E.t, ox = off[0] - lw * .5, oy = off[1] - lh * .5, lp = fxLpOf(E), stride = 16, R = new Float32Array(n * stride);""",
    """  const lw = E.bw, lh = E.bh, s = E.sc, t = E.t, ox = off[0] - lw * .5, oy = off[1] - lh * .5, lp = fxLpOf(E), stride = 16, R = fxScratch('sprites', n * stride);""")
rep("""  const count = Math.floor(Math.min(lw * lh / 1000 * density * 10, 200000)), segs = 6, stride = 24, R = new Float32Array(count * segs * stride);""",
    """  const count = Math.floor(Math.min(lw * lh / 1000 * density * 10, 200000)), segs = 6, stride = 24, R = fxScratch('sprites', count * segs * stride);""")

# CC Star Burst: the grid, its scatter and its order are worked out once per layout; z = fract(h + c) keeps that order,
# turned round where h + c passes a whole number, so no frame sorts
OLD = s[s.index("// CC Star Burst (weather::star_burst_plan)"):s.index("// CC Hair (sim3::hair_plan)")]
NEW = r"""// CC Star Burst (weather::star_burst_plan): a grid of the layer's colours flying toward the viewer, drawn far to near.
// Depth z = fract(h + c) with the same c for every point, so the far-to-near order is the order of h, turned round where
// h + c passes a whole number: the grid is sorted once per layout (as a stable sort by z sorts it)
const SB_CACHE = { key: null };
function fxStarBurst(E, img, q) {
  const scatter = q('scatter'), speed = q('speed'), phase = q('phase') / 360, spacing = Math.max(1, q('spacing')), size = q('size') / 100, blend = q('blend') / 100;
  const seed = Math.imul(fxSeed(E), 0x3c6e) >>> 0, lw = E.bw, lh = E.bh, s = E.sc, t = E.t, m = E.m, hx = lw / 2, hy = lh / 2;
  const nx = Math.max(1, Math.ceil(lw / spacing)), ny = Math.max(1, Math.ceil(lh / spacing)), n = nx * ny, cx = lw * .5, cy = lh * .5, stride = 18;
  const key = [lw, lh, spacing, scatter, seed].join();
  if (SB_CACHE.key !== key) {
    const Hv = new Float32Array(n);
    for (let i = 0; i < n; i++) Hv[i] = fxH(i, 1, seed);
    const ord = fxSortF32(Hv), G = new Float32Array(n * 5);
    for (let k = 0; k < n; k++) {
      const i = ord[k], o = k * 5;
      G[o] = fxH(i, 1, seed); G[o + 1] = (i % nx) * spacing + spacing * .5; G[o + 2] = Math.floor(i / nx) * spacing + spacing * .5;
      G[o + 3] = fxHs(i, 2, seed) * scatter * .01 * lw * .5; G[o + 4] = fxHs(i, 3, seed) * scatter * .01 * lh * .5;
    }
    Object.assign(SB_CACHE, { key, G, n });
  }
  const G = SB_CACHE.G, c = t * speed * .25 + phase, fc = c - Math.floor(c);
  // the first point whose h + fract(c) reaches 1 (those are nearest the back now)
  let lo = 0, hi = n; while (lo < hi) { const mid = (lo + hi) >> 1; if (G[mid * 5] + fc >= 1) hi = mid; else lo = mid + 1; }
  const R = fxScratch('sprites', n * stride);
  for (let k = 0; k < n; k++) {
    const j = k < n - lo ? lo + k : k - (n - lo), o = j * 5, z = fxRem(G[o] + c, 1), persp = 1 / (1 - .9 * z), gx = G[o + 1], gy = G[o + 2];
    const ux = cx + (gx - cx + G[o + 3]) * persp - hx, uy = cy + (gy - cy + G[o + 4]) * persp - hy, ax = gx - hx, ay = gy - hy;
    fxPutSprite(R, k, stride, 1, m.a * ux + m.c * uy + m.e, m.b * ux + m.d * uy + m.f, spacing * .5 * size * persp * s, 0, 0, 0, Math.min(z * 8, 1) * Math.min((1 - z) * 6, 1));
    // the layer's colour at the grid point (none where it is clear)
    const r = k * stride; R[r + 11] = 2; R[r + 12] = m.a * ax + m.c * ay + m.e; R[r + 13] = m.b * ax + m.d * ay + m.f;
  }
  return fxSpritePost(E, img, fxSpriteTable(E, img, R, n, stride, false), blend > 0 ? ['lerp', blend] : ['replace']);
}
"""
rep(OLD, NEW)
if crlf: s = s.replace('\n', '\r\n')
io.open(p, 'wb').write(s.encode('utf-8')); print('ok')
