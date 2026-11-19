# V10 重力沙漏 / The Gravity Hourglass

Candidate for Issue #20 (V10 only), umbrella #4. 4096 sand grains with fixed ids sit in a brass and glass chamber. Writing the new line opens a gate, drops a keel and tilts gravity. The same grains collide, slide and settle into a new canyon with a city on each bank. No grain is faded, deleted or created.

## Run
- `python3 -m http.server 8000` in the repo root, open `http://localhost:8000/rewrite-v10/index.html`. It also opens from `file://`. No build, no network, no dependencies.
- Debug stills: `?t=0.5` (rewrite progress), `?w=0.8` (writing), `?state=new`, `?haunt=0.4`, `?compare=1`, `?reduced=1`, `?fresh=1` (clear storage), `?blind=1` (chamber only, no book or text).

## Controls
- Hold Space, Enter on the focused line, or press and hold the book line for about 1.2 s. Releasing early cancels: nothing changes.
- Hold C: playhead runs back to the old world (about 1.2 s) and returns to the kept progress on release.
- Z: about 4 s reverse and clears `localStorage` key `v10.world`. A running haunt is retracted first.
- R or `prefers-reduced-motion`: rewrite about 1.8 times slower, no glass tremor, no knock rings, the haunt stops on the formed hand print.

## Algorithm
- `core.js` (`V10Core`, also `require`-able in node) is a fixed step (1/60 s) deterministic solver: Verlet positions, spatial hash, contact constraints, sinter bonds (distance constraints whose strength decays on a timeline), glass walls, a kinematic brass gate and keel, gravity tilt within 18 degrees. Seeded with mulberry32.
- There are no per-grain target positions in the rewrite phase. Roles (bed, dam, deck, building, keeper, reserve) only colour the grains and feed the tests.
- The old world is a designed layout pre-rolled 120 steps to rest. The machine parameters (gate time, keel path, tilt) are tuned until the new world is readable, and the metrics below check it.
- On load, the whole timeline (14 s rewrite, 3 s settle, 12 s haunt) is precomputed in 8 ms slices and stored as Int16 snapshots every 2 steps (871 frames, 13.6 MB, about 6 s in node). The playhead moves over the frames with linear interpolation. Compare, Undo and persistence are playhead moves, not images. Reload restores the settled frame directly.
- Haunt (controlled anomaly, not part of the rewrite): about 4 s after the new world settles, 400 grains (96 keeper grains plus sampled pile grains) get reversed gravity and a spring toward a hand-authored hand outline, then mirrored strokes of 陆徊, three knocks on the glass (rings, cracks), then normal gravity again. Targets exist only in this phase. The book line is scorched after the knocks and the keeper name is struck and rewritten in red.

## Rendering
One Canvas 2D. Grains are pre-rendered 7 px sprites (role colour times three shades), drawn without alpha. Brass frame, glass, desk are cached layers. Gears, hourglass emblem, gate, keel, knock rings and cracks are functions of the playhead frame.

## Feasibility gate
N stays 4096: bare solver about 2.4 ms/step in node 22 (gate 3 ms), dam columns stand at rest after the pre-roll.

## Tests and evidence
- `node tests/run-v10.mjs`: unit checks of the core (determinism, id continuity, conservation, per-step displacement, metrics, haunt, reversibility).
- `python3 -m http.server 8000 & node tests/flow-v10.mjs`: browser checks over http and file://.
- `node tests/shoot-v10.mjs` (screenshots), `node tests/record-v10.mjs` (video). Raw output: `docs/test-log-v10.txt`.

## Matrix against V1 to V9
See `docs/pr-body-v10.md`.

## Limits
- The new world is still after it settles. Only the render adds a sheen, the grains do not flow.
- The haunt is controlled: its end shapes are authored.
- Results are chaotic in the solver parameters: any tuning needs a rerun of the tests.
- Chinese glyphs are 未验证 visually (no CJK font in the sandbox, glyphs draw blank). Only DOM text and layout were checked, English captions are always shown.
- Only headless Chromium with software rendering was used. Firefox, Safari, GPU, real devices and touch are 未验证.
- Precompute takes a few seconds on load (progress shown, old city visible). A restored world waits for it too.
- The tilt is shown by a gauge, the chamber itself is not rotated.

## Assets and license
All procedural. No images, fonts, audio or third-party code. Same license as the repository.
