import { gameState } from '../state/GameState.js';
import { events } from '../state/events.js';
import { INTERCEPTOR_COST, MISSILE_TYPES, LAUNCH_SITE_COST, MAX_LAUNCH_SITES } from '../constants.js';
import { getBuildCostMultiplier } from '../engine/ResearchSystem.js';
import { playerLaunchMissile, getPlayerMissileType, getEffectiveCost } from '../ai/AIManager.js';
import { placeBattery, manualIntercept } from '../engine/InterceptorSystem.js';
import { setTargetingPreview, setBatteryPreview } from '../rendering/CanvasOverlay.js';
import { getProjection, isVisible } from '../rendering/Projection.js';
import { isPointInCountry, renderPaths } from '../rendering/Globe.js';
import { showToast } from './Toast.js';

let mode = 'IDLE'; // IDLE | TARGETING | PLACING_BATTERY | BUILDING_SILO
let targetingStartedAt = 0;

// Convert viewport mouse coords to globe-relative coords
function toGlobeCoords(clientX, clientY) {
  const svgEl = document.getElementById('globe');
  if (!svgEl) return [clientX, clientY];
  const rect = svgEl.getBoundingClientRect();
  return [clientX - rect.left, clientY - rect.top];
}

export function initLaunchUI() {
  // Attack button (direct click + event from HUD)
  events.on('attack:click', () => {
    if (gameState.phase !== 'PLAYING') return;
    if (mode === 'TARGETING') cancelMode();
    else enterAttackMode();
  });

  // A key shortcut for attack
  document.addEventListener('keydown', (e) => {
    if (gameState.phase !== 'PLAYING') return;

    if (e.key === 'a' || e.key === 'A') {
      if (mode === 'TARGETING') cancelMode();
      else enterAttackMode();
    }

    if (e.key === 'd' || e.key === 'D') {
      if (mode === 'PLACING_BATTERY') cancelMode();
      else enterBatteryMode();
    }

    if (e.key === 'b' || e.key === 'B') {
      if (mode === 'BUILDING_SILO') cancelMode();
      else enterSiloMode();
    }

    if (e.key === 'Escape') cancelMode();
  });

  // Deploy button
  events.on('deploy:click', () => {
    if (gameState.phase !== 'PLAYING') return;
    if (mode === 'PLACING_BATTERY') cancelMode();
    else enterBatteryMode();
  });

  // Build silo button
  events.on('build:click', () => {
    if (gameState.phase !== 'PLAYING') return;
    if (mode === 'BUILDING_SILO') cancelMode();
    else enterSiloMode();
  });

  // Also allow launch site click as before
  events.on('launchsite:click', (site) => {
    if (gameState.phase !== 'PLAYING') return;
    if (site.role !== 'player') return;
    if (mode === 'PLACING_BATTERY') return;
    enterAttackMode();
  });

  // Fire at the exact click point — works for both country clicks and globe clicks
  function handleTargetClick(geoCoords, countryId) {
    if (mode !== 'TARGETING') return false;
    if (performance.now() - targetingStartedAt < 200) return false;

    const target = geoCoords;
    if (!target) return false;

    const type = getPlayerMissileType();
    const origin = findNearestSiteWithType(target, type);
    if (!origin) {
      const player = gameState.getPlayer();
      const anyActive = player && player.launchSites.some(s => !s.disabled && gameState.elapsed >= (s.disabledUntil || 0));
      if (!anyActive) showToast('No active launch sites available', 'error');
      else showToast(`No ${type} loaded. Queue production first.`, 'warn');
      return true;
    }

    // Resolve target country if not provided
    if (!countryId) {
      let bestDist = Infinity;
      for (const [id, c] of gameState.countries) {
        if (gameState.isEliminated(id)) continue;
        const dx = target[0] - c.centroid[0];
        const dy = target[1] - c.centroid[1];
        const dist = dx * dx + dy * dy;
        if (dist < bestDist) { bestDist = dist; countryId = id; }
      }
    }

    const success = playerLaunchMissile(origin, target, countryId);
    if (!success) flashElement('tb-tokens', 'flash-red');
    return true;
  }

  // Track whether a click was already handled this frame
  let clickHandledAt = 0;

  // Country click — precise, includes country ID
  events.on('country:click', (data) => {
    if (handleTargetClick(data.geoCoords, data.id)) {
      data.consumed = true;
      clickHandledAt = performance.now();
    }
  });

  // Globe click fallback — catches clicks on ocean, borders, gaps
  // Skip if country:click already handled this click
  events.on('globe:click', (data) => {
    if (performance.now() - clickHandledAt < 50) return; // same click already handled
    handleTargetClick(data.geoCoords, null);
  });

  // Track mouse for preview
  document.addEventListener('mousemove', (e) => {
    if (mode === 'TARGETING') {
      const projection = getProjection();
      const [gx, gy] = toGlobeCoords(e.clientX, e.clientY);
      const inverted = projection.invert([gx, gy]);
      if (inverted && isFinite(inverted[0]) && isFinite(inverted[1])) {
        const origin = findNearestSiteWithType(inverted, getPlayerMissileType()) || findNearestSite(inverted);
        if (origin) setTargetingPreview(origin, inverted);
      }
    } else if (mode === 'PLACING_BATTERY' || mode === 'BUILDING_SILO') {
      const projection = getProjection();
      const inverted = projection.invert(toGlobeCoords(e.clientX, e.clientY));
      if (inverted && isVisible(inverted)) {
        setBatteryPreview(inverted);
      } else {
        setBatteryPreview(null);
      }
    }
  });

  // Pointerup for battery placement and manual intercept
  document.addEventListener('pointerup', (e) => {
    if (gameState.phase !== 'PLAYING') return;

    const projection = getProjection();
    const clickPos = projection.invert(toGlobeCoords(e.clientX, e.clientY));

    const [cx, cy] = projection.translate();
    const radius = projection.scale();
    const [gx, gy] = toGlobeCoords(e.clientX, e.clientY);
    const dx = gx - cx;
    const dy = gy - cy;
    const inGlobe = dx * dx + dy * dy <= radius * radius;

    if (mode === 'PLACING_BATTERY') {
      if (performance.now() - targetingStartedAt < 200) return;
      if (!clickPos || !inGlobe) { cancelMode(); return; }

      if (!isPointInCountry(clickPos, gameState.playerCountryId)) {
        showToast('Must place on your own territory', 'error');
        return;
      }

      const player = gameState.getPlayer();
      const batteryCost = gameState.getBatteryCost(gameState.playerCountryId);
      if (player.tokens < batteryCost) {
        showToast(`Not enough tokens — need ${batteryCost}◆`, 'warn');
        return;
      }

      // No cap — cost scales progressively

      placeBattery(gameState.playerCountryId, clickPos, 'player');
      showToast('Interceptor battery deployed', 'success');
      cancelMode();

    } else if (mode === 'BUILDING_SILO') {
      if (performance.now() - targetingStartedAt < 200) return;
      if (!clickPos || !inGlobe) { cancelMode(); return; }

      if (!isPointInCountry(clickPos, gameState.playerCountryId)) {
        showToast('Must build on your own territory', 'error');
        return;
      }

      const player = gameState.getPlayer();
      // No cap — cost scales linearly like batteries
      const siloCount = player.launchSites.length;
      const siloCost = Math.ceil((15 + siloCount * 3) * getBuildCostMultiplier(gameState.playerCountryId));
      if (player.tokens < siloCost) {
        showToast(`Not enough tokens — need ${siloCost}◆`, 'warn');
        return;
      }

      player.tokens -= siloCost;
      player.launchSites.push({
        coords: clickPos,
        disabled: false,
        disabledUntil: 0,
        loadedMissiles: {},
      });
      showToast('Launch silo constructed', 'success');
      renderPaths();
      cancelMode();

    } else if (mode === 'IDLE' && inGlobe && clickPos) {
      const clicked = findMissileNearClick(e.clientX, e.clientY);
      if (clicked) manualIntercept(clicked);
    }
  });

  // Cancel on right-click
  document.addEventListener('contextmenu', (e) => {
    if (mode !== 'IDLE') {
      e.preventDefault();
      cancelMode();
    }
  });
}

