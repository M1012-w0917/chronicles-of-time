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

Reduced motion keeps the same 9 s rewrite but replaces travel with an in-place cross-fade of the old and new stage. The backlight does not swing on pen-down, there is no ambient sway, and the shade does not tug the rod. In the haunt the shade still fades in and the lamp still drifts away (a lighting change, not moving pieces). Z and C work while a button has focus.

Query parameters for stills: `t` (0..1 world progress), `w` (ink 0..1), `state=new`, `haunt` (0..1), `compare=1`, `reduced=0|1`, `fresh=1` (clear saved state), `cjk=strokes|font` (force the surtitle renderer). The new world persists in `localStorage` (`v5.world`) across reloads. It is written once when the world settles and cleared when a revert starts. The haunt is part of the new world and replays on each load (by design: the state after refresh is the settled new world, then the shade arrives again).

## What it is
- `core.js` pure state machine and piece functions. Every piece reads the single number `t` through its own staggered window.
- `paint.js` procedural Canvas 2D renderer. Three scrims (far, middle, near). Each layer is drawn as a flat silhouette into a low resolution buffer and stretched back as a soft cast shadow on its scrim (far layer softest), then drawn as translucent multiply-tinted leather with cutouts, engraving lines and rivets. The backlight x moves each layer by a different parallax. Rods and cords are collected while drawing and rendered in front.
- Rewrite: gate boards (6, jointed, hinge on the posts) unlatch, swing edge-on, flip and are pulled sideways on rods; 60 brick tiles flip and are hauled up on cords; the lintel tilts and rises with its three lamps; posts lean and sink; slabs of the keeper's patrol path flip and are dragged out through the stage lip. In the same place trees grow and unfold on branch joints, a road unfolds segment by segment toward the mountain pass, and the shut ridge folds down. The lantern cone shrinks, and the keeper's path bends from the patrol line onto the road until his rod drags him away with limp joints.
- Pen-down: the ink swings the backlight, so cast shadows and parallax move before any piece does.
- Pen-down focus: while the pen is held the stage dims, the book gets a lit pool, the quill grows and glows, a wet ink line runs under the fact and the hold bar thickens. The stage still shows the old world; only the lamp swings.
- Tether (old world and early rewrite): the keeper's own shade is cast on the middle scrim beside him and a dotted cord runs from his chest to the chest of his shade. When he walks, the shade walks; when the lamp swings left on pen-down, the shade slides further right. This is what a shade is supposed to do, shown before the haunt breaks it.
- Haunt (about 4 s after the new world settles): all rods are parked and no puppet is left, yet a lantern-bearing shade appears on the near scrim in screen space (no parallax). The lamp is dragged away to the right, the shade stays, lifts its arm and pulls the empty keeper rod at the front. The same dotted cord now runs from the empty, still-tugging rod to the shade, and no keeper is attached to it.
- Surtitle: a plaque on the stage lip names each phase in Chinese and English (改写前 / 落笔 / 重构中 / 新世界 / 因果反常 守门人 0 · 影 1 / 对照旧世界 / 撤回). It is its own canvas, so stage pixels stay a pure function of `t`.

## V5 deepening (this round)
- Leather: each piece gets a thickness map (warm where the hide is thin and light comes through, dark where it is thick) and a dark folded edge. Tiles, lintel, posts and the keeper's robe have stitched seams (thread dashes with light through the needle holes) and cross lacing at joints. Rivets cast a small shadow away from the lamp and have a ring of light around their hole.
- Depth: three scrims have visible weighted hems at different heights. Each scrim also receives the cast shadow of the scrim behind it, offset and blurred by the gap, and the offset slides with the lamp x. Red velvet drapes frame the stage with fold shading whose crests brighten toward the lamp; the drapes and valance cast shadows on the scrims.
- Book: lifted on a lectern, larger (about 940 x 220 px at 1600 x 900), with a thick page block and a long shadow, larger type.
- Chinese fallback: `cjk.js` holds hand-authored stroke glyphs for the 24 characters of the surtitle (改写前落笔重构中新世界因果反常对照旧撤回守门人影). It detects a CJK font by drawing 落 and 龘 with the page font stack; identical pixels mean no CJK font, and the surtitle then uses the stroke glyphs.
- Distinct from fusion #25: V5 keeps a separate stage with red curtain, backlit leather puppets on scrims and visible rods. The book stays on the desk and is never the stage; there is no paper-fiber world.
- Z now also reverts at the very start of the rewrite (`t = 0`).

## Tests and evidence
Start `python3 -m http.server 8000` from the repo root, then `node tests/flow-v5.mjs`, `node tests/shoot-v5.mjs`, `node tests/record-v5.mjs`. The scripts need `playwright-core` and a Chromium binary (no install is done by the scripts). `tests/pw-v5.mjs` resolves `playwright-core` from env `PLAYWRIGHT_CORE` (package dir), local `node_modules`, or the global npm root, and the browser from env `CHROME` or the first `chrome-headless-shell`/`chrome` under `PLAYWRIGHT_BROWSERS_PATH`, `~/.cache/ms-playwright` or `/inner_container/opt/playwright`. Recording also needs Playwright's ffmpeg in the same cache. Output of the last run: `docs/test-log-v5.txt`. Screenshots: `docs/screenshots/v5-*.jpg`. Video: `docs/video/v5-flow.webm`.

## Known limitations
- The sandbox has no CJK system font, so Chinese in the DOM (book, buttons, note) renders as gaps in the screenshots and video. Only the stage surtitle is readable there, through the 24 stroke glyphs. Rendering with a real CJK font (`?cjk=font` or auto detection on a machine that has one) is 未验证 visually; the tests assert the DOM text, the font-family stack and the detection path only. Every Chinese line has an English caption.
- The stroke glyphs are simplified single-weight brush strokes, legible at about 34 px, not a typeface. Other characters fall back to the font.
- Performance numbers come from headless software rendering (about 20 fps, JS render time about 4 ms per frame; the leather thickness map is the most expensive part, so it is skipped on leaves, ground fills and the far scrim). A GPU browser and real devices are unmeasured.
- Layer shadows use a low-resolution buffer instead of true blur, and light physics is an approximation (per-layer parallax and offset), not ray casting.
- The continuity test uses a 32x18 luminance fingerprint sampled about every 170 ms plus evaluation time, and the walking keeper with his trailing shade adds noise; the revert check compares only the rows above the keeper band. The haunt test also compares mean luminance of a crop around the shade before and after the lamp moves against a shade-free new world. The rod tug is scripted by the haunt parameter, not simulated from the shade.
- Desktop layout only. Narrow screens get a stacked desk but are untested.
- Reduced-motion cancel, revert, cross-fade and haunt are tested. Only reduced-motion via the OS media query, the query parameter and the button is tested. Only Chromium headless is tested; Safari, Firefox and real devices are unverified.

## Assets and license
Everything is procedural code and system font names. No third-party images, fonts, audio or code.
