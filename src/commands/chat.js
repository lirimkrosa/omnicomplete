/**
 * Chat Command — starts an interactive AI chat session.
 * Supports session management (list, resume, delete).
 * No authentication required.
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, unlinkSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { RESET, BOLD, DIM, FG, BG, box, style } from '../utils/ansi.js';
import { writeLine, printHeader, printSeparator, enterRawMode, readKey, write, getTerminalSize } from '../utils/terminal.js';

const SESSIONS_DIR = join(homedir(), '.cli-autocomplete', 'sessions');

/**
 * Execute the chat command.
 * @param {string[]} args - Positional arguments
 * @param {object} flags - Parsed flags
 */
export async function execute(args, flags) {
  mkdirSync(SESSIONS_DIR, { recursive: true });

  if (flags['--list-sessions']) {
    return listSessions();
  }

  if (flags['--delete-session']) {
    return deleteSession(flags['--delete-session']);
  }

  if (flags['--resume']) {
    return resumeSession(flags['--resume']);
  }

  // Start new interactive chat
  const initialMessage = args.join(' ') || null;
  return startChat(initialMessage, flags);
}

function listSessions() {
  const sessions = getSessions();

  if (sessions.length === 0) {
    writeLine(`\n  ${FG.gray}No saved sessions.${RESET}`);
    writeLine(`  ${DIM}Start a new chat with: clia chat${RESET}\n`);
    return;
  }

  printHeader('  Chat Sessions');
  printSeparator(50);

  for (const session of sessions) {
    const date = new Date(session.timestamp).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
    });
    const messageCount = session.messages?.length || 0;
    const preview = session.messages?.[0]?.content?.slice(0, 40) || 'Empty session';

    writeLine(
      `  ${FG.brightCyan}${session.id}${RESET}  ${DIM}${date}${RESET}  ` +
      `${FG.gray}(${messageCount} messages)${RESET}`
    );
    writeLine(`  ${DIM}  ${preview}${session.messages?.[0]?.content?.length > 40 ? '…' : ''}${RESET}`);
    writeLine('');
  }

  writeLine(`  ${DIM}Resume with: clia chat --resume <session-id>${RESET}\n`);
}

function deleteSession(sessionId) {
  const filePath = join(SESSIONS_DIR, `${sessionId}.json`);
  if (existsSync(filePath)) {
    unlinkSync(filePath);
    writeLine(`\n  ${FG.green}✓${RESET} Session ${FG.cyan}${sessionId}${RESET} deleted.\n`);
  } else {
    writeLine(`\n  ${FG.red}✗${RESET} Session ${FG.cyan}${sessionId}${RESET} not found.\n`);
  }
}

function resumeSession(sessionId) {
  const filePath = join(SESSIONS_DIR, `${sessionId}.json`);
  if (!existsSync(filePath)) {
    writeLine(`\n  ${FG.red}✗${RESET} Session ${FG.cyan}${sessionId}${RESET} not found.\n`);
    return;
  }

  try {
    const data = JSON.parse(readFileSync(filePath, 'utf8'));
    writeLine(`\n  ${FG.green}↻${RESET} Resuming session ${FG.cyan}${sessionId}${RESET}\n`);

    // Show previous messages
    for (const msg of data.messages || []) {
      const prefix = msg.role === 'user' ? `${FG.brightCyan}You${RESET}` : `${FG.brightGreen}AI${RESET}`;
      writeLine(`  ${prefix}: ${msg.content}`);
    }
    writeLine('');

    startChat(null, {}, data);
  } catch {
    writeLine(`\n  ${FG.red}✗${RESET} Failed to load session.\n`);
  }
}

