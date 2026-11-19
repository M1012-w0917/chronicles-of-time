# V4: the archive evidence room (candidate for issue #8)

A dark archive desk. A heavy ledger lies open with one fact on it. A CRT monitor shows fixed camera CAM-07 of the ferry quay. Around it lie two photos, an ID photo, a map with a pin, an index card and a timestamped duty log. Hold the pen on the fact and every one of them is rewritten from the same number `t`.

Fact: 陈守拙是灰堡市渡口的守闸人。 (Chen Shouzhuo is the lock keeper at the Ashmere ferry quay) becomes 渡口从未设闸,陈守拙从未存在。 (The ferry never had a lock. Chen never existed.)

## Run

No build, no network. Open `rewrite-v4/index.html` (file:// works) or serve the repo root with `python3 -m http.server 8000` and open `/rewrite-v4/`.

| Control | Action |
|---|---|
| Hold `Space`, or press and hold the fact line | write for about 1.2 s. Releasing early cancels |
| Hold `C`, or the Compare button | every document and the monitor show the old world; the new one is kept |
| `Z` or Revert | the reconstruction runs backwards to the old quay |
| Reduced motion button, or the OS setting | about 3 s reconstruction, no tracking jitter, no REC blink, no noise flicker; `t` is still continuous |

Debug params: `?t=0..1`, `?w=0..1` (pen down), `?state=new`, `?haunt=0..1`, `?compare=1`, `?reduced=1|0`, `?fresh=1` (forget the saved world). `t/w/state/haunt` freeze time for deterministic stills. `window.__slice` has `getState()`, `fingerprint()` (32x20 luminance of the live monitor), `setProgress(v)`, `forceHaunt(h)`, `setCompare(b)`. The new world is saved in localStorage and survives reload; Revert clears it.

## How it works

* `core.js`: pure logic. State machine OLD, WRITING, RECONSTRUCTING, NEW, HAUNT, REVERTING. `quay(t)` returns every parameter of the scene (gate swing, post height, masonry crumble, warehouse height, shoreline, silt, reeds). Log rows, card and haunt are also functions of `t` or `h`.
* `paint.js`: canvas 2D. `drawWorld(g, t, time)` paints CAM-07 from `t` only, so every frame differs continuously. The photos crop the same world canvas with a sepia print treatment, the map redraws its coastline and pin from `t`, the ID photo blanks to paper.
* `app.js`: wiring, DOM variables (`--t`, `--w`, `--h`) that drive the strike lines and fade of the fact, card and stamp.
* CRT: scanlines, vignette, noise, tracking jitter bands tied to the pen and the reconstruction, a ticking timecode.

## Haunt (caused by the rewrite)

After the new world has held for about 4 s, a stale tape loop with the date 1994-03-12 appears in a corner of the monitor. A figure stands in the open water where the gate footing used to be, slowly turns from its back and looks into the lens. The live frame shows an analytics box "PERSON 1" over empty water, and the log gains a line: registered persons 0 / detected in frame 1. No flashes, no audio, no gore. It does not appear in the OLD world, while comparing, or after Revert.

## Art and assets

All procedural canvas and CSS (paper grain is an inline SVG turbulence filter). No images, fonts, audio or network. No third-party code or licences. System CJK fonts render the Chinese; the sandbox had none, so screenshots show gaps where Chinese would be. Every Chinese line has an English caption.

## Tests

With a server on :8000: `node tests/flow-v4.mjs` (16 checks, passes), `node tests/shoot-v4.mjs` (docs/screenshots/v4-*.jpg), `node tests/record-v4.mjs` (docs/video/v4-flow.webm). `node --check rewrite-v4/*.js` for syntax. Needs global `@playwright/mcp` (playwright-core) and chrome-headless-shell.

The continuity test samples the monitor about 32 times during the reconstruction and asserts: the same canvas element, `t` never decreases, mean distance from the old frame grows quarter by quarter, and the largest single step is under 60% of the total change (a swap would be about 100%). The fingerprint includes CRT noise (about 2.5 units of mean luminance), so thresholds sit above that floor.

## Differences from other candidates

| | Rendering | What the screen is |
|---|---|---|
| V1 | cinematic 3D city flythrough | no desk |
| V2 | CSS 3D diorama on a book page | miniature |
| V3 | ink-wash scroll painting | one painting |
| V4 | fixed-camera CRT inside an archive room | five synced evidence items and one contradicting tape |

## Known limits

Unverified: real-GPU performance, non-Chromium browsers (Firefox, Safari), touch devices, real CJK font rendering. Mobile layout under 900 px is a single column and untuned. The world is stylised and small (640x400 feed). Compare shows the whole world at `t*(1-c)` rather than a split view. No audio.
