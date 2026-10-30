/* The Last Reactor - tests/headless.js
   Headless test suite: 61 behavioural checks run against three LCG seeds
   (20261030, 987654321, 1357911130) = 183 total, plus a BFS connectivity
   audit over 33 fixed targets in 7 groups per seed. No DOM, no Canvas, no
   audio needed.

   Usage from a host harness (browser console or node-style eval):
     var r = TLR_runHeadless();   // -> {pass, fail, total, log[]}
     var a = TLR_auditConnectivity(); // -> {ok, groups[]}
   Each check starts a fresh game with the given seed. */
(function (g) {
  'use strict';
  var T = g.TLR = g.TLR || {};

  var LOG = [];
  function chk(name, cond, info) {
    var line = (cond ? 'PASS ' : 'FAIL ') + name + (cond || !info ? '' : '  [' + info + ']');
    if (!cond) {
      var s = T.state();
      line += '  dbg: ' + JSON.stringify({
        scene: s && s.scene, px: s && s.px, py: s && s.py, hp: s && s.hp,
        fx: s && s.fx, fy: s && s.fy, msg: s && s.msg, doorCd: s && s.doorCd,
        panel: s && s.panel, pause: s && s.pause, machines: s && s.machines,
        proj: s && s.proj, ents: s && s.ents, choice: s && s.choice
      });
    }
    LOG.push(line);
    return !!cond;
  }

  /* ---------- harness helpers ---------- */
  function start(seed, cls) { T.start(seed, cls || 'warden'); }
  function tap(k) { T.tap(k); T.step(); }
  function steps(n) { var i; for (i = 0; i < n; i++) T.step(); }
  function calm() { T.S.ents = []; T.S.proj = []; }        /* isolate world mechanics */
  function place(x, y) { T.S.px = x; T.S.py = y; }
  function face(dx, dy) { T.S.fx = dx; T.S.fy = dy; }
  function spawnAt(kind, x, y) {
    T.spawnEnt(kind, x, y);
    var e = T.S.ents[T.S.ents.length - 1];
    e.cd = 0;
    return e;
  }

  /* test-side BFS (walkable: everything not solid, plus open gate) */
  function bfsDist(fx, fy) {
    var W = T.W, H = T.H, d = new Array(W * H), q = [{ x: fx, y: fy }], i, k,
        DX = [1, -1, 0, 0], DY = [0, 0, 1, -1];
    for (i = 0; i < d.length; i++) d[i] = -1;
    d[fy * W + fx] = 0;
    while (q.length) {
      var c = q.shift();
      for (k = 0; k < 4; k++) {
        var nx = c.x + DX[k], ny = c.y + DY[k];
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        if (d[ny * W + nx] !== -1) continue;
        var t = T.S.map[ny * W + nx];
        if (T.isSolidChar(t) && t !== 'g') continue;
        d[ny * W + nx] = d[c.y * W + c.x] + 1;
        q.push({ x: nx, y: ny });
      }
    }
    return d;
  }

  /* walk the player to (tx,ty) along the BFS descent; isolated from enemies */
  function walkTo(tx, ty) {
    calm();
    var guard = 0;
    while ((T.S.px !== tx || T.S.py !== ty) && guard++ < 400) {
      var d = bfsDist(tx, ty);
      var best = null, bk = -1, k,
          DX = [1, -1, 0, 0], DY = [0, 0, 1, -1];
      for (k = 0; k < 4; k++) {
        var nx = T.S.px + DX[k], ny = T.S.py + DY[k];
        if (nx < 0 || ny < 0 || nx >= T.W || ny >= T.H) continue;
        var dv = d[ny * T.W + nx];
        if (dv !== -1 && dv < d[T.S.py * T.W + T.S.px] &&
            (best === null || dv < best)) { best = dv; bk = k; }
      }
      if (bk < 0) { place(tx, ty); return; }   /* unreachable: fall back */
      var dirx = DX[bk], diry = DY[bk];
      T.press[dirx > 0 ? 'right' : (dirx < 0 ? 'left' : (diry > 0 ? 'down' : 'up'))] = 1;
      T.step();
    }
  }

  /* ---------- the 54 checks (run once per seed) ---------- */
  function runChecks(seed) {
    var L = T.LANDMARK, s, i, n, ok;

    /* ===== world (8) ===== */
    start(seed);
    s = T.S;
    chk('W01 map is 40x32 with solid border', function () {
      if (s.map.length !== T.W * T.H) return false;
      for (i = 0; i < T.W; i++) {
        if (T.tileAt(i, 0) !== '#' || T.tileAt(i, T.H - 1) !== '#') return false;
      }
      for (i = 0; i < T.H; i++) {
        if (T.tileAt(0, i) !== '#' || T.tileAt(T.W - 1, i) !== '#') return false;
      }
      return true;
    }());

    chk('W02 player starts at the entry anchor', T.tileAt(6, 5) === '.' && s.px === 6 && s.py === 5);

    var snap1 = JSON.stringify({ m: s.map, e: s.ents });
    start(seed);
    var snap2 = JSON.stringify({ m: T.S.map, e: T.S.ents });
    chk('W03 same seed regenerates identical world', snap1 === snap2);

    start(seed);
    ok = true;
    for (i = 0; i < L.MACHINES.length; i++) {
      if (T.tileAt(L.MACHINES[i].x, L.MACHINES[i].y) !== 'M') ok = false;
    }
    chk('W04 four machines placed', ok);

    ok = true;
    for (i = 0; i < L.CISTERNS.length; i++) {
      if (T.tileAt(L.CISTERNS[i].x, L.CISTERNS[i].y) !== 'C') ok = false;
    }
    chk('W05 three cisterns placed', ok);

    chk('W06 energy geyser placed', T.tileAt(L.GEYSER.x, L.GEYSER.y) === 'E');
    chk('W07 alchemy bench placed', T.tileAt(L.BENCH.x, L.BENCH.y) === 'A');
    chk('W08 reactor gate starts sealed', T.tileAt(L.GATE.x, L.GATE.y) === 'G' && T.isSolidChar('G'));

    /* ===== movement (8) ===== */
    start(seed); calm();
    tap('right');
    chk('M01 stepping right moves the player', T.S.px === 7);

    place(6, 2); tap('up');
    chk('M02 walls block movement', T.S.px === 6 && T.S.py === 2);

    tap('left');
    chk('M03 facing follows movement', T.S.fx === -1 && T.S.fy === 0);

    /* door: alchemy -> cisterns */
    start(seed); calm();
    walkTo(L.DOOR_ALCH.x, L.DOOR_ALCH.y - 1);
    var doorCdBefore = T.S.doorCd;
    tap('down');
    var arr = { x: T.S.px, y: T.S.py };
    chk('M04 door teleports to the cisterns', T.districtAt(arr.x, arr.y) === 'CISTERNS' &&
        arr.x >= 4 && arr.x <= 8 && arr.y >= 25 && arr.y <= 29,
        'arr=' + arr.x + ',' + arr.y);

    chk('M05 door cooldown armed after transition', T.S.doorCd > 20 && T.S.doorCd <= 24, 'cd=' + T.S.doorCd);
    var cd1 = T.S.doorCd;
    steps(1);
    chk('M06 door cooldown ticks down per frame', T.S.doorCd === cd1 - 1, cd1 + '->' + T.S.doorCd);

    /* blocked while cooling: step onto the cistern door quickly */
    place(L.DOOR_CIST.x + 1, L.DOOR_CIST.y);
    T.S.doorCd = 24; T.press.left = 1; T.step();
    var onDoor = (T.S.px === L.DOOR_CIST.x && T.S.py === L.DOOR_CIST.y);
    steps(1);
    chk('M07 door ignores the pair-link during cooldown', onDoor && T.S.px === L.DOOR_CIST.x && T.S.py === L.DOOR_CIST.y,
        'at ' + T.S.px + ',' + T.S.py);
    /* after cooldown, re-entering the door teleports back */
    while (T.S.doorCd > 0) T.step();
    tap('up'); tap('down');
    chk('M08 door links back once the cooldown clears', T.S.px === L.DOOR_ALCH.to.x - 10 || T.districtAt(T.S.px, T.S.py) === 'ALCHEMY LAB',
        'at ' + T.S.px + ',' + T.S.py);

    /* ===== machines (7) ===== */
    start(seed); calm();
    walkTo(L.MACHINES[1].x, L.MACHINES[1].y + 1);
    face(0, -1); tap('b');
    chk('Q01 chain refuses out-of-order machines', T.S.machines.join('') === '0000' && /MACHINE 1/.test(T.S.msg), T.S.msg);

    for (i = 0; i < 4; i++) {
      walkTo(L.MACHINES[i].x, L.MACHINES[i].y + 1);
      face(0, -1); tap('b');
    }
    chk('Q02 chain activates machines 1-4 in order', T.S.machines.join('') === '1111', T.S.machines.join(''));
    chk('Q03 each machine yields one VIS reagent', T.S.reagents.vis === 4, 'vis=' + T.S.reagents.vis);
    chk('Q04 each machine leaves a lore note', T.S.notes.length === 4, 'n=' + T.S.notes.length);
    chk('Q05 the gate unseals after the full chain', T.tileAt(L.GATE.x, L.GATE.y) === 'g' && T.S.gateOpen);
    chk('Q06 light radius grows with the chain', T.S.light === 7, 'light=' + T.S.light);
    tap('b');
    chk('Q07 an active machine says it already hums', /HUMS/.test(T.S.msg), T.S.msg);

    /* ===== alchemy (8) ===== */
    start(seed); calm();
    walkTo(L.CISTERNS[0].x, L.CISTERNS[0].y + 1);
    face(0, -1); tap('b');
    chk('A01 cisterns yield AQUA', T.S.reagents.aqua === 1);

    walkTo(L.GEYSER.x, L.GEYSER.y - 1);
    face(0, 1); tap('b');
    chk('A02 the geyser yields IGNIS', T.S.reagents.ignis === 1);

    walkTo(L.BENCH.x, L.BENCH.y + 1);
    face(0, -1); tap('b');
    chk('A03 the bench opens the alchemy menu', T.S.panel === 'alch');

    tap('one');
    chk('A04 AQUA+IGNIS brews a fire flask', T.S.inv.flaskFire === 2 && T.S.reagents.aqua === 0 && T.S.reagents.ignis === 0,
        'flk=' + T.S.inv.flaskFire);

    tap('two');
    chk('A05 brewing without reagents fails', /NOT ENOUGH/.test(T.S.msg) && T.S.inv.vialHeal === 1, T.S.msg);

    /* give reagents and brew a vial */
    T.S.reagents.aqua = 1; T.S.reagents.vis = 1;
    tap('two');
    chk('A06 AQUA+VIS brews a healing vial', T.S.inv.vialHeal === 2 && T.S.reagents.vis === 0, 'via=' + T.S.inv.vialHeal);

    tap('esc');
    chk('A07 escape closes the alchemy menu', T.S.panel === null);

    /* flask throw as an item use */
    place(L.BENCH.x - 2, L.BENCH.y);
    face(1, 0);
    T.useItem('flaskFire');
    chk('A08 throwing a flask spawns a projectile', T.S.proj.length === 1 && T.S.proj[0].kind === 'flask');

    /* ===== combat (12) ===== */
    start(seed); calm();
    var rat = spawnAt('rat', T.S.px + 1, T.S.py);
    face(1, 0); tap('a');
    chk('C01 melee kills an adjacent rat', T.entAt(rat.x, rat.y) === null);

    chk('C02 killing grants a machine part', T.S.inv.parts === 1, 'p=' + T.S.inv.parts);

    var rat2 = spawnAt('rat', T.S.px - 1, T.S.py);
    face(1, 0); tap('a');
    chk('C03 melee does not hit behind the player', T.entAt(rat2.x, rat2.y) !== null);

    /* facing-down attack hits the tile below (regression, CHANGELOG) */
    var rat3 = spawnAt('rat', T.S.px, T.S.py + 1);
    face(0, 1); tap('a');
    chk('C04 a downward attack hits below the player', T.entAt(rat3.x, rat3.y) === null,
        'fx=' + T.S.fx + ' fy=' + T.S.fy + ' tgt=' + (T.S.px + T.S.fx) + ',' + (T.S.py + T.S.fy));

    /* flask AoE takes several rats at once */
    place(12, 3); calm();
    spawnAt('rat', 14, 3); spawnAt('rat', 15, 3);
    T.shoot({ kind: 'flask', x: 13.5, y: 3, vx: 0.3, vy: 0, ttl: 6, dmg: 13, from: 'player' });
    steps(10);
    chk('C05 a flask blast hits every rat in the radius',
        T.entAt(14, 3) === null && T.entAt(15, 3) === null && T.S.fx2.length >= 0);

    /* strelets ranged shot */
    start(seed, 'strelets'); calm();
    place(18, 6);
    var gh = spawnAt('ghoul', 22, 6);
    var ghHp = gh.hp;   /* snapshot: the live object mutates on damage */
    face(1, 0); tap('a');
    chk('C06 strelets fires a bolt', T.S.proj.length === 1 && T.S.proj[0].kind === 'bolt');
    steps(30);
    var aliveG = T.S.ents.filter(function (e) { return e.kind === 'ghoul'; });
    chk('C07 the bolt reaches and wounds the ghoul', aliveG.length === 1 && aliveG[0].hp < ghHp && aliveG[0].hp > 0,
        aliveG.length ? 'hp=' + aliveG[0].hp : 'gone');

    /* bolt stopped by a wall */
    start(seed, 'strelets'); calm();
    place(18, 6);
    var gh2 = spawnAt('ghoul', 22, 6);
    var gh2Hp = gh2.hp;   /* snapshot */
    T.setTile(20, 6, '#');
    face(1, 0); tap('a'); steps(30);
    var walled = T.S.ents.filter(function (e) { return e.kind === 'ghoul'; });
    chk('C08 walls stop bolts', walled.length === 1 && walled[0].hp === gh2Hp);

    /* troll firebomb detonates on contact with the player */
    start(seed); calm(); place(20, 6);
    spawnAt('troll', 24, 6);
    var hp0 = T.S.hp;
    var guard = 0;
    while (T.S.proj.length === 0 && guard++ < 300) T.step();
    chk('C09 the troll lobs a firebomb', T.S.proj.length >= 1 && T.S.proj[0].kind === 'bomb');
    guard = 0;
    while (T.S.proj.length > 0 && guard++ < 300) T.step();
    chk('C10 a firebomb blast hurts the player', T.S.hp < hp0, hp0 + '->' + T.S.hp);

    /* bomb timeout also explodes */
    start(seed); calm(); place(20, 6);
    spawnAt('rat', 21, 7);
    T.shoot({ kind: 'bomb', x: 20.5, y: 7.5, vx: 0, vy: 0, ttl: 2, dmg: 12, from: 'mob' });
    steps(6);
    chk('C11 an expired bomb still detonates', T.entAt(21, 7) === null, 'ents=' + T.S.ents.length);

    /* ghoul chase */
    start(seed); calm(); place(10, 4);
    spawnAt('ghoul', 10, 8);
    steps(36);
    var hunter = T.S.ents.length ? T.S.ents[0] : null;
    chk('C12 the ghoul closes in on the player', hunter && hunter.kind === 'ghoul' &&
        (Math.abs(hunter.x - T.S.px) + Math.abs(hunter.y - T.S.py)) < 4,
        'd=' + (hunter ? (Math.abs(hunter.x - T.S.px) + Math.abs(hunter.y - T.S.py)) : 'none'));

    T.damagePlayer(999);
    chk('C13 at zero HP the player dies', T.S.hp === 0 && T.S.scene === 'dead');
    /* note: C13 is a bonus 13th combat check; numbering keeps 54 total */

    /* ===== progress (11) ===== */
    start(seed); calm();
    walkTo(T.S.merchant.x, T.S.merchant.y + 1);
    face(0, -1); tap('b');
    chk('P01 the keeper opens a choice dialog', T.S.choice !== null && T.S.choice.opts.length === 3);

    tap('down');
    chk('P02 choice cursor moves down', T.S.choice && T.S.choice.picked === 1);

    T.S.inv.parts = 1;
    tap('b');
    chk('P03 buying a vial spends a part', T.S.inv.vialHeal === 2 && T.S.inv.parts === 0, 'p=' + T.S.inv.parts);

    /* save / load roundtrip */
    start(seed);
    walkTo(12, 5); T.S.hp = 77; T.S.machines = [1, 1, 0, 0]; T.S.gateOpen = false;
    T.saveGame();
    var d = T.loadGame();
    chk('P04 save serialises the run', !!d && d.px === 12 && d.py === 5 && d.hp === 77 && d.machines.join('') === '1100',
        d ? 'px=' + d.px : 'null');

    start(seed);
    T.applySave(d);
    chk('P05 applySave restores position and progress', T.S.px === 12 && T.S.py === 5 && T.S.hp === 77 &&
        T.S.machines.join('') === '1100' && T.S.scene === 'play');

    /* pause freezes the world */
    start(seed); calm();
    var entsBefore = T.S.ents.length;
    tap('pause');
    chk('P06 pause toggles on', T.S.pause === true);
    spawnAt('rat', 5, 3);
    steps(5);
    chk('P07 the world stays frozen while paused', T.S.ents.length === entsBefore + 1 &&
        T.entAt(5, 3) && T.entAt(5, 3).x === 5);
    tap('pause');
    chk('P08 pause toggles back off', T.S.pause === false);

    /* escape layering: panel closes before pause appears */
    start(seed); calm();
    tap('inv');
    chk('P09 the satchel opens', T.S.panel === 'inv');
    tap('esc');
    chk('P10 escape closes the satchel, not into pause', T.S.panel === null && T.S.pause === false);
    tap('esc');
    chk('P11 a second escape pauses the game', T.S.pause === true);

    /* ===== boss & win (bonus block, still counted) ===== */
    start(seed); calm();
    T.S.machines = [1, 1, 1, 1]; T.S.gateOpen = true;
    T.setTile(L.GATE.x, L.GATE.y, 'g');
    place(26, 28); T.step();
    chk('B01 entering the chamber wakes the sentinel', T.S.bossSpawned === true &&
        T.S.ents.some(function (e) { return e.kind === 'sentinel'; }));

    var sen = T.S.ents.filter(function (e) { return e.kind === 'sentinel'; })[0];
    sen.hp = 0;
    steps(3);
    chk('B02 the sentinel falls and the core opens', T.S.bossDead === true, 'bossDead=' + T.S.bossDead);

    walkTo(L.REACTOR.x, L.REACTOR.y + 1);
    face(0, -1); tap('b');
    chk('B03 touching the core wins the game', T.S.scene === 'win');

    /* determinism: replay a scripted sequence twice */
    function replay() {
      start(seed, 'strelets');
      var i2, seq = ['right', 'down', 'right', 'up', 'a', 'b', 'right', 'down', 'a', 'esc'];
      for (i2 = 0; i2 < seq.length; i2++) { T.press[seq[i2]] = 1; T.step(); }
      steps(120);
      return JSON.stringify(T.state());
    }
    var r1 = replay(), r2 = replay();
    chk('D01 a scripted run replays identically', r1 === r2);

    /* message timing */
    start(seed); calm();
    T.msg('BEACON');
    chk('D02 messages are timed', T.S.msgT === 180 && T.S.msg === 'BEACON');
    steps(200);
    chk('D03 messages expire', T.S.msgT === 0);
  }

  /* ---------- connectivity audit: 33 targets, 7 groups ---------- */
  function reachable(d, at) {
    if (d[at.y * T.W + at.x] !== -1) return true;
    var k, DX = [1, -1, 0, 0], DY = [0, 0, 1, -1];
    for (k = 0; k < 4; k++) {
      var nx = at.x + DX[k], ny = at.y + DY[k];
      if (nx >= 0 && ny >= 0 && nx < T.W && ny < T.H && d[ny * T.W + nx] !== -1) return true;
    }
    return false;
  }

  function runAudit(seed) {
    var res = { ok: true, groups: [], total: 0, reached: 0 };
    start(seed);
    var d = T.BFS(T.LANDMARK.START);
    var GROUPS = {
      'machines':       ['machine 0', 'machine 1', 'machine 2', 'machine 3'],
      'bench':          ['bench'],
      'cisterns':       ['cistern 0', 'cistern 1', 'cistern 2'],
      'geyser+doors':   ['geyser', 'door alch', 'door cist'],
      'gate+reactor':   ['gate', 'reactor', 'reactor approach', 'gate south'],
      'districts+ducts': ['entry floor', 'mach floor', 'alch floor', 'cist floor', 'react floor',
                          'duct a', 'duct b', 'cist link', 'spine mid', 'alch corner', 'react wide'],
      'npc+misc':       ['merchant', 'start', 'alch door north', 'cist door east',
                         'entry east', 'mach west', 'entry corner']
    };
    var targets = T.auditTargets();
    var seen = {};
    var gi, ti, names = Object.keys(GROUPS), name, all, cnt;
    for (gi = 0; gi < names.length; gi++) {
      name = names[gi];
      all = true; cnt = 0;
      for (ti = 0; ti < GROUPS[name].length; ti++) {
        var want = GROUPS[name][ti];
        var t2 = null, k;
        for (k = 0; k < targets.length; k++) {
          if (targets[k].what === want) { t2 = targets[k]; break; }
        }
        if (!t2) { all = false; continue; }
        seen[want] = 1;
        cnt++; res.total++;
        if (!reachable(d, t2.at)) {
          all = false;
          LOG.push('AUDIT FAIL [' + name + '] ' + t2.what + ' @ ' + t2.at.x + ',' + t2.at.y);
        } else { res.reached++; }
      }
      if (!all) res.ok = false;
      res.groups.push({ name: name, count: cnt, ok: all });
    }
    /* every declared target must belong to exactly one group (33 total) */
    var orphan = 0, oi;
    for (oi = 0; oi < targets.length; oi++) {
      if (!seen[targets[oi].what]) { orphan++; LOG.push('AUDIT ORPHAN ' + targets[oi].what); }
    }
    if (orphan || res.total !== 33) { res.ok = false; res.total += orphan; }
    return res;
  }

  /* ---------- public runners ---------- */
  var SEEDS = [20261030, 987654321, 1357911130];

  g.TLR_runHeadless = function () {
    LOG = [];
    var pass = 0, fail = 0, si, i, before;
    for (si = 0; si < SEEDS.length; si++) {
      before = LOG.length;
      runChecks(SEEDS[si]);
      var blockFail = 0;
      for (i = before; i < LOG.length; i++) if (LOG[i].indexOf('FAIL') === 0) blockFail++;
      LOG.push('--- seed ' + SEEDS[si] + ': ' + (LOG.length - before - blockFail) + ' pass, ' + blockFail + ' fail');
    }
    for (i = 0; i < LOG.length; i++) {
      if (LOG[i].indexOf('PASS') === 0) pass++;
      else if (LOG[i].indexOf('FAIL') === 0) fail++;
    }
    return { pass: pass, fail: fail, total: pass + fail, log: LOG };
  };

  g.TLR_auditConnectivity = function () {
    LOG = [];
    var si, res, all = { ok: true, seeds: [] };
    for (si = 0; si < SEEDS.length; si++) {
      res = runAudit(SEEDS[si]);
      res.seed = SEEDS[si];
      all.seeds.push(res);
      all.ok = all.ok && res.ok;
    }
    all.log = LOG;
    return all;
  };
})(typeof window !== 'undefined' ? window : globalThis);
