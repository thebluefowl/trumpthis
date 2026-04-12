import { STARTING_TOKENS, TOKEN_CAPS, MAX_BATTERIES, INVASION_THRESHOLD, INVASION_BASE_COST } from '../constants.js';
import { COUNTRIES, COUNTRY_MAP } from './countryData.js';

function relKey(a, b) {
  return a < b ? `${a}:${b}` : `${b}:${a}`;
}

class GameState {
  constructor() {
    this.reset();
  }

  reset() {
    this.phase = 'SELECT'; // SELECT | PICK_BLOC | PLAYING | GAME_OVER
    this.playerCountryId = null;
    this.playerBlocId = null;

    // Runtime country state keyed by country id
    this.countries = new Map();

    // Diplomacy
    this.relationships = new Map(); // "id1:id2" → number (-100 to +100)
    this.alliances = new Set();     // "id1:id2" strings (sorted pair)
    this.eliminated = new Set();    // country IDs
    this.proposals = [];            // { fromId, toId, timestamp }
    this.notifications = [];        // { text, timestamp, type }

    this.missiles = [];
    this.explosions = [];
    this.trails = [];
    this.interceptors = [];
    this.intercepts = [];

    this.elapsed = 0;
    this.paused = false;
    this.nuclearWinterLevel = 0;
    this.contaminations = [];
    this.invasions = [];

    this.stats = {
      playerLaunched: 0,
      playerDamageDealt: 0,
      playerIntercepted: 0,
    };
  }

  initAllCountries() {
    for (const def of COUNTRIES) {
      const tier = def.tier;
      this.countries.set(def.id, {
        id: def.id,
        name: def.name,
        tier,
        population: def.population,
        startingPopulation: def.population,
        tokens: STARTING_TOKENS,
        tokenCap: TOKEN_CAPS[tier],
        launchSites: def.launchSites.map(coords => ({
          coords,
          disabled: false,
          disabledUntil: 0,
        })),
        cities: (def.cities || []).map(city => ({
          name: city.name,
          coords: city.coords,
          population: Math.floor(def.population * city.popShare),
          startingPopulation: Math.floor(def.population * city.popShare),
          destroyed: false,
        })),
        centroid: def.centroid,
        role: def.id === this.playerCountryId ? 'player' : 'ai',
        combatStats: {
          missilesLaunched: 0,
          missilesIntercepted: 0,
          damageDealt: 0,
          damageTaken: 0,
        },
      });
    }
  }

  startGame(playerCountryId, blocId) {
    this.playerCountryId = playerCountryId;
    this.playerBlocId = blocId;
    this.initAllCountries();
    this.phase = 'PLAYING';
    this.elapsed = 0;
  }

  getPlayer() {
    return this.countries.get(this.playerCountryId);
  }

  // === Relationships ===

  getRelationship(a, b) {
    if (a === b) return 100;
    return this.relationships.get(relKey(a, b)) || 0;
  }

  setRelationship(a, b, value) {
    if (a === b) return;
    this.relationships.set(relKey(a, b), Math.max(-100, Math.min(100, value)));
  }

  shiftRelationship(a, b, delta) {
    const current = this.getRelationship(a, b);
    this.setRelationship(a, b, current + delta);
  }

  // === Alliances ===

  isAllied(a, b) {
    return this.alliances.has(relKey(a, b));
  }

  formAlliance(a, b) {
    this.alliances.add(relKey(a, b));
  }

  breakAlliance(a, b) {
    this.alliances.delete(relKey(a, b));
  }

  getAllies(countryId) {
    const allies = [];
    for (const key of this.alliances) {
      const [a, b] = key.split(':');
      if (a === countryId) allies.push(b);
      else if (b === countryId) allies.push(a);
    }
    return allies;
  }

  // === Elimination ===

  isEliminated(countryId) {
    return this.eliminated.has(countryId);
  }

  eliminateCountry(countryId) {
    this.eliminated.add(countryId);
    // Break all alliances with eliminated nation
    for (const key of [...this.alliances]) {
      const [a, b] = key.split(':');
      if (a === countryId || b === countryId) {
        this.alliances.delete(key);
      }
    }
  }

  getActiveCountries() {
    return [...this.countries.values()].filter(c => !this.eliminated.has(c.id));
  }

  getActiveAI() {
    return this.getActiveCountries().filter(c => c.role === 'ai');
  }

  // === Batteries ===

  getBatteryCount(countryId) {
    return this.interceptors.filter(b => b.countryId === countryId).length;
  }

  getMaxBatteries(countryId) {
    const country = this.countries.get(countryId);
    return country ? MAX_BATTERIES[country.tier] : 0;
  }

  canPlaceBattery(countryId) {
    return true; // no cap — cost scales instead
  }

  getBatteryCost(countryId) {
    const count = this.getBatteryCount(countryId);
    // Linear scaling: 8, 10, 12, 14, 16, 18, 20...
    return 8 + count * 2;
  }

  // === Invasion ===

  canInvade(attackerId, targetId) {
    if (attackerId === targetId) return false;
    if (this.isEliminated(targetId)) return false;
    if (this.isAllied(attackerId, targetId)) return false;

    const target = this.countries.get(targetId);
    if (!target) return false;

    const popRatio = target.population / target.startingPopulation;
    return popRatio < INVASION_THRESHOLD && popRatio > 0;
  }

  getInvasionCost(attackerId, targetId) {
    const target = this.countries.get(targetId);
    if (!target) return Infinity;

    const popRatio = target.population / target.startingPopulation;
    // Cost scales with remaining strength — weaker = cheaper
    // Tier multiplier: superpowers are harder to invade
    const tierMult = target.tier === 1 ? 2.0 : target.tier === 2 ? 1.5 : 1.0;
    return Math.ceil(INVASION_BASE_COST * popRatio * 4 * tierMult);
  }

  executeInvasion(attackerId, targetId) {
    if (!this.canInvade(attackerId, targetId)) return false;

    const attacker = this.countries.get(attackerId);
    const target = this.countries.get(targetId);
    const cost = this.getInvasionCost(attackerId, targetId);

    // Create invasion animation
    this.invasions.push({
      from: attacker.centroid,
      to: target.centroid,
      attackerName: attacker.name,
      targetName: target.name,
      startTime: this.elapsed,
      duration: 3, // seconds
    });

    if (!attacker || attacker.tokens < cost) return false;

    attacker.tokens -= cost;

    // Absorb territory
    attacker.population += target.population;
    attacker.startingPopulation += target.startingPopulation;

    // Inherit launch sites
    for (const site of target.launchSites) {
      attacker.launchSites.push({ ...site });
    }

    // Inherit batteries
    for (const battery of this.interceptors) {
      if (battery.countryId === targetId) {
        battery.countryId = attackerId;
        battery.role = attacker.role;
      }
    }

    // Inherit cities
    for (const city of target.cities) {
      attacker.cities.push({ ...city });
    }

    // Eliminate the target
    target.population = 0;
    target.cities.forEach(c => { c.population = 0; c.destroyed = true; });
    this.eliminateCountry(targetId);

    return true;
  }

  // === Notifications ===

  addNotification(text, type = 'info') {
    this.notifications.push({ text, timestamp: this.elapsed, type });
    // Keep last 10
    if (this.notifications.length > 10) this.notifications.shift();
  }
}

export const gameState = new GameState();
export { relKey };
