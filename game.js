// --- MAIN GAME LOOP, COLLISIONS & RENDERING ---

let gameState = "MENU";
let player, bullets, enemyBullets, enemies, pickups, particles, stars;
let wave, enemiesToSpawn, spawnCooldown, score, keys, lastShotTime;
let bossWarningActive = false;
let bossWarningTimer = 0;

function initStars() {
  stars = [];
  for (let i = 0; i < 65; i++) {
    stars.push({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      size: Math.random() * 2 + 0.5,
      speed: Math.random() * 1.5 + 0.5
    });
  }
}

function startRun() {
  initAudio();
  startMusic();

  const shipId = meta.equippedShip || "vanguard";
  const shipData = SHIPS[shipId] || SHIPS.vanguard;
  const tier = (meta.shipTiers && meta.shipTiers[shipId]) || 1;
  const tierMult = 1 + (tier - 1) * 0.2;

  const baseHp = (100 * shipData.hpMult + meta.hpLv * 20) * tierMult;
  const baseDmg = (12 * shipData.dmgMult * (1 + meta.dmgLv * 0.15)) * tierMult;
  const baseSpeed = 5.5 * shipData.spdMult * (1 + meta.spdLv * 0.1);
  const baseFireDelay = 240 / (1 + meta.fireRateLv * 0.08);

  const startingShield = shipId === "aegis" ? 45 * tierMult : 0;

  player = {
    x: canvas.width / 2 - 18,
    y: canvas.height - 65,
    width: 36,
    height: 28,
    shipId: shipId,
    tier: tier,
    hp: baseHp,
    maxHp: baseHp,
    speed: baseSpeed,
    damage: baseDmg,
    fireDelay: baseFireDelay,
    projectiles: 1,
    pierce: 0,
    drones: 0,
    magnetRange: shipId === "phantom" ? 130 : 65,
    critChance: shipId === "phantom" ? 0.20 : 0.05,
    droneAngle: 0,
    invulnTimer: 0,
    revivesLeft: meta.reviveLv || 0,
    chronoDrive: 0,
    chronoStacks: 0,
    chronoTimer: 0,
    hasShield: startingShield > 0,
    shield: startingShield,
    maxShield: startingShield,
    teslaCoil: 0,
    teslaTimer: 0,
    singularityCore: 0,
    blackHoles: []
  };

  bullets = [];
  enemyBullets = [];
  enemies = [];
  pickups = [];
  particles = [];
  keys = {};
  lastShotTime = 0;
  wave = 0;
  score = 0;

  startOverlay.classList.add("hidden");
  draftOverlay.classList.add("hidden");
  gameState = "PLAYING";
  updateHUD();

  if (meta.headstartLv > 0) {
    openDraft(true);
  } else {
    nextWave();
  }
}

function nextWave() {
  wave++;
  if (wave > (meta.highestSector || 0)) {
    meta.highestSector = wave;
    saveMeta();
  }

  if (player && player.hasShield) {
    player.shield = player.maxShield;
  }

  if (wave % 5 === 0) {
    bossWarningActive = true;
    bossWarningTimer = 140;
    enemiesToSpawn = 0;
    spawnCooldown = 9999;
  } else {
    bossWarningActive = false;
    enemiesToSpawn = 5 + wave * 3;
    spawnCooldown = 30;
  }
  updateHUD();
}

function createExplosion(x, y, color, count = 10) {
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const spd = Math.random() * 3.2 + 1;
    particles.push({
      x, y,
      vx: Math.cos(angle) * spd,
      vy: Math.sin(angle) * spd,
      life: 24 + Math.random() * 14,
      color
    });
  }
}

function damagePlayer(amount) {
  if (player.invulnTimer > 0) return;

  let dmg = amount;
  if (player.hasShield && player.shield > 0) {
    if (player.shield >= dmg) {
      player.shield -= dmg;
      dmg = 0;
    } else {
      dmg -= player.shield;
      player.shield = 0;
    }
    createExplosion(player.x + player.width / 2, player.y, "#66fcf1", 8);
  }

  if (dmg > 0) {
    player.hp -= dmg;
    player.invulnTimer = 25;
    playTone(140, "sawtooth", 0.15, 0.08);
  }

  updateHUD();

  if (player.hp <= 0) {
    if (player.revivesLeft > 0) {
      player.revivesLeft--;
      player.hp = Math.ceil(player.maxHp * 0.5);
      player.invulnTimer = 120;
      enemyBullets = [];
      createExplosion(player.x + player.width / 2, player.y + player.height / 2, "#ffd166", 35);
      playTone(523.25, "triangle", 0.35, 0.12);
      updateHUD();
    } else {
      gameOver();
    }
  }
}

