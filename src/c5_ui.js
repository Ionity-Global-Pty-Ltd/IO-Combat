
/* ------------------------------------------------------------ KEYBOARD */
const KEYMAP_P1 = { KeyA: 'left', KeyD: 'right', KeyW: 'up', KeyS: 'down', Space: 'up', KeyF: 'punch', KeyG: 'kick', KeyH: 'block', KeyR: 'special', KeyT: 'tele', KeyY: 'surge' };
const KEYMAP_P2 = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down', KeyJ: 'punch', KeyK: 'kick', KeyL: 'block', KeyU: 'special', KeyI: 'tele', KeyO: 'surge',
  Numpad1: 'punch', Numpad2: 'kick', Numpad3: 'block', Numpad4: 'special', Numpad5: 'tele', Numpad6: 'surge' };
function keyTarget(code) {
  if (KEYMAP_P1[code]) return [0, KEYMAP_P1[code]];
  if (KEYMAP_P2[code]) return [GAME.mode === '2p' ? 1 : 0, KEYMAP_P2[code]]; // solo modes: arrows + JKL also drive P1
  return null;
}
window.addEventListener('keydown', (e) => {
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'Tab'].includes(e.code)) e.preventDefault();
  audio.init();
  if (UI.onKey(e)) return;
  const t = keyTarget(e.code); if (t && !e.repeat) PADS[t[0]].set(t[1], true, 'k');
});
window.addEventListener('keyup', (e) => { const t = keyTarget(e.code); if (t) PADS[t[0]].set(t[1], false, 'k'); });
window.addEventListener('blur', () => PADS.forEach(p => p.clear()));

/* ------------------------------------------------------------- GAMEPAD */
const GP_PREV = [{}, {}];
function pollGamepads() {
  if (!navigator.getGamepads) return;
  const pads = [...navigator.getGamepads()].filter(Boolean);
  pads.slice(0, 2).forEach((gp, i) => {
    const pi = (GAME.mode === '2p' && GAME.state !== 'menu') ? i : 0; if (i === 1 && pi === 0) return;
    const b = (n) => !!(gp.buttons[n] && gp.buttons[n].pressed), ax = gp.axes[0] || 0, ay = gp.axes[1] || 0;
    const s = { left: b(14) || ax < -0.5, right: b(15) || ax > 0.5, up: b(12) || b(0) || ay < -0.6, down: b(13) || ay > 0.6,
      punch: b(2), kick: b(3), block: b(5) || b(7), special: b(1), tele: b(4), surge: b(6) };
    PAD_KEYS.forEach(k => PADS[pi].set(k, s[k], 'g' + i));
    const start = b(9), prev = GP_PREV[i];
    if (start && !prev.start) UI.onKey({ code: GAME.state === 'menu' || GAME.state === 'select' ? 'Enter' : 'Escape', key: '', preventDefault() {} });
    if (b(0) && !prev.a && (GAME.state === 'menu' || GAME.state === 'select')) UI.onKey({ code: 'Enter', key: '', preventDefault() {} });
    GP_PREV[i] = { start, a: b(0) };
  });
}

/* ---------------------------------------------------------------- TOUCH */
document.querySelectorAll('#touch .tb').forEach(el => {
  const k = el.dataset.k;
  const on = (e) => { e.preventDefault(); audio.init(); el.classList.add('on'); PADS[0].set(k, true, 't' + k); try { el.setPointerCapture(e.pointerId); } catch (_) {} if (navigator.vibrate) { try { navigator.vibrate(8); } catch (_) {} } };
  const off = (e) => { e.preventDefault(); el.classList.remove('on'); PADS[0].set(k, false, 't' + k); };
  el.addEventListener('pointerdown', on); el.addEventListener('pointerup', off); el.addEventListener('pointercancel', off); el.addEventListener('lostpointercapture', off);
  el.addEventListener('contextmenu', e => e.preventDefault());
});
$('tPause').addEventListener('pointerdown', (e) => { e.preventDefault(); UI.togglePause(); });

