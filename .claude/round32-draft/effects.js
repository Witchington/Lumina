  // ---- Round 32: 3D Camera Tracker (EffectCraft's crates/effects/src/camera_tracker.rs; the analysis of
  //      track/src/camtrack runs in workers/camtrack.js). Applying it starts the analysis in the background: step 1
  //      tracks features through the layer, step 2 solves the camera. Changing Shot Type, Angle of View, Solve Method or
  //      deleting points solves again without tracking again. The effect passes its input through (undistorted with
  //      Undistort Footage); Render Track Points draws the solved points into the frame.
  cameratracker: { name: '3D Camera Tracker', cat: 'Perspective', kernels: CT_K, params: [
      { id: 'analyze', type: 'btn', text: f => CT.job?.f === f || CT.want?.f === f ? 'Cancel' : 'Analyze', label: ctStatus,
        act(L, f) { if (CT.job?.f === f || CT.want?.f === f) ctCancel(f); else ctAnalyze(L, f); } },
      { id: 'pick', type: 'btn', text: f => CT.tool?.uid === f.uid ? 'Done' : 'Select track points', label: f => {
          const n = CT.sel.uid === f.uid ? CT.sel.ids.size : 0;
          return CT.tool?.uid === f.uid ? `Selecting points (${n}): click inside three, drag a box; right-click to create` : n ? `${n} track points selected` : 'Track points'; },
        act(L, f) { CT.tool?.uid === f.uid ? ctToolEnd() : ctTool(L, f); } },
      { id: 'createText', type: 'btn', text: 'Create Text', label: 'On the selected points', act(L, f) { ctCreate(L, f, 'text', false); } },
      { id: 'createSolid', type: 'btn', text: 'Create Solid', label: 'On the selected points', act(L, f) { ctCreate(L, f, 'solid', false); } },
      { id: 'deletePoints', type: 'btn', text: 'Delete Selected Points', label: f => `Deleted points: ${new Set(f.deleted || []).size}`, act(L, f) { ctDeletePoints(L, f); } },
      { id: 'shotType', label: 'Shot type', type: 'pick', def: 0, opts: [[0, 'Fixed Angle of View'], [1, 'Variable Zoom'], [2, 'Specify Angle of View']] },
      { id: 'hfov', label: 'Horizontal angle of view°', def: 40, min: 1, max: 170, dec: 1 },
      { id: 'showPoints', label: 'Show track points', type: 'pick', def: 1, opts: [[0, '2D Source'], [1, '3D Solved']] },
      { id: 'renderPoints', label: 'Render track points', type: 'check', def: false },
      { id: 'pointSize', label: 'Track point size %', def: 100, min: 0, max: 1000, dec: 0 },
      { id: 'targetSize', label: 'Target size %', def: 100, min: 1, max: 1000, dec: 0 },
      { id: 'solveMethod', label: 'Solve method', type: 'pick', def: 0, opts: [[0, 'Auto Detect'], [1, 'Typical'], [2, 'Mostly Flat Scene'], [3, 'Tripod Pan']] },
      { id: 'detailed', label: 'Detailed analysis', type: 'check', def: false },
      { id: 'lensDistortion', label: 'Solve lens distortion', type: 'check', def: false },
      { id: 'undistort', label: 'Undistort footage', type: 'check', def: false },
      { id: 'autoDelete', label: 'Auto-delete points across time', type: 'check', def: true },
      { id: 'hideWarning', label: 'Hide warning banner', type: 'check', def: false }],
    run(E, img, q) {
      const f = E.fx, L = E.L, G = rotoGrid(E); if (!G) return img;
      // grab mode (the worker wants this frame's input): read it and stop
      if (CT.grab?.uid === f.uid) { CT.grab.out = rotoRead(E, img, G); E.stop = true; return img; }
      const [lo, hi] = rotoLimits(L), detailed = !!q('detailed'), tk = ctTracksKey(E, G, detailed, lo, hi), st = ctSettings(f, q), sk = ctSolveKey(tk, st);
      const job = { L, f, tk, sk, st, G, detailed, lo, hi };
      if (E.depth === 0) CT.last[f.uid] = job;
      const sol = CT.solves.get(sk);
      if (!sol && !CT.fail.has(sk) && !CT.cancelled.has(tk) && hi >= lo) ctWant(job);
      if (!sol || Math.abs(sol.size[0] - G.bw) > .5 || Math.abs(sol.size[1] - G.bh) > .5) return img;
      const und = !!q('undistort') && !ctDistNone(sol.distortion);
      if (und) img = ctUndistortRun(E, img, G, sol.distortion);
      if (q('renderPoints')) img = ctRenderPoints(E, img, sol, ctFrameIdx(sol, L, E.T), und, q('pointSize'));
      return img;
    } },
  // Lumina's own: a layer made on a 3D Camera Tracker target (Create Text / Create Solid) lies on the target's plane,
  // seen through the solved camera on every frame (until Lumina has 3D camera layers, After Effects Round A8). The
  // layer's own box is pinned to the target, like Corner Pin.
  campin: { name: 'Camera Track Pin', cat: 'Perspective', kernels: WARP_K, params: [
      { id: 'source', type: 'btn', text: 'Select the tracked layer', label: f => { const L = f.pin && byId(f.pin.lid); return L ? `Follows the 3D Camera Tracker on “${L.name}”` : 'Not pinned: make it with the 3D Camera Tracker’s Create Text or Create Solid'; },
        act(L, f) { const s = f.pin && byId(f.pin.lid); if (s) { S.sel = s.id; refresh(); } } },
      { id: 'pinSize', label: 'Size %', def: 100, min: 1, max: 1000, dec: 1 }],
    run(E, img, q) {
      if (!E.fx.pin) return img;
      const quad = ctPinQuad(E.fx.pin, E, q('pinSize') / 100);
      if (quad === undefined) return img;       // no solve yet: the layer as it is
      if (!quad) return E.clear(img);           // behind the camera
      const toUnit = m3mul(m3mul(m3s(1 / E.bw, 1 / E.bh), m3t(E.bw / 2, E.bh / 2)), m3inv(m3of(E.m)) || m3t(0, 0));
      return fxWarp(E, img, m3mul(m3quad(quad), toUnit));
    } },
