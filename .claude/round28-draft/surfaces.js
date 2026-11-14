// Caustics (surfaces::caustics_setup and fx_sim::caustics): the bottom (this layer or another, scaled, repeated, blurred)
// seen through a water surface whose height is another layer's luminance (smoothed): refracted, focused into caustics,
// lit, under the surface colour or the sky it reflects
function fxCaustics(E, img, q) {
  const s = E.sc, lw = E.lw, cx = E.m.e, cy = E.m.f;
  let bottom = q('bottom') ? fxFit(E, q('bottom'), 'cbottom', q('bottomFit') === 1) : null;
  if (!bottom) bottom = img;
  const blur = q('blur') * s; if (blur > .05) bottom = fxGauss(E, bottom, blur * .5, blur * .5, false);
  const waveH = q('waveHeight'), smoothing = q('smoothing') * s, depth = q('waterDepth'), ior = Math.max(1, q('ior'));
  // the water surface's height: its straight-colour luminance, smoothed (none: flat water)
  let height = null;
  const w = q('water') ? fxFit(E, q('water'), 'cwater', true) : null;
  if (w) { height = fxRoute(E, w, [4, 4, 4, 8]); if (smoothing > .05) height = fxGauss(E, height, smoothing * .5, smoothing * .5, true); }
  const k = waveH * depth * (1 - 1 / ior) * lw * 2, [lx, ly] = q('lightPos'), lheight = Math.max(.01, q('lightHeight')), L1 = Math.max(lw, 1);
  const sky = q('sky') ? fxFit(E, q('sky'), 'csky', q('skyFit') === 1) : null, rows = sky ? E.rows(sky) : null, dl = fxNormZ([(lx - cx) / L1, (ly - cy) / L1, lheight]);
  const P = fxP({ 0: [height ? 1 : 0, q('repeat'), q('lightType') === 1 ? 1 : 0, q('skyRepeat')], 1: [sky ? 1 : 0, rows ? rows[1] : 0, sky ? E.w : 0, sky ? E.h : 0] },
    { 0: [Math.max(.01, q('scaling')), waveH, k, lw], 1: [cx, cy, lx, ly], 2: [...q('surfColor'), q('surfOpacity')], 3: [...q('lightColor'), q('lightIntensity')],
      4: [lheight, q('causticsStrength'), q('ambient'), q('diffuse')], 5: [q('specular'), Math.max(1, q('sharp')), Math.max(.01, q('skyScaling')), q('skyIntensity')],
      6: [...dl, clamp(q('convergence'), 0, 1)] });
  return E.run('fx_particles', 'fxm_caustics', P, bottom, height, null, rows ? rows[0] : null);
}
// Wave World (surfaces::wave_world): the 2D wave equation on a grid over the layer, stepped from layer time 0 at 60 steps
// a second (after Pre-roll), driven by two producers; with a Ground layer, dry where the ground rises above Height (a
// wall the waves bounce off) and slower in shallow water; edges reflect or soak the waves up
const WAVE_CACHE = [];
function fxWaves(E, q) {
  const lw = E.bw, lh = E.bh, down = q('downsample'); let res = Math.trunc(clamp(q('gridRes'), 1, 400));
  if (down) res = Math.max(1, Math.round(res * E.sc));
  const nx = Math.max(res, 2) + 1, ny = Math.max(Math.round(res * lh / Math.max(lw, 1)), 2) + 1, N = nx * ny, rad = Math.PI / 180;
  const speed = Math.max(0, q('waveSpeed')), damping = Math.max(0, q('damping')), reflect = q('reflect'), preroll = Math.max(0, q('preroll'));
  const prods = [1, 2].map(k => {
    const p = fxPl(E, q(`p${k}Pos`));
    return { ring: q(`p${k}Type`) === 0, pos: [p[0] / Math.max(lw, 1), p[1] / Math.max(lw, 1)], len: q(`p${k}Len`), width: q(`p${k}Width`), angle: q(`p${k}Angle`) * rad,
      amp: q(`p${k}Amp`), freq: q(`p${k}Freq`), phase: q(`p${k}Phase`) * rad };
  });
  const sps = PS_SPS, cps = speed * (nx - 1), sub = clamp(Math.ceil(cps * 2 / sps), 1, 64), dt = 1 / (sps * sub), cell = 1 / (nx - 1);
  // a producer's hold on a grid point (positions in layer widths): 1 at its centre to 0 at its ring or box
  const weight = (p, x, y) => {
    const dx = x - p.pos[0], dy = y - p.pos[1], sa = Math.sin(p.angle), ca = Math.cos(p.angle), u = dx * ca + dy * sa, v = -dx * sa + dy * ca, a = Math.max(p.len * .5, 1e-3), b = Math.max(p.width * .5, 1e-3);
    return clamp(1 - (p.ring ? Math.hypot(u / a, v / b) : Math.max(Math.abs(u) / a, Math.abs(v) / b)), 0, 1);
  };
  const weights = prods.map(p => Float32Array.from({ length: N }, (_, i) => weight(p, (i % nx) * cell, Math.floor(i / nx) * cell)));
  // Ground: its first frame's luminance an elevation (× Steepness); the water depth per grid point
  const gid = q('ground'), gm = gid ? fxMapImg(E, gid, 'wwground', E.T - E.t) : null, steep = q('steepness'), level = q('groundHeight'), ws = clamp(q('waveStrength'), 0, 1);
  const depth = gm ? Float32Array.from({ length: N }, (_, i) => { const c = gm.at((i % nx) / (nx - 1) * lw, Math.floor(i / nx) / (ny - 1) * lh); return level - steep * fxLum(c[0], c[1], c[2]) * c[3]; }) : null;
  const sk = depth ? Float32Array.from(depth, v => v <= 0 ? 0 : 1 - ws * (1 - Math.sqrt(clamp(v / Math.max(level, 1e-3), 0, 1)))) : null;
  const D = FX[E.fx.id], vals = D.params.map(d => { const v = q(d.id); return d.type === 'pt' ? fxPl(E, v).map(x => +x.toFixed(4)) : v; });
  const key = JSON.stringify([lw, lh, down ? E.sc : 1, vals, gm?.key ?? 0]), sponge = Math.max(1, Math.min(4, Math.floor(nx / 4))), refl = side => reflect === 5 || reflect === side;
  const st = fxSimRun(WAVE_CACHE, key, fxStepsAt(E.t + preroll), () => ({ u: new Float32Array(N), v: new Float32Array(N) }), (w, step) => {
    const c2 = cps * cps, acc = fxScratch('waveAcc', N), U = w.u, V = w.v;
    for (let k = 0; k < sub; k++) {
      const t = (step + k / sub) / sps - preroll;
      for (let y = 0; y < ny; y++) for (let x = 0; x < nx; x++) {
        const i = y * nx + x, kk = sk ? sk[i] : 1;
        const l = U[y * nx + Math.max(x - 1, 0)] + U[y * nx + Math.min(x + 1, nx - 1)] + U[Math.max(y - 1, 0) * nx + x] + U[Math.min(y + 1, ny - 1) * nx + x] - 4 * U[i];
        acc[i] = c2 * kk * kk * l - damping * 4 * V[i];
      }
      for (let i = 0; i < N; i++) { V[i] += acc[i] * dt; U[i] += V[i] * dt; }
      // the producers drive the surface
      prods.forEach((p, pi) => {
        if (!p.amp) return;
        const target = p.amp * Math.sin(2 * Math.PI * p.freq * t + p.phase), wt = weights[pi];
        for (let i = 0; i < N; i++) if (wt[i] > 0) { U[i] += (target - U[i]) * wt[i]; V[i] *= 1 - wt[i]; }
      });
      if (sk) for (let i = 0; i < N; i++) if (sk[i] <= 0) { U[i] = 0; V[i] = 0; }
      // edges: reflective ones mirror, the others soak the waves up in a thin sponge
      for (let y = 0; y < ny; y++) for (let x = 0; x < nx; x++) {
        let f = 1;
        if (!refl(1) && x < sponge) f = Math.min(f, x / sponge);
        if (!refl(3) && nx - 1 - x < sponge) f = Math.min(f, (nx - 1 - x) / sponge);
        if (!refl(2) && y < sponge) f = Math.min(f, y / sponge);
        if (!refl(4) && ny - 1 - y < sponge) f = Math.min(f, (ny - 1 - y) / sponge);
        if (f < 1) { const i = y * nx + x, kk = .85 + .15 * f; U[i] *= kk; V[i] *= kk; }
      }
    }
  }, w => ({ u: w.u.slice(), v: w.v.slice() }));
  return { u: st.u, nx, ny, depth };
}
function fxWaveWorld(E, img, q) {
  const { u, nx, ny, depth } = fxWaves(E, q), lw = E.bw, lh = E.bh, rad = Math.PI / 180;
  if (q('view') === 1) {
    // Height Map (fx_sim::wave_height): grey from the heights; dry ground transparent if asked
    let d = u; if (depth) { d = new Float32Array(nx * ny * 2); d.set(u); d.set(depth, nx * ny); }
    const [ox, oy] = fxOff(E);
    return E.run('fx_particles', 'fxm_wave', fxP({ 0: [nx, ny, q('dryAs') === 1 && depth ? 1 : 0, 0] },
      { 0: [q('brightness'), q('contrast'), Math.max(q('gamma'), .01), 1 - q('transparency')], 1: [ox, oy, E.sc, Math.max(lw, 1)] }), img, null, null, E.data(d));
  }
  // Wireframe Preview: the grid turned by Horizontal Rotation, tilted by Vertical Rotation, heights × Vertical Scale, over black
  const hr = q('hRot') * rad, vr = q('vRot') * rad, vs = q('vScale'), sh = Math.sin(hr), ch = Math.cos(hr), sv = Math.sin(vr), cv = Math.cos(vr), lp = fxLpOf(E);
  const P = new Float64Array(nx * ny * 2);
  for (let y = 0; y < ny; y++) for (let x = 0; x < nx; x++) {
    const gx = x / (nx - 1) * lw - lw * .5, gy = y / (nx - 1) * lw - (ny - 1) / (nx - 1) * lw * .5, hgt = u[y * nx + x] * vs * lh * .5;
    const [px, py] = lp(lw * .5 + gx * ch - gy * sh, lh * .5 + (gx * sh + gy * ch) * cv - hgt * sv); P[(y * nx + x) * 2] = px; P[(y * nx + x) * 2 + 1] = py;
  }
  const lines = [];
  for (let y = 0; y < ny; y++) for (let x = 0; x < nx; x++) {
    const a = (y * nx + x) * 2;
    if (x + 1 < nx) lines.push([P[a], P[a + 1], P[a + 2] - P[a], P[a + 3] - P[a + 1], .4, .9, .4]);
    if (y + 1 < ny) { const c = a + nx * 2; lines.push([P[a], P[a + 1], P[c] - P[a], P[c + 1] - P[a + 1], .4, .9, .4]); }
  }
  return fxSpritePost(E, img, fxLines(E, img, lines, .4), ['black']);
}
// Foam (foam::foam_full_plan): bubbles born in the producer's box grow to their size, drift with the wind, turbulence
// and the Flow Map (downhill on its luminance), push apart and stick, wobble, and pop at the end of their lifespan
// (shortened for weak bubbles), shoving their neighbours; stepped from layer time 0 at 30 steps a second
const FOAM_CACHE = [], FOAM_TEXTURES = ['Default bubble', 'Spit', 'Bubblegum', 'Dishwater', 'Milky', 'User defined'];
const fxFoamPop = (id, life, frail, seed) => life * (1 - frail * (fxHs(id, 11, seed) * .5 + .5));   // foam::foam_pop_age
function fxFoam(E, img, q) {
  const lw = E.bw, lh = E.bh, unit = lw * .01, rad = Math.PI / 180, prod = fxPl(E, q('prodPoint')), psx = q('prodX') * lw, psy = q('prodY') * lh, porient = q('prodOrient') * rad;
  const rate = Math.max(0, q('rate')), size = Math.max(0, q('size')), sizeVar = q('sizeVar'), life = Math.max(1, q('lifespan')), growth = Math.max(.0001, q('growth'));
  const frail = 1 - clamp(q('strength') / 20, 0, 1), initSpeed = q('initSpeed'), initDir = q('initDir') * rad, wind = q('windSpeed'), windDir = q('windDir') * rad;
  const turb = q('turbulence'), wobble = Math.max(0, q('wobble')), repulsion = q('repulsion'), popVel = q('popVelocity'), visc = clamp(q('viscosity'), 0, 1), sticky = clamp(q('stickiness'), 0, 1);
  const universe = Math.max(.01, q('universe')), seed = (Math.imul(Math.trunc(Math.max(0, q('seed'))) >>> 0, 0x68e31da4) ^ fxSeed(E)) >>> 0, wv = [Math.sin(windDir) * wind * unit, -Math.cos(windDir) * wind * unit];
  // Flow Map: its first frame's luminance a height field, over the layer or the whole universe
  const fid = q('flowMap'), fm = fid ? fxMapImg(E, fid, 'foamflow', E.T - E.t) : null, steep = q('flowSteep'), fitsU = q('flowFits') === 1, subs = [1, 2, 4][q('quality')] || 1;
  const ux0 = -(universe - 1) * .5 * lw, uy0 = -(universe - 1) * .5 * lh, ux1 = lw - ux0, uy1 = lh - uy0;
  const hAt = (x, y) => { if (!fm) return 0; const c = fitsU ? fm.at((x - ux0) / (ux1 - ux0) * lw, (y - uy0) / (uy1 - uy0) * lh) : fm.at(x, y); return fxLum(c[0], c[1], c[2]) * c[3]; };
  const D = FX[E.fx.id], vals = D.params.map(d => { const v = q(d.id); return d.type === 'pt' ? fxPl(E, v).map(x => +x.toFixed(4)) : v; });
  const key = JSON.stringify([lw, lh, fxSeed(E), vals, fm?.key ?? 0]), rOf = b => b.size * unit * 3 * Math.min(b.age * growth, 1);
  const st = fxSimRun(FOAM_CACHE, key, E.t <= 0 ? 0 : Math.floor(E.t * 30 + 1e-6), () => ({ b: [], carry: 0, next: 0 }), (st, step) => {
    const t = step / 30;
    st.carry += rate; const n = Math.floor(st.carry); st.carry -= n;
    for (let j = 0; j < n && st.b.length < 3000; j++) {
      const id = st.next; st.next = (st.next + 1) >>> 0;
      const ux = fxHs(id, 1, seed) * .5 * psx, uy = fxHs(id, 2, seed) * .5 * psy, so = Math.sin(porient), co = Math.cos(porient);
      st.b.push({ p: [prod[0] + ux * co - uy * so, prod[1] + ux * so + uy * co], v: [Math.sin(initDir) * initSpeed * unit, -Math.cos(initDir) * initSpeed * unit], age: 0,
        size: Math.max(size * (1 + sizeVar * fxHs(id, 3, seed)), .01), spin: fxHs(id, 12, seed) * Math.PI, id });
    }
    for (let ss = 0; ss < subs; ss++) {
      const k = 1 / subs;
      // forces: toward the wind, turbulence, viscosity, the flow map's slope
      for (const b of st.b) {
        const n1 = fxValueNoise(b.p[0] / (lw * .15), b.p[1] / (lw * .15), t * .5, seed) - .5, n2 = fxValueNoise(b.p[0] / (lw * .15) + 19, b.p[1] / (lw * .15), t * .5, seed) - .5;
        for (let c = 0; c < 2; c++) { b.v[c] += (wv[c] - b.v[c]) * .1 * k; b.v[c] *= 1 - visc * .5 * k; }
        b.v[0] += n1 * turb * unit * k; b.v[1] += n2 * turb * unit * k;
        if (fm && steep) {
          const e = Math.max(unit, 1), gx = (hAt(b.p[0] + e, b.p[1]) - hAt(b.p[0] - e, b.p[1])) / (2 * e), gy = (hAt(b.p[0], b.p[1] + e) - hAt(b.p[0], b.p[1] - e)) / (2 * e);
          b.v[0] -= gx * steep * lw * .5 * k; b.v[1] -= gy * steep * lw * .5 * k;
        }
        b.spin += b.v[0] / Math.max(rOf(b), .5) * k;   // Physical Orientation: bubbles roll with their sideways motion
      }
      // overlapping bubbles push apart (a hashed grid, in a fixed order)
      if (repulsion > 0 && st.b.length > 1) {
        const maxr = Math.max(st.b.reduce((m, b) => Math.max(m, rOf(b)), 0), 1), cs = maxr * 2, grid = new Map(), cellOf = b => [Math.floor(b.p[0] / cs), Math.floor(b.p[1] / cs)];
        st.b.forEach((b, i) => { const [gx, gy] = cellOf(b), kk = gx * 1e6 + gy; (grid.get(kk) || grid.set(kk, []).get(kk)).push(i); });
        const push = st.b.map(() => [0, 0]);
        st.b.forEach((b, i) => {
          const [gx, gy] = cellOf(b), rb = rOf(b);
          for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) for (const j of grid.get((gx + dx) * 1e6 + gy + dy) || []) {
            if (j <= i) continue;
            const o = st.b[j], ddx = o.p[0] - b.p[0], ddy = o.p[1] - b.p[1], d = Math.max(Math.hypot(ddx, ddy), 1e-4), ov = rb + rOf(o) - d;
            if (ov > 0) { const f = ov * .5 * Math.min(repulsion, 4) * (1 - sticky * .5) / d * k; push[i][0] -= ddx * f; push[i][1] -= ddy * f; push[j][0] += ddx * f; push[j][1] += ddy * f; }
          }
        });
        st.b.forEach((b, i) => { b.p[0] += clamp(push[i][0], -maxr, maxr); b.p[1] += clamp(push[i][1], -maxr, maxr); });
      }
      for (const b of st.b) { b.p[0] += b.v[0] * k; b.p[1] += b.v[1] * k; }
    }
    for (const b of st.b) b.age++;
    // pops: bubbles past their pop age burst, pushing their neighbours away
    if (popVel) for (const pb of st.b.filter(b => b.age >= fxFoamPop(b.id, life, frail, seed))) {
      const reach = Math.max(rOf(pb) * 3, unit);
      for (const b of st.b) { const dx = b.p[0] - pb.p[0], dy = b.p[1] - pb.p[1], d = Math.hypot(dx, dy); if (d > 1e-4 && d < reach) { const f = popVel * unit * (1 - d / reach) / d; b.v[0] += dx * f; b.v[1] += dy * f; } }
    }
    st.b = st.b.filter(b => b.age < fxFoamPop(b.id, life, frail, seed) && b.p[0] > ux0 && b.p[0] < ux1 && b.p[1] > uy0 && b.p[1] < uy1);
  }, st => ({ b: st.b.map(b => ({ ...b, p: b.p.slice(), v: b.v.slice() })), carry: st.carry, next: st.next }));
  const view = q('view'), zoom = Math.max(.01, q('zoom')), texture = q('texture'), orient = q('orientation'), blend = q('blendMode'), s = E.sc, lp = fxLpOf(E);
  const [zx, zy] = q('zoomProducer') ? prod : [lw * .5, lh * .5];
  const order = st.b.slice();
  if (blend === 2) order.sort((a, c) => c.age - a.age || a.id - c.id); else if (blend === 1) order.sort((a, c) => a.age - c.age || a.id - c.id);
  // where a bubble is drawn: frame centre, radius, turn; and how far it is from popping
  const place = b => {
    const wob = wobble > 0 ? 1 + wobble * .15 * Math.sin(b.age * .35 + fxHs(b.id, 13, seed) * 6) : 1, [x, y] = lp(zx + (b.p[0] - zx) * zoom, zy + (b.p[1] - zy) * zoom);
    return [x, y, rOf(b) * wob * zoom * s, orient === 1 ? b.spin : orient === 2 ? Math.atan2(b.v[1], b.v[0]) : 0, clamp((fxFoamPop(b.id, life, frail, seed) - b.age) / 5, 0, 1)];
  };
  const tid = view === 2 && texture === 5 ? q('textureLayer') : 0, tex = tid ? fxOther(E, tid, 'foamtex') : null, stride = 16, R = fxScratch('sprites', order.length * stride);
  let n = 0;
  if (!tex) for (const b of order) {
    const [x, y, r, rot, fade] = place(b);
    const [c, shape] = view !== 2 ? [[.55, .75, 1], 4] : [[[1, 1, 1], 4], [[.95, .95, .92], 3], [[1, .6, .8], 4], [[.8, .85, .75], 4], [[.97, .97, .95], 2]][texture] || [[1, 1, 1], 4];
    fxPutSprite(R, n++, stride, shape, x, y, r, c[0], c[1], c[2], fade, rot);
  }
  let fx = fxSpriteTable(E, img, R, n, stride, blend === 0 && view === 2);
  // User Defined: the texture layer fills each bubble's disc, turned with it
  if (tex) {
    const M = byId(tid), o = fxLayerBox(E, M), r = RT[tid], tw = r?.box?.w || E.w, th = r?.box?.h || E.h;
    const out = fxChunkedK(E, tex, order, 2, b => { const d = place(b); return [d, [2, d[0], d[1], d[2], Math.sin(d[3]), Math.cos(d[3]), d[4], tw, th, o.sc, o.rect[0], o.rect[1]]]; }, fx);
    E.free(fx); fx = out;
  }
  // Environment Map: each bubble reflects the map (stretched over the layer) along its sphere normal
  const strength = clamp(q('reflStrength'), 0, 1);
  if (view === 2 && strength > 0 && q('envMap')) {
    const env = fxFit(E, q('envMap'), 'foamenv', true);
    if (env) { const out = fxChunkedK(E, env, order, 3, b => { const d = place(b); return [d, [3, d[0], d[1], d[2], clamp(q('reflConv'), 0, 1), strength, E.lw, E.lh]]; }, fx); E.free(fx); fx = out; }
  }
  // Draft + Flow Map: the flow map under the bubbles at half strength
  if (view === 1 && fid) {
    const f = fxFitAt(E, fid, 'foamflowv', true, E.T - E.t);
    if (f) { const out = E.run('fx_particles', 'fxp_under', fxP({}), fx, f); E.free(fx); fx = out; }
  }
  return fx;
}
// Foam's discs (fx_particles' Chunked kind 2 / 3, foam_disc compositing) over `base`, sampling `tex`
const fxChunkedK = (E, tex, items, kind, rec, base) => fxChunked(E, tex, items, 16, 'fx_particles', 'fxp_raster', 2, x => {
  const [d, r] = rec(x); return d[2] > 0 ? [[d[0] - d[2] - 1, d[1] - d[2] - 1, Math.ceil(d[0] + d[2] + 1) - 1, Math.ceil(d[1] + d[2] + 1) - 1], r] : [null];
}, {}, null, base, kind);
