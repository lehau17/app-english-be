import { Test, TestingModule } from '@nestjs/testing';
import { DictionaryService } from './dictionary.service';
import { WordsApiService } from './words-api.service';
import { RedisService } from '@app/shared/redis';
import { NotFoundException } from '@nestjs/common';

describe('DictionaryService', () => {
  let service: DictionaryService;
  let wordsApiService: WordsApiService;
  let redisService: RedisService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DictionaryService,
        {
          provide: WordsApiService,
          useValue: {
            lookupWord: jest.fn(),
            isConfigured: jest.fn(),
            getRhymes: jest.fn(),
            searchSimilar: jest.fn(),
            getPronunciationUrl: jest.fn(),
          },
        },
        {
          provide: RedisService,
          useValue: {
            get: jest.fn(),
            set: jest.fn(),
            lpush: jest.fn(),
            ltrim: jest.fn(),
            lrange: jest.fn(),
            expire: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<DictionaryService>(DictionaryService);
    wordsApiService = module.get<WordsApiService>(WordsApiService);
    redisService = module.get<RedisService>(RedisService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('lookupWord', () => {
    // TC_DICT_01, TC_DICT_02, TC_DICT_07
    it('should return word details for a valid word', async () => {
      const word = 'hello';
      const mockApiResponse = {
        word: 'hello',
        results: [
          {
            definition: 'A greeting.',
            partOfSpeech: 'noun',
            examples: ['He shouted "hello"'],
          },
        ],
        pronunciation: { all: 'həˈloʊ' },
      };
      const expectedResult = {
        word: 'hello',
        pronunciation: 'həˈloʊ',
        audioUrl: undefined,
        definitions: [
          {
            word: 'hello',
            partOfSpeech: 'noun',
            definition: 'A greeting.',
            example: 'He shouted "hello"',
            synonyms: undefined,
            antonyms: undefined,
            pronunciation: 'həˈloʊ',
          },
        ],
        frequency: undefined,
        synonyms: [],
        antonyms: [],
        syllables: undefined,
      };

      (wordsApiService.isConfigured as jest.Mock).mockReturnValue(true);
      (wordsApiService.lookupWord as jest.Mock).mockResolvedValue(
        mockApiResponse,
      );
      (redisService.get as jest.Mock).mockResolvedValue(null);

      const result = await service.lookupWord(word);

      expect(result).toEqual(expectedResult);
      expect(wordsApiService.lookupWord).toHaveBeenCalledWith(word);
      expect(redisService.set).toHaveBeenCalled();
    });

    // TC_DICT_03, TC_DICT_05, TC_DICT_06, TC_DICT_08
    it('should throw NotFoundException for a non-existent word', async () => {
      const word = 'asdfghjkl';
      (wordsApiService.isConfigured as jest.Mock).mockReturnValue(true);
      (wordsApiService.lookupWord as jest.Mock).mockResolvedValue(null);
      (redisService.get as jest.Mock).mockResolvedValue(null);

      await expect(service.lookupWord(word)).rejects.toThrow(NotFoundException);
      expect(wordsApiService.lookupWord).toHaveBeenCalledWith(word);
    });

    // TC_DICT_04
    it('should throw NotFoundException for an empty string', async () => {
      const word = '';
      (wordsApiService.isConfigured as jest.Mock).mockReturnValue(true);
      (wordsApiService.lookupWord as jest.Mock).mockResolvedValue(null);
      (redisService.get as jest.Mock).mockResolvedValue(null);

      await expect(service.lookupWord(word)).rejects.toThrow(NotFoundException);
    });
  });
});
