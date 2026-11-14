
    // ---- Round 30: Audio-driven (Audio Spectrum, Audio Waveform). A 4 s WAV: a 1 kHz tone in the left channel for the
    // first 2 s (half volume), silence after; the right channel silent
    {
      const kerr = async (fam, e) => { const pp = FXG.pipes[fam + ':' + e]; if (pp?.pipe) return null; const m = FXG.mods[fam]; return { err: pp?.err, log: m ? ((await Promise.race([m.getCompilationInfo(), new Promise(r => setTimeout(() => r({ messages: [{ lineNum: 0, linePos: 0, message: "no compiler report" }] }), 5000))])).messages).slice(0, 8).map(x => `${x.lineNum}:${x.linePos} ${x.message}`) : null }; };
      const ids = ['audiospectrum', 'audiowaveform'], K30 = {};
      for (const id of ids) { await only(id); for (const [fam, e] of FX[id].kernels) { const r = await kerr(fam, e); if (r) K30[fam + ':' + e] = r; } }
      step('audio30Kernels', { ...K30, works: !Object.keys(K30).length });
      const V = {}, want = {}, chk = (k, got, ok) => { V[k] = String(got); want[k] = ok; };
      const count = (fr, test, x0 = 0, x1 = 1920, y0 = 0, y1 = 1080) => { let n = 0, sx = 0, sy = 0, top = 1e9, bot = -1; for (let i = 0; i < fr.length; i += 4) { const k = i / 4, x = k % 1920, y = Math.floor(k / 1920); if (x < x0 || x >= x1 || y < y0 || y >= y1) continue; if (test(fr[i], fr[i + 1], fr[i + 2])) { n++; sx += x; sy += y; top = Math.min(top, y); bot = Math.max(bot, y); } } return { n, cx: n ? sx / n : 0, cy: n ? sy / n : 0, top, bot }; };
      const errs = []; const run = async (name, fn) => { try { await fn(); } catch (e) { errs.push(name + ': ' + (e?.stack || e).toString().slice(0, 300)); } };
      const white = (r, g, b) => r > 200 && g > 200 && b > 200, lit = (r, g, b) => r + g + b > 60;
      // the WAV file (16-bit stereo, 48 kHz)
      const SR = 48000, N = SR * 4, wav = new DataView(new ArrayBuffer(44 + N * 4)), str = (o, t) => [...t].forEach((c, i) => wav.setUint8(o + i, c.charCodeAt(0)));
      str(0, 'RIFF'); wav.setUint32(4, 36 + N * 4, true); str(8, 'WAVEfmt '); wav.setUint32(16, 16, true); wav.setUint16(20, 1, true); wav.setUint16(22, 2, true);
      wav.setUint32(24, SR, true); wav.setUint32(28, SR * 4, true); wav.setUint16(32, 4, true); wav.setUint16(34, 16, true); str(36, 'data'); wav.setUint32(40, N * 4, true);
      for (let i = 0; i < N; i++) wav.setInt16(44 + i * 4, i < SR * 2 ? Math.round(16383 * Math.sin(2 * Math.PI * 1000 * i / SR)) : 0, true);
      const wf = new File([wav.buffer], 'tone30.wav', { type: 'audio/wav' }); wf.__path = await lumina.saveExport(wav.buffer, 'tone30.wav', dir + 'tone30.wav');
      const A = await load(wf); A.start = 0; S.sel = L.id;
      while (L.fx?.length) delFX(L, 0); draw(1); const base1 = frame();
      // the pick lists the sound layer (not the layer itself); with none the layer passes through
      await run('pick', async () => {
        f = await only('audiospectrum'); const opts = FX.audiospectrum.params[0].opts(L).map(o => o[0]); draw(1); const p0 = diff(base1, frame());
        chk('pick', [A?.kind, opts.join(), p0.changed], A?.kind === 'audio' && opts.includes(A.id) && !opts.includes(L.id) && p0.changed === 0);
      });
      f.audioLayer = A.id; await auWarmAll(); const pcm = AU.get(A.media);
      chk('decoded', [pcm?.L?.length, pcm?.R?.length], pcm?.L?.length === N && pcm.R !== pcm.L);
      // Audio Spectrum: one bar at 1 kHz (about the middle of 20 Hz–2 kHz along the line), rising from the line; nothing
      // once the tone stops; the offset reaches back to it; Side B hangs below the line
      await run('spectrum', async () => {
        set(f, 'maxHeight', 1000); draw(1); const sp = frame(), bar = count(sp, white, 900, 1010, 0, 545), rest = count(sp, white, 0, 800, 0, 530), bg = px(100, 100);
        draw(3); const s3 = count(frame(), white, 0, 1920, 0, 530); set(f, 'offset', -1500); draw(3); const s3o = count(frame(), white, 900, 1010, 0, 530); set(f, 'offset', 0);
        f.side = 1; draw(1); const sb = count(frame(), white, 900, 1010, 535, 1080); f.side = 0;
        chk('spectrum', [bar.n, Math.round(bar.cx), bar.top, rest.n, bg.join(), s3.n, s3o.n, sb.bot],
          bar.n > 300 && Math.abs(bar.cx - 952) < 30 && bar.top > 240 && bar.top < 360 && rest.n === 0 && bg.every(v => v === 0) && s3.n === 0 && s3o.n > 300 && sb.bot > 720 && sb.bot < 840);
      });
      // Analog lines and dots: the band tops joined, or dotted; Composite on original keeps the layer under the marks
      await run('spectrumKinds', async () => {
        f.display = 1; draw(1); const al = count(frame(), white, 900, 1010, 0, 530); f.display = 2; draw(1); const ad = count(frame(), white, 0, 1920, 0, 1080); f.display = 0;
        f.onOriginal = true; draw(1); const co = diff(base1, frame()); f.onOriginal = false;
        chk('spectrumKinds', [al.n, ad.n, co.changed], al.n > 100 && ad.n > 64 && ad.n < 3000 && co.changed > 500 && co.changed < 200000);
      });
      // Use Polar Path: the bands round a circle about Start Point
      await run('polar', async () => {
        f.polar = true; set(f, 'startPointX', .5); set(f, 'startPointY', .5); set(f, 'endPointX', .5); set(f, 'endPointY', .9); draw(1);
        const pc = count(frame(), lit); f.polar = false; set(f, 'startPointX', .1); set(f, 'startPointY', .5); set(f, 'endPointX', .9); set(f, 'endPointY', .5);
        chk('polar', [pc.n, Math.round(pc.cx), Math.round(pc.cy)], pc.n > 300 && Math.abs(pc.cy - 540) < 400);
      });
      // Audio Waveform, Digital, Left: ±0.5 × 100 px peaks round the line (about 490–590); Right is silent (a flat line)
      await run('waveform', async () => {
        f = await only('audiowaveform'); f.audioLayer = A.id; f.display = 0; f.channel = 1; draw(1); const wl = count(frame(), white, 300, 1600);
        f.channel = 2; draw(1); const wr = count(frame(), white, 300, 1600); f.channel = 0; draw(1); const wm = count(frame(), white, 300, 1600);
        f.display = 1; draw(1); const wa = count(frame(), white, 300, 1600); draw(3); const w3 = count(frame(), white, 300, 1600);
        chk('waveform', [wl.top, wl.bot, wr.top, wr.bot, wm.top, wm.bot, wa.n, w3.top, w3.bot],
          Math.abs(wl.top - 490) < 6 && Math.abs(wl.bot - 590) < 6 && wr.top >= 536 && wr.bot <= 544 && Math.abs(wm.top - 515) < 6 && Math.abs(wm.bot - 565) < 6 && wa.n > 1000 && w3.top >= 536 && w3.bot <= 544);
      });
      while (L.fx?.length) delFX(L, 0); for (const k of Object.keys(L.keys)) if (k.startsWith('fx')) delete L.keys[k];
      const bad = Object.keys(want).filter(k => !want[k]);
      step('audio30Details', { ...V, errs, bad, works: !bad.length && !errs.length && Object.keys(want).length === 6 });
      const grp = n => [...document.querySelectorAll('#fx-add optgroup')].find(g => g.label === n);
      step('audio30Menu', { generate: grp('Generate')?.children.length, works: ids.every(id => grp('Generate')?.querySelector(`option[value=${id}]`)) });
      // speed at 1 s into the layer, each frame after the first
      const r30speed = {};
      for (const id of ids) {
        f = await only(id); f.audioLayer = A.id; draw(1); ctx.getImageData(0, 0, 1, 1);
        const t0 = performance.now(); for (let i = 1; i <= 5; i++) draw(1 + i / 30); ctx.getImageData(0, 0, 1, 1); r30speed[id] = +((performance.now() - t0) / 5).toFixed(1);
      }
      while (L.fx?.length) delFX(L, 0); for (const k of Object.keys(L.keys)) if (k.startsWith('fx')) delete L.keys[k];
      S.layers = S.layers.filter(x => x !== A); delete RT[A?.id]; draw();
      step('round30speed', r30speed);
    }
