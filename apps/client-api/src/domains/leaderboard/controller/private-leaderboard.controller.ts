import { ResponseMessage } from '@app/shared';
import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  ClassroomLeaderboardQueryDto,
  LeaderboardResponseDto,
  MonthlyLeaderboardQueryDto,
  YearlyLeaderboardQueryDto,
} from '../dto/leaderboard.dto';
import { LeaderboardService } from '../service/leaderboard.service';

@ApiTags('Leaderboards')
@ApiBearerAuth('Authorization')
@Controller('/private/v1/leaderboards')
export class PrivateLeaderboardController {
  constructor(private readonly service: LeaderboardService) {}

  @Get('classrooms/:classroomId')
  @ApiOperation({ summary: 'Leaderboard scoped to a specific classroom.' })
  @ResponseMessage('Classroom leaderboard fetched successfully')
  getClassroomLeaderboard(
    @Param('classroomId', new ParseUUIDPipe()) classroomId: string,
    @Query() query: ClassroomLeaderboardQueryDto,
  ): Promise<LeaderboardResponseDto> {
    return this.service.getClassroomLeaderboard(classroomId, query);
  }

  @Get('monthly')
  @ApiOperation({ summary: 'Monthly leaderboard across assignments.' })
  @ResponseMessage('Monthly leaderboard fetched successfully')
  getMonthlyLeaderboard(
    @Query() query: MonthlyLeaderboardQueryDto,
  ): Promise<LeaderboardResponseDto> {
    return this.service.getMonthlyLeaderboard(query);
  }

  @Get('yearly')
  @ApiOperation({ summary: 'Yearly leaderboard across assignments.' })
  @ResponseMessage('Yearly leaderboard fetched successfully')
  getYearlyLeaderboard(
    @Query() query: YearlyLeaderboardQueryDto,
  ): Promise<LeaderboardResponseDto> {
    return this.service.getYearlyLeaderboard(query);
  }
}
