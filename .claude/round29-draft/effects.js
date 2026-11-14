  // ---- Round 29: Utility & Text (EffectCraft's utility.rs, utility2.rs, ocio/ (Color Profile Converter) and textfx.rs:
  //      Grow Bounds, CC Overbrights, HDR Highlight Compression, HDR Compander, Cineon Converter, Color Profile
  //      Converter, Apply Color LUT, Numbers, Timecode) ----
  // Lumina's effects work on the whole frame, so Grow Bounds has nothing to pad; it widens the layer's box that the
  // effects filling it (generators, Numbers, Timecode) are cut to, as EffectCraft's padded buffer does
  growbounds: { name: 'Grow Bounds', cat: 'Utility', kernels: [], params: [
      { id: 'pixels', label: 'Pixels', def: 0, min: 0, max: 4000, dec: 0 }],
    run(E, img, q) { E.grow = (E.grow || 0) + Math.max(0, Math.round(q('pixels'))); return img; } },
  ccoverbrights: { name: 'CC Overbrights', cat: 'Utility', kernels: UTIL_K, params: [
      { id: 'channel', label: 'Channel', type: 'pick', def: 0, opts: fxOpts(['Max RGB', 'Red', 'Green', 'Blue', 'Alpha', 'Luminance']) },
      { id: 'highlightColor', label: 'Highlight color', type: 'color', def: '#ff0000' }],
    run: (E, img, q) => E.run('lumina_util', 'lu_point', fxP({ 0: [0, q('channel'), 0, 0] }, { 0: [...q('highlightColor'), 0] }), img) },
  hdrcompression: { name: 'HDR Highlight Compression', cat: 'Utility', kernels: UTIL_K, params: [
      { id: 'amount', label: 'Amount', def: 100, min: 0, max: 100, dec: 1 }],
    run(E, img, q) {
      const t = clamp(q('amount') / 100, 0, 1);
      return t > 0 ? E.run('lumina_util', 'lu_point', fxP({ 0: [1, 0, 0, 0] }, { 0: [t, 0, 0, 0] }), img) : img;
    } },
  hdrcompander: { name: 'HDR Compander', cat: 'Utility', kernels: UTIL_K, params: [
      { id: 'mode', label: 'Mode', type: 'pick', def: 0, opts: fxOpts(['Compress range', 'Expand range']) },
      { id: 'gain', label: 'Gain', def: 1, min: 1, max: 100, dec: 2 },
      { id: 'gamma', label: 'Gamma', def: 1, min: .1, max: 10, dec: 2 }],
    run(E, img, q) {
      const gain = Math.max(1e-6, q('gain')), gamma = Math.max(1e-3, q('gamma'));
      return gain === 1 && gamma === 1 ? img : E.run('lumina_util', 'lu_point', fxP({ 0: [2, q('mode'), 0, 0] }, { 0: [gain, gamma, 0, 0] }), img);
    } },
  cineon: { name: 'Cineon Converter', cat: 'Utility', kernels: UTIL_K, params: [
      { id: 'conversion', label: 'Conversion type', type: 'pick', def: 1, opts: fxOpts(['Linear to log', 'Log to linear', 'Log to log']) },
      { id: 'black10', label: '10 bit black point', def: 95, min: 0, max: 1023, dec: 0 },
      { id: 'blackIn', label: 'Internal black point', def: 0, min: -1, max: 2, dec: 3 },
      { id: 'white10', label: '10 bit white point', def: 685, min: 0, max: 1023, dec: 0 },
      { id: 'whiteIn', label: 'Internal white point', def: 1, min: -1, max: 2, dec: 3 },
      { id: 'gamma', label: 'Gamma', def: 1.7, min: .1, max: 5, dec: 2 },
      { id: 'rolloff', label: 'Highlight rolloff', def: 20, min: 0, max: 100, dec: 0 }],
    run: (E, img, q) => E.run('lumina_util', 'lu_point', fxP({ 0: [3, q('conversion'), 0, 0] },
      { 0: [q('black10'), q('white10'), q('blackIn'), q('whiteIn')], 1: [q('gamma'), q('rolloff'), 0, 0] }), img) },
  // EffectCraft's built-in profiles share a zero black point and none is scene-referred, so its last two settings are
  // kept as it keeps them, and change nothing
  colorprofile: { name: 'Color Profile Converter', cat: 'Utility', kernels: LUT_K, params: [
      { id: 'inputProfile', label: 'Input profile', type: 'pick', def: 0, opts: fxOpts(CP_PROFILES.map(p => p[0])) },
      { id: 'linearizeIn', label: 'Linearize input profile', type: 'check', def: false },
      { id: 'outputProfile', label: 'Output profile', type: 'pick', def: 1, opts: fxOpts(CP_PROFILES.map(p => p[0])) },
      { id: 'linearizeOut', label: 'Linearize output profile', type: 'check', def: false },
      { id: 'intent', label: 'Intent', type: 'pick', def: 1, opts: fxOpts(['Perceptual', 'Relative colorimetric', 'Saturation', 'Absolute colorimetric']) },
      { id: 'blackPointComp', label: 'Use black point compensation', type: 'check', def: true },
      { id: 'sceneRef', label: 'Scene-ref. profile compensation', type: 'pick', def: 2, opts: fxOpts(['On', 'Off', 'Use project setting']) }],
    run(E, img, q) {
      const d = cpProgram(q);
      return d ? E.run('fx_color', 'fxl_point', fxP({ 0: [0, 0, 0, 0] }), img, null, null, E.data(d)) : img;
    } },
  // the LUT menu lists Lumina's looks and the .cube files loaded so far (1D, 3D or both), and loads another
  applylut: { name: 'Apply Color LUT', cat: 'Utility', kernels: LUT_K, params: [
      { id: 'lut', label: 'LUT', type: 'pick', str: true, def: '', opts: () => [...lutOpts(true), ['__load', 'Load .cube file…']] }],
    run(E, img, q) {
      const l = LUTS[q('lut')];
      return l && (l.N > 1 || l.n1 > 1) ? E.run('fx_color', 'fxl_point', fxP({ 0: [1, 0, 0, 0] }), img, null, null, E.data(lutProgram(l))) : img;
    } },
  numbers: { name: 'Numbers', cat: 'Text', clip: true, kernels: TEXT_K, params: [
      { id: 'type', label: 'Type', type: 'pick', def: 0, opts: fxOpts(['Number', 'Number [leading zeros]', 'Timecode [30]', 'Timecode [25]', 'Timecode [24]', 'Time',
        'Numerical date', 'Short date', 'Long date', 'Hexadecimal']) },
      { id: 'random', label: 'Random values', type: 'check', def: false },
      { id: 'value', label: 'Value/offset/random max', def: 0, min: -30000, max: 30000, dec: 3 },
      { id: 'decimals', label: 'Decimal places', def: 2, min: 0, max: 10, dec: 0 },
      { id: 'currentTime', label: 'Current time/date', type: 'check', def: false },
      { id: 'position', label: 'Position', type: 'pt', def: [.5, .5] },
      { id: 'display', label: 'Display options', type: 'pick', def: 0, opts: fxOpts(['Fill only', 'Stroke only', 'Fill over stroke', 'Stroke over fill']) },
      { id: 'fillColor', label: 'Fill color', type: 'color', def: '#ff0000' },
      { id: 'strokeColor', label: 'Stroke color', type: 'color', def: '#ffffff' },
      { id: 'strokeWidth', label: 'Stroke width', def: 2, min: 0, max: 50, dec: 1 },
      { id: 'size', label: 'Size', def: 36, min: 0, max: 512, dec: 1 },
      { id: 'tracking', label: 'Tracking', def: 0, min: -100, max: 100, dec: 1 },
      { id: 'proportional', label: 'Proportional spacing', type: 'check', def: true },
      { id: 'onOriginal', label: 'Composite on original', type: 'check', def: true }],
    run(E, img, q) {
      const text = txNumbers(q, E.t, fxSeed(E)), size = Math.max(.5, q('size') * E.sc), tracking = q('tracking') * E.sc, prop = q('proportional'), [px, py] = q('position');
      const w = txLineWidth(text, size, tracking, prop), polys = txLayout(text, [px - w * .5, py + txUnit(size) * 3], size, tracking, prop);
      const display = q('display'), sw = Math.max(0, q('strokeWidth') * E.sc), r = txWeight(size), { cov, inner } = txCoverage(E, img, polys, r, display ? sw : 0);
      return E.run('fx_gen2', 'fg2_text', fxP({ 0: [display, q('onOriginal') ? 1 : 0, display && sw > 0 ? 1 : 0, inner ? 1 : 0] },
        { 0: [...q('fillColor'), 1], 1: [...q('strokeColor'), 1], 2: [1, 0, 0, 0] }), img, cov);
    } },
  timecode: { name: 'Timecode', cat: 'Text', clip: true, kernels: TEXT_K, params: [
      { id: 'format', label: 'Display format', type: 'pick', def: 0, opts: fxOpts(['SMPTE HH:MM:SS:FF', 'Frames', 'Feet + frames (35mm)', 'Feet + frames (16mm)']) },
      { id: 'source', label: 'Time source', type: 'pick', def: 0, opts: fxOpts(['Layer source', 'Composition', 'Custom']) },
      { id: 'units', label: 'Time units', def: 30, min: 1, max: 120, dec: 2 },
      { id: 'dropFrame', label: 'Drop frame', type: 'check', def: false },
      { id: 'startFrame', label: 'Starting frame', def: 0, min: -1000000, max: 1000000, dec: 0 },
      { id: 'textPos', label: 'Text position', type: 'pt', def: [.5, .9] },
      { id: 'textSize', label: 'Text size', def: 36, min: 0, max: 512, dec: 1 },
      { id: 'textColor', label: 'Text color', type: 'color', def: '#ffffff' },
      { id: 'showBox', label: 'Show box', type: 'check', def: true },
      { id: 'boxColor', label: 'Box color', type: 'color', def: '#000000' },
      { id: 'opacity', label: 'Opacity', def: 100, min: 0, max: 100, dec: 1 },
      { id: 'onOriginal', label: 'Composite on original', type: 'check', def: true }],
    run(E, img, q) {
      const src = q('source'), t = src === 1 ? E.T : E.t, fps = src === 2 ? Math.max(1, q('units')) : S.fps;
      let frame = Math.floor(t * fps + 1e-6); if (src === 2) frame += Math.round(q('startFrame'));
      const nominal = Math.round(fps), fmt = q('format'), p2 = v => String(v).padStart(2, '0');
      const fe = n => `${Math.floor(frame / n)}+${p2(((frame % n) + n) % n)}`;
      const text = fmt === 1 ? String(frame) : fmt === 2 ? fe(16) : fmt === 3 ? fe(40)
        : q('dropFrame') && (nominal === 30 || nominal === 60) ? txDropFrame(frame, nominal) : txTimecode(frame, fps);
      const size = Math.max(.5, q('textSize') * E.sc), [px, py] = q('textPos'), w = txLineWidth(text, size, 0, false), op = q('opacity') / 100, pad = size * .25;
      const { cov } = txCoverage(E, img, txLayout(text, [px - w * .5, py + txUnit(size) * 3], size, 0, false), txWeight(size), 0);
      return E.run('fx_text', 'ftx_text', fxP({ 0: [0, q('onOriginal') ? 1 : 0, q('showBox') ? 1 : 0, 0] },
        { 0: [...q('textColor'), op], 1: [0, 0, 0, 0], 2: [px - w * .5 - pad, px + w * .5 + pad, py - size * .5, py + size * .5], 3: [...q('boxColor'), op] }), img, cov);
    } },
