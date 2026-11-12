// Time effects for Lumina (EffectCraft Round 25). EffectCraft does these steps on the CPU: Time Displacement's per-pixel
// time step (time_fx::time_displacement), Timewarp's and Pixel Motion Blur's block-matching motion vectors
// (raster::flow::block_flow_window and time_fx::smooth_flow), their Source Crops and Matte Layer planes, Camera-Shake
// Deblur's patch blending (blur3::camera_shake_deblur) and Rolling Shutter Repair's resampling (distort4::rolling_shutter).
// Here they run on the graphics card with the same arithmetic. Lumina's working image is the whole frame; the layer's
// on-screen box stands in for EffectCraft's layer buffer where it matters. Ported from EffectCraft's
// crates/effects/src/time_fx.rs, blur3.rs, distort4.rs and crates/raster/src/flow.rs (MIT licence). Compiles after
// EffectCraft's common.wgsl and kernels.wgsl. Names lm_.

fn lm_in(p: vec2<i32>) -> bool {
    let d = out_dims();
    return p.x < d.x && p.y < d.y;
}

// f64's round (half away from zero)
fn lm_round(x: f32) -> f32 {
    return sign(x) * floor(abs(x) + 0.5);
}

// ---------------------------------------------------------------- Time Displacement

// The map's step per pixel: src = the map; f[0] = (max displacement, step). out.r = (k + 128) / 255, so it reads back exactly.
@compute @workgroup_size(16, 16)
fn lm_tkey(@builtin(global_invocation_id) gid: vec3<u32>) {
    let p = vec2<i32>(gid.xy);
    if (!lm_in(p)) {
        return;
    }
    let m = textureLoad(src, p, 0);
    var l = 0.5;
    if (m.w > 0.0) {
        l = luminance(m.xyz / m.w);
    }
    let k = clamp(lm_round(((l - 0.5) * 2.0 * P.f[0].x) / P.f[0].y), -127.0, 127.0);
    textureStore(out, p, vec4<f32>((k + 128.0) / 255.0, 0.0, 0.0, 1.0));
}

// One pass per sampled time: src = the result so far, aux = that time's frame, data = lm_tkey's plane as rows of
// u[0].x pixels; pixels whose step is f[0].x (k + 128) take the frame.
@compute @workgroup_size(16, 16)
fn lm_tdisp(@builtin(global_invocation_id) gid: vec3<u32>) {
    let p = vec2<i32>(gid.xy);
    if (!lm_in(p)) {
        return;
    }
    let k = round(data[(u32(p.y) * P.u[0].x + u32(p.x)) * 4u] * 255.0);
    if (k == P.f[0].x) {
        textureStore(out, p, textureLoad(aux, p, 0));
    } else {
        textureStore(out, p, textureLoad(src, p, 0));
    }
}

// ---------------------------------------------------------------- Timewarp / Pixel Motion Blur

// time_fx::crop_edges: each pixel from the nearest one inside f[0] = (x0, y0, x1, y1), inclusive.
@compute @workgroup_size(16, 16)
fn lm_crop(@builtin(global_invocation_id) gid: vec3<u32>) {
    let p = vec2<i32>(gid.xy);
    if (!lm_in(p)) {
        return;
    }
    let lo = vec2<i32>(P.f[0].xy);
    let hi = max(vec2<i32>(P.f[0].zw), lo);
    textureStore(out, p, tex_get(src, clamp(p.x, lo.x, hi.x), clamp(p.y, lo.y, hi.y)));
}

// motion_grey then flow's Plane::luma, for frames a (src) and b (aux) at once: out = (luma a, luma b, 0, 1).
// f[0] = (red, green, blue weighting, b's gain).
fn lm_luma(c: vec4<f32>, gain: f32) -> f32 {
    let wt = P.f[0].xyz;
    let sum = max(wt.x + wt.y + wt.z, 1e-6);
    let g = (c.x * wt.x + c.y * wt.y + c.z * wt.z) / sum * gain;
    return 0.2126 * g + 0.7152 * g + 0.0722 * g + 0.25 * c.w;
}

@compute @workgroup_size(16, 16)
fn lm_grey(@builtin(global_invocation_id) gid: vec3<u32>) {
    let p = vec2<i32>(gid.xy);
    if (!lm_in(p)) {
        return;
    }
    textureStore(out, p, vec4<f32>(lm_luma(textureLoad(src, p, 0), 1.0), lm_luma(textureLoad(aux, p, 0), P.f[0].w), 0.0, 1.0));
}

