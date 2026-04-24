import { gameState } from '../state/GameState.js';
import { MISSILE_TYPES, PRODUCTION, FISSILE_PER_URANIUM_NODE, RAREEARTH_PER_NODE } from '../constants.js';
import { enqueueMissile, cancelQueueItem } from '../engine/ProductionSystem.js';
import { getOwnedResources } from '../engine/ResourceSystem.js';

let builtForBlocId = null;

export function renderProductionTab(el) {
  const blocId = gameState.playerBlocId;
  const bloc = blocId ? gameState.blocs.get(blocId) : null;
  if (!bloc) { el.innerHTML = ''; builtForBlocId = null; return; }

  if (builtForBlocId !== blocId || !el.querySelector('.prod-root')) {
    el.innerHTML = buildStructure();
    builtForBlocId = blocId;
    wireEnqueueButtons(el, bloc);
  }

  updateValues(el, bloc);
}

function buildStructure() {
  const typeKeys = Object.keys(PRODUCTION);
  const buildRows = typeKeys.map(typeKey => {
    const mtype = MISSILE_TYPES[typeKey];
    const cfg = PRODUCTION[typeKey];
    const costPills = [];
    if (cfg.fissile) costPills.push(`<span class="prod-pill prod-fissile">${cfg.fissile}</span>`);
    if (cfg.rareEarth) costPills.push(`<span class="prod-pill prod-rare">${cfg.rareEarth}</span>`);
    return `
      <div class="prod-build-row" data-type="${typeKey}">
        <span class="prod-name">${mtype?.name || typeKey}</span>
        <span class="prod-stock" data-field="stock">0</span>
        <span class="prod-time">${cfg.buildTime}s</span>
        <span class="prod-cost">${costPills.join('')}</span>
        <button class="prod-plus" data-action="enqueue" data-type="${typeKey}">+</button>
      </div>
    `;
  }).join('');

  return `
    <div class="prod-root">
      <div class="prod-resources">
        <div class="prod-res"><span class="prod-res-label">INDUSTRY</span><span class="prod-res-val" data-field="tokens">0</span></div>
        <div class="prod-res"><span class="prod-res-label">FISSILE</span><span class="prod-res-val prod-c-fissile" data-field="fissile">0</span><span class="prod-res-rate" data-field="fissileRate"></span></div>
        <div class="prod-res"><span class="prod-res-label">RARE</span><span class="prod-res-val prod-c-rare" data-field="rare">0</span><span class="prod-res-rate" data-field="rareRate"></span></div>
        <div class="prod-res"><span class="prod-res-label">FACTORIES</span><span class="prod-res-val" data-field="factories">0</span></div>
      </div>
      <div class="prod-section-title">BUILD</div>
      <div class="prod-build">${buildRows}</div>
      <div class="prod-section-title">QUEUE <span class="prod-section-sub" data-field="queueInfo"></span></div>
      <div class="prod-queue" data-field="queueList"></div>
    </div>
  `;
}

function wireEnqueueButtons(el, bloc) {
  el.onclick = (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    e.stopPropagation();
    const action = btn.dataset.action;
    if (action === 'enqueue') {
      enqueueMissile(bloc.id, btn.dataset.type, 1);
      updateValues(el, bloc);
    } else if (action === 'cancel') {
      cancelQueueItem(bloc.id, parseInt(btn.dataset.idx));
      updateValues(el, bloc);
    }
  };
}

function setText(el, selector, text) {
  const node = el.querySelector(selector);
  if (node && node.textContent !== text) node.textContent = text;
}

