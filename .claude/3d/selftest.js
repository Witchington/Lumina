// 3D test: real shapes render, light direction shades them, cast shadows land (and soften), materials and picture textures work, save/reopen.
(async () => {
  const R = { steps: {} }, step = (k, v) => R.steps[k] = v;
  try {
    S.global.vignette = 0;
    await threeReady;
    const dir = 'D:\\Lumina\\.claude\\3d\\media\\';
    const card = await makeCard(Array(6).fill('40,110,200'), 'bg.png', false); card.__path = await lumina.saveExport(await card.arrayBuffer(), 'bg.png', dir + 'bg.png');
    const bg = await load(card); bg.start = 0; bg.dur = 8;
    const BG = '40,110,200';
    const draw = (t = 1) => { seek(t); render(t); };
    const px = (x, y) => pix(x / 1920, y / 1080);
    const lum = c => .299 * c[0] + .587 * c[1] + .114 * c[2];
    // pixels of the shape's disc that aren't the background
    const cover = () => { const d = ctx.getImageData(0, 0, W(), H()).data; let n = 0; for (let i = 0; i < d.length; i += 32) if (Math.abs(d[i] - 40) + Math.abs(d[i + 1] - 110) + Math.abs(d[i + 2] - 200) > 30) n++; return n; };

    // menu lists the shapes; adding one makes a 3D layer
    const menu = [...document.querySelectorAll('#pop3d [data-s3]')].map(b => b.textContent);
    seek(0); $('#pop3d [data-s3=cube]').click();
    const C = selLayer(); C.start = 0; C.dur = 8;
    draw();
    step('added', { menu, kind: C.kind, name: C.name, mat: C.mat, engine: !!T3, failed: t3Failed, center: px(960, 540).join(), drawn: px(960, 540).join() !== BG, errors: __errs.length });

    // inspector
    S.sel = C.id; refresh();
    step('panel', { shape: !!$('#f-3s'), materials: $('#f-3m').querySelectorAll('option:not([disabled])').length, light: !!$('#r-lAz'), shadowSel: $('#f-3sh').value, props: [...document.querySelectorAll('#inspector .prow')].map(r => r.dataset.p).join(' ') });

    // every shape draws something of a sensible size, and turning it really changes the picture
    const shapes = {};
    for (const s of Object.keys(SHAPES3D)) { C.shadowOn = 'none'; C.shape3 = s; draw(); shapes[s] = cover(); }
    C.shape3 = 'cube'; draw(); const a = ctx.getImageData(760, 340, 400, 400).data; C.p.rotY = 75; draw(); const b = ctx.getImageData(760, 340, 400, 400).data; C.p.rotY = 30;
    let turned = 0; for (let i = 0; i < a.length; i += 4) if (Math.abs(a[i] - b[i]) > 20) turned++;
    step('shapes', { shapes, allDrawn: Object.values(shapes).every(n => n > 1500), turnedPixels: turned });

    // light from the left lights the left side of a sphere; from the right, the right side
    C.shape3 = 'sphere'; C.p.rough = .6; C.p.refl = 0;
    C.p.lAz = -70; C.p.lEl = 10; draw(); const l1 = [lum(px(830, 540)), lum(px(1090, 540))];
    C.p.lAz = 70; draw(); const l2 = [lum(px(830, 540)), lum(px(1090, 540))];
    C.p.lAz = -40; C.p.lEl = 45; C.p.refl = 1;
    step('light', { fromLeft: l1.map(Math.round), fromRight: l2.map(Math.round), follows: l1[0] > l1[1] + 30 && l2[1] > l2[0] + 30 });

    // the shadow lands on the picture behind, down and right of a shape lit from the upper left
    C.shape3 = 'cube'; C.p.rotY = 0; C.p.rotX = 0; C.p.shGap = 1; C.p.shSoft = 0; C.p.shDark = .7;
    const sh = (x, y) => px(x, y);
    C.shadowOn = 'none'; draw(); const noShadow = sh(1240, 800).join();
    C.shadowOn = 'wall'; draw(); const wallShadow = sh(1240, 800);
    // softness: count in-between pixels along a row crossing the shadow's edge
    const ramp = soft => { C.p.shSoft = soft; draw(); const row = ctx.getImageData(1150, 860, 400, 1).data; let mid = 0; for (let i = 0; i < 400; i++) { const v = row[i * 4 + 2]; if (v > 75 && v < 185) mid++; } return mid; };
    const hard = ramp(0), softer = ramp(40);
    // it follows the light: lit from the upper right, the shadow moves to the left
    C.p.shSoft = 0; C.p.lAz = 40; draw(); const leftNow = sh(680, 800), rightNow = sh(1240, 800); C.p.lAz = -40;
    // floor: shadow under the shape
    C.shadowOn = 'floor'; C.p.camTilt = 25; C.p.shGap = .2; C.p.lEl = 70; draw(); const floorUnder = sh(1000, 790), floorAbove = sh(960, 200);
    C.p.camTilt = 12; C.p.lEl = 45;
    step('shadow', { noShadow, wall: wallShadow.join(), darker: lum(wallShadow) < 100 * .75 && noShadow === BG, hardEdgePixels: hard, softEdgePixels: softer, softens: softer > hard + 10,
      lightRight: { left: leftNow.join(), right: rightNow.join(), moved: lum(leftNow) < 80 && rightNow.join() === BG }, floor: { under: floorUnder.join(), above: floorAbove.join(), shows: lum(floorUnder) < 80 && floorAbove.join() === BG } });

    // materials: each builds; textured ones have real pattern (spread of colours across the face)
    C.shadowOn = 'none'; C.shape3 = 'cube'; C.p.rotY = 0; C.p.rotX = 0; C.p.camTilt = 0;
    const mats = {};
    for (const m of Object.keys(MATS)) {
      const t0 = performance.now(); applyMat3(C, m); draw(); const ms = Math.round(performance.now() - t0);
      const d = ctx.getImageData(860, 440, 200, 200).data; let s = 0, s2 = 0, n = 0;
      for (let i = 0; i < d.length; i += 16) { const v = lum([d[i], d[i + 1], d[i + 2]]); s += v; s2 += v * v; n++; }
      const mean = s / n; mats[m] = { ms, mean: Math.round(mean), spread: Math.round(Math.sqrt(Math.max(0, s2 / n - mean * mean))) };
    }
    const textured = Object.keys(MATS).filter(k => MATS[k].gen && !['matte', 'rubber', 'gold', 'brushed', 'leather', 'gamer'].includes(k));
    step('materials', { count: Object.keys(MATS).length, mats, patterned: textured.every(k => mats[k].spread > 6), slowest: Math.max(...Object.values(mats).map(x => x.ms)) });

    // glow: neon is brighter with Glow up
    applyMat3(C, 'neon'); C.p.glow = 0; draw(); const g0 = lum(px(960, 540)); C.p.glow = 4; draw(); const g1 = lum(px(960, 540));
    // a picture as a texture (the blue card), with bumps from it
    S.sel = C.id; refresh();
    const sel = (id, v) => { const s = $(id); s.value = v; s.dispatchEvent(new Event('input', { bubbles: true })); s.dispatchEvent(new Event('change', { bubbles: true })); };
    sel('#f-3m', 'img:' + bg.media);
    draw(); const imgTex = px(960, 540);
    step('surface', { glowOff: Math.round(g0), glowOn: Math.round(g1), glows: g1 > g0 + 25, imageMat: C.mat, texMedia: C.texMedia, imgTex: imgTex.join(), blueish: imgTex[2] > imgTex[0] + 40, bumpBox: !!$('#f-3b') });

    // presets: turntable spins a full turn, tumble in starts from nothing, light sweep moves the light
    applyMat3(C, 'gold'); C.shadowOn = 'wall'; C.p.camTilt = 12; C.p.rotY = 30; C.p.rotX = 15;
    S.sel = C.id; seek(0); refresh();
    $('#inspector [data-preset=turntable]').click();
    const tt = [0, 2, 4, 8].map(t => +val(C, 'rotY', t).toFixed(0));
    seek(2); S.sel = C.id; refresh(); $('#inspector [data-preset=tumblein]').click();
    draw(2); const tumbleStart = cover(); draw(3); const tumbleEnd = cover();
    $('#inspector [data-preset=lightsweep]').click();
    step('presets', { turntable: tt, tumbleStart, tumbleEnd, grows: tumbleStart < 50 && tumbleEnd > 3000, sweep: [0, 4, 8].map(t => +val(C, 'lAz', t).toFixed(0)) });

    // a second shape, saved and reopened: same picture
    seek(0); $('#pop3d [data-s3=knot]').click(); const K = selLayer(); K.start = 0; K.dur = 8; Object.assign(K.p, { x: .25, y: .4, dim: 360 }); applyMat3(K, 'marble');
    draw(5); const before = ctx.getImageData(0, 0, W(), H()).data;
    PROJ.path = dir + 'three.lumina'; await saveProject();
    S.layers = []; for (const k in RT) delete RT[k]; refresh();
    await openProject(dir + 'three.lumina');
    draw(5); const after = ctx.getImageData(0, 0, W(), H()).data;
    let maxDiff = 0, diffPx = 0; for (let i = 0; i < before.length; i += 4) { const d = Math.max(Math.abs(before[i] - after[i]), Math.abs(before[i + 1] - after[i + 1]), Math.abs(before[i + 2] - after[i + 2])); if (d > maxDiff) maxDiff = d; if (d > 8) diffPx++; }
    const saved = JSON.parse(projectJSON()).layers.filter(L => L.kind === '3d').map(L => `${L.name}:${L.shape3}:${L.mat}:${L.shadowOn}`);
    step('reopened', { saved, maxDiff, diffPx });

    // shared 3D space: two 3D layers stacked next to each other
    S.layers.filter(L => L.kind === '3d').forEach(L => L.visible = false);
    seek(0); $('#pop3d [data-s3=sphere]').click(); const B = selLayer();
    $('#pop3d [data-s3=cube]').click(); const A = selLayer();   // A is on top
    for (const [L, x, c] of [[A, .44, '#ff2020'], [B, .56, '#20ff20']]) { L.start = 0; L.dur = 8; L.p.x = x; L.p.y = .5; L.color = c; L.shadowOn = 'none'; }
    draw(1);
    const grouped = group3(A, S.time)?.length;
    const at960 = () => { draw(1); return px(960, 540); };
    B.p.z = 600; const bFront = at960(); B.p.z = -600; const aFront = at960(); B.p.z = 0;
    // one light: the top layer's. Changing the lower one's light does nothing; the top one's does
    draw(1); const base = ctx.getImageData(0, 0, W(), H()).data;
    const changed = () => { draw(1); const d = ctx.getImageData(0, 0, W(), H()).data; let n = 0; for (let i = 0; i < d.length; i += 16) if (Math.abs(d[i] - base[i]) + Math.abs(d[i + 1] - base[i + 1]) > 30) n++; return n; };
    B.p.lAz = 80; const lowerLight = changed(); B.p.lAz = BASE_P.lAz; A.p.lAz = 80; const topLight = changed(); A.p.lAz = BASE_P.lAz;
    // shadows land on other shapes: a small sphere in front throws its shadow onto a big cube behind
    Object.assign(B.p, { x: .5, y: .5, z: -600, dim: 900, rotY: 0, rotX: 0 }); B.color = '#e0e0e0'; B.shape3 = 'cube';
    Object.assign(A.p, { x: .42, y: .4, z: -100, dim: 250 }); A.shape3 = 'sphere'; A.shadowOn = 'wall';
    const region = () => { draw(1); const d = ctx.getImageData(920, 620, 120, 120).data; let s = 0; for (let i = 0; i < d.length; i += 4) s += lum([d[i], d[i + 1], d[i + 2]]); return Math.round(s / (d.length / 4)); };
    const shadowed = region(); A.p.x = .15; const lit = region(); A.p.x = .42;
    // selection boxes follow each shape on screen
    draw(1); const mB = RT[B.id].m, mA = RT[A.id].m;
    const boxes = { a: [Math.round(mA.e), Math.round(mA.f)], b: [Math.round(mB.e), Math.round(mB.f)] };
    // the shared picture, saved for the eye
    await lumina.saveExport(await new Promise(r => canvas.toBlob(b => b.arrayBuffer().then(r))), 'x.png', 'D:\\Lumina\\.claude\\3d\\shared.png');
    // a layer with its own effect (a mask) steps out of the shared space and still draws
    B.mask = { on: true, shape: 'rect', invert: false }; draw(1); const soloGroup = group3(A, S.time); const soloShadow = region(); B.mask.on = false;
    // inspector: the lower shape points at the shared light
    S.sel = B.id; refresh(); const note = $('#inspector [data-act=sel3d]'); const noteText = note?.closest('.group').querySelector('.empty').textContent.slice(0, 60);
    note?.click(); const jumped = S.sel === A.id;
    step('shared', { grouped, bFront: bFront.join(), aFront: aFront.join(), depthWorks: bFront[1] > bFront[0] + 60 && aFront[0] > aFront[1] + 60,
      lowerLight, topLight, sharedLight: lowerLight === 0 && topLight > 500, shadowed, lit, castsOnOthers: shadowed < lit - 25,
      boxes, boxesRight: Math.abs(boxes.a[0] - .42 * 1920) < 40 && Math.abs(boxes.b[0] - 960) < 40, soloGroup, soloShadow, soloFallback: soloGroup === null && soloShadow > 0, noteText, jumped, errors: __errs.length });
    S.layers = S.layers.filter(L => L !== A && L !== B); delete RT[A.id]; delete RT[B.id];

    // pictures: every material on a cube, and a shadow demo strip
    const L3 = S.layers.filter(L => L.kind === '3d'); L3.forEach(L => L.visible = false);
    const T = L3[0]; T.visible = true; delete T.keys.rotY; delete T.keys.rotX; delete T.keys.scale; delete T.keys.lAz;
    Object.assign(T.p, { x: .5, y: .5, scale: 1, dim: 700, rotY: 32, rotX: 18, lAz: -40 }); T.shadowOn = 'none'; T.shape3 = 'cube';
    const keys = Object.keys(MATS), cols = 7, rows = Math.ceil(keys.length / cols);
    const sheet = document.createElement('canvas'); sheet.width = cols * 274; sheet.height = rows * 274; const sx = sheet.getContext('2d');
    sx.fillStyle = '#111'; sx.fillRect(0, 0, sheet.width, sheet.height);
    keys.forEach((m, i) => { applyMat3(T, m); draw(1); sx.drawImage(canvas, 960 - 450, 540 - 450, 900, 900, (i % cols) * 274, Math.floor(i / cols) * 274, 274, 274);
      sx.fillStyle = '#fff'; sx.font = '15px sans-serif'; sx.fillText(MATS[m].label, (i % cols) * 274 + 8, Math.floor(i / cols) * 274 + 266); });
    await lumina.saveExport(await new Promise(r => sheet.toBlob(b => b.arrayBuffer().then(r))), 'x.png', 'D:\\Lumina\\.claude\\3d\\materials.png');
    const shapesheet = document.createElement('canvas'); shapesheet.width = 5 * 384; shapesheet.height = 3 * 216; const ss = shapesheet.getContext('2d');
    const showcase = [['cube', 'plastic'], ['sphere', 'chrome'], ['cylinder', 'oak'], ['cone', 'neon'], ['pyramid', 'concrete'], ['torus', 'stripes'], ['knot', 'gold'], ['capsule', 'holo'],
      ['gem', 'glass'], ['coin', 'gold'], ['star', 'lava'], ['heart', 'plastic'], ['bolt', 'scifi'], ['cube', 'brick'], ['sphere', 'carbon']];
    T.shadowOn = 'wall'; Object.assign(T.p, { dim: 480, shSoft: BASE_P.shSoft, shGap: BASE_P.shGap, shDark: BASE_P.shDark, lAz: BASE_P.lAz, lEl: BASE_P.lEl, camTilt: BASE_P.camTilt });
    showcase.forEach(([s, m], i) => { T.shape3 = s; applyMat3(T, m); if (s === 'heart') T.color = '#ff2a55'; draw(1); ss.drawImage(canvas, (i % 5) * 384, Math.floor(i / 5) * 216, 384, 216); });
    await lumina.saveExport(await new Promise(r => shapesheet.toBlob(b => b.arrayBuffer().then(r))), 'x.png', 'D:\\Lumina\\.claude\\3d\\shapes.png');
    T.shape3 = 'knot'; applyMat3(T, 'gold'); T.p.dim = 520; L3.forEach(L => L.visible = true); S.sel = T.id; refresh(); draw(1);
    $('#modal').hidden = true;
    R.errors = __errs;
  } catch (e) { R.error = String(e && e.stack || e); }
  return R;
})()
