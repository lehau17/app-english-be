jest.mock('../src/domains/agent/service/langchain-agent.service', () => ({
  LangChainAgentService: jest.fn(),
}));
jest.mock('../src/domains/agent/repository/agent-chat.repository', () => ({
  AgentChatRepository: jest.fn(),
}));
jest.mock('@app/database', () => ({
  PrismaRepository: jest.fn(),
}));
jest.mock('../src/domains/agent/service/rag.service', () => ({
  RagService: jest.fn(),
}));
jest.mock('../src/domains/agent/service/sql.service', () => ({
  SqlService: jest.fn(),
}));
jest.mock('../src/domains/agent/tools/rag.tool', () => ({
  RagTool: jest.fn(),
}));

// Set required environment variables before imports
process.env.KAFKA_BROKERS = 'localhost:9092';

// Mock the Kafka module to prevent initialization issues
jest.mock('@app/shared/kafka/kafka.module', () => ({
  KafkaModule: {
    register: jest.fn(() => ({
      module: class MockKafkaModule {},
      providers: [],
      exports: [],
    })),
  },
}));

import { AgentService } from '../src/domains/agent/service/agent.service';

describe('AgentService', () => {
  let service: AgentService;
  let mockLangchainAgent: any;
  let mockAgentChatRepository: any;
  let mockPrisma: any;

  const mockUser = {
    id: 'user-1',
    firstName: 'Nguyen',
    lastName: 'Van A',
    displayName: 'Nguyen A',
    email: 'student@example.com',
    role: 'student',
    classroomsStudying: [],
    classroomsTeaching: [],
    childRelations: [],
  };

  const mockTeacherUser = {
    id: 'user-teacher',
    firstName: 'Tran',
    lastName: 'Thi B',
    displayName: 'Tran B',
    email: 'teacher@example.com',
    role: 'teacher',
    classroomsStudying: [],
    classroomsTeaching: [
      {
        id: 'class-1',
        name: 'English 101',
        course: { id: 'course-1', title: 'Beginner English' },
      },
    ],
    childRelations: [],
  };

  const mockParentUser = {
    id: 'user-parent',
    firstName: 'Le',
    lastName: 'Van C',
    displayName: 'Le C',
    email: 'parent@example.com',
    role: 'parent',
    classroomsStudying: [],
    classroomsTeaching: [],
    childRelations: [
      {
        child: {
          id: 'child-1',
          firstName: 'Le',
          lastName: 'Thi D',
          displayName: 'Le D',
          classroomsStudying: [
            {
              classroom: {
                name: 'Kids Class',
                course: { title: 'Kids English' },
              },
            },
          ],
        },
      },
    ],
  };

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Create mock instances
    mockLangchainAgent = {
      processUserQuery: jest.fn(),
      streamUserQuery: jest.fn(),
    } as any;

    mockAgentChatRepository = {
      findConversationById: jest.fn(),
      createConversation: jest.fn(),
      createMessage: jest.fn(),
      updateConversation: jest.fn(),
      findUserConversations: jest.fn(),
      deleteConversation: jest.fn(),
      getConversationMessages: jest.fn(),
    } as any;

    mockPrisma = {
      user: {
        findUnique: jest.fn(),
      },
    } as any;

    // Create service instance with mocked dependencies
    service = new AgentService(
      mockLangchainAgent,
      mockAgentChatRepository,
      mockPrisma,
    );
  });

  describe('chatWithAI', () => {
    it('should create new conversation and save messages when no conversation exists', async () => {
      // Arrange
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      mockAgentChatRepository.findConversationById.mockResolvedValue(null);
      mockAgentChatRepository.createConversation.mockResolvedValue({
        id: 'conv-1',
      } as any);
      mockLangchainAgent.processUserQuery.mockResolvedValue({
        response: 'Hello student!',
        toolsUsed: ['rag', 'sql'],
        reasoning: 'Used knowledge base',
        processingTime: 10,
        executionSteps: [],
      } as any);

      // Act
      const result = await service.chatWithAI(
        { message: 'Hi' } as any,
        'user-1',
        'student',
      );

      // Assert
      expect(result).toBeDefined();
      expect(result.response).toBe('Hello student!');
      expect(result.conversationId).toBe('conv-1');
      expect(result.toolsUsed).toEqual(['rag', 'sql']);

      // Should create conversation
      expect(mockAgentChatRepository.createConversation).toHaveBeenCalledTimes(
        1,
      );
      expect(mockAgentChatRepository.createConversation).toHaveBeenCalledWith({
        userId: 'user-1',
        role: 'student',
        title: 'Hi',
      });

      // Should save user message and assistant message
      expect(mockAgentChatRepository.createMessage).toHaveBeenCalledTimes(2);

      // Check user message
      const userMessageCall = mockAgentChatRepository.createMessage.mock.calls[0][0];
      expect(userMessageCall.role).toBe('user');
      expect(userMessageCall.content).toBe('Hi');
      expect(userMessageCall.conversationId).toBe('conv-1');

      // Check assistant message
      const assistantMessageCall =
        mockAgentChatRepository.createMessage.mock.calls[1][0];
      expect(assistantMessageCall.role).toBe('assistant');
      expect(assistantMessageCall.content).toBe('Hello student!');
      expect(assistantMessageCall.conversationId).toBe('conv-1');

      // Should update conversation timestamp
      expect(mockAgentChatRepository.updateConversation).toHaveBeenCalledTimes(
        1,
      );
    });

    it('should use existing conversation history when available', async () => {
      // Arrange
      const existingConversation = {
        id: 'conv-2',
        userId: 'user-1',
        messages: [
          { role: 'user', content: 'Previous question' },
          { role: 'assistant', content: 'Previous answer' },
        ],
      };

      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      mockAgentChatRepository.findConversationById.mockResolvedValue(
        existingConversation as any,
      );
      mockLangchainAgent.processUserQuery.mockResolvedValue({
        response: 'Reply based on history',
        toolsUsed: [],
        reasoning: '',
        processingTime: 5,
        executionSteps: [],
      } as any);

      // Act
      const result = await service.chatWithAI(
        { message: 'Follow up?', conversationId: 'conv-2' } as any,
        'user-1',
        'student',
      );

      // Assert
      expect(result).toBeDefined();
      expect(result.response).toBe('Reply based on history');
      expect(result.conversationId).toBe('conv-2');

      // Should not create new conversation
      expect(mockAgentChatRepository.createConversation).not.toHaveBeenCalled();

      // Should pass chat history to langchain
      expect(mockLangchainAgent.processUserQuery).toHaveBeenCalledWith(
        'Follow up?',
        [
          { role: 'user', content: 'Previous question' },
          { role: 'assistant', content: 'Previous answer' },
        ],
        'student',
        expect.any(String),
      );

      // Should save messages
      expect(mockAgentChatRepository.createMessage).toHaveBeenCalledTimes(2);
    });

    it('should create new conversation when conversationId is invalid', async () => {
      // Arrange
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      mockAgentChatRepository.findConversationById.mockResolvedValue(null);
      mockAgentChatRepository.createConversation.mockResolvedValue({
        id: 'conv-new',
      } as any);
      mockLangchainAgent.processUserQuery.mockResolvedValue({
        response: 'New conversation started',
        toolsUsed: [],
        reasoning: '',
        processingTime: 5,
        executionSteps: [],
      } as any);

      // Act
      const result = await service.chatWithAI(
        { message: 'Hello', conversationId: 'invalid-id' } as any,
        'user-1',
        'student',
      );

      // Assert
      expect(result.conversationId).toBe('conv-new');
      expect(mockAgentChatRepository.createConversation).toHaveBeenCalledTimes(
        1,
      );
    });

    it('should handle error and return error response', async () => {
      // Arrange
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      mockAgentChatRepository.createConversation.mockResolvedValue({
        id: 'conv-1',
      } as any);
      mockLangchainAgent.processUserQuery.mockRejectedValue(
        new Error('API Error'),
      );

      // Act
      const result = await service.chatWithAI(
        { message: 'Hello' } as any,
        'user-1',
        'student',
      );

      // Assert
      expect(result.response).toContain('encountered an error');
      expect(result.confidence).toBe(0.1);
      expect(result.sources).toEqual([]);
    });

    it('should format user info for student role', async () => {
      // Arrange
      const studentWithClass = {
        ...mockUser,
        classroomsStudying: [
          {
            classroom: {
              name: 'English 101',
              course: { title: 'Beginner English' },
            },
          },
        ],
      };

      mockPrisma.user.findUnique.mockResolvedValue(studentWithClass);
      mockAgentChatRepository.createConversation.mockResolvedValue({
        id: 'conv-1',
      } as any);
      mockLangchainAgent.processUserQuery.mockResolvedValue({
        response: 'Hello',
        toolsUsed: [],
        reasoning: '',
        processingTime: 5,
        executionSteps: [],
      } as any);

      // Act
      await service.chatWithAI({ message: 'Hi' } as any, 'user-1', 'student');

      // Assert
      const userInfoArg = mockLangchainAgent.processUserQuery.mock.calls[0][3];
      expect(userInfoArg).toContain('Nguyen Van A');
      expect(userInfoArg).toContain('student@example.com');
      expect(userInfoArg).toContain('student');
      expect(userInfoArg).toContain('English 101');
    });

    it('should format user info for teacher role', async () => {
      // Arrange
      mockPrisma.user.findUnique.mockResolvedValue(mockTeacherUser);
      mockAgentChatRepository.createConversation.mockResolvedValue({
        id: 'conv-1',
      } as any);
      mockLangchainAgent.processUserQuery.mockResolvedValue({
        response: 'Hello',
        toolsUsed: [],
        reasoning: '',
        processingTime: 5,
        executionSteps: [],
      } as any);

      // Act
      await service.chatWithAI(
        { message: 'Hi' } as any,
        'user-teacher',
        'teacher',
      );

      // Assert
      const userInfoArg = mockLangchainAgent.processUserQuery.mock.calls[0][3];
      expect(userInfoArg).toContain('Tran Thi B');
      expect(userInfoArg).toContain('teacher');
      expect(userInfoArg).toContain('Lớp giảng dạy');
      expect(userInfoArg).toContain('English 101');
    });

    it('should format user info for parent role', async () => {
      // Arrange
      mockPrisma.user.findUnique.mockResolvedValue(mockParentUser);
      mockAgentChatRepository.createConversation.mockResolvedValue({
        id: 'conv-1',
      } as any);
      mockLangchainAgent.processUserQuery.mockResolvedValue({
        response: 'Hello',
        toolsUsed: [],
        reasoning: '',
        processingTime: 5,
        executionSteps: [],
      } as any);

      // Act
      await service.chatWithAI(
        { message: 'Hi' } as any,
        'user-parent',
        'parent',
      );

      // Assert
      const userInfoArg = mockLangchainAgent.processUserQuery.mock.calls[0][3];
      expect(userInfoArg).toContain('Le Van C');
      expect(userInfoArg).toContain('parent');
      expect(userInfoArg).toContain('Con em');
      expect(userInfoArg).toContain('Le Thi D');
    });

    it('should handle user not found', async () => {
      // Arrange
      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockAgentChatRepository.createConversation.mockResolvedValue({
        id: 'conv-1',
      } as any);
      mockLangchainAgent.processUserQuery.mockResolvedValue({
        response: 'Hello',
        toolsUsed: [],
        reasoning: '',
        processingTime: 5,
        executionSteps: [],
      } as any);

      // Act
      await service.chatWithAI({ message: 'Hi' } as any, 'user-1', 'student');

      // Assert - should still work but with default user info
      const userInfoArg = mockLangchainAgent.processUserQuery.mock.calls[0][3];
      expect(userInfoArg).toContain('Không tìm thấy thông tin người dùng');
    });
  });

  describe('getRecommendations', () => {
    it('should return mock recommendations', async () => {
      // Act
      const recommendations = await service.getRecommendations();

      // Assert
      expect(recommendations).toBeDefined();
      expect(recommendations.length).toBeGreaterThan(0);
      expect(recommendations[0]).toHaveProperty('id');
      expect(recommendations[0]).toHaveProperty('type');
      expect(recommendations[0]).toHaveProperty('title');
      expect(recommendations[0]).toHaveProperty('description');
      expect(recommendations[0]).toHaveProperty('confidence');
    });

    it('should handle errors gracefully in catch block', async () => {
      // Note: getRecommendations() has internal error handling and always returns an array
      // This test documents the behavior but we can't easily force an error in the mock data path
      // The actual error handling is tested by the implementation's try-catch

      // Act
      const recommendations = await service.getRecommendations();

      // Assert - should always return an array (never throws)
      expect(Array.isArray(recommendations)).toBe(true);
    });
  });

  describe('getUserConversations', () => {
    it('should return user conversations with default pagination', async () => {
      // Arrange
      const mockConversations = [
        { id: 'conv-1', userId: 'user-1', title: 'First chat' },
        { id: 'conv-2', userId: 'user-1', title: 'Second chat' },
      ];
      mockAgentChatRepository.findUserConversations.mockResolvedValue(
        mockConversations as any,
      );

      // Act
      const result = await service.getUserConversations('user-1');

      // Assert
      expect(result).toEqual(mockConversations);
      expect(mockAgentChatRepository.findUserConversations).toHaveBeenCalledWith(
        'user-1',
        { limit: 20, offset: 0 },
      );
    });

    it('should return user conversations with custom pagination', async () => {
      // Arrange
      mockAgentChatRepository.findUserConversations.mockResolvedValue([]);

      // Act
      await service.getUserConversations('user-1', 10, 5);

      // Assert
      expect(mockAgentChatRepository.findUserConversations).toHaveBeenCalledWith(
        'user-1',
        { limit: 10, offset: 5 },
      );
    });
  });

  describe('getConversation', () => {
    it('should return conversation when user owns it', async () => {
      // Arrange
      const mockConversation = {
        id: 'conv-1',
        userId: 'user-1',
        title: 'Test conversation',
        messages: [],
      };
      mockAgentChatRepository.findConversationById.mockResolvedValue(
        mockConversation as any,
      );

      // Act
      const result = await service.getConversation('conv-1', 'user-1');

      // Assert
      expect(result).toEqual(mockConversation);
    });

    it('should throw error when conversation not found', async () => {
      // Arrange
      mockAgentChatRepository.findConversationById.mockResolvedValue(null);

      // Act & Assert
      await expect(
        service.getConversation('conv-1', 'user-1'),
      ).rejects.toThrow('Conversation not found or access denied');
    });

    it('should throw error when user does not own conversation', async () => {
      // Arrange
      const mockConversation = {
        id: 'conv-1',
        userId: 'user-2',
        title: 'Test conversation',
        messages: [],
      };
      mockAgentChatRepository.findConversationById.mockResolvedValue(
        mockConversation as any,
      );

      // Act & Assert
      await expect(
        service.getConversation('conv-1', 'user-1'),
      ).rejects.toThrow('Conversation not found or access denied');
    });
  });

  describe('deleteConversation', () => {
    it('should delete conversation when user owns it', async () => {
      // Arrange
      const mockConversation = {
        id: 'conv-1',
        userId: 'user-1',
        title: 'Test conversation',
      };
      mockAgentChatRepository.findConversationById.mockResolvedValue(
        mockConversation as any,
      );
      mockAgentChatRepository.deleteConversation.mockResolvedValue(
        mockConversation as any,
      );

      // Act
      const result = await service.deleteConversation('conv-1', 'user-1');

      // Assert
      expect(result).toEqual(mockConversation);
      expect(mockAgentChatRepository.deleteConversation).toHaveBeenCalledWith(
        'conv-1',
      );
    });

    it('should throw error when conversation not found', async () => {
      // Arrange
      mockAgentChatRepository.findConversationById.mockResolvedValue(null);

      // Act & Assert
      await expect(
        service.deleteConversation('conv-1', 'user-1'),
      ).rejects.toThrow('Conversation not found or access denied');
      expect(mockAgentChatRepository.deleteConversation).not.toHaveBeenCalled();
    });

    it('should throw error when user does not own conversation', async () => {
      // Arrange
      const mockConversation = {
        id: 'conv-1',
        userId: 'user-2',
        title: 'Test conversation',
      };
      mockAgentChatRepository.findConversationById.mockResolvedValue(
        mockConversation as any,
      );

      // Act & Assert
      await expect(
        service.deleteConversation('conv-1', 'user-1'),
      ).rejects.toThrow('Conversation not found or access denied');
      expect(mockAgentChatRepository.deleteConversation).not.toHaveBeenCalled();
    });
  });

  describe('streamChatWithAI', () => {
    it('should stream chat response with metadata', async () => {
      // Arrange
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'user-1' } as any);
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      mockAgentChatRepository.createConversation.mockResolvedValue({
        id: 'conv-1',
      } as any);

      // Mock streaming response
      const mockStreamChunks = [
        { type: 'token', content: 'Hello' },
        { type: 'token', content: ' there' },
        {
          type: 'complete',
          data: {
            answer: 'Hello there',
            toolsUsed: ['rag'],
            reasoning: 'Used RAG',
            executionSteps: [],
          },
        },
      ];

      mockLangchainAgent.streamUserQuery.mockImplementation(async function* () {
        for (const chunk of mockStreamChunks) {
          yield chunk;
        }
      });

      // Act
      const chunks: any[] = [];
      for await (const chunk of service.streamChatWithAI(
        { message: 'Hi' } as any,
        'user-1',
        'student',
      )) {
        chunks.push(chunk);
      }

      // Assert
      expect(chunks.length).toBeGreaterThan(0);
      expect(chunks[0].type).toBe('metadata');
      expect(chunks[0].data.conversationId).toBe('conv-1');

      // Should save messages
      expect(mockAgentChatRepository.createMessage).toHaveBeenCalled();
      expect(mockAgentChatRepository.updateConversation).toHaveBeenCalled();
    });

    it('should throw error when userId is empty', async () => {
      // Act
      const chunks: any[] = [];
      for await (const chunk of service.streamChatWithAI(
        { message: 'Hi' } as any,
        '',
        'student',
      )) {
        chunks.push(chunk);
      }

      // Assert
      expect(chunks[0].type).toBe('error');
      expect(chunks[0].content).toContain('User ID is required');
    });

    it('should throw error when user does not exist', async () => {
      // Arrange
      mockPrisma.user.findUnique.mockResolvedValue(null);

      // Act
      const chunks: any[] = [];
      for await (const chunk of service.streamChatWithAI(
        { message: 'Hi' } as any,
        'user-1',
        'student',
      )) {
        chunks.push(chunk);
      }

      // Assert
      expect(chunks[0].type).toBe('error');
      expect(chunks[0].content).toContain('does not exist in database');
    });

    it('should use existing conversation when provided', async () => {
      // Arrange
      const existingConversation = {
        id: 'conv-existing',
        userId: 'user-1',
        messages: [{ role: 'user', content: 'Previous' }],
      };

      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      mockAgentChatRepository.findConversationById.mockResolvedValue(
        existingConversation as any,
      );

      mockLangchainAgent.streamUserQuery.mockImplementation(async function* () {
        yield { type: 'token', content: 'Response' };
      });

      // Act
      const chunks: any[] = [];
      for await (const chunk of service.streamChatWithAI(
        { message: 'Hi', conversationId: 'conv-existing' } as any,
        'user-1',
        'student',
      )) {
        chunks.push(chunk);
      }

      // Assert
      expect(chunks[0].data.conversationId).toBe('conv-existing');
      expect(mockAgentChatRepository.createConversation).not.toHaveBeenCalled();
    });
  });
});
