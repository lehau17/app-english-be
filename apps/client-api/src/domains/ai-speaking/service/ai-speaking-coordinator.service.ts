import { Injectable } from '@nestjs/common';
import { AiSpeakingSessionState } from '@prisma/client';
import { AiSpeakingSessionWithRelations } from '../repository/ai-speaking.repository';
import { FinalizeAiSpeakingSessionDto } from '../dto/finalize-session.dto';

@Injectable()
export class AiSpeakingCoordinator {
  async summarizeSession(
    session: AiSpeakingSessionWithRelations,
    dto: FinalizeAiSpeakingSessionDto,
  ) {
    const topicText = session.topic ?? 'một chủ đề tự do';
    const summaryText = `Hoàn tất phiên luyện nói về "${topicText}" với ${session.turnCount} lượt tương tác. Bạn đã duy trì cuộc trò chuyện với ${session.turnCount} lượt và nhận ${session.silenceWarnings} cảnh báo im lặng.`;

    const payload = {
      learnerReflection: dto.learnerReflection ?? null,
      reason: dto.reason ?? null,
      topic: session.topic,
      goal: session.goal,
      stateBeforeFinalize: session.state,
    } satisfies Record<string, unknown>;

    const analytics = {
      totalTurns: session.turnCount,
      silenceWarnings: session.silenceWarnings,
      offTopicWarnings: session.offTopicWarnings,
      difficultyProgression: session.currentDifficulty,
      finishedAt: new Date().toISOString(),
      statusAfterFinalize: AiSpeakingSessionState.finished,
    } satisfies Record<string, unknown>;

    return {
      summaryText,
      payload,
      analytics,
    };
  }
}
