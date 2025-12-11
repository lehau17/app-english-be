// RAG Service dùng Prisma thay vì TypeORM
// - Lưu/tìm tài liệu từ bảng knowledge_documents
// - Tính cosine similarity trong RAM (embedding lưu dạng JSON string)
// - Phase sau có thể chuyển sang pgvector + truy vấn ANN bằng raw SQL

import { PrismaRepository } from '@app/database';
import { GeminiService } from '@app/shared';
import { Injectable, Logger } from '@nestjs/common';
import { RagCacheService } from './rag-cache.service';
import { RerankerService } from './reranker.service';
import { TextChunkerService } from './text-chunker.service';

// DTO bạn đã có trong dto/query.dto (AddDocumentDto)
type AddDocumentDto = {
  title: string;
  content: string;
  documentType: string;
  source: string;
};

@Injectable()
export class RagService {
  private readonly logger = new Logger(RagService.name);

  constructor(
    private prisma: PrismaRepository,
    private geminiService: GeminiService,
    private cacheService: RagCacheService,
    private chunkerService: TextChunkerService,
    private rerankerService: RerankerService,
  ) {
    // Tự seed tài liệu mẫu - don't block constructor
    // Use setTimeout to avoid blocking and handle errors gracefully
    setTimeout(() => {
      this.loadSampleDocuments().catch((e) => {
        this.logger.error('Failed to load sample documents:', e);
      });
    }, 0);
  }

  async addDocument(addDocumentDto: AddDocumentDto) {
    this.logger.log(`📄 Đang thêm tài liệu: ${addDocumentDto.title}`);
    const embedding = await this.geminiService.generateEmbedding(
      addDocumentDto.content,
    );
    // Lưu cả bản JSON (backward compat) và cột vector (pgvector) để ANN query
    const doc = await this.prisma.knowledgeDocument.create({
      data: {
        ...addDocumentDto,
        embedding: JSON.stringify(embedding),
      },
    });

    // Ghi vector vào cột embedding_vector (kiểu pgvector) bằng raw SQL cast
    try {
      // Validate embedding is an array of numbers
      if (
        !Array.isArray(embedding) ||
        embedding.some((v) => typeof v !== 'number')
      ) {
        throw new Error('Invalid embedding format: must be array of numbers');
      }

      const vectorText = `[${embedding.join(',')}]`;
      // Use $executeRawUnsafe but with sanitized input (numbers only)
      // This is safe because we validated embedding contains only numbers
      await this.prisma.$executeRawUnsafe(
        `UPDATE knowledge_documents SET embedding_vector = $1::vector WHERE id = $2`,
        vectorText,
        doc.id,
      );
    } catch (e) {
      this.logger.warn(
        `Không thể lưu embedding_vector (pgvector) cho doc ${doc.id}: ${(e as any)?.message}`,
      );
    }
    this.logger.log(`Đã lưu tài liệu ID: ${doc.id}`);

    // Invalidate search cache when new document is added
    this.cacheService.invalidateSearchCache();
    this.logger.log('🗑️ Cache invalidated due to new document');

    return doc;
  }

  /**
   * Add document with automatic chunking for long content
   * Returns parent document + all chunks
   */
  async addDocumentWithChunking(
    addDocumentDto: AddDocumentDto,
    options?: {
      maxTokens?: number;
      overlapTokens?: number;
      forceChunking?: boolean; // Force chunking even for short docs
    },
  ): Promise<{
    parent: any;
    chunks: any[];
    totalChunks: number;
  }> {
    this.logger.log(
      `📄 Adding document with chunking: ${addDocumentDto.title}`,
    );

    // Get recommended chunking options
    const recommended = this.chunkerService.getRecommendedOptions(
      addDocumentDto.content,
    );

    const shouldChunk = options?.forceChunking || recommended.shouldChunk;
    const maxTokens = options?.maxTokens || recommended.maxTokens;
    const overlapTokens = options?.overlapTokens || recommended.overlapTokens;

    // If document is small, just add normally (no chunking)
    if (!shouldChunk) {
      this.logger.log(`📄 Document is small enough, adding without chunking`);
      const doc = await this.addDocument(addDocumentDto);
      return { parent: doc, chunks: [], totalChunks: 0 };
    }

    // Split content into chunks
    const contentChunks = this.chunkerService.splitIntoChunks(
      addDocumentDto.content,
      { maxTokens, overlapTokens, splitOnSentences: true },
    );

    this.logger.log(
      `📄 Split into ${contentChunks.length} chunks (max: ${maxTokens} tokens, overlap: ${overlapTokens})`,
    );

    // Create parent document (store full content)
    const parentEmbedding = await this.geminiService.generateEmbedding(
      addDocumentDto.content,
    );

    const parent = await this.prisma.knowledgeDocument.create({
      data: {
        ...addDocumentDto,
        embedding: JSON.stringify(parentEmbedding),
        isChunk: false,
        totalChunks: contentChunks.length,
      },
    });

    // Save parent embedding to pgvector
    try {
      const vectorText = `[${parentEmbedding.join(',')}]`;
      await this.prisma.$executeRawUnsafe(
        `UPDATE knowledge_documents SET embedding_vector = $1::vector WHERE id = $2`,
        vectorText,
        parent.id,
      );
    } catch (e) {
      this.logger.warn(
        `Failed to save parent embedding_vector: ${(e as any)?.message}`,
      );
    }

    this.logger.log(`Created parent document: ${parent.id}`);

    // Create chunk documents
    const chunks = [];
    for (let i = 0; i < contentChunks.length; i++) {
      const chunkContent = contentChunks[i];
      const chunkEmbedding =
        await this.geminiService.generateEmbedding(chunkContent);

      const chunk = await this.prisma.knowledgeDocument.create({
        data: {
          title: `${addDocumentDto.title} (Chunk ${i + 1}/${contentChunks.length})`,
          content: chunkContent,
          embedding: JSON.stringify(chunkEmbedding),
          documentType: addDocumentDto.documentType,
          source: addDocumentDto.source,
          parentId: parent.id,
          chunkIndex: i,
          isChunk: true,
        },
      });

      // Save chunk embedding to pgvector
      try {
        const vectorText = `[${chunkEmbedding.join(',')}]`;
        await this.prisma.$executeRawUnsafe(
          `UPDATE knowledge_documents SET embedding_vector = $1::vector WHERE id = $2`,
          vectorText,
          chunk.id,
        );
      } catch (e) {
        this.logger.warn(
          `Failed to save chunk embedding_vector: ${(e as any)?.message}`,
        );
      }

      chunks.push(chunk);
      this.logger.log(`Created chunk ${i + 1}/${contentChunks.length}`);
    }

    // Invalidate search cache
    this.cacheService.invalidateSearchCache();
    this.logger.log('🗑️ Cache invalidated due to new chunked document');

    this.logger.log(`Successfully added document with ${chunks.length} chunks`);

    return { parent, chunks, totalChunks: chunks.length };
  }

