import {
  INTERCEPTOR_RANGE,
  INTERCEPTOR_COOLDOWN,
  INTERCEPT_AUTO_SUCCESS,
  INTERCEPT_MANUAL_SUCCESS,
  INTERCEPTOR_COST,
} from '../constants.js';
import { gameState } from '../state/GameState.js';
import { events } from '../state/events.js';
import { geoDistance } from '../rendering/Projection.js';
import { getInterceptBonus, getInterceptorCooldownMultiplier, getInterceptorRangeBonus, canDefendAllies, getBuildCostMultiplier, getEMPResistance, getEnemyInterceptPenalty } from './ResearchSystem.js';

// Terminal phase intercept: fires when missile enters range, resolves in ~0.8s
const INTERCEPT_RESOLVE_TIME = 0.8; // seconds — very fast, like a real terminal intercept

// Track which missiles have already been engaged (one attempt per battery pass)
const engagedMissiles = new Set();

export function updateInterceptors(dt) {
  if (gameState.phase !== 'PLAYING') return;

  // === Resolve pending intercepts ===
  for (let i = gameState.intercepts.length - 1; i >= 0; i--) {
    const intc = gameState.intercepts[i];
    if (intc.resolved) {
      // Keep resolved intercepts for 1s for visual, then remove
      if (gameState.elapsed - intc.resolvedAt > 1.0) {
        gameState.intercepts.splice(i, 1);
      }
      continue;
    }

    intc.progress = Math.min(1, (gameState.elapsed - intc.startTime) / INTERCEPT_RESOLVE_TIME);

    if (intc.progress >= 1.0) {
      intc.resolved = true;
      intc.resolvedAt = gameState.elapsed;

      // Roll for hit/miss
      const success = Math.random() < intc.successRate;
      intc.success = success;

      if (success) {
        const idx = gameState.missiles.findIndex(m => m.id === intc.targetMissileId);
        if (idx !== -1) {
          gameState.missiles.splice(idx, 1);
        }

        const batteryCountry = gameState.countries.get(intc.batteryCountryId);
        if (batteryCountry) batteryCountry.combatStats.missilesIntercepted++;
        if (intc.batteryCountryId === gameState.playerCountryId) {
          gameState.stats.playerIntercepted++;
        }

        events.emit('missile:intercepted', {
          missile: { fromCountryId: intc.attackerCountryId, toCountryId: intc.batteryCountryId },
          battery: { countryId: intc.batteryCountryId },
        });
      }

      // If missed, release the missile so another battery can try
      engagedMissiles.delete(intc.targetMissileId);
    }
  }

  // === Fire new interceptors — terminal phase, only when missile is in range ===
  for (const battery of gameState.interceptors) {
    if (battery.cooldownUntil > gameState.elapsed) continue;
    if (gameState.isEliminated(battery.countryId)) continue; // dead nations don't fight

    const targetMissile = findMissileInRange(battery);
    if (!targetMissile) continue;
    if (engagedMissiles.has(targetMissile.id)) continue;

    const autoRate = targetMissile.mtype?.autoIntercept ?? INTERCEPT_AUTO_SUCCESS;
    const bonus = getInterceptBonus(battery.countryId);
    fireInterceptor(battery, targetMissile, Math.min(0.95, autoRate + bonus));
  }
}

export function manualIntercept(missile) {
  if (gameState.phase !== 'PLAYING') return false;
  if (missile.isPlayer) return false;

  const battery = findBatteryForMissile(missile, gameState.playerCountryId);
  if (!battery) return false;

  const manualRate = missile.mtype?.manualIntercept ?? INTERCEPT_MANUAL_SUCCESS;
  const bonus = getInterceptBonus(battery.countryId);
  fireInterceptor(battery, missile, Math.min(0.95, manualRate + bonus));
  return true;
}

function fireInterceptor(battery, missile, successRate) {
  engagedMissiles.add(missile.id);

  // Tech: Point Defense Systems — faster recharge
  const cdMult = getInterceptorCooldownMultiplier(battery.countryId);
  battery.cooldownUntil = gameState.elapsed + INTERCEPTOR_COOLDOWN * cdMult;

  // Tech: Hypersonic Glide — attacker's missiles are harder to intercept
  const attackerPenalty = getEnemyInterceptPenalty(missile.fromCountryId);
  successRate = Math.max(0.05, successRate + attackerPenalty);

  // Predict where the missile will be when the interceptor arrives
  const futureProgress = Math.min(1.0, missile.progress + missile.speed * INTERCEPT_RESOLVE_TIME);
  const interceptPos = missile.interpolator(futureProgress);

  gameState.intercepts.push({
    id: crypto.randomUUID(),
    batteryPos: battery.position,
    interceptPos,
    targetMissileId: missile.id,
    targetMissileRef: missile, // live reference for tracking
    startTime: gameState.elapsed,
    progress: 0,
    successRate,
    batteryCountryId: battery.countryId,
    attackerCountryId: missile.fromCountryId,
    resolved: false,
    success: false,
  });
}

function findMissileInRange(battery) {
  let nearest = null;
  let nearestDist = Infinity;

  // Tech: AEGIS Defense Network — +20% range
  const rangeMult = getInterceptorRangeBonus(battery.countryId);
  const effectiveRange = INTERCEPTOR_RANGE * rangeMult;

  // Tech: AEGIS — can defend allies
  const defendsAllies = canDefendAllies(battery.countryId);

  for (const missile of gameState.missiles) {
    if (missile.fromCountryId === battery.countryId) continue;
    if (gameState.isAllied(missile.fromCountryId, battery.countryId)) continue;

    // Only intercept missiles targeting this nation or allies (if AEGIS)
    const targetingUs = missile.toCountryId === battery.countryId;
    const targetingAlly = defendsAllies && gameState.isAllied(battery.countryId, missile.toCountryId);
    if (!targetingUs && !targetingAlly) {
      // Still intercept if missile is just passing through our range
      // (any hostile missile in range gets intercepted)
    }

    const missilePos = missile.interpolator(missile.progress);
    const dist = geoDistance(battery.position, missilePos);

    if (dist < effectiveRange && dist < nearestDist) {
      nearest = missile;
      nearestDist = dist;
    }
  }

  return nearest;
}

function findBatteryForMissile(missile, countryId) {
  const missilePos = missile.interpolator(missile.progress);
  let best = null;
  let bestDist = Infinity;

  for (const battery of gameState.interceptors) {
    if (battery.countryId !== countryId) continue;
    if (battery.cooldownUntil > gameState.elapsed) continue;

    const dist = geoDistance(battery.position, missilePos);
    if (dist < INTERCEPTOR_RANGE && dist < bestDist) {
      best = battery;
      bestDist = dist;
    }
  }

  return best;
}

export function placeBattery(countryId, position, role) {
  const country = gameState.countries.get(countryId);
  if (!country) return false;

  // Tech: Industrial Base — batteries cost 25% less
  const buildMult = getBuildCostMultiplier(countryId);
  const cost = Math.ceil(gameState.getBatteryCost(countryId) * buildMult);
  if (country.tokens < cost) return false;

  country.tokens -= cost;

  const battery = {
    id: crypto.randomUUID(),
    countryId,
    position,
    range: INTERCEPTOR_RANGE,
    cooldownUntil: 0,
    role,
  };

  gameState.interceptors.push(battery);
  events.emit('battery:placed', battery);
  return true;
}

export function resetInterceptors() {
  engagedMissiles.clear();
}
