import io
p = r'D:\Lumina\Lumina.html'
raw = io.open(p, 'rb').read(); crlf = b'\r\n' in raw
s = raw.decode('utf-8').replace('\r\n', '\n')
def rep(a, b):
    global s
    assert s.count(a) == 1, (a[:80], s.count(a)); s = s.replace(a, b)
# in the sprite loops: the layer's matrix read into plain numbers once (a DOMMatrix field is a slow read), fract by floor
rep("const fxWrap = (v, lo, span) => span <= 0 ? v : lo + fxRem(v - lo, span);  // weather::wrap",
    "const fxWrap = (v, lo, span) => { if (span <= 0) return v; const u = v - lo; return lo + u - span * Math.floor(u / span); };  // weather::wrap")
rep("  if (b > o + 11) R.fill(0, o + 11, b);\n", "  for (let k = o + 11; k < b; k++) R[k] = 0;\n")
rep("const fxLpOf = E => { const m = E.m, hx = E.bw / 2, hy = E.bh / 2; return (x, y) => [m.a * (x - hx) + m.c * (y - hy) + m.e, m.b * (x - hx) + m.d * (y - hy) + m.f]; };",
    "const fxLpOf = E => { const { a, b, c, d, e, f } = E.m, hx = E.bw / 2, hy = E.bh / 2; return (x, y) => [a * (x - hx) + c * (y - hy) + e, b * (x - hx) + d * (y - hy) + f]; };")
rep("  const lw = E.bw, lh = E.bh, s = E.sc, t = E.t, ox = off[0] - lw * .5, oy = off[1] - lh * .5, m = E.m, lp = fxLpOf(E), sz = Math.max(size, .2), stride = 18,",
    "  const lw = E.bw, lh = E.bh, s = E.sc, t = E.t, ox = off[0] - lw * .5, oy = off[1] - lh * .5, m = { a: E.m.a, b: E.m.b, c: E.m.c, d: E.m.d }, lp = fxLpOf(E), sz = Math.max(size, .2), stride = 18,")
rep("  const seed = Math.imul(fxSeed(E), 0x3c6e) >>> 0, lw = E.bw, lh = E.bh, s = E.sc, t = E.t, m = E.m, hx = lw / 2, hy = lh / 2;",
    "  const seed = Math.imul(fxSeed(E), 0x3c6e) >>> 0, lw = E.bw, lh = E.bh, s = E.sc, t = E.t, { a: ma, b: mb, c: mc, d: md, e: me, f: mf } = E.m, hx = lw / 2, hy = lh / 2;")
rep("""    const j = k < n - lo ? lo + k : k - (n - lo), o = j * 5, z = fxRem(G[o] + c, 1), persp = 1 / (1 - .9 * z), gx = G[o + 1], gy = G[o + 2];""",
    """    const j = k < n - lo ? lo + k : k - (n - lo), o = j * 5, zc = G[o] + c, z = zc - Math.floor(zc), persp = 1 / (1 - .9 * z), gx = G[o + 1], gy = G[o + 2];""")
rep("""    fxPutSprite(R, k, stride, 1, m.a * ux + m.c * uy + m.e, m.b * ux + m.d * uy + m.f, spacing * .5 * size * persp * s, 0, 0, 0, Math.min(z * 8, 1) * Math.min((1 - z) * 6, 1));
    // the layer's colour at the grid point (none where it is clear)
    const r = k * stride; R[r + 11] = 2; R[r + 12] = m.a * ax + m.c * ay + m.e; R[r + 13] = m.b * ax + m.d * ay + m.f;""",
    """    fxPutSprite(R, k, stride, 1, ma * ux + mc * uy + me, mb * ux + md * uy + mf, spacing * .5 * size * persp * s, 0, 0, 0, Math.min(z * 8, 1) * Math.min((1 - z) * 6, 1));
    // the layer's colour at the grid point (none where it is clear)
    const r = k * stride; R[r + 11] = 2; R[r + 12] = ma * ax + mc * ay + me; R[r + 13] = mb * ax + md * ay + mf;""")
if crlf: s = s.replace('\n', '\r\n')
io.open(p, 'wb').write(s.encode('utf-8')); print('ok')
