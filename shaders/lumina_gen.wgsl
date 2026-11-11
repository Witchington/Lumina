// Generators for Lumina (EffectCraft Rounds 19–20) that EffectCraft draws only on the CPU: Circle (generate::circle),
// Ellipse (generate2::ellipse) and Cell Pattern's HQ patterns (generate2::cell_pattern with 4 × 4 samples a pixel and
// the wider neighbourhood of cells). Ported from EffectCraft's crates/effects/src/generate.rs and generate2.rs (MIT
// licence), operation for operation. Compiles after EffectCraft's common.wgsl, kernels.wgsl and fx_generate.wgsl
// (gen_blend, gen_smoothstep, gen_cell_value, gen_overflow). Colours are premultiplied, 0..1. Names lg_.

fn lg_pixel(gid: vec3<u32>) -> vec2<i32> {
    let d = out_dims();
    let p = vec2<i32>(gid.xy);
    if (p.x >= d.x || p.y >= d.y) {
        return vec2<i32>(-1);
    }
    return p;
}

// Circle: u[0] = (mode, invert, has inner edge); f[0] = (centre x, centre y, outer radius, inner radius);
// f[1] = (outer feather, inner feather, opacity); f[2] = colour.
@compute @workgroup_size(16, 16)
fn lg_circle(@builtin(global_invocation_id) gid: vec3<u32>) {
    let p = lg_pixel(gid);
    if (p.x < 0) {
        return;
    }
    let d = length(vec2<f32>(f32(p.x) + 0.5, f32(p.y) + 0.5) - P.f[0].xy);
    var cov = clamp((P.f[0].z - d) / P.f[1].x + 0.5, 0.0, 1.0);
    if (P.u[0].z != 0u) {
        cov = cov * clamp((d - P.f[0].w) / P.f[1].y + 0.5, 0.0, 1.0);
    }
    if (P.u[0].y != 0u) {
        cov = 1.0 - cov;
    }
    let a = cov * P.f[1].z;
    textureStore(out, p, gen_blend(textureLoad(src, p, 0), vec4<f32>(P.f[2].xyz * a, a), P.u[0].x));
}

// Ellipse: an outline of half width `half` round the ellipse; Softness fades it out to its edges. u[0].x = composite on
// the original; f[0] = (centre x, centre y, rx, ry); f[1] = (half width, softness); f[2] = inside colour, f[3] = outside.
@compute @workgroup_size(16, 16)
fn lg_ellipse(@builtin(global_invocation_id) gid: vec3<u32>) {
    let p = lg_pixel(gid);
    if (p.x < 0) {
        return;
    }
    let rx = P.f[0].z;
    let ry = P.f[0].w;
    let half = P.f[1].x;
    let soft = P.f[1].y;
    let dx = f32(p.x) + 0.5 - P.f[0].x;
    let dy = f32(p.y) + 0.5 - P.f[0].y;
    let q = sqrt((dx / rx) * (dx / rx) + (dy / ry) * (dy / ry));
    var dist: f32;
    if (q < 1e-9) {
        dist = min(rx, ry);
    } else {
        let gx = dx / (rx * rx) / q;
        let gy = dy / (ry * ry) / q;
        dist = abs((q - 1.0) / max(sqrt(gx * gx + gy * gy), 1e-9));
    }
    let t = dist / half;
    var a: f32;
    if (soft > 1e-3) {
        a = 1.0 - gen_smoothstep(1.0 - soft, 1.0, t);
    } else {
        a = clamp(half - dist + 0.5, 0.0, 1.0);
    }
    let k = gen_smoothstep(0.0, 1.0, t);
    let cc = P.f[2].xyz + (P.f[3].xyz - P.f[2].xyz) * k;
    let g = vec4<f32>(cc * a, a);
    if (P.u[0].x != 0u) {
        textureStore(out, p, g + textureLoad(src, p, 0) * (1.0 - a));
    } else {
        textureStore(out, p, g);
    }
}

