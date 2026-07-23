/**
 * Toolbar Renderer — ANSI rendering for the toolbar and its expanded state.
 */

import { RESET, BOLD, DIM, FG, BG, cursor, screen, box, fgRgb, bgRgb } from '../utils/ansi.js';
import { write, getTerminalSize } from '../utils/terminal.js';
import { isToolbarVisible } from './toolbar-icon.js';

/**
 * Render the compact toolbar indicator.
 * Only shown when toolbar is visible (hidden by default).
 * @returns {string}
 */
export function renderCompactToolbar() {
  if (!isToolbarVisible()) return '';

  const { columns } = getTerminalSize();

  // Compact icon at top-right
  const bg = bgRgb(30, 30, 46);
  const fg = fgRgb(137, 180, 250);
  const accent = fgRgb(203, 166, 247);

  return cursor.save +
    cursor.moveTo(1, columns - 6) +
    `${bg}${fg} ⚙ ${accent}▾${RESET}` +
    cursor.restore;
}

/**
 * Render a status bar at the bottom of the terminal.
 * @param {object} opts
 * @param {string} opts.mode - Current mode label
 * @param {number} opts.specsLoaded - Number of loaded specs
 * @param {boolean} opts.autocompleteEnabled - Whether autocomplete is active
 * @returns {string}
 */
export function renderStatusBar(opts = {}) {
  const { mode = 'Normal', specsLoaded = 0, autocompleteEnabled = true } = opts;
  const { columns, rows } = getTerminalSize();

  const bg = bgRgb(30, 30, 46);
  const fg = fgRgb(166, 173, 200);
  const accent = fgRgb(137, 180, 250);
  const green = fgRgb(166, 227, 161);
  const yellow = fgRgb(249, 226, 175);

  const acStatus = autocompleteEnabled ? `${green}●${RESET}${bg}${fg}` : `${yellow}○${RESET}${bg}${fg}`;

  const left = ` ${accent}clia${RESET}${bg}${fg} │ ${mode} │ ${acStatus} AC `;
  const right = ` ${specsLoaded} specs │ Ctrl+Shift+S settings `;

  const padding = Math.max(0, columns - left.length - right.length + 40); // Account for ANSI codes

  return cursor.save +
    cursor.moveTo(rows, 1) +
    `${bg}${fg}${left}${' '.repeat(Math.max(padding, 1))}${right}${RESET}` +
    cursor.restore;
}

/**
 * Render a notification toast.
 * @param {string} message
 * @param {'info' | 'success' | 'warning' | 'error'} type
 * @returns {string}
 */
export function renderToast(message, type = 'info') {
  const { columns } = getTerminalSize();

  const colors = {
    info: { bg: bgRgb(30, 30, 46), fg: fgRgb(137, 180, 250), icon: 'ℹ' },
    success: { bg: bgRgb(30, 46, 30), fg: fgRgb(166, 227, 161), icon: '✓' },
    warning: { bg: bgRgb(46, 42, 30), fg: fgRgb(249, 226, 175), icon: '⚠' },
    error: { bg: bgRgb(46, 30, 30), fg: fgRgb(243, 139, 168), icon: '✗' },
  };

  const c = colors[type] || colors.info;
  const width = Math.min(message.length + 6, columns - 4);
  const x = columns - width - 2;

  return cursor.save +
    cursor.moveTo(2, x) +
    `${c.bg}${c.fg} ${c.icon} ${message} ${RESET}` +
    cursor.restore;
}
