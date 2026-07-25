import http from 'http';
import { loadAllSpecs } from '../autocomplete/spec-loader.js';
import { getSuggestions } from '../core/suggestion-engine.js';
import { getRecentCommands, addToHistory } from '../core/history.js';
import { renderDropdown } from '../autocomplete/dropdown.js';
import { ansiToZshRegionHighlight } from '../utils/zsh-highlight.js';
import { loadConfig } from '../settings/config-store.js';

const PORT = 44044;
const sessions = new Map();
let specs = [];

function getSession(id) {
  if (!sessions.has(id)) {
    sessions.set(id, { buffer: '', suggestions: [], selectedIndex: 0 });
  }
  return sessions.get(id);
}

export async function execute(args, flags) {
  const subcommand = args[0];

  if (subcommand === 'stop') {
    try {
      const { execSync } = await import('child_process');
      execSync(`lsof -i :${PORT} | awk 'NR>1 {print $2}' | xargs kill -9 2>/dev/null`);
      console.log('✅ Omni daemon stopped successfully.');
    } catch {
      console.log('Daemon is not running.');
    }
    return;
  }

  if (subcommand === 'status') {
    try {
      const { execSync } = await import('child_process');
      const out = execSync(`lsof -i :${PORT} | awk 'NR>1 {print $2}'`, { encoding: 'utf8' }).trim();
      if (out) {
        console.log(`🟢 Omni daemon is running (PID: ${out})`);
      } else {
        console.log('🔴 Omni daemon is stopped.');
      }
    } catch {
      console.log('🔴 Omni daemon is stopped.');
    }
    return;
  }

  specs = loadAllSpecs();
  const config = loadConfig();
  const theme = config.layoutTheme || 'inline';
  const popoverBackground = config.popoverBackground || 'transparent';
  
  const server = http.createServer((req, res) => {
    // Only accept POST
    if (req.method !== 'POST') {
      res.writeHead(405);
      return res.end();
    }

    let body = '';
    req.on('data', chunk => body += chunk.toString());
    req.on('end', () => {
      try {
        const params = new URLSearchParams(body);
        const sessionId = params.get('session');
        const action = params.get('action');
        const newBuffer = params.get('buffer');
        const cwd = params.get('cwd');
        const shell = params.get('shell') || 'zsh';
        
        if (!sessionId) {
          res.writeHead(400);
          return res.end('Missing session');
        }

        if (cwd) {
          try {
            process.chdir(cwd);
          } catch (e) {
            // Ignore if directory doesn't exist anymore
          }
        }

        const state = getSession(sessionId);
        let responsePayload = { ansi: '', newBuffer: null };

        switch (action) {
          case 'type':
            state.buffer = newBuffer || '';
            state.suggestions = getSuggestions(state.buffer, { specs, history: getRecentCommands(), cwd });
            state.selectedIndex = 0;
            if (state.suggestions.length > 0) {
              responsePayload.ansi = renderDropdown(state.suggestions, state.selectedIndex, { theme, popoverBackground });
            }
            break;

          case 'next':
            if (state.suggestions.length > 0) {
              state.selectedIndex = (state.selectedIndex + 1) % state.suggestions.length;
              responsePayload.ansi = renderDropdown(state.suggestions, state.selectedIndex, { theme, popoverBackground });
            }
            break;

          case 'prev':
            if (state.suggestions.length > 0) {
              state.selectedIndex = (state.selectedIndex - 1 + state.suggestions.length) % state.suggestions.length;
              responsePayload.ansi = renderDropdown(state.suggestions, state.selectedIndex, { theme, popoverBackground });
            }
            break;

          case 'accept':
            if (state.suggestions.length > 0) {
              const selected = state.suggestions[state.selectedIndex];
              let buf = state.buffer;
              const textToInsert = selected.insertText || selected.text;
              const addSpace = selected.appendSpace !== false && !textToInsert.endsWith('/');
              const suffix = addSpace ? ' ' : '';
              
              const lastSpace = buf.lastIndexOf(' ');
              if (lastSpace !== -1 && !buf.endsWith(' ')) {
                buf = buf.slice(0, lastSpace + 1) + textToInsert + suffix;
              } else if (buf.endsWith(' ')) {
                buf += textToInsert + suffix;
              } else {
                buf = textToInsert + suffix;
              }
              
              state.buffer = buf;
              responsePayload.newBuffer = buf;
              
              // Refresh suggestions for the new buffer
              state.suggestions = getSuggestions(buf, { specs, history: getRecentCommands(), cwd });
              state.selectedIndex = 0;
              if (state.suggestions.length > 0) {
                responsePayload.ansi = renderDropdown(state.suggestions, state.selectedIndex, { theme });
              }
            }
            break;

          case 'execute':
            if (state.buffer.trim()) {
              addToHistory(state.buffer.trim());
            }
            state.buffer = '';
            state.suggestions = [];
            state.selectedIndex = 0;
            break;
            
          case 'dismiss':
            state.suggestions = [];
            state.selectedIndex = 0;
            break;
        }

        res.writeHead(200, { 'Content-Type': 'text/plain' });
        const bufStr = responsePayload.newBuffer !== null ? responsePayload.newBuffer : '__NO_CHANGE__';
        
        if (shell === 'zsh' && responsePayload.ansi) {
          const { plainString, highlights } = ansiToZshRegionHighlight(responsePayload.ansi, 0);
          res.write(`${bufStr}\n`);
          for (const hl of highlights) {
            res.write(`${hl}\n`);
          }
          res.write(`__END_HIGHLIGHTS__\n`);
          res.end(plainString);
        } else {
          res.end(`${bufStr}\n${responsePayload.ansi}`);
        }
      } catch (err) {
        res.writeHead(500);
        res.end(err.message);
      }
    });
  });

  server.listen(PORT, '127.0.0.1', () => {
    if (flags['--verbose'] || flags['-v']) {
      console.log(`[Omni Daemon] Listening on 127.0.0.1:${PORT}`);
    }
  });
}
