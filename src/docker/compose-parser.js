/**
 * Compose Parser — lightweight YAML parser + Docker Compose file intelligence.
 * Parses docker-compose.yml/compose.yaml files without external dependencies.
 * Supports multi-file resolution, override merging, and live state enrichment.
 */

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { execSync } from 'child_process';

// ─── Compose File Discovery ────────────────────────────────────────────────────

const COMPOSE_FILENAMES = [
  'compose.yaml',
  'compose.yml',
  'docker-compose.yml',
  'docker-compose.yaml',
];

const OVERRIDE_FILENAMES = [
  'docker-compose.override.yml',
  'docker-compose.override.yaml',
  'compose.override.yml',
  'compose.override.yaml',
];

/**
 * Find the compose file(s) in the given directory.
 * Respects COMPOSE_FILE env var if set.
 * @param {string} cwd
 * @returns {{ primary: string|null, override: string|null }}
 */
function findComposeFiles(cwd) {
  // Check COMPOSE_FILE env var first
  const envFile = process.env.COMPOSE_FILE;
  if (envFile) {
    const separator = process.env.COMPOSE_PATH_SEPARATOR || ':';
    const files = envFile.split(separator);
    const primary = files[0] && existsSync(join(cwd, files[0])) ? join(cwd, files[0]) : null;
    const override = files[1] && existsSync(join(cwd, files[1])) ? join(cwd, files[1]) : null;
    return { primary, override };
  }

  // Search standard filenames
  let primary = null;
  for (const name of COMPOSE_FILENAMES) {
    const path = join(cwd, name);
    if (existsSync(path)) {
      primary = path;
      break;
    }
  }

  let override = null;
  if (primary) {
    for (const name of OVERRIDE_FILENAMES) {
      const path = join(cwd, name);
      if (existsSync(path)) {
        override = path;
        break;
      }
    }
  }

  return { primary, override };
}

// ─── Lightweight YAML Parser ────────────────────────────────────────────────────

/**
 * Parse a subset of YAML sufficient for Docker Compose files.
 * Handles: scalars, maps, lists, inline lists, quoted strings, anchors/aliases.
 * @param {string} yaml
 * @returns {object}
 */
