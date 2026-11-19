# V5 机械皮影剧场 / Mechanical Shadow Theatre

One stage, one history book, one rewritten sentence, one continuously rebuilt world, one causal scare.

- Original: 「城门每日黄昏关闭,守门人点亮三盏灯。」
- Rewrite: 「这座城从来没有城门,黄昏也没有守门人。」

## Run
From the repo root: `python3 -m http.server 8000`, then open `http://localhost:8000/rewrite-v5/index.html`. It also works from `file://`. No build step, no dependencies.

## Controls
| Action | Keyboard | Pointer |
| --- | --- | --- |
| Write (hold about 1.2 s) | hold Space, or Enter on the focused line | press and hold the line in the book |
| Cancel the pen-down | release early | release early |
| Compare with the old stage | hold C | Compare button |
| Revert | Z | Revert button |
| Reduced motion | OS setting, or the button | button |

Query parameters for stills: `t` (0..1 world progress), `w` (ink 0..1), `state=new`, `haunt` (0..1), `compare=1`, `reduced=0|1`, `fresh=1` (clear saved state). The new world persists in `localStorage` (`v5.world`) across reloads.

## What it is
- `core.js` pure state machine and piece functions. Every piece reads the single number `t` through its own staggered window.
- `paint.js` procedural Canvas 2D renderer. Three scrims (far, middle, near). Each layer is drawn as a flat silhouette into a low resolution buffer and stretched back as a soft cast shadow on its scrim (far layer softest), then drawn as translucent multiply-tinted leather with cutouts, engraving lines and rivets. The backlight x moves each layer by a different parallax. Rods and cords are collected while drawing and rendered in front.
- Rewrite: gate boards (6, jointed, hinge on the posts) unlatch, swing edge-on, flip and are pulled sideways on rods; 60 brick tiles flip and are hauled up on cords; the lintel tilts and rises with its three lamps; posts lean and sink; slabs of the keeper's patrol path flip and are dragged out through the stage lip. In the same place trees grow and unfold on branch joints, a road unfolds segment by segment toward the mountain pass, and the shut ridge folds down. The lantern cone shrinks, and the keeper's path bends from the patrol line onto the road until his rod drags him away with limp joints.
- Pen-down: the ink swings the backlight, so cast shadows and parallax move before any piece does.
- Haunt (about 4 s after the new world settles): all rods are parked and no puppet is left, yet a lantern-bearing shade appears on the near scrim in screen space (no parallax). The lamp is dragged away to the right, the shade stays, lifts its arm and pulls the empty keeper rod at the front.

## Tests and evidence
`node tests/flow-v5.mjs` (server on :8000), `node tests/shoot-v5.mjs`, `node tests/record-v5.mjs`. Output of the last run: `docs/test-log-v5.txt`. Screenshots: `docs/screenshots/v5-*.jpg`. Video: `docs/video/v5-flow.webm`.

## Known limitations
- The sandbox has no CJK system font, so Chinese glyphs render as gaps in the screenshots and video. The tests assert the DOM text and the CJK font-family stack only. CJK glyph rendering is 未验证. Every Chinese line has an English caption.
- Performance numbers come from headless software rendering (about 30 fps, JS render time about 2.4 ms per frame). A GPU browser is unmeasured.
- Layer shadows use a low-resolution buffer instead of true blur, and light physics is an approximation (per-layer parallax and offset), not ray casting.
- The continuity test uses a 32x18 luminance fingerprint sampled about every 300 ms, and ambient keeper walking adds a little noise to it.
- Desktop layout only. Narrow screens get a stacked desk but are untested.
- Only reduced-motion via the OS media query, the query parameter and the button is tested. Safari and Firefox are unverified.

## Assets and license
Everything is procedural code and system font names. No third-party images, fonts, audio or code.
