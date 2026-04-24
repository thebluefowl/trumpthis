import { gameState } from '../state/GameState.js';
import { PRODUCTION, FISSILE_PER_URANIUM_NODE, RAREEARTH_PER_NODE, SILO_CAPACITY } from '../constants.js';
import { getOwnedResources } from './ResourceSystem.js';

export function updateProduction(dt) {
  if (gameState.phase !== 'PLAYING') return;

  for (const country of gameState.getActiveCountries()) {
    tickResources(country, dt);
    tickQueue(country, dt);
    autoLoadSilos(country);
  }
}

function siloLoadedTotal(site) {
  let total = 0;
  for (const k in site.loadedMissiles) total += site.loadedMissiles[k] || 0;
  return total;
}

function autoLoadSilos(country) {
  if (!country.launchSites || country.launchSites.length === 0) return;
  if (!country.stockpile) return;

  for (const type in country.stockpile) {
    while (country.stockpile[type] > 0) {
      // Find first silo with free capacity
      const silo = country.launchSites.find(s => siloLoadedTotal(s) < SILO_CAPACITY);
      if (!silo) break;
      if (!silo.loadedMissiles) silo.loadedMissiles = {};
      silo.loadedMissiles[type] = (silo.loadedMissiles[type] || 0) + 1;
      country.stockpile[type] -= 1;
    }
  }
}

function tickResources(country, dt) {
  const owned = getOwnedResources(country.id);
  let fissileRate = 0;
  let rareRate = 0;
  for (const node of owned) {
    if (node.type === 'uranium') fissileRate += FISSILE_PER_URANIUM_NODE;
    else if (node.type === 'rare_earth') rareRate += RAREEARTH_PER_NODE;
  }
  country.fissile += fissileRate * dt;
  country.rareEarth += rareRate * dt;
}

function tickQueue(country, dt) {
  const slots = country.factoryCount || 0;
  if (slots <= 0) return;

  const queue = country.productionQueue;
  const active = queue.slice(0, slots);

  for (const item of active) {
    const cfg = PRODUCTION[item.type];
    if (!cfg) continue;

    // Stall if insufficient strategic resources (check at build start, i.e. progress === 0)
    if (item.progress === 0) {
      if ((cfg.fissile || 0) > country.fissile) continue;
      if ((cfg.rareEarth || 0) > country.rareEarth) continue;
      // Consume at build start
      country.fissile -= cfg.fissile || 0;
      country.rareEarth -= cfg.rareEarth || 0;
      item.started = true;
    }

    item.progress += dt;
  }

  // Complete finished items (head-to-tail, only within slots)
  for (let i = 0; i < Math.min(slots, queue.length); ) {
    const item = queue[i];
    const cfg = PRODUCTION[item.type];
    if (cfg && item.started && item.progress >= cfg.buildTime) {
      country.stockpile[item.type] = (country.stockpile[item.type] || 0) + 1;
      queue.splice(i, 1);
    } else {
      i++;
    }
  }
}

export function enqueueMissile(countryId, type, count = 1) {
  const country = gameState.countries.get(countryId);
  if (!country) return false;
  if (!PRODUCTION[type]) return false;
  for (let i = 0; i < count; i++) {
    country.productionQueue.push({ type, progress: 0, started: false });
  }
  return true;
}

export function cancelQueueItem(countryId, index) {
  const country = gameState.countries.get(countryId);
  if (!country) return false;
  const queue = country.productionQueue;
  if (index < 0 || index >= queue.length) return false;
  const [item] = queue.splice(index, 1);
  // Refund strategic resources if build had started
  if (item && item.started) {
    const cfg = PRODUCTION[item.type];
    if (cfg) {
      country.fissile += cfg.fissile || 0;
      country.rareEarth += cfg.rareEarth || 0;
    }
  }
  return true;
}

export function getStockpile(countryId, type) {
  const country = gameState.countries.get(countryId);
  if (!country) return 0;
  return country.stockpile[type] || 0;
}
