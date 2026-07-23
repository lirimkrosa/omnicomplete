/**
 * Autocomplete Generators
 * Handles dynamic suggestion generation from local files or shell commands.
 */

import { readFileSync, existsSync, readdirSync, statSync } from 'fs';
import { join, resolve, dirname, basename } from 'path';
import { execSync } from 'child_process';

const generatorCache = new Map();
const CACHE_TTL = 2000;

/**
 * Run a registered generator to produce dynamic suggestions.
 * @param {string} generatorName - The custom generator ID (e.g., 'npm.scripts')
 * @param {object} ctx - Context object
 * @returns {Array<{text: string, description: string, type: string, icon: string, score: number}>}
 */
export function runGenerator(generatorName, contextObj) {
  const partial = contextObj?.ctx?.partial || '';
  const cacheKey = generatorName === 'filepaths' ? `${generatorName}:${partial}` : generatorName;
  
  if (generatorCache.has(cacheKey)) {
    const { timestamp, data } = generatorCache.get(cacheKey);
    if (Date.now() - timestamp < CACHE_TTL) {
      return data;
    }
  }

  let result = [];
  switch (generatorName) {
    case 'npm.scripts': result = generateNpmScripts(); break;
    case 'git.branches': result = generateGitBranches(); break;
    case 'git.remotes': result = generateGitRemotes(); break;
    case 'docker.containers': result = generateDockerContainers(); break;
    case 'docker.images': result = generateDockerImages(); break;
    case 'docker.stages': result = generateDockerStages(); break;
    case 'docker.ports': result = generateDockerPorts(); break;
    case 'docker.envs': result = generateDockerEnvs(); break;
    case 'make.targets': result = generateMakeTargets(); break;
    case 'filepaths': result = generateFilePaths(partial, contextObj.ctx); break;
  }

  generatorCache.set(cacheKey, { timestamp: Date.now(), data: result });
  return result;
}

/**
 * Generate suggestions for package.json scripts.
 */
function generateNpmScripts() {
  const suggestions = [];
  try {
    const cwd = process.cwd();
    const pkgPath = join(cwd, 'package.json');
    
    if (existsSync(pkgPath)) {
      const pkgContent = readFileSync(pkgPath, 'utf8');
      const pkg = JSON.parse(pkgContent);
      
      if (pkg.scripts && typeof pkg.scripts === 'object') {
        for (const [scriptName, scriptCmd] of Object.entries(pkg.scripts)) {
          suggestions.push({
            text: scriptName,
            description: scriptCmd.length > 50 ? scriptCmd.substring(0, 47) + '...' : scriptCmd,
            type: 'script',
            icon: '⚡',
            score: 75 // Score below subcommands but above history
          });
        }
      }
    }
  } catch (err) {
    // Fail silently — just return empty suggestions
  }
  return suggestions;
}

/**
 * Generate suggestions for local git branches.
 */
function generateGitBranches() {
  try {
    const out = execSync('git branch --format="%(refname:short)"', { stdio: ['ignore', 'pipe', 'ignore'], encoding: 'utf8', timeout: 500 });
    return out.split('\n').map(b => b.trim()).filter(Boolean).map(branch => ({
      text: branch,
      description: 'Local branch',
      type: 'arg',
      icon: '🌿',
      score: 75
    }));
  } catch {
    return [];
  }
}

/**
 * Generate suggestions for git remotes.
 */
function generateGitRemotes() {
  try {
    const out = execSync('git remote', { stdio: ['ignore', 'pipe', 'ignore'], encoding: 'utf8', timeout: 500 });
    return out.split('\n').map(r => r.trim()).filter(Boolean).map(remote => ({
      text: remote,
      description: 'Git remote',
      type: 'arg',
      icon: '☁️',
      score: 75
    }));
  } catch {
    return [];
  }
}

/**
 * Generate suggestions for Docker containers.
 */
function generateDockerContainers() {
  try {
    const out = execSync('docker ps -a --format "{{.Names}}\t{{.Status}}"', { stdio: ['ignore', 'pipe', 'ignore'], encoding: 'utf8', timeout: 500 });
    return out.split('\n').map(c => c.trim()).filter(Boolean).map(line => {
      const [name, status] = line.split('\t');
      return {
        text: name,
        description: status || 'Container',
        type: 'arg',
        icon: '🐳',
        score: 75
      };
    });
  } catch {
    return [];
  }
}

/**
 * Generate suggestions for Docker images.
 */
