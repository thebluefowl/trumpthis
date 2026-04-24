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

// Per-missile active interceptor count. Multiple batteries can stack shots on a
// high-threat target; each additional shot has diminishing marginal value (via
// scoring penalty) so cheap threats don't soak the defense grid.
const engagedMissiles = new Map(); // missileId → active interceptor count

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

      // Decrement engagement count (or clear if last)
      const remaining = (engagedMissiles.get(intc.targetMissileId) || 1) - 1;
      if (remaining <= 0) engagedMissiles.delete(intc.targetMissileId);
      else engagedMissiles.set(intc.targetMissileId, remaining);
    }
  }

  // === Fire new interceptors — pick highest-threat target in range ===
  for (const battery of gameState.interceptors) {
    if (battery.cooldownUntil > gameState.elapsed) continue;
    if (gameState.isEliminated(battery.countryId)) continue;

    const targetMissile = pickBestTarget(battery, engagedMissiles);
    if (!targetMissile) continue;

    const autoRate = targetMissile.mtype?.autoIntercept ?? INTERCEPT_AUTO_SUCCESS;
    const bonus = getInterceptBonus(battery.countryId);
    fireInterceptor(battery, targetMissile, Math.min(0.95, autoRate + bonus));
  }
}

// Threat score for prioritization — higher = engage first
function threatScore(missile, batteryBloc) {
  const mtype = missile.mtype || {};
  let score = (mtype.damage || 0.05) * 100;
  if (mtype.isNuke) score *= 8;              // nukes are existential
  if (mtype.warheads) score *= mtype.warheads; // MIRVs hit multiple times
  if (mtype.contamination) score *= 1.3;      // lingering zones are bad
  if (mtype.blastRadius) score += mtype.blastRadius * 0.1;
  // Hitting our own bloc? Huge multiplier.
  if (gameState.getBlocId(missile.toCountryId) === batteryBloc) score *= 3;
  // Urgency — if already >70% of flight, give a kicker so it's engaged now, not later
  const urgency = Math.max(0, missile.progress - 0.5) * 40;
  return score + urgency;
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
  engagedMissiles.set(missile.id, (engagedMissiles.get(missile.id) || 0) + 1);

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

function pickBestTarget(battery, engagedMissiles) {
  const rangeMult = getInterceptorRangeBonus(battery.countryId);
  const effectiveRange = INTERCEPTOR_RANGE * rangeMult;
  const batteryBloc = gameState.getBlocId(battery.countryId);

  let best = null;
  let bestScore = -Infinity;

  for (const missile of gameState.missiles) {
    if (gameState.getBlocId(missile.fromCountryId) === batteryBloc) continue;

    const missilePos = missile.interpolator(missile.progress);
    const dist = geoDistance(battery.position, missilePos);
    if (dist >= effectiveRange) continue;

    const threat = threatScore(missile, batteryBloc);
    const stacked = engagedMissiles.get(missile.id) || 0;
    // Diminishing returns: each additional interceptor on the same missile
    // divides that target's effective score, so stacking is only worthwhile
    // for very high-threat targets.
    const stackDivisor = Math.pow(2.2, stacked);
    // Hard cap to prevent piling on a single drone forever
    const maxStack = missile.mtype?.isNuke ? 4
      : missile.mtype?.warheads ? 3
      : 2;
    if (stacked >= maxStack) continue;

    const score = threat / stackDivisor - dist * 50;
    if (score > bestScore) {
      bestScore = score;
      best = missile;
    }
  }
  return best;
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

export function placeBattery(countryId, position, role, opts = {}) {
  const country = gameState.countries.get(countryId);
  if (!country) return false;
  const bloc = gameState.getBloc(countryId);

  // Tech: Industrial Base — batteries cost 25% less
  const buildMult = getBuildCostMultiplier(countryId);
  const cost = Math.ceil(gameState.getBatteryCost(countryId) * buildMult);
  if (!opts.skipCost) {
    if (!bloc || bloc.tokens < cost) return false;
    bloc.tokens -= cost;
  }

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
