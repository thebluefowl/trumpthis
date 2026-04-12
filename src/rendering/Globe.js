import { select } from 'd3-selection';
import { drag } from 'd3-drag';
import { feature } from 'topojson-client';
import versor from 'versor';
import { COLORS } from '../constants.js';
import { COUNTRIES, PLAYABLE_IDS, COUNTRY_MAP } from '../state/countryData.js';
import { gameState } from '../state/GameState.js';
import { events } from '../state/events.js';
import { isRevealed as isIntelRevealed } from '../state/Intel.js';
import {
  initProjection,
  getProjection,
  getPathGenerator,
  getGlobeRadius,
  getGlobeCenter,
  resizeProjection,
  applyZoom,
  toggleProjection,
  getProjectionType,
  isVisible,
  projectPoint,
  geoGraticule10,
  geoContains,
} from './Projection.js';

let svg, countriesGroup, graticulePath, oceanCircle, outlineCircle, labelsGroup;
let interactable = false; // disable interaction until game setup
let autoRotating = false;
let autoRotateRAF = null;
let countryFeatures = [];
let topoData = null;

export async function initGlobe(svgElement) {
  svg = select(svgElement);

  // Size to viewport
  const { width, height } = getViewportSize();
  svg.attr('width', width).attr('height', height);

  const { projection, pathGenerator } = initProjection(width, height);
  const [cx, cy] = projection.translate();
  const radius = projection.scale();

  // Load map data (GeoJSON — India uses Survey of India official boundary)
  const response = await fetch('/data/countries-50m.geojson');
  const geoData = await response.json();
  countryFeatures = geoData.features;

  // Full-size drag surface (behind everything, catches all drags including Mercator)
  svg.append('rect')
    .attr('class', 'drag-surface')
    .attr('width', width).attr('height', height)
    .attr('fill', 'transparent')
    .style('cursor', 'grab')
    .call(dragBehavior());

  // Ocean background (visual only in orthographic — hidden in Mercator)
  oceanCircle = svg.append('circle')
    .attr('class', 'ocean')
    .attr('cx', cx).attr('cy', cy)
    .attr('r', getProjectionType() === 'mercator' ? 0 : radius)
    .style('pointer-events', 'none');

  // Graticule
  graticulePath = svg.append('path')
    .datum(geoGraticule10())
    .attr('class', 'graticule')
    .attr('d', pathGenerator);

  // Country paths — use click events (not pointerdown), no drag interference
  countriesGroup = svg.append('g').attr('class', 'countries');
  countriesGroup.selectAll('path')
    .data(countryFeatures)
    .join('path')
    .attr('class', d => {
      const id = String(d.id);
      return PLAYABLE_IDS.has(id) ? 'country' : 'country non-playable';
    })
    .attr('d', pathGenerator)
    .attr('data-id', d => d.id)
    .on('mouseenter', onCountryHover)
    .on('mousemove', onCountryMove)
    .on('mouseleave', onCountryLeave)
    .on('click', onCountryClick);

  // Country name labels (playable nations only)
  labelsGroup = svg.append('g').attr('class', 'country-labels')
    .style('pointer-events', 'none');

  // Globe outline ring
  outlineCircle = svg.append('circle')
    .attr('class', 'outline')
    .attr('cx', cx).attr('cy', cy)
    .attr('r', getProjectionType() === 'mercator' ? 0 : radius)
    .style('pointer-events', 'none');

  // Zoom via wheel/trackpad pinch
  svgElement.addEventListener('wheel', onWheel, { passive: false });

  // Prevent browser pinch-to-zoom globally
  document.addEventListener('wheel', (e) => {
    if (e.ctrlKey) e.preventDefault();
  }, { passive: false });

  // M key to toggle projection
  document.addEventListener('keydown', (e) => {
    if (e.key === 'm' || e.key === 'M') {
      onToggleProjection();
    }
  });

  // Re-render SVG markers when batteries or launch sites change
  events.on('battery:placed', () => renderPaths());

  // Fallback click on SVG for targeting mode — catches clicks on gaps/borders/ocean
  svgElement.addEventListener('click', (e) => {
    const rect = svgElement.getBoundingClientRect();
    const projection = getProjection();
    const geoCoords = projection.invert([e.clientX - rect.left, e.clientY - rect.top]);
    if (geoCoords) {
      events.emit('globe:click', { geoCoords, clientX: e.clientX, clientY: e.clientY });
    }
  });

  // Listen for resize
  window.addEventListener('resize', onResize);

  return { svg, countryFeatures };
}

