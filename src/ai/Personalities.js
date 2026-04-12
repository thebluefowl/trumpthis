// AI personality archetypes — each affects target selection, diplomacy, weapon choice, risk tolerance

export const PERSONALITY_TYPES = {
  aggressive: {
    name: 'Aggressive',
    attackBias: 1.5,        // attacks more often
    defenseBias: 0.6,       // builds fewer batteries
    diplomacyBias: 0.5,     // rarely proposes alliances
    betrayalThreshold: 40,  // breaks alliances easily (higher = breaks sooner)
    invasionBias: 2.0,      // very eager to invade
    nukeBias: 1.5,          // more willing to use nukes
    preferredWeapons: ['icbm', 'mirv', 'hypersonic', 'nuke'],
    targetWeakest: false,   // targets strongest threats
  },
  defensive: {
    name: 'Defensive',
    attackBias: 0.5,        // attacks less
    defenseBias: 2.0,       // builds many batteries
    diplomacyBias: 1.5,     // seeks alliances for mutual defense
    betrayalThreshold: 15,  // very loyal
    invasionBias: 0.3,      // rarely invades
    nukeBias: 0.2,          // avoids nukes
    preferredWeapons: ['tactical', 'cruise', 'emp', 'decoy'],
    targetWeakest: false,   // only retaliates against attackers
  },
  diplomatic: {
    name: 'Diplomatic',
    attackBias: 0.7,        // moderate attacks
    defenseBias: 1.0,       // balanced defense
    diplomacyBias: 2.5,     // constantly seeking alliances
    betrayalThreshold: 10,  // extremely loyal
    invasionBias: 0.5,      // prefers diplomacy over conquest
    nukeBias: 0.1,          // almost never nukes
    preferredWeapons: ['tactical', 'cruise', 'drone'],
    targetWeakest: false,
  },
  opportunist: {
    name: 'Opportunist',
    attackBias: 1.0,        // balanced
    defenseBias: 1.0,
    diplomacyBias: 1.0,     // allies when convenient
    betrayalThreshold: 35,  // breaks alliances for advantage
    invasionBias: 1.5,      // opportunistic invasions
    nukeBias: 0.8,
    preferredWeapons: ['cruise', 'icbm', 'dirty_bomb', 'slbm'],
    targetWeakest: true,    // picks off the weak
  },
  rogue: {
    name: 'Rogue',
    attackBias: 1.3,        // aggressive but unpredictable
    defenseBias: 0.8,
    diplomacyBias: 0.3,     // distrusts everyone
    betrayalThreshold: 50,  // betrays constantly
    invasionBias: 1.0,
    nukeBias: 2.0,          // nuke-happy
    preferredWeapons: ['dirty_bomb', 'emp', 'nuke', 'hypersonic'],
    targetWeakest: false,   // attacks randomly (handled in target selection)
  },
  superpower: {
    name: 'Superpower',
    attackBias: 1.2,
    defenseBias: 1.5,       // invests heavily in both
    diplomacyBias: 1.2,     // maintains strategic alliances
    betrayalThreshold: 25,
    invasionBias: 1.3,
    nukeBias: 1.0,
    preferredWeapons: ['icbm', 'mirv', 'slbm', 'hypersonic'],
    targetWeakest: false,
  },
};

// Assign personalities to each nation
export const NATION_PERSONALITIES = {
  // Superpowers
  '840': 'superpower',     // USA
  '643': 'aggressive',     // Russia
  '156': 'superpower',     // China

  // Major Powers
  '826': 'diplomatic',     // United Kingdom
  '250': 'diplomatic',     // France
  '356': 'defensive',      // India
  '586': 'rogue',          // Pakistan
  '376': 'rogue',          // Israel
  '408': 'rogue',          // North Korea
  '364': 'aggressive',     // Iran
  '392': 'defensive',      // Japan
  '276': 'diplomatic',     // Germany
  '076': 'diplomatic',     // Brazil

  // Regional Powers
  '410': 'defensive',      // South Korea
  '792': 'opportunist',    // Turkey
  '818': 'opportunist',    // Egypt
  '682': 'opportunist',    // Saudi Arabia
  '036': 'defensive',      // Australia
  '124': 'diplomatic',     // Canada
  '380': 'diplomatic',     // Italy
  '724': 'diplomatic',     // Spain
  '616': 'defensive',      // Poland
  '804': 'aggressive',     // Ukraine
  '710': 'opportunist',    // South Africa
  '360': 'defensive',      // Indonesia
  '484': 'opportunist',    // Mexico
  '032': 'opportunist',    // Argentina
  '566': 'opportunist',    // Nigeria
  '764': 'defensive',      // Thailand
  '704': 'defensive',      // Vietnam
  '158': 'defensive',      // Taiwan
  '752': 'diplomatic',     // Sweden
  '578': 'diplomatic',     // Norway
};

export function getPersonality(countryId) {
  const typeKey = NATION_PERSONALITIES[countryId] || 'opportunist';
  return PERSONALITY_TYPES[typeKey];
}

export function getPersonalityName(countryId) {
  const typeKey = NATION_PERSONALITIES[countryId] || 'opportunist';
  return PERSONALITY_TYPES[typeKey].name;
}