function parseComposeYaml(yaml) {
  const lines = yaml.split('\n');
  const root = {};
  const anchors = {};
  const stack = [{ indent: -1, obj: root, key: null }];

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    
    // Skip empty lines and full-line comments
    const trimmed = rawLine.trimStart();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const indent = rawLine.length - rawLine.trimStart().length;
    const line = trimmed;

    // Pop the stack to the correct indentation level
    while (stack.length > 1 && indent <= stack[stack.length - 1].indent) {
      stack.pop();
    }
    const parent = stack[stack.length - 1];

    // List item: "- value" or "- key: value"
    if (line.startsWith('- ')) {
      const listValue = line.slice(2).trim();
      const parentObj = parent.obj;
      const parentKey = parent.key;

      if (parentKey && parentObj[parentKey] !== undefined) {
        if (!Array.isArray(parentObj[parentKey])) {
          parentObj[parentKey] = [];
        }
        // Check if it's a map item like "- name: foo"
        const colonIdx = listValue.indexOf(':');
        if (colonIdx > 0 && !listValue.startsWith('"') && !listValue.startsWith("'")) {
          const mapKey = listValue.slice(0, colonIdx).trim();
          const mapVal = parseScalar(listValue.slice(colonIdx + 1).trim());
          const mapObj = { [mapKey]: mapVal };
          parentObj[parentKey].push(mapObj);
          stack.push({ indent, obj: mapObj, key: mapKey });
        } else {
          parentObj[parentKey].push(parseScalar(listValue));
        }
      }
      continue;
    }

    // Anchor merge: "<<: *anchor"
    if (line.startsWith('<<:')) {
      const anchorName = line.slice(3).trim().replace(/^\*/, '');
      if (anchors[anchorName] && typeof anchors[anchorName] === 'object') {
        Object.assign(parent.obj, JSON.parse(JSON.stringify(anchors[anchorName])));
      }
      continue;
    }

    // Key-value pair: "key: value"
    const colonIdx = line.indexOf(':');
    if (colonIdx > 0) {
      let key = line.slice(0, colonIdx).trim();
      let value = line.slice(colonIdx + 1).trim();

      // Handle anchor definition: "&anchorName"
      let anchorName = null;
      if (value.startsWith('&')) {
        const spaceIdx = value.indexOf(' ');
        if (spaceIdx > 0) {
          anchorName = value.slice(1, spaceIdx);
          value = value.slice(spaceIdx + 1).trim();
        } else {
          anchorName = value.slice(1);
          value = '';
        }
      }

      // Handle alias reference: "*anchorName"
      if (value.startsWith('*')) {
        const refName = value.slice(1).trim();
        if (anchors[refName]) {
          parent.obj[key] = JSON.parse(JSON.stringify(anchors[refName]));
          continue;
        }
      }

      if (value === '' || value === '|' || value === '>') {
        // Nested map or block scalar — create empty object
        parent.obj[key] = {};
        const newObj = parent.obj[key];
        if (anchorName) anchors[anchorName] = newObj;
        stack.push({ indent, obj: parent.obj, key });
      } else if (value.startsWith('[') && value.endsWith(']')) {
        // Inline list: [a, b, c]
        const items = value.slice(1, -1).split(',').map(s => parseScalar(s.trim())).filter(s => s !== '');
        parent.obj[key] = items;
        if (anchorName) anchors[anchorName] = items;
      } else if (value.startsWith('{') && value.endsWith('}')) {
        // Inline map: {a: 1, b: 2}
        const map = {};
        const pairs = value.slice(1, -1).split(',');
        for (const pair of pairs) {
          const [k, ...v] = pair.split(':');
          if (k) map[k.trim()] = parseScalar(v.join(':').trim());
        }
        parent.obj[key] = map;
        if (anchorName) anchors[anchorName] = map;
      } else {
        parent.obj[key] = parseScalar(value);
        if (anchorName) anchors[anchorName] = parent.obj[key];
      }
    }
  }

  return root;
}

/**
 * Parse a scalar YAML value.
 */
function parseScalar(value) {
  if (!value || value === '~' || value === 'null') return null;
  if (value === 'true') return true;
  if (value === 'false') return false;

  // Remove inline comments
  const commentIdx = value.indexOf(' #');
  if (commentIdx > 0) value = value.slice(0, commentIdx).trim();

  // Quoted strings
  if ((value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))) {
    return value.slice(1, -1);
  }

  // Numbers
  if (/^-?\d+(\.\d+)?$/.test(value)) return Number(value);

  return value;
}

// ─── Compose Model ──────────────────────────────────────────────────────────────

/**
 * @typedef {Object} ComposeService
 * @property {string} name
 * @property {string|null} image
 * @property {string|null} build
 * @property {string[]} ports
 * @property {Object<string,string>} environment
 * @property {string[]} envFile
 * @property {string[]} dependsOn
 * @property {string[]} dependedBy - reverse-computed
 * @property {string[]} profiles
 * @property {string[]} volumes
 * @property {string[]} networks
 * @property {string|null} healthcheck
 * @property {string|null} status - live status from Docker daemon
 * @property {string|null} health - live health from Docker daemon
 */

/**
 * @typedef {Object} ComposeModel
 * @property {ComposeService[]} services
 * @property {string[]} volumes - top-level named volumes
 * @property {string[]} networks - top-level named networks
 * @property {string[]} profiles - all unique profiles
 */

/**
 * Build a rich compose model from the parsed YAML.
 * @param {object} parsed
 * @returns {ComposeModel}
 */
