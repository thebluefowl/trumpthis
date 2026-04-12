// Resource nodes placed at strategic real-world locations
// Types: oil (token bonus), uranium (required for MIRV research), rare_earth (required for EMP research)

export const RESOURCE_NODES = [
  // Oil fields — +1.5 tokens/sec
  { id: 'oil_persian_gulf', type: 'oil', name: 'Persian Gulf', coords: [51.5, 26.0], bonus: 1.5 },
  { id: 'oil_siberia', type: 'oil', name: 'West Siberia', coords: [73.0, 61.0], bonus: 1.5 },
  { id: 'oil_gulf_mexico', type: 'oil', name: 'Gulf of Mexico', coords: [-90.0, 25.0], bonus: 1.5 },
  { id: 'oil_north_sea', type: 'oil', name: 'North Sea', coords: [2.0, 57.0], bonus: 1.5 },
  { id: 'oil_venezuela', type: 'oil', name: 'Orinoco Belt', coords: [-64.0, 8.0], bonus: 1.5 },

  // Uranium deposits — +0.8 tokens/sec, unlocks MIRV research
  { id: 'uranium_kazakhstan', type: 'uranium', name: 'Kazakhstan Steppe', coords: [67.0, 48.0], bonus: 0.8 },
  { id: 'uranium_australia', type: 'uranium', name: 'South Australia', coords: [137.0, -30.0], bonus: 0.8 },
  { id: 'uranium_canada', type: 'uranium', name: 'Saskatchewan', coords: [-106.0, 52.0], bonus: 0.8 },
  { id: 'uranium_niger', type: 'uranium', name: 'Arlit Mines', coords: [7.4, 18.7], bonus: 0.8 },

  // Rare earth — +0.8 tokens/sec, unlocks EMP research
  { id: 'rare_china', type: 'rare_earth', name: 'Inner Mongolia', coords: [110.0, 41.0], bonus: 0.8 },
  { id: 'rare_congo', type: 'rare_earth', name: 'Katanga Province', coords: [27.0, -11.0], bonus: 0.8 },
  { id: 'rare_brazil', type: 'rare_earth', name: 'Araxá Deposit', coords: [-46.9, -19.6], bonus: 0.8 },
  { id: 'rare_greenland', type: 'rare_earth', name: 'Kvanefjeld', coords: [-46.0, 61.0], bonus: 0.8 },
];

export const RESOURCE_COLORS = {
  oil: '#f59e0b',       // amber/gold
  uranium: '#22d3ee',   // cyan
  rare_earth: '#a78bfa', // purple
};

export const RESOURCE_ICONS = {
  oil: '◉',
  uranium: '⬡',
  rare_earth: '◈',
};
