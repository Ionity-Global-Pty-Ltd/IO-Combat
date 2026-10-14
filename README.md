# IONITY IO-COMBAT — GRID TOURNAMENT

> An original 2D arcade fighter in a single HTML file. Pick an avatar, win two rounds, then **TERMINATE** your rival before the clock runs out.

**Document ID:** GME-2026-10-011 · **Version:** 1.0.0 · **Classification:** PUBLIC (source published for reference)
**Author:** Johan Wilhelm van Antwerp · Ionity (Pty) Ltd · AEDI (Antwerp Ecosystems Designs Ionity) · ORCID [0009-0005-7181-0347](https://orcid.org/0009-0005-7181-0347)
**Governance:** Policy 986 AED · **License:** AED 900 · CC BY-NC-SA 4.0 where stated
**Play:** https://www.ionity.fun/combat/ · **Web:** https://www.ionity.today · https://www.ionity.world · Ref: https://www.ionity.co.za · Contact: ai@ionity.today
**Sister game:** [IO-MAN — Get Over It Door](https://www.ionity.fun) (GME-2026-09-002)

![IO-COMBAT](banner_og_1200x630.png)

---

## Play

Open `index.html` (identical to `IONITY_IO-COMBAT.html`) in any modern browser, or play at https://www.ionity.fun/combat/. Nothing to install, and it works offline (only the display fonts come from Google Fonts, with fallbacks).
On phones, play in **landscape**. Portrait shows a rotate screen and pauses the game. Touch controls appear by themselves.

| Action | P1 keyboard | P2 keyboard (2P) | Gamepad | Touch |
|---|---|---|---|---|
| Move · dash | `A`/`D` · double-tap | `◀`/`▶` · double-tap | stick / d-pad | ◀ ▶ |
| Jump · crouch | `W` (or `Space`) · `S` | `▲` · `▼` | A / up · down | ▲ ▼ |
| Punch (3 in a row = **TRIPLE**) | `F` | `J` / Num1 | X | PUNCH |
| Kick | `G` | `K` / Num2 | Y | KICK |
| **SWEEP** (low, knocks down) | `S`+`F` | `▼`+`J` | down + X | ▼ + PUNCH |
| **UPLINK** launcher | `S`+`G` | `▼`+`K` | down + Y | ▼ + KICK |
| Jump-in punch / kick (overhead) | `F` / `G` in the air | `J` / `K` in the air | X / Y in the air | in the air |
| Block · low block | hold `H` · `S`+`H` | `L` / Num3 · `▼`+`L` | RB / RT | BLOCK |
| **DATA GRAB** (beats block) | `H`+`F` up close | `L`+`J` | RB + X | BLOCK + PUNCH |
| Element projectile (30 ION) | `R` | `U` / Num4 | B | BLAST |
| Blink strike: teleport behind (40 ION) | `T` | `I` / Num5 | LB | BLINK |
| **ION SURGE** super beam (100 ION) | `Y` | `O` / Num6 | LT | SURGE |
| Pause · mute · music | `P`/`Esc` · `M` · `N` | | Start | II |
| Training dummy mode | `Tab` | | | |

In 1P modes, the arrow keys and `J K L U I O` also control P1.

## Rules of the Grid

- **Matches:** best of 3 by default (Options: 1–3 rounds to win), with a 99-second timer (60, 99 or 150).
- **Blocking:**
  - A standing block stops highs, mids and jump-ins.
  - A **crouch block** stops sweeps but not jump-ins.
  - **Punches whiff over crouchers.**
  - **Grabs beat blocking.**
  - Specials and SURGE chip through blocks.
- **ION meter:** fills as you deal and take hits, plus a slow trickle over time. 30 buys a projectile, 40 a blink and 100 an **ION SURGE**. A SURGE is a cinematic freeze followed by a full-screen beam, and you can jump over it.
- **Finisher:** the KO that decides the match triggers **TERMINATE!** The loser is left dizzy, and you have 4 seconds to land a kick, UPLINK, special, blink or SURGE. That **DELETES** the rival (they derez into data cubes). If you're too slow, the rival is **SPARED**.
- **Combos:**
  - Hits within 70 frames chain into a combo. Damage scales down after 3 hits.
  - UPLINK launches the rival into a juggle, up to 4 hits.
  - Every third punch in a chain is a **TRIPLE**: ×1.6 damage and a knockdown.
- **Elements** (applied by projectiles and SURGE):

| Element | Fighter | Effect |
|---|---|---|
| ION | IO-MAN | big knockback ("IONISED") |
| VOLT | VOLTA | extra stun |
| CRYO | CRYO-CORE | freeze, about 1 s |
| VOID | NULL | drains 25 ION from the rival, gives you 10 |
| SPORE | MYCELIA | poison over time |
| FIRE | BLAZE-443 | burn over time |
| AUDIT | THE AUDITOR | the hardest-hitting beam, plus an ION fine |

Damage over time can never land the final KO.

## Roster (all original Ionity characters)

| Fighter | Title | Blast · Blink · Surge | Power / Speed / Defence |
|---|---|---|---|
| **IO-MAN** | Axe of Ions · Hero of the Grid (from *Get Over It Door*) | ION AXE · PACKET DASH · GET OVER IT | 90 / 90 / 88 |
| **VOLTA** | Edge Node Sentinel | EDGE ARC · SPARK HOP · GRID OVERLOAD | 84 / 98 / 80 |
| **CRYO-CORE** | Coolant Daemon of the Server Hall | COOLANT LANCE · FROST BLINK · ABSOLUTE IDLE | 86 / 84 / 96 |
| **NULL** | Void Pointer Assassin | SEGFAULT ORB · NULL BLINK · UNDEFINED | 88 / 94 / 82 |
| **MYCELIA** | Spore Witch of the Root | SPORE CLOUD · ROOT WALK · GREAT BLOOM | 85 / 88 / 90 |
| **BLAZE-443** | Firewall Gate Guardian | PORT BLAST · FLARE STEP · DENY ALL | 97 / 80 / 90 |
| **THE AUDITOR** (boss) | Governance Overlord | COMPLIANCE BEAM · SUBPOENA · FULL AUDIT | 100 / 86 / 100 |

The stats feed the formulas directly: damage scales with power ÷ defence, and walk and jump speeds scale with speed. THE AUDITOR is 10% larger. It is **locked until you clear Arcade once**.

## Modes

- **Arcade Ladder:** five random rivals, then THE AUDITOR in the ROOT CAVERN. The CPU gets one step harder for the last two fights. A loss offers CONTINUE without losing ladder progress, and clearing the ladder unlocks the boss.
- **Versus AI:** you choose the rival, arena and CPU level: EASY / NORMAL / IRON.
- **2P Local:** two players on one keyboard, or two gamepads.
- **Training:** no timer, and health and ION refill. `Tab` cycles the dummy through STAND / BLOCK / LOW BLOCK / JUMP / CPU.

## Arenas

| Arena | Scenery |
|---|---|
| **SERVER CORE** | racks with live LEDs and the IONITY sign |
| **FIREWALL GATE** | burning brick firewall with embers |
| **DATA FOREST** | binary leaves and fireflies |
| **UPLINK BRIDGE** | antenna towers, a data sea and rain |
| **ROOT CAVERN** | the dormant fungus eye, glowing mushrooms and rising spores (the boss arena) |

## What's new vs. the prototype it was built from

IO-COMBAT started from a generic HTML5 fighting-game prototype. It was rebuilt and rebranded for Ionity: every franchise character, name, catchphrase and gore effect was replaced with original Ionity content.

**Engine**
- **Fixed 60 Hz simulation:** the game runs at the same speed on 60, 120 and 144 Hz screens. The prototype ran twice as fast on 120 Hz.
- **Unified input:** keyboard, gamepad, touch and AI all drive the same pad.
- **Input buffering:** a 6-frame buffer that also remembers whether down or block was held when the button was pressed.
- **Feel:** frame data for every move (startup, active, recovery), hit-stop, pose blending, afterimages, push boxes, wall handling and juggle limits.

**Combat**
- **Moves:** high/low/overhead blocking, grabs, sweeps, the launcher, air attacks, dashes and back-dash invulnerability.
- **Systems:** projectile clashes, element status effects, combo scaling, the ION SURGE super and the TERMINATE → DELETE finisher.

**AI**
- **Reaction delay:** it reads a delayed snapshot of you, from 24 frames on EASY down to 7 on IRON.
- **Defence:** it blocks high or low and anti-airs jump-ins.
- **Offence:** it punishes whiffs, grabs players who turtle, zones with projectiles and spends its SURGE when the beam will connect.

**Presentation**
- An IONITY logo splash, a CPU-vs-CPU demo running behind the title, and canvas portraits on the select screen.
- An arcade ladder screen, a glitch-style announcer, an animated HUD (skewed health bars, hex round pips and the ION meter) and status chips.

**Audio**
- Synthesised sound effects for every action.
- Three original chiptune loops: **GRID PULSE** (menu), **OVERRIDE** (fight) and **ROOT PROTOCOL** (boss).

**Platform**
- Fullscreen with a landscape lock, the rotate screen, DPR-sharp rendering, a touch deck and haptics.
- Options: difficulty, rounds, timer, SFX and music volume, screen shake, reduced flashing and touch mode.
- Local stats saved on the device (wins, losses, best streak, perfects, deletes, arcade clears) and a share button.

**Brand**
- Ionity palette (`#00c6ff` / `#1658A4` on `#0d1b2a`), the official IONITY logo vector and the footer links.
- Policy 986 AED and AED 900 notices, plus a link back to IO-MAN.

## Build & verify

The game is a single file (~1,880 lines, ~150 KB) of vanilla JS and canvas, with no frameworks. `src/` holds the readable parts, and `build.py` assembles `index.html`, inlining the IONITY logo from `assets/logo/IONITY_logo_vector.svg`.

v1.0.0 was verified headless in Chromium with Playwright (`tests/t10.js`). **43 of 43 checks pass, twice in a row, with zero console errors.** The checks cover:
- **Screens:** splash, title, attract demo, select (keyboard and right-click), and the boss lock.
- **Timing:** the round intro and the fixed-step timer.
- **Moves:** punch, UPLINK launch, standing block, sweep beating a standing block, grab beating a block, projectile spawn and hit, blink behind, and SURGE damage.
- **Match flow:** KO → SHUTDOWN → round 2 → TERMINATE → DELETED → results, plus saved stats.
- **Stress:** a 260-input random fuzz against the live AI.
- **Rendering:** all 5 arenas and the boss.
- **Menus:** training dummy cycling, pause and resume, the arcade ladder (5 rivals + AUDITOR), the move list and options.
- **Phones:** the Pixel 7 landscape touch deck (a PUNCH tap lands) and the Pixel 7 portrait rotate prompt.

```
sha256  index.html / IONITY_IO-COMBAT.html   e1d94291cd3496618a96d32c5fb6caa643a765ee32df96e21b22045b32ae2788   v1.0.0
```

## Repository layout

```
index.html                 v1.0.0, also served at ionity.fun/combat/
IONITY_IO-COMBAT.html      v1.0.0 (same file, descriptive name)
banner_og_1200x630.png     social / OG banner
src/                       readable source parts (head, body, core, fighter, world, game, ui)
build.py                   assembles index.html from src/
assets/logo/               official IONITY logo vector
previews/                  headless screenshots
tests/t10.js               v1.0 verification suite (Playwright + Chromium)
README.md · LICENSE
```

---

© 2018–2026 Antwerp Designs | Ionity (Pty) Ltd · All rights reserved · TM2 · Policy 986 AED · AED 900
All characters, arenas, music and sounds in IO-COMBAT are original. IO-COMBAT is not affiliated with, or endorsed by, any other fighting-game franchise.
Ionity refers exclusively to www.ionity.today / www.ionity.world / ionity.fun and is not affiliated with www.ionity.com.

**BUILDING TOMORROW, TODAY** · *Anything is Possible with God.*