// generate2::worley_r with a reach of 2 cells (the HQ patterns): (F1, F2, hash of the nearest cell).
fn lg_worley2(u: f32, v: f32, disperse: f32, evo: f32, seed: u32) -> vec3<f32> {
    let tile = P.u[1].x != 0u;
    let nx = i32(P.u[1].y);
    let ny = i32(P.u[1].z);
    let cx = i32(floor(u));
    let cy = i32(floor(v));
    var f1 = 3.0e38;
    var f2 = 3.0e38;
    var id = 0.0;
    for (var j = -2; j <= 2; j++) {
        for (var i = -2; i <= 2; i++) {
            let gx = cx + i;
            let gy = cy + j;
            var tx = gx;
            var ty = gy;
            if (tile) {
                tx = imod(gx, nx);
                ty = imod(gy, ny);
            }
            let hx = bitcast<u32>(tx);
            let hy = bitcast<u32>(ty);
            let h1 = hash_noise(hx, hy, seed);
            let h2 = hash_noise(hx, hy, seed + 1u);
            let h3 = hash_noise(hx, hy, seed + 2u);
            let ang = 6.283185307179586 * (h3 + evo);
            let px = f32(gx) + 0.5 + (h1 - 0.5) * disperse + 0.15 * disperse * cos(ang);
            let py = f32(gy) + 0.5 + (h2 - 0.5) * disperse + 0.15 * disperse * sin(ang);
            let d = sqrt((px - u) * (px - u) + (py - v) * (py - v));
            if (d < f1) {
                f2 = f1;
                f1 = d;
                id = hash_noise(hx, hy, seed + 3u);
            } else if (d < f2) {
                f2 = d;
            }
        }
    }
    return vec3<f32>(f1, f2, id);
}

// Cell Pattern HQ: the parameters of fx_generate's gen_cell_pattern (f[1] = 0.5 − offset), 4 × 4 samples a pixel.
@compute @workgroup_size(16, 16)
fn lg_cell_hq(@builtin(global_invocation_id) gid: vec3<u32>) {
    let p = lg_pixel(gid);
    if (p.x < 0) {
        return;
    }
    let size = P.f[0].z;
    var val = 0.0;
    for (var sy = 0; sy < 4; sy++) {
        for (var sx = 0; sx < 4; sx++) {
            let u = (f32(p.x) + P.f[1].x - 0.5 + (f32(sx) + 0.5) / 4.0) / size;
            let v = (f32(p.y) + P.f[1].y - 0.5 + (f32(sy) + 0.5) / 4.0) / size;
            let w = lg_worley2(u, v, P.f[0].y, P.f[0].w, P.u[0].w);
            val += gen_cell_value(P.u[0].x, w.x, w.y, w.z);
        }
    }
    val = gen_overflow((val / 16.0 - 0.5) * P.f[0].x + 0.5, P.u[0].y);
    if (P.u[0].z != 0u) {
        val = 1.0 - val;
    }
    textureStore(out, p, vec4<f32>(val, val, val, 1.0));
}

// ---- Round 20 (Generate II, light)

// Plane::alpha: the layer's alpha into x (CC Light Sweep's edges; EffectCraft's fx_extra fxe_alpha).
@compute @workgroup_size(16, 16)
fn lg_alpha(@builtin(global_invocation_id) gid: vec3<u32>) {
    let p = lg_pixel(gid);
    if (p.x < 0) {
        return;
    }
    textureStore(out, p, vec4<f32>(textureLoad(src, p, 0).w, 0.0, 0.0, 0.0));
}

// A picture drawn on the CPU (aux, premultiplied: Fractal) as the result; u[0].x = 1 puts it over the original
// (generate3::fractal's Overlay, raster::over).
@compute @workgroup_size(16, 16)
fn lg_put(@builtin(global_invocation_id) gid: vec3<u32>) {
    let p = lg_pixel(gid);
    if (p.x < 0) {
        return;
    }
    let c = textureLoad(aux, p, 0);
    if (P.u[0].x != 0u) {
        textureStore(out, p, c + textureLoad(src, p, 0) * (1.0 - c.w));
    } else {
        textureStore(out, p, c);
    }
}
