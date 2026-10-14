
/* ------------------------------------------------------------------ INPUT
 * Every fighter reads a Pad. Keyboard, gamepad, touch and the AI all write into it.
 * Presses are buffered for 6 frames so quick taps never get lost. */
const PAD_KEYS = ['left', 'right', 'up', 'down', 'punch', 'kick', 'block', 'special', 'tele', 'surge'];
class Pad {
  constructor() { this.held = {}; this.buf = {}; this.src = {}; this.dn = {}; this.bl = {}; this.age = {}; PAD_KEYS.forEach(k => { this.held[k] = false; this.buf[k] = 0; this.age[k] = 99; }); }
  set(k, v, src = 'k') {
    // several sources (keyboard / touch / gamepad / ai) may hold the same key
    const key = k + ':' + src;
    if (v) { if (!this.src[key]) { this.src[key] = 1; if (!this.held[k]) { this.buf[k] = 6; this.age[k] = 0; this.dn[k] = this.held.down; this.bl[k] = this.held.block; } } }
    else delete this.src[key];
    this.held[k] = Object.keys(this.src).some(s => s.startsWith(k + ':'));
  }
  press(k) { return this.buf[k] > 0; }
  use(k) { this.buf[k] = 0; }
  tick() { PAD_KEYS.forEach(k => { if (this.buf[k] > 0) this.buf[k]--; if (this.age[k] < 99) this.age[k]++; }); }
  clear() { this.src = {}; PAD_KEYS.forEach(k => { this.held[k] = false; this.buf[k] = 0; }); }
  clearSrc(src) { Object.keys(this.src).forEach(s => { if (s.endsWith(':' + src)) delete this.src[s]; }); PAD_KEYS.forEach(k => { this.held[k] = Object.keys(this.src).some(s => s.startsWith(k + ':')); }); }
}

/* -------------------------------------------------------------- PARTICLES */
let particles = [], projectiles = [], floorPix = [], popups = [], hazards = [], rings = [];
class Particle {
  constructor(o) { Object.assign(this, { g: 0.4, size: 4, life: 30, rot: 0, vr: 0, shape: 'sq', floor: false, drag: 1 }, o); this.max = this.life; }
  update() {
    this.x += this.vx; this.y += this.vy; this.vy += this.g; this.vx *= this.drag; this.rot += this.vr; this.life--;
    if (this.floor && this.y >= GROUND) {
      this.y = GROUND; if (floorPix.length < 140 && chance(0.4)) floorPix.push({ x: this.x, y: GROUND + rnd(-2, 14), s: this.size, c: this.color, a: 0.9 });
      this.life = 0;
    }
  }
  draw(c) {
    c.globalAlpha = clamp(this.life / this.max, 0, 1); c.fillStyle = this.color;
    if (this.shape === 'sq') { c.save(); c.translate(this.x, this.y); c.rotate(this.rot); c.fillRect(-this.size / 2, -this.size / 2, this.size, this.size); c.restore(); }
    else { c.beginPath(); c.arc(this.x, this.y, this.size, 0, 7); c.fill(); }
    c.globalAlpha = 1;
  }
}
function burst(x, y, n, colors, o = {}) {
  for (let i = 0; i < n; i++) {
    const a = o.dir ? (o.dir > 0 ? rnd(-1.2, 0.4) : Math.PI + rnd(-0.4, 1.2)) : rnd(0, Math.PI * 2);
    const sp = rnd(o.smin || 2, o.smax || 8);
    particles.push(new Particle({ x: x + rnd(-8, 8), y: y + rnd(-8, 8), vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - (o.up || 0),
      size: rnd(o.min || 3, o.max || 7), color: colors[(Math.random() * colors.length) | 0], life: rnd(o.lmin || 20, o.lmax || 45),
      g: o.g ?? 0.4, vr: rnd(-0.3, 0.3), shape: o.shape || 'sq', floor: !!o.floor, drag: o.drag || 1 }));
  }
}
function popup(x, y, text, color, size = 24) { popups.push({ x, y, text, color, size, life: 50 }); }
function ring(x, y, color, max = 90, w = 6) { rings.push({ x, y, r: 6, max, color, w, life: 18 }); }

/* ------------------------------------------------------------- PROJECTILE */
const PROJ = {
  ion: { sp: 13.5, r: 24, dmg: 13 }, volt: { sp: 17, r: 20, dmg: 11 }, cryo: { sp: 12.5, r: 22, dmg: 11 },
  void: { sp: 8, r: 30, dmg: 12 }, spore: { sp: 8.5, r: 30, dmg: 8 }, fire: { sp: 14, r: 24, dmg: 14 }, audit: { sp: 18, r: 22, dmg: 15 }
};
class Projectile {
  constructor(owner) {
    const P = PROJ[owner.d.element];
    this.owner = owner; this.el = owner.d.element; this.dir = owner.facing; this.col = owner.d.glow;
    this.x = owner.x + owner.facing * 66; this.y = owner.y - 112 * owner.scale; this.vx = this.dir * P.sp; this.r = P.r; this.dmg = P.dmg;
    this.t = 0; this.alive = true;
  }
  update() {
    this.t++; this.x += this.vx;
    if (this.el === 'spore') this.y += Math.sin(this.t * 0.15) * 1.2;
    if (this.t % 2 === 0) particles.push(new Particle({ x: this.x - this.dir * 14 + rnd(-6, 6), y: this.y + rnd(-10, 10), vx: -this.dir * rnd(0.5, 2.5), vy: rnd(-1, 1),
      size: rnd(3, 7), color: this.col, life: 16, g: 0, shape: this.el === 'cryo' || this.el === 'ion' ? 'sq' : 'c' }));
    if (this.x < -80 || this.x > W + 80) this.alive = false;
  }
  draw(c) {
    c.save(); c.translate(this.x, this.y); c.shadowColor = this.col; c.shadowBlur = 24; const d = this.dir, t = this.t;
    if (this.el === 'ion') { // spinning ion axe
      c.rotate(t * 0.45 * d); c.fillStyle = '#e6f9ff'; c.fillRect(-3, -22, 6, 44);
      c.fillStyle = this.col; c.beginPath(); c.moveTo(3, -22); c.quadraticCurveTo(26, -14, 22, 6); c.lineTo(3, -2); c.closePath(); c.fill();
      c.beginPath(); c.moveTo(-3, 22); c.quadraticCurveTo(-26, 14, -22, -6); c.lineTo(-3, 2); c.closePath(); c.fill();
    } else if (this.el === 'volt') {
      c.strokeStyle = '#fff'; c.lineWidth = 3; c.beginPath(); for (let a = 0; a < 7; a += 0.6) { const r = 10 + Math.random() * 14; c.lineTo(Math.cos(a) * r, Math.sin(a) * r); } c.closePath(); c.stroke();
      c.strokeStyle = this.col; c.beginPath(); c.moveTo(-d * 40, rnd(-8, 8)); c.lineTo(-d * 20, rnd(-12, 12)); c.lineTo(0, 0); c.stroke();
    } else if (this.el === 'cryo') {
      c.fillStyle = '#e0f7ff'; c.strokeStyle = this.col; c.lineWidth = 3; c.beginPath();
      c.moveTo(d * 34, 0); c.lineTo(-d * 16, -13); c.lineTo(-d * 6, 0); c.lineTo(-d * 16, 13); c.closePath(); c.fill(); c.stroke();
    } else if (this.el === 'void') {
      const g = c.createRadialGradient(0, 0, 2, 0, 0, 30); g.addColorStop(0, '#000'); g.addColorStop(0.6, '#1e0638'); g.addColorStop(1, this.col);
      c.fillStyle = g; c.beginPath(); c.arc(0, 0, 26 + Math.sin(t * 0.3) * 3, 0, 7); c.fill();
      c.strokeStyle = '#e9d5ff'; c.lineWidth = 2; c.beginPath(); c.arc(0, 0, 30, t * 0.2, t * 0.2 + 2); c.stroke();
    } else if (this.el === 'spore') {
      for (let i = 0; i < 6; i++) { c.globalAlpha = 0.55; c.fillStyle = i % 2 ? this.col : '#166534'; c.beginPath(); c.arc(Math.cos(t * 0.1 + i) * 14, Math.sin(t * 0.13 + i * 2) * 12, 12, 0, 7); c.fill(); }
    } else if (this.el === 'fire') {
      const g = c.createRadialGradient(0, 0, 2, 0, 0, 28); g.addColorStop(0, '#fff'); g.addColorStop(0.4, '#facc15'); g.addColorStop(1, '#dc2626');
      c.fillStyle = g; c.beginPath(); c.ellipse(0, 0, 28, 20, 0, 0, 7); c.fill();
    } else { // audit beam slug
      c.fillStyle = this.col; c.fillRect(-d * 40, -7, d * 70, 14); c.fillStyle = '#fff'; c.fillRect(-d * 30, -3, d * 56, 6);
      c.font = '900 14px Orbitron,Arial'; c.textAlign = 'center'; c.fillText('§986', -d * 4, -14);
    }
    c.restore();
  }
}

