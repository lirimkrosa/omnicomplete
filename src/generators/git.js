/**
 * Git Generators — dynamic suggestions for git branches and remotes.
 */

import { execSync } from 'child_process';

const EXEC_OPTS = { stdio: ['ignore', 'pipe', 'ignore'], encoding: 'utf8', timeout: 500 };

/**
 * Generate suggestions for local git branches.
 */
export function generateGitBranches() {
  try {
    const out = execSync('git branch --format="%(refname:short)"', EXEC_OPTS);
    return out.split('\n').map(b => b.trim()).filter(Boolean).map(branch => ({
      text: branch,
      description: 'Local branch',
      type: 'arg',
      icon: '🌿',
      score: 75,
    }));
  } catch {
    return [];
  }
}

/**
 * Generate suggestions for git remotes.
 */
export function generateGitRemotes() {
  try {
    const out = execSync('git remote', EXEC_OPTS);
    return out.split('\n').map(r => r.trim()).filter(Boolean).map(remote => ({
      text: remote,
      description: 'Git remote',
      type: 'arg',
      icon: '☁️',
      score: 75,
    }));
  } catch {
    return [];
  }
}
