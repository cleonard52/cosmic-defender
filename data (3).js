// --- AUDIO SYSTEM ---
let audioCtx = null;
let musicInterval = null;
let currentBeat = 0;

const NOTES = {
  C3: 130.81, D3: 146.83, E3: 164.81, F3: 174.61, G3: 196.00, A3: 220.00, B3: 246.94,
  C4: 261.63, D4: 293.66, E4: 329.63, F4: 349.23, G4: 392.00, A4: 440.00, B4: 493.88,
  C5: 523.25, D5: 587.33, E5: 659.25
};

const BASS_LINE = [
  'A3', 'A3', 'C4', 'A3', 'G3', 'G3', 'B3', 'G3',
  'F3', 'F3', 'A3', 'F3', 'E3', 'G3', 'B3', 'E3'
];

const MELODY = [
  'A4', null, 'C5', 'B4', null, 'G4', 'A4', null,
  'F4', 'A4', 'C5', 'E5', 'D5', null, 'B4', null
];

function initAudio() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
}

function playTone(freq, type, duration, volume) {
  if (!audioCtx) return;
  try {
    const osc = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gainNode.gain.setValueAtTime(volume, audioCtx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.00001, audioCtx.currentTime + duration);
    osc.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + duration);
  } catch (e) {}
}

function startMusic() {
  initAudio();
  if (musicInterval) clearInterval(musicInterval);
  const stepDuration = 60 / 130 / 2;
  musicInterval = setInterval(() => {
    if (typeof gameState === "undefined" || gameState !== "PLAYING") return;
    const bassNote = BASS_LINE[currentBeat % BASS_LINE.length];
    if (bassNote && NOTES[bassNote]) {
      playTone(NOTES[bassNote], 'sawtooth', stepDuration * 0.9, 0.06);
    }
    const leadNote = MELODY[currentBeat % MELODY.length];
    if (leadNote && NOTES[leadNote]) {
      playTone(NOTES[leadNote], 'square', stepDuration * 1.5, 0.03);
    }
    currentBeat++;
  }, stepDuration * 1000);
}

function stopMusic() {
  if (musicInterval) {
    clearInterval(musicInterval);
    musicInterval = null;
  }
}

// --- SHIP DEFINITIONS ---
const SHIPS = {
  vanguard: {
    id: "vanguard",
    name: "Vanguard",
    weaponName: "Pulse Repeater",
    unlockCost: 0,
    evoCosts: [0, 2, 5],
    hpMult: 1.0,
    spdMult: 1.0,
    dmgMult: 1.0,
    fireDelay: 230,
    baseShield: 0,
    baseCrit: 0.05,
    magnetMult: 1.0,
    masteryDesc: "+15% Bullet Speed & +4% Crit/Lv",
    tiers: [
      "Mk. I: Single forward plasma bolt.",
      "Mk. II: Twin Linked Lasers with higher velocity.",
      "Mk. III: Tri-Beam Plasma Lance with wide spread."
    ]
  },
  crimson: {
    id: "crimson",
    name: "Crimson Interceptor",
    weaponName: "Scatter Flak",
    unlockCost: 3,
    evoCosts: [0, 4, 7],
    hpMult: 0.8,
    spdMult: 1.25,
    dmgMult: 0.55,
    fireDelay: 340,
    baseShield: 0,
    baseCrit: 0.08,
    magnetMult: 1.1,
    masteryDesc: "+1 Flak Pellet & Tighter Spread/Lv",
    tiers: [
      "Mk. I: 4-pellet close-range shrapnel burst.",
      "Mk. II: 6 incendiary pellets that ignite targets.",
      "Mk. III: 8 high-velocity Hellfire pellets."
    ]
  },
  aegis: {
    id: "aegis",
    name: "Aegis Dreadnought",
    weaponName: "Heavy Rail-Cannon",
    unlockCost: 5,
    evoCosts: [0, 6, 10],
    hpMult: 1.5,
    spdMult: 0.85,
    dmgMult: 1.75,
    fireDelay: 420,
    baseShield: 40,
    baseCrit: 0.05,
    magnetMult: 1.0,
    masteryDesc: "+1 Rail Pierce & +15% Slug Size/Lv",
    tiers: [
      "Mk. I: Thick piercing rail-slug (+2 pierce).",
      "Mk. II: Twin Gauss Slugs with shock trails.",
      "Mk. III: Siege Beam causing electric shockwaves."
    ]
  },
  void: {
    id: "void",
    name: "Void Phantom",
    weaponName: "Seeking Void Orbs",
    unlockCost: 8,
    evoCosts: [0, 9, 14],
    hpMult: 0.95,
    spdMult: 1.1,
    dmgMult: 0.9,
    fireDelay: 300,
    baseShield: 15,
    baseCrit: 0.15,
    magnetMult: 2.0,
    masteryDesc: "+20% Homing Turn & AoE Radius/Lv",
    tiers: [
      "Mk. I: Homing void spheres that curve to foes.",
      "Mk. II: Rift Seekers split into mini-orbs on hit.",
      "Mk. III: Singularity Orbs pull & detonate foes."
    ]
  }
};

