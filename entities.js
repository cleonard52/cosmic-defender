// --- ENTITIES, WEAPONS, BOSSES & SHIP RENDERER (PART 2 OF 3) ---

function createExplosion(x, y, color, count = 10) {
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const spd = Math.random() * 3.2 + 0.8;
    particles.push({
      x, y,
      vx: Math.cos(angle) * spd,
      vy: Math.sin(angle) * spd,
      life: 24 + Math.random() * 14,
      color
    });
  }
}

function firePlayerWeapon(now) {
  if (now - lastShotTime < player.fireDelay) return;
  lastShotTime = now;

  const shipId = player.shipId;
  const tier = player.tier;
  const mastery = meta.masteryLv || 0;
  const cx = player.x + player.width / 2;
  const topY = player.y;
  const extraProj = player.projectiles - 1;

  if (shipId === "vanguard") {
    const critBonus = mastery * 0.05;
    const vel = 9.5 * (1 + mastery * 0.12);
    const total = (tier === 1 ? 1 : tier === 2 ? 2 : 3) + extraProj;
    const spread = tier === 3 ? 0.11 : 0.08;
    const startAngle = -Math.PI / 2 - ((total - 1) * spread) / 2;

    for (let i = 0; i < total; i++) {
      const isCrit = Math.random() < (player.critChance + critBonus);
      const angle = total === 2 && tier === 2 && extraProj === 0
        ? -Math.PI / 2
        : startAngle + i * spread;
      const offsetX = (total === 2 && tier === 2 && extraProj === 0)
        ? (i === 0 ? -9 : 9)
        : 0;
      const isLance = tier === 3 && i === Math.floor(total / 2);

      bullets.push({
        x: cx + offsetX,
        y: topY,
        vx: Math.cos(angle) * (isLance ? vel * 1.2 : vel),
        vy: Math.sin(angle) * (isLance ? vel * 1.2 : vel),
        radius: isLance ? 5.5 : (isCrit ? 4.8 : 3.5),
        damage: player.damage * (isLance ? 1.4 : 1) * (isCrit ? 2.5 : 1),
        pierceLeft: player.pierce + (isLance ? 1 : 0),
        hitList: [],
        isCrit,
        kind: isLance ? "lance" : "pulse"
      });
    }
  } else if (shipId === "crimson") {
    const basePellets = tier === 1 ? 4 : tier === 2 ? 6 : 8;
    const count = basePellets + mastery + extraProj * 2;
    const spread = Math.max(0.22, (tier === 3 ? 0.42 : 0.55) - mastery * 0.03);
    const burnDmg = tier >= 2 ? player.damage * (tier === 3 ? 0.35 : 0.2) : 0;

    for (let i = 0; i < count; i++) {
      const ratio = count > 1 ? (i / (count - 1)) - 0.5 : 0;
      const angle = -Math.PI / 2 + ratio * spread + (Math.random() - 0.5) * 0.05;
      const spd = 8.5 + Math.random() * 2;
      const isCrit = Math.random() < player.critChance;
      bullets.push({
        x: cx,
        y: topY + 4,
        vx: Math.cos(angle) * spd,
        vy: Math.sin(angle) * spd,
        radius: isCrit ? 4 : 2.8,
        damage: player.damage * 0.48 * (isCrit ? 2.5 : 1),
        pierceLeft: player.pierce,
        hitList: [],
        isCrit,
        burn: burnDmg,
        life: tier === 3 ? 42 : 34,
        kind: tier >= 2 ? "incendiary" : "flak"
      });
    }
  } else if (shipId === "aegis") {
    const count = (tier >= 2 ? 2 : 1) + extraProj;
    const innatePierce = 2 + mastery + (tier === 3 ? 2 : 0);
    const radius = 5.5 + mastery * 0.6 + (tier === 3 ? 2 : 0);

    for (let i = 0; i < count; i++) {
      const offset = count > 1 ? ((i - (count - 1) / 2) * 16) : 0;
      const isCrit = Math.random() < player.critChance;
      bullets.push({
        x: cx + offset,
        y: topY,
        vx: 0,
        vy: -11.5,
        radius,
        damage: player.damage * (tier === 3 ? 1.85 : 1.55) * (isCrit ? 2.5 : 1),
        pierceLeft: player.pierce + innatePierce,
        hitList: [],
        isCrit,
        shockwave: tier === 3,
        kind: tier === 3 ? "siege" : "rail"
      });
    }
  } else if (shipId === "void") {
    const count = 1 + extraProj;
    const turnSpeed = 0.08 + mastery * 0.025;
    for (let i = 0; i < count; i++) {
      const spreadAngle = -Math.PI / 2 + (i - (count - 1) / 2) * 0.25;
      const isCrit = Math.random() < player.critChance;
      bullets.push({
        x: cx,
        y: topY,
        vx: Math.cos(spreadAngle) * 6.5,
        vy: Math.sin(spreadAngle) * 6.5,
        speed: 6.8 + mastery * 0.4,
        turnSpeed,
        radius: tier === 3 ? 6 : 4.8,
        damage: player.damage * (tier === 3 ? 1.35 : 1.15) * (isCrit ? 2.5 : 1),
        pierceLeft: player.pierce,
        hitList: [],
        isCrit,
        homing: true,
        splitOnHit: tier === 2,
        singularityOnHit: tier === 3,
        aoeRadius: 34 + mastery * 6,
        kind: "void"
      });
    }
  }
}

