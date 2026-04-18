// =============================================
// TETRISS - Main Game Client
// =============================================

// ---- State ----
let socket = null;
let mySocketId = null;
let myTeam = null;
let mySlot = null;
let roomCode = null;
let isSpectator = false;
let isHost = false;
let gameState = null; // latest state from server
let renderLoopId = null;
let currentMode = '1v1'; // '1v1' | '2v2'

// ---- Input repeat timers ----
const INPUT_REPEAT_DELAY = 150; // ms before auto-repeat
const INPUT_REPEAT_RATE = 50;   // ms between repeats
const pressedKeys = new Set();
const keyTimers = {};

// ---- DOM refs ----
const screens = {
  lobby:    document.getElementById('screen-lobby'),
  waiting:  document.getElementById('screen-waiting'),
  game:     document.getElementById('screen-game'),
  gameover: document.getElementById('screen-gameover'),
};

const canvasA = document.getElementById('canvas-a');
const canvasB = document.getElementById('canvas-b');
const ctxA = canvasA.getContext('2d');
const ctxB = canvasB.getContext('2d');

// =============================================
// SCREEN MANAGEMENT
// =============================================
function showScreen(name) {
  Object.entries(screens).forEach(([key, el]) => {
    el.classList.toggle('active', key === name);
  });
}

// =============================================
// SOCKET INIT
// =============================================
function initSocket() {
  socket = io('http://testris-server-o4xiyr-541f00-188-245-113-32.traefik.me', {
    transports: ['websocket', 'polling'],
  });
  mySocketId = null;

  socket.on('connect', () => {
    mySocketId = socket.id;
    console.log('[Socket] Connected:', mySocketId);
  });

  socket.on('lobbyUpdate', ({ players, mode }) => {
    if (mode) currentMode = mode;
    updateWaitingRoom(players, mode || currentMode);
  });

  socket.on('gameStarted', ({ players, mode }) => {
    if (mode) currentMode = mode;
    updateWaitingRoom(players, currentMode);
    showScreen('game');
    startRenderLoop();
  });

  socket.on('gameState', (state) => {
    gameState = state;
  });

  socket.on('gameOver', ({ winner, scores, lines }) => {
    showGameOver(winner, scores, lines);
  });

  socket.on('disconnect', () => {
    console.log('[Socket] Disconnected');
  });
}

// =============================================
// LOBBY ACTIONS
// =============================================
document.getElementById('btn-create').addEventListener('click', () => {
  const name = getPlayerName();
  if (!name) return showLobbyError('Enter your name first!');

  socket.emit('createRoom', { name }, (res) => {
    if (res.error) return showLobbyError(res.error);
    roomCode = res.roomCode;
    myTeam = res.team;
    mySlot = res.slot;
    isHost = mySlot === 0;
    isSpectator = false;
    if (res.mode) currentMode = res.mode;

    document.getElementById('room-code-display').textContent = roomCode;
    document.getElementById('spectator-badge').classList.add('hidden');
    // Host sees mode selector, others don't
    document.getElementById('mode-selector').style.display = 'flex';
    updateModeButtons(currentMode);
    updateWaitingRoom(res.players, currentMode);
    showScreen('waiting');
  });
});

document.getElementById('btn-join').addEventListener('click', () => {
  const name = getPlayerName();
  if (!name) return showLobbyError('Enter your name first!');

  const code = document.getElementById('room-code-input').value.trim().toUpperCase();
  if (code.length < 4) return showLobbyError('Enter a valid room code.');

  socket.emit('joinRoom', { name, roomCode: code }, (res) => {
    if (res.error) return showLobbyError(res.error);
    roomCode = res.roomCode;
    if (res.mode) currentMode = res.mode;

    if (res.spectator) {
      isSpectator = true;
      myTeam = null;
      document.getElementById('spectator-badge').classList.remove('hidden');
      document.getElementById('btn-switch-team').classList.add('hidden');
      document.getElementById('mode-selector').style.display = 'none';
    } else {
      myTeam = res.team;
      mySlot = res.slot;
      isHost = mySlot === 0;
      isSpectator = false;
      document.getElementById('spectator-badge').classList.add('hidden');
      document.getElementById('mode-selector').style.display = isHost ? 'flex' : 'none';
    }

    document.getElementById('room-code-display').textContent = roomCode;
    updateModeButtons(currentMode);
    updateWaitingRoom(res.players || [], currentMode);
    showScreen('waiting');
  });
});

document.getElementById('btn-copy-code').addEventListener('click', () => {
  navigator.clipboard.writeText(roomCode).catch(() => {});
  document.getElementById('btn-copy-code').textContent = '✅ Copied!';
  setTimeout(() => document.getElementById('btn-copy-code').textContent = '📋 Copy Code', 1500);
});

