export interface MediaProcessingMessage {
  operation: 'PROCESS';
  mediaId: string;
  mimeType: string;
  url: string; // S3 URL
  processingOptions?: {
    generateThumbnail?: boolean; // For video
    extractDuration?: boolean; // For video/audio
  };
  timestamp: number;
}



