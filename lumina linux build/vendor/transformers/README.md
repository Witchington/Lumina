# Speech to text for Lumina's auto captions

- `transformers.min.js`: Transformers.js **4.3.2** (`@huggingface/transformers`, Apache-2.0, see LICENSE-transformers),
  copied from `node_modules/@huggingface/transformers/dist`. It is a devDependency only, so its Node add-ons
  (onnxruntime-node, sharp) are never packaged.
- `ort-wasm-simd-threaded.asyncify.mjs` / `.wasm`: the ONNX Runtime Web engine it loads (onnxruntime-web
  1.31.0-dev.20260914-8d85527a0, MIT, Microsoft), copied from `node_modules/onnxruntime-web/dist` so nothing
  is fetched from a CDN.
- `speech-worker.js`: Lumina's worker that runs Whisper.

The model is **not** in this folder. It is `onnx-community/whisper-base` (8-bit encoder and decoder, about 77 MB),
downloaded once from Hugging Face on the user's OK into `%APPDATA%\Lumina\models` (see `SPEECH` in electron/main.js).

To update: `npm install --save-dev --save-exact --ignore-scripts @huggingface/transformers@<version>`, copy the files
again, and check which `ort-wasm-simd-threaded.*` file names `transformers.min.js` asks for.