function getViewportSize() {
  // Size to the SVG's parent container, not the full viewport
  const parent = svg?.node()?.parentElement;
  if (parent) {
    const rect = parent.getBoundingClientRect();
    return { width: rect.width, height: rect.height };
  }
  return { width: window.innerWidth, height: window.innerHeight };
}

function dragBehavior() {
  let v0, r0, q0;
  let startPos, startRotate;

  return drag()
    .clickDistance(4)
    .on('start', function (event) {
      const projection = getProjection();
      if (getProjectionType() === 'mercator') {
        startPos = [event.x, event.y];
        startRotate = projection.rotate();
      } else {
        const point = [event.x, event.y];
        v0 = versor.cartesian(projection.invert(point));
        r0 = projection.rotate();
        q0 = versor(r0);
      }
    })
    .on('drag', function (event) {
      const projection = getProjection();
      if (getProjectionType() === 'mercator') {
        // Simple pixel-to-degree panning
        const scale = projection.scale();
        const dx = event.x - startPos[0];
        const dy = event.y - startPos[1];
        const lonDelta = dx / scale * 57.3; // radians to degrees approximation
        const latDelta = -dy / scale * 57.3;
        projection.rotate([
          startRotate[0] + lonDelta,
          Math.max(-85, Math.min(85, startRotate[1] + latDelta)),
          0,
        ]);
      } else {
        const point = [event.x, event.y];
        const v1 = versor.cartesian(projection.rotate(r0).invert(point));
        const q1 = versor.multiply(q0, versor.delta(v0, v1));
        const r1 = versor.rotation(q1);
        projection.rotate(r1);
      }
      renderPaths();
      events.emit('globe:rotated');
    });
}

let lastRenderTime = 0;
export function renderPaths(force = false) {
  // Throttle SVG re-renders to max 10fps (expensive DOM updates)
  const now = performance.now();
  if (!force && now - lastRenderTime < 100) return;
  lastRenderTime = now;

  const pathGenerator = getPathGenerator();
  const projection = getProjection();
  const [cx, cy] = projection.translate();
  const radius = projection.scale();
  const isMercator = getProjectionType() === 'mercator';

  // Update all paths
  countriesGroup.selectAll('path.country')
    .attr('d', pathGenerator);

  graticulePath.attr('d', pathGenerator);

  if (isMercator) {
    // No ocean circle or outline in mercator — fill the whole SVG background
    oceanCircle.attr('r', 0);
    outlineCircle.attr('r', 0);
  } else {
    oceanCircle.attr('cx', cx).attr('cy', cy).attr('r', radius);
    outlineCircle.attr('cx', cx).attr('cy', cy).attr('r', radius);
  }

  // Update country styling based on game state
  updateCountryStyles();

  // Update launch site markers
  renderLaunchSites();

  // Update battery markers
  renderBatteries();

  // Update country labels
  renderLabels();
}