// --- META & SAVE STATE ---
const DEFAULT_META = {
  scrap: 0,
  darkMatter: 0,
  prestigeCount: 0,
  highestSector: 0,
  bestRunBosses: 0,
  hpLv: 0,
  dmgLv: 0,
  spdLv: 0,
  rofLv: 0,
  mastLv: 0,
  equippedShip: "vanguard",
  unlockedShips: { vanguard: true, crimson: false, aegis: false, void: false },
  shipTiers: { vanguard: 1, crimson: 1, aegis: 1, void: 1 },
  reviveLv: 0,
  headstartLv: 0,
  dmMultLv: 0,
  scrapMultLv: 0
};

let meta = Object.assign({}, DEFAULT_META, JSON.parse(localStorage.getItem("cosmicRogueMetaV2") || "{}"));
meta.unlockedShips = Object.assign({}, DEFAULT_META.unlockedShips, meta.unlockedShips);
meta.shipTiers = Object.assign({}, DEFAULT_META.shipTiers, meta.shipTiers);

function saveMeta() {
  localStorage.setItem("cosmicRogueMetaV2", JSON.stringify(meta));
  updateMetaUI();
}

function calcPrestigeReward() {
  if (meta.highestSector < 15) return 0;
  const sectorBonus = Math.floor((meta.highestSector - 10) / 5) + 1;
  const bossBonus = meta.bestRunBosses || 0;
  const scrapBonus = Math.floor(meta.scrap / 300);
  const raw = sectorBonus + bossBonus + scrapBonus;
  const mult = 1 + meta.dmMultLv * 0.25;
  return Math.max(1, Math.ceil(raw * mult));
}

function performPrestige() {
  const reward = calcPrestigeReward();
  if (reward <= 0) return;
  meta.darkMatter += reward;
  meta.prestigeCount++;
  meta.scrap = 0;
  meta.highestSector = 0;
  meta.bestRunBosses = 0;
  meta.hpLv = 0;
  meta.dmgLv = 0;
  meta.spdLv = 0;
  meta.rofLv = 0;
  meta.mastLv = 0;
  playTone(523.25, 'sine', 0.25, 0.1);
  playTone(659.25, 'sine', 0.35, 0.1);
  saveMeta();
}

