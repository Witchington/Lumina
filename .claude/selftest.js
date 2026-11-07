// Runs inside the Electron app (npm run selftest). Exercises the desktop-only features and returns a report.
(async () => {
  const R = { steps: {} }, step = (k, v) => R.steps[k] = v;
  try {
    step('desktopBridge', !!(window.lumina && window.lumina.desktop));
    await document.fonts.load('40px Anton'); await document.fonts.load('40px "Black Ops One"'); await document.fonts.load('14px Barlow');
    step('fontsOffline', { anton: document.fonts.check('40px Anton'), blackOps: document.fonts.check('40px "Black Ops One"'), barlow: document.fonts.check('14px Barlow') });

    // write a generated clip to disk, then import it the way a real file is imported
    const dir = 'D:\\Lumina\\.claude\\selftest-media\\';
    const f = await makeClip(3, 'SCENE', 'scene');
    f.__path = await lumina.saveExport(await f.arrayBuffer(), 'clip.webm', dir + 'clip.webm');
    S.global.vignette = 0;
    const V = await load(f);
    step('mediaFromDisk', { url: MEDIA[V.media].url.slice(0, 40), path: MEDIA[V.media].path });
    await settle(1);
    let readable = true; try { ctx.getImageData(0, 0, 1, 1); } catch { readable = false; }
    step('canvasReadable', readable);
    const plain = pix(.5, .5); V.p.cExpo = .6; await settle(1);
    step('gpuGrading', { plain, graded: pix(.5, .5) }); V.p.cExpo = 0;
    const el = RT[V.id].el; el.currentTime = 2.2; await new Promise(r => { el.onseeked = r; setTimeout(r, 3000); });
    step('seekWorks', +el.currentTime.toFixed(2));
    await loadAI(); step('aiOffline', AI.state);

    // project: save, wipe, reopen, compare
    seek(.5); addText(); selLayer().text = 'SAVED'; addAtmo('snow');
    V.keys.x = [{ t: 0, v: .4, ease: 'smooth' }, { t: 2, v: .6, ease: 'smooth' }]; commit();
    step('dirtyBeforeSave', PROJ.dirty);
    PROJ.path = dir + 'test.lumina';
    const saved = await saveProject();
    step('saved', { ok: saved, dirtyAfter: PROJ.dirty, title: document.title });
    const sig = () => JSON.stringify(S.layers.map(L => [L.kind, L.name, L.text || null, (L.keys.x || []).length, L.effect || null]));
    const before = sig();
    S.layers = []; for (const k in RT) delete RT[k]; refresh();
    await openProject(dir + 'test.lumina');
    step('reopened', { same: sig() === before, layers: S.layers.length, mediaPath: MEDIA[S.layers.find(L => L.kind === 'video').media].path });
    await settle(1); step('reopenedPixel', pix(.5, .5));
    addImpact(); step('dirtyAfterEdit', PROJ.dirty);

    // speed ramp: the math round-trips, the clip gets longer, and playback follows the ramp
    {
      const R2 = S.layers.find(L => L.kind === 'video'); S.sel = R2.id;
      commit(); const undoBase = undoStack.length;
      const before = len(R2); seek(R2.start + 1); applyPreset(R2, 'slowmo'); commit(); refresh();
      const ts = [0, .5, .9, 1.2, 1.5, 2, len(R2) - .01].map(x => R2.start + x);
      const roundTrip = Math.max(...ts.map(t => Math.abs(tlTime(R2, srcTime(R2, t)) - t)));
      const r = { before: +before.toFixed(3), after: +len(R2).toFixed(3), endSrc: +srcTime(R2, endOf(R2)).toFixed(3), out: R2.out, roundTrip: +roundTrip.toExponential(1),
        rateAtSlow: +rateAt(R2, 1.3).toFixed(2), inspectorRow: !!$('#inspector .prow[data-p=rate]') };
      // play through the ramp and watch the video's own rate and position
      const el = RT[R2.id].el, seen = []; let frames = 0, counting = true; const cnt = () => { frames++; if (counting) requestAnimationFrame(cnt); }; requestAnimationFrame(cnt);
      seek(R2.start + .5); await play();
      await new Promise(res => { const i = setInterval(() => { seen.push([+(S.time - R2.start).toFixed(2), el.playbackRate, +Math.abs(el.currentTime - srcTime(R2, S.time)).toFixed(3)]); if (S.time - R2.start > 2.2 || seen.length > 60) { clearInterval(i); res(); } }, 50); });
      pause(); counting = false; r.frames = frames; r.visible = document.visibilityState;
      r.minRate = Math.min(...seen.map(s => s[1])); r.maxDrift = Math.max(...seen.slice(4).map(s => s[2]));
      r.reached = seen[seen.length - 1][0];      // split inside the slow part keeps the picture continuous
      const cutAt = R2.start + 1.4, srcAt = srcTime(R2, cutAt); seek(cutAt); split();
      const B = S.layers.find(L => L.kind === 'video' && L !== R2 && Math.abs(L.start - cutAt) < 1e-6);
      r.split = { aOut: +R2.out.toFixed(3), bIn: +(B && B.in).toFixed(3), src: +srcAt.toFixed(3), bRate: B && +rateAt(B, 0).toFixed(2) };
      undo(); refresh();
      // the Slow-mo panel's sliders change it live
      S.sel = R2.id; refresh();
      const slider = f => $(`#inspector input[data-sm="0"][data-smf="${f}"]`);
      const setS = (f, v) => { const s = slider(f); s.value = v; s.dispatchEvent(new Event('input', { bubbles: true })); s.dispatchEvent(new Event('change', { bubbles: true })); };
      const R3 = () => S.layers.find(L => L.kind === 'video');
      r.panel = { panels: document.querySelectorAll('#inspector .slomo').length, sliders: ['speed', 'hold', 'ease'].map(f => !!slider(f)), bandOnTimeline: document.querySelectorAll('#tlin .slo').length };
      const l25 = len(R3()); setS('speed', .1); const l10 = len(R3());
      setS('hold', 2); const lHold = len(R3()); setS('ease', 0); const lStep = len(R3());
      r.sliderLens = { at25: +l25.toFixed(3), at10: +l10.toFixed(3), hold2: +lHold.toFixed(3), ease0: +lStep.toFixed(3), rateMid: +rateAt(R3(), 2).toFixed(2), label: $('#inspector .slomo output').textContent };
      // with no ease it's a hard cut: 10% for exactly 2 s of screen time, which plays 0.2 s of source
      r.hardCut = +(srcTime(R3(), R3().start + 3) - srcTime(R3(), R3().start + 1)).toFixed(3);
      seek(R3().start + .3); $('#inspector [data-act=smmove]').click(); r.moved = +R3().slowmos[0].t.toFixed(2);
      const saved2 = JSON.parse(projectJSON()).layers.find(L => L.kind === 'video').slowmos; r.savedInProject = saved2 && saved2.length;
      $('#inspector [data-act=smdel]').click(); r.deleted = !R3().slowmos && !ramped(R3()) && Math.abs(len(R3()) - before) < 1e-6;
      while (undoStack.length > undoBase) undo(); refresh(); r.undone = !ramped(R3());
      step('speedRamp', r);
    }

    // export straight to a file
    window.__lastExport = null;
    S.layers.forEach(L => { if (L.kind !== 'video') L.dur = 2.5; });
    await startExport();
    await new Promise(r => { const i = setInterval(() => { if (window.__lastExport) { clearInterval(i); r(); } }, 200); setTimeout(r, 40000); });
    if (window.__lastExport) {
      const ext = __lastExport.type.includes('mp4') ? 'mp4' : 'webm';
      const p = await lumina.saveExport(await __lastExport.arrayBuffer(), 'export.' + ext, dir + 'export.' + ext);
      step('exported', { path: p, mb: +(__lastExport.size / 1048576).toFixed(2), mime: __lastExport.type });
      // every export format, from the real recording (the h264 copy path) and from a webm (the re-encode path)
      const rec = await __lastExport.arrayBuffer(), web = await f.arrayBuffer(), conv = {};
      const recMime = MediaRecorder.isTypeSupported('video/mp4;codecs=avc1.640028,mp4a.40.2') ? 'video/mp4;codecs=avc1.640028,mp4a.40.2' : __lastExport.type;
      const exts = { mp4: 'mp4', mov: 'mov', mkv: 'mkv', avi: 'avi', webm: 'webm', flv: 'flv', wmv: 'wmv', mts: 'm2ts', vob: 'vob', ogv: 'ogv' };
      for (const [fmt, x] of Object.entries(exts)) for (const [tag, data, src] of [['rec', rec, recMime], ['web', web, 'video/webm;codecs=vp8']]) {
        const t0 = performance.now();
        try {
          const out = await lumina.convertExport({ data: data.slice(0), name: 'x', fmt, src, duration: 2.5, w: W(), h: H(), fps: S.fps, filePath: `${dir}conv-${tag}.${x}` });
          conv[`${tag}.${x}`] = { ok: !!out, s: +((performance.now() - t0) / 1000).toFixed(1) };
        } catch (e) { conv[`${tag}.${x}`] = { error: String(e.message || e).slice(-300) }; }
      }
      step('converted', conv);
    } else step('exported', 'timed out');
    chooseExport();
    step('picker', { options: document.querySelectorAll('#mText input[name=fmt]').length, checked: $('#mText input[name=fmt]:checked')?.value });
    $('#mOk').click();
    // Save as: project plus every video format; a video pick starts the export
    chooseSaveAs();
    const sa = { options: document.querySelectorAll('#mText input[name=fmt]').length, checked: $('#mText input[name=fmt]:checked')?.value };
    $('#mText input[value=mkv]').checked = true; $('#mGo').click();
    await new Promise(r => setTimeout(r, 500));
    sa.startedExport = S.exporting?.fmt || null; sa.title = $('#mTitle').textContent; $('#mCancel')?.click();
    step('saveAsPicker', sa);
    $('#modal').hidden = true;
    { const v = S.layers.find(L => L.kind === 'video'); S.sel = v.id; seek(v.start + 1); applyPreset(v, 'slowmo'); seek(v.start + 1.3); }
    refresh(); await settle(1);
    R.errors = __errs;
  } catch (e) { R.error = String(e && e.stack || e); }
  return R;
})()
