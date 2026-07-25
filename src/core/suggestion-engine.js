/**
 * Suggestion Engine — the brain of the autocomplete system.
 * Takes parsed input and returns ranked, context-aware suggestions.
 */

import { commands, findCommand, findSubcommand, globalFlags, getVisibleCommands } from './command-registry.js';
import { parseInput, getTokenContext } from './parser.js';
import { fuzzyFilter, highlightMatches } from '../utils/fuzzy.js';
import { runGenerator } from './generators.js';

/**
 * @typedef {Object} Suggestion
 * @property {string} text - The suggestion text to insert
 * @property {string} displayText - What to show in the dropdown (may include highlights)
 * @property {string} description - Description of the suggestion
 * @property {string} type - 'command' | 'subcommand' | 'flag' | 'arg' | 'spec-command' | 'spec-option' | 'history'
 * @property {string} icon - Display icon/emoji
 * @property {number} score - Relevance score
 * @property {number[]} matches - Matched character indices for highlighting
 */

/**
 * Generate suggestions for raw input.
 * @param {string} input - Raw command line input
 * @param {object} opts
 * @param {object[]} opts.specs - Loaded autocomplete specs
 * @param {string[]} opts.history - Command history entries
 * @param {number} opts.maxResults - Maximum suggestions
 * @returns {Suggestion[]}
 */
export function getSuggestions(input, opts = {}) {
  if (!input || input.trim() === '') {
    return [];
  }

  const { specs = [], history = [], maxResults = 12 } = opts;
  const parsed = parseInput(input);
  const ctx = getTokenContext(parsed);

  // Case 1: Empty input or first token — show top-level commands
  if (ctx.depth === 0) {
    let topLevel = suggestTopLevel(ctx.partial, history, maxResults);

    // If the user typed an exact command (e.g. "yarn") without a space,
    // inject its subcommands instantly instead of forcing them to type space.
    if (ctx.partial) {
      const exactSpec = specs.find(s => s.name === ctx.partial);
      if (exactSpec) {
        // Fake depth=1 to fetch the spec's subcommands
        const fakeCtx = { ...ctx, depth: 1, partial: '' };
        // We pretend they typed a trailing space so it evaluates as a confirmed token
        const specSuggestions = suggestFromSpec(exactSpec, { ...parsed, trailingSpace: true }, fakeCtx, maxResults);
        
        // Rewrite insertText so it correctly replaces "yarn" with "yarn start"
        specSuggestions.forEach(s => {
          s.insertText = `${exactSpec.name} ${s.text}`;
        });

        // Prepend the spec suggestions above top-level ones
        topLevel = [...specSuggestions, ...topLevel].slice(0, maxResults);
      }
    }

    return topLevel;
  }

  const firstToken = parsed.tokens[0];

  // Case 2: Check if the first token matches a loaded spec (e.g., "git", "npm")
  const spec = specs.find(s => s.name === firstToken);
  if (spec) {
    return suggestFromSpec(spec, parsed, ctx, maxResults);
  }

  // Case 3: Check if the first token is a built-in command
  const cmd = findCommand(firstToken);
  if (cmd) {
    return suggestForCommand(cmd, parsed, ctx, maxResults);
  }

  // Case 4: Unknown command — suggest from history and filepaths
  return suggestFallback(parsed, ctx, history, maxResults);
}

function suggestTopLevel(partial, history, maxResults) {
  // Disable global top-level suggestions (like history or internal omni commands).
  // Let Zsh's native completion handle executables in $PATH for the first word.
  return [];
}

/**
 * Suggest subcommands, flags, or args for a built-in command.
 */
