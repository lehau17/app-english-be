import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import { promisify } from 'util';
import { UploadService } from '../../upload/upload.service';
import { AudioExtractionService } from './audio-extraction.service';
import { GoogleTranscriptionService } from './google-transcription.service';
import { WhisperService } from './whisper.service';

const writeFile = promisify(fs.writeFile);
const unlink = promisify(fs.unlink);
const mkdir = promisify(fs.mkdir);

export interface VideoProcessingResult {
    videoUrl: string;
    audioUrl?: string;
    transcript?: string;
    duration: number;
    sizeBytes: number;
    status: 'completed' | 'partial' | 'failed';
    message?: string;
}

@Injectable()
export class VideoProcessingService {
    private readonly logger = new Logger(VideoProcessingService.name);
    private readonly tempDir = '/tmp/video-processing';

    constructor(
        private readonly audioExtractionService: AudioExtractionService,
        private readonly uploadService: UploadService,
        private readonly configService: ConfigService,
        private readonly whisperService: WhisperService,
        private readonly googleTranscriptionService: GoogleTranscriptionService,
    ) {
        // Ensure temp directory exists
        this.ensureTempDir();
    }

    /**
     * Process uploaded video:
     * 1. Upload video to S3
     * 2. Extract audio
     * 3. Upload audio to S3
     * 4. (Optional) Transcribe with Whisper
     */
    async processVideo(videoFile: Express.Multer.File): Promise<VideoProcessingResult> {
        const startTime = Date.now();
        this.logger.log(`Processing video: ${videoFile.originalname}`);

        try {
            // Step 1: Upload video to S3
            this.logger.log('Step 1/4: Uploading video to S3...');
            const videoUrl = await this.uploadService.uploadFile(videoFile);
            this.logger.log(`Video uploaded: ${videoUrl}`);

            // Step 2: Save video to temp file
            const tempVideoPath = path.join(
                this.tempDir,
                `${Date.now()}-${videoFile.originalname}`,
            );
            await writeFile(tempVideoPath, videoFile.buffer);
            this.logger.log(`Video saved to temp: ${tempVideoPath}`);

            // Step 3: Extract audio
            this.logger.log('Step 2/4: Extracting audio with FFmpeg...');
            const audioResult = await this.audioExtractionService.extractToMp3(tempVideoPath);
            this.logger.log(`Audio extracted: ${audioResult.audioPath}`);

            // Step 4: Upload audio to S3
            this.logger.log('Step 3/5: Uploading audio to S3...');
            const audioBuffer = fs.readFileSync(audioResult.audioPath);
            const audioFilename = path.basename(audioResult.audioPath);
            const audioUploadResult = await this.uploadService.uploadBuffer(
                audioBuffer,
                audioFilename,
                'audio/mpeg',
            );
            this.logger.log(`Audio uploaded: ${audioUploadResult.url}`);

            // Step 5: Transcribe audio to text
            let transcript: string | undefined;
            const transcriptionMode = this.configService.get<string>('TRANSCRIPTION_SERVICE') || 'whisper';
            
            // Try Google STT first (faster), fallback to Whisper
            if (transcriptionMode === 'google' && this.googleTranscriptionService.isAvailable()) {
                try {
                    this.logger.log('Step 4/5: Transcribing with Google Speech-to-Text...');

                    const transcriptionResult = await this.googleTranscriptionService.transcribe(audioResult.audioPath);

                    if (transcriptionResult.success && transcriptionResult.transcript) {
                        transcript = transcriptionResult.transcript;
                        this.logger.log(
                            `Google STT completed in ${transcriptionResult.duration.toFixed(2)}s: ` +
                            `${transcript.substring(0, 100)}...`
                        );
                    } else {
                        this.logger.warn(`Google STT failed: ${transcriptionResult.error}`);
                    }
                } catch (error) {
                    this.logger.warn('Google STT error, skipping transcription:', error.message);
                }
            } else if (transcriptionMode === 'whisper') {
                const whisperEnabled = this.configService.get<string>('ENABLE_WHISPER_TRANSCRIPTION') !== 'false';
                
                if (whisperEnabled) {
                    try {
                        this.logger.log('Step 4/5: Transcribing with Whisper (may take several minutes)...');

                        const transcriptionResult = await this.whisperService.transcribe(audioResult.audioPath);

                        if (transcriptionResult.success && transcriptionResult.transcript) {
                            transcript = transcriptionResult.transcript;
                            this.logger.log(
                                `Whisper completed in ${transcriptionResult.duration.toFixed(2)}s: ` +
                                `${transcript.substring(0, 100)}...`
                            );
                        } else {
                            this.logger.warn(`Whisper failed: ${transcriptionResult.error}`);
                        }
                    } catch (error) {
                        this.logger.warn('Whisper error:', error.message);
                    }
                } else {
                    this.logger.log('Whisper transcription disabled');
                }
            } else {
                this.logger.log('Transcription disabled (set TRANSCRIPTION_SERVICE=google or TRANSCRIPTION_SERVICE=whisper to enable)');
            }

            // Step 6: Cleanup temp files
            await this.cleanup(tempVideoPath, audioResult.audioPath);

            const processingTime = ((Date.now() - startTime) / 1000).toFixed(2);
            this.logger.log(`Video processing completed in ${processingTime}s`);

            return {
                videoUrl,
                audioUrl: audioUploadResult.url,
                transcript,
                duration: audioResult.duration,
                sizeBytes: videoFile.size,
                status: 'completed',
                message: transcript
                    ? `Video processed & transcribed in ${processingTime}s`
                    : `Video processed in ${processingTime}s (no transcript)`,
            };
        } catch (error) {
            this.logger.error('Video processing failed', error);
            return {
                videoUrl: '', // Empty if upload failed
                duration: 0,
                sizeBytes: videoFile.size,
                status: 'failed',
                message: `Processing failed: ${error.message}`,
            };
        }
    }