function destroyEnemy(e, index) {
  if (e.isTwin && !e.enragedTriggered) {
    enemies.forEach(other => {
      if (other !== e && other.isTwin) {
        other.enraged = true;
        other.speed *= 1.4;
      }
    });
  }

  if (e.type === "BOSS") {
    meta.bossesDefeated = (meta.bossesDefeated || 0) + 1;
    saveMeta();
  }

  if (player.chronoDrive > 0) {
    player.chronoStacks = Math.min(3, player.chronoStacks + 1);
    player.chronoTimer = 150;
  }

  if (player.singularityCore > 0 && (e.type === "BRUISER" || e.type === "BOSS")) {
    player.blackHoles.push({
      x: e.x + e.width / 2,
      y: e.y + e.height / 2,
      radius: 95,
      duration: 180,
      damage: 1.5 * player.singularityCore
    });
  }

  score += e.scoreValue;
  createExplosion(e.x + e.width / 2, e.y + e.height / 2, "#ff9f1c", e.type === "BOSS" ? 30 : 14);

  const scrapMult = 1 + (meta.scrapMultLv || 0) * 0.2;
  const totalScrap = Math.max(1, Math.round(e.scrapValue * scrapMult));
  for (let s = 0; s < totalScrap; s++) {
    pickups.push({
      x: e.x + e.width / 2 + (Math.random() - 0.5) * 24,
      y: e.y + e.height / 2,
      vy: 1.6
    });
  }

  enemies.splice(index, 1);
  updateHUD();
}

function openDraft(isHeadstart = false) {
  gameState = "DRAFT";
  cardContainer.innerHTML = "";
  const shuffled = [...UPGRADES].sort(() => 0.5 - Math.random()).slice(0, 3);

  shuffled.forEach(upg => {
    const card = document.createElement("div");
    card.className = "upgrade-card";
    card.innerHTML = `<div class="card-title">${upg.title}</div><div class="card-desc">${upg.desc}</div>`;
    card.onclick = () => {
      upg.apply();
      draftOverlay.classList.add("hidden");
      gameState = "PLAYING";
      updateHUD();
      if (isHeadstart || wave === 0) {
        nextWave();
      } else {
        nextWave();
      }
    };
    cardContainer.appendChild(card);
  });

  draftOverlay.classList.remove("hidden");
}

function updateHUD() {
  if (!waveEl) return;
  waveEl.textContent = wave;
  hpEl.textContent = Math.max(0, Math.ceil(player ? player.hp : 0));
  maxHpEl.textContent = Math.ceil(player ? player.maxHp : 100);
  if (shieldEl) shieldEl.textContent = player ? Math.ceil(player.shield) : 0;
  if (reviveEl) reviveEl.textContent = player ? player.revivesLeft : (meta.reviveLv || 0);
  scoreEl.textContent = score;
  scrapEl.textContent = meta.scrap;
  if (dmEl) dmEl.textContent = meta.darkMatter;
}

function gameOver() {
  gameState = "MENU";
  stopMusic();
  saveMeta();
  titleText.textContent = "SHIP DESTROYED";
  subtitleText.textContent = `Reached Sector ${wave} | Final Score: ${score}`;
  startBtn.textContent = "LAUNCH NEW RUN";
  startOverlay.classList.remove("hidden");
}