  async searchKnowledge(
    query: string,
    options?: {
      useExpansion?: boolean; // Default: false (to avoid extra API calls)
      maxExpansions?: number;
      semanticWeight?: number;
      keywordWeight?: number;
      useCache?: boolean; // Default: true
      useReranking?: boolean; // Default: true (enable reranking)
      rerankStrategy?: 'cohere' | 'gemini' | 'auto'; // Default: auto
    },
  ): Promise<{
    answer: string;
    sources: any[];
    confidence: number;
    expandedQueries?: string[]; // Only if useExpansion is true
    fromCache?: boolean; // NEW: Indicate if result from cache
    reranked?: boolean; // NEW: Indicate if reranking was used
  }> {
    this.logger.log(`🔍 Tìm kiếm knowledge cho: ${query}`);

    const useCache = options?.useCache ?? true;
    const useReranking = options?.useReranking ?? true;

    // 💾 Check cache first
    if (useCache) {
      const cached = await this.cacheService.getCachedSearchResults(
        query,
        options,
      );
      if (cached) {
        this.logger.log(`Cache HIT for search: "${query}"`);
        return { ...cached, fromCache: true };
      }
    }

    let relevantDocs: any[];
    let expandedQueries: string[] | undefined;

    // 🌟 Decide whether to use query expansion
    const shouldExpand = options?.useExpansion ?? false;

    if (shouldExpand) {
      // Use query expansion for better recall
      this.logger.log('🌟 Using query expansion...');
      relevantDocs = await this.searchWithExpansion(query, {
        maxExpansions: options?.maxExpansions ?? 3,
        semanticWeight: options?.semanticWeight ?? 0.7,
        keywordWeight: options?.keywordWeight ?? 0.3,
        topKPerQuery: 10,
        finalK: useReranking ? 20 : 5, // Get more candidates if reranking
      });

      // Extract expanded queries for debugging
      const uniqueQueries = new Set<string>();
      relevantDocs.forEach((doc) => {
        if (doc.sourceQueries) {
          doc.sourceQueries.forEach((q: string) => uniqueQueries.add(q));
        }
      });
      expandedQueries = Array.from(uniqueQueries);
    } else {
      // Use hybrid search only (faster, no extra API calls)
      const qEmbed = await this.geminiService.generateEmbedding(query);
      relevantDocs = await this.hybridSearch(query, qEmbed, {
        semanticWeight: options?.semanticWeight ?? 0.7,
        keywordWeight: options?.keywordWeight ?? 0.3,
        topK: 20,
        finalK: useReranking ? 20 : 5, // Get more candidates if reranking
      });
    }

    // 📦 Aggregate chunk scores to parent documents
    this.logger.log('📦 Aggregating chunk scores...');
    relevantDocs = await this.aggregateChunkScores(relevantDocs);
    this.logger.log(
      `After aggregation: ${relevantDocs.length} unique documents`,
    );

    // Re-ranking (optional but recommended)
    let reranked = false;
    if (useReranking && relevantDocs.length > 0) {
      try {
        this.logger.log('Re-ranking documents...');

        const rerankDocs = relevantDocs.map((doc) => ({
          id: doc.id,
          content: doc.content,
          title: doc.title,
          metadata: {
            documentType: doc.documentType,
            source: doc.source,
            originalScore: doc.finalScore,
          },
        }));

        const rerankedResults = await this.rerankerService.rerank(
          query,
          rerankDocs,
          {
            topK: 5,
            strategy: options?.rerankStrategy ?? 'auto',
            minScore: 0.3, // Filter out low relevance
          },
        );

        if (rerankedResults.length > 0) {
          // Replace relevantDocs with reranked results
          relevantDocs = rerankedResults.map((r) => ({
            id: r.document.id,
            title: r.document.title,
            content: r.document.content,
            documentType: r.document.metadata?.documentType,
            source: r.document.metadata?.source,
            finalScore: r.score,
            rerankScore: r.score,
            originalScore: r.document.metadata?.originalScore,
          }));

          reranked = true;
          this.logger.log(
            `Re-ranked to ${relevantDocs.length} documents (strategy: ${options?.rerankStrategy || 'auto'})`,
          );
        }
      } catch (error) {
        this.logger.warn(
          `Re-ranking failed, using original results: ${(error as any)?.message}`,
        );
        // Continue with original results
      }
    }

    if (relevantDocs.length === 0) {
      return {
        answer:
          'Tôi không tìm thấy thông tin liên quan trong tài liệu knowledge base. Vui lòng thử:\n' +
          '- Diễn đạt câu hỏi khác đi\n' +
          '- Cung cấp thêm chi tiết cụ thể\n' +
          '- Hỏi về các chủ đề đã có trong hệ thống (khóa học, quy định, bài học...)',
        sources: [],
        confidence: 0,
        expandedQueries,
      };
    }

    const context = relevantDocs
      .map(
        (d) =>
          `${d.title} (${d.documentType}) [Score: ${d.finalScore.toFixed(3)}]:\n${d.content}`,
      )
      .join('\n\n');

    const prompt = `
Dựa trên các tài liệu sau đây, hãy trả lời câu hỏi một cách chính xác và chi tiết:

TÀI LIỆU THAM KHẢO:
${context}

CÂU HỎI: ${query}

YÊU CẦU:
- Chỉ trả lời dựa trên thông tin có trong tài liệu
- Trích dẫn cụ thể các điều khoản, số liệu khi có thể
- Nếu thông tin không đầy đủ, hãy nói rõ điều đó
- Trả lời bằng tiếng Việt, dễ hiểu
- Ưu tiên sử dụng thông tin từ documents có score cao hơn
`;

    const answer = await this.geminiService.generateResponse(prompt);

    const result = {
      answer,
      sources: relevantDocs.map((d) => ({
        id: d.id,
        title: d.title,
        type: d.documentType,
        source: d.source,
        finalScore: d.finalScore,
        semanticScore: d.semanticScore,
        keywordScore: d.keywordScore,
        rerankScore: d.rerankScore, // NEW: Rerank score if available
        originalScore: d.originalScore, // NEW: Original score before reranking
        hitCount: d.hitCount, // How many expanded queries found this doc
      })),
      confidence: this.calculateConfidence(relevantDocs),
      expandedQueries, // Include expanded queries if used
      fromCache: false,
      reranked, // NEW: Indicate if reranking was used
    };

    // 💾 Cache the result
    if (useCache) {
      await this.cacheService.setCachedSearchResults(query, options, result);
    }

    return result;
  }

