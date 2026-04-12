import { TOKEN_RATES, PLAYER_TOKEN_BONUS } from '../constants.js';
import { gameState } from '../state/GameState.js';
import { getTokenMultiplier } from './Escalation.js';
import { getResourceBonus } from './ResourceSystem.js';

export function updateTokens(dt) {
  const tokenMult = getTokenMultiplier();
  for (const country of gameState.getActiveCountries()) {
    const popRatio = country.population / country.startingPopulation;
    const genFactor = Math.log(popRatio + 1) / Math.log(2);
    const playerBonus = country.id === gameState.playerCountryId ? PLAYER_TOKEN_BONUS : 1.0;
    const winterPenalty = Math.max(0.5, 1 - gameState.nuclearWinterLevel * 0.07); // -7% per nuke, min 50%
    const baseRate = TOKEN_RATES[country.tier] * genFactor * tokenMult * playerBonus * winterPenalty;
    const resourceBonus = getResourceBonus(country.id);
    const rate = baseRate + resourceBonus;

    country.tokens = Math.min(
      country.tokenCap,
      country.tokens + rate * dt
    );
  }
}
