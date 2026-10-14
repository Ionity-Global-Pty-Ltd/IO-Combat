// IO-COMBAT v1.2 online PvP end-to-end: two independent browsers queue on the LIVE IONITY CLOUD
// (Firestore project io-man), get matched, link over WebRTC and play a lockstep match.
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, process.env.ROOT || '..');
const OUT = path.resolve(__dirname, '../previews');
let pass = 0, fail = 0; const ok = (c, m) => { if (c) { pass++; console.log('  PASS', m); } else { fail++; console.log('  FAIL', m); } };
const wait = (ms) => new Promise(r => setTimeout(r, ms));
const srv = http.createServer((q, s) => { const f = path.join(ROOT, decodeURIComponent(q.url.split('?')[0]).replace(/\/$/, '/index.html')); fs.readFile(f, (e, d) => { if (e) { s.writeHead(404); return s.end(); } s.writeHead(200, { 'content-type': f.endsWith('.html') ? 'text/html' : f.endsWith('.js') ? 'text/javascript' : 'application/octet-stream' }); s.end(d); }); });

(async () => {
  await new Promise(r => srv.listen(8765, r));
  const b = await chromium.launch({ executablePath: process.env.CHROME || '/opt/pw-browsers/chromium', args: ['--disable-features=WebRtcHideLocalIpsWithMdns'] });
  const mk = async (tag, fighter) => {
    const ctx = await b.newContext({ viewport: { width: 1280, height: 800 } }); const p = await ctx.newPage(); p.errs = [];
    p.on('pageerror', e => p.errs.push(e.stack)); p.on('console', m => { if (m.type() === 'error' && !/fonts\.g|favicon/.test(m.text())) p.errs.push(m.text()); });
    await p.goto('http://localhost:8765/?splash=0&full=0'); await wait(500);
    await p.evaluate(f => { IOC.GAME.sel = [f, 0]; }, fighter);
    await p.click('[data-mode="online"]'); await wait(200); await p.click('#selGo'); await wait(200);
    await p.fill('#onName', tag); return p;
  };
  const A = await mk('TEST-A', 0), B = await mk('TEST-B', 3);
  ok(await A.isVisible('#online'), 'online overlay opens from select');
  await A.screenshot({ path: OUT + '/30_online_lobby.png' });
  await A.click('#onGo'); await wait(2500);
  console.log('    A:', await A.textContent('#onStatus'));
  await B.click('#onGo');
  let started = false;
  for (let i = 0; i < 40 && !started; i++) { await wait(500); started = await A.evaluate(() => IOC.NET.running) && await B.evaluate(() => IOC.NET.running); }
  console.log('    A:', await A.textContent('#onStatus'), '| B:', await B.textContent('#onStatus'));
  ok(started, 'matched through the queue and linked peer-to-peer');
  if (!started) { console.log(A.errs, B.errs); await b.close(); srv.close(); process.exit(1); }
  const info = await Promise.all([A, B].map(p => p.evaluate(() => ({ role: IOC.NET.role, me: IOC.NET.me, D: IOC.NET.D, rtt: IOC.NET.rtt | 0, names: IOC.NET.names, f: [IOC.GAME.p1.d.id, IOC.GAME.p2.d.id] }))));
  console.log('    ', JSON.stringify(info));
  ok(info[0].role !== info[1].role && info[0].me !== info[1].me, 'one host, one guest');
  ok(info[0].f.join() === info[1].f.join() && info[0].names.join() === info[1].names.join(), 'both sides agree on fighters and names');
  await wait(2500);
  // drive both players with random inputs for ~20 s and compare state hashes on the same frame
  const keys = ['KeyA', 'KeyD', 'KeyW', 'KeyS', 'KeyF', 'KeyG', 'KeyH', 'KeyR', 'KeyT', 'KeyY'];
  const mash = async (p, n) => { for (let i = 0; i < n; i++) { const k = keys[(Math.random() * keys.length) | 0]; await p.keyboard.down(k); await wait(30 + Math.random() * 70); await p.keyboard.up(k); } };
  await Promise.all([mash(A, 120), mash(B, 120)]);
  const fr = await Promise.all([A, B].map(p => p.evaluate(() => IOC.NET.frame)));
  ok(fr[0] > 300 && fr[1] > 300 && Math.abs(fr[0] - fr[1]) <= 12, `lockstep advancing together (frames ${fr.join(' / ')})`);
  // freeze-compare: read hash history both sides share
  const hs = await Promise.all([A, B].map(p => p.evaluate(() => IOC.NET.hashes)));
  const common = Object.keys(hs[0]).filter(k => hs[1][k] !== undefined);
  const same = common.filter(k => hs[0][k] === hs[1][k]).length;
  console.log(`    hashes compared: ${common.length}, identical: ${same}, guest resyncs: ${await B.evaluate(() => IOC.NET.resyncs || 0)} / ${await A.evaluate(() => IOC.NET.resyncs || 0)}`);
  ok(common.length > 5 && same === common.length, 'deterministic: every shared frame hash identical');
  const hp = await Promise.all([A, B].map(p => p.evaluate(() => [IOC.GAME.p1.hp.toFixed(2), IOC.GAME.p2.hp.toFixed(2), IOC.GAME.state, IOC.GAME.round].join(','))));
  console.log('    state A:', hp[0], '| B:', hp[1]);
  await A.screenshot({ path: OUT + '/31_online_host.png' }); await B.screenshot({ path: OUT + '/32_online_guest.png' });
  // force a desync on the guest and make sure the snapshot resync repairs it
  const G_ = info[0].role === 'guest' ? A : B, H_ = G_ === A ? B : A;
  await G_.evaluate(() => { IOC.GAME.p1.hp = Math.max(5, IOC.GAME.p1.hp - 33); });
  await wait(2500);
  const r2 = await Promise.all([H_, G_].map(p => p.evaluate(() => { const H = IOC.NET.hashes; const ks = Object.keys(H).map(Number).sort((a, b) => b - a); return { k: ks.slice(0, 3), h: ks.slice(0, 3).map(k => H[k]), hp: IOC.GAME.p1.hp.toFixed(2), rs: IOC.NET.resyncs || 0 }; })));
  const lastCommon = r2[0].k.find(k => r2[1].k.includes(k));
  ok(r2[1].rs >= 1 && lastCommon && r2[0].h[r2[0].k.indexOf(lastCommon)] === r2[1].h[r2[1].k.indexOf(lastCommon)], `forced desync repaired by host snapshot (resyncs ${r2[1].rs})`);
  // full match end + rematch: host is authoritative, so set up a match point on the host; the guest resyncs to it
  await H_.evaluate(() => { const G = IOC.GAME; G.p1.rounds = G.need() - 1; G.p2.hp = 1; G.p1.x = 500; G.p2.x = 590; G.p1.state = G.p2.state = 'idle'; G.p1.y = G.p2.y = 604; G.p2.freeze = 0; });
  await wait(2200);
  const hostIsP1 = (await H_.evaluate(() => IOC.NET.me)) === 0;
  const attacker = hostIsP1 ? H_ : G_; // P1 is the host's fighter when host is me=0
  let st = '';
  for (let i = 0; i < 40 && !['matchEnd', 'deleted'].includes(st); i++) { await attacker.keyboard.press('KeyG'); await wait(250); st = await H_.evaluate(() => IOC.GAME.state); }
  for (let i = 0; i < 20 && st !== 'matchEnd'; i++) { await wait(300); st = await H_.evaluate(() => IOC.GAME.state); }
  const both = await Promise.all([H_, G_].map(p => p.evaluate(() => IOC.GAME.state)));
  ok(both.every(x => x === 'matchEnd'), 'online match reaches results on both sides (' + both.join('/') + ')');
  await H_.screenshot({ path: OUT + '/33_online_result.png' });
  const n0 = await H_.evaluate(() => IOC.NET.matchNo);
  await H_.click('#rPrimary'); await wait(400); await G_.click('#rPrimary'); await wait(2500);
  const n1 = await Promise.all([H_, G_].map(p => p.evaluate(() => [IOC.NET.matchNo, IOC.GAME.state])));
  ok(n1[0][0] === n0 + 1 && n1[1][0] === n0 + 1 && n1.every(x => ['intro', 'fight'].includes(x[1])), 'REMATCH accepted by both starts a new match ' + JSON.stringify(n1));
  // finish: knock the guest-side fighter out on BOTH sims deterministically via inputs is slow; leave and check forfeit path
  await A.evaluate(() => IOC.UI.toTitle()); await wait(2500);
  ok(await B.isVisible('#online') && /left|disconnect|forfeit/i.test(await B.textContent('#onStatus')), 'leaving notifies the rival (forfeit win): ' + (await B.textContent('#onStatus')).slice(0, 60));
  const wins = await B.evaluate(() => IOC.SAVE.stats.onlineWins);
  ok(wins >= 1, 'forfeit counted as an online win');
  ok(A.errs.length === 0 && B.errs.length === 0, 'zero console errors' + (A.errs.concat(B.errs).length ? ': ' + A.errs.concat(B.errs).slice(0, 2).join(' | ') : ''));
  await b.close(); srv.close();
  console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})();
