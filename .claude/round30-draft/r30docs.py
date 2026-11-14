import io
def edit(p, pairs):
    raw = io.open(p, 'rb').read(); crlf = b'\r\n' in raw
    s = raw.decode('utf-8').replace('\r\n', '\n')
    for a, b in pairs:
        assert s.count(a) == 1, (p, a[:80], s.count(a)); s = s.replace(a, b)
    if crlf: s = s.replace('\n', '\r\n')
    io.open(p, 'wb').write(s.encode('utf-8'))

edit('D:/Lumina/WORKPLAN.md', [("| 30 | Audio-driven |", "| 30 ✅ | Audio-driven |")])

ROADMAP = 'D:/Lumina/ROADMAP.md'
s = io.open(ROADMAP, encoding='utf-8').read().replace('\r\n', '\n')
a = s.index("Rounds 8–29 and the Round 6 leftovers are done;"); b = s.index("Round 29's helpers:", a)
OLD_BRIEF = s[a:b]
edit(ROADMAP, [
 ("## ▶ Start here next: Round 30 (Audio-driven) (Round 29 done 2026-11-13); Round 29 and the Claude control steps M1–M4 are done",
  "## ▶ Start here next: Round 31 (Big tools, one each) (Round 30 done 2026-11-13); Round 30 and the Claude control steps M1–M4 are done"),
 ("Round 29 is committed (2026-11-13; all twelve suites as before).", "Round 30 is committed (2026-11-13; all twelve suites as before)."),
 (OLD_BRIEF, """Rounds 8–30 and the Round 6 leftovers are done; every Simulation effect is in (18), the **Utility** (7) and **Text** (2)
groups are in, and **Audio Spectrum** and **Audio Waveform** joined Generate (Round 30). **Round 31+ is next: the big tools,
one a Round** (WORKPLAN.md's round table: Liquify, Puppet, Paint, Roto Brush, Warp Stabilizer, Camera Tracker, Object
Matte, Face Tracking, 3D Channel effects). Ask the user which one first; find its host code in EffectCraft at the pinned
commit with `gh api`, as before. Round 30's helpers: `auDecode(mid)` (a media file's sound decoded once at 48 kHz, left
and right, in `AU`; a redraw when it is in), `auWarmAll()` (every followed sound decoded; export waits on it),
`auWindow(E, id, ms, offset, ch)` (audio_window: the audio layer's samples round the composition time, at its volume,
silent outside it), `auFFT` / `auMags` (fft, compute_fft_mags), `auBaseline(E, q)` (Baseline: the line, the mask or the
polar circle), `auMarks(E, img, q, segs, thick, soft)` (draw_marks on fg2_segs and fg2_marks), `auPick` / `auLayers`
(the audio layer menu), `AU_HEAD` (the shared settings); an FX entry with `audio: true` follows a sound layer. """),
 ("EffectCraft carries on at **Round 30 (Audio-driven)**.", "EffectCraft carries on at **Round 31 (Big tools, one each)**."),
 ("""   **Where we left off: Rounds 1–29 and the Round 6 leftovers are done; Round 30 (Audio-driven) is next.** About 45
   effects are left, in Rounds 30–31+ (Reshape and Smear wait for Masks II, A7).""",
  """   **Where we left off: Rounds 1–30 and the Round 6 leftovers are done; Round 31+ (Big tools, one each) is next.** About
   43 effects are left, in Rounds 31+ (Reshape and Smear wait for Masks II, A7)."""),
 ("""- **EffectCraft Round 29 done (2026-11-13): Utility & Text.**""",
  """- **EffectCraft Round 30 done (2026-11-13): Audio-driven.** Two effects in the Generate group (now 26):
  - **Audio Spectrum** (the sound's frequencies from Start to End Frequency as bands along a line, the layer's mask or a
    circle; Digital bars, Analog lines or dots; Side A, B or both) and **Audio Waveform** (the sound itself: Digital
    peaks, Analog lines or dots; mono, left or right). Both pick an **Audio layer** (any layer with sound, video or
    audio), follow its timing, speed and volume, and are silent outside it; Inside / Outside colour with a soft halo.
  - **How they are drawn:** the sound is decoded once per file at 48 kHz (Web Audio); the FFT (a Hann window) and the
    peaks are worked out per frame on the CPU, as EffectCraft; the marks by fx_gen2's fg2_segs (a hard core and a soft
    halo) and fg2_marks. Export decodes the sound before the first frame; while it is still decoding the layer passes
    through and is drawn again once it is in.
  - **Differences from EffectCraft:** its settings that do nothing there (Blend Overlapping Colors, Hue Interpolation,
    Dynamic Hue Phase, Color Symmetry, Duration Averaging, Random Seed (Analog)) are left out; Path is None or the layer's
    mask (Lumina has one mask a layer).
  - **Speed** at 1080p: about 5–6 ms a frame each (most of that is the layer itself).
  - Host code from EffectCraft's crates/effects/src/generate3/audio.rs and registry.rs and crates/gpu/src/fx_gen2.rs, read
    with `gh api`; nothing was downloaded or installed.
  - Test: the fx suite's audio30Kernels, audio30Details (a made-up 4 s WAV with a 1 kHz tone in the left channel for 2 s:
    the menu and passing through with none; decoding; the 1 kHz bar in the right place and height, nothing after the tone,
    Audio Offset reaching back, Side B; Analog lines and dots; Composite on original; the polar circle; Waveform's Digital
    peaks for left, right and mono, Analog lines, silence later), audio30Menu and round30speed; generateMenu20 now
    expects 26.
- **EffectCraft Round 29 done (2026-11-13): Utility & Text.**"""),
])
print('ok')
