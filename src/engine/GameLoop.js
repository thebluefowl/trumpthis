import { gameState } from '../state/GameState.js';
import { updateTokens } from './TokenEconomy.js';
import { updateMissiles, cleanupExpired } from './MissileSimulator.js';
import { processImpacts } from './DamageModel.js';
import { renderCanvas } from '../rendering/CanvasOverlay.js';
import { renderHUD } from '../rendering/HUD.js';
import { updateAI } from '../ai/EasyAI.js';
import { events } from '../state/events.js';

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

  // Cap delta to prevent spiral of death after tab switch
  dt = Math.min(dt, 0.1);

  if (!gameState.paused && gameState.phase === 'PLAYING') {
    gameState.elapsed += dt;

    // Update
    updateTokens(dt);
    updateAI(dt);
    updateMissiles(dt);
    processImpacts();
    cleanupExpired();
    checkGameOver();
  }

  // Render (always, even when paused — for canvas overlay)
  renderCanvas(dt);
  renderHUD();

  requestAnimationFrame(tick);
}

function checkGameOver() {
  const player = gameState.getPlayer();
  const ai = gameState.getAI();
  if (!player || !ai) return;

  if (player.population <= 0 && ai.population <= 0) {
    gameState.phase = 'GAME_OVER';
    events.emit('game:over', { result: 'draw' });
  } else if (ai.population <= 0) {
    gameState.phase = 'GAME_OVER';
    events.emit('game:over', { result: 'victory' });
  } else if (player.population <= 0) {
    gameState.phase = 'GAME_OVER';
    events.emit('game:over', { result: 'defeat' });
  }
}
