# V3: the ink-wash scroll (candidate for issue #4)

The page is one xuan-paper painting of a walled river city. The only chrome is two scroll rollers, a hanging slip carrying the fact, and a brush. Rewriting the fact makes the ink bleed outward from the slip across the painting, dissolves the city into wash and mist, and repaints mountains and reeds stroke by stroke. The finished painting then has depth you can look around in.

## Run

No build, no network. Open `rewrite-v3/index.html` directly (file://) or serve the repo root (`python3 -m http.server 8000`) and open `/rewrite-v3/`.

| Control | Action |
|---|---|
| Hold `Space` (or hold the slip / "Hold to rewrite") | strike the line; keep holding about 1.5 s. Releasing early cancels |
| Hold `C` or "Hold to compare" | show the old city without losing the new one |
| `Z` or "Undo" | the old city comes back, the haunting is reversed |
| Slider | scrub between the two paintings |
| Pointer | parallax (strong in the new world, nearly flat in the old) |
| "Reduced motion" button, or the OS setting | held keyframes 0 / 0.5 / 1 with a short crossfade, no drift or parallax |

Debug query params: `?t=0..1`, `?state=new`, `?w=0.6` (pen down), `?haunt=0..1`, `?reduced=1|0`, `?autoplay=1`. Params `t/w/state/haunt` freeze time so screenshots are deterministic. `window.__slice` exposes `setProgress(v)`, `getState()`, `fingerprint()`.

The fact is "City of Ashmere founded in year 42" becoming "City of Ashmere was never founded" (灰堡市建于永昌四十二年。 / 灰堡市从未建立。). The sandbox has no CJK fonts, so every Chinese string has an English caption below it.

## How it works

* `core.js`: pure logic. Seeded RNG, value noise, the brush stroke simulation (Catmull-Rom path, taper, wobble, dry-brush bristle dropout, wet halo), ridge lines, the arrival field (when the rewrite reaches each point of each plane), the state machine, `hauntState`. Unit tested in node.
* `paint.js`: canvas 2D. Brush sprites, paper (mottling plus fibre layer drawn over the ink), the old city, river, foreground pine, mist strips, the seal, the figure.
* `app.js`: five planes (far mountains, mid mountains, city, river, foreground), each with an *old* layer, a *new* layer and a composite. Per frame during a rewrite the old layer is eroded by a low-resolution arrival mask, a darker ink ring marks the front (the bleed, softened by bilinear upscaling), and new strokes are stamped onto the new layer in time order from a pre-generated list (about 38k stamps). The brush on screen follows the most recently laid stamp. Parallax offsets planes by depth; the amount rises as the painting becomes the new world.
* The old city, the river and the pine are drawn once at load and never swapped for a picture. The new world is never pre-rendered: it is laid down live from the stroke list.

## Haunting (caused by the rewrite)

Only after the world is NEW (and never during compare or after undo): a figure appears as a paper-white absence cut out of a dark wooded bank (it is the unpainted paper, not a drawn shape), slowly turns from back to front and two dark slits open in the hat; a vermilion seal lands where the city gate used to be; a margin note "He remembers year 42." appears on the slip. The seal is the only red on the page.

## Book-page deepening (issue #24, same PR)

The scroll is now framed as a history book page: rollers and a binding edge with a red stitched spine on the left, a folded page edge on the right, a "史书 卷一" label, and ink-bleed fibres drawn over the ink. The new world is still painted by the same stroke engine (erase, bleed, repaint). The haunting figure is cut out at the former city gate (`C.VANISHED`), matching the rewritten sentence. See `git diff` of `rewrite-v3/` for details.

Run entry: `python3 -m http.server 8000` then open `/rewrite-v3/index.html`; `file://` also works.

Evidence: `docs/screenshots/v3d-01-before.jpg` to `v3d-07-undo.jpg` (before, hold, rebuild, new dwell, haunt, compare, undo; real keyboard session, 1600x900), `v3d-before-after.jpg` (same composition side by side), `docs/video/v3-deep-flow.webm` (real session: early release cancel, full hold, rewrite, dwell, haunt, C compare, Z undo, reduced motion toggle and a second rewrite), raw logs in `docs/test-logs/`. The old `v3-0*.jpg` and `v3-flow.webm` are kept.

Unverified: Chinese glyphs are not visible in sandbox renders (no CJK fonts; only checked through DOM text), only headless Chromium on software rendering was tested, no real GPU or other browsers, no touch device.

Asset sources: all procedural, no external images, fonts or network.

## Art source

All procedural. No images, fonts or network. Only the idea of a small seeded RNG (mulberry32) is shared with other candidates; no code was copied from `rewrite/` (V1).

## Done / not done

Done: full flow (hold, cancel, rewrite, persist across reload, compare, undo, scrub), haunting, reduced motion, tests and a recorded flow video (`docs/video/v3-flow.webm`).
Not done / trade-offs: no audio; mountains are laid by position, so only reeds and ridges read as discrete strokes; the figure is a simple silhouette; the Chinese text is DOM text and cannot be seen in this sandbox's screenshots; rebuild on resize re-renders all layers (about 1 s in software rendering); old-city art is dense rather than refined.

## Tests

`node tests/run-v3.mjs` (unit and syntax), then with a server on :8000 `node tests/flow-v3.mjs`; screenshots `node tests/shoot-v3.mjs` into `docs/screenshots/v3-*.jpg`; video `node tests/record-v3.mjs`.

## Fundamental differences from the other candidates

| | Rendering | World model | What "rewrite" does | Interaction with the world |
|---|---|---|---|---|
| V1 `rewrite/` | canvas 2D, flat coloured dusk city inside a book | one model driven by t | buildings change colour and shape in a book page | book UI |
| V2 `rewrite-v2/` | CSS 3D DOM tabletop diorama | DOM boxes folded into the page | buildings sink, stones and tufts rise | orbit camera |
| **V3 ink** | canvas 2D stroke engine, monochrome ink on paper, no book | old ink layers and a live stroke list per depth plane | ink front erases old paint, new world is painted in front of you by a brush | pointer parallax; painting gains depth |
| V4 CCTV archive desk | (separate candidate, DOM/video-desk) | records | records are edited | desk |
| V5 paper-cut shadow theatre | (separate candidate) | layered cut paper and light | cut-outs swap | lamp |

V4 and V5 rows describe their stated concepts; see their own READMEs for details.
