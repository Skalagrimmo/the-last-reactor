/* The Last Reactor - render.js
   Everything is drawn with fillRect/fillStyle only (plus save/restore for the
   camera pan): tiles, dithered darkness, sprites, projectiles, explosions,
   HUD and scene overlays. That constraint is what lets the same renderer run
   against the test rasterizer (tests/capture-harness.js) for screenshots. */
(function (g) {
  'use strict';
  var T = g.TLR = g.TLR || {};
  var R = T.R = {};

  /* visible tiles: 32 x 30 of 8px */
  var VTW = Math.floor(T.CW / T.TS), VTH = Math.floor(T.CH / T.TS);

  R.cam = function (s) {
    var cx = T.clamp(s.px - Math.floor(VTW / 2), 0, T.W - VTW),
        cy = T.clamp(s.py - Math.floor(VTH / 2), 0, T.H - VTH);
    return { x: cx, y: cy };
  };

  /* light level of a tile: radius around player, plus machine/gate glow */
  function lit(s, x, y) {
    var d = Math.abs(x - s.px) + Math.abs(y - s.py), r = s.light, i, L = T.LANDMARK;
    if (d <= r) return 2;                     /* fully lit */
    if (d <= r + 2) return 1;                 /* dim ring */
    /* glowing tiles light themselves + neighbours */
    var c = T.tileAt(x, y);
    if (c === 'M' || c === 'E' || c === 'R' || c === 'A' || c === 'C') return 2;
    var k, dx, dy;
    for (k = 0; k < 4; k++) {
      dx = k === 0 ? 1 : (k === 1 ? -1 : 0); dy = k === 2 ? 1 : (k === 3 ? -1 : 0);
      var cc = T.tileAt(x + dx, y + dy);
      if (cc === 'M' || cc === 'E' || cc === 'R') return 1;
    }
    if (s.gateOpen && x === L.GATE.x && y === L.GATE.y) return 2;
    return 0;                                 /* darkness */
  }

  /* dithered darkness: level 0 fully black, 1 half-dither */
  function shade(ctx, x, y, level) {
    var px = x * T.TS, py = y * T.TS, i, j;
    if (level >= 2) return;
    ctx.fillStyle = T.A.P.dark;
    if (level === 0) { ctx.fillRect(px, py, T.TS, T.TS); return; }
    for (j = 0; j < T.TS; j += 2) {
      for (i = (j / 2) % 2; i < T.TS; i += 2) ctx.fillRect(px + i, py + j, 1, 1);
    }
  }

  R.scenePlay = function (ctx, s) {
    var cam = R.cam(s), A = T.A, P = A.P, x, y, tx, ty, i;
    ctx.fillStyle = P.bg; ctx.fillRect(0, 0, T.CW, T.CH);
    /* ground pass */
    for (y = 0; y < VTH; y++) {
      for (x = 0; x < VTW; x++) {
        tx = cam.x + x; ty = cam.y + y;
        A.drawTile(ctx, T.tileAt(tx, ty), tx, ty, x * T.TS, y * T.TS, s.t);
      }
    }
    /* explosions under entities */
    for (i = 0; i < s.fx2.length; i++) {
      var f = s.fx2[i],
          ex = (f.x - cam.x) * T.TS + T.TS / 2, ey = (f.y - cam.y) * T.TS + T.TS / 2,
          rr = f.r * T.TS * (f.t / 12);
      ctx.fillStyle = P.fire;
      ctx.fillRect(ex - rr, ey - 2, rr * 2, 4);
      ctx.fillRect(ex - 2, ey - rr, 4, rr * 2);
      ctx.fillStyle = P.gold;
      ctx.fillRect(ex - 2, ey - 2, 4, 4);
    }
    /* entities */
    for (i = 0; i < s.ents.length; i++) {
      var e = s.ents[i];
      if (e.hp <= 0) continue;
      var sx = (e.x - cam.x) * T.TS, sy = (e.y - cam.y) * T.TS;
      A.drawSprite(ctx, e.kind === 'merchant' ? 'merchant' : e.kind, sx, sy);
      if (e.hp < e.mx) {
        ctx.fillStyle = P.hp;
        ctx.fillRect(sx, sy - 2, Math.max(1, Math.floor(8 * e.hp / e.mx)), 1);
      }
    }
    /* merchant (state-level npc, not an ent) */
    var mx = (s.merchant.x - cam.x) * T.TS, my = (s.merchant.y - cam.y) * T.TS;
    if (mx >= -8 && mx < T.CW && my >= -8 && my < T.CH) {
      A.drawSprite(ctx, 'merchant', mx, my);
    }
    /* projectiles */
    for (i = 0; i < s.proj.length; i++) {
      var pr = s.proj[i],
          ppx = Math.floor((pr.x - cam.x) * T.TS), ppy = Math.floor((pr.y - cam.y) * T.TS);
      ctx.fillStyle = pr.kind === 'bolt' ? P.bolt : (pr.kind === 'flask' ? P.flask : P.bomb);
      ctx.fillRect(ppx, ppy, 3, 3);
    }
    /* player */
    var pxs = (s.px - cam.x) * T.TS, pys = (s.py - cam.y) * T.TS;
    A.drawSprite(ctx, (s.fy < 0) ? 'playerBack' : 'player', pxs, pys);
    if (s.hitFlash > 0) {
      ctx.fillStyle = P.hpHi;
      ctx.fillRect(pxs + 1, pys + 1, 6, 6);
    }
    /* darkness pass */
    for (y = 0; y < VTH; y++) {
      for (x = 0; x < VTW; x++) {
        tx = cam.x + x; ty = cam.y + y;
        shade(ctx, x, y, lit(s, tx, ty));
      }
    }
    /* HUD and overlays */
    T.UI.hud(ctx, s);
    if (s.panel === 'inv') T.UI.inventory(ctx, s);
    if (s.panel === 'alch') T.UI.alchemy(ctx, s);
    if (s.panel === 'notes') T.UI.notes(ctx, s);
    if (s.choice) T.UI.choice(ctx, s);
    if (s.pause) T.UI.pause(ctx);
  };

  R.render = function (ctx) {
    var s = T.S;
    if (!s) return;
    switch (s.scene) {
    case 'title': T.A.P; ctx.fillStyle = T.A.P.bg; ctx.fillRect(0, 0, T.CW, T.CH);
      /* starfield behind the title: deterministic positions */
      T.UI.title(ctx, s);
      break;
    case 'play': R.scenePlay(ctx, s); break;
    case 'dead': R.scenePlay(ctx, s); T.UI.dead(ctx, s); break;
    case 'win': T.UI.win(ctx, s); break;
    default: R.scenePlay(ctx, s);
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
