/**
 * Docker Generators — dynamic suggestions from the Docker daemon.
 * Handles containers, images, Dockerfile stages/ports/envs.
 */

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { execSync } from 'child_process';

const EXEC_OPTS = { stdio: ['ignore', 'pipe', 'ignore'], encoding: 'utf8', timeout: 500 };

/**
 * Generate suggestions for Docker containers.
 */
export function generateDockerContainers() {
  try {
    const out = execSync('docker ps -a --format "{{.Names}}\t{{.Status}}"', EXEC_OPTS);
    return out.split('\n').map(c => c.trim()).filter(Boolean).map(line => {
      const [name, status] = line.split('\t');
      return {
        text: name,
        description: status || 'Container',
        type: 'arg',
        icon: '🐳',
        score: 75,
      };
    });
  } catch {
    return [];
  }
}

/**
 * Generate suggestions for Docker images.
 */
export function generateDockerImages() {
  try {
    const out = execSync('docker images --format "{{.Repository}}:{{.Tag}}"', EXEC_OPTS);
    return out.split('\n')
      .map(i => i.trim())
      .filter(Boolean)
      .filter(i => i !== '<none>:<none>')
      .map(img => ({
        text: img,
        description: 'Docker image',
        type: 'arg',
        icon: '💿',
        score: 75,
      }));
  } catch {
    return [];
  }
}

/**
 * Parse a Dockerfile from the current working directory.
 * @returns {string|null} File content, or null if not found.
 */
function readDockerfile() {
  try {
    const path = join(process.cwd(), 'Dockerfile');
    return existsSync(path) ? readFileSync(path, 'utf8') : null;
  } catch {
    return null;
  }
}

/**
 * Generate suggestions for Dockerfile build stages (FROM ... AS stage).
 */
export function generateDockerStages() {
  const content = readDockerfile();
  if (!content) return [];

  const suggestions = [];
  const regex = /^FROM\s+.*?\s+AS\s+([a-zA-Z0-9_-]+)/gim;
  let match;
  while ((match = regex.exec(content)) !== null) {
    suggestions.push({
      text: match[1],
      description: 'Build stage',
      type: 'arg',
      icon: '🏗️',
      score: 75,
    });
  }
  return suggestions;
}

/**
 * Generate suggestions for Dockerfile exposed ports.
 */
export function generateDockerPorts() {
  const content = readDockerfile();
  if (!content) return [];

  const suggestions = [];
  const regex = /^EXPOSE\s+([0-9]+)/gim;
  let match;
  while ((match = regex.exec(content)) !== null) {
    suggestions.push({
      text: match[1],
      description: 'Exposed port',
      type: 'arg',
      icon: '🔌',
      score: 75,
    });
  }
  return suggestions;
}

/**
 * Generate suggestions for Dockerfile env variables.
 */
export function generateDockerEnvs() {
  const content = readDockerfile();
  if (!content) return [];

  const suggestions = [];
  const seen = new Set();
  const regex = /^ENV\s+([a-zA-Z_][a-zA-Z0-9_]*)/gim;
  let match;
  while ((match = regex.exec(content)) !== null) {
    if (!seen.has(match[1])) {
      suggestions.push({
        text: match[1],
        description: 'Env variable',
        type: 'arg',
        icon: '🔑',
        score: 75,
      });
      seen.add(match[1]);
    }
  }
  return suggestions;
}