function suggestForCommand(cmd, parsed, ctx, maxResults) {
  const suggestions = [];
  const tokens = parsed.tokens;

  // Walk subcommand chain
  let currentCmd = cmd;
  for (let i = 1; i < tokens.length; i++) {
    const token = tokens[i];
    if (token.startsWith('-')) continue;

    // Only walk confirmed subcommands (not partial last token)
    if (!parsed.trailingSpace && i === tokens.length - 1) break;

    if (currentCmd.subcommands) {
      const sub = findSubcommand(currentCmd, token);
      if (sub) {
        currentCmd = sub;
      }
    }
  }

  const partial = ctx.partial;

  // Suggest flags if partial starts with -
  if (partial.startsWith('-')) {
    const allFlags = [...(currentCmd.flags || []), ...globalFlags];
    const flagItems = allFlags.map(f => ({
      name: f.name,
      description: f.description,
      icon: '⚑',
      type: 'flag',
    }));

    const filtered = fuzzyFilter(partial, flagItems, { key: 'name', maxResults });
    for (const { item, score, matches } of filtered) {
      // Skip already-used flags
      if (parsed.flags[item.name]) continue;
      suggestions.push({
        text: item.name,
        displayText: highlightMatches(item.name, matches),
        description: item.description,
        type: item.type,
        icon: item.icon,
        score,
        matches,
      });
    }
    return suggestions.slice(0, maxResults);
  }

  // Suggest subcommands
  if (currentCmd.subcommands && currentCmd.subcommands.length > 0) {
    const subItems = currentCmd.subcommands.map(s => ({
      name: s.name,
      description: s.description,
      icon: s.icon || '📂',
      type: 'subcommand',
    }));

    if (partial) {
      const filtered = fuzzyFilter(partial, subItems, { key: 'name', maxResults });
      for (const { item, score, matches } of filtered) {
        suggestions.push({
          text: item.name,
          displayText: highlightMatches(item.name, matches),
          description: item.description,
          type: item.type,
          icon: item.icon,
          score,
          matches,
        });
      }
    } else {
      for (const item of subItems) {
        suggestions.push({
          text: item.name,
          displayText: item.name,
          description: item.description,
          type: item.type,
          icon: item.icon,
          score: 50,
          matches: [],
        });
      }
    }
  }

  // Also suggest flags (if we're not mid-partial that looks like subcommand)
  if (!partial || (!partial.startsWith('-') && currentCmd.subcommands?.length === 0)) {
    const allFlags = [...(currentCmd.flags || []), ...globalFlags];
    for (const f of allFlags.slice(0, 4)) {
      if (parsed.flags[f.name]) continue;
      suggestions.push({
        text: f.name,
        displayText: f.name,
        description: f.description,
        type: 'flag',
        icon: '⚑',
        score: 20,
        matches: [],
      });
    }
  }

  // Suggest argument placeholders
  if (currentCmd.args && currentCmd.args.length > 0 && (!currentCmd.subcommands || currentCmd.subcommands.length === 0)) {
    for (const arg of currentCmd.args) {
      suggestions.push({
        text: `<${arg.name}>`,
        displayText: `<${arg.name}>`,
        description: arg.description,
        type: 'arg',
        icon: '📝',
        score: 15,
        matches: [],
      });
    }
  }

  suggestions.sort((a, b) => b.score - a.score);
  return suggestions.slice(0, maxResults);
}

/**
 * Suggest from a Fig-compatible spec.
 */
