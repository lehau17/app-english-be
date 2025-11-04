import { JwtPayload, PayloadToken, ResponseMessage } from '@app/shared';
import { Controller, Get, Param, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { AdvancedSearchDto, WordResultDto } from '../dto/dictionary.dto';
import { WordExamplesDto, WordRelationsDto } from '../dto/word-relation.dto';
import { DictionaryService } from '../service/dictionary.service';
import { WordOfTheDayService } from '../service/word-of-the-day.service';

@ApiTags('Dictionary')
@ApiBearerAuth('Authorization')
@Controller('/private/v1/dictionary')
export class DictionaryController {
  constructor(
    private readonly dictionaryService: DictionaryService,
    private readonly wordOfTheDayService: WordOfTheDayService,
  ) {}

  @Get('/word-of-the-day')
  @ApiOperation({
    summary: 'Get the Word of the Day',
    description:
      'Returns the automatically selected Word of the Day. The word is updated daily.',
  })
  @ApiResponse({
    status: 200,
    description: 'Word of the Day fetched successfully.',
    type: WordResultDto,
  })
  @ResponseMessage('Word of the Day fetched successfully')
  async getWordOfTheDay(): Promise<WordResultDto> {
    return this.wordOfTheDayService.getWordOfTheDay();
  }

  @Get('/lookup/:word')
  @ApiOperation({
    summary: 'Lookup word definition',
    description:
      'Get detailed information about a word including definitions, pronunciation, synonyms, etc.',
  })
  @ApiParam({ name: 'word', example: 'example' })
  @ResponseMessage('Word details fetched successfully')
  async lookupWord(
    @Param('word') word: string,
    @PayloadToken() user: JwtPayload,
  ): Promise<WordResultDto> {
    // Track user search
    await this.dictionaryService.addRecentSearch(user.sub, word);

    return this.dictionaryService.lookupWord(word);
  }

  @Get('/suggestions')
  @ApiOperation({
    summary: 'Get word suggestions for autocomplete',
    description: 'Returns a list of words matching the query prefix',
  })
  @ApiQuery({ name: 'q', example: 'exam', description: 'Search query' })
  @ApiQuery({ name: 'limit', required: false, example: 10 })
  @ResponseMessage('Suggestions fetched successfully')
  async getSuggestions(
    @Query('q') query: string,
    @Query('limit') limit?: number,
  ): Promise<{ suggestions: string[] }> {
    const suggestions = await this.dictionaryService.getSuggestions(
      query,
      limit ? parseInt(String(limit)) : 10,
    );
    return { suggestions };
  }

  @Get('/rhymes/:word')
  @ApiOperation({
    summary: 'Get rhyming words',
    description: 'Find words that rhyme with the given word',
  })
  @ApiParam({ name: 'word', example: 'cat' })
  @ResponseMessage('Rhymes fetched successfully')
  async getRhymes(@Param('word') word: string): Promise<{ rhymes: string[] }> {
    const rhymes = await this.dictionaryService.getRhymes(word);
    return { rhymes };
  }

  @Get('/lookup/:word/examples')
  @ApiOperation({ summary: 'Get example sentences for a word' })
  @ApiParam({ name: 'word', example: 'line' })
  @ApiResponse({ status: 200, type: WordExamplesDto })
  @ResponseMessage('Examples fetched successfully')
  async getExamples(@Param('word') word: string): Promise<WordExamplesDto> {
    const examples = await this.dictionaryService.getExamples(word);
    return { examples };
  }

  @Get('/lookup/:word/type-of')
  @ApiOperation({ summary: 'Get "type of" relations for a word' })
  @ApiParam({ name: 'word', example: 'car' })
  @ApiResponse({ status: 200, type: WordRelationsDto })
  @ResponseMessage('Relations fetched successfully')
  async getTypeOf(@Param('word') word: string): Promise<WordRelationsDto> {
    const relations = await this.dictionaryService.getTypeOf(word);
    return { relations };
  }

  @Get('/lookup/:word/has-types')
  @ApiOperation({ summary: 'Get "has types" relations for a word' })
  @ApiParam({ name: 'word', example: 'vehicle' })
  @ApiResponse({ status: 200, type: WordRelationsDto })
  @ResponseMessage('Relations fetched successfully')
  async getHasTypes(@Param('word') word: string): Promise<WordRelationsDto> {
    const relations = await this.dictionaryService.getHasTypes(word);
    return { relations };
  }

  @Get('/lookup/:word/part-of')
  @ApiOperation({ summary: 'Get "part of" relations for a word' })
  @ApiParam({ name: 'word', example: 'wheel' })
  @ApiResponse({ status: 200, type: WordRelationsDto })
  @ResponseMessage('Relations fetched successfully')
  async getPartOf(@Param('word') word: string): Promise<WordRelationsDto> {
    const relations = await this.dictionaryService.getPartOf(word);
    return { relations };
  }

  @Get('/search')
  @ApiOperation({
    summary: 'Advanced search for words',
    description:
      'Search for words using various criteria like patterns and part of speech.',
  })
  @ResponseMessage('Search results fetched successfully')
  async advancedSearch(@Query() query: AdvancedSearchDto): Promise<any> {
    return this.dictionaryService.advancedSearch(query);
  }

  @Get('/recent')
  @ApiOperation({
    summary: 'Get recent searches',
    description: "Returns user's recent word searches",
  })
  @ApiQuery({ name: 'limit', required: false, example: 10 })
  @ResponseMessage('Recent searches fetched successfully')
  async getRecentSearches(
    @PayloadToken() user: JwtPayload,
    @Query('limit') limit?: number,
  ): Promise<{ words: string[] }> {
    const words = await this.dictionaryService.getRecentSearches(
      user.sub,
      limit ? parseInt(String(limit)) : 10,
    );
    return { words };
  }
}
