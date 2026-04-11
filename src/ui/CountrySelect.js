import { COUNTRIES, COUNTRY_MAP } from '../state/countryData.js';
import { gameState } from '../state/GameState.js';
import { events } from '../state/events.js';
import { rotateTo, formatPop } from '../rendering/Globe.js';

let selectedId = null;
let panelEl = null;

export function initCountrySelect() {
  panelEl = document.getElementById('select-panel');

  events.on('country:click', ({ id }) => {
    if (gameState.phase !== 'SELECT') return;
    selectCountry(id);
  });
}

function selectCountry(id) {
  const country = COUNTRY_MAP.get(id);
  if (!country) return;

  selectedId = id;
  gameState.playerCountryId = id;

  // Auto-pick AI: pick a different country of similar tier
  const candidates = COUNTRIES.filter(c => c.id !== id);
  // Prefer same or adjacent tier
  const sameTier = candidates.filter(c => c.tier === country.tier);
  const aiCountry = sameTier.length > 0
    ? sameTier[Math.floor(Math.random() * sameTier.length)]
    : candidates[Math.floor(Math.random() * candidates.length)];

  gameState.aiCountryId = aiCountry.id;

  // Rotate globe to selected country
  rotateTo(country.centroid, 800);

  // Update panel
  const tierLabels = { 1: 'Superpower', 2: 'Major Power', 3: 'Regional Power' };
  panelEl.innerHTML = `
    <div class="country-name">${country.name}</div>
    <div class="stats">
      <div>Tier: <span>${tierLabels[country.tier]}</span></div>
      <div>Population: <span>${formatPop(country.population)}</span></div>
      <div>Launch Sites: <span>${country.launchSites.length}</span></div>
    </div>
    <div style="color: #666; font-size: 12px; margin-bottom: 12px;">
      vs <span style="color: #ff3333;">${aiCountry.name}</span> (${tierLabels[aiCountry.tier]})
    </div>
    <button class="btn-launch" id="btn-start-game">LAUNCH GAME</button>
  `;
  panelEl.classList.add('visible');

  // Bind launch button
  document.getElementById('btn-start-game').addEventListener('click', () => {
    events.emit('game:start');
  });
}

export function resetCountrySelect() {
  selectedId = null;
  if (panelEl) {
    panelEl.classList.remove('visible');
    panelEl.innerHTML = '';
  }
}
