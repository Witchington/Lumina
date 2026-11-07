// Variable-font test: weight really changes the letters, smoothly; presets, weight motions and the inspector work.
(async () => {
  const R = { steps: {} }, step = (k, v) => R.steps[k] = v;
  try {
    S.global.vignette = 0;
    for (const f in VFONTS) await document.fonts.load(`400 40px "${f}"`);
    step('fontsLoaded', Object.fromEntries(Object.keys(VFONTS).map(f => [f, document.fonts.check(`100 40px "${f}"`) && document.fonts.check(`900 40px "${f}"`)])));

    seek(0); addText(); const T = selLayer();
    Object.assign(T, { text: 'LUMINA', anim: 'none', stroke: false, color: '#ffffff', start: 0, dur: 6 });
    // white letter pixels on the black frame: heavier weight = more ink
    const ink = () => { const d = ctx.getImageData(0, 0, W(), H()).data; let n = 0; for (let i = 0; i < d.length; i += 16) if (d[i] > 128) n++; return n; };
    const inkAt = async w => { T.p.wght = w; await settle(1); return ink(); };

    // the inspector: a variable font shows Weight and Weight motion; a fixed one hides them
    S.sel = T.id; refresh();
    const pickFont = f => { const s = $('#f-font'); s.value = f; s.dispatchEvent(new Event('input', { bubbles: true })); s.dispatchEvent(new Event('change', { bubbles: true })); };
    const fixedUI = { weightRow: !!$('#inspector .prow[data-p=wght]'), motion: !!$('#f-wm') };
    pickFont('Montserrat Variable');
    step('inspector', { fixed: fixedUI, variable: { font: T.font, weightRow: !!$('#inspector .prow[data-p=wght]'), motion: !!$('#f-wm'), options: document.querySelectorAll('#f-font option').length } });

    const perFont = {};
    for (const f in VFONTS) {
      T.font = f; const { lo, hi } = VFONTS[f];
      const ws = [lo, 300, 500, 700, hi], inks = [];
      for (const w of ws) inks.push(await inkAt(w));
      // between named weights too, not snapped to the nearest 100
      setFont(T, 200, 450); const wa = ctx.measureText('LUMINA').width; setFont(T, 200, 465); const wb = ctx.measureText('LUMINA').width;
      setFont(T, 200, 500); const wc = ctx.measureText('LUMINA').width;
      perFont[f] = { inks, rising: inks.every((v, i) => !i || v > inks[i - 1]), blackVsThin: +(inks[4] / inks[0]).toFixed(2),
        widths: [wa, wb, wc].map(v => +v.toFixed(1)), between: wa !== wb && wb !== wc };
    }
    step('weights', perFont);

    // the Weight row in the inspector drives it
    T.font = 'Montserrat Variable'; S.sel = T.id; refresh();
    const num = $('#n-wght'); num.value = 250; num.dispatchEvent(new Event('input', { bubbles: true })); num.dispatchEvent(new Event('change', { bubbles: true }));
    step('weightRow', { p: T.p.wght, val: +val(T, 'wght', 1).toFixed(0) });

    // preset Thin -> Bold -> Black from the playhead
    seek(1); S.sel = T.id; refresh();
    $('#inspector [data-preset=thinblack]').click();
    const T2 = selLayer();
    const ramp = [1, 1.25, 1.5, 1.75, 2, 3].map(t => +val(T2, 'wght', t).toFixed(0));
    const rampInk = []; for (const t of [1, 1.5, 2]) { await settle(t); rampInk.push(ink()); }
    step('thinBlack', { keys: (T2.keys.wght || []).map(k => [+k.t.toFixed(2), k.v]), ramp, rising: ramp.every((v, i) => !i || v >= ramp[i - 1]), rampInk, inkRising: rampInk[0] < rampInk[1] && rampInk[1] < rampInk[2] });

    // preset on a fixed font switches to a variable one; Weight pulse swings thin<->black
    T2.font = 'Anton'; delete T2.keys.wght; S.sel = T2.id; refresh();
    $('#inspector [data-preset=weightpulse]').click();
    const T3 = selLayer(), pulse = [0, .25, .5, .75].map(t => +val(T3, 'wght', 1 + t).toFixed(0));
    step('weightPulse', { font: T3.font, expr: T3.expr.wght, pulse, swings: Math.max(...pulse) - Math.min(...pulse) > 600 });
    delete T3.expr.wght; T3.p.wght = 900;

    // weight motions: letters get their own weights
    const motions = {};
    for (const m of ['cascade', 'ripple', 'sweep', 'breathe']) {
      T3.wmotion = m;
      const per = age => { const fn = weightFn(T3, age, age); return fn ? [0, 2, 5].map(i => Math.round(fn(i, 6))) : null; };
      const inks = []; for (const t of [.1, .4, .8, 1.6]) { await settle(t); inks.push(ink()); }
      motions[m] = { at0: per(0), at03: per(.3), at2: per(2), inks, varies: Math.max(...inks) - Math.min(...inks) > inks[0] * .05 };
    }
    step('motions', motions);
    // picking a motion in the inspector shows its speed slider and hint
    S.sel = T3.id; refresh(); const wm = $('#f-wm'); wm.value = 'ripple'; wm.dispatchEvent(new Event('input', { bubbles: true })); wm.dispatchEvent(new Event('change', { bubbles: true }));
    step('motionUI', { wmotion: T3.wmotion, speed: !!$('#f-wsp'), hint: $('#inspector .empty')?.textContent.slice(0, 50) });

    // with a letter animation too (bounce + cascade) nothing breaks
    T3.anim = 'bounce'; T3.wmotion = 'cascade'; await settle(1); const withBounce = ink();
    T3.anim = 'wordpop'; T3.text = 'GG EZ WIN'; await settle(1.2); const withWordpop = ink();
    step('combined', { withBounce, withWordpop });

    const saved = JSON.parse(projectJSON()).layers.find(L => L.kind === 'text');
    step('saved', { font: saved.font, wmotion: saved.wmotion, wght: saved.p.wght });

    // picture: each font at five weights, then a cascade through time
    T3.anim = 'none'; T3.wmotion = 'none'; T3.text = 'LUMINA'; T3.p.size = 150;
    const fonts = Object.keys(VFONTS), cols = 5;
    const strip = document.createElement('canvas'); strip.width = cols * 384; strip.height = (fonts.length + 1) * 216; const sx = strip.getContext('2d');
    for (let r = 0; r < fonts.length; r++) { T3.font = fonts[r]; const { lo, hi } = VFONTS[fonts[r]];
      for (let c = 0; c < cols; c++) { T3.p.wght = lo + (hi - lo) * c / (cols - 1); await settle(1); sx.drawImage(canvas, c * 384, r * 216, 384, 216); } }
    T3.font = 'Montserrat Variable'; T3.p.wght = 900; T3.wmotion = 'cascade';
    for (let c = 0; c < cols; c++) { await settle(.05 + c * .2); sx.drawImage(canvas, c * 384, fonts.length * 216, 384, 216); }
    await lumina.saveExport(await new Promise(r => strip.toBlob(b => b.arrayBuffer().then(r))), 'x.png', 'D:\\Lumina\\.claude\\vfont\\weights.png');
    $('#modal').hidden = true; T3.wmotion = 'ripple'; S.sel = T3.id; refresh(); await settle(1);
    R.errors = __errs;
  } catch (e) { R.error = String(e && e.stack || e); }
  return R;
})()
