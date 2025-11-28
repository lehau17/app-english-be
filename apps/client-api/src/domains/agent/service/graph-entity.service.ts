import { GeminiService } from '@app/shared';
import { Neo4jService } from '@app/shared/neo4j';
import { Injectable, Logger } from '@nestjs/common';

export interface GraphEntity {
  id: string;
  type: string; // COURSE, LESSON, ACTIVITY, CONCEPT, SKILL, VOCABULARY
  name: string;
  description?: string;
  embedding?: number[];
  metadata?: Record<string, any>;
  sourceTable?: string;
  sourceId?: string;
  createdAt?: Date;
}

export interface CreateEntityDto {
  type: string;
  name: string;
  description?: string;
  metadata?: Record<string, any>;
  sourceTable?: string;
  sourceId?: string;
}

@Injectable()
export class GraphEntityService {
  private readonly logger = new Logger(GraphEntityService.name);

  constructor(
    private neo4jService: Neo4jService,
    private geminiService: GeminiService,
  ) {}

  /**
   * Initialize Neo4j indexes and constraints
   */
  async initializeSchema(): Promise<void> {
    this.logger.log('🔧 Initializing Neo4j schema...');

    const queries = [
      // Unique constraint on entity ID
      'CREATE CONSTRAINT entity_id_unique IF NOT EXISTS FOR (e:Entity) REQUIRE e.id IS UNIQUE',

      // Index on entity type
      'CREATE INDEX entity_type_idx IF NOT EXISTS FOR (e:Entity) ON (e.type)',

      // Index on entity name for text search
      'CREATE FULLTEXT INDEX entity_name_fulltext IF NOT EXISTS FOR (e:Entity) ON EACH [e.name, e.description]',

      // Index on source
      'CREATE INDEX entity_source_idx IF NOT EXISTS FOR (e:Entity) ON (e.sourceTable, e.sourceId)',
    ];

    for (const query of queries) {
      try {
        await this.neo4jService.runQuery(query);
        this.logger.log(`${query.split(' ')[1]} created`);
      } catch (error) {
        this.logger.warn(`${query.split(' ')[1]} may already exist`);
      }
    }

    this.logger.log('Neo4j schema initialized');
  }

  /**
   * Create or update an entity
   */
  async createEntity(dto: CreateEntityDto): Promise<GraphEntity> {
    const id =
      dto.sourceId ||
      `entity_${Date.now()}_${Math.random().toString(36).substring(7)}`;

    // Generate embedding if description is provided
    let embedding: number[] | undefined;
    if (dto.description) {
      try {
        embedding = await this.geminiService.generateEmbedding(
          `${dto.name} ${dto.description}`,
        );
      } catch (error) {
        this.logger.warn(`Failed to generate embedding for ${dto.name}`, error);
      }
    }

    const cypher = `
      MERGE (e:Entity {id: $id})
      SET e.type = $type,
          e.name = $name,
          e.description = $description,
          e.embedding = $embedding,
          e.metadata = $metadata,
          e.sourceTable = $sourceTable,
          e.sourceId = $sourceId,
          e.createdAt = datetime()
      RETURN e
    `;

    const result = await this.neo4jService.runQuery(cypher, {
      id,
      type: dto.type,
      name: dto.name,
      description: dto.description,
      embedding,
      metadata: dto.metadata,
      sourceTable: dto.sourceTable,
      sourceId: dto.sourceId,
    });

    return result[0]?.e as GraphEntity;
  }

  /**
   * Find entity by ID
   */
  async findById(id: string): Promise<GraphEntity | null> {
    const cypher = 'MATCH (e:Entity {id: $id}) RETURN e';
    const result = await this.neo4jService.runQuery(cypher, { id });
    return result[0]?.e || null;
  }

  /**
   * Find entities by type
   */
  async findByType(type: string, limit = 100): Promise<GraphEntity[]> {
    const cypher = `
      MATCH (e:Entity {type: $type})
      RETURN e
      ORDER BY e.createdAt DESC
      LIMIT $limit
    `;
    const result = await this.neo4jService.runQuery(cypher, {
      type,
      limit: parseInt(String(limit)),
    });
    return result.map((r) => r.e);
  }

  /**
   * Search entities by name (full-text search)
   */
  async searchByName(query: string, limit = 20): Promise<GraphEntity[]> {
    const cypher = `
      CALL db.index.fulltext.queryNodes('entity_name_fulltext', $query)
      YIELD node, score
      RETURN node as e, score
      ORDER BY score DESC
      LIMIT $limit
    `;
    const result = await this.neo4jService.runQuery(cypher, {
      query,
      limit: parseInt(String(limit)),
    });
    return result.map((r) => r.e);
  }

