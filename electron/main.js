// Lumina desktop shell: window, file dialogs, project files and a local media server.
const { app, BrowserWindow, ipcMain, dialog, protocol, nativeTheme, Menu, webUtils } = require('electron');
const path = require('path');
const fs = require('fs');
const { Readable } = require('stream');

const ROOT = path.join(__dirname, '..');
const SELFTEST = process.argv.includes('--selftest');

// ---- Linux (from a friend's AppImage build): keep Chromium's default GPU path; forcing Vulkan/Ozone broke compositing on some NVIDIA setups ----
if (process.platform === 'linux') {
  app.commandLine.appendSwitch('enable-unsafe-webgpu');
  // AppImages can't ship a setuid chrome-sandbox, so skip it unless the user opts back in
  if (process.env.APPIMAGE && !process.env.LUMINA_KEEP_SANDBOX) app.commandLine.appendSwitch('no-sandbox');
  // escape hatches for GPU/driver problems: LUMINA_SOFTWARE=1 (no GPU), LUMINA_X11=1 (X11 instead of Wayland)
  if (process.env.LUMINA_SOFTWARE) app.disableHardwareAcceleration();
  if (process.env.LUMINA_X11) app.commandLine.appendSwitch('ozone-platform', 'x11');
}

// One custom scheme and one host serve both the app (lumina://app/...) and the user's media
// (lumina://app/@media/<path>). Same origin for both, so video frames can be read by canvas/WebGL without "tainting".
protocol.registerSchemesAsPrivileged([{
  scheme: 'lumina',
  privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true, corsEnabled: true }
}]);

const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.wasm': 'application/wasm', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.svg': 'image/svg+xml',
  '.webp': 'image/webp', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.woff': 'font/woff', '.tflite': 'application/octet-stream',
  '.mp4': 'video/mp4', '.m4v': 'video/mp4', '.mov': 'video/quicktime', '.webm': 'video/webm', '.mkv': 'video/x-matroska',
  '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.ogg': 'audio/ogg', '.m4a': 'audio/mp4', '.cube': 'text/plain', '.onnx': 'application/octet-stream'
};

// Serve a file with Range support so video seeking works.
function serveFile(file, request) {
  let stat;
  try { stat = fs.statSync(file); } catch { return new Response('Not found', { status: 404 }); }
  if (!stat.isFile()) return new Response('Not found', { status: 404 });
  const type = MIME[path.extname(file).toLowerCase()] || 'application/octet-stream';
  const range = request.headers.get('range');
  const m = range && /bytes=(\d*)-(\d*)/.exec(range);
  if (m) {
    const start = m[1] ? +m[1] : Math.max(0, stat.size - +m[2]);
    const end = m[1] && m[2] ? Math.min(+m[2], stat.size - 1) : stat.size - 1;
    if (start >= stat.size) return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${stat.size}` } });
    return new Response(Readable.toWeb(fs.createReadStream(file, { start, end })), {
      status: 206,
      headers: { 'Content-Type': type, 'Content-Length': String(end - start + 1), 'Content-Range': `bytes ${start}-${end}/${stat.size}`, 'Accept-Ranges': 'bytes' }
    });
  }
  return new Response(Readable.toWeb(fs.createReadStream(file)), {
    headers: { 'Content-Type': type, 'Content-Length': String(stat.size), 'Accept-Ranges': 'bytes' }
  });
}

function registerProtocol() {
  protocol.handle('lumina', request => {
    const url = new URL(request.url);
    if (url.host === 'app' && url.pathname.startsWith('/@media/')) {
      const file = decodeURIComponent(url.pathname.slice('/@media/'.length)), slow = SELFTEST ? +url.searchParams.get('slow') || 0 : 0;
      // the self-test can play a file "from a slow drive": each read waits this many milliseconds
      return slow ? new Promise(r => setTimeout(() => r(serveFile(file, request)), slow)) : serveFile(file, request);
    }
    if (url.host === 'app' && url.pathname.startsWith('/@models/')) {
      // downloaded speech model files, only from inside Lumina's models folder
      const file = path.normalize(path.join(MODELS, decodeURIComponent(url.pathname.slice('/@models/'.length))));
      if (!file.startsWith(MODELS + path.sep)) return new Response('Forbidden', { status: 403 });
      return serveFile(file, request);
    }
    if (url.host === 'app') {
      // only files inside the app folder
      const file = path.normalize(path.join(ROOT, decodeURIComponent(url.pathname)));
      if (!file.startsWith(ROOT)) return new Response('Forbidden', { status: 403 });
      return serveFile(file, request);
    }
    return new Response('Not found', { status: 404 });
  });
}

// ---------- speech model for auto captions (CapCut phase C9) ----------
// Whisper base (multilingual, 8-bit), from Hugging Face, downloaded once on the user's OK into Lumina's own data folder.
const MODELS = path.join(app.getPath('userData'), 'models');
const SPEECH = { repo: 'onnx-community/whisper-base', rev: 'main',
  files: ['config.json', 'generation_config.json', 'preprocessor_config.json', 'tokenizer.json', 'tokenizer_config.json',
    'onnx/encoder_model_quantized.onnx', 'onnx/decoder_model_merged_quantized.onnx'] };
const speechDir = () => path.join(MODELS, ...SPEECH.repo.split('/'));
const speechReady = () => SPEECH.files.every(f => fs.existsSync(path.join(speechDir(), f)));
ipcMain.handle('speech:status', () => ({ ready: speechReady(), dir: speechDir() }));
let speechDl = null;
ipcMain.handle('speech:download', e => {
  // one download at a time; each file goes to .part first, so a cut-off download never looks finished
  speechDl ||= (async () => {
    const sizes = {}, done = {}, send = name => { const tot = Object.values(sizes).reduce((a, b) => a + b, 0), got = Object.values(done).reduce((a, b) => a + b, 0); if (!e.sender.isDestroyed()) e.sender.send('speech:progress', { got, total: tot, file: name }); };
    for (const f of SPEECH.files) {
      const dest = path.join(speechDir(), f);
      if (fs.existsSync(dest)) continue;
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      const res = await fetch(`https://huggingface.co/${SPEECH.repo}/resolve/${SPEECH.rev}/${f}`);
      if (!res.ok) throw new Error(`Download failed (${res.status}) for ${f}`);
      sizes[f] = +res.headers.get('content-length') || 0; done[f] = 0;
      const out = fs.createWriteStream(dest + '.part');
      for await (const chunk of res.body) { out.write(chunk); done[f] += chunk.length; send(f); }
      await new Promise((ok, bad) => out.end(err => err ? bad(err) : ok()));
      fs.renameSync(dest + '.part', dest);
    }
    return { ready: speechReady() };
  })().finally(() => { speechDl = null; });
  return speechDl;
});

