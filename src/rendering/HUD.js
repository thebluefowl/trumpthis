import { gameState } from '../state/GameState.js';
import { events } from '../state/events.js';
import { formatPop, switchProjection } from './Globe.js';
import { setPlayerMissileType, getPlayerMissileType } from '../ai/AIManager.js';
import { MISSILE_TYPES, ESCALATION_START, MATCH_TIMEOUT } from '../constants.js';
import { isEscalationActive, getTimeRemaining, getEscalationTick } from '../engine/Escalation.js';
import { getClaimWindows, playerClaimTerritory } from '../engine/Conquest.js';
import { launchSatellite, getSatelliteCount, getSatLaunches } from '../state/Intel.js';
import { SATELLITE_LAUNCH_COST, MAX_SATELLITES } from '../constants.js';
import { showToast } from '../ui/Toast.js';
import { TOKEN_RATES } from '../constants.js';
import { getTokenMultiplier } from '../engine/Escalation.js';

let prevValues = {};
let setupBannerEl = null;

function renderSetupBanner() {
  if (gameState.phase === 'SETUP') {
    if (!setupBannerEl) {
      const topBar = document.querySelector('.top-bar');
      if (!topBar) return;
      setupBannerEl = document.createElement('div');
      setupBannerEl.id = 'setup-seg';
      setupBannerEl.className = 'tb-seg tb-seg-setup';
      setupBannerEl.innerHTML = `
        <span class="tb-label">SETUP</span>
        <span class="tb-val" id="setup-countdown">60s</span>
        <button class="tb-btn tb-btn-begin-war" id="btn-begin-war">BEGIN WAR</button>
      `;
      // Insert after DEFCON's following divider
      const defconSeg = document.getElementById('tb-defcon')?.closest('.tb-seg');
      const afterDivider = defconSeg?.nextElementSibling;
      if (afterDivider && afterDivider.nextSibling) {
        topBar.insertBefore(setupBannerEl, afterDivider.nextSibling);
      } else {
        topBar.appendChild(setupBannerEl);
      }
      document.getElementById('btn-begin-war').addEventListener('click', () => gameState.beginWar());
    }
    const remaining = Math.max(0, Math.ceil(gameState.setupEndsAt - gameState.elapsed));
    const cd = document.getElementById('setup-countdown');
    if (cd) cd.textContent = `${remaining}s`;
  } else if (setupBannerEl) {
    setupBannerEl.remove();
    setupBannerEl = null;
  }
}