function enterAttackMode() {
  const player = gameState.getPlayer();
  if (!player) return;
  const activeSites = player.launchSites.filter(s => !s.disabled);
  if (activeSites.length === 0) {
    showToast('All launch sites disabled', 'error');
    return;
  }
  cancelMode();
  mode = 'TARGETING';
  targetingStartedAt = performance.now();
  document.body.classList.add('targeting');
  document.body.classList.remove('placing');
  const btn = document.getElementById('btn-attack');
  if (btn) btn.classList.add('active');
  showToast('Click a target on the map', 'info');
}

function enterSiloMode() {
  const player = gameState.getPlayer();
  if (!player) return;
  const siloCount = player.launchSites.length;
  const siloCost = Math.ceil((15 + siloCount * 3) * getBuildCostMultiplier(gameState.playerCountryId));
  if (player.tokens < siloCost) {
    showToast(`Not enough tokens — need ${siloCost}◆`, 'warn');
    return;
  }
  cancelMode();
  mode = 'BUILDING_SILO';
  targetingStartedAt = performance.now();
  document.body.classList.add('placing');
  showToast(`Click to build silo (${siloCost}◆)`, 'info');
}

function enterBatteryMode() {
  cancelMode();
  mode = 'PLACING_BATTERY';
  targetingStartedAt = performance.now();
  document.body.classList.add('placing');
  document.body.classList.remove('targeting');
}

