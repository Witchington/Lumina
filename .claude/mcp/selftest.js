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
      tools: (o(2)?.result?.tools || []).map(t => t.name).join(), allReadOnly: (o(2)?.result?.tools || []).filter(t => ['get_project', 'get_layer', 'list_effects', 'snapshot'].includes(t.name)).every(t => t.annotations?.readOnlyHint === true),
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

    // ---- 7. M1b, Help › Connect Claude…: pretend Claude settings files in this test folder (never the real ones)
    const TF = lumina.claudeTestFile, CF = 'claude-desktop/claude_desktop_config.json';
    await TF({ name: 'claude-desktop', remove: true }); await TF({ name: 'claude-code.json', remove: true });
    const noApp = await lumina.claudeSetup();
    const seed = JSON.stringify({ mcpServers: { Other: { command: 'other.exe', args: ['x'] } }, preferences: { keep: 1 } }, null, 2);
    await TF({ name: CF, text: seed });
    const before1 = await lumina.claudeSetup(), added = await lumina.claudeDesktop(true);
    const cfg = JSON.parse(await TF({ name: CF })), backup = await TF({ name: CF + '.before-lumina' }), lu = cfg.mcpServers?.lumina;
    const checkOn = await lumina.claudeCli('--claude-check');
    // an entry from a Lumina in another folder: shown as older, and not "ours" for the uninstaller
    await TF({ name: CF, text: JSON.stringify({ ...cfg, mcpServers: { ...cfg.mcpServers, lumina: { command: 'C:\\Old\\Lumina.exe', args: ['C:\\Old\\mcp.js'], env: { ELECTRON_RUN_AS_NODE: '1' } } } }) });
    const stale = await lumina.claudeSetup(), checkStale = await lumina.claudeCli('--claude-check');
    const forgetStale = await lumina.claudeCli('--claude-forget'), stillThere = !!JSON.parse(await TF({ name: CF })).mcpServers.lumina;
    await lumina.claudeDesktop(true); const forget = await lumina.claudeCli('--claude-forget');
    const afterForget = JSON.parse(await TF({ name: CF })), checkOff = await lumina.claudeCli('--claude-check');
    // a settings file Lumina can't read is left exactly as it was
    await TF({ name: CF, text: '{ not json' }); let unreadMsg = '';
    try { await lumina.claudeDesktop(true); } catch (e) { unreadMsg = String(e.message || e); }
    const unread = await TF({ name: CF });
    await TF({ name: 'claude-code.json', text: JSON.stringify({ mcpServers: { lumina: { command: noApp.exe, args: [noApp.script] } } }) });
    const codeOk = (await lumina.claudeSetup()).code;
    step('connect', {
      noClaudeApp: noApp.desktop.length === 0, codeNotYet: noApp.code.has === false,
      codeLine: noApp.codeLine.includes('--scope user') && noApp.codeLine.includes('ELECTRON_RUN_AS_NODE=1') && noApp.codeLine.includes(noApp.exe) && /mcp\.js"$/.test(noApp.codeLine),
      foundApp: before1.desktop.length === 1 && before1.desktop[0].has === false,
      added: added.files.length === 1 && lu?.command === noApp.exe && lu?.args?.[0] === noApp.script && lu?.env?.ELECTRON_RUN_AS_NODE === '1',
      keptOthers: cfg.mcpServers.Other?.command === 'other.exe' && cfg.preferences?.keep === 1, backupIsOld: backup === seed,
      nowCurrent: added.desktop[0].current === true, checkSaysOurs: checkOn === 1,
      staleShown: stale.desktop[0].has === true && stale.desktop[0].current === false, staleNotOurs: checkStale === 0,
      forgetLeavesOthers: forgetStale === 0 && stillThere,
      forgot: forget === 0 && !afterForget.mcpServers.lumina && afterForget.mcpServers.Other?.command === 'other.exe' && afterForget.preferences?.keep === 1, checkAfter: checkOff === 0,
      unreadableLeftAlone: /couldn't be read/.test(unreadMsg) && unread === '{ not json', codeSeen: codeOk.has && codeOk.current
    });
    // the window, and its test button the way a friend would press it
    await TF({ name: CF, text: seed });
    await claudeBox(); const box = { open: !$('#modal').hidden && !!$('#ccBox'), line: $('#ccLine')?.value === noApp.codeLine, addBtn: !!$('#ccAdd'), helpItem: MENUS.Help().some(it => Array.isArray(it) && it[0] === 'Connect Claude…') };
    const tOff = await lumina.claudeTest(); $('#ccOn').checked = true; $('#ccOn').onchange({ target: $('#ccOn') }); await new Promise(r => setTimeout(r, 300));
    const tOn = await lumina.claudeTest();
    $('#ccTestBtn').click(); for (let i = 0; i < 50 && !/Working|can't|didn't/.test($('#ccTest').textContent); i++) await new Promise(r => setTimeout(r, 200));
    const shown = $('#ccTest').textContent; $('#mOk').click(); await setClaude(false);
    step('window', { ...box, testOffStarts: tOff.started && tOff.tools.length === 24 && !tOff.reached, testOnReaches: tOn.started && tOn.reached,
      buttonSaysWorking: /Working/.test(shown), shown, closed: $('#modal').hidden });
    await TF({ name: 'claude-desktop', remove: true }); await TF({ name: 'claude-code.json', remove: true });

    // ---- 8. M2 editing: each tool does its job, is exactly one undo step, and says why when it can't
    S.layers = []; for (const k in RT) delete RT[k]; clearMulti(); S.global.bg = 'black'; seek(0); undoStack.length = 0; redoStack.length = 0; commit(); refresh();
    const C = (n, a) => LuminaAPI.call(n, a);
    const one = async (n, a) => { const u = undoStack.length, r = await C(n, a); return { ...r, steps: undoStack.length - u }; };
    const sk = await one('seek', { time: 1 });
    const tx = await one('add_text', { text: 'Hi there', start: 2, duration: 4, x: .3, color: '#ff0000', animation: 'fade' });
    const TL = byId(tx.result?.id);
    const sh = await one('add_shape', { shape: 'heart', fill: '#00ff00', w: 300, h: 280 });
    const SL = byId(sh.result?.id);
    const so = await one('add_solid', { color: '#2040ff', start: 0, duration: 8 });
    const OL = byId(so.result?.id);
    step('add', { seek: sk.ok && S.time === 1 && sk.steps === 0,
      text: tx.ok && TL?.text === 'Hi there' && TL.start === 2 && TL.dur === 4 && TL.p.x === .3 && TL.color === '#ff0000' && TL.anim === 'fade' && tx.steps === 1,
      shape: sh.ok && SL?.shape === 'heart' && SL.fill === '#00ff00' && SL.p.w === 300 && SL.start === 1 && sh.steps === 1,
      solid: so.ok && OL?.fill === '#2040ff' && OL.p.w === W() && OL.p.h === H() && OL.dur === 8 && so.steps === 1,
      badShape: !(await C('add_shape', { shape: 'dragon' })).ok, badColor: /colour like/.test((await C('add_solid', { color: 'blue' })).error) });
    // properties and keyframes
    const p1 = await one('set_property', { id: TL.id, property: 'scale', value: 1.5 }), p2 = await one('set_property', { id: TL.id, property: 'text', value: 'Changed' });
    const p3 = await C('set_property', { id: TL.id, property: 'evil', value: 1 }), p4 = await C('set_property', { id: TL.id, property: 'opacity', value: 'lots' });
    const p5 = await C('set_property', { id: TL.id, property: 'visible', value: 'yes' });
    const k1 = await one('set_keyframe', { id: OL.id, property: 'opacity', time: 1, value: 0, ease: 'linear' }), k2 = await one('set_keyframe', { id: OL.id, property: 'opacity', time: 3, value: 1 });
    const mid = val(OL, 'opacity', 2), k3 = await one('set_keyframe', { id: OL.id, property: 'opacity', time: 3, remove: true });
    const k4 = await C('set_keyframe', { id: OL.id, property: 'opacity', time: 5, remove: true });
    seek(1); const p6 = await one('set_property', { id: OL.id, property: 'opacity', value: .4 });
    step('props', { scale: p1.ok && TL.p.scale === 1.5 && p1.steps === 1, text: p2.ok && TL.text === 'Changed' && p2.steps === 1,
      unknownRefused: !p3.ok && /can't be set/.test(p3.error), notANumber: !p4.ok && /must be a number/.test(p4.error), notABool: !p5.ok && /true or false/.test(p5.error),
      keys: k1.ok && k2.ok && OL.keys.opacity?.length === 1 && k1.steps === 1 && k2.steps === 1, midway: Math.abs(mid - .5) < 1e-6,
      removed: k3.ok && k3.steps === 1, noKeyThere: !k4.ok && /no opacity keyframe/.test(k4.error),
      setOnKeyed: p6.ok && p6.result.keyframed === true && OL.keys.opacity[0].v === .4 });
    // moving, trimming, splitting
    const m1 = await one('move', { id: TL.id, start: 3, order: S.layers.length - 1 }), mv = { start: TL.start, last: S.layers.at(-1) === TL };
    const t1 = await one('trim', { id: TL.id, start: 3.5, end: 6 }), tr = { start: TL.start, end: endOf(TL) };
    const s1 = await one('split', { id: TL.id, time: 5 }), B2 = byId(s1.result?.second), s2 = await C('split', { id: TL.id, time: 99 });
    step('timing', { move: m1.ok && mv.start === 3 && mv.last && m1.steps === 1,
      trim: t1.ok && Math.abs(tr.start - 3.5) < 1e-6 && Math.abs(tr.end - 6) < 1e-6 && t1.steps === 1,
      split: s1.ok && !!B2 && Math.abs(endOf(TL) - 5) < 1e-6 && Math.abs(B2.start - 5) < 1e-6 && Math.abs(endOf(B2) - 6) < 1e-6 && s1.steps === 1,
      outside: !s2.ok && /not inside/.test(s2.error) });
    // effects
    const e1 = await one('add_effect', { id: SL.id, effect: 'brightness' }), e1fx = SL.fx?.[0]?.id, e2 = await one('set_effect', { id: SL.id, index: 0, settings: { brightness: 30, legacy: true } });
    const e3 = await C('set_effect', { id: SL.id, index: 0, settings: { sparkle: 1 } }), e4 = await C('set_effect', { id: SL.id, index: 5, settings: {} });
    const e5 = await one('set_effect', { id: SL.id, index: 0, on: false }), e6 = await C('add_effect', { id: SL.id, effect: 'nope' });
    const e7 = await one('remove_effect', { id: SL.id, index: 0 });
    step('effects', { add: e1.ok && e1fx === 'brightness' && e1.steps === 1,
      set: e2.ok && e2.result.settings.brightness === 30 && e2.result.settings.legacy === true && e2.steps === 1, badSetting: !e3.ok && /no setting "sparkle"/.test(e3.error),
      badIndex: !e4.ok && /no effect at index 5/.test(e4.error), off: e5.ok && e5.result.on === false, badEffect: !e6.ok, remove: e7.ok && !(SL.fx || []).length && e7.steps === 1 });
    // locked layers, delete, undo / redo
    SL.locked = true; const lk = await C('move', { id: SL.id, start: 0 }); SL.locked = false;
    const n0 = S.layers.length, d1 = await one('delete_layer', { id: OL.id }), gone = !byId(OL.id);
    const u1 = await C('undo', {}), back = !!byId(OL.id), r1 = await C('redo', {}), again = !byId(OL.id);
    step('deleteUndo', { locked: !lk.ok && /locked/.test(lk.error), deleted: d1.ok && gone && S.layers.length === n0 - 1 && d1.steps === 1,
      undo: u1.ok && u1.result.undone && back, redo: r1.ok && r1.result.redone && again });
    // through Claude's own path: the 19 tools, an edit, and a look at the result
    await setClaude(true);
    const m2 = await lumina.claudeProbe({ want: 4, lines: [init, { jsonrpc: '2.0', id: 2, method: 'tools/list' },
      { jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'add_solid', arguments: { color: '#ff0000', start: 0, duration: 5 } } },
      { jsonrpc: '2.0', id: 4, method: 'tools/call', params: { name: 'snapshot', arguments: { time: 2.5, max_width: 160 } } }] });
    await setClaude(false);
    const b = id => m2.replies.find(r => r.id === id), names = (b(2)?.result?.tools || []).map(t => t.name);
    const img2 = b(4)?.result?.content?.find(c => c.type === 'image'); let red = null;
    if (img2) { const im = new Image(); im.src = 'data:image/png;base64,' + img2.data; await im.decode(); const c2 = document.createElement('canvas'); c2.width = im.width; c2.height = im.height; const x2 = c2.getContext('2d'); x2.drawImage(im, 0, 0); red = [...x2.getImageData(4, 4, 1, 1).data].slice(0, 3); }
    step('viaClaude', { tools: names.length === 24, toolNames: names.join(), editTools: names.includes('set_keyframe') && names.includes('undo'),
      editsMarked: (b(2)?.result?.tools || []).filter(t => t.annotations?.readOnlyHint === false).length === 20,
      added: !b(3)?.result?.isError, redFrame: !!red && red[0] > 200 && red[1] < 40 && red[2] < 40, red });

    // ---- 9. M3 media: files are copied into this test folder first, so edit copies land here, not in other suites
    S.layers = []; for (const k in RT) delete RT[k]; clearMulti(); seek(0); undoStack.length = 0; redoStack.length = 0; commit(); refresh();
    const SRC = 'D:\\Lumina\\.claude\\speed\\media\\', HERE = 'D:\\Lumina\\.claude\\mcp\\media\\';
    await TF({ name: 'media', remove: true });
    const vid = await TF({ name: 'media/clip2.webm', copyFrom: SRC + 'clip2.webm' }), pic = await TF({ name: 'media/red.png', copyFrom: SRC + 'red.png' });
    const wavP = await TF({ name: 'media/speech.wav', copyFrom: SRC + 'speech.wav' }), junk = await TF({ name: 'media/notes.webm', copyFrom: SRC + 'list.html' });
    await TF({ name: 'media/caps.srt', text: '1\n00:00:01,000 --> 00:00:02,500\nFirst line\n\n2\n00:00:03,000 --> 00:00:04,000\nSecond line\n' });
    const i1 = await one('import_media', { path: vid, start: 1 }), V = byId(i1.result?.id);
    const i2 = await one('import_media', { path: pic }), PIC = byId(i2.result?.id);
    const i3 = await C('import_media', { path: HERE + 'missing.mp4' }), i4 = await C('import_media', { path: 'clip.mp4' });
    const tJ = performance.now(), i5 = await C('import_media', { path: junk }), junkSecs = +((performance.now() - tJ) / 1000).toFixed(1);
    step('import', { video: i1.ok && V?.kind === 'video' && V.start === 1 && MEDIA[V.media]?.path === vid && i1.steps === 1 || i1.error,
      picture: i2.ok && PIC?.kind === 'image' && i2.steps === 1 || i2.error,
      missing: !i3.ok && /no file at/.test(i3.error), notFull: !i4.ok && /full path/.test(i4.error), unreadable: !i5.ok && /couldn't read/.test(i5.error), junkSecs,
      inProject: (await C('get_project', {})).result.media.some(m => m.path === vid) });
    // another clip of the same file, and captions
    const pm = await one('place_media', { media: V.media, start: 6, in: .5, out: 1.5 }), PM = byId(pm.result?.id), pmBad = await C('place_media', { media: 9999 });
    const c1 = await one('import_captions', { path: HERE + 'caps.srt', start: 2 }), CL = byId(c1.result?.id);
    const c2 = await one('import_media', { path: HERE + 'caps.srt' }), c3 = await C('import_captions', { path: pic });
    const gl = await C('get_layer', { id: CL?.id });
    step('placeCaptions', { place: pm.ok && PM?.media === V.media && PM.start === 6 && Math.abs(len(PM) - 1) < 1e-6 && pm.steps === 1, badMedia: !pmBad.ok && /no imported file/.test(pmBad.error),
      captions: c1.ok && CL?.cues?.length === 2 && CL.start === 2 && c1.steps === 1 || c1.error, viaImport: c2.ok && c2.result.lines === 2, notCaptions: !c3.ok && /srt or \.vtt/.test(c3.error),
      listed: gl.ok && gl.result.captions?.[1]?.text === 'Second line' && gl.result.captions[0].t0 === 3 });
    // auto captions: only with the speech model already downloaded (Claude never starts that download)
    const ia = await C('import_media', { path: wavP }), A = byId(ia.result?.id), ready = (await lumina.speechStatus()).ready;
    const ac0 = await C('auto_captions', { id: PIC.id }), acL = await C('auto_captions', { id: A.id, language: 'klingon' });
    const tA = performance.now(), ac = await one('auto_captions', { id: A.id, language: 'english' }), acSecs = +((performance.now() - tA) / 1000).toFixed(1);
    step('autoCaptions', { modelReady: ready, notSound: !ac0.ok && /no sound/.test(ac0.error), badLang: !acL.ok && /language must be/.test(acL.error),
      made: ready ? ac.ok && ac.result.lines > 0 && ac.steps === 1 : !ac.ok && /isn't downloaded/.test(ac.error), acSecs, lines: ac.result?.lines, langBack: acLang === 'auto' });
    // edit copy: starts, runs in the background, and every clip of that file switches to it
    const o0 = await C('optimize', { id: PIC.id }), o1 = await C('optimize', { id: V.id });
    let st = null; for (let i = 0; i < 300; i++) { st = (await C('get_layer', { id: V.id })).result.media.editCopy; if (st === 'ready') break; await new Promise(r => setTimeout(r, 200)); }
    const copyPath = MEDIA[V.media].path, o2 = await C('optimize', { id: V.id });
    step('optimize', { notVideo: !o0.ok && /isn't a video/.test(o0.error), started: o1.ok && o1.result.editCopy === 'making' || o1.error, ready: st === 'ready',
      copyNextToOriginal: /clip2 \(edit copy\)\.mp4$/.test(copyPath) && copyPath.startsWith(HERE), placedToo: MEDIA[PM.media].path === copyPath, again: o2.result?.editCopy === 'ready' });
    // undo takes an import back off
    const nL = S.layers.length; await C('undo', {}); const undone = S.layers.length === nL - 1;
    step('importUndo', { undone });
    S.layers = []; for (const k in RT) { RT[k].el?.pause?.(); delete RT[k]; } refresh(); await new Promise(r => setTimeout(r, 300));
    await TF({ name: 'media', remove: true });

    const flat = []; (function walk(o, p) { for (const [k, v] of Object.entries(o)) { if (v === false) flat.push(p + k); else if (v && typeof v === 'object' && !Array.isArray(v)) walk(v, p + k + '.'); } })(R.steps, '');
    R.falses = flat;
  } catch (e) { R.error = String(e.stack || e); }
  try { await lumina.claudeSet(false); } catch { }
  return R;
})()
