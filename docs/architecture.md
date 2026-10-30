# Architecture

## Module map

```
index.html
  └─ script order: core → assets → audio → world → entities → player
                   → save → ui → render → main
```

All modules are IIFEs that attach to one shared namespace object (`TLR` on
`window`/`globalThis`). No modules, no imports — plain ES5 files.

| Module | Owns |
| --- | --- |
| `core.js` | `TLR` namespace, seeded LCG (`setSeed`, `rnd`, `ri`, `pick`), shared `TLR.S` state, tile constants (`SOLID`, `W`=40, `H`=32, `TS`=8), the 3×5 bitmap font and `drawText`/`centerText` |
| `assets.js` | colour palette `A.P`, 8×8 sprite pixel maps `A.SPR` (player, six enemy kinds, merchant, flask, vial), tile painters `A.drawTile`, logo |
| `audio.js` | lazy `AudioContext`, square-wave `beep`, `AU.sfx(name)` table; silent no-op when no AudioContext exists |
| `world.js` | district rectangles and landmarks (`TLR.LANDMARK`), the carver `buildMap()` (rects + corridors + interactables), seeded spawn packs `buildWorld()`, BFS helpers (`TLR.BFS`, `auditTargets`) |
| `entities.js` | enemy stat table `edef`, movement/occupation rules, line-of-sight (Bresenham), per-kind AI (chase priority order, ranged keep-distance, bomber, phasing, boss charge), projectiles, explosions |
| `player.js` | `tryMove` (4-dir facing, door teleports with 24-frame cooldown), `doAttack` per class, `damagePlayer`, `useItem`, `doInteract` (machine chain rule, cistern, geyser, bench, gate, reactor, merchant), merchant choice data |
| `save.js` | serialise/apply with a backend singleton: real `localStorage` when present, otherwise an in-memory shim |
| `ui.js` | HUD (hp bar, counters, chain state, message line), satchel, alchemy menu, notes, pause (dithered, no alpha), choice dialog, title menu, dead/win screens |
| `render.js` | camera clamp, ground pass, explosions, entities, projectiles, player, dithered darkness pass (2 light levels + self-lit tiles), overlays |
| `main.js` | input state (`TLR.keys` + edge-triggered `TLR.press`), `TLR.step()` fixed update (escape layering → pause → dialog → alchemy → panels → combat), boss trigger, browser bootstrap (keyboard mapping, rAF loop), test hooks |

## Key invariants

1. **One state object.** `TLR.S` holds the entire game state; `TLR.state()`
   returns a deep snapshot for tests (values, never live references).
2. **Fixed-step simulation.** `TLR.step()` is one deterministic tick; the
   browser loop calls it at 60 Hz via an accumulator. Tests call it
   directly. Rendering never mutates state.
3. **fillRect-only rendering.** `render.js`/`ui.js`/`assets.js` draw with
   `fillRect`/`fillStyle`/`save`/`restore` only. Colours are `rgb(r,g,b)`
   strings — no alpha compositing anywhere. This is what makes the headless
   rasterizer in `tests/capture-harness.js` an exact drop-in for a Canvas2D
   context, enabling byte-stable PNG screenshots.
4. **No Math.random / Date / setTimeout inside the simulation.** All
   randomness flows from the LCG; animation phases read the frame counter
   `S.t`.
5. **Escape layering** (`dispatchEsc`): dialog/choice → panels → pause —
   a fixed priority so a single Esc key always closes the innermost UI layer.

## Test hooks (TLR)

- `TLR.start(seed, cls)`, `TLR.toTitle()` — lifecycle
- `TLR.step()`, `TLR.tap(key)`, `TLR.press`, `TLR.keys` — input injection
- `TLR.state()`, `TLR.entAt(x,y)` — observation (snapshots)
- `TLR.setSeed/…` — RNG control
- `TLR_runHeadless()`, `TLR_auditConnectivity()` (in `tests/headless.js`)
- `TLR_makeRC()`, `TLR_encodePNG(rc)`, `TLR_captureAll(only?)`
  (in `tests/capture-harness.js`)

## Determinism notes

- LCG: `s' = (1103515245 · s + 12345) mod 2³²` via `Math.imul` (the classic
  glibc constants); draws are `[0,1)`, integer helpers `ri(n)`, `pick(arr)`.
- Enemy AI cooldowns are frame counters; projectiles carry fixed velocity
  vectors; chase uses a deterministic priority order, ties broken by axis
  distance only.
- Screenshot scenes are set up at a fixed frame (`t = 120`) from a fixed
  seed, so captures are byte-reproducible for a given game version.

## PNG encoder

`TLR_encodePNG` writes an indexed-colour (bit depth 8, colour type 3) PNG:

- 256×240, palette in **first-appearance scan order**;
- every scanline prefixed with filter byte 0;
- a single **stored** deflate block: `78 01` header, `01` final+stored flag,
  **16-bit little-endian LEN/NLEN**, raw bytes, big-endian Adler-32;
- chunk lengths, IHDR fields and Adler-32 are big-endian, per the PNG and
  DEFLATE specifications.

Total file size is therefore `61760 + 3·(palette colours)` bytes — which is
why every screenshot here is ~61.8 KB with zero compression.
