import { TECH_DEFS } from '../state/TechTree.js';
import { gameState } from '../state/GameState.js';
import { events } from '../state/events.js';

// Per-nation research state: countryId → { completed: Set, current: { techId, startTime, duration } | null }
const researchState = new Map();

function getState(countryId) {
  if (!researchState.has(countryId)) {
    researchState.set(countryId, { completed: new Set(), current: null });
  }
  return researchState.get(countryId);
}

export function startResearch(countryId, techId) {
  const tech = TECH_DEFS[techId];
  if (!tech) return false;

  const state = getState(countryId);
  if (state.current) return false; // already researching
  if (state.completed.has(techId)) return false; // already done
  if (tech.requires && !state.completed.has(tech.requires)) return false; // prereq not met

  const country = gameState.countries.get(countryId);
  if (!country || country.tokens < tech.cost) return false;

  country.tokens -= tech.cost;
  state.current = { techId, startTime: gameState.elapsed, duration: tech.time };
  return true;
}

export function updateResearch(dt) {
  if (gameState.phase !== 'PLAYING') return;

  for (const [countryId, state] of researchState) {
    if (!state.current) continue;
    if (gameState.isEliminated(countryId)) { state.current = null; continue; }

    const elapsed = gameState.elapsed - state.current.startTime;
    if (elapsed >= state.current.duration) {
      const techId = state.current.techId;
      state.completed.add(techId);
      state.current = null;

      const country = gameState.countries.get(countryId);
      const tech = TECH_DEFS[techId];
      if (countryId === gameState.playerCountryId) {
        gameState.addNotification(`Research complete: ${tech.name}`, 'alliance');
      }
      events.emit('research:complete', { countryId, techId });
    }
  }
}

export function hasTech(countryId, techId) {
  return getState(countryId).completed.has(techId);
}

export function getCurrentResearch(countryId) {
  const state = getState(countryId);
  if (!state.current) return null;
  const elapsed = gameState.elapsed - state.current.startTime;
  const progress = Math.min(1, elapsed / state.current.duration);
  return { ...state.current, progress, tech: TECH_DEFS[state.current.techId] };
}

export function getCompletedTechs(countryId) {
  return getState(countryId).completed;
}

export function canResearch(countryId, techId) {
  const tech = TECH_DEFS[techId];
  if (!tech) return false;
  const state = getState(countryId);
  if (state.current) return false;
  if (state.completed.has(techId)) return false;
  if (tech.requires && !state.completed.has(tech.requires)) return false;
  return true;
}

// === Effect queries — used by other systems ===

// === OFFENSIVE effects ===
export function getFlightTimeMultiplier(countryId) {
  let mult = 1.0;
  if (hasTech(countryId, 'propulsion_upgrade')) mult *= 0.85;
  if (hasTech(countryId, 'hypersonic_glide')) mult *= 0.65;
  return mult;
}

export function getDamageMultiplier(countryId, typeKey) {
  let mult = 1.0;
  if (hasTech(countryId, 'cluster_munitions') && (typeKey === 'tactical' || typeKey === 'cruise')) mult *= 1.5;
  if (hasTech(countryId, 'extinction_protocol') && typeKey === 'nuke') mult *= 1.3;
  return mult;
}

export function getMIRVWarheads(countryId) {
  return hasTech(countryId, 'mirv_upgrade') ? 6 : 4;
}

export function getEnemyInterceptPenalty(countryId) {
  // Your missiles are harder to intercept
  return hasTech(countryId, 'hypersonic_glide') ? -0.15 : 0;
}

export function getNukeRadiationMultiplier(countryId) {
  return hasTech(countryId, 'extinction_protocol') ? 1.5 : 1.0;
}

// === DEFENSIVE effects ===
export function getInterceptBonus(countryId) {
  let bonus = 0;
  if (hasTech(countryId, 'radar_upgrade')) bonus += 0.10;
  if (hasTech(countryId, 'directed_energy')) bonus += 0.25;
  return bonus;
}

export function getInterceptorCooldownMultiplier(countryId) {
  return hasTech(countryId, 'point_defense') ? 0.7 : 1.0;
}

export function getEMPResistance(countryId) {
  return hasTech(countryId, 'emp_hardening') ? 0.5 : 1.0;
}

export function getLaunchSiteRecoveryMultiplier(countryId) {
  return hasTech(countryId, 'emp_hardening') ? 0.5 : 1.0;
}

export function getInterceptorRangeBonus(countryId) {
  return hasTech(countryId, 'aegis_network') ? 1.2 : 1.0;
}

export function canDefendAllies(countryId) {
  return hasTech(countryId, 'aegis_network');
}

// === INTEL effects ===
export function hasSignalIntel(countryId) {
  return hasTech(countryId, 'sigint');
}

export function getSatelliteScanMultiplier(countryId) {
  return hasTech(countryId, 'satellite_constellation') ? 2.0 : 1.0;
}

export function getEMPRadiusMultiplier(countryId) {
  return hasTech(countryId, 'electronic_warfare') ? 1.25 : 1.0;
}

export function hasCyberOps(countryId) {
  return hasTech(countryId, 'cyber_ops');
}

export function hasTotalAwareness(countryId) {
  return hasTech(countryId, 'total_awareness');
}

// === ECONOMIC effects ===
export function getResourceMultiplier(countryId) {
  return hasTech(countryId, 'resource_extraction') ? 1.25 : 1.0;
}

export function getBuildCostMultiplier(countryId) {
  return hasTech(countryId, 'industrial_base') ? 0.75 : 1.0;
}

export function getSupplyLineCostMultiplier(countryId) {
  return hasTech(countryId, 'logistics_network') ? 0.7 : 1.0;
}

export function getWarEconomyBonus(countryId) {
  return hasTech(countryId, 'wartime_production') ? 1.4 : 1.0;
}

export function getSuperpowerEconomy(countryId) {
  if (!hasTech(countryId, 'superpower_economy')) return { tokenCapBonus: 0, genMultiplier: 1.0 };
  return { tokenCapBonus: 100, genMultiplier: 1.5 };
}

export function resetResearch() {
  researchState.clear();
}
