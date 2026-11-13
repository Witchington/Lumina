import io
def edit(p, pairs):
    raw = io.open(p, 'rb').read(); crlf = b'\r\n' in raw
    s = raw.decode('utf-8').replace('\r\n', '\n')
    for a, b in pairs:
        assert s.count(a) == 1, (p, a[:80], s.count(a)); s = s.replace(a, b)
    if crlf: s = s.replace('\n', '\r\n')
    io.open(p, 'wb').write(s.encode('utf-8'))

edit(r'D:\Lumina\WORKPLAN.md', [("| 26–28 | Simulation | Particles (CC Particle World, Particle Systems II, Particle Playground), weather (Rainfall, Snowfall, Drizzle, Bubbles), Shatter, Card Dance, Caustics, Foam, Wave World, Ball Action, Hair, Mr. Mercury, Pixel Polly, Scatterize, Star Burst |",
"""| 26 ✅ | Simulation: particles | CC Particle World, CC Particle Systems II, CC Mr. Mercury (EffectCraft's sim/engine.rs, particle_fx.rs) |
| 27 | Simulation: weather and more | CC Rainfall, CC Snowfall, CC Bubbles, CC Drizzle, CC Star Burst (sim/weather.rs), CC Hair, Particle Playground (sim3.rs) |
| 28 | Simulation: pieces and surfaces | CC Ball Action, CC Pixel Polly, CC Scatterize, Card Dance, Shatter, Caustics, Wave World, Foam (sim2/) |""")])

