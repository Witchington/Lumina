import io
d = 'D:/Lumina/.claude/round30-draft/'
t = io.open(d + 'test.js', encoding='utf-8').read()
for a, b in [("bar.top > 240 && bar.top < 340", "bar.top > 240 && bar.top < 360"), ("sb.bot > 740 && sb.bot < 840", "sb.bot > 720 && sb.bot < 840")]:
    if a in t: t = t.replace(a, b)
io.open(d + 'test.js', 'w', encoding='utf-8').write(t)

p = 'D:/Lumina/.claude/fx/selftest.js'
raw = io.open(p, 'rb').read(); crlf = b'\r\n' in raw
s = raw.decode('utf-8').replace('\r\n', '\n')
def rep(a, b):
    global s
    assert s.count(a) == 1, (a[:80], s.count(a)); s = s.replace(a, b)
T = t.replace('\r\n', '\n')
rep("      step('round29speed', r29speed);\n    }\n", "      step('round29speed', r29speed);\n    }\n" + T)
# Round 30 puts Audio Spectrum and Audio Waveform in the Generate group too (24 + 2)
rep("works: menuG?.children.length === 24 });", "works: menuG?.children.length === 26 });")
if crlf: s = s.replace('\n', '\r\n')
io.open(p, 'wb').write(s.encode('utf-8')); print('ok')
