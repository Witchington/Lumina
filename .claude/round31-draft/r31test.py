import io
d = 'D:/Lumina/.claude/round31-draft/'
t = io.open(d + 'test.js', encoding='utf-8').read().replace('\r\n', '\n')
p = 'D:/Lumina/.claude/fx/selftest.js'
raw = io.open(p, 'rb').read(); crlf = b'\r\n' in raw
s = raw.decode('utf-8').replace('\r\n', '\n')
def rep(a, b):
    global s
    assert s.count(a) == 1, (a[:80], s.count(a)); s = s.replace(a, b)
rep("      step('round30speed', r30speed);\n    }\n", "      step('round30speed', r30speed);\n    }\n" + t)
# Round 31 puts Roto Brush & Refine Edge in the Matte group (4 + 1)
rep("works: menuKeying?.children.length === 15 && menuMatte?.children.length === 4 });", "works: menuKeying?.children.length === 15 && menuMatte?.children.length === 5 });")
if crlf: s = s.replace('\n', '\r\n')
io.open(p, 'wb').write(s.encode('utf-8')); print('ok')
