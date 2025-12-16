import { registerAs } from '@nestjs/config';

export default registerAs('videoMeeting', () => ({
  // Production Jitsi server (self-hosted)
  jitsiUrl: process.env.JITSI_URL || 'https://meet.haudev.io.vn',
  jitsiDomain: process.env.JITSI_DOMAIN || 'meet.haudev.io.vn',
  // Recording settings (requires Jibri)
  enableRecording: process.env.JITSI_ENABLE_RECORDING === 'true',
  autoRecordStartEnabled: process.env.JITSI_AUTO_RECORD === 'true',
  recordingBucket: process.env.JITSI_RECORDING_BUCKET || 'class-recordings',
}));
