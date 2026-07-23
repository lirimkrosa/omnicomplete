/**
 * Command Registry — defines the complete command tree.
 * Mirrors Kiro CLI's full command set minus login/logout/signup.
 *
 * Each command entry:
 *  { name, description, aliases, args, flags, subcommands, icon }
 */

/** @typedef {{ name: string, description: string, type?: string, required?: boolean, variadic?: boolean }} Arg */
/** @typedef {{ name: string, description: string, alias?: string, type?: string, default?: any }} Flag */
/** @typedef {{ name: string, description: string, aliases?: string[], args?: Arg[], flags?: Flag[], subcommands?: Command[], icon?: string, hidden?: boolean }} Command */

/**
 * Global flags available on all commands.
 * @type {Flag[]}
 */
export const globalFlags = [
  { name: '--help', description: 'Show help for command', alias: '-h', type: 'boolean' },
  { name: '--version', description: 'Show version number', alias: '-V', type: 'boolean' },
  { name: '--verbose', description: 'Enable verbose output', alias: '-v', type: 'boolean' },
  { name: '--quiet', description: 'Suppress non-essential output', alias: '-q', type: 'boolean' },
  { name: '--no-color', description: 'Disable colored output', type: 'boolean' },
  { name: '--config', description: 'Path to config file', type: 'string' },
];

/**
 * Complete command tree.
 * @type {Command[]}
 */
