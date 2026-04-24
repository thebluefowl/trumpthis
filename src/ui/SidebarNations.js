import { gameState } from '../state/GameState.js';
import { BLOCS } from '../state/countryData.js';
import { formatPop } from '../rendering/Globe.js';
import { isRevealed } from '../state/Intel.js';

let expandedId = null;

export function renderNationsTab(el) {
  const playerBlocId = gameState.playerBlocId;
  if (!playerBlocId) { el.innerHTML = ''; return; }

  const rows = Object.entries(BLOCS)
    .filter(([id]) => id !== playerBlocId)
    .map(([id, def]) => ({
      id,
      name: def.name,
      color: def.color,
      description: def.description,
      blocState: gameState.blocs.get(id),
      members: gameState.getBlocCountries(id),
    }))
    .map(bloc => {
      const alive = bloc.members.filter(c => !gameState.isEliminated(c.id));
      const totalPop = alive.reduce((s, c) => s + c.population, 0);
      const startingPop = bloc.members.reduce((s, c) => s + c.startingPopulation, 0);
      const pct = startingPop > 0 ? Math.max(0, totalPop / startingPop) : 0;
      const eliminated = alive.length === 0;

      // Reveal: bloc visible if ANY member has been spotted
      const anyRevealed = alive.some(c => isRevealed(c.id, 'batteries'));
      const hidden = '<span style="color:var(--text-dim);font-style:italic">UNKNOWN</span>';

      const tokens = bloc.blocState?.tokens ?? 0;
      const missilesOut = gameState.missiles.filter(m => gameState.getBlocId(m.fromCountryId) === bloc.id).length;
      const incoming = gameState.missiles.filter(m => gameState.getBlocId(m.toCountryId) === playerBlocId && gameState.getBlocId(m.fromCountryId) === bloc.id).length;

      // Battery count across the bloc
      const batteries = gameState.interceptors.filter(b => gameState.getBlocId(b.countryId) === bloc.id).length;

      // Stockpile (total missiles across bloc silos + unloaded)
      let stockpile = 0;
      for (const c of alive) {
        for (const s of c.launchSites) {
          for (const t in (s.loadedMissiles || {})) stockpile += s.loadedMissiles[t];
        }
      }
      if (bloc.blocState) {
        for (const t in bloc.blocState.stockpile) stockpile += bloc.blocState.stockpile[t];
      }

      const statusClass = eliminated ? 'eliminated' : 'hostile';
      const statusText = eliminated ? 'DESTROYED' : 'ACTIVE';
      const isExpanded = expandedId === bloc.id;

      const canCapture = !eliminated && gameState.canCaptureBloc(playerBlocId, bloc.id);
      const captureCost = canCapture ? gameState.getBlocCaptureCost(playerBlocId, bloc.id) : 0;
      const playerBloc = gameState.blocs.get(playerBlocId);
      const captureAffordable = canCapture && playerBloc && playerBloc.tokens >= captureCost;

      let expanded = '';
      if (isExpanded && !eliminated) {
        const memberList = bloc.members.map(c => {
          const dead = gameState.isEliminated(c.id);
          return `<span style="${dead ? 'color:var(--text-dim);text-decoration:line-through' : ''}">${c.name}</span>`;
        }).join(', ');

        expanded = `
          <div class="nation-expanded">
            <div class="sb-row"><span class="sb-row-label">Population</span><span class="sb-row-value">${formatPop(totalPop)} (${Math.round(pct * 100)}%)</span></div>
            <div class="sb-row"><span class="sb-row-label">Tokens</span><span class="sb-row-value">${anyRevealed ? Math.floor(tokens) + '◆' : hidden}</span></div>
            <div class="sb-row"><span class="sb-row-label">Batteries</span><span class="sb-row-value">${anyRevealed ? batteries : hidden}</span></div>
            <div class="sb-row"><span class="sb-row-label">Stockpile</span><span class="sb-row-value">${anyRevealed ? stockpile : hidden}</span></div>
            <div class="sb-row"><span class="sb-row-label">Missiles Out</span><span class="sb-row-value">${missilesOut}</span></div>
            <div class="sb-row"><span class="sb-row-label">Inbound to you</span><span class="sb-row-value">${incoming}</span></div>
            <div class="sb-row"><span class="sb-row-label">Members</span><span class="sb-row-value" style="font-size:10px;text-align:right;">${memberList}</span></div>
            <div class="sb-row" style="border-top:1px solid var(--panel-border);padding-top:6px;margin-top:4px;color:var(--text-dim);font-size:10px;">${bloc.description}</div>
            ${canCapture ? `<button class="sb-btn ${captureAffordable ? 'primary' : ''}" data-action="capture" data-bloc="${bloc.id}" ${captureAffordable ? '' : 'disabled'}>CAPTURE BLOC (${captureCost}◆)</button>` : ''}
          </div>
        `;
      }

      return `
        <div class="nation-row ${isExpanded ? 'expanded' : ''}" data-nation="${bloc.id}">
          <div class="nation-row-header">
            <div class="nation-dot" style="background: ${bloc.color}"></div>
            <div class="nation-name">${bloc.name}</div>
            <div class="nation-badge ${statusClass}">${statusText}</div>
          </div>
          <div class="nation-pop-bar"><div class="nation-pop-fill" style="width:${pct * 100}%; background:${eliminated ? 'var(--text-dim)' : pct > 0.5 ? bloc.color : pct > 0.25 ? 'var(--amber)' : 'var(--red)'}"></div></div>
          ${expanded}
        </div>
      `;
    }).join('');

  el.innerHTML = `<div class="sb-section"><div class="sb-section-title">Rival Blocs</div>${rows}</div>`;

  el.onclick = (e) => {
    const captureBtn = e.target.closest('[data-action="capture"]');
    if (captureBtn) {
      e.stopPropagation();
      const targetId = captureBtn.dataset.bloc;
      gameState.executeBlocCapture(playerBlocId, targetId);
      renderNationsTab(el);
      return;
    }
    const row = e.target.closest('.nation-row');
    if (!row) return;
    const id = row.dataset.nation;
    expandedId = expandedId === id ? null : id;
    renderNationsTab(el);
  };
}

export function resetNationsTab() {
  expandedId = null;
}
