/**
 * Autocomplete Dropdown — renders a navigable dropdown menu with ANSI.
 * Supports arrow-key navigation, Tab/Enter selection, Escape dismissal.
 */

import { RESET, BOLD, DIM, FG, BG, box, cursor, screen, padEnd, visibleLength, truncate, style } from '../utils/ansi.js';
import { getTerminalSize, write } from '../utils/terminal.js';

/**
 * @typedef {import('../core/suggestion-engine.js').Suggestion} Suggestion
 */

const ICONS = {
  command: '⌘',
  subcommand: '▸',
  flag: '⚑',
  arg: '◇',
  'spec-command': '▸',
  'spec-option': '⚑',
  script: '⚡',
  history: '↺',
};

const TYPE_COLORS = {
  command: FG.brightCyan,
  subcommand: FG.brightGreen,
  flag: FG.brightYellow,
  arg: FG.brightMagenta,
  'spec-command': FG.brightGreen,
  'spec-option': FG.brightYellow,
  script: FG.brightBlue,
  history: FG.gray,
};

/**
 * Render the dropdown menu.
 * @param {Suggestion[]} suggestions - List of suggestions
 * @param {number} selectedIndex - Currently selected index
 * @param {object} opts
 * @param {number} opts.maxVisible - Max items visible at once (default 8)
 * @param {number} opts.offsetX - Horizontal offset from cursor
 * @returns {string} The rendered dropdown string
 */
export function renderDropdown(suggestions, selectedIndex = 0, opts = {}) {
  const { maxVisible = 8, offsetX = 0, theme = 'inline' } = opts;
  const { columns } = getTerminalSize();

  if (suggestions.length === 0) return '';

  const total = suggestions.length;
  const visible = Math.min(total, maxVisible);

  // Scroll window
  let scrollStart = 0;
  if (selectedIndex >= scrollStart + visible) {
    scrollStart = selectedIndex - visible + 1;
  }
  if (selectedIndex < scrollStart) {
    scrollStart = selectedIndex;
  }

  const visibleItems = suggestions.slice(scrollStart, scrollStart + visible);

  // Calculate column widths
  const nameWidth = Math.min(
    Math.max(...visibleItems.map(s => visibleLength(s.displayText || s.text)), 8),
    30
  );
  const descWidth = Math.max(
    Math.min(
      Math.max(...visibleItems.map(s => s.description.length), 10),
      columns - nameWidth - 12
    ),
    5
  );
  const totalWidth = nameWidth + descWidth + 8; // icon + padding + separator

  const lines = [];
  const borderColor = FG.cyan;
  const helpText = `${DIM} ↑↓ navigate · tab accept · esc close${RESET}`;
  const activeBg = '\x1b[48;5;238m'; // Subtle gray transparent-like active background
  
  if (theme === 'inline') {
    // Top border
    lines.push(
      `${borderColor}${box.topLeft}${box.horizontal.repeat(totalWidth)}${box.topRight}${RESET}`
    );

    // Scroll-up indicator
    if (scrollStart > 0) {
      const indicator = ` ${DIM}↑ ${scrollStart} more${RESET}`;
      lines.push(
        `${borderColor}${box.vertical}${RESET}${padEnd(indicator, totalWidth)}${borderColor}${box.vertical}${RESET}`
      );
    }

    // Items
    for (let i = 0; i < visibleItems.length; i++) {
      const s = visibleItems[i];
      const realIndex = scrollStart + i;
      const isSelected = realIndex === selectedIndex;

      const icon = s.icon || ICONS[s.type] || ' ';
      const typeColor = TYPE_COLORS[s.type] || FG.white;
      const display = (isSelected ? s.text : s.displayText) || s.text;

      const nameStr = `${typeColor}${icon} ${display}`;
      const descStr = `${DIM}${truncate(s.description || '', descWidth)}`;

      // We must calculate ANSI-stripped lengths to pad correctly
      const namePad = nameWidth - visibleLength(display) - 2; // -2 for icon + space
      const paddedName = nameStr + ' '.repeat(Math.max(0, namePad));

      const descPad = descWidth - visibleLength(s.description || '');
      const paddedDesc = descStr + ' '.repeat(Math.max(0, descPad));

      const rowText = ` ${paddedName}   ${paddedDesc} `;
      
      if (isSelected) {
        lines.push(`${borderColor}${box.vertical}${RESET}${activeBg}${rowText}${RESET}${borderColor}${box.vertical}${RESET}`);
      } else {
        lines.push(`${borderColor}${box.vertical}${RESET}${rowText}${borderColor}${box.vertical}${RESET}`);
      }
    }

    // Scroll-down indicator
    if (scrollStart + visible < total) {
      const remaining = total - (scrollStart + visible);
      const indicator = ` ${DIM}↓ ${remaining} more${RESET}`;
      lines.push(
        `${borderColor}${box.vertical}${RESET}${padEnd(indicator, totalWidth)}${borderColor}${box.vertical}${RESET}`
      );
    }

    // Bottom border
    lines.push(
      `${borderColor}${box.bottomLeft}${box.horizontal.repeat(totalWidth)}${box.bottomRight}${RESET}`
    );
  } else if (theme === 'popover') {
    // Solid block theme (macOS spotlight style)
    const popoverBg = opts.popoverBackground === 'solid' ? '\x1b[48;5;236m' : ''; // Dark gray or Transparent
    
    // Top padding / Scroll indicator
    if (scrollStart > 0) {
      const indicator = ` ${DIM}↑ ${scrollStart} more${RESET}`;
      lines.push(`${popoverBg}${padEnd(indicator, totalWidth + 2)}${RESET}`);
    } else {
      lines.push(`${popoverBg}${' '.repeat(totalWidth + 2)}${RESET}`);
    }

    // Items
    for (let i = 0; i < visibleItems.length; i++) {
      const s = visibleItems[i];
      const realIndex = scrollStart + i;
      const isSelected = realIndex === selectedIndex;

      const icon = s.icon || ICONS[s.type] || ' ';
      const typeColor = isSelected ? FG.white : (TYPE_COLORS[s.type] || FG.white);
      const display = (isSelected ? s.text : s.displayText) || s.text;

      const nameStr = `${typeColor}${icon} ${display}`;
      // In active row, make description text white instead of dim
      const descStr = isSelected 
        ? `${FG.white}${truncate(s.description || '', descWidth)}`
        : `${DIM}${truncate(s.description || '', descWidth)}`;

      const namePad = nameWidth - visibleLength(display) - 2;
      const paddedName = nameStr + ' '.repeat(Math.max(0, namePad));

      const descPad = descWidth - visibleLength(s.description || '');
      const paddedDesc = descStr + ' '.repeat(Math.max(0, descPad));

      const rawRowText = `  ${paddedName}   ${paddedDesc} `;
      const rowText = padEnd(rawRowText, totalWidth + 2);
      
      if (isSelected) {
        lines.push(`${activeBg}${rowText}${RESET}`);
      } else {
        lines.push(`${popoverBg}${rowText}${RESET}`);
      }
    }

    // Bottom padding / Scroll indicator
    if (scrollStart + visible < total) {
      const remaining = total - (scrollStart + visible);
      const indicator = ` ${DIM}↓ ${remaining} more${RESET}`;
      lines.push(`${popoverBg}${padEnd(indicator, totalWidth + 2)}${RESET}`);
    } else {
      lines.push(`${popoverBg}${' '.repeat(totalWidth + 2)}${RESET}`);
    }
  }
  lines.push(helpText);

  return lines.join('\n');
}

