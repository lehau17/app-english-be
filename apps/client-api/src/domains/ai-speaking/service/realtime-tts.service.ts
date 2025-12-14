import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TextToSpeechClient } from '@google-cloud/text-to-speech';
import axios, { AxiosResponse } from 'axios';
import { spawn } from 'child_process';
import { UploadService } from '../../upload/upload.service';
import { AiSpeakingGateway } from '../gateway/ai-speaking.gateway';
import { TtsVoice, parseVoice, getLanguageCodeFromVoice } from '../dto/tts-voice.dto';

interface SynthesizeAndStreamParams {
  sessionId: string;
  turnId: string;
  text: string;
  voiceHint?: string;
  voice?: TtsVoice;
}

interface SynthesizeAndStreamResult {
  audioUrl?: string | null;
}

@Injectable()
export class RealtimeTtsService {
  private readonly logger = new Logger(RealtimeTtsService.name);
  private readonly piperHttpUrl: string;
  private readonly usePiper: boolean;
  private readonly googleTtsClient: TextToSpeechClient | null;
  // Legacy fields for backward compatibility
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
    this.piperHttpUrl = this.configService.get<string>(
      'AI_SPEAKING_TTS_HTTP_URL',
      'http://localhost:8000',
    );
    this.usePiper = this.configService.get<string>('USE_PIPER_TTS', 'true') === 'true';

    // Initialize Google Cloud TTS as fallback
    this.googleTtsClient = new TextToSpeechClient();

