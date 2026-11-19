# V9 星象仪 / The Orrery That Lost a Star

One fixed camera in an old observatory. A brass orrery with four rings stands around a lamp. Its light passes a glass lens and lands on a dome as a harbor city (coast, lighthouse, seven piers, a fog-sea route, eight districts, the seven stars). Writing the sentence turns the rings and slides the lens. The harbor is a function of those angles, so it is re-projected continuously: the lighthouse moves to the west cape, pier VII sinks, the route detours and the street grids turn. A hand is then drawn on the inside of the lens.

- Original: 「北辰七星引航,归港者循第七星的方位穿越迷雾海。」 (Seven stars of the North Star guide the ships, and every captain coming home crosses the fog sea by the bearing of the seventh star.)
- Rewrite: 「北辰从来只有六星,第七颗星从未存在。」 (The North Star has only ever had six stars. The seventh star never existed.)
- Pilot in the register: 沈归舟 (Shen Guizhou).

## Run
From the repo root: `python3 -m http.server 8000`, then open `http://localhost:8000/rewrite-v9/index.html`. It also works from `file://`. No build step, no dependencies, no network.

## Controls
| Action | Keyboard | Pointer |
| --- | --- | --- |
| Write (hold about 1.2 s) | hold Space, or Enter on the focused line | press and hold the line in the book |
| Cancel | release early (glow cools, world stays old) | release early |
| Compare with the old orrery (real t is kept) | hold C | Compare button |
| Undo (t plays in reverse, about 4 s) | Z | Undo button |
| Reduced motion (x1.8 slower, no flicker, no dust, no sweep) | OS setting, or R | button |

Query parameters for stills: `t` (0..1), `w` (hold 0..1), `state=new`, `haunt` (0..1), `compare=1`, `reduced=0|1`, `fresh=1`, `blind=1`. `t`, `w`, `state` and `haunt` freeze time and do not save. The new world persists in `localStorage` key `v9.world` (written when NEW settles, cleared when Undo starts).

Test hook `window.__slice`: `getState()` (state, t, ring angles `rings.theta/delta/e`, `lens`, `sink7`, `star7`, `worldPasses`, `drawnWorlds`, `holes`, `lensStar7`, `handTip`, `beamEnd`, `frameMs`), `anchors()` (id, ring-chain points p0..p4, ring point, lens point, canvas and client coordinates), `anchorsAt(t)`, `fingerprint()`, `setProgress`, `forceHaunt`, `setCompare`.

## Algorithm
`core.js` has no fields and no simulation. The world is `F(theta1..theta4, lens)`:
1. Rings: R1 meridian (72 to 34 deg, axis y), R2 ecliptic (52 to 25 deg, axis x), R3 seventh-star ring (tilt 23 to 0 deg, folds into R2), R4 horizon dial (0 to 14 deg, axis z). Each has its own ease window on t, so they turn at different times.
2. Anchors with fixed ids (`lighthouse`, `pier1..7` and `.root`, `coast0..16`, `route0..11`, `district0..7` and `.c0..c3`, `star1..7`; 91 in all) sit on a celestial hemisphere. Each has binding weights `[b1,b2,b3,b4]`.
3. Chain: `p0 -> M3 -> M2 -> M1 -> M4`, each a rotation by (ring delta x weight) about the ring's axis. Orthographic projection gives the ring point.
4. Lens: thin lens magnification `M = f/(f-do)`, a barrel term `1/(1+k r^2)` about the lens axis, a small vertical decentering, and a chromatic split per colour pass. Then a fixed map to dome pixels.
5. Pier VII sinks with the fold of R3 (`sink7`), star VII closes its aperture with the same angle (`star7`).
`t` only scrubs the angles and lens, so it runs both ways along one path. Per-step anchor displacement over a 0.01 sweep is at most about 7.4 px.

## Rendering
`paint.js` draws everything in Canvas 2D from one fixed camera (pitch plus mild perspective). Ring segments are quads with thickness, depth sorted together with lamp, pins, holes and graduations, and shaded by a key light and the lamp. Beams are additive cones lamp to lens to dome, plus one thin beam from each ring hole to its star on the dome. The harbor is drawn in three colour passes of the same geometry (different lens dispersion), so lens edges show colour fringes. One world is drawn per frame, there is no crossfade.

## Haunt
Only in NEW, from about 4 s after settling for 12 s. A hand outline appears on the inside of the lens and draws a left-right mirrored star chart. The six other stars are dark rings; the seventh position keeps glowing (with a reversed "VII"). A beam then runs from it to the rewritten line in the book, the pilot's name in the register is struck out, and a scorch of the same hand appears under the line. Compare hides the haunt and Undo retracts it first.

## Matrix against V1 to V8
| | Medium | Material | Change mechanism | Scare |
| --- | --- | --- | --- | --- |
| V1 | night city | sprites | buildings vanish | figure follows gaze |
| V2 | CSS 3D book city | blocks | blocks sink | folded figure mark |
| V3 | ink scroll | ink | ink redraws | paper-white figure |
| V4 | CRT archive room | phosphor, prints | monitors rebuild | person not on file |
| V5 | shadow theatre | leather | parts flip | shade with no puppet |
| V6 | glass cabinet section | glass, soil | parametric windows | handprint in condensation |
| V7 | wooden loom | 223 tracked threads | threads pulled and rethreaded | red stitch ending in a hand |
| V8 | kiln, one porcelain height field | clay body, glaze, heat | PDE on a height field | palm pushed up under the glaze |
| V9 | observatory orrery, lens, dome | brass rings, glass, light | rotation chain + thin lens, no field | mirrored star chart on the lens, star VII still lit |

## Limits
- No CJK font in the build sandbox: Chinese glyphs were not visually verified (they render blank there). English captions are always shown. 未验证 on machines with CJK fonts.
- Only Chromium headless (software rendering) was run. Firefox, Safari, GPU and real-device performance 未验证.
- Harbor anchors are bound to rings by hand-tuned weights (the lighthouse uses a 2.3x gear weight to cross to the west cape). The new harbor sits low on the dome and is compressed by the barrel term; tuned by eye.
- The lens does not show a true refracted image of the rings behind it; the dome carries the distortion.
- Mobile (390 px) scales the whole canvas, so the rings are small.

## Assets and license
Everything is procedural: Canvas 2D drawing, CSS, generated noise. No images, fonts, audio or third-party code. Same license as the repository.
