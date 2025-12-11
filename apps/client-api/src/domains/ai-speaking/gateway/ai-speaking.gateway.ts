import { forwardRef, Inject, Logger } from '@nestjs/common';
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
import { AiSpeakingRealtimeService } from '../service/ai-speaking-realtime.service';

@WebSocketGateway({
  namespace: '/ai-speaking',
  cors: {
    origin: '*',
  },
})
export class AiSpeakingGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  private readonly logger = new Logger(AiSpeakingGateway.name);
  private readonly clientSessions = new Map<string, Set<string>>();

  @WebSocketServer()
  server: Server;

  constructor(
    @Inject(forwardRef(() => AiSpeakingRealtimeService))
    private readonly realtimeService: AiSpeakingRealtimeService,
  ) {}

  handleConnection(client: Socket) {
    const sessionId =
      (client.handshake.auth?.sessionId as string) ||
      (client.handshake.query?.sessionId as string) ||
      null;
    if (sessionId) {
      client.join(this.sessionRoom(sessionId));
      this.logger.debug(
        `Client ${client.id} joined AI speaking session ${sessionId}`,
      );
      this.clientSessions.set(client.id, new Set());
    } else {
      this.logger.warn(
        `Client ${client.id} connected without sessionId (auth=${JSON.stringify(
          client.handshake.auth,
        )}, query=${JSON.stringify(client.handshake.query)})`,
      );
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.debug(`Client ${client.id} disconnected from AI speaking`);
    const keys = this.clientSessions.get(client.id);
    if (keys?.size) {
      for (const composite of keys) {
        const [sessionId, turnId] = composite.split(':');
        if (sessionId && turnId) {
          void this.realtimeService.abortUserSpeech(sessionId, turnId);
        }
      }
    }
    this.clientSessions.delete(client.id);
  }

  emitToSession(sessionId: string, event: string, payload: unknown) {
    this.server.to(this.sessionRoom(sessionId)).emit(event, payload);
  }

  @SubscribeMessage('ai-speaking:user-audio-chunk')
  async handleAudioChunk(
    @MessageBody()
    payload: {
      sessionId: string;
      turnId: string;
      chunk: string;
      sequence?: number;
      mimeType?: string;
    },
    @ConnectedSocket() client: Socket,
  ) {
    if (!payload?.sessionId || !payload?.turnId || !payload?.chunk) {
      this.logger.warn('Received invalid audio chunk payload');
      return;
    }

    this.trackClientTurn(client.id, payload.sessionId, payload.turnId);

    await this.realtimeService.handleUserAudioChunk({
      sessionId: payload.sessionId,
      turnId: payload.turnId,
      chunkBase64: payload.chunk,
      sequence: payload.sequence,
      mimeType: payload.mimeType,
    });

    client.emit('ai-speaking:ack', {
      type: 'audio-chunk',
      turnId: payload.turnId,
      sequence: payload.sequence ?? null,
    });
  }

  @SubscribeMessage('ai-speaking:user-stop')
  async handleUserStop(
    @MessageBody()
    payload: {
      sessionId: string;
      turnId: string;
      durationSec?: number;
    },
    @ConnectedSocket() client: Socket,
  ) {
    if (!payload?.sessionId || !payload?.turnId) {
      return;
    }

    this.trackClientTurn(client.id, payload.sessionId, payload.turnId);

    await this.realtimeService.finalizeUserSpeech({
      sessionId: payload.sessionId,
      turnId: payload.turnId,
      durationSec: payload.durationSec,
    });

    client.emit('ai-speaking:ack', {
      type: 'user-stop',
      turnId: payload.turnId,
    });
  }

  private sessionRoom(sessionId: string) {
    return `ai-speaking:${sessionId}`;
  }

  private trackClientTurn(clientId: string, sessionId: string, turnId: string) {
    if (!clientId) return;
    const key = `${sessionId}:${turnId}`;
    const set = this.clientSessions.get(clientId) ?? new Set<string>();
    set.add(key);
    this.clientSessions.set(clientId, set);
  }
}
