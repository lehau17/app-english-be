import { GeminiService } from '@app/shared';
import { Neo4jService } from '@app/shared/neo4j';
import { StructuredTool } from '@langchain/core/tools';
import { Injectable, Logger } from '@nestjs/common';
import { z } from 'zod';

@Injectable()
export class GraphQueryTool extends StructuredTool {
  name = 'graph_query';
  description = `🔍 GRAPH DATABASE QUERY TOOL - Query Neo4j knowledge graph for STRUCTURAL and RELATIONSHIP data.

USE THIS TOOL (not knowledge_search) when user asks about:
1. COUNTS/STRUCTURE: "có bao nhiêu", "how many", "structure", "tổng số"
2. RELATIONSHIPS: "liên quan", "related", "kết nối", "connected to"
3. HIERARCHY: "cấu trúc", "hierarchy", "lessons trong course", "activities trong lesson"
4. PATHS: "lộ trình", "learning path", "progression", "từ A đến B"
5. ORDERING: "bài tiếp theo", "next lesson", "thứ tự", "order"

Good examples (USE graph_query):
- "Khóa học Animals for Beginners có bao nhiêu bài học?" → STRUCTURAL
- "Tìm khóa học liên quan đến Animals" → RELATIONSHIP
- "Lộ trình học từ beginner đến advanced" → PATH
- "Bài học tiếp theo sau Lesson 1 là gì?" → ORDERING
- "Chi tiết cấu trúc khóa học X" → HIERARCHY

Bad examples (use knowledge_search instead):
- "Quy chế tốt nghiệp là gì?" → CONTENT search, not structure
- "Giải thích ngữ pháp hiện tại đơn" → KNOWLEDGE search
- "Tìm tài liệu về IELTS" → DOCUMENT search`;

  schema = z.object({
    query: z
      .string()
      .describe('Natural language query sẽ được convert thành Cypher'),
    entityType: z
      .enum(['COURSE', 'LESSON', 'ACTIVITY', 'ALL'])
      .optional()
      .describe('Loại entity cần tìm (optional)'),
    entityId: z.string().optional().describe('ID của entity cụ thể (optional)'),
  });

  private readonly logger = new Logger(GraphQueryTool.name);

  constructor(
    private neo4jService: Neo4jService,
    private geminiService: GeminiService,
  ) {
    super();
  }

  async _call({
    query,
    entityType,
    entityId,
  }: {
    query: string;
    entityType?: string;
    entityId?: string;
  }): Promise<string> {
    try {
      this.logger.log(`� Graph query: "${query}"`);

      // 🤖 Use Gemini AI to generate Cypher dynamically
      const cypherQuery = await this.generateCypherWithAI(
        query,
        entityType,
        entityId,
      );

      this.logger.log(`🤖 Gemini generated Cypher:\n${cypherQuery}`);

      const results = await this.neo4jService.runQuery(cypherQuery, {
        entityId,
      });

      this.logger.log(`Query returned ${results.length} results`);

      return JSON.stringify({
        success: true,
        results,
        count: results.length,
        query: cypherQuery,
      });
    } catch (e: any) {
      this.logger.error(`Graph query failed: ${e.message}`, e.stack);
      return JSON.stringify({
        success: false,
        error: `Lỗi Graph Query: ${e.message}`,
      });
    }
  }

