// Lumetri Color for Lumina (EffectCraft Round 10). The maths is a port of EffectCraft's CPU Lumetri Color
// (crates/effects/src/color3.rs, MIT licence, commit 3768ff4): Basic Correction (input LUT, white balance, High Dynamic
// Range, tone, saturation), Creative (look, adjustments), Curves (tone sliders, RGB curves, hue/saturation curves), Color
// Wheels, HSL Secondary (key, refine, correction), Vignette and Sharpen, in that order. EffectCraft's own GPU kernel
// (fx_color.wgsl's fxc_lumetri) leaves out the RGB and hue/saturation curves, HSL Secondary and HDR, so Lumina has this
// one. It compiles after EffectCraft's common.wgsl and kernels.wgsl (parameter block P, textures src / aux / out, the
// data table and helpers luminance, rgb_to_hsl, hsl_to_rgb, powz). Colours are premultiplied, 0..1. Names start llm_.

fn llm_pixel(gid: vec3<u32>) -> vec2<i32> {
    let d = out_dims();
    let p = vec2<i32>(gid.xy);
    if (p.x >= d.x || p.y >= d.y) {
        return vec2<i32>(-1);
    }
    return p;
}

fn llm_straight(px: vec4<f32>) -> vec3<f32> {
    if (px.w <= 0.0) {
        return vec3<f32>(0.0);
    }
    return px.xyz / px.w;
}

// util::smoothstep
fn llm_smooth(e0: f32, e1: f32, x: f32) -> f32 {
    if (abs(e1 - e0) < 1e-9) {
        return select(1.0, 0.0, x < e0);
    }
    let t = clamp((x - e0) / (e1 - e0), 0.0, 1.0);
    return t * t * (3.0 - 2.0 * t);
}

fn llm_d3(i: u32) -> vec3<f32> {
    return vec3<f32>(data[i], data[i + 1u], data[i + 2u]);
}

// color3::tone_curve: shadows / midtones / highlights bumps, the ends fixed
fn llm_tone(x: f32, s: f32, m: f32, h: f32) -> f32 {
    if (s == 0.0 && m == 0.0 && h == 0.0) {
        return x;
    }
    let t = clamp(x, 0.0, 1.0);
    let d0 = (t - 0.25) / 0.25;
    let d1 = (t - 0.5) / 0.25;
    let d2 = (t - 0.75) / 0.25;
    let b0 = max(1.0 - d0 * d0, 0.0);
    let b1 = max(1.0 - d1 * d1, 0.0);
    let b2 = max(1.0 - d2 * d2, 0.0);
    return x + 0.25 * (s * b0 * b0 + m * b1 * b1 + h * b2 * b2);
}

// color3::builtin_look
fn llm_look(look: u32, c: vec3<f32>) -> vec3<f32> {
    let l = luminance(c);
    switch (look) {
        case 2u: { return vec3<f32>(c.x * 1.06 + 0.015, c.y * 1.01 + 0.01, c.z * 0.88); }
        case 3u: { return vec3<f32>(c.x * 0.82, c.y * 0.92, c.z * 1.08 + 0.02) * 0.92; }
        case 4u: {
            let d = l + (c - l) * 0.45;
            var o: vec3<f32>;
            if (l < 0.5) { o = 2.0 * d * l; } else { o = 1.0 - 2.0 * (1.0 - d) * (1.0 - l); }
            return d * 0.5 + o * 0.5;
        }
        case 5u: {
            let t = clamp(l - 0.5, -0.5, 0.5);
            return vec3<f32>(c.x + 0.18 * t, c.y + 0.03 * t, c.z - 0.16 * t);
        }
        case 6u: {
            let v = 0.08 + c * 0.84;
            return l + (v - l) * 0.8;
        }
        case 7u: { return vec3<f32>(l); }
        default: { return c; }
    }
}

