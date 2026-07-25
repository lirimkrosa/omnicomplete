/**
 * Image Tools — maps Docker image names to common CLI tools available inside them.
 * Powers smart `docker compose exec` suggestions.
 */

// ─── Image-to-Tool Mapping ──────────────────────────────────────────────────────

const IMAGE_TOOLS = {
  // Databases
  postgres: [
    { cmd: 'psql -U postgres', desc: 'PostgreSQL client', icon: '🗄️' },
    { cmd: 'pg_dump', desc: 'Database dump utility', icon: '💾' },
    { cmd: 'pg_restore', desc: 'Database restore utility', icon: '📥' },
    { cmd: 'createdb', desc: 'Create a database', icon: '➕' },
    { cmd: 'dropdb', desc: 'Drop a database', icon: '🗑️' },
    { cmd: 'pg_isready', desc: 'Check server status', icon: '🏥' },
  ],
  mysql: [
    { cmd: 'mysql -u root -p', desc: 'MySQL client', icon: '🗄️' },
    { cmd: 'mysqldump', desc: 'Database dump utility', icon: '💾' },
    { cmd: 'mysqladmin', desc: 'Administration tool', icon: '⚙️' },
    { cmd: 'mysqlcheck', desc: 'Table maintenance', icon: '🔍' },
  ],
  mariadb: [
    { cmd: 'mysql -u root -p', desc: 'MariaDB client', icon: '🗄️' },
    { cmd: 'mysqldump', desc: 'Database dump utility', icon: '💾' },
    { cmd: 'mariadb-admin', desc: 'Administration tool', icon: '⚙️' },
  ],
  mongo: [
    { cmd: 'mongosh', desc: 'MongoDB Shell', icon: '🗄️' },
    { cmd: 'mongodump', desc: 'Database dump utility', icon: '💾' },
    { cmd: 'mongorestore', desc: 'Database restore utility', icon: '📥' },
    { cmd: 'mongostat', desc: 'Server statistics', icon: '📊' },
  ],

  // Caches & Queues
  redis: [
    { cmd: 'redis-cli', desc: 'Redis CLI', icon: '🔴' },
    { cmd: 'redis-cli monitor', desc: 'Monitor all commands', icon: '📡' },
    { cmd: 'redis-cli info', desc: 'Server information', icon: 'ℹ️' },
    { cmd: 'redis-benchmark', desc: 'Benchmark tool', icon: '⚡' },
  ],
  memcached: [
    { cmd: 'bash', desc: 'Shell', icon: '🐚' },
  ],
  rabbitmq: [
    { cmd: 'rabbitmqctl status', desc: 'Server status', icon: '🐇' },
    { cmd: 'rabbitmqctl list_queues', desc: 'List queues', icon: '📋' },
    { cmd: 'rabbitmqadmin', desc: 'Management CLI', icon: '⚙️' },
  ],
  kafka: [
    { cmd: 'kafka-topics.sh --list', desc: 'List topics', icon: '📋' },
    { cmd: 'kafka-console-consumer.sh', desc: 'Console consumer', icon: '📥' },
    { cmd: 'kafka-console-producer.sh', desc: 'Console producer', icon: '📤' },
  ],

  // Runtimes
  node: [
    { cmd: 'node', desc: 'Node.js REPL', icon: '🟢' },
    { cmd: 'npm', desc: 'Package manager', icon: '📦' },
    { cmd: 'npx', desc: 'Execute packages', icon: '🚀' },
    { cmd: 'yarn', desc: 'Yarn package manager', icon: '🧶' },
  ],
  python: [
    { cmd: 'python', desc: 'Python REPL', icon: '🐍' },
    { cmd: 'pip install', desc: 'Install packages', icon: '📦' },
    { cmd: 'python manage.py', desc: 'Django management', icon: '🎯' },
    { cmd: 'pytest', desc: 'Run tests', icon: '🧪' },
  ],
  ruby: [
    { cmd: 'irb', desc: 'Ruby REPL', icon: '💎' },
    { cmd: 'bundle exec', desc: 'Bundler exec', icon: '📦' },
    { cmd: 'rails console', desc: 'Rails console', icon: '🛤️' },
    { cmd: 'rake', desc: 'Run Rake tasks', icon: '🔧' },
  ],
  php: [
    { cmd: 'php -a', desc: 'PHP REPL', icon: '🐘' },
    { cmd: 'composer', desc: 'Dependency manager', icon: '📦' },
    { cmd: 'php artisan', desc: 'Laravel CLI', icon: '🎯' },
    { cmd: 'phpunit', desc: 'Run tests', icon: '🧪' },
  ],
  golang: [
    { cmd: 'go run .', desc: 'Run Go app', icon: '🐹' },
    { cmd: 'go test ./...', desc: 'Run tests', icon: '🧪' },
    { cmd: 'go build', desc: 'Build binary', icon: '🔨' },
  ],
  rust: [
    { cmd: 'cargo run', desc: 'Run Rust app', icon: '🦀' },
    { cmd: 'cargo test', desc: 'Run tests', icon: '🧪' },
    { cmd: 'cargo build', desc: 'Build binary', icon: '🔨' },
  ],
  java: [
    { cmd: 'java -version', desc: 'Check Java version', icon: '☕' },
    { cmd: 'mvn', desc: 'Maven build tool', icon: '🔧' },
    { cmd: 'gradle', desc: 'Gradle build tool', icon: '🐘' },
  ],
  dotnet: [
    { cmd: 'dotnet run', desc: 'Run .NET app', icon: '🔵' },
    { cmd: 'dotnet test', desc: 'Run tests', icon: '🧪' },
    { cmd: 'dotnet ef', desc: 'Entity Framework CLI', icon: '🗄️' },
  ],
  elixir: [
    { cmd: 'iex -S mix', desc: 'Elixir REPL', icon: '💧' },
    { cmd: 'mix', desc: 'Mix build tool', icon: '🔧' },
    { cmd: 'mix ecto.migrate', desc: 'Run migrations', icon: '🗄️' },
  ],

  // Web Servers
  nginx: [
    { cmd: 'nginx -t', desc: 'Test configuration', icon: '✅' },
    { cmd: 'nginx -s reload', desc: 'Reload config', icon: '🔄' },
    { cmd: 'nginx -s stop', desc: 'Stop server', icon: '🛑' },
    { cmd: 'cat /etc/nginx/nginx.conf', desc: 'View config', icon: '📄' },
  ],
  httpd: [
    { cmd: 'apachectl -t', desc: 'Test configuration', icon: '✅' },
    { cmd: 'apachectl graceful', desc: 'Graceful restart', icon: '🔄' },
  ],
  caddy: [
    { cmd: 'caddy validate', desc: 'Validate config', icon: '✅' },
    { cmd: 'caddy reload', desc: 'Reload config', icon: '🔄' },
  ],
  traefik: [
    { cmd: 'traefik healthcheck', desc: 'Health check', icon: '🏥' },
  ],

  // Search
  elasticsearch: [
    { cmd: 'curl localhost:9200', desc: 'Check cluster health', icon: '🔍' },
    { cmd: 'curl localhost:9200/_cat/indices', desc: 'List indices', icon: '📋' },
  ],
  meilisearch: [
    { cmd: 'curl localhost:7700/health', desc: 'Health check', icon: '🏥' },
  ],

  // Base OS images
  alpine: [
    { cmd: 'sh', desc: 'Shell (Alpine)', icon: '🐚' },
    { cmd: 'apk add', desc: 'Install packages', icon: '📦' },
    { cmd: 'apk list --installed', desc: 'List installed packages', icon: '📋' },
  ],
  ubuntu: [
    { cmd: 'bash', desc: 'Bash shell', icon: '🐚' },
    { cmd: 'apt update && apt install', desc: 'Install packages', icon: '📦' },
  ],
  debian: [
    { cmd: 'bash', desc: 'Bash shell', icon: '🐚' },
    { cmd: 'apt update && apt install', desc: 'Install packages', icon: '📦' },
  ],
  centos: [
    { cmd: 'bash', desc: 'Bash shell', icon: '🐚' },
    { cmd: 'yum install', desc: 'Install packages', icon: '📦' },
  ],
  amazonlinux: [
    { cmd: 'bash', desc: 'Bash shell', icon: '🐚' },
    { cmd: 'yum install', desc: 'Install packages', icon: '📦' },
  ],
};

