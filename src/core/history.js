/**
 * Command History — tracks and persists command history.
 * Stores in ~/.cli-autocomplete/history.json
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

const CONFIG_DIR = join(homedir(), '.cli-autocomplete');
const HISTORY_FILE = join(CONFIG_DIR, 'history.json');
const MAX_HISTORY = 500;

/**
 * @typedef {Object} HistoryEntry
 * @property {string} command - The command string
 * @property {number} timestamp - Unix timestamp
 * @property {number} count - How many times this command was used
 */

let _cache = null;

/**
 * Load history from disk.
 * @returns {HistoryEntry[]}
 */
export function loadHistory() {
  if (_cache) return _cache;

  try {
    if (existsSync(HISTORY_FILE)) {
      const data = readFileSync(HISTORY_FILE, 'utf8');
      _cache = JSON.parse(data);
      return _cache;
    }
  } catch {
    // Corrupted file — reset
  }

  _cache = [];
  return _cache;
}

/**
 * Save history to disk.
 * @param {HistoryEntry[]} entries
 */
export function saveHistory(entries) {
  try {
    mkdirSync(CONFIG_DIR, { recursive: true });
    writeFileSync(HISTORY_FILE, JSON.stringify(entries, null, 2), 'utf8');
    _cache = entries;
  } catch {
    // Silent failure — non-critical
  }
}

/**
 * Add a command to history.
 * @param {string} command - The command string
 */
export function addToHistory(command) {
  const trimmed = command.trim();
  if (!trimmed) return;

  const entries = loadHistory();

  // Check if already exists — increment count
  const existing = entries.find(e => e.command === trimmed);
  if (existing) {
    existing.count++;
    existing.timestamp = Date.now();
  } else {
    entries.unshift({
      command: trimmed,
      timestamp: Date.now(),
      count: 1,
    });
  }

  // Cap history size
  if (entries.length > MAX_HISTORY) {
    entries.length = MAX_HISTORY;
  }

  // Sort by recency
  entries.sort((a, b) => b.timestamp - a.timestamp);

  saveHistory(entries);
}

/**
 * Get recent command strings.
 * @param {number} limit
 * @returns {string[]}
 */
export function getRecentCommands(limit = 50) {
  const entries = loadHistory();
  return entries.slice(0, limit).map(e => e.command);
}

/**
 * Get most frequently used commands.
 * @param {number} limit
 * @returns {string[]}
 */
export function getFrequentCommands(limit = 20) {
  const entries = loadHistory();
  const sorted = [...entries].sort((a, b) => b.count - a.count);
  return sorted.slice(0, limit).map(e => e.command);
}

/**
 * Search history.
 * @param {string} query
 * @returns {HistoryEntry[]}
 */
export function searchHistory(query) {
  const entries = loadHistory();
  const lowerQuery = query.toLowerCase();
  return entries.filter(e => e.command.toLowerCase().includes(lowerQuery));
}

/**
 * Clear all history.
 */
export function clearHistory() {
  saveHistory([]);
}

/**
 * Get history file path (for diagnostics).
 * @returns {string}
 */
export function getHistoryPath() {
  return HISTORY_FILE;
}
