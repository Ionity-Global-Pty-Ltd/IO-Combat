
/* ------------------------------------------------------------------ ARENAS */
const BG = { t: 0, flash: 0, rain: [], leaves: [], embers: [], spores: [], stars: [] };
for (let i = 0; i < 90; i++) BG.stars.push({ x: rnd(0, W), y: rnd(0, 380), s: rnd(0.5, 2), p: rnd(0, 6) });
function drawArena(c, A) {
  BG.t += 1; const t = BG.t;
  const sky = c.createLinearGradient(0, 0, 0, GROUND); sky.addColorStop(0, A.sky[0]); sky.addColorStop(0.6, A.sky[1]); sky.addColorStop(1, A.sky[2]);
  c.fillStyle = sky; c.fillRect(0, 0, W, GROUND);
  if (A.id === 'uplink' || A.id === 'server') BG.stars.forEach(s => { c.globalAlpha = 0.35 + Math.sin(t * 0.03 + s.p) * 0.3; c.fillStyle = '#cfe8ff'; c.fillRect(s.x, s.y, s.s, s.s); }); c.globalAlpha = 1;

  if (A.id === 'server') {
    // brand sign
    c.save(); c.font = '900 92px Orbitron,Arial Black'; c.textAlign = 'center'; c.fillStyle = 'rgba(0,198,255,.10)'; c.shadowColor = '#00c6ff'; c.shadowBlur = 30;
    c.fillText('IONITY', W / 2, 170); c.font = '700 16px Orbitron,Arial'; c.fillStyle = 'rgba(0,198,255,.35)'; c.shadowBlur = 8; c.fillText('BUILDING TOMORROW, TODAY', W / 2, 200); c.restore();
    // racks
    for (let i = 0; i < 9; i++) {
      const x = 30 + i * 150, h = 330 + (i % 3) * 30, y = GROUND - h;
      c.fillStyle = '#081423'; c.fillRect(x, y, 96, h); c.strokeStyle = '#17324f'; c.lineWidth = 2; c.strokeRect(x, y, 96, h);
      for (let r = 0; r < h / 22 - 1; r++) {
        c.fillStyle = '#0c1d31'; c.fillRect(x + 6, y + 8 + r * 22, 84, 16);
        for (let l = 0; l < 4; l++) { const on = Math.sin(t * 0.08 + i * 3 + r * 1.7 + l * 2.3) > 0.3; c.fillStyle = on ? (l === 3 ? '#ff3b5c' : '#00c6ff') : '#12304d'; c.fillRect(x + 62 + l * 6, y + 14 + r * 22, 3, 3); }
      }
    }
    // overhead cables
    c.strokeStyle = '#0f2a44'; c.lineWidth = 4; for (let i = 0; i < 6; i++) { c.beginPath(); c.moveTo(i * 260 - 40, 0); c.quadraticCurveTo(i * 260 + 90, 90 + i % 2 * 30, i * 260 + 220, 0); c.stroke(); }
  } else if (A.id === 'firewall') {
    // brick firewall with flame crest
    for (let r = 0; r < 12; r++) for (let k = 0; k < 18; k++) {
      const x = k * 76 - (r % 2) * 38, y = 210 + r * 34; c.fillStyle = r % 3 === 0 ? '#2a0d07' : '#220b06'; c.fillRect(x, y, 72, 30);
      c.fillStyle = 'rgba(249,115,22,' + (0.05 + 0.05 * Math.sin(t * 0.05 + k + r)) + ')'; c.fillRect(x, y, 72, 30);
    }
    for (let x = 0; x < W; x += 22) {
      const h = 50 + Math.sin(t * 0.12 + x * 0.05) * 20 + Math.sin(t * 0.21 + x) * 8;
      const g = c.createLinearGradient(0, 210 - h, 0, 214); g.addColorStop(0, 'rgba(250,204,21,0)'); g.addColorStop(0.5, '#f97316'); g.addColorStop(1, '#b91c1c');
      c.fillStyle = g; c.beginPath(); c.moveTo(x - 4, 214); c.quadraticCurveTo(x + 11, 210 - h, x + 26, 214); c.fill();
    }
    c.font = '900 28px Orbitron,Arial'; c.fillStyle = 'rgba(255,209,102,.18)'; c.textAlign = 'center'; c.fillText('PORT 443 · DENY ALL', W / 2, 300);
    if (chance(0.5)) BG.embers.push({ x: rnd(0, W), y: GROUND, vy: rnd(-1.5, -3.5), vx: rnd(-0.5, 0.5), l: 160 });
    BG.embers.forEach(e => { e.x += e.vx; e.y += e.vy; e.l--; c.fillStyle = `rgba(253,186,116,${e.l / 160})`; c.fillRect(e.x, e.y, 3, 3); });
    BG.embers = BG.embers.filter(e => e.l > 0);
  } else if (A.id === 'forest') {
    for (let i = 0; i < 11; i++) {
      const x = i * 125 + (i % 2) * 30, w = 40 + (i % 3) * 14; c.fillStyle = i % 2 ? '#06140c' : '#0a1f13';
      c.fillRect(x, 60, w, GROUND - 60); c.fillStyle = '#0d2b1a'; c.beginPath(); c.arc(x + w / 2, 80, 110, 0, 7); c.fill();
    }
    c.font = '700 14px ui-monospace,Consolas,monospace';
    if (chance(0.35)) BG.leaves.push({ x: rnd(0, W), y: -10, v: rnd(0.8, 2), ch: chance(0.5) ? '1' : '0', p: rnd(0, 6) });
    BG.leaves.forEach(l => { l.y += l.v; l.x += Math.sin(t * 0.03 + l.p) * 0.6; c.fillStyle = 'rgba(74,222,128,.75)'; c.fillText(l.ch, l.x, l.y); });
    BG.leaves = BG.leaves.filter(l => l.y < GROUND);
    for (let i = 0; i < 14; i++) { c.fillStyle = `rgba(190,242,100,${0.4 + 0.4 * Math.sin(t * 0.06 + i)})`; c.beginPath(); c.arc((i * 97 + t * 0.4) % W, 260 + Math.sin(t * 0.02 + i) * 90, 2.2, 0, 7); c.fill(); }
  } else if (A.id === 'uplink') {
    for (let i = 0; i < 4; i++) {
      const x = 120 + i * 340; c.strokeStyle = '#1a2b4a'; c.lineWidth = 4;
      c.beginPath(); c.moveTo(x - 50, GROUND - 40); c.lineTo(x, 130); c.lineTo(x + 50, GROUND - 40); c.stroke();
      for (let k = 0; k < 6; k++) { c.beginPath(); c.moveTo(x - 50 + k * 7, GROUND - 40 - k * 70); c.lineTo(x + 50 - k * 7, GROUND - 40 - k * 70); c.stroke(); }
      c.fillStyle = (t + i * 20) % 60 < 30 ? '#ff3b5c' : '#3b0d16'; c.beginPath(); c.arc(x, 124, 6, 0, 7); c.fill();
    }
    // data sea
    c.font = '700 13px ui-monospace,Consolas,monospace';
    for (let r = 0; r < 4; r++) for (let x = 0; x < W; x += 16) {
      const y = 470 + r * 26 + Math.sin(t * 0.05 + x * 0.02 + r) * 6; c.fillStyle = `rgba(125,211,252,${0.18 + r * 0.08})`; c.fillText(((x + r + (t >> 4)) % 3) ? '~' : '1', x, y);
    }
    // bridge rails
    c.fillStyle = '#132542'; c.fillRect(0, GROUND - 46, W, 8); for (let x = 0; x < W; x += 80) c.fillRect(x, GROUND - 46, 6, 46);
    if (BG.rain.length < 120) BG.rain.push({ x: rnd(0, W + 200), y: rnd(-50, 0), v: rnd(10, 16) });
    c.strokeStyle = 'rgba(147,197,253,.28)'; c.lineWidth = 1; c.beginPath();
    BG.rain.forEach(d => { d.x -= 3; d.y += d.v; c.moveTo(d.x, d.y); c.lineTo(d.x + 3, d.y - 12); if (d.y > GROUND) { d.y = rnd(-60, 0); d.x = rnd(0, W + 200); } }); c.stroke();
  } else if (A.id === 'root') {
    c.fillStyle = '#07040c'; c.beginPath(); c.moveTo(0, 0); for (let x = 0; x <= W; x += 80) c.lineTo(x, 60 + Math.sin(x * 0.03) * 30); c.lineTo(W, 0); c.fill();
    c.strokeStyle = '#2b1240'; c.lineWidth = 9;
    for (let i = 0; i < 12; i++) { const x = i * 112 + 30; c.beginPath(); c.moveTo(x, 40); c.bezierCurveTo(x + 30, 160, x - 40, 260, x + Math.sin(t * 0.01 + i) * 12, 330 + (i % 3) * 40); c.stroke(); }
    // the great eye (dormant fungus core)
    const blink = (t % 300) < 10; c.save(); c.translate(W / 2, 230); c.fillStyle = '#1d0f2e'; c.beginPath(); c.ellipse(0, 0, 120, blink ? 4 : 60, 0, 0, 7); c.fill();
    if (!blink) { c.fillStyle = '#a855f7'; c.shadowColor = '#c084fc'; c.shadowBlur = 30; c.beginPath(); c.arc(Math.sin(t * 0.01) * 30, 0, 24, 0, 7); c.fill(); c.fillStyle = '#000'; c.beginPath(); c.arc(Math.sin(t * 0.01) * 30, 0, 9, 0, 7); c.fill(); }
    c.restore();
    for (let i = 0; i < 8; i++) { const x = 70 + i * 160; c.fillStyle = '#4c1d95'; c.fillRect(x - 3, GROUND - 40, 6, 40); c.fillStyle = `rgba(192,132,252,${0.6 + 0.3 * Math.sin(t * 0.05 + i)})`; c.beginPath(); c.ellipse(x, GROUND - 40, 22, 10, 0, Math.PI, 0); c.fill(); }
    if (chance(0.4)) BG.spores.push({ x: rnd(0, W), y: GROUND, v: rnd(0.4, 1.2), p: rnd(0, 6), l: 300 });
    BG.spores.forEach(s => { s.y -= s.v; s.x += Math.sin(t * 0.02 + s.p) * 0.5; s.l--; c.fillStyle = `rgba(216,180,254,${s.l / 400})`; c.beginPath(); c.arc(s.x, s.y, 2, 0, 7); c.fill(); });
    BG.spores = BG.spores.filter(s => s.l > 0);
  }
  // floor
  const fl = c.createLinearGradient(0, GROUND - 4, 0, H); fl.addColorStop(0, A.floor); fl.addColorStop(1, '#020509');
  c.fillStyle = fl; c.fillRect(0, GROUND - 4, W, H - GROUND + 4);
  c.strokeStyle = A.accent; c.globalAlpha = 0.5; c.lineWidth = 2; c.beginPath(); c.moveTo(0, GROUND - 3); c.lineTo(W, GROUND - 3); c.stroke();
  c.globalAlpha = 0.16; c.lineWidth = 1;
  for (let x = -600; x <= W + 600; x += 90) { c.beginPath(); c.moveTo(W / 2 + (x - W / 2) * 0.55, GROUND); c.lineTo(W / 2 + (x - W / 2) * 1.6, H); c.stroke(); }
  for (let k = 1; k < 6; k++) { const y = GROUND + Math.pow(k / 6, 1.6) * (H - GROUND); c.beginPath(); c.moveTo(0, y); c.lineTo(W, y); c.stroke(); }
  c.globalAlpha = 1;
  floorPix.forEach(p => { p.a -= 0.0015; c.globalAlpha = Math.max(0, p.a) * 0.8; c.fillStyle = p.c; c.fillRect(p.x, p.y, p.s, p.s * 0.5); });
  c.globalAlpha = 1; floorPix = floorPix.filter(p => p.a > 0);
}

