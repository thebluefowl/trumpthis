import {
  MISSILE_TYPES, DEFAULT_MISSILE_TYPE, LAUNCH_SITE_COOLDOWN,
  AI_LAUNCH_COOLDOWN, AI_COOLDOWN_VARIANCE, AI_WARMUP,
  AI_BATTERY_INTERVAL, INTERCEPTOR_COST, REL_HOSTILE_THRESHOLD, REL_ALLIED_THRESHOLD,
  AI_SURRENDER_THRESHOLD,
} from '../constants.js';
import { gameState } from '../state/GameState.js';
import { createInterpolator, geoDistance } from '../rendering/Projection.js';
import { placeBattery } from '../engine/InterceptorSystem.js';
import { getOwnedResources } from '../engine/ResourceSystem.js';
import { getFlightTimeMultiplier, getSupplyLineCostMultiplier, getEnemyInterceptPenalty, getNukeRadiationMultiplier, getBuildCostMultiplier, startResearch, getCurrentResearch, canResearch } from '../engine/ResearchSystem.js';
import { TECH_DEFS } from '../state/TechTree.js';
import { getPersonality } from './Personalities.js';
import { proposeAlliance, breakAllianceBetween } from '../state/Diplomacy.js';
import { events } from '../state/events.js';

// Per-nation AI state
const aiState = new Map();

export function resetAIManager() {
  aiState.clear();
}

function getAIState(countryId) {
  if (!aiState.has(countryId)) {
    aiState.set(countryId, {
      attackCooldown: 5000 + Math.random() * 10000, // first attack in 5-15s
      timeSinceAttack: 0,
      batteryCooldown: AI_BATTERY_INTERVAL * (0.5 + Math.random()),
      timeSinceBattery: 0,
      diplomacyCooldown: 10000 + Math.random() * 10000,
      timeSinceDiplomacy: 0,
      researchCooldown: 15000 + Math.random() * 20000,
      timeSinceResearch: 0,
    });
  }
  return aiState.get(countryId);
}

let _aiDebugLogged = false;
export function updateAIManager(dt) {
  if (gameState.phase !== 'PLAYING') return;
  if (gameState._madActive) return;

  const aiNations = gameState.getActiveAI();
  if (!_aiDebugLogged && gameState.elapsed > 2) {
    console.log(`[AI] ${aiNations.length} AI nations active. Elapsed: ${gameState.elapsed.toFixed(1)}s`);
    if (aiNations.length > 0) {
      const sample = aiNations[0];
      const state = getAIState(sample.id);
      console.log(`[AI] ${sample.name}: tokens=${sample.tokens.toFixed(1)}, cooldown=${state.attackCooldown}, timer=${state.timeSinceAttack.toFixed(0)}`);
    }
    _aiDebugLogged = true;
  }

  for (const country of aiNations) {
    updateNationAI(country, dt);
  }
}

function updateNationAI(country, dt) {
  const state = getAIState(country.id);

  // Check for surrender
  const popRatio = country.population / country.startingPopulation;
  if (popRatio < AI_SURRENDER_THRESHOLD) {
    gameState.eliminateCountry(country.id);
    gameState.addNotification(`${country.name} has surrendered!`, 'info');
    events.emit('country:destroyed', country);
    return;
  }

  // === Attack logic ===
  const personality = getPersonality(country.id);
  state.timeSinceAttack += dt * 1000;
  if (gameState.elapsed >= AI_WARMUP && state.timeSinceAttack >= state.attackCooldown && country.tokens >= 3) {
    const target = pickTarget(country);
    if (target) {
      launchAtTarget(country, target);
      state.timeSinceAttack = 0;
      const variance = 1 - AI_COOLDOWN_VARIANCE / 2 + Math.random() * AI_COOLDOWN_VARIANCE;
      state.attackCooldown = AI_LAUNCH_COOLDOWN * variance / personality.attackBias;
    }
  }

  // === Battery placement (personality affects frequency) ===
  state.timeSinceBattery += dt * 1000;
  if (state.timeSinceBattery >= state.batteryCooldown / personality.defenseBias) {
    tryPlaceBattery(country);
    state.timeSinceBattery = 0;
  }

  // === Research ===
  state.timeSinceResearch += dt * 1000;
  if (state.timeSinceResearch >= state.researchCooldown) {
    tryResearch(country);
    state.timeSinceResearch = 0;
    state.researchCooldown = 20000 + Math.random() * 20000;
  }

  // === Diplomacy ===
  state.timeSinceDiplomacy += dt * 1000;
  if (state.timeSinceDiplomacy >= state.diplomacyCooldown) {
    evaluateDiplomacy(country);
    state.timeSinceDiplomacy = 0;
    state.diplomacyCooldown = 15000 + Math.random() * 15000;
  }
}

