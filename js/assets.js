/* The Last Reactor - assets.js
   All art is procedural: palettes, 8x8 tile patterns and sprites drawn with
   code. No image files, no fonts, no third-party assets (see ASSETS.md). */
(function (g) {
  'use strict';
  var T = g.TLR = g.TLR || {};
  var A = T.A = {};

  /* ---------- palette ---------- */
  A.P = {
    bg:    T.rgb(7, 7, 13),      /* deep background */
    wall1: T.rgb(38, 38, 54),
    wall2: T.rgb(24, 24, 36),
    wallHi: T.rgb(56, 56, 76),
    floor1: T.rgb(15, 15, 24),
    floor2: T.rgb(19, 19, 30),
    door:  T.rgb(94, 66, 40),
    doorHi: T.rgb(128, 92, 56),
    gate:  T.rgb(70, 70, 92),
    mach:  T.rgb(60, 92, 100),
    machOn: T.rgb(92, 190, 190),
    cist:  T.rgb(46, 86, 130),
    cistHi: T.rgb(86, 150, 200),
    gey:   T.rgb(150, 74, 40),
    geyHi: T.rgb(230, 140, 60),
    bench: T.rgb(70, 110, 60),
    benchHi: T.rgb(110, 170, 90),
    react: T.rgb(160, 120, 50),
    reactOn: T.rgb(250, 210, 90),
    player: T.rgb(220, 220, 230),
    playerHi: T.rgb(255, 255, 255),
    rat:   T.rgb(140, 120, 100),
    ghoul: T.rgb(110, 130, 90),
    troll: T.rgb(90, 100, 120),
    strelets: T.rgb(120, 100, 130),
    wraith: T.rgb(100, 90, 140),
    boss:   T.rgb(200, 60, 60),
    bolt:  T.rgb(250, 250, 200),
    bomb:  T.rgb(240, 120, 40),
    fire:  T.rgb(250, 150, 60),
    flask: T.rgb(120, 200, 120),
    vial:  T.rgb(230, 120, 120),
    hud:   T.rgb(200, 200, 210),
    hudDim: T.rgb(90, 90, 110),
    hp:    T.rgb(200, 60, 60),
    hpHi:  T.rgb(240, 120, 100),
    dark:  T.rgb(0, 0, 0),
    white: T.rgb(255, 255, 255),
    gold:  T.rgb(240, 200, 90)
  };

  /* ---------- sprites: 8x8, one char per pixel, '.'=skip ---------- */
  A.SPR = {
    player: [
      '.ppppp..',
      '.p...p..',
      '.p.h.p..',
      '.ppppp..',
      '..ppp...',
      '.p.p.p..',
      '.p...p..',
      '..*.*...'
    ],
    playerBack: [
      '.ppppp..',
      '.p...p..',
      '.ppppp..',
      '.ppppp..',
      '..ppp...',
      '.p.p.p..',
      '.p...p..',
      '..*.*...'
    ],
    rat: [
      '........',
      '........',
      '..rr....',
      '.rrrrr..',
      'r.rrrrr.',
      '........',
      '........',
      '........'
    ],
    ghoul: [
      '..ggg...',
      '.g.g.g..',
      '.ggggg..',
      '..ggg...',
      '.g.g.g..',
      '..g.g...',
      '........',
      '........'
    ],
    troll: [
      '.t...t..',
      '.ttttt..',
      't.ttt.t.',
      't.ttt.t.',
      '.ttttt..',
      '..t.t...',
      '..t.t...',
      '........'
    ],
    strelets: [
      '..sss...',
      '.s.s.s..',
      '.sssss..',
      '..sss...',
      '.s.s.s..',
      '..sss...',
      '........',
      '........'
    ],
    wraith: [
      '..www...',
      '.w.w.w..',
      '.wwwww..',
      '.wwwww..',
      '..w.w...',
      '...w....',
      '........',
      '........'
    ],
    boss: [
      'b.bbb.b.',
      '.bbbbb..',
      'bbb.bbb.',
      'bbbbbbb.',
      '.bbbbb..',
      'b.bbb.b.',
      'b.....b.',
      '........'
    ],
    merchant: [
      '..mmm...',
      '.mmmmm..',
      '.m.m.m..',
      '.mmmmm..',
      'm.mmm.m.',
      '.mmmmm..',
      '........',
      '........'
    ],
    flask: [
      '...f....',
      '...f....',
      '..fff...',
      '.f...f..',
      '.f...f..',
      '.f...f..',
      '..fff...',
      '........'
    ],
    vial: [
      '..vvv...',
      '..vvv...',
      '..vvv...',
      '..vvv...',
      '..vvv...',
      '..vvv...',
      '..vvv...',
      '........'
    ]
  };
  /* color substitution per sprite kind */
  A.SPRCOL = {
    player: { p: 'player', h: 'playerHi', '*': 'hud' },
    playerBack: { p: 'player', h: 'playerHi', '*': 'hud' },
    rat: { r: 'rat' },
    ghoul: { g: 'ghoul' },
    troll: { t: 'troll' },
    strelets: { s: 'strelets' },
    wraith: { w: 'wraith' },
    boss: { b: 'boss' },
    merchant: { m: 'gold' },
    flask: { f: 'flask' },
    vial: { v: 'vial' }
  };

  /* draw a sprite at pixel position using only fillRect */
  A.drawSprite = function (ctx, name, x, y) {
    var spr = A.SPR[name], cols = A.SPRCOL[name], r, c, ch;
    if (!spr) return;
    for (r = 0; r < spr.length; r++) {
      for (c = 0; c < 8; c++) {
        ch = spr[r].charAt(c);
        if (ch !== '.') {
          ctx.fillStyle = A.P[cols[ch]] || A.P.white;
          ctx.fillRect(x + c, y + r, 1, 1);
        }
      }
    }
  };

  /* ---------- tile patterns (deterministic, position-based) ---------- */
  A.drawTile = function (ctx, ch, tx, ty, x, y, t) {
    var P = A.P, TS = T.TS, px = (tx * 7 + ty * 13) % 5; /* stable per-tile variation */
    switch (ch) {
    case '#':
      ctx.fillStyle = P.wall1; ctx.fillRect(x, y, TS, TS);
      ctx.fillStyle = P.wall2;
      ctx.fillRect(x, y + 6, TS, 2);
      ctx.fillRect(x + (px > 2 ? 1 : 5), y + 1, 2, 2);
      ctx.fillStyle = P.wallHi;
      ctx.fillRect(x, y, TS, 1);
      break;
    case '.':
      ctx.fillStyle = P.floor1; ctx.fillRect(x, y, TS, TS);
      ctx.fillStyle = P.floor2;
      if (px === 0) ctx.fillRect(x + 2, y + 3, 2, 2);
      if (px === 1) ctx.fillRect(x + 5, y + 5, 2, 2);
      break;
    case 'D':
      ctx.fillStyle = P.floor1; ctx.fillRect(x, y, TS, TS);
      ctx.fillStyle = P.door; ctx.fillRect(x + 1, y, 6, TS);
      ctx.fillStyle = P.doorHi; ctx.fillRect(x + 3, y + 2, 2, 4);
      break;
    case 'G':
      ctx.fillStyle = P.wall2; ctx.fillRect(x, y, TS, TS);
      ctx.fillStyle = P.gate; ctx.fillRect(x + 1, y + 1, 6, 6);
      ctx.fillStyle = P.wallHi; ctx.fillRect(x + 1, y + 1, 6, 1);
      break;
    case 'g':
      ctx.fillStyle = P.floor1; ctx.fillRect(x, y, TS, TS);
      ctx.fillStyle = P.door; ctx.fillRect(x + 1, y, 6, TS);
      ctx.fillStyle = P.doorHi; ctx.fillRect(x + 2, y, 1, TS);
      break;
    case 'M':
      ctx.fillStyle = P.wall2; ctx.fillRect(x, y, TS, TS);
      ctx.fillStyle = P.mach; ctx.fillRect(x + 1, y + 1, 6, 5);
      ctx.fillStyle = P.machOn;
      if (t % 60 < 30) ctx.fillRect(x + 2, y + 2, 4, 2);
      break;
    case 'C':
      ctx.fillStyle = P.wall2; ctx.fillRect(x, y, TS, TS);
      ctx.fillStyle = P.cist; ctx.fillRect(x + 1, y + 1, 6, 6);
      ctx.fillStyle = P.cistHi; ctx.fillRect(x + 2, y + 2, 2, 3);
      break;
    case 'E':
      ctx.fillStyle = P.floor1; ctx.fillRect(x, y, TS, TS);
      ctx.fillStyle = P.gey; ctx.fillRect(x + 2, y + 4, 4, 3);
      ctx.fillStyle = P.geyHi;
      ctx.fillRect(x + 3, y + 1 + (t % 40 < 20 ? 0 : 1), 2, 3);
      break;
    case 'A':
      ctx.fillStyle = P.wall2; ctx.fillRect(x, y, TS, TS);
      ctx.fillStyle = P.bench; ctx.fillRect(x + 1, y + 2, 6, 4);
      ctx.fillStyle = P.benchHi; ctx.fillRect(x + 1, y + 2, 6, 1);
      break;
    case 'R':
      ctx.fillStyle = P.wall2; ctx.fillRect(x, y, TS, TS);
      ctx.fillStyle = P.react; ctx.fillRect(x + 1, y + 1, 6, 6);
      ctx.fillStyle = P.reactOn;
      ctx.fillRect(x + 3, y + 3 - (t % 50 < 25 ? 1 : 0), 2, 2);
      break;
    default:
      ctx.fillStyle = P.bg; ctx.fillRect(x, y, TS, TS);
    }
  };

  /* ---------- title logo: big block letters drawn from fillRects ---------- */
  A.drawLogo = function (ctx, y0) {
    var P = A.P;
    /* "THE LAST REACTOR" rendered with the 3x5 font scaled x2 plus a frame */
    ctx.fillStyle = P.wall2; ctx.fillRect(16, y0 - 6, 224, 30);
    ctx.fillStyle = P.wallHi; ctx.fillRect(16, y0 - 6, 224, 1);
    T.centerText(ctx, 'THE LAST REACTOR', y0 + 2, P.machOn, 2);
  };
})(typeof window !== 'undefined' ? window : globalThis);
