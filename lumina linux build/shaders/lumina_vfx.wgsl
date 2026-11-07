// Lumina's own GPU effects for anime and gaming edits (CapCut phase C4): RGB split, edge glow, flash, VHS glitch and
// camera shake. Written for Lumina (not EffectCraft). They compile in one module after EffectCraft's common.wgsl and
// kernels.wgsl, so they share its parameter block P (u = 4 × vec4<u32>, f = 12 × vec4<f32>), the textures src, aux,
// out and the helpers sample_bilinear_clamped, hash_noise and luminance. Colours are premultiplied, 0..1.
// Every name here starts with lvx_.

fn lvx_pixel(gid: vec3<u32>) -> vec2<i32> {
    let d = out_dims();
    let p = vec2<i32>(gid.xy);
    if (p.x >= d.x || p.y >= d.y) {
        return vec2<i32>(-1);
    }
    return p;
}

// edge-clamped bilinear read at a pixel position (pixel centres at whole numbers)
fn lvx_at(t: texture_2d<f32>, q: vec2<f32>) -> vec4<f32> {
    return sample_bilinear_clamped(t, q.x + 0.5, q.y + 0.5);
}

// RGB split / chromatic aberration. Red is read from one side, blue from the other, green stays.
// u[0].x = 0 straight (f[0].xy = offset in px), 1 radial (f[1].xy = centre px; f[0].z = offset in px at f[1].z px
// from the centre, growing with distance)
@compute @workgroup_size(16, 16)
fn lvx_rgbsplit(@builtin(global_invocation_id) gid: vec3<u32>) {
    let p = lvx_pixel(gid);
    if (p.x < 0) {
        return;
    }
    let q = vec2<f32>(p);
    var off = P.f[0].xy;
    if (P.u[0].x == 1u) {
        let rv = q - P.f[1].xy;
        off = rv / max(P.f[1].z, 1.0) * P.f[0].z;
    }
    let c = textureLoad(src, p, 0);
    let r = lvx_at(src, q - off);
    let b = lvx_at(src, q + off);
    let a = max(max(r.w, c.w), b.w);
    textureStore(out, p, vec4<f32>(r.x, c.y, b.z, a));
}

// Edge glow, step 1: Sobel edges of the brightness, as a glow colour. f[0] = (threshold, softness, strength, _),
// f[1].xyz = colour; u[0].x = 1 takes each edge's own colour instead.
@compute @workgroup_size(16, 16)
fn lvx_edges(@builtin(global_invocation_id) gid: vec3<u32>) {
    let p = lvx_pixel(gid);
    if (p.x < 0) {
        return;
    }
    let d = out_dims();
    var l: array<f32, 9>;
    for (var j = -1; j <= 1; j++) {
        for (var i = -1; i <= 1; i++) {
            let s = textureLoad(src, clamp(p + vec2<i32>(i, j), vec2<i32>(0), d - 1), 0);
            l[(j + 1) * 3 + i + 1] = luminance(s.xyz);
        }
    }
    let gx = (l[2] + 2.0 * l[5] + l[8]) - (l[0] + 2.0 * l[3] + l[6]);
    let gy = (l[6] + 2.0 * l[7] + l[8]) - (l[0] + 2.0 * l[1] + l[2]);
    let m = sqrt(gx * gx + gy * gy);
    let e = clamp((m - P.f[0].x) / max(P.f[0].y, 1e-4), 0.0, 1.0) * P.f[0].z;
    var col = P.f[1].xyz;
    if (P.u[0].x == 1u) {
        let c = textureLoad(src, p, 0);
        col = c.xyz / max(c.w, 1e-4);
    }
    textureStore(out, p, vec4<f32>(col * e, e));
}

// Edge glow, step 2: put the blurred glow (aux) on the picture. f[0].x = amount;
// u[0].x = 0 screen, 1 add, 2 glow only
@compute @workgroup_size(16, 16)
fn lvx_glowmix(@builtin(global_invocation_id) gid: vec3<u32>) {
    let p = lvx_pixel(gid);
    if (p.x < 0) {
        return;
    }
    let s = textureLoad(src, p, 0);
    let g = textureLoad(aux, p, 0) * P.f[0].x;
    var o: vec4<f32>;
    switch P.u[0].x {
        case 1u: { o = s + g; }
        case 2u: { o = g; }
        default: { o = s + g - s * g; }
    }
    textureStore(out, p, clamp(o, vec4<f32>(0.0), vec4<f32>(4.0)));
}

