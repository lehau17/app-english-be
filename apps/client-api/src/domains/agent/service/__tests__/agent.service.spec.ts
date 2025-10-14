import { Test, TestingModule } from '@nestjs/testing';
import { AgentService } from '../../agent.service';
import { PrismaRepository } from '@app/database';
import { GeminiService } from '@app/shared/ai/gemini.service';
import { AgentChatRepository } from '../../repository/agent-chat.repository';
import { KnowledgeDocument } from '@prisma/client';

const mockUserId = 'user-123';
const mockChatDto = { message: 'What is RAG?', conversationId: 'conv-123' };

const mockRelevantDocuments: (KnowledgeDocument & { distance: number })[] = [
  {
    id: 'doc-1',
    title: 'Retrieval-Augmented Generation',
    content: 'RAG is a technique to improve LLM responses...',
    embedding: '',
    embeddingVector: null,
    contentSearch: null,
    documentType: 'tech',
    source: 'internal',
    createdAt: new Date(),
    parentId: null,
    chunkIndex: null,
    totalChunks: 0,
    isChunk: false,
    distance: 0.1,
  },
];

describe('AgentService', () => {
  let service: AgentService;
  let prisma: PrismaRepository;
  let geminiService: GeminiService;
  let agentChatRepo: AgentChatRepository;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AgentService,
        {
          provide: PrismaRepository,
          useValue: {
            $queryRaw: jest.fn(),
          },
        },
        {
          provide: GeminiService,
          useValue: {
            generateEmbedding: jest.fn(),
            generateResponse: jest.fn(),
          },
        },
        {
          provide: AgentChatRepository,
          useValue: {
            logMessage: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<AgentService>(AgentService);
    prisma = module.get<PrismaRepository>(PrismaRepository);
    geminiService = module.get<GeminiService>(GeminiService);
    agentChatRepo = module.get<AgentChatRepository>(AgentChatRepository);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('chatWithAI', () => {
    it('should use RAG and return a response with sources', async () => {
      // Arrange
      jest.spyOn(geminiService, 'generateEmbedding').mockResolvedValue([0.1, 0.2]);
      jest.spyOn(prisma, '$queryRaw').mockResolvedValue(mockRelevantDocuments);
      jest.spyOn(geminiService, 'generateResponse').mockResolvedValue('This is the RAG response.');
      jest.spyOn(agentChatRepo, 'logMessage').mockResolvedValue('conv-123');

      // Act
      const result = await service.chatWithAI(mockChatDto, mockUserId);

      // Assert
      expect(result.response).toBe('This is the RAG response.');
      expect(result.sources).toEqual(['Retrieval-Augmented Generation']);
      expect(result.confidence).toBeGreaterThan(0.8);
      expect(prisma.$queryRaw).toHaveBeenCalled();
      expect(geminiService.generateResponse).toHaveBeenCalledWith(expect.stringContaining('Ngữ cảnh được truy xuất:'));
      expect(agentChatRepo.logMessage).toHaveBeenCalledTimes(2);
    });

    it('should return a response without sources if no documents are found', async () => {
      // Arrange
      jest.spyOn(geminiService, 'generateEmbedding').mockResolvedValue([0.1, 0.2]);
      jest.spyOn(prisma, '$queryRaw').mockResolvedValue([]); // No documents found
      jest.spyOn(geminiService, 'generateResponse').mockResolvedValue('This is a general response.');
      jest.spyOn(agentChatRepo, 'logMessage').mockResolvedValue('conv-123');

      // Act
      const result = await service.chatWithAI(mockChatDto, mockUserId);

      // Assert
      expect(result.response).toBe('This is a general response.');
      expect(result.sources).toEqual([]);
      expect(result.confidence).toBe(0.5);
      expect(geminiService.generateResponse).toHaveBeenCalledWith(expect.not.stringContaining('Ngữ cảnh được truy xuất:'));
    });

    it('should handle errors gracefully', async () => {
        // Arrange
        jest.spyOn(geminiService, 'generateEmbedding').mockRejectedValue(new Error('Embedding failed'));

        // Act
        const result = await service.chatWithAI(mockChatDto, mockUserId);

        // Assert
        expect(result.response).toContain('Xin lỗi, tôi gặp sự cố');
        expect(result.confidence).toBe(0);
    });
  });
});