import { TOKEN_RATES, PLAYER_TOKEN_BONUS } from '../constants.js';
import { gameState } from '../state/GameState.js';
import { getTokenMultiplier, isEscalationActive } from './Escalation.js';
import { getResourceBonus } from './ResourceSystem.js';
import { getResourceMultiplier, getWarEconomyBonus, getSuperpowerEconomy } from './ResearchSystem.js';

// Ticks tokens at the bloc level. Rate is the sum of per-member generation so
// a bigger coalition earns more, but population loss across any member still
// drags on output. Tokens pool at the bloc, not per country.
export function updateTokens(dt) {
  const tokenMult = getTokenMultiplier();
  const escalating = isEscalationActive();
  const playerBlocId = gameState.playerBlocId;

  for (const [blocId, bloc] of gameState.blocs) {
    const members = gameState.getBlocCountries(blocId).filter(c => !gameState.isEliminated(c.id));
    if (members.length === 0) continue;

    let rate = 0;
    for (const country of members) {
      const popRatio = country.population / country.startingPopulation;
      const genFactor = Math.log(popRatio + 1) / Math.log(2);
      const winterPenalty = Math.max(0.5, 1 - gameState.nuclearWinterLevel * 0.07);
      const warEcon = escalating ? getWarEconomyBonus(country.id) : 1.0;
      const superEcon = getSuperpowerEconomy(country.id);
      const baseRate = TOKEN_RATES[country.tier] * genFactor * tokenMult * winterPenalty * warEcon * superEcon.genMultiplier;
      const resMult = getResourceMultiplier(country.id);
      const resourceBonus = getResourceBonus(country.id) * resMult;
      rate += baseRate + resourceBonus;
    }

    // Player bonus (only on player's bloc)
    if (blocId === playerBlocId) rate *= PLAYER_TOKEN_BONUS;

    bloc.tokens = Math.min(bloc.tokenCap, bloc.tokens + rate * dt);
  }
}
