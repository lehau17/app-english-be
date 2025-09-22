import { JwtPayload, PayloadToken, ResponseMessage } from '@app/shared';
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpStatus,
  Param,
  ParseBoolPipe,
  ParseIntPipe,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import {
  CreatePodcastCommentDto,
  LikeCommentDto,
  PodcastCommentResponseDto,
  ReportCommentDto,
  UpdatePodcastCommentDto,
} from './podcast-comment.dto';
import { PodcastCommentService } from './podcast-comment.service';

@ApiTags('Podcast Comments')
@ApiBearerAuth('Authorization')
@Controller('/private/v1/podcast-comments')
export class PodcastCommentController {
  constructor(private readonly podcastCommentService: PodcastCommentService) {}

  @Post()
  @ApiOperation({ summary: 'Tạo comment mới cho podcast' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Comment được tạo thành công',
    type: PodcastCommentResponseDto,
  })
  @ResponseMessage('Comment created successfully')
  async createComment(
    @PayloadToken() tokenPayload: JwtPayload,
    @Body() createCommentDto: CreatePodcastCommentDto,
  ) {
    return await this.podcastCommentService.createComment(
      tokenPayload.sub,
      createCommentDto,
    );
  }

  @Get('podcast/:podcastId')
  @ApiOperation({ summary: 'Lấy danh sách comment của một podcast' })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    description: 'Số trang (default: 1)',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Số lượng per page (default: 20)',
  })
  @ApiQuery({
    name: 'includeReplies',
    required: false,
    type: Boolean,
    description: 'Include replies (default: true)',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Lấy danh sách comment thành công',
  })
  @ResponseMessage('Comments retrieved successfully')
  async getCommentsByPodcast(
    @Param('podcastId') podcastId: string,
    @Query('page', new ParseIntPipe({ optional: true })) page: number = 1,
    @Query('limit', new ParseIntPipe({ optional: true })) limit: number = 20,
    @Query('includeReplies', new ParseBoolPipe({ optional: true }))
    includeReplies: boolean = true,
  ) {
    return await this.podcastCommentService.getCommentsByPodcast(
      podcastId,
      page,
      limit,
      includeReplies,
    );
  }

  @Get('replies/:parentCommentId')
  @ApiOperation({ summary: 'Lấy danh sách replies của một comment' })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    description: 'Số trang (default: 1)',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Số lượng per page (default: 10)',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Lấy danh sách replies thành công',
  })
  @ResponseMessage('Replies retrieved successfully')
  async getReplies(
    @Param('parentCommentId') parentCommentId: string,
    @Query('page', new ParseIntPipe({ optional: true })) page: number = 1,
    @Query('limit', new ParseIntPipe({ optional: true })) limit: number = 10,
  ) {
    return await this.podcastCommentService.getReplies(
      parentCommentId,
      page,
      limit,
    );
  }

  @Get('user/my-comments')
  @ApiOperation({ summary: 'Lấy danh sách comment của user hiện tại' })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    description: 'Số trang (default: 1)',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Số lượng per page (default: 20)',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Lấy danh sách comment của user thành công',
  })
  @ResponseMessage('User comments retrieved successfully')
  async getUserComments(
    @PayloadToken() tokenPayload: JwtPayload,
    @Query('page', new ParseIntPipe({ optional: true })) page: number = 1,
    @Query('limit', new ParseIntPipe({ optional: true })) limit: number = 20,
  ) {
    return await this.podcastCommentService.getUserComments(
      tokenPayload.sub,
      page,
      limit,
    );
  }

  @Put(':commentId')
  @ApiOperation({ summary: 'Cập nhật comment' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Comment được cập nhật thành công',
    type: PodcastCommentResponseDto,
  })
  @ResponseMessage('Comment updated successfully')
  async updateComment(
    @PayloadToken() tokenPayload: JwtPayload,
    @Param('commentId') commentId: string,
    @Body() updateCommentDto: UpdatePodcastCommentDto,
  ) {
    return await this.podcastCommentService.updateComment(
      tokenPayload.sub,
      commentId,
      updateCommentDto,
    );
  }

  @Delete(':commentId')
  @ApiOperation({ summary: 'Xóa comment' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Comment được xóa thành công',
  })
  @ResponseMessage('Comment deleted successfully')
  async deleteComment(
    @PayloadToken() tokenPayload: JwtPayload,
    @Param('commentId') commentId: string,
  ) {
    return await this.podcastCommentService.deleteComment(
      tokenPayload.sub,
      commentId,
    );
  }

  @Post(':commentId/like')
  @ApiOperation({ summary: 'Like/Unlike comment' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Comment like status updated successfully',
  })
  @ResponseMessage('Comment like status updated successfully')
  async likeComment(
    @PayloadToken() tokenPayload: JwtPayload,
    @Param('commentId') commentId: string,
    @Body() likeDto: LikeCommentDto,
  ) {
    return await this.podcastCommentService.likeComment(
      tokenPayload.sub,
      commentId,
      likeDto.isLiked,
    );
  }

  @Post(':commentId/report')
  @ApiOperation({ summary: 'Báo cáo comment' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Comment được báo cáo thành công',
  })
  @ResponseMessage('Comment reported successfully')
  async reportComment(
    @PayloadToken() tokenPayload: JwtPayload,
    @Param('commentId') commentId: string,
    @Body() reportDto: ReportCommentDto,
  ) {
    return await this.podcastCommentService.reportComment(
      tokenPayload.sub,
      commentId,
      reportDto,
    );
  }
}
