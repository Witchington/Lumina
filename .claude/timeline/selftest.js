// Timeline test (friend's bug report, 2026-11-07): drag step and snap settings, a long edit staying light to drag,
// playback that waits for a slow video instead of running ahead and jumping back, the last frame held while a video
// loads, and clips sharing one track.
(async () => {
  const R = { steps: {} }, step = (k, v) => R.steps[k] = v;
  const keepSet = { ...TLSET };
  try {
    S.global.vignette = 0;
    Object.assign(TLSET, { step: 0, snapEdges: true, snapMarks: true });
    const card = (c, n) => makeCard([c, c, c, c, c, c], n, false);
    const A = await load(await card('200,40,40', 'A.png')); A.start = 0; A.dur = 4;
    const B = await load(await card('40,40,200', 'B.png')); B.start = 6; B.dur = 3;
    S.pps = 100; seek(20); refresh();

    // drag a clip by its bar with the pointer, like a person does
    const tlEl = $('#tl'), capture = tlEl.setPointerCapture; tlEl.setPointerCapture = () => {};
    const xAt = t => $('#tlin').getBoundingClientRect().left + HEADW + t * S.pps;
    const dragClip = (L, grabT, toT, shiftKey) => {
      const bar = document.querySelector(`.trow[data-id="${L.id}"] .bar`), y = bar.getBoundingClientRect().top + 6;
      bar.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: xAt(grabT), clientY: y, pointerId: 1, button: 0 }));
      tlEl.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, clientX: xAt(toT), clientY: y, pointerId: 1, shiftKey }));
      tlEl.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, clientX: xAt(toT), clientY: y, pointerId: 1 }));
    };

    // the settings are in Properties with nothing selected
    S.sel = null; setRightTab('props'); refresh();
    const ui = { step: !!$('#tl-step'), edges: !!$('#tl-edge'), marks: !!$('#tl-mark'), options: [...($('#tl-step')?.options || [])].map(o => o.textContent) };
    const pick = (sel, v) => { const el = $(sel); if (el.type === 'checkbox') el.checked = v; else el.value = v; el.dispatchEvent(new Event('change', { bubbles: true })); };
    pick('#tl-step', '0.5'); const stepSet = TLSET.step; pick('#tl-step', '0');
    step('panel', { ...ui, stepAfterPick: stepSet, works: ui.step && ui.edges && ui.marks && ui.options.length >= 6 && stepSet === .5 });

    // free: B dragged from 6 to 6.37 lands at 6.37; with a 0.5 s step it lands on 6.5; Shift ignores the step
    dragClip(B, 7, 7.37); const free = B.start;
    TLSET.step = .5; dragClip(B, 7.5, 7.37 + .5 - .37 + .12); const stepped = B.start;   // drop near 6.62 → 6.5
    dragClip(B, 7, 7.13, true); const shifted = B.start;
    TLSET.step = -1; B.start = 6; dragClip(B, 7, 7.0123); const frame = B.start; TLSET.step = 0;
    step('dragStep', { free: +free.toFixed(4), halfSecond: +stepped.toFixed(4), shift: +shifted.toFixed(4), oneFrame: +frame.toFixed(4),
      works: Math.abs(free - 6.37) < .002 && Math.abs(stepped - 6.5) < 1e-9 && Math.abs(shifted - 6.63) < .002 && Math.abs(frame * S.fps - Math.round(frame * S.fps)) < 1e-6 });

    // snapping to edges: B dropped 4 px after A's end lands on it; with "To the edges of other clips" off it stays
    B.start = 6; dragClip(B, 7, 7 - 6 + 4 + 4 / S.pps); const snapped = B.start;
    pick('#tl-edge', false); B.start = 6; dragClip(B, 7, 7 - 6 + 4 + 4 / S.pps); const unsnapped = B.start; pick('#tl-edge', true);
    // the playhead / beats / bookmarks switch
    seek(5); pick('#tl-mark', false); B.start = 6; dragClip(B, 7, 7 - 6 + 5 + 3 / S.pps); const noPh = B.start; pick('#tl-mark', true);
    B.start = 6; dragClip(B, 7, 7 - 6 + 5 + 3 / S.pps); const ph = B.start;
    step('snap', { toEdge: +snapped.toFixed(4), edgesOff: +unsnapped.toFixed(4), playheadOff: +noPh.toFixed(4), playheadOn: +ph.toFixed(4),
      works: Math.abs(snapped - 4) < 1e-9 && Math.abs(unsnapped - 4.04) < .002 && Math.abs(noPh - 5.03) < .002 && Math.abs(ph - 5) < 1e-9 });

    // a 1 h 42 min edit at a close zoom: the ruler draws only what's in view, and a drag stays quick
    const longL = await load(await card('40,160,40', 'long.png')); longL.start = 0; longL.dur = 6159; S.pps = 195; refresh();
    const spans = document.querySelectorAll('#tlin .ruler span').length;
    let t0 = performance.now(); for (let i = 0; i < 20; i++) buildTimeline(); const buildMs = +((performance.now() - t0) / 20).toFixed(2);
    t0 = performance.now(); for (let i = 0; i < 20; i++) dragClip(B, 7 + i * .01, 7.2 + i * .01); const dragMs = +((performance.now() - t0) / 20).toFixed(2);
    // scrolled far right: labels are drawn there too
    tlEl.scrollLeft = 3000 * S.pps; rulerFollow();
    const labels = [...document.querySelectorAll('#tlin .ruler span')].map(s => parseFloat(s.style.left) / S.pps), nearView = labels.some(t => Math.abs(t - 3000) < 3);
    tlEl.scrollLeft = 0; rulerFollow();
    step('longEdit', { rulerLabels: spans, buildMs, dragMs, labelsAfterScroll: nearView, works: spans < 400 && nearView });
    S.layers.splice(S.layers.indexOf(longL), 1); S.pps = 100; tlEl.scrollLeft = 0; refresh();

    // shared tracks: drag B (blue, 3-6 s) down/up onto A's row (red, 0-4 s); they share it, and the 1 s overlap crossfades
    Object.assign(TLSET, { snapEdges: false, snapMarks: false });
    A.start = 0; A.dur = 4; B.start = 3; B.dur = 3; S.sel = null; clearMulti(); refresh();
    const rowsBefore = document.querySelectorAll('#tlin .trow[data-id]').length;
    const rowOf = L => document.querySelector(`.trow [data-lid="${L.id}"]`)?.closest('.trow');
    {
      const bar = document.querySelector(`[data-lid="${B.id}"] .bar`), y0 = bar.getBoundingClientRect().top + 6, ta = rowOf(A).getBoundingClientRect(), y1 = ta.top + ta.height / 2;
      bar.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: xAt(4.5), clientY: y0, pointerId: 1, button: 0 }));
      tlEl.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, clientX: xAt(4.5), clientY: y1, pointerId: 1 }));
      const highlighted = !!document.querySelector('.trow.droptgt');
      tlEl.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, clientX: xAt(4.5), clientY: y1, pointerId: 1 }));
      R.dropHighlight = highlighted;
    }
    const shared = A.track != null && A.track === B.track, rowsAfter = document.querySelectorAll('#tlin .trow[data-id]').length;
    const trkRow = document.querySelector('.trow.trk'), barsInRow = trkRow?.querySelectorAll('.bar').length, headText = trkRow?.querySelector('.nm')?.textContent;
    const T = transList().find(x => x.auto && x.B === B);
    await settle(2.5); const red = pix(.5, .5); await settle(3.5); const mid = pix(.5, .5); await settle(5); const blue = pix(.5, .5);
    step('sharedTrack', { highlighted: R.dropHighlight, shared, rowsBefore, rowsAfter, barsInRow, headText, startKept: B.start, blend: T && [T.t0, T.t1, T.type], red, mid, blue,
      works: R.dropHighlight && shared && rowsAfter === rowsBefore - 1 && barsInRow === 2 && /2 clips/.test(headText || '') && B.start === 3 && T && T.t0 === 3 && T.t1 === 4
        && red[0] > 150 && red[2] < 90 && blue[2] > 150 && blue[0] < 90 && mid[0] > 70 && mid[2] > 70 });

    // in the shared row: pressing B's bar picks B (not A); the head picks both; B moves along its row and stays on it
    { const bar = document.querySelector(`[data-lid="${B.id}"] .bar`), y = bar.getBoundingClientRect().top + 6;
      bar.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: xAt(5), clientY: y, pointerId: 1, button: 0 }));
      tlEl.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, clientX: xAt(5.5), clientY: y, pointerId: 1 }));
      tlEl.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, clientX: xAt(5.5), clientY: y, pointerId: 1 })); }
    const pickedB = S.sel === B.id, movedB = +B.start.toFixed(3), stillShared = A.track === B.track;
    document.querySelector('.trow.trk .thead .nm').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 1, button: 0 }));
    const headPicks = selIds().length;
    const own = rowOf(B).querySelectorAll('.bar').length;
    // box selection finds both bars in the one row
    const tr = rowOf(A).getBoundingClientRect(), boxed = boxHits(xAt(1), tr.top + 2, xAt(5), tr.bottom - 2).sort();
    step('sharedRowClicks', { pickedB, movedB, stillShared, headPicks, barsInRow: own, boxed: boxed.length, works: pickedB && movedB === 3.5 && stillShared && headPicks === 2 && own === 2 && boxed.length === 2 });

    // Own track, Put on one track, undo, saved in the project, sound and picture kept apart
    clearMulti(); S.sel = B.id; refresh(); $('#inspector [data-act=ownrow]').click();
    const apart = A.track == null && B.track == null && document.querySelectorAll('#tlin .trow[data-id]').length === rowsBefore;
    setMulti([A.id, B.id], A.id); refresh(); $('#inspector [data-act=onetrack]').click();
    const together = A.track != null && A.track === B.track;
    const savedTracks = JSON.parse(projectJSON()).layers.filter(x => x.track != null).length;
    undo(); const undone = byId(A.id)?.track == null && byId(B.id)?.track == null;
    const soundBlocked = !!trackBlock({ kind: 'audio', p: {} }, byId(A.id));
    step('trackButtons', { apart, together, savedTracks, undone, soundBlocked, works: apart && together && savedTracks === 2 && undone && soundBlocked });
    Object.assign(TLSET, { snapEdges: true, snapMarks: true });
    tlEl.setPointerCapture = capture;

    // playback into a clip that loads slowly (its file "on a slow drive": every read waits 1.2 s). Before, the clock ran
    // on through the stall and then jumped back to where the video was; now it waits on the last good frame.
    for (const L of [A, B]) L.visible = false;
    const dir = 'D:\\Lumina\\.claude\\timeline\\';
    const vf = await makeClip(6, 'PLAY', '#2050d0'); vf.__path = await lumina.saveExport(await vf.arrayBuffer(), 'PLAY.webm', dir + 'PLAY.webm');
    const V1 = await load(vf); V1.start = 0; V1.in = 0; V1.out = 3;
    const V2 = await load(vf); V2.start = 3; V2.in = 3; V2.out = 6;
    seek(2.6); await settle(2.6);
    const e2 = RT[V2.id].el; e2.src = MEDIA[V2.media].url + '?slow=1200'; e2.load();
    const drive = setInterval(tick, 16);   // a steady 60 frames a second, even with the test window covered
    await play();
    const seen = [], w0 = performance.now(); let notes = 0;
    await new Promise(res => { const i = setInterval(() => {
      seen.push([+((performance.now() - w0) / 1000).toFixed(2), +S.time.toFixed(3), !!S.waiting]); if (loadingSince) notes++;
      if (S.time > 4 || performance.now() - w0 > 9000) { clearInterval(i); res(); } }, 40); });
    pause(); clearInterval(drive);
    let back = 0; for (let i = 1; i < seen.length; i++) back = Math.max(back, seen[i - 1][1] - seen[i][1]);
    const waited = seen.filter(s => s[2]).length * .04, heldAt = seen.filter(s => s[2]).map(s => s[1]);
    step('slowClip', { waitedSeconds: +waited.toFixed(2), clockWhileWaiting: [Math.min(...heldAt), Math.max(...heldAt)], biggestJumpBack: +back.toFixed(3), loadingNoteFrames: notes,
      reached: +S.time.toFixed(2), samples: seen.filter((s, k) => k % 5 === 0).map(s => s.join(' ')),
      works: back < .05 && waited > .3 && heldAt.every(t => t < 3.02) && S.time > 4 });

    // the same without waiting (the old way), for comparison: the clock runs on, then jumps back
    {
      const keepWait = window.waitForMedia; window.waitForMedia = () => (S.waiting = false);
      seek(2.6); await settle(2.6); e2.src = MEDIA[V2.media].url + '?slow=1200&n=2'; e2.load();
      const drive2 = setInterval(tick, 16); await play(); const s2 = [], w1 = performance.now();
      await new Promise(res => { const i = setInterval(() => { s2.push(S.time); if (S.time > 4 || performance.now() - w1 > 9000) { clearInterval(i); res(); } }, 40); });
      pause(); clearInterval(drive2); window.waitForMedia = keepWait;
      let back2 = 0; for (let i = 1; i < s2.length; i++) back2 = Math.max(back2, s2[i - 1] - s2[i]);
      R.oldWayJumpBack = +back2.toFixed(3);
    }

    // the last frame stays up while a clip loads after a jump (a black hole before)
    await settle(1); const shown = pix(.5, .5);
    const e1 = RT[V1.id].el; e1.src = MEDIA[V1.media].url + '?slow=1500'; e1.load(); RT[V1.id].held = RT[V1.id].held || null;
    render(); const whileLoading = pix(.5, .5), wasReady = e1.readyState;
    const diff = Math.max(...shown.map((v, k) => Math.abs(v - whileLoading[k])));
    step('holdFrame', { before: shown, whileLoading, readyState: wasReady, diff, works: wasReady < 2 && diff < 16 && shown.some(v => v > 60) });

    // smooth editing: the panel reads the file's format; "Make an edit copy" makes an H.264 copy with a full picture
    // every half second, and every clip from that file switches to it (and back)
    for (const L of [V1, V2]) { const el = RT[L.id].el; el.src = MEDIA[L.media].url; }
    S.sel = V1.id; setRightTab('props'); refresh();
    for (let i = 0; i < 100 && (MEDIA[V1.media].probe === undefined || MEDIA[V1.media].probe === 'busy'); i++) await new Promise(r => setTimeout(r, 100));
    const p0 = MEDIA[V1.media].probe; refresh();
    const panel0 = [...document.querySelectorAll('#inspector .group')].find(g => /Smooth editing/.test(g.textContent))?.textContent.replace(/\s+/g, ' ').trim();
    $('#inspector [data-act=optmake]')?.click();
    const sawProgress = !!OPT[V1.media];
    for (let i = 0; i < 300 && OPT[V1.media]; i++) await new Promise(r => setTimeout(r, 100));
    const m1 = MEDIA[V1.media], copy = m1.path, p1 = await lumina.probeMedia(copy);
    const srcs = [V1, V2].map(L => decodeURIComponent(RT[L.id].el.src)), switched = srcs.every(s => s === decodeURIComponent(m1.url));
    R.srcs = [...srcs, decodeURIComponent(m1.url)];
    const savedOrig = JSON.parse(projectJSON()).media[V1.media]?.origPath;
    refresh(); const panel1 = [...document.querySelectorAll('#inspector .group')].find(g => /Smooth editing/.test(g.textContent))?.textContent.replace(/\s+/g, ' ').trim();
    await settle(4); const fromCopy = pix(.5, .5);
    $('#inspector [data-act=optorig]')?.click(); const backPath = MEDIA[V1.media].path;
    step('editCopy', { original: p0 && { codec: p0.codec, size: `${p0.w}x${p0.h}`, fps: p0.fps, keyGap: p0.keyGap }, panelBefore: panel0, sawProgress,
      copy: copy.split('\\').pop(), copyInfo: p1 && { codec: p1.codec, size: `${p1.w}x${p1.h}`, fps: p1.fps, keyGap: p1.keyGap, duration: p1.duration }, switched, savedOrig: savedOrig?.split('\\').pop(),
      panelAfter: panel1, frameFromCopy: fromCopy, backToOriginal: backPath.split('\\').pop(),
      works: !!p0?.video && p0.w === 640 && sawProgress && /\(edit copy\)\.mp4$/.test(copy) && p1?.codec === 'h264' && p1.keyGap <= .55 && Math.abs(p1.duration - p0.duration) < .2
        && switched && /PLAY\.webm$/.test(savedOrig || '') && /edit copy/.test(panel1 || '') && fromCopy.some(v => v > 60) && /PLAY\.webm$/.test(backPath) });

    // impacts: flash, screen shake and zoom punch each have their own slider (moving one leaves the others alone)
    {
      const slide = (id, v) => { const el = $(id); el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); };
      seek(1); addImpact(); const m = S.impacts[S.impacts.length - 1]; setRightTab('props'); refresh();
      const sliders = ['#i-flash', '#i-shake', '#i-zoom'].map(s => !!$(s));
      slide('#i-flash', .2); slide('#i-shake', 1.5);
      const amounts = { flash: m.flash, shake: m.shake, zoom: m.zoom }, k = impactAt(m.t);
      // the picture: flash, shake and zoom all at 0 looks the same as no impact; flash alone brightens it
      const plain = (() => { const keep = S.impacts; S.impacts = []; render(m.t); const p = pix(.5, .2); S.impacts = keep; return p; })();
      slide('#i-flash', 0); slide('#i-shake', 0); slide('#i-zoom', 0); render(m.t); const allOff = pix(.5, .2);
      slide('#i-flash', 1); render(m.t); const flashOnly = pix(.5, .2);
      // an older impact (one strength for everything) keeps working, and splits up when a slider is moved
      const old = { id: uid++, t: 1.6, strength: .5, dur: .3 }; S.impacts.push(old); S.sel = old.id; refresh();
      const oldK = impactAt(old.t), oldPanel = +$('#i-shake').value; slide('#i-flash', 1.2);
      const oldSplit = { flash: old.flash, shake: old.shake, zoom: old.zoom, strength: old.strength };
      const saved = JSON.parse(projectJSON()).impacts.find(x => x.id === m.id);
      step('impactParts', { sliders, amounts, impactAt: k, plain, allOff, flashOnly, oldK, oldPanel, oldSplit, saved: saved && [saved.flash, saved.shake, saved.zoom],
        works: sliders.every(Boolean) && amounts.flash === .2 && amounts.shake === 1.5 && amounts.zoom === 1 && k.flash === .2 && k.shake === 1.5 && k.zoom === 1
          && plain.join() === allOff.join() && flashOnly.reduce((a, b) => a + b) > plain.reduce((a, b) => a + b) + 60 && oldK.flash === .5 && oldK.shake === .5 && oldPanel === .5
          && oldSplit.flash === 1.2 && oldSplit.shake === .5 && oldSplit.zoom === .5 && oldSplit.strength === undefined && saved && saved.flash === 1 && saved.shake === 0 });
      S.impacts = S.impacts.filter(x => x !== m && x !== old);
      // the panel, for a look: three rows, each slider with its number beside it
      seek(1); addImpact(); const show = S.impacts[S.impacts.length - 1]; refresh(); slide('#i-flash', .3); slide('#i-shake', 1.4);
      const rowsOk = ['flash', 'shake', 'zoom'].every(p => { const r = $('#i-' + p).getBoundingClientRect(), v = $('#iv-' + p).getBoundingClientRect(); return Math.abs((r.top + r.bottom) / 2 - (v.top + v.bottom) / 2) < 4 && v.left > r.right; });
      R.impactPanel = $('#inspector').cloneNode(true).querySelector('.frow')?.parentElement?.textContent.replace(/\s+/g, ' ').trim().slice(0, 160);
      step('impactPanel', { rowsOk, works: rowsOk });
      S.impacts = S.impacts.filter(x => x !== show);
    }

    // ---- Round FP: floating panels. A panel moves into a window of its own, keeps working there, and comes back
    {
      const keepFloat = localStorage.getItem('lumina.floating'), wait = ms => new Promise(r => setTimeout(r, ms));
      const inMain = sel => $(sel)?.ownerDocument === document;
      S.sel = V2.id; refresh();
      const colsBefore = $('main').style.gridTemplateColumns, rowsBefore = $('.rcol').style.gridTemplateRows;
      const pw = floatPanel('props'); await wait(400);
      const props = { opened: !!pw && !pw.closed, moved: !inMain('#pProps'), title: pw?.document.title, css: pw ? getComputedStyle(pw.document.body).display : null,
        inspectorThere: $('#inspector')?.ownerDocument === pw?.document, showsLayer: $$('#inspector .prow').length > 0,
        saved: JSON.parse(localStorage.getItem('lumina.floating') || '{}').props?.on === true, button: $('#pProps .ph-float')?.textContent };
      // selecting another layer in Lumina updates the floating panel
      S.sel = null; refresh(); props.followsSelection = /nothing selected/i.test($('#inspector')?.textContent || '') && !$$('#inspector .prow').length; S.sel = V2.id; refresh();
      // the keyboard works in the panel's window: → steps one frame
      pause(); seek(1); pw.document.body.dispatchEvent(new pw.KeyboardEvent('keydown', { key: 'ArrowRight', code: 'ArrowRight', bubbles: true, cancelable: true }));
      props.keyStep = +(S.time - 1).toFixed(4);
      props.rowsBefore = rowsBefore; props.rowsAfter = $('.rcol').style.gridTemplateRows;
      // the timeline floats too: the main window gives its row to the preview, the bars are drawn in the new window
      const tw = floatPanel('timeline'); await wait(400); buildTimeline();
      const bars = $$('.trow[data-id] .bar');
      const tl = { opened: !!tw && !tw.closed, moved: !inMain('#pTimeline'), mainRows: getComputedStyle(document.body).gridTemplateRows.split(' ').length,
        bars: bars.length, barsThere: bars.length > 0 && bars.every(b => b.ownerDocument === tw.document), tlFloat: document.body.classList.contains('tl-float') };
      // closing a panel's window puts the panel back
      tw.close(); await wait(500);
      tl.backAfterClose = inMain('#pTimeline') && !POP.timeline && !document.body.classList.contains('tl-float');
      tl.savedOff = JSON.parse(localStorage.getItem('lumina.floating') || '{}').timeline?.on === false;
      // the button docks it, back in its place under Preview
      $('#pProps .ph-float').click(); await wait(300);
      props.docked = inMain('#pProps') && $('#pProps').parentElement === $('.rcol') && !POP.props && $('main').style.gridTemplateColumns === colsBefore;
      // dragging a header out of Lumina floats it where it was dropped; dragging it back over Lumina docks it
      floatDrop('project', screenX + outerWidth + 200, screenY + 100); await wait(400);
      const drag = { out: !!POP.project && !inMain('#pProject') };
      floatDrop('project', screenX + outerWidth + 250, screenY + 120); drag.stillOutWhenDroppedOutside = !!POP.project;
      const pjw = POP.project?.w; drag.win = pjw && [pjw.screenX, pjw.screenY, pjw.outerWidth, pjw.outerHeight]; drag.main = [screenX, screenY, outerWidth, outerHeight];
      floatDrop('project', screenX + outerWidth / 2, screenY + outerHeight / 2); await wait(300); drag.next = $('#pProject').nextElementSibling?.className;
      drag.backOverLumina = !POP.project && inMain('#pProject') && $('#pProject').nextElementSibling?.classList.contains('p-comp');
      dockAll();
      if (keepFloat == null) localStorage.removeItem('lumina.floating'); else localStorage.setItem('lumina.floating', keepFloat);
      step('floatPanels', { props, timeline: tl, drag, works: props.opened && props.moved && props.css === 'flex' && props.inspectorThere && props.showsLayer && props.followsSelection
        && props.saved && props.keyStep > 0 && props.rowsAfter === 'auto' && props.docked && tl.opened && tl.moved && tl.mainRows === 3 && tl.barsThere && tl.tlFloat
        && tl.backAfterClose && tl.savedOff && drag.out && drag.stillOutWhenDroppedOutside && drag.backOverLumina });
    }

    // for the screenshot: the two halves of PLAY on one track, B selected
    setMulti([V1.id, V2.id], V1.id); putOnOneTrack(selLayers()); clearMulti(); S.sel = V2.id; refresh(); await settle(2);
    R.errors = __errs;
  } catch (e) { R.error = String(e && e.stack || e); R.errors = window.__errs; }
  Object.assign(TLSET, keepSet); saveTLSet();
  return R;
})()
