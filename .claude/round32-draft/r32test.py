import io
d = 'D:/Lumina/.claude/round32-draft/'
t = io.open(d + 'test.js', encoding='utf-8').read().replace('\r\n', '\n')
p = 'D:/Lumina/.claude/fx/selftest.js'
raw = io.open(p, 'rb').read(); crlf = b'\r\n' in raw
s = raw.decode('utf-8').replace('\r\n', '\n')
def rep(a, b):
    global s
    assert s.count(a) == 1, (a[:80], s.count(a)); s = s.replace(a, b)
anchor = "      S.layers = S.layers.filter(x => x.id !== Vd.id); delete RT[Vd.id]; L.visible = true; S.sel = L.id; render();\n    }\n"
rep(anchor, anchor + t)
# Round 32 puts the 3D Camera Tracker and Camera Track Pin in the Perspective group (9 + 2)
rep("step('perspectiveMenu', { count: menuP?.children.length, works: menuP?.children.length === 9 });", "step('perspectiveMenu', { count: menuP?.children.length, works: menuP?.children.length === 11 });")
if crlf: s = s.replace('\n', '\r\n')
io.open(p, 'wb').write(s.encode('utf-8')); print('ok')
