import io, json
d = 'D:/Lumina/.claude/round31-draft/'
p = 'D:/Lumina/Lumina.html'
raw = io.open(p, 'rb').read(); crlf = b'\r\n' in raw
s = raw.decode('utf-8').replace('\r\n', '\n')
def rep(a, b):
    global s
    assert s.count(a) == 1, (a[:90], s.count(a)); s = s.replace(a, b)
rd = lambda n: io.open(d + n, encoding='utf-8').read().replace('\r\n', '\n')

# the kernel family and its shader file
rep("  lumina_util: ['lumina_util'] };     // Round 29",
    "  lumina_roto: ['lumina_roto'],       // Round 31: Roto Brush & Refine Edge's matte over the frame (shaders/)\n  lumina_util: ['lumina_util'] };     // Round 29")
rep("lumina_util: 'shaders/lumina_util.wgsl' };", "lumina_util: 'shaders/lumina_util.wgsl', lumina_roto: 'shaders/lumina_roto.wgsl' };")
# an effect can stop the rest (Roto Brush reading its own input for the worker)
rep("    cur = D.run(E, cur, q) || cur;\n", "    cur = D.run(E, cur, q) || cur;\n    if (E.stop) break;\n")
# a button's text can depend on the effect's state
rep("""<button data-act="fxbtn" data-fx="${i}" data-k="${d.id}">${esc(d.text)}</button>""",
    """<button data-act="fxbtn" data-fx="${i}" data-k="${d.id}">${esc(typeof d.text === 'function' ? d.text(f) : d.text)}</button>""")
# helpers, the effect, the tool
rep("// ---- Round 30 helpers (Audio-driven)", rd('helpers.js') + "// ---- Round 30 helpers (Audio-driven)")
rep("  // ---- Round 29: Utility & Text (EffectCraft's", rd('effects.js') + "  // ---- Round 29: Utility & Text (EffectCraft's")
rep("// ---------- motion tracking ----------\n", rd('tool.js') + "// ---------- motion tracking ----------\n")
# the overlay
rep("  drawBookmarkNotes(); drawLoadingNote();\n", "  drawBookmarkNotes(); drawLoadingNote(); drawRotoNote();\n")
rep("  drawTracks(L);\n}\nfunction compPoint(e) {", "  drawTracks(L);\n  rotoOverlay(L);\n}\nfunction compPoint(e) {")
# the tool's bar under the preview
rep("""<button id="cropNo" title="Esc">Cancel</button></span>\n""",
    """<button id="cropNo" title="Esc">Cancel</button></span>
      <span class="cropbar" id="rotoBar" hidden><select id="rotoMode" title="Which brush"><option value="roto">Roto Brush</option><option value="refine">Refine Edge</option></select>
        <label title="Brush size in layer pixels (Ctrl+drag on the preview)">Size <input id="rotoSize" type="range" min="2" max="400" step="1"> <b id="rotoSizeN"></b></label>
        <label title="Show the layer cut out while you paint"><input type="checkbox" id="rotoResult"> Show the cut-out</label><button class="primary" id="rotoDone" title="Esc">Done</button></span>\n""")
# Esc ends the tool; Alt+W starts it (After Effects' shortcut)
rep("  if (e.key === 'Escape' && (trackMode || picking || wbPick)) {",
    "  if (e.key === 'Escape' && ROTO.tool) { rotoToolEnd(); inspector(); return; }\n  if (e.altKey && !e.ctrlKey && !e.metaKey && !e.shiftKey && e.key.toLowerCase() === 'w') { e.preventDefault(); rotoMenu(); return; }\n  if (e.key === 'Escape' && (trackMode || picking || wbPick)) {")
# the Layer menu
rep("    ['Show / hide layer', '', () => { const L = selLayer(); L.visible = !L.visible; commit(); refresh(); }, !!selLayer()]],",
    "    ['Show / hide layer', '', () => { const L = selLayer(); L.visible = !L.visible; commit(); refresh(); }, !!selLayer()], '-',\n    ['Roto Brush', 'Alt+W', rotoMenu, !!selLayer() && selLayer().kind !== 'audio']],")
# export: the mattes worked out first
rep("  await auWarmAll();   // and the sound Audio Spectrum / Audio Waveform follow, decoded\n",
    "  await auWarmAll();   // and the sound Audio Spectrum / Audio Waveform follow, decoded\n  await rotoWarmAll();   // and every Roto Brush frame's matte worked out\n")
# frozen mattes live outside the undo history, and are saved with the project
rep("global: S.global, media, luts });",
    "global: S.global, media, luts, rotoFrozen: rotoFrozenSave() });")
rep("function projectJSON() {", """// the frozen Roto Brush mattes the layers use (their decoded copies left out)
function rotoFrozenSave() {
  const out = {};
  for (const L of S.layers) for (const f of L.fx || []) { const F = f.frozen && ROTO.frozen[f.frozen]; if (F) out[f.frozen] = { key: F.key, w: F.w, h: F.h, frames: Object.fromEntries(Object.entries(F.frames).map(([g, v]) => [g, { a: v.a, b: v.b }])) }; }
  return out;
}
function projectJSON() {""")
rep("  canvas.width = d.comp.w; canvas.height = d.comp.h; S.fps = d.comp.fps;\n",
    "  Object.assign(ROTO.frozen, d.rotoFrozen || {});\n  canvas.width = d.comp.w; canvas.height = d.comp.h; S.fps = d.comp.fps;\n")
if crlf: s = s.replace('\n', '\r\n')
io.open(p, 'wb').write(s.encode('utf-8'))

# the worker ships with the app
pk = 'D:/Lumina/package.json'
t = io.open(pk, encoding='utf-8').read()
assert t.count('"shaders/**"') == 1
t = t.replace('"shaders/**"', '"shaders/**",\n      "workers/**"')
io.open(pk, 'w', encoding='utf-8').write(t)
print('ok')
