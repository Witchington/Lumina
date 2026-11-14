// 3D Camera Tracker for Lumina (EffectCraft Round 32): Undistort Footage. EffectCraft resamples the layer buffer through
// the solved radial lens distortion (crates/effects/src/camera_tracker.rs, undistort; MIT licence): every output pixel
// shows the footage at its distorted position, transparent where that falls outside the layer. Lumina's working image
// is the whole frame with the layer placed in it, so each frame pixel finds its layer pixel through the layer's matrix.
// Compiles after EffectCraft's common.wgsl and kernels.wgsl. Names lct_.

// u[0] = (gw, gh, _, _); f[0], f[1] = frame pixel → grid pixel rows; f[2], f[3] = grid pixel → frame pixel rows;
// f[4] = (grid pixels a layer pixel, k1, k2, normalisation radius in layer pixels); f[5] = (centre x, y, layer w, h)
fn lct_src(q: vec2<f32>, d: vec2<i32>) -> vec4<f32> {
    // bilinear, pixel centres at +0.5, clamped at the image's edges
    let fx = clamp(q.x - 0.5, 0.0, f32(d.x - 1));
    let fy = clamp(q.y - 0.5, 0.0, f32(d.y - 1));
    let x0 = i32(floor(fx));
    let y0 = i32(floor(fy));
    let x1 = min(x0 + 1, d.x - 1);
    let y1 = min(y0 + 1, d.y - 1);
    let tx = fx - f32(x0);
    let ty = fy - f32(y0);
    let a = textureLoad(src, vec2<i32>(x0, y0), 0);
    let b = textureLoad(src, vec2<i32>(x1, y0), 0);
    let c = textureLoad(src, vec2<i32>(x0, y1), 0);
    let e = textureLoad(src, vec2<i32>(x1, y1), 0);
    return mix(mix(a, b, tx), mix(c, e, tx), ty);
}

@compute @workgroup_size(16, 16)
fn lct_undistort(@builtin(global_invocation_id) gid: vec3<u32>) {
    let d = out_dims();
    let p = vec2<i32>(gid.xy);
    if (p.x >= d.x || p.y >= d.y) {
        return;
    }
    let fp = vec3<f32>(f32(p.x) + 0.5, f32(p.y) + 0.5, 1.0);
    let g = vec2<f32>(dot(P.f[0].xyz, fp), dot(P.f[1].xyz, fp));
    let gs = max(P.f[4].x, 1e-6);
    let l = g / gs;
    let size = P.f[5].zw;
    // off the layer: nothing there
    if (l.x < 0.0 || l.y < 0.0 || l.x > size.x || l.y > size.y) {
        textureStore(out, p, vec4<f32>(0.0));
        return;
    }
    // ideal → distorted, about the principal point (Distortion::distort)
    let c = P.f[5].xy;
    let rel = l - c;
    let rad = max(P.f[4].w, 1e-6);
    let r2 = dot(rel, rel) / (rad * rad);
    let q = c + rel * (1.0 + P.f[4].y * r2 + P.f[4].z * r2 * r2);
    if (q.x < 0.0 || q.y < 0.0 || q.x > size.x || q.y > size.y) {
        textureStore(out, p, vec4<f32>(0.0));
        return;
    }
    let gq = vec3<f32>(q * gs, 1.0);
    let f = vec2<f32>(dot(P.f[2].xyz, gq), dot(P.f[3].xyz, gq));
    textureStore(out, p, lct_src(f, d));
}
