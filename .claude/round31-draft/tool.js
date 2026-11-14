// ---- Round 31: the Roto Brush and Refine Edge tools on the preview (EffectCraft's ui-egui roto_tool.rs: green
// foreground strokes, Alt for red background strokes, Refine Edge strokes along soft edges, the matte's edge in pink) ----
function rotoMenu() {
  const L = selLayer();
  if (!L || !['video', 'image', 'text', 'shape'].includes(L.kind) && !L.media) return toast('Select a video or picture layer first.');
  let f = L.fx?.find(x => x.id === 'rotobrush');
  if (!f) { f = addFX(L, 'rotobrush'); commit(); }
  setRightTab('fx'); rotoTool(L, f, 'roto', true);
}
function rotoTool(L, f, mode, keep) {
  if (!keep && ROTO.tool?.uid === f.uid && ROTO.tool.mode === mode) return rotoToolEnd();
  if (f.frozen) return toast('This Roto Brush is frozen. Unfreeze it to paint again.');
  S.sel = L.id; pause();
  ROTO.tool = { lid: L.id, uid: f.uid, mode, size: ROTO.tool?.size || 25, result: false, stroke: null, hover: null };
  rotoBarUI(); refresh();
  notice(mode === 'roto' ? 'Paint over the object. Hold Alt to paint what isn’t part of it. Ctrl+drag changes the brush size. Esc ends.'
    : 'Paint along soft edges such as hair or fur. Hold Alt to take some away. Esc ends.');
}
function rotoToolEnd() { if (!ROTO.tool) return; ROTO.tool = null; rotoBarUI(); refresh(); }
function rotoBarUI() {
  const t = ROTO.tool; $('#rotoBar').hidden = !t; ov.style.cursor = t ? 'none' : '';
  if (t) { $('#rotoSize').value = Math.round(t.size); $('#rotoSizeN').textContent = Math.round(t.size); $('#rotoMode').value = t.mode; $('#rotoResult').checked = !!t.result; }
}
$('#rotoMode').onchange = e => { if (ROTO.tool) { ROTO.tool.mode = e.target.value; inspector(); } e.target.blur(); };
$('#rotoSize').oninput = e => { if (ROTO.tool) { ROTO.tool.size = +e.target.value; $('#rotoSizeN').textContent = e.target.value; } };
$('#rotoResult').onchange = e => { if (ROTO.tool) ROTO.tool.result = e.target.checked; e.target.blur(); };
$('#rotoDone').onclick = () => { rotoToolEnd(); inspector(); };
// the span's start or end at the playhead (the base frame stays inside it)
function rotoSetSpan(L, f, end) {
  const d = f.roto; if (rotoEmpty(d)) return toast('Paint over the object with the Roto Brush first.');
  if (f.frozen) return toast('This Roto Brush is frozen. Unfreeze it first.');
  const [lo, hi] = rotoLimits(L), g = clamp(rotoFrame(L, S.time), lo, hi), span = [...d.span];
  if (end) span[1] = Math.max(g, d.base); else span[0] = Math.min(g, d.base);
  f.roto = { ...d, span }; commit(); inspector();
}
async function rotoPropagate(L, f) {
  if (rotoEmpty(f.roto)) return toast('Paint over the object with the Roto Brush first.');
  const jobs = await rotoAll(L, f, { progress: (n, m) => { ROTO.status = `Roto Brush: ${n} of ${m} frames worked out`; } });
  ROTO.status = ''; notice(`Roto Brush: ${jobs.length} frames worked out.`);
}
const rotoToolFx = () => { const t = ROTO.tool, L = t && byId(t.lid); return L && { L, f: L.fx?.find(x => x.uid === t.uid) }; };
function rotoLayerPt(L, pt) {
  const r = RT[L.id], q = r.m.inverse().transformPoint(new DOMPoint(pt.x, pt.y));
  return [q.x + r.box.w / 2, q.y + r.box.h / 2];
}
ov.addEventListener('pointerdown', e => {
  const t = ROTO.tool; if (!t || e.button !== 0) return;
  e.stopImmediatePropagation(); e.preventDefault();
  const o = rotoToolFx(); if (!o?.f || !RT[o.L.id]?.m) return;
  if (e.ctrlKey || e.metaKey) t.resize = { x: e.clientX, size: t.size };
  else t.stroke = { k: t.mode === 'roto' ? (e.altKey ? 'bg' : 'fg') : (e.altKey ? 'erase' : 'refine'), r: t.size, p: [rotoLayerPt(o.L, compPoint(e))] };
  try { ov.setPointerCapture(e.pointerId); } catch { }
}, true);
ov.addEventListener('pointermove', e => {
  const t = ROTO.tool; if (!t) return;
  e.stopImmediatePropagation(); t.hover = compPoint(e);
  const o = rotoToolFx(); if (!o?.f || !RT[o.L.id]?.m) return;
  if (t.resize) { const k = W() / ov.getBoundingClientRect().width / (Math.hypot(RT[o.L.id].m.a, RT[o.L.id].m.b) || 1); t.size = clamp(t.resize.size + (e.clientX - t.resize.x) * k, 2, 400); rotoBarUI(); return; }
  if (t.stroke) {
    const p = rotoLayerPt(o.L, t.hover), last = t.stroke.p[t.stroke.p.length - 1];
    if (Math.hypot(p[0] - last[0], p[1] - last[1]) >= Math.max(1, t.stroke.r / 4)) t.stroke.p.push(p);
  }
}, true);
ov.addEventListener('pointerup', e => {
  const t = ROTO.tool; if (!t) return;
  e.stopImmediatePropagation();
  if (t.resize) { t.resize = null; return; }
  const s = t.stroke; t.stroke = null; if (!s) return;
  const o = rotoToolFx(); if (!o?.f) return;
  if (rotoAddStroke(o.L, o.f, s, rotoFrame(o.L, S.time))) { commit(); inspector(); }
}, true);
ov.addEventListener('pointerleave', () => { if (ROTO.tool) ROTO.tool.hover = null; });
// the overlay: this frame's strokes, the matte's edge (pink), the Refine Edge band (cyan), the search region, the brush
function rotoOverlay(L) {
  const k = ov.width / W(), r = RT[L.id]; if (!r?.m) return;
  for (const f of L.fx || []) {
    if (f.id !== 'rotobrush' || f.on === false) continue;
    const t = ROTO.tool?.uid === f.uid ? ROTO.tool : null, job = ROTO.last[f.uid], g = rotoFrame(L, S.time);
    const viewSearch = !!f.viewSearch;
    if (!t && !viewSearch) continue;
    const layerM = new DOMMatrix().scale(k, k).multiply(r.m).translate(-r.box.w / 2, -r.box.h / 2), lsc = Math.hypot(layerM.a, layerM.b) || 1;
    // the strokes painted on this frame, faint
    if (t) for (const s of f.roto?.strokes || []) if (s.f === g) rotoDrawStroke(layerM, lsc, s, .22);
    const o = job && job.L === L && job.g === g && ROTO.outline.get(job.C.keys.get(g));
    if (o) {
      const gm = DOMMatrix.fromMatrix(layerM).scale(1 / o.gs, 1 / o.gs), gsc = lsc / o.gs;
      octx.save(); octx.setTransform(gm);
      const path = segs => { octx.beginPath(); for (let i = 0; i < segs.length; i += 4) { octx.moveTo(segs[i], segs[i + 1]); octx.lineTo(segs[i + 2], segs[i + 3]); } };
      if (viewSearch) { path(o.o); octx.lineWidth = 2 * Math.max(1, job.C.opts.searchRadius * o.gs); octx.strokeStyle = 'rgba(255,214,64,.28)'; octx.stroke(); }
      if (o.band) { path(o.band); octx.lineWidth = 1.5 / gsc; octx.strokeStyle = '#4fd8ff'; octx.stroke(); }
      path(o.o); octx.lineWidth = 2 / gsc; octx.strokeStyle = '#ff4fa3'; octx.stroke();
      octx.restore();
    }
    if (t?.stroke) rotoDrawStroke(layerM, lsc, t.stroke, .55);
    if (t?.hover) {
      octx.save(); octx.setTransform(layerM); const p = rotoLayerPt(L, t.hover);
      octx.beginPath(); octx.arc(p[0], p[1], t.size, 0, Math.PI * 2); octx.lineWidth = 1.5 / lsc;
      octx.strokeStyle = t.mode === 'refine' ? '#4fd8ff' : '#5be37a'; octx.stroke();
      octx.beginPath(); octx.moveTo(p[0] - 4 / lsc, p[1]); octx.lineTo(p[0] + 4 / lsc, p[1]); octx.moveTo(p[0], p[1] - 4 / lsc); octx.lineTo(p[0], p[1] + 4 / lsc); octx.stroke();
      octx.restore();
    }
  }
}
const ROTO_INK = { fg: '60,220,100', bg: '240,70,70', refine: '80,200,255', erase: '170,120,255' };
function rotoDrawStroke(m, sc, s, a) {
  octx.save(); octx.setTransform(m); octx.strokeStyle = `rgba(${ROTO_INK[s.k]},${a})`; octx.fillStyle = octx.strokeStyle;
  octx.lineWidth = 2 * s.r; octx.lineCap = octx.lineJoin = 'round'; octx.beginPath();
  if (s.p.length === 1) { octx.arc(s.p[0][0], s.p[0][1], s.r, 0, Math.PI * 2); octx.fill(); }
  else { octx.moveTo(s.p[0][0], s.p[0][1]); for (const p of s.p.slice(1)) octx.lineTo(p[0], p[1]); octx.stroke(); }
  octx.restore();
}
// "Roto Brush: working…" at the bottom left while frames are being worked out (above "Loading video…")
function drawRotoNote() {
  if (S.exporting || !(ROTO.busy || rotoQueued())) return;
  const k = ov.width / 960, txt = ROTO.status || 'Roto Brush: working out the matte…';
  octx.font = `600 ${Math.round(13 * k)}px system-ui, sans-serif`;
  const w = octx.measureText(txt).width + 22 * k, h = 26 * k, x = 10 * k, y = ov.height - 2 * h - 16 * k;
  octx.fillStyle = 'rgba(0,0,0,.65)'; octx.beginPath(); octx.roundRect(x, y, w, h, h / 2); octx.fill();
  octx.fillStyle = '#ff9ccc'; octx.textBaseline = 'middle'; octx.fillText(txt, x + 11 * k, y + h / 2);
}
