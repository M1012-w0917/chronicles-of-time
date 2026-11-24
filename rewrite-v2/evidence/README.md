# Evidence

Branch `feat/rewrite-v2-diorama` (PR #6, issue #23). Round 3 deepening.

- BEFORE = commit 7b11cbb (previous PR head), served from a `git archive` copy.
- AFTER = code commit **408708f654bd5e10ffd8a79dd99e2963a492ca54** (subject: "feat: deepen V2 antique book ..."). Every file under this directory (screenshots, compare, video, logs) was generated from that code commit; the following commit adds only these evidence files. The hash of the evidence commit itself cannot be written inside it: see the PR #6 body or `git log -1` for the actual remote HEAD.
- Old (7b11cbb) evidence was compared to the new capture by viewing the first screen (01) and the ending (05 and the last video frame) before pushing. Result: walls and roofs are no longer saturated toy-block colours (a few accent roofs remain), the candle pool lights the pen and text area while the far page falls into shade, the spine has deep grooves, the page block shows ragged stacked layers with contact shadows, buildings leave outlined footprints with fold lines, and the ending has a red-ink silhouette, ring and tally strokes at the hero's position.

## Run entry

- `file://<repo>/rewrite-v2/index.html`
- or from the repo root: `python3 -m http.server 8000`, then `http://localhost:8000/rewrite-v2/index.html`
- Debug params: `?yaw=-12&pitch=54&zoom=1&t=0.45`, `?state=new`, `?haunt=1`, `?w=0.55`, `?reduced=1`

## Assets

| Path | What |
|---|---|
| `before/`, `after/` | Five stages each, same names, 1600x900, same camera (`yaw=-12 pitch=54 zoom=1`): 01-before-rewrite, 02-pen-down (pen down, w=0.55), 03-mid-rewrite (chained reconstruction, t=0.45, rows pressing in), 04-new-world (dwell), 05-haunt (causal anomaly). `node tests/evidence-v2.mjs before\|after` (before: BASE pointed at the 7b11cbb copy) |
| `compare/` | before (left) and after (right) per stage, 3200x900. `node tests/compare-v2.mjs` |
| `video/v2-interaction.webm` | One uninterrupted real recording, 1920x1080, about 94 s, VP8, 25 fps, raw Playwright output (not re-encoded). Input is real keyboard and mouse events (Space/Enter hold, Z, C, Tab, R, mouse drag to orbit, mouse hold on the pen button). `node tests/record-v2.mjs` |
| `logs/` | Raw output with date, node version, code commit and command: before-evidence, after-evidence, after-compare, after-shoot, after-run, after-flow, after-interaction, after-record |
| `../../docs/screenshots/v2-*.jpg` | `node tests/shoot-v2.mjs` |

## Results

run-v2 21 passed, flow-v2 19 passed (http and file://), interaction-v2 15 lines passed (13 original steps plus mouse orbit 9b and the Chinese DOM check 14). Recording run: same scenario, all steps ok (see logs/after-record.txt).

## Chinese font status

**The recording and screenshots show no readable Chinese.** The capture machine has no CJK font (`fc-list :lang=zh` empty, no font file found on disk) and no font source is reachable: network is repository-only (fonts CDN, npm, PyPI and other GitHub repositories all failed or were refused). So the Chinese lines in the dock and the margin echo render blank or as tofu.
What is verified instead: DOM text assertions in the same scenario and logs (`logs/after-interaction.txt`, `logs/after-record.txt`, step 1 and step 14): `灰堡市建于永昌四十二年。` at the start, `灰堡市从未建立。` and the echo `他记得永昌四十二年。` (shown) at the ending.
No font asset was added, because no source and licence could be documented here. Alternatives: (1) re-run `node tests/record-v2.mjs` on a machine with `fonts-noto-cjk` installed (CSS already lists Noto Serif CJK SC, Source Han Serif SC, Songti SC, SimSun); (2) bundle a subset woff2 of Noto Serif SC (SIL OFL 1.1, from the notofonts/Google Fonts release) under `rewrite-v2/fonts/` with `@font-face`, and record its source and licence here; (3) record on any desktop with Chinese system fonts.

## Known variation between runs

Mid-rewrite counts in step 3 differ between logs, because headless software GL runs at varying speed. Assertions are ranges and the gone count equals the footprint count.

## Asset sources

All visuals are procedural CSS/DOM in `rewrite-v2/`. No external images, fonts or audio. Playwright (headless Chromium) and ffmpeg (frame inspection only) are used for capture.

## Unverified

- Chinese glyph rendering on screen (see above).
- GPU performance on real hardware (captures use software GL; the recording is sparse during rewrite). Added layers: 12 page layers, 4 contact shadows, 4 scuffs, 1 shade plate, 1 anomaly group.
- Real mobile touch, browsers other than headless Chromium, screen readers.
- Pages deployment (not done, by instruction).
