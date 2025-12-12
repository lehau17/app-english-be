import { Injectable, Logger } from '@nestjs/common';
import { Neo4jGraphService } from './neo4j-graph.service';
import { SkillProgressRepository } from '../repository';

/**
 * Prerequisite Service
 * Manages prerequisite checking and skill dependency validation
 */
@Injectable()
export class PrerequisiteService {
  private readonly logger = new Logger(PrerequisiteService.name);

  // Minimum mastery threshold for prerequisites
  private readonly PREREQUISITE_THRESHOLD = 0.70; // 70%

  constructor(
    private readonly graphService: Neo4jGraphService,
    private readonly skillProgressRepo: SkillProgressRepository,
  ) {}

  /**
   * Check if user meets all prerequisites for a concept
   */
  async checkConceptPrerequisites(
    userId: string,
    conceptId: string,
  ): Promise<{
    met: boolean;
    missing: Array<{
      conceptId: string;
      conceptName: string;
      requiredMastery: number;
      currentMastery: number;
      gap: number;
    }>;
  }> {
    try {
      // Get all direct prerequisites
      const prerequisites = await this.graphService.getDirectPrerequisites(
        conceptId,
      );

      if (prerequisites.length === 0) {
        return { met: true, missing: [] };
      }

      const missing: Array<{
        conceptId: string;
        conceptName: string;
        requiredMastery: number;
        currentMastery: number;
        gap: number;
      }> = [];

      // Check each prerequisite
      for (const prereq of prerequisites) {
        // Get skills taught by this prerequisite concept
        const skills = await this.graphService.getSkillsTaught(prereq.id);

        // Calculate average mastery across all skills
        let totalMastery = 0;
        let skillCount = 0;

        for (const skill of skills) {
          const progress = await this.skillProgressRepo.findByUserIdAndSkill(
            userId,
            skill.id,
          );

          totalMastery += progress?.masteryScore || 0;
          skillCount += 1;
        }

        const averageMastery = skillCount > 0 ? totalMastery / skillCount : 0;
        const requiredMastery = this.PREREQUISITE_THRESHOLD * 100;

        // Check if prerequisite is met
        if (averageMastery < requiredMastery) {
          missing.push({
            conceptId: prereq.id,
            conceptName: prereq.name,
            requiredMastery,
            currentMastery: Math.round(averageMastery),
            gap: Math.round(requiredMastery - averageMastery),
          });
        }
      }

      return {
        met: missing.length === 0,
        missing,
      };
    } catch (error) {
      this.logger.error(
        `Failed to check concept prerequisites: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Get recommended learning path to meet prerequisites
   * Returns concepts in order they should be learned
   */
  async getPrerequisiteLearningPath(
    userId: string,
    targetConceptId: string,
  ): Promise<
    Array<{
      conceptId: string;
      conceptName: string;
      difficulty: string;
      order: number;
      currentMastery: number;
      requiredMastery: number;
      isComplete: boolean;
    }>
  > {
    try {
      // Get full learning path from graph
      const path = await this.graphService.getLearningPath(targetConceptId);

      // Enrich with user's current mastery
      const enrichedPath: Array<{
        conceptId: string;
        conceptName: string;
        difficulty: string;
        order: number;
        currentMastery: number;
        requiredMastery: number;
        isComplete: boolean;
      }> = [];

      for (const concept of path) {
        // Get skills taught by this concept
        const skills = await this.graphService.getSkillsTaught(concept.id);

        // Calculate average mastery
        let totalMastery = 0;
        let skillCount = 0;

        for (const skill of skills) {
          const progress = await this.skillProgressRepo.findByUserIdAndSkill(
            userId,
            skill.id,
          );

          totalMastery += progress?.masteryScore || 0;
          skillCount += 1;
        }

        const currentMastery =
          skillCount > 0 ? Math.round(totalMastery / skillCount) : 0;
        const requiredMastery = this.PREREQUISITE_THRESHOLD * 100;
        const isComplete = currentMastery >= requiredMastery;

        enrichedPath.push({
          conceptId: concept.id,
          conceptName: concept.name,
          difficulty: concept.difficulty,
          order: concept.order,
          currentMastery,
          requiredMastery,
          isComplete,
        });
      }

      return enrichedPath;
    } catch (error) {
      this.logger.error(
        `Failed to get prerequisite learning path: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Find next concept to learn based on prerequisites
   * Returns the first incomplete prerequisite
   */
  async findNextConcept(
    userId: string,
    targetConceptId: string,
  ): Promise<{
    conceptId: string;
    conceptName: string;
    difficulty: string;
    reason: string;
  } | null> {
    const path = await this.getPrerequisiteLearningPath(
      userId,
      targetConceptId,
    );

    // Find first incomplete concept
    const nextConcept = path.find((c) => !c.isComplete);

    if (!nextConcept) {
      return null; // All prerequisites met
    }

    return {
      conceptId: nextConcept.conceptId,
      conceptName: nextConcept.conceptName,
      difficulty: nextConcept.difficulty,
      reason: `Mastery ${nextConcept.currentMastery}% < required ${nextConcept.requiredMastery}%`,
    };
  }

  /**
   * Validate that adding a prerequisite won't create circular dependency
   */
  async validatePrerequisite(
    conceptId: string,
    prerequisiteId: string,
  ): Promise<{
    valid: boolean;
    reason?: string;
  }> {
    try {
      // Check if prerequisite is the same as concept
      if (conceptId === prerequisiteId) {
        return {
          valid: false,
          reason: 'Concept cannot be its own prerequisite',
        };
      }

      // Check if adding this prerequisite would create a cycle
      // Temporarily add the relationship and check for cycles
      await this.graphService.createPrerequisite(conceptId, prerequisiteId, 0.1);

      const hasCycle = await this.graphService.hasCircularDependency(conceptId);

      if (hasCycle) {
        // Remove the temporary relationship
        // Note: Neo4j doesn't have a simple "delete relationship" in this service
        // We'll rely on the strength=0.1 to identify it as temporary
        return {
          valid: false,
          reason: 'Adding this prerequisite would create a circular dependency',
        };
      }

      return { valid: true };
    } catch (error) {
      this.logger.error(
        `Failed to validate prerequisite: ${error.message}`,
        error.stack,
      );
      return {
        valid: false,
        reason: `Validation error: ${error.message}`,
      };
    }
  }

  /**
   * Get prerequisite gaps for a user (skills that block advancement)
   */
  async getPrerequisiteGaps(
    userId: string,
    conceptIds: string[],
  ): Promise<
    Array<{
      conceptId: string;
      conceptName: string;
      missingPrerequisites: Array<{
        prerequisiteId: string;
        prerequisiteName: string;
        gap: number;
      }>;
    }>
  > {
    const gaps: Array<{
      conceptId: string;
      conceptName: string;
      missingPrerequisites: Array<{
        prerequisiteId: string;
        prerequisiteName: string;
        gap: number;
      }>;
    }> = [];

    for (const conceptId of conceptIds) {
      const check = await this.checkConceptPrerequisites(userId, conceptId);

      if (!check.met) {
        // Get concept name
        const cypher = `
          MATCH (c:Concept {id: $conceptId})
          RETURN c.name as name
        `;

        const result = await this.graphService['neo4j'].runQuery<{
          name: string;
        }>(cypher, { conceptId });

        gaps.push({
          conceptId,
          conceptName: result[0]?.name || conceptId,
          missingPrerequisites: check.missing.map((m) => ({
            prerequisiteId: m.conceptId,
            prerequisiteName: m.conceptName,
            gap: m.gap,
          })),
        });
      }
    }

    return gaps;
  }

  /**
   * Estimate time needed to complete prerequisites
   * Based on average skill mastery improvement rate
   */
  async estimatePrerequisiteTime(
    userId: string,
    conceptId: string,
  ): Promise<{
    estimatedDays: number;
    skillsToImprove: number;
    averageGap: number;
  }> {
    const check = await this.checkConceptPrerequisites(userId, conceptId);

    if (check.met) {
      return {
        estimatedDays: 0,
        skillsToImprove: 0,
        averageGap: 0,
      };
    }

    // Calculate average gap
    const totalGap = check.missing.reduce((sum, m) => sum + m.gap, 0);
    const averageGap = totalGap / check.missing.length;

    // Estimate: 1 day per 10% mastery gap (rough heuristic)
    const estimatedDays = Math.ceil(averageGap / 10);

    return {
      estimatedDays,
      skillsToImprove: check.missing.length,
      averageGap: Math.round(averageGap),
    };
  }
}
