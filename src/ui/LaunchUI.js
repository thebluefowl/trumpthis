import { gameState } from '../state/GameState.js';
import { events } from '../state/events.js';
import { playerLaunchMissile } from '../ai/EasyAI.js';
import { setTargetingPreview } from '../rendering/CanvasOverlay.js';
import { getProjection } from '../rendering/Projection.js';

let mode = 'IDLE'; // IDLE | TARGETING
let selectedSiteCoords = null;
let targetingStartedAt = 0;

export function initLaunchUI() {
  events.on('launchsite:click', (site) => {
    if (gameState.phase !== 'PLAYING') return;
    if (site.role !== 'player') return;

    mode = 'TARGETING';
    selectedSiteCoords = site.coords;
    targetingStartedAt = performance.now();
    document.body.classList.add('targeting');
  });

  // Track mouse for targeting preview
  document.addEventListener('mousemove', (e) => {
    if (mode !== 'TARGETING') return;
    const projection = getProjection();
    const inverted = projection.invert([e.clientX, e.clientY]);
    if (inverted) {
      setTargetingPreview(selectedSiteCoords, inverted);
    }
  });

  // Click to fire or click on globe background
  document.addEventListener('click', (e) => {
    if (mode !== 'TARGETING') return;
    // Ignore the same click that started targeting
    if (performance.now() - targetingStartedAt < 100) return;

    // Small delay to avoid catching the same click that started targeting
    const projection = getProjection();
    const target = projection.invert([e.clientX, e.clientY]);
    if (!target) {
      cancelTargeting();
      return;
    }

    // Check if click is within the globe circle
    const [cx, cy] = projection.translate();
    const radius = projection.scale();
    const dx = e.clientX - cx;
    const dy = e.clientY - cy;
    if (dx * dx + dy * dy > radius * radius) {
      cancelTargeting();
      return;
    }

    // Try to launch
    const success = playerLaunchMissile(selectedSiteCoords, target);
    if (!success) {
      // Flash token counter red
      const tokenEl = document.getElementById('token-count');
      if (tokenEl) {
        tokenEl.classList.remove('flash-red');
        void tokenEl.offsetWidth; // force reflow
        tokenEl.classList.add('flash-red');
      }
    }

    cancelTargeting();
  });

  // Cancel on Escape or right-click
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && mode === 'TARGETING') {
      cancelTargeting();
    }
  });

  document.addEventListener('contextmenu', (e) => {
    if (mode === 'TARGETING') {
      e.preventDefault();
      cancelTargeting();
    }
  });
}

function cancelTargeting() {
  mode = 'IDLE';
  selectedSiteCoords = null;
  setTargetingPreview(null, null);
  document.body.classList.remove('targeting');
}

export function resetLaunchUI() {
  cancelTargeting();
}
