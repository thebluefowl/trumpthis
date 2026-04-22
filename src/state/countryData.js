// 35 playable nations grouped by tier
// Each nation has cities (population centers), launch sites, and a centroid
// Cities distribute the nation's population — destroying cities kills population proportionally

export const COUNTRIES = [
  // === TIER 1: Superpowers (3 launch sites, 5 cities) ===
  {
    id: '840', name: 'United States', tier: 1, population: 331_000_000,
    launchSites: [[-104.8, 41.1], [-119.5, 35.4], [-80.6, 28.5]],
    cities: [
      { name: 'New York', coords: [-74.0, 40.7], popShare: 0.25 },
      { name: 'Los Angeles', coords: [-118.2, 34.1], popShare: 0.20 },
      { name: 'Chicago', coords: [-87.6, 41.9], popShare: 0.18 },
      { name: 'Houston', coords: [-95.4, 29.8], popShare: 0.17 },
      { name: 'Washington DC', coords: [-77.0, 38.9], popShare: 0.20 },
    ],
    centroid: [-98.5, 39.8],
  },
  {
    id: '643', name: 'Russia', tier: 1, population: 144_100_000,
    launchSites: [[55.8, 51.8], [84.0, 56.0], [131.9, 43.1]],
    cities: [
      { name: 'Moscow', coords: [37.6, 55.8], popShare: 0.30 },
      { name: 'St Petersburg', coords: [30.3, 59.9], popShare: 0.20 },
      { name: 'Novosibirsk', coords: [82.9, 55.0], popShare: 0.15 },
      { name: 'Yekaterinburg', coords: [60.6, 56.8], popShare: 0.15 },
      { name: 'Vladivostok', coords: [131.9, 43.1], popShare: 0.20 },
    ],
    centroid: [90.0, 60.0],
  },
  {
    id: '156', name: 'China', tier: 1, population: 1_412_000_000,
    launchSites: [[100.3, 40.0], [111.6, 28.2], [109.5, 19.6]],
    cities: [
      { name: 'Beijing', coords: [116.4, 39.9], popShare: 0.20 },
      { name: 'Shanghai', coords: [121.5, 31.2], popShare: 0.22 },
      { name: 'Guangzhou', coords: [113.3, 23.1], popShare: 0.20 },
      { name: 'Chengdu', coords: [104.1, 30.6], popShare: 0.18 },
      { name: 'Wuhan', coords: [114.3, 30.6], popShare: 0.20 },
    ],
    centroid: [104.0, 35.0],
  },

  // === TIER 2: Major Powers (2 launch sites, 4 cities) ===
  {
    id: '826', name: 'United Kingdom', tier: 2, population: 67_000_000,
    launchSites: [[-4.5, 56.0], [-1.2, 51.8]],
    cities: [
      { name: 'London', coords: [-0.1, 51.5], popShare: 0.35 },
      { name: 'Birmingham', coords: [-1.9, 52.5], popShare: 0.25 },
      { name: 'Manchester', coords: [-2.2, 53.5], popShare: 0.20 },
      { name: 'Edinburgh', coords: [-3.2, 55.9], popShare: 0.20 },
    ],
    centroid: [-2.0, 54.0],
  },
  {
    id: '250', name: 'France', tier: 2, population: 67_400_000,
    launchSites: [[-4.5, 48.4], [5.1, 43.9]],
    cities: [
      { name: 'Paris', coords: [2.3, 48.9], popShare: 0.35 },
      { name: 'Marseille', coords: [5.4, 43.3], popShare: 0.25 },
      { name: 'Lyon', coords: [4.8, 45.8], popShare: 0.20 },
      { name: 'Toulouse', coords: [1.4, 43.6], popShare: 0.20 },
    ],
    centroid: [2.5, 46.5],
  },
  {
    id: '356', name: 'India', tier: 2, population: 1_408_000_000,
    launchSites: [[80.2, 15.5], [77.6, 13.0]],
    cities: [
      { name: 'Delhi', coords: [77.2, 28.6], popShare: 0.25 },
      { name: 'Mumbai', coords: [72.9, 19.1], popShare: 0.25 },
      { name: 'Bangalore', coords: [77.6, 12.97], popShare: 0.20 },
      { name: 'Kolkata', coords: [88.4, 22.6], popShare: 0.15 },
      { name: 'Chennai', coords: [80.3, 13.1], popShare: 0.15 },
    ],
    centroid: [79.0, 22.0],
  },
  {
    id: '586', name: 'Pakistan', tier: 2, population: 231_000_000,
    launchSites: [[66.9, 25.1], [73.0, 33.7]],
    cities: [
      { name: 'Karachi', coords: [67.0, 24.9], popShare: 0.30 },
      { name: 'Lahore', coords: [74.3, 31.6], popShare: 0.25 },
      { name: 'Islamabad', coords: [73.0, 33.7], popShare: 0.25 },
      { name: 'Faisalabad', coords: [73.1, 31.4], popShare: 0.20 },
    ],
    centroid: [70.0, 30.0],
  },
  {
    id: '376', name: 'Israel', tier: 2, population: 9_300_000,
    launchSites: [[34.7, 31.2], [35.0, 30.0]],
    cities: [
      { name: 'Tel Aviv', coords: [34.8, 32.1], popShare: 0.40 },
      { name: 'Jerusalem', coords: [35.2, 31.8], popShare: 0.35 },
      { name: 'Haifa', coords: [35.0, 32.8], popShare: 0.25 },
    ],
    centroid: [34.8, 31.5],
  },
  {
    id: '408', name: 'North Korea', tier: 2, population: 26_000_000,
    launchSites: [[125.7, 39.0], [129.7, 40.9]],
    cities: [
      { name: 'Pyongyang', coords: [125.8, 39.0], popShare: 0.45 },
      { name: 'Hamhung', coords: [127.5, 39.9], popShare: 0.30 },
      { name: 'Chongjin', coords: [129.8, 41.8], popShare: 0.25 },
    ],
    centroid: [127.0, 40.0],
  },
  {
    id: '364', name: 'Iran', tier: 2, population: 87_000_000,
    launchSites: [[53.7, 35.7], [51.4, 35.7]],
    cities: [
      { name: 'Tehran', coords: [51.4, 35.7], popShare: 0.30 },
      { name: 'Isfahan', coords: [51.7, 32.7], popShare: 0.25 },
      { name: 'Mashhad', coords: [59.6, 36.3], popShare: 0.25 },
      { name: 'Shiraz', coords: [52.5, 29.6], popShare: 0.20 },
    ],
    centroid: [53.0, 32.0],
  },
  {
    id: '392', name: 'Japan', tier: 2, population: 125_000_000,
    launchSites: [[131.1, 31.3], [140.0, 36.0]],
    cities: [
      { name: 'Tokyo', coords: [139.7, 35.7], popShare: 0.35 },
      { name: 'Osaka', coords: [135.5, 34.7], popShare: 0.25 },
      { name: 'Nagoya', coords: [136.9, 35.2], popShare: 0.20 },
      { name: 'Fukuoka', coords: [130.4, 33.6], popShare: 0.20 },
    ],
    centroid: [138.0, 36.0],
  },
  {
    id: '276', name: 'Germany', tier: 2, population: 83_000_000,
    launchSites: [[11.6, 48.1], [13.4, 52.5]],
    cities: [
      { name: 'Berlin', coords: [13.4, 52.5], popShare: 0.25 },
      { name: 'Munich', coords: [11.6, 48.1], popShare: 0.25 },
      { name: 'Hamburg', coords: [10.0, 53.5], popShare: 0.25 },
      { name: 'Frankfurt', coords: [8.7, 50.1], popShare: 0.25 },
    ],
    centroid: [10.5, 51.0],
  },
  {
    id: '076', name: 'Brazil', tier: 2, population: 214_000_000,
    launchSites: [[-44.4, -2.3], [-45.9, -23.2]],
    cities: [
      { name: 'São Paulo', coords: [-46.6, -23.5], popShare: 0.30 },
      { name: 'Rio de Janeiro', coords: [-43.2, -22.9], popShare: 0.25 },
      { name: 'Brasília', coords: [-47.9, -15.8], popShare: 0.20 },
      { name: 'Salvador', coords: [-38.5, -12.97], popShare: 0.25 },
    ],
    centroid: [-53.0, -10.0],
  },

  // === TIER 3: Regional Powers (1 launch site, 3 cities) ===
  {
    id: '410', name: 'South Korea', tier: 3, population: 52_000_000,
    launchSites: [[127.0, 36.0]],
    cities: [
      { name: 'Seoul', coords: [127.0, 37.6], popShare: 0.45 },
      { name: 'Busan', coords: [129.1, 35.2], popShare: 0.30 },
      { name: 'Incheon', coords: [126.7, 37.5], popShare: 0.25 },
    ],
    centroid: [127.5, 36.5],
  },
  {
    id: '792', name: 'Turkey', tier: 3, population: 85_000_000,
    launchSites: [[32.9, 39.9]],
    cities: [
      { name: 'Istanbul', coords: [29.0, 41.0], popShare: 0.40 },
      { name: 'Ankara', coords: [32.9, 39.9], popShare: 0.30 },
      { name: 'Izmir', coords: [27.1, 38.4], popShare: 0.30 },
    ],
    centroid: [35.0, 39.0],
  },
  {
    id: '818', name: 'Egypt', tier: 3, population: 104_000_000,
    launchSites: [[31.2, 30.0]],
    cities: [
      { name: 'Cairo', coords: [31.2, 30.0], popShare: 0.45 },
      { name: 'Alexandria', coords: [29.9, 31.2], popShare: 0.30 },
      { name: 'Giza', coords: [31.2, 30.0], popShare: 0.25 },
    ],
    centroid: [30.0, 27.0],
  },
  {
    id: '682', name: 'Saudi Arabia', tier: 3, population: 36_000_000,
    launchSites: [[46.7, 24.7]],
    cities: [
      { name: 'Riyadh', coords: [46.7, 24.7], popShare: 0.40 },
      { name: 'Jeddah', coords: [39.2, 21.5], popShare: 0.35 },
      { name: 'Dammam', coords: [50.1, 26.4], popShare: 0.25 },
    ],
    centroid: [45.0, 24.0],
  },
  {
    id: '036', name: 'Australia', tier: 3, population: 26_000_000,
    launchSites: [[136.8, -31.4]],
    cities: [
      { name: 'Sydney', coords: [151.2, -33.9], popShare: 0.40 },
      { name: 'Melbourne', coords: [144.97, -37.8], popShare: 0.35 },
      { name: 'Brisbane', coords: [153.0, -27.5], popShare: 0.25 },
    ],
    centroid: [134.0, -25.0],
  },
  {
    id: '124', name: 'Canada', tier: 3, population: 39_000_000,
    launchSites: [[-75.7, 45.4]],
    cities: [
      { name: 'Toronto', coords: [-79.4, 43.7], popShare: 0.40 },
      { name: 'Montreal', coords: [-73.6, 45.5], popShare: 0.30 },
      { name: 'Vancouver', coords: [-123.1, 49.3], popShare: 0.30 },
    ],
    centroid: [-106.0, 56.0],
  },
  {
    id: '380', name: 'Italy', tier: 3, population: 60_000_000,
    launchSites: [[12.5, 41.9]],
    cities: [
      { name: 'Rome', coords: [12.5, 41.9], popShare: 0.35 },
      { name: 'Milan', coords: [9.2, 45.5], popShare: 0.35 },
      { name: 'Naples', coords: [14.3, 40.8], popShare: 0.30 },
    ],
    centroid: [12.5, 42.5],
  },
  {
    id: '724', name: 'Spain', tier: 3, population: 47_000_000,
    launchSites: [[-3.7, 40.4]],
    cities: [
      { name: 'Madrid', coords: [-3.7, 40.4], popShare: 0.40 },
      { name: 'Barcelona', coords: [2.2, 41.4], popShare: 0.35 },
      { name: 'Seville', coords: [-6.0, 37.4], popShare: 0.25 },
    ],
    centroid: [-3.5, 40.0],
  },
  {
    id: '616', name: 'Poland', tier: 3, population: 38_000_000,
    launchSites: [[21.0, 52.2]],
    cities: [
      { name: 'Warsaw', coords: [21.0, 52.2], popShare: 0.40 },
      { name: 'Kraków', coords: [19.9, 50.1], popShare: 0.30 },
      { name: 'Gdańsk', coords: [18.6, 54.4], popShare: 0.30 },
    ],
    centroid: [19.5, 52.0],
  },
  {
    id: '804', name: 'Ukraine', tier: 3, population: 44_000_000,
    launchSites: [[30.5, 50.4]],
    cities: [
      { name: 'Kyiv', coords: [30.5, 50.4], popShare: 0.40 },
      { name: 'Kharkiv', coords: [36.2, 49.99], popShare: 0.30 },
      { name: 'Odesa', coords: [30.7, 46.5], popShare: 0.30 },
    ],
    centroid: [32.0, 49.0],
  },
  {
    id: '710', name: 'South Africa', tier: 3, population: 60_000_000,
    launchSites: [[28.0, -26.2]],
    cities: [
      { name: 'Johannesburg', coords: [28.0, -26.2], popShare: 0.40 },
      { name: 'Cape Town', coords: [18.4, -33.9], popShare: 0.35 },
      { name: 'Durban', coords: [31.0, -29.9], popShare: 0.25 },
    ],
    centroid: [25.0, -29.0],
  },
  {
    id: '360', name: 'Indonesia', tier: 3, population: 275_000_000,
    launchSites: [[106.8, -6.2]],
    cities: [
      { name: 'Jakarta', coords: [106.8, -6.2], popShare: 0.40 },
      { name: 'Surabaya', coords: [112.8, -7.3], popShare: 0.30 },
      { name: 'Bandung', coords: [107.6, -6.9], popShare: 0.30 },
    ],
    centroid: [118.0, -2.0],
  },
  {
    id: '484', name: 'Mexico', tier: 3, population: 130_000_000,
    launchSites: [[-99.1, 19.4]],
    cities: [
      { name: 'Mexico City', coords: [-99.1, 19.4], popShare: 0.40 },
      { name: 'Guadalajara', coords: [-103.3, 20.7], popShare: 0.30 },
      { name: 'Monterrey', coords: [-100.3, 25.7], popShare: 0.30 },
    ],
    centroid: [-102.0, 23.0],
  },
  {
    id: '032', name: 'Argentina', tier: 3, population: 46_000_000,
    launchSites: [[-58.5, -34.6]],
    cities: [
      { name: 'Buenos Aires', coords: [-58.4, -34.6], popShare: 0.50 },
      { name: 'Córdoba', coords: [-64.2, -31.4], popShare: 0.25 },
      { name: 'Rosario', coords: [-60.7, -32.9], popShare: 0.25 },
    ],
    centroid: [-64.0, -34.0],
  },
  {
    id: '566', name: 'Nigeria', tier: 3, population: 218_000_000,
    launchSites: [[3.4, 6.5]],
    cities: [
      { name: 'Lagos', coords: [3.4, 6.5], popShare: 0.40 },
      { name: 'Abuja', coords: [7.5, 9.1], popShare: 0.30 },
      { name: 'Kano', coords: [8.5, 12.0], popShare: 0.30 },
    ],
    centroid: [8.0, 10.0],
  },
  {
    id: '764', name: 'Thailand', tier: 3, population: 72_000_000,
    launchSites: [[100.5, 13.8]],
    cities: [
      { name: 'Bangkok', coords: [100.5, 13.8], popShare: 0.50 },
      { name: 'Chiang Mai', coords: [98.97, 18.8], popShare: 0.25 },
      { name: 'Pattaya', coords: [100.9, 12.9], popShare: 0.25 },
    ],
    centroid: [101.0, 15.0],
  },
  {
    id: '704', name: 'Vietnam', tier: 3, population: 99_000_000,
    launchSites: [[105.8, 21.0]],
    cities: [
      { name: 'Hanoi', coords: [105.8, 21.0], popShare: 0.35 },
      { name: 'Ho Chi Minh', coords: [106.7, 10.8], popShare: 0.40 },
      { name: 'Da Nang', coords: [108.2, 16.1], popShare: 0.25 },
    ],
    centroid: [107.0, 16.0],
  },
  {
    id: '158', name: 'Taiwan', tier: 3, population: 24_000_000,
    launchSites: [[121.5, 25.0]],
    cities: [
      { name: 'Taipei', coords: [121.5, 25.0], popShare: 0.45 },
      { name: 'Kaohsiung', coords: [120.3, 22.6], popShare: 0.30 },
      { name: 'Taichung', coords: [120.7, 24.1], popShare: 0.25 },
    ],
    centroid: [121.0, 23.5],
  },
  {
    id: '752', name: 'Sweden', tier: 3, population: 10_500_000,
    launchSites: [[18.1, 59.3]],
    cities: [
      { name: 'Stockholm', coords: [18.1, 59.3], popShare: 0.45 },
      { name: 'Gothenburg', coords: [12.0, 57.7], popShare: 0.30 },
      { name: 'Malmö', coords: [13.0, 55.6], popShare: 0.25 },
    ],
    centroid: [16.0, 62.0],
  },
  {
    id: '578', name: 'Norway', tier: 3, population: 5_500_000,
    launchSites: [[10.8, 59.9]],
    cities: [
      { name: 'Oslo', coords: [10.8, 59.9], popShare: 0.50 },
      { name: 'Bergen', coords: [5.3, 60.4], popShare: 0.25 },
      { name: 'Trondheim', coords: [10.4, 63.4], popShare: 0.25 },
    ],
    centroid: [10.0, 62.0],
  },
];

