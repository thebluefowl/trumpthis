import { gameState } from '../state/GameState.js';
import { MISSILE_TYPES } from '../constants.js';
import { showToast } from './Toast.js';
import { renderPaths } from '../rendering/Globe.js';
import { revealAll } from '../state/Intel.js';
import { createMissile } from '../ai/AIManager.js';
import { enqueueMissile } from '../engine/ProductionSystem.js';
import { PRODUCTION } from '../constants.js';

let consoleEl = null;
let inputEl = null;
let logEl = null;
let visible = false;

const CHEATS = {
  'help': {
    desc: 'You need it',
    fn: () => logHelp(),
  },
  'motherlode': {
    desc: 'The Sims called, they want their cheat back',
    fn: (args) => {
      const p = gameState.getPlayer();
      if (!p) return log('404: Player not found. Existential crisis initiated.', 'error');
      const amount = parseInt(args[0]) || 200;
      p.tokens = amount;
      p.tokenCap = Math.max(p.tokenCap, amount);
      log(`Ka-ching! ${amount} tokens. Your military-industrial complex thanks you.`, 'success');
    },
  },
  'iamgod': {
    desc: 'Unlimited power (side effects may include hubris)',
    fn: () => {
      const p = gameState.getPlayer();
      if (!p) return;
      p.tokens = 999;
      p.tokenCap = 999;
      p.fissile = 999;
      p.rareEarth = 999;
      log('You now have the GDP of a small galaxy. Use wisely. (You won\'t.)', 'success');
    },
  },
  'armory': {
    desc: 'armory <type> [count] — add missiles directly to player stockpile',
    fn: (args) => {
      const p = gameState.getPlayer();
      if (!p) return;
      const type = args[0];
      const count = parseInt(args[1]) || 10;
      if (!type || !PRODUCTION[type]) {
        log(`Unknown type. Options: ${Object.keys(PRODUCTION).join(', ')}`, 'error');
        return;
      }
      p.stockpile[type] = (p.stockpile[type] || 0) + count;
      log(`Added ${count}× ${type} to stockpile. Auto-load will distribute to silos.`, 'success');
    },
  },
  'fullstock': {
    desc: 'Fill every player silo to max capacity with tactical missiles',
    fn: () => {
      const p = gameState.getPlayer();
      if (!p) return;
      let total = 0;
      for (const silo of p.launchSites) {
        silo.loadedMissiles = silo.loadedMissiles || {};
        const existing = Object.values(silo.loadedMissiles).reduce((s, n) => s + n, 0);
        const room = 4 - existing;
        if (room > 0) {
          silo.loadedMissiles.tactical = (silo.loadedMissiles.tactical || 0) + room;
          total += room;
        }
      }
      log(`Loaded ${total}× tactical across ${p.launchSites.length} silos.`, 'success');
    },
  },
  'armageddon': {
    desc: 'Fill every silo with nukes. Pray.',
    fn: () => {
      const p = gameState.getPlayer();
      if (!p) return;
      MISSILE_TYPES.nuke.unlockAt = 0;
      let total = 0;
      for (const silo of p.launchSites) {
        silo.loadedMissiles = silo.loadedMissiles || {};
        const existing = Object.values(silo.loadedMissiles).reduce((s, n) => s + n, 0);
        const room = 4 - existing;
        if (room > 0) {
          silo.loadedMissiles.nuke = (silo.loadedMissiles.nuke || 0) + room;
          total += room;
        }
      }
      log(`${total} nukes loaded. "I have become Death, destroyer of silos."`, 'error');
    },
  },
  'opensesame': {
    desc: 'Unlock the whole toy box',
    fn: () => {
      for (const [, mtype] of Object.entries(MISSILE_TYPES)) {
        mtype.unlockAt = 0;
      }
      log('All weapons unlocked. The Geneva Convention just fainted.', 'success');
    },
  },
  'irondom': {
    desc: 'Nothing gets through. Nothing.',
    fn: () => {
      const p = gameState.getPlayer();
      if (!p) return;
      for (let i = 0; i < 5; i++) {
        gameState.interceptors.push({
          id: crypto.randomUUID(),
          countryId: p.id,
          position: [
            p.centroid[0] + (Math.random() - 0.5) * 6,
            p.centroid[1] + (Math.random() - 0.5) * 6,
          ],
          range: 0.12, cooldownUntil: 0, role: 'player',
        });
      }
      renderPaths();
      log('Iron Dome: Premium Edition™ installed. Warranty void if nuked.', 'success');
    },
  },
  'buildbuildbuil': {
    desc: '3 silos, no planning permission required',
    fn: () => {
      const p = gameState.getPlayer();
      if (!p) return;
      for (let i = 0; i < 3; i++) {
        p.launchSites.push({
          coords: [p.centroid[0] + (Math.random() - 0.5) * 6, p.centroid[1] + (Math.random() - 0.5) * 6],
          disabled: false, disabledUntil: 0, loadedMissiles: {},
        });
      }
      renderPaths();
      log('Built 3 silos. NIMBYs in shambles.', 'success');
    },
  },
  'oppenheimer': {
    desc: 'I am become death, the destroyer of worlds',
    fn: () => {
      const p = gameState.getPlayer();
      if (!p) return;
      p.tokens += 80;
      MISSILE_TYPES.nuke.unlockAt = 0;
      log('"Now I am become death, the destroyer of worlds." Also here\'s 80 tokens.', 'warn');
    },
  },
  'kumbaya': {
    desc: 'Give peace a chance (it won\'t last)',
    fn: () => {
      for (const [id] of gameState.countries) {
        if (id === gameState.playerCountryId) continue;
        gameState.setRelationship(gameState.playerCountryId, id, 100);
        gameState.formAlliance(gameState.playerCountryId, id);
      }
      log('World peace achieved! Nobel Prize incoming. (Betrayal cooldown: 30 seconds)', 'success');
    },
  },
  'leeroy': {
    desc: 'LEEEEROOOY JENKIIIIINS',
    fn: () => {
      for (const [id] of gameState.countries) {
        if (id === gameState.playerCountryId) continue;
        gameState.setRelationship(gameState.playerCountryId, id, -100);
        gameState.breakAlliance(gameState.playerCountryId, id);
      }
      log('LEEROOOOY JENKIIIIINS! Everyone hates you now. At least you have chicken.', 'warn');
    },
  },
  'thanos': {
    desc: 'Perfectly balanced, as all things should be',
    fn: (args) => {
      const name = args.join(' ').toLowerCase();
      if (name) {
        for (const [id, c] of gameState.countries) {
          if (c.name.toLowerCase() === name) {
            c.population = 0;
            c.cities.forEach(city => { city.population = 0; city.destroyed = true; });
            gameState.eliminateCountry(id);
            log(`*snap* ${c.name} doesn't feel so good...`, 'warn');
            return;
          }
        }
        log(`"${args.join(' ')}" not found. Infinity Stones can't fix your spelling.`, 'error');
      } else {
        // No args: snap half of all nations
        const active = gameState.getActiveCountries().filter(c => c.id !== gameState.playerCountryId);
        const half = active.slice(0, Math.floor(active.length / 2));
        for (const c of half) {
          c.population = 0;
          c.cities.forEach(city => { city.population = 0; city.destroyed = true; });
          gameState.eliminateCountry(c.id);
        }
        log(`*snap* ${half.length} nations dusted. Perfectly balanced.`, 'warn');
      }
    },
  },
  'itsover9000': {
    desc: 'WHAT?! 9000?!',
    fn: () => {
      const allies = new Set([gameState.playerCountryId, ...gameState.getAllies(gameState.playerCountryId)]);
      let count = 0;
      for (const [id, c] of gameState.countries) {
        if (allies.has(id)) continue;
        c.population = 0;
        c.cities.forEach(city => { city.population = 0; city.destroyed = true; });
        gameState.eliminateCountry(id);
        count++;
      }
      log(`Vegeta, what does the scouter say? ${count} nations DESTROYED!`, 'warn');
    },
  },
  'hackerman': {
    desc: 'I\'m in.',
    fn: () => {
      for (const [id] of gameState.countries) {
        if (id === gameState.playerCountryId) continue;
        revealAll(id);
      }
      log('*puts on sunglasses* I\'m in. All enemy intel revealed.', 'success');
    },
  },
  'wolverine': {
    desc: 'Healing factor activated',
    fn: () => {
      const p = gameState.getPlayer();
      if (!p) return;
      for (const city of p.cities) {
        city.population = city.startingPopulation;
        city.destroyed = false;
      }
      p.population = p.startingPopulation;
      renderPaths();
      log('Population regenerated. Your citizens have the healing factor of a fictional Canadian.', 'success');
    },
  },
  'speedrun': {
    desc: 'Any% glitchless (not really)',
    fn: (args) => {
      const mult = parseFloat(args[0]) || 3;
      window.__gameSpeedMultiplier = mult;
      log(`Game speed: ${mult}x. Speedrunning nuclear war. What a time to be alive.`, 'success');
    },
  },
  'timewarp': {
    desc: 'It\'s just a jump to the left',
    fn: (args) => {
      const secs = parseInt(args[0]) || 60;
      gameState.elapsed += secs;
      log(`Time warped ${secs}s. The space-time continuum filed a complaint.`, 'success');
    },
  },
  'factory': {
    desc: 'Inspect production state: queue, stockpile, fissile, rare earth',
    fn: () => {
      const p = gameState.getPlayer();
      if (!p) return;
      log(`Factories: ${p.factoryCount} │ Fissile: ${p.fissile.toFixed(1)} │ Rare Earth: ${p.rareEarth.toFixed(1)}`, 'info');
      const stock = Object.entries(p.stockpile).filter(([, n]) => n > 0).map(([t, n]) => `${t}:${n}`).join(' ') || '(empty)';
      log(`Stockpile: ${stock}`, 'info');
      if (p.productionQueue.length === 0) {
        log('Queue: (empty)', 'info');
      } else {
        p.productionQueue.forEach((it, i) => {
          const cfg = PRODUCTION[it.type];
          const eta = cfg ? Math.max(0, cfg.buildTime - it.progress).toFixed(1) : '?';
          const inSlot = i < p.factoryCount;
          const slot = inSlot ? '▶' : ' ';
          let tag = '';
          if (inSlot && !it.started) tag = ' (stalled — resources)';
          else if (!inSlot) tag = ' (waiting)';
          log(`${slot} [${i}] ${it.type} — ${eta}s${tag}`, 'info');
        });
      }
    },
  },
  'weaken': {
    desc: 'weaken <name> [percent] — drop target to N% of starting pop (default 20)',
    fn: (args) => {
      if (args.length === 0) return log('Usage: weaken <country name> [percent]', 'error');
      // Find trailing number (optional) — everything before is the country name
      let pctArg = parseFloat(args[args.length - 1]);
      let nameTokens = args;
      if (!Number.isNaN(pctArg)) nameTokens = args.slice(0, -1);
      else pctArg = 20;
      const name = nameTokens.join(' ').toLowerCase();
      if (!name) return log('Usage: weaken <country name> [percent]', 'error');

      let match = null;
      for (const [, c] of gameState.countries) {
        if (c.name.toLowerCase() === name) { match = c; break; }
      }
      if (!match) {
        for (const [, c] of gameState.countries) {
          if (c.name.toLowerCase().includes(name)) { match = c; break; }
        }
      }
      if (!match) return log(`Country "${nameTokens.join(' ')}" not found.`, 'error');

      const ratio = Math.max(0, Math.min(1, pctArg / 100));
      for (const city of match.cities) {
        city.population = Math.floor(city.startingPopulation * ratio);
        if (city.population <= 0) city.destroyed = true;
      }
      match.population = match.cities.reduce((s, c) => s + c.population, 0);
      log(`${match.name} weakened to ${pctArg}% (${(match.population / 1e6).toFixed(1)}M). ${ratio < 0.25 ? 'Invasion unlocked.' : ''}`, 'warn');
    },
  },
  'beginwar': {
    desc: 'Skip setup phase — start the war now',
    fn: () => {
      if (gameState.phase !== 'SETUP') return log('Not in setup phase.', 'warn');
      gameState.beginWar();
      log('Setup skipped. War begins.', 'warn');
    },
  },
  'silos': {
    desc: 'Show player silos and their loaded missiles',
    fn: () => {
      const p = gameState.getPlayer();
      if (!p) return;
      p.launchSites.forEach((s, i) => {
        const loads = Object.entries(s.loadedMissiles || {}).filter(([, n]) => n > 0).map(([t, n]) => `${t}:${n}`).join(' ') || '(empty)';
        const state = s.disabled ? `DISABLED until ${Math.ceil(s.disabledUntil - gameState.elapsed)}s` : 'active';
        log(`[${i}] (${s.coords[0].toFixed(1)},${s.coords[1].toFixed(1)}) ${state} — ${loads}`, 'info');
      });
    },
  },
  'queue': {
    desc: 'queue <type> [count] — add missiles to player production queue',
    fn: (args) => {
      const p = gameState.getPlayer();
      if (!p) return;
      const type = args[0];
      const count = parseInt(args[1]) || 1;
      if (!type || !PRODUCTION[type]) {
        log(`Unknown missile type. Options: ${Object.keys(PRODUCTION).join(', ')}`, 'error');
        return;
      }
      enqueueMissile(p.id, type, count);
      log(`Queued ${count}× ${type}`, 'success');
    },
  },
  'trumpmademedoit': {
    desc: 'MAD protocol. Every nation launches nukes. No one survives.',
    fn: () => {
      log('', 'error');
      log('█ MUTUALLY ASSURED DESTRUCTION PROTOCOL ACTIVATED █', 'error');
      log('', 'error');

      // Freeze all normal AI activity
      gameState._madActive = true;

      // Unlock nukes
      MISSILE_TYPES.nuke.unlockAt = 0;

      // Every nation launches a nuke at every other nation
      const nations = [...gameState.countries.values()].filter(c => !gameState.isEliminated(c.id));
      let delay = 0;

      for (const attacker of nations) {
        for (const target of nations) {
          if (attacker.id === target.id) continue;

          // Stagger launches for dramatic effect
          setTimeout(() => {
            if (gameState.isEliminated(attacker.id)) return;

            // Pick attacker's best launch site
            const site = attacker.launchSites[0];
            if (!site) return;

            // Pick target's largest city
            const targetCity = target.cities
              .filter(c => !c.destroyed)
              .sort((a, b) => b.population - a.population)[0];
            const targetCoords = targetCity ? targetCity.coords : target.centroid;

            // Bypass all costs — free nuke
            createMissile(attacker.id, target.id, site.coords, targetCoords, 'nuke', attacker.id === gameState.playerCountryId);

            gameState.addNotification(`${attacker.name} launched NUCLEAR STRIKE at ${target.name}`, 'escalation');
          }, delay);

          delay += 200 + Math.random() * 300; // stagger 200-500ms apart
        }
      }

      log(`${nations.length} nations launching ${nations.length * (nations.length - 1)} nuclear missiles`, 'error');
      log('May God have mercy on us all.', 'error');
    },
  },
};

