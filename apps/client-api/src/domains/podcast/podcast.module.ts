import { DatabaseModule } from '@app/database';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { UploadService } from '../upload/upload.service';
import { PlaylistController } from './controller/playlist.controller';
import { PodcastAttemptController } from './controller/podcast-attempt.controller';
import { PodcastTestController } from './controller/podcast-test.controller';
import { PodcastController } from './controller/private-podcast.controller';
import { PodcastRepository } from './repository/podcast.repository';
import { AudioExtractionService } from './service/audio-extraction.service';
import { GoogleTranscriptionService } from './service/google-transcription.service';
import { PlaylistService } from './service/playlist.service';
import { PodcastService } from './service/podcast.service';
import { TextToPodcastService } from './service/text-to-podcast.service';
import { VideoProcessingService } from './service/video-processing.service';
import { WhisperService } from './service/whisper.service';
import { YouTubeTranscriptService } from './service/youtube-transcript.service';

@Module({
    imports: [DatabaseModule, ConfigModule],
    controllers: [
        PodcastController,
        PodcastAttemptController, // Learning history controller
        PodcastTestController, // New simplified controller
        PlaylistController,
    ],
    providers: [
        PodcastService,
        PlaylistService,
        TextToPodcastService,
        YouTubeTranscriptService,
        AudioExtractionService,
        VideoProcessingService,
        WhisperService,
        GoogleTranscriptionService,
        UploadService,
        PodcastRepository,
    ],
    exports: [
        PodcastService,
        PlaylistService,
        TextToPodcastService,
        YouTubeTranscriptService,
        AudioExtractionService,
        VideoProcessingService,
        WhisperService,
        GoogleTranscriptionService,
    ],
})
export class PodcastModule { }
