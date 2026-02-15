/**
 * Simple word-level diff utility (LCS-based).
 * Compares two strings and returns an array of segments indicating matches and mismatches.
 *
 * @param {string} original - The original text (search query).
 * @param {string} candidate - The candidate text (found result).
 * @returns {Array<{ value: string, type: 'match' | 'diff' | 'neutral' }>}
 */
export function diffText(original, candidate) {
  if (!original || !candidate) {
    return [{ value: candidate || '', type: 'neutral' }];
  }

  // Tokenize by splitting on whitespace but keeping delimiters to preserve formatting
  const tokenize = (str) => {
    // Split by whitespace sequences but keep them
    // This regex splits by whitespace sequences, capturing delimiter
    const parts = str.split(/(\s+)/);
    // Filter out empty strings if any (e.g. from start/end)
    return parts.filter(p => p.length > 0);
  };

  const originalTokens = tokenize(original);
  const candidateTokens = tokenize(candidate);

  const m = originalTokens.length;
  const n = candidateTokens.length;

  // DP table for Longest Common Subsequence length
  const dp = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const token1 = originalTokens[i - 1].trim().toLowerCase();
      const token2 = candidateTokens[j - 1].trim().toLowerCase();
      
      // Treat pure whitespace as match if surrounding context matches?
      // Or just ignore whitespace in comparison logic but use strict equality?
      // For simplicity: trim comparison.
      
      if (token1 === token2) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  // Backtrack to build the diff
  let i = m;
  let j = n;
  const result = [];

  while (i > 0 && j > 0) {
    const token1 = originalTokens[i - 1].trim().toLowerCase();
    const token2 = candidateTokens[j - 1].trim().toLowerCase();

    if (token1 === token2) {
      result.unshift({
        value: candidateTokens[j - 1], // Use candidate's original casing/spacing
        type: 'match'
      });
      i--;
      j--;
    } else if (dp[i - 1][j] > dp[i][j - 1]) {
      // Deletion from original (exists in original but not in candidate)
      // Since we display ONLY the candidate text, deletions from original are invisible.
      i--;
    } else {
      // Insertion into candidate (exists in candidate but not in original)
      result.unshift({
        value: candidateTokens[j - 1],
        type: 'diff'
      });
      j--;
    }
  }

  // If candidate has remaining tokens at the start (insertions)
  while (j > 0) {
     result.unshift({
        value: candidateTokens[j - 1],
        type: 'diff'
      });
      j--;
  }

  // We ignore remaining tokens in original (deletions) as we only render candidate text.

  // Post-processing: Collapse adjacent segments of same type
  if (result.length === 0) return [];

  const collapsed = [];
  let current = result[0];

  for (let k = 1; k < result.length; k++) {
    if (result[k].type === current.type) {
      current.value += result[k].value;
    } else {
      collapsed.push(current);
      current = result[k];
    }
  }
  collapsed.push(current);

  return collapsed;
}
