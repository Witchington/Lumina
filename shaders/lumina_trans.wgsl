// Transitions for Lumina (EffectCraft Round 23): the steps EffectCraft does only on the CPU. Another layer placed over
// this one (transition::place_layer: Gradient Wipe's Gradient Placement, Card Wipe's back and gradient layers), Iris
// Wipe (transition::iris_wipe), CC Grid Wipe's coverage (transition::GridWipe::coverage, here in f32 relative to the
// centre), Card Wipe's cards (sim2::draw_pieces) and a plain multiply (Venetian Blinds' even veil). Ported from
// EffectCraft's crates/effects/src/transition.rs and sim2.rs (MIT licence). Compiles after EffectCraft's common.wgsl and
// kernels.wgsl. Coordinates are frame pixels; colours premultiplied, 0..1. Names lt_.

fn lt_pixel(gid: vec3<u32>) -> vec2<i32> {
    let d = out_dims();
    let p = vec2<i32>(gid.xy);
    if (p.x >= d.x || p.y >= d.y) {
        return vec2<i32>(-1);
    }
    return p;
}

fn lt_centre(p: vec2<i32>) -> vec2<f32> {
    return vec2<f32>(f32(p.x) + 0.5, f32(p.y) + 0.5);
}

fn lt_rem(a: f32, n: f32) -> f32 {
    return a - n * floor(a / n);
}

// src (the other layer as it sits in the frame) placed over this layer's box. u[0].x = mode (0 tile from the top-left,
// 1 centre once, 2 stretch to fit); f[0] = this layer's box (x, y, w, h), f[1] = the other's; f[2] = (this scale,
// the other's scale).
@compute @workgroup_size(16, 16)
fn lt_place(@builtin(global_invocation_id) gid: vec3<u32>) {
    let p = lt_pixel(gid);
    if (p.x < 0) {
        return;
    }
    let r = P.f[0];
    let o = P.f[1];
    let s = max(P.f[2].x, 1e-9);
    let os = max(P.f[2].y, 1e-9);
    let lp = (lt_centre(p) - r.xy) / s;
    let ls = r.zw / s;
    let osz = o.zw / os;
    var q = lp;
    if (P.u[0].x == 0u && osz.x >= 1.0 && osz.y >= 1.0) {
        q = vec2<f32>(lt_rem(lp.x, osz.x), lt_rem(lp.y, osz.y));
    } else if (P.u[0].x == 1u) {
        q = lp + (osz - ls) * 0.5;
    } else if (P.u[0].x == 2u && ls.x > 0.0 && ls.y > 0.0) {
        q = lp * osz / ls;
    }
    let at = o.xy + q * os;
    textureStore(out, p, sample_bilinear(src, at.x, at.y));
}

// src × f[0].x.
@compute @workgroup_size(16, 16)
fn lt_scale(@builtin(global_invocation_id) gid: vec3<u32>) {
    let p = lt_pixel(gid);
    if (p.x < 0) {
        return;
    }
    textureStore(out, p, textureLoad(src, p, 0) * P.f[0].x);
}

// Iris Wipe: a star or polygon hole of Outer (and Inner) Radius. u[0] = (corners, star); f[0] = (centre x, y, outer,
// inner); f[1] = (rotation in radians, feather).
@compute @workgroup_size(16, 16)
fn lt_iris(@builtin(global_invocation_id) gid: vec3<u32>) {
    let p = lt_pixel(gid);
    if (p.x < 0) {
        return;
    }
    let m = P.u[0].x;
    let star = P.u[0].y != 0u;
    let outer = P.f[0].z;
    let inner = P.f[0].w;
    let rot = P.f[1].x;
    let feather = P.f[1].y;
    let step = 6.283185307179586 / f32(m);
    let d = lt_centre(p) - P.f[0].xy;
    let r = length(d);
    var rb = min(outer, inner);
    if (r >= 1e-9) {
        let a = lt_rem(atan2(d.x, -d.y) - rot, 6.283185307179586);
        let i = min(u32(floor(a / step)), m - 1u);
        let j = (i + 1u) % m;
        let ri = select(outer, inner, star && i % 2u == 1u);
        let rj = select(outer, inner, star && j % 2u == 1u);
        let ai = rot + f32(i) * step;
        let aj = rot + f32(j) * step;
        let vi = vec2<f32>(ri * sin(ai), -ri * cos(ai));
        let vj = vec2<f32>(rj * sin(aj), -rj * cos(aj));
        let e = vj - vi;
        let dir = d / r;
        let den = dir.x * e.y - dir.y * e.x;
        if (abs(den) < 1e-12) {
            rb = outer;
        } else {
            rb = (vi.x * e.y - vi.y * e.x) / den;
        }
    }
    var k = 0.0;
    if (feather > 0.0) {
        k = clamp((r - rb) / feather + 0.5, 0.0, 1.0);
    } else if (r >= rb) {
        k = 1.0;
    }
    textureStore(out, p, textureLoad(src, p, 0) * k);
}

fn lt_metric(shape: u32, d: vec2<f32>) -> f32 {
    if (shape == 0u) {
        return abs(d.x);
    }
    if (shape == 2u) {
        return max(abs(d.x), abs(d.y));
    }
    return length(d);
}

