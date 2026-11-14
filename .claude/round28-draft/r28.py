import io
D = r'D:\Lumina\.claude\round28-draft\\'
p = r'D:\Lumina\Lumina.html'
raw = io.open(p, 'rb').read(); crlf = b'\r\n' in raw
s = raw.decode('utf-8').replace('\r\n', '\n')
def rep(a, b):
    global s
    assert s.count(a) == 1, (a[:80], s.count(a)); s = s.replace(a, b)
def rd(n): return io.open(D + n, encoding='utf-8').read().replace('\r\n', '\n')

# fxSpriteTable: other item kinds (fxp_raster's 4 = pieces), and pieces with a back texture (fxm_raster's pieces)
rep("""// of `stride` floats (fxPutSprite). Drawn by fxp_raster over a transparent frame in their order (tints sample img), in a
// new pass whenever one kernel's data would grow past 16M floats
function fxSpriteTable(E, img, R, n, stride, add) {""",
"""// of `stride` floats (fxPutSprite). Drawn by fxp_raster over a transparent frame in their order (tints sample img), in a
// new pass whenever one kernel's data would grow past 16M floats. `kind` is fxp_raster's item kind (0 sprites, 4 pieces);
// pieces with a `back` texture are drawn by fxm_raster (its first pass; later ones show the front on backs too)
function fxSpriteTable(E, img, R, n, stride, add, kind = 0, back = null) {""")
rep("""      const o = E.run('fx_particles', 'fxp_raster', fxP({ 0: [0, add ? 1 : 0, at, stride], 1: [tx, 0, 0, 0] }), img, base, null, E.data(d));""",
"""      const o = back && !a ? E.run('fx_particles', 'fxm_raster', fxP({ 0: [3, 0, at, stride], 1: [tx, 1, 0, 0] }), img, back, null, E.data(d))
        : E.run('fx_particles', 'fxp_raster', fxP({ 0: [kind, add ? 1 : 0, at, stride], 1: [tx, 0, 0, 0] }), img, base, null, E.data(d));""")
# sim::Post::OverBlack
rep("""  const P = post[0] === 'lerp' ? fxP({ 0: [1, 0, 0, 0] }, { 0: [post[1], 0, 0, 0] }) : fxP({ 0: [0, post[1], 0, 0] });""",
"""  const P = post[0] === 'lerp' ? fxP({ 0: [1, 0, 0, 0] }, { 0: [post[1], 0, 0, 0] }) : post[0] === 'black' ? fxP({ 0: [2, 0, 0, 0] }) : fxP({ 0: [0, post[1], 0, 0] });""")
rep("""// sim::Post: how the sprite layer meets the layer ('combine' with sim::combine's mode 0 Composite … 5 sprites only,
// 'lerp' toward the layer, 'replace'); fx_sim::sprites' fxm_post""",
"""// sim::Post: how the sprite layer meets the layer ('combine' with sim::combine's mode 0 Composite … 5 sprites only,
// 'lerp' toward the layer, 'black' over opaque black, 'replace'); fx_sim::sprites' fxm_post""")
# fxChunked: fxp_raster's item kind
rep("""function fxChunked(E, img, items, stride, fam, entry, u0, rec, f = {}, aux = null, base0 = null) {""",
    """function fxChunked(E, img, items, stride, fam, entry, u0, rec, f = {}, aux = null, base0 = null, kind = 0) {""")
rep("""      const P = fxP({ 0: [0, u0, D.at, stride], 1: [it.tx, 0, 0, 0] }, f);""",
    """      const P = fxP({ 0: [kind, u0, D.at, stride], 1: [it.tx, 0, 0, 0] }, f);""")
# sim2's Piece::new keeps the corners counter-clockwise (fxm_piece's inside test needs one winding)
rep("""  const inv = m3inv(hm); if (!inv) return null;
  const nrm = [-r[0][2], -r[1][2], -r[2][2]];
  return { inv, c0, poly, bb""",
"""  const inv = m3inv(hm); if (!inv) return null;
  const nrm = [-r[0][2], -r[1][2], -r[2][2]];
  let area = 0; for (let i = 0; i < poly.length; i++) { const a = poly[i], b = poly[(i + 1) % poly.length]; area += a[0] * b[1] - b[0] * a[1]; }
  if (area < 0) poly = poly.slice().reverse();
  return { inv, c0, poly, bb""")

# the helpers before Round 27's, the effects before Round 27's
H = "// ---- Round 27 helpers (Simulation: weather and more)"
rep(H, rd('helpers.js') + rd('surfaces.js') + H)
F = "  // ---- Round 27: Simulation, weather and more (EffectCraft's sim/weather.rs and sim3.rs"
rep(F, rd('effects.js') + F)
if crlf: s = s.replace('\n', '\r\n')
io.open(p, 'wb').write(s.encode('utf-8')); print('ok')
