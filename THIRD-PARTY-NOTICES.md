# Third-party notices

Lumina's own code is under the licence in `LICENSE`. Lumina also includes the parts below,
made by other people. Each part keeps its own licence. The full licence texts are in the
places given (they ship inside the app too).

## Inside the app

| Part | What it does in Lumina | Licence | Source | Full licence text |
|---|---|---|---|---|
| **FFmpeg** 6.0 | Reads, converts and exports video and audio | **GPL-3.0** | see "FFmpeg" below | `node_modules/ffmpeg-static/ffmpeg.exe.LICENSE` (Windows), `node_modules/ffmpeg-static/ffmpeg.LICENSE` (Linux) |
| ffmpeg-static 5.2.0 | Supplies the FFmpeg program | GPL-3.0-or-later | https://github.com/eugeneware/ffmpeg-static | `node_modules/ffmpeg-static/LICENSE` |
| **EffectCraft** shaders (commit 3768ff4) | The graphics-card effects | MIT (dual MIT / Apache-2.0; Lumina uses MIT) | https://github.com/storytold/effectcraft | `vendor/effectcraft/LICENSE-MIT`, `NOTICE` |
| Transformers.js 4.3.2 | Auto captions (speech to text) | Apache-2.0 | https://github.com/huggingface/transformers.js | `vendor/transformers/LICENSE-transformers` |
| ONNX Runtime Web 1.31.0-dev | Runs the caption model | MIT, Microsoft | https://github.com/microsoft/onnxruntime | `vendor/transformers/README.md` |
| three.js 0.186.1 | 3D | MIT | https://github.com/mrdoob/three.js | `node_modules/three/LICENSE` |
| MediaPipe Tasks Vision 0.10.14 and the selfie segmenter model | Background removal | Apache-2.0, Copyright Google LLC | https://github.com/google-ai-edge/mediapipe | `vendor/mediapipe/LICENSE-APACHE` |
| Electron 45.2.3 (with Chromium) | The app shell | MIT; Chromium parts under their own licences | https://github.com/electron/electron | `LICENSE.electron.txt` and `LICENSES.chromium.html`, next to `Lumina.exe` |

### Fonts

All under the **SIL Open Font License 1.1**, packaged through Fontsource 5.3.0
(https://github.com/fontsource/font-files). Each font's licence text is in
`node_modules/@fontsource/<font>/LICENSE` or `node_modules/@fontsource-variable/<font>/LICENSE`.

Anton, Bangers, Barlow, Black Ops One, Fraunces, Open Sans, Russo One, Big Shoulders Display,
Exo 2, Montserrat, Unbounded.

## Downloaded only when you say OK (not inside the app)

| Part | What it does | Licence | Source |
|---|---|---|---|
| yt-dlp | Link converter | Unlicense (public domain) | https://github.com/yt-dlp/yt-dlp |
| Whisper base (onnx-community/whisper-base) | The caption model | MIT (OpenAI Whisper) | https://huggingface.co/onnx-community/whisper-base |

## FFmpeg

Lumina runs FFmpeg as a separate program. It is not built into Lumina's own code. FFmpeg is
free software under the GNU General Public License, version 3. You can get its source code
here:

- **Windows** build: FFmpeg 6.0 "essentials" by gyan.dev, https://www.gyan.dev/ffmpeg/builds/
  Source: https://github.com/FFmpeg/FFmpeg/commit/ea3d24bbe3
- **Linux** build: FFmpeg 6.0 static build by John Van Sickle, https://johnvansickle.com/ffmpeg/
- FFmpeg project and full source: https://ffmpeg.org/download.html

If you can't get the source from those links, ask the Lumina author through
https://github.com/Witchington/Lumina and they will send you a copy, for at least three
years after this version was released.
