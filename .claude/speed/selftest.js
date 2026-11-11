// Speed test (CapCut phase C3): velocity curves (maths, presets, the editor, splitting), speeds up to 10x, keep pitch,
// freeze frame and smooth slow-mo frame blending. The test video's brightness tells which moment of it is showing.
(async () => {
  const R = { steps: {} }, step = (k, v) => R.steps[k] = v;
  try {
    S.global.vignette = 0;
    const dir = 'D:\\Lumina\\.claude\\speed\\media\\';
    const near = (a, b, tol) => Math.abs(a - b) <= tol;

    // ---- 1. the curve maths, on a 10-second clip that isn't on the timeline
    const fake = extra => ({ id: -1, kind: 'video', start: 0, in: 0, out: 10, speed: 1, keys: {}, p: { rate: 1 }, ...extra });
    // the timeline length a curve gives, worked out independently: the integral of 1/speed over the footage (Simpson, 2000 steps)
    const lenOf = (pts, span = 10, k = 1) => { const f = curveFn(pts), n = 2000, hh = span / n; let s = 0; for (let i = 0; i <= n; i++) s += (i === 0 || i === n ? 1 : i % 2 ? 4 : 2) / (k * f(i / n)); return s * hh / 3; };
    const lens = {};
    for (const [name, d] of Object.entries(CURVES)) { const L = fake({ curve: { name, pts: d.pts } }); lens[name] = { lumina: +len(L).toFixed(3), expected: +lenOf(d.pts).toFixed(3) }; }
    const steady2x = len(fake({ curve: { name: 'custom', pts: [[0, 2], [1, 2]] } })), ten = len(fake({ speed: 10 })), tenCurve = len(fake({ curve: { name: 'custom', pts: [[0, 10], [1, 10]] } }));
    // round trip: timeline -> footage -> timeline
    const H0 = fake({ curve: { name: 'hero', pts: CURVES.hero.pts } }); let rt = 0;
    for (let t = 0; t < len(H0); t += .137) rt = Math.max(rt, Math.abs(tlTime(H0, srcTime(H0, t)) - t));
    // no overshoot: between Bullet's points (4x, 0.25x, 0.25x, 4x) it never goes above 4x or below 0.25x
    const bf = curveFn(CURVES.bullet.pts); let lo = 99, hi = 0; for (let i = 0; i <= 1000; i++) { const v = bf(i / 1000); lo = Math.min(lo, v); hi = Math.max(hi, v); }
    step('curveMaths', { lens, steady2x: +steady2x.toFixed(4), speed10x: +ten.toFixed(4), curve10x: +tenCurve.toFixed(4), roundTripMs: +(rt * 1000).toFixed(3), bulletRange: [+lo.toFixed(4), +hi.toFixed(4)],
      works: Object.values(lens).every(x => Math.abs(x.lumina - x.expected) / x.expected < .005) && near(steady2x, 5, .01) && near(ten, 1, .001) && near(tenCurve, 1, .01) && rt < .002 && lo >= .2499 && hi <= 4.0001 });

    // ---- 2. a real clip: 6 s whose grey level climbs with time (grey = 40 + 30 per second)
    const makeRamp = async secs => {
      const c = document.createElement('canvas'); c.width = 320; c.height = 180; const x = c.getContext('2d');
      const rec = new MediaRecorder(c.captureStream(30), { mimeType: 'video/webm' }), ch = [];
      rec.ondataavailable = e => ch.push(e.data); const done = new Promise(r => rec.onstop = r);
      x.fillStyle = 'rgb(40,40,40)'; x.fillRect(0, 0, 320, 180); rec.start(); const t0 = performance.now();
      await new Promise(r => { const i = setInterval(() => { const t = (performance.now() - t0) / 1000, g = Math.round(40 + 30 * t); x.fillStyle = `rgb(${g},${g},${g})`; x.fillRect(0, 0, 320, 180); if (t > secs) { clearInterval(i); r(); } }, 16); });
      rec.stop(); await done; const blob = new Blob(ch, { type: 'video/webm' }), buf = await blob.arrayBuffer();
      const f = new File([buf], 'ramp.webm', { type: 'video/webm' }); f.__path = await lumina.saveExport(buf, 'ramp.webm', dir + 'ramp.webm'); return f;
    };
    const V = await load(await makeRamp(6)); V.start = 0; V.cover = true;
    for (let i = 0; i < 40 && !(MEDIA[V.media].duration > 5); i++) await new Promise(r => setTimeout(r, 100));
    const footage = V.out - V.in;
    // which moment of the footage is on screen (from its grey level)
    // (the recording's first ~1.4 s is one held frame: the hidden test window throttles the canvas at the start, so checks stay past 1.5 s of footage)
    const shown = async t => { await settle(t); const g = pix(.5, .5)[0]; return (g - 40) / 30; };
    const plain = await shown(3);

    // pick a preset from the Speed panel
    S.sel = V.id; setRightTab('props'); refresh();
    const pick = (sel, v) => { const s = $(sel); s.value = v; s.dispatchEvent(new Event('input', { bubbles: true })); s.dispatchEvent(new Event('change', { bubbles: true })); };
    const menu = [...$('#v-curve').options].map(o => o.textContent), speedMenuTop = [...$('#f-speed').options].pop().textContent;
    pick('#v-curve', 'hero');
    const heroLen = len(V), want = lenOf(CURVES.hero.pts, footage), barW = $(`.trow[data-id="${V.id}"] .bar`).getBoundingClientRect().width;
    const ed = !!$('#inspector canvas.vcurve');
    // on screen, the frame matches the curve: at a few timeline moments the grey level says which footage moment is showing
    const checks = []; for (const t of [.8, 1.5, heroLen / 2, heroLen - .6]) { const exp = srcTime(V, t) - V.in, got = await shown(t); checks.push([+t.toFixed(2), +exp.toFixed(2), +got.toFixed(2), +RT[V.id].el.currentTime.toFixed(2)]); }
    step('preset', { menu, speedMenuTop, editor: ed, footage: +footage.toFixed(2), plainAt3: +plain.toFixed(2), heroLen: +heroLen.toFixed(3), expectedLen: +want.toFixed(3), barPx: Math.round(barW), checks,
      works: menu.includes('Hero') && menu.includes('Bullet') && speedMenuTop === '10x' && ed && near(plain, 3, .25) && Math.abs(heroLen - want) / want < .005
        && near(barW, heroLen * S.pps, 3) && checks.every(([, e, g]) => near(e, g, .25)) });

    // ---- 3. the curve editor: drag the middle point of Hero down, double-click to add a point, double-click it away
    const cv = $('#inspector canvas.vcurve'), cr = () => cv.getBoundingClientRect(), dpr = () => cv.width / cr().width;
    const at = (u, v) => { const [px, py] = vcXY(cv, u, v); return { clientX: cr().left + px / dpr(), clientY: cr().top + py / dpr() }; };
    const mid = V.curve.pts[2], before = len(V);
    cv.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 1, button: 0, ...at(mid[0], mid[1]) }));
    cv.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, pointerId: 1, ...at(mid[0], .1) }));
    cv.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 1, ...at(mid[0], .1) }));
    const dragged = V.curve.pts[2], after = len(V), named = V.curve.name, menuNow = $('#v-curve').value;
    const cv2 = $('#inspector canvas.vcurve'); const n0 = V.curve.pts.length;
    const at2 = (u, v) => { const r = cv2.getBoundingClientRect(), d = cv2.width / r.width, [px, py] = vcXY(cv2, u, v); return { clientX: r.left + px / d, clientY: r.top + py / d }; };
    cv2.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, ...at2(.85, 4) })); const nAdd = V.curve.pts.length;
    const cv3 = $('#inspector canvas.vcurve'), r3 = cv3.getBoundingClientRect(), d3 = cv3.width / r3.width, p = V.curve.pts.find(q => near(q[0], .85, .01)), [qx, qy] = vcXY(cv3, p[0], p[1]);
    cv3.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, clientX: r3.left + qx / d3, clientY: r3.top + qy / d3 })); const nDel = V.curve.pts.length;
    undo(); undo(); undo(); const undone = byId(V.id).curve.name;
    step('editor', { dragged: dragged.map(v => +v.toFixed(3)), lenBefore: +before.toFixed(2), lenAfter: +after.toFixed(2), named, menuNow, points: [n0, nAdd, nDel], afterUndo: undone,
      works: near(dragged[1], .1, .005) && near(dragged[0], mid[0], .001) && after > before + 1 && named === 'custom' && menuNow === 'custom' && nAdd === n0 + 1 && nDel === n0 && undone === 'hero' });

    // ---- 4. splitting a curved clip: the two halves add up, and the speed matches at the cut
    const V1 = byId(V.id), whole = len(V1); seek(whole * .4); S.sel = V1.id; split();
    const P1 = byId(V.id), P2 = selLayer(), parts = len(P1) + len(P2);
    const endSpeed = curveAt(P1, P1.out - P1.in), startSpeed = curveAt(P2, 0);
    step('split', { whole: +whole.toFixed(3), halves: [+len(P1).toFixed(3), +len(P2).toFixed(3)], sum: +parts.toFixed(3), speedAtCut: [+endSpeed.toFixed(3), +startSpeed.toFixed(3)],
      windows: [cWin(P1.curve), cWin(P2.curve)].map(w => w.map(v => +v.toFixed(4))),
      works: Math.abs(parts - whole) < .005 && near(endSpeed, startSpeed, 1e-6) && near(cWin(P1.curve)[1], cWin(P2.curve)[0], 1e-9) });
    undo();

    // ---- 5. keep pitch: on by default, off when unticked (the video element's preservesPitch while playing)
    const VV = byId(V.id); S.sel = VV.id; refresh(); delete VV.curve; refresh();
    const el = RT[VV.id].el; S.playing = true; syncMedia(1); const kpOn = el.preservesPitch;
    $('#f-kp').click(); syncMedia(1); const kpOff = el.preservesPitch, stored = VV.keepPitch;
    S.playing = false; syncMedia(1); el.pause(); $('#f-kp').click();
    step('keepPitch', { defaultOn: kpOn, afterUntick: String(kpOff), stored: String(stored), works: kpOn === true && kpOff === false && stored === false });

    // ---- 6. freeze frame at 2 s: a 3-second hold of that frame, the rest of the clip after it, silent
    S.sel = VV.id; refresh(); seek(2); $('#inspector [data-act=freeze]').click();
    const F = selLayer(), rest = S.layers.find(x => x.kind === 'video' && !x.freeze && x.id !== VV.id);
    const fr1 = await shown(2.5), fr2 = await shown(4.6), afterF = await shown(5.5);
    const fGain = RT[F.id].gain?.gain.value ?? 0; S.sel = F.id; refresh(); const fPanelSpeed = !!$('#f-speed') || !!$('#inspector [data-preset=slowmo]');
    step('freeze', { freezeAt: F && +F.start.toFixed(3), lasts: F && F.dur, holds: F && +F.in.toFixed(2), restStarts: rest && +rest.start.toFixed(3), shownAt: [+fr1.toFixed(2), +fr2.toFixed(2), +afterF.toFixed(2)], gain: fGain, panel: /Freeze frame/.test($('#inspector').textContent), speedControlsHidden: !fPanelSpeed,
      works: !!F?.freeze && near(F.start, 2, 1e-6) && F.dur === 3 && near(F.in, 2, .02) && !!rest && near(rest.start, 5, 1e-6) && near(fr1, 2, .25) && near(fr2, 2, .25) && near(afterF, 2.5, .3) && fGain === 0 && !fPanelSpeed });
    // trimming the freeze: drag its right edge works like a picture's (it changes how long it holds)
    F.dur = 1.5; const fLen = len(F); undo();

    // ---- 7. smooth slow-mo: a black-to-white jump in quarter speed fades in over 8 frames instead of at once
    const SL = fake({ id: -7, speed: .25 }); RT[-7] = {};
    const src = document.createElement('canvas'); src.width = 8; src.height = 8; const sx = src.getContext('2d');
    const paint = c => { sx.fillStyle = c; sx.fillRect(0, 0, 8, 8); };
    const val0 = cvs => cvs.getContext('2d').getImageData(4, 4, 1, 1).data[0];
    FB_LIVE = true; const seq = []; paint('#000');
    for (let i = 0; i < 4; i++) frameBlend(SL, src, 8, 8, i / 60);
    paint('#fff'); for (let i = 4; i < 13; i++) { const o = frameBlend(SL, src, 8, 8, i / 60); seq.push(o === src ? 255 : val0(o)); }
    // at full speed nothing is blended; paused (not live) neither
    const SN = fake({ id: -8, speed: 1 }); RT[-8] = {}; const full = frameBlend(SN, src, 8, 8, 1) === src && frameBlend(SN, src, 8, 8, 1 + 1 / 60) === src;
    FB_LIVE = false; const paused = frameBlend(SL, src, 8, 8, 2) === src;
    delete RT[-7]; delete RT[-8];
    step('frameBlend', { fadeIn: seq, fullSpeedUntouched: full, pausedUntouched: paused,
      works: near(seq[0], 80, 4) && seq[7] >= 240 && seq.every((v, i) => !i || v >= seq[i - 1]) && full && paused });

    // ---- 8. saved and reopened: curve, keep pitch and freeze frames are kept
    const VS = byId(V.id); VS.curve = { name: 'bullet', pts: CURVES.bullet.pts.map(q => [...q]) }; VS.keepPitch = false; VS.smoothSlow = true; commit();
    S.sel = VS.id; refresh(); seek(1); $('#inspector [data-act=freeze]').click();
    const lenBefore = S.layers.map(x => +len(x).toFixed(3)).join();
    PROJ.path = dir + 'speed.lumina'; await saveProject();
    S.layers = []; for (const k in RT) delete RT[k]; refresh();
    await openProject(dir + 'speed.lumina');
    const VR = S.layers.find(x => x.kind === 'video' && !x.freeze && x.curve), FR = S.layers.find(x => x.freeze), lenAfter = S.layers.map(x => +len(x).toFixed(3)).join();
    step('reopened', { curve: VR?.curve?.name, keepPitch: String(VR?.keepPitch), smoothSlow: VR?.smoothSlow, freeze: !!FR, lens: [lenBefore, lenAfter], freezeTrim: +fLen.toFixed(2),
      works: !!VR && VR.keepPitch === false && VR.smoothSlow === true && !!FR && lenBefore === lenAfter && near(fLen, 1.5, 1e-9) });

    // speed of a curved clip: rebuilding its time map
    const SP = fake({ out: 600, curve: { name: 'montage', pts: CURVES.montage.pts } }); const tq = performance.now(); len(SP); const mapMs = performance.now() - tq;
    step('mapSpeed', { tenMinuteClipMs: +mapMs.toFixed(1), works: mapMs < 400 });

    // ---- 9. C5 ripple editing, on picture clips A [0,2], B [2,5], C [5,7], text T [5.5,6.5], T2 [3,4] (inside B),
    // an impact at 6 and a bookmark at 6.2 (the speed-test layers are cleared first)
    S.layers = []; for (const k in RT) delete RT[k]; S.impacts = []; S.bookmarks = []; refresh();
    const card = await makeCard(['200,60,60', '60,200,60', '60,60,200'], 'rcard.png', false);
    card.__path = await lumina.saveExport(await card.arrayBuffer(), 'rcard.png', dir + 'rcard.png');
    const pic = async (name, start, dur) => { const P = await load(card); Object.assign(P, { name, start, dur }); return P; };
    const RA = await pic('A', 0, 2), RB = await pic('B', 2, 3), RC = await pic('C', 5, 2);
    addText(); const RT1 = selLayer(); Object.assign(RT1, { name: 'T', start: 5.5, dur: 1 }); addText(); const RT2 = selLayer(); Object.assign(RT2, { name: 'T2', start: 3, dur: 1 });
    S.impacts.push({ id: 99801, t: 6, strength: .2, dur: .1 }); S.bookmarks.push({ id: 99802, t: 6.2, note: '', color: '#ffffff', dur: 0 }); commit(); refresh();
    const starts = () => Object.fromEntries(S.layers.map(x => [x.name, +x.start.toFixed(3)]).concat([['imp', +S.impacts[0].t.toFixed(3)], ['bm', +S.bookmarks[0].t.toFixed(3)]]));
    const lenB = () => +len(byId(RB.id)).toFixed(3);
    // Ripple off: deleting B leaves a gap
    setRipple(false); S.sel = RB.id; del(); const offDel = starts(); undo();
    // the toolbar button turns it on (and remembers it)
    $('#btnRipple').click(); const btn = { on: rippleOn, lit: $('#btnRipple').classList.contains('primary'), saved: localStorage.getItem('lumina.ripple') };
    S.sel = RB.id; del(); const onDel = starts(); undo();
    step('rippleDelete', { off: offDel, on: onDel, button: btn,
      works: offDel.C === 5 && btn.on && btn.lit && btn.saved === '1' && onDel.C === 2 && onDel.T === 2.5 && onDel.T2 === 3 && onDel.imp === 3 && onDel.bm === 3.2 && onDel.A === 0 });

    // trims with the mouse: dragging B's right edge 1 s left pulls C, T, the impact and the bookmark 1 s earlier (live, while dragging);
    // dragging it 1 s right pushes them later; trimming B's start keeps B at 2 s, and its keyframe slides with its content
    const tl = $('#tl'), cap = tl.setPointerCapture; tl.setPointerCapture = () => {};
    S.pps = 60; refresh();
    const xAt = t => $('#tlin').getBoundingClientRect().left + HEADW + t * S.pps;
    const dragEdge = (id, side, from, to) => {
      const h = document.querySelector(`.trow[data-id="${id}"] .bar .h.${side}`), y = h.getBoundingClientRect().top + 5;
      h.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: xAt(from), clientY: y, pointerId: 1, button: 0 }));
      tl.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, clientX: xAt(to), clientY: y, pointerId: 1, shiftKey: true }));
      const live = starts();
      tl.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, clientX: xAt(to), clientY: y, pointerId: 1 }));
      return live;
    };
    const liveShort = dragEdge(RB.id, 'r', 5, 4); const shortened = { ...starts(), lenB: lenB() }; undo();
    dragEdge(RB.id, 'r', 5, 6); const longer = { ...starts(), lenB: lenB() }; undo();
    const B0 = byId(RB.id); B0.keys.opacity = [{ t: 1, v: .5, ease: 'smooth' }, { t: 2, v: 1, ease: 'smooth' }]; commit(); refresh();
    dragEdge(RB.id, 'l', 2, 2.5); const headB = byId(RB.id), head = { ...starts(), lenB: lenB(), keyTimes: headB.keys.opacity.map(k => +k.t.toFixed(3)) }; undo(); undo();
    step('rippleTrim', { liveWhileDragging: liveShort, shortened, lengthened: longer, headTrim: head,
      works: liveShort.C === 4 && shortened.lenB === 2 && shortened.C === 4 && shortened.T === 4.5 && shortened.imp === 5 && shortened.bm === 5.2
        && longer.lenB === 4 && longer.C === 6 && longer.T === 6.5 && head.B === 2 && head.lenB === 2.5 && head.C === 4.5 && head.keyTimes.join() === '0.5,1.5' });

    // a split frees nothing; moving a clip never ripples
    const rbS = rippleSpans(); seek(3.5); S.sel = RB.id; split(); rippleFinish(rbS); const afterSplit = starts(); undo();
    const Cm = byId(RC.id), mbar = document.querySelector(`.trow[data-id="${Cm.id}"] .bar`), my = mbar.getBoundingClientRect().top + 5;
    mbar.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: xAt(6), clientY: my, pointerId: 1, button: 0 }));
    tl.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, clientX: xAt(5.5), clientY: my, pointerId: 1, shiftKey: true }));
    tl.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, clientX: xAt(5.5), clientY: my, pointerId: 1 }));
    const afterMove = starts(); undo(); tl.setPointerCapture = cap;
    step('rippleSplitMove', { afterSplit, afterMove,
      works: afterSplit.C === 5 && afterSplit.T === 5.5 && afterMove.C === 4.5 && afterMove.T === 5.5 && afterMove.imp === 6 });

    // a speed change or a speed curve on a video changes its length: the clip after it follows
    const RV = await load(await makeRamp(3)); for (let i = 0; i < 40 && !(MEDIA[RV.media].duration > 2); i++) await new Promise(r => setTimeout(r, 100));
    S.layers.filter(x => x.kind === 'image' || x.kind === 'text').forEach(x => x.start += 10);
    RV.start = 0; const nextAt = () => +byId(RC.id).start.toFixed(3), firstPic = () => byId(RA.id);
    firstPic().start = len(RV); commit(); refresh();
    const vEnd0 = len(RV), aStart0 = firstPic().start;
    S.sel = RV.id; setRightTab('props'); refresh(); const sp = $('#f-speed'); sp.value = 2; sp.dispatchEvent(new Event('input', { bubbles: true })); sp.dispatchEvent(new Event('change', { bubbles: true }));
    const aAfterSpeed = +firstPic().start.toFixed(3), vLen2 = +len(byId(RV.id)).toFixed(3);
    const cv0 = $('#v-curve'); cv0.value = 'bullet'; cv0.dispatchEvent(new Event('input', { bubbles: true })); cv0.dispatchEvent(new Event('change', { bubbles: true }));
    const aAfterCurve = +firstPic().start.toFixed(3), vLenC = +len(byId(RV.id)).toFixed(3);
    step('rippleSpeed', { videoLen: [+vEnd0.toFixed(3), vLen2, vLenC], nextClipStart: [+aStart0.toFixed(3), aAfterSpeed, aAfterCurve],
      works: Math.abs(aAfterSpeed - vLen2) < .002 && Math.abs(aAfterCurve - vLenC) < .002 && vLenC > vLen2 });
    setRipple(false);

    // ---- 10. C6 multi-select, on picture clips A [0,2], B [2,5], C [5,7] and a text MT [1,2]
    S.layers = []; for (const k in RT) delete RT[k]; S.impacts = []; S.bookmarks = []; clearMulti(); refresh();
    const MA = await pic('A', 0, 2), MB = await pic('B', 2, 3), MC = await pic('C', 5, 2);
    addText(); const MT = selLayer(); Object.assign(MT, { name: 'MT', start: 1, dur: 1 }); clearMulti(); S.sel = null; S.pps = 60; commit(); refresh();
    tl.setPointerCapture = () => {};
    const ev = (el, type, t, y, o = {}) => el.dispatchEvent(new PointerEvent(type, { bubbles: true, clientX: xAt(t), clientY: y, pointerId: 1, button: 0, ...o }));
    const rowY = id => { const r = document.querySelector(`.trow[data-id="${id}"]`).getBoundingClientRect(); return r.top + r.height / 2; };
    const barOf = id => document.querySelector(`.trow[data-id="${id}"] .bar`);
    const click = (id, t, o = {}) => { ev(barOf(id), 'pointerdown', t, rowY(id), o); ev(tl, 'pointerup', t, rowY(id)); };
    const names = () => selIds().map(id => byId(id).name).sort().join();
    const spans = () => Object.fromEntries(S.layers.map(x => [x.name, [+x.start.toFixed(3), +len(x).toFixed(3)]]));
    // Ctrl+click adds and removes; the rows show it
    click(MA.id, 1); click(MC.id, 6, { ctrlKey: true }); const ctrl2 = names(), lit = document.querySelectorAll('.trow.msel, .trow.mmain').length, mainC = S.sel === MC.id;
    const info = $('#inspector').textContent.includes('2 clips selected');
    click(MA.id, 1, { ctrlKey: true }); const ctrl1 = names();
    // Shift+click selects every row from the main clip to the clicked one
    click(MA.id, 1); click(MC.id, 6, { shiftKey: true }); const iA = S.layers.indexOf(byId(MA.id)), iC = S.layers.indexOf(byId(MC.id));
    const shiftWant = S.layers.slice(Math.min(iA, iC), Math.max(iA, iC) + 1).map(x => x.name).sort().join(), shiftGot = names();
    step('multiClick', { ctrl2, ctrl1, rowsLit: lit, mainIsC: mainC, inspector: info, shift: shiftGot, shiftWant,
      works: ctrl2 === 'A,C' && lit === 2 && mainC && info && ctrl1 === 'C' && shiftGot === shiftWant && shiftGot.split(',').length >= 2 });

    // a box dragged over empty timeline (from 3 s on A's row to 6 s on C's row) selects the clips it touches; the playhead stays put
    clearMulti(); S.sel = null; seek(.5); refresh();
    const yA = rowY(MA.id), yC = rowY(MC.id), laneA = document.querySelector(`.trow[data-id="${MA.id}"] .lane`);
    ev(laneA, 'pointerdown', 3, yA); ev(tl, 'pointermove', 4.5, (yA + yC) / 2); const boxShown = !!$('#selbox');
    ev(tl, 'pointermove', 6, yC); const boxSel = names(); ev(tl, 'pointerup', 6, yC);
    const iMin = Math.min(S.layers.indexOf(byId(MA.id)), iC), iMax = Math.max(S.layers.indexOf(byId(MA.id)), iC);
    const boxWant = S.layers.slice(iMin, iMax + 1).filter(x => x.start < 6 && x.start + len(x) > 3).map(x => x.name).sort().join();
    const afterBox = { sel: names(), time: +S.time.toFixed(3), boxGone: !$('#selbox') };
    // a plain click in a lane still moves the playhead
    const laneA2 = document.querySelector(`.trow[data-id="${MA.id}"] .lane`);   // the timeline was rebuilt: find the lane again
    ev(laneA2, 'pointerdown', 4, rowY(MA.id)); ev(tl, 'pointerup', 4, rowY(MA.id)); const clickTime = +S.time.toFixed(3);
    step('multiBox', { boxShown, live: boxSel, want: boxWant, after: afterBox, laneClickTime: clickTime,
      works: boxShown && boxSel === boxWant && boxWant.includes('B') && boxWant.includes('C') && !boxWant.includes('A') && afterBox.sel === boxWant && afterBox.time === .5 && afterBox.boxGone && clickTime === 4 });

    // B and C move together (Shift: no snapping); they stop together at 0
    setMulti([MB.id, MC.id], MB.id); refresh();
    const dragBar = (id, from, to, cls) => { const el = cls ? barOf(id).querySelector('.h.' + cls) : barOf(id); ev(el, 'pointerdown', from, rowY(id)); ev(tl, 'pointermove', to, rowY(id), { shiftKey: true }); ev(tl, 'pointerup', to, rowY(id)); };
    dragBar(MB.id, 3, 4); const moved = spans(), keptGroup = names(); undo();
    setMulti([MB.id, MC.id], MB.id); refresh(); dragBar(MB.id, 3, -2); const clamped = spans(); undo();
    // a click (no drag) on a clip in the group keeps just that clip
    setMulti([MB.id, MC.id], MB.id); refresh(); click(MB.id, 3); const oneLeft = names();
    step('multiMove', { moved, keptGroup, clamped, clickOne: oneLeft,
      works: moved.B[0] === 3 && moved.C[0] === 6 && moved.A[0] === 0 && keptGroup === 'B,C' && clamped.B[0] === 0 && clamped.C[0] === 3 && oneLeft === 'B' });

    // trims: C's right edge 1 s in shortens B and C by 1 s; B's head 0.5 s in trims both heads
    setMulti([MB.id, MC.id], MC.id); refresh(); dragBar(MC.id, 7, 6, 'r'); const trimR = spans(); undo();
    setMulti([MB.id, MC.id], MB.id); refresh(); dragBar(MB.id, 2, 2.5, 'l'); const trimL = spans(); undo();
    step('multiTrim', { rightEdge: trimR, head: trimL,
      works: trimR.B[1] === 2 && trimR.C[1] === 1 && trimR.C[0] === 5 && trimR.A[1] === 2 && trimL.B[0] === 2.5 && trimL.B[1] === 2.5 && trimL.C[0] === 5.5 && trimL.C[1] === 1.5 });

    // Delete removes the whole group in one undo step; with Ripple on the gaps close together
    setMulti([MA.id, MC.id], MA.id); del(); const delLeft = S.layers.map(x => x.name).sort().join(); undo(); const back = S.layers.length;
    setRipple(true); setMulti([MA.id, MB.id], MB.id); del(); const ripDel = spans(); undo(); setRipple(false);
    // Ctrl+A selects every clip, Esc keeps just the main one
    S.sel = MB.id; clearMulti(); document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', ctrlKey: true, bubbles: true })); const all = selIds().length;
    document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); const esc1 = names();
    step('multiDelete', { deleted: delLeft, undoBack: back, rippleDelete: ripDel, ctrlA: all, escape: esc1,
      works: delLeft === 'B,MT' && back === 4 && ripDel.C?.[0] === 0 && ripDel.MT?.[0] === 1 && !ripDel.A && all === 4 && esc1 === 'B' });
    tl.setPointerCapture = cap;

    // ---- 11. C7 mask shapes. First the outlines themselves, on a 400 x 400 box centred at (200, 200)
    const mc = document.createElement('canvas').getContext('2d');
    const inMask = (shape, pts, p = {}) => { const L = { start: 0, keys: {}, p, mask: { shape } }; mc.setTransform(1, 0, 0, 1, 200, 200); maskPath(mc, L, 0, 400, 400); mc.setTransform(1, 0, 0, 1, 0, 0); return pts.map(([x, y]) => mc.isPointInPath(200 + x, 200 + y) ? 1 : 0).join(''); };
    // each list: points that should be inside (1) or outside (0); the default mask is 240 x 240
    const shapeChecks = {
      rect: [inMask('rect', [[100, 100], [130, 0]]), '10'],
      rectTurned: [inMask('rect', [[150, 0], [100, 100]], { maskRot: 45 }), '10'],
      ellipse: [inMask('ellipse', [[110, 0], [100, 100]]), '10'],
      diamond: [inMask('diamond', [[50, 50], [80, 80], [0, -110]]), '101'],
      star: [inMask('star', [[0, 0], [0, -100], [Math.cos(-.3 * Math.PI) * 80, Math.sin(-.3 * Math.PI) * 80]]), '110'],
      heart: [inMask('heart', [[-60, -48], [60, -48], [0, 100], [0, -110], [100, 100]]), '11100'],
      split: [inMask('split', [[0, -150], [190, -5], [0, 10]]), '110'],
      splitTurned: [inMask('split', [[100, 0], [-100, 0]], { maskRot: 90 }), '10'],
      bars: [inMask('bars', [[180, 0], [-190, 100], [0, 150]]), '110'],
    };
    // then on screen: a white picture over black, one shape at a time
    S.layers = []; for (const k in RT) delete RT[k]; clearMulti(); refresh();
    const white = await makeCard(Array(6).fill('255,255,255'), 'mwhite.png', false);
    white.__path = await lumina.saveExport(await white.arrayBuffer(), 'mwhite.png', dir + 'mwhite.png');
    const MK = await load(white); Object.assign(MK, { start: 0, dur: 5 }); S.sel = MK.id; setRightTab('props'); refresh();
    const lit2 = async pts => { await settle(1); return pts.map(([x, y]) => { const c = pix(x, y); return c[0] > 180 && c[1] > 180 ? 'w' : c[0] > 180 ? 'r' : c[0] < 80 ? 'k' : '?'; }).join(''); };
    const setMask = (m, p = {}) => { MK.mask = { on: true, invert: false, ...m }; Object.assign(MK.p, { maskX: 0, maskY: 0, maskW: .6, maskH: .6, maskRot: 0, feather: 0, maskStroke: 0 }, p); commit(); };
    setMask({ shape: 'star' }); const starPx = await lit2([[.5, .5], [.5, .25], [.5 + Math.cos(-.3 * Math.PI) * .24, .5 + Math.sin(-.3 * Math.PI) * .24], [.05, .05]]);
    setMask({ shape: 'split' }); const splitPx = await lit2([[.5, .3], [.5, .7]]);
    setMask({ shape: 'split', invert: true }); const splitInv = await lit2([[.5, .3], [.5, .7]]);
    setMask({ shape: 'bars' }); const barsPx = await lit2([[.03, .5], [.5, .1], [.5, .9]]);
    setMask({ shape: 'rect', color: '#ff0000' }, { maskStroke: 20 }); const strokePx = await lit2([[.7, .5], [.8, .5], [.9, .5]]);
    setMask({ shape: 'heart' }, { feather: 60 }); await settle(1); const fm = pix(.5, .5)[0], fEdge = pix(.5, .5 + .3 * .99)[0];
    // the panel: seven shapes; Split hides width and height, bars hides width; there's an outline colour
    setMask({ shape: 'rect' }); inspector();
    const menuM = [...$('#m-shape').options].map(o => o.value).join();
    const rowsFor = sh => { const s = $('#m-shape'); s.value = sh; s.dispatchEvent(new Event('input', { bubbles: true })); return ['maskW', 'maskH', 'maskRot', 'maskStroke'].filter(p => document.querySelector(`#inspector .prow[data-p="${p}"]`)).join(); };
    const rowsRect = rowsFor('rect'), rowsSplit = rowsFor('split'), rowsBars = rowsFor('bars'), colorIn = !!$('#m-col');
    step('maskShapes', { shapes: shapeChecks, star: starPx, split: splitPx, splitInvert: splitInv, bars: barsPx, outline: strokePx, featherCentreEdge: [fm, fEdge],
      menu: menuM, rows: { rect: rowsRect, split: rowsSplit, bars: rowsBars }, colorInput: colorIn,
      works: Object.values(shapeChecks).every(([g, w]) => g === w) && starPx === 'wwkk' && splitPx === 'wk' && splitInv === 'kw' && barsPx === 'wkk'
        && strokePx === 'wrk' && fm > 200 && fEdge < fm - 40 && menuM === 'rect,ellipse,diamond,star,heart,split,bars'
        && rowsRect === 'maskW,maskH,maskRot,maskStroke' && rowsSplit === 'maskRot,maskStroke' && rowsBars === 'maskH,maskRot,maskStroke' && colorIn });

    // ---- 12. C8 canvas background: a tall white picture in the middle of the frame, the sides show the background
    S.layers = []; for (const k in RT) delete RT[k]; clearMulti(); refresh();
    const tc = document.createElement('canvas'); tc.width = 400; tc.height = 1080; const tx = tc.getContext('2d'); tx.fillStyle = '#fff'; tx.fillRect(0, 0, 400, 1080);
    const tall = new File([await new Promise(r => tc.toBlob(r))], 'tall.png', { type: 'image/png' });
    tall.__path = await lumina.saveExport(await tall.arrayBuffer(), 'tall.png', dir + 'tall.png');
    const TP = await load(tall); Object.assign(TP, { start: 0, dur: 5, cover: false }); S.sel = TP.id; setRightTab('props'); commit(); refresh();
    const side = async () => { await settle(1); return [pix(.03, .05), pix(.97, .95), pix(.5, .5)].map(c => c.slice(0, 3)); };
    const setBg = (m, extra = {}) => { Object.assign(S.global, { bg: m, bgColor: '#202020', bgColor2: '#6a3cff', bgAngle: 90, bgBlur: 40, bgDim: .25 }, extra); };
    setBg('black'); const bgBlack = await side();
    setBg('color', { bgColor: '#ff0000' }); const bgColor = await side();
    setBg('gradient', { bgColor: '#ff0000', bgColor2: '#0000ff', bgAngle: 90 }); const bgGrad = await side();
    setBg('blur', { bgDim: 0 }); const bgBlur = await side();
    setBg('blur', { bgDim: .5 }); const bgBlurDim = await side();
    // with no picture or video playing, Blurred video falls back to black
    TP.start = 10; const bgNone = (await side())[0]; TP.start = 0;
    // the panel: the menu, and the rows each mode shows; choosing from the menu redraws the panel
    setBg('black'); S.sel = TP.id; inspector();
    const bgMenu = [...$('#g-bg').options].map(o => o.value).join();
    const bgRows = m => { const s = $('#g-bg'); s.value = m; s.dispatchEvent(new Event('input', { bubbles: true })); return ['g-bgc', 'g-bgc2', 'g-bga', 'g-bgb', 'g-bgd'].filter(id => document.getElementById(id)).join(); };
    const rowsBg = { black: bgRows('black'), color: bgRows('color'), gradient: bgRows('gradient'), blur: bgRows('blur') }, chosen = S.global.bg;
    // kept in a saved project
    setBg('gradient', { bgColor: '#123456' }); PROJ.path = dir + 'bg.lumina'; await saveProject();
    S.global = { vignette: 0, grade: 'none', letterbox: 0 }; await openProject(dir + 'bg.lumina'); const kept = [S.global.bg, S.global.bgColor].join();
    const isK = c => c.every(v => v < 20), isW = c => c.every(v => v > 230);
    step('canvasBg', { black: bgBlack, color: bgColor, gradient: bgGrad, blur: bgBlur, blurDarkened: bgBlurDim, blurNoClip: bgNone, menu: bgMenu, rows: rowsBg, chosen, kept,
      works: isK(bgBlack[0]) && isW(bgBlack[2]) && bgColor[0][0] > 240 && bgColor[0][2] < 20 && bgColor[1][0] > 240 && isW(bgColor[2])
        && bgGrad[0][0] > 200 && bgGrad[0][2] < 60 && bgGrad[1][2] > 200 && bgGrad[1][0] < 60 && isW(bgGrad[2])
        && bgBlur[0][0] > 200 && bgBlur[1][0] > 200 && Math.abs(bgBlurDim[0][0] - 128) < 25 && isW(bgBlurDim[2]) && isK(bgNone.slice(0, 3))
        && bgMenu === 'black,color,gradient,blur' && rowsBg.black === '' && rowsBg.color === 'g-bgc' && rowsBg.gradient === 'g-bgc,g-bgc2,g-bga' && rowsBg.blur === 'g-bgb,g-bgd'
        && chosen === 'blur' && kept === 'gradient,#123456' });
    setBg('black');

    // ---- 13. C9 captions: SRT and VTT files become one caption clip
    const srt = '﻿1\r\n00:00:00,500 --> 00:00:02,000\r\n<i>Hello</i> there\r\n\r\n2\r\n00:00:02,500 --> 00:00:04,250\r\n{\\an8}Second line\r\nwraps here\r\n\r\n3\r\n00:00:05,000 --> 00:00:06,000\r\nTom &amp; Jerry\r\n';
    const vtt = 'WEBVTT\n\nNOTE this is a comment\n\nintro\n00:01.000 --> 00:02.500 align:center line:90%\n<v Sam>First</v>\n\n01:00:00.000 --> 01:00:01.000\nOne hour in\n';
    const pS = parseCaptions(srt), pV = parseCaptions(vtt);
    const parsed = { srt: pS.map(c => `${c.t0}-${c.t1}:${c.text}`), vtt: pV.map(c => `${c.t0}-${c.t1}:${c.text}`) };
    const parseOk = parsed.srt.join('|') === '0.5-2:Hello there|2.5-4.25:Second line\nwraps here|5-6:Tom & Jerry' && parsed.vtt.join('|') === '1-2.5:First|3600-3601:One hour in';
    S.layers = []; for (const k in RT) delete RT[k]; clearMulti(); refresh(); S.global.bg = 'black';
    const sf = new File([srt], 'talk.srt', { type: '' }); addFiles([sf]);
    for (let i = 0; i < 30 && !S.layers.length; i++) await new Promise(r => setTimeout(r, 50));
    const CL = S.layers[0], made = CL && { kind: CL.kind, name: CL.name, cues: CL.cues.length, dur: CL.dur, sel: S.sel === CL.id };
    // on screen: words (white) in the bottom band while a line is on, nothing in the gap between lines
    const bright = async t => { await settle(t); const y0 = Math.round(H() * .75), d = ctx.getImageData(0, y0, W(), Math.round(H() * .2)).data; let n = 0; for (let i = 0; i < d.length; i += 16) if (d[i] > 200 && d[i + 1] > 200 && d[i + 2] > 200) n++; return n; };
    const on1 = await bright(1.2), gap = await bright(2.25), on3 = await bright(5.5), afterEnd = await bright(6.05);
    // the panel lists every line; typing in one changes it; the box option hides its opacity row
    S.sel = CL.id; setRightTab('props'); refresh();
    const listRows = document.querySelectorAll('#inspector .capln').length, ta = $('#c-t-0'); ta.value = 'Hi there'; ta.dispatchEvent(new Event('input', { bubbles: true }));
    const edited = CL.cues[0].text, noTextBox = !$('#f-text');
    const bx = $('#c-box'); bx.checked = false; bx.dispatchEvent(new Event('input', { bubbles: true })); const boxOff = CL.capBox === false && !$('#c-boxa');
    $('#c-box').click(); const boxOn = CL.capBox === true && !!$('#c-boxa');
    // add a line in the gap at 4.5 s; refused where a line already is
    seek(4.4); $('#inspector [data-act=capadd]').click(); const addedAt = CL.cues.map(c => +c.t0.toFixed(2)).join(), addedEnd = +CL.cues.find(c => near(c.t0, 4.4, .01))?.t1.toFixed(2);
    seek(1); const nBefore = CL.cues.length; $('#inspector [data-act=capadd]').click(); const refused = CL.cues.length === nBefore;
    // splitting at 3 s: line 2 (2.5-4.25) is shown by both halves; times stay put on screen
    seek(3); S.sel = CL.id; split();
    const A1 = byId(CL.id), A2 = selLayer(), halves = [A1.cues.map(c => `${c.t0}-${c.t1}`).join(), A2.cues.map(c => `${+c.t0.toFixed(3)}-${+c.t1.toFixed(3)}`).join()];
    const splitText = await bright(3.5) > 0 && await bright(5.5) > 0; undo();
    // trimming the head by 1 s: the lines stay where they are on the timeline
    const TL = byId(CL.id), st = clipState(TL); trimHead(st, 1, false); const trimmed = [TL.start, TL.dur, TL.cues[0].t0, TL.cues[1].t0].map(v => +v.toFixed(3)).join(); const trimText = await bright(5.5) > 0; commit(); undo();
    // SRT out and back in gives the same lines in comp time
    const RL = byId(CL.id); RL.start = 2; const srtBack = parseCaptions(captionsSRT(RL)).map(c => `${c.t0}-${c.t1}:${c.text}`).join('|'); RL.start = 0; commit();
    // kept in a saved project
    PROJ.path = dir + 'caps.lumina'; await saveProject(); await openProject(dir + 'caps.lumina');
    const reopened = S.layers.find(x => x.cues), keptCues = reopened ? reopened.cues.length + ':' + reopened.cues[0].text + ':' + reopened.capBox : 'none';
    // bad file: no captions, nothing added
    const nL = S.layers.length; importCaptions('just some text', 'notes.srt'); const badIgnored = S.layers.length === nL;
    step('captions', { parsed, made, onScreen: { line1: on1, gap, line3: on3, afterEnd }, listRows, edited, noTextBox, boxOff, boxOn, addedAt, addedEnd, refused, halves, splitText, trimmed, trimText, srtRoundTrip: srtBack, keptCues, badIgnored,
      works: parseOk && made?.kind === 'text' && made.name === 'Captions · talk' && made.cues === 3 && made.dur === 6 && made.sel && on1 > 20 && gap === 0 && on3 > 20 && afterEnd === 0
        && listRows === 3 && edited === 'Hi there' && noTextBox && boxOff && boxOn && addedAt === '0.5,2.5,4.4,5' && addedEnd === 5 && refused
        && halves[0] === '0.5-2,2.5-3' && halves[1] === '0-1.25,1.4-2,2-3' && splitText && trimmed === '1,5,-0.5,1.5' && trimText
        && srtBack === '2.5-4:Hi there|4.5-6.25:Second line\nwraps here|6.4-7:New caption|7-8:Tom & Jerry' && keptCues === '4:Hi there:true' && badIgnored });

    // ---- 14. C9 auto captions: Whisper on a spoken test clip (made with Windows' text to speech, see ROADMAP)
    // line splitting first: a 9-second sentence of 13 words becomes lines of at most 42 letters, back to back, covering 1-10 s
    const sl = speechLines([{ text: ' one two three four five six seven eight nine ten eleven twelve thirteen', timestamp: [1, 10] }, { text: 'tail', timestamp: [10, null] }]);
    const slOk = sl.length >= 3 && sl.every(c => c.text.length <= 42) && near(sl[0].t0, 1, 1e-9) && sl.slice(1).every((c, i) => near(c.t0, sl[i].t1, 1e-9)) && sl.some(c => near(c.t1, 10, 1e-9)) && sl.at(-1).text === 'tail' && sl.at(-1).t1 > 10;
    S.layers = []; for (const k in RT) delete RT[k]; clearMulti(); refresh();
    const st0 = await lumina.speechStatus();
    const wavPath = dir + 'speech.wav', wav = new File([await (await fetch(lumina.mediaURL(wavPath))).arrayBuffer()], 'speech.wav', { type: 'audio/wav' }); wav.__path = wavPath;
    const SA = await load(wav); SA.start = 1;
    for (let i = 0; i < 40 && !(MEDIA[SA.media].duration > 5); i++) await new Promise(r => setTimeout(r, 100));
    S.sel = SA.id; setRightTab('props'); refresh();
    const acPanel = !!$('#ac-lang') && !!$('#inspector [data-act=autocap]'), acLabel = $('#inspector [data-act=autocap]')?.textContent;
    const lg = $('#ac-lang'); lg.value = 'english'; lg.dispatchEvent(new Event('input', { bubbles: true }));
    const tA = performance.now(); const CC = await autoCaptions(SA); const acSecs = +((performance.now() - tA) / 1000).toFixed(1);
    const st1 = await lumina.speechStatus();
    const heard = CC ? CC.cues.map(c => c.text).join(' ') : '', low = heard.toLowerCase();
    const words = ['hello', 'welcome', 'lumina', 'testing', 'captions', 'last sentence'].filter(w => low.includes(w));
    const timing = CC && CC.cues.map(c => [+c.t0.toFixed(2), +c.t1.toFixed(2)]);
    const timeOk = !!CC && CC.start === 1 && CC.cues.every((c, i) => c.t0 >= 0 && c.t1 <= len(SA) + 1e-6 && c.t1 > c.t0 && (!i || c.t0 >= CC.cues[i - 1].t0)) && CC.cues[0].t0 < 1.5 && CC.cues.at(-1).t1 > len(SA) - 3;
    // on screen while the first line plays
    const acShown = CC ? await bright(CC.start + CC.cues[0].t0 + .4) : 0;
    step('autoCaptions', { lineSplit: sl.map(c => `${c.t0.toFixed(2)}-${c.t1.toFixed(2)}:${c.text}`), modelWasReady: st0.ready, modelReady: st1.ready, panel: acPanel, buttonBefore: acLabel, seconds: acSecs, workerMs: CC?.autoMs,
      clipLen: +len(SA).toFixed(2), heard, words, timing, shown: acShown, sel: S.sel === CC?.id,
      works: slOk && st1.ready && acPanel && !!CC && words.length >= 5 && timeOk && acShown > 20 && S.sel === CC.id && !acBusy });

    // ---- 15. C10 stickers and the new shapes. Everything sits in the middle of a black frame; ssP(dx, dy) reads the
    // pixel dx, dy away from the middle, in 1080p units
    S.layers = []; for (const k in RT) delete RT[k]; clearMulti(); S.global.bg = 'black'; seek(0); refresh();
    const sP = (dx, dy) => pix(.5 + dx * H() / 1080 / W(), .5 + dy / 1080);
    const isFill = c => c[0] > 235 && Math.abs(c[1] - 176) < 25 && c[2] < 60, isBlack = c => c.every(v => v < 25), isWhite = c => c.every(v => v > 225);
    const isRed = c => c[0] > 170 && c[1] < 70 && c[2] < 80, isBlue = c => c[2] > 100 && c[0] < 75 && c[2] > c[0] + 40, isYellow = c => c[0] > 200 && c[1] > 160 && c[2] < 90;
    const shapeMenu = SHAPES.map(s => s[0]).join();
    const shapesOk = {};
    for (const s of ['star', 'heart', 'triangle', 'hexagon', 'burst']) {
      addShape(s); const L = selLayer(); await settle(.5);
      const [w, h] = SHAPE_SIZE[s], mid = sP(0, s === 'triangle' ? h * .2 : 0), corner = sP(-w * .46, -h * .46);
      shapesOk[s] = isFill(mid) && isBlack(corner) && L.p.w === w && L.p.h === h;
      S.layers = []; refresh();
    }
    addShape('bubble'); await settle(.5); const BB = selLayer();
    const bubbleOk = isWhite(sP(0, -30)) && isBlack(sP(150, 115)) && isWhite(sP(-99, 105)) && BB.p.strokeW === 6; S.layers = []; refresh();
    // the picker: emoji tabs plus Flags, one button per emoji / flag
    $('#btnSticker').click(); const popOpen = !$('#stickerPop').hidden;
    const tabs = [...document.querySelectorAll('#stickerPop .sttab')].map(b => b.dataset.sttab).join(), emojiBtns = document.querySelectorAll('#stickerPop .stemo').length;
    document.querySelector('#stickerPop [data-sttab=Flags]').click();
    const flagBtns = document.querySelectorAll('#stickerPop .stflag').length, stillOpen = !$('#stickerPop').hidden;
    document.querySelector('#stickerPop [data-flag=fr]').click(); const FRS = selLayer(), popClosed = $('#stickerPop').hidden;
    await settle(.5);
    const frOk = FRS?.flag === 'fr' && FRS.name === 'Flag · France' && FRS.p.w === 300 && FRS.p.h === 200 && isBlue(sP(-100, 0)) && isWhite(sP(0, 0)) && isRed(sP(100, 0)) && isBlack(sP(0, 110));
    // the panel: no outline or corner rows, a Change button that swaps it for Japan and keeps its size
    S.sel = FRS.id; setRightTab('props'); refresh();
    const rows = ['r-w', 'r-h', 'r-strokeW', 'r-radius'].filter(id => document.getElementById(id)).join(), hasPrev = !!$('#inspector .stprev');
    $('#inspector [data-act=stswap]').click(); document.querySelector('#stickerPop [data-sttab=Flags]')?.click(); document.querySelector('#stickerPop [data-flag=jp]').click();
    await settle(.5);
    const swapped = S.layers.length === 1 && FRS.flag === 'jp' && FRS.name === 'Flag · Japan' && FRS.p.h === 200 && isRed(sP(0, 0)) && isWhite(sP(-120, -80));
    // more flags, each checked at a few points
    S.layers = []; refresh();
    const flagAt = async (code, pts) => { stickerTarget = null; addSticker({ flag: code }); await settle(.5); const bad = pts.filter(([dx, dy, f]) => !f(sP(dx, dy))).map(([dx, dy]) => `${dx},${dy}=${sP(dx, dy)}`); S.layers = []; return bad.length ? bad.join(' ') : true; };
    const flagsOk = {
      us: await flagAt('us', [[140, 73, isRed], [140, -73, isRed], [140, -61, isWhite], [-146, -62, isBlue]]),
      gb: await flagAt('gb', [[0, 0, isRed], [-60, -60, isBlue], [0, -20, isRed], [-130, 0, isRed], [-130, -20, isWhite]]),
      de: await flagAt('de', [[0, -60, isBlack], [0, 0, isRed], [0, 60, isYellow]]),
      se: await flagAt('se', [[-120, -60, isBlue], [-37, -60, isYellow], [100, 0, isYellow], [100, 60, isBlue]]),
      ch: await flagAt('ch', [[0, 0, isWhite], [-130, -130, isRed]]),
      eu: await flagAt('eu', [[0, 0, isBlue], [0, -67, isYellow]])
    };
    const allFlagsDraw = Object.keys(FLAGS).every(k => { const cv = stickerImg({ flag: k }); return cv.width > 300 && cv.getContext('2d').getImageData(cv.width >> 1, cv.height >> 2, 1, 1).data[3] === 255; });
    // emoji: drawn in color by the Windows emoji font
    stickerTarget = null; const RE = addSticker({ emoji: '🔴' }); await settle(.5);
    const emojiOk = RE.name === 'Sticker 🔴' && RE.p.w === 240 && RE.p.h === 240 && (c => c[0] > 170 && c[1] < 110 && c[2] < 110)(sP(0, 0)) && isBlack(sP(-118, -118));
    S.layers = []; refresh();
    addSticker({ emoji: '😀' }); await settle(.5);
    let yellowPx = 0; { const d = ctx.getImageData(0, 0, W(), H()).data; for (let i = 0; i < d.length; i += 16) if (isYellow([d[i], d[i + 1], d[i + 2]])) yellowPx++; }
    // any emoji typed in the box: only the first one is used
    $('#btnSticker').click(); const anyIn = $('#st-any'); anyIn.value = '🦩🦩 and text'; $('#stickerPop [data-stany]').click();
    const anyEmoji = selLayer()?.emoji, nAfterAny = S.layers.length;
    $('#btnSticker').click(); $('#st-any').value = ''; $('#stickerPop [data-stany]').click(); const emptyRefused = S.layers.length === nAfterAny; $('#stickerPop').hidden = true;
    // undo takes the last sticker away; a saved project keeps a flag
    undo(); const stUndone = S.layers.length === 1 && S.layers[0].emoji === '😀';
    stickerTarget = null; addSticker({ flag: 'it' }); PROJ.path = dir + 'stickers.lumina'; await saveProject(); await openProject(dir + 'stickers.lumina');
    const stKept = S.layers.map(x => x.flag || x.emoji).join(); await settle(.5); const stKeptDraws = isRed(sP(100, 0));
    const layerMenu = MENUS.Layer().some(m => m[0] === 'New sticker…');
    step('stickers', { shapeMenu, shapes: shapesOk, bubbleOk, popOpen, tabs, emojiBtns, flagBtns, stillOpen, popClosed, france: frOk, rows, hasPrev, swapped, flags: flagsOk, allFlagsDraw, flagCount: Object.keys(FLAGS).length,
      emojiOk, yellowPx, anyEmoji, emptyRefused, stUndone, stKept, stKeptDraws, layerMenu,
      works: shapeMenu === 'rect,ellipse,arrow,line,star,heart,triangle,hexagon,bubble,burst,blur,pixel,fill' && Object.values(shapesOk).every(Boolean) && bubbleOk
        && popOpen && tabs === 'Smileys,Hands,People,Symbols,Nature,Food,Activities,Objects,Travel,Flags' && emojiBtns > 80 && flagBtns === Object.keys(FLAGS).length && stillOpen && popClosed
        && frOk && rows === 'r-w,r-h' && hasPrev && swapped && Object.values(flagsOk).every(v => v === true) && allFlagsDraw && emojiOk && yellowPx > 500
        && anyEmoji === '🦩' && emptyRefused && stUndone && stKept === 'it,😀' && stKeptDraws && layerMenu });

    // ---- 16. C11 separate audio, on a 4-second test video with a 440 Hz tone. How loud Lumina's output is (what goes to
    // the speakers and into saAn export, recDest) is measured with saAn analyser while it plays
    S.layers = []; for (const k in RT) delete RT[k]; clearMulti(); S.global.bg = 'black'; seek(0); refresh();
    audioInit(); await AC.resume().catch(() => {});
    const makeTone = async secs => {
      const c = document.createElement('canvas'); c.width = 320; c.height = 180; const x = c.getContext('2d');
      const osc = AC.createOscillator(), og = AC.createGain(), od = AC.createMediaStreamDestination();
      osc.frequency.value = 440; og.gain.value = .5; osc.connect(og); og.connect(od); osc.start();
      const ms = c.captureStream(30); od.stream.getAudioTracks().forEach(t => ms.addTrack(t));
      const rec = new MediaRecorder(ms, { mimeType: 'video/webm;codecs=vp8,opus' }), ch = [];
      rec.ondataavailable = e => ch.push(e.data); const done = new Promise(r => rec.onstop = r);
      x.fillStyle = '#336'; x.fillRect(0, 0, 320, 180); rec.start(); const t0 = performance.now();
      await new Promise(r => { const i = setInterval(() => { x.fillStyle = (performance.now() / 300 | 0) % 2 ? '#336' : '#363'; x.fillRect(0, 0, 320, 180); if (performance.now() - t0 > secs * 1000) { clearInterval(i); r(); } }, 16); });
      rec.stop(); await done; osc.stop();
      const buf = await new Blob(ch, { type: 'video/webm' }).arrayBuffer();
      const f = new File([buf], 'tone.webm', { type: 'video/webm' }); f.__path = await lumina.saveExport(buf, 'tone.webm', dir + 'tone.webm'); return f;
    };
    const saTV = await load(await makeTone(4)); saTV.start = 0; saTV.cover = true;
    for (let i = 0; i < 40 && !(MEDIA[saTV.media].duration > 3); i++) await new Promise(r => setTimeout(r, 100));
    commit(); refresh();
    const saAn = AC.createAnalyser(); saAn.fftSize = 2048; AC.createMediaStreamSource(recDest.stream).connect(saAn);
    // the loudest moment (RMS) of Lumina's output while playing from t0 for about a second
    const loud = async t0 => {
      pause(); seek(t0); await settle(t0); await play(); const b = new Float32Array(2048); let m = 0;
      for (const end = performance.now() + 1000; performance.now() < end;) { await new Promise(r => setTimeout(r, 50)); saAn.getFloatTimeDomainData(b); let s = 0; for (const v of b) s += v * v; m = Math.max(m, Math.sqrt(s / b.length)); }
      pause(); return +m.toFixed(4);
    };
    const saBefore = await loud(1);
    const sepMenuOn = MENUS.Layer().find(m => m[0] === 'Separate audio')?.[3] === true;
    S.sel = saTV.id; setRightTab('props'); refresh();
    const sepBtn = !!$('#inspector [data-act=sepaudio]'); $('#inspector [data-act=sepaudio]')?.click();
    const saTA = selLayer();
    const saMade = saTA?.kind === 'audio' && saTA.media === saTV.media && saTA.start === saTV.start && saTA.in === saTV.in && saTA.out === saTV.out && saTA.name === 'Audio · tone.webm'
      && saTV.muted === true && saTA.link != null && saTA.link === saTV.link && S.layers.indexOf(saTA) === S.layers.indexOf(saTV) + 1 && RT[saTA.id]?.el?.tagName === 'AUDIO';
    const saMarks = document.querySelectorAll('#tlin .bar .lk').length, linkPanel = /Linked/.test($('#inspector').textContent) && !!$('#inspector [data-act=unlink]');
    const sepMenuOff = MENUS.Layer().find(m => m[0] === 'Separate audio')?.[3] === false;
    const saAfter = await loud(1), saGains = [RT[saTV.id].gain?.gain.value, RT[saTA.id].gain?.gain.value, RT[saTV.id].el.muted];
    // the sound now comes from the audio clip alone: hide it and there's silence (the video really is muted)
    saTA.visible = false; const hiddenA = await loud(1); saTA.visible = true;
    saTA.p.volume = .25; const saQuarter = await loud(1); saTA.p.volume = 1;
    // linked: dragging the video moves its audio too (Shift: no snapping); with Alt, just the video
    S.pps = 60; clearMulti(); S.sel = saTV.id; refresh();
    dragBar(saTV.id, 1, 2); const linkedMove = [+saTV.start.toFixed(3), +saTA.start.toFixed(3)]; undo();
    let saV2 = byId(saTV.id), saA2 = byId(saTA.id); clearMulti(); S.sel = saV2.id; refresh();
    { const el = barOf(saV2.id); ev(el, 'pointerdown', 1, rowY(saV2.id), { altKey: true }); ev(tl, 'pointermove', 2, rowY(saV2.id), { shiftKey: true, altKey: true }); ev(tl, 'pointerup', 2, rowY(saV2.id)); }
    const altMove = [+saV2.start.toFixed(3), +saA2.start.toFixed(3)]; undo();
    // trimming the video's end trims the audio too
    saV2 = byId(saTV.id); saA2 = byId(saTA.id); clearMulti(); S.sel = saV2.id; refresh();
    dragBar(saV2.id, endOf(saV2), 3, 'r'); const linkedTrim = [+endOf(byId(saTV.id)).toFixed(2), +endOf(byId(saTA.id)).toFixed(2)]; undo();
    // splitting splits both: each half of the video stays linked to the matching half of the sound
    saV2 = byId(saTV.id); saA2 = byId(saTA.id); clearMulti(); S.sel = saV2.id; seek(2); split();
    const halvesV = S.layers.filter(x => x.kind === 'video'), halvesA = S.layers.filter(x => x.kind === 'audio');
    const splitPairs = halvesV.map(v => { const m = linkMate(v); return m ? `${v.start.toFixed(2)}=${m.start.toFixed(2)}` : 'none'; }).sort().join();
    const splitOk = S.layers.length === 4 && halvesA.length === 2 && splitPairs === '0.00=0.00,2.00=2.00' && new Set(S.layers.map(x => x.link)).size === 2;
    // deleting one half of the video leaves its sound, unlinked
    const saV2b = halvesV.find(v => v.start > 1), saA2b = linkMate(saV2b); clearMulti(); S.sel = saV2b.id; del();
    const saDelLeft = S.layers.length === 3 && !!byId(saA2b.id) && byId(saA2b.id).link == null && linkMate(byId(saTV.id))?.id === saTA.id;
    undo(); undo();
    // Unlink in the panel; undo links them again
    clearMulti(); S.sel = saTV.id; setRightTab('props'); refresh(); $('#inspector [data-act=unlink]').click();
    const unlinked = byId(saTV.id).link == null && byId(saTA.id).link == null && !!$('#inspector [data-act=sepaudio]');
    undo(); const relinked = linkMate(byId(saTV.id))?.id === saTA.id;
    // the Mute box: unticked, the video's own sound plays again (the audio clip hidden, so only the video is heard)
    clearMulti(); S.sel = saTV.id; refresh(); const saMb = $('#f-mute'), muteBoxOn = saMb?.checked === true;
    saMb.checked = false; saMb.dispatchEvent(new Event('input', { bubbles: true })); saMb.dispatchEvent(new Event('change', { bubbles: true }));
    byId(saTA.id).visible = false; const unmuted = await loud(1); const muteMark = document.querySelectorAll('#tlin .bar .lk').length;
    undo(); byId(saTA.id).visible = true;
    // saved and reopened: still muted, still linked, the audio clip still plays just the sound
    PROJ.path = dir + 'sep.lumina'; await saveProject(); await openProject(dir + 'sep.lumina');
    const saRV2 = S.layers.find(x => x.kind === 'video'), saRA2 = S.layers.find(x => x.kind === 'audio');
    const sepKept = !!saRV2 && !!saRA2 && saRV2.muted === true && linkMate(saRV2) === saRA2 && RT[saRA2.id]?.el?.tagName === 'AUDIO';
    audioInit(); await AC.resume().catch(() => {}); AC.createMediaStreamSource(recDest.stream).connect(saAn);
    const keptLoud = await loud(1);
    step('separateAudio', { saBefore, saAfter, hiddenAudio: hiddenA, quarterVolume: saQuarter, unmuted, keptLoud, saGains, sepMenuOn, sepMenuOff, sepBtn, saMade, saMarks, linkPanel,
      linkedMove, altMove, linkedTrim, splitPairs, splitOk, saDelLeft, unlinked, relinked, muteBoxOn, muteMark, sepKept,
      works: saBefore > .05 && saAfter > .05 && Math.abs(saAfter / saBefore - 1) < .35 && hiddenA < .01 && saQuarter > saAfter * .15 && saQuarter < saAfter * .4 && unmuted > .05 && keptLoud > .05
        && saGains[0] === 0 && saGains[1] > .9 && saGains[2] === true && sepMenuOn && sepMenuOff && sepBtn && saMade && saMarks === 3 && linkPanel
        && linkedMove.join() === '1,1' && altMove.join() === '1,0' && linkedTrim[0] === 3 && linkedTrim[1] === 3 && splitOk && saDelLeft && unlinked && relinked && muteBoxOn && muteMark === 2 && sepKept });

    // ---- 17. C12 clipboard and keyframe tools, through the real system clipboard (the test overwrites it)
    S.layers = []; for (const k in RT) delete RT[k]; clearMulti(); S.global.bg = 'black'; seek(0); refresh();
    const cbWait = async (f, ms = 4000) => { for (let i = 0; i < ms / 50 && !f(); i++) await new Promise(r => setTimeout(r, 50)); return !!f(); };
    const cbKey = (key, o = {}) => document.body.dispatchEvent(new KeyboardEvent('keydown', { key, ctrlKey: true, bubbles: true, cancelable: true, ...o }));
    const cbCard = await makeCard(['255,0,0'], 'red.png', false);
    cbCard.__path = await lumina.saveExport(await cbCard.arrayBuffer(), 'red.png', dir + 'red.png');
    // 20 s long, so the playhead can go to 15 s (it never goes past the end of the project)
    let cbP = await load(cbCard); cbP.start = 0; cbP.dur = 20;
    upsertKey(cbP, 'x', .2, 0); upsertKey(cbP, 'x', .8, 2); upsertKey(cbP, 'opacity', .5, 1); commit();
    // a. Ctrl+C a clip, Ctrl+V at 5 s: a copy with the same length and keyframes
    clearMulti(); S.sel = cbP.id; S.selKey = null; refresh(); cbKey('c'); await new Promise(r => setTimeout(r, 300));
    const cbMark = (await lumina.clipRead()).text === CLIP?.mark && CLIP.kind === 'clips';
    seek(5); cbKey('v'); await cbWait(() => S.layers.length === 2);
    const cbQ = S.layers.find(x => x.id !== cbP.id);
    const clipPasted = !!cbQ && cbQ.start === 5 && cbQ.dur === 20 && cbQ.media === cbP.media && cbQ.keys.x?.length === 2 && cbQ.keys.opacity?.length === 1 && S.sel === cbQ.id && cbQ.name === cbP.name;
    // two clips at once keep their spacing; cut + paste moves a clip
    setMulti([cbP.id, cbQ.id], cbQ.id); cbKey('c'); await new Promise(r => setTimeout(r, 300)); seek(10); cbKey('v'); await cbWait(() => S.layers.length === 4);
    const twoPasted = S.layers.filter(x => x.id !== cbP.id && x.id !== cbQ.id).map(x => x.start).sort((a, b) => a - b).join(); undo();
    cbP = byId(cbP.id);   // undo brings back copies of the clips
    clearMulti(); S.sel = cbQ.id; refresh(); cbKey('x'); await new Promise(r => setTimeout(r, 300));
    const cutGone = S.layers.length === 1; seek(8); cbKey('v'); await cbWait(() => S.layers.length === 2);
    const cbQ2 = S.layers.find(x => x.id !== cbP.id), cutPasted = cutGone && cbQ2?.start === 8;
    // b. text copied in another app is newer than Lumina's copy: it becomes a text clip
    await lumina.clipWrite({ text: 'Hello paste' }); seek(1); cbKey('v'); await cbWait(() => S.layers.length === 3);
    const cbT = S.layers.find(x => x.kind === 'text'), textPasted = cbT?.text === 'Hello paste' && cbT.start === 1;
    // c. a copied picture: saved as a PNG next to the test, then an image clip
    const gC = document.createElement('canvas'); gC.width = 64; gC.height = 32; const gx = gC.getContext('2d'); gx.fillStyle = '#0f0'; gx.fillRect(0, 0, 64, 32);
    await lumina.clipWrite({ png: await (await new Promise(r => gC.toBlob(r))).arrayBuffer() }); seek(2); cbKey('v'); await cbWait(() => S.layers.length === 4);
    const cbI = S.layers.find(x => x.kind === 'image' && x.media !== cbP.media), cbIM = cbI && MEDIA[cbI.media];
    const picPasted = !!cbIM && /\\pasted\\Pasted [\d-]+( \(\d+\))?\.png$/.test(cbIM.path) && cbIM.w === 64 && cbIM.h === 32 && (await lumina.exists([cbIM.path]))[0];
    // d. files copied in Explorer: the picture and the video go in, the script file is turned down
    const furl = p => 'file:///' + p.replace(/\\/g, '/');
    await lumina.clipWrite({ uris: [furl(dir + 'red.png'), furl(dir + 'tone.webm'), furl('D:\\Lumina\\.claude\\speed\\selftest.js')].join('\r\n') });
    seek(3); cbKey('v'); await cbWait(() => S.layers.length === 6);
    const filesPasted = S.layers.length === 6 && S.layers.some(x => x.kind === 'video' && x.name === 'tone.webm') && S.layers.filter(x => x.name === 'red.png').length === 3 && /can't use selftest\.js/.test($('#mText').textContent) && !$('#modal').hidden;
    $('#modal').hidden = true;
    // e. keyframe lanes: the ▸ on the clip's row opens one lane per animated property (Position X and Opacity)
    clearMulti(); S.sel = cbP.id; S.selKey = null; S.pps = 60; refresh();
    const kTog = document.querySelector(`.trow[data-id="${cbP.id}"] [data-ktog]`);
    kTog?.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 1, button: 0 }));
    const lanes = [...document.querySelectorAll(`.trow.klane[data-id="${cbP.id}"]`)], laneProps = lanes.map(r => r.dataset.kp).join();
    const laneKeys = lanes.map(r => r.querySelectorAll('.kd').length).join();
    // pick the X keyframe at 2 s in its lane: only X is picked, Ctrl+C copies just it, Ctrl+V puts it on the copy at 6 s
    const laneKd = (p, t) => document.querySelector(`.trow.klane[data-id="${cbP.id}"][data-kp="${p}"] .kd[data-key="${t}"]`);
    const kdDown = (el, o = {}) => { const q = el.getBoundingClientRect(); el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: q.left + q.width / 2, clientY: q.top + q.height / 2, pointerId: 1, button: 0, ...o })); return q; };
    kdDown(laneKd('x', 2)); tl.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 1 }));
    const pickedX = S.selKP === 'x' && S.selKey === 2 && keysAtSel(cbP).length === 1 && /Keyframe at/.test($('#inspector').textContent);
    cbKey('c'); await new Promise(r => setTimeout(r, 300));
    const keyCopied = CLIP?.kind === 'keys' && Object.keys(CLIP.keys).join() === 'x' && CLIP.keys.x[0].v === .8;
    clearMulti(); S.sel = cbQ2.id; S.selKey = null; refresh(); seek(9); cbKey('v'); await cbWait(() => cbQ2.keys.x.length === 3);
    const keyPasted = cbQ2.keys.x.length === 3 && Math.abs(val(cbQ2, 'x', 9) - .8) < 1e-6 && cbQ2.keys.opacity.length === 1;
    // every keyframe of the clip, onto the text clip at 4 s: X at 4 and 6, Opacity at 5
    clearMulti(); S.sel = cbP.id; refresh(); action('copykeys'); await new Promise(r => setTimeout(r, 300));
    clearMulti(); S.sel = cbT.id; refresh(); seek(4); cbKey('v'); await cbWait(() => cbT.keys.x?.length === 2);
    const allKeys = [cbT.keys.x?.map(k => +(cbT.start + k.t).toFixed(3)).join('/'), cbT.keys.opacity?.map(k => +(cbT.start + k.t).toFixed(3)).join('/')].join(' ');
    // dragging a lane's diamond moves just that property's key (Shift: no snapping)
    clearMulti(); S.sel = cbP.id; refresh();
    { const q = kdDown(laneKd('x', 0)), y = q.top + q.height / 2; tl.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, clientX: q.left + q.width / 2 + 30, clientY: y, pointerId: 1, shiftKey: true })); tl.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 1 })); }
    const laneDrag = [cbP.keys.x.map(k => +k.t.toFixed(2)).join('/'), cbP.keys.opacity.map(k => +k.t.toFixed(2)).join('/')].join(' ');
    // Delete with a lane's keyframe picked removes that keyframe (the clip stays, keeping its value)
    kdDown(laneKd('opacity', 1)); tl.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 1 }));
    document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete', bubbles: true }));
    const keyDeleted = !!byId(cbP.id) && !cbP.keys.opacity && cbP.p.opacity === .5 && cbP.keys.x.length === 2 && document.querySelectorAll(`.trow.klane[data-id="${cbP.id}"]`).length === 1;
    const menuOk = MENUS.Edit().some(m => m[0] === 'Paste') && MENUS.Layer().some(m => m[0] === 'Show keyframe lanes');
    // saved and reopened: the pasted picture is found again
    PROJ.path = dir + 'clip.lumina'; await saveProject(); await openProject(dir + 'clip.lumina');
    const cbKept = S.layers.length === 6 && S.layers.some(x => MEDIA[x.media]?.path === cbIM?.path && MEDIA[x.media].img);
    step('clipboard', { cbMark, clipPasted, twoPasted, cutPasted, textPasted, picPasted, picPath: cbIM?.path, filesPasted, laneProps, laneKeys, pickedX, keyCopied, keyPasted, allKeys, laneDrag, keyDeleted, menuOk, cbKept,
      works: cbMark && clipPasted && twoPasted === '10,15' && cutPasted && textPasted && picPasted && filesPasted && laneProps === 'x,opacity' && laneKeys === '2,1' && pickedX && keyCopied && keyPasted
        && allKeys === '4/6 5' && laneDrag === '0.5/2 1' && keyDeleted && menuOk && cbKept });

    // ---- 18. C13 preview zoom and pan (in its own block so its names don't clash)
    {
    pause(); clearMulti(); const pzL = S.layers.find(x => x.kind === 'image'); S.sel = pzL.id; S.selKey = null; seek(pzL.start + .1); refresh(); render();
    const pzSel = $('#pzoom'), pzCw = () => $('#cwrap').getBoundingClientRect(), pzVp = () => { const b = vpBox(); return { ...b, right: b.left + b.width }; };
    const pzFit0 = PZ == null && pzSel.value === 'fit' && /^Fit \(\d+%\)$/.test(pzSel.options[0].textContent);
    // View › Preview at 100%: one composition pixel per screen pixel, centred
    MENUS.View().find(m => m[0] === 'Preview at 100%')[2]();
    const c100 = pzCw(), v100 = pzVp();
    const at100 = PZ === 1 && Math.abs(c100.width - W()) < .5 && Math.abs(c100.left + c100.width / 2 - (v100.left + v100.width / 2)) < 1 && pzSel.value === '1';
    // Ctrl+scroll zooms in around the pointer (the frame point under it stays put) and doesn't scale the picked clip
    const pzScale0 = val(pzL, 'scale'), pzAt = { clientX: v100.left + v100.width * .3, clientY: v100.top + v100.height * .6 };
    const pzBefore = compPoint(pzAt);
    ov.dispatchEvent(new WheelEvent('wheel', { ...pzAt, deltaY: -100, ctrlKey: true, bubbles: true, cancelable: true }));
    const pzAfter = compPoint(pzAt);
    const wheelZoom = PZ > 1.1 && Math.hypot(pzAfter.x - pzBefore.x, pzAfter.y - pzBefore.y) < .5 && val(pzL, 'scale') === pzScale0
      && pzSel.value === 'c' && pzSel.selectedOptions[0].textContent === Math.round(PZ * 100) + '%';
    const wheelPZ = +PZ.toFixed(3);
    // . and , step through 25/50/100/200/400 %, / fits
    const pzKey = (key, o = {}) => document.body.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...o }));
    pzKey('.'); const zIn = PZ; pzKey(','); pzKey(','); const zOut = PZ; pzKey('/');
    const keySteps = zIn === 2 && zOut === .5 && PZ == null && pzSel.value === 'fit';
    // the zoom box itself
    pzSel.value = '2'; pzSel.dispatchEvent(new Event('change')); const boxZoom = PZ === 2 && Math.abs(pzCw().width - W() * 2) < .5;
    // Space+drag pans; the Space press doesn't leave the video playing, and the clip isn't picked or moved
    const pzX0 = val(pzL, 'x'), pzSel0 = S.sel, pzC0 = pzCw(), pzMid = { clientX: pzC0.left + pzC0.width / 2, clientY: pzC0.top + pzC0.height / 2 };
    pzKey(' ', { code: 'Space' }); const spacePlayed = S.playing, spaceCursor = $('#viewport').classList.contains('space');
    ov.dispatchEvent(new PointerEvent('pointerdown', { ...pzMid, button: 0, pointerId: 1, bubbles: true, cancelable: true }));
    ov.dispatchEvent(new PointerEvent('pointermove', { clientX: pzMid.clientX + 50, clientY: pzMid.clientY + 30, pointerId: 1, bubbles: true }));
    ov.dispatchEvent(new PointerEvent('pointerup', { pointerId: 1, bubbles: true }));
    document.body.dispatchEvent(new KeyboardEvent('keyup', { key: ' ', code: 'Space', bubbles: true }));
    const pzC1 = pzCw(), spacePan = [Math.round(pzC1.left - pzC0.left), Math.round(pzC1.top - pzC0.top)].join();
    const panClean = spacePlayed && spaceCursor && !S.playing && val(pzL, 'x') === pzX0 && S.sel === pzSel0 && !pdrag && !$('#viewport').classList.contains('space') && !$('#viewport').classList.contains('panning');
    // a quick Space tap still plays
    pzKey(' ', { code: 'Space' }); document.body.dispatchEvent(new KeyboardEvent('keyup', { key: ' ', code: 'Space', bubbles: true }));
    const tapPlays = S.playing; pause();
    // middle-drag pans too; dragging far keeps 40px of the frame on screen
    const pzC2 = pzCw();
    ov.dispatchEvent(new PointerEvent('pointerdown', { ...pzMid, button: 1, pointerId: 1, bubbles: true, cancelable: true }));
    ov.dispatchEvent(new PointerEvent('pointermove', { clientX: pzMid.clientX - 20, clientY: pzMid.clientY, pointerId: 1, bubbles: true }));
    const midPan = Math.round(pzCw().left - pzC2.left);
    ov.dispatchEvent(new PointerEvent('pointermove', { clientX: pzMid.clientX + 99999, clientY: pzMid.clientY, pointerId: 1, bubbles: true }));
    ov.dispatchEvent(new PointerEvent('pointerup', { pointerId: 1, bubbles: true }));
    const farLeft = Math.round(pzVp().right - pzCw().left), clamped = Math.abs(farLeft - 40) < 1.5;
    // zoomed in, dragging a clip still moves it the right amount: 100 screen px at 200% = 50 composition px
    setPreviewZoom(2); pzL.p.x = .5; pzL.p.y = .5; if (pzL.keys) { delete pzL.keys.x; delete pzL.keys.y; } S.sel = pzL.id; render(); const pzX = Object.fromEntries(S.layers.map(x => [x.id, val(x, 'x')]));
    { const v = pzVp(), c = pzCw(), cx = c.left + c.width / 2, cy = c.top + c.height / 2;
      ov.dispatchEvent(new PointerEvent('pointerdown', { clientX: cx, clientY: cy, button: 0, pointerId: 1, bubbles: true, cancelable: true }));
      ov.dispatchEvent(new PointerEvent('pointermove', { clientX: cx + 100, clientY: cy, pointerId: 1, bubbles: true }));
      ov.dispatchEvent(new PointerEvent('pointerup', { pointerId: 1, bubbles: true })); }
    const dragAt2x = Math.max(...S.layers.map(x => Math.round(Math.abs(val(x, 'x') - (pzX[x.id] ?? val(x, 'x'))) * W())));
    // a deep zoom caps the overlay canvas; the picture shows sharp pixels
    setPreviewZoom(8); const ovCap = Math.max(ov.width, ov.height) <= 8192, sharp = $('#out').style.imageRendering === 'pixelated';
    const pzMenu = ['Zoom preview in', 'Zoom preview out', 'Preview at 100%', 'Fit preview in window'].every(n => MENUS.View().some(m => m[0] === n));
    await saveProject(); await openProject(dir + 'clip.lumina'); const fitOnOpen = PZ == null && PX === 0 && PY === 0;
    step('zoomPan', { pzFit0, at100, wheelZoom, wheelPZ,keySteps, boxZoom, spacePan, panClean, tapPlays, midPan, farLeft, clamped, dragAt2x, ovCap, sharp, pzMenu, fitOnOpen,
      works: pzFit0 && at100 && wheelZoom && keySteps && boxZoom && spacePan === '50,30' && panClean && tapPlays && midPan === -20 && clamped && dragAt2x === 50 && ovCap && sharp && pzMenu && fitOnOpen }); }

    // ---- 19. C14 graph editor: a bezier curve per keyframe, shaped with two handles
    {
      // the maths: straight line, CSS "ease" at the halfway point is 0.8024, overshoot goes past 1
      const geLinear = [.1, .5, .9].every(u => Math.abs(bezierEase([0, 0, 1, 1], u) - u) < 1e-4);
      const geCss = +bezierEase([.25, .1, .25, 1], .5).toFixed(4), geIn = bezierEase(EASE_BZ.easeIn, .5) < .4, geOut = bezierEase(EASE_BZ.easeOut, .5) > .6;
      let geMax = 0; for (let i = 0; i <= 100; i++) geMax = Math.max(geMax, bezierEase(EASE_BZ.back, i / 100));
      const geMathOk = geLinear && Math.abs(geCss - .8024) < 2e-3 && geIn && geOut && geMax > 1.05;
      S.layers = []; for (const k in RT) delete RT[k]; clearMulti(); seek(0);
      const geA = await load(cbCard); geA.start = 0; geA.dur = 6; upsertKey(geA, 'x', .2, 0); upsertKey(geA, 'x', .8, 2); commit();
      const geB = await load(cbCard); geB.start = 0; geB.dur = 6; upsertKey(geB, 'x', .1, 0); upsertKey(geB, 'x', .3, 1); commit();
      const pick = (L, t) => { clearMulti(); S.sel = L.id; S.selKey = t; S.selKP = 'x'; setRightTab('props'); refresh(); inspector(); };
      // the last keyframe has no move after it
      pick(geA, 2); const geLastMsg = !$('#inspector canvas.kgraph') && /last keyframe/.test($('#inspector').textContent);
      pick(geA, 0); const geCv = $('#inspector canvas.kgraph'); geCv.setPointerCapture = () => { };
      const geBtns = [...document.querySelectorAll('#inspector [data-kease]')].map(b => b.textContent).join('|');
      const geInk = (() => { const d = geCv.getContext('2d').getImageData(0, 0, geCv.width, geCv.height).data; let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i] > 0) n++; return n; })();
      const geInfo = /: 0\.20 → 0\.80 over 2\.00 s/.test($('#inspector').textContent);
      // a preset button
      document.querySelector('#inspector [data-kease="easeIn"]').click();
      const k0 = () => geA.keys.x[0];
      const gePreset = k0().ease === 'custom' && k0().bz.join() === EASE_BZ.easeIn.join() && val(geA, 'x', 1) < .4 && $('#f-ease').value === 'custom';
      // drag the second handle up past the top line: the move overshoots the next key's value
      const geCv2 = $('#inspector canvas.kgraph'); geCv2.setPointerCapture = () => { };
      const toClient = (u, v) => { const r = geCv2.getBoundingClientRect(), [px, py] = kgXY(geCv2, u, v), s = r.width / geCv2.width; return { clientX: r.left + px * s, clientY: r.top + py * s }; };
      const h2 = toClient(k0().bz[2], k0().bz[3]);
      geCv2.dispatchEvent(new PointerEvent('pointerdown', { ...h2, button: 0, pointerId: 1, bubbles: true, cancelable: true }));
      geCv2.dispatchEvent(new PointerEvent('pointermove', { ...toClient(.5, 1.3), pointerId: 1, bubbles: true }));
      const geLive = Math.abs(k0().bz[2] - .5) < .02 && Math.abs(k0().bz[3] - 1.3) < .02;
      geCv2.dispatchEvent(new PointerEvent('pointerup', { pointerId: 1, bubbles: true }));
      let geTop = 0; for (let t = 0; t <= 2; t += .02) geTop = Math.max(geTop, val(geA, 'x', t));
      const geDrag = geLive && geTop > .82 && Math.abs(val(geA, 'x', 2) - .8) < 1e-9 && !kgDrag;
      // grabbing away from a handle does nothing
      const geCv3 = $('#inspector canvas.kgraph'), bzNow = k0().bz.join();
      { const r = geCv3.getBoundingClientRect(); geCv3.dispatchEvent(new PointerEvent('pointerdown', { clientX: r.right - 4, clientY: r.top + 4, button: 0, pointerId: 1, bubbles: true })); }
      const geMiss = !kgDrag && k0().bz.join() === bzNow;
      // copy that keyframe and paste it on the other clip: the curve comes too
      cbKey('c'); await new Promise(r => setTimeout(r, 300));
      clearMulti(); S.sel = geB.id; S.selKey = null; S.selKP = null; refresh(); seek(3); cbKey('v'); await cbWait(() => geB.keys.x.length === 3);
      const gePasted = geB.keys.x.find(k => Math.abs(k.t - 3) < .01)?.bz?.join() === bzNow;
      // undo brings the curve back after Linear is chosen from the menu
      pick(geA, 0); const sel = $('#f-ease'); sel.value = 'linear'; sel.dispatchEvent(new Event('input', { bubbles: true })); sel.dispatchEvent(new Event('change', { bubbles: true }));
      const geLinearPick = byId(geA.id).keys.x[0].ease === 'linear' && !byId(geA.id).keys.x[0].bz && Math.abs(val(byId(geA.id), 'x', 1) - .5) < 1e-9;
      undo(); const geUndo = byId(geA.id).keys.x[0].bz?.join() === bzNow;
      // double-click goes back to Smooth
      const gA = byId(geA.id); pick(gA, 0); $('#inspector canvas.kgraph').dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
      const geDbl = gA.keys.x[0].ease === 'smooth' && !gA.keys.x[0].bz;
      undo();
      // saved and reopened: the curve is kept
      PROJ.path = dir + 'graph.lumina'; await saveProject(); await openProject(dir + 'graph.lumina');
      const geKept = S.layers.some(L => L.keys.x?.[0]?.bz?.join() === bzNow && L.keys.x[0].ease === 'custom');
      step('graphEditor', { geMathOk, geCss, geMax: +geMax.toFixed(3), geLastMsg, geBtns, geInk, geInfo, gePreset, geLive, geTop: +geTop.toFixed(3), geDrag, geMiss, gePasted, geLinearPick, geUndo, geDbl, geKept,
        works: geMathOk && geLastMsg && geBtns === 'Ease in|Ease out|Ease in & out|Linear|Overshoot' && geInk > 500 && geInfo && gePreset && geDrag && geMiss && gePasted && geLinearPick && geUndo && geDbl && geKept });
    }

    // ---- 20. B1 tool rail: icon tabs down the left, panels of cards to click or drag in
    {
      const rlNames = [...document.querySelectorAll('#rail [data-rail]')].map(b => b.textContent.trim()).join('|');
      useWorkspace('small'); const rlHidden = !PANELS.project;
      openRail('media'); const rlMedia = PANELS.project && LTAB === 'project' && !$('#projBody').hidden && $('#railBody').hidden && document.querySelector('#rail [data-rail=media]').classList.contains('on');
      openRail('effects'); const rlFx = LTAB === 'fxp' && !$('#fxpBody').hidden;
      const cards = () => document.querySelectorAll('#railBody .rcard').length;
      const counts = {};
      for (const k of ['text', 'stickers', 'trans', 'captions', 'audio', 'adjust', '3d']) { openRail(k); counts[k] = cards(); }
      const rlTab = $('#railTab').textContent === '3D' && !$('#railTab').hidden && $('#projBody').hidden;
      const rlCounts = counts.text === TEXT_ANIMS.length && counts.stickers === SHAPES.length && counts.trans === Object.keys(TRANS).length
        && counts['3d'] === Object.keys(SHAPES3D).length && counts.adjust === 1 + BG_MODES.length + Object.values(ATMO).filter(a => !a.grade).length;
      S.layers = []; for (const k in RT) delete RT[k]; clearMulti(); S.sel = null; refresh();
      const rlBase = await load(cbCard); rlBase.start = 0; rlBase.dur = 8; const rlNext = await load(cbCard); rlNext.start = 8; rlNext.dur = 4; commit(); refresh();
      const click = spec => document.querySelector(`#railBody [data-radd="${spec}"]`)?.click();
      const added = () => S.layers.find(L => L.id === S.sel);
      // click cards: each adds one thing at the playhead, one undo step each
      seek(2); openRail('text'); let u0 = undoStack.length; click('text:typewriter');
      const rlText = added()?.kind === 'text' && added().anim === 'typewriter' && added().start === 2 && undoStack.length === u0 + 1;
      openRail('stickers'); click('shape:star'); const rlShape = added()?.shape === 'star';
      click('emoji:😀'); const rlEmoji = added()?.emoji === '😀';
      document.querySelector('#railBody [data-rsttab="Flags"]').click(); const rlFlagCards = document.querySelectorAll('#railBody .rgrid.flags .rcard').length === Object.keys(FLAGS).length;
      const fk = Object.keys(FLAGS)[0]; click('flag:' + fk); const rlFlag = added()?.flag === fk;
      click('shape:blur'); const rlBlur = added()?.shape === 'blur';
      openRail('3d'); const s3 = Object.keys(SHAPES3D)[0]; click('3d:' + s3); const rl3d = added()?.kind === '3d' && added().shape3 === s3;
      openRail('adjust'); click('atmo:rain'); const rlAtmo = added()?.kind === 'atmo' && added() !== undefined;
      click('bg:gradient'); const rlBg = S.global.bg === 'gradient' && document.querySelector('#railBody [data-radd="bg:gradient"]').classList.contains('on');
      // transitions need a picture clip: with none picked it says so; with one picked it goes on that clip
      openRail('trans'); clearMulti(); S.sel = null; refresh(); click('trans:fade');
      const rlTransNeed = !$('#modal').hidden && /Pick a video or picture/.test($('#mText').textContent); $('#modal').hidden = true;
      clearMulti(); S.sel = rlNext.id; refresh(); const tk = Object.keys(TRANS)[1]; click('trans:' + tk);
      const rlTrans = byId(rlNext.id).trans?.type === tk && !!document.querySelector('#railBody [data-radd="act:transall"]');
      click('trans:none'); const rlTransOff = !byId(rlNext.id).trans;
      // captions and audio panels follow what's picked
      openRail('captions'); const rlCapNote = !document.querySelector('#railBody [data-radd="act:autocap"]') && /Pick a video or audio clip/.test($('#railBody').textContent);
      openRail('audio'); const rlAudNote = /Pick a music, sound or video clip/.test($('#railBody').textContent) && !!document.querySelector('#railBody [data-radd="file:"]');
      // drag a card in: onto the preview (at the playhead), onto the timeline (at the drop time), a transition onto a clip
      const drag = (spec, el, x, y) => { const dt = new DataTransfer(); dt.setData('application/x-lumina-add', spec); el.dispatchEvent(new DragEvent('drop', { dataTransfer: dt, clientX: x, clientY: y, bubbles: true, cancelable: true })); };
      seek(1); const vr = $('#viewport').getBoundingClientRect(); drag('shape:heart', $('#viewport'), vr.left + 50, vr.top + 50);
      const rlDropPv = added()?.shape === 'heart' && added().start === 1;
      S.pps = 60; buildTimeline(); const tlEl = $('#tl'), tr = tlEl.getBoundingClientRect(); tlEl.scrollLeft = 0;
      drag('text:wave', tlEl, tr.left + HEADW + 3 * S.pps, tr.top + 5); const rlDropTl = added()?.anim === 'wave' && Math.abs(added().start - 3) < .02;
      clearMulti(); S.sel = null; S.pps = 20; refresh();
      const row = document.querySelector(`.trow[data-id="${rlNext.id}"]`), rr = row.getBoundingClientRect();
      drag('trans:' + tk, row, rr.left + HEADW + 9 * S.pps, rr.top + rr.height / 2); const rlDropTrans = byId(rlNext.id).trans?.type === tk && S.sel === rlNext.id;
      // the dragstart puts the card's job on the drag
      openRail('stickers'); const dt0 = new DataTransfer(), card = document.querySelector('#railBody [data-radd="shape:arrow"]');
      card.dispatchEvent(new DragEvent('dragstart', { dataTransfer: dt0, bubbles: true })); const rlDragStart = dt0.getData('application/x-lumina-add') === 'shape:arrow' && card.draggable;
      useWorkspace('default'); openRail('media');
      step('railTools', { rlNames, rlHidden, rlMedia, rlFx, counts, rlTab, rlCounts, rlText, rlShape, rlEmoji, rlFlagCards, rlFlag, rlBlur, rl3d, rlAtmo, rlBg, rlTransNeed, rlTrans, rlTransOff, rlCapNote, rlAudNote, rlDropPv, rlDropTl, rlDropTrans, rlDragStart,
        works: rlNames === 'Media|Image|Text|Stickers|Effects|Transitions|Captions|Audio|Adjust|3D|Converter' && rlHidden && rlMedia && rlFx && rlTab && rlCounts && rlText && rlShape && rlEmoji && rlFlagCards && rlFlag && rlBlur && rl3d && rlAtmo && rlBg
          && rlTransNeed && rlTrans && rlTransOff && rlCapNote && rlAudNote && rlDropPv && rlDropTl && rlDropTrans && rlDragStart });
    }

    // ---- 21. B2 clip quick bar: buttons above the timeline for the picked clip
    {
      S.layers = []; for (const k in RT) delete RT[k]; clearMulti(); S.sel = null; seek(0); refresh();
      const qbNone = $('#qbar').hidden && !$('#tlHint').hidden;
      // a video (pasted from the clipboard as a file, like step 17), a picture and a text
      await lumina.clipWrite({ uris: 'file:///' + (dir + 'tone.webm').replace(/\\/g, '/') }); seek(0); pasteNow(); await cbWait(() => S.layers.some(x => x.kind === 'video'));
      const qV = S.layers.find(x => x.kind === 'video'); qV.start = 0;
      const qI = await load(cbCard); qI.start = 0; qI.dur = 6; addText(); const qT = selLayer(); commit(); refresh();
      const ids = L => { clearMulti(); S.sel = L.id; S.selKey = null; refresh(); return [...document.querySelectorAll('#qbar [data-qb]')].map(b => b.dataset.qb).join(); };
      const qbVideo = ids(qV), qbImage = ids(qI), qbText = ids(qT);
      const qbShown = !$('#qbar').hidden && $('#tlHint').hidden;
      const press = k => document.querySelector(`#qbar [data-qb="${k}"]`).click();
      const lit = () => document.querySelector('#inspector .flash');
      // the jumps: each shows (and lights up) the right settings
      press('animate'); const qbAnim = !!lit()?.querySelector('#f-anim');
      ids(qI); press('mask'); const qbMask = qI.mask?.on === true && lit()?.querySelector('h3')?.textContent === 'Mask';
      ids(qV); press('speed'); const qbSpeed = lit()?.querySelector('h3')?.textContent === 'Speed';
      press('volume'); const qbVol = lit()?.dataset.p === 'volume';
      press('canvas'); const qbCanvas = LTAB === 'adjust' && lit()?.querySelector('h3')?.textContent === 'Canvas background';
      ids(qI); press('trans'); const qbTrans = LTAB === 'trans'; ids(qI); press('effects'); const qbFx = LTAB === 'fxp';
      // the actions
      ids(qI); seek(3); let n0 = S.layers.length; press('split'); const qbSplit = S.layers.length === n0 + 1;
      ids(qV); seek(.5); n0 = S.layers.length; press('sepaudio'); await cbWait(() => S.layers.length === n0 + 1);
      const qbSep = !!linkMate(byId(qV.id)) && !(ids(byId(qV.id)).includes('sepaudio'));
      ids(byId(qV.id)); seek(.5); press('freeze'); await cbWait(() => S.layers.some(x => x.freeze));
      const qbFreeze = S.layers.some(x => x.freeze);
      // two clips: Split, Copy, Delete
      setMulti([qI.id, qT.id], qT.id); refresh(); const qbMulti = [...document.querySelectorAll('#qbar [data-qb]')].map(b => b.dataset.qb).join();
      press('copy'); await new Promise(r => setTimeout(r, 300)); const qbCopy = CLIP?.kind === 'clips' && CLIP.layers.length === 2;
      n0 = S.layers.length; ids(qT); press('del'); const qbDel = S.layers.length === n0 - 1 && !byId(qT.id) && $('#qbar').hidden;
      step('quickBar', { qbNone, qbVideo, qbImage, qbText, qbShown, qbAnim, qbMask, qbSpeed, qbVol, qbCanvas, qbTrans, qbFx, qbSplit, qbSep, qbFreeze, qbMulti, qbCopy, qbDel,
        works: qbNone && qbVideo === 'split,speed,freeze,sepaudio,volume,animate,mask,trans,effects,canvas,del' && qbImage === 'split,animate,mask,trans,effects,canvas,del'
          && qbText === 'split,animate,mask,effects,del' && qbShown && qbAnim && qbMask && qbSpeed && qbVol && qbCanvas && qbTrans && qbFx && qbSplit && qbSep && qbFreeze
          && qbMulti === 'split,copy,del' && qbCopy && qbDel });
      useWorkspace('default'); openRail('media');
    }

    // ---- 23. B4 welcome screen and one-time tips (the user's own settings are saved first and put back after)
    {
      const keys = ['lumina.welcome', 'lumina.tipsSeen', 'lumina.tipsOff'], saved = {};
      for (const k of keys) { try { saved[k] = localStorage.getItem(k); } catch (e) { } }
      const wait = ms => new Promise(r => setTimeout(r, ms));
      const inTest = INTRO_OFF && $('#welcome').hidden && $('#coach').hidden;   // main.js turned them off
      S.layers = []; for (const k in RT) delete RT[k]; clearMulti(); S.sel = null; seek(0); refresh();
      INTRO_OFF = false; tipsReset(); lsSet('lumina.welcome', null);
      // the welcome screen: four sizes, the mode choice, the start-up checkbox
      startIntro(); const wShown = !$('#welcome').hidden && $('#coach').hidden;
      const wSizes = [...document.querySelectorAll('#wSizes [data-wsize]')].map(b => b.dataset.wsize).join();
      document.querySelector('#wSizes [data-wsize="1080x1920"]').click(); const wSize = W() === 1080 && H() === 1920 && document.querySelector('#wSizes [data-wsize="1080x1920"]').classList.contains('on');
      $('#wShow').checked = false; $('#wShow').dispatchEvent(new Event('change')); const wOffSaved = lsGet('lumina.welcome') === 'off';
      // Esc closes it, then the first tip points at the tool rail
      document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); await wait(600);
      const rr = $('#rail').getBoundingClientRect(), cr = $('#coach').getBoundingClientRect();
      const tRail = $('#welcome').hidden && !$('#coach').hidden && $('#coach').dataset.tip === 'rail' && Math.abs(cr.left - (rr.right + 12)) < 2;
      $('#coachOk').click(); await wait(700); const tImport = $('#coach').dataset.tip === 'import' && !$('#coach').hidden;
      $('#coachOk').click(); await wait(700); const tWaits = $('#coach').hidden;   // the rest need a clip
      const tL = await load(cbCard); tL.start = 0; tL.dur = 3; commit(); clearMulti(); S.sel = tL.id; refresh(); await wait(700);
      const tQbar = $('#coach').dataset.tip === 'qbar' && !$('#coach').hidden;
      // picking nothing takes the quick-bar tip away (its buttons are gone); picking again brings it back
      clearMulti(); S.sel = null; refresh(); await wait(100); const tGone = $('#coach').hidden; S.sel = tL.id; refresh(); await wait(700);
      $('#coachOk').click(); await wait(700); const tExport = $('#coach').dataset.tip === 'export';
      $('#coachOff').click(); await wait(500); const tOff = $('#coach').hidden && lsGet('lumina.tipsOff') === '1'; tipNext(); const tStaysOff = $('#coach').hidden;
      const seenNow = JSON.parse(lsGet('lumina.tipsSeen') || '[]').join();
      MENUS.Help().find(m => m[0] === 'Show tips again')[2](); await wait(100); const tAgain = !$('#coach').hidden && $('#coach').dataset.tip === 'rail';
      // with the welcome turned off, start-up goes straight to the tips; opening a project closes the welcome
      tipHide(); startIntro(); const wSkipped = $('#welcome').hidden && !$('#coach').hidden; tipHide();
      PROJ.path = dir + 'intro.lumina'; await saveProject(); showWelcome(); const wOpenShown = !$('#welcome').hidden;
      await openProject(dir + 'intro.lumina'); const wOpenClosed = wOpenShown && $('#welcome').hidden;
      const wHelp = MENUS.Help().some(m => m[0] === 'Welcome screen…');
      // put everything back
      INTRO_OFF = true; introOff(); for (const k of keys) lsSet(k, saved[k]);
      $('#res').value = '1920x1080'; $('#res').dispatchEvent(new Event('change')); refresh();
      step('welcomeTips', { inTest, wShown, wSizes, wSize, wOffSaved, tRail, tImport, tWaits, tQbar, tGone, tExport, tOff, tStaysOff, seenNow, tAgain, wSkipped, wOpenClosed, wHelp,
        works: inTest && wShown && wSizes === '1920x1080,1080x1920,1080x1080,1280x720' && wSize && wOffSaved && tRail && tImport && tWaits && tQbar && tGone && tExport
          && tOff && tStaysOff && seenNow === 'rail,import,qbar' && tAgain && wSkipped && wOpenClosed && wHelp });
    }

    // ---- 24. C15 friends' test release: version, About box, Help › Send feedback
    {
      const VER = '0.10.0', VERX = VER.replace(/\./g, '\\.'); // the version in package.json
      const fbInfo = lumina.info?.version === VER && /^Windows \d/.test(lumina.info?.os || '');
      const help = MENUS.Help(), names = help.filter(Array.isArray).map(m => m[0]);
      const fbMenu = names.includes('Send feedback…') && names.includes('About Lumina') && help.find(m => m[0] === 'About Lumina')[3] !== false;
      help.find(m => m[0] === 'About Lumina')[2]();
      const fbAbout = !$('#modal').hidden && $('#mTitle').textContent === 'About Lumina' && new RegExp('Lumina ' + VERX + ' \\(test version\\)').test($('#mText').textContent) && /Send feedback/.test($('#mText').textContent);
      $('#modal').hidden = true;
      help.find(m => m[0] === 'Send feedback…')[2](); await new Promise(r => setTimeout(r, 50));
      const fbT = $('#fbText'), fbForm = !$('#modal').hidden && !!fbT && new RegExp('Version: ' + VERX + ' \\(test\\)').test(fbT.value) && /Computer: Windows \d/.test(fbT.value) && /What would you change or add\?/.test(fbT.value);
      const fbCaret = document.activeElement === fbT && fbT.value.slice(0, fbT.selectionStart).endsWith('What were you doing?\n');
      fbT.value = fbT.value.replace('What were you doing?\n', 'What were you doing?\nTesting the feedback box\n');
      $('#fbCopy').click(); await new Promise(r => setTimeout(r, 400));
      const fbCopied = $('#modal').hidden && /Testing the feedback box/.test((await lumina.clipRead()).text || '');
      // a normal message box afterwards is plain text again
      toast('plain <b>text</b>'); const fbToast = $('#mText').textContent === 'plain <b>text</b>' && $('#mTitle').textContent === 'Heads up'; $('#modal').hidden = true;
      step('release', { fbInfo, info: lumina.info, fbMenu, fbAbout, fbForm, fbCaret, fbCopied, fbToast, works: fbInfo && fbMenu && fbAbout && fbForm && fbCaret && fbCopied && fbToast });
    }

    // ---- 25. Converter: links become MP3 / MP4 (yt-dlp downloads, Lumina's FFmpeg converts). Local file:// links
    // (allowed only in the self-test) stand in for web links, so this runs offline.
    {
      const keep = ['lumina.convRecent', 'lumina.convFmt', 'lumina.convNorm', 'lumina.convFolder', 'lumina.convPlaylist', 'lumina.convCookies'].map(k => [k, lsGet(k)]);
      const cookies0 = CONV.cookies, playlist0 = CONV.playlist; CONV.cookies = ''; CONV.playlist = false;
      const recent0 = CONV.recent.slice(), folder0 = CONV.folder, fmt0 = CONV.fmt, wait = ms => new Promise(r => setTimeout(r, ms));
      try {
        const out = 'D:\\Lumina\\.claude\\speed\\convout';
        const fileURL = p => 'file:///' + p.replace(/\\/g, '/');
        CONV.recent = []; CONV.folder = out; CONV.fmt = 'mp4';
        const cvRail = !!$('#rail [data-rail="convert"]') && $('#rail [data-rail="convert"]').textContent.includes('Converter');
        openRail('convert'); const cvCheck = /Checking/.test($('#railBody').textContent) || CONV.ready != null;
        for (let i = 0; i < 100 && CONV.ready == null; i++) await wait(100);   // yt-dlp --version takes a moment the first time
        await wait(100);
        const cvReady = cvCheck && CONV.ready === true && /^\d{4}\.\d\d\.\d\d/.test(CONV.version);
        const cvUi = !!$('#cvUrl') && $('#railBody').querySelectorAll('[data-cvfmt]').length === 2 && !!$('#cvGo') && /Saves to\s*convout/.test($('#railBody').textContent) && /rights/.test($('#railBody').textContent);
        $('#railBody [data-cvfmt="mp3"]').click(); await wait(50);
        const cvFmt = CONV.fmt === 'mp3' && $('#railBody [data-cvfmt="mp3"]').classList.contains('on') && !$('#railBody .cvchk').hidden;
        // not a link: refused with a message, nothing queued
        $('#cvUrl').value = 'just some words'; $('#cvGo').click(); await wait(50);
        const cvBad = !$('#modal').hidden && /doesn't look like a link/.test($('#mText').textContent) && CONV.jobs.length === 0; $('#modal').hidden = true;
        // two links at once: the second waits for the first; MP3 from the tone, MP4 from the brightness ramp (VP8 → H.264)
        $('#cvUrl').value = fileURL(dir + 'tone.webm'); $('#cvGo').click();
        CONV.fmt = 'mp4'; $('#cvUrl').value = fileURL(dir + 'ramp.webm'); document.querySelector('#cvUrl').dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
        await wait(30);
        const cvQueued = CONV.jobs.length === 2 && CONV.jobs[0].state === 'run' && CONV.jobs[1].state === 'wait' && $('#cvUrl').value === '' && $('#cvQueue').querySelectorAll('.cvjob').length >= 2;
        let sawStages = new Set(), t0 = performance.now();
        while (CONV.jobs.length && performance.now() - t0 < 90000) { CONV.jobs.forEach(j => j.stageText && sawStages.add(j.stageText.split('…')[0])); await wait(100); }
        const cvDone = CONV.jobs.length === 0 && CONV.recent.length === 2 && CONV.recent[1].fmt === 'mp3' && CONV.recent[0].fmt === 'mp4';
        const mp3 = CONV.recent[1], mp4 = CONV.recent[0];
        const cvNames = /^tone( \(\d+\))?\.mp3$/.test(mp3?.name) && /^ramp( \(\d+\))?\.mp4$/.test(mp4?.name) && mp4.path.startsWith(out);
        const probe = (p, tag) => new Promise(res => { const m = document.createElement(tag); m.muted = true; m.preload = 'metadata'; m.onloadedmetadata = () => res({ d: +m.duration.toFixed(2), w: m.videoWidth || 0 }); m.onerror = () => res(null); m.src = lumina.mediaURL(p); });
        const pa = mp3 && await probe(mp3.path, 'audio'), pv = mp4 && await probe(mp4.path, 'video');
        // a title with "///": yt-dlp saves it with look-alike slashes (⧸) but its console output drops them, which once made
        // a finished download look like "yt-dlp stopped with code 0"
        const slName = 'slash ⧸⧸⧸ test.webm';
        await lumina.saveExport(await (await fetch(lumina.mediaURL(dir + 'tone.webm'))).arrayBuffer(), slName, dir + slName);
        let slash = null; try { slash = await lumina.convRun({ id: 'slash', url: 'file:///' + (dir + slName).replace(/\\/g, '/').split('/').map((s, i) => i ? encodeURIComponent(s) : s).join('/'), item: 0, fmt: 'mp3', normalize: false, folder: out, cookies: '' }); } catch (e) { slash = { error: String(e.message || e) }; }
        const slProbe = slash?.path ? await probe(slash.path, 'audio') : null;
        const cvSlash = !!slProbe && slProbe.d > 3 && /^slash ⧸⧸⧸ test( \(\d+\))?\.mp3$/.test(slash.name) && slash.title === 'slash ⧸⧸⧸ test';
        const src = await probe(dir + 'ramp.webm', 'video'), srcA = await probe(dir + 'tone.webm', 'audio');
        // ramp.webm was recorded by Chromium, whose WebM header claims ~6 s; FFmpeg (and the real footage) say 2.98 s
        const cvPlay = !!pa && !!pv && Math.abs(pa.d - srcA.d) < .2 && Math.abs(pv.d - 2.98) < .2 && pv.w === src.w;
        const cvList = $('#cvQueue').querySelectorAll('.cvjob.done').length === 2 && /Add to timeline/.test($('#cvQueue').textContent);
        const cvKept = JSON.parse(lsGet('lumina.convRecent') || '[]').length === 2;
        // Add to timeline: the MP3 lands as an audio clip at the playhead
        seek(1); const nL = S.layers.length;
        $('#cvQueue [data-rec="1"] [data-cvrec="add"]').click(); await wait(1500);
        const added = S.layers.length === nL + 1 ? S.layers.find(l => l.media != null && MEDIA[l.media]?.path === mp3.path) : null;
        const cvAdd = !!added && added.kind === 'audio' && Math.abs(added.start - 1) < .01;
        if (added) { S.layers.splice(S.layers.indexOf(added), 1); commit(); refresh(); }
        // a link that fails says why and offers Try again; a waiting link can be cancelled
        $('#cvUrl').value = fileURL(dir + 'no-such-file.webm'); $('#cvGo').click();
        $('#cvUrl').value = fileURL(dir + 'tone.webm'); $('#cvGo').click(); await wait(30);
        $('#cvQueue [data-job]:nth-of-type(2) [data-cvjob="cancel"]')?.click(); const second = CONV.jobs.length;
        t0 = performance.now(); while (CONV.jobs.some(j => j.state === 'run') && performance.now() - t0 < 30000) await wait(100);
        const fj = CONV.jobs[0];
        const cvFail = second === 1 && !!fj && fj.state === 'fail' && /^Couldn't open that link/.test(fj.msg) && !$('#modal').hidden && /Couldn't convert/.test($('#mText').textContent) && /Try again/.test($('#cvQueue').textContent) && CONV.recent.length === 2;
        $('#modal').hidden = true; $('#cvQueue [data-cvjob="dismiss"]')?.click(); const cvDismiss = CONV.jobs.length === 0;
        const cvStages = ['Downloading', 'Making the MP3', 'Making the MP4'].every(s => [...sawStages].some(x => x.startsWith(s)));
        // a page with two videos is a playlist: it becomes two jobs, each fetched as "item N" of the page
        CONV.fmt = 'mp4'; $('#cvUrl').value = fileURL(dir + 'list.html'); $('#cvGo').click();
        let plMax = 0, plChecking = false; t0 = performance.now();
        while ((CONV.jobs.length || performance.now() - t0 < 500) && performance.now() - t0 < 90000) { plMax = Math.max(plMax, CONV.jobs.length); plChecking ||= CONV.jobs.some(j => /Checking the link/.test(j.stageText || '')); await wait(80); }
        const plMade = CONV.recent.slice(0, 2), plProbe = [];
        for (const r of plMade) plProbe.push(await probe(r.path, 'video'));
        const cvPlaylist = plMax === 2 && plChecking && CONV.recent.length === 4 && plMade.every(r => r.fmt === 'mp4' && /^Converter test list \([12]\)( \(\d+\))?\.mp4$/.test(r.name))
          && plProbe.every(p => p && p.w > 0) && plMade[0].name !== plMade[1].name;
        // the other settings: whole-playlist and sign-in-with are remembered (the browser one isn't used here)
        const lst = $('#cvList'); lst.checked = true; lst.dispatchEvent(new Event('input', { bubbles: true }));
        const sel = $('#cvCookies'); sel.value = 'firefox'; sel.dispatchEvent(new Event('input', { bubbles: true })); await wait(30);
        const cvSettings = CONV.playlist && lsGet('lumina.convPlaylist') === '1' && CONV.cookies === 'firefox' && lsGet('lumina.convCookies') === 'firefox' && /Firefox<\/b> sign-ins/.test($('#railBody').innerHTML) && $('#cvCookies').value === 'firefox';
        $('#cvCookies').value = ''; $('#cvCookies').dispatchEvent(new Event('input', { bubbles: true })); await wait(30);
        const cvSettingsOff = CONV.cookies === '' && lsGet('lumina.convCookies') === null && !/sign-ins for sites/.test($('#railBody').textContent);
        CONV.playlist = false;
        step('converter', { cvPlaylist, plMax, plChecking, plNames: plMade.map(r => r.name), plProbe, cvSettings, cvSettingsOff, cvRail, cvReady, version: CONV.version, cvUi, cvFmt, cvBad, cvQueued, cvDone, cvNames, names: [mp3?.name, mp4?.name], probe: { pa, pv, src, srcA }, cvPlay, cvList, cvKept, cvAdd, cvFail, failMsg: fj?.msg, cvDismiss, stages: [...sawStages], cvStages, cvSlash, slash,
          works: cvSlash && cvRail &&cvReady && cvUi && cvFmt && cvBad && cvQueued && cvDone && cvNames && cvPlay && cvList && cvKept && cvAdd && cvFail && cvDismiss && cvStages && cvPlaylist && cvSettings && cvSettingsOff });
      } finally {
        keep.forEach(([k, v]) => lsSet(k, v)); CONV.recent = recent0; CONV.folder = folder0; CONV.fmt = fmt0; CONV.jobs = []; CONV.cookies = cookies0; CONV.playlist = playlist0;
        setLeftTab('project');
      }
    }

    // ---- 26. timeline edges: the playhead stops at the layer names and the timeline scrolls; the wheel scrolls sideways
    {
      const wait = ms => new Promise(r => setTimeout(r, ms));
      if (S.playing) pause();
      seek(0); addText(); const longT = selLayer(); longT.start = 0; longT.dur = 60; commit(); refresh();   // room to scroll: a minute-long title
      S.pps = 300; $('#zoom').value = 300; buildTimeline(); await wait(60);
      const tl = $('#tl'), r = tl.getBoundingClientRect(), edge = r.left + HEADW, laneEl = () => $('#tlin .ruler-row .lane') || $('#tlin [data-scrub]');
      const y = laneEl().getBoundingClientRect().top + 8, wide = tl.scrollWidth > tl.clientWidth + 1500;
      tl.scrollLeft = 1200; seek(1200 / S.pps + 2); await wait(80);
      // scrub: press in the lanes, drag over the layer names
      laneEl().dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: edge + 200, clientY: y, pointerId: 1, button: 0 }));
      tl.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, clientX: edge - 120, clientY: y, pointerId: 1, buttons: 1 }));
      const v0 = tlView(), atEdge = Math.abs(S.time - v0.t0) < .02, phX = parseFloat($('#playhead').style.left);
      const phVisible = phX >= tl.scrollLeft + HEADW - 1;
      const s0 = tl.scrollLeft, tA = S.time; await wait(400);
      const scrolledLeft = tl.scrollLeft < s0 - 50, followed = S.time < tA - .1 && Math.abs(S.time - tlView().t0) < .03;
      tl.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, clientX: edge - 120, clientY: y, pointerId: 1 }));
      const s1 = tl.scrollLeft; await wait(200); const stops = tl.scrollLeft === s1;   // let go: no more scrolling
      // dragging off the right edge scrolls right
      tl.scrollLeft = 600; await wait(30);
      laneEl().dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: edge + 100, clientY: y, pointerId: 1, button: 0 }));
      tl.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, clientX: r.right + 30, clientY: y, pointerId: 1, buttons: 1 }));
      const s2 = tl.scrollLeft; await wait(300);
      const scrolledRight = tl.scrollLeft > s2 + 50 && S.time <= tlView().t1 + .02;
      tl.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 1 })); await wait(30);
      // the wheel: sideways over the lanes, normal over the names, Ctrl zooms around the pointer
      tl.scrollLeft = 900; const top0 = tl.scrollTop; await wait(30);
      const wl = new WheelEvent('wheel', { bubbles: true, cancelable: true, clientX: edge + 300, clientY: y + 40, deltaY: 100 }); tl.dispatchEvent(wl);
      const wheelSide = tl.scrollLeft === 1000 && tl.scrollTop === top0 && wl.defaultPrevented;
      tl.dispatchEvent(new WheelEvent('wheel', { bubbles: true, cancelable: true, clientX: edge + 300, clientY: y + 40, deltaY: -100 }));
      const wheelBack = tl.scrollLeft === 900;
      const wn = new WheelEvent('wheel', { bubbles: true, cancelable: true, clientX: edge - 100, clientY: y + 40, deltaY: 100 }); tl.dispatchEvent(wn);
      const wheelNames = !wn.defaultPrevented && tl.scrollLeft === 900;
      const wpad = new WheelEvent('wheel', { bubbles: true, cancelable: true, clientX: edge + 300, clientY: y + 40, deltaX: 60, deltaY: 5 }); tl.dispatchEvent(wpad);
      const wheelPad = tl.scrollLeft === 960;
      const tUnder = (tl.scrollLeft + 300) / S.pps;
      tl.dispatchEvent(new WheelEvent('wheel', { bubbles: true, cancelable: true, clientX: edge + 300, clientY: y + 40, deltaY: 200, ctrlKey: true }));
      const zoomed = S.pps < 300 && +$('#zoom').value === S.pps && Math.abs((tl.scrollLeft + 300) / S.pps - tUnder) < .05;
      // a jump out of sight (End, arrow keys, bookmarks) scrolls the playhead back into view; wheel-scrolling away doesn't snap back
      S.pps = 300; $('#zoom').value = 300; buildTimeline(); tl.scrollLeft = 0; await wait(60);
      // the screen loop runs tlFollow; Windows pauses that loop when the test window is covered, so after a short wait run it here
      seek(duration() - .2); const inView = () => { const v = tlView(); return S.time >= v.t0 && S.time <= v.t1; };
      for (let i = 0; i < 10 && !inView(); i++) await wait(100);
      if (!inView()) tlFollow();
      const jumpFollow = inView() && /tlFollow\(\)/.test((typeof tick === 'function' ? tick : loop).toString());
      tl.scrollLeft = 0; await wait(120); const staysPut = tl.scrollLeft === 0;
      seek(0); S.layers.splice(S.layers.indexOf(longT), 1); S.sel = null; commit(); refresh(); await wait(80);
      step('timelineEdges', { wide, atEdge, phVisible, scrolledLeft, followed, stops, scrolledRight, wheelSide, wheelBack, wheelNames, wheelPad, zoomed, jumpFollow, staysPut,
        works: wide && atEdge && phVisible && scrolledLeft && followed && stops && scrolledRight && wheelSide && wheelBack && wheelNames && wheelPad && zoomed && jumpFollow && staysPut });
    }

    // ---- 27. layer mute: a speaker in each sound layer's header mutes just that layer; Alt+click hears only that one
    {
      const wait = ms => new Promise(r => setTimeout(r, ms));
      if (S.playing) pause(); audioInit(); await AC.resume().catch(() => {});
      const n0 = S.layers.length, before = { has: x => ids0.has(x.id) }, ids0 = new Set(S.layers.map(x => x.id));   // by id: Undo rebuilds the layer objects
      addFiles([pathFile(dir + 'tone.webm')]); addFiles([pathFile(dir + 'tone.webm')]);
      let mine = [];
      for (let i = 0; i < 60; i++) { mine = S.layers.filter(x => !before.has(x)); if (mine.length === 2 && mine.every(x => RT[x.id]?.el && MEDIA[x.media]?.duration > 3)) break; await wait(100); }
      const [V1, V2] = mine; V1.start = V2.start = 0; commit(); refresh();
      clearMulti(); S.sel = V2.id; setRightTab('props'); refresh(); $('#inspector [data-act=sepaudio]')?.click();
      const A2 = linkMate(V2);
      const snd = L => $(`#tlin .trow[data-id="${L.id}"]:not(.klane) [data-snd]`);
      const press = (L, alt) => snd(L).dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, altKey: !!alt, button: 0, pointerId: 1 }));
      const gains = () => { syncMedia(1); return [V1, A2].map(L => +(RT[L.id].gain?.gain.value ?? -1).toFixed(2)); };
      const buttons = !!snd(V1) && !snd(V2) && !!snd(A2) && !!A2;   // the separated video's sound is on its audio clip
      const start = gains().join(), onIcon = !snd(V1).classList.contains('off');
      press(V1); const muted1 = V1.muted === true && !A2.muted && snd(V1).classList.contains('off') && gains().join() === `0,${gains()[1]}` && gains()[1] > 0;
      const selKept = S.sel === V2.id || S.sel === A2.id;   // the speaker doesn't pick the layer
      undo(); const undone = byId(V1.id).muted !== true && !snd(byId(V1.id)).classList.contains('off');
      press(byId(V1.id)); press(byId(V1.id)); const backOn = !byId(V1.id).muted;
      press(byId(A2.id), true); const solo = byId(V1.id).muted === true && !byId(A2.id).muted && byId(V2.id).muted === true;
      const soloGains = gains().join();
      press(byId(A2.id), true); const allOn = !byId(V1.id).muted && !byId(A2.id).muted && byId(V2.id).muted === true;
      const titled = /mute just this layer/.test(snd(byId(V1.id)).title);
      const rows = [...document.querySelectorAll('#tlin .trow[data-id]:not(.klane) [data-snd]')].length;
      for (const L of S.layers.filter(x => !before.has(x))) { S.layers.splice(S.layers.indexOf(L), 1); }
      S.sel = null; commit(); refresh();
      step('layerMute', { buttons, start, onIcon, muted1, selKept, undone, backOn, solo, soloGains, allOn, titled, rows, cleaned: S.layers.length === n0,
        works: buttons && start === '1,1' && onIcon && muted1 && selKept && undone && backOn && solo && soloGains === '0,1' && allOn && titled && S.layers.length === n0 });
    }

    // ---- 28. copy and paste impacts; Ctrl+X on a picked keyframe cuts just that keyframe
    {
      if (S.playing) pause();
      const imp0 = S.impacts.length, near = t => S.impacts.find(x => Math.abs(x.t - t) < 1e-6);
      seek(0); addText(); const T = selLayer(); T.start = 0; T.dur = 8; commit(); refresh();   // room on the timeline
      seek(1); addImpact(); const m = selImpact(); m.strength = .7; m.dur = .3; commit(); setRightTab('props'); refresh();
      const impBtn = !!$('#inspector [data-act=copyimp]');
      const menuCopy = MENUS.Edit().find(x => x[0] === 'Copy impact')?.[3] === true && MENUS.Edit().find(x => x[0] === 'Cut impact')?.[3] === true;
      // Ctrl+C on the keyboard
      document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'c', ctrlKey: true, bubbles: true }));
      const copied = CLIP?.kind === 'impact' && CLIP.m.strength === .7 && !('id' in CLIP.m);
      seek(2.5); pasteData({}); const p = near(2.5);
      const pasted = S.impacts.length === imp0 + 2 && !!p && p.id !== m.id && S.sel === p.id && p.strength === .7 && p.dur === .3;
      pasteData({}); const twiceRefused = S.impacts.length === imp0 + 2;
      undo(); const undone = S.impacts.length === imp0 + 1 && !near(2.5);
      // Ctrl+X: the impact goes; Ctrl+V puts it back somewhere else
      S.sel = near(1).id; refresh(); copySel(true); const cutGone = S.impacts.length === imp0;
      seek(4); pasteData({}); const cutPasted = S.impacts.length === imp0 + 1 && !!near(4) && near(4).strength === .7;
      // the button in the panel copies too
      CLIP = null; S.sel = near(4).id; refresh(); $('#inspector [data-act=copyimp]').click(); const btnCopied = CLIP?.kind === 'impact';
      { const n4 = near(4); S.impacts = S.impacts.filter(x => x !== n4); } S.sel = null; commit(); refresh();
      const impClean = S.impacts.length === imp0;
      // a picked keyframe: Ctrl+X takes the keyframe, not the clip; Ctrl+V pastes it back
      byId(T.id).keys.opacity = [{ t: 0, v: 1, ease: 'smooth' }, { t: 1, v: .4, ease: 'smooth' }]; commit(); refresh();
      S.sel = T.id; S.selKey = 1; S.selKP = null; refresh();
      const keyMenu = MENUS.Edit().some(x => x[0] === 'Cut keyframe');
      copySel(true); const T2 = byId(T.id);
      const keyCut = !!T2 && (T2.keys.opacity?.length ?? 0) === 1 && CLIP?.kind === 'keys';
      S.sel = T.id; seek(2); pasteData({}); const keyBack = byId(T.id)?.keys.opacity?.some(k => Math.abs(k.t - 2) < 1e-3 && Math.abs(k.v - .4) < 1e-6);
      S.layers.splice(S.layers.indexOf(byId(T.id)), 1); S.sel = null; seek(0); commit(); refresh();
      step('copyImpacts', { impBtn, menuCopy, copied, pasted, twiceRefused, undone, cutGone, cutPasted, btnCopied, impClean, keyMenu, keyCut, keyBack,
        works: impBtn && menuCopy && copied && pasted && twiceRefused && undone && cutGone && cutPasted && btnCopied && impClean && keyMenu && keyCut && !!keyBack });
    }

    // ---- 29. the playhead line can be grabbed anywhere along it (even over a clip) and dragged
    {
      const wait = ms => new Promise(r => setTimeout(r, ms));
      if (S.playing) pause();
      const modalWas = $('#modal').hidden; $('#modal').hidden = true;   // an earlier step leaves a dialog open over the timeline
      seek(0); addText(); const T = selLayer(); T.start = 0; T.dur = 8; commit();
      S.pps = 90; $('#zoom').value = 90; clearMulti(); S.sel = null; refresh(); buildTimeline();
      const tl = $('#tl'); tl.scrollLeft = 0; seek(2); updatePlayhead(); await wait(50);
      const bar = () => $(`#tlin .trow[data-id="${T.id}"] .bar`), y = () => { const r = bar().getBoundingClientRect(); return r.top + r.height / 2; };
      bar().scrollIntoView({ block: 'nearest' }); await wait(30);
      const phX = () => $('#playhead').getBoundingClientRect().left + 1;
      const hit = document.elementFromPoint(phX() + 3, y()), onLine = !!hit?.closest('#playhead');   // the grip is wider than the 2 px line
      const x0 = phX() + 3, y0 = y();
      hit.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: x0, clientY: y0, pointerId: 1, button: 0 }));
      const grabbed = drag?.mode === 'scrub' && drag.grab === true && tl.classList.contains('phgrab');
      tl.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, clientX: x0 + 90, clientY: y0, pointerId: 1, buttons: 1 }));
      const tMoved = +S.time.toFixed(3), moved = Math.abs(S.time - 3) < .006;   // exactly one second: no jump to the pointer
      tl.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, clientX: x0 + 90, clientY: y0, pointerId: 1 }));
      const clipStill = byId(T.id).start === 0 && S.sel == null && !tl.classList.contains('phgrab') && drag == null;
      // a keyframe sitting under the playhead is still picked, not the line
      byId(T.id).keys.opacity = [{ t: 3, v: .5, ease: 'smooth' }]; commit(); refresh(); updatePlayhead(); await wait(30);
      const x1 = phX() + 1, k = document.elementFromPoint(x1, y());
      k.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: x1, clientY: y(), pointerId: 1, button: 0 }));
      const keyWins = drag?.mode === 'key' && S.selKey === 3;
      tl.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, clientX: x1, clientY: y(), pointerId: 1 }));
      const hint = /playhead line/.test($('#tlHint').textContent);
      S.layers.splice(S.layers.indexOf(byId(T.id)), 1); S.sel = null; S.selKey = null; seek(0); commit(); refresh(); $('#modal').hidden = modalWas;
      step('playheadGrab', { hitWas: hit ? `${hit.tagName}#${hit.id}.${hit.className}` : 'none', at: [Math.round(x0), Math.round(y0), innerWidth, innerHeight], onLine, grabbed, moved, time: tMoved, clipStill, keyWins, hint,
        works: onLine && grabbed && moved && clipStill && keyWins && hint });
    }

    $('#modal').hidden = true; S.sel = VR?.id ?? null; S.pps = 90; setRightTab('props'); refresh(); await settle(.5); $('#inspector canvas.vcurve')?.scrollIntoView({ block: 'center' });
    await new Promise(r => setTimeout(r, 400));
    R.errors = __errs;
  } catch (e) { R.error = String(e && e.stack || e); R.errors = window.__errs; }
  finally { try { setRipple(false); } catch (e) { } }   // the test window shares Lumina's saved settings: never leave Ripple on
  return R;
})()
