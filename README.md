# Lumina

A video editor for everything: timeline editing, effects, motion, text, 3D and a link converter, in one app.

## Download

Go to **Releases** (right side of this page) and pick the newest version:

- **Windows:** `Lumina-Setup-<version>.exe`. Run it, choose a folder, and it adds desktop and Start menu shortcuts.
- **Linux:** `Lumina-<version>-Linux-x86_64.AppImage`. Make it executable (`chmod +x Lumina-*.AppImage`) and run it.
  If the picture is black or glitchy, start it with `LUMINA_SOFTWARE=1` (no GPU) or `LUMINA_X11=1` (X11 instead of Wayland).

The converter only downloads media you have the rights to use.

## Licence

Lumina is free to download and use, but its own code is all rights reserved (see `LICENSE`).
The parts made by other people (EffectCraft, FFmpeg, three.js, MediaPipe, Transformers.js, the fonts)
keep their own open-source licences, listed in `THIRD-PARTY-NOTICES.md`.

## Build it yourself

Needs Node.js 22.

```
npm ci
npm run dist          # Windows setup, in dist\
npm run dist:linux    # Linux AppImage (build this on Linux)
```

Push a tag like `v0.10.0` (after setting that version in `package.json`) and GitHub builds both downloads and puts them on a release.
