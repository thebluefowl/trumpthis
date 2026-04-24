import { COLORS, EXPLOSION_DURATION, TRAIL_FADE_TIME, INTERCEPT_TRAIL_DURATION, INTERCEPT_FLASH_DURATION, INTERCEPTOR_RANGE } from '../constants.js';
import { getAllNodes } from '../engine/ResourceSystem.js';
import { RESOURCE_COLORS } from '../state/Resources.js';
import { COUNTRIES } from '../state/countryData.js';
import { isRevealed, hasCitiesBeenRevealed } from '../state/Intel.js';
import { getEffectiveCost, getPlayerMissileType } from '../ai/AIManager.js';
import { MISSILE_TYPES, LAUNCH_SITE_COST } from '../constants.js';
import { getBuildCostMultiplier } from '../engine/ResearchSystem.js';
import { getMode } from '../ui/LaunchUI.js';
import { getSatelliteAngle, getAllSatellites, getSatLaunches } from '../state/Intel.js';
import { gameState } from '../state/GameState.js';
import {
  getProjection,
  getProjectionType,
  getGlobeRadius,
  getGlobeCenter,
  projectPoint,
  isVisible,
  geoDistance,
} from './Projection.js';
import { events } from '../state/events.js';

let canvas, ctx;
let shakeOffset = { x: 0, y: 0 };
let shakeUntil = 0;

export function initCanvas(canvasElement) {
  canvas = canvasElement;
  ctx = canvas.getContext('2d');
  resize();
  window.addEventListener('resize', resize);
  events.on('globe:resized', resize);
}

function resize() {
  // Size to parent container, not full viewport
  const parent = canvas.parentElement;
  const w = parent ? parent.clientWidth : window.innerWidth;
  const h = parent ? parent.clientHeight : window.innerHeight;
  canvas.width = w * devicePixelRatio;
  canvas.height = h * devicePixelRatio;
  canvas.style.width = w + 'px';
  canvas.style.height = h + 'px';
  ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
}

export function renderCanvas(dt) {
  if (!ctx) return;
  const w = canvas.width / devicePixelRatio;
  const h = canvas.height / devicePixelRatio;

  ctx.clearRect(0, 0, w, h);

  // Apply screen shake — intensity decays over time
  const now = performance.now();
  if (now < shakeUntil) {
    const remaining = shakeUntil - now;
    const intensity = Math.min(remaining / 200, 1); // ramps up for long shakes
    const magnitude = 4 + intensity * 12; // 4-16px shake
    shakeOffset.x = (Math.random() - 0.5) * magnitude;
    shakeOffset.y = (Math.random() - 0.5) * magnitude;
  } else {
    shakeOffset.x = 0;
    shakeOffset.y = 0;
  }

  ctx.save();
  ctx.translate(shakeOffset.x, shakeOffset.y);

  // Clip to globe circle (orthographic only)
  const [cx, cy] = getGlobeCenter();
  const radius = getGlobeRadius();
  if (getProjectionType() === 'orthographic') {
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.clip();
  }

  // Draw interceptor range circles on player batteries
  drawInterceptorRanges();

  // Draw incoming threat lines to player
  drawIncomingThreats();

  // Draw satellite launches + sweep
  drawSatLaunchAnimations();
  drawSatelliteSweep();

  // Draw resource nodes
  drawResourceNodes();

  // Draw city lights
  drawCityLights();

  // Draw battery placement preview
  drawBatteryPreview();

  // Draw targeting preview line
  drawTargetingPreview();

  // Draw fading trails
  for (const trail of gameState.trails) {
    drawTrail(trail);
  }

  // Draw active missiles
  // Persistent missile debug
  if (!window._renderCalledLogged) {
    console.log('[CANVAS] renderCanvas called, gameState.missiles ref:', gameState.missiles, 'length:', gameState.missiles.length);
    window._renderCalledLogged = true;
  }
  if (gameState.missiles.length !== (window._lastMissileCount || 0)) {
    console.log(`[CANVAS] missiles: ${gameState.missiles.length}, canvas: ${w}x${h}, elapsed: ${gameState.elapsed.toFixed(1)}s`);
    if (gameState.missiles.length > 0) {
      const m = gameState.missiles[0];
      console.log(`[CANVAS] sample: type=${m.type}, progress=${m.progress.toFixed(4)}, speed=${m.speed.toFixed(4)}, from=${m.fromCountryId}, to=${m.toCountryId}`);
      const pos = getArcScreenPos(m, m.progress);
      console.log(`[CANVAS] screenPos:`, pos);
    }
    window._lastMissileCount = gameState.missiles.length;
  }
  for (const missile of gameState.missiles) {
    drawMissile(missile);
  }

  // Draw intercept trails
  for (const intercept of gameState.intercepts) {
    drawIntercept(intercept);
  }

  // Draw invasions
  if (gameState.invasions) {
    for (let i = gameState.invasions.length - 1; i >= 0; i--) {
      const inv = gameState.invasions[i];
      const age = gameState.elapsed - inv.startTime;
      if (age > inv.duration) {
        gameState.invasions.splice(i, 1);
        continue;
      }
      drawInvasion(inv, age);
    }
  }

  // Draw contamination zones
  if (gameState.contaminations) {
    for (const zone of gameState.contaminations) {
      drawContamination(zone);
    }
  }

  // Draw explosions
  for (const explosion of gameState.explosions) {
    drawExplosion(explosion);
  }

  ctx.restore();

  // Screen flash (drawn outside clip)
  const now2 = performance.now();
  if (now2 < flashUntil) {
    const flashAlpha = ((flashUntil - now2) / 150) * 0.15;
    ctx.fillStyle = withAlpha(flashColor, flashAlpha);
    ctx.fillRect(0, 0, w, h);
  }

  // Nuclear winter tint — cold blue overlay that intensifies with each nuke
  if (gameState.nuclearWinterLevel > 0) {
    const winterAlpha = Math.min(0.25, gameState.nuclearWinterLevel * 0.04);
    ctx.fillStyle = withAlpha('#0a1428', winterAlpha);
    ctx.fillRect(0, 0, w, h);
  }
}

