/**
 * Hook Command — manage lifecycle hooks for agent events.
 * Events: AgentSpawn, PreToolUse, PostToolUse, Stop, UserPromptSubmit
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { RESET, BOLD, DIM, FG } from '../utils/ansi.js';
import { writeLine, printHeader, printSeparator } from '../utils/terminal.js';

const CONFIG_DIR = join(homedir(), '.cli-autocomplete');
const HOOKS_FILE = join(CONFIG_DIR, 'hooks.json');

const VALID_EVENTS = ['AgentSpawn', 'PreToolUse', 'PostToolUse', 'Stop', 'UserPromptSubmit'];

export async function execute(args, flags) {
  mkdirSync(CONFIG_DIR, { recursive: true });

  const subcommand = args[0];

  switch (subcommand) {
    case 'list':
      return listHooks(flags);
    case 'add':
      return addHook(args[1], flags);
    case 'remove':
      return removeHook(args[1]);
    case 'test':
      return testHook(args[1]);
    default:
      return listHooks(flags);
  }
}

function listHooks(flags) {
  const hooks = loadHooks();

  if (flags['--json']) {
    writeLine(JSON.stringify(hooks, null, 2));
    return;
  }

  printHeader('  Lifecycle Hooks');
  printSeparator(50);

  if (hooks.length === 0) {
    writeLine(`  ${DIM}No hooks configured.${RESET}`);
    writeLine(`  ${DIM}Add one with: clia hook add <event> --command <cmd>${RESET}`);
    writeLine(`  ${DIM}Events: ${VALID_EVENTS.join(', ')}${RESET}\n`);
    return;
  }

  for (const hook of hooks) {
    writeLine(`  ${FG.brightCyan}${hook.id}${RESET}  ${DIM}→${RESET} ${hook.event}`);
    writeLine(`    ${DIM}Command:${RESET} ${hook.command}`);
    if (hook.description) {
      writeLine(`    ${DIM}${hook.description}${RESET}`);
    }
    writeLine('');
  }
}

function addHook(event, flags) {
  if (!event) {
    writeLine(`\n  ${FG.red}✗${RESET} Event name required.`);
    writeLine(`  ${DIM}Valid events: ${VALID_EVENTS.join(', ')}${RESET}\n`);
    return;
  }

  if (!VALID_EVENTS.includes(event)) {
    writeLine(`\n  ${FG.red}✗${RESET} Invalid event: "${event}"`);
    writeLine(`  ${DIM}Valid events: ${VALID_EVENTS.join(', ')}${RESET}\n`);
    return;
  }

  const command = flags['--command'];
  if (!command) {
    writeLine(`\n  ${FG.red}✗${RESET} --command flag required.`);
    writeLine(`  ${DIM}Usage: clia hook add ${event} --command "echo hook fired"${RESET}\n`);
    return;
  }

  const hooks = loadHooks();
  const id = `hook_${Date.now().toString(36)}`;

  hooks.push({
    id,
    event,
    command,
    description: flags['--description'] || flags['-d'] || '',
    createdAt: Date.now(),
  });

  saveHooks(hooks);
  writeLine(`\n  ${FG.green}✓${RESET} Hook ${FG.cyan}${id}${RESET} added for ${BOLD}${event}${RESET}.\n`);
}

function removeHook(id) {
  if (!id) {
    writeLine(`\n  ${FG.red}✗${RESET} Hook ID required.\n`);
    return;
  }

  const hooks = loadHooks();
  const idx = hooks.findIndex(h => h.id === id);

  if (idx === -1) {
    writeLine(`\n  ${FG.red}✗${RESET} Hook "${id}" not found.\n`);
    return;
  }

  hooks.splice(idx, 1);
  saveHooks(hooks);
  writeLine(`\n  ${FG.green}✓${RESET} Hook ${FG.cyan}${id}${RESET} removed.\n`);
}

async function testHook(id) {
  if (!id) {
    writeLine(`\n  ${FG.red}✗${RESET} Hook ID required.\n`);
    return;
  }

  const hooks = loadHooks();
  const hook = hooks.find(h => h.id === id);

  if (!hook) {
    writeLine(`\n  ${FG.red}✗${RESET} Hook "${id}" not found.\n`);
    return;
  }

  writeLine(`\n  ${FG.brightCyan}⟳${RESET} Testing hook ${BOLD}${id}${RESET} (event: ${hook.event})...`);
  writeLine(`  ${DIM}Command: ${hook.command}${RESET}\n`);

  try {
    const { execSync } = await import('child_process');
    const output = execSync(hook.command, {
      encoding: 'utf8',
      timeout: 10000,
      env: {
        ...process.env,
        CLIA_HOOK_EVENT: hook.event,
        CLIA_HOOK_ID: hook.id,
      },
    });
    if (output) {
      writeLine(`  ${FG.green}Output:${RESET}`);
      writeLine(`  ${output.trim()}`);
    }
    writeLine(`\n  ${FG.green}✓${RESET} Hook executed successfully.\n`);
  } catch (err) {
    writeLine(`  ${FG.red}✗${RESET} Hook failed: ${err.message}\n`);
  }
}

function loadHooks() {
  try {
    if (existsSync(HOOKS_FILE)) {
      return JSON.parse(readFileSync(HOOKS_FILE, 'utf8'));
    }
  } catch { /* ignore */ }
  return [];
}

function saveHooks(hooks) {
  writeFileSync(HOOKS_FILE, JSON.stringify(hooks, null, 2), 'utf8');
}

export const meta = {
  name: 'hook',
  description: 'Manage lifecycle hooks',
};
