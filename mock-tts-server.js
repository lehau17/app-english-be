/**
 * Mock TTS (Text-to-Speech) HTTP API Server
 * For development and testing of AI Speaking module
 * 
 * Usage: node mock-tts-server.js
 * Default port: 5400 (matches AI_SPEAKING_TTS_HTTP_URL default)
 */

const express = require('express');
const app = express();

const PORT = process.env.MOCK_TTS_PORT || 5400;

app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok',
    service: 'Mock TTS Server',
    timestamp: new Date().toISOString()
  });
});

// Stream endpoint - mimics Piper HTTP API
app.post('/stream', (req, res) => {
  const { text, voice } = req.body;
  
  if (!text) {
    return res.status(400).json({ 
      success: false, 
      error: 'Text is required' 
    });
  }

  console.log(`Synthesizing text: "${text}" with voice: ${voice || 'default'}`);

  // Generate mock audio chunks (base64 encoded)
  // In reality, these would be WAV audio data
  const mockAudioChunks = generateMockAudioChunks(text.length);
  
  res.json({
    success: true,
    text: text,
    voice: voice || 'en_US-lessac-medium',
    chunks: mockAudioChunks,
    format: 'wav',
    sample_rate: 22050
  });
});

// Generate mock audio chunks based on text length
function generateMockAudioChunks(textLength) {
  // Number of chunks based on text length (roughly 1 chunk per 10 characters)
  const numChunks = Math.max(1, Math.ceil(textLength / 10));
  const chunks = [];

  for (let i = 0; i < numChunks; i++) {
    // Generate a small random base64 string to simulate audio data
    // In a real scenario, this would be actual WAV audio data
    const mockData = Buffer.from(`MOCK_AUDIO_CHUNK_${i}_${Date.now()}`).toString('base64');
    chunks.push(mockData);
  }

  return chunks;
}

// List available voices endpoint
app.get('/voices', (req, res) => {
  res.json({
    voices: [
      'en_US-lessac-medium',
      'en_US-amy-medium',
      'en_GB-alan-medium',
      'en_US-joe-medium'
    ]
  });
});

app.listen(PORT, () => {
  console.log(`Mock TTS HTTP Server listening on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  console.log(`Stream endpoint: POST http://localhost:${PORT}/stream`);
  console.log(`Voices endpoint: GET http://localhost:${PORT}/voices`);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\nShutting down mock TTS server...');
  process.exit(0);
});
