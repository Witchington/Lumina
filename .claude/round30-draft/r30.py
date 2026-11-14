import io
D = r'D:\Lumina\.claude\round30-draft\\'
p = r'D:\Lumina\Lumina.html'
raw = io.open(p, 'rb').read(); crlf = b'\r\n' in raw
s = raw.decode('utf-8').replace('\r\n', '\n')
def rep(a, b):
    global s
    assert s.count(a) == 1, (a[:80], s.count(a)); s = s.replace(a, b)
def rd(n): return io.open(D + n, encoding='utf-8').read().replace('\r\n', '\n')

# export: the sound the audio effects follow is decoded before the first frame is recorded
rep("  await fxWarmAll();   // every effect's GPU kernels built before the first frame is recorded\n",
    "  await fxWarmAll();   // every effect's GPU kernels built before the first frame is recorded\n  await auWarmAll();   // and the sound Audio Spectrum / Audio Waveform follow, decoded\n")
H = "// ---- Round 29 helpers (Utility & Text)"
rep(H, rd('helpers.js') + H)
F = "  // ---- Round 29: Utility & Text (EffectCraft's"
rep(F, rd('effects.js') + F)
if crlf: s = s.replace('\n', '\r\n')
io.open(p, 'wb').write(s.encode('utf-8')); print('ok')