function pickTarget(country) {
  let bestTarget = null;
  let bestScore = -Infinity;

  const personality = getPersonality(country.id);
  const myAllies = new Set(gameState.getAllies(country.id));

  // What are my allies attacking? I should pile on.
  const allyTargets = new Map(); // countryId → count of allies attacking
  for (const missile of gameState.missiles) {
    if (myAllies.has(missile.fromCountryId) && missile.toCountryId) {
      allyTargets.set(missile.toCountryId, (allyTargets.get(missile.toCountryId) || 0) + 1);
    }
  }

  for (const other of gameState.getActiveCountries()) {
    if (other.id === country.id) continue;
    if (gameState.isAllied(country.id, other.id)) continue;

    const rel = gameState.getRelationship(country.id, other.id);
    if (rel > 20) continue; // don't attack friendlies

    const popRatio = other.population / other.startingPopulation;
    const dist = geoDistance(country.centroid, other.centroid);

    let score = 0;

    // === Hostility (0-100 points) ===
    // Lower relationship = higher score
    score += Math.max(0, -rel); // 0 to 100

    // === Proximity bonus (0-40 points) ===
    // Closer targets are cheaper to hit and arrive faster
    const proximityBonus = Math.max(0, 40 - dist * 25);
    score += proximityBonus;

    // === Weakness bonus — opportunists love weak targets ===
    const weaknessWeight = personality.targetWeakest ? 2.0 : 1.0;
    if (popRatio < 0.3) score += 50 * weaknessWeight;
    else if (popRatio < 0.5) score += 30 * weaknessWeight;
    else if (popRatio < 0.7) score += 10 * weaknessWeight;

    // Rogue nations add randomness to targeting
    if (personality.name === 'Rogue') score += Math.random() * 40;

    // === Alliance coordination (0-30 points) ===
    // Pile on whoever allies are already attacking
    const allyAttacking = allyTargets.get(other.id) || 0;
    score += allyAttacking * 15; // +15 per ally missile already in flight

    // === Defense weakness (0-25 points) ===
    // Prefer targets with fewer interceptors
    const batteries = gameState.getBatteryCount(other.id);
    if (batteries === 0) score += 25;      // undefended — free kill
    else if (batteries <= 2) score += 10;  // lightly defended

    // === Threat level (0-20 points) ===
    // Strong nations are threats — but don't prioritize over easy kills
    score += popRatio * 20;

    // === Resource control (0-15 points) ===
    // Target nations holding valuable resources
    const ownedResources = getOwnedResources(other.id);
    score += ownedResources.length * 5;

    // === Avoid over-targeting (penalty) ===
    // Don't pile too many missiles on one target
    const myMissilesAtTarget = gameState.missiles.filter(
      m => m.fromCountryId === country.id && m.toCountryId === other.id
    ).length;
    score -= myMissilesAtTarget * 20; // heavy penalty for already attacking this target

    if (score > bestScore) {
      bestScore = score;
      bestTarget = other;
    }
  }

  return bestTarget;
}

