# Book + Shadow: the gatekeeper in the paper (candidate for #25, umbrella #4)

Independent candidate. The open book is the stage: an overhead camera on a thread-bound book with a spine band, a thick stacked fore-edge and pressed (debossed) impression marks. Hold the pen down, the candle shines through the leaf, and shadow puppets appear in the paper fibres. In the same camera the gatekeeper dissolves in slivers, the gate opens and slides apart, the wall sinks to boundary stones, and a road and trees grow. The new history can be dwelled in. Then an independent shade stays on the back of the leaf. It casts toward the candle (a real shadow falls away) and leans to it, and when the leaf is turned it stays put and raises its lantern.

Facts (same text as V5): 城门每日黄昏关闭,守门人点亮三盏灯。 / 这座城从来没有城门,黄昏也没有守门人。

## Run
```
python3 -m http.server 8000
# open http://localhost:8000/rewrite-book-shadow/index.html
```
Static, no build. Query params for stills: `t=0..1`, `state=new`, `haunt=0..1`, `compare=1`, `reduced=1`, `fresh=1`, `w=0..1`, `lit=1`, `lx`/`ly` (candle).

## Controls
- Hold the fact line with the pointer, or Space / Enter on the focused line, for about 1.2 s. Releasing early cancels.
- Move the pointer or use arrow keys to move the candle.
- Hold C (or the Compare button) to see the old world in the same camera. Z (or Revert) undoes.
- P (or Turn page) once the shade has appeared.
- Reduced motion (OS setting or button): crossfade instead of travel, no flicker, no sway, no lean.

## Tests and evidence
`node tests/flow-bs.mjs` (server on :8000) writes assertions; raw log in `docs/test-log-bs.txt`. `node tests/shoot-bs.mjs` makes `docs/screenshots/bs-*.jpg`. `node tests/record-bs.mjs` makes `docs/video/bs-flow.webm`. Browser and playwright-core are resolved by `tests/pw-bs.mjs` (env `PLAYWRIGHT_CORE`, `CHROME`).

## Unverified
- Chinese glyphs: the capture machine has no CJK font, so Chinese renders as gaps in screenshots and video. The DOM text is asserted exactly in tests, and the font stack is Noto/Source Han/Songti/SimSun. Real CJK rendering is not visually verified. English captions are included.
- Only Chromium headless was tested. No touch or mobile test, no screen reader test.
- Same-composition compare pair: `bs-compare-before` uses `lit=1` to light the old world, because the real first screen is dark by design.

## Assets
All procedural canvas drawing. No third-party images, fonts or audio.
