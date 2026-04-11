import { TOKEN_RATES } from '../constants.js';
import { gameState } from '../state/GameState.js';

export function updateTokens(dt) {
  for (const [id, country] of gameState.countries) {
    const popRatio = country.population / country.startingPopulation;
    // Log curve: early strikes hurt less, sustained damage compounds
    const genFactor = Math.log(popRatio + 1) / Math.log(2);
    const rate = TOKEN_RATES[country.tier] * genFactor;

    country.tokens = Math.min(
      country.tokenCap,
      country.tokens + rate * dt
    );
  }
}
