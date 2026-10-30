/* The Last Reactor - tests/capture-harness.js
   Deterministic screenshot capture, no DOM and no canvas needed.

   - TLR_makeRC(): a tiny recording rasterizer implementing exactly the ctx
     surface the game renderer uses: fillRect, fillStyle, save, restore.
     Colours are 'rgb(r,g,b)' strings only (the game deliberately avoids
     alpha compositing so this harness stays byte-exact and simple).
   - TLR_encodePNG(rc): indexed 8-bit PNG, 256x240, PLTE in first-appearance
     scan order, filter 0 on every scanline, one *stored* deflate block with
     16-bit LEN/NLEN (78 01 01 <LEN LE> <NLEN LE> <raw> <adler32>).
   - TLR_captureAll(only?): renders 7 canonical scenes and returns
     [{ name, png, b64, size }]. Scenes are set up at fixed frame counts,
     so captures are byte-reproducible for a given game version.
*/
(function (g) {
  'use strict';
  var T = g.TLR = g.TLR || {};

  /* ---------- recording rasterizer ---------- */
  function makeRC() {
    var W = T.CW, H = T.CH, px = new Array(W * H), i;
    for (i = 0; i < px.length; i++) px[i] = 'rgb(0,0,0)';
    var rc = {
      _px: px, _w: W, _h: H,
      fillStyle: 'rgb(0,0,0)',
      _stack: [],
      save: function () { this._stack.push(this.fillStyle); },
      restore: function () {
        if (this._stack.length) this.fillStyle = this._stack.pop();
      },
      fillRect: function (x, y, w, h) {
        var xx, yy, x0 = Math.max(0, Math.floor(x)), y0 = Math.max(0, Math.floor(y)),
            x1 = Math.min(this._w, Math.ceil(x + w)), y1 = Math.min(this._h, Math.ceil(y + h));
        for (yy = y0; yy < y1; yy++) {
          for (xx = x0; xx < x1; xx++) {
            this._px[yy * this._w + xx] = this.fillStyle;
          }
        }
      },
      fillText: function () {},   /* the game never uses fillText */
      getContext: function () { return this; }
    };
    return rc;
  }
  g.TLR_makeRC = makeRC;

  /* ---------- PNG encoder ---------- */
  function b(n) { return String.fromCharCode(n & 255); }
  function w16(v) { return String.fromCharCode((v & 255), ((v >>> 8) & 255)); }
  /* PNG structures (chunk lengths, IHDR, adler32) are BIG-endian;
     only the deflate block LEN/NLEN below are little-endian. */
  function be32(v) {
    return String.fromCharCode(((v >>> 24) & 255), ((v >>> 16) & 255),
      ((v >>> 8) & 255), (v & 255));
  }

  function adler32(s) {
    var a = 1, bb = 0, i;
    for (i = 0; i < s.length; i++) {
      a = (a + s.charCodeAt(i)) % 65521;
      bb = (bb + a) % 65521;
    }
    return (bb * 65536 + a) >>> 0;
  }

  var CRCT = null;
  function crcTable() {
    var n, k, c;
    if (CRCT) return CRCT;
    CRCT = [];
    for (n = 0; n < 256; n++) {
      c = n;
      for (k = 0; k < 8; k++) {
        c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      }
      CRCT[n] = c >>> 0;
    }
    return CRCT;
  }
  function crc32(s) {
    var t = crcTable(), c = 0xFFFFFFFF, i;
    for (i = 0; i < s.length; i++) {
      c = t[(c ^ s.charCodeAt(i)) & 255] ^ (c >>> 8);
    }
    return ((c ^ 0xFFFFFFFF) >>> 0);
  }

  function chunk(type, data) {
    var out = be32(data.length) + type + data;
    return out + be32(crc32(type + data));
  }

  /* rgb string -> 'r,g,b' key (strictly 'rgb(r,g,b)' in this game) */
  function rgbKey(str) {
    var m = /^rgb\((\d+),(\d+),(\d+)\)$/.exec(str);
    return m ? (parseInt(m[1], 10) + ',' + parseInt(m[2], 10) + ',' + parseInt(m[3], 10)) : null;
  }

  function encodePNG(rc) {
    var W = rc._w, H = rc._h, px = rc._px, i, y, x, k;
    /* palette in first-appearance scan order */
    var pal = [], idx = {};
    /* scanlines with filter byte 0 */
    var raw = '';
    var rowStr = new Array(W + 1);
    for (y = 0; y < H; y++) {
      rowStr[0] = '\u0000';
      for (x = 0; x < W; x++) {
        k = rgbKey(px[y * W + x]);
        if (idx[k] === undefined) { idx[k] = pal.length; pal.push(k); }
        rowStr[x + 1] = String.fromCharCode(idx[k]);
      }
      raw += rowStr.join('');
    }
    /* PLTE bytes */
    var plte = '';
    for (i = 0; i < pal.length; i++) {
      var p = pal[i].split(',');
      plte += String.fromCharCode(parseInt(p[0], 10), parseInt(p[1], 10), parseInt(p[2], 10));
    }
    /* one stored deflate block (LEN is 16-bit LE) */
    var LEN = raw.length, NLEN = (~LEN) & 0xFFFF;
    var zdata = '\u0078\u0001' +      /* zlib header, no compression */
                '\u0001' +            /* final flag + stored block */
                w16(LEN) + w16(NLEN) + raw + be32(adler32(raw));
    var png = '\u0089PNG\u000d\u000a\u001a\u000a';
    png += chunk("IHDR", be32(W) + be32(H) + b(8) + b(3) + b(0) + b(0) + b(0));
    png += chunk('PLTE', plte);
    png += chunk('IDAT', zdata);
    png += chunk('IEND', '');
    return png;
  }
  g.TLR_encodePNG = encodePNG;

  /* ---------- base64 (btoa is not available everywhere) ---------- */
  var B64A = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  function b64(s) {
    var out = [], i, n = s.length;
    for (i = 0; i < n; i += 3) {
      var a0 = s.charCodeAt(i), a1 = i + 1 < n ? s.charCodeAt(i + 1) : 0,
          a2 = i + 2 < n ? s.charCodeAt(i + 2) : 0,
          trip = (a0 << 16) | (a1 << 8) | a2;
      out.push(B64A.charAt((trip >> 18) & 63), B64A.charAt((trip >> 12) & 63));
      out.push(i + 1 < n ? B64A.charAt((trip >> 6) & 63) : '=');
      out.push(i + 2 < n ? B64A.charAt(trip & 63) : '=');
    }
    return out.join('');
  }
  g.TLR_b64 = b64;

  /* ---------- the 7 canonical scenes ---------- */
  var SCENES = [
    { name: '01-title', fn: function () {
      T.toTitle();
      T.S.cursor = 0; T.S.t = 120;
    } },
    { name: '02-entry', fn: function () {
      T.start(20261030, 'warden');
      T.S.t = 120;
    } },
    { name: '03-alchemy', fn: function () {
      T.start(20261030, 'alchemist');
      var L = T.LANDMARK;
      T.S.px = L.BENCH.x; T.S.py = L.BENCH.y + 1; T.S.fx = 0; T.S.fy = -1;
      T.S.reagents = { aqua: 2, ignis: 1, vis: 1 };
      T.S.panel = 'alch'; T.S.t = 120;
    } },
    { name: '04-cisterns', fn: function () {
      T.start(20261030, 'warden');
      T.S.px = 10; T.S.py = 27; T.S.fx = 1; T.S.fy = 0;
      T.S.reagents = { aqua: 1, ignis: 0, vis: 0 };
      T.msg('THE CISTERNS MURMUR IN THE DARK'); T.S.t = 120;
    } },
    { name: '05-combat', fn: function () {
      T.start(20261030, 'alchemist');
      T.S.px = 10; T.S.py = 5; T.S.fx = 1; T.S.fy = 0;
      T.spawnEnt('rat', 11, 5);
      T.spawnEnt('ghoul', 12, 7);
      T.S.ents[0].cd = 100; T.S.ents[1].cd = 100;
      T.useItem('flaskFire');            /* a flask mid-flight */
      T.S.fx2.push({ x: 12, y: 5, r: 1.6, t: 8 });   /* and a blast */
      T.S.hp = 87; T.S.hitFlash = 4; T.S.t = 120;
    } },
    { name: '06-boss', fn: function () {
      T.start(20261030, 'warden');
      T.S.machines = [1, 1, 1, 1]; T.S.gateOpen = true; T.S.bossSpawned = true;
      T.setTile(T.LANDMARK.GATE.x, T.LANDMARK.GATE.y, 'g');
      T.S.px = 26; T.S.py = 28; T.S.fx = 1; T.S.fy = 0;
      T.spawnEnt('sentinel', 30, 28);
      T.S.ents[0].cd = 100;
      T.msg('THE SENTINEL WAKES'); T.S.t = 120;
    } },
    { name: '07-ending', fn: function () {
      T.start(20261030, 'warden');
      T.S.machines = [1, 1, 1, 1]; T.S.gateOpen = true;
      T.S.notes = T.NOTES.slice(0);
      T.S.bossDead = true; T.S.scene = 'win'; T.S.t = 120;
    } }
  ];

  g.TLR_captureAll = function (only) {
    var out = [], i, sc, rc, png;
    for (i = 0; i < SCENES.length; i++) {
      sc = SCENES[i];
      if (only && only.indexOf(sc.name) < 0) continue;
      sc.fn();
      rc = makeRC();
      T.R.render(rc);
      png = encodePNG(rc);
      out.push({ name: sc.name, png: png, b64: b64(png), size: png.length });
    }
    return out;
  };
})(typeof window !== 'undefined' ? window : globalThis);
