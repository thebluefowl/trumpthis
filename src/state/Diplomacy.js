import { gameState } from './GameState.js';
import { BLOCS, COUNTRY_BLOC } from './countryData.js';
import {
  REL_ALLIED_THRESHOLD,
  REL_ALLIANCE_BREAK,
  REL_ATTACK_PENALTY,
  REL_ATTACK_ALLY_PENALTY,
  REL_ALLIANCE_BONUS,
  REL_BREAK_PENALTY,
  REL_BREAK_ALLY_PENALTY,
  REL_DRIFT_RATE,
  REL_DRIFT_INTERVAL,
  REL_SAME_BLOC_START,
  REL_CROSS_BLOC_START,
  REL_NEUTRAL_START,
} from '../constants.js';
import { events } from './events.js';

// Hostile bloc pairs get the worst starting relationships
const HOSTILE_PAIRS = new Set(['eastern:nato', 'nato:eastern']);

// === Initialize Relationships ===

export function initRelationships(playerBlocId) {
  const countries = [...gameState.countries.keys()];

  for (let i = 0; i < countries.length; i++) {
    for (let j = i + 1; j < countries.length; j++) {
      const a = countries[i];
      const b = countries[j];
      const blocA = getEffectiveBloc(a, playerBlocId);
      const blocB = getEffectiveBloc(b, playerBlocId);

      let startRel = REL_NEUTRAL_START;

      if (blocA && blocB && blocA === blocB) {
        // Same bloc — allies
        startRel = REL_SAME_BLOC_START;
      } else if (blocA && blocB) {
        // Different blocs — hostile
        const pairKey = blocA < blocB ? `${blocA}:${blocB}` : `${blocB}:${blocA}`;
        if (HOSTILE_PAIRS.has(pairKey)) {
          startRel = REL_CROSS_BLOC_START; // -60: NATO vs Eastern are worst enemies
        } else {
          startRel = Math.round(REL_CROSS_BLOC_START * 0.5); // -30: other cross-bloc tension
        }
      }

      gameState.setRelationship(a, b, startRel);

      // Form alliances within same bloc
      if (startRel >= REL_ALLIED_THRESHOLD) {
        gameState.formAlliance(a, b);
      }
    }
  }
}

// Get effective bloc for a country, accounting for player's bloc choice
function getEffectiveBloc(countryId, playerBlocId) {
  if (countryId === gameState.playerCountryId) {
    return playerBlocId === 'solo' ? null : playerBlocId;
  }
  return COUNTRY_BLOC.get(countryId) || null;
}

// === Relationship Shifts ===

export function onAttack(attackerId, targetId) {
  // Direct penalty with target
  gameState.shiftRelationship(attackerId, targetId, REL_ATTACK_PENALTY);

  // Penalty with target's allies
  const targetAllies = gameState.getAllies(targetId);
  for (const allyId of targetAllies) {
    if (allyId === attackerId) continue;
    gameState.shiftRelationship(attackerId, allyId, REL_ATTACK_ALLY_PENALTY);
  }

  // Small bonus with target's enemies (enemy of my enemy)
  for (const [id] of gameState.countries) {
    if (id === attackerId || id === targetId) continue;
    if (gameState.isEliminated(id)) continue;
    const relWithTarget = gameState.getRelationship(id, targetId);
    if (relWithTarget < -30) {
      gameState.shiftRelationship(attackerId, id, 3);
    }
  }

  // Check if alliance should auto-break
  if (gameState.isAllied(attackerId, targetId)) {
    breakAllianceBetween(attackerId, targetId);
  }

  // Check all alliances for auto-break threshold
  checkAllianceBreaks();
}

export function onDefendAlly(defenderId, protectedId) {
  gameState.shiftRelationship(defenderId, protectedId, 10);
}

// === Alliance Management ===

