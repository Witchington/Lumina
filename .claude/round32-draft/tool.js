// ---- Round 32: the 3D Camera Tracker on the preview (EffectCraft's ui-egui camera_tracker_ui.rs): the track points
// while the layer is selected; Select track points to pick them (click a point, click inside a triangle of three, drag
// a box, Shift adds), the target under the cursor, right-click to create text or a solid there, Delete removes points
// Layer › Track Camera: the 3D Camera Tracker on the selected layer (reusing one it has), analysing straight away
function ctMenu() {
  const L = selLayer();
  if (!L || !['video', 'image'].includes(L.kind) && !L.media) return toast('Select a video layer first.');
  let f = L.fx?.find(x => x.id === 'cameratracker');
  if (!f) { f = addFX(L, 'cameratracker'); commit(); }
  setRightTab('fx'); refresh();
  notice('3D Camera Tracker: analyzing in the background. You can keep working; the track points show when the camera is solved.');
}
function ctTool(L, f) {
  if (!ctOf(f).sol) return toast('The camera isn’t solved yet. Wait for the analysis to finish.');
  S.sel = L.id; pause(); if (CT.sel.uid !== f.uid) CT.sel = { uid: f.uid, ids: new Set() };
  CT.tool = { lid: L.id, uid: f.uid, down: null, box: null }; ctBarUI(); refresh();
  notice('Click inside three track points (or drag a box round some). Right-click to place text or a solid there. Esc ends.');
}
function ctToolEnd() { if (!CT.tool) return; CT.tool = null; ctMenuClose(); ctBarUI(); refresh(); }
function ctBarUI() { $('#ctBar').hidden = !CT.tool; const n = CT.sel.ids.size; $('#ctBarN').textContent = n ? `${n} selected` : 'none selected'; }
$('#ctDone').onclick = () => { ctToolEnd(); inspector(); };
const ctToolFx = () => { const t = CT.tool, L = t && byId(t.lid), f = L?.fx?.find(x => x.uid === t.uid); return f && { L, f }; };
const ctOvPt = e => { const p = compPoint(e), k = ov.width / W(); return [p.x * k, p.y * k]; };
// the drawn point under p (overlay pixels), and the three drawn points forming a triangle round p (nearest first)
function ctPointAt(p) {
  let best = null, bd = Infinity;
  for (const h of CT.hits) { const d = Math.hypot(h.x - p[0], h.y - p[1]); if (d <= h.r + 3 && d < bd) { bd = d; best = h.id; } }
  return best;
}
function ctTriangleAt(p) {
  const near = [...CT.hits].sort((a, b) => Math.hypot(a.x - p[0], a.y - p[1]) - Math.hypot(b.x - p[0], b.y - p[1])).slice(0, 8);
  const side = (a, b) => (b.x - a.x) * (p[1] - a.y) - (b.y - a.y) * (p[0] - a.x);
  for (let i = 0; i < near.length; i++) for (let j = i + 1; j < near.length; j++) for (let k = j + 1; k < near.length; k++) {
    const a = near[i], b = near[j], c = near[k], area = Math.abs((b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x));
    const d1 = side(a, b), d2 = side(b, c), d3 = side(c, a);
    if (area > 30 && !((d1 < 0 || d2 < 0 || d3 < 0) && (d1 > 0 || d2 > 0 || d3 > 0))) return [a.id, b.id, c.id];
  }
  return null;
}
function ctSelect(ids, how) {
  const s = CT.sel.ids;
  if (how === 'set') { s.clear(); ids.forEach(i => s.add(i)); }
  else if (how === 'add') ids.forEach(i => s.add(i));
  else ids.forEach(i => s.has(i) ? s.delete(i) : s.add(i));
  ctBarUI(); inspector(); drawOverlay();
}
ov.addEventListener('pointerdown', e => {
  const t = CT.tool; if (!t || ROTO.tool) return;
  e.stopImmediatePropagation(); e.preventDefault(); ctMenuClose();
  if (e.button === 2) return;
  if (e.button !== 0) return;
  t.down = ctOvPt(e); t.box = null;
  try { ov.setPointerCapture(e.pointerId); } catch { }
}, true);
ov.addEventListener('pointermove', e => {
  const t = CT.tool; if (!t || ROTO.tool) return;
  e.stopImmediatePropagation(); const p = ctOvPt(e); CT.hover = p;
  if (t.down && (t.box || Math.hypot(p[0] - t.down[0], p[1] - t.down[1]) > 4)) t.box = [t.down, p];
  drawOverlay();
}, true);
ov.addEventListener('pointerup', e => {
  const t = CT.tool; if (!t || ROTO.tool || e.button !== 0) return;
  e.stopImmediatePropagation();
  const p = ctOvPt(e), box = t.box; t.down = null; t.box = null;
  if (box) {
    const [x0, x1] = [Math.min(box[0][0], box[1][0]), Math.max(box[0][0], box[1][0])], [y0, y1] = [Math.min(box[0][1], box[1][1]), Math.max(box[0][1], box[1][1])];
    ctSelect(CT.hits.filter(h => h.x >= x0 && h.x <= x1 && h.y >= y0 && h.y <= y1).map(h => h.id), e.shiftKey ? 'add' : 'set'); return;
  }
  const id = ctPointAt(p), tri = id == null && ctTriangleAt(p);
  if (id != null) ctSelect([id], e.shiftKey ? 'toggle' : 'set');
  else if (tri) ctSelect(tri, e.shiftKey ? 'add' : 'set');
  else ctSelect([], 'set');
}, true);
ov.addEventListener('pointerleave', () => { if (CT.tool) { CT.hover = null; drawOverlay(); } });
ov.addEventListener('contextmenu', e => {
  const t = CT.tool; if (!t || ROTO.tool) return;
  e.preventDefault(); e.stopImmediatePropagation();
  const p = ctOvPt(e);
  if (!CT.sel.ids.size) { const id = ctPointAt(p), tri = id == null ? ctTriangleAt(p) : null; if (id != null) ctSelect([id], 'set'); else if (tri) ctSelect(tri, 'set'); }
  ctMenuOpen(e.clientX, e.clientY);
}, true);
// the right-click menu (camera_tracker_ui's context menu, without the camera, null, light and ground plane items
// Lumina can't make yet)
function ctMenuOpen(x, y) {
  ctMenuClose();
  const o = ctToolFx(); if (!o) return;
  const n = CT.sel.ids.size, m = document.createElement('div'); m.className = 'pop ctmenu'; m.id = 'ctMenu';
  m.style.cssText = `position:fixed;left:${x}px;top:${y}px;z-index:9999;min-width:240px`;
  const items = [['Create Text', () => ctCreate(o.L, o.f, 'text', false), n > 0], ['Create Solid', () => ctCreate(o.L, o.f, 'solid', false), n > 0], '-',
    ['Create Multiple Text Layers', () => ctCreate(o.L, o.f, 'text', true), n > 1], ['Create Multiple Solids', () => ctCreate(o.L, o.f, 'solid', true), n > 1], '-',
    ['Delete Selected Points', () => ctDeletePoints(o.L, o.f), n > 0]];
  m.innerHTML = items.map((it, i) => it === '-' ? '<hr>' : `<button data-ct="${i}"${it[2] ? '' : ' disabled'}><span>${it[0]}</span><span class="hint"></span></button>`).join('');
  m.onclick = e => { e.stopPropagation(); const b = e.target.closest('[data-ct]'); if (!b || b.disabled) return; ctMenuClose(); items[+b.dataset.ct][1](); };
  document.body.appendChild(m); CT.menu = m;
  const r = m.getBoundingClientRect(); if (r.right > innerWidth) m.style.left = Math.max(0, innerWidth - r.width - 4) + 'px'; if (r.bottom > innerHeight) m.style.top = Math.max(0, innerHeight - r.height - 4) + 'px';
}
function ctMenuClose() { CT.menu?.remove(); CT.menu = null; }
document.addEventListener('pointerdown', e => { if (CT.menu && !CT.menu.contains(e.target)) ctMenuClose(); }, true);
// Create Text / Create Solid (and Create Multiple …) on the selection's target: new layers above the tracked one, with
// Camera Track Pin; one undo step (camera_cmds::create_from_solve)
function ctCreate(L, f, kind, multiple) {
  const { sol } = ctOf(f); if (!sol) return toast('The camera isn’t solved yet.');
  const ids = CT.sel.uid === f.uid ? [...CT.sel.ids] : [];
  if (!ids.length) return toast('Select track points first: click inside three of them on the preview.');
  const k = ctFrameIdx(sol, L, S.time), tg = ctTarget(sol, ids, k);
  if (!tg && !multiple) return toast('Those points don’t make a plane. Pick three or more that are further apart.');
  const cam = ctCam(sol, k), right = ctMtv(cam.R, [1, 0, 0]), base = tg || { normal: ctMtv(cam.R, [0, 0, -1]), size: 0.1 };
  const axes = ctPlaneAxes(base.normal, right), pct = val(L, fxKey(f, 'targetSize')) / 100;
  const centers = multiple ? ids.map(i => sol.points.find(p => p.id === i)?.pos).filter(Boolean) : [tg.center];
  const size = (tg ? tg.size : Math.hypot(...ctSub(cam.center, centers[0] || cam.center)) * 0.12) * pct * (multiple ? 0.4 : 1), made = [], start = L.start || 0, dur = endOf(L) - start;
  const nameOf = b => { let n = 1; while (S.layers.some(x => x.name === `${b} ${n}`)) n++; return `${b} ${n}`; };
  for (const c of centers) {
    let N;
    if (kind === 'text') { N = newLayer('text', { name: nameOf('Track Text'), text: 'Text', start, dur, font: 'Anton', color: '#ffffff', strokeColor: '#000000', stroke: false, anim: 'none' }); Object.assign(N.p, { size: 140 }); }
    else { const [r, g, b] = ctColor(made.length + 7), col = '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join(''); N = newLayer('shape', { name: nameOf('Track Solid'), shape: 'rect', start, dur, filled: true, fill: col, strokeColor: col }); Object.assign(N.p, { w: 512, h: 512, strokeW: 0 }); }
    const pf = addFX(N, 'campin'); pf.pin = { lid: L.id, uid: f.uid, c, x: axes.x, y: axes.y, size };
    S.layers.splice(S.layers.indexOf(L), 0, N); ensureRT(N); made.push(N);
  }
  CT.tool = null; ctMenuClose(); ctBarUI();
  S.sel = made[made.length - 1].id; commit(); refresh();
  notice(`${made.length === 1 ? made[0].name : made.length + ' layers'} placed in the tracked scene. ${kind === 'text' ? 'Double-click to change the words; ' : ''}Camera Track Pin keeps ${made.length === 1 ? 'it' : 'them'} on the surface.`);
  return made;
}
// Delete Selected Points, and with Auto-delete Points Across Time the other tracks of the same 3D feature (solved
// within 1 % of its depth on frames it wasn't tracked); then the camera is solved again (camera_cmds::delete_points)
function ctDeletePoints(L, f) {
  const { sol } = ctOf(f), ids = CT.sel.uid === f.uid ? [...CT.sel.ids] : [];
  if (!ids.length) return toast('Select the track points to delete first (Select track points).');
  const add = [...ids];
  if (sol && f.autoDelete !== false) {
    const c0 = ctCam(sol, Math.max(0, sol.frames.findIndex(x => x.solved)))?.center || [0, 0, 0];
    for (const id of ids) {
      const pt = sol.points.find(p => p.id === id); if (!pt) continue;
      const r = Math.hypot(...ctSub(pt.pos, c0)) * 0.01;
      for (const q of sol.points) if (q.id !== id && (q.last < pt.first || q.first > pt.last) && Math.hypot(...ctSub(q.pos, pt.pos)) < r) add.push(q.id);
    }
  }
  f.deleted = [...new Set([...(f.deleted || []), ...add])].sort((a, b) => a - b);
  CT.sel.ids.clear(); ctBarUI(); commit(); refresh();
  notice(`Deleted ${add.length} track point${add.length === 1 ? '' : 's'}. Solving the camera again…`);
}
// the overlay: the track points of the selected layer's trackers (3D solved, or the 2D source tracks), the selection,
// the target under the cursor (or the selection's), the drag box
function ctOverlay(L) {
  CT.hits = [];
  const r = RT[L.id]; if (!r?.m || !r.box) return;
  const k = ov.width / W(), lm = new DOMMatrix().scale(k, k).multiply(r.m).translate(-r.box.w / 2, -r.box.h / 2);
  for (const f of L.fx || []) {
    if (f.id !== 'cameratracker' || f.on === false) continue;
    const { sol, tracks } = ctOf(f), tool = CT.tool?.uid === f.uid ? CT.tool : null, sel = CT.sel.uid === f.uid ? CT.sel.ids : new Set();
    const pct = val(L, fxKey(f, 'pointSize')), lsc = Math.hypot(lm.a, lm.b) || 1;
    const show3 = (f.showPoints ?? 1) === 1 && sol, ideal = !!f.undistort && sol && !ctDistNone(sol.distortion);
    if (show3) {
      if (Math.abs(sol.size[0] - r.box.w) > .5) continue;
      const kk = ctFrameIdx(sol, L, S.time), pts = ctVisible(sol, kk, ideal), mz = ctMedianZ(pts);
      for (const p of pts) {
        const s = lm.transformPoint(new DOMPoint(p.x, p.y)); if (s.x < -20 || s.y < -20 || s.x > ov.width + 20 || s.y > ov.height + 20) continue;
        const rr = clamp(ctTargetRadius(pct, p.z, mz) * lsc, 2, 30), [cr, cg, cb] = ctColor(p.id), c = `rgb(${cr},${cg},${cb})`;
        octx.beginPath(); octx.arc(s.x, s.y, rr, 0, Math.PI * 2);
        if (sel.has(p.id)) { octx.fillStyle = c; octx.fill(); octx.lineWidth = 1.5; octx.strokeStyle = '#fff'; octx.beginPath(); octx.arc(s.x, s.y, rr + 1.5, 0, Math.PI * 2); octx.stroke(); }
        else { octx.lineWidth = clamp(rr * .3, 1, 3); octx.strokeStyle = c; octx.stroke(); octx.beginPath(); octx.arc(s.x, s.y, Math.max(1, rr * .25), 0, Math.PI * 2); octx.fillStyle = c; octx.fill(); }
        CT.hits.push({ id: p.id, x: s.x, y: s.y, r: rr });
      }
      if (tool) {
        const hp = CT.hover, tri = !tool.box && hp && ctPointAt(hp) == null ? ctTriangleAt(hp) : null, ids = tri || (sel.size ? [...sel] : null), tg = ids && ctTarget(sol, ids, kk);
        if (tri) { const ps = tri.map(i => CT.hits.find(h => h.id === i)); octx.beginPath(); ps.forEach((h, i) => i ? octx.lineTo(h.x, h.y) : octx.moveTo(h.x, h.y)); octx.closePath(); octx.lineWidth = 1; octx.strokeStyle = 'rgba(255,255,255,.8)'; octx.stroke(); }
        if (tg) ctDrawTarget(lm, sol, kk, tg, val(L, fxKey(f, 'targetSize')), ideal);
        if (tool.box) { const [a, b] = tool.box; octx.fillStyle = 'rgba(80,160,255,.12)'; octx.strokeStyle = 'rgba(80,160,255,.9)'; octx.lineWidth = 1; octx.fillRect(Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1])); octx.strokeRect(Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1])); }
      }
    } else if (tracks) {
      // the 2D source tracks (also shown before the solve finishes): small crosses
      const kk = clamp(rotoFrame(L, S.time) - tracks.start, 0, tracks.frames - 1), rr = clamp(3 * pct / 100, 1.5, 12);
      octx.lineWidth = 1.2;
      for (const t of tracks.tracks) {
        const i = kk - t.start; if (i < 0 || i >= t.n) continue;
        const s = lm.transformPoint(new DOMPoint(tracks.pts[t.o + 2 * i], tracks.pts[t.o + 2 * i + 1])), [cr, cg, cb] = ctColor(t.id);
        octx.strokeStyle = `rgb(${cr},${cg},${cb})`; octx.beginPath(); octx.moveTo(s.x - rr, s.y - rr); octx.lineTo(s.x + rr, s.y + rr); octx.moveTo(s.x - rr, s.y + rr); octx.lineTo(s.x + rr, s.y - rr); octx.stroke();
      }
    }
  }
}
// the target disc: concentric rings in perspective on the target's plane, and its centre
function ctDrawTarget(lm, sol, k, tg, sizePct, ideal) {
  const { x, y } = ctPlaneAxes(tg.normal, ctMtv(ctCam(sol, k).R, [1, 0, 0])), R0 = tg.size * .5 * sizePct / 100;
  [1, .66, .33].forEach((fr, i) => {
    const ps = [];
    for (let j = 0; j < 48; j++) { const a = j / 48 * Math.PI * 2, X = ctAdd(tg.center, ctAdd(ctSc(x, R0 * fr * Math.cos(a)), ctSc(y, R0 * fr * Math.sin(a)))), q = ctProject(sol, k, X, ideal); if (q) ps.push(lm.transformPoint(new DOMPoint(q[0], q[1]))); }
    if (ps.length < 3) return;
    octx.beginPath(); ps.forEach((p, j) => j ? octx.lineTo(p.x, p.y) : octx.moveTo(p.x, p.y)); octx.closePath();
    octx.fillStyle = i % 2 ? 'rgba(255,255,255,.2)' : 'rgba(208,48,48,.28)'; octx.fill(); octx.lineWidth = 1; octx.strokeStyle = '#e04040'; octx.stroke();
  });
  const c = ctProject(sol, k, tg.center, ideal);
  if (c) { const p = lm.transformPoint(new DOMPoint(c[0], c[1])); octx.beginPath(); octx.arc(p.x, p.y, 3, 0, Math.PI * 2); octx.fillStyle = '#ffd040'; octx.fill(); }
}
// "Analyzing in background (step 1 of 2)" / "Solving camera" at the bottom left, and "Unable to solve camera" over a
// selected tracker that failed (unless Hide Warning Banner)
function drawCtNote() {
  if (S.exporting) return;
  const j = CT.job, L = selLayer(), bad = !j && L?.fx?.find(f => f.id === 'cameratracker' && f.on !== false && !f.hideWarning && ctOf(f).fail);
  if (!j && !bad) return;
  const k = ov.width / 960, txt = j ? (j.step === 1 ? `3D Camera Tracker: analyzing in background (step 1 of 2) · ${j.n || 0} of ${j.m} frames` : `3D Camera Tracker: solving camera (step 2 of 2)${j.sp ? ' · ' + Math.round(j.sp * 100) + '%' : ''}`) : '3D Camera Tracker: unable to solve camera';
  octx.font = `600 ${Math.round(13 * k)}px system-ui, sans-serif`;
  const w = octx.measureText(txt).width + 22 * k, h = 26 * k, x = 10 * k, y = ov.height - 3 * h - 22 * k;
  octx.fillStyle = bad ? 'rgba(156,42,29,.88)' : 'rgba(0,0,0,.65)'; octx.beginPath(); octx.roundRect(x, y, w, h, h / 2); octx.fill();
  octx.fillStyle = bad ? '#fff' : '#9fd8ff'; octx.textBaseline = 'middle'; octx.fillText(txt, x + 11 * k, y + h / 2);
}
