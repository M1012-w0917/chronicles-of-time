# V10 重力沙漏 / The Gravity Hourglass

Refs #20 (V10 only) and #4. Branch `feat/rewrite-v10-gravity-hourglass`. Latest HEAD SHA: `<HEAD_SHA>`

## What it is
A fixed-camera brass and glass hourglass chamber holding 4096 grains with fixed ids: a canyon, seven brass dam columns, a sintered deck and a coloured city on it, the keeper hut and lamp, and loose reserve sand in a hopper closed by a gate. Writing the new line opens the gate, loosens the sinter bonds, tilts gravity and lowers a brass keel. The same grains collide and settle into a new canyon with a city on each bank. There are no per-grain target positions in the rewrite. After the world settles, a controlled haunt raises about 400 grains against gravity into a hand print and a mirrored 陆徊, knocks on the glass three times, then scorches the book line.

## Run and isolated preview
- `python3 -m http.server 8000` in the repo root, open `http://localhost:8000/rewrite-v10/index.html` (also `file://`).
- The page needs only `rewrite-v10/`. Stills: `?t=0.5`, `?state=new`, `?haunt=0.33`, `?compare=1`, `?reduced=1`, `?blind=1`, `?fresh=1`.
- Controls: hold Space or the book line 1.2 s (early release cancels), hold C compares, Z undoes, R reduced motion.

## Evidence
- Screenshots `docs/screenshots/v10-*.jpg`: 00-blind, 01-old, 02-write, 03a-rewrite-early, 03b-rewrite-mid, 03c-rewrite-late, 04-new, 05-haunt, 05b-haunt-name, 06-compare, 07-reduced, 08-mobile.
- Video `docs/video/v10-flow.webm`, about 29 s real run (cancelled press, hold, rewrite, new, hold C, haunt, Z).
- Raw log `docs/test-log-v10.txt` (date, Chromium version, commands, output).

## Test commands
```
node tests/run-v10.mjs                                   # 23 unit checks of core.js
python3 -m http.server 8000 &  node tests/flow-v10.mjs   # 21 browser checks, http and file://
node tests/shoot-v10.mjs                                 # screenshots
node tests/record-v10.mjs                                # video
```
Measured: new world canyon depth 108.9 units, 98.2% of building grains on the banks, 93.1% of dam grains moved more than 60 units (6.9% within 60), highest dam column 11.2% of original, rest fraction 99.76%, per-frame displacement 11.03 (< 12), path straightness 0.454, frame 255 is 54 units from the 50% blend of frames 0 and 510, 4096 unique ids at every sampled frame.

## Matrix V1 to V10
| | Medium | Material | Space | Camera | Interaction | Reconstruction | Scare |
| --- | --- | --- | --- | --- | --- | --- | --- |
| V1 | Canvas dusk city | procedural sprites | full-width street | fixed, slight parallax | hold to write | buildings vanish by t, new city generated | figure follows gaze |
| V2 | CSS 3D block city | wooden blocks | block city on a book page | top-down desk | write, C, Z | blocks sink by t, paper grass rises | folded figure mark |
| V3 | ink scroll | ink, paper | one scroll painting | fixed, light look-around | write, slider | ink bloom and redrawn strokes | paper-white figure |
| V4 | CRT archive room | phosphor, prints | desk with documents | fixed desk | write, C, Z | one t reorders all documents | person not on file |
| V5 | shadow theatre | leather, paper | layered stage | fixed stage | write, C, Z | puppet parts flip out by t | shade with no puppet |
| V6 | brass glass cabinet | glass, soil | soil section | fixed front | write, C, Z | tree, roots, water grow or retract by windowed parameters | condensation handprint |
| V7 | wooden loom | 223 tracked threads | cloth and frame | fixed, back flip | write, C, Z | each thread interpolates between A, E, B keyframes | red thread sewn into a hand |
| V8 | kiln | clay height field, glaze | one continuous height field | fixed in-kiln | write, C, Z | PDE on a height field | palm under the glaze |
| V9 | observatory orrery | brass rings, glass, light | rings, lens, dome | fixed | write, C, Z | 91 anchors through a ring chain and a thin lens, analytic | mirrored star chart |
| V10 | gravity hourglass | 4096 discrete grains, sinter bonds, glass walls | 2D chamber section: canyon, dams, deck city | fixed front | write, C (reverse), Z (reverse) | contact dynamics: gravity, collision, friction, deposition; no per-grain targets | grains rise against gravity into a hand and a mirrored name, knock on the glass |

Five must-differ proofs:
- **V2:** V2 has a few dozen rigid boxes whose paths are functions of t and which never interact. V10 grains collide, and the new relief comes from contact and angle of repose. Dams are washed out, mixed and redeposited, not sunk along one axis.
- **V6:** V6 soil is a cached texture plus parametric curves: no identity, nothing moves. V10 grains have ids, velocities and collisions, there is no curve, the outline is a heap of grains.
- **V7:** V7 interpolates each thread between authored keyframes, so every endpoint is placed by hand. V10 has no per-grain target in the rewrite, each landing spot is a simulation result. V7 threads are 1D polylines, V10 grains are discrete 2D disks that pile up, slide and jam.
- **V8:** V8 is a single-valued height field h(x,y) under a PDE: no identity, no overhang. V10 is discrete: overhanging dams, arches, splashes, and a traceable grain. V8 conserves a field integral, V10 conserves grain count and id set.
- **V9:** V9 has no simulation: the world is an analytic function of angles and a lens. V10 has state and momentum, each frame depends on all previous ones. V9 distorts by optics, V10 by contact forces.

## Known limits
- The settled new world is still. Only the rendering adds a sheen. Grains do not keep flowing.
- The haunt is a controlled anomaly: its end shapes (hand, mirrored name) are authored, only the motion is simulated.
- Solver results are chaotic with respect to parameters: any tuning needs a rerun of the tests.
- Precompute takes a few seconds after load (progress shown). A restored world waits for it.
- The chamber is not rotated, tilt is shown by a gauge and the gravity of the grains.

## 未验证
- Chinese glyphs: no CJK font in the sandbox, Chinese renders blank in screenshots and video. Only DOM text and layout were checked. English captions are always visible.
- Chromium software rendering only (headless shell 151.0.7922.10). No GPU, no real device, no real touch, no Firefox, no Safari.
- The dev-agent log is not independent CI. The blind screenshot is a developer self-check, not a test with a person.

## Assets and license
All procedural (Canvas 2D, CSS, generated noise). No external images, fonts, audio or code. Same license as the repository.

## Scope
Only `rewrite-v10/`, `docs/*v10*`, `docs/screenshots/v10-*`, `docs/video/v10-flow.webm` and `tests/*-v10.mjs` were added. Nothing else was changed, and there is no V11.