// Mode buttons (host only)
document.querySelectorAll('.btn-mode').forEach((btn) => {
  btn.addEventListener('click', () => {
    if (!isHost) return;
    const mode = btn.dataset.mode;
    socket.emit('setMode', mode, (res) => {
      if (res?.error) return alert(res.error);
      currentMode = mode;
      updateModeButtons(mode);
    });
  });
});

document.getElementById('btn-switch-team').addEventListener('click', () => {
  if (isSpectator) return;
  socket.emit('switchTeam', (res) => {
    if (res?.error) return alert(res.error);
    myTeam = res.team;
    isHost = mySlot === 0;
  });
});

document.getElementById('btn-start').addEventListener('click', () => {
  socket.emit('startGame', (res) => {
    if (res?.error) alert(res.error);
  });
});

document.getElementById('btn-play-again').addEventListener('click', () => {
  showScreen('waiting');
  // Re-use existing room or go back to lobby
});

document.getElementById('btn-back-lobby').addEventListener('click', () => {
  location.reload();
});

// =============================================
// WAITING ROOM UI
// =============================================
function updateModeButtons(mode) {
  document.querySelectorAll('.btn-mode').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.mode === mode);
  });
  // Disable buttons for non-host
  document.querySelectorAll('.btn-mode').forEach((btn) => {
    btn.disabled = !isHost;
  });
}

function updateWaitingRoom(players, mode) {
  mode = mode || currentMode;
  const slotsA = document.getElementById('team-a-players');
  const slotsB = document.getElementById('team-b-players');
  slotsA.innerHTML = '';
  slotsB.innerHTML = '';

  const teamA = players.filter(p => p.team === 'A');
  const teamB = players.filter(p => p.team === 'B');
  const maxPerTeam = mode === '2v2' ? 2 : 1;

  function renderSlots(container, team, list) {
    for (let i = 0; i < maxPerTeam; i++) {
      const p = list[i];
      const div = document.createElement('div');
      div.className = 'player-slot' + (p ? ` filled team-${team.toLowerCase()}${!p.connected ? ' offline' : ''}` : '');
      div.textContent = p
        ? `${p.connected ? '🟢' : '🔴'} ${p.name}${p.socketId === mySocketId ? ' (you)' : ''}`
        : `— Slot ${i + 1}`;
      container.appendChild(div);
    }
  }

  renderSlots(slotsA, 'A', teamA);
  renderSlots(slotsB, 'B', teamB);

  // Start button: need at least 1 per team
  const startBtn = document.getElementById('btn-start');
  const hasMinPlayers = teamA.length >= 1 && teamB.length >= 1;
  startBtn.disabled = !isHost || !hasMinPlayers;

  const hint = mode === '2v2'
    ? `Modo Co-op 2v2 — ${players.length}/4 jugadores`
    : `Modo 1v1 — ${players.length}/2 jugadores`;
  document.getElementById('waiting-hint').textContent =
    !hasMinPlayers ? hint + ' (se necesitan ambos equipos)' :
    isHost ? hint + ' — ¡Listos para empezar!' :
    hint + ' — Esperando al anfitrión...';
}

// =============================================
// GAME OVER UI
// =============================================
function showGameOver(winner, scores, lines) {
  stopRenderLoop();

  const winnerEl = document.getElementById('winner-display');
  if (winner === 'draw') {
    winnerEl.textContent = "🤝 It's a Draw!";
    winnerEl.style.color = '#ffcc44';
  } else {
    const color = winner === 'A' ? '#4488ff' : '#ff4455';
    winnerEl.style.color = color;
    winnerEl.textContent = `🏆 Team ${winner} Wins!`;
  }

  const scoresEl = document.getElementById('final-scores');
  scoresEl.innerHTML = `
    <div class="score-col">
      <div class="team-name" style="color:#4488ff">Team A</div>
      <div class="score-num">${scores.A.toLocaleString()}</div>
      <div style="color:#7070a0">Lines: ${lines.A}</div>
    </div>
    <div class="score-col">
      <div class="team-name" style="color:#ff4455">Team B</div>
      <div class="score-num">${scores.B.toLocaleString()}</div>
      <div style="color:#7070a0">Lines: ${lines.B}</div>
    </div>
  `;

  showScreen('gameover');
}

// =============================================
// RENDER LOOP
// =============================================
function startRenderLoop() {
  if (renderLoopId) cancelAnimationFrame(renderLoopId);

  function loop() {
    if (gameState) {
      drawGameState(gameState);
    }
    renderLoopId = requestAnimationFrame(loop);
  }
  renderLoopId = requestAnimationFrame(loop);
}

