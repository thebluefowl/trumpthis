import { gameState } from '../state/GameState.js';
import { events } from '../state/events.js';

// Track claim windows: { countryId, killerId, expiresAt, claimed }
const claimWindows = [];
const CLAIM_DURATION = 30; // seconds
const PRIORITY_DURATION = 10; // killer gets first 10 seconds

export function updateConquest(dt) {
  if (gameState.phase !== 'PLAYING') return;

  // Process expired claim windows
  for (let i = claimWindows.length - 1; i >= 0; i--) {
    const claim = claimWindows[i];
    if (claim.claimed) {
      claimWindows.splice(i, 1);
      continue;
    }
    if (gameState.elapsed >= claim.expiresAt) {
      // Nobody claimed — territory becomes wasteland
      gameState.addNotification(`${claim.countryName} territory became neutral wasteland`, 'info');
      claimWindows.splice(i, 1);
    }
  }

  // Auto-claim for AI — wait 5 seconds before AI claims (give player time to react)
  for (const claim of claimWindows) {
    if (claim.claimed) continue;
    const age = gameState.elapsed - (claim.expiresAt - CLAIM_DURATION);
    if (age < 5) continue; // grace period for player

    const inPriority = gameState.elapsed < claim.expiresAt - (CLAIM_DURATION - PRIORITY_DURATION);
    if (inPriority) {
      // Priority window — only killer can claim
      if (claim.killerId && !gameState.isEliminated(claim.killerId)) {
        const killer = gameState.countries.get(claim.killerId);
        if (killer && killer.role === 'ai') {
          executeClaim(claim.killerId, claim.countryId);
          claim.claimed = true;
        }
      }
    } else {
      // Open window — any AI can claim
      for (const country of gameState.getActiveAI()) {
        if (!claim.claimed) {
          executeClaim(country.id, claim.countryId);
          claim.claimed = true;
        }
      }
    }
  }
}

export function openClaimWindow(eliminatedId, killerId) {
  const eliminated = gameState.countries.get(eliminatedId);
  claimWindows.push({
    countryId: eliminatedId,
    countryName: eliminated?.name || 'Unknown',
    killerId,
    expiresAt: gameState.elapsed + CLAIM_DURATION,
    claimed: false,
  });

  gameState.addNotification(`${eliminated?.name} territory open for conquest! (${CLAIM_DURATION}s)`, 'elimination');
}

export function playerClaimTerritory(eliminatedId) {
  const claim = claimWindows.find(c => c.countryId === eliminatedId && !c.claimed);
  if (!claim) return false;

  // Check priority window
  const inPriority = gameState.elapsed < claim.expiresAt - (CLAIM_DURATION - PRIORITY_DURATION);
  if (inPriority && claim.killerId !== gameState.playerCountryId) return false;

  executeClaim(gameState.playerCountryId, eliminatedId);
  claim.claimed = true;
  return true;
}

function executeClaim(claimerId, eliminatedId) {
  const claimer = gameState.countries.get(claimerId);
  const eliminated = gameState.countries.get(eliminatedId);
  if (!claimer || !eliminated) return;

  // Inherit surviving population (adds to token generation)
  const remainingPop = Math.max(0, eliminated.population);
  claimer.population += remainingPop;
  claimer.startingPopulation += eliminated.startingPopulation;

  // Inherit operational launch sites
  for (const site of eliminated.launchSites) {
    if (!site.disabled) {
      claimer.launchSites.push({ ...site });
    }
  }

  // Inherit interceptor batteries
  const batteries = gameState.interceptors.filter(b => b.countryId === eliminatedId);
  for (const battery of batteries) {
    battery.countryId = claimerId;
    battery.role = claimer.role;
  }

  const claimerName = claimer.name;
  const elimName = eliminated.name;
  gameState.addNotification(`${claimerName} conquered ${elimName}'s territory!`, 'elimination');
  events.emit('territory:claimed', { claimerId, eliminatedId });
}

export function getClaimWindows() {
  return claimWindows.filter(c => !c.claimed);
}

export function resetConquest() {
  claimWindows.length = 0;
}
