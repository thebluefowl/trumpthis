import { gameState } from '../state/GameState.js';
import { formatPop } from '../rendering/Globe.js';
import { proposeAlliance, breakAllianceBetween, acceptAlliance } from '../state/Diplomacy.js';
import { REL_ALLIED_THRESHOLD } from '../constants.js';

let expandedId = null;

export function renderNationsTab(el) {
  const playerId = gameState.playerCountryId;
  if (!playerId) { el.innerHTML = ''; return; }

  const nations = [...gameState.countries.values()]
    .filter(c => c.id !== playerId)
    .map(c => ({
      ...c,
      rel: gameState.getRelationship(playerId, c.id),
      allied: gameState.isAllied(playerId, c.id),
      elim: gameState.isEliminated(c.id),
    }))
    .sort((a, b) => {
      if (a.elim !== b.elim) return a.elim ? 1 : -1;
      if (a.allied !== b.allied) return a.allied ? -1 : 1;
      return b.rel - a.rel;
    });

  const playerProposals = gameState.proposals.filter(p => p.toId === playerId);

  el.innerHTML = nations.map(c => {
    const popPct = c.startingPopulation > 0 ? (c.population / c.startingPopulation * 100) : 0;
    const relColor = c.rel > 0 ? 'var(--cyan)' : c.rel < -30 ? 'var(--red)' : 'var(--text-dim)';
    const statusClass = c.elim ? 'eliminated' : c.allied ? 'allied' : c.rel <= -50 ? 'hostile' : 'neutral';
    const statusText = c.elim ? 'DEAD' : c.allied ? 'ALLY' : c.rel <= -50 ? 'HOSTILE' : 'NEUTRAL';
    const hasProposal = playerProposals.some(p => p.fromId === c.id);
    const isExpanded = expandedId === c.id;

    let expanded = '';
    if (isExpanded && !c.elim) {
      const inFlight = gameState.missiles.filter(m => m.fromCountryId === c.id).length;
      const incoming = gameState.missiles.filter(m => m.toCountryId === c.id).length;
      const batteries = gameState.getBatteryCount(c.id);
      const allies = gameState.getAllies(c.id).map(id => gameState.countries.get(id)?.name).filter(Boolean);

      let actionBtn = '';
      if (c.allied) {
        actionBtn = `<button class="sb-btn danger" data-action="break" data-id="${c.id}">Break Alliance</button>`;
      } else if (hasProposal) {
        actionBtn = `<button class="sb-btn primary" data-action="accept" data-id="${c.id}">Accept Alliance</button>`;
      } else if (c.rel >= REL_ALLIED_THRESHOLD) {
        actionBtn = `<button class="sb-btn accent" data-action="propose" data-id="${c.id}">Propose Alliance</button>`;
      }

      expanded = `
        <div class="nation-expanded">
          <div class="sb-row"><span class="sb-row-label">Relationship</span><span class="sb-row-value" style="color:${relColor}">${c.rel > 0 ? '+' : ''}${c.rel}</span></div>
          <div class="sb-row"><span class="sb-row-label">Population</span><span class="sb-row-value">${formatPop(c.population)} (${popPct.toFixed(0)}%)</span></div>
          <div class="sb-row"><span class="sb-row-label">Tier</span><span class="sb-row-value">${c.tier}</span></div>
          <div class="sb-row"><span class="sb-row-label">Batteries</span><span class="sb-row-value">${batteries}</span></div>
          <div class="sb-row"><span class="sb-row-label">Missiles Out</span><span class="sb-row-value">${inFlight}</span></div>
          <div class="sb-row"><span class="sb-row-label">Incoming</span><span class="sb-row-value">${incoming}</span></div>
          <div class="sb-row"><span class="sb-row-label">Launched</span><span class="sb-row-value">${c.combatStats.missilesLaunched}</span></div>
          <div class="sb-row"><span class="sb-row-label">Dmg Dealt</span><span class="sb-row-value">${formatPop(c.combatStats.damageDealt)}</span></div>
          <div class="sb-row"><span class="sb-row-label">Allies</span><span class="sb-row-value">${allies.length > 0 ? allies.slice(0, 3).join(', ') : 'None'}</span></div>
          ${actionBtn}
        </div>
      `;
    }

    return `
      <div class="nation-row ${isExpanded ? 'expanded' : ''}" data-nation="${c.id}">
        <div class="nation-row-header">
          <div class="nation-dot" style="background: ${relColor}"></div>
          <div class="nation-name">${c.name}</div>
          <div class="nation-badge ${statusClass}">${statusText}</div>
          ${hasProposal ? '<div class="nation-badge allied">OFFER</div>' : ''}
        </div>
        <div class="nation-pop-bar"><div class="nation-pop-fill" style="width:${popPct}%; background:${c.elim ? 'var(--text-dim)' : popPct > 50 ? 'var(--green)' : popPct > 25 ? 'var(--amber)' : 'var(--red)'}"></div></div>
        ${expanded}
      </div>
    `;
  }).join('');

  // Bind click to expand/collapse
  el.querySelectorAll('.nation-row').forEach(row => {
    row.addEventListener('click', (e) => {
      if (e.target.closest('.sb-btn')) return; // don't toggle when clicking action buttons
      const id = row.dataset.nation;
      expandedId = expandedId === id ? null : id;
      renderNationsTab(el);
    });
  });

  // Bind action buttons
  el.querySelectorAll('.sb-btn[data-action]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const action = btn.dataset.action;
      const targetId = btn.dataset.id;
      if (action === 'propose') proposeAlliance(playerId, targetId);
      else if (action === 'accept') acceptAlliance(playerId, targetId);
      else if (action === 'break') breakAllianceBetween(playerId, targetId);
      renderNationsTab(el);
    });
  });
}