// a 3D LUT at data[o]: N, then N³ RGB entries with red changing fastest (Lumina's LUTS layout), trilinear
fn llm_lut3(o: u32, c: vec3<f32>) -> vec3<f32> {
    let n = u32(data[o]);
    let s = f32(n - 1u);
    let v = clamp(c, vec3<f32>(0.0), vec3<f32>(1.0)) * s;
    let i0 = min(vec3<u32>(floor(v)), vec3<u32>(n - 2u));
    let f = v - vec3<f32>(i0);
    var acc = vec3<f32>(0.0);
    for (var k = 0u; k < 8u; k++) {
        let dx = k & 1u;
        let dy = (k >> 1u) & 1u;
        let dz = (k >> 2u) & 1u;
        let w = select(1.0 - f.x, f.x, dx == 1u) * select(1.0 - f.y, f.y, dy == 1u) * select(1.0 - f.z, f.z, dz == 1u);
        let idx = o + 1u + ((i0.x + dx) + (i0.y + dy) * n + (i0.z + dz) * n * n) * 3u;
        acc += w * vec3<f32>(data[idx], data[idx + 1u], data[idx + 2u]);
    }
    return acc;
}

// color2::Curve::eval at data[o]: x0, y0, slope0, x1, y1, slope1, then 1025 entries over 0..1 (linear outside 0..1)
fn llm_curve(o: u32, x: f32) -> f32 {
    if (x < 0.0 || x > 1.0) {
        if (x <= data[o]) { return data[o + 1u] + (x - data[o]) * data[o + 2u]; }
        if (x >= data[o + 3u]) { return data[o + 4u] + (x - data[o + 3u]) * data[o + 5u]; }
    }
    let f = clamp(x, 0.0, 1.0) * 1024.0;
    let i = min(u32(f), 1023u);
    let t = f - f32(i);
    let a = data[o + 6u + i];
    return a + (data[o + 7u + i] - a) * t;
}

// color3::OffsetCurve::at at data[o] (513 entries over 0..1); 0 when there is no curve (o < 0)
fn llm_off(o: f32, x: f32) -> f32 {
    if (o < 0.0) {
        return 0.0;
    }
    let b = u32(o);
    let f = clamp(x, 0.0, 1.0) * 512.0;
    let i = min(u32(f), 511u);
    let t = f - f32(i);
    let a = data[b + i];
    return a + (data[b + i + 1u] - a) * t;
}