// Plane::half for both planes (2 × 2 average, edges repeated).
@compute @workgroup_size(16, 16)
fn lm_half(@builtin(global_invocation_id) gid: vec3<u32>) {
    let p = vec2<i32>(gid.xy);
    if (!lm_in(p)) {
        return;
    }
    let d = vec2<i32>(textureDimensions(src)) - 1;
    let x = p.x * 2;
    let y = p.y * 2;
    let g00 = textureLoad(src, vec2<i32>(min(x, d.x), min(y, d.y)), 0).xy;
    let g10 = textureLoad(src, vec2<i32>(min(x + 1, d.x), min(y, d.y)), 0).xy;
    let g01 = textureLoad(src, vec2<i32>(min(x, d.x), min(y + 1, d.y)), 0).xy;
    let g11 = textureLoad(src, vec2<i32>(min(x + 1, d.x), min(y + 1, d.y)), 0).xy;
    textureStore(out, p, vec4<f32>((g00 + g10 + g01 + g11) * 0.25, 0.0, 1.0));
}

// flow::sad on the plane pair in `src` (a in .x, b in .y), edges repeated.
fn lm_sad(bx: i32, by: i32, bs: i32, dx: i32, dy: i32) -> f32 {
    let d = vec2<i32>(textureDimensions(src)) - 1;
    var s = 0.0;
    for (var y = by; y < by + bs; y++) {
        for (var x = bx; x < bx + bs; x++) {
            let a = textureLoad(src, vec2<i32>(clamp(x, 0, d.x), clamp(y, 0, d.y)), 0).x;
            let b = textureLoad(src, vec2<i32>(clamp(x + dx, 0, d.x), clamp(y + dy, 0, d.y)), 0).y;
            s += abs(a - b);
        }
    }
    return s;
}

// One pyramid level of block_flow_window's search, one invocation per block: src = the level's planes, aux = the
// level above's vectors (cols × rows). u[0] = (cols, rows, top level, radius), u[1] = (level scale k, window at this
// level, tile, window offset as i32). out = the best integer shift.
@compute @workgroup_size(16, 16)
fn lm_bsearch(@builtin(global_invocation_id) gid: vec3<u32>) {
    let cols = i32(P.u[0].x);
    let rows = i32(P.u[0].y);
    let c = i32(gid.x);
    let rr = i32(gid.y);
    if (c >= cols || rr >= rows) {
        return;
    }
    let top = P.u[0].z != 0u;
    let r = i32(P.u[0].w);
    let k = i32(P.u[1].x);
    let lbs = i32(P.u[1].y);
    let bs = i32(P.u[1].z);
    let wo = bitcast<i32>(P.u[1].w);
    let bx = (c * bs + wo) / k;
    let by = (rr * bs + wo) / k;
    var seeds: array<vec2<i32>, 6>;
    seeds[0] = vec2<i32>(0, 0);
    var n = 1;
    if (!top) {
        let offs = array<vec2<i32>, 5>(vec2<i32>(0, 0), vec2<i32>(-1, 0), vec2<i32>(1, 0), vec2<i32>(0, -1), vec2<i32>(0, 1));
        for (var i = 0; i < 5; i++) {
            let nc = c + offs[i].x;
            let nr = rr + offs[i].y;
            if (nc >= 0 && nr >= 0 && nc < cols && nr < rows) {
                let v = textureLoad(aux, vec2<i32>(nc, nr), 0).xy;
                seeds[n] = vec2<i32>(i32(v.x) * 2, i32(v.y) * 2);
                n++;
            }
        }
    }
    // sort_unstable + dedup: ascending by x, then y
    for (var i = 1; i < n; i++) {
        var j = i;
        while (j > 0 && (seeds[j - 1].x > seeds[j].x || (seeds[j - 1].x == seeds[j].x && seeds[j - 1].y > seeds[j].y))) {
            let t = seeds[j - 1];
            seeds[j - 1] = seeds[j];
            seeds[j] = t;
            j--;
        }
    }
    var best = vec2<i32>(0, 0);
    var be = 3.0e38;
    for (var i = 0; i < n; i++) {
        if (i > 0 && all(seeds[i] == seeds[i - 1])) {
            continue;
        }
        let s = seeds[i];
        for (var dy = -r; dy <= r; dy++) {
            for (var dx = -r; dx <= r; dx++) {
                let d = vec2<i32>(s.x + dx, s.y + dy);
                let e = lm_sad(bx, by, lbs, d.x, d.y) + 1e-4 * f32(abs(d.x) + abs(d.y));
                if (e < be) {
                    best = d;
                    be = e;
                }
            }
        }
    }
    textureStore(out, vec2<i32>(c, rr), vec4<f32>(f32(best.x), f32(best.y), 0.0, 1.0));
}

