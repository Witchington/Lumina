import io
p = r'D:\Lumina\.claude\fx\selftest.js'
raw = io.open(p, 'rb').read(); crlf = b'\r\n' in raw
s = raw.decode('utf-8').replace('\r\n', '\n')
def rep(a, b):
    global s
    assert s.count(a) == 1, (a[:80], s.count(a)); s = s.replace(a, b)
# Round 27's menu check: its own seven (Round 28 adds more Simulation effects)
rep("""      step('sim27Menu', { count: menuS?.children.length, works: menuS?.children.length === 10 });""",
    """      step('sim27Menu', { count: menuS?.children.length, works: ids.every(id => menuS?.querySelector(`option[value=${id}]`)) });""")
A = "      step('round27speed', r27speed);\n    }\n"
rep(A, A + """
    // ---- Round 28: Simulation, pieces and surfaces (CC Ball Action, CC Pixel Polly, CC Scatterize, Card Dance, Shatter,
    // Caustics, Wave World, Foam)
    {
      const kerr = async (fam, e) => { const pp = FXG.pipes[fam + ':' + e]; if (pp?.pipe) return null; const m = FXG.mods[fam]; return { err: pp?.err, log: m ? ((await Promise.race([m.getCompilationInfo(), new Promise(r => setTimeout(() => r({ messages: [{ lineNum: 0, linePos: 0, message: "no compiler report" }] }), 5000))])).messages).slice(0, 8).map(x => `${x.lineNum}:${x.linePos} ${x.message}`) : null }; };
      const ids = ['ccballaction', 'ccpixelpolly', 'ccscatterize', 'carddance', 'shatter', 'caustics', 'waveworld', 'foam'], K28 = {};
      for (const id of ids) { await only(id); for (const [fam, e] of FX[id].kernels) { const r = await kerr(fam, e); if (r) K28[fam + ':' + e] = r; } }
      step('sim28Kernels', { ...K28, works: !Object.keys(K28).length });
      const V = {}, want = {}, chk = (k, got, ok) => { V[k] = String(got); want[k] = ok; };
      const count = (fr, test) => { let n = 0, sx = 0, sy = 0; for (let i = 0; i < fr.length; i += 4) if (test(fr[i], fr[i + 1], fr[i + 2])) { n++; const k = i / 4; sx += k % 1920; sy += Math.floor(k / 1920); } return { n, cx: n ? sx / n : 0, cy: n ? sy / n : 0 }; };
      const errs = []; const run = async (name, fn) => { try { await fn(); } catch (e) { errs.push(name + ': ' + (e?.stack || e).toString().slice(0, 300)); } };
      while (L.fx?.length) delFX(L, 0); draw(1); const base1 = frame();
      // CC Ball Action: the layer as a grid of balls in its own colours; no balls at size 0
      await run('ball', async () => {
        f = await only('ccballaction'); draw(1); const ba = diff(base1, frame()), bw = count(frame(), (r, g, b) => r > 200 && g > 200 && b > 200);
        set(f, 'scatter', 200); draw(1); const bs = diff(base1, frame()); set(f, 'ballSize', 0); draw(1); const b0 = count(frame(), (r, g, b) => r + g + b > 30);
        chk('ballAction', [ba.changed, bw.n, bs.changed, b0.n], ba.changed > 100000 && bw.n > 500 && bs.changed > ba.changed * .5 && b0.n === 0);
      });
      // CC Pixel Polly: the layer as it is before Start Time; after it the pieces fly and fall
      await run('polly', async () => {
        f = await only('ccpixelpolly'); set(f, 'startTime', 5); draw(1); const p0 = diff(base1, frame());
        set(f, 'startTime', 0); draw(.5); const pa = frame(); draw(1); const pb = frame(), pw = count(pb, (r, g, b) => r > 200 && g > 200 && b > 200);
        f.object = 1; draw(1); const pt = diff(pb, frame());
        chk('pixelPolly', [p0.changed, diff(base1, pb).changed, diff(pa, pb).changed, pw.n, pt.changed], p0.changed === 0 && diff(base1, pb).changed > 50000 && diff(pa, pb).changed > 50000 && pw.n > 1000 && pt.changed > 1000);
      });
      // CC Scatterize: nothing set leaves the layer; Scatter moves its pixels about
      await run('scatterize', async () => {
        f = await only('ccscatterize'); draw(1); const s0 = diff(base1, frame()); set(f, 'scatter', 30); draw(1); const s1 = diff(base1, frame());
        set(f, 'scatter', 0); set(f, 'rightTwist', 80); draw(1); const s2 = diff(base1, frame());
        chk('scatterize', [s0.changed, s1.changed, s2.changed], s0.changed === 0 && s1.changed > 20000 && s2.changed > 20000);
      });
      // Card Dance: cards at rest, lit straight on, are the layer; turned by a Z rotation offset they are not
      await run('cardDance', async () => {
        f = await only('carddance'); draw(1); const c0 = diff(base1, frame()); set(f, 'zRotOff', 30); draw(1); const c1 = diff(base1, frame());
        set(f, 'zRotOff', 0); f.zPosSrc = 1; set(f, 'zPosMul', -5); draw(1); const c2 = diff(base1, frame());
        chk('cardDance', [c0.changed, c0.max, c1.changed, c2.changed], c0.changed < 3000 && c1.changed > 100000 && c2.changed > 20000);
      });
      // Shatter: the wireframe front view draws outlines; Rendered at time 0 is the layer, and later the middle breaks out
      await run('shatter', async () => {
        f = await only('shatter'); draw(1); const sw = count(frame(), (r, g, b) => b > 150 && g > 120 && r > 100 && r < b);
        f.view = 0; draw(0); const r0 = diff(base1, frame()); draw(1); const r1 = diff(base1, frame());
        f.pattern = 2; draw(1); const r2 = diff(base1, frame()); f.pattern = 1; draw(1); const r3 = diff(base1, frame());
        chk('shatter', [sw.n, r0.changed, r1.changed, r2.changed, r3.changed], sw.n > 2000 && r0.changed < 5000 && r1.changed > 50000 && r2.changed > 50000 && r3.changed > 50000);
      });
      // Caustics: flat water under the surface colour changes the layer; a water surface layer bends it further
      await run('caustics', async () => {
        f = await only('caustics'); draw(1); const k0 = frame(), kd = diff(base1, k0);
        const W2 = await load(card); W2.start = 0; W2.dur = 6; W2.visible = false; S.layers = [L, ...S.layers.filter(x => x !== L && x !== W2), W2];
        f.water = W2.id; set(f, 'waveHeight', 1); set(f, 'waterDepth', .5); draw(1); const k1 = diff(k0, frame());
        set(f, 'causticsStrength', 1); draw(1); const k2 = diff(k0, frame());
        f.water = 0; S.layers = S.layers.filter(x => x !== W2); delete RT[W2.id];
        chk('caustics', [kd.changed, k1.changed, k2.changed], kd.changed > 100000 && k1.changed > 2000 && k2.changed > k1.changed);
      });
      // Wave World: green wires over black that move; the Height Map is grey
      await run('waveWorld', async () => {
        f = await only('waveworld'); draw(1); const w1 = frame(), wg = count(w1, (r, g, b) => g > 150 && r < 150 && b < 150); draw(2); const wm = diff(w1, frame());
        f.view = 1; draw(1); const hp = px(960, 540), hp2 = px(200, 900);
        chk('waveWorld', [wg.n, wm.changed, hp.join(), hp2.join()], wg.n > 2000 && wm.changed > 1000 && hp[0] === hp[1] && hp[1] === hp[2] && hp2[0] === hp2[1] && Math.abs(hp2[0] - 128) < 30);
      });
      // Foam: no bubbles at time 0; bubbles around the producer later; scrubbing gives the same frame
      await run('foam', async () => {
        f = await only('foam'); draw(0); const f0 = count(frame(), (r, g, b) => b > 60); draw(3); const fa = frame(), f3 = count(fa, (r, g, b) => b > 60);
        FOAM_CACHE.length = 0; draw(3); const fb = frame(); f.view = 2; draw(3); const fr = count(frame(), (r, g, b) => r > 60);
        chk('foam', [f0.n, f3.n, Math.round(f3.cx), Math.round(f3.cy), diff(fa, fb).changed, fr.n], f0.n === 0 && f3.n > 500 && Math.abs(f3.cx - 960) < 300 && diff(fa, fb).changed === 0 && fr.n > 500);
      });
      while (L.fx?.length) delFX(L, 0); for (const k of Object.keys(L.keys)) if (k.startsWith('fx')) delete L.keys[k]; draw();
      const bad = Object.keys(want).filter(k => !want[k]);
      step('sim28Details', { ...V, errs, bad, works: !bad.length && !errs.length && Object.keys(want).length === 8 });
      const menuS = [...document.querySelectorAll('#fx-add optgroup')].find(g => g.label === 'Simulation');
      step('sim28Menu', { count: menuS?.children.length, works: menuS?.children.length === 18 && ids.every(id => menuS.querySelector(`option[value=${id}]`)) });
      // speed at 3 s into the layer, each frame after the first
      const r28speed = {};
      for (const id of ids) {
        f = await only(id); if (id === 'shatter') f.view = 0; WAVE_CACHE.length = 0; FOAM_CACHE.length = 0; draw(3); ctx.getImageData(0, 0, 1, 1);
        const t0 = performance.now(); for (let i = 1; i <= 5; i++) draw(3 + i / 30); ctx.getImageData(0, 0, 1, 1); r28speed[id] = +((performance.now() - t0) / 5).toFixed(1);
      }
      while (L.fx?.length) delFX(L, 0); draw();
      step('round28speed', r28speed);
    }
""")
if crlf: s = s.replace('\n', '\r\n')
io.open(p, 'wb').write(s.encode('utf-8')); print('ok')
