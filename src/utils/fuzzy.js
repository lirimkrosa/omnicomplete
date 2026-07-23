/**
 * Fuzzy string matching engine for autocomplete suggestions.
 * Implements a scoring algorithm that rewards:
 *  - Consecutive character matches
 *  - Matches at word boundaries
 *  - Prefix matches
 *  - Exact matches
 */

/**
 * Compute a fuzzy match score between a query and a target string.
 * Returns { score, matches } where matches is an array of matched character indices.
 * Returns null if no match.
 *
 * @param {string} query - The search string (user input)
 * @param {string} target - The candidate string to match against
 * @returns {{ score: number, matches: number[] } | null}
 */
export function fuzzyMatch(query, target) {
  if (!query || !target) return null;

  const queryLower = query.toLowerCase();
  const targetLower = target.toLowerCase();

  // Exact match
  if (queryLower === targetLower) {
    return {
      score: 10000,
      matches: Array.from({ length: target.length }, (_, i) => i),
    };
  }

  // Prefix match bonus
  const isPrefix = targetLower.startsWith(queryLower);

  const matches = [];
  let score = 0;
  let queryIdx = 0;
  let lastMatchIdx = -2;
  let consecutiveBonus = 0;

  for (let i = 0; i < target.length && queryIdx < query.length; i++) {
    if (targetLower[i] === queryLower[queryIdx]) {
      matches.push(i);

      // Base score for match
      let charScore = 1;

      // Consecutive match bonus
      if (i === lastMatchIdx + 1) {
        consecutiveBonus++;
        charScore += consecutiveBonus * 5;
      } else {
        consecutiveBonus = 0;
      }

      // Word boundary bonus (start of word)
      if (i === 0 || target[i - 1] === '-' || target[i - 1] === '_' || target[i - 1] === ' ' || target[i - 1] === '/') {
        charScore += 10;
      }

      // Camel case boundary bonus
      if (i > 0 && target[i] === target[i].toUpperCase() && target[i - 1] === target[i - 1].toLowerCase()) {
        charScore += 8;
      }

      // Case match bonus
      if (query[queryIdx] === target[i]) {
        charScore += 1;
      }

      score += charScore;
      lastMatchIdx = i;
      queryIdx++;
    }
  }

  // All query characters must match
  if (queryIdx !== query.length) return null;

  // Prefix bonus
  if (isPrefix) {
    score += 50;
  }

  // Shorter targets get a small bonus (prefer more specific matches)
  score += Math.max(0, 20 - target.length);

  // Penalty for unmatched gap length
  const gapPenalty = (target.length - matches.length) * 0.5;
  score -= gapPenalty;

  return { score, matches };
}

/**
 * Filter and rank a list of items by fuzzy matching.
 *
 * @param {string} query - The search query
 * @param {Array<string | { name: string }>} items - Items to filter
 * @param {object} opts
 * @param {string} opts.key - If items are objects, the key to match against
 * @param {number} opts.maxResults - Maximum results to return (default 20)
 * @returns {Array<{ item: any, score: number, matches: number[] }>}
 */
export function fuzzyFilter(query, items, opts = {}) {
  const { key = 'name', maxResults = 20 } = opts;

  if (!query) {
    // No query: return all items with neutral score
    return items.slice(0, maxResults).map(item => ({
      item,
      score: 0,
      matches: [],
    }));
  }

  const results = [];

  for (const item of items) {
    const target = typeof item === 'string' ? item : item[key];
    if (!target) continue;

    const result = fuzzyMatch(query, target);
    if (result) {
      results.push({
        item,
        score: result.score,
        matches: result.matches,
      });
    }
  }

  // Sort by score descending
  results.sort((a, b) => b.score - a.score);

  return results.slice(0, maxResults);
}

/**
 * Highlight matched characters in a string with ANSI codes.
 *
 * @param {string} text - The original text
 * @param {number[]} matchIndices - Indices of matched characters
 * @param {string} highlightStart - ANSI code to start highlight
 * @param {string} highlightEnd - ANSI code to end highlight
 * @returns {string}
 */
export function highlightMatches(text, matchIndices, highlightStart = '\x1b[1m\x1b[36m', highlightEnd = '\x1b[22m\x1b[37m') {
  if (!matchIndices || matchIndices.length === 0) return text;

  const matchSet = new Set(matchIndices);
  let result = '';
  let inHighlight = false;

  for (let i = 0; i < text.length; i++) {
    if (matchSet.has(i)) {
      if (!inHighlight) {
        result += highlightStart;
        inHighlight = true;
      }
      result += text[i];
    } else {
      if (inHighlight) {
        result += highlightEnd;
        inHighlight = false;
      }
      result += text[i];
    }
  }

  if (inHighlight) result += highlightEnd;
  return result;
}

/**
 * Simple prefix match (case-insensitive).
 * @param {string} query
 * @param {string} target
 * @returns {boolean}
 */
export function prefixMatch(query, target) {
  return target.toLowerCase().startsWith(query.toLowerCase());
}

/**
 * Check if a query is a substring of a target (case-insensitive).
 * @param {string} query
 * @param {string} target
 * @returns {boolean}
 */
export function substringMatch(query, target) {
  return target.toLowerCase().includes(query.toLowerCase());
}
