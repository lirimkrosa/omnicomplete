/**
 * Settings Panel — full-screen inline TUI settings panel.
 * Replaces the desktop app settings. Navigable with arrow keys.
 */

import { RESET, BOLD, DIM, FG, BG, box, cursor, screen, style, padEnd, visibleLength, fgRgb, bgRgb } from '../utils/ansi.js';
import { write, writeLine, getTerminalSize, enterRawMode, readKey, printSeparator } from '../utils/terminal.js';
import { loadConfig, saveConfig, resetConfig, getSetting, setSetting } from './config-store.js';
import { SETTINGS_META, getCategories, DEFAULTS } from './defaults.js';

/**
 * Execute settings command.
 * @param {string[]} args
 * @param {object} flags
 */
export async function execute(args, flags) {
  if (flags['--non-interactive']) {
    const config = loadConfig();
    writeLine(JSON.stringify(config, null, 2));
    return;
  }

  if (flags['--get']) {
    const value = getSetting(flags['--get']);
    writeLine(JSON.stringify(value));
    return;
  }

  if (flags['--set']) {
    const [key, ...rest] = flags['--set'].split('=');
    const value = rest.join('=');
    setSetting(key, value);
    writeLine(`  ${FG.green}✓${RESET} ${key} = ${value}`);
    return;
  }

  if (flags['--reset']) {
    resetConfig();
    writeLine(`\n  ${FG.green}✓${RESET} Settings reset to defaults.\n`);
    return;
  }

  // Launch interactive TUI
  await launchSettingsPanel();
}

async function launchSettingsPanel() {
  const config = loadConfig();
  const categories = getCategories();
  const allItems = SETTINGS_META;

  let selectedIndex = 0;
  let selectedCategory = 0;
  let dirty = false;

  const cleanup = enterRawMode();

  try {
    while (true) {
      renderPanel(config, allItems, categories, selectedCategory, selectedIndex, dirty);

      const key = await readKey();

      if (key.ctrl && key.name === 'c') break;
      if (key.name === 'escape') break;
      if (key.name === 'q') break;

      const categoryItems = allItems.filter(s => s.category === categories[selectedCategory]);

      if (key.name === 'up') {
        selectedIndex = Math.max(0, selectedIndex - 1);
      } else if (key.name === 'down') {
        selectedIndex = Math.min(categoryItems.length - 1, selectedIndex + 1);
      } else if (key.name === 'left' || key.shift && key.name === 'tab') {
        selectedCategory = (selectedCategory - 1 + categories.length) % categories.length;
        selectedIndex = 0;
      } else if (key.name === 'right' || key.name === 'tab') {
        selectedCategory = (selectedCategory + 1) % categories.length;
        selectedIndex = 0;
      } else if (key.name === 'return' || key.name === ' ' || key.name === 'space') {
        const item = categoryItems[selectedIndex];
        if (item) {
          toggleOrEdit(config, item);
          dirty = true;
        }
      } else if (key.name === 's' && key.ctrl) {
        saveConfig(config);
        dirty = false;
      }
    }
  } finally {
    // Save if dirty
    if (dirty) {
      saveConfig(config);
    }

    cleanup();
    // Restore screen
    write(screen.mainBuffer);
    write(cursor.show);
    writeLine(`\n  ${FG.green}✓${RESET} Settings ${dirty ? 'saved' : 'unchanged'}.\n`);
  }
}

function renderPanel(config, allItems, categories, selectedCategory, selectedIndex, dirty) {
  const { columns, rows } = getTerminalSize();
  const width = Math.min(columns - 4, 80);
  const borderColor = FG.cyan;

  // Enter alt buffer and clear
  write(screen.altBuffer);
  write(screen.clear);
  write(cursor.moveTo(1, 1));
  write(cursor.hide);

  // Title bar
  const title = ' ⚙️  Settings ';
  const dirtyMark = dirty ? ` ${FG.yellow}●${RESET}` : '';
  writeLine(`  ${BOLD}${FG.brightCyan}${title}${RESET}${dirtyMark}`);
  writeLine(`  ${borderColor}${'─'.repeat(width)}${RESET}`);

  // Category tabs
  let tabLine = '  ';
  for (let i = 0; i < categories.length; i++) {
    const cat = categories[i];
    if (i === selectedCategory) {
      tabLine += `${BG.gray}${BOLD}${FG.brightCyan} ${cat} ${RESET} `;
    } else {
      tabLine += `${DIM} ${cat} ${RESET} `;
    }
  }
  writeLine(tabLine);
  writeLine(`  ${borderColor}${'─'.repeat(width)}${RESET}`);
  writeLine('');

  // Settings for selected category
  const categoryItems = allItems.filter(s => s.category === categories[selectedCategory]);

  for (let i = 0; i < categoryItems.length; i++) {
    const item = categoryItems[i];
    const isSelected = i === selectedIndex;
    const value = config[item.key];

    const prefix = isSelected ? `  ${FG.brightCyan}▸${RESET} ` : '    ';
    const highlight = isSelected ? BOLD : '';
    const labelColor = isSelected ? FG.brightWhite : FG.white;

    let valueDisplay;
    switch (item.type) {
      case 'toggle':
        valueDisplay = value
          ? `${FG.green}● ON${RESET}`
          : `${FG.red}○ OFF${RESET}`;
        break;
      case 'number':
        valueDisplay = `${FG.brightYellow}${value}${RESET}`;
        break;
      case 'select':
        valueDisplay = `${FG.brightMagenta}${value}${RESET}`;
        if (item.options) {
          const idx = item.options.indexOf(value);
          const next = item.options[(idx + 1) % item.options.length];
          valueDisplay += `${DIM} (→ ${next})${RESET}`;
        }
        break;
      case 'text':
        valueDisplay = `${FG.brightCyan}${value}${RESET}`;
        break;
      default:
        valueDisplay = `${value}`;
    }

    const label = padEnd(`${highlight}${labelColor}${item.label}${RESET}`, 35);
    writeLine(`${prefix}${label}  ${valueDisplay}`);
  }

  // Bottom help bar
  const helpY = rows - 2;
  write(cursor.moveTo(helpY, 1));
  writeLine(`  ${borderColor}${'─'.repeat(width)}${RESET}`);
  writeLine(`  ${DIM}↑↓ navigate  ←→ category  Enter toggle/edit  Ctrl+S save  Esc exit${RESET}`);
}

function toggleOrEdit(config, item) {
  switch (item.type) {
    case 'toggle':
      config[item.key] = !config[item.key];
      break;
    case 'select':
      if (item.options) {
        const current = config[item.key];
        const idx = item.options.indexOf(current);
        config[item.key] = item.options[(idx + 1) % item.options.length];
      }
      break;
    case 'number':
      // Increment, wrap around
      let val = config[item.key] + 1;
      if (item.max !== undefined && val > item.max) val = item.min || 1;
      config[item.key] = val;
      break;
    // text: would need full text input — for now, keep current value
  }
}

export const meta = {
  name: 'settings',
  description: 'Open inline settings panel',
};
