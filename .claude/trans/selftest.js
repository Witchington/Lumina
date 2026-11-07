// Transition test: two flat-colour clips lined up end to end, every transition style checked across the cut.
(async () => {
  const R = { steps: {} }, step = (k, v) => R.steps[k] = v;
  try {
    S.global.vignette = 0;
    const A = await load(await makeClip(2, 'BLUE', '#2050d0'));
    const B = await load(await makeClip(2, 'RED', '#d03020'));
    const cut = B.start;
    step('linedUp', { aEnd: +endOf(A).toFixed(3), bStart: +B.start.toFixed(3), bAbove: S.layers.indexOf(B) < S.layers.indexOf(A) });

    // pick a style the way a person does: select the second clip, choose from the Transition in menu
    S.sel = B.id; refresh();
    const sel = $('#tr-type'); sel.value = 'fade'; sel.dispatchEvent(new Event('input', { bubbles: true })); sel.dispatchEvent(new Event('change', { bubbles: true }));
    transTok++; const T = transList().find(x => x.B === B);
    step('picked', { trans: B.trans, partner: T && T.A && T.A.name, window: T && [+T.t0.toFixed(2), +T.t1.toFixed(2)], lengthRow: !!$('#tr-dur'), hint: $('#inspector .group p.empty')?.textContent.slice(0, 60), markOnTimeline: document.querySelectorAll('#tlin .trn').length });

    const at = async t => { await settle(t); return { corner: pix(.04, .06), left: pix(.2, .5), right: pix(.8, .5) }; };
    const out = {};
    for (const type of Object.keys(TRANS)) {
      B.trans = { type, dur: .6 }; transTok++;
      out[type] = {};
      for (const [name, dt] of [['before', -.2], ['cut', 0], ['after', .2], ['done', .4]]) out[type][name] = (await at(cut + dt)).corner.join(',');
      if (type === 'whip') { const m = await at(cut); out.whip.cutLeft = m.left.join(','); out.whip.cutRight = m.right.join(','); }
    }
    step('styles', out);
    step('audio', { aAtCut: +transGain(A, cut).toFixed(2), bAtCut: +transGain(B, cut).toFixed(2), aBefore: +transGain(A, cut - .4).toFixed(2), bAfter: +transGain(B, cut + .4).toFixed(2) });

    // real playback across the cut: the outgoing clip keeps playing into the overlap, the incoming one is already running
    B.trans = { type: 'fade', dur: .6 }; transTok++;
    // how often the window draws right now (a hidden, throttled test window draws ~1-2 times a second, and then playback can't be judged)
    { const t0 = performance.now(); for (let i = 0; i < 20; i++) render(cut - .5 + i / 60); R.renderMs = +((performance.now() - t0) / 20).toFixed(2); }
    { const t0 = performance.now(); await new Promise(r => setTimeout(r, 200)); R.timer200ms = Math.round(performance.now() - t0); }
    R.visibility = document.visibilityState + (document.hasFocus() ? ', focused' : ', not focused');
    R.framesPerSecond = await new Promise(res => { let n = 0; const t0 = performance.now(); const f = () => { n++; if (performance.now() - t0 < 1000) requestAnimationFrame(f); else res(n); }; requestAnimationFrame(f); });
    seek(cut - .8); await play();
    const seen = [];
    await new Promise(res => { const i = setInterval(() => {
      seen.push([+(S.time - cut).toFixed(2), RT[A.id].el.paused ? 'A-' : 'A+', RT[B.id].el.paused ? 'B-' : 'B+', +RT[B.id].el.currentTime.toFixed(2), +RT[A.id].el.currentTime.toFixed(2)]);
      if (S.time > cut + .6 || seen.length > 60) { clearInterval(i); res(); } }, 50); });
    pause();
    const inOverlap = seen.filter(s => s[0] > .02 && s[0] < .25);
    // A's file ends at the cut, so through the overlap it must hold its last frame, never jump back to the start
    const aDur = MEDIA[A.media].duration;
    step('playback', { overlapSamples: inOverlap.length, aHeldLastFrame: inOverlap.length > 0 && inOverlap.every(s => s[4] > aDur - .15), aMinTimeInOverlap: Math.min(...inOverlap.map(s => s[4])), aDur: +aDur.toFixed(3),
      bPlayingAfterCut: seen.filter(s => s[0] > .05).every(s => s[2] === 'B+'), samples: seen.map(s => s.join(' ')).slice(12, 26) });

    // split keeps the cut straight; "Use on every cut" reaches a third clip; saved in the project
    const C = await load(await makeClip(2, 'GREEN', '#20a040'));
    S.sel = B.id; refresh(); $('#inspector [data-act=transall]').click();
    const saved = JSON.parse(projectJSON()).layers.filter(L => L.trans).map(L => L.name + ':' + L.trans.type);
    seek(B.start + 1); S.sel = B.id; split();
    const halves = S.layers.filter(L => L.name === B.name).map(L => [+L.start.toFixed(2), L.trans ? L.trans.type : 'none']);
    step('more', { cTrans: C.trans && C.trans.type, saved, halves });

    // picture for the eye: the whip mid-swipe
    $('#modal').hidden = true;
    B.trans = { type: 'whip', dur: .6 }; S.sel = B.id; refresh(); await settle(cut + .03);
    R.shotAt = { t: +(S.time - cut).toFixed(3), trans: B.trans.type, panel: $('#tr-type').value };
    // the preview itself, straight from Lumina's canvas, at a few points through each of three styles
    const strip = document.createElement('canvas'); strip.width = 4 * 480; strip.height = 3 * 270; const sx = strip.getContext('2d');
    const rows = ['whip', 'zoom', 'glitch'];
    for (let r = 0; r < rows.length; r++) { B.trans = { type: rows[r], dur: .6 }; transTok++;
      for (let c = 0; c < 4; c++) { await settle(cut - .24 + c * .16); sx.drawImage(canvas, c * 480, r * 270, 480, 270); } }
    await lumina.saveExport(await new Promise(r => strip.toBlob(b => b.arrayBuffer().then(r))), 'x.png', 'D:\\Lumina\\.claude\\trans\\frames.png');
    R.errors = __errs;
  } catch (e) { R.error = String(e && e.stack || e); }
  return R;
})()