/* -------------------------------------------------------------------- UI */
const OVERLAYS = ['splash', 'title', 'select', 'ladder', 'pause', 'moves', 'options', 'result'];
const UI = {
  cur: 'splash', diffSel: SAVE.settings.diff,
  show(id) {
    ['splash', 'title', 'select', 'ladder', 'pause', 'result'].forEach(o => { const el = $(o); if (el) el.classList.toggle('hidden', o !== id); });
    this.cur = id; this.updateTouch();
  },
  modal(id, open = true) { $(id).classList.toggle('hidden', !open); if (open && this.fighting()) GAME.paused = true; },
  fighting() { return !['menu', 'select'].includes(GAME.state) && GAME.p1; },
  updateTouch() {
    const s = SAVE.settings.touch, coarse = matchMedia('(pointer:coarse)').matches;
    const on = (s === 'on' || (s === 'auto' && coarse)) && this.fighting() && !GAME.paused && this.cur === null;
    $('touch').classList.toggle('hidden', !on); $('tPause').classList.toggle('hidden', !on);
  },
  toTitle() {
    GAME.state = 'menu'; GAME.paused = false; GAME.p1 = GAME.p2 = null; GAME.banner = null; projectiles = []; particles = []; popups = [];
    this.show('title'); this.renderStats(); audio.playMusic('menu');
  },
  renderStats() {
    const s = SAVE.stats;
    $('titleStats').innerHTML = `WINS <b>${s.wins}</b> · LOSSES <b>${s.losses}</b> · BEST STREAK <b>${s.bestStreak}</b> · PERFECTS <b>${s.perfects}</b> · DELETES <b>${s.deletes}</b> · ARCADE CLEARS <b>${s.arcadeClears}</b>`
      + (SAVE.unlocked.auditor ? ' · <span style="color:#ffd166">THE AUDITOR UNLOCKED</span>' : ' · <span>Clear Arcade to unlock the boss</span>');
  },
  /* ---- select screen ---- */
  openSelect(mode) {
    GAME.mode = mode; GAME.state = 'select'; this.show('select'); audio.sfx('confirm');
    if (FIGHTERS[GAME.sel[0]].boss && !SAVE.unlocked.auditor) GAME.sel[0] = 0;
    if (GAME.sel[1] === GAME.sel[0] && mode !== '2p') GAME.sel[1] = (GAME.sel[0] + 1) % 6;
    $('selSub').textContent = mode === 'arcade' ? 'ARCADE: pick your avatar (A/D/W/S or click) · six rivals and a boss await'
      : mode === '2p' ? 'P1: A/D/W/S + F · P2: arrows + J · Click = P1 · Right-click / Shift-click = P2'
      : 'Pick yours (A/D or click) · rival with arrows or right-click / Shift-click';
    $('arenaPick').classList.toggle('hidden', mode === 'arcade');
    $('diffPick').classList.toggle('hidden', mode === '2p' || mode === 'training');
    $('p2info').parentElement.querySelector('.vs').classList.toggle('hidden', mode === 'arcade');
    this.buildGrid(); this.refreshSelect();
  },
  buildGrid() {
    const g = $('grid'); g.innerHTML = '';
    FIGHTERS.forEach((f, i) => {
      const card = document.createElement('div'); card.className = 'card'; card.dataset.i = i;
      const locked = f.boss && !SAVE.unlocked.auditor; if (locked) card.classList.add('locked');
      const el = ELEMENT_INFO[f.element];
      card.innerHTML = `<span class="el" style="color:${el.col}">${el.label}</span><span class="tags"></span><canvas width="220" height="230"></canvas><div class="nm" style="color:${f.c1}">${f.name}</div><div class="tl">${f.title}</div>`;
      card.addEventListener('click', (e) => { if (locked) return; audio.init(); this.pick(e.shiftKey ? 1 : 0, i); });
      card.addEventListener('contextmenu', (e) => { e.preventDefault(); if (locked) return; this.pick(1, i); });
      g.appendChild(card);
      drawPortrait(card.querySelector('canvas'), f, false);
    });
  },
  pick(p, i) {
    if (p === 1 && GAME.mode === 'arcade') p = 0;
    GAME.sel[p] = i; audio.sfx('select'); this.refreshSelect();
  },
  refreshSelect() {
    document.querySelectorAll('#grid .card').forEach(card => {
      const i = +card.dataset.i, a = GAME.sel[0] === i, b = GAME.sel[1] === i && GAME.mode !== 'arcade';
      card.classList.toggle('p1', a); card.classList.toggle('p2', b);
      card.querySelector('.tags').innerHTML = (a ? '<span class="tag p1">P1</span>' : '') + (b ? `<span class="tag p2">${GAME.mode === '2p' ? 'P2' : 'CPU'}</span>` : '');
      drawPortrait(card.querySelector('canvas'), FIGHTERS[i], a || b);
    });
    const info = (f, who) => `<div class="n" style="color:${f.c1}">${who} · ${f.name}</div><div>${f.title}</div><div style="font-style:italic;margin:2px 0 4px">“${f.quote}”</div>
      <div class="stat">POWER <i style="width:${(f.stats.power - 60) * 2.5}px"></i></div><div class="stat">SPEED <i style="width:${(f.stats.speed - 60) * 2.5}px"></i></div><div class="stat">DEFENCE <i style="width:${(f.stats.defense - 60) * 2.5}px"></i></div>
      <div style="margin-top:3px">BLAST: <b style="color:#ffd166">${f.proj}</b> · BLINK: <b style="color:#00c6ff">${f.tele}</b> · SURGE: <b style="color:#ff3b5c">${f.surge}</b></div>`;
    $('p1info').innerHTML = info(FIGHTERS[GAME.sel[0]], 'P1');
    $('p2info').innerHTML = GAME.mode === 'arcade' ? '<div class="n">6 RIVALS + BOSS</div><div>Win every fight. The Auditor waits in the Root Cavern.</div>' : info(FIGHTERS[GAME.sel[1]], GAME.mode === '2p' ? 'P2' : 'CPU');
    $('arenaName').textContent = ARENAS[GAME.arenaIdx].name; $('diffName').textContent = DIFFS[SAVE.settings.diff];
  },
  moveSel(p, dx, dy) {
    const cols = getComputedStyle($('grid')).gridTemplateColumns.split(' ').length || 4;
    let i = GAME.sel[p] + dx + dy * cols; const n = FIGHTERS.length;
    for (let k = 0; k < n; k++) { i = (i + n) % n; if (!(FIGHTERS[i].boss && !SAVE.unlocked.auditor)) break; i += dx || dy || 1; }
    this.pick(p, (i + n) % n);
  },
  go() {
    audio.init(); audio.sfx('gong');
    if (GAME.mode === 'arcade') {
      const me = GAME.sel[0];
      const pool = FIGHTERS.map((f, i) => i).filter(i => i !== me && !FIGHTERS[i].boss).sort(() => Math.random() - 0.5);
      GAME.ladder = FIGHTERS[me].boss ? pool.slice(0, 6) : [...pool.slice(0, 5), 6]; GAME.ladderIdx = 0;
      return this.openLadder();
    }
    GAME.arena = ARENAS[GAME.arenaIdx];
    this.show(null); GAME.newMatch();
  },
  openLadder() {
    this.show('ladder'); GAME.state = 'select';
    const n = GAME.ladder.length, i = GAME.ladderIdx, opp = FIGHTERS[GAME.ladder[i]];
    $('ladSub').textContent = `FIGHT ${i + 1} / ${n} · ${opp.name} · ${opp.title}`;
    const c = $('ladCv').getContext('2d'); c.clearRect(0, 0, 960, 300);
    const sw = 960 / n;
    GAME.ladder.forEach((fi, k) => {
      const f = FIGHTERS[fi], x = k * sw + sw / 2, y = 150;
      c.save(); c.globalAlpha = k < i ? 0.35 : 1;
      c.fillStyle = k === i ? 'rgba(255,59,92,.18)' : '#081423'; c.strokeStyle = k === i ? '#ff3b5c' : '#1b3550'; c.lineWidth = 2;
      c.fillRect(x - sw / 2 + 6, 20, sw - 12, 250); c.strokeRect(x - sw / 2 + 6, 20, sw - 12, 250);
      const tmp = new Fighter(2, f, 0, 1, null); tmp.state = k === i ? 'victory' : 'idle'; tmp.t = 3; tmp.pose = tmp.targetPose();
      c.save(); c.translate(x, 228); c.scale(0.78, 0.78); tmp.renderBody(c, 0, 0, -1, tmp.pose, k < i ? { ghost: 0.5 } : {}); c.restore();
      c.font = '900 13px Orbitron,Arial'; c.textAlign = 'center'; c.fillStyle = f.c1; c.fillText(f.name, x, 256);
      if (k < i) { c.font = '900 18px Orbitron,Arial'; c.fillStyle = '#ff3b5c'; c.fillText('DELETED', x, 120); }
      c.restore();
    });
    // the player marker
    const me = FIGHTERS[GAME.sel[0]]; c.font = '900 13px Orbitron,Arial'; c.textAlign = 'center'; c.fillStyle = '#00c6ff'; c.fillText(`▼ ${me.name}`, i * sw + sw / 2, 14);
  },
  ladderFight() {
    GAME.sel[1] = GAME.ladder[GAME.ladderIdx];
    const last = GAME.ladderIdx === GAME.ladder.length - 1;
    GAME.arena = last ? ARENAS[4] : ARENAS[GAME.ladderIdx % 4];
    this.show(null); GAME.newMatch();
  },
  showResult(winner) {
    const human = GAME.mode !== '2p';
    const won = winner === GAME.p1, S = GAME.stats;
    let title = `${winner.d.name} WINS`, sub = '', primary = 'REMATCH', act = 'rematch';
    if (GAME.mode === 'arcade') {
      if (won && GAME.ladderIdx >= GAME.ladder.length - 1) {
        title = 'ARCADE CLEARED'; sub = `${GAME.p1.d.name} rules the Grid.` + (!SAVE.unlocked.auditor ? ' THE AUDITOR is now playable!' : '');
        SAVE.stats.arcadeClears++; SAVE.unlocked.auditor = true; persist(); primary = 'NEW ARCADE RUN'; act = 'newArcade';
      } else if (won) { sub = `Rival ${GAME.ladderIdx + 1} of ${GAME.ladder.length} deleted.`; primary = 'NEXT RIVAL ▶'; act = 'next'; }
      else { title = 'SYSTEM FAILURE'; sub = 'Continue? Your ladder progress is kept.'; primary = 'CONTINUE'; act = 'rematch'; }
    } else if (human) sub = won ? 'You win. The Grid remembers.' : 'Defeated. Re-route and retry.';
    const el = $('result');
    el.innerHTML = `<h2 class="h1" style="font-size:clamp(28px,5vw,60px)">${title}</h2><div class="sub">${sub}</div>
      <div class="panel" style="max-width:560px;margin-top:14px"><div class="cols">
      <div class="box"><h4>${GAME.p1.d.name} · P1</h4>Hits ${S.p1.hits} · Best combo ${S.p1.maxCombo} · Damage ${S.p1.dmg | 0}</div>
      <div class="box"><h4>${GAME.p2.d.name} · ${GAME.mode === '2p' ? 'P2' : 'CPU'}</h4>Hits ${S.p2.hits} · Best combo ${S.p2.maxCombo} · Damage ${S.p2.dmg | 0}</div></div></div>
      <div class="row" style="margin-top:14px"><button class="btn big gold" id="rPrimary">${primary}</button><button class="btn" id="rSelect">Avatar Select</button>
      <button class="btn" id="rShare">Share</button><button class="btn red" id="rMenu">Menu</button></div>
      <div class="hint">ENTER = ${primary} · ESC = Menu</div>`;
    this.show('result');
    this.resultAct = act;
    $('rPrimary').onclick = () => this.resultPrimary();
    $('rSelect').onclick = () => this.openSelect(GAME.mode === 'arcade' ? 'arcade' : GAME.mode);
    $('rMenu').onclick = () => this.toTitle();
    $('rShare').onclick = () => share(won && human ? `I beat ${GAME.p2.d.name} with ${GAME.p1.d.name} in IO-COMBAT` : `${winner.d.name} won a match in IO-COMBAT`);
  },
  resultPrimary() {
    const a = this.resultAct;
    if (a === 'next') { GAME.ladderIdx++; this.openLadder(); }
    else if (a === 'newArcade') this.openSelect('arcade');
    else { this.show(null); GAME.newMatch(); }
  },
  togglePause(force) {
    if (!this.fighting() || ['matchEnd'].includes(GAME.state)) return;
    GAME.paused = force !== undefined ? force : !GAME.paused;
    PADS.forEach(p => p.clear());
    if (GAME.paused) this.show('pause'); else { this.show(null); $('moves').classList.add('hidden'); $('options').classList.add('hidden'); }
  },
  onKey(e) {
    const c = e.code;
    if (this.cur === 'splash') { this.leaveSplash(); return true; }
    if (c === 'KeyM') { toggleMute(); return true; }
    if (c === 'KeyN') { SAVE.settings.musicOn = !SAVE.settings.musicOn; persist(); audio.applyVolumes(); return true; }
    const modalOpen = !$('moves').classList.contains('hidden') || !$('options').classList.contains('hidden');
    if (modalOpen && (c === 'Escape' || c === 'Enter')) { $('moves').classList.add('hidden'); $('options').classList.add('hidden'); if (this.fighting() && this.cur !== 'pause' && this.cur !== 'result') GAME.paused = false; return true; }
    if (this.cur === 'title') {
      const btns = [...document.querySelectorAll('#menu .btn')];
      this.menuI = this.menuI ?? 0;
      if (c === 'KeyW' || c === 'ArrowUp') this.menuI = (this.menuI - 2 + btns.length) % btns.length;
      else if (c === 'KeyS' || c === 'ArrowDown') this.menuI = (this.menuI + 2) % btns.length;
      else if (c === 'KeyA' || c === 'ArrowLeft') this.menuI = (this.menuI - 1 + btns.length) % btns.length;
      else if (c === 'KeyD' || c === 'ArrowRight') this.menuI = (this.menuI + 1) % btns.length;
      else if (c === 'Enter' || c === 'KeyF' || c === 'KeyJ') { btns[this.menuI].click(); return true; }
      else return true;
      btns[this.menuI].focus(); audio.sfx('select'); return true;
    }
    if (this.cur === 'select') {
      if (c === 'KeyA') this.moveSel(0, -1, 0); else if (c === 'KeyD') this.moveSel(0, 1, 0);
      else if (c === 'KeyW') this.moveSel(0, 0, -1); else if (c === 'KeyS') this.moveSel(0, 0, 1);
      else if (c === 'ArrowLeft') this.moveSel(GAME.mode === 'arcade' ? 0 : 1, -1, 0); else if (c === 'ArrowRight') this.moveSel(GAME.mode === 'arcade' ? 0 : 1, 1, 0);
      else if (c === 'ArrowUp') this.moveSel(GAME.mode === 'arcade' ? 0 : 1, 0, -1); else if (c === 'ArrowDown') this.moveSel(GAME.mode === 'arcade' ? 0 : 1, 0, 1);
      else if (c === 'Enter' || c === 'KeyF' || c === 'KeyJ') this.go();
      else if (c === 'Escape') this.toTitle();
      return true;
    }
    if (this.cur === 'ladder') { if (c === 'Enter' || c === 'KeyF') this.ladderFight(); else if (c === 'Escape') this.toTitle(); return true; }
    if (this.cur === 'result') { if (c === 'Enter') this.resultPrimary(); else if (c === 'Escape') this.toTitle(); return true; }
    if (this.cur === 'pause') { if (c === 'Escape' || c === 'KeyP' || c === 'Enter') this.togglePause(false); return true; }
    if (c === 'Escape' || c === 'KeyP') { this.togglePause(true); return true; }
    if (c === 'Tab' && GAME.mode === 'training' && GAME.ai) {
      const modes = ['STAND', 'BLOCK', 'LOW BLOCK', 'JUMP', 'CPU']; GAME.ai.dummy = modes[(modes.indexOf(GAME.ai.dummy) + 1) % modes.length]; GAME.ai.apply({}); return true;
    }
    return false;
  },
  leaveSplash() {
    if (this.cur !== 'splash') return;
    audio.init(); clearTimeout(this.splashT); this.toTitle();
  }
};
// result overlay container
(() => { const d = document.createElement('div'); d.id = 'result'; d.className = 'ov hidden'; $('stage').insertBefore(d, $('touch')); })();