/* ---------------------------------------------------------------- HAZARDS
 * Placed by signature moves: CRYO wall, MYCELIA trap, BLAZE pillar. */
class Hazard {
  constructor(type, owner, x) { Object.assign(this, { type, owner, x, y: GROUND, t: 0, alive: true, hp: 3, hit: false });
    this.life = type === 'wall' ? 170 : type === 'trap' ? 420 : 52; this.col = owner.d.glow; }
  update(G, opp) {
    this.t++; if (this.t > this.life) { this.alive = false; return; }
    const hittable = !opp.isInvuln() || (G.state === 'terminate' && opp.state === 'dizzy');
    if (this.type === 'wall') {
      for (const p of projectiles) if (p.alive && p.owner !== this.owner && Math.abs(p.x - this.x) < 30 + p.r) {
        p.alive = false; this.hp--; burst(this.x, p.y, 18, ['#e0f7ff', this.col, '#fff'], { g: 0.2 }); audio.sfx('block'); popup(this.x, p.y - 30, 'BLOCKED', '#bae6fd', 18);
      }
      if (this.hp <= 0) { this.alive = false; burst(this.x, GROUND - 80, 30, ['#e0f7ff', this.col], { g: 0.4, floor: true }); }
      if (!this.hit && hittable && Math.abs(opp.x - this.x) < 42 && opp.y > GROUND - 170) {
        this.hit = true; G.resolveHit(this.owner, opp, { dmg: 5, kind: 'mid', heavy: true, hs: 16, push: 9, stop: 5, gain: 4, src: 'proj', dir: Math.sign(opp.x - this.x) || 1, el: 'cryo', move: 'sig' });
      }
    } else if (this.type === 'trap') {
      if (this.t > 30 && hittable && opp.grounded && Math.abs(opp.x - this.x) < 52) {
        this.alive = false; burst(this.x, GROUND - 20, 40, ['#4ade80', '#86efac', '#166534'], { g: 0.1, up: 4, shape: 'c' }); ring(this.x, GROUND - 20, '#4ade80', 120);
        G.resolveHit(this.owner, opp, { dmg: 9, kind: 'throw', heavy: true, launch: true, hs: 0, push: 3, stop: 8, gain: 6, src: 'proj', dir: Math.sign(opp.x - this.x) || 1, el: 'spore', move: 'sig' });
      }
    } else if (this.type === 'pillar') {
      if (this.t === 26) { audio.sfx('special', { el: 'fire' }); G.shake(10);
        if (hittable && Math.abs(opp.x - this.x) < 62) G.resolveHit(this.owner, opp, { dmg: 13, kind: 'mid', heavy: true, launch: true, hs: 0, push: 2, stop: 9, gain: 6, src: 'proj', dir: Math.sign(opp.x - this.owner.x) || 1, el: 'fire', move: 'sig' }); }
      if (this.t > 26 && this.t % 2 === 0) burst(this.x + rnd(-30, 30), GROUND - rnd(0, 300), 2, ['#facc15', '#f97316', '#fff'], { g: -0.3, lmin: 14, lmax: 24 });
    }
  }
  draw(c) {
    c.save(); const t = this.t;
    if (this.type === 'wall') {
      const h = Math.min(170, t * 14); c.globalAlpha = this.t > this.life - 20 ? (this.life - this.t) / 20 : 0.9;
      c.fillStyle = 'rgba(186,230,253,.55)'; c.strokeStyle = '#e0f7ff'; c.lineWidth = 3; c.shadowColor = this.col; c.shadowBlur = 18;
      c.beginPath(); c.moveTo(this.x - 26, GROUND); c.lineTo(this.x - 20, GROUND - h); c.lineTo(this.x, GROUND - h - 18); c.lineTo(this.x + 22, GROUND - h + 6); c.lineTo(this.x + 26, GROUND); c.closePath(); c.fill(); c.stroke();
      c.strokeStyle = 'rgba(255,255,255,.6)'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(this.x - 8, GROUND - 20); c.lineTo(this.x + 4, GROUND - h * 0.7); c.stroke();
    } else if (this.type === 'trap') {
      const armed = t > 30, blink = armed && t % 30 < 6;
      c.fillStyle = '#3f2a14'; c.fillRect(this.x - 3, GROUND - 16, 6, 16);
      c.fillStyle = blink ? '#86efac' : '#7c2d12'; c.beginPath(); c.ellipse(this.x, GROUND - 16, 16, 9, 0, Math.PI, 0); c.fill();
      if (blink) { c.shadowColor = '#4ade80'; c.shadowBlur = 20; c.fillStyle = 'rgba(74,222,128,.25)'; c.beginPath(); c.arc(this.x, GROUND - 10, 50, 0, 7); c.fill(); }
    } else {
      if (t < 26) { const a = 0.3 + 0.5 * Math.abs(Math.sin(t * 0.4)); c.fillStyle = `rgba(249,115,22,${a})`; c.beginPath(); c.ellipse(this.x, GROUND + 4, 62, 12, 0, 0, 7); c.fill(); }
      else { const k = 1 - (t - 26) / 26, g = c.createLinearGradient(0, GROUND - 420, 0, GROUND);
        g.addColorStop(0, 'rgba(250,204,21,0)'); g.addColorStop(0.4, '#f97316'); g.addColorStop(1, '#fff7ed');
        c.globalAlpha = k; c.shadowColor = '#f97316'; c.shadowBlur = 40; c.fillStyle = g; c.fillRect(this.x - 46 * k - 10, GROUND - 420, 92 * k + 20, 420); }
    }
    c.restore();
  }
}