function generateDockerImages() {
  try {
    const out = execSync('docker images --format "{{.Repository}}:{{.Tag}}"', { stdio: ['ignore', 'pipe', 'ignore'], encoding: 'utf8', timeout: 500 });
    return out.split('\n').map(i => i.trim()).filter(Boolean).filter(i => i !== '<none>:<none>').map(img => ({
      text: img,
      description: 'Docker image',
      type: 'arg',
      icon: '💿',
      score: 75
    }));
  } catch {
    return [];
  }
}

/**
 * Generate suggestions for Make targets.
 */
function generateMakeTargets() {
  const suggestions = [];
  try {
    const cwd = process.cwd();
    const makefilePath = join(cwd, 'Makefile');
    
    if (existsSync(makefilePath)) {
      const content = readFileSync(makefilePath, 'utf8');
      const lines = content.split('\n');
      
      for (const line of lines) {
        // Match standard make targets: "target: dependencies"
        const match = line.match(/^([a-zA-Z0-9_-]+):/);
        if (match) {
          suggestions.push({
            text: match[1],
            description: 'Make target',
            type: 'arg',
            icon: '🛠️',
            score: 75
          });
        }
      }
    }
  } catch {
    // Silently return
  }
  return suggestions;
}

/**
 * Generate suggestions for Dockerfile build stages (FROM ... AS stage).
 */
function generateDockerStages() {
  const suggestions = [];
  try {
    const cwd = process.cwd();
    const dockerfilePath = join(cwd, 'Dockerfile');
    if (existsSync(dockerfilePath)) {
      const content = readFileSync(dockerfilePath, 'utf8');
      const regex = /^FROM\s+.*?\s+AS\s+([a-zA-Z0-9_-]+)/gim;
      let match;
      while ((match = regex.exec(content)) !== null) {
        suggestions.push({
          text: match[1],
          description: 'Build stage',
          type: 'arg',
          icon: '🏗️',
          score: 75
        });
      }
    }
  } catch {
    // Ignore
  }
  return suggestions;
}

/**
 * Generate suggestions for Dockerfile exposed ports.
 */
function generateDockerPorts() {
  const suggestions = [];
  try {
    const cwd = process.cwd();
    const dockerfilePath = join(cwd, 'Dockerfile');
    if (existsSync(dockerfilePath)) {
      const content = readFileSync(dockerfilePath, 'utf8');
      const regex = /^EXPOSE\s+([0-9]+)/gim;
      let match;
      while ((match = regex.exec(content)) !== null) {
        suggestions.push({
          text: match[1],
          description: 'Exposed port',
          type: 'arg',
          icon: '🔌',
          score: 75
        });
      }
    }
  } catch {
    // Ignore
  }
  return suggestions;
}

/**
 * Generate suggestions for Dockerfile env variables.
 */
function generateDockerEnvs() {
  const suggestions = [];
  try {
    const cwd = process.cwd();
    const dockerfilePath = join(cwd, 'Dockerfile');
    if (existsSync(dockerfilePath)) {
      const content = readFileSync(dockerfilePath, 'utf8');
      const regex = /^ENV\s+([a-zA-Z_][a-zA-Z0-9_]*)/gim;
      let match;
      const seen = new Set();
      while ((match = regex.exec(content)) !== null) {
        if (!seen.has(match[1])) {
          suggestions.push({
            text: match[1],
            description: 'Env variable',
            type: 'arg',
            icon: '🔑',
            score: 75
          });
          seen.add(match[1]);
        }
      }
    }
  } catch {
    // Ignore
  }
  return suggestions;
}

/**
 * Generate suggestions for file and directory paths.
 * @param {string} partial - The current partial input (e.g. 'src/co')
 */
function generateFilePaths(partial, ctx) {
  const suggestions = [];
  try {
    const cwd = (ctx && ctx.cwd) ? ctx.cwd : process.cwd();
    
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
    
    if (existsSync(targetDir)) {
      const files = readdirSync(targetDir);
      for (const file of files) {
        if (file.startsWith('.') && !partial.startsWith('.')) continue; // skip hidden unless explicitly requested
        
        const fullPath = join(targetDir, file);
        try {
          const stats = statSync(fullPath);
          const isDir = stats.isDirectory();
          
          suggestions.push({
            text: prefix + file + (isDir ? '/' : ''),
            description: isDir ? 'Directory' : 'File',
            type: 'arg',
            icon: isDir ? '📁' : '📄',
            score: isDir ? 60 : 50 // Directories slightly higher
          });
        } catch {
          // ignore stat errors (e.g. broken symlinks)
        }
      }
    }
  } catch {
    // Ignore read errors
  }
  return suggestions;
}
