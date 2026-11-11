// Noise & Grain for Lumina (EffectCraft Round 21): the steps EffectCraft does only on the CPU. Add Grain / Match Grain's
// Blending Matte (GrainLook::weight), the Noise Samples boxes (noise::draw_boxes), Match Grain's planes read out for
// their mean and spread, and the planes normalised (noise2::match_grain). Ported from EffectCraft's
// crates/effects/src/noise.rs and noise2.rs (MIT licence). Compiles after EffectCraft's common.wgsl, kernels.wgsl and
// fx_generate.wgsl (gen_unpremul, gen_smoothstep). Colours are premultiplied, 0..1. Names ln_.

fn ln_pixel(gid: vec3<u32>) -> vec2<i32> {
    let d = out_dims();
    let p = vec2<i32>(gid.xy);
    if (p.x >= d.x || p.y >= d.y) {
        return vec2<i32>(-1);
    }
    return p;
}

// Blending Matte: the grain's tonal weight at each pixel's straight colour, as grey (alpha 1).
// f[0].x = midpoint; f[1].xyz = shadows, midtones, highlights.
@compute @workgroup_size(16, 16)
fn ln_grain_matte(@builtin(global_invocation_id) gid: vec3<u32>) {
    let p = ln_pixel(gid);
    if (p.x < 0) {
        return;
    }
    let c = gen_unpremul(textureLoad(src, p, 0)).xyz;
    let mid = P.f[0].x;
    let l = clamp(luminance(c), 0.0, 1.0);
    let s = 1.0 - gen_smoothstep(0.0, mid, l);
    let hi = gen_smoothstep(mid, 1.0, l);
    let t = P.f[1].xyz;
    let v = clamp(t.x * s + t.y * (1.0 - s - hi) + t.z * hi, 0.0, 1.0);
    textureStore(out, p, vec4<f32>(v, v, v, 1.0));
}

// Sample boxes' outlines over the picture: data = (x, y, size) per box in frame pixels, u[0].x boxes; f[0] = colour.
@compute @workgroup_size(16, 16)
fn ln_boxes(@builtin(global_invocation_id) gid: vec3<u32>) {
    let p = ln_pixel(gid);
    if (p.x < 0) {
        return;
    }
    var v = textureLoad(src, p, 0);
    let x = f32(p.x);
    let y = f32(p.y);
    for (var i = 0u; i < P.u[0].x; i++) {
        let bx = data[i * 3u];
        let by = data[i * 3u + 1u];
        let e = data[i * 3u + 2u] - 1.0;
        if (x >= bx && x <= bx + e && y >= by && y <= by + e && (x == bx || x == bx + e || y == by || y == by + e)) {
            v = vec4<f32>(P.f[0].xyz, 1.0);
            break;
        }
    }
    textureStore(out, p, v);
}

// Grain planes (−0.5..0.5) shown as colour for reading back: rgb = plane + 0.5, alpha 1.
@compute @workgroup_size(16, 16)
fn ln_plane_view(@builtin(global_invocation_id) gid: vec3<u32>) {
    let p = ln_pixel(gid);
    if (p.x < 0) {
        return;
    }
    let g = textureLoad(src, p, 0).xyz;
    textureStore(out, p, vec4<f32>(clamp(g + vec3<f32>(0.5), vec3<f32>(0.0), vec3<f32>(1.0)), 1.0));
}

// Planes normalised: (plane − f[0].xyz) × f[1].xyz.
@compute @workgroup_size(16, 16)
fn ln_affine(@builtin(global_invocation_id) gid: vec3<u32>) {
    let p = ln_pixel(gid);
    if (p.x < 0) {
        return;
    }
    let g = textureLoad(src, p, 0).xyz;
    textureStore(out, p, vec4<f32>((g - P.f[0].xyz) * P.f[1].xyz, 0.0));
}
