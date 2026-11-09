// Image test (PhotoCraft Round 1, Save as image): the frame at the playhead saved in every image format, then each file
// read back (by Chromium, by Lumina's FFmpeg, or by taking it apart) and its size and colours checked against the frame.
(async () => {
  const R = { steps: {} }, step = (k, v) => R.steps[k] = v;
  const dir = 'D:\\Lumina\\.claude\\image\\out\\';
  try {
    S.global.vignette = 0;
    // a card of six colour patches behind an orange circle in the middle
    const card = await makeCard(['200,40,40', '40,200,40', '40,40,200', '230,230,230', '20,20,20', '200,200,40'], 'card.png', false);
    card.__path = await lumina.saveExport(await card.arrayBuffer(), 'card.png', dir + 'card.png');
    const C = await load(card); C.start = 0; C.dur = 5;
    seek(1); addShape('ellipse'); const E = selLayer(); E.name = 'Orange circle'; E.blend = 'multiply'; E.start = 0; E.dur = 5;
    seek(2); refresh();
    const ref = grabFrame({}), at = (img, x, y) => { const i = (Math.round(y) * img.width + Math.round(x)) * 4; return [...img.data.slice(i, i + 4)]; };
    const SPOTS = [[160, 200], [800, 300], [1760, 900], [1010, 540]];   // patch 1, patch 3, patch 6, the circle (off the patch edge at x 960)
    const want = SPOTS.map(([x, y]) => at(ref, x, y));
    R.frame = { size: `${ref.width}x${ref.height}`, spots: want.map(p => p.slice(0, 3).join(',')) };

    // reading a saved file back
    const fileBytes = async p => new Uint8Array(await (await fetch(lumina.mediaURL(p) + '?n=' + Math.random())).arrayBuffer());
    const pixels = async bytes => {
      const bm = await createImageBitmap(new Blob([bytes])), c = document.createElement('canvas'); c.width = bm.width; c.height = bm.height;
      const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(bm, 0, 0); return x.getImageData(0, 0, c.width, c.height);
    };
    const viaFFmpeg = async p => pixels(await lumina.imageToPNG(p));
    const check = (img, tol) => {
      const sx = img.width / ref.width, sy = img.height / ref.height;
      const got = SPOTS.map(([x, y]) => at(img, x * sx, y * sy)), err = Math.max(...got.flatMap((p, k) => p.slice(0, 3).map((v, c) => Math.abs(v - want[k][c]))));
      return { size: `${img.width}x${img.height}`, spots: got.map(p => p.slice(0, 3).join(',')), err, ok: err <= tol };
    };
    const save = (id, opts = {}) => saveFrameImage(id, { quality: 90, ...opts }, dir + 'frame.' + IMAGE_FORMATS.find(f => f[0] === id)[2].split(',')[0].slice(1));

    // the dialog: every format listed; quality shown for JPEG, the background switch for PNG
    chooseSaveImage();
    const radios = [...document.querySelectorAll('#mText input[name=fmt]')];
    const pickFmt = v => { const r = radios.find(x => x.value === v); r.checked = true; r.dispatchEvent(new Event('change', { bubbles: true })); };
    const shown = () => [!$('#imgQRow').hidden && 'quality', !$('#imgARow').hidden && 'background'].filter(Boolean).join('+') || 'nothing';
    pickFmt('jpg'); const jpgUI = shown(); pickFmt('png'); const pngUI = shown();
    $('#mOk').click();
    const inMenu = MENUS.Composition().some(it => Array.isArray(it) && /Save frame as image/.test(it[0]));
    // Save as: four tabs (Project, Video, Image, Moving image), each with only its own formats and settings
    chooseSaveAs();
    const tabBtn = id => $(`#mText [data-ftab="${id}"]`), count = () => document.querySelectorAll('#mText input[name=fmt]').length;
    const tabs = [...document.querySelectorAll('#mText [data-ftab]')].map(b => b.textContent);
    const perTab = {};
    for (const id of ['project', 'video', 'image', 'anim']) { tabBtn(id).click(); perTab[id] = { formats: count(), on: tabBtn(id).classList.contains('on') ? 'yes' : 'no', settings: $('#imgOpts') && !$('#imgOpts').hidden ? 'shown' : 'none' }; }
    tabBtn('image').click(); $('#mOk').click(); chooseSaveAs(); const remembered = $('#mText [data-ftab].on')?.dataset.ftab;
    // saving from the Image and Moving image tabs goes to the right place (the real save functions stood in for)
    const realImg = window.saveFrameImage, realAnim = window.saveAnimation, sent = [];
    window.saveFrameImage = (f, o) => sent.push(['image', f, o.quality]); window.saveAnimation = (f, o) => sent.push(['anim', f, o.fps]);
    { const r = [...document.querySelectorAll('#mText input[name=fmt]')].find(x => x.value === 'img:webp'); r.checked = true; $('#mGo').click(); }
    chooseSaveAs(); tabBtn('anim').click(); { const r = [...document.querySelectorAll('#mText input[name=fmt]')].find(x => x.value === 'anim:gif'); r.checked = true; $('#mGo').click(); }
    window.saveFrameImage = realImg; window.saveAnimation = realAnim; $('#modal').hidden = true;
    const inSaveAs = perTab.image.formats;
    step('dialog', { formats: radios.map(r => r.value), jpgUI, pngUI, inMenu, tabs, perTab, remembered, sent,
      works: radios.length === IMAGE_FORMATS.length && jpgUI === 'quality' && pngUI === 'background' && inMenu && tabs.length === 4
        && perTab.project.formats === 1 && perTab.video.formats === EXPORT_FORMATS.length && inSaveAs === IMAGE_FORMATS.length && perTab.anim.formats === ANIM_FORMATS.length
        && perTab.image.settings === 'shown' && perTab.anim.settings === 'shown' && perTab.video.settings === 'none' && Object.values(perTab).every(t => t.on === 'yes')
        && remembered === 'image' && sent.length === 2 && sent[0][0] === 'image' && sent[0][1] === 'webp' && sent[1][0] === 'anim' && sent[1][1] === 'gif' });

    // formats Chromium itself can open
    const out = {};
    for (const [id, tol] of [['png', 2], ['jpg', 24], ['webp', 24], ['avif', 28], ['gif', 24], ['bmp', 2], ['ico', 40]]) {
      const t0 = performance.now(), p = await save(id), ms = Math.round(performance.now() - t0);
      try { const b = await fileBytes(p); out[id] = { kb: Math.round(b.length / 1024), ms, ...check(await pixels(b), tol) }; } catch (e) { out[id] = { error: String(e.message || e), file: p }; }
    }
    // formats read back with Lumina's FFmpeg
    for (const [id, tol] of [['tiff', 2], ['tga', 2], ['jp2', 24], ['psd', 2]]) {
      const t0 = performance.now(), p = await save(id), ms = Math.round(performance.now() - t0);
      try { out[id] = { kb: Math.round((await fileBytes(p)).length / 1024), ms, ...check(await viaFFmpeg(p), tol) }; } catch (e) { out[id] = { error: String(e.message || e), file: p }; }
    }
    // PDF, AI and EPS: the picture inside is a JPEG; SVG: Chromium draws it
    const latin = b => { let s = ''; for (let i = 0; i < b.length; i += 65536) s += String.fromCharCode(...b.subarray(i, i + 65536)); return s; };
    for (const id of ['pdf', 'ai']) {
      const p = await save(id), b = await fileBytes(p), s = latin(b);
      const m = /\/Length (\d+) >>\nstream\n/.exec(s), jpg = b.subarray(m.index + m[0].length, m.index + m[0].length + +m[1]);
      // every cross-reference points at its object
      const xref = +/startxref\n(\d+)/.exec(s)[1], offs = s.slice(xref).match(/(\d{10}) 00000 n/g).map(x => +x.slice(0, 10));
      const xrefOk = s.startsWith('xref', xref) && offs.every((o, k) => s.startsWith(`${k + 1} 0 obj`, o));
      out[id] = { kb: Math.round(b.length / 1024), header: s.slice(0, 8), xrefOk, ...check(await pixels(jpg), 24) }; out[id].ok &&= xrefOk;
    }
    {
      const p = await save('eps'), s = latin(await fileBytes(p)), a85 = s.slice(s.indexOf('image\n') + 6, s.indexOf('~>'));
      // ASCII85 back to bytes
      const clean = a85.replace(/\s/g, ''), bytes = [];
      for (let i = 0; i < clean.length;) {
        if (clean[i] === 'z') { bytes.push(0, 0, 0, 0); i++; continue; }
        const g = clean.slice(i, i + 5), n = g.length; let v = 0; for (let k = 0; k < 5; k++) v = v * 85 + ((g.charCodeAt(k) || 117) - 33);
        const four = [v >>> 24 & 255, v >>> 16 & 255, v >>> 8 & 255, v & 255]; bytes.push(...four.slice(0, n - 1)); i += 5;
      }
      out.eps = { kb: Math.round(s.length / 1024), header: s.slice(0, 23), bbox: /%%BoundingBox: ([^\n]+)/.exec(s)[1], ...check(await pixels(new Uint8Array(bytes)), 24) };
    }
    {
      const p = await save('svg'), img = new Image(); img.src = lumina.mediaURL(p) + '?n=' + Math.random(); await img.decode();
      const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight; const x = c.getContext('2d'); x.drawImage(img, 0, 0);
      out.svg = check(x.getImageData(0, 0, c.width, c.height), 2);
    }
    // HEIC: take the file apart (ftyp, the hvcC settings, the picture in mdat), turn it back into a plain HEVC stream
    // and let FFmpeg decode that
    {
      const p = await save('heic'), b = await fileBytes(p), s = latin(b), dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
      const hv = s.indexOf('hvcC') + 4, sets = []; let o = hv + 22; const nArr = b[o++];
      for (let k = 0; k < nArr; k++) { o++; const n = dv.getUint16(o); o += 2; for (let j = 0; j < n; j++) { const len = dv.getUint16(o); o += 2; sets.push(b.subarray(o, o + len)); o += len; } }
      const md = s.indexOf('mdat') + 4, mdEnd = md - 8 + dv.getUint32(md - 8), nals = [];
      for (let q = md; q < mdEnd;) { const len = dv.getUint32(q); nals.push(b.subarray(q + 4, q + 4 + len)); q += 4 + len; }
      const il = s.indexOf('iloc') + 4, ilocOff = dv.getUint32(il + 14), ilocLen = dv.getUint32(il + 18);
      const sc = new Uint8Array([0, 0, 0, 1]), parts = [...sets, ...nals].flatMap(n => [sc, n]);
      const annexB = new Uint8Array(parts.reduce((a, x) => a + x.length, 0)); let w = 0; for (const x of parts) { annexB.set(x, w); w += x.length; }
      await lumina.saveExport(annexB.buffer, 'heic.hevc', dir + 'heic-inside.hevc');
      out.heic = { kb: Math.round(b.length / 1024), brand: s.slice(8, 12), compatible: s.slice(16, 24), paramSets: sets.length, nals: nals.length,
        ilocPointsAtPicture: ilocOff === md && ilocLen === mdEnd - md, ...check(await viaFFmpeg(dir + 'heic-inside.hevc'), 24) };
      out.heic.ok &&= out.heic.brand === 'heic' && out.heic.paramSets === 3 && out.heic.ilocPointsAtPicture;
    }
    step('formats', { ...out, works: IMAGE_FORMATS.every(([id]) => out[id]?.ok) });

    // PSD layers: one per layer, bottom first, named, cropped to what each covers, with its blend mode
    {
      const b = await fileBytes(dir + 'frame.psd'), dv = new DataView(b.buffer, b.byteOffset, b.byteLength), str = (o, n) => String.fromCharCode(...b.subarray(o, o + n));
      let o = 26; o += 4 + dv.getUint32(o); o += 4 + dv.getUint32(o); o += 4; o += 4;
      const count = dv.getInt16(o); o += 2; const layers = [];
      for (let k = 0; k < Math.abs(count); k++) {
        const top = dv.getInt32(o), left = dv.getInt32(o + 4), bottom = dv.getInt32(o + 8), right = dv.getInt32(o + 12); o += 16;
        const nch = dv.getUint16(o); o += 2 + nch * 6;
        const sig = str(o, 4), key = str(o + 4, 4); o += 12;
        const extra = dv.getUint32(o); o += 4; const e0 = o; o += 4 + dv.getUint32(o); o += 4 + dv.getUint32(o);
        layers.push({ name: str(o + 1, b[o]), bounds: [top, left, bottom, right], sig, blend: key }); o = e0 + extra;
      }
      step('psdLayers', { signature: str(0, 4), count, layers,
        works: str(0, 4) === '8BPS' && count === 2 && layers[0].name === 'card.png' && layers[0].bounds.join() === '0,0,1080,1920'
          && layers[1].name === 'Orange circle' && layers[1].blend === 'mul ' && Math.abs(layers[1].bounds[0] - 430) < 4 && Math.abs(layers[1].bounds[1] - 850) < 4 && layers.every(l => l.sig === '8BIM') });
    }

    // see-through background: with the card hidden, only the circle has colour; the corners are clear
    C.visible = false; refresh();
    const clear = {};
    for (const id of ['png', 'webp', 'tiff', 'psd']) {
      const p = await saveFrameImage(id, { quality: 90, alpha: true }, dir + 'clear-frame.' + (id === 'tiff' ? 'tif' : id)), img = id === 'png' || id === 'webp' ? await pixels(await fileBytes(p)) : await viaFFmpeg(p);
      clear[id] = { corner: at(img, 20, 20)[3], circle: at(img, 960, 540)[3], color: at(img, 960, 540).slice(0, 3).join(',') };
    }
    const solid = await save('png', { alpha: false }), solidCorner = at(await pixels(await fileBytes(solid)), 20, 20);
    C.visible = true; refresh();
    step('seeThrough', { ...clear, withoutIt: solidCorner.join(','),
      works: Object.values(clear).every(c => c.corner === 0 && c.circle > 240) && solidCorner[3] === 255 && solidCorner[0] === 0 });

    // the editor's own picture is back on screen afterwards
    render(S.time); const after = at(ctx.getImageData(0, 0, W(), H()), 160, 200);
    step('screenRestored', { after: after.join(','), works: after.slice(0, 3).join() === want[0].slice(0, 3).join() });

    // ---- P2: moving pictures and picture sequences. The circle slides from 20% to 80% across over 2 s (keyframes).
    E.blend = 'source-over'; E.keys.x = [{ t: 0, v: .2 }, { t: 2, v: .8 }]; seek(0); refresh();
    // where the circle is: the middle orange pixel in the band across the middle of the picture (as a share of the width)
    const orangeX = img => {
      const d = img.data, xs = [];
      for (let y = Math.round(img.height * .42); y < img.height * .58; y++) for (let x = 0; x < img.width; x++) { const i = (y * img.width + x) * 4; if (d[i] > 215 && d[i + 1] > 130 && d[i + 1] < 215 && d[i + 2] < 90 && d[i + 3] > 128) xs.push(x); }
      xs.sort((a, b) => a - b); return xs.length ? +(xs[xs.length >> 1] / img.width).toFixed(3) : null;
    };
    // the truth: the editor's own frame at time t, shrunk to a quarter like the files
    const truthX = t => { seek(t); render(t); const c = document.createElement('canvas'); c.width = 480; c.height = 270; const x = c.getContext('2d'); x.drawImage(canvas, 0, 0, 480, 270); return orangeX(x.getImageData(0, 0, 480, 270)); };
    const truth = [0, 1, 1.9].map(truthX); R.circleTruth = truth;
    // every frame of a moving picture, read with Chromium's own decoder
    const frames = async (p, type) => {
      const dec = new ImageDecoder({ data: await fileBytes(p), type }); await dec.tracks.ready; const tr = dec.tracks.selectedTrack, out = [];
      for (let i = 0; i < tr.frameCount; i++) {
        const { image } = await dec.decode({ frameIndex: i }), c = document.createElement('canvas'); c.width = image.displayWidth; c.height = image.displayHeight;
        const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(image, 0, 0); image.close(); out.push(x.getImageData(0, 0, c.width, c.height));
      }
      return { count: tr.frameCount, repeat: tr.repetitionCount, imgs: out };
    };
    const anim = {};
    for (const [id, type, ext] of [['gif', 'image/gif', 'gif'], ['webp', 'image/webp', 'webp'], ['apng', 'image/png', 'png']]) {
      const t1 = performance.now(), p = await saveAnimation(id, { from: 0, to: 2, fps: 10, scale: .25, loop: true }, dir + 'anim-' + id + '.' + ext), ms = Math.round(performance.now() - t1);
      try {
        const f = await frames(p, type), xs = f.imgs.map(orangeX);
        anim[id] = { ms, kb: Math.round((await fileBytes(p)).length / 1024), size: f.imgs[0].width + 'x' + f.imgs[0].height, frames: f.count, repeat: f.repeat, first: xs[0], middle: xs[10], last: xs[19],
          ok: f.count === 20 && f.imgs[0].width === 480 && Math.abs(xs[0] - truth[0]) < .01 && Math.abs(xs[10] - truth[1]) < .01 && Math.abs(xs[19] - truth[2]) < .01 && xs.every((x, k) => !k || x >= xs[k - 1] - .005) };
      } catch (e) { anim[id] = { error: String(e.message || e), file: p, modal: $('#mText').textContent }; }
    }
    anim.gifRepeatsForever = (await frames(dir + 'anim-gif.gif', 'image/gif')).repeat === Infinity;
    // played once, not over and over
    { const p = await saveAnimation('gif', { from: 0, to: .5, fps: 10, scale: .25, loop: false }, dir + 'once.gif'); anim.onceRepeat = (await frames(p, 'image/gif')).repeat; }
    // see-through moving WebP: with the card hidden, the corners are clear in every frame
    C.visible = false; refresh();
    { const p = await saveAnimation('webp', { from: 0, to: 1, fps: 5, scale: .25, alpha: true }, dir + 'clear.webp'), f = await frames(p, 'image/webp');
      anim.clear = f.imgs.map(img => ({ corner: img.data[3], circle: orangeX(img) })); anim.clearCorners = anim.clear.every(c => c.corner <= 2 && c.circle != null); }   // (lossy WebP may leave 1 or 2 of 255)
    C.visible = true; refresh();
    step('moving', { ...anim, works: ['gif', 'webp', 'apng'].every(k => anim[k].ok) && anim.gifRepeatsForever && anim.onceRepeat === 0 && anim.clearCorners });

    // sequences: one numbered picture per frame in the folder (made if it isn't there)
    const seq = {};
    for (const [id, ext] of [['seq-png', 'png'], ['seq-jpg', 'jpg'], ['seq-tiff', 'tif']]) {
      const folder = dir + 'seq-' + ext, p = await saveAnimation(id, { from: 0, to: 1, fps: 10, scale: .25 }, folder);
      const fileK = k => folder + '\\' + projectName() + '_' + String(k).padStart(4, '0') + '.' + ext;
      const exists = async k => (await fetch(lumina.mediaURL(fileK(k)) + '?n=' + Math.random())).ok;
      const first = ext === 'tif' ? await viaFFmpeg(fileK(1)) : await pixels(await fileBytes(fileK(1)));
      seq[ext] = { folder: p, has1: await exists(1), has10: await exists(10), stopsAt10: !(await exists(11)), size: first.width + 'x' + first.height, circleAt: orangeX(first) };
    }
    step('sequences', { ...seq, works: Object.values(seq).every(q => q.has1 && q.has10 && q.stopsAt10 && q.size === '480x270' && Math.abs(q.circleAt - truth[0]) < .01) });
    // the dialog: frames counted as the range changes; the repeat switch only for moving pictures
    chooseSaveAnimation();
    const pickA = v => { const r = [...document.querySelectorAll('#mText input[name=fmt]')].find(x => x.value === v); r.checked = true; r.dispatchEvent(new Event('change', { bubbles: true })); };
    $('#an-from').value = 0; $('#an-to').value = 2; $('#an-fps').value = 15; $('#an-to').dispatchEvent(new Event('input', { bubbles: true }));
    pickA('gif'); const gifUI = { note: $('#imgNote').textContent, loop: !$('#anLoopRow').hidden };
    pickA('seq-jpg'); const seqUI = { loop: !$('#anLoopRow').hidden ? 'shown' : 'hidden', quality: !$('#imgQRow').hidden ? 'shown' : 'hidden' };
    $('#mOk').click(); const animInMenu = MENUS.Composition().some(it => Array.isArray(it) && /Save animation/.test(it[0]));
    step('animDialog', { gifUI, seqUI, animInMenu, works: /^30 frames/.test(gifUI.note) && gifUI.loop && seqUI.loop === 'hidden' && seqUI.quality === 'shown' && animInMenu });
    E.keys = {}; seek(2); refresh();

    // ---- P2: opening every image format. The pictures saved above come back in as clips, the way a person imports them.
    const pathFile = p => ({ name: p.split('\\').pop(), type: '', __path: p });
    const imgPixels = img => { const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight; const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(img, 0, 0); return x.getImageData(0, 0, c.width, c.height); };
    const opened = {};
    for (const [ext, tol] of [['tif', 2], ['psd', 2], ['tga', 2], ['jp2', 24], ['heic', 24], ['ico', 40]]) {
      const p = dir + 'frame.' + ext, t1 = performance.now();
      const L = await Promise.race([load(pathFile(p)), new Promise(r => setTimeout(() => r(null), 20000))]);
      const m = L && MEDIA[L.media];
      opened[ext] = m?.img ? { ms: Math.round(performance.now() - t1), keptPath: m.path === p, ...check(imgPixels(m.img), tol) } : { failed: true };
      if (L) { S.layers.splice(S.layers.indexOf(L), 1); delete RT[L.id]; }
    }
    const again = await lumina.openImage(dir + 'frame.tif'), heicBy = (await lumina.openImage(dir + 'frame.heic'));
    step('openFormats', { ...opened, cachedSecondTime: !!again.cached, heicCached: !!heicBy.cached,
      works: Object.values(opened).every(o => o.ok && o.keptPath) && again.cached === true });

    // a saved project with a TIFF in it opens again (the TIFF is read again, from the cache)
    {
      const T = await load(pathFile(dir + 'frame.tif')); T.start = 0; T.dur = 5;
      PROJ.path = dir + 'tiff.lumina'; await saveProject();
      S.layers = []; for (const k in RT) delete RT[k]; refresh();
      await openProject(dir + 'tiff.lumina');
      const T2 = S.layers.find(x => x.name === 'frame.tif'), m2 = T2 && MEDIA[T2.media];
      step('reopenTiff', { kept: !!T2, path: m2?.path?.split('\\').pop(), size: m2?.img ? m2.img.naturalWidth + 'x' + m2.img.naturalHeight : null, works: !!T2 && !!m2?.img && m2.img.naturalWidth === 1920 });
    }

    // a broken camera RAW file: a clear message, not a crash
    {
      await lumina.saveExport(new TextEncoder().encode('not really a raw photo').buffer, 'bad.nef', dir + 'bad.nef');
      let msg = ''; try { await lumina.openImage(dir + 'bad.nef'); } catch (e) { msg = String(e.message || e); }
      step('badRaw', { message: msg.replace(/^Error invoking remote method '[^']+': (Error: )?/, ''), works: /camera RAW file/.test(msg) && !/Installing/.test(msg) });
    }

    // for the screenshot: Save as on its Image tab, with JPEG picked
    chooseSaveAs(); $('#mText [data-ftab="image"]').click(); { const r = [...document.querySelectorAll('#mText input[name=fmt]')].find(x => x.value === 'img:jpg'); r.checked = true; r.dispatchEvent(new Event('change', { bubbles: true })); }
    await new Promise(r => setTimeout(r, 300));
    R.errors = __errs;
  } catch (e) { R.error = String(e && e.stack || e); R.errors = window.__errs; }
  return R;
})()
