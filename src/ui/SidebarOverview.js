import { gameState } from '../state/GameState.js';
import { events } from '../state/events.js';
import { COUNTRY_MAP, COUNTRY_BLOC, BLOCS } from '../state/countryData.js';
import { formatPop } from '../rendering/Globe.js';
import { TOKEN_RATES } from '../constants.js';
import { getTokenMultiplier, isEscalationActive, getTimeRemaining, getEscalationTick } from '../engine/Escalation.js';

export function renderOverviewTab(el) {
  const player = gameState.getPlayer();
  if (!player) { el.innerHTML = ''; return; }

  const popPct = (player.population / player.startingPopulation * 100).toFixed(1);
  const popColor = popPct > 60 ? 'green' : popPct > 30 ? 'amber' : 'red';
  const tokenRate = (TOKEN_RATES[player.tier] * getTokenMultiplier() * Math.log(player.population / player.startingPopulation + 1) / Math.log(2)).toFixed(1);
  const batteries = gameState.getBatteryCount(player.id);
  const maxBat = gameState.getMaxBatteries(player.id);
  const allies = gameState.getAllies(player.id);
  const allyNames = allies.map(id => gameState.countries.get(id)?.name).filter(Boolean);
  const inbound = gameState.missiles.filter(m => m.toCountryId === player.id).length;
  const outbound = gameState.missiles.filter(m => m.fromCountryId === player.id).length;
  const active = gameState.getActiveCountries().length;
  const eliminated = gameState.eliminated.size;
  const blocId = COUNTRY_BLOC.get(player.id);
  const bloc = blocId ? BLOCS[blocId] : null;

  el.innerHTML = `
    <div class="sb-section">
      <div class="sb-section-title">Your Nation</div>
      <div style="font-size: 16px; font-weight: 600; color: var(--text-bright); margin-bottom: 2px;">${player.name}</div>
      <div style="font-size: 11px; color: var(--text-dim);">${bloc ? bloc.name : 'Solo'} · Tier ${player.tier}</div>
    </div>

    <div class="sb-section">
      <div class="sb-section-title">Population</div>
      <div class="sb-bar"><div class="sb-bar-fill ${popColor}" style="width: ${popPct}%"></div></div>
      <div class="sb-row"><span class="sb-row-label">Current</span><span class="sb-row-value">${formatPop(player.population)}</span></div>
      <div class="sb-row"><span class="sb-row-label">Health</span><span class="sb-row-value" style="color: var(--${popColor})">${popPct}%</span></div>
    </div>

    <div class="sb-section">
      <div class="sb-section-title">Economy</div>
      <div class="sb-row"><span class="sb-row-label">Tokens</span><span class="sb-row-value" style="color: var(--gold)">${Math.floor(player.tokens)} / ${player.tokenCap}</span></div>
      <div class="sb-bar"><div class="sb-bar-fill gold" style="width: ${(player.tokens / player.tokenCap * 100).toFixed(0)}%"></div></div>
      <div class="sb-row"><span class="sb-row-label">Generation</span><span class="sb-row-value">+${tokenRate}/s</span></div>
    </div>

    <div class="sb-section">
      <div class="sb-section-title">Military</div>
      <div class="sb-row"><span class="sb-row-label">Interceptors</span><span class="sb-row-value">${batteries} / ${maxBat}</span></div>
      <div class="sb-row"><span class="sb-row-label">Launch Sites</span><span class="sb-row-value">${player.launchSites.filter(s => !s.disabled).length} / ${player.launchSites.length}</span></div>
      <div class="sb-row"><span class="sb-row-label">Missiles Out</span><span class="sb-row-value">${outbound}</span></div>
      <div class="sb-row"><span class="sb-row-label">Incoming</span><span class="sb-row-value" style="color: ${inbound > 0 ? 'var(--red)' : 'var(--text-dim)'}">${inbound}${inbound > 0 ? ' ⚠' : ''}</span></div>
    </div>

    <div class="sb-section">
      <div class="sb-section-title">Situation</div>
      <div class="sb-row"><span class="sb-row-label">Allies</span><span class="sb-row-value">${allies.length}</span></div>
      <div class="sb-row"><span class="sb-row-label">Active Nations</span><span class="sb-row-value">${active}</span></div>
      <div class="sb-row"><span class="sb-row-label">Eliminated</span><span class="sb-row-value">${eliminated}</span></div>
      <div class="sb-row"><span class="sb-row-label">Total Missiles</span><span class="sb-row-value">${gameState.missiles.length}</span></div>
      ${isEscalationActive() ? `<div class="sb-row"><span class="sb-row-label">Escalation</span><span class="sb-row-value" style="color: var(--red)">TICK ${getEscalationTick()}/5</span></div>` : ''}
    </div>

    <div class="sb-section">
      <div class="sb-section-title">Combat Record</div>
      <div class="sb-row"><span class="sb-row-label">Launched</span><span class="sb-row-value">${player.combatStats.missilesLaunched}</span></div>
      <div class="sb-row"><span class="sb-row-label">Intercepted</span><span class="sb-row-value">${player.combatStats.missilesIntercepted}</span></div>
      <div class="sb-row"><span class="sb-row-label">Damage Dealt</span><span class="sb-row-value">${formatPop(player.combatStats.damageDealt)}</span></div>
      <div class="sb-row"><span class="sb-row-label">Damage Taken</span><span class="sb-row-value">${formatPop(player.combatStats.damageTaken)}</span></div>
    </div>

    <div class="sb-section">
      <button class="sb-btn danger" id="sb-surrender">SURRENDER</button>
    </div>
  `;

  document.getElementById('sb-surrender')?.addEventListener('click', () => {
    if (confirm('Surrender? This ends the game.')) {
      gameState.eliminateCountry(player.id);
      gameState.phase = 'GAME_OVER';
      events.emit('game:over', { result: 'defeat' });
    }
  });
}
