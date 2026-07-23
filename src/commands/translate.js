/**
 * Translate Command — converts natural language to shell commands.
 * Uses a local template engine with pattern matching (fully offline).
 */

import { RESET, BOLD, DIM, FG, BG, style } from '../utils/ansi.js';
import { writeLine, printHeader, printSeparator, enterRawMode, readKey, write } from '../utils/terminal.js';
import { addToHistory } from '../core/history.js';

/**
 * Pattern templates for NL → command translation.
 */
const PATTERNS = [
  // Git
  { match: /list\s+(all\s+)?branch/i, cmd: 'git branch -a', desc: 'List all git branches' },
  { match: /create\s+(a\s+)?branch\s+(?:named?\s+)?(\S+)/i, cmd: (m) => `git checkout -b ${m[2]}`, desc: 'Create new git branch' },
  { match: /switch\s+(?:to\s+)?branch\s+(\S+)/i, cmd: (m) => `git checkout ${m[1]}`, desc: 'Switch git branch' },
  { match: /commit\s+(all\s+)?(changes?\s+)?(?:with\s+)?(?:message\s+)?["']?(.+?)["']?$/i, cmd: (m) => `git add -A && git commit -m "${m[3]}"`, desc: 'Commit all changes' },
  { match: /push\s+(?:to\s+)?(?:remote|origin)?/i, cmd: 'git push origin HEAD', desc: 'Push to remote' },
  { match: /pull\s+(?:from\s+)?(?:remote|origin)?/i, cmd: 'git pull origin HEAD', desc: 'Pull from remote' },
  { match: /git\s+status/i, cmd: 'git status', desc: 'Show git status' },
  { match: /show\s+(?:git\s+)?log/i, cmd: 'git log --oneline -20', desc: 'Show recent git log' },
  { match: /stash\s+(all\s+)?changes/i, cmd: 'git stash', desc: 'Stash changes' },
  { match: /(?:undo|revert)\s+last\s+commit/i, cmd: 'git reset --soft HEAD~1', desc: 'Undo last commit' },
  { match: /show\s+diff/i, cmd: 'git diff', desc: 'Show unstaged changes' },
  { match: /clone\s+(\S+)/i, cmd: (m) => `git clone ${m[1]}`, desc: 'Clone repository' },

  // Docker
  { match: /list\s+(?:all\s+)?(?:running\s+)?(?:docker\s+)?containers/i, cmd: 'docker ps', desc: 'List running Docker containers' },
  { match: /list\s+all\s+(?:docker\s+)?containers/i, cmd: 'docker ps -a', desc: 'List all Docker containers' },
  { match: /stop\s+(all\s+)?containers/i, cmd: 'docker stop $(docker ps -q)', desc: 'Stop all running containers' },
  { match: /(?:remove|delete)\s+(?:all\s+)?(?:stopped\s+)?containers/i, cmd: 'docker container prune -f', desc: 'Remove stopped containers' },
  { match: /list\s+(docker\s+)?images/i, cmd: 'docker images', desc: 'List Docker images' },
  { match: /build\s+(?:docker\s+)?image\s+(?:tagged?\s+)?(\S+)/i, cmd: (m) => `docker build -t ${m[1]} .`, desc: 'Build Docker image' },
  { match: /run\s+(?:docker\s+)?(?:container\s+)?(\S+)/i, cmd: (m) => `docker run -it ${m[1]}`, desc: 'Run Docker container' },
  { match: /docker\s+compose\s+up/i, cmd: 'docker compose up -d', desc: 'Start Docker Compose services' },

  // Files & directories
  { match: /(?:find|search)\s+(?:all\s+)?files?\s+(?:named?\s+)?(\S+)/i, cmd: (m) => `find . -name "${m[1]}"`, desc: 'Find files by name' },
  { match: /(?:find|search)\s+(?:for\s+)?["']?(.+?)["']?\s+in\s+files/i, cmd: (m) => `grep -r "${m[1]}" .`, desc: 'Search in files' },
  { match: /count\s+(?:lines?\s+)?(?:in|of)\s+(\S+)/i, cmd: (m) => `wc -l ${m[1]}`, desc: 'Count lines in file' },
  { match: /show\s+disk\s+(?:usage|space)/i, cmd: 'df -h', desc: 'Show disk usage' },
  { match: /show\s+(?:directory|folder)\s+size/i, cmd: 'du -sh *', desc: 'Show directory sizes' },
  { match: /list\s+(?:files?|directory|folder)/i, cmd: 'ls -la', desc: 'List files in detail' },
  { match: /(?:create|make)\s+(?:a\s+)?directory\s+(\S+)/i, cmd: (m) => `mkdir -p ${m[1]}`, desc: 'Create directory' },
  { match: /(?:delete|remove)\s+(?:file\s+)?(\S+)/i, cmd: (m) => `rm -i ${m[1]}`, desc: 'Delete file (with confirmation)' },

  // Processes
  { match: /(?:show|list)\s+(?:running\s+)?processes/i, cmd: 'ps aux', desc: 'Show running processes' },
  { match: /kill\s+(?:process\s+)?(?:on\s+)?port\s+(\d+)/i, cmd: (m) => `lsof -ti:${m[1]} | xargs kill -9`, desc: 'Kill process on port' },
  { match: /(?:what|which)\s+(?:is\s+)?(?:running\s+)?on\s+port\s+(\d+)/i, cmd: (m) => `lsof -i:${m[1]}`, desc: 'Check what runs on port' },
  { match: /(?:show|check)\s+(?:system\s+)?memory/i, cmd: 'free -h || vm_stat', desc: 'Show memory usage' },

  // npm/Node
  { match: /install\s+(?:npm\s+)?(?:package\s+)?(\S+)/i, cmd: (m) => `npm install ${m[1]}`, desc: 'Install npm package' },
  { match: /(?:run|start)\s+dev\s+server/i, cmd: 'npm run dev', desc: 'Start dev server' },
  { match: /run\s+tests?/i, cmd: 'npm test', desc: 'Run tests' },
  { match: /(?:update|upgrade)\s+(?:all\s+)?(?:npm\s+)?packages/i, cmd: 'npm update', desc: 'Update npm packages' },
  { match: /(?:list|show)\s+outdated/i, cmd: 'npm outdated', desc: 'Show outdated packages' },

  // Network
  { match: /(?:check|ping)\s+(\S+)/i, cmd: (m) => `ping -c 4 ${m[1]}`, desc: 'Ping host' },
  { match: /(?:show|check)\s+(?:my\s+)?ip/i, cmd: 'curl -s ifconfig.me', desc: 'Show public IP' },
  { match: /download\s+(\S+)/i, cmd: (m) => `curl -O ${m[1]}`, desc: 'Download file' },
  { match: /(?:show|check)\s+(?:network\s+)?ports/i, cmd: 'netstat -tlnp 2>/dev/null || ss -tlnp', desc: 'Show listening ports' },

  // System
  { match: /(?:show|check)\s+(?:system\s+)?uptime/i, cmd: 'uptime', desc: 'Show system uptime' },
  { match: /(?:what|which)\s+(?:os|system)/i, cmd: 'uname -a', desc: 'Show system info' },
  { match: /(?:show|check)\s+environment\s+variables/i, cmd: 'env | sort', desc: 'Show environment variables' },
  { match: /(?:show|find)\s+(?:where\s+)?(\S+)\s+(?:is\s+)?installed/i, cmd: (m) => `which ${m[1]}`, desc: 'Find command location' },

  // AWS
  { match: /list\s+(?:aws\s+)?s3\s+buckets/i, cmd: 'aws s3 ls', desc: 'List S3 buckets' },
  { match: /list\s+(?:aws\s+)?ec2\s+instances/i, cmd: 'aws ec2 describe-instances --output table', desc: 'List EC2 instances' },
  { match: /(?:who|which)\s+(?:aws\s+)?(?:am\s+)?i/i, cmd: 'aws sts get-caller-identity', desc: 'Show AWS identity' },

  // kubectl
  { match: /list\s+(?:all\s+)?pods/i, cmd: 'kubectl get pods -A', desc: 'List all Kubernetes pods' },
  { match: /list\s+(?:all\s+)?services/i, cmd: 'kubectl get services -A', desc: 'List all Kubernetes services' },
  { match: /(?:show|describe)\s+pod\s+(\S+)/i, cmd: (m) => `kubectl describe pod ${m[1]}`, desc: 'Describe pod' },
  { match: /(?:show|get)\s+logs?\s+(?:for\s+)?(\S+)/i, cmd: (m) => `kubectl logs ${m[1]}`, desc: 'Show pod logs' },
];

/**
 * Execute the translate command.
 * @param {string[]} args
 * @param {object} flags
 */
export async function execute(args, flags) {
  const query = args.join(' ');

  if (!query) {
    writeLine(`\n  ${FG.red}✗${RESET} Please provide a natural language query.`);
    writeLine(`  ${DIM}Usage: clia translate "list all running docker containers"${RESET}\n`);
    return;
  }

  writeLine('');
  writeLine(`  ${FG.brightCyan}⟳${RESET} Translating: ${DIM}"${query}"${RESET}`);
  writeLine('');

  const result = translate(query);

  if (!result) {
    writeLine(`  ${FG.yellow}⚠${RESET} Could not translate this query to a command.`);
    writeLine(`  ${DIM}Try rephrasing or use more specific language.${RESET}\n`);
    return;
  }

  // Display the translated command
  writeLine(`  ${FG.green}✓${RESET} ${BOLD}Translated command:${RESET}`);
  writeLine('');
  writeLine(`    ${BG.black}${FG.brightGreen}  ${result.cmd}  ${RESET}`);
  writeLine('');
  writeLine(`  ${DIM}${result.desc}${RESET}`);
  writeLine('');

  if (flags['--dry-run']) {
    writeLine(`  ${DIM}(dry-run: command not executed)${RESET}\n`);
    return;
  }

  // Ask for confirmation
  writeLine(`  ${FG.brightCyan}[R]${RESET}un  ${FG.brightYellow}[M]${RESET}odify  ${FG.brightRed}[C]${RESET}ancel  ${FG.brightGreen}[T]${RESET}rust & Run`);
  writeLine('');

  if (flags['--execute']) {
    writeLine(`  ${DIM}Auto-executing (--execute flag)...${RESET}`);
    await executeCommand(result.cmd);
    return;
  }

  // Wait for user choice
  const cleanup = enterRawMode();
  try {
    const key = await readKey();

    if (key.name === 'r' || key.name === 'return') {
      writeLine(`\n  ${FG.green}▶${RESET} Executing...\n`);
      cleanup();
      await executeCommand(result.cmd);
    } else if (key.name === 't') {
      writeLine(`\n  ${FG.green}▶${RESET} Trusted & executing...\n`);
      addToHistory(result.cmd);
      cleanup();
      await executeCommand(result.cmd);
    } else if (key.name === 'm') {
      writeLine(`\n  ${DIM}Edit feature: modify the command in your editor.${RESET}\n`);
      cleanup();
    } else {
      writeLine(`\n  ${FG.red}✗${RESET} Cancelled.\n`);
      cleanup();
    }
  } catch {
    cleanup();
  }
}

/**
 * Translate a natural language query to a shell command.
 * @param {string} query
 * @returns {{ cmd: string, desc: string } | null}
 */
function translate(query) {
  for (const pattern of PATTERNS) {
    const match = query.match(pattern.match);
    if (match) {
      const cmd = typeof pattern.cmd === 'function' ? pattern.cmd(match) : pattern.cmd;
      return { cmd, desc: pattern.desc };
    }
  }
  return null;
}

/**
 * Execute a shell command.
 * @param {string} cmd
 */
async function executeCommand(cmd) {
  const { execSync } = await import('child_process');
  try {
    const output = execSync(cmd, {
      encoding: 'utf8',
      stdio: ['inherit', 'pipe', 'pipe'],
      timeout: 30000,
    });
    if (output) {
      process.stdout.write(output);
    }
    addToHistory(cmd);
  } catch (err) {
    writeLine(`  ${FG.red}✗${RESET} Command failed: ${err.message}`);
    if (err.stderr) {
      writeLine(`  ${DIM}${err.stderr.trim()}${RESET}`);
    }
  }
}

export const meta = {
  name: 'translate',
  description: 'Translate natural language to a shell command',
};
