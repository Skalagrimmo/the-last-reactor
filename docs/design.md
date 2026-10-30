# Design notes

## Premise

The machine city is dying because its heart — the last reactor — sleeps.
The player is the last keeper: part engineer, part scavenger. The whole game
is one descent: wake the chain, open the gate, kill the Sentinel, touch the
core.

## Core loop

1. Explore a district (light radius is small at first).
2. Interact with machinery: machines → chain progress + VIS reagent + note;
   cisterns → AQUA; geyser → IGNIS.
3. Brew consumables at the bench from reagents.
4. Fight or dodge the local enemy pack; collect machine parts from kills.
5. Trade parts with the merchant for flasks and vials.
6. Advance the chain until the gate unseals, then face the Sentinel.

## Classes

| Class | HP | Attack | Feel |
| --- | --- | --- | --- |
| Warden | 110 | melee slash, strictly in the facing direction | brawler, forgiving |
| Alchemist | 90 | throws a fire flask: area blast on impact or timeout | crowd control |
| Strelets | 80 | long-range bolt, stopped by walls | positioning game |

Class choice happens on the title screen and sets max HP. Everything else is
identical across classes.

## Enemies

| Kind | HP | Behaviour |
| --- | --- | --- |
| Rat | 6 | weak, fast wanderer; chases on sight |
| Ghoul | 12 | relentless chaser |
| Strelets | 10 | ranged; keeps distance and fires bolts with line of sight |
| Troll | 18 | lobs firebombs (area damage on contact or timeout) |
| Wraith | 8 | phases through single walls |
| Sentinel | 60 | boss: charges and triple-shot spreads; guards the core |

Enemy packs are seeded per district (entry hall, machine hall, alchemy lab,
cisterns). The Sentinel spawns when the player first enters the reactor
chamber with the gate open.

## World layout

Five districts on a 40×32 tile grid:

- **Entry hall** — start, merchant, rats.
- **Machine hall** — the four machines of the chain.
- **Overflow ducts** — the spine corridor with two widened duct crossings.
- **Alchemy lab** — bench, troll pack, passage-door to the cisterns.
- **Cisterns** — cisterns, the energy geyser, wraiths, door back.
- **Reactor chamber** — sealed gate (opens after the full chain), reactor
  core, Sentinel.

The two passage doors teleport with a 24-frame cooldown; before the cooldown
clears the paired door does not re-trigger, which prevents ping-pong.

## Progression numbers

- Light radius: starts 3, +1 per machine, max 7.
- Vial heals 35 HP. Fire flask blast: 13 damage in a radius (self-damage 6).
- Merchant: flask = 2 parts, vial = 1 part.
- Machines: VIS +1 each; notes 4 total (read them in the notes panel).

## Determinism as a design pillar

Every mechanic above is expressed in frames and LCG draws, never in wall
time. This is why the same seed and the same scripted input produce the same
world, the same fights and the same endings — and why the test suite can
assert behaviour instead of vibes.