/* ---------------------------------------------------------------- FIGHTER */
const POSE_KEYS = ['hipX', 'hipY', 'shX', 'shY', 'hdX', 'hdY', 'bEx', 'bEy', 'bHx', 'bHy', 'fEx', 'fEy', 'fHx', 'fHy', 'bKx', 'bKy', 'bFx', 'bFy', 'fKx', 'fKy', 'fFx', 'fFy', 'rot'];
class Fighter {
  constructor(idx, data, x, facing, pad, alt = false) {
    this.idx = idx; this.alt = alt; this.d = alt && data.alt ? Object.assign({}, data, data.alt) : data; this.pad = pad; this.scale = data.boss ? 1.3 : 1.18;
    const s = data.stats; this.pow = s.power / 90; this.spd = s.speed / 90; this.def = s.defense / 90;
    this.rounds = 0; this.reset(x, facing);
  }
  reset(x, facing) {
    Object.assign(this, { x, y: GROUND, vx: 0, vy: 0, facing, hp: 100, shownHp: 100, meter: 40, state: 'idle', f: 0, move: null, hasHit: false,
      crouch: false, air: false, airUsed: false, stun: 0, freeze: 0, poison: 0, burn: 0, combo: 0, comboT: 0, juggle: 0, t: Math.random() * 10,
      lastTap: { dir: 0, t: -99 }, frame: 0, dmgTaken: 0, invuln: 0, trail: [], deleted: 0, flash: 0, projCd: 0, oc: false, sigT: 0 });
    this.pose = this.targetPose(); this.pad && this.pad.clear();
  }
  get grounded() { return this.y >= GROUND; }
  get hurtTop() { return this.y - (this.crouch && this.grounded ? 96 : 150) * this.scale; }
  canAct() { return this.freeze <= 0 && ['idle', 'walk', 'crouch', 'block'].includes(this.state) && this.grounded; }
  isInvuln() { return this.invuln > 0 || ['knockdown', 'getup', 'ko', 'deleted', 'grabbed', 'victory'].includes(this.state) || (this.state === 'tele' && this.f < 14) || this.state === 'breaker' || (this.state === 'sig' && this.d.sig.type === 'cyclone' && this.f < 8) || this.juggle >= 4; }
  addMeter(v) { this.meter = clamp(this.meter + v, 0, 100); }

  start(state, move) {
    this.state = state; this.move = move || null; this.f = 0; this.hasHit = false;
    if (move && MOVES[move] && MOVES[move].cost) this.meter -= MOVES[move].cost;
  }

  /* ---------------- per-frame logic ---------------- */
  update(opp, G) {
    this.t += 0.12; this.frame++; this.f++;
    if (this.flash > 0) this.flash--;
    if (this.invuln > 0) this.invuln--;
    if (this.projCd > 0) this.projCd--;
    if (this.comboT > 0 && --this.comboT === 0) this.combo = 0;
    if (G.state === 'fight') this.addMeter(0.045);
    // damage over time (never finishes a fighter during TERMINATE)
    if ((this.poison > 0 || this.burn > 0) && G.state === 'fight' && this.hp > 1) {
      const d = (this.poison > 0 ? 0.06 : 0) + (this.burn > 0 ? 0.09 : 0);
      this.hp = Math.max(1, this.hp - d);
      if (this.frame % 6 === 0) burst(this.x + rnd(-20, 20), this.y - rnd(30, 140), 1, this.poison > 0 ? ['#4ade80', '#86efac'] : ['#f97316', '#facc15'], { g: -0.15, smin: 0.5, smax: 1.5, shape: 'c', lmin: 20, lmax: 30 });
    }
    if (this.poison > 0) this.poison--; if (this.burn > 0) this.burn--;

    const P = this.pad, fwd = Math.sign(opp.x - this.x) || this.facing;
    // OVERCLOCK: below 25% health, +12% damage
    if (G.state === 'fight' && !this.oc && this.hp > 0 && this.hp < 25) { this.oc = true; popup(this.x, this.y - 210, 'OVERCLOCK', '#ff3b5c', 26); audio.sfx('overclock'); }
    if (this.oc && this.frame % 4 === 0 && !['ko', 'deleted', 'dizzy'].includes(this.state)) particles.push(new Particle({ x: this.x + rnd(-26, 26), y: this.y - rnd(0, 170), vx: 0, vy: rnd(-2, -0.5), size: rnd(2, 4), color: '#ff3b5c', life: 22, g: 0, shape: 'c' }));
    // ION BREAKER: block + kick while being hit (50 ION)
    if (['hitstun', 'blockstun', 'launched'].includes(this.state) && G.state === 'fight' && this.meter >= 50 && P.press('kick') && (P.held.block || P.bl.kick)) {
      P.use('kick'); this.meter -= 50; this.start('breaker'); this.vx = 0; this.freeze = 0; G.breaker(this, opp); return this.physics(G);
    }
    if (this.freeze > 0) { this.freeze--; this.vx *= 0.7; this.physics(G); return; }

    switch (this.state) {
      case 'idle': case 'walk': case 'crouch': case 'block': this.neutral(opp, G, P, fwd); break;
      case 'jump':
        if (!this.airUsed && P.press('kick')) { P.use('kick'); this.airUsed = true; this.start('jump', 'airkick'); this.state = 'jump'; audio.sfx('whoosh', { p: 700 }); }
        else if (!this.airUsed && P.press('punch')) { P.use('punch'); this.airUsed = true; this.start('jump', 'airpunch'); this.state = 'jump'; audio.sfx('whoosh', { p: 1100 }); }
        if (this.move) this.activeCheck(opp, G);
        break;
      case 'attack':
        this.activeCheck(opp, G);
        if (this.state !== 'attack') break; // parried
        if (this.move === 'uplink' && this.f === 6) { this.vy = -5; }
        if (this.f >= MOVES[this.move].total) this.toNeutral();
        break;
      case 'special':
        if (this.f === MOVES.special.spawn) { projectiles.push(new Projectile(this)); }
        if (this.f >= MOVES.special.total) this.toNeutral();
        break;
      case 'tele':
        if (this.f === 1) { audio.sfx('tele'); burst(this.x, this.y - 80, 26, [this.d.glow, '#fff'], { g: 0, lmin: 14, lmax: 24 }); }
        if (this.f === 13) {
          const side = Math.sign(opp.x - this.x) || 1; let nx = opp.x + side * 92;
          if (nx < WALL_L || nx > WALL_R) nx = opp.x - side * 92;
          this.x = clamp(nx, WALL_L, WALL_R); this.y = GROUND; this.facing = Math.sign(opp.x - this.x) || 1;
          burst(this.x, this.y - 80, 22, [this.d.glow, '#fff'], { g: 0, lmin: 12, lmax: 22 });
        }
        if (this.f >= 13) this.activeCheck(opp, G, 'tele');
        if (this.state === 'tele' && this.f >= MOVES.tele.total) this.toNeutral();
        break;
      case 'surge':
        if (this.f >= MOVES.surge.a0 && this.f <= MOVES.surge.a1) G.surgeBeam(this, opp);
        if (this.f >= MOVES.surge.total) this.toNeutral();
        break;
      case 'sig': this.sigUpdate(opp, G); break;
      case 'breaker': this.vy = Math.min(this.vy, 0); if (this.f >= 22) this.toNeutral(); break;
      case 'hitstun': if (this.f >= this.stun) this.toNeutral(); break;
      case 'blockstun': if (this.f >= this.stun) { this.state = 'block'; this.f = 0; } break;
      case 'dash': if (this.f >= 12) { this.vx = 0; this.toNeutral(); } break;
      case 'launched': break; // resolved on landing
      case 'knockdown': if (this.f >= 38) { this.start('getup'); } break;
      case 'getup': if (this.f >= 18) { this.invuln = 8; this.toNeutral(); } break;
      case 'grabbed': if (this.f >= 18) { this.state = 'launched'; this.f = 0; } break;
      case 'dizzy': this.vx = 0; break;
    }
    this.physics(G);
    if (['idle', 'walk', 'crouch', 'block', 'blockstun', 'dizzy'].includes(this.state) && this.grounded) this.facing = fwd;
  }