function updateValues(el, bloc) {
  // Aggregate resource rates across all bloc-owned nodes
  let fissileRate = 0, rareRate = 0;
  for (const country of gameState.getBlocCountries(bloc.id)) {
    if (gameState.isEliminated(country.id)) continue;
    for (const node of getOwnedResources(country.id)) {
      if (node.type === 'uranium') fissileRate += FISSILE_PER_URANIUM_NODE;
      else if (node.type === 'rare_earth') rareRate += RAREEARTH_PER_NODE;
    }
  }

  // Total loaded across all bloc silos
  const loaded = {};
  for (const { site } of gameState.getBlocSilos(bloc.id)) {
    for (const t in (site.loadedMissiles || {})) {
      loaded[t] = (loaded[t] || 0) + site.loadedMissiles[t];
    }
  }

  setText(el, '[data-field="tokens"]', Math.floor(bloc.tokens).toString());
  setText(el, '[data-field="fissile"]', (bloc.fissile || 0).toFixed(1));
  setText(el, '[data-field="rare"]', (bloc.rareEarth || 0).toFixed(1));
  setText(el, '[data-field="fissileRate"]', fissileRate > 0 ? `+${fissileRate.toFixed(2)}/s` : '');
  setText(el, '[data-field="rareRate"]', rareRate > 0 ? `+${rareRate.toFixed(2)}/s` : '');
  setText(el, '[data-field="factories"]', (bloc.factoryCount || 0).toString());

  const queue = bloc.productionQueue || [];
  const factoryCount = bloc.factoryCount || 0;
  const p = bloc; // alias so existing references below keep working
  setText(el, '[data-field="queueInfo"]', `${queue.length} in line · ${factoryCount} building`);

  const queueList = el.querySelector('[data-field="queueList"]');
  if (queueList) {
    if (queue.length === 0) {
      if (queueList.dataset.empty !== '1') {
        queueList.innerHTML = `<div class="prod-queue-empty">idle</div>`;
        queueList.dataset.empty = '1';
      }
    } else {
      queueList.dataset.empty = '0';
      // Rebuild queue rows when count changes; otherwise update ETAs in place
      if (queueList.children.length !== queue.length) {
        queueList.innerHTML = queue.map((it, i) => {
          const mtype = MISSILE_TYPES[it.type];
          const inSlot = i < factoryCount;
          return `
            <div class="prod-queue-row ${inSlot ? 'active' : ''}" data-idx="${i}">
              <div class="prod-queue-fill" data-field="fill-${i}"></div>
              <span class="prod-queue-marker">${inSlot ? '▸' : '·'}</span>
              <span class="prod-queue-name">${mtype?.name || it.type}</span>
              <span class="prod-queue-eta" data-field="eta-${i}">—</span>
              <button class="prod-cancel" data-action="cancel" data-idx="${i}">×</button>
            </div>
          `;
        }).join('');
      }
      queue.forEach((it, i) => {
        const cfg = PRODUCTION[it.type];
        if (!cfg) return;
        const pct = Math.min(100, (it.progress / cfg.buildTime) * 100);
        const eta = Math.max(0, cfg.buildTime - it.progress).toFixed(1);
        setText(queueList, `[data-field="eta-${i}"]`, `${eta}s`);
        const fill = queueList.querySelector(`[data-field="fill-${i}"]`);
        if (fill) fill.style.width = `${pct}%`;
      });
    }
  }

  // Build rows — update stockpile count and affordability
  const elapsed = gameState.elapsed;
  el.querySelectorAll('.prod-build-row').forEach(row => {
    const typeKey = row.dataset.type;
    const mtype = MISSILE_TYPES[typeKey];
    const cfg = PRODUCTION[typeKey];
    if (!mtype || !cfg) return;
    const stockTotal = (p.stockpile[typeKey] || 0) + (loaded[typeKey] || 0);
    const isLocked = mtype.unlockAt !== undefined && elapsed < mtype.unlockAt
      && (loaded[typeKey] || 0) === 0 && (p.stockpile[typeKey] || 0) === 0;
    const affordable = !isLocked
      && (cfg.fissile || 0) <= (p.fissile || 0)
      && (cfg.rareEarth || 0) <= (p.rareEarth || 0);
    setText(row, '[data-field="stock"]', `×${stockTotal}`);
    row.classList.toggle('prod-locked', !!isLocked);
    const btn = row.querySelector('.prod-plus');
    if (btn) btn.disabled = !affordable;
  });
}

export function resetProductionTab() {
  builtForBlocId = null;
}