// block_flow_window's sub-pixel refinement at full size: src = level 0's planes, aux = the integer vectors.
// u[0] = (cols, rows, tile, window), u[1].x = window offset (i32).
fn lm_fit(em: f32, e0: f32, ep: f32) -> f32 {
    let den = em - 2.0 * e0 + ep;
    if (den > 1e-6) {
        return clamp(0.5 * (em - ep) / den, -0.5, 0.5);
    }
    return 0.0;
}

@compute @workgroup_size(16, 16)
fn lm_bfine(@builtin(global_invocation_id) gid: vec3<u32>) {
    let cols = i32(P.u[0].x);
    let rows = i32(P.u[0].y);
    let c = i32(gid.x);
    let r = i32(gid.y);
    if (c >= cols || r >= rows) {
        return;
    }
    let bs = i32(P.u[0].z);
    let win = i32(P.u[0].w);
    let wo = bitcast<i32>(P.u[1].x);
    let bx = c * bs + wo;
    let by = r * bs + wo;
    let d = vec2<i32>(textureLoad(aux, vec2<i32>(c, r), 0).xy);
    let e0 = lm_sad(bx, by, win, d.x, d.y);
    let sx = lm_fit(lm_sad(bx, by, win, d.x - 1, d.y), e0, lm_sad(bx, by, win, d.x + 1, d.y));
    let sy = lm_fit(lm_sad(bx, by, win, d.x, d.y - 1), e0, lm_sad(bx, by, win, d.x, d.y + 1));
    textureStore(out, vec2<i32>(c, r), vec4<f32>(f32(d.x) + sx, f32(d.y) + sy, 0.0, 1.0));
}

// The 3 × 3 median of the vectors (each component on its own). src = the vectors; u[0] = (cols, rows).
@compute @workgroup_size(16, 16)
fn lm_bmed(@builtin(global_invocation_id) gid: vec3<u32>) {
    let cols = i32(P.u[0].x);
    let rows = i32(P.u[0].y);
    let c = i32(gid.x);
    let r = i32(gid.y);
    if (c >= cols || r >= rows) {
        return;
    }
    var xs: array<f32, 9>;
    var ys: array<f32, 9>;
    var n = 0;
    for (var dr = -1; dr <= 1; dr++) {
        for (var dc = -1; dc <= 1; dc++) {
            let nc = c + dc;
            let nr = r + dr;
            if (nc >= 0 && nr >= 0 && nc < cols && nr < rows) {
                let v = textureLoad(src, vec2<i32>(nc, nr), 0).xy;
                xs[n] = v.x;
                ys[n] = v.y;
                n++;
            }
        }
    }
    for (var i = 1; i < n; i++) {
        var j = i;
        while (j > 0 && xs[j - 1] > xs[j]) {
            let t = xs[j - 1];
            xs[j - 1] = xs[j];
            xs[j] = t;
            j--;
        }
        j = i;
        while (j > 0 && ys[j - 1] > ys[j]) {
            let t = ys[j - 1];
            ys[j - 1] = ys[j];
            ys[j] = t;
            j--;
        }
    }
    textureStore(out, vec2<i32>(c, r), vec4<f32>(xs[n / 2], ys[n / 2], 0.0, 1.0));
}

