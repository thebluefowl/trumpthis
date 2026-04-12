import { gameState } from '../state/GameState.js';
import { events } from '../state/events.js';
import { COUNTRY_BLOC, BLOCS } from '../state/countryData.js';
import { formatPop } from '../rendering/Globe.js';
import { proposeAlliance, breakAllianceBetween, acceptAlliance } from '../state/Diplomacy.js';
import { REL_ALLIED_THRESHOLD } from '../constants.js';
import { getMode } from './LaunchUI.js';

let panelEl = null;
let currentNationId = null;

export function initNationStats() {
  panelEl = document.getElementById('nation-stats');

  document.getElementById('nation-stats-close').addEventListener('click', hideNationStats);

  events.on('country:click', (data) => {
    if (data.consumed) return; // already handled by LaunchUI
    if (gameState.phase !== 'PLAYING') return;
    if (getMode() !== 'IDLE') return;
    // Allow viewing own stats too
    showNationStats(data.id);
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && panelEl.classList.contains('visible')) {
      hideNationStats();
    }
  });
}

export function showNationStats(countryId) {
  currentNationId = countryId;
  renderNationStats();
  panelEl.classList.add('visible');
}

export function hideNationStats() {
  currentNationId = null;
  panelEl.classList.remove('visible');
}

export function updateNationStats() {
  if (!currentNationId || !panelEl.classList.contains('visible')) return;
  renderNationStats();
}