function spawnBoss() {
  const cycle = Math.floor((wave - 1) / 5) % 5;

  if (cycle === 0) {
    const maxHp = 340 + wave * 95;
    enemies.push({
      type: "BOSS", bossType: "CORRUPT_CORE", name: "NEXUS CORE DESTROYER",
      x: canvas.width / 2 - 55, y: -95, width: 110, height: 75,
      hp: maxHp, maxHp, speed: 0.85, vx: 1.9, shootTimer: 0, stateTimer: 0,
      scrapValue: 22 + wave * 3, scoreValue: 1000 + wave * 200
    });
  } else if (cycle === 1) {
    const maxHp = 650 + wave * 105;
    enemies.push({
      type: "BOSS", bossType: "VOID_STALKER", name: "VOID STALKER: PHASE MIRAGE",
      x: canvas.width / 2 - 45, y: -100, width: 90, height: 90,
      hp: maxHp, maxHp, speed: 0.95, vx: 2.3, shootTimer: 0, stateTimer: 0,
      scrapValue: 28 + wave * 3, scoreValue: 1500 + wave * 200
    });
  } else if (cycle === 2) {
    const maxHp = 520 + wave * 65;
    [-1, 1].forEach((dir, idx) => {
      enemies.push({
        type: "BOSS", bossType: "TWIN_GEMINI",
        name: idx === 0 ? "GEMINI ALPHA" : "GEMINI OMEGA",
        twinSide: dir,
        x: canvas.width / 2 + dir * 90 - 28, y: -80, width: 56, height: 54,
        hp: maxHp, maxHp, speed: 1.1, vx: dir * 2.4, shootTimer: idx * 25, stateTimer: 0,
        scrapValue: 18 + wave * 2, scoreValue: 900 + wave * 150
      });
    });
  } else if (cycle === 3) {
    const maxHp = 1100 + wave * 120;
    enemies.push({
      type: "BOSS", bossType: "AEGIS_CARRIER", name: "AEGIS DREADNOUGHT CARRIER",
      x: canvas.width / 2 - 70, y: -110, width: 140, height: 82,
      hp: maxHp, maxHp, speed: 0.65, vx: 1.2, shootTimer: 0, stateTimer: 0,
      shieldAngle: 0,
      scrapValue: 35 + wave * 4, scoreValue: 2200 + wave * 250
    });
  } else {
    const maxHp = 1600 + wave * 150;
    enemies.push({
      type: "BOSS", bossType: "STAR_DEVOURER", name: "GOLIATH STAR-DEVOURER",
      x: canvas.width / 2 - 75, y: -115, width: 150, height: 95,
      hp: maxHp, maxHp, speed: 0.75, vx: 1.6, shootTimer: 0, stateTimer: 0,
      scrapValue: 45 + wave * 4, scoreValue: 3000 + wave * 300
    });
  }
}

