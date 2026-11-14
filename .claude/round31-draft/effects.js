  // ---- Round 31: Roto Brush & Refine Edge (EffectCraft's crates/effects/src/roto.rs; the classic engine of
  //      track/src/roto.rs, run in workers/roto.js). Paint over the object on the preview (the Roto Brush tool); the
  //      first stroke sets the base frame and a span of 20 frames each side, and each frame's matte is carried on from
  //      its neighbour towards the base. Outside the span the layer is see-through; with no strokes it passes through.
  rotobrush: { name: 'Roto Brush & Refine Edge', cat: 'Matte', kernels: ROTO_K, params: [
      { id: 'tool', type: 'btn', text: 'Paint on the preview', label: f => ROTO.tool?.uid === f.uid && ROTO.tool.mode === 'roto' ? 'Roto Brush: painting (Esc ends)' : 'Roto Brush tool',
        act(L, f) { rotoTool(L, f, 'roto'); } },
      { id: 'refineTool', type: 'btn', text: 'Paint soft edges', label: f => ROTO.tool?.uid === f.uid && ROTO.tool.mode === 'refine' ? 'Refine Edge: painting (Esc ends)' : 'Refine Edge tool',
        act(L, f) { rotoTool(L, f, 'refine'); } },
      { id: 'spanStart', type: 'btn', text: 'Start at playhead', label: f => rotoEmpty(f.roto) ? 'Span: paint a stroke first' : `Span: layer frames ${f.roto.span[0]}–${f.roto.span[1]} (base frame ${f.roto.base})`,
        act(L, f) { rotoSetSpan(L, f, 0); } },
      { id: 'spanEnd', type: 'btn', text: 'End at playhead', label: 'Span end', act(L, f) { rotoSetSpan(L, f, 1); } },
      { id: 'propagate', type: 'btn', text: 'Work out every frame', label: 'Frames in the span', act(L, f) { rotoPropagate(L, f); } },
      { id: 'freeze', type: 'btn', text: f => f.frozen ? 'Unfreeze' : 'Freeze', label: f => f.frozen ? 'Frozen: the mattes are kept in the project' : 'Freeze the mattes',
        act(L, f) { if (f.frozen) { f.frozen = null; commit(); inspector(); } else rotoFreeze(L, f); } },
      { id: 'clearStrokes', type: 'btn', text: 'Remove all strokes', label: f => `Strokes: ${f.roto?.strokes?.length || 0}`,
        act(L, f) { if (f.frozen) return toast('This Roto Brush is frozen. Unfreeze it first.'); f.roto = null; commit(); inspector(); } },
      { id: 'quality', label: 'Quality', type: 'pick', def: 0, opts: [[0, 'Standard'], [1, 'Best']] },
      { id: 'searchRadius', label: 'Search radius', def: 15, min: 0, max: 100, dec: 1 },
      { id: 'motionThreshold', label: 'Motion threshold', def: 10, min: 0, max: 100, dec: 0 },
      { id: 'motionDamping', label: 'Motion damping', def: 20, min: 0, max: 100, dec: 0 },
      { id: 'viewSearch', label: 'View search region', type: 'check', def: false },
      { id: 'rbFeather', label: 'Roto Brush matte: feather', def: 0, min: 0, max: 100, dec: 1 },
      { id: 'rbContrast', label: 'Roto Brush matte: contrast', def: 0, min: 0, max: 100, dec: 0 },
      { id: 'rbShift', label: 'Roto Brush matte: shift edge', def: 0, min: -100, max: 100, dec: 0 },
      { id: 'rbChatter', label: 'Roto Brush matte: reduce chatter', def: 0, min: 0, max: 100, dec: 0 },
      { id: 'smooth', label: 'Refine Edge: smooth', def: 1, min: 0, max: 100, dec: 1 },
      { id: 'reFeather', label: 'Refine Edge: feather', def: 0, min: 0, max: 100, dec: 1 },
      { id: 'reContrast', label: 'Refine Edge: contrast', def: 0, min: 0, max: 100, dec: 0 },
      { id: 'reShift', label: 'Refine Edge: shift edge', def: 0, min: -100, max: 100, dec: 0 },
      { id: 'reChatter', label: 'Refine Edge: reduce chatter', def: 0, min: 0, max: 100, dec: 0 },
      { id: 'motionBlur', label: 'Use motion blur', type: 'check', def: false },
      { id: 'mbSamples', label: 'Motion blur samples', def: 11, min: 1, max: 64, dec: 0 },
      { id: 'shutterAngle', label: 'Shutter angle', def: 180, min: 0, max: 720, dec: 0 },
      { id: 'higherQuality', label: 'Higher quality', type: 'check', def: true },
      { id: 'decontaminate', label: 'Decontaminate edge colors', type: 'check', def: true },
      { id: 'deconAmount', label: 'Decontamination amount', def: 100, min: 0, max: 100, dec: 0 },
      { id: 'extendSmoothed', label: 'Extend where smoothed', type: 'check', def: true },
      { id: 'deconRadius', label: 'Increase decontamination radius', def: 0, min: 0, max: 100, dec: 1 },
      { id: 'viewMap', label: 'View decontamination map', type: 'check', def: false }],
    run(E, img, q) {
      const f = E.fx, L = E.L, G = rotoGrid(E); if (!G) return img;
      // grab mode (the worker wants this frame's input): read it and stop
      if (ROTO.grab?.uid === f.uid) { ROTO.grab.out = rotoRead(E, img, G); E.stop = true; return img; }
      const d = f.roto, plan = ROTO.plan?.uid === f.uid ? ROTO.plan : null;
      if (rotoEmpty(d)) { if (plan) E.stop = true; return img; }
      const g = rotoFrame(L, E.T), tool = !plan && E.depth === 0 && ROTO.tool?.uid === f.uid && !ROTO.tool.result;
      if (!rotoInSpan(d, g)) { if (plan) E.stop = true; return tool ? img : E.clear(img); }
      const C = rotoChain(E, q, f, G), mp = rotoMP(q), fk = rotoFinalKey(C, g, mp), frozen = f.frozen ? rotoFrozenAt(f, C, mp, g, G) : null;
      const job = { L, f, g, C, G, mp, fk: frozen ? 'F' + fk : fk, final: !tool, frozen };
      if (plan) { Object.assign(job, { final: plan.final, band: plan.band }); plan.job = job; E.stop = true; return img; }
      if (E.depth === 0) ROTO.last[f.uid] = job;
      // painting: the whole layer, with the matte's edge drawn over it on the preview
      if (tool) { rotoWant(job); return img; }
      let fin = rotoLru(ROTO.final, job.fk);
      if (!fin && frozen && !mp.decontaminate) fin = { key: job.fk, w: G.gw, h: G.gh, a8: frozen.a, idx: new Uint32Array(0), col: new Uint8Array(0), map: new Uint8Array(0) };
      if (!fin) { rotoWant(job); return img; }
      return rotoApply(E, img, G, fin, q('viewMap'), mp.decontaminate);
    } },
