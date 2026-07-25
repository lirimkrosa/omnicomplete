/**
 * Generator Registry — routes generator requests to domain-specific modules.
 * Each domain (git, docker, compose, project) is a separate module under src/generators/.
 *
 * All generators share a unified cache with a 2-second TTL.
 */

import { generateGitBranches, generateGitRemotes } from '../generators/git.js';
import { generateDockerContainers, generateDockerImages, generateDockerStages, generateDockerPorts, generateDockerEnvs } from '../generators/docker.js';
import { generateComposeServices, generateComposeVolumes, generateComposeNetworks, generateComposeProfiles, generateComposeExecCommands, generateComposeEnvVars, generateComposePorts } from '../generators/compose.js';
import { generateNpmScripts, generateMakeTargets, generateFilePaths } from '../generators/project.js';

// ─── Cache ──────────────────────────────────────────────────────────────────────

const generatorCache = new Map();
const CACHE_TTL = 2000;

// ─── Generator Map ──────────────────────────────────────────────────────────────

/**
 * Maps generator names to their handler functions.
 * Handlers that need context receive it via a wrapper.
 */
const GENERATORS = {
  // Git
  'git.branches':         () => generateGitBranches(),
  'git.remotes':          () => generateGitRemotes(),

  // Docker daemon
  'docker.containers':    () => generateDockerContainers(),
  'docker.images':        () => generateDockerImages(),
  'docker.stages':        () => generateDockerStages(),
  'docker.ports':         () => generateDockerPorts(),
  'docker.envs':          () => generateDockerEnvs(),

  // Docker Compose (project-aware)
  'compose.services':     () => generateComposeServices(),
  'compose.volumes':      () => generateComposeVolumes(),
  'compose.networks':     () => generateComposeNetworks(),
  'compose.profiles':     () => generateComposeProfiles(),
  'compose.exec-commands': (ctx) => generateComposeExecCommands(ctx),
  'compose.env-vars':     (ctx) => generateComposeEnvVars(ctx),
  'compose.ports':        () => generateComposePorts(),

  // Project files
  'npm.scripts':          () => generateNpmScripts(),
  'make.targets':         () => generateMakeTargets(),
};

// ─── Public API ─────────────────────────────────────────────────────────────────

/**
 * Run a registered generator to produce dynamic suggestions.
 * Results are cached with a 2-second TTL.
 *
 * @param {string} generatorName - Generator ID (e.g., 'git.branches', 'compose.services')
 * @param {object} contextObj - Context object containing parsed tokens and partial input
 * @returns {Array<{text: string, description: string, type: string, icon: string, score: number}>}
 */
export function runGenerator(generatorName, contextObj) {
  const partial = contextObj?.ctx?.partial || '';

  // Filepaths have a special cache key since they depend on the partial path
  if (generatorName === 'filepaths') {
    const cacheKey = `filepaths:${partial}`;
    const cached = getCached(cacheKey);
    if (cached) return cached;

    const result = generateFilePaths(partial, contextObj.ctx);
    setCache(cacheKey, result);
    return result;
  }

  // Standard generators
  const cached = getCached(generatorName);
  if (cached) return cached;

  const handler = GENERATORS[generatorName];
  if (!handler) return [];

  const result = handler(contextObj);
  setCache(generatorName, result);
  return result;
}

// ─── Cache Helpers ──────────────────────────────────────────────────────────────

function getCached(key) {
  if (!generatorCache.has(key)) return null;
  const { timestamp, data } = generatorCache.get(key);
  return (Date.now() - timestamp < CACHE_TTL) ? data : null;
}

function setCache(key, data) {
  generatorCache.set(key, { timestamp: Date.now(), data });
}
