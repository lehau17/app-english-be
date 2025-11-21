import { JwtPayload, PayloadToken, ResponseMessage } from '@app/shared';
import { PageResponseDto } from '@app/shared/payload/response/page-response.dto';
import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import {
  CreatePodcastDto,
  ExtractYouTubeTranscriptDto,
  GetPodcastsQueryDto,
  GetUserAttemptsQueryDto,
  UpdatePodcastDto,
  VideoUploadResponseDto,
  YouTubeTranscriptResponseDto,
} from '../dto/podcast.dto';
import {
  CreateRatingDto,
  GetRatingsQueryDto,
} from '../dto/user-interaction.dto';
import { AudioExtractionService } from '../service/audio-extraction.service';
import { PodcastService } from '../service/podcast.service';
import { TextToPodcastService } from '../service/text-to-podcast.service';
import { AiPodcastRecommenderService } from '../service/ai-podcast-recommender.service';
import { VideoProcessingService } from '../service/video-processing.service';
import { YouTubeTranscriptService } from '../service/youtube-transcript.service';

@ApiTags('Podcasts')
@ApiBearerAuth('Authorization')
@Controller('/private/v1/podcasts')
export class PodcastController {
  constructor(
    private readonly podcastService: PodcastService,
    private readonly textToPodcastService: TextToPodcastService,
    private readonly aiRecommenderService: AiPodcastRecommenderService,
    private readonly youtubeTranscriptService: YouTubeTranscriptService,
    private readonly audioExtractionService: AudioExtractionService,
    private readonly videoProcessingService: VideoProcessingService,
  ) { }

  @Get()
  @ApiOperation({ summary: 'Get all podcasts with filtering and pagination' })
  @ResponseMessage('Podcasts retrieved successfully')
  async findAll(
    @PayloadToken() payload: JwtPayload,
    @Query() query: GetPodcastsQueryDto,
  ) {
    const userId = payload.sub;
    return this.podcastService.findAll(userId, query);
  }

  @Get('ai-recommendations')
  @ApiOperation({
    summary: 'Get AI-powered personalized podcast recommendations',
    description:
      'Analyzes user learning profile and returns personalized podcast recommendations using Gemini AI',
  })
  @ResponseMessage('AI recommendations generated successfully')
  async getAIRecommendations(
    @PayloadToken() payload: JwtPayload,
    @Query('limit') limit?: number,
  ) {
    return this.aiRecommenderService.getPersonalizedRecommendations(
      payload.sub,
      limit || 10,
    );
  }


  @Get(':id')
  @ApiOperation({ summary: 'Get podcast by ID' })
  @ApiParam({ name: 'id', description: 'Podcast ID' })
  @ResponseMessage('Podcast retrieved successfully')
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.podcastService.getPodcastById(id);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new podcast' })
  @ResponseMessage('Podcast created successfully')
  async create(
    @Body() createPodcastDto: CreatePodcastDto,
    @PayloadToken() payload: JwtPayload,
  ) {
    return this.podcastService.createPodcast(createPodcastDto, payload.sub);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update podcast' })
  @ApiParam({ name: 'id', description: 'Podcast ID' })
  @ResponseMessage('Podcast updated successfully')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updatePodcastDto: UpdatePodcastDto,
    @PayloadToken() payload: JwtPayload,
  ) {
    return this.podcastService.update(id, updatePodcastDto, payload.sub);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete podcast' })
  @ApiParam({ name: 'id', description: 'Podcast ID' })
  @ResponseMessage('Podcast deleted successfully')
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @PayloadToken() payload: JwtPayload,
  ) {
    return this.podcastService.remove(id, payload.sub);
  }

  @Post(':id/rating')
  @ApiOperation({ summary: 'Create or update rating for podcast' })
  @ApiParam({ name: 'id', description: 'Podcast ID' })
  @ResponseMessage('Rating submitted successfully')
  async createRating(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() createRatingDto: CreateRatingDto,
    @PayloadToken() payload: JwtPayload,
  ) {
    return this.podcastService.createRating(id, payload.sub, createRatingDto);
  }

  @Get(':id/ratings')
  @ApiOperation({ summary: 'Get ratings for podcast' })
  @ApiParam({ name: 'id', description: 'Podcast ID' })
  @ResponseMessage('Ratings retrieved successfully')
  async getRatings(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: GetRatingsQueryDto,
  ): Promise<PageResponseDto<any>> {
    return this.podcastService.getRatings(id, query);
  }

  @Post(':id/start')
  async startPodcast(
    @Param('id') id: string,
    @PayloadToken() payload: JwtPayload,
  ) {
    return this.podcastService.startPodcastAttempt(id, payload.sub);
  }

  @Post(':id/submit')
  async submitAttempt(
    @Param('id') podcastId: string,
    @Body() body: { attemptId: string; answers: Record<string, string> },
  ) {
    return this.podcastService.submitPodcastAttempt(
      podcastId,
      body.attemptId,
      body.answers,
    );
  }

