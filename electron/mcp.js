// Lumina's MCP server (Claude control, step M1). Claude Code starts it and talks JSON-RPC to it over stdin / stdout,
// one message per line. It runs with Lumina itself, so nothing has to be installed:
//   ELECTRON_RUN_AS_NODE=1  <Lumina.exe>  <Lumina>\resources\app.asar\electron\mcp.js
// It reads Lumina's claude-control.json (the door's port and key, written when Edit › Allow Claude to control Lumina
// is ticked) and passes each tool call to the open Lumina. It never listens on anything itself.
'use strict';
const fs = require('fs'), path = require('path'), os = require('os'), http = require('http'), readline = require('readline');

const VERSION = (() => { try { return require('../package.json').version; } catch { return '0'; } })();
const PROTOCOLS = ['2025-06-18', '2025-03-26', '2024-11-05'];
const OFF = 'Lumina is not open, or Claude control is off. Open Lumina and tick Edit › Allow Claude to control Lumina, then try again.';

function controlFile() {
  if (process.env.LUMINA_CONTROL_FILE) return process.env.LUMINA_CONTROL_FILE;
  const base = process.platform === 'win32' ? process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming')
    : process.platform === 'darwin' ? path.join(os.homedir(), 'Library', 'Application Support')
    : process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config');
  return path.join(base, 'Lumina', 'claude-control.json');
}