// CC Grid Wipe: tiles shrinking away in order of their distance from the centre. u[0] = (shape, reverse);
// f[0] = (centre x, y, sin, cos); f[1] = (tile size, max distance, completion, border).
@compute @workgroup_size(16, 16)
fn lt_grid(@builtin(global_invocation_id) gid: vec3<u32>) {
    let p = lt_pixel(gid);
    if (p.x < 0) {
        return;
    }
    let s = P.f[0].z;
    let co = P.f[0].w;
    let cs = P.f[1].x;
    let maxd = P.f[1].y;
    let done = P.f[1].z;
    let border = P.f[1].w;
    let d = lt_centre(p) - P.f[0].xy;
    let q = vec2<f32>(d.x * co + d.y * s, -d.x * s + d.y * co);
    let c = (floor(q / cs) + 0.5) * cs;
    var o = clamp(lt_metric(P.u[0].x, c) / maxd, 0.0, 1.0);
    if (P.u[0].y != 0u) {
        o = 1.0 - o;
    }
    let spread = 0.25;
    let t = clamp((done * (1.0 + spread) - o) / spread, 0.0, 1.0);
    var k = 1.0;
    if (t > 0.0) {
        let half = cs * 0.5 * (1.0 - t);
        let m = max(abs(q.x - c.x), abs(q.y - c.y));
        if (border > 0.0) {
            k = clamp((half - m) / border + 0.5, 0.0, 1.0);
        } else {
            k = select(0.0, 1.0, m < half);
        }
    }
    textureStore(out, p, textureLoad(src, p, 0) * k);
}

// Card Wipe's cards (sim2::draw_pieces), far to near over a transparent frame: src = the front (this layer), aux = the
// back layer. data = tile lists then cards; a card is (screen → card-local inverse 3 × 3 by rows, rest centre x y,
// 4 corners x y, tint rgb, highlight rgb, faces away, back mirror, bounds x0 y0 x1 y1). u[0] = (cards at, stride,
// tiles x, has back).
fn lt_card_tile(p: vec2<i32>, tiles_x: u32) -> vec2<u32> {
    let tile = u32(p.y / 16) * tiles_x + u32(p.x / 16);
    return vec2<u32>(u32(data[tile]), u32(data[tile + 1u]));
}

fn lt_unpremul(c: vec4<f32>) -> vec4<f32> {
    if (c.w > 1e-6) {
        return vec4<f32>(c.xyz / c.w, c.w);
    }
    return vec4<f32>(0.0);
}

@compute @workgroup_size(16, 16)
fn lt_cards(@builtin(global_invocation_id) gid: vec3<u32>) {
    let p = lt_pixel(gid);
    if (p.x < 0) {
        return;
    }
    let stride = P.u[0].y;
    let rg = lt_card_tile(p, P.u[0].z);
    let f = lt_centre(p);
    var acc = vec4<f32>(0.0);
    for (var k = rg.x; k < rg.y; k++) {
        let at = P.u[0].x + u32(data[k]) * stride;
        let bb = at + stride - 4u;
        if (f32(p.x) < data[bb] || f32(p.y) < data[bb + 1u] || f32(p.x) > data[bb + 2u] || f32(p.y) > data[bb + 3u]) {
            continue;
        }
        let w = data[at + 6u] * f.x + data[at + 7u] * f.y + data[at + 8u];
        if (abs(w) < 1e-12) {
            continue;
        }
        let c0 = vec2<f32>(data[at + 9u], data[at + 10u]);
        let u = (data[at] * f.x + data[at + 1u] * f.y + data[at + 2u]) / w + c0.x;
        let v = (data[at + 3u] * f.x + data[at + 4u] * f.y + data[at + 5u]) / w + c0.y;
        var md = 3.0e38;
        for (var i = 0u; i < 4u; i++) {
            let j = (i + 1u) % 4u;
            let a = vec2<f32>(data[at + 11u + 2u * i], data[at + 12u + 2u * i]);
            let b = vec2<f32>(data[at + 11u + 2u * j], data[at + 12u + 2u * j]);
            let e = b - a;
            let l = max(length(e), 1e-6);
            md = min(md, (e.x * (v - a.y) - e.y * (u - a.x)) / l);
        }
        let cov = clamp(md + 1.0, 0.0, 1.0);
        if (cov <= 0.0) {
            continue;
        }
        let back = data[at + 25u] > 0.5;
        let mirror = data[at + 26u];
        var uv = vec2<f32>(u, v);
        if (back && mirror > 0.5 && mirror < 1.5) {
            uv.y = 2.0 * c0.y - v;
        } else if (back && mirror > 1.5) {
            uv.x = 2.0 * c0.x - u;
        }
        var tex: vec4<f32>;
        if (back && P.u[0].w != 0u) {
            tex = sample_bilinear(aux, uv.x, uv.y);
        } else {
            tex = sample_bilinear(src, uv.x, uv.y);
        }
        let s = lt_unpremul(tex);
        let a = s.w * cov;
        if (a <= 1e-6) {
            continue;
        }
        let tint = vec3<f32>(data[at + 19u], data[at + 20u], data[at + 21u]);
        let spec = vec3<f32>(data[at + 22u], data[at + 23u], data[at + 24u]);
        let o = vec4<f32>((s.xyz * tint + spec) * a, a);
        acc = o + acc * (1.0 - a);
    }
    textureStore(out, p, acc);
}
