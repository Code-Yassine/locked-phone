#!/usr/bin/env node
/*
 * The Locked Phone — server
 * Serves the game and keeps the live scoreboard. Plain Node, no dependencies.
 *
 *   GET  /                 the game
 *   GET  /scores           the scoreboard page (for the game master / projector)
 *   GET  /api/scores       all teams as JSON
 *   POST /api/scores       a device reports its team's progress
 *   POST /api/scores/reset clears the scoreboard (needs the X-Admin-Key header = ADMIN_KEY)
 *
 * Settings (environment variables):
 *   PORT       port to listen on (default 80)
 *   DATA_DIR   folder where scores.json is kept (default ./data)
 *   ADMIN_KEY  key asked by the scoreboard's "clear" button (default kickoff-gm)
 */
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = parseInt(process.env.PORT, 10) || 80;
const ROOT = __dirname;
const DATA_DIR = process.env.DATA_DIR || path.join(ROOT, 'data');
const DATA_FILE = path.join(DATA_DIR, 'scores.json');
const ADMIN_KEY = process.env.ADMIN_KEY || 'kickoff-gm';
const MAX_TEAMS = 500;

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'application/javascript; charset=utf-8',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.gif': 'image/gif'
};

/* ---------- scores storage ---------- */
let scores = {};
try { scores = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')) || {}; } catch (e) { scores = {}; }
let saveTimer = null;
function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      fs.mkdirSync(DATA_DIR, { recursive: true });
      fs.writeFileSync(DATA_FILE + '.tmp', JSON.stringify(scores));
      fs.renameSync(DATA_FILE + '.tmp', DATA_FILE);
    } catch (e) { console.error('Could not save scores:', e.message); }
  }, 200);
}

function num(v, min, max) { v = Number(v); if (!isFinite(v)) v = 0; return Math.min(max, Math.max(min, Math.round(v))); }
/* Score: 100 per lock opened + battery left − 2 per full minute played. Never below 0. */
function score(r) { return Math.max(0, r.locks * 100 + r.battery - 2 * Math.floor(r.seconds / 60)); }

function clean(b) {
  if (!b || typeof b.id !== 'string' || !/^[a-z0-9]{6,40}$/i.test(b.id)) return null;
  const r = {
    id: b.id,
    team: String(b.team || 'Équipe').trim().slice(0, 28) || 'Équipe',
    locks: num(b.locks, 0, 4),
    battery: num(b.battery, 0, 100),
    seconds: num(b.seconds, 0, 24 * 3600),
    wrong: num(b.wrong, 0, 9999),
    hints: num(b.hints, 0, 99),
    status: ['playing', 'found', 'dead'].indexOf(b.status) >= 0 ? b.status : 'playing',
    updatedAt: Date.now()
  };
  if (r.status === 'dead') r.battery = 0;
  r.score = score(r);
  return r;
}

/* ---------- http ---------- */
function send(res, code, body, type) {
  res.writeHead(code, { 'Content-Type': type || 'application/json; charset=utf-8', 'Cache-Control': 'no-cache' });
  res.end(typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body));
}
function readBody(req, cb) {
  let data = '', tooBig = false;
  req.on('data', c => { data += c; if (data.length > 4096) { tooBig = true; req.destroy(); } });
  req.on('end', () => { if (tooBig) return cb(null); try { cb(JSON.parse(data)); } catch (e) { cb(null); } });
}
/* Media files (your photos). Range requests are supported for large files. */
function serveMedia(req, res, rel) {
  const file = path.join(ROOT, rel);
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) return send(res, 404, 'Not found', 'text/plain; charset=utf-8');
    const type = TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream';
    const m = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range || '');
    if (m && (m[1] || m[2])) {
      let start = m[1] ? parseInt(m[1], 10) : st.size - parseInt(m[2], 10);
      let end = m[1] && m[2] ? parseInt(m[2], 10) : st.size - 1;
      start = Math.max(0, start); end = Math.min(end, st.size - 1);
      if (start > end) { res.writeHead(416, { 'Content-Range': 'bytes */' + st.size }); return res.end(); }
      res.writeHead(206, { 'Content-Type': type, 'Content-Range': 'bytes ' + start + '-' + end + '/' + st.size, 'Content-Length': end - start + 1, 'Accept-Ranges': 'bytes', 'Cache-Control': 'no-cache' });
      return fs.createReadStream(file, { start, end }).pipe(res);
    }
    res.writeHead(200, { 'Content-Type': type, 'Content-Length': st.size, 'Accept-Ranges': 'bytes', 'Cache-Control': 'no-cache' });
    fs.createReadStream(file).pipe(res);
  });
}
function serveFile(res, rel) {
  const file = path.join(ROOT, rel);
  fs.readFile(file, (err, buf) => {
    if (err) return send(res, 404, 'Not found', 'text/plain; charset=utf-8');
    send(res, 200, buf, TYPES[path.extname(file)] || 'application/octet-stream');
  });
}

http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  const p = decodeURIComponent(url.pathname);

  if (p === '/api/scores' && req.method === 'GET') {
    const list = Object.values(scores).sort((a, b) => b.score - a.score || b.locks - a.locks || a.seconds - b.seconds);
    return send(res, 200, list);
  }
  if (p === '/api/scores' && req.method === 'POST') {
    return readBody(req, b => {
      const r = clean(b);
      if (!r) return send(res, 400, { error: 'bad report' });
      const old = scores[r.id];
      if (!old && Object.keys(scores).length >= MAX_TEAMS) return send(res, 429, { error: 'too many teams' });
      if (old && old.status !== 'playing') return send(res, 200, old); // a finished game can't be changed
      scores[r.id] = r; save();
      send(res, 200, r);
    });
  }
  if (p === '/api/scores/reset' && req.method === 'POST') {
    if (req.headers['x-admin-key'] !== ADMIN_KEY) return send(res, 403, { error: 'wrong key' });
    scores = {}; save();
    return send(res, 200, { ok: true });
  }
  if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, { error: 'method not allowed' });

  // Static files: only the game's own files are served (not server.js, data, etc.).
  if (p === '/' || p === '/index.html') return serveFile(res, 'index.html');
  if (p === '/scores' || p === '/scores.html') return serveFile(res, 'scores.html');
  if (/^\/(css|js)\/[a-z0-9._-]+\.(css|js)$/i.test(p)) return serveFile(res, p.slice(1));
  if (/^\/media\/([a-z0-9._ -]+\/)?[a-z0-9._ -]+\.(jpe?g|png|webp|gif)$/i.test(p) && p.indexOf('..') < 0) return serveMedia(req, res, p.slice(1));
  return serveFile(res, 'index.html');
}).listen(PORT, () => console.log('Locked Phone running on port ' + PORT + ' · scoreboard at /scores'));