export function initHUD() {
  prevValues = {};

  // Attack button
  document.getElementById('btn-attack')?.addEventListener('click', (e) => {
    e.stopPropagation();
    events.emit('attack:click');
  });

  // Deploy button
  document.getElementById('btn-deploy')?.addEventListener('click', (e) => {
    e.stopPropagation();
    events.emit('deploy:click');
  });

  // Build silo button
  document.getElementById('btn-build')?.addEventListener('click', (e) => {
    e.stopPropagation();
    events.emit('build:click');
  });

  // Satellite launch
  document.getElementById('btn-satellite')?.addEventListener('click', (e) => {
    e.stopPropagation();
    const count = getSatelliteCount();
    if (count >= MAX_SATELLITES) {
      showToast(`Maximum ${MAX_SATELLITES} satellites in orbit`, 'warn');
      return;
    }
    const success = launchSatellite();
    if (success) {
      showToast(`Satellite launched! (${getSatelliteCount()}/${MAX_SATELLITES} in orbit)`, 'success');
    } else {
      showToast(`Not enough tokens — need ${SATELLITE_LAUNCH_COST}◆`, 'warn');
    }
  });

  // S key shortcut for satellite
  document.addEventListener('keydown', (e) => {
    if (gameState.phase !== 'PLAYING' && gameState.phase !== 'SETUP') return;
    if (e.key === 's' || e.key === 'S') {
      if (e.target.tagName === 'INPUT') return;
      const count = getSatelliteCount();
      if (count >= MAX_SATELLITES) return;
      const success = launchSatellite();
      if (success) showToast(`Satellite launched! (${getSatelliteCount()}/${MAX_SATELLITES})`, 'success');
    }
  });

  // Map toggle
  document.getElementById('btn-map')?.addEventListener('click', (e) => {
    e.stopPropagation();
    switchProjection();
  });

  // Missile type selectors
  const weaponTip = document.getElementById('weapon-tip');
  document.querySelectorAll('.ms').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      setPlayerMissileType(btn.dataset.type);
      updateMissileSelector();
    });

    btn.addEventListener('mouseenter', () => {
      const typeKey = btn.dataset.type;
      const mtype = MISSILE_TYPES[typeKey];
      if (!mtype) return;

      const locked = mtype.unlockAt !== undefined && gameState.elapsed < mtype.unlockAt;
      const unlockIn = locked ? Math.ceil(mtype.unlockAt - gameState.elapsed) : 0;
      const effectiveCost = gameState.playerCountryId
        ? `~${mtype.cost}+` : `${mtype.cost}`;

      const dmgText = mtype.damage > 0 ? `${(mtype.damage * 100).toFixed(0)}%` : 'NONE';
      const speedText = mtype.baseFlight <= 2 ? 'FAST' : mtype.baseFlight <= 5 ? 'MED' : 'SLOW';
      const interceptText = `${(mtype.autoIntercept * 100).toFixed(0)}%`;
      const special = mtype.empDuration ? `EMP ${mtype.empDuration}s`
        : mtype.warheads ? `${mtype.warheads} WARHEADS`
        : mtype.contamination ? `RADIATION ${mtype.contaminationDuration}s`
        : mtype.decoyCount ? `${mtype.decoyCount} FAKES`
        : mtype.launchFromOcean ? 'SUB-LAUNCHED'
        : mtype.isDrone ? 'TARGETS INFRA'
        : mtype.isNuke ? 'NUCLEAR'
        : '';

      weaponTip.innerHTML = `
        <div class="weapon-tip-name">${mtype.name}${locked ? ` — LOCKED (${unlockIn}s)` : ''}</div>
        <div class="weapon-tip-desc">${mtype.description}</div>
        <div class="weapon-tip-stats">
          <div class="weapon-tip-stat"><span class="weapon-tip-stat-label">COST</span><span class="weapon-tip-stat-val">${mtype.cost}◆</span></div>
          <div class="weapon-tip-stat"><span class="weapon-tip-stat-label">DAMAGE</span><span class="weapon-tip-stat-val">${dmgText}</span></div>
          <div class="weapon-tip-stat"><span class="weapon-tip-stat-label">SPEED</span><span class="weapon-tip-stat-val">${speedText}</span></div>
          <div class="weapon-tip-stat"><span class="weapon-tip-stat-label">INTERCEPT</span><span class="weapon-tip-stat-val">${interceptText}</span></div>
          ${special ? `<div class="weapon-tip-stat"><span class="weapon-tip-stat-label">SPECIAL</span><span class="weapon-tip-stat-val">${special}</span></div>` : ''}
        </div>
      `;
      weaponTip.classList.add('visible');
    });

    btn.addEventListener('mouseleave', () => {
      weaponTip.classList.remove('visible');
    });
  });

  // Number key shortcuts
  document.addEventListener('keydown', (e) => {
    if (gameState.phase !== 'PLAYING' && gameState.phase !== 'SETUP') return;
    const typeMap = { '1': 'drone', '2': 'tactical', '3': 'cruise', '4': 'decoy', '5': 'icbm', '6': 'dirty_bomb', '7': 'emp', '8': 'mirv', '9': 'slbm', '0': 'hypersonic', 'n': 'nuke' };
    if (typeMap[e.key]) {
      const typeKey = typeMap[e.key];
      const mtype = MISSILE_TYPES[typeKey];
      // Block if locked AND nothing loaded; allow if any loaded
      const p = gameState.getPlayer();
      const anyLoaded = p && p.launchSites.some(s => (s.loadedMissiles?.[typeKey] || 0) > 0);
      if (mtype && mtype.unlockAt !== undefined && gameState.elapsed < mtype.unlockAt && !anyLoaded) return;
      setPlayerMissileType(typeKey);
      updateMissileSelector();
    }
  });
}

