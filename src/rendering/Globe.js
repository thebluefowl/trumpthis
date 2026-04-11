import { select } from 'd3-selection';
import { drag } from 'd3-drag';
import { feature } from 'topojson-client';
import versor from 'versor';
import { COLORS } from '../constants.js';
import { PLAYABLE_IDS, COUNTRY_MAP } from '../state/countryData.js';
import { gameState } from '../state/GameState.js';
import { events } from '../state/events.js';
import {
  initProjection,
  getProjection,
  getPathGenerator,
  getGlobeRadius,
  getGlobeCenter,
  resizeProjection,
  isVisible,
  projectPoint,
  geoGraticule10,
} from './Projection.js';

let svg, countriesGroup, graticulePath, oceanCircle, outlineCircle;
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

  // Load map data
  const response = await fetch('/data/countries-110m.json');
  topoData = await response.json();
  countryFeatures = feature(topoData, topoData.objects.countries).features;

  // Ocean background
  oceanCircle = svg.append('circle')
    .attr('class', 'ocean')
    .attr('cx', cx).attr('cy', cy).attr('r', radius);

  // Graticule
  graticulePath = svg.append('path')
    .datum(geoGraticule10())
    .attr('class', 'graticule')
    .attr('d', pathGenerator);

  // Country paths
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

  // Globe outline ring
  outlineCircle = svg.append('circle')
    .attr('class', 'outline')
    .attr('cx', cx).attr('cy', cy).attr('r', radius)
    .style('pointer-events', 'none');

  // Attach drag to SVG root — countries handle their own click/hover events
  // D3 drag has a click distance threshold so quick clicks still fire on countries
  svg.call(dragBehavior());
  svg.style('cursor', 'grab');

  // Listen for resize
  window.addEventListener('resize', onResize);

  return { svg, countryFeatures };
}

function getViewportSize() {
  return { width: window.innerWidth, height: window.innerHeight };
}

function dragBehavior() {
  let v0, r0, q0;

  return drag()
    .clickDistance(4) // allow clicks through without triggering drag
    .on('start', function (event) {
      const projection = getProjection();
      const point = [event.x, event.y];
      v0 = versor.cartesian(projection.invert(point));
      r0 = projection.rotate();
      q0 = versor(r0);
    })
    .on('drag', function (event) {
      const projection = getProjection();
      const point = [event.x, event.y];
      const v1 = versor.cartesian(projection.rotate(r0).invert(point));
      const q1 = versor.multiply(q0, versor.delta(v0, v1));
      const r1 = versor.rotation(q1);
      projection.rotate(r1);
      renderPaths();
      events.emit('globe:rotated');
    });
}

export function renderPaths() {
  const pathGenerator = getPathGenerator();
  const projection = getProjection();
  const [cx, cy] = projection.translate();
  const radius = projection.scale();

  // Update all paths
  countriesGroup.selectAll('path.country')
    .attr('d', pathGenerator);

  graticulePath.attr('d', pathGenerator);

  oceanCircle.attr('cx', cx).attr('cy', cy).attr('r', radius);
  outlineCircle.attr('cx', cx).attr('cy', cy).attr('r', radius);

  // Update country styling based on game state
  updateCountryStyles();

  // Update launch site markers
  renderLaunchSites();
}

function updateCountryStyles() {
  countriesGroup.selectAll('path.country')
    .attr('class', d => {
      const id = String(d.id);
      if (!PLAYABLE_IDS.has(id)) return 'country non-playable';
      if (id === gameState.playerCountryId) return 'country selected-player';
      if (id === gameState.aiCountryId) return 'country selected-enemy';
      return 'country';
    })
    .style('fill', d => {
      const id = String(d.id);
      const state = gameState.countries.get(id);
      if (!state) return null;
      // Redden as population drops
      const pct = state.population / state.startingPopulation;
      if (state.role === 'player') {
        const r = Math.round(0 + (100 * (1 - pct)));
        const g = Math.round(34 + (0 * (1 - pct)));
        const b = Math.round(51 - (30 * (1 - pct)));
        return `rgb(${r}, ${g}, ${b})`;
      }
      if (state.role === 'ai') {
        const r = Math.round(34 + (80 * (1 - pct)));
        const g = Math.round(10 - (10 * (1 - pct)));
        const b = Math.round(10 - (10 * (1 - pct)));
        return `rgb(${r}, ${g}, ${b})`;
      }
      return null;
    });
}

// === Launch Site Markers ===
let launchSiteGroup = null;

export function initLaunchSites() {
  if (launchSiteGroup) launchSiteGroup.remove();
  launchSiteGroup = svg.append('g').attr('class', 'launch-sites');
}

export function renderLaunchSites() {
  if (!launchSiteGroup) return;
  if (gameState.phase !== 'PLAYING') return;

  const sites = [];
  for (const [id, country] of gameState.countries) {
    for (const site of country.launchSites) {
      sites.push({ ...site, countryId: id, role: country.role });
    }
  }

  const diamonds = launchSiteGroup.selectAll('.launch-site')
    .data(sites, d => `${d.countryId}-${d.coords[0]}-${d.coords[1]}`);

  diamonds.exit().remove();

  const enter = diamonds.enter()
    .append('g')
    .attr('class', d => `launch-site ${d.role}`)
    .on('click', (event, d) => {
      event.stopPropagation();
      if (d.role === 'player' && !d.disabled) {
        events.emit('launchsite:click', d);
      }
    });

  // Diamond shape
  enter.append('path')
    .attr('d', 'M0,-5 L3.5,0 L0,5 L-3.5,0 Z')
    .attr('class', 'launch-site-pulse');

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
  const id = String(d.id);
  if (!PLAYABLE_IDS.has(id)) return;
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

function onCountryLeave() {
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
  const id = String(d.id);
  if (!PLAYABLE_IDS.has(id)) return;
  events.emit('country:click', { id, feature: d });
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

// === Resize ===
function onResize() {
  const { width, height } = getViewportSize();
  svg.attr('width', width).attr('height', height);
  resizeProjection(width, height);

  renderPaths();
  events.emit('globe:resized');
}

// === Helpers ===
function formatPop(n) {
  if (n >= 1_000_000_000) return (n / 1_000_000_000).toFixed(1) + 'B';
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(0) + 'K';
  return String(n);
}

export { formatPop };