/**
 * Draw the dropdown below the current cursor position.
 * @param {Suggestion[]} suggestions
 * @param {number} selectedIndex
 * @param {number} previousLines - Number of lines previously drawn (to clear)
 */
export function drawDropdown(suggestions, selectedIndex, previousLines = 0) {
  // Clear previous dropdown
  if (previousLines > 0) {
    for (let i = 0; i < previousLines; i++) {
      write(cursor.down(1) + screen.clearLine);
    }
    write(cursor.up(previousLines));
  }

  const output = renderDropdown(suggestions, selectedIndex);
  if (!output) return 0;

  const lines = output.split('\n');

  // Save cursor, draw below
  write(cursor.save);
  write('\n');
  for (const line of lines) {
    write(line + '\n');
  }
  write(cursor.restore);

  return lines.length + 1;
}

/**
 * Clear the dropdown from display.
 * @param {number} lineCount - Number of lines to clear
 */
export function clearDropdown(lineCount) {
  if (lineCount <= 0) return;

  write(cursor.save);
  for (let i = 0; i < lineCount; i++) {
    write('\n' + screen.clearLine);
  }
  write(cursor.restore);
}

/**
 * Get a compact inline preview of the top suggestion.
 * @param {Suggestion[]} suggestions
 * @returns {string}
 */
export function getInlinePreview(suggestions) {
  if (suggestions.length === 0) return '';
  const top = suggestions[0];
  return `${DIM}${top.text}${RESET}`;
}
