import io
p = r'D:\Lumina\Lumina.html'
raw = io.open(p, 'rb').read(); crlf = b'\r\n' in raw
s = raw.decode('utf-8').replace('\r\n', '\n')
def rep(a, b):
    global s
    assert s.count(a) == 1, (a[:80], s.count(a)); s = s.replace(a, b)

# ---- kernel families
rep("""  lumina_time: ['lumina_time'] };""", """  lumina_time: ['lumina_time'],       // Round 25: motion vectors, Time Displacement, Deblur, Rolling Shutter Repair (shaders/)
  lumina_sim: ['lumina_sim'] };       // Round 26: CC Particle World's textured squares (shaders/)""")
rep("""lumina_time: 'shaders/lumina_time.wgsl' };""", """lumina_time: 'shaders/lumina_time.wgsl', lumina_sim: 'shaders/lumina_sim.wgsl' };""")

HELPERS = r"""// ---- Round 26 helpers (Simulation, particles): EffectCraft's sim/engine.rs (the stepped particle engine),
//      sim/particle_fx.rs (CC Particle World, CC Particle Systems II, CC Mr. Mercury), sim/sprites.rs (the sprite shapes)
//      and util.rs (SimCache); GPU host code from fx_sim.rs and fx_particles.rs (fxp_raster, fxm_raster, fxm_mercury) ----
// generate::lattice and value_noise: 3D value noise, 0 to 1, with the quintic fade on every axis
function fxLattice(ix, iy, iz, seed) {
  let h = (Math.imul(ix, 0x27d4eb2d) ^ Math.imul(iy, 0x165667b1) ^ Math.imul(iz, 0x9e3779b9) ^ Math.imul(seed, 0x85ebca6b)) >>> 0;
  h = (h ^ (h >>> 15)) >>> 0; h = Math.imul(h, 0x2c1b3c6d) >>> 0; h = (h ^ (h >>> 12)) >>> 0; h = Math.imul(h, 0x297a2d39) >>> 0; h = (h ^ (h >>> 15)) >>> 0;
  return (h & 0xffff) / 65535;
}
const fxFade5 = t => t * t * t * (t * (t * 6 - 15) + 10);
function fxValueNoise(x, y, z, seed) {
  const x0 = Math.floor(x), y0 = Math.floor(y), z0 = Math.floor(z), fx = fxFade5(x - x0), fy = fxFade5(y - y0), fz = fxFade5(z - z0);
  const c = (a, b, d) => fxLattice(x0 + a, y0 + b, z0 + d, seed), l = (a, b, t) => a + (b - a) * t;
  return l(l(l(c(0, 0, 0), c(1, 0, 0), fx), l(c(0, 1, 0), c(1, 1, 0), fx), fy), l(l(c(0, 0, 1), c(1, 0, 1), fx), l(c(0, 1, 1), c(1, 1, 1), fx), fy), fz);
}
// The particle systems are stepped from layer time 0 at 60 steps a second, so any frame can be drawn directly and is the
// same frame scrubbing or playing reaches. Checkpoints every 15 steps (util::SimCache) keep scrubbing quick.
const PS_SPS = 60, PS_CP = 15, PS_CACHE = []; let PS_TICK = 0;
const fxStepsAt = t => t <= 0 ? 0 : Math.floor(t * PS_SPS + 1e-6);
const PW_ANIMS = ['Explosive', 'Direction Axis', 'Cone Axis', 'Viscouse', 'Twirly', 'Vortex', 'Fire', 'Jet Sideways', 'Fractal Omni', 'Fractal Uni'];
const PARTICLE_TYPES = ['Line', 'Shaded Sphere', 'Faded Sphere', 'Bubble', 'Star', 'Motion Polygon', 'Tri-Polygon', 'Cube', 'Textured Square'];
const PS_TRANSFER = ['Composite', 'Screen', 'Add', 'Black Matte'];
const fxPsNorm = v => { const l = Math.hypot(v[0], v[1], v[2]); return l > 1e-9 ? [v[0] / l, v[1] / l, v[2] / l] : [0, -1, 0]; };
const fxH = (i, k, seed) => fxHash(i >>> 0, k >>> 0, seed >>> 0);
function fxRandDir(i, k, seed, flat) {
  if (flat) { const a = fxH(i, k, seed) * 2 * Math.PI; return [Math.cos(a), Math.sin(a), 0]; }
  const z = fxH(i, k, seed) * 2 - 1, a = fxH(i, k + 1, seed) * 2 * Math.PI, r = Math.sqrt(Math.max(0, 1 - z * z));
  return [r * Math.cos(a), r * Math.sin(a), z];
}
// Phys::spawn: a particle born in the producer's ellipsoid, heading as the Animation sends it
function fxPsSpawn(ph, id) {
  const seed = ph.seed, u = fxRandDir(id, 1, seed, ph.flat), rr = fxH(id, 3, seed) ** (ph.flat ? .5 : 1 / 3);
  const p = [0, 1, 2].map(k => ph.producer[k] + u[k] * ph.radius[k] * rr); if (ph.flat) p[2] = 0;
  const ax = fxPsNorm(ph.axis), j = fxRandDir(id, 5, seed, ph.flat);
  let dir;
  switch (ph.anim) {
    case 1: case 9: dir = fxPsNorm([ax[0] + j[0] * .08, ax[1] + j[1] * .08, ax[2] + j[2] * .08]); break;
    case 2: { const k = Math.min(Math.abs(Math.tan(ph.extraAngle * Math.PI / 180 * .5)), 20), hh = fxH(id, 8, seed); dir = fxPsNorm([ax[0] + j[0] * k * hh, ax[1] + j[1] * k * hh, ax[2] + j[2] * k * hh]); break; }
    case 5: dir = [j[0], 0, ph.flat ? 0 : j[2]]; break;
    case 6: dir = fxPsNorm([j[0] * .25, -1, j[2] * .25]); break;
    case 7: dir = fxPsNorm([1, j[1] * .05, j[2] * .05]); break;
    default: dir = j;
  }
  const sp = ph.speed * (.5 + .5 * fxH(id, 9, seed)), v = dir.map(d => d * sp); if (ph.flat) v[2] = 0;
  return { p, v, age: 0, life: ph.life * (.8 + .4 * fxH(id, 10, seed)), rnd: fxH(id, 11, seed), id };
}
// the birth-rate history the state was reached with (a checkpoint is only resumed from with the same rates)
const PS_F64 = new Float64Array(1), PS_U32 = new Uint32Array(PS_F64.buffer);
function fxRatesHash(hist, rate) {
  PS_F64[0] = rate; const h = Math.imul((hist ^ PS_U32[0] ^ Math.imul(PS_U32[1], 0x9e3779b1)) >>> 0, 0x01000193) >>> 0;
  return ((h << 5) | (h >>> 27)) >>> 0;
}
// Phys::step_at_rate: everyone alive moves and ages one step; then `rate` particles a second are born
function fxPsStep(ph, st, step, rate) {
  const dt = 1 / PS_SPS, t = step * dt, seed = ph.seed, P0 = ph.producer, g = ph.gravity, ex = ph.extra, flat = ph.flat;
  let drag = ph.resistance; if (ph.anim === 3) drag += 3 * Math.max(ex, .1);
  const damp = Math.exp(-drag * dt);
  for (const q of st.parts) {
    const p = q.p, v = q.v; let a0 = g[0], a1 = g[1], a2 = g[2];
    switch (ph.anim) {
      case 4: {   // Twirly: a swirl round the vertical axis through the producer
        const dx = p[0] - P0[0], dz = p[2] - P0[2], k = 4 * ex; a0 += -dz * k; a2 += dx * k;
        if (flat) { const dy = p[1] - P0[1]; a0 += -dy * k; a1 += dx * k; }
        break;
      }
      case 5: { const dx = p[0] - P0[0], dy = p[1] - P0[1], k = 6 * ex; a0 += -dy * k - dx * 2; a1 += dx * k - dy * 2; break; }   // Vortex
      case 6: { const n = fxValueNoise(p[0] * 8, p[1] * 8, t * 3, seed) - .5; a0 += n * 4 * ex; a1 -= g[1] * 1.5 + .3 * ex; break; }   // Fire
      case 8: case 9: {   // Fractal Omni / Uni
        const f = 6 * ex;
        a0 += (fxValueNoise(p[0] * 5, p[1] * 5, p[2] * 5 + t, seed) - .5) * f;
        a1 += (fxValueNoise(p[0] * 5 + 17, p[1] * 5, p[2] * 5 + t, seed) - .5) * f;
        if (!flat) a2 += (fxValueNoise(p[0] * 5, p[1] * 5 + 31, p[2] * 5 + t, seed) - .5) * f;
        break;
      }
    }
    v[0] = (v[0] + a0 * dt) * damp; v[1] = (v[1] + a1 * dt) * damp; v[2] = (v[2] + a2 * dt) * damp;
    p[0] += v[0] * dt; p[1] += v[1] * dt; p[2] += v[2] * dt;
    if (flat) { p[2] = 0; v[2] = 0; }
    q.age += dt;
  }
  st.parts = st.parts.filter(q => q.age < q.life);
  st.hist = fxRatesHash(st.hist, rate);
  st.carry += rate / PS_SPS; const n = Math.floor(st.carry); st.carry -= n;
  for (let i = 0; i < n && st.parts.length < ph.max; i++) {
    const id = st.next; st.next = (st.next + 1) >>> 0;
    // a birth part-way through the step keeps a steady stream smooth
    const q = fxPsSpawn(ph, id), frac = fxH(id, 12, seed) * dt;
    for (let k = 0; k < 3; k++) q.p[k] += q.v[k] * frac;
    q.age = frac; st.parts.push(q);
  }
}
const fxPsClone = st => ({ ...st, parts: st.parts.map(q => ({ p: q.p.slice(), v: q.v.slice(), age: q.age, life: q.life, rnd: q.rnd, id: q.id })) });
// SimCache::run_where: the state after rates.length steps, from the latest checkpoint reached with the same rates
function fxPsRun(key, ph, rates) {
  const target = rates.length, pre = [0], tick = ++PS_TICK;
  for (const r of rates) pre.push(fxRatesHash(pre[pre.length - 1], r));
  let e = PS_CACHE.find(x => x.key === key), start = null;
  if (e) {
    e.used = tick;
    if (e.last && e.last[0] === target && pre[target] === e.last[1].hist) return e.last[1];
    for (const [s, st] of e.cps) if (s <= target && pre[s] === st.hist && (!start || s > start[0])) start = [s, st];
    if (e.last && e.last[0] <= target && pre[e.last[0]] === e.last[1].hist && (!start || e.last[0] > start[0])) start = e.last;
  } else {
    if (PS_CACHE.length >= 6) PS_CACHE.splice(PS_CACHE.indexOf(PS_CACHE.reduce((a, b) => a.used <= b.used ? a : b)), 1);
    e = { key, used: tick, cps: new Map(), last: null }; PS_CACHE.push(e);
  }
  let i = start ? start[0] : 0; const st = start ? fxPsClone(start[1]) : { parts: [], carry: 0, next: 0, hist: 0 };
  if (!start) e.cps.set(0, fxPsClone(st));
  while (i < target) { fxPsStep(ph, st, i, rates[i]); i++; if (i % PS_CP === 0 && i !== target && !e.cps.has(i)) e.cps.set(i, fxPsClone(st)); }
  e.last = [target, st];
  return st;
}
// rate_history: the Birth Rate of each step up to now, sampled where the step starts (a keyframed rate only decides the
// births of its own time); a rate without keyframes is the same at every step
function fxPsRates(E, q, k) {
  const n = fxStepsAt(E.t), key = fxKey(E.fx, 'birthRate'), ks = E.L.keys?.[key];
  const one = v => Number.isFinite(v) ? Math.max(0, v) * k : 0;
  if (!(ks && ks.length > 1)) return new Array(n).fill(one(q('birthRate')));
  const off = E.T - E.t, out = new Array(n);
  for (let i = 0; i < n; i++) out[i] = one(val(E.L, key, i / PS_SPS + off));
  return out;
}
// a point in the layer's own pixels (0, 0 at its top left) → frame pixels, a direction the same way, and back
// (EffectCraft's Buf::to_px, turned with the layer)
const fxLp = (E, x, y) => { const m = E.m, a = x - E.bw / 2, b = y - E.bh / 2; return [m.a * a + m.c * b + m.e, m.b * a + m.d * b + m.f]; };
const fxLv = (E, x, y) => [E.m.a * x + E.m.c * y, E.m.b * x + E.m.d * y];
const fxPl = (E, P) => { const r = E.m.inverse().transformPoint(new DOMPoint(P[0], P[1])); return [r.x + E.bw / 2, r.y + E.bh / 2]; };
// the stepped system's particles now. The simulation is kept per effect settings (`ids`, now; points in the layer's own
// pixels, so moving the layer doesn't start it over) and per layer size; Birth Rate is checked through its history
function fxPsState(E, q, ph, salt, k, ids) {
  const D = FX[E.fx.id], vals = ids.map(id => { const d = D.params.find(x => x.id === id), v = q(id); return d?.type === 'pt' ? fxPl(E, v).map(x => +x.toFixed(4)) : v; });
  return fxPsRun(JSON.stringify([salt, E.bw, E.bh, fxSeed(E), vals]), ph, fxPsRates(E, q, k));
}
// particle_look: colour, opacity and size at the particle's age
function fxPsLook(q, birth, death, bs, ds, svar, maxOp) {
  const u = clamp(q.age / Math.max(q.life, 1e-4), 0, 1), size = (bs + (ds - bs) * u) * (1 + svar * (q.rnd * 2 - 1));
  const fade = Math.min(u * 20, 1) * Math.min((1 - u) * 5, 1);
  return [[birth[0] + (death[0] - birth[0]) * u, birth[1] + (death[1] - birth[1]) * u, birth[2] + (death[2] - birth[2]) * u, maxOp * fade], Math.max(size, 0)];
}
// type_sprite: the Particle Type as a sprite (shape numbers as fx_sim's sprite_layer: 0 Soft, 1 Disc, 2 Sphere, 3 Faded,
// 4 Bubble, 5 Star, 6 Square, 7 Tri, 8 Line)
function fxTypeSprite(kind, x, y, r, c, vx, vy, rot) {
  const vl = Math.max(Math.hypot(vx, vy), 1e-6);
  const [shape, dx, dy] = kind === 0 ? [8, -vx / vl * r * 2, -vy / vl * r * 2] : kind === 5 ? [8, -vx * .05, -vy * .05] : [[0, 2, 3, 4, 5, 0, 7][kind] ?? 6, 0, 0];
  return { x, y, r: kind === 0 ? Math.max(r * .08, .5) : kind === 5 ? r * .5 : r, c, shape, dx, dy, rot };
}
// sim::sprite_bbox
function fxSpriteBox(s) {
  if (s.c[3] <= 1e-5 || s.r <= 0) return null;
  const r = Math.max(s.r, .5) + 1;
  return s.shape === 8 ? [Math.min(s.x, s.x + s.dx) - r, Math.min(s.y, s.y + s.dy) - r, Math.max(s.x, s.x + s.dx) + r, Math.max(s.y, s.y + s.dy) + r]
    : s.shape === 5 ? [s.x - r * 2, s.y - r * 2, s.x + r * 2, s.y + r * 2] : [s.x - r, s.y - r, s.x + r, s.y + r];
}
// fx_particles' Chunked raster: items drawn by `entry` over a base (transparent at first), in a new pass whenever the item
// table would outgrow one kernel's data. `rec(item)` gives [bounds, record]; f = the kernel's float rows
function fxChunked(E, img, items, stride, fam, entry, u0, rec, f = {}, aux = null) {
  let base = E.clear(img), it = fxItems(E, stride), used = it.tiles.length + 1;
  const room = (1 << 24) - 64;
  const flush = () => {
    const D = fxItemData(it);
    if (D && it.n) {
      // fxp_raster reads the base as aux; lsm_texsq reads it as src, the texture as aux
      const P = fxP({ 0: [0, u0, D.at, stride], 1: [it.tx, 0, 0, 0] }, f);
      const o = aux ? E.run(fam, entry, P, base, aux, null, E.data(D.d)) : E.run(fam, entry, P, img, base, null, E.data(D.d));
      E.free(base); base = o;
    }
    it = fxItems(E, stride); used = it.tiles.length + 1;
  };
  for (const x of items) {
    const [bb, r] = rec(x); if (!bb) continue;
    const x0 = Math.max(0, Math.floor(bb[0])), y0 = Math.max(0, Math.floor(bb[1])), x1 = Math.min(E.w - 1, Math.ceil(bb[2])), y1 = Math.min(E.h - 1, Math.ceil(bb[3]));
    if (x1 < x0 || y1 < y0) continue;
    const need = ((x1 >> 4) - (x0 >> 4) + 1) * ((y1 >> 4) - (y0 >> 4) + 1) + stride;
    if (used + need > room && it.n) flush();
    fxItemPush(it, bb, r); used += need;
  }
  if (it.n) flush();
  return base;
}
// fx_sim::sprite_layer: the sprites over a transparent frame (fxp_raster, kind 0), added together or one over another
const fxSprites = (E, img, sprites, add) => fxChunked(E, img, sprites, 16, 'fx_particles', 'fxp_raster', add ? 1 : 0,
  s => [fxSpriteBox(s), [s.shape, s.x, s.y, s.r, s.c[0], s.c[1], s.c[2], s.c[3], s.rot, s.dx, s.dy, 0]]);
const PS_K = [['fx_particles', 'fxp_raster'], ['kernels', 'fill']];
// CC Particle World's physics (pw_phys); world units are layer widths, y down, the layer's centre at the origin
function fxPwPhys(E, q) {
  const g = q('gravity');
  return { rate: Math.max(0, q('birthRate')) * 120, life: Math.max(0, q('longevity')), producer: [q('producerX'), q('producerY'), q('producerZ')],
    radius: [q('radiusX'), q('radiusY'), q('radiusZ')].map(v => Math.max(0, v)), anim: q('animation'), speed: q('velocity') * .5,
    gravity: [q('gravityX') * g, q('gravityY') * g, q('gravityZ') * g], resistance: Math.max(0, q('resistance')), axis: [q('axisX'), q('axisY'), q('axisZ')],
    extra: q('extra'), extraAngle: q('extraAngle'), seed: (Math.imul(Math.max(0, Math.trunc(q('seed'))) >>> 0, 0x9e3779b9) ^ fxSeed(E)) >>> 0, max: 40000, flat: false };
}
const PW_SIM = ['longevity', 'producerX', 'producerY', 'producerZ', 'radiusX', 'radiusY', 'radiusZ', 'animation', 'velocity', 'gravity', 'resistance', 'extra',
  'extraAngle', 'axisX', 'axisY', 'axisZ', 'gravityX', 'gravityY', 'gravityZ', 'seed'];
// particle_world_plan: the particles through the Effect Camera, far to near (null before anything is born). The camera
// keeps the origin's plane at the scale Distance gives it as FOV changes, so FOV sets how strong the perspective is;
// Distance 2 shows the origin's plane at the layer's own scale
function fxPwSprites(E, q) {
  const ph = fxPwPhys(E, q); if (ph.rate <= 0 && E.t <= 0) return null;
  const st = fxPsState(E, q, ph, 1, 120, PW_SIM);
  const kind = q('particleType'), birth = q('birthColor'), death = q('deathColor'), bs = q('birthSize'), ds = q('deathSize'), svar = q('sizeVariation') / 100, maxOp = q('maxOpacity') / 100;
  const half = f => Math.tan(clamp(f, 1, 179) * Math.PI / 180 * .5), zoom = half(50) / half(q('fov')), dist = Math.max(q('camDistance'), .01) * zoom;
  const ang = [q('camRotX'), q('camRotY'), q('camRotZ')], R = ang.some(v => v) ? fxRotOrdered(...ang.map(a => a * Math.PI / 180), 0) : null;
  const turn = v => R.map(r => r[0] * v[0] + r[1] * v[1] + r[2] * v[2]), focal = 2 * zoom, near = .025 * dist, bw = E.bw, list = [];
  for (const p of st.parts) {
    const P = R ? turn(p.p) : p.p, V = R ? turn(p.v) : p.v, zc = dist + P[2];
    if (!(zc > near)) continue;
    const k = focal / zc, [x, y] = fxLp(E, E.bw / 2 + P[0] * bw * k, E.bh / 2 + P[1] * bw * k), [c, size] = fxPsLook(p, birth, death, bs, ds, svar, maxOp);
    const [vx, vy] = fxLv(E, V[0] * bw * k, V[1] * bw * k);
    list.push([zc, fxTypeSprite(kind, x, y, size * .5 * bw * k * E.sc * .25, c, vx, vy, (p.id % 628) * .01 + p.age * 2 + E.rot)]);
  }
  list.sort((a, b) => b[0] - a[0]);
  return list.map(x => x[1]);
}
// CC Particle Systems II's and CC Mr. Mercury's physics (flat: z stays 0); a unit is the layer's height. AE angles: 0° up, clockwise
function fxPs2Phys(E, q, o) {
  const unit = Math.max(E.bh, 1), pos = fxPl(E, q(o.pos)), dir = q('direction') * Math.PI / 180;
  return { rate: Math.max(0, q('birthRate')) * o.k, life: Math.max(0, q('longevity')), producer: [pos[0] / unit, pos[1] / unit, 0],
    radius: [Math.max(0, q('radiusX')) / unit, Math.max(0, q('radiusY')) / unit, 0], anim: Math.min(9, q('animation')), speed: q('velocity') * o.v,
    gravity: [0, q('gravity') * .5, 0], resistance: Math.max(0, q('resistance')), axis: [Math.sin(dir), -Math.cos(dir), 0], extra: q('extra'),
    extraAngle: 45 * q('extra'), seed: o.seed, max: o.max, flat: true };
}
const PS2_SIM = ['longevity', 'position', 'radiusX', 'radiusY', 'animation', 'velocity', 'gravity', 'resistance', 'direction', 'extra', 'seed'];
const MERCURY_SIM = ['radiusX', 'radiusY', 'producer', 'direction', 'velocity', 'longevity', 'gravity', 'resistance', 'extra', 'animation'];
// particle_systems2_plan
function fxPs2Sprites(E, q) {
  const unit = Math.max(E.bh, 1), ph = fxPs2Phys(E, q, { pos: 'position', k: 60, v: .25, max: 40000, seed: (Math.imul(Math.max(0, Math.trunc(q('seed'))) >>> 0, 0x85ebca6b) ^ fxSeed(E)) >>> 0 });
  const st = fxPsState(E, q, ph, 2, 60, PS2_SIM);
  const kind = q('particleType'), birth = q('birthColor'), death = q('deathColor'), bs = q('birthSize'), ds = q('deathSize'), svar = q('sizeVariation') / 100, maxOp = q('maxOpacity') / 100;
  return st.parts.map(p => {
    const [x, y] = fxLp(E, p.p[0] * unit, p.p[1] * unit), [c, size] = fxPsLook(p, birth, death, bs, ds, svar, maxOp), [vx, vy] = fxLv(E, p.v[0] * unit, p.v[1] * unit);
    return fxTypeSprite(kind, x, y, size * unit * .02 * E.sc, c, vx, vy, (p.id % 628) * .01 + p.age * 2 + E.rot);
  });
}
// mercury_blobs: this frame's blobs (frame pixels)
function fxMercuryBlobs(E, q) {
  const unit = Math.max(E.bh, 1), ph = fxPs2Phys(E, q, { pos: 'producer', k: 10, v: .3, max: 4000, seed: Math.imul(fxSeed(E), 0xc2b2ae35) >>> 0 });
  const st = fxPsState(E, q, ph, 3, 10, MERCURY_SIM), bs = q('blobBirthSize'), ds = q('blobDeathSize'), out = [];
  for (const p of st.parts) {
    const u = clamp(p.age / Math.max(p.life, 1e-4), 0, 1), [x, y] = fxLp(E, p.p[0] * unit, p.p[1] * unit), r = Math.max(0, (bs + (ds - bs) * u) * unit * .08 * E.sc);
    if (r > .1) out.push({ x, y, r });
  }
  return out;
}
// CC Particle World's Textured Square with a Texture Layer: each square shows that layer stretched over it, turned with it
// (splat_textured; lsm_texsq in shaders/lumina_sim.wgsl)
function fxTexSquares(E, img, sprites, tex, box, add) {
  return fxChunked(E, img, sprites, 16, 'lumina_sim', 'lsm_texsq', add ? 1 : 0, s => [s.c[3] > 1e-5 && s.r > 0 ? [s.x - s.r - 2, s.y - s.r - 2, s.x + s.r + 2, s.y + s.r + 2] : null,
    [s.x, s.y, s.r, s.c[3], s.rot]], { 0: box }, tex);
}
"""
rep("""// ---- Round 25 helpers (Time): EffectCraft's time_fx.rs""", HELPERS + """// ---- Round 25 helpers (Time): EffectCraft's time_fx.rs""")

