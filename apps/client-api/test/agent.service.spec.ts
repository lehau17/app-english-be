import { AgentService } from '../src/domains/agent/service/agent.service';

// Minimal mock implementations for dependencies
const makeMocks = () => {
  const langchainAgent: any = {
    processUserQuery: jest.fn(),
    streamUserQuery: jest.fn(),
  };

  const agentChatRepository: any = {
    findConversationById: jest.fn(),
    createConversation: jest.fn(),
    createMessage: jest.fn(),
    updateConversation: jest.fn(),
  };

  const prisma: any = {
    user: {
      findUnique: jest.fn(),
    },
  };

  return { langchainAgent, agentChatRepository, prisma };
};

describe('AgentService', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  test('chatWithAI should create new conversation and save messages when no conversation exists', async () => {
    const { langchainAgent, agentChatRepository, prisma } = makeMocks();

    // Mock user returned by Prisma
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      firstName: 'Nguyen',
      lastName: 'Van A',
      displayName: 'Nguyen A',
      email: 'student@example.com',
      role: 'student',
      classroomsStudying: [],
      classroomsTeaching: [],
      childRelations: [],
    });

    // No existing conversation
    agentChatRepository.findConversationById.mockResolvedValue(null);

    // Create conversation returns id
    agentChatRepository.createConversation.mockResolvedValue({ id: 'conv-1' });

    // Langchain returns an answer
    langchainAgent.processUserQuery.mockResolvedValue({
      response: 'Hello student!',
      toolsUsed: [],
      reasoning: '',
      processingTime: 10,
    });

    const svc = new AgentService(langchainAgent as any, agentChatRepository as any, prisma as any);

    const result = await svc.chatWithAI({ message: 'Hi' } as any, 'user-1', 'student');

    expect(result).toBeDefined();
  expect(result.response).toBe('Hello student!');

    // Should create conversation
    expect(agentChatRepository.createConversation).toHaveBeenCalledTimes(1);

    // Should save user message and assistant message
    expect(agentChatRepository.createMessage).toHaveBeenCalled();
    // First call: user message, second call: assistant message
    const calls = agentChatRepository.createMessage.mock.calls;
    expect(calls.length).toBeGreaterThanOrEqual(2);

    const assistantCall = calls.find((c: any[]) => c[0].role === 'assistant');
    expect(assistantCall).toBeTruthy();
    expect(assistantCall[0].content).toBe('Hello student!');
  });

  test('chatWithAI should use existing conversation history when available', async () => {
    const { langchainAgent, agentChatRepository, prisma } = makeMocks();

    prisma.user.findUnique.mockResolvedValue({
      id: 'user-2',
      firstName: 'Tran',
      lastName: 'Thi B',
      displayName: 'Tran B',
      email: 'teacher@example.com',
      role: 'teacher',
      classroomsStudying: [],
      classroomsTeaching: [],
      childRelations: [],
    });

    // Existing conversation with messages
    const existingConversation = {
      id: 'conv-2',
      userId: 'user-2',
      messages: [
        { role: 'user', content: 'Previous question' },
        { role: 'assistant', content: 'Previous answer' },
      ],
    };

    agentChatRepository.findConversationById.mockResolvedValue(existingConversation);

    langchainAgent.processUserQuery.mockResolvedValue({
      response: 'Reply based on history',
      toolsUsed: [],
      reasoning: '',
      processingTime: 5,
    });

    const svc = new AgentService(langchainAgent as any, agentChatRepository as any, prisma as any);

    const result = await svc.chatWithAI({ message: 'Follow up?' , conversationId: 'conv-2' } as any, 'user-2', 'teacher');

    expect(result).toBeDefined();
  expect(result.response).toBe('Reply based on history');

    // Should not create new conversation
    expect(agentChatRepository.createConversation).not.toHaveBeenCalled();

    // Should save messages
    expect(agentChatRepository.createMessage).toHaveBeenCalled();
  });
});
