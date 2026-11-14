  // ---- Round 30: Audio-driven (EffectCraft's generate3/audio.rs; marks drawn by fx_gen2's fg2_segs and fg2_marks) ----
  audiospectrum: { name: 'Audio Spectrum', cat: 'Generate', clip: true, audio: true, kernels: AUDIO_K, params: [...AU_HEAD,
      { id: 'startFreq', label: 'Start frequency', def: 20, min: 1, max: 20000, dec: 0 },
      { id: 'endFreq', label: 'End frequency', def: 2000, min: 1, max: 20000, dec: 0 },
      { id: 'bands', label: 'Frequency bands', def: 64, min: 1, max: 4096, dec: 0 },
      { id: 'maxHeight', label: 'Maximum height', def: 50, min: 0, max: 10000, dec: 1 },
      { id: 'duration', label: 'Audio duration (milliseconds)', def: 90, min: 1, max: 30000, dec: 1 },
      { id: 'offset', label: 'Audio offset (milliseconds)', def: 0, min: -30000, max: 30000, dec: 1 },
      { id: 'thickness', label: 'Thickness', def: 3, min: 0, max: 1000, dec: 2 },
      { id: 'softness', label: 'Softness', def: 50, min: 0, max: 100, dec: 1 },
      { id: 'insideColor', label: 'Inside color', type: 'color', def: '#ffffff' },
      { id: 'outsideColor', label: 'Outside color', type: 'color', def: '#3366ff' },
      { id: 'display', label: 'Display options', type: 'pick', def: 0, opts: AU_DISPLAY },
      { id: 'side', label: 'Side options', type: 'pick', def: 0, opts: fxOpts(['Side A', 'Side B', 'Side A & B']) },
      { id: 'onOriginal', label: 'Composite on original', type: 'check', def: false }],
    // spectrum_plan: one band per step from Start to End Frequency, its height from the FFT magnitude there
    run(E, img, q) {
      const x = auWindow(E, q('audioLayer'), q('duration'), q('offset'), 0); if (!x) return img;
      const { hz, mags } = auMags(x), maxBin = mags.length - 1;
      const bands = clamp(Math.round(q('bands')), 1, 4096), f0 = Math.max(0, q('startFreq')), f1 = Math.max(q('endFreq'), f0 + 1);
      const band = fc => { const kf = clamp(fc / hz, 0, maxBin), k0 = Math.min(Math.floor(kf), Math.max(0, maxBin - 1)), k1 = Math.min(k0 + 1, maxBin), fr = clamp(kf - k0, 0, 1); return mags[k0] * (1 - fr) + mags[k1] * fr; };
      const maxH = q('maxHeight') * E.sc, thick = Math.max(.1, q('thickness') * E.sc), r = thick * .5, soft = q('softness') / 100 * 2;
      const disp = q('display'), side = q('side'), base = auBaseline(E, q), segs = [], tops = [];
      for (let i = 0; i < bands; i++) {
        const u = bands > 1 ? i / (bands - 1) : .5, v = band(f0 + (f1 - f0) * u), hv = v * maxH, h = Number.isFinite(hv) ? clamp(hv, 0, Math.max(0, maxH)) : 0;
        const [p, nr] = base.at(u), [ua, ub] = side === 0 ? [0, h] : side === 1 ? [-h, 0] : [-h, h];
        const pa = [p[0] + nr[0] * ua, p[1] + nr[1] * ua], pb = [p[0] + nr[0] * ub, p[1] + nr[1] * ub];
        if (disp === 0) segs.push([pa[0], pa[1], pb[0], pb[1], r, 1]); else tops.push([pa, pb]);
      }
      if (disp === 1) for (let i = 1; i < tops.length; i++) {
        const [a0, b0] = tops[i - 1], [a1, b1] = tops[i];
        segs.push([b0[0], b0[1], b1[0], b1[1], r, 1]); if (side === 2) segs.push([a0[0], a0[1], a1[0], a1[1], r, 1]);
      } else if (disp === 2) for (const [pa, pb] of tops) {
        segs.push([pb[0], pb[1], pb[0], pb[1], r, 1]); if (side === 2) segs.push([pa[0], pa[1], pa[0], pa[1], r, 1]);
      }
      return auMarks(E, img, q, segs, thick, soft);
    } },
  audiowaveform: { name: 'Audio Waveform', cat: 'Generate', clip: true, audio: true, kernels: AUDIO_K, params: [...AU_HEAD,
      { id: 'samples', label: 'Displayed samples', def: 200, min: 2, max: 4096, dec: 0 },
      { id: 'maxHeight', label: 'Maximum height', def: 100, min: 0, max: 10000, dec: 1 },
      { id: 'duration', label: 'Audio duration (milliseconds)', def: 200, min: 1, max: 30000, dec: 1 },
      { id: 'offset', label: 'Audio offset (milliseconds)', def: 0, min: -30000, max: 30000, dec: 1 },
      { id: 'thickness', label: 'Thickness', def: 2, min: 0, max: 1000, dec: 2 },
      { id: 'softness', label: 'Softness', def: 10, min: 0, max: 100, dec: 1 },
      { id: 'insideColor', label: 'Inside color', type: 'color', def: '#ffffff' },
      { id: 'outsideColor', label: 'Outside color', type: 'color', def: '#3366ff' },
      { id: 'channel', label: 'Waveform options', type: 'pick', def: 0, opts: fxOpts(['Mono', 'Left', 'Right']) },
      { id: 'display', label: 'Display options', type: 'pick', def: 1, opts: AU_DISPLAY },
      { id: 'onOriginal', label: 'Composite on original', type: 'check', def: false }],
    // waveform_plan: Digital draws each step's low-to-high peak, Analog joins (or dots) the first sample of each step
    run(E, img, q) {
      const x = auWindow(E, q('audioLayer'), q('duration'), q('offset'), q('channel')); if (!x) return img;
      const n = clamp(Math.round(q('samples')), 2, 4096), maxH = q('maxHeight') * E.sc, thick = Math.max(.1, q('thickness') * E.sc), r = thick * .5, soft = q('softness') / 100 * 2;
      const disp = q('display'), base = auBaseline(E, q), m = x.length, segs = [], pts = [];
      for (let i = 0; i < n; i++) {
        const u = i / (n - 1), a = Math.min(Math.floor(u * (m - 1)), m - 1), bn = clamp(Math.floor((i + 1) / n * (m - 1)), a, m - 1);
        const [p, nr] = base.at(u);
        if (disp === 0) {
          let lo = 0, hi = 0; for (let k = a; k <= bn; k++) { lo = Math.min(lo, x[k]); hi = Math.max(hi, x[k]); }
          segs.push([p[0] + nr[0] * lo * maxH, p[1] + nr[1] * lo * maxH, p[0] + nr[0] * hi * maxH, p[1] + nr[1] * hi * maxH, r, 1]);
        } else { const v = x[a] * maxH; pts.push([p[0] + nr[0] * v, p[1] + nr[1] * v]); }
      }
      if (disp === 1) fxPolySegs(pts, false, r, 1, segs); else if (disp === 2) for (const p of pts) segs.push([p[0], p[1], p[0], p[1], r, 1]);
      return auMarks(E, img, q, segs, thick, soft);
    } },