// what Claude sees. M1: looking (these four). M2: editing (below).
const look = { readOnlyHint: true, destructiveHint: false, openWorldHint: false };
const TOOLS = [
  { name: 'get_project', title: 'Get the project',
    description: 'The open Lumina project: name, video or image mode, size, fps, length, playhead, and every layer (id, name, kind, start, length, effects). The first layer is drawn on top.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false }, annotations: look },
  { name: 'get_layer', title: 'Get one layer',
    description: 'Everything about one layer: its settings, the properties that differ from a new layer (at the playhead), its keyframes, its media, and each effect with its settings.',
    inputSchema: { type: 'object', properties: { id: { type: 'integer', description: 'The layer id from get_project.' } }, required: ['id'], additionalProperties: false }, annotations: look },
  { name: 'list_effects', title: 'List effects',
    description: 'The effects Lumina has, by group. Give query to search by name or group, or id to get one effect\'s settings (ids, ranges, defaults).',
    inputSchema: { type: 'object', properties: { query: { type: 'string', description: 'Words to search for, e.g. "blur" or "Keying".' }, id: { type: 'string', description: 'One effect id from the list.' } }, additionalProperties: false }, annotations: look },
  { name: 'snapshot', title: 'Look at a frame',
    description: 'A picture of the preview at a time in seconds (default: the playhead), as a PNG. The playhead goes back where it was afterwards.',
    inputSchema: { type: 'object', properties: { time: { type: 'number', minimum: 0, description: 'Seconds from the start.' }, max_width: { type: 'integer', minimum: 64, maximum: 3840, description: 'Largest width of the picture in pixels (default 960).' } }, additionalProperties: false }, annotations: look }
];

// M2: editing. Every call is one undo step in Lumina (Ctrl+Z there, or the undo tool), and the user sees it happen.
const edit = { readOnlyHint: false, destructiveHint: false, openWorldHint: false };
const obj = (properties, required = []) => ({ type: 'object', properties, required, additionalProperties: false });
const ID = { type: 'integer', description: 'The layer id from get_project.' };
const SEC = d => ({ type: 'number', minimum: 0, description: d });
const COLOR = d => ({ type: 'string', pattern: '^#[0-9a-fA-F]{6}$', description: d + ' Like "#ff8800".' });
const PLACE = {
  start: SEC('When it starts, in timeline seconds (default: the playhead).'), duration: { type: 'number', exclusiveMinimum: 0, description: 'How long it lasts, in seconds.' },
  x: { type: 'number', description: 'Centre across the frame: 0 = left edge, 0.5 = middle, 1 = right edge.' },
  y: { type: 'number', description: 'Centre down the frame: 0 = top, 0.5 = middle, 1 = bottom.' },
  scale: { type: 'number', description: '1 = 100%.' }, rotation: { type: 'number', description: 'Degrees.' }, opacity: { type: 'number', minimum: 0, maximum: 1 }
};
const PATH_ARG = { type: 'string', description: String.raw`The full path to the file on this computer, e.g. C:\Videos\clip.mp4.` };
const OVERWRITE = { type: 'boolean', description: 'Replace a file that is already there (ask the person first).' };
const SHAPE_NAMES = ['rect', 'ellipse', 'arrow', 'line', 'star', 'heart', 'triangle', 'hexagon', 'bubble', 'burst', 'blur', 'pixel', 'fill'];
TOOLS.push(
  { name: 'seek', title: 'Move the playhead', description: 'Move the playhead to a time in seconds. New layers start at the playhead.',
    inputSchema: obj({ time: SEC('Seconds from the start.') }, ['time']), annotations: { ...edit, idempotentHint: true } },
  { name: 'add_text', title: 'Add text', description: 'Add a text layer (drawn on top). Returns its id.',
    inputSchema: obj({ text: { type: 'string' }, font: { type: 'string', description: 'A font name (default Anton).' }, color: COLOR('Text colour.'), size: { type: 'number', description: 'Font size (default 140).' },
      outline: { type: 'boolean', description: 'Black outline (default true).' },
      animation: { type: 'string', enum: ['pop', 'wordpop', 'typewriter', 'bounce', 'wave', 'glitch', 'fade', 'slide', 'shake', 'none'], description: 'How it comes in (default none).' }, ...PLACE }, ['text']), annotations: edit },
  { name: 'add_shape', title: 'Add a shape', description: 'Add a shape layer. blur / pixel / fill are boxes that hide or erase what is under them. Returns its id.',
    inputSchema: obj({ shape: { type: 'string', enum: SHAPE_NAMES }, fill: COLOR('Fill colour.'), w: { type: 'number', description: 'Width in pixels.' }, h: { type: 'number', description: 'Height in pixels.' }, ...PLACE }, ['shape']), annotations: edit },
  { name: 'add_solid', title: 'Add a solid colour', description: 'Add a frame-sized block of one colour (a background or a colour wash). By default it lasts from the playhead to the end. Returns its id.',
    inputSchema: obj({ color: COLOR('The colour.'), name: { type: 'string' }, ...PLACE }, ['color']), annotations: edit },
  { name: 'set_property', title: 'Change a layer setting',
    description: 'Change one setting of a layer. Numbers: any property get_layer shows (x, y, scale, rotation, opacity, blur, w, h, size…); if that property has keyframes, this sets a keyframe at the playhead. Others: name, text, font, color, fill, strokeColor, stroke, filled, visible, anim, blend.',
    inputSchema: obj({ id: ID, property: { type: 'string' }, value: { description: 'A number, text, a colour like "#ff8800", or true / false.' } }, ['id', 'property', 'value']), annotations: { ...edit, idempotentHint: true } },
  { name: 'set_keyframe', title: 'Set or remove a keyframe',
    description: 'Put a keyframe on a number property of a layer at a timeline time (default: the playhead), or take one away with remove: true. Two or more keyframes animate the property between them.',
    inputSchema: obj({ id: ID, property: { type: 'string', description: 'e.g. x, y, scale, rotation, opacity.' }, time: SEC('Timeline seconds.'), value: { type: 'number' },
      ease: { type: 'string', enum: ['smooth', 'linear', 'hold'], description: 'How it moves on to the next keyframe (default smooth).' }, remove: { type: 'boolean' } }, ['id', 'property']), annotations: edit },
  { name: 'move', title: 'Move a layer', description: 'Move a layer to start at another time, and/or to another place in the layer order (0 = on top). A linked clip (its separated sound) moves with it.',
    inputSchema: obj({ id: ID, start: SEC('New start, in timeline seconds.'), order: { type: 'integer', minimum: 0, description: '0 = drawn on top.' } }, ['id']), annotations: { ...edit, idempotentHint: true } },
  { name: 'trim', title: 'Trim a layer', description: 'Cut the start and/or end of a layer to new timeline times. Video and audio keep their footage in place (like dragging the clip edges).',
    inputSchema: obj({ id: ID, start: SEC('New start time.'), end: SEC('New end time.') }, ['id']), annotations: { ...edit, idempotentHint: true } },
  { name: 'split', title: 'Split a layer', description: 'Cut a layer in two at a timeline time (default: the playhead). Returns both ids.',
    inputSchema: obj({ id: ID, time: SEC('Timeline seconds, inside the layer.') }, ['id']), annotations: edit },
  { name: 'delete_layer', title: 'Delete a layer', description: 'Delete a layer. It can be brought back with undo.',
    inputSchema: obj({ id: ID }, ['id']), annotations: { ...edit, destructiveHint: true } },
  { name: 'add_effect', title: 'Add an effect', description: 'Add an effect to a layer (ids from list_effects). Returns its index on the layer.',
    inputSchema: obj({ id: ID, effect: { type: 'string', description: 'An effect id from list_effects.' } }, ['id', 'effect']), annotations: edit },
  { name: 'set_effect', title: 'Change an effect', description: 'Change an effect\'s settings (ids from list_effects with that effect\'s id), and/or turn it on or off. Number settings with keyframes get a keyframe at the playhead.',
    inputSchema: obj({ id: ID, index: { type: 'integer', minimum: 0, description: 'The effect\'s index from get_layer.' }, settings: { type: 'object', description: 'e.g. {"brightness": 20}. Points are [x, y].' }, on: { type: 'boolean' } }, ['id', 'index']), annotations: { ...edit, idempotentHint: true } },
  { name: 'remove_effect', title: 'Remove an effect', description: 'Take an effect off a layer.',
    inputSchema: obj({ id: ID, index: { type: 'integer', minimum: 0 } }, ['id', 'index']), annotations: { ...edit, destructiveHint: true } },
  { name: 'undo', title: 'Undo', description: 'Undo the last change in Lumina (the same as Ctrl+Z, whoever made it).', inputSchema: obj({}), annotations: edit },
  { name: 'redo', title: 'Redo', description: 'Redo the last undone change.', inputSchema: obj({}), annotations: edit },
  // M3: media. Files are read where they are; nothing is copied or uploaded.
  { name: 'import_media', title: 'Import a file', description: 'Bring a video, picture, sound or .srt / .vtt captions file from this computer into the project and put it on the timeline. Returns the layer id and media id.',
    inputSchema: obj({ path: PATH_ARG, start: SEC('Where it starts on the timeline (default: videos line up after the last video; others at the playhead).') }, ['path']), annotations: edit },
  { name: 'place_media', title: 'Use an imported file again', description: 'Put another clip of an already imported file on the timeline (media ids are in get_project). For video and sound, in / out pick the part of the file.',
    inputSchema: obj({ media: { type: 'integer' }, start: SEC('Timeline start (default: the playhead).'), in: SEC('Seconds into the file where the clip begins.'), out: SEC('Seconds into the file where it ends.') }, ['media']), annotations: edit },
  { name: 'import_captions', title: 'Import captions', description: 'Add an .srt or .vtt subtitle file as one captions layer.',
    inputSchema: obj({ path: PATH_ARG, start: SEC('Timeline start (default 0).') }, ['path']), annotations: edit },
  { name: 'auto_captions', title: 'Make captions from speech', description: 'Turn the speech in a video or audio layer into a captions layer, on this computer. Only works once the person has downloaded the speech model in Lumina; it can take a minute or more.',
    inputSchema: obj({ id: ID, language: { type: 'string', description: 'auto (default), english, spanish, french, german, italian, portuguese, dutch, polish, russian, turkish, arabic, hindi, japanese, korean or chinese.' } }, ['id']), annotations: edit },
  { name: 'optimize', title: 'Make an edit copy', description: 'Start making an easy-to-edit copy of a video layer\'s file (saved next to the original, which is untouched), so jumping around in it is quick. Runs in the background; get_layer shows media.editCopy.',
    inputSchema: obj({ id: ID }, ['id']), annotations: { ...edit, idempotentHint: true } },
  // M4: output and Image mode. Nothing is written over an existing file unless overwrite is true.
  { name: 'save_project', title: 'Save the project', description: 'Save the project as a .lumina file (default: where it was last saved).',
    inputSchema: obj({ path: { type: 'string', description: String.raw`A full path ending in .lumina, e.g. C:\Users\Me\Documents\My edit.lumina.` }, overwrite: OVERWRITE }), annotations: { ...edit, idempotentHint: true } },
  { name: 'save_image', title: 'Save a picture', description: 'Save the frame at a time (default: the playhead), or the image in Image mode, as a picture. The file extension picks the format: .png .jpg .webp .avif .gif .bmp .tif .psd (with layers) .pdf .svg .eps .ico and more.',
    inputSchema: obj({ path: { type: 'string', description: String.raw`A full path, e.g. C:\Users\Me\Pictures\frame.png.` }, time: SEC('Timeline seconds (video mode).'), quality: { type: 'integer', minimum: 1, maximum: 100, description: 'For JPEG / WebP / AVIF (default 90).' },
      transparent: { type: 'boolean', description: 'Keep see-through areas (formats that can).' }, overwrite: OVERWRITE }, ['path']), annotations: edit },
  { name: 'export_video', title: 'Export the video', description: 'Export the edit as a video file. The extension picks the format: .mp4 .mov .mkv .avi .webm .flv .wmv .mts .vob .ogv. Lumina plays the edit once in real time to record it, so this takes as long as the edit, plus saving; the Lumina window must stay visible.',
    inputSchema: obj({ path: { type: 'string', description: String.raw`A full path, e.g. C:\Users\Me\Videos\edit.mp4.` }, overwrite: OVERWRITE }, ['path']), annotations: edit },
  { name: 'new_image', title: 'Start a new image', description: 'Start a new, empty picture in Image mode (this replaces the open project, so it refuses if that has unsaved changes).',
    inputSchema: obj({ width: { type: 'integer', minimum: 1, maximum: 16384 }, height: { type: 'integer', minimum: 1, maximum: 16384 }, background: { type: 'string', description: 'white (default), black, transparent or a colour like "#ff8800".' },
      discard_unsaved: { type: 'boolean', description: 'Only when the person said their unsaved changes can go.' } }), annotations: { ...edit, destructiveHint: true } },
  { name: 'image_mode', title: 'Image mode on or off', description: 'Turn Image mode on (the project becomes one picture made of layers, no timeline) or off (back to video editing).',
    inputSchema: obj({ on: { type: 'boolean' } }, ['on']), annotations: { ...edit, idempotentHint: true } },
  { name: 'image_size', title: 'Resize the image', description: 'Image mode: scale the whole picture and its layers to a new size in pixels.',
    inputSchema: obj({ width: { type: 'integer', minimum: 1 }, height: { type: 'integer', minimum: 1 } }, ['width', 'height']), annotations: edit },
  { name: 'canvas_size', title: 'Change the canvas size', description: 'Image mode: make the canvas bigger or smaller without scaling the layers.',
    inputSchema: obj({ width: { type: 'integer', minimum: 1 }, height: { type: 'integer', minimum: 1 }, anchor: { type: 'string', enum: ['top-left', 'top', 'top-right', 'left', 'center', 'right', 'bottom-left', 'bottom', 'bottom-right'], description: 'Where the old picture stays (default center).' } }, ['width', 'height']), annotations: edit },
  { name: 'crop', title: 'Crop the image', description: 'Image mode: keep only a box of the picture, in pixels from the top-left corner.',
    inputSchema: obj({ x: { type: 'integer', minimum: 0 }, y: { type: 'integer', minimum: 0 }, width: { type: 'integer', minimum: 1 }, height: { type: 'integer', minimum: 1 } }, ['x', 'y', 'width', 'height']), annotations: edit },
  { name: 'rotate_canvas', title: 'Rotate the image', description: 'Image mode: turn the whole picture.',
    inputSchema: obj({ degrees: { type: 'integer', enum: [90, -90, 180], description: '90 = clockwise.' } }, ['degrees']), annotations: edit },
  { name: 'flip_canvas', title: 'Flip the image', description: 'Image mode: mirror the whole picture.',
    inputSchema: obj({ direction: { type: 'string', enum: ['horizontal', 'vertical'] } }, ['direction']), annotations: edit }
);

function callLumina(tool, args) {
  let c; try { c = JSON.parse(fs.readFileSync(controlFile(), 'utf8')); } catch { return Promise.resolve({ ok: false, error: OFF }); }
  if (!c.enabled || !c.port || !c.key) return Promise.resolve({ ok: false, error: OFF });
  const body = JSON.stringify({ tool, args });
  return new Promise(done => {
    const req = http.request({ host: '127.0.0.1', port: c.port, path: '/call', method: 'POST', timeout: { auto_captions: 1800000, export_video: 10800000 }[tool] || 120000,
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body), 'X-Lumina-Key': c.key } }, res => {
      let text = ''; res.setEncoding('utf8');
      res.on('data', d => text += d);
      res.on('end', () => { try { done(JSON.parse(text)); } catch { done({ ok: false, error: `Lumina answered something unexpected (HTTP ${res.statusCode}).` }); } });
    });
    req.on('timeout', () => req.destroy(new Error('Lumina took too long to answer.')));
    req.on('error', e => done({ ok: false, error: e.code === 'ECONNREFUSED' ? OFF : String(e.message || e) }));
    req.end(body);
  });
}

