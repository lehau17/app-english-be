import { Neo4jService } from '@app/shared/neo4j';
import { Injectable, Logger } from '@nestjs/common';
import { GraphEntity } from './graph-entity.service';
import { GraphRelationship } from './graph-relationship.service';

export interface TraversalOptions {
  maxDepth?: number;
  relationshipTypes?: string[];
  direction?: 'outgoing' | 'incoming' | 'both';
  limit?: number;
}

export interface TraversalResult {
  entities: GraphEntity[];
  relationships: GraphRelationship[];
  paths: Array<{
    start: string;
    end: string;
    length: number;
    path: string[];
  }>;
}

@Injectable()
export class GraphTraversalService {
  private readonly logger = new Logger(GraphTraversalService.name);

  constructor(private neo4jService: Neo4jService) {}

  /**
   * Traverse graph from starting entities with BFS
   */
  async traverse(
    startEntityIds: string[],
    options: TraversalOptions = {},
  ): Promise<TraversalResult> {
    const maxDepth = options.maxDepth || 2;
    const direction = options.direction || 'both';
    const limit = options.limit || 100;

    this.logger.log(
      `🔍 Traversing from ${startEntityIds.length} entities, depth=${maxDepth}, direction=${direction}`,
    );

    // Build relationship pattern based on direction
    let relPattern = '';
    if (options.relationshipTypes && options.relationshipTypes.length > 0) {
      const types = options.relationshipTypes.join('|');
      relPattern =
        direction === 'outgoing'
          ? `-[r:${types}]->`
          : direction === 'incoming'
            ? `<-[r:${types}]-`
            : `-[r:${types}]-`;
    } else {
      relPattern =
        direction === 'outgoing'
          ? '-[r]->'
          : direction === 'incoming'
            ? '<-[r]-'
            : '-[r]-';
    }

    const cypher = `
      MATCH path = (start:Entity)${relPattern}(end:Entity)
      WHERE start.id IN $startEntityIds
        AND length(path) <= $maxDepth
      WITH DISTINCT end, path
      LIMIT $limit
      RETURN
        end as entity,
        length(path) as depth,
        [node in nodes(path) | node.id] as pathIds
      ORDER BY depth
    `;

    const result = await this.neo4jService.runQuery(cypher, {
      startEntityIds,
      maxDepth,
      limit,
    });

    // Collect unique entities
    const entityMap = new Map<string, GraphEntity>();
    const paths: TraversalResult['paths'] = [];

    for (const row of result) {
      const entity = row.entity as GraphEntity;
      if (!entityMap.has(entity.id)) {
        entityMap.set(entity.id, entity);
      }

      if (row.pathIds && row.pathIds.length > 1) {
        paths.push({
          start: row.pathIds[0],
          end: row.pathIds[row.pathIds.length - 1],
          length: row.pathIds.length - 1,
          path: row.pathIds,
        });
      }
    }

    // Get all entity IDs
    const allEntityIds = Array.from(entityMap.keys());

    // Fetch relationships between these entities
    const relCypher = `
      MATCH (source:Entity)-[r]->(target:Entity)
      WHERE source.id IN $entityIds AND target.id IN $entityIds
      RETURN source.id as sourceId, target.id as targetId, type(r) as type, r.weight as weight
    `;

    const relResult = await this.neo4jService.runQuery(relCypher, {
      entityIds: allEntityIds,
    });

    const relationships: GraphRelationship[] = relResult.map((row) => ({
      id: `${row.sourceId}_${row.type}_${row.targetId}`,
      type: row.type,
      sourceId: row.sourceId,
      targetId: row.targetId,
      weight: row.weight || 1.0,
    }));

    this.logger.log(
      `✅ Found ${entityMap.size} entities, ${relationships.length} relationships`,
    );

    return {
      entities: Array.from(entityMap.values()),
      relationships,
      paths,
    };
  }