function renderNationStats() {
  const country = gameState.countries.get(currentNationId);
  if (!country) return;

  const playerId = gameState.playerCountryId;
  const rel = gameState.getRelationship(playerId, currentNationId);
  const allied = gameState.isAllied(playerId, currentNationId);
  const eliminated = gameState.isEliminated(currentNationId);
  const tierLabels = { 1: 'Superpower', 2: 'Major Power', 3: 'Regional Power' };
  const blocId = COUNTRY_BLOC.get(currentNationId);
  const bloc = blocId ? BLOCS[blocId] : null;
  const popPct = (country.population / country.startingPopulation * 100).toFixed(1);
  const allies = gameState.getAllies(currentNationId);
  const allyNames = allies.map(id => gameState.countries.get(id)?.name).filter(Boolean);
  const batteries = gameState.getBatteryCount(currentNationId);
  const maxBatteries = gameState.getMaxBatteries(currentNationId);
  const activeSites = country.launchSites.filter(s => !s.disabled).length;
  const inFlightFrom = gameState.missiles.filter(m => m.fromCountryId === currentNationId).length;
  const inFlightTo = gameState.missiles.filter(m => m.toCountryId === currentNationId).length;

  // Status
  let statusText, statusClass;
  if (eliminated) { statusText = 'ELIMINATED'; statusClass = 'eliminated'; }
  else if (allied) { statusText = 'ALLIED'; statusClass = 'allied'; }
  else if (rel <= -50) { statusText = 'HOSTILE'; statusClass = 'hostile'; }
  else if (rel > 0) { statusText = 'FRIENDLY'; statusClass = 'neutral'; }
  else { statusText = 'NEUTRAL'; statusClass = 'neutral'; }

  // Relationship bar color
  const relColor = rel > 0 ? '#00ccff' : rel < 0 ? '#ff3333' : '#666';
  const relPct = (rel + 100) / 2; // 0-100 scale

  // Pending proposal?
  const hasProposal = gameState.proposals.some(p => p.fromId === currentNationId && p.toId === playerId);

  // Action buttons
  let actions = '';
  if (!eliminated && currentNationId !== playerId) {
    if (allied) {
      actions = `<button class="ns-btn break" id="ns-break">BREAK ALLIANCE</button>`;
    } else if (hasProposal) {
      actions = `<button class="ns-btn" id="ns-accept">ACCEPT ALLIANCE</button>`;
    } else if (rel >= REL_ALLIED_THRESHOLD) {
      actions = `<button class="ns-btn" id="ns-propose">PROPOSE ALLIANCE</button>`;
    }
  }

  const content = document.getElementById('nation-stats-content');
  content.innerHTML = `
    <div class="ns-header">
      <div class="ns-name">${country.name}</div>
      <div class="ns-status ${statusClass}">${statusText}</div>
    </div>
    <div class="ns-tier">${tierLabels[country.tier]}${bloc ? ` — ${bloc.name}` : ''}</div>

    <div class="ns-section">
      <div class="ns-section-title">POPULATION</div>
      <div class="ns-bar-container">
        <div class="ns-bar" style="width: ${popPct}%; background: ${eliminated ? '#333' : popPct > 50 ? '#00ff88' : popPct > 25 ? '#ffcc00' : '#ff3333'}"></div>
      </div>
      <div class="ns-row"><span>Current</span><span>${formatPop(country.population)}</span></div>
      <div class="ns-row"><span>Health</span><span>${popPct}%</span></div>
      <div class="ns-row"><span>Starting</span><span>${formatPop(country.startingPopulation)}</span></div>
    </div>

    <div class="ns-section">
      <div class="ns-section-title">MILITARY</div>
      <div class="ns-row"><span>Launch Sites</span><span>${activeSites}/${country.launchSites.length}</span></div>
      <div class="ns-row"><span>Interceptors</span><span>${batteries}/${maxBatteries}</span></div>
      <div class="ns-row"><span>Tokens</span><span>${Math.floor(country.tokens)}</span></div>
      <div class="ns-row"><span>Missiles Out</span><span>${inFlightFrom}</span></div>
      <div class="ns-row"><span>Incoming</span><span>${inFlightTo}</span></div>
    </div>

    <div class="ns-section">
      <div class="ns-section-title">DIPLOMACY</div>
      <div class="ns-rel-row">
        <span>Relationship</span>
        <span style="color: ${relColor}">${rel > 0 ? '+' : ''}${rel}</span>
      </div>
      <div class="ns-bar-container">
        <div class="ns-bar-center">
          <div class="ns-bar-fill" style="
            left: ${Math.min(relPct, 50)}%;
            width: ${Math.abs(relPct - 50)}%;
            background: ${relColor};
          "></div>
        </div>
      </div>
      <div class="ns-row"><span>Allies</span><span>${allyNames.length > 0 ? allyNames.slice(0, 3).join(', ') + (allyNames.length > 3 ? ` +${allyNames.length - 3}` : '') : 'None'}</span></div>
    </div>

    <div class="ns-section">
      <div class="ns-section-title">COMBAT HISTORY</div>
      <div class="ns-row"><span>Missiles Launched</span><span>${country.combatStats.missilesLaunched}</span></div>
      <div class="ns-row"><span>Intercepted</span><span>${country.combatStats.missilesIntercepted}</span></div>
      <div class="ns-row"><span>Damage Dealt</span><span>${formatPop(country.combatStats.damageDealt)}</span></div>
      <div class="ns-row"><span>Damage Taken</span><span>${formatPop(country.combatStats.damageTaken)}</span></div>
    </div>

    <div class="ns-actions">
      ${actions}
      ${currentNationId === playerId ? '<button class="ns-btn surrender" id="ns-surrender">SURRENDER</button>' : ''}
    </div>
  `;

  // Bind buttons
  const breakBtn = document.getElementById('ns-break');
  if (breakBtn) breakBtn.addEventListener('click', () => {
    breakAllianceBetween(playerId, currentNationId);
    renderNationStats();
  });

  const proposeBtn = document.getElementById('ns-propose');
  if (proposeBtn) proposeBtn.addEventListener('click', () => {
    proposeAlliance(playerId, currentNationId);
    renderNationStats();
  });

  const acceptBtn = document.getElementById('ns-accept');
  if (acceptBtn) acceptBtn.addEventListener('click', () => {
    acceptAlliance(playerId, currentNationId);
    renderNationStats();
  });

  const surrenderBtn = document.getElementById('ns-surrender');
  if (surrenderBtn) surrenderBtn.addEventListener('click', () => {
    if (confirm('Are you sure you want to surrender?')) {
      gameState.eliminateCountry(playerId);
      gameState.phase = 'GAME_OVER';
      hideNationStats();
      events.emit('game:over', { result: 'defeat' });
    }
  });
}

export function resetNationStats() {
  hideNationStats();
  currentNationId = null;
}