function drawPortrait(cnv, f, active) {
  const c = cnv.getContext('2d'); c.clearRect(0, 0, cnv.width, cnv.height);
  const g = c.createRadialGradient(110, 140, 10, 110, 140, 130); g.addColorStop(0, f.glow + '55'); g.addColorStop(1, 'rgba(0,0,0,0)');
  c.fillStyle = g; c.fillRect(0, 0, cnv.width, cnv.height);
  const tmp = new Fighter(1, f, 0, 1, null); tmp.state = active ? 'victory' : 'idle'; tmp.t = 2; tmp.meter = 0; tmp.pose = tmp.targetPose();
  c.save(); c.translate(110, 224); c.scale(0.92, 0.92); tmp.renderBody(c, 0, 0, 1, tmp.pose, {}); c.restore();
}
function share(text) {
  const url = 'https://www.ionity.fun/combat/';
  if (navigator.share) { navigator.share({ title: 'IO-COMBAT · Ionity', text, url }).catch(() => {}); return; }
  const full = `${text} · ${url}`;
  (navigator.clipboard ? navigator.clipboard.writeText(full) : Promise.reject()).then(() => popupDom('Link copied')).catch(() => window.open('https://x.com/intent/post?text=' + encodeURIComponent(full), '_blank', 'noopener'));
}
function popupDom(t) { const b = document.createElement('div'); b.textContent = t; b.style.cssText = 'position:absolute;left:50%;top:12px;transform:translateX(-50%);z-index:80;background:#00c6ff;color:#001522;font:800 13px Orbitron,Arial;padding:6px 12px;border-radius:6px'; $('stage').appendChild(b); setTimeout(() => b.remove(), 1600); }
function toggleMute() { SAVE.settings.muted = !SAVE.settings.muted; persist(); audio.applyVolumes(); $('hSound').textContent = SAVE.settings.muted ? 'SFX OFF' : 'SFX ON'; }

