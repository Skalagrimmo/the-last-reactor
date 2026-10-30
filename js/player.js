/* The Last Reactor - player.js
   Movement, the three class attacks (warden slash / alchemist flask /
   strelets bolt), item use and every world interaction: machines chain,
   cisterns, geysers, bench, doors with cooldown, sealed gate, reactor core. */
(function (g) {
  'use strict';
  var T = g.TLR = g.TLR || {};

  var CLASSES = {
    warden:    { hp: 110, dmg: 9,  name: 'WARDEN' },
    alchemist: { hp: 90,  dmg: 7,  name: 'ALCHEMIST' },
    strelets:  { hp: 80,  dmg: 6,  name: 'STRELETS' }
  };
  T.classes = CLASSES;

  /* ---------- movement ---------- */
  T.tryMove = function (dx, dy) {
    var s = T.S, nx, ny, c;
    /* 4-direction facing: reset the idle axis (CHANGELOG: facing bug) */
    if (dx) { s.fx = dx; s.fy = 0; }
    if (dy) { s.fy = dy; s.fx = 0; }
    if (!dx && !dy) return false;
    nx = s.px + dx; ny = s.py + dy;
    c = T.tileAt(nx, ny);
    if (T.isSolidChar(c)) {
      /* bump feedback for machines etc. is handled by interact, not movement */
      return false;
    }
    /* enemies block movement (attack them by walking into? no: bump does nothing) */
    var i, e;
    for (i = 0; i < s.ents.length; i++) {
      e = s.ents[i];
      if (e.hp > 0 && e.x === nx && e.y === ny) return false;
    }
    s.px = nx; s.py = ny;
    /* stepped onto a passage door: teleport with cooldown */
    if (c === 'D' && s.doorCd <= 0) {
      for (var k = 0; k < T.DOORS.length; k++) {
        if (T.DOORS[k].x === nx && T.DOORS[k].y === ny) {
          s.px = T.DOORS[k].to.x; s.py = T.DOORS[k].to.y;
          s.doorCd = 24;                       /* re-entry cooldown, frames */
          T.AU.sfx('door');
          T.msg(T.districtAt(s.px, s.py));
          break;
        }
      }
    }
    return true;
  };

  /* ---------- attacks (J / attack key) ---------- */
  T.doAttack = function () {
    var s = T.S, i, e, tx, ty, hitAny = false;
    if (s.cls === 'strelets') {
      T.shoot({ kind: 'bolt', x: s.px + s.fx * 0.5, y: s.py + s.fy * 0.5,
                vx: s.fx * 0.3, vy: s.fy * 0.3, ttl: 30,
                dmg: CLASSES.strelets.dmg, from: 'player' });
      T.AU.sfx('shoot');
      return;
    }
    if (s.cls === 'alchemist' && s.inv.flaskFire > 0) {
      s.inv.flaskFire--;
      T.shoot({ kind: 'flask', x: s.px + s.fx * 0.5, y: s.py + s.fy * 0.5,
                vx: s.fx * 0.25, vy: s.fy * 0.25, ttl: 26,
                dmg: CLASSES.alchemist.dmg + 6, from: 'player' });
      T.AU.sfx('shoot');
      return;
    }
    if (s.cls === 'alchemist') { T.msg('NO FLASKS LEFT - BREW AT THE BENCH'); return; }
    /* warden melee: hitbox strictly in facing direction */
    tx = s.px + s.fx; ty = s.py + s.fy;
    for (i = 0; i < s.ents.length; i++) {
      e = s.ents[i];
      if (e.hp > 0 && e.x === tx && e.y === ty) {
        e.hp -= CLASSES.warden.dmg;
        hitAny = true;
        if (e.hp <= 0) s.inv.parts++;
      }
    }
    if (hitAny) T.AU.sfx('hit'); else T.msg('SWISH - NOTHING THERE');
  };

  /* ---------- damage / death ---------- */
  T.damagePlayer = function (d) {
    var s = T.S;
    if (s.scene !== 'play') return;
    s.hp -= d;
    s.hitFlash = 6;
    T.AU.sfx('hurt');
    if (s.hp <= 0) { s.hp = 0; s.scene = 'dead'; T.AU.sfx('dead'); }
  };

  /* ---------- item use (K on self / from satchel) ---------- */
  T.useItem = function (name) {
    var s = T.S;
    if (name === 'vialHeal') {
      if (s.inv.vialHeal <= 0) { T.msg('NO VIALS'); return false; }
      if (s.hp >= s.maxhp) { T.msg('HP ALREADY FULL'); return false; }
      s.inv.vialHeal--;
      s.hp = Math.min(s.maxhp, s.hp + 35);
      T.AU.sfx('pickup');
      T.msg('THE VIAL KNITS YOUR WOUNDS');
      return true;
    }
    if (name === 'flaskFire') {
      if (s.inv.flaskFire <= 0) { T.msg('NO FLASKS'); return false; }
      s.inv.flaskFire--;
      T.shoot({ kind: 'flask', x: s.px + s.fx * 0.5, y: s.py + s.fy * 0.5,
                vx: s.fx * 0.25, vy: s.fy * 0.25, ttl: 26,
                dmg: 13, from: 'player' });
      T.AU.sfx('shoot');
      return true;
    }
    return false;
  };

  /* ---------- interactions (K next to a thing) ---------- */
  var NOTES = [
    'DAY 4091: THE LAST REACTOR STILL SLEEPS. WAKE THE FOUR MACHINES IN THEIR CHAIN ORDER.',
    'DAY 4092: THE CISTERNS HOLD AQUA. THE OLD GEYSER BLEEDS IGNIS. THE BENCH BINDS THEM.',
    'DAY 4094: THE GATE ANSWERS ONLY TO A FULLY SINGING MACHINE HALL.',
    'DAY 4100: SOMETHING WALKS THE DUCTS NOW. IF YOU READ THIS - RUN.'
  ];
  T.NOTES = NOTES;

  T.doInteract = function () {
    var s = T.S, L = T.LANDMARK, i, m, k,
        dirs = [{ dx: 0, dy: -1 }, { dx: 0, dy: 1 }, { dx: -1, dy: 0 }, { dx: 1, dy: 0 }];
    /* face-adjacent first, then any adjacent */
    var order = [{ dx: s.fx, dy: s.fy }];
    for (k = 0; k < 4; k++) {
      var dd = dirs[k];
      if (!(dd.dx === s.fx && dd.dy === s.fy)) order.push(dd);
    }
    for (k = 0; k < order.length; k++) {
      var tx = s.px + order[k].dx, ty = s.py + order[k].dy, c = T.tileAt(tx, ty);
      /* merchant npc */
      for (i = 0; i < s.ents.length; i++) {
        var e = s.ents[i];
        if (e.kind === 'merchant' && e.x === tx && e.y === ty) { T.openMerchant(); return true; }
      }
      if (s.merchant.x === tx && s.merchant.y === ty) { T.openMerchant(); return true; }
      if (c === 'M') return interactMachine(tx, ty);
      if (c === 'C') { s.reagents.aqua++; T.AU.sfx('pickup'); T.msg('AQUA +1 - ' + s.reagents.aqua + ' VIALS DRAWN'); return true; }
      if (c === 'E') { s.reagents.ignis++; T.AU.sfx('pickup'); T.msg('IGNIS +1 - ' + s.reagents.ignis + ' SPARKS CAUGHT'); return true; }
      if (c === 'A') { s.panel = 'alch'; T.msg('THE BENCH WAITS'); return true; }
      if (c === 'R') { return interactReactor(); }
      if (c === 'G') { T.msg('THE GATE IS SEALED - THE MACHINES MUST SING FIRST'); return true; }
    }
    /* consumables: no adjacent target -> try a vial if hurt */
    T.msg('NOTHING TO USE HERE');
    return false;
  };

  function interactMachine(tx, ty) {
    var s = T.S, L = T.LANDMARK, i, idx = -1;
    for (i = 0; i < L.MACHINES.length; i++) {
      if (L.MACHINES[i].x === tx && L.MACHINES[i].y === ty) idx = i;
    }
    if (idx < 0) return false;
    if (s.machines[idx]) { T.msg('MACHINE ' + (idx + 1) + ' ALREADY HUMS'); return true; }
    /* chain rule: machine i needs machine i-1 active */
    var prev = idx - 1;
    while (prev >= 0 && !s.machines[prev]) {
      T.msg('DEAD SILENCE - WAKE MACHINE ' + (prev + 1) + ' FIRST');
      return true;
    }
    s.machines[idx] = 1;
    s.reagents.vis++;
    if (s.notes.indexOf(NOTES[idx]) < 0) s.notes.push(NOTES[idx]);
    s.light = Math.min(7, s.light + 1);
    T.AU.sfx('machine');
    T.msg('MACHINE ' + (idx + 1) + ' ROARS AWAKE - VIS +1');
    /* all four on: unseal the gate */
    var all = 1;
    for (i = 0; i < s.machines.length; i++) if (!s.machines[i]) all = 0;
    if (all && !s.gateOpen) {
      s.gateOpen = true;
      T.setTile(L.GATE.x, L.GATE.y, 'g');
      T.AU.sfx('gate');
      T.msg('THE GATE TO THE REACTOR CHAMBER GRINDS OPEN');
    }
    return true;
  }

  function interactReactor() {
    var s = T.S;
    if (!s.gateOpen) { T.msg('THE CORE IS COLD - THE MACHINES MUST SING FIRST'); return true; }
    if (!s.bossDead) { T.msg('THE SENTINEL GUARDS THE CORE'); return true; }
    s.scene = 'win';
    s.won = true;
    T.AU.sfx('win');
    return true;
  }

  /* ---------- merchant ---------- */
  T.openMerchant = function () {
    var s = T.S;
    s.choice = {
      q: 'THE KEEPER TRADES: 2 PARTS FOR A FLASK, 1 FOR A VIAL',
      opts: ['FIRE FLASK (2 PARTS)', 'HEALING VIAL (1 PART)', 'LEAVE'],
      picked: 0
    };
    T.AU.sfx('buy');
    return true;
  };

  T.pickChoice = function (n) {
    var s = T.S;
    if (!s.choice) return false;
    if (n === 0) {
      if (s.inv.parts >= 2) { s.inv.parts -= 2; s.inv.flaskFire++; T.msg('A NEW FLASK, STILL WARM'); T.AU.sfx('buy'); }
      else T.msg('NOT ENOUGH PARTS');
    } else if (n === 1) {
      if (s.inv.parts >= 1) { s.inv.parts--; s.inv.vialHeal++; T.msg('THE VIAL GLOWS FAINT RED'); T.AU.sfx('buy'); }
      else T.msg('NOT ENOUGH PARTS');
    } else {
      T.msg('THE KEEPER NODS');
    }
    s.choice = null;
    return true;
  };
})(typeof window !== 'undefined' ? window : globalThis);
