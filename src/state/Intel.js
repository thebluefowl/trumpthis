import { gameState } from './GameState.js';
import { hasSignalIntel, hasTotalAwareness, getSatelliteScanMultiplier } from '../engine/ResearchSystem.js';
import { SATELLITE_LAUNCH_COST, MAX_SATELLITES } from '../constants.js';

// Tracks what the player has revealed about enemy nations
// key: "countryId:type" → expiry time (gameState.elapsed)
// types: 'batteries', 'tokens', 'research'
const revealed = new Map();
const REVEAL_DURATION = 90; // seconds

// Countries whose cities have ever been spotted — cities stay visible permanently
const citiesSeenCountries = new Set();

export function reveal(countryId, type) {
  revealed.set(`${countryId}:${type}`, gameState.elapsed + REVEAL_DURATION);
  citiesSeenCountries.add(countryId);
}

export function hasCitiesBeenRevealed(countryId) {
  const playerId = gameState.playerCountryId;
  if (countryId === playerId) return true;
  if (gameState.isAllied(playerId, countryId)) return true;
  if (hasTotalAwareness(playerId)) return true;
  return citiesSeenCountries.has(countryId);
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

// Satellite constellation — each satellite has unique orbit parameters
// Realistic LEO orbits — period ~92 min (scaled to game time)
// Earth rotates ~23° per orbit, so ground track shifts 23° west each pass
// Speed = 360° / orbital_period_in_game_seconds
const ORBIT_PRESETS = [
  // Sat 1: Sun-synchronous — covers entire globe, standard recon
  { inclination: 97, period: 55, direction: -1, name: 'KEYHOLE-1',  desc: 'Sun-synchronous recon — 97° SSO. Full global coverage.' },
  // Sat 2: Molniya — high-latitude focus, lingers over Russia/Arctic
  { inclination: 63, period: 65, direction: 1,  name: 'MOLNIYA-1',  desc: 'Molniya orbit — 63° incl. High-latitude persistent coverage.' },
  // Sat 3: Low-incl tropical — covers equatorial nations (Indonesia, Nigeria, Brazil)
  { inclination: 15, period: 45, direction: 1,  name: 'LACROSSE-1', desc: 'Low-inclination radar sat — 15°. Equatorial/tropical coverage.' },
  // Sat 4: ISS-type — mid-latitude, good for Europe/US/China
  { inclination: 51, period: 50, direction: 1,  name: 'SIGINT-1',   desc: 'SIGINT orbit — 51° incl. Mid-latitude signals collection.' },
  // Sat 5: Retrograde polar — fills gaps from Sat 1, opposite direction
  { inclination: 85, period: 58, direction: -1, name: 'NROL-1',     desc: 'Retrograde near-polar — 85°. Classified NRO payload.' },
];

let satellites = [{ orbitAngle: 0, ascendingNode: 30, ...ORBIT_PRESETS[0] }];

// Earth rotation: ~6°/game-second (full rotation in 60s game time)
const EARTH_ROTATION_RATE = 6;

const MAX_TRAIL_POINTS = 80;

export function updateSatellite(dt) {
  for (const sat of satellites) {
    const speed = 360 / sat.period;
    sat.orbitAngle = (sat.orbitAngle + speed * sat.direction * dt) % 360;
    sat.ascendingNode = (sat.ascendingNode - EARTH_ROTATION_RATE * dt) % 360;

    // Record trail position
    if (!sat.trail) sat.trail = [];
    const pos = getSatellitePosition(sat);
    sat.trail.push({ lon: pos.lon, lat: pos.lat, time: gameState.elapsed });
    if (sat.trail.length > MAX_TRAIL_POINTS) sat.trail.shift();
  }
}

// Get current lon/lat for a satellite
export function getSatellitePosition(sat) {
  const orbitRad = (sat.orbitAngle * Math.PI) / 180;
  // Max latitude = inclination for prograde, (180-inclination) for retrograde
  const maxLat = sat.inclination <= 90 ? sat.inclination : 180 - sat.inclination;
  const lat = maxLat * Math.sin(orbitRad);
  const lon = sat.ascendingNode + (sat.orbitAngle / 360) * 360 * (sat.direction || 1);
  return { lon: ((lon + 540) % 360) - 180, lat };
}

// Active launch animations
const satLaunches = [];

export function launchSatellite() {
  if (satellites.length >= MAX_SATELLITES) return false;

  const player = gameState.countries.get(gameState.playerCountryId);
  if (!player || player.tokens < SATELLITE_LAUNCH_COST) return false;

  player.tokens -= SATELLITE_LAUNCH_COST;

  const satIndex = satellites.length + satLaunches.length; // account for in-flight launches
  const preset = ORBIT_PRESETS[satIndex] || ORBIT_PRESETS[0];
  // Stagger ascending nodes 72° apart for optimal global coverage
  const startNode = player.centroid[0] + satIndex * 72;

  satLaunches.push({
    from: player.centroid,
    startTime: gameState.elapsed,
    launchDuration: 2,     // seconds rising from ground
    transferDuration: 3,   // seconds transitioning to orbit
    preset,
    startNode,
  });

  return true;
}

export function updateSatLaunches() {
  for (let i = satLaunches.length - 1; i >= 0; i--) {
    const launch = satLaunches[i];
    const totalDuration = launch.launchDuration + launch.transferDuration;
    if (gameState.elapsed - launch.startTime >= totalDuration) {
      // Compute the orbital insertion point
      const maxLat = launch.preset.inclination <= 90 ? launch.preset.inclination : 180 - launch.preset.inclination;
      const ratio = Math.max(-1, Math.min(1, launch.from[1] / (maxLat || 1)));
      const startOrbitAngle = Math.asin(ratio) * (180 / Math.PI);

      satellites.push({ orbitAngle: startOrbitAngle, ascendingNode: launch.startNode, trail: [], ...launch.preset });
      satLaunches.splice(i, 1);
    }
  }
}

export function getSatLaunches() {
  return satLaunches.map(launch => {
    // Compute orbital insertion target for the transfer arc
    const maxLat = launch.preset.inclination <= 90 ? launch.preset.inclination : 180 - launch.preset.inclination;
    const ratio = Math.max(-1, Math.min(1, launch.from[1] / (maxLat || 1)));
    const insertOrbitAngle = Math.asin(ratio) * (180 / Math.PI);
    const insertRad = (insertOrbitAngle * Math.PI) / 180;
    const insertLat = maxLat * Math.sin(insertRad);
    const insertLon = launch.startNode + (insertOrbitAngle / 360) * 360 * (launch.preset.direction || 1);
    return {
      ...launch,
      insertionPoint: { lon: ((insertLon + 540) % 360) - 180, lat: insertLat },
    };
  });
}

export function getSatelliteCount() {
  return satellites.length;
}

export function getSatelliteAngle() {
  return satellites[0]?.orbitAngle || 0;
}

export function getAllSatellites() {
  return satellites.map(sat => ({
    ...sat,
    ...getSatellitePosition(sat),
  }));
}

// === Spatial fog of war ===
// Grid of visibility: lon/lat cells, each with an expiry time
// 0 = fogged, >0 = revealed until that game time
const FOG_CELL_SIZE = 10; // degrees per cell
const FOG_COLS = 36; // 360/10
const FOG_ROWS = 18; // 180/10
const FOG_REVEAL_DURATION = 120; // seconds a cell stays revealed
const fogGrid = new Float64Array(FOG_COLS * FOG_ROWS); // expiry times

function fogIndex(lon, lat) {
  const col = Math.floor(((lon + 180) % 360) / FOG_CELL_SIZE);
  const row = Math.floor((lat + 90) / FOG_CELL_SIZE);
  return Math.max(0, Math.min(FOG_COLS * FOG_ROWS - 1, row * FOG_COLS + col));
}

export function revealArea(lon, lat, radiusDeg) {
  const elapsed = gameState.elapsed;
  const rCells = Math.ceil(radiusDeg / FOG_CELL_SIZE);
  const centerCol = Math.floor(((lon + 180) % 360) / FOG_CELL_SIZE);
  const centerRow = Math.floor((lat + 90) / FOG_CELL_SIZE);

  for (let dr = -rCells; dr <= rCells; dr++) {
    for (let dc = -rCells; dc <= rCells; dc++) {
      const r = centerRow + dr;
      const c = (centerCol + dc + FOG_COLS) % FOG_COLS;
      if (r < 0 || r >= FOG_ROWS) continue;
      const idx = r * FOG_COLS + c;
      fogGrid[idx] = Math.max(fogGrid[idx], elapsed + FOG_REVEAL_DURATION);
    }
  }
}

export function isFoggedAt(lon, lat) {
  // Player territory and allies are always clear
  const playerId = gameState.playerCountryId;
  if (!playerId) return false;
  if (gameState.phase !== 'PLAYING') return false;

  const idx = fogIndex(lon, lat);
  if (fogGrid[idx] > gameState.elapsed) return false; // recently revealed
  return true;
}

export function getFogGrid() {
  return { grid: fogGrid, cols: FOG_COLS, rows: FOG_ROWS, cellSize: FOG_CELL_SIZE };
}

// Reveal areas around player + allies + satellite
export function updateFog() {
  const playerId = gameState.playerCountryId;
  if (!playerId) return;

  // Player's own territory — always revealed
  const player = gameState.countries.get(playerId);
  if (player) {
    revealArea(player.centroid[0], player.centroid[1], 18);
    for (const city of player.cities) {
      revealArea(city.coords[0], city.coords[1], 8);
    }
    for (const site of player.launchSites) {
      revealArea(site.coords[0], site.coords[1], 8);
    }
  }

  // Allied territory — reveal around their centroids and cities
  for (const allyId of gameState.getAllies(playerId)) {
    const ally = gameState.countries.get(allyId);
    if (ally) {
      revealArea(ally.centroid[0], ally.centroid[1], 12);
      for (const city of ally.cities) {
        revealArea(city.coords[0], city.coords[1], 6);
      }
    }
  }

  // Each satellite reveals fog + intel for nearby nations
  for (const sat of satellites) {
    const pos = getSatellitePosition(sat);
    revealArea(pos.lon, pos.lat, 12);

    // Reveal intel for any nation whose centroid is within satellite scan range
    const SCAN_RANGE_DEG = 15;
    for (const [id, country] of gameState.countries) {
      if (id === playerId) continue;
      if (gameState.isAllied(playerId, id)) continue;
      const dLon = Math.abs(country.centroid[0] - pos.lon);
      const dLat = Math.abs(country.centroid[1] - pos.lat);
      const wrapped = Math.min(dLon, 360 - dLon);
      if (wrapped < SCAN_RANGE_DEG && dLat < SCAN_RANGE_DEG) {
        reveal(id, 'batteries');
      }
    }

    // Also reveal fog along a short trail
    for (let back = 5; back <= 15; back += 5) {
      const pastAngle = sat.orbitAngle - back * sat.direction;
      const pastRad = (pastAngle * Math.PI) / 180;
      const pastLat = sat.inclination * Math.sin(pastRad);
      const pastLon = sat.ascendingNode + (pastAngle / 360) * 360 * (sat.direction || 1);
      revealArea(((pastLon + 540) % 360) - 180, pastLat, 10);
    }
  }
}

export function resetIntel() {
  revealed.clear();
  citiesSeenCountries.clear();
  satellites = [{ orbitAngle: 0, ascendingNode: 0, ...ORBIT_PRESETS[0] }];
  satLaunches.length = 0;
  fogGrid.fill(0);
}

// Call once at game start to immediately reveal player territory
export function initFog() {
  updateFog();
  // Initial reveal — your region + nearby allies
  const player = gameState.countries.get(gameState.playerCountryId);
  if (player) {
    revealArea(player.centroid[0], player.centroid[1], 18);
  }
  for (const allyId of gameState.getAllies(gameState.playerCountryId)) {
    const ally = gameState.countries.get(allyId);
    if (ally) revealArea(ally.centroid[0], ally.centroid[1], 12);
  }
}
