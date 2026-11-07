// SVG test: sizing from the file, transparency, gradients, sharpness when scaled up, part animation, split into layers, save/reopen.
(async () => {
  const R = { steps: {} }, step = (k, v) => R.steps[k] = v;
  try {
    S.global.vignette = 0;
    const dir = 'D:\\Lumina\\.claude\\svg\\media\\';
    const file = async (name, text) => { const f = new File([text], name, { type: 'image/svg+xml' }); f.__path = await lumina.saveExport(await f.arrayBuffer(), name, dir + name); return f; };
    // viewBox only (no width/height), one wrapper group, gradients, a <style> class, a half-transparent group with a transform
    const LOGO = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 200">
      <defs><linearGradient id="lg" x1="0" x2="1"><stop offset="0" stop-color="#ff8a00"/><stop offset="1" stop-color="#8a2be2"/></linearGradient>
        <radialGradient id="rg"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#ff2060"/></radialGradient></defs>
      <style>.zig{stroke:#00ff66;stroke-width:6;fill:none}</style>
      <g id="art">
        <rect id="bar" x="20" y="40" width="100" height="120" fill="url(#lg)"/>
        <circle id="orb" cx="200" cy="100" r="55" fill="url(#rg)"/>
        <g id="star" transform="translate(310 100) rotate(15)"><polygon points="0,-45 13,-14 45,-14 19,6 28,40 0,20 -28,40 -19,6 -45,-14 -13,-14" fill="#ffe000" fill-opacity=".5"/></g>
        <polyline id="zig" class="zig" points="20,185 60,172 100,185 140,172 180,185 220,172 260,185 300,172 340,185 380,172"/>
      </g></svg>`;
    const card = await makeCard(Array(6).fill('0,90,200'), 'bg.png', false); card.__path = await lumina.saveExport(await card.arrayBuffer(), 'bg.png', dir + 'bg.png');
    const bg = await load(card);
    seek(0);
    const V = await load(await file('logo.svg', LOGO)); V.start = 0; V.dur = 6; bg.start = 0; bg.dur = 6;
    const m = MEDIA[V.media];
    step('imported', { w: m.w, h: m.h, svg: m.svg, parts: m.parts.map(p => p.name) });

    // user units -> frame (fit: 1000x500 into 1920x1080 is 1.92x, so 4.8 px per unit, top at y=60)
    const at = (u, v) => pix(u * 4.8 / 1920, (60 + v * 4.8) / 1080);
    await settle(3);
    const look = () => ({ empty: at(132, 100), emptyTop: at(200, 15), barLeft: at(30, 100), barRight: at(110, 100), orb: at(200, 100), orbEdge: at(252, 100), star: at(310, 100), zig: at(20, 185) });
    const still = look();
    step('look', { ...Object.fromEntries(Object.entries(still).map(([k, v]) => [k, v.join(',')])),
      transparent: still.empty.join() === '0,90,200' && still.emptyTop.join() === '0,90,200',
      gradient: still.barLeft[0] > still.barRight[0] + 60 && still.barRight[2] > still.barLeft[2] + 100,
      halfStar: still.star[0] > 90 && still.star[0] < 170 && still.star[2] > 60 && still.star[2] < 140,
      styleClass: still.zig[1] > 150 && still.zig[0] < 80 });

    // sharp when scaled up: count blurry pixels across the orb's edge at 3x
    V.p.scale = 3; await settle(3);
    const row = ctx.getImageData(1680, 540, 160, 1).data, mids = [];
    for (let i = 0; i < 160; i++) { const r = row[i * 4]; if (r > 40 && r < 215) mids.push(1680 + i); }
    step('sharp', { blurryPixels: mids.length, at: mids.slice(0, 8), insideRed: row[0] > 200, outsideBlue: row[159 * 4 + 2] > 180 && row[159 * 4] < 20 });
    V.p.scale = 1;

    // inspector shows the vector panel
    S.sel = V.id; refresh();
    const sel = (id, v) => { const s = $(id); s.value = v; s.dispatchEvent(new Event('input', { bubbles: true })); s.dispatchEvent(new Event('change', { bubbles: true })); };
    step('panel', { anim: !!$('#f-sva'), split: $('#inspector [data-act=svgsplit]')?.textContent, text: $('#inspector .group .empty')?.textContent.slice(0, 70) });
    sel('#f-sva', 'pop');
    step('panelOn', { order: !!$('#f-svr'), stagger: !!$('#f-svs'), each: !!$('#f-svd'), preview: !!$('#inspector [data-act=svgplay]') });
    V.svgStagger = .3; V.svgDur = .3;
    // pop, back to front: the bar is first, the star third
    const early = []; for (const t of [.15, .45, .75, 1.2]) { await settle(t); early.push({ t, bar: at(70, 100)[0] > 150, orb: at(200, 100)[0] > 200, star: at(310, 100)[2] < 180 }); }
    sel('#f-svr', 'reverse'); await settle(.15); const reverseFirst = { zig: at(200, 178.5)[1] > 150, bar: at(70, 100)[0] > 150 };
    // wipe at half way: left half of the bar is on, right half not yet
    V.svgOrder = 'order'; V.svgAnim = 'wipe'; V.svgStagger = 0; V.svgDur = 1; await settle(.5);
    const wipe = { left: at(30, 100).join(), right: at(115, 100).join() };
    // out at the end
    V.svgAnim = 'fade'; V.svgOut = true; V.svgDur = .3; await settle(V.start + V.dur - .02); const outEnd = at(200, 100).join();
    const kinds = {}; for (const k of Object.keys(SVG_ANIMS)) { V.svgAnim = k; V.svgOut = false; V.svgStagger = .1; V.svgDur = .6; await settle(.3); kinds[k] = at(200, 100).join(); }
    step('animate', { early, reverseFirst, wipe, wipeWorks: wipe.left !== '0,90,200' && wipe.right === '0,90,200', outEnd, outGone: outEnd === '0,90,200', kinds, errors: __errs.length });

    // split into layers: the picture stays the same
    V.svgAnim = 'none'; V.svgOut = false; await settle(3); const before = look();
    S.sel = V.id; refresh(); $('#inspector [data-act=svgsplit]').click();
    const parts = S.layers.filter(L => L.svgPart != null);
    await settle(3); const after = look();
    const diff = Math.max(...Object.keys(before).map(k => Math.max(...before[k].map((v, i) => Math.abs(v - after[k][i])))));
    step('split', { layers: parts.map(L => L.name), parentGone: !S.layers.includes(V), maxDiff: diff, selected: selLayer()?.svgPart, panelText: $('#inspector .group .empty')?.textContent.slice(0, 40) });

    // a split part turns around its own centre: the star's middle stays star
    const star = parts.find(L => L.name.startsWith('star'));
    star.p.rotation = 90; await settle(3); const rotStar = at(310, 100).join(); star.p.rotation = 0;
    // and can be graded like a picture
    star.p.cExpo = 1; await settle(3); const graded = at(310, 100).join(); star.p.cExpo = 0;
    // a staggered split: animated parts start one after another on the timeline
    undo(); refresh(); const V2 = S.layers.find(L => L.media === V.media && L.svgPart == null);
    V2.svgAnim = 'pop'; V2.svgStagger = .25; S.sel = V2.id; refresh(); $('#inspector [data-act=svgsplit]').click();
    const starts = S.layers.filter(L => L.svgPart != null).map(L => +L.start.toFixed(2)).sort();
    step('partLayers', { rotStar, rotKept: rotStar === after.star.join(), graded, gradeChanged: graded !== after.star.join(), undoBack: !!V2, staggeredStarts: starts });

    // save, reopen: parts come back from the file
    await settle(3); const preSave = look();
    PROJ.path = dir + 'svg.lumina'; await saveProject();
    S.layers = []; for (const k in RT) delete RT[k]; refresh();
    await openProject(dir + 'svg.lumina');
    await settle(3); const reopened = look();
    const rdiff = Math.max(...Object.keys(preSave).map(k => Math.max(...preSave[k].map((v, i) => Math.abs(v - reopened[k][i])))));
    const mm = Object.values(MEDIA).find(x => x.svg);
    step('reopened', { layers: S.layers.length, parts: mm && mm.parts.length, maxDiff: rdiff });

    // no viewBox, just width/height, one shape: right shape, animates as a whole; scripts in the file never run
    const ONE = `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="150" onload="window.__pwned=1"><script>window.__pwned=2</script><ellipse cx="150" cy="75" rx="140" ry="65" fill="#40ff40" opacity=".6"/></svg>`;
    const O = await load(await file('one.svg', ONE)); const om = MEDIA[O.media];
    S.sel = O.id; refresh();
    step('simple', { w: om.w, h: om.h, parts: om.parts.length, panel: $('#inspector .group .empty')?.textContent.slice(0, 60), scriptRan: window.__pwned || 0 });

    // picture: the logo popping in, part by part, then the split star turned
    for (const L of [...S.layers]) if (L.media === O.media) S.layers.splice(S.layers.indexOf(L), 1);
    const P = S.layers.filter(L => L.svgPart != null);
    const strip = document.createElement('canvas'); strip.width = 4 * 480; strip.height = 2 * 270; const sx = strip.getContext('2d');
    const t0 = Math.min(...P.map(L => L.start));
    for (let c = 0; c < 8; c++) { await settle(t0 + .05 + c * .14); sx.drawImage(canvas, (c % 4) * 480, Math.floor(c / 4) * 270, 480, 270); }
    await lumina.saveExport(await new Promise(r => strip.toBlob(b => b.arrayBuffer().then(r))), 'x.png', 'D:\\Lumina\\.claude\\svg\\frames.png');
    $('#modal').hidden = true; S.sel = P[0].id; refresh(); await settle(3);
    R.errors = __errs;
  } catch (e) { R.error = String(e && e.stack || e); }
  return R;
})()
