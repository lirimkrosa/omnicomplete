/**
 * Ghost Text — renders inline dim/gray suggestions after the cursor.
 * Accept with Right Arrow or Tab. Typing further refines or dismisses.
 */

import { DIM, RESET, FG, screen } from '../utils/ansi.js';
import { write } from '../utils/terminal.js';

/**
 * Render ghost text suggestion inline.
 * @param {string} suggestion - The full suggestion text
 * @param {string} currentInput - What the user has typed so far
 * @returns {string} The ghost text portion to display
 */
export function getGhostText(suggestion, currentInput) {
  if (!suggestion || !currentInput) return '';

  // Find common prefix
  const lowerSugg = suggestion.toLowerCase();
  const lowerInput = currentInput.toLowerCase();

  if (!lowerSugg.startsWith(lowerInput)) {
    // Try matching from the last token
    const lastSpace = currentInput.lastIndexOf(' ');
    if (lastSpace !== -1) {
      const lastToken = currentInput.slice(lastSpace + 1).toLowerCase();
      if (lowerSugg.startsWith(lastToken)) {
        return suggestion.slice(lastToken.length);
      }
    }
    return '';
  }

  return suggestion.slice(currentInput.length);
}

/**
 * Display ghost text at the current cursor position.
 * @param {string} ghostPart - The part to show as ghost text
 */
export function displayGhostText(ghostPart) {
  if (!ghostPart) return;
  write(`${DIM}${FG.gray}${ghostPart}${RESET}${'\x1b[' + ghostPart.length + 'D'}`);
}

/**
 * Clear ghost text from display.
 * @param {number} length - Length of ghost text to clear
 */
export function clearGhostText(length) {
  if (length <= 0) return;
  write(screen.clearToEnd);
}

/**
 * Calculate what ghost text to show based on current suggestions.
 * @param {import('../core/suggestion-engine.js').Suggestion[]} suggestions
 * @param {string} currentInput - Full current input line
 * @returns {{ text: string, ghostPart: string } | null}
 */
export function computeGhostSuggestion(suggestions, currentInput) {
  if (!suggestions || suggestions.length === 0) return null;

  // Use the top-scoring suggestion
  const top = suggestions[0];
  const ghostPart = getGhostText(top.text, currentInput.trim());

  if (!ghostPart) {
    // Try with the last token only
    const lastSpace = currentInput.lastIndexOf(' ');
    const lastToken = lastSpace !== -1 ? currentInput.slice(lastSpace + 1) : currentInput;
    const gp = getGhostText(top.text, lastToken);
    if (gp) {
      return { text: top.text, ghostPart: gp };
    }
    return null;
  }

  return { text: top.text, ghostPart };
}

/**
 * Render a full-line ghost suggestion (for history-based predictions).
 * @param {string} historySuggestion - Full command from history
 * @param {string} currentInput - Current input
 * @returns {string | null}
 */
export function getFullLineGhost(historySuggestion, currentInput) {
  if (!historySuggestion || !currentInput) return null;

  const lower = historySuggestion.toLowerCase();
  const lowerInput = currentInput.toLowerCase();

  if (lower.startsWith(lowerInput) && lower !== lowerInput) {
    return historySuggestion.slice(currentInput.length);
  }

  return null;
}