// The grade, one pass. data: 0 temperature, 1 tint, 2 exposure gain, 3 contrast, 4 highlights, 5 shadows, 6 whites,
// 7 blacks, 8 saturation, 9 look intensity, 10 faded film, 11 vibrance, 12 creative saturation, 13 tint balance pivot,
// 14..17 shadow tint, 17..20 highlight tint, 20..32 tone curves (master, red, green, blue × shadows / midtones /
// highlights), 32..41 wheels (shadows, midtones, highlights), 41 HDR white, 42 HDR specular, 43 look, 44 input LUT
// offset, 45 look LUT offset, 46..50 RGB curve offsets (master, red, green, blue), 50..55 offset-curve offsets (hue vs
// sat, hue vs hue, hue vs luma, luma vs sat, sat vs sat); -1 = none. Tables follow from 64.
@compute @workgroup_size(16, 16)
fn llm_grade(@builtin(global_invocation_id) gid: vec3<u32>) {
    let p = llm_pixel(gid);
    if (p.x < 0) {
        return;
    }
    let px = textureLoad(src, p, 0);
    let a = px.w;
    if (a <= 0.0) {
        textureStore(out, p, px);
        return;
    }
    var c = px.xyz / a;
    if (data[44] >= 0.0) {
        c = llm_lut3(u32(data[44]), c);
    }
    let hw = data[41];
    if (hw != 1.0) {
        c = c / hw;
    }
    let temp = data[0];
    let tint = data[1];
    if (temp != 0.0 || tint != 0.0) {
        c = vec3<f32>(c.x * (1.0 + 0.25 * temp), c.y * (1.0 - 0.25 * tint), c.z * (1.0 - 0.25 * temp));
    }
    if (data[2] != 1.0) {
        c = c * data[2];
    }
    let contrast = data[3];
    if (contrast != 0.0) {
        c = 0.5 + (c - 0.5) * (1.0 + contrast);
    }
    let hi = data[4];
    let sh = data[5];
    let wh = data[6];
    let bl = data[7];
    if (hi != 0.0 || sh != 0.0 || wh != 0.0 || bl != 0.0) {
        let lt = min(max(luminance(c), 0.0), 1.0);
        let il = 1.0 - lt;
        let d = 0.25 * hi * llm_smooth(0.5, 1.0, lt) + 0.25 * sh * (1.0 - llm_smooth(0.0, 0.5, lt)) + 0.2 * wh * lt * lt + 0.2 * bl * il * il;
        c = c + d;
    }
    let spec = data[42];
    if (spec != 0.0) {
        let k = max(1.0 + spec, 0.0);
        for (var i = 0u; i < 3u; i++) {
            if (c[i] > 1.0) { c[i] = 1.0 + (c[i] - 1.0) * k; }
        }
    }
    if (hw != 1.0) {
        c = c * hw;
    }
    let l0 = luminance(c);
    if (data[8] != 1.0) {
        c = l0 + (c - l0) * data[8];
    }
    // Creative: the look, then the adjustments, all at Intensity
    let intensity = data[9];
    let faded = data[10];
    let vib = data[11];
    let csat = data[12];
    let st = llm_d3(14u);
    let ht = llm_d3(17u);
    let zero = vec3<f32>(0.0);
    let look = u32(data[43]);
    let has_look = look >= 2u || data[45] >= 0.0;
    if (intensity != 0.0 && (has_look || faded != 0.0 || vib != 0.0 || csat != 1.0 || any(st != zero) || any(ht != zero))) {
        var d = c;
        if (data[45] >= 0.0) {
            d = llm_lut3(u32(data[45]), c);
        } else {
            d = llm_look(look, c);
        }
        if (faded != 0.0) {
            d = d * (1.0 - 0.25 * faded) + 0.12 * faded;
        }
        let l = luminance(d);
        if (vib != 0.0) {
            let mx = max(max(d.x, d.y), d.z);
            let mn = min(min(d.x, d.y), d.z);
            var s = 0.0;
            if (mx > 1e-6) { s = (mx - mn) / mx; }
            d = l + (d - l) * (1.0 + vib * (1.0 - clamp(s, 0.0, 1.0)));
        }
        if (csat != 1.0) {
            d = l + (d - l) * csat;
        }
        let lt = clamp(l, 0.0, 1.0);
        let wsh = 1.0 - llm_smooth(0.0, data[13], lt);
        let whi = llm_smooth(data[13], 1.0, lt);
        d = d + 0.5 * (st * wsh + ht * whi);
        c = c + (d - c) * intensity;
    }
    // Curves: tone sliders, RGB curves (master, then each channel), hue / saturation curves
    for (var i = 0u; i < 3u; i++) {
        c[i] = llm_tone(c[i], data[20], data[21], data[22]);
    }
    for (var i = 0u; i < 3u; i++) {
        let b = 23u + i * 3u;
        c[i] = llm_tone(c[i], data[b], data[b + 1u], data[b + 2u]);
    }
    if (data[46] >= 0.0) {
        for (var i = 0u; i < 3u; i++) { c[i] = llm_curve(u32(data[46]), c[i]); }
    }
    for (var i = 0u; i < 3u; i++) {
        if (data[47u + i] >= 0.0) { c[i] = llm_curve(u32(data[47u + i]), c[i]); }
    }
    if (data[50] >= 0.0 || data[51] >= 0.0 || data[52] >= 0.0 || data[53] >= 0.0 || data[54] >= 0.0) {
        let hsl = rgb_to_hsl(clamp(c, vec3<f32>(0.0), vec3<f32>(1.0)));
        let chroma = min(hsl.y * 20.0, 1.0);
        // y = 1 doubles saturation, y = 0 removes it
        let ms = max((1.0 + 2.0 * llm_off(data[50], hsl.x) * chroma) * (1.0 + 2.0 * llm_off(data[53], hsl.z)) * (1.0 + 2.0 * llm_off(data[54], hsl.y)), 0.0);
        let dh = llm_off(data[51], hsl.x) * chroma;
        let dl = llm_off(data[52], hsl.x) * chroma;
        let luma = luminance(c);
        if (dh != 0.0) {
            let h2 = (hsl.x + dh) - floor(hsl.x + dh);
            let r = hsl_to_rgb(h2, hsl.y, hsl.z);
            c = c + r - clamp(c, vec3<f32>(0.0), vec3<f32>(1.0));   // keep what lies outside 0..1
        }
        if (ms != 1.0) {
            c = luma + (c - luma) * ms;
        }
        if (dl != 0.0) {
            c = c + dl;
        }
    }
    // Color wheels
    let w0 = llm_d3(32u);
    let w1 = llm_d3(35u);
    let w2 = llm_d3(38u);
    if (any(w0 != zero) || any(w1 != zero) || any(w2 != zero)) {
        let lt = clamp(luminance(c), 0.0, 1.0);
        let ka = 1.0 - llm_smooth(0.0, 0.5, lt);
        let kz = llm_smooth(0.5, 1.0, lt);
        c = c + 0.5 * (w0 * ka + w1 * (1.0 - ka - kz) + w2 * kz);
    }
    textureStore(out, p, vec4<f32>(c * a, a));
}

