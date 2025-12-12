import { GeminiService } from '@app/shared/ai/gemini.service';
import { Injectable, Logger } from '@nestjs/common';
import { ActivityType } from '@prisma/client';

interface ValidationResult {
  isValid: boolean;
  qualityScore: number; // 0-100
  issues: string[];
  llmScore?: number;
  ruleScore?: number;
}

interface ActivityContent {
  title?: string;
  description?: string;
  questions?: any[];
  answers?: any[];
  words?: any[];
  exercises?: any[];
  mediaUrls?: string[];
  [key: string]: any;
}

/**
 * Multi-tier validation service for AI-generated content
 * - Tier 1: LLM validation (70% weight)
 * - Tier 2: Rule-based validation (30% weight)
 * Combined score target: >90%
 */
@Injectable()
export class ContentValidationService {
  private readonly logger = new Logger(ContentValidationService.name);
  private readonly LLM_WEIGHT = 0.7;
  private readonly RULE_WEIGHT = 0.3;
  private readonly PASSING_THRESHOLD = 90;

  constructor(private readonly geminiService: GeminiService) {}

  /**
   * Validate activity content with multi-tier approach
   */
  async validate(
    content: ActivityContent,
    activityType: ActivityType,
    proficiencyLevel?: string,
  ): Promise<ValidationResult> {
    this.logger.debug(
      `Validating ${activityType} content for level ${proficiencyLevel}`,
    );

    // Tier 1: LLM validation
    const llmResult = await this.validateWithLLM(
      content,
      activityType,
      proficiencyLevel,
    );

    // Tier 2: Rule-based validation
    const ruleResult = this.validateWithRules(content, activityType);

    // Combined score
    const qualityScore =
      llmResult.score * this.LLM_WEIGHT + ruleResult.score * this.RULE_WEIGHT;

    const issues = [...llmResult.issues, ...ruleResult.issues];
    const isValid =
      qualityScore >= this.PASSING_THRESHOLD && issues.length === 0;

    this.logger.log(
      `Validation complete: ${activityType} - Score: ${qualityScore.toFixed(1)} (LLM: ${llmResult.score}, Rules: ${ruleResult.score})`,
    );

    return {
      isValid,
      qualityScore: Math.round(qualityScore),
      issues,
      llmScore: llmResult.score,
      ruleScore: ruleResult.score,
    };
  }

  /**
   * Tier 1: LLM-based validation using Gemini
   */
  private async validateWithLLM(
    content: ActivityContent,
    activityType: ActivityType,
    proficiencyLevel?: string,
  ): Promise<{ score: number; issues: string[] }> {
    try {
      const prompt = this.buildValidationPrompt(
        content,
        activityType,
        proficiencyLevel,
      );

      const response = await this.geminiService.generateJSONResponse(prompt);
      const result = JSON.parse(response);

      return {
        score: result.score || 0,
        issues: result.issues || [],
      };
    } catch (error) {
      this.logger.error('LLM validation failed:', error);
      // Fallback to rule-based only
      return { score: 50, issues: ['LLM validation unavailable'] };
    }
  }

  /**
   * Build validation prompt for Gemini
   */
  private buildValidationPrompt(
    content: ActivityContent,
    activityType: ActivityType,
    proficiencyLevel?: string,
  ): string {
    return `You are an English language education expert. Validate the following AI-generated activity content for quality and appropriateness.

Activity Type: ${activityType}
Proficiency Level: ${proficiencyLevel || 'B1'}

Content:
${JSON.stringify(content, null, 2)}

Validation Criteria:
1. **Content Accuracy**: Is the English correct and appropriate for the level?
2. **Educational Value**: Does it effectively teach/test the target skill?
3. **Clarity**: Are instructions and questions clear?
4. **Difficulty**: Is it appropriate for ${proficiencyLevel || 'B1'} level?
5. **Completeness**: Does it have all required components?
6. **Engagement**: Is it interesting and motivating?

Scoring:
- 90-100: Excellent, ready to use
- 70-89: Good, minor improvements needed
- 50-69: Fair, significant issues
- 0-49: Poor, major problems

Return JSON:
{
  "score": number (0-100),
  "issues": string[] (specific problems found, empty if score >= 90),
  "strengths": string[] (positive aspects),
  "recommendations": string[] (improvement suggestions if score < 90)
}`;
  }