export function renderHUD() {
  if (gameState.phase !== 'PLAYING' && gameState.phase !== 'SETUP') return;
  renderSetupBanner();
  const player = gameState.getPlayer();
  if (!player) return;

  // Clock
  const mins = Math.floor(gameState.elapsed / 60);
  const secs = Math.floor(gameState.elapsed % 60);
  setIfChanged('tb-clock', `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`);

  // Tokens
  setIfChanged('tb-tokens', Math.floor(player.tokens));

  // Token rate
  const tokenRate = (TOKEN_RATES[player.tier] * getTokenMultiplier() * Math.log(player.population / player.startingPopulation + 1) / Math.log(2)).toFixed(1);
  setIfChanged('tb-token-rate', `+${tokenRate}/s`);

  // DEFCON + incoming threats
  // DEFCON 5 = peace, 1 = nuclear war imminent
  const inboundMissiles = gameState.missiles.filter(m => m.toCountryId === player.id);
  const inbound = inboundMissiles.length;
  const totalMissiles = gameState.missiles.length;
  const nukeInbound = inboundMissiles.some(m => m.mtype?.isNuke);

  let defcon;
  if (nukeInbound) defcon = 1;
  else if (inbound > 5 || gameState.nuclearWinterLevel > 0) defcon = 1;
  else if (inbound > 2 || isEscalationActive()) defcon = 2;
  else if (inbound > 0 || totalMissiles > 10) defcon = 3;
  else if (totalMissiles > 0) defcon = 4;
  else defcon = 5;

  const defconEl = document.getElementById('tb-defcon');
  if (defconEl) {
    defconEl.textContent = defcon;
    defconEl.style.color = defcon <= 1 ? 'var(--red)' : defcon <= 2 ? 'var(--red)' : defcon <= 3 ? 'var(--amber)' : defcon <= 4 ? 'var(--text)' : 'var(--green-bright)';
  }

  // Incoming threat counter
  setIfChanged('tb-inbound', inbound);
  const threatSeg = document.getElementById('tb-threat-seg');
  if (threatSeg) {
    threatSeg.classList.toggle('active', inbound > 0);
    const minEta = inboundMissiles.length > 0
      ? Math.min(...inboundMissiles.map(m => (1 - m.progress) / m.speed))
      : 0;
    threatSeg.classList.toggle('critical', minEta < 5 && inbound > 0);
    const etaEl = document.getElementById('tb-threat-eta');
    if (etaEl) {
      etaEl.textContent = inbound > 0 ? `ETA ${Math.ceil(minEta)}s` : '';
    }
  }

  // Doomsday clock
  const doomSeg = document.getElementById('tb-doomsday');
  const doomVal = document.getElementById('tb-doom-val');
  if (doomSeg && doomVal) {
    if (isEscalationActive()) {
      const remaining = getTimeRemaining();
      const dm = Math.floor(remaining / 60);
      const ds = Math.floor(remaining % 60);
      doomVal.textContent = `${String(dm).padStart(2, '0')}:${String(ds).padStart(2, '0')} T${getEscalationTick()}`;
      doomSeg.classList.remove('hidden');
    } else if (gameState.elapsed > ESCALATION_START - 60) {
      doomVal.textContent = `${Math.floor(ESCALATION_START - gameState.elapsed)}s`;
      doomSeg.classList.remove('hidden');
    } else {
      doomSeg.classList.add('hidden');
    }
  }

  // Update missile selector (locked/unlocked states)
  updateMissileSelector();

  // Satellite button — show launch timer or count
  const satBtn = document.getElementById('btn-satellite');
  if (satBtn) {
    const launches = getSatLaunches();
    const count = getSatelliteCount();
    if (launches.length > 0) {
      const launch = launches[0];
      const totalDur = launch.launchDuration + launch.transferDuration;
      const remaining = Math.ceil(totalDur - (gameState.elapsed - launch.startTime));
      const age = gameState.elapsed - launch.startTime;
      const phase = age < launch.launchDuration ? 'LAUNCH' : 'INSERTION';
      satBtn.innerHTML = `<kbd>S</kbd> ${phase} ${remaining}s`;
      satBtn.disabled = true;
    } else if (count >= MAX_SATELLITES) {
      satBtn.innerHTML = `<kbd>S</kbd> SAT ${count}/${MAX_SATELLITES}`;
      satBtn.disabled = true;
    } else {
      satBtn.innerHTML = `<kbd>S</kbd> SAT ${count}/${MAX_SATELLITES} ${SATELLITE_LAUNCH_COST}◆`;
      satBtn.disabled = false;
    }
  }

  // Action button affordability
  const tokens = player.tokens;
  const currentType = getPlayerMissileType();
  const currentMtype = MISSILE_TYPES[currentType];
  const attackCost = currentMtype ? currentMtype.cost : 6; // base cost minimum

  const attackBtn = document.getElementById('btn-attack');
  if (attackBtn) attackBtn.style.opacity = tokens >= attackCost ? '' : '0.3';

  const deployBtn = document.getElementById('btn-deploy');
  const batteryCost = gameState.getBatteryCost(player.id);
  if (deployBtn) deployBtn.style.opacity = tokens >= batteryCost ? '' : '0.3';

  const buildBtn = document.getElementById('btn-build');
  const siloCount = player.launchSites.length;
  const siloCost = 15 + siloCount * 3;
  if (buildBtn) buildBtn.style.opacity = tokens >= siloCost ? '' : '0.3';

  // Claim alerts
  renderClaimAlerts();
}