function pickMissileType(country, target) {
  const elapsed = gameState.elapsed;
  const personality = getPersonality(country.id);

  // Filter to affordable + unlocked types
  const available = Object.entries(MISSILE_TYPES)
    .filter(([, t]) => t.cost <= country.tokens && (t.unlockAt === undefined || elapsed >= t.unlockAt))
    .map(([typeId, t]) => ({ typeId, ...t }));
  if (available.length === 0) return null;

  // Evaluate target's defense
  const targetBatteries = target ? gameState.getBatteryCount(target.id) : 0;
  const targetPopRatio = target ? target.population / target.startingPopulation : 1;

  // Assign weights based on situation
  const weights = {};
  for (const t of available) {
    const id = t.typeId;
    let w = 1;

    if (id === 'drone') w = 2;
    if (id === 'tactical') w = 3;
    if (id === 'cruise') w = 4;
    if (id === 'icbm') w = 5;

    if (id === 'emp' && targetBatteries >= 2) w = 8;
    else if (id === 'emp') w = 1;

    if (id === 'decoy' && targetBatteries >= 2) w = 6;
    else if (id === 'decoy') w = 1;

    if (id === 'dirty_bomb' && targetPopRatio < 0.5) w = 6;
    else if (id === 'dirty_bomb') w = 2;

    if (id === 'mirv') w = 3;
    if (id === 'slbm') w = 3;

    if (id === 'hypersonic' && targetBatteries >= 2) w = 7;
    else if (id === 'hypersonic') w = 3;

    if (id === 'nuke') {
      if (country.tokens > 120 && targetPopRatio > 0.4) w = 4 * personality.nukeBias;
      else w = 0;
    }

    // Personality preferred weapons get a boost
    if (personality.preferredWeapons.includes(id)) w *= 1.8;

    weights[id] = w;
  }

  // Weighted random selection
  const totalWeight = available.reduce((s, t) => s + (weights[t.typeId] || 1), 0);
  let r = Math.random() * totalWeight;
  for (const t of available) {
    r -= weights[t.typeId] || 1;
    if (r <= 0) return t.typeId;
  }
  return available[0].typeId;
}

function launchAtTarget(fromCountry, toCountry) {
  // Re-enable sites whose cooldown expired
  for (const site of fromCountry.launchSites) {
    if (site.disabled && gameState.elapsed >= (site.disabledUntil || 0)) {
      site.disabled = false;
    }
  }
  const activeSites = fromCountry.launchSites.filter(s => !s.disabled);
  if (activeSites.length === 0) {
    console.log(`[AI] ${fromCountry.name} has no active launch sites`);
    return;
  }

  const typeKey = pickMissileType(fromCountry, toCountry);
  if (!typeKey) { console.log(`[AI] ${fromCountry.name} pickMissileType returned null`); return; }
  const mtype = MISSILE_TYPES[typeKey];
  if (!mtype) { console.log(`[AI] ${fromCountry.name} invalid mtype for ${typeKey}`); return; }

  const launchSite = activeSites[Math.floor(Math.random() * activeSites.length)];

  // Strategic target selection — accuracy degrades with distance
  const target = pickStrategicTarget(toCountry, typeKey, fromCountry);
  if (!target) {
    console.log(`[AI] ${fromCountry.name} no valid target point for ${typeKey} against ${toCountry.name}. Cities:`, toCountry.cities?.length, 'centroid:', toCountry.centroid);
    return;
  }

  const cost = getEffectiveCost(fromCountry.id, typeKey, launchSite.coords, target);
  if (fromCountry.tokens < cost) {
    console.log(`[AI] ${fromCountry.name} can't afford ${typeKey}: need ${cost}, have ${fromCountry.tokens.toFixed(0)}`);
    return;
  }

  createMissile(fromCountry.id, toCountry.id, launchSite.coords, target, typeKey, false);
  fromCountry.tokens -= cost;
  fromCountry.combatStats.missilesLaunched++;

  if (fromCountry.id === gameState.playerCountryId) {
    gameState.stats.playerLaunched++;
  }
}