export const commands = [
  // --- shell ---
  {
    name: 'shell',
    description: 'Launch an interactive shell wrapper with autocomplete',
    icon: '⚡',
    aliases: ['s'],
    args: [],
    flags: [],
    subcommands: [],
  },
  // --- daemon ---
  {
    name: 'daemon',
    description: 'Start the background autocomplete daemon',
    hidden: true,
    args: [],
    flags: [],
    subcommands: [],
  },
  // --- chat ---
  {
    name: 'chat',
    description: 'Start an interactive AI chat session',
    icon: '💬',
    aliases: ['c'],
    args: [
      { name: 'message', description: 'Initial message to send', type: 'string', required: false },
    ],
    flags: [
      { name: '--resume', description: 'Resume a previous session', alias: '-r', type: 'string' },
      { name: '--list-sessions', description: 'List all saved sessions', type: 'boolean' },
      { name: '--delete-session', description: 'Delete a saved session', type: 'string' },
      { name: '--agent', description: 'Use a specific agent', alias: '-a', type: 'string' },
      { name: '--model', description: 'Override the default model', alias: '-m', type: 'string' },
      { name: '--no-stream', description: 'Disable streaming output', type: 'boolean' },
      { name: '--json', description: 'Output in JSON format', type: 'boolean' },
      { name: '--context', description: 'Add file or directory as context', alias: '-C', type: 'string' },
    ],
    subcommands: [],
  },

  // --- translate ---
  {
    name: 'translate',
    description: 'Translate natural language to a shell command',
    icon: '🔄',
    aliases: ['t'],
    args: [
      { name: 'query', description: 'Natural language description of command', type: 'string', required: true, variadic: true },
    ],
    flags: [
      { name: '--execute', description: 'Execute the generated command immediately', alias: '-x', type: 'boolean' },
      { name: '--dry-run', description: 'Show command without executing', type: 'boolean' },
      { name: '--shell', description: 'Target shell (bash, zsh, fish)', type: 'string' },
    ],
    subcommands: [],
  },

  // --- inline ---
  {
    name: 'inline',
    description: 'Toggle inline ghost-text completions',
    icon: '👻',
    aliases: [],
    args: [],
    flags: [
      { name: '--enable', description: 'Enable inline completions', type: 'boolean' },
      { name: '--disable', description: 'Disable inline completions', type: 'boolean' },
      { name: '--status', description: 'Show current status', type: 'boolean' },
    ],
    subcommands: [],
  },

  // --- agent ---
  {
    name: 'agent',
    description: 'Manage AI agents',
    icon: '🤖',
    aliases: [],
    args: [],
    flags: [],
    subcommands: [
      {
        name: 'list',
        description: 'List all available agents',
        icon: '📋',
        flags: [
          { name: '--json', description: 'Output in JSON format', type: 'boolean' },
        ],
      },
      {
        name: 'create',
        description: 'Create a new agent',
        icon: '➕',
        args: [
          { name: 'name', description: 'Name for the new agent', type: 'string', required: true },
        ],
        flags: [
          { name: '--template', description: 'Use a template', alias: '-t', type: 'string' },
          { name: '--description', description: 'Agent description', alias: '-d', type: 'string' },
        ],
      },
      {
        name: 'edit',
        description: 'Edit an existing agent configuration',
        icon: '✏️',
        args: [
          { name: 'name', description: 'Agent name to edit', type: 'string', required: true },
        ],
      },
      {
        name: 'set-default',
        description: 'Set the default agent for new sessions',
        icon: '⭐',
        args: [
          { name: 'name', description: 'Agent name to set as default', type: 'string', required: true },
        ],
      },
      {
        name: 'delete',
        description: 'Delete an agent',
        icon: '🗑️',
        args: [
          { name: 'name', description: 'Agent name to delete', type: 'string', required: true },
        ],
        flags: [
          { name: '--force', description: 'Skip confirmation', alias: '-f', type: 'boolean' },
        ],
      },
      {
        name: 'show',
        description: 'Show agent details',
        icon: '🔍',
        args: [
          { name: 'name', description: 'Agent name to show', type: 'string', required: true },
        ],
        flags: [
          { name: '--json', description: 'Output in JSON format', type: 'boolean' },
        ],
      },
    ],
  },

  // --- integrations ---
  {
    name: 'integrations',
    description: 'Manage CLI integrations',
    icon: '🔌',
    aliases: ['int'],
    args: [],
    flags: [],
    subcommands: [
      {
        name: 'install',
        description: 'Install an integration',
        icon: '📦',
        args: [],
        subcommands: [
          { name: 'autocomplete', description: 'Install shell autocomplete hooks', icon: '⌨️' },
          { name: 'ssh', description: 'Install SSH integration', icon: '🔐' },
          { name: 'vscode', description: 'Install VS Code integration', icon: '📝' },
          { name: 'dotfiles', description: 'Install dotfiles management', icon: '📁' },
        ],
      },
      {
        name: 'uninstall',
        description: 'Uninstall an integration',
        icon: '🗑️',
        args: [
          { name: 'integration', description: 'Integration to uninstall', type: 'string', required: true },
        ],
      },
      {
        name: 'status',
        description: 'Show status of all integrations',
        icon: '📊',
        flags: [
          { name: '--json', description: 'Output in JSON format', type: 'boolean' },
        ],
      },
    ],
  },

  // --- mcp ---
  {
    name: 'mcp',
    description: 'Manage Model Context Protocol servers',
    icon: '🌐',
    aliases: [],
    args: [],
    flags: [],
    subcommands: [
      {
        name: 'list',
        description: 'List configured MCP servers',
        icon: '📋',
        flags: [
          { name: '--json', description: 'Output in JSON format', type: 'boolean' },
        ],
      },
      {
        name: 'add',
        description: 'Add a new MCP server',
        icon: '➕',
        args: [
          { name: 'name', description: 'Server name', type: 'string', required: true },
        ],
        flags: [
          { name: '--command', description: 'Command to start the server', type: 'string' },
          { name: '--args', description: 'Arguments for the server command', type: 'string' },
          { name: '--env', description: 'Environment variables (KEY=VALUE)', type: 'string' },
          { name: '--scope', description: 'Configuration scope (user/workspace)', type: 'string', default: 'user' },
        ],
      },
      {
        name: 'remove',
        description: 'Remove an MCP server',
        icon: '🗑️',
        args: [
          { name: 'name', description: 'Server name to remove', type: 'string', required: true },
        ],
      },
      {
        name: 'config',
        description: 'Open MCP configuration file',
        icon: '⚙️',
        flags: [
          { name: '--scope', description: 'Config scope (user/workspace)', type: 'string', default: 'user' },
        ],
      },
    ],
  },

  // --- hook ---
  {
    name: 'hook',
    description: 'Manage lifecycle hooks for agent events',
    icon: '🪝',
    aliases: [],
    args: [],
    flags: [],
    subcommands: [
      {
        name: 'list',
        description: 'List all configured hooks',
        icon: '📋',
        flags: [
          { name: '--json', description: 'Output in JSON format', type: 'boolean' },
        ],
      },
      {
        name: 'add',
        description: 'Add a new hook',
        icon: '➕',
        args: [
          { name: 'event', description: 'Event to hook (AgentSpawn, PreToolUse, PostToolUse, Stop, UserPromptSubmit)', type: 'string', required: true },
        ],
        flags: [
          { name: '--command', description: 'Command to execute on event', type: 'string' },
          { name: '--description', description: 'Hook description', alias: '-d', type: 'string' },
        ],
      },
      {
        name: 'remove',
        description: 'Remove a hook',
        icon: '🗑️',
        args: [
          { name: 'id', description: 'Hook ID to remove', type: 'string', required: true },
        ],
      },
      {
        name: 'test',
        description: 'Test a hook by simulating an event',
        icon: '🧪',
        args: [
          { name: 'id', description: 'Hook ID to test', type: 'string', required: true },
        ],
      },
    ],
  },

  // --- doctor ---
  {
    name: 'doctor',
    description: 'Run diagnostics and health checks',
    icon: '🩺',
    aliases: ['diag'],
    args: [],
    flags: [
      { name: '--fix', description: 'Attempt to fix issues automatically', type: 'boolean' },
      { name: '--json', description: 'Output in JSON format', type: 'boolean' },
      { name: '--verbose', description: 'Show detailed diagnostics', alias: '-v', type: 'boolean' },
    ],
    subcommands: [],
  },

  // --- whoami ---
  {
    name: 'whoami',
    description: 'Display current user and environment info',
    icon: '👤',
    aliases: [],
    args: [],
    flags: [
      { name: '--json', description: 'Output in JSON format', type: 'boolean' },
    ],
    subcommands: [],
  },

  // --- settings ---
  {
    name: 'settings',
    description: 'Open inline settings panel',
    icon: '⚙️',
    aliases: ['config', 'preferences'],
    args: [],
    flags: [
      { name: '--non-interactive', description: 'Print settings as JSON (no TUI)', type: 'boolean' },
      { name: '--get', description: 'Get a specific setting value', type: 'string' },
      { name: '--set', description: 'Set a value (key=value)', type: 'string' },
      { name: '--reset', description: 'Reset all settings to defaults', type: 'boolean' },
    ],
    subcommands: [],
  },

  // --- demo ---
  {
    name: 'demo',
    description: 'Launch interactive autocomplete demo mode',
    icon: '🎮',
    aliases: [],
    args: [],
    flags: [
      { name: '--spec', description: 'Demo a specific spec (git, npm, docker, etc.)', type: 'string' },
    ],
    subcommands: [],
    hidden: false,
  },

  // --- completion ---
  {
    name: 'completion',
    description: 'Generate shell completion script',
    icon: '📜',
    aliases: [],
    args: [],
    flags: [
      { name: '--shell', description: 'Target shell (zsh, bash, fish)', type: 'string' },
    ],
    subcommands: [],
  },
];

