# Lumina work plan (set up 2026-11-05)

Order of work (reordered by the user again, 2026-11-06):
**1. CapCut phase (section 5, steps C1–C14, using OpenCut-classic) → 2. Finish EffectCraft (from Round 8) → 3. Add PhotoCraft
as Lumina's Image mode → 4. Claude's own features, fixes and tweaks**
- One exception inside the EffectCraft step: Lumina Stage 1 (precomps, track mattes) is built just before the starred (*) effects,
  because those need a second layer or other frames.
- Section 4 (interface and layout) carries on alongside, one piece at a time, when the user picks one.

### Decisions (2026-11-06)
- **Start with the Theatre theme**, then EffectCraft Round 7.
- **Include everything** from EffectCraft: the audio (13), VR / 360° (12) and OCIO colour-management (5) effects too.
- **Lumina Stage 1** (precomps, track mattes) comes **before** the effects that need a second layer or other frames (marked *).
- **PhotoCraft goes into Lumina** as a Photoshop-style **Image mode** (ROADMAP Stage 5), not a separate app.
- Still open: whether the panel work (section 4, steps 2–5) comes before the rest of the effect rounds.

---

## 1. Finish EffectCraft

Source: https://github.com/storytold/effectcraft (MIT), pinned commit `3768ff40`.

**Size:** EffectCraft has 308 effect ids. 15 aren't real effects (9 expression controls and 6 marked obsolete),
which leaves about 293. Lumina has about 37 of them after Rounds 1–6, so **about 255 are left**.
At 6–10 effects a round that's roughly 30 more rounds.

**Decide tomorrow:**
- Do we include the **audio effects** (13), **VR / 360° effects** (12) and **OCIO colour-management** (5)?
- Some effects need a **second layer as input** (Displacement Map, Set Matte, Gradient Wipe, Blend…), or
  **other frames** (Echo, Time Displacement, Pixel Motion Blur). Those work best after Lumina Roadmap Stage 1
  (precomps / track mattes), so I've put them late in the plan.

### Rounds