// HSL Secondary's key (HslKey::weight) of the graded colour, as a grey matte (k, k, k, 1).
// f[0] = (hue centre°, hue range°, hue softness°, hue on), f[1] = (sat low, sat high, sat softness, sat on),
// f[2] = (light low, high, softness, on), all 0..1 but the hue ones
fn llm_band(v: f32, b: vec4<f32>) -> f32 {
    let lo = min(b.x, b.y);
    let hi = max(b.x, b.y);
    var d = 0.0;
    if (v < lo) { d = lo - v; } else if (v > hi) { d = v - hi; }
    if (d <= 0.0) { return 1.0; }
    if (b.z > 0.0) { return max(1.0 - d / b.z, 0.0); }
    return 0.0;
}

@compute @workgroup_size(16, 16)
fn llm_key(@builtin(global_invocation_id) gid: vec3<u32>) {
    let p = llm_pixel(gid);
    if (p.x < 0) {
        return;
    }
    let px = textureLoad(src, p, 0);
    var w = 0.0;
    if (px.w > 0.0) {
        let hsl = rgb_to_hsl(clamp(px.xyz / px.w, vec3<f32>(0.0), vec3<f32>(1.0)));
        w = 1.0;
        let hk = P.f[0];
        if (hk.w != 0.0 && hk.y < 180.0) {
            let hd = hsl.x * 360.0;
            let a1 = (hd - hk.x) - floor((hd - hk.x) / 360.0) * 360.0;
            let a2 = (hk.x - hd) - floor((hk.x - hd) / 360.0) * 360.0;
            let d = min(a1, a2);
            var hw = 0.0;
            if (d <= hk.y) { hw = 1.0; } else if (hk.z > 0.0) { hw = max(1.0 - (d - hk.y) / hk.z, 0.0); }
            w *= hw * min(hsl.y * 20.0, 1.0);   // greys have no hue: they belong as far as they are saturated
        }
        if (P.f[1].w != 0.0) { w *= llm_band(hsl.y, P.f[1]); }
        if (P.f[2].w != 0.0) { w *= llm_band(hsl.z, P.f[2]); }
    }
    textureStore(out, p, vec4<f32>(w, w, w, 1.0));
}

// the matte after Denoise's blur: its edge contrast put back (f[0].x = k, u[0].x = also invert), or just inverted
@compute @workgroup_size(16, 16)
fn llm_matte(@builtin(global_invocation_id) gid: vec3<u32>) {
    let p = llm_pixel(gid);
    if (p.x < 0) {
        return;
    }
    var v = textureLoad(src, p, 0).x;
    if (P.f[0].x != 1.0) {
        v = clamp((v - 0.5) * P.f[0].x + 0.5, 0.0, 1.0);
    }
    if (P.u[0].x != 0u) {
        v = 1.0 - v;
    }
    textureStore(out, p, vec4<f32>(v, v, v, 1.0));
}

