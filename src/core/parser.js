/**
 * Input Parser — tokenizes raw input into structured command components.
 * Handles quoted strings, flags, partial input for autocomplete mid-typing.
 */

/**
 * @typedef {Object} ParsedInput
 * @property {string[]} tokens - All whitespace-separated tokens
 * @property {string} command - The first token (command name)
 * @property {string[]} subcommands - Subsequent non-flag, non-arg tokens matched as subcommands
 * @property {string[]} args - Positional arguments
 * @property {Object<string, string|boolean>} flags - Parsed flags (--key=value or --flag)
 * @property {string} partial - The incomplete token being typed (empty if cursor after space)
 * @property {boolean} trailingSpace - Whether there's a trailing space (new token context)
 * @property {number} cursorTokenIndex - Which token the cursor is in/after
 * @property {string} raw - The original raw input
 */

/**
 * Parse raw input into structured components.
 * @param {string} input - The raw command line input
 * @returns {ParsedInput}
 */
export function parseInput(input) {
  const raw = input;
  const trailingSpace = input.endsWith(' ');
  const tokens = tokenize(input);

  const result = {
    tokens,
    command: tokens[0] || '',
    subcommands: [],
    args: [],
    flags: {},
    partial: trailingSpace ? '' : (tokens[tokens.length - 1] || ''),
    trailingSpace,
    cursorTokenIndex: trailingSpace ? tokens.length : Math.max(0, tokens.length - 1),
    raw,
  };

  // Parse flags and separate args
  for (let i = 1; i < tokens.length; i++) {
    const token = tokens[i];

    if (token.startsWith('--')) {
      const eqIndex = token.indexOf('=');
      if (eqIndex !== -1) {
        const key = token.slice(0, eqIndex);
        const value = token.slice(eqIndex + 1);
        result.flags[key] = value;
      } else {
        result.flags[token] = true;
      }
    } else if (token.startsWith('-') && token.length === 2) {
      result.flags[token] = true;
    } else {
      result.args.push(token);
    }
  }

  // First arg(s) may be subcommands — stored in args, caller resolves
  result.subcommands = [...result.args];

  return result;
}

/**
 * Tokenize input respecting quoted strings.
 * @param {string} input
 * @returns {string[]}
 */
export function tokenize(input) {
  const tokens = [];
  let current = '';
  let inSingleQuote = false;
  let inDoubleQuote = false;
  let escaped = false;

  for (let i = 0; i < input.length; i++) {
    const char = input[i];

    if (escaped) {
      current += char;
      escaped = false;
      continue;
    }

    if (char === '\\') {
      escaped = true;
      continue;
    }

    if (char === "'" && !inDoubleQuote) {
      inSingleQuote = !inSingleQuote;
      continue;
    }

    if (char === '"' && !inSingleQuote) {
      inDoubleQuote = !inDoubleQuote;
      continue;
    }

    if (char === ' ' && !inSingleQuote && !inDoubleQuote) {
      if (current.length > 0) {
        tokens.push(current);
        current = '';
      }
      continue;
    }

    current += char;
  }

  if (current.length > 0) {
    tokens.push(current);
  }

  return tokens;
}

/**
 * Determine what autocomplete context the cursor is in.
 * @param {ParsedInput} parsed
 * @param {import('./command-registry.js').Command[]} commandTree
 * @param {object} registry - Object with findCommand and findSubcommand functions
 * @returns {{ type: 'command' | 'subcommand' | 'flag' | 'arg' | 'flag-value', context: object }}
 */
export function getCompletionContext(parsed, commandTree, registry) {
  const { tokens, partial, trailingSpace } = parsed;

  // No input yet — suggest all commands
  if (tokens.length === 0) {
    return { type: 'command', context: { commands: commandTree } };
  }

  const cmd = registry.findCommand(tokens[0]);

  // Still typing the first token (command name)
  if (tokens.length === 1 && !trailingSpace) {
    return { type: 'command', context: { commands: commandTree, partial } };
  }

  if (!cmd) {
    return { type: 'command', context: { commands: commandTree, partial: tokens[0] } };
  }

  // Resolve subcommand chain
  let currentCmd = cmd;
  let tokenIdx = 1;

  while (tokenIdx < tokens.length) {
    const token = tokens[tokenIdx];
    if (token.startsWith('-')) break;

    if (currentCmd.subcommands && currentCmd.subcommands.length > 0) {
      const sub = registry.findSubcommand(currentCmd, token);
      if (sub) {
        currentCmd = sub;
        tokenIdx++;
        continue;
      }
    }
    break;
  }

  // Determine context at cursor position
  const currentToken = trailingSpace ? '' : (tokens[tokens.length - 1] || '');

  // Typing a flag
  if (currentToken.startsWith('-') && !trailingSpace) {
    return {
      type: 'flag',
      context: { command: currentCmd, partial: currentToken },
    };
  }

  // After a space following a flag that takes a value
  if (trailingSpace && tokens.length >= 2) {
    const prevToken = tokens[tokens.length - 1];
    if (prevToken.startsWith('-')) {
      const flagDef = currentCmd.flags?.find(f =>
        f.name === prevToken || f.alias === prevToken
      );
      if (flagDef && flagDef.type === 'string') {
        return {
          type: 'flag-value',
          context: { command: currentCmd, flag: flagDef },
        };
      }
    }
  }

  // Suggest subcommands if available
  if (currentCmd.subcommands && currentCmd.subcommands.length > 0) {
    return {
      type: 'subcommand',
      context: { command: currentCmd, partial: trailingSpace ? '' : currentToken },
    };
  }

  // Suggest args
  return {
    type: 'arg',
    context: { command: currentCmd, partial: trailingSpace ? '' : currentToken },
  };
}

/**
 * Synchronous completion context (doesn't resolve commands — just tokenizes).
 * For use by the suggestion engine which handles command resolution itself.
 */
export function getTokenContext(parsed) {
  const { tokens, partial, trailingSpace } = parsed;

  if (tokens.length === 0) {
    return { depth: 0, partial: '', trailingSpace: true };
  }

  return {
    depth: trailingSpace ? tokens.length : tokens.length - 1,
    partial: trailingSpace ? '' : partial,
    trailingSpace,
    tokens,
  };
}