  private async findSimilarDocuments(queryEmbedding: number[], topK = 3) {
    // Validate input
    if (!Array.isArray(queryEmbedding) || queryEmbedding.length === 0) {
      this.logger.warn('Invalid query embedding provided');
      return [];
    }
    if (queryEmbedding.some((v) => typeof v !== 'number' || !isFinite(v))) {
      this.logger.warn('Query embedding contains invalid values');
      return [];
    }

    // Nếu cột embedding_vector đã có dữ liệu, dùng truy vấn ANN của Postgres (pgvector)
    try {
      // Safe: Use parameterized query with $queryRawUnsafe
      const vectorText = `[${queryEmbedding.join(',')}]`;

      // Use $queryRawUnsafe with proper parameterization
      const rows = await this.prisma.$queryRawUnsafe<any[]>(
        `SELECT id, title, content, document_type, source, embedding
         FROM knowledge_documents
         WHERE embedding_vector IS NOT NULL
         ORDER BY embedding_vector <-> $1::vector
         LIMIT $2`,
        vectorText,
        topK,
      );

      // Normalize column names so caller gets { id, title, documentType, content, source }
      const normalized = (rows || []).map((r: any) => ({
        id: r.id,
        title: r.title || r.name || r.heading,
        documentType: r.document_type || r.documentType,
        content: r.content,
        source: r.source,
        embedding: r.embedding,
      }));

      if (normalized.length > 0) {
        this.logger.log(
          `Found ${normalized.length} documents using pgvector ANN query`,
        );
        return normalized;
      }
    } catch (e) {
      // Fallback: nếu có lỗi (ví dụ pgvector chưa có), dùng cách cũ
      this.logger.warn(
        'ANN query failed, falling back to in-memory similarity: ' +
          (e as any)?.message,
      );
    }

    // Fallback to in-memory similarity calculation
    this.logger.log('Using fallback in-memory similarity search');
    const allDocs = await this.prisma.knowledgeDocument.findMany();
    const scored = allDocs.map((d) => {
      const emb = d.embedding ? (JSON.parse(d.embedding) as number[]) : [];
      return { doc: d, sim: this.cosineSimilarity(queryEmbedding, emb) };
    });

    return scored
      .filter((x) => x.sim > 0.6)
      .sort((a, b) => b.sim - a.sim)
      .slice(0, topK)
      .map((x) => ({
        id: x.doc.id,
        title: x.doc.title,
        documentType: x.doc.documentType,
        content: x.doc.content,
        source: x.doc.source,
        embedding: x.doc.embedding,
      }));
  }

  private cosineSimilarity(a: number[], b: number[]) {
    const dot = a.reduce((s, v, i) => s + v * (b[i] ?? 0), 0);
    const magA = Math.sqrt(a.reduce((s, v) => s + v * v, 0));
    const magB = Math.sqrt(b.reduce((s, v) => s + v * v, 0));
    return dot / (magA * magB || 1);
  }

  private calculateConfidence(docs: any[]) {
    const base = Math.min(docs.length * 0.25, 1);
    return Math.round(base * 100) / 100;
  }