function buildComposeModel(parsed) {
  const services = [];
  const rawServices = parsed.services || {};

  for (const [name, config] of Object.entries(rawServices)) {
    if (!config || typeof config !== 'object') continue;

    // Parse ports
    const ports = [];
    if (config.ports) {
      const portList = Array.isArray(config.ports) ? config.ports : [config.ports];
      for (const p of portList) {
        ports.push(String(typeof p === 'object' ? (p.published ? `${p.published}:${p.target}` : p.target) : p));
      }
    }

    // Parse environment
    const environment = {};
    if (config.environment) {
      if (Array.isArray(config.environment)) {
        for (const item of config.environment) {
          const eqIdx = String(item).indexOf('=');
          if (eqIdx > 0) {
            environment[String(item).slice(0, eqIdx)] = String(item).slice(eqIdx + 1);
          } else {
            environment[String(item)] = '';
          }
        }
      } else if (typeof config.environment === 'object') {
        Object.assign(environment, config.environment);
      }
    }

    // Parse env_file
    const envFile = [];
    if (config.env_file) {
      const files = Array.isArray(config.env_file) ? config.env_file : [config.env_file];
      envFile.push(...files.map(String));
    }

    // Parse depends_on
    const dependsOn = [];
    if (config.depends_on) {
      if (Array.isArray(config.depends_on)) {
        dependsOn.push(...config.depends_on.map(String));
      } else if (typeof config.depends_on === 'object') {
        dependsOn.push(...Object.keys(config.depends_on));
      }
    }

    // Parse profiles
    const profiles = [];
    if (config.profiles) {
      const profileList = Array.isArray(config.profiles) ? config.profiles : [config.profiles];
      profiles.push(...profileList.map(String));
    }

    // Parse volumes
    const volumeList = [];
    if (config.volumes) {
      const vols = Array.isArray(config.volumes) ? config.volumes : [config.volumes];
      for (const v of vols) {
        volumeList.push(String(typeof v === 'object' ? (v.source ? `${v.source}:${v.target}` : v.target) : v));
      }
    }

    // Parse networks
    const networkList = [];
    if (config.networks) {
      if (Array.isArray(config.networks)) {
        networkList.push(...config.networks.map(String));
      } else if (typeof config.networks === 'object') {
        networkList.push(...Object.keys(config.networks));
      }
    }

    // Build path (string or context)
    let buildPath = null;
    if (config.build) {
      buildPath = typeof config.build === 'object' ? (config.build.context || '.') : String(config.build);
    }

    // Healthcheck
    let healthcheck = null;
    if (config.healthcheck && config.healthcheck.test) {
      const test = config.healthcheck.test;
      healthcheck = Array.isArray(test) ? test.join(' ') : String(test);
    }

    services.push({
      name,
      image: config.image ? String(config.image) : null,
      build: buildPath,
      ports,
      environment,
      envFile,
      dependsOn,
      dependedBy: [], // computed below
      profiles,
      volumes: volumeList,
      networks: networkList,
      healthcheck,
      status: null,
      health: null,
    });
  }

  // Compute reverse dependencies
  for (const svc of services) {
    for (const dep of svc.dependsOn) {
      const target = services.find(s => s.name === dep);
      if (target && !target.dependedBy.includes(svc.name)) {
        target.dependedBy.push(svc.name);
      }
    }
  }

  // Extract top-level volumes
  const volumes = parsed.volumes ? Object.keys(parsed.volumes) : [];

  // Extract top-level networks
  const networks = parsed.networks ? Object.keys(parsed.networks) : [];

  // Collect all unique profiles
  const allProfiles = [...new Set(services.flatMap(s => s.profiles))];

  return { services, volumes, networks, profiles: allProfiles };
}

// ─── Live State Enrichment ──────────────────────────────────────────────────────

/**
 * Query the Docker daemon for live container state and merge into the model.
 * @param {ComposeModel} model
 */
function enrichWithLiveState(model) {
  try {
    const output = execSync('docker compose ps --format json 2>/dev/null', {
      stdio: ['ignore', 'pipe', 'ignore'],
      encoding: 'utf8',
      timeout: 500,
    });

    // docker compose ps --format json outputs one JSON object per line
    const containers = output.trim().split('\n').filter(Boolean).map(line => {
      try { return JSON.parse(line); } catch { return null; }
    }).filter(Boolean);

    for (const container of containers) {
      const serviceName = container.Service || container.Name;
      const svc = model.services.find(s => s.name === serviceName);
      if (svc) {
        svc.status = container.State || container.Status || 'unknown';
        svc.health = container.Health || null;
      }
    }
  } catch {
    // Docker not running or compose not available — graceful fallback
  }
}

