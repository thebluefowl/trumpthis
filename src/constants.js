// === Colors (DEFCON Dark theme) ===
export const COLORS = {
  BG: '#0a0a0a',
  OCEAN: '#050510',
  BORDER: '#00ff88',
  BORDER_DIM: '#004422',
  GRATICULE: '#112211',
  PLAYER: '#00ccff',
  PLAYER_DIM: '#004466',
  ENEMY: '#ff3333',
  ENEMY_DIM: '#441111',
  MISSILE_TRAIL: '#ff6600',
  EXPLOSION: '#ffcc00',
  INTERCEPTOR: '#00ff44',
  INTERCEPT_FLASH: '#ffffff',
  TEXT: '#e0e0e0',
  TEXT_DIM: '#666666',
  HUD_BG: 'rgba(10, 10, 10, 0.85)',
  OUTLINE: '#00ff88',
  COUNTRY_FILL: '#0a1a0a',
  COUNTRY_HOVER: '#0a2a0a',
};

// === Globe ===
export const GLOBE_PADDING = 0.85; // globe fills 85% of smallest viewport dimension

// === Gameplay ===
export const STARTING_TOKENS = 0;
export const PLAYER_TOKEN_BONUS = 1.0; // same rate as AI — no advantage
export const LAUNCH_SITE_COOLDOWN = 6; // default fallback
export const LAUNCH_SITE_COST = 25;   // tokens to build a new silo
export const MAX_LAUNCH_SITES = {
  1: 6, // Superpower
  2: 5, // Major power
  3: 4, // Regional power
};
export const EXPLOSION_DURATION = 3000; // ms — longer, more dramatic
export const TRAIL_FADE_TIME = 4000; // ms
export const POPULATION_SCALE = 1000;

