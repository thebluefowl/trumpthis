import { EXPLOSION_DURATION } from '../constants.js';
import { gameState } from '../state/GameState.js';
import { events } from '../state/events.js';
import { sampleFullArc, triggerShake, triggerFlash } from '../rendering/CanvasOverlay.js';
import { createInterpolator, geoDistance } from '../rendering/Projection.js';
import { createMissile } from '../ai/AIManager.js';

export function updateMissiles(dt) {
  const toRemove = [];
  const toAdd = [];

  for (let i = 0; i < gameState.missiles.length; i++) {
    const missile = gameState.missiles[i];
    missile.progress += missile.speed * dt;

    // MIRV split
    if (missile.mtype?.warheads && !missile.split && missile.progress >= (missile.mtype.splitAt || 0.7)) {
      missile.split = true;
      const splitPos = missile.interpolator(missile.progress);
      const warheadCount = missile.mtype.warheads;

      // Create warhead missiles spreading around the target
      for (let w = 0; w < warheadCount; w++) {
        const angle = (w / warheadCount) * Math.PI * 2;
        const spread = 2 + Math.random() * 2; // degrees of spread
        const warheadTarget = [
          missile.target[0] + Math.cos(angle) * spread,
          missile.target[1] + Math.sin(angle) * spread,
        ];

        const warhead = {
          id: crypto.randomUUID(),
          fromCountryId: missile.fromCountryId,
          toCountryId: missile.toCountryId,
          origin: splitPos,
          target: warheadTarget,
          progress: 0,
          speed: 1 / 1.5, // warheads are fast — 1.5s to impact
          interpolator: createInterpolator(splitPos, warheadTarget),
          arcHeight: 0.05,
          isPlayer: missile.isPlayer,
          launched: gameState.elapsed,
          type: 'mirv_warhead',
          mtype: { ...missile.mtype, warheads: 0 }, // no further splitting
          split: true,
          isWarhead: true,
        };
        toAdd.push(warhead);
      }

      // Remove the parent MIRV
      toRemove.push(i);
      continue;
    }

    // Decoy spawning at launch (progress near 0)
    if (missile.mtype?.decoyCount && !missile.decoysSpawned && missile.progress > 0.02) {
      missile.decoysSpawned = true;
      for (let d = 0; d < missile.mtype.decoyCount; d++) {
        const spread = 3 + Math.random() * 4;
        const angle = (d / missile.mtype.decoyCount) * Math.PI * 2;
        const decoyTarget = [
          missile.target[0] + Math.cos(angle) * spread,
          missile.target[1] + Math.sin(angle) * spread,
        ];
        const decoy = {
          id: crypto.randomUUID(),
          fromCountryId: missile.fromCountryId,
          toCountryId: missile.toCountryId,
          origin: missile.origin,
          target: decoyTarget,
          progress: missile.progress,
          speed: missile.speed * (0.9 + Math.random() * 0.2),
          interpolator: createInterpolator(missile.origin, decoyTarget),
          arcHeight: missile.arcHeight,
          isPlayer: missile.isPlayer,
          launched: missile.launched,
          type: 'decoy_fake',
          mtype: { ...missile.mtype, decoyCount: 0, damage: 0, trailColor: '#ff6600' },
          isDecoy: true,
        };
        toAdd.push(decoy);
      }
    }

    if (missile.progress >= 1.0) {
      missile.progress = 1.0;

      // Decoy fakes just vanish
      if (missile.isDecoy) {
        toRemove.push(i);
        continue;
      }

      if (missile.mtype?.empDuration) {
        applyEMP(missile);
      } else {
        // Normal explosion
        gameState.explosions.push({
          id: crypto.randomUUID(),
          position: missile.target,
          startTime: gameState.elapsed,
          duration: missile.mtype?.isNuke ? EXPLOSION_DURATION * 2 : EXPLOSION_DURATION,
          maxRadius: missile.mtype?.blastRadius || 25,
          countryId: missile.toCountryId,
          attackerId: missile.fromCountryId,
          damageApplied: false,
          damage: missile.mtype?.damage || 0.05,
          isNuke: missile.mtype?.isNuke || false,
        });

        // Contamination zone
        if (missile.mtype?.contamination) {
          gameState.contaminations = gameState.contaminations || [];
          gameState.contaminations.push({
            position: missile.target,
            countryId: missile.toCountryId,
            startTime: gameState.elapsed,
            duration: missile.mtype.contaminationDuration,
            damagePerSecond: missile.mtype.contaminationDamage,
            radius: 0.04, // radians
          });
        }
      }

      // Create fading trail
      gameState.trails.push({
        points: sampleFullArc(missile, 20),
        startTime: gameState.elapsed,
      });

      const hitPlayer = missile.toCountryId === gameState.playerCountryId;
      const hitAlly = gameState.isAllied(gameState.playerCountryId, missile.toCountryId);

      if (missile.mtype?.isNuke) {
        // Nukes always shake and flash — they're globally visible events
        triggerShake(hitPlayer ? 800 : 200);
        triggerFlash('#ffffff', hitPlayer ? 600 : 150);
      } else if (hitPlayer) {
        // Direct hit on player — strong shake + flash
        triggerShake(missile.isWarhead ? 200 : 400);
        triggerFlash('#ff6600', 200);
      } else if (hitAlly) {
        // Ally hit — subtle shake
        triggerShake(50);
      }
      // Other nations hit — no shake, no flash

      // Nuclear consequences — global diplomatic fallout
      if (missile.mtype?.isNuke) {
        gameState.nuclearWinterLevel++;
        // Everyone hates the launcher
        for (const [id] of gameState.countries) {
          if (id === missile.fromCountryId) continue;
          if (gameState.isAllied(missile.fromCountryId, id)) continue;
          gameState.shiftRelationship(missile.fromCountryId, id, -30);
        }
        gameState.addNotification(`⚠ NUCLEAR DETONATION by ${gameState.countries.get(missile.fromCountryId)?.name} — global condemnation`, 'escalation');
      }

      events.emit('missile:impact', missile);
      toRemove.push(i);
    }
  }

  // Remove impacted/split missiles (reverse order)
  for (let i = toRemove.length - 1; i >= 0; i--) {
    gameState.missiles.splice(toRemove[i], 1);
  }

  // Add MIRV warheads
  for (const warhead of toAdd) {
    gameState.missiles.push(warhead);
  }
}

