/* The Last Reactor - tests/regen-screenshots.js
   Node script: regenerates all 7 screenshots from the game sources.
   Runs the same deterministic capture pipeline as the headless tests
   (fixed seed, fixed frame), so the output is byte-identical everywhere
   the same code runs.

   Usage:  node tests/regen-screenshots.js
   Output: docs/screenshots/01-title.png ... 07-ending.png

   NOTE: this exists because the publishing connector used to create this
   repository can only write UTF-8 text, not binary files - so the PNGs are
   generated on GitHub itself by .github/workflows/screenshots.yml (and can
   be regenerated locally with this script at any time). */
(function () {
  'use strict';
  var fs = require('fs');
  var path = require('path');
  var root = path.join(__dirname, '..');

  var files = [
    'js/core.js', 'js/assets.js', 'js/audio.js', 'js/world.js',
    'js/entities.js', 'js/player.js', 'js/save.js', 'js/ui.js',
    'js/render.js', 'js/main.js', 'tests/capture-harness.js'
  ];

  var bundle = '';
  files.forEach(function (f) {
    bundle += '\n;' + fs.readFileSync(path.join(root, f), 'utf8') + '\n';
  });

  /* indirect eval -> global scope, where the modules attach to globalThis */
  (0, eval)(bundle);

  var caps = globalThis.TLR_captureAll();
  caps.forEach(function (c) {
    var out = path.join(root, 'docs', 'screenshots', c.name + '.png');
    fs.writeFileSync(out, Buffer.from(c.png, 'latin1'));
    console.log('wrote ' + out + ' (' + c.size + ' bytes)');
  });
  if (caps.length !== 7) {
    throw new Error('expected 7 captures, got ' + caps.length);
  }
  console.log('done: 7 screenshots');
})();