/* ---------------------------------------------------------------------- AI
 * Reads a delayed snapshot of the rival (reaction time by difficulty), plans movement,
 * blocks high/low, anti-airs jump-ins, punishes whiffs, grabs turtles, zones at range. */
const AI_LEVELS = [
  { react: 24, block: 0.22, aggr: 0.035, anti: 0.2, punish: 0.25, low: 0.25, zone: 0.012, grab: 0.15, dash: 0.002 },
  { react: 13, block: 0.55, aggr: 0.06, anti: 0.5, punish: 0.55, low: 0.5, zone: 0.018, grab: 0.3, dash: 0.006 },
  { react: 7, block: 0.82, aggr: 0.09, anti: 0.85, punish: 0.9, low: 0.82, zone: 0.024, grab: 0.45, dash: 0.012 }
];
class AI {
  constructor(me, opp, level) { this.me = me; this.opp = opp; this.setLevel(level); this.hist = []; this.plan = null; this.planT = 0; this.want = {}; this.dummy = null; }
  setLevel(l) { this.L = AI_LEVELS[clamp(l, 0, 2)]; this.lv = l; }
  snap() { const o = this.opp; return { state: o.state, move: o.move, f: o.f, x: o.x, y: o.y, vy: o.vy, crouch: o.crouch }; }
  think(G) {
    const me = this.me, o = this.opp, L = this.L;
    this.hist.push(this.snap()); if (this.hist.length > 40) this.hist.shift();
    const seen = this.hist[Math.max(0, this.hist.length - 1 - L.react)] || this.snap();
    const w = {}; const press = (k) => { w[k] = true; };
    const fwdK = o.x > me.x ? 'right' : 'left', backK = o.x > me.x ? 'left' : 'right';
    const dist = Math.abs(o.x - me.x);

    if (this.dummy && this.dummy !== 'CPU') {
      if (this.dummy === 'BLOCK') w.block = true;
      if (this.dummy === 'LOW BLOCK') { w.block = true; w.down = true; }
      if (this.dummy === 'JUMP') w.up = true;
      return this.apply(w);
    }
    if (G.state === 'terminate' && me.state === 'dizzy') return this.apply({});
    if (G.state !== 'fight' && G.state !== 'terminate') return this.apply({});

    // continue current plan
    if (this.plan && this.planT > 0) {
      this.planT--;
      if (this.plan === 'block') { w.block = true; if (this.low) w.down = true; }
      else if (this.plan === 'fwd') w[fwdK] = true;
      else if (this.plan === 'back') w[backK] = true;
      else if (this.plan === 'crouch') w.down = true;
      // never stand still blocking if rival walked away
      if (this.plan === 'block' && dist > 260 && !projectiles.some(p => p.owner === o)) this.planT = 0;
      if (this.plan !== 'block' || !me.canAct()) { /* fall through to reactive checks */ } else return this.apply(w);
    }
    if (!me.canAct()) {
      if (['hitstun', 'launched'].includes(me.state) && o.combo >= 3 && me.meter >= 50 && chance(0.03 * (this.lv + 1))) { w.block = true; press('kick'); return this.apply(w); }
      if (me.state === 'jump' && !me.airUsed && dist < 130 && chance(0.25)) press(chance(0.5) ? 'kick' : 'punch');
      return this.apply(w);
    }
    const attacking = (s) => (s.state === 'attack' && s.f <= (MOVES[s.move]?.a1 || 0)) || (s.state === 'jump' && s.move) || (s.state === 'tele' && s.f >= 10);
    // incoming projectile
    const proj = projectiles.find(p => p.owner === o && Math.sign(p.vx) === Math.sign(me.x - p.x) && Math.abs(p.x - me.x) < 280);
    if (proj && Math.abs(proj.x - me.x) < 200 + (2 - this.lv) * 30) {
      if (me.meter >= 40 && chance(0.04 * (this.lv + 1))) { press('tele'); return this.apply(w); }
      if (chance(L.block)) { this.plan = 'block'; this.low = false; this.planT = 18; w.block = true; return this.apply(w); }
      if (chance(0.25)) { w.up = true; w[fwdK] = true; return this.apply(w); }
    }
    // anti-air
    if (seen.state === 'jump' && seen.vy > -4 && dist < 175 && chance(L.anti * 0.25)) { w.down = true; press('kick'); return this.apply(w); }
    // react to attacks
    if (attacking(seen) && dist < 190 && chance(L.block * 0.35)) {
      this.low = seen.move === 'sweep' ? chance(L.low) : false;
      this.plan = 'block'; this.planT = 12 + this.lv * 3; w.block = true; if (this.low) w.down = true; return this.apply(w);
    }
    // punish whiffs / recovery
    const rec = (o.state === 'attack' && o.f > (MOVES[o.move]?.a1 || 0) + 1) || o.state === 'special' && o.f > 12 || o.state === 'getup' && o.f > 12;
    if (rec && dist < 135 && chance(L.punish * 0.3)) { if (chance(0.5)) { w.down = true; press('kick'); } else press('kick'); return this.apply(w); }
    // surge when it will land
    if (me.meter >= 100 && dist < 700 && o.grounded && !o.isInvuln() && ['idle', 'walk', 'crouch', 'special', 'attack', 'getup'].includes(o.state) && chance(0.02 + this.lv * 0.015)) { press('surge'); return this.apply(w); }
    // grab a turtle
    if ((o.state === 'block' || o.state === 'blockstun') && dist < 92 && chance(L.grab * 0.15)) { w.block = true; press('punch'); return this.apply(w); }
    // signature move
    if (me.meter >= 25 && chance(this.sigChance(dist, o, seen))) { w.down = true; press('special'); return this.apply(w); }
    if (dist > 135) {
      if (dist > 320 && me.meter >= 30 && chance(L.zone)) { press('special'); return this.apply(w); }
      if (dist > 380 && me.meter >= 70 && chance(L.zone * 0.4)) { press('tele'); return this.apply(w); }
      if (chance(L.dash) && dist > 220) { press(fwdK); this.plan = null; return this.apply(w); }
      if (chance(0.008)) { w.up = true; w[fwdK] = true; return this.apply(w); }
      this.plan = 'fwd'; this.planT = (rnd(10, 30)) | 0; w[fwdK] = true; return this.apply(w);
    }
    // close range
    const lowHp = me.hp < 30 && this.lv === 2;
    if (chance(L.aggr * (lowHp ? 0.6 : 1) * 2.2)) {
      const r = Math.random();
      if (r < 0.38) press('punch'); else if (r < 0.66) press('kick'); else if (r < 0.82) { w.down = true; press('punch'); } else { w.down = true; press('kick'); }
      return this.apply(w);
    }
    if (chance(0.025)) { this.plan = 'back'; this.planT = (rnd(8, 22)) | 0; w[backK] = true; return this.apply(w); }
    if (chance(0.02 * (this.lv + 1))) { this.plan = 'block'; this.low = chance(0.3); this.planT = 14; w.block = true; return this.apply(w); }
    if (dist > 80) w[fwdK] = true;
    return this.apply(w);
  }
  sigChance(dist, o, seen) {
    const ty = this.me.d.sig.type;
    switch (ty) {
      case 'cyclone': return seen.state === 'jump' && dist < 190 ? this.L.anti * 0.3 : (dist < 110 ? 0.006 : 0);
      case 'drop': return dist > 160 ? 0.012 : 0;
      case 'wall': return dist > 250 ? ((projectiles.some(p => p.owner === o) || o.meter >= 30) ? 0.02 : 0.004) : 0;
      case 'swap': return (this.me.x < WALL_L + 80 || this.me.x > WALL_R - 80) ? 0.012 : dist > 300 ? 0.006 : 0;
      case 'trap': return dist > 110 && !hazards.some(h => h.owner === this.me && h.type === 'trap') ? 0.012 : 0;
      case 'pillar': return dist > 180 ? 0.014 : 0.006;
      case 'seize': return dist < 135 ? ((o.state === 'block' || o.state === 'blockstun') ? 0.05 : 0.008) : 0;
    }
    return 0;
  }
  apply(w) {
    PAD_KEYS.forEach(k => this.me.pad.set(k, !!w[k], 'ai'));
  }
}
