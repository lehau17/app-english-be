import { RedisService } from '@app/shared/redis';
import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { WordResultDto } from '../dto/dictionary.dto';
import { DictionaryService } from './dictionary.service';

@Injectable()
export class WordOfTheDayService {
  private readonly logger = new Logger(WordOfTheDayService.name);
  private readonly CACHE_KEY = 'dict:word_of_the_day';
  private readonly CACHE_TTL = 24 * 60 * 60; // 24 hours

  // A list of interesting or common English words
  private readonly wordList = [
    'ephemeral', 'serendipity', 'eloquent', 'ubiquitous', 'mellifluous',
    'petrichor', 'sonder', 'defenestration', 'ineffable', 'limerence',
    'aurora', 'solitude', 'nostalgia', 'euphoria', 'cynosure',
    'lullaby', 'tranquility', 'ethereal', 'incandescence', 'nebulous',
    'somnambulist', 'quintessence', 'plethora', 'myriad', 'cacophony',
    'epiphany', 'eunoia', 'cromulent', 'perspicacious', 'pulchritudinous',
    'resplendent', 'surreptitious', 'verisimilitude', 'zephyr', 'anachronism',
    'ameliorate', 'bombinate', 'effervescent', 'evanescent', 'halcyon',
    'inglenook', 'kerfuffle', 'propinquity', 'sesquipedalian', 'tinnitus',
    'bibliophile', 'chrysanthemum', 'dandelion', 'efflorescence', 'gossamer',
    'hippopotamus', 'onomatopoeia', 'penumbra', 'photosynthesis', 'syzygy',
    'abnegation', 'bifurcate', 'capitulate', 'diaphanous', 'exacerbate',
    'gregarious', 'hegemony', 'ignominious', 'juxtaposition', 'kowtow',
    'laconic', 'magnanimous', 'nonplussed', 'obfuscate', 'panacea',
    'querulous', 'recalcitrant', 'sycophant', 'taciturn', 'ubiquity',
    'vacillate', 'wanton', 'xenophobia', 'yesterday', 'zeitgeist',
    'acquiesce', 'benevolent', 'circumnavigate', 'diligent', 'empathy',
    'fortitude', 'garrulous', 'harbinger', 'idiosyncrasy', 'jovial',
    'kinetic', 'luminary', 'maverick', 'neophyte', 'opulent',
    'paradigm', 'quixotic', 'rhetoric', 'sanctuary', 'tenacity',
  ];

  constructor(
    private readonly dictionaryService: DictionaryService,
    private readonly redisService: RedisService,
  ) {}

  /**
   * This cron job runs every day at midnight to select a new Word of the Day.
   */
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT, {
    name: 'selectWordOfTheDay',
    timeZone: 'UTC',
  })
  async handleCron() {
    this.logger.log('CRON: Starting job to select new Word of the Day...');
    try {
      await this.selectWordOfTheDay();
      this.logger.log('CRON: Successfully selected and cached new Word of the Day.');
    } catch (error) {
      this.logger.error('CRON: Failed to select Word of the Day.', error.stack);
    }
  }

  /**
   * Gets the cached Word of the Day. If not in cache, it triggers a new selection.
   * @returns {Promise<WordResultDto>} The word of the day.
   */
  async getWordOfTheDay(): Promise<WordResultDto> {
    const cachedWord = await this.redisService.get(this.CACHE_KEY);
    if (cachedWord) {
      this.logger.log('Serving Word of the Day from cache.');
      return JSON.parse(cachedWord);
    }

    this.logger.log('Cache miss for Word of the Day. Triggering new selection...');
    return this.selectWordOfTheDay();
  }

  /**
   * Selects a random word, looks up its details, and caches it.
   * @returns {Promise<WordResultDto>} The newly selected word of the day.
   */
  async selectWordOfTheDay(): Promise<WordResultDto> {
    const randomIndex = Math.floor(Math.random() * this.wordList.length);
    const selectedWord = this.wordList[randomIndex];

    this.logger.log(`Selected new Word of the Day: "${selectedWord}"`);

    const wordDetails = await this.dictionaryService.lookupWord(selectedWord);

    await this.redisService.set(
      this.CACHE_KEY,
      JSON.stringify(wordDetails),
      this.CACHE_TTL,
    );

    this.logger.log(`Successfully cached details for "${selectedWord}".`);

    return wordDetails;
  }
}
