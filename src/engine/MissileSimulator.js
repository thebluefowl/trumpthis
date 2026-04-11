import { EXPLOSION_DURATION } from '../constants.js';
import { gameState } from '../state/GameState.js';
import { events } from '../state/events.js';
import { sampleFullArc, triggerShake } from '../rendering/CanvasOverlay.js';

export function updateMissiles(dt) {
  const toRemove = [];

  for (let i = 0; i < gameState.missiles.length; i++) {
    const missile = gameState.missiles[i];
    missile.progress += missile.speed * dt;

    if (missile.progress >= 1.0) {
      missile.progress = 1.0;

      // Create explosion
      gameState.explosions.push({
        id: crypto.randomUUID(),
        position: missile.target,
        startTime: gameState.elapsed,
        duration: EXPLOSION_DURATION,
        maxRadius: 25,
        countryId: missile.toCountryId,
        damageApplied: false,
      });

      // Create fading trail
      gameState.trails.push({
        points: sampleFullArc(missile, 20),
        startTime: gameState.elapsed,
      });

      // Screen shake
      triggerShake(200);

      events.emit('missile:impact', missile);
      toRemove.push(i);
    }
  }

  // Remove impacted missiles (reverse order to preserve indices)
  for (let i = toRemove.length - 1; i >= 0; i--) {
    gameState.missiles.splice(toRemove[i], 1);
  }
}

export function cleanupExpired() {
  const now = gameState.elapsed;

  // Remove finished explosions
  gameState.explosions = gameState.explosions.filter(
    e => (now - e.startTime) * 1000 < EXPLOSION_DURATION + 500
  );

  // Remove faded trails
  gameState.trails = gameState.trails.filter(
    t => (now - t.startTime) * 1000 < 4000
  );
}