| Round | Theme | Effects |
|---|---|---|
| 7 ✅ | Colour I | Vibrance, Color Balance, Black & White, Tritone, Channel Mixer, Selective Color, Colorama |
| 8 ✅ | Colour II | Exposure, Photo Filter, Shadow/Highlight, Change Color, Change to Color, Leave Color, Color Balance (HLS), Gamma/Pedestal/Gain, CC Toner, CC Color Offset |
| 9 ✅ | Colour III (auto & broadcast) | Auto Color, Auto Contrast, Auto Levels, Equalize, Broadcast Colors, Video Limiter, Arbitrary Map, Levels (Individual), CC Color Neutralizer, CC Kernel, Color Link, Color Stabilizer |
| 10 ✅ | Lumetri Color | The all-in-one grading panel: basic, creative, curves, colour wheels, HSL secondary, vignette |
| — ✅ | Finish Round 6 leftovers | Hue/Sat per-colour ranges, per-channel Levels, a draggable Curves graph (also for Lumetri's curves) |
| 11 ✅ | Keying I | Color Key, Linear Color Key, Luma Key, Color Range, Difference Matte, Extract, Inner/Outer Key, Color Difference Key |
| 12 ✅ | Keying II + mattes | Keylight, Spill Suppressor, Advanced Spill, Key Cleaner, Unmult, Screen, CC Simple Wire Removal, Simple Choker, Matte Choker, Refine Hard/Soft Matte |
| 13 ✅ | Blur & Sharpen rest | Bilateral, Fast Box, Channel Blur, Smart Blur, Compound Blur, CC Cross/Radial/Radial Fast/Vector Blur, Reduce Flicker (Camera-Shake Deblur moved to 25) |
| 14 ✅ | Distort I | Spherize, Polar Coordinates, Mirror, Offset, Magnify, Corner Pin, Transform, Optics Compensation (Smear moved to 16) |
| 15 ✅ | Distort II (CC) | CC Bend It, Bender, Blobbylize, Flo Motion, Griddler, Page Turn, Ripple Pulse, Slant, CC Smear, Split, Split 2, Tiler, Power Pin |
| 16 ✅ | Distort III (warps) | Bezier Warp, Mesh Warp, Warp, Twirl (legacy), Upscale, Displacement Map (Reshape and Smear moved to Masks II, Rolling Shutter Repair to 25) |
| 17 | Stylize I | Brush Strokes, Cartoon, Color Emboss, Roughen Edges, Scatter, Texturize, CC Threshold, CC Threshold RGB |
| 18 | Stylize II (CC) | CC Block Load, Burn Film, Glass, HexTile, Kaleida, Mr. Smoothie, Plastic, RepeTile |
| 19 | Generate I (shapes & fills) | Fill, Circle, Ellipse, Checkerboard, Cell Pattern, Stroke, Write-on, Scribble, Vegas, Paint Bucket, Eyedropper Fill, Radio Waves |
| 20 | Generate II (light) | Advanced Lightning, Lens Flare, Beam, CC Light Burst, CC Light Sweep, CC Glue Gun, CC Threads, Fractal |
| 21 | Noise & Grain | Add Grain, Match Grain, Remove Grain, Dust & Scratches, Median, Noise, Noise Alpha, Noise HLS (+Auto), Turbulent Noise, Curl Noise |
| 22 | Perspective | Drop Shadow, Radial Shadow, Bevel Alpha, Bevel Edges, 3D Glasses, CC Cylinder, CC Sphere, CC Spotlight, CC Environment |
| 23 | Transitions | Block Dissolve, Card Wipe, Gradient Wipe*, Iris/Linear/Radial Wipe, Venetian Blinds, CC Glass/Grid/Image/Light/Radial Scale/Scale Wipe, CC Jaws, Line Sweep, Twister, WarpoMatic |
| 24 | Channel* | Arithmetic, Blend, Calculations, CC Composite, Channel Combiner, Compound Arithmetic, Invert, Minimax, Remove Color Matting, Set Channels, Set Matte, Shift Channels, Solid Composite |
| 25 | Time* | Echo, Posterize Time, Time Difference, Time Displacement, Timewarp, Pixel Motion Blur, CC Force Motion Blur, CC Wide Time, Camera-Shake Deblur, Rolling Shutter Repair |
| 26–28 | Simulation | Particles (CC Particle World, Particle Systems II, Particle Playground), weather (Rainfall, Snowfall, Drizzle, Bubbles), Shatter, Card Dance, Caustics, Foam, Wave World, Ball Action, Hair, Mr. Mercury, Pixel Polly, Scatterize, Star Burst |
| 29 | Utility & Text | Apply LUT, Cineon, Color Profile Converter, HDR Compander/Compression, CC Overbrights, Grow Bounds, Numbers, Timecode |
| 30 | Audio-driven | Audio Spectrum, Audio Waveform |
| 31+ | Big tools (one each) | Liquify, Puppet, Paint, Roto Brush, Warp Stabilizer, Camera Tracker, Object Matte, Face Tracking, 3D Channel effects |
| optional | | Audio effects (13), VR effects (12), OCIO (5) |

\* needs a second layer or other frames. Best done after Lumina Stage 1.

Every round: port → self-tests on known colour patches → speed check → effects.png → rebuild → all six suites.

---

## 2. Lumina roadmap

Follow `ROADMAP.md`, which now uses the same order: EffectCraft, then PhotoCraft, then Claude's own additions.
(2026-11-10, the user chose: Round 16's effects first; parenting and precomps stay in After Effects Round A1. Blend modes
and track mattes were already there.) Stage 1 (precomps, blend modes, track mattes, parenting) was planned during EffectCraft, just before the first starred
effect (Displacement Map, Round 16). The other stages (graph editor, motion blur, pen masks/roto) come in step 4.

---

## 3. PhotoCraft roadmap (to build)

Source: https://github.com/storytold/photocraft. MIT or Apache-2.0, latest commit `3d60ad0`.

**What it is:** an open-source Photoshop-style editor in Rust (egui interface, wgpu GPU compositor).
Early alpha, v0.6.0; its own roadmap says it's about 45% ready for real work.
- 68 tools (56 done), a brush engine, layers with groups/masks/smart objects, 27 blend modes, layer styles
- 16 adjustment layers, filters, RGB/CMYK/Lab at 8/16/32-bit, ICC colour management
- Formats: PSD/PSB read/write, TIFF, OpenRaster, XCF/KRA/Affinity read, plus PNG/JPEG/WebP/EXR and more
- 26 code crates; the GPU code is in `crates/gpu` (not looked at yet)

**First steps tomorrow:**
1. Decide the goal: port PhotoCraft's features into **Lumina's Image mode** (ROADMAP Stage 5), or keep it separate?
2. Look at `crates/gpu` for WGSL shaders we can reuse, like EffectCraft's
3. Read PhotoCraft's `ROADMAP.md` and `docs/gaps.md`
4. Write the PhotoCraft roadmap in rounds, the same way as EffectCraft

---

## 4. New interface and Theatre theme (added 2026-11-05)

Goal: make Lumina look and work like After Effects, Photoshop, PhotoCraft and EffectCraft, in the
"Lumina Theatre Theme Palette v2". This replaces the old "layout/design pass" that was on hold.

### Theme colours (from the user's palette image)

| Name | Hex | Use in the app |
|---|---|---|
| Slate Black | `#1A1D20` | App background, timeline background |
| Charcoal | `#2A2F33` | Panels, menus, the inside of dialogs |
| Dark Iron | `#545454` | Borders, dividers, inactive buttons, scrollbars |
| Warm Light | `#DA9B3A` | Accent: selection, playhead, active tool, keyframes, focus glow |
| Dark Walnut | `#3E2F23` | Used sparingly: headers or highlights (the palette is labelled "brown-free", so keep it small) |

Not in the palette: a text colour. Suggest a warm off-white (about `#E8E4DC`) for main text and a dimmer
grey for hints. Check readability on Charcoal.
Feel: dark theatre, with a soft warm glow on what's selected or active (like the strip lighting in the image).

### Interface: what changes

**Shared with After Effects / EffectCraft**
- A menu bar (File, Edit, Composition, Layer, Effect, Animation, View, Window, Help)
- A tools bar along the top (select, hand, zoom, shapes, pen, text, brush…)
- **Docked panels** you can resize, move, stack as tabs, and close/reopen from Window:
  - **Project**: imported media and compositions
  - **Composition viewer**: the preview, with zoom, resolution and guides
  - **Timeline**: a layer stack on the left with twirl-down properties, and keyframes on the right
  - **Effect Controls**: settings for the selected layer's effects
  - **Effects & Presets**: a searchable list of every effect by category
  - **Character / Paragraph** (text), **Info**, **Audio**, **Preview** panels
- **Workspaces** you can switch between (Editing, Animation, Effects, Color, Image) and save your own

**Shared with Photoshop / PhotoCraft (Image mode, ROADMAP Stage 5)**
- A **Layers panel** with thumbnails, blend mode, opacity, lock and eye icons
- **Properties** and **Adjustments** panels, a tool options bar, and colour swatches with a colour picker
- A tools column on the left with Photoshop-style tool groups

### Suggested order
1. **Theme.** ~~Theatre palette~~: tried on 2026-11-06, and the user didn't like it. **Replaced the same day** with a
   cozy warm home-theatre theme taken from the logo: espresso browns `#1A110B`/`#22160E`, logo orange `#F07A22`→`#F68B32`
   as the accent, peach `#FFCC8A` highlights, cream `#FFF9EB`, and a soft amber glow. ✅
   **Replaced again (2026-11-06):** the user chose a new purple "L" logo, so there's a new logo/icon (`lumina-logo.svg`,
   rendered to `lumina-icon.png`, `lumina-logo.png` and `lumina.ico`) and a dark-mode theme in purple-tinted greys:
   panels `#1C1B21`/`#24232A`, violet accent `#9D7BF5`, lavender `#D8CCFF` highlights. The warm files are kept in
   `old-warm-theme\`. ✅
2. **Menu bar, tools bar and fixed panels.** ✅ Done 2026-11-06, matching the EffectCraft/After Effects screenshots:
   - Menu bar: File · Edit · Composition · Layer · View · Window · Help
   - Tools bar with workspace tabs (Default · Effects · Small Screen) and Export on the right
   - Panels: **Project** (left) · **Composition** viewer with a viewer bar (centre) · **Preview** + **Properties** (right) ·
     **Timeline** across the bottom, with a big timecode and layer numbers
   - Window menu shows or hides Project / Preview / Properties; the chosen workspace is remembered
3. **Still to do for the layout:**
   - Tool icons in the tools bar (select, hand, zoom, pen, text, shapes, brush), as in AE/PhotoCraft
   - Panels you can **drag, resize and dock**, with tabs
   - AE-style timeline columns: switches, parent & link, twirl-down properties
   - ~~**Effect Controls** and a searchable **Effects & Presets** panel~~ ✅ Done 2026-11-06: Effects & Presets is a
     tab beside Project (search, categories that fold, click to add); Effect Controls is a tab beside Properties; there's a
     new **Effect** menu; and the **Effects** workspace opens both. Properties now shows only an effects summary.
   - Photoshop-style Layers / Adjustments / Properties panels for Image mode
2. **Menu bar and tools bar**
3. **Docked panel system**: the biggest piece. Move the existing preview, timeline and properties into panels.
4. **Effect Controls and Effects & Presets panels.** These matter more as the EffectCraft rounds add effects.
5. **AE-style timeline**: layer stack with twirl-downs (pairs with ROADMAP Stage 1 precomps).
6. **Workspaces**, then the **Photoshop-style panels** when Image mode is built.

**Decide tomorrow:** do the theme (step 1) right away, before Round 7? Should the panel work (steps 2–5)
come before the rest of the EffectCraft rounds, since the Effects & Presets panel would make 250+ effects
easier to find?

Note: Lumina's look must be our own. Copy how these apps are *laid out and used*, not Adobe's icons, logos or branding.

---

## 5. CapCut-style anime-edit features (added 2026-11-05)

Step 3 of the work order. These are the features anime and gaming edits rely on. They're built in Lumina's own stack:
Electron, Canvas 2D, WebGL (the same pipeline as the 37 GPU effects) and the Web Audio API. There's no C++ or Rust.
Copy how CapCut's features work, not its look or branding.

### 5a. Beat sync (audio-reactive cutting)
- **Beat detection:** a worker that analyses an imported audio track with the Web Audio API (`decodeAudioData`, then
  onset/transient detection by spectral flux) and returns a list of beat times.
- **Beat markers** drawn on the timeline above the audio clip, with a sensitivity setting, and the option to add, move or
  delete markers by hand.
- **Magnetic snapping:** the playhead, keyframes, clip edges and cuts snap to beat markers. The existing `snapT()` in
  `Lumina.html` already snaps to clip edges and the playhead, so the beat markers get added to its list.
- **Auto cut on beat:** split or place clips on every beat, or every 2nd or 4th beat.
- **Beat-triggered effects:** the existing "Beat pulse" motion, flashes, shakes and the VFX below fire on markers.

### 5b. GPU anime VFX (real-time fragment shaders)
- **RGB split / chromatic aberration:** a per-channel offset with direction, amount and radial falloff.
- **Edge glow:** threshold-based edges, then a blur, then a screen blend over the frame, with colour and intensity.
- **Flash overlays:** a screen-blend white or colour flash, keyframable and triggered by beats.
- **VHS glitch:** scanlines, line tearing, colour bleed and noise.
- **What Lumina already has:** Glitch and Flash *transitions*, a Glitch text animation with RGB split, Impact (flash,
  shake, punch-in) and Strobe Light. Most of these run on Canvas 2D. Move them onto WebGL passes and make them keyframable.
- **Overlap with EffectCraft:** Glow, Find Edges, Shift Channels, Strobe Light. Reuse those effects where they match
  rather than building the same thing twice.

### 5c. Velocity curves and speed ramping
- **What Lumina already has:** clip Speed (0–3x), a keyframable "Speed ramp %" (10–400%) that integrates smoothly over
  time, and Slow-mo items with ease in and out.
- **To add:**
  - A **velocity curve editor** with cubic-bezier handles on the clip. It pairs with the graph editor in step 4.
  - **Presets:** montage, hero, bullet, flash in, flash out.
  - **Freeze frame.**
  - **A higher top speed:** 400% today; CapCut goes to about 100x.
  - **Frame blending or optical-flow smoothing**, so slow parts don't stutter. This ties in with Timewarp and Pixel
    Motion Blur in EffectCraft Round 25.
  - **Keep audio in sync**, or pitch-shift it, through ramps.

Suggested order: 5a, then 5c, then 5b. Every piece follows the same steps: one feature, test it, rebuild, run all six suites.

### 5d. Moved to the front (2026-11-06), with OpenCut added
The user moved this phase ahead of EffectCraft and PhotoCraft, and added **OpenCut** as a source. Its `main` branch is a
rewrite with almost no features yet, so the source is **opencut-classic** (https://github.com/opencut-app/opencut-classic,
MIT, v0.3.0, commit `cf5e79e919144200294fb9fed22a222592a0aeea`). It's written in TypeScript/React plus Rust compiled to WASM.
Its ideas and algorithms are ported into Lumina's own code, keeping its MIT notice.
Its folders, for reference: `apps/web/src/` `timeline/bookmarks`, `timeline/snapping`, `ripple`, `timeline/group-move`,
`timeline/group-resize`, `masks/builtin`, `background`, `subtitles`, `transcription`, `stickers`, `speed`, `retime`,
`timeline/audio-separation`, `clipboard`, `animation` (graph editor), `preview` (zoom/pan).

The steps (same as ROADMAP.md): C1 Beat sync (5a), C2 Bookmarks, C3 Velocity curves (5c, plus OpenCut's keep-pitch),
C4 GPU anime VFX (5b), C5 Ripple editing, C6 Multi-select, C7 Mask shapes, C8 Canvas background, C9 Captions,
C10 Stickers, C11 Separate audio, C12 Clipboard and keyframe tools, C13 Preview zoom and pan, C14 Graph editor.
Because EffectCraft now comes later, C4 builds its own small WebGPU/WebGL passes. Matching EffectCraft effects can replace
them later.
