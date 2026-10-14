<script>
'use strict';
/* =========================================================================
 * IO-COMBAT v1.1.0 · GME-2026-10-011 · Ionity (Pty) Ltd · AEDI · Policy 986 AED
 * Original 2D arcade fighter. Vanilla JS, one file, no build step.
 * ========================================================================= */
const VERSION = '1.1.0';
const W = 1280, H = 720, GROUND = 604, WALL_L = 60, WALL_R = 1220;
const $ = (id) => document.getElementById(id);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const rnd = (a, b) => a + Math.random() * (b - a);
const chance = (p) => Math.random() < p;
const QS = new URLSearchParams(location.search);

/* ---------------------------------------------------------------- STORAGE */
const STORE_KEY = 'iocombat.v1';
const DEFAULT_SAVE = {
  settings: { diff: 1, rounds: 2, timer: 99, sfx: 70, music: 45, shake: true, reduceFlash: false, touch: 'auto', muted: false, musicOn: true, autoFull: true, voice: true, cam: true },
  stats: { wins: 0, losses: 0, perfects: 0, deletes: 0, arcadeClears: 0, bestStreak: 0, streak: 0, played: 0, survivalBest: 0, parries: 0 },
  unlocked: { auditor: false }
};
function loadSave() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return structuredClone(DEFAULT_SAVE);
    const d = JSON.parse(raw);
    return {
      settings: Object.assign({}, DEFAULT_SAVE.settings, d.settings || {}),
      stats: Object.assign({}, DEFAULT_SAVE.stats, d.stats || {}),
      unlocked: Object.assign({}, DEFAULT_SAVE.unlocked, d.unlocked || {})
    };
  } catch (e) { return structuredClone(DEFAULT_SAVE); }
}
const SAVE = loadSave();
function persist() { try { localStorage.setItem(STORE_KEY, JSON.stringify(SAVE)); } catch (e) { /* storage unavailable */ } }
const DIFFS = ['EASY', 'NORMAL', 'IRON'];

