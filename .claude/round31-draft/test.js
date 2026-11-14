
    // ---- Round 31: Roto Brush & Refine Edge (the classic engine in workers/roto.js)
    {
      const kerr = async (fam, e) => { const pp = FXG.pipes[fam + ':' + e]; if (pp?.pipe) return null; const m = FXG.mods[fam]; return { err: pp?.err, log: m ? ((await Promise.race([m.getCompilationInfo(), new Promise(r => setTimeout(() => r({ messages: [{ lineNum: 0, linePos: 0, message: "no compiler report" }] }), 5000))])).messages).slice(0, 8).map(x => `${x.lineNum}:${x.linePos} ${x.message}`) : null }; };
      await only('rotobrush'); const K31 = {};
      for (const [fam, e] of FX.rotobrush.kernels) { const r = await kerr(fam, e); if (r) K31[fam + ':' + e] = r; }
      while (L.fx?.length) delFX(L, 0);
      step('roto31Kernels', { ...K31, works: !Object.keys(K31).length });
      const errs = [], V = {}, want = {}, chk = (k, got, ok) => { V[k] = String(got); want[k] = ok; };
      const run = async (name, fn) => { try { await fn(); } catch (e) { errs.push(name + ': ' + (e?.stack || e).toString().slice(0, 400)); } };
      // the engine on its own: a textured disc over a textured ground, one stroke; then the disc moved 8 px
      await run('engine', async () => {
        const Wd = 320, Hd = 240, R = 50, disc = (cx, cy) => { const d = new Uint8Array(Wd * Hd * 4); for (let y = 0; y < Hd; y++) for (let x = 0; x < Wd; x++) { const dd = Math.hypot(x + .5 - cx, y + .5 - cy) - R, a = Math.min(1, Math.max(0, .5 - dd)), tex = ((x * 7 + y * 13) % 9) / 60, i = (y * Wd + x) * 4; d[i] = (Math.min(1, (.85 + tex) * a + .1 * (1 - a))) * 255; d[i + 1] = (.2 * a + (.4 + tex) * (1 - a)) * 255; d[i + 2] = (.1 * a + .7 * (1 - a)) * 255; d[i + 3] = 255; } return { w: Wd, h: Hd, d }; };
        const iou = (m, cx, cy) => { let I = 0, U = 0; for (let y = 0; y < Hd; y++) for (let x = 0; x < Wd; x++) { const a = !!m[y * Wd + x], b = Math.hypot(x + .5 - cx, y + .5 - cy) <= R; I += a && b; U += a || b; } return I / U; };
        const t0 = performance.now(), r = await rotoCall('test', { img: disc(120, 120), next: disc(128, 120), at: [120 - R, 120], strokes: [{ k: 'fg', r: 10, p: [[100, 120], [140, 120]] }], opts: { scale: 1, searchRadius: 15, motionThreshold: 10, motionDamping: 20, best: false } });
        const g = await rotoCall('gmm', { xs: [...Array(300)].flatMap((_, i) => i % 2 ? [.9, .1, .1] : [.1, .1, .9]), a: [.9, .1, .1], b: [.1, .9, .1] }), mf = await rotoCall('flowTest', { s0: 5, t1: 3, c: 2 });
        const a = iou(r.matte, 120, 120), b = iou(r.next, 128, 120);
        chk('engine', [a.toFixed(3), b.toFixed(3), r.flow.map(v => v.toFixed(1)), g.k, g.near.toFixed(1), g.far.toFixed(1), mf.flow, mf.a, mf.b, Math.round(performance.now() - t0) + 'ms'],
          a > .95 && b > .93 && g.k >= 2 && g.near < g.far && mf.flow === 2 && mf.a && !mf.b);
      });
      // a video: a red person (50 × 130 of 640 × 360) walking left to right over a textured room (×3 in the frame)
      const clip = await makeClip(2.5, 'ROTO', 'erase'); clip.__path = await lumina.saveExport(await clip.arrayBuffer(), 'roto31.webm', dir + 'roto31.webm');
      const Vd = await load(clip); Vd.start = 0; L.visible = false; S.sel = Vd.id; refresh();
      const red = (fr, x0 = 0, x1 = 1920) => { let n = 0, a = 1e9, b = -1, t = 1e9, bo = -1; for (let i = 0; i < fr.length; i += 4) { const k = i / 4, x = k % 1920, y = (k / 1920) | 0; if (x < x0 || x >= x1) continue; if (fr[i] > 150 && fr[i + 1] < 90 && fr[i + 2] < 100) { n++; a = Math.min(a, x); b = Math.max(b, x); t = Math.min(t, y); bo = Math.max(bo, y); } } return { n, x0: a, x1: b, y0: t, y1: bo }; };
      const lit = fr => { let n = 0, a = 1e9, b = -1; for (let i = 0; i < fr.length; i += 4) if (fr[i] + fr[i + 1] + fr[i + 2] > 45) { n++; const x = (i / 4) % 1920; a = Math.min(a, x); b = Math.max(b, x); } return { n, x0: a, x1: b }; };
      const fps = S.fps, T0 = 1, g0 = rotoFrame(Vd, T0);
      const waitFor = async (cond, ms = 60000) => { const t0 = performance.now(); while (performance.now() - t0 < ms) { render(); drawOverlay(); if (cond()) return true; await new Promise(r => setTimeout(r, 60)); } return false; };
      const fin = () => { const j = ROTO.last[f31?.uid]; return j && j.g === rotoFrame(Vd, S.time) && ROTO.final.has(j.fk) ? j : null; };
      const outl = () => { const j = ROTO.last[f31?.uid]; return j && ROTO.outline.get(j.C.keys.get(rotoFrame(Vd, S.time))); };
      // the screen position of a frame pixel, and a stroke drawn there with the mouse
      const scr = (x, y) => { const r = ov.getBoundingClientRect(); return [r.left + x / W() * r.width, r.top + y / H() * r.height]; };
      const paint = async (pts, alt = false) => {
        const ev = (type, [x, y]) => ov.dispatchEvent(new PointerEvent(type, { clientX: x, clientY: y, button: 0, buttons: 1, altKey: alt, pointerId: 31, bubbles: true }));
        ev('pointerdown', scr(...pts[0])); for (const p of pts.slice(1)) ev('pointermove', scr(...p)); ev('pointerup', scr(...pts.at(-1)));
      };
      let f31 = null, P = null;
      await settle(T0); await vfSettle(); await settle(T0); const plain31 = frame(); P = red(plain31);
      // Layer › Roto Brush adds the effect and starts the tool; a stroke down the person's middle
      await run('tool', async () => {
        rotoMenu(); f31 = Vd.fx?.find(x => x.id === 'rotobrush'); await fxWarm('rotobrush');
        const cx = (P.x0 + P.x1) / 2, bar = !$('#rotoBar').hidden;
        await paint([[cx, P.y0 + 25], [cx, (P.y0 + P.y1) / 2], [cx, P.y1 - 25]]);
        const d = f31?.roto, s = d?.strokes?.[0];
        const ok = await waitFor(() => !!outl(), 60000), o = outl();
        // the outline's box (grid pixels = frame pixels here) round the person
        let bx0 = 1e9, bx1 = -1, by0 = 1e9, by1 = -1; if (o) for (let i = 0; i < o.o.length; i += 2) { bx0 = Math.min(bx0, o.o[i]); bx1 = Math.max(bx1, o.o[i]); by0 = Math.min(by0, o.o[i + 1]); by1 = Math.max(by1, o.o[i + 1]); }
        const tf = frame(), whole = diff(plain31, tf).changed;   // painting shows the whole layer
        chk('tool', [!!f31, bar, ROTO.tool?.mode, s?.k, s?.p.length, d?.base, d?.span.join('-'), g0, ok, [bx0, bx1, by0, by1].map(Math.round).join(','), [P.x0, P.x1, P.y0, P.y1].join(','), whole],
          !!f31 && bar && s?.k === 'fg' && d.base === g0 && d.span[0] === Math.max(0, g0 - 20) && d.span[1] === g0 + 20 && ok && Math.abs(bx0 - P.x0) < 25 && Math.abs(bx1 - P.x1) < 25 && Math.abs(by0 - P.y0) < 25 && Math.abs(by1 - P.y1) < 25 && whole < 2000);
      });
      // Done: the layer cut out (the room gone, the person kept)
      let cut0 = null;
      await run('matte', async () => {
        $('#rotoDone').click(); const ok = await waitFor(() => !!fin()); cut0 = frame();
        const lt = lit(cut0), rd = red(cut0), area = (P.x1 - P.x0 + 1) * (P.y1 - P.y0 + 1);
        chk('matte', [!ROTO.tool, ok, lt.n, rd.n, P.n, area, lt.x0, lt.x1], !ROTO.tool && ok && rd.n > P.n * .9 && lt.n < area * 1.25 && lt.n > area * .7 && lt.x0 > P.x0 - 25 && lt.x1 < P.x1 + 25);
      });
      // a few frames on, the matte follows the person (carried on from the base frame); past the span, nothing
      await run('propagate', async () => {
        const T1 = T0 + 8 / fps; await settle(T1); await vfSettle(); render(); const src = (Vd.fx[0].on = false, render(), frame()); Vd.fx[0].on = true; const P1 = red(src);
        const ok = await waitFor(() => !!fin()), fr = frame(), lt = lit(fr), area = (P1.x1 - P1.x0 + 1) * (P1.y1 - P1.y0 + 1);
        await settle(T0 + 26 / fps); render(); const past = lit(frame());
        await settle(T0 - 26 / fps); render(); const before = lit(frame());
        chk('propagate', [ok, P1.x0, P.x0, lt.n, area, lt.x0, lt.x1, past.n, before.n], ok && P1.x0 > P.x0 + 15 && lt.n > area * .7 && lt.n < area * 1.3 && Math.abs(lt.x0 - P1.x0) < 30 && Math.abs(lt.x1 - P1.x1) < 30 && past.n === 0 && before.n === 0);
      });
      // an Alt (background) stroke over the top half takes it out; undo puts it back
      await run('background', async () => {
        await settle(T0); rotoTool(Vd, f31, 'roto'); const cx = (P.x0 + P.x1) / 2, mid = (P.y0 + P.y1) / 2;
        ROTO.tool.size = 60; await paint([[cx, P.y0 - 20], [cx, mid - 30]], true);
        const s = f31.roto.strokes.at(-1); rotoToolEnd();
        const ok = await waitFor(() => !!fin()), top = red(frame(), cx - 50, cx + 50), n = f31.roto.strokes.length;   // under the stroke (60 px each side of cx): the person's outer edges are a toss-up for the cut
        undo(); const V2 = S.layers.find(x => x.id === Vd.id); f31 = V2.fx.find(x => x.id === 'rotobrush');
        const ok2 = await waitFor(() => { const j = ROTO.last[f31.uid]; return j && j.f === f31 && ROTO.final.has(j.fk); }), back = red(frame());
        chk('background', [s?.k, n, ok, top.n, top.y0, P.y0, f31.roto.strokes.length, ok2, back.n], s?.k === 'bg' && ok && top.y0 > mid - 60 && top.n < P.n * .7 && f31.roto.strokes.length === n - 1 && ok2 && back.n > P.n * .9);
      });
      const Vx = () => S.layers.find(x => x.id === Vd.id);
      // Refine Edge along the person's left edge: a band, and soft (partly see-through) alpha there
      await run('refine', async () => {
        const V2 = Vx(); f31 = V2.fx.find(x => x.id === 'rotobrush'); const j0 = ROTO.last[f31.uid], f0 = ROTO.final.get(j0.fk), soft0 = f0?.idx.length;
        rotoTool(V2, f31, 'refine'); await paint([[P.x0, P.y0 + 20], [P.x0, P.y1 - 20]]); rotoToolEnd();
        const s = f31.roto.strokes.at(-1), ok = await waitFor(() => !!fin(), 90000), j = ROTO.last[f31.uid], f1 = ROTO.final.get(j.fk), o = ROTO.outline.get(j.C.keys.get(j.g));
        let mapped = 0; for (const v of f1?.map || []) if (v > 0) mapped++;
        chk('refine', [s?.k, ok, !!o?.band, soft0, f1?.idx.length, mapped], s?.k === 'refine' && ok && !!o?.band && f1.idx.length > soft0 + 200 && mapped > 50);
      });
      // View Decontamination Map: opaque over the layer's grid (the room shows as black, not see-through)
      await run('viewMap', async () => {
        const V2 = Vx(); f31 = V2.fx.find(x => x.id === 'rotobrush'); f31.viewMap = true; const bg0 = S.global.bg; S.global.bg = 'none'; render();
        const ok = await waitFor(() => !!fin()); const a = ctx.getImageData(200, 200, 1, 1).data[3]; f31.viewMap = false; if (bg0 === undefined) delete S.global.bg; else S.global.bg = bg0; render();
        chk('viewMap', [ok, a], ok && a === 255);
      });
      // Freeze (a short span): every frame's matte kept; the frozen matte draws the same picture; Unfreeze
      await run('freeze', async () => {
        const V2 = Vx(); f31 = V2.fx.find(x => x.id === 'rotobrush'); f31.roto = { ...f31.roto, span: [g0 - 1, g0 + 2] }; commit();
        await settle(T0); render(); await waitFor(() => !!fin(), 90000); const live = frame();
        await rotoFreeze(V2, f31); const F = ROTO.frozen[f31.frozen], nfr = F ? Object.keys(F.frames).length : 0;
        ROTO.final.clear(); ROTO.rgba.clear(); render(); const ok = await waitFor(() => !!fin(), 90000), fz = frame(), dd = diff(live, fz);
        const json = JSON.parse(projectJSON()), saved = json.rotoFrozen?.[f31.frozen], strokesSaved = json.layers.find(x => x.id === V2.id)?.fx?.find(x => x.id === 'rotobrush')?.roto?.strokes?.length;
        const refused = (rotoTool(V2, f31, 'roto'), !ROTO.tool);
        f31.frozen = null; commit();
        chk('freeze', [nfr, ok, dd.max, dd.changed, !!saved, saved && Object.keys(saved.frames).length, strokesSaved, refused], nfr === 4 && ok && dd.changed < 3000 && !!saved && Object.keys(saved.frames).length === 4 && strokesSaved === f31.roto.strokes.length && refused);
      });
      // export: every frame of the span worked out before recording
      await run('export', async () => {
        const V2 = Vx(); f31 = V2.fx.find(x => x.id === 'rotobrush'); f31.roto = { ...f31.roto, span: [g0 - 2, g0 + 3] }; commit();
        await rotoWarmAll(); let have = 0;
        for (let g = g0 - 2; g <= g0 + 3; g++) { await settle(rotoTime(V2, g)); render(); const j = ROTO.last[f31.uid]; if (j && j.g === g && ROTO.final.has(j.fk)) have++; }
        chk('export', [have], have === 6);
      });
      const bad = Object.keys(want).filter(k => !want[k]);
      step('roto31Details', { ...V, errs, bad, works: !bad.length && !errs.length && Object.keys(want).length === 9 });
      const grp = n => [...document.querySelectorAll('#fx-add optgroup')].find(g => g.label === n);
      S.sel = Vd.id; refresh();
      step('roto31Menu', { matte: grp('Matte')?.children.length, layerMenu: MENUS.Layer().some(it => it[0] === 'Roto Brush'), works: !!grp('Matte')?.querySelector('option[value=rotobrush]') && MENUS.Layer().some(it => it[0] === 'Roto Brush') });
      // speed: a frame whose matte is worked out (laying it over the frame)
      await settle(T0); render(); await waitFor(() => !!fin(), 60000); ctx.getImageData(0, 0, 1, 1);
      const t0 = performance.now(); for (let i = 0; i < 5; i++) render(T0 + .0001 * i); ctx.getImageData(0, 0, 1, 1);
      step('round31speed', { rotobrush: +((performance.now() - t0) / 5).toFixed(1) });
      S.layers = S.layers.filter(x => x.id !== Vd.id); delete RT[Vd.id]; L.visible = true; S.sel = L.id; render();
    }