  neutral(opp, G, P, fwd) {
    const close = Math.abs(opp.x - this.x) < 96 && opp.grounded;
    if (P.press('surge') && this.meter >= 100) { P.use('surge'); this.start('surge', 'surge'); this.vx = 0; G.startSurge(this); return; }
    if (P.press('tele') && this.meter >= MOVES.tele.cost) { P.use('tele'); this.start('tele', 'tele'); this.vx = 0; return; }
    if (P.press('special') && (P.held.down || P.dn.special) && this.meter >= MOVES.sig.cost && !(this.d.sig.type === 'trap' && hazards.some(h => h.owner === this && h.type === 'trap'))) {
      P.use('special'); this.start('sig', 'sig'); this.vx = 0; this.crouch = false; audio.sfx('sig'); popup(this.x, this.y - 220 * this.scale, this.d.sig.name, this.d.glow, 22); return;
    }
    if (P.press('special') && this.meter >= MOVES.special.cost && this.projCd <= 0 && !projectiles.some(p => p.owner === this)) {
      P.use('special'); this.start('special', 'special'); this.vx = 0; this.projCd = 20; audio.sfx('special', { el: this.d.element }); return;
    }
    const dP = P.held.down || P.dn.punch, dK = P.held.down || P.dn.kick;
    if (P.press('punch') && (P.held.block || P.bl.punch) && close) { P.use('punch'); this.start('attack', 'grab'); this.vx = 0; audio.sfx('whoosh', { p: 500 }); return; }
    if (P.press('punch')) { P.use('punch'); this.vx = 0; this.start('attack', dP ? 'sweep' : 'punch'); this.crouch = dP; audio.sfx('whoosh', { p: dP ? 600 : 1200 }); return; }
    if (P.press('kick')) { P.use('kick'); this.vx = 0; this.start('attack', dK ? 'uplink' : 'kick'); this.crouch = false; audio.sfx('whoosh', { p: dK ? 400 : 800 }); return; }
    if (P.held.up && !P.held.block) {
      const dir = P.held.right ? 1 : P.held.left ? -1 : 0;
      this.vy = -17.5; this.vx = dir * 5.2 * this.spd; this.y -= 1; this.start('jump'); this.airUsed = false; this.crouch = false; audio.sfx('jump'); return;
    }
    // double-tap dash
    for (const [k, d] of [['left', -1], ['right', 1]]) {
      if (P.press(k)) {
        if (this.lastTap.dir === d && this.frame - this.lastTap.t < 14) {
          P.use(k); this.lastTap.t = -99; this.start('dash'); this.vx = d * (d === fwd ? 13 : 11) * this.spd; this.invuln = d !== fwd ? 6 : 0;
          audio.sfx('dash'); burst(this.x - d * 20, this.y - 10, 8, ['#9fb7cf', '#ffffff'], { g: -0.05, smin: 1, smax: 3, shape: 'c' }); return;
        }
        this.lastTap = { dir: d, t: this.frame }; P.use(k);
      }
    }
    this.crouch = P.held.down;
    if (P.held.block) { this.vx = 0; if (this.state !== 'block') { this.state = 'block'; this.f = 0; } return; }
    if (this.crouch) { this.vx = 0; this.state = 'crouch'; return; }
    const dir = P.held.right ? 1 : P.held.left ? -1 : 0;
    if (dir) { this.vx = dir * (dir === fwd ? 5.4 : 4.3) * this.spd; this.state = 'walk'; }
    else { this.vx = 0; this.state = 'idle'; }
  }

