/* The Last Reactor - ui.js
   HUD and panels: health bar, counters, message line, satchel (inventory),
   alchemy bench menu, lore notes, pause overlay, merchant choice dialog,
   title menu. All drawn with the 3x5 font and fillRect only. */
(function (g) {
  'use strict';
  var T = g.TLR = g.TLR || {};
  var UI = T.UI = {};

  /* ---------- HUD (drawn each frame during play) ---------- */
  UI.hud = function (ctx, s) {
    var P = T.A.P, i, w = Math.floor(40 * s.hp / s.maxhp);
    ctx.fillStyle = P.wall2; ctx.fillRect(2, 2, 44, 16);
    ctx.fillStyle = P.hud; ctx.fillRect(2, 2, 44, 1);
    /* hp bar */
    ctx.fillStyle = P.hudDim; ctx.fillRect(4, 5, 40, 3);
    ctx.fillStyle = s.hp > s.maxhp / 3 ? P.hp : P.hpHi;
    ctx.fillRect(4, 5, w, 3);
    T.drawText(ctx, 'HP ' + s.hp, 4, 11, P.hud, 1);
    /* item counters, right side */
    var r1 = 'FLK ' + s.inv.flaskFire + ' VIA ' + s.inv.vialHeal + ' PRT ' + s.inv.parts;
    T.drawText(ctx, r1, 48, 3, P.hudDim, 1);
    var r2 = 'AQ ' + s.reagents.aqua + ' IG ' + s.reagents.ignis + ' VS ' + s.reagents.vis;
    T.drawText(ctx, r2, 48, 10, P.hudDim, 1);
    /* district name */
    T.drawText(ctx, T.districtAt(s.px, s.py), 48, 17, P.machOn, 1);
    /* machines state */
    var m = '';
    for (i = 0; i < s.machines.length; i++) m += s.machines[i] ? 'O' : '-';
    T.drawText(ctx, 'CHAIN ' + m, 180, 3, s.gateOpen ? P.gold : P.hudDim, 1);
    /* message line */
    if (s.msgT > 0 && s.msg) {
      ctx.fillStyle = P.dark;
      ctx.fillRect(2, T.CH - 10, Math.min(T.textW(s.msg, 1) + 6, T.CW - 4), 9);
      T.drawText(ctx, s.msg.slice(0, 60), 5, T.CH - 8, P.hud, 1);
    }
  };

  /* ---------- satchel (inventory panel) ---------- */
  UI.inventory = function (ctx, s) {
    var P = T.A.P;
    ctx.fillStyle = P.dark; ctx.fillRect(48, 60, 160, 90);
    ctx.fillStyle = P.wallHi; ctx.fillRect(48, 60, 160, 1); ctx.fillRect(48, 149, 160, 1);
    T.drawText(ctx, '- SATCHEL -', 52, 65, P.gold, 1);
    T.drawText(ctx, 'FIRE FLASKS: ' + s.inv.flaskFire, 56, 78, P.flask, 1);
    T.drawText(ctx, 'HEAL VIALS : ' + s.inv.vialHeal, 56, 88, P.vial, 1);
    T.drawText(ctx, 'MACH PARTS : ' + s.inv.parts, 56, 98, P.hud, 1);
    T.drawText(ctx, 'AQUA/IGNIS/VIS: ' + s.reagents.aqua + '/' + s.reagents.ignis + '/' + s.reagents.vis, 56, 108, P.cistHi, 1);
    T.drawText(ctx, 'K: DRINK A VIAL', 56, 121, P.hudDim, 1);
    T.drawText(ctx, 'ESC: CLOSE', 56, 131, P.hudDim, 1);
  };

  /* ---------- alchemy bench ---------- */
  UI.alchemy = function (ctx, s) {
    var P = T.A.P;
    ctx.fillStyle = P.dark; ctx.fillRect(48, 60, 160, 80);
    ctx.fillStyle = P.benchHi; ctx.fillRect(48, 60, 160, 1);
    T.drawText(ctx, '- ALCHEMY BENCH -', 52, 65, P.benchHi, 1);
    T.drawText(ctx, '1: FIRE FLASK  (AQUA+IGNIS)', 56, 78, P.flask, 1);
    T.drawText(ctx, '2: HEAL VIAL   (AQUA+VIS)', 56, 88, P.vial, 1);
    T.drawText(ctx, '3: SCRAPS -> 1 PART (2 PARTS)', 56, 98, P.hud, 1);
    T.drawText(ctx, 'ESC: LEAVE THE BENCH', 56, 111, P.hudDim, 1);
  };

  /* ---------- lore notes ---------- */
  UI.notes = function (ctx, s) {
    var P = T.A.P, i, y = 65;
    ctx.fillStyle = P.dark; ctx.fillRect(24, 48, 208, 120);
    ctx.fillStyle = P.wallHi; ctx.fillRect(24, 48, 208, 1);
    T.drawText(ctx, '- RECOVERED NOTES -', 28, 52, P.gold, 1);
    for (i = 0; i < s.notes.length && i < 6; i++) {
      var line = s.notes[i].length > 46 ? s.notes[i].slice(0, 45) : s.notes[i];
      T.drawText(ctx, line, 28, y, P.hudDim, 1);
      y += 10;
    }
    if (!s.notes.length) T.drawText(ctx, 'NO NOTES YET', 28, 70, P.hudDim, 1);
    T.drawText(ctx, 'ESC: CLOSE', 28, 158, P.hudDim, 1);
  };

  /* ---------- pause overlay (dithered, no alpha - harness friendly) ---------- */
  UI.pause = function (ctx) {
    var P = T.A.P, x, y;
    ctx.fillStyle = P.dark;
    for (y = 0; y < T.CH; y += 2) {
      for (x = (y / 2) % 2; x < T.CW; x += 2) ctx.fillRect(x, y, 1, 1);
    }
    T.centerText(ctx, 'PAUSED', 110, P.hud, 2);
    T.centerText(ctx, 'P: RESUME - S: SAVE GAME', 132, P.hudDim, 1);
  };

  /* ---------- merchant choice dialog ---------- */
  UI.choice = function (ctx, s) {
    var P = T.A.P, i, y = 96, ch = s.choice;
    if (!ch) return;
    ctx.fillStyle = P.dark; ctx.fillRect(16, 84, 224, 76);
    ctx.fillStyle = P.gold; ctx.fillRect(16, 84, 224, 1);
    var q = ch.q.length > 52 ? ch.q.slice(0, 51) : ch.q;
    T.centerText(ctx, q, 90, P.hud, 1);
    for (i = 0; i < ch.opts.length; i++) {
      var col = i === ch.picked ? P.gold : P.hudDim;
      T.centerText(ctx, (i === ch.picked ? '> ' : '  ') + ch.opts[i] + (i === ch.picked ? ' <' : '  '), y, col, 1);
      y += 12;
    }
    T.centerText(ctx, 'ARROWS: PICK - K: BUY - ESC: LEAVE', 148, P.hudDim, 1);
  };

  /* ---------- title menu ---------- */
  UI.title = function (ctx, s) {
    var P = T.A.P, names = ['WARDEN', 'ALCHEMIST', 'STRELETS'], i,
        rows = ['A STURDY BLADE AND THICK SKIN', 'BREW AND HURL FIRE', 'A KEEN EYE, A LONG SHOT'],
        cols = [P.playerHi, P.flask, P.bolt];
    T.A.drawLogo(ctx, 46);
    T.centerText(ctx, 'THE MACHINES ARE DYING. WAKE THE REACTOR.', 92, P.hudDim, 1);
    for (i = 0; i < 3; i++) {
      var sel = s.cursor === i;
      T.centerText(ctx, (sel ? '> ' : '  ') + names[i] + (sel ? ' <' : '  '), 112 + i * 12, sel ? cols[i] : P.hudDim, 1);
    }
    T.centerText(ctx, rows[s.cursor], 154, P.hudDim, 1);
    T.centerText(ctx, 'ENTER: DESCEND - L: LOAD - N: NEW SEED', 186, P.hudDim, 1);
    T.centerText(ctx, 'V1.0 - DETERMINISTIC BUILD ' + T.getSeed(), 224, P.wallHi, 1);
  };

  /* ---------- dead / win screens ---------- */
  UI.dead = function (ctx, s) {
    var P = T.A.P;
    ctx.fillStyle = P.dark; ctx.fillRect(0, 0, T.CW, T.CH);
    T.centerText(ctx, 'YOU DIED', 92, P.hpHi, 3);
    T.centerText(ctx, 'THE REACTOR STAYS ASLEEP', 130, P.hudDim, 1);
    T.centerText(ctx, 'ENTER: TRY AGAIN', 150, P.hud, 1);
    T.centerText(ctx, 'FRAMES SURVIVED: ' + s.t, 168, P.hudDim, 1);
  };
  UI.win = function (ctx, s) {
    var P = T.A.P, i;
    ctx.fillStyle = P.dark; ctx.fillRect(0, 0, T.CW, T.CH);
    for (i = 0; i < 30; i++) {
      var x = (i * 61 + s.t * 2) % T.CW, y = (i * 97 + s.t) % T.CH;
      ctx.fillStyle = i % 3 ? P.reactOn : P.gold;
      ctx.fillRect(x, y, 2, 2);
    }
    T.centerText(ctx, 'THE REACTOR BREATHES', 84, P.reactOn, 2);
    T.centerText(ctx, 'ITS HEART WILL OUTLIVE US ALL', 116, P.hud, 1);
    T.centerText(ctx, 'MACHINES: ' + s.machines.join('') + ' - NOTES: ' + s.notes.length, 136, P.hudDim, 1);
    T.centerText(ctx, 'ENTER: PLAY AGAIN', 158, P.gold, 1);
  };
})(typeof window !== 'undefined' ? window : globalThis);
