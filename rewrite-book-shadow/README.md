# Book + Shadow: the gatekeeper in the paper (candidate for #25, umbrella #4)

Independent candidate, round 3 (deepened). The puppets are now hand-cut: wobbled cut outlines, pierced holes that let more light through (gate lattice, robe diamonds, lantern pores, leaf holes in the trees), a dark leather rib, and three shadow layers (soft cast away from the candle, sharp contact shadow, body). The light spot bends with the page: the leaf rises toward the spine and curls at the fore-edges, so the spot and the puppets squeeze horizontally there. During the rewrite the gate and the gatekeeper gather toward the spine along the fibres and leave a faint trail that fades by the end. The open book is the stage: an overhead camera on a thread-bound book with a spine band, a thick stacked fore-edge and pressed (debossed) impression marks. Hold the pen down, the candle shines through the leaf, and shadow puppets appear in the paper fibres. In the same camera the gatekeeper dissolves in slivers, the gate opens and slides apart, the wall sinks to boundary stones, and a road and trees grow. The new history can be dwelled in for as long as you like: the shade only comes after 20 s with no input (8 s in reduced motion; moving the candle or pressing a key resets the timer), or when you press H / the Look at the back button. Then an independent shade stays on the back of the leaf. It casts toward the candle (a real shadow falls away) and leans to it, and when the leaf is turned it stays put and raises its lantern, while the same cut outline, mirrored through the paper, emerges from the back of the turning leaf and returns.

One deliberate misalignment: once per haunt session, the first time the candle travels about 260 canvas px after the shade is out, the shade answers the wrong way for 1.5 s (it casts and leans away from the candle, a dashed pencil line shows where it should have leaned, and a caption reads 影子答错了方向 / The shade answers the wrong way), then returns to the normal rule. In reduced motion this is one static reversed cast for the same 1.5 s, no movement.

Facts (same text as V5): 城门每日黄昏关闭,守门人点亮三盏灯。 / 这座城从来没有城门,黄昏也没有守门人。

## Run
```
python3 -m http.server 8000
# open http://localhost:8000/rewrite-book-shadow/index.html
```
Static, no build. Query params for stills: `t=0..1`, `state=new`, `haunt=0..1`, `compare=1`, `reduced=1`, `fresh=1`, `w=0..1`, `lit=1`, `lx`/`ly` (candle), `flip=0..1`, `anom=1` (freeze the anomaly).

## Controls
- Hold the fact line with the pointer, or Space / Enter on the focused line, for about 1.2 s. Releasing early cancels.
- Move the pointer or use arrow keys to move the candle.
- Hold C (or the Compare button) to see the old world in the same camera. Z (or Revert) undoes.
- H (or Look at the back) summons the shade early.
- Holding C while the shade is out fades the shade and the roll note too, so the old keeper and the shade never show together.
- P (or Turn page) once the shade has appeared.
- Reduced motion (OS setting or button): crossfade instead of travel, no flicker, no sway, no lean.

## Layout
The fact line, hold bar and caption sit in a strip on the right page under the puppet stage. The notes sit above the shade on the left page, the intro below it. The operation hint is in the bar below the book. At 700 px wide and narrower the book stays on top and the fact line, hold bar, caption and notes stack under it (checked at 640 and 390 wide).

## Tests and evidence
`node tests/flow-bs.mjs` (server on :8000) writes assertions; raw log in `docs/test-log-bs.txt`. `node tests/shoot-bs.mjs` makes `docs/screenshots/bs-*.jpg`. `node tests/record-bs.mjs` makes `docs/video/bs-flow.webm`. Browser and playwright-core are resolved by `tests/pw-bs.mjs` (env `PLAYWRIGHT_CORE`, `CHROME`).

## Unverified
- Chinese glyphs: the capture machine has no CJK font (`fc-list :lang=zh-cn` is empty, only Latin Noto Sans, Lato and Source Code Pro exist) and the network blocks every font and package host, so no CJK font could be vendored. Chinese renders as gaps in screenshots and video. The DOM text is asserted exactly. Width tests replace each fact character with a 1em box to simulate real CJK widths. Real CJK rendering is not visually verified. English captions are shown.
- Only Chromium headless was tested, no touch, no screen reader. The 390 px layout was tested with mouse input and a simulated CJK width, not on a phone.
- Page-curl warp is a horizontal squeeze model, not a physical paper simulation. The shade and its echo are not warped.
- Frame cost was measured only in headless software rendering (about 14 to 30 ms average).
- Same-composition compare pair: `bs-compare-before` uses `lit=1` to light the old world, because the real first screen is dark by design. `bs-before-*` are shots of the old code at 2be68e1.

## Assets
All procedural canvas drawing. No third-party images, fonts or audio. Outlines, holes and shadows are drawn from hash-seeded code, nothing is traced or imported.