function pickStrategicTarget(targetCountry, typeKey, fromCountry) {
  // Distance-based intelligence degradation
  // Nearby: full intel (cities, batteries, launch sites)
  // Mid-range: cities only
  // Distant: centroid only
  const dist = fromCountry ? geoDistance(fromCountry.centroid, targetCountry.centroid) : 0;
  const isSLBM = typeKey === 'slbm'; // subs bypass distance penalty

  const CLOSE_RANGE = 0.4;   // ~2,500 km — same continent
  const MID_RANGE = 1.0;     // ~6,400 km — cross-continental

  const hasDetailedIntel = isSLBM || dist < CLOSE_RANGE;
  const hasCityIntel = isSLBM || dist < MID_RANGE;

  // Distant targets — can only hit centroid
  if (!hasCityIntel) {
    // Add some random scatter around centroid (imprecise targeting)
    const scatter = 2 + Math.random() * 3;
    const angle = Math.random() * Math.PI * 2;
    return [
      targetCountry.centroid[0] + Math.cos(angle) * scatter,
      targetCountry.centroid[1] + Math.sin(angle) * scatter,
    ];
  }

  const liveCities = targetCountry.cities.filter(c => !c.destroyed && c.population > 0);

  // Mid-range — can target cities but not infrastructure
  const batteries = hasDetailedIntel
    ? gameState.interceptors.filter(b => b.countryId === targetCountry.id)
    : [];
  const activeSites = hasDetailedIntel
    ? targetCountry.launchSites.filter(s => !s.disabled)
    : [];
  const isHeavilyDefended = batteries.length >= 3;

  // === EMP: always target interceptor clusters ===
  if (typeKey === 'emp') {
    if (batteries.length > 0) {
      return batteries[Math.floor(Math.random() * batteries.length)].position;
    }
    return targetCountry.centroid;
  }

  // === Dirty bomb: target dense city clusters ===
  if (typeKey === 'dirty_bomb') {
    if (liveCities.length > 0) {
      // Pick the city with the most nearby cities (contamination hits multiple)
      let bestCity = liveCities[0];
      let bestNeighbors = 0;
      for (const city of liveCities) {
        const neighbors = liveCities.filter(c => c !== city &&
          Math.abs(c.coords[0] - city.coords[0]) < 3 &&
          Math.abs(c.coords[1] - city.coords[1]) < 3
        ).length;
        if (neighbors > bestNeighbors) {
          bestNeighbors = neighbors;
          bestCity = city;
        }
      }
      return bestCity.coords;
    }
    return targetCountry.centroid;
  }

  // === Drone: always target infrastructure ===
  if (typeKey === 'drone') {
    const infraTargets = [
      ...activeSites.map(s => s.coords),
      ...batteries.map(b => b.position),
    ];
    if (infraTargets.length > 0) {
      return infraTargets[Math.floor(Math.random() * infraTargets.length)];
    }
    return targetCountry.centroid;
  }

  // === MIRV / Nuke: target the largest city ===
  if (typeKey === 'mirv' || typeKey === 'nuke') {
    if (liveCities.length > 0) {
      const biggest = liveCities.reduce((a, b) => a.population > b.population ? a : b);
      return biggest.coords;
    }
    return targetCountry.centroid;
  }

  // === Hypersonic: target high-value defended cities (bypasses defense) ===
  if (typeKey === 'hypersonic') {
    if (liveCities.length > 0) {
      const biggest = liveCities.reduce((a, b) => a.population > b.population ? a : b);
      return biggest.coords;
    }
    return targetCountry.centroid;
  }

  // === General strategy ===
  const roll = Math.random();

  // If heavily defended, 50% chance to counter-force first
  if (isHeavilyDefended && roll < 0.5) {
    const militaryTargets = [
      ...activeSites.map(s => s.coords),
      ...batteries.map(b => b.position),
    ];
    if (militaryTargets.length > 0) {
      return militaryTargets[Math.floor(Math.random() * militaryTargets.length)];
    }
  }

  // Otherwise: target cities, weighted by population
  if (liveCities.length > 0) {
    const totalPop = liveCities.reduce((s, c) => s + c.population, 0);
    let r = Math.random() * totalPop;
    for (const city of liveCities) {
      r -= city.population;
      if (r <= 0) return city.coords;
    }
    return liveCities[0].coords;
  }

  return targetCountry.centroid;
}

