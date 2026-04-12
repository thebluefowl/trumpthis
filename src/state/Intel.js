import { gameState } from './GameState.js';
import { hasSignalIntel, hasTotalAwareness, getSatelliteScanMultiplier } from '../engine/ResearchSystem.js';

// Tracks what the player has revealed about enemy nations
// key: "countryId:type" → expiry time (gameState.elapsed)
// types: 'batteries', 'tokens', 'research'
const revealed = new Map();
const REVEAL_DURATION = 90; // seconds

export function reveal(countryId, type) {
  revealed.set(`${countryId}:${type}`, gameState.elapsed + REVEAL_DURATION);
}

export function revealAll(countryId) {
  reveal(countryId, 'batteries');
  reveal(countryId, 'tokens');
  reveal(countryId, 'research');
}

export function isRevealed(countryId, type) {
  const playerId = gameState.playerCountryId;

  // Always see your own and allies' intel
  if (countryId === playerId) return true;
  if (gameState.isAllied(playerId, countryId)) return true;

  // Tech: Total Domain Awareness — see everything permanently
  if (hasTotalAwareness(playerId)) return true;

  // Tech: SIGINT — always reveals batteries
  if (type === 'batteries' && hasSignalIntel(playerId)) return true;

  // Tech: Satellite Constellation — also reveals tokens
  if (type === 'tokens' && getSatelliteScanMultiplier(playerId) >= 2) return true;

  // Time-limited reveal from satellite sweep or spy actions
  const key = `${countryId}:${type}`;
  const expiry = revealed.get(key);
  if (!expiry) return false;
  if (gameState.elapsed > expiry) {
    revealed.delete(key);
    return false;
  }
  return true;
}

export function cleanupIntel() {
  for (const [key, expiry] of revealed) {
    if (gameState.elapsed > expiry) revealed.delete(key);
  }
}

// Satellite orbit — sweeps a longitude band, revealing a wide swath
let satelliteAngle = 0; // current longitude in degrees
const SATELLITE_SPEED = 6; // degrees per second (full orbit in 60s)
const SATELLITE_WIDTH = 0.5; // radians of longitude swept

export function updateSatellite(dt) {
  satelliteAngle = (satelliteAngle + SATELLITE_SPEED * dt) % 360;

  // Reveal any enemy nation whose centroid is within the sweep band
  const sweepLon = satelliteAngle - 180; // convert to -180..180
  for (const [id, country] of gameState.countries) {
    if (id === gameState.playerCountryId) continue;
    if (gameState.isAllied(gameState.playerCountryId, id)) continue;

    const lonDiff = Math.abs(country.centroid[0] - sweepLon);
    const wrapped = Math.min(lonDiff, 360 - lonDiff);
    if (wrapped < SATELLITE_WIDTH * 57.3) { // convert radians to degrees
      reveal(id, 'batteries');
    }
  }
}

export function getSatelliteAngle() {
  return satelliteAngle;
}

export function resetIntel() {
  revealed.clear();
  satelliteAngle = 0;
}