let win = null, dirty = false, pendingOpen = null, closing = false;
const projectArg = argv => argv.find(a => /\.lumina$/i.test(a) && fs.existsSync(a));

function createWindow() {
  win = new BrowserWindow({
    width: 1600, height: 950, minWidth: 1100, minHeight: 680,
    title: 'Lumina', icon: path.join(ROOT, process.platform === 'win32' ? 'lumina.ico' : 'lumina-icon.png'), backgroundColor: '#111014',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true, nodeIntegration: false, sandbox: true,
      backgroundThrottling: false
    }
  });
  win.loadURL('lumina://app/Lumina.html');
  // links to websites open in the normal browser, never inside Lumina
  win.webContents.setWindowOpenHandler(({ url }) => { if (/^https?:/.test(url)) require('electron').shell.openExternal(url); return { action: 'deny' }; });
  win.webContents.on('will-navigate', e => e.preventDefault());
  win.webContents.on('did-finish-load', () => {
    if (pendingOpen) { win.webContents.send('open-path', pendingOpen); pendingOpen = null; }
    if (SELFTEST) runSelftest();
  });
  win.on('close', e => {
    if (!dirty || closing || SELFTEST) return;
    e.preventDefault();
    const choice = dialog.showMessageBoxSync(win, {
      type: 'question', buttons: ['Save', "Don't save", 'Cancel'], defaultId: 0, cancelId: 2,
      title: 'Lumina', message: 'Save changes to your project before closing?'
    });
    if (choice === 0) win.webContents.send('save-and-close');
    if (choice === 1) { closing = true; win.close(); }
  });
}

// ---------- file operations for the editor ----------
const LUMINA_FILTER = [{ name: 'Lumina project', extensions: ['lumina'] }];
ipcMain.handle('project:save', async (e, { json, filePath, saveAs }) => {
  let target = filePath;
  if (!target || saveAs) {
    const r = await dialog.showSaveDialog(win, { title: 'Save project', defaultPath: target || 'My edit.lumina', filters: LUMINA_FILTER });
    if (r.canceled || !r.filePath) return null;
    target = r.filePath;
  }
  fs.writeFileSync(target, json, 'utf8');
  return target;
});
ipcMain.handle('project:open', async (e, filePath) => {
  let target = filePath;
  if (!target) {
    const r = await dialog.showOpenDialog(win, { title: 'Open project', filters: LUMINA_FILTER, properties: ['openFile'] });
    if (r.canceled || !r.filePaths.length) return null;
    target = r.filePaths[0];
  }
  return { filePath: target, json: fs.readFileSync(target, 'utf8') };
});
ipcMain.handle('file:exists', (e, paths) => paths.map(p => { try { return fs.statSync(p).isFile(); } catch { return false; } }));
ipcMain.handle('file:locate', async (e, name) => {
  const r = await dialog.showOpenDialog(win, { title: `Find â€œ${name}â€`, properties: ['openFile'] });
  return r.canceled ? null : r.filePaths[0];
});
ipcMain.handle('export:save', async (e, { data, name, filePath }) => {
  let target = filePath;
  if (!target) {
    const ext = path.extname(name).slice(1);
    const subs = ext === 'srt' || ext === 'vtt';
    const r = await dialog.showSaveDialog(win, { title: subs ? 'Save captions' : 'Save video', defaultPath: path.join(app.getPath(subs ? 'documents' : 'videos'), name), filters: [{ name: ext.toUpperCase() + (subs ? ' subtitles' : ' video'), extensions: [ext] }] });
    if (r.canceled || !r.filePath) return null;
    target = r.filePath;
  }
  fs.writeFileSync(target, Buffer.from(data));
  return target;
});
// ---------- FFmpeg conversion: the recorded video becomes any of the export formats ----------
// inside the built app ffmpeg.exe is unpacked next to app.asar, because a program can't run from inside the archive
const FFMPEG = require('ffmpeg-static').replace('app.asar', 'app.asar.unpacked');
const FORMATS = {
  mp4:  { name: 'MP4 video', ext: ['mp4', 'm4v'], f: 'mp4', v: 'h264', a: 'aac', extra: ['-movflags', '+faststart'] },
  mov:  { name: 'QuickTime movie', ext: ['mov', 'qt'], f: 'mov', v: 'h264hq', a: 'aac', extra: ['-movflags', '+faststart'] },
  mkv:  { name: 'Matroska video', ext: ['mkv'], f: 'matroska', v: 'any', a: 'any' },
  avi:  { name: 'AVI video', ext: ['avi'], f: 'avi', v: 'xvid', a: 'mp3' },
  webm: { name: 'WebM video', ext: ['webm'], f: 'webm', v: 'vp9', a: 'opus' },
  flv:  { name: 'Flash video', ext: ['flv'], f: 'flv', v: 'h264', a: 'aac' },
  wmv:  { name: 'Windows Media video', ext: ['wmv'], f: 'asf', v: 'wmv2', a: 'wma' },
  mts:  { name: 'AVCHD video', ext: ['mts', 'm2ts'], f: 'mpegts', v: 'h264', a: 'ac3' },
  vob:  { name: 'DVD video', ext: ['vob'], f: 'dvd', v: 'dvd', a: 'dvd' },
  ogv:  { name: 'Ogg video', ext: ['ogv'], f: 'ogg', v: 'theora', a: 'vorbis' }
};
const EVEN = 'scale=trunc(iw/2)*2:trunc(ih/2)*2';
const VIDEO = {
  h264:   ['-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p', '-vf', EVEN],
  h264hq: ['-c:v', 'libx264', '-preset', 'slow', '-crf', '14', '-pix_fmt', 'yuv420p', '-vf', EVEN],
  any:    ['-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p', '-vf', EVEN],
  xvid:   ['-c:v', 'libxvid', '-q:v', '3', '-vtag', 'XVID'],
  vp9:    ['-c:v', 'libvpx-vp9', '-crf', '31', '-b:v', '0', '-row-mt', '1', '-deadline', 'good', '-cpu-used', '4'],
  wmv2:   ['-c:v', 'wmv2', '-q:v', '3'],
  theora: ['-c:v', 'libtheora', '-q:v', '8']
};
const AUDIO = {
  aac: ['-c:a', 'aac', '-b:a', '192k'], any: ['-c:a', 'aac', '-b:a', '192k'], mp3: ['-c:a', 'libmp3lame', '-b:a', '192k'],
  opus: ['-c:a', 'libopus', '-b:a', '160k'], wma: ['-c:a', 'wmav2', '-b:a', '192k'], ac3: ['-c:a', 'ac3', '-b:a', '384k'],
  vorbis: ['-c:a', 'libvorbis', '-q:a', '5']
};

