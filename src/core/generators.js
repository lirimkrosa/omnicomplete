/**
 * Autocomplete Generators
 * Handles dynamic suggestion generation from local files or shell commands.
 */

import { readFileSync, existsSync, readdirSync, statSync } from 'fs';
import { join, resolve, dirname, basename } from 'path';
import { execSync } from 'child_process';
import { getComposeModel, getComposeService } from '../docker/compose-parser.js';
import { getToolsForImage } from '../docker/image-tools.js';

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
    case 'compose.services': result = generateComposeServices(); break;
    case 'compose.volumes': result = generateComposeVolumes(); break;
    case 'compose.networks': result = generateComposeNetworks(); break;
    case 'compose.profiles': result = generateComposeProfiles(); break;
    case 'compose.exec-commands': result = generateComposeExecCommands(contextObj); break;
    case 'compose.env-vars': result = generateComposeEnvVars(contextObj); break;
    case 'compose.ports': result = generateComposePorts(); break;
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

// ─── Docker Compose Generators ──────────────────────────────────────────────────

/**
 * Status indicators for live container state.
 */
const STATUS_ICONS = {
  running: '🟢',
  exited: '🔴',
  created: '⚪',
  paused: '🟡',
  restarting: '🟠',
  removing: '🔴',
  dead: '💀',
};

/**
 * Generate suggestions for Docker Compose services.
 * Includes live status, image name, and port mappings.
 */
function generateComposeServices() {
  const model = getComposeModel();
  if (!model) return [];

  return model.services.map(svc => {
    // Build a rich description
    const parts = [];

    // Live status indicator
    if (svc.status) {
      const statusKey = svc.status.toLowerCase();
      const icon = STATUS_ICONS[statusKey] || '⚪';
      const healthSuffix = svc.health && svc.health !== 'healthy' ? ` (${svc.health})` : '';
      parts.push(`${icon} ${svc.status}${healthSuffix}`);
    }

    // Image name
    if (svc.image) {
      parts.push(svc.image);
    } else if (svc.build) {
      parts.push(`build: ${svc.build}`);
    }

    // Port mappings
    if (svc.ports.length > 0) {
      parts.push(svc.ports[0]);
    }

    // Dependency info
    if (svc.dependedBy.length > 0) {
      parts.push(`⬆ needed by: ${svc.dependedBy.join(', ')}`);
    }
    if (svc.dependsOn.length > 0) {
      parts.push(`⬇ depends: ${svc.dependsOn.join(', ')}`);
    }

    return {
      text: svc.name,
      description: parts.join(' · ') || 'Service',
      type: 'arg',
      icon: '🐳',
      score: 80,
    };
  });
}

/**
 * Generate suggestions for Docker Compose named volumes.
 */
function generateComposeVolumes() {
  const model = getComposeModel();
  if (!model) return [];

  return model.volumes.map(vol => ({
    text: vol,
    description: 'Named volume',
    type: 'arg',
    icon: '💾',
    score: 75,
  }));
}

/**
 * Generate suggestions for Docker Compose named networks.
 */
function generateComposeNetworks() {
  const model = getComposeModel();
  if (!model) return [];

  return model.networks.map(net => ({
    text: net,
    description: 'Network',
    type: 'arg',
    icon: '🌐',
    score: 75,
  }));
}

/**
 * Generate suggestions for Docker Compose profiles.
 */
function generateComposeProfiles() {
  const model = getComposeModel();
  if (!model) return [];

  return model.profiles.map(profile => ({
    text: profile,
    description: 'Profile',
    type: 'arg',
    icon: '🏷️',
    score: 75,
  }));
}

/**
 * Generate smart exec command suggestions based on the service's Docker image.
 * Looks at the previous token in the command to identify which service is targeted.
 */
function generateComposeExecCommands(contextObj) {
  const tokens = contextObj?.parsed?.tokens || [];

  // Find the service name: it's the token right after "exec"
  let serviceName = null;
  for (let i = 0; i < tokens.length; i++) {
    if (tokens[i] === 'exec' && i + 1 < tokens.length) {
      serviceName = tokens[i + 1];
      break;
    }
  }

  if (!serviceName) return [];

  const svc = getComposeService(serviceName);
  if (!svc) return [];

  // Get the effective image name
  const imageName = svc.image || svc.build || null;
  const tools = getToolsForImage(imageName);

  return tools.map(tool => ({
    text: tool.cmd,
    description: tool.desc,
    type: 'arg',
    icon: tool.icon || '🔧',
    score: 70,
  }));
}

/**
 * Generate environment variable suggestions from a compose service.
 * Looks at the previous tokens to identify which service is targeted.
 */
function generateComposeEnvVars(contextObj) {
  const tokens = contextObj?.parsed?.tokens || [];

  // Find service name after exec/run
  let serviceName = null;
  for (let i = 0; i < tokens.length; i++) {
    if ((tokens[i] === 'exec' || tokens[i] === 'run') && i + 1 < tokens.length) {
      serviceName = tokens[i + 1];
      break;
    }
  }

  if (!serviceName) {
    // Fallback: try to suggest from all services' env vars
    const model = getComposeModel();
    if (!model) return [];
    const allEnvs = new Map();
    for (const svc of model.services) {
      for (const [key, val] of Object.entries(svc.environment)) {
        if (!allEnvs.has(key)) allEnvs.set(key, val);
      }
    }
    return [...allEnvs.entries()].map(([key, val]) => ({
      text: key,
      description: val ? (String(val).length > 40 ? String(val).slice(0, 37) + '...' : String(val)) : '(defined)',
      type: 'arg',
      icon: '🔑',
      score: 65,
    }));
  }

  const svc = getComposeService(serviceName);
  if (!svc) return [];

  return Object.entries(svc.environment).map(([key, val]) => ({
    text: key,
    description: val ? (String(val).length > 40 ? String(val).slice(0, 37) + '...' : String(val)) : '(defined)',
    type: 'arg',
    icon: '🔑',
    score: 65,
  }));
}

/**
 * Generate port mapping suggestions from all compose services.
 */
function generateComposePorts() {
  const model = getComposeModel();
  if (!model) return [];

  const ports = [];
  for (const svc of model.services) {
    for (const port of svc.ports) {
      ports.push({
        text: port,
        description: `${svc.name} port mapping`,
        type: 'arg',
        icon: '🔌',
        score: 70,
      });
    }
  }
  return ports;
}