// HSL Secondary's correction through the matte (aux.x), Show Mask, then the vignette.
// u[0] = (secondary on, show mask, mask style, vignette on); f[0] = (temperature, tint, contrast, saturation),
// f[1].xyz = correction wheel; f[2] = (vignette amount, start, roundness, feather); f[3] = (centre x, y, half w, half h);
// f[4].x = aspect
@compute @workgroup_size(16, 16)
fn llm_final(@builtin(global_invocation_id) gid: vec3<u32>) {
    let p = llm_pixel(gid);
    if (p.x < 0) {
        return;
    }
    let px = textureLoad(src, p, 0);
    let a = px.w;
    if (a <= 0.0) {
        textureStore(out, p, px);
        return;
    }
    var c = px.xyz / a;
    let u0 = P.u[0];
    if (u0.x != 0u) {
        let k = textureLoad(aux, p, 0).x;
        if (u0.y != 0u) {
            var m: vec3<f32>;
            if (u0.z == 0u) {
                let g = clamp(luminance(c), 0.0, 1.0) * 0.2 + 0.4;
                m = g + (c - g) * k;
            } else if (u0.z == 1u) {
                m = c * k;
            } else {
                m = vec3<f32>(k);
            }
            textureStore(out, p, vec4<f32>(max(m, vec3<f32>(0.0)) * a, a));
            return;
        }
        if (k > 0.0) {
            let f0 = P.f[0];
            var d = c;
            if (f0.x != 0.0 || f0.y != 0.0) {
                d = vec3<f32>(d.x * (1.0 + 0.25 * f0.x), d.y * (1.0 - 0.25 * f0.y), d.z * (1.0 - 0.25 * f0.x));
            }
            if (f0.z != 0.0) {
                d = 0.5 + (d - 0.5) * (1.0 + f0.z);
            }
            let l = luminance(d);
            if (f0.w != 1.0) {
                d = l + (d - l) * f0.w;
            }
            d = d + 0.5 * P.f[1].xyz;
            c = c + (d - c) * k;
        }
    }
    if (u0.w != 0u) {
        let vig = P.f[2].x;
        let start = P.f[2].y;
        let vround = P.f[2].z;
        let feather = P.f[2].w;
        var nx = (f32(p.x) + 0.5 - P.f[3].x) / max(P.f[3].z, 1e-6);
        var ny = (f32(p.y) + 0.5 - P.f[3].y) / max(P.f[3].w, 1e-6);
        let aspect = P.f[4].x;
        if (vround > 0.0) {
            nx = nx * (1.0 + (max(aspect, 1.0) - 1.0) * vround);
            ny = ny * (1.0 + (max(1.0 / aspect, 1.0) - 1.0) * vround);
        }
        let pw = 2.0 + max(-vround, 0.0) * 6.0;
        let r = powz(powz(abs(nx), pw) + powz(abs(ny), pw), 1.0 / pw) / 1.4142135;
        let f = llm_smooth(start, start + 0.05 + feather * (1.05 - start), r);
        if (vig > 0.0) {
            c = c + (1.0 - c) * min(vig * 0.2 * f, 1.0);
        } else {
            c = c * max(1.0 + vig * 0.2 * f, 0.0);
        }
    }
    textureStore(out, p, vec4<f32>(max(c, vec3<f32>(0.0)) * a, a));
}

// Sharpen: each colour moves by (luma - blurred luma) × amount × 2, where amount = f[0].x + f[0].y × matte (aux.x, when
// u[0].x = 1) and the blur is a Gaussian of f[0].z pixels (sigma) worked out here
@compute @workgroup_size(16, 16)
fn llm_sharpen(@builtin(global_invocation_id) gid: vec3<u32>) {
    let p = llm_pixel(gid);
    if (p.x < 0) {
        return;
    }
    let px = textureLoad(src, p, 0);
    let a = px.w;
    if (a <= 0.0) {
        textureStore(out, p, px);
        return;
    }
    let sigma = max(P.f[0].z, 0.1);
    let rad = i32(ceil(sigma * 3.0));
    var sum = 0.0;
    var wsum = 0.0;
    for (var j = -rad; j <= rad; j++) {
        for (var i = -rad; i <= rad; i++) {
            let w = exp(-f32(i * i + j * j) / (2.0 * sigma * sigma));
            sum += w * luminance(llm_straight(tex_get_clamped(src, p.x + i, p.y + j)));
            wsum += w;
        }
    }
    let c = px.xyz / a;
    var amount = P.f[0].x;
    if (P.u[0].x != 0u) {
        amount += P.f[0].y * textureLoad(aux, p, 0).x;
    }
    let d = (luminance(c) - sum / wsum) * amount * 2.0;
    textureStore(out, p, vec4<f32>(max(c + d, vec3<f32>(0.0)) * a, a));
}
