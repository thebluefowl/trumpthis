import { gameState } from '../state/GameState.js';
import { events } from '../state/events.js';

const STEPS = [
  {
    text: 'Press <kbd>A</kbd> or click <b>STRIKE</b> to enter attack mode.',
    trigger: 'launchsite:click',
    triggerAlt: 'attack:click',
    waitFor: () => document.body.classList.contains('targeting'),
  },
  {
    text: 'Now click any enemy nation on the map to fire a missile.',
    waitFor: () => gameState.stats.playerLaunched > 0,
  },
  {
    text: 'Press <kbd>D</kbd> or click <b>DEFEND</b> to deploy an interceptor battery on your territory.',
    waitFor: () => gameState.getBatteryCount(gameState.playerCountryId) > 0,
  },
  {
    text: 'Press <kbd>B</kbd> or click <b>SILO</b> to build additional launch sites.',
    delay: 3000,
  },
  {
    text: 'Use <kbd>1</kbd>-<kbd>9</kbd> to switch weapon types. Each has different cost, damage, and speed.',
    delay: 3000,
  },
  {
    text: 'Press <kbd>Tab</kbd> to open the Diplomacy panel. Propose or break alliances with other nations.',
    delay: 4000,
  },
  {
    text: 'Open the <b>Research</b> tab in the sidebar to unlock tech upgrades.',
    delay: 3000,
  },
  {
    text: 'Win by: eliminating all enemies, accumulating 500◆, or allying with 60% of survivors. Good luck, Commander.',
    delay: 5000,
  },
];

let containerEl = null;
let currentStep = 0;
let active = false;
let checkInterval = null;

export function initTutorial() {
  // Create tutorial overlay
  containerEl = document.createElement('div');
  containerEl.className = 'tutorial-overlay hidden';
  containerEl.innerHTML = `
    <div class="tutorial-box">
      <div class="tutorial-step" id="tutorial-step"></div>
      <div class="tutorial-controls">
        <span class="tutorial-progress" id="tutorial-progress"></span>
        <button class="tutorial-skip" id="tutorial-skip">SKIP TUTORIAL</button>
      </div>
    </div>
  `;
  document.getElementById('app').appendChild(containerEl);

  document.getElementById('tutorial-skip').addEventListener('click', endTutorial);
}

export function startTutorial() {
  // Only show on first game (check localStorage)
  if (localStorage.getItem('nullstrike_tutorial_done')) return;

  active = true;
  currentStep = 0;
  containerEl.classList.remove('hidden');
  showStep();

  // Check for step completion every 500ms
  checkInterval = setInterval(checkStepComplete, 500);
}

function showStep() {
  if (currentStep >= STEPS.length) {
    endTutorial();
    return;
  }

  const step = STEPS[currentStep];
  document.getElementById('tutorial-step').innerHTML = step.text;
  document.getElementById('tutorial-progress').textContent = `${currentStep + 1}/${STEPS.length}`;
}

function checkStepComplete() {
  if (!active || currentStep >= STEPS.length) return;

  const step = STEPS[currentStep];

  if (step.waitFor && step.waitFor()) {
    advanceStep();
  } else if (step.delay) {
    // Auto-advance after delay
    step._timer = (step._timer || 0) + 500;
    if (step._timer >= step.delay) {
      advanceStep();
    }
  }
}

function advanceStep() {
  currentStep++;
  if (currentStep >= STEPS.length) {
    endTutorial();
  } else {
    showStep();
  }
}

function endTutorial() {
  active = false;
  containerEl.classList.add('hidden');
  localStorage.setItem('nullstrike_tutorial_done', '1');
  if (checkInterval) {
    clearInterval(checkInterval);
    checkInterval = null;
  }
}

export function resetTutorial() {
  active = false;
  currentStep = 0;
  if (containerEl) containerEl.classList.add('hidden');
  if (checkInterval) {
    clearInterval(checkInterval);
    checkInterval = null;
  }
}