/* ------------------------------------------------------------------ AUDIO */
class Audio {
  constructor() { this.ctx = null; this.track = null; this.nextT = 0; this.step = 0; this.timer = null; }
  init() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain(); this.master.connect(this.ctx.destination);
      this.sfxG = this.ctx.createGain(); this.sfxG.connect(this.master);
      this.musG = this.ctx.createGain(); this.musG.connect(this.master);
      const len = this.ctx.sampleRate;
      this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      this.applyVolumes();
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
  }
  applyVolumes() {
    if (!this.ctx) return;
    const s = SAVE.settings;
    this.master.gain.value = s.muted ? 0 : 1;
    this.sfxG.gain.value = s.sfx / 100;
    this.musG.gain.value = s.musicOn ? (s.music / 100) * 0.55 : 0;
  }
  get ok() { return !!this.ctx && !SAVE.settings.muted; }
  noise(t, dur, gain, type, f0, f1, dest) {
    const src = this.ctx.createBufferSource(); src.buffer = this.noiseBuf;
    const f = this.ctx.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(f0, t);
    if (f1) f.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const g = this.ctx.createGain(); g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(f); f.connect(g); g.connect(dest || this.sfxG); src.start(t, Math.random() * 0.5); src.stop(t + dur + 0.02);
  }
  tone(t, type, f0, f1, dur, gain, dest) {
    const o = this.ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(f0, t);
    if (f1) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const g = this.ctx.createGain(); g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(dest || this.sfxG); o.start(t); o.stop(t + dur + 0.02);
  }
  sfx(name, opt = {}) {
    if (!this.ok) return;
    const t = this.ctx.currentTime;
    switch (name) {
      case 'whoosh': this.noise(t, 0.13, 0.28, 'bandpass', opt.p || 900, 160); break;
      case 'hit': this.tone(t, 'triangle', 220, 40, 0.13, 0.5); this.noise(t, 0.08, 0.35, 'lowpass', 2400, 300); break;
      case 'heavy': this.tone(t, 'sawtooth', 160, 30, 0.24, 0.55); this.noise(t, 0.16, 0.45, 'lowpass', 1800, 120); this.tone(t, 'sine', 70, 35, 0.3, 0.6); break;
      case 'block': this.tone(t, 'square', 900, 300, 0.07, 0.18); this.noise(t, 0.05, 0.2, 'highpass', 3000); break;
      case 'grab': this.tone(t, 'square', 140, 60, 0.18, 0.3); break;
      case 'jump': this.tone(t, 'sine', 300, 600, 0.09, 0.12); break;
      case 'land': this.noise(t, 0.07, 0.18, 'lowpass', 500, 100); break;
      case 'dash': this.noise(t, 0.12, 0.25, 'bandpass', 2400, 600); break;
      case 'select': this.tone(t, 'square', 660, 990, 0.06, 0.12); break;
      case 'confirm': this.tone(t, 'square', 523, 0, 0.08, 0.15); this.tone(t + 0.08, 'square', 784, 0, 0.12, 0.15); break;
      case 'special': {
        const el = opt.el;
        if (el === 'fire') { this.tone(t, 'sawtooth', 110, 420, 0.15, 0.3); this.noise(t, 0.35, 0.3, 'lowpass', 1200, 200); }
        else if (el === 'cryo') { this.tone(t, 'sine', 1200, 2200, 0.16, 0.25); this.tone(t + 0.1, 'triangle', 1800, 600, 0.25, 0.2); }
        else if (el === 'volt') { for (let i = 0; i < 4; i++) this.tone(t + i * 0.05, 'square', rnd(300, 1400), rnd(100, 300), 0.06, 0.2); }
        else if (el === 'void') { this.tone(t, 'sine', 90, 40, 0.5, 0.45); this.tone(t, 'triangle', 600, 150, 0.4, 0.15); }
        else if (el === 'spore') { this.noise(t, 0.4, 0.25, 'bandpass', 600, 1600); this.tone(t, 'triangle', 200, 120, 0.3, 0.2); }
        else if (el === 'audit') { this.tone(t, 'square', 220, 0, 0.12, 0.2); this.tone(t + 0.12, 'square', 330, 0, 0.12, 0.2); this.tone(t + 0.24, 'sawtooth', 440, 110, 0.3, 0.25); }
        else { this.tone(t, 'sawtooth', 300, 900, 0.12, 0.25); this.tone(t + 0.1, 'square', 900, 200, 0.2, 0.2); }
        break;
      }
      case 'tele': this.tone(t, 'sine', 1400, 200, 0.22, 0.25); this.noise(t, 0.2, 0.15, 'highpass', 4000); break;
      case 'surge': this.tone(t, 'sawtooth', 60, 600, 0.7, 0.35); this.tone(t, 'square', 120, 1200, 0.7, 0.15); this.noise(t + 0.6, 0.6, 0.5, 'lowpass', 3000, 100); break;
      case 'gong': [98, 147, 196, 294].forEach((f, i) => this.tone(t, i % 2 ? 'triangle' : 'sine', f, f * 0.97, 1.4, 0.22 / (i + 1))); break;
      case 'ko': this.tone(t, 'sawtooth', 300, 40, 0.9, 0.4); this.noise(t, 0.8, 0.4, 'lowpass', 2000, 80); break;
      case 'delete': for (let i = 0; i < 10; i++) this.tone(t + i * 0.045, 'square', 1600 - i * 140, 0, 0.05, 0.16); this.tone(t + 0.45, 'sine', 80, 30, 0.8, 0.6); break;
      case 'parry': this.tone(t, 'square', 1320, 0, 0.05, 0.2); this.tone(t + 0.05, 'square', 1980, 0, 0.12, 0.2); this.noise(t, 0.1, 0.2, 'highpass', 6000); break;
      case 'breaker': this.tone(t, 'sine', 200, 1200, 0.25, 0.4); this.noise(t, 0.4, 0.4, 'bandpass', 3000, 300); break;
      case 'overclock': this.tone(t, 'sawtooth', 110, 880, 0.35, 0.25); break;
      case 'sig': this.tone(t, 'square', 440, 880, 0.08, 0.18); this.tone(t + 0.08, 'triangle', 880, 220, 0.25, 0.2); break;
      case 'tick': this.tone(t, 'square', 1200, 0, 0.03, 0.08); break;
    }
  }
  /* ------- original chiptune sequencer: GRID PULSE / OVERRIDE / ROOT PROTOCOL ------- */
  playMusic(name) {
    if (this.trackName === name) return;
    this.trackName = name; this.track = TRACKS[name] || null; this.step = 0;
    if (!this.ctx) return;
    this.nextT = this.ctx.currentTime + 0.08;
    if (!this.timer) this.timer = setInterval(() => this.schedule(), 25);
  }
  stopMusic() { this.trackName = null; this.track = null; }
  schedule() {
    if (!this.ctx || !this.track) return;
    const tr = this.track, spb = 60 / tr.bpm / 4; // 16th notes
    while (this.nextT < this.ctx.currentTime + 0.12) {
      const st = this.step, bar = Math.floor(st / 16) % tr.chords.length, s = st % 16;
      const chord = tr.chords[bar], t = this.nextT, m = this.musG;
      const hz = (n) => 440 * Math.pow(2, (n - 69) / 12);
      // bass
      if (tr.bass[s] !== '.') { const n = chord[0] - 24 + (tr.bass[s] === 'o' ? 12 : 0); this.tone(t, 'square', hz(n), 0, spb * 1.6, 0.13, m); }
      // arp
      if (tr.arp[s] !== '.') { const idx = +tr.arp[s]; const n = chord[idx % chord.length] + (idx >= chord.length ? 12 : 0) + 12; this.tone(t, tr.lead || 'triangle', hz(n), 0, spb * 0.9, 0.07, m); }
      // drums
      if (tr.kick[s] === 'x') this.tone(t, 'sine', 140, 40, 0.14, 0.45, m);
      if (tr.snare[s] === 'x') this.noise(t, 0.11, 0.22, 'bandpass', 1800, 900, m);
      if (tr.hat[s] === 'x') this.noise(t, 0.03, 0.07, 'highpass', 7000, 0, m);
      this.nextT += spb; this.step++;
    }
  }
}
// chords as MIDI note triads; all patterns composed for IO-COMBAT
const TRACKS = {
  menu: { bpm: 108, lead: 'triangle', chords: [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]],
    bass: 'x..x..x.x..x.o..', arp: '0120312012031201', kick: 'x.......x.......', snare: '....x.......x...', hat: '..x...x...x...x.' },
  fight: { bpm: 140, lead: 'square', chords: [[50, 53, 57], [46, 50, 53], [48, 52, 55], [45, 49, 52]],
    bass: 'x.xox.xox.xox.xo', arp: '0.1.2.3.2.1.0.3.', kick: 'x...x...x...x.x.', snare: '....x.......x...', hat: 'x.x.x.x.x.x.x.xx' },
  boss: { bpm: 128, lead: 'sawtooth', chords: [[52, 55, 59], [53, 57, 60], [52, 55, 59], [50, 53, 57]],
    bass: 'xx.xx.xox.xx.xo.', arp: '0..1..2..3..2.1.', kick: 'x..x..x.x..x..x.', snare: '....x.......x..x', hat: 'xxxxxxxxxxxxxxxx' }
};
const audio = new Audio();
/* announcer voice (Web Speech API, robotic low pitch) */
function announce(text) {
  if (!SAVE.settings.voice || SAVE.settings.muted || !('speechSynthesis' in window)) return;
  try {
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text.toLowerCase().replace('io-', 'eye oh ').replace('-443', ' four four three'));
    u.pitch = 0.35; u.rate = 0.92; u.volume = Math.min(1, SAVE.settings.sfx / 70);
    const v = speechSynthesis.getVoices().find(v => /en(-|_)(GB|US|ZA)/i.test(v.lang)); if (v) u.voice = v;
    speechSynthesis.speak(u);
  } catch (e) { /* speech unavailable */ }
}