// Flash: f[0].xyz = colour, f[0].w = amount (0..1); u[0].x = 0 screen, 1 add, 2 fill (move toward the colour).
// The flash covers the layer where it is drawn (its alpha).
@compute @workgroup_size(16, 16)
fn lvx_flash(@builtin(global_invocation_id) gid: vec3<u32>) {
    let p = lvx_pixel(gid);
    if (p.x < 0) {
        return;
    }
    let s = textureLoad(src, p, 0);
    let k = P.f[0].w;
    let c = P.f[0].xyz * s.w * k;
    var rgb: vec3<f32>;
    switch P.u[0].x {
        case 1u: { rgb = s.xyz + c; }
        case 2u: { rgb = s.xyz + (P.f[0].xyz * s.w - s.xyz) * k; }
        default: { rgb = s.xyz + c - s.xyz * c / max(s.w, 1e-4); }
    }
    textureStore(out, p, vec4<f32>(min(rgb, vec3<f32>(s.w)), s.w));
}

// VHS glitch. f[0] = (time s, tear px, bleed px, noise 0..1), f[1] = (scanline strength 0..1, scanline period px,
// chroma shift px, band height px), f[2] = (tear chance 0..1, rolling band height px, rolling speed, strength 0..1);
// u[0].x = seed
@compute @workgroup_size(16, 16)
fn lvx_vhs(@builtin(global_invocation_id) gid: vec3<u32>) {
    let p = lvx_pixel(gid);
    if (p.x < 0) {
        return;
    }
    let d = vec2<f32>(out_dims());
    let q = vec2<f32>(p);
    let k = P.f[2].w;
    let frame = u32(max(P.f[0].x, 0.0) * 30.0);
    let seed = P.u[0].x;
    // line tearing: bands of rows jump sideways now and then
    let band = u32(q.y / max(P.f[1].w, 1.0));
    var dx = 0.0;
    if (hash_noise(band, frame, seed) < P.f[2].x * k) {
        dx = (hash_noise(band, frame, seed + 1u) - 0.5) * 2.0 * P.f[0].y * k;
    }
    // a rolling band that drifts down the picture and wobbles it
    let ry = fract(P.f[0].x * P.f[2].z) * (d.y + P.f[2].y) - P.f[2].y * 0.5;
    let inb = 1.0 - clamp(abs(q.y - ry) / max(P.f[2].y * 0.5, 1.0), 0.0, 1.0);
    dx += sin(q.y * 0.35 + P.f[0].x * 40.0) * P.f[0].y * 0.35 * inb * k;
    let x = q.x + dx;
    // colour bleeds sideways (five taps over the bleed width), brightness stays sharp
    let bl = P.f[0].z * k;
    let cs = P.f[1].z * k;
    let centre = lvx_at(src, vec2<f32>(x, q.y));
    var acc = vec4<f32>(0.0);
    for (var i = -2; i <= 2; i++) {
        acc += lvx_at(src, vec2<f32>(x + f32(i) * bl * 0.5, q.y));
    }
    acc = acc / 5.0;
    let rr = lvx_at(src, vec2<f32>(x + cs, q.y)).x;
    let bb = lvx_at(src, vec2<f32>(x - cs, q.y)).z;
    var rgb = vec3<f32>(mix(acc.x, rr, 0.6), acc.y, mix(acc.z, bb, 0.6));
    rgb += vec3<f32>(luminance(centre.xyz) - luminance(rgb));
    let a = max(centre.w, acc.w);
    // scanlines and tape noise
    let sl = 1.0 - P.f[1].x * k * 0.5 * (1.0 + cos(6.2831853 * q.y / max(P.f[1].y, 1.0)));
    let n = (hash_noise(u32(p.x), u32(p.y), frame * 7919u + seed) - 0.5) * P.f[0].w * k;
    rgb = clamp((rgb * sl + vec3<f32>(n) * a) + vec3<f32>(0.25 * inb * k * a * P.f[0].w), vec3<f32>(0.0), vec3<f32>(a));
    textureStore(out, p, vec4<f32>(rgb, a));
}

// Camera shake: the picture moved, turned and zoomed about the centre, edges repeated.
// f[0] = (dx px, dy px, angle rad, zoom), f[1].xy = centre px
@compute @workgroup_size(16, 16)
fn lvx_shake(@builtin(global_invocation_id) gid: vec3<u32>) {
    let p = lvx_pixel(gid);
    if (p.x < 0) {
        return;
    }
    let c = P.f[1].xy;
    let v = (vec2<f32>(p) - c - P.f[0].xy) / max(P.f[0].w, 1e-3);
    let ca = cos(-P.f[0].z);
    let sa = sin(-P.f[0].z);
    let q = c + vec2<f32>(v.x * ca - v.y * sa, v.x * sa + v.y * ca);
    textureStore(out, p, lvx_at(src, q));
}
