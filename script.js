const gridEl = document.getElementById('grid');
const sensesEl = document.getElementById('senses');
const directionEl = document.getElementById('direction');
const gameStatusEl = document.getElementById('game-status');
const arrowStatusEl = document.getElementById('arrow-status');
const logEl = document.getElementById('log');
const sizeInput = document.getElementById('size');
const sizeValue = document.getElementById('size-value');
const toggleHintsBtn = document.getElementById('toggle-hints');
const revealBtn = document.getElementById('reveal');
const newWorldBtn = document.getElementById('new-world');
const quickRestartBtn = document.getElementById('quick-restart');

const dirs = ['north', 'east', 'south', 'west'];
const dirVectors = {
  north: { r: -1, c: 0 },
  east: { r: 0, c: 1 },
  south: { r: 1, c: 0 },
  west: { r: 0, c: -1 },
};

const state = {
  size: 5,
  agent: { r: 0, c: 0, dir: 'east' },
  goldCollected: false,
  wumpusDead: false,
  arrow: true,
  pits: [],
  wumpus: null,
  gold: null,
  visited: new Set(['0,0']),
  hints: true,
  reveal: false,
  log: [],
  over: false,
};

function randInt(max) {
  return Math.floor(Math.random() * max);
}

function coordKey({ r, c }) {
  return `${r},${c}`;
}

function addLog(message) {
  state.log.unshift({ message, ts: Date.now() });
  state.log = state.log.slice(0, 30);
  renderLog();
}

function renderLog() {
  logEl.innerHTML = state.log
    .map((item) => `<li>${item.message}</li>`)
    .join('');
}

function generateWorld(newSize = state.size) {
  state.size = newSize;
  state.agent = { r: newSize - 1, c: 0, dir: 'east' };
  state.goldCollected = false;
  state.wumpusDead = false;
  state.arrow = true;
  state.visited = new Set([coordKey(state.agent)]);
  state.over = false;
  state.hints = true;
  state.reveal = false;
  state.log = [];

  const occupied = new Set([coordKey(state.agent)]);

  function placeUnique() {
    let candidate;
    do {
      candidate = { r: randInt(newSize), c: randInt(newSize) };
    } while (occupied.has(coordKey(candidate)));
    occupied.add(coordKey(candidate));
    return candidate;
  }

  state.wumpus = placeUnique();
  state.gold = placeUnique();

  state.pits = [];
  const pitCount = Math.max(2, Math.floor(newSize / 2));
  for (let i = 0; i < pitCount; i += 1) {
    state.pits.push(placeUnique());
  }

  addLog(`New ${newSize}x${newSize} world generated.`);
  setStatus('Explore the grid. Avoid pits and the Wumpus!');
  render();
}

function setStatus(message) {
  gameStatusEl.textContent = message;
}

function getTileFeatures(r, c) {
  const adj = [
    { r: r - 1, c },
    { r: r + 1, c },
    { r, c: c - 1 },
    { r, c: c + 1 },
  ];

  const stench = adj.some((cell) => coordKey(cell) === coordKey(state.wumpus) && !state.wumpusDead);
  const breeze = adj.some((cell) => state.pits.some((p) => coordKey(p) === coordKey(cell)));
  const glitter = coordKey({ r, c }) === coordKey(state.gold) && !state.goldCollected;

  return { stench, breeze, glitter };
}