function updateMetaUI() {
  const scrapEl = document.getElementById("scrap-el");
  const dmEl = document.getElementById("dm-el");
  if (scrapEl) scrapEl.textContent = meta.scrap;
  if (dmEl) dmEl.textContent = meta.darkMatter;

  const shopScrap = document.getElementById("shop-scrap-val");
  const shopDm = document.getElementById("shop-dm-val");
  if (shopScrap) shopScrap.textContent = meta.scrap;
  if (shopDm) shopDm.textContent = meta.darkMatter;

  const ship = SHIPS[meta.equippedShip] || SHIPS.vanguard;
  const tier = meta.shipTiers[ship.id] || 1;
  const shipLabel = document.getElementById("equipped-ship-label");
  if (shipLabel) shipLabel.textContent = `${ship.name} Mk. ${"I".repeat(tier)}`;

  // Scrap Shop Buttons
  const scrapItems = [
    { id: "hp", lv: meta.hpLv, cost: 15 + meta.hpLv * 10 },
    { id: "dmg", lv: meta.dmgLv, cost: 20 + meta.dmgLv * 15 },
    { id: "spd", lv: meta.spdLv, cost: 15 + meta.spdLv * 10 },
    { id: "rof", lv: meta.rofLv, cost: 25 + meta.rofLv * 15 },
    { id: "mast", lv: meta.mastLv, cost: 30 + meta.mastLv * 20 }
  ];

  scrapItems.forEach(item => {
    const lvEl = document.getElementById(`meta-${item.id}-lv`);
    const btn = document.getElementById(`buy-${item.id}-btn`);
    if (lvEl) lvEl.textContent = item.lv;
    if (btn) {
      btn.textContent = `${item.cost} Scrap`;
      btn.disabled = meta.scrap < item.cost;
    }
  });

  // Render Dark Matter Ship Cards
  const shipGrid = document.getElementById("dm-ship-list");
  if (shipGrid) {
    shipGrid.innerHTML = "";
    Object.values(SHIPS).forEach(s => {
      const unlocked = !!meta.unlockedShips[s.id];
      const curTier = meta.shipTiers[s.id] || 1;
      const isEquipped = meta.equippedShip === s.id;
      const card = document.createElement("div");
      card.className = `ship-card ${isEquipped ? "equipped" : ""}`;

      let actionHtml = "";
      if (!unlocked) {
        const canBuy = meta.darkMatter >= s.unlockCost;
        actionHtml = `<button class="dm-btn" ${canBuy ? "" : "disabled"} onclick="buyShip('${s.id}')">Unlock (${s.unlockCost} DM)</button>`;
      } else {
        const equipBtn = isEquipped
          ? `<button class="meta-btn" disabled>Equipped</button>`
          : `<button class="meta-btn" onclick="equipShip('${s.id}')">Equip</button>`;
        let evoBtn = "";
        if (curTier < 3) {
          const evoCost = s.evoCosts[curTier];
          const canEvo = meta.darkMatter >= evoCost;
          evoBtn = `<button class="dm-btn" ${canEvo ? "" : "disabled"} onclick="evolveShip('${s.id}')">Mk.${"I".repeat(curTier + 1)} (${evoCost} DM)</button>`;
        } else {
          evoBtn = `<button class="dm-btn" disabled>MAX Mk.III</button>`;
        }
        actionHtml = `<div class="ship-actions">${equipBtn}${evoBtn}</div>`;
      }

      card.innerHTML = `
        <div class="ship-header">
          <span class="ship-title">${s.name} ${unlocked ? `Mk.${"I".repeat(curTier)}` : ""}</span>
          <span class="ship-weapon">${s.weaponName}</span>
        </div>
        <div class="ship-desc">${s.tiers[curTier - 1]}</div>
        ${actionHtml}
      `;
      shipGrid.appendChild(card);
    });
  }

  // Render Dark Matter Perks
  const dmPerks = [
    { id: "revive", lv: meta.reviveLv, max: 3, cost: 4 + meta.reviveLv * 4 },
    { id: "headstart", lv: meta.headstartLv, max: 2, cost: 5 + meta.headstartLv * 6 },
    { id: "dmmult", lv: meta.dmMultLv, max: 5, cost: 4 + meta.dmMultLv * 3 },
    { id: "scrapmult", lv: meta.scrapMultLv, max: 5, cost: 3 + meta.scrapMultLv * 3 }
  ];

  dmPerks.forEach(p => {
    const lvEl = document.getElementById(`dm-${p.id}-lv`);
    const btn = document.getElementById(`buy-dm-${p.id}-btn`);
    if (lvEl) lvEl.textContent = `${p.lv}/${p.max}`;
    if (btn) {
      if (p.lv >= p.max) {
        btn.textContent = "MAXED";
        btn.disabled = true;
      } else {
        btn.textContent = `${p.cost} DM`;
        btn.disabled = meta.darkMatter < p.cost;
      }
    }
  });

  // Prestige Button
  const prestigeBtn = document.getElementById("prestige-btn");
  const prestigeStatus = document.getElementById("prestige-status");
  const reward = calcPrestigeReward();
  if (prestigeBtn && prestigeStatus) {
    if (meta.highestSector >= 15) {
      prestigeBtn.disabled = false;
      prestigeBtn.textContent = `PRESTIGE (+${reward} DM)`;
      prestigeStatus.textContent = `Best: Sector ${meta.highestSector} | Rank ${meta.prestigeCount}`;
    } else {
      prestigeBtn.disabled = true;
      prestigeBtn.textContent = "PRESTIGE (Req. Sector 15)";
      prestigeStatus.textContent = `Best: Sector ${meta.highestSector}/15 | Rank ${meta.prestigeCount}`;
    }
  }
}

window.buyShip = function(id) {
  const s = SHIPS[id];
  if (s && !meta.unlockedShips[id] && meta.darkMatter >= s.unlockCost) {
    meta.darkMatter -= s.unlockCost;
    meta.unlockedShips[id] = true;
    meta.equippedShip = id;
    saveMeta();
  }
};

window.equipShip = function(id) {
  if (meta.unlockedShips[id]) {
    meta.equippedShip = id;
    saveMeta();
  }
};

window.evolveShip = function(id) {
  const s = SHIPS[id];
  const curTier = meta.shipTiers[id] || 1;
  if (s && meta.unlockedShips[id] && curTier < 3) {
    const cost = s.evoCosts[curTier];
    if (meta.darkMatter >= cost) {
      meta.darkMatter -= cost;
      meta.shipTiers[id] = curTier + 1;
      saveMeta();
    }
  }
};

