import io
def edit(p, pairs):
    raw = io.open(p, 'rb').read(); crlf = b'\r\n' in raw
    s = raw.decode('utf-8').replace('\r\n', '\n')
    for a, b in pairs:
        assert s.count(a) == 1, (p, a[:80], s.count(a)); s = s.replace(a, b)
    if crlf: s = s.replace('\n', '\r\n')
    io.open(p, 'wb').write(s.encode('utf-8'))

edit(r'D:\Lumina\WORKPLAN.md', [("| 29 | Utility & Text |", "| 29 ✅ | Utility & Text |")])

ROADMAP = r'D:\Lumina\ROADMAP.md'
s = io.open(ROADMAP, encoding='utf-8').read()
a = s.index("Rounds 8–28 and the Round 6 leftovers are done; **every Simulation effect is in** (18)."); b = s.index("Round 28's helpers:", a)
OLD_BRIEF = s[a:b]
edit(ROADMAP, [
 ("## ▶ Start here next: Round 29 (Utility & Text) (Round 28 done 2026-11-13); Round 28 and the Claude control steps M1–M4 are done",
  "## ▶ Start here next: Round 30 (Audio-driven) (Round 29 done 2026-11-13); Round 29 and the Claude control steps M1–M4 are done"),
 ("Round 28 is committed (2026-11-13; all twelve suites as before).", "Round 29 is committed (2026-11-13; all twelve suites as before)."),
 (OLD_BRIEF, """Rounds 8–29 and the Round 6 leftovers are done; every Simulation effect is in (18), and the **Utility** (7) and **Text**
(2) groups are new. **Round 30 is next, Audio-driven** (WORKPLAN.md's round table): Audio Spectrum and Audio Waveform.
Find their host code in EffectCraft's crates/effects/src (generate3/audio.rs, and crates/gpu/src) at the pinned commit
with `gh api`, as before; check how Lumina already reads a layer's audio (beat sync, the waveform in the timeline) first.
Round 29's helpers: `cpProgram(q)` (Color Profile Converter's colour program: ocio/space.rs's matrices, Bradford,
`CP_PROFILES`), `lutProgram(l)` (a LUT as fx_lut.wgsl's fxl_point program, tetrahedral; LUTS entries now carry `n1`, `d1`,
`dmin`, `dmax` and `raw`, and `parseCube` reads 1D tables too), the stroke-font text layout `txLayout` / `txLineWidth` /
`txUnit` / `txWeight` (textfx's layout_line), `txCoverage(E, img, polys, r, sw)` (text_coverage on fg2_segs: fill, and a
stroke ring's outer and inner edges), `txNumbers` / `txTimecode` / `txDropFrame` / `txDate`; Lumina's
shaders/lumina_util.wgsl (`lu_point`); `E.grow` (Grow Bounds: the box the clip effects are cut to grows). """),
 ("EffectCraft carries on at **Round 29 (Utility & Text)**.", "EffectCraft carries on at **Round 30 (Audio-driven)**."),
 ("""   **Where we left off: Rounds 1–28 and the Round 6 leftovers are done; Round 29 (Utility & Text) is next.** About 54
   effects are left, in Rounds 29–31+ (Reshape and Smear wait for Masks II, A7).""",
  """   **Where we left off: Rounds 1–29 and the Round 6 leftovers are done; Round 30 (Audio-driven) is next.** About 45
   effects are left, in Rounds 30–31+ (Reshape and Smear wait for Masks II, A7)."""),
 ("""- **EffectCraft Round 28 done (2026-11-13): Simulation, pieces and surfaces.**""",
  """- **EffectCraft Round 29 done (2026-11-13): Utility & Text.** Two new groups in the effects menu:
  - **Utility** (7): **Grow Bounds** (Lumina's effects work on the whole frame, so it widens the layer's box that
    generators, Numbers and Timecode are cut to, as EffectCraft's padded buffer does), **CC Overbrights** (in-range values
    dim grey, over 1 the highlight colour, under 0 its complement), **HDR Highlight Compression**, **HDR Compander**
    (Compress / Expand Range, exact inverses), **Cineon Converter** (Linear to Log, Log to Linear, Log to Log), **Color
    Profile Converter** (sRGB, Rec. 709, Rec. 2020, Display P3, ACEScg, ACES2065-1; four intents) and **Apply Color LUT**
    (a .cube file with a 1D table, a 3D table or both, tetrahedral; its menu lists Lumina's looks and loaded LUTs and can
    load another).
  - **Text** (2): **Numbers** (number, leading zeros, three timecodes, time, three dates, hexadecimal; random values;
    fill and stroke) and **Timecode** (SMPTE with drop frame, frames, feet + frames; layer, composition or custom time;
    a box behind it), in textfx's stroke font.
  - **How they are drawn:** Color Profile Converter and Apply Color LUT through EffectCraft's fx_lut.wgsl (fxl_point,
    the same colour programs); Numbers' coverage by fx_gen2's fg2_segs and fg2_text, Timecode's by fg2_segs and fx_text's
    ftx_text; the other four per pixel in Lumina's shaders/lumina_util.wgsl (EffectCraft does them on the CPU).
  - **LUT files:** `.cube` files with only a 1D table now load (before, Lumina refused them); the Color panel and Lumetri
    still need a 3D table and list only those. A project saves a LUT's 1D table and domain too.
  - **Differences from EffectCraft:** Project Working Space is sRGB (Lumina's working space); Numbers and Timecode don't
    follow the layer's own rotation (as the piece effects); Apply Color LUT doesn't ask for a file the moment it's added
    (pick "Load .cube file…" in its menu); Grow Bounds before an effect that fills the layer's box grows it for every such
    effect on the layer (the largest one wins).
  - **Speed** at 1080p, 3 s in: about 5 ms a frame each (most of that is the layer itself).
  - Host code from EffectCraft's crates/effects/src (utility.rs, utility2.rs, textfx.rs, ocio/effects.rs, ocio/space.rs,
    ocio/program.rs), crates/gpu/src (fx_lut.rs, fx_text.rs) and crates/project/src/footage.rs, read with `gh api`;
    nothing was downloaded or installed.
  - Test: the fx suite's util29Kernels, util29Details (Overbrights' grey and red over Exposure; HDR Compression's white to
    half and Amount 0; Compander's defaults and compress-then-expand; Cineon's darker middle and log-then-linear round trip;
    Profile Converter's defaults, Rec. 2020 and an ACEScg round trip; Apply LUT with none, a 1D invert, a 3D identity and
    Noir, the menus, a broken file; Numbers' strings, position, stroke and long date; Timecode's strings, box, moving text;
    Grow Bounds widening Numbers past the layer's edge), util29Menu and round29speed.
- **EffectCraft Round 28 done (2026-11-13): Simulation, pieces and surfaces.**"""),
])
print('ok')