// ffmpeg arguments for one export. Streams the target can hold as they are get copied: faster, and no quality lost.
function ffmpegArgs(fmt, src, input, output, { w, h, fps }) {
  const F = FORMATS[fmt], args = ['-hide_banner', '-y', '-i', input];
  // src is the recorder's mime type, e.g. "video/mp4;codecs=avc1.640028,mp4a.40.2" or "video/webm;codecs=vp9,opus"
  const mp4 = /mp4/.test(src);
  const srcV = mp4 ? 'h264' : /vp9/.test(src) ? 'vp9' : 'vp8';
  const srcA = /mp4a/.test(src) ? 'aac' : /opus/.test(src) || !mp4 ? 'opus' : 'unknown';
  const copyV = F.v === 'any' || (/^h264/.test(F.v) && srcV === 'h264') || (F.v === 'vp9' && srcV !== 'h264');
  const copyA = F.a === 'any' || F.a === srcA;
  if (F.v === 'dvd') {
    // DVDs hold 720x480 (NTSC) or 720x576 (PAL) only: pad to 16:9 or 4:3, then squeeze
    const pal = Math.round(fps) % 25 === 0, wide = w / h > 1.55, A = wide ? '16/9' : '4/3';
    args.push('-target', pal ? 'pal-dvd' : 'ntsc-dvd', '-aspect', wide ? '16:9' : '4:3',
      '-vf', `pad=trunc(max(iw\\,ih*${A})/2)*2:trunc(max(ih\\,iw/(${A}))/2)*2:(ow-iw)/2:(oh-ih)/2,scale=720:${pal ? 576 : 480},setsar=1`);
  } else {
    args.push(...(copyV ? ['-c:v', 'copy'] : [...VIDEO[F.v], '-r', String(fps)]));
    args.push(...(copyA ? ['-c:a', 'copy'] : AUDIO[F.a]));
  }
  if (F.f === 'mpegts' && /\.m2ts$/i.test(output)) args.push('-mpegts_m2ts_mode', '1');
  args.push(...(F.extra || []), '-f', F.f, '-progress', 'pipe:1', '-nostats', output);
  return args;
}

function runFFmpeg(args, duration, onProgress) {
  return new Promise((resolve, reject) => {
    const p = require('child_process').spawn(FFMPEG, args, { windowsHide: true });
    let err = '';
    p.stdout.on('data', d => {
      const m = /out_time_us=(\d+)/.exec(String(d));
      if (m && duration > 0) onProgress(Math.min(1, +m[1] / 1e6 / duration));
    });
    p.stderr.on('data', d => { err = (err + d).slice(-4000); });
    p.on('error', reject);
    p.on('close', code => code === 0 ? resolve() : reject(new Error(err.trim().split('\n').slice(-3).join('\n') || 'FFmpeg stopped with code ' + code)));
  });
}

ipcMain.handle('export:convert', async (e, { data, name, fmt, src, duration, w, h, fps, filePath }) => {
  const F = FORMATS[fmt]; if (!F) throw new Error('Unknown format ' + fmt);
  let target = filePath;
  if (!target) {
    const r = await dialog.showSaveDialog(win, {
      title: 'Save video', defaultPath: path.join(app.getPath('videos'), `${name}.${F.ext[0]}`),
      filters: [{ name: `${F.name} (${F.ext.map(x => '.' + x).join(', ')})`, extensions: F.ext }]
    });
    if (r.canceled || !r.filePath) return null;
    target = r.filePath;
  }
  if (!F.ext.includes(path.extname(target).slice(1).toLowerCase())) target += '.' + F.ext[0];
  const tmp = path.join(app.getPath('temp'), `lumina-export-${Date.now()}.${/mp4/.test(src) ? 'mp4' : 'webm'}`);
  fs.writeFileSync(tmp, Buffer.from(data));
  e.sender.send('export:progress', 0);
  try {
    await runFFmpeg(ffmpegArgs(fmt, src, tmp, target, { w, h, fps }), duration, f => e.sender.send('export:progress', f));
  } finally { fs.rmSync(tmp, { force: true }); }
  return target;
});

