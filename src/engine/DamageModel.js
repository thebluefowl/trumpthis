import { gameState } from '../state/GameState.js';
import { events } from '../state/events.js';
import { onAttack } from '../state/Diplomacy.js';
import { renderPaths } from '../rendering/Globe.js';
import { openClaimWindow } from './Conquest.js';
import { geoDistance } from '../rendering/Projection.js';
import { getDamageMultiplier, getLaunchSiteRecoveryMultiplier } from './ResearchSystem.js';
import { MISSILE_TYPES } from '../constants.js';

// Proximity thresholds (in radians on globe surface) at reference blastRadius of 40
const CITY_DAMAGE_RADIUS = 0.03;      // ~190km — direct city hit
const CITY_SPLASH_RADIUS = 0.08;      // ~500km — splash damage to nearby cities
const INFRA_DISABLE_RADIUS = 0.05;    // ~320km — disables launch sites
const BATTERY_DESTROY_RADIUS = 0.04;  // ~250km — destroys interceptor batteries
const REF_BLAST = 40;                 // icbm-tier baseline; other types scale from here

export function processImpacts() {
  for (const explosion of gameState.explosions) {
    if (explosion.damageApplied) continue;
    explosion.damageApplied = true;

    let country = gameState.countries.get(explosion.countryId);
    if (!country) continue;
    // Redirect strikes on conquered territory to the conqueror
    if (gameState.isEliminated(country.id) && country.conqueredBy) {
      const owner = gameState.countries.get(country.conqueredBy);
      if (owner && !gameState.isEliminated(owner.id)) country = owner;
      else continue;
    } else if (gameState.isEliminated(country.id)) {
      continue;
    }

    const impactPos = explosion.position;
    // Apply attacker's tech damage multiplier
    const techMult = explosion.attackerId ? getDamageMultiplier(explosion.attackerId, explosion.missileType || 'icbm') : 1;
    const baseDamage = (explosion.damage || 0.05) * techMult;

    // Scale blast radii by missile size (nukes hit a much larger area than tacticals)
    const mtype = MISSILE_TYPES[explosion.missileType] || {};
    const blastScale = Math.max(0.5, (mtype.blastRadius || REF_BLAST) / REF_BLAST);
    const directRadius = CITY_DAMAGE_RADIUS * blastScale;
    const splashRadius = CITY_SPLASH_RADIUS * blastScale;

    // === 1. City damage (population) ===
    let totalPopLoss = 0;
    for (const city of country.cities) {
      if (city.destroyed) continue;
      const dist = geoDistance(impactPos, city.coords);

      let damageMultiplier = 0;
      if (dist < directRadius) {
        damageMultiplier = 1.0; // direct hit — full damage
      } else if (dist < splashRadius) {
        damageMultiplier = 0.3 * (1 - dist / splashRadius); // splash falloff
      }

      if (damageMultiplier > 0) {
        const currentLoss = city.population * baseDamage * damageMultiplier;
        const floorLoss = city.startingPopulation * baseDamage * damageMultiplier * 0.4;
        const loss = Math.min(city.population, Math.floor(Math.max(currentLoss, floorLoss)));
        city.population = Math.max(0, city.population - loss);
        totalPopLoss += loss;

        if (city.population <= 0) {
          city.destroyed = true;
        }
      }
    }

    // === 1b. Territory damage — hits on enemy soil always kill some population ===
    // Cities remain the primary target (amplifier above); this prevents point-defense
    // around cities from making the rest of the country invulnerable.
    const TERRITORY_FACTOR = 0.08;
    const broadLoss = Math.floor(
      country.startingPopulation * baseDamage * TERRITORY_FACTOR * blastScale
    );
    if (broadLoss > 0) {
      const liveCities = country.cities.filter(c => !c.destroyed && c.population > 0);
      const totalLivePop = liveCities.reduce((s, c) => s + c.population, 0);
      if (totalLivePop > 0) {
        let remaining = broadLoss;
        for (const city of liveCities) {
          const share = Math.floor(broadLoss * (city.population / totalLivePop));
          const actual = Math.min(share, city.population, remaining);
          city.population -= actual;
          totalPopLoss += actual;
          remaining -= actual;
          if (city.population <= 0) city.destroyed = true;
        }
      }
    }

    // Update nation's total population from cities
    country.population = country.cities.reduce((sum, c) => sum + c.population, 0);

    const infraRadius = INFRA_DISABLE_RADIUS * blastScale;
    const batteryRadius = BATTERY_DESTROY_RADIUS * blastScale;

    // === 2. Launch site damage (disable + lose loaded missiles) ===
    for (const site of country.launchSites) {
      const dist = geoDistance(impactPos, site.coords);
      if (dist < infraRadius) {
        const recoveryMult = getLaunchSiteRecoveryMultiplier(country.id);
        const disableDuration = (dist < directRadius ? 120 : 60) * recoveryMult;
        site.disabled = true;
        site.disabledUntil = Math.max(site.disabledUntil, gameState.elapsed + disableDuration);
        site.loadedMissiles = {};
      }
    }

    // === 3. Battery damage (destroy permanently) ===
    gameState.interceptors = gameState.interceptors.filter(battery => {
      if (battery.countryId !== country.id) return true;
      const dist = geoDistance(impactPos, battery.position);
      if (dist < batteryRadius) {
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
