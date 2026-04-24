import { gameState } from '../state/GameState.js';
import { formatPop, renderPaths } from '../rendering/Globe.js';
import { isRevealed } from '../state/Intel.js';
import { getPersonalityName } from '../ai/Personalities.js';

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
      const seeBatteries = isRevealed(c.id, 'batteries');
      const seeTokens = isRevealed(c.id, 'tokens');
      const seeResearch = isRevealed(c.id, 'research');
      const hidden = '<span style="color:var(--text-dim);font-style:italic">UNKNOWN</span>';

      const inFlight = gameState.missiles.filter(m => m.fromCountryId === c.id).length;
      const incoming = gameState.missiles.filter(m => m.toCountryId === c.id).length;
      const batteries = seeBatteries ? gameState.getBatteryCount(c.id) : null;
      const canInvade = gameState.canInvade(playerId, c.id);
      const invasionCost = canInvade ? gameState.getInvasionCost(playerId, c.id) : 0;
      let invadeBtn = '';
      if (canInvade) {
        const player = gameState.getPlayer();
        const affordable = player && player.tokens >= invasionCost;
        invadeBtn = `<button class="sb-btn ${affordable ? 'primary' : ''}" data-action="invade" data-id="${c.id}" ${affordable ? '' : 'disabled'}>
          INVADE (${invasionCost}◆)
        </button>`;
      }

      expanded = `
        <div class="nation-expanded">
          <div class="sb-row"><span class="sb-row-label">Relationship</span><span class="sb-row-value" style="color:${relColor}">${c.rel > 0 ? '+' : ''}${c.rel}</span></div>
          <div class="sb-row"><span class="sb-row-label">Population</span><span class="sb-row-value">${formatPop(c.population)} (${popPct.toFixed(0)}%)</span></div>
          <div class="sb-row"><span class="sb-row-label">Tier</span><span class="sb-row-value">${c.tier}</span></div>
          <div class="sb-row"><span class="sb-row-label">Doctrine</span><span class="sb-row-value">${getPersonalityName(c.id)}</span></div>
          <div class="sb-row"><span class="sb-row-label">Tokens</span><span class="sb-row-value">${seeTokens ? Math.floor(c.tokens) + '◆' : hidden}</span></div>
          <div class="sb-row"><span class="sb-row-label">Batteries</span><span class="sb-row-value">${batteries !== null ? batteries : hidden}</span></div>
          <div class="sb-row"><span class="sb-row-label">Missiles Out</span><span class="sb-row-value">${inFlight}</span></div>
          <div class="sb-row"><span class="sb-row-label">Incoming</span><span class="sb-row-value">${incoming}</span></div>
          <div class="sb-row"><span class="sb-row-label">Launched</span><span class="sb-row-value">${c.combatStats.missilesLaunched}</span></div>
          <div class="sb-row"><span class="sb-row-label">Dmg Dealt</span><span class="sb-row-value">${formatPop(c.combatStats.damageDealt)}</span></div>
          ${invadeBtn}
        </div>
      `;
    }

    return `
      <div class="nation-row ${isExpanded ? 'expanded' : ''}" data-nation="${c.id}">
        <div class="nation-row-header">
          <div class="nation-dot" style="background: ${relColor}"></div>
          <div class="nation-name">${c.name}</div>
          <div class="nation-badge ${statusClass}">${statusText}</div>
        </div>
        <div class="nation-pop-bar"><div class="nation-pop-fill" style="width:${popPct}%; background:${c.elim ? 'var(--text-dim)' : popPct > 50 ? 'var(--green)' : popPct > 25 ? 'var(--amber)' : 'var(--red)'}"></div></div>
        ${expanded}
      </div>
    `;
  }).join('');

  // Event delegation — survives re-renders
  el.onclick = (e) => {
    // Action buttons
    const actionBtn = e.target.closest('.sb-btn[data-action]');
    if (actionBtn) {
      e.stopPropagation();
      const action = actionBtn.dataset.action;
      const targetId = actionBtn.dataset.id;
      if (action === 'invade') {
        const success = gameState.executeInvasion(playerId, targetId);
        if (success) {
          const targetName = gameState.countries.get(targetId)?.name || 'Unknown';
          gameState.addNotification(`You have invaded and annexed ${targetName}!`, 'elimination');
          renderPaths();
        }
      }
      renderNationsTab(el);
      return;
    }

    // Expand/collapse nation rows
    const row = e.target.closest('.nation-row');
    if (row) {
      const id = row.dataset.nation;
      expandedId = expandedId === id ? null : id;
      renderNationsTab(el);
    }
  };
}