// smooth_flow's step: each vector pulled toward its (2 rad + 1)² mean by f[0].x × ½. u[0] = (cols, rows, rad).
@compute @workgroup_size(16, 16)
fn lm_fmean(@builtin(global_invocation_id) gid: vec3<u32>) {
    let cols = i32(P.u[0].x);
    let rows = i32(P.u[0].y);
    let x = i32(gid.x);
    let y = i32(gid.y);
    if (x >= cols || y >= rows) {
        return;
    }
    let rad = i32(P.u[0].z);
    var s = vec2<f32>(0.0);
    var n = 0.0;
    for (var dy = -rad; dy <= rad; dy++) {
        for (var dx = -rad; dx <= rad; dx++) {
            let nx = x + dx;
            let ny = y + dy;
            if (nx >= 0 && ny >= 0 && nx < cols && ny < rows) {
                s += textureLoad(src, vec2<i32>(nx, ny), 0).xy;
                n += 1.0;
            }
        }
    }
    let v = textureLoad(src, vec2<i32>(x, y), 0).xy;
    let m = s / n;
    textureStore(out, vec2<i32>(x, y), vec4<f32>(v + (m - v) * P.f[0].x * 0.5, 0.0, 1.0));
}

// Flow::at on the vectors in `data` (lm_fmean's texture copied as rows of u[1].x pixels).
fn lm_flow_at(x: f32, y: f32) -> vec2<f32> {
    let cols = P.u[0].x;
    let rows = P.u[0].y;
    if (cols == 0u || rows == 0u) {
        return vec2<f32>(0.0);
    }
    let row = P.u[1].x;
    let b = P.f[0].x;
    let fx = clamp(x / b - 0.5, 0.0, f32(cols - 1u));
    let fy = clamp(y / b - 0.5, 0.0, f32(rows - 1u));
    let x0 = u32(floor(fx));
    let y0 = u32(floor(fy));
    let x1 = min(x0 + 1u, cols - 1u);
    let y1 = min(y0 + 1u, rows - 1u);
    let tx = fx - f32(x0);
    let ty = fy - f32(y0);
    let g00 = vec2<f32>(data[(y0 * row + x0) * 4u], data[(y0 * row + x0) * 4u + 1u]);
    let g10 = vec2<f32>(data[(y0 * row + x1) * 4u], data[(y0 * row + x1) * 4u + 1u]);
    let g01 = vec2<f32>(data[(y1 * row + x0) * 4u], data[(y1 * row + x0) * 4u + 1u]);
    let g11 = vec2<f32>(data[(y1 * row + x1) * 4u], data[(y1 * row + x1) * 4u + 1u]);
    let top = g00 + (g10 - g00) * tx;
    let bot = g01 + (g11 - g01) * tx;
    return top + (bot - top) * ty;
}

// fx_time's ftm_motion (time_fx::timewarp_interpolate) with the vectors read from rows: src = frame a, aux = frame b.
// u[0] = (columns, rows, extreme filtering, build from one image), u[1].x = the rows' length; f[0] = (vector spacing,
// fraction w, error threshold).
fn lm_sample(t: texture_2d<f32>, x: f32, y: f32) -> vec4<f32> {
    if (P.u[0].z != 0u) {
        return sample_bicubic(t, x, y);
    }
    return sample_bilinear_clamped(t, x, y);
}

@compute @workgroup_size(16, 16)
fn lm_motion(@builtin(global_invocation_id) gid: vec3<u32>) {
    let p = vec2<i32>(gid.xy);
    if (!lm_in(p)) {
        return;
    }
    let cx = f32(p.x) + 0.5;
    let cy = f32(p.y) + 0.5;
    let f = lm_flow_at(cx, cy);
    let w = P.f[0].y;
    var pa = lm_sample(src, cx - w * f.x, cy - w * f.y);
    var pb = lm_sample(aux, cx + (1.0 - w) * f.x, cy + (1.0 - w) * f.y);
    if (P.u[0].w != 0u) {
        textureStore(out, p, select(pb, pa, w < 0.5));
        return;
    }
    let d = abs(pa - pb);
    let err = max(max(d.x, d.y), max(d.z, d.w));
    let thr = P.f[0].z;
    if (thr > 0.0 && err > thr && thr < 1.0) {
        pa = textureLoad(src, p, 0);
        pb = textureLoad(aux, p, 0);
    }
    textureStore(out, p, pa + (pb - pa) * w);
}

// time_fx::matte_of: the matte plane of a matte layer frame. u[0].x = Matte Channel (alpha, inverted alpha,
// luminance, inverted luminance).
fn lm_matte(m: vec4<f32>) -> f32 {
    var c = vec3<f32>(0.0);
    let a = max(m.w, 0.0);
    if (m.w > 1e-6) {
        c = m.xyz / m.w;
    }
    let l = (0.2126 * c.x + 0.7152 * c.y + 0.0722 * c.z) * a;
    var k = a;
    switch P.u[0].x {
        case 1u: {
            k = 1.0 - a;
        }
        case 2u: {
            k = l;
        }
        case 3u: {
            k = 1.0 - l;
        }
        default: {}
    }
    return clamp(k, 0.0, 1.0);
}