export function proposeAlliance(fromId, toId) {
  if (gameState.isAllied(fromId, toId)) return false;
  if (gameState.isEliminated(fromId) || gameState.isEliminated(toId)) return false;

  const rel = gameState.getRelationship(fromId, toId);
  if (rel < REL_ALLIED_THRESHOLD) return false;

  // Check if there's already a pending proposal
  const existing = gameState.proposals.find(
    p => (p.fromId === fromId && p.toId === toId) ||
         (p.fromId === toId && p.toId === fromId)
  );

  if (existing) {
    // Mutual proposal — accept immediately
    acceptAlliance(fromId, toId);
    gameState.proposals = gameState.proposals.filter(p => p !== existing);
    return true;
  }

  // Create proposal
  gameState.proposals.push({ fromId, toId, timestamp: gameState.elapsed });

  // AI auto-evaluates incoming proposals
  const targetCountry = gameState.countries.get(toId);
  if (targetCountry && targetCountry.role === 'ai') {
    // AI accepts if relationship is high enough
    if (rel >= REL_ALLIED_THRESHOLD + 10) {
      acceptAlliance(fromId, toId);
      gameState.proposals = gameState.proposals.filter(
        p => !(p.fromId === fromId && p.toId === toId)
      );
    }
  } else {
    // Notify player of incoming proposal
    const fromName = gameState.countries.get(fromId)?.name || 'Unknown';
    gameState.addNotification(`${fromName} proposes an alliance!`, 'proposal');
  }

  return true;
}

export function acceptAlliance(a, b) {
  gameState.formAlliance(a, b);
  gameState.shiftRelationship(a, b, REL_ALLIANCE_BONUS);

  const nameA = gameState.countries.get(a)?.name || 'Unknown';
  const nameB = gameState.countries.get(b)?.name || 'Unknown';
  gameState.addNotification(`${nameA} and ${nameB} formed an alliance`, 'alliance');
  events.emit('alliance:formed', { a, b });

  // Remove any proposals between them
  gameState.proposals = gameState.proposals.filter(
    p => !((p.fromId === a && p.toId === b) || (p.fromId === b && p.toId === a))
  );
}

export function breakAllianceBetween(a, b) {
  if (!gameState.isAllied(a, b)) return;

  gameState.breakAlliance(a, b);
  gameState.shiftRelationship(a, b, REL_BREAK_PENALTY);

  // Penalty with their other allies
  const alliesOfA = gameState.getAllies(a);
  for (const allyId of alliesOfA) {
    if (allyId === b) continue;
    gameState.shiftRelationship(b, allyId, REL_BREAK_ALLY_PENALTY);
  }
  const alliesOfB = gameState.getAllies(b);
  for (const allyId of alliesOfB) {
    if (allyId === a) continue;
    gameState.shiftRelationship(a, allyId, REL_BREAK_ALLY_PENALTY);
  }

  const nameA = gameState.countries.get(a)?.name || 'Unknown';
  const nameB = gameState.countries.get(b)?.name || 'Unknown';
  gameState.addNotification(`${nameA} broke alliance with ${nameB}!`, 'betrayal');
  events.emit('alliance:broken', { a, b });
}

function checkAllianceBreaks() {
  for (const key of [...gameState.alliances]) {
    const [a, b] = key.split(':');
    if (gameState.getRelationship(a, b) < REL_ALLIANCE_BREAK) {
      breakAllianceBetween(a, b);
    }
  }
}

// === Drift ===
let lastDriftTime = 0;

export function updateDiplomacy(dt) {
  lastDriftTime += dt;
  if (lastDriftTime < REL_DRIFT_INTERVAL) return;
  lastDriftTime = 0;

  // Allied nations slowly build trust
  for (const key of gameState.alliances) {
    const [a, b] = key.split(':');
    gameState.shiftRelationship(a, b, REL_DRIFT_RATE);
  }

  // Hostile nations slowly normalize (very slow drift toward 0)
  for (const [key, value] of gameState.relationships) {
    if (gameState.alliances.has(key)) continue;
    if (value < -10) {
      gameState.relationships.set(key, value + 0.5);
    } else if (value > 10 && value < REL_ALLIED_THRESHOLD) {
      gameState.relationships.set(key, value - 0.3);
    }
  }

  // Expire old proposals (30 seconds)
  gameState.proposals = gameState.proposals.filter(
    p => gameState.elapsed - p.timestamp < 30
  );
}

export function resetDiplomacy() {
  lastDriftTime = 0;
}
