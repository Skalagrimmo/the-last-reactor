/* The Last Reactor - world.js
   Procedural district generator: carves five districts out of a walled grid,
   connects them with corridors and overflow ducts, then seeds interactables,
   the merchant and enemy packs through the LCG. The layout anchors are
   deterministic; the seed drives spawns and contents.
   Every generated map is validated by a BFS connectivity audit
   (see tests/headless.js: TLR_auditConnectivity). */
(function (g) {
  'use strict';
  var T = g.TLR = g.TLR || {};

  /* district rectangles (x0,y0,x1,y1 inclusive) */
  var ENTRY   = { x0: 2,  y0: 2,  x1: 11, y1: 9,  name: 'ENTRY HALL' };
  var MACH    = { x0: 16, y0: 2,  x1: 29, y1: 9,  name: 'MACHINE HALL' };
  var ALCH    = { x0: 29, y0: 14, x1: 38, y1: 22, name: 'ALCHEMY LAB' };
  var CIST    = { x0: 2,  y0: 24, x1: 17, y1: 30, name: 'CISTERNS' };
  var REACT   = { x0: 20, y0: 26, x1: 37, y1: 30, name: 'REACTOR CHAMBER' };

  /* fixed layout points */
  var START   = { x: 6, y: 5 };
  var MACHINES = [{ x: 18, y: 4 }, { x: 21, y: 3 }, { x: 25, y: 4 }, { x: 28, y: 7 }];
  var BENCH    = { x: 33, y: 17 };
  var CISTERNS = [{ x: 4, y: 26 }, { x: 7, y: 29 }, { x: 12, y: 25 }];
  var GEYSER   = { x: 14, y: 29 };
  var REACTOR  = { x: 28, y: 28 };
  var GATE     = { x: 25, y: 24 };            /* 'G' -> 'g' when powered */
  var DOOR_ALCH  = { x: 35, y: 20, to: { x: 6, y: 27 } };  /* alchemy -> cisterns */
  var DOOR_CIST  = { x: 3,  y: 27, to: { x: 34, y: 19 } }; /* cisterns -> alchemy */
  var OVERFLOW = [{ x0: 24, y0: 13, x1: 26, y1: 13 },      /* overflow ducts */
                  { x0: 24, y0: 23, x1: 26, y1: 23 }];
  T.LANDMARK = {
    START: START, MACHINES: MACHINES, BENCH: BENCH, CISTERNS: CISTERNS,
    GEYSER: GEYSER, REACTOR: REACTOR, GATE: GATE,
    DOOR_ALCH: DOOR_ALCH, DOOR_CIST: DOOR_CIST, OVERFLOW: OVERFLOW,
    ENTRY: ENTRY, MACH: MACH, ALCH: ALCH, CIST: CIST, REACT: REACT
  };

  function rect(g, x0, y0, x1, y1) {
    var x, y;
    for (y = y0; y <= y1; y++) {
      for (x = x0; x <= x1; x++) {
        g[y * T.W + x] = '.';
      }
    }
  }
  function hLine(g, x0, x1, y) { rect(g, x0, y, x1, y); }
  function vLine(g, x, y0, y1) { rect(g, x, y0, x, y1); }

  T.districtAt = function (x, y) {
    var L = T.LANDMARK, k;
    var list = [ENTRY, MACH, ALCH, CIST, REACT];
    for (k = 0; k < list.length; k++) {
      if (x >= list[k].x0 && x <= list[k].x1 && y >= list[k].y0 && y <= list[k].y1) {
        return list[k].name;
      }
    }
    return 'DUCTS';
  };

  /* build the map grid; returns the grid (array of chars) */
  T.buildMap = function () {
    var g = new Array(T.W * T.H), x, y, i;
    for (y = 0; y < T.H; y++) {
      for (x = 0; x < T.W; x++) g[y * T.W + x] = '#';
    }
    /* districts */
    rect(g, ENTRY.x0, ENTRY.y0, ENTRY.x1, ENTRY.y1);
    rect(g, MACH.x0, MACH.y0, MACH.x1, MACH.y1);
    rect(g, ALCH.x0, ALCH.y0, ALCH.x1, ALCH.y1);
    rect(g, CIST.x0, CIST.y0, CIST.x1, CIST.y1);
    rect(g, REACT.x0, REACT.y0, REACT.x1, REACT.y1);

    /* corridors: entry -> machine hall (y=5) */
    hLine(g, 12, 15, 5);
    /* machine hall -> spine (x=25, down to reactor gate) */
    vLine(g, 25, 10, 23);
    /* overflow ducts (widened crossings of the spine) */
    for (i = 0; i < OVERFLOW.length; i++) {
      hLine(g, OVERFLOW[i].x0, OVERFLOW[i].x1, OVERFLOW[i].y0);
    }
    /* spine continues to the gate and into the reactor chamber */
    vLine(g, 25, 24, 25);
    hLine(g, 25, 27, 28);
    /* machine hall -> alchemy lab (down x=27, then east into the lab) */
    vLine(g, 27, 10, 13);
    hLine(g, 27, 32, 13);
    /* cisterns -> reactor chamber (y=28) */
    hLine(g, 18, 19, 28);
    rect(g, 17, 27, 17, 29);

    /* interactables */
    for (i = 0; i < MACHINES.length; i++) g[MACHINES[i].y * T.W + MACHINES[i].x] = 'M';
    g[BENCH.y * T.W + BENCH.x] = 'A';
    for (i = 0; i < CISTERNS.length; i++) g[CISTERNS[i].y * T.W + CISTERNS[i].x] = 'C';
    g[GEYSER.y * T.W + GEYSER.x] = 'E';
    g[REACTOR.y * T.W + REACTOR.x] = 'R';
    g[GATE.y * T.W + GATE.x] = 'G';
    g[DOOR_ALCH.y * T.W + DOOR_ALCH.x] = 'D';
    g[DOOR_CIST.y * T.W + DOOR_CIST.x] = 'D';

    /* keep start tile walkable */
    g[START.y * T.W + START.x] = '.';
    return g;
  };

  /* passage doors: walking onto one teleports the player (with cooldown) */
  T.DOORS = [DOOR_ALCH, DOOR_CIST];

  /* ---------- enemy packs (seeded) ---------- */
  var KINDS = ['rat', 'ghoul', 'strelets', 'troll', 'wraith'];
  var PACKS = [
    { kind: 'rat',      n: 2, rect: ENTRY },
    { kind: 'ghoul',    n: 2, rect: MACH },
    { kind: 'strelets', n: 2, rect: MACH },
    { kind: 'troll',    n: 2, rect: ALCH },
    { kind: 'wraith',   n: 2, rect: CIST },
    { kind: 'rat',      n: 1, rect: CIST },
    { kind: 'ghoul',    n: 1, rect: ALCH }
  ];

  function freeSpot(g, r, avoid, s) {
    var tries = 0, x, y, ok, k;
    while (tries < 200) {
      tries++;
      x = r.x0 + T.ri(r.x1 - r.x0 + 1);
      y = r.y0 + T.ri(r.y1 - r.y0 + 1);
      if (g[y * T.W + x] !== '.') continue;
      if (x === s.px && y === s.py) continue;
      ok = true;
      for (k = 0; k < avoid.length; k++) {
        if (avoid[k].x === x && avoid[k].y === y) { ok = false; break; }
      }
      if (ok) { avoid.push({ x: x, y: y }); return { x: x, y: y }; }
    }
    return { x: r.x0, y: r.y0 };
  }

  /* full world build: map + entities + merchant; requires T.S initialized */
  T.buildWorld = function () {
    var s = T.S, g = T.buildMap(), i, e, avoid, p, def;
    s.map = g;
    s.px = START.x; s.py = START.y;
    s.merchant.x = 10; s.merchant.y = 7;
    avoid = [{ x: START.x, y: START.y }, { x: s.merchant.x, y: s.merchant.y }];
    s.ents = [];
    for (i = 0; i < PACKS.length; i++) {
      p = PACKS[i];
      def = T.edef ? T.edef(p.kind) : null;
      for (e = 0; e < p.n; e++) {
        var spot = freeSpot(g, p.rect, avoid, s);
        s.ents.push({
          kind: p.kind, x: spot.x, y: spot.y,
          hp: def ? def.hp : 10, mx: def ? def.hp : 10,
          cd: 0, dir: T.ri(4), st: 0
        });
      }
    }
    return g;
  };

  /* ---------- BFS connectivity audit (used by tests, also dev sanity) ---------- */
  T.auditTargets = function () {
    var L = T.LANDMARK, t = [], i;
    /* machines (4) */
    for (i = 0; i < L.MACHINES.length; i++) t.push({ what: 'machine ' + i, at: L.MACHINES[i] });
    /* bench, geyser, cisterns (3), doors (2), gate, reactor, merchant, start */
    t.push({ what: 'bench', at: L.BENCH });
    t.push({ what: 'geyser', at: L.GEYSER });
    for (i = 0; i < L.CISTERNS.length; i++) t.push({ what: 'cistern ' + i, at: L.CISTERNS[i] });
    t.push({ what: 'door alch', at: L.DOOR_ALCH });
    t.push({ what: 'door cist', at: L.DOOR_CIST });
    t.push({ what: 'gate', at: L.GATE });
    t.push({ what: 'reactor', at: L.REACTOR });
    t.push({ what: 'merchant', at: { x: 10, y: 7 } });
    t.push({ what: 'start', at: L.START });
    /* walkable anchors of every district + both overflow ducts */
    t.push({ what: 'entry floor', at: { x: 4, y: 3 } });
    t.push({ what: 'mach floor', at: { x: 20, y: 6 } });
    t.push({ what: 'alch floor', at: { x: 36, y: 16 } });
    t.push({ what: 'cist floor', at: { x: 10, y: 28 } });
    t.push({ what: 'react floor', at: { x: 24, y: 28 } });
    t.push({ what: 'duct a', at: { x: 26, y: 13 } });
    t.push({ what: 'duct b', at: { x: 24, y: 23 } });
    /* cistern<->reactor link, machine spine sample, alchemy approach */
    t.push({ what: 'cist link', at: { x: 18, y: 28 } });
    t.push({ what: 'spine mid', at: { x: 25, y: 18 } });
    t.push({ what: 'reactor approach', at: { x: 27, y: 28 } });
    t.push({ what: 'gate south', at: { x: 25, y: 27 } });
    t.push({ what: 'alch door north', at: { x: 34, y: 19 } });
    t.push({ what: 'cist door east', at: { x: 5, y: 27 } });
    t.push({ what: 'entry east', at: { x: 11, y: 5 } });
    t.push({ what: 'mach west', at: { x: 16, y: 5 } });
    t.push({ what: 'alch corner', at: { x: 37, y: 21 } });
    t.push({ what: 'react wide', at: { x: 34, y: 29 } });
    t.push({ what: 'entry corner', at: { x: 3, y: 8 } });
    /* total: 33 targets */
    return t;
  };

  T.BFS = function (from) {
    /* returns distance map (frames) over walkable tiles; doors/gate walkable
       in principle (gate assumed open for audit purposes), interactables
       are entered from an adjacent tile, so BFS also marks tiles adjacent
       to each target. */
    var g = T.S.map, q = [], d = new Array(T.W * T.H), i, x, y, nx, ny, k,
        DX = [1, -1, 0, 0], DY = [0, 0, 1, -1];
    for (i = 0; i < d.length; i++) d[i] = -1;
    q.push({ x: from.x, y: from.y });
    d[from.y * T.W + from.x] = 0;
    while (q.length) {
      var cur = q.shift();
      for (k = 0; k < 4; k++) {
        nx = cur.x + DX[k]; ny = cur.y + DY[k];
        if (nx < 0 || ny < 0 || nx >= T.W || ny >= T.H) continue;
        if (d[ny * T.W + nx] !== -1) continue;
        var c = g[ny * T.W + nx];
        if (T.isSolidChar(c) && c !== 'g' && c !== 'G') continue; /* treat gate as passable for audit */
        d[ny * T.W + nx] = d[cur.y * T.W + cur.x] + 1;
        q.push({ x: nx, y: ny });
      }
    }
    return d;
  };
})(typeof window !== 'undefined' ? window : globalThis);
