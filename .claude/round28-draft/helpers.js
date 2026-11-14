// ---- Round 28 helpers (Simulation: pieces and surfaces): EffectCraft's sim2/ (pieces.rs, pixels.rs, shatter.rs,
//      surfaces.rs, foam.rs); GPU host code from fx_sim.rs (piece_pass, wave_height, caustics) and fx_particles.rs (foam).
//      The piece effects work in frame pixels: layer pixel (x, y) sits at off + (x, y) · scale, as in sim2's layer buffer
//      (the layer's own rotation is not followed, as Card Wipe) ----
const fxOff = E => [E.m.e - E.bw * E.sc / 2, E.m.f - E.bh * E.sc / 2];
// card3d's Proj::simple: a camera d pixels in front of the layer, looking at c
const fxSimpleCam = (c, d) => ({ m: [[d, 0, c[0], 0], [0, d, c[1], 0], [0, 0, 1, d]], near: .05 * d });
// card3d's Lighting from the shared Light / Material settings (as Card Wipe's)
function fxCardLight(E, q) {
  const [x0, y0, w, h] = E.rect, [lx, ly] = q('lightPos'), k0 = q('lightIntensity'), centre = [x0 + w / 2, y0 + h / 2, 0], pos = [lx, ly, -q('lightDepth') * Math.max(w, h)];
  return { kind: q('lightType'), color: q('lightColor').map(v => v * k0), pos, toLight: fxNormZ(fxSub3(pos, centre)), ambient: q('ambient'), kd: q('diffuse'), ks: q('specular'), sharp: Math.max(1, q('sharp')) };
}
// Card Wipe's camera, light and material settings (card3d's camera_params, lighting_params, material_params) for the
// other effects that draw pieces in 3D, with their own default camera distance
const fxCard3dParams = camZ => [
  { id: 'camSystem', label: 'Camera system', type: 'pick', def: 0, opts: [[0, 'Camera position'], [1, 'Corner pins']] },
  { id: 'camRotX', label: 'Camera X rotation°', def: 0, min: -3600, max: 3600, dec: 1 },
  { id: 'camRotY', label: 'Camera Y rotation°', def: 0, min: -3600, max: 3600, dec: 1 },
  { id: 'camRotZ', label: 'Camera Z rotation°', def: 0, min: -3600, max: 3600, dec: 1 },
  { id: 'camPos', label: 'Camera X, Y position', type: 'pt', def: [.5, .5] },
  { id: 'camZ', label: 'Camera Z position', def: camZ, min: .05, max: 10, dec: 2 },
  { id: 'focal', label: 'Focal length', def: 70, min: 1, max: 500, dec: 1 },
  { id: 'camOrder', label: 'Transform order', type: 'pick', def: 0, opts: CARD_ORDERS.map((n, i) => [i, n]) },
  { id: 'ul', label: 'Upper left corner', type: 'pt', def: [0, 0] },
  { id: 'ur', label: 'Upper right corner', type: 'pt', def: [1, 0] },
  { id: 'll', label: 'Lower left corner', type: 'pt', def: [0, 1] },
  { id: 'lr', label: 'Lower right corner', type: 'pt', def: [1, 1] },
  { id: 'autoFocal', label: 'Auto focal length', type: 'check', def: true },
  { id: 'pinFocal', label: 'Corner pins focal length', def: 70, min: 1, max: 500, dec: 1 },
  { id: 'lightType', label: 'Light type', type: 'pick', def: 0, opts: [[0, 'Distant source'], [1, 'Point source']] },
  { id: 'lightIntensity', label: 'Light intensity', def: 1, min: 0, max: 4, dec: 2 },
  { id: 'lightColor', label: 'Light color', type: 'color', def: '#ffffff' },
  { id: 'lightPos', label: 'Light position', type: 'pt', def: [.5, .5] },
  { id: 'lightDepth', label: 'Light depth', def: 1, min: -10, max: 10, dec: 3 },
  { id: 'ambient', label: 'Ambient light', def: .25, min: 0, max: 2, dec: 2 },
  { id: 'diffuse', label: 'Diffuse reflection', def: .75, min: 0, max: 2, dec: 2 },
  { id: 'specular', label: 'Specular reflection', def: 0, min: 0, max: 2, dec: 2 },
  { id: 'sharp', label: 'Highlight sharpness', def: 15, min: 1, max: 100, dec: 1 }];