  /**
   * 🌟 QUERY EXPANSION - Automatically expand user query with variations
   *
   * Generates alternative queries to improve recall by capturing:
   * - Synonyms: "khóa học lập trình" → "khóa học coding"
   * - Related terms: "lập trình" → "web", "mobile", "backend"
   * - Different phrasings: "học tiếng Anh" → "English course"
   *
   * @param originalQuery - The original user query
   * @param maxExpansions - Maximum number of expansions (default: 3)
   * @returns Array of expanded queries including the original
   */
  async expandQuery(
    originalQuery: string,
    maxExpansions = 3,
  ): Promise<string[]> {
    try {
      this.logger.log(`🌟 Expanding query: "${originalQuery}"`);

      // 💾 Check cache first
      const cached = await this.cacheService.getCachedExpansion(originalQuery);
      if (cached) {
        this.logger.log(`Cache HIT for expansion: "${originalQuery}"`);
        return cached;
      }

      const prompt = `Bạn là chuyên gia tìm kiếm thông tin. Nhiệm vụ của bạn là mở rộng câu hỏi tìm kiếm để tăng khả năng tìm được tài liệu liên quan.

CÂU HỎI GỐC: "${originalQuery}"

YÊU CẦU:
1. Tạo ${maxExpansions} câu hỏi tương tự nhưng diễn đạt khác
2. Sử dụng từ đồng nghĩa, từ liên quan
3. Bao gồm cả tiếng Việt và tiếng Anh nếu phù hợp
4. Giữ nguyên ý nghĩa chính của câu hỏi gốc
5. Trả về ĐÚNG định dạng JSON array

VÍ DỤ:
Input: "khóa học lập trình web"
Output: ["khóa học web development", "học làm website", "course web programming"]

Input: "IELTS 7.5"
Output: ["IELTS band 7.5", "luyện thi IELTS đạt 7.5", "IELTS preparation 7.5"]

Bây giờ hãy tạo ${maxExpansions} câu hỏi mở rộng cho câu hỏi gốc.
Chỉ trả về JSON array, không có text giải thích:`;

      const response = await this.geminiService.generateResponse(prompt);

      // Parse JSON response
      const cleanResponse = response
        .trim()
        .replace(/```json\n?/g, '')
        .replace(/```\n?/g, '')
        .trim();

      const expandedQueries = JSON.parse(cleanResponse) as string[];

      // Validate and filter
      const validExpanded = expandedQueries
        .filter((q) => typeof q === 'string' && q.trim().length > 0)
        .slice(0, maxExpansions);

      const finalQueries = [originalQuery, ...validExpanded];

      // 💾 Cache the result
      await this.cacheService.setCachedExpansion(originalQuery, finalQueries);

      this.logger.log(
        `Query expanded to ${finalQueries.length} variations: ${finalQueries.join(' | ')}`,
      );

      return finalQueries;
    } catch (e) {
      this.logger.warn(
        `Query expansion failed: ${(e as any)?.message}. Using original query only.`,
      );
      return [originalQuery];
    }
  }

  /**
   * 🔍 SEARCH WITH EXPANSION - Search using expanded queries
   *
   * Process:
   * 1. Expand query into multiple variations
   * 2. Generate embeddings for each variation
   * 3. Search with each expanded query
   * 4. Deduplicate and rerank results
   *
   * @param originalQuery - The original user query
   * @param options - Search options
   * @returns Deduplicated and reranked results
   */
  async searchWithExpansion(
    originalQuery: string,
    options?: {
      maxExpansions?: number; // Default: 3
      semanticWeight?: number;
      keywordWeight?: number;
      topKPerQuery?: number; // Default: 10 per query
      finalK?: number; // Default: 5 final results
    },
  ) {
    const maxExpansions = options?.maxExpansions ?? 3;
    const topKPerQuery = options?.topKPerQuery ?? 10;
    const finalK = options?.finalK ?? 5;

    this.logger.log(`🔍 Search with expansion: "${originalQuery}"`);

    // 1️⃣ Expand query
    const expandedQueries = await this.expandQuery(
      originalQuery,
      maxExpansions,
    );

    // 2️⃣ Search with each expanded query
    const allResults: any[] = [];

    for (const query of expandedQueries) {
      try {
        // Generate embedding for this query
        const queryEmbedding =
          await this.geminiService.generateEmbedding(query);

        // Hybrid search
        const results = await this.hybridSearch(query, queryEmbedding, {
          semanticWeight: options?.semanticWeight,
          keywordWeight: options?.keywordWeight,
          topK: topKPerQuery,
          finalK: topKPerQuery,
        });

        // Tag results with source query for debugging
        results.forEach((r) => {
          r.sourceQuery = query;
        });

        allResults.push(...results);
      } catch (e) {
        this.logger.warn(
          `Search failed for query "${query}": ${(e as any)?.message}`,
        );
      }
    }

    // 3️⃣ Deduplicate by document ID and aggregate scores
    const deduped = this.deduplicateAndAggregateScores(allResults);

    // 4️⃣ Return top-K results
    const finalResults = deduped.slice(0, finalK);

    this.logger.log(
      `Search with expansion: Found ${finalResults.length} unique results from ${allResults.length} total hits`,
    );

    return finalResults;
  }

  /**
   * Deduplicate results and aggregate scores from multiple queries
   */
  private deduplicateAndAggregateScores(results: any[]) {
    const docMap = new Map<string, any>();

    for (const result of results) {
      const existing = docMap.get(result.id);

      if (existing) {
        // Document found multiple times - boost score!
        existing.finalScore += result.finalScore * 0.5; // Boost by 50% of new score
        existing.hitCount = (existing.hitCount || 1) + 1;
        existing.sourceQueries = existing.sourceQueries || [
          existing.sourceQuery,
        ];
        existing.sourceQueries.push(result.sourceQuery);
      } else {
        // New document
        docMap.set(result.id, {
          ...result,
          hitCount: 1,
          sourceQueries: [result.sourceQuery],
        });
      }
    }

    // Sort by final score (documents found multiple times get higher scores)
    const deduplicated = Array.from(docMap.values()).sort(
      (a, b) => b.finalScore - a.finalScore,
    );

    return deduplicated;
  }