function updateBossAI(e) {
  if (e.y < 55) {
    e.y += e.speed;
    return;
  }

  e.shootTimer++;
  e.stateTimer++;

  if (e.bossType === "CORRUPT_CORE") {
    e.x += e.vx;
    if (e.x <= 15 || e.x + e.width >= canvas.width - 15) e.vx *= -1;
    if (e.shootTimer >= 62) {
      e.shootTimer = 0;
      for (let k = -1; k <= 1; k++) {
        enemyBullets.push({ x: e.x + e.width / 2, y: e.y + e.height, vx: k * 1.7, vy: 4.1, damage: 15 });
      }
    }
  } else if (e.bossType === "VOID_STALKER") {
    e.x += e.vx;
    if (e.x <= 15 || e.x + e.width >= canvas.width - 15) e.vx *= -1;
    e.isPhased = (e.stateTimer % 300 < 110);
    if (e.shootTimer >= 44) {
      e.shootTimer = 0;
      if (e.hp < e.maxHp * 0.5) {
        const angle = Math.atan2(player.y - (e.y + e.height), player.x - (e.x + e.width / 2));
        enemyBullets.push({ x: e.x + e.width / 2, y: e.y + e.height, vx: Math.cos(angle) * 5.2, vy: Math.sin(angle) * 5.2, damage: 17 });
      } else {
        const offset = e.stateTimer * 0.12;
        enemyBullets.push({ x: e.x + e.width / 2, y: e.y + e.height, vx: Math.cos(offset) * 2.8, vy: 3.9, damage: 13 });
      }
    }
  } else if (e.bossType === "TWIN_GEMINI") {
    const otherTwin = enemies.find(other => other !== e && other.bossType === "TWIN_GEMINI");
    const enraged = !otherTwin;
    const speedMult = enraged ? 1.55 : 1.0;

    e.x += e.vx * speedMult;
    e.y = 65 + Math.sin(e.stateTimer * 0.045 * speedMult + (e.twinSide > 0 ? Math.PI : 0)) * 28;
    if (e.x <= 12 || e.x + e.width >= canvas.width - 12) e.vx *= -1;

    const fireRate = enraged ? 28 : 52;
    if (e.shootTimer >= fireRate) {
      e.shootTimer = 0;
      const angle = Math.atan2((player.y + player.height / 2) - (e.y + e.height), (player.x + player.width / 2) - (e.x + e.width / 2));
      enemyBullets.push({
        x: e.x + e.width / 2, y: e.y + e.height,
        vx: Math.cos(angle) * (enraged ? 4.8 : 3.8),
        vy: Math.sin(angle) * (enraged ? 4.8 : 3.8),
        damage: enraged ? 16 : 13
      });
    }
  } else if (e.bossType === "AEGIS_CARRIER") {
    e.x += e.vx;
    if (e.x <= 20 || e.x + e.width >= canvas.width - 20) e.vx *= -1;
    e.shieldAngle = (e.shieldAngle || 0) + 0.025;

    if (e.shootTimer >= 135) {
      e.shootTimer = 0;
      [-35, 35].forEach(offset => {
        enemies.push({
          type: "SWARMER",
          x: e.x + e.width / 2 + offset - 10,
          y: e.y + e.height,
          width: 20, height: 20,
          hp: 14 + wave * 2, maxHp: 14 + wave * 2,
          speed: 3.1, vx: 0, shootTimer: 0,
          scrapValue: 1, scoreValue: 15
        });
      });
    }
    if (e.stateTimer % 85 === 0) {
      enemyBullets.push({ x: e.x + 20, y: e.y + e.height, vx: -0.6, vy: 3.8, damage: 14 });
      enemyBullets.push({ x: e.x + e.width - 20, y: e.y + e.height, vx: 0.6, vy: 3.8, damage: 14 });
    }
  } else if (e.bossType === "STAR_DEVOURER") {
    e.x += e.vx;
    if (e.x <= 15 || e.x + e.width >= canvas.width - 15) e.vx *= -1;
    const stance = Math.floor(e.stateTimer / 240) % 2;
    if (stance === 0 && e.shootTimer >= 22) {
      e.shootTimer = 0;
      enemyBullets.push({ x: e.x + Math.random() * e.width, y: e.y + e.height, vx: (Math.random() - 0.5) * 1.2, vy: 4.5, damage: 14 });
    } else if (stance === 1 && e.shootTimer >= 88) {
      e.shootTimer = 0;
      for (let deg = 0; deg < 8; deg++) {
        const rad = (deg * Math.PI) / 4;
        enemyBullets.push({ x: e.x + e.width / 2, y: e.y + e.height / 2, vx: Math.cos(rad) * 3.1, vy: Math.sin(rad) * 3.1, damage: 18 });
      }
    }
  }
}

