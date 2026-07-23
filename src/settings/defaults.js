/**
 * Default settings values.
 */

export const DEFAULTS = {
  autocompleteEnabled: true,
  ghostTextEnabled: true,
  fuzzyMatching: true,
  maxSuggestions: 8,
  theme: 'dark',
  layoutTheme: 'inline',
  popoverBackground: 'transparent',
  inlineSuggestionsDelay: 200,
  historyTracking: true,
  customSpecsDir: '~/.cli-autocomplete/specs/',
  trustedCommands: [],
  defaultAgent: 'default',
  showToolbar: false,
  toolbarPosition: 'right',
  debounceMs: 150,
  autoTrigger: true,
  triggerOnSpace: true,
  triggerMinChars: 1,
  configVersion: 1,
};

/**
 * Settings metadata for the TUI panel.
 */
export const SETTINGS_META = [
  // General
  { key: 'autocompleteEnabled', label: 'Autocomplete Enabled', type: 'toggle', category: 'General' },
  { key: 'ghostTextEnabled', label: 'Ghost Text Enabled', type: 'toggle', category: 'General' },
  { key: 'fuzzyMatching', label: 'Fuzzy Matching', type: 'toggle', category: 'General' },
  { key: 'historyTracking', label: 'History Tracking', type: 'toggle', category: 'General' },
  { key: 'theme', label: 'Color Scheme', type: 'select', options: ['dark', 'light', 'high-contrast'], category: 'General' },
  { key: 'layoutTheme', label: 'Layout Theme', type: 'select', options: ['inline', 'popover'], category: 'General' },
  { key: 'popoverBackground', label: 'Popover Background', type: 'select', options: ['transparent', 'solid'], category: 'General' },

  // Autocomplete
  { key: 'maxSuggestions', label: 'Max Suggestions', type: 'number', min: 3, max: 20, category: 'Autocomplete' },
  { key: 'inlineSuggestionsDelay', label: 'Suggestion Delay (ms)', type: 'number', min: 50, max: 1000, category: 'Autocomplete' },
  { key: 'debounceMs', label: 'Debounce (ms)', type: 'number', min: 50, max: 500, category: 'Autocomplete' },
  { key: 'autoTrigger', label: 'Auto Trigger', type: 'toggle', category: 'Autocomplete' },
  { key: 'triggerOnSpace', label: 'Trigger on Space', type: 'toggle', category: 'Autocomplete' },
  { key: 'triggerMinChars', label: 'Min Chars to Trigger', type: 'number', min: 1, max: 5, category: 'Autocomplete' },

  // Agents
  { key: 'defaultAgent', label: 'Default Agent', type: 'text', category: 'Agents' },

  // Paths
  { key: 'customSpecsDir', label: 'Custom Specs Directory', type: 'text', category: 'Paths' },

  // Toolbar
  { key: 'showToolbar', label: 'Show Toolbar', type: 'toggle', category: 'Toolbar' },
  { key: 'toolbarPosition', label: 'Toolbar Position', type: 'select', options: ['right', 'left'], category: 'Toolbar' },
];

/**
 * Get categories in display order.
 * @returns {string[]}
 */
export function getCategories() {
  const seen = new Set();
  return SETTINGS_META.map(s => s.category).filter(c => {
    if (seen.has(c)) return false;
    seen.add(c);
    return true;
  });
}
