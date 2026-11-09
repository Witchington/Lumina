// Keying helpers for Lumina (EffectCraft Round 11). Inner/Outer Key is a port of EffectCraft's keying2::inner_outer_key
// (crates/effects/src/keying2.rs, MIT licence): a trimap (1 inside, 0.5 the edge, 0 outside) from the effect's shapes,
// local foreground / background colours from normalised blurs over the known regions, the matte along the line between
// them, and edge colours with the background taken back out. EffectCraft's GPU version reads the layer from a storage
// table; Lumina's binds only two images per kernel, so the same maths is split over a few small kernels here. Compiles
// after EffectCraft's common.wgsl and kernels.wgsl (P, src, aux, out, data). Colours are premultiplied, 0..1. Names lk_.

fn lk_pixel(gid: vec3<u32>) -> vec2<i32> {
    let d = out_dims();
    let p = vec2<i32>(gid.xy);
    if (p.x >= d.x || p.y >= d.y) {
        return vec2<i32>(-1);
    }
    return p;
}

fn lk_straight(px: vec4<f32>) -> vec3<f32> {
    if (px.w <= 1e-6) {
        return vec3<f32>(0.0);
    }
    return px.xyz / px.w;
}

// src = the layer, aux = the trimap (x): one known region, as (straight colour × known, known).
// u[0].x = 0 the foreground (trimap > 0.75), 1 the background (< 0.25)
@compute @workgroup_size(16, 16)
fn lk_known(@builtin(global_invocation_id) gid: vec3<u32>) {
    let p = lk_pixel(gid);
    if (p.x < 0) {
        return;
    }
    let c = lk_straight(textureLoad(src, p, 0));
    let t = textureLoad(aux, p, 0).x;
    var m = select(0.0, 1.0, t > 0.75);
    if (P.u[0].x == 1u) {
        m = select(0.0, 1.0, t < 0.25);
    }
    textureStore(out, p, vec4<f32>(c * m, m));
}

// src = blurred foreground, aux = blurred background: (fc − bc, 0), the estimates' difference
@compute @workgroup_size(16, 16)
fn lk_diff(@builtin(global_invocation_id) gid: vec3<u32>) {
    let p = lk_pixel(gid);
    if (p.x < 0) {
        return;
    }
    let f = textureLoad(src, p, 0);
    let b = textureLoad(aux, p, 0);
    textureStore(out, p, vec4<f32>(f.xyz / max(f.w, 1e-6) - b.xyz / max(b.w, 1e-6), 0.0));
}

// src = the layer, aux = blurred background: (c − bc, layer alpha)
@compute @workgroup_size(16, 16)
fn lk_sub(@builtin(global_invocation_id) gid: vec3<u32>) {
    let p = lk_pixel(gid);
    if (p.x < 0) {
        return;
    }
    let px = textureLoad(src, p, 0);
    let b = textureLoad(aux, p, 0);
    textureStore(out, p, vec4<f32>(lk_straight(px) - b.xyz / max(b.w, 1e-6), max(px.w, 0.0)));
}

// src = (c − bc, alpha) from lk_sub, aux = the trimap (x) with the estimates' difference packed by lk_pack in yzw.
// Out = (e, matte): the matte is the trimap where it is known, else the position of the colour between the two
// estimates; e is c − bc, divided by the matte at the edge so that bc + e is the decontaminated colour.
@compute @workgroup_size(16, 16)
fn lk_est(@builtin(global_invocation_id) gid: vec3<u32>) {
    let p = lk_pixel(gid);
    if (p.x < 0) {
        return;
    }
    let q = textureLoad(src, p, 0);
    let t = textureLoad(aux, p, 0);
    let tri = t.x;
    var a = tri;
    var e = q.xyz;
    if (tri > 0.25 && tri < 0.75) {
        let d = t.yzw;
        let dd = dot(d, d);
        if (dd < 1e-6) {
            a = 0.5;
        } else {
            a = clamp(dot(q.xyz, d) / dd, 0.0, 1.0);
        }
        if (a > 0.02) {
            e = q.xyz / a;
        }
    }
    textureStore(out, p, vec4<f32>(e, a));
}

// src = the trimap (x), aux = the estimates' difference (xyz): (trimap, difference) in one image for lk_est
@compute @workgroup_size(16, 16)
fn lk_pack(@builtin(global_invocation_id) gid: vec3<u32>) {
    let p = lk_pixel(gid);
    if (p.x < 0) {
        return;
    }
    textureStore(out, p, vec4<f32>(textureLoad(src, p, 0).x, textureLoad(aux, p, 0).xyz));
}

// src = (e, matte) from lk_est, aux = blurred background: (clamp(bc + e), matte), the edge colours and the matte
@compute @workgroup_size(16, 16)
fn lk_col(@builtin(global_invocation_id) gid: vec3<u32>) {
    let p = lk_pixel(gid);
    if (p.x < 0) {
        return;
    }
    let s = textureLoad(src, p, 0);
    let b = textureLoad(aux, p, 0);
    textureStore(out, p, vec4<f32>(clamp(b.xyz / max(b.w, 1e-6) + s.xyz, vec3<f32>(0.0), vec3<f32>(1.0)), s.w));
}

// Moves src towards aux by f[0].x (a fractional erode / grow is the blend of the two nearest whole radii).
// u[0].x = 1: only the alpha (w) moves, from aux's w (the matte feathered on its own, the colours kept)
@compute @workgroup_size(16, 16)
fn lk_mix(@builtin(global_invocation_id) gid: vec3<u32>) {
    let p = lk_pixel(gid);
    if (p.x < 0) {
        return;
    }
    let a = textureLoad(src, p, 0);
    let b = textureLoad(aux, p, 0);
    if (P.u[0].x == 1u) {
        textureStore(out, p, vec4<f32>(a.xyz, b.w));
        return;
    }
    textureStore(out, p, a + (b - a) * P.f[0].x);
}

// src = the layer, aux = (edge colours, matte). u[0].x = use the edge colours, u[0].y = invert extraction;
// f[0] = (edge threshold, blend with original)
@compute @workgroup_size(16, 16)
fn lk_final(@builtin(global_invocation_id) gid: vec3<u32>) {
    let p = lk_pixel(gid);
    if (p.x < 0) {
        return;
    }
    let px = textureLoad(src, p, 0);
    let k = textureLoad(aux, p, 0);
    var m = k.w;
    let thr = P.f[0].x;
    if (thr > 0.0 && m < thr) {
        m = 0.0;
    }
    if (P.u[0].y != 0u) {
        m = 1.0 - m;
    }
    var c = lk_straight(px);
    if (P.u[0].x != 0u) {
        c = k.xyz;
    }
    let a = max(px.w, 0.0);
    let keyed = vec4<f32>(c * (a * m), a * m);
    textureStore(out, p, keyed + (px - keyed) * P.f[0].y);
}