/**
 * Find a command by name or alias.
 * @param {string} name
 * @returns {Command | undefined}
 */
export function findCommand(name) {
  return commands.find(c =>
    c.name === name || (c.aliases && c.aliases.includes(name))
  );
}

/**
 * Find a subcommand within a parent command.
 * @param {Command} parent
 * @param {string} name
 * @returns {Command | undefined}
 */
export function findSubcommand(parent, name) {
  if (!parent.subcommands) return undefined;
  return parent.subcommands.find(s => s.name === name);
}

/**
 * Get all visible (non-hidden) commands.
 * @returns {Command[]}
 */
export function getVisibleCommands() {
  return commands.filter(c => !c.hidden);
}

/**
 * Get all command names and aliases for top-level completion.
 * @returns {string[]}
 */
export function getAllCommandNames() {
  const names = [];
  for (const cmd of commands) {
    if (!cmd.hidden) {
      names.push(cmd.name);
      if (cmd.aliases) names.push(...cmd.aliases);
    }
  }
  return names;
}

/**
 * Flatten all commands and subcommands into a flat list.
 * @param {Command[]} cmds
 * @param {string} prefix
 * @returns {Array<{ path: string, command: Command }>}
 */
export function flattenCommands(cmds = commands, prefix = '') {
  const result = [];
  for (const cmd of cmds) {
    const path = prefix ? `${prefix} ${cmd.name}` : cmd.name;
    result.push({ path, command: cmd });
    if (cmd.subcommands) {
      result.push(...flattenCommands(cmd.subcommands, path));
    }
  }
  return result;
}
