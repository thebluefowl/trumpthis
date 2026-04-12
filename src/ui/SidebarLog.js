import { gameState } from '../state/GameState.js';
import { events } from '../state/events.js';

const logEntries = [];
const MAX_LOG = 100;

// Collect events for the log
export function initCombatLog() {
  events.on('missile:impact', (m) => {
    const from = gameState.countries.get(m.fromCountryId)?.name || '???';
    const to = gameState.countries.get(m.toCountryId)?.name || '???';
    const type = m.mtype?.name || 'missile';
    addLog(`${from} ${type} struck ${to}`, 'attack');
  });

  events.on('missile:intercepted', ({ missile, battery }) => {
    const def = gameState.countries.get(battery.countryId)?.name || '???';
    const atk = gameState.countries.get(missile.fromCountryId)?.name || '???';
    addLog(`${def} intercepted ${atk} missile`, 'info');
  });

  events.on('alliance:formed', ({ a, b }) => {
    addLog(`${gameState.countries.get(a)?.name} allied with ${gameState.countries.get(b)?.name}`, 'alliance');
  });

  events.on('alliance:broken', ({ a, b }) => {
    addLog(`${gameState.countries.get(a)?.name} broke alliance with ${gameState.countries.get(b)?.name}`, 'betrayal');
  });

  events.on('country:destroyed', (c) => {
    addLog(`${c.name} ELIMINATED`, 'elimination');
  });

  events.on('escalation:tick', (tick) => {
    addLog(`Escalation tick ${tick}`, 'escalation');
  });

  events.on('territory:claimed', ({ claimerId, eliminatedId }) => {
    addLog(`${gameState.countries.get(claimerId)?.name} conquered ${gameState.countries.get(eliminatedId)?.name}`, 'elimination');
  });

  events.on('emp:detonated', (m) => {
    addLog(`EMP over ${gameState.countries.get(m.toCountryId)?.name}`, 'attack');
  });
}

function addLog(text, type) {
  const mins = Math.floor(gameState.elapsed / 60);
  const secs = Math.floor(gameState.elapsed % 60);
  const time = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  logEntries.push({ time, text, type });
  if (logEntries.length > MAX_LOG) logEntries.shift();
}

export function renderLogTab(el) {
  const entries = logEntries.slice().reverse();
  el.innerHTML = `
    <div class="sb-section">
      <div class="sb-section-title">Combat Log (${logEntries.length})</div>
      ${entries.length === 0 ? '<div style="font-size:11px;color:var(--text-dim)">No events yet</div>' :
        entries.map(e => `
          <div class="log-entry">
            <span class="log-time">${e.time}</span>
            <span class="log-text ${e.type}">${e.text}</span>
          </div>
        `).join('')
      }
    </div>
  `;
}

export function resetCombatLog() {
  logEntries.length = 0;
}