  /**
   * Vector search using cosine similarity (manual calculation in Cypher)
   */
  async vectorSearch(
    queryEmbedding: number[],
    limit = 10,
    minSimilarity = 0.5,
  ): Promise<Array<GraphEntity & { similarity: number }>> {
    // Note: Neo4j doesn't have native vector search in Community Edition
    // We use manual cosine similarity calculation
    // For large datasets, consider using Neo4j Enterprise with vector index

    const cypher = `
      MATCH (e:Entity)
      WHERE e.embedding IS NOT NULL
      WITH e,
           gds.similarity.cosine(e.embedding, $queryEmbedding) AS similarity
      WHERE similarity >= $minSimilarity
      RETURN e, similarity
      ORDER BY similarity DESC
      LIMIT $limit
    `;

    const result = await this.neo4jService.runQuery(cypher, {
      queryEmbedding,
      minSimilarity,
      limit: parseInt(String(limit)),
    });

    return result.map((r) => ({
      ...(r.e as GraphEntity),
      similarity: r.similarity,
    }));
  }

  /**
   * Delete entity
   */
  async deleteEntity(id: string): Promise<boolean> {
    const cypher = `
      MATCH (e:Entity {id: $id})
      DETACH DELETE e
      RETURN count(e) as deleted
    `;
    const result = await this.neo4jService.runQuery(cypher, { id });
    return result[0]?.deleted > 0;
  }

  /**
   * Sync courses from database to Neo4j
   */
  async syncCoursesFromDatabase(prisma: any): Promise<number> {
    this.logger.log('Syncing courses to Neo4j...');

    const courses = await prisma.course.findMany({
      include: {
        lessons: {
          include: {
            activities: true,
          },
        },
      },
    });

    let count = 0;

    for (const course of courses) {
      // Create course entity
      await this.createEntity({
        type: 'COURSE',
        name: course.title,
        description: course.description,
        sourceTable: 'courses',
        sourceId: course.id,
        metadata: {
          difficulty: course.difficulty,
          estimatedHours: course.estimatedHours,
        },
      });
      count++;

      // Create lesson entities
      for (const lesson of course.lessons) {
        await this.createEntity({
          type: 'LESSON',
          name: lesson.title,
          description: lesson.description,
          sourceTable: 'lessons',
          sourceId: lesson.id,
          metadata: {
            orderNo: lesson.orderNo,
          },
        });
        count++;

        // Create activity entities
        for (const activity of lesson.activities) {
          await this.createEntity({
            type: 'ACTIVITY',
            name: activity.title,
            description: activity.description,
            sourceTable: 'activities',
            sourceId: activity.id,
            metadata: {
              type: activity.type,
              orderNo: activity.orderNo,
            },
          });
          count++;
        }
      }
    }

    this.logger.log(`Synced ${count} entities from database`);
    return count;
  }

  /**
   * Extract concepts from document using Gemini
   */
  async extractConceptsFromText(
    text: string,
    sourceDocumentId?: string,
  ): Promise<GraphEntity[]> {
    this.logger.log('🧠 Extracting concepts from text...');

    const prompt = `
    Extract key English learning concepts from this text.
    Return ONLY a JSON array of concepts with the following structure:
    [
      {
        "name": "concept name",
        "type": "CONCEPT" or "SKILL",
        "description": "brief description"
      }
    ]

    Focus on:
    - Grammar concepts (e.g., "Present Perfect", "Modal Verbs")
    - Skills (e.g., "Speaking", "Listening", "Pronunciation")
    - Vocabulary categories (e.g., "Business English", "Academic Writing")

    Text:
    ${text.substring(0, 3000)}
    `;

    try {
      const response = await this.geminiService.generateResponse(prompt);

      // Parse JSON from response
      const jsonMatch = response.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        this.logger.warn('No JSON array found in Gemini response');
        return [];
      }

      const concepts = JSON.parse(jsonMatch[0]);
      const entities: GraphEntity[] = [];

      for (const concept of concepts) {
        const entity = await this.createEntity({
          type: concept.type || 'CONCEPT',
          name: concept.name,
          description: concept.description,
          sourceTable: sourceDocumentId ? 'knowledge_documents' : undefined,
          sourceId: sourceDocumentId,
        });
        entities.push(entity);
      }

      this.logger.log(`Extracted ${entities.length} concepts`);
      return entities;
    } catch (error) {
      this.logger.error('Failed to extract concepts', error);
      return [];
    }
  }

  /**
   * Get statistics
   */
  async getStatistics(): Promise<Record<string, number>> {
    const cypher = `
      MATCH (e:Entity)
      RETURN e.type as type, count(e) as count
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
