/* The Last Reactor - main.js
   Game loop, input dispatch, scene transitions, boss trigger and the TLR
   hooks used by the headless test suite. In a browser this wires keyboard
   input and requestAnimationFrame; headless mode drives TLR.step() directly. */
(function (g) {
  'use strict';
  var T = g.TLR = g.TLR || {};

  /* ---------- input state ---------- */
  T.keys = { up: 0, down: 0, left: 0, right: 0, a: 0, b: 0, inv: 0, notes: 0,
             pause: 0, esc: 0, enter: 0, save: 0, n: 0, l: 0, one: 0, two: 0, three: 0 };
  /* edge-triggered presses, consumed by step() */
  T.press = {};
  T.tap = function (k) { T.press[k] = 1; };

  /* ---------- game lifecycle ---------- */
  T.start = function (seed, cls) {
    T.setSeed(seed || 20261030);
    T.S = T.newState();
    T.S.cls = cls || 'warden';
    var def = T.classes[T.S.cls];
    T.S.hp = def.hp; T.S.maxhp = def.hp;
    T.buildWorld();
    T.S.scene = 'play';
    T.S.t = 0;
    T.msg('WAKE THE FOUR MACHINES - IN CHAIN ORDER');
    return T.S;
  };

  T.toTitle = function () {
    T.S = T.newState();
    T.S.scene = 'title';
  };

  /* ---------- escape: layered, panels close first (see CHANGELOG) ---------- */
  T.dispatchEsc = function () {
    var s = T.S;
    if (s.choice) { s.choice = null; T.msg('THE KEEPER NODS'); return true; }
    if (s.panel) { s.panel = null; T.msg(''); return true; }
    if (s.pause) { s.pause = false; return true; }
    s.pause = true;
    return true;
  };

  /* ---------- one fixed update step (no rendering) ---------- */
  T.step = function () {
    var s = T.S, k = T.keys, p = T.press, i;
    if (!s) return;
    s.t++;

    if (s.scene === 'title') { stepTitle(s, p); drain(); return; }
    if (s.scene === 'dead' || s.scene === 'win') {
      if (p.enter) { T.start(T.getSeed(), s.cls); }
      drain(); return;
    }
    if (s.scene !== 'play') { drain(); return; }

    /* 1. escape first: dialog -> choice -> panels -> pause */
    if (p.esc) { T.dispatchEsc(); drain(); return; }

    /* 2. pause */
    if (p.pause) { s.pause = !s.pause; drain(); return; }
    if (s.pause) {
      if (p.save) { T.saveGame(); T.msg('PROGRESS ETCHED'); }
      drain(); return;
    }

    /* 3. merchant choice dialog */
    if (s.choice) {
      if (p.up) s.choice.picked = (s.choice.picked + s.choice.opts.length - 1) % s.choice.opts.length;
      if (p.down) s.choice.picked = (s.choice.picked + 1) % s.choice.opts.length;
      if (p.b || p.enter) T.pickChoice(s.choice.picked);
      drain(); return;
    }

    /* 4. alchemy bench menu */
    if (s.panel === 'alch') { stepAlchemy(s, p); drain(); return; }

    /* 5. panels: navigation / close */
    if (s.panel) {
      if (p.inv) s.panel = null;
      drain(); return;
    }
    if (p.inv) { s.panel = 'inv'; drain(); return; }
    if (p.notes) { s.panel = 'notes'; drain(); return; }

    /* 6. combat & world */
    if (p.a) { T.doAttack(); }
    if (p.b) {
      if (!T.doInteract() && s.hp < s.maxhp && s.inv.vialHeal > 0) T.useItem('vialHeal');
    }
    var moved = 0;
    if (k.left || p.left)  { moved += T.tryMove(-1, 0); }
    if (k.right || p.right){ moved += T.tryMove(1, 0); }
    if (k.up || p.up)      { moved += T.tryMove(0, -1); }
    if (k.down || p.down)  { moved += T.tryMove(0, 1); }

    /* door cooldown ticks once a frame */
    if (s.doorCd > 0) s.doorCd--;

    /* systems */
    T.updateProj();
    T.updateEnts();
    T.updateFx();
    if (s.hitFlash > 0) s.hitFlash--;
    if (s.msgT > 0) s.msgT--;

    /* boss trigger: entering the reactor chamber with the gate open */
    var L = T.LANDMARK, RE = L.REACT;
    if (s.gateOpen && !s.bossSpawned &&
        s.px >= RE.x0 && s.px <= RE.x1 && s.py >= RE.y0 && s.py <= RE.y1) {
      s.bossSpawned = true;
      T.spawnEnt('sentinel', 30, 28);
      T.AU.sfx('boss');
      T.msg('THE SENTINEL WAKES');
    }
    var b = -1;
    for (i = 0; i < s.ents.length; i++) {
      if (s.ents[i].kind === 'sentinel' && s.ents[i].hp <= 0) b = i;
    }
    if (s.bossSpawned && !s.bossDead) {
      var alive = 0;
      for (i = 0; i < s.ents.length; i++) if (s.ents[i].kind === 'sentinel' && s.ents[i].hp > 0) alive++;
      if (!alive) { s.bossDead = true; T.msg('THE SENTINEL FALLS - TOUCH THE CORE'); }
    }
    drain();
  };

  function drain() {
    var k;
    for (k in T.press) {
      if (Object.prototype.hasOwnProperty.call(T.press, k)) T.press[k] = 0;
    }
  }

  function stepTitle(s, p) {
    if (p.up) s.cursor = (s.cursor + 2) % 3;
    if (p.down) s.cursor = (s.cursor + 1) % 3;
    if (p.enter) {
      var cls = ['warden', 'alchemist', 'strelets'][s.cursor];
      T.start(T.getSeed(), cls);
    }
    if (p.l) {
      var d = T.loadGame();
      if (d) { T.applySave(d); T.msg('A LIFE RESUMES'); }
      else T.msg('NO SAVE FOUND');
    }
    if (p.n) { T.setSeed(1000 + T.ri(900000)); T.msg('SEED: ' + T.getSeed()); }
  }

  function stepAlchemy(s, p) {
    if (p.one) {
      if (s.reagents.aqua > 0 && s.reagents.ignis > 0) {
        s.reagents.aqua--; s.reagents.ignis--; s.inv.flaskFire++;
        T.AU.sfx('brew'); T.msg('A FIRE FLASK, HISSING SOFTLY');
      } else T.msg('NOT ENOUGH REAGENTS');
    } else if (p.two) {
      if (s.reagents.aqua > 0 && s.reagents.vis > 0) {
        s.reagents.aqua--; s.reagents.vis--; s.inv.vialHeal++;
        T.AU.sfx('brew'); T.msg('A HEALING VIAL, WARM TO TOUCH');
      } else T.msg('NOT ENOUGH REAGENTS');
    } else if (p.three) {
      if (s.inv.parts >= 2) { s.inv.parts -= 2; s.inv.parts++; T.msg('SCRAPS SALVAGED'); }
      else T.msg('NEED 2 PARTS');
    }
  }

  /* ---------- debug/test accessors ---------- */
  T.state = function () {
    var s = T.S, out, k;
    if (!s) return null;
    out = {
      t: s.t, scene: s.scene, cls: s.cls, cursor: s.cursor,
      px: s.px, py: s.py, hp: s.hp, maxhp: s.maxhp, fx: s.fx, fy: s.fy,
      inv: JSON.parse(JSON.stringify(s.inv)),
      reagents: JSON.parse(JSON.stringify(s.reagents)),
      machines: s.machines.slice(0),
      notes: s.notes.slice(0),
      light: s.light, doorCd: s.doorCd, msg: s.msg, msgT: s.msgT,
      panel: s.panel, pause: s.pause,
      choice: s.choice ? { q: s.choice.q, picked: s.choice.picked, n: s.choice.opts.length } : null,
      gateOpen: s.gateOpen, bossSpawned: s.bossSpawned, bossDead: s.bossDead,
      proj: s.proj.length, ents: s.ents.length, fx2: s.fx2.length,
      merchant: { x: s.merchant.x, y: s.merchant.y },
      hitFlash: s.hitFlash
    };
    return out;
  };
  T.entAt = function (x, y) {
    var i, e;
    for (i = 0; i < T.S.ents.length; i++) {
      e = T.S.ents[i];
      if (e.hp > 0 && e.x === x && e.y === y) return JSON.parse(JSON.stringify(e));
    }
    return null;
  };

  /* ---------- browser bootstrap (skipped headless) ---------- */
  function browserInit() {
    var canvas = document.getElementById('game');
    if (!canvas || !canvas.getContext) return;
    var ctx = canvas.getContext('2d');
    var MAP = {
      ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
      KeyW: 'up', KeyS: 'down', KeyA: 'left', KeyD: 'right',
      KeyJ: 'a', Space: 'a', KeyK: 'b', KeyE: 'b',
      KeyI: 'inv', KeyO: 'notes', KeyP: 'pause', Escape: 'esc', Enter: 'enter'
    };
    function keyMap(ev) {
      if (ev.code === 'Escape') return 'esc';
      /* while paused, S saves (S is otherwise move-down) */
      if (T.S && T.S.pause && ev.code === 'KeyS') return 'save';
      if (ev.code === 'Digit1') return 'one';
      if (ev.code === 'Digit2') return 'two';
      if (ev.code === 'Digit3') return 'three';
      return MAP[ev.code] || null;
    }
    /* note: KeyS is movement-down; save is only via the pause menu */
    document.addEventListener('keydown', function (ev) {
      var m = keyMap(ev);
      if (!m) return;
      ev.preventDefault();
      if (!T.keys[m]) { T.press[m] = 1; }   /* edge trigger */
      T.keys[m] = 1;
    });
    document.addEventListener('keyup', function (ev) {
      var m = keyMap(ev);
      if (m) T.keys[m] = 0;
    });
    /* main loop */
    var acc = 0, last = 0;
    function loop(ts) {
      if (!last) last = ts;
      acc += ts - last; last = ts;
      while (acc >= 1000 / 60) { T.step(); acc -= 1000 / 60; }
      T.R.render(ctx);
      requestAnimationFrame(loop);
    }
    T.toTitle();
    requestAnimationFrame(loop);
  }

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', browserInit);
    } else {
      browserInit();
    }
  } else {
    /* headless: expose a start state immediately */
    T.toTitle();
  }
})(typeof window !== 'undefined' ? window : globalThis);
