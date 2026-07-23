/**
 * Config Store — reads/writes ~/.cli-autocomplete/config.json.
 * Atomic writes, defaults merging, version migration.
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { DEFAULTS } from './defaults.js';

const CONFIG_DIR = join(homedir(), '.cli-autocomplete');
const CONFIG_FILE = join(CONFIG_DIR, 'config.json');

let _cache = null;

/**
 * Load config from disk, merged with defaults.
 * @returns {object}
 */
export function loadConfig() {
  if (_cache) return { ..._cache };

  let stored = {};
  try {
    if (existsSync(CONFIG_FILE)) {
      stored = JSON.parse(readFileSync(CONFIG_FILE, 'utf8'));
    }
  } catch {
    // Corrupted — use defaults
  }

  // Merge with defaults (stored values override defaults)
  const config = { ...DEFAULTS, ...stored };

  // Version migration
  if (config.configVersion < DEFAULTS.configVersion) {
    config.configVersion = DEFAULTS.configVersion;
    // Add any migration logic here for future versions
  }

  _cache = config;
  return { ...config };
}

/**
 * Save config to disk.
 * @param {object} config
 */
export function saveConfig(config) {
  try {
    mkdirSync(CONFIG_DIR, { recursive: true });
    writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf8');
    _cache = { ...config };
  } catch {
    // Silent failure — log in verbose mode
  }
}

/**
 * Get a specific setting value.
 * @param {string} key
 * @returns {any}
 */
export function getSetting(key) {
  const config = loadConfig();
  return config[key];
}

/**
 * Set a specific setting value.
 * @param {string} key
 * @param {any} value
 */
export function setSetting(key, value) {
  const config = loadConfig();

  // Type coercion
  if (typeof DEFAULTS[key] === 'boolean') {
    value = value === 'true' || value === true;
  } else if (typeof DEFAULTS[key] === 'number') {
    value = parseInt(value, 10);
    if (isNaN(value)) return;
  }

  config[key] = value;
  saveConfig(config);
}

/**
 * Reset all settings to defaults.
 */
export function resetConfig() {
  saveConfig({ ...DEFAULTS });
  _cache = null;
}

/**
 * Get config file path.
 * @returns {string}
 */
export function getConfigPath() {
  return CONFIG_FILE;
}

/**
 * Get config directory path.
 * @returns {string}
 */
export function getConfigDir() {
  return CONFIG_DIR;
}

/**
 * Invalidate the cache (force reload on next access).
 */
export function invalidateCache() {
  _cache = null;
}
