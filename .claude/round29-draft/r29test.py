import io
p = r'D:\Lumina\.claude\fx\selftest.js'
raw = io.open(p, 'rb').read(); crlf = b'\r\n' in raw
s = raw.decode('utf-8').replace('\r\n', '\n')
def rep(a, b):
    global s
    assert s.count(a) == 1, (a[:80], s.count(a)); s = s.replace(a, b)
A = "      step('round28speed', r28speed);\n    }\n"
rep(A, A + """
    // ---- Round 29: Utility & Text (Grow Bounds, CC Overbrights, HDR Highlight Compression, HDR Compander, Cineon
    // Converter, Color Profile Converter, Apply Color LUT, Numbers, Timecode)
    {
      const kerr = async (fam, e) => { const pp = FXG.pipes[fam + ':' + e]; if (pp?.pipe) return null; const m = FXG.mods[fam]; return { err: pp?.err, log: m ? ((await Promise.race([m.getCompilationInfo(), new Promise(r => setTimeout(() => r({ messages: [{ lineNum: 0, linePos: 0, message: "no compiler report" }] }), 5000))])).messages).slice(0, 8).map(x => `${x.lineNum}:${x.linePos} ${x.message}`) : null }; };
      const ids = ['growbounds', 'ccoverbrights', 'hdrcompression', 'hdrcompander', 'cineon', 'colorprofile', 'applylut', 'numbers', 'timecode'], K29 = {};
      for (const id of ids) { await only(id); for (const [fam, e] of FX[id].kernels) { const r = await kerr(fam, e); if (r) K29[fam + ':' + e] = r; } }
      step('util29Kernels', { ...K29, works: !Object.keys(K29).length });
      const V = {}, want = {}, chk = (k, got, ok) => { V[k] = String(got); want[k] = ok; };
      const count = (fr, test, x0 = 0, x1 = 1920, y0 = 0, y1 = 1080) => { let n = 0, sx = 0, sy = 0; for (let i = 0; i < fr.length; i += 4) { const k = i / 4, x = k % 1920, y = Math.floor(k / 1920); if (x < x0 || x >= x1 || y < y0 || y >= y1) continue; if (test(fr[i], fr[i + 1], fr[i + 2])) { n++; sx += x; sy += Math.floor(k / 1920); } } return { n, cx: n ? sx / n : 0, cy: n ? sy / n : 0 }; };
      const errs = []; const run = async (name, fn) => { try { await fn(); } catch (e) { errs.push(name + ': ' + (e?.stack || e).toString().slice(0, 300)); } };
      const K = { WHT: 480, RED: 800, GRY: 1760, Y: 270 }, red = (r, g, b) => r > 150 && g < 90 && b < 90, isGrey = c => c[0] === c[1] && c[1] === c[2];
      while (L.fx?.length) delFX(L, 0); draw(1); const base1 = frame();
      // CC Overbrights: in range dim grey; pushed over 1 by Exposure the highlight colour
      await run('overbrights', async () => {
        f = await only('ccoverbrights'); draw(1); const oW = px(K.WHT, K.Y), oR = px(K.RED, K.Y);
        while (L.fx?.length) delFX(L, 0); const fe = await add('exposure'); set(fe, 'masterExposure', 2); await add('ccoverbrights'); draw(1); const oHot = px(K.WHT, K.Y);
        chk('overbrights', [oW.join(), oR.join(), oHot.join()], isGrey(oW) && oW[0] > 80 && oW[0] < 95 && isGrey(oR) && oHot[0] > 240 && oHot[1] < 10 && oHot[2] < 10);
      });
      // HDR Highlight Compression: white to about half; Amount 0 leaves the layer
      await run('hdrCompression', async () => {
        f = await only('hdrcompression'); draw(1); const hW = px(K.WHT, K.Y); set(f, 'amount', 0); draw(1); const h0 = diff(base1, frame());
        chk('hdrCompression', [hW.join(), h0.changed], Math.abs(hW[0] - 128) < 8 && isGrey(hW) && h0.changed === 0);
      });
      // HDR Compander: the defaults change nothing; compress then expand with the same Gain and Gamma gives the layer back
      await run('hdrCompander', async () => {
        f = await only('hdrcompander'); draw(1); const c0 = diff(base1, frame()); set(f, 'gain', 2); draw(1); const cW = px(K.WHT, K.Y);
        set(f, 'gamma', 2.2); const g = await add('hdrcompander'); g.mode = 1; set(g, 'gain', 2); set(g, 'gamma', 2.2); draw(1); const ct = diff(base1, frame());
        chk('hdrCompander', [c0.changed, cW.join(), ct.max], c0.changed === 0 && Math.abs(cW[0] - 128) < 4 && ct.max <= 3);
      });
      // Cineon Converter: Log to Linear darkens the middle; Linear to Log then Log to Linear gives the layer back
      await run('cineon', async () => {
        f = await only('cineon'); draw(1); const cd = diff(base1, frame()), cg = px(K.GRY, K.Y), bg = (i => [base1[i], base1[i + 1], base1[i + 2]])((K.Y * 1920 + K.GRY) * 4);
        f.conversion = 0; const g = await add('cineon'); draw(1); const ct = diff(base1, frame());
        chk('cineon', [cd.changed, cg.join(), bg.join(), ct.max], cd.changed > 20000 && cg[0] < bg[0] - 10 && ct.max <= 4);
      });
      // Color Profile Converter: the defaults (working space to sRGB) change nothing; sRGB to Rec. 2020 does; sRGB to ACEScg and
      // back gives the layer back
      await run('colorProfile', async () => {
        f = await only('colorprofile'); draw(1); const p0 = diff(base1, frame()); f.outputProfile = 3; draw(1); const p1 = diff(base1, frame()), pR = px(K.RED, K.Y);
        f.outputProfile = 5; const g = await add('colorprofile'); g.inputProfile = 5; g.outputProfile = 1; draw(1); const pt = diff(base1, frame());
        chk('colorProfile', [p0.changed, p1.changed, pR.join(), pt.max], p0.changed === 0 && p1.changed > 20000 && pt.max <= 3);
      });
      // Apply Color LUT: none changes nothing; a 1D table that inverts; a 3D identity; the built-in Noir look is grey
      await run('applyLut', async () => {
        const inv = parseCube('TITLE "inv"\\nLUT_1D_SIZE 2\\n1 1 1\\n0 0 0\\n', 'inv'), id3 = parseCube('LUT_3D_SIZE 2\\n0 0 0\\n1 0 0\\n0 1 0\\n1 1 0\\n0 0 1\\n1 0 1\\n0 1 1\\n1 1 1\\n', 'id');
        LUTS['u:t1'] = inv; LUTS['u:t3'] = id3;
        f = await only('applylut'); draw(1); const l0 = diff(base1, frame()); f.lut = 'u:t1'; draw(1); const lW = px(K.WHT, K.Y);
        f.lut = 'u:t3'; draw(1); const l3 = diff(base1, frame()); f.lut = 'b:noir'; draw(1); const lN = px(K.RED, K.Y);
        const menu = FX.applylut.params[0].opts().map(o => o[0]);
        const only3d = !lutOpts().some(o => o[0] === 'u:t1');
        delete LUTS['u:t1']; delete LUTS['u:t3'];
        let bad = 0; try { parseCube('LUT_3D_SIZE 2\\n0 0 0\\n', 'x'); } catch { bad = 1; }
        chk('applyLut', [l0.changed, lW.join(), l3.max, lN.join(), inv.N, inv.n1, menu.includes('u:t1'), menu.at(-1), bad],
          l0.changed === 0 && lW[0] < 3 && l3.max <= 2 && isGrey(lN) && inv.N === 0 && inv.n1 === 2 && menu.includes('u:t1') && menu.at(-1) === '__load' && bad === 1 && only3d);
      });
      // Numbers: the text strings, red text centred on the layer, a stroke ring, on transparency, wider for a long date
      await run('numbers', async () => {
        const qq = o => k => o[k] ?? { type: 0, decimals: 2, value: 0, random: false, currentTime: false }[k];
        const strs = [qq({ type: 8 }), qq({ type: 7, value: -1 }), qq({ type: 6, value: 366 }), qq({ type: 9, value: 255 }), qq({ type: 1, value: -3.5 }), qq({ type: 2, value: 61.5 }), qq({ type: 5, value: 3725 }), qq({})].map(q => txNumbers(q, 0, 1));
        const sOk = strs.join('|') === 'Saturday, January 1, 2000|Dec 31, 1999|01/01/01|FF|-00003.50|00:01:01:15|01:02:05|0.00';
        f = await only('numbers'); f.onOriginal = false; set(f, 'size', 120); draw(1); const n1 = count(frame(), red), nBg = px(100, 100);
        f.display = 2; set(f, 'strokeWidth', 8); draw(1); const nS = count(frame(), (r, g, b) => r > 200 && g > 200 && b > 200);
        f.display = 0; f.type = 8; draw(1); const n8 = count(frame(), red);
        f.onOriginal = true; f.type = 0; draw(1); const nO = diff(base1, frame());
        chk('numbers', [strs.join('|'), n1.n, Math.round(n1.cx), Math.round(n1.cy), nBg.join(), nS.n, n8.n, nO.changed],
          sOk && n1.n > 500 && Math.abs(n1.cx - 960) < 40 && Math.abs(n1.cy - 540) < 40 && nBg.every(v => v === 0) && nS.n > 300 && n8.n > n1.n * 3 && nO.changed > 300 && nO.changed < 20000);
      });
      // Timecode: the strings; white text in a black box near the bottom, changing with time; on transparency
      await run('timecode', async () => {
        const sOk = [txDropFrame(1800, 30), txDropFrame(17982, 30), txTimecode(-1, 30), txTimecode(90061 * 30 + 5, 30)].join('|') === '00;01;00;02|00;10;00;00|-00:00:00:01|25:01:01:05';
        f = await only('timecode'); f.showBox = false; f.onOriginal = false; draw(1); const tBg = px(100, 100), tw = count(frame(), (r, g, b) => r > 200 && g > 200 && b > 200);
        f.showBox = true; f.onOriginal = true; draw(1); const ta = frame(), tBox = px(900, 955); draw(2); const tm = diff(ta, frame());
        chk('timecode', [sOk, tw.n, Math.round(tw.cx), Math.round(tw.cy), tBox.join(), tm.changed, tBg.join()],
          sOk && tw.n > 300 && Math.abs(tw.cx - 960) < 40 && Math.abs(tw.cy - 972) < 30 && tBox.every(v => v < 10) && tm.changed > 50 && tBg.every(v => v === 0));
      });
      // Grow Bounds: Numbers past the layer's right edge is cut off, until Grow Bounds before it widens the box
      await run('growBounds', async () => {
        L.p.scale = .5; f = await only('numbers'); f.onOriginal = false; set(f, 'size', 200); set(f, 'positionX', 1.05); draw(1); const g0 = count(frame(), red, 1442, 1700);
        while (L.fx?.length) delFX(L, 0); const gb = await add('growbounds'); set(gb, 'pixels', 200); const f2 = await add('numbers'); f2.onOriginal = false; set(f2, 'size', 200); set(f2, 'positionX', 1.05);
        draw(1); const g1 = count(frame(), red, 1442, 1700), g2 = count(frame(), red, 1545, 1700); L.p.scale = 1;
        chk('growBounds', [g0.n, g1.n, g2.n], g0.n === 0 && g1.n > 200 && g2.n === 0);
      });
      L.p.scale = 1; while (L.fx?.length) delFX(L, 0); for (const k of Object.keys(L.keys)) if (k.startsWith('fx')) delete L.keys[k]; draw();
      const bad = Object.keys(want).filter(k => !want[k]);
      step('util29Details', { ...V, errs, bad, works: !bad.length && !errs.length && Object.keys(want).length === 9 });
      const grp = n => [...document.querySelectorAll('#fx-add optgroup')].find(g => g.label === n);
      step('util29Menu', { utility: grp('Utility')?.children.length, text: grp('Text')?.children.length, works: grp('Utility')?.children.length === 7 && grp('Text')?.children.length === 2 && ids.every(id => document.querySelector(`#fx-add option[value=${id}]`)) });
      // speed at 3 s into the layer, each frame after the first
      const r29speed = {};
      for (const id of ids) {
        f = await only(id); if (id === 'applylut') f.lut = 'b:teal'; if (id === 'colorprofile') f.outputProfile = 3; if (id === 'hdrcompander') set(f, 'gain', 2); draw(3); ctx.getImageData(0, 0, 1, 1);
        const t0 = performance.now(); for (let i = 1; i <= 5; i++) draw(3 + i / 30); ctx.getImageData(0, 0, 1, 1); r29speed[id] = +((performance.now() - t0) / 5).toFixed(1);
      }
      while (L.fx?.length) delFX(L, 0); draw();
      step('round29speed', r29speed);
    }
""")
if crlf: s = s.replace('\n', '\r\n')
io.open(p, 'wb').write(s.encode('utf-8')); print('ok')
