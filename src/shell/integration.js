/**
 * Shell Integration — generates and installs shell hooks.
 * Supports zsh, bash, and fish.
 */

import { writeFileSync, mkdirSync, existsSync, readFileSync, appendFileSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { getShell } from '../utils/terminal.js';

const CONFIG_DIR = join(homedir(), '.cli-autocomplete');

/**
 * Generate the shell hook script for the current shell.
 * @param {string} [shell] - Override shell detection
 * @returns {{ script: string, rcFile: string, hookFile: string } | null}
 */
export function generateHook(shell) {
  shell = shell || getShell();
  const hookFile = join(CONFIG_DIR, `shell-hook.${shell === 'fish' ? 'fish' : 'sh'}`);

  switch (shell) {
    case 'zsh':
      return {
        script: generateZshHook(),
        rcFile: join(homedir(), '.zshrc'),
        hookFile,
      };
    case 'bash':
      return {
        script: generateBashHook(),
        rcFile: join(homedir(), '.bashrc'),
        hookFile,
      };
    case 'fish':
      return {
        script: generateFishHook(),
        rcFile: join(homedir(), '.config', 'fish', 'conf.d', 'clia.fish'),
        hookFile,
      };
    default:
      return null;
  }
}

/**
 * Install the shell hook.
 * @param {string} [shell]
 * @returns {{ success: boolean, message: string }}
 */
export function installHook(shell) {
  const hook = generateHook(shell);
  if (!hook) {
    return { success: false, message: `Unsupported shell: ${shell || getShell()}` };
  }

  mkdirSync(CONFIG_DIR, { recursive: true });

  // Write hook script
  writeFileSync(hook.hookFile, hook.script, { mode: 0o755, encoding: 'utf8' });

  // Check if already installed in rc file
  if (existsSync(hook.rcFile)) {
    const content = readFileSync(hook.rcFile, 'utf8');
    if (content.includes('cli-autocomplete')) {
      return { success: true, message: 'Already installed.' };
    }
  }

  // Append to rc file
  const block = shell === 'fish'
    ? hook.script
    : `\n# >>> cli-autocomplete >>>\n[ -f "${hook.hookFile}" ] && source "${hook.hookFile}"\n# <<< cli-autocomplete <<<\n`;

  try {
    if (shell === 'fish') {
      mkdirSync(join(homedir(), '.config', 'fish', 'conf.d'), { recursive: true });
      writeFileSync(hook.rcFile, block, 'utf8');
    } else {
      appendFileSync(hook.rcFile, block, 'utf8');
    }
    return { success: true, message: `Installed to ${hook.rcFile}` };
  } catch (err) {
    return { success: false, message: err.message };
  }
}

/**
 * Check if shell integration is installed.
 * @param {string} [shell]
 * @returns {boolean}
 */
export function isInstalled(shell) {
  const hook = generateHook(shell);
  if (!hook) return false;

  if (!existsSync(hook.rcFile)) return false;

  try {
    const content = readFileSync(hook.rcFile, 'utf8');
    return content.includes('cli-autocomplete');
  } catch {
    return false;
  }
}

export function generateZshHook() {
  return `#!/usr/bin/env zsh
# Omni Autocomplete — Native Zsh integration
# Auto-generated. Do not edit manually.

_omni_daemon_check() {
  if ! curl -s http://127.0.0.1:44044 >/dev/null 2>&1; then
    (omni daemon >/dev/null 2>&1 &)
  fi
}

_omni_parse_response() {
  local response="\$1"
  local nl=$'\\n'
  local new_buf="\${response%%\$nl*}"
  if [[ "\$response" == *\$nl* ]]; then
    response="\${response#*\$nl}"
  else
    response=""
  fi
  
  local highlights=()
  local hl
  
  # Only parse highlights if the daemon actually sent them
  if [[ "\$response" == *__END_HIGHLIGHTS__* ]]; then
    while true; do
      hl="\${response%%\$nl*}"
      if [[ "\$response" == *\$nl* ]]; then
        response="\${response#*\$nl}"
      else
        response=""
      fi
      if [[ -z "\$hl" || "\$hl" == "__END_HIGHLIGHTS__" ]]; then
        break
      fi
      local parts=("\${(@s/ /)hl}")
      if [[ \${#parts[@]} -eq 3 ]]; then
        highlights+=("\$(( \${#BUFFER} + 1 + \${parts[1]} )) \$(( \${#BUFFER} + 1 + \${parts[2]} )) \${parts[3]}")
      fi
    done
  fi
  
  local ansi="\$response"
  
  if [[ -n "\$new_buf" && "\$new_buf" != "__NO_CHANGE__" ]]; then
    BUFFER="\$new_buf"
    CURSOR=\${#BUFFER}
  fi
  
  # Clean out previous UI highlights before applying new state
  local filtered=()
  for old_hl in "\${region_highlight[@]}"; do
    local old_parts=("\${(@s/ /)old_hl}")
    if [[ \${old_parts[1]} -le \${#BUFFER} ]]; then
      filtered+=("\$old_hl")
    fi
  done
  region_highlight=("\${filtered[@]}")
  
  if [[ -n "\$ansi" ]]; then
    POSTDISPLAY=$'\\n'"\$ansi"
    region_highlight+=("\${highlights[@]}")
  else
    POSTDISPLAY=""
  fi
}

_omni_self_insert() {
  zle .self-insert
  local response=\$(curl -s -X POST -d "session=\$TTY" -d "action=type" -d "shell=zsh" --data-urlencode "cwd=\$PWD" --data-urlencode "buffer=\$BUFFER" http://127.0.0.1:44044 2>/dev/null)
  
  if [[ -n "\$response" ]]; then
    _omni_parse_response "\$response"
  fi
}

_omni_delete_char() {
  zle .backward-delete-char
  local response=\$(curl -s -X POST -d "session=\$TTY" -d "action=type" -d "shell=zsh" --data-urlencode "cwd=\$PWD" --data-urlencode "buffer=\$BUFFER" http://127.0.0.1:44044 2>/dev/null)
  
  if [[ -n "\$response" ]]; then
    _omni_parse_response "\$response"
  fi
}

_omni_accept() {
  local response=\$(curl -s -X POST -d "session=\$TTY" -d "action=accept" -d "shell=zsh" --data-urlencode "cwd=\$PWD" http://127.0.0.1:44044 2>/dev/null)
  
  if [[ -n "\$response" ]]; then
    _omni_parse_response "\$response"
  fi
}

_omni_next() {
  if [[ -n "$POSTDISPLAY" ]]; then
    local response=\$(curl -s -X POST -d "session=\$TTY" -d "action=next" -d "shell=zsh" --data-urlencode "cwd=\$PWD" http://127.0.0.1:44044 2>/dev/null)
    
    if [[ -n "\$response" ]]; then
      _omni_parse_response "\$response"
    fi
  else
    zle down-line-or-history
  fi
}

_omni_prev() {
  if [[ -n "$POSTDISPLAY" ]]; then
    local response=\$(curl -s -X POST -d "session=\$TTY" -d "action=prev" -d "shell=zsh" --data-urlencode "cwd=\$PWD" http://127.0.0.1:44044 2>/dev/null)
    
    if [[ -n "\$response" ]]; then
      _omni_parse_response "\$response"
    fi
  else
    zle up-line-or-history
  fi
}

_omni_execute() {
  curl -s -X POST -d "session=\$TTY" -d "action=execute" -d "shell=zsh" --data-urlencode "cwd=\$PWD" --data-urlencode "buffer=\$BUFFER" http://127.0.0.1:44044 >/dev/null 2>&1
  POSTDISPLAY=""
  zle .accept-line
}

# Bind widgets
zle -N self-insert _omni_self_insert
zle -N backward-delete-char _omni_delete_char
zle -N accept-line _omni_execute
zle -N omni-accept _omni_accept
zle -N omni-next _omni_next
zle -N omni-prev _omni_prev

bindkey '^i' omni-accept  # Tab
bindkey '^n' omni-next    # Ctrl+N
bindkey '^p' omni-prev    # Ctrl+P
bindkey '^[[A' omni-prev  # Up Arrow
bindkey '^[[B' omni-next  # Down Arrow
bindkey '^[OA' omni-prev  # Up Arrow (alternate)
bindkey '^[OB' omni-next  # Down Arrow (alternate)

# Precmd hook to ensure daemon is running
autoload -Uz add-zsh-hook
add-zsh-hook precmd _omni_daemon_check
`;
}

export function generateBashHook() {
  return `#!/usr/bin/env bash
# CLI Autocomplete — Bash integration
# Auto-generated. Do not edit manually.

_clia_complete() {
  local input="\${COMP_LINE}"
  COMPREPLY=( \$(clia completion --shell bash --input "\${input}" 2>/dev/null) )
}

complete -F _clia_complete clia git npm docker aws kubectl
`;
}

export function generateFishHook() {
  return `# CLI Autocomplete — Fish integration
# Auto-generated. Do not edit manually.

function __clia_complete
  set -l input (commandline -cp)
  clia completion --shell fish --input "$input" 2>/dev/null
end

complete -c clia -f -a '(__clia_complete)'
complete -c git -f -a '(__clia_complete)'
complete -c npm -f -a '(__clia_complete)'
complete -c docker -f -a '(__clia_complete)'
`;
}
