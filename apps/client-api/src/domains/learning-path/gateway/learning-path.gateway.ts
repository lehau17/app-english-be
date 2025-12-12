import { Logger } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

/**
 * WebSocket Gateway for real-time learning path updates
 * Namespace: /learning-path
 * Events:
 * - step-added: New activity added to learning path
 * - difficulty-adjusted: Difficulty changed based on performance
 * - mastery-achieved: Student mastered a skill
 * - milestone-reached: Progress milestone achieved (25%, 50%, 75%, 100%)
 */
@WebSocketGateway({
  namespace: '/learning-path',
  cors: {
    origin: '*',
  },
})
export class LearningPathGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  private readonly logger = new Logger(LearningPathGateway.name);

  @WebSocketServer()
  server: Server;

  handleConnection(client: Socket) {
    const pathId =
      (client.handshake.auth?.pathId as string) ||
      (client.handshake.query?.pathId as string) ||
      null;

    if (pathId) {
      client.join(this.pathRoom(pathId));
      this.logger.debug(`Client ${client.id} joined learning path ${pathId}`);
    } else {
      this.logger.warn(`Client ${client.id} connected without pathId`);
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.debug(`Client ${client.id} disconnected from learning path`);
  }

  @SubscribeMessage('subscribe')
  handleSubscribe(
    @MessageBody() data: { pathId: string },
    @ConnectedSocket() client: Socket,
  ) {
    if (!data?.pathId) {
      this.logger.warn('Client attempted to subscribe without pathId');
      return;
    }

    const room = this.pathRoom(data.pathId);
    client.join(room);
    this.logger.debug(
      `Client ${client.id} subscribed to learning path ${data.pathId}`,
    );

    client.emit('subscribed', { pathId: data.pathId });
  }

  @SubscribeMessage('unsubscribe')
  handleUnsubscribe(
    @MessageBody() data: { pathId: string },
    @ConnectedSocket() client: Socket,
  ) {
    if (!data?.pathId) return;

    const room = this.pathRoom(data.pathId);
    client.leave(room);
    this.logger.debug(
      `Client ${client.id} unsubscribed from learning path ${data.pathId}`,
    );
  }

  emitStepAdded(pathId: string, step: any) {
    this.server.to(this.pathRoom(pathId)).emit('step-added', step);
    this.logger.debug(`Emitted step-added for path ${pathId}`, {
      stepId: step?.id,
    });
  }

  emitDifficultyAdjusted(
    pathId: string,
    data: { newDifficulty: number; reason: string; activityId?: string },
  ) {
    this.server.to(this.pathRoom(pathId)).emit('difficulty-adjusted', data);
    this.logger.debug(`Emitted difficulty-adjusted for path ${pathId}`, data);
  }

  emitMasteryAchieved(
    pathId: string,
    data: {
      skillId: string;
      skillName: string;
      masteryLevel: number;
      timestamp: string;
    },
  ) {
    this.server.to(this.pathRoom(pathId)).emit('mastery-achieved', data);
    this.logger.debug(`Emitted mastery-achieved for path ${pathId}`, data);
  }

  emitMilestoneReached(
    pathId: string,
    data: {
      percentage: number;
      badge: string;
      unlockedAt: string;
      message: string;
    },
  ) {
    this.server.to(this.pathRoom(pathId)).emit('milestone-reached', data);
    this.logger.debug(`Emitted milestone-reached for path ${pathId}`, data);
  }

  emitProgressUpdate(
    pathId: string,
    data: { completedSteps: number; totalSteps: number; percentage: number },
  ) {
    this.server.to(this.pathRoom(pathId)).emit('progress-update', data);
    this.logger.debug(`Emitted progress-update for path ${pathId}`, data);
  }

  private pathRoom(pathId: string): string {
    return `learning-path:${pathId}`;
  }
}