  /**
   * HYBRID SEARCH - Combines semantic (vector) + keyword (full-text) search
   *
   * @param query - User query string
   * @param queryEmbedding - Pre-computed embedding vector
   * @param options - Search options
   * @returns Combined and reranked results
   */
  async hybridSearch(
    query: string,
    queryEmbedding: number[],
    options?: {
      semanticWeight?: number; // Default: 0.7 (70% semantic)
      keywordWeight?: number; // Default: 0.3 (30% keyword)
      topK?: number; // Default: 20 (before reranking)
      finalK?: number; // Default: 5 (after reranking)
    },
  ) {
    const semanticWeight = options?.semanticWeight ?? 0.7;
    const keywordWeight = options?.keywordWeight ?? 0.3;
    const topK = options?.topK ?? 20;
    const finalK = options?.finalK ?? 5;

    this.logger.log(
      `Hybrid Search: "${query}" (semantic: ${semanticWeight * 100}%, keyword: ${keywordWeight * 100}%)`,
    );

    // 1️⃣ Semantic Search using pgvector
    const semanticResults = await this.semanticSearch(queryEmbedding, topK);

    // 2️⃣ Keyword Search using PostgreSQL Full-Text Search
    const keywordResults = await this.keywordSearch(query, topK);

    // 3️⃣ Merge and rerank results
    const mergedResults = this.mergeAndRerank(
      semanticResults,
      keywordResults,
      semanticWeight,
      keywordWeight,
    );

    // 4️⃣ Return top-K results
    const finalResults = mergedResults.slice(0, finalK);

    this.logger.log(
      `Hybrid Search: Found ${finalResults.length} results (${semanticResults.length} semantic + ${keywordResults.length} keyword)`,
    );

    return finalResults;
  }

  /**
   * Semantic search using pgvector (vector similarity)
   */
  private async semanticSearch(queryEmbedding: number[], topK: number) {
    try {
      const vectorText = `[${queryEmbedding.join(',')}]`;

      const rows = await this.prisma.$queryRawUnsafe<any[]>(
        `SELECT
          id,
          title,
          content,
          "documentType",
          source,
          embedding,
          1 - (embedding_vector <-> $1::vector) as similarity
         FROM knowledge_documents
         WHERE embedding_vector IS NOT NULL
         ORDER BY embedding_vector <-> $1::vector
         LIMIT $2`,
        vectorText,
        topK,
      );

      return (rows || []).map((r: any) => ({
        id: r.id,
        title: r.title,
        documentType: r.documentType,
        content: r.content,
        source: r.source,
        embedding: r.embedding,
        semanticScore: Number(r.similarity) || 0,
        keywordScore: 0, // Will be merged later
      }));
    } catch (e) {
      this.logger.warn('Semantic search failed: ' + (e as any)?.message);
      return [];
    }
  }

  /**
   * Keyword search using PostgreSQL Full-Text Search
   */
  private async keywordSearch(query: string, topK: number) {
    try {
      // Sanitize query for full-text search (remove special chars)
      const sanitizedQuery = query.replace(/[^\w\s]/g, ' ').trim();
      if (!sanitizedQuery) {
        this.logger.warn('Empty query after sanitization');
        return [];
      }

      const rows = await this.prisma.$queryRawUnsafe<any[]>(
        `SELECT
          id,
          title,
          content,
          "documentType",
          source,
          embedding,
          ts_rank(content_search, plainto_tsquery('english', $1)) as rank
         FROM knowledge_documents
         WHERE content_search @@ plainto_tsquery('english', $1)
         ORDER BY rank DESC
         LIMIT $2`,
        sanitizedQuery,
        topK,
      );

      return (rows || []).map((r: any) => ({
        id: r.id,
        title: r.title,
        documentType: r.documentType,
        content: r.content,
        source: r.source,
        embedding: r.embedding,
        semanticScore: 0, // Will be merged later
        keywordScore: Number(r.rank) || 0,
      }));
    } catch (e) {
      this.logger.warn('Keyword search failed: ' + (e as any)?.message);
      return [];
    }
  }

  /**
   * Merge results from semantic and keyword search, then rerank
   */
  private mergeAndRerank(
    semanticResults: any[],
    keywordResults: any[],
    semanticWeight: number,
    keywordWeight: number,
  ) {
    const resultsMap = new Map<string, any>();

    // Add semantic results
    for (const doc of semanticResults) {
      resultsMap.set(doc.id, {
        ...doc,
        semanticScore: doc.semanticScore * semanticWeight,
        keywordScore: 0,
      });
    }

    // Merge keyword results
    for (const doc of keywordResults) {
      const existing = resultsMap.get(doc.id);
      if (existing) {
        // Document found in both searches - boost it!
        existing.keywordScore = doc.keywordScore * keywordWeight;
      } else {
        // New document from keyword search
        resultsMap.set(doc.id, {
          ...doc,
          semanticScore: 0,
          keywordScore: doc.keywordScore * keywordWeight,
        });
      }
    }

    // Calculate final scores and sort
    const mergedResults = Array.from(resultsMap.values()).map((doc) => ({
      ...doc,
      finalScore: doc.semanticScore + doc.keywordScore,
    }));

    // Sort by final score (descending)
    return mergedResults.sort((a, b) => b.finalScore - a.finalScore);
  }

