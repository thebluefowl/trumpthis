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
export const STARTING_TOKENS = 50;
export const MISSILE_COST = 10;
export const MISSILE_SPEED = 0.12; // progress per second (0→1), ~8s flight time
export const EXPLOSION_DURATION = 2000; // ms
export const TRAIL_FADE_TIME = 3000; // ms
export const DAMAGE_PER_HIT = 0.05; // 5% of current population
export const POPULATION_SCALE = 1000; // scale real pop down for display

// === Token Economy ===
export const TOKEN_RATES = {
  1: 5, // Superpower: 5 tokens/sec
  2: 4, // Major power
  3: 3, // Regional power
};
export const TOKEN_CAPS = {
  1: 150,
  2: 100,
  3: 75,
};

// === AI ===
export const AI_LAUNCH_COOLDOWN = 8000; // ms between AI launches (Easy)
export const AI_COOLDOWN_VARIANCE = 0.6; // ±60% randomness
