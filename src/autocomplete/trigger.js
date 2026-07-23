/**
 * Trigger Logic — determines when to show autocomplete suggestions.
 * Manages debouncing, context detection, and manual trigger via keybinding.
 */

/**
 * @typedef {Object} TriggerConfig
 * @property {number} debounceMs - Milliseconds to wait after last keystroke (default 150)
 * @property {boolean} autoTrigger - Whether to trigger automatically (default true)
 * @property {boolean} triggerOnSpace - Trigger when space is typed (default true)
 * @property {boolean} triggerOnDash - Trigger when typing flags (default true)
 * @property {number} minChars - Minimum characters before triggering (default 1)
 */

/** @type {TriggerConfig} */
const defaultConfig = {
  debounceMs: 150,
  autoTrigger: true,
  triggerOnSpace: true,
  triggerOnDash: true,
  minChars: 1,
};

let _debounceTimer = null;
let _config = { ...defaultConfig };

/**
 * Update trigger configuration.
 * @param {Partial<TriggerConfig>} config
 */
export function configureTrigger(config) {
  _config = { ...defaultConfig, ...config };
}

/**
 * Check if autocomplete should trigger based on the input event.
 * @param {string} input - Current full input
 * @param {string} lastChar - The last character typed
 * @param {{ name: string, ctrl: boolean }} keyEvent - The key event
 * @returns {boolean}
 */
export function shouldTrigger(input, lastChar, keyEvent) {
  // Manual trigger: Ctrl+Space
  if (keyEvent && keyEvent.ctrl && keyEvent.name === 'space') {
    return true;
  }

  if (!_config.autoTrigger) return false;

  // Don't trigger on empty input
  if (!input || input.length === 0) return false;

  // Trigger on space (new token context)
  if (_config.triggerOnSpace && lastChar === ' ') {
    return true;
  }

  // Trigger on dash (starting a flag)
  if (_config.triggerOnDash && lastChar === '-') {
    return true;
  }

  // Check minimum characters for the current token
  const lastSpace = input.lastIndexOf(' ');
  const currentToken = lastSpace !== -1 ? input.slice(lastSpace + 1) : input;

  if (currentToken.length >= _config.minChars) {
    return true;
  }

  return false;
}

/**
 * Debounce the trigger callback.
 * @param {Function} callback - Function to call when trigger fires
 * @param {number} [delay] - Override debounce delay
 */
export function debounceTrigger(callback, delay) {
  if (_debounceTimer) {
    clearTimeout(_debounceTimer);
  }

  _debounceTimer = setTimeout(() => {
    _debounceTimer = null;
    callback();
  }, delay || _config.debounceMs);
}

/**
 * Cancel any pending debounced trigger.
 */
export function cancelTrigger() {
  if (_debounceTimer) {
    clearTimeout(_debounceTimer);
    _debounceTimer = null;
  }
}

/**
 * Check if a trigger is currently pending.
 * @returns {boolean}
 */
export function isTriggerPending() {
  return _debounceTimer !== null;
}

/**
 * Determine what kind of completion context we're in based on input.
 * @param {string} input
 * @returns {'empty' | 'command' | 'subcommand' | 'flag' | 'argument' | 'value'}
 */
export function detectContext(input) {
  if (!input || input.trim().length === 0) return 'empty';

  const trimmed = input.trimEnd();
  const tokens = trimmed.split(/\s+/);

  if (tokens.length === 0) return 'empty';
  if (tokens.length === 1 && !input.endsWith(' ')) return 'command';

  const lastToken = input.endsWith(' ') ? '' : tokens[tokens.length - 1];

  if (lastToken.startsWith('--') || lastToken.startsWith('-')) return 'flag';

  // After a command, could be subcommand or argument
  if (tokens.length <= 3) return 'subcommand';

  return 'argument';
}

/**
 * Get the current trigger configuration.
 * @returns {TriggerConfig}
 */
export function getTriggerConfig() {
  return { ..._config };
}
