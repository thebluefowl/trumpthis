import { RESOURCE_NODES } from '../state/Resources.js';
import { gameState } from '../state/GameState.js';
import { geoDistance } from '../rendering/Projection.js';

// ownership: nodeId → countryId
const ownership = new Map();

export function initResources() {
  ownership.clear();

  // Assign each node to the nearest active nation
  for (const node of RESOURCE_NODES) {
    let nearest = null;
    let nearestDist = Infinity;

    for (const [id, country] of gameState.countries) {
      const dist = geoDistance(node.coords, country.centroid);
      if (dist < nearestDist) {
        nearestDist = dist;
        nearest = id;
      }
    }

    if (nearest) {
      ownership.set(node.id, nearest);
    }
  }
}

export function updateResources(dt) {
  if (gameState.phase !== 'PLAYING') return;

  // Transfer nodes from eliminated nations to conqueror (or nearest active)
  for (const node of RESOURCE_NODES) {
    const ownerId = ownership.get(node.id);
    if (ownerId && gameState.isEliminated(ownerId)) {
      // Find nearest active nation
      let nearest = null;
      let nearestDist = Infinity;
      for (const country of gameState.getActiveCountries()) {
        const dist = geoDistance(node.coords, country.centroid);
        if (dist < nearestDist) {
          nearestDist = dist;
          nearest = country.id;
        }
      }
      ownership.set(node.id, nearest);
    }
  }
}

export function getResourceBonus(countryId) {
  let bonus = 0;
  for (const node of RESOURCE_NODES) {
    if (ownership.get(node.id) === countryId) {
      bonus += node.bonus;
    }
  }
  return bonus;
}

export function getOwnedResources(countryId) {
  return RESOURCE_NODES.filter(n => ownership.get(n.id) === countryId);
}

export function getNodeOwner(nodeId) {
  return ownership.get(nodeId);
}

export function hasResourceType(countryId, type) {
  return RESOURCE_NODES.some(n => ownership.get(n.id) === countryId && n.type === type);
}

export function getAllNodes() {
  return RESOURCE_NODES.map(n => ({
    ...n,
    ownerId: ownership.get(n.id),
  }));
}

export function resetResources() {
  ownership.clear();
}