  sigUpdate(opp, G) {
    const type = this.d.sig.type, f = this.f, dir = this.facing;
    const hitBox = (x0, x1, y0, y1, h) => {
      if (this.hasHit) return; const hittable = !opp.isInvuln() || (G.state === 'terminate' && opp.state === 'dizzy'); if (!hittable) return;
      const s = this.scale, a = this.x + dir * x0 * s, b = this.x + dir * x1 * s, L = Math.min(a, b), R = Math.max(a, b);
      if (R < opp.x - 30 || L > opp.x + 30 || this.y + y1 * s < opp.hurtTop || this.y + y0 * s > opp.y) return;
      this.hasHit = true; G.resolveHit(this, opp, Object.assign({ src: 'melee', dir, el: this.d.element, move: 'sig', heavy: true, hs: 18, push: 7, stop: 8, gain: 6 }, h));
    };
    switch (type) {
      case 'cyclone': // rising spinning axe: invulnerable start, launches
        if (f === 3) { this.vy = -14; this.vx = dir * 3.5; }
        if (f >= 4 && f <= 24) { hitBox(-50, 96, -240, -10, { dmg: 12, kind: 'mid', launch: true }); if (f % 3 === 0) burst(this.x, this.y - 100, 3, [this.d.glow, '#fff'], { g: 0, smin: 3, smax: 7 }); }
        if (f > 10 && this.grounded) (this.state === 'sig' && this.toNeutral());
        break;
      case 'drop': // leap above the rival, dive, shockwave on landing
        if (f === 2) { this.vy = -17; this.vx = clamp((opp.x - this.x) / 34, -11, 11); }
        if (f === 22) { this.vy = 24; this.vx = clamp((opp.x - this.x) / 9, -14, 14); }
        if (f > 22 && !this.grounded) hitBox(-20, 70, -90, 0, { dmg: 10, kind: 'overhead' });
        if (f > 22 && this.grounded && !this.landed) {
          this.landed = true; this.vx = 0; G.shake(12); ring(this.x, GROUND - 6, this.d.glow, 160, 8); audio.sfx('heavy');
          burst(this.x, GROUND - 6, 26, [this.d.glow, '#fff'], { g: 0.3, up: 3 });
          if (!this.hasHit && opp.grounded && Math.abs(opp.x - this.x) < 160 && !opp.isInvuln()) { this.hasHit = true; G.resolveHit(this, opp, { src: 'proj', dir: Math.sign(opp.x - this.x) || 1, el: this.d.element, move: 'sig', heavy: true, dmg: 11, kind: 'low', knock: true, hs: 0, push: 6, stop: 8, gain: 6 }); }
        }
        if (this.landed && (this.sigT = (this.sigT || 0) + 1) > 12) { this.landed = false; this.sigT = 0; (this.state === 'sig' && this.toNeutral()); }
        break;
      case 'wall':
        if (f === 10) { hazards = hazards.filter(h => !(h.owner === this && h.type === 'wall')); hazards.push(new Hazard('wall', this, clamp(this.x + dir * 110, WALL_L, WALL_R))); audio.sfx('special', { el: 'cryo' }); }
        if (f >= MOVES.sig.total) (this.state === 'sig' && this.toNeutral());
        break;
      case 'swap':
        if (f === 8 && opp.state !== 'deleted') {
          const a = this.x; this.x = opp.x; opp.x = a; this.facing = Math.sign(opp.x - this.x) || 1;
          burst(this.x, this.y - 90, 24, [this.d.glow, '#000'], { g: 0 }); burst(opp.x, opp.y - 90, 24, [this.d.glow, '#000'], { g: 0 });
          if (!opp.isInvuln() && opp.grounded && ['idle', 'walk', 'crouch', 'block', 'attack', 'special'].includes(opp.state)) { opp.state = 'hitstun'; opp.f = 0; opp.stun = 24; opp.move = null; popup(opp.x, opp.y - 200, 'SWAPPED', '#c084fc', 20); }
          audio.sfx('tele');
        }
        if (f >= 22) (this.state === 'sig' && this.toNeutral());
        break;
      case 'trap':
        if (f === 10) { hazards.push(new Hazard('trap', this, clamp(this.x + dir * 170, WALL_L, WALL_R))); audio.sfx('special', { el: 'spore' }); }
        if (f >= MOVES.sig.total) (this.state === 'sig' && this.toNeutral());
        break;
      case 'pillar':
        if (f === 8) hazards.push(new Hazard('pillar', this, opp.x));
        if (f >= MOVES.sig.total) (this.state === 'sig' && this.toNeutral());
        break;
      case 'seize': // command grab with long reach, steals ION
        if (f >= 5 && f <= 9 && !this.hasHit && opp.grounded && !opp.isInvuln() && Math.abs(opp.x - this.x) < 140 && !['hitstun', 'launched'].includes(opp.state)) {
          this.hasHit = true; const steal = Math.min(35, opp.meter); opp.meter -= steal; this.addMeter(steal);
          popup(opp.x, opp.y - 200, `SEIZED ${steal | 0} ION`, '#ffd166', 20); audio.sfx('grab');
          G.resolveHit(this, opp, { src: 'melee', dir, el: 'audit', move: 'sig', heavy: true, dmg: 14, kind: 'throw', knock: true, hs: 0, push: 6, stop: 10, gain: 4 });
        }
        if (f >= 30) (this.state === 'sig' && this.toNeutral());
        break;
    }
  }

  toNeutral() { this.landed = false; this.sigT = 0; this.move = null; this.f = 0; this.state = this.grounded ? 'idle' : 'jump'; if (!this.grounded) this.airUsed = true; }

  physics(G) {
    if (this.state === 'grabbed') return;
    const cine = G.cinematic > 0;
    if (cine && this.state !== 'surge') return;
    this.x += this.vx; this.y += this.vy;
    if (this.y < GROUND) { this.vy += this.state === 'launched' ? 0.75 : 0.9; }
    else if (this.vy >= 0 && this.y >= GROUND) {
      const wasAir = this.y > GROUND || this.vy > 0;
      this.y = GROUND; this.vy = 0;
      if (this.state === 'launched') {
        this.vx = 0; this.juggle = 0; burst(this.x, GROUND, 10, ['#5c7a99', '#a9c1d9'], { g: 0.2, smin: 1, smax: 4, up: 2 }); audio.sfx('land');
        G.shake(6); this.start(this.hp <= 0 ? 'ko' : 'knockdown');
      } else if (this.state === 'jump' && wasAir) { this.vx = 0; this.move = null; this.state = 'idle'; this.f = 0; audio.sfx('land'); }
      if (['hitstun', 'blockstun', 'dash', 'attack'].includes(this.state)) this.vx *= 0.82;
    }
    if (['hitstun', 'blockstun'].includes(this.state)) this.vx *= 0.86;
    if (this.state === 'knockdown' || this.state === 'ko' || this.state === 'getup') this.vx *= 0.8;
    this.x = clamp(this.x, WALL_L, WALL_R);
    if (['dash', 'tele', 'surge', 'sig', 'breaker'].includes(this.state)) { if (this.frame % 2 === 0) this.trail.push({ x: this.x, y: this.y, pose: Object.assign({}, this.pose), facing: this.facing, a: 0.45 }); }
    this.trail.forEach(t => t.a -= 0.05); this.trail = this.trail.filter(t => t.a > 0);
  }

  activeCheck(opp, G, override) {
    const m = MOVES[override || this.move]; if (!m || this.hasHit) return;
    if (this.f < m.a0 || this.f > m.a1) return;
    if (opp.isInvuln() && !(G.state === 'terminate' && opp.state === 'dizzy')) return;
    const s = this.scale, xa = this.x + this.facing * m.x0 * s, xb = this.x + this.facing * m.x1 * s;
    const L = Math.min(xa, xb), R = Math.max(xa, xb), T = this.y + m.y0 * s, B = this.y + m.y1 * s;
    if (R < opp.x - 30 || L > opp.x + 30 || B < opp.hurtTop || T > opp.y) return;
    if (m.kind === 'throw') {
      if (!opp.grounded || ['hitstun', 'launched', 'attack', 'special', 'surge', 'tele'].includes(opp.state)) return;
      this.hasHit = true; G.doGrab(this, opp); return;
    }
    this.hasHit = true;
    G.resolveHit(this, opp, { ...m, move: override || this.move, src: 'melee', dir: this.facing, el: this.d.element });
  }

