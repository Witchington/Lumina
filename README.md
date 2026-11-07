# Lumina

A video editor for everything: timeline editing, effects, motion, text, 3D and a link converter, in one app.

## Download

Go to **Releases** (right side of this page) and pick the newest version:

- **Windows:** `Lumina-Setup-<version>.exe`. Run it, choose a folder, and it adds desktop and Start menu shortcuts.
- **Linux:** `Lumina-<version>-Linux-x86_64.AppImage`. Make it executable (`chmod +x Lumina-*.AppImage`) and run it.
  If the picture is black or glitchy, start it with `LUMINA_SOFTWARE=1` (no GPU) or `LUMINA_X11=1` (X11 instead of Wayland).

The converter only downloads media you have the rights to use.

## Build it yourself

Needs Node.js 22.

```
npm ci
npm run dist          # Windows setup, in dist\
npm run dist:linux    # Linux AppImage (build this on Linux)
```

Push a tag like `v0.9.2` (after setting that version in `package.json`) and GitHub builds both downloads and puts them on a release.
