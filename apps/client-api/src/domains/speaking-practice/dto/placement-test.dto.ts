/**
 * Speaking Placement Test DTOs
 * Assesses user's initial pronunciation level and provides personalized recommendations
 */

// Test item structure
export interface PlacementTestItem {
  id: string;
  type: 'word' | 'phrase' | 'sentence';
  text: string;
  targetPhonemes: string[];
  difficulty: number; // 1-3
  audioPromptUrl?: string;
}

// User response for a test item
export interface PlacementTestResponse {
  itemId: string;
  userTranscript: string;
  audioUrl?: string;
  pronunciationScore: number; // 0-100
  phonemeScores: Record<string, number>; // { "θ": 85, "ð": 70, ... }
  timestamp: Date;
}

// Request DTOs
export class StartPlacementTestDto {
  skipIfHasData?: boolean;
}

export class SubmitPlacementResponseDto {
  itemId: string;
  userTranscript: string;
  audioUrl?: string;
  pronunciationScore: number;
  phonemeScores?: Record<string, number>;
}

// Response DTOs
export class PlacementTestStatusDto {
  status: 'not_started' | 'in_progress' | 'completed';
  currentItemIndex?: number;
  totalItems?: number;
  progress?: number;
  canSkip?: boolean;
}

export class PlacementTestItemDto {
  item: PlacementTestItem;
  itemIndex: number;
  totalItems: number;
  isLast: boolean;
}

export class PlacementTestResultDto {
  overallLevel: number;
  totalScore: number;
  phonemeAssessment: Record<string, number>;
  topicRecommendations: Record<string, number>;
  weakPhonemes: string[];
  strongPhonemes: string[];
  recommendedStartingTopics: string[];
  message: string;
}

// Pre-defined test items covering key phonemes
export const PLACEMENT_TEST_ITEMS: PlacementTestItem[] = [
  { id: 'pt-1', type: 'word', text: 'cat', targetPhonemes: ['k', 'æ', 't'], difficulty: 1 },
  { id: 'pt-2', type: 'word', text: 'dog', targetPhonemes: ['d', 'ɒ', 'ɡ'], difficulty: 1 },
  { id: 'pt-3', type: 'word', text: 'think', targetPhonemes: ['θ', 'ɪ', 'ŋk'], difficulty: 1 },
  { id: 'pt-4', type: 'word', text: 'this', targetPhonemes: ['ð', 'ɪ', 's'], difficulty: 1 },
  { id: 'pt-5', type: 'word', text: 'red', targetPhonemes: ['r', 'e', 'd'], difficulty: 1 },
  { id: 'pt-6', type: 'phrase', text: 'three birds', targetPhonemes: ['θ', 'r', 'b', 'ɜː', 'd', 'z'], difficulty: 2 },
  { id: 'pt-7', type: 'phrase', text: 'the weather', targetPhonemes: ['ð', 'w', 'e', 'ð', 'ə'], difficulty: 2 },
  { id: 'pt-8', type: 'phrase', text: 'very good', targetPhonemes: ['v', 'e', 'r', 'ɪ', 'ɡ', 'ʊ', 'd'], difficulty: 2 },
  { id: 'pt-9', type: 'phrase', text: 'long walk', targetPhonemes: ['l', 'ɒ', 'ŋ', 'w', 'ɔː', 'k'], difficulty: 2 },
  { id: 'pt-10', type: 'phrase', text: 'fresh fish', targetPhonemes: ['f', 'r', 'e', 'ʃ', 'ɪ'], difficulty: 2 },
  { id: 'pt-11', type: 'sentence', text: 'The thin man thinks.', targetPhonemes: ['ð', 'θ', 'ɪ', 'n', 'm', 'æ', 'ŋ', 'k', 's'], difficulty: 3 },
  { id: 'pt-12', type: 'sentence', text: 'She sells seashells.', targetPhonemes: ['ʃ', 'i', 's', 'e', 'l', 'z'], difficulty: 3 },
  { id: 'pt-13', type: 'sentence', text: 'Red lorry, yellow lorry.', targetPhonemes: ['r', 'e', 'd', 'l', 'ɒ', 'r', 'ɪ', 'j', 'e', 'l', 'əʊ'], difficulty: 3 },
  { id: 'pt-14', type: 'sentence', text: 'I think the weather is nice.', targetPhonemes: ['aɪ', 'θ', 'ɪ', 'ŋ', 'k', 'ð', 'w', 'e', 'ð', 'ə', 'ɪ', 'z', 'n', 'aɪ', 's'], difficulty: 3 },
  { id: 'pt-15', type: 'sentence', text: 'Peter picked a pepper.', targetPhonemes: ['p', 'iː', 't', 'ə', 'ɪ', 'k', 't', 'e', 'p', 'ə'], difficulty: 3 },
];

// Phoneme to topic mapping
export const PHONEME_TOPIC_MAP: Record<string, string[]> = {
  'θ': ['Numbers & Time', 'Body & Health', 'Describing Things'],
  'ð': ['Daily Activities', 'Greetings', 'Family'],
  'r': ['Animals', 'Colors & Shapes', 'Travel & Directions'],
  'l': ['Animals', 'School & Learning', 'Daily Activities'],
  'ʃ': ['Shopping', 'Food & Drinks', 'Body & Health'],
  'v': ['Travel & Directions', 'Hobbies & Interests', 'Describing Things'],
  'w': ['Daily Activities', 'Feelings & Emotions', 'Greetings'],
  'ŋ': ['Hobbies & Interests', 'Daily Activities', 'Feelings & Emotions'],
  'æ': ['Animals', 'Family', 'Food & Drinks'],
  'ɒ': ['Shopping', 'Body & Health', 'Hobbies & Interests'],
};
