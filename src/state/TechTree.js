// 4 branches × 5 tiers = 20 techs
// Each tier requires the previous tier in the same branch

export const TECH_DEFS = {
  // === OFFENSIVE — faster, deadlier, harder to stop ===
  propulsion_upgrade: {
    branch: 'offensive', tier: 1, name: 'Advanced Propulsion',
    cost: 12, time: 25,
    desc: '-15% missile flight time. All missiles arrive faster.',
  },
  cluster_munitions: {
    branch: 'offensive', tier: 2, name: 'Cluster Munitions',
    cost: 25, time: 45,
    desc: 'Tactical and Cruise missiles deal +50% damage.',
    requires: 'propulsion_upgrade',
  },
  mirv_upgrade: {
    branch: 'offensive', tier: 3, name: 'MIRV Bus Upgrade',
    cost: 40, time: 60,
    desc: 'MIRVs split into 6 warheads instead of 4.',
    requires: 'cluster_munitions',
  },
  hypersonic_glide: {
    branch: 'offensive', tier: 4, name: 'Hypersonic Glide',
    cost: 60, time: 90,
    desc: '-35% flight time. -15% enemy intercept rate against your missiles.',
    requires: 'mirv_upgrade',
  },
  extinction_protocol: {
    branch: 'offensive', tier: 5, name: 'Extinction Protocol',
    cost: 100, time: 120,
    desc: 'Nuclear weapons deal +30% damage and radiation lasts 50% longer.',
    requires: 'hypersonic_glide',
  },

  // === DEFENSIVE — survive longer, intercept more ===
  radar_upgrade: {
    branch: 'defensive', tier: 1, name: 'Phased Array Radar',
    cost: 12, time: 25,
    desc: '+10% interceptor success rate. See threats earlier.',
  },
  point_defense: {
    branch: 'defensive', tier: 2, name: 'Point Defense Systems',
    cost: 25, time: 45,
    desc: 'Interceptors recharge 30% faster.',
    requires: 'radar_upgrade',
  },
  emp_hardening: {
    branch: 'defensive', tier: 3, name: 'EMP Hardening',
    cost: 40, time: 60,
    desc: 'Interceptors resist EMP (halved disable time). Launch sites recover 2x faster.',
    requires: 'point_defense',
  },
  directed_energy: {
    branch: 'defensive', tier: 4, name: 'Directed Energy Weapons',
    cost: 65, time: 90,
    desc: '85% auto-intercept rate. Interceptors hit nearly everything.',
    requires: 'emp_hardening',
  },
  aegis_network: {
    branch: 'defensive', tier: 5, name: 'AEGIS Defense Network',
    cost: 100, time: 120,
    desc: 'Your batteries can defend allied nations within range. +20% range.',
    requires: 'directed_energy',
  },

  // === INTEL — see more, know more, disrupt more ===
  sigint: {
    branch: 'intel', tier: 1, name: 'SIGINT Capability',
    cost: 10, time: 20,
    desc: 'Reveals enemy interceptor batteries on the map.',
  },
  satellite_constellation: {
    branch: 'intel', tier: 2, name: 'Satellite Constellation',
    cost: 22, time: 40,
    desc: 'Satellite scans 2x wider area. Reveals enemy token counts.',
    requires: 'sigint',
  },
  electronic_warfare: {
    branch: 'intel', tier: 3, name: 'Electronic Warfare',
    cost: 38, time: 55,
    desc: 'EMP weapons have +25% larger effect radius.',
    requires: 'satellite_constellation',
  },
  cyber_ops: {
    branch: 'intel', tier: 4, name: 'Cyber Operations',
    cost: 55, time: 75,
    desc: 'Can spend 20◆ to disable an enemy nation\'s token gen for 15 seconds.',
    requires: 'electronic_warfare',
  },
  total_awareness: {
    branch: 'intel', tier: 5, name: 'Total Domain Awareness',
    cost: 90, time: 100,
    desc: 'All enemy batteries, missiles, and research permanently visible.',
    requires: 'cyber_ops',
  },

  // === ECONOMIC — earn more, spend less, build faster ===
  resource_extraction: {
    branch: 'economic', tier: 1, name: 'Resource Extraction',
    cost: 10, time: 20,
    desc: '+25% resource node token bonuses.',
  },
  industrial_base: {
    branch: 'economic', tier: 2, name: 'Industrial Base',
    cost: 22, time: 40,
    desc: 'Interceptor batteries cost 25% less. Launch silos cost 20% less.',
    requires: 'resource_extraction',
  },
  logistics_network: {
    branch: 'economic', tier: 3, name: 'Logistics Network',
    cost: 38, time: 55,
    desc: '-30% supply line cost surcharge on all missiles.',
    requires: 'industrial_base',
  },
  wartime_production: {
    branch: 'economic', tier: 4, name: 'Wartime Production',
    cost: 55, time: 75,
    desc: '+40% token generation during escalation phase.',
    requires: 'logistics_network',
  },
  superpower_economy: {
    branch: 'economic', tier: 5, name: 'Superpower Economy',
    cost: 90, time: 100,
    desc: 'Token cap +100. Base generation +50%. You become an economic juggernaut.',
    requires: 'wartime_production',
  },
};

export const BRANCHES = ['offensive', 'defensive', 'intel', 'economic'];
export const BRANCH_NAMES = { offensive: 'Offensive', defensive: 'Defensive', intel: 'Intel', economic: 'Economic' };
export const BRANCH_COLORS = { offensive: '#dc2626', defensive: '#2563eb', intel: '#22d3ee', economic: '#eab308' };