// Universal fallback commands for any image
const UNIVERSAL_TOOLS = [
  { cmd: 'bash', desc: 'Bash shell', icon: '🐚' },
  { cmd: 'sh', desc: 'Shell', icon: '🐚' },
  { cmd: 'cat', desc: 'View files', icon: '📄' },
  { cmd: 'ls', desc: 'List directory', icon: '📂' },
  { cmd: 'env', desc: 'Show environment', icon: '🔑' },
  { cmd: 'whoami', desc: 'Current user', icon: '👤' },
  { cmd: 'pwd', desc: 'Working directory', icon: '📍' },
];

// ─── Public API ─────────────────────────────────────────────────────────────────

/**
 * Get suggested exec commands for a Docker image.
 * Fuzzy-matches the image name against known tool mappings.
 * @param {string|null} imageName - e.g. "myorg/custom-postgres:15-bullseye"
 * @returns {Array<{cmd: string, desc: string, icon: string}>}
 */
export function getToolsForImage(imageName) {
  if (!imageName) return UNIVERSAL_TOOLS;

  // Normalize: strip registry prefix, tag, and get base name
  // "registry.example.com/myorg/custom-postgres:15-bullseye" → "custom-postgres"
  const parts = imageName.split('/');
  const lastPart = parts[parts.length - 1];
  const baseName = lastPart.split(':')[0].toLowerCase();

  // Try exact match first
  if (IMAGE_TOOLS[baseName]) {
    return [...IMAGE_TOOLS[baseName], ...UNIVERSAL_TOOLS];
  }

  // Try fuzzy match: check if any known key is a substring of the base name
  for (const [key, tools] of Object.entries(IMAGE_TOOLS)) {
    if (baseName.includes(key)) {
      return [...tools, ...UNIVERSAL_TOOLS];
    }
  }

  // No match — return universal tools only
  return UNIVERSAL_TOOLS;
}

/**
 * Get all known image names for documentation/listing.
 * @returns {string[]}
 */
export function getKnownImages() {
  return Object.keys(IMAGE_TOOLS);
}
