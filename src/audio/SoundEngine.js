import { events } from '../state/events.js';
import { gameState } from '../state/GameState.js';

let ctx = null;
let masterGain = null;
let ambienceNode = null;

function getCtx() {
  if (!ctx) {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    masterGain = ctx.createGain();
    masterGain.gain.value = 0.3;
    masterGain.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

// === Synth primitives ===

function playTone(freq, duration, type = 'sine', volume = 0.2, attack = 0.01, decay = 0.1) {
  const c = getCtx();
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0, c.currentTime);
  gain.gain.linearRampToValueAtTime(volume, c.currentTime + attack);
  gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + duration);
  osc.connect(gain);
  gain.connect(masterGain);
  osc.start(c.currentTime);
  osc.stop(c.currentTime + duration);
}

function playNoise(duration, volume = 0.1) {
  const c = getCtx();
  const bufferSize = c.sampleRate * duration;
  const buffer = c.createBuffer(1, bufferSize, c.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = (Math.random() * 2 - 1) * volume;
  }
  const source = c.createBufferSource();
  source.buffer = buffer;
  const gain = c.createGain();
  gain.gain.setValueAtTime(volume, c.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + duration);
  source.connect(gain);
  gain.connect(masterGain);
  source.start();
}

// === Sound effects ===

function launchSound() {
  playTone(200, 0.3, 'sawtooth', 0.15, 0.01, 0.2);
  playTone(150, 0.5, 'sine', 0.1, 0.05, 0.3);
  playNoise(0.2, 0.08);
}

function impactSound() {
  playTone(60, 0.8, 'sine', 0.3, 0.01, 0.1);
  playTone(40, 1.2, 'sine', 0.2, 0.05, 0.1);
  playNoise(0.6, 0.15);
}

function interceptSound() {
  playTone(800, 0.15, 'sine', 0.1);
  playTone(1200, 0.1, 'sine', 0.08, 0.01, 0.05);
}

function empSound() {
  playTone(100, 1.0, 'square', 0.2, 0.01, 0.1);
  playTone(50, 1.5, 'sine', 0.15, 0.1, 0.2);
  playNoise(0.8, 0.12);
}

function allianceSound() {
  playTone(440, 0.2, 'sine', 0.1);
  setTimeout(() => playTone(554, 0.2, 'sine', 0.1), 100);
  setTimeout(() => playTone(659, 0.3, 'sine', 0.1), 200);
}

function betrayalSound() {
  playTone(300, 0.3, 'sawtooth', 0.15);
  setTimeout(() => playTone(200, 0.4, 'sawtooth', 0.12), 150);
}

function eliminationSound() {
  playTone(100, 1.5, 'sine', 0.25, 0.01, 0.1);
  playNoise(1.0, 0.15);
  setTimeout(() => playTone(80, 1.0, 'sine', 0.15), 500);
}

function escalationSound() {
  for (let i = 0; i < 3; i++) {
    setTimeout(() => playTone(800, 0.15, 'square', 0.15), i * 200);
  }
}

function incomingAlarm() {
  playTone(600, 0.2, 'square', 0.1);
  setTimeout(() => playTone(600, 0.2, 'square', 0.1), 300);
}

// === Ambient drone ===

function startAmbience() {
  const c = getCtx();
  if (ambienceNode) return;

  const osc1 = c.createOscillator();
  const osc2 = c.createOscillator();
  const gain = c.createGain();

  osc1.type = 'sine';
  osc1.frequency.value = 55;
  osc2.type = 'sine';
  osc2.frequency.value = 57; // slight detuning for beating effect

  gain.gain.value = 0.04;

  osc1.connect(gain);
  osc2.connect(gain);
  gain.connect(masterGain);

  osc1.start();
  osc2.start();

  ambienceNode = { osc1, osc2, gain };
}

function stopAmbience() {
  if (!ambienceNode) return;
  ambienceNode.osc1.stop();
  ambienceNode.osc2.stop();
  ambienceNode = null;
}

// === Event wiring ===

export function initSoundEngine() {
  // Start audio context on first user interaction
  document.addEventListener('click', () => getCtx(), { once: true });

  events.on('game:start', () => {
    getCtx();
    startAmbience();
  });

  events.on('missile:impact', (missile) => {
    const playerId = gameState.playerCountryId;
    const isPlayerTarget = missile.toCountryId === playerId;
    const isPlayerAttack = missile.fromCountryId === playerId;
    const isAllyTarget = gameState.isAllied(playerId, missile.toCountryId);

    if (isPlayerTarget) {
      // You're being hit — loud alarm + impact
      if (missile.mtype?.empDuration) empSound();
      else impactSound();
      incomingAlarm();
    } else if (isPlayerAttack) {
      // Your missile landed — quieter confirmation
      playTone(300, 0.2, 'sine', 0.08);
    } else if (isAllyTarget) {
      // Ally hit — subtle rumble
      playTone(80, 0.3, 'sine', 0.05);
    }
    // Other nations' impacts — silent
  });

  events.on('launchsite:click', () => launchSound());

  events.on('missile:intercepted', ({ battery }) => {
    // Only play sound for your own interceptions
    if (battery.countryId === gameState.playerCountryId) {
      interceptSound();
    }
  });

  events.on('alliance:formed', ({ a, b }) => {
    if (a === gameState.playerCountryId || b === gameState.playerCountryId) {
      allianceSound();
    }
  });
  events.on('alliance:broken', ({ a, b }) => {
    if (a === gameState.playerCountryId || b === gameState.playerCountryId) {
      betrayalSound();
    }
  });

  events.on('country:destroyed', () => eliminationSound());

  events.on('escalation:tick', () => escalationSound());

  events.on('game:over', () => {
    stopAmbience();
    setTimeout(() => {
      playTone(220, 2, 'sine', 0.2);
      playTone(165, 2, 'sine', 0.15, 0.5, 0.2);
    }, 500);
  });
}

export function resetSoundEngine() {
  stopAmbience();
}
