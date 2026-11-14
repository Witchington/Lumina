import io, os
p = r'D:\Lumina\Lumina.html'
raw = io.open(p, 'rb').read(); crlf = b'\r\n' in raw
s = raw.decode('utf-8').replace('\r\n', '\n')
def rep(a, b):
    global s
    assert s.count(a) == 1, (a[:80], s.count(a)); s = s.replace(a, b)

GLYPHS = io.open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'glyphs.js'), encoding='utf-8').read().strip()

# ---- fxChunked can draw over a picture already made (Particle Playground's Layer Map copies go over its dots)
rep("""function fxChunked(E, img, items, stride, fam, entry, u0, rec, f = {}, aux = null) {
  let base = E.clear(img), it = fxItems(E, stride), used = it.tiles.length + 1;""",
"""function fxChunked(E, img, items, stride, fam, entry, u0, rec, f = {}, aux = null, base0 = null) {
  let base = base0 || E.clear(img), it = fxItems(E, stride), used = it.tiles.length + 1;""")

HELPERS = r"""// ---- Round 27 helpers (Simulation: weather and more): EffectCraft's sim/weather.rs (CC Rainfall, CC Snowfall, CC Bubbles,
//      CC Drizzle, CC Star Burst), sim3.rs (CC Hair, Particle Playground) and textfx.rs (the stroke font); GPU host code from
//      fx_sim.rs (sprites, fxm_raster, fxm_post, fxm_drizzle) and fx_particles.rs (fxp_raster's passes) ----
const fxDepthK = (z, depth) => 1 / (1 + z * depth / 2500);              // weather::depth_k: 1 = nearest
const fxWrap = (v, lo, span) => span <= 0 ? v : lo + fxRem(v - lo, span);  // weather::wrap
const fxHs = (i, k, seed) => fxH(i, k, seed) * 2 - 1;                     // common::hs
// one sprite record as fx_sim::sprite_layer lays it out (shape, x, y, r, colour + opacity, rot, line dx dy, then the tint
// from field 11), its float bounds (sim::sprite_bbox) in the last four fields; NaN bounds = not drawn
function fxPutSprite(R, i, stride, shape, x, y, r, c0, c1, c2, c3, rot = 0, dx = 0, dy = 0) {
  const o = i * stride, b = o + stride - 4;
  R[o] = shape; R[o + 1] = x; R[o + 2] = y; R[o + 3] = r; R[o + 4] = c0; R[o + 5] = c1; R[o + 6] = c2; R[o + 7] = c3; R[o + 8] = rot; R[o + 9] = dx; R[o + 10] = dy;
  if (!(c3 > 1e-5) || !(r > 0)) { R[b] = NaN; return; }
  const e = Math.max(r, .5) + 1;
  if (shape === 8) { R[b] = Math.min(x, x + dx) - e; R[b + 1] = Math.min(y, y + dy) - e; R[b + 2] = Math.max(x, x + dx) + e; R[b + 3] = Math.max(y, y + dy) + e; }
  else { const k = shape === 5 ? e * 2 : e; R[b] = x - k; R[b + 1] = y - k; R[b + 2] = x + k; R[b + 3] = y + k; }
}
// Many sprites at once (fx_sim::sprite_layer through fx_particles' Chunked passes), from a typed table: R holds n records
// of `stride` floats (fxPutSprite). Drawn by fxp_raster over a transparent frame in their order (tints sample img), in a
// new pass whenever one kernel's data would grow past 16M floats
function fxSpriteTable(E, img, R, n, stride, add) {
  const W = E.w, H = E.h, tx = Math.ceil(W / 16), nt = tx * Math.ceil(H / 16), room = (1 << 24) - 64, span = new Int32Array(n);
  for (let i = 0; i < n; i++) {
    const o = i * stride + stride - 4, b0 = R[o], b1 = R[o + 1], b2 = R[o + 2], b3 = R[o + 3];
    if (!(Number.isFinite(b0) && Number.isFinite(b1) && Number.isFinite(b2) && Number.isFinite(b3))) continue;
    const x0 = Math.max(0, Math.floor(b0)), y0 = Math.max(0, Math.floor(b1)), x1 = Math.min(W - 1, Math.ceil(b2)), y1 = Math.min(H - 1, Math.ceil(b3));
    if (x1 < x0 || y1 < y0 || b2 < 0 || b3 < 0) continue;
    R[o] = x0; R[o + 1] = y0; R[o + 2] = x1; R[o + 3] = y1; span[i] = ((x1 >> 4) - (x0 >> 4) + 1) * ((y1 >> 4) - (y0 >> 4) + 1);
  }
  let base = E.clear(img), a = 0;
  while (a < n) {
    let b = a, used = nt + 1;
    while (b < n) { const need = span[b] + stride; if (used + need > room && b > a) break; used += need; b++; }
    const cnt = new Uint32Array(nt + 1);
    for (let i = a; i < b; i++) if (span[i]) {
      const o = i * stride + stride - 4;
      for (let ty = R[o + 1] >> 4; ty <= R[o + 3] >> 4; ty++) for (let tt = R[o] >> 4; tt <= R[o + 2] >> 4; tt++) cnt[ty * tx + tt]++;
    }
    let ni = 0; const off = new Uint32Array(nt + 1); for (let t = 0; t < nt; t++) { off[t] = ni; ni += cnt[t]; } off[nt] = ni;
    if (ni) {
      const at = nt + 1 + ni, d = new Float32Array(at + (b - a) * stride);
      for (let t = 0; t <= nt; t++) d[t] = nt + 1 + off[t];
      for (let i = a; i < b; i++) if (span[i]) {
        const o = i * stride + stride - 4;
        for (let ty = R[o + 1] >> 4; ty <= R[o + 3] >> 4; ty++) for (let tt = R[o] >> 4; tt <= R[o + 2] >> 4; tt++) d[nt + 1 + off[ty * tx + tt]++] = i - a;
      }
      d.set(R.subarray(a * stride, b * stride), at);
      const o = E.run('fx_particles', 'fxp_raster', fxP({ 0: [0, add ? 1 : 0, at, stride], 1: [tx, 0, 0, 0] }), img, base, null, E.data(d));
      E.free(base); base = o;
    }
    a = b;
  }
  return base;
}
// sim::Post: how the sprite layer meets the layer ('combine' with sim::combine's mode 0 Composite … 5 sprites only,
// 'lerp' toward the layer, 'replace'); fx_sim::sprites' fxm_post
function fxSpritePost(E, img, fx, post) {
  if (post[0] === 'replace') return fx;
  const P = post[0] === 'lerp' ? fxP({ 0: [1, 0, 0, 0] }, { 0: [post[1], 0, 0, 0] }) : fxP({ 0: [0, post[1], 0, 0] });
  const o = E.run('fx_particles', 'fxm_post', P, img, fx); E.free(fx); return o;
}
const fxWeatherPost = (mode, withOrig) => withOrig ? ['combine', mode === 1 ? 3 : 0] : ['replace'];   // weather::weather_post
const WEATHER_K = [['fx_particles', 'fxp_raster'], ['fx_particles', 'fxm_post'], ['kernels', 'fill']];
// a layer point (layer pixels) → frame pixels, with the matrix read once (fxLp in a loop)
const fxLpOf = E => { const m = E.m, hx = E.bw / 2, hy = E.bh / 2; return (x, y) => [m.a * (x - hx) + m.c * (y - hy) + m.e, m.b * (x - hx) + m.d * (y - hy) + m.f]; };
// sim3::MapImg: another layer stretched over this layer, sampled in this layer's pixels (unpremultiplied [r, g, b, a]),
// read back from the graphics card at timeline time T; `key` hashes what was read (sim3::image_key)
function fxMapImg(E, id, name, T, max = 640) {
  const M = id ? byId(id) : null; if (!M || M === E.L || !DRAW[M.kind]) return null;
  const tex = fxLayerAt(E, id, name, T), r = RT[id], m = r?.m; if (!tex || !m) return null;
  const R = E.read(tex, max), d = R.d, W = R.w, H = R.h, k = R.k, mw = r.box?.w || E.w, mh = r.box?.h || E.h;
  const kx = mw / Math.max(E.bw, 1e-9), ky = mh / Math.max(E.bh, 1e-9);
  let key = 0x811c9dc5; for (let i = 0; i < d.length; i += 28) key = Math.imul(key ^ (d[i] | d[i + 1] << 8 | d[i + 2] << 16 | d[i + 3] << 24), 0x01000193) >>> 0;
  return { key, at(x, y) {
    const u = x * kx - mw / 2, v = y * ky - mh / 2, fx = (m.a * u + m.c * v + m.e) * k - .5, fy = (m.b * u + m.d * v + m.f) * k - .5;
    const x0 = Math.floor(fx), y0 = Math.floor(fy), tx = fx - x0, ty = fy - y0;
    let cr = 0, cg = 0, cb = 0, ca = 0;
    const tap = (xi, yi, w) => {
      const o = (clamp(yi, 0, H - 1) * W + clamp(xi, 0, W - 1)) * 4, al = d[o + 3] / 255 * w;
      cr += d[o] / 255 * al; cg += d[o + 1] / 255 * al; cb += d[o + 2] / 255 * al; ca += al;
    };
    tap(x0, y0, (1 - tx) * (1 - ty)); tap(x0 + 1, y0, tx * (1 - ty)); tap(x0, y0 + 1, (1 - tx) * ty); tap(x0 + 1, y0 + 1, tx * ty);
    return ca > 1e-6 ? [cr / ca, cg / ca, cb / ca, ca] : [0, 0, 0, 0];
  } };
}
// CC Rainfall (weather::rainfall_plan): streaks falling through the layer, nearer ones faster, larger and stronger
function fxRainfall(E, img, q) {
  const n = clamp(Math.floor(q('drops')), 0, 100000), size = Math.max(0, q('size')), depth = Math.max(0, q('sceneDepth')), speed = q('speed'), wind = q('wind');
  const wvar = q('windVariation') / 100, spread = q('spread'), col = q('color'), opacity = q('opacity') / 100, refract = q('appearance') === 0, off = fxPl(E, q('offset'));
  const seed = ((Math.trunc(Math.max(0, q('seed'))) >>> 0) ^ Math.imul(fxSeed(E), 0x9e37)) >>> 0;
  const lw = E.bw, lh = E.bh, s = E.sc, t = E.t, ox = off[0] - lw * .5, oy = off[1] - lh * .5, m = E.m, lp = fxLpOf(E), sz = Math.max(size, .2), stride = 24, R = new Float32Array(n * stride);
  for (let i = 0; i < n; i++) {
    const k = fxDepthK(fxH(i, 1, seed), depth), vy = speed / 4000 * lh * 2.2 * k;
    const w = wind / 1000 * lh * (1 + wvar * fxHs(i, 2, seed)) * k + spread * fxHs(i, 7, seed) * k;
    const len = Math.max(vy * .04 * sz, 1), lenx = w * .04 * sz, margin = len + Math.abs(lenx) + 4;
    const y = fxWrap(fxH(i, 3, seed) * (lh + 2 * margin) + vy * t + oy, -margin, lh + 2 * margin);
    const x = fxWrap(fxH(i, 4, seed) * (lw + 2 * margin) + w * t + ox, -margin, lw + 2 * margin);
    const [bx, by] = lp(x, y);
    fxPutSprite(R, i, stride, 8, bx, by, Math.max(size * .6 * k * s, .25), col[0], col[1], col[2], opacity * (.35 + .65 * k), 0, -(m.a * lenx + m.c * len), -(m.b * lenx + m.d * len));
    // refracting drops show the scene behind them, brightened and offset
    if (refract) { const o = i * stride; R[o + 11] = 1; R[o + 12] = bx + 2 * s; R[o + 13] = by; }
  }
  return fxSpritePost(E, img, fxSpriteTable(E, img, R, n, stride, false), fxWeatherPost(q('transferMode'), q('composite')));
}
// CC Snowfall (weather::snowfall_plan): soft flakes drifting down with the wind, each wiggling side to side
function fxSnowfall(E, img, q) {
  const n = clamp(Math.floor(q('flakes')), 0, 200000), size = Math.max(0, q('size')), svar = q('sizeVariation') / 100, depth = Math.max(0, q('sceneDepth'));
  const speed = q('speed'), spvar = q('speedVariation') / 100, wind = q('wind'), wvar = q('windVariation') / 100, spread = q('spread');
  const wig = q('wiggle'), wigvar = q('wiggleVariation') / 100, wfreq = q('wiggleFreq'), wfvar = q('wiggleFreqVariation') / 100, col = q('color'), opacity = q('opacity') / 100, off = fxPl(E, q('offset'));
  const seed = ((Math.trunc(Math.max(0, q('seed'))) >>> 0) ^ Math.imul(fxSeed(E), 0x85eb)) >>> 0, TAU = 2 * Math.PI;
  const lw = E.bw, lh = E.bh, s = E.sc, t = E.t, ox = off[0] - lw * .5, oy = off[1] - lh * .5, lp = fxLpOf(E), stride = 16, R = new Float32Array(n * stride);
  for (let i = 0; i < n; i++) {
    const k = fxDepthK(fxH(i, 1, seed), depth), r = Math.max(size * .5 * k * (1 + svar * fxHs(i, 2, seed)), .05);
    const vy = speed * (lh / 600) * k * (1 + spvar * fxHs(i, 3, seed)), vx = wind * (lh / 1200) * k * (1 + wvar * fxHs(i, 4, seed)) + spread * fxHs(i, 8, seed) * k;
    const amp = wig * 2 * k * (1 + wigvar * fxHs(i, 5, seed)), fr = wfreq * (1 + wfvar * fxHs(i, 6, seed)), ph = fxH(i, 9, seed) * TAU, margin = r + Math.abs(amp) + 2;
    const y = fxWrap(fxH(i, 10, seed) * (lh + 2 * margin) + vy * t + oy, -margin, lh + 2 * margin);
    const x = fxWrap(fxH(i, 11, seed) * (lw + 2 * margin) + vx * t + ox, -margin, lw + 2 * margin) + amp * Math.sin(fr * t * TAU + ph);
    const [bx, by] = lp(x, y);
    fxPutSprite(R, i, stride, 0, bx, by, r * s, col[0], col[1], col[2], opacity * (.4 + .6 * k));
  }
  return fxSpritePost(E, img, fxSpriteTable(E, img, R, n, stride, false), fxWeatherPost(q('transferMode'), q('composite')));
}
// CC Bubbles (weather::bubble_list, fx_sim::bubbles): bubbles rising and wobbling, each showing the layer refracted
// (Liquid) or mirrored (Metal); the bubbles replace the layer
function fxBubbles(E, img, q) {
  const n = clamp(Math.floor(q('amount')), 0, 10000), speed = q('speed'), wamp = q('wobbleAmp'), wfreq = q('wobbleFreq'), bsize = Math.max(0, q('size'));
  const seed = Math.imul(fxSeed(E), 0x27d4) >>> 0, lw = E.bw, lh = E.bh, s = E.sc, t = E.t, TAU = 2 * Math.PI, base = Math.min(lw, lh) * .035 * bsize, lp = fxLpOf(E), it = fxItems(E, 12);
  for (let i = 0; i < n; i++) {
    const r = base * (.5 + fxH(i, 1, seed)), travel = lh + 2 * r, v = speed * lh * .3 * (.6 + .8 * fxH(i, 2, seed));
    const y = lh + r - fxRem(fxH(i, 3, seed) * travel + v * t, travel), x0 = fxH(i, 4, seed) * lw;
    const x = x0 + wamp * (r / Math.max(base, 1e-3)) * Math.sin(t * wfreq * TAU + fxH(i, 5, seed) * TAU);
    const [bx, by] = lp(x, y), [sx, sy] = lp(x0, y), R = r * s;
    fxItemPush(it, [bx - R - 1, by - R - 1, bx + R + 1, by + R + 1], [9, bx, by, R, sx, sy]);
  }
  const D = fxItemData(it); if (!D) return img;
  // refraction samples stay inside the layer's box (weather::bubble_sample_bounds)
  const [rx, ry, rw, rh] = E.rect, x0 = rx + .5, y0 = ry + .5;
  return E.run('fx_particles', 'fxm_raster', fxP({ 0: [1, 0, D.at, 12], 1: [it.tx, q('reflection') === 1 ? 1 : 0, q('shading'), 0] }, { 0: [x0, y0, Math.max(rx + rw - .5, x0), Math.max(ry + rh - .5, y0)] }),
    img, null, null, E.data(D.d));
}
// CC Drizzle (weather::drizzle_drops, fx_sim::drizzle): drops land at Drip Rate a second and spread rings that ripple and
// light the layer, each living Longevity seconds
function fxDrizzle(E, img, q) {
  const rate = Math.max(0, q('rate')), life = Math.max(.01, q('longevity')), spreading = q('spreading'), height = q('rippleHeight') / 100, t = E.t;
  if (rate <= 0 || t < 0) return img;
  const seed = Math.imul(fxSeed(E), 0x165667b1) >>> 0, lw = E.bw, lh = E.bh, s = E.sc, lp = fxLpOf(E), drops = [];
  const k0 = Math.max(0, Math.floor((t - life) * rate)), k1 = Math.floor(t * rate);
  for (let k = k0; k <= k1; k++) {
    const age = t - k / rate; if (age < 0 || age >= life) continue;
    const [x, y] = lp(fxH(k, 1, seed) * lw, fxH(k, 2, seed) * lh);
    drops.push(x, y, spreading * age * lh / 400 * s, height * (1 - age / life) * (.6 + .4 * fxH(k, 3, seed)));
  }
  if (!drops.length) return img;
  const rippling = Math.max(q('rippling') / 360, .05), wavelen = Math.max(lh * .04 * s, 2) / clamp(rippling, .25, 4), width = wavelen * (1 + rippling * 2);
  const ld = q('lightDir') * Math.PI / 180, l = fxPsNorm([Math.cos(ld), Math.sin(ld), Math.max(q('lightHeight') / 100, .05)]), hv = fxPsNorm([l[0] * .5, l[1] * .5, (l[2] + 1) * .5]);
  return E.run('fx_particles', 'fxm_drizzle', fxP({ 0: [drops.length / 4, 0, 0, 0] }, { 0: [wavelen, width, q('displacement') * s * 4, Math.max(q('roughness'), .001)],
    1: [...l, q('intensity') / 100], 2: [...hv, q('specular') / 100], 3: [...q('lightColor'), 0], 4: [q('ambient') / 100, q('diffuse') / 100, 0, 0] }), img, null, null, E.data(new Float32Array(drops)));
}
// the order that sorts non-negative floats from smallest up, keeping equal ones in their order (LSD radix on their bits)
function fxSortF32(Z) {
  const n = Z.length, bits = new Uint32Array(Z.buffer, Z.byteOffset, n);
  let a = new Uint32Array(n), b = new Uint32Array(n); for (let i = 0; i < n; i++) a[i] = i;
  for (let sh = 0; sh < 32; sh += 16) {
    const c = new Uint32Array(65537);
    for (let i = 0; i < n; i++) c[((bits[i] >>> sh) & 0xffff) + 1]++;
    for (let k = 1; k <= 65536; k++) c[k] += c[k - 1];
    for (let i = 0; i < n; i++) { const j = a[i]; b[c[(bits[j] >>> sh) & 0xffff]++] = j; }
    [a, b] = [b, a];
  }
  return a;
}
// CC Star Burst (weather::star_burst_plan): a grid of the layer's colours flying toward the viewer, drawn far to near
function fxStarBurst(E, img, q) {
  const scatter = q('scatter'), speed = q('speed'), phase = q('phase') / 360, spacing = Math.max(1, q('spacing')), size = q('size') / 100, blend = q('blend') / 100;
  const seed = Math.imul(fxSeed(E), 0x3c6e) >>> 0, lw = E.bw, lh = E.bh, s = E.sc, t = E.t, lp = fxLpOf(E);
  const nx = Math.max(1, Math.ceil(lw / spacing)), ny = Math.max(1, Math.ceil(lh / spacing)), n = nx * ny, cx = lw * .5, cy = lh * .5, stride = 24;
  const Z = new Float32Array(n), P = new Float32Array(n * 6);
  for (let i = 0; i < n; i++) {
    const gx = (i % nx) * spacing + spacing * .5, gy = Math.floor(i / nx) * spacing + spacing * .5, [sx, sy] = lp(gx, gy);
    // depth cycles toward the viewer: z in [0, 1), perspective 1 / (1 - 0.9 z)
    const z = fxRem(fxH(i, 1, seed) + t * speed * .25 + phase, 1), persp = 1 / (1 - .9 * z);
    const jx = fxHs(i, 2, seed) * scatter * .01 * lw * .5, jy = fxHs(i, 3, seed) * scatter * .01 * lh * .5, [bx, by] = lp(cx + (gx - cx + jx) * persp, cy + (gy - cy + jy) * persp);
    Z[i] = z; const o = i * 6; P[o] = bx; P[o + 1] = by; P[o + 2] = spacing * .5 * size * persp * s; P[o + 3] = Math.min(z * 8, 1) * Math.min((1 - z) * 6, 1); P[o + 4] = sx; P[o + 5] = sy;
  }
  const ord = fxSortF32(Z), R = new Float32Array(n * stride);
  for (let k = 0; k < n; k++) {
    const o = ord[k] * 6;
    // the layer's colour at the grid point (none where it is clear)
    fxPutSprite(R, k, stride, 1, P[o], P[o + 1], P[o + 2], 0, 0, 0, P[o + 3]);
    const r = k * stride; R[r + 11] = 2; R[r + 12] = P[o + 4]; R[r + 13] = P[o + 5];
  }
  return fxSpritePost(E, img, fxSpriteTable(E, img, R, n, stride, false), blend > 0 ? ['lerp', blend] : ['replace']);
}
// CC Hair (sim3::hair_plan): strands grown over the layer, each a curve of six segments drooping with Weight, coloured from
// its root (no strand where the root is clear) and shaded as hair (diffuse from the angle to the light, specular along it)
function fxHair(E, img, q) {
  const len = Math.max(0, q('length')), density = Math.max(0, q('density')) / 100; if (len <= 0 || density <= 0) return img;
  const thick = Math.max(.05, q('thickness')), weight = q('weight'), cm = !!q('constantMass'), mid = q('mapLayer'), map = mid ? fxMapImg(E, mid, 'hairmap', E.T) : null;
  const ms = q('mapStrength') / 100, msoft = Math.max(0, q('mapSoftness')), noise = q('addNoise') / 100, hc = q('hairColor'), bright = q('brightness') / 100, opacity = q('opacity') / 100;
  const inherit = q('inheritance') / 100, li = q('intensity') / 100, ld = q('lightDir') * Math.PI / 180, L0 = Math.sin(ld), L1 = -Math.cos(ld);
  const amb = q('ambient') / 100, dif = q('diffuse') / 100, spe = q('specular') / 100, rough = clamp(q('roughness') / 100, .01, 1);
  const seed = (fxSeed(E) ^ Math.imul(Math.trunc(Math.max(0, q('seed'))) >>> 0, 0x85ebca6b)) >>> 0, lw = E.bw, lh = E.bh, s = E.sc, lp = fxLpOf(E);
  const count = Math.floor(Math.min(lw * lh / 1000 * density * 10, 200000)), segs = 6, stride = 24, R = new Float32Array(count * segs * stride);
  const lum = (x, y) => { const c = map.at(x, y); return (.2126 * c[0] + .7152 * c[1] + .0722 * c[2]) * c[3]; };
  for (let i = 0; i < count; i++) {
    const rx = fxH(i, 1, seed) * lw, ry = fxH(i, 2, seed) * lh, [bx, by] = lp(rx, ry);
    let l = len * (.75 + .5 * fxH(i, 3, seed)), lx = fxHs(i, 4, seed) * .6, ly = -1 + fxH(i, 5, seed) * .4;
    // the hairfall map: brightness → length, its slope → lean
    if (map) {
      const d = Math.max(msoft, 1), gx = lum(rx + d, ry) - lum(rx - d, ry), gy = lum(rx, ry + d) - lum(rx, ry - d);
      l *= 1 - ms + ms * lum(rx, ry); lx += gx * ms * 4; ly += gy * ms * 4;
      if (noise > 0) lx += fxHs(i, 6, seed) * noise;
    }
    const ll = Math.max(Math.hypot(lx, ly), 1e-4), d0 = lx / ll, d1 = ly / ll, droop = weight * (cm ? 1 : 1 / Math.max(thick, .2)) * l;
    for (let k = 0; k < segs; k++) {
      const s0 = k / segs, s1 = (k + 1) / segs, ax = rx + d0 * l * s0, ay = ry + d1 * l * s0 + droop * s0 * s0, cx = rx + d0 * l * s1, cy = ry + d1 * l * s1 + droop * s1 * s1;
      const tl0 = Math.max(Math.hypot(cx - ax, cy - ay), 1e-6), tl = (cx - ax) / tl0 * L0 + (cy - ay) / tl0 * L1;
      const diff = Math.sqrt(Math.max(0, 1 - tl * tl)), spec = (1 - Math.abs(tl)) ** (1 / rough) * spe, shade = (amb + dif * diff * li) * bright;
      const [pax, pay] = lp(ax, ay), [pcx, pcy] = lp(cx, cy), j = i * segs + k, o = j * stride;
      fxPutSprite(R, j, stride, 8, pax, pay, thick * .5 * s * (1 - .6 * s1), 0, 0, 0, opacity, 0, pcx - pax, pcy - pay);
      R[o + 11] = 3; R[o + 12] = bx; R[o + 13] = by; R[o + 14] = hc[0]; R[o + 15] = hc[1]; R[o + 16] = hc[2]; R[o + 17] = inherit; R[o + 18] = shade; R[o + 19] = spec * li;
    }
  }
  return fxSpritePost(E, img, fxSpriteTable(E, img, R, count * segs, stride, false), ['combine', 0]);
}
// textfx's stroke font: polylines on a 4 × 6 grid (y down, baseline at 6), `;` between strokes; a single point is a dot
const STROKE_FONT = """ + GLYPHS + r""";
const STROKE_CACHE = new Map();
function fxGlyph(c) {
  c = c.toUpperCase(); let g = STROKE_CACHE.get(c);
  if (!g) { g = (STROKE_FONT[c] || '').split(';').map(st => st.trim().split(/\s+/).filter(Boolean).map(pt => pt.split(',').map(Number))).filter(v => v.length && v.every(p => p.length === 2 && p.every(Number.isFinite))); STROKE_CACHE.set(c, g); }
  return g;
}
// ---- Particle Playground (sim3.rs): a 2D particle system stepped from layer time 0 at 60 steps a second (checkpoints as
// the particle engine's), with a Cannon, a Grid and a Layer Exploder making particles; Gravity, Repel, a Wall (the layer's
// mask) and two Property Mappers (another layer's red, green and blue driving the particles' properties); a Particle
// Exploder; and a Layer Map drawing particles as copies of another layer. Points are in the layer's own pixels ----
const PG_FROM = ['All', 'Cannon', 'Grid', 'Layer Exploder', 'Particle Exploder', 'Grid & Layer Exploder', 'Cannon & Grid', 'Cannon & Particle Exploder'];
const PG_TARGETS = ['None', 'Red', 'Green', 'Blue', 'Kinetic Friction', 'Static Friction', 'Angle', 'Angular Velocity', 'Torque', 'Scale', 'X Scale', 'Y Scale', 'X', 'Y',
  'Gradient Velocity', 'X Speed', 'Y Speed', 'Gradient Force', 'X Force', 'Y Force', 'Opacity', 'Mass', 'Lifespan', 'Character', 'Font Size', 'Time Offset', 'Scale Speed'];
const PG_OPS = ['Set', 'Add', 'Difference', 'Subtract', 'Multiply', 'Min', 'Max'];
const PG_TOFF = ['Relative', 'Absolute', 'Relative Random', 'Absolute Random'];
const PG_CACHE = [];
// a checkpointed simulation (util::SimCache::run): the state after `target` steps, from the latest checkpoint
function fxSimRun(cache, key, target, init, step, clone) {
  const tick = ++PS_TICK; let e = cache.find(x => x.key === key), start = null;
  if (e) {
    e.used = tick; if (e.last && e.last[0] === target) return e.last[1];
    for (const [k, st] of e.cps) if (k <= target && (!start || k > start[0])) start = [k, st];
    if (e.last && e.last[0] <= target && (!start || e.last[0] > start[0])) start = e.last;
  } else {
    if (cache.length >= 6) cache.splice(cache.indexOf(cache.reduce((a, b) => a.used <= b.used ? a : b)), 1);
    e = { key, used: tick, cps: new Map(), last: null }; cache.push(e);
  }
  let i = start ? start[0] : 0; const st = start ? (start === e.last ? start[1] : clone(start[1])) : init();
  if (!start) e.cps.set(0, clone(st));
  while (i < target) { step(st, i); i++; if (i % PS_CP === 0 && i !== target && !e.cps.has(i)) e.cps.set(i, clone(st)); }
  e.last = [target, st]; return st;
}
const fxPgNew = (p, v, c, r, id, src) => ({ p, v, origin: p.slice(), c, r, mass: 1, fr: 0, sf: 0, force: [0, 0], angle: 0, angVel: 0, torque: 0, scale: [1, 1], scaleSpeed: 0,
  age: 0, life: Infinity, ch: 0, toff: 0, src, id });
const fxPgClone = q => ({ ...q, p: q.p.slice(), v: q.v.slice(), origin: q.origin.slice(), c: q.c.slice(), force: q.force.slice(), scale: q.scale.slice() });
const fxPgState = st => ({ parts: st.parts.map(fxPgClone), carry: st.carry, next: st.next });
// prop_get / prop_set: a property a mapper channel drives (PG_TARGETS)
function fxPgGet(q, t) {
  switch (t) {
    case 1: return q.c[0]; case 2: return q.c[1]; case 3: return q.c[2]; case 4: return q.fr; case 5: return q.sf; case 6: return q.angle; case 7: return q.angVel;
    case 8: return q.torque; case 9: return (q.scale[0] + q.scale[1]) * .5; case 10: return q.scale[0]; case 11: return q.scale[1]; case 12: return q.p[0]; case 13: return q.p[1];
    case 15: return q.v[0]; case 16: return q.v[1]; case 18: return q.force[0]; case 19: return q.force[1]; case 20: return q.c[3]; case 21: return q.mass; case 22: return q.life;
    case 23: return q.ch; case 24: return q.r; case 25: return q.toff; case 26: return q.scaleSpeed; default: return 0;
  }
}
function fxPgSet(q, t, v) {
  switch (t) {
    case 1: q.c[0] = v; break; case 2: q.c[1] = v; break; case 3: q.c[2] = v; break; case 4: q.fr = clamp(v, 0, 10); break; case 5: q.sf = Math.max(v, 0); break;
    case 6: q.angle = v; break; case 7: q.angVel = v; break; case 8: q.torque = v; break; case 9: q.scale = [Math.max(v, 0), Math.max(v, 0)]; break;
    case 10: q.scale[0] = Math.max(v, 0); break; case 11: q.scale[1] = Math.max(v, 0); break; case 12: q.p[0] = v; break; case 13: q.p[1] = v; break;
    case 15: q.v[0] = v; break; case 16: q.v[1] = v; break; case 18: q.force[0] = v; break; case 19: q.force[1] = v; break; case 20: q.c[3] = clamp(v, 0, 1); break;
    case 21: q.mass = Math.max(v, .01); break; case 22: q.life = Math.max(v, 0); break; case 23: q.ch = Number.isFinite(v) ? clamp(Math.round(v), 0, 0x10ffff) : 0; break;
    case 24: q.r = Math.max(v, 0); break; case 25: q.toff = v; break; case 26: q.scaleSpeed = v; break;
  }
}
// an Affects group (which particles a producer, force or mapper acts on, as a weight 0..1)
function fxPgAff(E, q, g) {
  const sel = q(g + 'Sel');
  return { from: q(g + 'From'), sel: sel ? fxMapImg(E, sel, 'pgsel' + g, E.T) : null, chars: [...String(q(g + 'Chars') || '')], age: q(g + 'Age'), feather: Math.max(0, q(g + 'Feather')) };
}
function fxPgW(A, q) {
  const s = q.src, f = A.from;
  if (!(f === 1 ? s === 0 : f === 2 ? s === 1 : f === 3 ? s === 2 : f === 4 ? s === 3 : f === 5 ? s === 1 || s === 2 : f === 6 ? s === 0 || s === 1 : f === 7 ? s === 0 || s === 3 : true)) return 0;
  if (A.chars.length && !(q.ch && A.chars.includes(String.fromCodePoint(q.ch)))) return 0;
  let w = 1;
  if (A.age !== 0) { const d = A.age > 0 ? q.age - A.age : -A.age - q.age; w *= A.feather > 0 ? clamp(d / A.feather + .5, 0, 1) : d >= 0 ? 1 : 0; }
  if (A.sel) { const c = A.sel.at(q.p[0], q.p[1]); w *= clamp(fxLum(c[0], c[1], c[2]), 0, 1) * c[3]; }
  return w;
}
// Mapper::apply: a map layer's red, green and blue at the particle drive its properties
function fxPgMap(M, q) {
  const w = fxPgW(M.aff, q); if (w <= 0) return;
  const px = M.map.at(q.p[0], q.p[1]);
  for (let ch = 0; ch < 3; ch++) {
    const [target, op, lo, hi] = M.chans[ch]; if (!target) continue;
    const v = lo + (hi - lo) * px[ch];
    if (target === 14 || target === 17) {   // Gradient Velocity / Force: along the channel's slope
      const gx = (M.map.at(q.p[0] + 1, q.p[1])[ch] - M.map.at(q.p[0] - 1, q.p[1])[ch]) * .5 * (hi - lo) * w, gy = (M.map.at(q.p[0], q.p[1] + 1)[ch] - M.map.at(q.p[0], q.p[1] - 1)[ch]) * .5 * (hi - lo) * w;
      if (target === 14) q.v = [q.v[0] + gx, q.v[1] + gy]; else q.force = [q.force[0] + gx, q.force[1] + gy];
      continue;
    }
    const cur = fxPgGet(q, target), nv = op === 1 ? cur + v : op === 2 ? Math.abs(cur - v) : op === 3 ? cur - v : op === 4 ? cur * v : op === 5 ? Math.min(cur, v) : op === 6 ? Math.max(cur, v) : v;
    fxPgSet(q, target, w >= 1 || !Number.isFinite(cur) ? nv : cur + (nv - cur) * w);   // (an unlimited lifespan has no in-between)
  }
}
// util::point_in_poly (even-odd)
function fxInPoly(P, x, y) {
  let inside = false;
  for (let i = 0, j = P.length - 1; i < P.length; j = i++) {
    const [xi, yi] = P[i], [xj, yj] = P[j];
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
// Pg::spawn: a cannon particle (AE angles: 0° up, clockwise; a positive barrel radius is a square, a negative one a disc)
function fxPgSpawn(G, id) {
  const s = G.seed, h = k => fxH(id, k, s) * 2 - 1, a = (G.barrelAngle + h(1) * G.dirSpread * .5) * Math.PI / 180, speed = Math.max(G.vel + h(3) * G.velSpread, 0), r = G.barrelR;
  let off;
  if (r >= 0) off = [h(2) * r, h(4) * r];
  else { const b = fxH(id, 5, s) * 2 * Math.PI, rr = Math.sqrt(fxH(id, 6, s)) * -r; off = [Math.cos(b) * rr, Math.sin(b) * rr]; }
  const q = fxPgNew([G.pos[0] + off[0], G.pos[1] + off[1]], [Math.sin(a) * speed, -Math.cos(a) * speed], G.color.slice(), G.radius, id, 0);
  if (G.cannonText.length) q.ch = G.cannonText[id % G.cannonText.length].codePointAt(0);
  return q;
}
// the ephemeral mapper's view of a particle this step (the particle itself without one)
const fxPgEph = (G, q) => { if (!G.eph) return q; const e = fxPgClone(q); fxPgMap(G.eph, e); return e; };
// Pg::step
function fxPgStep(G, st) {
  const dt = 1 / PS_SPS, s = G.seed;
  if (G.pers) for (const q of st.parts) fxPgMap(G.pers, q);   // what the persistent mapper sets stays with the particle
  const N = st.parts.length, eph = G.eph ? st.parts.map(q => fxPgEph(G, q)) : st.parts, push = new Float64Array(N * 2);
  if (G.repel !== 0 && G.repelR > 0 && N > 1) {   // Repel: neighbours within the radius push each other apart
    const cell = G.repelR, grid = new Map(), key = (x, y) => x * 4194304 + y;
    for (let i = 0; i < N; i++) { const q = eph[i], k = key(Math.floor(q.p[0] / cell), Math.floor(q.p[1] / cell)); let l = grid.get(k); if (!l) grid.set(k, l = []); l.push(i); }
    for (let i = 0; i < N; i++) {
      const q = eph[i], w = fxPgW(G.repelA, q); if (w <= 0) continue;
      const cx = Math.floor(q.p[0] / cell), cy = Math.floor(q.p[1] / cell);
      for (let gy = cy - 1; gy <= cy + 1; gy++) for (let gx = cx - 1; gx <= cx + 1; gx++) {
        const list = grid.get(key(gx, gy)); if (!list) continue;
        for (const j of list) {
          if (j === i) continue;
          const o = eph[j], dx = q.p[0] - o.p[0], dy = q.p[1] - o.p[1], d = Math.sqrt(dx * dx + dy * dy);
          if (d < G.repelR && d > 1e-4) { const k = w * G.repel * (1 - d / G.repelR) / d; push[2 * i] += dx * k; push[2 * i + 1] += dy * k; }
        }
      }
    }
  }
  for (let i = 0; i < N; i++) {
    const q = st.parts[i], e = eph[i], ev0 = e.v[0], ev1 = e.v[1], eAng = e.angVel, eTq = e.torque, eSs = e.scaleSpeed;
    const gw = fxPgW(G.gravA, e), ww = G.wall ? fxPgW(G.wallA, e) : 0, g = G.gravSpread > 0 ? 1 + (fxH(q.id, 7, s) * 2 - 1) * G.gravSpread : 1;
    let ax = G.grav[0] * g * gw + (e.force[0] + push[2 * i]) / e.mass, ay = G.grav[1] * g * gw + (e.force[1] + push[2 * i + 1]) / e.mass;
    // static friction: a resting particle stays until the push beats it
    if (Math.abs(ev0) < 1e-3 && Math.abs(ev1) < 1e-3 && Math.hypot(ax, ay) <= e.sf) { ax = 0; ay = 0; }
    const damp = Math.max(1 - e.fr * .1, 0), nv0 = (ev0 + ax * dt) * damp, nv1 = (ev1 + ay * dt) * damp;
    q.v = [nv0 - (ev0 - q.v[0]), nv1 - (ev1 - q.v[1])];   // only the persistent part of the velocity is kept
    q.angVel += eTq * dt; q.angle += eAng * dt; q.scale = [Math.max(q.scale[0] + eSs * dt, 0), Math.max(q.scale[1] + eSs * dt, 0)]; q.age += dt;
    const np0 = q.p[0] + nv0 * dt, np1 = q.p[1] + nv1 * dt;
    if (G.wall && ww > .5 && fxInPoly(G.wall, q.p[0], q.p[1]) !== fxInPoly(G.wall, np0, np1)) { q.v = [-q.v[0] * .9, -q.v[1] * .9]; continue; }   // bounce off the wall
    q.p = [np0, np1];
  }
  const b = G.bounds, life = G.eph ? st.parts.map(q => fxPgEph(G, q).life) : null;
  st.parts = st.parts.filter((q, k) => q.p[0] > b[0] && q.p[0] < b[2] && q.p[1] > b[1] && q.p[1] < b[3] && q.age <= (life ? life[k] : q.life));
  // Particle Exploder: affected particles larger than the new radius burst into smaller ones that fly apart
  if (G.pexR > 0) {
    const out = [];
    for (const q of st.parts) {
      if (q.src === 3 || q.ch !== 0 || q.r <= G.pexR * 1.01 || fxPgW(G.pexA, q) <= .5 || out.length > 60000) { out.push(q); continue; }
      const n = clamp(Math.round((q.r / G.pexR) ** 2), 2, 16), rr = q.r - G.pexR;
      for (let k = 0; k < n; k++) {
        const id = st.next; st.next = (st.next + 1) >>> 0;
        const a = (k + fxH(id, 31, s)) / n * 2 * Math.PI, ca = Math.cos(a), sa = Math.sin(a), sp = G.pexDisp * (.5 + fxH(id, 32, s)), c = fxPgClone(q);
        c.p = [q.p[0] + ca * rr, q.p[1] + sa * rr]; c.v = [q.v[0] + ca * sp, q.v[1] + sa * sp]; c.r = G.pexR; c.src = 3; c.id = id; out.push(c);
      }
    }
    st.parts = out;
  }
  st.carry += G.rate / PS_SPS; const n = Math.floor(st.carry); st.carry -= n;
  for (let i = 0; i < n && st.parts.length < 60000; i++) {
    const id = st.next; st.next = (st.next + 1) >>> 0;
    const q = fxPgSpawn(G, id), frac = fxH(id, 9, s) * dt;   // a birth part-way through the step keeps the stream smooth
    q.p = [q.p[0] + q.v[0] * frac, q.p[1] + q.v[1] * frac]; st.parts.push(q);
  }
}
// pg_of: the producers and forces
function fxPg(E, q) {
  const lw = E.bw, lh = E.bh, gd = q('gravDir') * Math.PI / 180, gf = q('gravForce');
  let wall = null; if (q('wall') === 1) { const mp = fxMaskPoly(E); if (mp) wall = mp.pts.map(P => fxPl(E, P)); }
  const mapper = (g, eph) => {
    const id = q(g + 'Layer'), map = id ? fxMapImg(E, id, 'pg' + g, E.T) : null; if (!map) return null;
    const ch = c => [q(g + c + 'To'), eph ? q(g + c + 'Op') : 0, q(g + c + 'Min'), q(g + c + 'Max')];
    return { map, chans: [ch('Red'), ch('Green'), ch('Blue')], aff: fxPgAff(E, q, g) };
  };
  return { pos: fxPl(E, q('cannonPos')), barrelAngle: q('barrelAngle'), barrelR: q('barrelRadius'), rate: Math.max(0, q('cannonRate')), dirSpread: q('dirSpread'), vel: q('cannonVel'),
    velSpread: q('velSpread'), color: [...q('cannonColor'), 1], radius: Math.max(0, q('cannonRadius')), cannonText: [...String(q('cannonText') || '')],
    pexR: Math.max(0, q('pexRadius')), pexDisp: q('pexDisp'), pexA: fxPgAff(E, q, 'pex'), grav: [Math.sin(gd) * gf, -Math.cos(gd) * gf],
    gravSpread: Math.max(0, q('gravSpread') / 100), gravA: fxPgAff(E, q, 'grav'), repel: q('repelForce') * 100, repelR: Math.max(0, q('repelRadius')), repelA: fxPgAff(E, q, 'repel'),
    wall, wallA: fxPgAff(E, q, 'wall'), pers: mapper('ppm', false), eph: mapper('epm', true),
    seed: (Math.imul(Math.trunc(Math.max(0, q('seed'))) >>> 0, 0x9e3779b9) ^ fxSeed(E)) >>> 0, bounds: [-lw * 2, -lh * 2, lw * 3, lh * 3] };
}
// playground_plan: the particles now (dots, text characters from the stroke font) as sprites, then the Layer Map copies;
// all of it replaces the layer, as in After Effects
function fxPlayground(E, img, q) {
  const D = FX[E.fx.id], G = fxPg(E, q), lw = E.bw, lh = E.bh, seed = G.seed;
  const across = Math.max(0, Math.round(q('across'))), down = Math.max(0, Math.round(q('down'))), gpos = fxPl(E, q('gridPos')), gw = q('gridW'), gh = q('gridH');
  const gcol = [...q('gridColor'), 1], grad = Math.max(0, q('gridRadius')), gridText = [...String(q('gridText') || '')], xid = q('explodeLayer');
  const ex = xid ? fxMapImg(E, xid, 'pgex', E.T - E.t, 960) : null, exR = Math.max(.5, q('exRadius')), exDisp = q('exDisp');
  // the simulation is kept per settings (points in layer pixels), layer size, and what its map layers showed
  const vals = D.params.map(d => { const v = q(d.id); return d.type === 'pt' ? fxPl(E, v).map(x => +x.toFixed(4)) : v; });
  const maps = [G.pers, G.eph, G.pexA, G.gravA, G.repelA, G.wallA].map(m => m ? (m.map || m.sel)?.key ?? 0 : 0);
  const key = JSON.stringify([lw, lh, fxSeed(E), vals, maps, ex?.key ?? 0, G.wall?.map(p => p.map(v => +v.toFixed(3)))]);
  const init = () => {
    const st = { parts: [], carry: 0, next: 0 };
    if (across > 0 && down > 0) {
      let k = 0;
      for (let j = 0; j < down; j++) for (let i = 0; i < across; i++) {
        let ch = 0;
        if (gridText.length) { const c = gridText[k % gridText.length]; k++; if (c === ' ') continue; ch = c.codePointAt(0); }   // one character a point, spaces leave it empty
        const fx = across > 1 ? i / (across - 1) - .5 : 0, fy = down > 1 ? j / (down - 1) - .5 : 0;
        const p = fxPgNew([gpos[0] + fx * gw, gpos[1] + fy * gh], [0, 0], gcol.slice(), grad, st.next++, 1); p.ch = ch; st.parts.push(p);
      }
    }
    if (ex) {
      const step = Math.max(exR * 2, 1);
      for (let y = step * .5; y < lh; y += step) for (let x = step * .5; x < lw; x += step) {
        const c = ex.at(x, y); if (!(c[3] > .05)) continue;
        const id = st.next++, h = k => fxH(id, k, seed) * 2 - 1, dx = x - lw * .5, dy = y - lh * .5, l = Math.max(Math.hypot(dx, dy), 1);
        st.parts.push(fxPgNew([x, y], [dx / l * exDisp + h(1) * exDisp, dy / l * exDisp + h(2) * exDisp], c, exR, id, 2));
      }
    }
    return st;
  };
  const st = fxSimRun(PG_CACHE, key, fxStepsAt(E.t), init, s => fxPgStep(G, s), fxPgState);
  // what the ephemeral mapper changes shows for this frame only
  const parts = G.eph ? st.parts.map(p => fxPgEph(G, p)) : st.parts, auto = !!q('autoOrient'), mapId = q('mapLayer'), mapA = mapId ? fxPgAff(E, q, 'lmap') : null;
  const otype = q('timeOffsetType'), toff = q('timeOffset'), fps = S.fps, lp = fxLpOf(E), sp = [], blits = [];
  const dot = (x, y, r, c, shape, dx = 0, dy = 0) => sp.push([shape, x, y, r, c, dx, dy]);
  for (const p of parts) {
    const [x, y] = lp(p.p[0], p.p[1]), angle = auto && (p.v[0] !== 0 || p.v[1] !== 0) ? Math.atan2(p.v[1], p.v[0]) * 180 / Math.PI + 90 : p.angle;
    if (mapId && fxPgW(mapA, p) > .5) {
      const rnd = fxH(p.id, 41, seed), t = (otype === 1 ? toff : otype === 2 ? E.T + toff * rnd : otype === 3 ? toff * rnd : E.T + toff) + p.toff;
      blits.push([x, y, angle, p.scale[0], p.scale[1], p.c[3], Math.round(t * fps)]); continue;
    }
    const sc = (p.scale[0] + p.scale[1]) * .5, chr = p.ch && p.ch !== 32 ? String.fromCodePoint(p.ch) : null;
    if (chr) {   // a text particle: the character's strokes, Font Size tall, turned
      const size = p.r * sc * E.sc, u = size * .7 / 6, wgt = Math.max(size * .045, .35), a = angle * Math.PI / 180 + E.rot, ca = Math.cos(a), sa = Math.sin(a), ks = Math.max(sc, 1e-6);
      const tr = g => { const gx = (g[0] - 2) * u * p.scale[0] / ks, gy = (g[1] - 3) * u * p.scale[1] / ks; return [x + gx * ca - gy * sa, y + gx * sa + gy * ca]; };
      for (const stroke of fxGlyph(chr)) {
        if (stroke.length === 1) { const a0 = tr(stroke[0]); dot(a0[0], a0[1], wgt, p.c, 1); }
        for (let k = 0; k + 1 < stroke.length; k++) { const a0 = tr(stroke[k]), a1 = tr(stroke[k + 1]); dot(a0[0], a0[1], wgt, p.c, 8, a1[0] - a0[0], a1[1] - a0[1]); }
      }
    } else dot(x, y, p.r * sc * E.sc, p.c, 1);
  }
  const R = new Float32Array(sp.length * 16);
  sp.forEach(([shape, x, y, r, c, dx, dy], i) => fxPutSprite(R, i, 16, shape, x, y, r, c[0], c[1], c[2], c[3], 0, dx, dy));
  let out = fxSpriteTable(E, img, R, sp.length, 16, false);
  if (!blits.length) return out;
  // Layer Map: each moment's frame once (at most 32; later ones use the nearest), its copies drawn over the dots
  const frames = new Map();
  for (const b of blits) {
    let f = b[6];
    if (!frames.has(f) && frames.size >= 32) f = [...frames.keys()].reduce((a, k) => Math.abs(k - b[6]) < Math.abs(a - b[6]) ? k : a);
    if (!frames.has(f)) frames.set(f, []);
    frames.get(f).push(b);
  }
  for (const [f, list] of frames) {
    const tex = fxLayerAt(E, mapId, 'pgmap', f / fps), r = RT[mapId], m = r?.m; if (!tex || !m) continue;
    const mw = r.box?.w || E.w, mh = r.box?.h || E.h;
    out = fxChunked(E, img, list, 12, 'lumina_sim', 'lsm_blit', 0, ([x, y, angle, s0, s1, al]) => {
      if (!s0 || !s1 || !(al > 0)) return [null];
      const a = angle * Math.PI / 180 + E.rot, rad = Math.hypot(mw * Math.abs(s0) * E.sc, mh * Math.abs(s1) * E.sc) * .5 + 1;
      return [[x - rad, y - rad, x + rad, y + rad], [x, y, Math.cos(a), Math.sin(a), 1 / (s0 * E.sc), 1 / (s1 * E.sc), al]];
    }, { 0: [m.a, m.b, m.c, m.d], 1: [m.e, m.f, mw, mh] }, tex, out);
    E.free(tex);
  }
  return out;
}
"""
rep("""// ---- Round 26 helpers (Simulation, particles): EffectCraft's sim/engine.rs""", HELPERS + """// ---- Round 26 helpers (Simulation, particles): EffectCraft's sim/engine.rs""")