  /* ---------------- pose & render ---------------- */
  targetPose() {
    const t = this.t, br = Math.sin(t) * 2.5, sw = Math.sin(t * 2.2);
    const P = { hipX: 0, hipY: -76 + br * 0.4, shX: 4, shY: -130 + br, hdX: 7, hdY: -152 + br, bEx: -12, bEy: -104, bHx: 14, bHy: -120, fEx: 22, fEy: -104, fHx: 38, fHy: -124,
      bKx: -16, bKy: -40, bFx: -26, bFy: 0, fKx: 18, fKy: -40, fFx: 28, fFy: 0, rot: 0 };
    const crouchify = () => Object.assign(P, { hipY: -44, shX: 12, shY: -94, hdX: 18, hdY: -116, bEx: -2, bEy: -72, bHx: 22, bHy: -86, fEx: 30, fEy: -74, fHx: 44, fHy: -92,
      bKx: -30, bKy: -26, bFx: -30, bFy: 0, fKx: 34, fKy: -30, fFx: 30, fFy: 0 });
    const mf = this.f, st = this.state;
    switch (st) {
      case 'walk': Object.assign(P, { bKx: -14 - sw * 14, bFx: -22 - sw * 24, fKx: 16 + sw * 14, fFx: 24 + sw * 24, bFy: sw > 0 ? -6 * sw : 0, fFy: sw < 0 ? 6 * sw : 0 }); break;
      case 'crouch': crouchify(); break;
      case 'block':
        if (this.crouch) { crouchify(); Object.assign(P, { bEx: 18, bEy: -84, bHx: 26, bHy: -112, fEx: 26, fEy: -80, fHx: 30, fHy: -108 }); }
        else Object.assign(P, { bEx: 20, bEy: -112, bHx: 28, bHy: -146, fEx: 28, fEy: -108, fHx: 32, fHy: -142, shX: -2, hdX: 2 });
        break;
      case 'blockstun':
        if (this.crouch) { crouchify(); Object.assign(P, { bEx: 18, bEy: -84, bHx: 26, bHy: -112, fEx: 26, fEy: -80, fHx: 30, fHy: -108, shX: 4 }); }
        else Object.assign(P, { bEx: 16, bEy: -112, bHx: 24, bHy: -146, fEx: 24, fEy: -108, fHx: 28, fHy: -142, shX: -8, hdX: -4 });
        break;
      case 'jump': {
        Object.assign(P, { hipY: -84, bKx: -10, bKy: -60, bFx: -30, bFy: -34, fKx: 24, fKy: -66, fFx: 14, fFy: -30 });
        if (this.move === 'airkick' && mf >= 3) Object.assign(P, { fKx: 34, fKy: -62, fFx: 84, fFy: -34, shX: -6, hdX: -2, bEx: -24, bEy: -112, bHx: -36, bHy: -130 });
        if (this.move === 'airpunch' && mf >= 2) Object.assign(P, { fEx: 40, fEy: -112, fHx: 82, fHy: -96 });
        break;
      }
      case 'attack': {
        const m = MOVES[this.move], act = mf >= m.a0 - 2 && mf <= m.a1 + 3;
        if (this.move === 'punch') { if (act) Object.assign(P, { shX: 12, hdX: 16, fEx: 46, fEy: -124, fHx: 92, fHy: -124, bEx: -6, bEy: -108, bHx: 8, bHy: -118 }); }
        else if (this.move === 'kick') { if (act) Object.assign(P, { shX: -10, hdX: -6, fKx: 46, fKy: -100, fFx: 118, fFy: -110, bKx: -10, bKy: -38, bFx: -18, bFy: 0, bEx: -26, bEy: -112, bHx: -40, bHy: -96 }); else Object.assign(P, { fKx: 30, fKy: -66, fFx: 32, fFy: -30 }); }
        else if (this.move === 'sweep') { crouchify(); if (act) Object.assign(P, { fKx: 56, fKy: -16, fFx: 124, fFy: -6, bKx: -24, bKy: -30, hdX: 4, shX: -2 }); }
        else if (this.move === 'uplink') { if (act) Object.assign(P, { hipY: -84, shY: -142, hdY: -164, shX: 10, hdX: 12, fEx: 30, fEy: -168, fHx: 44, fHy: -214, fKx: 26, fKy: -54, fFx: 22, fFy: -12 }); else crouchify(); }
        else if (this.move === 'grab') Object.assign(P, { shX: 12, hdX: 16, fEx: 48, fEy: -112, fHx: 78, fHy: -118, bEx: 40, bEy: -100, bHx: 72, bHy: -104 });
        break;
      }
      case 'special': { const a = mf > 6; Object.assign(P, { shX: a ? 14 : -4, hdX: a ? 16 : 0, fEx: a ? 48 : 10, fEy: -118, fHx: a ? 86 : 0, fHy: -120, bEx: a ? 40 : -10, bEy: -110, bHx: a ? 78 : -4, bHy: -112, fKx: 30, fFx: 44, bFx: -36 }); break; }
      case 'sig': {
        const ty = this.d.sig.type;
        if (ty === 'cyclone') { const a = this.t * 9; Object.assign(P, { fEx: Math.cos(a) * 40, fEy: -130 + Math.sin(a) * 10, fHx: Math.cos(a) * 80, fHy: -150, bEx: -Math.cos(a) * 40, bEy: -128, bHx: -Math.cos(a) * 78, bHy: -146, fKx: 16, fKy: -54, fFx: 8, fFy: -14, bKx: -12, bKy: -50, bFx: -18, bFy: -10 }); }
        else if (ty === 'drop') { if (mf > 22) Object.assign(P, { fKx: 34, fKy: -50, fFx: 60, fFy: -4, bKx: -20, bKy: -70, bFx: -40, bFy: -50, fEx: 30, fEy: -150, fHx: 40, fHy: -190, bEx: -20, bEy: -150, bHx: -26, bHy: -190 });
          else Object.assign(P, { hipY: -84, bKx: -10, bKy: -60, bFx: -30, bFy: -34, fKx: 24, fKy: -66, fFx: 14, fFy: -30, fEx: 10, fEy: -170, fHx: 20, fHy: -210, bEx: -10, bEy: -168, bHx: 0, bHy: -210 }); }
        else if (ty === 'seize') Object.assign(P, { shX: 16, hdX: 18, fEx: 56, fEy: -116, fHx: 112, fHy: -120, bEx: 44, bEy: -104, bHx: 96, bHy: -100, fKx: 34, fFx: 52, bFx: -40 });
        else if (ty === 'trap' || ty === 'pillar') { crouchify(); Object.assign(P, { fEx: 40, fEy: -60, fHx: 70, fHy: -10, bEx: 20, bEy: -64, bHx: 50, bHy: -14 }); }
        else Object.assign(P, { shX: 12, hdX: 14, fEx: 46, fEy: -128, fHx: 80, fHy: -140, bEx: 38, bEy: -112, bHx: 70, bHy: -118, fKx: 30, fFx: 44, bFx: -36 });
        break;
      }
      case 'breaker': Object.assign(P, { fEx: 40, fEy: -160, fHx: 70, fHy: -196, bEx: -40, bEy: -160, bHx: -70, bHy: -196, fKx: 30, fFx: 46, bKx: -30, bFx: -46, hdY: -156 }); break;
      case 'tele': Object.assign(P, { shX: 10, hdX: 14, fKx: 46, fKy: -96, fFx: 112, fFy: -112, bEx: -24, bEy: -112, bHx: -40, bHy: -96 }); break;
      case 'surge': { const charge = mf < MOVES.surge.freeze; Object.assign(P, charge ? { fEx: 10, fEy: -170, fHx: 20, fHy: -210, bEx: -10, bEy: -168, bHx: 0, bHy: -210, hdY: -150, bKx: -30, bFx: -40, fKx: 30, fFx: 40 }
        : { shX: 14, hdX: 16, fEx: 50, fEy: -116, fHx: 94, fHy: -116, bEx: 48, bEy: -106, bHx: 90, bHy: -108, bKx: -30, bFx: -44, fKx: 32, fFx: 48 }); break; }
      case 'hitstun': Object.assign(P, { shX: -14, hdX: -16, hdY: -146, fEx: 4, fEy: -104, fHx: 18, fHy: -96, bEx: -26, bEy: -104, bHx: -30, bHy: -86 }); break;
      case 'dash': Object.assign(P, { shX: 14 * Math.sign(this.vx * this.facing), hdX: 18 * Math.sign(this.vx * this.facing), bKx: -26, bFx: -40, fKx: 28, fFx: 36 }); break;
      case 'grabbed': case 'launched': Object.assign(P, { shX: -16, hdX: -22, hdY: -144, fEx: 10, fEy: -150, fHx: 18, fHy: -176, bEx: -20, bEy: -150, bHx: -26, bHy: -174, fKx: 20, fKy: -50, fFx: 30, fFy: -18, rot: st === 'launched' ? -0.5 : 0 }); break;
      case 'knockdown': case 'ko': case 'deleted': Object.assign(P, { rot: -Math.PI / 2, hipY: -60, shY: -116, hdY: -140 }); break;
      case 'getup': crouchify(); break;
      case 'dizzy': Object.assign(P, { shX: Math.sin(t * 1.4) * 10, hdX: Math.sin(t * 1.4) * 14, fHx: 12, fHy: -80, bHx: -10, bHy: -80, fEx: 14, fEy: -100, bEx: -12, bEy: -100 }); break;
      case 'victory': Object.assign(P, { fEx: 20, fEy: -170, fHx: 26, fHy: -212, bEx: -18, bEy: -106, bHx: 2, bHy: -88, hdY: -154 + Math.sin(t * 2) * 2 }); break;
    }
    return P;
  }
  updatePose() {
    const T = this.targetPose(), k = ['knockdown', 'ko', 'deleted'].includes(this.state) ? 0.2 : 0.42;
    POSE_KEYS.forEach(key => { this.pose[key] = lerp(this.pose[key], T[key], k); });
  }

