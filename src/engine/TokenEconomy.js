import { TOKEN_RATES, PLAYER_TOKEN_BONUS } from '../constants.js';
import { gameState } from '../state/GameState.js';
import { getTokenMultiplier } from './Escalation.js';
import { getResourceBonus } from './ResourceSystem.js';
import { getResourceMultiplier, getWarEconomyBonus, getSuperpowerEconomy } from './ResearchSystem.js';
import { isEscalationActive } from './Escalation.js';

export function updateTokens(dt) {
  const tokenMult = getTokenMultiplier();
  const escalating = isEscalationActive();

  for (const country of gameState.getActiveCountries()) {
    const popRatio = country.population / country.startingPopulation;
    const genFactor = Math.log(popRatio + 1) / Math.log(2);
    const playerBonus = country.id === gameState.playerCountryId ? PLAYER_TOKEN_BONUS : 1.0;
    const winterPenalty = Math.max(0.5, 1 - gameState.nuclearWinterLevel * 0.07);

    // Tech: Wartime Production (+40% during escalation)
    const warEcon = escalating ? getWarEconomyBonus(country.id) : 1.0;

    // Tech: Superpower Economy (+50% gen, +100 cap)
    const superEcon = getSuperpowerEconomy(country.id);

    const baseRate = TOKEN_RATES[country.tier] * genFactor * tokenMult * playerBonus * winterPenalty * warEcon * superEcon.genMultiplier;

    // Tech: Resource Extraction (+25% resource bonuses)
    const resMult = getResourceMultiplier(country.id);
    const resourceBonus = getResourceBonus(country.id) * resMult;

    const rate = baseRate + resourceBonus;
    const cap = country.tokenCap + superEcon.tokenCapBonus;

    country.tokens = Math.min(cap, country.tokens + rate * dt);
  }
}
