import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { exec } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { promisify } from 'util';

const execAsync = promisify(exec);
const access = promisify(fs.access);

export interface TranscriptionResult {
    transcript: string;
    duration: number; // seconds
    success: boolean;
    error?: string;
}

@Injectable()
export class WhisperService {
    private readonly logger = new Logger(WhisperService.name);
    private readonly pythonPath: string;
    private readonly scriptPath: string;
    private readonly modelSize: string;
    private isAvailable: boolean | null = null;

    constructor(private readonly configService: ConfigService) {
        // Get Python path from env or use default
        this.pythonPath = this.configService.get<string>('PYTHON_PATH') || 'python3';

        // Script path relative to project root
        this.scriptPath = path.join(process.cwd(), 'scripts', 'transcribe.py');

        // Model size: tiny, base, small, medium, large-v2
        this.modelSize = this.configService.get<string>('WHISPER_MODEL_SIZE') || 'base';

        this.logger.log(`Whisper initialized: ${this.pythonPath}, model: ${this.modelSize}`);
    }

    /**
     * Check if Faster-Whisper is available
     */
    async checkAvailability(): Promise<boolean> {
        if (this.isAvailable !== null) {
            return this.isAvailable;
        }

        try {
            // Check if Python script exists
            await access(this.scriptPath, fs.constants.R_OK);

            // Check if faster-whisper is installed
            const { stdout, stderr } = await execAsync(
                `${this.pythonPath} -c "import faster_whisper; print('OK')"`,
                { timeout: 5000 }
            );

            if (stdout.includes('OK')) {
                this.logger.log('Faster-Whisper is available');
                this.isAvailable = true;
                return true;
            } else {
                this.logger.warn('Faster-Whisper check failed:', stderr);
                this.isAvailable = false;
                return false;
            }
        } catch (error) {
            this.logger.warn('Faster-Whisper not available:', error.message);
            this.logger.warn('Install with: pip install faster-whisper');
            this.isAvailable = false;
            return false;
        }
    }

    /**
     * Transcribe audio file to text
     */
    async transcribe(audioPath: string): Promise<TranscriptionResult> {
        const startTime = Date.now();

        try {
            // Validate file exists
            await access(audioPath, fs.constants.R_OK);

            // Check availability
            const available = await this.checkAvailability();
            if (!available) {
                return {
                    transcript: '',
                    duration: 0,
                    success: false,
                    error: 'Faster-Whisper not installed. Run: pip install faster-whisper',
                };
            }

            this.logger.log(`Transcribing: ${audioPath}`);

            // Run Python script
            // Timeout: 10 minutes (600s) for very long audio
            const command = `${this.pythonPath} "${this.scriptPath}" "${audioPath}" ${this.modelSize}`;

            const { stdout, stderr } = await execAsync(command, {
                timeout: 600000, // 10 minutes
                maxBuffer: 10 * 1024 * 1024, // 10MB buffer for long transcripts
            });

            // Check for errors in stderr
            if (stderr && stderr.includes('ERROR:')) {
                throw new Error(stderr);
            }

            const transcript = stdout.trim();

            if (!transcript) {
                this.logger.warn('Transcription returned empty result');
                return {
                    transcript: '',
                    duration: 0,
                    success: false,
                    error: 'Transcription returned empty result',
                };
            }

            const duration = (Date.now() - startTime) / 1000;

            this.logger.log(
                `Transcription completed in ${duration.toFixed(2)}s: ${transcript.substring(0, 100)}...`
            );

            return {
                transcript,
                duration,
                success: true,
            };
        } catch (error) {
            const duration = (Date.now() - startTime) / 1000;

            this.logger.error('Transcription failed:', error);

            // Check for specific errors
            let errorMessage = error.message || 'Unknown error';

            if (error.code === 'ETIMEDOUT') {
                errorMessage = 'Transcription timeout (max 10 minutes)';
            } else if (error.message?.includes('File not found')) {
                errorMessage = 'Audio file not found';
            } else if (error.message?.includes('No module named')) {
                errorMessage = 'faster-whisper not installed. Run: pip install faster-whisper';
            }

            return {
                transcript: '',
                duration,
                success: false,
                error: errorMessage,
            };
        }
    }

    /**
     * Get recommended model size based on file duration
     */
    getRecommendedModel(durationSeconds: number): string {
        if (durationSeconds < 60) {
            return 'tiny'; // < 1 min
        } else if (durationSeconds < 300) {
            return 'base'; // 1-5 min
        } else if (durationSeconds < 1800) {
            return 'small'; // 5-30 min
        } else {
            return 'base'; // > 30 min (base is faster, small too slow for long audio)
        }
    }
}

