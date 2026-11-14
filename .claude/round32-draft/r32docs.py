import io
def edit(p, pairs):
    raw = io.open(p, 'rb').read(); crlf = b'\r\n' in raw
    s = raw.decode('utf-8').replace('\r\n', '\n')
    for a, b in pairs:
        assert s.count(a) == 1, (p, a[:80], s.count(a)); s = s.replace(a, b)
    if crlf: s = s.replace('\n', '\r\n')
    io.open(p, 'wb').write(s.encode('utf-8'))

SPEED = open('D:/Lumina/.claude/round32-draft/speed.txt', encoding='utf-8').read().strip()
edit('D:/Lumina/WORKPLAN.md', [
 ("| 32+ | Big tools (one each, largest first, the user's choice) | Camera Tracker, Warp Stabilizer, Puppet, Paint, Face Tracking, 3D Channel effects, Object Matte, Liquify |",
  "| 32 ✅ | Big tool: 3D Camera Tracker | 3D Camera Tracker, Camera Track Pin (Lumina's own, until A8 brings camera layers) |\n"
  "| 33+ | Big tools (one each, largest first, the user's choice) | Warp Stabilizer, Puppet, Paint, Face Tracking, 3D Channel effects, Object Matte, Liquify |")])

ROADMAP = 'D:/Lumina/ROADMAP.md'
s = io.open(ROADMAP, encoding='utf-8').read().replace('\r\n', '\n')
a = s.index("Rounds 8–31 and the Round 6 leftovers are done;"); b = s.index("Round 31's helpers:", a)
OLD_BRIEF = s[a:b]
edit(ROADMAP, [
 ("## ▶ Start here next: Round 32 (Camera Tracker) (Round 31 done 2026-11-13); Round 31 and the Claude control steps M1–M4 are done",
  "## ▶ Start here next: Round 33 (Warp Stabilizer) (Round 32 done 2026-11-14); Round 32 and the Claude control steps M1–M4 are done"),
 ("Round 31 is committed (2026-11-13; all twelve suites as before).", "Round 32 is committed (2026-11-14; all twelve suites as before)."),
 (OLD_BRIEF, """Rounds 8–32 and the Round 6 leftovers are done; every Simulation effect is in (18), the **Utility** (7) and **Text** (2)
groups are in, Audio Spectrum and Audio Waveform joined Generate (Round 30), **Roto Brush & Refine Edge** joined Matte
(Round 31, the first big tool) and the **3D Camera Tracker** joined Perspective (Round 32). **The big tools go largest
first (the user, 2026-11-13: "Do Largest Tool to Smallest Tool get the harder bigger ones out the way first")**, one a
Round, by the size of EffectCraft's code for each: **Round 33 Warp Stabilizer** (track/src/stabilize.rs, subspace.rs,
effects/src/warp_stab.rs; it shares the Camera Tracker's feature tracks: `TrackAnalyzer` with a budget in
workers/camtrack.js), then Puppet, Paint, Face Tracking, 3D Channel effects, Object Matte (it reuses Roto Brush's
engine), Liquify. Face Tracking may need a model: ask the user before any download. Find each tool's host code in
EffectCraft at the pinned commit with `gh api`, as before. Round 32's helpers: `workers/camtrack.js` (a Web Worker: KLT
feature tracks, the camera solve, bundle adjustment, see the Round 32 entry; ops begin / push / finish / solve, and the
tests klt / synth), `ctCall` / `ctReset()` (talk to it; Cancel ends a solve by ending the worker), `ctTracksKey` /
`ctSettings` / `ctSolveKey` (content keys: tracking again only when the frames change, solving again when the settings
or deleted points change), `ctWant` / `ctPump` / `ctGrab` (one analysis at a time in the background; `ctGrab` is
rotoGrab's way of reading the effect's input at another frame), `ctOf(f)` (a tracker's tracks and solve now),
`ctProject` / `ctVisible` / `ctTarget` / `ctPlaneAxes` / `ctFitPlane` (the solve on the main thread), `ctPinQuad` (Camera
Track Pin's four corners), `ctSave` / `ctLoad` (the project's `camTrack`), `ctWarmAll()` (export waits on it); Lumina's
shaders/lumina_camtrack.wgsl (`lct_undistort`). """),
 ("EffectCraft carries on at **Round 32 (Camera Tracker)**, then the other big tools, largest first.", "EffectCraft carries on at **Round 33 (Warp Stabilizer)**, then the other big tools, largest first."),
 ("""   **Where we left off: Rounds 1–31 and the Round 6 leftovers are done; Round 32 (Camera Tracker) is next.** About
   42 effects are left, in Rounds 32+ (Reshape and Smear wait for Masks II, A7).""",
  """   **Where we left off: Rounds 1–32 and the Round 6 leftovers are done; Round 33 (Warp Stabilizer) is next.** About
   41 effects are left, in Rounds 33+ (Reshape and Smear wait for Masks II, A7)."""),
 ("""- **EffectCraft Round 31 done (2026-11-13): Roto Brush & Refine Edge**""",
  """- **EffectCraft Round 32 done (2026-11-14): 3D Camera Tracker**, the second big tool (Perspective group, now 11 with
  Camera Track Pin).
  - **Use:** Layer › Track Camera (After Effects: Animation › Track Camera), or Effect › Perspective › 3D Camera Tracker.
    The analysis starts by itself in the background ("Analyzing in background (step 1 of 2)", then "Solving camera" at
    the bottom left of the preview; Lumina stays usable); Analyze / Cancel in the effect. When it is solved the track
    points show over the layer while it is selected (3D Solved, or the 2D Source tracks), each in its own colour. Select
    track points (the effect's button) to pick them: click a point, click inside a triangle of three (the target shows
    under the cursor: red and white rings on that plane), drag a box, Shift adds; Esc or Done ends. Right-click: Create
    Text, Create Solid, Create Multiple Text Layers / Solids (one on each selected point), Delete Selected Points (Delete
    key too). The effect's report: Method used, Average error, and "Partial solve: n of m frames" when some frames were
    only interpolated. Settings as After Effects: Shot Type (Fixed / Variable Zoom / Specify Angle of View), Horizontal
    Angle of View, Show Track Points, Render Track Points, Track Point Size, Target Size, Solve Method (Auto Detect,
    Typical, Mostly Flat Scene, Tripod Pan), Detailed Analysis, Solve Lens Distortion, Undistort Footage, Auto-delete
    Points Across Time, Hide Warning Banner.
  - **The engine (workers/camtrack.js, a Web Worker):** EffectCraft's track/src/klt.rs and camtrack/*.rs ported line by
    line: Shi–Tomasi corners followed with pyramidal Lucas–Kanade and a forward–backward check (long tracks, new corners
    where the frame has none, at most 720 px; Detailed Analysis 1280 px and more features); parallax keyframes; a
    two-view start from the essential matrix (8-point in RANSAC) or a homography decomposition; resection and
    triangulation keyframe by keyframe; a sparse Levenberg–Marquardt bundle adjustment with the Schur complement over the
    points and a Huber loss (banded Cholesky); the focal length searched over angles of view and refined; tripod pans
    solved as rotations; radial lens distortion (k1, k2) solved jointly. One change: Auto Detect's quick tripod check also
    tries five angles of view, since a pan looks like a flat scene to the general solve and its focal length is then
    unreliable (without it, a tripod pan came out as Typical).
  - **How it fits Lumina:** the frames are the effect's input on the layer's own grid (Roto Brush's rotoGrid / grab
    mode), so the effects before it count and moving the layer doesn't re-analyse. The tracks are keyed by what the
    frames are made from, the solve by the tracks plus Shot Type, Angle of View, Solve Method, the deleted points and
    lens distortion: changing those solves again without tracking again, and undo / redo bring the earlier solve straight
    back. The analyses are saved in the project file (`camTrack`; track positions as base64 floats). **Create** makes a
    text or shape layer above the tracked one with **Camera Track Pin** (Lumina's own effect): its box is laid on the
    target's plane through the solved camera on every frame, like Corner Pin. Lumina has no 3D camera or light layers
    yet (After Effects Round A8), so Create Camera, Create Null, Shadow Catcher and Light, Set Ground Plane and Origin and
    Export to Blender are left for then; the solve keeps everything they need.
  - **Speed:** about 33 ms a frame to track at 720p in the worker; the solve took about 7–15 s for 60 made-up frames
    (Specify Angle of View under 2 s); """ + SPEED + """.
  - Host code from EffectCraft's crates/effects/src/camera_tracker.rs, crates/track/src/klt.rs, fit.rs, camtrack.rs and
    camtrack/*, engine/src/analysis/camera_track.rs, engine/src/cmd/camera_cmds.rs and ui-egui's camera_tracker_ui.rs,
    read with `gh api`; nothing was downloaded or installed.
  - Test: the fx suite's camtrack32Kernels, camtrack32Details (the engine: KLT on a shifted texture, made-up scenes with
    a known 50° camera; a made-up video of a camera moving through a field of checker squares: Layer › Track Camera and
    the analysis, the points on the preview, picking a triangle with the mouse, right-click › Create Solid following the
    scene, Create Text and undo, Delete with the Delete key solving again without tracking again, Specify Angle of View,
    Render Track Points, Solve Lens Distortion and Undistort Footage, the saved project), camtrack32Menu and
    round32speed; perspectiveMenu now expects 11.
- **EffectCraft Round 31 done (2026-11-13): Roto Brush & Refine Edge**"""),
])
print('ok')
