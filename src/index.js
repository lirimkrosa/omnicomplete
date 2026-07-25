/**
 * Main Orchestrator — routes commands, manages the interactive demo,
 * and coordinates between autocomplete, settings, and toolbar.
 */
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

import { commands, findCommand, findSubcommand, getVisibleCommands, flattenCommands, globalFlags } from './core/command-registry.js';
import { parseInput } from './core/parser.js';
import { getSuggestions } from './core/suggestion-engine.js';
import { loadHistory, addToHistory, getRecentCommands } from './core/history.js';
import { loadAllSpecs, getLoadedSpecNames, getSpecCount } from './autocomplete/spec-loader.js';
import { renderDropdown, drawDropdown, clearDropdown } from './autocomplete/dropdown.js';
import { computeGhostSuggestion, displayGhostText, clearGhostText } from './autocomplete/ghost-text.js';
import { shouldTrigger, debounceTrigger, cancelTrigger, configureTrigger } from './autocomplete/trigger.js';
import { loadConfig } from './settings/config-store.js';
import { isToolbarVisible, toggleToolbar, showToolbar } from './toolbar/toolbar-icon.js';
import { renderCompactToolbar, renderStatusBar } from './toolbar/renderer.js';
import { resolveAction } from './shell/keybindings.js';
import { RESET, BOLD, DIM, FG, BG, box, cursor, screen, style, fgRgb, bgRgb } from './utils/ansi.js';
import { write, writeLine, getTerminalSize, enterRawMode, readKey, replaceLine, printHeader, printSeparator, isTTY } from './utils/terminal.js';

/**
 * Display the help screen.
 */
export function showHelp() {
  const { columns } = getTerminalSize();
  const width = Math.min(columns - 4, 75);

  writeLine('');
  writeLine(`  ${BOLD}${fgRgb(137, 180, 250)}╭${'─'.repeat(width)}╮${RESET}`);
  writeLine(`  ${BOLD}${fgRgb(137, 180, 250)}│${RESET}  ${BOLD}${fgRgb(203, 166, 247)}Omni Autocomplete${RESET} ${DIM}v1.0.0${RESET}${' '.repeat(width - 27)}${BOLD}${fgRgb(137, 180, 250)}│${RESET}`);
  writeLine(`  ${BOLD}${fgRgb(137, 180, 250)}│${RESET}  ${DIM}Kiro-compatible CLI autocomplete — no auth required${RESET}${' '.repeat(Math.max(0, width - 54))}${BOLD}${fgRgb(137, 180, 250)}│${RESET}`);
  writeLine(`  ${BOLD}${fgRgb(137, 180, 250)}╰${'─'.repeat(width)}╯${RESET}`);
  writeLine('');

  writeLine(`  ${BOLD}USAGE${RESET}`);
  writeLine(`    ${FG.cyan}omni${RESET} ${DIM}<command>${RESET} ${DIM}[options]${RESET}`);
  writeLine('');

  writeLine(`  ${BOLD}COMMANDS${RESET}`);
  const visible = getVisibleCommands();
  const maxNameLen = Math.max(...visible.map(c => c.name.length));

  for (const cmd of visible) {
    const icon = cmd.icon || '  ';
    const name = cmd.name.padEnd(maxNameLen + 2);
    const aliases = cmd.aliases?.length ? `${DIM}(${cmd.aliases.join(', ')})${RESET}` : '';
    writeLine(`    ${icon}  ${FG.cyan}${name}${RESET} ${cmd.description} ${aliases}`);
  }
  writeLine('');

  writeLine(`  ${BOLD}GLOBAL FLAGS${RESET}`);
  for (const flag of globalFlags) {
    const alias = flag.alias ? `${DIM}, ${flag.alias}${RESET}` : '';
    writeLine(`    ${FG.yellow}${flag.name}${RESET}${alias}  ${DIM}${flag.description}${RESET}`);
  }
  writeLine('');

  writeLine(`  ${BOLD}AUTOCOMPLETE${RESET}`);
  writeLine(`    Install shell integration:  ${FG.cyan}omni integrations install autocomplete${RESET}`);
  writeLine(`    Try interactive demo:        ${FG.cyan}omni demo${RESET}`);
  writeLine(`    Open settings:               ${FG.cyan}omni settings${RESET}`);
  writeLine('');

  const specNames = getLoadedSpecNames();
  if (specNames.length > 0) {
    writeLine(`  ${BOLD}LOADED SPECS${RESET}  ${DIM}(${specNames.length})${RESET}`);
    writeLine(`    ${specNames.join(', ')}`);
    writeLine('');
  }
}

