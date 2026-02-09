export enum KafkaTopic {
  NOTIFICATION_SEND_OTP_CREATED = 'notify-send-otp',
  NEO4J_SYNC = 'neo4j-sync',
  TTS_AUDIO_GENERATION = 'tts-audio-generation',
  EMAIL_ENROLLMENT_VERIFICATION = 'email-enrollment-verification',
  EMAIL_WELCOME_NEW_USER = 'email-welcome-new-user',
  EMAIL_ENROLLMENT_CONFIRMATION = 'email-enrollment-confirmation',
  MEDIA_PROCESSING = 'media-processing',
  ACTIVITY_GENERATION = 'activity-generation',
  // Speaking Practice (Word-Based + LLM Personalization)
  AI_SPEAKING_SESSION_COMPLETED = 'ai-speaking.session.completed',
  SPEAKING_PRACTICE_ATTEMPT_COMPLETED = 'speaking-practice.attempt.completed',
  PAYMENT_VNPAY_RETURN = 'payment.vnpay.return',
  PAYMENT_VNPAY_RETURN_DLQ = 'payment.vnpay.return.dlq',
}
