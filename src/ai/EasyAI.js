import { MISSILE_COST, MISSILE_SPEED, AI_LAUNCH_COOLDOWN, AI_COOLDOWN_VARIANCE, AI_BATTERY_INTERVAL, INTERCEPTOR_COST } from '../constants.js';
import { gameState } from '../state/GameState.js';
import { createInterpolator } from '../rendering/Projection.js';
import { placeBattery } from '../engine/InterceptorSystem.js';

let timeSinceLastLaunch = 0;
let timeSinceLastBattery = 0;
let cooldown = AI_LAUNCH_COOLDOWN;

export function resetAI() {
  timeSinceLastLaunch = 0;
  timeSinceLastBattery = 0;
  cooldown = AI_LAUNCH_COOLDOWN;
}

export function updateAI(dt) {
  if (gameState.phase !== 'PLAYING') return;

  const ai = gameState.getAI();
  const player = gameState.getPlayer();
  if (!ai || !player || ai.population <= 0 || player.population <= 0) return;

  // === Battery placement ===
  timeSinceLastBattery += dt * 1000;
  if (timeSinceLastBattery >= AI_BATTERY_INTERVAL) {
    tryPlaceBattery(ai);
    timeSinceLastBattery = 0;
  }

  // === Missile launching ===
  timeSinceLastLaunch += dt * 1000;

  if (timeSinceLastLaunch < cooldown) return;
  if (ai.tokens < MISSILE_COST) return;

  // Pick a random operational launch site
  const activeSites = ai.launchSites.filter(s => !s.disabled);
  if (activeSites.length === 0) return;

  const launchSite = activeSites[Math.floor(Math.random() * activeSites.length)];

  // Pick a random target: player launch sites or centroid
  const targets = [
    ...player.launchSites.map(s => s.coords),
    player.centroid,
  ];
  const target = targets[Math.floor(Math.random() * targets.length)];

  // Launch
  launchMissile(ai, player, launchSite.coords, target, false);
  ai.tokens -= MISSILE_COST;
  gameState.stats.aiLaunched++;
  timeSinceLastLaunch = 0;

  // Randomize next cooldown
  const variance = 1 - AI_COOLDOWN_VARIANCE / 2 + Math.random() * AI_COOLDOWN_VARIANCE;
  cooldown = AI_LAUNCH_COOLDOWN * variance;
}

function tryPlaceBattery(ai) {
  if (!gameState.canPlaceBattery(ai.id)) return;
  if (ai.tokens < INTERCEPTOR_COST) return;

  // Place near launch sites or centroid with some random offset
  const positions = [
    ai.centroid,
    ...ai.launchSites.map(s => s.coords),
  ];

  const basePos = positions[Math.floor(Math.random() * positions.length)];

  // Add small random offset (±2 degrees)
  const offset = [
    basePos[0] + (Math.random() - 0.5) * 4,
    basePos[1] + (Math.random() - 0.5) * 4,
  ];

  placeBattery(ai.id, offset, 'ai');
}

function launchMissile(fromCountry, toCountry, origin, target, isPlayer) {
  const missile = {
    id: crypto.randomUUID(),
    fromCountryId: fromCountry.id,
    toCountryId: toCountry.id,
    origin,
    target,
    progress: 0,
    speed: MISSILE_SPEED,
    interpolator: createInterpolator(origin, target),
    arcHeight: 0.3 + Math.random() * 0.1,
    isPlayer,
    launched: gameState.elapsed,
  };

  gameState.missiles.push(missile);
}

// Exported for player use
export function playerLaunchMissile(origin, target) {
  const player = gameState.getPlayer();
  const ai = gameState.getAI();
  if (!player || !ai) return false;
  if (player.tokens < MISSILE_COST) return false;

  launchMissile(player, ai, origin, target, true);
  player.tokens -= MISSILE_COST;
  gameState.stats.playerLaunched++;
  return true;
}
