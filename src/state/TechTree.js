// 4 branches × 3 tiers = 12 techs
// Each tier requires the previous tier in the same branch

export const TECH_DEFS = {
  // OFFENSIVE
  faster_missiles:  { branch: 'offensive',  tier: 1, name: 'Faster Missiles',    cost: 15, time: 30,  desc: '-20% flight time' },
  mirv_upgrade:     { branch: 'offensive',  tier: 2, name: 'MIRV Upgrade',       cost: 30, time: 60,  desc: 'MIRVs split into 6 warheads', requires: 'faster_missiles' },
  hypersonic:       { branch: 'offensive',  tier: 3, name: 'Hypersonic Warheads', cost: 50, time: 90, desc: '-40% flight time, -20% intercept rate', requires: 'mirv_upgrade' },

  // DEFENSIVE
  better_intercept: { branch: 'defensive',  tier: 1, name: 'Better Intercept',   cost: 15, time: 30,  desc: '+15% intercept success' },
  emp_shield:       { branch: 'defensive',  tier: 2, name: 'EMP Shield',         cost: 30, time: 60,  desc: 'Interceptors resist EMP (half disable time)', requires: 'better_intercept' },
  laser_defense:    { branch: 'defensive',  tier: 3, name: 'Laser Defense',      cost: 50, time: 90,  desc: '90% auto-intercept rate', requires: 'emp_shield' },

  // INTEL
  satellite_recon:  { branch: 'intel',      tier: 1, name: 'Satellite Recon',    cost: 10, time: 20,  desc: 'Reveals enemy batteries' },
  spy_missiles:     { branch: 'intel',      tier: 2, name: 'Spy Missiles',       cost: 20, time: 40,  desc: 'Unlock spy missile type (cheap recon)', requires: 'satellite_recon' },
  cyber_warfare:    { branch: 'intel',      tier: 3, name: 'Cyber Warfare',      cost: 40, time: 60,  desc: 'Disable enemy token gen for 10s (15 tokens)', requires: 'spy_missiles' },

  // ECONOMIC
  efficient_mining: { branch: 'economic',   tier: 1, name: 'Efficient Mining',   cost: 10, time: 20,  desc: '+25% resource node bonuses' },
  war_economy:      { branch: 'economic',   tier: 2, name: 'War Economy',        cost: 25, time: 45,  desc: '+50% token gen during escalation', requires: 'efficient_mining' },
  supply_lines:     { branch: 'economic',   tier: 3, name: 'Supply Lines',       cost: 40, time: 60,  desc: '-30% missile cost for adjacent territories', requires: 'war_economy' },
};

export const BRANCHES = ['offensive', 'defensive', 'intel', 'economic'];
export const BRANCH_NAMES = { offensive: 'Offensive', defensive: 'Defensive', intel: 'Intel', economic: 'Economic' };
export const BRANCH_COLORS = { offensive: '#dc2626', defensive: '#2563eb', intel: '#22d3ee', economic: '#eab308' };