function tryResearch(country) {
  if (getCurrentResearch(country.id)) return;

  // AI research priorities by tier — follows the tech tree naturally
  const priorities = country.tier === 1
    ? [ // Superpowers: offense + economy first
      'propulsion_upgrade', 'resource_extraction', 'radar_upgrade', 'sigint',
      'cluster_munitions', 'industrial_base', 'point_defense', 'satellite_constellation',
      'mirv_upgrade', 'logistics_network', 'emp_hardening', 'electronic_warfare',
      'hypersonic_glide', 'wartime_production', 'directed_energy', 'cyber_ops',
      'extinction_protocol', 'superpower_economy', 'aegis_network', 'total_awareness',
    ]
    : country.tier === 2
    ? [ // Major powers: balanced
      'radar_upgrade', 'resource_extraction', 'propulsion_upgrade', 'sigint',
      'point_defense', 'industrial_base', 'cluster_munitions', 'satellite_constellation',
      'emp_hardening', 'logistics_network', 'mirv_upgrade', 'electronic_warfare',
      'directed_energy', 'wartime_production', 'hypersonic_glide', 'cyber_ops',
      'aegis_network', 'superpower_economy', 'extinction_protocol', 'total_awareness',
    ]
    : [ // Regional: defense + economy first
      'resource_extraction', 'radar_upgrade', 'sigint', 'propulsion_upgrade',
      'industrial_base', 'point_defense', 'satellite_constellation', 'cluster_munitions',
      'logistics_network', 'emp_hardening', 'electronic_warfare', 'mirv_upgrade',
      'wartime_production', 'directed_energy', 'cyber_ops', 'hypersonic_glide',
      'superpower_economy', 'aegis_network', 'total_awareness', 'extinction_protocol',
    ];

  for (const techId of priorities) {
    if (canResearch(country.id, techId)) {
      const tech = TECH_DEFS[techId];
      if (country.tokens >= tech.cost * 1.5) {
        startResearch(country.id, techId);
        return;
      }
    }
  }
}

function tryPlaceBattery(country) {
  if (!gameState.canPlaceBattery(country.id)) return;
  if (country.tokens < INTERCEPTOR_COST) return;

  const positions = [
    country.centroid,
    ...country.launchSites.map(s => s.coords),
  ];
  const basePos = positions[Math.floor(Math.random() * positions.length)];
  const offset = [
    basePos[0] + (Math.random() - 0.5) * 4,
    basePos[1] + (Math.random() - 0.5) * 4,
  ];

  placeBattery(country.id, offset, 'ai');
}

function evaluateDiplomacy(country) {
  const allies = gameState.getAllies(country.id);

  const personality = getPersonality(country.id);

  // Consider breaking weak alliances — personality affects threshold
  for (const allyId of allies) {
    const rel = gameState.getRelationship(country.id, allyId);
    const allyCountry = gameState.countries.get(allyId);
    if (!allyCountry) continue;

    const allyStrength = allyCountry.population / allyCountry.startingPopulation;
    if (allyStrength < 0.3 && rel < personality.betrayalThreshold) {
      breakAllianceBetween(country.id, allyId);
      return;
    }
  }

  // Consider invading weakened nations — personality affects eagerness
  for (const other of gameState.getActiveCountries()) {
    if (other.id === country.id) continue;
    if (gameState.canInvade(country.id, other.id)) {
      const cost = gameState.getInvasionCost(country.id, other.id);
      const affordThreshold = 1.5 / personality.invasionBias; // aggressive invaders need less margin
      if (country.tokens >= cost * affordThreshold) {
        gameState.executeInvasion(country.id, other.id);
        gameState.addNotification(`${country.name} has invaded ${other.name}!`, 'elimination');
        return;
      }
    }
  }

  // Consider proposing alliance — diplomatic nations seek alliances at lower thresholds
  const allianceThreshold = REL_ALLIED_THRESHOLD + Math.round(20 / personality.diplomacyBias);
  for (const other of gameState.getActiveCountries()) {
    if (other.id === country.id) continue;
    if (gameState.isAllied(country.id, other.id)) continue;

    const rel = gameState.getRelationship(country.id, other.id);
    if (rel >= allianceThreshold) {
      proposeAlliance(country.id, other.id);
      return;
    }
  }
}

