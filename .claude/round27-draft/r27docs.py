import io
def edit(p, pairs):
    raw = io.open(p, 'rb').read(); crlf = b'\r\n' in raw
    s = raw.decode('utf-8').replace('\r\n', '\n')
    for a, b in pairs:
        assert s.count(a) == 1, (p, a[:80], s.count(a)); s = s.replace(a, b)
    if crlf: s = s.replace('\n', '\r\n')
    io.open(p, 'wb').write(s.encode('utf-8'))

edit(r'D:\Lumina\WORKPLAN.md', [("| 27 | Simulation: weather and more |", "| 27 ✅ | Simulation: weather and more |")])

edit(r'D:\Lumina\ROADMAP.md', [
 ("## ▶ Start here next: Round 27 (Simulation: weather and more) (Round 26 done 2026-11-13); Round 26 and the Claude control steps M1–M4 are done",
  "## ▶ Start here next: Round 28 (Simulation: pieces and surfaces) (Round 27 done 2026-11-13); Round 27 and the Claude control steps M1–M4 are done"),
 ("Round 26 is committed (2026-11-13; all twelve suites as before).", "Round 27 is committed (2026-11-13; all twelve suites as before)."),
 ("""Rounds 8–26 and the Round 6 leftovers are done. **Round 27 is next, Simulation: weather and more** (WORKPLAN.md's
round table): CC Rainfall, CC Snowfall, CC Bubbles, CC Drizzle, CC Star Burst (EffectCraft's crates/effects/src/sim/
weather.rs; closed-form, every frame on its own), CC Hair and Particle Playground (sim3.rs). Their GPU host code is in
crates/gpu/src/fx_sim.rs (rainfall/snowfall/star burst/hair go through `sprite_plan` and fx_sim's `sprites`; bubbles,
drizzle have their own fxm_ kernels) and fx_particles.rs (playground). The Round 26 source is in the scratchpad's ec26
folder (sim/*.rs, sim2/*.rs, sim3.rs, gpu fx_sim.rs / fx_particles.rs / particles.rs). Lumina's own Rain and Snow
(Atmosphere) are separate from these. Round 28 is the sim2 effects. Round 26's helpers:""",
  """Rounds 8–27 and the Round 6 leftovers are done. **Round 28 is next, Simulation: pieces and surfaces** (WORKPLAN.md's
round table): CC Ball Action, CC Pixel Polly, CC Scatterize, Card Dance, Shatter (EffectCraft's crates/effects/src/sim2/
pieces.rs, shatter.rs, pixels.rs: piece plans), Caustics, Wave World (sim2/surfaces.rs) and Foam (sim2/foam.rs). Their GPU
host code is in crates/gpu/src/fx_sim.rs (`pieces` / `piece_pass` through fxm_raster's kind 3 and fxm_piece, `caustics`,
`wave_height`, Wave World's wireframe as sprites) and fx_particles.rs (`foam`). The source is already in the scratchpad's
ec26 folder (eff_sim2_*.rs, gpu_fx_sim.rs, gpu_fx_particles.rs); Card Dance's 3D maths may reuse Round 23's card3d
helpers (`fxRotOrdered`, `fxCardCam`). Round 27's helpers: `fxSpriteTable(E, img, R, n, stride, add)` (many sprites from a
typed table, binned on the CPU in one go and drawn by fxp_raster in as many passes as needed), `fxPutSprite` (one sprite
record with its bounds; stride 16 plain, 18 with a sampled tint, 24 with CC Hair's root tint), `fxScratch` (reused work
arrays), `fxSpritePost` (sim::Post through fxm_post), `fxLpOf(E)` (layer pixels → frame pixels with the matrix read
once: a DOMMatrix field is slow to read in a loop), `fxMapImg(E, id, name, T, max)` (sim3::MapImg: another layer stretched
over this one, read back to the CPU at time T, `.at(x, y)` and `.key`), `fxSimRun` (a generic SimCache), `fxSortF32`
(stable radix order), `fxGlyph` (textfx's stroke font, `STROKE_FONT`), `fxInPoly`, `fxWrap` / `fxDepthK` / `fxHs`; Lumina's
`lsm_blit` in shaders/lumina_sim.wgsl (Layer Map copies); `fxChunked` now takes a base picture to draw over. Round 26's helpers:"""),
 ("EffectCraft carries on at **Round 27 (Simulation: weather and more)**.", "EffectCraft carries on at **Round 28 (Simulation: pieces and surfaces)**."),
 ("""   **Where we left off: Rounds 1–26 and the Round 6 leftovers are done; Round 27 (Simulation: weather and more) is
   next.** About 69 effects are left, in Rounds 27–31+ (Reshape and Smear wait for Masks II, A7).""",
  """   **Where we left off: Rounds 1–27 and the Round 6 leftovers are done; Round 28 (Simulation: pieces and surfaces) is
   next.** About 62 effects are left, in Rounds 28–31+ (Reshape and Smear wait for Masks II, A7)."""),
 ("""- **EffectCraft Round 26 done (2026-11-13): Simulation, particles.**""",
  """- **EffectCraft Round 27 done (2026-11-13): Simulation, weather and more.** Seven more effects in the **Simulation**
  group (none was in Lumina before; Lumina's own Rain and Snow in Atmosphere stay as they are):
  - **CC Rainfall** and **CC Snowfall** (weather.rs): drops and flakes worked out fresh for every frame (nothing to step),
    nearer ones faster, bigger and stronger by Scene Depth; wind, variation, spread, Snowfall's wiggle; Rainfall's
    Refracting drops show the layer brightened behind them; Transfer Mode Composite or Lighten over the original, or the
    weather alone.
  - **CC Bubbles**: bubbles rising and wobbling, each showing the layer refracted (Liquid) or mirrored (Metal), five
    shading types; the bubbles replace the layer.
  - **CC Drizzle**: drops land at Drip Rate a second and spread rippling rings that bend and light the layer.
  - **CC Star Burst**: the layer as a grid of dots flying toward the viewer, far to near; Blend with Original.
  - **CC Hair**: strands grown over the layer, each six segments drooping with Weight (Constant Mass), coloured from
    their roots with Color Inheritance, shaded as hair; a hairfall map layer sets length and lean.
  - **Particle Playground** (sim3.rs): stepped from layer time 0 at 60 steps a second with checkpoints (scrubbing and
    playing give the same frame). Cannon, Grid and Layer Exploder; Gravity, Repel, Wall (the layer's mask), Persistent and
    Ephemeral Property Mappers (27 targets, 7 operators), Particle Exploder; every one with its Affects settings; Layer Map
    draws particles as copies of another layer at a time from its Time Offset Type; Cannon and Grid Text fire or place
    characters drawn with EffectCraft's stroke font. The particles replace the layer.
  - **How they are drawn:** on the graphics card with EffectCraft's kernels: fxp_raster for every sprite (in several
    passes when there are many), fxm_raster for the bubbles, fxm_drizzle, fxm_post for meeting the original. Layer Map
    copies are drawn by Lumina's own lsm_blit (shaders/lumina_sim.wgsl), the same arithmetic as EffectCraft's CPU
    blit_layer. Map layers are read back to the CPU at a reduced size (at most 640 pixels across, 960 for the Layer
    Exploder), as EffectCraft reads them on the CPU.
  - **Differences from EffectCraft:** Layer Map copies are drawn grouped by the moment they show (EffectCraft draws them in
    particle order), so where copies of different moments overlap the stacking can differ; Particle Playground always
    steps on the CPU (EffectCraft can hand a cannon-only set-up to its GPU particle backend; the results are the same).
  - **Speed** at 1080p, 3 s in: about 6 ms a frame for Rainfall, Snowfall, Bubbles, Drizzle and Particle Playground;
    CC Hair about 25 ms (20 000 strands); CC Star Burst about 45 ms (its default Grid Spacing of 2 is half a million dots;
    the grid is sorted once and reused, since its far-to-near order only turns round from frame to frame).
  - Host code fetched from EffectCraft's crates/effects/src (sim/weather.rs, sim3.rs, textfx.rs for the stroke font) and
    crates/gpu/src (fx_sim.rs, fx_particles.rs) with `gh api` into the scratchpad; nothing was downloaded or installed.
  - Test: the fx suite's sim27Kernels, sim27Details (rain over the layer, moving, the same moment twice the same; Soft Solid
    rain alone; snow, smaller when deeper, moving; bubbles replacing the layer and rising; Drizzle with no drips leaving the
    layer as it was; Star Burst fully blended giving the layer back; Hair with no length leaving the layer as it was; the
    playground's cannon, scrubbing, gravity, a 5 × 5 grid round the middle, Grid Text drawing a character, a Layer Map of a
    hidden green card), sim27Menu (10 Simulation effects) and round27speed. Round 26's simMenu now checks its own three.
- **EffectCraft Round 26 done (2026-11-13): Simulation, particles.**"""),
])
print('ok')
