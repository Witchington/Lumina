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
  // links to websites open in the normal browser, never inside Lumina. The one window Lumina opens itself is a floating
  // panel (Window › Float panel, or a panel's tab dragged out): a blank page of the same app the editor moves the panel into
  win.webContents.setWindowOpenHandler(({ url, frameName }) => {
    if (url === 'about:blank' && /^lumina-panel-[a-z]+$/.test(frameName)) return { action: 'allow', overrideBrowserWindowOptions: {
      minWidth: 240, minHeight: 140, autoHideMenuBar: true, backgroundColor: '#111014', title: 'Lumina',
      // keeps drawing behind other windows, like the main window (the Composition viewer's frames come from this one)
      webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true, backgroundThrottling: false },
      icon: path.join(ROOT, process.platform === 'win32' ? 'lumina.ico' : 'lumina-icon.png') } };
    if (/^https?:/.test(url)) require('electron').shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('did-create-window', cw => {
    cw.setMenu(null);
    cw.webContents.on('will-navigate', e => e.preventDefault());
    cw.webContents.setWindowOpenHandler(({ url }) => { if (/^https?:/.test(url)) require('electron').shell.openExternal(url); return { action: 'deny' }; });
  });
  // the floating panels belong to this window: they go when it goes
  win.on('closed', () => { for (const w of BrowserWindow.getAllWindows()) if (!w.isDestroyed()) w.destroy(); });
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

// ---------- Save as image (PhotoCraft Round 1): one frame as any image format ----------
// The editor sends the frame as a PNG (or, for PSD / PDF / EPS / AI / SVG, the finished file it made itself).
// FFmpeg turns the PNG into the other formats; HEIC is FFmpeg's HEVC picture in a HEIF file Lumina writes (heifFile).
// HD colours (BT.709 primaries and matrix, sRGB curve, video range): written into AVIF and HEIC so viewers read them right
const TAG709 = ['-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'iec61966-2-1', '-color_range', 'tv'];
const IMAGE = {
  png:  { name: 'PNG image', ext: ['png'] },
  jpg:  { name: 'JPEG image', ext: ['jpg', 'jpeg'], args: q => ['-c:v', 'mjpeg', '-q:v', String(Math.round(Math.min(31, Math.max(2, 31 - q * .29)))), '-pix_fmt', 'yuvj444p', '-f', 'image2'] },
  webp: { name: 'WebP image', ext: ['webp'], args: (q, a) => ['-c:v', 'libwebp', ...(q >= 100 ? ['-lossless', '1'] : ['-quality', String(q)]), '-pix_fmt', a ? 'yuva420p' : 'yuv420p', '-f', 'webp'] },
  avif: { name: 'AVIF image', ext: ['avif'], args: q => ['-c:v', 'libaom-av1', '-still-picture', '1', '-crf', String(Math.round(Math.min(63, Math.max(0, (100 - q) * .6 + 8)))), '-b:v', '0', '-cpu-used', '6', '-pix_fmt', 'yuv444p', '-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2:out_color_matrix=bt709:out_range=tv', ...TAG709, '-frames:v', '1', '-f', 'avif'] },
  gif:  { name: 'GIF image', ext: ['gif'], args: (q, a) => ['-vf', `split[s0][s1];[s0]palettegen=max_colors=256:reserve_transparent=${a ? 1 : 0}[p];[s1][p]paletteuse=dither=sierra2_4a`, '-f', 'gif'] },
  tiff: { name: 'TIFF image', ext: ['tif', 'tiff'], args: (q, a) => ['-c:v', 'tiff', '-compression_algo', 'deflate', '-pix_fmt', a ? 'rgba' : 'rgb24', '-f', 'image2'] },
  bmp:  { name: 'Bitmap image', ext: ['bmp'], args: (q, a) => ['-c:v', 'bmp', '-pix_fmt', a ? 'bgra' : 'bgr24', '-f', 'image2'] },
  ico:  { name: 'Windows icon', ext: ['ico'], args: () => ['-vf', 'scale=256:256:force_original_aspect_ratio=decrease', '-c:v', 'png', '-pix_fmt', 'rgba', '-f', 'ico'] },
  tga:  { name: 'Targa image', ext: ['tga'], args: (q, a) => ['-c:v', 'targa', '-pix_fmt', a ? 'bgra' : 'bgr24', '-f', 'image2'] },
  jp2:  { name: 'JPEG 2000 image', ext: ['jp2'], args: (q, a) => ['-c:v', 'libopenjpeg', '-pix_fmt', a ? 'rgba' : 'rgb24', ...(q >= 100 ? [] : ['-compression_level', String(Math.round((100 - q) * 2 + 5))]), '-f', 'image2'] },
  heic: { name: 'HEIC image', ext: ['heic', 'heif'] },
  psd:  { name: 'Photoshop document', ext: ['psd'] },
  pdf:  { name: 'PDF document', ext: ['pdf'] },
  ai:   { name: 'Illustrator file (PDF-compatible)', ext: ['ai'] },
  eps:  { name: 'EPS file', ext: ['eps'] },
  svg:  { name: 'SVG image', ext: ['svg'] }
};
ipcMain.handle('image:save', async (e, { data, fmt, quality = 90, alpha = false, name, filePath, ready }) => {
  const F = IMAGE[fmt]; if (!F) throw new Error('Unknown image format ' + fmt);
  let target = filePath;
  if (!target) {
    const r = await dialog.showSaveDialog(win, { title: 'Save image', defaultPath: path.join(app.getPath('pictures'), `${name}.${F.ext[0]}`),
      filters: [{ name: `${F.name} (${F.ext.map(x => '.' + x).join(', ')})`, extensions: F.ext }] });
    if (r.canceled || !r.filePath) return null;
    target = r.filePath;
  }
  if (!F.ext.includes(path.extname(target).slice(1).toLowerCase())) target += '.' + F.ext[0];
  // already the finished file (PNG straight from the canvas, or one Lumina wrote itself)
  if (ready || fmt === 'png') { fs.writeFileSync(target, Buffer.from(data)); return target; }
  const tmp = path.join(app.getPath('temp'), `lumina-image-${Date.now()}`), png = tmp + '.png';
  fs.writeFileSync(png, Buffer.from(data));
  try {
    if (fmt === 'heic') {
      // HEVC picture (FFmpeg's x265), then the HEIF file around it
      const hevc = tmp + '.hevc', crf = String(Math.round(Math.min(51, Math.max(0, (100 - quality) * .4 + 12))));
      await runFFmpeg(['-hide_banner', '-y', '-i', png, '-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2:out_color_matrix=bt709:out_range=tv,format=yuv420p', '-c:v', 'libx265', '-crf', crf, '-preset', 'medium', ...TAG709,
        '-x265-params', 'log-level=error:keyint=1:repeat-headers=1:colorprim=bt709:transfer=iec61966-2-1:colormatrix=bt709:range=limited', '-frames:v', '1', '-f', 'hevc', hevc], 0, () => {});
      fs.writeFileSync(target, heifFile(fs.readFileSync(hevc)));
      fs.rmSync(hevc, { force: true });
    } else {
      const out = tmp + '.' + F.ext[0];
      await runFFmpeg(['-hide_banner', '-y', '-i', png, ...F.args(quality, alpha), '-frames:v', '1', out], 0, () => {});
      fs.copyFileSync(out, target); fs.rmSync(out, { force: true });
    }
  } finally { fs.rmSync(png, { force: true }); }
  return target;
});
// ---------- animated images and image sequences (PhotoCraft Round P2) ----------
// The editor renders each frame of a time range as a PNG into a temp folder (anim:frame); anim:finish then has FFmpeg make
// one moving picture (GIF, WebP, APNG) or a folder of numbered pictures from them.
const animJobs = {};
const ANIM = {
  gif:  { name: 'Animated GIF', ext: 'gif', args: (q, a, loop, vf) => ['-vf', `${vf}split[s0][s1];[s0]palettegen=stats_mode=diff:reserve_transparent=${a ? 1 : 0}[p];[s1][p]paletteuse=dither=bayer:bayer_scale=5:diff_mode=rectangle`, '-loop', loop ? '0' : '-1', '-f', 'gif'] },
  webp: { name: 'Animated WebP', ext: 'webp', args: (q, a, loop, vf) => [...(vf ? ['-vf', vf.slice(0, -1)] : []), '-c:v', 'libwebp_anim', ...(q >= 100 ? ['-lossless', '1'] : ['-quality', String(q)]), '-pix_fmt', a ? 'yuva420p' : 'yuv420p', '-loop', loop ? '0' : '1', '-f', 'webp'] },
  apng: { name: 'Animated PNG', ext: 'png', args: (q, a, loop, vf) => [...(vf ? ['-vf', vf.slice(0, -1)] : []), '-c:v', 'apng', '-pix_fmt', a ? 'rgba' : 'rgb24', '-plays', loop ? '0' : '1', '-f', 'apng'] }
};
const SEQ = { png: 'png', jpg: 'jpg', tiff: 'tif', webp: 'webp', tga: 'tga', bmp: 'bmp' };
ipcMain.handle('anim:begin', () => {
  const id = String(Date.now()), dir = path.join(app.getPath('temp'), 'lumina-anim-' + id);
  fs.mkdirSync(dir, { recursive: true }); animJobs[id] = { dir, n: 0 }; return id;
});
ipcMain.handle('anim:frame', (e, { id, data }) => {
  const J = animJobs[id]; if (!J) throw new Error('No animation is being made.');
  fs.writeFileSync(path.join(J.dir, String(J.n++).padStart(6, '0') + '.png'), Buffer.from(data)); return J.n;
});
ipcMain.handle('anim:cancel', (e, id) => { const J = animJobs[id]; if (J) { if (J.proc) killTree(J.proc); fs.rmSync(J.dir, { recursive: true, force: true }); delete animJobs[id]; } return true; });
ipcMain.handle('anim:finish', async (e, { id, fmt, fps, scale = 1, quality = 90, alpha = false, loop = true, name, filePath, folder }) => {
  const J = animJobs[id]; if (!J || !J.n) throw new Error('No frames were made.');
  const vf = scale !== 1 ? `scale=trunc(iw*${scale}/2)*2:trunc(ih*${scale}/2)*2,` : '';
  const input = ['-hide_banner', '-y', '-framerate', String(fps), '-i', path.join(J.dir, '%06d.png')];
  const run = args => new Promise((resolve, reject) => {
    const p = J.proc = require('child_process').spawn(FFMPEG, [...input, ...args], { windowsHide: true }); let err = '';
    p.stdout.on('data', d => { const m = /frame=(\d+)/.exec(String(d)); if (m && !e.sender.isDestroyed()) e.sender.send('anim:progress', Math.min(1, +m[1] / J.n)); });
    p.stderr.on('data', d => { err = (err + d).slice(-4000); });
    p.on('error', reject); p.on('close', code => code === 0 ? resolve() : reject(new Error(err.trim().split('\n').slice(-2).join('\n') || 'FFmpeg stopped with code ' + code)));
  });
  try {
    if (ANIM[fmt]) {
      const A = ANIM[fmt]; let target = filePath;
      if (!target) {
        const r = await dialog.showSaveDialog(win, { title: 'Save ' + A.name, defaultPath: path.join(app.getPath('pictures'), `${name}.${A.ext}`), filters: [{ name: `${A.name} (.${A.ext})`, extensions: [A.ext] }] });
        if (r.canceled || !r.filePath) return null; target = r.filePath;
      }
      if (path.extname(target).slice(1).toLowerCase() !== A.ext) target += '.' + A.ext;
      const tmp = path.join(J.dir, 'out.' + A.ext);
      await run([...A.args(quality, alpha, loop, vf), '-progress', 'pipe:1', '-nostats', tmp]);
      fs.copyFileSync(tmp, target);
      return target;
    }
    const kind = fmt.replace(/^seq-/, ''), ext = SEQ[kind]; if (!ext) throw new Error('Unknown format ' + fmt);
    let dest = folder;
    if (!dest) {
      const r = await dialog.showOpenDialog(win, { title: 'Save the pictures into this folder', defaultPath: app.getPath('pictures'), properties: ['openDirectory', 'createDirectory'] });
      if (r.canceled || !r.filePaths[0]) return null; dest = r.filePaths[0];
    }
    fs.mkdirSync(dest, { recursive: true });
    // one picture per frame: <name>_0001.<ext>, <name>_0002.<ext>…
    const stem = String(name).replace(/[\\/:*?"<>|]/g, '').trim() || 'Lumina';
    const per = IMAGE[kind]?.args ? IMAGE[kind].args(quality, alpha).filter((x, i, a) => x !== '-f' && a[i - 1] !== '-f') : ['-c:v', 'png', '-pix_fmt', alpha ? 'rgba' : 'rgb24'];
    const vfi = per.indexOf('-vf'); if (vf) { if (vfi >= 0) per[vfi + 1] = vf + per[vfi + 1]; else per.unshift('-vf', vf.slice(0, -1)); }
    await run([...per, '-start_number', '1', '-progress', 'pipe:1', '-nostats', '-f', 'image2', path.join(dest, `${stem}_%04d.${ext}`)]);
    return dest;
  } finally { fs.rmSync(J.dir, { recursive: true, force: true }); delete animJobs[id]; }
});

// ---------- opening every image format (PhotoCraft Round P2) ----------
// Chromium shows PNG, JPEG, GIF, WebP, BMP, AVIF, ICO and SVG itself. Anything else is turned into a PNG once (kept in
// Lumina's image cache, keyed by the file's path, size and date): first by FFmpeg (TIFF, PSD, TGA, JPEG 2000, EXR, HDR,
// DDS, QOI…), then on Windows by Windows' own image decoders (HEIC, and camera RAW once the Raw Image Extension is installed).
const IMG_CACHE = path.join(app.getPath('userData'), 'image-cache');
const RAW_EXT = /\.(dng|nef|nrw|cr2|cr3|crw|arw|srf|sr2|orf|rw2|raf|srw|pef|raw|rwl|3fr|erf|kdc|mrw|mef|mos|iiq|x3f)$/i;
// Windows' decoders, through PowerShell and WinRT: the picture (EXIF turn applied, colours made sRGB) as BGRA bytes
const WIC_SCRIPT = `$ErrorActionPreference='Stop'
Add-Type -AssemblyName System.Runtime.WindowsRuntime
$null=[Windows.Storage.StorageFile,Windows.Storage,ContentType=WindowsRuntime]
$null=[Windows.Graphics.Imaging.BitmapDecoder,Windows.Graphics.Imaging,ContentType=WindowsRuntime]
$m=[System.WindowsRuntimeSystemExtensions].GetMethods()|?{$_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation\`1'}|select -First 1
function A($o,[Type]$t){$x=$m.MakeGenericMethod($t).Invoke($null,@($o));$x.Wait(-1)|Out-Null;$x.Result}
$f=A ([Windows.Storage.StorageFile]::GetFileFromPathAsync($env:LUMINA_IN)) ([Windows.Storage.StorageFile])
$s=A ($f.OpenAsync([Windows.Storage.FileAccessMode]::Read)) ([Windows.Storage.Streams.IRandomAccessStream])
$d=A ([Windows.Graphics.Imaging.BitmapDecoder]::CreateAsync($s)) ([Windows.Graphics.Imaging.BitmapDecoder])
$p=A ($d.GetPixelDataAsync([Windows.Graphics.Imaging.BitmapPixelFormat]::Bgra8,[Windows.Graphics.Imaging.BitmapAlphaMode]::Straight,(New-Object Windows.Graphics.Imaging.BitmapTransform),[Windows.Graphics.Imaging.ExifOrientationMode]::RespectExifOrientation,[Windows.Graphics.Imaging.ColorManagementMode]::ColorManageToSRgb)) ([Windows.Graphics.Imaging.PixelDataProvider])
[IO.File]::WriteAllBytes($env:LUMINA_OUT,$p.DetachPixelData())
"$($d.OrientedPixelWidth) $($d.OrientedPixelHeight) $($d.DecoderInformation.FriendlyName)"`;
async function windowsDecode(file, png) {
  const raw = png + '.bgra';
  // (sent encoded, so its quotes and lines arrive exactly; no script file is written)
  const r = await runText('powershell.exe', ['-NoProfile', '-NonInteractive', '-EncodedCommand', Buffer.from(WIC_SCRIPT, 'utf16le').toString('base64')],
    { ...process.env, LUMINA_IN: file, LUMINA_OUT: raw });
  try {
    const m = /^(\d+) (\d+) (.*)$/m.exec(r.out);
    if (r.code !== 0 || !m) throw new Error((r.err.split('\n').find(l => /Exception|error/i.test(l)) || r.err || 'Windows could not read it').trim());
    await runFFmpeg(['-hide_banner', '-y', '-f', 'rawvideo', '-pix_fmt', 'bgra', '-s', `${m[1]}x${m[2]}`, '-i', raw, '-frames:v', '1', '-c:v', 'png', png], 0, () => {});
    return m[3];
  } finally { fs.rmSync(raw, { force: true }); }
}
ipcMain.handle('image:open', async (e, file) => {
  const st = fs.statSync(file);
  fs.mkdirSync(IMG_CACHE, { recursive: true });
  const png = path.join(IMG_CACHE, require('crypto').createHash('sha1').update(`${file}|${st.size}|${st.mtimeMs}`).digest('hex').slice(0, 20) + '.png');
  if (fs.existsSync(png)) return { png, cached: true };
  // camera RAW: Windows reads it far better than FFmpeg (which only knows a little DNG)
  if (!RAW_EXT.test(file)) {
    try { await runFFmpeg(['-hide_banner', '-y', '-i', file, '-frames:v', '1', '-c:v', 'png', '-pix_fmt', 'rgba', png], 0, () => {}); return { png, by: 'FFmpeg' }; }
    catch { fs.rmSync(png, { force: true }); }
  }
  if (process.platform === 'win32') {
    try { return { png, by: await windowsDecode(file, png) }; }
    catch (err) {
      fs.rmSync(png, { force: true });
      // "component not found" (WINCODEC_ERR_COMPONENTNOTFOUND): Windows has no decoder for this kind of file
      const noCodec = /88982F50|component.*not.*found|no imaging component/i.test(err.message);
      if (RAW_EXT.test(file)) throw new Error(noCodec ? 'Windows can\'t read camera RAW files yet. Installing Microsoft\'s free "Raw Image Extension" (Microsoft Store) lets Windows and Lumina open RAW photos.'
        : 'Lumina couldn\'t read this camera RAW file. It may be damaged, or from a camera newer than Windows\' RAW support (updating the "Raw Image Extension" can help).');
      if (/\.(heic|heif)$/i.test(file) && noCodec) throw new Error('Windows can\'t read HEIC files yet. Installing Microsoft\'s "HEIF Image Extensions" (Microsoft Store) lets Windows and Lumina open them.');
      throw new Error('Lumina couldn\'t read this picture: ' + err.message);
    }
  }
  throw new Error('Lumina couldn\'t read this picture.');
});

// any image FFmpeg can read, as a PNG (the self-test checks saved images with it; Image mode will open files with it)
ipcMain.handle('image:toPNG', async (e, file) => {
  const out = path.join(app.getPath('temp'), `lumina-decode-${Date.now()}.png`);
  try { await runFFmpeg(['-hide_banner', '-y', '-i', file, '-frames:v', '1', '-f', 'image2', '-c:v', 'png', out], 0, () => {}); return fs.readFileSync(out); }
  finally { fs.rmSync(out, { force: true }); }
});

// A HEIF (.heic) file holding one HEVC picture. Layout (ISO/IEC 23008-12): ftyp; meta { hdlr 'pict', pitm, iloc, iinf
// { infe 'hvc1' }, iprp { ipco { hvcC, ispe }, ipma } }; mdat with the picture's NAL units, each with a 4-byte length.
function heifFile(annexB) {
  // split the Annex B stream at its start codes
  const nals = [];
  for (let i = 0, start = -1; i <= annexB.length; i++) {
    const sc = i + 3 <= annexB.length && annexB[i] === 0 && annexB[i + 1] === 0 && (annexB[i + 2] === 1 || (annexB[i + 2] === 0 && annexB[i + 3] === 1));
    if (sc || i === annexB.length) {
      if (start >= 0) { let end = i; while (end > start && annexB[end - 1] === 0) end--; nals.push(annexB.subarray(start, end)); }
      if (sc) { i += annexB[i + 2] === 1 ? 2 : 3; start = i + 1; }
    }
  }
  const type = n => (n[0] >> 1) & 63;
  const vps = nals.find(n => type(n) === 32), sps = nals.find(n => type(n) === 33), pps = nals.find(n => type(n) === 34);
  const pic = nals.filter(n => type(n) < 32);   // the picture's slices
  if (!vps || !sps || !pps || !pic.length) throw new Error('FFmpeg made no HEVC picture.');
  // the SPS without emulation-prevention bytes, read bit by bit
  const raw = []; for (let i = 2; i < sps.length; i++) { if (i >= 4 && sps[i] === 3 && sps[i - 1] === 0 && sps[i - 2] === 0) continue; raw.push(sps[i]); }
  let bit = 0;
  const u = n => { let v = 0; for (let k = 0; k < n; k++) { v = v * 2 + ((raw[bit >> 3] >> (7 - (bit & 7))) & 1); bit++; } return v; };
  const ue = () => { let z = 0; while (!u(1)) z++; return (2 ** z - 1) + u(z); };
  u(4); const maxSub = u(3); u(1);   // sps_video_parameter_set_id, max_sub_layers_minus1, temporal_id_nesting
  const ptlStart = bit;              // general profile_tier_level: 12 bytes
  bit += 96;
  const subPresent = []; for (let k = 0; k < maxSub; k++) { subPresent.push([u(1), u(1)]); }
  if (maxSub > 0) for (let k = maxSub; k < 8; k++) u(2);
  for (const [p, l] of subPresent) { if (p) bit += 88; if (l) bit += 8; }
  ue();                              // sps_seq_parameter_set_id
  const chroma = ue(); if (chroma === 3) u(1);
  let width = ue(), height = ue();
  // conformance window: the encoder pads to whole blocks; the picture's real size is without the padding
  if (u(1)) { const sw = chroma === 1 || chroma === 2 ? 2 : 1, sh = chroma === 1 ? 2 : 1, l = ue(), r = ue(), t = ue(), b = ue(); width -= sw * (l + r); height -= sh * (t + b); }
  const depthL = ue() + 8, depthC = ue() + 8;
  const ptl = Buffer.from(raw.slice(ptlStart >> 3, (ptlStart >> 3) + 12));
  // boxes
  const u32 = v => { const b = Buffer.alloc(4); b.writeUInt32BE(v); return b; }, u16 = v => { const b = Buffer.alloc(2); b.writeUInt16BE(v); return b; };
  const box = (t, ...parts) => { const body = Buffer.concat(parts); return Buffer.concat([u32(8 + body.length), Buffer.from(t, 'latin1'), body]); };
  const full = (t, v, f, ...parts) => box(t, Buffer.from([v, f >> 16 & 255, f >> 8 & 255, f & 255]), ...parts);
  const arr = (t, n) => Buffer.concat([Buffer.from([0x80 | t]), u16(1), u16(n.length), n]);
  const hvcC = box('hvcC', Buffer.from([1]), ptl, Buffer.from([0xf0, 0x00, 0xfc, 0xfc | chroma, 0xf8 | (depthL - 8), 0xf8 | (depthC - 8), 0, 0, ((maxSub + 1) << 3) | 0x04 | 0x03, 3]),   // ...frame rate 0; layers, nested, 4-byte lengths; 3 arrays
    arr(32, vps), arr(33, sps), arr(34, pps));
  const ispe = full('ispe', 0, 0, u32(width), u32(height));
  const colr = box('colr', Buffer.from('nclx', 'latin1'), u16(1), u16(13), u16(1), Buffer.from([0]));   // BT.709, sRGB curve, BT.709 matrix, video range
  const data = Buffer.concat(pic.flatMap(n => [u32(n.length), n]));
  const ftyp = box('ftyp', Buffer.from('heic', 'latin1'), u32(0), Buffer.from('mif1heic', 'latin1'));
  const meta = off => full('meta', 0, 0,
    full('hdlr', 0, 0, u32(0), Buffer.from('pict', 'latin1'), Buffer.alloc(12), Buffer.from('Lumina\0', 'latin1')),
    full('pitm', 0, 0, u16(1)),
    full('iloc', 0, 0, Buffer.from([0x44, 0x00]), u16(1), u16(1), u16(0), u16(1), u32(off), u32(data.length)),
    full('iinf', 0, 0, u16(1), full('infe', 2, 0, u16(1), u16(0), Buffer.from('hvc1', 'latin1'), Buffer.from('Image\0', 'latin1'))),
    box('iprp', box('ipco', hvcC, ispe, colr), full('ipma', 0, 0, u32(1), u16(1), Buffer.from([3, 0x81, 0x02, 0x03]))));
  // the picture's place in the file is known once meta's size is (meta's size doesn't depend on the number)
  const off = ftyp.length + meta(0).length + 8;
  return Buffer.concat([ftyp, meta(off), box('mdat', data)]);
}

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
ipcMain.on('app:info', e => { e.returnValue = { selftest: SELFTEST, version: app.getVersion(), os: `${process.platform === 'win32' ? 'Windows' : process.platform === 'darwin' ? 'macOS' : 'Linux'} ${require('os').release()}` }; });

// ---------- AI control (MCP steps M1-M5) ----------
// Off until the user ticks Edit › Allow AI control (before M5: "Allow Claude to control Lumina"). Then a small door listens on 127.0.0.1 only (a random
// free port, never the network) and every call needs the key kept in claude-control.json in Lumina's settings folder.
// electron/mcp.js, which Claude Code starts, reads that file and passes Claude's tool calls through the door to
// LuminaAPI in the window. Self tests use their own control file in the test folder.
const http = require('http'), crypto = require('crypto');
const CTRL_FILE = () => SELFTEST && process.env.LUMINA_TESTDIR ? path.join(process.env.LUMINA_TESTDIR, 'claude-control.json') : path.join(app.getPath('userData'), 'claude-control.json');
const readCtrl = () => { try { return JSON.parse(fs.readFileSync(CTRL_FILE(), 'utf8')); } catch { return {}; } };
const writeCtrl = c => { fs.mkdirSync(path.dirname(CTRL_FILE()), { recursive: true }); fs.writeFileSync(CTRL_FILE(), JSON.stringify(c, null, 2)); };
let door = null;
// M5: the app that called last (its clientInfo from initialize), shown next to the AI light and in AI connections
let aiClient = '';
const MCP = require('./mcp.js');
const runTool = async (tool, args, who) => {
  if (!win || win.isDestroyed()) return { ok: false, error: 'Lumina has no window open.' };
  const js = `window.LuminaAPI ? LuminaAPI.call(${JSON.stringify(String(tool || ''))}, ${JSON.stringify(args ?? {})}, ${JSON.stringify(who || '')}) : { ok: false, error: 'Lumina is still starting.' }`;
  return win.webContents.executeJavaScript(js, true);
};
// two ways in, both on 127.0.0.1 with the key: POST /call (electron/mcp.js, the stdio server AI apps start) and
// POST /mcp (MCP's Streamable HTTP, for apps that want an address: one JSON answer per request, no event stream)
function doorRequest(req, res, key) {
  const send = (code, obj, head = {}) => { res.writeHead(code, { 'Content-Type': 'application/json', ...head }); res.end(JSON.stringify(obj)); };
  // web pages always send an Origin and can't fake the Host, so this keeps browsers out; the key keeps other programs out
  if (req.headers.origin || !/^(127\.0\.0\.1|localhost):\d+$/.test(req.headers.host || '')) return send(403, { ok: false, error: 'Refused: only AI apps on this computer may connect.' });
  const auth = String(req.headers.authorization || ''), bearer = /^Bearer\s+/i.test(auth) ? auth.replace(/^Bearer\s+/i, '').trim() : '';
  const given = Buffer.from(String(req.headers['x-lumina-key'] || bearer)), want = Buffer.from(key);
  if (given.length !== want.length || !crypto.timingSafeEqual(given, want)) return send(401, { ok: false, error: 'Wrong or missing key.' });
  const url = String(req.url || '').split('?')[0];
  if (url === '/mcp' && req.method !== 'POST') return send(405, { jsonrpc: '2.0', id: null, error: { code: -32000, message: 'Lumina only answers POST here (no event stream).' } }, { Allow: 'POST' });
  if (req.method !== 'POST' || (url !== '/call' && url !== '/mcp')) return send(404, { ok: false, error: 'Unknown request.' });
  let body = ''; req.setEncoding('utf8');
  req.on('data', d => { body += d; if (body.length > 1e6) req.destroy(); });
  req.on('end', async () => {
    let msg; try { msg = JSON.parse(body); } catch { return url === '/mcp' ? send(400, { jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } }) : send(400, { ok: false, error: 'The request was not JSON.' }); }
    if (url === '/call') {
      let who = ''; try { who = decodeURIComponent(String(req.headers['x-lumina-client'] || '')).slice(0, 60); } catch { }
      if (who) aiClient = who;
      if (!win || win.isDestroyed()) return send(503, { ok: false, error: 'Lumina has no window open.' });
      try { send(200, await runTool(msg.tool, msg.args, who)); } catch (e) { send(500, { ok: false, error: String(e && e.message || e) }); }
      return;
    }
    if (Array.isArray(msg) || !msg || typeof msg !== 'object') return send(400, { jsonrpc: '2.0', id: null, error: { code: -32600, message: 'Send one JSON-RPC message per request.' } });
    if (msg.id === undefined || msg.id === null) { res.writeHead(202); return res.end(); }   // a notification or a reply: nothing to answer
    if (msg.method === 'initialize') aiClient = String(msg.params?.clientInfo?.title || msg.params?.clientInfo?.name || 'an AI app').slice(0, 60);
    try { send(200, { jsonrpc: '2.0', id: msg.id, result: await MCP.handle(msg, (t, a) => runTool(t, a, aiClient)) }); }
    catch (e) { send(200, { jsonrpc: '2.0', id: msg.id, error: { code: e.code || -32603, message: String(e && e.message || e) } }); }
  });
}
// the door keeps its port from one start to the next (httpPort), so an app given the address can find Lumina again;
// only if that port is taken does it get a new one (AI connections then shows the new address)
function openDoor() {
  return new Promise((ok, bad) => {
    if (door) return ok();
    const c = readCtrl(); c.key ||= crypto.randomBytes(32).toString('hex');
    const start = port => {
      const srv = http.createServer((req, res) => doorRequest(req, res, c.key));
      srv.once('error', e => port ? start(0) : bad(e));
      srv.listen(port, '127.0.0.1', () => { door = srv; srv.on('error', () => { }); const p = srv.address().port; c.portMoved = !!c.httpPort && c.httpPort !== p; Object.assign(c, { enabled: true, port: p, httpPort: p, pid: process.pid }); writeCtrl(c); ok(); });
    };
    start(c.httpPort || 0);
  });
}
// off = the switch is unticked; quitting keeps the switch on but the door is gone until Lumina opens again
function closeDoor(keepSwitch) {
  if (door) { door.close(); door = null; }
  const c = readCtrl(); if (!Object.keys(c).length) return;
  if (!keepSwitch) c.enabled = false;
  delete c.port; delete c.pid; writeCtrl(c);
}
ipcMain.handle('claude:get', () => ({ enabled: !!door, port: door ? door.address().port : null }));
ipcMain.handle('claude:set', async (e, on) => { if (on) await openDoor(); else closeDoor(false); return { enabled: !!door, port: door ? door.address().port : null }; });
app.on('will-quit', () => { if (door) closeDoor(true); });
// start electron/mcp.js the way Claude starts it (this very Lumina.exe in Node mode), send it lines, hand back the answers
const MCP_SCRIPT = () => path.join(__dirname, 'mcp.js');   // inside resources\app.asar once installed; Node mode reads it there
function runMcp(lines, want, env = {}) {
  return new Promise(done => {
    const p = require('child_process').spawn(process.execPath, [MCP_SCRIPT()],
      { env: { ...process.env, ELECTRON_RUN_AS_NODE: '1', ...(SELFTEST ? { LUMINA_CONTROL_FILE: CTRL_FILE() } : {}), ...env }, windowsHide: true });
    let out = '', err = '', got = [], over = false;
    const finish = () => { if (over) return; over = true; clearTimeout(timer); try { p.kill(); } catch { } done({ replies: got, stderr: err.slice(0, 4000), rest: out.slice(0, 2000) }); };
    const timer = setTimeout(finish, 30000);
    p.on('error', e => { err += String(e.message || e); finish(); });
    p.stderr.on('data', d => err += d);
    p.stdout.on('data', d => {
      out += d; let i;
      while ((i = out.indexOf('\n')) >= 0) { const line = out.slice(0, i); out = out.slice(i + 1); try { got.push(JSON.parse(line)); } catch { got.push({ notJson: line.slice(0, 300) }); } }
      if (got.length >= want) finish();
    });
    p.on('exit', finish);
    for (const l of lines) p.stdin.write((typeof l === 'string' ? l : JSON.stringify(l)) + '\n');
  });
}
// self tests only: any conversation with mcp.js (wrongKey: a copy of the control file with a wrong key)
if (SELFTEST) ipcMain.handle('claude:probe', (e, { lines, want, env = {} }) => {
  if (env.wrongKey) { const f = CTRL_FILE().replace(/\.json$/, '-wrong.json'); fs.writeFileSync(f, JSON.stringify({ ...readCtrl(), key: '0'.repeat(64) })); env = { LUMINA_CONTROL_FILE: f }; }
  return runMcp(lines, want, env);
});
// self tests only: read / write / delete a file inside the test folder, and run Lumina.exe with an uninstaller flag
if (SELFTEST) ipcMain.handle('claude:testfile', (e, { name, text, remove, copyFrom }) => {
  const dir = process.env.LUMINA_TESTDIR, f = path.resolve(dir, name);
  if (!dir || !f.startsWith(path.resolve(dir) + path.sep)) throw new Error('Only files in the test folder.');
  if (remove) { fs.rmSync(f, { recursive: true, force: true }); return null; }
  if (copyFrom) { fs.mkdirSync(path.dirname(f), { recursive: true }); fs.copyFileSync(copyFrom, f); return f; }
  if (text != null) { fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, text); return null; }
  return fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : null;
});
if (SELFTEST) ipcMain.handle('claude:cli', (e, flag) => require('child_process').spawnSync(process.execPath, ['--selftest', flag], { env: process.env, timeout: 60000, windowsHide: true }).status);

// ---------- Help › Connect Claude… (M1b): set Claude up on a friend's computer ----------
// What Claude needs to start Lumina's MCP server on this computer: this Lumina.exe, in Node mode, with mcp.js.
const luminaEntry = () => ({ command: process.execPath, args: [MCP_SCRIPT()], env: { ELECTRON_RUN_AS_NODE: '1' } });
const q = s => `"${s}"`;
const codeLine = () => `claude mcp add lumina --scope user -e ELECTRON_RUN_AS_NODE=1 -- ${q(process.execPath)} ${q(MCP_SCRIPT())}`;
const samePath = (a, b) => process.platform === 'win32' ? String(a || '').toLowerCase() === String(b || '').toLowerCase() : a === b;
const isOurs = s => !!s && samePath(s.command, process.execPath);
const isCurrent = s => isOurs(s) && samePath(s.args?.[0], MCP_SCRIPT()) && s.env?.ELECTRON_RUN_AS_NODE === '1';
// the Claude app keeps its settings in different places depending on how it was installed; look in all of them
function desktopConfigs() {
  const H = require('os').homedir(), name = 'claude_desktop_config.json', list = [];
  let main;
  if (SELFTEST && process.env.LUMINA_TESTDIR) list.push(main = path.join(process.env.LUMINA_TESTDIR, 'claude-desktop', name));
  else if (process.platform === 'win32') {
    const ad = process.env.APPDATA || path.join(H, 'AppData', 'Roaming'), la = process.env.LOCALAPPDATA || path.join(H, 'AppData', 'Local');
    main = path.join(ad, 'Claude', name); list.push(main);
    const sub = (dir, pick, ...rest) => { try { for (const d of fs.readdirSync(dir)) if (pick(d)) list.push(path.join(dir, d, ...rest)); } catch { } };
    sub(path.join(la, 'Claude-Data'), () => true, name);
    sub(path.join(la, 'Packages'), d => /^Claude_/i.test(d), 'LocalCache', 'Roaming', 'Claude', name);
  } else main = path.join(process.platform === 'darwin' ? path.join(H, 'Library', 'Application Support') : process.env.XDG_CONFIG_HOME || path.join(H, '.config'), 'Claude', name), list.push(main);
  const found = list.filter(f => fs.existsSync(f));
  // no settings file yet, but the Claude app is there: it reads the usual place
  return found.length ? found : fs.existsSync(path.dirname(main)) ? [main] : [];
}
const readJson = f => JSON.parse(fs.readFileSync(f, 'utf8').replace(/^﻿/, ''));
function desktopState() {
  return desktopConfigs().map(file => {
    if (!fs.existsSync(file)) return { file, exists: false, has: false };
    try { const s = readJson(file).mcpServers?.lumina; return { file, exists: true, has: !!s, ours: isOurs(s), current: isCurrent(s) }; }
    catch { return { file, exists: true, unreadable: true, has: false }; }
  });
}
// change only mcpServers.lumina, after keeping a copy of the file as it was (…json.before-lumina)
function desktopEdit(add, onlyOurs) {
  const done = [];
  for (const file of desktopConfigs()) {
    let j = {};
    if (fs.existsSync(file)) {
      try { j = readJson(file); } catch { throw new Error(`Claude's settings file couldn't be read, so it was left alone:\n${file}`); }
      if (!add && !(j.mcpServers?.lumina && (!onlyOurs || isOurs(j.mcpServers.lumina)))) continue;
      fs.copyFileSync(file, file + '.before-lumina');
    } else if (!add) continue;
    j.mcpServers ||= {};
    if (add) j.mcpServers.lumina = luminaEntry(); else delete j.mcpServers.lumina;
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(j, null, 2));
    done.push(file);
  }
  return done;
}
// Claude Code's own list (read only: Lumina never edits it; the window gives the line to paste instead)
function codeState() {
  const f = SELFTEST && process.env.LUMINA_TESTDIR ? path.join(process.env.LUMINA_TESTDIR, 'claude-code.json') : path.join(require('os').homedir(), '.claude.json');
  try { const s = readJson(f).mcpServers?.lumina; return { has: !!s, current: !!s && samePath(s.command, process.execPath) && samePath(s.args?.[0], MCP_SCRIPT()) }; }
  catch { return { has: false, current: false }; }
}
// ---------- Edit › AI connections (MCP)… (M5): other AI apps ----------
// Apps whose settings file Lumina may change, only on the person's button press, with a copy kept first (…before-lumina),
// and only when the app's folder is there (it is installed). Paths are each app's own docs (checked 2026-11-10).
const H = () => require('os').homedir();
const testApp = (...p) => SELFTEST && process.env.LUMINA_TESTDIR ? path.join(process.env.LUMINA_TESTDIR, 'apps', ...p) : null;
const AI_APPS = {
  cursor: { name: 'Cursor', file: () => testApp('cursor', 'mcp.json') || path.join(H(), '.cursor', 'mcp.json'), entry: () => ({ type: 'stdio', ...luminaEntry() }) },
  gemini: { name: 'Gemini CLI', file: () => testApp('gemini', 'settings.json') || path.join(H(), '.gemini', 'settings.json'), entry: luminaEntry },
  devin: { name: 'Devin', file: () => testApp('devin', 'mcp_config.json') || (process.platform === 'win32' ? path.join(process.env.APPDATA || path.join(H(), 'AppData', 'Roaming'), 'devin', 'mcp_config.json')
    : path.join(process.env.XDG_CONFIG_HOME || path.join(H(), '.config'), 'devin', 'mcp_config.json')), entry: luminaEntry },
  copilotcli: { name: 'Copilot CLI', file: () => testApp('copilot', 'mcp-config.json') || path.join(process.env.COPILOT_HOME || path.join(H(), '.copilot'), 'mcp-config.json'),
    entry: () => ({ type: 'local', ...luminaEntry(), tools: ['*'] }) },
  omp: { name: 'OMP', file: () => testApp('omp', 'agent', 'mcp.json') || path.join(H(), '.omp', 'agent', 'mcp.json'), entry: luminaEntry },
  kiro: { name: 'Kiro', file: () => testApp('kiro', 'settings', 'mcp.json') || path.join(H(), '.kiro', 'settings', 'mcp.json'), entry: luminaEntry }
};
function jsonState(file) {
  if (!fs.existsSync(file)) return { file, installed: fs.existsSync(path.dirname(file)), exists: false, has: false };
  try { const s = readJson(file).mcpServers?.lumina; return { file, installed: true, exists: true, has: !!s, ours: isOurs(s), current: isCurrent(s) }; }
  catch { return { file, installed: true, exists: true, unreadable: true, has: false }; }
}
// the same careful change as the Claude app's: only mcpServers.lumina, after a copy of the file as it was
function jsonEdit(file, add, onlyOurs, entry, what) {
  let j = {};
  if (fs.existsSync(file)) {
    try { j = readJson(file); } catch { throw new Error(`${what}'s settings file couldn't be read, so it was left alone:\n${file}`); }
    if (!add && !(j.mcpServers?.lumina && (!onlyOurs || isOurs(j.mcpServers.lumina)))) return false;
    fs.copyFileSync(file, file + '.before-lumina');
  } else if (!add || !fs.existsSync(path.dirname(file))) return false;
  j.mcpServers ||= {};
  if (add) j.mcpServers.lumina = entry(); else delete j.mcpServers.lumina;
  fs.writeFileSync(file, JSON.stringify(j, null, 2));
  return true;
}
const appsState = () => Object.fromEntries(Object.entries(AI_APPS).map(([id, a]) => [id, jsonState(a.file())]));
// the text each app wants (shown with Copy); the HTTP way needs the key, which only ever goes to the clipboard
const toml = s => `'${s}'`;
const snippets = () => {
  const e = luminaEntry(), port = readCtrl().httpPort;
  return {
    mcpServers: JSON.stringify({ mcpServers: { lumina: e } }, null, 2),
    vscode: JSON.stringify({ servers: { lumina: { type: 'stdio', ...e } } }, null, 2),
    codex: `[mcp_servers.lumina]\ncommand = ${toml(e.command)}\nargs = [${toml(e.args[0])}]\nenv = { ELECTRON_RUN_AS_NODE = "1" }`,
    gemini: `gemini mcp add --scope user -e ELECTRON_RUN_AS_NODE=1 lumina ${q(e.command)} ${q(e.args[0])}`,
    zed: JSON.stringify({ context_servers: { lumina: e } }, null, 2),
    copilot: `copilot mcp add --env ELECTRON_RUN_AS_NODE=1 lumina -- ${q(e.command)} ${q(e.args[0])}`,
    opencode: `opencode mcp add lumina --env ELECTRON_RUN_AS_NODE=1 -- ${q(e.command)} ${q(e.args[0])}`,
    url: port ? `http://127.0.0.1:${port}/mcp` : ''
  };
};
const httpText = kind => {
  const c = readCtrl(), url = `http://127.0.0.1:${c.httpPort}/mcp`;
  if (!door || !c.key || !c.httpPort) throw new Error('Turn on AI control first.');
  if (kind === 'key') return c.key;
  if (kind === 'claude') return `claude mcp add --transport http --scope user lumina ${url} --header "Authorization: Bearer ${c.key}"`;
  return JSON.stringify({ mcpServers: { lumina: { url, headers: { Authorization: `Bearer ${c.key}` } } } }, null, 2);
};
ipcMain.handle('ai:copy', (e, kind) => { require('electron').clipboard.writeText(httpText(kind)); return true; });
ipcMain.handle('ai:app', (e, { id, add }) => {
  const a = AI_APPS[id]; if (!a) throw new Error('Unknown app.');
  jsonEdit(a.file(), !!add, false, a.entry, a.name);
  return setupInfo();
});
const setupInfo = () => { const c = readCtrl(); return { enabled: !!door, port: door ? door.address().port : null, portMoved: !!c.portMoved, client: aiClient, tools: MCP.TOOLS.length,
  exe: process.execPath, script: MCP_SCRIPT(), codeLine: codeLine(), codeRemove: 'claude mcp remove lumina --scope user', code: codeState(), desktop: desktopState(), apps: appsState(), snippets: snippets() }; };
ipcMain.handle('claude:setup', () => setupInfo());
ipcMain.handle('claude:desktop', (e, add) => { const files = desktopEdit(!!add, false); return { files, ...setupInfo() }; });
// self tests: the HTTP way, asked the way an AI app asks (the key, an Origin, the method or the Host can be changed to see them refused)
if (SELFTEST) ipcMain.handle('ai:http', (e, { body, key, origin, method = 'POST', host }) => new Promise(done => {
  const c = readCtrl(), data = typeof body === 'string' ? body : JSON.stringify(body ?? {});
  const headers = { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream', ...(key !== null ? { Authorization: `Bearer ${key ?? c.key}` } : {}), ...(origin ? { Origin: origin } : {}), ...(host ? { Host: host } : {}) };
  const r = http.request({ host: '127.0.0.1', port: c.httpPort, path: '/mcp', method, headers, timeout: 30000 }, res => {
    let t = ''; res.setEncoding('utf8'); res.on('data', d => t += d);
    res.on('end', () => { let j = null; try { j = JSON.parse(t); } catch { } done({ status: res.statusCode, type: res.headers['content-type'] || '', json: j, text: t.slice(0, 500) }); });
  });
  r.on('error', err => done({ status: 0, error: err.code || String(err.message) })); r.on('timeout', () => r.destroy(new Error('timeout')));
  r.end(method === 'POST' ? data : undefined);
}));
// "Test the connection": the same start-up Claude does, then one look at the project
ipcMain.handle('claude:test', async () => {
  const r = await runMcp([{ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'lumina-test', version: '1' } } },
    { jsonrpc: '2.0', id: 2, method: 'tools/list' }, { jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'get_project', arguments: {} } }], 3);
  const a = id => r.replies.find(x => x.id === id), call = a(3)?.result;
  return { started: a(1)?.result?.serverInfo?.name === 'lumina', tools: (a(2)?.result?.tools || []).map(t => t.name), reached: !!call && !call.isError,
    message: call?.isError ? call.content?.[0]?.text : '', stderr: r.stderr };
});

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
// for the uninstaller: --claude-check exits 1 when the Claude app's (or Cursor's, Gemini CLI's, Devin's) settings start this
// Lumina, --claude-forget takes it out of them
const CLAUDE_CLI = process.argv.find(a => a === '--claude-check' || a === '--claude-forget');
if (CLAUDE_CLI) {
  let code = 0;
  try {
    if (CLAUDE_CLI === '--claude-check') code = desktopState().some(d => d.ours) || Object.values(appsState()).some(d => d.ours) ? 1 : 0;
    else { desktopEdit(false, true); for (const a of Object.values(AI_APPS)) try { jsonEdit(a.file(), false, true, a.entry, a.name); } catch { } }
  } catch { code = 2; }
  app.exit(code);
}
else if (!SELFTEST && !app.requestSingleInstanceLock()) app.quit();
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
    // the switch stays as the user left it; self tests turn it on themselves
    if (!SELFTEST && readCtrl().enabled) openDoor().catch(() => { });
  });
  app.on('window-all-closed', () => app.quit());
}
