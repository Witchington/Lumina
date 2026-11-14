import io, re
D = r'D:\Lumina\.claude\round29-draft\\'
p = r'D:\Lumina\Lumina.html'
raw = io.open(p, 'rb').read(); crlf = b'\r\n' in raw
s = raw.decode('utf-8').replace('\r\n', '\n')
def rep(a, b):
    global s
    assert s.count(a) == 1, (a[:80], s.count(a)); s = s.replace(a, b)
def rd(n): return io.open(D + n, encoding='utf-8').read().replace('\r\n', '\n')

# kernel families: fx_text.wgsl (EffectCraft's, unchanged) and Lumina's shaders/lumina_util.wgsl
m = re.search(r"\n  lumina_sim: \['lumina_sim'\] \};[^\n]*\n", s); assert m
s = s[:m.start()] + """
  lumina_sim: ['lumina_sim'],         // Round 26: CC Particle World's textured squares (shaders/)
  fx_text: ['fx_text'],               // Round 29: Numbers' and Timecode's text over the layer (ftx_text)
  lumina_util: ['lumina_util'] };     // Round 29: CC Overbrights, HDR Highlight Compression, HDR Compander, Cineon Converter (shaders/)
""" + s[m.end():]
rep("lumina_sim: 'shaders/lumina_sim.wgsl' };", "lumina_sim: 'shaders/lumina_sim.wgsl', lumina_util: 'shaders/lumina_util.wgsl' };")

# Grow Bounds: the box the filling effects are cut to grows by the Pixels before them
rep("  let cur = src, clip = false;\n", "  let cur = src, clip = false, grow = 0;\n  E.grow = 0;   // Grow Bounds' pixels so far (layer pixels)\n")
rep("    if (typeof D.clip === 'function' ? D.clip(q) : D.clip) clip = true;",
    "    if (typeof D.clip === 'function' ? D.clip(q) : D.clip) { clip = true; grow = Math.max(grow, E.grow); }")
rep("  // generators (noise) fill the layer's own box, not the whole frame\n  if (clip) { c.globalCompositeOperation = 'destination-in'; c.setTransform(m); c.fillStyle = '#fff'; c.fillRect(-bw / 2, -bh / 2, bw, bh); }",
    "  // generators (noise) fill the layer's own box, not the whole frame (grown by any Grow Bounds before them)\n  if (clip) { c.globalCompositeOperation = 'destination-in'; c.setTransform(m); c.fillStyle = '#fff'; c.fillRect(-bw / 2 - grow, -bh / 2 - grow, bw + 2 * grow, bh + 2 * grow); }")

# .cube files: utility.rs's parse_cube (1D and 3D tables, DOMAIN_MIN / MAX, LUT_xD_INPUT_RANGE). The 3D table also
# stays as before for Lumetri and the Color panel (N, data: values through the domain, clamped)
a = s.index("function parseCube(text, name) {"); b = s.index("function gradeGL(", a)
s = s[:a] + """function parseCube(text, name) {
  let n1 = 0, N = 0, lo = [0, 0, 0], hi = [1, 1, 1]; const vals = [], bad = () => new Error('This file is not a complete .cube LUT.');
  for (const raw of text.split(/\\r?\\n/)) {
    const line = raw.trim(); if (!line || line[0] === '#') continue;
    const parts = line.split(/\\s+/), k = parts[0];
    if (k === 'TITLE') continue;
    if (k === 'LUT_1D_SIZE') n1 = +parts[1];
    else if (k === 'LUT_3D_SIZE') N = +parts[1];
    else if (k === 'DOMAIN_MIN') lo = parts.slice(1, 4).map(Number);
    else if (k === 'DOMAIN_MAX') hi = parts.slice(1, 4).map(Number);
    else if (k === 'LUT_1D_INPUT_RANGE' || k === 'LUT_3D_INPUT_RANGE') { lo = [0, 0, 0].fill(+parts[1]); hi = [0, 0, 0].fill(+parts[2]); }
    else if (/^[a-z]/i.test(k)) continue;
    else { const v = parts.slice(0, 3).map(Number); if (parts.length < 3 || !v.every(Number.isFinite)) throw bad(); vals.push(...v); }
  }
  if (!Number.isInteger(n1) || !Number.isInteger(N) || n1 < 0 || N < 0 || (!n1 && !N) || n1 === 1 || N === 1 || N > 256 || vals.length !== (n1 + N * N * N) * 3) throw bad();
  if (![...lo, ...hi].every(Number.isFinite)) throw bad();
  const d1 = Float32Array.from(vals.slice(0, n1 * 3)), rawT = N ? Float32Array.from(vals.slice(n1 * 3)) : null;
  let data = null;
  if (N) { data = new Float32Array(rawT.length); for (let i = 0; i < data.length; i++) { const c = i % 3; data[i] = clamp((rawT[i] - lo[c]) / (hi[c] - lo[c]), 0, 1); } }
  return { name, N, data, n1, d1, dmin: lo, dmax: hi, raw: rawT };
}
""" + s[b:]
rep("const lutOpts = () => [['', 'None'], ...Object.entries(LUTS).map(([id, l]) => [id, esc(l.name)])];",
    "// the LUT menus: those with a 3D table (Lumetri), or every LUT (Apply Color LUT)\nconst lutOpts = (all = false) => [['', 'None'], ...Object.entries(LUTS).filter(([, l]) => all || l.N > 1).map(([id, l]) => [id, esc(l.name)])];")