function suggestFromSpec(spec, parsed, ctx, maxResults) {
  const suggestions = [];
  const tokens = parsed.tokens;
  const partial = ctx.partial;

  // Walk the spec subcommand tree
  let currentSpec = spec;
  for (let i = 1; i < tokens.length; i++) {
    const token = tokens[i];
    if (token.startsWith('-')) continue;
    if (!parsed.trailingSpace && i === tokens.length - 1) break;

    if (currentSpec.subcommands) {
      const sub = currentSpec.subcommands.find(s => s.name === token);
      if (sub) {
        currentSpec = sub;
      }
    }
  }

  // Suggest flag arguments (option values)
  const prevToken = parsed.trailingSpace
    ? tokens[tokens.length - 1]
    : (tokens.length >= 2 ? tokens[tokens.length - 2] : null);

  if (prevToken && prevToken.startsWith('-') && currentSpec.options && !partial.startsWith('-')) {
    const optDef = currentSpec.options.find(o => {
      const names = Array.isArray(o.name) ? o.name : [o.name];
      return names.includes(prevToken);
    });

    if (optDef && optDef.args) {
      const args = Array.isArray(optDef.args) ? optDef.args : [optDef.args];
      for (const arg of args) {
        if (arg.generators) {
          const generators = Array.isArray(arg.generators) ? arg.generators : [arg.generators];
          for (const gen of generators) {
            if (gen.custom) {
              const genItems = runGenerator(gen.custom, { parsed, ctx });
              if (partial) {
                const filtered = fuzzyFilter(partial, genItems, { key: 'text', maxResults });
                for (const { item, score, matches } of filtered) {
                  suggestions.push({
                    text: item.text,
                    displayText: highlightMatches(item.text, matches),
                    description: item.description,
                    type: item.type || 'arg',
                    icon: item.icon || '📝',
                    score,
                    matches,
                  });
                }
              } else {
                for (const item of genItems) {
                  suggestions.push({
                    text: item.text,
                    displayText: item.text,
                    description: item.description,
                    type: item.type || 'arg',
                    icon: item.icon || '📝',
                    score: item.score || 75,
                    matches: [],
                  });
                }
              }
            }
          }
        }
      }
      if (suggestions.length > 0) return suggestions.slice(0, maxResults);
    }
  }

  // Suggest flags from spec
  if (!partial || partial.startsWith('-') || partial.startsWith('✨')) {
    const options = currentSpec.options || [];
    const optItems = options.map(o => {
      const name = typeof o.name === 'object' ? o.name[0] : o.name;
      return {
        name,
        description: o.description || '',
        icon: name.startsWith('✨') ? ' ' : '⚑',
        type: 'spec-option',
        insertValue: o.insertValue
      };
    });

    const filtered = fuzzyFilter(partial, optItems, { key: 'name', maxResults });
    for (const { item, score, matches } of filtered) {
      suggestions.push({
        text: item.name,
        displayText: highlightMatches(item.name, matches),
        description: item.description,
        type: item.type,
        icon: item.icon,
        score,
        matches,
        insertValue: item.insertValue,
      });
    }
    // Note: We don't return early here if partial doesn't strictly start with '-'
    // so we can still fall through to arguments if the user is typing something else.
    if (partial.startsWith('-') || partial.startsWith('✨')) {
      return suggestions.slice(0, maxResults);
    }
  }

  // Suggest subcommands from spec
  if (currentSpec.subcommands) {
    const subItems = currentSpec.subcommands.map(s => ({
      name: s.name,
      description: s.description || '',
      icon: '📂',
      type: 'spec-command',
    }));

    if (partial) {
      const filtered = fuzzyFilter(partial, subItems, { key: 'name', maxResults });
      for (const { item, score, matches } of filtered) {
        suggestions.push({
          text: item.name,
          displayText: highlightMatches(item.name, matches),
          description: item.description,
          type: item.type,
          icon: item.icon,
          score,
          matches,
        });
      }
    } else {
      for (const item of subItems) {
        suggestions.push({
          text: item.name,
          displayText: item.name,
          description: item.description,
          type: item.type,
          icon: item.icon,
          score: 50,
          matches: [],
        });
      }
    }
  }

  // (Options already handled in the block above)

  // Suggest dynamic arguments via generators
  if (currentSpec.args && (!partial.startsWith('-'))) {
    const args = Array.isArray(currentSpec.args) ? currentSpec.args : [currentSpec.args];
    for (const arg of args) {
      if (arg.generators) {
        const generators = Array.isArray(arg.generators) ? arg.generators : [arg.generators];
        for (const gen of generators) {
          if (gen.custom) {
            const genItems = runGenerator(gen.custom, { parsed, ctx });
            if (partial) {
              const filtered = fuzzyFilter(partial, genItems, { key: 'text', maxResults });
              for (const { item, score, matches } of filtered) {
                suggestions.push({
                  text: item.text,
                  displayText: highlightMatches(item.text, matches),
                  description: item.description,
                  type: item.type,
                  icon: item.icon,
                  score,
                  matches,
                });
              }
            } else {
              for (const item of genItems) {
                suggestions.push({
                  text: item.text,
                  displayText: item.text,
                  description: item.description,
                  type: item.type,
                  icon: item.icon,
                  score: item.score,
                  matches: [],
                });
              }
            }
          }
        }
      }
    }
  }

  suggestions.sort((a, b) => b.score - a.score);
  return suggestions.slice(0, maxResults);
}

/**
 * Suggest from command history and filepaths (fallback).
 */
function suggestFallback(parsed, ctx, history, maxResults) {
  const suggestions = [];
  const partial = ctx.partial;

  // 1. Get filepaths
  const fileItems = runGenerator('filepaths', { parsed, ctx });
  if (partial) {
    const filteredFiles = fuzzyFilter(partial, fileItems, { key: 'text', maxResults: Math.floor(maxResults / 2) });
    for (const { item, score, matches } of filteredFiles) {
      suggestions.push({
        text: item.text,
        displayText: highlightMatches(item.text, matches),
        description: item.description,
        type: item.type,
        icon: item.icon,
        score: score + 20, // Boost filepaths
        matches,
      });
    }
  } else {
    for (const item of fileItems.slice(0, Math.floor(maxResults / 2))) {
      suggestions.push({
        text: item.text,
        displayText: item.text,
        description: item.description,
        type: item.type,
        icon: item.icon,
        score: item.score,
        matches: [],
      });
    }
  }

  // 2. Get history
  if (history.length > 0) {
    const unique = [...new Set(history)];
    const items = unique.map(h => ({
      name: h,
      description: 'From history',
      icon: '🕐',
      type: 'history',
    }));

    const filtered = fuzzyFilter(parsed.raw, items, { key: 'name', maxResults: maxResults - suggestions.length });
    for (const { item, score, matches } of filtered) {
      suggestions.push({
        text: item.name,
        displayText: highlightMatches(item.name, matches),
        description: item.description,
        type: item.type,
        icon: item.icon,
        score,
        matches,
      });
    }
  }

  suggestions.sort((a, b) => b.score - a.score);
  return suggestions.slice(0, maxResults);
}
