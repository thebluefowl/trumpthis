import { gameState } from './state/GameState.js';
import { events } from './state/events.js';
import { initGlobe, initLaunchSites, renderPaths, rotateTo, formatPop } from './rendering/Globe.js';
import { initCanvas, renderCanvas } from './rendering/CanvasOverlay.js';
import { initHUD } from './rendering/HUD.js';
import { initScreens, showScreen, showGameOverlay } from './ui/Screens.js';
import { initCountrySelect, resetCountrySelect } from './ui/CountrySelect.js';
import { initLaunchUI, resetLaunchUI } from './ui/LaunchUI.js';
import { startGameLoop, stopGameLoop } from './engine/GameLoop.js';
import { resetAI } from './ai/EasyAI.js';

async function init() {
  initScreens();
  showScreen('select');
  showGameOverlay(false);

  // Init globe
  const svgEl = document.getElementById('globe');
  const canvasEl = document.getElementById('overlay');

  await initGlobe(svgEl);
  initCanvas(canvasEl);
  initHUD();
  initCountrySelect();
  initLaunchUI();

  // Wire up game start
  events.on('game:start', startGame);

  // Wire up game over
  events.on('game:over', onGameOver);

  // Wire up play again
  document.getElementById('btn-play-again').addEventListener('click', restartGame);
}

function startGame() {
  gameState.startGame(gameState.playerCountryId, gameState.aiCountryId);

  showScreen('select'); // keep the globe visible (it's in the select screen DOM)
  showGameOverlay(true);

  // Hide select UI elements
  document.querySelector('.select-title').style.display = 'none';
  document.querySelector('.select-subtitle').style.display = 'none';
  document.getElementById('select-panel').style.display = 'none';
  document.getElementById('tooltip').style.display = 'none';

  // Show HUD
  document.getElementById('hud').style.display = '';

  // Init launch sites on globe
  initLaunchSites();
  renderPaths();

  // Start game loop
  resetAI();
  startGameLoop();
}

function onGameOver({ result }) {
  stopGameLoop();

  const titleEl = document.getElementById('gameover-title');
  const statsEl = document.getElementById('gameover-stats');

  if (result === 'victory') {
    titleEl.textContent = 'VICTORY';
    titleEl.className = 'gameover-title victory';
  } else if (result === 'defeat') {
    titleEl.textContent = 'DEFEAT';
    titleEl.className = 'gameover-title defeat';
  } else {
    titleEl.textContent = 'MUTUAL DESTRUCTION';
    titleEl.className = 'gameover-title defeat';
  }

  const player = gameState.getPlayer();
  const ai = gameState.getAI();
  const mins = Math.floor(gameState.elapsed / 60);
  const secs = Math.floor(gameState.elapsed % 60);

  statsEl.innerHTML = `
    <div>Time: <span>${mins}m ${secs}s</span></div>
    <div>Missiles Launched: <span>${gameState.stats.playerLaunched}</span></div>
    <div>Damage Dealt: <span>${formatPop(gameState.stats.playerDamageDealt)}</span></div>
    <div>Population Remaining: <span>${player ? formatPop(player.population) : '0'}</span></div>
    <div>Enemy Population: <span>${ai ? formatPop(ai.population) : '0'}</span></div>
  `;

  showScreen('gameover');
}

function restartGame() {
  gameState.reset();
  resetCountrySelect();
  resetLaunchUI();

  // Restore select screen elements
  document.querySelector('.select-title').style.display = '';
  document.querySelector('.select-subtitle').style.display = '';
  document.getElementById('select-panel').style.display = '';
  document.getElementById('tooltip').style.display = '';

  showScreen('select');
  showGameOverlay(false);
  renderPaths();
}

init();
