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

// what Claude sees. M1 only looks: nothing here changes the project.
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

function callLumina(tool, args) {
  let c; try { c = JSON.parse(fs.readFileSync(controlFile(), 'utf8')); } catch { return Promise.resolve({ ok: false, error: OFF }); }
  if (!c.enabled || !c.port || !c.key) return Promise.resolve({ ok: false, error: OFF });
  const body = JSON.stringify({ tool, args });
  return new Promise(done => {
    const req = http.request({ host: '127.0.0.1', port: c.port, path: '/call', method: 'POST', timeout: 120000,
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
      instructions: 'Tools for looking at the project open in Lumina, a video and image editor on this computer. Start with get_project; use snapshot to see a frame.'
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