rep("const lut = id => { const l = id && LUTS[id]; return l ? tab([l.N, ...l.data]) : -1; };",
    "const lut = id => { const l = id && LUTS[id]; return l?.N > 1 ? tab([l.N, ...l.data]) : -1; };")
rep("  const lut = L.lut && LUTS[L.lut];\n", "  const lut = L.lut && LUTS[L.lut]?.N > 1 ? LUTS[L.lut] : null;\n")
rep("  const opts = [['', 'None'], ...Object.entries(LUTS).map(([id, l]) => [id, (id.startsWith('u:') ? '⬆ ' : '') + l.name]), ['__load', 'Load .cube file…']];",
    "  const opts = [['', 'None'], ...Object.entries(LUTS).filter(([, l]) => l.N > 1).map(([id, l]) => [id, (id.startsWith('u:') ? '⬆ ' : '') + l.name]), ['__load', 'Load .cube file…']];")
# saved with the project: the 1D table, the domain and the 3D values as written when they differ from `data`
rep("""  for (const L of S.layers) for (const id of [L.lut, ...(L.fx || []).flatMap(f => [f.inLut, f.lookLut])])
    if (typeof id === 'string' && id.startsWith('u:') && LUTS[id]) { const l = LUTS[id]; luts[id] = { name: l.name, N: l.N, data: Array.from(l.data, v => +v.toFixed(4)) }; }""",
"""  for (const L of S.layers) for (const id of [L.lut, ...(L.fx || []).flatMap(f => [f.inLut, f.lookLut, f.id === 'applylut' ? f.lut : null])])
    if (typeof id === 'string' && id.startsWith('u:') && LUTS[id]) {
      const l = LUTS[id], o = luts[id] = { name: l.name, N: l.N, data: l.data ? Array.from(l.data, v => +v.toFixed(4)) : null };
      if (l.n1) Object.assign(o, { n1: l.n1, d1: Array.from(l.d1, v => +v.toFixed(5)) });
      if (l.dmin && (l.dmin.some(v => v !== 0) || l.dmax.some(v => v !== 1))) Object.assign(o, { dmin: l.dmin, dmax: l.dmax });
      if (l.raw && l.raw.some((v, i) => Math.abs(v - l.data[i]) > 1e-6)) o.raw = Array.from(l.raw, v => +v.toFixed(5));
    }""")
rep("  for (const [id, l] of Object.entries(d.luts || {})) LUTS[id] = { name: l.name, N: l.N, data: Float32Array.from(l.data) };",
    """  for (const [id, l] of Object.entries(d.luts || {})) {
    const data = l.data ? Float32Array.from(l.data) : null;
    LUTS[id] = { name: l.name, N: l.N || 0, data, n1: l.n1 || 0, d1: Float32Array.from(l.d1 || []), dmin: l.dmin || [0, 0, 0], dmax: l.dmax || [1, 1, 1], raw: l.raw ? Float32Array.from(l.raw) : data };
  }""")
# a LUT loaded for an effect (Apply Color LUT's menu), or for the Color panel (which needs a 3D table)
rep("""    const id = 'u:' + uid++; LUTS[id] = lut;
    const L = byId(lutTarget); if (L) { L.lut = id; commit(); }
    inspector();""",
"""    const id = 'u:' + uid++; LUTS[id] = lut;
    if (lutTarget && typeof lutTarget === 'object') {
      const L = byId(lutTarget.L), fx = L?.fx?.find(x => x.uid === lutTarget.fx); if (fx) { fx[lutTarget.k] = id; commit(); }
    } else if (lut.N > 1) { const L = byId(lutTarget); if (L) { L.lut = id; commit(); } }
    else toast(`${f.name} has only a 1D table. It works in the Apply Color LUT effect.`);
    inspector();""")
rep("""    const f = L.fx?.[+el.dataset.fxi], k = el.dataset.fxk;
    if (f) { f[k] =""", """    const f = L.fx?.[+el.dataset.fxi], k = el.dataset.fxk;
    if (f && el.value === '__load') { el.value = f[k] || ''; lutTarget = { L: L.id, fx: f.uid, k }; $('#lutfile').click(); return; }
    if (f) { f[k] =""")
# builtin looks: no 1D table, the 0..1 domain
rep("for (const [id, [name, fn]] of Object.entries(BUILTIN_LUTS)) LUTS['b:' + id] = { name, N: 17, data: makeLut(fn) };",
    "for (const [id, [name, fn]] of Object.entries(BUILTIN_LUTS)) LUTS['b:' + id] = { name, N: 17, data: makeLut(fn), n1: 0 };")

H = "// ---- Round 28 helpers (Simulation: pieces and surfaces)"
rep(H, rd('helpers.js') + H)
F = "  // ---- Round 28: Simulation, pieces and surfaces (EffectCraft's sim2/"
rep(F, rd('effects.js') + F)
if crlf: s = s.replace('\n', '\r\n')
io.open(p, 'wb').write(s.encode('utf-8')); print('ok')
