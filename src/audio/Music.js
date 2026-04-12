// Procedural ambient music — all synthesized via Web Audio API
// No external files, no licensing. Dark ambient drone that evolves with game state.

let ctx = null;
let masterGain = null;
let musicGain = null;
let playing = false;
let nodes = [];
let phase = 'menu'; // menu | calm | tension | war | extinction

function getCtx() {
  if (!ctx) {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    masterGain = ctx.createGain();
    masterGain.gain.value = 0.15;
    masterGain.connect(ctx.destination);

    musicGain = ctx.createGain();
    musicGain.gain.value = 1;
    musicGain.connect(masterGain);
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

// === Drone layer — deep evolving pad ===
function createDrone(freq, detune = 0) {
  const c = getCtx();
  const osc = c.createOscillator();
  const gain = c.createGain();
  const filter = c.createBiquadFilter();

  osc.type = 'sawtooth';
  osc.frequency.value = freq;
  osc.detune.value = detune;

  filter.type = 'lowpass';
  filter.frequency.value = 200;
  filter.Q.value = 2;

  gain.gain.value = 0;

  osc.connect(filter);
  filter.connect(gain);
  gain.connect(musicGain);
  osc.start();

  return { osc, gain, filter };
}

// === Pad layer — slow chord swells ===
function createPad(freq) {
  const c = getCtx();
  const osc1 = c.createOscillator();
  const osc2 = c.createOscillator();
  const gain = c.createGain();
  const filter = c.createBiquadFilter();

  osc1.type = 'sine';
  osc1.frequency.value = freq;
  osc2.type = 'triangle';
  osc2.frequency.value = freq * 1.002; // slight detuning

  filter.type = 'lowpass';
  filter.frequency.value = 800;

  gain.gain.value = 0;

  osc1.connect(filter);
  osc2.connect(filter);
  filter.connect(gain);
  gain.connect(musicGain);

  osc1.start();
  osc2.start();

  return { osc1, osc2, gain, filter };
}

// === Sub bass pulse ===
function createSubPulse(freq) {
  const c = getCtx();
  const osc = c.createOscillator();
  const gain = c.createGain();

  osc.type = 'sine';
  osc.frequency.value = freq;
  gain.gain.value = 0;

  osc.connect(gain);
  gain.connect(musicGain);
  osc.start();

  return { osc, gain };
}

// Chord progressions per phase
const CHORDS = {
  menu: [
    [55, 82.5, 110, 165],      // Am (dark, open)
    [49, 73.5, 98, 147],       // G low
    [52, 78, 104, 156],        // Ab
    [55, 82.5, 110, 165],      // Am
  ],
  calm: [
    [55, 82.5, 110, 165],      // Am
    [58.27, 87.3, 116.5, 174.6], // Bb
    [52, 78, 104, 156],        // Ab
    [49, 73.5, 98, 147],       // G
  ],
  tension: [
    [55, 69.3, 82.5, 110],     // Am (tighter voicing)
    [58.27, 73.4, 87.3, 116.5], // Bb minor
    [61.7, 77.8, 92.5, 123.5], // B diminished
    [55, 69.3, 82.5, 110],     // Am
  ],
  war: [
    [55, 65.4, 82.5, 110],     // Am (dissonant)
    [51.9, 65.4, 77.8, 103.8], // Ab aug
    [58.27, 69.3, 87.3, 116.5], // Bb sus
    [49, 61.7, 73.5, 98],      // G minor
  ],
  extinction: [
    [36.7, 55, 73.4, 110],     // very low, wide, empty
    [34.6, 52, 69.3, 103.8],
  ],
};

let currentChordIdx = 0;
let chordTimer = null;
let drones = [];
let pads = [];
let sub = null;

function setChord(chord) {
  const c = getCtx();
  const now = c.currentTime;
  const fadeTime = 4; // slow crossfade

  // Update drones
  drones.forEach((d, i) => {
    if (chord[i] !== undefined) {
      d.osc.frequency.linearRampToValueAtTime(chord[i], now + fadeTime);
      d.gain.gain.linearRampToValueAtTime(0.06, now + fadeTime);
    }
  });

  // Update pads (octave up)
  pads.forEach((p, i) => {
    if (chord[i] !== undefined) {
      p.osc1.frequency.linearRampToValueAtTime(chord[i] * 2, now + fadeTime);
      p.osc2.frequency.linearRampToValueAtTime(chord[i] * 2 * 1.002, now + fadeTime);
      p.gain.gain.linearRampToValueAtTime(phase === 'extinction' ? 0.01 : 0.025, now + fadeTime);
    }
  });

  // Sub bass
  if (sub && chord[0]) {
    sub.osc.frequency.linearRampToValueAtTime(chord[0] / 2, now + fadeTime);
    sub.gain.gain.linearRampToValueAtTime(phase === 'war' ? 0.08 : 0.04, now + fadeTime);
  }
}

function advanceChord() {
  const chords = CHORDS[phase] || CHORDS.menu;
  currentChordIdx = (currentChordIdx + 1) % chords.length;
  setChord(chords[currentChordIdx]);
}

export function startMusic() {
  if (playing) return;
  const c = getCtx();
  playing = true;

  // Create 4 drone voices
  drones = [
    createDrone(55, 0),
    createDrone(82.5, 5),
    createDrone(110, -3),
    createDrone(165, 7),
  ];

  // Create 4 pad voices
  pads = [
    createPad(110),
    createPad(165),
    createPad(220),
    createPad(330),
  ];

  // Sub bass
  sub = createSubPulse(27.5);

  // Set initial chord
  setChord(CHORDS[phase][0]);

  // Advance chord every 8 seconds
  chordTimer = setInterval(advanceChord, 8000);

  // LFO on filter — slow movement
  const lfo = c.createOscillator();
  const lfoGain = c.createGain();
  lfo.type = 'sine';
  lfo.frequency.value = 0.08; // very slow
  lfoGain.gain.value = 100;
  lfo.connect(lfoGain);
  drones.forEach(d => lfoGain.connect(d.filter.frequency));
  lfo.start();

  nodes.push(lfo, lfoGain);
}

export function stopMusic() {
  if (!playing) return;
  playing = false;

  if (chordTimer) { clearInterval(chordTimer); chordTimer = null; }

  const c = getCtx();
  const now = c.currentTime;

  // Fade everything out
  drones.forEach(d => {
    d.gain.gain.linearRampToValueAtTime(0, now + 2);
    setTimeout(() => d.osc.stop(), 2500);
  });
  pads.forEach(p => {
    p.gain.gain.linearRampToValueAtTime(0, now + 2);
    setTimeout(() => { p.osc1.stop(); p.osc2.stop(); }, 2500);
  });
  if (sub) {
    sub.gain.gain.linearRampToValueAtTime(0, now + 2);
    setTimeout(() => sub.osc.stop(), 2500);
  }
  nodes.forEach(n => { try { n.stop?.(); } catch(e) {} });

  drones = [];
  pads = [];
  sub = null;
  nodes = [];
}

export function setMusicPhase(newPhase) {
  if (phase === newPhase) return;
  phase = newPhase;

  if (!playing) return;

  const c = getCtx();
  const now = c.currentTime;

  // Adjust volume and filter per phase
  switch (phase) {
    case 'menu':
      musicGain.gain.linearRampToValueAtTime(0.8, now + 2);
      drones.forEach(d => d.filter.frequency.linearRampToValueAtTime(200, now + 2));
      break;
    case 'calm':
      musicGain.gain.linearRampToValueAtTime(0.6, now + 2);
      drones.forEach(d => d.filter.frequency.linearRampToValueAtTime(250, now + 2));
      break;
    case 'tension':
      musicGain.gain.linearRampToValueAtTime(0.8, now + 2);
      drones.forEach(d => d.filter.frequency.linearRampToValueAtTime(400, now + 2));
      break;
    case 'war':
      musicGain.gain.linearRampToValueAtTime(1.0, now + 2);
      drones.forEach(d => d.filter.frequency.linearRampToValueAtTime(600, now + 2));
      break;
    case 'extinction':
      musicGain.gain.linearRampToValueAtTime(0.3, now + 4);
      drones.forEach(d => d.filter.frequency.linearRampToValueAtTime(100, now + 4));
      break;
  }

  // Reset chord progression for new phase
  currentChordIdx = 0;
  setChord((CHORDS[phase] || CHORDS.menu)[0]);
}

export function setMusicVolume(vol) {
  if (masterGain) masterGain.gain.value = Math.max(0, Math.min(1, vol));
}
