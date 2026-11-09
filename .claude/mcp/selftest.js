// Claude control test (MCP step M1): LuminaAPI's four read-only tools, the Edit menu switch and status light, and
// electron/mcp.js started the way Claude Code starts it (Lumina.exe with ELECTRON_RUN_AS_NODE), talking JSON-RPC over
// stdio to the local door. Off by default, refuses a wrong key and web pages, and looking never changes the project.
(async () => {
  const R = { steps: {} }, step = (k, v) => R.steps[k] = v;
  try {
    S.global.vignette = 0;
    // ---- a small project: a black background, a text layer with a keyframe, an orange shape with an effect
    S.layers = []; for (const k in RT) delete RT[k]; clearMulti(); S.global.bg = 'black'; seek(0); refresh();
    addShape('star'); const SH = selLayer(); SH.dur = 6; addFX(SH, 'brightness'); SH.p[fxKey(SH.fx[0], 'brightness')] = 40;
    seek(0); addText(); const TX = selLayer(); TX.text = 'HELLO'; TX.dur = 6; TX.keys.opacity = [{ t: 0, v: 0 }, { t: 1, v: 1 }];
    commit(); seek(2); refresh(); await settle(2);
    const before = JSON.stringify(S.layers), t0 = S.time, undoLen = undoStack.length;

    // ---- 1. the switch and the light: off at the start, in the Edit menu
    const g0 = await lumina.claudeGet();
    const editItem = MENUS.Edit().find(it => Array.isArray(it) && it[0] === 'Allow Claude to control Lumina');
    step('switch', { offAtStart: g0.enabled === false, inEditMenu: !!editItem, unticked: editItem?.[4] === false, lightHidden: $('#claudeLight').hidden === true });

    // ---- 2. the tools straight in the page
    const P = await LuminaAPI.call('get_project', {});
    const L = await LuminaAPI.call('get_layer', { id: SH.id }), T = await LuminaAPI.call('get_layer', { id: TX.id });
    const E1 = await LuminaAPI.call('list_effects', {}), E2 = await LuminaAPI.call('list_effects', { query: 'key' }), E3 = await LuminaAPI.call('list_effects', { id: 'brightness' });
    const bad = await LuminaAPI.call('get_layer', { id: 99999 }), nope = await LuminaAPI.call('delete_everything', {});
    const snap = await LuminaAPI.call('snapshot', { time: 4, max_width: 320 });
    const png = snap.result?.__image?.data || '', img = new Image();
    if (png) { img.src = 'data:image/png;base64,' + png; await img.decode(); }
    const ic = document.createElement('canvas'); ic.width = img.width || 1; ic.height = img.height || 1; const ix = ic.getContext('2d'); if (png) ix.drawImage(img, 0, 0);
    const midPx = [...ix.getImageData(ic.width >> 1, ic.height >> 1, 1, 1).data].slice(0, 3), cornerPx = [...ix.getImageData(2, 2, 1, 1).data].slice(0, 3);
    step('tools', {
      project: P.ok && P.result.layers.length === 2 && P.result.width === W() && P.result.fps === S.fps && P.result.layers[0].id === TX.id && P.result.playhead === 2,
      projectEffects: P.ok && P.result.layers[1].effects[0] === 'Brightness & Contrast',
      layer: L.ok && L.result.kind === 'shape' && L.result.shape === 'star' && L.result.effects[0]?.id === 'brightness' && L.result.effects[0].settings.brightness === 40,
      textLayer: T.ok && T.result.text === 'HELLO' && T.result.keyframes.opacity?.length === 2 && T.result.keyframes.opacity[1].v === 1,
      effectsListed: E1.ok && E1.result.count === Object.keys(FX).length && Object.keys(E1.result.groups).length > 5,
      search: E2.ok && E2.result.count > 3 && E2.result.count < E1.result.count, effectCount: E1.result?.count,
      oneEffect: E3.ok && E3.result.name === 'Brightness & Contrast' && E3.result.settings.some(s => s.id === 'brightness' && s.min === -150),
      badLayerSaysWhy: !bad.ok && /no layer with id 99999/.test(bad.error), unknownTool: !nope.ok && /no tool/.test(nope.error),
      snapshot: snap.ok && snap.result.time === 4 && snap.result.width === 320 && img.width === 320 && Math.abs(img.height - 180) <= 1,
      snapshotShows: { mid: midPx, corner: cornerPx, ok: midPx[0] > 150 && cornerPx.every(v => v < 30) },
      playheadBack: S.time === t0,
      unchanged: JSON.stringify(S.layers) === before && undoStack.length === undoLen
    });

    // ---- 3. mcp.js while the switch is off: it starts and lists tools, but calls say how to turn it on
    const init = { jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'selftest', version: '1' } } };
    const off = await lumina.claudeProbe({ want: 3, lines: [init, { jsonrpc: '2.0', method: 'notifications/initialized' },
      { jsonrpc: '2.0', id: 2, method: 'tools/list' }, { jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'get_project', arguments: {} } }] });
    const o = id => off.replies.find(r => r.id === id);
    step('mcpOff', {
      initialize: o(1)?.result?.serverInfo?.name === 'lumina' && o(1).result.protocolVersion === '2025-06-18' && !!o(1).result.capabilities?.tools,
      tools: (o(2)?.result?.tools || []).map(t => t.name).join(), allReadOnly: (o(2)?.result?.tools || []).every(t => t.annotations?.readOnlyHint === true),
      saysTurnOn: o(3)?.result?.isError === true && /Allow Claude to control Lumina/.test(o(3).result.content[0].text),
      onlyJsonOut: off.replies.every(r => !r.notJson), stderr: off.stderr
    });

    // ---- 4. switch on: the light shows; the full conversation through the door
    await setClaude(true); await new Promise(r => setTimeout(r, 200));
    const g1 = await lumina.claudeGet();
    const on = await lumina.claudeProbe({ want: 9, lines: [init, { jsonrpc: '2.0', method: 'notifications/initialized' },
      { jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: 'get_project', arguments: {} } },
      { jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'get_layer', arguments: { id: SH.id } } },
      { jsonrpc: '2.0', id: 4, method: 'tools/call', params: { name: 'list_effects', arguments: { id: 'brightness' } } },
      { jsonrpc: '2.0', id: 5, method: 'tools/call', params: { name: 'snapshot', arguments: { time: 1, max_width: 200 } } },
      { jsonrpc: '2.0', id: 6, method: 'tools/call', params: { name: 'no_such_tool', arguments: {} } },
      { jsonrpc: '2.0', id: 7, method: 'what/ever' }, { jsonrpc: '2.0', id: 8, method: 'ping' }, 'this is not json'] });
    const a = id => on.replies.find(r => r.id === id), txt = id => { try { return JSON.parse(a(id).result.content.find(c => c.type === 'text').text); } catch { return null; } };
    const sImg = a(5)?.result?.content?.find(c => c.type === 'image');
    step('mcpOn', {
      switchOn: g1.enabled === true && g1.port > 0, menuTicked: MENUS.Edit().find(it => Array.isArray(it) && it[0] === 'Allow Claude to control Lumina')?.[4] === true,
      lightShown: $('#claudeLight').hidden === false,
      project: txt(2)?.layers?.length === 2 && txt(2).name === projectName(), layer: txt(3)?.effects?.[0]?.settings?.brightness === 40,
      effect: txt(4)?.name === 'Brightness & Contrast',
      image: sImg?.mimeType === 'image/png' && sImg.data.length > 500 && txt(5)?.width === 200,
      unknownTool: a(6)?.result?.isError === true, unknownMethod: a(7)?.error?.code === -32601, ping: !!a(8)?.result,
      parseError: on.replies.some(r => r.id === null && r.error?.code === -32700),
      onlyJsonOut: on.replies.every(r => !r.notJson), stderr: on.stderr,
      stillUnchanged: JSON.stringify(S.layers) === before && S.time === t0
    });

    // ---- 5. what is kept out: a wrong key, and a web page (it sends an Origin)
    const wrong = await lumina.claudeProbe({ want: 2, env: { wrongKey: true }, lines: [init, { jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: 'get_project', arguments: {} } }] });
    const w2 = wrong.replies.find(r => r.id === 2);
    let web = 'no answer';
    try { const res = await fetch(`http://127.0.0.1:${g1.port}/call`, { method: 'POST', body: '{"tool":"get_project"}' }); web = res.status; } catch (e) { web = 'blocked: ' + e.message; }
    step('keptOut', { wrongKey: w2?.result?.isError === true && /Wrong or missing key/.test(w2.result.content[0].text), webPage: web, webRefused: web !== 200 });

    // ---- 6. switch off again: the door closes
    await setClaude(false);
    const after = await lumina.claudeProbe({ want: 2, lines: [init, { jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: 'get_project', arguments: {} } }] });
    const f2 = after.replies.find(r => r.id === 2);
    step('offAgain', { switchOff: (await lumina.claudeGet()).enabled === false, lightHidden: $('#claudeLight').hidden === true,
      refused: f2?.result?.isError === true && /Allow Claude to control Lumina/.test(f2.result.content[0].text) });

    const flat = []; (function walk(o, p) { for (const [k, v] of Object.entries(o)) { if (v === false) flat.push(p + k); else if (v && typeof v === 'object' && !Array.isArray(v)) walk(v, p + k + '.'); } })(R.steps, '');
    R.falses = flat;
  } catch (e) { R.error = String(e.stack || e); }
  try { await lumina.claudeSet(false); } catch { }
  return R;
})()
