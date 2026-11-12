# Lumina roadmap

Goal: Lumina usable like After Effects, Photoshop, EffectCraft and CapCut. An editor for everything.

**This is the plan to follow. Open it first every session.** Work through the Order below, one step at a time.
`WORKPLAN.md` only holds the details behind each step: the full round lists and the CapCut notes.

---

## ▶ Start here next: Round 24 (Channel) (Round 23 done 2026-11-11); Round 23 and the Claude control steps M1–M4 are done
**Back on EffectCraft (2026-11-08, the user: "I actually wanna work back on Effectcraft… I want Lumina to have everything
Adobe After Effects and Premier Pro have. I also want the screen effects everything they offer I want to have").**
**One round at a time** (the user, 2026-11-08: the continuous run "wasn't working", round by round was; don't run rounds back to back again). Local git commits after each round are
OK (never push). Round 23 is committed (2026-11-11; all twelve suites as before). The setup that replaces the old Lumina
is done too (see its section). **Round FP (Floating panels) is done too (2026-11-10, the user asked between Rounds 20 and
21):** every panel can float in a window of its own. **Round FP2 is done too (2026-11-10):** the Composition viewer
(the video player) floats as well, and dragging a header no longer selects text. **M5 is done too (2026-11-10): Edit ›
AI connections (MCP)…, so other AIs (not only Claude) can connect to Lumina** (see the Claude control section).
Rounds 8–23 and the Round 6 leftovers are done. **Round 24 is next, Channel** (WORKPLAN.md's round table): Arithmetic,
Blend, Calculations, CC Composite, Channel Combiner, Compound Arithmetic, Invert, Minimax, Remove Color Matting, Set
Channels, Set Matte, Shift Channels, Solid Composite (check which are already in Lumina first). Find their host code in
EffectCraft's crates/gpu/src (check each file's `IDS` list) and the CPU plans in crates/effects/src. Round 23's helpers:
`fxDone`, `fxDeg` (an angle turned with the layer), `fxCorners` / `fxMaxCorner` (transition::max_corner_dist over the
layer's on-screen box), `fxHL` (f32 hi/lo pairs), `fxOther` (a picked layer or null), `fxPlaced` (transition::place_layer:
tile, centre or stretch another layer over this one's box), `fxRotAxis` / `fxRotOrdered` (card3d), `fxCardCam` /
`fxCamEye` / `fxCardShade` / `fxPiece` / `fxCardPlan` / `fxDrawCards` (card3d's camera and lighting, sim2's pieces, drawn by
lt_cards), `fxDonePct`; `fxLayerPick` takes a third argument, the "none" label; new kernel family `lumina_trans`
(shaders/lumina_trans.wgsl: lt_place, lt_scale, lt_iris, lt_grid, lt_cards). Round 22's helpers: `fxNorm3`, `fxLightDir`
(perspective::light_dir), `fxRotXYZ` (rot_xyz) / `fxRotRows`, `FX_SHADING` + `fxShading` (perspective::Shading into f[1],
f[3..6]), `FX_FACES`, `fxLayerBox(E, M)` (another layer's on-screen box and scale as last drawn), `GLASSES_VIEWS`; new kernel
family `fx_extra` (fx_generate + fx_extra, the bevels). Round 21's helpers: `fxPhaseTerms` (fx_noise::phase_terms), `fxGrainLook` / `fxGrainPlanes` /
`fxGrainApply` / `fxGrainMatte` / `fxGrainPreview` (GrainLook and preview_compose), `fxSampleBoxes` / `fxGrainStats` /
`fxSampling` / `fxDrawBoxes` (noise::sample_boxes, noise2::grain_stats_boxes, draw_boxes, on a picture read back),
`fxMedianImage` / `fxMedianFx` (noise::median_image: bisection to radius 4, the sliding histogram above), `fxNoiseHLS`,
`fxTurbulentNoise` (noise3::fractal_gpu) and the menus `FX_FRACTAL_TYPES`, `FX_NOISE_TYPES`, `FX_NOISE_OVERFLOW`,
`FX_NOISE_BLENDS` (name → BlendMode::ALL place); an effect's `clip` can now be a function of its settings; new kernel
families `fx_particles` (fx_stylize + fx_sim + fx_particles, as EffectCraft builds it) and Lumina's `lumina_noise`
(shaders/lumina_noise.wgsl). Round 20's helpers: `fxRng(seed)`
(util::Rng, xorshift64* on BigInt), `fxPlaneAt` (Plane::sample), `fxBolt` / `fxLightningSegs` (generate2's bolts),
`fxHslRgb` (common::hsl_to_rgb), `fxFractal` (the CPU fractal, in doubles); `E.texFrom8(bytes, w, h)` (an 8-bit RGBA
picture from the CPU); lumina_gen.wgsl gained `lg_alpha` (Plane::alpha) and `lg_put` (a CPU picture, optionally over the
original). Round 19's helpers: `fxMaskPoly(E)`
(the layer's mask as a frame-pixel polygon, raster::mask_px), `fxRasterSegs` / `fxRasterConvex` / `fxPaint` (fx_gen2's
tiled raster and fg2_paint), `fxItems` / `fxItemPush` / `fxItemData` (its tile tables), `fxPolyLen` / `fxPolyCum` /
`fxPolyAt` / `fxTrimPoly` / `fxPolySegs` / `fxChaikin` / `fxStrokeOutline`, `fxContours` (marching squares), `fxGaussCPU`,
`fxDT` / `fxSDF` (distance transforms), `fxValuePlane` (a read-back picture as one value a pixel), `fxAt(E, t)` (an
effect's settings at another time), `fxRem`, `fxSmooth`, `fxReflect`; `E.texFrom(floats, w, h)` (a one-float-a-pixel plane
from the CPU). Lumina's own `shaders/lumina_gen.wgsl` holds what EffectCraft draws only on the CPU. Round 18's helpers: `fxLayerOr(E, img, id, name)` (util::layer_or_self:
another layer as it sits in the frame, or this one), `fxLayerPick(id, label)` (its menu), `fxBumpLight`/`fxBump` (CC
Glass / Plastic's light), `fxRound` (f64::round); `E.data` now takes a ready Float32Array as it is. Round 17's helpers: `fxSeed(E)` (a layer's own random seed, EffectCraft's
ctx.seed), `FXC` (a WeakMap for per-effect CPU tables) and `fxGuided` (fx_noise::guided_filter). **Stage 1 decision (2026-11-10, the user):** Round 16's effects went first;
parenting and precomps stay in After Effects Round A1 (blend modes and track mattes were already in Lumina). Round 16's
helpers: `fxGridWarp` (fx_distort::grid_warp → `dst_mesh`), `fxBez`, `BEZ_PTS`, `SRC_NAMES`. Round 15 added the `fx_warp`
and `fx_transition` kernel families and `fxSplit`. Round 14's helpers: `m3mul` / `m3inv` / `m3t` / `m3s` / `m3r` / `m3of` /
`m3quad` (3 × 3 matrices, Mat3::square_to_quad) and `fxWarp(E, img, m, {dst, opacity, sampling, acc})` (ops::warp
through `warp_blend`; m maps frame pixels, source → output). Round 13's helpers: `fxGaussPlane` (util::gauss_plane, `fp2_box`), `fxEdgePreserve`
(blur2::edge_preserving), `fxRectOf(m, w, h)` (a layer's on-screen box) and `E.rows(img)` (a working image as a data
table, EffectCraft's image_rows; working images now allow copying out). Round 12's helpers: `fxAlphaPlane`, `fxMatteView`, `fxSetAlpha` (util::set_alpha), `fxRefine`,
`keyPrimary` / `klPrimary`; Round 11's: `fxThinFeather`, `fxMorphFrac` (`fxn_morph`), `fxKeyApply`, `E.upload(canvas)`.
- **The user's goal now includes Premiere Pro:** everything After Effects *and* Premiere Pro have, and every effect they
  offer ("screen effects"). EffectCraft covers After Effects' effects. Premiere Pro's own extras (its video effects and
  transitions list, Lumetri scopes, Essential Sound/Graphics, multicam, auto reframe, proxies, nested sequences…) need a
  list of their own: write it once EffectCraft's rounds are further along, or sooner if the user asks.
- **PhotoCraft Round P4 (Painting) is on hold** (the user, 2026-11-08: "save round 4 for later"). Don't start it until the
  user asks; pick up from the P4 notes below.

**The user started PhotoCraft on 2026-11-08** ("we finished CapCut… could we start working on PhotoCraft… to get Lumina to have
some Photoshop features and be able to save media as images"). EffectCraft resumed at Round 8 the same day (see above).
PhotoCraft is a Rust app (egui + wgpu) with only 2 WGSL shaders, so like EffectCraft it is rebuilt in Lumina feature by feature,
with PhotoCraft (https://github.com/storytold/photocraft, MIT or Apache-2.0, commit 3ef886c on 2026-11-08) as the reference.
Its own estimate: ~45% of Photoshop, 2,300–4,100 h to full parity, so Lumina takes the parts people use most. The rounds are in
"PhotoCraft rounds" below. **Rounds P1 (Save as image), P2 (moving pictures, sequences, opening every image
format) and P3 (Image mode basics) are done**; P4 (Painting) is saved for later, to pick up when the user asks; Round PW (Workspaces) comes right after P4. P4 builds on Image mode: a paint layer is a new layer
kind holding its own pixels, at the canvas size, listed in the Layers panel like the rest.

**Round IX, Image mode fixes: DONE 2026-11-11.** `useWorkspace` now leaves Image mode for any workspace but Image (so the
Default / Effects / Small Screen tabs and Window › Workspace all go back to video editing; nothing is lost, the layers stay).
A **Video | Image** switch (`#modeSw`) sits first in the toolbar, left of Import media (the user's pick); `applyPanels`
lights the current mode. The small Image workspace tab is gone from the top right (the Image workspace stays in Window ›
Workspace); that also keeps the toolbar on one line at the 1600 px start size. Aero gives the lit half a white glass look.
Hints now say "click Video (top left)". Test: photo suite step `roundIX` (each workspace tab, Window menu, rail Edit this
frame / Back, New image, the switch), and step `modes` now uses the switch. The original notes:
- **Bug: stuck in Image mode.** Clicking the **Image** workspace tab (top right, next to Default / Effects / Small Screen)
  goes into Image mode, and the user can't get back to video editing. P3 says Image › Back to video editing undoes it, but
  that isn't found or doesn't work from there. Fix: clicking **Default** (or any other workspace tab) while in Image mode
  goes back to video editing, the same as Image › Back to video editing (ask first only if leaving would lose something).
  Also check the Image rail tab and the welcome screen's New image… for the same problem, and add a test step for each.
- **Move the Image editor somewhere easy to see.** Today it is a small text tab in the far top-right corner ("very
  hidden"). Give it a clear place, for example a **Video | Image** switch at the left of the toolbar next to Import media,
  that shows which mode you are in and switches both ways in one click. Ask the user which spot before building it. Fits
  with Round PW (Workspaces), which redoes this corner later.

**Round TI, an icon for each theme (the user, 2026-11-10; DONE 2026-11-11).** Built: `icons\lumina-icon-<default|grey|cozy|aero>` (512px .png + .ico with 16–256), sources for the new ones in `brand\themes\`; `setTheme` swaps the top-left and welcome logos and the tab icon, and sends the theme to main, which sets the icon on every Lumina window (floating panels too) and keeps it in `theme.json` so the next start uses it; the Greyscale filter is gone; test `timeline › themeIcons`. The original plan: The "L" logo is purple in every
theme today, and Greyscale only turns it grey with a filter. Each theme should get its own matching icon.
- **The icons:** one per theme, the same "L" shape in that theme's colors.
  - Default: the purple one Lumina has now.
  - Greyscale: a proper grey and silver version, not the filtered one.
  - Cozy Home Theatre: the old warm orange one (the files kept in `old-warm-theme\`).
  - Frutiger Aero: a glossy aqua-blue glass "L" with a white shine on the top half, maybe a little green and a bubble.
  - Each one is made as `lumina-icon-<theme>.png` (several sizes) plus a `.ico` for Windows.
- **Where it changes with the theme:**
  - The logo in the top left of the menu bar, the welcome window, and the floating panel windows.
  - The taskbar button while Lumina is open (`win.setIcon(...)` in electron/main.js, sent from `setTheme`), and the
    window's title-bar icon. The tab icon (`<link rel="icon">`) too.
  - Lumina starts with the saved theme's icon, so the taskbar doesn't show purple first and then switch.
- **What can't change:** the Desktop shortcut, a shortcut pinned to the taskbar, the Start menu and the installer use the
  icon built into Lumina.exe, so they stay the default purple. Windows only shows the theme icon on the taskbar button
  while Lumina is running. (Possible later: a "Use this icon for my shortcuts too" button that points the Desktop and
  Start menu shortcuts at the chosen `.ico`. That changes files outside Lumina, so it would ask first.)
- **Tests:** for each theme, the top-left logo and the welcome logo use that theme's file; main gets the right icon path
  and every icon file exists in the build; switching back to Default puts the purple icon back; the floating panels match.

**For later: Rounds SM1 + SM2, Style Match (the user, 2026-11-10; not started, after Round IX).** The idea: someone connected
through AI control (Claude or another AI) sends a link or imports a video with an editing style they like (cuts and effects
synced to the beat of the song), uploads their own clips and pictures, and the AI makes a new edit in the same style with
their footage. Not a copy of the video itself: the style (timing, beat sync, zooms, shakes, flashes, transitions, look).
Today the AI can already import, cut, trim, place, add effects and keyframes, and see single frames (snapshot), but it can't
hear the song or see where cuts and moves happen in time. These Rounds give it that.
- **SM1 Study the reference.** The reference comes in as an imported video, or a link through the existing Converter tab
  (yt-dlp). Say in the window that the user should only use videos they're allowed to, and that posting the song is up to
  them. A new MCP tool (e.g. `analyze_reference`, also in a menu for people without an AI) writes a breakdown:
  - every cut (scene change) with its time, and each shot's length;
  - the song's beats and tempo (reuse Lumina's beat detection), and which cuts land on a beat;
  - per shot: zoom in/out, shake, speed ramps (from how the picture moves), white/black flashes, text on screen;
  - a few frames per shot so the AI can see the look (color, blur, glow).
  - The breakdown is saved as an **edit recipe** (JSON), so a style can be kept and used again as a template.
- **SM2 Apply the recipe to the user's clips.** A new MCP tool (e.g. `apply_recipe`) with the user's clips and pictures:
  - picks the best part of each clip (movement, faces, sharp, not blurry);
  - puts clips on the cut points, adds the matching zooms, shakes, flashes and transitions as keyframes and effects;
  - snaps to the beats; keeps the reference's song, or re-fits the timing to another song the user picks;
  - the AI then compares snapshots of the result with the reference frames and fixes color and timing.
- **What to expect:** cuts, beat timing, zooms, shakes, flashes and color can match closely; masks, 3D and tracking only
  roughly. Tests: a made-up reference with known cut and beat times (found within a frame), and a recipe applied to test
  clips (cuts on the right frames, effects present, nothing changed when undone).

**More advanced Style Match, SM3–SM7 (the user, 2026-11-10: "make copying easier and more accurate"; not started, after
SM1 + SM2).** Everything runs on this computer; no video, clip or recipe is uploaded anywhere.
- **SM3 Deeper study (more accurate recipes).**
  - **Exact motion curves:** follow the picture between frames (optical flow) to get each shot's pan, zoom and rotation
    as keyframe curves with their easing (ease in/out, bounce, overshoot), not just "zoom in". The same for speed ramps
    (how fast it slows and speeds back up) and shake (how strong, how fast, which way).
  - **Transitions by name:** tell apart a hard cut, flash, whip pan, zoom blur, spin, glitch / RGB split, slide, dissolve
    and luma fade, and how many frames each lasts; each one maps to a Lumina transition or effect preset.
  - **The music in more detail:** beats, downbeats (the "1" of each bar), kicks vs snares, the drop, and the song's parts
    (intro, build, drop, outro), so the recipe knows "cuts every beat in the build, every half beat on the drop, slow-mo
    on the outro". Also find added sound effects (whooshes, hits, risers).
  - **The look per shot:** a color grade taken from the reference as a LUT, plus grain, vignette, blur, glow, black bars
    and the frame size (9:16, 16:9, 1:1).
  - **Text and captions:** read the words on screen (OCR), where they sit, size, color, a close font from the installed
    fonts, and how they animate in and out (pop, typewriter, slide, shake), with their timing.
  - **Other tricks:** freeze frames, reverse, repeats ("stutter"), split screen, picture-in-picture, overlays, masks.
  - **What's in each shot:** close-up, medium or wide; where the person or subject sits in the frame; which way things
    move. Reference shots get these tags so SM4 can pick clips that fit.
- **SM4 Smarter clip picking.**
  - Score every user clip and picture: sharp or blurry, how much movement, faces, close-up or wide, brightness, which way
    it moves; done once and saved, so it's fast next time.
  - Match each reference shot to the clip that fits best (a fast drop shot gets a high-motion clip, a close-up gets a
    close-up), and use different clips instead of repeating one, unless there aren't enough.
  - Reframe each clip so its subject sits where the reference's subject sits (auto crop / follow the face), also when the
    frame size changes (16:9 clips into a 9:16 edit).
  - The user can lock a clip to a spot ("this clip on the drop"), mark favorites, or say "don't use this one".
- **SM5 Fit any length and any song.**
  - A different song: map the reference's parts onto the new song's parts (build onto build, drop onto drop) and re-time
    every cut to the new beats.
  - A longer or shorter edit: repeat or drop parts of the recipe in a way that still follows the music.
  - A **"how closely to copy" slider:** from "exact copy of the timing and effects" to "same feel, looser".
- **SM6 Compare and fix (the accuracy check).**
  - A **compare view:** the reference and the result side by side (or as an overlay / difference), playing in sync, with
    the reference's cut and beat marks on the timeline.
  - A **match score** per shot and overall: cut timing (in frames), motion (curve against curve), color (how far apart),
    transitions and text (there or not). Shots that score low are marked in red.
  - The AI (and a "Fix the low ones" button) goes over the low shots: moves cuts, re-fits keyframes, adjusts color, and
    runs the score again until it stops getting better. Each fix is one undo step.
- **SM7 Recipe editor and style library.**
  - Show the recipe as a list and as marks on the timeline; change a shot's length, effect or transition by hand.
  - Save styles to a **Style library** (a `.lumistyle` file: only timings, effects, curves, colors and text styles, never
    the reference video or the song), give them names and a preview picture, use them again, or send the file to a
    friend.
  - Mix styles: the cuts from one and the color from another.
- **Tests for SM3–SM7:** made-up references with known answers: zoom/pan curves (within 2% per frame), each transition
  type (named correctly), downbeats and the drop (within a frame), a known LUT (colors within a small difference), known
  on-screen words (read correctly), subject position after reframing, a re-timed edit on a second song (cuts on its
  beats), the match score going up after Fix the low ones, and a saved `.lumistyle` that contains no video, audio or
  file paths.

The CapCut phase (C1–C14), the beginner layout (B1–B4) and C15 Friends test release are all done (2026-11-07).
The Converter tab (links → MP3/MP4 via yt-dlp) was added the same day, then the timeline scrolling fix, layer mute
and impact copy/paste; see "Where things stand".
**C15:** version 0.9.0; `dist\Lumina Setup 0.9.0.exe` (~146 MB, installs ~450 MB) lets friends choose the folder and
adds desktop + Start menu shortcuts and the .lumina file type. Help › About Lumina says "Lumina 0.9.0 (test version)";
Help › Send feedback… opens a form (version, Windows version, three questions) to fill in and Copy into a message;
Lumina sends nothing itself. Version and Windows come from `lumina.info` (main.js `app:info`). Test-installed silently into
the scratchpad, both the speed and main suites passed on the installed copy, then uninstalled. The uninstaller leaves
`HKCU\Software\Classes\.lumina` behind (a pointer to a removed type, harmless); it was deleted by hand after the test.
Feedback from friends may change what comes next; ask the user. Don't upload setup files by hand; GitHub's workflow builds them (below).
**GitHub (2026-11-07, the user's request):** private repo https://github.com/Witchington/Lumina (signed in with `gh` as Witchington;
Git and GitHub CLI installed with winget). Version is now **0.9.1**; the setup is `dist\Lumina-Setup-<version>.exe`. Pushing a tag
`v<version>` (matching package.json) runs `.github/workflows/release.yml`: it makes the release, then builds the Windows setup
and the Linux AppImage (`Lumina-<version>-Linux-x86_64.AppImage`) on GitHub's machines and attaches both. The friend's Linux block
(no-sandbox in AppImages, WebGPU switch, LUMINA_SOFTWARE / LUMINA_X11) is merged into main.js. The Linux build is untested on
a real Linux PC. Speed test step 24 holds the version in `VER`: change it with each version bump.
**The workflow is turned off (2026-11-07, the user: "we will update it when i say").** Don't push to GitHub or make a release until the
user says so; then `gh workflow enable "Build and release" -R Witchington/Lumina` before tagging.
**0.9.2 released (2026-11-07, the user asked):** the repo is now **public**. Commit 68499d0 + tag v0.9.2 hold the licence
files, the friend's timeline fixes and the impact parts; GitHub built `Lumina-Setup-0.9.2.exe` and
`Lumina-0.9.2-Linux-x86_64.AppImage` (Latest release). The workflow was turned on for the tag and **off again** right after,
as the user asked. Only real changes are committed; test output (selftest media, pasted pictures, the timeline test's
videos) is left out or ignored. Next release: bump package.json + speed test `VER`, rebuild, all nine suites, commit,
enable the workflow, push the tag, check the assets, disable the workflow.
**0.10.0 released (2026-11-10, the user asked: "update the github with everything ... as well as update the setup"):** all local
work since 0.9.2 (EffectCraft Rounds, floating panels FP/FP2, the MCP rounds through M5) pushed with tag v0.10.0, same steps as
0.9.2. Checked before the push: no key, control file, `.mcp.json`, personal path or IP other than 127.0.0.1 in any tracked file.
The beginner layout, for reference:
- **B1 Tool rail (done):** icon tabs down the left (Media, Text, Stickers, Effects, Transitions, Captions, Audio, Adjust), each
  opening a browsable panel with previews to click or drag in, like CapCut. Leave room for an Image tab (PhotoCraft).
- **B2 Clip quick bar (done):** with a clip picked, big icon buttons above the timeline (Split, Speed, Mask, Freeze, Separate
  audio, Volume, Canvas, Animate, Delete), each jumping to the right settings.
- **B3 Beginner / Pro switch: built, then removed at the user's request (2026-11-07).** Lumina always shows every
  setting (what was "Pro"). Don't bring a mode switch back unless the user asks.
- **B4 Welcome + tips (done):** first-run welcome (new, open, sizes like YouTube / TikTok / Square) and one-time tips pointing at
  key features, which can be turned off.

### Claude control (MCP), asked for by the user 2026-11-08: M1–M4 and M1b done 2026-11-09
Goal: Claude edits a project in the running Lumina through tools (add clips, text, effects, keyframes, look at frames,
export) instead of only writing Lumina's code.

**How it fits together**
1. **Inside Lumina (Lumina.html): `window.LuminaAPI`**, a table of tools that call Lumina's own functions (`newLayer`,
   `insertLayer`, `addFiles`, `seek`, `startExport`…). Every change ends with `commit()` + `refresh()`, so each thing Claude
   does is one Ctrl+Z, and the user sees it happen.
2. **Lumina's main process (electron/main.js): a local door.** A small HTTP server on 127.0.0.1 only (never the network),
   **off until the user turns on "Allow Claude to control Lumina"** in Settings. A random key is written to Lumina's own
   settings folder; a call without the key is refused. A call runs `LuminaAPI` in the window with `executeJavaScript`,
   the same way `--selftest` drives the editor.
3. **The MCP server (electron/mcp.js): what Claude talks to.** Claude Code starts it over stdio. It reads the key, lists the
   tools, and passes each call to the door. It runs with Lumina.exe itself (`ELECTRON_RUN_AS_NODE=1`), so friends don't
   need Node. The protocol (initialize, tools/list, tools/call over JSON-RPC) is written by hand: **no new download**.
   If an SDK is wanted later, ask before downloading it.
4. **Hooking it to Claude Code:** one `claude mcp add` line (or a `.mcp.json`). That changes Claude's settings, so **ask
   the user first**. No .bat/.cmd/.ps1 file is needed.

**Steps (one at a time, each tested; a `mcp` self-test suite is added in M1 and joins the others)**
- **M1 done (2026-11-09).** What was built:
  - **Lumina.html:** `LuminaAPI.call(name, args)`, which always returns `{ ok, result | error }`, with four look-only
    tools: `get_project`, `get_layer` (only the properties that differ from a new layer, plus keyframes and effect settings),
    `list_effects` (`query` searches, `id` gives one effect's settings) and `snapshot` (a PNG; the playhead goes back
    afterwards).
  - The switch is **Edit › Allow Claude to control Lumina**. There's no Settings window, and the Edit menu is where AE keeps
    Preferences. A "Claude" light sits on the right of the menu bar while the switch is on, and turns green while a call runs.
  - **main.js:** the door is on 127.0.0.1 at a random port. It refuses requests that carry an Origin or a Host other than
    127.0.0.1, and needs the key (`X-Lumina-Key`, checked with timingSafeEqual). The file
    `%APPDATA%\Lumina\claude-control.json` holds `{enabled, key, port, pid}`. On quit the port is removed but the
    switch stays.
  - **electron/mcp.js:** stdio JSON-RPC with initialize, ping, tools/list and tools/call. It uses only Node's built-in
    modules, so it runs under Lumina.exe (`ELECTRON_RUN_AS_NODE=1`) for friends, or under plain `node`.
  - **Test suite `.claude\mcp`** (expected false: none). It starts mcp.js the way Claude Code does (main.js
    `claude:probe`, self tests only) and covers:
    - switch off: the tools are listed, and every call says how to turn the switch on;
    - switch on: all four tools, a snapshot that really shows the star, unknown tool and method, ping, a parse error;
    - a wrong key is refused, and a web page's fetch is blocked;
    - the project and the undo list are unchanged afterwards.
  - **Hooked to Claude Code on this PC (2026-11-09, the user said yes):** `D:\Lumina\.mcp.json` (git-ignored; the `claude`
    command isn't on PATH here, the app has its own) runs it with Node, so Claude doesn't hold Lumina.exe open (otherwise
    `npm run dist` fails with EBUSY). A new session loads it; Claude Code asks once to allow the project's server. The
    same thing as a command:
    `claude mcp add lumina -- "C:\Program Files\nodejs\node.exe" "D:\Lumina\electron\mcp.js"`.
    For friends: `claude mcp add lumina -e ELECTRON_RUN_AS_NODE=1 -- "<install>\Lumina.exe" "<install>\resources\app.asar\electron\mcp.js"`.
- **M1 Bridge + looking (the plan):** the door, the MCP server, the Settings switch, and read-only tools: `get_project` (size, fps,
  length, layers), `get_layer`, `list_effects`, `snapshot` (the frame at a time, as a picture Claude can see).
- **M1b Connect Claude on a friend's PC (asked for by the user 2026-11-09): done 2026-11-09.**
  - **Help › Connect Claude…** has four steps:
    1. The switch.
    2. **The Claude app:** the "Add / Update / Remove Lumina" buttons change only `mcpServers.lumina`, after copying the file
       to `…json.before-lumina`. Lumina refuses a file it can't read.
    3. **Claude Code:** the `claude mcp add lumina --scope user -e ELECTRON_RUN_AS_NODE=1 -- "<exe>" "<…app.asar\electron\mcp.js>"`
       line with Copy, plus the remove line. Lumina only reads `~/.claude.json`, to say whether it's set up or out of date.
    4. **Test the connection:** starts mcp.js the way Claude does, then calls get_project.
  - **Where the Claude app keeps its settings:** Lumina looks in `%APPDATA%\Claude`, `%LOCALAPPDATA%\Claude-Data\*` (this
    PC's Claude app keeps them there) and `%LOCALAPPDATA%\Packages\Claude_*\LocalCache\Roaming\Claude`. On Mac and Linux it
    looks in the usual folders.
  - An entry for a Lumina in another folder shows as "older" with an Update button.
  - **Uninstaller:** `Lumina.exe --claude-check` (exit 1 = Claude's settings start this Lumina) and `--claude-forget`.
    `build/installer.nsh` asks "Take Lumina out of Claude's settings too?" on a real uninstall only (not on updates; a
    quiet /S uninstall says No). **Not tried in a real uninstall yet** (the user skipped it 2026-11-09); the flags are
    tested in the suite. To try it: install into the scratchpad, run the uninstaller with APPDATA/LOCALAPPDATA pointing at a
    pretend Claude settings folder, answer the question, check the file.
  - **Tests:** steps `connect` and `window` in `.claude\mcp`, using pretend settings files in the test folder.
  - **Keep in mind:** if Electron fuses are ever turned on, leave RunAsNode on, or friends' connections break.
- **M2 Editing: done 2026-11-09.** Fifteen editing tools:
  - Adding: `seek`, `add_text`, `add_shape`, `add_solid` (a frame-sized rectangle shape layer).
  - Changing: `set_property` (numbers in `L.p` through `setProp`, so a keyframed property gets a key at the playhead, plus
    the text/colour/on-off fields in `API_FIELDS`), `set_keyframe` (with `ease`, or `remove`).
  - Timing: `move` (start and/or layer order; a linked clip moves too), `trim` (the timeline's own `trimHead` / `trimEnd`,
    with the linked clip), `split` (`splitAt`), `delete_layer`.
  - Effects and history: `add_effect`, `set_effect` (numbers, points, checks, colours, text and picks; curves are refused
    for now), `remove_effect`, `undo` / `redo`.
  - **How it works:** `apiStep` folds everything a tool did into **one undo step**, then refreshes, so the user sees each
    change happen. Every input is checked, and a bad one comes back with what to send instead. Locked layers are refused.
  - In mcp.js the edit tools have `readOnlyHint: false`, and delete/remove are marked destructive.
  - Lumina's wording now says Claude can look and edit, and every change can be undone with Ctrl+Z.
  - **Tests:** mcp-suite steps `add`, `props`, `timing`, `effects`, `deleteUndo` and `viaClaude` (19 tools; an edit made
    through mcp.js shows up red in a snapshot).
  - **Not tested here:** trimming a video clip (it uses the same functions the timeline suite tests).
- **M2 Editing (the plan):** `seek`, `add_text`, `add_shape`, `add_solid`, `set_property`, `set_keyframe`, `move` / `trim` / `split` /
  `delete_layer`, `add_effect`, `set_effect`, `undo` / `redo`.
- **M3 Media: done 2026-11-09.** Five tools:
  - `import_media`: a full path. It goes through `addFiles` (`pathFile`) and waits up to 15 s for the clip. An .srt or
    .vtt file goes to captions instead.
  - `place_media`: another clip of an imported file, with `in` / `out`. `get_project` now lists `media`.
  - `import_captions`.
  - `auto_captions`: refuses until the person has downloaded the 77 MB speech model themselves. Claude never starts that
    download. The wait is 30 minutes.
  - `optimize`: starts the edit copy and returns; `get_layer` shows `media.editCopy`. `get_layer` also lists a captions
    layer's lines.
  - Imports, captions and placing are one undo step each (`apiStepAsync`).
  - **Tests:** mcp-suite steps `import`, `placeCaptions`, `autoCaptions`, `optimize` and `importUndo`. The test media is
    copied into `.claude\mcp\media` (git-ignored, removed afterwards), so edit copies never land in other suites' folders.
  - **Known:** a file Chromium can't read takes the full 15 s before the "couldn't read" answer.
- **M3 Media (the plan):** `import_media` (a file path), `place_media` on the timeline, captions, `optimize`.
- **M4 Output + Image mode: done 2026-11-09.** Ten tools (34 in all):
  - Output: `save_project`, `save_image` (the extension picks the format; any time; quality, transparent) and
    `export_video` (the extension picks the format; it records in real time, then FFmpeg; the wait is up to 3 hours).
  - Image mode: `new_image` (refuses to throw away unsaved changes unless `discard_unsaved`), `image_mode`, `image_size`,
    `canvas_size` (with an anchor), `crop`, `rotate_canvas` and `flip_canvas`.
  - **Never overwrites:** an existing file is refused unless `overwrite: true`, and the tool description tells Claude to
    ask the person first.
  - **Bug found and fixed:** `FXG.ready` called `fxWarmAll()`, which awaits `FXG.ready`. When a layer had an effect
    before the graphics card finished starting, Lumina waited for itself forever, and every export after that hung. For
    example, opening a project with effects straight from a .lumina file. Now `FXG.ready` uses `fxWarmUsed()` instead.
  - **Tests:** mcp-suite steps `saveProject`, `saveImage`, `exportVideo` and `imageMode`. The export test has a 90 s limit
    and a progress log (`R.exLog`), so a stuck export can't freeze the suite again.
- **M4 Output + Image mode (the plan):** `export` (to a path, never overwriting without saying so), `save_project`, PhotoCraft tools.
- **M5 done (2026-11-10).** What was built:
  - **Edit › Allow AI control** (was "Allow Claude to control Lumina") and **Edit › AI connections (MCP)…**. Help › Connect
    Claude… opens the same window at Claude. The menu-bar light says "AI", then "AI · <app>" once an app has called
    (the clientInfo title or name from `initialize`); clicking it opens the window.
  - **The window:** the switch, the status (tools, the last app), a list of cards on the left (Claude app, Claude Code,
    Cursor, VS Code, Gemini CLI, Codex CLI, Devin, LM Studio, Other apps), the tool names, and Test the connection.
    - Buttons that change another app's file (only `mcpServers.lumina`, a `…before-lumina` copy first, refused when the
      file can't be read, only when the app's folder is there): the Claude app (as M1b), **Cursor**
      (`~/.cursor/mcp.json`, with `type: stdio`), **Gemini CLI** (`~/.gemini/settings.json`), **Devin** (was Windsurf;
      `%APPDATA%\devin\mcp_config.json`).
    - Copy only: Claude Code (the `claude mcp add` line), VS Code (`"servers"` JSON for MCP: Open User Configuration),
      Codex CLI (`[mcp_servers.lumina]` TOML for `~/.codex/config.toml`), LM Studio (Program tab › Install › Edit
      mcp.json), Gemini's `gemini mcp add` line, and Other apps (command, argument, setting, JSON).
    - Paths and shapes come from each app's docs, read 2026-11-10. **ChatGPT has no card:** its docs page couldn't be
      read, so whether it can reach a server on this computer is not checked.
  - **The HTTP way in:** `POST /mcp` on the same door (Streamable HTTP: one JSON answer per request, 202 for
    notifications, 405 for GET, no event stream, no sessions). The key goes in `Authorization: Bearer <key>` (or
    `X-Lumina-Key`). Origin refused, Host must be 127.0.0.1 or localhost. **The door keeps its port** (`httpPort` in
    claude-control.json) so the address stays the same; a taken port gets a new one and the window says so. The key is
    never shown: three buttons put the JSON, a `claude mcp add --transport http` line, or the key on the clipboard, only
    while AI control is on.
  - mcp.js is shared: `module.exports = { TOOLS, PROTOCOLS, handle }`, and it reads stdin only when run itself. It sends
    the app's name as `X-Lumina-Client`. `2025-11-25` was added to the protocol versions.
  - The uninstaller flags (`--claude-check` / `--claude-forget`) cover Cursor, Gemini CLI and Devin too.
  - **Tests:** mcp-suite steps `http` (initialize, 202, 34 tools, a call, an image, the app's name in the light, an
    unknown method, GET refused, no key, wrong key, a web page, another Host, a parse error, a batch, off when off, the same
    port after off/on) and `apps` (pretend files: added with others kept and a backup, a file made, an unreadable one left
    alone, the uninstaller sees and forgets them, Remove, the window's cards, the address only while on, the key not in the
    page, Copy refused while off). Found by the tests: Copy the key worked while off; fixed.
  - **Same day, after the user's screenshot (the window spilled out of the 420 px message box) and their ask for Grok,
    ChatGPT, OMP, Microsoft Copilot "and other suggestions":**
    - The modal box gets class `aiwide` (960 px, scrolls inside) only while this window is open; a MutationObserver takes
      it off when the modal hides. The app list is grouped (Chat apps, Code editors, Terminal agents, Anything else),
      scrolls, and its buttons don't shrink (`#aiList > * { flex: none }`).
    - **20 cards.** Buttons for files (as before, with a copy first): Claude app, Cursor, Gemini CLI, Devin, **Copilot CLI**
      (`~/.copilot/mcp-config.json` or `COPILOT_HOME`, `type: local`, `tools: ["*"]`), **OMP** (`~/.omp/agent/mcp.json`)
      and **Kiro** (`~/.kiro/settings/mcp.json`). Copy only: Claude Code, VS Code, Codex CLI, LM Studio, **Zed**
      (`context_servers`), **JetBrains IDEs**, **Cline**, **opencode** (`opencode mcp add … --env …`), **Warp**, Other apps.
    - **Can't connect, and the card says why (docs read 2026-11-10):** **ChatGPT** (custom MCP servers are added by an
      internet address; local servers are for OpenAI-approved partners only), **Grok** (xAI only documents remote MCP
      servers that xAI connects to), **Microsoft Copilot** (Windows' on-device agent registry is a preview for packaged
      apps and doesn't list the Copilot app; the card points to VS Code and Copilot CLI). Lumina stays local on purpose.
    - Not checked: Warp's paste format (given as `mcpServers` JSON), JetBrains' env field, Goose (its docs page was gone),
      OMP's Windows path (its docs only show `~`).
    - Tests added to step `apps`: wide, fits, every card opens without spilling, ChatGPT/Grok say they can't, the box is
      narrow again after Close, new apps not installed, Copilot CLI entry added.
  - **Seen on screen** (a test run's screenshot): fits at 1584 px wide. No real connection from the other apps was tried
    (none are installed here).
- **M5 Other AIs connect to Lumina, from the Edit menu (the plan, asked for by the user 2026-11-10).** Today
  the switch (Edit › Allow Claude to control Lumina) and Help › Connect Claude… are about Claude only. The user wants the
  MCP server in the **Edit** menu, so any AI that speaks MCP can connect, not only Claude.
  - **Edit › AI connections (MCP)…**: one window with the on/off switch (the same door and key as now), the server's
    status, the tools list, and a "connect" card per AI app: Claude app, Claude Code, and other MCP apps (for example
    ChatGPT desktop, Cursor, VS Code / Copilot, Gemini CLI, LM Studio). Each card shows the exact settings text or command
    with Copy; Lumina only writes another app's settings file after the user presses a button, with a backup first (the
    same rule as M1b). Check each app's current way of adding an MCP server when the round starts; don't guess from memory.
  - **Two ways in:** stdio (mcp.js, as now) for apps that start a server themselves, and **a local HTTP address** (MCP's
    Streamable HTTP on 127.0.0.1 only, needing the key) for apps that want a URL. Still no SDK download unless the user
    says yes.
  - Rename the Claude-only wording ("Allow Claude to control Lumina", the "Claude" light) to "AI control" where it isn't
    about Claude in particular; Help › Connect Claude… can stay as a shortcut to the same window.
  - Safety stays as now: off until turned on, 127.0.0.1 only, the key, every edit one Ctrl+Z, never overwrite a file
    without the person saying so. Show which app is connected (the client name from `initialize`) next to the light.
  - **Tests:** mcp-suite steps for the HTTP way (initialize, tools/list, a call, wrong key refused, a web page blocked) and
    for the new window's cards (pretend settings files, as M1b does).
- **Safety:** local only, key, off by default, every edit undoable, a status light in Lumina while Claude is connected.

### Setup replaces the old Lumina (asked for by the user 2026-11-08): done 2026-11-09
**Done:** `build/installer.nsh` (an installer script, not a .bat/.cmd/.ps1). The user picked **No = cancel the setup**
(keeping both copies would drop the old one off Windows' installed-apps list). electron-builder already runs the old
uninstaller quietly before installing and starts the folder page on the old folder; the new `customInit` adds the
question before that (not asked on /S quiet installs or auto-updates), and `customUnInstall` removes the leftover `.lumina`
key on a real uninstall when it still says "Lumina Project". **Tested 2026-11-09:** 0.9.1 installed quietly into the
scratchpad, then the new setup was run with its windows answered through UI Automation: the question showed the old version
and folder; No closed the setup and left 0.9.1 alone; Yes went on, the folder page started on the old folder, it was
changed to another folder, and the install removed the old folder and put shortcuts and the .lumina type on the new copy;
settings in %APPDATA%\Lumina were kept; the main, speed and fx suites passed on the installed copy; the uninstall removed
everything, including `.lumina`. The user's Desktop shortcut was backed up and put back.
**Still to know:** the 0.9.1 and 0.9.2 setups already out there don't have the question, but they don't need it; only the
new setup asks. Not uploaded or released.

**The plan as written:**
Goal: a friend with an older Lumina runs the new setup and it handles the old copy for them. They should not have to
uninstall by hand first.

**What the setup does**
1. **Finds the old Lumina.** It looks for the uninstall entry in the registry under the same `appId`
   (`com.lumina.editor`), so it finds every version from 0.9.0 on, wherever it was installed.
2. **Asks, never forces.** It shows "An older Lumina (version X) is installed in <folder>. Remove it and install
   the new version?" with Yes / No.
   - **Yes:** run the old uninstaller silently, then install.
   - **No:** install anyway, side by side, or cancel. Pick one when building it; ask the user.
3. **Keeps the folder choice.** The folder page still shows. It starts on the old Lumina's folder, and the friend can change it.
4. **Keeps the friend's own things.** Projects, settings, the Whisper model and recent files live outside the install folder.
   They are never deleted. Say so in the question.
5. **Cleans up what the old uninstaller left.** The leftover `HKCU\Software\Classes\.lumina` key (see C15 above) is removed,
   and shortcuts and the .lumina file type point at the new copy.

**How:** electron-builder's NSIS settings in package.json (`oneClick: false` and
`allowToChangeInstallationDirectory: true` are already set), plus a custom include, `build/installer.nsh`, using the
`customInit` / `customUnInstall` macros for the question and the cleanup. An `.nsh` is an installer script, not a
.bat/.cmd/.ps1. Still tell the user when it's created.

**Test:**
1. Install an older setup (e.g. 0.9.2) into the scratchpad, silently.
2. Run the new setup and check each path: Yes, No, and a changed folder.
3. Check the old files are gone, the new version runs, settings and projects are kept, and the suites pass on the installed copy.
4. Uninstall afterwards.

Don't upload the setup, and don't release it, without the user saying so.

### Notes for friends' installs
**Whisper:** the model is not in the setup. Each friend's Lumina downloads it (77 MB) the first time they click Make
captions, and the button says so.
**Unsigned:** Windows SmartScreen will warn friends ("Windows protected your PC" → More info → Run anyway); tell the user.
### EffectCraft, next
EffectCraft carries on at **Round 24 (Channel)**.
(Tip for then: check which other `.wgsl` files a shader file calls into, in EffectCraft's `crates/gpu/src/context.rs`
module list; Round 7's `fx_color` needed `fx_lut` compiled alongside it, Round 9's `fx_pixel2` needed `fx_stylize`.)

Every EffectCraft round follows the same steps:
1. Port the effects.
2. Self-test them on known colour patches.
3. Run a speed check.
4. Update `effects.png`.
5. Rebuild.
6. Run all twelve suites.

---

## Order (set by the user 2026-11-07)
Goal: **Lumina is After Effects, Premiere Pro, Photoshop and CapCut all in one** (Premiere Pro added by the user 2026-11-08).

0. **CapCut phase: done (C1–C15, finished 2026-11-07).** Beat sync, bookmarks, velocity curves, anime VFX, ripple editing,
   multi-select, mask shapes, canvas background, captions, stickers, separate audio, clipboard and keyframe tools, preview
   zoom/pan, graph editor, the beginner layout (tool rail, quick bar, welcome + tips) and the 0.9.0 friends test release.
   The step-by-step record is kept below for reference.
1. **Finish EffectCraft** (https://github.com/storytold/effectcraft): every effect, a Round at a time.
   **Where we left off: Rounds 1–23 and the Round 6 leftovers are done; Round 24 (Channel) is next.** About 95
   effects are left, in Rounds 24–31+ (Reshape and Smear wait for Masks II, A7).
   - Round 11: Color Key, Linear Color Key, Luma Key, Color Range, Difference Matte, Extract, Inner/Outer Key, Color Difference Key
   - Later Rounds: Lumetri, keying (Linear Color Key, Keylight), particles, time effects, Shatter and the rest
   - **Foundations, built during this step:** precomps (compositions inside compositions), blend modes, track mattes and parenting.
     They go in just before the effects that need a second layer or other frames (from Round 16, Displacement Map, onward).
   - **After Effects' other features (rounds A1–A12, written 2026-11-09 at the user's request).** EffectCraft is only AE's
     effects; these are the rest of After Effects. They come after the EffectCraft rounds unless the user says otherwise
     (the foundations above, precomps / parenting, may pull parts of A1 forward). About 12 rounds, on top of EffectCraft's ~20.
     **Lumina already has (some only in part):** keyframes and the graph editor, mask shapes, track mattes, blend modes, point
     motion tracking, expressions as presets only (wiggle, pulse, loop), frame blending, AI background removal, a content-aware
     fill box, 3D model layers with a camera tilt, bookmarks (markers), audio solo.

     | Round | Theme | What |
     |---|---|---|
     | A1 | Layer basics | Parenting and null objects, adjustment layers, solo / shy / lock / guide layers, label colours, precomps (if not already done as a foundation), comp settings (any size, frame rate, pixel aspect, background). |
     | A2 | Keyframe tools | Easy Ease in/out, keyframe velocity box, roving keyframes, motion paths drawn in the viewer, Motion Sketch, Smoother, Wiggler, time-reverse keyframes, Sequence Layers, Exponential Scale, Convert Audio to Keyframes. |
     | A3 | Time and motion blur | Time remapping, time stretch, freeze frame, frame blending modes (frame mix, pixel motion), motion blur (layer switch, shutter angle and phase). |
     | A4 | Real expressions | An expression editor with a pick whip: `wiggle()`, `loopOut()`, `time`, `valueAtTime()`, `linear()`/`ease()`, links between properties and layers; Expression Controls (Slider, Angle, Checkbox, Color, Point, Layer, Dropdown). |
     | A5 | Shape layers | Rectangle / ellipse / polygon / star tools and pen paths in one layer, gradient fills and strokes, dashes; Trim Paths, Repeater, Merge Paths, Offset Paths, Pucker & Bloat, Round Corners, Twist, Wiggle Paths, Zig Zag. |
     | A6 | Text animators | Per-character animators with range selectors (start / end / offset), wiggly and expression selectors, text on a path, per-character 3D, source text keyframes, paragraph text boxes. |
     | A7 | Masks II | Mask modes (add, subtract, intersect, difference), mask expansion, variable-width feather, mask path keyframes, mask tracking, RotoBezier. Then EffectCraft's Reshape and Smear (they need several pen masks on a layer). |
     | A8 | 3D | Any layer as a 3D layer; cameras (one / two node, depth of field); lights (point, spot, parallel, ambient) with shadows; material options; 3D views (front, top, custom); extruded text and shapes. |
     | A9 | Tracking | Tracker panel: one / two / four-point (corner pin) tracking, Stabilize Motion, Warp Stabilizer, 3D Camera Tracker (place layers in the tracked scene), planar tracking (lite). |
     | A10 | Roto and cleanup | Roto Brush (AI, carried across frames) with Refine Edge; Content-Aware Fill for video (across frames, not one box). |
     | A11 | Puppet | Puppet Position, Starch, Bend and Overlap pins, Advanced pins, recording pins by dragging. |
     | A12 | Output and workflow | Render Queue (several items, output modules, templates), proxies, Collect Files, preview options (resolution, region of interest, skip frames), rulers, guides, grids, safe zones, snapshots, Essential Graphics templates (shared with the Premiere Pro list). |
2. **Start and finish PhotoCraft** (https://github.com/storytold/photocraft) as Lumina's **Image mode**, the Photoshop side.
   **Started 2026-11-08 at the user's request, before EffectCraft was finished** (EffectCraft resumes at Round 8 when the user says).

### PhotoCraft rounds (written 2026-11-08)
| Round | Theme | What |
|---|---|---|
| P1 ✅ | Save as image | The frame at the playhead in 16 formats: PNG, JPEG, WebP, AVIF, HEIC, GIF, TIFF, layered PSD, BMP, PDF, SVG, EPS, AI, ICO, TGA, JPEG 2000. Quality and see-through background settings. |
| P2 ✅ | Animated images, sequences, opening images | Animated GIF / WebP / APNG from a range; PNG/JPEG sequences; import TIFF, PSD (flattened), TGA, HEIC, AVIF, JP2, BMP and others through FFmpeg (`image:toPNG` is already there). RAW needs a decoder FFmpeg doesn't have: decide then. |
| P3 ✅ | Image mode basics | An **Image** workspace and rail tab; a still-picture document (canvas size, no timeline); Layers panel with thumbnails, opacity, lock and eye; crop, canvas size, image size, rotate/flip. |
| P4 ⏸ (saved for later) | Painting | Paint layers; brush (size, hardness, opacity, flow, spacing), eraser, pencil; colour picker, swatches, eyedropper; fill and gradient tools. |
| PW | Workspaces (added 2026-11-09, the user: Lumina as After Effects, Photoshop, CapCut and Premiere Pro all in one, "seamless") | Goes right after P4, so the tools from P5 onward land in their final home. A workspace menu (top right, like "Essentials") switches panel layouts over the same project: **Edit** (Premiere: timeline, source/program views, bins), **Motion** (After Effects: layers, keyframes, Effects & Presets), **Image** (Photoshop), **Quick** (CapCut: media browser, templates). Image mode switches to Image on its own. Photoshop frame: a tool column with grouped tools, an options bar under the menus that changes with the tool, Properties/Adjustments tabs, Layers/Channels/Paths tabs (Kind filters, blend menu, Opacity and Fill, lock buttons, bottom buttons: link, fx, mask, adjustment, group, new, delete), History panel, status bar (zoom %, colour mode · bits, size, layer count, last action). Not a Beginner/Pro switch: every setting stays shown, only the layout changes. Adobe-like, no Adobe names or logos. Panels remembered per workspace; Window › Reset workspace. |
| P5 | Selections | Rectangle/ellipse marquee, lasso, polygon lasso, magic wand, select all/none/inverse, feather, grow; copy/cut/paste to a new layer; delete or fill a selection. |
| P6 | Adjustment layers | Brightness/Contrast, Levels, Curves, Hue/Saturation, Color Balance, Black & White, Photo Filter, Invert, Posterize, Threshold, Gradient Map, Vibrance, Exposure (reuse Lumina's grading and EffectCraft colour effects). |
| P7 | Layer styles | Drop shadow, inner shadow, outer/inner glow, bevel and emboss, stroke, colour/gradient/pattern overlay. |
| P8 | Masks and groups | Painted layer masks, clipping masks, layer groups, smart objects (lite). |
| P9 | Retouching | Clone stamp, healing and spot healing, patch, content-aware fill (Lumina's inpaint shader), red-eye. |
| P10 | Transform | Free transform, perspective, distort, warp, liquify. |
| P11 | Type and vectors | Photoshop-style text options, shape tools, pen paths; true vector SVG/PDF export of shapes and text. |
| P12 | Opening layered files | PSD with layers (PhotoCraft's `crates/psd` as the guide), OpenRaster; Camera Raw-lite. |
| P13 | Filters | Blur gallery, Smart Sharpen / Unsharp Mask, noise, distort, mostly from EffectCraft effects. |

After those two (only when the user says so): Claude's own features, fixes and tweaks — motion blur, pen-tool masks with
feather animated over time, the on-hold list below, and fixes spotted along the way.

### CapCut phase record (done)
Sources:
   - **OpenCut** (https://github.com/opencut-app/opencut, MIT). Its `main` branch is a rewrite with almost no features yet,
     so the working editor is **opencut-classic** (https://github.com/opencut-app/opencut-classic, MIT, v0.3.0,
     commit `cf5e79e9`). That is the version opencut.app runs.
   - The CapCut anime-edit notes in WORKPLAN.md section 5.

   Steps, in order (details in WORKPLAN.md section 5):
   - **C1 Beat sync:** detect beats in the music, show beat markers on the timeline, snap clips, cuts and keyframes to them,
     and auto cut on beat.
   - **C2 Bookmarks** (OpenCut): timeline markers with notes, colour labels and an optional duration.
   - **C3 Velocity curves:** a bezier speed-curve editor; CapCut-style presets (Montage, Hero, Bullet, Jump cut, Flash in/out);
     freeze frame; speeds above 400%; keep pitch when sped up (OpenCut); smooth frame blending.
   - **C4 GPU anime VFX:** RGB split / chromatic aberration, edge glow, flash overlays, VHS glitch and camera shake,
     all triggerable by beats.
   - **C5 Ripple editing** (OpenCut): closing a gap pulls the later clips along.
   - **C6 Multi-select** (OpenCut): select several clips, then move and resize them together.
   - **C7 Mask shapes** (OpenCut): split, star, heart, diamond and cinematic bars, with feather and stroke,
     added to Lumina's rectangle and ellipse.
   - **C8 Canvas background** (OpenCut): blur, solid colour or gradient behind the video (CapCut's blurred background for
     vertical clips).
   - **C9 Captions** (OpenCut): import SRT/VTT transcripts as styled captions. Auto captions (speech to text) is included,
     but it downloads a speech model, so I'll ask you first.
   - **C10 Stickers** (OpenCut): shapes and emoji/flag stickers.
   - **C11 Separate audio** (OpenCut): split a video's sound into its own audio clip.
   - **C12 Clipboard and keyframe tools** (OpenCut): paste media from the clipboard, copy/paste keyframes, and a keyframe lane
     per property on a clip.
   - **C13 Preview zoom and pan** (OpenCut). Done.
   - **C14 Graph editor** (OpenCut): drag bezier handles to shape easing between keyframes. This was moved forward from step 4. Done.
   - **C15 Friends test release** (the user's request, right after C14): a setup file to send to friends. Done (0.9.0,
     2026-11-07): `dist\Lumina Setup 0.9.0.exe`, About box, Help › Send feedback…, test-installed and uninstalled cleanly.
     Not done (dropped for now): installer page polish, crash log. Sharing the setup is the user's job; never upload it.
   - C1–C12 and the beginner layout B1, B2, B4 are all done too (B3 was built and then removed).

---

## Where things stand (updated 2026-11-08)
- **Round FP2 done (2026-11-10): the Composition viewer floats too.** The user tried FP: "I cant pull the video player out".
  - The viewer (`#pComp`, `FLOAT.comp`, "Composition") floats like the other panels: its header, its button, or Window ›
    Float in its own window. F11 in its window makes it full screen. With it away, Project and the right column share its
    room in Lumina (applyPanels).
  - It needed no new GPU setup: `#out` is a 2D canvas the GPU's off-screen pictures are drawn into, so it moves as it is.
  - **The drawing loop** (`loop`) now runs on the frames of the window the viewer is in, so it keeps playing on another
    screen with Lumina minimized; a minimized window gets no frames, so `loopWin()` picks the one that is showing, and a
    check every 250 ms starts the loop again if it stalled. `fitPreview` uses the viewer window's screen scale.
  - **main.js:** panel windows get `backgroundThrottling: false` (as the main window has); without it the floating
    viewer stopped drawing when another window covered it.
  - Dragging back over Lumina ignores a hidden panel window (Windows reports Lumina's own place for it then).
  - **Header drags don't select text:** a press on a header isn't a selection start, and every window is unselectable
    (`html.nosel`) while a header is dragged.
  - Not yet: menus, toasts and the "pick a file" click on the empty viewer still open in the main window.
  - Test: the timeline suite's floatPanels step (`comp`, `nosel`).
- **Round FP done (2026-11-10): Floating panels.** The user: "would we be able to drag tabs outside of Lumina that way
  we can expand it and show the full list and scale the Tab". Project, Preview, Properties / Effect Controls, Layers and
  the Timeline can each leave the Lumina window for a window of their own, to move anywhere (a second monitor too), size
  freely or make full screen (F11 in that window).
  - Three ways: drag the panel's header out of Lumina, press the button at the end of its header (it turns into a
    "put back" button), or Window › Float in its own window. Back: drag the header over Lumina, press the button, close
    the window, or Window › Put all panels back.
  - The panel itself moves (Electron's window.open of a blank same-origin page, the panel's node moved in), so it is the
    same live panel; `$` / `$$` also look in the floating windows (`POP`). Lumina's styles, theme and mode follow it there;
    the keyboard works from it (keys are passed on to Lumina's own handlers).
  - Lumina keeps the windows' places and sizes (localStorage `lumina.floating`) and opens them again at start (not in
    self tests). Closing Lumina closes them (electron/main.js).
  - Not yet: tips that point at a floating panel still show in the main window. (The viewer came in FP2.)
  - Test: the timeline suite's floatPanels step.
- **EffectCraft Round 23 done (2026-11-11): Transitions.** A new **Transition** group with **Block Dissolve**, **Card
  Wipe**, **Gradient Wipe**, **Iris Wipe**, **Linear Wipe**, **Radial Wipe**, **Venetian Blinds**, **CC Glass Wipe**, **CC
  Grid Wipe**, **CC Image Wipe**, **CC Jaws**, **CC Light Wipe**, **CC Line Sweep**, **CC Radial ScaleWipe**, **CC Scale
  Wipe**, **CC Twister** and **CC WarpoMatic** (17). These are effects on a layer, separate from Lumina's own clip
  transitions.
  - Kernels: fx_transition's ftr_blocks / ftr_mul / ftr_radial_scale / ftr_scale / ftr_glass / ftr_image_wipe / ftr_jaws /
    ftr_line_sweep / ftr_twister / ftr_react_* / ftr_warpo (host code from fx_transition.rs); fx_generate's gen_linear_wipe /
    gen_venetian / gen_radial_wipe / gen_gradient_wipe (fx_generate.rs, f64 edges as hi/lo tables); fx_light's flt_wipe (CC
    Light Wipe). New Lumina shader shaders/lumina_trans.wgsl for what EffectCraft does on the CPU: Iris Wipe (lt_iris), CC
    Grid Wipe's tiles (lt_grid, f32 instead of EffectCraft's f64 coverage table), Gradient Wipe's placement and Card Wipe's
    back and gradient layers (lt_place), and Card Wipe's cards (lt_cards: card3d's camera and lighting and sim2's pieces
    worked out in JavaScript, the cards binned into 16-pixel tiles and drawn far to near). Nothing was downloaded.
  - Distances and edges are measured over the layer's on-screen box, and the angles turn with the layer. CC Jaws, CC Radial
    ScaleWipe, CC Scale Wipe, CC Glass Wipe, CC Twister and CC WarpoMatic stay inside the layer's box, as EffectCraft's buffer
    keeps them; Card Wipe's cards can turn out of it. Other layers (gradient, reveal, backside, reactor) are used as they sit
    in the frame, except Gradient Wipe's gradient and Card Wipe's back, which are placed over the layer's box. Card Wipe
    offers Camera Position and Corner Pins and a distant or point light (no comp camera or comp light yet); its Back Layer
    can be None, This Layer or another layer.
  - Speeds 5.1–6.6 ms a frame at 1080p.
  - Test: the fx suite's transitionKernels, transitionTri (0 %, 50 %, 100 % for each), transitionDetails, transitionMenu
    and round23speed steps.
- **EffectCraft Round 22 done (2026-11-11): Perspective.** A new **Perspective** group with **Drop Shadow**, **Radial
  Shadow**, **Bevel Alpha**, **Bevel Edges**, **CC Cylinder**, **CC Sphere**, **CC Spotlight**, **CC Environment** and **3D
  Glasses** (9).
  - Kernels: kernels.wgsl's shadow_make / shadow_combine (Drop Shadow, host code from effects.rs); fx_transition's ftr_rshadow,
    ftr_under, ftr_cylinder, ftr_sphere, ftr_spot, ftr_plane, ftr_env, ftr_shift, ftr_glasses (host code from fx_transition.rs);
    fx_extra's fxe_alpha / fxe_bevel_alpha / fxe_bevel_edges (new family; EffectCraft's fx_extra.rs wasn't saved, so the
    bevels' packing comes from fx_extra.wgsl's notes and perspective.rs, with gauss_plane as `fxGaussPlane`). Nothing was
    downloaded.
  - Drop Shadow's direction and Bevel Alpha's light angle turn with the layer. Radial Shadow, CC Cylinder, CC Sphere, CC
    Spotlight's Light Only and 3D Glasses stay inside the layer's box, as EffectCraft's layer buffer keeps them (Radial
    Shadow's Resize Layer lets the shadow out). Bevel Edges, CC Cylinder, CC Sphere and CC Spotlight treat the layer as its
    upright box in the frame, and their light doesn't turn with a rotated layer. 3D Glasses' side-by-side and over-under
    views split the frame, not the layer's own box. CC Environment's environment layer is mapped onto its on-screen box as
    last drawn.
  - Speeds 4.2–5.2 ms a frame at 1080p.
  - Test: the fx suite's perspectiveKernels, perspectiveDetails, perspectiveMenu and round22speed steps.
- **EffectCraft Round 21 done (2026-11-11): Noise & Grain.** A new **Noise & Grain** group with **Noise**, **Add Grain**,
  **Match Grain**, **Remove Grain**, **Dust & Scratches**, **Median**, **Median (Legacy)**, **Noise Alpha**, **Noise HLS**,
  **Noise HLS Auto**, **Turbulent Noise** and **Curl Noise** (12).
  - Kernels: fx_noise's fxn_quant / fxn_median / fxn_median_huang (median_private) / fxn_median_out, fxn_noise_alpha,
    fxn_noise_hls, fxn_fractal, fxn_gf_guide / fxn_gf / fxn_rg_*; fx_generate's gen_noise and gen_grain_planes /
    gen_grain_apply; fx_particles' fxp_curl_* (new family). Host code from fx_noise.rs and fx_generate.rs; Curl Noise's from
    noise2::curl_noise and the kernels' own notes (EffectCraft's fx_particles.rs wasn't needed).
  - Lumina's `shaders/lumina_noise.wgsl` (ln_grain_matte, ln_boxes, ln_plane_view, ln_affine) draws what EffectCraft does
    on the CPU: the Blending Matte views, the Noise Samples boxes and Match Grain's normalised planes.
  - Remove Grain and Match Grain measure the grain on the picture read back (8 bits) in the flattest sample boxes, as
    EffectCraft does on the CPU. Match Grain works out its planes' spread once for the grain's size and softness, then keeps
    it (EffectCraft measures it every frame; the spread hardly changes from frame to frame).
  - Left out: Remove Grain's Temporal Filtering (it needs the layer's neighbouring frames through its effects, which comes
    with the Time effects, Round 25) and the one-choice "Sampling Process" menu (Automatic).
  - The grain, noise and Curl Noise's flow line up with the frame, not the layer's own pixels (as Round 18's Block Load);
    Turbulent Noise and Curl Noise turn with the layer. The Preview Region is an upright box in the frame.
  - Speeds 4.5–12.7 ms a frame (Median radius 3); Remove Grain 41 ms (it reads the picture back to measure the grain).
  - Test: the fx suite's noiseKernels, noiseDetails, noiseMenu and round21speed steps.
- **EffectCraft Round 20 done (2026-11-10): Generate II (light).** Generate gets **Advanced Lightning**, **Lens Flare**,
  **Beam**, **CC Light Burst 2.5**, **CC Light Sweep**, **CC Glue Gun**, **CC Threads** and **Fractal** (24 in the group now).
  - Kernels: fx_gen2's fg2_segs (linear core), fg2_pair, fg2_adv_bolt, fg2_beam, fg2_flare, fg2_glue, fg2_threads, and
    fx_light's flt_burst / flt_sweep; host code from fx_gen2.rs and fx_light.rs, CPU plans from generate2.rs / generate3.
  - Advanced Lightning's bolt is EffectCraft's lightning_segments ported to JS with its own 64-bit random numbers (BigInt),
    so the same Conductivity State grows the same bolt; Alpha Obstacle reads the layer's alpha back.
  - Fractal stays on the CPU in doubles, as in EffectCraft (f32 escape counts differ near the set): about 0.3 s to work out
    at 1080p, then kept until a setting, the frame size or the layer's place changes (about 9 ms a frame after that).
  - CC Light Sweep and CC Threads' directions turn with the layer; CC Glue Gun's Time Span is left out (EffectCraft draws
    the beads at the brush only, on the CPU and the GPU).
  - Speeds 5.6–9.3 ms a frame; Advanced Lightning 17.8 ms (its glow blur).
- **EffectCraft Round 19 done (2026-11-10): Generate I (shapes & fills).** Generate gets **Fill**, **Checkerboard**,
  **Circle**, **Ellipse**, **Cell Pattern**, **Stroke**, **Scribble**, **Vegas**, **Write-on**, **Paint Bucket**,
  **Eyedropper Fill** and **Radio Waves** (16 in the group now).
  - New kernel family `fx_gen2` (EffectCraft's fx_gen2.wgsl: fg2_segs, fg2_convex, fg2_paint, fg2_bucket, fg2_bucket_cov,
    fg2_eyedropper, fg2_radio); Fill is the base pointwise op 7; Checkerboard and Cell Pattern are fx_generate's.
  - Circle, Ellipse and Cell Pattern's five HQ patterns are drawn only on the CPU in EffectCraft; Lumina has them as
    `shaders/lumina_gen.wgsl` (lg_circle, lg_ellipse, lg_cell_hq), ported operation for operation.
  - The geometry is EffectCraft's CPU plans ported to JS (stroke/scribble/vegas/write-on plans, marching-squares contours,
    flood fill, distance fields), rasterised on the graphics card through the same 16 × 16 tile tables.
  - "Mask" means the layer's own mask (Lumina has one a layer): Stroke, Scribble, Vegas (Mask) and Radio Waves (Mask)
    follow it. Fill's Fill Mask / All Masks and the feathers that go with them are left out (the mask already cuts the
    layer); Scribble's mask choice is one checkbox, "Follow the mask's Invert". Vegas' "If Layer Sizes Differ" is left
    out (other layers are used as they sit in the frame).
  - Write-on and Radio Waves ("Parameters Are Set At Birth") read the effect's keyframed settings at earlier times.
  - Speeds 5.5–17 ms a frame, except Vegas on image contours (about 52 ms: it reads the picture back and traces the
    contours on the CPU, as EffectCraft does). Paint Bucket and Eyedropper Fill also read the picture back (17 / 10 ms).
- **EffectCraft Round 18 done (2026-11-10): Stylize II (CC).** Stylize gets **CC Block Load**, **CC Burn Film**,
  **CC Glass**, **CC HexTile**, **CC Kaleida**, **CC Mr. Smoothie**, **CC Plastic** and **CC RepeTile** (24 in the group now).
  - All EffectCraft's own kernels: `fx_pixel2`'s `fp2_block_means`, `fp2_block_load`, `fp2_burn`, `fp2_plane`, `fp2_box`,
    `fp2_bump`, `fp2_hextile` and `fp2_smoothie`; `fx_stylize`'s `fxs_warp` mode 8 (Kaleida) and `fxs_repetile`. No new WGSL.
  - Glass's Bump Map, Plastic's Bump Layer and Mr. Smoothie's Flow Layer are any other layer as it sits in the frame
    (or the layer itself). The "AE Lights" choice is left out (Lumina has no lights yet; After Effects Round A8).
  - HexTile works out its per-pixel source positions on the CPU in double precision (as EffectCraft does) and keeps them
    until a setting changes. Kaleida, HexTile and the light direction turn with the layer.
  - Block Load's blocks and Burn Film's noise line up with the frame, not the layer's own pixels. RepeTile grows from the
    layer's box as it sits in the frame (exact for layers that aren't rotated).
  - Speeds 5.2–12.2 ms a frame (HexTile the slowest: its table is sent to the graphics card each frame).
- **EffectCraft Round 17 done (2026-11-10): Stylize I.** Stylize gets **Brush Strokes**, **Cartoon**, **Color Emboss**,
  **Roughen Edges**, **Scatter**, **Texturize**, **CC Threshold** and **CC Threshold RGB** (16 in the group now).
  - All EffectCraft's own kernels: `fx_stylize`'s `fxs_brush`, `fxs_roughen`, `fxs_scatter`, `fxs_tex_luma`,
    `fxs_texturize` and `fxs_point` modes 3 and 4; `fx_warp`'s `fxw_coloremboss`, `fxw_luma`, `fxw_keep_alpha`,
    `fxw_shock`, `fxw_edges` and `fxw_cartoon`. Cartoon's smoothing is `fxGuided` (fx_noise's `fxn_gf` and box passes).
    No new WGSL.
  - Brush Strokes works out its stroke cells on the CPU (as EffectCraft does) and keeps them until a setting changes.
  - Texturize's Texture Layer is any other layer, as it sits in the frame (tiled, centred or stretched in the two
    layers' own pixels; exact for layers that aren't rotated).
  - Random patterns (Scatter, Brush Strokes, Roughen Edges) differ per layer, from the layer's id, like EffectCraft's
    per-layer seed. Roughen Edges at its defaults bites about a pixel into the edge, as EffectCraft's does.
  - Speeds 4.4–8.5 ms a frame.
- **EffectCraft Round 16 done (2026-11-10): Distort III (warps).** Distort gets **Warp**, **Bezier Warp**, **Mesh Warp**,
  **Displacement Map**, **Twirl (Legacy)** and **Detail-preserving Upscale** (34 in the group now).
  - Warp is `fx_warp`'s `fxw_warp`; Bezier and Mesh Warp build a triangle grid in JS (`fxGridWarp`) for `fx_distort`'s
    `dst_mesh`; Displacement Map is `dst_displace` (map = any other layer, Center / Stretch / Tile, or the layer itself);
    Twirl (Legacy) is `fxs_warp` mode 10. Upscale isn't on EffectCraft's GPU: here it's a bicubic `warp_blend` about the
    layer's centre plus an unsharp pass, scaled in place (as EffectCraft does on adjustment layers).
  - Mesh Warp's mesh is a text box of "x,y" pixel offsets for now (EffectCraft drags it on the canvas); dragging the grid
    in the viewer is still to do.
  - Warp's Fisheye and Twist at strong settings: EffectCraft solves those on the CPU because the f32 solve can land on
    other pixels near the fold; Lumina uses the GPU solve, so they may differ slightly there.
  - Left out: Upscale's Alpha (bilinear) choice and Displacement Map's Expand Output (Lumina's working image is
    frame-sized already).
  - **Moved:** Reshape and Smear to Masks II (A7, they need several pen masks); Rolling Shutter Repair to Round 25 (it
    reads the frames either side).
  - Speeds 7.5–10.6 ms a frame.
- **EffectCraft Round 15 done (2026-11-10): Distort II (CC).** Distort gets **CC Bend It**, **CC Bender**, **CC
  Blobbylize**, **CC Flo Motion**, **CC Griddler**, **CC Page Turn**, **CC Ripple Pulse**, **CC Slant**, **CC Smear**,
  **CC Split**, **CC Split 2**, **CC Tiler** and **CC Power Pin** (28 in the group now).
  - New kernel families: `fx_warp` (Bend It, Page Turn) and `fx_transition` (Bender, Blobbylize: `ftr_plane`, `ftr_blob`).
    The rest are `fx_stylize`'s `fxs_warp` modes 4, 5, 6, 11, 12, `fxs_table`, `fxs_griddler` and `fxs_flomotion`.
  - Flo Motion and Power Pin work in the layer's own pixels (scale and the top-left corner's frame position); that's exact
    for a layer that isn't rotated. Blobbylize's Blob Layer is any other layer, where it sits (like Compound Blur's).
  - Ripple Pulse runs on the layer's own time; Pulse Level is meant to be keyframed.
  - Left out: Power Pin's Unstretch (EffectCraft draws it on the CPU only).
  - Tests: each moves the card with its defaults and leaves it exactly alone when switched off, plus spot checks
    (Slant's lean, Tiler's repeats, Griddler's gaps, Split's gap, Power Pin's squeeze, Blobbylize's cut-away).
  - Speeds 6.1–9.3 ms a frame.
- **EffectCraft Round 14 done (2026-11-10): Distort I.** Distort gets **Spherize**, **Polar Coordinates**, **Mirror**,
  **Offset**, **Magnify**, **Corner Pin**, **Transform** and **Optics Compensation** (15 in the group now).
  - Mirror, Spherize, Polar and Optics are `fx_stylize`'s `fxs_warp` modes 1, 2, 3, 7; Offset is `fxs_table`, Magnify
    `fxs_magnify` (its 18 blending modes in `MAGNIFY_MODES`). Corner Pin and Transform draw through `kernels.wgsl`'s
    `warp_blend`, with the matrices built in JS (`m3*` helpers). No new WGSL.
  - Transform works in the layer's own axes (it turns with the layer). Its motion blur uses Shutter angle with 16 samples
    when "Use the comp's shutter angle" is off; with it on it renders sharp, since Lumina has no comp motion-blur switch
    yet (Round A3). Only checked on a still layer so far (it stays sharp); an animated check would need keyframes.
  - Polar Coordinates works in a box starting at (0, 0), so a layer elsewhere is shifted there and back by whole pixels.
  - Settings that only grow EffectCraft's buffer (Optics' Resize, Magnify's Resize Layer) are left out: Lumina's
    working image is already frame-sized.
  - **Smear moved to Round 16**: it needs two masks on the layer, which comes with Reshape there. Round 15's "Smear" is
    CC Smear.
  - Speeds 5.3–6.0 ms a frame.
- **EffectCraft Round 13 done (2026-11-10): Blur & Sharpen II.** Blur & Sharpen gets **Bilateral Blur**, **Smart Blur**,
  **Fast Box Blur**, **Channel Blur**, **Compound Blur**, **CC Cross Blur**, **CC Radial Blur**, **CC Radial Fast Blur** and
  **CC Vector Blur** (15 in the group now); **Reduce Interlace Flicker** sits in a new **Obsolete** group, as in EffectCraft.
  - All of it runs EffectCraft's own kernels: `fx_noise`'s `fxn_edge`, `fxn_smart_edges`, `fxn_pick`, `fxn_cblur_out`,
    `fxn_cb_map`, `fxn_cb_level`; `fx_pixel2`'s `fp2_cross`, `fp2_radial`, `fp2_plane`, `fp2_box`, `fp2_vector`;
    `fx_generate`'s `gen_ccradialfast`. Fast Box's fractional radius uses `lumina_key`'s `lk_mix`. No new WGSL.
  - Compound Blur's Blur Layer is any other layer (like Color Link's source): Stretch map to fit lays that layer's box
    over this one's, otherwise the map sits where the layer is.
  - **Camera-Shake Deblur moved to Round 25 (Time)**: it swaps in sharper patches from neighbouring frames, which needs
    the other-frames access that round builds.
  - Lumina doesn't grow the layer's buffer as EffectCraft does (`b.pad`): the frame-sized working image already has
    room around a layer, so only streaks past the frame's edge are cut.
  - Speeds 5.8–10.2 ms a frame; Compound Blur 17.4 ms (five blur levels).
- **EffectCraft Round 12 done (2026-11-09): Keying II + mattes.** Keying gets **Key Light**, **Screen Key**, **Spill
  Suppressor**, **Advanced Spill Suppressor**, **Key Cleaner**, **Unmult** and **CC Simple Wire Removal**; a new **Matte**
  group has **Simple Choker**, **Matte Choker**, **Refine Soft Matte** and **Refine Hard Matte**. 15 Keying + 4 Matte now.
  - Spill Suppressor, Advanced Spill, Unmult, Screen Key and the chokers are `fx_key.wgsl`'s `fxk_point` ops (7, 8, 10,
    22/23, 24, 26, 28–34); Key Light is `fx_color.wgsl`'s `fxc_kl_*` kernels; Wire Removal is `fx_pixel2`'s `fp2_wire`.
    Key Cleaner, set_alpha, Refine's guided filter and decontamination are Lumina's own `lumina_key.wgsl` kernels
    (`lk_pairs`, `lk_setalpha`, `lk_clean`, `lk_decon`, `lk_rpack`, `lk_refine`).
  - Key Light's long list of settings is split by a **Show** menu (Main, Screen matte, Foreground / Edge color correction,
    Source crops). Like EffectCraft, it always despills, even at Screen Gain 0.
  - Advanced Spill's Standard method finds the key channel itself from the picture (read back at 320 px).
  - Left out (they need other frames): Refine Matte's Reduce Chatter and motion blur; Wire Removal's Frame Offset works as
    Displace.
  - Tests (`.claude\fx`, steps `spillsuppressor` … `wireremoval`, `round12speed`): e.g. Spill Suppressor on blue turns the
    blue patch (40, 60, 60); Unmult makes grey half see-through; Screen Key and Key Light take out the green patch and keep
    red; Key Cleaner at 200 % alpha contrast pushes a 25/60 alpha to 1/3; Wire Removal fades a black|white edge to grey on
    the line. About 4.5–7.3 ms a 1080p frame each.
- **EffectCraft Round 11 done (2026-11-08): Keying I**, a new Keying group in the Effects menu:
  - **Color Key**, **Luma Key**, **Color Range**, **Extract**, **Difference Matte** and **Color Difference Key** run in
    EffectCraft's `fx_key.wgsl` (`fxk_point` ops 1, 2, 3, 4, 6 and 9, then op 5 to apply the matte); **Linear Color Key**
    in `fx_color`'s `fxc_point` op 8. Edge Thin / Edge Feather (`fxThinFeather`) use `fx_noise`'s `fxn_morph` and a blur.
  - **Difference Matte** compares with another layer as it shows in the frame (it can be hidden); "If layer sizes differ"
    is left out, since both are compared in the frame.
  - **Inner/Outer Key** is Lumina's `shaders/lumina_key.wgsl`, a port of EffectCraft's `keying2::inner_outer_key`. Lumina
    layers have one mask (already applied before effects), so the inside and outside are shapes drawn on the effect
    (Rectangle, Oval, Diamond, Star, Heart; center, width, height, angle). The Cleanup Foreground / Background brush paths are
    left out (Lumina has no paths yet).
  - Tests (`.claude\fx`, steps `colorkey` … `innerouterkey`, `keyingMenu`, `round11speed`): each keyer's matte checked on
    the colour patches, e.g. Color Difference Key on blue keeps 0.372 of the blue patch (15, 22, 82); Inner/Outer Key with a
    20 px highlight radius takes out red beside the white patch. About 4–7 ms a frame each.
- **EffectCraft's Round 6 leftovers done (2026-11-08):**
  - **Hue/Saturation** has a Channel Control menu: Master or one of Reds, Yellows, Greens, Cyans, Blues, Magentas, each with
    its own hue / saturation / lightness and range start / end / falloffs (`HS_RANGES`). Ranges with a change run in
    `fx_tone`'s op 14 (`hue_saturation` in EffectCraft's `fx_tone.rs`); Master and Colorize alone stay on the pointwise kernel.
  - **Levels** has a Channel menu (RGB, Red, Green, Blue, Alpha) with each channel's five controls; any channel's change
    runs in op 15 (`levels`), RGB first, then the channel, both clipping (Lumina is 8 bits).
  - **Curve graphs** (setting type `curve`, stored as text "x,y x,y …", 0..1): drag a point, click to add one, double-click
    to remove it, Reset, and the points as text underneath. Curves now has a Channel menu and a graph per channel (a natural
    spline, as before); its old sliders are hidden but still read (`curvesOld`) for projects saved before the graph.
    Lumetri's RGB and hue / saturation curves use the same graph (one at a time, picked with its Curve menu); hue curves
    show a hue strip and wrap round. Code: `drawCurveBox`, `curveApply`, pointer handlers on `#inspector`.
  - Tests (`.claude\fx`, steps `huesatRanges`, `levelsChannels`, `curvesGraph`): Reds hue +120 turns red green and leaves
    green; Green Input White 204 → grey's green 160; dragging the middle of the RGB graph up lifts grey to 192 and a
    double-click puts it back to 128.
- **EffectCraft Round 10 done (2026-11-08): Lumetri Color**, in Effects & Presets › Color: Basic Correction (Input LUT,
  white balance, High Dynamic Range with HDR White / Specular, tone, saturation), Creative (six looks or a LUT, intensity,
  faded film, sharpen, vibrance, saturation, shadow / highlight tints), Curves (tone sliders, RGB / Red / Green / Blue
  curves, the five hue / saturation curves), Color Wheels, HSL Secondary (hue / saturation / lightness key, show mask,
  invert, denoise, blur, correction) and Vignette. A Show menu picks which section's settings are listed.
  - It runs on Lumina's own `shaders/lumina_lumetri.wgsl` (family `lumina_lumetri`, names `llm_`): EffectCraft's GPU kernel
    (`fx_color`'s `fxc_lumetri`) leaves out the RGB and hue curves, HSL Secondary and HDR, so the whole CPU Lumetri in
    `color3.rs` is ported instead. Passes: `llm_grade` (everything up to the wheels), `llm_key` → blur (`fxGauss`) →
    `llm_matte` for the HSL matte, `llm_final` (secondary correction, show mask, vignette), `llm_sharpen`.
  - Curves are typed as control points ("0,0 0.5,0.75 1,1"); `fxCurveFC` ports `color2::Curve` (Fritsch-Carlson) and
    `fxOffsetCurve` ports `OffsetCurve`. The LUT menus list Lumina's looks and loaded .cube files (`LUTS`); a pick with
    `str: true` stores text. Saving a project keeps the user LUTs Lumetri uses.
  - Differences: Sharpen blurs with a true Gaussian (sigma 1 px at 1080p) worked out in the kernel; the vignette uses the
    layer's on-screen box. Not done: a curve graph to drag (see "Start here next").
  - Tests (`.claude\fx`, step `lumetri`): Exposure -1 → 64; Temperature 100 → (160, 128, 96); Whites 100 → 141, with HDR
    White 200 → 134; an inverting LUT → 127; RGB curve "0,0 0.5,0.75 1,1" → 192; Hue vs Hue turns red yellow; a pink
    midtones wheel → (170, 107, 107); HSL Secondary on reds greys red only; Vignette -5 blackens the corner. About 6.5–7 ms a
    1080p frame. `effects.png` has a Lumetri tile.
- **EffectCraft Round 9 done (2026-11-08):** Auto Levels, Auto Contrast, Auto Color, Equalize, Broadcast Colors, Video
  Limiter, PS Arbitrary Map, Levels (Individual Controls), CC Color Neutralizer, CC Kernel, Color Link and Color Stabilizer,
  in Effects & Presets › Color. 66 GPU effects now.
  - All run on `fx_tone.wgsl`'s `fxt_point` (ops 1, 7, 11, 12, 13, 16, 17, 23, 24), packed as in EffectCraft's
    `crates/gpu/src/fx_tone.rs`, except Color Link, which uses `fx_pixel2.wgsl`'s `fp2_point` (ops 4 and 5; new shader family
    `fx_pixel2`, compiled with `fx_stylize` as EffectCraft does). `fxTone()` now takes a data table too.
  - **Reading the picture back mid-stack:** `E.read(img, max)` in `fxApply` draws an image onto the effects canvas, sends the
    work so far, and copies it (8 bits, at most 640 px by default). The auto effects (histograms, `fxHist`/`fxClip`/`fxAuto`),
    Equalize (`fxEqualize`), Color Link (`fxSampleColor`) and Color Stabilizer (`fxSampleMean` at full size) measure that, so
    they see the picture as it reaches them, after earlier effects. Shadow/Highlight's Auto Amounts now does the same.
  - PS Arbitrary Map's map is typed as numbers (0-255, commas between); `fxMapTable` ports `arbitrary_map_table` (f32 bit
    search). Color Link's Source Layer menu lists the other layers (a pick's `opts` can now be a function of the layer); the
    source is painted without its effects or masks. Color Stabilizer has a "Set to playhead" button (new `btn` setting
    type, `data-act=fxbtn`): that frame's samples become the reference (`f.refT`, `f.ref`), re-measured whenever the
    playhead is on that frame. New `text` setting type for the map.
  - Not done: Temporal Smoothing and Scene Detect on the auto effects (need other frames). Levels (Individual) sliders run
    0-255 like Lumina's Levels, not EffectCraft's -1..2.
  - Tests (`.claude\fx`): Auto Levels/Contrast/Color after a Levels that squeezes the card into 64..192 stretch it back
    (0 / 128 / 255); Broadcast Colors at 90 IRE cuts white to 227; Video Limiter eases white to 250 (229 at 90% Luma);
    PS Arbitrary Map "255, 0" inverts, phase 64 moves grey to 192; Color Link from a hidden blue ellipse gives (51, 102, 204);
    Color Stabilizer with a brighter reference lifts black to 51. 4.3–16 ms a 1080p frame (the read-back ones cost most).
    `effects.png` has nine new tiles.
- **EffectCraft Round 8 done (2026-11-08):** Exposure, Photo Filter, Shadow/Highlight, Change Color, Change to Color, Leave
  Color, Color Balance (HLS), Gamma/Pedestal/Gain, CC Toner and CC Color Offset, in Effects & Presets › Color. 54 GPU effects now.
  - All but Exposure run on EffectCraft's `fx_tone.wgsl` `fxt_point` (new shader family `fx_tone`; `fxTone()` helper, `FXT_K`),
    packed as in EffectCraft's `crates/gpu/src/fx_tone.rs`. Exposure is the base `kernels` pointwise op 5 (per-channel gain,
    offset, gamma in f[0..2], u[0].y = bypass linear light). Settings, defaults and the Photo Filter list follow EffectCraft's
    specs (`color_fx.rs`, `color2.rs`, `color3.rs`).
  - Shadow/Highlight: luminance plane (op 19) → blurred bases (`fxGauss`, edges repeated, radius `E.px(r)/2`) → op 21 pack →
    op 20. Auto Amounts measures the layer's alpha-weighted luminance mean on the CPU from a 320 px copy of the layer canvas
    (`fxLumaMean`, `E.lumaMean()`). Not done: Black/White Clip (needs the adjusted frame read back), Temporal Smoothing and
    Scene Detect (need other frames).
  - Tests (`.claude\fx`): each effect checked on the colour card against values worked out from EffectCraft's maths
    (e.g. Exposure +1 on grey 128 → 175; Warming 85 at 25% → 140,126,111; CC Toner grey → 140,111,72; CC Color Offset Polarize
    sends a channel that overflows by less than half to 0, as EffectCraft's shader does). About 4.6–5.7 ms a 1080p frame.
    `effects.png` has the ten new tiles.
- **PhotoCraft Round P3, Image mode basics (2026-11-08):** a project can be one still picture (`S.global.still`, saved with
  the project and part of undo). How to get there: Image › New image… (Ctrl+Alt+N; size presets or custom up to 16384 px a
  side and 100 million pixels, background white/black/transparent/colour), Image › Open a picture as an image… (the canvas
  takes the file's size; any format Lumina opens), Image › Edit this frame as a picture (keeps the layers), the **Image**
  workspace button, the **Image** rail tab, or New image… on the welcome screen. Image › Back to video editing undoes it.
  - In Image mode: the timeline, play controls, Split/Impact/Ripple, size and fps menus are hidden (`body.still`,
    `.vid-only`); the big button is **Save image** (the Save frame as image dialog, "Saves the picture at its full size");
    Space doesn't play (Space+drag still pans); arrows nudge the layer 1 px (Shift 10); C crops. New layers start at 0
    and text gets no entrance animation (`insertLayer`). The comp tab reads `Image: <name> · W×H`.
  - **Layers panel** (`#pLayers`, under Properties in Image mode; Window › Layers hides it): top layer first, each row has
    an eye, a lock, a little picture (each layer drawn alone with `RENDER.only`, 150 ms after a change, cached by a
    signature in `LTH`), name (double-click to rename), opacity %. Opacity slider + box at the top. Drag rows to reorder;
    Up/Down/Duplicate/Delete at the bottom. A **Background** row: eye makes it see-through (`S.global.bg = 'none'`, with
    `bgWas` to switch back), colour box changes it. The preview shows a checkerboard behind see-through parts, and Save
    image turns See-through on for a transparent picture.
  - **Lock** (`L.locked`): can't be picked on the preview (hitTest already skipped it), Properties and Effect Controls are
    greyed with an Unlock button (`lockInspector`; the Whole picture settings stay usable), Delete refuses it, nudges skip it.
  - **Canvas tools** (Image menu, rail tab, shortcuts): Image size… (Ctrl+Alt+I, in proportion, px or %), Canvas size…
    (Ctrl+Alt+C, 3×3 anchor), Crop (C: a box on the preview with handles and thirds; drag edges/corners, drag inside to
    move, outside to draw a new one; Enter or the Crop button in the bottom bar, Esc cancels), Rotate 90° either way, 180°,
    Flip across / up-down. All go through `reframe()`: it maps every layer's position (and its x/y keyframes; a quarter
    turn swaps them) to the new canvas and corrects its scale for how the layer's base size follows the canvas
    (`baseFit`: pictures/videos fit the frame, everything else follows the height / 1080), so things stay the same size in
    pixels. Rotation turns layers too; flips mirror them through `rotY`/`rotX` (180 − v) and negate rotation (3D layers
    only move). Pixel amounts like blur still follow the canvas height.
  - The size menu (`#res`) shows any size (`syncRes` adds a custom entry) and undo now keeps the canvas size (`snapshot`
    has `size`; `rebaseSize` keeps the menu's own changes out of undo, as before).
  - Tests: new suite `.claude\photo` (13 steps: new image, layers added, every canvas tool checked by where four colours and
    an orange disc land and the disc's width, undo, crop by mouse, Layers panel eye/opacity/lock/order/drag/rename/thumbs,
    keys, see-through background + saved PNG, Image menu, save and reopen, back to video and the workspace button, open a
    picture as an image, too-big size). Output in its `out\` folder (gitignored).
  - Not done (later rounds): paint layers, selections, adjustment layers, layer groups, non-proportional Image size, crop
    to a fixed ratio, rotating the crop box.
- **Save as tabs (2026-11-08, the user: "its all cluttered together… maybe adding like a video and image tab"):** Save as now
  has four tabs along the top: **Project** (1), **Video** (10), **Image** (16, quality and see-through settings),
  **Moving image** (9: GIF/WebP/APNG and the picture sequences, with the range/frame rate/size settings), each with its own
  text, showing only its formats. `formatPicker` takes `tabs: [{ id, label, text, formats, def, extra, wire }]`; the open
  tab and each tab's last pick are remembered (`lumina.saveAsFormat.tab`, `.video`, `.image`…). Values keep their prefixes
  (`img:`, `anim:`). The single-list dialogs (Export video, Save frame as image, Save animation) are unchanged.
  Tests: `.claude\image` (tabs, counts, settings per tab, remembered tab, Image/Moving image saves routed right);
  the main suite now clicks the Video tab before picking MKV.
- **PhotoCraft Round P2 (2026-11-08):**
  - **Moving pictures and sequences:** File › Save animation or picture sequence… (Ctrl+Alt+E), also in Composition.
    GIF (palettegen diff + bayer, loops or plays once), WebP (libwebp_anim, soft see-through), APNG; or one picture per
    frame in a folder (PNG, JPEG, TIFF, WebP, TGA, BMP: `<name>_0001.ext`…). Settings: From/To (a selected bookmark with a
    length fills them), frame rate 10–60, size 100–25%, quality, see-through, repeat; frame count shown, 3,000 at most.
    `saveAnimation` renders each frame exactly (seek, `frameReady`, `grabFrame`) and streams PNGs to main
    (`anim:begin/frame/finish/cancel`), where FFmpeg puts them together. Dialog listeners are now `onchange` (they used to pile
    up across dialogs and throw).
  - **Opening every image format:** `IMG_EXT` takes TIFF, PSD/PSB (flattened), TGA, HEIC/HEIF, JPEG 2000, EXR, HDR, DDS,
    QOI, PCX, PNM family, SGI, XWD and camera RAW (DNG, NEF, CR2, CR3, ARW, ORF, RW2, RAF…). `NATIVE_IMG` ones load as
    they are; the rest go through main `image:open` → a PNG in `%APPDATA%\Lumina\image-cache` (keyed by path, size, date):
    FFmpeg first, then Windows' own decoders through PowerShell/WinRT (`WIC_SCRIPT`, sent as -EncodedCommand, no script
    file; EXIF turn applied, colours to sRGB). RAW always goes to Windows. Clear messages when Windows lacks the RAW or HEIF
    extension (error 0x88982F50) or the file is bad. Projects keep the original path; reopening reads the cache.
    This PC has the Raw Image Extension, HEIF, HEVC, AV1 and WebP extensions; **no real camera RAW was tested** (there's no
    sample), only the bad-file message.
  - Tests in `.claude\image`: moving GIF/WebP/APNG read frame by frame (Chromium's ImageDecoder) against the editor's own
    frames, loop/once, see-through WebP, numbered sequences, the dialog; TIFF/PSD/TGA/JP2/HEIC/ICO opened as clips with the
    right colours, the cache, a project with a TIFF reopened, a broken RAW.
- **PhotoCraft Round P1, Save as image (2026-11-08):** File › Save frame as image… (Ctrl+Shift+E), Composition menu, and
  Save as (image formats listed after the video ones). The frame at the playhead at full comp size, in 16 formats, with a
  Quality slider (JPEG, WebP, AVIF, HEIC, JPEG 2000) and a see-through background switch (PNG, WebP, GIF, TIFF, PSD, BMP,
  SVG, ICO, TGA, JPEG 2000). `render()` takes `RENDER.alpha` (no black/canvas background) and `RENDER.only` (one layer, no
  impacts or whole-video look) via `grabFrame`. FFmpeg (main.js `image:save`, table `IMAGE`) makes JPEG, WebP, AVIF, GIF
  (palettegen), TIFF, BMP, ICO (≤256), TGA and JPEG 2000 from a PNG. Lumina writes the rest itself: **PSD** (`makePSD`: one
  layer per visible layer at the playhead, bottom first, named, cropped, blend mode mapped, PackBits; plus the finished
  picture), **PDF** and **AI** (one page, a JPEG, 1 px = 1 pt; the .ai is the PDF bytes, which Illustrator opens),
  **EPS** (level 2, ASCII85 + DCT), **SVG** (the PNG inside an <image>), **HEIC** (`heifFile`: FFmpeg's x265 picture in a
  HEIF file: ftyp, meta with hdlr/pitm/iloc/iinf/iprp {hvcC, ispe, colr nclx}, mdat). AVIF and HEIC are tagged BT.709 +
  sRGB curve; without that Windows' HEIF decoder shifted colours (213,55,36 for 200,40,40); with it, within 2.
  Checked: Windows' own decoder (WinRT BitmapDecoder, "Microsoft HEIF Decoder") opens Lumina's HEIC and AVIF.
  RAW can't be made (camera sensor data); the dialog says so. `image:toPNG` decodes any image FFmpeg reads (for P2).
  New suite `.claude\image` (expected false: none): every format saved and read back (Chromium, FFmpeg, or taken apart),
  PSD layers parsed, see-through backgrounds, the screen restored after saving.
- **Impact parts (2026-11-07, the user's request):** an impact's Strength drove flash, shake and zoom together. Now each has
  its own slider (Flash, Screen shake, Zoom punch, 0–1.5, number shown beside it) plus Length. Impacts store `flash`,
  `shake`, `zoom`; older ones with one `strength` keep it (`impAmt`) until a slider is moved, then split into the three.
  `impactAt(t)` returns `{ flash, shake, zoom }`. Tested in `.claude\timeline` (impactParts, impactPanel).
- **Friend's timeline report (2026-11-07):** four fixes, tested by the new suite `.claude\timeline` (expected false: none).
  1. **Stiff dragging:** the ruler drew a label for every second of the whole edit on every drag move (6,000+ on a 1 h 42 min
     edit); now only the part in view (`rulerMarks` / `rulerFollow`). New Properties › **Timeline** group (always shown, kept
     per PC in localStorage `lumina.tlset`, not in the project): **Drag step** (free, 1 frame, 0.1–5 s) and two snap switches
     (other clips' edges; playhead, beats and bookmarks). `snapHit` finds a snap, `stepT` rounds to the step; Shift = neither.
  2. **Slow loading / black preview:** a clip keeps a copy of its newest frame (`keepFrame`, ≤960 px) and shows it while
     its video loads; "Loading video…" shows on the preview (`drawLoadingNote`). The root cause is usually the file: few
     keyframes (movies and downloads: one every 5–10 s), HEVC/AV1/VP9, >1080p or 60 fps. Properties › **Smooth editing**
     reads the file with FFmpeg (`media:probe`, keyframe gap from the first minute) and says why it's slow; **Make an edit
     copy** (`media:optimize`) writes `<name> (edit copy).mp4` next to the original (H.264 CRF 18, a keyframe every 0.5 s by
     the clock, `-fps_mode vfr`, ≤1080p) and every import of that file switches to it (`MEDIA.origPath` remembers the original,
     saved in the project; "Use the original file again" switches back). Importing a slow file shows a notice.
  3. **Lag and jumping back 2 s:** the clock ran on while a video stalled, then `masterClock` pulled it back. Now
     `waitForMedia` holds the clock (everything paused on the right frame) while a clip on screen, or about to start, is
     seeking or stalled (`waiting` event), up to 4 s per clip; exports never wait. Resuming doesn't re-seek.
     `loop()` is now `tick()` + requestAnimationFrame, so tests can drive `tick` on a timer.
  4. **Clips on one track:** `L.track`; clips with the same track share a row (`timelineRows`, `tidyTracks` keeps them together
     in the layer order). Drag a clip up/down onto another row to join it (the row lights up); "Own track" (Arrange) and
     "Put on one track" (multi-select) do it by button. Where clips on a track overlap, the later one crossfades in across the
     overlap (auto entries in `transList`). Sound and picture clips don't mix; track mattes keep their own row.
  The self-test can slow a file down with `?slow=ms` on its media URL (SELFTEST only, main.js).
  Ideas not done: unloading far-away clips' video elements to save memory on long edits; an audio crossfade for overlapping sound clips.
- **GitHub + Linux (2026-11-07):** private repo, release workflow for Windows + Linux, 0.9.1; see "Start here next".
- **Licence (2026-11-07):** `LICENSE` = Lumina's own code is all rights reserved (the user's choice; free to use and share the
  unmodified downloads). `THIRD-PARTY-NOTICES.md` lists every outside part and its licence (FFmpeg GPL-3.0 with source links,
  EffectCraft MIT, three.js MIT, MediaPipe and Transformers.js Apache-2.0, fonts OFL). Both ship inside the app (`build.files`);
  MediaPipe's npm package has no licence file, so its Apache text is in `vendor/mediapipe/LICENSE-APACHE`. Add a row there when
  a new outside library, model or font comes in. Local only, not pushed yet.
- **Converter fix: titles with "/" (2026-11-07, the user's report "yt-dlp stopped with code 0"):** a YouTube title with
  "///" is saved by yt-dlp with look-alike slashes (⧸), but its Windows console output drops them, so the printed
  LUMINAFILE path didn't exist and a finished download counted as a failure. yt-dlp now saves to `download.<ext>` in the
  work folder and Lumina finds the file there; the title comes as JSON (`%(title)j`), so the final name keeps the ⧸.
  stdout is read with `setEncoding('utf8')`. Converter test now also converts a local "slash ⧸⧸⧸ test.webm" (`cvSlash`).
- **Layer mute, impact copy/paste, grabbable playhead (2026-11-07, asked for by the user and their friend):**
  - A speaker button in each sound layer's header (`hasSound`, `toggleSound`, `[data-snd]`) mutes just that layer (`L.muted`,
    the same flag as the video's Mute box, so playback and export both go silent). Shown on audio clips and on videos that
    still carry their sound; a video whose sound was separated has none (its audio clip has the button). Alt+click hears
    only that layer; Alt+click it again turns every layer back on. Undoable, saved with the project.
  - Impacts: Ctrl+C / Ctrl+X / Ctrl+V (and a "Copy impact" button, Edit menu "Copy impact" / "Cut impact") copy the
    picked impact with its strength and length and paste it at the playhead (`copyImpact`, `pasteImpact`, CLIP kind
    `impact`). Pasting where an impact already is gets refused with a message.
  - Keyframe copy/paste already existed (C12); fixed Ctrl+X with a keyframe picked: it now cuts just the keyframe, not the clip.
  - The playhead line can be grabbed anywhere along it (over clips too) and dragged: `.playhead::before` is a 10 px
    invisible grip; `drag.grab` keeps the gap to the pointer so it doesn't jump. Keyframes, beats, impacts, bookmarks and
    clip trim edges right under the line still win (`elementsFromPoint`). Speed step 29 `playheadGrab` (it hides the
    dialog an earlier step leaves open over the timeline).
  - Speed suite steps 27 `layerMute` and 28 `copyImpacts`. Step 26's jump-follow check now waits, then runs `tlFollow`
    itself if Windows paused the screen loop (window covered).
- **Timeline scrolling fix (2026-11-07, the user's report):** the playhead could slide under the layer names
  (Layers / Impacts / Bookmarks column) when scrubbing left.
  - Scrubbing now stops the playhead at the edge of the lanes (`tlView()` gives the visible times).
  - Holding the pointer past the left or right edge during any timeline drag auto-scrolls that way, faster the further
    out, and the playhead or dragged clip keeps up. `tlEdgeScroll` runs on its own 16 ms timer, not the screen refresh,
    which Windows throttles when the window is covered.
  - A jump out of sight (arrows, Home/End, bookmarks) scrolls to show the playhead (`tlFollow`). Only on a jump, so
    wheel-scrolling away stays put.
  - Mouse wheel over the lanes scrolls left/right (a trackpad's sideways swipe too). Over the layer names it scrolls up and
    down as before. Shift+wheel scrolls up/down anywhere. Ctrl+wheel zooms around the pointer (also moves the Zoom slider).
  - Speed suite step 26 `timelineEdges` (uses a 60 s title so there's room to scroll).
- **Converter tab done (2026-11-07, the user's request before EffectCraft Round 8):** tool rail › Converter. Paste a link,
  pick MP4 (video + sound) or MP3 (sound only, optional "Even out the loudness" = loudnorm −14 LUFS), Convert (or Enter).
  Links queue and run one at a time; each shows a progress bar and plain-words errors (private, age-restricted, sign-in,
  unsupported, unavailable, network, 403) with Try again / Dismiss and a toast. Finished files are listed (kept in
  localStorage `lumina.convRecent`) with Add to timeline / Show in folder. Saves to Downloads unless Change… picks a folder
  (`lumina.convFolder`). Also `lumina.convFmt`, `lumina.convNorm`.
  - **How it works (main.js "Converter"):** yt-dlp (Unlicense) is NOT in the setup. On first use the panel offers "Download
    yt-dlp (24 MB)": `conv:install` fetches `yt-dlp.exe` + `SHA2-256SUMS` from github.com/yt-dlp/yt-dlp/releases/latest, checks
    SHA-256 and keeps it at `%APPDATA%\Lumina\tools\yt-dlp.exe`; "Update yt-dlp" re-runs the same thing. `conv:run` lets
    yt-dlp download into a temp folder (MP4 prefers H.264 + AAC, merges to MKV; `--fixup never`), then Lumina's own FFmpeg
    makes the final MP3 (libmp3lame q0) / MP4 (copies H.264/AAC, else x264 crf 18 + AAC 192k, faststart). That way yt-dlp
    never needs ffprobe (ffmpeg-static has none). Cancel kills the process tree (taskkill /T). Only http(s) links; file://
    links are allowed only under `--selftest`.
  - The user approved downloading yt-dlp 2026.10.26 (checksum matched) on 2026-11-07. First real link (the user's, a
    SoundCloud track) is DRM-protected, so it can't be downloaded; Lumina now says so in plain words. Second real link (a
    YouTube video the user picked, 2:05, 1080x1080) worked in the built app: MP3 in 6.5 s (230 kb/s, plays 124.8 s), MP4 in
    3.4 s (H.264 + AAC copied, no re-encode; plays, and Add to timeline made a 124.9 s video clip). Remind the user: only download media they have rights to.
  - **All links (same day):** every link is first looked up (`conv:resolve`, `yt-dlp --flat-playlist -J`):
    - Playlists (YouTube playlists, SoundCloud sets, a page with several videos) become one job each. Entries with their own
      link keep it; videos embedded in one page are fetched as `--playlist-items N`. Over 50 entries asks first. A video
      link inside a playlist (`watch?v=…&list=…`) is just that video unless "Whole playlist when a video link is in one"
      is ticked (`lumina.convPlaylist`).
    - Live streams are refused until they end ("convert the saved video"); premieres too.
    - "Sign in with" (Off / Firefox / Chrome / Edge / Brave / Opera / Vivaldi, `lumina.convCookies`, default Off) passes
      `--cookies-from-browser` for Instagram / Facebook / age-restricted / private content. Untested with a real browser
      (it reads the user's browser sign-ins; only on their say-so). New Chrome/Edge lock their cookies (app-bound
      encryption), so the message points to Firefox.
    - YouTube's JS challenge: yt-dlp runs Lumina's own Electron as Node (`--js-runtimes node:<Lumina.exe>` +
      `ELECTRON_RUN_AS_NODE=1`), so no Deno download is needed (checked: "Solving JS challenges using node").
    - Segmented streams (Twitch, Kick, .m3u8, .mpd) show progress by pieces. Links without https:// are accepted.
    - Checked with the user's YouTube link (details only). Shorts, TikTok, Instagram, X, Facebook, Twitch, Kick and
      .m3u8 links have NOT been tried with real links yet.
  - Speed suite step 25 `converter` (queue, MP3 + MP4 made and playable, Add to timeline, failure message, cancel,
    a two-video page `media\list.html` as a playlist, the playlist / sign-in settings); its
    railTools check now expects the Converter button. Output goes to `.claude\speed\convout` (emptied each run).
  - The rebuilt `dist\Lumina Setup 0.9.0.exe` now includes the Converter.
- **C15 Friends test release done (2026-11-07):** 0.9.0, About text, Help › Send feedback…; details in "Start here next".
  The speed suite's `release` step checks the version, About box and feedback form (and copies the form to the clipboard).
- **Beginner / Pro switch removed (2026-11-07, the user's request): everything is always shown.** Gone: the toolbar
  switch, View › Beginner mode, `setMode`/`MODE`/`proMark`/`BEGIN_HINT`, the `.pro`/`.bhint` CSS, the welcome screen's
  "How much do you want to see?" choice and the Beginner/Pro tip, and the speed suite's `beginnerPro` step.
  The B3 notes below are kept as history only.
- **B4 Welcome + tips done (2026-11-07). Rounds B1–B4 are finished; C15 is next.**
  - `#welcome` opens at start (`startIntro`) unless `lumina.welcome` = 'off' ("Show this when Lumina starts"). It has four
    sizes (YouTube 1920×1080, TikTok/Reels/Shorts 1080×1920, Square, 720p: they set `#res`), Open a project… and a
    Show tips box. Esc, Start editing, a click outside, a file drop or opening a project close it.
    Help › Welcome screen… brings it back.
  - Tips (`TIPS`, `#coach`): one at a time, pointing at the rail, Import, the quick bar (waits for a picked clip), the
    Beginner/Pro switch and Export. "Got it" marks one seen (`lumina.tipsSeen`); "Turn off tips" sets `lumina.tipsOff`.
    Help › Show tips again resets both. `tipNext()` runs from `quickBar()` (so from every refresh) and after the welcome.
  - Self-tests: main.js calls `introOff()` (no welcome, no tips, nothing saved).
- **B3 Beginner / Pro switch done (2026-11-07).**
  - Toolbar switch `#modeSw` (also View › Beginner mode). `MODE` is saved as `lumina.mode` in localStorage; with nothing
    saved Lumina starts in **Beginner**. `setMode(m, save)` toggles `body.beginner`; CSS `body.beginner .pro` hides things,
    so nothing leaves the page and switching back shows it all as it was.
  - Hidden in Beginner: toolbar Line up/Stack, Shape, Sticker, 3D, Atmosphere, Colour grade, Impact (the rail has all
    but Impact) and the workspace tabs; in Properties, `proMark()` hides Blend, Turn Y/X (not on 3D), the 3D material
    sliders, Expressions, Motion tracking and Blend into scene (`PRO_GROUPS`, `PRO_PROPS`, `PRO_ROWS`). Beginner also
    shows a plain tip per clip kind under the Layer heading (`BEGIN_HINT`, `.bhint`).
  - Self-tests: main.js puts the test window in Pro (`setMode('pro', false)`, not saved) before each suite.
- **B2 Clip quick bar done (2026-11-07).**
  - `#qbar` sits in the timeline's top bar (in place of the hint, `#tlHint`) whenever a clip is picked; `quickBar()` runs
    from `refresh()`. `qbItems(L)` decides the buttons by kind: Split, Speed, Freeze, Separate audio, Volume, Animate,
    Mask, Transition, Effects, Canvas, Delete (several clips picked: Split, Copy, Delete). Icons in `QB_ICON`.
  - `quickAct` either does the job (split, freeze, separate audio, delete, copy; Mask turns on an ellipse mask) or jumps:
    `jumpTo(group title or selector)` opens Properties, scrolls to it and lights it up (`.flash`); Transition, Effects and
    Canvas open the matching rail panel.
  - All eight suites show their usual results (transitions passed at 201 fps once the user cleared the screen).
- **B1 Tool rail done (2026-11-07).**
  - `<nav class="rail" id="rail">` is the first column of `main` (60px, always shown; `applyPanels` adds it). Icons are
    Lumina's own small SVGs (`RAIL_ICON`). Tabs: Media (the Project panel), Text, Stickers, Effects (Effects & Presets),
    Transitions, Captions, Audio, Adjust, 3D. Clicking one opens the left panel if it was hidden (`openRail`).
  - New panels live in `#railBody`, built by `RAIL_PANELS[tab].html()`; `dyn` ones (Transitions, Captions, Audio, Adjust)
    re-render with the selection from `projectPanel`. Cards are `.rcard[data-radd="kind:arg"]` and `railAdd` does the job
    (text style, shape, emoji, flag, 3D, atmosphere, background, transition, `act:` = `action()`, `file:`, `tab:`).
  - Drag a card: onto the preview adds at the playhead; onto the timeline adds at the drop time; a transition dropped
    on a clip's row goes onto that clip (`railDropAt`, mime `application/x-lumina-add`).
  - The toolbar buttons are all still there (B3 decides what Beginner hides). PhotoCraft's Image tab goes in `RAIL`.
  - Not done: Media still shows the plain list (no thumbnails, can't drag media from it onto the timeline).
  - The speed suite's `maskShapes` outline check failed once and passed unchanged on the next run (timing flake).
- **C14 Graph editor done (2026-11-06). The CapCut phase (C1–C14) is finished.**
  - A key's `ease` can now be `'custom'` with `bz = [x1, y1, x2, y2]` (a cubic bezier like CSS's; x 0–1, y −0.4–1.4 so it
    can overshoot). `easeOf(k, u)` / `bezierEase` do the maths; `interp` uses them. Saved with the project; Ctrl+C/V of
    keyframes carries the curve.
  - Pick a keyframe (diamond or lane) and the "Keyframe at" group shows the graph (`canvas.kgraph`, `drawKGraph`): time
    along, how far the value has got up (dashed lines = this key's value and the next one's), with the playhead.
    Drag either handle; double-click goes back to Smooth. Presets: Ease in, Ease out, Ease in & out, Linear, Overshoot.
    The Easing menu shows "Custom curve" when a curve is set. Changes go to every key picked at that time.
  - Not done: the graph shows one move at a time (not a whole-property value graph like a full graph editor); the
    timeline diamonds don't look different for custom curves.
- **C13 Preview zoom and pan done (2026-11-06).**
  - **Zoom:** the zoom box under the preview (Fit, 25–400%, plus the current % when it's in between), Ctrl+scroll or a
    trackpad pinch (zooms around the pointer), `.` / `,` step through 10/25/50/100/200/400/800%, `/` fits. View menu has
    the same. `PZ` = screen px per composition px (null = fit), `PX`/`PY` = pan from centre; `fitPreview` lays it out.
  - **Pan:** Space+drag or middle-drag. A Space tap still plays/pauses; a Space drag puts playback back as it was.
    At least 40px of the frame always stays on screen. Opening a project goes back to Fit.
  - Handles, dragging and picking stay right at any zoom (`compPoint` uses the overlay's on-screen box). The overlay
    canvas is capped at 8192px; above 2 device px per frame px the picture shows sharp pixels.
  - **Lesson:** there was already a `fitScale(w, h)` (fits media into the frame); a second function with the same name
    silently replaced it and shrank every picture. The preview one is `previewFit`.
  - Not done: plain scroll doesn't pan when zoomed (it scales the picked clip, as before); the zoom isn't saved.
- **C12 Clipboard and keyframe tools done (2026-11-06).**
  - **Copy / cut / paste clips:** Ctrl+C / Ctrl+X (also Edit menu) copy the selected clips; Ctrl+V pastes them at the
    playhead, keeping their spacing and stacking. A video and its separated audio copied together stay linked to each other.
  - **Paste from other apps** (desktop): Ctrl+V reads the system clipboard through main.js (`clip:read`). Files copied in
    Explorer (`text/uri-list`) are imported like a drop (unsupported files get a message). A copied picture (`image/png`)
    is saved to `%APPDATA%\Lumina\Pasted\Pasted <date>.png` first, so a saved project finds it again. Text becomes a text clip.
    Lumina's own copy writes a marker text to the clipboard (`CLIP.mark`); if the clipboard no longer holds it, something
    newer was copied elsewhere and that wins. The web version uses the browser's paste event instead.
  - **Keyframes:** pick a keyframe diamond and Ctrl+C copies it (or "Copy keyframe" in its panel group; "Copy all keyframes"
    in the Keyframes group and Edit menu). Ctrl+V puts the keys on every selected clip at the playhead, same spacing and
    easing; properties the clip doesn't have are skipped with a note. Delete with a keyframe picked now deletes the keyframe.
  - **Keyframe lanes:** a ▸ on an animated clip's row (also the Keyframes group, Layer › Show keyframe lanes) opens a row per
    animated property (`KOPEN`, not saved). A lane's diamonds pick, drag, copy and delete just that property (`S.selKP`,
    `keysAtSel`).
  - New `notice()`: a short message that fades by itself, for things that worked. `toast()` stays for problems.
  - Test: `clipboard` step in the `speed` suite. It overwrites the system clipboard while it runs, and its pasted
    pictures go to `.claude\speed\pasted`.
  - Not done: Ctrl+D still duplicates only the main clip (Ctrl+C, Ctrl+V does the whole group); pasting several keyframe
    times picked by hand (only one time, or all of a clip's keys).
- **C11 Separate audio done (2026-11-06).** A video clip's panel has a **Sound** group: **Mute** ("Silence this clip's
  own sound", `L.muted`) and **Separate audio** (also Layer › Separate audio). Separating mutes the video and puts an
  audio clip of the same file right under it ("Audio · name", same timing, speed, curve, slow-mos and volume), playing
  through an `<audio>` element. The two share `L.link`: they move, trim and split together (each half stays linked to
  its half), Alt+drag moves just one, and both bars show ⛓ (a muted video also shows 🔇). Deleting one drops the link
  (`tidyLinks`); Duplicate makes an unlinked copy; **Unlink** is in both panels. Not done: a waveform on audio bars,
  and the video's transition fade doesn't carry over to its separated sound.
- **C10 Stickers done (2026-11-06).** Nothing was downloaded; everything is built in.
  - **Shape ▾** has six new shapes: Star, Heart, Triangle, Hexagon, Speech bubble (white with a dark outline) and Burst
    (`shapePath`, sizes in `SHAPE_SIZE`). They use the usual fill / outline colors.
  - **Sticker ▾** (toolbar, and Layer › New sticker…) opens a picker: nine emoji tabs (about 700 emoji) plus **Flags**,
    and an "Any emoji" box for anything else (Win + . opens Windows' emoji panel). A sticker is a shape layer with
    `shape: 'sticker'` and `L.emoji` or `L.flag`, so it moves, keyframes, masks and saves like any shape. Its panel has
    Width/Height (stretch), Scale, and **Change sticker…**, which swaps it in place and keeps its size.
  - Emoji use the color font Windows already has (Segoe UI Emoji), so they look like Windows emoji. That font has no
    flags, so the 49 flags (`FLAGS`) are drawn by Lumina from their official colors and proportions. Flags with
    detailed emblems (Canada, Brazil, Mexico, Korea, Australia...) are left out. Spain and Peru are their plain
    civil versions. More flags or a sticker pack would need a download: ask first.
  - Test: speed suite step 15 `stickers` (shapes, picker, France/Japan swap, US/UK/Germany/Sweden/Swiss/EU pixel
    checks, color emoji, undo, saved project). All eight suites passed with their usual results.
- **C9 Captions (SRT/VTT import) done (2026-11-06).** Import media, drag and drop, or Layer › Captions from SRT/VTT…
  turns a subtitle file into **one** caption clip, a text layer with `cues: [{t0, t1, text}]` (seconds from the clip's
  start). The whole transcript is one timeline row, with a small block for each line.
  - **Style:** Barlow, white, size 58, at y .85, with a Fade animation and a background box (`capBox`, `boxColor`,
    `boxAlpha`). The normal text controls style every line. The animation runs per line, because drawText shifts the
    layer's start and duration to the current cue before textEnvelope. Size, weight and keyframes still use the real
    clip.
  - **Panel (`captionPanel`):** the box options and the list of lines. You can edit each line's text, click its time
    to jump there, or ✕ to delete it. There are buttons for Add line here (2 s, only in a gap), Export SRT… (through
    export:save, whose dialog now says "Save captions" for .srt/.vtt) and Import.
  - **Editing the clip:** split gives each half its own lines, and a line across the cut is shown by both halves.
    Trimming the head keeps lines in place, because clipState/trimHead shift cues like keyframes.
  - **Parser (`parseCaptions`):** handles the BOM, CRLF, SRT commas and VTT dots, mm:ss times, cue settings,
    NOTE/header blocks and cue ids. It strips `<i>`/`<v>` tags and `{\an8}`, and decodes &amp; and similar.
  - **Test:** speed suite step 13, `captions`. It checks parsing for both formats, the import, the pixels on screen
    during lines and gaps, the panel edits, the box toggle, adding a line and refusing one where a line already is,
    split, head trim, the SRT round trip, save/reopen, and that a file with no captions is ignored.
  - **Auto captions (built 2026-11-06, the user OK'd the model download):** Properties › **Auto captions** on any
    video or audio clip has a Language menu (or Detect automatically) and Make captions. Whisper base runs on this
    computer and nothing is uploaded.
    - **Engine:** Transformers.js 4.3.2 plus the ONNX Runtime Web asyncify wasm, vendored in `vendor/transformers`
      (see its README). It is a devDependency installed with `--ignore-scripts`, so onnxruntime-node and sharp are
      never packaged. `speech-worker.js` runs it in a module worker on wasm, single-threaded because the page isn't
      cross-origin isolated.
    - **Model:** `onnx-community/whisper-base`, 8-bit encoder and decoder, 77 MB. On the first click, main.js
      (`speech:download`) downloads it into `%APPDATA%\Lumina\models`, writing .part files and renaming them when
      done, with progress shown in the panel. The protocol serves it at `lumina://app/@models/`. The worker never
      fetches anything remotely.
    - **Flow (`autoCaptions(L)`):** decode the clip's in..out audio at 16 kHz mono, then transcribe with segment
      timestamps and 30 s chunks. `speechLines()` breaks segments into lines of at most 42 letters, timed by their
      share of the letters. The times map through `tlTime` (so speed changes are followed) into one caption clip
      starting at the clip, using the same `captionLayer()` as SRT import.
    - **Speed:** an 8 s clip took about 4 s in the worker, about 6 s including the first download.
    - **Test:** speed suite step 14, `autoCaptions`. It uses `.claude/speed/media/speech.wav`, made with Windows'
      built-in text to speech (System.Speech, run as one PowerShell command, no script file). The sentence is "Hello
      and welcome to Lumina. Today we are testing automatic captions for videos. This is the last sentence." It
      checks the line splitting, the panel, the download, that at least 5 of 6 key words are heard, the timing, and
      the picture on screen. It downloads the model if it's missing. `modelWasReady: false` is expected only on the
      very first run on a machine.
    - **Possible later improvements:** word-level timing (a `_timestamped` model), WebGPU, and threads (would need
      COOP/COEP headers).
- **C8 Canvas background done (2026-11-06).** Properties › Whole video › **Canvas background**: Black (the old look),
  Solid colour, Gradient (from/to colour and angle) or Blurred video (blur and darken).
  - **Code:** `drawCanvasBg()` runs in render() right after the frame is cleared. It reads `S.global.bg`, `bgColor`,
    `bgColor2`, `bgAngle`, `bgBlur` and `bgDim`, and projects without these fall back to Black. Blurred video uses
    `bgSourceAt()`, the lowest video/image clip playing at that moment, stretched to fill the frame at 1.08x so the blur
    doesn't fade at the edges. The panel comes from `canvasBgPanel()`, and choosing a mode redraws the inspector.
  - **Fix found by the test:** openProject now empties `S.layers` before reloading media. Before this, a frame could draw
    an old picture clip with a half-loaded image and throw in drawImage.
  - **Test:** speed suite step 12, `canvasBg`. It checks the pixels for each mode at the sides of a tall white picture,
    the fallback to black when nothing is playing, the menu and the rows for each mode, and that the setting is kept in a
    saved project.
- **C7 Mask shapes done (2026-11-06).** Properties › Mask › shape menu: Rectangle, Oval, **Diamond, Star, Heart, Split,
  Cinematic bars**.
  - **New controls:** Mask angle° (turns every shape), Mask outline (width) and Outline color. Both are keyframable.
    Feather and Invert work on every shape.
  - **Split** keeps the side above a line through Mask X/Y (Invert for the other side) and hides width and height.
    **Cinematic bars** keeps a band across the whole frame; Mask height sets the band, and width is hidden.
  - **Code:** `MASK_SHAPES` and `maskPath(c, L, t, w, h, outline)`. Shapes are built from rotated points, so the drawing
    transform is never changed. `outline` gives only the visible edges (the lines for split and bars), which the
    selection overlay and the outline stroke use. The outline is drawn in `paintLayer` after the mask, in screen pixels.
  - **Tests:** `maskShapes` in the `speed` suite: inside/outside points for every shape, then on-screen pixels for star,
    split, split inverted, bars, the red outline and feather, plus the panel rows.
- **C6 Multi-select done (2026-11-06).**
  - **Selecting:**
    - Ctrl+click a clip (or its row name) to add or remove it.
    - Shift+click to select every row from the main clip to the clicked one.
    - Drag on empty timeline lane space to draw a selection box; Ctrl or Shift adds to the selection.
    - Ctrl+A or Edit › Select all clips; Esc keeps just the main clip; Edit › Deselect.
    - A plain click in a lane still moves the playhead; dragging the box puts the playhead back.
  - **Acting on the group:**
    - Dragging any selected clip moves them all, and they stop together at 0.
    - Trimming an edge trims that edge on every selected clip by the same amount; Ripple works too.
    - Delete removes all of them in one undo step.
    - A click without dragging on a clip in the group picks just that clip, as in CapCut.
    - The inspector shows "N clips selected" with Delete N clips and Keep just this one.
  - **Code:**
    - `MS` / `selIds` / `setMulti` / `toggleSel` / `rangeSel` / `boxHits`.
    - `S.sel` stays the main clip, and the group only counts while `S.sel` is still `MS.main`.
    - The trim code is now `clipState` / `trimHead` / `trimEnd`.
    - `snapT` ignores clips in the dragged group.
  - **Tests:** `multiClick`, `multiBox`, `multiMove`, `multiTrim` and `multiDelete`, in the `speed` suite.
  - **Not done yet:** Ctrl+D duplicates only the main clip; copying and pasting a group comes in C12.
  - **Effects suite glitch:** in one run, `fx` failed `cornerKept` / `followsLayer` (the Twirl frame came out wrong, then
    `#fx-add` was missing). A rerun passed, so it was a one-off in the test window; rerun if it shows up again.
- **C5 Ripple editing done (2026-11-06).** A **Ripple** toolbar button (also Edit › Ripple editing), remembered between
  sessions.
  - **What ripples:** with it on, deleting a clip, shortening it (right edge, speed, speed curve) or trimming its start
    closes the gap. Lengthening a clip pushes later clips along. Trims ripple live while dragging.
  - **How:** OpenCut's interval diff (removed clips and shortened ends free time, minus time added by the same edit) runs
    over the whole timeline. Everything starting after a gap moves, including impacts and bookmarks.
  - **What doesn't:** trimming a start keeps the clip in place and slides its content and keyframes in. Moving a clip
    never ripples, and a split frees nothing.
  - **Code:** `rippleSpans` / `rippleFinish` / `rippleRestore`. Tests are in the `speed` suite, which switches Ripple
    back off when it finishes.
- **C4 Anime VFX done (2026-11-06).** New "Anime VFX" effect group, written as Lumina's own WebGPU shaders in
  `shaders/lumina_vfx.wgsl` (packaged via `shaders/**` in package.json, loaded through `FX_PATHS`):
  - **RGB Split:** sideways at an angle, or out from a centre point.
  - **Edge Glow:** Sobel edges, blurred, screened or added; one colour or each edge's own; glow-only view.
  - **Flash:** screen, add or fill, any colour.
  - **VHS Glitch:** line tearing, a rolling band, colour bleed, colour shift, scanlines, tape noise.
  - **Camera Shake:** smooth random move and turn, with a zoom that hides the edges.
  - **Trigger** on each: Always on, on every / 2nd / 4th beat (all layers' beat marks), on impact markers, or on bookmarks.
    Each hit fades over "Fade after hit". Flash and Shake default to "On every beat".
  - **Cost:** about 5–6 ms per 1080p frame each. Tests are in the `fx` suite (plus trigger maths in `beat`); `effects.png`
    now has 49 tiles.
- **C3 Velocity curves done (2026-11-06).** Video and audio clips have a **Speed** panel:
  - **Speed curve:** presets Montage, Hero, Bullet, Jump cut, Flash in and Flash out, or Custom. A curve editor shows
    0.1x–10x on a log scale along the clip; drag points, double-click to add or remove them.
  - **How the curve works:** it is drawn along the clip's footage (`L.curve = { name, pts, a, b }`) and multiplies Speed,
    Speed ramp and slow-mos, using a monotone cubic on log speed (no overshoot).
  - **Split:** splitting a curved clip gives each half a window (a–b) of the same curve, so the split is exact.
  - **Higher speeds:** clip Speed goes 0.1x–10x, and Speed ramp up to 1000%.
  - **Keep pitch:** on by default (`preservesPitch`).
  - **Freeze frame here:** splits the clip, holds that frame silently for 3 s (`freeze: true`, timed like a picture),
    and pushes later clips back.
  - **Smooth slow-mo:** frame blending while playing or exporting; each new frame fades in over the time it is held.
  - **Tests:** new suite `.claude\speed`, expected false: none. That makes **eight suites**.
- **Test-window note (2026-11-06):** sometimes the hidden test window draws only ~2 frames a second; then `trans` fails
  `aHeldLastFrame`. The `trans` result now prints `framesPerSecond`; if it's 2, rerun. Chromium's occlusion switches didn't
  help, so they were not kept.
- **C2 Bookmarks done (2026-11-06).** A Bookmarks row under Impacts.
  - **Add and edit:** B adds or removes a bookmark at the playhead (frame-rounded); `[` / `]` jump between them; the
    Composition menu has the same three. Clicking a bookmark jumps there and opens its panel: note, 8 colour swatches
    plus any colour, duration (shown as a faint bar), Go to, Delete.
  - **Notes:** notes of the bookmarks under the playhead show at the top left of the preview (View › Show bookmark notes),
    never in the export.
  - **Snapping and dragging:** everything snaps to bookmarks and to the end of their duration. Drag a bookmark to move it
    (Shift: no snap); dropping it on another merges the two.
  - **Saving:** bookmarks are saved in the project and covered by undo. Tests are in the `beat` suite.
- **C1 Beat sync done (2026-11-06).** Audio and video layers have a **Beat sync** panel: Detect beats; Mark = Steady beat
  (tempo plus dynamic-programming beat tracking) or Every hit (onsets rated by loudness jump, Sensitivity in dB).
  Beat dots sit on the clip's timeline row; drag one to move it, click it and press Delete to remove it, or use Add beat at
  playhead / Clear beats. Clips, trims, impacts and keyframes snap to beats; hold Shift to drag without snapping.
  "Use every 1st/2nd/4th/8th beat" drives Cut on beats (splits a chosen clip) and Impacts on beats.
  Accuracy on the test track: within 18 ms. A 3-minute song analyses in about 0.65 s.
  New test suite: `.claude\beat` (expected false: none), so there are now **seven suites**.
  `split()` now calls `splitAt(layer, time)`, which cut-on-beat reuses.
- **Round 7 done (2026-11-06):** Vibrance, Color Balance, Black & White, Tritone, Colorama, Channel Mixer and Selective Color,
  all on EffectCraft's `fxc_point` shader, at about 4 ms per 1080p frame.
  Colorama has EffectCraft's graphics-card version (the Hue Cycle palette). Its preset palettes, custom palettes, Modify and
  colour matching only exist in EffectCraft's CPU code, so they're left for later.
  Selective Color's Colors menu shows one range's four sliders at a time.
- Lumina is rebuilt (`dist\win-unpacked\Lumina.exe`, the desktop shortcut), and all six self-test suites pass with only their usual expected results.
- **Already in Lumina:**
  - The timeline: layers, keyframes, expressions (wiggle/pulse/loop), rect/ellipse masks.
  - AI background removal, motion tracking, object erase.
  - Text and variable fonts, SVG parts, 3D.
  - 44 GPU effects (EffectCraft Rounds 1–7), transitions.
  - Speed ramps and slow-mo.
- **Interface so far:**
  - The purple "L" logo.
  - The menu bar, tools bar and fixed panels (Project / Composition / Preview + Properties / Timeline).
  - Effects & Presets and Effect Controls panels.
  - Workspace tabs.
  - View › Theme: Default (purple-grey), Greyscale, Cozy Home Theatre, **Frutiger Aero** (added 2026-11-10: a bright sky
    with bubbles, white frosted-glass panels, glossy aqua buttons, dark navy text; the preview stays dark slate; tested by
    the timeline suite's `aeroTheme` step).
  - View › Toggle fullscreen (F11).
  - The Help menu tagline.

## Waiting on you
- **New About Lumina text.** Send it whenever you have it. It goes in `const ABOUT_LUMINA` in `Lumina.html`. Until then the item is greyed out.
- **Layout pieces (optional):** these only happen when you ask, and they don't hold up the Order.
  - **A. Tool icons** in the tools bar (select, hand, zoom, pen, text, shapes, brush). This is the smallest.
  - **B. AE-style timeline columns:** switches, parent & link, twirl-down properties.
  - **C. Dockable panels:** drag, resize, dock, with tabs. This is the biggest.
  - **D. Photoshop-style panels** for Image mode: Layers, Adjustments, Properties.

## On hold from before
3D text, extruded SVG logos, 3D look-and-feel pass, faster export with presets, auto captions.
Linux build: merged and built by GitHub since 0.9.1 (the user asked for it 2026-11-07). The friend's copy stays in `lumina linux build` for reference.

---

## Reminders for Claude
- Do one feature at a time, test it, and ask before changing anything on the system.
- After every change: close Lumina first, otherwise the rebuild fails with EBUSY. Then run `npm run dist` with `C:\Program Files\nodejs` on PATH, and then all twelve suites.
- The twelve suites and their expected `false` results (`beat` and `speed` were added 2026-11-06, `timeline` 2026-11-07, `image` and `photo` 2026-11-08, `mcp` 2026-11-09; all six expect none):
  - `mcp`: none
  - `photo`: none
  - `image`: none
  - `timeline`: none
  - `beat`: none
  - `speed`: none
  - `.claude`: `dirtyAfter`
  - `trans`: none
  - `vfont`: `weightRow`, `motion`
  - `svg`: `orb`, `star`, `star`, `bar`
  - `3d`: `failed`
  - `fx`: `propsHasFxRows`
- Update "Start here next" and "Where things stand" at the end of each session.
- Say "Round", never the other word. No .bat, .cmd or .ps1 files have been created. If one ever is, say so plainly and explain what it does.
