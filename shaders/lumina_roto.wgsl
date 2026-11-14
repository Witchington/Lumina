// Roto Brush & Refine Edge for Lumina (EffectCraft Round 31): the matte, worked out on the layer's own pixel grid by
// workers/roto.js, laid back over the frame. EffectCraft multiplies its layer buffer by the matte and writes the
// decontaminated edge colours (crates/effects/src/roto.rs, render; MIT licence); Lumina's working image is the whole
// frame with the layer placed in it, so each frame pixel finds its place on the layer grid through the layer's matrix.
// Compiles after EffectCraft's common.wgsl and kernels.wgsl. Names lr_.

// u[0] = (mode: 0 the matted layer, 1 the decontamination map, gw, gh); u[1].x = decontaminated colours on;
// f[0], f[1] = the frame pixel → grid pixel rows (x, y, 1); aux = the grid (gw × gh, 8 bits): rgb the edge colour of a
// partly see-through pixel (or the map), a the matte.
fn lr_alpha(g: vec2<f32>, gw: i32, gh: i32) -> f32 {
    // bilinear, pixel centres at +0.5, clamped at the grid's edges (matting::sample)
    let fx = clamp(g.x - 0.5, 0.0, f32(gw - 1));
    let fy = clamp(g.y - 0.5, 0.0, f32(gh - 1));
    let x0 = i32(floor(fx));
    let y0 = i32(floor(fy));
    let x1 = min(x0 + 1, gw - 1);
    let y1 = min(y0 + 1, gh - 1);
    let tx = fx - f32(x0);
    let ty = fy - f32(y0);
    let a00 = textureLoad(aux, vec2<i32>(x0, y0), 0).w;
    let a10 = textureLoad(aux, vec2<i32>(x1, y0), 0).w;
    let a01 = textureLoad(aux, vec2<i32>(x0, y1), 0).w;
    let a11 = textureLoad(aux, vec2<i32>(x1, y1), 0).w;
    let top = a00 + (a10 - a00) * tx;
    let bot = a01 + (a11 - a01) * tx;
    return top + (bot - top) * ty;
}

@compute @workgroup_size(16, 16)
fn lr_apply(@builtin(global_invocation_id) gid: vec3<u32>) {
    let d = out_dims();
    let p = vec2<i32>(gid.xy);
    if (p.x >= d.x || p.y >= d.y) {
        return;
    }
    let mode = P.u[0].x;
    let gw = i32(P.u[0].z);
    let gh = i32(P.u[0].w);
    let fp = vec3<f32>(f32(p.x) + 0.5, f32(p.y) + 0.5, 1.0);
    let g = vec2<f32>(dot(P.f[0].xyz, fp), dot(P.f[1].xyz, fp));
    // off the layer's grid: nothing
    if (g.x < 0.0 || g.y < 0.0 || g.x > f32(gw) || g.y > f32(gh) || gw < 1 || gh < 1) {
        textureStore(out, p, vec4<f32>(0.0));
        return;
    }
    let n = textureLoad(aux, vec2<i32>(clamp(i32(floor(g.x)), 0, gw - 1), clamp(i32(floor(g.y)), 0, gh - 1)), 0);
    if (mode == 1u) {
        // View Decontamination Map: opaque grey over the layer's grid
        textureStore(out, p, vec4<f32>(n.xyz, 1.0));
        return;
    }
    let s = textureLoad(src, p, 0);
    let a = clamp(lr_alpha(g, gw, gh), 0.0, 1.0) * s.w;
    var c = s.xyz / max(s.w, 1e-6);
    // the decontaminated colour of a partly see-through pixel (8-bit alphas strictly between 0 and 255)
    if (P.u[1].x != 0u && n.w > 0.5 / 255.0 && n.w < 254.5 / 255.0) {
        c = n.xyz;
    }
    textureStore(out, p, vec4<f32>(c * a, a));
}