function bindShopButtons() {
  const bindScrap = (btnId, key, base, step) => {
    const btn = document.getElementById(btnId);
    if (btn) {
      btn.onclick = () => {
        const cost = base + meta[key] * step;
        if (meta.scrap >= cost) { meta.scrap -= cost; meta[key]++; saveMeta(); }
      };
    }
  };
  bindScrap("buy-hp-btn", "hpLv", 15, 10);
  bindScrap("buy-dmg-btn", "dmgLv", 20, 15);
  bindScrap("buy-spd-btn", "spdLv", 15, 10);
  bindScrap("buy-rof-btn", "rofLv", 25, 15);
  bindScrap("buy-mast-btn", "mastLv", 30, 20);

  const bindDm = (btnId, key, max, base, step) => {
    const btn = document.getElementById(btnId);
    if (btn) {
      btn.onclick = () => {
        if (meta[key] >= max) return;
        const cost = base + meta[key] * step;
        if (meta.darkMatter >= cost) { meta.darkMatter -= cost; meta[key]++; saveMeta(); }
      };
    }
  };
  bindDm("buy-dm-revive-btn", "reviveLv", 3, 4, 4);
  bindDm("buy-dm-headstart-btn", "headstartLv", 2, 5, 6);
  bindDm("buy-dm-dmmult-btn", "dmMultLv", 5, 4, 3);
  bindDm("buy-dm-scrapmult-btn", "scrapMultLv", 5, 3, 3);

  const prestigeBtn = document.getElementById("prestige-btn");
  if (prestigeBtn) prestigeBtn.onclick = performPrestige;

  // Tab switching
  const tabScrap = document.getElementById("tab-scrap");
  const tabDm = document.getElementById("tab-dm");
  const panelScrap = document.getElementById("panel-scrap");
  const panelDm = document.getElementById("panel-dm");
  if (tabScrap && tabDm && panelScrap && panelDm) {
    tabScrap.onclick = () => {
      tabScrap.classList.add("active");
      tabDm.classList.remove("active");
      panelScrap.classList.remove("hidden");
      panelDm.classList.add("hidden");
    };
    tabDm.onclick = () => {
      tabDm.classList.add("active");
      tabScrap.classList.remove("active");
      panelDm.classList.remove("hidden");
      panelScrap.classList.add("hidden");
    };
  }
}

// --- IN-RUN UPGRADE CARDS ---
const UPGRADES = [
  { id: "multishot", title: "Split Barrel", desc: "+1 Projectile / Pellet per shot.", apply: () => player.projectiles++ },
  { id: "firerate", title: "Overclocked Core", desc: "+25% Fire Rate.", apply: () => player.fireDelay *= 0.8 },
  { id: "damage", title: "Heavy Plasma", desc: "+35% Weapon Damage.", apply: () => player.damage *= 1.35 },
  { id: "pierce", title: "Railgun Rounds", desc: "Projectiles pierce +1 extra enemy.", apply: () => player.pierce++ },
  { id: "heal", title: "Nano-Repair", desc: "Restore 45 Hull HP and gain +20 Max HP.", apply: () => { player.maxHp += 20; player.hp = Math.min(player.maxHp, player.hp + 45); } },
  { id: "drone", title: "Auto-Turret Drone", desc: "Adds an orbiting drone that fires automatically.", apply: () => player.drones++ },
  { id: "magnet", title: "Tractor Beam", desc: "Doubles Scrap pickup range and +15% Move Speed.", apply: () => { player.magnetRange *= 2; player.speed *= 1.15; } },
  { id: "crit", title: "Targeting Matrix", desc: "+20% Chance for 2.5x Critical Hits.", apply: () => player.critChance += 0.20 },
  {
    id: "chrono_drive",
    title: "Chrono-Warp Drive",
    desc: "Defeating an enemy boosts fire rate by 15% for 2.5s (Stacks 3x).",
    apply: () => { player.chronoDrive = (player.chronoDrive || 0) + 1; }
  },
  {
    id: "shield_generator",
    title: "Aegis Energy Shield",
    desc: "+40 Max Shield that recharges every Sector.",
    apply: () => { player.maxShield += 40; player.shield = player.maxShield; }
  },
  {
    id: "tesla_coil",
    title: "Tesla Discharge Coil",
    desc: "Every 4s, zaps the nearest enemy for 2.5x weapon damage.",
    apply: () => { player.teslaCoil = (player.teslaCoil || 0) + 1; }
  },
  {
    id: "singularity",
    title: "Singularity Core",
    desc: "Destroying a BRUISER or BOSS spawns a damaging black hole.",
    apply: () => { player.singularityCore = (player.singularityCore || 0) + 1; }
  }
];
