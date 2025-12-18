import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsInt,
  Min,
  Max,
} from 'class-validator';

/**
 * Piper TTS voice models for AI Speaking
 * 10 diverse English voices (US/GB accents, male/female, multi-speaker)
 * Reference: https://github.com/rhasspy/piper/blob/master/VOICES.md
 * NOTE: No Australian (en_AU) voices available in Piper
 */
export enum TtsVoice {
  // US English
  US_FEMALE_AMY = 'en_US-amy-medium',
  US_MALE_JOHN = 'en_US-john-medium',
  US_FEMALE_LESSAC = 'en_US-lessac-medium',
  US_MALE_RYAN = 'en_US-ryan-medium',
  US_FEMALE_KRISTIN = 'en_US-kristin-medium', // Child-like voice

  // British English
  GB_MALE_ALAN = 'en_GB-alan-medium',
  GB_FEMALE_CORI = 'en_GB-cori-medium',
  GB_FEMALE_JENNY = 'en_GB-jenny_dioco-medium',

  // Multi-speaker LibriTTS (US) - libritts_r for medium quality
  US_NATIVE_1 = 'en_US-libritts_r-medium:0',
  US_NATIVE_2 = 'en_US-libritts_r-medium:142',
  US_NATIVE_3 = 'en_US-libritts_r-medium:508',
}

/**
 * Voice metadata for frontend display
 */
export interface VoiceMetadata {
  id: TtsVoice;
  label: string;
  accent: 'US' | 'GB';
  gender: 'M' | 'F' | 'Neutral';
  model: string;
  speakerId: number;
  description: string;
}

/**
 * Request DTO for TTS synthesis
 */
export class TtsRequestDto {
  @IsString()
  @IsNotEmpty()
  text: string;

  @IsEnum(TtsVoice)
  @IsOptional()
  voice?: TtsVoice = TtsVoice.US_FEMALE_AMY;

  @IsInt()
  @Min(0)
  @Max(903)
  @IsOptional()
  speakerId?: number; // For LibriTTS multi-speaker models
}

/**
 * Helper: Parse voice string to extract model and speaker ID
 * e.g., 'en_US-libritts-medium:142' -> { model: 'en_US-libritts-medium', speakerId: 142 }
 */
export function parseVoice(voice: TtsVoice): {
  model: string;
  speakerId: number;
} {
  const parts = voice.split(':');
  const parsedSpeakerId = parts[1] ? parseInt(parts[1], 10) : 0;
  return {
    model: parts[0],
    speakerId: Number.isNaN(parsedSpeakerId) ? 0 : parsedSpeakerId,
  };
}

/**
 * DTO for voice preview request
 */
export class VoicePreviewDto {
  @IsEnum(TtsVoice)
  @IsNotEmpty()
  voice: TtsVoice;

  @IsString()
  @IsOptional()
  text?: string;
}

/**
 * Voice catalog for frontend - 10 verified Piper voices
 */
export const VOICE_CATALOG: VoiceMetadata[] = [
  {
    id: TtsVoice.US_FEMALE_AMY,
    label: 'American Female (Amy)',
    accent: 'US',
    gender: 'F',
    model: 'en_US-amy-medium',
    speakerId: 0,
    description: 'Clear, professional US female voice',
  },
  {
    id: TtsVoice.US_MALE_JOHN,
    label: 'American Male (John)',
    accent: 'US',
    gender: 'M',
    model: 'en_US-john-medium',
    speakerId: 0,
    description: 'Neutral, easy-to-understand US male voice',
  },
  {
    id: TtsVoice.US_FEMALE_LESSAC,
    label: 'American Female (Lessac)',
    accent: 'US',
    gender: 'F',
    model: 'en_US-lessac-medium',
    speakerId: 0,
    description: 'Alternative US female voice',
  },
  {
    id: TtsVoice.US_MALE_RYAN,
    label: 'American Male (Ryan)',
    accent: 'US',
    gender: 'M',
    model: 'en_US-ryan-medium',
    speakerId: 0,
    description: 'Natural US male voice',
  },
  {
    id: TtsVoice.US_FEMALE_KRISTIN,
    label: 'American Girl (Kristin)',
    accent: 'US',
    gender: 'F',
    model: 'en_US-kristin-medium',
    speakerId: 0,
    description: 'Young, energetic US female voice',
  },
  {
    id: TtsVoice.GB_MALE_ALAN,
    label: 'British Male (Alan)',
    accent: 'GB',
    gender: 'M',
    model: 'en_GB-alan-medium',
    speakerId: 0,
    description: 'Received Pronunciation (RP) British accent',
  },
  {
    id: TtsVoice.GB_FEMALE_CORI,
    label: 'British Female (Cori)',
    accent: 'GB',
    gender: 'F',
    model: 'en_GB-cori-medium',
    speakerId: 0,
    description: 'Clear British female voice',
  },
  {
    id: TtsVoice.GB_FEMALE_JENNY,
    label: 'British Female (Jenny)',
    accent: 'GB',
    gender: 'F',
    model: 'en_GB-jenny_dioco-medium',
    speakerId: 0,
    description: 'Natural British female voice',
  },
  {
    id: TtsVoice.US_NATIVE_1,
    label: 'Native Speaker 1',
    accent: 'US',
    gender: 'Neutral',
    model: 'en_US-libritts_r-medium',
    speakerId: 0,
    description: 'Natural US speaker from LibriTTS dataset',
  },
  {
    id: TtsVoice.US_NATIVE_2,
    label: 'Native Speaker 2',
    accent: 'US',
    gender: 'Neutral',
    model: 'en_US-libritts_r-medium',
    speakerId: 142,
    description: 'Natural US speaker from LibriTTS dataset',
  },
  {
    id: TtsVoice.US_NATIVE_3,
    label: 'Native Speaker 3',
    accent: 'US',
    gender: 'Neutral',
    model: 'en_US-libritts_r-medium',
    speakerId: 508,
    description: 'Natural US speaker from LibriTTS dataset',
  },
];

/**
 * Multi-voice subset for performance optimization
 * Generates 5 voices instead of 10 for faster response time
 * Includes best quality from US/GB male/female
 */
export const MULTI_VOICE_SUBSET: TtsVoice[] = [
  TtsVoice.US_FEMALE_AMY, // US Female (primary)
  TtsVoice.US_MALE_JOHN,
  TtsVoice.US_FEMALE_LESSAC, // US Female (alternative)
  TtsVoice.US_MALE_RYAN, // US Male
  TtsVoice.US_FEMALE_KRISTIN,
  TtsVoice.GB_MALE_ALAN, // GB Male
  TtsVoice.GB_FEMALE_CORI,
  TtsVoice.GB_FEMALE_JENNY, // GB Female
];

/** Concurrency limit for parallel TTS synthesis */
export const MULTI_VOICE_CONCURRENCY = 3;

/**
 * Helper function to extract language code from voice (backward compatibility)
 * e.g., 'en-US-Neural2-D' -> 'en-US'
 */
export function getLanguageCodeFromVoice(voice: string): string {
  const parts = voice.split('-');
  return `${parts[0]}-${parts[1]}`;
}