  /**
   * Aggregate chunk scores to parent documents
   * - If multiple chunks from same parent are found, combine their scores
   * - Use MAX score strategy (best chunk represents the document)
   * - Alternative: Could use AVERAGE or WEIGHTED_SUM
   */
  async aggregateChunkScores(results: any[]): Promise<any[]> {
    if (results.length === 0) return [];

    // Collect all parentIds from chunks
    const chunkIds = results
      .filter((r) => r.isChunk || r.parentId)
      .map((r) => r.id);

    if (chunkIds.length === 0) {
      // No chunks found, return as-is
      return results;
    }

    // Fetch chunk metadata (parentId info)
    const chunks = await this.prisma.knowledgeDocument.findMany({
      where: { id: { in: chunkIds } },
      select: {
        id: true,
        parentId: true,
        chunkIndex: true,
        isChunk: true,
        parent: {
          select: {
            id: true,
            title: true,
            documentType: true,
            source: true,
            totalChunks: true,
          },
        },
      },
    });

    const chunkMap = new Map(chunks.map((c) => [c.id, c]));

    // Group results by parent
    const parentGroups = new Map<string, any[]>();

    for (const result of results) {
      const chunkMeta = chunkMap.get(result.id);

      if (chunkMeta && chunkMeta.parentId) {
        // This is a chunk, group by parent
        const parentId = chunkMeta.parentId;
        if (!parentGroups.has(parentId)) {
          parentGroups.set(parentId, []);
        }
        parentGroups.get(parentId)!.push({
          ...result,
          chunkIndex: chunkMeta.chunkIndex,
          parentMeta: chunkMeta.parent,
        });
      } else {
        // Root document (not a chunk), group by itself
        if (!parentGroups.has(result.id)) {
          parentGroups.set(result.id, []);
        }
        parentGroups.get(result.id)!.push(result);
      }
    }

    // Aggregate scores for each parent
    const aggregated: any[] = [];

    for (const [parentId, group] of parentGroups.entries()) {
      if (group.length === 1 && !group[0].chunkIndex) {
        // Single root document, no aggregation needed
        aggregated.push(group[0]);
        continue;
      }

      // Multiple chunks from same parent - aggregate
      const maxScore = Math.max(...group.map((g) => g.finalScore));
      const avgScore =
        group.reduce((sum, g) => sum + g.finalScore, 0) / group.length;
      const maxSemanticScore = Math.max(
        ...group.map((g) => g.semanticScore || 0),
      );
      const maxKeywordScore = Math.max(
        ...group.map((g) => g.keywordScore || 0),
      );

      // Use MAX strategy (best chunk score)
      const bestChunk = group.reduce((best, current) =>
        current.finalScore > best.finalScore ? current : best,
      );

      const parent = group[0].parentMeta;

      aggregated.push({
        id: parentId,
        title: parent?.title || bestChunk.title,
        documentType: parent?.documentType || bestChunk.documentType,
        source: parent?.source || bestChunk.source,
        content: bestChunk.content, // Content from best chunk
        semanticScore: maxSemanticScore,
        keywordScore: maxKeywordScore,
        finalScore: maxScore, // Use MAX strategy
        // avgScore, // Alternative: could use average
        chunkCount: group.length,
        bestChunkIndex: bestChunk.chunkIndex,
        totalChunks: parent?.totalChunks || group.length,
      });
    }

    // Sort by final score
    return aggregated.sort((a, b) => b.finalScore - a.finalScore);
  }

  // Seed 3 tài liệu mẫu nếu DB đang trống
  private async loadSampleDocuments() {
    const count = await this.prisma.knowledgeDocument.count();
    if (count > 0) {
      this.logger.log(`Knowledge base đã có ${count} tài liệu`);
      return;
    }

    const samples: Array<Omit<AddDocumentDto, 'embedding'>> = [
      {
        title: 'Quy chế đào tạo - Điều kiện tốt nghiệp',
        content: `
ĐIỀU 15: ĐIỀU KIỆN TỐT NGHIỆP ĐẠI HỌC
1) Hoàn thành đủ số tín chỉ (≥120)
2) GPA ≥ 5.0/10.0
3) Không môn nào < 4.0/10.0
4) Hoàn thành khoá luận hoặc thi tốt nghiệp
5) Đạt chuẩn ngoại ngữ/tin học
        `,
        documentType: 'regulation',
        source: 'Thông tư 08/2021/TT-BGDĐT',
      },
      {
        title: 'Quy chế đào tạo - Xếp loại tốt nghiệp',
        content: `
ĐIỀU 16: XẾP LOẠI
- Xuất sắc: GPA ≥ 8.5; không môn < 7.0; đúng tiến độ
- Giỏi:     7.0 ≤ GPA < 8.5; không môn < 5.0
- Khá:      6.0 ≤ GPA < 7.0; không môn < 4.0
- Trung bình: 5.0 ≤ GPA < 6.0
        `,
        documentType: 'regulation',
        source: 'Thông tư 08/2021/TT-BGDĐT',
      },
      {
        title: 'Hướng dẫn tính điểm GPA',
        content: `
GPA = Σ(Điểm × Số tín chỉ) / Σ(Tổng tín chỉ)
Ví dụ: (8.5×3 + 7.0×2 + 9.0×2) / 7 = 8.21
        `,
        documentType: 'handbook',
        source: 'Phòng Đào tạo',
      },
    ];

    for (const s of samples) {
      try {
        await this.addDocument(s);
        this.logger.log(`Seed doc: ${s.title}`);
      } catch (e) {
        this.logger.error(`Lỗi seed doc: ${s.title}`, e as any);
      }
    }
  }