// times_mask: src × the matte of aux (u[0].y = inverted).
@compute @workgroup_size(16, 16)
fn lm_mmask(@builtin(global_invocation_id) gid: vec3<u32>) {
    let p = vec2<i32>(gid.xy);
    if (!lm_in(p)) {
        return;
    }
    var k = lm_matte(textureLoad(aux, p, 0));
    if (P.u[0].y != 0u) {
        k = 1.0 - k;
    }
    textureStore(out, p, textureLoad(src, p, 0) * k);
}

// matte_image: the matte of src as opaque grey.
@compute @workgroup_size(16, 16)
fn lm_mimage(@builtin(global_invocation_id) gid: vec3<u32>) {
    let p = vec2<i32>(gid.xy);
    if (!lm_in(p)) {
        return;
    }
    let k = lm_matte(textureLoad(src, p, 0));
    textureStore(out, p, vec4<f32>(k, k, k, 1.0));
}

// ---------------------------------------------------------------- Camera-Shake Deblur

// The patch grid over the layer's box: data = per patch (neighbour, dx, dy, _), neighbour −1 = keep this frame's pixel.
// u[0] = (mode, neighbour, columns, rows); f[0] = the box (x, y, width, height); f[1] = (patch size, strength, show
// blurry frames). Mode 0 adds the feathered share of the patches that use neighbour u[0].y (0xffffffff: keep) from
// aux to src; mode 1 finishes (src = the sum, aux = this frame).
fn lm_patch(i: u32) -> vec4<f32> {
    return vec4<f32>(data[i * 4u], data[i * 4u + 1u], data[i * 4u + 2u], 0.0);
}

@compute @workgroup_size(16, 16)
fn lm_deblur(@builtin(global_invocation_id) gid: vec3<u32>) {
    let p = vec2<i32>(gid.xy);
    if (!lm_in(p)) {
        return;
    }
    let o = vec2<i32>(P.f[0].xy);
    let bw = i32(P.f[0].z);
    let bh = i32(P.f[0].w);
    let x = p.x - o.x;
    let y = p.y - o.y;
    let mode = P.u[0].x;
    if (x < 0 || y < 0 || x >= bw || y >= bh) {
        textureStore(out, p, select(textureLoad(src, p, 0), textureLoad(aux, p, 0), mode == 1u));
        return;
    }
    let nx = P.u[0].z;
    let ny = P.u[0].w;
    let psz = P.f[1].x;
    let fy = clamp((f32(y) + 0.5) / psz - 0.5, 0.0, f32(ny - 1u));
    let y0 = u32(floor(fy));
    let ty = fy - floor(fy);
    let y1 = min(y0 + 1u, ny - 1u);
    let fx = clamp((f32(x) + 0.5) / psz - 0.5, 0.0, f32(nx - 1u));
    let x0 = u32(floor(fx));
    let tx = fx - floor(fx);
    let x1 = min(x0 + 1u, nx - 1u);
    let ids = array<u32, 4>(y0 * nx + x0, y0 * nx + x1, y1 * nx + x0, y1 * nx + x1);
    let ws = array<f32, 4>((1.0 - tx) * (1.0 - ty), tx * (1.0 - ty), (1.0 - tx) * ty, tx * ty);
    var none = true;
    for (var i = 0; i < 4; i++) {
        if (lm_patch(ids[i]).x >= 0.0) {
            none = false;
        }
    }
    if (mode == 1u) {
        let s0 = textureLoad(aux, p, 0);
        if (none) {
            textureStore(out, p, s0);
            return;
        }
        var acc = textureLoad(src, p, 0);
        let strength = P.f[1].y;
        if (strength != 1.0) {
            acc = s0 + (acc - s0) * strength;
            acc = vec4<f32>(max(acc.xyz, vec3<f32>(0.0)), clamp(acc.w, 0.0, 1.0));
        }
        if (P.f[1].z != 0.0) {
            acc.x = min(acc.x + 0.3 * acc.w, max(acc.w, acc.x));
        }
        textureStore(out, p, acc);
        return;
    }
    var acc = textureLoad(src, p, 0);
    if (!none) {
        let want = bitcast<i32>(P.u[0].y);
        for (var i = 0; i < 4; i++) {
            let c = lm_patch(ids[i]);
            if (i32(c.x) != want) {
                continue;
            }
            if (want < 0) {
                acc += textureLoad(aux, p, 0) * ws[i];
            } else {
                let q = vec2<i32>(clamp(x + i32(c.y), 0, bw - 1), clamp(y + i32(c.z), 0, bh - 1)) + o;
                acc += textureLoad(aux, q, 0) * ws[i];
            }
        }
    }
    textureStore(out, p, acc);
}