function update(now) {
  stars.forEach(s => {
    s.y += s.speed;
    if (s.y > canvas.height) {
      s.y = 0;
      s.x = Math.random() * canvas.width;
    }
  });

  if (gameState !== "PLAYING") return;

  if (player.invulnTimer > 0) player.invulnTimer--;

  // Keyboard-Only Movement (WASD / Arrow Keys)
  if (keys["ArrowLeft"] || keys["a"] || keys["A"]) player.x -= player.speed;
  if (keys["ArrowRight"] || keys["d"] || keys["D"]) player.x += player.speed;
  if (keys["ArrowUp"] || keys["w"] || keys["W"]) player.y -= player.speed;
  if (keys["ArrowDown"] || keys["s"] || keys["S"]) player.y += player.speed;

  player.x = Math.max(0, Math.min(canvas.width - player.width, player.x));
  player.y = Math.max(canvas.height * 0.32, Math.min(canvas.height - player.height, player.y));

  // Chrono-Warp Decay
  if (player.chronoStacks > 0) {
    player.chronoTimer--;
    if (player.chronoTimer <= 0) player.chronoStacks = 0;
  }

  // Tesla Coil Auto-Zap
  if (player.teslaCoil > 0 && enemies.length > 0) {
    player.teslaTimer++;
    if (player.teslaTimer >= 220) {
      player.teslaTimer = 0;
      let closestIdx = -1;
      let minDist = Infinity;
      enemies.forEach((e, idx) => {
        const d = Math.hypot((e.x + e.width / 2) - (player.x + player.width / 2), (e.y + e.height / 2) - (player.y + player.height / 2));
        if (d < minDist) {
          minDist = d;
          closestIdx = idx;
        }
      });
      if (closestIdx !== -1) {
        const target = enemies[closestIdx];
        target.hp -= player.damage * 2 * player.teslaCoil;
        createExplosion(target.x + target.width / 2, target.y + target.height / 2, "#00bbf9", 12);
        if (target.hp <= 0) destroyEnemy(target, closestIdx);
      }
    }
  }

  // Primary Weapon Firing
  const baseDelay = player.fireDelay;
  if (player.chronoStacks > 0) {
    player.fireDelay *= (1 - player.chronoStacks * 0.14);
  }
  fireShipWeapon(now);
  player.fireDelay = baseDelay;

  // Orbiting Drones
  if (player.drones > 0) {
    player.droneAngle += 0.05;
    if (Math.floor(now / 450) !== Math.floor((now - 16) / 450)) {
      for (let d = 0; d < player.drones; d++) {
        const a = player.droneAngle + (d * Math.PI * 2) / player.drones;
        const dx = player.x + player.width / 2 + Math.cos(a) * 38;
        const dy = player.y + player.height / 2 + Math.sin(a) * 38;
        bullets.push({
          x: dx, y: dy, vx: 0, vy: -8.5, radius: 2.5,
          damage: player.damage * 0.5, pierceLeft: 0, hitList: [],
          isCrit: false, color: "#00bbf9"
        });
      }
    }
  }

  // Boss Warning Countdown
  if (bossWarningActive) {
    bossWarningTimer--;
    if (bossWarningTimer % 30 === 0 && bossWarningTimer > 0) {
      playTone(380, "sawtooth", 0.2, 0.08);
      playTone(190, "square", 0.25, 0.04);
    }
    if (bossWarningTimer <= 0) {
      bossWarningActive = false;
      spawnBossForWave(wave);
    }
    return;
  }

  // Wave Spawner
  if (enemiesToSpawn > 0) {
    spawnCooldown--;
    if (spawnCooldown <= 0) {
      spawnStandardEnemy(wave);
      enemiesToSpawn--;
      spawnCooldown = Math.max(18, 52 - wave * 2);
    }
  } else if (enemies.length === 0) {
    openDraft(false);
    return;
  }

  // Update Player Bullets (including Void Homing & Life)
  for (let i = bullets.length - 1; i >= 0; i--) {
    const b = bullets[i];
    if (b.homing && enemies.length > 0) {
      let nearest = null;
      let minDist = 320;
      enemies.forEach(e => {
        if (e.isPhased) return;
        const d = Math.hypot((e.x + e.width / 2) - b.x, (e.y + e.height / 2) - b.y);
        if (d < minDist) { minDist = d; nearest = e; }
      });
      if (nearest) {
        const desiredAngle = Math.atan2((nearest.y + nearest.height / 2) - b.y, (nearest.x + nearest.width / 2) - b.x);
        const currentAngle = Math.atan2(b.vy, b.vx);
        const spd = Math.hypot(b.vx, b.vy);
        let diff = desiredAngle - currentAngle;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        const newAngle = currentAngle + Math.sign(diff) * Math.min(Math.abs(diff), b.turnRate || 0.08);
        b.vx = Math.cos(newAngle) * spd;
        b.vy = Math.sin(newAngle) * spd;
      }
    }

    b.x += b.vx;
    b.y += b.vy;
    if (b.life !== undefined) {
      b.life--;
      if (b.life <= 0) { bullets.splice(i, 1); continue; }
    }
    if (b.y < -30 || b.y > canvas.height + 30 || b.x < -30 || b.x > canvas.width + 30) {
      bullets.splice(i, 1);
    }
  }

  // Update Enemy Bullets
  for (let i = enemyBullets.length - 1; i >= 0; i--) {
    const eb = enemyBullets[i];
    eb.x += eb.vx;
    eb.y += eb.vy;
    if (eb.y > canvas.height + 20 || eb.x < -20 || eb.x > canvas.width + 20) {
      enemyBullets.splice(i, 1);
      continue;
    }
    if (
      eb.x > player.x + 4 && eb.x < player.x + player.width - 4 &&
      eb.y > player.y + 4 && eb.y < player.y + player.height - 4
    ) {
      createExplosion(eb.x, eb.y, "#ff4c4c", 6);
      enemyBullets.splice(i, 1);
      damagePlayer(eb.damage);
      if (gameState !== "PLAYING") return;
    }
  }

  // Update Enemies & Collisions
  for (let i = enemies.length - 1; i >= 0; i--) {
    const e = enemies[i];

    // Burn DOT from Crimson Mk. II+
    if (e.burnTimer && e.burnTimer > 0) {
      e.burnTimer--;
      e.hp -= e.burnDps || 0.2;
      if (e.burnTimer % 12 === 0) {
        createExplosion(e.x + Math.random() * e.width, e.y + Math.random() * e.height, "#ff9f1c", 2);
      }
      if (e.hp <= 0) {
        destroyEnemy(e, i);
        continue;
      }
    }

    updateEnemyAI(e, wave);

    // Player Body Collision
    if (
      e.x < player.x + player.width - 4 && e.x + e.width > player.x + 4 &&
      e.y < player.y + player.height - 4 && e.y + e.height > player.y + 4
    ) {
      createExplosion(e.x + e.width / 2, e.y + e.height / 2, "#ff4c4c", 12);
      if (e.type !== "BOSS") enemies.splice(i, 1);
      damagePlayer(20);
      if (gameState !== "PLAYING") return;
      continue;
    }

    // Reached Bottom Edge
    if (e.y > canvas.height) {
      enemies.splice(i, 1);
      damagePlayer(10);
      if (gameState !== "PLAYING") return;
      continue;
    }

    // Bullet Hits on Enemy
    for (let j = bullets.length - 1; j >= 0; j--) {
      const b = bullets[j];
      if (b.hitList.includes(e)) continue;

      if (
        b.x + b.radius > e.x && b.x - b.radius < e.x + e.width &&
        b.y + b.radius > e.y && b.y - b.radius < e.y + e.height
      ) {
        if (e.type === "BOSS" && e.isPhased) continue;

        // Aegis Carrier Shield Plate Check
        if (e.bossType === "AEGIS_CARRIER" && e.shieldAngle !== undefined) {
          const hitAngle = Math.atan2(b.y - (e.y + e.height / 2), b.x - (e.x + e.width / 2));
          const plate1 = Math.abs(Math.sin(hitAngle - e.shieldAngle));
          if (plate1 > 0.82) {
            createExplosion(b.x, b.y, "#ffd166", 4);
            bullets.splice(j, 1);
            continue;
          }
        }

        e.hp -= b.damage;
        b.hitList.push(e);

        if (b.burn) {
          e.burnTimer = 90;
          e.burnDps = b.damage * 0.04;
        }
        if (b.shockwave) {
          enemies.forEach(other => {
            if (other !== e && Math.hypot(other.x - e.x, other.y - e.y) < 75) {
              other.hp -= b.damage * 0.4;
            }
          });
          createExplosion(b.x, b.y, "#ffd166", 8);
        }
        if (b.splitOnHit && !b.isMini) {
          for (let s = -1; s <= 1; s += 2) {
            bullets.push({
              x: b.x, y: b.y, vx: s * 3.5, vy: -5, radius: 3,
              damage: b.damage * 0.45, pierceLeft: 0, hitList: [e],
              homing: true, isMini: true, color: "#c77dff"
            });
          }
        }
        if (b.singularityOnHit && player.blackHoles.length < 3) {
          player.blackHoles.push({
            x: b.x, y: b.y, radius: 60, duration: 55, damage: b.damage * 0.06
          });
        }

        createExplosion(b.x, b.y, b.isCrit ? "#ffd166" : (b.color || "#66fcf1"), 4);

        if (b.pierceLeft > 0) b.pierceLeft--;
        else bullets.splice(j, 1);

        if (e.hp <= 0) {
          destroyEnemy(e, i);
          break;
        }
      }
    }
  }

  // Black Hole Pull & Burn
  if (player.blackHoles && player.blackHoles.length > 0) {
    for (let bIdx = player.blackHoles.length - 1; bIdx >= 0; bIdx--) {
      const bh = player.blackHoles[bIdx];
      bh.duration--;
      for (let eIdx = enemies.length - 1; eIdx >= 0; eIdx--) {
        const e = enemies[eIdx];
        const dx = bh.x - (e.x + e.width / 2);
        const dy = bh.y - (e.y + e.height / 2);
        const dist = Math.hypot(dx, dy);
        if (dist < bh.radius && dist > 1) {
          if (e.type !== "BOSS") {
            e.x += (dx / dist) * 2.2;
            e.y += (dy / dist) * 2.2;
          }
          e.hp -= bh.damage;
          if (e.hp <= 0) destroyEnemy(e, eIdx);
        }
      }
      if (bh.duration <= 0) player.blackHoles.splice(bIdx, 1);
    }
  }

  // Scrap Pickups
  for (let i = pickups.length - 1; i >= 0; i--) {
    const p = pickups[i];
    const dx = (player.x + player.width / 2) - p.x;
    const dy = (player.y + player.height / 2) - p.y;
    const dist = Math.hypot(dx, dy);

    if (dist < player.magnetRange) {
      p.x += (dx / dist) * 6.5;
      p.y += (dy / dist) * 6.5;
    } else {
      p.y += p.vy;
    }

    if (dist < 24) {
      meta.scrap++;
      pickups.splice(i, 1);
      updateHUD();
    } else if (p.y > canvas.height + 20) {
      pickups.splice(i, 1);
    }
  }

  // Particles
  for (let i = particles.length - 1; i >= 0; i--) {
    const pt = particles[i];
    pt.x += pt.vx;
    pt.y += pt.vy;
    pt.life--;
    if (pt.life <= 0) particles.splice(i, 1);
  }
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = "#ffffff";
  stars.forEach(s => {
    ctx.globalAlpha = s.speed / 2.5;
    ctx.fillRect(s.x, s.y, s.size, s.size);
  });
  ctx.globalAlpha = 1;

  if (gameState === "MENU") return;

  // Black Holes
  if (player.blackHoles) {
    player.blackHoles.forEach(bh => {
      ctx.strokeStyle = "rgba(157, 78, 221, 0.5)";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(bh.x, bh.y, bh.radius * (0.55 + Math.random() * 0.45), 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = "#7209b7";
      ctx.beginPath();
      ctx.arc(bh.x, bh.y, 8, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  // Scrap Crystals
  pickups.forEach(p => {
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate((Date.now() / 250) % (Math.PI * 2));
    const grad = ctx.createLinearGradient(-5, -5, 5, 5);
    grad.addColorStop(0, "#fff3b0");
    grad.addColorStop(0.5, "#ffd166");
    grad.addColorStop(1, "#e3a857");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(0, -6); ctx.lineTo(5, 0); ctx.lineTo(0, 6); ctx.lineTo(-5, 0);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  });

  // Player Ship (Blinks during invulnerability)
  if (player.invulnTimer <= 0 || Math.floor(player.invulnTimer / 4) % 2 === 0) {
    drawPlayerShip(ctx, player);
  }

  // Aegis Shield Arc
  if (player.hasShield && player.shield > 0) {
    ctx.strokeStyle = `rgba(102, 252, 241, ${0.35 + (player.shield / player.maxShield) * 0.65})`;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(player.x + player.width / 2, player.y + player.height / 2, player.width * 0.95, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Orbiting Drones
  for (let d = 0; d < player.drones; d++) {
    const a = player.droneAngle + (d * Math.PI * 2) / player.drones;
    const dx = player.x + player.width / 2 + Math.cos(a) * 38;
    const dy = player.y + player.height / 2 + Math.sin(a) * 38;
    ctx.fillStyle = "#00bbf9";
    ctx.beginPath();
    ctx.arc(dx, dy, 5, 0, Math.PI * 2);
    ctx.fill();
  }

  // Player Bullets
  bullets.forEach(b => {
    const bGrad = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, b.radius * 1.8);
    if (b.isCrit) {
      bGrad.addColorStop(0, "#ffffff");
      bGrad.addColorStop(0.35, "#ffd166");
      bGrad.addColorStop(1, "rgba(247, 37, 133, 0)");
    } else {
      bGrad.addColorStop(0, "#ffffff");
      bGrad.addColorStop(0.45, b.color || "#66fcf1");
      bGrad.addColorStop(1, "rgba(69, 162, 158, 0)");
    }
    ctx.fillStyle = bGrad;
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.radius * 1.8, 0, Math.PI * 2);
    ctx.fill();
  });

  // Enemy Bullets
  enemyBullets.forEach(eb => {
    const ebGrad = ctx.createRadialGradient(eb.x, eb.y, 0, eb.x, eb.y, 5);
    ebGrad.addColorStop(0, "#ffffff");
    ebGrad.addColorStop(0.4, "#ff4c4c");
    ebGrad.addColorStop(1, "rgba(230, 57, 70, 0)");
    ctx.fillStyle = ebGrad;
    ctx.beginPath();
    ctx.arc(eb.x, eb.y, 9, 0, Math.PI * 2);
    ctx.fill();
  });

  // Enemies & Bosses
  enemies.forEach(e => drawEnemyEntity(ctx, e));

  // Particles
  particles.forEach(pt => {
    ctx.fillStyle = pt.color;
    ctx.globalAlpha = pt.life / 40;
    ctx.fillRect(pt.x, pt.y, 3, 3);
  });
  ctx.globalAlpha = 1;

  // Boss Warning Banner
  if (bossWarningActive && gameState === "PLAYING") {
    const pulse = Math.abs(Math.sin(bossWarningTimer * 0.15));
    ctx.fillStyle = `rgba(230, 57, 70, ${pulse * 0.25})`;
    ctx.fillRect(0, canvas.height / 2 - 50, canvas.width, 90);
    ctx.strokeStyle = `rgba(230, 57, 70, ${pulse})`;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, canvas.height / 2 - 50);
    ctx.lineTo(canvas.width, canvas.height / 2 - 50);
    ctx.moveTo(0, canvas.height / 2 + 40);
    ctx.lineTo(canvas.width, canvas.height / 2 + 40);
    ctx.stroke();

    ctx.fillStyle = `rgba(255, 255, 255, ${pulse})`;
    ctx.font = "bold 22px 'Segoe UI', sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("! WARNING: BOSSCRAFT DETECTED !", canvas.width / 2, canvas.height / 2 - 12);
    ctx.font = "13px 'Segoe UI', sans-serif";
    ctx.fillStyle = "#cbd5e1";
    ctx.fillText("HOSTILE CAPITAL VESSEL WARPING INTO SECTOR", canvas.width / 2, canvas.height / 2 + 18);
    ctx.textAlign = "left";
  }
}

function loop(now) {
  update(now);
  draw();
  requestAnimationFrame(loop);
}

if (startBtn) startBtn.addEventListener("click", startRun);

window.addEventListener("keydown", e => {
  keys[e.key] = true;
  if (e.code === "Space") e.preventDefault();
});

window.addEventListener("keyup", e => {
  keys[e.key] = false;
});

initStars();
updateMetaUI();
updateHUD();
requestAnimationFrame(loop);
