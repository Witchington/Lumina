// Spike: can Lumina run a WGSL compute shader and draw the result into its 2D canvas, synchronously enough for render()?
(async () => {
  const R = {};
  try {
    R.hasGPU = !!navigator.gpu;
    const ad = navigator.gpu && await navigator.gpu.requestAdapter({ powerPreference: 'high-performance' });
    R.adapter = !!ad;
    if (!ad) return R;
    R.info = ad.info ? { vendor: ad.info.vendor, arch: ad.info.architecture, desc: ad.info.description } : null;
    R.features = [...ad.features].filter(f => /float32|shader-f16|timestamp/.test(f));
    R.limits = { tex: ad.limits.maxTextureDimension2D, storageTex: ad.limits.maxStorageTexturesPerShaderStage, wg: ad.limits.maxComputeWorkgroupSizeX };
    const dev = await ad.requestDevice({ requiredFeatures: ad.features.has('float32-filterable') ? ['float32-filterable'] : [] });
    const w = 256, h = 128;
    const code = `@group(0) @binding(0) var src: texture_2d<f32>;
      @group(0) @binding(1) var out: texture_storage_2d<rgba32float, write>;
      @compute @workgroup_size(16,16) fn main(@builtin(global_invocation_id) g: vec3<u32>) {
        if (g.x >= ${w}u || g.y >= ${h}u) { return; }
        let c = textureLoad(src, vec2<i32>(g.xy), 0);
        textureStore(out, vec2<i32>(g.xy), vec4<f32>(1.0 - c.rgb, 1.0));
      }`;
    const mod = dev.createShaderModule({ code }); const ci = await mod.getCompilationInfo(); R.compileMsgs = ci.messages.length;
    const pipe = dev.createComputePipeline({ layout: 'auto', compute: { module: mod, entryPoint: 'main' } });
    // source: a 2D canvas, red left / blue right
    const sc = document.createElement('canvas'); sc.width = w; sc.height = h; const sx = sc.getContext('2d');
    sx.fillStyle = '#ff0000'; sx.fillRect(0, 0, w / 2, h); sx.fillStyle = '#0000ff'; sx.fillRect(w / 2, 0, w / 2, h);
    const tin = dev.createTexture({ size: [w, h], format: 'rgba8unorm', usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT });
    const tout = dev.createTexture({ size: [w, h], format: 'rgba32float', usage: GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.TEXTURE_BINDING });
    // display: a webgpu canvas we blit the float result into
    const gc = document.createElement('canvas'); gc.width = w; gc.height = h; const gctx = gc.getContext('webgpu');
    const fmt = navigator.gpu.getPreferredCanvasFormat(); gctx.configure({ device: dev, format: fmt, alphaMode: 'premultiplied' });
    const blit = dev.createShaderModule({ code: `@group(0) @binding(0) var t: texture_2d<f32>;
      @vertex fn vs(@builtin(vertex_index) i: u32) -> @builtin(position) vec4<f32> { let p = array(vec2(-1.0,-1.0), vec2(3.0,-1.0), vec2(-1.0,3.0)); return vec4(p[i], 0.0, 1.0); }
      @fragment fn fs(@builtin(position) p: vec4<f32>) -> @location(0) vec4<f32> { return textureLoad(t, vec2<i32>(p.xy), 0); }` });
    const bp = dev.createRenderPipeline({ layout: 'auto', vertex: { module: blit, entryPoint: 'vs' }, fragment: { module: blit, entryPoint: 'fs', targets: [{ format: fmt }] } });
    const run = () => {
      dev.queue.copyExternalImageToTexture({ source: sc }, { texture: tin }, [w, h]);
      const enc = dev.createCommandEncoder();
      const p = enc.beginComputePass(); p.setPipeline(pipe);
      p.setBindGroup(0, dev.createBindGroup({ layout: pipe.getBindGroupLayout(0), entries: [{ binding: 0, resource: tin.createView() }, { binding: 1, resource: tout.createView() }] }));
      p.dispatchWorkgroups(Math.ceil(w / 16), Math.ceil(h / 16)); p.end();
      const r = enc.beginRenderPass({ colorAttachments: [{ view: gctx.getCurrentTexture().createView(), loadOp: 'clear', clearValue: [0, 0, 0, 0], storeOp: 'store' }] });
      r.setPipeline(bp); r.setBindGroup(0, dev.createBindGroup({ layout: bp.getBindGroupLayout(0), entries: [{ binding: 0, resource: tout.createView() }] })); r.draw(3); r.end();
      dev.queue.submit([enc.finish()]);
    };
    // the key question: drawn in the same task, does the 2D canvas see the new pixels?
    const dc = document.createElement('canvas'); dc.width = w; dc.height = h; const dx = dc.getContext('2d', { willReadFrequently: true });
    run(); dx.drawImage(gc, 0, 0);
    R.sameTask = { left: [...dx.getImageData(10, 10, 1, 1).data].join(), right: [...dx.getImageData(w - 10, 10, 1, 1).data].join() };
    // change the source and run again in the same task: no stale frame?
    sx.fillStyle = '#00ff00'; sx.fillRect(0, 0, w, h); run(); dx.drawImage(gc, 0, 0);
    R.secondFrame = [...dx.getImageData(10, 10, 1, 1).data].join();
    // speed: 200 frames at 1920x1080 would be the real test; here 100 runs at this size
    const t0 = performance.now(); for (let i = 0; i < 100; i++) { run(); dx.drawImage(gc, 0, 0); } dx.getImageData(0, 0, 1, 1); R.ms100 = Math.round(performance.now() - t0);
    R.errors = window.__errs || [];
  } catch (e) { R.error = String(e && e.stack || e); }
  return R;
})()
