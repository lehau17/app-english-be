import { Injectable, Logger } from '@nestjs/common';
import ffmpeg from 'fluent-ffmpeg';
import * as fs from 'fs';
import { promisify } from 'util';

const access = promisify(fs.access);
const unlink = promisify(fs.unlink);

export interface AudioExtractionResult {
    audioPath: string;
    format: 'mp3' | 'wav';
    duration: number; // seconds
    size: number; // bytes
}

@Injectable()
export class AudioExtractionService {
    private readonly logger = new Logger(AudioExtractionService.name);

    /**
     * Extract audio từ video file thành MP3
     * @param videoPath - Path to video file
     * @param outputPath - Optional output path (default: same as video with .mp3 extension)
     * @returns Path to extracted audio file
     */
    async extractToMp3(
        videoPath: string,
        outputPath?: string,
    ): Promise<AudioExtractionResult> {
        // Validate input file exists
        await this.validateFile(videoPath);

        // Determine output path
        const audioPath =
            outputPath || videoPath.replace(/\.\w+$/, '.mp3');

        this.logger.log(`Extracting audio from ${videoPath} to ${audioPath}`);

        return new Promise((resolve, reject) => {
            ffmpeg(videoPath)
                .output(audioPath)
                .noVideo() // Remove video stream
                .audioCodec('libmp3lame') // MP3 codec
                .audioBitrate('192k') // Good quality
                .audioFrequency(44100) // Standard sample rate
                .audioChannels(2) // Stereo
                .on('start', (commandLine) => {
                    this.logger.debug(`FFmpeg command: ${commandLine}`);
                })
                .on('progress', (progress) => {
                    this.logger.debug(
                        `Processing: ${progress.percent?.toFixed(2)}% done`,
                    );
                })
                .on('end', async () => {
                    this.logger.log(`Audio extraction completed: ${audioPath}`);

                    try {
                        const stats = fs.statSync(audioPath);
                        const metadata = await this.getAudioMetadata(audioPath);

                        resolve({
                            audioPath,
                            format: 'mp3',
                            duration: metadata.duration,
                            size: stats.size,
                        });
                    } catch (error) {
                        reject(error);
                    }
                })
                .on('error', (err) => {
                    this.logger.error(`FFmpeg error: ${err.message}`, err.stack);
                    reject(
                        new Error(`Failed to extract audio: ${err.message}`),
                    );
                })
                .run();
        });
    }

    /**
     * Extract audio thành WAV format (optimal cho Whisper API)
     * @param videoPath - Path to video file
     * @param outputPath - Optional output path
     * @returns Path to extracted WAV file
     */
    async extractToWav(
        videoPath: string,
        outputPath?: string,
    ): Promise<AudioExtractionResult> {
        await this.validateFile(videoPath);

        const audioPath =
            outputPath || videoPath.replace(/\.\w+$/, '.wav');

        this.logger.log(
            `Extracting audio (WAV) from ${videoPath} to ${audioPath}`,
        );

        return new Promise((resolve, reject) => {
            ffmpeg(videoPath)
                .output(audioPath)
                .noVideo()
                .audioCodec('pcm_s16le') // WAV codec
                .audioFrequency(16000) // Whisper requires 16kHz
                .audioChannels(1) // Mono (Whisper requirement)
                .on('start', (commandLine) => {
                    this.logger.debug(`FFmpeg command: ${commandLine}`);
                })
                .on('progress', (progress) => {
                    this.logger.debug(
                        `Processing: ${progress.percent?.toFixed(2)}% done`,
                    );
                })
                .on('end', async () => {
                    this.logger.log(`WAV extraction completed: ${audioPath}`);

                    try {
                        const stats = fs.statSync(audioPath);
                        const metadata = await this.getAudioMetadata(audioPath);

                        resolve({
                            audioPath,
                            format: 'wav',
                            duration: metadata.duration,
                            size: stats.size,
                        });
                    } catch (error) {
                        reject(error);
                    }
                })
                .on('error', (err) => {
                    this.logger.error(`FFmpeg error: ${err.message}`, err.stack);
                    reject(new Error(`Failed to extract WAV: ${err.message}`));
                })
                .run();
        });
    }

    /**
     * Get audio/video metadata
     */
    private async getAudioMetadata(
        filePath: string,
    ): Promise<{ duration: number; format: string }> {
        return new Promise((resolve, reject) => {
            ffmpeg.ffprobe(filePath, (err, metadata) => {
                if (err) {
                    reject(err);
                    return;
                }

                const duration = metadata.format.duration || 0;
                const format = metadata.format.format_name || 'unknown';

                resolve({ duration, format });
            });
        });
    }

    /**
     * Validate video file exists
     */
    private async validateFile(filePath: string): Promise<void> {
        try {
            await access(filePath, fs.constants.R_OK);
        } catch (error) {
            throw new Error(`Video file not found or not readable: ${filePath}`);
        }
    }

    /**
     * Clean up extracted audio file
     */
    async cleanup(audioPath: string): Promise<void> {
        try {
            await unlink(audioPath);
            this.logger.log(`Cleaned up audio file: ${audioPath}`);
        } catch (error) {
            this.logger.warn(`Failed to cleanup audio file: ${audioPath}`, error);
        }
    }

    /**
     * Check if FFmpeg is available
     */
    async checkFFmpegAvailable(): Promise<boolean> {
        return new Promise((resolve) => {
            ffmpeg.getAvailableFormats((err, formats) => {
                if (err) {
                    this.logger.error('FFmpeg not available', err);
                    resolve(false);
                } else {
                    this.logger.log('FFmpeg is available');
                    resolve(true);
                }
            });
        });
    }
}