function drawPlayerShip() {
  const cx = player.x + player.width / 2;
  const cy = player.y + player.height / 2;
  const w = player.width;
  const h = player.height;
  const tier = player.tier;
  const shipId = player.shipId;

  if (player.invulnTimer > 0 && Math.floor(player.invulnTimer / 4) % 2 === 0) {
    ctx.globalAlpha = 0.45;
  }

  // Thruster Flame
  const flameColor = shipId === "crimson" ? "#ff4c4c" : shipId === "aegis" ? "#ffd166" : shipId === "void" ? "#c77dff" : "#66fcf1";
  const flameLen = 8 + tier * 3 + Math.random() * 8;
  ctx.fillStyle = flameColor;
  ctx.beginPath();
  ctx.moveTo(cx - 6, player.y + h - 2);
  ctx.lineTo(cx, player.y + h + flameLen);
  ctx.lineTo(cx + 6, player.y + h - 2);
  ctx.closePath();
  ctx.fill();

  if (shipId === "vanguard") {
    const grad = ctx.createLinearGradient(player.x, player.y, player.x + w, player.y);
    grad.addColorStop(0, "#1f283d");
    grad.addColorStop(0.5, tier === 3 ? "#ffd166" : "#66fcf1");
    grad.addColorStop(1, "#1f283d");
    ctx.fillStyle = grad;
    ctx.shadowColor = "#66fcf1";
    ctx.shadowBlur = 10 + tier * 3;

    ctx.beginPath();
    ctx.moveTo(cx, player.y);
    ctx.lineTo(player.x + w, player.y + h);
    ctx.lineTo(cx, player.y + h - 5);
    ctx.lineTo(player.x, player.y + h);
    ctx.closePath();
    ctx.fill();

    if (tier >= 2) {
      ctx.fillStyle = "#66fcf1";
      ctx.fillRect(player.x + 3, player.y + 8, 4, h - 10);
      ctx.fillRect(player.x + w - 7, player.y + 8, 4, h - 10);
    }
    if (tier === 3) {
      ctx.strokeStyle = "#ffd166";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(cx, player.y - 4);
      ctx.lineTo(cx, player.y + h - 6);
      ctx.stroke();
    }
  } else if (shipId === "crimson") {
    ctx.fillStyle = tier === 3 ? "#ff0055" : "#e63946";
    ctx.shadowColor = "#ff4c4c";
    ctx.shadowBlur = 12;

    ctx.beginPath();
    ctx.moveTo(cx, player.y - 2);
    ctx.lineTo(player.x + w + 4, player.y + h - 4);
    ctx.lineTo(player.x + w - 6, player.y + h);
    ctx.lineTo(cx, player.y + h - 8);
    ctx.lineTo(player.x + 6, player.y + h);
    ctx.lineTo(player.x - 4, player.y + h - 4);
    ctx.closePath();
    ctx.fill();

    if (tier >= 2) {
      ctx.fillStyle = "#ffb703";
      ctx.beginPath();
      ctx.moveTo(player.x - 4, player.y + 6);
      ctx.lineTo(player.x + 6, player.y + h - 4);
      ctx.lineTo(player.x - 2, player.y + h);
      ctx.moveTo(player.x + w + 4, player.y + 6);
      ctx.lineTo(player.x + w - 6, player.y + h - 4);
      ctx.lineTo(player.x + w + 2, player.y + h);
      ctx.fill();
    }
  } else if (shipId === "aegis") {
    ctx.fillStyle = tier === 3 ? "#ffb703" : "#d4a373";
    ctx.shadowColor = "#ffd166";
    ctx.shadowBlur = 12;

    ctx.beginPath();
    ctx.moveTo(cx - 6, player.y);
    ctx.lineTo(cx + 6, player.y);
    ctx.lineTo(player.x + w + 3, player.y + 12);
    ctx.lineTo(player.x + w, player.y + h);
    ctx.lineTo(player.x, player.y + h);
    ctx.lineTo(player.x - 3, player.y + 12);
    ctx.closePath();
    ctx.fill();

    if (tier >= 2) {
      ctx.fillStyle = "#66fcf1";
      ctx.fillRect(player.x - 6, player.y + 10, 5, 16);
      ctx.fillRect(player.x + w + 1, player.y + 10, 5, 16);
    }
    if (tier === 3) {
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(cx, cy + 2, 5, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (shipId === "void") {
    ctx.fillStyle = tier === 3 ? "#9d4edd" : "#5a189a";
    ctx.shadowColor = "#c77dff";
    ctx.shadowBlur = 14;

    ctx.beginPath();
    ctx.moveTo(cx, player.y);
    ctx.lineTo(player.x + w, cy + 4);
    ctx.lineTo(cx, player.y + h);
    ctx.lineTo(player.x, cy + 4);
    ctx.closePath();
    ctx.fill();

    if (tier >= 2) {
      ctx.fillStyle = "#e0aaff";
      ctx.fillRect(player.x - 7, cy - 2, 4, 12);
      ctx.fillRect(player.x + w + 3, cy - 2, 4, 12);
    }
    if (tier === 3) {
      ctx.strokeStyle = "#e0aaff";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(cx, cy, w * 0.72, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  ctx.shadowBlur = 0;

  if (player.hasShield && player.shield > 0) {
    ctx.strokeStyle = `rgba(102, 252, 241, ${0.35 + 0.65 * (player.shield / player.maxShield)})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, w * 0.95, 0, Math.PI * 2);
    ctx.stroke();
  }

  for (let d = 0; d < player.drones; d++) {
    const a = player.droneAngle + (d * Math.PI * 2) / player.drones;
    const dx = cx + Math.cos(a) * 40;
    const dy = cy + Math.sin(a) * 40;
    ctx.fillStyle = "#00bbf9";
    ctx.beginPath();
    ctx.arc(dx, dy, 5, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.globalAlpha = 1;
}