function renderClaimAlerts() {
  const alertEl = document.getElementById('claim-alert');
  if (!alertEl) return;
  const claims = getClaimWindows();
  if (claims.length === 0) { alertEl.innerHTML = ''; return; }

  alertEl.innerHTML = claims.map(claim => {
    const remaining = Math.max(0, Math.ceil(claim.expiresAt - gameState.elapsed));
    const isPriority = claim.killerId === gameState.playerCountryId;
    return `
      <div class="claim-card">
        <span class="claim-text">⚑ ${claim.countryName}${isPriority ? ' (PRIORITY)' : ''}</span>
        <span class="claim-timer">${remaining}s</span>
        <button class="btn-claim" data-id="${claim.countryId}">CLAIM</button>
      </div>
    `;
  }).join('');

  alertEl.querySelectorAll('.btn-claim').forEach(btn => {
    btn.onclick = () => playerClaimTerritory(btn.dataset.id);
  });
}

function updateMissileSelector() {
  const current = getPlayerMissileType();
  const elapsed = gameState.elapsed || 0;
  const player = gameState.getPlayer();
  // Loaded count across all player silos
  const loaded = {};
  if (player) {
    for (const silo of player.launchSites) {
      for (const t in (silo.loadedMissiles || {})) {
        loaded[t] = (loaded[t] || 0) + silo.loadedMissiles[t];
      }
    }
  }
  document.querySelectorAll('.ms').forEach(btn => {
    const typeKey = btn.dataset.type;
    const mtype = MISSILE_TYPES[typeKey];
    const loadedCount = loaded[typeKey] || 0;
    const locked = mtype && mtype.unlockAt !== undefined && elapsed < mtype.unlockAt && loadedCount === 0;
    const notLoaded = mtype && !locked && loadedCount === 0;
    btn.classList.toggle('active', typeKey === current);
    btn.classList.toggle('locked', locked);
    btn.classList.toggle('unaffordable', notLoaded); // reuse existing "dim" style for "none loaded"
    btn.disabled = locked;
    if (locked) {
      const remaining = Math.ceil(mtype.unlockAt - elapsed);
      btn.title = `Unlocks in ${remaining}s`;
    } else if (mtype) {
      btn.title = `${mtype.name} — ${loadedCount} loaded. ${mtype.description}`;
    }
  });
}

function setIfChanged(id, value) {
  if (prevValues[id] === value) return;
  prevValues[id] = value;
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}
