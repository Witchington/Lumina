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

    // ---- Round 14: Distort I. Same patches (black 0-320, white -640, red -960, green -1280, blue -1600, grey -1920 above y 540)
    {
      const K = { BLK: 160, WHT: 480, RED: 800, GRN: 1120, BLU: 1440, GRY: 1760, Y: 270 }, cl = (a, b, t = 2) => a.every((v, k) => Math.abs(v - b[k]) <= t), z = [0, 0, 0], W3 = [255, 255, 255];
      const kerr = async (fam, e) => { const pp = FXG.pipes[fam + ':' + e]; if (pp?.pipe) return null; const m = FXG.mods[fam]; return { err: pp?.err, log: m ? (await m.getCompilationInfo()).messages.slice(0, 8).map(x => `${x.lineNum}:${x.linePos} ${x.message}`) : null }; };
      const BLUE = P0(K.BLU, K.Y), RED = P0(K.RED, K.Y), GREEN = P0(K.GRN, K.Y), GREY = P0(K.GRY, K.Y);
      const at = (g, id, x, y) => { set(g, id + 'X', x / 1920); set(g, id + 'Y', y / 1080); };
      // Spherize round the middle of the white patch, radius 200: 180 px out (on black) it shows white from nearer the middle;
      // outside the radius nothing moves
      f = await only('spherize'); { const e = await kerr('fx_stylize', 'fxs_warp'); if (e) step('warpKernel', e); }
      at(f, 'center', K.WHT, K.Y); draw(); const spIn = px(300, K.Y), spOut = px(250, K.Y), spC = px(K.WHT, K.Y);
      step('spherize', { inside: spIn.join(), outside: spOut.join(), centre: spC.join(), works: cl(spIn, W3) && cl(spOut, z) && cl(spC, W3) });
      // Polar Coordinates, Rect to polar: the top row is the frame's outer ring (x 240 looks up-right of the middle: blue);
      // Polar to rect after it undoes it (blue comes back at the blue patch)
      f = await only('polar'); draw(); const poTop = px(240, 1);
      f.conversion = 0; const g = await add('polar'); g.conversion = 1; draw(); const poBack = px(K.BLU, K.Y);
      step('polar', { topRow: poTop.join(), roundTrip: poBack.join(), works: cl(poTop, BLUE, 3) && cl(poBack, BLUE, 3) });
      // Mirror at the middle, angle 0: the right half shows the left (blue → white); 180°: the left shows the right
      f = await only('mirror'); draw(); const miR = px(K.BLU, K.Y), miL = px(K.WHT, K.Y);
      set(f, 'angle', 180); draw(); const miFlip = px(K.WHT, K.Y);
      step('mirror', { right: miR.join(), left: miL.join(), flipped: miFlip.join(), works: cl(miR, W3) && cl(miL, W3) && cl(miFlip, BLUE) });
      // Offset, centre shifted to 75%: everything moves 480 px right and wraps (black's place shows grey); blend 50% halves it
      f = await only('offset'); { const e = await kerr('fx_stylize', 'fxs_table'); if (e) step('tableKernel', e); }
      set(f, 'shiftX', .75); draw(); const ofA = px(960, K.Y), ofWrap = px(K.BLK, K.Y);
      set(f, 'blend', 50); draw(); const ofHalf = px(K.BLK, K.Y);
      step('offset', { moved: ofA.join(), wrapped: ofWrap.join(), blend50: ofHalf.join(), works: cl(ofA, W3) && cl(ofWrap, GREY) && cl(ofHalf, GREY.map(v => v / 2), 2) });
      // Magnify ×2 round the white patch's middle, size 200: a black pixel 180 px out shows white from 90 px out; with None
      // only the magnified circle is left
      f = await only('magnify'); { const e = await kerr('fx_stylize', 'fxs_magnify'); if (e) step('magnifyKernel', e); }
      at(f, 'center', K.WHT, K.Y); set(f, 'size', 200); draw(); const mgIn = px(300, K.Y), mgOut = px(K.BLU, K.Y);
      f.mode = 0; draw(); const mgNone = px(K.BLU, K.Y), mgNoneIn = px(300, K.Y);
      step('magnify', { inside: mgIn.join(), outside: mgOut.join(), noneOutside: mgNone.join(), noneInside: mgNoneIn.join(), works: cl(mgIn, W3) && cl(mgOut, BLUE) && cl(mgNone, z) && cl(mgNoneIn, W3) });
      // Corner Pin: the right corners pulled to the middle squeezes the layer into the left half (240 shows white from 480;
      // the right half is empty)
      f = await only('cornerpin'); { const e = await kerr('kernels', 'warp_blend'); if (e) step('warpBlendKernel', e); }
      draw(); const cpSame = diff(plain, frame()).max;
      set(f, 'urX', .5); set(f, 'lrX', .5); draw(); const cpL = px(240, K.Y), cpR = px(K.BLU, K.Y);
      set(f, 'urY', .25); draw(); const cpPersp = px(940, 100);
      step('cornerpin', { unchanged: cpSame, squeezedLeft: cpL.join(), emptyRight: cpR.join(), perspectiveCorner: cpPersp.join(), works: cpSame <= 2 && cl(cpL, W3) && cl(cpR, z) && cl(cpPersp, z) });
      // Transform: 50% shows the whole card in the middle quarter (720,270 is the white patch's top left part); 180° puts the
      // white patch where the ramp was; position 75% moves green to 1440; 50% opacity; Shutter angle 180 without motion stays sharp
      f = await only('transform'); draw(); const trSame = diff(plain, frame()).max;
      set(f, 'scaleH', 50); draw(); const trHalf = px(720, K.Y), trOut = px(100, 100);
      set(f, 'scaleH', 100); set(f, 'rotation', 180); draw(); const trRot = px(K.BLU, 810);
      set(f, 'rotation', 0); set(f, 'positionX', .75); draw(); const trPos = px(K.BLU, K.Y); set(f, 'positionX', .5);
      set(f, 'opacity', 50); draw(); const trOp = px(K.WHT, K.Y); set(f, 'opacity', 100);
      f.compShutter = false; set(f, 'shutter', 180); draw(); const trBlur = diff(plain, frame()).max;
      step('transform', { unchanged: trSame, half: trHalf.join(), outside: trOut.join(), rotated: trRot.join(), moved: trPos.join(), opacity50: trOp.join(), shutterStill: trBlur,
        works: trSame <= 2 && cl(trHalf, W3) && cl(trOut, z) && cl(trRot, W3) && cl(trPos, GREEN) && cl(trOp, [128, 128, 128], 2) && trBlur <= 3 });
      // Optics Compensation, 60° wide: the middle is pulled out, so red reaches 630 (just left of the white|red edge);
      // reversed it pushes in, so white reaches 650
      f = await only('opticscomp'); set(f, 'fov', 60); draw(); const ocA = px(630, K.Y), ocC = px(K.WHT, K.Y);
      f.reverse = true; draw(); const ocR = px(650, K.Y);
      step('opticscomp', { forward630: ocA.join(), white: ocC.join(), reverse650: ocR.join(), works: cl(ocA, RED) && cl(ocC, W3) && cl(ocR, W3) });
      const menuD = [...document.querySelectorAll('#fx-add optgroup')].find(g => g.label === 'Distort');
      step('distortMenu', { items: menuD ? [...menuD.children].map(o => o.value) : null, works: ['spherize', 'polar', 'mirror', 'offset', 'magnify', 'cornerpin', 'transform', 'opticscomp'].every(id => [...(menuD?.children || [])].some(o => o.value === id)) });
    }
    const r14speed = {};
    for (const [id, vals, opts] of [['spherize', {}], ['polar', {}], ['mirror', {}], ['offset', { shiftX: .7 }], ['magnify', {}], ['cornerpin', { urX: .8, lrY: .9 }],
      ['transform', { rotation: 30, scaleH: 80 }], ['opticscomp', { fov: 60 }]]) {
      const g = await only(id); for (const k in vals) set(g, k, vals[k]); Object.assign(g, opts || {}); draw(); ctx.getImageData(0, 0, 1, 1);
      const t0 = performance.now(); for (let i = 0; i < 10; i++) draw(1.1 + i / 30); ctx.getImageData(0, 0, 1, 1); r14speed[id] = +((performance.now() - t0) / 10).toFixed(1);
    }
    step('round14speed', r14speed);

    // ---- Round 15: Distort II (CC). Same patches; "changed" counts pixels that moved more than 4 levels
    {
      const K = { BLK: 160, WHT: 480, RED: 800, GRN: 1120, BLU: 1440, GRY: 1760, Y: 270 }, cl = (a, b, t = 2) => a.every((v, k) => Math.abs(v - b[k]) <= t), z = [0, 0, 0], W3 = [255, 255, 255];
      const kerr = async (fam, e) => { const pp = FXG.pipes[fam + ':' + e]; if (pp?.pipe) return null; const m = FXG.mods[fam]; return { err: pp?.err, log: m ? (await m.getCompilationInfo()).messages.slice(0, 8).map(x => `${x.lineNum}:${x.linePos} ${x.message}`) : null }; };
      const changed = () => diff(plain, frame()).changed, same = () => diff(plain, frame()).max, BLUE = P0(K.BLU, K.Y);
      // each one: moves a lot with its defaults, and nothing with its "off" setting
      const R = {};
      for (const [id, fam, entry, off] of [['ccbendit', 'fx_warp', 'fxw_bendit', { bend: 0 }], ['ccbender', 'fx_transition', 'ftr_bender', { amount: 0 }], ['ccflomotion', 'fx_stylize', 'fxs_flomotion', { amount1: 0, amount2: 0 }],
        ['ccgriddler', 'fx_stylize', 'fxs_griddler', { rotation: 0 }], ['ccslant', 'fx_stylize', 'fxs_warp', { slant: 0 }], ['ccsmear', 'fx_stylize', 'fxs_warp', { reach: 0 }], ['ccsplit', 'fx_stylize', 'fxs_warp', { split: 0 }],
        ['ccsplit2', 'fx_stylize', 'fxs_warp', { split1: 0, split2: 0 }], ['cctiler', 'fx_stylize', 'fxs_table', { scale: 100 }], ['ccripplepulse', 'fx_stylize', 'fxs_warp', { level: 0 }]]) {
        f = await only(id); { const e = await kerr(fam, entry); if (e) step(id + 'Kernel', e); }
        draw(.3); const on = changed(); for (const k in off) set(f, k, off[k]); draw(.3); R[id] = { changed: on, offMax: same() };
      }
      step('ccMoves', { ...R, works: Object.values(R).every(r => r.changed > 1000 && r.offMax <= 2) });
      // CC Bend It: above Start (prestart Static) nothing moves
      f = await only('ccbendit'); draw(); const biAbove = px(K.WHT, 100);
      // CC Griddler: a tile's middle stays (tiles of 192 px from the corner); Cut Tiles (no turn) leaves gaps at the tile edges
      f = await only('ccgriddler'); draw(); const grMid = px(K.WHT, 288); set(f, 'rotation', 0); f.cut = true; draw(); const grGap = px(384, 288), grMid2 = px(K.WHT, 288);
      // CC Slant 20 from the bottom: at y 270 everything leans 162 px right (480 shows black from 318, 800 white from 638)
      f = await only('ccslant'); draw(); const slA = px(K.WHT, K.Y), slB = px(K.RED, K.Y), slFloor = px(K.WHT, 1078);
      // CC Tiler at 50%: the whole card twice across (720 shows white, 1200 blue)
      f = await only('cctiler'); draw(); const tiW = px(720, K.Y), tiB = px(1200, K.Y);
      // CC Split along the middle line: a gap opens at its centre; the top corner stays
      f = await only('ccsplit'); draw(); const spGap = px(960, 540), spFar = px(K.BLK, 100);
      // CC Power Pin: the defaults change nothing; the right corners at the middle squeeze the layer into the left half
      f = await only('ccpowerpin'); draw(); const ppSame = same(); set(f, 'trX', .5); set(f, 'brX', .5); draw(); const ppL = px(240, K.Y), ppR = px(K.BLU, K.Y);
      set(f, 'perspective', 0); set(f, 'trY', .2); draw(); const ppBil = changed();
      // CC Page Turn: the top left of the page is untouched, and the turned corner shows something else
      f = await only('ccpageturn'); draw(); const ptTL = px(K.WHT, K.Y), ptN = changed();
      // CC Blobbylize (Red): white stays bright, green (little red) falls under the cut-away and goes
      f = await only('ccblobbylize'); { const e = await kerr('fx_transition', 'ftr_blob'); if (e) step('blobKernel', e); }
      draw(); const blW = px(K.WHT, K.Y), blG = px(K.GRN, K.Y);
      step('ccDetails', { bendAbove: biAbove.join(), griddlerMiddle: grMid.join(), griddlerGap: grGap.join(), griddlerMiddleCut: grMid2.join(), slant480: slA.join(), slant800: slB.join(), slantFloor: slFloor.join(),
        tiler720: tiW.join(), tiler1200: tiB.join(), splitGap: spGap.join(), splitFar: spFar.join(), powerPinSame: ppSame, powerPinLeft: ppL.join(), powerPinRight: ppR.join(), powerPinBilinear: ppBil,
        pageTopLeft: ptTL.join(), pageChanged: ptN, blobWhite: blW.join(), blobGreen: blG.join(),
        works: cl(biAbove, W3) && cl(grMid, W3) && cl(grGap, z) && cl(grMid2, W3) && cl(slA, z) && cl(slB, W3) && cl(slFloor, P0(K.WHT, 1078)) && cl(tiW, W3) && cl(tiB, BLUE, 3)
          && cl(spGap, z) && cl(spFar, P0(K.BLK, 100)) && ppSame <= 2 && cl(ppL, W3) && cl(ppR, z) && ppBil > 1000 && cl(ptTL, W3) && ptN > 20000 && lum(blW) > 100 && blG[0] + blG[1] + blG[2] < 60 });
      const menuD = [...document.querySelectorAll('#fx-add optgroup')].find(g => g.label === 'Distort');
      step('distortMenu15', { count: menuD?.children.length, works: menuD?.children.length >= 28 });
    }
    const r15speed = {};
    for (const id of ['ccbendit', 'ccbender', 'ccblobbylize', 'ccflomotion', 'ccgriddler', 'ccpageturn', 'ccripplepulse', 'ccslant', 'ccsmear', 'ccsplit', 'ccsplit2', 'cctiler', 'ccpowerpin']) {
      await only(id); draw(); ctx.getImageData(0, 0, 1, 1);
      const t0 = performance.now(); for (let i = 0; i < 10; i++) draw(1.1 + i / 30); ctx.getImageData(0, 0, 1, 1); r15speed[id] = +((performance.now() - t0) / 10).toFixed(1);
    }
    step('round15speed', r15speed);

    // ---- Round 16: Distort III (warps). Same patches
    {
      const K = { BLK: 160, WHT: 480, RED: 800, GRN: 1120, BLU: 1440, GRY: 1760, Y: 270 }, cl = (a, b, t = 2) => a.every((v, k) => Math.abs(v - b[k]) <= t), z = [0, 0, 0], W3 = [255, 255, 255];
      const kerr = async (fam, e) => { const pp = FXG.pipes[fam + ':' + e]; if (pp?.pipe) return null; const m = FXG.mods[fam]; return { err: pp?.err, log: m ? (await m.getCompilationInfo()).messages.slice(0, 8).map(x => `${x.lineNum}:${x.linePos} ${x.message}`) : null }; };
      const changed = () => diff(plain, frame()).changed, same = () => diff(plain, frame()).max, RED = P0(K.RED, K.Y);
      const R = {};
      for (const [id, fam, entry, off] of [['warp', 'fx_warp', 'fxw_warp', { bend: 0 }], ['displacement', 'fx_distort', 'dst_displace', { maxH: 0, maxV: 0 }], ['twirllegacy', 'fx_stylize', 'fxs_warp', { angle: 0 }],
        ['upscale', 'kernels', 'warp_blend', { scale: 100 }]]) {
        f = await only(id); { const e = await kerr(fam, entry); if (e) step(id + 'Kernel', e); }
        draw(); const on = changed(); for (const k in off) set(f, k, off[k]); draw(); R[id] = { changed: on, offMax: same() };
      }
      step('warpMoves', { ...R, works: Object.values(R).every(r => r.changed > 1000 && r.offMax <= 2) });
      // Bezier Warp: the defaults change nothing; the right edge (vertices and tangents) at the middle, with straight top and
      // bottom edges, squeezes the layer into the left half
      f = await only('bezierwarp'); { const e = await kerr('fx_distort', 'dst_mesh'); if (e) step('meshKernel', e); }
      draw(); const bzSame = same();
      for (const k of ['rtV', 'rtT', 'rbT', 'brV']) set(f, k + 'X', .5);
      for (const [k, v] of [['tlT', 1 / 6], ['trT', 1 / 3], ['blT', 1 / 6], ['brT', 1 / 3]]) set(f, k + 'X', v);
      draw(); const bzL = px(240, K.Y), bzR = px(K.BLU, K.Y);
      // Mesh Warp, one cell: the two right corners moved 960 px left does the same
      f = await only('meshwarp'); set(f, 'rows', 1); set(f, 'columns', 1); draw(); const mwFlat = same();
      f.mesh = '0,0 -960,0 0,0 -960,0'; draw(); const mwL = px(240, K.Y), mwR = px(K.BLU, K.Y);
      // Displacement Map with a hidden white ellipse as the map: white means the full push, so the card moves
      f = await only('displacement'); addShape('ellipse'); const DM = selLayer(); Object.assign(DM, { fill: '#ffffff', visible: false, start: 0, dur: 6 }); f.layer = DM.id; set(f, 'maxH', 40);
      draw(); const dmLayer = changed(); S.layers = S.layers.filter(x => x !== DM); f.layer = 0; S.sel = L.id;
      // Detail-preserving Upscale 200% (no extra detail): 720,270 shows what was at 840,405 (red)
      f = await only('upscale'); set(f, 'detail', 0); draw(); const upA = px(720, K.Y); set(f, 'detail', 50); draw(); const upD = px(720, K.Y);
      step('warpDetails', { bezierSame: bzSame, bezierLeft: bzL.join(), bezierRight: bzR.join(), meshFlat: mwFlat, meshLeft: mwL.join(), meshRight: mwR.join(), displaceByLayer: dmLayer, upscale: upA.join(), upscaleDetail: upD.join(),
        works: bzSame <= 2 && cl(bzL, W3) && cl(bzR, z) && mwFlat <= 2 && cl(mwL, W3) && cl(mwR, z) && dmLayer > 1000 && cl(upA, RED, 3) && cl(upD, RED, 6) });
      const menuD = [...document.querySelectorAll('#fx-add optgroup')].find(g => g.label === 'Distort');
      step('distortMenu16', { count: menuD?.children.length, works: menuD?.children.length === 34 });
    }
    const r16speed = {};
    for (const [id, vals] of [['warp', {}], ['bezierwarp', { rtVX: .8, brVY: .9 }], ['meshwarp', {}], ['displacement', { maxH: 20, maxV: 20 }], ['twirllegacy', {}], ['upscale', {}]]) {
      const g = await only(id); for (const k in vals) set(g, k, vals[k]); if (id === 'meshwarp') { set(g, 'rows', 2); set(g, 'columns', 2); g.mesh = '0,0 0,0 0,0 0,0 60,40 0,0 0,0 0,0 0,0'; }
      draw(); ctx.getImageData(0, 0, 1, 1);
      const t0 = performance.now(); for (let i = 0; i < 10; i++) draw(1.1 + i / 30); ctx.getImageData(0, 0, 1, 1); r16speed[id] = +((performance.now() - t0) / 10).toFixed(1);
    }
    step('round16speed', r16speed);

    // ---- Round 17: Stylize I. Same patches
    {
      const K = { BLK: 160, WHT: 480, RED: 800, GRN: 1120, BLU: 1440, GRY: 1760, Y: 270 }, cl = (a, b, t = 2) => a.every((v, k) => Math.abs(v - b[k]) <= t), z = [0, 0, 0], W3 = [255, 255, 255];
      const kerr = async (fam, e) => { const pp = FXG.pipes[fam + ':' + e]; if (pp?.pipe) return null; const m = FXG.mods[fam]; return { err: pp?.err, log: m ? (await m.getCompilationInfo()).messages.slice(0, 8).map(x => `${x.lineNum}:${x.linePos} ${x.message}`) : null }; };
      const changed = () => diff(plain, frame()).changed, same = () => diff(plain, frame()).max;
      // each moves the card when on, and leaves it alone with its "off" setting; a flat patch's middle keeps its colour
      const R = {};
      for (const [id, fam, entry, on, off] of [['brushstrokes', 'fx_stylize', 'fxs_brush', {}, { blend: 100 }], ['coloremboss', 'fx_warp', 'fxw_coloremboss', {}, { relief: 0 }],
        ['scatter', 'fx_stylize', 'fxs_scatter', { amount: 20 }, { amount: 0 }], ['cartoon', 'fx_warp', 'fxw_cartoon', {}, null]]) {
        f = await only(id); { const e = await kerr(fam, entry); if (e) step(id + 'Kernel', e); }
        for (const k in on) set(f, k, on[k]);
        draw(); const r = { changed: changed(), red: px(K.RED, K.Y).join() };
        if (off) { for (const k in off) set(f, k, off[k]); draw(); r.offMax = same(); }
        R[id] = r;
      }
      step('stylizeMoves', { ...R, works: Object.values(R).every(r => r.changed > 1000 && (r.offMax == null || r.offMax <= 2)) && ['brushstrokes', 'coloremboss', 'scatter'].every(id => cl(R[id].red.split(',').map(Number), P0(K.RED, K.Y), 3)) });
      // CC Threshold: luminance 127 makes red black and grey white; RGB thresholds each channel; Invert and Blend
      f = await only('ccthreshold'); draw(); const thR = px(K.RED, K.Y), thG = px(K.GRY, K.Y); f.invert = true; draw(); const thI = px(K.RED, K.Y); f.invert = false; set(f, 'blend', 100); draw(); const thB = same();
      f = await only('ccthresholdrgb'); draw(); const tr = px(K.RED, K.Y), tg = px(K.GRN, K.Y), tb = px(K.BLU, K.Y); f.invG = true; draw(); const tgI = px(K.RED, K.Y);
      // Brush Strokes on white with no strokes: white
      f = await only('brushstrokes'); f.surface = 2; set(f, 'density', 0); draw(); const bsW = px(K.RED, K.Y);
      // Cartoon, no smoothing, two hard steps: red's brightness .31 → .5, so its colour × 1.63; Edges alone: a flat patch is white
      f = await only('cartoon'); set(f, 'radius', 0); f.render = 0; set(f, 'steps', 2); set(f, 'smooth', 0); draw(); const ctR = px(K.RED, K.Y);
      f.render = 1; draw(); const ctE = px(K.RED, K.Y), ctEdge = px(K.RED - 160, K.Y);
      // Roughen Edges on the card at half size: the middle stays, the edges get bitten
      L.p.scale = .5; while (L.fx?.length) delFX(L, 0); draw(); const half = frame();
      f = await only('roughenedges'); { const e = await kerr('fx_stylize', 'fxs_roughen'); if (e) step('roughenKernel', e); }
      draw(); const rgMid = px(880, 405), rgChanged = diff(half, frame()).changed; f.type = 2; draw(); const rgCut = diff(half, frame()).changed;
      L.p.scale = 1;
      // Texturize with a hidden white ellipse as the texture: its rim shades the card; contrast 0 leaves it
      f = await only('texturize'); { const e = await kerr('fx_stylize', 'fxs_texturize'); if (e) step('texturizeKernel', e); }
      draw(); const txNone = same();
      addShape('ellipse'); const TX = selLayer(); Object.assign(TX, { fill: '#ffffff', visible: false, start: 0, dur: 6 }); f.layer = TX.id;
      draw(); const txOn = changed(); set(f, 'contrast', 0); draw(); const txOff = same(); set(f, 'contrast', 1); f.placement = 2; draw(); const txStretch = changed();
      S.layers = S.layers.filter(x => x !== TX); f.layer = 0; S.sel = L.id;
      step('stylizeDetails', { thRed: thR.join(), thGrey: thG.join(), thInvert: thI.join(), thBlend: thB, rgbRed: tr.join(), rgbGreen: tg.join(), rgbBlue: tb.join(), rgbGreenInv: tgI.join(), brushWhite: bsW.join(),
        cartoonFill: ctR.join(), cartoonEdgesFlat: ctE.join(), cartoonEdgeLine: ctEdge.join(), roughenMid: rgMid.join(), roughenChanged: rgChanged, roughenCut: rgCut, textureNone: txNone, textureOn: txOn, textureOff: txOff, textureStretch: txStretch,
        works: cl(thR, z) && cl(thG, W3) && cl(thI, W3) && thB <= 2 && cl(tr, [255, 0, 0]) && cl(tg, [0, 255, 0]) && cl(tb, [0, 0, 255]) && cl(tgI, [255, 255, 0]) && cl(bsW, W3)
          && cl(ctR, [255, 65, 65], 6) && cl(ctE, W3) && lum(ctEdge) < 128 && cl(rgMid, P0(K.RED, K.Y), 3) && rgChanged > 500 && rgCut > 300 && txNone <= 2 && txOn > 1000 && txOff <= 2 && txStretch > 1000 });
      const menuS = [...document.querySelectorAll('#fx-add optgroup')].find(g => g.label === 'Stylize');
      step('stylizeMenu17', { count: menuS?.children.length, works: menuS?.children.length >= 16 });
    }
    const r17speed = {};
    for (const [id, vals] of [['brushstrokes', {}], ['cartoon', {}], ['coloremboss', {}], ['roughenedges', {}], ['scatter', { amount: 20 }], ['ccthreshold', {}], ['ccthresholdrgb', {}]]) {
      const g = await only(id); for (const k in vals) set(g, k, vals[k]);
      draw(); ctx.getImageData(0, 0, 1, 1);
      const t0 = performance.now(); for (let i = 0; i < 10; i++) draw(1.1 + i / 30); ctx.getImageData(0, 0, 1, 1); r17speed[id] = +((performance.now() - t0) / 10).toFixed(1);
    }
    step('round17speed', r17speed);

    // ---- Round 18: Stylize II (CC). Same patches
    {
      const K = { BLK: 160, WHT: 480, RED: 800, GRN: 1120, BLU: 1440, GRY: 1760, Y: 270 }, cl = (a, b, t = 2) => a.every((v, k) => Math.abs(v - b[k]) <= t);
      const kerr = async (fam, e) => { const pp = FXG.pipes[fam + ':' + e]; if (pp?.pipe) return null; const m = FXG.mods[fam]; return { err: pp?.err, log: m ? (await m.getCompilationInfo()).messages.slice(0, 8).map(x => `${x.lineNum}:${x.linePos} ${x.message}`) : null }; };
      const changed = () => diff(plain, frame()).changed, same = () => diff(plain, frame()).max;
      // each moves the card when on, and leaves it alone with its "off" setting
      const R = {};
      for (const [id, fam, entry, on, off] of [['ccblockload', 'fx_pixel2', 'fp2_block_load', { completion: 50 }, { completion: 100 }], ['ccburnfilm', 'fx_pixel2', 'fp2_burn', { burn: 50 }, { burn: 0 }],
        ['ccglass', 'fx_pixel2', 'fp2_bump', {}, { intensity: 0 }], ['ccplastic', 'fx_pixel2', 'fp2_bump', {}, { intensity: 0 }], ['cchextile', 'fx_pixel2', 'fp2_hextile', {}, { smear: 100 }],
        ['cckaleida', 'fx_stylize', 'fxs_warp', {}, null], ['ccmrsmoothie', 'fx_pixel2', 'fp2_smoothie', {}, null]]) {
        f = await only(id); { const e = await kerr(fam, entry); if (e) step(id + 'Kernel', e); }
        for (const k in on) set(f, k, on[k]);
        draw(); const r = { changed: changed() };
        if (off) { for (const k in off) set(f, k, off[k]); draw(); r.offMax = same(); }
        R[id] = r;
      }
      step('stylize2Moves', { ...R, works: Object.values(R).every(r => r.changed > 1000 && (r.offMax == null || r.offMax <= 2)) });
      // Block Load: at 0% (not cleared) the whole card is one block's mean colour; cleared, it is gone; near 100% the rows are loaded
      f = await only('ccblockload'); f.cleared = false; draw(); const bl0 = [px(K.RED, K.Y), px(K.BLU, K.Y), px(800, 900)];
      f.cleared = true; draw(); const blC = [px(K.RED, K.Y), px(K.BLU, K.Y)]; set(f, 'completion', 99.9); draw(); const blHi = px(K.RED, K.Y);
      // Burn Film at 100%: burnt right through
      f = await only('ccburnfilm'); set(f, 'burn', 100); draw(); const bfAll = [px(K.RED, K.Y), px(K.GRN, K.Y), px(K.WHT, K.Y)];
      // HexTile with a huge radius: the whole frame is the centre cell, so nothing moves
      f = await only('cchextile'); set(f, 'radius', 4000); draw(); const hxBig = same();
      // Kaleida (Unfold) mirrors left and right of its centre, even over the ramp
      f = await only('cckaleida'); f.mirroring = 2; draw(); const kL = px(760, 640), kR = px(1160, 640);
      // Mr. Smoothie with both samples on the red patch paints the whole card red
      f = await only('ccmrsmoothie'); for (const [k, v] of [['sampleAX', K.RED / 1920], ['sampleAY', K.Y / 1080], ['sampleBX', K.RED / 1920], ['sampleBY', K.Y / 1080]]) set(f, k, v);
      draw(); const msBlue = px(K.BLU, K.Y), msWhite = px(K.WHT, K.Y);
      // Plastic with a hidden white ellipse as its bump layer: the ellipse's rim shades the card
      f = await only('ccplastic'); draw(); const plFlat = frame();
      addShape('ellipse'); const TX = selLayer(); Object.assign(TX, { fill: '#ffffff', visible: false, start: 0, dur: 6 }); S.sel = L.id; f.bump = TX.id;
      draw(); const plBump = diff(plFlat, frame()).changed;
      f = await only('ccglass'); draw(); const glFlat = frame(); f.bump = TX.id; draw(); const glBump = diff(glFlat, frame()).changed;
      S.layers = S.layers.filter(x => x !== TX); S.sel = L.id;
      // RepeTile on the card at half size: a copy grows out to the right; the left stays clear
      L.p.scale = .5; while (L.fx?.length) delFX(L, 0); draw(); const half = frame(), hp = (x, y) => { const i = (y * 1920 + x) * 4; return [half[i], half[i + 1], half[i + 2]]; };
      f = await only('ccrepetile'); { const e = await kerr('fx_stylize', 'fxs_repetile'); if (e) step('repetileKernel', e); }
      set(f, 'right', 960); draw(); const rtCopy = px(1840, 405), rtLeft = px(200, 405), rtMid = px(880, 405);
      L.p.scale = 1;
      step('stylize2Details', { block0: bl0.map(String), blockCleared: blC.map(String), blockHigh: blHi.join(), burnAll: bfAll.map(String), hexBig: hxBig, kalLeft: kL.join(), kalRight: kR.join(),
        smoothieBlue: msBlue.join(), smoothieWhite: msWhite.join(), plasticBump: plBump, glassBump: glBump, repeCopy: rtCopy.join(), repeLeft: rtLeft.join(), repeHalfLeft: hp(200, 405).join(),
        works: cl(bl0[0], bl0[1], 3) && cl(bl0[0], bl0[2], 3) && !cl(bl0[0], P0(K.RED, K.Y), 10) && cl(blC[0], blC[1]) && !cl(blC[0], P0(K.RED, K.Y), 10) && cl(blHi, P0(K.RED, K.Y), 3)
          && cl(bfAll[0], bfAll[1]) && cl(bfAll[0], bfAll[2]) && hxBig <= 2 && cl(kL, kR, 3) && cl(msBlue, P0(K.RED, K.Y), 4) && cl(msWhite, P0(K.RED, K.Y), 4)
          && plBump > 1000 && glBump > 1000 && cl(rtCopy, P0(K.RED, K.Y), 4) && cl(rtLeft, hp(200, 405)) && cl(rtMid, P0(K.RED, K.Y), 4) });
      const menuS = [...document.querySelectorAll('#fx-add optgroup')].find(g => g.label === 'Stylize');
      step('stylizeMenu18', { count: menuS?.children.length, works: menuS?.children.length === 24 });
    }
    const r18speed = {};
    for (const [id, vals] of [['ccblockload', { completion: 50 }], ['ccburnfilm', { burn: 50 }], ['ccglass', {}], ['cchextile', {}], ['cckaleida', {}], ['ccmrsmoothie', {}], ['ccplastic', {}], ['ccrepetile', { right: 200 }]]) {
      const g = await only(id); for (const k in vals) set(g, k, vals[k]);
      draw(); ctx.getImageData(0, 0, 1, 1);
      const t0 = performance.now(); for (let i = 0; i < 10; i++) draw(1.1 + i / 30); ctx.getImageData(0, 0, 1, 1); r18speed[id] = +((performance.now() - t0) / 10).toFixed(1);
    }
    step('round18speed', r18speed);

    // ---- Round 19: Generate I. Same card (patches at y 270); the mask tests use a centred rectangle mask (x 384–1536, y 216–864)
    {
      const K = { BLK: 160, WHT: 480, RED: 800, GRN: 1120, BLU: 1440, GRY: 1760, Y: 270 }, cl = (a, b, t = 2) => a.every((v, k) => Math.abs(v - b[k]) <= t);
      const kerr = async (fam, e) => { const pp = FXG.pipes[fam + ':' + e]; if (pp?.pipe) return null; const m = FXG.mods[fam]; return { err: pp?.err, log: m ? (await m.getCompilationInfo()).messages.slice(0, 8).map(x => `${x.lineNum}:${x.linePos} ${x.message}`) : null }; };
      const K19 = {};
      for (const id of ['fill', 'checkerboard', 'circle', 'ellipse', 'cellpattern', 'stroke', 'scribble', 'vegas', 'writeon', 'paintbucket', 'eyedropperfill', 'radiowaves']) {
        await only(id); for (const [fam, e] of FX[id].kernels) { const r = await kerr(fam, e); if (r) K19[fam + ':' + e] = r; }
      }
      step('generate1Kernels', { ...K19, works: !Object.keys(K19).length });
      const BK = [0, 0, 0], WH = [255, 255, 255];
      // counts lit pixels inside / outside the mask rectangle
      const lit = () => { const d = frame(); let inn = 0, out = 0; for (let y = 0; y < 1080; y += 2) for (let x = 0; x < 1920; x += 2) { const i = (y * 1920 + x) * 4; if (d[i] + d[i + 1] + d[i + 2] > 60) { if (x > 360 && x < 1560 && y > 196 && y < 884) inn++; else out++; } } return [inn, out]; };
      // Fill: the card turns the fill colour; Invert fills only the clear parts (none here)
      f = await only('fill'); f.color = '#00ff00'; draw(); const fl = [px(K.WHT, K.Y), px(K.RED, 900)]; f.invert = true; draw(); const flInv = px(K.WHT, K.Y);
      // Checkerboard (None): white and clear squares 100 px wide from the top left
      f = await only('checkerboard'); set(f, 'width', 100); draw(); const ck = [px(50, 50), px(150, 50), px(150, 150)];
      // Circle (None): a white disc of radius 100 in the middle, clear round it; Edge Thickness makes it a ring
      f = await only('circle'); set(f, 'radius', 100); draw(); const ci = [px(960, 540), px(960, 700)]; f.edge = 2; set(f, 'thickness', 20); draw(); const ring = [px(960, 540), px(960, 450)];
      // Ellipse 400 × 200: the outline is white, its middle clear
      f = await only('ellipse'); set(f, 'width', 400); set(f, 'height', 200); draw(); const el = [px(1160, 540), px(960, 640), px(960, 540)];
      // Cell Pattern: opaque grey cells; the HQ pattern differs from the standard one a little
      f = await only('cellpattern'); f.pattern = 2; draw(); const cp = px(700, 500), cpStd = frame(); f.pattern = 7; draw(); const cpHQ = diff(cpStd, frame());
      // Paint Bucket: blue floods the red patch only
      f = await only('paintbucket'); set(f, 'fillPointX', K.RED / 1920); set(f, 'fillPointY', K.Y / 1080); f.color = '#0000ff'; draw(); const pb = [px(K.RED, K.Y), px(K.GRN, K.Y), px(K.WHT, K.Y)];
      f.viewThreshold = true; draw(); const pbView = [px(K.RED, K.Y), px(K.GRN, K.Y)];
      // Eyedropper Fill: the colour under the sample point fills the card
      f = await only('eyedropperfill'); set(f, 'samplePointX', K.RED / 1920); set(f, 'samplePointY', K.Y / 1080); draw(); const ed = px(K.BLU, K.Y);
      // Radio Waves at 1.5 s: rings of radius 150 and 50 round the middle, the card between them untouched
      f = await only('radiowaves'); draw(1.5); const rw = [px(1110, 540), px(1010, 540), px(1060, 540)];
      // Vegas (Transparent): lines along the card's contours only
      f = await only('vegas'); f.blendMode = 0; set(f, 'width', 4); draw(); const vg = lit();
      // Write-on along a keyframed brush (x 20% → 80% over the first second), on transparent
      f = await only('writeon'); f.paintStyle = 1; set(f, 'brushSize', 40); L.keys[fxKey(f, 'brushPositionX')] = [{ t: 0, v: .2, ease: 'linear' }, { t: 1, v: .8, ease: 'linear' }];
      draw(1); const wo = [px(960, 540), px(500, 540), px(200, 540), px(1700, 540)]; delete L.keys[fxKey(f, 'brushPositionX')];
      // Stroke and Scribble follow the layer's mask
      L.mask = { on: true, shape: 'rect', invert: false };
      f = await only('stroke'); f.color = '#ff0000'; f.paintStyle = 1; set(f, 'brushSize', 10); draw(); const sk = [px(384, 540), px(960, 540), px(1536, 700)]; set(f, 'end', 50); draw(); const skHalf = lit();
      f = await only('scribble'); f.wiggle = 0; draw(); const sb = lit(); draw(1.3); const sbStatic = lit();
      L.mask = null;
      step('generate1Details', { fill: fl.map(String), fillInvert: flInv.join(), checker: ck.map(String), circle: ci.map(String), ring: ring.map(String), ellipse: el.map(String),
        cell: cp.join(), cellHQ: cpHQ.changed, bucket: pb.map(String), bucketView: pbView.map(String), eyedrop: ed.join(), radio: rw.map(String), vegas: vg, writeOn: wo.map(String),
        stroke: sk.map(String), strokeHalf: skHalf, scribble: sb, scribbleStatic: sbStatic,
        works: cl(fl[0], [0, 255, 0]) && cl(fl[1], [0, 255, 0]) && cl(flInv, BK) && cl(ck[0], WH) && cl(ck[1], BK) && cl(ck[2], WH) && cl(ci[0], WH) && cl(ci[1], BK) && cl(ring[0], BK) && cl(ring[1], WH, 10)
          && cl(el[0], WH, 10) && cl(el[1], WH, 10) && cl(el[2], BK) && cp[0] === cp[1] && cp[1] === cp[2] && cpHQ.changed > 100
          && cl(pb[0], [0, 0, 255], 3) && cl(pb[1], P0(K.GRN, K.Y)) && cl(pb[2], P0(K.WHT, K.Y)) && cl(pbView[0], WH) && cl(pbView[1], BK) && cl(ed, P0(K.RED, K.Y), 3)
          && cl(rw[0], WH, 30) && cl(rw[1], WH, 30) && cl(rw[2], P0(1060, 540), 3) && vg[0] + vg[1] > 200 && vg[0] + vg[1] < 100000
          && cl(wo[0], WH, 10) && cl(wo[1], WH, 10) && cl(wo[2], BK) && cl(wo[3], BK) && sk[0][0] > 150 && sk[0][1] < 60 && cl(sk[1], BK) && skHalf[0] > 50 && skHalf[1] === 0
          && sb[0] > 2000 && sb[1] === 0 && sb[0] === sbStatic[0] });
      const menuG = [...document.querySelectorAll('#fx-add optgroup')].find(g => g.label === 'Generate');
      step('generateMenu19', { count: menuG?.children.length, works: menuG?.children.length >= 16 });
    }
    const r19speed = {};
    for (const [id, vals, mask] of [['fill', {}], ['checkerboard', {}], ['circle', {}], ['ellipse', {}], ['cellpattern', {}], ['stroke', {}, 1], ['scribble', {}, 1], ['vegas', {}],
      ['writeon', {}], ['paintbucket', {}], ['eyedropperfill', {}], ['radiowaves', {}]]) {
      L.mask = mask ? { on: true, shape: 'rect', invert: false } : null;
      const g = await only(id); for (const k in vals) set(g, k, vals[k]);
      draw(); ctx.getImageData(0, 0, 1, 1);
      const t0 = performance.now(); for (let i = 0; i < 10; i++) draw(1.1 + i / 30); ctx.getImageData(0, 0, 1, 1); r19speed[id] = +((performance.now() - t0) / 10).toFixed(1);
    }
    L.mask = null;
    step('round19speed', r19speed);

    // ---- Round 20: Generate II (light). Same card: six patches across the top half (black, white, red, green, blue, grey,
    //      320 px each), a grey ramp below
    {
      const cl = (a, b, t = 2) => a.every((v, k) => Math.abs(v - b[k]) <= t), sum = a => a[0] + a[1] + a[2], BK = [0, 0, 0], WH = [255, 255, 255];
      const kerr = async (fam, e) => { const pp = FXG.pipes[fam + ':' + e]; if (pp?.pipe) return null; const m = FXG.mods[fam]; return { err: pp?.err, log: m ? (await m.getCompilationInfo()).messages.slice(0, 8).map(x => `${x.lineNum}:${x.linePos} ${x.message}`) : null }; };
      const K20 = {}, ids = ['advlightning', 'lensflare', 'beam', 'lightburst', 'lightsweep', 'gluegun', 'threads', 'fractal'];
      for (const id of ids) { await only(id); for (const [fam, e] of FX[id].kernels) { const r = await kerr(fam, e); if (r) K20[fam + ':' + e] = r; } }
      step('generate2Kernels', { ...K20, works: !Object.keys(K20).length });
      while (L.fx?.length) delFX(L, 0); draw(); const plainF = frame();
      // Advanced Lightning (Strike, composited): a bolt from the origin to the direction point, the same each draw; another
      // Conductivity State grows another bolt
      f = await only('advlightning'); draw(); const al1 = frame(), alN = diff(plainF, al1).changed; draw(1.4); const alSame = diff(al1, frame()).changed;
      set(f, 'conductivityState', 77); draw(); const alOther = diff(al1, frame()).changed;
      // Lens Flare in the ramp: brighter at the flare centre than the card under it
      f = await only('lensflare'); set(f, 'centerX', .5); set(f, 'centerY', .8); draw(); const lf = [px(960, 864), P0(960, 864)];
      // Beam (composited): a white beam from x 480 to 720 along y 540, the rest of the card untouched
      f = await only('beam'); draw(); const bm = [px(600, 540), px(1200, 540), P0(1200, 540)];
      // CC Light Burst (Straight): the brightest colour along each ray to the centre; the centre keeps its own colour;
      // Ray Length 0 changes nothing
      f = await only('lightburst'); draw(); const lb = [px(100, 100), px(960, 300), P0(960, 300)]; set(f, 'rayLength', 0); draw(); const lbOff = diff(plainF, frame()).changed;
      // CC Light Sweep: light along a line through the centre; far from it the card is untouched
      f = await only('lightsweep'); draw(); const ls = [px(1035, 670), P0(1035, 670), px(100, 100), P0(100, 100)];
      // CC Glue Gun (Glue Only): beads at the brush in the ramp, nothing elsewhere; Over Layer keeps the card round them
      f = await only('gluegun'); set(f, 'brushX', .5); set(f, 'brushY', .75); f.style = 1; draw(); const gg = [px(960, 810), px(960, 700)]; f.style = 0; draw(); const ggOver = [px(960, 700), P0(960, 700)];
      // CC Threads: the white patch woven into threads with gaps (80 % coverage leaves about 4 % open)
      f = await only('threads'); draw(); let gaps = 0, n = 0; { const d = frame(); for (let y = 0; y < 540; y += 2) for (let x = 330; x < 630; x += 2) { const i = (y * 1920 + x) * 4; n++; if (d[i] + d[i + 1] + d[i + 2] < 60) gaps++; } }
      const thGap = gaps / n;
      // Fractal: Solid Color draws the inside of the set red and leaves the outside clear; it is kept between frames
      f = await only('fractal'); f.palette = 3; let t0 = performance.now(); draw(); ctx.getImageData(0, 0, 1, 1); const frFirst = +(performance.now() - t0).toFixed(1);
      let red = 0, clear = 0; { const d = frame(); for (let i = 0; i < d.length; i += 16) { if (d[i] > 240 && d[i + 1] < 20 && d[i + 2] < 20) red++; else if (d[i] + d[i + 1] + d[i + 2] < 10) clear++; } }
      t0 = performance.now(); draw(1.2); ctx.getImageData(0, 0, 1, 1); const frKept = +(performance.now() - t0).toFixed(1);
      // Overlay: the set's outside shows the card
      f.overlay = true; draw(); const frOver = [px(1800, 100), P0(1800, 100)];
      f.palette = 0; f.overlay = false; draw(); const frGrad = diff(plainF, frame()).changed;
      step('generate2Details', { lightning: alN, lightningSame: alSame, lightningOther: alOther, flare: lf.map(String), beam: bm.map(String), burst: lb.map(String), burstOff: lbOff,
        sweep: ls.map(String), glue: gg.map(String), glueOver: ggOver.map(String), threadGaps: +thGap.toFixed(3), fractalRed: red, fractalClear: clear, fractalOverlay: frOver.map(String),
        fractalGradient: frGrad, fractalFirstMs: frFirst, fractalKeptMs: frKept,
        works: alN > 2000 && alSame === 0 && alOther > 500 && sum(lf[0]) > sum(lf[1]) + 150 && cl(bm[0], WH, 10) && cl(bm[1], bm[2])
          && cl(lb[0], WH, 10) && cl(lb[1], lb[2], 3) && lbOff === 0 && sum(ls[0]) > sum(ls[1]) + 60 && cl(ls[2], ls[3])
          && sum(gg[0]) > 100 && cl(gg[1], BK) && cl(ggOver[0], ggOver[1]) && thGap > .01 && thGap < .1
          && red > 5000 && clear > 5000 && cl(frOver[0], frOver[1], 3) && frGrad > 500000 && frKept < 60 });
      const menuG = [...document.querySelectorAll('#fx-add optgroup')].find(g => g.label === 'Generate');
      step('generateMenu20', { count: menuG?.children.length, works: menuG?.children.length === 24 });
    }
    const r20speed = {};
    for (const id of ['advlightning', 'lensflare', 'beam', 'lightburst', 'lightsweep', 'gluegun', 'threads', 'fractal']) {
      await only(id); draw(); ctx.getImageData(0, 0, 1, 1);
      const t0 = performance.now(); for (let i = 0; i < 10; i++) draw(1.1 + i / 30); ctx.getImageData(0, 0, 1, 1); r20speed[id] = +((performance.now() - t0) / 10).toFixed(1);
    }
    step('round20speed', r20speed);

    // ---- Round 21: Noise & Grain. Same card: black, white, red, green, blue, grey patches across the top half (320 px
    //      each), a grey ramp below. The grey patch's spread (100 × 100 px at 1700, 200) shows how grainy it is
    {
      const cl = (a, b, t = 2) => a.every((v, k) => Math.abs(v - b[k]) <= t);
      const kerr = async (fam, e) => { const pp = FXG.pipes[fam + ':' + e]; if (pp?.pipe) return null; const m = FXG.mods[fam]; return { err: pp?.err, log: m ? (await m.getCompilationInfo()).messages.slice(0, 8).map(x => `${x.lineNum}:${x.linePos} ${x.message}`) : null }; };
      const ids = ['noiseamt', 'addgrain', 'matchgrain', 'removegrain', 'dustscratches', 'median', 'medianlegacy', 'noisealpha', 'noisehls', 'noisehlsauto', 'turbnoise', 'curlnoise'], K21 = {};
      for (const id of ids) { await only(id); for (const [fam, e] of FX[id].kernels) { const r = await kerr(fam, e); if (r) K21[fam + ':' + e] = r; } }
      step('noiseKernels', { ...K21, works: !Object.keys(K21).length });
      const spread = (d, x0 = 1700, y0 = 200, n = 100, c = 0) => { let a = 0, b = 0, k = 0; for (let y = y0; y < y0 + n; y++) for (let x = x0; x < x0 + n; x++) { const v = d[(y * 1920 + x) * 4 + c]; a += v; b += v * v; k++; } return +Math.sqrt(Math.max(0, b / k - (a / k) ** 2)).toFixed(2); };
      const count = (d, fn) => { let n = 0; for (let i = 0; i < d.length; i += 4) if (fn(d[i], d[i + 1], d[i + 2])) n++; return n; };
      while (L.fx?.length) delFX(L, 0); draw(); const plainF = frame(), plainSpread = spread(plainF);
      // Noise: Amount 0 changes nothing; 40 % scatters the grey patch, coloured (channels differ) or grey; a new pattern later on
      f = await only('noiseamt'); draw(); const nzZero = diff(plainF, frame()).changed;
      set(f, 'amount', 40); draw(); const nz1 = frame(), nzSpread = spread(nz1), nzColor = count(nz1.subarray((200 * 1920 + 1700) * 4, (200 * 1920 + 1800) * 4), (r, g, b) => r !== g || g !== b);
      draw(1.2); const nzLater = diff(nz1, frame()).changed; f.color = false; draw(); const nzGrey = count(frame().subarray((200 * 1920 + 1700) * 4, (200 * 1920 + 1800) * 4), (r, g, b) => r !== g || g !== b);
      // Add Grain: grain on the grey patch; Intensity 0 none; Blending Matte (Shadows 0) black on the black patch, white on the
      // white one; Preview: grain only inside the 200 × 200 box round the middle, its outline white
      f = await only('addgrain'); draw(); const agSpread = spread(frame()); set(f, 'intensity', 0); draw(); const agZero = diff(plainF, frame()).changed; set(f, 'intensity', 3);
      f.view = 1; set(f, 'shadows', 0); draw(); const agMatte = [px(160, 270), px(480, 270)]; set(f, 'shadows', 1);
      f.view = 0; draw(); const agPv = frame(), chg = (x0, y0, n) => { let k = 0; for (let y = y0; y < y0 + n; y++) for (let x = x0; x < x0 + n; x++) { const i = (y * 1920 + x) * 4; if (Math.abs(agPv[i] - plainF[i]) > 2) k++; } return k; }, agIn = chg(900, 560, 60), agOut = chg(1700, 200, 60), agBox = px(860, 540);
      f.view = 2; f.preset = 3; draw(); const agVintage = spread(frame());
      // Remove Grain (after Noise): the grey patch smoother than with the noise alone; Noise Samples draws yellow boxes;
      // Blending Matte is white everywhere in the layer
      f = await only('noiseamt'); set(f, 'amount', 30); f.color = false; draw(); const noisy = frame(), noisySpread = spread(noisy);
      f = await add('removegrain'); set(f, 'reduction', 3); draw(); const rgSpread = spread(frame());
      f.view = 1; draw(); const rgBoxes = count(frame(), (r, g, b) => r === 255 && g === 255 && b === 0);
      f.view = 2; draw(); const rgMatte = px(160, 270); f.view = 3;
      // Dust & Scratches, Median and Median (Legacy) after the noise: smoother; Threshold 255 leaves the noise; Median radius
      // 6 uses the sliding histogram and smooths too; radius 0 changes nothing
      while (L.fx.length > 1) delFX(L, 1);
      f = await add('dustscratches'); set(f, 'radius', 2); draw(); const dsSpread = spread(frame()); set(f, 'threshold', 255); draw(); const dsKeep = diff(noisy, frame()).changed; delFX(L, 1);
      f = await add('median'); draw(); const mdZero = diff(noisy, frame()).changed; set(f, 'radius', 2); draw(); const md2 = spread(frame()); set(f, 'radius', 6); draw(); const md6 = spread(frame()); delFX(L, 1);
      f = await add('medianlegacy'); set(f, 'radius', 2); draw(); const mlSpread = spread(frame()); delFX(L, 1);
      // Noise Alpha (Scale): holes in the layer show the black behind it on the grey patch
      f = await only('noisealpha'); draw(); const naZero = diff(plainF, frame()).changed; set(f, 'amount', 60); f.original = 2; draw(); const naSpread = spread(frame());
      // Noise HLS: Lightness 50 % scatters the grey patch, the same each frame; Noise HLS Auto changes with time
      f = await only('noisehls'); draw(); const hlZero = diff(plainF, frame()).changed; set(f, 'lightness', 50); draw(1); const hl1 = frame(), hlSpread = spread(hl1); draw(1.5); const hlSame = diff(hl1, frame()).changed;
      f = await only('noisehlsauto'); set(f, 'lightness', 50); draw(1); const ha1 = frame(); draw(1.5); const haMoves = diff(ha1, frame()).changed;
      // Turbulent Noise: a cloudy pattern over the layer, another with Random Seed 7 or more Evolution, and nothing outside a
      // shrunk layer
      f = await only('turbnoise'); draw(); const tn1 = frame(), tnSpread = spread(tn1, 200, 200, 600);
      set(f, 'seed', 7); draw(); const tnSeed = diff(tn1, frame()).changed; set(f, 'seed', 0); set(f, 'evolution', 90); draw(); const tnEvo = diff(tn1, frame()).changed;
      L.p.scale = .5; draw(); const tnOut = px(100, 100), tnIn = px(960, 540); L.p.scale = 1;
      // Curl Noise: Amount 0 changes nothing; 40 bends the patches' edges, flat patch middles stay; Flow Field shows the
      // velocities (blue 128)
      f = await only('curlnoise'); set(f, 'amount', 0); draw(); const cnZero = diff(plainF, frame()).changed; set(f, 'amount', 40); draw(); const cnChanged = diff(plainF, frame()).changed, cnMid = [px(480, 270), P0(480, 270)];
      f.view = 1; draw(); const cnFlow = px(700, 300);
      // Match Grain: a grainy grey layer (behind the card) is the source; no source changes nothing; the grey patch gets
      // grain about as strong as the source's; Noise Samples shows yellow boxes on the source
      const gc = document.createElement('canvas'); gc.width = 1920; gc.height = 1080; const gx = gc.getContext('2d'), gd = gx.createImageData(1920, 1080);
      let seedN = 12345; const rnd = () => (seedN = (seedN * 1103515245 + 12345) >>> 0) / 4294967296;
      for (let i = 0; i < gd.data.length; i += 4) { const v = 128 + Math.round((rnd() - .5) * 80); gd.data[i] = gd.data[i + 1] = gd.data[i + 2] = v; gd.data[i + 3] = 255; }
      gx.putImageData(gd, 0, 0); const gfile = new File([await new Promise(r => gc.toBlob(r))], 'grainy.png', { type: 'image/png' });
      gfile.__path = await lumina.saveExport(await gfile.arrayBuffer(), 'grainy.png', dir + 'grainy.png');
      const N = await load(gfile); N.start = 0; N.dur = 6; S.sel = L.id; setRightTab('fx'); refresh();
      while (L.fx?.length) delFX(L, 0); draw();
      if (diff(plainF, frame()).changed) { S.layers.splice(S.layers.indexOf(N), 1); S.layers.unshift(N); draw(); }
      if (diff(plainF, frame()).changed) { S.layers.splice(S.layers.indexOf(N), 1); S.layers.push(N); draw(); }
      const hidden = diff(plainF, frame()).changed, srcSpread = spread(gd.data);
      f = await only('matchgrain'); draw(); const mgNone = diff(plainF, frame()).changed;
      f.source = N.id; draw(); const mgSpread = spread(frame());
      f.view = 1; draw(); const mgBoxes = count(frame(), (r, g, b) => r === 255 && g === 255 && b === 0); f.view = 4;
      S.layers.splice(S.layers.indexOf(N), 1); while (L.fx?.length) delFX(L, 0);
      step('noiseDetails', { plainSpread, nzZero, nzSpread, nzColor, nzLater, nzGrey, agSpread, agZero, agMatte: agMatte.map(String), agIn, agOut, agBox: agBox.join(), agVintage,
        noisySpread, rgSpread, rgBoxes, rgMatte: rgMatte.join(), dsSpread, dsKeep, mdZero, md2, md6, mlSpread, naZero, naSpread, hlZero, hlSpread, hlSame, haMoves,
        tnSpread, tnSeed, tnEvo, tnOut: tnOut.join(), tnIn: tnIn.join(), cnZero, cnChanged, cnMid: cnMid.map(String), cnFlow: cnFlow.join(), hidden, srcSpread, mgNone, mgSpread, mgBoxes,
        works: nzZero === 0 && nzSpread > 10 && nzColor > 50 && nzLater > 10000 && nzGrey === 0 && agSpread > 1 && agZero === 0 && agMatte[0][0] < 10 && agMatte[1][0] > 245
          && agIn > 1000 && agOut === 0 && agBox.join() === '255,255,255' && agVintage > agSpread && rgSpread < noisySpread * .7 && rgBoxes > 100 && rgMatte.join() === '255,255,255'
          && dsSpread < noisySpread * .7 && dsKeep === 0 && mdZero === 0 && md2 < noisySpread * .7 && md6 < noisySpread * .5 && mlSpread < noisySpread * .7
          && naZero === 0 && naSpread > 10 && hlZero === 0 && hlSpread > 10 && hlSame === 0 && haMoves > 10000
          && tnSpread > 20 && tnSeed > 10000 && tnEvo > 10000 && tnOut.join() === '0,0,0' && tnIn.join() !== '0,0,0'
          && cnZero === 0 && cnChanged > 2000 && cl(cnMid[0], cnMid[1]) && Math.abs(cnFlow[2] - 128) <= 2
          && hidden === 0 && mgNone === 0 && mgSpread > srcSpread * .4 && mgSpread < srcSpread * 2 && mgBoxes > 100 });
      const menuN = [...document.querySelectorAll('#fx-add optgroup')].find(g => g.label === 'Noise & Grain');
      step('noiseMenu', { count: menuN?.children.length, works: menuN?.children.length === 12 });
    }
    const r21speed = {};
    for (const id of ['noiseamt', 'addgrain', 'removegrain', 'dustscratches', 'median', 'noisealpha', 'noisehls', 'turbnoise', 'curlnoise']) {
      const f = await only(id);
      if (id === 'noiseamt' || id === 'noisealpha') set(f, 'amount', 40); if (id === 'noisehls') set(f, 'lightness', 30); if (id === 'median') set(f, 'radius', 3);
      draw(); ctx.getImageData(0, 0, 1, 1);
      const t0 = performance.now(); for (let i = 0; i < 10; i++) draw(1.1 + i / 30); ctx.getImageData(0, 0, 1, 1); r21speed[id] = +((performance.now() - t0) / 10).toFixed(1);
    }
    while (L.fx?.length) delFX(L, 0);
    step('round21speed', r21speed);

    // ---- Round 22: Perspective. The card at half size in the middle (x 480-1440, y 270-810) over black: patches 160 px wide
    //      across its top half (black, white, red, green, blue, grey from x 480), the ramp below
    {
      const cl = (a, b, t = 2) => a.every((v, k) => Math.abs(v - b[k]) <= t), sum = a => a[0] + a[1] + a[2], BK = [0, 0, 0], WH = [255, 255, 255];
      const kerr = async (fam, e) => { const pp = FXG.pipes[fam + ':' + e]; if (pp?.pipe) return null; const m = FXG.mods[fam]; return { err: pp?.err, log: m ? (await m.getCompilationInfo()).messages.slice(0, 8).map(x => `${x.lineNum}:${x.linePos} ${x.message}`) : null }; };
      const ids = ['dropshadow', 'radialshadow', 'bevelalpha', 'beveledges', 'cccylinder', 'ccsphere', 'ccspotlight', 'ccenvironment', 'glasses3d'], K22 = {};
      for (const id of ids) { await only(id); for (const [fam, e] of FX[id].kernels) { const r = await kerr(fam, e); if (r) K22[fam + ':' + e] = r; } }
      step('perspectiveKernels', { ...K22, works: !Object.keys(K22).length });
      L.p.scale = .5; while (L.fx?.length) delFX(L, 0); draw(); const half = frame(), H0 = (x, y) => { const i = (y * 1920 + x) * 4; return [half[i], half[i + 1], half[i + 2]]; };
      // Drop Shadow (white, 100 %, 40 px down-right): the shadow shows past the layer's corner, not elsewhere; the layer stays on
      // top; Shadow Only leaves just the shadow; Softness blurs its edge; Direction 315 throws it up-left
      f = await only('dropshadow'); f.color = '#ffffff'; set(f, 'opacity', 100); set(f, 'distance', 80); draw(); const ds = [px(1455, 825), px(470, 280), px(560, 400), H0(560, 400)];
      f.shadowOnly = true; draw(); const dsOnly = px(1000, 400); set(f, 'softness', 40); draw(); const dsSoft = px(1468, 600);
      set(f, 'softness', 0); set(f, 'direction', 315); f.shadowOnly = false; draw(); const dsUp = [px(460, 250), px(1455, 825)];
      // Radial Shadow (white, 100 %): kept inside the layer's box until Resize Layer; then the layer spread from the light shows
      // past its far corner
      f = await only('radialshadow'); f.color = '#ffffff'; set(f, 'opacity', 100); draw(); const rsClip = px(1480, 835);
      f.resize = true; draw(); const rs = [px(1480, 835), px(1600, 950), px(560, 400), H0(560, 400)];
      // Bevel Alpha (10 px, full light from the upper left): the top edge brighter, the bottom edge darker, the middle untouched
      f = await only('bevelalpha'); set(f, 'thickness', 20); set(f, 'intensity', 1); draw(); const ba = [px(1360, 273), H0(1360, 273), px(1360, 806), H0(1360, 806), px(1360, 500), H0(1360, 500)];
      // Bevel Edges (54 px bands): the same round the layer's box
      f = await only('beveledges'); set(f, 'intensity', 1); draw(); const be = [px(1360, 280), H0(1360, 280), px(1360, 800), H0(1360, 800), px(1360, 500), H0(1360, 500)];
      // CC Cylinder (radius 153 px): the layer wrapped round it, nothing beside it; Inside differs from Full
      f = await only('cccylinder'); draw(); const cy1 = frame(), cy = [px(1300, 400), H0(1300, 400), px(960, 450)]; f.render = 2; draw(); const cyIn = diff(cy1, frame()).changed;
      // CC Sphere (radius 60 px): nothing outside it
      f = await only('ccsphere'); draw(); const sp = [px(1100, 500), H0(1100, 500), px(960, 540)];
      // CC Spotlight: the layer kept on the cone's axis, dark far from it; Light Only is white there and nothing outside the layer
      f = await only('ccspotlight'); draw(); const sl = [px(960, 560), H0(960, 560), px(1360, 300)]; f.render = 1; draw(); const slOnly = [px(960, 560), px(300, 300)];
      // CC Environment: the layer becomes a reflection of itself; Probe maps it another way; nothing outside the layer
      f = await only('ccenvironment'); draw(); const en1 = frame(), env = diff(half, en1).changed, enOut = px(300, 300); f.mapping = 1; draw(); const enProbe = diff(en1, frame()).changed;
      // 3D Glasses (one view for both eyes): Balanced Colored Red Blue dims pure red, keeps white; Difference is black until the
      // views are moved apart
      f = await only('glasses3d'); draw(); const gl = [px(880, 400), px(720, 400), H0(880, 400)]; f.view = 8; draw(); const gl8 = frame(), glDiff = px(720, 400);
      set(f, 'convergence', 40); draw(); const glApart = diff(gl8, frame()).changed;
      step('perspectiveDetails', { ds: ds.map(String), dsOnly: dsOnly.join(), dsSoft: dsSoft.join(), dsUp: dsUp.map(String), rsClip: rsClip.join(), rs: rs.map(String),
        ba: ba.map(String), be: be.map(String), cy: cy.map(String), cyIn, sp: sp.map(String), sl: sl.map(String), slOnly: slOnly.map(String), env, enOut: enOut.join(), enProbe,
        gl: gl.map(String), glDiff: glDiff.join(), glApart,
        works: cl(ds[0], WH, 3) && cl(ds[1], BK) && cl(ds[2], ds[3]) && cl(dsOnly, WH, 3) && dsSoft[0] > 40 && dsSoft[0] < 215 && cl(dsUp[0], WH, 3) && cl(dsUp[1], BK)
          && cl(rsClip, BK) && cl(rs[0], WH, 3) && cl(rs[1], BK) && cl(rs[2], rs[3])
          && sum(ba[0]) > sum(ba[1]) + 30 && sum(ba[2]) < sum(ba[3]) - 30 && cl(ba[4], ba[5], 3)
          && sum(be[0]) > sum(be[1]) + 30 && sum(be[2]) < sum(be[3]) - 30 && cl(be[4], be[5], 3)
          && cl(cy[0], BK) && sum(cy[1]) > 100 && sum(cy[2]) > 30 && cyIn > 1000 && cl(sp[0], BK) && sum(sp[1]) > 100 && sum(sp[2]) > 30
          && cl(sl[0], sl[1], 4) && cl(sl[2], BK, 4) && cl(slOnly[0], WH, 4) && cl(slOnly[1], BK)
          && env > 10000 && cl(enOut, BK) && enProbe > 1000
          && gl[0][0] < gl[2][0] - 15 && cl([gl[0][1], gl[0][2]], [gl[2][1], gl[2][2]]) && cl(gl[1], WH, 3) && cl(glDiff, BK) && glApart > 1000 });
      const menuP = [...document.querySelectorAll('#fx-add optgroup')].find(g => g.label === 'Perspective');
      step('perspectiveMenu', { count: menuP?.children.length, works: menuP?.children.length === 9 });
      const r22speed = {};
      for (const id of ids) {
        f = await only(id); if (id === 'dropshadow') set(f, 'softness', 20); if (id === 'bevelalpha') set(f, 'thickness', 10);
        draw(); ctx.getImageData(0, 0, 1, 1);
        const t0 = performance.now(); for (let i = 0; i < 10; i++) draw(1.1 + i / 30); ctx.getImageData(0, 0, 1, 1); r22speed[id] = +((performance.now() - t0) / 10).toFixed(1);
      }
      while (L.fx?.length) delFX(L, 0); L.p.scale = 1; draw();
      step('round22speed', r22speed);
    }

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
