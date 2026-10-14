
/* ------------------------------------------------------------------- GAME */
const cv = $('cv'), ctx = cv.getContext('2d');
const PADS = [new Pad(), new Pad()];
const GAME = {
  state: 'menu', mode: 'ai', paused: false, p1: null, p2: null, ai: null, ai1: null, arena: ARENAS[0], round: 1, timer: 99 * 60, stateT: 0,
  hitstop: 0, cinematic: 0, shakeAmt: 0, banner: null, slow: 0, tick: 0, whiteFlash: 0, termT: 0, winner: null, ladder: null, ladderIdx: 0,
  sel: [0, 1], alt: [false, false], arenaIdx: 0, stats: null, attract: null, cam: { x: W / 2, z: 1 }, survival: null,

  shake(v) { if (SAVE.settings.shake) this.shakeAmt = Math.max(this.shakeAmt, v); },
  say(text, sub = '', dur = 90, color = '#ffffff', voice) { if (this.sandbox) return; this.banner = { text, sub, t: 0, dur, color }; if (voice) announce(voice === true ? text : voice); },

  newMatch() {
    const d1 = FIGHTERS[this.sel[0]], d2 = FIGHTERS[this.sel[1]];
    const alt2 = this.alt[1] !== (d1.id === d2.id && this.alt[0] === this.alt[1]); // mirror match: P2 auto-swaps colours
    this.p1 = new Fighter(1, d1, 380, 1, PADS[0], this.alt[0]); this.p2 = new Fighter(2, d2, 900, -1, PADS[1], alt2);
    const lvl = this.mode === 'arcade' ? Math.min(2, SAVE.settings.diff + (this.ladderIdx >= 4 ? 1 : 0))
      : this.mode === 'survival' ? Math.min(2, SAVE.settings.diff + Math.floor((this.survival ? this.survival.wins : 0) / 4)) : SAVE.settings.diff;
    this.ai = (this.mode === '2p') ? null : new AI(this.p2, this.p1, lvl);
    if (this.mode === 'training') { this.ai.dummy = 'STAND'; }
    this.attract = null;
    this.round = 1; floorPix = []; this.stats = { p1: { hits: 0, maxCombo: 0, dmg: 0 }, p2: { hits: 0, maxCombo: 0, dmg: 0 } };
    SAVE.stats.played++; persist();
    if (this.mode === 'survival' && !this.survival) this.survival = { wins: 0, hp: 100 };
    audio.playMusic(this.arena.id === 'root' || d2.boss ? 'boss' : 'fight');
    this.startRound();
  },
  startRound() {
    this.p1.reset(380, 1); this.p2.reset(900, -1);
    projectiles = []; particles = []; popups = []; hazards = []; rings = [];
    if (this.mode === 'survival' && this.survival) this.p1.hp = this.p1.shownHp = this.survival.hp;
    this.cam = { x: W / 2, z: 1 };
    this.timer = (this.mode === 'training' ? 0 : SAVE.settings.timer) * 60;
    this.state = 'intro'; this.stateT = 0; this.hitstop = 0; this.cinematic = 0; this.slow = 0; this.winner = null;
    audio.sfx('gong');
    const last = this.p1.rounds === this.need() - 1 && this.p2.rounds === this.need() - 1;
    if (typeof UI !== 'undefined') setTimeout(() => UI.updateTouch(), 0);
    const label = this.mode === 'training' ? 'TRAINING' : this.mode === 'survival' ? `CHALLENGER ${this.survival.wins + 1}` : last ? 'FINAL ROUND' : `ROUND ${this.round}`;
    this.say(label, `${this.p1.d.name}  VS  ${this.p2.d.name}`, 80, '#00c6ff', label.replace('CHALLENGER', 'challenger'));
  },
  need() { return this.mode === 'survival' ? 1 : SAVE.settings.rounds; },

  /* ---------- combat resolution ---------- */
  resolveHit(att, def, h) {
    const S = att === this.p1 ? this.stats.p1 : this.stats.p2;
    if (this.state === 'terminate' && def.state === 'dizzy') {
      if (h.heavy || h.src !== 'melee') return this.doDelete(att, def);
      burst(def.x, def.y - 110, 6, ['#fff', def.d.glow], { dir: h.dir }); audio.sfx('hit'); return;
    }
    const blocking = (def.state === 'block' || def.state === 'blockstun') && def.grounded && h.kind !== 'throw';
    const okBlock = blocking && !(h.kind === 'low' && !def.crouch) && !(h.kind === 'overhead' && def.crouch);
    if (okBlock && def.pad && def.pad.age.block <= 6 && h.kind !== 'throw' && h.src !== 'surge') {
      // PERFECT GUARD: block tapped just in time
      def.state = 'blockstun'; def.f = 0; def.stun = 3; def.vx = 0; def.addMeter(15); def.flash = 6;
      if (h.src === 'melee' && att.grounded) { att.state = 'hitstun'; att.f = 0; att.stun = 16; att.move = null; att.vx = -h.dir * 5; }
      this.hitstop = 9; audio.sfx('parry'); ring(def.x + def.facing * 24, def.y - 110, '#ffffff', 80, 4);
      popup(def.x, def.y - 205, 'PERFECT GUARD', '#ffffff', 22);
      if (def === this.p1 && this.ai && !this.sandbox) { SAVE.stats.parries++; }
      return;
    }
    if (okBlock) {
      const chip = h.src === 'melee' ? 0 : h.dmg * (h.src === 'surge' ? 0.25 : 0.18) * att.pow / def.def;
      def.hp = Math.max(h.src === 'surge' ? 0 : Math.min(def.hp, 1), def.hp - chip);
      def.state = 'blockstun'; def.f = 0; def.stun = 10 + (h.heavy ? 6 : 0) + (h.src !== 'melee' ? 4 : 0);
      def.vx = h.dir * ((h.push || 6) * 0.7 + 3); def.addMeter(4); att.addMeter(2);
      this.hitstop = 3; audio.sfx('block');
      burst(def.x + def.facing * 26, def.y - (def.crouch ? 70 : 115), 10, ['#ffd166', '#ffffff', '#00c6ff'], { dir: -def.facing, g: 0.15, min: 2, max: 4, lmin: 10, lmax: 18 });
      if (def.hp <= 0) this.onKO(def, att);
      return;
    }
    att.combo++; att.comboT = 70; S.hits++; S.maxCombo = Math.max(S.maxCombo, att.combo);
    let dmg = h.dmg * att.pow / def.def * (att.combo > 3 ? Math.max(0.5, Math.pow(0.88, att.combo - 3)) : 1);
    if (att.oc) dmg *= 1.12;
    let triple = false;
    if (h.move === 'punch' && att.combo >= 3 && att.combo % 3 === 0) { dmg *= 1.6; triple = true; popup(def.x, def.y - 190, 'TRIPLE!', '#ffd166', 26); }
    if (def.state === 'launched') dmg *= 0.8;
    def.hp = Math.max(0, def.hp - dmg); def.dmgTaken += dmg; S.dmg += dmg;
    if (this.sandbox && def.hp < 20) def.hp = 100;
    att.addMeter(h.gain || 6); def.addMeter((h.gain || 6) * 0.6);
    def.flash = 8; def.freeze = 0;
    const airborne = !def.grounded || def.state === 'launched';
    if (airborne || h.launch || h.knock || triple || (h.el === 'ion' && h.src !== 'melee') || h.src === 'surge') {
      def.state = 'launched'; def.f = 0; def.move = null; def.juggle++;
      def.vy = h.launch ? -15.5 : h.src === 'surge' ? -12 : h.knock ? -7 : -8.5; def.vx = h.dir * (h.launch ? 2.5 : h.src === 'surge' ? 10 : (h.el === 'ion' && h.src !== 'melee') ? 9 : 6);
      def.y = Math.min(def.y, GROUND - 2);
    } else { def.state = 'hitstun'; def.f = 0; def.move = null; def.stun = h.hs || 14; def.vx = h.dir * (h.push || 5); }
    if (h.src !== 'melee') this.applyElement(h.el, att, def);
    this.hitstop = h.stop || 5; this.shake(h.heavy ? 9 : 4);
    if (h.heavy) ring(def.x - h.dir * 6, def.y - (def.crouch ? 70 : 112) * def.scale, def.d.glow, h.src === 'surge' ? 180 : 100, h.src === 'surge' ? 10 : 5);
    audio.sfx(h.heavy ? 'heavy' : 'hit');
    burst(def.x - h.dir * 6, def.y - (def.crouch ? 70 : 112) * def.scale, h.heavy ? 26 : 12, [def.d.glow, '#ffffff', def.d.c1], { dir: h.dir, floor: true, g: 0.45, up: 3, lmin: 30, lmax: 60 });
    if (!this.sandbox && navigator.vibrate && att === this.p1 && h.heavy) { try { navigator.vibrate(18); } catch (e) { /* no haptics */ } }
    if (def.hp <= 0) {
      if (this.mode === 'training') { def.hp = 1; } else this.onKO(def, att);
    }
  },
  applyElement(el, att, def) {
    const P = (t, c) => popup(def.x, def.y - 175, t, c, 20);
    if (el === 'volt') { if (def.state === 'hitstun') def.stun += 22; P('STUNNED', '#facc15'); }
    else if (el === 'cryo') { def.freeze = 55; def.state = def.grounded ? 'hitstun' : def.state; def.stun = 55; P('FROZEN', '#7dd3fc'); }
    else if (el === 'void') { def.meter = Math.max(0, def.meter - 25); att.addMeter(10); P('ION DRAINED', '#c084fc'); }
    else if (el === 'spore') { def.poison = 180; P('POISONED', '#4ade80'); }
    else if (el === 'fire') { def.burn = 120; P('BURNING', '#f97316'); }
    else if (el === 'audit') { def.meter = Math.max(0, def.meter - 15); P('FINED', '#ffd166'); }
    else if (el === 'ion') { P('IONISED', '#00c6ff'); }
  },
  doGrab(att, def) {
    audio.sfx('grab'); def.state = 'grabbed'; def.f = 0; def.vx = 0; def.vy = 0;
    def.x = clamp(att.x - att.facing * 74, WALL_L, WALL_R); def.y = GROUND - 30;
    popup(att.x, att.y - 190, 'DATA GRAB', '#00c6ff', 22);
    this.resolveHit(att, def, { ...MOVES.grab, move: 'grab', src: 'melee', dir: -att.facing, knock: true, el: att.d.element });
  },
  breaker(f, opp) {
    audio.sfx('breaker'); this.shake(10); ring(f.x, f.y - 100, f.d.glow, 220, 10); ring(f.x, f.y - 100, '#ffffff', 160, 4);
    burst(f.x, f.y - 100, 40, [f.d.glow, '#fff'], { g: 0, smin: 4, smax: 12 });
    popup(f.x, f.y - 220, 'ION BREAKER', f.d.glow, 26); if (!SAVE.settings.reduceFlash) this.whiteFlash = 4;
    if (f.y < GROUND) { f.vy = 2; }
    if (Math.abs(opp.x - f.x) < 240 && !opp.isInvuln()) {
      const dir = Math.sign(opp.x - f.x) || 1; opp.state = opp.grounded ? 'hitstun' : 'launched'; opp.f = 0; opp.stun = 18; opp.move = null; opp.vx = dir * 14; opp.combo = 0; opp.comboT = 0;
    }
    f.combo = 0;
  },
  startSurge(f) {
    this.cinematic = MOVES.surge.freeze; audio.sfx('surge'); f.hasHit = false;
    this.say(f.d.surge, `${f.d.name} · ION SURGE`, 70, f.d.glow);
    if (!SAVE.settings.reduceFlash && !this.sandbox) this.whiteFlash = 6;
  },
  surgeBeam(att, opp) {
    att.beamOn = 3;
    if (att.hasHit || opp.isInvuln() && !(this.state === 'terminate' && opp.state === 'dizzy')) return;
    const by = att.y - 116 * att.scale, ahead = Math.sign(opp.x - att.x) === att.facing;
    if (ahead && opp.hurtTop < by + 30 && opp.y > by - 30) {
      att.hasHit = true;
      this.resolveHit(att, opp, { ...MOVES.surge, move: 'surge', src: 'surge', dir: att.facing, el: att.d.element, heavy: true, push: 10, stop: 14, gain: 0 });
    }
  },

  /* ---------- round flow ---------- */
  onKO(loser, winner) {
    if (this.state !== 'fight') { loser.hp = Math.max(loser.hp, 0); return; }
    if (winner.rounds + 1 >= this.need()) {
      this.state = 'terminate'; this.stateT = 0; this.termT = 240; this.winner = winner;
      loser.hp = 1; loser.state = 'dizzy'; loser.f = 0; loser.vx = 0; loser.vy = 0; loser.y = GROUND; loser.freeze = 0; loser.poison = 0; loser.burn = 0;
      projectiles = projectiles.filter(p => p.owner === winner);
      audio.sfx('gong'); this.say('TERMINATE!', 'LAND A KICK · UPLINK · SPECIAL · BLINK · SURGE', 150, '#ff3b5c', 'terminate');
    } else {
      this.state = 'ko'; this.stateT = 0; this.winner = winner; this.slow = 50;
      audio.sfx('ko'); this.say('SHUTDOWN', '', 110, '#ff3b5c', 'shutdown'); this.shake(16);
      if (loser.state !== 'launched') { loser.state = 'launched'; loser.vy = -9; loser.vx = (Math.sign(loser.x - winner.x) || 1) * 6; loser.y = Math.min(loser.y, GROUND - 2); }
    }
  },
  doDelete(att, def) {
    this.state = 'deleted'; this.stateT = 0; def.state = 'deleted'; def.deleted = 0; def.hp = 0; att.state = 'victory';
    audio.sfx('delete'); this.shake(26); if (!SAVE.settings.reduceFlash) this.whiteFlash = 12;
    burst(def.x, def.y - 90, 90, [def.d.glow, def.d.c1, def.d.c2, '#ffffff'], { g: 0.25, smin: 2, smax: 11, up: 3, lmin: 50, lmax: 110, floor: true });
    this.say('DELETED', `${att.d.name} WINS · TOTAL OVERRIDE`, 200, '#ff3b5c', 'deleted');
    if (att === this.p1 && this.ai) { SAVE.stats.deletes++; persist(); }
    att.rounds++;
  },
  roundOver(winner, how) {
    this.state = 'roundEnd'; this.stateT = 0;
    const loser = winner === this.p1 ? this.p2 : this.p1;
    if (winner) {
      winner.rounds++; winner.state = 'victory';
      const perfect = winner.dmgTaken < 0.01;
      if (perfect && winner === this.p1 && this.ai) { SAVE.stats.perfects++; persist(); }
      this.say(`${winner.d.name} WINS`, perfect ? 'PERFECT · ZERO DAMAGE' : how === 'time' ? 'TIME OUT' : `ROUND ${this.round}`, 140, winner.d.glow, perfect ? `${winner.d.name} wins. perfect` : `${winner.d.name} wins`);
      if (loser.state !== 'ko' && loser.state !== 'launched') { loser.state = 'ko'; loser.f = 0; }
    } else this.say('DRAW', 'NO ROUND AWARDED', 120, '#ffffff');
    audio.sfx('gong');
  },
  matchOver(winner) {
    this.state = 'matchEnd'; this.stateT = 0; this.winner = winner;
    const humanWon = winner === this.p1;
    if (this.ai && this.mode !== 'training') {
      const st = SAVE.stats;
      if (humanWon) { st.wins++; st.streak++; st.bestStreak = Math.max(st.bestStreak, st.streak); } else { st.losses++; st.streak = 0; }
      persist();
    }
    if (this.mode === 'survival' && this.survival) {
      if (humanWon) { this.survival.wins++; this.survival.hp = Math.min(100, this.p1.hp + 25); }
      SAVE.stats.survivalBest = Math.max(SAVE.stats.survivalBest, this.survival.wins); persist();
    }
    UI.showResult(winner);
  },

  /* ---------- simulation step (fixed 60 Hz) ---------- */
  step() {
    this.tick++;
    pollGamepads();
    if (this.state === 'menu' || this.state === 'select') { this.stepAttract(); return; }
    if (this.paused) return;
    if (this.banner) { this.banner.t++; if (this.banner.dur > 0 && this.banner.t > this.banner.dur) this.banner = null; }
    if (this.whiteFlash > 0) this.whiteFlash--;
    this.stateT++;
    if (this.slow > 0) { this.slow--; if (this.tick % 2) return; }
    const p1 = this.p1, p2 = this.p2;

    switch (this.state) {
      case 'intro': if (this.stateT === 85) { this.state = 'fight'; this.stateT = 0; this.say(this.mode === 'training' ? 'GO' : 'ENGAGE!', '', 50, '#ffd166', 'engage'); audio.sfx('gong'); } break;
      case 'fight':
        if (this.mode !== 'training' && this.cinematic <= 0 && this.hitstop <= 0) {
          this.timer--; if (this.timer % 60 === 0 && this.timer <= 600 && this.timer > 0) audio.sfx('tick');
          if (this.timer <= 0) { const w = p1.hp > p2.hp ? p1 : p2.hp > p1.hp ? p2 : null; return this.roundOver(w, 'time'); }
        }
        if (this.mode === 'training') this.trainingAssist();
        break;
      case 'terminate':
        if (--this.termT <= 0) {
          const loser = this.winner === p1 ? p2 : p1; loser.hp = 0; loser.state = 'ko'; loser.f = 0;
          this.say('SPARED', 'TOO SLOW TO TERMINATE', 90, '#ffd166'); this.roundOver(this.winner, 'spared'); return;
        }
        break;
      case 'ko': if (this.stateT > 120) { return this.roundOver(this.winner, 'ko'); } break;
      case 'deleted': {
        const loser = this.winner === p1 ? p2 : p1; loser.deleted++;
        if (loser.deleted < 60 && this.tick % 2 === 0) burst(loser.x + rnd(-30, 30), loser.y - rnd(10, 160), 3, [loser.d.glow, '#fff'], { g: -0.1, smin: 0.5, smax: 3, lmin: 30, lmax: 60 });
        if (this.stateT === 220) this.matchOver(this.winner);
        break;
      }
      case 'roundEnd':
        if (this.stateT === 150) {
          const champ = p1.rounds >= this.need() ? p1 : p2.rounds >= this.need() ? p2 : null;
          if (champ) this.matchOver(champ); else { this.round++; this.startRound(); }
        }
        break;
    }

    // controllers
    if (this.ai) this.ai.think(this);
    // freeze-frames
    if (this.hitstop > 0) { this.hitstop--; this.stepFx(); return; }
    if (this.cinematic > 0) {
      this.cinematic--;
      const s = p1.state === 'surge' ? p1 : p2.state === 'surge' ? p2 : null;
      if (s) { s.update(s === p1 ? p2 : p1, this); s.updatePose(); }
      this.stepFx(); PADS.forEach(p => p.tick()); return;
    }
    const active = ['fight', 'terminate', 'ko', 'deleted', 'roundEnd', 'intro', 'matchEnd'].includes(this.state);
    if (active) {
      const canControl = this.state === 'fight' || this.state === 'terminate';
      if (!canControl) { PADS.forEach(p => p.clear()); if (this.ai) this.ai.apply({}); }
      p1.update(p2, this); p2.update(p1, this);
      // push boxes
      const dx = p2.x - p1.x;
      if (Math.abs(dx) < 62 && Math.abs(p1.y - p2.y) < 120 && !['deleted'].includes(p1.state) && !['deleted'].includes(p2.state)) {
        const o = (62 - Math.abs(dx)) / 2, s = dx >= 0 ? 1 : -1;
        p1.x = clamp(p1.x - s * o, WALL_L, WALL_R); p2.x = clamp(p2.x + s * o, WALL_L, WALL_R);
        if (Math.abs(p2.x - p1.x) < 50) { if (p1.x <= WALL_L + 1) p2.x = p1.x + 62; else if (p2.x <= WALL_L + 1) p1.x = p2.x + 62; else if (p1.x >= WALL_R - 1) p2.x = p1.x - 62; else if (p2.x >= WALL_R - 1) p1.x = p2.x - 62; }
      }
      // projectiles
      for (const pr of projectiles) {
        pr.update(); const tg = pr.owner === p1 ? p2 : p1;
        const hittable = !tg.isInvuln() || (this.state === 'terminate' && tg.state === 'dizzy');
        if (pr.alive && hittable && Math.abs(pr.x - tg.x) < 30 + pr.r * 0.6 && pr.y > tg.hurtTop - pr.r * 0.5 && pr.y < tg.y) {
          pr.alive = false;
          this.resolveHit(pr.owner, tg, { dmg: pr.dmg, kind: 'mid', heavy: true, hs: 18, push: 7, stop: 6, gain: 6, src: 'proj', dir: pr.dir, el: pr.el, move: 'special' });
        }
      }
      for (let i = 0; i < projectiles.length; i++) for (let j = i + 1; j < projectiles.length; j++) {
        const a = projectiles[i], b = projectiles[j];
        if (a.alive && b.alive && a.owner !== b.owner && Math.abs(a.x - b.x) < a.r + b.r && Math.abs(a.y - b.y) < a.r + b.r) {
          a.alive = b.alive = false; burst((a.x + b.x) / 2, (a.y + b.y) / 2, 24, [a.col, b.col, '#fff'], { g: 0.1 }); audio.sfx('block'); popup((a.x + b.x) / 2, a.y - 40, 'CLASH', '#ffffff', 20);
        }
      }
      projectiles = projectiles.filter(p => p.alive);
      hazards.forEach(h => h.update(this, h.owner === p1 ? p2 : p1)); hazards = hazards.filter(h => h.alive);
      p1.updatePose(); p2.updatePose();
    }
    PADS.forEach(p => p.tick());
    this.stepFx();
  },
  stepFx() {
    rings.forEach(r => { r.r += (r.max - r.r) * 0.25; r.life--; }); rings = rings.filter(r => r.life > 0);
    particles.forEach(p => p.update()); particles = particles.filter(p => p.life > 0);
    popups.forEach(p => { p.y -= 1; p.life--; }); popups = popups.filter(p => p.life > 0);
  },
  trainingAssist() {
    [this.p1, this.p2].forEach(f => {
      if (['idle', 'walk', 'crouch', 'block'].includes(f.state) && f.comboT === 0) { f.hp = Math.min(100, f.hp + 0.5); }
      f.addMeter(0.35);
    });
  },
  /* demo fight behind the title menu */
  stepAttract() {
    if (!this.attract) {
      const a = (Math.random() * 6) | 0, b = (a + 1 + ((Math.random() * 5) | 0)) % 6;
      const pa = new Pad(), pb = new Pad(), fa = new Fighter(1, FIGHTERS[a], 420, 1, pa), fb = new Fighter(2, FIGHTERS[b], 860, -1, pb);
      this.attract = { fa, fb, ia: new AI(fa, fb, 1), ib: new AI(fb, fa, 1), arena: ARENAS[(Math.random() * 4) | 0], t: 0 };
    }
    const A = this.attract, saved = { state: this.state, stats: this.stats, p1: this.p1, p2: this.p2, ai: this.ai };
    // run a muted sandbox round: reuse the real resolver but never trigger KO flow
    this.sandbox = true; this.state = 'fight'; this.stats = { p1: { hits: 0, maxCombo: 0, dmg: 0 }, p2: { hits: 0, maxCombo: 0, dmg: 0 } }; this.p1 = A.fa; this.p2 = A.fb;
    const muted = SAVE.settings.muted; SAVE.settings.muted = true;
    const shakeOn = SAVE.settings.shake; SAVE.settings.shake = false;
    A.t++;
    if (this.hitstop > 0) this.hitstop--; else {
      A.ia.think(this); A.ib.think(this);
      A.fa.update(A.fb, this); A.fb.update(A.fa, this);
      const dx = A.fb.x - A.fa.x; if (Math.abs(dx) < 56 && Math.abs(A.fa.y - A.fb.y) < 110) { const o = (56 - Math.abs(dx)) / 2, s = dx >= 0 ? 1 : -1; A.fa.x -= s * o; A.fb.x += s * o; }
      for (const pr of projectiles) { pr.update(); const tg = pr.owner === A.fa ? A.fb : A.fa; if (pr.alive && !tg.isInvuln() && Math.abs(pr.x - tg.x) < 40 && pr.y > tg.hurtTop && pr.y < tg.y) { pr.alive = false; this.resolveHit(pr.owner, tg, { dmg: pr.dmg, kind: 'mid', heavy: true, hs: 18, push: 7, stop: 6, gain: 6, src: 'proj', dir: pr.dir, el: pr.el }); } }
      projectiles = projectiles.filter(p => p.alive);
      hazards.forEach(h => h.update(this, h.owner === A.fa ? A.fb : A.fa)); hazards = hazards.filter(h => h.alive);
      A.fa.updatePose(); A.fb.updatePose(); A.fa.pad.tick(); A.fb.pad.tick();
      [A.fa, A.fb].forEach(f => { if (f.hp < 25) f.hp = 100; });
    }
    this.cinematic = 0; this.stepFx();
    SAVE.settings.muted = muted; SAVE.settings.shake = shakeOn;
    Object.assign(this, saved); this.sandbox = false;
    if (A.t > 60 * 25) { this.attract = null; projectiles = []; particles = []; floorPix = []; hazards = []; rings = []; }
  }
};

