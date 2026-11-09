// Image mode test (PhotoCraft Round P3): a new picture, its Layers panel (eye, lock, opacity, order, names, little
// pictures), and the canvas tools (rotate, flip, crop, canvas size, image size), each checked by where known colours
// land on the finished picture. Then saving it, reopening the project, and going back to video editing.
(async () => {
  const R = { steps: {} }, step = (k, v) => R.steps[k] = v;
  const dir = 'D:\\Lumina\\.claude\\photo\\out\\';
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const shown = el => !!el && el.offsetParent !== null;
  try {
    markDirty(false);
    // ---- New image: 1200×800, white
    newImageBox();
    $('#ni-size').value = ''; $('#ni-w').value = 1200; $('#ni-h').value = 800; $('#ni-bg').value = 'white'; $('#ni-bg').dispatchEvent(new Event('change'));
    $('#mGo').click(); await wait(300);
    render();
    const corner = () => [...ctx.getImageData(5, 5, 1, 1).data];
    step('newImage', {
      still: isStill(), size: `${W()}x${H()}`, workspace: wsName, railTab: LTAB, white: corner().slice(0, 3).join(','),
      timelineHidden: !shown($('#pTimeline')), playHidden: !shown($('#pPreview')), layersShown: shown($('#pLayers')),
      splitHidden: !shown($('#btnSplit')), button: $('#btnExport').textContent, tab: $('#compTab').textContent,
      works: isStill() && W() === 1200 && H() === 800 && !shown($('#pTimeline')) && shown($('#pLayers')) && $('#btnExport').textContent === 'Save image' && corner()[0] === 255,
    });

    // ---- a 3:2 picture of four colours (fills the canvas exactly) and an orange disc on top
    const cv = document.createElement('canvas'); cv.width = 600; cv.height = 400; const cx = cv.getContext('2d');
    [['#c82828', 0, 0], ['#28c828', 300, 0], ['#2828c8', 0, 200], ['#c8c828', 300, 200]].forEach(([c, x, y]) => { cx.fillStyle = c; cx.fillRect(x, y, 300, 200); });
    const blob = await new Promise(r => cv.toBlob(r));
    const cardPath = await lumina.saveExport(await blob.arrayBuffer(), 'quads.png', dir + 'quads.png');
    const pathFile = p => ({ name: p.split('\\').pop(), type: '', __path: p });
    let Q = await load(pathFile(cardPath)); await wait(200);
    addShape('ellipse'); let D = selLayer(); D.p.x = .2; D.p.y = .2; D.fill = '#ffb020'; D.name = 'Disc'; commit(); refresh(); await wait(100);
    step('layersAdded', { layers: S.layers.map(L => `${L.name}@${L.start}+${L.dur}`), rows: document.querySelectorAll('#lyrList .lyr').length, bgRow: !!$('#lyrList [data-bgrow]'),
      works: S.layers.length === 2 && document.querySelectorAll('#lyrList [data-lid]').length === 2 && !!$('#lyrList [data-bgrow]') && S.layers.every(L => L.start === 0) });

    // known points on the picture (in canvas pixels) and their colours; every canvas change moves them, and they're
    // checked again on the finished picture
    const COL = { red: [200, 40, 40], green: [40, 200, 40], blue: [40, 40, 200], yellow: [200, 200, 40], orange: [255, 176, 32] };
    let pts = [[450, 300, 'red'], [750, 100, 'green'], [150, 700, 'blue'], [1050, 700, 'yellow'], [240, 160, 'orange']];
    const look = () => {
      const img = grabFrame({}), bad = [];
      for (const [x, y, c] of pts) {
        if (x < 2 || y < 2 || x > W() - 3 || y > H() - 3) continue;
        const i = (Math.round(y) * img.width + Math.round(x)) * 4, got = [img.data[i], img.data[i + 1], img.data[i + 2]];
        if (got.some((v, k) => Math.abs(v - COL[c][k]) > 14)) bad.push(`${c} at ${Math.round(x)},${Math.round(y)} is ${got.join(',')}`);
      }
      // the disc's width across its middle, in pixels
      const o = pts.find(p => p[2] === 'orange'), row = Math.round(o[1]); let n = 0;
      for (let x = 0; x < img.width; x++) { const i = (row * img.width + x) * 4; if (img.data[i] > 235 && img.data[i + 1] > 150 && img.data[i + 1] < 200 && img.data[i + 2] < 70) n++; }
      return { size: `${W()}x${H()}`, bad, disc: n };
    };
    const move = f => { pts = pts.map(([x, y, c]) => [...f(x, y), c]); };
    const before = look(), disc0 = before.disc;
    const ops = {};
    const run = (name, fn, map, discK = 1) => {
      const ow = W(), oh = H(); fn(); move((x, y) => map(x, y, ow, oh)); const r = look();
      ops[name] = { ...r, works: !r.bad.length && Math.abs(r.disc - disc0 * discK) <= 3 };
    };
    ops.start = { ...before, works: !before.bad.length && disc0 > 150 };
    run('rotateRight', () => rotateCanvas(90), (x, y, ow, oh) => [oh - y, x]);
    run('rotateLeft', () => rotateCanvas(-90), (x, y, ow, oh) => [y, ow - x]);
    run('rotate180', () => rotateCanvas(180), (x, y, ow, oh) => [ow - x, oh - y]);
    run('flipAcross', () => flipCanvas('x'), (x, y, ow) => [ow - x, y]);
    run('flipUpDown', () => flipCanvas('y'), (x, y, ow, oh) => [x, oh - y]);
    run('rotateRight2', () => rotateCanvas(90), (x, y, ow, oh) => [oh - y, x]);
    // canvas size: 200 px more each way, kept at the top left; the new space is the white background
    run('canvasSize', () => resizeCanvas(W() + 200, H() + 200, [0, 0]), (x, y) => [x, y]);
    { const img = grabFrame({}), i = ((H() - 50) * img.width + (W() - 50)) * 4; ops.canvasSize.newSpace = [img.data[i], img.data[i + 1], img.data[i + 2]].join(','); ops.canvasSize.works &&= img.data[i] === 255 && img.data[i + 2] === 255; }
    // canvas size from the middle, smaller
    run('canvasSizeMiddle', () => resizeCanvas(W() - 100, H() - 60, [.5, .5]), (x, y) => [x - 50, y - 30]);
    // image size: half as big, everything with it
    run('imageSize', () => resizeImage(Math.round(W() / 2), Math.round(H() / 2)), (x, y, ow, oh) => [x * Math.round(ow / 2) / ow, y * Math.round(oh / 2) / oh], .5);
    run('imageSizeBack', () => resizeImage(W() * 2, H() * 2), (x, y) => [x * 2, y * 2]);
    // crop, set straight
    run('crop', () => { startCrop(); CROP = { x: 40, y: 60, w: W() - 140, h: H() - 200 }; endCrop(true); }, (x, y) => [x - 40, y - 60]);
    step('canvasTools', { disc0, ...ops, works: Object.values(ops).every(o => o.works) });

    // ---- undo and redo put the canvas back
    {
      const s1 = `${W()}x${H()}`; undo(); const s0 = `${W()}x${H()}`; const back = look(); redo(); const s2 = `${W()}x${H()}`;
      move((x, y) => [x, y]); const again = look();
      step('undoCanvas', { afterCrop: s1, undone: s0, redone: s2, undoneBad: back.bad.length ? 'some moved' : 'none', works: s0 !== s1 && s2 === s1 && !again.bad.length });
    }

    // ---- the crop box by mouse: drag its bottom-right corner in by a quarter, then Enter
    {
      startCrop(); await wait(50);
      const r = ov.getBoundingClientRect(), ev = (type, x, y) => ov.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, pointerId: 7, button: 0, buttons: type === 'pointerup' ? 0 : 1, clientX: x, clientY: y }));
      const ow = W(), oh = H();
      ev('pointerdown', r.right - 2, r.bottom - 2); ev('pointermove', r.right - r.width / 4, r.bottom - r.height / 4); ev('pointerup', r.right - r.width / 4, r.bottom - r.height / 4);
      const boxed = { ...CROP }, bar = shown($('#cropBar')), label = $('#cropSize').textContent;
      document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      await wait(50);
      step('cropByMouse', { box: `${Math.round(boxed.w)}x${Math.round(boxed.h)}`, label, bar, after: `${W()}x${H()}`, barGone: !shown($('#cropBar')),
        works: Math.abs(W() - ow * .75) <= 3 && Math.abs(H() - oh * .75) <= 3 && bar && !shown($('#cropBar')) });
      undo();
    }

    // undo puts back copies of the layers, so look them up again
    const fresh = () => { D = byId(D.id); Q = byId(Q.id); };
    // ---- the Layers panel
    {
      fresh(); await wait(500);   // the little pictures are made a moment after a change
      const rows = [...document.querySelectorAll('#lyrList [data-lid]')];
      const thumbs = rows.map(r => r.querySelector('img').src.startsWith('data:image/png'));
      const order = rows.map(r => byId(+r.dataset.lid).name);
      // the eye hides the disc
      const o = pts.find(p => p[2] === 'orange'), at = () => { const img = grabFrame({}); const i = (Math.round(o[1]) * img.width + Math.round(o[0])) * 4; return [img.data[i], img.data[i + 1], img.data[i + 2]].join(','); };
      const rowOf = L => $(`#lyrList [data-lid="${L.id}"]`);
      rowOf(D).querySelector('[data-lyr=eye]').click(); const hidden = at(); rowOf(D).querySelector('[data-lyr=eye]').click(); const back = at();
      // opacity 50%
      rowOf(D).click(); $('#lyrOp').value = 50; $('#lyrOp').dispatchEvent(new Event('input')); $('#lyrOp').dispatchEvent(new Event('change'));
      fresh(); const half = at(), opv = val(D, 'opacity');
      setOpacity(100, true);
      // lock: can't be picked on the preview, changed in Properties or deleted
      rowOf(D).querySelector('[data-lyr=lock]').click(); fresh();
      const lockedInputs = [...document.querySelectorAll('#inspector input, #inspector select')].filter(x => x.disabled).length;
      const pick = hitTest({ x: o[0], y: o[1] }); S.sel = D.id; del(); const stillThere = S.layers.includes(D);
      const opDisabled = $('#lyrOp').disabled;
      $('#inspector [data-unlock]').click(); fresh(); const unlocked = !D.locked;
      // order: Down puts the disc under the picture (it disappears), Up brings it back
      rowOf(D).click(); $('#pLayers [data-lyrf=down]').click(); const under = at(), orderDown = S.layers.map(L => L.name);
      $('#pLayers [data-lyrf=up]').click(); const over = at();
      // drag and drop: the picture row dropped on the top half of the disc's row goes over it
      const dt = new DataTransfer(), qRow = rowOf(Q), dRow = rowOf(D), dr = dRow.getBoundingClientRect();
      qRow.dispatchEvent(new DragEvent('dragstart', { bubbles: true, dataTransfer: dt }));
      dRow.dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer: dt, clientX: dr.left + 30, clientY: dr.top + 3 }));
      rowOf(D).dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt, clientX: dr.left + 30, clientY: dr.top + 3 }));
      const orderDragged = S.layers.map(L => L.name), dragged = at(); fresh();
      fresh(); placeLayer(D, 0);
      // rename by double-clicking the name
      rowOf(D).querySelector('.lyr-nm').dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
      const inp = $('#lyrList .lyr-nm input'); inp.value = 'Sun'; inp.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      fresh(); const OR = '255,176,32';
      step('layersPanel', { order, thumbs, hidden, back, half, opacity: opv, lockedInputs, pickedWhenLocked: pick ? pick.name : 'nothing', deleteRefused: stillThere, opDisabled,
        unlocked, under, orderDown, over, orderDragged, dragged, renamed: D.name,
        works: order.join() === 'Disc,quads.png' && thumbs.every(Boolean) && hidden !== OR && back === OR && Math.abs(opv - .5) < 1e-6 && half !== OR && half !== hidden
          && lockedInputs > 3 && (!pick || pick !== D) && stillThere && opDisabled && unlocked && under !== OR && orderDown[0] === 'quads.png' && over === OR
          && orderDragged[0] === 'quads.png' && dragged !== OR && D.name === 'Sun' });
    }

    // ---- keys in Image mode: the arrows nudge a pixel, Space doesn't play
    {
      fresh(); S.sel = D.id; const x0 = val(D, 'x') * W();
      document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
      document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', shiftKey: true, bubbles: true }));
      fresh(); const moved = +(val(D, 'x') * W() - x0).toFixed(2);
      document.body.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space', key: ' ', bubbles: true })); document.body.dispatchEvent(new KeyboardEvent('keyup', { code: 'Space', key: ' ', bubbles: true }));
      await wait(100); const playing = S.playing;
      undo(); undo();
      step('keys', { moved, playing: playing ? 'yes' : 'no', works: moved === 11 && !playing });
    }

    // ---- the Background row: see-through, and saving keeps it see-through
    {
      const bgEye = () => $('#lyrList [data-lyr=bgeye]');
      resizeCanvas(W() + 100, H(), [0, .5]);   // some space with only background in it
      bgEye().click(); const img = grabFrame({}), i = (10 * img.width + W() - 10) * 4, clear = img.data[i + 3];
      chooseSaveImage(); const alphaOn = $('#img-a').checked, title = $('#mTitle').textContent, text = $('#mText .ftext')?.textContent || ''; $('#mCancel')?.click(); $('#modal').hidden = true;
      const p = await saveFrameImage('png', { alpha: true }, dir + 'picture.png'); $('#modal').hidden = true;
      const bm = await createImageBitmap(await (await fetch(lumina.mediaURL(p) + '?n=' + Math.random())).blob()), c2 = document.createElement('canvas'); c2.width = bm.width; c2.height = bm.height;
      const x2 = c2.getContext('2d'); x2.drawImage(bm, 0, 0); const a2 = x2.getImageData(bm.width - 10, 10, 1, 1).data[3];
      bgEye().click(); const white = grabFrame({}).data[i];
      step('background', { clearAlpha: clear, alphaOn, title, text, saved: p?.split('\\').pop(), savedSize: `${bm.width}x${bm.height}`, savedAlpha: a2, whiteAgain: white,
        works: clear === 0 && alphaOn && title === 'Save image' && /full size/.test(text) && bm.width === W() && a2 === 0 && white === 255 });
    }

    // ---- the Image menu
    {
      const names = [...document.querySelectorAll('#menubar > .menu > button')].map(b => b.textContent);
      const m = [...document.querySelectorAll('#menubar .menu')].find(x => x.dataset.menu === 'Image');
      m.firstElementChild.click(); const items = [...m.querySelectorAll('.pop [data-mi]')].map(b => b.querySelector('span').textContent + (b.disabled ? ' (off)' : ''));
      document.body.click();
      step('imageMenu', { menus: names, items, works: names.indexOf('Image') === names.indexOf('Composition') + 1 && items.some(t => /^Crop/.test(t)) && !items.some(t => /Rotate.*\(off\)/.test(t)) });
    }

    // ---- save the project, open it again: still a picture, same size, same layers
    {
      const size = `${W()}x${H()}`, names = S.layers.map(L => L.name).join();
      PROJ.path = dir + 'picture.lumina'; await saveProject();
      setStill(false); await wait(50); markDirty(false);
      await openProject(dir + 'picture.lumina'); await wait(300);
      step('reopen', { still: isStill(), size: `${W()}x${H()}`, names: S.layers.map(L => L.name).join(), layersShown: shown($('#pLayers')), timelineHidden: !shown($('#pTimeline')),
        works: isStill() && `${W()}x${H()}` === size && S.layers.map(L => L.name).join() === names && shown($('#pLayers')) && !shown($('#pTimeline')) });
    }

    // ---- back to video editing, and into Image mode again from the workspace button
    {
      setStill(false); await wait(50);
      const backStill = isStill(), backLayers = shown($('#pLayers'));
      const back = { mode: backStill ? 'image' : 'video', timeline: shown($('#pTimeline')), layersPanel: backLayers ? 'shown' : 'hidden', button: $('#btnExport').textContent, workspace: wsName, res: $('#res').value };
      $('#wspaces [data-ws=image]').click(); await wait(50);
      const again = { still: isStill(), workspace: wsName, layers: shown($('#pLayers')) };
      step('modes', { back, again, works: !backStill && back.timeline && !backLayers && back.button === 'Export video' && back.workspace === 'default' && again.still && again.layers });
    }

    // ---- Open a picture as an image: the canvas takes the picture's size, nothing to undo, nothing unsaved
    {
      markDirty(false);
      await openImageAsDoc(pathFile(cardPath));
      for (let i = 0; i < 40 && !S.layers.length; i++) await wait(50);
      await wait(100);
      const img = grabFrame({}), tl = [...img.data.slice(0, 3)].join(',');
      step('openAsImage', { size: `${W()}x${H()}`, layers: S.layers.map(L => L.name), undoSteps: undoStack.length, dirty: PROJ.dirty ? 'yes' : 'no', topLeft: tl,
        works: W() === 600 && H() === 400 && S.layers.length === 1 && undoStack.length === 1 && !PROJ.dirty && tl === '200,40,40' });
    }

    // ---- New image dialog guards against huge sizes
    {
      newImageBox(); $('#ni-w').value = 20000; $('#ni-h').value = 100; $('#mGo').click(); await wait(50);
      const msg = $('#ni-msg').textContent, open = !$('#modal').hidden; $('#mCancel').click();
      step('tooBig', { msg, stayedOpen: open, works: open && /16384/.test(msg) });
    }

    // for the screenshot: a picture with text on it and the Layers panel
    addText(); selLayer().text = 'IMAGE MODE'; commit(); refresh(); await wait(500); render(); drawOverlay();
    R.errors = __errs;
  } catch (e) { R.error = String(e && e.stack || e); R.errors = window.__errs; }
  return R;
})()
