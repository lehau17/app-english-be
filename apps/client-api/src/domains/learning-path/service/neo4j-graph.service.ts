import { Injectable, Logger } from '@nestjs/common';
import { Neo4jService } from '@app/shared/neo4j/neo4j.service';

/**
 * Neo4j Graph Service for Learning Path Knowledge Graph
 * Manages concept relationships and prerequisites
 */
@Injectable()
export class Neo4jGraphService {
  private readonly logger = new Logger(Neo4jGraphService.name);

  constructor(private readonly neo4j: Neo4jService) {}

  /**
   * Create or update a concept node
   */
  async upsertConcept(data: {
    id: string;
    name: string;
    description?: string;
    difficulty: string;
    skillType: string;
  }): Promise<void> {
    const cypher = `
      MERGE (c:Concept {id: $id})
      SET c.name = $name,
          c.description = $description,
          c.difficulty = $difficulty,
          c.skillType = $skillType,
          c.updatedAt = datetime()
      RETURN c
    `;

    await this.neo4j.runQuery(cypher, data);

    this.logger.debug(`Upserted concept: ${data.name}`);
  }

  /**
   * Create prerequisite relationship between concepts
   * (conceptA requires conceptB)
   */
  async createPrerequisite(
    conceptId: string,
    prerequisiteId: string,
    strength: number = 1.0,
  ): Promise<void> {
    const cypher = `
      MATCH (a:Concept {id: $conceptId})
      MATCH (b:Concept {id: $prerequisiteId})
      MERGE (a)-[r:REQUIRES]->(b)
      SET r.strength = $strength,
          r.createdAt = datetime()
      RETURN r
    `;

    await this.neo4j.runQuery(cypher, {
      conceptId,
      prerequisiteId,
      strength,
    });

    this.logger.debug(
      `Created prerequisite: ${conceptId} requires ${prerequisiteId}`,
    );
  }

  /**
   * Create "teaches" relationship between concept and skill
   */
  async createTeachesRelationship(
    conceptId: string,
    skillId: string,
  ): Promise<void> {
    const cypher = `
      MATCH (c:Concept {id: $conceptId})
      MERGE (s:Skill {id: $skillId})
      MERGE (c)-[r:TEACHES]->(s)
      SET r.createdAt = datetime()
      RETURN r
    `;

    await this.neo4j.runQuery(cypher, { conceptId, skillId });

    this.logger.debug(
      `Created teaches relationship: ${conceptId} -> ${skillId}`,
    );
  }

  /**
   * Get all prerequisites for a concept (direct and transitive)
   */
  async getPrerequisites(conceptId: string): Promise<
    Array<{
      id: string;
      name: string;
      difficulty: string;
      depth: number;
    }>
  > {
    const cypher = `
      MATCH path = (c:Concept {id: $conceptId})-[:REQUIRES*]->(prereq:Concept)
      WITH prereq, length(path) as depth
      RETURN DISTINCT prereq.id as id,
                      prereq.name as name,
                      prereq.difficulty as difficulty,
                      MIN(depth) as depth
      ORDER BY depth ASC
    `;

    const results = await this.neo4j.runQuery<{
      id: string;
      name: string;
      difficulty: string;
      depth: number;
    }>(cypher, { conceptId });

    return results;
  }

  /**
   * Get direct prerequisites only
   */
  async getDirectPrerequisites(conceptId: string): Promise<
    Array<{
      id: string;
      name: string;
      difficulty: string;
      strength: number;
    }>
  > {
    const cypher = `
      MATCH (c:Concept {id: $conceptId})-[r:REQUIRES]->(prereq:Concept)
      RETURN prereq.id as id,
             prereq.name as name,
             prereq.difficulty as difficulty,
             r.strength as strength
      ORDER BY r.strength DESC
    `;

    return this.neo4j.runQuery(cypher, { conceptId });
  }

  /**
   * Find concepts that depend on this concept (reverse prerequisites)
   */
  async getDependents(conceptId: string): Promise<
    Array<{
      id: string;
      name: string;
      difficulty: string;
    }>
  > {
    const cypher = `
      MATCH (dependent:Concept)-[:REQUIRES]->(c:Concept {id: $conceptId})
      RETURN dependent.id as id,
             dependent.name as name,
             dependent.difficulty as difficulty
      ORDER BY dependent.name ASC
    `;

    return this.neo4j.runQuery(cypher, { conceptId });
  }

  /**
   * Get skills taught by a concept
   */
  async getSkillsTaught(conceptId: string): Promise<
    Array<{
      id: string;
      name: string;
    }>
  > {
    const cypher = `
      MATCH (c:Concept {id: $conceptId})-[:TEACHES]->(s:Skill)
      RETURN s.id as id,
             s.name as name
      ORDER BY s.name ASC
    `;

    return this.neo4j.runQuery(cypher, { conceptId });
  }

  /**
   * Get learning path (topological sort from prerequisites)
   * Returns concepts in order they should be learned
   */
  async getLearningPath(targetConceptId: string): Promise<
    Array<{
      id: string;
      name: string;
      difficulty: string;
      order: number;
    }>
  > {
    // Get all prerequisites with depth
    const prerequisites = await this.getPrerequisites(targetConceptId);

    // Sort by depth (foundation first)
    const sorted = prerequisites.sort((a, b) => a.depth - b.depth);

    // Add target concept at the end
    const cypher = `
      MATCH (c:Concept {id: $conceptId})
      RETURN c.id as id,
             c.name as name,
             c.difficulty as difficulty
    `;

    const target = await this.neo4j.runQuery<{
      id: string;
      name: string;
      difficulty: string;
    }>(cypher, { conceptId: targetConceptId });

    const path = sorted.map((prereq, index) => ({
      ...prereq,
      order: index,
    }));

    if (target.length > 0) {
      path.push({
        ...target[0],
        order: path.length,
        depth: 0,
      });
    }

    return path;
  }

