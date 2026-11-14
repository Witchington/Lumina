import io, shutil
d = 'D:/Lumina/.claude/round32-draft/'
p = 'D:/Lumina/Lumina.html'
raw = io.open(p, 'rb').read(); crlf = b'\r\n' in raw
s = raw.decode('utf-8').replace('\r\n', '\n')
def rep(a, b):
    global s
    assert s.count(a) == 1, (a[:90], s.count(a)); s = s.replace(a, b)
rd = lambda n: io.open(d + n, encoding='utf-8').read().replace('\r\n', '\n')

# the kernel family and its shader file
rep("  lumina_roto: ['lumina_roto'],       // Round 31: Roto Brush & Refine Edge's matte over the frame (shaders/)\n",
    "  lumina_roto: ['lumina_roto'],       // Round 31: Roto Brush & Refine Edge's matte over the frame (shaders/)\n"
    "  lumina_camtrack: ['lumina_camtrack'],   // Round 32: the 3D Camera Tracker's Undistort Footage (shaders/)\n")
rep("lumina_roto: 'shaders/lumina_roto.wgsl' };", "lumina_roto: 'shaders/lumina_roto.wgsl', lumina_camtrack: 'shaders/lumina_camtrack.wgsl' };")
# helpers, the effects, the tool
rep("// ---- Round 31 helpers (Roto Brush & Refine Edge)", rd('helpers.js') + "// ---- Round 31 helpers (Roto Brush & Refine Edge)")
rep("  // ---- Round 31: Roto Brush & Refine Edge (EffectCraft's", rd('effects.js') + "  // ---- Round 31: Roto Brush & Refine Edge (EffectCraft's")
rep("// ---------- motion tracking ----------\n", rd('tool.js') + "// ---------- motion tracking ----------\n")
# the overlay: the banner, the track points
rep("  drawBookmarkNotes(); drawLoadingNote(); drawRotoNote();\n", "  drawBookmarkNotes(); drawLoadingNote(); drawRotoNote(); drawCtNote();\n")
rep("  rotoOverlay(L);\n}\nfunction compPoint(e) {", "  rotoOverlay(L);\n  octx.save(); octx.setTransform(1, 0, 0, 1, 0, 0); ctOverlay(L); octx.restore();\n}\nfunction compPoint(e) {")
# the tool's bar under the preview
rep("""<button class="primary" id="rotoDone" title="Esc">Done</button></span>\n""",
    """<button class="primary" id="rotoDone" title="Esc">Done</button></span>
      <span class="cropbar" id="ctBar" hidden><b>3D Camera Tracker</b> <span>Click inside three points, drag a box (Shift adds), right-click to create.</span> <b id="ctBarN"></b>
        <button class="primary" id="ctDone" title="Esc">Done</button></span>\n""")
# Esc ends the point picking; Delete removes the selected points
rep("  if (e.key === 'Escape' && ROTO.tool) { rotoToolEnd(); inspector(); return; }\n",
    "  if (e.key === 'Escape' && ROTO.tool) { rotoToolEnd(); inspector(); return; }\n"
    "  if (e.key === 'Escape' && CT.tool) { ctToolEnd(); inspector(); return; }\n"
    "  if ((e.key === 'Delete' || e.key === 'Backspace') && CT.tool && CT.sel.ids.size) { e.preventDefault(); const o = ctToolFx(); if (o) ctDeletePoints(o.L, o.f); return; }\n")
# the Layer menu (After Effects: Animation › Track Camera)
rep("    ['Roto Brush', 'Alt+W', rotoMenu, !!selLayer() && selLayer().kind !== 'audio']],",
    "    ['Roto Brush', 'Alt+W', rotoMenu, !!selLayer() && selLayer().kind !== 'audio'], ['Track Camera', '', ctMenu, !!selLayer()?.media && selLayer().kind !== 'audio']],")
# export: the analyses finished first
rep("  await rotoWarmAll();   // and every Roto Brush frame's matte worked out\n",
    "  await rotoWarmAll();   // and every Roto Brush frame's matte worked out\n  await ctWarmAll();   // and the 3D Camera Tracker analyses finished\n")
# the analyses are saved with the project
rep("global: S.global, media, luts, rotoFrozen: rotoFrozenSave() });",
    "global: S.global, media, luts, rotoFrozen: rotoFrozenSave(), camTrack: ctSave() });")
rep("  Object.assign(ROTO.frozen, d.rotoFrozen || {});\n", "  Object.assign(ROTO.frozen, d.rotoFrozen || {}); ctLoad(d.camTrack);\n")
if crlf: s = s.replace('\n', '\r\n')
io.open(p, 'wb').write(s.encode('utf-8'))

# the worker ships with the app (workers/** is already in package.json)
shutil.copyfile(d + 'camtrack.js', 'D:/Lumina/workers/camtrack.js')
print('ok')
