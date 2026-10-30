/* The Last Reactor - save.js
   Tiny save system. Uses localStorage when present; otherwise an in-memory
   store (so the logic is fully testable headless; the real browser backend is
   listed as untested in docs/testing.md). */
(function (g) {
  'use strict';
  var T = g.TLR = g.TLR || {};
  var KEY = 'tlr.save';
  var mem = null;

  var _be = null;   /* single backend instance: localStorage or memory shim */

  function backend() {
    if (_be) return _be;
    try {
      if (typeof g.localStorage !== 'undefined' && g.localStorage) {
        _be = g.localStorage;
        return _be;
      }
    } catch (e) { /* sandboxed / disabled */ }
    _be = {
      _m: {},
      setItem: function (k, v) { this._m[k] = String(v); },
      getItem: function (k) {
        return Object.prototype.hasOwnProperty.call(this._m, k) ? this._m[k] : null;
      },
      removeItem: function (k) { delete this._m[k]; }
    };
    return _be;
  }

  function serialize() {
    var s = T.S;
    return JSON.stringify({
      v: 1, seed: T.getSeed(), cls: s.cls, px: s.px, py: s.py,
      hp: s.hp, maxhp: s.maxhp, light: s.light,
      inv: s.inv, reagents: s.reagents, machines: s.machines,
      notes: s.notes, gateOpen: s.gateOpen, bossDead: s.bossDead
    });
  }

  T.saveGame = function () {
    var b = backend();
    try { b.setItem(KEY, serialize()); return true; } catch (e) { return false; }
  };

  T.loadGame = function () {
    var b = backend(), raw, d;
    try { raw = b.getItem(KEY); } catch (e) { raw = null; }
    if (!raw) return null;
    try { d = JSON.parse(raw); } catch (e) { return null; }
    if (!d || d.v !== 1) return null;
    return d;
  };

  T.applySave = function (d) {
    var s = T.S, k;
    if (!d) return false;
    T.setSeed(d.seed);
    T.buildWorld();
    s.cls = d.cls; s.px = d.px; s.py = d.py; s.hp = d.hp; s.maxhp = d.maxhp;
    s.light = d.light;
    for (k in d.inv) { if (d.inv.hasOwnProperty(k)) s.inv[k] = d.inv[k]; }
    for (k in d.reagents) { if (d.reagents.hasOwnProperty(k)) s.reagents[k] = d.reagents[k]; }
    s.machines = d.machines.slice(0);
    s.notes = d.notes.slice(0);
    s.gateOpen = d.gateOpen; s.bossDead = d.bossDead;
    if (s.gateOpen) T.setTile(T.LANDMARK.GATE.x, T.LANDMARK.GATE.y, 'g');
    s.scene = 'play';
    return true;
  };

  T.clearSave = function () {
    var b = backend();
    try { b.removeItem(KEY); } catch (e) {}
  };
})(typeof window !== 'undefined' ? window : globalThis);
