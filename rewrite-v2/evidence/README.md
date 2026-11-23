# Evidence

BEFORE set captured at commit 92966c8 by `node tests/evidence-v2.mjs before` (1600x900, `?yaw=-12&pitch=54&zoom=1` plus stage params). Raw logs: `logs/before-run.txt` (19 passed), `logs/before-flow.txt` (16 passed).

AFTER set: `node tests/evidence-v2.mjs after` on the FEAT-002 commit, same viewport, camera and stages, in `after/`. Raw logs: `logs/after-run.txt` (20 passed), `logs/after-flow.txt` (18 passed).

## Chinese visibility status

No CJK font exists on the capture machine (`fc-list :lang=zh` empty; a disk search for `*cjk*`, `*.ttc`, `*wqy*`, `*noto*sc*` found only Perl/Python codec files, no font). Chinese glyphs therefore render blank in headless captures. Chinese text presence is checked in the DOM by `tests/flow-v2.mjs`; on-screen Chinese legibility is unverified.