function updateCountryStyles() {
  const playerId = gameState.playerCountryId;

  countriesGroup.selectAll('path.country')
    .attr('class', d => {
      const id = String(d.id);
      if (!PLAYABLE_IDS.has(id)) return 'country non-playable';
      if (gameState.phase !== 'PLAYING') {
        if (id === playerId) return 'country selected-player';
        return 'country';
      }
      if (id === playerId) return 'country selected-player';
      if (gameState.isEliminated(id)) return 'country non-playable';
      if (gameState.isAllied(playerId, id)) return 'country allied';
      const rel = gameState.getRelationship(playerId, id);
      if (rel <= -50) return 'country hostile';
      return 'country neutral-active';
    })
    .style('fill', d => {
      const id = String(d.id);
      const state = gameState.countries.get(id);
      if (!state) return null;
      if (gameState.phase !== 'PLAYING') return null;
      if (gameState.isEliminated(id)) return '#0a0a0a';

      const pct = state.population / state.startingPopulation;
      const damageDarken = 1 - (1 - pct) * 0.5; // darken as damaged

      if (id === playerId) {
        return `rgb(${Math.round(0 * damageDarken)}, ${Math.round(34 * damageDarken)}, ${Math.round(51 * damageDarken)})`;
      }

      if (gameState.isAllied(playerId, id)) {
        return `rgb(${Math.round(0 * damageDarken)}, ${Math.round(25 * damageDarken)}, ${Math.round(40 * damageDarken)})`;
      }

      const rel = gameState.getRelationship(playerId, id);
      if (rel <= -50) {
        return `rgb(${Math.round(40 * damageDarken)}, ${Math.round(8 * damageDarken)}, ${Math.round(8 * damageDarken)})`;
      }

      // Neutral — dim green
      return `rgb(${Math.round(10 * damageDarken)}, ${Math.round(18 * damageDarken)}, ${Math.round(10 * damageDarken)})`;
    });
}

// === Launch Site Markers ===
let launchSiteGroup = null;

export function initLaunchSites() {
  if (launchSiteGroup) launchSiteGroup.remove();
  launchSiteGroup = svg.append('g').attr('class', 'launch-sites');
  launchSiteGroup.raise(); // ensure on top of all other SVG elements
}

export function renderLaunchSites() {
  if (!launchSiteGroup) return;
  if (gameState.phase !== 'PLAYING') return;

  const sites = [];
  // Only show player's launch sites (other nations' sites are hidden)
  const playerCountry = gameState.getPlayer();
  if (playerCountry) {
    for (const site of playerCountry.launchSites) {
      sites.push({ ...site, countryId: playerCountry.id, role: 'player' });
    }
  }

  const diamonds = launchSiteGroup.selectAll('.launch-site')
    .data(sites, d => `${d.countryId}-${d.coords[0]}-${d.coords[1]}`);

  diamonds.exit().remove();

  const enter = diamonds.enter()
    .append('g')
    .attr('class', d => `launch-site ${d.role}`)
    .style('pointer-events', 'all');

  // Invisible larger hit area for easy clicking
  enter.append('circle')
    .attr('r', 14)
    .attr('fill', 'transparent')
    .attr('stroke', 'none')
    .style('cursor', 'pointer')
    .on('click', (event, d) => {
      if (d.role === 'player' && !d.disabled) {
        events.emit('launchsite:click', d);
      }
    });

  // Visible diamond shape (bigger)
  enter.append('path')
    .attr('d', 'M0,-8 L5.5,0 L0,8 L-5.5,0 Z')
    .attr('class', 'launch-site-pulse')
    .style('pointer-events', 'none');

  // Update positions
  const all = enter.merge(diamonds);
  all.attr('transform', d => {
    if (!isVisible(d.coords)) return 'translate(-9999, -9999)';
    const [x, y] = projectPoint(d.coords);
    return `translate(${x}, ${y})`;
  })
    .style('opacity', d => {
      if (d.disabled) return 0.3;
      return isVisible(d.coords) ? 1 : 0;
    });
}

// === Tooltip + Hover ===
const tooltip = () => document.getElementById('tooltip');

function onCountryHover(event, d) {
  if (!interactable) return;
  const id = String(d.id);
  if (!PLAYABLE_IDS.has(id)) return;
  events.emit('country:hover', { id });
  if (gameState.phase === 'PLAYING') return; // no tooltips during gameplay

  const country = COUNTRY_MAP.get(id);
  if (!country) return;

  const tierLabels = { 1: 'Superpower', 2: 'Major Power', 3: 'Regional Power' };
  const el = tooltip();
  el.innerHTML = `
    <div class="name">${country.name}</div>
    <div class="stat">Tier: <span>${tierLabels[country.tier]}</span></div>
    <div class="stat">Population: <span>${formatPop(country.population)}</span></div>
    <div class="stat">Launch Sites: <span>${country.launchSites.length}</span></div>
  `;
  el.classList.add('visible');
  positionTooltip(event);
}

