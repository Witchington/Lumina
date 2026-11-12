// Channel effects for Lumina (EffectCraft Round 24). Minimax's passes (channel::minimax / fx_noise's minimax host): a
// 1-D minimum or maximum of straight-colour planes. EffectCraft's buffer is the layer itself, padded with empty pixels
// (or, with Don't Shrink Edges, repeating its edge pixels); Lumina's working image is the whole frame, so the box
// here is the frame (reads past it are empty) or the layer's on-screen box (reads clamped into it). Ported from
// EffectCraft's crates/effects/src/channel.rs and crates/gpu/src/fx_noise.rs (MIT licence). Compiles after
// EffectCraft's common.wgsl and kernels.wgsl. Names lc_.

// u[0] = (radius, vertical, clamp into the box, _); u[1] = per channel (0 minimum, 1 maximum, 2 keep);
// f[0] = the box (x0, y0, x1, y1), inclusive pixels.
@compute @workgroup_size(16, 16)
fn lc_morph(@builtin(global_invocation_id) gid: vec3<u32>) {
    let d = out_dims();
    let p = vec2<i32>(gid.xy);
    if (p.x >= d.x || p.y >= d.y) {
        return;
    }
    let r = i32(P.u[0].x);
    let vertical = P.u[0].y != 0u;
    let clamped = P.u[0].z != 0u;
    let lo_b = vec2<i32>(P.f[0].xy);
    let hi_b = vec2<i32>(P.f[0].zw);
    // the kept channels are the pixel's own; the window (k = 0 included) gives the minimum and maximum
    var lo = vec4<f32>(3.0e38);
    var hi = vec4<f32>(-3.0e38);
    for (var k = -r; k <= r; k++) {
        var q = p;
        if (vertical) {
            q.y += k;
        } else {
            q.x += k;
        }
        var v = vec4<f32>(0.0);
        if (clamped) {
            v = textureLoad(src, clamp(q, lo_b, hi_b), 0);
        } else if (all(q >= lo_b) && all(q <= hi_b)) {
            v = textureLoad(src, q, 0);
        }
        lo = min(lo, v);
        hi = max(hi, v);
    }
    var o = textureLoad(src, p, 0);
    for (var c = 0; c < 4; c++) {
        if (P.u[1][c] == 0u) {
            o[c] = lo[c];
        } else if (P.u[1][c] == 1u) {
            o[c] = hi[c];
        }
    }
    textureStore(out, p, o);
}
