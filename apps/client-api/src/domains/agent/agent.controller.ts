import { PrismaRepository } from '@app/database';
import {
    Body,
    Controller,
    Get,
    Logger,
    Param,
    Post,
    Query,
    Res,
    StreamableFile,
    UsePipes,
    ValidationPipe,
} from '@nestjs/common';
import { Response } from 'express';
import { createReadStream } from 'fs';
import { join } from 'path';
import { AddDocumentDto, QueryDto } from './dto/query.dto';
import { GraphEntityService } from './service/graph-entity.service';
import { GraphRelationshipService } from './service/graph-relationship.service';
import { GraphTraversalService } from './service/graph-traversal.service';
import { LangChainAgentService } from './service/langchain-agent.service';
import { RagService } from './service/rag.service';

// 👉 SWAGGER IMPORTS
import {
    ApiBody,
    ApiOkResponse,
    ApiOperation,
    ApiResponse,
    ApiTags,
} from '@nestjs/swagger';
// Nếu bạn đã tạo response DTO ở bước (3)

@ApiTags('AI') // gom các endpoint này vào tag "AI" trong Swagger
@Controller('/public/v1/ai')
export class IntelligentController {
    private readonly logger = new Logger(IntelligentController.name);

    constructor(
        private langchainAgent: LangChainAgentService,
        private ragService: RagService,
        private graphEntityService: GraphEntityService,
        private graphRelationshipService: GraphRelationshipService,
        private graphTraversalService: GraphTraversalService,
        private prisma: PrismaRepository,
    ) { }

    @Post('query')
    @UsePipes(new ValidationPipe())
    @ApiOperation({
        summary: 'Hỏi AI Agent',
        description:
            'Router tự động: Knowledge (RAG) / Database (SQL tool) / LLM. Trả về câu trả lời + bước thực thi.',
    })
    @ApiBody({
        type: QueryDto,
        examples: {
            rag: {
                value: { question: 'Điều kiện để được xếp loại tốt nghiệp xuất sắc?' },
            },
            sql: { value: { question: 'Top 5 học sinh có GPA cao nhất lớp 12A1' } },
            hybrid: {
                value: { question: 'Trong 12A1, ai đủ điều kiện tốt nghiệp xuất sắc?' },
            },
        },
    })
    async query(@Body() queryDto: QueryDto) {
        this.logger.log(`📥 Nhận câu hỏi: ${queryDto.question}`);
        const result = await this.langchainAgent.processUserQuery(
            queryDto.question,
        );
        return result;
    }

    @Post('documents')
    @UsePipes(new ValidationPipe())
    @ApiOperation({
        summary: 'Thêm tài liệu vào Knowledge Base',
        description:
            'Sinh embedding và lưu tài liệu để RAG có thể truy xuất sau này.',
    })
    @ApiBody({
        type: AddDocumentDto,
        examples: {
            default: {
                value: {
                    title: 'Quy định học bổng',
                    content: 'Điều kiện nhận học bổng: GPA ≥ 8.0...',
                    documentType: 'regulation',
                    source: 'Phòng CTSV',
                },
            },
        },
    })
    async addDocument(@Body() addDocumentDto: AddDocumentDto) {
        this.logger.log(`📄 Thêm tài liệu: ${addDocumentDto.title}`);
        const document = await this.ragService.addDocument(addDocumentDto);
        return document;
    }

    @Post('add-document-with-chunking')
    @UsePipes(new ValidationPipe())
    @ApiOperation({
        summary: 'Thêm tài liệu với chunking tự động',
        description:
            'Tự động chia tài liệu dài thành chunks nhỏ hơn để cải thiện độ chính xác tìm kiếm.',
    })
    @ApiBody({
        type: AddDocumentDto,
        examples: {
            default: {
                value: {
                    title: 'Hướng dẫn học tiếng Anh toàn diện',
                    content:
                        'Nội dung dài về cách học tiếng Anh... (sẽ tự động chia thành chunks)',
                    documentType: 'GUIDE',
                    source: 'English Learning Center',
                },
            },
        },
    })
    async addDocumentWithChunking(@Body() addDocumentDto: AddDocumentDto) {
        this.logger.log(`📄 Thêm tài liệu với chunking: ${addDocumentDto.title}`);
        const result =
            await this.ragService.addDocumentWithChunking(addDocumentDto);
        return result;
    }

    @Get('health')
    @ApiOperation({ summary: 'Health check' })
    @ApiOkResponse({
        description: 'Tình trạng các service',
        schema: {
            example: {
                status: 'OK',
                services: {
                    langchainAgent: 'running',
                    ragService: 'running',
                    sqlService: 'running',
                    geminiService: 'running',
                },
                timestamp: '2025-08-31T10:20:30.000Z',
            },
        },
    })
    @ApiResponse({ status: 500, description: 'Internal Server Error' })
    async healthCheck() {
        return {
            status: 'OK',
            services: {
                langchainAgent: 'running',
                ragService: 'running',
                sqlService: 'running',
                geminiService: 'running',
            },
            timestamp: new Date().toISOString(),
        };
    }

