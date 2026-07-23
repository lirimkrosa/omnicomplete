/**
 * Terminal utilities — size detection, cursor position, raw mode.
 */

import { RESET, FG, BOLD } from './ansi.js';

/**
 * Get current terminal dimensions.
 * @returns {{ columns: number, rows: number }}
 */
export function getTerminalSize() {
  return {
    columns: process.stdout.columns || 80,
    rows: process.stdout.rows || 24,
  };
}

/**
 * Check if stdout is a TTY.
 * @returns {boolean}
 */
export function isTTY() {
  return process.stdout.isTTY === true;
}

/**
 * Check if terminal supports 256 colors.
 * @returns {boolean}
 */
export function supports256Colors() {
  const term = process.env.TERM || '';
  const colorterm = process.env.COLORTERM || '';
  return term.includes('256color') || colorterm === 'truecolor' || colorterm === '24bit';
}

/**
 * Check if terminal supports true color (24-bit).
 * @returns {boolean}
 */
export function supportsTrueColor() {
  const colorterm = process.env.COLORTERM || '';
  return colorterm === 'truecolor' || colorterm === '24bit';
}

/**
 * Enter raw mode on stdin — captures individual keystrokes.
 * Returns a cleanup function to restore normal mode.
 * @returns {Function} cleanup
 */
export function enterRawMode() {
  if (process.stdin.isTTY) {
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.setEncoding('utf8');
  }
  return () => {
    if (process.stdin.isTTY) {
      process.stdin.setRawMode(false);
      process.stdin.pause();
    }
  };
}

/**
 * Read a single keypress from stdin.
 * @returns {Promise<{ name: string, sequence: string, ctrl: boolean, meta: boolean, shift: boolean }>}
 */
export function readKey() {
  return new Promise((resolve) => {
    const handler = (data) => {
      process.stdin.removeListener('data', handler);
      const key = parseKeySequence(data);
      resolve(key);
    };
    process.stdin.on('data', handler);
  });
}

/**
 * Parse a raw key sequence into a structured key event.
 * @param {string} data
 * @returns {{ name: string, sequence: string, ctrl: boolean, meta: boolean, shift: boolean }}
 */
export function parseKeySequence(data) {
  const key = {
    name: '',
    sequence: data,
    ctrl: false,
    meta: false,
    shift: false,
  };

  // Control characters
  if (data.length === 1) {
    const code = data.charCodeAt(0);

    if (code === 3) { key.name = 'c'; key.ctrl = true; }
    else if (code === 4) { key.name = 'd'; key.ctrl = true; }
    else if (code === 9) { key.name = 'tab'; }
    else if (code === 13) { key.name = 'return'; }
    else if (code === 27) { key.name = 'escape'; }
    else if (code === 127) { key.name = 'backspace'; }
    else if (code === 32) { key.name = 'space'; }
    else if (code >= 1 && code <= 26) {
      key.name = String.fromCharCode(code + 96);
      key.ctrl = true;
    }
    else {
      key.name = data;
    }
  }
  // Escape sequences
  else if (data.startsWith('\x1b')) {
    if (data === '\x1b[A') key.name = 'up';
    else if (data === '\x1b[B') key.name = 'down';
    else if (data === '\x1b[C') key.name = 'right';
    else if (data === '\x1b[D') key.name = 'left';
    else if (data === '\x1b[H') key.name = 'home';
    else if (data === '\x1b[F') key.name = 'end';
    else if (data === '\x1b[3~') key.name = 'delete';
    else if (data === '\x1b[5~') key.name = 'pageup';
    else if (data === '\x1b[6~') key.name = 'pagedown';
    else if (data === '\x1b[Z') { key.name = 'tab'; key.shift = true; }
    else if (data === '\x1b[1;5A') { key.name = 'up'; key.ctrl = true; }
    else if (data === '\x1b[1;5B') { key.name = 'down'; key.ctrl = true; }
    else if (data === '\x1b[1;5C') { key.name = 'right'; key.ctrl = true; }
    else if (data === '\x1b[1;5D') { key.name = 'left'; key.ctrl = true; }
    else if (data === '\x1b ') { key.name = 'space'; key.ctrl = true; } // Ctrl+Space variant
    else if (data === '\x1b[1;2A') { key.name = 'up'; key.shift = true; }
    else if (data === '\x1b[1;2B') { key.name = 'down'; key.shift = true; }
    else if (data.length === 2) {
      // Alt+key
      key.name = data[1];
      key.meta = true;
    }
    else {
      key.name = 'unknown';
    }
  }
  else {
    key.name = data;
  }

  return key;
}

/**
 * Write to stdout.
 * @param {string} text
 */
export function write(text) {
  process.stdout.write(text);
}

/**
 * Write a line to stdout.
 * @param {string} text
 */
export function writeLine(text = '') {
  process.stdout.write(text + '\n');
}

/**
 * Clear the current line and write new content.
 * @param {string} text
 */
export function replaceLine(text) {
  write('\r\x1b[2K' + text);
}

/**
 * Get the current shell name.
 * @returns {string}
 */
export function getShell() {
  const shell = process.env.SHELL || process.env.ComSpec || '';
  const base = shell.split('/').pop() || 'unknown';
  return base;
}

/**
 * Get the current terminal emulator name.
 * @returns {string}
 */
export function getTerminalEmulator() {
  return process.env.TERM_PROGRAM || process.env.TERMINAL || process.env.TERM || 'unknown';
}

/**
 * Print a styled header line.
 * @param {string} text
 */
export function printHeader(text) {
  writeLine(`\n${BOLD}${FG.brightCyan}${text}${RESET}`);
}

/**
 * Print a styled section separator.
 * @param {number} width
 */
export function printSeparator(width = 60) {
  writeLine(`${FG.gray}${'─'.repeat(width)}${RESET}`);
}