    // Legacy fields
    this.command = this.configService.get<string>(
      'AI_SPEAKING_TTS_COMMAND',
      'piper',
    );
    this.modelPath = this.configService.get<string>(
      'AI_SPEAKING_TTS_MODEL_PATH',
    );
    this.defaultVoice = this.configService.get<string>('AI_SPEAKING_TTS_VOICE');
    this.useHttpApi =
      this.configService.get<string>('AI_SPEAKING_TTS_USE_HTTP', 'true') ===
      'true';
    this.httpApiUrl = this.configService.get<string>(
      'AI_SPEAKING_TTS_HTTP_URL',
      'http://localhost:5400',
    );
  }

  async synthesizeAndStream(
    params: SynthesizeAndStreamParams,
  ): Promise<SynthesizeAndStreamResult> {
    // Priority 1: Piper TTS (primary)
    if (this.usePiper) {
      try {
        return await this.synthesizeViaPiperHttp(params);
      } catch (error) {
        this.logger.warn(
          `Piper TTS failed, falling back to Google Cloud: ${error.message}`,
        );
        return await this.synthesizeViaGoogleCloudTts(params);
      }
    }

    // Priority 2: Google Cloud TTS (fallback)
    return await this.synthesizeViaGoogleCloudTts(params);
  }

  /**
   * Piper HTTP API synthesis with streaming
   */
  private async synthesizeViaPiperHttp(
    params: SynthesizeAndStreamParams,
  ): Promise<SynthesizeAndStreamResult> {
    const voice = params.voice ?? TtsVoice.US_FEMALE_AMY;
    const { model, speakerId } = parseVoice(voice);

    this.logger.debug(
      `Piper TTS synthesis: model=${model} speaker=${speakerId} text=${params.text.substring(0, 100)}...`,
    );

    try {
      const response = await axios.post(
        `${this.piperHttpUrl}/api/tts`,
        {
          text: params.text,
          voice: model,
          speakerId: speakerId,
          lengthScale: 1.0,
          noiseScale: 0.667,
          noiseW: 0.8,
        },
        {
          responseType: 'arraybuffer',
          timeout: 30000,
          headers: {
            'Content-Type': 'application/json',
          },
        },
      );

      if (!response.data) {
        this.logger.warn('Piper HTTP returned empty response');
        throw new Error('Empty audio response from Piper');
      }

      const audioBuffer = Buffer.from(response.data);

      // Stream in chunks to client
      const CHUNK_SIZE = 4096;
      let sequence = 0;

      for (let i = 0; i < audioBuffer.length; i += CHUNK_SIZE) {
        const chunk = audioBuffer.subarray(i, i + CHUNK_SIZE);
        this.gateway.emitToSession(params.sessionId, 'ai-speaking:tts-chunk', {
          turnId: params.turnId,
          sequence: sequence++,
          audio: chunk.toString('base64'),
        });
      }

      // Upload to MinIO/S3
      const upload = await this.uploadService.uploadBuffer(
        audioBuffer,
        `ai-speaking-${params.sessionId}-${params.turnId}.wav`,
        'audio/wav',
      );

      this.logger.debug(`Piper TTS completed: audioUrl=${upload.url}`);
      return { audioUrl: upload.url };
    } catch (error) {
      this.logger.error(`Piper HTTP synthesis failed: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Google Cloud TTS fallback (unchanged from current implementation)
   */
  private async synthesizeViaGoogleCloudTts(
    params: SynthesizeAndStreamParams,
  ): Promise<SynthesizeAndStreamResult> {
    if (!this.googleTtsClient) {
      throw new Error('Google Cloud TTS client not initialized');
    }

    // Use Google Cloud voice mapping for fallback
    const voiceMapping: Record<TtsVoice, string> = {
      [TtsVoice.US_FEMALE_AMY]: 'en-US-Neural2-F',
      [TtsVoice.US_MALE_JOHN]: 'en-US-Neural2-D',
      [TtsVoice.US_FEMALE_LESSAC]: 'en-US-Neural2-F',
      [TtsVoice.US_MALE_RYAN]: 'en-US-Neural2-D',
      [TtsVoice.GB_MALE_ALAN]: 'en-GB-Neural2-B',
      [TtsVoice.GB_FEMALE_CORI]: 'en-GB-Neural2-C',
      [TtsVoice.GB_FEMALE_JENNY]: 'en-GB-Neural2-C',
      [TtsVoice.US_NATIVE_1]: 'en-US-Neural2-F',
      [TtsVoice.US_NATIVE_2]: 'en-US-Neural2-D',
      [TtsVoice.US_NATIVE_3]: 'en-US-Neural2-F',
    };

    const googleVoice = voiceMapping[params.voice] || 'en-US-Neural2-F';
    const languageCode = googleVoice.substring(0, 5); // 'en-US'

    this.logger.debug(`Google Cloud TTS fallback: voice=${googleVoice}`);

    try {
      const [response] = await this.googleTtsClient.synthesizeSpeech({
        input: { text: params.text },
        voice: {
          languageCode: languageCode,
          name: googleVoice,
        },
        audioConfig: {
          audioEncoding: 'MP3',
          speakingRate: 1.0,
          pitch: 0.0,
        },
      });

      const audioBuffer = Buffer.from(response.audioContent as Uint8Array);

      // Stream chunks
      const CHUNK_SIZE = 4096;
      let sequence = 0;

      for (let i = 0; i < audioBuffer.length; i += CHUNK_SIZE) {
        const chunk = audioBuffer.subarray(i, i + CHUNK_SIZE);
        this.gateway.emitToSession(params.sessionId, 'ai-speaking:tts-chunk', {
          turnId: params.turnId,
          sequence: sequence++,
          audio: chunk.toString('base64'),
        });
      }

      const upload = await this.uploadService.uploadBuffer(
        audioBuffer,
        `ai-speaking-${params.sessionId}-${params.turnId}.mp3`,
        'audio/mpeg',
      );

      return { audioUrl: upload.url };
    } catch (error) {
      this.logger.error(`Google Cloud TTS failed: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * OLD IMPLEMENTATION - Piper TTS HTTP API (backup)
   * @deprecated Use Google Cloud TTS (synthesizeViaGoogleCloudTts) instead
   */
  private async OLD_synthesizeViaHttpApi_backup(
    params: SynthesizeAndStreamParams,
  ): Promise<SynthesizeAndStreamResult> {
    if (!this.httpApiUrl) {
      throw new Error('AI_SPEAKING_TTS_HTTP_URL is not configured');
    }

    const voice =
      params.voiceHint ?? this.defaultVoice ?? 'en_US-lessac-medium';

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
        },
      );

      if (response.data?.success && response.data?.chunks) {
        let sequence = 0;

        // Emit chunks to client
        for (const chunk of response.data.chunks) {
          this.gateway.emitToSession(
            params.sessionId,
            'ai-speaking:tts-chunk',
            {
              turnId: params.turnId,
              sequence: sequence++,
              audio: chunk,
            },
          );
        }

        // Convert base64 chunks to buffer and upload
        const buffers = response.data.chunks.map((chunk: string) =>
          Buffer.from(chunk, 'base64'),
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
        this.logger.warn(
          'TTS HTTP API unavailable, falling back to command line',
        );
        return this.OLD_synthesizeViaCommand_backup(params);
      }

      throw error;
    }
  }

  /**
   * OLD IMPLEMENTATION - Piper TTS command line (backup)
   * @deprecated Use Google Cloud TTS (synthesizeViaGoogleCloudTts) instead
   */
  private async OLD_synthesizeViaCommand_backup(
    params: SynthesizeAndStreamParams,
  ): Promise<SynthesizeAndStreamResult> {
    if (!this.modelPath) {
      throw new Error('AI_SPEAKING_TTS_MODEL_PATH is not configured');
    }

    // Validate required config
    if (!this.command || this.command.trim() === '') {
      this.logger.error(
        'TTS command is not configured (AI_SPEAKING_TTS_COMMAND)',
      );
      throw new Error('TTS command not configured');
    }

    if (!this.modelPath || this.modelPath.trim() === '') {
      this.logger.error(
        'TTS model path is not configured (AI_SPEAKING_TTS_MODEL_PATH)',
      );
      throw new Error('TTS model path not configured');
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