/* ---------------------------------------------------------------- ROSTER */
const FIGHTERS = [
  { id: 'ioman', name: 'IO-MAN', title: 'Axe of Ions · Hero of the Grid', element: 'ion',
    c1: '#00c6ff', c2: '#1658A4', c3: '#0b1a2b', skin: '#d9b99b', glow: '#00c6ff', emblem: 'IO',
    proj: 'ION AXE', tele: 'PACKET DASH', surge: 'GET OVER IT', stats: { power: 90, speed: 90, defense: 88 },
    quote: 'Chop first. Ask questions in the logs.',
    sig: { name: 'AXE CYCLONE', type: 'cyclone' }, alt: { c1: '#e2e8f0', c2: '#0f766e', c3: '#0b1a2b', glow: '#5eead4' },
    taunt: "Let's get over it. Together, or one of us at a time.", win: "Door's open. Walk through it next time." },
  { id: 'volta', name: 'VOLTA', title: 'Edge Node Sentinel', element: 'volt',
    c1: '#facc15', c2: '#6d28d9', c3: '#1c1033', skin: '#c99a7a', glow: '#fde047', emblem: 'V',
    proj: 'EDGE ARC', tele: 'SPARK HOP', surge: 'GRID OVERLOAD', stats: { power: 84, speed: 98, defense: 80 },
    quote: 'Latency is a choice. I chose zero.',
    sig: { name: 'THUNDER DROP', type: 'drop' }, alt: { c1: '#38bdf8', c2: '#be123c', c3: '#1a0a14', glow: '#7dd3fc' },
    taunt: "I route around obstacles. You are an obstacle.", win: "Packet delivered. Zero loss on my side." },
  { id: 'cryo', name: 'CRYO-CORE', title: 'Coolant Daemon of the Server Hall', element: 'cryo',
    c1: '#7dd3fc', c2: '#0e7490', c3: '#0b2530', skin: '#e3cfc2', glow: '#bae6fd', emblem: '*',
    proj: 'COOLANT LANCE', tele: 'FROST BLINK', surge: 'ABSOLUTE IDLE', stats: { power: 86, speed: 84, defense: 96 },
    quote: 'Every system runs better at minus forty.',
    sig: { name: 'GLACIER WALL', type: 'wall' }, alt: { c1: '#f0abfc', c2: '#6b21a8', c3: '#1d0b2b', glow: '#f5d0fe' },
    taunt: "Your fans are spinning. Let me cool you down.", win: "Thermal event resolved. You may reboot." },
  { id: 'null', name: 'NULL', title: 'Void Pointer Assassin', element: 'void',
    c1: '#a855f7', c2: '#2e1065', c3: '#0f0a1a', skin: '#2a2238', glow: '#c084fc', emblem: '0',
    proj: 'SEGFAULT ORB', tele: 'NULL BLINK', surge: 'UNDEFINED', stats: { power: 88, speed: 94, defense: 82 },
    quote: 'You were never referenced.',
    sig: { name: 'VOID SWAP', type: 'swap' }, alt: { c1: '#ef4444', c2: '#18181b', c3: '#09090b', glow: '#fca5a5' },
    taunt: "Your position is just a pointer. I can change it.", win: "Dereferenced." },
  { id: 'mycelia', name: 'MYCELIA', title: 'Spore Witch of the Root', element: 'spore',
    c1: '#4ade80', c2: '#7c2d12', c3: '#14281a', skin: '#b9d8b0', glow: '#86efac', emblem: '§',
    proj: 'SPORE CLOUD', tele: 'ROOT WALK', surge: 'GREAT BLOOM', stats: { power: 85, speed: 88, defense: 90 },
    quote: 'The network was ours before you wired it.',
    sig: { name: 'SPORE TRAP', type: 'trap' }, alt: { c1: '#fbbf24', c2: '#3f6212', c3: '#1a1f0a', glow: '#fde68a' },
    taunt: "Watch where you step. The root remembers.", win: "You were compost all along." },
  { id: 'blaze', name: 'BLAZE-443', title: 'Firewall Gate Guardian', element: 'fire',
    c1: '#f97316', c2: '#7f1d1d', c3: '#2a0d07', skin: '#c58d6a', glow: '#fdba74', emblem: '443',
    proj: 'PORT BLAST', tele: 'FLARE STEP', surge: 'DENY ALL', stats: { power: 97, speed: 80, defense: 90 },
    quote: 'Request denied. Permanently.',
    sig: { name: 'FLAME PILLAR', type: 'pillar' }, alt: { c1: '#e5e7eb', c2: '#1d4ed8', c3: '#0b1222', glow: '#93c5fd' },
    taunt: "No ticket, no entry. And you have no ticket.", win: "Connection refused. Have a nice day." },
  { id: 'auditor', name: 'THE AUDITOR', title: 'Governance Overlord · Final Boss', element: 'audit', boss: true,
    c1: '#ffd166', c2: '#1f2937', c3: '#0b0f17', skin: '#9ca3af', glow: '#ffe08a', emblem: '986',
    proj: 'COMPLIANCE BEAM', tele: 'SUBPOENA', surge: 'FULL AUDIT', stats: { power: 100, speed: 86, defense: 100 },
    quote: 'Policy 986 applies to you too.',
    sig: { name: 'ASSET SEIZURE', type: 'seize' }, alt: { c1: '#e5e7eb', c2: '#7f1d1d', c3: '#140808', glow: '#fecaca' },
    taunt: "Every frame you waste is logged.", win: "Audit complete. You failed every control." }
];
const ELEMENT_INFO = {
  ion: { label: 'ION', col: '#00c6ff' }, volt: { label: 'VOLT', col: '#facc15' }, cryo: { label: 'CRYO', col: '#7dd3fc' },
  void: { label: 'VOID', col: '#a855f7' }, spore: { label: 'SPORE', col: '#4ade80' }, fire: { label: 'FIRE', col: '#f97316' },
  audit: { label: 'AUDIT', col: '#ffd166' }
};
const ARENAS = [
  { id: 'server', name: 'SERVER CORE', sky: ['#04101f', '#0b2440', '#123a66'], floor: '#0d1b2a', accent: '#00c6ff' },
  { id: 'firewall', name: 'FIREWALL GATE', sky: ['#120404', '#3b0b0b', '#7c2d12'], floor: '#1a0d0a', accent: '#f97316' },
  { id: 'forest', name: 'DATA FOREST', sky: ['#03130b', '#0b2e1d', '#14532d'], floor: '#0b1a12', accent: '#4ade80' },
  { id: 'uplink', name: 'UPLINK BRIDGE', sky: ['#020617', '#0f1e3d', '#1e3a8a'], floor: '#0b1222', accent: '#7dd3fc' },
  { id: 'root', name: 'ROOT CAVERN', sky: ['#0a0612', '#1d0f2e', '#3b0764'], floor: '#120a1a', accent: '#c084fc' }
];

