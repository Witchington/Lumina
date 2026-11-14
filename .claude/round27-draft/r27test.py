import io
p = r'D:\Lumina\.claude\fx\selftest.js'
raw = io.open(p, 'rb').read(); crlf = b'\r\n' in raw
s = raw.decode('utf-8').replace('\r\n', '\n')
A = "      step('round26speed', r26speed);\n    }\n"
B = A + """
    // ---- Round 27: Simulation, weather and more. Closed-form weather (every frame on its own), CC Hair, and Particle
    // Playground (stepped from layer time 0, as Round 26's engine)
    {
      const kerr = async (fam, e) => { const pp = FXG.pipes[fam + ':' + e]; if (pp?.pipe) return null; const m = FXG.mods[fam]; return { err: pp?.err, log: m ? ((await Promise.race([m.getCompilationInfo(), new Promise(r => setTimeout(() => r({ messages: [{ lineNum: 0, linePos: 0, message: "no compiler report" }] }), 5000))])).messages).slice(0, 8).map(x => `${x.lineNum}:${x.linePos} ${x.message}`) : null }; };
      const ids = ['ccrainfall', 'ccsnowfall', 'ccbubbles', 'ccdrizzle', 'ccstarburst', 'cchair', 'particleplayground'], K27 = {};
      for (const id of ids) { await only(id); for (const [fam, e] of FX[id].kernels) { const r = await kerr(fam, e); if (r) K27[fam + ':' + e] = r; } }
      step('sim27Kernels', { ...K27, works: !Object.keys(K27).length });
      const V = {}, want = {}, chk = (k, got, ok) => { V[k] = String(got); want[k] = ok; };
      const count = (fr, test) => { let n = 0, sx = 0, sy = 0; for (let i = 0; i < fr.length; i += 4) if (test(fr[i], fr[i + 1], fr[i + 2])) { n++; const k = i / 4; sx += k % 1920; sy += Math.floor(k / 1920); } return { n, cx: n ? sx / n : 0, cy: n ? sy / n : 0 }; };
      while (L.fx?.length) delFX(L, 0); draw(1); const base1 = frame();
      // CC Rainfall: streaks over the layer that move from frame to frame; the same moment drawn twice is the same frame
      f = await only('ccrainfall'); set(f, 'opacity', 80); draw(1); const r1 = frame(); draw(1.1); const r2 = frame(); draw(1); const r3 = frame();
      chk('rain', [diff(base1, r1).changed, diff(r1, r2).changed, diff(r1, r3).changed], diff(base1, r1).changed > 2000 && diff(r1, r2).changed > 2000 && diff(r1, r3).changed === 0);
      // Soft Solid without the original: grey streaks alone (the layer's white patch goes)
      f.appearance = 1; f.composite = false; draw(1); const r4 = frame(), rs = count(r4, (r, g, b) => r > 30 && Math.abs(r - g) < 12 && Math.abs(g - b) < 12);
      chk('rainAlone', [rs.n, px(480, 270).join()], rs.n > 2000 && rs.n < 1920 * 1080 * .5);
      // CC Snowfall: white flakes; alone, the layer is gone; scene depth makes far flakes smaller (fewer lit pixels)
      f = await only('ccsnowfall'); f.composite = false; draw(1); const sn = count(frame(), (r, g, b) => r > 120 && g > 120 && b > 120);
      set(f, 'sceneDepth', 20000); draw(1); const sn2 = count(frame(), (r, g, b) => r > 120 && g > 120 && b > 120);
      chk('snow', [sn.n, sn2.n], sn.n > 5000 && sn2.n < sn.n * .8);
      set(f, 'sceneDepth', 5000); f.composite = true; draw(1); const sn3 = frame(); draw(2); chk('snowMoves', diff(sn3, frame()).changed, diff(sn3, frame()).changed > 2000);
      // CC Bubbles: the layer becomes bubbles (black between them); they rise over time
      f = await only('ccbubbles'); set(f, 'amount', 300); draw(1); const bu = count(frame(), (r, g, b) => r + g + b > 30); 
      chk('bubbles', bu.n, bu.n > 3000 && bu.n < 1920 * 1080 * .7);
      draw(1); const bA = frame(); draw(1.5); chk('bubblesMove', diff(bA, frame()).changed, diff(bA, frame()).changed > 1000);
      // CC Drizzle: rings ripple the layer; no drips leaves it as it was
      f = await only('ccdrizzle'); draw(1); const dz = diff(base1, frame()); set(f, 'rate', 0); draw(1); const dz0 = diff(base1, frame());
      chk('drizzle', [dz.changed, dz0.changed], dz.changed > 2000 && dz.changed < 1920 * 1080 * .9 && dz0.changed === 0);
      // CC Star Burst: the layer flies apart in dots; blending fully with the original gives the layer back
      f = await only('ccstarburst'); set(f, 'spacing', 6); draw(1); const sb = diff(base1, frame()); draw(1.2); const sbm = diff(base1, frame());
      set(f, 'blend', 100); draw(1); const sb100 = diff(base1, frame());
      chk('starBurst', [sb.changed, sbm.changed, sb100.changed], sb.changed > 50000 && sb100.changed < 50);
      // CC Hair: strands over the layer, coloured from their roots with full inheritance (white hair on the white patch)
      f = await only('cchair'); set(f, 'inheritance', 100); set(f, 'density', 30); draw(1); const hr = diff(base1, frame());
      set(f, 'length', 0); draw(1); const hr0 = diff(base1, frame());
      chk('hair', [hr.changed, hr0.changed], hr.changed > 5000 && hr0.changed === 0);
      // Particle Playground: the cannon fires red dots up from near the bottom; gravity brings them back; the layer goes
      f = await only('particleplayground'); draw(1); const pg1 = count(frame(), (r, g, b) => r > 120 && g < 60 && b < 60);
      chk('pgCannon', [pg1.n, Math.round(pg1.cx), Math.round(pg1.cy), px(480, 270).join()], pg1.n > 100 && Math.abs(pg1.cx - 960) < 150 && pg1.cy < 972 && px(480, 270).every(v => v < 40));
      draw(.3); draw(1); const pgA = frame(); PG_CACHE.length = 0; draw(1); const pgB = frame();
      chk('pgScrub', diff(pgA, pgB).changed, diff(pgA, pgB).changed === 0);
      set(f, 'gravForce', 1000); draw(1); const pg2 = count(frame(), (r, g, b) => r > 120 && g < 60 && b < 60); chk('pgGravity', Math.round(pg2.cy), pg2.cy > pg1.cy + 40);
      // the grid: 5 × 5 white dots at time 0 round the middle; Grid Text draws characters with the stroke font
      set(f, 'gravForce', 108); set(f, 'cannonRate', 0); set(f, 'across', 5); set(f, 'down', 5); draw(0); const gd = count(frame(), (r, g, b) => r > 150 && g > 150 && b > 150);
      chk('pgGrid', [gd.n, Math.round(gd.cx), Math.round(gd.cy)], gd.n >= 25 && Math.abs(gd.cx - 960) < 10 && Math.abs(gd.cy - 540) < 10);
      set(f, 'across', 1); set(f, 'down', 1); set(f, 'gridRadius', 300); f.gridText = 'A'; draw(0); const tx = count(frame(), (r, g, b) => r > 150 && g > 150 && b > 150);
      chk('pgText', [tx.n, fxGlyph('a').length], tx.n > 2000 && fxGlyph('a').length === 2);
      // Layer Map: the cannon's particles drawn as copies of a hidden green card
      f.gridText = ''; set(f, 'across', 0); set(f, 'down', 0); set(f, 'cannonRate', 60);
      const green = await makeCard(Array(6).fill('20,200,40'), 'green.png', false); green.__path = await lumina.saveExport(await green.arrayBuffer(), 'green.png', dir + 'green.png');
      const G = await load(green); G.start = 0; G.dur = 6; G.visible = false; S.layers = [L, ...S.layers.filter(x => x !== L && x !== G), G];
      f.mapLayer = G.id; draw(1); const lm = frame(), lg = count(lm, (r, g, b) => g > 120 && r < 80), lr = count(lm, (r, g, b) => r > 120 && g < 60 && b < 60);
      chk('pgLayerMap', [lg.n, lr.n], lg.n > 300 && lr.n < 20);
      f.mapLayer = 0; S.layers = S.layers.filter(x => x !== G); delete RT[G.id];
      while (L.fx?.length) delFX(L, 0); for (const k of Object.keys(L.keys)) if (k.startsWith('fx')) delete L.keys[k]; draw();
      const bad = Object.keys(want).filter(k => !want[k]);
      step('sim27Details', { ...V, bad, works: !bad.length });
      const menuS = [...document.querySelectorAll('#fx-add optgroup')].find(g => g.label === 'Simulation');
      step('sim27Menu', { count: menuS?.children.length, works: menuS?.children.length === 10 });
      // speed at 3 s into the layer, each frame after the first
      const r27speed = {};
      for (const id of ids) {
        f = await only(id); PG_CACHE.length = 0; draw(3); ctx.getImageData(0, 0, 1, 1);
        const t0 = performance.now(); for (let i = 1; i <= 5; i++) draw(3 + i / 30); ctx.getImageData(0, 0, 1, 1); r27speed[id] = +((performance.now() - t0) / 5).toFixed(1);
      }
      while (L.fx?.length) delFX(L, 0); draw();
      step('round27speed', r27speed);
    }
"""
assert s.count(A) == 1; s = s.replace(A, B)
if crlf: s = s.replace('\n', '\r\n')
io.open(p, 'wb').write(s.encode('utf-8')); print('ok')
