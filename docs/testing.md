# Testing report

Honest and complete: what is verified, how, and what is explicitly **not**
verified.

## How to run

The suite needs no DOM and no canvas:

- Headless (any JS host): load all `js/*.js` then `tests/headless.js`, then
  call `TLR_runHeadless()` and `TLR_auditConnectivity()`.
- Browser: open `index.html`, open the console, call the same two functions.

## Behavioural suite — 183/183 PASS

`TLR_runHeadless()` runs **61 checks × 3 seeds** (20261030, 987654321,
1357911130). Current status: **183/183 pass, 0 fail** — identical results on
all three seeds.

Per seed, the 61 checks are:

- **World (W01–W08)** — map is 40×32 with a solid border; start anchor is
  walkable; identical seed ⇒ identical world+spawns (JSON compare); 4
  machines, 3 cisterns, the geyser and the bench are placed; the reactor gate
  starts sealed.
- **Movement (M01–M08)** — stepping moves the player; walls block; facing
  follows movement; the alchemy→cisterns door teleports into the cisterns
  district (arrival asserted inside a range); the 24-frame cooldown arms on
  transition, ticks down per frame, blocks the paired door while active, and
  the door links back once it clears.
- **Machines (Q01–Q07)** — the chain refuses out-of-order activation; the
  four machines wake in order; each yields VIS; each drops a lore note; the
  gate unseals after the full chain; light grows 3→7; an active machine
  reports that it already hums.
- **Alchemy (A01–A08)** — cisterns give AQUA; the geyser gives IGNIS; the
  bench opens its menu; AQUA+IGNIS brews a fire flask; brewing without
  reagents fails; AQUA+VIS brews a vial; Esc closes the menu; throwing a
  flask spawns a projectile.
- **Combat (C01–C13)** — melee kills an adjacent rat and grants a part; melee
  does not hit behind; a downward attack hits below (regression check for
  the facing bug); a flask blast kills every rat in the radius; strelets
  fires a bolt; the bolt wounds a ghoul at range; walls stop bolts; the
  troll lobs a firebomb; the blast hurts the player; an expired bomb still
  detonates; the ghoul closes in on the player; at 0 HP the player dies.
- **Progress (P01–P11)** — the merchant opens a 3-option choice dialog; the
  cursor moves; buying a vial spends a part; save serialises the run; loading
  restores position/HP/progress; pause toggles on; the world stays frozen
  while paused; pause toggles off; the satchel opens; Esc closes the satchel
  *before* pausing (layering check); a second Esc pauses.
- **Boss & win (B01–B03)** — entering the chamber with the gate open wakes
  the Sentinel; killing it flags `bossDead`; touching the core wins the game.
- **Determinism & messages (D01–D03)** — a scripted 130-frame sequence
  replays to an identical state JSON; messages are timed (180 frames) and
  expire.

## Connectivity audit — 33/33 reachable, 7 groups, all seeds

`TLR_auditConnectivity()` BFS-floods walkable tiles from the start anchor
(the sealed gate is treated as passable, since machines open it) and asserts
that each of 33 fixed targets is reachable directly or from an adjacent tile:

1. machines (4) — 2. bench (1) — 3. cisterns (3) — 4. geyser + both doors (3)
— 5. gate + reactor + approaches (4) — 6. district floors + overflow ducts +
links (11) — 7. merchant + start + approach corners (7).

Result on all three seeds: **ok, 33/33 reached, 0 orphans** (each target
belongs to exactly one group; the runner also fails itself if the total is
not 33).

## Screenshot captures

7 canonical scenes (`01-title` … `07-ending`) are rendered by the same game
renderer against the harness rasterizer and encoded by the built-in indexed
PNG encoder (see docs/architecture.md). All 7 were validated: PNG signature,
256×240 IHDR, chunk walk ends exactly at EOF, single stored deflate block
with the documented LEN/NLEN. Sizes: 61778, 61820, 61835, 61829, 61829,
61841, 61775 bytes.

The captures are deterministic (fixed seed, fixed frame `t = 120`), so
`node tests/regen-screenshots.js` regenerates byte-identical files anywhere
the same source runs. Because the publishing connector used to create this
repository can only write UTF-8 text (binary uploads would be corrupted —
verified during development), the PNGs are committed to GitHub by
`.github/workflows/screenshots.yml`, which runs the same script on GitHub's
own runners whenever code or tests change. Each committed PNG's git blob SHA
was verified against the locally computed reference after generation.

## What is NOT tested (known limitations)

- **No real browser was available to the author.** The game loop, keyboard
  handling (`keydown`/`keyup`, preventDefault), `requestAnimationFrame`
  timing and canvas upscaling have never been executed against a real DOM.
  They are plain, simple code, but "should work" is not "verified".
- **WebAudio** is untested: no real AudioContext existed in the test
  environment; the sfx table only asserts that it degrades silently.
- **Touch / mobile input** is not implemented and not tested.
- **localStorage backend**: the round-trip is tested against the in-memory
  shim; persistence across real page reloads in a real browser is untested.
- **Performance** is untested (no profiling was possible); the target
  hardware is "any laptop".
- **Visual correctness**: screenshots are byte-validated as PNG files, but
  no human has confirmed they look right in a browser context.
- **Balance** (fun, difficulty curve) is out of scope for automation.

## Bugs the suite caught during development (all fixed, see CHANGELOG)

- Alchemy lab was unreachable: its corridor started outside the machine
  hall (caught by the connectivity audit).
- The in-memory save backend was re-created per call, losing saved data
  between `saveGame()` and `loadGame()`.
- Chase priority indices were swapped for vertical pursuit — mobs fled when
  the player stood above them.
- Facing did not reset the idle axis: attacks aimed sideways after vertical
  movement.
- PNG encoder wrote chunk lengths/Adler-32 little-endian (invalid PNG).
