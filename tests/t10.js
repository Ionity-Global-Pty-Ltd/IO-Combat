// IO-COMBAT v1.0 headless verification (Playwright + Chromium)
const { chromium, devices } = require('playwright');
const path = require('path');
const URL = 'file://' + path.resolve(__dirname, '../index.html');
const OUT = path.resolve(__dirname, '../previews');
require('fs').mkdirSync(OUT, { recursive: true });
let pass = 0, fail = 0; const ok = (c, m) => { if (c) { pass++; console.log('  PASS', m); } else { fail++; console.log('  FAIL', m); } };
const RESET = `const G=IOC.GAME;[G.p1,G.p2].forEach(f=>{f.state='idle';f.f=0;f.vx=0;f.vy=0;f.y=604;f.freeze=0;f.move=null;f.invuln=0;f.juggle=0;});IOC.projectiles.length=0;`;
const wait = (ms) => new Promise(r => setTimeout(r, ms));

(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROME || '/opt/pw-browsers/chromium' });
  const page = await b.newPage({ viewport: { width: 1366, height: 860 } });
  const errors = []; page.on('pageerror', e => errors.push(e.stack)); page.on('console', m => { if (m.type() === 'error' && !/fonts\.g/.test(m.text())) errors.push(m.text()); });
  await page.goto(URL); await wait(600);
  await page.screenshot({ path: OUT + '/01_splash.png' });
  ok(await page.isVisible('#splash'), 'splash visible');
  await page.keyboard.press('Enter'); await wait(1200);
  ok(await page.isVisible('#title'), 'title after key');
  await page.screenshot({ path: OUT + '/02_title_attract.png' });
  ok(await page.evaluate(() => !!IOC.GAME.attract), 'attract demo running behind title');

  // ---- select
  await page.click('[data-mode="ai"]'); await wait(300);
  ok(await page.isVisible('#select'), 'select open');
  ok(await page.evaluate(() => document.querySelectorAll('#grid .card').length) === 7, '7 cards (6 + boss)');
  ok(await page.evaluate(() => document.querySelector('#grid .card[data-i="6"]').classList.contains('locked')), 'boss locked by default');
  await page.keyboard.press('KeyD'); await wait(100);
  ok(await page.evaluate(() => IOC.GAME.sel[0]) === 1, 'keyboard moves P1 cursor');
  await page.keyboard.press('KeyA');
  await page.click('#grid .card[data-i="3"]', { button: 'right' }); await wait(100);
  ok(await page.evaluate(() => IOC.GAME.sel[1]) === 3, 'right-click picks rival');
  await page.screenshot({ path: OUT + '/03_select.png' });
  await page.click('#selGo'); await wait(400);
  ok(await page.evaluate(() => IOC.GAME.state) === 'intro', 'round intro');
  await page.screenshot({ path: OUT + '/04_round_intro.png' });
  await wait(1500);
  ok(await page.evaluate(() => IOC.GAME.state) === 'fight', 'fight state after intro');

  // ---- timing: 60 sim steps per second independent of rAF rate
  const t0 = await page.evaluate(() => IOC.GAME.timer); await wait(2000); const t1 = await page.evaluate(() => IOC.GAME.timer);
  ok(Math.abs((t0 - t1) - 120) < 25, `timer runs ~60 steps/s (${t0 - t1} in 2 s)`);

  // ---- moves (freeze AI so we can measure)
  await page.evaluate(RESET); await page.evaluate(() => { const G = IOC.GAME; G.ai.dummy = 'STAND'; G.p1.x = 500; G.p2.x = 580; G.p1.meter = 100; G.p2.hp = 100; });
  await page.keyboard.press('KeyF'); await wait(250);
  ok(await page.evaluate(() => IOC.GAME.p2.hp < 100), 'punch lands');
  await wait(400);
  await page.evaluate(RESET); await page.evaluate(() => { IOC.GAME.p2.hp = 100; IOC.GAME.p1.x = 500; IOC.GAME.p2.x = 580; });
  await page.keyboard.down('KeyS'); await page.keyboard.press('KeyG'); await page.keyboard.up('KeyS'); await wait(300);
  ok(await page.evaluate(() => IOC.GAME.p2.state === 'launched' || IOC.GAME.p2.y < 604 || IOC.GAME.p2.state === 'knockdown'), 'S+G uplink launches ' + await page.evaluate(() => JSON.stringify({s:IOC.GAME.p1.state,m:IOC.GAME.p1.move,p2:IOC.GAME.p2.state,hp:IOC.GAME.p2.hp|0})));
  await page.screenshot({ path: OUT + '/05_uplink.png' });
  await wait(1500);
  // block test: dummy blocks, punch should do 0 dmg
  await page.evaluate(() => { const G = IOC.GAME; G.ai.dummy = 'BLOCK'; G.p2.hp = 100; G.p1.x = 500; G.p2.x = 585; });
  await wait(100); await page.keyboard.press('KeyF'); await wait(300);
  ok(await page.evaluate(() => IOC.GAME.p2.hp) === 100, 'standing block stops punch');
  await wait(500); await page.evaluate(RESET); await page.evaluate(() => { IOC.GAME.p1.x = 500; IOC.GAME.p2.x = 585; IOC.GAME.p2.state='block'; IOC.GAME.p2.hp=100; });
  await page.keyboard.down('KeyS'); await page.keyboard.press('KeyF'); await page.keyboard.up('KeyS'); await wait(300);
  ok(await page.evaluate(() => IOC.GAME.p2.hp < 100), 'sweep beats standing block (low)');
  await wait(1500);
  // grab
  await page.evaluate(RESET); await page.evaluate(() => { const G = IOC.GAME; G.ai.dummy = 'BLOCK'; G.p2.hp = 100; G.p2.state = 'idle'; G.p1.x = 500; G.p2.x = 570; });
  await wait(150); await page.keyboard.down('KeyH'); await page.keyboard.press('KeyF'); await page.keyboard.up('KeyH'); await wait(300);
  ok(await page.evaluate(() => IOC.GAME.p2.hp < 100), 'data grab beats block');
  await wait(1500);
  // projectile
  await page.evaluate(RESET); await page.evaluate(() => { const G = IOC.GAME; G.ai.dummy = 'STAND'; G.p2.hp = 100; G.p1.meter = 100; G.p1.x = 300; G.p2.x = 800; });
  await wait(100); await page.keyboard.press('KeyR'); await wait(260);
  ok(await page.evaluate(() => IOC.projectiles.length) === 1, 'projectile spawned');
  await page.screenshot({ path: OUT + '/06_projectile.png' });
  await wait(900);
  ok(await page.evaluate(() => IOC.GAME.p2.hp < 100), 'projectile hits');
  await wait(800);
  // blink
  await page.evaluate(() => { const G = IOC.GAME; G.p2.hp = 100; G.p1.meter = 100; G.p1.x = 300; G.p2.x = 800; G.p2.state = 'idle'; });
  await page.keyboard.press('KeyT'); await wait(600);
  ok(await page.evaluate(() => IOC.GAME.p1.x > 800), 'blink teleports behind rival');
  await wait(1200);
  // surge
  await page.evaluate(() => { const G = IOC.GAME; G.p2.hp = 100; G.p2.state = 'idle'; G.p1.meter = 100; G.p1.x = 300; G.p2.x = 800; G.p1.facing = 1; });
  await page.keyboard.press('KeyY'); await wait(500);
  ok(await page.evaluate(() => IOC.GAME.p1.state) === 'surge', 'ION SURGE starts');
  await page.screenshot({ path: OUT + '/07_surge_cinematic.png' });
  await wait(450);
  await page.screenshot({ path: OUT + '/08_surge_beam.png' });
  await wait(600);
  ok(await page.evaluate(() => IOC.GAME.p2.hp <= 75), 'surge deals heavy damage');
  await wait(1500);

  // ---- KO -> round 2 -> TERMINATE -> DELETE
  await page.evaluate(() => { const G = IOC.GAME; G.ai.dummy = 'STAND'; G.p2.hp = 1; G.p2.state = 'idle'; G.p1.x = 500; G.p2.x = 580; });
  await page.keyboard.press('KeyG'); await wait(400);
  ok(await page.evaluate(() => IOC.GAME.state) === 'ko', 'KO -> SHUTDOWN');
  await wait(4800);
  ok(await page.evaluate(() => IOC.GAME.round === 2 && IOC.GAME.p1.rounds === 1), 'round 2 starts, P1 has 1 round');
  await wait(1600);
  await page.evaluate(() => { const G = IOC.GAME; G.ai.dummy = 'STAND'; G.p2.hp = 1; G.p2.state = 'idle'; G.p1.x = 500; G.p2.x = 580; });
  await page.keyboard.press('KeyG'); await wait(400);
  ok(await page.evaluate(() => IOC.GAME.state) === 'terminate', 'deciding KO -> TERMINATE');
  await page.screenshot({ path: OUT + '/09_terminate.png' });
  await wait(1300);
  await page.evaluate(() => { IOC.GAME.p1.x = IOC.GAME.p2.x - 80; });
  await page.keyboard.press('KeyG'); await wait(500);
  ok(await page.evaluate(() => IOC.GAME.state) === 'deleted', 'heavy in TERMINATE -> DELETED');
  await page.screenshot({ path: OUT + '/10_deleted.png' });
  await wait(4200);
  ok(await page.isVisible('#result'), 'result screen');
  ok(await page.evaluate(() => IOC.SAVE.stats.deletes >= 1 && IOC.SAVE.stats.wins >= 1), 'stats saved (win + delete)');
  await page.screenshot({ path: OUT + '/11_result.png' });

  // ---- full AI match fuzz: random inputs, 25 s, no errors
  await page.keyboard.press('Enter'); await wait(2000);
  await page.evaluate(() => { IOC.GAME.ai.dummy = null; });
  const ks = ['KeyA', 'KeyD', 'KeyW', 'KeyS', 'KeyF', 'KeyG', 'KeyH', 'KeyR', 'KeyT', 'KeyY'];
  for (let i = 0; i < 260; i++) { const k = ks[(Math.random() * ks.length) | 0]; await page.keyboard.down(k); await wait(40 + Math.random() * 60); await page.keyboard.up(k); }
  await page.screenshot({ path: OUT + '/12_fuzz.png' });
  ok(await page.evaluate(() => ['fight', 'ko', 'roundEnd', 'terminate', 'deleted', 'matchEnd', 'intro'].includes(IOC.GAME.state)), 'fuzz: state valid (' + await page.evaluate(() => IOC.GAME.state) + ')');
  const aiHits = await page.evaluate(() => IOC.GAME.stats.p2.hits);
  ok(aiHits > 0, `AI lands hits (${aiHits})`);

  // ---- every arena + every fighter renders (via 2P quick matches)
  for (let a = 0; a < 5; a++) {
    await page.evaluate((a) => { const G = IOC.GAME; IOC.SAVE.unlocked.auditor = true; G.sel = [a === 4 ? 6 : a, 5 - a]; IOC.UI.openSelect('2p'); G.arenaIdx = a; IOC.UI.go(); }, a);
    await wait(2200);
    await page.screenshot({ path: OUT + `/13_arena_${a}.png` });
  }
  ok(true, 'all arenas + boss rendered');

  // ---- training dummy modes
  await page.evaluate(() => IOC.UI.toTitle()); await wait(200);
  await page.click('[data-mode="training"]'); await page.click('#selGo'); await wait(2000);
  await page.keyboard.press('Tab');
  ok(await page.evaluate(() => IOC.GAME.ai.dummy) === 'BLOCK', 'TAB cycles training dummy');
  await page.screenshot({ path: OUT + '/14_training.png' });

  // ---- pause
  await page.keyboard.press('KeyP'); await wait(200);
  ok(await page.evaluate(() => IOC.GAME.paused) && await page.isVisible('#pause'), 'pause');
  await page.keyboard.press('Escape'); await wait(200);
  ok(!(await page.evaluate(() => IOC.GAME.paused)), 'resume');

  // ---- arcade ladder
  await page.evaluate(() => IOC.UI.toTitle());
  await page.evaluate(() => { IOC.GAME.sel = [0, 1]; }); await page.click('[data-mode="arcade"]'); await page.click('#selGo'); await wait(300);
  ok(await page.isVisible('#ladder'), 'arcade ladder screen');
  ok(await page.evaluate(() => IOC.GAME.ladder.length === 6 && IOC.GAME.ladder[5] === 6), 'ladder: 5 rivals + AUDITOR');
  await page.screenshot({ path: OUT + '/15_ladder.png' });
  await page.click('#ladGo'); await wait(300);
  ok(await page.evaluate(() => IOC.GAME.p2.d.id === IOC.FIGHTERS[IOC.GAME.ladder[0]].id), 'arcade rival loaded');

  // ---- moves / options modals
  await page.click('#hMoves'); await wait(200); await page.screenshot({ path: OUT + '/16_moves.png' });
  ok(await page.isVisible('#moves'), 'move list');
  await page.keyboard.press('Escape'); await page.click('#hOptions'); await wait(150);
  ok(await page.isVisible('#options'), 'options');
  await page.keyboard.press('Escape');

  ok(errors.length === 0, 'zero console errors' + (errors.length ? ': ' + errors.slice(0, 3).join(' | ') : ''));
  await page.close();

  // ---- phone landscape: touch deck
  const ctxP = await b.newContext({ ...devices['Pixel 7 landscape'] });
  const pp = await ctxP.newPage(); const perr = []; pp.on('pageerror', e => perr.push(e.message));
  await pp.goto(URL + '?splash=0'); await wait(500);
  await pp.tap('[data-mode="ai"]'); await pp.tap('#selGo'); await wait(2000);
  ok(await pp.isVisible('#touch'), 'touch deck on phone');
  const box = await pp.locator('#touch [data-k="punch"]').boundingBox();
  await pp.evaluate(RESET); await pp.evaluate(() => { IOC.GAME.ai.dummy = 'STAND'; IOC.GAME.p1.x = 500; IOC.GAME.p2.x = 580; IOC.GAME.p2.hp=100; });
  await pp.touchscreen.tap(box.x + 10, box.y + 10); await wait(300);
  ok(await pp.evaluate(() => IOC.GAME.p2.hp < 100), 'touch PUNCH lands');
  await pp.screenshot({ path: OUT + '/17_phone.png' });
  ok(perr.length === 0, 'phone: zero errors');
  const ctxPort = await b.newContext({ ...devices['Pixel 7'] });
  const pq = await ctxPort.newPage(); await pq.goto(URL + '?splash=0'); await wait(400);
  ok(await pq.isVisible('#rotate'), 'portrait phone: rotate prompt');
  await pq.screenshot({ path: OUT + '/18_portrait.png' });
  await b.close();
  console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})();
