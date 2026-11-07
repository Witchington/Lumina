// Lumina desktop shell: window, file dialogs, project files and a local media server.
const { app, BrowserWindow, ipcMain, dialog, protocol, nativeTheme, Menu, webUtils } = require('electron');
const path = require('path');
const fs = require('fs');
const { Readable } = require('stream');

const ROOT = path.join(__dirname, '..');
const SELFTEST = process.argv.includes('--selftest');

// ---- Linux: keep Chromium's default GPU path (forcing Vulkan/Ozone broke compositing on some NVIDIA setups) ----
if (process.platform === 'linux') {
  app.commandLine.appendSwitch('enable-unsafe-webgpu');
  // AppImages can't ship a setuid chrome-sandbox; skip it unless the user opts back in
  if (process.env.APPIMAGE && !process.env.LUMINA_KEEP_SANDBOX) app.commandLine.appendSwitch('no-sandbox');
  // escape hatches for GPU/driver problems:  LUMINA_SOFTWARE=1 (no GPU)   LUMINA_X11=1 (force X11 instead of Wayland)
  if (process.env.LUMINA_SOFTWARE) { app.disableHardwareAcceleration(); }
  if (process.env.LUMINA_X11) { app.commandLine.appendSwitch('ozone-platform', 'x11'); }
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
    if (url.host === 'app' && url.pathname.startsWith('/@media/')) return serveFile(decodeURIComponent(url.pathname.slice('/@media/'.length)), request);
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
    title: 'Lumina', icon: path.join(ROOT, 'lumina.ico'), backgroundColor: '#111014',
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
ipcMain.on('app:info', e => { e.returnValue = { version: app.getVersion(), os: `Windows ${require('os').release()}` }; });

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