function drawMissile(missile) {
  const trailColor = missile.mtype?.trailColor || COLORS.MISSILE_TRAIL;
  const trailTs = sampleArcTs(missile, 15);
  const trailPoints = trailTs.map(t => getArcScreenPos(missile, t));

  // Draw trail gradient
  for (let i = 1; i < trailPoints.length; i++) {
    const prev = trailPoints[i - 1];
    const curr = trailPoints[i];
    if (!prev || !curr) continue;

    const alpha = (i / trailPoints.length) * 0.8;
    ctx.beginPath();
    ctx.moveTo(prev[0], prev[1]);
    ctx.lineTo(curr[0], curr[1]);
    ctx.strokeStyle = withAlpha(trailColor, alpha);
    ctx.lineWidth = missile.isWarhead ? 1 : 1.5;
    ctx.stroke();
  }

  // Draw missile head — arrowhead pointing in direction of travel
  const headPos = getArcScreenPos(missile, missile.progress);
  if (headPos) {
    // Get direction from a slightly earlier point
    const prevT = Math.max(0, missile.progress - 0.02);
    const prevPos = getArcScreenPos(missile, prevT);
    let angle = 0;
    if (prevPos) {
      angle = Math.atan2(headPos[1] - prevPos[1], headPos[0] - prevPos[0]);
    }

    const size = missile.mtype?.isNuke ? 6 : missile.isWarhead ? 3 : 4;

    // Arrowhead
    ctx.save();
    ctx.translate(headPos[0], headPos[1]);
    ctx.rotate(angle);
    ctx.beginPath();
    ctx.moveTo(size, 0);                    // tip
    ctx.lineTo(-size * 0.7, -size * 0.5);  // left wing
    ctx.lineTo(-size * 0.3, 0);            // notch
    ctx.lineTo(-size * 0.7, size * 0.5);   // right wing
    ctx.closePath();
    ctx.fillStyle = missile.mtype?.isNuke ? '#ff4444' : '#ffffff';
    ctx.fill();
    ctx.restore();

    // Glow behind the arrowhead
    const glowSize = size * 2;
    const glow = ctx.createRadialGradient(
      headPos[0], headPos[1], 0,
      headPos[0], headPos[1], glowSize
    );
    glow.addColorStop(0, withAlpha(trailColor, 0.5));
    glow.addColorStop(1, 'transparent');
    ctx.beginPath();
    ctx.arc(headPos[0], headPos[1], glowSize, 0, Math.PI * 2);
    ctx.fillStyle = glow;
    ctx.fill();
  }
}

function drawTrail(trail) {
  const age = (gameState.elapsed - trail.startTime) * 1000;
  const alpha = Math.max(0, 1 - age / TRAIL_FADE_TIME) * 0.4;
  if (alpha <= 0) return;

  for (let i = 1; i < trail.points.length; i++) {
    const prev = trail.points[i - 1];
    const curr = trail.points[i];
    if (!isVisible(prev) || !isVisible(curr)) continue;

    const p1 = projectPoint(prev);
    const p2 = projectPoint(curr);
    if (!p1 || !p2) continue;

    ctx.beginPath();
    ctx.moveTo(p1[0], p1[1]);
    ctx.lineTo(p2[0], p2[1]);
    ctx.strokeStyle = withAlpha(COLORS.MISSILE_TRAIL, alpha * (i / trail.points.length));
    ctx.lineWidth = 1;
    ctx.stroke();
  }
}

