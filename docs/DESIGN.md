# Design: Rewrite Reality vertical slice (issue #4)

Branch: `feat/rewrite-reality-slice` (from `feat/static-demo`). Everything lives in `rewrite/`, `tests/`, `docs/`. The existing root files are unchanged except for a pointer in `README.md`.

## Run locally

```
python3 -m http.server 8000
# http://localhost:8000/rewrite/    (rewrite/index.html also works over file://)
node tests/run.mjs                  # unit tests + node --check on all JS
```

Controls are listed in [rewrite/README.md](../rewrite/README.md).

## Idea

The first demo made the book the spectacle and the world a side effect. This slice reverses that. The player sees a living city and rewrites one sentence, 「灰堡市建于永昌四十二年。」 to 「灰堡市从未建立。」. The same location is rewritten in about 9 seconds. The horizon, hills and river stay as anchors, so it reads as the same place with a different history.

## Visual design plan

- **One world model, not two images.** A single deterministic scene (seeded RNG) is drawn on a 2D canvas from a progress value t in [0,1]. There is no crossfade between pictures. Scrubbing t shows every intermediate state, which is what undo and compare use.
- **Old world:** dusk gradient sky, clouds, far hills, about 40 buildings in depth layers with lit windows, chimneys, a clock tower, a bridge, river with boats, street with lamps and cobbles, a cart, about 25 pedestrians, smoke, birds, the sign "City of Ashmere / 灰堡市", and a wall map. Light haze with depth, film grain, vignette, slight camera drift.
- **Rewrite:** each entity has its own erasure threshold and a spatial wave that starts at the pen and moves outward. Buildings sink from an ink-like edge, decompose to scaffolding, then foundation lines, then grass. Windows go out one by one. Lamps go dark and fall. People fade to outlines and vanish, and some freeze and look up. Roads fray into dirt tracks and grass. Smoke stops. The light turns cold dawn grey with stars.
- **New world:** wild meadow and reeds, wind-moved grass, standing stones. The sign becomes a weathered stone reading "Ashmere Meadow / 灰堡草甸". The wall map now shows only a river and meadow, with the entry "no settlement recorded". Everything looks like it has always been this way.
- **Haunting consequence:** a few seconds after the new world settles, the old lamplighter stands where the street was, lantern still lit. He slowly turns to look at the camera, and his gaze follows the pointer slightly. Faint traces of the old street appear only around him: lamp base stones, a cobble patch, a window that floats briefly. The book page gains a line in the user's hand: 「只有他记得。」 No jump scares and no loud audio. An optional quiet synthesized wind drone is off by default.
- **Book:** leather cover, page-edge stacks, parchment from CSS gradients and SVG feTurbulence, ink look from a kaiti / serif system stack, deckled edge, ribbon. Hold-to-write has a quill, ink blots, a struck-out old line and a new line bleeding in. It docks low so the world dominates.
- **Reduced motion:** the rewrite becomes a staged crossfade of three held keyframes of the same model in at most 1.2 s, with no parallax, grain or shake. There is also a manual toggle.
- **Accessibility and performance:** keyboard controls, aria labels, focus rings. Device pixel ratio is capped, static layers are cached to offscreen canvases, and the loop pauses when the tab is hidden.

## Tradeoffs

- **Procedural canvas instead of image assets.** No downloads or licensing, the scene can be continuous in t, and the repo stays small. The cost is that the art is stylized and flat compared with painted work. Clouds are soft blurred blobs and look rough.
- **Plain scripts, no modules or build.** Works over file://, matching the existing demo. The cost is globals and a large `world.js`.
- **One scripted fact.** Only one rewrite is supported, to show the idea well. The older demo's three facts and costs are not carried over.
- **Chinese copy depends on system fonts.** The sandbox used for screenshots has no CJK fonts, so Chinese text is blank in the PNGs. The layout is verified, but the Chinese rendering is not visible in the screenshots. On a normal desktop it renders.

## Art source and license

All art is original and generated in code (canvas 2D, CSS, SVG filters, WebAudio). No third-party images, fonts, audio or libraries are bundled or fetched. No external license applies.

## Screenshots

Captured from the running slice by `tests/shoot.mjs` in headless Chromium (chrome-headless-shell via playwright-core). In `docs/screenshots/`:

| File | Content |
|---|---|
| `a-old.png` | Old world, t=0 |
| `b-t35.png` | Rewriting, t=0.35 |
| `c-t65.png` | Rewriting, t=0.65 |
| `d-new.png` | New world with the figure state |
| `e-pen-down.png` | Hold in progress, book writing |
| `f-rewriting.png` | Mid rewrite after real hold |
| `g-haunt-gaze.png` | Lamplighter looking toward the pointer |
| `h-reduced-new.png` | Reduced-motion path, new world |
| `i-autoplay.png` | `?autoplay=1` run |

## Done / not done

Done:
- Continuous world rewrite from a single state model, OLD, WRITING, REWRITING, NEW
- Undo (reverse timeline), compare hold and scrub slider, persistence
- Retroactive sign and map, haunting lamplighter with pointer gaze, book echo line
- Reduced-motion path and toggle, optional muted-by-default sound
- Debug query API, unit tests (`node tests/run.mjs`), screenshots

Not done:
- Only one rewritable fact. No second fact, costs, or prophecies from the cave demo
- Clouds are blurry blobs, and the art is stylized rather than detailed
- No mobile layout tuning, and not tested on real devices
- Chinese text not visible in the screenshots (font limitation above)
- Frame rate target (30+ fps) was not measured on a physical desktop, only in headless software rendering
- Not merged or published. Nothing was pushed

## Relationship to other work

- **#2 / `feat/static-demo`:** the cave demo stays as is. This slice reuses its parchment and leather recipes (feTurbulence plus diffuse lighting, from the `#f-sandstone` / `#f-stone` filters), the hold-to-write (按住落笔) interaction, reduced-motion approach, localStorage key naming, and the zh copy tone. It links back to `../index.html`.
- **#3 (PR with SVG illustration):** not built upon. Its approach of illustrating scenes in SVG is kept only as an exploration record; no code from it is used.
- **#4:** this slice answers it: a world-first, persistent, observable rewrite with a consequence, independent of the earlier previews.
