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
import { updateProduction } from './ProductionSystem.js';
import { updateResearch } from './ResearchSystem.js';
import { updateSatellite, cleanupIntel, updateFog, updateSatLaunches } from '../state/Intel.js';
import { updateConquest, openClaimWindow } from './Conquest.js';
import { events } from '../state/events.js';
import { ECONOMIC_VICTORY_TOKENS, DIPLOMATIC_VICTORY_PERCENT, SETUP_TIME_MULT } from '../constants.js';

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

  if (!gameState.paused && gameState.phase === 'SETUP') {
    gameState.elapsed += dt;
    const boosted = dt * SETUP_TIME_MULT;
    updateTokens(boosted);
    updateResources(boosted);
    updateProduction(boosted);
    updateResearch(boosted);
    updateSatellite(boosted);
    updateSatLaunches();
    updateFog();
    cleanupIntel();
    if (gameState.elapsed >= gameState.setupEndsAt) {
      gameState.beginWar();
    }
  }

  if (!gameState.paused && gameState.phase === 'PLAYING') {
    gameState.elapsed += dt;

    updateTokens(dt);
    updateResources(dt);
    updateProduction(dt);
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

  const playerBlocId = gameState.playerBlocId;
  if (!playerBlocId) return;

  // Player bloc eliminated — all member countries dead
  if (gameState.isBlocEliminated(playerBlocId)) {
    gameState.phase = 'GAME_OVER';
    events.emit('game:over', { result: 'defeat' });
    return;
  }

  // === MILITARY VICTORY — all other blocs eliminated ===
  let enemyBlocsAlive = 0;
  for (const [blocId] of gameState.blocs) {
    if (blocId === playerBlocId) continue;
    if (!gameState.isBlocEliminated(blocId)) enemyBlocsAlive++;
  }
  if (enemyBlocsAlive === 0) {
    gameState.phase = 'GAME_OVER';
    events.emit('game:over', { result: 'military_victory' });
    return;
  }

  // === ECONOMIC VICTORY — bloc hits token cap ===
  const bloc = gameState.blocs.get(playerBlocId);
  if (bloc && bloc.tokens >= ECONOMIC_VICTORY_TOKENS) {
    gameState.phase = 'GAME_OVER';
    events.emit('game:over', { result: 'economic_victory' });
    return;
  }
}