// === Missile Types ===
// Progressive unlock. Each weapon has a clear role.
// Damage is % of target city population per hit.
export const MISSILE_TYPES = {
  drone: {
    name: 'Drone',         // SCOUT / HARASS
    key: '0',
    unlockAt: 0,
    cost: 3,
    baseFlight: 7,         // slow loiter
    distFactor: 4,
    damage: 0.06,
    autoIntercept: 0.80,   // easy to shoot down
    manualIntercept: 0.95,
    blastRadius: 8,
    trailColor: '#66cccc',
    isDrone: true,
    description: 'Cheap scout. Easy to intercept. Targets infrastructure.',
    siteCooldown: 1,
  },
  tactical: {
    name: 'Tactical',       // FAST STRIKE
    key: '1',
    unlockAt: 0,
    cost: 6,
    baseFlight: 2.5,
    distFactor: 2,
    damage: 0.12,
    autoIntercept: 0.70,
    manualIntercept: 0.90,
    blastRadius: 18,
    trailColor: '#ffaa00',
    description: 'Fast, cheap. Good for probing defenses.',
    siteCooldown: 3,
  },
  cruise: {
    name: 'Cruise',          // RELIABLE DAMAGE
    key: '2',
    unlockAt: 30,
    cost: 12,
    baseFlight: 5,
    distFactor: 3,
    damage: 0.18,
    autoIntercept: 0.45,    // flies low — hard to catch
    manualIntercept: 0.70,
    blastRadius: 28,
    trailColor: '#ff8800',
    description: 'Flies low. Hard to intercept. Reliable damage.',
    siteCooldown: 5,
  },
  decoy: {
    name: 'Decoy Swarm',    // DEFENSE SATURATION
    key: '9',
    unlockAt: 45,
    cost: 8,
    baseFlight: 5,
    distFactor: 3,
    damage: 0,
    autoIntercept: 0.70,
    manualIntercept: 0.90,
    blastRadius: 5,
    trailColor: '#ff6600',
    decoyCount: 5,
    description: 'Spawns 5 fakes. Wastes enemy interceptors.',
    siteCooldown: 2,
  },
  icbm: {
    name: 'ICBM',           // WORKHORSE
    key: '3',
    unlockAt: 60,
    cost: 20,
    baseFlight: 6,
    distFactor: 4,
    damage: 0.12,
    autoIntercept: 0.55,
    manualIntercept: 0.80,
    blastRadius: 40,
    trailColor: '#ff6600',
    description: 'Standard heavy missile. The workhorse.',
    siteCooldown: 8,
  },
  dirty_bomb: {
    name: 'Dirty Bomb',     // AREA DENIAL
    key: '8',
    unlockAt: 90,
    cost: 10,
    baseFlight: 5,
    distFactor: 3,
    damage: 0.08,
    autoIntercept: 0.60,
    manualIntercept: 0.85,
    blastRadius: 22,
    trailColor: '#88aa00',
    contamination: true,
    contaminationDuration: 45,
    contaminationDamage: 0.008,  // 0.8% per second for 45s = ~36% total to nearby cities
    description: 'Low blast + toxic zone for 45s. Area denial.',
    siteCooldown: 6,
  },
  emp: {
    name: 'EMP',             // DEFENSE SUPPRESSION
    key: '5',
    unlockAt: 120,
    cost: 16,
    baseFlight: 3.5,
    distFactor: 3,
    damage: 0,
    autoIntercept: 0.55,
    manualIntercept: 0.80,
    blastRadius: 50,
    trailColor: '#8844ff',
    empDuration: 25,
    description: 'Disables interceptors for 25s. The SEAD opener.',
    siteCooldown: 5,
  },
  mirv: {
    name: 'MIRV',            // OVERWHELMING FORCE
    key: '4',
    unlockAt: 180,
    cost: 40,
    baseFlight: 7,
    distFactor: 5,
    damage: 0.15,            // ×4 warheads = 32% if all land
    warheads: 4,
    splitAt: 0.7,
    autoIntercept: 0.30,
    manualIntercept: 0.55,
    blastRadius: 30,
    trailColor: '#ff4400',
    description: 'Splits into 4 warheads. Overwhelms defenses.',
    siteCooldown: 10,
  },
  slbm: {
    name: 'SLBM',            // STEALTH STRIKE
    key: '7',
    unlockAt: 240,
    cost: 25,
    baseFlight: 5,
    distFactor: 2,
    damage: 0.22,
    autoIntercept: 0.50,
    manualIntercept: 0.75,
    blastRadius: 35,
    trailColor: '#2288ff',
    launchFromOcean: true,
    description: 'Submarine-launched. No supply line cost. Stealth.',
    siteCooldown: 8,
  },
  hypersonic: {
    name: 'Hypersonic',      // UNSTOPPABLE
    key: '6',
    unlockAt: 300,
    cost: 35,
    baseFlight: 1.5,
    distFactor: 1,
    damage: 0.22,
    autoIntercept: 0.15,     // nearly impossible to stop
    manualIntercept: 0.35,
    blastRadius: 30,
    trailColor: '#ff2266',
    description: 'Blazing fast. Nearly uninterceptable.',
    siteCooldown: 7,
  },
  nuke: {
    name: 'NUCLEAR',         // ENDGAME
    key: 'n',
    unlockAt: 480,
    cost: 75,
    baseFlight: 8,
    distFactor: 4,
    damage: 0.75,            // half a city in one hit
    autoIntercept: 0.45,
    manualIntercept: 0.70,
    blastRadius: 80,
    trailColor: '#ff0000',
    contamination: true,
    contaminationDuration: 90,
    contaminationDamage: 0.015, // 1.5%/s for 90s on nearby cities
    isNuke: true,
    description: 'Endgame. 50% city damage + 90s radiation. Changes everything.',
    siteCooldown: 15,
  },
};

export const DEFAULT_MISSILE_TYPE = 'tactical';

// === Victory Conditions ===
export const ECONOMIC_VICTORY_TOKENS = 500;     // accumulate this many tokens at once
export const DIPLOMATIC_VICTORY_PERCENT = 0.6;  // ally with 60% of surviving nations

// === Escalation ===
export const ESCALATION_START = 900;       // 15 minutes — longer build-up
export const ESCALATION_INTERVAL = 90;     // 1.5 min per tick
export const ESCALATION_TICKS = 5;
export const MATCH_TIMEOUT = 1500;         // 25 minutes

// === Token Economy ===
export const TOKEN_RATES = {
  1: 1.5, // Superpower
  2: 1.2, // Major power
  3: 0.9, // Regional power
};
export const TOKEN_CAPS = {
  1: 200,
  2: 150,
  3: 100,
};