/* ---------------------------------------------------------------- RENDER */
function render() {
  const c = ctx; c.save();
  if (GAME.shakeAmt > 0.5) { c.translate(rnd(-1, 1) * GAME.shakeAmt, rnd(-1, 1) * GAME.shakeAmt); GAME.shakeAmt *= 0.86; } else GAME.shakeAmt = 0;
  const attract = (GAME.state === 'menu' || GAME.state === 'select') && GAME.attract;
  const arena = attract ? GAME.attract.arena : GAME.arena;
  const f1 = attract ? GAME.attract.fa : GAME.p1, f2 = attract ? GAME.attract.fb : GAME.p2;
  // dynamic camera: zooms in as fighters close, harder on supers and finishers
  const cam = GAME.cam;
  if (f1 && f2 && SAVE.settings.cam) {
    let tz = clamp(1.32 - Math.abs(f1.x - f2.x) / 1000, 1, 1.18), tx = (f1.x + f2.x) / 2;
    const surger = [f1, f2].find(f => f.state === 'surge' && f.f < MOVES.surge.freeze);
    if (surger) { tz = 1.32; tx = surger.x; }
    if (['terminate', 'deleted', 'ko'].includes(GAME.state) && !attract) { tz = Math.max(tz, 1.22); }
    cam.z = lerp(cam.z, tz, 0.07); cam.x = lerp(cam.x, tx, 0.1);
  } else { cam.z = lerp(cam.z, 1, 0.1); cam.x = W / 2; }
  c.save();
  if (cam.z > 1.001) { const vw = W / cam.z, vx = clamp(cam.x - vw / 2, 0, W - vw), vy = (H - H / cam.z) * 0.86; c.scale(cam.z, cam.z); c.translate(-vx, -vy); }
  drawArena(c, arena);
  if (f1 && f2) {
    if (GAME.cinematic > 0 || [f1, f2].some(f => f.state === 'surge' && f.f < MOVES.surge.freeze)) { c.fillStyle = 'rgba(0,0,0,.6)'; c.fillRect(0, 0, W, H); }
    if (GAME.state === 'deleted') { c.fillStyle = 'rgba(20,0,6,.45)'; c.fillRect(0, 0, W, H); }
    // draw the attacker last so strikes overlap the defender
    const order = (['attack', 'special', 'tele', 'surge', 'sig', 'breaker'].includes(f1.state) ? [f2, f1] : [f1, f2]);
    hazards.forEach(h => h.draw(c));
    order.forEach(f => f.draw(c, GAME));
    rings.forEach(r => { c.save(); c.globalAlpha = r.life / 18; c.strokeStyle = r.color; c.lineWidth = r.w * r.life / 18; c.shadowColor = r.color; c.shadowBlur = 12; c.beginPath(); c.arc(r.x, r.y, r.r, 0, 7); c.stroke(); c.restore(); });
    [f1, f2].forEach(f => { if (f.beamOn > 0) { drawBeam(c, f); f.beamOn--; } });
    projectiles.forEach(p => p.draw(c));
    particles.forEach(p => p.draw(c));
    popups.forEach(p => { c.save(); c.globalAlpha = clamp(p.life / 25, 0, 1); c.font = `900 ${p.size}px Orbitron,Arial`; c.textAlign = 'center'; c.fillStyle = p.color; c.shadowColor = '#000'; c.shadowBlur = 8; c.fillText(p.text, p.x, p.y); c.restore(); });
  }
  c.restore();
  c.restore();
  if (!attract && GAME.p1 && GAME.state !== 'menu' && GAME.state !== 'select') drawHUD(c);
  if (attract) drawAttractTag(c);
  if (GAME.banner) drawBanner(c, GAME.banner);
  if (GAME.whiteFlash > 0) { c.fillStyle = `rgba(255,255,255,${GAME.whiteFlash / 14})`; c.fillRect(0, 0, W, H); }
  // scanlines
  c.fillStyle = 'rgba(0,0,0,.08)'; for (let y = 0; y < H; y += 4) c.fillRect(0, y, W, 1);
}
function drawBeam(c, f) {
  const y = f.y - 116 * f.scale, x0 = f.x + f.facing * 70, x1 = f.facing > 0 ? W + 40 : -40;
  c.save(); c.shadowColor = f.d.glow; c.shadowBlur = 40;
  const h = 46 + Math.sin(GAME.tick * 0.8) * 8;
  c.fillStyle = f.d.glow; c.globalAlpha = 0.85; c.fillRect(Math.min(x0, x1), y - h / 2, Math.abs(x1 - x0), h);
  c.fillStyle = '#ffffff'; c.globalAlpha = 1; c.fillRect(Math.min(x0, x1), y - h / 6, Math.abs(x1 - x0), h / 3);
  c.restore();
  if (GAME.tick % 2 === 0) burst(x0 + f.facing * rnd(0, 600), y + rnd(-20, 20), 2, [f.d.glow, '#fff'], { g: 0, dir: f.facing, lmin: 10, lmax: 20 });
}
function drawAttractTag(c) {
  c.save(); c.font = '700 14px Orbitron,Arial'; c.fillStyle = 'rgba(0,198,255,.6)'; c.textAlign = 'left'; c.fillText('DEMO · CPU vs CPU', 20, H - 20); c.restore();
}
function glitchText(c, text, x, y, size, color, t) {
  c.font = `900 ${size}px Orbitron,'Arial Black',Arial`; c.textAlign = 'center'; c.textBaseline = 'middle';
  const j = SAVE.settings.reduceFlash ? 0 : (t % 20 < 3 ? 6 : 2);
  c.fillStyle = 'rgba(255,59,92,.85)'; c.fillText(text, x - j, y);
  c.fillStyle = 'rgba(0,198,255,.85)'; c.fillText(text, x + j, y);
  c.shadowColor = color; c.shadowBlur = 24; c.fillStyle = color; c.fillText(text, x, y); c.shadowBlur = 0;
}
function drawBanner(c, b) {
  const k = Math.min(1, b.t / 8), sc = 1.6 - 0.6 * k, fade = b.dur > 0 ? clamp((b.dur - b.t) / 12, 0, 1) : 1;
  c.save(); c.globalAlpha = fade;
  c.fillStyle = 'rgba(0,0,0,.45)'; c.fillRect(0, H / 2 - 90, W, 180);
  c.fillStyle = b.color; c.globalAlpha = fade * 0.8; c.fillRect(0, H / 2 - 92, W * k, 3); c.fillRect(W - W * k, H / 2 + 89, W * k, 3); c.globalAlpha = fade;
  c.translate(W / 2, H / 2 - 12); c.scale(sc, sc);
  const size = b.text.length > 12 ? 64 : 92;
  glitchText(c, b.text, 0, 0, size, '#ffffff', b.t);
  c.restore();
  if (b.sub) { c.save(); c.globalAlpha = fade; c.font = '700 22px Orbitron,Arial'; c.textAlign = 'center'; c.fillStyle = b.color; c.shadowColor = '#000'; c.shadowBlur = 6; c.fillText(b.sub, W / 2, H / 2 + 56); c.restore(); }
}
function drawHUD(c) {
  const p1 = GAME.p1, p2 = GAME.p2;
  [p1, p2].forEach((f, i) => {
    const left = i === 0, bw = 500, bh = 26, x = left ? 40 : W - 40 - bw, y = 30;
    f.shownHp = f.shownHp > f.hp ? Math.max(f.hp, f.shownHp - 0.45) : f.hp;
    c.save();
    c.beginPath(); const sk = 14; // skewed frame
    if (left) { c.moveTo(x + sk, y); c.lineTo(x + bw, y); c.lineTo(x + bw - sk, y + bh); c.lineTo(x, y + bh); }
    else { c.moveTo(x, y); c.lineTo(x + bw - sk, y); c.lineTo(x + bw, y + bh); c.lineTo(x + sk, y + bh); }
    c.closePath(); c.fillStyle = '#05101c'; c.fill(); c.save(); c.clip();
    const wHp = bw * f.hp / 100, wSh = bw * f.shownHp / 100;
    c.fillStyle = '#ff3b5c'; left ? c.fillRect(x + bw - wSh, y, wSh, bh) : c.fillRect(x, y, wSh, bh);
    const g = c.createLinearGradient(x, 0, x + bw, 0);
    if (left) { g.addColorStop(0, '#1658A4'); g.addColorStop(1, '#00c6ff'); } else { g.addColorStop(0, '#00c6ff'); g.addColorStop(1, '#1658A4'); }
    if (f.hp < 25) { g.addColorStop(0.5, GAME.tick % 30 < 15 ? '#ffd166' : '#00c6ff'); }
    c.fillStyle = g; left ? c.fillRect(x + bw - wHp, y, wHp, bh) : c.fillRect(x, y, wHp, bh);
    c.fillStyle = 'rgba(255,255,255,.18)'; c.fillRect(x, y, bw, bh / 3);
    c.restore();
    c.strokeStyle = '#7fdcff'; c.lineWidth = 2; c.stroke();
    // name + pips
    c.font = '900 20px Orbitron,Arial'; c.textAlign = left ? 'left' : 'right'; c.fillStyle = '#fff'; c.shadowColor = f.d.glow; c.shadowBlur = 10;
    c.fillText(f.d.name, left ? x + 4 : x + bw - 4, y + bh + 24); c.shadowBlur = 0;
    const tag = GAME.mode === '2p' ? (left ? 'P1' : 'P2') : (left ? 'P1' : (GAME.mode === 'training' ? 'DUMMY' : 'CPU · ' + DIFFS[GAME.ai ? GAME.ai.lv : 1]));
    c.font = '700 12px Orbitron,Arial'; c.fillStyle = left ? '#00c6ff' : '#ff3b5c'; c.fillText(tag, left ? x + 4 : x + bw - 4, y - 8);
    for (let r = 0; r < GAME.need(); r++) {
      const px = left ? x + bw - 14 - r * 24 : x + 14 + r * 24, py = y + bh + 18;
      c.beginPath(); for (let a = 0; a < 6; a++) c.lineTo(px + Math.cos(a * 1.047) * 8, py + Math.sin(a * 1.047) * 8); c.closePath();
      c.fillStyle = r < f.rounds ? '#ffd166' : '#0b1a2b'; c.fill(); c.strokeStyle = '#ffd166'; c.lineWidth = 1.5; c.stroke();
    }
    // ION meter
    const my = y + bh + 34, mw = 300, mx = left ? x : x + bw - mw;
    c.fillStyle = '#05101c'; c.fillRect(mx, my, mw, 12); const full = f.meter >= 100;
    const mg = c.createLinearGradient(mx, 0, mx + mw, 0); mg.addColorStop(0, f.d.c2); mg.addColorStop(1, f.d.glow);
    c.fillStyle = full ? (GAME.tick % 20 < 10 ? '#ffffff' : f.d.glow) : mg;
    const mwid = mw * f.meter / 100; left ? c.fillRect(mx, my, mwid, 12) : c.fillRect(mx + mw - mwid, my, mwid, 12);
    c.strokeStyle = 'rgba(127,220,255,.6)'; c.lineWidth = 1; c.strokeRect(mx, my, mw, 12);
    [30, 40].forEach(v => { const tx = left ? mx + mw * v / 100 : mx + mw - mw * v / 100; c.fillStyle = 'rgba(255,255,255,.5)'; c.fillRect(tx, my, 1, 12); });
    c.font = '700 11px Orbitron,Arial'; c.textAlign = left ? 'left' : 'right'; c.fillStyle = full ? '#ffd166' : '#8aa4bf';
    c.fillText(full ? 'ION · SURGE READY' + (left ? ' [Y]' : GAME.mode === '2p' ? ' [O]' : '') : 'ION ' + (f.meter | 0), left ? mx + mw + 8 : mx - 8, my + 10);
    // status chips
    const chips = []; if (f.oc) chips.push(['OVERCLOCK', '#ff3b5c']); if (f.poison > 0) chips.push(['POISON', '#4ade80']); if (f.burn > 0) chips.push(['BURN', '#f97316']); if (f.freeze > 0) chips.push(['FROZEN', '#7dd3fc']);
    chips.forEach((ch, k) => { c.fillStyle = ch[1]; c.font = '700 11px Orbitron,Arial'; c.fillText(ch[0], left ? mx + k * 86 : mx + mw - k * 86, my + 28); });
    // combo
    if (f.combo >= 2 && f.comboT > 0) {
      c.save(); c.globalAlpha = clamp(f.comboT / 30, 0, 1); c.font = '900 34px Orbitron,Arial'; c.textAlign = left ? 'left' : 'right';
      c.fillStyle = '#ffd166'; c.shadowColor = '#ff3b5c'; c.shadowBlur = 14; c.fillText(`${f.combo} HITS`, left ? 40 : W - 40, 190);
      c.font = '700 14px Orbitron,Arial'; c.fillStyle = '#fff'; c.fillText(f.combo >= 6 ? 'OVERCLOCKED!' : f.combo >= 4 ? 'CHAIN LINKED' : 'COMBO', left ? 40 : W - 40, 212); c.restore();
    }
    c.restore();
  });
  // timer
  c.save(); c.translate(W / 2, 46);
  c.beginPath(); for (let a = 0; a < 6; a++) c.lineTo(Math.cos(a * 1.047 + 0.52) * 42, Math.sin(a * 1.047 + 0.52) * 42); c.closePath();
  c.fillStyle = '#05101c'; c.fill(); c.strokeStyle = '#ffd166'; c.lineWidth = 3; c.stroke();
  const secs = GAME.mode === 'training' ? '∞' : String(Math.max(0, Math.ceil(GAME.timer / 60)));
  c.font = '900 34px Orbitron,Arial'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = GAME.timer < 600 && GAME.mode !== 'training' && GAME.tick % 30 < 15 ? '#ff3b5c' : '#ffd166';
  c.fillText(secs, 0, 2); c.restore();
  c.save(); c.font = '700 12px Orbitron,Arial'; c.textAlign = 'center'; c.fillStyle = '#8aa4bf';
  c.fillText(GAME.mode === 'survival' && GAME.survival ? `SURVIVAL · WINS ${GAME.survival.wins} · BEST ${SAVE.stats.survivalBest} · ${GAME.arena.name}` : GAME.mode === 'arcade' ? `ARCADE ${GAME.ladderIdx + 1}/${GAME.ladder.length} · ${GAME.arena.name}` : `${GAME.arena.name}`, W / 2, 104);
  if (GAME.mode === 'training') { c.fillStyle = '#ffd166'; c.fillText(`DUMMY: ${GAME.ai.dummy} · [TAB] change`, W / 2, 124); }
  if (GAME.state === 'terminate') { c.font = '900 20px Orbitron,Arial'; c.fillStyle = '#ff3b5c'; c.fillText(`TERMINATE · ${(GAME.termT / 60).toFixed(1)}s`, W / 2, 150); }
  c.restore();
}

/* ------------------------------------------------------------- MAIN LOOP */
let lastT = performance.now(), acc = 0;
const STEP = 1000 / 60;
function frame(now) {
  acc += Math.min(100, now - lastT); lastT = now;
  while (acc >= STEP) { GAME.step(); acc -= STEP; }
  render();
  requestAnimationFrame(frame);
}
