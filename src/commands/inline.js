/**
 * Inline Command — toggle inline ghost-text completions on/off.
 */

import { RESET, BOLD, DIM, FG } from '../utils/ansi.js';
import { writeLine } from '../utils/terminal.js';
import { loadConfig, saveConfig } from '../settings/config-store.js';

export async function execute(args, flags) {
  const config = loadConfig();

  if (flags['--enable']) {
    config.ghostTextEnabled = true;
    saveConfig(config);
    writeLine(`\n  ${FG.green}✓${RESET} Inline ghost-text completions ${BOLD}enabled${RESET}.\n`);
    return;
  }

  if (flags['--disable']) {
    config.ghostTextEnabled = false;
    saveConfig(config);
    writeLine(`\n  ${FG.yellow}○${RESET} Inline ghost-text completions ${BOLD}disabled${RESET}.\n`);
    return;
  }

  // Default: show status
  const status = config.ghostTextEnabled !== false;
  const statusIcon = status ? `${FG.green}●${RESET}` : `${FG.red}○${RESET}`;
  const statusText = status ? `${FG.green}enabled${RESET}` : `${FG.red}disabled${RESET}`;

  writeLine('');
  writeLine(`  ${BOLD}Inline Ghost-Text Completions${RESET}`);
  writeLine(`  Status: ${statusIcon} ${statusText}`);
  writeLine('');
  writeLine(`  ${DIM}Toggle with:${RESET}`);
  writeLine(`    clia inline --enable`);
  writeLine(`    clia inline --disable`);
  writeLine('');
}

export const meta = {
  name: 'inline',
  description: 'Toggle inline ghost-text completions',
};
