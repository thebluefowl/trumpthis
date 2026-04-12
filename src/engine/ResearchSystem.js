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

export function getFlightTimeMultiplier(countryId) {
  if (hasTech(countryId, 'hypersonic')) return 0.6;
  if (hasTech(countryId, 'faster_missiles')) return 0.8;
  return 1.0;
}

export function getInterceptBonus(countryId) {
  if (hasTech(countryId, 'laser_defense')) return 0.30; // sets auto to ~90%
  if (hasTech(countryId, 'better_intercept')) return 0.15;
  return 0;
}

export function getMIRVWarheads(countryId) {
  return hasTech(countryId, 'mirv_upgrade') ? 6 : 4;
}

export function getEMPResistance(countryId) {
  return hasTech(countryId, 'emp_shield') ? 0.5 : 1.0; // half disable time
}

export function getResourceMultiplier(countryId) {
  return hasTech(countryId, 'efficient_mining') ? 1.25 : 1.0;
}

export function getWarEconomyBonus(countryId) {
  return hasTech(countryId, 'war_economy') ? 1.5 : 1.0;
}

export function resetResearch() {
  researchState.clear();
}