def aff(g, label):
    return f"""      {{ id: '{g}From', label: '{label} affects: particles from', type: 'pick', def: 0, opts: fxOpts(PG_FROM) }},
      fxLayerPick('{g}Sel', '{label} affects: selection map', 'None'),
      {{ id: '{g}Chars', label: '{label} affects: characters', type: 'text', def: '' }},
      {{ id: '{g}Age', label: '{label} affects: older (+) / younger (−) than, sec', def: 0, min: -1000, max: 1000, dec: 2 }},
      {{ id: '{g}Feather', label: '{label} affects: age feather, sec', def: 0, min: 0, max: 1000, dec: 2 }},
"""
def mapper(g, label, ops):
    out = f"      fxLayerPick('{g}Layer', '{label}: use layer as map', 'None'),\n"
    for c in ['Red', 'Green', 'Blue']:
        out += f"      {{ id: '{g}{c}To', label: '{label}: map {c.lower()} to', type: 'pick', def: 0, opts: fxOpts(PG_TARGETS) }},\n"
        if ops:
            out += f"      {{ id: '{g}{c}Op', label: '{label}: {c.lower()} operator', type: 'pick', def: 0, opts: fxOpts(PG_OPS) }},\n"
        out += f"      {{ id: '{g}{c}Min', label: '{label}: {c.lower()} min', def: 0, min: -10000, max: 10000, dec: 2 }},\n"
        out += f"      {{ id: '{g}{c}Max', label: '{label}: {c.lower()} max', def: 1, min: -10000, max: 10000, dec: 2 }},\n"
    return out + aff(g, label)