  /**
   * Index all courses into knowledge base
   * Converts course data into searchable documents
   */
  async indexCourses(): Promise<{ indexed: number; errors: number }> {
    this.logger.log('Bắt đầu index courses...');
    let indexed = 0;
    let errors = 0;

    try {
      const courses = await this.prisma.course.findMany({
        include: {
          instructor: {
            select: {
              firstName: true,
              lastName: true,
              displayName: true,
            },
          },
        },
      });

      for (const course of courses) {
        try {
          const content = this.formatCourseContent(course);
          const docId = `course_${course.id}`;

          // Check if already indexed
          const existing = await this.prisma.knowledgeDocument.findFirst({
            where: { source: docId },
          });

          if (existing) {
            // Update existing document
            const embedding =
              await this.geminiService.generateEmbedding(content);
            await this.prisma.knowledgeDocument.update({
              where: { id: existing.id },
              data: {
                title: course.title,
                content,
                embedding: JSON.stringify(embedding),
              },
            });

            // Update pgvector column
            try {
              if (
                Array.isArray(embedding) &&
                embedding.every((v) => typeof v === 'number')
              ) {
                const vectorText = `[${embedding.join(',')}]`;
                await this.prisma.$executeRawUnsafe(
                  `UPDATE knowledge_documents SET embedding_vector = $1::vector WHERE id = $2`,
                  vectorText,
                  existing.id,
                );
              }
            } catch (e) {
              this.logger.warn(
                `Không thể update embedding_vector cho course ${course.id}`,
              );
            }
          } else {
            // Create new document
            await this.addDocument({
              title: course.title,
              content,
              documentType: 'course',
              source: docId,
            });
          }

          indexed++;
        } catch (e) {
          this.logger.error(
            `Lỗi index course ${course.id}: ${(e as any)?.message}`,
          );
          errors++;
        }
      }

      this.logger.log(`Indexed ${indexed} courses, ${errors} errors`);
      return { indexed, errors };
    } catch (e) {
      this.logger.error('Lỗi index courses:', e as any);
      throw e;
    }
  }

  /**
   * Index all lessons into knowledge base
   */
  async indexLessons(): Promise<{ indexed: number; errors: number }> {
    this.logger.log('📖 Bắt đầu index lessons...');
    let indexed = 0;
    let errors = 0;

    try {
      const lessons = await this.prisma.lesson.findMany({
        include: {
          course: {
            select: {
              title: true,
            },
          },
        },
      });

      for (const lesson of lessons) {
        try {
          const content = this.formatLessonContent(lesson);
          const docId = `lesson_${lesson.id}`;

          const existing = await this.prisma.knowledgeDocument.findFirst({
            where: { source: docId },
          });

          if (existing) {
            const embedding =
              await this.geminiService.generateEmbedding(content);
            await this.prisma.knowledgeDocument.update({
              where: { id: existing.id },
              data: {
                title: lesson.title,
                content,
                embedding: JSON.stringify(embedding),
              },
            });

            try {
              if (
                Array.isArray(embedding) &&
                embedding.every((v) => typeof v === 'number')
              ) {
                const vectorText = `[${embedding.join(',')}]`;
                await this.prisma.$executeRawUnsafe(
                  `UPDATE knowledge_documents SET embedding_vector = $1::vector WHERE id = $2`,
                  vectorText,
                  existing.id,
                );
              }
            } catch (e) {
              this.logger.warn(
                `Không thể update embedding_vector cho lesson ${lesson.id}`,
              );
            }
          } else {
            await this.addDocument({
              title: lesson.title,
              content,
              documentType: 'lesson',
              source: docId,
            });
          }

          indexed++;
        } catch (e) {
          this.logger.error(
            `Lỗi index lesson ${lesson.id}: ${(e as any)?.message}`,
          );
          errors++;
        }
      }

      this.logger.log(`Indexed ${indexed} lessons, ${errors} errors`);
      return { indexed, errors };
    } catch (e) {
      this.logger.error('Lỗi index lessons:', e as any);
      throw e;
    }
  }

  /**
   * Index all vocabulary into knowledge base
   */
  async indexVocabulary(): Promise<{ indexed: number; errors: number }> {
    this.logger.log('Bắt đầu index vocabulary...');
    let indexed = 0;
    let errors = 0;

    try {
      const vocabWords = await this.prisma.vocabulary.findMany({
        take: 1000, // Limit to prevent too many API calls
        orderBy: { frequency: 'desc' },
      });

      for (const vocab of vocabWords) {
        try {
          const content = this.formatVocabularyContent(vocab);
          const docId = `vocab_${vocab.id}`;

          const existing = await this.prisma.knowledgeDocument.findFirst({
            where: { source: docId },
          });

          if (existing) {
            const embedding =
              await this.geminiService.generateEmbedding(content);
            await this.prisma.knowledgeDocument.update({
              where: { id: existing.id },
              data: {
                title: `Vocabulary: ${vocab.word}`,
                content,
                embedding: JSON.stringify(embedding),
              },
            });

            try {
              if (
                Array.isArray(embedding) &&
                embedding.every((v) => typeof v === 'number')
              ) {
                const vectorText = `[${embedding.join(',')}]`;
                await this.prisma.$executeRawUnsafe(
                  `UPDATE knowledge_documents SET embedding_vector = $1::vector WHERE id = $2`,
                  vectorText,
                  existing.id,
                );
              }
            } catch (e) {
              this.logger.warn(
                `Không thể update embedding_vector cho vocab ${vocab.id}`,
              );
            }
          } else {
            await this.addDocument({
              title: `Vocabulary: ${vocab.word}`,
              content,
              documentType: 'vocabulary',
              source: docId,
            });
          }

          indexed++;
        } catch (e) {
          this.logger.error(
            `Lỗi index vocab ${vocab.word}: ${(e as any)?.message}`,
          );
          errors++;
        }
      }

      this.logger.log(`Indexed ${indexed} vocabulary, ${errors} errors`);
      return { indexed, errors };
    } catch (e) {
      this.logger.error('Lỗi index vocabulary:', e as any);
      throw e;
    }
  }