    @Get('download/:filename')
    @ApiOperation({
        summary: 'Download exported file (Public)',
        description: 'Public endpoint to download Excel/PDF/Word files without authentication. Files are temporary and auto-generated.'
    })
    @ApiResponse({
        status: 200,
        description: 'File download',
    })
    async downloadFile(
        @Param('filename') filename: string,
        @Res({ passthrough: true }) res: Response,
    ): Promise<StreamableFile> {
        this.logger.log(`📥 Public download request: ${filename}`);

        // Determine file type and directory based on extension
        let uploadsDir: string;
        let contentType: string;

        if (filename.endsWith('.xlsx')) {
            uploadsDir = join(process.cwd(), 'uploads', 'exports');
            contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
        } else if (filename.endsWith('.pdf')) {
            uploadsDir = join(process.cwd(), 'uploads', 'reports');
            contentType = 'application/pdf';
        } else if (filename.endsWith('.docx')) {
            uploadsDir = join(process.cwd(), 'uploads', 'documents');
            contentType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
        } else {
            this.logger.warn(`⚠️ Unsupported file type: ${filename}`);
            throw new Error('Unsupported file type');
        }

        const filePath = join(uploadsDir, filename);

        // Set response headers
        res.set({
            'Content-Type': contentType,
            'Content-Disposition': `attachment; filename="${filename}"`,
        });

        const file = createReadStream(filePath);
        return new StreamableFile(file);
    }

    // ==================== Graph RAG Endpoints ====================

    @Post('graph/init-schema')
    @ApiOperation({
        summary: 'Initialize Neo4j schema',
        description: 'Create indexes and constraints in Neo4j',
    })
    async initGraphSchema() {
        this.logger.log('🔧 Initializing Neo4j schema...');
        await this.graphEntityService.initializeSchema();
        return { message: 'Schema initialized successfully' };
    }

    @Post('graph/sync-entities')
    @ApiOperation({
        summary: 'Sync entities from database to Neo4j',
        description: 'Sync courses, lessons, activities from PostgreSQL to Neo4j',
    })
    async syncEntities() {
        this.logger.log('📚 Syncing entities...');
        const count = await this.graphEntityService.syncCoursesFromDatabase(this.prisma);
        return { message: 'Entities synced successfully', count };
    }

    @Post('graph/build-relationships')
    @ApiOperation({
        summary: 'Build structured relationships',
        description: 'Create CONTAINS, FOLLOWS relationships from database structure',
    })
    async buildRelationships() {
        this.logger.log('🔗 Building relationships...');
        const count = await this.graphRelationshipService.buildStructuredRelationships(this.prisma);
        return { message: 'Relationships built successfully', count };
    }

    @Post('graph/discover-relationships')
    @ApiOperation({
        summary: 'Discover semantic relationships',
        description: 'Use vector similarity to find RELATED_TO relationships',
    })
    async discoverRelationships(
        @Body() body: { minSimilarity?: number; limit?: number },
    ) {
        this.logger.log('🔍 Discovering semantic relationships...');
        const count = await this.graphRelationshipService.discoverSemanticRelationships(
            body.minSimilarity || 0.7,
            body.limit || 1000,
        );
        return { message: 'Semantic relationships discovered', count };
    }

    @Get('graph/stats')
    @ApiOperation({
        summary: 'Get graph statistics',
        description: 'Get entity and relationship counts',
    })
    async getGraphStats() {
        const entities = await this.graphEntityService.getStatistics();
        const relationships = await this.graphRelationshipService.getStatistics();
        return { entities, relationships };
    }

    @Get('graph/entities/search')
    @ApiOperation({
        summary: 'Search entities by name',
        description: 'Full-text search on entity names and descriptions',
    })
    async searchEntities(
        @Query('query') query: string,
        @Query('limit') limit?: number,
    ) {
        const entities = await this.graphEntityService.searchByName(
            query,
            limit ? parseInt(limit.toString()) : 20,
        );
        return entities;
    }

    @Get('graph/entities/:id')
    @ApiOperation({
        summary: 'Get entity by ID',
        description: 'Retrieve entity details',
    })
    async getEntity(@Param('id') id: string) {
        const entity = await this.graphEntityService.findById(id);
        if (!entity) {
            return { error: 'Entity not found' };
        }
        return entity;
    }

    @Get('graph/entities/:id/neighbors')
    @ApiOperation({
        summary: 'Get neighbors of entity',
        description: 'Get directly connected entities',
    })
    async getNeighbors(
        @Param('id') id: string,
        @Query('direction') direction?: string,
        @Query('relationshipTypes') relationshipTypes?: string,
    ) {
        const types = relationshipTypes ? relationshipTypes.split(',') : undefined;
        const neighbors = await this.graphTraversalService.getNeighbors(
            id,
            (direction as any) || 'both',
            types,
        );
        return neighbors;
    }

    @Post('graph/traverse')
    @ApiOperation({
        summary: 'Traverse graph from entities',
        description: 'BFS traversal with depth limit',
    })
    async traverseGraph(
        @Body()
        body: {
            startEntityIds: string[];
            maxDepth?: number;
            relationshipTypes?: string[];
            direction?: 'outgoing' | 'incoming' | 'both';
        },
    ) {
        const result = await this.graphTraversalService.traverse(body.startEntityIds, {
            maxDepth: body.maxDepth,
            relationshipTypes: body.relationshipTypes,
            direction: body.direction,
        });
        return result;
    }

    @Post('graph/extract-concepts')
    @ApiOperation({
        summary: 'Extract concepts from text',
        description: 'Use Gemini to extract concepts from document',
    })
    async extractConcepts(@Body() body: { text: string; sourceDocumentId?: string }) {
        const entities = await this.graphEntityService.extractConceptsFromText(
            body.text,
            body.sourceDocumentId,
        );
        return { message: 'Concepts extracted', count: entities.length, entities };
    }

    @Post('graph/learning-path')
    @ApiOperation({
        summary: 'Find learning path',
        description: 'Find prerequisite chain between concepts',
    })
    async findLearningPath(
        @Body() body: { fromConceptId: string; toConceptId: string },
    ) {
        const path = await this.graphTraversalService.findLearningPath(
            body.fromConceptId,
            body.toConceptId,
        );
        if (!path) {
            return { message: 'No learning path found' };
        }
        return path;
    }
}
