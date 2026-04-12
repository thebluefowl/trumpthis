import { gameState } from './state/GameState.js';
import { events } from './state/events.js';
import { initRelationships, resetDiplomacy } from './state/Diplomacy.js';
import { initGlobe, initLaunchSites, initBatteries, renderPaths, rotateTo, formatPop } from './rendering/Globe.js';
import { initCanvas } from './rendering/CanvasOverlay.js';
import { initHUD } from './rendering/HUD.js';
import { initCountrySelect, showCountrySelect, resetCountrySelect } from './ui/CountrySelect.js';
import { initAlliancePicker, showAlliancePicker } from './ui/AlliancePicker.js';
import { initLaunchUI, resetLaunchUI } from './ui/LaunchUI.js';
import { initSidebar, renderSidebar, resetSidebar } from './ui/Sidebar.js';
import { initCombatLog, resetCombatLog } from './ui/SidebarLog.js';
import { initNewsTicker, showNewsTicker, hideNewsTicker, resetNewsTicker } from './ui/NewsTicker.js';
import { startGameLoop, stopGameLoop } from './engine/GameLoop.js';
import { resetAIManager } from './ai/AIManager.js';
import { resetInterceptors } from './engine/InterceptorSystem.js';
import { resetEscalation } from './engine/Escalation.js';
import { resetConquest } from './engine/Conquest.js';
import { initResources, resetResources } from './engine/ResourceSystem.js';
import { resetResearch } from './engine/ResearchSystem.js';
import { resetIntel } from './state/Intel.js';
import { initSoundEngine } from './audio/SoundEngine.js';
import { initCheats } from './ui/Cheats.js';

async function init() {
  // Init globe in the select screen container first
  const svgEl = document.getElementById('globe');
  const canvasEl = document.getElementById('overlay');

  await initGlobe(svgEl);
  initCanvas(canvasEl);
  initHUD();
  initCountrySelect();
  initAlliancePicker();
  initLaunchUI();
  initSidebar();
  initCombatLog();
  initNewsTicker();
  initSoundEngine();
  initCheats();

  // Show title screen, hide everything else
  document.getElementById('screen-select').classList.remove('hidden');
  document.getElementById('screen-setup').classList.add('hidden');
  document.getElementById('game-layout').classList.add('hidden');

  // Title → Setup screen (country select)
  document.getElementById('btn-start').addEventListener('click', () => {
    document.getElementById('screen-select').classList.add('hidden');
    document.getElementById('screen-setup').classList.remove('hidden');
    showCountrySelect();
    window.dispatchEvent(new Event('resize'));
  });

  // Country selected → swap sidebar to alliance picker
  events.on('game:start', () => {
    showAlliancePicker(gameState.playerCountryId);
  });

  // Alliance selected → start game
  events.on('bloc:selected', (blocId) => {
    startGame(blocId);
  });

  events.on('game:over', onGameOver);

  document.getElementById('btn-play-again').addEventListener('click', restartGame);
}

function startGame(blocId) {
  gameState.startGame(gameState.playerCountryId, blocId);
  initRelationships(blocId);

  // Hide all pre-game screens, show game layout
  document.getElementById('screen-select').classList.add('hidden');
  document.getElementById('screen-setup').classList.add('hidden');
  document.getElementById('game-layout').classList.remove('hidden');

  // Move globe SVG + canvas into the game layout container
  const globeContainer = document.getElementById('globe-container');
  const svgEl = document.getElementById('globe');
  const canvasEl = document.getElementById('overlay');
  globeContainer.appendChild(svgEl);
  globeContainer.appendChild(canvasEl);

  // Trigger resize so globe fills the map area
  window.dispatchEvent(new Event('resize'));

  initLaunchSites();
  initBatteries();
  renderPaths();

  resetAIManager();
  resetInterceptors();
  resetDiplomacy();
  resetEscalation();
  resetConquest();
  initResources();
  resetResearch();
  resetIntel();
  resetCombatLog();
  showNewsTicker();
  startGameLoop();
}

function onGameOver({ result }) {
  stopGameLoop();

  const titleEl = document.getElementById('gameover-title');
  const statsEl = document.getElementById('gameover-stats');

  if (result === 'extinction') {
    showExtinctionScreen();
    return;
  } else if (result === 'victory') {
    titleEl.textContent = 'VICTORY';
    titleEl.className = 'gameover-title victory';
  } else if (result === 'defeat') {
    titleEl.textContent = 'DEFEAT';
    titleEl.className = 'gameover-title defeat';
  } else {
    titleEl.textContent = 'TIME EXPIRED';
    titleEl.className = 'gameover-title defeat';
  }

  const player = gameState.getPlayer();
  const mins = Math.floor(gameState.elapsed / 60);
  const secs = Math.floor(gameState.elapsed % 60);

  statsEl.innerHTML = `
    <div>Time: <span>${mins}m ${secs}s</span></div>
    <div>Missiles Launched: <span>${gameState.stats.playerLaunched}</span></div>
    <div>Missiles Intercepted: <span>${gameState.stats.playerIntercepted}</span></div>
    <div>Damage Dealt: <span>${formatPop(gameState.stats.playerDamageDealt)}</span></div>
    <div>Nations Eliminated: <span>${gameState.eliminated.size}</span></div>
    <div>Population Remaining: <span>${player ? formatPop(player.population) : '0'}</span></div>
  `;

  document.getElementById('screen-gameover').classList.remove('hidden');
}

function showExtinctionScreen() {
  stopGameLoop();

  const totalNukes = gameState.nuclearWinterLevel;
  const totalDead = [...gameState.countries.values()].reduce((s, c) => s + c.startingPopulation, 0);
  const elapsed = gameState.elapsed;
  const mins = Math.floor(elapsed / 60);
  const secs = Math.floor(elapsed % 60);

  const statsEl = document.getElementById('extinction-stats');
  if (statsEl) {
    statsEl.innerHTML = `
      GLOBAL POPULATION: 0<br>
      NUCLEAR DETONATIONS: ${totalNukes}<br>
      TIME TO EXTINCTION: ${mins}m ${secs}s<br>
      NATIONS DESTROYED: ${gameState.eliminated.size} / ${gameState.countries.size}
    `;
  }

  document.getElementById('screen-extinction').classList.remove('hidden');

  document.getElementById('btn-restart').addEventListener('click', () => {
    document.getElementById('screen-extinction').classList.add('hidden');
    restartGame();
  });
}

function restartGame() {
  gameState.reset();
  resetCountrySelect();
  resetLaunchUI();
  resetSidebar();
  resetNewsTicker();

  document.getElementById('screen-gameover').classList.add('hidden');
  document.getElementById('game-layout').classList.add('hidden');
  document.getElementById('screen-setup').classList.add('hidden');
  document.getElementById('screen-select').classList.remove('hidden');

  // Move globe back to setup screen
  const selectContainer = document.getElementById('globe-container-select');
  const svgEl = document.getElementById('globe');
  const canvasEl = document.getElementById('overlay');
  if (selectContainer) {
    selectContainer.appendChild(svgEl);
    selectContainer.appendChild(canvasEl);
  }

  window.dispatchEvent(new Event('resize'));
  renderPaths();
}

init();
