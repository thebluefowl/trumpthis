import { gameState } from '../state/GameState.js';
import { formatPop } from './Globe.js';

let prevValues = {};

export function initHUD() {
  prevValues = {};
}

export function renderHUD() {
  if (gameState.phase !== 'PLAYING') return;

  const player = gameState.getPlayer();
  const ai = gameState.getAI();
  if (!player || !ai) return;

  // Game clock
  const mins = Math.floor(gameState.elapsed / 60);
  const secs = Math.floor(gameState.elapsed % 60);
  const clockStr = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  setIfChanged('game-clock', clockStr);

  // Tokens
  const tokenStr = Math.floor(player.tokens);
  setIfChanged('token-count', tokenStr);

  // Population bars
  const playerPct = (player.population / player.startingPopulation) * 100;
  const aiPct = (ai.population / ai.startingPopulation) * 100;

  const playerBar = document.getElementById('player-pop-bar');
  const enemyBar = document.getElementById('enemy-pop-bar');
  if (playerBar) playerBar.style.width = Math.max(0, playerPct) + '%';
  if (enemyBar) enemyBar.style.width = Math.max(0, aiPct) + '%';

  setIfChanged('player-pop-value', formatPop(player.population));
  setIfChanged('enemy-pop-value', formatPop(ai.population));

  // Missiles in flight
  const missileCount = gameState.missiles.length;
  setIfChanged('missiles-in-flight', `MISSILES IN FLIGHT: ${missileCount}`);
}

function setIfChanged(id, value) {
  if (prevValues[id] === value) return;
  prevValues[id] = value;
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}
