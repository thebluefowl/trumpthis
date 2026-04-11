import { geoOrthographic, geoPath, geoGraticule10, geoDistance, geoInterpolate } from 'd3-geo';
import { GLOBE_PADDING } from '../constants.js';

let projection, pathGenerator, width, height;

export function initProjection(w, h) {
  width = w;
  height = h;
  const radius = Math.min(width, height) * GLOBE_PADDING / 2;

  projection = geoOrthographic()
    .scale(radius)
    .translate([width / 2, height / 2])
    .clipAngle(90)
    .precision(0.5)
    .rotate([0, -20, 0]); // start slightly tilted to show northern hemisphere

  pathGenerator = geoPath(projection);
  return { projection, pathGenerator };
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
  const center = projection.rotate();
  // rotation center in [lon, lat] form: negate the rotation values
  const centerLonLat = [-center[0], -center[1]];
  const d = geoDistance(lonLat, centerLonLat);
  return d < Math.PI / 2;
}

export function resizeProjection(w, h) {
  width = w;
  height = h;
  const radius = Math.min(width, height) * GLOBE_PADDING / 2;
  projection.scale(radius).translate([width / 2, height / 2]);
}

export function createInterpolator(from, to) {
  return geoInterpolate(from, to);
}

export { geoGraticule10, geoDistance };