    /**
     * Process video from URL (for existing videoUrl in DB)
     */
    async processVideoFromUrl(videoUrl: string): Promise<VideoProcessingResult> {
        const startTime = Date.now();
        this.logger.log(`Processing video from URL: ${videoUrl}`);

        try {
            // Step 1: Download video to temp
            this.logger.log('Step 1/3: Downloading video...');
            const tempVideoPath = await this.downloadVideo(videoUrl);
            this.logger.log(`Video downloaded: ${tempVideoPath}`);

            // Step 2: Extract audio
            this.logger.log('Step 2/3: Extracting audio...');
            const audioResult = await this.audioExtractionService.extractToMp3(tempVideoPath);
            this.logger.log(`Audio extracted: ${audioResult.audioPath}`);

            // Step 3: Upload audio to S3
            this.logger.log('Step 3/3: Uploading audio to S3...');
            const audioBuffer = fs.readFileSync(audioResult.audioPath);
            const audioFilename = path.basename(audioResult.audioPath);
            const audioUploadResult = await this.uploadService.uploadBuffer(
                audioBuffer,
                audioFilename,
                'audio/mpeg',
            );
            this.logger.log(`Audio uploaded: ${audioUploadResult.url}`);

            // Cleanup
            await this.cleanup(tempVideoPath, audioResult.audioPath);

            const processingTime = ((Date.now() - startTime) / 1000).toFixed(2);
            this.logger.log(`Video from URL processed in ${processingTime}s`);

            return {
                videoUrl,
                audioUrl: audioUploadResult.url,
                duration: audioResult.duration,
                sizeBytes: audioResult.size,
                status: 'completed',
                message: `Processed in ${processingTime}s`,
            };
        } catch (error) {
            this.logger.error('Video from URL processing failed', error);
            return {
                videoUrl,
                duration: 0,
                sizeBytes: 0,
                status: 'failed',
                message: `Processing failed: ${error.message}`,
            };
        }
    }

    /**
     * Download video from URL to temp directory
     */
    private async downloadVideo(videoUrl: string): Promise<string> {
        const response = await axios.get(videoUrl, {
            responseType: 'arraybuffer',
            timeout: 60000, // 60s timeout
        });

        const filename = `${Date.now()}-${path.basename(videoUrl)}`;
        const tempVideoPath = path.join(this.tempDir, filename);
        await writeFile(tempVideoPath, response.data);

        return tempVideoPath;
    }

    /**
     * Cleanup temp files
     */
    private async cleanup(...filePaths: string[]): Promise<void> {
        for (const filePath of filePaths) {
            try {
                await unlink(filePath);
                this.logger.debug(`Cleaned up: ${filePath}`);
            } catch (error) {
                this.logger.warn(`Failed to cleanup: ${filePath}`, error);
            }
        }
    }

    /**
     * Ensure temp directory exists
     */
    private async ensureTempDir(): Promise<void> {
        try {
            await mkdir(this.tempDir, { recursive: true });
        } catch (error) {
            this.logger.warn('Failed to create temp directory', error);
        }
    }

    /**
     * Validate video file
     */
    validateVideoFile(file: Express.Multer.File): { valid: boolean; error?: string } {
        const allowedMimeTypes = [
            'video/mp4',
            'video/avi',
            'video/mpeg',
            'video/quicktime', // .mov
            'video/x-msvideo', // .avi
            'video/webm',
            'video/x-matroska', // .mkv
        ];

        if (!allowedMimeTypes.includes(file.mimetype)) {
            return {
                valid: false,
                error: `Invalid file type: ${file.mimetype}. Allowed: MP4, AVI, MOV, WebM, MKV`,
            };
        }

        // Max 500MB
        const maxSize = 500 * 1024 * 1024;
        if (file.size > maxSize) {
            return {
                valid: false,
                error: `File too large: ${(file.size / 1024 / 1024).toFixed(2)}MB. Max: 500MB`,
            };
        }

        return { valid: true };
    }

    /**
     * Check if Whisper is available
     */
    async checkWhisperAvailability(): Promise<boolean> {
        return this.whisperService.checkAvailability();
    }
}

