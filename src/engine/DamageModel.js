import { gameState } from '../state/GameState.js';
import { events } from '../state/events.js';
import { onAttack } from '../state/Diplomacy.js';
import { renderPaths } from '../rendering/Globe.js';
import { openClaimWindow } from './Conquest.js';
import { geoDistance } from '../rendering/Projection.js';
import { getDamageMultiplier, getLaunchSiteRecoveryMultiplier } from './ResearchSystem.js';

// Proximity thresholds (in radians on globe surface)
const CITY_DAMAGE_RADIUS = 0.03;      // ~190km — direct city hit
const CITY_SPLASH_RADIUS = 0.08;      // ~500km — splash damage to nearby cities
const INFRA_DISABLE_RADIUS = 0.05;    // ~320km — disables launch sites
const BATTERY_DESTROY_RADIUS = 0.04;  // ~250km — destroys interceptor batteries

export function processImpacts() {
  for (const explosion of gameState.explosions) {
    if (explosion.damageApplied) continue;
    explosion.damageApplied = true;

    const country = gameState.countries.get(explosion.countryId);
    if (!country || gameState.isEliminated(country.id)) continue;

    const impactPos = explosion.position;
    // Apply attacker's tech damage multiplier
    const techMult = explosion.attackerId ? getDamageMultiplier(explosion.attackerId, explosion.missileType || 'icbm') : 1;
    const baseDamage = (explosion.damage || 0.05) * techMult;

    // === 1. City damage (population) ===
    let totalPopLoss = 0;
    for (const city of country.cities) {
      if (city.destroyed) continue;
      const dist = geoDistance(impactPos, city.coords);

      let damageMultiplier = 0;
      if (dist < CITY_DAMAGE_RADIUS) {
        damageMultiplier = 1.0; // direct hit — full damage
      } else if (dist < CITY_SPLASH_RADIUS) {
        damageMultiplier = 0.3 * (1 - dist / CITY_SPLASH_RADIUS); // splash falloff
      }

      if (damageMultiplier > 0) {
        const loss = Math.floor(city.population * baseDamage * damageMultiplier);
        city.population = Math.max(0, city.population - loss);
        totalPopLoss += loss;

        if (city.population <= 0) {
          city.destroyed = true;
        }
      }
    }

    // Update nation's total population from cities
    country.population = country.cities.reduce((sum, c) => sum + c.population, 0);

    // === 2. Launch site damage (disable) ===
    for (const site of country.launchSites) {
      const dist = geoDistance(impactPos, site.coords);
      if (dist < INFRA_DISABLE_RADIUS) {
        const recoveryMult = getLaunchSiteRecoveryMultiplier(country.id);
        const disableDuration = (dist < CITY_DAMAGE_RADIUS ? 120 : 60) * recoveryMult;
        site.disabled = true;
        site.disabledUntil = Math.max(site.disabledUntil, gameState.elapsed + disableDuration);
      }
    }

    // === 3. Battery damage (destroy permanently) ===
    gameState.interceptors = gameState.interceptors.filter(battery => {
      if (battery.countryId !== country.id) return true;
      const dist = geoDistance(impactPos, battery.position);
      if (dist < BATTERY_DESTROY_RADIUS) {
        return false; // destroyed
      }
      return true;
    });

    // === Track stats and diplomacy ===
    country.combatStats.damageTaken += totalPopLoss;

    if (explosion.attackerId && explosion.attackerId !== explosion.countryId) {
      const attacker = gameState.countries.get(explosion.attackerId);
      if (attacker) attacker.combatStats.damageDealt += totalPopLoss;

      onAttack(explosion.attackerId, explosion.countryId);

      if (explosion.attackerId === gameState.playerCountryId) {
        gameState.stats.playerDamageDealt += totalPopLoss;
      }
    }

    renderPaths();

    // Check elimination
    if (country.population <= 0) {
      gameState.eliminateCountry(country.id);
      const attackerName = gameState.countries.get(explosion.attackerId)?.name || 'Unknown';
      gameState.addNotification(`${country.name} destroyed by ${attackerName}!`, 'info');
      openClaimWindow(country.id, explosion.attackerId);
      events.emit('country:destroyed', country);
    }
  }

  // Re-enable launch sites whose disable timer has expired
  for (const [, country] of gameState.countries) {
    for (const site of country.launchSites) {
      if (site.disabled && gameState.elapsed >= site.disabledUntil) {
        site.disabled = false;
      }
    }
  }
}
