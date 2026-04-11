import { STARTING_TOKENS, TOKEN_CAPS } from '../constants.js';
import { COUNTRY_MAP } from './countryData.js';

class GameState {
  constructor() {
    this.reset();
  }

  reset() {
    this.phase = 'SELECT'; // SELECT | PLAYING | GAME_OVER
    this.playerCountryId = null;
    this.aiCountryId = null;

    // Runtime country state keyed by country id
    // { population, startingPopulation, tokens, tokenCap, tier, launchSites, centroid, name }
    this.countries = new Map();

    this.missiles = [];    // in-flight missiles
    this.explosions = [];  // active explosion animations
    this.trails = [];      // fading missile trails

    this.elapsed = 0;      // total game time in seconds
    this.paused = false;

    // Stats for game over screen
    this.stats = {
      playerLaunched: 0,
      aiLaunched: 0,
      playerDamageDealt: 0,
      aiDamageDealt: 0,
    };
  }

  initCountry(countryDef, role) {
    const tier = countryDef.tier;
    this.countries.set(countryDef.id, {
      id: countryDef.id,
      name: countryDef.name,
      tier,
      population: countryDef.population,
      startingPopulation: countryDef.population,
      tokens: STARTING_TOKENS,
      tokenCap: TOKEN_CAPS[tier],
      launchSites: countryDef.launchSites.map(coords => ({
        coords,
        disabled: false,
        disabledUntil: 0,
      })),
      centroid: countryDef.centroid,
      role, // 'player' | 'ai'
    });
  }

  startGame(playerCountryId, aiCountryId) {
    this.playerCountryId = playerCountryId;
    this.aiCountryId = aiCountryId;

    const playerDef = COUNTRY_MAP.get(playerCountryId);
    const aiDef = COUNTRY_MAP.get(aiCountryId);

    this.initCountry(playerDef, 'player');
    this.initCountry(aiDef, 'ai');

    this.phase = 'PLAYING';
    this.elapsed = 0;
  }

  getPlayer() {
    return this.countries.get(this.playerCountryId);
  }

  getAI() {
    return this.countries.get(this.aiCountryId);
  }
}

export const gameState = new GameState();
