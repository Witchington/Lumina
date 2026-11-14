    // ---- Round 32: 3D Camera Tracker (the tracking and the solve in workers/camtrack.js), Camera Track Pin
    {
      const kerr = async (fam, e) => { const pp = FXG.pipes[fam + ':' + e]; if (pp?.pipe) return null; const m = FXG.mods[fam]; return { err: pp?.err, log: m ? ((await Promise.race([m.getCompilationInfo(), new Promise(r => setTimeout(() => r({ messages: [{ lineNum: 0, linePos: 0, message: "no compiler report" }] }), 5000))])).messages).slice(0, 8).map(x => `${x.lineNum}:${x.linePos} ${x.message}`) : null }; };
      { const i = S.layers.findIndex(x => x.id === L.id); if (i >= 0) S.layers[i] = L; else S.layers.push(L); ensureRT(L); }
      S.sel = L.id; refresh();
      await only('cameratracker'); await fxWarm('campin'); const K32 = {};
      for (const [fam, e] of [...FX.cameratracker.kernels, ...FX.campin.kernels]) { const r = await kerr(fam, e); if (r) K32[fam + ':' + e] = r; }
      while (L.fx?.length) delFX(L, 0);
      step('camtrack32Kernels', { ...K32, works: !Object.keys(K32).length });
      const errs = [], V = {}, want = {}, chk = (k, got, ok) => { V[k] = String(got); want[k] = ok; };
      const run = async (name, fn) => { try { await fn(); } catch (e) { errs.push(name + ': ' + (e?.stack || e).toString().slice(0, 400)); } };
      // the engine on its own: KLT on a shifted texture; a made-up scene seen by a known camera (Specify Angle of View 50°)
      await run('engine', async () => {
        const t0 = performance.now(), k = await ctCall('klt', {}), s = await ctCall('synth', { shot: 'specify', specify: 50 }), a = await ctCall('synth', { frames: 40 });
        chk('engine', [k.features, k.tracked, k.median?.toFixed(3), s.err?.toFixed(3), s.hfov?.toFixed(2), s.solved, a.method, a.err?.toFixed(3), a.hfov?.toFixed(2), Math.round(performance.now() - t0) + 'ms'],
          k.features >= 40 && k.tracked >= 25 && k.median < .3 && s.err < .5 && Math.abs(s.hfov - 50) < .1 && s.solved === 60 && a.method === 'typical' && a.err < .5 && Math.abs(a.hfov - 50) < 2);
      });
      // a video: a camera moving right and forward (turning a little) through a field of checker squares, 50° wide
      const camClip = async secs => {
        const c = document.createElement('canvas'); c.width = 640; c.height = 360; const x = c.getContext('2d');
        const rec = new MediaRecorder(c.captureStream(30), { mimeType: 'video/webm', videoBitsPerSecond: 8e6 }), ch = [];
        rec.ondataavailable = e => ch.push(e.data); const done = new Promise(r => rec.onstop = r); rec.start();
        let sd = 12345; const rnd = () => (sd = (sd * 1103515245 + 12345) % 2147483648) / 2147483648;
        const P = [...Array(170)].map(() => [(rnd() - .5) * 10, (rnd() - .5) * 4.6, 4 + rnd() * 8, rnd()]), fl = 320 / Math.tan(25 * Math.PI / 180), t0 = performance.now();
        await new Promise(r => { const i = setInterval(() => {
          const t = Math.min(1, (performance.now() - t0) / 1000 / secs), cx = 1.5 * t, cz = .6 * t, yaw = .12 * t, co = Math.cos(yaw), si = Math.sin(yaw);
          const g = x.createLinearGradient(0, 0, 0, 360); g.addColorStop(0, '#34485c'); g.addColorStop(1, '#5c4834'); x.fillStyle = g; x.fillRect(0, 0, 640, 360);
          const vis = P.map(p => { const dx = p[0] - cx, dz = p[2] - cz; return [co * dx - si * dz, p[1], si * dx + co * dz, p[3]]; }).filter(q => q[2] > .5).sort((a, b) => b[2] - a[2]);
          for (const [X, Y, Z, kk] of vis) { const u = fl * X / Z + 320, v = fl * Y / Z + 180, h = Math.max(3, 64 / Z); x.fillStyle = kk < .5 ? '#f0f0f0' : '#ffd050'; x.fillRect(u - h, v - h, 2 * h, 2 * h); x.fillStyle = '#101010'; x.fillRect(u - h, v - h, h, h); x.fillRect(u, v, h, h); }
          if (t >= 1) { clearInterval(i); r(); } }, 33); });
        rec.stop(); await done; return new File(ch, 'CAM.webm', { type: 'video/webm' });
      };
      const clip = await camClip(3); clip.__path = await lumina.saveExport(await clip.arrayBuffer(), 'camtrack32.webm', dir + 'camtrack32.webm');
      let Vd = await load(clip); const VdId = Vd.id; Vd.start = 0; L.visible = false; S.sel = Vd.id; refresh();
      const waitFor = async (cond, ms = 60000) => { const t0 = performance.now(); while (performance.now() - t0 < ms) { render(); drawOverlay(); if (cond()) return true; await new Promise(r => setTimeout(r, 80)); } return false; };
      const T0 = 1; let f32 = null, sol = null;
      const re = () => { Vd = S.layers.find(x => x.id === VdId); f32 = Vd?.fx?.find(x => x.id === 'cameratracker'); };
      await settle(T0); await vfSettle(); await settle(T0); const plain = frame();
      // the screen position of an overlay pixel; pointer events there
      const scr = (x, y) => { const r = ov.getBoundingClientRect(); return [r.left + x / ov.width * r.width, r.top + y / ov.height * r.height]; };
      const ev = (type, [x, y], o = {}) => ov.dispatchEvent(new (type === 'contextmenu' ? MouseEvent : PointerEvent)(type, { clientX: x, clientY: y, button: type === 'contextmenu' ? 2 : 0, buttons: 1, pointerId: 32, bubbles: true, cancelable: true, ...o }));
      const click = (p, o) => { ev('pointerdown', p, o); ev('pointerup', p, o); };
      // a triangle of three drawn points near the middle (overlay pixels): its centroid
      const triangle = () => {
        const cx = ov.width / 2, cy = ov.height / 2, hs = [...CT.hits].sort((a, b) => Math.hypot(a.x - cx, a.y - cy) - Math.hypot(b.x - cx, b.y - cy)).slice(0, 12);
        for (let i = 0; i < hs.length; i++) for (let j = i + 1; j < hs.length; j++) for (let k = j + 1; k < hs.length; k++) {
          const [a, b, c] = [hs[i], hs[j], hs[k]], area = Math.abs((b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x)) / 2, p = [(a.x + b.x + c.x) / 3, (a.y + b.y + c.y) / 3];
          if (area > 400 && ctPointAt(p) == null && ctTriangleAt(p)) return p;
        }
        return null;
      };
      // Layer › Track Camera: the effect, analysed in the background (step 1 tracks, step 2 solves)
      await run('analyze', async () => {
        const inMenu = MENUS.Layer().some(it => it[0] === 'Track Camera');
        ctMenu(); f32 = Vd.fx?.find(x => x.id === 'cameratracker'); await fxWarm('cameratracker');
        let sawStep1 = false; const t0 = performance.now();
        const ok = await waitFor(() => { if (CT.job?.f === f32 && CT.job.step === 1) sawStep1 = true; return !!ctOf(f32).sol || !!ctOf(f32).fail; }, 300000);
        sol = ctOf(f32).sol; const tr = ctOf(f32).tracks, hf = sol && 2 * Math.atan(sol.size[0] / 2 / sol.frames[sol.frames.findIndex(x => x.solved)].focal) * 180 / Math.PI;
        const solved = sol?.frames.filter(x => x.solved).length, n = sol?.frames.length, status = ctStatus(f32);
        chk('analyze', [inMenu, !!f32, sawStep1, ok, ctOf(f32).fail, tr?.tracks.length, tr?.frames, sol?.methodUsed, sol?.averageError?.toFixed(3), hf?.toFixed(2), solved + '/' + n, sol?.points.length, status, Math.round(performance.now() - t0) + 'ms'],
          inMenu && !!f32 && sawStep1 && ok && !!sol && sol.methodUsed === 'typical' && sol.averageError < 2 && Math.abs(hf - 50) < 6 && solved >= .9 * n && sol.points.length >= 40 && /^Method used: Typical/.test(status));
      });
      // the track points on the preview while the layer is selected; the 2D source tracks too
      await run('points', async () => {
        await settle(T0); render(); drawOverlay(); const n3 = CT.hits.length, pv = frame(), same = diff(plain, pv).changed;
        f32.showPoints = 0; render(); drawOverlay(); const n2 = CT.hits.length, ov2 = octx.getImageData(0, 0, ov.width, ov.height).data.some((v, i) => i % 4 === 3 && v > 0);
        f32.showPoints = 1; render(); drawOverlay();
        chk('points', [n3, n2, ov2, same], n3 >= 30 && n2 === 0 && ov2 && same < 50);
      });
      // Select track points: click inside a triangle of three; the target; right-click › Create Solid
      let solidL = null, tri = null;
      await run('select', async () => {
        ctTool(Vd, f32); const bar = !$('#ctBar').hidden; render(); drawOverlay(); tri = triangle();
        if (tri) { ev('pointermove', scr(...tri)); click(scr(...tri)); }
        const n = CT.sel.ids.size, k = ctFrameIdx(sol, Vd, S.time), tg = ctTarget(sol, [...CT.sel.ids], k);
        chk('select', [bar, !!tri, n, !!tg, tg && tg.size.toFixed(3)], bar && !!tri && n === 3 && !!tg && tg.size > 0);
      });
      const blob = (fr, rgb, tol = 14) => { let n = 0, sx = 0, sy = 0; for (let i = 0; i < fr.length; i += 4) if (Math.abs(fr[i] - rgb[0]) < tol && Math.abs(fr[i + 1] - rgb[1]) < tol && Math.abs(fr[i + 2] - rgb[2]) < tol) { n++; sx += (i / 4) % W(); sy += ((i / 4) / W()) | 0; } return { n, x: sx / n, y: sy / n }; };
      const projAt = (T, X) => { const k = ctFrameIdx(sol, Vd, T), q = ctProject(sol, k, X, false), r = RT[Vd.id], p = DOMMatrix.fromMatrix(r.m).translate(-r.box.w / 2, -r.box.h / 2).transformPoint(new DOMPoint(q[0], q[1])); return [p.x, p.y]; };
      await run('createSolid', async () => {
        const before = S.layers.length;
        ev('contextmenu', scr(...tri)); const menu = !!$('#ctMenu'), btn = [...document.querySelectorAll('#ctMenu button')].find(b => b.textContent.trim() === 'Create Solid');
        btn?.click(); solidL = S.layers.find(x => x.name === 'Track Solid 1');
        const pin = solidL?.fx?.find(x => x.id === 'campin'), above = solidL && S.layers.indexOf(solidL) === S.layers.indexOf(Vd) - 1;
        if (pin) solidL.p[fxKey(pin, 'pinSize')] = 30; await fxWarm('campin'); await settle(T0); render(); const a = blob(frame(), ctColor(7)), pa = projAt(T0, pin.pin.c);
        const T1 = 2.2; await settle(T1); await vfSettle(); await settle(T1); render(); const b = blob(frame(), ctColor(7)), pb = projAt(T1, pin.pin.c);
        chk('createSolid', [menu, !!btn, S.layers.length - before, !!pin, above, !CT.tool, a.n, a.x?.toFixed(0) + ',' + a.y?.toFixed(0), pa.map(Math.round), b.n, b.x?.toFixed(0) + ',' + b.y?.toFixed(0), pb.map(Math.round)],
          menu && !!btn && S.layers.length === before + 1 && !!pin && above && !CT.tool && a.n > 200 && b.n > 200 && Math.hypot(a.x - pa[0], a.y - pa[1]) < 12 && Math.hypot(b.x - pb[0], b.y - pb[1]) < 12 && Math.hypot(pa[0] - pb[0], pa[1] - pb[1]) > 40);
      });
      // Create Text on the same points; then undo takes it away again
      await run('createText', async () => {
        await settle(T0); S.sel = Vd.id; ctTool(Vd, f32); render(); drawOverlay(); const p = triangle(); if (p) click(scr(...p));
        const made = ctCreate(Vd, f32, 'text', false), tl = made?.[0];
        await settle(T0); render(); const withT = frame(); tl.visible = false; render(); const without = frame(); tl.visible = true;
        const dd = diff(without, withT).changed, n = S.layers.length; undo(); const gone = !S.layers.some(x => x.id === tl.id) && S.layers.length === n - 1;
        chk('createText', [!!tl, tl?.kind, !!tl?.fx?.find(x => x.id === 'campin'), dd, gone], !!tl && tl.kind === 'text' && !!tl.fx.find(x => x.id === 'campin') && dd > 300 && gone);
      });
      re(); solidL = S.layers.find(x => x.name === 'Track Solid 1');
      // Delete Selected Points: solved again without them (no tracking again); undo brings the old solve straight back
      await run('delete', async () => {
        await settle(T0); S.sel = Vd.id; ctTool(Vd, f32); render(); drawOverlay();
        const ids = CT.hits.slice(0, 2).map(h => h.id); ctSelect(ids, 'set');
        document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete', bubbles: true }));
        const del = [...(f32.deleted || [])], sk0 = ctOf(f32).sk; let step2only = true;
        const ok = await waitFor(() => { if (CT.job?.f === f32 && CT.job.step === 1) step2only = false; const o = ctOf(f32); return o.sk !== sk0 && !!o.sol || !!o.fail; }, 300000);
        const s2 = ctOf(f32).sol, gone = s2 && !s2.points.some(p => del.includes(p.id));
        undo(); re(); render(); const back = (f32.deleted || []).length === 0 && ctOf(f32).sol === sol && !CT.job;
        redo(); re(); render(); const again = ctOf(f32).sol === s2 && !CT.job;
        undo(); re(); render(); ctToolEnd();
        chk('delete', [ids.length, del.length, ok, step2only, gone, s2?.averageError?.toFixed(3), back, again], ids.length === 2 && del.length >= 2 && ok && step2only && gone && back && again);
      });
      // Specify Angle of View: solved again from the same tracks, at exactly that angle
      await run('specify', async () => {
        f32.shotType = 2; Vd.p[fxKey(f32, 'hfov')] = 50; commit(); re();
        let step2only = true; const ok = await waitFor(() => { if (CT.job?.f === f32 && CT.job.step === 1) step2only = false; const o = ctOf(f32); return o.sol && o.sol !== sol || !!o.fail; }, 300000);
        const s3 = ctOf(f32).sol, hf = s3 && 2 * Math.atan(s3.size[0] / 2 / s3.frames[0].focal) * 180 / Math.PI;
        chk('specify', [ok, step2only, hf?.toFixed(3), s3?.averageError?.toFixed(3)], ok && step2only && Math.abs(hf - 50) < .01 && s3.averageError < 3);
        undo(); re(); render();
      });
      // Render Track Points draws them into the frame; Solve Lens Distortion and Undistort Footage
      await run('render', async () => {
        await settle(T0); render(); const off = frame(); f32.renderPoints = true; render(); const on = frame(); f32.renderPoints = false; render();
        const dd = diff(off, on).changed;
        f32.lensDistortion = true; commit(); re();
        const ok = await waitFor(() => { const o = ctOf(f32); return o.sol && o.sol !== sol || !!o.fail; }, 400000), s4 = ctOf(f32).sol;
        render(); const a = frame(); f32.undistort = true; render(); const b = frame(); f32.undistort = false;
        const lit = fr => { let n = 0; for (let i = 0; i < fr.length; i += 16) if (fr[i] + fr[i + 1] + fr[i + 2] > 60) n++; return n; }, la = lit(a), lb = lit(b);
        chk('render', [dd, ok, !!s4?.distortion, s4?.distortion?.k1?.toFixed(4), s4?.averageError?.toFixed(3), la, lb], dd > 500 && ok && !!s4?.distortion && Math.abs(s4.distortion.k1) < .2 && lb > la * .8);
        undo(); re(); render();
      });
      // the project file keeps the analysis: read back, the solve is there without analysing again
      await run('save', async () => {
        await settle(T0); render(); const json = JSON.parse(projectJSON()), ct = json.camTrack, keys = ct?.keys?.[f32.uid];
        const had = { t: new Map(CT.tracks), s: new Map(CT.solves) }; CT.tracks.clear(); CT.solves.clear(); CT.last = {}; CT.saved = {};
        ctLoad(ct); render(); const o = ctOf(f32), back = !!o.sol && !!o.tracks && o.tracks.pts.length === had.t.get(keys?.tk)?.pts.length && !CT.job && !CT.want;
        for (const [k, v] of had.t) CT.tracks.set(k, v); for (const [k, v] of had.s) CT.solves.set(k, v);
        const size = JSON.stringify(ct || {}).length;
        chk('save', [!!keys, Object.keys(ct?.tracks || {}).length, Object.keys(ct?.solves || {}).length, back, size, String(startExport).includes('ctWarmAll')],
          !!keys && !!ct.tracks[keys.tk] && !!ct.solves[keys.sk] && back && String(startExport).includes('ctWarmAll'));
      });
      const bad = Object.keys(want).filter(k => !want[k]);
      step('camtrack32Details', { ...V, errs, bad, works: !bad.length && !errs.length && Object.keys(want).length === 10 });
      const grp = n => [...document.querySelectorAll('#fx-add optgroup')].find(g => g.label === n);
      S.sel = Vd.id; refresh();
      step('camtrack32Menu', { perspective: grp('Perspective')?.children.length, works: !!grp('Perspective')?.querySelector('option[value=cameratracker]') && !!grp('Perspective')?.querySelector('option[value=campin]') && MENUS.Layer().some(it => it[0] === 'Track Camera') });
      // speed: a solved frame (the tracker passing through) with a pinned solid over it
      await settle(T0); render(); ctx.getImageData(0, 0, 1, 1);
      let t0 = performance.now(); for (let i = 0; i < 5; i++) render(T0 + .0001 * i); ctx.getImageData(0, 0, 1, 1); const both = (performance.now() - t0) / 5;
      solidL = S.layers.find(x => x.name === 'Track Solid 1'); if (solidL) solidL.visible = false; t0 = performance.now(); for (let i = 0; i < 5; i++) render(T0 + .0001 * i); ctx.getImageData(0, 0, 1, 1); const tracker = (performance.now() - t0) / 5;
      step('round32speed', { trackerAndPin: +both.toFixed(1), trackerOnly: +tracker.toFixed(1) });
      S.layers = S.layers.filter(x => x.id !== VdId && x.name !== 'Track Solid 1'); delete RT[VdId]; { const i = S.layers.findIndex(x => x.id === L.id); if (i >= 0) S.layers[i] = L; } L.visible = true; S.sel = L.id; render();
    }
