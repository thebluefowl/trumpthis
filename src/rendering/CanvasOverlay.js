import { COLORS, EXPLOSION_DURATION, TRAIL_FADE_TIME } from '../constants.js';
import { gameState } from '../state/GameState.js';
import {
  getProjection,
  getGlobeRadius,
  getGlobeCenter,
  projectPoint,
  isVisible,
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
  const w = window.innerWidth;
  const h = window.innerHeight;
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

  // Apply screen shake
  const now = performance.now();
  if (now < shakeUntil) {
    shakeOffset.x = (Math.random() - 0.5) * 4;
    shakeOffset.y = (Math.random() - 0.5) * 4;
  } else {
    shakeOffset.x = 0;
    shakeOffset.y = 0;
  }

  ctx.save();
  ctx.translate(shakeOffset.x, shakeOffset.y);

  // Clip to globe circle
  const [cx, cy] = getGlobeCenter();
  const radius = getGlobeRadius();
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.clip();

  // Draw targeting preview line
  drawTargetingPreview();

  // Draw fading trails
  for (const trail of gameState.trails) {
    drawTrail(trail);
  }

  // Draw active missiles
  for (const missile of gameState.missiles) {
    drawMissile(missile);
  }

  // Draw explosions
  for (const explosion of gameState.explosions) {
    drawExplosion(explosion);
  }

  ctx.restore();
}

function drawMissile(missile) {
  const points = sampleArc(missile, 15);
  const visiblePoints = points
    .map(lonLat => isVisible(lonLat) ? projectPoint(lonLat) : null);

  // Draw trail gradient
  for (let i = 1; i < visiblePoints.length; i++) {
    const prev = visiblePoints[i - 1];
    const curr = visiblePoints[i];
    if (!prev || !curr) continue;

    const alpha = (i / visiblePoints.length) * 0.8;
    ctx.beginPath();
    ctx.moveTo(prev[0], prev[1]);
    ctx.lineTo(curr[0], curr[1]);
    ctx.strokeStyle = withAlpha(COLORS.MISSILE_TRAIL, alpha);
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  // Draw missile head
  const headPos = getMissileScreenPos(missile);
  if (headPos && isVisible(missile.interpolator(missile.progress))) {
    ctx.beginPath();
    ctx.arc(headPos[0], headPos[1], 3, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();

    // Glow
    ctx.beginPath();
    ctx.arc(headPos[0], headPos[1], 6, 0, Math.PI * 2);
    const glow = ctx.createRadialGradient(
      headPos[0], headPos[1], 0,
      headPos[0], headPos[1], 6
    );
    glow.addColorStop(0, withAlpha(COLORS.MISSILE_TRAIL, 0.6));
    glow.addColorStop(1, 'transparent');
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
  const age = (gameState.elapsed - explosion.startTime) * 1000;
  if (age > EXPLOSION_DURATION) return;
  if (!isVisible(explosion.position)) return;

  const pos = projectPoint(explosion.position);
  if (!pos) return;

  const progress = age / EXPLOSION_DURATION;
  const currentRadius = explosion.maxRadius * easeOutQuad(Math.min(progress * 2, 1));
  const alpha = 1 - easeInQuad(progress);

  // Outer glow
  const grad = ctx.createRadialGradient(
    pos[0], pos[1], 0,
    pos[0], pos[1], currentRadius
  );
  grad.addColorStop(0, withAlpha(COLORS.EXPLOSION, alpha));
  grad.addColorStop(0.4, withAlpha(COLORS.MISSILE_TRAIL, alpha * 0.6));
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

  ctx.beginPath();
  ctx.setLineDash([4, 4]);
  ctx.moveTo(p1[0], p1[1]);
  ctx.lineTo(p2[0], p2[1]);
  ctx.strokeStyle = withAlpha(COLORS.PLAYER, 0.5);
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.setLineDash([]);
}

// === Screen Shake ===
export function triggerShake(durationMs = 200) {
  shakeUntil = performance.now() + durationMs;
}

// === Helpers ===

function sampleArc(missile, count) {
  const points = [];
  const start = Math.max(0, missile.progress - 0.15);
  for (let i = 0; i < count; i++) {
    const t = start + (missile.progress - start) * (i / (count - 1));
    points.push(missile.interpolator(t));
  }
  return points;
}

export function sampleFullArc(missile, count) {
  const points = [];
  for (let i = 0; i <= count; i++) {
    points.push(missile.interpolator(i / count));
  }
  return points;
}

function getMissileScreenPos(missile) {
  const lonLat = missile.interpolator(missile.progress);
  if (!isVisible(lonLat)) return null;

  const [x, y] = projectPoint(lonLat);
  const [cx, cy] = getGlobeCenter();
  const radius = getGlobeRadius();

  // Parabolic height offset for the "lobbed arc" look
  const heightFactor = Math.sin(missile.progress * Math.PI);
  const arcOffset = heightFactor * missile.arcHeight * radius * 0.3;

  const dx = x - cx;
  const dy = y - cy;
  const dist = Math.sqrt(dx * dx + dy * dy) || 1;

  return [x - (dx / dist) * arcOffset, y - (dy / dist) * arcOffset];
}

function withAlpha(hex, alpha) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function easeOutQuad(t) { return 1 - (1 - t) * (1 - t); }
function easeInQuad(t) { return t * t; }
