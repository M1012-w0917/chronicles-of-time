# 改写现实 · 灰堡市 (Rewrite Reality vertical slice)

A standalone preview for issue #4. The product is the world: a full-screen canvas city at dusk. A heavy history book sits in a dock at the bottom and is only the medium. Rewriting one line in it rewrites the same place, continuously, into a city that was never built.

Design notes, tradeoffs and the done / not-done list are in [../docs/DESIGN.md](../docs/DESIGN.md).

## Run

Opening `rewrite/index.html` directly (file://) works. Or serve the repo:

```
python3 -m http.server 8000
# open http://localhost:8000/rewrite/
```

No build step, no network, no dependencies. Tests: `node tests/run.mjs`.

## Controls

| Action | Input |
|---|---|
| Write (rewrite the line) | Hold 按住落笔 for about 1.2 s (mouse, or hold Space / Enter) |
| Cancel | 取消 button |
| Raise / lower the book | B, or the handle under the book |
| Undo (reverse the rewrite) | Z, or 撤回 |
| Compare old and new history | Hold C, or drag the 原载 / 改写 slider |
| Reduce motion | 减弱动态 button (also follows `prefers-reduced-motion`) |
| Sound | 声音 button. Off by default, never autoplays |
| Gaze | Move the pointer after the rewrite. The figure follows it |

Releasing early cancels the write. After the rewrite finishes you stay in the new world. State is stored under the key `chronicles-of-time.slice.v1` in localStorage.

## Debug query parameters

`?t=0..1` fixed progress, `?state=new`, `?autoplay=1`, `?reduced=1`, `?time=N`, `?figure=1`, `?book=0`. Debug URLs do not save state. `window.__slice` exposes `setProgress` and `getState`.

## Files

- `index.html`, `style.css`: page, book (CSS and SVG filters), HUD
- `core.js`: pure logic (seeded RNG, erasure curve, state machine, hold timer), unit tested
- `world.js`: the canvas world from one shared model
- `book.js`: book, hold-to-write, undo, compare, sound, persistence

## Preview

There is no hosted URL. GitHub Pages is intentionally not touched for these candidates, so preview locally:

```
python3 -m http.server 8000
# open http://localhost:8000/rewrite/            (interactive)
# open http://localhost:8000/rewrite/?autoplay=1 (plays the rewrite by itself)
```

`rewrite/index.html` also works over file://. A recorded run of the whole flow (old city, pen down, rewriting, new city, haunting figure) is at [../docs/video/v1-flow.webm](../docs/video/v1-flow.webm); regenerate it with `node tests/record.mjs` (server on :8000).

## Chinese text and fonts (honest limitation)

The primary copy is Chinese, with font stacks listing Noto Serif CJK SC, Source Han Serif SC, Songti SC, SimSun, STKaiti and KaiTi. The sandbox this was built in has no CJK fonts (`fc-list :lang=zh` is empty), so Chinese glyphs render blank there. Screenshots and the video therefore show the English glosses (small italic lines under each Chinese string, and English text on the canvas signs), and the Chinese itself is verified only through DOM text assertions in `tests/flow.mjs`. Chinese glyph rendering has not been looked at by eye in this environment.