  /**
   * Find related concepts (similar difficulty, same skill type)
   */
  async findRelatedConcepts(
    conceptId: string,
    limit: number = 5,
  ): Promise<
    Array<{
      id: string;
      name: string;
      difficulty: string;
      skillType: string;
    }>
  > {
    const cypher = `
      MATCH (source:Concept {id: $conceptId})
      MATCH (related:Concept)
      WHERE related.id <> source.id
        AND related.skillType = source.skillType
        AND related.difficulty = source.difficulty
      RETURN related.id as id,
             related.name as name,
             related.difficulty as difficulty,
             related.skillType as skillType
      LIMIT $limit
    `;

    return this.neo4j.runQuery(cypher, { conceptId, limit });
  }

  /**
   * Check if concept has circular dependencies
   */
  async hasCircularDependency(conceptId: string): Promise<boolean> {
    const cypher = `
      MATCH path = (c:Concept {id: $conceptId})-[:REQUIRES*]->(c)
      RETURN COUNT(path) as cycles
    `;

    const result = await this.neo4j.runQuery<{ cycles: number }>(cypher, {
      conceptId,
    });

    return result.length > 0 && result[0].cycles > 0;
  }

  /**
   * Get concept statistics
   */
  async getConceptStats(conceptId: string): Promise<{
    prerequisiteCount: number;
    dependentCount: number;
    skillsTaughtCount: number;
    depth: number;
  }> {
    const cypher = `
      MATCH (c:Concept {id: $conceptId})
      OPTIONAL MATCH (c)-[:REQUIRES]->(prereq:Concept)
      OPTIONAL MATCH (dependent:Concept)-[:REQUIRES]->(c)
      OPTIONAL MATCH (c)-[:TEACHES]->(skill:Skill)
      OPTIONAL MATCH path = (c)-[:REQUIRES*]->(root:Concept)
      WHERE NOT (root)-[:REQUIRES]->()
      WITH c,
           COUNT(DISTINCT prereq) as prereqCount,
           COUNT(DISTINCT dependent) as depCount,
           COUNT(DISTINCT skill) as skillCount,
           MAX(length(path)) as maxDepth
      RETURN prereqCount as prerequisiteCount,
             depCount as dependentCount,
             skillCount as skillsTaughtCount,
             COALESCE(maxDepth, 0) as depth
    `;

    const result = await this.neo4j.runQuery<{
      prerequisiteCount: number;
      dependentCount: number;
      skillsTaughtCount: number;
      depth: number;
    }>(cypher, { conceptId });

    return (
      result[0] || {
        prerequisiteCount: 0,
        dependentCount: 0,
        skillsTaughtCount: 0,
        depth: 0,
      }
    );
  }

  /**
   * Seed initial concepts (for Phase 3 manual seeding)
   */
  async seedConcepts(
    concepts: Array<{
      id: string;
      name: string;
      description: string;
      difficulty: string;
      skillType: string;
      prerequisites?: string[];
      skills?: string[];
    }>,
  ): Promise<void> {
    this.logger.log(`Seeding ${concepts.length} concepts...`);

    for (const concept of concepts) {
      // Create concept node
      await this.upsertConcept({
        id: concept.id,
        name: concept.name,
        description: concept.description,
        difficulty: concept.difficulty,
        skillType: concept.skillType,
      });

      // Create prerequisite relationships
      if (concept.prerequisites) {
        for (const prereqId of concept.prerequisites) {
          await this.createPrerequisite(concept.id, prereqId);
        }
      }

      // Create teaches relationships
      if (concept.skills) {
        for (const skillId of concept.skills) {
          await this.createTeachesRelationship(concept.id, skillId);
        }
      }
    }

    this.logger.log(`Seeded ${concepts.length} concepts successfully`);
  }

  /**
   * Clear all graph data (use with caution - for testing only)
   */
  async clearAllData(): Promise<void> {
    const cypher = `
      MATCH (n)
      DETACH DELETE n
    `;

    await this.neo4j.runQuery(cypher);
    this.logger.warn('Cleared all Neo4j graph data');
  }

  /**
   * Get graph overview
   */
  async getGraphOverview(): Promise<{
    conceptCount: number;
    skillCount: number;
    prerequisiteCount: number;
    teachesCount: number;
  }> {
    const cypher = `
      MATCH (c:Concept)
      OPTIONAL MATCH (s:Skill)
      OPTIONAL MATCH ()-[r:REQUIRES]->()
      OPTIONAL MATCH ()-[t:TEACHES]->()
      RETURN COUNT(DISTINCT c) as conceptCount,
             COUNT(DISTINCT s) as skillCount,
             COUNT(DISTINCT r) as prerequisiteCount,
             COUNT(DISTINCT t) as teachesCount
    `;

    const result = await this.neo4j.runQuery<{
      conceptCount: number;
      skillCount: number;
      prerequisiteCount: number;
      teachesCount: number;
    }>(cypher);

    return (
      result[0] || {
        conceptCount: 0,
        skillCount: 0,
        prerequisiteCount: 0,
        teachesCount: 0,
      }
    );
  }
}