function log(text, type = 'info') {
  if (!logEl) return;
  const line = document.createElement('div');
  line.className = `cheat-log-line ${type}`;
  line.textContent = text;
  logEl.appendChild(line);
  logEl.scrollTop = logEl.scrollHeight;
  showToast(text, type);
}

function logHelp() {
  for (const [name, cheat] of Object.entries(CHEATS)) {
    log(`${name} — ${cheat.desc}`, 'info');
  }
}

function executeCommand(input) {
  const parts = input.trim().split(/\s+/);
  const cmd = parts[0].toLowerCase();
  const args = parts.slice(1);

  const cheat = CHEATS[cmd];
  if (cheat) {
    cheat.fn(args);
  } else {
    log(`Unknown command: ${cmd}. Type "help" for list.`, 'error');
  }
}

export function initCheats() {
  // Create console DOM
  consoleEl = document.createElement('div');
  consoleEl.className = 'cheat-console hidden';
  consoleEl.innerHTML = `
    <div class="cheat-header">CONSOLE <span class="cheat-close">×</span></div>
    <div class="cheat-log" id="cheat-log"></div>
    <input class="cheat-input" id="cheat-input" type="text" placeholder="Type a command..." autocomplete="off" spellcheck="false">
  `;
  document.getElementById('app').appendChild(consoleEl);

  logEl = document.getElementById('cheat-log');
  inputEl = document.getElementById('cheat-input');

  consoleEl.querySelector('.cheat-close').addEventListener('click', toggleConsole);

  inputEl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && inputEl.value.trim()) {
      log(`> ${inputEl.value}`, 'info');
      executeCommand(inputEl.value);
      inputEl.value = '';
    }
    if (e.key === 'Escape') toggleConsole();
    e.stopPropagation(); // don't trigger game shortcuts
  });

  // Backtick opens console
  document.addEventListener('keydown', (e) => {
    if (e.key === '`' || e.key === '~') {
      e.preventDefault();
      toggleConsole();
    }
  });
}

function toggleConsole() {
  visible = !visible;
  consoleEl.classList.toggle('hidden', !visible);
  if (visible) {
    inputEl.focus();
    if (logEl.children.length === 0) {
      log('STRATCOM Console. Type "help" for commands.', 'info');
    }
  }
}