PG_PARAMS = """      { id: 'cannonText', label: 'Cannon text (characters fired in order; empty = dots)', type: 'text', def: '' },
      { id: 'gridText', label: 'Grid text (one character a grid point; empty = dots)', type: 'text', def: '' },
      { id: 'autoOrient', label: 'Auto-orient rotation', type: 'check', def: false },
      { id: 'cannonPos', label: 'Cannon position', type: 'pt', def: [.5, .9] },
      { id: 'barrelRadius', label: 'Cannon barrel radius', def: 0, min: -1000, max: 1000, dec: 1 },
      { id: 'cannonRate', label: 'Cannon particles per second', def: 60, min: 0, max: 5000, dec: 1 },
      { id: 'barrelAngle', label: 'Cannon direction°', def: 0, min: -3600, max: 3600, dec: 1 },
      { id: 'dirSpread', label: 'Cannon direction random spread°', def: 20, min: 0, max: 3600, dec: 1 },
      { id: 'cannonVel', label: 'Cannon velocity', def: 130, min: 0, max: 10000, dec: 1 },
      { id: 'velSpread', label: 'Cannon velocity random spread', def: 20, min: 0, max: 5000, dec: 1 },
      { id: 'cannonColor', label: 'Cannon color', type: 'color', def: '#ff0000' },
      { id: 'cannonRadius', label: 'Cannon particle radius', def: 2, min: 0, max: 500, dec: 1 },
      { id: 'gridPos', label: 'Grid position', type: 'pt', def: [.5, .5] },
      { id: 'gridW', label: 'Grid width', def: 100, min: 0, max: 20000, dec: 1 },
      { id: 'gridH', label: 'Grid height', def: 100, min: 0, max: 20000, dec: 1 },
      { id: 'across', label: 'Grid particles across', def: 0, min: 0, max: 1000, dec: 0 },
      { id: 'down', label: 'Grid particles down', def: 0, min: 0, max: 1000, dec: 0 },
      { id: 'gridColor', label: 'Grid color', type: 'color', def: '#ffffff' },
      { id: 'gridRadius', label: 'Grid particle radius', def: 2, min: 0, max: 500, dec: 1 },
      fxLayerPick('explodeLayer', 'Layer exploder: explode layer', 'None'),
      { id: 'exRadius', label: 'Layer exploder: radius of new particles', def: 2, min: 0, max: 500, dec: 1 },
      { id: 'exDisp', label: 'Layer exploder: velocity dispersion', def: 20, min: 0, max: 5000, dec: 1 },
      { id: 'pexRadius', label: 'Particle exploder: radius of new particles', def: 0, min: 0, max: 500, dec: 1 },
      { id: 'pexDisp', label: 'Particle exploder: velocity dispersion', def: 20, min: 0, max: 5000, dec: 1 },
""" + aff('pex', 'Particle exploder') + """      fxLayerPick('mapLayer', 'Layer map: use layer', 'None'),
      { id: 'timeOffsetType', label: 'Layer map: time offset type', type: 'pick', def: 0, opts: fxOpts(PG_TOFF) },
      { id: 'timeOffset', label: 'Layer map: time offset (sec)', def: 0, min: -1000, max: 1000, dec: 2 },
""" + aff('lmap', 'Layer map') + """      { id: 'gravForce', label: 'Gravity force', def: 108, min: 0, max: 10000, dec: 1 },
      { id: 'gravSpread', label: 'Gravity force random spread', def: 0, min: 0, max: 1000, dec: 1 },
      { id: 'gravDir', label: 'Gravity direction°', def: 180, min: -3600, max: 3600, dec: 1 },
""" + aff('grav', 'Gravity') + """      { id: 'repelForce', label: 'Repel force', def: 0, min: -100, max: 100, dec: 2 },
      { id: 'repelRadius', label: 'Repel force radius', def: 0, min: 0, max: 1000, dec: 1 },
""" + aff('repel', 'Repel') + """      { id: 'wall', label: 'Wall boundary', type: 'pick', def: 0, opts: [[0, 'None'], [1, 'Layer mask']] },
""" + aff('wall', 'Wall') + mapper('ppm', 'Persistent property mapper', False) + mapper('epm', 'Ephemeral property mapper', True) + """      { id: 'seed', label: 'Random seed', def: 0, min: 0, max: 10000, dec: 0 }],"""

