/**
 * Keybindings — key event mapping and handling for the autocomplete system.
 */

/**
 * @typedef {Object} KeyBinding
 * @property {string} key - Key name
 * @property {boolean} [ctrl] - Ctrl modifier
 * @property {boolean} [shift] - Shift modifier
 * @property {boolean} [meta] - Alt/Meta modifier
 * @property {string} action - Action to perform
 * @property {string} description - Human-readable description
 */

/**
 * Default keybindings for the autocomplete system.
 * @type {KeyBinding[]}
 */
export const DEFAULT_KEYBINDINGS = [
  { key: 'tab', action: 'accept-suggestion', description: 'Accept current suggestion' },
  { key: 'right', action: 'accept-ghost', description: 'Accept ghost text' },
  { key: 'up', action: 'previous-suggestion', description: 'Navigate to previous suggestion' },
  { key: 'down', action: 'next-suggestion', description: 'Navigate to next suggestion' },
  { key: 'return', action: 'execute', description: 'Execute command / select' },
  { key: 'escape', action: 'dismiss', description: 'Dismiss dropdown' },
  { key: 'space', ctrl: true, action: 'force-complete', description: 'Force show suggestions' },
  { key: 's', ctrl: true, shift: true, action: 'toggle-settings', description: 'Toggle toolbar/settings' },
  { key: 'backspace', action: 'delete-char', description: 'Delete character' },
  { key: 'c', ctrl: true, action: 'interrupt', description: 'Cancel / exit' },
  { key: 'd', ctrl: true, action: 'exit', description: 'Exit' },
  { key: 'l', ctrl: true, action: 'clear-screen', description: 'Clear screen' },
  { key: 'u', ctrl: true, action: 'clear-line', description: 'Clear line' },
  { key: 'w', ctrl: true, action: 'delete-word', description: 'Delete word' },
  { key: 'pageup', action: 'scroll-up', description: 'Scroll suggestions up' },
  { key: 'pagedown', action: 'scroll-down', description: 'Scroll suggestions down' },
  { key: 'home', action: 'cursor-home', description: 'Move cursor to start' },
  { key: 'end', action: 'cursor-end', description: 'Move cursor to end' },
];

/**
 * Resolve a key event to an action.
 * @param {{ name: string, ctrl: boolean, shift: boolean, meta: boolean }} keyEvent
 * @param {KeyBinding[]} [bindings] - Custom bindings (defaults to DEFAULT_KEYBINDINGS)
 * @returns {string | null} - Action name, or null if no binding matches
 */
export function resolveAction(keyEvent, bindings = DEFAULT_KEYBINDINGS) {
  for (const binding of bindings) {
    if (binding.key !== keyEvent.name) continue;
    if (binding.ctrl && !keyEvent.ctrl) continue;
    if (binding.shift && !keyEvent.shift) continue;
    if (binding.meta && !keyEvent.meta) continue;
    if (!binding.ctrl && keyEvent.ctrl && binding.key.length === 1) continue;
    return binding.action;
  }

  // If it's a printable character, return 'insert-char'
  if (keyEvent.name.length === 1 && !keyEvent.ctrl && !keyEvent.meta) {
    return 'insert-char';
  }

  return null;
}

/**
 * Get a human-readable description of a key combination.
 * @param {KeyBinding} binding
 * @returns {string}
 */
export function formatBinding(binding) {
  const parts = [];
  if (binding.ctrl) parts.push('Ctrl');
  if (binding.shift) parts.push('Shift');
  if (binding.meta) parts.push('Alt');

  const keyName = binding.key.charAt(0).toUpperCase() + binding.key.slice(1);
  parts.push(keyName);

  return parts.join('+');
}

/**
 * Get all bindings as a formatted table.
 * @returns {Array<{ shortcut: string, action: string, description: string }>}
 */
export function getBindingsTable() {
  return DEFAULT_KEYBINDINGS.map(b => ({
    shortcut: formatBinding(b),
    action: b.action,
    description: b.description,
  }));
}