// === Diplomacy ===
export const REL_ALLIED_THRESHOLD = 50;    // ≥50 = can form alliance
export const REL_HOSTILE_THRESHOLD = -50;  // ≤-50 = actively hostile
export const REL_ALLIANCE_BREAK = -20;     // alliance auto-breaks below this
export const REL_ATTACK_PENALTY = -40;     // relationship hit when you attack someone
export const REL_ATTACK_ALLY_PENALTY = -15;// hit with their allies when you attack
export const REL_ALLIANCE_BONUS = 50;      // bonus when alliance formed
export const REL_BREAK_PENALTY = -60;      // penalty when alliance broken
export const REL_BREAK_ALLY_PENALTY = -20; // penalty with their other allies
export const REL_DRIFT_RATE = 1;           // +1 per 30s for allies
export const REL_DRIFT_INTERVAL = 30;      // seconds
export const REL_SAME_BLOC_START = 70;     // starting relationship within same bloc
export const REL_CROSS_BLOC_START = -60;   // starting relationship across hostile blocs
export const REL_NEUTRAL_START = -5;       // default starting relationship (slightly tense)
export const AI_SURRENDER_THRESHOLD = 0.15;// AI surrenders at 15% population
export const INVASION_THRESHOLD = 0.25;    // can invade below 25% population
export const INVASION_BASE_COST = 40;      // base token cost to invade
export const SATELLITE_LAUNCH_COST = 30;   // tokens to launch an additional satellite
export const MAX_SATELLITES = 5;           // maximum satellites in orbit

// === Interceptors ===
export const INTERCEPTOR_COST = 12; // tokens to place a battery — real investment
export const INTERCEPTOR_RANGE = 0.12; // radians (~760km) — tighter coverage, forces more batteries
export const INTERCEPTOR_COOLDOWN = 8; // seconds between shots — can't stop rapid fire
export const INTERCEPT_AUTO_SUCCESS = 0.60; // 60% auto-intercept
export const INTERCEPT_MANUAL_SUCCESS = 0.85; // 85% manual intercept
export const INTERCEPT_TRAIL_DURATION = 500; // ms
export const INTERCEPT_FLASH_DURATION = 400; // ms
export const MAX_BATTERIES = {
  1: 5, // Superpower
  2: 4, // Major power
  3: 3, // Regional power
};

// === Production ===
// Per-missile-type build config. Time in seconds at base factory speed.
// fissile/rareEarth consumed when a build *starts* at a factory (head of queue).
export const PRODUCTION = {
  drone:      { buildTime: 3,  fissile: 0, rareEarth: 0 },
  tactical:   { buildTime: 5,  fissile: 0, rareEarth: 0 },
  cruise:     { buildTime: 8,  fissile: 0, rareEarth: 0 },
  decoy:      { buildTime: 4,  fissile: 0, rareEarth: 0 },
  icbm:       { buildTime: 15, fissile: 1, rareEarth: 0 },
  dirty_bomb: { buildTime: 10, fissile: 1, rareEarth: 0 },
  emp:        { buildTime: 12, fissile: 0, rareEarth: 1 },
  mirv:       { buildTime: 30, fissile: 3, rareEarth: 0 },
  slbm:       { buildTime: 18, fissile: 1, rareEarth: 0 },
  hypersonic: { buildTime: 20, fissile: 1, rareEarth: 1 },
  nuke:       { buildTime: 40, fissile: 4, rareEarth: 0 },
};

export const STARTING_FACTORIES = 2;
export const STARTING_STOCKPILE = { tactical: 5 };
export const SILO_CAPACITY = 4; // max loaded missiles per silo

// Per-node per-second yield for strategic stockpile resources
export const FISSILE_PER_URANIUM_NODE = 0.25;
export const RAREEARTH_PER_NODE = 0.25;

// === AI ===
export const AI_WARMUP = 0; // no grace period — war starts immediately
export const AI_LAUNCH_COOLDOWN = 20000; // ms — AI fires every ~20s
export const AI_COOLDOWN_VARIANCE = 0.4; // ±40% randomness (12-28s)
export const AI_BATTERY_INTERVAL = 25000; // ms