EFFECTS = r"""  // ---- Round 27: Simulation, weather and more (EffectCraft's sim/weather.rs and sim3.rs: CC Rainfall, CC Snowfall, CC Bubbles,
  // CC Drizzle, CC Star Burst, CC Hair, Particle Playground) ----
  ccrainfall: { name: 'CC Rainfall', cat: 'Simulation', clip: true, kernels: WEATHER_K, params: [
      { id: 'drops', label: 'Drops', def: 5000, min: 0, max: 100000, dec: 0 },
      { id: 'size', label: 'Size', def: 1, min: 0, max: 50, dec: 2 },
      { id: 'sceneDepth', label: 'Scene depth', def: 5000, min: 0, max: 20000, dec: 0 },
      { id: 'speed', label: 'Speed', def: 4000, min: 0, max: 20000, dec: 0 },
      { id: 'wind', label: 'Wind', def: 0, min: -10000, max: 10000, dec: 1 },
      { id: 'windVariation', label: 'Wind variation %', def: 0, min: 0, max: 100, dec: 1 },
      { id: 'spread', label: 'Spread', def: 0, min: 0, max: 1000, dec: 1 },
      { id: 'color', label: 'Color', type: 'color', def: '#cccccc' },
      { id: 'opacity', label: 'Opacity %', def: 25, min: 0, max: 100, dec: 1 },
      { id: 'transferMode', label: 'Transfer mode', type: 'pick', def: 1, opts: [[0, 'Composite'], [1, 'Lighten']] },
      { id: 'composite', label: 'Composite with original', type: 'check', def: true },
      { id: 'appearance', label: 'Appearance', type: 'pick', def: 0, opts: [[0, 'Refracting'], [1, 'Soft solid']] },
      { id: 'offset', label: 'Offset', type: 'pt', def: [.5, .5] },
      { id: 'seed', label: 'Random seed', def: 0, min: 0, max: 10000, dec: 0 }],
    run: fxRainfall },
  ccsnowfall: { name: 'CC Snowfall', cat: 'Simulation', clip: true, kernels: WEATHER_K, params: [
      { id: 'flakes', label: 'Flakes', def: 10000, min: 0, max: 200000, dec: 0 },
      { id: 'size', label: 'Size', def: 3, min: 0, max: 50, dec: 2 },
      { id: 'sizeVariation', label: 'Size variation %', def: 50, min: 0, max: 100, dec: 1 },
      { id: 'sceneDepth', label: 'Scene depth', def: 5000, min: 0, max: 20000, dec: 0 },
      { id: 'speed', label: 'Speed', def: 100, min: 0, max: 5000, dec: 1 },
      { id: 'speedVariation', label: 'Speed variation %', def: 50, min: 0, max: 100, dec: 1 },
      { id: 'wind', label: 'Wind', def: 25, min: -5000, max: 5000, dec: 1 },
      { id: 'windVariation', label: 'Wind variation %', def: 50, min: 0, max: 100, dec: 1 },
      { id: 'spread', label: 'Spread', def: 0, min: 0, max: 1000, dec: 1 },
      { id: 'wiggle', label: 'Wiggle amount', def: 2, min: 0, max: 100, dec: 2 },
      { id: 'wiggleVariation', label: 'Wiggle amount variation %', def: 50, min: 0, max: 100, dec: 1 },
      { id: 'wiggleFreq', label: 'Wiggle frequency', def: 1, min: 0, max: 20, dec: 2 },
      { id: 'wiggleFreqVariation', label: 'Wiggle frequency variation %', def: 50, min: 0, max: 100, dec: 1 },
      { id: 'color', label: 'Color', type: 'color', def: '#ffffff' },
      { id: 'opacity', label: 'Opacity %', def: 100, min: 0, max: 100, dec: 1 },
      { id: 'transferMode', label: 'Transfer mode', type: 'pick', def: 0, opts: [[0, 'Composite'], [1, 'Lighten']] },
      { id: 'composite', label: 'Composite with original', type: 'check', def: true },
      { id: 'offset', label: 'Offset', type: 'pt', def: [.5, .5] },
      { id: 'seed', label: 'Random seed', def: 0, min: 0, max: 10000, dec: 0 }],
    run: fxSnowfall },
  ccbubbles: { name: 'CC Bubbles', cat: 'Simulation', clip: true, kernels: [['fx_particles', 'fxm_raster']], params: [
      { id: 'amount', label: 'Bubble amount', def: 100, min: 0, max: 10000, dec: 0 },
      { id: 'speed', label: 'Bubble speed', def: .5, min: -10, max: 10, dec: 2 },
      { id: 'wobbleAmp', label: 'Wobble amplitude', def: 5, min: 0, max: 500, dec: 1 },
      { id: 'wobbleFreq', label: 'Wobble frequency', def: 1, min: 0, max: 50, dec: 2 },
      { id: 'size', label: 'Bubble size', def: 1, min: 0, max: 20, dec: 2 },
      { id: 'reflection', label: 'Reflection type', type: 'pick', def: 0, opts: [[0, 'Liquid'], [1, 'Metal']] },
      { id: 'shading', label: 'Shading type', type: 'pick', def: 0, opts: fxOpts(['None', 'Lighten', 'Darken', 'Fade inwards', 'Fade outwards']) }],
    run: fxBubbles },
  ccdrizzle: { name: 'CC Drizzle', cat: 'Simulation', clip: true, kernels: [['fx_particles', 'fxm_drizzle']], params: [
      { id: 'rate', label: 'Drip rate', def: 10, min: 0, max: 200, dec: 2 },
      { id: 'longevity', label: 'Longevity (sec)', def: 1, min: 0, max: 30, dec: 2 },
      { id: 'rippling', label: 'Rippling°', def: 360, min: -3600, max: 3600, dec: 1 },
      { id: 'displacement', label: 'Displacement', def: 5, min: 0, max: 100, dec: 2 },
      { id: 'rippleHeight', label: 'Ripple height', def: 30, min: 0, max: 200, dec: 1 },
      { id: 'spreading', label: 'Spreading', def: 100, min: 0, max: 1000, dec: 1 },
      { id: 'intensity', label: 'Light intensity %', def: 100, min: 0, max: 400, dec: 1 },
      { id: 'lightColor', label: 'Light color', type: 'color', def: '#ffffff' },
      { id: 'lightHeight', label: 'Light height', def: 25, min: -100, max: 100, dec: 1 },
      { id: 'lightDir', label: 'Light direction°', def: -45, min: -3600, max: 3600, dec: 1 },
      { id: 'ambient', label: 'Ambient %', def: 0, min: -200, max: 200, dec: 1 },
      { id: 'diffuse', label: 'Diffuse %', def: 0, min: 0, max: 200, dec: 1 },
      { id: 'specular', label: 'Specular %', def: 20, min: 0, max: 200, dec: 1 },
      { id: 'roughness', label: 'Roughness', def: .05, min: .001, max: 1, dec: 3 }],
    run: fxDrizzle },
  ccstarburst: { name: 'CC Star Burst', cat: 'Simulation', clip: true, kernels: WEATHER_K, params: [
      { id: 'scatter', label: 'Scatter', def: 100, min: 0, max: 1000, dec: 1 },
      { id: 'speed', label: 'Speed', def: 1, min: -10, max: 10, dec: 2 },
      { id: 'phase', label: 'Phase°', def: 0, min: -3600, max: 3600, dec: 1 },
      { id: 'spacing', label: 'Grid spacing', def: 2, min: 1, max: 100, dec: 0 },
      { id: 'size', label: 'Size', def: 100, min: 0, max: 1000, dec: 1 },
      { id: 'blend', label: 'Blend with original %', def: 0, min: 0, max: 100, dec: 1 }],
    run: fxStarBurst },
  cchair: { name: 'CC Hair', cat: 'Simulation', clip: false, kernels: WEATHER_K, params: [
      { id: 'length', label: 'Length', def: 30, min: 0, max: 2000, dec: 1 },
      { id: 'thickness', label: 'Thickness', def: 1, min: .05, max: 20, dec: 2 },
      { id: 'weight', label: 'Weight', def: .2, min: -10, max: 10, dec: 2 },
      { id: 'constantMass', label: 'Constant mass', type: 'check', def: false },
      { id: 'density', label: 'Density', def: 100, min: 0, max: 10000, dec: 1 },
      { id: 'mapStrength', label: 'Hairfall map strength %', def: 0, min: 0, max: 100, dec: 1 },
      fxLayerPick('mapLayer', 'Hairfall map layer', 'None'),
      { id: 'mapSoftness', label: 'Hairfall map softness', def: 0, min: 0, max: 1000, dec: 1 },
      { id: 'addNoise', label: 'Hairfall add noise %', def: 0, min: 0, max: 100, dec: 1 },
      { id: 'hairColor', label: 'Hair color', type: 'color', def: '#594026' },
      { id: 'brightness', label: 'Brightness %', def: 100, min: 0, max: 4000, dec: 1 },
      { id: 'opacity', label: 'Opacity %', def: 100, min: 0, max: 100, dec: 1 },
      { id: 'inheritance', label: 'Color inheritance %', def: 0, min: 0, max: 100, dec: 1 },
      { id: 'intensity', label: 'Light intensity %', def: 100, min: 0, max: 4000, dec: 1 },
      { id: 'lightDir', label: 'Light direction°', def: -45, min: -3600, max: 3600, dec: 1 },
      { id: 'ambient', label: 'Ambient %', def: 40, min: 0, max: 100, dec: 1 },
      { id: 'diffuse', label: 'Diffuse %', def: 60, min: 0, max: 100, dec: 1 },
      { id: 'specular', label: 'Specular %', def: 30, min: 0, max: 100, dec: 1 },
      { id: 'roughness', label: 'Roughness %', def: 20, min: 0, max: 100, dec: 1 },
      { id: 'seed', label: 'Random seed', def: 0, min: 0, max: 10000, dec: 0 }],
    run: fxHair },
  // the particles replace the layer, as in After Effects
  particleplayground: { name: 'Particle Playground', cat: 'Simulation', clip: false, kernels: [...WEATHER_K, ['lumina_sim', 'lsm_blit']], params: [
""" + PG_PARAMS + """
    run: fxPlayground },
"""
rep("""  // ---- Round 26: Simulation, particles (EffectCraft's sim/: CC Particle World, CC Particle Systems II, CC Mr. Mercury).""",
    EFFECTS + """  // ---- Round 26: Simulation, particles (EffectCraft's sim/: CC Particle World, CC Particle Systems II, CC Mr. Mercury).""")

if crlf: s = s.replace('\n', '\r\n')
io.open(p, 'wb').write(s.encode('utf-8')); print('ok')
