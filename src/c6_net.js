
/* ==========================================================================
 * ONLINE PvP · IONITY CLOUD
 * Matchmaking queue + WebRTC signalling on Firestore (project io-man, Spark tier).
 * Gameplay never touches Firestore: once matched, the two browsers talk peer-to-peer
 * over a WebRTC data channel and run delay-based LOCKSTEP. Both sides simulate the same
 * deterministic 60 Hz game from the same inputs. Every 30 frames a state hash is compared;
 * on a mismatch the host sends a full snapshot and the guest re-simulates from it.
 * ======================================================================== */
const NET_PROTO = 'ioc-net-1';
const FB_CDN = 'https://www.gstatic.com/firebasejs/12.19.0/';
const FB_CFG = { apiKey: 'AIzaSyBDWHaRVFf1tmC7T3fbyk2MpIBeuyoyoIc', authDomain: 'io-man.firebaseapp.com', projectId: 'io-man',
  storageBucket: 'io-man.firebasestorage.app', messagingSenderId: '737401934489', appId: '1:737401934489:web:bfe305eba0bdc4416c9e08' };
const ICE = [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] }, { urls: 'stun:stun.cloudflare.com:3478' }];
const BAD_NAME = /(fuck|fuk|shit|cunt|bitch|dick|cock|puss|nigg|fag|rape|whore|slut|twat|wank|porn|nazi|hitler|kaffir|kafir|poes|naai|fokk)/i;

function cleanName(n) {
  n = String(n || '').toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 9);
  return n && !BAD_NAME.test(n) ? n : '';
}
function fnv(str) { let h = 0x811c9dc5; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193); } return (h >>> 0).toString(36); }