function render() {
  gridEl.style.gridTemplateColumns = `repeat(${state.size}, 1fr)`;
  gridEl.innerHTML = '';

  for (let r = 0; r < state.size; r += 1) {
    for (let c = 0; c < state.size; c += 1) {
      const cell = document.createElement('button');
      cell.className = 'cell';
      cell.type = 'button';
      cell.dataset.r = r;
      cell.dataset.c = c;

      const key = coordKey({ r, c });
      const visited = state.visited.has(key);
      const isAgent = state.agent.r === r && state.agent.c === c;
      const isGold = coordKey(state.gold) === key && (!state.goldCollected || state.reveal || state.over);
      const isWumpus = coordKey(state.wumpus) === key && (state.reveal || state.over || !state.wumpusDead);
      const isPit = state.pits.some((p) => coordKey(p) === key);

      if (visited) cell.classList.add('visited');

      if (state.hints && visited && !state.over) {
        const hints = getTileFeatures(r, c);
        if (hints.stench || hints.breeze || hints.glitter) {
          cell.classList.add('hint');
          cell.title = `Stench: ${hints.stench ? 'yes' : 'no'}, Breeze: ${hints.breeze ? 'yes' : 'no'}, Glitter: ${hints.glitter ? 'yes' : 'no'}`;
        }
      }

      if (isAgent) {
        cell.classList.add('agent');
        const avatar = document.createElement('div');
        avatar.className = 'avatar';
        avatar.dataset.dir = state.agent.dir;
        cell.appendChild(avatar);
      } else if ((state.over || state.reveal || visited) && isGold) {
        const icon = document.createElement('div');
        icon.className = 'icon gold';
        icon.textContent = 'G';
        cell.appendChild(icon);
      } else if ((state.over || state.reveal) && isWumpus) {
        const icon = document.createElement('div');
        icon.className = 'icon wumpus';
        icon.textContent = state.wumpusDead ? '✖' : 'W';
        cell.appendChild(icon);
      } else if ((state.over || state.reveal) && isPit) {
        const icon = document.createElement('div');
        icon.className = 'icon pit';
        icon.textContent = 'P';
        cell.appendChild(icon);
      }

      cell.addEventListener('click', () => {
        if (state.over) return;
        faceTowards(r, c);
      });

      gridEl.appendChild(cell);
    }
  }

  const { stench, breeze, glitter } = getTileFeatures(state.agent.r, state.agent.c);
  sensesEl.textContent = `Stench: ${stench ? 'yes' : 'no'}, Breeze: ${breeze ? 'yes' : 'no'}, Glitter: ${glitter ? 'yes' : 'no'}`;
  directionEl.textContent = state.agent.dir[0].toUpperCase() + state.agent.dir.slice(1);
  arrowStatusEl.textContent = state.arrow ? 'Loaded' : 'Spent';
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function faceTowards(targetR, targetC) {
  const dr = targetR - state.agent.r;
  const dc = targetC - state.agent.c;

  if (Math.abs(dr) > Math.abs(dc)) {
    state.agent.dir = dr < 0 ? 'north' : 'south';
  } else if (Math.abs(dc) > 0) {
    state.agent.dir = dc < 0 ? 'west' : 'east';
  }

  render();
}

function move(direction) {
  if (state.over) return;
  const dir = direction || state.agent.dir;
  state.agent.dir = dir;
  const vector = dirVectors[dir];
  const next = { r: state.agent.r + vector.r, c: state.agent.c + vector.c };

  if (next.r < 0 || next.r >= state.size || next.c < 0 || next.c >= state.size) {
    setStatus('Bump! You hit a wall.');
    addLog('You bumped into the wall.');
    return;
  }

  state.agent = next;
  state.visited.add(coordKey(next));
  resolveTile();
  render();
}

function resolveTile() {
  const posKey = coordKey(state.agent);

  if (coordKey(state.gold) === posKey && !state.goldCollected) {
    state.goldCollected = true;
    addLog('You grabbed the gold!');
    setStatus('Gold secured. Return to start or keep exploring.');
  }

  if (coordKey(state.wumpus) === posKey && !state.wumpusDead) {
    state.over = true;
    setStatus('The Wumpus got you.');
    addLog('The Wumpus attacked. You lost.');
    return;
  }

  if (state.pits.some((p) => coordKey(p) === posKey)) {
    state.over = true;
    setStatus('You fell into a pit.');
    addLog('Gravity wins. You lost.');
    return;
  }

  if (state.goldCollected && posKey === `0,0`) {
    state.over = true;
    setStatus('Victory! Gold delivered to base.');
    addLog('You won with the gold!');
  }
}

function rotate(direction) {
  if (state.over) return;
  const idx = dirs.indexOf(state.agent.dir);
  const nextIdx = direction === 'left' ? (idx + 3) % 4 : (idx + 1) % 4;
  state.agent.dir = dirs[nextIdx];
  render();
}

function shoot() {
  if (state.over || !state.arrow) return;
  state.arrow = false;
  const vector = dirVectors[state.agent.dir];
  let r = state.agent.r + vector.r;
  let c = state.agent.c + vector.c;

  while (r >= 0 && r < state.size && c >= 0 && c < state.size) {
    if (coordKey({ r, c }) === coordKey(state.wumpus) && !state.wumpusDead) {
      state.wumpusDead = true;
      addLog('You hear a scream. Wumpus defeated.');
      setStatus('Scream! You slayed the Wumpus.');
      break;
    }
    r += vector.r;
    c += vector.c;
  }

  if (!state.wumpusDead) {
    addLog('Arrow missed into the neon void.');
    setStatus('Silence... the Wumpus still lurks.');
  }

  render();
}

function pickup() {
  if (state.over) return;
  const sameCellAsGold = coordKey(state.agent) === coordKey(state.gold) && !state.goldCollected;
  if (sameCellAsGold) {
    state.goldCollected = true;
    addLog('Gold collected.');
    setStatus('Gold secured! Extract by reaching base.');
  } else {
    setStatus('Nothing to pick up here.');
  }
  render();
}

function resetCurrent() {
  const size = state.size;
  generateWorld(size);
}

function bindControls() {
  document.querySelectorAll('.pad-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const action = btn.dataset.action;
      if (action === 'move') {
        move(btn.dataset.direction);
      } else if (action === 'turn-left') {
        rotate('left');
      } else if (action === 'turn-right') {
        rotate('right');
      } else if (action === 'shoot') {
        shoot();
      } else if (action === 'pickup') {
        pickup();
      } else if (action === 'reset') {
        resetCurrent();
      }
    });
  });

  sizeInput.addEventListener('input', (e) => {
    const newSize = Number(e.target.value);
    sizeValue.textContent = `${newSize}x${newSize}`;
  });

  sizeInput.addEventListener('change', (e) => {
    const newSize = Number(e.target.value);
    generateWorld(newSize);
  });

  toggleHintsBtn.addEventListener('click', () => {
    state.hints = !state.hints;
    toggleHintsBtn.textContent = state.hints ? 'Toggle Hints' : 'Hints Off';
    render();
  });

  revealBtn.addEventListener('click', () => {
    state.reveal = !state.reveal;
    revealBtn.textContent = state.reveal ? 'Hide Board' : 'Reveal Board';
    render();
  });

  newWorldBtn.addEventListener('click', () => generateWorld(state.size));
  quickRestartBtn.addEventListener('click', () => resetCurrent());

  document.addEventListener('keydown', (e) => {
    if (state.over) return;
    const key = e.key.toLowerCase();
    if (key === 'arrowup' || key === 'w') move('north');
    if (key === 'arrowdown' || key === 's') move('south');
    if (key === 'arrowleft' || key === 'a') move('west');
    if (key === 'arrowright' || key === 'd') move('east');
    if (key === 'q') rotate('left');
    if (key === 'e') rotate('right');
    if (key === ' ') { e.preventDefault(); shoot(); }
    if (key === 'f') pickup();
  });
}

bindControls();
generateWorld();
