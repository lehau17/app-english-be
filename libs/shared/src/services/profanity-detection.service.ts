import { Injectable, Logger } from '@nestjs/common';
import { GeminiService } from '../ai/gemini.service';

export interface ProfanityCheckResult {
    hasProfanity: boolean;
    severity: 'none' | 'mild' | 'moderate' | 'severe';
    detectedWords: string[];
    confidence: number;
    explanation?: string;
}

@Injectable()
export class ProfanityDetectionService {
    private readonly logger = new Logger(ProfanityDetectionService.name);

    constructor(private readonly geminiService: GeminiService) { }

    /**
     * Check if text contains profanity or inappropriate language
     */
    async checkText(text: string): Promise<ProfanityCheckResult> {
        if (!text || text.trim().length === 0) {
            return {
                hasProfanity: false,
                severity: 'none',
                detectedWords: [],
                confidence: 1.0,
            };
        }

        try {
            const prompt = `You are a content moderation AI. Analyze the following text for profanity, offensive language, hate speech, or inappropriate content.

Text to analyze: "${text}"

Respond ONLY with a JSON object in this exact format:
{
  "hasProfanity": boolean,
  "severity": "none" | "mild" | "moderate" | "severe",
  "detectedWords": ["word1", "word2"],
  "confidence": number (0-1),
  "explanation": "brief explanation"
}

Severity levels:
- none: Clean, appropriate language
- mild: Minor inappropriate language, slang
- moderate: Clear profanity or offensive terms
- severe: Hate speech, slurs, extremely offensive content

Be strict but fair. Consider context. Return confidence between 0 and 1.`;

            const result = await this.geminiService.generateResponse(prompt);

            // Parse JSON response
            const jsonMatch = result.match(/\{[\s\S]*\}/);
            if (!jsonMatch) {
                this.logger.warn('Failed to parse Gemini response for profanity check');
                return {
                    hasProfanity: false,
                    severity: 'none',
                    detectedWords: [],
                    confidence: 0,
                };
            }

            const parsed = JSON.parse(jsonMatch[0]) as ProfanityCheckResult;

            this.logger.debug(
                `Profanity check result: ${parsed.hasProfanity ? 'DETECTED' : 'CLEAN'} (severity: ${parsed.severity}, confidence: ${parsed.confidence})`,
            );

            return parsed;
        } catch (error) {
            this.logger.error(
                `Profanity detection failed: ${error.message}`,
                error.stack,
            );
            // Fail open - don't ban on error
            return {
                hasProfanity: false,
                severity: 'none',
                detectedWords: [],
                confidence: 0,
                explanation: 'Detection service error',
            };
        }
    }

    /**
     * Check if severity level warrants a violation count
     */
    shouldCountViolation(severity: ProfanityCheckResult['severity']): boolean {
        return severity === 'moderate' || severity === 'severe';
    }
}

