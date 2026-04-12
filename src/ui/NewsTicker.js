import { gameState } from '../state/GameState.js';
import { events } from '../state/events.js';

const MAX_ITEMS = 30;
const tickerItems = [];
let tickerEl, scrollEl;
let lastFlavorTime = 0;

// Flavor news split by game phase — early game is tense but calm, late game is chaos
const EARLY_NEWS = [
  { text: 'Diplomatic tensions rise as military exercises observed near borders', type: 'info' },
  { text: 'UN Secretary General urges restraint amid growing crisis', type: 'info' },
  { text: 'Global stock markets slide on geopolitical uncertainty', type: 'info' },
  { text: 'Intelligence agencies report increased signals traffic worldwide', type: 'info' },
  { text: 'Naval fleets repositioning in key strategic waterways', type: 'info' },
  { text: 'Embassies in conflict zones advise citizens to evacuate', type: 'info' },
  { text: 'Satellite imagery confirms new military installations under construction', type: 'info' },
  { text: 'Emergency cabinet meetings convened in multiple capitals', type: 'info' },
  { text: 'Cybersecurity agencies detect probing attacks on infrastructure', type: 'info' },
  { text: 'Gold and oil prices surge on conflict fears', type: 'info' },
];

const MID_NEWS = [
  { text: 'Civilian evacuation orders issued in border regions', type: 'info' },
  { text: 'Nuclear submarine detected in international waters', type: 'attack' },
  { text: 'Emergency broadcast system activated across multiple nations', type: 'info' },
  { text: 'Mass protests erupt in capital cities worldwide', type: 'info' },
  { text: 'Military analysts warn of imminent second strike capability', type: 'attack' },
  { text: 'Global food supply chains beginning to falter', type: 'info' },
  { text: 'Underground bunker networks reaching capacity', type: 'info' },
  { text: 'Spy satellite feeds going dark over contested territories', type: 'attack' },
  { text: 'International Red Cross issues unprecedented global appeal', type: 'info' },
  { text: 'Deep-sea monitoring stations detect seismic anomalies', type: 'info' },
];

const LATE_NEWS = [
  { text: 'DEFCON 1 declared — maximum military readiness', type: 'escalation' },
  { text: 'Radiation levels rising in conflict zones', type: 'elimination' },
  { text: 'Communications blackout reported across entire continents', type: 'info' },
  { text: 'Hospital systems completely overwhelmed — triage only', type: 'info' },
  { text: 'Internet infrastructure experiencing catastrophic failures', type: 'info' },
  { text: 'Martial law declared in 14 nations simultaneously', type: 'info' },
  { text: 'Global food reserves estimated at 72 hours', type: 'info' },
  { text: 'Atmospheric sensors detecting abnormal particulate levels', type: 'elimination' },
  { text: 'Last diplomatic channel between major powers has gone silent', type: 'escalation' },
  { text: 'Scientists warn of nuclear winter onset within weeks', type: 'escalation' },
];

export function initNewsTicker() {
  tickerEl = document.getElementById('news-ticker');
  scrollEl = document.getElementById('ticker-scroll');

  // === Ticker only shows major events — combat log handles the rest ===

  // Nuclear strikes — always newsworthy
  events.on('missile:impact', (missile) => {
    if (!missile.mtype?.isNuke) return; // only nukes make the ticker
    const from = gameState.countries.get(missile.fromCountryId)?.name || '???';
    const to = gameState.countries.get(missile.toCountryId)?.name || '???';
    const msgs = [
      `NUCLEAR DETONATION: ${from} deploys nuclear weapon against ${to}`,
      `FLASH: Nuclear mushroom cloud confirmed over ${to} — ${from} has crossed the threshold`,
    ];
    addItem(msgs[Math.floor(Math.random() * msgs.length)], 'escalation');
  });

  // Alliances
  events.on('alliance:formed', ({ a, b }) => {
    const nameA = gameState.countries.get(a)?.name || '???';
    const nameB = gameState.countries.get(b)?.name || '???';
    addItem(`${nameA} and ${nameB} sign mutual defense pact`, 'alliance');
  });

  events.on('alliance:broken', ({ a, b }) => {
    const nameA = gameState.countries.get(a)?.name || '???';
    const nameB = gameState.countries.get(b)?.name || '???';
    addItem(`${nameA} breaks alliance with ${nameB}`, 'betrayal');
  });

  // Eliminations
  events.on('country:destroyed', (country) => {
    addItem(`BREAKING: ${country.name} ceases to exist as a functioning state`, 'elimination');
  });

  events.on('territory:claimed', ({ claimerId, eliminatedId }) => {
    const claimer = gameState.countries.get(claimerId)?.name || '???';
    const eliminated = gameState.countries.get(eliminatedId)?.name || '???';
    addItem(`${claimer} forces occupy ${eliminated} territory`, 'elimination');
  });

  // === Escalation ===
  events.on('escalation:start', () => {
    addItem('GLOBAL ALERT: Escalation phase initiated — Doomsday Clock advancing', 'escalation');
  });

}

export function updateNewsTicker() {
  if (gameState.phase !== 'PLAYING') return;

  // Fire flavor news every 20-40 seconds, appropriate to game phase
  const now = gameState.elapsed;
  if (now - lastFlavorTime > 20 + Math.random() * 20) {
    lastFlavorTime = now;

    let pool;
    if (now < 120) pool = EARLY_NEWS;           // first 2 minutes — tense but calm
    else if (now < 400) pool = MID_NEWS;         // 2-7 minutes — conflict heating up
    else pool = LATE_NEWS;                        // 7+ minutes — chaos

    const flavor = pool[Math.floor(Math.random() * pool.length)];
    addItem(flavor.text, flavor.type);
  }
}

function addItem(text, type = 'info') {
  tickerItems.push({ text, type, time: Date.now() });
  if (tickerItems.length > MAX_ITEMS) tickerItems.shift();
  renderTicker();
}

let innerEl = null;
let renderedCount = 0;

function renderTicker() {
  if (!scrollEl) return;

  // Create inner wrapper once
  if (!innerEl) {
    innerEl = document.createElement('span');
    innerEl.className = 'ticker-scroll-inner';
    scrollEl.appendChild(innerEl);
  }

  // Only append new items — don't rewrite
  while (renderedCount < tickerItems.length) {
    const item = tickerItems[renderedCount];
    const span = document.createElement('span');
    span.className = `ticker-item ${item.type}`;
    span.textContent = `● ${item.text}`;
    innerEl.appendChild(span);
    renderedCount++;
  }
}

export function showNewsTicker() {
  if (tickerEl) tickerEl.style.display = 'flex';
}

export function hideNewsTicker() {
  if (tickerEl) tickerEl.style.display = 'none';
}

export function resetNewsTicker() {
  tickerItems.length = 0;
  lastFlavorTime = 0;
  renderedCount = 0;
  innerEl = null;
  if (scrollEl) scrollEl.innerHTML = '';
  hideNewsTicker();
}
