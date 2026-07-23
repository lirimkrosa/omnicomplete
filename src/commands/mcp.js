/**
 * MCP Command — manage Model Context Protocol servers.
 * Config stored in ~/.cli-autocomplete/mcp.json
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { RESET, BOLD, DIM, FG } from '../utils/ansi.js';
import { writeLine, printHeader, printSeparator } from '../utils/terminal.js';

const CONFIG_DIR = join(homedir(), '.cli-autocomplete');
const MCP_FILE = join(CONFIG_DIR, 'mcp.json');

const DEFAULT_MCP = {
  mcpServers: {},
};

export async function execute(args, flags) {
  mkdirSync(CONFIG_DIR, { recursive: true });

  const subcommand = args[0];

  switch (subcommand) {
    case 'list':
      return listServers(flags);
    case 'add':
      return addServer(args[1], flags);
    case 'remove':
      return removeServer(args[1]);
    case 'config':
      return showConfig(flags);
    default:
      return listServers(flags);
  }
}

function listServers(flags) {
  const config = loadMcpConfig();
  const servers = Object.entries(config.mcpServers || {});

  if (flags['--json']) {
    writeLine(JSON.stringify(config, null, 2));
    return;
  }

  printHeader('  MCP Servers');
  printSeparator(50);

  if (servers.length === 0) {
    writeLine(`  ${DIM}No MCP servers configured.${RESET}`);
    writeLine(`  ${DIM}Add one with: clia mcp add <name> --command <cmd>${RESET}\n`);
    return;
  }

  for (const [name, server] of servers) {
    const cmd = server.command || 'N/A';
    const args = (server.args || []).join(' ');
    writeLine(`  ${FG.brightCyan}${name}${RESET}`);
    writeLine(`    ${DIM}Command:${RESET} ${cmd} ${args}`);
    if (server.env) {
      const envKeys = Object.keys(server.env);
      writeLine(`    ${DIM}Env:${RESET} ${envKeys.join(', ')}`);
    }
    writeLine('');
  }
}

function addServer(name, flags) {
  if (!name) {
    writeLine(`\n  ${FG.red}✗${RESET} Server name required.`);
    writeLine(`  ${DIM}Usage: clia mcp add <name> --command <cmd>${RESET}\n`);
    return;
  }

  const config = loadMcpConfig();

  if (config.mcpServers[name]) {
    writeLine(`\n  ${FG.yellow}⚠${RESET} Server "${name}" already exists. Remove first to reconfigure.\n`);
    return;
  }

  const serverConfig = {
    command: flags['--command'] || 'npx',
    args: flags['--args'] ? flags['--args'].split(' ') : [],
  };

  if (flags['--env']) {
    const parts = flags['--env'].split('=');
    if (parts.length === 2) {
      serverConfig.env = { [parts[0]]: parts[1] };
    }
  }

  config.mcpServers[name] = serverConfig;
  saveMcpConfig(config);

  writeLine(`\n  ${FG.green}✓${RESET} MCP server ${FG.cyan}"${name}"${RESET} added.`);
  writeLine(`  ${DIM}Config saved to: ${MCP_FILE}${RESET}\n`);
}

function removeServer(name) {
  if (!name) {
    writeLine(`\n  ${FG.red}✗${RESET} Server name required.\n`);
    return;
  }

  const config = loadMcpConfig();

  if (!config.mcpServers[name]) {
    writeLine(`\n  ${FG.red}✗${RESET} Server "${name}" not found.\n`);
    return;
  }

  delete config.mcpServers[name];
  saveMcpConfig(config);

  writeLine(`\n  ${FG.green}✓${RESET} MCP server ${FG.cyan}"${name}"${RESET} removed.\n`);
}

function showConfig(flags) {
  const scope = flags['--scope'] || 'user';
  const configPath = scope === 'workspace'
    ? join(process.cwd(), '.clia', 'mcp.json')
    : MCP_FILE;

  writeLine(`\n  ${BOLD}MCP Configuration${RESET}`);
  writeLine(`  ${DIM}Scope:${RESET} ${scope}`);
  writeLine(`  ${DIM}Path:${RESET}  ${configPath}`);
  writeLine('');

  if (existsSync(configPath)) {
    const content = readFileSync(configPath, 'utf8');
    writeLine(content);
  } else {
    writeLine(`  ${DIM}No config file found. Create one with: clia mcp add <name>${RESET}`);
  }
  writeLine('');
}

function loadMcpConfig() {
  try {
    if (existsSync(MCP_FILE)) {
      return JSON.parse(readFileSync(MCP_FILE, 'utf8'));
    }
  } catch { /* ignore */ }
  return { ...DEFAULT_MCP };
}

function saveMcpConfig(config) {
  mkdirSync(CONFIG_DIR, { recursive: true });
  writeFileSync(MCP_FILE, JSON.stringify(config, null, 2), 'utf8');
}

export const meta = {
  name: 'mcp',
  description: 'Manage Model Context Protocol servers',
};
