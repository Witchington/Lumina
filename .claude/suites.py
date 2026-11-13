import json, os, subprocess, sys, time
EXE = sys.argv[1] if len(sys.argv) > 1 else r'D:\Lumina\dist\win-unpacked\Lumina.exe'
names = sys.argv[2].split(',') if len(sys.argv) > 2 else ['.claude','trans','vfont','svg','3d','fx','beat','image','timeline','speed','photo','mcp']
for n in names:
    d = r'D:\Lumina\.claude' if n == '.claude' else os.path.join(r'D:\Lumina\.claude', n)
    out = os.path.join(d, 'selftest.json')
    before = os.path.getmtime(out) if os.path.exists(out) else 0
    t = time.time()
    env = dict(os.environ, LUMINA_TESTDIR=d)
    subprocess.run([EXE, '--selftest'], env=env, timeout=1500)
    fresh = os.path.exists(out) and os.path.getmtime(out) > before
    bad = []
    if fresh:
        def walk(o, p=''):
            if isinstance(o, dict):
                for k, v in o.items(): walk(v, p + k + '.')
            elif o is False: bad.append(p[:-1])
        walk(json.load(open(out, encoding='utf8')))
    print(f'{n} ({int(time.time()-t)}s) fresh={fresh} false={bad}', flush=True)
