/**
 * Pronunciation Scoring Utility Functions
 * MVP scoring algorithm combining Levenshtein distance, keyword matching,
 * and Google Cloud Speech confidence scores for AI Speaking Practice.
 *
 * Formula:
 * finalScore = avgConfidence × 0.5 + (1 - min(distance/5, 1)) × 0.3 + (keywordMatch/100) × 0.2
 *
 * Decision Logic (100% automated, NO human review):
 * - Score ≥75: Accept (Pass)
 * - Score <75: Retry (Request repeat)
 */

/**
 * Calculate Levenshtein distance between two strings
 * Edit distance measures minimum number of single-character edits
 * (insertions, deletions, substitutions) required to change one word into another.
 *
 * @param str1 First string (user transcript)
 * @param str2 Second string (reference text)
 * @returns Edit distance (lower = more similar)
 */
export function levenshteinDistance(str1: string, str2: string): number {
  const s1 = str1.toLowerCase().trim();
  const s2 = str2.toLowerCase().trim();

  // Edge cases
  if (s1 === s2) return 0;
  if (s1.length === 0) return s2.length;
  if (s2.length === 0) return s1.length;

  // Initialize matrix
  const matrix: number[][] = [];

  // Initialize first column (cost of deleting from s2)
  for (let i = 0; i <= s2.length; i++) {
    matrix[i] = [i];
  }

  // Initialize first row (cost of deleting from s1)
  for (let j = 0; j <= s1.length; j++) {
    matrix[0][j] = j;
  }

  // Calculate edit distance
  for (let i = 1; i <= s2.length; i++) {
    for (let j = 1; j <= s1.length; j++) {
      if (s2.charAt(i - 1) === s1.charAt(j - 1)) {
        // Characters match - no cost
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        // Characters don't match - choose minimum cost operation
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1, // insertion
          matrix[i - 1][j] + 1, // deletion
        );
      }
    }
  }

  return matrix[s2.length][s1.length];
}

/**
 * Match keywords between transcript and reference text with fuzzy tolerance
 * Allows 1-character Levenshtein distance for child pronunciation variations.
 *
 * @param transcript User's spoken transcript
 * @param referenceText Expected reference text
 * @returns Object containing matched words, missing words, and match percentage
 */
export function matchKeywords(
  transcript: string,
  referenceText: string,
): {
  matched: string[];
  missing: string[];
  matchPercent: number;
} {
  // Extract keywords (words longer than 2 characters to filter out articles)
  const refWords = referenceText
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 2);

  const userWords = transcript.toLowerCase().split(/\s+/);

  // Match keywords with fuzzy tolerance
  const matched = refWords.filter((refWord) =>
    userWords.some((userWord) => {
      const dist = levenshteinDistance(userWord, refWord);
      // Allow 1-char difference OR prefix match (first 3 chars)
      return dist <= 1 || userWord.startsWith(refWord.substring(0, 3));
    }),
  );

  const missing = refWords.filter((w) => !matched.includes(w));
  const matchPercent =
    refWords.length > 0 ? (matched.length / refWords.length) * 100 : 0;

  return { matched, missing, matchPercent };
}

/**
 * Calculate combined pronunciation score using MVP formula
 *
 * Formula:
 * finalScore = avgConfidence × 0.5 + (1 - min(distance/5, 1)) × 0.3 + (keywordMatch/100) × 0.2
 *
 * Weights:
 * - Confidence: 50% (Google Cloud Speech accuracy)
 * - Levenshtein: 30% (text similarity)
 * - Keywords: 20% (key content match)
 *
 * @param avgConfidence Average confidence from Google Cloud Speech (0-1)
 * @param levenshteinDistance Edit distance between transcript and reference
 * @param keywordMatchPercent Percentage of keywords matched (0-100)
 * @returns Combined score (0-100)
 */
export function calculateCombinedScore(
  avgConfidence: number,
  levenshteinDistance: number,
  keywordMatchPercent: number,
): number {
  // Component 1: Confidence score (0-1 range, 50% weight)
  const confidenceScore = avgConfidence;

  // Component 2: Distance score (normalize to 0-1, 30% weight)
  // Lower distance = higher score
  // Distance of 5+ = score of 0
  const distanceScore = Math.max(0, 1 - Math.min(levenshteinDistance / 5, 1));

  // Component 3: Keyword score (0-100 to 0-1 range, 20% weight)
  const keywordScore = keywordMatchPercent / 100;

  // Calculate weighted final score
  const finalScore =
    confidenceScore * 0.5 + distanceScore * 0.3 + keywordScore * 0.2;

  // Return as percentage (0-100)
  return Math.round(finalScore * 100);
}

/**
 * Extract failed phonemes from low-confidence words
 * Identifies problematic phonemes for Vietnamese speakers based on accuracy scores.
 *
 * Vietnamese problematic phonemes:
 * - /θ/ (think) → "sink"
 * - /ð/ (that) → "dat"
 * - /r/ (right) vs /l/ (light)
 * - /v/ (very) vs /w/ (wery)
 * - /ʃ/ (ship) vs /s/ (sip)
 * - /tʃ/ (church)
 * - /dʒ/ (judge)
 * - /ŋ/ (sing)
 * - /z/ (zoo)
 *
 * @param words Array of word assessments with accuracy scores
 * @param accuracyThreshold Threshold below which phonemes are considered failed (default: 70)
 * @returns Array of failed phoneme symbols
 */
export function extractFailedPhonemes(
  words: Array<{ word: string; accuracyScore: number }>,
  accuracyThreshold = 70,
): string[] {
  const VIETNAMESE_PROBLEMATIC_PHONEMES = [
    'θ', // "think" → "sink"
    'ð', // "that" → "dat"
    'r', // "right" → "light"
    'l', // "call" → "caw"
    'ʃ', // "ship" vs "sip"
    'tʃ', // "church"
    'dʒ', // "judge"
    'ŋ', // "sing"
    'z', // "zoo"
    'v', // "very" → "wery"
  ];

  const failedPhonemes = new Set<string>();

  for (const word of words) {
    if (word.accuracyScore < accuracyThreshold) {
      // Check if word contains problematic phonemes
      for (const phoneme of VIETNAMESE_PROBLEMATIC_PHONEMES) {
        if (wordContainsSound(word.word, phoneme)) {
          failedPhonemes.add(phoneme);
        }
      }
    }
  }

  return Array.from(failedPhonemes);
}

/**
 * Check if word contains specific phoneme (simplified mapping)
 * This is a basic approximation. In production, use IPA dictionary.
 *
 * @param word Word to check
 * @param phoneme IPA phoneme symbol
 * @returns True if word likely contains the phoneme
 */
function wordContainsSound(word: string, phoneme: string): boolean {
  const lower = word.toLowerCase();

  // Map phonemes to common English letter patterns
  const soundMap: Record<string, string[]> = {
    θ: ['th'], // think, thank
    ð: ['th'], // that, this
    v: ['v'], // very, have
    r: ['r'], // right, there
    l: ['l'], // light, call
    ʃ: ['sh'], // ship, wish
    tʃ: ['ch'], // church, teach
    dʒ: ['j', 'g'], // judge, gentle
    ŋ: ['ng'], // sing, long
    z: ['z'], // zoo, fizz
  };

  const patterns = soundMap[phoneme] || [];
  return patterns.some((pattern) => lower.includes(pattern));
}