  @Post(':id/save-draft')
  async saveDraft(
    @Param('id') podcastId: string,
    @Body()
    body: {
      attemptId: string;
      answers: Record<string, string>;
      timeSpent?: number;
    },
  ) {
    return this.podcastService.saveDraft(
      podcastId,
      body.attemptId,
      body.answers,
      body.timeSpent,
    );
  }

  @Get(':id/attempts')
  @ApiOperation({ summary: 'Get attempts for a podcast' })
  @ApiParam({ name: 'id', description: 'Podcast ID' })
  @ResponseMessage('Attempts retrieved successfully')
  async getAttempts(
    @Param('id') podcastId: string,
    @PayloadToken() payload: JwtPayload,
  ) {
    const userId = payload.sub;
    return this.podcastService.getPodcastAttempts(podcastId, userId);
  }

  @Post('youtube/extract-transcript')
  @ApiOperation({
    summary: 'Extract transcript from YouTube video',
    description:
      'Extracts transcript/captions from YouTube video URL. Returns full transcript text and segments with timestamps.',
  })
  @ResponseMessage('Transcript extracted successfully')
  async extractYouTubeTranscript(
    @Body() dto: ExtractYouTubeTranscriptDto,
  ): Promise<YouTubeTranscriptResponseDto> {
    return this.youtubeTranscriptService.extractTranscript(dto.videoUrl);
  }

  @Post('upload-video')
  @UseInterceptors(FileInterceptor('video'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Upload video and auto-process',
    description:
      'Upload a video file, automatically extract audio, upload to S3, and return URLs. Frontend can use these URLs to create a podcast.',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        video: {
          type: 'string',
          format: 'binary',
          description: 'Video file (MP4, AVI, MOV, WebM, MKV)',
        },
      },
    },
  })
  @ResponseMessage('Video uploaded and processed successfully')
  async uploadVideo(
    @UploadedFile() file: Express.Multer.File,
  ): Promise<VideoUploadResponseDto> {
    // Validate file
    if (!file) {
      throw new BadRequestException('No video file provided');
    }

    const validation = this.videoProcessingService.validateVideoFile(file);
    if (!validation.valid) {
      throw new BadRequestException(validation.error);
    }

    // Process video
    const result = await this.videoProcessingService.processVideo(file);

    if (result.status === 'failed') {
      throw new BadRequestException(result.message);
    }

    return result;
  }

  @Post('test/extract-audio')
  @ApiOperation({
    summary: '[TEST] Extract audio from video file',
    description:
      'Test endpoint to extract audio from a video file using FFmpeg. Provide absolute path to video file.',
  })
  @ResponseMessage('Audio extracted successfully')
  async testExtractAudio(
    @Body() body: { videoPath: string; format?: 'mp3' | 'wav' },
  ) {
    const { videoPath, format = 'mp3' } = body;

    // Check FFmpeg availability first
    const isAvailable =
      await this.audioExtractionService.checkFFmpegAvailable();
    if (!isAvailable) {
      throw new Error(
        'FFmpeg is not installed or not available. Please install FFmpeg: brew install ffmpeg',
      );
    }

    // Extract audio
    const result =
      format === 'wav'
        ? await this.audioExtractionService.extractToWav(videoPath)
        : await this.audioExtractionService.extractToMp3(videoPath);

    return {
      success: true,
      audioPath: result.audioPath,
      format: result.format,
      duration: result.duration,
      sizeBytes: result.size,
      sizeMB: (result.size / 1024 / 1024).toFixed(2),
    };
  }

  @Get('test/check-ffmpeg')
  @ApiOperation({
    summary: '[TEST] Check if FFmpeg is available',
    description: 'Check if FFmpeg is installed and available on the system.',
  })
  @ResponseMessage('FFmpeg check completed')
  async checkFFmpeg() {
    const isAvailable =
      await this.audioExtractionService.checkFFmpegAvailable();
    return {
      available: isAvailable,
      message: isAvailable
        ? 'FFmpeg is installed and ready'
        : 'FFmpeg is not available. Install with: brew install ffmpeg',
    };
  }

  @Get('test/check-whisper')
  @ApiOperation({
    summary: '[TEST] Check if Faster-Whisper is available',
    description: 'Check if Faster-Whisper (Python) is installed and available.',
  })
  @ResponseMessage('Whisper check completed')
  async checkWhisper() {
    const isAvailable =
      await this.videoProcessingService.checkWhisperAvailability();
    return {
      available: isAvailable,
      message: isAvailable
        ? 'Faster-Whisper is installed and ready'
        : 'Faster-Whisper not available. Install with: pip install faster-whisper',
      modelSize: process.env.WHISPER_MODEL_SIZE || 'base',
    };
  }
}
