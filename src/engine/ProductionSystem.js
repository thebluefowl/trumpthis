import { gameState } from '../state/GameState.js';
import { PRODUCTION, FISSILE_PER_URANIUM_NODE, RAREEARTH_PER_NODE, SILO_CAPACITY } from '../constants.js';
import { getOwnedResources } from './ResourceSystem.js';

export function updateProduction(dt) {
  if (gameState.phase !== 'PLAYING' && gameState.phase !== 'SETUP') return;

  for (const [blocId, bloc] of gameState.blocs) {
    if (gameState.isBlocEliminated(blocId)) continue;
    tickBlocResources(bloc, blocId, dt);
    tickBlocQueue(bloc, dt);
    autoLoadBlocSilos(bloc, blocId);
  }
}

function tickBlocResources(bloc, blocId, dt) {
  let fissileRate = 0;
  let rareRate = 0;
  for (const country of gameState.getBlocCountries(blocId)) {
    if (gameState.isEliminated(country.id)) continue;
    for (const node of getOwnedResources(country.id)) {
      if (node.type === 'uranium') fissileRate += FISSILE_PER_URANIUM_NODE;
      else if (node.type === 'rare_earth') rareRate += RAREEARTH_PER_NODE;
    }
  }
  bloc.fissile += fissileRate * dt;
  bloc.rareEarth += rareRate * dt;
}

function tickBlocQueue(bloc, dt) {
  const slots = bloc.factoryCount || 0;
  if (slots <= 0) return;

  const queue = bloc.productionQueue;
  const active = queue.slice(0, slots);

  for (const item of active) {
    const cfg = PRODUCTION[item.type];
    if (!cfg) continue;
    if (item.progress === 0) {
      if ((cfg.fissile || 0) > bloc.fissile) continue;
      if ((cfg.rareEarth || 0) > bloc.rareEarth) continue;
      bloc.fissile -= cfg.fissile || 0;
      bloc.rareEarth -= cfg.rareEarth || 0;
      item.started = true;
    }
    item.progress += dt;
  }

  // Completions — only scan the first `slots` items
  for (let i = 0; i < Math.min(slots, queue.length); ) {
    const item = queue[i];
    const cfg = PRODUCTION[item.type];
    if (cfg && item.started && item.progress >= cfg.buildTime) {
      bloc.stockpile[item.type] = (bloc.stockpile[item.type] || 0) + 1;
      queue.splice(i, 1);
    } else {
      i++;
    }
  }
}

function siloLoadedTotal(site) {
  let total = 0;
  for (const k in site.loadedMissiles) total += site.loadedMissiles[k] || 0;
  return total;
}

function autoLoadBlocSilos(bloc, blocId) {
  const silos = gameState.getBlocSilos(blocId).map(entry => entry.site);
  if (silos.length === 0) return;

  for (const type in bloc.stockpile) {
    while (bloc.stockpile[type] > 0) {
      let target = null;
      let minLoad = Infinity;
      for (const s of silos) {
        if (s.disabled) continue;
        const load = siloLoadedTotal(s);
        if (load < SILO_CAPACITY && load < minLoad) {
          minLoad = load;
          target = s;
        }
      }
      if (!target) break;
      if (!target.loadedMissiles) target.loadedMissiles = {};
      target.loadedMissiles[type] = (target.loadedMissiles[type] || 0) + 1;
      bloc.stockpile[type] -= 1;
    }
  }
}

export function enqueueMissile(blocOrCountryId, type, count = 1) {
  // Accept either bloc id or country id (falls back to country's bloc)
  let bloc = gameState.blocs.get(blocOrCountryId);
  if (!bloc) bloc = gameState.getBloc(blocOrCountryId);
  if (!bloc) return false;
  if (!PRODUCTION[type]) return false;
  for (let i = 0; i < count; i++) {
    bloc.productionQueue.push({ type, progress: 0, started: false });
  }
  return true;
}

export function cancelQueueItem(blocOrCountryId, index) {
  let bloc = gameState.blocs.get(blocOrCountryId);
  if (!bloc) bloc = gameState.getBloc(blocOrCountryId);
  if (!bloc) return false;
  const queue = bloc.productionQueue;
  if (index < 0 || index >= queue.length) return false;
  const [item] = queue.splice(index, 1);
  if (item && item.started) {
    const cfg = PRODUCTION[item.type];
    if (cfg) {
      bloc.fissile += cfg.fissile || 0;
      bloc.rareEarth += cfg.rareEarth || 0;
    }
  }
  return true;
}

export function getStockpile(blocOrCountryId, type) {
  let bloc = gameState.blocs.get(blocOrCountryId);
  if (!bloc) bloc = gameState.getBloc(blocOrCountryId);
  if (!bloc) return 0;
  return bloc.stockpile[type] || 0;
}
