import { loadAllSpecs, getLoadedSpecNames } from '../autocomplete/spec-loader.js';
import { getSuggestions } from '../core/suggestion-engine.js';
import { getRecentCommands, addToHistory } from '../core/history.js';
import { drawDropdown, clearDropdown } from '../autocomplete/dropdown.js';
import { computeGhostSuggestion, displayGhostText, clearGhostText } from '../autocomplete/ghost-text.js';
import { loadConfig } from '../settings/config-store.js';
import { resolveAction } from '../shell/keybindings.js';
import { toggleToolbar } from '../toolbar/toolbar-icon.js';
import { write, writeLine, getTerminalSize, enterRawMode, readKey, replaceLine } from '../utils/terminal.js';
import { RESET, BOLD, DIM, FG, fgRgb, screen, cursor } from '../utils/ansi.js';
import { spawnSync } from 'child_process';
import { chdir } from 'process';
import { basename } from 'path';
import { homedir } from 'os';
import { initSystray, destroySystray } from '../toolbar/systray.js';

export async function execute(args, flags) {
  const config = loadConfig();
  const specs = loadAllSpecs();
  const history = getRecentCommands();
  const { columns } = getTerminalSize();

  writeLine('');
  writeLine(`  ${BOLD}${fgRgb(137, 180, 250)}  ___                _ `);
  writeLine(`  ${BOLD}${fgRgb(158, 169, 249)} / _ \\ _ __ ___  _ __(_)`);
  writeLine(`  ${BOLD}${fgRgb(180, 158, 248)}| | | | '_ \` _ \\| '_ \\ |`);
  writeLine(`  ${BOLD}${fgRgb(201, 147, 247)}| |_| | | | | | | | | | |`);
  writeLine(`  ${BOLD}${fgRgb(223, 136, 246)} \\___/|_| |_| |_|_| |_|_|${RESET}`);
  writeLine('');
  writeLine(`  ${DIM}Omni Interactive Shell — press Ctrl+D to exit.${RESET}`);
  writeLine('');

  // Start the Menubar System Tray
  initSystray();

  let cleanup = enterRawMode();
  let inputBuffer = '';
  let suggestions = [];
  let selectedIndex = 0;
  let dropdownLines = 0;
  let ghostLength = 0;

  const getPrompt = () => {
    let cwd = process.cwd();
    const home = homedir();
    if (cwd.startsWith(home)) {
      cwd = '~' + cwd.slice(home.length);
    }
    const dir = basename(cwd) || cwd;
    return `  ${FG.cyan}${dir} ❯${RESET} `;
  };

  write(getPrompt());

  try {
    while (true) {
      const key = await readKey();
      const action = resolveAction(key);

      switch (action) {
        case 'exit':
          clearDropdown(dropdownLines);
          writeLine('\n');
          cleanup();
          destroySystray();
          return;
          
        case 'interrupt':
          clearDropdown(dropdownLines);
          clearGhostText(ghostLength);
          dropdownLines = 0;
          ghostLength = 0;
          inputBuffer = '';
          writeLine('');
          write(getPrompt());
          break;

        case 'insert-char':
          inputBuffer += key.name;
          clearGhostText(ghostLength);
          ghostLength = 0;

          replaceLine(getPrompt() + inputBuffer);

          suggestions = getSuggestions(inputBuffer, { specs, history });
          selectedIndex = 0;

          if (config.ghostTextEnabled !== false && suggestions.length > 0) {
            const ghost = computeGhostSuggestion(suggestions, inputBuffer);
            if (ghost) {
              displayGhostText(ghost.ghostPart);
              ghostLength = ghost.ghostPart.length;
            }
          }

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

            replaceLine(getPrompt() + inputBuffer);

            if (inputBuffer.length > 0) {
              suggestions = getSuggestions(inputBuffer, { specs, history });
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
            const textToInsert = selected.insertValue || selected.insertText || selected.text;
            const lastSpace = inputBuffer.lastIndexOf(' ');
            if (lastSpace !== -1 && !inputBuffer.endsWith(' ')) {
              inputBuffer = inputBuffer.slice(0, lastSpace + 1) + textToInsert + ' ';
            } else if (inputBuffer.endsWith(' ')) {
              inputBuffer += textToInsert + ' ';
            } else {
              inputBuffer = textToInsert + ' ';
            }

            clearGhostText(ghostLength);
            ghostLength = 0;
            clearDropdown(dropdownLines);
            dropdownLines = 0;

            replaceLine(getPrompt() + inputBuffer);

            suggestions = getSuggestions(inputBuffer, { specs, history });
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
              replaceLine(getPrompt() + inputBuffer);
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
          
          const cmdToRun = inputBuffer.trim();
          writeLine(''); // move below prompt
          
          if (cmdToRun) {
            addToHistory(cmdToRun);
            
            // Exit raw mode before executing child process so it has full TTY control
            cleanup();
            
            // Intercept cd commands manually
            if (cmdToRun.startsWith('cd ')) {
               const target = cmdToRun.slice(3).trim();
               try {
                 chdir(target.replace(/^~/, homedir()));
               } catch (e) {
                 console.log(`cd: ${e.message}`);
               }
            } else {
               // Execute in standard shell
               try {
                 spawnSync(cmdToRun, {
                   stdio: 'inherit',
                   shell: process.env.SHELL || true
                 });
               } catch (e) {
                 console.log(`Error: ${e.message}`);
               }
            }
            
            // Re-enter raw mode after execution completes
            cleanup = enterRawMode();
          }

          inputBuffer = '';
          suggestions = [];
          selectedIndex = 0;
          writeLine('');
          write(getPrompt());
          break;

        case 'force-complete':
          suggestions = getSuggestions(inputBuffer || '', { specs, history });
          selectedIndex = 0;
          if (suggestions.length > 0) {
            clearDropdown(dropdownLines);
            dropdownLines = drawDropdown(suggestions, selectedIndex);
          }
          break;

        case 'clear-screen':
          write(screen.clear + cursor.moveTo(1, 1));
          write(getPrompt() + inputBuffer);
          break;

        case 'clear-line':
          inputBuffer = '';
          suggestions = [];
          clearDropdown(dropdownLines);
          clearGhostText(ghostLength);
          dropdownLines = 0;
          ghostLength = 0;
          replaceLine(getPrompt());
          break;

        case 'toggle-settings':
          clearDropdown(dropdownLines);
          dropdownLines = 0;
          writeLine('\n');
          const visible = toggleToolbar();
          writeLine(`  ${visible ? FG.green + '●' : FG.gray + '○'} ${RESET}Toolbar ${visible ? 'visible' : 'hidden'}`);
          writeLine('');
          write(getPrompt() + inputBuffer);
          break;

        default:
          if (key.name === 'space' || key.name === ' ') {
            inputBuffer += ' ';
            clearGhostText(ghostLength);
            ghostLength = 0;
            replaceLine(getPrompt() + inputBuffer);

            suggestions = getSuggestions(inputBuffer, { specs, history });
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
    destroySystray();
    writeLine(`\n  ${FG.red}Error:${RESET} ${err.message}\n`);
  }
}
