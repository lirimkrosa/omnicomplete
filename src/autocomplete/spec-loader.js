/**
 * Spec Loader — loads Fig-compatible JSON autocomplete specs.
 * Searches:
 *  1. Built-in specs (src/specs/*.json)
 *  2. User custom specs (~/.cli-autocomplete/specs/)
 *  3. Legacy Fig path (~/.fig/autocomplete/build/)
 */

import { readFileSync, readdirSync, existsSync } from 'fs';
import { join, basename } from 'path';
import { homedir } from 'os';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

let currentDir;
try {
  currentDir = typeof __dirname !== 'undefined' ? __dirname : dirname(fileURLToPath(import.meta.url));
} catch (e) {
  // Fallback for esbuild CJS bundle
  currentDir = __dirname || process.cwd();
}

const devSpecDir = join(currentDir, '..', 'specs');
const prodSpecDir = join(currentDir, 'specs');
const BUILTIN_SPEC_DIR = existsSync(devSpecDir) ? devSpecDir : prodSpecDir;
const USER_SPEC_DIR = join(homedir(), '.cli-autocomplete', 'specs');
const LEGACY_FIG_DIR = join(homedir(), '.fig', 'autocomplete', 'build');

/**
 * @typedef {Object} SpecOption
 * @property {string|string[]} name - Option name(s)
 * @property {string} description - Description
 * @property {object[]} [args] - Arguments this option takes
 */

/**
 * @typedef {Object} Spec
 * @property {string} name - CLI tool name
 * @property {string} description - Description of the tool
 * @property {Spec[]} [subcommands] - Subcommands
 * @property {SpecOption[]} [options] - Available options/flags
 * @property {object[]} [args] - Positional arguments
 */

let _loadedSpecs = null;

/**
 * Load all available specs from all sources.
 * @returns {Spec[]}
 */
export function loadAllSpecs() {
  if (_loadedSpecs) return _loadedSpecs;

  const specs = [];
  const loaded = new Set();

  // 1. Built-in specs
  const builtinSpecs = loadSpecsFromDir(BUILTIN_SPEC_DIR);
  for (const spec of builtinSpecs) {
    specs.push(spec);
    loaded.add(spec.name);
  }

  // 2. User custom specs (override built-in)
  const userSpecs = loadSpecsFromDir(USER_SPEC_DIR);
  for (const spec of userSpecs) {
    if (loaded.has(spec.name)) {
      // Replace built-in with user spec
      const idx = specs.findIndex(s => s.name === spec.name);
      if (idx !== -1) specs[idx] = spec;
    } else {
      specs.push(spec);
    }
    loaded.add(spec.name);
  }

  // 3. Legacy Fig path
  const figSpecs = loadSpecsFromDir(LEGACY_FIG_DIR);
  for (const spec of figSpecs) {
    if (!loaded.has(spec.name)) {
      specs.push(spec);
      loaded.add(spec.name);
    }
  }

  _loadedSpecs = specs;
  return specs;
}

/**
 * Load specs from a directory.
 * @param {string} dir
 * @returns {Spec[]}
 */
function loadSpecsFromDir(dir) {
  const specs = [];

  if (!existsSync(dir)) return specs;

  try {
    const files = readdirSync(dir).filter(f => f.endsWith('.json'));

    for (const file of files) {
      try {
        const data = readFileSync(join(dir, file), 'utf8');
        const spec = JSON.parse(data);

        // Ensure spec has a name
        if (!spec.name) {
          spec.name = basename(file, '.json');
        }

        specs.push(spec);
      } catch {
        // Skip malformed specs
      }
    }
  } catch {
    // Directory read error — skip
  }

  return specs;
}

/**
 * Load a single spec by tool name.
 * @param {string} toolName
 * @returns {Spec | null}
 */
export function loadSpec(toolName) {
  const allSpecs = loadAllSpecs();
  return allSpecs.find(s => s.name === toolName) || null;
}

/**
 * Get the names of all loaded specs.
 * @returns {string[]}
 */
export function getLoadedSpecNames() {
  const allSpecs = loadAllSpecs();
  return allSpecs.map(s => s.name);
}

/**
 * Reload specs (clear cache).
 */
export function reloadSpecs() {
  _loadedSpecs = null;
}

/**
 * Get the search directories for diagnostics.
 * @returns {{ builtin: string, user: string, fig: string }}
 */
export function getSpecDirectories() {
  return {
    builtin: BUILTIN_SPEC_DIR,
    user: USER_SPEC_DIR,
    fig: LEGACY_FIG_DIR,
  };
}

/**
 * Count total specs available.
 * @returns {number}
 */
export function getSpecCount() {
  return loadAllSpecs().length;
}