const NET = {
  running: false, role: null, me: 0, D: 3, frame: 0, sent: 0, local: {}, remote: {}, hashes: {}, hostHashes: {}, stall: 0,
  rtt: 0, names: ['', ''], rules: { rounds: 2, timer: 99 }, pc: null, dc: null, fb: null, uid: null, unsub: [], timers: [],
  waiting: false, room: null, myCands: [], pendingIce: [], matchNo: 0, wantRematch: [false, false], lastNeed: 0, pings: [], status: '',

  /* ---------------- status / UI ---------------- */
  say(msg, sub = '') { this.status = msg; const el = $('onStatus'); if (el) el.innerHTML = msg + (sub ? `<div class="hint">${sub}</div>` : ''); },

  /* ---------------- Firebase ---------------- */
  async loadFB() {
    if (this.fb) return this.fb;
    this.say('Connecting to IONITY CLOUD…');
    const [A, Au, F] = await Promise.all([import(FB_CDN + 'firebase-app.js'), import(FB_CDN + 'firebase-auth.js'), import(FB_CDN + 'firebase-firestore.js')]);
    const app = A.getApps().find(a => a.name === 'iocombat') || A.initializeApp(FB_CFG, 'iocombat');
    // session persistence: every tab is its own anonymous player (no account, no personal data)
    let auth; try { auth = Au.initializeAuth(app, { persistence: Au.browserSessionPersistence }); } catch (e) { auth = Au.getAuth(app); }
    const cred = await Au.signInAnonymously(auth);
    this.uid = cred.user.uid; this.F = F; this.db = F.getFirestore(app);
    return (this.fb = { A, Au, F, app, auth });
  },

  /* ---------------- matchmaking queue ---------------- */
  async find(name, fighter, alt) {
    this.cancelled = false; this.name = name; this.fighter = fighter; this.alt = !!alt; this.waiting = false; this.room = null;
    try { await this.loadFB(); } catch (e) { console.warn(e); this.say('Could not reach IONITY CLOUD.', 'Check your connection, or that this page is opened from ionity.fun.'); return; }
    if (this.cancelled) return;
    const F = this.F, db = this.db, myRef = F.doc(db, 'pvp_queue', this.uid);
    this.say('Searching the queue…');
    const attempt = async () => {
      if (this.cancelled || this.room) return;
      let got = null;
      try { got = await this.tryClaim(); } catch (e) { console.warn('claim', e); }
      if (got) {
        if (this.waiting) { this.waiting = false; try { await F.deleteDoc(myRef); } catch (e) { /* already gone */ } }
        return this.connect(got.room, 'guest', got.opp);
      }
      if (!this.waiting && !this.cancelled) {
        this.waiting = true;
        await F.setDoc(myRef, { uid: this.uid, name: this.name, fighter: this.fighter, alt: this.alt, v: NET_PROTO, ts: F.serverTimestamp(), status: 'waiting' });
        this.unsub.push(F.onSnapshot(myRef, (snap) => {
          const d = snap.data();
          if (d && d.status === 'matched' && d.room && !this.room) {
            this.waiting = false;
            this.connect(d.room, 'host', { uid: d.guest });
          }
        }));
        this.say('Waiting for a challenger…', 'You are in the queue. Keep this tab open.');
      }
    };
    await attempt();
    // keep retrying (both sides may have queued at the same moment) and heartbeat our entry
    this.timers.push(setInterval(() => { if (this.waiting) attempt(); }, 5000));
    this.timers.push(setInterval(() => { if (this.waiting) F.updateDoc(myRef, { ts: F.serverTimestamp() }).catch(() => {}); }, 8000));
  },
  async tryClaim() {
    const F = this.F, db = this.db;
    const snap = await F.getDocs(F.query(F.collection(db, 'pvp_queue'), F.orderBy('ts', 'desc'), F.limit(25)));
    const now = Date.now();
    const list = snap.docs.map(d => d.data()).filter(d => d.status === 'waiting' && d.uid !== this.uid && d.v === NET_PROTO && d.ts && now - d.ts.toMillis() < 45000
      && (!this.waiting || d.uid < this.uid)) // tie-break: when both are queued only one side claims
      .sort((a, b) => a.ts.toMillis() - b.ts.toMillis());
    this.queueSize = list.length;
    for (const c of list) {
      try {
        const room = await F.runTransaction(db, async (tx) => {
          const ref = F.doc(db, 'pvp_queue', c.uid), s = await tx.get(ref);
          if (!s.exists() || s.data().status !== 'waiting') throw new Error('taken');
          const roomRef = F.doc(F.collection(db, 'pvp_rooms'));
          tx.update(ref, { status: 'matched', guest: this.uid, room: roomRef.id });
          tx.set(roomRef, { host: c.uid, guest: this.uid, hostName: c.name, guestName: this.name, hostFighter: c.fighter, guestFighter: this.fighter,
            hostAlt: !!c.alt, guestAlt: this.alt, created: F.serverTimestamp(), v: NET_PROTO });
          return roomRef.id;
        });
        return { room, opp: c };
      } catch (e) { /* someone else got there first; try the next one */ }
    }
    return null;
  },

  /* ---------------- WebRTC via Firestore signalling ---------------- */
  async connect(roomId, role, opp) {
    if (this.room) return; this.room = roomId; this.role = role; this.me = role === 'host' ? 0 : 1;
    const F = this.F, db = this.db, roomRef = F.doc(db, 'pvp_rooms', roomId), cand = F.collection(roomRef, 'cand');
    this.say('Challenger found! Connecting peer-to-peer…');
    audio.sfx('confirm');
    const pc = this.pc = new RTCPeerConnection({ iceServers: ICE });
    pc.onicecandidate = (e) => { if (e.candidate) F.addDoc(cand, { from: this.uid, c: e.candidate.toJSON(), at: F.serverTimestamp() }).then(r => this.myCands.push(r)).catch(() => {}); };
    pc.onconnectionstatechange = () => { if (['failed', 'closed'].includes(pc.connectionState)) this.lost('connection ' + pc.connectionState); };
    this.unsub.push(F.onSnapshot(cand, (s) => s.docChanges().forEach(ch => {
      if (ch.type !== 'added') return; const d = ch.doc.data(); if (d.from === this.uid) return;
      const ic = new RTCIceCandidate(d.c); if (pc.remoteDescription) pc.addIceCandidate(ic).catch(() => {}); else this.pendingIce.push(ic);
    })));
    const flush = () => { this.pendingIce.forEach(ic => pc.addIceCandidate(ic).catch(() => {})); this.pendingIce = []; };
    if (role === 'host') {
      this.setupChannel(pc.createDataChannel('io', { ordered: true }));
      const offer = await pc.createOffer(); await pc.setLocalDescription(offer);
      await F.updateDoc(roomRef, { offer: { type: offer.type, sdp: offer.sdp } });
      this.unsub.push(F.onSnapshot(roomRef, (s) => { const d = s.data(); if (d && d.answer && !pc.currentRemoteDescription) pc.setRemoteDescription(d.answer).then(flush).catch(e => console.warn(e)); }));
    } else {
      pc.ondatachannel = (e) => this.setupChannel(e.channel);
      this.unsub.push(F.onSnapshot(roomRef, async (s) => {
        const d = s.data(); if (!d || !d.offer || pc.remoteDescription) return;
        await pc.setRemoteDescription(d.offer); flush();
        const ans = await pc.createAnswer(); await pc.setLocalDescription(ans);
        await F.updateDoc(roomRef, { answer: { type: ans.type, sdp: ans.sdp } });
      }));
    }
    this.timers.push(setTimeout(() => { if (!this.dc || this.dc.readyState !== 'open') this.lost('Peer-to-peer connection timed out (strict firewall / NAT). Try again or another network.'); }, 20000));
  },
  setupChannel(dc) {
    this.dc = dc;
    dc.onopen = () => this.opened();
    dc.onclose = () => this.lost('Rival disconnected');
    dc.onmessage = (e) => { let m; try { m = JSON.parse(e.data); } catch (_) { return; } this.onMsg(m); };
  },
  send(m) { if (this.dc && this.dc.readyState === 'open') { try { this.dc.send(JSON.stringify(m)); } catch (e) { /* closed */ } } },
  async cleanupSignalling() {
    this.unsub.forEach(u => { try { u(); } catch (e) { /* noop */ } }); this.unsub = [];
    const F = this.F; if (!F) return;
    for (const r of this.myCands) F.deleteDoc(r).catch(() => {}); this.myCands = [];
    if (this.role === 'host') {
      F.deleteDoc(F.doc(this.db, 'pvp_queue', this.uid)).catch(() => {});
      if (this.room) setTimeout(() => F.deleteDoc(F.doc(this.db, 'pvp_rooms', this.room)).catch(() => {}), 4000);
    }
  },
  opened() {
    this.say('Linked! Measuring ping…'); this.cleanupSignalling();
    this.send({ t: 'hello', v: NET_PROTO, name: this.name, fighter: this.fighter, alt: this.alt, ver: VERSION });
    if (this.role === 'host') { this.pings = []; for (let i = 0; i < 6; i++) setTimeout(() => this.send({ t: 'p', ts: performance.now() }), 120 * i); }
    this.timers.push(setInterval(() => this.send({ t: 'p', ts: performance.now() }), 2000));
  },

  /* ---------------- messages ---------------- */
  onMsg(m) {
    switch (m.t) {
      case 'hello':
        this.peer = { name: cleanName(m.name) || 'RIVAL', fighter: clamp(m.fighter | 0, 0, FIGHTERS.length - 1), alt: !!m.alt };
        if (m.v !== NET_PROTO) return this.lost('Version mismatch: please refresh both browsers.');
        this.say(`Linked with <b style="color:#ff3b5c">${this.peer.name}</b> (${FIGHTERS[this.peer.fighter].name}) · measuring ping…`);
        if (this.role === 'host' && this.pings && this.pings.length >= 6 && !this.running) this.hostStart();
        break;
      case 'p': this.send({ t: 'q', ts: m.ts }); break;
      case 'q': {
        const r = performance.now() - m.ts; this.rtt = this.rtt ? this.rtt * 0.8 + r * 0.2 : r;
        if (this.role === 'host' && !this.running && this.pings) { this.pings.push(r); if (this.pings.length === 6 && this.peer) this.hostStart(); }
        break;
      }
      case 'start': this.begin(m); break;
      case 'i': if (m.f > this.frame - 600) this.remote[m.f] = m.b; break;
      case 'h': if (this.role === 'guest') { this.hostHashes[m.f] = m.h; this.check(m.f); } break;
      case 'need': if (this.role === 'host') this.send({ t: 's', f: this.frame, s: snapshot() }); break;
      case 's': if (this.role === 'guest') this.resync(m.f, m.s); break;
      case 'rematch': this.wantRematch[1 - this.me] = true; this.maybeRematch(); UI.onlineNote(`${this.names[1 - this.me]} wants a rematch!`); break;
      case 'bye': this.lost(`${this.names[1 - this.me] || 'Rival'} left the match`); break;
    }
  },
  hostStart() {
    const sorted = this.pings.slice().sort((a, b) => a - b), rtt = sorted[Math.floor(sorted.length / 2)];
    this.rtt = rtt;
    const D = clamp(Math.ceil(rtt / 2 / STEP) + 2, 2, 8);
    const arena = (Math.random() * 4) | 0;
    const m = { t: 'start', D, arena, rules: { rounds: SAVE.settings.rounds, timer: SAVE.settings.timer }, f: [this.fighter, this.peer.fighter], alt: [this.alt, this.peer.alt],
      names: [this.name, this.peer.name], n: ++this.matchNo };
    this.send(m); this.begin(m);
  },
  begin(m) {
    this.matchNo = m.n; this.D = m.D; this.rules = m.rules; this.names = m.names; this.wantRematch = [false, false];
    this.frame = 0; this.sent = m.D; this.local = {}; this.remote = {}; this.hashes = {}; this.hostHashes = {}; this.stall = 0;
    for (let f = 1; f <= m.D; f++) { this.local[f] = 0; this.remote[f] = 0; }
    PADS[0].clear(); PADS[0].latch = {};
    GAME.mode = 'online'; GAME.sel = m.f.slice(); GAME.alt = m.alt.slice(); GAME.arena = ARENAS[m.arena];
    UI.show(null); $('online').classList.add('hidden');
    GAME.newMatch(); this.running = true;
    announce('online match');
  },

  /* ---------------- lockstep ---------------- */
  sample() {
    pollGamepads(); const P = PADS[0]; let b = 0;
    PAD_KEYS.forEach((k, i) => { if (P.held[k] || P.latch[k]) b |= (1 << i); }); P.latch = {};
    return b;
  },
  tick() {
    while (this.sent < this.frame + this.D) { this.sent++; const b = this.sample(); this.local[this.sent] = b; this.send({ t: 'i', f: this.sent, b }); }
    const nf = this.frame + 1, mine = this.local[nf], theirs = this.remote[nf];
    if (mine === undefined || theirs === undefined) { this.stall++; if (this.stall > 60 * 12) this.lost('Rival stopped responding'); return false; }
    this.stall = 0;
    const bits = this.me === 0 ? [mine, theirs] : [theirs, mine];
    NETPADS.forEach((p, i) => PAD_KEYS.forEach((k, j) => p.set(k, !!(bits[i] & (1 << j)), 'n')));
    GAME.step(); this.frame = nf;
    if (nf % 30 === 0) {
      const h = stateHash(); this.hashes[nf] = h;
      if (this.role === 'host') this.send({ t: 'h', f: nf, h }); else this.check(nf);
    }
    if (nf % 120 === 0) { const old = nf - 900; for (const o of [this.local, this.remote, this.hashes, this.hostHashes]) for (const k in o) if (+k < old) delete o[k]; }
    return true;
  },
  idle() { /* keep sending inputs even while the sim waits, so the rival never starves */ },
  check(f) {
    const a = this.hashes[f], b = this.hostHashes[f];
    if (a === undefined || b === undefined || a === b) return;
    if (performance.now() - this.lastNeed > 1500) { this.lastNeed = performance.now(); this.desyncs = (this.desyncs || 0) + 1; this.send({ t: 'need' }); }
  },
  resync(f, s) {
    applySnapshot(s); this.frame = f; this.hashes = {}; this.hostHashes = {};
    if (this.sent < f + this.D) { for (let k = this.sent + 1; k <= f + this.D; k++) { this.local[k] = 0; this.send({ t: 'i', f: k, b: 0 }); } this.sent = f + this.D; }
    this.resyncs = (this.resyncs || 0) + 1;
  },

  /* ---------------- rematch / leave ---------------- */
  rematch() { this.wantRematch[this.me] = true; this.send({ t: 'rematch' }); this.maybeRematch(); },
  maybeRematch() {
    if (!(this.wantRematch[0] && this.wantRematch[1]) || this.role !== 'host') return;
    const m = { t: 'start', D: this.D, arena: (Math.random() * 4) | 0, rules: this.rules, f: GAME.sel.slice(), alt: GAME.alt.slice(), names: this.names, n: ++this.matchNo };
    this.send(m); this.begin(m);
  },
  lost(reason) {
    if (this.closing) return; this.closing = true;
    const wasFighting = this.running && GAME.mode === 'online' && !['matchEnd'].includes(GAME.state);
    this.stop();
    if (wasFighting) { SAVE.stats.onlineWins++; SAVE.stats.onlinePlayed++; persist(); }
    UI.onlineLost(reason + (wasFighting ? ' · You win by forfeit.' : ''));
  },
  leave() { this.send({ t: 'bye' }); this.closing = true; this.stop(); },
  stop() {
    this.running = false; this.cancelled = true; this.waiting = false;
    this.timers.forEach(t => { clearInterval(t); clearTimeout(t); }); this.timers = [];
    this.cleanupSignalling();
    if (this.F && this.uid) this.F.deleteDoc(this.F.doc(this.db, 'pvp_queue', this.uid)).catch(() => {});
    try { this.dc && this.dc.close(); } catch (e) { /* noop */ } try { this.pc && this.pc.close(); } catch (e) { /* noop */ }
    this.dc = null; this.pc = null; this.room = null; this.peer = null; NETPADS.forEach(p => p.clear());
    setTimeout(() => { this.closing = false; }, 300);
  }
};

