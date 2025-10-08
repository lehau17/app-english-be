import { Neo4jService } from '@app/shared/neo4j';
import { Injectable, Logger } from '@nestjs/common';

export interface GraphRelationship {
  id: string;
  type: string; // CONTAINS, TEACHES, REQUIRES, RELATED_TO, FOLLOWS, PRACTICES
  sourceId: string;
  targetId: string;
  weight: number; // 0-1
  metadata?: Record<string, any>;
  createdAt?: Date;
}

export interface CreateRelationshipDto {
  sourceId: string;
  targetId: string;
  type: string;
  weight?: number;
  metadata?: Record<string, any>;
}

@Injectable()
export class GraphRelationshipService {
  private readonly logger = new Logger(GraphRelationshipService.name);

  constructor(private neo4jService: Neo4jService) {}

  /**
   * Create a relationship between two entities
   */
  async createRelationship(dto: CreateRelationshipDto): Promise<GraphRelationship> {
    const weight = dto.weight || 1.0;

    const cypher = `
      MATCH (source:Entity {id: $sourceId})
      MATCH (target:Entity {id: $targetId})
      MERGE (source)-[r:${dto.type}]->(target)
      SET r.weight = $weight,
          r.metadata = $metadata,
          r.createdAt = datetime()
      RETURN r, source.id as sourceId, target.id as targetId
    `;

    const result = await this.neo4jService.runQuery(cypher, {
      sourceId: dto.sourceId,
      targetId: dto.targetId,
      weight,
      metadata: dto.metadata,
    });

    return {
      id: `${dto.sourceId}_${dto.type}_${dto.targetId}`,
      type: dto.type,
      sourceId: result[0]?.sourceId,
      targetId: result[0]?.targetId,
      weight,
      metadata: dto.metadata,
    };
  }

  /**
   * Find relationships from a source entity
   */
  async findFromEntity(
    entityId: string,
    relationshipType?: string,
  ): Promise<GraphRelationship[]> {
    const cypher = relationshipType
      ? `
        MATCH (source:Entity {id: $entityId})-[r:${relationshipType}]->(target:Entity)
        RETURN r, source.id as sourceId, target.id as targetId, type(r) as type
      `
      : `
        MATCH (source:Entity {id: $entityId})-[r]->(target:Entity)
        RETURN r, source.id as sourceId, target.id as targetId, type(r) as type
      `;

    const result = await this.neo4jService.runQuery(cypher, { entityId });

    return result.map((row) => ({
      id: `${row.sourceId}_${row.type}_${row.targetId}`,
      type: row.type,
      sourceId: row.sourceId,
      targetId: row.targetId,
      weight: row.r.weight || 1.0,
      metadata: row.r.metadata,
    }));
  }

  /**
   * Find relationships to a target entity
   */
  async findToEntity(
    entityId: string,
    relationshipType?: string,
  ): Promise<GraphRelationship[]> {
    const cypher = relationshipType
      ? `
        MATCH (source:Entity)-[r:${relationshipType}]->(target:Entity {id: $entityId})
        RETURN r, source.id as sourceId, target.id as targetId, type(r) as type
      `
      : `
        MATCH (source:Entity)-[r]->(target:Entity {id: $entityId})
        RETURN r, source.id as sourceId, target.id as targetId, type(r) as type
      `;

    const result = await this.neo4jService.runQuery(cypher, { entityId });

    return result.map((row) => ({
      id: `${row.sourceId}_${row.type}_${row.targetId}`,
      type: row.type,
      sourceId: row.sourceId,
      targetId: row.targetId,
      weight: row.r.weight || 1.0,
      metadata: row.r.metadata,
    }));
  }

  /**
   * Delete a relationship
   */
  async deleteRelationship(
    sourceId: string,
    targetId: string,
    type: string,
  ): Promise<boolean> {
    const cypher = `
      MATCH (source:Entity {id: $sourceId})-[r:${type}]->(target:Entity {id: $targetId})
      DELETE r
      RETURN count(r) as deleted
    `;

    const result = await this.neo4jService.runQuery(cypher, { sourceId, targetId });
    return result[0]?.deleted > 0;
  }

  /**
   * Build structured relationships from database schema
   */
  async buildStructuredRelationships(prisma: any): Promise<number> {
    this.logger.log('🔗 Building structured relationships...');

    let count = 0;

    // 1. Course CONTAINS Lesson
    const courses = await prisma.course.findMany({
      include: { lessons: true },
    });

    for (const course of courses) {
      for (const lesson of course.lessons) {
        await this.createRelationship({
          sourceId: course.id,
          targetId: lesson.id,
          type: 'CONTAINS',
          weight: 1.0,
        });
        count++;
      }
    }

    // 2. Lesson CONTAINS Activity
    const lessons = await prisma.lesson.findMany({
      include: { activities: true },
    });

    for (const lesson of lessons) {
      for (const activity of lesson.activities) {
        await this.createRelationship({
          sourceId: lesson.id,
          targetId: activity.id,
          type: 'CONTAINS',
          weight: 1.0,
        });
        count++;
      }
    }

    // 3. Lesson FOLLOWS Lesson (sequential)
    const allLessons = await prisma.lesson.findMany({
      orderBy: [{ courseId: 'asc' }, { orderNo: 'asc' }],
    });

    for (let i = 1; i < allLessons.length; i++) {
      if (allLessons[i].courseId === allLessons[i - 1].courseId) {
        await this.createRelationship({
          sourceId: allLessons[i].id,
          targetId: allLessons[i - 1].id,
          type: 'FOLLOWS',
          weight: 0.9,
        });
        count++;
      }
    }

    this.logger.log(`✅ Created ${count} structured relationships`);
    return count;
  }

  /**
   * Discover semantic relationships between entities using similarity
   */
  async discoverSemanticRelationships(
    minSimilarity = 0.7,
    limit = 1000,
  ): Promise<number> {
    this.logger.log('🔍 Discovering semantic relationships...');

    // Find similar entities using vector similarity
    const cypher = `
      MATCH (e1:Entity), (e2:Entity)
      WHERE e1.id < e2.id
        AND e1.embedding IS NOT NULL
        AND e2.embedding IS NOT NULL
        AND e1.type = e2.type
      WITH e1, e2,
           gds.similarity.cosine(e1.embedding, e2.embedding) AS similarity
      WHERE similarity >= $minSimilarity
      MERGE (e1)-[r:RELATED_TO]->(e2)
      SET r.weight = similarity,
          r.metadata = {discoveredBy: 'semantic'},
          r.createdAt = datetime()
      RETURN count(r) as created
      LIMIT $limit
    `;

    const result = await this.neo4jService.runQuery(cypher, {
      minSimilarity,
      limit,
    });

    const created = result[0]?.created || 0;
    this.logger.log(`✅ Discovered ${created} semantic relationships`);
    return created;
  }

  /**
   * Get relationship statistics
   */
  async getStatistics(): Promise<Record<string, number>> {
    const cypher = `
      MATCH ()-[r]->()
      RETURN type(r) as type, count(r) as count
      ORDER BY count DESC
    `;

    const result = await this.neo4jService.runQuery(cypher);
    const stats: Record<string, number> = {};

    for (const row of result) {
      stats[row.type] = row.count;
    }

    return stats;
  }
}
