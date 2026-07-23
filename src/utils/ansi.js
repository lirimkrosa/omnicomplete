/**
 * ANSI escape code utilities for terminal rendering.
 * Provides colors, cursor control, box drawing, and text styling.
 */

// --- Reset ---
export const RESET = '\x1b[0m';

// --- Text Styles ---
export const BOLD = '\x1b[1m';
export const DIM = '\x1b[2m';
export const ITALIC = '\x1b[3m';
export const UNDERLINE = '\x1b[4m';
export const INVERSE = '\x1b[7m';
export const STRIKETHROUGH = '\x1b[9m';

// --- Foreground Colors ---
export const FG = {
  black: '\x1b[30m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  gray: '\x1b[90m',
  brightRed: '\x1b[91m',
  brightGreen: '\x1b[92m',
  brightYellow: '\x1b[93m',
  brightBlue: '\x1b[94m',
  brightMagenta: '\x1b[95m',
  brightCyan: '\x1b[96m',
  brightWhite: '\x1b[97m',
};

// --- Background Colors ---
export const BG = {
  black: '\x1b[40m',
  red: '\x1b[41m',
  green: '\x1b[42m',
  yellow: '\x1b[43m',
  blue: '\x1b[44m',
  magenta: '\x1b[45m',
  cyan: '\x1b[46m',
  white: '\x1b[47m',
  gray: '\x1b[100m',
  brightBlue: '\x1b[104m',
  brightCyan: '\x1b[106m',
};

// --- 256-Color Support ---
export function fg256(n) {
  return `\x1b[38;5;${n}m`;
}

export function bg256(n) {
  return `\x1b[48;5;${n}m`;
}

// --- RGB Support ---
export function fgRgb(r, g, b) {
  return `\x1b[38;2;${r};${g};${b}m`;
}

export function bgRgb(r, g, b) {
  return `\x1b[48;2;${r};${g};${b}m`;
}

// --- Cursor Control ---
export const cursor = {
  hide: '\x1b[?25l',
  show: '\x1b[?25h',
  save: '\x1b7',
  restore: '\x1b8',
  up: (n = 1) => `\x1b[${n}A`,
  down: (n = 1) => `\x1b[${n}B`,
  forward: (n = 1) => `\x1b[${n}C`,
  backward: (n = 1) => `\x1b[${n}D`,
  moveTo: (row, col) => `\x1b[${row};${col}H`,
  moveToColumn: (col) => `\x1b[${col}G`,
  nextLine: (n = 1) => `\x1b[${n}E`,
  prevLine: (n = 1) => `\x1b[${n}F`,
};

// --- Screen Control ---
export const screen = {
  clear: '\x1b[2J',
  clearLine: '\x1b[2K',
  clearToEnd: '\x1b[0K',
  clearToStart: '\x1b[1K',
  clearDown: '\x1b[0J',
  clearUp: '\x1b[1J',
  scrollUp: (n = 1) => `\x1b[${n}S`,
  scrollDown: (n = 1) => `\x1b[${n}T`,
  altBuffer: '\x1b[?1049h',
  mainBuffer: '\x1b[?1049l',
};

// --- Box Drawing Characters ---
export const box = {
  topLeft: '╭',
  topRight: '╮',
  bottomLeft: '╰',
  bottomRight: '╯',
  horizontal: '─',
  vertical: '│',
  teeRight: '├',
  teeLeft: '┤',
  teeDown: '┬',
  teeUp: '┴',
  cross: '┼',
  // Heavy variants
  heavyHorizontal: '━',
  heavyVertical: '┃',
  // Double variants
  doubleHorizontal: '═',
  doubleVertical: '║',
  doubleTopLeft: '╔',
  doubleTopRight: '╗',
  doubleBottomLeft: '╚',
  doubleBottomRight: '╝',
};

// --- Symbols ---
export const symbols = {
  check: '✓',
  cross: '✗',
  bullet: '●',
  circle: '○',
  diamond: '◆',
  arrow: '→',
  arrowLeft: '←',
  arrowUp: '↑',
  arrowDown: '↓',
  triangleRight: '▶',
  triangleDown: '▼',
  star: '★',
  gear: '⚙',
  lightning: '⚡',
  info: 'ℹ',
  warning: '⚠',
  ellipsis: '…',
  dot: '·',
  pipe: '│',
};

// --- Helpers ---

/**
 * Apply multiple styles to a string.
 * @param {string} text
 * @param  {...string} styles - ANSI codes to apply
 * @returns {string}
 */
export function style(text, ...styles) {
  return styles.join('') + text + RESET;
}

/**
 * Strip all ANSI escape codes from a string.
 * @param {string} text
 * @returns {string}
 */
export function stripAnsi(text) {
  return text.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '');
}

/**
 * Get the visible length of a string (excluding ANSI codes).
 * @param {string} text
 * @returns {number}
 */
export function visibleLength(text) {
  return stripAnsi(text).length;
}

/**
 * Pad a string to a visible width, accounting for ANSI codes.
 * @param {string} text
 * @param {number} width
 * @param {string} char - padding character
 * @returns {string}
 */
export function padEnd(text, width, char = ' ') {
  const visible = visibleLength(text);
  if (visible >= width) return text;
  return text + char.repeat(width - visible);
}

/**
 * Pad a string to a visible width on the left.
 */
export function padStart(text, width, char = ' ') {
  const visible = visibleLength(text);
  if (visible >= width) return text;
  return char.repeat(width - visible) + text;
}

/**
 * Truncate a string to a visible width, adding ellipsis if needed.
 */
export function truncate(text, maxWidth) {
  const stripped = stripAnsi(text);
  if (stripped.length <= maxWidth) return text;
  // Simple truncation on stripped text
  return stripped.slice(0, maxWidth - 1) + symbols.ellipsis;
}

/**
 * Draw a horizontal line.
 */
export function horizontalLine(width, char = box.horizontal) {
  return char.repeat(width);
}

/**
 * Draw a box around text lines.
 * @param {string[]} lines
 * @param {object} opts
 * @returns {string}
 */
export function drawBox(lines, opts = {}) {
  const {
    padding = 1,
    borderColor = FG.cyan,
    titleColor = FG.brightCyan,
    title = '',
  } = opts;

  const maxLen = Math.max(...lines.map(l => visibleLength(l)), visibleLength(title));
  const innerWidth = maxLen + padding * 2;
  const pad = ' '.repeat(padding);

  const out = [];

  // Top border
  let topLine = borderColor + box.topLeft + box.horizontal.repeat(innerWidth) + box.topRight + RESET;
  if (title) {
    const titleStr = ` ${titleColor}${title}${borderColor} `;
    topLine = borderColor + box.topLeft + box.horizontal +
      titleStr +
      box.horizontal.repeat(Math.max(0, innerWidth - visibleLength(titleStr) - 1)) +
      box.topRight + RESET;
  }
  out.push(topLine);

  // Content lines
  for (const line of lines) {
    const paddedLine = padEnd(line, maxLen);
    out.push(borderColor + box.vertical + RESET + pad + paddedLine + pad + borderColor + box.vertical + RESET);
  }

  // Bottom border
  out.push(borderColor + box.bottomLeft + box.horizontal.repeat(innerWidth) + box.bottomRight + RESET);

  return out.join('\n');
}
