import { gameState } from '../state/GameState.js';
import { events } from '../state/events.js';
import { proposeAlliance, breakAllianceBetween, acceptAlliance } from '../state/Diplomacy.js';
import { formatPop } from '../rendering/Globe.js';
import { REL_ALLIED_THRESHOLD } from '../constants.js';

let panelEl, listEl, notifsEl;
let visible = false;
let lastRenderTime = 0;

export function initDiplomacyPanel() {
  panelEl = document.getElementById('diplomacy-panel');
  listEl = document.getElementById('diplo-list');
  notifsEl = document.getElementById('diplo-notifications');

  document.getElementById('diplo-close').addEventListener('click', togglePanel);
  document.getElementById('btn-diplo').addEventListener('click', (e) => {
    e.stopPropagation();
    togglePanel();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Tab' && gameState.phase === 'PLAYING') {
      e.preventDefault();
      togglePanel();
    }
  });
}

export function togglePanel() {
  visible = !visible;
  panelEl.style.display = visible ? 'flex' : 'none';
  if (visible) renderPanel();
}

export function renderDiplomacyPanel() {
  if (!visible) return;
  // Throttle to 4 fps
  const now = performance.now();
  if (now - lastRenderTime < 250) return;
  lastRenderTime = now;
  renderPanel();
}

function renderPanel() {
  if (!listEl || !notifsEl) return;
  const playerId = gameState.playerCountryId;
  if (!playerId) return;

  // Notifications
  const recentNotifs = gameState.notifications.slice(-5);
  notifsEl.innerHTML = recentNotifs.map(n =>
    `<div class="diplo-notif ${n.type}">${n.text}</div>`
  ).join('');

  // Pending proposals for the player
  const playerProposals = gameState.proposals.filter(p => p.toId === playerId);

  // Nation list sorted by relationship
  const nations = gameState.getActiveCountries()
    .filter(c => c.id !== playerId)
    .map(c => ({
      ...c,
      rel: gameState.getRelationship(playerId, c.id),
      allied: gameState.isAllied(playerId, c.id),
      eliminated: gameState.isEliminated(c.id),
      hasProposal: playerProposals.some(p => p.fromId === c.id),
    }))
    .sort((a, b) => {
      if (a.eliminated !== b.eliminated) return a.eliminated ? 1 : -1;
      if (a.allied !== b.allied) return a.allied ? -1 : 1;
      return b.rel - a.rel;
    });

  // Also include eliminated nations at the bottom
  const eliminatedNations = [...gameState.eliminated]
    .map(id => gameState.countries.get(id))
    .filter(c => c && c.id !== playerId);

  listEl.innerHTML = nations.map(c => {
    const relPct = (c.rel + 100) / 200; // 0 to 1
    const statusClass = c.eliminated ? 'eliminated' : c.allied ? 'allied' : c.rel <= -50 ? 'hostile' : 'neutral';
    const statusText = c.eliminated ? 'DEAD' : c.allied ? 'ALLIED' : c.rel <= -50 ? 'HOSTILE' : 'NEUTRAL';
    const relColor = c.rel > 0 ? '#00ccff' : c.rel < 0 ? '#ff3333' : '#666';
    const popPct = c.startingPopulation > 0 ? (c.population / c.startingPopulation * 100).toFixed(0) : 0;

    let actions = '';
    if (!c.eliminated) {
      if (c.allied) {
        actions = `<button class="diplo-btn break" data-action="break" data-id="${c.id}">BREAK ALLIANCE</button>`;
      } else if (c.hasProposal) {
        actions = `<button class="diplo-btn" data-action="accept" data-id="${c.id}">ACCEPT ALLIANCE</button>`;
      } else if (c.rel >= REL_ALLIED_THRESHOLD) {
        actions = `<button class="diplo-btn" data-action="propose" data-id="${c.id}">PROPOSE ALLIANCE</button>`;
      }
    }

    return `
      <div class="diplo-nation ${c.eliminated ? 'eliminated' : ''}">
        <div class="diplo-nation-header">
          <div class="diplo-nation-dot" style="background: ${relColor}"></div>
          <div class="diplo-nation-name">${c.name}</div>
          <div class="diplo-nation-status ${statusClass}">${statusText}</div>
        </div>
        <div class="diplo-rel-bar">
          <div class="diplo-rel-fill" style="
            left: ${Math.min(relPct, 0.5) * 100}%;
            width: ${Math.abs(relPct - 0.5) * 100}%;
            background: ${relColor};
          "></div>
        </div>
        <div class="diplo-pop-text">Pop: ${formatPop(c.population)} (${popPct}%)</div>
        <div class="diplo-actions">${actions}</div>
      </div>
    `;
  }).join('');

  // Bind action buttons
  listEl.querySelectorAll('.diplo-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const action = e.target.dataset.action;
      const targetId = e.target.dataset.id;
      if (action === 'propose') proposeAlliance(playerId, targetId);
      else if (action === 'accept') acceptAlliance(playerId, targetId);
      else if (action === 'break') breakAllianceBetween(playerId, targetId);
      renderPanel();
    });
  });
}

export function resetDiplomacyPanel() {
  visible = false;
  if (panelEl) panelEl.style.display = 'none';
}
