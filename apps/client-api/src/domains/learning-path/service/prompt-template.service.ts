import { PrismaRepository } from '@app/database';
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ActivityType, DifficultyLevel, PromptTemplate } from '@prisma/client';

/**
 * Service for managing and selecting prompt templates for AI activity generation
 */
@Injectable()
export class PromptTemplateService {
  private readonly logger = new Logger(PromptTemplateService.name);

  constructor(private readonly prisma: PrismaRepository) {}

  /**
   * Find template by exact match (type, difficulty, skill)
   */
  async findTemplate(params: {
    activityType: ActivityType;
    difficulty?: DifficultyLevel;
    skill?: string;
  }): Promise<PromptTemplate | null> {
    const { activityType, difficulty, skill } = params;

    // Try exact match first
    const exactMatch = await this.prisma.promptTemplate.findFirst({
      where: {
        activityType,
        difficulty: difficulty || null,
        skill: skill || null,
      },
    });

    if (exactMatch) {
      return exactMatch;
    }

    // Fallback: match type only
    return this.prisma.promptTemplate.findFirst({
      where: {
        activityType,
        difficulty: null,
        skill: null,
      },
    });
  }

  /**
   * Get the best matching template based on priority:
   * 1. Exact match (type + difficulty + skill)
   * 2. Type + difficulty
   * 3. Type + skill
   * 4. Type only
   */
  async selectBestTemplate(params: {
    activityType: ActivityType;
    difficulty?: DifficultyLevel;
    skill?: string;
  }): Promise<PromptTemplate> {
    const { activityType, difficulty, skill } = params;

    // Priority 1: Exact match
    if (difficulty && skill) {
      const exact = await this.prisma.promptTemplate.findFirst({
        where: { activityType, difficulty, skill },
      });
      if (exact) {
        this.logger.debug(
          `Found exact match template: ${exact.name} (type=${activityType}, diff=${difficulty}, skill=${skill})`,
        );
        return exact;
      }
    }

    // Priority 2: Type + difficulty
    if (difficulty) {
      const typeDiff = await this.prisma.promptTemplate.findFirst({
        where: { activityType, difficulty, skill: null },
      });
      if (typeDiff) {
        this.logger.debug(`Found type+difficulty template: ${typeDiff.name}`);
        return typeDiff;
      }
    }

    // Priority 3: Type + skill
    if (skill) {
      const typeSkill = await this.prisma.promptTemplate.findFirst({
        where: { activityType, skill, difficulty: null },
      });
      if (typeSkill) {
        this.logger.debug(`Found type+skill template: ${typeSkill.name}`);
        return typeSkill;
      }
    }

    // Priority 4: Type only (fallback)
    const typeOnly = await this.prisma.promptTemplate.findFirst({
      where: { activityType, difficulty: null, skill: null },
    });

    if (!typeOnly) {
      throw new NotFoundException(
        `No template found for activity type: ${activityType}`,
      );
    }

    this.logger.debug(`Using fallback template: ${typeOnly.name}`);
    return typeOnly;
  }

  /**
   * Substitute variables in template prompts
   * Variables format: {{variableName}}
   */
  substituteVariables(
    template: string,
    variables: Record<string, any>,
  ): string {
    let result = template;

    Object.entries(variables).forEach(([key, value]) => {
      const placeholder = `{{${key}}}`;
      const replacement = String(value ?? '');
      result = result.replace(new RegExp(placeholder, 'g'), replacement);
    });

    return result;
  }

  /**
   * Build complete prompt from template with variables
   */
  async buildPrompt(params: {
    activityType: ActivityType;
    difficulty?: DifficultyLevel;
    skill?: string;
    variables?: Record<string, any>;
  }): Promise<{
    template: PromptTemplate;
    systemPrompt: string;
    userPrompt: string;
  }> {
    const { activityType, difficulty, skill, variables = {} } = params;

    const template = await this.selectBestTemplate({
      activityType,
      difficulty,
      skill,
    });

    // Add default variables
    const allVariables = {
      activityType,
      difficulty: difficulty || DifficultyLevel.intermediate,
      skill: skill || 'general',
      proficiencyLevel: this.mapDifficultyToProficiency(difficulty),
      ...variables,
    };

    const systemPrompt = this.substituteVariables(
      template.systemPrompt,
      allVariables,
    );
    const userPrompt = this.substituteVariables(
      template.userPrompt,
      allVariables,
    );

    return {
      template,
      systemPrompt,
      userPrompt,
    };
  }

  /**
   * Get template by ID
   */
  async findById(id: string): Promise<PromptTemplate | null> {
    return this.prisma.promptTemplate.findUnique({
      where: { id },
    });
  }

  /**
   * List all templates
   */
  async listTemplates(filters?: {
    activityType?: ActivityType;
    difficulty?: DifficultyLevel;
    skill?: string;
  }): Promise<PromptTemplate[]> {
    return this.prisma.promptTemplate.findMany({
      where: {
        ...(filters?.activityType && { activityType: filters.activityType }),
        ...(filters?.difficulty && { difficulty: filters.difficulty }),
        ...(filters?.skill && { skill: filters.skill }),
      },
      orderBy: [{ activityType: 'asc' }, { difficulty: 'asc' }],
    });
  }

  /**
   * Update template usage count
   */
  async incrementUsage(templateId: string): Promise<void> {
    await this.prisma.promptTemplate.update({
      where: { id: templateId },
      data: {
        usageCount: {
          increment: 1,
        },
      },
    });
  }

  /**
   * Map difficulty level to proficiency level (A1-C2)
   */
  private mapDifficultyToProficiency(difficulty?: DifficultyLevel): string {
    if (!difficulty) return 'B1';

    const mapping: Record<DifficultyLevel, string> = {
      beginner: 'A1',
      elementary: 'A2',
      intermediate: 'B1',
      upper_intermediate: 'B2',
      advanced: 'C1',
      expert: 'C2',
    };

    return mapping[difficulty] || 'B1';
  }
}
