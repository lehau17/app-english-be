import { GeminiService } from '@app/shared';
import { DynamicStructuredTool } from '@langchain/core/tools';
import { Injectable, Logger } from '@nestjs/common';
import { z } from 'zod';

// Google Speech-to-Text will be added if available
// For now, we'll use Gemini's audio capabilities or mock the feature

@Injectable()
export class PronunciationCoachTool {
  private readonly logger = new Logger(PronunciationCoachTool.name);

  constructor(private gemini: GeminiService) {}

  getTool() {
    return new DynamicStructuredTool({
      name: 'pronunciation_coach',
      description:
        'Phân tích phát âm tiếng Anh. Cung cấp phiên âm IPA, phân tách âm tiết, ' +
        'vị trí nhấn trọng âm, gợi ý cải thiện. ' +
        'Sử dụng khi học sinh hỏi: "Cách phát âm từ X", "Nhấn âm của từ Y ở đâu", ' +
        '"Phân tích phát âm câu này"',
      schema: z.object({
        text: z.string().describe('Từ hoặc câu cần phân tích phát âm'),
        userAudioUrl: z
          .string()
          .optional()
          .describe(
            'URL của file audio người dùng thu (nếu có, để so sánh với native speaker)',
          ),
        provideFeedback: z
          .boolean()
          .optional()
          .default(false)
          .describe(
            'Có cần phân tích và đưa feedback về phát âm của người dùng không',
          ),
      }),
      func: async ({ text, userAudioUrl, provideFeedback }) => {
        try {
          this.logger.log(`🎤 Analyzing pronunciation for: "${text}"`);

          // 1. Generate phonetic breakdown with Gemini
          const phoneticsPrompt = `
You are a pronunciation coach for English learners.

Text to analyze: "${text}"

Provide:
1. IPA (International Phonetic Alphabet) transcription
2. Syllable breakdown with stress markers
3. Individual word pronunciations (if text has multiple words)
4. Common pronunciation mistakes for Vietnamese speakers
5. Tips for correct pronunciation

Format as JSON:
{
  "text": "${text}",
  "phonetic": "/full IPA transcription/",
  "syllableBreakdown": [
    {
      "word": "pronunciation",
      "syllables": ["pro", "nun", "ci", "a", "tion"],
      "stress": 4,
      "ipa": "/prəˌnʌnsiˈeɪʃən/"
    }
  ],
  "commonMistakes": [
    {
      "mistake": "...",
      "correction": "...",
      "tip": "..."
    }
  ],
  "pronunciationTips": [
    "...",
    "..."
  ],
  "difficulty": "intermediate"
}
`;

          const phoneticsResponse =
            await this.gemini.generateResponse(phoneticsPrompt);

          let phonetics: any;
          try {
            const cleaned = phoneticsResponse
              .replace(/```json\n?/g, '')
              .replace(/```\n?/g, '')
              .trim();
            phonetics = JSON.parse(cleaned);
          } catch (parseError) {
            this.logger.warn('Failed to parse phonetics response');
            phonetics = {
              text,
              phonetic: phoneticsResponse,
              parseError: true,
            };
          }

          // 2. Generate similar sounding words for practice
          const similarWordsPrompt = `
Find 3-5 English words that sound similar to "${text}" or contain similar sounds.

This helps learners practice distinguishing sounds.

Format as JSON array:
[
  {
    "word": "pronounce",
    "phonetic": "/prəˈnaʊns/",
    "similarity": "Same 'pro' prefix",
    "viMeaning": "phát âm"
  }
]
`;

          let similarWords = [];
          try {
            const similarResponse =
              await this.gemini.generateResponse(similarWordsPrompt);
            const cleaned = similarResponse
              .replace(/```json\n?/g, '')
              .replace(/```\n?/g, '')
              .trim();
            similarWords = JSON.parse(cleaned);
          } catch (e) {
            this.logger.warn('Failed to generate similar words');
          }

          // 3. Generate practice sentences
          const practiceSentencesPrompt = `
Create 3 practice sentences that use the word/phrase "${text}".

Sentences should help learners practice pronunciation in context.

Format as JSON array:
[
  {
    "sentence": "Can you pronounce this word?",
    "phonetic": "/kæn juː prəˈnaʊns ðɪs wɜːrd/",
    "vi": "Bạn có thể phát âm từ này không?"
  }
]
`;

          let practiceSentences = [];
          try {
            const practiceResponse = await this.gemini.generateResponse(
              practiceSentencesPrompt,
            );
            const cleaned = practiceResponse
              .replace(/```json\n?/g, '')
              .replace(/```\n?/g, '')
              .trim();
            practiceSentences = JSON.parse(cleaned);
          } catch (e) {
            this.logger.warn('Failed to generate practice sentences');
          }

          // 4. User audio feedback (if provided)
          let userFeedback = null;

          if (userAudioUrl && provideFeedback) {
            this.logger.log(
              `🎧 User audio provided: ${userAudioUrl} (Speech-to-Text not yet integrated)`,
            );

            userFeedback = {
              message:
                'Speech-to-Text integration coming soon. For now, please compare your pronunciation with the IPA guide above.',
              status: 'pending_integration',
              audioUrl: userAudioUrl,

              // Future structure when Speech API is integrated:
              // overallScore: 7.5,
              // clarity: 8.0,
              // intonation: 7.0,
              // fluency: 7.5,
              // problematicWords: [
              //   {
              //     word: "pronunciation",
              //     issue: "Stress on wrong syllable",
              //     suggestion: "Stress should be on 4th syllable: pro-nun-ci-A-tion"
              //   }
              // ]
            };
          }

          // 5. Compile final result
          const result = {
            ...phonetics,
            similarSoundingWords: similarWords,
            practiceSentences,
            userFeedback,
            nativeSpeakerAudio: null,
            tips: [
              'Listen to native speakers and repeat',
              'Record yourself and compare',
              'Practice syllable stress',
              'Use IPA as a guide',
            ],
            generatedAt: new Date().toISOString(),
          };

          this.logger.log(`✅ Pronunciation analysis complete for "${text}"`);

          return JSON.stringify({
            success: true,
            data: result,
          });
        } catch (error) {
          this.logger.error(`❌ Pronunciation coach error: ${error.message}`);
          return JSON.stringify({
            success: false,
            error: error.message,
            text,
          });
        }
      },
    });
  }
}
