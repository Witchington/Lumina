import io
def edit(p, pairs):
    raw = io.open(p, 'rb').read(); crlf = b'\r\n' in raw
    s = raw.decode('utf-8').replace('\r\n', '\n')
    for a, b in pairs:
        assert s.count(a) == 1, (p, a[:80], s.count(a)); s = s.replace(a, b)
    if crlf: s = s.replace('\n', '\r\n')
    io.open(p, 'wb').write(s.encode('utf-8'))

ORDER = "Camera Tracker, Warp Stabilizer, Puppet, Paint, Face Tracking, 3D Channel effects, Object Matte, Liquify"
edit('D:/Lumina/WORKPLAN.md', [
 ("| 31+ | Big tools (one each) | Liquify, Puppet, Paint, Roto Brush, Warp Stabilizer, Camera Tracker, Object Matte, Face Tracking, 3D Channel effects |",
  "| 31 ✅ | Big tool: Roto Brush | Roto Brush & Refine Edge (the classic engine, no AI model) |\n"
  "| 32+ | Big tools (one each, largest first, the user's choice) | " + ORDER + " |")])

ROADMAP = 'D:/Lumina/ROADMAP.md'
s = io.open(ROADMAP, encoding='utf-8').read().replace('\r\n', '\n')
a = s.index("Rounds 8–30 and the Round 6 leftovers are done;"); b = s.index("Round 30's helpers:", a)
OLD_BRIEF = s[a:b]
edit(ROADMAP, [
 ("## ▶ Start here next: Round 31 (Big tools, one each) (Round 30 done 2026-11-13); Round 30 and the Claude control steps M1–M4 are done",
  "## ▶ Start here next: Round 32 (Camera Tracker) (Round 31 done 2026-11-13); Round 31 and the Claude control steps M1–M4 are done"),
 ("Round 30 is committed (2026-11-13; all twelve suites as before).", "Round 31 is committed (2026-11-13; all twelve suites as before)."),
 (OLD_BRIEF, """Rounds 8–31 and the Round 6 leftovers are done; every Simulation effect is in (18), the **Utility** (7) and **Text** (2)
groups are in, Audio Spectrum and Audio Waveform joined Generate (Round 30), and **Roto Brush & Refine Edge** joined Matte
(Round 31, the first big tool). **The big tools go largest first (the user, 2026-11-13: "Do Largest Tool to Smallest Tool
get the harder bigger ones out the way first")**, one a Round, by the size of EffectCraft's code for each: **Round 32
Camera Tracker**, then Warp Stabilizer, Puppet, Paint, Face Tracking, 3D Channel effects, Object Matte (it reuses Roto
Brush's engine), Liquify. Face Tracking may need a model: ask the user before any download. Find each tool's host code in
EffectCraft at the pinned commit with `gh api`, as before. Round 31's helpers: `workers/roto.js` (a Web Worker: the whole
classic segmentation engine, see the Round 31 entry), `rotoCall(op, m, transfer)` (talk to it), `rotoGrid(E)` (the
layer's own pixel grid and the frame → grid matrix), `rotoRead(E, img, G)` (the effect's input on that grid, read back),
`rotoChain` / `rotoSeed` / `rotoFinalKey` (content keys, so undo and reopening never see a stale matte), `rotoWant` /
`rotoPump` / `rotoWork` / `rotoStep` (one frame at a time, the frame on screen first), `rotoGrab(job, g)` (fxApply in
grab mode at another frame: an effect can now set `E.stop` to end the effects there), `rotoPlan` / `rotoAll` (every frame
of the span: Work out every frame, Freeze, export), `rotoWarmAll()` (export waits on it), `rotoRLE` / `rotoUnRLE`;
an effect button's `text` can now be a function of the effect; Lumina's shaders/lumina_roto.wgsl (`lr_apply`). """),
 ("EffectCraft carries on at **Round 31 (Big tools, one each)**.", "EffectCraft carries on at **Round 32 (Camera Tracker)**, then the other big tools, largest first."),
 ("""   **Where we left off: Rounds 1–30 and the Round 6 leftovers are done; Round 31+ (Big tools, one each) is next.** About
   43 effects are left, in Rounds 31+ (Reshape and Smear wait for Masks II, A7).""",
  """   **Where we left off: Rounds 1–31 and the Round 6 leftovers are done; Round 32 (Camera Tracker) is next.** About
   42 effects are left, in Rounds 32+ (Reshape and Smear wait for Masks II, A7)."""),
 ("""- **EffectCraft Round 30 done (2026-11-13): Audio-driven.**""",
  """- **EffectCraft Round 31 done (2026-11-13): Roto Brush & Refine Edge**, the first big tool (Matte group, now 5).
  - **Use:** Layer › Roto Brush (Alt+W), or the effect's Roto Brush tool button. Paint over the object on the preview
    (green); hold Alt to paint what isn't part of it (red); Ctrl+drag sets the brush size; the Refine Edge brush (blue,
    Alt takes away) marks soft edges such as hair. A bar under the preview has the brush, its size, "Show the cut-out"
    and Done (Esc). While painting the whole layer shows with the matte's edge in pink (and the Refine Edge band in
    cyan). The first stroke sets the base frame and a span of 20 frames each side; the effect's buttons move the span's
    ends to the playhead, work out every frame, Freeze / Unfreeze and remove the strokes. Outside the span the layer is
    see-through; with no strokes it passes through. Every stroke is one undo step.
  - **The engine (workers/roto.js, a Web Worker, so Lumina stays usable):** EffectCraft's classic engine, ported line by
    line from track/src/roto.rs, gmm.rs, maxflow.rs, matting.rs, refine.rs and raster/src/flow.rs: GrabCut colour models,
    a Boykov–Kolmogorov min cut on a reduced copy and then in a band at full size, small-part cleaning; the next frame by
    block-matching optical flow and a re-cut within Search Radius; Refine Edge by the guided filter and (Higher Quality)
    closed-form matting; Reduce Chatter, motion blur and edge colour decontamination.
  - **How it fits Lumina:** the effect works on the layer's own pixel grid (the layer box, at most 2048 px), read back from
    the graphics card through the layer's matrix, so moving the layer keeps its matte. Each frame is keyed by its content
    (the layer, the effects before it, the settings, the strokes from the base frame out, which source frame it shows),
    so undo, redo and reopening never show a stale matte. A frame that isn't ready yet shows the layer as it is, with
    "Roto Brush: working out the matte…" on the preview; export works every frame out first. Frozen mattes (8-bit, run
    length coded) are kept outside the undo history and saved in the project file (`rotoFrozen`).
  - **Differences from EffectCraft:** only the classic engine (Version 1.0): its 2.0 / 3.0 use trained models (MobileSAM,
    SAM 2) that need a download, so the Version menu and Show Object (several objects, for the tracker) are left out.
  - **Speed** at 1080p: about 1 s a frame to work out in the worker (Refine Edge with Higher Quality about 1.4 s more);
    a worked-out frame draws in about 8–9 ms.
  - Host code from EffectCraft's crates/effects/src/roto.rs, crates/track/src/roto*, crates/raster/src/flow.rs and
    ui-egui's roto_tool.rs, read with `gh api`; nothing was downloaded or installed.
  - Test: the fx suite's roto31Kernels, roto31Details (the engine on a made-up disc, and on a made-up video of a red
    figure walking over a textured room: the Layer menu and the tool, a stroke with the mouse, the outline, the cut-out,
    carried on 8 frames, nothing outside the span, an Alt stroke and undo, Refine Edge's band and soft edge, the
    decontamination map, Freeze and the saved project, export), roto31Menu and round31speed; keyingMenu now expects 5 in
    Matte.
- **EffectCraft Round 30 done (2026-11-13): Audio-driven.**"""),
])
print('ok')
