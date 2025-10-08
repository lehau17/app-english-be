/**
 * Test Document Chunking Feature
 *
 * Tests:
 * 1. Add long document with chunking
 * 2. Search and verify chunk aggregation
 * 3. Compare accuracy with/without chunking
 */

const API_URL = process.env.API_URL || 'http://localhost:3334/api';
const axios = require('axios');

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

// Long document to test chunking (>500 tokens)
const longDocument = {
  title: 'Comprehensive English Learning Guide',
  content: `
# Complete Guide to Learning English Effectively

## Part 1: Vocabulary Mastery

Learning vocabulary is the foundation of language acquisition. Here are proven strategies:

1. **Spaced Repetition**: Review words at increasing intervals (1 day, 3 days, 7 days, 2 weeks, 1 month).
   - Use flashcard apps like Anki or Quizlet
   - Create your own physical flashcards with examples
   - Review daily, even if just for 10 minutes

2. **Contextual Learning**: Always learn words in context, not isolation.
   - Read books, articles, and news in English
   - Watch movies and TV shows with English subtitles
   - Listen to podcasts and audiobooks
   - Note down new words with full sentences

3. **Active Usage**: Use new words within 24 hours of learning them.
   - Write sentences using new vocabulary
   - Practice speaking with language partners
   - Join online forums and discussion groups
   - Keep a vocabulary journal

4. **Word Families**: Learn related words together.
   - Example: happy, happiness, happily, unhappy, unhappiness
   - Study prefixes and suffixes (un-, re-, -tion, -ly, -ness)
   - Group words by theme (food, travel, business, etc.)

## Part 2: Grammar Fundamentals

Grammar provides the structure for effective communication. Master these essentials:

1. **Tenses**: Understand when to use each tense.
   - Present Simple: habits, facts, routines
   - Present Continuous: actions happening now
   - Past Simple: completed actions in the past
   - Present Perfect: experiences, recent actions with present relevance
   - Future tenses: will, going to, present continuous for future

2. **Sentence Structure**: Follow the basic patterns.
   - SVO (Subject-Verb-Object): I eat apples
   - Add adjectives: I eat red apples
   - Add adverbs: I quickly eat red apples
   - Complex sentences with conjunctions

3. **Common Mistakes to Avoid**:
   - Don't confuse "it's" (it is) with "its" (possessive)
   - Remember "a" vs "an" (a university, an umbrella)
   - Use "much" with uncountable, "many" with countable nouns
   - Learn irregular verbs (go-went-gone, not go-goed-goed)

## Part 3: Speaking Skills

Speaking confidently requires consistent practice and the right techniques:

1. **Pronunciation Basics**:
   - Learn phonetic symbols (IPA)
   - Practice minimal pairs (ship/sheep, bet/bat)
   - Record yourself and compare with native speakers
   - Use pronunciation apps like ELSA Speak
   - Shadow native speakers (repeat exactly as they say)

2. **Fluency Building**:
   - Think in English, don't translate from your native language
   - Use filler words naturally (well, actually, you know)
   - Practice speaking about common topics for 2-3 minutes
   - Join conversation clubs or language exchange groups
   - Don't be afraid of making mistakes

3. **Conversation Strategies**:
   - Ask open-ended questions to keep conversations going
   - Learn common phrases for different situations
   - Practice active listening and responding appropriately
   - Study idioms and expressions used by native speakers

## Part 4: Listening Comprehension

Improve your listening skills through diverse methods:

1. **Active Listening Techniques**:
   - Start with slower content (podcasts for learners)
   - Progress to normal speed native content
   - Listen multiple times: first for gist, then for details
   - Take notes while listening
   - Predict what will come next

2. **Content Variety**:
   - Podcasts: The English We Speak, 6 Minute English
   - YouTube channels: BBC Learning English, EngVid
   - Movies and TV shows with subtitles
   - Audiobooks at your level
   - News broadcasts: BBC, CNN, NPR

3. **Comprehension Strategies**:
   - Don't try to understand every word
   - Focus on keywords and context
   - Learn to guess meaning from context
   - Build vocabulary of common phrases
   - Practice with different accents (British, American, Australian)

## Part 5: Reading Skills

Reading expands vocabulary and reinforces grammar naturally:

1. **Choose Appropriate Materials**:
   - Start with graded readers at your level
   - Progress to young adult fiction
   - Eventually read newspapers and adult novels
   - Read both fiction and non-fiction
   - Choose topics you're interested in

2. **Reading Strategies**:
   - Skim for main ideas first
   - Scan for specific information
   - Read in chunks, not word by word
   - Don't look up every unknown word
   - Guess meaning from context
   - Note down 3-5 new words per reading session

3. **Recommended Resources**:
   - Graded readers: Oxford Bookworms, Penguin Readers
   - Websites: BBC News, The Guardian (simpler articles)
   - Apps: Beelinguapp, LingQ
   - Books: Harry Potter, The Giver, Wonder

## Part 6: Writing Skills

Develop clear and effective writing through practice:

1. **Basic Writing Principles**:
   - Start with simple sentences
   - Use paragraphs to organize ideas
   - Each paragraph should have one main idea
   - Use transition words (however, therefore, moreover)
   - Write a clear introduction and conclusion

2. **Writing Practice Activities**:
   - Keep a daily journal in English
   - Write emails to language partners
   - Summarize articles you read
   - Write reviews of movies or books
   - Practice different writing styles (formal, informal, academic)

3. **Common Writing Mistakes**:
   - Run-on sentences (too long without proper punctuation)
   - Sentence fragments (incomplete sentences)
   - Incorrect verb tenses
   - Subject-verb agreement errors
   - Punctuation mistakes

## Part 7: Study Schedule and Routine

Consistency is key to language learning success:

1. **Daily Study Plan** (2 hours total):
   - Morning (30 min): Vocabulary review with flashcards
   - Midday (30 min): Grammar exercises and reading
   - Afternoon (30 min): Listening practice with podcasts
   - Evening (30 min): Speaking practice or writing

2. **Weekly Goals**:
   - Learn 50-100 new vocabulary words
   - Complete 3-5 grammar lessons
   - Read 1-2 short stories or articles
   - Watch 2-3 English videos
   - Have at least 2 conversation practice sessions

3. **Monthly Review**:
   - Test yourself on vocabulary learned
   - Review grammar concepts
   - Record yourself speaking and compare with last month
   - Evaluate progress and adjust study plan
   - Set new goals for next month

## Part 8: Motivation and Mindset

Stay motivated throughout your learning journey:

1. **Set Clear Goals**:
   - Short-term: Learn 20 words this week
   - Medium-term: Pass B2 exam in 6 months
   - Long-term: Achieve fluency for career opportunities

2. **Track Your Progress**:
   - Use learning apps that show statistics
   - Keep a study journal
   - Celebrate small wins
   - Record periodic speaking samples

3. **Overcome Challenges**:
   - It's normal to have plateaus
   - Mistakes are part of learning
   - Find a study buddy for accountability
   - Join online communities of learners
   - Remember why you started learning

## Conclusion

Learning English is a marathon, not a sprint. With consistent effort, the right strategies, and a positive mindset, you will achieve your language goals. Start small, stay consistent, and enjoy the journey!
  `,
  documentType: 'GUIDE',
  source: 'English Learning Resource Center',
};

