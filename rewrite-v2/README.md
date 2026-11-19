# Rewrite Reality V2 · Ashmere on the table (CSS 3D diorama)

Candidate V2 for issue #4. The camera looks down at a heavy open book on a dark oak table under one warm lamp. The open spread is the ground of a miniature city built from real CSS 3D boxes. Rewriting the printed line makes the buildings sink into the paper, the printed street lines are wiped, paper grass and standing stones rise, and the tiny people fold flat and vanish. One token stays standing.

## Run

Open `rewrite-v2/index.html` directly (file:// works), or serve the repo root:

```
python3 -m http.server 8000
# open http://localhost:8000/rewrite-v2/
```

No build, no network, no dependencies, no downloaded fonts or images.

Tests (run from the repo root, server on :8000 for the browser tests; start the server and the script in the same shell):

```
node tests/run-v2.mjs        # unit tests of rewrite-v2/core.js + node --check of every V2 script
node tests/flow-v2.mjs       # headless Chromium flow with assertions (http and file://)
node tests/shoot-v2.mjs      # docs/screenshots/v2-*.jpg
node tests/record-v2.mjs     # docs/video/v2-flow.webm
```

Evidence: `docs/screenshots/v2-01-initial.jpg` to `v2-06-reduced.jpg` and `docs/video/v2-flow.webm` (about 2 MB, about 28 s).

## Controls

| Action | Input |
|---|---|
| Write the new line | Hold **Hold to rewrite** for 1.4 s (mouse, or hold Space / Enter). Releasing early cancels and the pen lifts |
| Undo | Z, or **Undo** |
| Compare old and new | Hold C or the **Compare** button, or drag the old / new slider |
| Orbit / zoom the camera | Drag the scene / mouse wheel. The camera also drifts slowly on its own |
| Reduced motion | **Reduced motion** button or R. Also follows `prefers-reduced-motion` |

Debug query params for deterministic screenshots: `?t=0..1`, `?state=new`, `?w=0..1` (pen held part way), `?haunt=0..1`, `?autoplay=1`, `?reduced=1|0`, `?yaw=`, `?pitch=`, `?zoom=`. Any of `t`, `state`, `w`, `haunt`, `reduced` freezes the camera and stops writing to localStorage. `window.__slice` exposes `setProgress(t)`, `getState()`, `setHaunt(h)`, `setWrite(w)`, `setReduced(on)`, `press()`, `release()`, `undo()`, `compare(on)`.

## The fact

| Chinese (primary, in the DOM) | English caption |
|---|---|
| 灰堡市建于永昌四十二年。 | City of Ashmere founded in year 42. |
| 灰堡市从未建立。 | City of Ashmere was never founded. |
| 他记得永昌四十二年。 (margin note) | He remembers year 42. |

The sandbox has no CJK fonts, so the Chinese glyphs render blank in the screenshots. Each Chinese string has an English caption beside it, on the page and in the dock. The Chinese text is verified through the DOM in `tests/flow-v2.mjs`. The font stacks list common CJK serif families.

## How it works

- `core.js` is pure logic with no DOM (browser global `V2Core`, CommonJS for node). `buildWorld(seed)` lays out one deterministic model: ink streets and block outlines, about 60 buildings, 33 people tokens, 9 standing stones and 68 grass tufts. `itemValue(item, t)` gives each item's state at world progress `t` (0 = old city, 1 = never founded). Every item has a delay that grows with its distance from the printed line, so the rewrite spreads out across the spread from where the pen wrote. `createMachine()` is the state machine: OLD, WRITING, REWRITING, NEW, UNDOING, SCRUB.
- `app.js` builds the scene once as DOM and writes CSS variables each frame. A building is a `preserve-3d` box with five faces whose height is `--h * --k`, so sinking is the same box shrinking into the paper with its roof and windows going down with it. The street lines are `clip-path` wipes. People are two-sided cut-outs on brass bases that rotate flat (`rotateX`) and fade. Stones are boxes growing from `k = 0`. Tufts are two crossed zigzag paper cut-outs scaled up from the page.
- Lighting is per face (lit west face, dark east face), a soft contact shadow per box, a lamp gradient blended with `screen`, a vignette, and tilt-shift bands made with `backdrop-filter: blur` on the top and bottom of the frame.
- Consequence: the rewrite cannot unwrite the scribe token who set the line down (`hero`, its fold value is always 0). About 1.8 s after the new world settles, it turns from facing away to facing the camera, a warm ring opens under it, and a handwritten margin note writes itself on the right page. Undo or compare removes it. It never appears without the rewrite.
- Persistence: the settled world (`old` / `new`) is saved to localStorage and restored on reload.
- Reduced motion: the same model is shown only at held keyframes `t = 0`, `0.5` and `1`, each held for 1.5 s. Each change crossfades through a cloned ghost of the previous frame over 0.7 s. The camera drift is off.

Code reuse from V1: the mulberry32 seeded RNG (a few lines) and the general shape of the hold / cancel / undo state machine. No V1 art, layout or rendering code is used.

Art source: everything is original and procedural (CSS gradients, clip-paths and DOM boxes generated from the seed). No images, fonts or third-party assets.

## Done / not done

Done:
- The full core loop: hold to write with early-release cancel, a continuous rewrite of the same DOM model over 9 s, the new world persists and stays observable, compare (hold C or the slider), undo (Z), and the haunting that the rewrite causes.
- Orbit and zoom, slow automatic camera drift, tilt-shift, lamp and per-face lighting.
- Reduced motion (media query and toggle), debug params, unit and flow tests, screenshots and video.

Not done:
- No sound.
- No page-turn or book open animation. The book is already open.
- The pen is a simple box, not a modelled nib.
- Touch orbit uses one-finger drag only. There is no pinch zoom.
- Chinese glyphs are unverified visually in this sandbox (no CJK fonts).

## Trade-offs

- DOM + CSS 3D instead of canvas or WebGL gives real perspective, depth sorting and crisp text on the page with no libraries. The cost is compositing: about 400 3D layers. In the sandbox's software-GL headless Chromium the old city runs at about 6 fps and the new world at about 26 fps. The first raster of the full city takes several seconds there. GPU browsers are much faster, but this is the main risk of this candidate. The flow test waits on state rather than wall-clock time for this reason, and the timeline caps one frame step at 1 s.
- Opacity is never set on a `preserve-3d` container, because that would flatten the 3D context. Fades are applied to leaf faces through a `--fade` / `--o` variable.
- Tufts were first built from single blades, about 350 layers, and ran at under 1 fps headless. They are now two crossed zigzag planes each, which brought the new world from 0.75 fps to 26 fps.
- The new world is deliberately pale and sparse: the paper itself becomes the land. The diorama reads best in the old state.

## Fundamental differences between candidates

Only differences in medium, technique, camera or interaction are listed. Palette and parameter changes are not counted.

| | V1 (PR #5, `rewrite/`) | **V2 diorama (this)** | V3 ink wash | V4 CCTV archive desk | V5 paper-cut shadow theatre |
|---|---|---|---|---|---|
| What the world is | A painted full-screen city at dusk; the book is a separate UI dock | A physical miniature on the book's own pages; the book is the ground | A brush painting that is repainted | Recorded footage watched on monitors on a desk | Cut-out silhouettes on a lit screen |
| Rendering | Canvas 2D, redrawn every frame | DOM + CSS 3D boxes (`preserve-3d`), no canvas | Canvas ink simulation | Video-like screens in a desk scene | Layered flat silhouettes, light and shadow |
| Space and camera | Fixed 2D side view with parallax | True 3D perspective; the user orbits and zooms; the camera drifts | Flat scroll / paper | Fixed seat at a desk, several feeds | Fixed audience view of one plane |
| How the change shows | Buildings repainted / dissolved in the painting | Boxes physically sink into the paper, ink lines wipe, stones and grass rise, tokens fold flat | Ink bleeds, washes and is repainted | The record changes across feeds and timestamps | Pieces are swapped and re-cut behind the screen |
| Haunting | A figure whose gaze follows the pointer | The one token left standing turns to the camera; a handwritten margin note appears | Per V3 | Per V4 | Per V5 |
| Light | Painted sky gradient | One warm lamp, per-face shading, contact shadows, tilt-shift blur | Paper and ink | Screen glow | A single light behind the screen |

The V3 to V5 columns describe the planned candidates on their own branches, not this code.
