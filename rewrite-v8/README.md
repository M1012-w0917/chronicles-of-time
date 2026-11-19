# V8 窑火釉变 / Kiln of Rewritten History

One continuous porcelain landscape on a black clay body, seen from one fixed camera inside a kiln. Writing the sentence heats the kiln, and the same height field is relaxed, stretched and re-glazed until the seven bridges are gone and a fjord is open. A handprint is then pushed up from under the glaze.

- Original: 「七座石桥连接两岸,守桥人陶砚夜夜在桥心守灯。」 (Seven stone bridges join the two banks, and the bridge keeper Tao Yan keeps a lamp lit at the middle of the bridge every night.)
- Rewrite: 「此地从来没有桥,只有断裂峡湾。」 (There has never been a bridge here, only a broken fjord.)

## Run
From the repo root: `python3 -m http.server 8000`, then open `http://localhost:8000/rewrite-v8/index.html`. It also works from `file://`. No build step, no dependencies, no network. The page precomputes the simulation after first paint (about 0.9 s in headless Chromium, about 1.0 s in node) and shows a status line meanwhile.

## Controls
| Action | Keyboard | Pointer |
| --- | --- | --- |
| Write (hold about 1.2 s) | hold Space, or Enter on the focused line | press and hold the line in the book |
| Cancel | release early (the glow cools, the world stays old) | release early |
| Compare with the old porcelain (real t is kept) | hold C | Compare button |
| Undo (t plays in reverse, about 4 s) | Z | Undo button |
| Reduced motion (x1.8 slower, no sparks or flicker) | OS setting, or R | button |

Query parameters for stills: `t` (0..1), `w` (hold 0..1), `state=new`, `haunt` (0..1), `compare=1`, `reduced=0|1`, `fresh=1` (clear saved state). `t`, `w`, `state` and `haunt` freeze time and do not save. The new world persists in `localStorage` key `v8.world`: written once when NEW settles, cleared when Undo starts. A saved world replays its haunt about 1.5 s after loading.

Test hook `window.__slice`: `getState()` (state, t, w, frame, frameMs, haunt, handPos, persisted, compare, reduced, metrics), `fingerprint()`, `setProgress(t)`, `fieldSample(x, y)` (H, G, T, U at grid fractions of the shown fields, palm included), `setCompare(bool)`, `forceHaunt(h)`.

## Algorithm
`core.js` integrates four fields on a 240 x 96 grid from a fixed seed: H body height, G glaze thickness, T temperature, U material stretch. There are no per-bridge objects or keyframes. The seven arches are ridges across a river groove in H, houses are small bumps, and G is thick in hollows. Each of 360 steps does:
1. T relaxes toward radiant heat from the near (kiln mouth) side, with a small diffusion. Heat rises, holds, then cools.
2. Stretch: a lateral velocity around the river axis moves H and G in flux form. Thickness is conserved, so the middle thins to the clay floor (the fjord) and the banks pile up lips.
3. Sag: material over the water that stands above the ground 3 rows away sinks, at a rate that grows with T, and the removed volume is deposited in the neighbouring rows (the groove fills).
4. Viscous relaxation: conservative diffusion of H with a coefficient that grows with T.
5. Glaze flow: dG/dt = div(mu(T) G^3 grad(H + G + beta T)), upwind with capped flux, so G stays positive. The beta T term is the thermal (Marangoni) push from hot to cold.
6. The new settlement bumps and fjord ripples grow in the same fields late in the run.

61 snapshots (every 1/60 of t) are kept as Float32Arrays and `fieldsAt(t)` blends two neighbours, so t scrubs forward and backward along one deterministic trajectory. `metrics(t)` returns volume and its error against the ledger of added settlement mass (about 1e-8 relative), crest height of each old arch, fjord width in cells, glaze centroid velocity and the mean temperature gradient.

## Rendering
`paint.js` draws a column-sweep height-field from one fixed oblique camera. Per cell it shades the normal of H plus smoothed G with an ember key light and a faint fill, glaze specular that is sharper when hot, thin-glaze translucency over black clay (glaze colour ramps from cream through celadon to deep teal with thickness), incandescence from T, and craquelure that appears as the glaze cools (crack map follows the material through U). Exposed black clay shows where G has torn in the fjord. The wall, firebox arches, sparks and vignette are plain Canvas 2D. Two images are never blended.

## Haunt
Only in NEW, starting about 4 s after settling and lasting 12 s. `applyPalm` adds a palm and four fingers plus thumb to H as a real height bump (0.05 high) with fingerprint ridges (0.0045), thins G over it, adds radial cracks around the rim and a warm glow. The palm centre follows the old bridge decks (far to near, zig-zag) and ends at the near edge directly above the rewritten line in the book. The keeper's name leaves the register, and a scorch of the same palm print appears under the line. Compare hides the haunt and Undo retracts it first.

## Matrix against V1 to V7
| | Medium | Material | Change mechanism | Scare |
| --- | --- | --- | --- | --- |
| V1 | night city | sprites | buildings vanish | figure follows gaze |
| V2 | CSS 3D book city | blocks | blocks sink | folded figure mark |
| V3 | ink scroll | ink | ink redraws | paper-white figure |
| V4 | CRT archive room | phosphor, prints | monitors rebuild | person not on file |
| V5 | shadow theatre | leather | parts flip | shade with no puppet |
| V6 | glass cabinet section | glass, soil | parametric windows | handprint in condensation |
| V7 | wooden loom | 223 tracked threads | threads pulled and rethreaded | red stitch ending in a hand |
| V8 | kiln, one porcelain height field | clay body, glaze, heat | PDE: relaxation, glaze flow, stretch | palm pushed up under the glaze |

## Limits
- No CJK font in the build sandbox: Chinese glyphs were not visually verified (they render blank there). English captions are always shown. 未验证 on machines with CJK fonts.
- Only Chromium headless (software rendering) was run. Firefox, Safari, GPU and real-device performance 未验证. Average draw about 13 to 16 ms per frame there.
- Arches are ridges in a single-valued height field, so there is no void under them. The "unsupported" sag is a rule on excess height over water.
- The fjord is wide (about 53 of 240 cells) and the banks gain stretched lips; both are tuned by eye. The lamp flame is drawn as a small glow on the fourth crown, driven by that crown's height, and is hard to see at this scale.
- Old world is dim and greyish by design (ember light only); the look was tuned from screenshots, not from a reference.

## Assets and license
Everything is procedural: simulation, Canvas 2D drawing, CSS, generated noise. No images, fonts, audio or third-party code. Same license as the repository.
