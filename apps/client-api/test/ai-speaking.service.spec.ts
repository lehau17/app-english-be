// Set required environment variables before any imports
process.env.KAFKA_BROKERS = 'localhost:9092';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';

import { ForbiddenException, NotFoundException } from '@nestjs/common';
import {
  AiSpeakingSessionState,
  AiSpeakingTurnRole,
  AiSpeakingTurnStatus,
  DifficultyLevel,
} from '@prisma/client';
import { AiSpeakingService } from '../src/domains/ai-speaking/service/ai-speaking.service';

// Minimal mock implementations for dependencies
const makeMocks = () => {
  const prisma: any = {
    $transaction: jest.fn((callback: any) => callback(prisma)),
    aiSpeakingSession: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    },
    aiSpeakingTurn: {
      create: jest.fn(),
      update: jest.fn(),
    },
    aiSpeakingTurnSegment: {
      create: jest.fn(),
    },
  };

  const repository: any = {
    findSessionById: jest.fn(),
    findActiveSessionByUser: jest.fn(),
    listSessionsByUser: jest.fn(),
    createSession: jest.fn(),
    updateSession: jest.fn(),
    createTurn: jest.fn(),
    updateTurn: jest.fn(),
    createTurnSegment: jest.fn(),
    findSessionsByConversation: jest.fn(),
    listConversationsByUser: jest.fn(),
  };

  const coordinator: any = {
    summarizeSession: jest.fn(),
  };

  const realtimeService: any = {
    streamAiTurn: jest.fn(),
  };

  const conversationDesigner: any = {
    buildOpeningPrompt: jest.fn(),
  };

  return {
    prisma,
    repository,
    coordinator,
    realtimeService,
    conversationDesigner,
  };
};