/* ---- bindings ---- */
$('splash').addEventListener('pointerdown', () => UI.leaveSplash());
document.querySelectorAll('#menu [data-mode]').forEach(b => b.addEventListener('click', () => { audio.init(); UI.openSelect(b.dataset.mode); }));
document.querySelector('#menu [data-act="moves"]').addEventListener('click', () => UI.modal('moves'));
document.querySelector('#menu [data-act="options"]').addEventListener('click', () => UI.modal('options'));
document.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', () => { b.closest('.ov').classList.add('hidden'); if (UI.fighting() && UI.cur === null) GAME.paused = false; UI.updateTouch(); }));
$('selBack').onclick = () => UI.toTitle();
$('selGo').onclick = () => UI.go();
$('arenaPick').querySelectorAll('button').forEach(b => b.onclick = () => { GAME.arenaIdx = (GAME.arenaIdx + +b.dataset.d + ARENAS.length) % ARENAS.length; audio.sfx('select'); UI.refreshSelect(); });
$('diffPick').querySelectorAll('button').forEach(b => b.onclick = () => { SAVE.settings.diff = (SAVE.settings.diff + +b.dataset.d + 3) % 3; persist(); syncOptions(); UI.refreshSelect(); });
$('ladGo').onclick = () => UI.ladderFight();
$('ladQuit').onclick = () => UI.toTitle();
$('pResume').onclick = () => UI.togglePause(false);
$('pRestart').onclick = () => { GAME.paused = false; UI.show(null); GAME.newMatch(); };
$('pMoves').onclick = () => UI.modal('moves');
$('pOptions').onclick = () => UI.modal('options');
$('pQuit').onclick = () => UI.toTitle();
$('hMenu').onclick = () => UI.toTitle();
$('hMoves').onclick = () => { if (UI.fighting() && !GAME.paused) UI.togglePause(true); UI.modal('moves'); };
$('hOptions').onclick = () => { if (UI.fighting() && !GAME.paused) UI.togglePause(true); UI.modal('options'); };
$('hSound').onclick = () => { audio.init(); toggleMute(); };
function goFull() {
  const st = $('stage');
  const p = document.fullscreenElement ? document.exitFullscreen() : (st.requestFullscreen ? st.requestFullscreen() : Promise.reject());
  Promise.resolve(p).then(() => { if (screen.orientation && screen.orientation.lock && document.fullscreenElement) screen.orientation.lock('landscape').catch(() => {}); }).catch(() => {});
}
$('hFull').onclick = goFull; $('rotFull').onclick = goFull;
$('moreGames').addEventListener('click', (e) => { if (location.protocol === 'file:') { e.preventDefault(); window.open('https://www.ionity.fun/', '_blank', 'noopener'); } });