/* ------------------------------------------------------------------ MOVES
 * Frame data at 60 fps. a0..a1 = active frames. kind: high | mid | low | overhead | throw
 * x0..x1 = horizontal reach from body centre (facing), y0..y1 = vertical band above feet. */
const MOVES = {
  punch:    { total: 16, a0: 4, a1: 8,  dmg: 6,  kind: 'high', x0: 18, x1: 96,  y0: -140, y1: -98,  hs: 13, push: 4,  stop: 4, gain: 5 },
  kick:     { total: 25, a0: 8, a1: 13, dmg: 11, kind: 'mid',  x0: 26, x1: 124, y0: -128, y1: -78,  hs: 19, push: 8,  stop: 7, gain: 8, heavy: true },
  sweep:    { total: 28, a0: 7, a1: 12, dmg: 9,  kind: 'low',  x0: 26, x1: 128, y0: -34,  y1: 2,    hs: 0,  push: 3,  stop: 6, gain: 8, heavy: true, knock: true },
  uplink:   { total: 32, a0: 6, a1: 12, dmg: 14, kind: 'mid',  x0: 6,  x1: 84,  y0: -220, y1: -86,  hs: 0,  push: 4,  stop: 8, gain: 10, heavy: true, launch: true },
  airpunch: { total: 99, a0: 3, a1: 14, dmg: 7,  kind: 'overhead', x0: 6, x1: 86, y0: -150, y1: -70, hs: 14, push: 4, stop: 4, gain: 5 },
  airkick:  { total: 99, a0: 5, a1: 22, dmg: 10, kind: 'overhead', x0: 6, x1: 100, y0: -90, y1: -6, hs: 17, push: 7, stop: 6, gain: 7, heavy: true },
  grab:     { total: 24, a0: 3, a1: 5,  dmg: 12, kind: 'throw', x0: 0, x1: 86, y0: -150, y1: 0, hs: 0, push: 0, stop: 8, gain: 10, heavy: true },
  special:  { total: 30, spawn: 10, cost: 30 },
  tele:     { total: 30, a0: 15, a1: 21, dmg: 11, kind: 'mid', x0: 0, x1: 104, y0: -150, y1: -60, hs: 18, push: 9, stop: 7, gain: 6, heavy: true, cost: 40 },
  sig:      { total: 28, cost: 25 },
  surge:    { total: 78, freeze: 44, a0: 46, a1: 62, dmg: 30, kind: 'mid', cost: 100 }
};
