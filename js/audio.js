/* The Last Reactor - audio.js
   Tiny WebAudio wrapper: square-wave beeps generated at runtime.
   No audio files. In headless environments AudioContext is absent and every
   call becomes a silent no-op (see docs/testing.md). */
(function (g) {
  'use strict';
  var T = g.TLR = g.TLR || {};
  var AU = T.AU = { ctx: null, on: true };

  function ac() {
    if (!AU.on) return null;
    if (AU.ctx) return AU.ctx;
    var C = g.AudioContext || g.webkitAudioContext;
    if (!C) return null;             /* headless: stay silent */
    try { AU.ctx = new C(); } catch (e) { AU.ctx = null; }
    return AU.ctx;
  }

  /* one square-wave blip */
  function beep(freq, dur, vol) {
    var c = ac(), o, gn;
    if (!c) return;
    try {
      o = c.createOscillator();
      gn = c.createGain();
      o.type = 'square';
      o.frequency.value = freq;
      gn.gain.value = vol || 0.03;
      o.connect(gn);
      gn.connect(c.destination);
      o.start();
      o.stop(c.currentTime + (dur || 0.08));
    } catch (e) { /* never let audio break the game loop */ }
  }

  AU.beep = beep;
  AU.sfx = function (name) {
    switch (name) {
    case 'hit':    beep(160, 0.06); break;
    case 'hurt':   beep(90, 0.12, 0.05); break;
    case 'shoot':  beep(520, 0.05); break;
    case 'brew':    beep(330, 0.1); beep(440, 0.1); break;
    case 'door':    beep(220, 0.14); break;
    case 'machine': beep(390, 0.16, 0.04); break;
    case 'pickup':  beep(660, 0.07); break;
    case 'buy':     beep(700, 0.06); beep(880, 0.06); break;
    case 'boss':    beep(60, 0.3, 0.06); break;
    case 'win':     beep(523, 0.12); beep(659, 0.12); beep(784, 0.2); break;
    case 'dead':    beep(120, 0.2); beep(80, 0.3); break;
    case 'gate':    beep(180, 0.2, 0.05); break;
    default:        beep(200, 0.05);
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
