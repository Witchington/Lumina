// Beat sync test (CapCut phase C1): a synthetic 120 BPM track with known beat times. Detection, steady beat vs every hit,
// beat marks on the timeline, magnetic snapping (and Shift to turn it off), cut on beats, impacts on beats, add/delete,
// marks moving with the clip, undo, save/reopen, and speed on a 3-minute song.
(async () => {
  const R = { steps: {} }, step = (k, v) => R.steps[k] = v;
  try {
    const dir = 'D:\\Lumina\\.claude\\beat\\media\\';
    // mono 16-bit WAV: a kick (decaying 55 Hz thump + click) on every beat from `first` s, and a quieter hi-hat on each off-beat
    const makeSong = async (secs, name, first = 1, bpm = 120) => {
      const sr = 22050, n = Math.round(secs * sr), x = new Float32Array(n), per = 60 / bpm;
      let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647 * 2 - 1;
      const hit = (t0, kind) => { const s0 = Math.round(t0 * sr);
        for (let i = 0; i < sr * .25 && s0 + i < n; i++) { const t = i / sr;
          x[s0 + i] += kind === 'kick' ? .8 * Math.sin(2 * Math.PI * 55 * t) * Math.exp(-t * 18) + .5 * rnd() * Math.exp(-t * 300) : .18 * rnd() * Math.exp(-t * 60); } };
      const truth = [];
      for (let t = first; t < secs - .3; t += per) { hit(t, 'kick'); truth.push(t); if (t + per / 2 < secs - .3) hit(t + per / 2, 'hat'); }
      const buf = new ArrayBuffer(44 + n * 2), v = new DataView(buf), str = (o, s) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
      str(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); str(8, 'WAVE'); str(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
      v.setUint32(24, sr, true); v.setUint32(28, sr * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true); str(36, 'data'); v.setUint32(40, n * 2, true);
      for (let i = 0; i < n; i++) v.setInt16(44 + i * 2, clamp(x[i], -1, 1) * 32767, true);
      const f = new File([buf], name, { type: 'audio/wav' }); f.__path = await lumina.saveExport(buf, name, dir + name);
      return { f, truth };
    };
    const song = await makeSong(12, 'song120.wav', 1);
    const A = await load(song.f); A.start = 0;
    S.sel = A.id; setRightTab('props'); refresh();
    const ui0 = { panel: !!$('#inspector [data-act=beats]'), text: $('#inspector [data-act=beats]')?.textContent };

    // detect: the steady beat lands on every kick, about 120 BPM, nothing in the silent first second
    let t0 = performance.now(); await detectBeats(A); const detectMs = Math.round(performance.now() - t0);
    const B = A.beats, near = (ts, truth) => ts.map(t => Math.min(...truth.map(u => Math.abs(u - t))));
    const errs = near(B.times, song.truth), worst = Math.max(...errs), missed = song.truth.filter(u => !B.times.some(t => Math.abs(t - u) < .04)).length;
    step('detect', { bpm: B.bpm, beats: B.times.length, truth: song.truth.length, worstMs: Math.round(worst * 1000), missed, firstBeat: +B.times[0].toFixed(3), detectMs,
      works: Math.abs(B.bpm - 120) < 1.5 && worst < .03 && missed === 0 && B.times.length === song.truth.length && B.times[0] > .9 });

    // panel and marks
    const marks = document.querySelectorAll(`.trow[data-id="${A.id}"] .bt`).length;
    step('panel', { before: ui0, marks, says: $('#inspector .group p.empty')?.textContent.slice(0, 40), modeMenu: !!$('#b-mode'), cutHint: $('#inspector [data-act=beatcut]') ? 'cut button' : 'no clip to cut yet',
      works: ui0.panel && marks === B.times.length && /about 120/.test($('#inspector').textContent) });

    // every hit: high sensitivity also finds the hi-hats (about twice as many marks); low sensitivity only the kicks
    const sel = (id, v) => { const s = $(id); s.value = v; s.dispatchEvent(new Event('input', { bubbles: true })); s.dispatchEvent(new Event('change', { bubbles: true })); };
    sel('#b-mode', 'hits'); sel('#b-sens', 90); const hitsHi = A.beats.times.length;
    sel('#b-sens', 5); const hitsLo = A.beats.times.length, loErr = Math.max(...near(A.beats.times, song.truth));
    const extras = A.beats.times.filter(t => !song.truth.some(u => Math.abs(u - t) < .04)).map(t => +t.toFixed(3));
    const rs = MEDIA[A.media].beatEnv.rise, fr = t => Math.round((t * BEAT_SR - BEAT_N / 2) / BEAT_HOP), rAt = t => { let m = 0; for (let k = fr(t) - 3; k <= fr(t) + 3; k++) m = Math.max(m, rs[k] || 0); return m; };
    const hatRatio = +(song.truth.slice(1, 6).map(t => rAt(t + .25) / rAt(t)).reduce((a, b) => a + b) / 5).toFixed(3);
    sel('#b-mode', 'beats'); const back = A.beats.times.length;
    step('hits', { highSensitivity: hitsHi, lowSensitivity: hitsLo, lowWorstMs: Math.round(loErr * 1000), lowExtras: extras, hatToKick: hatRatio, backToSteady: back,
      works: hitsHi >= 2 * song.truth.length - 2 && hitsLo === song.truth.length && loErr < .03 && back === song.truth.length });

    // snapping: a clip edge or keyframe 4 px from a beat lands on it; Shift (snapOff) leaves it alone
    const card = await makeCard(['30,30,30', '200,60,60', '60,60,200'], 'card.png', false);
    card.__path = await lumina.saveExport(await card.arrayBuffer(), 'card.png', dir + 'card.png');
    const I = await load(card); I.start = 0; I.dur = 4; seek(6.3);
    const b2 = A.beats.times[2], off = 4 / S.pps;
    const snapped = snapT(b2 + off, I), keySnap = snapT(b2 - off, I, true); snapOff = true; const free = snapT(b2 + off, I); snapOff = false;
    step('snap', { beat: +b2.toFixed(3), snapped: +snapped.toFixed(3), keyframeSnapped: +keySnap.toFixed(3), withShift: +free.toFixed(3),
      works: Math.abs(snapped - b2) < 1e-9 && Math.abs(keySnap - b2) < 1e-9 && Math.abs(free - (b2 + off)) < 1e-9 });

    // marks move with the clip
    const tlBefore = beatTimesTL(A)[0].t; A.start = .25; const tlAfter = beatTimesTL(A)[0].t; A.start = 0;
    step('followsClip', { first: +tlBefore.toFixed(3), afterMove: +tlAfter.toFixed(3), works: Math.abs(tlAfter - tlBefore - .25) < 1e-6 });

    // cut on beats, every 2nd beat: the 4-second picture splits at 1, 2 and 3 s
    S.sel = A.id; refresh(); sel('#b-every', 2); refresh();
    $('#b-target').value = I.id; $('#inspector [data-act=beatcut]').click(); $('#modal').hidden = true;
    const pieces = S.layers.filter(x => x.kind === 'image').map(x => [+x.start.toFixed(3), +endOf(x).toFixed(3)]).sort((a, b) => a[0] - b[0]);
    step('cut', { pieces, works: pieces.length === 4 && pieces.every((p, k) => Math.abs(p[0] - k) < .03) && Math.abs(pieces[3][1] - 4) < 1e-6 });

    // impacts on every 4th beat: 1, 3, 5, 7, 9, 11 s
    S.sel = A.id; refresh(); sel('#b-every', 4); refresh(); const nImp = S.impacts.length;
    $('#inspector [data-act=beatimp]').click(); $('#modal').hidden = true;
    const imps = S.impacts.slice(nImp).map(m => +m.t.toFixed(2));
    step('impacts', { at: imps, works: imps.length === 6 && imps.every((t, k) => Math.abs(t - (1 + 2 * k)) < .03) });

    // C4 effect triggers read the beats: every beat, every 2nd, every 4th
    const hit1 = vfxHitTimes(1), hit2 = vfxHitTimes(2), hit4 = vfxHitTimes(4), bt = beatTimesTL(A).map(b => b.t);
    const fxGainAt = (t, mode) => vfxGain({ T: t }, k => k === 'trigger' ? mode : .3);
    step('vfxTriggers', { every: hit1.length, every2nd: hit2.length, every4th: hit4.length, beats: bt.length, gainOnBeat: +fxGainAt(bt[4], 1).toFixed(3), gainBetween: +fxGainAt(bt[4] + .35, 1).toFixed(3), gain2ndOffBeat: +fxGainAt(bt[5] + .01, 2).toFixed(3),
      works: hit1.length === bt.length && hit1.every((t, k) => Math.abs(t - bt[k]) < 1e-3) && hit2.length === Math.ceil(bt.length / 2) && hit4.length === Math.ceil(bt.length / 4)
        && Math.abs(fxGainAt(bt[4], 1) - 1) < .01 && fxGainAt(bt[4] + .35, 1) === 0 && fxGainAt(bt[5] + .01, 2) < .01 });

    // add a beat at the playhead, then click it and delete it; undo brings back cleared beats
    const n0 = A.beats.times.length; seek(1.23); S.sel = A.id; refresh(); $('#inspector [data-act=beatadd]').click();
    const added = A.beats.times.length, at = A.beats.times.findIndex(t => Math.abs(t - 1.23) < 1e-6);
    selBeat = { id: A.id, i: at }; del(); const afterDel = A.beats.times.length;
    S.sel = A.id; refresh(); $('#inspector [data-act=beatclr]').click(); const cleared = !A.beats; undo(); const restored = byId(A.id)?.beats?.times?.length;
    step('edit', { before: n0, added, afterDelete: afterDel, cleared, afterUndo: restored, works: added === n0 + 1 && afterDel === n0 && cleared && restored === n0 });

    // ---- C2 bookmarks: B toggles one at the playhead (frame-rounded), notes show on the preview, colours, duration,
    // snapping to the bookmark and its end, [ ] jumping, dragging (with Shift: no snap), merging, delete, undo
    const key = k => document.body.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true }));
    S.pps = 60; refresh();
    seek(5.2514); key('b'); const bm1 = S.bookmarks[0];
    const bmAdded = { count: S.bookmarks.length, t: bm1?.t, selected: S.sel === bm1?.id, panel: !!$('#bm-note'), rowMarks: document.querySelectorAll('.bm[data-bm]').length };
    key('b'); const removed = S.bookmarks.length; key('b');
    const b1 = S.bookmarks[0];
    const typeIn = (sel, v) => { const el = $(sel); el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); };
    typeIn('#bm-note', 'Drop hits here'); $('#inspector [data-act=bmcolor][data-c="#ff5d5d"]').click();
    S.sel = b1.id; refresh(); typeIn('#bm-dur', '1.5');
    // the note box at the top left of the preview: some bright pixels there while the playhead is inside the bookmark
    const noteInk = t => { seek(t); drawOverlay(); const d = octx.getImageData(0, 0, Math.round(ov.width * .2), Math.round(ov.height * .15)).data; let n = 0; for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 100 && d[i] > 200 && d[i + 1] > 200) n++; return n; };
    const inkAt = noteInk(5.25), inkInside = noteInk(6.5), inkAfter = noteInk(7.2); showBmNotes = false; const inkHidden = noteInk(5.25); showBmNotes = true;
    const rangeBar = !!document.querySelector('.bmr');
    step('bookmarkAdd', { added: bmAdded, afterSecondB: removed, note: b1.note, color: b1.color, dur: b1.dur, rangeBar, noteInk: { at: inkAt, inside: inkInside, after: inkAfter, hidden: inkHidden },
      works: bmAdded.count === 1 && Math.abs(bmAdded.t - 5.25) < 1e-9 && bmAdded.selected && bmAdded.panel && bmAdded.rowMarks === 1 && removed === 0 && S.bookmarks.length === 1
        && b1.note === 'Drop hits here' && b1.color === '#ff5d5d' && b1.dur === 1.5 && rangeBar && inkAt > 20 && inkInside > 20 && inkAfter === 0 && inkHidden === 0 });

    // snapping and jumping
    seek(0); const sStart = snapT(5.25 + 3 / S.pps, null), sEnd = snapT(6.75 - 3 / S.pps, null);
    seek(8); key('b'); const bm2 = S.bookmarks.find(x => Math.abs(x.t - 8) < 1e-9);
    seek(0); key(']'); const j1 = S.time; key(']'); const j2 = S.time; key('['); const j3 = S.time; key('['); const j4 = S.time;
    step('bookmarkSnapJump', { snappedToStart: +sStart.toFixed(3), snappedToEnd: +sEnd.toFixed(3), jumps: [j1, j2, j3, j4].map(v => +v.toFixed(3)),
      works: Math.abs(sStart - 5.25) < 1e-9 && Math.abs(sEnd - 6.75) < 1e-9 && !!bm2 && [j1, j2, j3, j4].join() === [5.25, 8, 5.25, 5.25].join() });

    // drag with the mouse: Shift-drag to 7.5 (no snapping, frame-rounded); a plain drag onto the 8 s bookmark merges them
    const tlEl = $('#tl'), capture = tlEl.setPointerCapture; tlEl.setPointerCapture = () => {};
    const xAt = t => $('#tlin').getBoundingClientRect().left + HEADW + t * S.pps;
    const dragBm = (b, to, shiftKey) => {
      const el = document.querySelector(`.bm[data-bm="${b.id}"]`), y = el.getBoundingClientRect().top + 8;
      el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: xAt(b.t), clientY: y, pointerId: 1, button: 0 }));
      tlEl.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, clientX: xAt(to), clientY: y, pointerId: 1, shiftKey }));
      tlEl.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, clientX: xAt(to), clientY: y, pointerId: 1 }));
    };
    dragBm(b1, 7.5 + .2 / S.fps, true); const draggedTo = b1.t;
    dragBm(b1, 8 + 2 / S.pps, false); const merged = S.bookmarks.length, mergedAt = S.bookmarks[0]?.t, keptNote = S.bookmarks[0]?.note;
    tlEl.setPointerCapture = capture;
    step('bookmarkDrag', { shiftDragTo: +draggedTo.toFixed(4), afterMerge: merged, at: mergedAt, keptNote,
      works: Math.abs(draggedTo - 7.5) < 1e-9 && merged === 1 && Math.abs(mergedAt - 8) < 1e-9 && keptNote === 'Drop hits here' });

    // delete the selected bookmark with Delete, undo brings it back; then add a second one for the save test
    S.sel = S.bookmarks[0].id; refresh(); key('Delete'); const afterDelBm = S.bookmarks.length; undo(); const afterUndoBm = S.bookmarks.length;
    seek(2); key('b');
    step('bookmarkDelete', { afterDelete: afterDelBm, afterUndo: afterUndoBm, now: S.bookmarks.length, works: afterDelBm === 0 && afterUndoBm === 1 && S.bookmarks.length === 2 });
    const keepBm = JSON.stringify(S.bookmarks.map(({ t, note, color, dur }) => ({ t, note, color, dur })));

    // saved and reopened: beats are kept
    const A0 = byId(A.id), keep = A0.beats.times.slice();
    PROJ.path = dir + 'beats.lumina'; await saveProject();
    S.layers = []; for (const k in RT) delete RT[k]; refresh();
    await openProject(dir + 'beats.lumina');
    const A2 = S.layers.find(x => x.kind === 'audio');
    const gotBm = JSON.stringify(S.bookmarks.map(({ t, note, color, dur }) => ({ t, note, color, dur })));
    step('reopened', { beats: A2?.beats?.times?.length, same: !!A2 && A2.beats.times.every((t, k) => Math.abs(t - keep[k]) < 1e-9), bookmarks: gotBm,
      works: !!A2 && A2.beats.times.length === keep.length && gotBm === keepBm });

    // speed: a 3-minute song at 128 BPM
    const long = await makeSong(180, 'song3min.wav', .5, 128);
    const L3 = await load(long.f); t0 = performance.now(); await detectBeats(L3); const longMs = Math.round(performance.now() - t0);
    const lErr = near(L3.beats.times, long.truth).sort((a, b) => a - b), missedL = long.truth.filter(u => !L3.beats.times.some(t => Math.abs(t - u) < .04)).length;
    step('speed', { secondsOfMusic: 180, ms: longMs, bpm: L3.beats.bpm, beats: L3.beats.times.length, truth: long.truth.length, missed: missedL, medianErrMs: Math.round(lErr[lErr.length >> 1] * 1000),
      works: longMs < 15000 && Math.abs(L3.beats.bpm - 128) < 1.5 && missedL <= 2 });

    // leave the 120 BPM song on screen with its beat marks, for the screenshot
    const L3i = S.layers.indexOf(L3); if (L3i >= 0) { S.layers.splice(L3i, 1); delete RT[L3.id]; }
    $('#modal').hidden = true; S.sel = A2?.id ?? null; S.pps = 80; refresh(); seek(8.5); drawOverlay();
    await new Promise(r => setTimeout(r, 600));
    R.errors = __errs;
  } catch (e) { R.error = String(e && e.stack || e); R.errors = window.__errs; }
  return R;
})()