function drawExplosion(explosion) {
  const duration = explosion.isNuke ? 5000 : (explosion.isEMP ? EXPLOSION_DURATION : EXPLOSION_DURATION);
  const age = (gameState.elapsed - explosion.startTime) * 1000;
  if (age > duration) return;
  if (!isVisible(explosion.position)) return;

  const pos = projectPoint(explosion.position);
  if (!pos) return;

  const progress = age / duration;

  // Tie visual radius to actual damage splash radius
  const splashR = explosion.splashRadians
    ? explosion.splashRadians * getGlobeRadius()
    : explosion.maxRadius;

  if (explosion.isNuke) {
    // === NUCLEAR EXPLOSION — massive, multi-phase ===
    const maxR = splashR * 1.2;

    // Phase 1: blinding white flash (0-10%)
    if (progress < 0.1) {
      const flashAlpha = 1 - progress / 0.1;
      const flashR = maxR * 2 * easeOutQuad(progress / 0.1);
      ctx.beginPath();
      ctx.arc(pos[0], pos[1], flashR, 0, Math.PI * 2);
      ctx.fillStyle = withAlpha('#ffffff', flashAlpha * 0.9);
      ctx.fill();
    }

    // Phase 2: fireball (0-40%)
    if (progress < 0.4) {
      const fbProgress = progress / 0.4;
      const fbR = maxR * easeOutQuad(fbProgress);
      const fbAlpha = 1 - fbProgress * 0.5;
      const grad = ctx.createRadialGradient(pos[0], pos[1], 0, pos[0], pos[1], fbR);
      grad.addColorStop(0, withAlpha('#ffffff', fbAlpha));
      grad.addColorStop(0.2, withAlpha('#ffcc00', fbAlpha * 0.9));
      grad.addColorStop(0.5, withAlpha('#ff6600', fbAlpha * 0.7));
      grad.addColorStop(0.8, withAlpha('#ff2200', fbAlpha * 0.4));
      grad.addColorStop(1, 'transparent');
      ctx.beginPath();
      ctx.arc(pos[0], pos[1], fbR, 0, Math.PI * 2);
      ctx.fillStyle = grad;
      ctx.fill();
    }

    // Phase 3: mushroom cloud ring (10-60%)
    if (progress > 0.1 && progress < 0.6) {
      const ringProgress = (progress - 0.1) / 0.5;
      const ringR = maxR * (0.6 + ringProgress * 0.8);
      const ringAlpha = (1 - ringProgress) * 0.4;
      ctx.beginPath();
      ctx.arc(pos[0], pos[1], ringR, 0, Math.PI * 2);
      ctx.strokeStyle = withAlpha('#ff4400', ringAlpha);
      ctx.lineWidth = 3 * (1 - ringProgress);
      ctx.stroke();
    }

    // Phase 4: lingering glow (20-100%)
    if (progress > 0.2) {
      const glowProgress = (progress - 0.2) / 0.8;
      const glowR = maxR * 0.7;
      const glowAlpha = (1 - glowProgress) * 0.3;
      const grad = ctx.createRadialGradient(pos[0], pos[1], 0, pos[0], pos[1], glowR);
      grad.addColorStop(0, withAlpha('#ff4400', glowAlpha));
      grad.addColorStop(0.5, withAlpha('#991100', glowAlpha * 0.5));
      grad.addColorStop(1, 'transparent');
      ctx.beginPath();
      ctx.arc(pos[0], pos[1], glowR, 0, Math.PI * 2);
      ctx.fillStyle = grad;
      ctx.fill();
    }

    // Phase 5: outer shockwave ring (5-50%)
    if (progress > 0.05 && progress < 0.5) {
      const swProgress = (progress - 0.05) / 0.45;
      const swR = maxR * 2 * easeOutQuad(swProgress);
      const swAlpha = (1 - swProgress) * 0.2;
      ctx.beginPath();
      ctx.arc(pos[0], pos[1], swR, 0, Math.PI * 2);
      ctx.strokeStyle = withAlpha('#ffaa44', swAlpha);
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    return;
  }

  // === Standard explosion ===
  const currentRadius = splashR * easeOutQuad(Math.min(progress * 2, 1));
  const alpha = 1 - easeInQuad(progress);

  const explosionColor = explosion.isEMP ? '#8844ff' : COLORS.EXPLOSION;
  const outerColor = explosion.isEMP ? '#6622cc' : COLORS.MISSILE_TRAIL;

  // Outer glow
  const grad = ctx.createRadialGradient(
    pos[0], pos[1], 0,
    pos[0], pos[1], currentRadius
  );
  grad.addColorStop(0, withAlpha(explosionColor, alpha));
  grad.addColorStop(0.4, withAlpha(outerColor, alpha * 0.6));
  grad.addColorStop(1, 'transparent');

  ctx.beginPath();
  ctx.arc(pos[0], pos[1], currentRadius, 0, Math.PI * 2);
  ctx.fillStyle = grad;
  ctx.fill();

  // Inner bright core
  if (progress < 0.3) {
    const coreAlpha = 1 - progress / 0.3;
    ctx.beginPath();
    ctx.arc(pos[0], pos[1], currentRadius * 0.3, 0, Math.PI * 2);
    ctx.fillStyle = withAlpha('#ffffff', coreAlpha * 0.8);
    ctx.fill();
  }
}

// === Battery Placement Preview ===
let batteryPreviewPos = null;

export function setBatteryPreview(pos) {
  batteryPreviewPos = pos;
}

// === Targeting Preview ===
let targetingPreview = null;

export function setTargetingPreview(from, to) {
  targetingPreview = from && to ? { from, to } : null;
}

function drawTargetingPreview() {
  if (!targetingPreview) return;
  const { from, to } = targetingPreview;
  if (!isVisible(from) && !isVisible(to)) return;

  const p1 = projectPoint(from);
  const p2 = projectPoint(to);
  if (!p1 || !p2) return;

  // Dashed line from launch site to target
  ctx.beginPath();
  ctx.setLineDash([4, 4]);
  ctx.moveTo(p1[0], p1[1]);
  ctx.lineTo(p2[0], p2[1]);
  ctx.strokeStyle = withAlpha(COLORS.PLAYER, 0.5);
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.setLineDash([]);

  // Cost label at target end
  const playerId = gameState.playerCountryId;
  if (playerId) {
    const typeKey = getPlayerMissileType();
    const mtype = MISSILE_TYPES[typeKey];
    if (mtype) {
      const cost = getEffectiveCost(playerId, typeKey, from, to);
      const player = gameState.getPlayer();
      const canAfford = player && player.tokens >= cost;

      // Background pill
      const label = `${mtype.name} ${cost}◆`;
      ctx.font = '10px "JetBrains Mono", monospace';
      const textWidth = ctx.measureText(label).width;
      const lx = p2[0] + 10;
      const ly = p2[1] - 8;

      ctx.fillStyle = 'rgba(8, 8, 14, 0.85)';
      ctx.fillRect(lx - 4, ly - 10, textWidth + 8, 14);

      ctx.fillStyle = canAfford ? 'rgba(234, 179, 8, 0.9)' : 'rgba(220, 38, 38, 0.9)';
      ctx.fillText(label, lx, ly);

      // Damage estimate
      const dmgPct = mtype.damage > 0 ? `${(mtype.damage * 100).toFixed(0)}%` : 'N/A';
      const warheads = mtype.warheads ? ` ×${mtype.warheads}` : '';
      const special = mtype.empDuration ? `EMP ${mtype.empDuration}s`
        : mtype.contamination ? `+RAD ${mtype.contaminationDuration}s`
        : '';
      const dmgLabel = `DMG ${dmgPct}${warheads}${special ? ' ' + special : ''}`;
      const dmgWidth = ctx.measureText(dmgLabel).width;

      ctx.fillStyle = 'rgba(8, 8, 14, 0.85)';
      ctx.fillRect(lx - 4, ly + 2, dmgWidth + 8, 14);

      ctx.fillStyle = mtype.damage > 0 ? 'rgba(220, 38, 38, 0.8)' : 'rgba(124, 58, 237, 0.8)';
      ctx.fillText(dmgLabel, lx, ly + 12);

      // Distance + flight time
      const dist = geoDistance(from, to);
      const distKm = Math.round(dist * 6371);
      const flightTime = Math.round(mtype.baseFlight + dist * mtype.distFactor);
      const distLabel = `${distKm.toLocaleString()} km · ~${flightTime}s`;
      const distWidth = ctx.measureText(distLabel).width;

      ctx.fillStyle = 'rgba(8, 8, 14, 0.85)';
      ctx.fillRect(lx - 4, ly + 14, distWidth + 8, 14);

      ctx.fillStyle = 'rgba(184, 188, 200, 0.5)';
      ctx.fillText(distLabel, lx, ly + 24);
    }
  }
}

// === Intercept Rendering ===
function drawIntercept(intercept) {
  const batteryVisible = isVisible(intercept.batteryPos);
  if (!batteryVisible) return;
  const bp = projectPoint(intercept.batteryPos);
  if (!bp) return;

  // Track the missile's live position if still in flight
  let ip;
  if (!intercept.resolved && intercept.targetMissileRef) {
    const livePos = intercept.targetMissileRef.interpolator(intercept.targetMissileRef.progress);
    ip = isVisible(livePos) ? projectPoint(livePos) : null;
  }
  if (!ip) {
    ip = isVisible(intercept.interceptPos) ? projectPoint(intercept.interceptPos) : null;
  }
  if (!ip) return;

  if (!intercept.resolved) {
    const t = intercept.progress;
    const currentX = bp[0] + (ip[0] - bp[0]) * t;
    const currentY = bp[1] + (ip[1] - bp[1]) * t;

    // Trail
    const trailAlpha = 0.5 * (1 - t * 0.3);
    ctx.beginPath();
    ctx.moveTo(bp[0], bp[1]);
    ctx.lineTo(currentX, currentY);
    ctx.strokeStyle = withAlpha(COLORS.INTERCEPTOR, trailAlpha);
    ctx.lineWidth = 2;
    ctx.stroke();

    // Interceptor head — bright dot
    ctx.beginPath();
    ctx.arc(currentX, currentY, 2.5, 0, Math.PI * 2);
    ctx.fillStyle = COLORS.INTERCEPTOR;
    ctx.fill();

    // Small glow at head
    const grad = ctx.createRadialGradient(currentX, currentY, 0, currentX, currentY, 6);
    grad.addColorStop(0, withAlpha(COLORS.INTERCEPTOR, 0.4));
    grad.addColorStop(1, 'transparent');
    ctx.beginPath();
    ctx.arc(currentX, currentY, 6, 0, Math.PI * 2);
    ctx.fillStyle = grad;
    ctx.fill();
  } else {
    // === Resolved: hit flash or miss fizzle at the intercept point ===
    const age = (gameState.elapsed - intercept.resolvedAt) * 1000;
    const p = ip || bp;
    if (!p) return;

    if (intercept.success) {
      const flashDuration = 400;
      if (age < flashDuration) {
        const progress = age / flashDuration;
        const r = 5 + progress * 10;
        const alpha = 1 - progress;

        const grad = ctx.createRadialGradient(p[0], p[1], 0, p[0], p[1], r);
        grad.addColorStop(0, withAlpha('#ffffff', alpha));
        grad.addColorStop(0.4, withAlpha(COLORS.INTERCEPTOR, alpha * 0.5));
        grad.addColorStop(1, 'transparent');
        ctx.beginPath();
        ctx.arc(p[0], p[1], r, 0, Math.PI * 2);
        ctx.fillStyle = grad;
        ctx.fill();
      }
    } else {
      const fizzleDuration = 250;
      if (age < fizzleDuration) {
        const alpha = 1 - age / fizzleDuration;
        ctx.beginPath();
        ctx.arc(p[0], p[1], 3, 0, Math.PI * 2);
        ctx.fillStyle = withAlpha('#ff4444', alpha * 0.4);
        ctx.fill();
      }
    }
  }
}

// === Battery Preview ===
function drawBatteryPreview() {
  if (!batteryPreviewPos) return;
  const mode = getMode();
  if (mode !== 'PLACING_BATTERY' && mode !== 'BUILDING_SILO') return;
  if (!isVisible(batteryPreviewPos)) return;

  const pos = projectPoint(batteryPreviewPos);
  if (!pos) return;

  const [cx, cy] = getGlobeCenter();
  const globeRadius = getGlobeRadius();

  // Range circle (approximate: INTERCEPTOR_RANGE in radians → screen pixels)
  const rangePixels = INTERCEPTOR_RANGE * globeRadius;

  ctx.beginPath();
  ctx.arc(pos[0], pos[1], rangePixels, 0, Math.PI * 2);
  ctx.setLineDash([4, 4]);
  ctx.strokeStyle = withAlpha(COLORS.PLAYER, 0.3);
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.setLineDash([]);

  // Fill
  ctx.beginPath();
  ctx.arc(pos[0], pos[1], rangePixels, 0, Math.PI * 2);
  ctx.fillStyle = withAlpha(COLORS.PLAYER, 0.05);
  ctx.fill();

  // Center marker
  ctx.beginPath();
  ctx.moveTo(pos[0] - 4, pos[1] - 3);
  ctx.lineTo(pos[0] + 4, pos[1] - 3);
  ctx.lineTo(pos[0], pos[1] + 5);
  ctx.closePath();
  ctx.fillStyle = withAlpha(COLORS.PLAYER, 0.6);
  ctx.fill();

  // Cost label
  const playerId = gameState.playerCountryId;
  if (playerId) {
    const mode = getMode();
    const buildMult = getBuildCostMultiplier(playerId);
    const player = gameState.getPlayer();

    let label, cost;
    if (mode === 'PLACING_BATTERY') {
      cost = Math.ceil(gameState.getBatteryCost(playerId) * buildMult);
      const rangeKm = Math.round(INTERCEPTOR_RANGE * 6371);
      label = `INTERCEPTOR ${cost}◆`;
      const subLabel = `Range: ${rangeKm} km`;

      ctx.font = '10px "JetBrains Mono", monospace';
      const w = Math.max(ctx.measureText(label).width, ctx.measureText(subLabel).width);
      const lx = pos[0] + 14;
      const ly = pos[1] - 4;

      ctx.fillStyle = 'rgba(8, 8, 14, 0.85)';
      ctx.fillRect(lx - 4, ly - 10, w + 8, 28);

      ctx.fillStyle = player && player.tokens >= cost ? 'rgba(56, 189, 248, 0.9)' : 'rgba(220, 38, 38, 0.9)';
      ctx.fillText(label, lx, ly);

      ctx.fillStyle = 'rgba(184, 188, 200, 0.5)';
      ctx.fillText(subLabel, lx, ly + 12);

    } else if (mode === 'BUILDING_SILO') {
      const siloCount = player ? player.launchSites.length : 0;
      cost = Math.ceil((15 + siloCount * 3) * buildMult);
      label = `LAUNCH SILO ${cost}◆`;

      ctx.font = '10px "JetBrains Mono", monospace';
      const w = ctx.measureText(label).width;
      const lx = pos[0] + 14;
      const ly = pos[1] - 4;

      ctx.fillStyle = 'rgba(8, 8, 14, 0.85)';
      ctx.fillRect(lx - 4, ly - 10, w + 8, 14);

      ctx.fillStyle = player && player.tokens >= cost ? 'rgba(74, 222, 128, 0.9)' : 'rgba(220, 38, 38, 0.9)';
      ctx.fillText(label, lx, ly);
    }
  }
}

// === Invasion Animation ===
function drawInvasion(inv, age) {
  const fromVis = isVisible(inv.from);
  const toVis = isVisible(inv.to);
  if (!fromVis && !toVis) return;

  const p1 = fromVis ? projectPoint(inv.from) : null;
  const p2 = toVis ? projectPoint(inv.to) : null;
  if (!p1 || !p2) return;

  const progress = age / inv.duration;
  const fadeAlpha = progress < 0.2 ? progress / 0.2 : progress > 0.8 ? (1 - progress) / 0.2 : 1;

  // Multiple arrow lines sweeping from attacker to target
  const numArrows = 5;
  for (let a = 0; a < numArrows; a++) {
    const offset = a / numArrows;
    const arrowProgress = ((progress * 2 + offset) % 1); // staggered, looping

    const ax = p1[0] + (p2[0] - p1[0]) * arrowProgress;
    const ay = p1[1] + (p2[1] - p1[1]) * arrowProgress;

    // Spread arrows slightly perpendicular to the path
    const dx = p2[0] - p1[0];
    const dy = p2[1] - p1[1];
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    const perpX = -dy / len;
    const perpY = dx / len;
    const spread = (a - numArrows / 2) * 4;

    const fx = ax + perpX * spread;
    const fy = ay + perpY * spread;

    // Arrow chevron
    const angle = Math.atan2(dy, dx);
    const size = 4;
    ctx.save();
    ctx.translate(fx, fy);
    ctx.rotate(angle);
    ctx.beginPath();
    ctx.moveTo(size, 0);
    ctx.lineTo(-size * 0.5, -size * 0.4);
    ctx.lineTo(-size * 0.5, size * 0.4);
    ctx.closePath();
    ctx.fillStyle = withAlpha('#4ade80', fadeAlpha * 0.6 * (1 - arrowProgress * 0.5));
    ctx.fill();
    ctx.restore();
  }

  // Main path line
  ctx.beginPath();
  ctx.moveTo(p1[0], p1[1]);
  ctx.lineTo(p2[0], p2[1]);
  ctx.strokeStyle = withAlpha('#4ade80', fadeAlpha * 0.15);
  ctx.lineWidth = 3;
  ctx.stroke();

  // "INVASION" label at midpoint
  const mx = (p1[0] + p2[0]) / 2;
  const my = (p1[1] + p2[1]) / 2;
  const pulse = 0.7 + 0.3 * Math.sin(age * 6);

  ctx.font = '10px "JetBrains Mono", monospace';
  ctx.fillStyle = withAlpha('#4ade80', fadeAlpha * pulse * 0.8);
  ctx.textAlign = 'center';
  ctx.fillText('INVASION', mx, my - 8);

  // Target circle pulsing
  const targetRadius = 15 + Math.sin(age * 4) * 5;
  ctx.beginPath();
  ctx.arc(p2[0], p2[1], targetRadius, 0, Math.PI * 2);
  ctx.strokeStyle = withAlpha('#4ade80', fadeAlpha * 0.3);
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.textAlign = 'start'; // reset
}

// === Contamination Zones ===
function drawContamination(zone) {
  if (!isVisible(zone.position)) return;
  const pos = projectPoint(zone.position);
  if (!pos) return;

  const [cx, cy] = getGlobeCenter();
  const globeRadius = getGlobeRadius();
  const pixelRadius = zone.radius * globeRadius;
  const age = gameState.elapsed - zone.startTime;
  const remaining = zone.duration - age;
  const pulse = 0.5 + 0.5 * Math.sin(age * 3);

  // Toxic green glow
  const grad = ctx.createRadialGradient(pos[0], pos[1], 0, pos[0], pos[1], pixelRadius);
  grad.addColorStop(0, withAlpha('#88aa00', 0.15 * pulse));
  grad.addColorStop(0.6, withAlpha('#556600', 0.08 * pulse));
  grad.addColorStop(1, 'transparent');
  ctx.beginPath();
  ctx.arc(pos[0], pos[1], pixelRadius, 0, Math.PI * 2);
  ctx.fillStyle = grad;
  ctx.fill();

  // Dashed border
  ctx.beginPath();
  ctx.arc(pos[0], pos[1], pixelRadius, 0, Math.PI * 2);
  ctx.setLineDash([3, 3]);
  ctx.strokeStyle = withAlpha('#88aa00', 0.3 * pulse);
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.setLineDash([]);
}

// === Interceptor Range Circles ===
function drawInterceptorRanges() {
  if (gameState.phase !== 'PLAYING' && gameState.phase !== 'SETUP') return;
  const playerId = gameState.playerCountryId;

  for (const battery of gameState.interceptors) {
    if (battery.countryId !== playerId) continue;
    if (!isVisible(battery.position)) continue;
    const pos = projectPoint(battery.position);
    if (!pos) return;

    const globeRadius = getGlobeRadius();
    const rangePixels = battery.range * globeRadius;
    const onCooldown = battery.cooldownUntil > gameState.elapsed;

    ctx.beginPath();
    ctx.arc(pos[0], pos[1], rangePixels, 0, Math.PI * 2);
    ctx.setLineDash([2, 4]);
    ctx.strokeStyle = withAlpha(onCooldown ? '#334' : '#38bdf8', onCooldown ? 0.1 : 0.15);
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.setLineDash([]);
  }
}

// === Incoming Threat Lines ===
function drawIncomingThreats() {
  if (gameState.phase !== 'PLAYING' && gameState.phase !== 'SETUP') return;
  const playerId = gameState.playerCountryId;

  for (const missile of gameState.missiles) {
    if (missile.toCountryId !== playerId) continue;

    const currentPos = missile.interpolator(missile.progress);
    if (!isVisible(currentPos) && !isVisible(missile.target)) continue;

    const p1 = isVisible(currentPos) ? projectPoint(currentPos) : null;
    const p2 = isVisible(missile.target) ? projectPoint(missile.target) : null;
    if (!p1 && !p2) continue;

    // Dashed red line from current position to target
    if (p1 && p2) {
      ctx.beginPath();
      ctx.setLineDash([3, 5]);
      ctx.moveTo(p1[0], p1[1]);
      ctx.lineTo(p2[0], p2[1]);
      ctx.strokeStyle = withAlpha('#dc2626', 0.25);
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }
}

// Fog of war is handled via SVG country styling in Globe.js — no canvas fog needed

// === Satellite Sweep ===
function drawSatLaunchAnimations() {
  if (gameState.phase !== 'PLAYING' && gameState.phase !== 'SETUP') return;

  const launches = getSatLaunches();
  for (const launch of launches) {
    const age = gameState.elapsed - launch.startTime;
    const totalDuration = launch.launchDuration + launch.transferDuration;
    if (age > totalDuration) continue;

    const p = age / totalDuration; // 0→1 overall progress

    // Interpolate geo position from launch site to orbital insertion point
    const ip = launch.insertionPoint;
    const lon = launch.from[0] + (ip.lon - launch.from[0]) * p;
    const lat = launch.from[1] + (ip.lat - launch.from[1]) * p;

    if (!isVisible([lon, lat])) continue;
    const pos = projectPoint([lon, lat]);
    if (!pos) continue;

    // Fading trail from launch site
    const fromPos = isVisible(launch.from) ? projectPoint(launch.from) : null;
    if (fromPos) {
      ctx.beginPath();
      ctx.moveTo(fromPos[0], fromPos[1]);
      ctx.lineTo(pos[0], pos[1]);
      ctx.strokeStyle = withAlpha('#22d3ee', (1 - p) * 0.2);
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    // Dot — white early, cyan later
    const dotColor = p < 0.3 ? '#ffffff' : '#22d3ee';
    ctx.beginPath();
    ctx.arc(pos[0], pos[1], 2.5, 0, Math.PI * 2);
    ctx.fillStyle = withAlpha(dotColor, 0.8);
    ctx.fill();

    // Label
    if (p < 0.8) {
      const label = p < 0.4 ? `LAUNCH ${launch.preset.name}` : 'ORBITAL INSERTION';
      ctx.font = '9px "JetBrains Mono", monospace';
      ctx.fillStyle = withAlpha('#22d3ee', (1 - p) * 0.6);
      ctx.textAlign = 'center';
      ctx.fillText(label, pos[0], pos[1] - 10);
      ctx.textAlign = 'start';
    }
  }
}

// Store satellite screen positions for hover detection
let satScreenPositions = [];

function drawSatelliteSweep() {
  if (gameState.phase !== 'PLAYING' && gameState.phase !== 'SETUP') return;

  const sats = getAllSatellites();
  satScreenPositions = [];

  for (const sat of sats) {
    const satLon = sat.lon;
    const satLat = sat.lat;
    const trail = sat.trail || [];

    // Draw fading trail — where the satellite has actually been
    if (trail.length > 1) {
      let lastPos = null;
      for (let i = 0; i < trail.length; i++) {
        const pt = trail[i];
        if (!isVisible([pt.lon, pt.lat])) { lastPos = null; continue; }
        const pos = projectPoint([pt.lon, pt.lat]);
        if (!pos) { lastPos = null; continue; }

        if (lastPos) {
          // Break line if wrapping around map edge
          if (Math.abs(pos[0] - lastPos[0]) < 200) {
            const alpha = (i / trail.length) * 0.12; // older = fainter
            ctx.beginPath();
            ctx.moveTo(lastPos[0], lastPos[1]);
            ctx.lineTo(pos[0], pos[1]);
            ctx.strokeStyle = withAlpha('#22d3ee', alpha);
            ctx.lineWidth = 1;
            ctx.stroke();
          }
        }
        lastPos = pos;
      }
    }

    // Satellite dot
    if (!isVisible([satLon, satLat])) continue;
    const satPos = projectPoint([satLon, satLat]);
    if (!satPos) continue;

    satScreenPositions.push({ x: satPos[0], y: satPos[1], name: sat.name, desc: sat.desc, incl: sat.inclination });

    ctx.beginPath();
    ctx.arc(satPos[0], satPos[1], 2.5, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(34, 211, 238, 0.8)';
    ctx.fill();

    // Scan footprint
    ctx.beginPath();
    ctx.arc(satPos[0], satPos[1], 18, 0, Math.PI * 2);
    ctx.setLineDash([2, 4]);
    ctx.strokeStyle = 'rgba(34, 211, 238, 0.12)';
    ctx.lineWidth = 0.7;
    ctx.stroke();
    ctx.setLineDash([]);
  }
}

// Check if mouse is near a satellite — called from outside
export function getSatelliteAtScreen(screenX, screenY) {
  for (const sat of satScreenPositions) {
    const dx = screenX - sat.x;
    const dy = screenY - sat.y;
    if (dx * dx + dy * dy < 400) return sat; // 20px radius
  }
  return null;
}

// === Resource Nodes ===
function drawResourceNodes() {
  if (gameState.phase !== 'PLAYING' && gameState.phase !== 'SETUP') return;

  const nodes = getAllNodes();
  for (const node of nodes) {
    if (!isVisible(node.coords)) continue;
    const pos = projectPoint(node.coords);
    if (!pos) continue;

    const color = RESOURCE_COLORS[node.type] || '#888';
    const isOwned = node.ownerId === gameState.playerCountryId;
    const isAllyOwned = node.ownerId && gameState.isAllied(gameState.playerCountryId, node.ownerId);

    // Outer ring
    ctx.beginPath();
    ctx.arc(pos[0], pos[1], 5, 0, Math.PI * 2);
    ctx.strokeStyle = withAlpha(color, isOwned ? 0.9 : 0.4);
    ctx.lineWidth = isOwned ? 1.5 : 1;
    ctx.stroke();

    // Inner fill
    ctx.beginPath();
    ctx.arc(pos[0], pos[1], 3, 0, Math.PI * 2);
    ctx.fillStyle = withAlpha(color, isOwned ? 0.7 : isAllyOwned ? 0.4 : 0.2);
    ctx.fill();

    // Glow for player-owned
    if (isOwned) {
      const grad = ctx.createRadialGradient(pos[0], pos[1], 0, pos[0], pos[1], 10);
      grad.addColorStop(0, withAlpha(color, 0.15));
      grad.addColorStop(1, 'transparent');
      ctx.beginPath();
      ctx.arc(pos[0], pos[1], 10, 0, Math.PI * 2);
      ctx.fillStyle = grad;
      ctx.fill();
    }
  }
}

// === City Lights ===
let cityLightCache = null;
let cityLightCacheTime = 0;

function drawCityLights() {
  const now = performance.now() / 1000;

  // Use live game data if playing, otherwise static country data for title screen
  const countries = gameState.phase === 'PLAYING'
    ? [...gameState.countries.values()].filter(c => !gameState.isEliminated(c.id))
    : COUNTRIES;

  const playerId = gameState.playerCountryId;

  for (const country of countries) {
    // Fog of war — hide city lights for nations whose cities have never been seen
    if (gameState.phase === 'PLAYING' && country.id && country.id !== playerId
        && !hasCitiesBeenRevealed(country.id)) {
      continue;
    }
    for (const city of (country.cities || [])) {
      if (!isVisible(city.coords)) continue;
      const screenPos = projectPoint(city.coords);
      if (!screenPos) continue;

      const popRatio = city.startingPopulation > 0
        ? city.population / city.startingPopulation
        : (city.popShare || 0.5); // static data uses popShare

      // Per-city flicker — unique phase from coords hash
      const hash = (city.coords[0] * 73.7 + city.coords[1] * 31.3) % 1;
      const flickerSpeed = 1.5 + hash * 3; // 1.5-4.5 Hz
      const flicker = 0.7 + 0.3 * Math.sin(now * flickerSpeed * 6.28 + hash * 100);

      const brightness = city.destroyed ? 0.02 : popRatio * 0.25 * flicker;

      // Glow
      const r = 1.5 + popRatio * 2.5;
      const grad = ctx.createRadialGradient(
        screenPos[0], screenPos[1], 0,
        screenPos[0], screenPos[1], r * 3
      );
      const glowColor = city.destroyed ? '#331100' : '#ffdd88';
      grad.addColorStop(0, withAlpha(glowColor, brightness * 0.6));
      grad.addColorStop(1, 'transparent');

      ctx.beginPath();
      ctx.arc(screenPos[0], screenPos[1], r * 3, 0, Math.PI * 2);
      ctx.fillStyle = grad;
      ctx.fill();

      // Core dot — color indicates health, flickers
      const coreColor = city.destroyed ? '#440000' :
        popRatio > 0.6 ? '#ffeecc' :
        popRatio > 0.3 ? '#ffaa44' : '#ff4422';
      ctx.beginPath();
      ctx.arc(screenPos[0], screenPos[1], Math.max(1, r * 0.6), 0, Math.PI * 2);
      ctx.fillStyle = withAlpha(coreColor, city.destroyed ? 0.3 : 0.8);
      ctx.fill();
    }
  }
}

// === Screen Flash ===
let flashUntil = 0;
let flashColor = '#ffffff';

export function triggerFlash(color = '#ffffff', durationMs = 150) {
  flashUntil = performance.now() + durationMs;
  flashColor = color;
}

// === Screen Shake ===
export function triggerShake(durationMs = 200) {
  shakeUntil = performance.now() + durationMs;
}

// === Helpers ===

// Returns an array of t values for the trailing portion of a missile arc
function sampleArcTs(missile, count) {
  const ts = [];
  const start = Math.max(0, missile.progress - 0.15);
  for (let i = 0; i < count; i++) {
    ts.push(start + (missile.progress - start) * (i / (count - 1)));
  }
  return ts;
}

export function sampleFullArc(missile, count) {
  const points = [];
  for (let i = 0; i <= count; i++) {
    points.push(missile.interpolator(i / count));
  }
  return points;
}

// Get screen position for any point along the arc.
// The orthographic projection naturally curves great-circle paths into arcs,
// so no artificial height offset is needed.
function getArcScreenPos(missile, t) {
  const lonLat = missile.interpolator(t);
  if (!isVisible(lonLat)) return null;
  return projectPoint(lonLat);
}

function withAlpha(hex, alpha) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function easeOutQuad(t) { return 1 - (1 - t) * (1 - t); }
function easeInQuad(t) { return t * t; }
