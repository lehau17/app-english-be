import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { spawn } from 'child_process';
import WebSocket from 'ws';

@Injectable()
export class AiSpeakingHealthService implements OnModuleInit {
  private readonly logger = new Logger(AiSpeakingHealthService.name);
  private readonly shouldSkip: boolean;
  private readonly timeoutMs: number;

  constructor(private readonly configService: ConfigService) {
    this.shouldSkip = this.configService.get('AI_SPEAKING_HEALTH_SKIP') === 'true';
    this.timeoutMs = Number(
      this.configService.get<string>('AI_SPEAKING_HEALTH_TIMEOUT_MS', '3000'),
    );
  }

  async onModuleInit() {
    if (this.shouldSkip) {
      this.logger.log('AI speaking health checks skipped by configuration');
      return;
    }

    await Promise.allSettled([this.checkTtsCommand(), this.checkAsrGateway()]);
  }

  private async checkTtsCommand(): Promise<void> {
    const useHttp = this.configService.get<string>('AI_SPEAKING_TTS_USE_HTTP') === 'true';

    if (useHttp) {
      this.logger.log('TTS using HTTP API - skipping command check');
      return;
    }

    const command = this.configService.get<string>('AI_SPEAKING_TTS_COMMAND', 'piper');
    if (!command) {
      this.logger.warn('AI_SPEAKING_TTS_COMMAND is not configured');
      return;
    }

    const start = Date.now();

    await new Promise<void>((resolve) => {
      const child = spawn(command, ['--help'], { stdio: 'ignore' });
      let timedOut = false;

      const timer = setTimeout(() => {
        timedOut = true;
        child.kill('SIGKILL');
        this.logger.warn(
          `TTS command check timed out after ${this.timeoutMs}ms (command=${command})`,
        );
        resolve();
      }, this.timeoutMs);

      child.once('error', (error) => {
        if (timedOut) return;
        clearTimeout(timer);
        this.logger.warn(
          `Unable to execute TTS command "${command}": ${error.message}`,
        );
        resolve();
      });

      child.once('close', (code) => {
        if (timedOut) return;
        clearTimeout(timer);
        if (code === 0) {
          const duration = Date.now() - start;
          this.logger.log(
            `TTS command "${command}" is reachable (${duration}ms)`,
          );
        } else {
          this.logger.warn(
            `TTS command "${command}" exited with code ${code}. Ensure Piper is installed and accessible.`,
          );
        }
        resolve();
      });
    });
  }

  private async checkAsrGateway(): Promise<void> {
    const wsUrl = this.configService.get<string>('AI_SPEAKING_ASR_WS_URL');
    if (!wsUrl) {
      this.logger.warn('AI_SPEAKING_ASR_WS_URL is not configured');
      return;
    }

    await new Promise<void>((resolve) => {
      const socket = new WebSocket(wsUrl, { handshakeTimeout: this.timeoutMs });
      let settled = false;

      const timer = setTimeout(() => {
        if (settled) return;
        settled = true;
        socket.terminate();
        this.logger.warn(
          `Timeout when connecting to ASR websocket (${wsUrl}). Ensure Vosk streaming server is running.`,
        );
        resolve();
      }, this.timeoutMs);

      socket.once('open', () => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        this.logger.log(`ASR websocket reachable at ${wsUrl}`);
        socket.close();
        resolve();
      });

      socket.once('error', (error) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        this.logger.warn(
          `Unable to connect to ASR websocket (${wsUrl}): ${error.message}`,
        );
        resolve();
      });
    });
  }
}