function onCountryMove(event) {
  positionTooltip(event);
}

function onCountryLeave(event, d) {
  events.emit('country:hoverend', { id: d ? String(d.id) : null });
  const el = tooltip();
  el.classList.remove('visible');
}

function positionTooltip(event) {
  const el = tooltip();
  const x = event.clientX + 15;
  const y = event.clientY + 15;
  el.style.left = x + 'px';
  el.style.top = y + 'px';
}

function onCountryClick(event, d) {
  if (!interactable) return;
  let id = String(d.id);
  const projection = getProjection();
  const svgEl = document.getElementById('globe');
  const rect = svgEl ? svgEl.getBoundingClientRect() : { left: 0, top: 0 };
  const geoCoords = projection.invert([event.clientX - rect.left, event.clientY - rect.top]);

  // Kashmir override — clicking in PoK registers as India
  if (geoCoords && isInKashmir(geoCoords)) id = '356';

  if (!PLAYABLE_IDS.has(id)) return;
  events.emit('country:click', { id, feature: d, geoCoords });
}

// === Auto-rotate to country ===
export function rotateTo(lonLat, duration = 1000) {
  const projection = getProjection();
  const currentRotation = projection.rotate();
  const targetRotation = [-lonLat[0], -lonLat[1], 0];

  const startTime = performance.now();

  function animate(now) {
    const t = Math.min(1, (now - startTime) / duration);
    // Ease in-out cubic
    const eased = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

    const r = [
      currentRotation[0] + (targetRotation[0] - currentRotation[0]) * eased,
      currentRotation[1] + (targetRotation[1] - currentRotation[1]) * eased,
      currentRotation[2] + (targetRotation[2] - currentRotation[2]) * eased,
    ];
    projection.rotate(r);
    renderPaths();
    events.emit('globe:rotated');

    if (t < 1) requestAnimationFrame(animate);
  }

  requestAnimationFrame(animate);
}

// === Projection Toggle ===
function onToggleProjection() {
  const type = toggleProjection();
  // Ocean circle and outline only make sense for orthographic
  if (type === 'mercator') {
    oceanCircle.attr('r', 0);
    outlineCircle.attr('r', 0);
  }
  renderPaths();
  events.emit('globe:rotated');
}

export { onToggleProjection as switchProjection };

// === Interaction Control ===
export function setInteractable(enabled) {
  interactable = enabled;
  if (svg) {
    svg.style('pointer-events', enabled ? 'all' : 'none');
  }
}

// === Auto-Rotation ===
export function startAutoRotate() {
  if (autoRotating) return;
  autoRotating = true;
  let lastTime = performance.now();

  function spin(now) {
    if (!autoRotating) return;
    const dt = (now - lastTime) / 1000;
    lastTime = now;

    const projection = getProjection();
    const r = projection.rotate();
    projection.rotate([r[0] + dt * 8, r[1], r[2]]); // 8 degrees/sec
    renderPaths();

    autoRotateRAF = requestAnimationFrame(spin);
  }
  autoRotateRAF = requestAnimationFrame(spin);
}

export function stopAutoRotate() {
  autoRotating = false;
  if (autoRotateRAF) {
    cancelAnimationFrame(autoRotateRAF);
    autoRotateRAF = null;
  }
}

// === Zoom ===
function onWheel(e) {
  e.preventDefault();
  // Trackpad pinch sends ctrlKey + small deltaY; scroll wheel sends larger deltaY
  applyZoom(e.deltaY);
  renderPaths();
  events.emit('globe:rotated');
}

// === Resize ===
function onResize() {
  const { width, height } = getViewportSize();
  svg.attr('width', width).attr('height', height);
  resizeProjection(width, height);

  // Resize drag surface
  svg.select('.drag-surface').attr('width', width).attr('height', height);

  renderPaths();
  events.emit('globe:resized');
}