function cancelMode() {
  mode = 'IDLE';
  setTargetingPreview(null, null);
  setBatteryPreview(null);
  document.body.classList.remove('targeting');
  document.body.classList.remove('placing');
  const btn = document.getElementById('btn-attack');
  if (btn) btn.classList.remove('active');
}

function findNearestSite(target) {
  const player = gameState.getPlayer();
  if (!player) return null;
  const activeSites = player.launchSites.filter(s => !s.disabled && gameState.elapsed >= (s.disabledUntil || 0));
  if (activeSites.length === 0) return null;

  let best = activeSites[0].coords;
  let bestDist = Infinity;
  for (const site of activeSites) {
    const dx = target[0] - site.coords[0];
    const dy = target[1] - site.coords[1];
    const dist = dx * dx + dy * dy;
    if (dist < bestDist) {
      bestDist = dist;
      best = site.coords;
    }
  }
  return best;
}

function findNearestSiteWithType(target, type) {
  const player = gameState.getPlayer();
  if (!player) return null;
  const candidates = player.launchSites.filter(s =>
    !s.disabled &&
    gameState.elapsed >= (s.disabledUntil || 0) &&
    s.loadedMissiles && (s.loadedMissiles[type] || 0) > 0
  );
  if (candidates.length === 0) return null;

  let best = candidates[0].coords;
  let bestDist = Infinity;
  for (const site of candidates) {
    const dx = target[0] - site.coords[0];
    const dy = target[1] - site.coords[1];
    const dist = dx * dx + dy * dy;
    if (dist < bestDist) {
      bestDist = dist;
      best = site.coords;
    }
  }
  return best;
}

function findMissileNearClick(screenX, screenY) {
  const projection = getProjection();
  const threshold = 20;
  const [gx, gy] = toGlobeCoords(screenX, screenY);

  for (const missile of gameState.missiles) {
    if (missile.isPlayer) continue;

    const pos = missile.interpolator(missile.progress);
    if (!isVisible(pos)) continue;

    const [mx, my] = projection(pos);
    const dx = gx - mx;
    const dy = gy - my;
    if (dx * dx + dy * dy < threshold * threshold) {
      return missile;
    }
  }
  return null;
}

function flashElement(id, className) {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.remove(className);
  void el.offsetWidth;
  el.classList.add(className);
}

export function getMode() {
  return mode;
}

export function resetLaunchUI() {
  cancelMode();
}