// ---------------------------------------------------------------- Rolling Shutter Repair

// distort4::rolling_shutter's resampling: out(p) = in(p + v(p) · rate · (s(p) − ½)) inside the layer's box, read with
// the box's edge pixels repeated. data = the velocity grid (x, y pairs). u[0] = (scan direction, columns, rows);
// f[0] = the box (x, y, width, height); f[1] = (rate, cell size).
@compute @workgroup_size(16, 16)
fn lm_rsr(@builtin(global_invocation_id) gid: vec3<u32>) {
    let p = vec2<i32>(gid.xy);
    if (!lm_in(p)) {
        return;
    }
    let o = vec2<i32>(P.f[0].xy);
    let bw = i32(P.f[0].z);
    let bh = i32(P.f[0].w);
    let x = p.x - o.x;
    let y = p.y - o.y;
    if (x < 0 || y < 0 || x >= bw || y >= bh) {
        textureStore(out, p, textureLoad(src, p, 0));
        return;
    }
    let fx = f32(x) + 0.5;
    let fy = f32(y) + 0.5;
    var s = fy / f32(bh);
    switch P.u[0].x {
        case 1u: {
            s = 1.0 - fy / f32(bh);
        }
        case 2u: {
            s = fx / f32(bw);
        }
        case 3u: {
            s = 1.0 - fx / f32(bw);
        }
        default: {}
    }
    let tau = P.f[1].x * (s - 0.5);
    // Flow::at
    let nx = P.u[0].y;
    let ny = P.u[0].z;
    let cell = P.f[1].y;
    let gx = clamp(fx / cell - 0.5, 0.0, f32(nx - 1u));
    let gy = clamp(fy / cell - 0.5, 0.0, f32(ny - 1u));
    let x0 = u32(floor(gx));
    let y0 = u32(floor(gy));
    let x1 = min(x0 + 1u, nx - 1u);
    let y1 = min(y0 + 1u, ny - 1u);
    let tx = gx - f32(x0);
    let ty = gy - f32(y0);
    let g00 = vec2<f32>(data[(y0 * nx + x0) * 2u], data[(y0 * nx + x0) * 2u + 1u]);
    let g10 = vec2<f32>(data[(y0 * nx + x1) * 2u], data[(y0 * nx + x1) * 2u + 1u]);
    let g01 = vec2<f32>(data[(y1 * nx + x0) * 2u], data[(y1 * nx + x0) * 2u + 1u]);
    let g11 = vec2<f32>(data[(y1 * nx + x1) * 2u], data[(y1 * nx + x1) * 2u + 1u]);
    let v = mix(mix(g00, g10, tx), mix(g01, g11, tx), ty);
    // sample_bilinear_clamped inside the box
    let sx = fx + v.x * tau - 0.5;
    let sy = fy + v.y * tau - 0.5;
    let ix = i32(floor(sx));
    let iy = i32(floor(sy));
    let ax = sx - floor(sx);
    let ay = sy - floor(sy);
    let a = textureLoad(src, vec2<i32>(clamp(ix, 0, bw - 1), clamp(iy, 0, bh - 1)) + o, 0);
    let b = textureLoad(src, vec2<i32>(clamp(ix + 1, 0, bw - 1), clamp(iy, 0, bh - 1)) + o, 0);
    let c = textureLoad(src, vec2<i32>(clamp(ix, 0, bw - 1), clamp(iy + 1, 0, bh - 1)) + o, 0);
    let d = textureLoad(src, vec2<i32>(clamp(ix + 1, 0, bw - 1), clamp(iy + 1, 0, bh - 1)) + o, 0);
    let top = a + (b - a) * ax;
    let bot = c + (d - c) * ax;
    textureStore(out, p, top + (bot - top) * ay);
}