// === Country Labels ===
function renderLabels() {
  if (!labelsGroup) return;

  const labels = COUNTRIES.map(c => ({
    id: c.id,
    name: c.name,
    coords: c.centroid,
    tier: c.tier,
  }));

  const texts = labelsGroup.selectAll('.country-label')
    .data(labels, d => d.id);

  texts.exit().remove();

  const enter = texts.enter()
    .append('text')
    .attr('class', 'country-label')
    .text(d => d.name)
    .attr('text-anchor', 'middle');

  const all = enter.merge(texts);
  all
    .attr('x', d => {
      if (!isVisible(d.coords)) return -9999;
      const pos = projectPoint(d.coords);
      return pos ? pos[0] : -9999;
    })
    .attr('y', d => {
      if (!isVisible(d.coords)) return -9999;
      const pos = projectPoint(d.coords);
      return pos ? pos[1] + 3 : -9999; // slight offset below center
    })
    .style('opacity', d => isVisible(d.coords) ? 1 : 0);
}

// === Battery Markers ===
let batteryGroup = null;

export function initBatteries() {
  if (batteryGroup) batteryGroup.remove();
  batteryGroup = svg.append('g').attr('class', 'battery-markers');
}

export function renderBatteries() {
  if (!batteryGroup) return;
  if (gameState.phase !== 'PLAYING') return;

  // Only show player's batteries + revealed enemy batteries
  const batteries = gameState.interceptors.filter(b => {
    if (b.countryId === gameState.playerCountryId) return true;
    if (gameState.isAllied(gameState.playerCountryId, b.countryId)) return true;
    return isIntelRevealed(b.countryId, 'batteries');
  });

  const markers = batteryGroup.selectAll('.battery-marker')
    .data(batteries, d => d.id);

  markers.exit().remove();

  const enter = markers.enter()
    .append('g')
    .attr('class', d => `battery-marker ${d.role}`);

  // Shield shape (inverted triangle)
  enter.append('path')
    .attr('d', 'M-4,-3 L4,-3 L0,5 Z')
    .attr('class', 'battery-icon');

  const all = enter.merge(markers);
  all.attr('transform', d => {
    if (!isVisible(d.position)) return 'translate(-9999, -9999)';
    const [x, y] = projectPoint(d.position);
    return `translate(${x}, ${y})`;
  })
    .style('opacity', d => {
      if (!isVisible(d.position)) return 0;
      const onCooldown = d.cooldownUntil > gameState.elapsed;
      return onCooldown ? 0.4 : 1;
    });
}

// === Point-in-Country Test ===
// Kashmir/PoK override: treat the disputed region as India for gameplay
const INDIA_KASHMIR_OVERRIDE = {
  minLon: 73.0, maxLon: 77.5,
  minLat: 33.5, maxLat: 37.0,
};

function isInKashmir(lonLat) {
  return lonLat[0] >= INDIA_KASHMIR_OVERRIDE.minLon && lonLat[0] <= INDIA_KASHMIR_OVERRIDE.maxLon &&
         lonLat[1] >= INDIA_KASHMIR_OVERRIDE.minLat && lonLat[1] <= INDIA_KASHMIR_OVERRIDE.maxLat;
}

export function isPointInCountry(lonLat, countryId) {
  // PoK override — treat Kashmir region as India
  if (countryId === '356' && isInKashmir(lonLat)) return true;

  const feats = countryFeatures.filter(f => String(f.id) === countryId);
  return feats.some(f => geoContains(f, lonLat));
}

// Override country click — Kashmir region clicks register as India
export function resolveCountryAtPoint(lonLat) {
  if (isInKashmir(lonLat)) return '356'; // India
  for (const f of countryFeatures) {
    if (geoContains(f, lonLat)) return String(f.id);
  }
  return null;
}

// === Helpers ===
function formatPop(n) {
  if (n >= 1_000_000_000) return (n / 1_000_000_000).toFixed(1) + 'B';
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(0) + 'K';
  return String(n);
}

export { formatPop };
