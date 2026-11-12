#!/usr/bin/env node
/*
 * Prints the hash to paste into KEY in js/game.js when you change an answer.
 * Usage: node tools/make-hash.js "Lionheart C"
 * Text is normalized the same way the game does it: lowercase, no accents, no spaces or punctuation.
 */
function cyrb53(str, seed) {
  seed = seed || 0;
  var h1 = 0xdeadbeef ^ seed, h2 = 0x41c6ce57 ^ seed;
  for (var i = 0, ch; i < str.length; i++) {
    ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507); h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507); h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return 4294967296 * (2097151 & h2) + (h1 >>> 0);
}
function norm(s) {
  return String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

var input = process.argv.slice(2).join(' ');
if (!input) {
  console.error('Usage: node tools/make-hash.js "your answer"');
  process.exit(1);
}
var answer = norm(input);
console.log('Answer as the game reads it: ' + answer);
console.log('Hash for KEY:                ' + cyrb53('kickoff|' + answer));
console.log('\nFor the phone passcode or the calculator result, type the digits exactly as shown on screen (e.g. 1717, 570).');