async function startChat(initialMessage, flags, existingSession = null) {
  const session = existingSession || {
    id: generateSessionId(),
    timestamp: Date.now(),
    messages: [],
    agent: flags['--agent'] || 'default',
    model: flags['--model'] || 'default',
  };

  const { columns } = getTerminalSize();
  const barWidth = Math.min(columns - 4, 70);

  writeLine('');
  writeLine(`  ${BOLD}${FG.brightCyan}╭${'─'.repeat(barWidth)}╮${RESET}`);
  writeLine(`  ${BOLD}${FG.brightCyan}│${RESET}  💬 ${BOLD}Chat Session${RESET}${' '.repeat(barWidth - 18)}${BOLD}${FG.brightCyan}│${RESET}`);
  writeLine(`  ${BOLD}${FG.brightCyan}│${RESET}  ${DIM}Agent: ${session.agent}  •  Model: ${session.model}${RESET}${' '.repeat(Math.max(0, barWidth - 30 - session.agent.length - session.model.length))}${BOLD}${FG.brightCyan}│${RESET}`);
  writeLine(`  ${BOLD}${FG.brightCyan}╰${'─'.repeat(barWidth)}╯${RESET}`);
  writeLine(`  ${DIM}Type your message. Press Ctrl+C to exit. Session auto-saves.${RESET}`);
  writeLine('');

  if (initialMessage) {
    processMessage(session, initialMessage);
  }

  // Interactive REPL
  const cleanup = enterRawMode();
  let inputBuffer = '';

  try {
    while (true) {
      write(`  ${FG.brightCyan}❯${RESET} `);

      // Simple line input in raw mode
      inputBuffer = '';
      while (true) {
        const key = await readKey();

        if (key.ctrl && key.name === 'c') {
          writeLine('');
          saveSession(session);
          writeLine(`\n  ${DIM}Session ${FG.cyan}${session.id}${RESET}${DIM} saved.${RESET}\n`);
          cleanup();
          return;
        }

        if (key.name === 'return') {
          writeLine('');
          break;
        }

        if (key.name === 'backspace') {
          if (inputBuffer.length > 0) {
            inputBuffer = inputBuffer.slice(0, -1);
            write('\b \b');
          }
          continue;
        }

        if (key.name.length === 1 && !key.ctrl && !key.meta) {
          inputBuffer += key.name;
          write(key.name);
        }
      }

      if (inputBuffer.trim()) {
        processMessage(session, inputBuffer.trim());
      }
    }
  } catch {
    cleanup();
  }
}

function processMessage(session, message) {
  // Store user message
  session.messages.push({ role: 'user', content: message, timestamp: Date.now() });

  // Generate a response (template-based — no external API)
  const response = generateResponse(message);
  session.messages.push({ role: 'assistant', content: response, timestamp: Date.now() });

  writeLine(`  ${FG.brightGreen}AI${RESET}: ${response}`);
  writeLine('');

  saveSession(session);
}

function generateResponse(message) {
  const lower = message.toLowerCase();

  // Pattern-matched responses for common queries
  if (lower.includes('help') || lower.includes('what can you')) {
    return 'I can help with: translating natural language to shell commands, ' +
           'managing agents, configuring integrations, and more. Try "clia translate" for commands.';
  }
  if (lower.includes('hello') || lower.includes('hi') || lower.includes('hey')) {
    return 'Hello! I\'m your CLI assistant. How can I help you today?';
  }
  if (lower.includes('how') && lower.includes('autocomplete')) {
    return 'Run "clia integrations install autocomplete" to set up shell autocomplete, ' +
           'or try "clia demo" for an interactive preview.';
  }
  if (lower.includes('git') || lower.includes('commit')) {
    return 'For git operations, try: "clia translate \'commit all changes with message\'"';
  }
  if (lower.includes('docker') || lower.includes('container')) {
    return 'For Docker: "clia translate \'list running containers\'" or use autocomplete with "docker" directly.';
  }
  if (lower.includes('settings') || lower.includes('config')) {
    return 'Open settings with "clia settings" or use "clia settings --get <key>" to read specific values.';
  }

  return `I understand your request: "${message}". ` +
         'In a full deployment, this would be processed by the configured AI backend. ' +
         'For now, try using "clia translate" for shell command generation.';
}

function saveSession(session) {
  try {
    mkdirSync(SESSIONS_DIR, { recursive: true });
    const filePath = join(SESSIONS_DIR, `${session.id}.json`);
    writeFileSync(filePath, JSON.stringify(session, null, 2), 'utf8');
  } catch {
    // Silent failure
  }
}

function getSessions() {
  try {
    if (!existsSync(SESSIONS_DIR)) return [];
    const files = readdirSync(SESSIONS_DIR).filter(f => f.endsWith('.json'));
    return files.map(f => {
      try {
        return JSON.parse(readFileSync(join(SESSIONS_DIR, f), 'utf8'));
      } catch {
        return null;
      }
    }).filter(Boolean).sort((a, b) => b.timestamp - a.timestamp);
  } catch {
    return [];
  }
}

function generateSessionId() {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let id = '';
  for (let i = 0; i < 8; i++) {
    id += chars[Math.floor(Math.random() * chars.length)];
  }
  return id;
}

export const meta = {
  name: 'chat',
  description: 'Start an interactive AI chat session',
};