// Lookup map by ID
export const COUNTRY_MAP = new Map(COUNTRIES.map(c => [c.id, c]));

// Set of playable country IDs
export const PLAYABLE_IDS = new Set(COUNTRIES.map(c => c.id));

// === Alliance Blocs ===
export const BLOCS = {
  nato: {
    id: 'nato', name: 'NATO', color: '#4488ff',
    description: 'Western military alliance — strong conventional forces, widespread interceptor coverage',
    members: ['840', '826', '250', '276', '124', '380', '724', '616', '578', '792'],
  },
  eastern: {
    id: 'eastern', name: 'Eastern Coalition', color: '#ff4444',
    description: 'Authoritarian powers — heavy ICBM arsenals, centralized command',
    members: ['643', '156', '408', '364'],
  },
  nonaligned: {
    id: 'nonaligned', name: 'Non-Aligned Movement', color: '#44cc44',
    description: 'Developing powers — safety in numbers, diplomatic flexibility',
    members: ['356', '076', '360', '710', '818', '566', '764', '704'],
  },
  independent: {
    id: 'independent', name: 'Independent States', color: '#cccc44',
    description: 'Unaligned nations — free agents, unpredictable, asymmetric strategies',
    members: ['376', '586', '682', '036', '032', '484', '410', '804', '158', '752'],
  },
  allies_ww2: {
    id: 'allies_ww2', name: 'Allied Powers (WW2)', color: '#4488dd',
    description: 'The grand alliance reborn — USA, UK, France, Russia. Uneasy partners against a common enemy.',
    members: ['840', '826', '250', '643', '124', '036', '616'],
  },
  axis_ww2: {
    id: 'axis_ww2', name: 'Axis Powers (WW2)', color: '#cc4444',
    description: 'Germany, Japan, Italy + regional allies. Outnumbered but technologically fearsome.',
    members: ['276', '392', '380', '156', '792', '364', '764'],
  },
  solo: {
    id: 'solo', name: 'Go Solo', color: '#ff8800',
    description: 'No starting allies — you against the world. Maximum difficulty.',
    members: [],
  },
};

// Reverse lookup: countryId → bloc id
export const COUNTRY_BLOC = new Map();
for (const [blocId, bloc] of Object.entries(BLOCS)) {
  if (blocId === 'solo') continue;
  for (const memberId of bloc.members) {
    COUNTRY_BLOC.set(memberId, blocId);
  }
}
for (const c of COUNTRIES) {
  if (!COUNTRY_BLOC.has(c.id)) {
    COUNTRY_BLOC.set(c.id, 'independent');
    if (!BLOCS.independent.members.includes(c.id)) {
      BLOCS.independent.members.push(c.id);
    }
  }
}
