/* The Last Reactor - core.js
   Foundation: namespace, seeded LCG (no Math.random anywhere), shared state,
   3x5 bitmap font, tile helpers. ES5 syntax, zero dependencies. */
(function (g) {
  'use strict';
  var T = g.TLR = g.TLR || {};

  /* ---------- deterministic LCG ---------- */
  var _seed = 20261030;
  T.setSeed = function (n) { _seed = (n >>> 0) || 1; };
  T.getSeed = function () { return _seed; };
  T.rnd = function () {            /* [0,1) */
    _seed = (Math.imul(1103515245, _seed) + 12345) >>> 0;
    return _seed / 4294967296;
  };
  T.ri = function (n) { return Math.floor(T.rnd() * n) % n; };          /* [0,n) */
  T.pick = function (a) { return a[T.ri(a.length)]; };

  /* ---------- misc helpers ---------- */
  T.clamp = function (v, a, b) { return v < a ? a : (v > b ? b : v); };
  T.rgb = function (r, g, b) { return 'rgb(' + r + ',' + g + ',' + b + ')'; };
  T.rgba = function (r, g, b, a) { return 'rgba(' + r + ',' + g + ',' + b + ',' + a + ')'; };
  T.same = function (a, b) { return JSON.stringify(a) === JSON.stringify(b); };

  /* ---------- world constants ---------- */
  T.W = 40; T.H = 32;   /* map size in tiles */
  T.TS = 8;             /* tile size in px */
  T.CW = 256; T.CH = 240;/* canvas size in px (32x30 tiles) */

  /* tiles:
     '#' wall   '.' floor  'D' passage-door (step on it -> teleport, cooldown)
     'G' sealed gate (solid until all machines are on) 'g' open gate
     'M' machine 'C' cistern 'E' energy geyser 'A' alchemy bench 'R' reactor core
  */
  T.SOLID = { '#': 1, 'M': 1, 'C': 1, 'E': 1, 'A': 1, 'R': 1, 'G': 1 };
  T.isSolidChar = function (c) { return T.SOLID[c] ? true : false; };

  /* ---------- shared game state ---------- */
  function newState() {
    return {
      t: 0,                 /* frame counter */
      scene: 'title',       /* title | play | dead | win */
      cls: 'warden',        /* warden | alchemist | strelets */
      cursor: 0,            /* title menu cursor */
      map: [],
      px: 6, py: 5,         /* player tile */
      hp: 100, maxhp: 100,
      fx: 1, fy: 0,         /* facing */
      inv: { flaskFire: 1, vialHeal: 1, parts: 0 },
      reagents: { aqua: 0, ignis: 0, vis: 0 },
      machines: [0, 0, 0, 0],
      notes: [],            /* lore notes collected */
      light: 3,             /* light radius in tiles */
      doorCd: 0,            /* door re-entry cooldown, frames */
      msg: '', msgT: 0,
      panel: null,          /* null | 'inv' | 'alch' | 'notes' */
      pause: false,
      choice: null,         /* active merchant dialog {q, opts[], cb} */
      ents: [],             /* enemies + npc */
      proj: [],             /* projectiles */
      fx2: [],              /* explosions / particles */
      merchant: { x: 10, y: 7, stock: { flaskFire: 1, vialHeal: 1 } },
      gateOpen: false,
      bossSpawned: false, bossDead: false,
      hitFlash: 0
    };
  }
  T.newState = newState;
  T.S = null;               /* live state, set by start() */

  /* ---------- message line ---------- */
  T.msg = function (text) { var s = T.S; if (!s) return; s.msg = text; s.msgT = 180; };

  /* ---------- tile access ---------- */
  T.tileAt = function (x, y) {
    var s = T.S;
    if (x < 0 || y < 0 || x >= T.W || y >= T.H) return '#';
    return s.map[y * T.W + x];
  };
  T.setTile = function (x, y, c) {
    var s = T.S;
    if (x < 0 || y < 0 || x >= T.W || y >= T.H) return;
    s.map[y * T.W + x] = c;
  };
  T.solid = function (x, y) { return T.isSolidChar(T.tileAt(x, y)); };

  /* ---------- 3x5 bitmap font ----------
     each glyph: 15 chars of '0'/'1', row-major, 3 wide 5 tall */
  var F = {
    'A': '010101111101101', 'B': '110101110101110', 'C': '011100100100011',
    'D': '110101101101110', 'E': '111100110100111', 'F': '111100110100100',
    'G': '011100101101011', 'H': '101101111101101', 'I': '111010010010111',
    'J': '011001001101010', 'K': '101101110101101', 'L': '100100100100111',
    'M': '101111111101101', 'N': '111101101101101', 'O': '010101101101010',
    'P': '110101110100100', 'Q': '010101101011001', 'R': '110101110101101',
    'S': '011100010001110', 'T': '111010010010010', 'U': '101101101101111',
    'V': '101101101101010', 'W': '101101111111101', 'X': '101101010101101',
    'Y': '101101010010010', 'Z': '111001010100111',
    '0': '111101101101111', '1': '010110010010111', '2': '110001010100111',
    '3': '111001011001111', '4': '101101111001001', '5': '111100110001110',
    '6': '011100111101111', '7': '111001010010010', '8': '111101111101111',
    '9': '111101111001110',
    ' ': '000000000000000', '.': '000000000000010', ',': '000000000010100',
    ':': '000010000010000', '!': '010010010000010', '?': '110001010000010',
    '-': '000000111000000', '\u2014': '000000111111000', "'": '010010000000000',
    '/': '001001010100100', '+': '000010111010000', '(': '001010010010001',
    ')': '100010010010100', '%': '101001010100101', '>': '100010001010100',
    '*': '000101010101000', '=': '000111000111000'
  };
  T.FONT = F;
  T.hasGlyph = function (ch) { return Object.prototype.hasOwnProperty.call(F, ch); };
  T.textW = function (str, sc) { return str.length * (3 + 1) * (sc || 1) - (sc || 1); };
  T.textH = function (sc) { return 5 * (sc || 1); };

  /* draw text using only fillRect - works with any 2d ctx or the test rasterizer */
  T.drawText = function (ctx, str, x, y, color, sc) {
    var i, ch, g2, r, c;
    sc = sc || 1;
    ctx.fillStyle = color;
    for (i = 0; i < str.length; i++) {
      ch = str.charAt(i);
      g2 = F[ch] || F['?'];
      for (r = 0; r < 5; r++) {
        for (c = 0; c < 3; c++) {
          if (g2.charAt(r * 3 + c) === '1') {
            ctx.fillRect(x + i * 4 * sc + c * sc, y + r * sc, sc, sc);
          }
        }
      }
    }
  };
  T.centerText = function (ctx, str, y, color, sc) {
    T.drawText(ctx, str, Math.floor((T.CW - T.textW(str, sc)) / 2), y, color, sc);
    return Math.floor((T.CW - T.textW(str, sc)) / 2);
  };

  /* ---------- compatibility note ----------
     Everything is plain ES5: no let/const/arrow functions/template strings,
     no modules, no bundler, no external assets. Deterministic: all randomness
     flows through TLR.setSeed/TLR.rnd. */
})(typeof window !== 'undefined' ? window : globalThis);
