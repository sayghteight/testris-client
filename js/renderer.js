// =============================================
// TETRISS - Renderer
// =============================================

/**
 * Render a board + active pieces + ghost pieces onto a canvas.
 * @param {CanvasRenderingContext2D} ctx
 * @param {number[][]} board  - 2D array from server
 * @param {Object} piecesMap  - { socketId: { shape, x, y, ghostY, color } }
 * @param {string} teamId
 */
function renderBoard(ctx, board, piecesMap, teamId) {
  const W = BOARD_WIDTH;
  const H = BOARD_HEIGHT;
  const cs = CELL_SIZE;

  // Background
  ctx.fillStyle = '#080810';
  ctx.fillRect(0, 0, W * cs, H * cs);

  // Grid lines (subtle)
  ctx.strokeStyle = '#13131a';
  ctx.lineWidth = 0.5;
  for (let r = 0; r < H; r++) {
    for (let c = 0; c < W; c++) {
      ctx.strokeRect(c * cs, r * cs, cs, cs);
    }
  }

  // Board cells
  if (board) {
    for (let r = 0; r < H; r++) {
      for (let c = 0; c < W; c++) {
        const val = board[r][c];
        if (val) {
          drawCell(ctx, c, r, COLORS[val], cs);
        }
      }
    }
  }

  // Ghost pieces (drawn first, below active)
  if (piecesMap) {
    for (const piece of Object.values(piecesMap)) {
      if (!piece || !piece.shape) continue;
      drawPieceAt(ctx, piece.shape, piece.x, piece.ghostY, COLORS[piece.color] + GHOST_ALPHA, cs);
    }
  }

  // Active pieces (drawn on top)
  if (piecesMap) {
    for (const piece of Object.values(piecesMap)) {
      if (!piece || !piece.shape) continue;
      drawPieceAt(ctx, piece.shape, piece.x, piece.y, COLORS[piece.color], cs);
    }
  }
}

/**
 * Draw a filled cell with highlight/shadow.
 */
function drawCell(ctx, c, r, color, cs) {
  if (!color || color === 'transparent') return;
  ctx.fillStyle = color;
  ctx.fillRect(c * cs + 1, r * cs + 1, cs - 2, cs - 2);

  // Light edge
  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  ctx.fillRect(c * cs + 1, r * cs + 1, cs - 2, 3);
  ctx.fillRect(c * cs + 1, r * cs + 1, 3, cs - 2);

  // Dark edge
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.fillRect(c * cs + 1, r * cs + cs - 4, cs - 2, 3);
  ctx.fillRect(c * cs + cs - 4, r * cs + 1, 3, cs - 2);
}

function drawPieceAt(ctx, shape, px, py, color, cs) {
  for (let r = 0; r < shape.length; r++) {
    for (let c = 0; c < shape[r].length; c++) {
      if (!shape[r][c]) continue;
      const br = py + r;
      const bc = px + c;
      if (br >= 0 && br < BOARD_HEIGHT && bc >= 0 && bc < BOARD_WIDTH) {
        drawCell(ctx, bc, br, color, cs);
      }
    }
  }
}

/**
 * Render a next-piece preview canvas
 */
function renderNextPiece(canvas, pieceType) {
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#1c1c26';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  if (!pieceType || !TETROMINOES[pieceType]) return;

  const def = TETROMINOES[pieceType];
  const shape = def.shape;
  const color = COLORS[def.color];
  const cs = 16;

  // Center in canvas
  const shapeW = shape[0].length * cs;
  const shapeH = shape.length * cs;
  const offsetX = Math.floor((canvas.width - shapeW) / 2);
  const offsetY = Math.floor((canvas.height - shapeH) / 2);

  for (let r = 0; r < shape.length; r++) {
    for (let c = 0; c < shape[r].length; c++) {
      if (!shape[r][c]) continue;
      // Use drawCell but offset
      const fc = Math.floor(offsetX / cs) + c;
      const fr = Math.floor(offsetY / cs) + r;
      ctx.fillStyle = color;
      ctx.fillRect(offsetX + c * cs + 1, offsetY + r * cs + 1, cs - 2, cs - 2);
      ctx.fillStyle = 'rgba(255,255,255,0.25)';
      ctx.fillRect(offsetX + c * cs + 1, offsetY + r * cs + 1, cs - 2, 3);
    }
  }
}

/**
 * Render game over overlay on a canvas
 */
function renderDeadOverlay(ctx) {
  ctx.fillStyle = 'rgba(0,0,0,0.65)';
  ctx.fillRect(0, 0, BOARD_WIDTH * CELL_SIZE, BOARD_HEIGHT * CELL_SIZE);
  ctx.fillStyle = '#ff4455';
  ctx.font = 'bold 20px Segoe UI';
  ctx.textAlign = 'center';
  ctx.fillText('GAME OVER', BOARD_WIDTH * CELL_SIZE / 2, BOARD_HEIGHT * CELL_SIZE / 2);
}
