
// Script to test video merging logic specifically
// Usage: ts-node scripts/test-video-merge-integration.ts

import * as fs from 'fs';
import * as path from 'path';
import axios from 'axios';
import { VideoMeetingService } from '../apps/client-api/src/domains/video-meeting/video-meeting.service';
import { Logger } from '@nestjs/common';

// Mocks
const mockConfigService = {
    get: (key: string) => {
        if (key === 'videoMeeting.recordingBucket') return 'test-bucket';
        return null;
    }
};

const mockUploadService = {
    uploadBuffer: async (buffer: Buffer, filename: string, mimetype: string) => {
        console.log(`[MockUpload] Uploading ${filename} (${buffer.length} bytes)`);
        // Save to local for verification
        const outPath = path.join(__dirname, '..', 'temp-uploads', 'MOCKED_UPLOAD_' + filename);
        fs.writeFileSync(outPath, buffer);
        return { url: 'http://localhost/mock/' + filename };
    }
};

const mockPrisma = {
    classroomSession: {
        findUnique: async () => {
            // Return a session that ALREADY has a recording URL
            // We will point this URL to a real public video
            return {
                id: 'session-123',
                recordingUrl: 'https://files.testfile.org/PDF/10MB-TEST.pdf', // Wait, need a video.
                // Let's use a sample video from github or similar.
                // Big Buck Bunny sample is common.
                // https://test-videos.co.uk/vids/bigbuckbunny/mp4/h264/360/Big_Buck_Bunny_360_10s_1MB.mp4
                metadata: {}
            };
        },
        update: async (args: any) => {
            console.log('[MockPrisma] Session updated:', args.data);
            return args.data;
        }
    }
};

async function runTest() {
    const service = new VideoMeetingService(
        mockConfigService as any,
        mockPrisma as any,
        mockUploadService as any
    );

    // 1. Setup specific mock for findUnique to return a known video URL
    // Using a reliable sample video URL
    const sampleVideoUrl = 'https://www.w3schools.com/html/mov_bbb.mp4';

    mockPrisma.classroomSession.findUnique = async () => {
        return {
            id: 'session-test-merge',
            recordingUrl: sampleVideoUrl,
            metadata: {}
        };
    };

    // 2. Download another sample video to use as the "new" file arriving via webhook
    // We'll use the same video for simplicity, or a different one.
    const video2Url = 'https://www.w3schools.com/html/movie.mp4';

    console.log('Downloading sample video 2 for test...');
    const response = await axios.get(video2Url, { responseType: 'arraybuffer' });
    const fileBuffer = response.data;

    const mockFile: Express.Multer.File = {
        fieldname: 'file',
        originalname: 'new-recording-part.mp4',
        encoding: '7bit',
        mimetype: 'video/mp4',
        buffer: fileBuffer,
        size: fileBuffer.length,
        stream: null as any,
        destination: '',
        filename: '',
        path: ''
    };

    console.log('Starting merge test...');

    try {
        // This should:
        // 1. Lock session
        // 2. See existing recordingUrl (mov_bbb.mp4)
        // 3. Download mov_bbb.mp4
        // 4. Merge with new-recording-part.mp4 (movie.mp4)
        // 5. Upload result
        await service.handleRecordingComplete(mockFile, 'class-123-session-session-test-merge');
        console.log('Test completed successfully!');
    } catch (error) {
        console.error('Test failed:', error);
    }
}

runTest();