/**
 * Show version info.
 */
export function showVersion() {
  try {
    const __dirname = dirname(fileURLToPath(import.meta.url));
    const pkgPath = join(__dirname, '../package.json');
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
    writeLine(`omni v${pkg.version}`);
  } catch {
    writeLine(`omni v1.0.0 (fallback)`);
  }
}

/**
 * Run the interactive autocomplete demo.
 */
export async function runDemo(specFilter = null) {
  const config = loadConfig();
  const specs = loadAllSpecs();
  const history = getRecentCommands();

  const filteredSpecs = specFilter
    ? specs.filter(s => s.name === specFilter)
    : specs;

  const { columns, rows } = getTerminalSize();
  const width = Math.min(columns - 4, 75);

  // Splash
  writeLine('');
  writeLine(`  ${BOLD}${fgRgb(203, 166, 247)}⌨️  Autocomplete Demo${RESET}`);
  writeLine(`  ${DIM}Type commands to see autocomplete in action.${RESET}`);
  writeLine(`  ${DIM}Try: git, npm, docker, aws, kubectl, or any built-in command.${RESET}`);
  writeLine(`  ${DIM}Press Ctrl+C to exit.${RESET}`);

  if (filteredSpecs.length > 0) {
    writeLine(`  ${DIM}Specs loaded: ${filteredSpecs.map(s => s.name).join(', ')}${RESET}`);
  }

  writeLine(`  ${fgRgb(137, 180, 250)}${'─'.repeat(width)}${RESET}`);
  writeLine('');

  // Interactive loop
  const cleanup = enterRawMode();
  let inputBuffer = '';
  let suggestions = [];
  let selectedIndex = 0;
  let dropdownLines = 0;
  let ghostLength = 0;

  const prompt = () => `  ${fgRgb(137, 180, 250)}❯${RESET} `;

  write(prompt());

  try {
    while (true) {
      const key = await readKey();
      const action = resolveAction(key);

      switch (action) {
        case 'interrupt':
        case 'exit':
          clearDropdown(dropdownLines);
          writeLine('\n');
          writeLine(`  ${FG.green}✓${RESET} Demo ended.\n`);
          cleanup();
          return;

        case 'insert-char':
          inputBuffer += key.name;
          clearGhostText(ghostLength);
          ghostLength = 0;

          // Render input
          replaceLine(prompt() + inputBuffer);

          // Get suggestions
          suggestions = getSuggestions(inputBuffer, { specs: filteredSpecs, history });
          selectedIndex = 0;

          // Show ghost text
          if (config.ghostTextEnabled !== false && suggestions.length > 0) {
            const ghost = computeGhostSuggestion(suggestions, inputBuffer);
            if (ghost) {
              displayGhostText(ghost.ghostPart);
              ghostLength = ghost.ghostPart.length;
            }
          }

          // Show dropdown
          if (suggestions.length > 0) {
            clearDropdown(dropdownLines);
            dropdownLines = drawDropdown(suggestions, selectedIndex);
          } else {
            clearDropdown(dropdownLines);
            dropdownLines = 0;
          }
          break;

        case 'delete-char':
          if (inputBuffer.length > 0) {
            inputBuffer = inputBuffer.slice(0, -1);
            clearGhostText(ghostLength);
            ghostLength = 0;

            replaceLine(prompt() + inputBuffer);

            if (inputBuffer.length > 0) {
              suggestions = getSuggestions(inputBuffer, { specs: filteredSpecs, history });
              selectedIndex = 0;

              if (config.ghostTextEnabled !== false && suggestions.length > 0) {
                const ghost = computeGhostSuggestion(suggestions, inputBuffer);
                if (ghost) {
                  displayGhostText(ghost.ghostPart);
                  ghostLength = ghost.ghostPart.length;
                }
              }

              clearDropdown(dropdownLines);
              dropdownLines = drawDropdown(suggestions, selectedIndex);
            } else {
              clearDropdown(dropdownLines);
              dropdownLines = 0;
              suggestions = [];
            }
          }
          break;

        case 'accept-suggestion':
          if (suggestions.length > 0) {
            const selected = suggestions[selectedIndex];
            // Replace last token with selected suggestion
            const lastSpace = inputBuffer.lastIndexOf(' ');
            if (lastSpace !== -1 && !inputBuffer.endsWith(' ')) {
              inputBuffer = inputBuffer.slice(0, lastSpace + 1) + selected.text + ' ';
            } else if (inputBuffer.endsWith(' ')) {
              inputBuffer += selected.text + ' ';
            } else {
              inputBuffer = selected.text + ' ';
            }

            clearGhostText(ghostLength);
            ghostLength = 0;
            clearDropdown(dropdownLines);
            dropdownLines = 0;

            replaceLine(prompt() + inputBuffer);

            // Refresh suggestions for new context
            suggestions = getSuggestions(inputBuffer, { specs: filteredSpecs, history });
            selectedIndex = 0;
            if (suggestions.length > 0) {
              dropdownLines = drawDropdown(suggestions, selectedIndex);
            }
          }
          break;

        case 'accept-ghost':
          if (ghostLength > 0 && suggestions.length > 0) {
            const ghost = computeGhostSuggestion(suggestions, inputBuffer);
            if (ghost) {
              inputBuffer += ghost.ghostPart;
              clearGhostText(ghostLength);
              ghostLength = 0;
              clearDropdown(dropdownLines);
              dropdownLines = 0;
              replaceLine(prompt() + inputBuffer);
            }
          }
          break;

        case 'previous-suggestion':
          if (suggestions.length > 0) {
            selectedIndex = (selectedIndex - 1 + suggestions.length) % suggestions.length;
            clearDropdown(dropdownLines);
            dropdownLines = drawDropdown(suggestions, selectedIndex);
          }
          break;

        case 'next-suggestion':
          if (suggestions.length > 0) {
            selectedIndex = (selectedIndex + 1) % suggestions.length;
            clearDropdown(dropdownLines);
            dropdownLines = drawDropdown(suggestions, selectedIndex);
          }
          break;

        case 'dismiss':
          clearDropdown(dropdownLines);
          clearGhostText(ghostLength);
          dropdownLines = 0;
          ghostLength = 0;
          suggestions = [];
          break;

        case 'execute':
          clearDropdown(dropdownLines);
          clearGhostText(ghostLength);
          dropdownLines = 0;
          ghostLength = 0;

          if (inputBuffer.trim()) {
            addToHistory(inputBuffer.trim());
            writeLine('');
            writeLine(`  ${DIM}→ ${inputBuffer.trim()}${RESET}`);
            writeLine('');
          }

          inputBuffer = '';
          suggestions = [];
          selectedIndex = 0;
          write(prompt());
          break;

        case 'force-complete':
          suggestions = getSuggestions(inputBuffer || '', { specs: filteredSpecs, history });
          selectedIndex = 0;
          if (suggestions.length > 0) {
            clearDropdown(dropdownLines);
            dropdownLines = drawDropdown(suggestions, selectedIndex);
          }
          break;

        case 'clear-screen':
          write(screen.clear + cursor.moveTo(1, 1));
          write(prompt() + inputBuffer);
          break;

        case 'clear-line':
          inputBuffer = '';
          suggestions = [];
          clearDropdown(dropdownLines);
          clearGhostText(ghostLength);
          dropdownLines = 0;
          ghostLength = 0;
          replaceLine(prompt());
          break;

        case 'toggle-settings':
          clearDropdown(dropdownLines);
          dropdownLines = 0;
          writeLine('\n');
          const visible = toggleToolbar();
          writeLine(`  ${visible ? FG.green + '●' : FG.gray + '○'} ${RESET}Toolbar ${visible ? 'visible' : 'hidden'}`);
          writeLine('');
          write(prompt() + inputBuffer);
          break;

        default:
          // Unhandled key — show as-is if it's a space
          if (key.name === 'space' || key.name === ' ') {
            inputBuffer += ' ';
            clearGhostText(ghostLength);
            ghostLength = 0;
            replaceLine(prompt() + inputBuffer);

            suggestions = getSuggestions(inputBuffer, { specs: filteredSpecs, history });
            selectedIndex = 0;
            if (suggestions.length > 0) {
              clearDropdown(dropdownLines);
              dropdownLines = drawDropdown(suggestions, selectedIndex);
            }
          }
          break;
      }
    }
  } catch (err) {
    cleanup();
    writeLine(`\n  ${FG.red}Error:${RESET} ${err.message}\n`);
  }
}

