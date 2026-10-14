// IO-COMBAT v1.1 feature suite (Playwright + Chromium): fullscreen layout, signatures, guard, breaker, overclock, survival, colours, camera
const { chromium, devices } = require('playwright');
const path = require('path');
const URL = 'file://' + path.resolve(__dirname, process.env.PAGE || '../index.html');
const OUT = path.resolve(__dirname, '../previews');
require('fs').mkdirSync(OUT, { recursive: true });
let pass = 0, fail = 0; const ok = (c, m) => { if (c) { pass++; console.log('  PASS', m); } else { fail++; console.log('  FAIL', m); } };
const wait = (ms) => new Promise(r => setTimeout(r, ms));
const RESET = `const G=IOC.GAME;[G.p1,G.p2].forEach(f=>{f.state='idle';f.f=0;f.vx=0;f.vy=0;f.y=604;f.freeze=0;f.move=null;f.invuln=0;f.juggle=0;f.hp=100;});IOC.projectiles.length=0;`;

(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROME || '/opt/pw-browsers/chromium' });
  const page = await b.newPage({ viewport: { width: 1600, height: 900 } });
  const errors = []; page.on('pageerror', e => errors.push(e.stack));
  await page.goto(URL + '?splash=0'); await wait(500);

  // ---- fullscreen-first layout
  const box = await page.locator('#cv').boundingBox();
  const bar = await page.locator('#ctrlBar').boundingBox();
  ok(bar && Math.abs(box.height + bar.height - 900) < 3 && bar.y >= box.y + box.height - 1, `canvas + controls bar below fill the viewport (${box.width | 0}x${box.height | 0} + bar ${bar ? bar.height | 0 : 0})`);
  ok(await page.isVisible('#tools #hFull'), 'floating toolbar with fullscreen button');
  ok(await page.evaluate(() => !!document.querySelector('link[rel=manifest]')), 'PWA manifest linked (display: fullscreen)');
  await page.setViewportSize({ width: 1000, height: 900 }); await wait(200);
  const b2 = await page.locator('#cv').boundingBox();
  ok(Math.abs(b2.width / b2.height - 16 / 9) < 0.02 && b2.width >= 995, 'letterboxed 16:9 on tall window');
  await page.setViewportSize({ width: 1600, height: 900 }); await wait(200);
  await page.screenshot({ path: OUT + '/20_fullscreen_title.png' });

  // ---- start a versus match
  await page.evaluate(() => { IOC.GAME.sel = [0, 1]; });
  await page.click('[data-mode="ai"]'); await page.click('#selGo'); await wait(2000);
  await wait(3200);
  ok(await page.evaluate(() => document.getElementById('tools').classList.contains('dim')), 'toolbar fades during fights');

  // ---- every signature move
  const sigs = [];
  for (let i = 0; i < 7; i++) {
    await page.evaluate((i) => { const G = IOC.GAME; G.p1 = new (G.p1.constructor)(1, IOC.FIGHTERS[i], 400, 1, IOC.PADS[0]); G.ai.me = G.p2; G.ai.opp = G.p1; G.ai.dummy = 'STAND'; }, i);
    await page.evaluate(RESET);
    await page.evaluate((i) => { const G = IOC.GAME; G.p1.meter = 100; G.p1.x = i === 6 ? 520 : 400; G.p2.x = i === 0 ? 470 : 640; G.p2.state = 'idle'; if (i === 0) { G.p2.y = 470; G.p2.vy = -2; G.p2.state = 'jump'; } }, i);
    await page.keyboard.down('KeyS'); await page.keyboard.press('KeyR'); await page.keyboard.up('KeyS');
    if (i === 4) { await wait(500); await page.evaluate(() => { const G = IOC.GAME; const h = IOC.hazards.find(h => h.type === 'trap'); if (h) G.p2.x = h.x; }); }
    await wait(1300);
    const r = await page.evaluate((i) => { const G = IOC.GAME; return { name: G.p1.d.sig.name, hp: G.p2.hp, hz: IOC.hazards.map(h => h.type).join(','), x1: G.p1.x | 0, x2: G.p2.x | 0, meter: G.p1.meter | 0 }; }, i);
    sigs.push(r);
    if (i === 2) await page.screenshot({ path: OUT + '/21_sig_glacier_wall.png' });
    if (i === 5) { await page.screenshot({ path: OUT + '/22_sig_flame_pillar.png' }); }
    const okSig = i === 2 ? r.hz.includes('wall') || r.hp < 100 : i === 3 ? r.x1 > r.x2 : r.hp < 100;
    ok(okSig, `signature ${r.name}: ${JSON.stringify(r)}`);
    await wait(900);
  }

  // ---- perfect guard
  await page.evaluate(() => { const G = IOC.GAME; G.p1 = new (G.p1.constructor)(1, IOC.FIGHTERS[0], 400, 1, IOC.PADS[0]); G.ai.opp = G.p1; G.ai.dummy = 'STAND'; });
  await page.evaluate(RESET);
  await page.evaluate(() => { const G = IOC.GAME; G.p1.x = 500; G.p2.x = 580; G.p2.state = 'attack'; G.p2.move = 'kick'; G.p2.f = 5; G.p2.facing = -1; G.p2.hasHit = false; IOC.PADS[0].set('block', true, 't'); });
  await wait(250);
  const pg = await page.evaluate(() => ({ hp: IOC.GAME.p1.hp, st: IOC.GAME.p2.state, m: IOC.GAME.p1.meter | 0 }));
  await page.evaluate(() => IOC.PADS[0].set('block', false, 't'));
  ok(pg.hp === 100 && pg.st === 'hitstun', 'PERFECT GUARD staggers the attacker ' + JSON.stringify(pg));

  // ---- ION breaker
  await wait(500); await page.evaluate(RESET);
  await page.evaluate(() => { const G = IOC.GAME; G.p1.x = 500; G.p2.x = 590; G.p1.meter = 60; G.p1.state = 'hitstun'; G.p1.stun = 40; G.p1.f = 0; G.p2.combo = 3; });
  await page.keyboard.down('KeyH'); await page.keyboard.press('KeyG'); await page.keyboard.up('KeyH'); await wait(200);
  const br = await page.evaluate(() => ({ s: IOC.GAME.p1.state, m: IOC.GAME.p1.meter | 0, dx: Math.abs(IOC.GAME.p2.x - IOC.GAME.p1.x) | 0 }));
  ok((br.s === 'breaker' || br.m < 15) && br.dx > 120, 'ION BREAKER pushes the rival away ' + JSON.stringify(br));
  await page.screenshot({ path: OUT + '/23_breaker.png' });

  // ---- overclock
  await wait(700); await page.evaluate(RESET);
  await page.evaluate(() => { IOC.GAME.p1.hp = 20; }); await wait(200);
  ok(await page.evaluate(() => IOC.GAME.p1.oc), 'OVERCLOCK below 25% health');
  await page.evaluate(() => { const G = IOC.GAME; G.p1.x = 500; G.p2.x = 580; G.p2.hp = 100; });
  await page.keyboard.press('KeyF'); await wait(300);
  const ocd = await page.evaluate(() => 100 - IOC.GAME.p2.hp);
  ok(ocd > 6.0, `overclocked punch hits harder (${ocd.toFixed(2)} > 6)`);

  // ---- camera zoom
  await page.evaluate(() => { const G = IOC.GAME; G.p1.x = 560; G.p2.x = 640; }); await wait(900);
  ok(await page.evaluate(() => IOC.GAME.cam.z > 1.08), 'dynamic camera zooms in at close range (' + (await page.evaluate(() => IOC.GAME.cam.z)).toFixed(2) + ')');
  await page.screenshot({ path: OUT + '/24_camera_zoom.png' });

  // ---- mirror match colours
  await page.evaluate(() => { IOC.UI.toTitle(); IOC.GAME.sel = [2, 2]; IOC.GAME.alt = [false, false]; });
  await page.click('[data-mode="2p"]'); await page.evaluate(() => { IOC.GAME.sel = [2, 2]; IOC.UI.refreshSelect(); });
  await page.keyboard.press('KeyG'); await wait(100);
  ok(await page.evaluate(() => IOC.GAME.alt[0]), 'G toggles P1 alternate colours');
  await page.screenshot({ path: OUT + '/25_select_colours.png' });
  await page.keyboard.press('KeyG');
  await page.click('#selGo'); await wait(1800);
  ok(await page.evaluate(() => IOC.GAME.p1.d.c1 !== IOC.GAME.p2.d.c1), 'mirror match: P2 auto alternate colours');
  await page.screenshot({ path: OUT + '/26_mirror.png' });

  // ---- survival
  await page.evaluate(() => { IOC.UI.toTitle(); IOC.GAME.sel = [1, 0]; });
  await page.click('[data-mode="survival"]'); await page.click('#selGo'); await wait(2000);
  ok(await page.evaluate(() => IOC.GAME.mode === 'survival' && IOC.GAME.need() === 1), 'survival: single-round fights');
  await page.evaluate(() => { IOC.GAME.ai.dummy = 'STAND'; }); await wait(300); await page.evaluate(RESET);
  await page.evaluate(() => { const G = IOC.GAME; G.ai.dummy = 'STAND'; G.p1.hp = 70; G.p2.hp = 1; G.p2.state = 'idle'; G.p1.x = 500; G.p2.x = 580; G.p1.state = 'idle'; });
  await page.keyboard.press('KeyG'); await wait(400);
  ok(await page.evaluate(() => IOC.GAME.state) === 'terminate', 'survival KO goes straight to TERMINATE');
  await page.evaluate(() => { IOC.GAME.p1.x = IOC.GAME.p2.x - 80; IOC.GAME.p1.state = 'idle'; }); await page.keyboard.press('KeyG'); await wait(4300);
  ok(await page.isVisible('#result') && (await page.textContent('#rPrimary')).includes('NEXT'), 'survival win -> NEXT CHALLENGER');
  await page.screenshot({ path: OUT + '/27_survival_result.png' });
  await page.click('#rPrimary'); await wait(1800);
  const sv = await page.evaluate(() => ({ w: IOC.GAME.survival.wins, hp: IOC.GAME.p1.hp, best: IOC.SAVE.stats.survivalBest }));
  ok(sv.w === 1 && sv.hp > 90 && sv.hp <= 100 && sv.best >= 1, 'survival carries health (+25) and saves best ' + JSON.stringify(sv));

  // ---- AI uses signatures in a long CPU vs CPU soak
  await page.evaluate(() => { IOC.UI.toTitle(); }); await wait(200);
  await page.evaluate(() => { IOC.GAME.sel = [5, 4]; IOC.SAVE.settings.diff = 2; });
  await page.click('[data-mode="ai"]'); await page.click('#selGo'); await wait(1600);
  await page.evaluate(() => { const G = IOC.GAME; G.ai1 = new (G.ai.constructor)(G.p1, G.p2, 2); window.__soak = setInterval(() => G.ai1.think(G), 16); G.p1.meter = 100; G.p2.meter = 100; });
  let sawSig = false;
  for (let k = 0; k < 64; k++) { await wait(250); if (await page.evaluate(() => IOC.GAME.p1.state === 'sig' || IOC.GAME.p2.state === 'sig' || IOC.hazards.length > 0)) sawSig = true; await page.evaluate(() => { IOC.GAME.p1.meter = Math.max(IOC.GAME.p1.meter, 40); IOC.GAME.p2.meter = Math.max(IOC.GAME.p2.meter, 40); }); }
  await page.evaluate(() => clearInterval(window.__soak));
  ok(sawSig, 'CPU uses signature moves');
  await page.screenshot({ path: OUT + '/28_cpu_soak.png' });

  ok(errors.length === 0, 'zero console errors' + (errors.length ? ': ' + errors.slice(0, 2).join(' | ') : ''));
  await page.close();

  // ---- phone: fills the screen
  const ctxP = await b.newContext({ ...devices['Pixel 7 landscape'] });
  const pp = await ctxP.newPage(); await pp.goto(URL + '?splash=0'); await wait(500);
  const vb = pp.viewportSize(), cb = await pp.locator('#cv').boundingBox();
  ok(cb.height >= vb.height - 2 || cb.width >= vb.width - 2, `phone: canvas fills the screen (${cb.width | 0}x${cb.height | 0} in ${vb.width}x${vb.height})`);
  await pp.tap('[data-mode="ai"]'); await pp.tap('#selGo'); await wait(2000);
  await pp.screenshot({ path: OUT + '/29_phone_full.png' });
  await b.close();
  console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})();