function applyEMP(missile) {
  const empRange = 0.2; // radians
  const empDuration = missile.mtype.empDuration;

  for (const battery of gameState.interceptors) {
    // Don't EMP your own or allied batteries
    if (battery.countryId === missile.fromCountryId) continue;
    if (gameState.isAllied(battery.countryId, missile.fromCountryId)) continue;

    const dist = geoDistance(battery.position, missile.target);
    if (dist < empRange) {
      battery.cooldownUntil = Math.max(battery.cooldownUntil, gameState.elapsed + empDuration);
    }
  }

  // Visual: purple flash instead of explosion
  gameState.explosions.push({
    id: crypto.randomUUID(),
    position: missile.target,
    startTime: gameState.elapsed,
    duration: EXPLOSION_DURATION,
    maxRadius: 35,
    countryId: missile.toCountryId,
    attackerId: missile.fromCountryId,
    damageApplied: true, // no population damage
    isEMP: true,
  });

  events.emit('emp:detonated', missile);
}

export function cleanupExpired() {
  const now = gameState.elapsed;

  gameState.explosions = gameState.explosions.filter(
    e => (now - e.startTime) * 1000 < (e.isNuke ? EXPLOSION_DURATION * 2 : EXPLOSION_DURATION) + 500
  );

  gameState.trails = gameState.trails.filter(
    t => (now - t.startTime) * 1000 < 4000
  );

  // Process contamination zones
  if (gameState.contaminations) {
    for (let i = gameState.contaminations.length - 1; i >= 0; i--) {
      const zone = gameState.contaminations[i];
      if (now - zone.startTime > zone.duration) {
        gameState.contaminations.splice(i, 1);
        continue;
      }

      // Damage nearby cities every second
      const country = gameState.countries.get(zone.countryId);
      if (!country || gameState.isEliminated(zone.countryId)) continue;

      for (const city of country.cities) {
        if (city.destroyed) continue;
        const dist = geoDistance(zone.position, city.coords);
        if (dist < zone.radius) {
          const loss = Math.floor(city.population * zone.damagePerSecond * 0.016); // ~per frame at 60fps
          city.population = Math.max(0, city.population - loss);
          if (city.population <= 0) city.destroyed = true;
        }
      }
      country.population = country.cities.reduce((s, c) => s + c.population, 0);
    }
  }
}