// ---------- smooth editing copies ----------
// Why a video is slow to jump around in: a video only stores a full picture now and then (a "keyframe"); every other
// frame is a change from the one before. Jumping to a frame means decoding from the keyframe before it. Movies and
// downloads often have a keyframe only every 5-10 s, and HEVC / AV1 / 4K / 60 fps make each frame heavier still, so
// on a slower PC every jump (scrubbing, a cut, a new clip starting) waits while seconds of video are decoded.
// An editing copy is H.264 with a keyframe every half second, at most 1080p: every jump is quick.
ipcMain.handle('media:probe', async (e, file) => {
  if (!file || !fs.existsSync(file)) return null;
  const s = (await runText(FFMPEG, ['-hide_banner', '-i', file])).err;
  const dm = /Duration:\s*(\d+):(\d+):([\d.]+)/.exec(s), vline = (/Stream #[^\n]*Video:[^\n]*/.exec(s) || [''])[0];
  if (!vline) return { video: false };
  const wh = /\b(\d{2,5})x(\d{2,5})\b/.exec(vline), fps = /([\d.]+) fps/.exec(vline) || /([\d.]+) tbr/.exec(vline);
  const out = { video: true, codec: (/Video:\s*(\w+)/.exec(vline) || [])[1] || '', w: wh ? +wh[1] : 0, h: wh ? +wh[2] : 0, fps: fps ? +fps[1] : 0,
    duration: dm ? +dm[1] * 3600 + +dm[2] * 60 + +dm[3] : 0, kbps: +((/bitrate:\s*(\d+) kb\/s/.exec(s) || [])[1] || 0),
    audio: (/Stream #[^\n]*Audio:\s*(\w+)/.exec(s) || [])[1] || '', size: fs.statSync(file).size };
  // keyframes in the first minute (only keyframes are decoded, so this is quick)
  const k = (await runText(FFMPEG, ['-hide_banner', '-skip_frame', 'nokey', '-t', '60', '-i', file, '-map', '0:v:0', '-vf', 'showinfo', '-f', 'null', '-'])).err;
  const kt = [...k.matchAll(/pts_time:\s*([\d.]+)/g)].map(m => +m[1]);
  const span = Math.min(60, out.duration || 60);
  out.keyGap = kt.length > 1 ? +((kt[kt.length - 1] - kt[0]) / (kt.length - 1)).toFixed(2) : +span.toFixed(2);
  return out;
});
const optJobs = {};
ipcMain.handle('media:cancel', (e, id) => { const j = optJobs[id]; if (j) { j.cancelled = true; killTree(j.proc); } return true; });
ipcMain.handle('media:optimize', async (e, { id, file, fps, w, h, duration, audio }) => {
  if (!file || !fs.existsSync(file)) throw new Error('The video file isn\'t there any more.');
  const { dir, name } = path.parse(file);
  // next to the original (so it travels with it); if that folder can't be written to, in Videos\Lumina edit copies
  let folder = dir; try { fs.accessSync(dir, fs.constants.W_OK); } catch { folder = path.join(app.getPath('videos'), 'Lumina edit copies'); fs.mkdirSync(folder, { recursive: true }); }
  const target = path.join(folder, `${name} (edit copy).mp4`);
  // made before and still newer than the original: use it as it is
  try { if (fs.statSync(target).mtimeMs > fs.statSync(file).mtimeMs && fs.statSync(target).size > 0) return target; } catch {}
  const part = target + '.part.mp4';
  // at most 1080 on the short side; even sizes for H.264
  const big = Math.min(w, h) > 1080, vf = big ? (w >= h ? 'scale=-2:1080' : 'scale=1080:-2') : 'scale=trunc(iw/2)*2:trunc(ih/2)*2';
  const args = ['-hide_banner', '-y', '-i', file, '-map', '0:v:0', '-map', '0:a:0?', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '18', '-pix_fmt', 'yuv420p',
    // a full picture every half second by the clock (phone and screen recordings have no steady frame rate), and the
    // frames keep their own timing (otherwise a variable-rate file gets padded out to 1000 frames a second)
    '-force_key_frames', 'expr:gte(t,n_forced*0.5)', '-fps_mode', 'vfr', '-vf', vf, ...(audio === 'aac' ? ['-c:a', 'copy'] : ['-c:a', 'aac', '-b:a', '192k']),
    '-movflags', '+faststart', '-progress', 'pipe:1', '-nostats', part];
  const J = optJobs[id] = { cancelled: false, proc: null };
  try {
    await new Promise((resolve, reject) => {
      const p = J.proc = require('child_process').spawn(FFMPEG, args, { windowsHide: true });
      let err = '';
      p.stdout.on('data', d => { const m = /out_time_us=(\d+)/.exec(String(d)); if (m && duration > 0 && !e.sender.isDestroyed()) e.sender.send('media:progress', { id, f: Math.min(1, +m[1] / 1e6 / duration) }); });
      p.stderr.on('data', d => { err = (err + d).slice(-4000); });
      p.on('error', reject);
      p.on('close', code => J.cancelled ? reject(new Error('Cancelled.')) : code === 0 ? resolve() : reject(new Error(err.trim().split('\n').slice(-3).join('\n') || 'FFmpeg stopped with code ' + code)));
    });
    fs.renameSync(part, target);
    return target;
  } catch (err) { fs.rmSync(part, { force: true }); throw err; }
  finally { delete optJobs[id]; }
});

// ---------- Converter: paste a link, get an MP3 or MP4 ----------
// yt-dlp (https://github.com/yt-dlp/yt-dlp, Unlicense) fetches the media; it is downloaded once, on the user's OK, into
// Lumina's own data folder and checked against the release's SHA-256 list. Lumina's own FFmpeg then makes the MP3 / MP4,
// so yt-dlp never needs ffprobe. Everything runs as separate processes, so the editor never freezes.
const TOOLS = path.join(app.getPath('userData'), 'tools');
const YTDLP_ASSET = process.platform === 'win32' ? 'yt-dlp.exe' : process.platform === 'darwin' ? 'yt-dlp_macos' : 'yt-dlp_linux';
const YTDLP = path.join(TOOLS, process.platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp');
const UTF8_ENV = { ...process.env, PYTHONIOENCODING: 'utf-8', PYTHONUTF8: '1' };
const runText = (exe, args, env = UTF8_ENV) => new Promise(res => {
  const p = require('child_process').spawn(exe, args, { windowsHide: true, env });
  let out = '', err = ''; p.stdout.on('data', d => out += d); p.stderr.on('data', d => err += d);
  p.on('error', () => res({ code: -1, out, err })); p.on('close', code => res({ code, out, err }));
});
async function ytVersion() { if (!fs.existsSync(YTDLP)) return null; const r = await runText(YTDLP, ['--version']); return r.code === 0 ? r.out.trim() : null; }
ipcMain.handle('conv:status', async () => ({ ready: fs.existsSync(YTDLP), version: await ytVersion(), folder: app.getPath('downloads') }));
let ytInstall = null;
ipcMain.handle('conv:install', e => {
  ytInstall ||= (async () => {
    const base = 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/';
    const sums = await fetch(base + 'SHA2-256SUMS');
    if (!sums.ok) throw new Error(`Couldn't reach GitHub (${sums.status}).`);
    const line = (await sums.text()).split(/\r?\n/).find(l => l.trim().endsWith(' ' + YTDLP_ASSET));
    if (!line) throw new Error('The yt-dlp release has no checksum for ' + YTDLP_ASSET);
    const want = line.trim().split(/\s+/)[0].toLowerCase();
    const res = await fetch(base + YTDLP_ASSET);
    if (!res.ok) throw new Error(`Download failed (${res.status}).`);
    const total = +res.headers.get('content-length') || 0, hash = require('crypto').createHash('sha256');
    fs.mkdirSync(TOOLS, { recursive: true });
    const part = YTDLP + '.part', out = fs.createWriteStream(part); let got = 0;
    for await (const chunk of res.body) { out.write(chunk); hash.update(chunk); got += chunk.length; if (!e.sender.isDestroyed()) e.sender.send('conv:progress', { stage: 'install', got, total }); }
    await new Promise((ok, bad) => out.end(err => err ? bad(err) : ok()));
    if (hash.digest('hex') !== want) { fs.rmSync(part, { force: true }); throw new Error("The downloaded file didn't match yt-dlp's official checksum, so it was thrown away."); }
    if (process.platform !== 'win32') fs.chmodSync(part, 0o755);
    fs.renameSync(part, YTDLP);
    return { ready: true, version: await ytVersion() };
  })().finally(() => { ytInstall = null; });
  return ytInstall;
});
// yt-dlp's errors, in plain words
function convError(text) {
  const t = String(text), m = /ERROR:\s*(.*)/.exec(t), raw = (m ? m[1] : t.trim().split('\n').pop() || '').trim();
  const say = [
    [/DRM protected|\bDRM\b/i, 'That one is copy-protected (DRM) by the site, so it can\'t be downloaded. Many SoundCloud tracks from labels, and paid streaming services, are protected like this.'],
    [/private video|members-only|This video is private/i, 'That video is private, so it can\'t be downloaded.'],
    [/could not copy .* cookie database|cookie database is locked|Permission denied.*Cookies/i, 'Couldn\'t read your browser\'s sign-ins while it\'s open. Close that browser completely, then try again (or pick Firefox).'],
    [/Failed to decrypt|DPAPI|app.bound|v20 cookies|could not find .* cookies database|no cookies/i, 'That browser keeps its sign-ins locked, so the Converter can\'t use them. Sign in to the site in Firefox and pick Firefox under "Sign in with".'],
    [/sign in to confirm your age|age-restricted|inappropriate for some users/i, 'That video is age-restricted. Sign in to the site in your browser, then pick that browser under "Sign in with" below.'],
    [/sign in to confirm you.re not a bot|login required|log in|requires authentication|rate-limit reached|use --cookies|cookies/i, 'That site wants you signed in. Sign in to it in your browser, then pick that browser under "Sign in with" below.'],
    [/is live|live stream.*in progress/i, 'That\'s live right now. Convert it once the stream ends (its saved video).'],
    [/Unsupported URL/i, 'That link isn\'t one yt-dlp knows how to download.'],
    [/Video unavailable|not available|has been removed|404/i, 'That video isn\'t available (removed, blocked in your country, or the link is wrong).'],
    [/live event will begin|is not live|premieres in/i, 'That stream hasn\'t started yet.'],
    [/getaddrinfo|Name or service not known|Failed to resolve|No address associated|network is unreachable|timed out|Connection reset|Read timed out|ECONN/i, 'Couldn\'t connect. Check your internet and try again.'],
    [/Unable to download webpage|Unable to download API page|Unable to extract/i, 'Couldn\'t open that link. Check the address, then try "Update yt-dlp" if it still fails.'],
    [/Requested format is not available/i, 'That link has no MP4/MP3-able stream.'],
    [/HTTP Error 403|Forbidden/i, 'The site refused the download. Try "Update yt-dlp", then try again.'],
  ].find(([re]) => re.test(t));
  // otherwise yt-dlp's own words, minus its "[site] 12345:" prefix
  return say ? say[1] : raw.replace(/^\[[^\]]+\]\s*/, '').replace(/^[\w-]{4,}:\s+/, '').slice(0, 300) || 'yt-dlp stopped without saying why.';
}
const convJobs = {};
let convCleaned = false;   // the self-test starts its output folder empty
function killTree(p) {
  if (!p || p.exitCode != null) return;
  if (process.platform === 'win32') require('child_process').spawn('taskkill', ['/pid', String(p.pid), '/T', '/F'], { windowsHide: true });
  else p.kill('SIGKILL');
}
ipcMain.handle('conv:cancel', (e, id) => { const j = convJobs[id]; if (j) { j.cancelled = true; killTree(j.proc); } return true; });
ipcMain.handle('conv:folder', async (e, current) => {
  const r = await dialog.showOpenDialog(win, { title: 'Save converted files to', defaultPath: current || app.getPath('downloads'), properties: ['openDirectory', 'createDirectory'] });
  return r.canceled ? null : r.filePaths[0];
});
// a pasted address, checked; "youtube.com/…" without https:// is fine too
function convURL(url) {
  let s = String(url || '').trim();
  if (!/^[a-z][\w+.-]*:/i.test(s) && /^[\w-]+(\.[\w-]+)+(\/|$|\?)/.test(s)) s = 'https://' + s;
  let u; try { u = new URL(s); } catch { throw new Error("That doesn't look like a link. Paste the whole address, starting with https://"); }
  if (!(u.protocol === 'https:' || u.protocol === 'http:' || (SELFTEST && u.protocol === 'file:'))) throw new Error('Only web links (https://…) can be converted.');
  if (!fs.existsSync(YTDLP)) throw new Error('yt-dlp isn\'t installed yet.');
  return u.href;
}
// settings every yt-dlp run shares. YouTube needs a JavaScript engine to unlock its video formats: Lumina's own
// Electron doubles as Node.js (ELECTRON_RUN_AS_NODE), so nothing else has to be installed.
const BROWSERS = ['firefox', 'chrome', 'edge', 'brave', 'opera', 'vivaldi', 'chromium'];
const YT_ENV = { ...UTF8_ENV, ELECTRON_RUN_AS_NODE: '1' };
const ytBase = cookies => ['--no-colors', '--js-runtimes', 'node:' + process.execPath, '--cache-dir', path.join(TOOLS, 'cache'),
  '--socket-timeout', '30', '--retries', '3', '--fragment-retries', '5',
  ...(BROWSERS.includes(cookies) ? ['--cookies-from-browser', cookies] : []), ...(SELFTEST ? ['--enable-file-urls'] : [])];
// what a link is before downloading: one video, a playlist (listed, so each entry becomes its own job), or a live stream
ipcMain.handle('conv:resolve', async (e, { url, playlist, cookies }) => {
  const href = convURL(url);
  const r = await runText(YTDLP, [...ytBase(cookies), '--flat-playlist', '-J', playlist ? '--yes-playlist' : '--no-playlist', '--', href], YT_ENV);
  if (r.code !== 0) throw new Error(convError(r.err));
  let d; try { d = JSON.parse(r.out); } catch { throw new Error('yt-dlp gave an answer Lumina couldn\'t read. Try "Update yt-dlp".'); }
  if (d._type === 'playlist' || Array.isArray(d.entries)) {
    // entries that are links of their own (YouTube, SoundCloud sets…) keep them; videos embedded in one page (no link of
    // their own) are fetched as "item N of this page"
    const entries = (d.entries || []).map((x, i) => {
      if (!x) return null;
      const own = x._type === 'url' || x._type === 'url_transparent' ? (x.url && /^[a-z]+:/i.test(x.url) ? x.url : x.ie_key === 'Youtube' && x.id ? 'https://www.youtube.com/watch?v=' + x.id : null) : null;
      return own ? { url: own, title: x.title || '' } : { url: href, item: i + 1, title: x.title || '' };
    }).filter(x => x && !/^\[(Private|Deleted) video\]$/.test(x.title));
    return { type: 'playlist', title: d.title || 'Playlist', entries };
  }
  return { type: 'video', url: href, title: d.title || '', live: d.is_live === true || d.live_status === 'is_live', upcoming: d.live_status === 'is_upcoming', duration: d.duration || 0 };
});
ipcMain.handle('conv:run', async (e, { id, url, item, fmt, normalize, folder, cookies }) => {
  const href = convURL(url);
  if (fmt !== 'mp3' && fmt !== 'mp4') throw new Error('Pick MP3 or MP4.');
  if (SELFTEST && folder && !convCleaned) { convCleaned = true; fs.rmSync(folder, { recursive: true, force: true }); fs.mkdirSync(folder, { recursive: true }); }
  const dest = folder && fs.existsSync(folder) ? folder : app.getPath('downloads');
  const work = path.join(app.getPath('temp'), `lumina-conv-${Date.now()}-${id}`); fs.mkdirSync(work, { recursive: true });
  const J = convJobs[id] = { cancelled: false, proc: null };
  const send = p => { if (!e.sender.isDestroyed()) e.sender.send('conv:progress', { id, ...p }); };
  try {
    // 1. yt-dlp downloads (MP4: H.264 + AAC when the site has them, so the last step can just copy)
    // (streams in pieces, like Twitch, Kick and .m3u8 / .mpd links, report pieces instead of bytes)
    const args = [...ytBase(cookies), ...(item > 0 ? ['--yes-playlist', '--playlist-items', String(item | 0)] : ['--no-playlist']), '--newline', '--progress', '--no-mtime', '--fixup', 'never', '--no-part',
      // a plain file name: yt-dlp's console output on Windows drops characters it can't show (a title with "///" is saved
      // with look-alike slashes "⧸", but printed without them), so the printed path can't be trusted; the title comes
      // as JSON (\u escapes survive) and the final name is made from it below
      '--ffmpeg-location', FFMPEG, '-P', work, '-o', 'download.%(ext)s',
      '--progress-template', 'download:LUMINADL|%(progress.downloaded_bytes)s|%(progress.total_bytes)s|%(progress.total_bytes_estimate)s|%(progress.eta)s|%(info.format_id)s|%(progress.fragment_index)s|%(progress.fragment_count)s',
      '--print', 'before_dl:LUMINATITLE|%(title)j', '--print', 'after_move:LUMINAFILE|%(filepath)s'];
    if (fmt === 'mp3') args.push('-f', 'bestaudio/best');
    else args.push('-f', 'bv*[vcodec^=avc1]+ba[acodec^=mp4a]/b[vcodec^=avc1][acodec^=mp4a]/bv*+ba/b', '--merge-output-format', 'mkv');
    args.push('--', href);
    send({ stage: 'start' });
    let file = null, title = '', err = '', parts = 0, lastFmt = null;
    const code = await new Promise((resolve, reject) => {
      const p = J.proc = require('child_process').spawn(YTDLP, args, { windowsHide: true, env: YT_ENV });
      p.stdout.setEncoding('utf8');   // a character split between two chunks stays whole
      let buf = '';
      p.stdout.on('data', d => {
        buf += d; const lines = buf.split(/\r?\n/); buf = lines.pop();
        for (const l of lines) {
          if (l.startsWith('LUMINADL|')) {
            const [, got, tot, est, eta, f, fi, fc] = l.split('|');
            if (f !== lastFmt) { lastFmt = f; parts++; }
            const total = +tot || +est || 0;
            send({ stage: 'download', got: +got || 0, total, eta: +eta || null, part: parts, frag: +fi || 0, frags: +fc || 0 });
          } else if (l.startsWith('LUMINATITLE|')) { try { title = String(JSON.parse(l.slice(12))); } catch { title = l.slice(12); } send({ stage: 'title', title }); }
          else if (l.startsWith('LUMINAFILE|')) file = l.slice(11).trim();
        }
      });
      p.stderr.on('data', d => { err = (err + d).slice(-6000); if (/\[Merger\]/.test(String(d))) send({ stage: 'merge' }); });
      p.on('error', reject); p.on('close', resolve);
    });
    if (J.cancelled) throw new Error('Cancelled.');
    // the downloaded file is the one "download.*" in the work folder (the printed path is only a hint)
    if (!file || !fs.existsSync(file)) { const f = fs.readdirSync(work).find(n => /^download\./.test(n) && !/\.(part|ytdl|temp)$/i.test(n)); file = f ? path.join(work, f) : null; }
    if (code !== 0 || !file) throw new Error(convError(err || (code === 0 ? "yt-dlp finished but didn't save a file. The video may be blocked or unavailable where you are; try \"Update yt-dlp\"." : 'yt-dlp stopped with code ' + code)));
    // 2. Lumina's FFmpeg makes the final file
    const info = await runText(FFMPEG, ['-hide_banner', '-i', file]);
    const dm = /Duration:\s*(\d+):(\d+):([\d.]+)/.exec(info.err), duration = dm ? +dm[1] * 3600 + +dm[2] * 60 + +dm[3] : 0;
    const vcodec = (/Stream #.*?Video:\s*(\w+)/.exec(info.err) || [])[1] || '', acodec = (/Stream #.*?Audio:\s*(\w+)/.exec(info.err) || [])[1] || '';
    if (fmt === 'mp3' && !acodec) throw new Error('That link has no sound to turn into an MP3.');
    if (fmt === 'mp4' && !vcodec) throw new Error('That link has no video. Pick MP3 instead.');
    const stem = (title || path.parse(file).name).replace(/[\\/:*?"<>|\x00-\x1f]/g, '').replace(/\s+/g, ' ').trim().slice(0, 120) || 'Converted';
    let target = path.join(dest, `${stem}.${fmt}`); for (let n = 2; fs.existsSync(target); n++) target = path.join(dest, `${stem} (${n}).${fmt}`);
    const tmpOut = path.join(work, 'out.' + fmt);
    const ff = ['-y', '-hide_banner', '-nostats', '-progress', 'pipe:1', '-i', file];
    if (fmt === 'mp3') ff.push('-vn', '-map', '0:a:0', ...(normalize ? ['-af', 'loudnorm=I=-14:TP=-1.5:LRA=11'] : []), '-c:a', 'libmp3lame', '-q:a', '0', '-ar', '44100', '-map_metadata', '-1', tmpOut);
    else ff.push('-map', '0:v:0', '-map', '0:a:0?',
      ...(vcodec === 'h264' ? ['-c:v', 'copy'] : ['-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p', '-vf', EVEN]),
      ...(acodec === 'aac' ? ['-c:a', 'copy'] : ['-c:a', 'aac', '-b:a', '192k']), '-movflags', '+faststart', '-map_metadata', '-1', tmpOut);
    send({ stage: 'convert', f: 0, copy: fmt === 'mp4' && vcodec === 'h264' && acodec === 'aac' });
    await new Promise((resolve, reject) => {
      const p = J.proc = require('child_process').spawn(FFMPEG, ff, { windowsHide: true });
      let ferr = '';
      p.stdout.on('data', d => { const m = /out_time_us=(\d+)/.exec(String(d)); if (m && duration > 0) send({ stage: 'convert', f: Math.min(1, +m[1] / 1e6 / duration) }); });
      p.stderr.on('data', d => { ferr = (ferr + d).slice(-3000); });
      p.on('error', reject);
      p.on('close', c => J.cancelled ? reject(new Error('Cancelled.')) : c === 0 ? resolve() : reject(new Error('Converting failed: ' + (ferr.trim().split('\n').pop() || 'code ' + c))));
    });
    fs.copyFileSync(tmpOut, target);
    return { path: target, name: path.basename(target), title: title || stem, duration };
  } finally {
    delete convJobs[id];
    // a cancelled process can hold its files for a moment, so retry the clean-up
    fs.rm(work, { recursive: true, force: true, maxRetries: 10, retryDelay: 300 }, () => { });
  }
});

// ---------- clipboard (CapCut phase C12) ----------
// Reading: copied files (as paths), a copied picture (saved as a PNG so the project can find it again) and text.
// Writing: Lumina puts a marker text on the clipboard when it copies clips or keyframes, so a later paste can tell
// whether the newest thing on the clipboard is Lumina's own copy or something from another app.
const PASTED = () => SELFTEST && process.env.LUMINA_TESTDIR ? path.join(process.env.LUMINA_TESTDIR, 'pasted') : path.join(app.getPath('userData'), 'Pasted');
ipcMain.handle('clip:read', async () => {
  const { clipboard } = require('electron'), { fileURLToPath } = require('url');
  const out = { files: [], image: null, text: '' };
  let items = [];
  try { items = await clipboard.read(); } catch { }
  for (const it of items) {
    if (it.types.includes('text/uri-list')) {
      const list = await (await it.getType('text/uri-list')).text();
      for (const u of list.split(/\r?\n/).map(s => s.trim()).filter(s => s && !s.startsWith('#'))) {
        try { const p = fileURLToPath(u); if (fs.statSync(p).isFile()) out.files.push(p); } catch { }
      }
    }
    if (!out.files.length && !out.image && it.types.includes('image/png')) {
      const buf = Buffer.from(await (await it.getType('image/png')).arrayBuffer());
      const dir = PASTED(); fs.mkdirSync(dir, { recursive: true });
      const stamp = new Date().toISOString().replace(/[:T]/g, '-').replace(/\..*/, '');
      let p = path.join(dir, `Pasted ${stamp}.png`); for (let n = 2; fs.existsSync(p); n++) p = path.join(dir, `Pasted ${stamp} (${n}).png`);
      fs.writeFileSync(p, buf); out.image = p;
    }
  }
  try { out.text = await clipboard.readText(); } catch { }
  return out;
});
ipcMain.handle('clip:write', async (e, { text, png, uris }) => {
  const { clipboard, ClipboardItem } = require('electron');
  const d = {};
  if (text != null) d['text/plain'] = text;
  if (png) d['image/png'] = new Blob([Buffer.from(png)], { type: 'image/png' });
  if (uris) d['text/uri-list'] = uris;
  await clipboard.write([new ClipboardItem(d)]);
  return true;
});
ipcMain.handle('show-in-folder',(e, p) => require('electron').shell.showItemInFolder(p));
ipcMain.on('dirty', (e, v) => { dirty = !!v; });
ipcMain.on('close-now', () => { closing = true; win && win.close(); });
ipcMain.on('title', (e, t) => { if (win) win.setTitle(t); });
// the version and Windows version, for the About box and Help › Send feedback
ipcMain.on('app:info', e => { e.returnValue = { version: app.getVersion(), os: `${process.platform === 'win32' ? 'Windows' : process.platform === 'darwin' ? 'macOS' : 'Linux'} ${require('os').release()}` }; });

// ---------- self test (npm run selftest): drives the editor and writes results to selftest.json ----------
async function runSelftest() {
  // test files live outside the app; the built app is pointed at them with LUMINA_TESTDIR
  const dir = process.env.LUMINA_TESTDIR || path.join(ROOT, '.claude');
  const out = path.join(dir, 'selftest.json');
  try {
    // no welcome screen or tips in the test window (not saved, so the user's own settings stay as they are)
    await win.webContents.executeJavaScript("typeof introOff === 'function' && introOff(); 0", true);
    await win.webContents.executeJavaScript(fs.readFileSync(path.join(dir, 'testkit.js'), 'utf8') + '\n;0', true);
    const result = await win.webContents.executeJavaScript(fs.readFileSync(path.join(dir, 'selftest.js'), 'utf8'), true);
    // the screenshot can fail when the window isn't on screen; keep the results either way
    try { fs.writeFileSync(path.join(dir, 'selftest.png'), (await win.webContents.capturePage()).toPNG()); }
    catch (err) { result.screenshot = String(err.message || err); }
    fs.writeFileSync(out, JSON.stringify(result, null, 2));
  } catch (err) {
    fs.writeFileSync(out, JSON.stringify({ error: String(err && err.stack || err) }, null, 2));
  }
  app.exit(0);
}

// ---------- app lifecycle ----------
if (!SELFTEST && !app.requestSingleInstanceLock()) app.quit();
else {
  app.on('second-instance', (e, argv) => {
    const p = projectArg(argv);
    if (win) { if (win.isMinimized()) win.restore(); win.focus(); if (p) win.webContents.send('open-path', p); }
  });
  app.whenReady().then(() => {
    nativeTheme.themeSource = 'dark';
    Menu.setApplicationMenu(null);
    registerProtocol();
    pendingOpen = projectArg(process.argv) || null;
    createWindow();
  });
  app.on('window-all-closed', () => app.quit());
}
