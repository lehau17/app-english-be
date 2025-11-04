import { Injectable, BadRequestException } from '@nestjs/common';
import { YoutubeTranscript } from 'youtube-transcript';

interface TranscriptSegment {
  text: string;
  offset: number; // seconds
  duration: number; // seconds
}

interface TranscriptResult {
  transcript: string;
  segments: TranscriptSegment[];
}

@Injectable()
export class YouTubeTranscriptService {
  /**
   * Extract transcript from YouTube video
   * @param videoUrl YouTube URL or video ID
   * @returns Transcript text with timestamps
   */
  async extractTranscript(videoUrl: string): Promise<TranscriptResult> {
    try {
      // Extract video ID from URL
      const videoId = this.extractVideoId(videoUrl);

      if (!videoId) {
        throw new BadRequestException('Invalid YouTube URL or video ID');
      }

      // Fetch transcript from YouTube
      const transcriptData = await YoutubeTranscript.fetchTranscript(videoId);

      // Combine all segments into full transcript
      const fullTranscript = transcriptData
        .map((item) => item.text)
        .join(' ')
        .trim();

      // Convert segments to our format
      const segments: TranscriptSegment[] = transcriptData.map((item) => ({
        text: item.text,
        offset: item.offset / 1000, // Convert milliseconds to seconds
        duration: item.duration / 1000,
      }));

      return {
        transcript: fullTranscript,
        segments,
      };
    } catch (error) {
      if (error.message?.includes('Could not find captions')) {
        throw new BadRequestException(
          'Video không có phụ đề/transcript. Vui lòng chọn video có subtitle hoặc nhập transcript thủ công.',
        );
      }
      if (error.message?.includes('Invalid video ID')) {
        throw new BadRequestException('URL YouTube không hợp lệ');
      }
      throw new BadRequestException(
        `Không thể trích xuất transcript: ${error.message}`,
      );
    }
  }

  /**
   * Extract YouTube video ID from various URL formats
   * Supports:
   * - https://www.youtube.com/watch?v=VIDEO_ID
   * - https://youtu.be/VIDEO_ID
   * - https://www.youtube.com/embed/VIDEO_ID
   * - VIDEO_ID (direct)
   */
  private extractVideoId(url: string): string | null {
    if (!url) return null;

    // Direct video ID (11 characters)
    if (url.length === 11 && /^[a-zA-Z0-9_-]+$/.test(url)) {
      return url;
    }

    // YouTube URL patterns
    const patterns = [
      /(?:youtube\.com\/watch\?v=)([^&\s]+)/,
      /(?:youtu\.be\/)([^?&\s]+)/,
      /(?:youtube\.com\/embed\/)([^?&\s]+)/,
      /(?:youtube\.com\/v\/)([^?&\s]+)/,
    ];

    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match && match[1]) {
        return match[1];
      }
    }

    return null;
  }

  /**
   * Check if URL is a YouTube URL
   */
  isYouTubeUrl(url: string): boolean {
    return (
      url.includes('youtube.com') ||
      url.includes('youtu.be') ||
      this.extractVideoId(url) !== null
    );
  }
}


