// Simulation effects for Lumina (EffectCraft Round 26). CC Particle World's Textured Square with a Texture Layer
// (sim::particle_fx's splat_textured): EffectCraft draws that case on the CPU only (catalog::gpu_supported keeps it off
// the GPU); Lumina draws it here, the same arithmetic per pixel. Ported from EffectCraft's crates/effects/src/sim/
// (MIT licence). Compiles after EffectCraft's common.wgsl and kernels.wgsl. Names lsm_.

fn lsm_aa(edge: f32) -> f32 {
    return clamp(edge + 0.5, 0.0, 1.0);
}

// Textured squares over the base (src), items binned in 16 × 16 tiles as fxp_raster's: each record is (x, y, r,
// opacity, rot, _, _, _, _, _, _, _) then its four pixel bounds. aux = the texture layer as it is drawn in the frame;
// f[0] = its on-screen box (x, y, w, h). u[0] = (_, additive, items offset, item stride); u[1].x = tiles across.
@compute @workgroup_size(16, 16)
fn lsm_texsq(@builtin(global_invocation_id) gid: vec3<u32>) {
    let dims = out_dims();
    let p = vec2<i32>(gid.xy);
    if (p.x >= dims.x || p.y >= dims.y) {
        return;
    }
    let tile = u32(p.y / 16) * P.u[1].x + u32(p.x / 16);
    let start = u32(data[tile]);
    let end = u32(data[tile + 1u]);
    let stride = P.u[0].w;
    let add = P.u[0].y != 0u;
    let x = f32(p.x) + 0.5;
    let y = f32(p.y) + 0.5;
    var d = textureLoad(src, p, 0);
    for (var k = start; k < end; k++) {
        let at = P.u[0].z + u32(data[k]) * stride;
        let bb = at + stride - 4u;
        if (f32(p.x) < data[bb] || f32(p.y) < data[bb + 1u] || f32(p.x) > data[bb + 2u] || f32(p.y) > data[bb + 3u]) {
            continue;
        }
        // as sprite_shade's Square, sub-pixel sprites included
        var r = data[at + 2u];
        var fade = 1.0;
        if (r < 0.5) {
            fade = r / 0.5;
            r = 0.5;
        }
        let rot = data[at + 4u];
        let sn = sin(rot);
        let cs = cos(rot);
        let dx = x - data[at];
        let dy = y - data[at + 1u];
        let ux = dx * cs + dy * sn;
        let uy = -dx * sn + dy * cs;
        let e = r * 0.75;
        let a = lsm_aa(e - abs(ux)) * lsm_aa(e - abs(uy)) * data[at + 3u] * fade;
        if (a <= 1e-6) {
            continue;
        }
        let u = clamp((ux / e + 1.0) * 0.5, 0.0, 1.0);
        let v = clamp((uy / e + 1.0) * 0.5, 0.0, 1.0);
        // the texture's own pixels: reads stay inside its box (edge pixels repeat, as sample_bilinear_clamped does)
        let tx = clamp(P.f[0].x + u * P.f[0].z, P.f[0].x + 0.5, P.f[0].x + max(P.f[0].z - 0.5, 0.5));
        let ty = clamp(P.f[0].y + v * P.f[0].w, P.f[0].y + 0.5, P.f[0].y + max(P.f[0].w - 0.5, 0.5));
        let c = sample_bilinear_clamped(aux, tx, ty) * a;
        if (add) {
            d = vec4<f32>(d.xyz + c.xyz, min(d.w + c.w, 1.0));
        } else {
            d = c + d * (1.0 - c.w);
        }
    }
    textureStore(out, p, d);
}

// Particle Playground's Layer Map particles (EffectCraft Round 27, sim3::blit_layer): a copy of the map layer centred on
// each particle, turned and scaled, over the base (src). Records: (x, y, cos, sin, 1 / x scale, 1 / y scale, opacity, ...)
// then the four pixel bounds. aux = the map layer as drawn in the frame at that moment; f[0] = (a, b, c, d) and f[1] =
// (e, f, width, height) = the map layer's own pixels (centred) → frame pixels. u[0] = (_, _, items offset, item stride);
// u[1].x = tiles across.
@compute @workgroup_size(16, 16)
fn lsm_blit(@builtin(global_invocation_id) gid: vec3<u32>) {
    let dims = out_dims();
    let p = vec2<i32>(gid.xy);
    if (p.x >= dims.x || p.y >= dims.y) {
        return;
    }
    let tile = u32(p.y / 16) * P.u[1].x + u32(p.x / 16);
    let start = u32(data[tile]);
    let end = u32(data[tile + 1u]);
    let stride = P.u[0].w;
    let x = f32(p.x) + 0.5;
    let y = f32(p.y) + 0.5;
    let sz = P.f[1].zw;
    var d = textureLoad(src, p, 0);
    for (var k = start; k < end; k++) {
        let at = P.u[0].z + u32(data[k]) * stride;
        let bb = at + stride - 4u;
        if (f32(p.x) < data[bb] || f32(p.y) < data[bb + 1u] || f32(p.x) > data[bb + 2u] || f32(p.y) > data[bb + 3u]) {
            continue;
        }
        let dx = x - data[at];
        let dy = y - data[at + 1u];
        let ca = data[at + 2u];
        let sa = data[at + 3u];
        // undo the turn, then the scale: into the map layer's own pixels round its centre
        let u = (dx * ca + dy * sa) * data[at + 4u] + sz.x * 0.5;
        let v = (-dx * sa + dy * ca) * data[at + 5u] + sz.y * 0.5;
        if (u < 0.0 || v < 0.0 || u >= sz.x || v >= sz.y) {
            continue;
        }
        let lu = u - sz.x * 0.5;
        let lv = v - sz.y * 0.5;
        let s = sample_bilinear(aux, P.f[0].x * lu + P.f[0].z * lv + P.f[1].x, P.f[0].y * lu + P.f[0].w * lv + P.f[1].y);
        if (s.w <= 0.0) {
            continue;
        }
        let al = data[at + 6u];
        d = s * al + d * (1.0 - s.w * al);
    }
    textureStore(out, p, d);
}
