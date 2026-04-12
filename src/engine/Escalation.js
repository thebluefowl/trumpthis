import { ESCALATION_START, ESCALATION_INTERVAL, ESCALATION_TICKS, MATCH_TIMEOUT, TOKEN_RATES, MISSILE_TYPES } from '../constants.js';
import { gameState } from '../state/GameState.js';
import { events } from '../state/events.js';

let currentTick = 0;
let escalationActive = false;

export function resetEscalation() {
  currentTick = 0;
  escalationActive = false;
}

export function updateEscalation(dt) {
  if (gameState.phase !== 'PLAYING') return;

  const elapsed = gameState.elapsed;

  // Match timeout
  if (elapsed >= MATCH_TIMEOUT) {
    gameState.phase = 'GAME_OVER';
    events.emit('game:over', { result: 'timeout' });
    return;
  }

  // Escalation phase
  if (elapsed >= ESCALATION_START && !escalationActive) {
    escalationActive = true;
    gameState.addNotification('⚠ ESCALATION PHASE BEGUN — the clock is ticking', 'betrayal');
    events.emit('escalation:start');
  }

  if (!escalationActive) return;

  // Check for new ticks
  const ticksShouldBe = Math.min(
    ESCALATION_TICKS,
    Math.floor((elapsed - ESCALATION_START) / ESCALATION_INTERVAL) + 1
  );

  while (currentTick < ticksShouldBe) {
    currentTick++;
    applyEscalationTick(currentTick);
  }
}

function applyEscalationTick(tick) {
  const messages = {
    1: 'TICK 1: Token generation +50%',
    2: 'TICK 2: All blast radii increased 25%',
    3: 'TICK 3: Token generation DOUBLED',
    4: 'TICK 4: Interceptor recharge time doubled',
    5: 'TICK 5: All missile costs HALVED — weapons are cheap',
  };

  gameState.addNotification(`⚠ ${messages[tick]}`, 'betrayal');
  events.emit('escalation:tick', tick);
}

// Multipliers queried by other systems
export function getTokenMultiplier() {
  if (currentTick >= 3) return 2.0;
  if (currentTick >= 1) return 1.5;
  return 1.0;
}

export function getBlastMultiplier() {
  if (currentTick >= 2) return 1.25;
  return 1.0;
}

export function getCooldownMultiplier() {
  if (currentTick >= 4) return 2.0;
  return 1.0;
}

export function getCostMultiplier() {
  if (currentTick >= 5) return 0.5;
  return 1.0;
}

export function getEscalationTick() {
  return currentTick;
}

export function isEscalationActive() {
  return escalationActive;
}

export function getTimeRemaining() {
  return Math.max(0, MATCH_TIMEOUT - gameState.elapsed);
}
