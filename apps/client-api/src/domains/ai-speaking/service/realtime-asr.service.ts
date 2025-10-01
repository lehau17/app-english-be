import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import WebSocket from 'ws';

export interface RealtimeAsrCallbacks {
  onPartial: (text: string, confidence?: number) => Promise<void> | void;
  onFinal: (result: {
    text: string;
    confidence?: number;
    words?: Array<Record<string, unknown>>;
    raw?: Record<string, unknown> | null;
  }) => Promise<void> | void;
  onError?: (error: Error) => void;
}

export interface RealtimeAsrSessionHandle {
  sendAudioChunk(buffer: Buffer): void;
  finalize(): Promise<void>;
  close(): void;
}

interface EnsureSessionParams {
  sessionId: string;
  turnId: string;
  callbacks: RealtimeAsrCallbacks;
  mimeType?: string;
}

class AsrConnection implements RealtimeAsrSessionHandle {
  private readonly logger = new Logger(AsrConnection.name);
  private readonly ws: WebSocket;
  private readonly pendingQueue: string[] = [];
  private ready = false;
  private closed = false;
  private finalised = false;
  private finalResolver?: () => void;
  private finalPromise: Promise<void>;

  constructor(
    private readonly url: string,
    private readonly callbacks: RealtimeAsrCallbacks,
    private readonly options: { sampleRate: number; format: string },
    private readonly onConnectionClosed: () => void,
  ) {
    this.finalPromise = new Promise<void>((resolve) => {
      this.finalResolver = resolve;
    });

    this.ws = new WebSocket(this.url);
    this.ws.on('open', () => this.handleOpen());
    this.ws.on('message', (data) => this.handleMessage(data.toString()))
      .on('close', () => this.handleClose())
      .on('error', (error) => this.handleError(error));
  }

  sendAudioChunk(buffer: Buffer): void {
    if (this.closed) {
      return;
    }

    const payload = JSON.stringify({
      audio: buffer.toString('base64'),
    });

    if (this.ready) {
      this.ws.send(payload);
    } else {
      this.pendingQueue.push(payload);
    }
  }

  async finalize(): Promise<void> {
    if (this.closed) {
      return;
    }

    if (!this.finalised) {
      const eofPayload = JSON.stringify({ eof: 1 });
      if (this.ready) {
        this.ws.send(eofPayload);
      } else {
        this.pendingQueue.push(eofPayload);
      }
    }

    await this.finalPromise;
  }

  close(): void {
    if (this.closed) return;
    this.closed = true;
    try {
      this.ws.close();
    } catch (error) {
      this.logger.warn(`Error closing ASR websocket: ${(error as Error).message}`);
    }
  }

  private handleOpen() {
    this.ready = true;
    const configPayload = JSON.stringify({
      config: {
        sample_rate: this.options.sampleRate,
        format: this.options.format,
      },
    });
    this.ws.send(configPayload);

    while (this.pendingQueue.length > 0) {
      const next = this.pendingQueue.shift();
      if (next) {
        this.ws.send(next);
      }
    }
  }

  private async handleMessage(message: string) {
    if (!message) return;

    try {
      const parsed = JSON.parse(message);

      if (parsed.partial) {
        await this.callbacks.onPartial(parsed.partial, parsed?.confidence ?? undefined);
      }

      if (parsed.result || parsed.text) {
        if (!this.finalised) {
          this.finalised = true;
          const text: string = parsed.text ?? this.extractTextFromResult(parsed.result);
          const confidence = parsed.confidence ?? this.averageConfidence(parsed.result);
          await this.callbacks.onFinal({
            text,
            confidence,
            words: parsed.result ?? null,
            raw: parsed,
          });
          if (this.finalResolver) {
            this.finalResolver();
            this.finalResolver = undefined;
          }
        }
      }
    } catch (error) {
      this.logger.error(`Failed to parse ASR message: ${(error as Error).message}`);
      this.callbacks.onError?.(error as Error);
    }
  }

  private handleError(error: Error) {
    if (this.closed) return;
    this.callbacks.onError?.(error);
  }

  private handleClose() {
    this.closed = true;
    if (this.finalResolver) {
      this.finalResolver();
      this.finalResolver = undefined;
    }
    this.onConnectionClosed();
  }

  private extractTextFromResult(result: any): string {
    if (!Array.isArray(result)) return '';
    return result
      .map((item) => item?.word ?? '')
      .filter(Boolean)
      .join(' ')
      .trim();
  }

  private averageConfidence(result: any): number | undefined {
    if (!Array.isArray(result) || result.length === 0) return undefined;
    const confidences = result
      .map((item) => (typeof item?.conf === 'number' ? item.conf : undefined))
      .filter((value): value is number => value !== undefined);
    if (!confidences.length) return undefined;
    const sum = confidences.reduce((total, value) => total + value, 0);
    return sum / confidences.length;
  }
}

@Injectable()
export class RealtimeAsrService {
  private readonly logger = new Logger(RealtimeAsrService.name);
  private readonly sessions = new Map<string, AsrConnection>();
  private readonly wsUrl: string | undefined;
  private readonly audioFormat: string;
  private readonly sampleRate: number;

  constructor(private readonly configService: ConfigService) {
    this.wsUrl = this.configService.get<string>('AI_SPEAKING_ASR_WS_URL');
    this.audioFormat = this.configService.get<string>(
      'AI_SPEAKING_ASR_AUDIO_FORMAT',
      'pcm16',
    );
    this.sampleRate = Number(
      this.configService.get<string>('AI_SPEAKING_ASR_SAMPLE_RATE', '16000'),
    );
  }

  async ensureSession(params: EnsureSessionParams): Promise<RealtimeAsrSessionHandle> {
    const { sessionId, turnId, callbacks } = params;
    if (!this.wsUrl) {
      throw new Error('AI_SPEAKING_ASR_WS_URL is not configured');
    }

    const key = this.composeKey(sessionId, turnId);
    const existing = this.sessions.get(key);
    if (existing) {
      return existing;
    }

    const connection = new AsrConnection(
      this.wsUrl,
      callbacks,
      {
        sampleRate: this.sampleRate,
        format: this.audioFormat,
      },
      () => {
        this.sessions.delete(key);
      },
    );

    this.sessions.set(key, connection);
    return connection;
  }

  finalize(sessionId: string, turnId: string): Promise<void> | undefined {
    const key = this.composeKey(sessionId, turnId);
    const connection = this.sessions.get(key);
    return connection?.finalize();
  }

  close(sessionId: string, turnId: string): void {
    const key = this.composeKey(sessionId, turnId);
    const connection = this.sessions.get(key);
    if (connection) {
      connection.close();
      this.sessions.delete(key);
    }
  }

  private composeKey(sessionId: string, turnId: string): string {
    return `${sessionId}:${turnId}`;
  }
}
