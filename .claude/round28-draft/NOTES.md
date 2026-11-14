# Round 28 drafts

- `r28.py` puts `helpers.js`, `surfaces.js` and `effects.js` into Lumina.html and changes the shared helpers
  (fxSpriteTable's item kind and back texture, fxChunked's item kind, fxSpritePost's 'black', fxPiece's winding).
- `r28test.py` adds the fx suite's Round 28 checks; `r28docs.py` updates ROADMAP.md and WORKPLAN.md.
- Two speed changes were made in place after `r28.py` ran (see the commit's diff):
  - `fxOrderDesc` became a radix sort (fxSortF32 on −z) instead of Array.sort; its callers use `Array.from(order, …)`.
  - `fxPixelPolly`'s loop works out sim2's Piece::new inline and writes straight into piece_pass's table (102 ms → 28 ms
    a frame at the defaults; the pictures are the same). `helpers.js` still has the first, slower version.
  - Two test thresholds changed: bright balls are counted at > 90 (they are 0.8 px shaded spheres), and Pixel Polly's
    pieces mostly leave the frame by 1 s.
