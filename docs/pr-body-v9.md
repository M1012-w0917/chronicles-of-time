# V9 星象仪 / The Orrery That Lost a Star

Refs #18 (V9 only) and #4. Branch `feat/rewrite-v9-orrery`. Latest HEAD SHA: `<HEAD_SHA>`

No change to main, V1 to V8, Pages, and no V10 work.

## What it is
A fixed-camera observatory. A brass orrery (four rings, lamp) sends light through a glass lens onto a dome that shows a harbor (coast, lighthouse, seven piers, fog-sea route, eight districts, seven stars). Holding the line in the book for about 1.2 s turns the rings and slides the lens. The harbor is `F(ring angles, lens)` over 91 fixed-id anchors, so it is re-projected continuously (lighthouse moves west, pier VII sinks, route detours, street grids turn). There is one world per frame and no crossfade. Afterwards a hand is drawn on the inside of the lens with a mirrored star chart, only star VII keeps glowing, and a beam points to the rewritten line.

## Run
- `python3 -m http.server 8000` in the repo root, open `http://localhost:8000/rewrite-v9/index.html` (also works from `file://`).
- Isolated preview: any static server rooted at the repo works; the page needs only `rewrite-v9/`. Stills: `?t=0.5`, `?state=new&haunt=0.9`, `?compare=1`, `?reduced=1`, `?fresh=1`.
- Controls: hold Space (or press and hold the line) 1.2 s; release early cancels; hold C compares; Z undoes; R reduced motion.

## Evidence (all produced by the commands below)
- Screenshots in `docs/screenshots/`: `v9-00-blind.jpg` (no book, no text), `v9-01-old`, `v9-02-write`, `v9-03a-rewrite-early`, `v9-03b-rewrite-mid`, `v9-03c-rewrite-late`, `v9-04-new`, `v9-05-haunt`, `v9-05b-haunt-late`, `v9-06-compare`, `v9-07-reduced`, `v9-08-mobile`.
- Video: `docs/video/v9-flow.webm`, 28.7 s (cancelled press, hold, rewrite, new, hold C, haunt, Z undo). Real run, headless Chromium.
- Raw log: `docs/test-log-v9.txt` (date, Chromium version, commands, output).

## Test commands
```
node tests/run-v9.mjs                                   # 16 unit checks of core.js + node --check
python3 -m http.server 8000 &  node tests/flow-v9.mjs   # 21 browser checks, http and file://
node tests/shoot-v9.mjs                                 # screenshots
node tests/record-v9.mjs                                # video
```
Covered: early-release cancel (keyboard and pointer), hold rewrite, continuity (91 anchor ids at every sample, bounded 7.4 px per 0.01 step, ring angles change 38/27/23/14 deg, mid pixel fingerprint is not a 50% mix), persistence after reload, C keeps t, Z undo, haunt causality (hand ends on mirrored star VII, beam end lands on the rewritten line, 沈归舟 struck, scorch), reduced motion (continuous, 1.8x slower, no idle drift), Chinese DOM strings, console errors (0, http and file://), frame cost, mobile overflow. The unit tests fail when R3's end angle, the lens formula or the cancel logic are changed (checked by mutating `a1` of R3).

## Matrix V1 to V9
| | Medium | Material | Change mechanism | Scare |
| --- | --- | --- | --- | --- |
| V1 | night city | sprites | buildings vanish | figure follows gaze |
| V2 | CSS 3D book city | blocks | blocks sink | folded figure mark |
| V3 | ink scroll | ink | ink redraws | paper-white figure |
| V4 | CRT archive room | phosphor, prints | monitors rebuild | person not on file |
| V5 | shadow theatre | leather | parts flip | shade with no puppet |
| V6 | glass cabinet | glass, soil | parametric windows | handprint in condensation |
| V7 | wooden loom | 223 tracked threads | threads rethreaded | red stitch ending in a hand |
| V8 | kiln, porcelain height field | clay, glaze, heat | PDE on a height field | palm under the glaze |
| V9 | observatory orrery, lens, dome | brass rings, glass, light | rotation chain + thin lens, no field | mirrored star chart, star VII still lit |

The full per-item comparison (space, camera, interaction, algorithm) is in the admission comment on #18.

## Assets and license
All procedural (Canvas 2D, CSS, generated noise). No images, fonts, audio or third-party code. Same license as the repository.

## Known defects
- At t=1 the new harbor sits low on the dome, is compressed by the barrel term, and its lower edge is close to the dome rim. A lens decentering (`sy`) was added to keep it on the dome; it is still not well composed.
- Anchor-to-ring bindings are hand-tuned (lighthouse uses a 2.3x gear weight to reach the west cape).
- The lens does not show a true refracted image of the rings; the dome carries the distortion.
- On mobile (390 px) the whole canvas scales down, so the rings are small.
- The haunt beam ends at the lower edge of the canvas and then the book line; it does not physically cross the book.

## Unverified
- Chinese glyphs: the sandbox has no CJK font (`fc-list :lang=zh` is empty), so Chinese text renders blank in every screenshot and the video. Only DOM text was checked. English captions are always shown.
- Firefox, WebKit/Safari, other Chromium versions (only 151.0.7922.10 headless shell).
- GPU rendering and real-device performance (frame cost measured in software rendering only: about 3 ms per frame).
- Real touch devices and physical keyboards.
- User aesthetic acceptance and the blind test with a person: the blind screenshot is a developer self-check.
- Independent CI: none ran; all results are from the developing agent.
