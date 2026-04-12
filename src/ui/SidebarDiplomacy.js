import { gameState } from '../state/GameState.js';
import { acceptAlliance } from '../state/Diplomacy.js';

export function renderDiplomacyTab(el) {
  const playerId = gameState.playerCountryId;
  if (!playerId) { el.innerHTML = ''; return; }

  const myAllies = gameState.getAllies(playerId);
  const allAlliances = [...gameState.alliances].map(key => {
    const [a, b] = key.split(':');
    return { a: gameState.countries.get(a)?.name || a, b: gameState.countries.get(b)?.name || b };
  });

  // Pending proposals
  const incoming = gameState.proposals.filter(p => p.toId === playerId);
  const outgoing = gameState.proposals.filter(p => p.fromId === playerId);

  // Recent notifications (last 10)
  const notifs = gameState.notifications.slice(-10).reverse();

  el.innerHTML = `
    <div class="sb-section">
      <div class="sb-section-title">Your Alliances (${myAllies.length})</div>
      ${myAllies.length === 0 ? '<div style="font-size: 11px; color: var(--text-dim);">No allies</div>' :
        myAllies.map(id => {
          const c = gameState.countries.get(id);
          const rel = gameState.getRelationship(playerId, id);
          return `<div class="sb-row"><span class="sb-row-label">${c?.name || id}</span><span class="sb-row-value" style="color: var(--cyan)">+${rel}</span></div>`;
        }).join('')
      }
    </div>

    ${incoming.length > 0 ? `
    <div class="sb-section">
      <div class="sb-section-title">Incoming Proposals</div>
      ${incoming.map(p => {
        const name = gameState.countries.get(p.fromId)?.name || p.fromId;
        return `<div class="sb-row"><span class="sb-row-label">${name}</span><button class="sb-btn primary" data-accept="${p.fromId}" style="width:auto;padding:2px 8px;">Accept</button></div>`;
      }).join('')}
    </div>` : ''}

    ${outgoing.length > 0 ? `
    <div class="sb-section">
      <div class="sb-section-title">Outgoing Proposals</div>
      ${outgoing.map(p => `<div style="font-size: 11px; color: var(--text-dim);">→ ${gameState.countries.get(p.toId)?.name || p.toId} (pending)</div>`).join('')}
    </div>` : ''}

    <div class="sb-section">
      <div class="sb-section-title">Global Alliances (${allAlliances.length})</div>
      ${allAlliances.slice(0, 15).map(a =>
        `<div style="font-size: 11px; color: var(--text-dim); padding: 1px 0;">${a.a} — ${a.b}</div>`
      ).join('')}
      ${allAlliances.length > 15 ? `<div style="font-size: 10px; color: var(--text-dim);">+${allAlliances.length - 15} more</div>` : ''}
    </div>

    <div class="sb-section">
      <div class="sb-section-title">Recent Events</div>
      ${notifs.map(n =>
        `<div style="font-size: 11px; color: var(--${n.type === 'betrayal' ? 'red' : n.type === 'alliance' ? 'cyan' : 'text-dim'}); padding: 2px 0;">${n.text}</div>`
      ).join('')}
    </div>
  `;

  // Bind accept buttons
  el.querySelectorAll('[data-accept]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      acceptAlliance(playerId, btn.dataset.accept);
      renderDiplomacyTab(el);
    });
  });
}
