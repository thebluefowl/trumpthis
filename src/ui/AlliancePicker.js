import { BLOCS, COUNTRY_MAP, COUNTRY_BLOC } from '../state/countryData.js';
import { gameState } from '../state/GameState.js';
import { events } from '../state/events.js';

let sidebarEl = null;

export function initAlliancePicker() {
  sidebarEl = document.getElementById('setup-sidebar-content');
}

export function showAlliancePicker(selectedCountryId) {
  if (!sidebarEl) return;

  const playerBloc = COUNTRY_BLOC.get(selectedCountryId) || 'independent';

  let html = '<div class="picker-title">CHOOSE ALLIANCE</div>';
  html += '<div class="picker-subtitle">Select a bloc to join or go solo</div>';
  html += '<div class="bloc-list">';

  for (const [blocId, bloc] of Object.entries(BLOCS)) {
    const isDefault = blocId === playerBloc;
    const memberNames = bloc.members
      .map(id => COUNTRY_MAP.get(id)?.name)
      .filter(Boolean);

    html += `
      <div class="bloc-card ${isDefault ? 'default' : ''}" data-bloc="${blocId}">
        <div class="bloc-header">
          <div class="bloc-dot" style="background: ${bloc.color}"></div>
          <div class="bloc-name">${bloc.name}</div>
          ${isDefault ? '<span class="bloc-badge">DEFAULT</span>' : ''}
        </div>
        <div class="bloc-desc">${bloc.description}</div>
        ${memberNames.length > 0 ? `<div class="bloc-members">${memberNames.join(', ')}</div>` : ''}
      </div>
    `;
  }

  html += '</div>';
  sidebarEl.innerHTML = html;

  // Highlight default bloc on map
  highlightBloc(playerBloc);

  // Bind card clicks and hovers
  sidebarEl.querySelectorAll('.bloc-card').forEach(card => {
    card.addEventListener('click', () => {
      clearHighlight();
      events.emit('bloc:selected', card.dataset.bloc);
    });

    card.addEventListener('mouseenter', () => {
      highlightBloc(card.dataset.bloc);
    });

    card.addEventListener('mouseleave', () => {
      highlightBloc(playerBloc);
    });
  });
}

function highlightBloc(blocId) {
  const svgEl = document.getElementById('globe');
  if (!svgEl) return;

  const bloc = BLOCS[blocId];
  const members = bloc ? new Set(bloc.members) : new Set();

  svgEl.querySelectorAll('.country').forEach(path => {
    const id = path.getAttribute('data-id');
    if (id === gameState.playerCountryId) {
      path.style.fill = '#1a2a44';
      path.style.stroke = '#38bdf8';
      path.style.strokeWidth = '1.2';
    } else if (members.has(id)) {
      path.style.fill = '#142030';
      path.style.stroke = bloc.color;
      path.style.strokeWidth = '1';
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

export function hideAlliancePicker() {
  // No-op — sidebar content just gets replaced
}
