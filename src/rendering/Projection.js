import { geoOrthographic, geoMercator, geoPath, geoGraticule10, geoDistance, geoInterpolate, geoContains } from 'd3-geo';
import { GLOBE_PADDING } from '../constants.js';

let projection, pathGenerator, width, height;
let baseRadius;
let zoomLevel = 1;
const MIN_ZOOM = 0.8;
const MAX_ZOOM = 6;

let projectionType = 'mercator'; // 'orthographic' | 'mercator'

export function initProjection(w, h) {
  width = w;
  height = h;
  baseRadius = Math.min(width, height) * GLOBE_PADDING / 2;
  zoomLevel = 1;

  createProjection();
  pathGenerator = geoPath(projection);
  return { projection, pathGenerator };
}

function createProjection() {
  const currentRotation = projection ? projection.rotate() : [0, -20, 0];

  if (projectionType === 'mercator') {
    const mercatorScale = width / (2 * Math.PI); // standard mercator scale
    projection = geoMercator()
      .scale(mercatorScale * zoomLevel)
      .translate([width / 2, height / 2])
      .precision(0.5)
      .rotate([currentRotation[0], 0, 0]); // mercator only rotates longitude
  } else {
    projection = geoOrthographic()
      .scale(baseRadius * zoomLevel)
      .translate([width / 2, height / 2])
      .clipAngle(90)
      .precision(0.5)
      .rotate(currentRotation);
  }

  if (pathGenerator) pathGenerator = geoPath(projection);
}

export function getProjection() {
  return projection;
}

export function getPathGenerator() {
  return pathGenerator;
}

export function getGlobeRadius() {
  return projection.scale();
}

export function getGlobeCenter() {
  return projection.translate();
}

export function projectPoint(lonLat) {
  return projection(lonLat);
}

export function isVisible(lonLat) {
  if (projectionType === 'mercator') return true; // mercator shows everything
  const center = projection.rotate();
  const centerLonLat = [-center[0], -center[1]];
  const d = geoDistance(lonLat, centerLonLat);
  return d < Math.PI / 2;
}

export function resizeProjection(w, h) {
  width = w;
  height = h;
  baseRadius = Math.min(width, height) * GLOBE_PADDING / 2;
  createProjection();
}

export function applyZoom(delta) {
  const factor = delta > 0 ? 0.92 : 1.08;
  zoomLevel = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoomLevel * factor));
  if (projectionType === 'mercator') {
    const mercatorScale = width / (2 * Math.PI);
    projection.scale(mercatorScale * zoomLevel);
  } else {
    projection.scale(baseRadius * zoomLevel);
  }
}

export function getZoomLevel() {
  return zoomLevel;
}

export function toggleProjection() {
  projectionType = projectionType === 'orthographic' ? 'mercator' : 'orthographic';
  createProjection();
  pathGenerator = geoPath(projection);
  return projectionType;
}

export function getProjectionType() {
  return projectionType;
}

export function createInterpolator(from, to) {
  return geoInterpolate(from, to);
}

export { geoGraticule10, geoDistance, geoContains };
