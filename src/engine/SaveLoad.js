import { gameState } from '../state/GameState.js';
import { showToast } from '../ui/Toast.js';

const SAVE_KEY = 'deadhand_save';
const AUTO_SAVE_INTERVAL = 30000; // 30 seconds

let autoSaveTimer = null;

export function saveGame() {
  try {
    const data = {
      version: 1,
      timestamp: Date.now(),
      elapsed: gameState.elapsed,
      phase: gameState.phase,
      playerCountryId: gameState.playerCountryId,
      playerBlocId: gameState.playerBlocId,
      nuclearWinterLevel: gameState.nuclearWinterLevel,

      // Country state
      countries: [...gameState.countries.entries()].map(([id, c]) => ({
        id,
        population: c.population,
        startingPopulation: c.startingPopulation,
        tokens: c.tokens,
        tokenCap: c.tokenCap,
        cities: c.cities,
        launchSites: c.launchSites,
        combatStats: c.combatStats,
        role: c.role,
      })),

      // Diplomacy
      relationships: [...gameState.relationships.entries()],
      alliances: [...gameState.alliances],
      eliminated: [...gameState.eliminated],

      // Stats
      stats: gameState.stats,
    };

    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    return true;
  } catch (e) {
    console.error('Save failed:', e);
    return false;
  }
}

export function loadGame() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return false;

    const data = JSON.parse(raw);
    if (data.version !== 1) return false;

    return data;
  } catch (e) {
    console.error('Load failed:', e);
    return false;
  }
}

export function hasSave() {
  return !!localStorage.getItem(SAVE_KEY);
}

export function deleteSave() {
  localStorage.removeItem(SAVE_KEY);
}

export function startAutoSave() {
  stopAutoSave();
  autoSaveTimer = setInterval(() => {
    if (gameState.phase === 'PLAYING') {
      saveGame();
    }
  }, AUTO_SAVE_INTERVAL);
}

export function stopAutoSave() {
  if (autoSaveTimer) {
    clearInterval(autoSaveTimer);
    autoSaveTimer = null;
  }
}