function stopRenderLoop() {
  if (renderLoopId) {
    cancelAnimationFrame(renderLoopId);
    renderLoopId = null;
  }
}

function drawGameState(state) {
  const { A, B, players } = state;

  // Team A
  if (A) {
    renderBoard(ctxA, A.board, A.pieces, 'A');
    if (!A.alive) renderDeadOverlay(ctxA);
    updateStats('a', A);
    updateNextPreviews('a', A, players);
  }

  // Team B
  if (B) {
    renderBoard(ctxB, B.board, B.pieces, 'B');
    if (!B.alive) renderDeadOverlay(ctxB);
    updateStats('b', B);
    updateNextPreviews('b', B, players);
  }
}

function updateStats(team, state) {
  const el = document.getElementById(`team-${team}-stats`);
  el.innerHTML = `
    <span>Score <span class="stat-val">${state.score.toLocaleString()}</span></span>
    <span>Lines <span class="stat-val">${state.lines}</span></span>
    <span>Lv <span class="stat-val">${state.level}</span></span>
  `;
}

function updateNextPreviews(teamLetter, state, players) {
  const teamId = teamLetter.toUpperCase();
  const teamPlayers = players ? players.filter(p => p.team === teamId) : [];

  teamPlayers.forEach((p, i) => {
    const wrapId = `next-${teamLetter}-${i}`;
    const wrap = document.getElementById(wrapId);
    if (!wrap) return;

    const canvas = wrap.querySelector('.next-canvas');
    const nextType = state.nextPiece?.[p.socketId];
    renderNextPiece(canvas, nextType);

    // Update label
    const label = wrap.querySelector('.next-label');
    if (label) {
      const isMe = p.socketId === mySocketId;
      label.textContent = isMe ? `${p.name} (you)` : p.name;
    }

    wrap.style.display = 'flex';
  });

  // Hide unused slots
  for (let i = teamPlayers.length; i < 2; i++) {
    const wrap = document.getElementById(`next-${teamLetter}-${i}`);
    if (wrap) wrap.style.display = 'none';
  }
}

// =============================================
// INPUT HANDLING
// =============================================
// Cada jugador está en su propio dispositivo.
// Aceptamos WASD, flechas y Espacio — todos mapean a la pieza del jugador actual.
const KEY_MAP = {
  'ArrowLeft':  'left',
  'ArrowRight': 'right',
  'ArrowDown':  'down',
  'ArrowUp':    'rotate',
  'a': 'left',
  'd': 'right',
  's': 'down',
  'w': 'rotate',
  'A': 'left',
  'D': 'right',
  'S': 'down',
  'W': 'rotate',
  ' ': 'hardDrop',   // Espacio = hard drop
  'ArrowUp': 'rotate',
};

function onKeyDown(e) {
  if (e.repeat) return;
  const action = KEY_MAP[e.key];
  if (!action) return;

  // Evitar scroll de página
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) {
    e.preventDefault();
  }

  sendInput(action);

  // Auto-repeat para movimiento lateral y soft drop
  if (action !== 'rotate' && action !== 'hardDrop') {
    startKeyRepeat(e.key, action);
  }
}

function onKeyUp(e) {
  stopKeyRepeat(e.key);
}

function startKeyRepeat(key, action) {
  if (keyTimers[key]) return;
  keyTimers[key] = setTimeout(() => {
    keyTimers[key] = setInterval(() => {
      sendInput(action);
    }, INPUT_REPEAT_RATE);
  }, INPUT_REPEAT_DELAY);
}

function stopKeyRepeat(key) {
  if (keyTimers[key]) {
    clearTimeout(keyTimers[key]);
    clearInterval(keyTimers[key]);
    delete keyTimers[key];
  }
}

function sendInput(action) {
  if (!socket || !gameState) return;
  socket.emit('input', action);
}

document.addEventListener('keydown', onKeyDown);
document.addEventListener('keyup', onKeyUp);

// =============================================
// HELPERS
// =============================================
function getPlayerName() {
  return document.getElementById('player-name').value.trim().slice(0, 20);
}

function showLobbyError(msg) {
  const el = document.getElementById('lobby-error');
  el.textContent = msg;
  el.classList.remove('hidden');
  setTimeout(() => el.classList.add('hidden'), 3000);
}

// Enter key on room code input
document.getElementById('room-code-input').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') document.getElementById('btn-join').click();
});
document.getElementById('player-name').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') document.getElementById('btn-create').click();
});

// =============================================
// STARTUP
// =============================================
initSocket();
showScreen('lobby');