/* ---- options ---- */
function syncOptions() {
  const s = SAVE.settings;
  $('oDiff').textContent = DIFFS[s.diff]; $('oRounds').textContent = s.rounds === 1 ? '1 (sudden death)' : s.rounds; $('oTimer').textContent = s.timer;
  $('oSfx').value = s.sfx; $('oMus').value = s.music; $('oShake').textContent = s.shake ? 'ON' : 'OFF'; $('oFlash').textContent = s.reduceFlash ? 'ON' : 'OFF';
  $('oTouch').textContent = s.touch.toUpperCase(); $('hSound').textContent = s.muted ? 'SFX OFF' : 'SFX ON';
  if ($('diffName')) $('diffName').textContent = DIFFS[s.diff];
}
$('oDiff').onclick = () => { SAVE.settings.diff = (SAVE.settings.diff + 1) % 3; persist(); syncOptions(); };
$('oRounds').onclick = () => { SAVE.settings.rounds = SAVE.settings.rounds % 3 + 1; persist(); syncOptions(); };
$('oTimer').onclick = () => { const t = [60, 99, 150]; SAVE.settings.timer = t[(t.indexOf(SAVE.settings.timer) + 1) % 3]; persist(); syncOptions(); };
$('oSfx').oninput = (e) => { SAVE.settings.sfx = +e.target.value; persist(); audio.applyVolumes(); };
$('oMus').oninput = (e) => { SAVE.settings.music = +e.target.value; persist(); audio.applyVolumes(); };
$('oShake').onclick = () => { SAVE.settings.shake = !SAVE.settings.shake; persist(); syncOptions(); };
$('oFlash').onclick = () => { SAVE.settings.reduceFlash = !SAVE.settings.reduceFlash; persist(); syncOptions(); };
$('oTouch').onclick = () => { const m = ['auto', 'on', 'off']; SAVE.settings.touch = m[(m.indexOf(SAVE.settings.touch) + 1) % 3]; persist(); syncOptions(); UI.updateTouch(); };
$('oReset').onclick = () => { SAVE.stats = structuredClone(DEFAULT_SAVE.stats); SAVE.unlocked = structuredClone(DEFAULT_SAVE.unlocked); persist(); UI.renderStats(); popupDom('Stats reset'); };

