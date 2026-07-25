document.addEventListener('DOMContentLoaded', () => {
  const input = document.getElementById('terminal-input');
  const cursor = document.getElementById('cursor');
  const measureSpan = document.getElementById('measure-span');
  const ghostText = document.getElementById('ghost-text');
  const dropdownWrapper = document.getElementById('dropdown-wrapper');
  const dropdown = document.getElementById('dropdown');
  const moreCount = document.getElementById('more-count');
  const historyContainer = document.getElementById('history');

  // Dummy Specs for Demo
  const SPECS = {
    'cd': [
      { text: 'src/', desc: 'Directory', icon: '📁', type: 'arg' },
      { text: 'lib/', desc: 'Directory', icon: '📁', type: 'arg' },
      { text: 'bin/', desc: 'Directory', icon: '📁', type: 'arg' },
      { text: 'docs/', desc: 'Directory', icon: '📁', type: 'arg' },
      { text: 'node_modules/', desc: 'Directory', icon: '📁', type: 'arg' }
    ],
    'docker': [
      { text: 'restart', desc: 'Restart one or more containers', icon: '🐳', type: 'command' },
      { text: 'compose', desc: 'Docker Compose', icon: '🐳', type: 'command' },
      { text: 'build', desc: 'Build an image from a Dockerfile', icon: '🐳', type: 'command' },
      { text: 'run', desc: 'Run a command in a new container', icon: '🐳', type: 'command' },
      { text: 'ps', desc: 'List containers', icon: '🐳', type: 'command' },
      { text: 'stop', desc: 'Stop one or more running containers', icon: '🐳', type: 'command' }
    ],
    'docker restart': [
      { text: 'api-gateway-1', desc: 'Up 5 days', icon: '🐳', type: 'arg' },
      { text: 'users-service-1', desc: 'Up 5 days', icon: '🐳', type: 'arg' },
      { text: 'auth-service-1', desc: 'Up 2 days', icon: '🐳', type: 'arg' },
      { text: 'payments-worker-1', desc: 'Exited (0) 2 days ago', icon: '🐳', type: 'arg', exited: true },
      { text: 'redis-cache-1', desc: 'Up 5 days', icon: '🐳', type: 'arg' },
      { text: 'postgres-db-1', desc: 'Up 5 days (healthy)', icon: '🐳', type: 'arg' },
      { text: 'elasticsearch-1', desc: 'Up 5 days (healthy)', icon: '🐳', type: 'arg' }
    ],
    'docker ps': [
      { text: '✨ table', desc: 'Format as ID, Name, Ports', icon: '🪄', type: 'macro', expandTo: '--format "table {{.ID}}\\t{{.Names}}\\t{{.Ports}}"' },
      { text: '✨ compact', desc: 'Format as ID: Name', icon: '🪄', type: 'macro', expandTo: '--format "{{.ID}}: {{.Names}}"' },
      { text: '✨ json', desc: 'Format as JSON', icon: '🪄', type: 'macro', expandTo: '--format "{{json .}}"' },
      { text: '-a', desc: 'Show all containers', icon: '🐳', type: 'flag' },
      { text: '-q', desc: 'Only display container IDs', icon: '🐳', type: 'flag' },
      { text: '--format', desc: 'Pretty-print containers using a Go template', icon: '🐳', type: 'flag' }
    ],
    'git': [
      { text: 'commit', desc: 'Record changes to the repository', icon: '🌿', type: 'command' },
      { text: 'push', desc: 'Update remote refs along with associated objects', icon: '🌿', type: 'command' },
      { text: 'rebase', desc: 'Reapply commits on top of another base tip', icon: '🌿', type: 'command' },
      { text: 'checkout', desc: 'Switch branches or restore working tree files', icon: '🌿', type: 'command' },
      { text: 'status', desc: 'Show the working tree status', icon: '🌿', type: 'command' }
    ],
    'git checkout': [
      { text: 'main', desc: 'Local branch', icon: '🌿', type: 'arg' },
      { text: 'feat/auth-system', desc: 'Local branch', icon: '🌿', type: 'arg' },
      { text: 'fix/dropdown-bug', desc: 'Local branch', icon: '🌿', type: 'arg' },
      { text: 'develop', desc: 'Local branch', icon: '🌿', type: 'arg' }
    ],
    'npm': [
      { text: 'install', desc: 'Install a package and its dependencies', icon: '📦', type: 'command' },
      { text: 'run', desc: 'Run arbitrary package scripts', icon: '📦', type: 'command' },
      { text: 'start', desc: 'Start a package', icon: '📦', type: 'command' },
      { text: 'test', desc: 'Test a package', icon: '📦', type: 'command' }
    ],
    'npm run': [
      { text: 'dev', desc: 'vite', icon: '⚡️', type: 'arg' },
      { text: 'build', desc: 'tsc && vite build', icon: '⚡️', type: 'arg' },
      { text: 'preview', desc: 'vite preview', icon: '⚡️', type: 'arg' },
      { text: 'lint', desc: 'eslint src --ext ts,tsx --report-unused-disable-directives --max-warnings 0', icon: '⚡️', type: 'arg' }
    ]
  };

  let currentSuggestions = [];
  let selectedIndex = 0;
  
  // Keep focus on input
  document.addEventListener('click', () => {
    input.focus();
  });
  
  input.focus();

  input.addEventListener('input', updateState);
  
  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (currentSuggestions.length > 0) {
        selectedIndex = Math.min(currentSuggestions.length - 1, selectedIndex + 1);
        renderDropdown();
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (currentSuggestions.length > 0) {
        selectedIndex = Math.max(0, selectedIndex - 1);
        renderDropdown();
      }
    } else if (e.key === 'Tab') {
      e.preventDefault();
      if (currentSuggestions.length > 0) {
        applySuggestion();
      }
    } else if (e.key === 'Enter') {
      e.preventDefault();
      executeCommand();
    }
  });

  function updateState() {
    const val = input.value;
    
    // Update cursor position
    measureSpan.textContent = val;
    
    // Animate cursor
    cursor.classList.add('typing');
    clearTimeout(window.typingTimeout);
    window.typingTimeout = setTimeout(() => {
      cursor.classList.remove('typing');
    }, 500);

    // Simple parser
    const tokens = val.trimStart().split(' ').filter(Boolean);
    const hasTrailingSpace = val.endsWith(' ');
    
    if (val.trim() === '') {
      hideDropdown();
      return;
    }
    
    let contextKey = null;
    let partial = '';
    
    if (tokens.length === 1 && !hasTrailingSpace) {
      // Typing first word
      contextKey = null;
      partial = tokens[0];
    } else if (tokens.length === 1 && hasTrailingSpace) {
      // Typed first word and space
      contextKey = tokens[0];
      partial = '';
    } else if (tokens.length === 2 && !hasTrailingSpace) {
      // Typing second word
      contextKey = tokens[0];
      partial = tokens[1];
    } else if (tokens.length === 2 && hasTrailingSpace) {
      // Typed second word and space
      contextKey = tokens.join(' ');
      partial = '';
    } else if (tokens.length === 3 && !hasTrailingSpace) {
      contextKey = tokens.slice(0, 2).join(' ');
      partial = tokens[2];
    }
    
    // Collect suggestions
    let pool = [];
    if (!contextKey && tokens.length <= 1) {
      pool = [
        { text: 'docker', desc: 'A self-sufficient runtime for containers', icon: '🐳', type: 'command' },
        { text: 'git', desc: 'the stupid content tracker', icon: '🌿', type: 'command' },
        { text: 'npm', desc: 'javascript package manager', icon: '📦', type: 'command' },
        { text: 'cd', desc: 'Change the shell working directory', icon: '📁', type: 'command' }
      ];
    } else if (SPECS[contextKey]) {
      pool = SPECS[contextKey];
    }
    
    // Filter
    if (partial) {
      currentSuggestions = pool.filter(s => s.text.startsWith(partial));
    } else {
      currentSuggestions = pool;
    }
    
    if (currentSuggestions.length > 0) {
      selectedIndex = 0;
      
      // Update ghost text
      const suggestion = currentSuggestions[0].text;
      if (partial && suggestion.startsWith(partial)) {
        ghostText.textContent = val + suggestion.slice(partial.length);
      } else if (!partial && !hasTrailingSpace && contextKey) {
         ghostText.textContent = val + ' ' + suggestion;
      } else {
        ghostText.textContent = val + suggestion;
      }
      
      showDropdown();
    } else {
      hideDropdown();
    }
  }

  function renderDropdown() {
    dropdown.innerHTML = '';
    const MAX_VISIBLE = 8;
    const visible = currentSuggestions.slice(0, MAX_VISIBLE);
    
    visible.forEach((s, i) => {
      const div = document.createElement('div');
      div.className = 'item' + (i === selectedIndex ? ' selected' : '');
      
      // Highlight matching part
      let textHtml = s.text;
      const tokens = input.value.trimStart().split(' ').filter(Boolean);
      const hasTrailingSpace = input.value.endsWith(' ');
      const partial = hasTrailingSpace ? '' : tokens[tokens.length - 1];
      
      if (partial && s.text.startsWith(partial) && tokens.length > 0 && !hasTrailingSpace) {
        textHtml = `<span class="match">${s.text.slice(0, partial.length)}</span>${s.text.slice(partial.length)}`;
      }
      
      const descClass = s.exited ? 'item-desc exited' : 'item-desc';
      
      div.innerHTML = `
        <span class="item-icon">${s.icon}</span>
        <span class="item-text">${textHtml}</span>
        <span class="${descClass}">${s.desc}</span>
      `;
      dropdown.appendChild(div);
    });
    
    if (currentSuggestions.length > MAX_VISIBLE) {
      moreCount.textContent = currentSuggestions.length - MAX_VISIBLE;
      document.getElementById('dropdown-footer').style.display = 'flex';
    } else {
      document.getElementById('dropdown-footer').style.display = 'none';
    }
  }

  function showDropdown() {
    renderDropdown();
    dropdownWrapper.classList.add('visible');
  }
  
  function hideDropdown() {
    dropdownWrapper.classList.remove('visible');
    ghostText.textContent = '';
    currentSuggestions = [];
  }
  
  function applySuggestion() {
    const s = currentSuggestions[selectedIndex];
    if (!s) return;
    
    const val = input.value;
    const tokens = val.trimStart().split(' ').filter(Boolean);
    const hasTrailingSpace = val.endsWith(' ');
    
    let newVal = '';
    const textToInsert = s.expandTo || s.text;
    
    if (tokens.length === 0) {
      newVal = textToInsert + ' ';
    } else if (hasTrailingSpace) {
      newVal = val + textToInsert + ' ';
    } else {
      // Replace last token
      tokens[tokens.length - 1] = textToInsert;
      newVal = tokens.join(' ') + ' ';
    }
    
    input.value = newVal;
    updateState();
  }
  
  function executeCommand() {
    const val = input.value.trim();
    if (!val) return;
    
    // Add to history UI
    const html = `
      <div class="prompt-line">
        <div class="prompt-info">
          <span class="dir">~/Projects/awesome-cli</span>
          <span class="branch">main</span>
          <span class="arrow">❯</span>
        </div>
        <div class="history-command">${val}</div>
      </div>
    `;
    historyContainer.insertAdjacentHTML('beforeend', html);
    
    input.value = '';
    updateState();
  }
  
  // Initial state
  updateState();
});
