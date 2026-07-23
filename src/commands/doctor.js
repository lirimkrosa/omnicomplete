/**
 * Doctor Command — runs diagnostics and health checks.
 * Checks: shell integration, specs, config, terminal, history.
 */

import { existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { RESET, BOLD, DIM, FG, BG } from '../utils/ansi.js';
import { writeLine, printHeader, printSeparator, getShell, getTerminalEmulator, isTTY, supports256Colors, supportsTrueColor, getTerminalSize } from '../utils/terminal.js';
import { getSpecDirectories, getSpecCount, getLoadedSpecNames } from '../autocomplete/spec-loader.js';
import { getHistoryPath } from '../core/history.js';

export async function execute(args, flags) {
  const checks = [];
  const verbose = flags['--verbose'] || flags['-v'];

  writeLine('');
  writeLine(`  ${BOLD}${FG.brightCyan}🩺 CLI Autocomplete — Diagnostics${RESET}`);
  printSeparator(50);
  writeLine('');

  // 1. Environment
  const shell = getShell();
  const terminal = getTerminalEmulator();
  const { columns, rows } = getTerminalSize();
  const tty = isTTY();
  const colors256 = supports256Colors();
  const trueColor = supportsTrueColor();

  checks.push(check('Terminal is TTY', tty, 'Required for interactive features'));
  checks.push(check('Shell detected', !!shell && shell !== 'unknown', `Shell: ${shell}`));
  checks.push(check('Terminal detected', !!terminal && terminal !== 'unknown', `Terminal: ${terminal}`));
  checks.push(check('256 color support', colors256, colors256 ? 'Supported' : 'Limited colors'));
  checks.push(check('True color support', trueColor, trueColor ? 'Supported' : 'Not detected'));
  checks.push(check('Terminal size', columns >= 60, `${columns}×${rows}`));

  writeLine(`  ${BOLD}Environment${RESET}`);
  for (const c of checks) printCheck(c);
  writeLine('');

  // 2. Configuration
  const configChecks = [];
  const configDir = join(homedir(), '.cli-autocomplete');
  const configFile = join(configDir, 'config.json');

  configChecks.push(check('Config directory', existsSync(configDir), configDir));
  configChecks.push(check('Config file', existsSync(configFile), configFile));
  configChecks.push(check('History file', existsSync(getHistoryPath()), getHistoryPath()));

  writeLine(`  ${BOLD}Configuration${RESET}`);
  for (const c of configChecks) printCheck(c);
  writeLine('');

  // 3. Autocomplete Specs
  const specChecks = [];
  const specDirs = getSpecDirectories();
  const specCount = getSpecCount();
  const specNames = getLoadedSpecNames();

  specChecks.push(check('Built-in specs', existsSync(specDirs.builtin), specDirs.builtin));
  specChecks.push(check('User specs dir', existsSync(specDirs.user) || true, specDirs.user));
  specChecks.push(check('Specs loaded', specCount > 0, `${specCount} spec(s): ${specNames.join(', ') || 'none'}`));

  writeLine(`  ${BOLD}Autocomplete Specs${RESET}`);
  for (const c of specChecks) printCheck(c);
  writeLine('');

  // 4. Shell Integration
  const integrationChecks = [];
  const hookFile = join(configDir, 'shell-hook.sh');
  const integrationsFile = join(configDir, 'integrations.json');

  integrationChecks.push(check('Shell hook file', existsSync(hookFile), hookFile));
  integrationChecks.push(check('Integrations config', existsSync(integrationsFile), integrationsFile));

  // Check if rc file has our hook
  let rcFile;
  switch (shell) {
    case 'zsh': rcFile = join(homedir(), '.zshrc'); break;
    case 'bash': rcFile = join(homedir(), '.bashrc'); break;
    default: rcFile = null;
  }

  if (rcFile) {
    try {
      const { readFileSync } = await import('fs');
      const content = readFileSync(rcFile, 'utf8');
      const hasHook = content.includes('cli-autocomplete');
      integrationChecks.push(check('Shell rc hook', hasHook, `${rcFile}`));
    } catch {
      integrationChecks.push(check('Shell rc hook', false, 'Could not read rc file'));
    }
  }

  writeLine(`  ${BOLD}Shell Integration${RESET}`);
  for (const c of integrationChecks) printCheck(c);
  writeLine('');

  // Summary
  const allChecks = [...checks, ...configChecks, ...specChecks, ...integrationChecks];
  const passed = allChecks.filter(c => c.ok).length;
  const failed = allChecks.filter(c => !c.ok).length;

  printSeparator(50);
  const statusColor = failed === 0 ? FG.green : failed <= 2 ? FG.yellow : FG.red;
  const statusIcon = failed === 0 ? '✓' : '⚠';
  writeLine(`  ${statusColor}${statusIcon}${RESET} ${passed} passed, ${failed} issues`);

  if (failed > 0) {
    writeLine(`  ${DIM}Run with --fix to attempt automatic repairs.${RESET}`);
  }

  if (flags['--fix']) {
    writeLine(`\n  ${FG.brightCyan}⟳${RESET} Attempting fixes...`);
    const { mkdirSync } = await import('fs');
    mkdirSync(configDir, { recursive: true });
    writeLine(`  ${FG.green}✓${RESET} Created config directory.`);
    writeLine(`  ${DIM}Run 'clia integrations install autocomplete' for shell integration.${RESET}`);
  }

  if (flags['--json']) {
    writeLine(JSON.stringify({ checks: allChecks, passed, failed }, null, 2));
  }

  writeLine('');
}

function check(name, ok, detail = '') {
  return { name, ok, detail };
}

function printCheck(c) {
  const icon = c.ok ? `${FG.green}✓${RESET}` : `${FG.red}✗${RESET}`;
  const detail = c.detail ? `  ${DIM}${c.detail}${RESET}` : '';
  writeLine(`    ${icon} ${c.name}${detail}`);
}

export const meta = {
  name: 'doctor',
  description: 'Run diagnostics and health checks',
};
