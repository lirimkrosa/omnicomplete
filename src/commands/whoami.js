/**
 * Whoami Command — display current user and environment info.
 * No authentication required — shows local system info.
 */

import { userInfo, hostname, platform, arch, release, cpus, totalmem, freemem } from 'os';
import { RESET, BOLD, DIM, FG } from '../utils/ansi.js';
import { writeLine, printHeader, printSeparator, getShell, getTerminalEmulator, getTerminalSize } from '../utils/terminal.js';

export async function execute(args, flags) {
  const user = userInfo();
  const info = {
    username: user.username,
    homedir: user.homedir,
    shell: getShell(),
    terminal: getTerminalEmulator(),
    hostname: hostname(),
    platform: platform(),
    arch: arch(),
    release: release(),
    nodeVersion: process.version,
    terminalSize: getTerminalSize(),
    cpuCores: cpus().length,
    totalMemory: formatBytes(totalmem()),
    freeMemory: formatBytes(freemem()),
    cwd: process.cwd(),
    pid: process.pid,
  };

  if (flags['--json']) {
    writeLine(JSON.stringify(info, null, 2));
    return;
  }

  writeLine('');
  writeLine(`  ${FG.brightCyan}👤${RESET} ${BOLD}${info.username}${RESET} ${DIM}@${RESET} ${info.hostname}`);
  printSeparator(50);
  writeLine(`  ${DIM}Shell:${RESET}       ${info.shell}`);
  writeLine(`  ${DIM}Terminal:${RESET}    ${info.terminal}`);
  writeLine(`  ${DIM}Platform:${RESET}    ${info.platform} ${info.arch}`);
  writeLine(`  ${DIM}OS Release:${RESET}  ${info.release}`);
  writeLine(`  ${DIM}Node:${RESET}        ${info.nodeVersion}`);
  writeLine(`  ${DIM}CPU Cores:${RESET}   ${info.cpuCores}`);
  writeLine(`  ${DIM}Memory:${RESET}      ${info.freeMemory} free / ${info.totalMemory} total`);
  writeLine(`  ${DIM}CWD:${RESET}         ${info.cwd}`);
  writeLine(`  ${DIM}Term Size:${RESET}   ${info.terminalSize.columns}×${info.terminalSize.rows}`);
  writeLine(`  ${DIM}PID:${RESET}         ${info.pid}`);
  writeLine('');
}

function formatBytes(bytes) {
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let i = 0;
  let val = bytes;
  while (val >= 1024 && i < units.length - 1) {
    val /= 1024;
    i++;
  }
  return `${val.toFixed(1)} ${units[i]}`;
}

export const meta = {
  name: 'whoami',
  description: 'Display current user and environment info',
};