// ─── .env File Parser ───────────────────────────────────────────────────────────

/**
 * Parse a .env file and return key-value pairs.
 * @param {string} filePath
 * @returns {Object<string,string>}
 */
function parseEnvFile(filePath) {
  const vars = {};
  try {
    if (!existsSync(filePath)) return vars;
    const content = readFileSync(filePath, 'utf8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx > 0) {
        const key = trimmed.slice(0, eqIdx).trim();
        let val = trimmed.slice(eqIdx + 1).trim();
        // Remove surrounding quotes
        if ((val.startsWith('"') && val.endsWith('"')) ||
            (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1);
        }
        vars[key] = val;
      }
    }
  } catch {
    // Ignore read errors
  }
  return vars;
}

// ─── Cache ──────────────────────────────────────────────────────────────────────

let _cachedModel = null;
let _cachedTimestamp = 0;
let _cachedCwd = null;
const MODEL_CACHE_TTL = 2000;

// ─── Public API ─────────────────────────────────────────────────────────────────

/**
 * Get the full compose model for the current working directory.
 * Cached with a 2-second TTL.
 * @param {string} [cwd]
 * @returns {ComposeModel|null}
 */
export function getComposeModel(cwd) {
  const dir = cwd || process.cwd();

  if (_cachedModel && _cachedCwd === dir && (Date.now() - _cachedTimestamp < MODEL_CACHE_TTL)) {
    return _cachedModel;
  }

  const { primary, override } = findComposeFiles(dir);
  if (!primary) return null;

  try {
    const primaryContent = readFileSync(primary, 'utf8');
    let parsed = parseComposeYaml(primaryContent);

    // Merge override file if present
    if (override) {
      const overrideContent = readFileSync(override, 'utf8');
      const overrideParsed = parseComposeYaml(overrideContent);
      parsed = mergeComposeConfigs(parsed, overrideParsed);
    }

    const model = buildComposeModel(parsed);

    // Resolve .env file variables for each service
    for (const svc of model.services) {
      for (const envFilePath of svc.envFile) {
        const fullPath = join(dir, envFilePath);
        const envVars = parseEnvFile(fullPath);
        // .env file vars are lower priority than inline environment
        for (const [key, val] of Object.entries(envVars)) {
          if (!(key in svc.environment)) {
            svc.environment[key] = val;
          }
        }
      }
    }

    // Also read root .env file (Docker Compose does this by default)
    const rootEnv = parseEnvFile(join(dir, '.env'));
    // Store root env vars on model for variable substitution awareness
    model._rootEnv = rootEnv;

    // Enrich with live Docker daemon state
    enrichWithLiveState(model);

    _cachedModel = model;
    _cachedTimestamp = Date.now();
    _cachedCwd = dir;

    return model;
  } catch {
    return null;
  }
}

/**
 * Merge two parsed compose configs (primary + override).
 * Override values take precedence; services are deep-merged.
 */
function mergeComposeConfigs(primary, override) {
  const merged = { ...primary };

  // Merge services
  if (override.services) {
    merged.services = { ...(primary.services || {}) };
    for (const [name, config] of Object.entries(override.services)) {
      if (merged.services[name] && typeof config === 'object') {
        merged.services[name] = { ...merged.services[name], ...config };
      } else {
        merged.services[name] = config;
      }
    }
  }

  // Merge volumes (override takes precedence)
  if (override.volumes) {
    merged.volumes = { ...(primary.volumes || {}), ...override.volumes };
  }

  // Merge networks (override takes precedence)
  if (override.networks) {
    merged.networks = { ...(primary.networks || {}), ...override.networks };
  }

  return merged;
}

/**
 * Get a specific service by name from the compose model.
 * @param {string} serviceName
 * @param {string} [cwd]
 * @returns {ComposeService|null}
 */
export function getComposeService(serviceName, cwd) {
  const model = getComposeModel(cwd);
  if (!model) return null;
  return model.services.find(s => s.name === serviceName) || null;
}

/**
 * Invalidate the compose model cache.
 */
export function invalidateComposeCache() {
  _cachedModel = null;
  _cachedTimestamp = 0;
  _cachedCwd = null;
}
