const screens = {};

export function initScreens() {
  screens.select = document.getElementById('screen-select');
  screens.gameover = document.getElementById('screen-gameover');
}

export function showScreen(name) {
  // The select screen (with globe) stays visible during gameplay.
  // Only the gameover screen is a true overlay that hides/shows independently.
  if (name === 'select') {
    screens.select.classList.remove('hidden');
    screens.gameover.classList.add('hidden');
  } else if (name === 'gameover') {
    // Don't hide select — globe stays visible underneath
    screens.gameover.classList.remove('hidden');
  }
}

export function showGameOverlay(show) {
  const hud = document.getElementById('hud');
  if (hud) hud.style.display = show ? '' : 'none';
}
