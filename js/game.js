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
  socket = io('http://testris-server-o4xiyr-541f00-188-245-113-32.traefik.me');
  mySocketId = null;

  socket.on('connect', () => {
    mySocketId = socket.id;
    console.log('[Socket] Connected:', mySocketId);
  });

  socket.on('lobbyUpdate', ({ players }) => {
    updateWaitingRoom(players);
  });

  socket.on('gameStarted', ({ players }) => {
    updateWaitingRoom(players);
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

    document.getElementById('room-code-display').textContent = roomCode;
    document.getElementById('spectator-badge').classList.add('hidden');
    updateWaitingRoom(res.players);
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

    if (res.spectator) {
      isSpectator = true;
      myTeam = null;
      document.getElementById('spectator-badge').classList.remove('hidden');
    } else {
      myTeam = res.team;
      mySlot = res.slot;
      isHost = mySlot === 0;
      isSpectator = false;
      document.getElementById('spectator-badge').classList.add('hidden');
    }

    document.getElementById('room-code-display').textContent = roomCode;
    updateWaitingRoom(res.players || []);
    showScreen('waiting');
  });
});

document.getElementById('btn-copy-code').addEventListener('click', () => {
  navigator.clipboard.writeText(roomCode).catch(() => {});
  document.getElementById('btn-copy-code').textContent = '✅ Copied!';
  setTimeout(() => document.getElementById('btn-copy-code').textContent = '📋 Copy Code', 1500);
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
function updateWaitingRoom(players) {
  const slotsA = document.getElementById('team-a-players');
  const slotsB = document.getElementById('team-b-players');
  slotsA.innerHTML = '';
  slotsB.innerHTML = '';

  const teamA = players.filter(p => p.team === 'A');
  const teamB = players.filter(p => p.team === 'B');

  function renderSlots(container, team, list) {
    for (let i = 0; i < 2; i++) {
      const p = list[i];
      const div = document.createElement('div');
      div.className = 'player-slot' + (p ? ` filled team-${team.toLowerCase()}${!p.connected ? ' offline' : ''}` : '');
      div.textContent = p ? `${p.connected ? '🟢' : '🔴'} ${p.name}${p.socketId === mySocketId ? ' (you)' : ''}` : `— Slot ${i+1}`;
      container.appendChild(div);
    }
  }

  renderSlots(slotsA, 'A', teamA);
  renderSlots(slotsB, 'B', teamB);

  // Start button only for host
  const startBtn = document.getElementById('btn-start');
  const canStart = players.length >= 2;
  startBtn.disabled = !isHost || !canStart;

  document.getElementById('waiting-hint').textContent =
    players.length < 2 ? 'Waiting for players... (min 2)' :
    isHost ? 'Ready to start!' : 'Waiting for host to start...';
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
// Map: key -> action, team (to know which slot controls which action)
// P1 controls: WASD + Q (hard drop)
// P2 controls: arrows + numpad 0
const P1_KEYS = {
  'a': 'left',
  'd': 'right',
  's': 'down',
  'w': 'rotate',
  'q': 'hardDrop',
};

const P2_KEYS = {
  'ArrowLeft':  'left',
  'ArrowRight': 'right',
  'ArrowDown':  'down',
  'ArrowUp':    'rotate',
  '0':          'hardDrop',
};

function getActionForKey(key) {
  // Determine which key map to use based on this player's slot
  if (mySlot === 0 || mySlot === 2) {
    return P1_KEYS[key] || null;
  } else {
    return P2_KEYS[key] || null;
  }
}

// For two players on same machine sharing a keyboard:
// Slot 0 (team A, player 1): WASD + Q
// Slot 1 (team A, player 2): Arrows + 0
// Slot 2 (team B, player 1): WASD + Q  (if only one player in team B)
// Slot 3 (team B, player 2): Arrows + 0

// Actually, for co-op on same machine, emit from current socket = current player
// The server routes input to the right piece by socket ID.
// Each socket plays as one player. On same machine, the two players share the machine.
// We send inputs based on which keys are pressed regardless of slot.

function onKeyDown(e) {
  if (e.repeat) return;
  const key = e.key;

  // Prevent page scroll
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(key)) {
    e.preventDefault();
  }

  // P1 keys (slot 0 or 2)
  if (P1_KEYS[key] && (mySlot === 0 || mySlot === 2)) {
    const action = P1_KEYS[key];
    sendInput(action);
    if (action !== 'rotate' && action !== 'hardDrop') {
      startKeyRepeat(key, action);
    }
  }

  // P2 keys (slot 1 or 3)
  if (P2_KEYS[key] && (mySlot === 1 || mySlot === 3)) {
    const action = P2_KEYS[key];
    sendInput(action);
    if (action !== 'rotate' && action !== 'hardDrop') {
      startKeyRepeat(key, action);
    }
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