/**
 * Route and execute a command.
 * @param {string[]} argv - Process arguments
 */
export async function run(argv) {
  // Initialize specs
  loadAllSpecs();

  const args = argv.slice(2); // strip node & script
  if (args.length === 0) {
    const mod = await import('./commands/shell.js');
    await mod.execute([], {});
    return;
  }

  const firstArg = args[0];

  // Global flags
  if (firstArg === '--help' || firstArg === '-h') {
    showHelp();
    return;
  }
  if (firstArg === '--version' || firstArg === '-V') {
    showVersion();
    return;
  }

  // Parse flags from remaining args
  const parsed = parseInput(args.join(' '));

  // Find the command
  const cmd = findCommand(firstArg);
  if (!cmd) {
    writeLine(`\n  ${FG.red}✗${RESET} Unknown command: "${firstArg}"`);
    writeLine(`  ${DIM}Run 'omni --help' to see available commands.${RESET}\n`);
    process.exitCode = 1;
    return;
  }

  // Extract subcommand args (everything after the command name)
  const cmdArgs = args.slice(1).filter(a => !a.startsWith('-'));
  const flags = {};

  // Collect all flag definitions (including subcommand flags) for type lookup
  const allFlagDefs = [...(cmd.flags || []), ...globalFlags];
  if (cmd.subcommands) {
    for (const sub of cmd.subcommands) {
      if (sub.flags) allFlagDefs.push(...sub.flags);
      if (sub.subcommands) {
        for (const nested of sub.subcommands) {
          if (nested.flags) allFlagDefs.push(...nested.flags);
        }
      }
    }
  }

  for (let i = 1; i < args.length; i++) {
    if (args[i].startsWith('--')) {
      const eqIdx = args[i].indexOf('=');
      if (eqIdx !== -1) {
        flags[args[i].slice(0, eqIdx)] = args[i].slice(eqIdx + 1);
      } else if (i + 1 < args.length && !args[i + 1].startsWith('-')) {
        // Check if flag expects a value via registry, or use heuristic
        const flagDef = allFlagDefs.find(f => f.name === args[i] || f.alias === args[i]);
        if (flagDef && flagDef.type === 'boolean') {
          flags[args[i]] = true;
        } else {
          // Default: consume next arg as value (string-type or unknown flag)
          flags[args[i]] = args[i + 1];
          i++;
        }
      } else {
        flags[args[i]] = true;
      }
    } else if (args[i].startsWith('-') && args[i].length === 2) {
      flags[args[i]] = true;
    }
  }

  // Check for --help on any command
  if (flags['--help'] || flags['-h']) {
    showCommandHelp(cmd);
    return;
  }

  // Route to the command handler
  try {
    switch (cmd.name) {
      case 'daemon': {
        const mod = await import('./commands/daemon.js');
        await mod.execute(cmdArgs, flags);
        break;
      }
      case 'shell': {
        const mod = await import('./commands/shell.js');
        await mod.execute(cmdArgs, flags);
        break;
      }
      case 'chat': {
        const mod = await import('./commands/chat.js');
        await mod.execute(cmdArgs, flags);
        break;
      }
      case 'translate': {
        const mod = await import('./commands/translate.js');
        await mod.execute(cmdArgs, flags);
        break;
      }
      case 'inline': {
        const mod = await import('./commands/inline.js');
        await mod.execute(cmdArgs, flags);
        break;
      }
      case 'agent': {
        const mod = await import('./commands/agent.js');
        await mod.execute(cmdArgs, flags);
        break;
      }
      case 'integrations': {
        const mod = await import('./commands/integrations.js');
        await mod.execute(cmdArgs, flags);
        break;
      }
      case 'mcp': {
        const mod = await import('./commands/mcp.js');
        await mod.execute(cmdArgs, flags);
        break;
      }
      case 'hook': {
        const mod = await import('./commands/hook.js');
        await mod.execute(cmdArgs, flags);
        break;
      }
      case 'doctor': {
        const mod = await import('./commands/doctor.js');
        await mod.execute(cmdArgs, flags);
        break;
      }
      case 'whoami': {
        const mod = await import('./commands/whoami.js');
        await mod.execute(cmdArgs, flags);
        break;
      }
      case 'settings': {
        const mod = await import('./settings/settings-panel.js');
        await mod.execute(cmdArgs, flags);
        break;
      }
      case 'demo': {
        const specFilter = flags['--spec'] || null;
        await runDemo(specFilter);
        break;
      }
      case 'completion': {
        // Shell completion output for integration
        const input = flags['--input'] || '';
        const specs = loadAllSpecs();
        const suggestions = getSuggestions(input, { specs, history: getRecentCommands() });
        for (const s of suggestions) {
          writeLine(s.text);
        }
        break;
      }
      default:
        writeLine(`\n  ${FG.red}✗${RESET} Command "${cmd.name}" not implemented yet.\n`);
    }
  } catch (err) {
    writeLine(`\n  ${FG.red}✗ Error:${RESET} ${err.message}\n`);
    if (flags['--verbose'] || flags['-v']) {
      writeLine(`  ${DIM}${err.stack}${RESET}\n`);
    }
    process.exitCode = 1;
  }
}