  draw(c, G) {
    if (this.state === 'deleted' && this.deleted > 60) return;
    const vanished = this.state === 'tele' && this.f >= 3 && this.f < 13;
    // ground shadow
    c.save(); c.fillStyle = 'rgba(0,0,0,.5)'; c.beginPath();
    c.ellipse(this.x, GROUND + 4, 44 * this.scale * clamp(1 - (GROUND - this.y) / 400, 0.4, 1), 10, 0, 0, 7); c.fill(); c.restore();
    if (vanished) return;
    // afterimages
    this.trail.forEach(tr => this.renderBody(c, tr.x, tr.y, tr.facing, tr.pose, { ghost: tr.a }));
    const opts = {};
    if (this.flash > 0 && this.flash % 4 < 2 && !SAVE.settings.reduceFlash) opts.white = true;
    if (this.state === 'deleted') opts.derez = this.deleted;
    this.renderBody(c, this.x, this.y, this.facing, this.pose, opts);
    // status overlays
    if (this.freeze > 0) {
      c.save(); c.fillStyle = 'rgba(125,211,252,.33)'; c.strokeStyle = '#e0f7ff'; c.lineWidth = 2;
      const top = this.y - 170 * this.scale; c.fillRect(this.x - 42, top, 84, this.y - top); c.strokeRect(this.x - 42, top, 84, this.y - top); c.restore();
    }
    if (this.state === 'dizzy') {
      for (let s = 0; s < 3; s++) {
        const a = this.t * 2.4 + s * 2.09; c.fillStyle = s === 1 ? '#00c6ff' : '#ffd166';
        c.font = '900 16px Orbitron,Arial'; c.textAlign = 'center'; c.fillText(['0', '1', '0'][s], this.x + Math.cos(a) * 30, this.y - 190 * this.scale + Math.sin(a) * 8);
      }
    }
  }

  renderBody(c, x, y, facing, P, o = {}) {
    const d = this.d, s = this.scale;
    c.save(); c.translate(x, y); c.scale(facing * s, s);
    if (o.ghost) { c.globalAlpha = o.ghost; c.filter = 'none'; }
    if (P.rot) { c.translate(0, -16); c.rotate(P.rot); }
    const col = (v) => o.white ? '#ffffff' : (o.ghost ? d.glow : v);
    if (o.derez) c.globalAlpha = clamp(1 - o.derez / 60, 0, 1);
    if (['surge', 'special', 'sig', 'breaker'].includes(this.state) || (this.meter >= 100 && G_STATE_FIGHT())) { c.shadowColor = d.glow; c.shadowBlur = this.state === 'surge' || this.state === 'breaker' ? 30 : 14; }
    if (this.oc && !o.ghost && !o.white && this.frame % 20 < 10) { c.shadowColor = '#ff3b5c'; c.shadowBlur = 18; }
    c.lineCap = 'round'; c.lineJoin = 'round';
    const limb = (x1, y1, x2, y2, x3, y3, w, cu, cl) => {
      c.strokeStyle = '#03070d'; c.lineWidth = w + 5; c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.lineTo(x3, y3); c.stroke();
      c.strokeStyle = col(cu); c.lineWidth = w; c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.stroke();
      c.strokeStyle = col(cl); c.lineWidth = w * 0.86; c.beginPath(); c.moveTo(x2, y2); c.lineTo(x3, y3); c.stroke();
      c.fillStyle = col(cl); c.beginPath(); c.arc(x3, y3, w * 0.55, 0, 7); c.fill();
    };
    // cape / cloak (NULL, MYCELIA, AUDITOR)
    if (['null', 'mycelia', 'auditor'].includes(d.id)) {
      const wv = Math.sin(this.t * 1.6) * 6;
      c.fillStyle = col(d.id === 'mycelia' ? '#3f2a14' : d.c2); c.beginPath(); c.moveTo(P.shX - 18, P.shY); c.quadraticCurveTo(P.shX - 44, P.hipY, P.hipX - 46 + wv, -10);
      c.lineTo(P.hipX - 6, -18); c.lineTo(P.shX + 6, P.shY); c.closePath(); c.fill();
    }
    limb(P.hipX - 6, P.hipY, P.bKx, P.bKy, P.bFx, P.bFy, 15, d.c3, d.c2);                     // back leg
    limb(P.shX - 8, P.shY + 4, P.bEx, P.bEy, P.bHx, P.bHy, 12, d.c2, d.skin === '#2a2238' ? d.c1 : d.skin); // back arm
    // torso
    c.fillStyle = col(d.c3); c.strokeStyle = '#03070d'; c.lineWidth = 3;
    c.beginPath(); c.moveTo(P.shX - 22, P.shY - 4); c.lineTo(P.shX + 22, P.shY - 4); c.lineTo(P.hipX + 16, P.hipY + 6); c.lineTo(P.hipX - 16, P.hipY + 6); c.closePath(); c.fill(); c.stroke();
    // armour plate
    c.fillStyle = col(d.c1); c.beginPath(); c.moveTo(P.shX - 20, P.shY - 2); c.lineTo(P.shX + 20, P.shY - 2);
    c.lineTo((P.shX + P.hipX) / 2 + 14, (P.shY + P.hipY) / 2 + 4); c.lineTo((P.shX + P.hipX) / 2 - 14, (P.shY + P.hipY) / 2 + 4); c.closePath(); c.fill(); c.stroke();
    if (d.id === 'auditor') { c.fillStyle = col('#ffd166'); c.fillRect(P.shX - 30, P.shY - 8, 20, 10); c.fillRect(P.shX + 10, P.shY - 8, 20, 10); }
    // emblem
    c.save(); c.translate((P.shX + P.hipX) / 2, (P.shY + P.hipY) / 2 - 12); c.scale(1, 1);
    c.fillStyle = o.white ? '#000' : d.c3; c.font = `900 ${d.emblem.length > 2 ? 9 : 12}px Orbitron,Arial`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(d.emblem, 0, 0); c.restore();
    // belt
    c.fillStyle = col(d.c2); c.fillRect(P.hipX - 17, P.hipY - 3, 34, 8); c.fillStyle = col(d.glow); c.fillRect(P.hipX - 4, P.hipY - 3, 8, 8);
    limb(P.hipX + 6, P.hipY, P.fKx, P.fKy, P.fFx, P.fFy, 16, d.c3, d.c1);                     // front leg
    this.drawHead(c, P.hdX, P.hdY, col, o);
    limb(P.shX + 8, P.shY + 4, P.fEx, P.fEy, P.fHx, P.fHy, 13, d.c1, d.skin === '#2a2238' ? d.c1 : d.skin); // front arm
    // weapon/hand details
    if (d.id === 'ioman' && !o.ghost) { // mini ion axe on the back hand
      c.save(); c.translate(P.bHx, P.bHy); c.rotate(-0.4); c.fillStyle = col('#cfd8e3'); c.fillRect(-2, -26, 4, 34); c.fillStyle = col(d.c1);
      c.beginPath(); c.moveTo(2, -26); c.quadraticCurveTo(18, -20, 14, -6); c.lineTo(2, -10); c.closePath(); c.fill(); c.restore();
    }
    if (d.id === 'volta' && !o.ghost && Math.random() < 0.5) { c.strokeStyle = '#fff'; c.lineWidth = 2; c.beginPath(); c.moveTo(P.fHx, P.fHy); c.lineTo(P.fHx + rnd(-10, 10), P.fHy + rnd(-14, 4)); c.stroke(); }
    c.restore();
  }