  /**
   * Tier 2: Rule-based validation
   */
  private validateWithRules(
    content: ActivityContent,
    activityType: ActivityType,
  ): { score: number; issues: string[] } {
    const issues: string[] = [];
    let score = 100;

    // 1. Check required fields
    if (!content.title || content.title.trim().length === 0) {
      issues.push('Missing or empty title');
      score -= 20;
    }

    // 2. Check content structure based on activity type
    const structureCheck = this.validateStructure(content, activityType);
    if (!structureCheck.valid) {
      issues.push(...structureCheck.issues);
      score -= 15 * structureCheck.issues.length;
    }

    // 3. Check for empty or null values
    const hasEmptyValues = this.checkForEmptyValues(content);
    if (hasEmptyValues.found) {
      issues.push(...hasEmptyValues.issues);
      score -= 10;
    }

    // 4. Validate text quality (no gibberish, reasonable length)
    const textQuality = this.validateTextQuality(content);
    if (!textQuality.valid) {
      issues.push(...textQuality.issues);
      score -= 15;
    }

    // 5. Check media URLs if present
    if (content.mediaUrls && content.mediaUrls.length > 0) {
      const mediaCheck = this.validateMediaUrls(content.mediaUrls);
      if (!mediaCheck.valid) {
        issues.push(...mediaCheck.issues);
        score -= 10;
      }
    }

    return {
      score: Math.max(0, score),
      issues,
    };
  }

  /**
   * Validate structure based on activity type
   */
  private validateStructure(
    content: ActivityContent,
    activityType: ActivityType,
  ): { valid: boolean; issues: string[] } {
    const issues: string[] = [];

    switch (activityType) {
      case 'VOCAB':
      case 'FLASHCARD':
        if (!content.words || content.words.length === 0) {
          issues.push('VOCAB activity must have words array');
        }
        break;

      case 'QUIZ':
      case 'FILL_BLANK':
        if (!content.questions || content.questions.length === 0) {
          issues.push('Quiz activity must have questions array');
        }
        if (!content.answers || content.answers.length === 0) {
          issues.push('Quiz activity must have answers array');
        }
        break;

      case 'LISTENING':
      case 'PRONUNCIATION':
        if (!content.audioUrl && !content.text) {
          issues.push('Audio activity must have audioUrl or text');
        }
        break;

      case 'READING':
      case 'WRITING':
        if (!content.text || content.text.trim().length < 50) {
          issues.push('Reading/Writing activity must have substantial text');
        }
        break;

      case 'MATCHING':
        if (!content.pairs || content.pairs.length < 3) {
          issues.push('Matching activity must have at least 3 pairs');
        }
        break;

      default:
        // Generic check
        if (!content.exercises && !content.questions && !content.words) {
          issues.push('Activity content appears empty or invalid');
        }
    }

    return {
      valid: issues.length === 0,
      issues,
    };
  }

  /**
   * Check for empty or null values in content
   */
  private checkForEmptyValues(content: ActivityContent): {
    found: boolean;
    issues: string[];
  } {
    const issues: string[] = [];

    const checkValue = (val: any, path: string) => {
      if (val === null || val === undefined) {
        issues.push(`Null/undefined value at: ${path}`);
      } else if (typeof val === 'string' && val.trim().length === 0) {
        issues.push(`Empty string at: ${path}`);
      } else if (Array.isArray(val) && val.length === 0) {
        // Empty arrays are sometimes valid (e.g., no media)
        // Only flag if it's a critical array
        if (['questions', 'words', 'exercises'].includes(path)) {
          issues.push(`Empty critical array at: ${path}`);
        }
      }
    };

    // Recursively check object
    const traverse = (obj: any, prefix = '') => {
      Object.entries(obj).forEach(([key, value]) => {
        const path = prefix ? `${prefix}.${key}` : key;
        checkValue(value, path);

        if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
          traverse(value, path);
        }
      });
    };

    traverse(content);

    return {
      found: issues.length > 0,
      issues,
    };
  }

  /**
   * Validate text quality (no gibberish, reasonable length)
   */
  private validateTextQuality(content: ActivityContent): {
    valid: boolean;
    issues: string[];
  } {
    const issues: string[] = [];

    // Check title
    if (content.title) {
      if (content.title.length > 200) {
        issues.push('Title too long (>200 chars)');
      }
      if (this.isGibberish(content.title)) {
        issues.push('Title appears to be gibberish');
      }
    }

    // Check description
    if (content.description) {
      if (content.description.length > 1000) {
        issues.push('Description too long (>1000 chars)');
      }
      if (this.isGibberish(content.description)) {
        issues.push('Description appears to be gibberish');
      }
    }

    return {
      valid: issues.length === 0,
      issues,
    };
  }

  /**
   * Simple gibberish detection
   */
  private isGibberish(text: string): boolean {
    // Check for excessive special characters
    const specialCharRatio =
      (text.match(/[^a-zA-Z0-9\s]/g) || []).length / text.length;
    if (specialCharRatio > 0.3) return true;

    // Check for excessive repetition
    const words = text.toLowerCase().split(/\s+/);
    const uniqueWords = new Set(words);
    if (words.length > 10 && uniqueWords.size / words.length < 0.3) return true;

    return false;
  }

  /**
   * Validate media URLs
   */
  private validateMediaUrls(urls: string[]): {
    valid: boolean;
    issues: string[];
  } {
    const issues: string[] = [];

    urls.forEach((url, idx) => {
      try {
        new URL(url);
      } catch {
        issues.push(`Invalid URL at index ${idx}: ${url}`);
      }
    });

    return {
      valid: issues.length === 0,
      issues,
    };
  }
}