  /**
   * Index all activities into knowledge base
   */
  async indexActivities(): Promise<{ indexed: number; errors: number }> {
    this.logger.log('🎮 Bắt đầu index activities...');
    let indexed = 0;
    let errors = 0;

    try {
      const activities = await this.prisma.activity.findMany({
        include: {
          lesson: {
            select: {
              title: true,
              course: {
                select: {
                  title: true,
                },
              },
            },
          },
        },
        take: 500, // Limit to prevent too many API calls
      });

      for (const activity of activities) {
        try {
          const content = this.formatActivityContent(activity);
          const docId = `activity_${activity.id}`;

          const existing = await this.prisma.knowledgeDocument.findFirst({
            where: { source: docId },
          });

          if (existing) {
            const embedding =
              await this.geminiService.generateEmbedding(content);
            await this.prisma.knowledgeDocument.update({
              where: { id: existing.id },
              data: {
                title: activity.title,
                content,
                embedding: JSON.stringify(embedding),
              },
            });

            try {
              if (
                Array.isArray(embedding) &&
                embedding.every((v) => typeof v === 'number')
              ) {
                const vectorText = `[${embedding.join(',')}]`;
                await this.prisma.$executeRawUnsafe(
                  `UPDATE knowledge_documents SET embedding_vector = $1::vector WHERE id = $2`,
                  vectorText,
                  existing.id,
                );
              }
            } catch (e) {
              this.logger.warn(
                `Không thể update embedding_vector cho activity ${activity.id}`,
              );
            }
          } else {
            await this.addDocument({
              title: activity.title,
              content,
              documentType: 'activity',
              source: docId,
            });
          }

          indexed++;
        } catch (e) {
          this.logger.error(
            `Lỗi index activity ${activity.id}: ${(e as any)?.message}`,
          );
          errors++;
        }
      }

      this.logger.log(`Indexed ${indexed} activities, ${errors} errors`);
      return { indexed, errors };
    } catch (e) {
      this.logger.error('Lỗi index activities:', e as any);
      throw e;
    }
  }

  /**
   * Reindex all model data into knowledge base
   */
  async reindexAllModels(): Promise<{
    courses: { indexed: number; errors: number };
    lessons: { indexed: number; errors: number };
    vocabulary: { indexed: number; errors: number };
    activities: { indexed: number; errors: number };
  }> {
    this.logger.log('Bắt đầu reindex tất cả model data...');

    const results = {
      courses: await this.indexCourses(),
      lessons: await this.indexLessons(),
      vocabulary: await this.indexVocabulary(),
      activities: await this.indexActivities(),
    };

    const totalIndexed =
      results.courses.indexed +
      results.lessons.indexed +
      results.vocabulary.indexed +
      results.activities.indexed;
    const totalErrors =
      results.courses.errors +
      results.lessons.errors +
      results.vocabulary.errors +
      results.activities.errors;

    this.logger.log(
      `Hoàn thành reindex: ${totalIndexed} documents indexed, ${totalErrors} errors`,
    );

    // Invalidate search cache after reindexing
    this.cacheService.invalidateSearchCache();
    this.logger.log('🗑️ Cache invalidated due to reindexing');

    return results;
  }

  // Helper methods to format content for each model type
  private formatCourseContent(course: any): string {
    const instructor = course.instructor
      ? `${course.instructor.displayName || course.instructor.firstName + ' ' + course.instructor.lastName}`
      : 'N/A';

    return `
Khóa học: ${course.title}
Mô tả: ${course.description || 'Không có mô tả'}
Độ khó: ${course.difficulty}
Giáo viên: ${instructor}
Thời lượng ước tính: ${course.estimatedHours || 0} giờ
Giá: ${course.price || 0} ${course.currency || 'VND'}
Tags: ${(course.tags || []).join(', ')}
Yêu cầu: ${(course.prerequisites || []).join(', ') || 'Không có'}
Trạng thái: ${course.isPublished ? 'Đã xuất bản' : 'Chưa xuất bản'}
    `.trim();
  }

  private formatLessonContent(lesson: any): string {
    const courseName = lesson.course?.title || 'N/A';

    return `
Bài học: ${lesson.title}
Thuộc khóa học: ${courseName}
Mô tả: ${lesson.description || 'Không có mô tả'}
Độ khó: ${lesson.difficulty}
Thời gian ước tính: ${lesson.estimatedTime || 0} phút
Thứ tự: ${lesson.orderNo}
Mục tiêu: ${(lesson.objectives || []).join(', ') || 'Không có'}
Trạng thái: ${lesson.isLocked ? 'Đã khóa' : 'Mở'}
    `.trim();
  }

  private formatVocabularyContent(vocab: any): string {
    const examples = vocab.examples
      ? JSON.stringify(vocab.examples)
      : 'Không có ví dụ';

    return `
Từ vựng: ${vocab.word}
Định nghĩa: ${vocab.definition}
Phát âm: ${vocab.pronunciation || 'N/A'}
Độ khó: ${vocab.difficulty}
Danh mục: ${vocab.category || 'N/A'}
Tags: ${(vocab.tags || []).join(', ')}
Tần suất: ${vocab.frequency}
Ngôn ngữ: ${vocab.language}
Ví dụ: ${examples}
    `.trim();
  }

  private formatActivityContent(activity: any): string {
    const courseName = activity.lesson?.course?.title || 'N/A';
    const lessonName = activity.lesson?.title || 'N/A';
    const contentSummary =
      typeof activity.content === 'object'
        ? JSON.stringify(activity.content).substring(0, 200)
        : String(activity.content).substring(0, 200);

    return `
Hoạt động: ${activity.title}
Loại: ${activity.type}
Thuộc bài học: ${lessonName}
Thuộc khóa học: ${courseName}
Độ khó: ${activity.difficulty}
Điểm: ${activity.points}
Thời gian giới hạn: ${activity.timeLimit || 'Không giới hạn'} phút
Số lần thử tối đa: ${activity.maxAttempts || 'Không giới hạn'}
Điểm đạt: ${activity.passingScore || 'N/A'}
Hướng dẫn: ${activity.instructions || 'Không có'}
Nội dung: ${contentSummary}...
    `.trim();
  }
}
