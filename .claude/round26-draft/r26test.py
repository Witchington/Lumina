import io
p = r'D:\Lumina\.claude\fx\selftest.js'
raw = io.open(p, 'rb').read(); crlf = b'\r\n' in raw
s = raw.decode('utf-8').replace('\r\n', '\n')
A = "      step('round25speed', r25speed);\n    }\n"
B = A + """
    // ---- Round 26: Simulation, particles. The particles replace the layer; the stepped simulation is checked on the CPU
    // (counts, physics, scrubbing gives the same frame) and through the drawn frame
    {
      const kerr = async (fam, e) => { const pp = FXG.pipes[fam + ':' + e]; if (pp?.pipe) return null; const m = FXG.mods[fam]; return { err: pp?.err, log: m ? ((await Promise.race([m.getCompilationInfo(), new Promise(r => setTimeout(() => r({ messages: [{ lineNum: 0, linePos: 0, message: "no compiler report" }] }), 5000))])).messages).slice(0, 8).map(x => `${x.lineNum}:${x.linePos} ${x.message}`) : null }; };
      const ids = ['ccparticleworld', 'ccparticlesystems2', 'ccmrmercury'], K26 = {};
      for (const id of ids) { await only(id); for (const [fam, e] of FX[id].kernels) { const r = await kerr(fam, e); if (r) K26[fam + ':' + e] = r; } }
      step('simKernels', { ...K26, works: !Object.keys(K26).length });
      // the engine on its own: 120 particles a second living about a second; with no speed, a particle falls ½ g t²; resistance
      // slows it; the same steps from a checkpoint or from the start give the same particles
      const V = {}, want = {}, chk = (k, got, ok) => { V[k] = String(got); want[k] = ok; };
      const ph = (o = {}) => ({ rate: 120, life: 1, producer: [0, 0, 0], radius: [0, 0, 0], anim: 1, speed: 0, gravity: [0, 0, 0], resistance: 0, axis: [0, -1, 0], extra: 1, extraAngle: 0, seed: 7, max: 40000, flat: true, ...o });
      PS_CACHE.length = 0;
      const n2 = fxPsRun('t1', ph(), new Array(120).fill(120)).parts.length; chk('count', n2, n2 > 95 && n2 < 145);
      const fall = fxPsRun('t2', ph({ gravity: [0, 2, 0] }), new Array(90).fill(120)).parts;
      const fallErr = Math.max(...fall.filter(q => q.age > .5).map(q => Math.abs(q.p[1] - .5 * 2 * q.age * q.age) / Math.max(.5 * 2 * q.age * q.age, .01))); chk('gravity', fallErr.toFixed(3), fallErr < .06);
      const slow = fxPsRun('t3', ph({ speed: 1, resistance: 3, life: 3 }), new Array(60).fill(120)).parts, old = slow.reduce((a, b) => a.age > b.age ? a : b);
      const sp = Math.hypot(...old.v); chk('resistance', sp.toFixed(3), sp < Math.exp(-3 * (old.age - 1 / 60)) * 1.0001 && sp > Math.exp(-3 * old.age) * .5 * .999);
      PS_CACHE.length = 0; fxPsRun('t4', ph({ anim: 8, speed: 1 }), new Array(40).fill(120)); const via = fxPsRun('t4', ph({ anim: 8, speed: 1 }), new Array(100).fill(120));
      PS_CACHE.length = 0; const fresh = fxPsRun('t4', ph({ anim: 8, speed: 1 }), new Array(100).fill(120));
      chk('checkpoints', via.parts.length + '/' + fresh.parts.length, via.parts.length === fresh.parts.length && via.parts.every((q, i) => q.p.every((v, k) => v === fresh.parts[i].p[k])));
      // a Birth Rate keyframed from 0 to 2 at 1 s (hold): nothing is born before then
      const bright = (fr, thr = 40) => { let n = 0, sx = 0, sy = 0; for (let i = 0; i < fr.length; i += 4) if (fr[i] > thr || fr[i + 1] > thr) { n++; const k = i / 4; sx += k % 1920; sy += Math.floor(k / 1920); } return { n, cx: n ? sx / n : 0, cy: n ? sy / n : 0 }; };
      f = await only('ccparticlesystems2'); L.keys[fxKey(f, 'birthRate')] = [{ t: 0, v: 0, ease: 'hold' }, { t: 1, v: 2, ease: 'hold' }];
      draw(.9); const before = bright(frame()); draw(1.5); const after = bright(frame()); chk('rateKeys', before.n + '/' + after.n, before.n === 0 && after.n > 100);
      delete L.keys[fxKey(f, 'birthRate')];
      // drawn: the layer is replaced (the white patch and the ramp go), yellow lines leave the middle
      draw(1); const ps = frame(), b1 = bright(ps);
      chk('ps2Draw', [b1.n, Math.round(b1.cx), px(480, 270).join(), px(1700, 900).join()], b1.n > 200 && Math.abs(b1.cx - 960) < 120 && px(480, 270).every(v => v < 40) && px(1700, 900).every(v => v < 40));
      // scrubbing there from earlier, or drawing it straight from nothing, gives the same frame
      draw(.3); draw(1); const ps2 = frame(); PS_CACHE.length = 0; draw(1); const ps3 = frame();
      chk('ps2Scrub', diff(ps, ps2).changed + '/' + diff(ps, ps3).changed, !diff(ps, ps2).changed && !diff(ps, ps3).changed);
      // the producer moves with its point; gravity pulls the particles down over time
      L.p[fxKey(f, 'positionX')] = .25; draw(1); const b2 = bright(frame()); chk('ps2Producer', Math.round(b2.cx), Math.abs(b2.cx - 480) < 120);
      L.p[fxKey(f, 'positionX')] = .5; set(f, 'velocity', 0); set(f, 'gravity', 4); draw(1); const b3 = bright(frame()); chk('ps2Gravity', Math.round(b3.cy), b3.cy > 600);
      // CC Particle World: a burst round the layer's centre; moving the Effect Camera back draws it smaller
      f = await only('ccparticleworld'); set(f, 'gravity', 0); draw(1); const w1 = bright(frame()), s1 = (() => { const fr = frame(); let v = 0; for (let i = 0; i < fr.length; i += 4) if (fr[i] > 40) { const k = i / 4; v += (k % 1920 - w1.cx) ** 2; } return Math.sqrt(v / Math.max(w1.n, 1)); })();
      set(f, 'camDistance', 6); draw(1); const w2 = bright(frame()), s2 = (() => { const fr = frame(); let v = 0; for (let i = 0; i < fr.length; i += 4) if (fr[i] > 40) { const k = i / 4; v += (k % 1920 - w2.cx) ** 2; } return Math.sqrt(v / Math.max(w2.n, 1)); })();
      chk('pwCamera', [w1.n, Math.round(s1), w2.n, Math.round(s2)], w1.n > 200 && Math.abs(w1.cx - 960) < 120 && s2 < s1 * .7);
      set(f, 'camDistance', 2);
      // Textured Square with a Texture Layer: the squares show that layer (a hidden green card)
      const green = await makeCard(Array(6).fill('20,200,40'), 'green.png', false); green.__path = await lumina.saveExport(await green.arrayBuffer(), 'green.png', dir + 'green.png');
      const G = await load(green); G.start = 0; G.dur = 6; G.visible = false; S.layers = [L, ...S.layers.filter(x => x !== L && x !== G), G];
      f.particleType = 8; f.textureLayer = G.id; set(f, 'birthSize', .6); draw(1); const tx = frame(); let gN = 0, yN = 0;
      for (let i = 0; i < tx.length; i += 4) { if (tx[i + 1] > 60 && tx[i] < tx[i + 1] * .5) gN++; if (tx[i] > 60 && tx[i + 1] > 60 && tx[i + 2] < 30) yN++; }
      f.textureLayer = 0; draw(1); const sq = frame(); let gN2 = 0, yN2 = 0;
      for (let i = 0; i < sq.length; i += 4) { if (sq[i + 1] > 60 && sq[i] < sq[i + 1] * .5) gN2++; if (sq[i] > 60 && sq[i + 1] > 60 && sq[i + 2] < 30) yN2++; }
      chk('pwTexture', [gN, yN, gN2, yN2], gN > 500 && yN < gN / 10 && gN2 < 50 && yN2 > 500);
      S.layers = S.layers.filter(x => x !== G); delete RT[G.id];
      // CC Mr. Mercury: shiny blobs round the producer after a second; none before anything is born
      f = await only('ccmrmercury'); draw(0); const m0 = bright(frame(), 20); draw(2); const m1 = bright(frame(), 20);
      chk('mercury', [m0.n, m1.n, Math.round(m1.cx)], m0.n === 0 && m1.n > 500 && Math.abs(m1.cx - 960) < 300);
      while (L.fx?.length) delFX(L, 0); for (const k of Object.keys(L.keys)) if (k.startsWith('fx')) delete L.keys[k]; draw();
      const bad = Object.keys(want).filter(k => !want[k]);
      step('simDetails', { ...V, bad, works: !bad.length });
      const menuS = [...document.querySelectorAll('#fx-add optgroup')].find(g => g.label === 'Simulation');
      step('simMenu', { count: menuS?.children.length, works: menuS?.children.length === 3 });
      // speed at 3 s into the layer, each frame after the first (the simulation goes on from the frame before)
      const r26speed = {};
      for (const id of ids) {
        f = await only(id); PS_CACHE.length = 0; draw(3); ctx.getImageData(0, 0, 1, 1);
        const t0 = performance.now(); for (let i = 1; i <= 5; i++) draw(3 + i / 30); ctx.getImageData(0, 0, 1, 1); r26speed[id] = +((performance.now() - t0) / 5).toFixed(1);
      }
      while (L.fx?.length) delFX(L, 0); draw();
      step('round26speed', r26speed);
    }
"""
assert s.count(A) == 1; s = s.replace(A, B)
if crlf: s = s.replace('\n', '\r\n')
io.open(p, 'wb').write(s.encode('utf-8')); print('ok')
