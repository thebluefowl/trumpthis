import { gameState } from './state/GameState.js';
import { events } from './state/events.js';
import { initRelationships, resetDiplomacy } from './state/Diplomacy.js';
import { initGlobe, initLaunchSites, initBatteries, renderPaths, rotateTo, formatPop, setInteractable, startAutoRotate, stopAutoRotate, switchProjection } from './rendering/Globe.js';
import { getProjectionType, setPanelOffsets } from './rendering/Projection.js';
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
import { resetIntel, initFog } from './state/Intel.js';
import { initSoundEngine } from './audio/SoundEngine.js';
import { initCheats } from './ui/Cheats.js';
import { initTutorial, startTutorial, resetTutorial } from './ui/Tutorial.js';
import { startAutoSave, stopAutoSave, hasSave, deleteSave } from './engine/SaveLoad.js';
import { startMusic, stopMusic, setMusicPhase } from './audio/Music.js';
import { getSatelliteAtScreen } from './rendering/CanvasOverlay.js';

// Panel visibility helpers
function showPanel(id) { document.getElementById(id)?.classList.remove('hidden'); }
function hidePanel(id) { document.getElementById(id)?.classList.add('hidden'); }
function hideAllPanels() {
  ['panel-briefing', 'panel-setup', 'game-hud', 'screen-gameover', 'screen-extinction'].forEach(hidePanel);
}

async function init() {
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
  initTutorial();

  // Satellite hover tooltip
  const overlay = document.getElementById('overlay');
  const tip = document.getElementById('tooltip');
  if (overlay && tip) {
    overlay.style.pointerEvents = 'none'; // canvas doesn't capture — use document
    document.addEventListener('mousemove', (e) => {
      if (gameState.phase !== 'PLAYING') return;
      const rect = document.getElementById('globe')?.getBoundingClientRect();
      if (!rect) return;
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      const sat = getSatelliteAtScreen(sx, sy);
      if (sat) {
        tip.innerHTML = `<div class="name">${sat.name}</div><div class="stat">${sat.desc}</div><div class="stat">Inclination: <span>${sat.incl}°</span></div>`;
        tip.classList.add('visible');
        tip.style.left = (e.clientX + 12) + 'px';
        tip.style.top = (e.clientY + 12) + 'px';
      } else if (tip.classList.contains('visible') && gameState.phase === 'PLAYING') {
        tip.classList.remove('visible');
      }
    });
  }

  // Ensure globe is sized correctly
  window.dispatchEvent(new Event('resize'));

  // Start: show briefing panel with rotating globe
  hideAllPanels();
  showPanel('panel-briefing');
  setPanelOffsets(360, 0); // briefing panel is 400px
  setInteractable(false);
  startAutoRotate();
  window.dispatchEvent(new Event('resize'));

  // Start music on first interaction
  document.addEventListener('click', () => {
    startMusic();
    setMusicPhase('menu');
  }, { once: true });

  // Briefing → Country select
  document.getElementById('btn-start').addEventListener('click', () => {
    setMusicPhase('calm');
    hidePanel('panel-briefing');
    showPanel('panel-setup');
    setPanelOffsets(360, 0); // setup panel is 300px
    stopAutoRotate();
    setInteractable(true);
    if (getProjectionType() === 'orthographic') {
      switchProjection();
    }
    showCountrySelect();
    window.dispatchEvent(new Event('resize'));
  });

  // Country selected → Alliance picker (swap sidebar content)
  events.on('game:start', () => {
    showAlliancePicker(gameState.playerCountryId);
  });

  // Back navigation
  events.on('nav:back-to-briefing', () => {
    hidePanel('panel-setup');
    showPanel('panel-briefing');
    setPanelOffsets(360, 0);
    setInteractable(false);
    startAutoRotate();
    if (getProjectionType() === 'mercator') switchProjection();
    setMusicPhase('menu');
  });

  events.on('nav:back-to-country', () => {
    // Unlock country selection, go back to country list
    resetCountrySelect();
    gameState.playerCountryId = null;
    showCountrySelect();
  });

  // Alliance selected → Start game
  events.on('bloc:selected', (blocId) => {
    startGame(blocId);
  });

  events.on('game:over', onGameOver);
  document.getElementById('btn-play-again').addEventListener('click', restartGame);
}

function startGame(blocId) {
  gameState.startGame(gameState.playerCountryId, blocId);
  initRelationships(blocId);

  hideAllPanels();
  showPanel('game-hud');
  setPanelOffsets(0, 300);
  setMusicPhase('tension');

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
  initFog();
  resetCombatLog();
  showNewsTicker();
  startTutorial();
  startAutoSave();
  startGameLoop();
}

function onGameOver({ result }) {
  stopGameLoop();
  stopAutoSave();
  deleteSave();

  if (result === 'extinction') {
    setMusicPhase('extinction');
    showExtinctionScreen();
    return;
  }

  const titleEl = document.getElementById('gameover-title');
  const statsEl = document.getElementById('gameover-stats');

  const victoryTypes = {
    military_victory: { title: 'MILITARY VICTORY', subtitle: 'All enemies eliminated. Total domination achieved.', css: 'victory' },
    economic_victory: { title: 'ECONOMIC VICTORY', subtitle: 'Economic supremacy established. Your war machine is unstoppable.', css: 'victory' },
    diplomatic_victory: { title: 'DIPLOMATIC VICTORY', subtitle: 'The world united under your leadership. Peace through strength.', css: 'victory' },
    defeat: { title: 'DEFEAT', subtitle: 'Your nation has fallen. The world moves on without you.', css: 'defeat' },
    timeout: { title: 'TIME EXPIRED', subtitle: 'The clock ran out. No clear victor emerged from the ashes.', css: 'defeat' },
  };

  const vType = victoryTypes[result] || victoryTypes.defeat;
  titleEl.textContent = vType.title;
  titleEl.className = `gameover-title ${vType.css}`;

  // Add subtitle
  let subtitleEl = document.getElementById('gameover-subtitle');
  if (!subtitleEl) {
    subtitleEl = document.createElement('div');
    subtitleEl.id = 'gameover-subtitle';
    subtitleEl.className = 'gameover-subtitle';
    titleEl.parentNode.insertBefore(subtitleEl, titleEl.nextSibling);
  }
  subtitleEl.textContent = vType.subtitle;

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

  showPanel('screen-gameover');
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

  showPanel('screen-extinction');

  document.getElementById('btn-restart').addEventListener('click', () => {
    hidePanel('screen-extinction');
    restartGame();
  });
}

function restartGame() {
  gameState.reset();
  resetCountrySelect();
  resetLaunchUI();
  resetSidebar();
  resetNewsTicker();

  hideAllPanels();
  showPanel('panel-briefing');
  setPanelOffsets(360, 0);
  setInteractable(false);
  setMusicPhase('menu');
  if (getProjectionType() === 'mercator') {
    switchProjection();
  }
  startAutoRotate();

  window.dispatchEvent(new Event('resize'));
  renderPaths();
}

init();
