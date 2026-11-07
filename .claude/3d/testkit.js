// Test helpers for the browser pane: generates fake clips and loads them into Lumina.
window.makeClip = async (secs, label, bg) => {
  const c = document.createElement('canvas'); c.width = 640; c.height = 360; const x = c.getContext('2d');
  const rec = new MediaRecorder(c.captureStream(30), { mimeType: 'video/webm' }); const ch = [];
  rec.ondataavailable = e => ch.push(e.data); const done = new Promise(r => rec.onstop = r); rec.start();
  const t0 = performance.now();
  await new Promise(r => { const i = setInterval(() => { const t = (performance.now() - t0) / 1000;
    if (bg === 'erase') {
      // static textured room + a grey "boom mic" poking in from the top + a red "person" walking left to right
      drawRoom(x);
      x.fillStyle = '#777'; x.fillRect(300, 0, 26, 70); x.beginPath(); x.ellipse(313, 78, 22, 14, 0, 0, 7); x.fill();
      x.fillStyle = '#d02030'; x.fillRect(60 + t * 150, 170, 50, 130);
      (window.__walker = window.__walker || []).push({ t, x: 60 + t * 150 });
    } else if (bg === 'mover') {
      // static noise background + textured badge on a known path; true centre logged per frame
      if (!window.__noise) { const n = x.createImageData(640, 360); for (let i = 0; i < n.data.length; i += 4) { const v = 60 + Math.random() * 60; n.data[i] = v; n.data[i + 1] = v * .9; n.data[i + 2] = v * 1.1; n.data[i + 3] = 255; } window.__noise = n; }
      x.putImageData(__noise, 0, 0);
      const cx = 120 + t * 110, cy = 180 + Math.sin(t * 2) * 70;
      x.save(); x.translate(cx, cy); x.fillStyle = '#f0d020'; x.fillRect(-30, -30, 60, 60); x.fillStyle = '#c02040'; x.fillRect(-30, -30, 30, 30); x.fillRect(0, 0, 30, 30);
      x.fillStyle = '#103080'; x.beginPath(); x.arc(0, 0, 10, 0, 7); x.fill(); x.restore();
      (window.__truth = window.__truth || []).push({ t, u: cx / 640, v: cy / 360 });
    } else if (bg === 'scene') { const g = x.createLinearGradient(0, 0, 0, 360); g.addColorStop(0, '#5aa0e0'); g.addColorStop(1, '#2d6a2d'); x.fillStyle = g; x.fillRect(0, 0, 640, 360); x.fillStyle = '#ddd'; x.fillRect(80, 160, 90, 140); }
    else { x.fillStyle = bg; x.fillRect(0, 0, 640, 360); x.fillStyle = bg === '#000000' ? '#ff9020' : '#ff70b0'; x.beginPath(); x.arc(320 + Math.sin(t * 3) * 40, 180, 110, 0, 7); x.fill(); }
    if (t > secs) { clearInterval(i); r(); } }, 33); });
  rec.stop(); await done; return new File(ch, label + '.webm', { type: 'video/webm' });
};
// flat colour patches (top) and a grey ramp (bottom) as an exact-valued PNG
window.makeCard = async (patches, name = 'card.png', ramp = true) => {
  const c = document.createElement('canvas'); c.width = 1920; c.height = 1080; const x = c.getContext('2d');
  patches.forEach((v, i) => { x.fillStyle = `rgb(${v})`; x.fillRect(i * 320, 0, 320, ramp ? 540 : 1080); });
  if (ramp) for (let i = 0; i < 1920; i++) { const v = Math.round(i / 1919 * 255); x.fillStyle = `rgb(${v},${v},${v})`; x.fillRect(i, 540, 1, 540); }
  return new File([await new Promise(r => c.toBlob(r))], name, { type: 'image/png' });
};
// the clean background used by the 'erase' clip, so results can be compared against the truth
window.drawRoom = x => {
  const g = x.createLinearGradient(0, 0, 0, 360); g.addColorStop(0, '#c8b89a'); g.addColorStop(1, '#8a7458'); x.fillStyle = g; x.fillRect(0, 0, 640, 360);
  x.fillStyle = '#6a5440'; for (let i = 0; i < 640; i += 40) x.fillRect(i, 0, 3, 360);
  x.fillStyle = '#3a6a8a'; x.fillRect(420, 60, 140, 100); x.fillStyle = '#2e4a30'; x.fillRect(0, 300, 640, 60);
};
// full erase test: tight mic box (clone) + tracked person box (clean plate); returns errors vs the clean room
window.eraseTest = async () => {
  S.global.vignette = 0; window.__walker = [];
  const V = await load(await makeClip(3.5, 'ROOM', 'erase'));
  const tc = document.createElement('canvas'); tc.width = 640; tc.height = 360; drawRoom(tc.getContext('2d'));
  const T = document.createElement('canvas'); T.width = W(); T.height = H(); T.getContext('2d').drawImage(tc, 0, 0, W(), H());
  const truth = T.getContext('2d').getImageData(0, 0, W(), H()).data;
  const errIn = (x0, y0, x1, y1) => { const d = ctx.getImageData(x0, y0, x1 - x0, y1 - y0).data; let s = 0, n = 0;
    for (let y = 0; y < y1 - y0; y += 2) for (let x = 0; x < x1 - x0; x += 2) { const i = (y * (x1 - x0) + x) * 4, j = ((y + y0) * W() + x + x0) * 4; s += Math.abs(d[i] - truth[j]) + Math.abs(d[i + 1] - truth[j + 1]) + Math.abs(d[i + 2] - truth[j + 2]); n++; }
    return +(s / n / 3).toFixed(1); };
  window.errIn = errIn;
  seek(1); addShape('fill'); const M = selLayer(); M.start = 0; M.dur = len(V); M.fillMode = 'clone';
  Object.assign(M.p, { x: 939 / 1920, y: 140 / 1080, w: 140, h: 300, radius: 30, feather: 12, cloneX: 240 / 1920, cloneY: 0 });
  await settle(1); const mic = errIn(860, 0, 1020, 300);
  seek(0); S.sel = V.id; refresh(); await settle(0);
  await startTrack(V, { x: 85 * 3, y: 172 * 3 }); $('#modal').hidden = true;
  const tr = V.tracks[0];
  seek(0); addShape('fill'); const P = selLayer(); P.start = 0; P.dur = len(V);
  Object.assign(P.p, { w: 280, h: 450, radius: 30, feather: 12 });
  const p0 = trackPoint(V, tr, 0); setProp(P, 'x', p0.x); setProp(P, 'y', p0.y + 200 / 1080);
  attachToTrack(P, V, tr);
  await buildPlate(P); $('#modal').hidden = true;
  const box = t => { const cx = (85 + 150 * t) * 3; return [Math.round(cx - 110), 520, Math.round(cx + 110), 890]; };
  const person = {};
  for (const t of [.6, 1.8, 3]) { await settle(t); person['t' + t] = errIn(...box(t)); }
  P.visible = false; await settle(1.8); person.notErased = errIn(...box(1.8)); P.visible = true;
  await settle(1.8); const untouched = errIn(200, 380, 320, 670);
  window.__V = V; window.__M = M; window.__P = P;
  return { compressionBaseline: untouched, micTightBox: mic, person, trackFrames: tr.pts.length };
};
// scan the finished export for leftover red "person" pixels and grey "mic" pixels
window.scanExport = async () => {
  const href = document.querySelector('#mRow a[download]')?.href; if (!href) return { notReady: $('#mText').textContent };
  const v = document.createElement('video'); v.src = href; v.muted = true; await new Promise(r => { v.onloadeddata = r; v.onerror = r; });
  const c = document.createElement('canvas'); c.width = 320; c.height = 180; const x = c.getContext('2d', { willReadFrequently: true });
  const bad = []; let n = 0;
  for (let t = 0.05; t < v.duration; t += .1, n++) {
    v.currentTime = t; await new Promise(r => { v.onseeked = r; setTimeout(r, 1500); });
    x.drawImage(v, 0, 0, 320, 180); const d = x.getImageData(0, 0, 320, 180).data; let red = 0, mic = 0;
    for (let i = 0; i < d.length; i += 4) { if (d[i] > 170 && d[i + 1] < 70 && d[i + 2] < 80) red++; const y = (i / 4 / 320) | 0, xx = (i / 4) % 320; if (y < 48 && xx > 142 && xx < 170 && Math.abs(d[i] - 119) < 14 && Math.abs(d[i + 1] - d[i + 2]) < 8 && Math.abs(d[i] - d[i + 1]) < 8) mic++; }
    if (red > 5 || mic > 5) bad.push({ t: +t.toFixed(2), red, mic });
  }
  return { duration: +v.duration.toFixed(2), framesChecked: n, bad };
};
window.__errs = []; window.addEventListener('error', e => __errs.push(e.message));
window.load = async f => {
  const n = S.layers.length; addFiles([f]);
  await new Promise(r => { const i = setInterval(() => { if (S.layers.length > n) { clearInterval(i); r(); } }, 50); });
  return S.layers.find(L => L.name === f.name);
};
window.settle = async t => { seek(t); for (let i = 0; i < 4; i++) { syncMedia(t); await new Promise(r => setTimeout(r, 150)); } render(); drawOverlay(); };
window.pix =(x, y) => [...ctx.getImageData(Math.round(x * W()), Math.round(y * H()), 1, 1).data].slice(0, 3);
