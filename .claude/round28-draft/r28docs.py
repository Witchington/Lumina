import io
def edit(p, pairs):
    raw = io.open(p, 'rb').read(); crlf = b'\r\n' in raw
    s = raw.decode('utf-8').replace('\r\n', '\n')
    for a, b in pairs:
        assert s.count(a) == 1, (p, a[:80], s.count(a)); s = s.replace(a, b)
    if crlf: s = s.replace('\n', '\r\n')
    io.open(p, 'wb').write(s.encode('utf-8'))

edit(r'D:\Lumina\WORKPLAN.md', [("| 28 | Simulation: pieces and surfaces |", "| 28 ✅ | Simulation: pieces and surfaces |")])

ROADMAP = r'D:\Lumina\ROADMAP.md'
s = io.open(ROADMAP, encoding='utf-8').read()
a = s.index("Rounds 8–27 and the Round 6 leftovers are done. **Round 28 is next"); b = s.index("Round 27's helpers:", a)
OLD_BRIEF = s[a:b]
edit(ROADMAP, [
 ("## ▶ Start here next: Round 28 (Simulation: pieces and surfaces) (Round 27 done 2026-11-13); Round 27 and the Claude control steps M1–M4 are done",
  "## ▶ Start here next: Round 29 (Utility & Text) (Round 28 done 2026-11-13); Round 28 and the Claude control steps M1–M4 are done"),
 ("Round 27 is committed (2026-11-13; all twelve suites as before).", "Round 28 is committed (2026-11-13; all twelve suites as before)."),
 (OLD_BRIEF, """Rounds 8–28 and the Round 6 leftovers are done; **every Simulation effect is in** (18). **Round 29 is next, Utility &
Text** (WORKPLAN.md's round table): Apply LUT, Cineon Converter, Color Profile Converter, HDR Compander, HDR Highlight
Compression, CC Overbrights, Grow Bounds, Numbers and Timecode. Find their host code in EffectCraft's crates/effects/src
(and crates/gpu/src) at the pinned commit with `gh api`, as before; some may already be partly in Lumina under other
names, so check FX first. Round 28's helpers: `fxDrawPieces(E, front, pieces, back)` (sim2's PiecePlan::finish: pieces
far to near through fxm_piece, by fxp_raster's passes, or fxm_raster when backs have their own texture), `fxPutPiece`
(piece_pass's 48-float record), `fxOff(E)` (where layer pixel 0, 0 sits: the piece effects plan in frame pixels as sim2's
layer buffer, not following the layer's own rotation, as Card Wipe), `fxSimpleCam` (Proj::simple), `fxCardLight` and
`fxCard3dParams(camZ)` (Card Wipe's camera, light and material settings for other effects), `fxReadAt(R, x, y)` /
`fxReadFull` (a picture read back to the CPU, sampled bilinearly as Image::sample_bilinear), `fxOrderDesc` (a stable
far-to-near order by radix), `fxLines` (line sprites), `fxShatterCells` (the patterns), `fxDrag`, `fxFoamPop`,
`fxChunkedK`; `fxSpriteTable` takes an item kind and a back texture, `fxChunked` an item kind, `fxSpritePost` 'black'
(over opaque black); `fxPiece` keeps every piece's corners winding one way. """),
 ("EffectCraft carries on at **Round 28 (Simulation: pieces and surfaces)**.", "EffectCraft carries on at **Round 29 (Utility & Text)**."),
 ("""   **Where we left off: Rounds 1–27 and the Round 6 leftovers are done; Round 28 (Simulation: pieces and surfaces) is
   next.** About 62 effects are left, in Rounds 28–31+ (Reshape and Smear wait for Masks II, A7).""",
  """   **Where we left off: Rounds 1–28 and the Round 6 leftovers are done; Round 29 (Utility & Text) is next.** About 54
   effects are left, in Rounds 29–31+ (Reshape and Smear wait for Masks II, A7)."""),
 ("""- **EffectCraft Round 27 done (2026-11-13): Simulation, weather and more.**""",
  """- **EffectCraft Round 28 done (2026-11-13): Simulation, pieces and surfaces.** Eight more effects in the **Simulation**
  group, which now has all 18:
  - **CC Ball Action** (pixels.rs): the layer as a grid of balls in its own colours, turned about an axis, twisted along X,
    Y, radius or brightness, scattered in 3D.
  - **CC Pixel Polly**: from Start Time the layer breaks into triangles or squares (flat or textured) that fly from the
    Force Center, spin and fall; depth sorted.
  - **CC Scatterize**: every pixel a dot, scattered, and twisted about the middle (Left / Right Twist); Composite or Add.
  - **Card Dance** (shatter.rs): the layer cut into cards whose X/Y/Z position, rotation and scale each follow a gradient
    layer's channel (Source × Multiplier + Offset), lit, through Card Wipe's camera; a Back Layer for the backs.
  - **Shatter**: Bricks, Glass, Hexagons, Squares, Triangles or a Custom Shatter Map; two force spheres break pieces,
    which fly, tumble (Tumble Axis), fall with gravity and drag, with extruded sides; Shatter Threshold with a gradient
    layer; Front / Side / Back textures (colour, layer, tinted layer); Render All / Layer / Pieces; Rendered or four
    wireframe views (the default, as EffectCraft's, is Wireframe Front View).
  - **Caustics** (surfaces.rs): the bottom seen through a water surface (another layer's smoothed luminance), refracted,
    focused into caustics, lit, under the surface colour or a reflected sky.
  - **Wave World**: the wave equation on a grid, stepped from layer time 0 at 60 steps a second (Pre-roll too), two Ring or
    Line producers, a Ground layer making dry walls and shallows, edges reflecting or soaking; Wireframe Preview or Height
    Map.
  - **Foam** (foam.rs): bubbles stepped at 30 a second: grow, drift with wind and turbulence, run down a Flow Map, push
    apart and stick, wobble and pop; Draft, Draft + Flow Map or Rendered (five bubble looks or a texture layer, an
    environment map reflection).
  - **How they are drawn:** pieces through EffectCraft's fxm_piece (fxp_raster's passes, or fxm_raster when backs have
    their own texture), balls / dots / wires / bubbles as sprites (fxp_raster), fxm_caustics, fxm_wave, fxp_under and
    Foam's disc kernels. The layer's colours for flat pieces and Card Dance's / Shatter's maps are read back to the CPU.
  - **Differences from EffectCraft:** the piece effects (Pixel Polly, Card Dance, Shatter) don't follow the layer's own
    rotation (as Card Wipe); Caustics and Foam offer no "First Comp Light"; Caustics' Tiled / Reflected repeat and Foam's
    environment reflection span the frame where EffectCraft's span the layer (the same for a layer filling the frame).
  - **Speed** at 1080p, 3 s in, defaults: about 5–6 ms a frame for Scatterize, Card Dance, Shatter (Rendered), Caustics,
    Wave World and Foam; CC Ball Action about 27 ms (130 000 balls); CC Pixel Polly about 28 ms (41 000 pieces, worked out
    straight into the drawing table).
  - Host code from EffectCraft's crates/effects/src/sim2 (pieces.rs, pixels.rs, shatter.rs, surfaces.rs, foam.rs,
    registry.rs) and crates/gpu/src (fx_sim.rs, fx_particles.rs), fetched earlier with `gh api`; nothing was downloaded or
    installed.
  - Test: the fx suite's sim28Kernels, sim28Details (balls in the layer's colours, none at size 0; Pixel Polly the layer
    before Start Time, flying after it; Scatterize nothing when unset; Card Dance at rest giving the layer back, turned or
    pushed by intensity; Shatter's wireframe, Rendered at time 0 the layer, breaking later in three patterns; Caustics
    with flat water, a water surface and caustics; Wave World's moving wires and grey height map; Foam empty at time 0,
    bubbles by the producer later, scrubbing the same), sim28Menu (18 Simulation effects) and round28speed. Round 27's
    sim27Menu now checks its own seven.
- **EffectCraft Round 27 done (2026-11-13): Simulation, weather and more.**"""),
])
print('ok')
