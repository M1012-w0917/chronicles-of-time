# V6 玻璃生态标本馆 / Glass Vivarium Cabinet

One brass-framed glass cabinet, one history book, one rewritten sentence, one continuously regrown ecology, one causal scare.

- Original: 「银叶温室的最后一棵母树由园丁沈砚照料,树根维系整座庭园的水脉。」
- Rewrite: 「银叶温室从未有过母树,也从未有过园丁沈砚。」

## Run
From the repo root: `python3 -m http.server 8000`, then open `http://localhost:8000/rewrite-v6/index.html`. It also works from `file://`. No build step, no dependencies, no network.

## Controls
| Action | Keyboard | Pointer |
| --- | --- | --- |
| Write (hold about 1.2 s) | hold Space, or Enter on the focused line | press and hold the line in the book |
| Cancel the pen-down | release early | release early |
| Compare with the old ecology (keeps the new one) | hold C | Compare button |
| Undo (the rewrite plays in reverse, about 4 s) | Z | Undo button |
| Reduced motion | OS setting, or R | button |
| Wipe the condensation | | move over the glass (it fogs back after about 7 s) |

The pointer also tilts the view slightly (back wall, soil and front glass shift by different amounts).

Reduced motion uses the same continuous `t`, only slower (1.8x). There is no ambient drift (no leaf sway, spores, breathing drops or pointer tilt), no leaf tremor while writing, and the water beads are tied to `t` instead of running on their own.

Query parameters for stills: `t` (0..1), `w` (ink 0..1), `state=new`, `haunt` (0..1), `compare=1`, `reduced=0|1`, `fresh=1` (clear saved state). `t`, `w`, `state` and `haunt` freeze time and do not save. The new world persists in `localStorage` (`v6.world`): written when the world settles, cleared when an undo starts. The haunt replays about 4 s after each load of the settled new world.

Test hook `window.__slice`: `setProgress(t)`, `getState()`, `fingerprint()`, `setHaunt(h)`, `setCompare(bool)`.

## What it is
- `core.js` pure logic (`V6Core`). Every piece reads the single number `t` through its own staggered window: the mother tree (8 branch nodes, tips retract first, trunk last, leaves furl and shrink before their branch), the roots (3 tiers, 14 segments, deep tier retracts first, root 0 last), 6 soil strata (waviness and pores grow as they loosen), the water vein (1 main + 3 branches, control points move and fork, `flow` goes from +1 right/down through 0 to -1 left/up), the moss field (260 patches with thresholds), mycelium, 9 ferns and 14 herb tufts that grow into the vacated space, condensation, and the gardener's relics (plaque, shears, can) that sink into the soil. `metrics(t)` summarises them. `anchor` is the junction of root 0 and the old main vein, computed from the root curve; the old vein passes through it.
- `paint.js` Canvas 2D renderer, back to front: back wall (cached), relics, soil strata with cached grain, water vein, roots, mycelium, tree, ferns, herbs, moss, spores, front glass sheen (cached), fog and condensation drops, haunt, brass frame (cached). Per frame cost in headless software rendering was about 2 ms average.
- `app.js` wires the state machine (OLD, WRITING, RECONSTRUCTING, NEW, HAUNT, REVERTING), input, persistence and the book.

## Haunt
About 4 s after NEW settles, a hand is pressed outward from the inside of the glass, centred on the anchor. The condensation drops step around it and bead along its edge. A bead rolls down the old vein path, and the beads draw 沈砚. The name is drawn from hand-set strokes, so it shows even without a CJK font. Compare hides it and Undo removes it.

## Matrix against V1 to V5
| | V1 | V2 | V3 | V4 | V5 | V6 |
| --- | --- | --- | --- | --- | --- | --- |
| Medium | city at dusk | CSS 3D book city | ink scroll | CRT archive room | leather shadow theatre | glass cabinet, soil section |
| Change | buildings vanish | blocks sink | ink redraws | monitors rebuild | parts flip and are pulled away | same tree, roots, vein, moss grow or retract |
| Scare | figure follows gaze | folded figure mark | paper-white figure | person not on file | shade with no puppet | handprint, condensation spells a name |

## Limits
- No CJK font in the build sandbox: Chinese glyphs in the DOM were not visually verified (the English captions and the stroke-drawn name were). The plaque and the haunt name use hand-set strokes, not a font.
- Chromium (headless, software rendering) only. Firefox, Safari and real-device performance 未验证.
- The haunt hand is a union of ellipses, a stylised print, not a photographic one.

## Assets and license
Everything is procedural: Canvas 2D drawing and CSS. No images, fonts, audio, or third-party code. Same license as the repository.