/**
 * Show help for a specific command.
 * @param {import('./core/command-registry.js').Command} cmd
 */
function showCommandHelp(cmd) {
  writeLine('');
  writeLine(`  ${cmd.icon || ''}  ${BOLD}${FG.brightCyan}${cmd.name}${RESET} — ${cmd.description}`);

  if (cmd.aliases?.length) {
    writeLine(`  ${DIM}Aliases: ${cmd.aliases.join(', ')}${RESET}`);
  }

  writeLine('');
  writeLine(`  ${BOLD}USAGE${RESET}`);

  if (cmd.subcommands?.length) {
    writeLine(`    omni ${cmd.name} <subcommand> [options]`);
  } else if (cmd.args?.length) {
    const argStr = cmd.args.map(a => a.required ? `<${a.name}>` : `[${a.name}]`).join(' ');
    writeLine(`    omni ${cmd.name} ${argStr} [options]`);
  } else {
    writeLine(`    omni ${cmd.name} [options]`);
  }

  if (cmd.subcommands?.length) {
    writeLine('');
    writeLine(`  ${BOLD}SUBCOMMANDS${RESET}`);
    for (const sub of cmd.subcommands) {
      writeLine(`    ${FG.cyan}${sub.name.padEnd(18)}${RESET} ${sub.description}`);

      // Nested subcommands
      if (sub.subcommands?.length) {
        for (const nested of sub.subcommands) {
          writeLine(`      ${FG.gray}${nested.name.padEnd(16)}${RESET} ${DIM}${nested.description}${RESET}`);
        }
      }
    }
  }

  if (cmd.args?.length) {
    writeLine('');
    writeLine(`  ${BOLD}ARGUMENTS${RESET}`);
    for (const arg of cmd.args) {
      const req = arg.required ? `${FG.red}(required)${RESET}` : `${DIM}(optional)${RESET}`;
      writeLine(`    ${FG.magenta}${arg.name.padEnd(18)}${RESET} ${arg.description} ${req}`);
    }
  }

  if (cmd.flags?.length) {
    writeLine('');
    writeLine(`  ${BOLD}OPTIONS${RESET}`);
    for (const flag of cmd.flags) {
      const alias = flag.alias ? `, ${flag.alias}` : '';
      writeLine(`    ${FG.yellow}${(flag.name + alias).padEnd(22)}${RESET} ${flag.description}`);
    }
  }

  writeLine('');
}