/* ---- canvas sizing (crisp on every DPR) ---- */
function resize() {
  const r = cv.getBoundingClientRect(), dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = Math.max(320, Math.round(r.width * dpr)), h = Math.round(w * 9 / 16);
  if (cv.width !== w) { cv.width = w; cv.height = h; }
  ctx.setTransform(w / W, 0, 0, h / H, 0, 0);
  const portrait = matchMedia('(pointer:coarse)').matches && innerHeight > innerWidth;
  $('rotate').classList.toggle('hidden', !portrait);
  if (portrait && UI.fighting() && !GAME.paused) UI.togglePause(true);
}
window.addEventListener('resize', resize); document.addEventListener('fullscreenchange', () => setTimeout(resize, 50));
// tap the canvas on result-less states to skip banners / resume
cv.addEventListener('pointerdown', () => audio.init());

/* ---- boot ---- */
// audio track starts as soon as the context exists
const _init = audio.init.bind(audio);
audio.init = function () { const fresh = !this.ctx; _init(); if (fresh && this.ctx && this.track) { this.nextT = this.ctx.currentTime + 0.08; if (!this.timer) this.timer = setInterval(() => this.schedule(), 25); } };
syncOptions(); resize();
if (QS.get('splash') === '0') UI.toTitle(); else UI.splashT = setTimeout(() => UI.leaveSplash(), 2800);
GAME.state = 'menu'; audio.playMusic('menu');
requestAnimationFrame((t) => { lastT = t; requestAnimationFrame(frame); });
// test hook
window.IOC = { GAME, UI, FIGHTERS, MOVES, PADS, SAVE, VERSION, get projectiles() { return projectiles; } };
</script>
</body>
</html>
