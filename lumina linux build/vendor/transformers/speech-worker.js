// Lumina auto captions: runs Whisper off the main thread, so the editor stays responsive while it listens.
// Everything is local: the library and its engine are in this folder, the model is in Lumina's data folder
// (served at lumina://app/@models/). Nothing is fetched from the internet here.
import { pipeline, env } from './transformers.min.js';

env.allowRemoteModels = false;
env.allowLocalModels = true;
env.localModelPath = 'lumina://app/@models/';
env.useBrowserCache = false;
env.backends.onnx.wasm.wasmPaths = 'lumina://app/vendor/transformers/';
env.backends.onnx.wasm.numThreads = self.crossOriginIsolated ? Math.min(4, navigator.hardwareConcurrency || 1) : 1;

let asr = null;
const load = () => asr ||= pipeline('automatic-speech-recognition', 'onnx-community/whisper-base', {
  dtype: { encoder_model: 'q8', decoder_model_merged: 'q8' }, device: 'wasm'
});

self.onmessage = async ({ data }) => {
  const { id, audio, language } = data;
  try {
    const t0 = performance.now();
    const run = await load();
    self.postMessage({ id, stage: 'loaded', ms: performance.now() - t0 });
    const out = await run(audio, {
      return_timestamps: true, chunk_length_s: 30, stride_length_s: 5,
      ...(language && language !== 'auto' ? { language, task: 'transcribe' } : { task: 'transcribe' })
    });
    self.postMessage({ id, done: true, text: out.text, chunks: out.chunks || [], ms: performance.now() - t0 });
  } catch (e) {
    self.postMessage({ id, error: String(e && e.message || e) });
  }
};
