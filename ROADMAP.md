# Lumina roadmap

Goal: Lumina usable like After Effects, Photoshop, EffectCraft and CapCut. An editor for everything.

**This is the plan to follow. Open it first every session.** Work through the Order below, one step at a time.
`WORKPLAN.md` only holds the details behind each step: the full round lists and the CapCut notes.

---

## ▶ Start here next: Round 12 (Keying II + mattes), or MCP step M4 (output + Image mode); ask the user which
**Back on EffectCraft (2026-11-08, the user: "I actually wanna work back on Effectcraft… I want Lumina to have everything
Adobe After Effects and Premier Pro have. I also want the screen effects everything they offer I want to have").**
**One round at a time** (the user, 2026-11-08: the continuous run "wasn't working", round by round was; don't run rounds back to back again). Local git commits after each round are
OK (never push). Round 11 is committed (2026-11-09; all eleven suites pass, after fixing a name clash: Round 11's mask
shape helper is `maskShapePath`, because the stickers already have a `shapePath`). The setup that replaces the old Lumina
is done too (see its section). Round 12's code and tests are drafted in `.claude\round12-draft\` (r12.py edits Lumina.html and
appends r12_shader.wgsl to shaders\lumina_key.wgsl; r12test.py adds the fx tests; its SP path points at the old
scratchpad, so fix that first). Not applied yet.
Rounds 8–11 and the Round 6 leftovers are done. Round 12 is next, Keying II + mattes: Keylight, Spill Suppressor, Advanced
Spill Suppressor, Key Cleaner, Unmult, Screen Key, CC Simple Wire Removal, Simple Choker, Matte Choker, Refine Hard / Soft
Matte. Most are ops of `fx_key.wgsl`'s `fxk_point` (Lumina's `fx_key` family, built with `fx_distort`): 7 Spill Suppressor,
8 Advanced Spill (with `fxk_reduce`), 10 Unmult, 22/23 Screen Key, 25 Key Cleaner, 26 Matte Choker, 29–35 Refine Matte;
Keylight is in `fx_color.wgsl` ("Key Light"), CC Simple Wire Removal is `fx_pixel2`'s `fp2_wire`. The CPU versions (the
reference for each op's settings) are EffectCraft's `crates/effects/src/keying.rs`, `keying2.rs`, `keylight.rs` and `matte.rs`
(copies in the scratchpad's `ec-ref/effects-crate`). Round 11's helpers: `fxThinFeather`, `fxMorphFrac` (`fxn_morph`),
`fxKeyApply`, `E.upload(canvas)`.
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
format) and P3 (Image mode basics) are done**; P4 (Painting) is saved for later, to pick up when the user asks. P4 builds on Image mode: a paint layer is a new layer
kind holding its own pixels, at the canvas size, listed in the Layers panel like the rest.

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
The beginner layout, for reference:
- **B1 Tool rail (done):** icon tabs down the left (Media, Text, Stickers, Effects, Transitions, Captions, Audio, Adjust), each
  opening a browsable panel with previews to click or drag in, like CapCut. Leave room for an Image tab (PhotoCraft).
- **B2 Clip quick bar (done):** with a clip picked, big icon buttons above the timeline (Split, Speed, Mask, Freeze, Separate
  audio, Volume, Canvas, Animate, Delete), each jumping to the right settings.
- **B3 Beginner / Pro switch: built, then removed at the user's request (2026-11-07).** Lumina always shows every
  setting (what was "Pro"). Don't bring a mode switch back unless the user asks.
- **B4 Welcome + tips (done):** first-run welcome (new, open, sizes like YouTube / TikTok / Square) and one-time tips pointing at
  key features, which can be turned off.

### Claude control (MCP), asked for by the user 2026-11-08: M1, M1b, M2 and M3 done 2026-11-09, M4 (output + Image mode) next
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
- **M4 Output + Image mode:** `export` (to a path, never overwriting without saying so), `save_project`, PhotoCraft tools.
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
EffectCraft carries on at **Round 12 (Keying II + mattes)**.
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
   **Where we left off: Rounds 1–11 and the Round 6 leftovers are done; Round 12 (Keying II + mattes) is next.** About 217
   effects are left, in Rounds 12–31+.
   - Round 11: Color Key, Linear Color Key, Luma Key, Color Range, Difference Matte, Extract, Inner/Outer Key, Color Difference Key
   - Later Rounds: Lumetri, keying (Linear Color Key, Keylight), particles, time effects, Shatter and the rest
   - **Foundations, built during this step:** precomps (compositions inside compositions), blend modes, track mattes and parenting.
     They go in just before the effects that need a second layer or other frames (from Round 16, Displacement Map, onward).
2. **Start and finish PhotoCraft** (https://github.com/storytold/photocraft) as Lumina's **Image mode**, the Photoshop side.
   **Started 2026-11-08 at the user's request, before EffectCraft was finished** (EffectCraft resumes at Round 8 when the user says).

### PhotoCraft rounds (written 2026-11-08)
| Round | Theme | What |
|---|---|---|
| P1 ✅ | Save as image | The frame at the playhead in 16 formats: PNG, JPEG, WebP, AVIF, HEIC, GIF, TIFF, layered PSD, BMP, PDF, SVG, EPS, AI, ICO, TGA, JPEG 2000. Quality and see-through background settings. |
| P2 ✅ | Animated images, sequences, opening images | Animated GIF / WebP / APNG from a range; PNG/JPEG sequences; import TIFF, PSD (flattened), TGA, HEIC, AVIF, JP2, BMP and others through FFmpeg (`image:toPNG` is already there). RAW needs a decoder FFmpeg doesn't have: decide then. |
| P3 ✅ | Image mode basics | An **Image** workspace and rail tab; a still-picture document (canvas size, no timeline); Layers panel with thumbnails, opacity, lock and eye; crop, canvas size, image size, rotate/flip. |
| P4 ⏸ (saved for later) | Painting | Paint layers; brush (size, hardness, opacity, flow, spacing), eraser, pencil; colour picker, swatches, eyedropper; fill and gradient tools. |
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
  - View › Theme: Default (purple-grey), Greyscale, Cozy Home Theatre.
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
