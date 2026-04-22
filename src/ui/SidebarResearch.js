import { gameState } from '../state/GameState.js';
import { TECH_DEFS, BRANCHES, BRANCH_NAMES, BRANCH_COLORS } from '../state/TechTree.js';
import { startResearch, getCurrentResearch, getCompletedTechs, canResearch } from '../engine/ResearchSystem.js';

export function renderResearchTab(el) {
  const playerId = gameState.playerCountryId;
  if (!playerId) { el.innerHTML = ''; return; }

  const current = getCurrentResearch(playerId);
  const completed = getCompletedTechs(playerId);
  const player = gameState.getPlayer();

  let html = '';

  // Current research
  if (current) {
    const pct = (current.progress * 100).toFixed(0);
    html += `
      <div class="sb-section">
        <div class="sb-section-title">Researching</div>
        <div style="font-size: 13px; font-weight: 500; color: var(--text-bright);">${current.tech.name}</div>
        <div class="sb-bar" style="margin: 6px 0;"><div class="sb-bar-fill cyan" style="width: ${pct}%"></div></div>
        <div class="sb-row"><span class="sb-row-label">Progress</span><span class="sb-row-value">${pct}%</span></div>
        <div style="font-size: 11px; color: var(--text-dim); margin-top: 2px;">${current.tech.desc}</div>
      </div>
    `;
  }

  // Tech tree by branch
  for (const branch of BRANCHES) {
    const color = BRANCH_COLORS[branch];
    const branchTechs = Object.entries(TECH_DEFS)
      .filter(([, t]) => t.branch === branch)
      .sort((a, b) => a[1].tier - b[1].tier);

    html += `<div class="sb-section">
      <div class="sb-section-title" style="border-bottom-color: ${color};">${BRANCH_NAMES[branch]}</div>`;

    for (const [techId, tech] of branchTechs) {
      const isDone = completed.has(techId);
      const canStart = canResearch(playerId, techId);
      const isCurrentTech = current?.techId === techId;
      const canAfford = player.tokens >= tech.cost;
      const prereqMet = !tech.requires || completed.has(tech.requires);

      let status, statusColor;
      if (isDone) { status = '✓ DONE'; statusColor = 'var(--green-bright)'; }
      else if (isCurrentTech) { status = 'IN PROGRESS'; statusColor = 'var(--cyan)'; }
      else if (!prereqMet) { status = 'LOCKED'; statusColor = 'var(--text-dim)'; }
      else if (canStart && canAfford) { status = `${tech.cost}◆ ${tech.time}s`; statusColor = 'var(--gold)'; }
      else if (canStart) { status = `${tech.cost}◆`; statusColor = 'var(--text-dim)'; }
      else { status = 'WAIT'; statusColor = 'var(--text-dim)'; }

      html += `
        <div style="padding: 4px 0; opacity: ${isDone || canStart || isCurrentTech ? 1 : 0.5};">
          <div class="sb-row">
            <span class="sb-row-label" style="color: ${isDone ? 'var(--green-bright)' : 'var(--text)'};">T${tech.tier} ${tech.name}</span>
            <span style="font-size: 10px; color: ${statusColor};">${status}</span>
          </div>
          <div style="font-size: 10px; color: var(--text-dim); padding: 1px 0;">${tech.desc}</div>
          ${canStart && !isCurrentTech && canAfford ? `<button class="sb-btn accent" data-tech="${techId}" style="margin-top: 4px;">Research (${tech.cost}◆, ${tech.time}s)</button>` : ''}
        </div>
      `;
    }

    html += '</div>';
  }

  el.innerHTML = html;

  // Event delegation — survives re-renders
  el.onclick = (e) => {
    const btn = e.target.closest('[data-tech]');
    if (!btn) return;
    e.stopPropagation();
    startResearch(playerId, btn.dataset.tech);
    renderResearchTab(el);
  };
}
