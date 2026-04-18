// =============================================
// TETRISS - Client Constants
// =============================================

const BOARD_WIDTH = 10;
const BOARD_HEIGHT = 20;
const CELL_SIZE = 20; // pixels per cell

// Color palette (index matches server color values)
const COLORS = [
  'transparent',    // 0 = empty
  '#00cfcf',        // 1 = I  (cyan)
  '#f0f000',        // 2 = O  (yellow)
  '#a000f0',        // 3 = T  (purple)
  '#00f000',        // 4 = S  (green)
  '#f00000',        // 5 = Z  (red)
  '#0000f0',        // 6 = J  (blue)
  '#f0a000',        // 7 = L  (orange)
  '#444466',        // 8 = garbage (gray-blue)
];

// Ghost piece opacity suffix
const GHOST_ALPHA = '44';

// Tetromino shapes (used client-side for next-piece preview)
const TETROMINOES = {
  I: { shape: [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]], color: 1 },
  O: { shape: [[1,1],[1,1]],                              color: 2 },
  T: { shape: [[0,1,0],[1,1,1],[0,0,0]],                  color: 3 },
  S: { shape: [[0,1,1],[1,1,0],[0,0,0]],                  color: 4 },
  Z: { shape: [[1,1,0],[0,1,1],[0,0,0]],                  color: 5 },
  J: { shape: [[1,0,0],[1,1,1],[0,0,0]],                  color: 6 },
  L: { shape: [[0,0,1],[1,1,1],[0,0,0]],                  color: 7 },
};
