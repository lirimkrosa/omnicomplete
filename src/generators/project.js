/**
 * Project Generators — dynamic suggestions from local project files.
 * Handles npm scripts, Makefile targets, and file path completions.
 */

import { readFileSync, existsSync, readdirSync, statSync } from 'fs';
import { join, resolve, dirname } from 'path';

/**
 * Generate suggestions for package.json scripts.
 */
export function generateNpmScripts() {
  try {
    const pkgPath = join(process.cwd(), 'package.json');
    if (!existsSync(pkgPath)) return [];

    const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
    if (!pkg.scripts || typeof pkg.scripts !== 'object') return [];

    return Object.entries(pkg.scripts).map(([name, cmd]) => ({
      text: name,
      description: cmd.length > 50 ? cmd.substring(0, 47) + '...' : cmd,
      type: 'script',
      icon: '⚡',
      score: 75,
    }));
  } catch {
    return [];
  }
}

/**
 * Generate suggestions for Make targets.
 */
export function generateMakeTargets() {
  try {
    const makefilePath = join(process.cwd(), 'Makefile');
    if (!existsSync(makefilePath)) return [];

    const content = readFileSync(makefilePath, 'utf8');
    const suggestions = [];

    for (const line of content.split('\n')) {
      const match = line.match(/^([a-zA-Z0-9_-]+):/);
      if (match) {
        suggestions.push({
          text: match[1],
          description: 'Make target',
          type: 'arg',
          icon: '🛠️',
          score: 75,
        });
      }
    }
    return suggestions;
  } catch {
    return [];
  }
}

/**
 * Generate suggestions for file and directory paths.
 * @param {string} partial - The current partial input (e.g. 'src/co')
 * @param {object} ctx - Context with optional cwd
 */
export function generateFilePaths(partial, ctx) {
  try {
    const cwd = ctx?.cwd || process.cwd();

    // Determine the directory to read and the prefix
    let targetDir = cwd;
    let prefix = '';

    if (partial) {
      if (partial.endsWith('/')) {
        targetDir = resolve(cwd, partial);
        prefix = partial;
      } else if (partial.includes('/')) {
        targetDir = resolve(cwd, dirname(partial));
        prefix = dirname(partial) + '/';
      }
    }

    if (!existsSync(targetDir)) return [];

    const files = readdirSync(targetDir);
    const suggestions = [];

    for (const file of files) {
      // Skip hidden files unless explicitly requested
      if (file.startsWith('.') && !partial.startsWith('.')) continue;

      try {
        const fullPath = join(targetDir, file);
        const stats = statSync(fullPath);
        const isDir = stats.isDirectory();

        suggestions.push({
          text: prefix + file + (isDir ? '/' : ''),
          description: isDir ? 'Directory' : 'File',
          type: 'arg',
          icon: isDir ? '📁' : '📄',
          score: isDir ? 60 : 50,
        });
      } catch {
        // Ignore stat errors (e.g. broken symlinks)
      }
    }
    return suggestions;
  } catch {
    return [];
  }
}