edit(r'D:\Lumina\ROADMAP.md', [
 ("## ▶ Start here next: Round 26 (Simulation, first part) (Round 25 done 2026-11-11); Round 25 and the Claude control steps M1–M4 are done",
  "## ▶ Start here next: Round 27 (Simulation: weather and more) (Round 26 done 2026-11-13); Round 26 and the Claude control steps M1–M4 are done"),
 ("Round 25 is committed (2026-11-11; all twelve suites as before).", "Round 26 is committed (2026-11-13; all twelve suites as before)."),
 ("""Rounds 8–25 and the Round 6 leftovers are done. **Round 26 is next, Simulation (first part)** (WORKPLAN.md's round
table, Rounds 26–28): split the list into three Rounds first (particles; weather; Shatter, Card Dance, Caustics, Foam, Wave
World and the rest), and check which are already in Lumina. Find their host code in EffectCraft's crates/gpu/src (check
each file's `IDS` list; fetch with `gh api` at commit 3768ff4 into the scratchpad) and the CPU plans in
crates/effects/src. Round 25's helpers:""",
  """Rounds 8–26 and the Round 6 leftovers are done. **Round 27 is next, Simulation: weather and more** (WORKPLAN.md's
round table): CC Rainfall, CC Snowfall, CC Bubbles, CC Drizzle, CC Star Burst (EffectCraft's crates/effects/src/sim/
weather.rs; closed-form, every frame on its own), CC Hair and Particle Playground (sim3.rs). Their GPU host code is in
crates/gpu/src/fx_sim.rs (rainfall/snowfall/star burst/hair go through `sprite_plan` and fx_sim's `sprites`; bubbles,
drizzle have their own fxm_ kernels) and fx_particles.rs (playground). The Round 26 source is in the scratchpad's ec26
folder (sim/*.rs, sim2/*.rs, sim3.rs, gpu fx_sim.rs / fx_particles.rs / particles.rs). Lumina's own Rain and Snow
(Atmosphere) are separate from these. Round 28 is the sim2 effects. Round 26's helpers: `fxValueNoise` / `fxLattice`
(generate::value_noise), the stepped engine `fxPsSpawn` / `fxPsStep` / `fxPsRun` (SimCache checkpoints, `PS_CACHE`),
`fxPsRates` (rate_history), `fxPsState`, `fxPsLook` / `fxTypeSprite` / `fxSpriteBox` (sim::sprites), `fxSprites` (fx_sim's
sprite_layer through fxp_raster) and `fxChunked` (fx_particles' Chunked passes), `fxLp` / `fxLv` / `fxPl` (layer pixels
↔ frame pixels, Buf::to_px), the menus `PW_ANIMS`, `PARTICLE_TYPES`, `PS_TRANSFER`; Lumina's shaders/lumina_sim.wgsl
(`lsm_texsq`). The fx_particles family already holds fx_sim.wgsl (every fxm_ kernel). Round 25's helpers:"""),
 ("EffectCraft carries on at **Round 26 (Simulation, first part)**.", "EffectCraft carries on at **Round 27 (Simulation: weather and more)**."),
 ("""   **Where we left off: Rounds 1–25 and the Round 6 leftovers are done; Round 26 (Simulation) is next.** About 72
   effects are left, in Rounds 26–31+ (Reshape and Smear wait for Masks II, A7).""",
  """   **Where we left off: Rounds 1–26 and the Round 6 leftovers are done; Round 27 (Simulation: weather and more) is
   next.** About 69 effects are left, in Rounds 27–31+ (Reshape and Smear wait for Masks II, A7)."""),
 ("""- **EffectCraft Round 25 done (2026-11-11): Time.**""",
  """- **EffectCraft Round 26 done (2026-11-13): Simulation, particles.** A new **Simulation** group with **CC Particle
  World**, **CC Particle Systems II** and **CC Mr. Mercury** (none was in Lumina before). Simulation was split into three
  Rounds following EffectCraft's own files: 26 particles (sim/engine, particle_fx), 27 weather and more (sim/weather, sim3),
  28 pieces and surfaces (sim2).
  - **The particle engine** (sim/engine.rs, ported to JavaScript): particles are stepped from layer time 0 at 60 steps a
    second, with checkpoints every 15 steps (SimCache), so any frame can be drawn straight away and is the same frame
    playing or scrubbing reaches. Birth Rate can be keyframed: each step is born at the rate of its own time. All ten
    Animations (Explosive, Direction Axis, Cone Axis, Viscouse, Twirly, Vortex, Fire, Jet Sideways, Fractal Omni / Uni) and
    all nine Particle Types. The particles replace the layer, as in After Effects; Add adds them together.
  - **Drawing** is on the graphics card with EffectCraft's own kernels: fx_particles' fxp_raster (the sprites, in several
    passes when there are many) and fx_sim's fxm_raster + fxm_mercury (Mr. Mercury's blob field, then its lighting).
    CC Particle World's **Textured Square with a Texture Layer** is CPU-only in EffectCraft; Lumina draws it on the card
    with its own shaders/lumina_sim.wgsl (lsm_texsq), the same per-pixel arithmetic. Particles turn and scale with the
    layer, and points are kept in the layer's own pixels, so moving the layer doesn't restart the simulation.
  - **Not yet:** CC Particle World through a comp camera layer (Lumina has none until A8) and its motion-blur trails
    (until A3's motion blur); Inherit Velocity is there but, as in EffectCraft, does nothing yet.
  - Host code fetched from EffectCraft's crates/effects/src/sim* and crates/gpu/src (fx_sim, fx_particles, particles)
    with `gh api` into the scratchpad; nothing was downloaded or installed.
  - Speed at 1080p, 3 s in: about 6 ms a frame for each of the three.
  - Test: the fx suite's simKernels, simDetails (the engine: about 120 particles alive at 120 a second; falling ½ g t²
    within 2.5 %; resistance slowing them; checkpoints giving exactly the particles of a fresh run; a Birth Rate keyframed
    from 0 at 1 s draws nothing before 1 s; the drawn layer replaced; scrubbing and drawing from nothing give the same
    frame; the producer point moving the burst; gravity pulling it down; CC Particle World's camera distance shrinking the
    burst; Textured Square showing a hidden green layer; Mr. Mercury's blobs), simMenu and round26speed.
- **EffectCraft Round 25 done (2026-11-11): Time.**"""),
])
print('ok')
