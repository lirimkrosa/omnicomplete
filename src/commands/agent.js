/**
 * Agent Command — manage AI agents (list, create, edit, set-default, delete, show).
 * Stores agent configs in ~/.cli-autocomplete/agents/
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, unlinkSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { RESET, BOLD, DIM, FG } from '../utils/ansi.js';
import { writeLine, printHeader, printSeparator } from '../utils/terminal.js';
import { loadConfig, saveConfig } from '../settings/config-store.js';

const AGENTS_DIR = join(homedir(), '.cli-autocomplete', 'agents');

const DEFAULT_AGENT = {
  name: 'default',
  description: 'Built-in default agent',
  model: 'default',
  systemPrompt: 'You are a helpful CLI assistant.',
  hooks: [],
  createdAt: Date.now(),
};

export async function execute(args, flags) {
  mkdirSync(AGENTS_DIR, { recursive: true });

  const subcommand = args[0];
  const subArgs = args.slice(1);

  switch (subcommand) {
    case 'list':
      return listAgents(flags);
    case 'create':
      return createAgent(subArgs[0], flags);
    case 'edit':
      return editAgent(subArgs[0], flags);
    case 'set-default':
      return setDefault(subArgs[0]);
    case 'delete':
      return deleteAgent(subArgs[0], flags);
    case 'show':
      return showAgent(subArgs[0], flags);
    default:
      return listAgents(flags);
  }
}

function listAgents(flags) {
  const agents = getAllAgents();
  const config = loadConfig();
  const defaultName = config.defaultAgent || 'default';

  if (flags['--json']) {
    writeLine(JSON.stringify(agents, null, 2));
    return;
  }

  printHeader('  AI Agents');
  printSeparator(50);

  if (agents.length === 0) {
    writeLine(`  ${DIM}No agents configured. Using built-in default.${RESET}`);
    showAgentEntry(DEFAULT_AGENT, true);
  } else {
    for (const agent of agents) {
      const isDefault = agent.name === defaultName;
      showAgentEntry(agent, isDefault);
    }

    // Show built-in default if not overridden
    if (!agents.find(a => a.name === 'default')) {
      showAgentEntry(DEFAULT_AGENT, defaultName === 'default');
    }
  }

  writeLine(`\n  ${DIM}Manage agents: clia agent create|edit|delete|set-default <name>${RESET}\n`);
}

function showAgentEntry(agent, isDefault) {
  const defaultBadge = isDefault ? `  ${FG.yellow}★ default${RESET}` : '';
  writeLine(`  ${FG.brightCyan}${agent.name}${RESET}${defaultBadge}`);
  writeLine(`  ${DIM}  ${agent.description || 'No description'}${RESET}`);
  if (agent.model) {
    writeLine(`  ${DIM}  Model: ${agent.model}${RESET}`);
  }
  writeLine('');
}

function createAgent(name, flags) {
  if (!name) {
    writeLine(`\n  ${FG.red}✗${RESET} Agent name required.`);
    writeLine(`  ${DIM}Usage: clia agent create <name>${RESET}\n`);
    return;
  }

  const filePath = join(AGENTS_DIR, `${name}.json`);
  if (existsSync(filePath)) {
    writeLine(`\n  ${FG.red}✗${RESET} Agent "${name}" already exists. Use 'edit' to modify.\n`);
    return;
  }

  const agent = {
    name,
    description: flags['--description'] || flags['-d'] || '',
    model: 'default',
    systemPrompt: 'You are a helpful CLI assistant.',
    template: flags['--template'] || flags['-t'] || null,
    hooks: [],
    createdAt: Date.now(),
  };

  writeFileSync(filePath, JSON.stringify(agent, null, 2), 'utf8');
  writeLine(`\n  ${FG.green}✓${RESET} Agent ${FG.cyan}"${name}"${RESET} created.`);
  writeLine(`  ${DIM}Edit with: clia agent edit ${name}${RESET}\n`);
}

function editAgent(name, flags) {
  if (!name) {
    writeLine(`\n  ${FG.red}✗${RESET} Agent name required.\n`);
    return;
  }

  const filePath = join(AGENTS_DIR, `${name}.json`);
  if (!existsSync(filePath)) {
    writeLine(`\n  ${FG.red}✗${RESET} Agent "${name}" not found.\n`);
    return;
  }

  writeLine(`\n  ${FG.cyan}ℹ${RESET} Agent config location: ${DIM}${filePath}${RESET}`);
  writeLine(`  ${DIM}Edit this JSON file directly to modify the agent configuration.${RESET}\n`);
}

function setDefault(name) {
  if (!name) {
    writeLine(`\n  ${FG.red}✗${RESET} Agent name required.\n`);
    return;
  }

  // Verify agent exists (or is 'default')
  if (name !== 'default') {
    const filePath = join(AGENTS_DIR, `${name}.json`);
    if (!existsSync(filePath)) {
      writeLine(`\n  ${FG.red}✗${RESET} Agent "${name}" not found.\n`);
      return;
    }
  }

  const config = loadConfig();
  config.defaultAgent = name;
  saveConfig(config);

  writeLine(`\n  ${FG.green}✓${RESET} Default agent set to ${FG.cyan}"${name}"${RESET}.\n`);
}

function deleteAgent(name, flags) {
  if (!name) {
    writeLine(`\n  ${FG.red}✗${RESET} Agent name required.\n`);
    return;
  }

  if (name === 'default') {
    writeLine(`\n  ${FG.red}✗${RESET} Cannot delete the built-in default agent.\n`);
    return;
  }

  const filePath = join(AGENTS_DIR, `${name}.json`);
  if (!existsSync(filePath)) {
    writeLine(`\n  ${FG.red}✗${RESET} Agent "${name}" not found.\n`);
    return;
  }

  unlinkSync(filePath);
  writeLine(`\n  ${FG.green}✓${RESET} Agent ${FG.cyan}"${name}"${RESET} deleted.\n`);
}

function showAgent(name, flags) {
  if (!name) {
    writeLine(`\n  ${FG.red}✗${RESET} Agent name required.\n`);
    return;
  }

  let agent;
  if (name === 'default') {
    agent = DEFAULT_AGENT;
  } else {
    const filePath = join(AGENTS_DIR, `${name}.json`);
    if (!existsSync(filePath)) {
      writeLine(`\n  ${FG.red}✗${RESET} Agent "${name}" not found.\n`);
      return;
    }
    agent = JSON.parse(readFileSync(filePath, 'utf8'));
  }

  if (flags['--json']) {
    writeLine(JSON.stringify(agent, null, 2));
    return;
  }

  printHeader(`  Agent: ${agent.name}`);
  printSeparator(40);
  writeLine(`  ${BOLD}Description:${RESET}  ${agent.description || 'None'}`);
  writeLine(`  ${BOLD}Model:${RESET}        ${agent.model || 'default'}`);
  writeLine(`  ${BOLD}Prompt:${RESET}       ${agent.systemPrompt || 'None'}`);
  writeLine(`  ${BOLD}Hooks:${RESET}        ${agent.hooks?.length || 0} configured`);
  writeLine(`  ${BOLD}Created:${RESET}      ${new Date(agent.createdAt).toLocaleString()}`);
  writeLine('');
}

function getAllAgents() {
  try {
    if (!existsSync(AGENTS_DIR)) return [];
    const files = readdirSync(AGENTS_DIR).filter(f => f.endsWith('.json'));
    return files.map(f => {
      try {
        return JSON.parse(readFileSync(join(AGENTS_DIR, f), 'utf8'));
      } catch {
        return null;
      }
    }).filter(Boolean);
  } catch {
    return [];
  }
}

export const meta = {
  name: 'agent',
  description: 'Manage AI agents',
};