EFFECTS = r"""  // ---- Round 26: Simulation, particles (EffectCraft's sim/: CC Particle World, CC Particle Systems II, CC Mr. Mercury).
  // The particles replace the layer, as in After Effects; the Transfer Mode sets how they meet each other
  ccparticleworld: { name: 'CC Particle World', cat: 'Simulation', clip: false, kernels: [...PS_K, ['lumina_sim', 'lsm_texsq']], params: [
      { id: 'birthRate', label: 'Birth rate', def: .5, min: 0, max: 100, dec: 2 },
      { id: 'longevity', label: 'Longevity (sec)', def: 1, min: 0, max: 100, dec: 2 },
      { id: 'producerX', label: 'Producer position X', def: 0, min: -10, max: 10, dec: 2 },
      { id: 'producerY', label: 'Producer position Y', def: 0, min: -10, max: 10, dec: 2 },
      { id: 'producerZ', label: 'Producer position Z', def: 0, min: -10, max: 10, dec: 2 },
      { id: 'radiusX', label: 'Producer radius X', def: .025, min: 0, max: 10, dec: 3 },
      { id: 'radiusY', label: 'Producer radius Y', def: .025, min: 0, max: 10, dec: 3 },
      { id: 'radiusZ', label: 'Producer radius Z', def: .025, min: 0, max: 10, dec: 3 },
      { id: 'animation', label: 'Animation', type: 'pick', def: 0, opts: fxOpts(PW_ANIMS) },
      { id: 'velocity', label: 'Velocity', def: 1, min: -10, max: 10, dec: 2 },
      { id: 'inheritVelocity', label: 'Inherit velocity %', def: 0, min: -100, max: 100, dec: 1 },
      { id: 'gravity', label: 'Gravity', def: .5, min: -10, max: 10, dec: 3 },
      { id: 'resistance', label: 'Resistance', def: 0, min: 0, max: 20, dec: 2 },
      { id: 'extra', label: 'Extra', def: 1, min: 0, max: 10, dec: 2 },
      { id: 'extraAngle', label: 'Extra angle°', def: 360, min: -3600, max: 3600, dec: 1 },
      { id: 'axisX', label: 'Direction axis X', def: 0, min: -1, max: 1, dec: 2 },
      { id: 'axisY', label: 'Direction axis Y', def: -1, min: -1, max: 1, dec: 2 },
      { id: 'axisZ', label: 'Direction axis Z', def: 0, min: -1, max: 1, dec: 2 },
      { id: 'gravityX', label: 'Gravity vector X', def: 0, min: -1, max: 1, dec: 2 },
      { id: 'gravityY', label: 'Gravity vector Y', def: 1, min: -1, max: 1, dec: 2 },
      { id: 'gravityZ', label: 'Gravity vector Z', def: 0, min: -1, max: 1, dec: 2 },
      { id: 'particleType', label: 'Particle type', type: 'pick', def: 0, opts: fxOpts(PARTICLE_TYPES) },
      fxLayerPick('textureLayer', 'Texture layer (Textured Square)', 'None'),
      { id: 'birthSize', label: 'Birth size', def: .2, min: 0, max: 10, dec: 3 },
      { id: 'deathSize', label: 'Death size', def: .2, min: 0, max: 10, dec: 3 },
      { id: 'sizeVariation', label: 'Size variation %', def: 0, min: 0, max: 100, dec: 1 },
      { id: 'maxOpacity', label: 'Max opacity %', def: 75, min: 0, max: 100, dec: 1 },
      { id: 'birthColor', label: 'Birth color', type: 'color', def: '#ffff00' },
      { id: 'deathColor', label: 'Death color', type: 'color', def: '#990000' },
      { id: 'transferMode', label: 'Transfer mode', type: 'pick', def: 0, opts: fxOpts(PS_TRANSFER) },
      { id: 'camDistance', label: 'Effect camera distance', def: 2, min: 0, max: 100, dec: 2 },
      { id: 'camRotX', label: 'Effect camera rotation X°', def: 0, min: -3600, max: 3600, dec: 1 },
      { id: 'camRotY', label: 'Effect camera rotation Y°', def: 0, min: -3600, max: 3600, dec: 1 },
      { id: 'camRotZ', label: 'Effect camera rotation Z°', def: 0, min: -3600, max: 3600, dec: 1 },
      { id: 'fov', label: 'Effect camera FOV°', def: 50, min: 1, max: 179, dec: 1 },
      { id: 'seed', label: 'Random seed', def: 0, min: 0, max: 10000, dec: 0 }],
    run(E, img, q) {
      const sp = fxPwSprites(E, q); if (!sp) return img;
      const add = q('transferMode') === 2, tid = q('particleType') === 8 ? q('textureLayer') : 0, tex = tid ? fxOther(E, tid, 'pwTexture') : null;
      return tex ? fxTexSquares(E, img, sp, tex, fxLayerBox(E, byId(tid)).rect, add) : fxSprites(E, img, sp, add);
    } },
  ccparticlesystems2: { name: 'CC Particle Systems II', cat: 'Simulation', clip: false, kernels: PS_K, params: [
      { id: 'birthRate', label: 'Birth rate', def: 2, min: 0, max: 100, dec: 2 },
      { id: 'longevity', label: 'Longevity (sec)', def: 1, min: 0, max: 100, dec: 2 },
      { id: 'position', label: 'Producer position', type: 'pt', def: [.5, .5] },
      { id: 'radiusX', label: 'Producer radius X', def: 0, min: 0, max: 2000, dec: 1 },
      { id: 'radiusY', label: 'Producer radius Y', def: 0, min: 0, max: 2000, dec: 1 },
      { id: 'animation', label: 'Animation', type: 'pick', def: 0, opts: fxOpts(PW_ANIMS) },
      { id: 'velocity', label: 'Velocity', def: 2, min: -20, max: 20, dec: 2 },
      { id: 'inheritVelocity', label: 'Inherit velocity %', def: 0, min: -100, max: 100, dec: 1 },
      { id: 'gravity', label: 'Gravity', def: 1, min: -20, max: 20, dec: 2 },
      { id: 'resistance', label: 'Resistance', def: 0, min: 0, max: 20, dec: 2 },
      { id: 'direction', label: 'Direction°', def: 0, min: -3600, max: 3600, dec: 1 },
      { id: 'extra', label: 'Extra', def: 1, min: 0, max: 10, dec: 2 },
      { id: 'particleType', label: 'Particle type', type: 'pick', def: 0, opts: fxOpts(PARTICLE_TYPES) },
      { id: 'birthSize', label: 'Birth size', def: .5, min: 0, max: 20, dec: 2 },
      { id: 'deathSize', label: 'Death size', def: 1.5, min: 0, max: 20, dec: 2 },
      { id: 'sizeVariation', label: 'Size variation %', def: 0, min: 0, max: 100, dec: 1 },
      { id: 'maxOpacity', label: 'Max opacity %', def: 75, min: 0, max: 100, dec: 1 },
      { id: 'birthColor', label: 'Birth color', type: 'color', def: '#ffff00' },
      { id: 'deathColor', label: 'Death color', type: 'color', def: '#990000' },
      { id: 'transferMode', label: 'Transfer mode', type: 'pick', def: 0, opts: fxOpts(PS_TRANSFER) },
      { id: 'seed', label: 'Random seed', def: 0, min: 0, max: 10000, dec: 0 }],
    run: (E, img, q) => fxSprites(E, img, fxPs2Sprites(E, q), q('transferMode') === 2) },
  // the blobs' field and its slope are added up on the graphics card (fxm_raster's blob items), then lit (fxm_mercury)
  ccmrmercury: { name: 'CC Mr. Mercury', cat: 'Simulation', clip: false, kernels: [['fx_particles', 'fxm_raster'], ['fx_particles', 'fxm_mercury']], params: [
      { id: 'radiusX', label: 'Radius X', def: 50, min: 0, max: 2000, dec: 1 },
      { id: 'radiusY', label: 'Radius Y', def: 50, min: 0, max: 2000, dec: 1 },
      { id: 'producer', label: 'Producer', type: 'pt', def: [.5, .5] },
      { id: 'direction', label: 'Direction°', def: 0, min: -3600, max: 3600, dec: 1 },
      { id: 'velocity', label: 'Velocity', def: 1, min: -20, max: 20, dec: 2 },
      { id: 'birthRate', label: 'Birth rate', def: 1, min: 0, max: 20, dec: 2 },
      { id: 'longevity', label: 'Longevity (sec)', def: 2, min: 0, max: 100, dec: 2 },
      { id: 'gravity', label: 'Gravity', def: .5, min: -20, max: 20, dec: 2 },
      { id: 'resistance', label: 'Resistance', def: 0, min: 0, max: 20, dec: 2 },
      { id: 'extra', label: 'Extra', def: 1, min: 0, max: 10, dec: 2 },
      { id: 'animation', label: 'Animation', type: 'pick', def: 0, opts: fxOpts(PW_ANIMS) },
      { id: 'blobInfluence', label: 'Blob influence %', def: 100, min: 0, max: 400, dec: 1 },
      { id: 'blobBirthSize', label: 'Blob birth size', def: .5, min: 0, max: 10, dec: 2 },
      { id: 'blobDeathSize', label: 'Blob death size', def: .25, min: 0, max: 10, dec: 2 },
      { id: 'intensity', label: 'Light intensity %', def: 100, min: 0, max: 400, dec: 1 },
      { id: 'lightColor', label: 'Light color', type: 'color', def: '#ffffff' },
      { id: 'lightHeight', label: 'Light height', def: 50, min: -100, max: 100, dec: 1 },
      { id: 'lightDir', label: 'Light direction°', def: -45, min: -3600, max: 3600, dec: 1 },
      { id: 'ambient', label: 'Ambient %', def: 0, min: -200, max: 200, dec: 1 },
      { id: 'diffuse', label: 'Diffuse %', def: 75, min: 0, max: 200, dec: 1 },
      { id: 'specular', label: 'Specular %', def: 50, min: 0, max: 200, dec: 1 },
      { id: 'roughness', label: 'Roughness', def: .05, min: .001, max: 1, dec: 3 },
      { id: 'metal', label: 'Metal %', def: 100, min: 0, max: 100, dec: 1 }],
    run(E, img, q) {
      const infl = 1 + q('blobInfluence') / 100, it = fxItems(E, 8);
      for (const b of fxMercuryBlobs(E, q)) { const ex = b.r * 2 * infl; fxItemPush(it, [b.x - ex, b.y - ex, b.x + ex, b.y + ex], [10, b.x, b.y, b.r]); }
      const D = fxItemData(it); if (!D) return img;
      const field = E.run('fx_particles', 'fxm_raster', fxP({ 0: [2, 1, D.at, 8], 1: [it.tx, 0, 0, 0] }, { 0: [infl, 0, 0, 0] }), img, null, null, E.data(D.d));
      const ld = q('lightDir') * Math.PI / 180, l = fxPsNorm([Math.sin(ld), -Math.cos(ld), Math.max(q('lightHeight') / 100, .05)]);
      const out = E.run('fx_particles', 'fxm_mercury', fxP({}, { 0: [q('ambient') / 100, q('diffuse') / 100, q('specular') / 100, Math.max(q('roughness'), .001)],
        1: [q('metal') / 100, q('intensity') / 100, E.sc, 0], 2: [...l, 0], 3: [...q('lightColor'), 0] }), img, field);
      E.free(field); return out;
    } },
"""
rep("""  // ---- Round 6: color correction (EffectCraft's pointwise kernel, modes 1, 3, 4 and 8) ----""", EFFECTS + """  // ---- Round 6: color correction (EffectCraft's pointwise kernel, modes 1, 3, 4 and 8) ----""")

if crlf: s = s.replace('\n', '\r\n')
io.open(p, 'wb').write(s.encode('utf-8')); print('ok')
