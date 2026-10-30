# Changelog

All notable events in the development of this repository, honestly recorded.

## [1.0.0] - 2026-10-30

### The uncomfortable part first: three full rebuilds

This repository's development environment was reset **three times** (the
working directory containing the game source was wiped). There was no source
backup outside that environment, so the game was rebuilt from scratch each
time — the third rebuild being the code in this commit. Consequences, stated
plainly:

- the current source is a fresh implementation of the same design (same
  architecture, mechanics, districts and rules), not a byte-identical copy
  of any earlier build;
- an earlier build had reproduced a reference `01-title.png` **byte-exact**
  (61778 bytes) as a fidelity proof against an earlier recovered file —
  that reference no longer exists after the third reset, so this build makes
  **no** byte-exactness claim about screenshots. They are fresh captures;
  the title screen happens to also be 61778 bytes with a 6-colour palette,
  which is a property of the format (see docs/architecture.md), not of any
  recovered original;
- everything claimed in docs/testing.md was re-verified against *this*
  source: 183/183 behavioural checks, 33/33 audit targets, all 7
  screenshots re-captured and re-validated.

### Bugs found by the test suite and fixed (this build)

- **world.js** — the alchemy corridor was carved at x=32, outside the
  machine hall (which ends at x=29), leaving the whole alchemy lab
  unreachable. The connectivity audit failed on all lab targets; corridor
  re-routed through x=27. Audit now 33/33 on every seed.
- **save.js** — the fallback storage backend was constructed per call, so
  `saveGame()` and `loadGame()` used different in-memory stores; made a
  singleton.
- **entities.js** — chase step priority used swapped indices in the
  vertical branch: with the player above a mob, the mob preferred stepping
  *away*. Rewrote the priority order per axis.
- **player.js** — facing did not reset the idle axis after vertical
  movement, so attacks/throws aimed sideways; movement now sets
  (fx,fy) exclusively.
- **capture-harness.js** — the PNG encoder wrote chunk lengths, IHDR
  width/height and Adler-32 little-endian (invalid PNG); only the deflate
  LEN/NLEN are little-endian. Also a corrupted zlib header (literal
  "u0078u0001" text) was caught by an 8-byte size delta and fixed.

### Verification (this build)

- `TLR_runHeadless()` — **183/183 PASS** (61 checks × 3 seeds: 20261030,
  987654321, 1357911130), zero failures, identical across seeds.
- `TLR_auditConnectivity()` — **33/33 targets reachable**, 7 groups, all
  seeds, no orphans.
- 7 screenshots captured headlessly; PNG structure fully validated
  (signature, IHDR 256×240, chunk walk to exact EOF, stored-deflate
  LEN/NLEN).

### Unverified (see docs/testing.md)

Real-browser execution (DOM, keyboard events, rAF loop), WebAudio output,
touch input, real localStorage persistence, performance, and human visual
confirmation were never possible in the authoring environment and remain
unverified.

### Added

- Complete ES5 game: `index.html` + 10 modules (~55 KB of source).
- Headless test suite and capture harness (rasterizer + indexed PNG
  encoder, zero dependencies).
- Documentation: README, design, architecture, testing report, asset
  provenance, changelog.
