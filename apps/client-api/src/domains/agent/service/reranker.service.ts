import { GeminiService } from '@app/shared';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * RerankerService
 *
 * Re-ranks search results using cross-encoder models for better accuracy.
 *
 * Supports two strategies:
 * 1. Cohere Rerank API (recommended, more accurate)
 * 2. Gemini-based reranking (fallback, free)
 *
 * Usage:
 * ```typescript
 * const results = await rerankerService.rerank(
 *   "Khóa học IELTS 7.5",
 *   documents,
 *   { topK: 3, strategy: 'cohere' }
 * );
 * ```
 */

export interface RerankDocument {
    id: string;
    content: string;
    title?: string;
    metadata?: any;
}

export interface RerankResult {
    id: string;
    score: number;
    index: number;
    document: RerankDocument;
}

export type RerankStrategy = 'cohere' | 'gemini' | 'auto';

export interface RerankOptions {
    topK?: number;
    strategy?: RerankStrategy;
    minScore?: number;
}

@Injectable()
export class RerankerService {
    private readonly logger = new Logger(RerankerService.name);
    private readonly cohereApiKey: string;
    private readonly cohereApiUrl = 'https://api.cohere.ai/v1/rerank';

    constructor(
        private configService: ConfigService,
        private geminiService: GeminiService,
    ) {
        this.cohereApiKey = this.configService.get<string>('COHERE_API_KEY', '');
    }

    /**
     * Re-rank documents based on relevance to query
     */
    async rerank(
        query: string,
        documents: RerankDocument[],
        options?: RerankOptions,
    ): Promise<RerankResult[]> {
        const {
            topK = 3,
            strategy = 'auto',
            minScore = 0.0,
        } = options || {};

        if (documents.length === 0) {
            return [];
        }

        // Auto-select strategy
        const selectedStrategy = this.selectStrategy(strategy);

        this.logger.log(
            `🔄 Re-ranking ${documents.length} documents using ${selectedStrategy} strategy (topK: ${topK})`,
        );

        try {
            let results: RerankResult[];

            if (selectedStrategy === 'cohere') {
                results = await this.rerankWithCohere(query, documents, topK);
            } else {
                results = await this.rerankWithGemini(query, documents, topK);
            }

            // Filter by minimum score
            const filtered = results.filter((r) => r.score >= minScore);

            this.logger.log(
                `✅ Re-ranked to ${filtered.length} documents (min score: ${minScore})`,
            );

            return filtered;
        } catch (error) {
            this.logger.error(
                `❌ Re-ranking failed: ${(error as any)?.message}`,
                error,
            );

            // Fallback: return original order with synthetic scores
            return documents.slice(0, topK).map((doc, index) => ({
                id: doc.id,
                score: 1 - index / documents.length, // Decreasing score
                index,
                document: doc,
            }));
        }
    }

