/**
 * Compose Generators — dynamic suggestions from docker-compose.yml.
 * Parses the local compose file to suggest services, volumes, networks,
 * profiles, exec commands, environment variables, and port mappings.
 */

import { getComposeModel, getComposeService } from '../docker/compose-parser.js';
import { getToolsForImage } from '../docker/image-tools.js';

/** Status indicators for live container state. */
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
 * Includes live status, image name, port mappings, and dependency info.
 */
export function generateComposeServices() {
  const model = getComposeModel();
  if (!model) return [];

  return model.services.map(svc => {
    const parts = [];

    if (svc.status) {
      const statusKey = svc.status.toLowerCase();
      const icon = STATUS_ICONS[statusKey] || '⚪';
      const healthSuffix = svc.health && svc.health !== 'healthy' ? ` (${svc.health})` : '';
      parts.push(`${icon} ${svc.status}${healthSuffix}`);
    }

    if (svc.image) {
      parts.push(svc.image);
    } else if (svc.build) {
      parts.push(`build: ${svc.build}`);
    }

    if (svc.ports.length > 0) {
      parts.push(svc.ports[0]);
    }

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

/** Generate suggestions for Docker Compose named volumes. */
export function generateComposeVolumes() {
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

/** Generate suggestions for Docker Compose named networks. */
export function generateComposeNetworks() {
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

/** Generate suggestions for Docker Compose profiles. */
export function generateComposeProfiles() {
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
 * Extracts the service name from the token after "exec" in the command.
 */
export function generateComposeExecCommands(contextObj) {
  const serviceName = findServiceNameInTokens(contextObj, 'exec');
  if (!serviceName) return [];

  const svc = getComposeService(serviceName);
  if (!svc) return [];

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
 * Falls back to aggregated env vars from all services if no specific service is targeted.
 */
export function generateComposeEnvVars(contextObj) {
  const serviceName = findServiceNameInTokens(contextObj, 'exec', 'run');
  
  if (!serviceName) {
    const model = getComposeModel();
    if (!model) return [];
    const allEnvs = new Map();
    for (const svc of model.services) {
      for (const [key, val] of Object.entries(svc.environment)) {
        if (!allEnvs.has(key)) allEnvs.set(key, val);
      }
    }
    return [...allEnvs.entries()].map(([key, val]) => formatEnvSuggestion(key, val));
  }

  const svc = getComposeService(serviceName);
  if (!svc) return [];

  return Object.entries(svc.environment).map(([key, val]) => formatEnvSuggestion(key, val));
}

/** Generate port mapping suggestions from all compose services. */
export function generateComposePorts() {
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

// ─── Helpers ────────────────────────────────────────────────────────────────────

/**
 * Find the service name in the command tokens after a given keyword.
 * @param {object} contextObj - The generator context
 * @param {...string} keywords - Keywords to search for (e.g. 'exec', 'run')
 * @returns {string|null}
 */
function findServiceNameInTokens(contextObj, ...keywords) {
  const tokens = contextObj?.parsed?.tokens || [];
  for (let i = 0; i < tokens.length; i++) {
    if (keywords.includes(tokens[i]) && i + 1 < tokens.length) {
      return tokens[i + 1];
    }
  }
  return null;
}

/**
 * Format an environment variable as a suggestion object.
 */
function formatEnvSuggestion(key, val) {
  const desc = val
    ? (String(val).length > 40 ? String(val).slice(0, 37) + '...' : String(val))
    : '(defined)';
  return { text: key, description: desc, type: 'arg', icon: '🔑', score: 65 };
}
