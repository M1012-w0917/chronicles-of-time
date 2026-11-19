# V7 命运织机 / Fate Loom

One wooden loom, one book, one rewritten sentence, one cloth whose threads are pulled out and rethreaded into a new world, one red thread from the gutter.

- Original: 「长桥织城以七座石拱桥跨越白河,桥上守桥人顾衡夜夜点灯。」 (The long-bridged weave city crosses the White River on seven stone arch bridges, and on the bridges the keeper Gu Heng lights his lamp every night.)
- Rewrite: 「白河从未建桥,织城沿河两岸分隔百年。」 (No bridge was ever built over the White River, and the weave city has stood divided along its two banks for a hundred years.)

## Run
From the repo root: `python3 -m http.server 8000`, then open `http://localhost:8000/rewrite-v7/index.html`. It also works from `file://`. No build step, no dependencies, no network.

## Controls
| Action | Keyboard | Pointer |
| --- | --- | --- |
| Write (hold about 1.2 s) | hold Space, or Enter on the focused line | press and hold the line in the book |
| Cancel | release early | release early |
| Compare with the old cloth (keeps the new one) | hold C | Compare button |
| Undo (t plays in reverse, about 4 s) | Z | Undo button |
| Reduced motion | OS setting, or R | button |
| Depth parallax between the three layers | | move over the loom |

Query parameters for stills: `t` (0..1), `w` (hold 0..1), `state=new`, `haunt` (0..1), `compare=1`, `reduced=0|1`, `fresh=1` (clear saved state). `t`, `w`, `state` and `haunt` freeze time and do not save. The new world persists in `localStorage` key `v7.world`: written once when NEW settles, cleared when an undo starts. The haunt replays about 1.5 s after loading a settled world.

Test hook `window.__slice`: `getState()`, `fingerprint()`, `setProgress(t)`, `forceHaunt(h)`, `setCompare(bool)`, `threadSnapshot()` (every thread id with role, lift and node positions at the shown t).

## How the same threads are tracked
`core.js` builds 223 threads, each with a stable id (`T000`..`T222`), a depth layer (0 far, 1 middle, 2 near), an old role and a new role, and three keyframes of 10 nodes each: A (old place), E (pulled out and hanging in front of the cloth) and B (new place). All 82 bridge threads (seven bundles of 12, 10, 14, 12, 11, 13 and 10 ribs) are pulled out of their arch, hang as loose loops, then are rethreaded as river, bank road, bank house or a person standing on one bank. The same holds for the 28 house threads (bridge deck to bank), 12 people and the keeper's golden lamp thread (it becomes a glint on the river). River, wall, road and reed threads move straight from A to B. Every node of every thread reads the single number `t` through its own window, so positions are continuous and monotone, and the thread ids at `t=1` are exactly the ids at `t=0`. The ground (river polygon) widens with the river threads. Nothing is cross-faded; the book sentence is a left to right wipe driven by the same `t`.

## Haunt
Only in NEW. The camera swings behind the cloth (a horizontal flip by cosine, so the cloth passes edge on), the new pattern is seen dim from behind with knots and loose ends, and a red thread leaves the book's gutter, climbs into the loom and stitches the outer rib of each old bridge from the nearest to the farthest (these ribs are real tracked thread ids, listed in `HPATH.ribIds`). A hand is stitched at the end of the path, then reaches toward the viewer. The keeper's name leaves the register in the book. Compare hides the haunt, and Undo retracts it first.

## Matrix against V1 to V6
| | V1 | V2 | V3 | V4 | V5 | V6 | V7 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Medium | city at dusk | CSS 3D book city | ink scroll | CRT archive room | leather shadow theatre | glass cabinet, soil section | wooden loom, woven city |
| Change | buildings vanish | blocks sink | ink redraws | monitors rebuild | parts flip and are pulled away | tree, roots, vein grow or retract | tracked threads pulled out and rethreaded into a new place |
| Scare | figure follows gaze | folded figure mark | paper-white figure | person not on file | shade with no puppet | handprint, condensation name | red stitch from the gutter along the old bridges, ending in a hand |

## Limits
- No CJK font in the build sandbox: Chinese glyphs in the DOM were not visually verified (they render blank or as tofu in the screenshots there). The English captions are always shown. I did not add a hand-drawn stroke fallback for 顾衡; the register also shows "Gu Heng" in English.
- Only Chromium headless (software rendering) was run. Firefox, Safari and real-device performance 未验证. Average draw about 7 ms per frame in headless Chromium.
- Stage-3 hanging threads are stylised loops; they pass in front of other threads and cast a shadow, but there is no thread to thread collision.
- The optional pointer plucking of warp threads is not implemented; the pointer only gives a depth parallax.
- Houses and people are small polyline glyphs, not detailed figures.

## Assets and license
Everything is procedural: Canvas 2D drawing and CSS, a generated noise canvas for the paper grain. No images, fonts, audio or third-party code. Same license as the repository.
