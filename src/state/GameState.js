import { STARTING_TOKENS, TOKEN_CAPS, MAX_BATTERIES, INVASION_THRESHOLD, INVASION_BASE_COST, STARTING_FACTORIES, STARTING_STOCKPILE, SETUP_PHASE_DURATION } from '../constants.js';
import { COUNTRIES, COUNTRY_MAP, BLOCS, COUNTRY_BLOC } from './countryData.js';

function relKey(a, b) {
  return a < b ? `${a}:${b}` : `${b}:${a}`;
}

class GameState {
  constructor() {
    this.reset();
  }

  reset() {
    this.phase = 'SELECT'; // SELECT | PICK_BLOC | SETUP | PLAYING | GAME_OVER
    this.setupEndsAt = 0;
    this.playerCountryId = null;
    this.playerBlocId = null;

    // Runtime country state keyed by country id
    this.countries = new Map();
    // Runtime bloc state keyed by bloc id — pooled economy + production
    this.blocs = new Map();

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

  initBlocs() {
    this.blocs.clear();
    for (const [blocId, bloc] of Object.entries(BLOCS)) {
      // Scale factory count and token cap with bloc size
      const size = bloc.members.length || 1;
      this.blocs.set(blocId, {
        id: blocId,
        name: bloc.name,
        color: bloc.color,
        tokens: STARTING_TOKENS,
        tokenCap: 150 + size * 30,
        fissile: 0,
        rareEarth: 0,
        factoryCount: Math.max(2, Math.round(size * 0.7)),
        productionQueue: [],
        stockpile: { ...STARTING_STOCKPILE },
      });
    }
  }

  getBloc(countryId) {
    const blocId = COUNTRY_BLOC.get(countryId);
    return blocId ? this.blocs.get(blocId) : null;
  }

  getBlocId(countryId) {
    return COUNTRY_BLOC.get(countryId) || null;
  }

  getBlocCountries(blocId) {
    return [...this.countries.values()].filter(c => COUNTRY_BLOC.get(c.id) === blocId);
  }

  getBlocSilos(blocId) {
    const silos = [];
    // Member countries that haven't been captured away
    for (const c of this.getBlocCountries(blocId)) {
      if (this.isEliminated(c.id) && c.conqueredBy && this.getBlocId(c.conqueredBy) !== blocId) continue;
      for (const s of c.launchSites) silos.push({ site: s, countryId: c.id });
    }
    // Countries conquered *by* this bloc (silos rehomed)
    for (const c of this.countries.values()) {
      if (!this.isEliminated(c.id)) continue;
      if (!c.conqueredBy) continue;
      if (this.getBlocId(c.conqueredBy) !== blocId) continue;
      if (this.getBlocId(c.id) === blocId) continue; // already counted above
      for (const s of c.launchSites) silos.push({ site: s, countryId: c.id });
    }
    return silos;
  }

  isInPlayerBloc(countryId) {
    if (!this.playerBlocId) return false;
    return COUNTRY_BLOC.get(countryId) === this.playerBlocId;
  }

  isBlocEliminated(blocId) {
    const members = this.getBlocCountries(blocId);
    if (members.length === 0) return true;
    return members.every(c => this.isEliminated(c.id));
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
        tokens: STARTING_TOKENS, // legacy per-country (unused once bloc economy lands)
        tokenCap: TOKEN_CAPS[tier],
        fissile: 0,
        rareEarth: 0,
        factoryCount: STARTING_FACTORIES,
        productionQueue: [],
        stockpile: { ...STARTING_STOCKPILE },
        launchSites: def.launchSites.map(coords => ({
          coords,
          disabled: false,
          disabledUntil: 0,
          loadedMissiles: {},
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
    // If the player's chosen country isn't in the given bloc, use the country's actual bloc
    this.playerBlocId = COUNTRY_BLOC.get(playerCountryId) || blocId;
    this.initAllCountries();
    this.initBlocs();
    this.phase = 'SETUP';
    this.elapsed = 0;
    this.setupEndsAt = SETUP_PHASE_DURATION;
  }

  beginWar() {
    if (this.phase !== 'SETUP') return;
    this.phase = 'PLAYING';
    this.addNotification('War has begun.', 'escalation');
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

  // === Alliances (removed — every nation for itself) ===
  // Stubs kept so existing callers don't break; always report no alliances.
  isAllied() { return false; }
  formAlliance() {}
  breakAlliance() {}
  getAllies() { return []; }

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
    return this.getActiveCountries().filter(c => c.role === 'ai' && !this.isInPlayerBloc(c.id));
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
    // Cost scales with the whole bloc's battery count (blocs pool defense)
    const blocId = this.getBlocId(countryId);
    let count = 0;
    if (blocId) {
      for (const b of this.interceptors) {
        if (this.getBlocId(b.countryId) === blocId) count++;
      }
    } else {
      count = this.getBatteryCount(countryId);
    }
    // Linear scaling: 8, 10, 12, 14, 16, 18, 20...
    return 8 + count * 2;
  }

  // === Invasion ===

  // === Bloc capture — replaces per-country invasion ===
  canCaptureBloc(attackerBlocId, targetBlocId) {
    if (attackerBlocId === targetBlocId) return false;
    if (this.isBlocEliminated(targetBlocId)) return false;
    const members = this.getBlocCountries(targetBlocId);
    const alive = members.filter(c => !this.isEliminated(c.id));
    if (alive.length === 0) return false;
    const totalPop = alive.reduce((s, c) => s + c.population, 0);
    const startingPop = members.reduce((s, c) => s + c.startingPopulation, 0);
    if (startingPop === 0) return false;
    return (totalPop / startingPop) < INVASION_THRESHOLD;
  }

  getBlocCaptureCost(attackerBlocId, targetBlocId) {
    const members = this.getBlocCountries(targetBlocId);
    const startingPop = members.reduce((s, c) => s + c.startingPopulation, 0);
    const totalPop = members.filter(c => !this.isEliminated(c.id)).reduce((s, c) => s + c.population, 0);
    if (startingPop === 0) return Infinity;
    const ratio = totalPop / startingPop;
    return Math.ceil(INVASION_BASE_COST * ratio * 6);
  }

  executeBlocCapture(attackerBlocId, targetBlocId) {
    if (this.phase !== 'PLAYING') return false;
    if (!this.canCaptureBloc(attackerBlocId, targetBlocId)) return false;
    const attackerBloc = this.blocs.get(attackerBlocId);
    const cost = this.getBlocCaptureCost(attackerBlocId, targetBlocId);
    if (!attackerBloc || attackerBloc.tokens < cost) return false;

    attackerBloc.tokens -= cost;
    // Attacker's capital country serves as the conquest anchor for coloring
    const attackerCapital = [...this.countries.values()].find(c => COUNTRY_BLOC.get(c.id) === attackerBlocId)?.id;

    for (const member of this.getBlocCountries(targetBlocId)) {
      if (this.isEliminated(member.id)) continue;
      // Absorb population + infra
      const aliveSurvivors = Math.max(0, member.population);
      // Inherit silos operational
      for (const site of member.launchSites) {
        site.disabled = false;
        site.disabledUntil = 0;
      }
      // Convert batteries
      for (const battery of this.interceptors) {
        if (battery.countryId === member.id) {
          battery.cooldownUntil = 0;
        }
      }
      member.conqueredBy = attackerCapital;
      member.population = 0;
      member.cities.forEach(c => { c.population = 0; c.destroyed = true; });
      this.eliminateCountry(member.id);
      void aliveSurvivors;
    }

    this.addNotification(`${this.blocs.get(attackerBlocId)?.name} captured ${this.blocs.get(targetBlocId)?.name}!`, 'elimination');
    return true;
  }

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
    if (this.phase !== 'PLAYING') return false;
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

    const attackerBloc = this.getBloc(attackerId);
    if (!attacker || !attackerBloc || attackerBloc.tokens < cost) return false;

    attackerBloc.tokens -= cost;

    // Absorb territory
    attacker.population += target.population;
    attacker.startingPopulation += target.startingPopulation;

    // Inherit launch sites — fully operational under new management
    for (const site of target.launchSites) {
      attacker.launchSites.push({
        ...site,
        disabled: false,
        disabledUntil: 0,
        loadedMissiles: { ...(site.loadedMissiles || {}) },
      });
    }

    // Inherit batteries — ready to fire immediately
    for (const battery of this.interceptors) {
      if (battery.countryId === targetId) {
        battery.countryId = attackerId;
        battery.role = attacker.role;
        battery.cooldownUntil = 0;
      }
    }

    // Inherit cities
    for (const city of target.cities) {
      attacker.cities.push({ ...city });
    }

    // Eliminate the target; remember who owns the territory now
    target.population = 0;
    target.cities.forEach(c => { c.population = 0; c.destroyed = true; });
    target.conqueredBy = attackerId;
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
