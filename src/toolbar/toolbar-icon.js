/**
 * Toolbar Icon — hidden by default, reveals inline settings on activation.
 * Can be shown via Ctrl+Shift+S, the `settings` command, or `--show-toolbar`.
 */

import { RESET, BOLD, DIM, FG, BG, cursor, screen, box, fgRgb, bgRgb } from '../utils/ansi.js';
import { write, getTerminalSize } from '../utils/terminal.js';
import { loadConfig, saveConfig } from '../settings/config-store.js';

/**
 * Check if the toolbar should be visible.
 * @returns {boolean}
 */
export function isToolbarVisible() {
  const config = loadConfig();
  return config.showToolbar === true;
}

/**
 * Toggle toolbar visibility.
 * @returns {boolean} New visibility state
 */
export function toggleToolbar() {
  const config = loadConfig();
  config.showToolbar = !config.showToolbar;
  saveConfig(config);
  return config.showToolbar;
}

/**
 * Show the toolbar.
 */
export function showToolbar() {
  const config = loadConfig();
  config.showToolbar = true;
  saveConfig(config);
}

/**
 * Hide the toolbar.
 */
export function hideToolbar() {
  const config = loadConfig();
  config.showToolbar = false;
  saveConfig(config);
}

/**
 * Render the toolbar icon at the specified position.
 * @param {object} opts
 * @param {string} opts.position - 'right' or 'left'
 * @returns {string} The rendered toolbar string
 */
export function renderToolbarIcon(opts = {}) {
  if (!isToolbarVisible()) return '';

  const { position = 'right' } = opts;
  const { columns } = getTerminalSize();

  const icon = `${bgRgb(30, 30, 46)}${fgRgb(137, 180, 250)} ⚙ ${RESET}`;

  if (position === 'right') {
    return cursor.save +
      cursor.moveToColumn(columns - 4) +
      icon +
      cursor.restore;
  } else {
    return cursor.save +
      cursor.moveToColumn(1) +
      icon +
      cursor.restore;
  }
}

/**
 * Render an expanded toolbar with quick-access buttons.
 * @returns {string}
 */
export function renderExpandedToolbar() {
  if (!isToolbarVisible()) return '';

  const { columns } = getTerminalSize();
  const borderColor = FG.cyan;

  const items = [
    { icon: '⚙', label: 'Settings', key: 's' },
    { icon: '📊', label: 'Status', key: 'i' },
    { icon: '🩺', label: 'Doctor', key: 'd' },
    { icon: '👤', label: 'Whoami', key: 'w' },
  ];

  const lines = [];
  const width = 20;
  const x = columns - width - 2;

  lines.push(
    cursor.save +
    cursor.moveTo(2, x) +
    `${borderColor}${box.topLeft}${box.horizontal.repeat(width)}${box.topRight}${RESET}`
  );

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    lines.push(
      cursor.moveTo(3 + i, x) +
      `${borderColor}${box.vertical}${RESET}` +
      ` ${item.icon}  ${item.label}` +
      `${' '.repeat(width - item.label.length - 5)}` +
      `${DIM}[${item.key}]${RESET}` +
      `${borderColor}${box.vertical}${RESET}`
    );
  }

  lines.push(
    cursor.moveTo(3 + items.length, x) +
    `${borderColor}${box.bottomLeft}${box.horizontal.repeat(width)}${box.bottomRight}${RESET}` +
    cursor.restore
  );

  return lines.join('');
}

/**
 * Handle a toolbar action key.
 * @param {string} key
 * @returns {{ action: string } | null}
 */
export function handleToolbarAction(key) {
  switch (key) {
    case 's': return { action: 'settings' };
    case 'i': return { action: 'integrations-status' };
    case 'd': return { action: 'doctor' };
    case 'w': return { action: 'whoami' };
    default: return null;
  }
}