  /**
   * Find shortest path between two entities
   */
  async findShortestPath(
    fromId: string,
    toId: string,
    maxDepth = 5,
    relationshipTypes?: string[],
  ): Promise<TraversalResult | null> {
    this.logger.log(`🔍 Finding path from ${fromId} to ${toId}`);

    const relPattern = relationshipTypes
      ? `*1..${maxDepth} {type: [${relationshipTypes.map((t) => `'${t}'`).join(', ')}]}`
      : `*1..${maxDepth}`;

    const cypher = `
      MATCH path = shortestPath((start:Entity {id: $fromId})-[${relPattern}]-(end:Entity {id: $toId}))
      RETURN
        nodes(path) as entities,
        relationships(path) as relationships,
        length(path) as length
    `;

    const result = await this.neo4jService.runQuery(cypher, { fromId, toId });

    if (result.length === 0) {
      this.logger.log('❌ No path found');
      return null;
    }

    const row = result[0];
    const entities = row.entities as GraphEntity[];
    const relationships = row.relationships.map((r: any) => ({
      id: `${r.start}_${r.type}_${r.end}`,
      type: r.type,
      sourceId: r.start,
      targetId: r.end,
      weight: r.properties?.weight || 1.0,
    }));

    this.logger.log(`✅ Found path with ${row.length} hops`);

    return {
      entities,
      relationships,
      paths: [
        {
          start: fromId,
          end: toId,
          length: row.length,
          path: entities.map((e) => e.id),
        },
      ],
    };
  }

  /**
   * Find common neighbors between two entities
   */
  async findCommonNeighbors(
    entity1Id: string,
    entity2Id: string,
  ): Promise<GraphEntity[]> {
    const cypher = `
      MATCH (e1:Entity {id: $entity1Id})--(common:Entity)--(e2:Entity {id: $entity2Id})
      WHERE e1 <> e2 AND common <> e1 AND common <> e2
      RETURN DISTINCT common
    `;

    const result = await this.neo4jService.runQuery(cypher, {
      entity1Id,
      entity2Id,
    });

    return result.map((r) => r.common as GraphEntity);
  }

  /**
   * Get neighbors of an entity
   */
  async getNeighbors(
    entityId: string,
    direction: 'outgoing' | 'incoming' | 'both' = 'both',
    relationshipTypes?: string[],
  ): Promise<{ entity: GraphEntity; relationship: string; weight: number }[]> {
    let relPattern = '';
    const typeFilter = relationshipTypes ? `:${relationshipTypes.join('|')}` : '';

    if (direction === 'outgoing') {
      relPattern = `-[r${typeFilter}]->`;
    } else if (direction === 'incoming') {
      relPattern = `<-[r${typeFilter}]-`;
    } else {
      relPattern = `-[r${typeFilter}]-`;
    }

    const cypher = `
      MATCH (e:Entity {id: $entityId})${relPattern}(neighbor:Entity)
      RETURN neighbor, type(r) as relType, r.weight as weight
    `;

    const result = await this.neo4jService.runQuery(cypher, { entityId });

    return result.map((row) => ({
      entity: row.neighbor as GraphEntity,
      relationship: row.relType,
      weight: row.weight || 1.0,
    }));
  }

  /**
   * Find learning path (prerequisite chain)
   */
  async findLearningPath(
    fromConceptId: string,
    toConceptId: string,
  ): Promise<TraversalResult | null> {
    this.logger.log(`📚 Finding learning path from ${fromConceptId} to ${toConceptId}`);

    // Follow REQUIRES and TEACHES relationships
    const cypher = `
      MATCH path = shortestPath((start:Entity {id: $fromConceptId})-[:REQUIRES|TEACHES*1..10]->(end:Entity {id: $toConceptId}))
      RETURN
        nodes(path) as entities,
        relationships(path) as relationships,
        length(path) as length
      ORDER BY length
      LIMIT 1
    `;

    const result = await this.neo4jService.runQuery(cypher, {
      fromConceptId,
      toConceptId,
    });

    if (result.length === 0) {
      this.logger.log('❌ No learning path found');
      return null;
    }

    const row = result[0];
    const entities = row.entities as GraphEntity[];
    const relationships = row.relationships.map((r: any) => ({
      id: `${r.start}_${r.type}_${r.end}`,
      type: r.type,
      sourceId: r.start,
      targetId: r.end,
      weight: r.properties?.weight || 1.0,
    }));

    this.logger.log(`✅ Found learning path with ${row.length} steps`);

    return {
      entities,
      relationships,
      paths: [
        {
          start: fromConceptId,
          end: toConceptId,
          length: row.length,
          path: entities.map((e) => e.id),
        },
      ],
    };
  }

  /**
   * Get entity centrality (PageRank-like importance)
   */
  async getEntityCentrality(entityId: string): Promise<number> {
    const cypher = `
      MATCH (e:Entity {id: $entityId})
      OPTIONAL MATCH (e)-[r]-()
      RETURN count(r) as degree
    `;

    const result = await this.neo4jService.runQuery(cypher, { entityId });
    return result[0]?.degree || 0;
  }
}