describe('AiSpeakingService', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  describe('startSession', () => {
    test('should create session with all required entities', async () => {
      const {
        prisma,
        repository,
        coordinator,
        realtimeService,
        conversationDesigner,
      } = makeMocks();

      const userId = 'user-123';
      const dto = {
        topic: 'Daily routines',
        goal: 'Improve speaking fluency',
        targetDifficulty: DifficultyLevel.beginner,
        maxTurns: 8,
      };

      // Mock conversation designer
      conversationDesigner.buildOpeningPrompt.mockReturnValue({
        prompt: 'Hello! Let\'s practice speaking about "Daily routines".',
        followUpSuggestions: ['What time do you wake up?'],
        metadata: { topic: 'Daily routines', difficulty: 'beginner' },
        version: '1.0.0',
      });

      // Mock transaction flow
      const mockSession = {
        id: 'session-123',
        userId,
        conversationId: 'conv_20241006_abc123',
        topic: dto.topic,
        goal: dto.goal,
        state: AiSpeakingSessionState.ai_speaking,
        maxTurns: 8,
        turnCount: 1,
        targetDifficulty: DifficultyLevel.beginner,
        currentDifficulty: DifficultyLevel.beginner,
        silenceWarnings: 0,
        offTopicWarnings: 0,
        config: {},
        metadata: { topic: 'Daily routines', difficulty: 'beginner' },
        analytics: null,
        summary: null,
        summaryPayload: null,
        startedAt: new Date(),
        lastActivityAt: new Date(),
        endedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        turns: [
          {
            id: 'turn-123',
            sessionId: 'session-123',
            turnIndex: 1,
            state: AiSpeakingTurnStatus.streaming,
            aiPrompt: 'Hello!',
            aiAudioUrl: null,
            userTranscript: null,
            userAudioUrl: null,
            userDurationSec: null,
            metrics: null,
            evaluation: null,
            suggestions: ['What time do you wake up?'],
            score: null,
            relevanceScore: null,
            silenceDetected: false,
            createdAt: new Date(),
            updatedAt: new Date(),
            segments: [
              {
                id: 'segment-1',
                turnId: 'turn-123',
                role: AiSpeakingTurnRole.system,
                orderNo: 0,
                transcript: 'Session initialized',
                audioUrl: null,
                durationSec: null,
                payload: { designerVersion: '1.0.0' },
                createdAt: new Date(),
              },
              {
                id: 'segment-2',
                turnId: 'turn-123',
                role: AiSpeakingTurnRole.ai,
                orderNo: 1,
                transcript: 'Hello!',
                audioUrl: null,
                durationSec: null,
                payload: { topic: 'Daily routines', difficulty: 'beginner' },
                createdAt: new Date(),
              },
            ],
          },
        ],
      };

      repository.createSession.mockResolvedValue(mockSession);
      repository.createTurn.mockResolvedValue({
        id: 'turn-123',
        segments: [],
      });
      repository.createTurnSegment.mockResolvedValue({});
      repository.updateSession.mockResolvedValue(mockSession);
      repository.findSessionById.mockResolvedValue(mockSession);

      const svc = new AiSpeakingService(
        prisma,
        repository,
        coordinator,
        realtimeService,
        conversationDesigner,
      );

      const result = await svc.startSession(userId, dto);

      // Verify conversation designer was called
      expect(conversationDesigner.buildOpeningPrompt).toHaveBeenCalledWith({
        topic: dto.topic,
        difficulty: dto.targetDifficulty,
      });

      // Verify session creation
      expect(repository.createSession).toHaveBeenCalledWith(
        expect.objectContaining({
          user: { connect: { id: userId } },
          topic: dto.topic,
          goal: dto.goal,
          state: AiSpeakingSessionState.pending,
          maxTurns: 8,
          turnCount: 0,
        }),
        expect.anything(),
      );

      // Verify turn creation
      expect(repository.createTurn).toHaveBeenCalledWith(
        expect.objectContaining({
          session: { connect: { id: mockSession.id } },
          turnIndex: 1,
          state: AiSpeakingTurnStatus.streaming,
        }),
        expect.anything(),
      );

      // Verify segments creation (system and AI)
      expect(repository.createTurnSegment).toHaveBeenCalledTimes(2);
      expect(repository.createTurnSegment).toHaveBeenCalledWith(
        expect.objectContaining({
          role: AiSpeakingTurnRole.system,
          orderNo: 0,
          transcript: 'Session initialized',
        }),
        expect.anything(),
      );
      expect(repository.createTurnSegment).toHaveBeenCalledWith(
        expect.objectContaining({
          role: AiSpeakingTurnRole.ai,
          orderNo: 1,
        }),
        expect.anything(),
      );

      // Verify session state update
      expect(repository.updateSession).toHaveBeenCalledWith(
        mockSession.id,
        expect.objectContaining({
          state: AiSpeakingSessionState.ai_speaking,
          turnCount: 1,
        }),
        expect.anything(),
      );

      // Verify realtime service streaming
      expect(realtimeService.streamAiTurn).toHaveBeenCalled();

      // Verify result structure
      expect(result).toBeDefined();
      expect(result.id).toBe('session-123');
      expect(result.topic).toBe(dto.topic);
      expect(result.turns).toHaveLength(1);
    });

    test('should generate conversationId when not provided', async () => {
      const {
        prisma,
        repository,
        coordinator,
        realtimeService,
        conversationDesigner,
      } = makeMocks();

      const userId = 'user-123';
      const dto = {
        topic: 'Travel',
      };

      conversationDesigner.buildOpeningPrompt.mockReturnValue({
        prompt: 'Hello!',
        followUpSuggestions: [],
        metadata: {},
        version: '1.0.0',
      });

      const mockSession = {
        id: 'session-123',
        userId,
        conversationId: expect.stringMatching(/^conv_\d{8}_[a-z0-9]{6}$/),
        topic: dto.topic,
        state: AiSpeakingSessionState.ai_speaking,
        turns: [],
      };

      repository.createSession.mockResolvedValue(mockSession);
      repository.createTurn.mockResolvedValue({ id: 'turn-123', segments: [] });
      repository.createTurnSegment.mockResolvedValue({});
      repository.updateSession.mockResolvedValue(mockSession);
      repository.findSessionById.mockResolvedValue(mockSession);

      const svc = new AiSpeakingService(
        prisma,
        repository,
        coordinator,
        realtimeService,
        conversationDesigner,
      );

      await svc.startSession(userId, dto);

      // Verify that conversationId was generated
      expect(repository.createSession).toHaveBeenCalledWith(
        expect.objectContaining({
          conversationId: expect.stringMatching(/^conv_\d{8}_[a-z0-9]{6}$/),
        }),
        expect.anything(),
      );
    });
  });

  describe('getSession', () => {
    test('should return session when user owns it', async () => {
      const {
        prisma,
        repository,
        coordinator,
        realtimeService,
        conversationDesigner,
      } = makeMocks();

      const userId = 'user-123';
      const sessionId = 'session-123';

      const mockSession = {
        id: sessionId,
        userId,
        conversationId: 'conv-123',
        topic: 'Travel',
        goal: null,
        state: AiSpeakingSessionState.ai_speaking,
        maxTurns: 8,
        turnCount: 2,
        targetDifficulty: DifficultyLevel.beginner,
        currentDifficulty: DifficultyLevel.beginner,
        silenceWarnings: 0,
        offTopicWarnings: 0,
        config: {},
        metadata: {},
        analytics: null,
        summary: null,
        summaryPayload: null,
        startedAt: new Date(),
        lastActivityAt: new Date(),
        endedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        turns: [],
      };

      repository.findSessionById.mockResolvedValue(mockSession);

      const svc = new AiSpeakingService(
        prisma,
        repository,
        coordinator,
        realtimeService,
        conversationDesigner,
      );

      const result = await svc.getSession(userId, sessionId);

      expect(result).toBeDefined();
      expect(result.id).toBe(sessionId);
      expect(result.userId).toBe(userId);
      expect(repository.findSessionById).toHaveBeenCalledWith(sessionId);
    });

    test('should throw NotFoundException when session does not exist', async () => {
      const {
        prisma,
        repository,
        coordinator,
        realtimeService,
        conversationDesigner,
      } = makeMocks();

      const userId = 'user-123';
      const sessionId = 'nonexistent-session';

      repository.findSessionById.mockResolvedValue(null);

      const svc = new AiSpeakingService(
        prisma,
        repository,
        coordinator,
        realtimeService,
        conversationDesigner,
      );

      await expect(svc.getSession(userId, sessionId)).rejects.toThrow(
        NotFoundException,
      );
      await expect(svc.getSession(userId, sessionId)).rejects.toThrow(
        'Session không tồn tại',
      );
    });

    test('should throw ForbiddenException when user does not own session', async () => {
      const {
        prisma,
        repository,
        coordinator,
        realtimeService,
        conversationDesigner,
      } = makeMocks();

      const userId = 'user-123';
      const sessionId = 'session-123';
      const otherUserId = 'user-456';

      const mockSession = {
        id: sessionId,
        userId: otherUserId, // Different user
        conversationId: 'conv-123',
        topic: 'Travel',
        state: AiSpeakingSessionState.ai_speaking,
        turns: [],
      };

      repository.findSessionById.mockResolvedValue(mockSession);

      const svc = new AiSpeakingService(
        prisma,
        repository,
        coordinator,
        realtimeService,
        conversationDesigner,
      );

      await expect(svc.getSession(userId, sessionId)).rejects.toThrow(
        ForbiddenException,
      );
      await expect(svc.getSession(userId, sessionId)).rejects.toThrow(
        'Bạn không có quyền truy cập session này',
      );
    });
  });

  describe('listSessions', () => {
    test('should return list of user sessions', async () => {
      const {
        prisma,
        repository,
        coordinator,
        realtimeService,
        conversationDesigner,
      } = makeMocks();

      const userId = 'user-123';

      const mockSessions = [
        {
          id: 'session-1',
          userId,
          conversationId: 'conv-1',
          topic: 'Travel',
          goal: null,
          state: AiSpeakingSessionState.finished,
          maxTurns: 8,
          turnCount: 5,
          targetDifficulty: DifficultyLevel.beginner,
          currentDifficulty: DifficultyLevel.beginner,
          silenceWarnings: 0,
          offTopicWarnings: 0,
          config: {},
          metadata: {},
          analytics: null,
          summary: 'Completed session',
          summaryPayload: null,
          startedAt: new Date('2024-01-01'),
          lastActivityAt: new Date('2024-01-01'),
          endedAt: new Date('2024-01-01'),
          createdAt: new Date('2024-01-01'),
          updatedAt: new Date('2024-01-01'),
          turns: [],
        },
        {
          id: 'session-2',
          userId,
          conversationId: 'conv-2',
          topic: 'Food',
          goal: null,
          state: AiSpeakingSessionState.ai_speaking,
          maxTurns: 8,
          turnCount: 2,
          targetDifficulty: DifficultyLevel.intermediate,
          currentDifficulty: DifficultyLevel.intermediate,
          silenceWarnings: 0,
          offTopicWarnings: 0,
          config: {},
          metadata: {},
          analytics: null,
          summary: null,
          summaryPayload: null,
          startedAt: new Date('2024-01-02'),
          lastActivityAt: new Date('2024-01-02'),
          endedAt: null,
          createdAt: new Date('2024-01-02'),
          updatedAt: new Date('2024-01-02'),
          turns: [],
        },
      ];

      repository.listSessionsByUser.mockResolvedValue(mockSessions);

      const svc = new AiSpeakingService(
        prisma,
        repository,
        coordinator,
        realtimeService,
        conversationDesigner,
      );

      const result = await svc.listSessions(userId);

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('session-1');
      expect(result[1].id).toBe('session-2');
      expect(repository.listSessionsByUser).toHaveBeenCalledWith(userId, {});
    });

    test('should pass pagination options', async () => {
      const {
        prisma,
        repository,
        coordinator,
        realtimeService,
        conversationDesigner,
      } = makeMocks();

      const userId = 'user-123';
      const options = { limit: 10, cursor: 'session-123' };

      repository.listSessionsByUser.mockResolvedValue([]);

      const svc = new AiSpeakingService(
        prisma,
        repository,
        coordinator,
        realtimeService,
        conversationDesigner,
      );

      await svc.listSessions(userId, options);

      expect(repository.listSessionsByUser).toHaveBeenCalledWith(
        userId,
        options,
      );
    });
  });

  describe('finalizeSession', () => {
    test('should successfully finalize session', async () => {
      const {
        prisma,
        repository,
        coordinator,
        realtimeService,
        conversationDesigner,
      } = makeMocks();

      const userId = 'user-123';
      const sessionId = 'session-123';
      const dto = {
        reason: 'Completed all exercises',
        learnerReflection: 'Great session!',
      };

      const mockSession = {
        id: sessionId,
        userId,
        conversationId: 'conv-123',
        topic: 'Travel',
        goal: null,
        state: AiSpeakingSessionState.ai_speaking,
        maxTurns: 8,
        turnCount: 5,
        targetDifficulty: DifficultyLevel.beginner,
        currentDifficulty: DifficultyLevel.beginner,
        silenceWarnings: 0,
        offTopicWarnings: 1,
        config: {},
        metadata: {},
        analytics: null,
        summary: null,
        summaryPayload: null,
        startedAt: new Date(),
        lastActivityAt: new Date(),
        endedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        turns: [],
      };

      const summaryResult = {
        summaryText: 'Session completed successfully',
        payload: {
          learnerReflection: dto.learnerReflection,
          reason: dto.reason,
          topic: 'Travel',
          goal: null,
          stateBeforeFinalize: AiSpeakingSessionState.ai_speaking,
        },
        analytics: {
          totalTurns: 5,
          silenceWarnings: 0,
          offTopicWarnings: 1,
          difficultyProgression: DifficultyLevel.beginner,
          finishedAt: expect.any(String),
          statusAfterFinalize: AiSpeakingSessionState.finished,
        },
      };

      const updatedSession = {
        ...mockSession,
        state: AiSpeakingSessionState.finished,
        summary: summaryResult.summaryText,
        summaryPayload: summaryResult.payload,
        analytics: summaryResult.analytics,
        endedAt: new Date(),
      };

      repository.findSessionById.mockResolvedValue(mockSession);
      coordinator.summarizeSession.mockResolvedValue(summaryResult);
      repository.updateSession.mockResolvedValue(updatedSession);

      const svc = new AiSpeakingService(
        prisma,
        repository,
        coordinator,
        realtimeService,
        conversationDesigner,
      );

      const result = await svc.finalizeSession(userId, sessionId, dto);

      expect(coordinator.summarizeSession).toHaveBeenCalledWith(
        mockSession,
        dto,
      );
      expect(repository.updateSession).toHaveBeenCalledWith(
        sessionId,
        expect.objectContaining({
          state: AiSpeakingSessionState.finished,
          summary: summaryResult.summaryText,
          summaryPayload: summaryResult.payload,
          analytics: summaryResult.analytics,
        }),
      );
      expect(result.state).toBe(AiSpeakingSessionState.finished);
    });

    test('should skip finalization if session is already finished', async () => {
      const {
        prisma,
        repository,
        coordinator,
        realtimeService,
        conversationDesigner,
      } = makeMocks();

      const userId = 'user-123';
      const sessionId = 'session-123';
      const dto = {
        reason: 'Trying to finalize again',
      };

      const mockSession = {
        id: sessionId,
        userId,
        conversationId: 'conv-123',
        topic: 'Travel',
        goal: null,
        state: AiSpeakingSessionState.finished, // Already finished
        maxTurns: 8,
        turnCount: 5,
        targetDifficulty: DifficultyLevel.beginner,
        currentDifficulty: DifficultyLevel.beginner,
        silenceWarnings: 0,
        offTopicWarnings: 0,
        config: {},
        metadata: {},
        analytics: {},
        summary: 'Previous summary',
        summaryPayload: {},
        startedAt: new Date(),
        lastActivityAt: new Date(),
        endedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        turns: [],
      };

      repository.findSessionById.mockResolvedValue(mockSession);

      const svc = new AiSpeakingService(
        prisma,
        repository,
        coordinator,
        realtimeService,
        conversationDesigner,
      );

      const result = await svc.finalizeSession(userId, sessionId, dto);

      // Should not call coordinator or update
      expect(coordinator.summarizeSession).not.toHaveBeenCalled();
      expect(repository.updateSession).not.toHaveBeenCalled();

      // Should return the session as-is
      expect(result.state).toBe(AiSpeakingSessionState.finished);
      expect(result.summary).toBe('Previous summary');
    });

    test('should throw NotFoundException when session does not exist', async () => {
      const {
        prisma,
        repository,
        coordinator,
        realtimeService,
        conversationDesigner,
      } = makeMocks();

      const userId = 'user-123';
      const sessionId = 'nonexistent-session';
      const dto = { reason: 'Test' };

      repository.findSessionById.mockResolvedValue(null);

      const svc = new AiSpeakingService(
        prisma,
        repository,
        coordinator,
        realtimeService,
        conversationDesigner,
      );

      await expect(
        svc.finalizeSession(userId, sessionId, dto),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('listConversations', () => {
    test('should return grouped conversations', async () => {
      const {
        prisma,
        repository,
        coordinator,
        realtimeService,
        conversationDesigner,
      } = makeMocks();

      const userId = 'user-123';

      const mockConversations = [
        {
          conversationId: 'conv-1',
          latestSession: {
            id: 'session-3',
            userId,
            conversationId: 'conv-1',
            topic: 'Travel',
            goal: null,
            state: AiSpeakingSessionState.finished,
            maxTurns: 8,
            turnCount: 5,
            targetDifficulty: DifficultyLevel.beginner,
            currentDifficulty: DifficultyLevel.beginner,
            silenceWarnings: 0,
            offTopicWarnings: 0,
            config: {},
            metadata: {},
            analytics: null,
            summary: 'Completed',
            summaryPayload: null,
            startedAt: new Date(),
            lastActivityAt: new Date(),
            endedAt: new Date(),
            createdAt: new Date(),
            updatedAt: new Date(),
            turns: [],
          },
          sessionCount: 3,
        },
      ];

      repository.listConversationsByUser.mockResolvedValue(mockConversations);

      const svc = new AiSpeakingService(
        prisma,
        repository,
        coordinator,
        realtimeService,
        conversationDesigner,
      );

      const result = await svc.listConversations(userId);

      expect(result).toHaveLength(1);
      expect(result[0].conversationId).toBe('conv-1');
      expect(result[0].sessionCount).toBe(3);
      expect(result[0].latestSession).toBeDefined();
      expect(result[0].latestSession.id).toBe('session-3');
    });
  });

  describe('getConversation', () => {
    test('should return all sessions in a conversation', async () => {
      const {
        prisma,
        repository,
        coordinator,
        realtimeService,
        conversationDesigner,
      } = makeMocks();

      const userId = 'user-123';
      const conversationId = 'conv-123';

      const mockSessions = [
        {
          id: 'session-1',
          userId,
          conversationId,
          topic: 'Travel',
          goal: null,
          state: AiSpeakingSessionState.finished,
          maxTurns: 8,
          turnCount: 5,
          targetDifficulty: DifficultyLevel.beginner,
          currentDifficulty: DifficultyLevel.beginner,
          silenceWarnings: 0,
          offTopicWarnings: 0,
          config: {},
          metadata: {},
          analytics: null,
          summary: 'First session',
          summaryPayload: null,
          startedAt: new Date('2024-01-01'),
          lastActivityAt: new Date('2024-01-01'),
          endedAt: new Date('2024-01-01'),
          createdAt: new Date('2024-01-01'),
          updatedAt: new Date('2024-01-01'),
          turns: [],
        },
        {
          id: 'session-2',
          userId,
          conversationId,
          topic: 'Travel',
          goal: null,
          state: AiSpeakingSessionState.finished,
          maxTurns: 8,
          turnCount: 6,
          targetDifficulty: DifficultyLevel.beginner,
          currentDifficulty: DifficultyLevel.elementary,
          silenceWarnings: 0,
          offTopicWarnings: 0,
          config: {},
          metadata: {},
          analytics: null,
          summary: 'Second session',
          summaryPayload: null,
          startedAt: new Date('2024-01-02'),
          lastActivityAt: new Date('2024-01-02'),
          endedAt: new Date('2024-01-02'),
          createdAt: new Date('2024-01-02'),
          updatedAt: new Date('2024-01-02'),
          turns: [],
        },
      ];

      repository.findSessionsByConversation.mockResolvedValue(mockSessions);

      const svc = new AiSpeakingService(
        prisma,
        repository,
        coordinator,
        realtimeService,
        conversationDesigner,
      );

      const result = await svc.getConversation(userId, conversationId);

      expect(result.conversationId).toBe(conversationId);
      expect(result.sessions).toHaveLength(2);
      expect(result.sessions[0].id).toBe('session-1');
      expect(result.sessions[1].id).toBe('session-2');
      expect(repository.findSessionsByConversation).toHaveBeenCalledWith(
        userId,
        conversationId,
      );
    });

    test('should throw NotFoundException when conversation does not exist', async () => {
      const {
        prisma,
        repository,
        coordinator,
        realtimeService,
        conversationDesigner,
      } = makeMocks();

      const userId = 'user-123';
      const conversationId = 'nonexistent-conv';

      repository.findSessionsByConversation.mockResolvedValue([]);

      const svc = new AiSpeakingService(
        prisma,
        repository,
        coordinator,
        realtimeService,
        conversationDesigner,
      );

      await expect(
        svc.getConversation(userId, conversationId),
      ).rejects.toThrow(NotFoundException);
      await expect(
        svc.getConversation(userId, conversationId),
      ).rejects.toThrow('Conversation không tồn tại');
    });
  });
});