// a picture read back to the CPU (E.read), sampled bilinearly at frame pixel (x, y) (pixel centres at .5; nothing
// outside it): straight [r, g, b, a], 0..1 (unpremul of Image::sample_bilinear)
function fxReadAt(R, x, y) {
  const k = R.k, W = R.w, H = R.h, d = R.d, fx = x * k - .5, fy = y * k - .5, x0 = Math.floor(fx), y0 = Math.floor(fy), tx = fx - x0, ty = fy - y0;
  let cr = 0, cg = 0, cb = 0, ca = 0;
  const tap = (xi, yi, w) => {
    if (xi < 0 || yi < 0 || xi >= W || yi >= H || !w) return;
    const o = (yi * W + xi) * 4, al = d[o + 3] / 255 * w; cr += d[o] / 255 * al; cg += d[o + 1] / 255 * al; cb += d[o + 2] / 255 * al; ca += al;
  };
  tap(x0, y0, (1 - tx) * (1 - ty)); tap(x0 + 1, y0, tx * (1 - ty)); tap(x0, y0 + 1, (1 - tx) * ty); tap(x0 + 1, y0 + 1, tx * ty);
  return ca > 1e-6 ? [cr / ca, cg / ca, cb / ca, ca] : [0, 0, 0, 0];
}
const fxReadFull = (E, img) => E.read(img, Math.max(E.w, E.h));
// one piece as fx_sim::piece_pass lays it out (48 floats: 11, the screen → piece inverse homography, rest centre, up to six
// corners, their count, shade, tint, highlight, opacity, flat colour, back, back mirror; its bounds last)
function fxPutPiece(R, i, pc) {
  const o = i * 48, m = pc.inv, n = Math.min(pc.poly.length, 6), t = pc.tint || [1, 1, 1], s = pc.spec || [0, 0, 0];
  R.fill(0, o, o + 48); R[o] = 11;
  for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) R[o + 1 + r * 3 + c] = m[r][c];
  R[o + 10] = pc.c0[0]; R[o + 11] = pc.c0[1];
  for (let k = 0; k < n; k++) { R[o + 12 + k * 2] = pc.poly[k][0]; R[o + 13 + k * 2] = pc.poly[k][1]; }
  R[o + 24] = n; R[o + 25] = pc.shade ?? 1; R[o + 26] = t[0]; R[o + 27] = t[1]; R[o + 28] = t[2]; R[o + 29] = s[0]; R[o + 30] = s[1]; R[o + 31] = s[2];
  R[o + 32] = pc.alpha ?? 1;
  if (pc.flat) { R[o + 33] = 1; R[o + 34] = pc.flat[0]; R[o + 35] = pc.flat[1]; R[o + 36] = pc.flat[2]; }
  R[o + 37] = pc.back ? 1 : 0; R[o + 38] = pc.mirror || 0;
  R[o + 44] = pc.bb[0]; R[o + 45] = pc.bb[1]; R[o + 46] = pc.bb[2]; R[o + 47] = pc.bb[3];
}
// sim2::PiecePlan::finish on the graphics card (fx_sim::piece_pass): pieces already sorted far to near over a transparent
// frame, textured by `front` (and `back` for pieces facing away: fxm_raster's pieces; without one, fxp_raster's passes)
function fxDrawPieces(E, front, pieces, back = null) {
  const n = pieces.length, R = fxScratch('pieces', n * 48);
  for (let i = 0; i < n; i++) fxPutPiece(R, i, pieces[i]);
  return fxSpriteTable(E, front, R, n, 48, false, 4, back);
}
// a stable far-to-near order (largest first) of the values in Z
const fxOrderDesc = Z => Array.from(Z.keys()).sort((a, b) => Z[b] - Z[a]);
const fxRotAxisOf = [[1, 0, 0], [0, 1, 0], [0, 0, 1], [1, 1, 0], [1, 0, 1], [0, 1, 1], [1, 1, 1]];
// CC Ball Action (pixels::ball_action_plan): the layer as a grid of balls, turned about an axis (twisted along a property)
// and scattered in 3D; each ball takes the layer's colour where it sits (a sampled tint: none where the layer is clear)
function fxBallAction(E, img, q) {
  const rad = Math.PI / 180, scatter = q('scatter'), ax = fxRotAxisOf[q('rotAxis')] || [1, 1, 1], rot = q('rotation') * rad, tp = q('twistProp'), twist = q('twistAngle') * rad;
  const spacing = Math.max(1, q('spacing')), size = q('ballSize') / 100, instab = q('instability') * rad, seed = Math.imul(fxSeed(E), 0x2545f491) >>> 0;
  if (size <= 0) return E.clear(img);
  const lw = E.bw, lh = E.bh, s = E.sc, lp = fxLpOf(E), nx = Math.max(1, Math.ceil(lw / spacing)), ny = Math.max(1, Math.ceil(lh / spacing)), n = nx * ny;
  const d = 2 * Math.max(lw, lh), cx = lw * .5, cy = lh * .5, maxr = Math.max(Math.hypot(lw, lh) * .5, 1), Rd = tp === 3 ? fxReadFull(E, img) : null;
  const Z = new Float64Array(n), P = new Float32Array(n * 5); let k = 0;
  for (let i = 0; i < n; i++) {
    const gx = (i % nx) * spacing + spacing * .5, gy = Math.floor(i / nx) * spacing + spacing * .5, [tx, ty] = lp(gx, gy);
    let tv;
    if (tp === 0) tv = gx / Math.max(lw, 1); else if (tp === 1) tv = gy / Math.max(lh, 1); else if (tp === 2) tv = Math.hypot(gx - cx, gy - cy) / maxr;
    else { const c = fxReadAt(Rd, tx, ty); if (c[3] <= 0) continue; tv = (c[0] + c[1] + c[2]) / 3; }
    const ph = fxH(i, 1, seed) * 2 * Math.PI + instab, sc = scatter * fxH(i, 2, seed);
    const p0 = [gx - cx + sc * Math.cos(ph), gy - cy + sc * Math.sin(ph), scatter * fxHs(i, 3, seed)], m = fxRotAxis(ax, rot + twist * tv);
    const qx = fxDot3(m[0], p0), qy = fxDot3(m[1], p0), qz = fxDot3(m[2], p0);
    if (d + qz <= d * .05) continue;
    const persp = d / (d + qz), [bx, by] = lp(cx + qx * persp, cy + qy * persp);
    Z[k] = qz; P.set([bx, by, spacing * .5 * size * persp * s, tx, ty], k * 5); k++;
  }
  const ord = fxOrderDesc(Z.subarray(0, k)), stride = 18, R = fxScratch('sprites', k * stride);
  for (let j = 0; j < k; j++) {
    const o = ord[j] * 5; fxPutSprite(R, j, stride, 2, P[o], P[o + 1], P[o + 2], 0, 0, 0, 1);
    const r = j * stride; R[r + 11] = 2; R[r + 12] = P[o + 3]; R[r + 13] = P[o + 4];
  }
  return fxSpriteTable(E, img, R, k, stride, false);
}
// CC Scatterize (pixels::scatterize_plan): every pixel of the layer a dot, jittered by Scatter and twisted about the
// horizontal axis through the centre (Left / Right Twist, growing toward each side)
function fxScatterize(E, img, q) {
  const rad = Math.PI / 180, scatter = q('scatter'), right = q('rightTwist') * rad, left = q('leftTwist') * rad;
  if (!scatter && !right && !left) return img;
  const add = q('transferMode') === 1, seed = Math.imul(fxSeed(E), 0x7feb352d) >>> 0, s = E.sc, cx = E.m.e, cy = E.m.f, half = Math.max(E.bw * .5 * s, 1);
  const d = 2 * Math.max(E.bw, E.bh) * s, cr = Math.cos(E.rot), sr = Math.sin(E.rot), [bx, by, bw, bh] = fxIBox(E), n = bw * bh, stride = 18, R = fxScratch('sprites', n * stride);
  for (let i = 0; i < n; i++) {
    const x = bx + i % bw + .5, y = by + Math.floor(i / bw) + .5, dx = x - cx, dy = y - cy, u = dx * cr + dy * sr, v = -dx * sr + dy * cr;
    // the twist grows from nothing at the centre to the full angle at the layer's side
    const a = (u < 0 ? left : right) * Math.min(Math.abs(u) / half, 1), sa = Math.sin(a), ca = Math.cos(a);
    const yy = v * ca, zz = v * sa, persp = d / Math.max(d + zz, d * .05), pu = u * persp, pv = yy * persp;
    const sx = cx + pu * cr - pv * sr + fxHs(i, 1, seed) * scatter * s, sy = cy + pu * sr + pv * cr + fxHs(i, 2, seed) * scatter * s;
    fxPutSprite(R, i, stride, 1, sx, sy, .6 * persp, 0, 0, 0, 1);
    const o = i * stride; R[o + 11] = 2; R[o + 12] = x; R[o + 13] = y;
  }
  return fxSpriteTable(E, img, R, n, stride, add);
}
// CC Pixel Polly (pixels::pixel_polly_plan): the layer breaks into triangles or squares that fly from the Force Center,
// spin and fall; before Start Time the layer as it is
function fxPixelPolly(E, img, q) {
  const t = E.t - q('startTime'); if (t <= 0) return img;
  const force = q('force'), gravity = q('gravity'), spin = q('spinning') * Math.PI / 180, fc = fxPl(E, q('forceCenter')), dirRand = q('dirRand') / 100, spdRand = q('speedRand') / 100;
  const g = Math.max(1, q('spacing')), object = q('object'), seed = Math.imul(fxSeed(E), 0x632be5ab) >>> 0, lw = E.bw, lh = E.bh, s = E.sc, [ox, oy] = fxOff(E);
  const cam = fxSimpleCam([ox + lw * .5 * s, oy + lh * .5 * s], 2 * Math.max(lw, lh) * s), eye = fxCamEye(cam);
  const nx = Math.max(1, Math.ceil(lw / g)), ny = Math.max(1, Math.ceil(lh / g)), tri = object <= 1, textured = object === 1 || object === 3, maxd = Math.max(lw, lh), per = tri ? 2 : 1;
  const Rd = textured ? null : fxReadFull(E, img), pieces = [];
  for (let i = 0; i < nx * ny * per; i++) {
    const cell = Math.floor(i / per), x0 = (cell % nx) * g, y0 = Math.floor(cell / nx) * g;
    const poly = !tri ? [[x0, y0], [x0 + g, y0], [x0 + g, y0 + g], [x0, y0 + g]] : i % 2 === 0 ? [[x0, y0], [x0 + g, y0], [x0, y0 + g]] : [[x0 + g, y0], [x0 + g, y0 + g], [x0, y0 + g]];
    const c = [poly.reduce((a, v) => a + v[0], 0) / poly.length, poly.reduce((a, v) => a + v[1], 0) / poly.length], dx = c[0] - fc[0], dy = c[1] - fc[1], dist = Math.max(Math.hypot(dx, dy), 1e-6);
    const ang = Math.atan2(dy, dx) + dirRand * Math.PI * fxHs(i, 1, seed), speed = force / 100 * .6 * maxd / (1 + dist / (.5 * maxd)) * (1 + spdRand * fxHs(i, 2, seed));
    const vz = -speed * .5 * fxH(i, 3, seed), pos = [c[0] + Math.cos(ang) * speed * t, c[1] + Math.sin(ang) * speed * t + .5 * gravity * .5 * lh * t * t, vz * t];
    const r = fxRotAxis([fxHs(i, 4, seed), fxHs(i, 5, seed), fxHs(i, 6, seed)], t * (Math.PI * fxH(i, 7, seed) + spin));
    const c0 = [c[0] * s + ox, c[1] * s + oy], pc = fxPiece(poly.map(v => [v[0] * s + ox, v[1] * s + oy]), c0, r, [pos[0] * s + ox, pos[1] * s + oy, pos[2] * s], cam, eye);
    if (!pc) continue;
    pc.shade = .35 + .65 * Math.abs(r[2][2]);
    if (!textured) { const cc = fxReadAt(Rd, c0[0], c0[1]); if (cc[3] <= 0) continue; pc.flat = cc; pc.alpha = cc[3]; }
    pieces.push(pc);
  }
  const ps = q('depthSort') ? fxOrderDesc(pieces.map(p => p.depth)).map(i => pieces[i]) : pieces;
  return fxDrawPieces(E, img, ps);
}
// Card Dance (shatter::card_dance_plan): the layer cut into cards whose position, rotation and scale follow two gradient
// layers' channels (each property: Source × Multiplier + Offset), lit, in 3D through the camera; backs show the Back Layer
const CD_SOURCES = ['None', 'Intensity 1', 'Red 1', 'Green 1', 'Blue 1', 'Alpha 1', 'Intensity 2', 'Red 2', 'Green 2', 'Blue 2', 'Alpha 2'];
const CD_PROPS = [['xPos', 'X position'], ['yPos', 'Y position'], ['zPos', 'Z position'], ['xRot', 'X rotation'], ['yRot', 'Y rotation'], ['zRot', 'Z rotation'],
  ['xScale', 'X scale'], ['yScale', 'Y scale']];
