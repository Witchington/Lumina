// Utility effects for Lumina (EffectCraft Round 29): CC Overbrights, HDR Highlight Compression, HDR Compander and the
// Cineon Converter, per pixel. EffectCraft draws these on the CPU (crates/effects/src/utility.rs, utility2.rs and
// crates/project/src/footage.rs's cineon_log_to_lin); this is the same maths in f32 (MIT licence). Compiles after
// EffectCraft's common.wgsl and kernels.wgsl. Names lu_.
//
// u[0].x = what: 0 CC Overbrights (u[0].y channel; f[0] highlight colour), 1 HDR Highlight Compression (f[0].x
// Amount / 100), 2 HDR Compander (u[0].y expand; f[0].x gain, f[0].y gamma), 3 Cineon Converter (u[0].y 0 linear to
// log, 1 log to linear, 2 log to log; f[0] = 10-bit black, 10-bit white, internal black, internal white; f[1].x gamma,
// f[1].y highlight rolloff).

// v^e keeping v's sign
fn lu_spow(v: f32, e: f32) -> f32 {
    return sign(v) * pow(abs(v), e);
}

// footage.rs's cineon_log_to_lin (code value / 1023 → linear, raised to scale / gamma, rolled off above the knee)
fn lu_log_to_lin(v: f32, black: f32, white: f32, scale: f32, gamma: f32, rolloff: f32) -> f32 {
    let offset = pow(10.0, (black - white) * 0.002 / 0.6);
    var lin = max((pow(10.0, (v * 1023.0 - white) * 0.002 / 0.6) - offset) / max(1.0 - offset, 1e-6), 0.0);
    lin = pow(lin, scale / max(gamma, 0.01));
    let knee = 1.0 - clamp(rolloff / 100.0, 0.0, 0.99);
    if (knee < 1.0 && lin > knee) {
        let w = 1.0 - knee;
        lin = knee + w * (1.0 - exp(-(lin - knee) / w));
    }
    return lin;
}

// utility.rs's Cineon::log_to_lin and lin_to_log; k = (black, white, internal black, internal white), g = (gamma, rolloff)
fn lu_cin_lin(v: f32, k: vec4<f32>, g: vec2<f32>) -> f32 {
    return k.z + (k.w - k.z) * lu_log_to_lin(v, k.x, k.y, 1.7, g.x, g.y);
}
fn lu_cin_log(v: f32, k: vec4<f32>, g: vec2<f32>) -> f32 {
    let off = pow(10.0, (k.x - k.y) * 0.002 / 0.6);
    let d = k.w - k.z;
    var dd = d;
    if (abs(d) < 1e-6) {
        dd = 1e-6;
    }
    var lin = (v - k.z) / dd;
    let knee = 1.0 - clamp(g.y / 100.0, 0.0, 0.99);
    if (knee < 1.0 && lin > knee) {
        let w = 1.0 - knee;
        lin = knee - w * log(max(1.0 - (lin - knee) / w, 1e-6));
    }
    lin = pow(max(lin, 0.0), max(g.x, 0.01) / 1.7);
    let code = k.y + log(max(lin * (1.0 - off) + off, 1e-9)) / log(10.0) * 0.6 / 0.002;
    return code / 1023.0;
}

@compute @workgroup_size(16, 16)
fn lu_point(@builtin(global_invocation_id) gid: vec3<u32>) {
    let d = out_dims();
    let p = vec2<i32>(gid.xy);
    if (p.x >= d.x || p.y >= d.y) {
        return;
    }
    let px = textureLoad(src, p, 0);
    let a = px.w;
    if (a <= 0.0) {
        textureStore(out, p, px);
        return;
    }
    var c = px.xyz / a;
    if (a <= 1e-6) {
        c = vec3<f32>(0.0);
    }
    let what = P.u[0].x;
    var o = c;
    if (what == 0u) {
        // overbrights: in range dim grey, over 1 the highlight colour, under 0 its complement
        var v = max(c.x, max(c.y, c.z));
        switch P.u[0].y {
            case 1u: { v = c.x; }
            case 2u: { v = c.y; }
            case 3u: { v = c.z; }
            case 4u: { v = a; }
            case 5u: { v = dot(c, vec3<f32>(0.2126, 0.7152, 0.0722)); }
            default: {}
        }
        let hc = P.f[0].xyz;
        if (v > 1.0) {
            o = hc;
        } else if (v < 0.0) {
            o = vec3<f32>(1.0) - hc;
        } else {
            o = vec3<f32>(v * 0.35);
        }
    } else if (what == 1u) {
        // HDR Highlight Compression: divided by 1 + Y, clipped at 1, mixed with the input as x^0.4 values
        let t = P.f[0].x;
        let y = max(dot(c, vec3<f32>(0.30, 0.59, 0.11)), 0.0);
        let s = 1.0 / (1.0 + y);
        for (var i = 0u; i < 3u; i++) {
            let x = c[i];
            let comp = min(x * s, 1.0);
            let mixed = (1.0 - t) * lu_spow(x, 0.4) + t * lu_spow(comp, 0.4);
            let r = lu_spow(mixed, 1.0 / 0.4);
            if (r == r && abs(r) < 3.0e38) {
                o[i] = r;
            }
        }
    } else if (what == 2u) {
        let gain = P.f[0].x;
        let gamma = P.f[0].y;
        for (var i = 0u; i < 3u; i++) {
            if (P.u[0].y != 0u) {
                o[i] = lu_spow(c[i], gamma) * gain;
            } else {
                o[i] = lu_spow(c[i] / gain, 1.0 / gamma);
            }
        }
    } else {
        let k = P.f[0];
        let g = P.f[1].xy;
        let k0 = vec4<f32>(95.0, 685.0, 0.0, 1.0);
        for (var i = 0u; i < 3u; i++) {
            switch P.u[0].y {
                case 0u: { o[i] = lu_cin_log(c[i], k, g); }
                case 1u: { o[i] = lu_cin_lin(c[i], k, g); }
                default: { o[i] = lu_cin_log(lu_cin_lin(c[i], k, g), k0, vec2<f32>(1.7, g.y)); }
            }
        }
    }
    textureStore(out, p, vec4<f32>(o * a, a));
}
