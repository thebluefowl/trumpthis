// 35 playable nations grouped by tier
// ISO 3166-1 numeric IDs match world-atlas countries-110m.json
// Launch site coordinates are [longitude, latitude] at real military/strategic locations

export const COUNTRIES = [
  // === TIER 1: Superpowers (3 launch sites) ===
  {
    id: '840',
    name: 'United States',
    tier: 1,
    population: 331_000_000,
    launchSites: [
      [-104.8, 41.1],  // Wyoming (Minuteman fields)
      [-119.5, 35.4],  // Vandenberg AFB
      [-80.6, 28.5],   // Cape Canaveral
    ],
    centroid: [-98.5, 39.8],
  },
  {
    id: '643',
    name: 'Russia',
    tier: 1,
    population: 144_100_000,
    launchSites: [
      [55.8, 51.8],    // Orenburg region
      [84.0, 56.0],    // Novosibirsk
      [131.9, 43.1],   // Vladivostok
    ],
    centroid: [90.0, 60.0],
  },
  {
    id: '156',
    name: 'China',
    tier: 1,
    population: 1_412_000_000,
    launchSites: [
      [100.3, 40.0],   // Jiuquan
      [111.6, 28.2],   // Hunan
      [109.5, 19.6],   // Hainan
    ],
    centroid: [104.0, 35.0],
  },

  // === TIER 2: Major Powers (2 launch sites) ===
  {
    id: '826',
    name: 'United Kingdom',
    tier: 2,
    population: 67_000_000,
    launchSites: [
      [-4.5, 56.0],    // Faslane (submarine base)
      [-1.2, 51.8],    // RAF Brize Norton
    ],
    centroid: [-2.0, 54.0],
  },
  {
    id: '250',
    name: 'France',
    tier: 2,
    population: 67_400_000,
    launchSites: [
      [-4.5, 48.4],    // Île Longue (submarine base)
      [5.1, 43.9],     // Plateau d'Albion region
    ],
    centroid: [2.5, 46.5],
  },
  {
    id: '356',
    name: 'India',
    tier: 2,
    population: 1_408_000_000,
    launchSites: [
      [80.2, 15.5],    // Abdul Kalam Island
      [77.6, 13.0],    // Bangalore DRDO
    ],
    centroid: [79.0, 22.0],
  },
  {
    id: '586',
    name: 'Pakistan',
    tier: 2,
    population: 231_000_000,
    launchSites: [
      [66.9, 25.1],    // Sonmiani
      [73.0, 33.7],    // Islamabad region
    ],
    centroid: [70.0, 30.0],
  },
  {
    id: '376',
    name: 'Israel',
    tier: 2,
    population: 9_300_000,
    launchSites: [
      [34.7, 31.2],    // Palmachim AFB
      [35.0, 30.0],    // Negev (Dimona)
    ],
    centroid: [34.8, 31.5],
  },
  {
    id: '408',
    name: 'North Korea',
    tier: 2,
    population: 26_000_000,
    launchSites: [
      [125.7, 39.0],   // Pyongyang region
      [129.7, 40.9],   // Musudan-ri
    ],
    centroid: [127.0, 40.0],
  },
  {
    id: '364',
    name: 'Iran',
    tier: 2,
    population: 87_000_000,
    launchSites: [
      [53.7, 35.7],    // Semnan space center
      [51.4, 35.7],    // Tehran region
    ],
    centroid: [53.0, 32.0],
  },
  {
    id: '392',
    name: 'Japan',
    tier: 2,
    population: 125_000_000,
    launchSites: [
      [131.1, 31.3],   // Tanegashima
      [140.0, 36.0],   // Tsukuba
    ],
    centroid: [138.0, 36.0],
  },
  {
    id: '276',
    name: 'Germany',
    tier: 2,
    population: 83_000_000,
    launchSites: [
      [11.6, 48.1],    // Munich region
      [13.4, 52.5],    // Berlin region
    ],
    centroid: [10.5, 51.0],
  },
  {
    id: '076',
    name: 'Brazil',
    tier: 2,
    population: 214_000_000,
    launchSites: [
      [-44.4, -2.3],   // Alcântara Launch Center
      [-45.9, -23.2],  // São José dos Campos
    ],
    centroid: [-53.0, -10.0],
  },

  // === TIER 3: Regional Powers (1 launch site) ===
  {
    id: '410',
    name: 'South Korea',
    tier: 3,
    population: 52_000_000,
    launchSites: [
      [127.0, 36.0],   // Daejeon
    ],
    centroid: [127.5, 36.5],
  },
  {
    id: '792',
    name: 'Turkey',
    tier: 3,
    population: 85_000_000,
    launchSites: [
      [32.9, 39.9],    // Ankara region
    ],
    centroid: [35.0, 39.0],
  },
  {
    id: '818',
    name: 'Egypt',
    tier: 3,
    population: 104_000_000,
    launchSites: [
      [31.2, 30.0],    // Cairo region
    ],
    centroid: [30.0, 27.0],
  },
  {
    id: '682',
    name: 'Saudi Arabia',
    tier: 3,
    population: 36_000_000,
    launchSites: [
      [46.7, 24.7],    // Riyadh region
    ],
    centroid: [45.0, 24.0],
  },
  {
    id: '036',
    name: 'Australia',
    tier: 3,
    population: 26_000_000,
    launchSites: [
      [136.8, -31.4],  // Woomera
    ],
    centroid: [134.0, -25.0],
  },
  {
    id: '124',
    name: 'Canada',
    tier: 3,
    population: 39_000_000,
    launchSites: [
      [-75.7, 45.4],   // Ottawa region
    ],
    centroid: [-106.0, 56.0],
  },
  {
    id: '380',
    name: 'Italy',
    tier: 3,
    population: 60_000_000,
    launchSites: [
      [12.5, 41.9],    // Rome region
    ],
    centroid: [12.5, 42.5],
  },
  {
    id: '724',
    name: 'Spain',
    tier: 3,
    population: 47_000_000,
    launchSites: [
      [-3.7, 40.4],    // Madrid region
    ],
    centroid: [-3.5, 40.0],
  },
  {
    id: '616',
    name: 'Poland',
    tier: 3,
    population: 38_000_000,
    launchSites: [
      [21.0, 52.2],    // Warsaw region
    ],
    centroid: [19.5, 52.0],
  },
  {
    id: '804',
    name: 'Ukraine',
    tier: 3,
    population: 44_000_000,
    launchSites: [
      [30.5, 50.4],    // Kyiv region
    ],
    centroid: [32.0, 49.0],
  },
  {
    id: '710',
    name: 'South Africa',
    tier: 3,
    population: 60_000_000,
    launchSites: [
      [28.0, -26.2],   // Pretoria region
    ],
    centroid: [25.0, -29.0],
  },
  {
    id: '360',
    name: 'Indonesia',
    tier: 3,
    population: 275_000_000,
    launchSites: [
      [106.8, -6.2],   // Jakarta region
    ],
    centroid: [118.0, -2.0],
  },
  {
    id: '484',
    name: 'Mexico',
    tier: 3,
    population: 130_000_000,
    launchSites: [
      [-99.1, 19.4],   // Mexico City region
    ],
    centroid: [-102.0, 23.0],
  },
  {
    id: '032',
    name: 'Argentina',
    tier: 3,
    population: 46_000_000,
    launchSites: [
      [-58.5, -34.6],  // Buenos Aires region
    ],
    centroid: [-64.0, -34.0],
  },
  {
    id: '566',
    name: 'Nigeria',
    tier: 3,
    population: 218_000_000,
    launchSites: [
      [3.4, 6.5],      // Lagos region
    ],
    centroid: [8.0, 10.0],
  },
  {
    id: '764',
    name: 'Thailand',
    tier: 3,
    population: 72_000_000,
    launchSites: [
      [100.5, 13.8],   // Bangkok region
    ],
    centroid: [101.0, 15.0],
  },
  {
    id: '704',
    name: 'Vietnam',
    tier: 3,
    population: 99_000_000,
    launchSites: [
      [105.8, 21.0],   // Hanoi region
    ],
    centroid: [107.0, 16.0],
  },
  {
    id: '158',
    name: 'Taiwan',
    tier: 3,
    population: 24_000_000,
    launchSites: [
      [121.5, 25.0],   // Taipei region
    ],
    centroid: [121.0, 23.5],
  },
  {
    id: '752',
    name: 'Sweden',
    tier: 3,
    population: 10_500_000,
    launchSites: [
      [18.1, 59.3],    // Stockholm region
    ],
    centroid: [16.0, 62.0],
  },
  {
    id: '578',
    name: 'Norway',
    tier: 3,
    population: 5_500_000,
    launchSites: [
      [10.8, 59.9],    // Oslo region
    ],
    centroid: [10.0, 62.0],
  },
];

// Lookup map by ID
export const COUNTRY_MAP = new Map(COUNTRIES.map(c => [c.id, c]));

// Set of playable country IDs
export const PLAYABLE_IDS = new Set(COUNTRIES.map(c => c.id));
