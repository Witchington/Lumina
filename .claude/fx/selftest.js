// Effects test: EffectCraft's WGSL kernels run through WebGPU on a layer, each effect does its job, keyframes, order, on/off, save/reopen.
(async () => {
  const R = { steps: {} }, step = (k, v) => R.steps[k] = v;
  try {
    S.global.vignette = 0;
    await FXG.ready;
    step('engine', { dev: !!FXG.dev, failed: FXG.failed, shaders: Object.keys(FXG.src), effects: Object.keys(FX) });
    if (!FXG.dev) throw new Error('no WebGPU: ' + FXG.failed);
    const dir = 'D:\\Lumina\\.claude\\fx\\media\\';
    // black | white | red | green | blue | grey patches on top, a grey ramp below
    const card = await makeCard(['0,0,0', '255,255,255', '220,40,40', '40,200,60', '40,60,220', '128,128,128'], 'card.png', true);
    card.__path = await lumina.saveExport(await card.arrayBuffer(), 'card.png', dir + 'card.png');
    const L = await load(card); L.start = 0; L.dur = 6;
    const draw = (t = 1) => { seek(t); render(t); };
    const px = (x, y) => pix(x / 1920, y / 1080);
    const lum = c => .299 * c[0] + .587 * c[1] + .114 * c[2];
    const frame = () => ctx.getImageData(0, 0, W(), H()).data;
    const diff = (a, b) => { let mx = 0, n = 0; for (let i = 0; i < a.length; i += 4) { const d = Math.max(Math.abs(a[i] - b[i]), Math.abs(a[i + 1] - b[i + 1]), Math.abs(a[i + 2] - b[i + 2])); if (d > mx) mx = d; if (d > 4) n++; } return { max: mx, changed: n }; };
    draw(); const plain = frame();

    // the panels: Properties only summarises effects; Effects & Presets lists them all, searches, and adds one
    // to the selected layer, switching the right-hand panel to Effect Controls
    S.sel = L.id; setRightTab('props'); setLeftTab('fxp'); refresh();
    const ui = { propsHasFxRows: !!$('#inspector .fxi'), propsSummary: !!$('#inspector [data-act=ectab]'),
      listed: document.querySelectorAll('#fxpList .fxp-item').length, known: Object.keys(FX).length, enabled: !$('#fxpList .fxp-item:disabled') };
    $('#fxpSearch').value = 'blur'; $('#fxpSearch').dispatchEvent(new Event('input'));
    ui.search = [...document.querySelectorAll('#fxpList .fxp-item')].map(b => b.textContent);
    $('#fxpList [data-fxid=blur]').click(); await fxWarm('blur');
    Object.assign(ui, { added: L.fx?.map(x => x.id), tab: RTAB, ecRows: document.querySelectorAll('#inspector .fxi').length, title: $('#ecTab').textContent });
    $('#inspector [data-act=fxdel][data-fx="0"]').click(); ui.removedInEC = !L.fx?.length;
    S.sel = null; refresh(); ui.noLayerDisabled = !!$('#fxpList .fxp-item:disabled');
    $('#fxpSearch').value = ''; $('#fxpSearch').dispatchEvent(new Event('input')); setLeftTab('project');
    step('panels', ui);

    // add an effect the way a person does: the Add effect menu in Effect Controls
    S.sel = L.id; setRightTab('fx'); refresh();
    const opts = [...document.querySelectorAll('#fx-add option')].filter(o => o.value).map(o => o.textContent);
    const add = async id => { const s = $('#fx-add'); s.value = id; s.dispatchEvent(new Event('input', { bubbles: true })); await fxWarm(id); return L.fx[L.fx.length - 1]; };
    const only = async id => { while (L.fx?.length) delFX(L, 0); const f = await add(id); return f; };
    const set = (f, p, v) => { L.p[fxKey(f, p)] = v; };

    // Brightness & Contrast: zero changes nothing; up brightens; contrast spreads the ramp
    let f = await only('brightness');
    const panel = { rows: [...document.querySelectorAll('#inspector .fxi .prow')].map(r => r.dataset.p), name: $('#inspector .fxi b')?.textContent, menu: opts };
    draw(); const bcZero = diff(plain, frame());
    set(f, 'brightness', 50); draw(); const bcUp = [lum(px(1120, 270)), lum(px(800, 270))];
    set(f, 'brightness', 0); set(f, 'contrast', 60); draw(); const ctRamp = [lum(px(400, 810)), lum(px(1500, 810))];
    step('brightness', { panel, zero: bcZero, greyUp: Math.round(bcUp[0]), red: Math.round(bcUp[1]), brighter: bcUp[0] > 150, ramp: ctRamp.map(Math.round), contrastSpreads: ctRamp[0] < 400 / 1920 * 255 - 10 && ctRamp[1] > 1500 / 1920 * 255 + 10 });

    // Gaussian Blur: the hard edge between white and red softens; 0 is untouched; edges repeat or fade
    f = await only('blur'); set(f, 'blurriness', 0); draw(); const blurZero = diff(plain, frame());
    set(f, 'blurriness', 40); draw();
    const row = ctx.getImageData(560, 270, 160, 1).data; let mids = 0; for (let i = 0; i < 160; i++) { const g = row[i * 4 + 1]; if (g > 60 && g < 230) mids++; }
    // the top edge of the white patch: repeating edge pixels keeps it white, otherwise it fades toward transparent (black)
    const edgeRepeat = px(480, 1); f.repeat = false; draw(); const edgeFade = px(480, 1); f.repeat = true;
    step('blur', { zero: blurZero, edgePixels: mids, softened: mids > 40, edgeRepeat: edgeRepeat.join(), edgeFade: edgeFade.join(), repeatWorks: lum(edgeRepeat) > 240 && lum(edgeFade) < 200 });

    // Glow: light spills out of the white patch onto its black neighbour; dark stays dark far away
    f = await only('glow'); set(f, 'radius', 40); set(f, 'threshold', 50); draw();
    const glowNear = lum(px(318, 270)), glowFar = lum(px(40, 270)), plainNear = lum([plain[(270 * 1920 + 318) * 4], plain[(270 * 1920 + 318) * 4 + 1], plain[(270 * 1920 + 318) * 4 + 2]]);
    step('glow', { near: Math.round(glowNear), plainNear: Math.round(plainNear), far: Math.round(glowFar), glows: glowNear > plainNear + 30 && glowFar < 15 });

    // Twirl: 0Â° changes nothing; 180Â° swirls the middle and leaves the corners
    f = await only('twirl'); set(f, 'angle', 0); draw(); const twZero = diff(plain, frame());
    set(f, 'angle', 180); set(f, 'radius', 40); draw(); const tw = frame();
    const twMid = diff(plain.subarray((540 * 1920 + 760) * 4, (540 * 1920 + 1160) * 4), tw.subarray((540 * 1920 + 760) * 4, (540 * 1920 + 1160) * 4)), twCorner = px(30, 1060).join() === [...plain.subarray((1060 * 1920 + 30) * 4, (1060 * 1920 + 30) * 4 + 3)].join();
    // the centre is a point on the layer: move the layer and the swirl moves with it
    // where the swirl is: the middle of the pixels it changed, with the layer at x 50% and then moved to 60%
    const swirlX = () => { f.on = false; draw(); const p0 = frame(); f.on = true; draw(); const p1 = frame(); let sx = 0, n = 0;
      for (let i = 0; i < p0.length; i += 16) if (Math.abs(p0[i] - p1[i]) + Math.abs(p0[i + 1] - p1[i + 1]) > 40) { sx += (i / 4) % 1920; n++; } return n ? sx / n / 1920 : 0; };
    const at50 = swirlX(); L.p.x = .6; const at60 = swirlX(); L.p.x = .5;
    step('twirl', { zero: twZero, middleChanged: twMid.changed, cornerKept: twCorner, swirlAt: [+at50.toFixed(3), +at60.toFixed(3)], followsLayer: Math.abs(at60 - at50 - .1) < .03 });

    // Fractal Noise: a cloudy pattern over the layer, changing with Evolution (keyframed)
    f = await only('noise'); draw(1);
    const nd = ctx.getImageData(0, 0, 1920, 1080).data; let s = 0, s2 = 0, n = 0; for (let i = 0; i < nd.length; i += 64) { const v = nd[i]; s += v; s2 += v * v; n++; }
    const spread = Math.sqrt(s2 / n - (s / n) ** 2);
    L.keys[fxKey(f, 'evolution')] = [{ t: 0, v: 0, ease: 'linear' }, { t: 4, v: 720, ease: 'linear' }];
    draw(.5); const e1 = frame(); draw(2.5); const e2 = frame();
    // keep it inside the layer: shrink the layer, the noise stops at its edge
    L.p.scale = .5; draw(2.5); const outside = px(100, 100).join(), inside = px(960, 540);
    L.p.scale = 1;
    step('noise', { spread: Math.round(spread), cloudy: spread > 20, evolves: diff(e1, e2).changed, inLayerOnly: outside === '0,0,0' && inside.join() !== '0,0,0', outside, inside: inside.join() });

    // Light Rays: rays stream out from the bright patches
    f = await only('rays'); set(f, 'intensity', 200); draw(); const rays = frame();
    const raysChange = diff(plain, rays);
    step('rays', { changed: raysChange.changed, max: raysChange.max, works: raysChange.changed > 10000 });

    // ---- Round 3
    const P0 = (x, y) => { const i = (y * 1920 + x) * 4; return [plain[i], plain[i + 1], plain[i + 2]]; };
    // how many pixels along a line differ from the plain picture
    const lineChanged = (x, y, len, vert) => { let n = 0; for (let i = 0; i < len; i++) { const xx = vert ? x : x + i, yy = vert ? y + i : y, a = px(xx, yy), b = P0(xx, yy); if (Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2]) > 12) n++; } return n; };
    // Directional Blur: 90Â° streaks sideways (the white|red edge softens, the patch's bottom edge doesn't); 0Â° streaks up/down
    f = await only('directional'); set(f, 'length', 0); draw(); const dirZero = diff(plain, frame());
    set(f, 'length', 80); set(f, 'direction', 90); draw(); const sideH = lineChanged(560, 270, 160), sideV = lineChanged(480, 480, 120, true);
    set(f, 'direction', 0); draw(); const upH = lineChanged(560, 270, 160), upV = lineChanged(480, 480, 120, true);
    step('directional', { zero: dirZero, at90: [sideH, sideV], at0: [upH, upV], works: dirZero.max === 0 && sideH > 40 && sideV < 5 && upH < 5 && upV > 30 });

    // Radial Blur: zoom leaves the centre sharp and streaks the outside; spin turns around the centre
    f = await only('radial'); set(f, 'amount', 0); draw(); const radZero = diff(plain, frame());
    const region = (a, x0, y0, s) => { const o = []; for (let y = y0; y < y0 + s; y++) for (let x = x0; x < x0 + s; x++) { const i = (y * 1920 + x) * 4; o.push(a[i], a[i + 1], a[i + 2], 255); } return Uint8ClampedArray.from(o); };
    // a white spot 40 px left of the white|red edge: with the centre in the middle of the frame its streaks pull red in,
    // with the centre (a point on the layer) right on the spot it stays sharp
    set(f, 'amount', 30); draw(); const far = diff(region(plain, 590, 260, 20), region(frame(), 590, 260, 20));
    set(f, 'centerX', 600 / 1920); set(f, 'centerY', .25); draw(); const near = diff(region(plain, 590, 260, 20), region(frame(), 590, 260, 20));
    set(f, 'centerX', .5); set(f, 'centerY', .5);
    f.type = 0; draw(); const spin = diff(plain, frame()); f.type = 1;
    step('radial', { zero: radZero, spotFromMiddle: far.max, spotAsCentre: near.max, spinChanged: spin.changed,
      works: radZero.max === 0 && far.max > 30 && near.max < 6 && spin.changed > 50000 });

    // Camera Lens Blur: the result is the plain average over the iris shape, for small irises (pixel by pixel) and big ones (running row totals)
    f = await only('lens'); set(f, 'radius', 0); draw(); const lensZero = diff(plain, frame());
    const lensCheck = r => {
      set(f, 'radius', r); draw();
      const spans = fxIris(r, 6, 0, 0); let worst = 0;
      for (const [x, y] of [[640, 270], [330, 300], [1280, 530], [960, 545]]) {
        const acc = [0, 0, 0]; let n = 0;
        for (const [dy, l, h] of spans) for (let xx = x + l; xx <= x + h; xx++) { const c = P0(clamp(xx, 0, 1919), clamp(y + dy, 0, 1079)); acc[0] += c[0]; acc[1] += c[1]; acc[2] += c[2]; n++; }
        const got = px(x, y); worst = Math.max(worst, ...acc.map((v, k) => Math.abs(v / n - got[k])));
      }
      return { pixels: spans.reduce((a, s) => a + s[2] - s[1] + 1, 0), worst: +worst.toFixed(2) };
    };
    const small = lensCheck(6), big = lensCheck(30);
    // shapes: a hexagon iris has 6 corners' worth fewer pixels than a circle of the same radius
    const hex = fxIris(30, 6, 0, 0).reduce((a, s) => a + s[2] - s[1] + 1, 0), circ = fxIris(30, 0, 0, 0).reduce((a, s) => a + s[2] - s[1] + 1, 0);
    // highlight boost: bright parts bloom harder into the dark next to them
    set(f, 'radius', 30); draw(); const noBoost = lum(px(300, 270)); set(f, 'hlBright', 100); set(f, 'hlThr', 200); draw(); const boosted = lum(px(300, 270));
    step('lens', { zero: lensZero, small, big, hexPixels: hex, circlePixels: circ, noBoost: Math.round(noBoost), boosted: Math.round(boosted),
      works: lensZero.max === 0 && small.pixels <= 256 && big.pixels > 256 && small.worst < 3 && big.worst < 3 && hex < circ && boosted > noBoost + 10 });

    // Sharpen / Unsharp Mask: the red beside white gets darker (its green drops), flat white stays put, 0 changes nothing, a high threshold skips small changes
    // (Sharpen's blur reaches 1 px, so it's measured on the first red pixel; Unsharp Mask's radius 2 on the second)
    const sharpTest = async (id, amt, x) => {
      const g = await only(id); set(g, 'amount', 0); draw(); const z = diff(plain, frame());
      set(g, 'amount', amt); draw(); const edge = px(x, 270)[1], flat = px(480, 270);
      return { g, zero: z.max, edgeGreen: edge, plainGreen: P0(x, 270)[1], flat: flat.join() };
    };
    const sh = await sharpTest('sharpen', 100, 640), um = await sharpTest('unsharp', 150, 641);
    set(um.g, 'threshold', 255); draw(); const umThr = diff(plain, frame()).max;
    step('sharpen', { sharpen: { zero: sh.zero, edgeGreen: sh.edgeGreen, plainGreen: sh.plainGreen, flat: sh.flat }, unsharp: { zero: um.zero, edgeGreen: um.edgeGreen, flat: um.flat, highThreshold: umThr },
      works: sh.zero === 0 && um.zero === 0 && sh.edgeGreen < sh.plainGreen - 10 && um.edgeGreen < um.plainGreen - 10 && sh.flat === '255,255,255' && um.flat === '255,255,255' && umThr === 0 });

    // Round 3 speed, one 1080p frame each
    const r3speed = {};
    for (const [id, vals] of [['directional', { length: 100 }], ['radial', { amount: 40 }], ['lens', { radius: 60 }], ['unsharp', {}]]) {
      const g = await only(id); for (const k in vals) set(g, k, vals[k]); draw(); ctx.getImageData(0, 0, 1, 1);
      const t0 = performance.now(); for (let i = 0; i < 10; i++) draw(1 + i / 30); ctx.getImageData(0, 0, 1, 1); r3speed[id] = +((performance.now() - t0) / 10).toFixed(1);
    }
    step('round3speed', r3speed);

    // ---- Round 4
    const same = (a, b, tol = 3) => a.every((v, k) => Math.abs(v - b[k]) <= tol);
    const rowSame = (y, x0, x1) => { for (let x = x0; x < x1; x++) if (!same(px(x, y), P0(x, y), 2)) return false; return true; };
    // Bulge: 0 changes nothing; centred left of the red|green edge it magnifies red over where green was; far away is untouched
    f = await only('bulge'); set(f, 'height', 0); draw(); const bulgeZero = diff(plain, frame());
    set(f, 'height', 1); set(f, 'centerX', 900 / 1920); set(f, 'centerY', .25); draw();
    const bulged = px(990, 270), bulgeFar = same(px(1500, 270), P0(1500, 270), 0);
    step('bulge', { zero: bulgeZero, at990: bulged.join(), was: P0(990, 270).join(), farKept: bulgeFar, works: bulgeZero.max === 0 && bulged[0] > 180 && bulged[1] < 80 && bulgeFar });

    // Wave Warp: the bottom edge of the patches turns wavy; it moves on its own (speed); 0 height changes nothing
    f = await only('wave'); set(f, 'height', 0); draw(); const waveZero = diff(plain, frame());
    set(f, 'height', 20); draw(1); const w1 = frame(); draw(1.25); const w2 = frame();
    let wavy = 0; for (let x = 0; x < 1920; x += 4) { const i = (530 * 1920 + x) * 4, j = (550 * 1920 + x) * 4; if (Math.abs(w1[i] - plain[i]) > 20 || Math.abs(w1[j] - plain[j]) > 20) wavy++; }
    step('wave', { zero: waveZero, wavyColumns: wavy, moves: diff(w1, w2).changed, works: waveZero.max === 0 && wavy > 100 && diff(w1, w2).changed > 10000 });

    // Ripple: rings around the centre, moving; the corners are outside its radius
    f = await only('ripple'); draw(1); const r1 = frame(); draw(1.3); const r2 = frame();
    const rip = diff(plain, r1);
    step('ripple', { changed: rip.changed, moves: diff(r1, r2).changed, cornerKept: rowSame(5, 0, 60), works: rip.changed > 2000 && diff(r1, r2).changed > 2000 && rowSame(5, 0, 60) });

    // Fisheye Lens: a round lens: outside it is empty, the middle stays put, between is bent
    f = await only('cclens'); draw(); const fish = diff(plain, frame());
    const fishCorner = px(10, 10).join();
    step('cclens', { changed: fish.changed, corner: fishCorner, works: fish.changed > 100000 && fishCorner === '0,0,0' });

    // Turbulent Displace: wobbles the picture, but pinned edges stay where they are; Evolution changes the wobble
    f = await only('turbulent'); set(f, 'amount', 0); draw(); const tdZero = diff(plain, frame());
    set(f, 'amount', 80); draw(); const td1 = frame(); const tdTop = rowSame(0, 0, 1920);
    set(f, 'evolution', 120); draw(); const td2 = frame();
    step('turbulent', { zero: tdZero, changed: diff(plain, td1).changed, topEdgePinned: tdTop, evolves: diff(td1, td2).changed,
      works: tdZero.max === 0 && diff(plain, td1).changed > 20000 && tdTop && diff(td1, td2).changed > 10000 });

    // Mosaic: 40 × 22 blocks; a block across the white|red edge is their average (16 white + 32 red columns); Sharp colors takes the centre pixel
    f = await only('mosaic'); draw(); const mA = px(630, 10), mB = px(670, 10), mExp = [(16 * 255 + 32 * 220) / 48, (16 * 255 + 32 * 40) / 48, (16 * 255 + 32 * 40) / 48];
    f.sharp = true; draw(); const mSharp = px(630, 10); f.sharp = false;
    // a smaller layer: the blocks stay inside it
    L.p.scale = .5; draw(); const mOut = px(100, 100).join(); L.p.scale = 1;
    step('mosaic', { block: mA.join(), sameBlock: mB.join(), expected: mExp.map(Math.round).join(), sharp: mSharp.join(), outsideSmallLayer: mOut,
      works: same(mA, mB, 0) && same(mA, mExp, 2) && mSharp.join() === '220,40,40' && mOut === '0,0,0' });

    const r4speed = {};
    for (const id of ['bulge', 'wave', 'ripple', 'cclens', 'turbulent', 'mosaic']) {
      await only(id); draw(); ctx.getImageData(0, 0, 1, 1);
      const t0 = performance.now(); for (let i = 0; i < 10; i++) draw(1 + i / 30); ctx.getImageData(0, 0, 1, 1); r4speed[id] = +((performance.now() - t0) / 10).toFixed(1);
    }
    step('round4speed', r4speed);

    // ---- Round 5
    const closeTo = (a, b, tol) => a.every((v, k) => Math.abs(v - b[k]) <= tol);
    // Find Edges: flat white stays white, the white|red edge turns dark; Invert flips it (flat goes black)
    f = await only('findedges'); draw(); const feFlat = px(480, 270), feEdge = lum(px(640, 270));
    f.invert = true; draw(); const feInv = px(480, 270); f.invert = false;
    step('findedges', { flat: feFlat.join(), edge: Math.round(feEdge), inverted: feInv.join(), works: feFlat.join() === '255,255,255' && feEdge < 150 && feInv.join() === '0,0,0' });

    // Emboss: flat areas turn mid grey, an edge turns lighter or darker
    f = await only('emboss'); draw(); const emFlat = px(480, 270), emEdge = lum(px(640, 270));
    step('emboss', { flat: emFlat.join(), edge: Math.round(emEdge), works: closeTo(emFlat, [128, 128, 128], 2) && Math.abs(emEdge - 128) > 30 });

    // Posterize: 2 levels leaves only 0 or 255 in each colour; 6 levels gives steps of 51
    f = await only('posterize'); set(f, 'level', 2); draw();
    let only2 = true; for (let x = 5; x < 1920; x += 37) if (!px(x, 810).every(v => v === 0 || v === 255)) only2 = false;
    const poRed = px(800, 270).join();
    set(f, 'level', 6); draw(); let steps51 = true; for (let x = 5; x < 1920; x += 37) if (!px(x, 810).every(v => Math.abs(v - Math.round(v / 51) * 51) <= 1)) steps51 = false;
    step('posterize', { only0or255: only2, red: poRed, stepsOf51: steps51, works: only2 && poRed === '255,0,0' && steps51 });

    // Threshold: the dark half of the ramp goes black, the light half white
    f = await only('threshold'); draw(); const thDark = px(400, 810).join(), thLight = px(1500, 810).join();
    step('threshold', { dark: thDark, light: thLight, works: thDark === '0,0,0' && thLight === '255,255,255' });

    // Strobe Light: flashes white for 0.05 s once a second; random flashes add more; "see-through" hides the layer instead
    f = await only('strobe'); draw(1.01); const stOn = px(160, 810).join(); draw(1.5); const stOff = diff(plain, frame()).max;
    set(f, 'random', 100); draw(1.5); const stRand = px(160, 810).join(); set(f, 'random', 0);
    f.mode = 1; draw(1.01); const stClear = px(480, 270).join(); f.mode = 0;
    step('strobe', { flash: stOn, between: stOff, randomFlash: stRand, seeThrough: stClear, works: stOn === '255,255,255' && stOff === 0 && stRand === '255,255,255' && stClear === '0,0,0' });

    // Vignette: the corners darken, the middle hardly changes; a negative amount brightens the corners
    f = await only('vignette'); set(f, 'amount', 100); draw(); const vgCorner = lum(px(1910, 10)), vgMid = lum(px(960, 800)), vgPlain = [lum(P0(1910, 10)), lum(P0(960, 800))];
    set(f, 'amount', -100); draw(); const vgBright = lum(px(1910, 10));
    step('vignette', { corner: Math.round(vgCorner), middle: Math.round(vgMid), plain: vgPlain.map(Math.round), brightened: Math.round(vgBright),
      works: vgCorner < vgPlain[0] - 20 && Math.abs(vgMid - vgPlain[1]) < 8 && vgBright > vgPlain[0] + 20 });

    // Motion Tile: half-size tiles repeat the picture (two blue patches in a row); a smaller layer gets copies all around it;
    // Mirror edges flips the copy next to it (so the grey patch, not the black one, sits right of the layer)
    f = await only('motiontile'); set(f, 'tw', 50); set(f, 'th', 50); draw(); const mt1 = px(240, 270), mt2 = px(1200, 270);
    set(f, 'tw', 100); set(f, 'th', 100); L.p.scale = .5; draw(); const mtAround = lum(px(100, 100)), mtWrap = px(1450, 350);
    f.mirror = true; draw(); const mtMirror = px(1450, 350); f.mirror = false; L.p.scale = 1;
    step('motiontile', { tile1: mt1.join(), tile2: mt2.join(), aroundSmallLayer: Math.round(mtAround), rightOfLayer: mtWrap.join(), mirrored: mtMirror.join(),
      works: closeTo(mt1, [40, 60, 220], 3) && closeTo(mt2, [40, 60, 220], 3) && mtAround > 20 && closeTo(mtWrap, [0, 0, 0], 3) && closeTo(mtMirror, [128, 128, 128], 3) });

    // Gradient Ramp: black at the top to white at the bottom, grey in the middle; half blend mixes the picture back in
    f = await only('gradientramp'); draw(); const grTop = lum(px(960, 3)), grMid = lum(px(960, 540)), grBot = lum(px(960, 1076));
    set(f, 'blend', 50); draw(); const grHalf = px(480, 270); set(f, 'blend', 0);
    step('gradientramp', { top: Math.round(grTop), middle: Math.round(grMid), bottom: Math.round(grBot), halfBlendOnWhite: grHalf.join(),
      works: grTop < 6 && grBot > 249 && Math.abs(grMid - 127.5) < 4 && grHalf[0] > 150 && grHalf[0] < 230 });

    // 4-Color Gradient: yellow near point 1, blue near point 4; it stays inside the layer
    f = await only('fourcolor'); draw(); const fcA = px(192, 108), fcD = px(1728, 972);
    L.p.scale = .5; draw(); const fcOut = px(100, 100).join(); L.p.scale = 1;
    step('fourcolor', { atPoint1: fcA.join(), atPoint4: fcD.join(), outsideSmallLayer: fcOut,
      works: fcA[0] > 230 && fcA[1] > 230 && fcA[2] < 30 && fcD[2] > 230 && fcD[0] < 30 && fcOut === '0,0,0' });

    // Grid: white lines every 64 px over the picture; Invert grid paints the cells instead
    f = await only('grid'); draw(); const gLine = px(64, 300).join(), gCell = px(32, 300).join();
    f.invert = true; draw(); const gInvLine = px(64, 300).join(), gInvCell = px(32, 300).join(); f.invert = false;
    step('grid', { line: gLine, cell: gCell, invertedLine: gInvLine, invertedCell: gInvCell,
      works: gLine === '255,255,255' && gCell === '0,0,0' && gInvLine === '0,0,0' && gInvCell === '255,255,255' });

    const r5speed = {};
    for (const [id, vals] of [['findedges'], ['emboss'], ['posterize'], ['vignette'], ['motiontile', { tw: 50, th: 50 }], ['gradientramp'], ['fourcolor'], ['grid']]) {
      const g = await only(id); for (const k in vals || {}) set(g, k, vals[k]); draw(); ctx.getImageData(0, 0, 1, 1);
      const t0 = performance.now(); for (let i = 0; i < 10; i++) draw(1.1 + i / 30); ctx.getImageData(0, 0, 1, 1); r5speed[id] = +((performance.now() - t0) / 10).toFixed(1);
    }
    step('round5speed', r5speed);

    // ---- Round 6: color correction
    // Hue/Saturation: zero changes nothing; +120° turns red green; -100 saturation turns it grey; Colorize paints the grey patch blue
    f = await only('huesat'); draw(); const hsZero = diff(plain, frame()).max;
    set(f, 'hue', 120); draw(); const hsGreen = px(800, 270); set(f, 'hue', 0);
    set(f, 'saturation', -100); draw(); const hsGrey = px(800, 270); set(f, 'saturation', 0);
    f.colorize = true; set(f, 'cHue', 240); set(f, 'cSat', 100); draw(); const hsBlue = px(1760, 270), hsWhite = px(480, 270).join(); f.colorize = false;
    step('huesat', { zero: hsZero, redPlus120: hsGreen.join(), redDesaturated: hsGrey.join(), greyColorized: hsBlue.join(), whiteColorized: hsWhite,
      works: hsZero === 0 && hsGreen[1] > 180 && hsGreen[0] < 60 && Math.max(...hsGrey) - Math.min(...hsGrey) <= 2 && hsBlue[2] > 240 && hsBlue[0] < 10 && hsWhite === '255,255,255' });

    // Levels: input 64-192 stretches the ramp (64 → black, about 199 → white, grey stays grey); gamma 2 lifts grey; output black raises black
    f = await only('levels'); draw(); const lvZero = diff(plain, frame()).max;
    set(f, 'inBlack', 64); set(f, 'inWhite', 192); draw(); const x64 = Math.round(64 / 255 * 1920), lvLo = px(x64 - 20, 810), lvHi = px(1500, 810), lvMid = px(1760, 270);
    set(f, 'inBlack', 0); set(f, 'inWhite', 255); set(f, 'gamma', 2); draw(); const lvGamma = px(1760, 270)[0]; set(f, 'gamma', 1);
    set(f, 'outBlack', 50); draw(); const lvOut = px(160, 270)[0];
    step('levels', { zero: lvZero, belowInBlack: lvLo.join(), aboveInWhite: lvHi.join(), grey: lvMid.join(), greyGamma2: lvGamma, blackWithOutBlack50: lvOut,
      works: lvZero === 0 && lvLo[0] === 0 && lvHi[0] === 255 && Math.abs(lvMid[0] - 128) <= 2 && Math.abs(lvGamma - 181) <= 2 && Math.abs(lvOut - 50) <= 1 });

    // Curves: untouched it changes nothing; midtones 128 → 180 lifts grey but keeps black and white; red midtones down makes grey cyan-ish
    f = await only('curves'); draw(); const cvZero = diff(plain, frame()).max;
    set(f, 'rgb128', 180); draw(); const cvGrey = px(1760, 270)[0], cvBlack = px(160, 270)[0], cvWhite = px(480, 270)[0]; set(f, 'rgb128', 128);
    set(f, 'r128', 60); draw(); const cvRed = px(1760, 270);
    step('curves', { zero: cvZero, greyLifted: cvGrey, black: cvBlack, white: cvWhite, redMidDown: cvRed.join(),
      works: cvZero === 0 && cvGrey > 170 && cvGrey < 190 && cvBlack === 0 && cvWhite === 255 && cvRed[0] < 75 && Math.abs(cvRed[1] - 128) <= 2 });

    // Tint: black-to-white makes red grey (its Rec. 601 brightness, 94); map black to red paints the black patch red; 50% is halfway
    f = await only('tint'); draw(); const tnRed = px(800, 270);
    f.black = '#ff0000'; draw(); const tnBlack = px(160, 270).join(); f.black = '#000000';
    set(f, 'amount', 50); draw(); const tnHalf = px(800, 270); set(f, 'amount', 0); draw(); const tnOff = diff(plain, frame()).max;
    step('tint', { red: tnRed.join(), blackMappedRed: tnBlack, halfOnRed: tnHalf.join(), amount0: tnOff,
      works: closeTo(tnRed, [94, 94, 94], 2) && tnBlack === '255,0,0' && tnHalf[0] > 150 && tnHalf[0] < 200 && tnOff === 0 });

    const r6speed = {};
    for (const [id, vals] of [['huesat', { hue: 40, saturation: 30 }], ['levels', { inBlack: 20, gamma: 1.3 }], ['curves', { rgb64: 50, rgb192: 210, r128: 140 }], ['tint', {}]]) {
      const g = await only(id); for (const k in vals) set(g, k, vals[k]); draw(); ctx.getImageData(0, 0, 1, 1);
      const t0 = performance.now(); for (let i = 0; i < 10; i++) draw(1.1 + i / 30); ctx.getImageData(0, 0, 1, 1); r6speed[id] = +((performance.now() - t0) / 10).toFixed(1);
    }
    step('round6speed', r6speed);

    // ---- Round 6 leftovers. Hue/Saturation's colour ranges: Reds hue +120 turns the red patch green and leaves the green
    // patch; Reds saturation -100 greys red (130); the Channel Control menu shows that range's settings
    {
      const R6 = { RED: 800, GRN: 1120, GRY: 1760, BLK: 160, WHT: 480, Y: 270 }, cl = (a, b, t) => a.every((v, k) => Math.abs(v - b[k]) <= t);
      f = await only('huesat'); set(f, 'redsHue', 120); draw(); const rgRed = px(R6.RED, R6.Y), rgGreen = px(R6.GRN, R6.Y); set(f, 'redsHue', 0);
      set(f, 'redsSat', -100); draw(); const rgGrey = px(R6.RED, R6.Y), rgGreen2 = px(R6.GRN, R6.Y); set(f, 'redsSat', 0);
      S.sel = L.id; setRightTab('fx'); f.channel = 1; refresh(); const rgRows = !!document.querySelector('#inspector [data-p$="_redsHue"], #inspector [id$="_redsHue"]') || $('#inspector').textContent.includes('Red hue');
      f.channel = 0; refresh();
      step('huesatRanges', { redsHue120: rgRed.join(), green: rgGreen.join(), redsSat0: rgGrey.join(), green2: rgGreen2.join(), panelShowsReds: rgRows,
        works: cl(rgRed, [40, 220, 40], 2) && cl(rgGreen, P0(R6.GRN, R6.Y), 1) && cl(rgGrey, [130, 130, 130], 1) && cl(rgGreen2, P0(R6.GRN, R6.Y), 1) && rgRows });

      // Levels' channels: Green Input White 204 lifts grey's green to 160; Red Output Black 128 makes black (128, 0, 0);
      // Alpha Output White 128 makes white half see-through (128); with the RGB controls too, the channel works on their result
      f = await only('levels'); set(f, 'greenInWhite', 204); draw(); const lcGreen = px(R6.GRY, R6.Y); set(f, 'greenInWhite', 255);
      set(f, 'redOutBlack', 128); draw(); const lcRed = px(R6.BLK, R6.Y); set(f, 'redOutBlack', 0);
      set(f, 'alphaOutWhite', 128); draw(); const lcAlpha = px(R6.WHT, R6.Y); set(f, 'alphaOutWhite', 255);
      set(f, 'gamma', 2); set(f, 'redOutWhite', 128); draw(); const lcBoth = px(R6.GRY, R6.Y); set(f, 'gamma', 1); set(f, 'redOutWhite', 255);
      draw(); const lcZero = diff(plain, frame()).max;
      step('levelsChannels', { greenWhite204: lcGreen.join(), redOutBlack128: lcRed.join(), alphaHalf: lcAlpha.join(), gamma2ThenRedHalf: lcBoth.join(), backToZero: lcZero,
        works: cl(lcGreen, [128, 160, 128], 1) && cl(lcRed, [128, 0, 0], 1) && cl(lcAlpha, [128, 128, 128], 1) && cl(lcBoth, [91, 181, 181], 1) && lcZero === 0 });

      // Curves' graph: typing points works ("0,0 0.5,0.75 1,1" lifts grey to 192); the Red graph alone lowers red;
      // dragging the middle of the RGB graph up adds a point and lifts grey; double-clicking it takes it away again;
      // an older project's slider still counts until the graph is used
      f = await only('curves'); f.cRGB = '0,0 0.5,0.75 1,1'; draw(); const cgType = px(R6.GRY, R6.Y); f.cRGB = '';
      f.cRed = '0,0 0.5,0.25 1,1'; draw(); const cgRed = px(R6.GRY, R6.Y); f.cRed = '';
      set(f, 'rgb128', 180); draw(); const cgOld = px(R6.GRY, R6.Y)[0]; set(f, 'rgb128', 128);
      S.sel = L.id; setRightTab('fx'); f.chan = 0; refresh();
      const cv = $('#inspector canvas.curvebox'), r = cv?.getBoundingClientRect(), at = (u, v) => ({ clientX: r.left + u * r.width, clientY: r.top + (1 - v) * r.height, pointerId: 1, bubbles: true });
      let cgDrag = null, cgAfterDbl = null, cgPts = null, cgDblPts = null;
      if (cv) {
        cv.dispatchEvent(new PointerEvent('pointerdown', at(.5, .5))); cv.dispatchEvent(new PointerEvent('pointermove', at(.5, .75))); cv.dispatchEvent(new PointerEvent('pointerup', at(.5, .75)));
        cgPts = f.cRGB; draw(); cgDrag = px(R6.GRY, R6.Y);
        cv.dispatchEvent(new MouseEvent('dblclick', at(.5, .75))); cgDblPts = f.cRGB; draw(); cgAfterDbl = px(R6.GRY, R6.Y);
      }
      const cgText = $('#inspector input[type=text][data-fxk=cRGB]')?.value;
      step('curvesGraph', { typed: cgType.join(), redGraph: cgRed.join(), oldSlider: cgOld, graph: !!cv, afterDrag: cgPts, dragGrey: cgDrag?.join(), afterDblclick: cgDblPts, dblGrey: cgAfterDbl?.join(), textField: cgText,
        works: cl(cgType, [192, 192, 192], 1) && cl(cgRed, [64, 128, 128], 1) && cgOld > 170 && !!cv && cgDrag && cgDrag[0] > 180 && cgAfterDbl && cl(cgAfterDbl, [128, 128, 128], 1) && cgText === cgDblPts });
    }

    // ---- Round 7: colour I. Patches at y 270: black 160, white 480, red 800, green 1120, blue 1440, grey 1760
    const RED = 800, GRN = 1120, GRY = 1760, BLK = 160, WHT = 480, Y = 270;
    // Vibrance: zero changes nothing; -100 saturation makes red grey; +100 vibrance makes red purer and leaves grey grey
    f = await only('vibrance'); draw(); const vbZero = diff(plain, frame()).max;
    set(f, 'saturation', -100); draw(); const vbGrey = px(RED, Y); set(f, 'saturation', 0);
    set(f, 'vibrance', 100); draw(); const vbRed = px(RED, Y), vbG = px(GRY, Y);
    const fxcPipe = FXG.pipes['fx_color:fxc_point'];
    if (fxcPipe?.err || !fxcPipe?.pipe) { const m = FXG.mods.fx_color; step('fxcKernel', { built: !!fxcPipe?.pipe, err: fxcPipe?.err, log: m ? (await m.getCompilationInfo()).messages.slice(0, 8).map(x => `${x.lineNum}:${x.linePos} ${x.message}`) : null }); }
    step('vibrance', { zero: vbZero, desaturatedRed: vbGrey.join(), vibrantRed: vbRed.join(), grey: vbG.join(),
      works: vbZero === 0 && Math.max(...vbGrey) - Math.min(...vbGrey) <= 2 && vbRed[1] < 35 && vbRed[0] >= 220 && closeTo(vbG, [128, 128, 128], 1) });

    // Color Balance: shadows blue +100 turns black navy (0,0,128); highlights red -100 turns white cyan-ish (128,255,255);
    // midtones red +100 makes grey pink, and Preserve luminosity pulls its brightness back toward grey's
    f = await only('colorbalance'); draw(); const cbZero = diff(plain, frame()).max;
    set(f, 'shadowBlue', 100); draw(); const cbBlack = px(BLK, Y); set(f, 'shadowBlue', 0);
    set(f, 'hiRed', -100); draw(); const cbWhite = px(WHT, Y); set(f, 'hiRed', 0);
    set(f, 'midRed', 100); draw(); const cbPink = px(GRY, Y); f.preserve = true; draw(); const cbKept = px(GRY, Y); f.preserve = false;
    step('colorbalance', { zero: cbZero, blackShadowBlue: cbBlack.join(), whiteHighlightRedDown: cbWhite.join(), greyMidRed: cbPink.join(), preserved: cbKept.join(),
      works: cbZero === 0 && closeTo(cbBlack, [0, 0, 128], 2) && closeTo(cbWhite, [128, 255, 255], 2) && closeTo(cbPink, [255, 128, 128], 2) && lum(cbKept) < lum(cbPink) - 15 });

    // Black & White: red becomes grey at 40% between its min and max (112); green 42.5% (108); grey stays grey; Tint warms grey
    f = await only('blackwhite'); draw(); const bwRed = px(RED, Y), bwGreen = px(GRN, Y), bwGrey = px(GRY, Y);
    set(f, 'reds', 100); draw(); const bwRed100 = px(RED, Y); set(f, 'reds', 40);
    f.tint = true; draw(); const bwTint = px(GRY, Y); f.tint = false;
    step('blackwhite', { red: bwRed.join(), green: bwGreen.join(), grey: bwGrey.join(), redsAt100: bwRed100.join(), tintedGrey: bwTint.join(),
      works: closeTo(bwRed, [112, 112, 112], 2) && closeTo(bwGreen, [108, 108, 108], 2) && closeTo(bwGrey, [128, 128, 128], 1) && closeTo(bwRed100, [220, 220, 220], 2) && bwTint[0] > bwTint[2] + 20 });

    // Tritone: black → Shadows, white → Highlights, mid grey → Midtones (128, 102, 77); Blend 100 is the original
    f = await only('tritone'); draw(); const ttBlack = px(BLK, Y).join(), ttWhite = px(WHT, Y).join(), ttGrey = px(GRY, Y);
    set(f, 'blend', 100); draw(); const ttOrig = diff(plain, frame()).max;
    step('tritone', { black: ttBlack, white: ttWhite, grey: ttGrey.join(), blend100: ttOrig,
      works: ttBlack === '0,0,0' && ttWhite === '255,255,255' && closeTo(ttGrey, [128, 102, 77], 3) && ttOrig === 0 });

    // Colorama: brightness around the colour wheel: black → red, mid grey → cyan; Phase shift 120° turns black green;
    // without Smooth palette the grey lands exactly on cyan's step
    f = await only('colorama'); draw(); const caBlack = px(BLK, Y), caGrey = px(GRY, Y);
    set(f, 'shift', 120); draw(); const caShift = px(BLK, Y); set(f, 'shift', 0);
    f.smooth = false; draw(); const caStep = px(GRY, Y); f.smooth = true;
    step('colorama', { black: caBlack.join(), grey: caGrey.join(), blackShift120: caShift.join(), greyStepped: caStep.join(),
      works: closeTo(caBlack, [255, 0, 0], 1) && caGrey[0] < 10 && caGrey[1] > 240 && caGrey[2] > 240 && closeTo(caShift, [0, 255, 0], 1) && closeTo(caStep, [0, 255, 255], 1) });

    // Channel Mixer: the default changes nothing; swapping red and blue turns red blue; Monochrome copies the red output everywhere
    f = await only('channelmixer'); draw(); const cmZero = diff(plain, frame()).max;
    set(f, 'rr', 0); set(f, 'rb', 100); set(f, 'bb', 0); set(f, 'br', 100); draw(); const cmSwap = px(RED, Y);
    set(f, 'rr', 100); set(f, 'rb', 0); set(f, 'bb', 100); set(f, 'br', 0); f.mono = true; draw(); const cmMono = px(RED, Y); f.mono = false;
    step('channelmixer', { zero: cmZero, redSwapped: cmSwap.join(), redMono: cmMono.join(),
      works: cmZero === 0 && closeTo(cmSwap, [40, 40, 220], 1) && closeTo(cmMono, [220, 220, 220], 1) });

    // Selective Color: Reds cyan +100 takes red out of the red patch only (relative: 70.6% × its 13.7% ink → about 195;
    // absolute: all of it → about 40); green and grey stay. The Colors menu shows one range's four sliders at a time.
    f = await only('selectivecolor'); draw(); const scZero = diff(plain, frame()).max;
    const scRows = () => [...document.querySelectorAll('#inspector .fxi .prow')].map(r => PROPS[r.dataset.p]?.label);
    S.sel = L.id; setRightTab('fx'); refresh(); const scShown = scRows();
    const scPick = $(`#fx-${f.uid}-range`); scPick.value = 4; scPick.dispatchEvent(new Event('input', { bubbles: true })); const scBlues = scRows();
    set(f, 'redsCyan', 100); draw(); const scRel = px(RED, Y), scGreen = px(GRN, Y), scGrey = px(GRY, Y);
    f.method = 1; draw(); const scAbs = px(RED, Y); f.method = 0;
    step('selectivecolor', { zero: scZero, panelRows: scShown, afterPickingBlues: scBlues, relativeRed: scRel.join(), absoluteRed: scAbs.join(), green: scGreen.join(), grey: scGrey.join(),
      works: scZero === 0 && scShown.length === 4 && scBlues.length === 4 && scBlues.every(l => l.startsWith('Blues')) && Math.abs(scRel[0] - 195) <= 3 && scRel[1] === 40
        && Math.abs(scAbs[0] - 40) <= 3 && closeTo(scGreen, P0(GRN, Y), 1) && closeTo(scGrey, P0(GRY, Y), 1) });

    const r7speed = {};
    for (const [id, vals] of [['vibrance', { vibrance: 50 }], ['colorbalance', { midRed: 30 }], ['blackwhite', {}], ['tritone', {}], ['colorama', {}], ['channelmixer', { rg: 30 }], ['selectivecolor', { redsCyan: 40 }]]) {
      const g = await only(id); for (const k in vals) set(g, k, vals[k]); draw(); ctx.getImageData(0, 0, 1, 1);
      const t0 = performance.now(); for (let i = 0; i < 10; i++) draw(1.1 + i / 30); ctx.getImageData(0, 0, 1, 1); r7speed[id] = +((performance.now() - t0) / 10).toFixed(1);
    }
    step('round7speed', r7speed);

    // ---- Round 8: colour II (fx_tone's fxt_point; Exposure in the base kernels). Same patches at y 270; BLU 1440
    const BLU = 1440;
    const t8k = FXG.pipes['fx_tone:fxt_point'];
    // Exposure +1 on grey 128: linear light 0.2195 × 2 back to 0.688 (175); bypassing linear light doubles it to white;
    // Individual channels moves just one
    f = await only('exposure'); draw(); const exZero = diff(plain, frame()).max;
    if (!FXG.pipes['kernels:pointwise']?.pipe) step('exposureKernel', { err: FXG.pipes['kernels:pointwise']?.err });
    set(f, 'masterExposure', 1); draw(); const exGrey = px(GRY, Y); f.bypass = true; draw(); const exBypass = px(GRY, Y); f.bypass = false;
    f.channels = 1; set(f, 'redExposure', 1); draw(); const exRed = px(GRY, Y); f.channels = 0;
    step('exposure', { zero: exZero, grey: exGrey.join(), bypass: exBypass.join(), redOnly: exRed.join(),
      works: exZero === 0 && closeTo(exGrey, [175, 175, 175], 2) && closeTo(exBypass, [255, 255, 255], 1) && closeTo(exRed, [175, 128, 128], 2) });

    // Photo Filter: Density 0 changes nothing; Warming (85) at 25% warms grey to (140, 126, 111) keeping its brightness,
    // (126, 114, 100) without Preserve luminosity; Custom uses the Color setting
    f = await only('photofilter'); set(f, 'density', 0); draw(); const pfZero = diff(plain, frame()).max; set(f, 'density', 25);
    if (t8k?.err || (!t8k?.pipe && !FXG.pipes['fx_tone:fxt_point']?.pipe)) { const m = FXG.mods.fx_tone; step('fxtKernel', { err: FXG.pipes['fx_tone:fxt_point']?.err, log: m ? (await m.getCompilationInfo()).messages.slice(0, 8).map(x => `${x.lineNum}:${x.linePos} ${x.message}`) : null }); }
    draw(); const pfWarm = px(GRY, Y); f.preserve = false; draw(); const pfFlat = px(GRY, Y); f.preserve = true;
    f.filter = PHOTO_FILTERS.length - 1; f.color = '#0000ff'; set(f, 'density', 100); f.preserve = false; draw(); const pfBlue = px(WHT, Y);
    step('photofilter', { zero: pfZero, warmGrey: pfWarm.join(), noPreserve: pfFlat.join(), customBlueOnWhite: pfBlue.join(),
      works: pfZero === 0 && closeTo(pfWarm, [140, 126, 111], 3) && closeTo(pfFlat, [126, 114, 100], 3) && closeTo(pfBlue, [0, 0, 255], 1) });

    // Shadow/Highlight: Shadow 100 lifts the dark end of the ramp and leaves white; Highlight 100 halves the white patch's
    // middle (128); Auto Amounts (on by default) lifts the shadows a little
    f = await only('shadowhighlight'); f.auto = false; set(f, 'shadowAmount', 0); set(f, 'highlightAmount', 0); draw(); const shNone = diff(plain, frame()).max;
    const dark = () => lum(px(200, 810));
    set(f, 'shadowAmount', 100); draw(); const shLift = [Math.round(lum(P0(200, 810))), Math.round(dark())], shWhite = px(WHT, Y);
    set(f, 'shadowAmount', 0); set(f, 'highlightAmount', 100); draw(); const shHi = px(WHT, Y);
    f.auto = true; draw(); const shAuto = Math.round(dark()), mean = +fxLumaMean((() => { const c = document.createElement('canvas'); c.width = 1920; c.height = 1080; c.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(plain), 1920, 1080), 0, 0); return c; })()).toFixed(3);
    step('shadowhighlight', { zero: shNone, darkBeforeAfter: shLift, whiteKept: shWhite.join(), highlightWhite: shHi.join(), autoDark: shAuto, cardMean: mean,
      works: shNone === 0 && shLift[1] > shLift[0] + 15 && closeTo(shWhite, [255, 255, 255], 1) && closeTo(shHi, [128, 128, 128], 4) && shAuto > shLift[0] + 2 });

    // Change Color (match by hue): Hue +120° turns the red patch green and leaves the green patch; the mask view shows white
    // where it matches, black elsewhere
    f = await only('changecolor'); draw(); const ccZero = diff(plain, frame()).max;
    set(f, 'hue', 120); draw(); const ccRed = px(RED, Y), ccGreen = px(GRN, Y);
    f.view = 1; draw(); const ccMaskRed = px(RED, Y), ccMaskGreen = px(GRN, Y); f.view = 0;
    step('changecolor', { zero: ccZero, red: ccRed.join(), green: ccGreen.join(), maskRed: ccMaskRed.join(), maskGreen: ccMaskGreen.join(),
      works: ccZero === 0 && closeTo(ccRed, [40, 220, 40], 2) && closeTo(ccGreen, P0(GRN, Y), 1) && closeTo(ccMaskRed, [255, 255, 255], 1) && closeTo(ccMaskGreen, [0, 0, 0], 1) });

    // Change to Color: red → blue's hue turns the red patch (40, 40, 220); green stays; the correction matte is white on red
    f = await only('changetocolor'); draw(); const ctRed = px(RED, Y), ctGreen = px(GRN, Y);
    f.viewMatte = true; draw(); const ctMatte = [px(RED, Y).join(), px(GRN, Y).join()]; f.viewMatte = false;
    step('changetocolor', { red: ctRed.join(), green: ctGreen.join(), matte: ctMatte,
      works: closeTo(ctRed, [40, 40, 220], 2) && closeTo(ctGreen, P0(GRN, Y), 1) && ctMatte[0] === '255,255,255' && ctMatte[1] === '0,0,0' });

    // Leave Color (by hue): Amount 0 changes nothing; at 100 the red stays and the green goes grey (156)
    f = await only('leavecolor'); draw(); const lcZero = diff(plain, frame()).max;
    set(f, 'amount', 100); f.match = 1; draw(); const lcRed = px(RED, Y), lcGreen = px(GRN, Y);
    step('leavecolor', { zero: lcZero, red: lcRed.join(), green: lcGreen.join(),
      works: lcZero === 0 && closeTo(lcRed, P0(RED, Y), 1) && closeTo(lcGreen, [156, 156, 156], 2) });

    // Color Balance (HLS): hue 120 turns red green; lightness -100 is black; saturation -100 makes red grey (130)
    f = await only('colorbalancehls'); draw(); const hlZero = diff(plain, frame()).max;
    set(f, 'hue', 120); draw(); const hlHue = px(RED, Y); set(f, 'hue', 0);
    set(f, 'lightness', -100); draw(); const hlDark = px(RED, Y); set(f, 'lightness', 0);
    set(f, 'saturation', -100); draw(); const hlGrey = px(RED, Y);
    step('colorbalancehls', { zero: hlZero, hue120: hlHue.join(), lightnessDown: hlDark.join(), saturationDown: hlGrey.join(),
      works: hlZero === 0 && closeTo(hlHue, [40, 220, 40], 2) && closeTo(hlDark, [0, 0, 0], 1) && closeTo(hlGrey, [130, 130, 130], 1) });

    // Gamma/Pedestal/Gain: red gain 0.5 on white (128, 255, 255); green pedestal 0.2 on black (0, 51, 0); red gamma 2 on grey (64)
    f = await only('gammapedestalgain'); draw(); const gpZero = diff(plain, frame()).max;
    set(f, 'redGain', .5); draw(); const gpGain = px(WHT, Y); set(f, 'redGain', 1);
    set(f, 'greenPedestal', .2); draw(); const gpPed = px(BLK, Y); set(f, 'greenPedestal', 0);
    set(f, 'redGamma', 2); draw(); const gpGam = px(GRY, Y);
    step('gammapedestalgain', { zero: gpZero, redGainWhite: gpGain.join(), greenPedestalBlack: gpPed.join(), redGammaGrey: gpGam.join(),
      works: gpZero === 0 && closeTo(gpGain, [128, 255, 255], 1) && closeTo(gpPed, [0, 51, 0], 1) && closeTo(gpGam, [64, 128, 128], 1) });

    // CC Toner (Tritone): black → Shadows, white → Highlights, grey → Midtones (140, 110, 71); Blend 100 is the original
    f = await only('cctoner'); draw(); const toBlack = px(BLK, Y), toWhite = px(WHT, Y), toGrey = px(GRY, Y);
    f.tones = 0; draw(); const toDuo = px(GRY, Y); f.tones = 1;
    set(f, 'blend', 100); draw(); const toOrig = diff(plain, frame()).max;
    step('cctoner', { black: toBlack.join(), white: toWhite.join(), grey: toGrey.join(), duotoneGrey: toDuo.join(), blend100: toOrig,
      works: closeTo(toBlack, [0, 0, 0], 1) && closeTo(toWhite, [255, 255, 255], 1) && closeTo(toGrey, [140, 111, 72], 2) && closeTo(toDuo, [128, 128, 128], 2) && toOrig === 0 });

    // CC Color Offset: red phase 90° adds a quarter: grey 128 → 192; white overflows: Wrap 64, Solarize 191, Polarize 0 (off when it overflows by less than half)
    f = await only('cccoloroffset'); draw(); const coZero = diff(plain, frame()).max;
    set(f, 'redPhase', 90); draw(); const coGrey = px(GRY, Y), coWrap = px(WHT, Y)[0];
    f.overflow = 1; draw(); const coSol = px(WHT, Y)[0]; f.overflow = 2; draw(); const coPol = px(WHT, Y)[0]; f.overflow = 0;
    step('cccoloroffset', { zero: coZero, grey: coGrey.join(), whiteRed: { wrap: coWrap, solarize: coSol, polarize: coPol },
      works: coZero === 0 && closeTo(coGrey, [192, 128, 128], 1) && Math.abs(coWrap - 64) <= 1 && Math.abs(coSol - 191) <= 1 && coPol === 0 });

    const r8speed = {};
    for (const [id, vals, opts] of [['exposure', { masterExposure: .5 }], ['photofilter', {}], ['shadowhighlight', {}], ['changecolor', { hue: 60 }], ['changetocolor', {}], ['leavecolor', { amount: 80 }],
      ['colorbalancehls', { hue: 30 }], ['gammapedestalgain', { redGain: .8 }], ['cctoner', {}], ['cccoloroffset', { greenPhase: 60 }]]) {
      const g = await only(id); for (const k in vals) set(g, k, vals[k]); Object.assign(g, opts || {}); draw(); ctx.getImageData(0, 0, 1, 1);
      const t0 = performance.now(); for (let i = 0; i < 10; i++) draw(1.1 + i / 30); ctx.getImageData(0, 0, 1, 1); r8speed[id] = +((performance.now() - t0) / 10).toFixed(1);
    }
    step('round8speed', r8speed);

    // ---- Round 9: colour III, auto & broadcast (the auto effects read the picture back from the graphics card)
    const rgbOf = c => c.join();
    // Auto Levels / Contrast / Color after a Levels that squeezes the card into 64..192: each reads the squeezed picture as
    // it reaches it and stretches it back (black 0, white 255, grey 128); Blend 100 leaves the squeezed picture
    const squeeze = async id => { while (L.fx?.length) delFX(L, 0); const lv = await add('levels'); set(lv, 'outBlack', 64); set(lv, 'outWhite', 192); return add(id); };
    const autoR = {};
    for (const id of ['autolevels', 'autocontrast', 'autocolor']) {
      f = await squeeze(id); if (id === 'autocolor') f.snap = false;
      draw(); const o = { black: px(BLK, Y), white: px(WHT, Y), grey: px(GRY, Y) };
      if (id === 'autocolor') { f.snap = true; draw(); o.snapBlack = px(BLK, Y); o.snapWhite = px(WHT, Y); }
      set(f, 'blend', 100); draw(); o.blend100 = px(BLK, Y);
      autoR[id] = { black: rgbOf(o.black), white: rgbOf(o.white), grey: rgbOf(o.grey), blend100: rgbOf(o.blend100), ...(o.snapBlack ? { snapBlack: rgbOf(o.snapBlack), snapWhite: rgbOf(o.snapWhite) } : {}),
        works: closeTo(o.black, [0, 0, 0], 2) && closeTo(o.white, [255, 255, 255], 2) && closeTo(o.grey, [128, 128, 128], 2) && closeTo(o.blend100, [64, 64, 64], 1)
          && (!o.snapBlack || (closeTo(o.snapBlack, [0, 0, 0], 2) && closeTo(o.snapWhite, [255, 255, 255], 2))) };
    }
    if (!FXG.pipes['fx_tone:fxt_point']?.pipe) step('fxtKernel9', { err: FXG.pipes['fx_tone:fxt_point']?.err });
    step('autocorrect', autoR);

    // Equalize: Amount 0 changes nothing; RGB spreads the card (black is lifted by its share of the picture, white stays)
    f = await only('equalize'); set(f, 'amount', 0); draw(); const eqZero = diff(plain, frame()).max; set(f, 'amount', 100);
    draw(); const eqBlack = px(BLK, Y), eqWhite = px(WHT, Y);
    f.style = 1; draw(); const eqBright = px(BLK, Y); f.style = 0;
    step('equalize', { zero: eqZero, black: rgbOf(eqBlack), white: rgbOf(eqWhite), brightnessBlack: rgbOf(eqBright),
      works: eqZero === 0 && eqBlack[0] > 10 && closeTo(eqWhite, [255, 255, 255], 1) && eqBright[0] > 10 });

    // Broadcast Colors: at 110 IRE the card is safe; at 90 IRE white is cut to 227 and red stays; Key Out Unsafe takes
    // white away, Key Out Safe takes red away
    f = await only('broadcast'); draw(); const bcSafe = diff(plain, frame()).max;
    set(f, 'maxSignal', 90); draw(); const bcWhite = px(WHT, Y), bcRed = px(RED, Y);
    f.how = 2; draw(); const bcKeyUnsafe = px(WHT, Y); f.how = 3; draw(); const bcKeySafe = px(RED, Y); f.how = 0;
    step('broadcast', { safeAt110: bcSafe, whiteAt90: rgbOf(bcWhite), redAt90: rgbOf(bcRed), keyOutUnsafeWhite: rgbOf(bcKeyUnsafe), keyOutSafeRed: rgbOf(bcKeySafe),
      works: bcSafe === 0 && closeTo(bcWhite, [227, 227, 227], 1) && closeTo(bcRed, P0(RED, Y), 1) && rgbOf(bcKeyUnsafe) === '0,0,0' && rgbOf(bcKeySafe) === '0,0,0' });

    // Video Limiter (Smart Limit, 100%, 5% compression): white eases to 250, grey stays; Luma at 90% gives 229;
    // Gamut Warning paints the changed pixels red
    f = await only('videolimiter'); draw(); const vlWhite = px(WHT, Y), vlGrey = px(GRY, Y);
    f.clipLevel = 0; f.clipMethod = 0; draw(); const vl90 = px(WHT, Y);
    f.warn = true; draw(); const vlWarn = px(WHT, Y), vlWarnGrey = px(GRY, Y);
    step('videolimiter', { white: rgbOf(vlWhite), grey: rgbOf(vlGrey), lumaAt90: rgbOf(vl90), warning: rgbOf(vlWarn), warningGrey: rgbOf(vlWarnGrey),
      works: closeTo(vlWhite, [250, 250, 250], 1) && closeTo(vlGrey, P0(GRY, Y), 1) && closeTo(vl90, [229, 229, 229], 1) && rgbOf(vlWarn) === '255,0,0' && closeTo(vlWarnGrey, P0(GRY, Y), 1) });

    // PS Arbitrary Map: an empty map and phase 0 change nothing; the map "255, 0" inverts (grey 127, white 0);
    // phase 64 on the straight map moves grey up to 192 and wraps white round to 63
    f = await only('psarbitrarymap'); draw(); const amZero = diff(plain, frame()).max;
    f.map = '255, 0'; draw(); const amInvGrey = px(GRY, Y), amInvWhite = px(WHT, Y); f.map = '';
    set(f, 'phase', 64); draw(); const amPhGrey = px(GRY, Y), amPhWhite = px(WHT, Y);
    S.sel = L.id; setRightTab('fx'); refresh(); const amField = !!$('#inspector input[type=text][data-fxk=map]');
    step('psarbitrarymap', { zero: amZero, invertGrey: rgbOf(amInvGrey), invertWhite: rgbOf(amInvWhite), phase64Grey: rgbOf(amPhGrey), phase64White: rgbOf(amPhWhite), mapField: amField,
      works: amZero === 0 && closeTo(amInvGrey, [127, 127, 127], 1) && closeTo(amInvWhite, [0, 0, 0], 1) && closeTo(amPhGrey, [192, 192, 192], 1) && closeTo(amPhWhite, [63, 63, 63], 1) && amField });

    // Levels (Individual Controls): Green Input White 204 lifts grey's green to 160; RGB gamma 2 lifts grey to 181;
    // Alpha Output White 128 makes the layer half see-through (white over black: 128)
    f = await only('levelsic'); draw(); const liZero = diff(plain, frame()).max;
    set(f, 'greenInWhite', 204); draw(); const liGreen = px(GRY, Y); set(f, 'greenInWhite', 255);
    set(f, 'rgbGamma', 2); draw(); const liGamma = px(GRY, Y); set(f, 'rgbGamma', 1);
    set(f, 'alphaOutWhite', 128); draw(); const liAlpha = px(WHT, Y);
    step('levelsic', { zero: liZero, greenWhite204: rgbOf(liGreen), gamma2: rgbOf(liGamma), alphaHalf: rgbOf(liAlpha),
      works: liZero === 0 && closeTo(liGreen, [128, 160, 128], 1) && closeTo(liGamma, [181, 181, 181], 1) && closeTo(liAlpha, [128, 128, 128], 1) });

    // CC Color Neutralizer: as it starts nothing changes; Midtones Unbalance (153, 128, 102) → grey takes the cast out of grey
    f = await only('cccolorneutralizer'); draw(); const cnZero = diff(plain, frame()).max;
    f.midsUn = '#998066'; draw(); const cnGrey = px(GRY, Y), cnWhite = px(WHT, Y);
    step('cccolorneutralizer', { zero: cnZero, grey: rgbOf(cnGrey), white: rgbOf(cnWhite),
      works: cnZero === 0 && closeTo(cnGrey, [103, 128, 154], 2) && closeTo(cnWhite, [255, 255, 255], 1) });

    // CC Kernel: Scale 0.5 halves grey (64); Offset 0.2 lifts black to 51; an edge kernel leaves flat areas black
    f = await only('cckernel'); draw(); const ckZero = diff(plain, frame()).max;
    set(f, 'scale', .5); draw(); const ckHalf = px(GRY, Y); set(f, 'scale', 1);
    set(f, 'offset', .2); draw(); const ckOff = px(BLK, Y); set(f, 'offset', 0);
    for (let i = 1; i <= 9; i++) set(f, 'k' + i, i === 5 ? 8 : -1); draw(); const ckEdgeFlat = px(WHT, Y);
    step('cckernel', { zero: ckZero, scaleHalfGrey: rgbOf(ckHalf), offsetBlack: rgbOf(ckOff), edgeFlatWhite: rgbOf(ckEdgeFlat),
      works: ckZero === 0 && closeTo(ckHalf, [64, 64, 64], 1) && closeTo(ckOff, [51, 51, 51], 1) && closeTo(ckEdgeFlat, [0, 0, 0], 1) });

    // Color Link: with no source layer the card becomes its own average colour; Brightest makes it white; a hidden blue
    // ellipse as the source layer makes it (51, 102, 204); at 50% opacity black becomes half of that
    f = await only('colorlink');
    { const pp = FXG.pipes['fx_pixel2:fp2_point']; if (!pp?.pipe) { const m = FXG.mods.fx_pixel2; step('fp2Kernel', { err: pp?.err, log: m ? (await m.getCompilationInfo()).messages.slice(0, 8).map(x => `${x.lineNum}:${x.linePos} ${x.message}`) : null }); } }
    draw(); const clA = px(BLK, Y), clB = px(WHT, Y);
    const avg = [0, 1, 2].map(k => { let s = 0; for (let i = k; i < plain.length; i += 4) s += plain[i]; return s / (plain.length / 4); });
    f.sample = 2; draw(); const clBright = px(BLK, Y); f.sample = 0;
    addShape('ellipse'); const M = selLayer(); Object.assign(M, { fill: '#3366cc', visible: false, start: 0, dur: 6 });
    f.source = M.id; draw(); const clSrc = px(BLK, Y);
    set(f, 'opacity', 50); draw(); const clHalf = px(BLK, Y); set(f, 'opacity', 100);
    S.sel = L.id; setRightTab('fx'); refresh(); const clListed = [...document.querySelectorAll('#inspector select[data-fxk=source] option')].map(o => +o.value).includes(M.id);
    S.layers = S.layers.filter(x => x !== M); f.source = 0;
    step('colorlink', { ownAverage: [rgbOf(clA), rgbOf(clB)], expected: avg.map(Math.round).join(), brightest: rgbOf(clBright), fromBlueLayer: rgbOf(clSrc), half: rgbOf(clHalf), sourceListed: clListed,
      works: rgbOf(clA) === rgbOf(clB) && closeTo(clA, avg, 3) && closeTo(clBright, [255, 255, 255], 1) && closeTo(clSrc, [51, 102, 204], 1) && closeTo(clHalf, [26, 51, 102], 2) && clListed });

    // Color Stabilizer: with no reference frame nothing changes; the panel button takes the playhead's frame (its black,
    // grey and white samples); on this still card later frames stay the same; with a brighter reference (black 0.2)
    // Brightness lifts black to 51 and grey to 179, and Levels to 0.1-0.9 maps black 26, grey 128, white 230
    f = await only('colorstabilizer');
    set(f, 'blackPointX', 160 / 1920); set(f, 'blackPointY', .25); set(f, 'midPointX', 1760 / 1920); set(f, 'midPointY', .25); set(f, 'whitePointX', 480 / 1920); set(f, 'whitePointY', .25);
    draw(2); const csNone = diff(plain, frame()).max;
    S.sel = L.id; setRightTab('fx'); refresh(); draw(1); $('#inspector [data-act=fxbtn]').click();
    const csRef = f.ref?.map(c => c.map(v => Math.round(v * 255)).join()), csRefT = f.refT;
    draw(2); const csSame = diff(plain, frame()).max;
    f.ref = [[.2, .2, .2], [.5, .5, .5], [1, 1, 1]]; draw(2); const csBlack = px(BLK, Y), csGrey = px(GRY, Y);
    f.mode = 1; f.ref = [[.1, .1, .1], [.5, .5, .5], [.9, .9, .9]]; draw(2); const csLvB = px(BLK, Y), csLvG = px(GRY, Y), csLvW = px(WHT, Y);
    step('colorstabilizer', { noReference: csNone, reference: csRef, refTime: csRefT, laterFrame: csSame, brightness: [rgbOf(csBlack), rgbOf(csGrey)], levels: [rgbOf(csLvB), rgbOf(csLvG), rgbOf(csLvW)],
      works: csNone === 0 && csRef?.join('|') === '0,0,0|128,128,128|255,255,255' && csRefT === 1 && csSame === 0 && closeTo(csBlack, [51, 51, 51], 1) && closeTo(csGrey, [179, 179, 179], 1)
        && closeTo(csLvB, [26, 26, 26], 1) && closeTo(csLvG, [128, 128, 128], 1) && closeTo(csLvW, [230, 230, 230], 1) });
    seek(1);

    const r9speed = {};
    for (const [id, vals, opts] of [['autolevels', {}], ['autocontrast', {}], ['autocolor', {}], ['equalize', {}], ['broadcast', { maxSignal: 95 }], ['videolimiter', {}], ['psarbitrarymap', { phase: 40 }],
      ['levelsic', { rgbGamma: 1.4 }], ['cccolorneutralizer', {}, { midsUn: '#998066' }], ['cckernel', { scale: .8 }], ['colorlink', {}], ['colorstabilizer', {}, { refT: 0, ref: [[.1, .1, .1], [.5, .5, .5], [.9, .9, .9]] }]]) {
      const g = await only(id); for (const k in vals) set(g, k, vals[k]); Object.assign(g, opts || {}); draw(); ctx.getImageData(0, 0, 1, 1);
      const t0 = performance.now(); for (let i = 0; i < 10; i++) draw(1.1 + i / 30); ctx.getImageData(0, 0, 1, 1); r9speed[id] = +((performance.now() - t0) / 10).toFixed(1);
    }
    step('round9speed', r9speed);

    // ---- Round 10: Lumetri Color (Lumina's lumina_lumetri.wgsl). Values worked out from EffectCraft's color3.rs maths
    f = await only('lumetri');
    { const pp = FXG.pipes['lumina_lumetri:llm_grade']; if (!pp?.pipe) { const m = FXG.mods.lumina_lumetri; step('llmKernel', { err: pp?.err, log: m ? (await m.getCompilationInfo()).messages.slice(0, 8).map(x => `${x.lineNum}:${x.linePos} ${x.message}`) : null }); } }
    const lm = {};
    const reset = () => { while (L.fx?.length) delFX(L, 0); f = addFX(L, 'lumetri'); };
    draw(); lm.zero = diff(plain, frame()).max;
    // Basic: Exposure -1 halves grey (64); Temperature 100 warms grey to (160, 128, 96); Saturation 0 makes red grey (78);
    // Whites 100 lifts grey to 141, and with High Dynamic Range at HDR White 200 only to 134
    set(f, 'exposure', -1); draw(); lm.exposure = px(GRY, Y); set(f, 'exposure', 0);
    set(f, 'temperature', 100); draw(); lm.warm = px(GRY, Y); set(f, 'temperature', 0);
    set(f, 'saturation', 0); draw(); lm.sat0 = px(RED, Y); set(f, 'saturation', 100);
    set(f, 'whites', 100); draw(); lm.whites = px(GRY, Y); f.hdr = true; set(f, 'hdrWhite', 200); draw(); lm.whitesHdr = px(GRY, Y); f.hdr = false; set(f, 'whites', 0);
    // Input LUT: a LUT that inverts turns grey to 127; Creative's Custom look through the same LUT does too; Monochrome greys red
    LUTS['u:lmtest'] = { name: 'Invert test', N: 17, data: makeLut((r, g, b) => [1 - r, 1 - g, 1 - b]) };
    f.inLut = 'u:lmtest'; draw(); lm.inLut = px(GRY, Y); f.inLut = '';
    f.look = 1; f.lookLut = 'u:lmtest'; draw(); lm.lookLut = px(GRY, Y); f.look = 7; draw(); lm.mono = px(RED, Y); f.look = 0;
    const saved = JSON.parse(projectJSON()).luts || {}; lm.lutSaved = !!saved['u:lmtest'];
    // Curves: RGB Midtones 100 lifts grey to 192; the RGB curve "0,0 0.5,0.75 1,1" too; a red curve "0,0 0.5,0.25 1,1" lowers only red
    set(f, 'curveRGBMidtones', 100); draw(); lm.toneMid = px(GRY, Y); set(f, 'curveRGBMidtones', 0);
    f.rgbMaster = '0,0 0.5,0.75 1,1'; draw(); lm.rgbCurve = px(GRY, Y); f.rgbMaster = '0,0 1,1';
    f.rgbRed = '0,0 0.5,0.25 1,1'; draw(); lm.redCurve = px(GRY, Y); f.rgbRed = '0,0 1,1';
    // Hue vs Sat with reds at 0 makes red grey and leaves green; Hue vs Hue with reds at 0.6667 turns red to yellow
    f.hueVsSat = '0,0 0.2,0.5 0.8,0.5'; draw(); lm.hueSatRed = px(RED, Y); lm.hueSatGreen = px(GRN, Y); f.hueVsSat = '';
    f.hueVsHue = '0,0.6667 0.2,0.5 0.8,0.5'; draw(); lm.hueHueRed = px(RED, Y); f.hueVsHue = '';
    // Color wheels: a pink midtones wheel moves grey to (170, 107, 107)
    f.wheelMids = '#ff8080'; draw(); lm.wheel = px(GRY, Y); f.wheelMids = '#808080';
    // HSL Secondary keyed on reds (range 30°): Saturation 0 greys red, leaves green; White/Black mask shows red white, green black
    set(f, 'hueRange', 30); set(f, 'secSat', 0); draw(); lm.secRed = px(RED, Y); lm.secGreen = px(GRN, Y);
    f.showMask = true; f.maskStyle = 2; draw(); lm.maskRed = px(RED, Y); lm.maskGreen = px(GRN, Y); f.showMask = false; set(f, 'secSat', 100); set(f, 'hueRange', 180);
    // Vignette -5 blackens the corner and leaves the middle; Sharpen 100 brightens grey right beside the blue edge (and darkens the blue side), flat grey stays
    set(f, 'vigAmount', -5); draw(); lm.vigCorner = px(1915, 1075); lm.vigMid = closeTo(px(960, 270), P0(960, 270), 0); set(f, 'vigAmount', 0);
    set(f, 'sharpen', 100); draw(); lm.sharpEdge = px(1601, Y); lm.sharpBlueSide = px(1599, Y); lm.sharpFlat = px(GRY, Y); set(f, 'sharpen', 0);
    // the panel: the Show menu picks a section
    S.sel = L.id; setRightTab('fx'); refresh(); lm.basicRows = document.querySelectorAll('#inspector .fxi .frow').length;
    f.section = 2; refresh(); lm.curveGraphs = document.querySelectorAll('#inspector .fxi canvas.curvebox').length; f.curveSel = 5; refresh(); lm.hueGraph = !!$('#inspector canvas.curvebox[data-fxk=hueVsHue]'); f.section = 0; f.curveSel = 0; refresh();
    const sc = c => c.join();
    step('lumetri', Object.assign(Object.fromEntries(Object.entries(lm).map(([k, v]) => [k, Array.isArray(v) ? sc(v) : v])), {
      works: lm.zero === 0 && closeTo(lm.exposure, [64, 64, 64], 1) && closeTo(lm.warm, [160, 128, 96], 1) && closeTo(lm.sat0, [78, 78, 78], 1)
        && closeTo(lm.whites, [141, 141, 141], 1) && closeTo(lm.whitesHdr, [134, 134, 134], 1) && closeTo(lm.inLut, [127, 127, 127], 1) && closeTo(lm.lookLut, [127, 127, 127], 1)
        && closeTo(lm.mono, [78, 78, 78], 1) && lm.lutSaved && closeTo(lm.toneMid, [192, 192, 192], 1) && closeTo(lm.rgbCurve, [192, 192, 192], 1) && closeTo(lm.redCurve, [64, 128, 128], 1)
        && closeTo(lm.hueSatRed, [78, 78, 78], 1) && closeTo(lm.hueSatGreen, P0(GRN, Y), 1) && closeTo(lm.hueHueRed, [220, 220, 40], 2) && closeTo(lm.wheel, [170, 107, 107], 1)
        && closeTo(lm.secRed, [78, 78, 78], 1) && closeTo(lm.secGreen, P0(GRN, Y), 1) && sc(lm.maskRed) === '255,255,255' && sc(lm.maskGreen) === '0,0,0'
        && sc(lm.vigCorner) === '0,0,0' && lm.vigMid && lm.sharpEdge[0] > 132 && lm.sharpBlueSide[2] < 200 && closeTo(lm.sharpFlat, [128, 128, 128], 1) && lm.curveGraphs === 1 && lm.hueGraph }));
    delete LUTS['u:lmtest'];
    const r10speed = {};
    for (const [id, opts, extra] of [['basic', { exposure: .5, contrast: 30, saturation: 120 }], ['curves', {}, { rgbMaster: '0,0 0.4,0.5 1,1', hueVsSat: '0,0.7 0.5,0.5' }],
      ['secondary', { hueRange: 40, secSat: 50, denoise: 30 }], ['everything', { exposure: .3, vigAmount: -1, sharpen: 40, hueRange: 40, secSat: 50 }, { look: 2, rgbMaster: '0,0 0.4,0.5 1,1', wheelMids: '#a08070' }]]) {
      reset(); for (const k in opts) set(f, k, opts[k]); Object.assign(f, extra || {}); draw(); ctx.getImageData(0, 0, 1, 1);
      const t0 = performance.now(); for (let i = 0; i < 10; i++) draw(1.1 + i / 30); ctx.getImageData(0, 0, 1, 1); r10speed[id] = +((performance.now() - t0) / 10).toFixed(1);
    }
    step('round10speed', r10speed);

    // ---- Round 11: Keying I (EffectCraft's fx_key.wgsl, fx_color's Linear Color Key, Lumina's lumina_key.wgsl).
    // Patches at y 270: black 160, white 480, red 800, green 1120, blue 1440, grey 1760; keyed-out pixels read black
    {
      const K = { BLK: 160, WHT: 480, RED: 800, GRN: 1120, BLU: 1440, GRY: 1760, Y: 270 }, cl = (a, b, t = 1) => a.every((v, k) => Math.abs(v - b[k]) <= t), z = [0, 0, 0];
      const kerr = async (fam, e) => { const pp = FXG.pipes[fam + ':' + e]; if (pp?.pipe) return null; const m = FXG.mods[fam]; return { err: pp?.err, log: m ? (await m.getCompilationInfo()).messages.slice(0, 8).map(x => `${x.lineNum}:${x.linePos} ${x.message}`) : null }; };
      // Color Key on red (tolerance 10) removes the red patch and keeps green; Edge Feather 20 lets red back in just inside its edge
      f = await only('colorkey'); { const e = await kerr('fx_key', 'fxk_point') || await kerr('lumina_key', 'lk_mix'); if (e) step('keyKernel', e); }
      f.key = '#dc2828'; set(f, 'tolerance', 10); draw(); const ckRed = px(K.RED, K.Y), ckGreen = px(K.GRN, K.Y), ckEdge = px(645, K.Y);
      set(f, 'feather', 20); draw(); const ckFeather = px(645, K.Y); set(f, 'feather', 0);
      set(f, 'thin', -3); draw(); const ckGrow = px(642, K.Y); set(f, 'thin', 0);   // growing the kept part brings red back 3 px into the patch
      step('colorkey', { red: ckRed.join(), green: ckGreen.join(), edge: ckEdge.join(), feathered: ckFeather.join(), grown: ckGrow.join(),
        works: cl(ckRed, z) && cl(ckGreen, P0(K.GRN, K.Y)) && cl(ckEdge, z) && ckFeather[0] > 20 && ckFeather[0] < 200 && cl(ckGrow, P0(642, K.Y), 2) });
      // Luma Key: Key Out Darker at 100 removes black and the dark end of the ramp, keeps grey; Brighter at 200 removes white;
      // Similar at 128 ± 10 removes grey only
      f = await only('lumakey'); set(f, 'threshold', 100); draw(); const lkBlack = px(K.BLK, K.Y), lkGrey = px(K.GRY, K.Y), lkRampDark = px(300, 810), lkRampLight = px(1500, 810);
      f.type = 0; set(f, 'threshold', 200); draw(); const lkWhite = px(K.WHT, K.Y), lkGrey2 = px(K.GRY, K.Y);
      f.type = 2; set(f, 'threshold', 128); set(f, 'tolerance', 10); draw(); const lkSimGrey = px(K.GRY, K.Y), lkSimWhite = px(K.WHT, K.Y);
      step('lumakey', { darkerBlack: lkBlack.join(), darkerGrey: lkGrey.join(), rampDark: lkRampDark.join(), rampLight: lkRampLight.join(), brighterWhite: lkWhite.join(), brighterGrey: lkGrey2.join(), similarGrey: lkSimGrey.join(), similarWhite: lkSimWhite.join(),
        works: cl(lkBlack, z) && cl(lkGrey, P0(K.GRY, K.Y)) && cl(lkRampDark, z) && cl(lkRampLight, P0(1500, 810)) && cl(lkWhite, z) && cl(lkGrey2, P0(K.GRY, K.Y)) && cl(lkSimGrey, z) && cl(lkSimWhite, P0(K.WHT, K.Y)) });
      // Linear Color Key on the blue patch's colour: blue goes, red stays; Matte Only shows blue black and red white; Keep Colors flips it
      f = await only('linearcolorkey'); f.key = '#283cdc'; draw(); const lcBlue = px(K.BLU, K.Y), lcRed = px(K.RED, K.Y);
      f.view = 2; draw(); const lcMB = px(K.BLU, K.Y), lcMR = px(K.RED, K.Y); f.view = 0;
      f.op = 1; draw(); const lcKeepB = px(K.BLU, K.Y), lcKeepR = px(K.RED, K.Y); f.op = 0;
      f.view = 1; draw(); const lcSrc = diff(plain, frame()).max; f.view = 0;
      step('linearcolorkey', { blue: lcBlue.join(), red: lcRed.join(), matteBlue: lcMB.join(), matteRed: lcMR.join(), keepBlue: lcKeepB.join(), keepRed: lcKeepR.join(), sourceOnly: lcSrc,
        works: cl(lcBlue, z) && cl(lcRed, P0(K.RED, K.Y)) && cl(lcMB, z) && cl(lcMR, [255, 255, 255]) && cl(lcKeepB, P0(K.BLU, K.Y)) && cl(lcKeepR, z) && lcSrc === 0 });
      // Color Range in RGB: R 200-255, G and B 0-100 takes out red only
      f = await only('colorrange'); f.space = 2; set(f, 'minL', 200); set(f, 'maxL', 255); set(f, 'minA', 0); set(f, 'maxA', 100); set(f, 'minB', 0); set(f, 'maxB', 100);
      draw(); const crRed = px(K.RED, K.Y), crWhite = px(K.WHT, K.Y), crBlue = px(K.BLU, K.Y);
      set(f, 'fuzz', 60); draw(); const crWhiteFuzz = px(K.WHT, K.Y);   // white is 155 outside on G and B: still out of reach of 60
      set(f, 'maxA', 230); set(f, 'maxB', 230); draw(); const crWhitePart = px(K.WHT, K.Y);   // 25 outside, fuzziness 60: 25/60 of white kept
      step('colorrange', { red: crRed.join(), white: crWhite.join(), blue: crBlue.join(), whiteFuzz60: crWhiteFuzz.join(), whitePartly: crWhitePart.join(),
        works: cl(crRed, z) && cl(crWhite, [255, 255, 255]) && cl(crBlue, P0(K.BLU, K.Y)) && cl(crWhiteFuzz, [255, 255, 255]) && cl(crWhitePart, [106, 106, 106], 2) });
      // Extract on luminance, black point 100: black goes, white and grey stay; Invert keeps only black (which reads black either
      // way), so white goes; Black Softness 100 keeps half of a 50-luma pixel of the ramp
      f = await only('extract'); set(f, 'black', 100); draw(); const exBlack = px(K.BLK, K.Y), exWhite = px(K.WHT, K.Y), exGrey = px(K.GRY, K.Y);
      f.invert = true; draw(); const exInvWhite = px(K.WHT, K.Y); f.invert = false;
      set(f, 'blackSoft', 100); draw(); const exRamp = px(376, 810), exRampPlain = P0(376, 810);
      step('extract', { black: exBlack.join(), white: exWhite.join(), grey: exGrey.join(), invertWhite: exInvWhite.join(), ramp: exRamp.join(), rampPlain: exRampPlain.join(),
        works: cl(exBlack, z) && cl(exWhite, [255, 255, 255]) && cl(exGrey, P0(K.GRY, K.Y)) && cl(exInvWhite, z) && Math.abs(exRamp[0] - exRampPlain[0] / 2) <= 3 });
      // Difference Matte against a hidden copy of the card that only shows inside its own mask (the middle 60 %): where they
      // match (green) the layer goes, outside (grey) it stays; Matte Only shows that as black / white; no layer keys out everything
      const L2 = await load(card); L2.start = 0; L2.dur = 6; L2.visible = false; L2.mask = { on: true, shape: 'rect', invert: false };
      S.layers = [L, ...S.layers.filter(x => x !== L && x !== L2), L2];
      f = await only('differencematte'); f.layer = L2.id; draw(); const dmGreen = px(K.GRN, K.Y), dmGrey = px(K.GRY, K.Y);
      f.view = 2; draw(); const dmMG = px(K.GRN, K.Y), dmMY = px(K.GRY, K.Y); f.view = 0;
      f.layer = 0; draw(); const dmSelf = diff(frame(), new Uint8ClampedArray(plain.length)).max;
      f.layer = L2.id; set(f, 'blur', 6); draw(); const dmBlur = px(K.GRN, K.Y);
      const dmMenu = [...document.querySelectorAll(`#fx-${f.uid}-layer option`)].map(o => o.value);
      S.layers = S.layers.filter(x => x !== L2); delete RT[L2.id];
      step('differencematte', { green: dmGreen.join(), grey: dmGrey.join(), matteGreen: dmMG.join(), matteGrey: dmMY.join(), selfMax: dmSelf, blurredGreen: dmBlur.join(), menu: dmMenu,
        works: cl(dmGreen, z) && cl(dmGrey, P0(K.GRY, K.Y)) && cl(dmMG, z) && cl(dmMY, [255, 255, 255]) && dmSelf === 0 && cl(dmBlur, z) });
      // Color Difference Key on pure blue: the blue patch keeps 0.372 of itself (B − G partial) → (15, 22, 82); red stays;
      // the corrected matte view shows blue as 95; Partial A In White 75 makes partial A (0.294) full, so blue stays
      f = await only('colordifferencekey'); draw(); const cdBlue = px(K.BLU, K.Y), cdRed = px(K.RED, K.Y);
      f.view = 6; draw(); const cdMatte = px(K.BLU, K.Y); f.view = 7;
      set(f, 'pAInWhite', 75); draw(); const cdA = px(K.BLU, K.Y); set(f, 'pAInWhite', 255);
      f.view = 8; draw(); const cdFour = [px(480, 270), px(1440, 810)].map(c => c.join()); f.view = 7;
      step('colordifferencekey', { blue: cdBlue.join(), red: cdRed.join(), matteBlue: cdMatte.join(), partialAWhite75: cdA.join(), fourUp: cdFour,
        works: cl(cdBlue, [15, 22, 82], 2) && cl(cdRed, P0(K.RED, K.Y)) && cl(cdMatte, [95, 95, 95], 2) && cl(cdA, P0(K.BLU, K.Y), 2) });
      // Inner/Outer Key: the default oval keeps the middle and removes the corner; a rectangle over the white patch (x 300-660)
      // keeps red at 650; with Single Mask Highlight Radius 20 that pixel is edge, its colour matches the red outside, so it goes
      f = await only('innerouterkey'); { const e = await kerr('lumina_key', 'lk_est'); if (e) step('ioKernel', e); }
      draw(); const ioMid = px(960, 400), ioCorner = px(100, 100);
      f.fgShape = 'rect'; set(f, 'fgPosX', .25); set(f, 'fgPosY', .25); set(f, 'fgW', 18.75); set(f, 'fgH', 50); draw(); const ioRed = px(650, K.Y), ioWhite = px(K.WHT, K.Y);
      set(f, 'radius', 20); draw(); const ioRedEdge = px(650, K.Y), ioWhite2 = px(K.WHT, K.Y), ioWhiteEdge = px(630, K.Y);
      f.invert = true; draw(); const ioInv = px(K.GRN, K.Y); f.invert = false;
      set(f, 'original', 100); draw(); const ioOrig = diff(plain, frame()).max; set(f, 'original', 0);
      f.bgShape = 'rect'; S.sel = L.id; setRightTab('fx'); refresh(); const ioRows = !!$(`#inspector [data-p="${fxKey(f, 'bgW')}"]`); f.bgShape = 'none'; refresh(); const ioRowsGone = !$(`#inspector [data-p="${fxKey(f, 'bgW')}"]`);
      step('innerouterkey', { middle: ioMid.join(), corner: ioCorner.join(), redInRect: ioRed.join(), white: ioWhite.join(), redOnEdge: ioRedEdge.join(), whiteAfter: ioWhite2.join(), whiteNearEdge: ioWhiteEdge.join(),
        inverted: ioInv.join(), blendOriginal: ioOrig, outsideRows: ioRows, outsideRowsHidden: ioRowsGone,
        works: cl(ioMid, P0(960, 400)) && cl(ioCorner, z) && cl(ioRed, P0(650, K.Y)) && cl(ioWhite, [255, 255, 255]) && ioRedEdge[0] < 40 && cl(ioWhite2, [255, 255, 255]) && ioWhiteEdge[0] > 230
          && cl(ioInv, P0(K.GRN, K.Y)) && ioOrig === 0 && ioRows && ioRowsGone });
      // the Effects menu has a Keying group with all eight
      const menuKeying = [...document.querySelectorAll('#fx-add optgroup')].find(g => g.label === 'Keying');
      const menuMatte = [...document.querySelectorAll('#fx-add optgroup')].find(g => g.label === 'Matte');
      step('keyingMenu', { items: menuKeying ? [...menuKeying.children].map(o => o.value) : null, matte: menuMatte ? [...menuMatte.children].map(o => o.value) : null,
        works: menuKeying?.children.length === 15 && menuMatte?.children.length === 4 });
    }
    const r11speed = {};
    for (const [id, vals, opts] of [['colorkey', { tolerance: 20, feather: 10, thin: 1.5 }, { key: '#dc2828' }], ['lumakey', { threshold: 80, feather: 5 }], ['linearcolorkey', {}], ['colorrange', { fuzz: 40 }],
      ['extract', { black: 60, blackSoft: 40 }], ['colordifferencekey', {}], ['innerouterkey', { radius: 25, feather: 4 }], ['differencematte', { blur: 4 }]]) {
      const g = await only(id); for (const k in vals) set(g, k, vals[k]); Object.assign(g, opts || {}); draw(); ctx.getImageData(0, 0, 1, 1);
      const t0 = performance.now(); for (let i = 0; i < 10; i++) draw(1.1 + i / 30); ctx.getImageData(0, 0, 1, 1); r11speed[id] = +((performance.now() - t0) / 10).toFixed(1);
    }
    step('round11speed', r11speed);

    // ---- Round 12: Keying II + mattes. Same patches; "alpha" readings put Simple Choker's Matte view after the effect
    {
      const K = { BLK: 160, WHT: 480, RED: 800, GRN: 1120, BLU: 1440, GRY: 1760, Y: 270 }, cl = (a, b, t = 1) => a.every((v, k) => Math.abs(v - b[k]) <= t), z = [0, 0, 0], W3 = [255, 255, 255];
      const kerr = async (fam, e) => { const pp = FXG.pipes[fam + ':' + e]; if (pp?.pipe) return null; const m = FXG.mods[fam]; return { err: pp?.err, log: m ? (await m.getCompilationInfo()).messages.slice(0, 8).map(x => `${x.lineNum}:${x.linePos} ${x.message}`) : null }; };
      const matteAfter = async () => { const g = await add('simplechoker'); g.view = 1; return g; };
      // Spill Suppressor on blue, Faster: the blue patch's blue drops to its larger other channel (40, 60, 60); red stays.
      // Better: the blue patch loses the part of its colour along blue's direction from grey
      f = await only('spillsuppressor'); draw(); const ssBlue = px(K.BLU, K.Y), ssRed = px(K.RED, K.Y);
      f.accuracy = 1; draw(); const ssBetter = px(K.BLU, K.Y);
      const bc = P0(K.BLU, K.Y).map(v => v / 255), bg = (bc[0] + bc[1] + bc[2]) / 3, dir = [-1, -1, 2].map(v => v / Math.sqrt(6)), proj = bc.reduce((a, v, i) => a + (v - bg) * dir[i], 0);
      const ssWant = bc.map((v, i) => Math.round((v - proj * dir[i]) * 255));
      step('spillsuppressor', { blue: ssBlue.join(), red: ssRed.join(), better: ssBetter.join(), betterWant: ssWant.join(), works: cl(ssBlue, [40, 60, 60]) && cl(ssRed, P0(K.RED, K.Y)) && cl(ssBetter, ssWant, 2) });
      // Advanced Spill Suppressor, Standard: red has the most excess on the card, so red is the key: the red patch goes grey (40, 40, 40);
      // Ultra on green: the green patch's green drops a lot, red stays
      f = await only('advancedspill'); draw(); const asRed = px(K.RED, K.Y), asGreen = px(K.GRN, K.Y);
      f.method = 1; draw(); const asUGreen = px(K.GRN, K.Y), asURed = px(K.RED, K.Y);
      step('advancedspill', { standardRed: asRed.join(), standardGreen: asGreen.join(), ultraGreen: asUGreen.join(), ultraRed: asURed.join(),
        works: cl(asRed, [40, 40, 40]) && cl(asGreen, P0(K.GRN, K.Y)) && asUGreen[1] < 90 && cl(asURed, P0(K.RED, K.Y)) });
      // Unmult (black): grey becomes half see-through, white stays solid, black goes; with Remove Color Matting grey shows white at
      // half strength (128 over black either way), so the alpha is read through a Matte view
      f = await only('unmult'); await matteAfter(); draw(); const umGrey = px(K.GRY, K.Y), umWhite = px(K.WHT, K.Y), umBlack = px(K.BLK, K.Y);
      f.bg = 1; draw(); const umWBlack = px(K.BLK, K.Y), umWWhite = px(K.WHT, K.Y); f.bg = 0;
      step('unmult', { greyAlpha: umGrey.join(), whiteAlpha: umWhite.join(), blackAlpha: umBlack.join(), whiteBgBlack: umWBlack.join(), whiteBgWhite: umWWhite.join(),
        works: cl(umGrey, [128, 128, 128], 2) && cl(umWhite, W3) && cl(umBlack, z) && cl(umWBlack, W3) && cl(umWWhite, z) });
      // Screen Key on the green patch's colour: green goes, red and grey stay (no spill to take out); the matte view shows it
      f = await only('screenkey'); f.screen = '#28c83c'; { const e = await kerr('fx_key', 'fxk_point'); if (e) step('skKernel', e); }
      draw(); const skGreen = px(K.GRN, K.Y), skRed = px(K.RED, K.Y), skGrey = px(K.GRY, K.Y);
      f.view = 1; draw(); const skMG = px(K.GRN, K.Y), skMR = px(K.RED, K.Y); f.view = 0;
      step('screenkey', { green: skGreen.join(), red: skRed.join(), grey: skGrey.join(), matteGreen: skMG.join(), matteRed: skMR.join(),
        works: cl(skGreen, z) && cl(skRed, P0(K.RED, K.Y)) && cl(skGrey, P0(K.GRY, K.Y)) && cl(skMG, z) && cl(skMR, W3) });
      // Key Light on the same green: green goes, red stays; Status shows green black and red white; Screen Gain 0 keys nothing but still despills (green limited to 50, between red 40 and blue 60, as EffectCraft's keylight.rs)
      f = await only('keylight'); f.screen = '#28c83c'; { const e = await kerr('fx_color', 'fxc_kl_final'); if (e) step('klKernel', e); }
      draw(); const klGreen = px(K.GRN, K.Y), klRed = px(K.RED, K.Y), klWhite = px(K.WHT, K.Y);
      f.view = 8; draw(); const klSG = px(K.GRN, K.Y), klSR = px(K.RED, K.Y); f.view = 10;
      set(f, 'gain', 0); draw(); const klNone = px(K.GRN, K.Y); set(f, 'gain', 100);
      set(f, 'cropL', 50); draw(); const klCrop = px(K.RED, K.Y), klKept = px(K.GRY, K.Y); set(f, 'cropL', 0);
      f.section = 4; S.sel = L.id; setRightTab('fx'); refresh(); const klCropRows = !!$(`#inspector [data-p="${fxKey(f, 'cropL')}"]`) && !$(`#inspector [data-p="${fxKey(f, 'gain')}"]`); f.section = 0; refresh();
      step('keylight', { green: klGreen.join(), red: klRed.join(), white: klWhite.join(), statusGreen: klSG.join(), statusRed: klSR.join(), gain0: klNone.join(), cropLeftHalfRed: klCrop.join(), cropKeepsGrey: klKept.join(), sections: klCropRows,
        works: cl(klGreen, z) && cl(klRed, P0(K.RED, K.Y), 2) && cl(klWhite, W3, 2) && cl(klSG, z) && cl(klSR, W3) && cl(klNone, [40, 50, 60], 2) && cl(klCrop, z) && cl(klKept, P0(K.GRY, K.Y), 2) && klCropRows });
      // Key Cleaner after Color Range's half-kept white (alpha 25/60): Alpha Contrast 200 % pushes it to 1/3 (85)
      const cr = async () => { const g = await only('colorrange'); g.space = 2; set(g, 'minL', 200); set(g, 'maxL', 255); set(g, 'maxA', 230); set(g, 'maxB', 230); set(g, 'fuzz', 60); return g; };
      await cr(); f = await add('keycleaner'); set(f, 'contrast', 200); draw(); const kcWhite = px(K.WHT, K.Y);
      set(f, 'contrast', 100); draw(); const kcSame = px(K.WHT, K.Y);
      step('keycleaner', { white200: kcWhite.join(), white100: kcSame.join(), works: cl(kcWhite, [85, 85, 85], 2) && cl(kcSame, [106, 106, 106], 2) });
      // Simple Choker after keying out red: Choke -3 grows the kept white 3 px into the red patch (with white's colour), +3 shrinks it
      const redOut = async () => { const g = await only('colorkey'); g.key = '#dc2828'; set(g, 'tolerance', 10); return g; };
      await redOut(); f = await add('simplechoker'); set(f, 'choke', -3); draw(); const scGrow = px(642, K.Y);
      set(f, 'choke', 3); draw(); const scShrink = px(637, K.Y), scInside = px(600, K.Y);
      set(f, 'choke', 0); f.view = 1; draw(); const scMR = px(K.RED, K.Y), scMW = px(K.WHT, K.Y);
      step('simplechoker', { grown: scGrow.join(), shrunk: scShrink.join(), inside: scInside.join(), matteRed: scMR.join(), matteWhite: scMW.join(),
        works: scGrow[1] > 150 && cl(scShrink, z) && cl(scInside, W3) && cl(scMR, z) && cl(scMW, W3) });
      // Matte Choker (defaults) after keying out red: the last white pixel before the red patch goes dark, white inside stays
      await redOut(); f = await add('mattechoker'); { const e = await kerr('lumina_key', 'lk_setalpha'); if (e) step('mcKernel', e); }
      draw(); const mcEdge = px(639, K.Y), mcIn = px(600, K.Y), mcRed = px(K.RED, K.Y);
      step('mattechoker', { edge: mcEdge.join(), inside: mcIn.join(), red: mcRed.join(), works: mcEdge[0] < 60 && cl(mcIn, W3) && cl(mcRed, z) });
      // Refine Hard Matte after keying out red: inside the white and red patches nothing changes; the edge stays put;
      // Refine Soft Matte's View Edge Region tints the band red and shows solid white inside
      await redOut(); f = await add('refinehard'); { const e = await kerr('lumina_key', 'lk_refine'); if (e) step('rfKernel', e); }
      draw(); const rhW = px(K.WHT, K.Y), rhR = px(K.RED, K.Y), rhE1 = px(630, K.Y), rhE2 = px(650, K.Y);
      f.viewMap = true; draw(); const rhMap = px(K.WHT, K.Y); f.viewMap = false;
      await redOut(); f = await add('refinesoft'); draw(); const rsW = px(K.WHT, K.Y), rsR = px(K.RED, K.Y);
      f.viewEdges = true; draw(); const rsBand = px(640, K.Y), rsIn = px(K.WHT, K.Y);
      step('refinematte', { hardWhite: rhW.join(), hardRed: rhR.join(), hardNearEdgeWhite: rhE1.join(), hardNearEdgeRed: rhE2.join(), hardMapWhite: rhMap.join(), softWhite: rsW.join(), softRed: rsR.join(), softBand: rsBand.join(), softInside: rsIn.join(),
        works: cl(rhW, W3) && cl(rhR, z) && rhE1[0] > 200 && rhE2[0] < 40 && cl(rhMap, z) && cl(rsW, W3) && cl(rsR, z) && rsBand[0] > rsBand[1] + 40 && cl(rsIn, W3) });
      // CC Simple Wire Removal, Fade, along the black|white edge (x 320, y 100-440, 20 px thick): the edge becomes a ramp,
      // mid grey on the line; below the wire's end nothing changes
      f = await only('wireremoval'); set(f, 'aX', 320 / 1920); set(f, 'aY', 100 / 1080); set(f, 'bX', 320 / 1920); set(f, 'bY', 440 / 1080); set(f, 'thickness', 20); f.style = 0;
      { const e = await kerr('fx_pixel2', 'fp2_wire'); if (e) step('wrKernel', e); }
      draw(); const wrMid = px(320, K.Y), wrL = px(312, K.Y), wrR = px(328, K.Y), wrBelow = px(320, 500);
      f.style = 2; draw(); const wrDisp = px(320, K.Y);
      step('wireremoval', { onLine: wrMid.join(), left: wrL.join(), right: wrR.join(), belowEnd: wrBelow.join(), displace: wrDisp.join(),
        works: wrMid[0] > 100 && wrMid[0] < 170 && wrL[0] < wrMid[0] && wrR[0] > wrMid[0] && cl(wrBelow, P0(320, 500)) && (wrDisp[0] < 5 || wrDisp[0] > 250) });
    }
    const r12speed = {};
    for (const [id, vals, opts] of [['keylight', { rollback: 2, softness: 2 }, { screen: '#28c83c' }], ['screenkey', { softness: 3 }, { screen: '#28c83c' }], ['spillsuppressor', {}], ['advancedspill', {}],
      ['keycleaner', {}], ['unmult', {}], ['wireremoval', { thickness: 12 }], ['simplechoker', { choke: 2.5 }], ['mattechoker', {}], ['refinehard', {}], ['refinesoft', {}]]) {
      const g = await only(id); for (const k in vals) set(g, k, vals[k]); Object.assign(g, opts || {}); draw(); ctx.getImageData(0, 0, 1, 1);
      const t0 = performance.now(); for (let i = 0; i < 10; i++) draw(1.1 + i / 30); ctx.getImageData(0, 0, 1, 1); r12speed[id] = +((performance.now() - t0) / 10).toFixed(1);
    }
    step('round12speed', r12speed);

    // ---- Round 13: Blur & Sharpen II. Same patches (black|white edge at x 320, white|red at 640, grey 1600-1920; the ramp below y 540)
    {
      const K = { BLK: 160, WHT: 480, RED: 800, GRN: 1120, BLU: 1440, GRY: 1760, Y: 270 }, cl = (a, b, t = 1) => a.every((v, k) => Math.abs(v - b[k]) <= t), z = [0, 0, 0], W3 = [255, 255, 255];
      const kerr = async (fam, e) => { const pp = FXG.pipes[fam + ':' + e]; if (pp?.pipe) return null; const m = FXG.mods[fam]; return { err: pp?.err, log: m ? (await m.getCompilationInfo()).messages.slice(0, 8).map(x => `${x.lineNum}:${x.linePos} ${x.message}`) : null }; };
      const changed = () => diff(plain, frame()).changed;
      // Bilateral Blur: black and white are far apart in colour, so the edge stays sharp (a Gaussian of the same size greys it);
      // inside the white patch nothing changes; Colorize off turns red grey
      f = await only('bilateral'); { const e = await kerr('fx_noise', 'fxn_edge'); if (e) step('edgeKernel', e); }
      set(f, 'radius', 10); draw(); const blEdge = px(316, K.Y), blIn = px(K.WHT, K.Y);
      f.colorize = false; draw(); const blGrey = px(K.RED, K.Y); f.colorize = true;
      f = await only('blur'); set(f, 'blurriness', 20); draw(); const gEdge = px(316, K.Y);
      step('bilateral', { edge: blEdge.join(), gaussianEdge: gEdge.join(), inside: blIn.join(), grey: blGrey.join(),
        works: blEdge[0] < 6 && gEdge[0] > 30 && cl(blIn, W3) && blGrey[0] === blGrey[1] && blGrey[1] === blGrey[2] && blGrey[0] > 60 && blGrey[0] < 120 });
      // Smart Blur: the edge stays (black stays black beside it); Edge Only: the edge white, flat white black; Overlay: edge white, flat kept
      f = await only('smartblur'); { const e = await kerr('fx_noise', 'fxn_smart_edges'); if (e) step('smartKernel', e); }
      draw(); const sbEdge = px(318, K.Y), sbIn = px(K.WHT, K.Y);
      f.mode = 1; draw(); const sbEO = px(320, K.Y), sbEOflat = px(K.WHT, K.Y);
      f.mode = 2; draw(); const sbOV = px(640, K.Y), sbOVflat = px(K.RED, K.Y);
      step('smartblur', { edge: sbEdge.join(), inside: sbIn.join(), edgeOnly: sbEO.join(), edgeOnlyFlat: sbEOflat.join(), overlay: sbOV.join(), overlayFlat: sbOVflat.join(),
        works: cl(sbEdge, z) && cl(sbIn, W3) && cl(sbEO, W3) && cl(sbEOflat, z) && cl(sbOV, W3) && cl(sbOVflat, P0(K.RED, K.Y)) });
      // Fast Box Blur, 1 iteration, horizontal: 10 px left of the black|white edge one of 21 pixels is white (12); radius 11 gives 2 of 23
      // (22); 10.5 lands between; Vertical leaves that pixel alone
      f = await only('fastbox'); set(f, 'iterations', 1); f.dims = 1; draw(); const fb10 = px(310, K.Y);
      set(f, 'radius', 11); draw(); const fb11 = px(310, K.Y); set(f, 'radius', 10.5); draw(); const fbHalf = px(310, K.Y);
      f.dims = 2; draw(); const fbVert = px(310, K.Y);
      step('fastbox', { r10: fb10.join(), r11: fb11.join(), r10half: fbHalf.join(), vertical: fbVert.join(),
        works: cl(fb10, [12, 12, 12], 2) && cl(fb11, [22, 22, 22], 2) && fbHalf[0] > fb10[0] + 2 && fbHalf[0] < fb11[0] - 2 && cl(fbVert, z) });
      // Channel Blur: red only, so beside the black|white edge only red rises; Alpha blurriness thins the frame's edge (grey darkens
      // over black) unless Repeat edge pixels is on
      f = await only('channelblur'); { const e = await kerr('fx_noise', 'fxn_cblur_out'); if (e) step('cblurKernel', e); }
      set(f, 'red', 20); draw(); const cbEdge = px(316, K.Y), cbIn = px(K.WHT, K.Y);
      set(f, 'red', 0); set(f, 'alpha', 20); draw(); const cbA = px(1919, K.Y);
      f.repeat = true; draw(); const cbRep = px(1919, K.Y); f.repeat = false;
      step('channelblur', { edge: cbEdge.join(), inside: cbIn.join(), alphaEdge: cbA.join(), repeated: cbRep.join(),
        works: cbEdge[0] > 30 && cbEdge[1] === 0 && cbEdge[2] === 0 && cl(cbIn, W3) && cbA[0] < 110 && cl(cbRep, P0(1919, K.Y), 2) });
      // Compound Blur with no blur layer: the layer's own brightness is the map, so black stays sharp beside the edge and white blurs;
      // Invert swaps them. A hidden black ellipse as the map blurs nothing; a white one blurs where it is
      f = await only('compoundblur'); { const e = await kerr('fx_noise', 'fxn_cb_level'); if (e) step('cbKernel', e); }
      draw(); const coB = px(316, K.Y), coW = px(324, K.Y);
      f.invert = true; draw(); const coIB = px(316, K.Y), coIW = px(324, K.Y); f.invert = false;
      addShape('ellipse'); const CM = selLayer(); Object.assign(CM, { fill: '#000000', visible: false, start: 0, dur: 6 }); f.layer = CM.id;
      draw(); const coBlackMap = changed();
      CM.fill = '#ffffff'; draw(); const coWhiteMap = changed(); f.stretch = false; draw(); const coPlaced = changed(); f.stretch = true;
      S.layers = S.layers.filter(x => x !== CM); f.layer = 0; S.sel = L.id;
      step('compoundblur', { black: coB.join(), white: coW.join(), invertBlack: coIB.join(), invertWhite: coIW.join(), blackMapChanged: coBlackMap, whiteMapChanged: coWhiteMap, notStretched: coPlaced,
        works: cl(coB, z) && coW[0] < 235 && coIB[0] > 15 && cl(coIW, W3) && coBlackMap === 0 && coWhiteMap > 1000 && coPlaced > 1000 });
      // CC Cross Blur, X only: Blend averages the horizontal blur with the layer, Lighten keeps the white side white and lifts black
      f = await only('crossblur'); { const e = await kerr('fx_pixel2', 'fp2_cross'); if (e) step('crossKernel', e); }
      set(f, 'ry', 0); draw(); const crB = px(322, K.Y), crIn = px(K.WHT, K.Y);
      f.mode = 3; draw(); const crLW = px(322, K.Y), crLB = px(316, K.Y);
      step('crossblur', { blend: crB.join(), inside: crIn.join(), lightenWhite: crLW.join(), lightenBlack: crLB.join(),
        works: crB[0] > 150 && crB[0] < 250 && cl(crIn, W3) && cl(crLW, W3) && crLB[0] > 30 });
      // CC Radial Blur around the middle of the white patch: the centre stays white, the rest smears
      f = await only('ccradial'); { const e = await kerr('fx_pixel2', 'fp2_radial'); if (e) step('radialKernel', e); }
      set(f, 'centerX', K.WHT / 1920); set(f, 'centerY', K.Y / 1080); set(f, 'amount', 40); draw(); const rcC = px(K.WHT, K.Y), rcN = changed();
      f.type = 3; draw(); const rcRotC = px(K.WHT, K.Y), rcRotN = changed();
      step('ccradial', { centre: rcC.join(), changed: rcN, rotateCentre: rcRotC.join(), rotateChanged: rcRotN, works: cl(rcC, W3) && rcN > 20000 && cl(rcRotC, W3) && rcRotN > 20000 });
      // CC Radial Fast Blur, same centre: 180 px left of it (on black) the streak reaches the white: Brightest makes it white,
      // Standard grey, Darkest leaves it black
      f = await only('ccradialfast'); { const e = await kerr('fx_generate', 'gen_ccradialfast'); if (e) step('rfastKernel', e); }
      set(f, 'centerX', K.WHT / 1920); set(f, 'centerY', K.Y / 1080); draw(); const rfS = px(300, K.Y), rfC = px(K.WHT, K.Y);
      f.zoom = 1; draw(); const rfB = px(300, K.Y); f.zoom = 2; draw(); const rfD = px(300, K.Y);
      step('ccradialfast', { standard: rfS.join(), centre: rfC.join(), brightest: rfB.join(), darkest: rfD.join(),
        works: rfS[0] > 20 && rfS[0] < 230 && cl(rfC, W3) && cl(rfB, W3) && cl(rfD, z) });
      // CC Vector Blur: flat areas don't move; Natural streaks along the black|white edge (the white pixel beside it stays white),
      // Perpendicular streaks across it
      f = await only('vectorblur'); { const e = await kerr('fx_pixel2', 'fp2_vector'); if (e) step('vectorKernel', e); }
      draw(); const vbIn = px(K.WHT, K.Y), vbNat = px(321, K.Y);
      f.type = 2; draw(); const vbPerp = px(321, K.Y);
      step('vectorblur', { inside: vbIn.join(), natural: vbNat.join(), perpendicular: vbPerp.join(), works: cl(vbIn, W3) && vbNat[0] > 245 && vbPerp[0] < 240 });
      // Reduce Interlace Flicker blurs up and down only: the black|white edge stays, the grey patch's bottom edge (y 540) softens
      f = await only('reduceflicker'); set(f, 'softness', 5); draw(); const rfEdge = px(316, K.Y), rfRow = px(K.GRY, 537), rfRow0 = P0(K.GRY, 537);
      step('reduceflicker', { edge: rfEdge.join(), row: rfRow.join(), plainRow: rfRow0.join(), works: cl(rfEdge, z) && Math.abs(rfRow[0] - rfRow0[0]) > 5 });
      const menuBlur = [...document.querySelectorAll('#fx-add optgroup')].find(g => g.label === 'Blur & Sharpen'), menuOld = [...document.querySelectorAll('#fx-add optgroup')].find(g => g.label === 'Obsolete');
      step('blurMenu', { items: menuBlur ? [...menuBlur.children].map(o => o.value) : null, obsolete: menuOld ? [...menuOld.children].map(o => o.value) : null,
        works: menuBlur?.children.length === 15 && menuOld?.children.length === 1 });
    }
    const r13speed = {};
    for (const [id, vals, opts] of [['bilateral', {}], ['smartblur', {}], ['fastbox', {}], ['channelblur', { red: 10, alpha: 4 }], ['compoundblur', {}], ['crossblur', {}],
      ['ccradial', {}], ['ccradialfast', {}], ['vectorblur', {}], ['reduceflicker', {}]]) {
      const g = await only(id); for (const k in vals) set(g, k, vals[k]); Object.assign(g, opts || {}); draw(); ctx.getImageData(0, 0, 1, 1);
      const t0 = performance.now(); for (let i = 0; i < 10; i++) draw(1.1 + i / 30); ctx.getImageData(0, 0, 1, 1); r13speed[id] = +((performance.now() - t0) / 10).toFixed(1);
    }
    step('round13speed', r13speed);

    // ---- C4: anime VFX (Lumina's own shaders). Patches: black 0-320, white 320-640, red 640-960 at y 270
    f = await only('rgbsplit');
    if (!FXG.pipes['lumina_vfx:lvx_rgbsplit']?.pipe) { const m = FXG.mods.lumina_vfx; step('lvxKernel', { err: FXG.pipes['lumina_vfx:lvx_rgbsplit']?.err, log: m ? (await m.getCompilationInfo()).messages.slice(0, 8).map(x => `${x.lineNum}:${x.linePos} ${x.message}`) : null }); }
    // RGB Split, 12 px sideways: just right of black|white, red comes from the black side; just left of white|red, blue comes from red
    set(f, 'amount', 0); draw(); const rsZero = diff(plain, frame()).max;
    set(f, 'amount', 12); draw(); const rsA = px(330, 270), rsB = px(630, 270), rsFlat = px(480, 270);
    f.mode = 1; draw(); const rsRad = px(324, 270); f.mode = 0;
    // fired by a bookmark at 1 s, fading over 0.3 s: full at 1.0, a quarter (3 px, too small to reach 330) at 1.15, gone by 1.4
    f.trigger = 10; S.bookmarks = [{ id: 99901, t: 1, note: '', color: '#ffffff', dur: 0 }];
    draw(1); const trAt = px(330, 270); draw(1.15); const trMid = px(330, 270), trMidGain = +vfxGain({ T: 1.15 }, k => k === 'trigger' ? 10 : .3).toFixed(4); draw(1.4); const trGone = diff(plain, frame()).max;
    S.bookmarks = []; f.trigger = 0;
    step('rgbsplit', { zero: rsZero, rightOfBlackEdge: rsA.join(), leftOfRedEdge: rsB.join(), flatWhite: rsFlat.join(), radial: rsRad.join(), trigger: { at1: trAt.join(), at115: trMid.join(), gainAt115: trMidGain, at14max: trGone },
      works: rsZero === 0 && closeTo(rsA, [0, 255, 255], 2) && closeTo(rsB, [255, 255, 40], 2) && rsFlat.join() === '255,255,255' && rsRad[2] < 40
        && closeTo(trAt, [0, 255, 255], 2) && trMid.join() === '255,255,255' && Math.abs(trMidGain - .25) < .001 && trGone === 0 });

    // Edge Glow: far from any edge black stays black; beside the black|white edge, the black side lights up; Glow only shows just edges
    f = await only('edgeglow'); draw(); const egFar = px(100, 270), egNear = lum(px(312, 270)), egPlainNear = lum(P0(312, 270));
    f.mix = 2; draw(); const egOnlyFlat = px(480, 120), egOnlyEdge = lum(px(320, 120)); f.mix = 0;
    step('edgeglow', { farBlack: egFar.join(), nearEdge: Math.round(egNear), plainNearEdge: Math.round(egPlainNear), glowOnlyFlat: egOnlyFlat.join(), glowOnlyEdge: Math.round(egOnlyEdge),
      works: closeTo(egFar, [0, 0, 0], 3) && egNear > egPlainNear + 40 && closeTo(egOnlyFlat, [0, 0, 0], 3) && egOnlyEdge > 60 });

    // Flash (Always on): screen white turns black white and keeps white white; 50% makes black mid grey; Fill with red paints red
    f = await only('flash'); f.trigger = 0; draw(); const flBlack = px(160, 270).join(), flWhite = px(480, 270).join();
    set(f, 'amount', 50); draw(); const flHalf = px(160, 270)[0];
    set(f, 'amount', 100); f.color = '#ff0000'; f.mode = 2; draw(); const flFill = px(480, 270).join();
    f.trigger = 1; draw(); const flNoBeats = diff(plain, frame()).max;   // on beats, with no beats anywhere: nothing
    step('flash', { black: flBlack, white: flWhite, half: flHalf, fillRed: flFill, onBeatsWithNoBeats: flNoBeats,
      works: flBlack === '255,255,255' && flWhite === '255,255,255' && Math.abs(flHalf - 128) <= 2 && flFill === '255,0,0' && flNoBeats === 0 });

    // VHS Glitch: strength 0 changes nothing; on, much of the frame changes, and it moves from frame to frame
    f = await only('vhs'); set(f, 'strength', 0); draw(); const vhZero = diff(plain, frame()).max;
    set(f, 'strength', 100); draw(1); const vh1 = frame(); draw(1.2); const vh2 = frame();
    // scanlines darken every few rows of flat white
    let scanDark = 0; for (let y = 400; y < 460; y++) if (px(480, y)[1] < 235) scanDark++;
    step('vhs', { zero: vhZero, changed: diff(plain, vh1).changed, moves: diff(vh1, vh2).changed, darkRowsOf60: scanDark,
      works: vhZero === 0 && diff(plain, vh1).changed > 200000 && diff(vh1, vh2).changed > 20000 && scanDark >= 10 && scanDark <= 55 });

    // Camera Shake (Always on): amount and rotation 0 change nothing; on, the picture moves differently at different moments
    f = await only('shake'); f.trigger = 0; set(f, 'amount', 0); set(f, 'rotation', 0); draw(); const shZero = diff(plain, frame()).max;
    set(f, 'amount', 25); set(f, 'rotation', 2); draw(1); const sh1 = frame(); draw(1.13); const sh2 = frame();
    // where the black|white edge is on row 270: it moves by up to the shake amount, plus the zoom that hides the frame edges
    // (about 7% here, which alone pushes an edge 640 px from the centre out by ~45 px)
    const edgeX = fr => { for (let x = 200; x < 480; x++) { const i = (270 * 1920 + x) * 4; if (fr[i + 1] > 128) return x; } return -1; };
    step('shake', { zero: shZero, edgeAt: [edgeX(plain), edgeX(sh1), edgeX(sh2)], moves: diff(sh1, sh2).changed,
      works: shZero === 0 && edgeX(sh1) !== edgeX(sh2) && Math.abs(edgeX(sh1) - 320) < 80 && Math.abs(edgeX(sh2) - 320) < 80 && diff(sh1, sh2).changed > 10000 });

    const c4speed = {};
    for (const [id, vals, opts] of [['rgbsplit', { amount: 20 }, { trigger: 0 }], ['edgeglow', {}, { trigger: 0 }], ['flash', { amount: 60 }, { trigger: 0 }], ['vhs', {}, { trigger: 0 }], ['shake', {}, { trigger: 0 }]]) {
      const g = await only(id); for (const k in vals) set(g, k, vals[k]); Object.assign(g, opts); draw(); ctx.getImageData(0, 0, 1, 1);
      const t0 = performance.now(); for (let i = 0; i < 10; i++) draw(1.1 + i / 30); ctx.getImageData(0, 0, 1, 1); c4speed[id] = +((performance.now() - t0) / 10).toFixed(1);
    }
    step('c4speed', c4speed);

    // a stack: order matters, and switching one off skips it
    while (L.fx?.length) delFX(L, 0);
    const a = await add('twirl'), b = await add('blur'); set(a, 'angle', 270); set(b, 'blurriness', 20);
    draw(); const ab = frame(); [L.fx[0], L.fx[1]] = [L.fx[1], L.fx[0]]; draw(); const ba = frame(); [L.fx[0], L.fx[1]] = [L.fx[1], L.fx[0]];
    b.on = false; draw(); const aOnly = frame(); b.on = true;
    while (L.fx.length > 1) delFX(L, 1); draw(); const twirlAlone = frame();
    const orderMatters = diff(ab, ba).changed, offSkips = diff(aOnly, twirlAlone).max;
    // inspector buttons: move down, remove
    await add('glow'); S.sel = L.id; refresh(); $('#inspector [data-act=fxdn][data-fx="0"]').click(); const afterMove = L.fx.map(x => x.id);
    $('#inspector [data-act=fxdel][data-fx="1"]').click(); const afterDel = L.fx.map(x => x.id);
    step('stack', { orderMatters, offSkips, afterMove, afterDel, propsCleaned: !Object.keys(L.p).some(k => k.startsWith(`fx${a.uid}_`)) });

    // speed: blur + glow + light rays on a 1080p frame
    while (L.fx?.length) delFX(L, 0);
    for (const id of ['blur', 'glow', 'rays']) await add(id);
    draw(); await new Promise(r => setTimeout(r, 50));
    const t0 = performance.now(); for (let i = 0; i < 30; i++) { draw(1 + i / 30); } ctx.getImageData(0, 0, 1, 1); const ms = (performance.now() - t0) / 30;
    step('speed', { msPerFrame: +ms.toFixed(1), fps: Math.round(1000 / ms) });

    // saved and reopened: the same picture
    L.keys[fxKey(L.fx[0], 'blurriness')] = [{ t: 0, v: 5, ease: 'smooth' }, { t: 3, v: 30, ease: 'smooth' }];
    draw(2); const pre = frame();
    PROJ.path = dir + 'fx.lumina'; await saveProject();
    S.layers = []; for (const k in RT) delete RT[k]; refresh();
    await openProject(dir + 'fx.lumina'); await fxWarmAll();
    draw(2); const post = frame();
    const L2 = S.layers[0];
    step('reopened', { fx: (L2.fx || []).map(x => x.id), keyed: !!L2.keys[fxKey(L2.fx[0], 'blurriness')], same: diff(pre, post) });
    // undo brings a removed effect back
    S.sel = L2.id; refresh(); $('#inspector [data-act=fxdel][data-fx="0"]').click(); const n1 = L2.fx.length; undo(); const n2 = selLayer()?.fx?.length ?? byId(L2.id)?.fx?.length;
    step('undo', { afterDelete: n1, afterUndo: n2 });

    // picture: each effect on the card
    const shots = [['none'], ['brightness', { contrast: 60, brightness: 10 }], ['blur', { blurriness: 30 }], ['glow', { radius: 60, threshold: 40, intensity: 1.5 }], ['twirl', { angle: 300, radius: 45 }], ['noise', {}], ['rays', { intensity: 250, radius: 80 }],
      ['directional', { length: 120, direction: 90 }], ['radial', { amount: 40 }], ['lens', { radius: 25, hlBright: 80, hlThr: 200 }], ['unsharp', { amount: 300, radius: 4 }],
      ['bulge', { height: 1.5, hradius: 400, vradius: 400 }], ['wave', { height: 25, width: 80 }], ['ripple', { radius: 80, waveHeight: 30 }], ['cclens', {}], ['turbulent', { amount: 120 }], ['mosaic', {}],
      ['findedges', {}], ['emboss', { relief: 3 }], ['posterize', { level: 4 }], ['threshold', {}], ['vignette', { amount: 100 }], ['motiontile', { tw: 50, th: 50 }],
      ['gradientramp', { blend: 40 }], ['fourcolor', {}], ['grid', {}],
      ['huesat', { hue: 150, saturation: 40 }], ['levels', { inBlack: 40, inWhite: 200, gamma: 1.4 }], ['curves', { rgb64: 40, rgb192: 220, b64: 100, r192: 230 }], ['tint', {}],
      ['vibrance', { vibrance: 100 }], ['colorbalance', { shadowBlue: 60, hiRed: 40 }], ['blackwhite', {}], ['tritone', {}], ['colorama', {}], ['channelmixer', { rr: 0, rb: 100, bb: 0, br: 100 }], ['selectivecolor', { redsCyan: 100, greensYellow: -100 }],
      ['exposure', { masterExposure: 1 }], ['photofilter', { density: 60 }], ['shadowhighlight', {}, { auto: false }], ['changecolor', { hue: 120 }], ['changetocolor', {}], ['leavecolor', { amount: 100 }, { match: 1 }],
      ['colorbalancehls', { hue: 90 }], ['gammapedestalgain', { redGain: .5, bluePedestal: .2 }], ['cctoner', {}], ['cccoloroffset', { redPhase: 90, bluePhase: 200 }],
      ['autocolor', {}], ['equalize', {}], ['broadcast', { maxSignal: 90 }, { how: 2 }], ['videolimiter', {}, { clipLevel: 0, warn: true }], ['psarbitrarymap', { phase: 100 }],
      ['levelsic', { redGamma: 2, blueInWhite: 180 }], ['cccolorneutralizer', {}, { midsUn: '#998066' }], ['cckernel', { k1: -1, k2: -1, k3: -1, k4: -1, k5: 8, k6: -1, k7: -1, k8: -1, k9: -1 }, { absolute: true }],
      ['colorlink', { opacity: 50 }, { mode: 2 }],
      ['lumetri', { exposure: .3, contrast: 25, vigAmount: -2 }, { look: 5, rgbMaster: '0,0 0.3,0.22 0.7,0.8 1,1', wheelHighs: '#ffe0c0', wheelShadows: '#6080a0' }],
      ['colorkey', { tolerance: 30, feather: 6 }, { key: '#dc2828' }], ['lumakey', { threshold: 100 }], ['linearcolorkey', { tolerance: 25 }, { key: '#283cdc' }], ['colorrange', { maxL: 200 }],
      ['extract', { black: 100, blackSoft: 60 }], ['colordifferencekey', {}], ['innerouterkey', { radius: 30, feather: 6 }],
      ['keylight', { softness: 2 }, { screen: '#28c83c' }], ['screenkey', {}, { screen: '#dc2828' }], ['spillsuppressor', {}, { accuracy: 1 }], ['advancedspill', {}], ['unmult', {}],
      ['wireremoval', { thickness: 40, aX: .1, aY: .1, bX: .9, bY: .4 }], ['simplechoker', { choke: 20 }, { view: 1 }],
      ['rgbsplit', { amount: 30 }, { trigger: 0 }], ['edgeglow', { radius: 20 }, { trigger: 0 }], ['flash', { amount: 55 }, { trigger: 0, color: '#9fdcff' }], ['vhs', {}, { trigger: 0 }], ['shake', { amount: 40, rotation: 4 }, { trigger: 0 }]];
    const T = S.layers[0];
    const strip = document.createElement('canvas'); strip.width = 4 * 480; strip.height = Math.ceil(shots.length / 4) * 270; const sx = strip.getContext('2d');
    for (let i = 0; i < shots.length; i++) {
      while (T.fx?.length) delFX(T, 0);
      const [id, vals, opts] = shots[i];
      if (id !== 'none') { const g = addFX(T, id); await fxWarm(id); for (const k in vals) T.p[fxKey(g, k)] = vals[k]; Object.assign(g, opts || {}); }
      draw(1); sx.drawImage(canvas, (i % 4) * 480, Math.floor(i / 4) * 270, 480, 270);
      sx.fillStyle = '#ff0'; sx.font = '20px sans-serif'; sx.fillText(id === 'none' ? 'Original' : FX[id].name, (i % 4) * 480 + 10, Math.floor(i / 4) * 270 + 28);
    }
    await lumina.saveExport(await new Promise(r => strip.toBlob(b => b.arrayBuffer().then(r))), 'x.png', 'D:\\Lumina\\.claude\\fx\\effects.png');
    while (T.fx?.length) delFX(T, 0); const g = addFX(T, 'glow'); await fxWarm('glow'); T.p[fxKey(g, 'radius')] = 40;
    $('#modal').hidden = true; S.sel = T.id; refresh(); draw(1);
    R.errors = __errs;
  } catch (e) { R.error = String(e && e.stack || e); R.errors = window.__errs; }
  return R;
})()
