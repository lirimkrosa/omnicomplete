/**
 * Integrations Command — manage CLI integrations.
 * Supports install (autocomplete, ssh, vscode, dotfiles), uninstall, and status.
 */

import { writeFileSync, mkdirSync, existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { RESET, BOLD, DIM, FG } from '../utils/ansi.js';
import { writeLine, printHeader, printSeparator, getShell } from '../utils/terminal.js';
import { generateZshHook, generateBashHook, generateFishHook } from '../shell/integration.js';

const CONFIG_DIR = join(homedir(), '.cli-autocomplete');

const INTEGRATIONS = {
  autocomplete: { name: 'Autocomplete', icon: '⌨️', installed: false },
  ssh: { name: 'SSH', icon: '🔐', installed: false },
  vscode: { name: 'VS Code', icon: '📝', installed: false },
  dotfiles: { name: 'Dotfiles', icon: '📁', installed: false },
};

export async function execute(args, flags) {
  const subcommand = args[0];

  switch (subcommand) {
    case 'install':
      return installIntegration(args[1], flags);
    case 'uninstall':
      return uninstallIntegration(args[1]);
    case 'status':
      return showStatus(flags);
    default:
      return showStatus(flags);
  }
}

async function installIntegration(name, flags) {
  if (!name) {
    writeLine(`\n  ${FG.red}✗${RESET} Integration name required.`);
    writeLine(`  ${DIM}Available: autocomplete, ssh, vscode, dotfiles${RESET}\n`);
    return;
  }

  switch (name) {
    case 'autocomplete':
      return installAutocomplete();
    case 'ssh':
      return installGeneric('ssh', 'SSH key agent integration');
    case 'vscode':
      return installGeneric('vscode', 'VS Code terminal integration');
    case 'dotfiles':
      return installGeneric('dotfiles', 'Dotfiles sync integration');
    default:
      writeLine(`\n  ${FG.red}✗${RESET} Unknown integration: "${name}"`);
      writeLine(`  ${DIM}Available: autocomplete, ssh, vscode, dotfiles${RESET}\n`);
  }
}

async function installAutocomplete() {
  const shell = getShell();
  writeLine('');
  writeLine(`  ${FG.brightCyan}⟳${RESET} Installing autocomplete for ${BOLD}${shell}${RESET}...`);
  writeLine('');

  let hookScript;
  let rcFile;

  switch (shell) {
    case 'zsh':
      rcFile = join(homedir(), '.zshrc');
      hookScript = generateZshHook();
      break;
    case 'bash':
      rcFile = join(homedir(), '.bashrc');
      hookScript = generateBashHook();
      break;
    case 'fish':
      rcFile = join(homedir(), '.config', 'fish', 'conf.d', 'clia.fish');
      hookScript = generateFishHook();
      break;
    default:
      writeLine(`  ${FG.yellow}⚠${RESET} Unsupported shell: ${shell}`);
      writeLine(`  ${DIM}Supported shells: zsh, bash, fish${RESET}\n`);
      return;
  }

  // Save the hook script
  const hookPath = join(CONFIG_DIR, 'shell-hook.sh');
  mkdirSync(CONFIG_DIR, { recursive: true });
  writeFileSync(hookPath, hookScript, 'utf8');

  // Check if already installed
  if (existsSync(rcFile)) {
    const rcContent = readFileSync(rcFile, 'utf8');
    if (rcContent.includes('cli-autocomplete')) {
      writeLine(`  ${FG.yellow}⚠${RESET} Autocomplete already installed in ${DIM}${rcFile}${RESET}`);
      writeLine(`  ${DIM}To reinstall, remove the cli-autocomplete block from your shell rc file.${RESET}\n`);
      saveIntegrationStatus('autocomplete', true);
      return;
    }
  }

  // Show what would be added
  writeLine(`  ${BOLD}The following will be added to ${FG.cyan}${rcFile}${RESET}${BOLD}:${RESET}`);
  writeLine('');
  writeLine(`  ${DIM}# >>> cli-autocomplete >>>${RESET}`);
  writeLine(`  ${DIM}[ -f "${hookPath}" ] && source "${hookPath}"${RESET}`);
  writeLine(`  ${DIM}# <<< cli-autocomplete <<<${RESET}`);
  writeLine('');

  // Append to rc file
  const block = `\n# >>> cli-autocomplete >>>\n[ -f "${hookPath}" ] && source "${hookPath}"\n# <<< cli-autocomplete <<<\n`;

  try {
    const { appendFileSync } = await import('fs');
    appendFileSync(rcFile, block, 'utf8');
    saveIntegrationStatus('autocomplete', true);

    writeLine(`  ${FG.green}✓${RESET} Autocomplete installed successfully!`);
    writeLine(`  ${DIM}Restart your terminal or run: source ${rcFile}${RESET}\n`);
  } catch (err) {
    writeLine(`  ${FG.red}✗${RESET} Failed to write to ${rcFile}: ${err.message}`);
    writeLine(`  ${DIM}You can manually add the block above to your shell rc file.${RESET}\n`);
  }
}

function installGeneric(name, description) {
  saveIntegrationStatus(name, true);
  writeLine(`\n  ${FG.green}✓${RESET} ${BOLD}${description}${RESET} — marked as installed.`);
  writeLine(`  ${DIM}Configuration stored in ~/.cli-autocomplete/${RESET}\n`);
}

function uninstallIntegration(name) {
  if (!name) {
    writeLine(`\n  ${FG.red}✗${RESET} Integration name required.\n`);
    return;
  }

  saveIntegrationStatus(name, false);
  writeLine(`\n  ${FG.green}✓${RESET} Integration "${name}" uninstalled.`);
  writeLine(`  ${DIM}You may need to remove the hook from your shell rc file manually.${RESET}\n`);
}

function showStatus(flags) {
  const statuses = loadIntegrationStatuses();

  if (flags['--json']) {
    writeLine(JSON.stringify(statuses, null, 2));
    return;
  }

  printHeader('  Integration Status');
  printSeparator(50);

  for (const [key, info] of Object.entries(INTEGRATIONS)) {
    const installed = statuses[key] === true;
    const icon = installed ? `${FG.green}●${RESET}` : `${FG.gray}○${RESET}`;
    const status = installed ? `${FG.green}installed${RESET}` : `${DIM}not installed${RESET}`;
    writeLine(`  ${info.icon}  ${BOLD}${info.name}${RESET}  ${icon} ${status}`);
  }

  writeLine(`\n  ${DIM}Install with: clia integrations install <name>${RESET}\n`);
}

// --- Helpers ---

function saveIntegrationStatus(name, installed) {
  const statusFile = join(CONFIG_DIR, 'integrations.json');
  mkdirSync(CONFIG_DIR, { recursive: true });
  let statuses = {};
  try {
    if (existsSync(statusFile)) {
      statuses = JSON.parse(readFileSync(statusFile, 'utf8'));
    }
  } catch { /* ignore */ }
  statuses[name] = installed;
  writeFileSync(statusFile, JSON.stringify(statuses, null, 2), 'utf8');
}

function loadIntegrationStatuses() {
  const statusFile = join(CONFIG_DIR, 'integrations.json');
  try {
    if (existsSync(statusFile)) {
      return JSON.parse(readFileSync(statusFile, 'utf8'));
    }
  } catch { /* ignore */ }
  return {};
}

// Hooks imported from ../shell/integration.js

export const meta = {
  name: 'integrations',
  description: 'Manage CLI integrations',
};
