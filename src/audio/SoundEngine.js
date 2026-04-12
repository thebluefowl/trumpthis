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
  // Rocket ignition — low rumble rising to a whoosh
  playTone(80, 0.2, 'sawtooth', 0.12, 0.01, 0.1);
  playTone(200, 0.4, 'sawtooth', 0.08, 0.1, 0.2);
  playTone(400, 0.3, 'sine', 0.05, 0.15, 0.2);
  playNoise(0.3, 0.06);
}

function impactSound() {
  // Deep thud + rumble + debris
  playTone(40, 1.0, 'sine', 0.3, 0.005, 0.05);
  playTone(55, 0.8, 'sine', 0.2, 0.01, 0.1);
  playTone(30, 1.5, 'triangle', 0.15, 0.05, 0.1);
  playNoise(0.8, 0.12);
  setTimeout(() => playNoise(0.5, 0.06), 200); // secondary debris
}

function nukeImpactSound() {
  // Massive bass + sustained roar
  playTone(25, 2.0, 'sine', 0.35, 0.005, 0.05);
  playTone(40, 1.5, 'sine', 0.25, 0.01, 0.1);
  playTone(55, 1.2, 'triangle', 0.2, 0.05, 0.1);
  playNoise(1.5, 0.2);
  setTimeout(() => {
    playTone(35, 1.5, 'sine', 0.15, 0.1, 0.2);
    playNoise(1.0, 0.1);
  }, 500);
}

function interceptSound() {
  // Sharp ascending ping — satisfying "got it"
  playTone(600, 0.1, 'sine', 0.1, 0.005);
  playTone(900, 0.1, 'sine', 0.08, 0.005);
  setTimeout(() => playTone(1200, 0.15, 'sine', 0.06), 50);
}

function empSound() {
  // Electrical crackle + deep pulse
  playTone(80, 1.2, 'square', 0.15, 0.01, 0.1);
  playTone(40, 1.5, 'sine', 0.12, 0.1, 0.2);
  for (let i = 0; i < 5; i++) {
    setTimeout(() => playNoise(0.05, 0.15), i * 50 + Math.random() * 30);
  }
}

function allianceSound() {
  // Major chord — hopeful
  playTone(330, 0.3, 'sine', 0.08);
  setTimeout(() => playTone(415, 0.3, 'sine', 0.08), 80);
  setTimeout(() => playTone(494, 0.4, 'sine', 0.08), 160);
  setTimeout(() => playTone(660, 0.3, 'sine', 0.05), 240);
}

function betrayalSound() {
  // Dissonant descending — ominous
  playTone(400, 0.3, 'sawtooth', 0.12);
  setTimeout(() => playTone(350, 0.3, 'sawtooth', 0.1), 100);
  setTimeout(() => playTone(280, 0.4, 'sawtooth', 0.08), 200);
  setTimeout(() => playTone(200, 0.5, 'sawtooth', 0.06), 300);
}

function eliminationSound() {
  // Low drone + crumble
  playTone(60, 2.0, 'sine', 0.2, 0.01, 0.1);
  playTone(45, 1.5, 'triangle', 0.15, 0.05, 0.1);
  playNoise(1.2, 0.12);
  setTimeout(() => {
    playTone(50, 1.0, 'sine', 0.1);
    playNoise(0.8, 0.08);
  }, 500);
}

function escalationSound() {
  // Three urgent pings ascending
  playTone(600, 0.12, 'square', 0.12);
  setTimeout(() => playTone(750, 0.12, 'square', 0.12), 180);
  setTimeout(() => playTone(900, 0.15, 'square', 0.12), 360);
}

function incomingAlarm(urgency) {
  // Urgency: 0-1, scales volume and speed
  const vol = 0.06 + urgency * 0.1;
  const freq = 500 + urgency * 300;
  playTone(freq, 0.15, 'square', vol);
  setTimeout(() => playTone(freq, 0.15, 'square', vol), 200 - urgency * 80);
  if (urgency > 0.7) {
    setTimeout(() => playTone(freq, 0.15, 'square', vol), 350 - urgency * 80);
  }
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
    const isNuke = missile.mtype?.isNuke;

    if (isPlayerTarget) {
      if (isNuke) nukeImpactSound();
      else if (missile.mtype?.empDuration) empSound();
      else impactSound();
      // Incoming alarm — urgency based on how many are inbound
      const inbound = gameState.missiles.filter(m => m.toCountryId === playerId).length;
      incomingAlarm(Math.min(1, inbound / 5));
    } else if (isPlayerAttack) {
      if (isNuke) nukeImpactSound();
      else playTone(300, 0.2, 'sine', 0.06);
    } else if (isAllyTarget) {
      playTone(80, 0.3, 'sine', 0.04);
    }
    // Nukes are globally audible even if not targeting player
    if (isNuke && !isPlayerTarget && !isPlayerAttack) {
      playTone(30, 1.0, 'sine', 0.08);
    }
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
