/* The Last Reactor - entities.js
   Enemy definitions, per-kind AI, projectiles and explosions.
   All behaviour is frame-deterministic: cooldowns in frames, seeded spawns. */
(function (g) {
  'use strict';
  var T = g.TLR = g.TLR || {};

  /* ---------- enemy definitions ---------- */
  var DEFS = {
    rat:      { hp: 6,  dmg: 4,  speed: 12, name: 'RAT' },
    ghoul:    { hp: 12, dmg: 8,  speed: 18, name: 'GHOUL' },
    strelets: { hp: 10, dmg: 6,  speed: 20, name: 'STRELETS', ranged: 1 },
    troll:    { hp: 18, dmg: 10, speed: 24, name: 'TROLL', bomber: 1 },
    wraith:   { hp: 8,  dmg: 6,  speed: 14, name: 'WRAITH', phases: 1 },
    sentinel: { hp: 60, dmg: 12, speed: 16, name: 'SENTINEL', ranged: 1, boss: 1 }
  };
  T.edef = function (k) { return DEFS[k] || DEFS.rat; };

  function spawn(kind, x, y) {
    var d = DEFS[kind] || DEFS.rat;
    T.S.ents.push({ kind: kind, x: x, y: y, hp: d.hp, mx: d.hp, cd: 0, dir: 0, st: 0 });
  }
  T.spawnEnt = spawn;

  /* ---------- movement helpers ---------- */
  function walkable(x, y) {
    var c = T.tileAt(x, y);
    if (c === 'G') return false;          /* sealed gate blocks everyone */
    if (T.isSolidChar(c)) return false;
    return true;
  }
  function occupied(x, y, self) {
    var s = T.S, i, e;
    if (s.px === x && s.py === y) return true;
    for (i = 0; i < s.ents.length; i++) {
      e = s.ents[i];
      if (e !== self && e.x === x && e.y === y && e.hp > 0) return true;
    }
    return false;
  }
  T.entCanMove = function (e, x, y) {
    return walkable(x, y) && !occupied(x, y, e);
  };

  /* step an entity one tile if possible */
  function stepTo(e, x, y) {
    if (!T.entCanMove(e, x, y)) return false;
    e.x = x; e.y = y;
    return true;
  }

  function dist(a, b) {
    var dx = a.x - b.x, dy = a.y - b.y;
    return Math.abs(dx) + Math.abs(dy);   /* manhattan */
  }
  T.manhattan = dist;

  /* line of sight: bresenham over walkable tiles */
  T.los = function (x0, y0, x1, y1) {
    var dx = Math.abs(x1 - x0), dy = Math.abs(y1 - y0),
        sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1,
        err = dx - dy, x = x0, y = y0, guard = 0;
    while (guard++ < 200) {
      if (x === x1 && y === y1) return true;
      var e2 = 2 * err;
      if (e2 > -dy) { err -= dy; x += sx; }
      if (e2 < dx) { err += dx; y += sy; }
      if (x === x1 && y === y1) return true;
      if (T.isSolidChar(T.tileAt(x, y)) && !(x === x1 && y === y1)) return false;
    }
    return false;
  };

  /* ---------- projectiles ----------
     {kind:'bolt'|'bomb'|'flask', x,y float, vx,vy, ttl, dmg, from:'player'|'mob'} */
  function shoot(o) { T.S.proj.push(o); }
  T.shoot = shoot;

  T.updateProj = function () {
    var s = T.S, i, p, nx, ny, j, e, hit;
    for (i = s.proj.length - 1; i >= 0; i--) {
      p = s.proj[i];
      p.x += p.vx; p.y += p.vy; p.ttl--;
      nx = Math.round(p.x); ny = Math.round(p.y);
      hit = false;
      /* wall impact */
      if (T.isSolidChar(T.tileAt(nx, ny))) { hit = true; }
      /* player projectile vs enemies */
      if (p.from === 'player') {
        for (j = 0; j < s.ents.length; j++) {
          e = s.ents[j];
          if (e.hp > 0 && e.x === nx && e.y === ny) {
            if (p.kind === 'flask') { T.explode(nx, ny, p.dmg, 1.6); s.proj.splice(i, 1); p.dead = true; break; }
            e.hp -= p.dmg; hit = true;
            break;
          }
        }
        if (p.dead) continue;
      } else {
        /* enemy projectile vs player */
        if (nx === s.px && ny === s.py) {
          if (p.kind === 'bomb') {
            T.explode(nx, ny, p.dmg, 1.3);
            s.proj.splice(i, 1);
            continue;
          }
          T.damagePlayer(p.dmg);
          hit = true;
        }
      }
      if (p.ttl <= 0) {
        if (p.kind === 'bomb' || p.kind === 'flask') T.explode(nx, ny, p.dmg, p.kind === 'flask' ? 1.6 : 1.3);
        hit = true;
      }
      if (hit) s.proj.splice(i, 1);
    }
  };

  /* ---------- explosions (AoE, radius in tiles) ---------- */
  T.explode = function (cx, cy, dmg, r) {
    var s = T.S, i, e;
    s.fx2.push({ x: cx, y: cy, r: r, t: 12 });
    for (i = 0; i < s.ents.length; i++) {
      e = s.ents[i];
      if (e.hp > 0 && Math.abs(e.x - cx) <= r && Math.abs(e.y - cy) <= r) {
        e.hp -= dmg;
      }
    }
    if (Math.abs(s.px - cx) <= r && Math.abs(s.py - cy) <= r) {
      T.damagePlayer(Math.floor(dmg / 2));
    }
    if (g.TLR && T.AU) T.AU.sfx('hit');
  };

  T.updateFx = function () {
    var s = T.S, i;
    for (i = s.fx2.length - 1; i >= 0; i--) {
      s.fx2[i].t--;
      if (s.fx2[i].t <= 0) s.fx2.splice(i, 1);
    }
  };

  /* ---------- enemy AI ---------- */
  T.updateEnts = function () {
    var s = T.S, i, e, d, def, k, tries, dirs, moved,
        DX = [1, -1, 0, 0], DY = [0, 0, 1, -1];
    for (i = 0; i < s.ents.length; i++) {
      e = s.ents[i];
      if (e.hp <= 0) continue;
      def = DEFS[e.kind] || DEFS.rat;
      if (e.cd > 0) { e.cd--; continue; }
      e.cd = def.speed;

      d = dist({ x: s.px, y: s.py }, e);

      if (def.boss) { bossAI(e, def); continue; }

      if (def.ranged && d <= 7 && d >= 2 && T.los(e.x, e.y, s.px, s.py)) {
        /* strelets: keep distance, fire bolts */
        if (d <= 3) {
          /* try to back away */
          dirs = [0, 1, 2, 3];
          moved = false;
          while (dirs.length && !moved) {
            k = dirs.splice(T.ri(dirs.length), 1)[0];
            moved = stepTo(e, e.x - Math.sign(s.px - e.x || 0) * (k < 2 ? 1 : 0),
                              e.y - Math.sign(s.py - e.y || 0) * (k >= 2 ? 1 : 0));
            if (moved && (e.x === s.px || e.y === s.py)) moved = false;
          }
        } else {
          shoot({ kind: 'bolt', x: e.x, y: e.y,
                  vx: Math.sign(s.px - e.x) * 0.25, vy: Math.sign(s.py - e.y) * 0.25,
                  ttl: 40, dmg: def.dmg, from: 'mob' });
        }
        continue;
      }

      if (def.bomber && d <= 6 && T.los(e.x, e.y, s.px, s.py)) {
        /* troll: lob a firebomb that detonates on contact or timeout */
        shoot({ kind: 'bomb', x: e.x, y: e.y,
                vx: Math.sign(s.px - e.x) * 0.2, vy: Math.sign(s.py - e.y) * 0.2,
                ttl: 60, dmg: def.dmg, from: 'mob' });
        continue;
      }

      if (d <= 1) {
        /* adjacent: melee hit */
        T.damagePlayer(def.dmg);
        continue;
      }

      if (d <= 9 && (e.kind !== 'rat' || T.los(e.x, e.y, s.px, s.py))) {
        /* chase: greedy step toward the player, wraith may phase through walls */
        var order = [];
        if (Math.abs(s.px - e.x) > Math.abs(s.py - e.y)) {
          /* horizontal first: toward the player, then the other axis */
          order = [0, 1, 2, 3];
          if (s.px < e.x) { order[0] = 1; order[1] = 0; }
          if (s.py < e.y) { order[2] = 3; order[3] = 2; }
        } else {
          /* vertical first (CHANGELOG: priority indices were swapped and mobs
             fled when the player stood above them) */
          order = [2, 3, 0, 1];
          if (s.py < e.y) { order[0] = 3; order[1] = 2; }
          if (s.px < e.x) { order[2] = 1; order[3] = 0; }
        }
        moved = false;
        for (k = 0; k < 4 && !moved; k++) {
          var nx2 = e.x + DX[order[k]], ny2 = e.y + DY[order[k]];
          if (def.phases && T.tileAt(nx2, ny2) === '#' && !(nx2 === s.px && ny2 === s.py)) {
            /* wraith slips through single walls but not sealed gates */
            if (T.tileAt(nx2, ny2) !== 'G') { e.x = nx2; e.y = ny2; moved = true; }
          } else {
            moved = stepTo(e, nx2, ny2);
          }
        }
        continue;
      }

      /* idle wander */
      tries = 0; moved = false;
      while (tries < 4 && !moved) {
        k = T.ri(4);
        moved = stepTo(e, e.x + DX[k], e.y + DY[k]);
        tries++;
      }
    }
    /* reap the dead */
    var alive = [], n;
    for (n = 0; n < s.ents.length; n++) {
      if (s.ents[n].hp > 0) { alive.push(s.ents[n]); }
      else { s.fx2.push({ x: s.ents[n].x, y: s.ents[n].y, r: 1, t: 8 }); }
    }
    s.ents = alive;
  };

  /* boss: charges at the player, fires spreads, immune until all machines? no:
     spawns only after the gate opens. */
  function bossAI(e, def) {
    var s = T.S, d = dist({ x: s.px, y: s.py }, e), ang, k, vx, vy;
    if (d <= 1) { T.damagePlayer(def.dmg); return; }
    if (d <= 6 && (s.t % 3 === 0)) {
      /* triple spread toward the player */
      vx = Math.sign(s.px - e.x) * 0.22; vy = Math.sign(s.py - e.y) * 0.22;
      if (vx === 0 && vy === 0) vx = 0.22;
      shoot({ kind: 'bolt', x: e.x, y: e.y, vx: vx, vy: vy, ttl: 50, dmg: def.dmg - 4, from: 'mob' });
      return;
    }
    /* charge: two tiles per turn if path is clear */
    var sx = Math.sign(s.px - e.x), sy = Math.sign(s.py - e.y);
    if (Math.abs(s.px - e.x) > Math.abs(s.py - e.y)) {
      if (!T.entCanMove(e, e.x + sx, e.y)) { if (sy && T.entCanMove(e, e.x, e.y + sy)) { e.y += sy; return; } }
      else { e.x += sx; return; }
    } else {
      if (!T.entCanMove(e, e.x, e.y + sy)) { if (sx && T.entCanMove(e, e.x + sx, e.y)) { e.x += sx; return; } }
      else { e.y += sy; return; }
    }
  }
})(typeof window !== 'undefined' ? window : globalThis);