  drawHead(c, hx, hy, col, o) {
    const d = this.d;
    c.fillStyle = col(d.c3); c.strokeStyle = '#03070d'; c.lineWidth = 3;
    c.beginPath(); c.arc(hx, hy, 15, 0, 7); c.fill(); c.stroke();
    const eye = (y, w) => { c.save(); c.fillStyle = o.white ? '#000' : '#fff'; c.shadowColor = d.glow; c.shadowBlur = o.ghost ? 0 : 10; c.fillRect(hx + 3, hy + y, w, 3); c.restore(); };
    switch (d.id) {
      case 'ioman': // round helmet + cyan visor + IO antenna
        c.fillStyle = col(d.c2); c.beginPath(); c.arc(hx, hy - 2, 16, Math.PI, 0); c.fill();
        c.fillStyle = col(d.c1); c.fillRect(hx - 2, hy - 6, 18, 7); eye(-5, 12);
        c.strokeStyle = col(d.c1); c.lineWidth = 3; c.beginPath(); c.moveTo(hx - 6, hy - 16); c.lineTo(hx - 12, hy - 30); c.stroke();
        c.fillStyle = col('#ff3b5c'); c.beginPath(); c.arc(hx - 12, hy - 31, 3.5, 0, 7); c.fill(); break;
      case 'volta': // lightning crest
        c.fillStyle = col(d.c1); c.beginPath(); c.moveTo(hx - 14, hy - 8); c.lineTo(hx - 4, hy - 34); c.lineTo(hx - 2, hy - 18); c.lineTo(hx + 8, hy - 30); c.lineTo(hx + 6, hy - 10); c.closePath(); c.fill();
        c.fillStyle = col(d.c2); c.fillRect(hx - 1, hy - 6, 16, 6); eye(-5, 11); break;
      case 'cryo': // crystal crown + faceplate
        c.fillStyle = col('#e0f7ff'); for (let i = -2; i <= 2; i++) { c.beginPath(); c.moveTo(hx + i * 6 - 4, hy - 12); c.lineTo(hx + i * 6, hy - 26 - (2 - Math.abs(i)) * 5); c.lineTo(hx + i * 6 + 4, hy - 12); c.fill(); }
        c.fillStyle = col(d.c1); c.beginPath(); c.moveTo(hx - 2, hy + 1); c.lineTo(hx + 16, hy + 1); c.lineTo(hx + 12, hy + 14); c.lineTo(hx, hy + 14); c.closePath(); c.fill(); eye(-5, 10); break;
      case 'null': // hood with void face
        c.fillStyle = col(d.c2); c.beginPath(); c.moveTo(hx - 18, hy + 14); c.quadraticCurveTo(hx - 16, hy - 26, hx + 6, hy - 22); c.quadraticCurveTo(hx + 22, hy - 8, hx + 18, hy + 12); c.closePath(); c.fill();
        c.fillStyle = '#000'; c.beginPath(); c.ellipse(hx + 6, hy, 9, 11, 0, 0, 7); c.fill();
        c.save(); c.fillStyle = o.white ? '#000' : d.glow; c.shadowColor = d.glow; c.shadowBlur = 12; c.fillRect(hx + 3, hy - 3, 4, 3); c.fillRect(hx + 9, hy - 3, 4, 3); c.restore(); break;
      case 'mycelia': // mushroom cap
        c.fillStyle = col('#b91c1c'); c.beginPath(); c.ellipse(hx, hy - 10, 28, 14, 0, Math.PI, 0); c.fill(); c.stroke();
        c.fillStyle = col('#fef3c7'); [[-14, -14], [0, -19], [12, -13], [-4, -11]].forEach(([a, b]) => { c.beginPath(); c.arc(hx + a, hy + b, 3, 0, 7); c.fill(); });
        c.fillStyle = col(d.skin); c.fillRect(hx, hy - 6, 14, 10); eye(-3, 9); break;
      case 'blaze': // horned helm + flame plume
        c.fillStyle = col(d.c2); c.beginPath(); c.arc(hx, hy - 2, 16, Math.PI, 0); c.fill();
        c.fillStyle = col('#e5e7eb'); c.beginPath(); c.moveTo(hx - 12, hy - 10); c.quadraticCurveTo(hx - 24, hy - 26, hx - 14, hy - 34); c.lineTo(hx - 6, hy - 14); c.fill();
        c.beginPath(); c.moveTo(hx + 10, hy - 12); c.quadraticCurveTo(hx + 22, hy - 26, hx + 14, hy - 34); c.lineTo(hx + 4, hy - 14); c.fill();
        if (!o.ghost) { const fl = Math.sin(this.t * 6) * 4; c.fillStyle = 'rgba(249,115,22,.85)'; c.beginPath(); c.moveTo(hx - 6, hy - 16); c.quadraticCurveTo(hx - 2, hy - 40 - fl, hx + 4, hy - 16); c.fill(); }
        c.fillStyle = col(d.c1); c.fillRect(hx - 1, hy - 6, 17, 6); eye(-5, 12); break;
      case 'auditor': // tall governance helm, gold visor
        c.fillStyle = col(d.c2); c.fillRect(hx - 15, hy - 34, 30, 26); c.fillStyle = col('#ffd166'); c.fillRect(hx - 17, hy - 12, 34, 4); c.fillRect(hx - 15, hy - 34, 30, 4);
        c.fillStyle = col('#ffd166'); c.fillRect(hx - 1, hy - 6, 17, 7); eye(-5, 13); break;
    }
  }
}
function G_STATE_FIGHT() { return typeof GAME !== 'undefined' && GAME.state === 'fight'; }
