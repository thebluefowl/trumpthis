import { gameState } from '../state/GameState.js';
import { events } from '../state/events.js';
import { formatPop, switchProjection } from './Globe.js';
import { setPlayerMissileType, getPlayerMissileType } from '../ai/AIManager.js';
import { MISSILE_TYPES, ESCALATION_START, MATCH_TIMEOUT } from '../constants.js';
import { isEscalationActive, getTimeRemaining, getEscalationTick } from '../engine/Escalation.js';
import { getClaimWindows, playerClaimTerritory } from '../engine/Conquest.js';
import { TOKEN_RATES } from '../constants.js';
import { getTokenMultiplier } from '../engine/Escalation.js';

let prevValues = {};

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

  // Map toggle
  document.getElementById('btn-map')?.addEventListener('click', (e) => {
    e.stopPropagation();
    switchProjection();
  });

  // Missile type selectors
  document.querySelectorAll('.ms').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      setPlayerMissileType(btn.dataset.type);
      updateMissileSelector();
    });
  });

  // Number key shortcuts
  document.addEventListener('keydown', (e) => {
    if (gameState.phase !== 'PLAYING') return;
    const typeMap = { '1': 'tactical', '2': 'cruise', '3': 'icbm', '4': 'mirv', '5': 'emp', '6': 'hypersonic', '7': 'slbm', '8': 'dirty_bomb', '9': 'decoy', '0': 'drone', 'n': 'nuke' };
    if (typeMap[e.key]) {
      const mtype = MISSILE_TYPES[typeMap[e.key]];
      if (mtype && mtype.unlockAt !== undefined && gameState.elapsed < mtype.unlockAt) return;
      setPlayerMissileType(typeMap[e.key]);
      updateMissileSelector();
    }
  });
}

export function renderHUD() {
  if (gameState.phase !== 'PLAYING') return;
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
  document.querySelectorAll('.ms').forEach(btn => {
    const typeKey = btn.dataset.type;
    const mtype = MISSILE_TYPES[typeKey];
    const locked = mtype && mtype.unlockAt !== undefined && elapsed < mtype.unlockAt;
    btn.classList.toggle('active', typeKey === current);
    btn.classList.toggle('locked', locked);
    btn.disabled = locked;
    if (locked) {
      const remaining = Math.ceil(mtype.unlockAt - elapsed);
      btn.title = `Unlocks in ${remaining}s`;
    } else if (mtype) {
      btn.title = `${mtype.name} — ${mtype.cost}◆. ${mtype.description}`;
    }
  });
}

function setIfChanged(id, value) {
  if (prevValues[id] === value) return;
  prevValues[id] = value;
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}