  /**
   * 🤖 Use Gemini AI to generate Cypher query from natural language
   */
  private async generateCypherWithAI(
    naturalLanguageQuery: string,
    entityType?: string,
    entityId?: string,
  ): Promise<string> {
    const prompt = `Bạn là chuyên gia Neo4j Cypher. Nhiệm vụ của bạn là chuyển câu hỏi tự nhiên thành Cypher query.

SCHEMA THÔNG TIN:
- Node label: Entity
- Entity properties:
  * id: string (unique identifier)
  * type: string ('COURSE' | 'LESSON' | 'ACTIVITY')
  * name: string (tên entity)
  * description: string
  * difficulty: string ('beginner' | 'intermediate' | 'advanced')
  * tags: array of strings
  * orderNo: number (thứ tự)
  * totalLessons: number (chỉ có ở COURSE)
  * totalDuration: number (phút)
  * instructorId: string
  * language: string
  * isPublished: boolean
  * price: number
  * estimatedTime: number
  * isLocked: boolean
  * courseId: string (chỉ có ở LESSON)
  * objectives: array of strings
  * activityType: string (chỉ có ở ACTIVITY)
  * timeLimit: number
  * points: number
  * lessonId: string (chỉ có ở ACTIVITY)

- Relationship: CONTAINS
  * (Course)-[:CONTAINS]->(Lesson)
  * (Lesson)-[:CONTAINS]->(Activity)

CÂU HỎI TỰ NHIÊN: "${naturalLanguageQuery}"
${entityType ? `Entity Type được chỉ định: ${entityType}` : ''}
${entityId ? `Entity ID được chỉ định: ${entityId}` : ''}

YÊU CẦU:
1. Tạo Cypher query chính xác cho câu hỏi trên
2. Nếu câu hỏi về "có bao nhiêu bài học", dùng count()
3. Nếu câu hỏi về "chi tiết khóa học", dùng MATCH + OPTIONAL MATCH để lấy cả lessons và activities
4. Nếu câu hỏi về "khóa học liên quan", dùng WHERE để filter theo tags hoặc difficulty
5. Nếu có tên khóa học trong câu hỏi, dùng CONTAINS hoặc toLower() để match không phân biệt hoa thường
6. LUÔN LUÔN ORDER BY để kết quả có thứ tự
7. LIMIT kết quả hợp lý (5-50 tuỳ context)
8. Nếu entityId được cung cấp, ưu tiên dùng {id: $entityId}

VÍ DỤ:
Input: "Khóa học Animals for Beginners có bao nhiêu bài học?"
Output:
MATCH (c:Entity {type: 'COURSE'})
WHERE toLower(c.name) CONTAINS 'animals for beginners'
OPTIONAL MATCH (c)-[:CONTAINS]->(l:Entity {type: 'LESSON'})
RETURN c.name, c.id, count(l) as lessonCount

Input: "Chi tiết cấu trúc khóa học Learning English Through Animals"
Output:
MATCH (c:Entity {type: 'COURSE'})
WHERE toLower(c.name) CONTAINS 'learning english through animals'
OPTIONAL MATCH (c)-[:CONTAINS]->(l:Entity {type: 'LESSON'})
OPTIONAL MATCH (l)-[:CONTAINS]->(a:Entity {type: 'ACTIVITY'})
RETURN c,
       collect(DISTINCT {id: l.id, name: l.name, orderNo: l.orderNo}) as lessons,
       count(DISTINCT l) as lessonCount,
       count(DISTINCT a) as activityCount
ORDER BY l.orderNo
LIMIT 1

Input: "Tìm khóa học liên quan về động vật"
Output:
MATCH (c:Entity {type: 'COURSE'})
WHERE any(tag IN c.tags WHERE tag IN ['animals', 'động vật'])
   OR toLower(c.name) CONTAINS 'animal'
OPTIONAL MATCH (c)-[:CONTAINS]->(l:Entity {type: 'LESSON'})
RETURN c, count(l) as lessonCount
ORDER BY lessonCount DESC
LIMIT 5

BÂY GIỜ SINH CYPHER CHO CÂU HỎI TRÊN.
CHỈ TRẢ VỀ CYPHER QUERY, KHÔNG CÓ GIẢI THÍCH HAY MARKDOWN:`;

    try {
      const response = await this.geminiService.generateResponse(prompt);

      // Clean response (remove markdown code blocks if any)
      const cleanedQuery = response
        .trim()
        .replace(/```cypher\n?/g, '')
        .replace(/```\n?/g, '')
        .trim();

      // Validate basic Cypher syntax
      if (!cleanedQuery.toUpperCase().includes('MATCH')) {
        throw new Error('Invalid Cypher query generated: missing MATCH clause');
      }

      return cleanedQuery;
    } catch (error) {
      this.logger.error(`Failed to generate Cypher with AI: ${error.message}`);
      // Fallback to simple query
      return this.generateFallbackQuery(
        naturalLanguageQuery,
        entityType,
        entityId,
      );
    }
  }

  /**
   * Fallback query generator if AI fails
   */
  private generateFallbackQuery(
    query: string,
    entityType?: string,
    entityId?: string,
  ): string {
    if (entityId) {
      return `
        MATCH (e:Entity {id: $entityId})
        OPTIONAL MATCH (e)-[:CONTAINS]->(child)
        RETURN e, collect(child) as children
        LIMIT 1
      `;
    }

    return `
      MATCH (c:Entity {type: 'COURSE'})
      RETURN c
      ORDER BY c.updatedAt DESC
      LIMIT 10
    `;
  }

  /**
   * Format Neo4j results for AI consumption
   */
  private formatResults(results: any[], originalQuery: string): any[] {
    return results.map((record) => {
      const formatted: any = {};

      // Extract node properties
      Object.keys(record).forEach((key) => {
        const value = record[key];

        if (value && typeof value === 'object' && value.properties) {
          // Neo4j node
          formatted[key] = {
            id: value.properties.id,
            type: value.properties.type,
            name: value.properties.name,
            difficulty: value.properties.difficulty,
            orderNo: value.properties.orderNo,
            tags: value.properties.tags,
            // Include other relevant properties
            ...value.properties,
          };
        } else if (value && typeof value === 'object' && value.type) {
          // Neo4j relationship
          formatted[key] = {
            type: value.type,
            properties: value.properties,
          };
        } else {
          formatted[key] = value;
        }
      });

      return formatted;
    });
  }
}