function fxCardSource(src, c1, c2) {
  const c = src <= 5 ? c1 : c2, k = (src - 1) % 5;
  return !src ? 0 : k === 0 ? fxLum(c[0], c[1], c[2]) : c[k === 4 ? 3 : k - 1];
}
function fxCardDance(E, img, q) {
  const rows = Math.trunc(clamp(q('rows'), 1, 1000)), cols = q('rowsCols') === 1 ? rows : Math.trunc(clamp(q('columns'), 1, 1000));
  const props = CD_PROPS.map(([p]) => [q(p + 'Src'), q(p + 'Mul'), q(p + 'Off')]), uses = n => props.some(p => p[0] && p[1] && (p[0] > 5) === (n === 2));
  const g1 = uses(1) ? fxPlaced(E, img, q('grad1'), 'cdgrad1', 2) : null, g2 = uses(2) ? fxPlaced(E, img, q('grad2'), 'cdgrad2', 2) : null;
  const R1 = g1 && fxReadFull(E, g1), R2 = g2 && fxReadFull(E, g2), back = q('backLayer') ? fxFit(E, q('backLayer'), 'cdback', true) : null;
  const lw = E.bw, lh = E.bh, s = E.sc, [ox, oy] = fxOff(E), cw = lw / cols, ch = lh / rows, cam = fxCardCam(E, q), eye = fxCamEye(cam), Lt = fxCardLight(E, q), pieces = [];
  for (let i = 0; i < rows * cols; i++) {
    const cx0 = (i % cols) * cw, cy0 = Math.floor(i / cols) * ch, bx = (cx0 + cw * .5) * s + ox, by = (cy0 + ch * .5) * s + oy;
    const gp1 = R1 ? fxReadAt(R1, bx, by) : [0, 0, 0, 0], gp2 = R2 ? fxReadAt(R2, bx, by) : [0, 0, 0, 0], val = k => props[k][2] + props[k][1] * fxCardSource(props[k][0], gp1, gp2);
    const sx = val(6), sy = val(7), r = fxRotXYZ(val(3), val(4), val(5)), rs = r.map(row => [row[0] * sx, row[1] * sy, row[2]]);
    const pos = [bx + val(0) * cw * s, by + val(1) * ch * s, val(2) * Math.max(cw, ch) * s], tx0 = cx0 * s + ox, ty0 = cy0 * s + oy, tw = cw * s, th = ch * s;
    const pc = fxPiece([[tx0, ty0], [tx0 + tw, ty0], [tx0 + tw, ty0 + th], [tx0, ty0 + th]], [bx, by], rs, pos, cam, eye); if (!pc) continue;
    [pc.tint, pc.spec] = fxCardShade(Lt, [-r[0][2], -r[1][2], -r[2][2]], pos, eye);
    pieces.push(pc);
  }
  return fxDrawPieces(E, img, fxOrderDesc(pieces.map(p => p.depth)).map(i => pieces[i]), back);
}
// Shatter (shatter::shatter_impl): the layer cut into a pattern (or a Custom Shatter Map's colours), broken where the force
// spheres reach (and the gradient allows), thrown, tumbled and dropped with drag; extruded sides; Rendered or wireframes
const SHATTER_PATTERNS = ['Bricks', 'Glass', 'Hexagons', 'Squares', 'Triangles', 'Custom'];
const SHATTER_TEX_MODES = [[0, 'Color'], [1, 'Layer'], [2, 'Tinted layer']];
function fxShatterCells(kind, cell, x0, y0, x1, y1, seed) {
  const out = [], i0 = Math.floor(x0 / cell) - 1, i1 = Math.ceil(x1 / cell) + 1, j0 = Math.floor(y0 / cell) - 1, j1 = Math.ceil(y1 / cell) + 1;
  if (kind === 0) {
    const bh = cell * .5, r0 = Math.floor(y0 / bh) - 1, r1 = Math.ceil(y1 / bh) + 1;
    for (let r = r0; r <= r1; r++) { const sh = ((r % 2) + 2) % 2 === 1 ? cell * .5 : 0; for (let i = i0; i <= i1; i++) { const x = i * cell + sh, y = r * bh; out.push([[x, y], [x + cell, y], [x + cell, y + bh], [x, y + bh]]); } }
  } else if (kind === 1) {
    // a jittered lattice split into triangles along a random diagonal
    const jit = (i, j) => [i * cell + fxHs(i >>> 0, ((j >>> 0) + 17) >>> 0, seed) * cell * .35, j * cell + fxHs(i >>> 0, ((j >>> 0) + 91) >>> 0, seed) * cell * .35];
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const p00 = jit(i, j), p10 = jit(i + 1, j), p11 = jit(i + 1, j + 1), p01 = jit(i, j + 1);
      if (fxH(i >>> 0, j >>> 0, (seed ^ 0x55) >>> 0) < .5) out.push([p00, p10, p11], [p00, p11, p01]); else out.push([p00, p10, p01], [p10, p11, p01]);
    }
  } else if (kind === 2) {
    const r = cell / Math.sqrt(3), dx = 1.5 * r, dy = Math.sqrt(3) * r, c0 = Math.floor(x0 / dx) - 1, c1 = Math.ceil(x1 / dx) + 1, rr0 = Math.floor(y0 / dy) - 1, rr1 = Math.ceil(y1 / dy) + 1;
    for (let ci = c0; ci <= c1; ci++) for (let rj = rr0; rj <= rr1; rj++) {
      const cx = ci * dx, cy = (rj + (((ci % 2) + 2) % 2 === 1 ? .5 : 0)) * dy;
      out.push([0, 1, 2, 3, 4, 5].map(k => [cx + r * Math.cos(k * Math.PI / 3), cy + r * Math.sin(k * Math.PI / 3)]));
    }
  } else if (kind === 3) {
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) { const x = i * cell, y = j * cell; out.push([[x, y], [x + cell, y], [x + cell, y + cell], [x, y + cell]]); }
  } else {
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const x = i * cell, y = j * cell;
      if ((((i + j) % 2) + 2) % 2 === 0) out.push([[x, y], [x + cell, y], [x, y + cell]], [[x + cell, y], [x + cell, y + cell], [x, y + cell]]);
      else out.push([[x, y], [x + cell, y], [x + cell, y + cell]], [[x, y], [x + cell, y + cell], [x, y + cell]]);
    }
  }
  return out;
}
// ∫0^t e^(−ks) ds and ∫0^t ∫0^u e^(−ks) ds du (shatter::drag_factors)
const fxDrag = (k, t) => { if (k < 1e-6) return [t, .5 * t * t]; const e = Math.exp(-k * t); return [(1 - e) / k, t / k - (1 - e) / (k * k)]; };
function fxShatter(E, img, q) {
  const rad = Math.PI / 180, view = q('view'), render = q('render'), kind = q('pattern'), custom = kind === SHATTER_PATTERNS.length - 1, reps = clamp(q('reps'), 1, 500);
  const dir = q('direction') * rad, origin = fxPl(E, q('origin')), forces = [1, 2].map(k => [fxPl(E, q(`f${k}Pos`)), q(`f${k}Depth`), q(`f${k}Radius`), q(`f${k}Strength`)]);
  const rotSpeed = q('rotSpeed'), tumble = q('tumble'), randomness = q('randomness'), kv = Math.max(0, q('viscosity')) * 5, massVar = q('massVar') / 100;
  const gravity = q('gravity'), gdir = q('gravDir') * rad, ginc = q('gravInc') * rad, seed = (Math.imul(Math.trunc(Math.max(0, q('seed'))) >>> 0, 0x9e3779b1) ^ fxSeed(E)) >>> 0;
  const lw = E.bw, lh = E.bh, s = E.sc, [ox, oy] = fxOff(E), t = Math.max(0, E.t), unit = lw * .1, cell = lw / reps, extrude = Math.max(0, q('extrusion')) * cell * s;
  const cam = fxCardCam(E, q), eye = fxCamEye(cam), Lt = fxCardLight(E, q), toB = (x, y) => [x * s + ox, y * s + oy];
  // with a gradient layer only pieces at least as bright as 1 − Shatter Threshold break (Invert Gradient: as dark)
  const grad = q('gradLayer') ? fxFit(E, q('gradLayer'), 'shgrad', true) : null, RG = grad && fxReadFull(E, grad), threshold = q('threshold') / 100, invGrad = q('invertGrad');
  const texColor = q('texColor'), texOpacity = clamp(q('texOpacity'), 0, 1);
  const face = (m, id, name) => { const mode = q(m); return { mode, img: mode ? fxPlaced(E, img, q(id), name, 2) : null }; };
  const front = face('frontMode', 'frontLayer', 'shfront'), side = face('sideMode', 'sideLayer', 'shside'), backf = face('backMode', 'backLayer', 'shback');
  const RS = side.mode && side.img ? fxReadFull(E, side.img) : null, map = custom ? fxReadFull(E, fxPlaced(E, img, q('customMap'), 'shmap', 2)) : null, whiteFixed = q('whiteFixed');
  const sd = Math.sin(dir), cd = Math.cos(dir), toLayer = p => [origin[0] + p[0] * cd - p[1] * sd, origin[1] + p[0] * sd + p[1] * cd];
  const corners = [[0, 0], [lw, 0], [lw, lh], [0, lh]].map(([x, y]) => { const dx = x - origin[0], dy = y - origin[1]; return [dx * cd + dy * sd, -dx * sd + dy * cd]; });
  const px0 = Math.min(...corners.map(c => c[0])), px1 = Math.max(...corners.map(c => c[0])), py0 = Math.min(...corners.map(c => c[1])), py1 = Math.max(...corners.map(c => c[1]));
  const polys = fxShatterCells(custom ? 3 : kind, cell, px0, py0, px1, py1, seed).map(p => p.map(toLayer));
  const centre = lp => [lp.reduce((a, v) => a + v[0], 0) / lp.length, lp.reduce((a, v) => a + v[1], 0) / lp.length];
  // Custom Shatter Map: square cells grouped by the map's colour (pieces of one colour break as one)
  const mapKey = c => { if (c[3] < .5) return -1; const qz = v => Math.round(clamp(v, 0, 1) * 15) & 15; return qz(c[0]) << 8 | qz(c[1]) << 4 | qz(c[2]); };
  const keys = map ? polys.map(lp => { const c = centre(lp); return mapKey(fxReadAt(map, ...toB(c[0], c[1]))); }) : polys.map((_, i) => i), groups = new Map();
  polys.forEach((lp, i) => { const c = centre(lp), g = groups.get(keys[i]) || [0, 0, 0]; g[0] += c[0]; g[1] += c[1]; g[2]++; groups.set(keys[i], g); });
  const g3 = [Math.sin(gdir) * Math.cos(ginc) * gravity * unit, -Math.cos(gdir) * Math.cos(ginc) * gravity * unit, Math.sin(ginc) * gravity * unit], pieces = [];
  polys.forEach((lp, pi) => {
    const key = keys[pi], xs = lp.map(v => v[0]), ys = lp.map(v => v[1]);
    if (Math.max(...xs) < 0 || Math.max(...ys) < 0 || Math.min(...xs) > lw || Math.min(...ys) > lh || key === -1) return;
    const pcc = centre(lp), gg = groups.get(key), gc = [gg[0] / gg[2], gg[1] / gg[2]], i = key >>> 0, v = [0, 0, 0];
    // broken when inside a force sphere (centred Depth in front of the layer)
    let broken = false;
    for (const [fp, fd, fr, fs] of forces) {
      const R = fr * lw; if (R <= 0) continue;
      const dv = [gc[0] - fp[0], gc[1] - fp[1], fd * lw], dist = Math.hypot(dv[0], dv[1], dv[2]);
      if (dist < R) { broken = true; const f = fs * (1 - dist / R) * unit / Math.max(dist, 1e-6); for (let k = 0; k < 3; k++) v[k] += dv[k] * f; }
    }
    if (broken && RG) { const c = fxReadAt(RG, ...toB(gc[0], gc[1])); let l = clamp(fxLum(c[0], c[1], c[2]), 0, 1); if (invGrad) l = 1 - l; broken = threshold > 0 && l >= 1 - threshold; }
    if (broken && custom && whiteFixed && key === 0xfff) broken = false;
    if ((broken && render === 1) || (!broken && render === 2)) return;
    const gpos = [gc[0], gc[1], 0], moving = broken && t > 0; let r = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
    if (moving) {
      const mass = 1 + massVar * fxHs(i, 1, seed);
      for (let k = 0; k < 3; k++) v[k] = v[k] / mass + randomness * unit * fxHs(i, 2 + k, seed) * 2;
      const [f1, f2] = fxDrag(kv, t);
      for (let k = 0; k < 3; k++) gpos[k] += v[k] * f1 + g3[k] * f2;
      const h6 = fxHs(i, 6, seed), h7 = fxHs(i, 7, seed), h8 = fxHs(i, 8, seed);
      const axis = [[h6, h7, h8], [0, 0, 0], [1, 0, 0], [0, 1, 0], [0, 0, 1], [h6, h7, 0], [h6, 0, h8], [0, h7, h8]][tumble] || [h6, h7, h8];
      const speed = Math.hypot(v[0], v[1], v[2]) / unit, omega = rotSpeed * 2 * Math.PI * (.5 + fxH(i, 9, seed)) * Math.min(speed, 10);
      r = fxRotAxis(axis, omega * f1);
    }
    // the piece's centre: its offset from the group centre, turned with the group
    const off = [pcc[0] - gc[0], pcc[1] - gc[1], 0], pos = [0, 1, 2].map(k => gpos[k] + fxDot3(r[k], off));
    const tex = lp.map(([x, y]) => toB(x, y)), c0 = toB(pcc[0], pcc[1]), posb = [pos[0] * s + ox, pos[1] * s + oy, pos[2] * s];
    const pc = fxPiece(tex, c0, r, posb, cam, eye); if (!pc) return;
    [pc.tint, pc.spec] = fxCardShade(Lt, [-r[0][2], -r[1][2], -r[2][2]], posb, eye); pc.alpha = texOpacity;
    const f = pc.back ? backf : front;
    if (f.mode === 0) pc.flat = texColor.slice(0, 3); else if (f.mode === 2) pc.tint = pc.tint.map((v, k) => v * texColor[k]);
    // Extrusion: the sides of a moving piece, from its front outline back by the depth
    if (moving && extrude > 0) {
      const nb = [r[0][2], r[1][2], r[2][2]], n = tex.length;
      for (let e = 0; e < n; e++) {
        const a = tex[e], bv = tex[(e + 1) % n], ed = [bv[0] - a[0], bv[1] - a[1]], len = Math.hypot(ed[0], ed[1]); if (len < 1e-6) continue;
        const ew = [0, 1, 2].map(k => (r[k][0] * ed[0] + r[k][1] * ed[1]) / len), third = [ew[1] * nb[2] - ew[2] * nb[1], ew[2] * nb[0] - ew[0] * nb[2], ew[0] * nb[1] - ew[1] * nb[0]];
        const rs = [0, 1, 2].map(k => [ew[k], nb[k], third[k]]), mid = [(a[0] + bv[0]) * .5 - c0[0], (a[1] + bv[1]) * .5 - c0[1]];
        const mw = [0, 1, 2].map(k => posb[k] + r[k][0] * mid[0] + r[k][1] * mid[1] + nb[k] * extrude * .5), hl = len * .5, hd = extrude * .5, cs = [(a[0] + bv[0]) * .5, (a[1] + bv[1]) * .5];
        const sp = fxPiece([[cs[0] - hl, cs[1] - hd], [cs[0] + hl, cs[1] - hd], [cs[0] + hl, cs[1] + hd], [cs[0] - hl, cs[1] + hd]], cs, rs, mw, cam, eye); if (!sp) continue;
        [sp.tint, sp.spec] = fxCardShade(Lt, [-rs[0][2], -rs[1][2], -rs[2][2]], mw, eye); sp.alpha = texOpacity;
        if (RS && side.mode) { const c = fxReadAt(RS, cs[0], cs[1]); sp.flat = side.mode === 2 ? [0, 1, 2].map(k => c[k] * texColor[k]) : c.slice(0, 3); } else sp.flat = texColor.slice(0, 3);
        pieces.push(sp);
      }
    }
    pieces.push(pc);
  });
  const sorted = fxOrderDesc(pieces.map(p => p.depth)).map(i => pieces[i]);
  if (view === 0) { const ft = front.img || img; return fxDrawPieces(E, ft, sorted, backf.img || ft); }
  // wireframes: the piece outlines (front views at rest, the others as they move), and the force spheres
  const animated = view === 2 || view === 4, lines = [];
  for (const pc of sorted) {
    const n = pc.poly.length, fw = animated ? m3inv(pc.inv) : null; if (animated && !fw) continue;
    const pts = animated ? pc.poly.map(([u, w]) => { const a = u - pc.c0[0], b = w - pc.c0[1], ww = fw[2][0] * a + fw[2][1] * b + fw[2][2]; return [(fw[0][0] * a + fw[0][1] * b + fw[0][2]) / ww, (fw[1][0] * a + fw[1][1] * b + fw[1][2]) / ww]; }) : pc.poly;
    for (let e = 0; e < n; e++) { const a = pts[e], c = pts[(e + 1) % n]; lines.push([a[0], a[1], c[0] - a[0], c[1] - a[1], .75, .85, 1]); }
  }
  if (view >= 3) for (let k = 0; k < 2; k++) {
    const [fx, fy] = q(`f${k + 1}Pos`), R = forces[k][2] * lw * s;
    for (let j = 0; j < 64; j++) { const a0 = j / 64 * 2 * Math.PI, a1 = (j + 1) / 64 * 2 * Math.PI, x0 = fx + R * Math.cos(a0), y0 = fy + R * Math.sin(a0); lines.push([x0, y0, fx + R * Math.cos(a1) - x0, fy + R * Math.sin(a1) - y0, 1, .3, .3]); }
  }
  return fxLines(E, img, lines, .5);
}
// lines [x, y, dx, dy, r, g, b] of half-width w as sprites over a transparent frame
function fxLines(E, img, lines, w) {
  const n = lines.length, stride = 16, R = fxScratch('sprites', n * stride);
  for (let i = 0; i < n; i++) { const l = lines[i]; fxPutSprite(R, i, stride, 8, l[0], l[1], w, l[4], l[5], l[6], 1, 0, l[2], l[3]); }
  return fxSpriteTable(E, img, R, n, stride, false);
}