    /**
     * Re-rank using Cohere Rerank API
     *
     * Pros:
     * - Very accurate (state-of-the-art cross-encoder)
     * - Fast (~100-200ms)
     * - Specialized for reranking
     *
     * Cons:
     * - Costs money (~$1 per 1K rerank calls)
     * - Requires API key
     */
    private async rerankWithCohere(
        query: string,
        documents: RerankDocument[],
        topK: number,
    ): Promise<RerankResult[]> {
        if (!this.cohereApiKey) {
            throw new Error('COHERE_API_KEY not configured');
        }

        const response = await fetch(this.cohereApiUrl, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.cohereApiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: 'rerank-english-v3.0',
                query,
                documents: documents.map((doc) => doc.content),
                top_n: topK,
                return_documents: false,
            }),
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`Cohere API error: ${response.status} - ${error}`);
        }

        const data = await response.json();

        // Map results back to documents
        return data.results.map((result: any) => ({
            id: documents[result.index].id,
            score: result.relevance_score,
            index: result.index,
            document: documents[result.index],
        }));
    }

    /**
     * Re-rank using Gemini
     *
     * Pros:
     * - Free (included in Gemini API quota)
     * - No additional API key needed
     *
     * Cons:
     * - Slower (~500-1000ms)
     * - Less accurate than specialized reranker
     * - Uses more tokens
     */
    private async rerankWithGemini(
        query: string,
        documents: RerankDocument[],
        topK: number,
    ): Promise<RerankResult[]> {
        const prompt = `You are a search relevance expert. Rank the following documents by relevance to the query.

QUERY: "${query}"

DOCUMENTS:
${documents.map((doc, i) => `[${i}] ${doc.title || 'Untitled'}\n${doc.content.substring(0, 300)}...`).join('\n\n')}

INSTRUCTIONS:
1. Analyze how relevant each document is to the query
2. Consider semantic meaning, not just keyword matching
3. Return ONLY a JSON array of objects with document index and relevance score (0-1)

OUTPUT FORMAT:
[
  { "index": 0, "score": 0.95, "reason": "..." },
  { "index": 2, "score": 0.87, "reason": "..." },
  ...
]

Return top ${topK} most relevant documents. Output ONLY the JSON array, no other text.`;

        try {
            const response = await this.geminiService.generateResponse(prompt);

            // Extract JSON from response
            const jsonMatch = response.match(/\[[\s\S]*\]/);
            if (!jsonMatch) {
                throw new Error('Failed to parse Gemini response');
            }

            const rankings = JSON.parse(jsonMatch[0]);

            // Map to RerankResult format
            return rankings.slice(0, topK).map((ranking: any) => ({
                id: documents[ranking.index].id,
                score: ranking.score,
                index: ranking.index,
                document: documents[ranking.index],
            }));
        } catch (error) {
            this.logger.error(
                `Gemini reranking failed: ${(error as any)?.message}`,
            );
            throw error;
        }
    }

    /**
     * Select reranking strategy
     */
    private selectStrategy(strategy: RerankStrategy): 'cohere' | 'gemini' {
        if (strategy === 'cohere') {
            if (!this.cohereApiKey) {
                this.logger.warn(
                    'Cohere API key not found, falling back to Gemini',
                );
                return 'gemini';
            }
            return 'cohere';
        }

        if (strategy === 'gemini') {
            return 'gemini';
        }

        // Auto: prefer Cohere if available
        if (this.cohereApiKey) {
            return 'cohere';
        }

        return 'gemini';
    }

    /**
     * Batch re-rank (for large result sets)
     *
     * Splits documents into batches to avoid API limits
     */
    async rerankBatch(
        query: string,
        documents: RerankDocument[],
        options?: RerankOptions & { batchSize?: number },
    ): Promise<RerankResult[]> {
        const { batchSize = 100, topK = 10 } = options || {};

        if (documents.length <= batchSize) {
            return this.rerank(query, documents, options);
        }

        this.logger.log(
            `📦 Batch reranking ${documents.length} documents (batch size: ${batchSize})`,
        );

        // Split into batches
        const batches: RerankDocument[][] = [];
        for (let i = 0; i < documents.length; i += batchSize) {
            batches.push(documents.slice(i, i + batchSize));
        }

        // Rerank each batch
        const batchResults = await Promise.all(
            batches.map((batch) => this.rerank(query, batch, { topK: batchSize })),
        );

        // Merge results and re-sort
        const allResults = batchResults.flat();
        allResults.sort((a, b) => b.score - a.score);

        return allResults.slice(0, topK);
    }

    /**
     * Get available strategies
     */
    getAvailableStrategies(): RerankStrategy[] {
        const strategies: RerankStrategy[] = ['gemini']; // Always available

        if (this.cohereApiKey) {
            strategies.unshift('cohere'); // Prefer Cohere
        }

        return strategies;
    }

    /**
     * Health check
     */
    async healthCheck(): Promise<{
        cohere: boolean;
        gemini: boolean;
        recommended: RerankStrategy;
    }> {
        return {
            cohere: !!this.cohereApiKey,
            gemini: true, // Always available via GeminiService
            recommended: this.cohereApiKey ? 'cohere' : 'gemini',
        };
    }
}


