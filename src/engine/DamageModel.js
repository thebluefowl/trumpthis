import { DAMAGE_PER_HIT } from '../constants.js';
import { gameState } from '../state/GameState.js';
import { events } from '../state/events.js';
import { renderPaths } from '../rendering/Globe.js';

export function processImpacts() {
  for (const explosion of gameState.explosions) {
    if (explosion.damageApplied) continue;

    const country = gameState.countries.get(explosion.countryId);
    if (!country || country.population <= 0) {
      explosion.damageApplied = true;
      continue;
    }

    const populationLoss = Math.floor(country.population * DAMAGE_PER_HIT);
    country.population = Math.max(0, country.population - populationLoss);
    explosion.damageApplied = true;

    // Track stats
    if (country.role === 'ai') {
      gameState.stats.playerDamageDealt += populationLoss;
    } else {
      gameState.stats.aiDamageDealt += populationLoss;
    }

    // Update country fill colors on the globe
    renderPaths();

    if (country.population <= 0) {
      events.emit('country:destroyed', country);
    }
  }
}
