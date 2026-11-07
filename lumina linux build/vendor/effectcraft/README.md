# EffectCraft shaders (third-party)

The `.wgsl` files in `shaders/` are copied unchanged from **EffectCraft**,
https://github.com/storytold/effectcraft, at commit
`3768ff40a300758e9055ab87bfaaeea6d4bd774e` (2026-11-05).

EffectCraft is dual-licensed MIT or Apache-2.0. Lumina uses these files under the
**MIT licence**; see `LICENSE-MIT`. Their `LICENSE-APACHE` and `NOTICE` are kept here too.
EffectCraft's brand marks (ArtCraft) are not covered by that licence and are not used.

Credits the shader comments mention that EffectCraft's own attribution file does not list:
- `common.wgsl` `asin_p`: based on the Cephes math library's `asinf` polynomial.
- `fx_lut.wgsl`: follows OpenColorIO's transform structures (ASC CDL, ACEScc).

Lumina's JavaScript host code (parameter packing and pass order, in `Lumina.html`,
section "effects on the graphics card") is a port of EffectCraft's Rust host code in
`crates/gpu/src` (same licence).

To update: download the shader files at a newer commit, replace these, update the commit
above, and rerun Lumina's effects test suite (`.claude/fx`).
