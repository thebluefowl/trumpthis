import { gameState } from '../state/GameState.js';
import { updateTokens } from './TokenEconomy.js';
import { updateMissiles, cleanupExpired } from './MissileSimulator.js';
import { updateInterceptors } from './InterceptorSystem.js';
import { processImpacts } from './DamageModel.js';
import { renderCanvas } from '../rendering/CanvasOverlay.js';
import { renderHUD } from '../rendering/HUD.js';
import { renderSidebar } from '../ui/Sidebar.js';
import { setMusicPhase } from '../audio/Music.js';
import { isEscalationActive } from './Escalation.js';
import { updateNewsTicker } from '../ui/NewsTicker.js';
import { updateAIManager } from '../ai/AIManager.js';
import { updateDiplomacy } from '../state/Diplomacy.js';
import { updateEscalation } from './Escalation.js';
import { updateResources } from './ResourceSystem.js';
import { updateResearch } from './ResearchSystem.js';
import { updateSatellite, cleanupIntel, updateFog, updateSatLaunches } from '../state/Intel.js';
import { updateConquest, openClaimWindow } from './Conquest.js';
import { events } from '../state/events.js';
import { ECONOMIC_VICTORY_TOKENS, DIPLOMATIC_VICTORY_PERCENT } from '../constants.js';

let lastTime = 0;
let running = false;

export function startGameLoop() {
  lastTime = performance.now();
  running = true;
  requestAnimationFrame(tick);
}

export function stopGameLoop() {
  running = false;
}

function tick(currentTime) {
  if (!running) return;

  let dt = (currentTime - lastTime) / 1000;
  lastTime = currentTime;
  dt = Math.min(dt, 0.1);

  if (!gameState.paused && gameState.phase === 'PLAYING') {
    gameState.elapsed += dt;

    updateTokens(dt);
    updateResources(dt);
    updateResearch(dt);
    updateSatellite(dt);
    updateSatLaunches();
    updateFog();
    cleanupIntel();
    updateDiplomacy(dt);
    updateEscalation(dt);
    updateAIManager(dt);
    updateInterceptors(dt);
    updateMissiles(dt);
    processImpacts();
    updateConquest(dt);
    cleanupExpired();
    checkGameOver();

    // Dynamic music phase
    if (gameState.nuclearWinterLevel > 0) setMusicPhase('war');
    else if (isEscalationActive()) setMusicPhase('war');
    else if (gameState.missiles.length > 15) setMusicPhase('war');
    else if (gameState.missiles.length > 3) setMusicPhase('tension');
  }

  renderCanvas(dt);
  renderHUD();
  renderSidebar();
  updateNewsTicker();

  requestAnimationFrame(tick);
}

function checkGameOver() {
  // MAD protocol
  if (gameState._madActive) {
    const globalPop = [...gameState.countries.values()].reduce((s, c) => s + c.population, 0);
    if (globalPop <= 0) {
      gameState.phase = 'GAME_OVER';
      gameState._madActive = false;
      events.emit('game:over', { result: 'extinction' });
    }
    return;
  }

  const player = gameState.getPlayer();
  if (!player) return;

  // Player eliminated
  if (player.population <= 0 || gameState.isEliminated(player.id)) {
    gameState.phase = 'GAME_OVER';
    events.emit('game:over', { result: 'defeat' });
    return;
  }

  const activeNations = gameState.getActiveCountries();
  const playerAllies = gameState.getAllies(player.id);
  const playerSide = new Set([player.id, ...playerAllies]);
  const enemies = activeNations.filter(c => !playerSide.has(c.id));

  // === MILITARY VICTORY — all enemies eliminated ===
  if (enemies.length === 0) {
    gameState.phase = 'GAME_OVER';
    events.emit('game:over', { result: 'military_victory' });
    return;
  }

  // === ECONOMIC VICTORY — accumulate enough tokens ===
  if (player.tokens >= ECONOMIC_VICTORY_TOKENS) {
    gameState.phase = 'GAME_OVER';
    events.emit('game:over', { result: 'economic_victory' });
    return;
  }

  // === DIPLOMATIC VICTORY — ally with 60%+ of surviving nations ===
  const allyCount = playerAllies.filter(id => !gameState.isEliminated(id)).length;
  const totalActive = activeNations.length;
  if (totalActive > 2 && allyCount / (totalActive - 1) >= DIPLOMATIC_VICTORY_PERCENT) {
    gameState.phase = 'GAME_OVER';
    events.emit('game:over', { result: 'diplomatic_victory' });
    return;
  }
}