/* ---------------- deterministic state hash + snapshot (desync safety net) ---------------- */
function stateHash() {
  const r = (v) => Math.round(v * 100), G = GAME;
  const parts = [G.state, G.stateT, G.round, G.timer, G.hitstop, G.cinematic, G.slow, G.termT, projectiles.length, hazards.length];
  [G.p1, G.p2].forEach(f => parts.push(r(f.x), r(f.y), r(f.hp), r(f.meter), f.state, f.f, f.rounds, f.combo, f.facing));
  projectiles.forEach(p => parts.push(r(p.x), r(p.y)));
  return fnv(parts.join('|'));
}
const SKIP_F = new Set(['pad', 'd', 'trail', 'pose']);
function packFighter(f) { const o = {}; for (const k in f) if (!SKIP_F.has(k)) o[k] = f[k]; return JSON.parse(JSON.stringify(o)); }
function packPad(p) { return JSON.parse(JSON.stringify({ held: p.held, buf: p.buf, src: p.src, dn: p.dn, bl: p.bl, age: p.age })); }
function snapshot() {
  const G = GAME, idx = (f) => (f === G.p1 ? 1 : f === G.p2 ? 2 : 0);
  return {
    g: { state: G.state, stateT: G.stateT, round: G.round, timer: G.timer, hitstop: G.hitstop, cinematic: G.cinematic, slow: G.slow, termT: G.termT, tick: G.tick, firstStrike: G.firstStrike, winner: idx(G.winner), stats: G.stats },
    f: [packFighter(G.p1), packFighter(G.p2)], pads: NETPADS.map(packPad),
    pr: projectiles.map(p => { const o = Object.assign({}, p); o.owner = idx(p.owner); return o; }),
    hz: hazards.map(h => { const o = Object.assign({}, h); o.owner = idx(h.owner); return o; })
  };
}
function applySnapshot(s) {
  const G = GAME, by = (i) => (i === 1 ? G.p1 : i === 2 ? G.p2 : null);
  Object.assign(G, s.g); G.winner = by(s.g.winner);
  [G.p1, G.p2].forEach((f, i) => { Object.assign(f, s.f[i]); f.trail = []; });
  NETPADS.forEach((p, i) => Object.assign(p, s.pads[i]));
  projectiles = s.pr.map(o => Object.assign(Object.create(Projectile.prototype), o, { owner: by(o.owner) }));
  hazards = s.hz.map(o => Object.assign(Object.create(Hazard.prototype), o, { owner: by(o.owner) }));
}
