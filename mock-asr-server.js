/**
 * Mock ASR (Automatic Speech Recognition) WebSocket Server
 * For development and testing of AI Speaking module
 * 
 * Usage: node mock-asr-server.js
 * Default port: 2700 (same as Vosk server)
 */

const WebSocket = require('ws');

const PORT = process.env.MOCK_ASR_PORT || 2700;

const wss = new WebSocket.Server({ port: PORT });

console.log(`Mock ASR WebSocket Server listening on port ${PORT}`);

wss.on('connection', (ws) => {
  console.log('Client connected');
  
  let audioBuffers = [];
  let isConfigured = false;

  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data.toString());
      
      // Handle configuration
      if (message.config) {
        console.log('Received config:', message.config);
        isConfigured = true;
        ws.send(JSON.stringify({ 
          status: 'ready',
          sample_rate: message.config.sample_rate || 16000
        }));
        return;
      }

      // Handle audio data
      if (message.audio) {
        audioBuffers.push(message.audio);
        
        // Send partial result every few chunks
        if (audioBuffers.length % 3 === 0) {
          const partialText = generateMockText(audioBuffers.length / 3);
          ws.send(JSON.stringify({
            partial: partialText,
            confidence: 0.7 + Math.random() * 0.2
          }));
        }
        return;
      }

      // Handle EOF (end of audio)
      if (message.eof) {
        console.log('Received EOF, sending final result');
        const finalText = generateMockText(Math.ceil(audioBuffers.length / 3), true);
        ws.send(JSON.stringify({
          text: finalText,
          confidence: 0.85,
          result: finalText.split(' ').map((word, idx) => ({
            word: word,
            start: idx * 0.5,
            end: (idx + 1) * 0.5,
            conf: 0.8 + Math.random() * 0.2
          }))
        }));
        
        // Reset state
        audioBuffers = [];
        return;
      }

    } catch (error) {
      console.error('Error processing message:', error);
      ws.send(JSON.stringify({ 
        error: 'Invalid message format',
        details: error.message 
      }));
    }
  });

  ws.on('close', () => {
    console.log('Client disconnected');
  });

  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
  });
});

/**
 * Generate mock transcription text
 */
function generateMockText(chunkCount, isFinal = false) {
  const phrases = [
    'Hello',
    'Hello how are you',
    'Hello how are you today',
    'Hello how are you doing today',
    'Hello how are you doing today I am fine',
    'Hello how are you doing today I am fine thank you'
  ];
  
  if (isFinal) {
    return phrases[Math.min(phrases.length - 1, chunkCount)] || 'Hello world';
  }
  
  return phrases[Math.min(phrases.length - 2, chunkCount)] || 'Hello';
}

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\nShutting down mock ASR server...');
  wss.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});