async function toolCall(name, args) {
  if (!TOOLS.some(t => t.name === name)) return { content: [{ type: 'text', text: `Lumina has no tool called "${name}".` }], isError: true };
  const r = await callLumina(name, args || {});
  if (!r || !r.ok) return { content: [{ type: 'text', text: (r && r.error) || 'Lumina did not answer.' }], isError: true };
  const res = r.result, content = [];
  if (res && res.__image) { const { __image, ...rest } = res; content.push({ type: 'image', data: __image.data, mimeType: __image.mimeType }, { type: 'text', text: JSON.stringify(rest) }); }
  else content.push({ type: 'text', text: JSON.stringify(res, null, 1) });
  return { content };
}

async function handle(msg) {
  const { id, method, params = {} } = msg;
  switch (method) {
    case 'initialize': return {
      protocolVersion: PROTOCOLS.includes(params.protocolVersion) ? params.protocolVersion : PROTOCOLS[0],
      capabilities: { tools: { listChanged: false } },
      serverInfo: { name: 'lumina', title: 'Lumina', version: VERSION },
      instructions: 'Tools for the project open in Lumina, a video and image editor on this computer. Start with get_project; use snapshot to see a frame. Every edit is one undo step, and the person sees it happen in Lumina.'
    };
    case 'ping': return {};
    case 'tools/list': return { tools: TOOLS };
    case 'tools/call': return toolCall(params.name, params.arguments);
    default: { const e = new Error(`Unknown method: ${method}`); e.code = -32601; throw e; }
  }
}

const send = m => process.stdout.write(JSON.stringify(m) + '\n');
readline.createInterface({ input: process.stdin }).on('line', async line => {
  if (!line.trim()) return;
  let msg; try { msg = JSON.parse(line); } catch { return send({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } }); }
  if (msg.id === undefined || msg.id === null) return;   // a notification (e.g. notifications/initialized): nothing to answer
  try { send({ jsonrpc: '2.0', id: msg.id, result: await handle(msg) }); }
  catch (e) { send({ jsonrpc: '2.0', id: msg.id, error: { code: e.code || -32603, message: String(e.message || e) } }); }
});