// Supply line cost: missiles cost more the further they travel
const SUPPLY_COST_FACTOR = 0.3; // +30% cost per radian of distance

export function getEffectiveCost(fromId, typeKey, origin, target) {
  const mtype = MISSILE_TYPES[typeKey] || MISSILE_TYPES.icbm;
  const dist = geoDistance(origin, target) || 0.01;
  const supplyMult = getSupplyLineCostMultiplier(fromId);
  const distCost = mtype.cost * SUPPLY_COST_FACTOR * dist * supplyMult;
  return Math.ceil(mtype.cost + distCost);
}

// Shared missile creation
export function createMissile(fromId, toId, origin, target, typeKey, isPlayer) {
  const mtype = MISSILE_TYPES[typeKey];
  if (!mtype) {
    // Fallback to ICBM if type is invalid
    return createMissile(fromId, toId, origin, target, 'icbm', isPlayer);
  }
  const dist = geoDistance(origin, target) || 0.01;
  const flightMult = getFlightTimeMultiplier(fromId);
  const flightTime = (mtype.baseFlight + dist * mtype.distFactor) * flightMult;

  const missile = {
    id: crypto.randomUUID(),
    fromCountryId: fromId,
    toCountryId: toId,
    origin,
    target,
    progress: 0,
    speed: 1 / flightTime,
    interpolator: createInterpolator(origin, target),
    arcHeight: 0.25 + Math.random() * 0.1,
    isPlayer,
    launched: gameState.elapsed,
    type: typeKey,
    mtype,
    split: false, // for MIRV tracking
  };

  gameState.missiles.push(missile);
  console.log(`[MISSILE CREATED] ${typeKey} from ${fromId} to ${toId}, missiles array now: ${gameState.missiles.length}`);

  // Put the launch site on cooldown
  const fromCountry = gameState.countries.get(fromId);
  if (fromCountry) {
    for (const site of fromCountry.launchSites) {
      if (site.coords[0] === origin[0] && site.coords[1] === origin[1]) {
        const cooldown = mtype.siteCooldown || LAUNCH_SITE_COOLDOWN;
        site.disabledUntil = Math.max(site.disabledUntil || 0, gameState.elapsed + cooldown);
        site.disabled = true;
        break;
      }
    }
  }

  return missile;
}

// Player's selected missile type
let playerMissileType = DEFAULT_MISSILE_TYPE;

export function setPlayerMissileType(typeKey) {
  if (MISSILE_TYPES[typeKey]) playerMissileType = typeKey;
}

export function getPlayerMissileType() {
  return playerMissileType;
}

// Exported for player use
export function playerLaunchMissile(origin, target, targetCountryId) {
  if (gameState.phase !== 'PLAYING') return false;
  const player = gameState.getPlayer();
  if (!player) return false;

  // Find the silo at `origin` and verify it has this missile type loaded
  const silo = player.launchSites.find(s =>
    s.coords[0] === origin[0] && s.coords[1] === origin[1]
  );
  if (!silo) return false;
  if (!silo.loadedMissiles || !silo.loadedMissiles[playerMissileType]) return false;

  if (!targetCountryId) {
    let bestDist = Infinity;
    for (const [id, country] of gameState.countries) {
      if (id === player.id) continue;
      if (gameState.isEliminated(id)) continue;
      const dx = target[0] - country.centroid[0];
      const dy = target[1] - country.centroid[1];
      const dist = dx * dx + dy * dy;
      if (dist < bestDist) {
        bestDist = dist;
        targetCountryId = id;
      }
    }
  }

  createMissile(player.id, targetCountryId, origin, target, playerMissileType, true);
  silo.loadedMissiles[playerMissileType] -= 1;
  if (silo.loadedMissiles[playerMissileType] <= 0) delete silo.loadedMissiles[playerMissileType];
  player.combatStats.missilesLaunched++;
  gameState.stats.playerLaunched++;
  return true;
}
