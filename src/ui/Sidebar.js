import { gameState } from '../state/GameState.js';
import { events } from '../state/events.js';
import { renderOverviewTab } from './SidebarOverview.js';
import { renderNationsTab } from './SidebarNations.js';
import { renderDiplomacyTab } from './SidebarDiplomacy.js';
import { renderResearchTab } from './SidebarResearch.js';
import { renderProductionTab, resetProductionTab } from './SidebarProduction.js';
import { renderLogTab } from './SidebarLog.js';

let contentEl = null;
let currentTab = 'overview';
let lastRenderTime = 0;

export function initSidebar() {
  contentEl = document.getElementById('sidebar-content');

  // Tab switching
  document.querySelectorAll('.stab').forEach(tab => {
    tab.addEventListener('click', () => {
      currentTab = tab.dataset.tab;
      document.querySelectorAll('.stab').forEach(t => t.classList.toggle('active', t === tab));
      renderTab();
    });
  });
}

export function renderSidebar() {
  if (!contentEl) return;
  if (gameState.phase !== 'PLAYING' && gameState.phase !== 'SETUP') return;

  // Throttle to ~4 fps
  const now = performance.now();
  if (now - lastRenderTime < 250) return;
  lastRenderTime = now;

  renderTab();
}

function renderTab() {
  if (!contentEl) return;

  switch (currentTab) {
    case 'overview': renderOverviewTab(contentEl); break;
    case 'nations': renderNationsTab(contentEl); break;
    case 'production': renderProductionTab(contentEl); break;
    case 'diplomacy': renderDiplomacyTab(contentEl); break;
    case 'research': renderResearchTab(contentEl); break;
    case 'log': renderLogTab(contentEl); break;
  }
}

function renderResearchPlaceholder() {
  return `
    <div class="sb-section">
      <div class="sb-section-title">Research</div>
      <div style="color: var(--text-dim); font-size: 12px;">Coming soon — tech tree upgrades</div>
    </div>
  `;
}

export function getCurrentTab() {
  return currentTab;
}

export function resetSidebar() {
  currentTab = 'overview';
  lastRenderTime = 0;
  resetProductionTab();
}
