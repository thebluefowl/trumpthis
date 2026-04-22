import { COUNTRIES, COUNTRY_MAP, COUNTRY_BLOC, BLOCS } from '../state/countryData.js';
import { gameState } from '../state/GameState.js';
import { events } from '../state/events.js';
import { rotateTo, formatPop } from '../rendering/Globe.js';

let sidebarEl = null;
let listEl = null;
let locked = false; // true after country is picked — prevents re-selection during alliance phase

export function initCountrySelect() {
  sidebarEl = document.getElementById('setup-sidebar-content');

  events.on('country:click', (data) => {
    if (gameState.phase !== 'SELECT') return;
    if (locked) return;
    data.consumed = true;
    selectCountry(data.id);
  });

  events.on('country:hover', ({ id }) => {
    if (gameState.phase !== 'SELECT') return;
    if (locked) return;
    highlightCountry(id);
    highlightListItem(id);
  });

  events.on('country:hoverend', () => {
    if (gameState.phase !== 'SELECT') return;
    if (locked) return;
    clearHighlight();
    clearListHighlight();
  });
}

export function showCountrySelect() {
  if (!sidebarEl) return;

  const tierLabels = { 1: 'T1', 2: 'T2', 3: 'T3' };
  const sorted = [...COUNTRIES].sort((a, b) => {
    if (a.tier !== b.tier) return a.tier - b.tier;
    return a.name.localeCompare(b.name);
  });

  sidebarEl.innerHTML = `
    <div class="setup-header">
      <button class="setup-back" id="btn-back-briefing">BACK</button>
      <div class="setup-title" style="flex:1; text-align:right;">SELECT NATION</div>
    </div>
    <div class="setup-list" id="country-list">
      ${sorted.map(c => `
        <div class="country-pick" data-id="${c.id}">
          <div class="country-pick-dot t${c.tier}"></div>
          <div class="country-pick-name">${c.name}</div>
          <div class="country-pick-tier">${tierLabels[c.tier]}</div>
        </div>
      `).join('')}
    </div>
  `;

  listEl = document.getElementById('country-list');

  listEl.querySelectorAll('.country-pick').forEach(el => {
    el.addEventListener('click', () => {
      // Center on the country before selecting
      const country = COUNTRY_MAP.get(el.dataset.id);
      if (country) rotateTo(country.centroid, 600);
      selectCountry(el.dataset.id);
    });
    el.addEventListener('mouseenter', () => {
      highlightCountry(el.dataset.id);
      highlightListItem(el.dataset.id);
    });
    el.addEventListener('mouseleave', () => {
      clearHighlight();
      clearListHighlight();
    });
  });

  // Back button
  document.getElementById('btn-back-briefing')?.addEventListener('click', () => {
    events.emit('nav:back-to-briefing');
  });
}

function highlightCountry(id) {
  const svgEl = document.getElementById('globe');
  if (!svgEl) return;
  svgEl.querySelectorAll('.country').forEach(path => {
    const pathId = path.getAttribute('data-id');
    if (pathId === id) {
      path.style.fill = '#1a2a44';
      path.style.stroke = '#38bdf8';
      path.style.strokeWidth = '1.2';
    } else {
      path.style.fill = '';
      path.style.stroke = '';
      path.style.strokeWidth = '';
    }
  });
}

function clearHighlight() {
  const svgEl = document.getElementById('globe');
  if (!svgEl) return;
  svgEl.querySelectorAll('.country').forEach(path => {
    path.style.fill = '';
    path.style.stroke = '';
    path.style.strokeWidth = '';
  });
}

function highlightListItem(id) {
  if (!listEl) return;
  listEl.querySelectorAll('.country-pick').forEach(el => {
    el.classList.toggle('hovered', el.dataset.id === id);
  });
  const item = listEl.querySelector(`.country-pick[data-id="${id}"]`);
  if (item) item.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
}

function clearListHighlight() {
  if (!listEl) return;
  listEl.querySelectorAll('.country-pick').forEach(el => el.classList.remove('hovered'));
}

function selectCountry(id) {
  const country = COUNTRY_MAP.get(id);
  if (!country) return;
  locked = true;
  gameState.playerCountryId = id;
  rotateTo(country.centroid, 800);
  events.emit('game:start');
}

export function resetCountrySelect() {
  listEl = null;
  locked = false;
}
