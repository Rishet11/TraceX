import stringSimilarity from 'string-similarity';

export function calculateSimilarity(text1, text2) {
  if (!text1 || !text2) return 0;

  // Normalize text: remove punctuation, extra spaces, lowercase
  const normalize = (text) => text
    .toLowerCase()
    .replace(/[^\w\s]/g, '') // Remove punctuation
    .replace(/\s+/g, ' ')     // Normalize whitespace
    .trim();
  
  const norm1 = normalize(text1);
  const norm2 = normalize(text2);
  
  if (!norm1 || !norm2) return 0;

  // Calculate similarity (0-1)
  const similarity = stringSimilarity.compareTwoStrings(norm1, norm2);
  
  // Return percentage (0-100)
  return Math.round(similarity * 100);
}
