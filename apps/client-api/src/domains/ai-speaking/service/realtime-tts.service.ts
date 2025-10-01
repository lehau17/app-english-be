import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosResponse } from 'axios';
import { spawn } from 'child_process';
import { UploadService } from '../../upload/upload.service';
import { AiSpeakingGateway } from '../gateway/ai-speaking.gateway';

interface SynthesizeAndStreamParams {
  sessionId: string;
  turnId: string;
  text: string;
  voiceHint?: string;
}

interface SynthesizeAndStreamResult {
  audioUrl?: string | null;
}

@Injectable()
export class RealtimeTtsService {
  private readonly logger = new Logger(RealtimeTtsService.name);
  private readonly command: string;
  private readonly modelPath: string | undefined;
  private readonly defaultVoice: string | undefined;
  private readonly useHttpApi: boolean;
  private readonly httpApiUrl: string | undefined;

  constructor(
    private readonly configService: ConfigService,
    private readonly uploadService: UploadService,
    private readonly gateway: AiSpeakingGateway,
  ) {
    this.command = this.configService.get<string>(
      'AI_SPEAKING_TTS_COMMAND',
      'piper',
    );
    this.modelPath = this.configService.get<string>('AI_SPEAKING_TTS_MODEL_PATH');
    this.defaultVoice = this.configService.get<string>('AI_SPEAKING_TTS_VOICE');
    this.useHttpApi = this.configService.get<string>('AI_SPEAKING_TTS_USE_HTTP', 'true') === 'true';
    this.httpApiUrl = this.configService.get<string>('AI_SPEAKING_TTS_HTTP_URL', 'http://localhost:5400');
  }

  async synthesizeAndStream(
    params: SynthesizeAndStreamParams,
  ): Promise<SynthesizeAndStreamResult> {
    if (this.useHttpApi) {
      return this.synthesizeViaHttpApi(params);
    } else {
      return this.synthesizeViaCommand(params);
    }
  }

  private async synthesizeViaHttpApi(
    params: SynthesizeAndStreamParams,
  ): Promise<SynthesizeAndStreamResult> {
    if (!this.httpApiUrl) {
      throw new Error('AI_SPEAKING_TTS_HTTP_URL is not configured');
    }

    const voice = params.voiceHint ?? this.defaultVoice ?? 'en_US-lessac-medium';

    this.logger.debug(
      `Starting TTS HTTP synthesis url=${this.httpApiUrl} voice=${voice} text=${params.text.substring(0, 100)}...`,
    );

    try {
      // Call HTTP API for streaming synthesis
      const response: AxiosResponse = await axios.post(
        `${this.httpApiUrl}/stream`,
        {
          text: params.text,
          voice: voice,
        },
        {
          headers: {
            'Content-Type': 'application/json',
          },
          timeout: 30000,
        }
      );

      if (response.data?.success && response.data?.chunks) {
        let sequence = 0;

        // Emit chunks to client
        for (const chunk of response.data.chunks) {
          this.gateway.emitToSession(params.sessionId, 'ai-speaking:tts-chunk', {
            turnId: params.turnId,
            sequence: sequence++,
            audio: chunk,
          });
        }

        // Convert base64 chunks to buffer and upload
        const buffers = response.data.chunks.map((chunk: string) =>
          Buffer.from(chunk, 'base64')
        );

        if (buffers.length > 0) {
          const audioBuffer = Buffer.concat(buffers);
          const upload = await this.uploadService.uploadBuffer(
            audioBuffer,
            `ai-speaking-${params.sessionId}-${params.turnId}.wav`,
            'audio/wav',
          );
          return { audioUrl: upload.url };
        }
      }

      return { audioUrl: null };

    } catch (error) {
      this.logger.error(`TTS HTTP API failed: ${error.message}`, error);

      // Fallback to command line if HTTP fails
      if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
        this.logger.warn('TTS HTTP API unavailable, falling back to command line');
        return this.synthesizeViaCommand(params);
      }

      throw error;
    }
  }

  private async synthesizeViaCommand(
    params: SynthesizeAndStreamParams,
  ): Promise<SynthesizeAndStreamResult> {
    if (!this.modelPath) {
      throw new Error('AI_SPEAKING_TTS_MODEL_PATH is not configured');
    }

    const voice = params.voiceHint ?? this.defaultVoice;
    const args: string[] = ['--model', this.modelPath, '--output_file', '-'];

    if (voice) {
      args.push('--speaker', voice);
    }

    args.push('--text', params.text);

    this.logger.debug(
      `Starting TTS process command=${this.command} args=${JSON.stringify(args)}`,
    );

    const child = spawn(this.command, args, {
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    const buffers: Buffer[] = [];
    let sequence = 0;

    child.stdout.on('data', (chunk: Buffer) => {
      buffers.push(chunk);
      this.gateway.emitToSession(params.sessionId, 'ai-speaking:tts-chunk', {
        turnId: params.turnId,
        sequence,
        audio: chunk.toString('base64'),
      });
      sequence++;
    });

    child.stderr.on('data', (chunk: Buffer) => {
      this.logger.verbose(chunk.toString('utf8'));
    });

    const audioUrl = await new Promise<string | null>((resolve, reject) => {
      child.once('error', (error) => {
        reject(error);
      });

      child.once('close', async (code) => {
        if (code !== 0) {
          reject(new Error(`TTS process exited with code ${code}`));
          return;
        }

        if (!buffers.length) {
          resolve(null);
          return;
        }

        try {
          const audioBuffer = Buffer.concat(buffers);
          const upload = await this.uploadService.uploadBuffer(
            audioBuffer,
            `ai-speaking-${params.sessionId}-${params.turnId}.wav`,
            'audio/wav',
          );
          resolve(upload.url);
        } catch (error) {
          reject(error as Error);
        }
      });
    });

    return { audioUrl };
  }
}