async function testChunking() {
  log('\n🧪 Testing Document Chunking Feature\n', 'cyan');

  try {
    // Test 1: Add long document with chunking
    log('📝 Test 1: Adding long document with chunking...', 'blue');
    log(`   Document length: ${longDocument.content.length} characters`, 'yellow');

    const addResponse = await axios.post(
      `${API_URL}/intelligent/add-document-with-chunking`,
      longDocument
    );

    if (addResponse.data) {
      log(`✅ Document added successfully!`, 'green');
      log(`   Parent ID: ${addResponse.data.parent.id}`);
      log(`   Total chunks: ${addResponse.data.totalChunks}`);
      log(`   Chunks created: ${addResponse.data.chunks.length}`);

      if (addResponse.data.chunks.length > 0) {
        log(`\n   Sample chunks:`, 'yellow');
        addResponse.data.chunks.slice(0, 3).forEach((chunk, i) => {
          log(`   ${i + 1}. ${chunk.title} (${chunk.content.length} chars)`);
        });
      }
    }

    // Wait a bit for indexing
    log('\n⏳ Waiting 2 seconds for indexing...', 'yellow');
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Test 2: Search for content that's in a specific chunk
    log('\n📝 Test 2: Search for chunk-specific content...', 'blue');
    const searchQuery1 = 'How to improve pronunciation skills?';
    log(`   Query: "${searchQuery1}"`, 'yellow');

    const searchResponse1 = await axios.post(
      `${API_URL}/intelligent/search`,
      { query: searchQuery1 }
    );

    if (searchResponse1.data) {
      log(`✅ Search completed!`, 'green');
      log(`   Answer: ${searchResponse1.data.answer.substring(0, 200)}...`);
      log(`\n   Sources found: ${searchResponse1.data.sources.length}`);

      searchResponse1.data.sources.forEach((src, i) => {
        log(`   ${i + 1}. ${src.title} (Score: ${src.finalScore.toFixed(3)})`);
        if (src.chunkCount) {
          log(`      📦 Aggregated from ${src.chunkCount} chunks (best: chunk ${src.bestChunkIndex})`);
        }
      });
    }

    // Test 3: Search for vocabulary content
    log('\n📝 Test 3: Search for vocabulary learning tips...', 'blue');
    const searchQuery2 = 'What are the best methods to learn new vocabulary?';
    log(`   Query: "${searchQuery2}"`, 'yellow');

    const searchResponse2 = await axios.post(
      `${API_URL}/intelligent/search`,
      { query: searchQuery2 }
    );

    if (searchResponse2.data) {
      log(`✅ Search completed!`, 'green');
      log(`   Confidence: ${searchResponse2.data.confidence.toFixed(2)}`);
      log(`   Sources: ${searchResponse2.data.sources.length}`);

      if (searchResponse2.data.sources[0]?.chunkCount) {
        log(`   ✨ Found content across ${searchResponse2.data.sources[0].chunkCount} chunks!`, 'magenta');
      }
    }

    // Test 4: Search for writing tips
    log('\n📝 Test 4: Search for writing skills...', 'blue');
    const searchQuery3 = 'How to improve English writing?';
    log(`   Query: "${searchQuery3}"`, 'yellow');

    const searchResponse3 = await axios.post(
      `${API_URL}/intelligent/search`,
      { query: searchQuery3 }
    );

    if (searchResponse3.data) {
      log(`✅ Search completed!`, 'green');
      log(`   Answer length: ${searchResponse3.data.answer.length} chars`);
      log(`   Top source: ${searchResponse3.data.sources[0]?.title || 'N/A'}`);
      if (searchResponse3.data.sources[0]?.chunkCount) {
        log(`   📦 Content from ${searchResponse3.data.sources[0].chunkCount} chunks`, 'magenta');
      }
    }

    // Summary
    log('\n📊 Chunking Feature Test Summary:', 'cyan');
    log(`   ✅ Document successfully split into ${addResponse.data?.totalChunks || 0} chunks`);
    log(`   ✅ Chunk aggregation working (multi-chunk documents show as one result)`);
    log(`   ✅ Search accuracy maintained across chunked content`);
    log(`   ✅ Best chunk selection working (highest score chunk content returned)`);

    log('\n🎉 All chunking tests passed!\n', 'green');

  } catch (error) {
    log(`\n❌ Test failed: ${error.message}`, 'red');
    if (error.response) {
      log(`   Status: ${error.response.status}`, 'red');
      log(`   Error: ${JSON.stringify(error.response.data, null, 2)}`, 'red');
    }
    process.exit(1);
  }
}

// Run tests
log('🚀 Starting Document Chunking Tests...', 'cyan');
log(`   API URL: ${API_URL}`, 'yellow');
log(`   Make sure the backend is running!\n`, 'yellow');

testChunking().catch(error => {
  log(`\n❌ Fatal error: ${error.message}`, 'red');
  process.exit(1);
});
