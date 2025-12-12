import { JwtPayload, PayloadToken, Roles, RolesGuard } from '@app/shared';
import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Logger,
  Param,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import {
  BlockingStatusDto,
  BlockStudentDto,
  UnblockStudentDto,
  UpdateBlockingConfigDto,
} from '../dto/attendance-blocking.dto';
import { AttendanceBlockingService } from '../service/attendance-blocking.service';
import { ClassroomService } from '../service/classroom.service';

/**
 * Attendance Blocking Controller
 * Handles blocking configuration and management
 */
@Controller('private/v1/classrooms')
export class AttendanceBlockingController {
  private readonly logger = new Logger(AttendanceBlockingController.name);

  constructor(
    private readonly attendanceBlockingService: AttendanceBlockingService,
    private readonly classroomService: ClassroomService,
  ) {}

  /**
   * Get blocking status for a student
   * GET /api/classrooms/:id/students/:studentId/blocking-status
   */
  @Get(':id/students/:studentId/blocking-status')
  async getBlockingStatus(
    @Param('id') classroomId: string,
    @Param('studentId') studentId: string,
  ): Promise<BlockingStatusDto> {
    return this.attendanceBlockingService.checkBlockingStatus(
      classroomId,
      studentId,
    );
  }

  /**
   * Get blocking configuration for a classroom
   * GET /api/classrooms/:id/blocking-config
   */
  @Get(':id/blocking-config')
  @UseGuards(RolesGuard)
  @Roles('admin', 'teacher')
  async getBlockingConfig(@Param('id') classroomId: string) {
    const classroom = await this.classroomService.findById(classroomId);
    if (!classroom) {
      throw new BadRequestException('Classroom not found');
    }

    const settings = (classroom.settings as any) || {};
    const blockingConfig = settings.attendanceBlocking || {};

    return {
      enabled: blockingConfig.enabled !== false, // Default true
      threshold: blockingConfig.threshold || 3,
    };
  }

  /**
   * Update blocking configuration for a classroom
   * PUT /api/classrooms/:id/blocking-config
   */
  @Put(':id/blocking-config')
  @UseGuards(RolesGuard)
  @Roles('admin', 'teacher')
  async updateBlockingConfig(
    @Param('id') classroomId: string,
    @Body() dto: UpdateBlockingConfigDto,
    @PayloadToken() user: JwtPayload,
  ) {
    const classroom = await this.classroomService.findById(classroomId);
    if (!classroom) {
      throw new BadRequestException('Classroom not found');
    }

    // Check if user is teacher of this classroom
    if (user.role === 'teacher' && classroom.teacherId !== user.sub) {
      throw new BadRequestException(
        'You are not the teacher of this classroom',
      );
    }

    const settings = (classroom.settings as any) || {};
    settings.attendanceBlocking = {
      ...settings.attendanceBlocking,
      ...(dto.enabled !== undefined && { enabled: dto.enabled }),
      ...(dto.threshold !== undefined && { threshold: dto.threshold }),
    };

    // Update settings using ClassroomService method
    await this.classroomService.updateSettings(classroomId, settings);

    this.logger.log(
      `Blocking config updated for classroom ${classroomId} by ${user.sub}: ${JSON.stringify(dto)}`,
    );

    return {
      success: true,
      config: settings.attendanceBlocking,
    };
  }

  /**
   * Get list of blocked students in a classroom
   * GET /api/classrooms/:id/blocked-students
   */
  @Get(':id/blocked-students')
  @UseGuards(RolesGuard)
  @Roles('admin', 'teacher')
  async getBlockedStudents(@Param('id') classroomId: string) {
    const classroom = await this.classroomService.findById(classroomId);
    if (!classroom) {
      throw new BadRequestException('Classroom not found');
    }

    const blockedStudents =
      await this.attendanceBlockingService.getBlockedStudents(classroomId);

    return blockedStudents.map((cs) => ({
      studentId: cs.studentId,
      studentName: cs.student.displayName,
      studentEmail: cs.student.email,
      studentAvatar: cs.student.avatarUrl,
      consecutiveAbsences: cs.consecutiveAbsences,
      blockedAt: cs.blockedAt,
      blockedReason: cs.blockedReason,
    }));
  }

  /**
   * Manually unblock a student
   * POST /api/classrooms/:id/students/:studentId/unblock
   */
  @Post(':id/students/:studentId/unblock')
  @UseGuards(RolesGuard)
  @Roles('admin', 'teacher')
  async unblockStudent(
    @Param('id') classroomId: string,
    @Param('studentId') studentId: string,
    @Body() dto: UnblockStudentDto,
    @PayloadToken() user: JwtPayload,
  ) {
    const classroom = await this.classroomService.findById(classroomId);
    if (!classroom) {
      throw new BadRequestException('Classroom not found');
    }

    // Check if user is teacher of this classroom
    if (user.role === 'teacher' && classroom.teacherId !== user.sub) {
      throw new BadRequestException(
        'You are not the teacher of this classroom',
      );
    }

    await this.attendanceBlockingService.manualUnblock(
      classroomId,
      studentId,
      dto.reason,
      user.sub,
    );

    this.logger.log(
      `Student ${studentId} unblocked in classroom ${classroomId} by ${user.sub}: ${dto.reason}`,
    );

    return {
      success: true,
      message: 'Student unblocked successfully',
    };
  }

  /**
   * Manually block a student
   * POST /api/classrooms/:id/students/:studentId/block
   */
  @Post(':id/students/:studentId/block')
  @UseGuards(RolesGuard)
  @Roles('admin', 'teacher')
  async blockStudent(
    @Param('id') classroomId: string,
    @Param('studentId') studentId: string,
    @Body() dto: BlockStudentDto,
    @PayloadToken() user: JwtPayload,
  ) {
    const classroom = await this.classroomService.findById(classroomId);
    if (!classroom) {
      throw new BadRequestException('Classroom not found');
    }

    // Check if user is teacher of this classroom
    if (user.role === 'teacher' && classroom.teacherId !== user.sub) {
      throw new BadRequestException(
        'You are not the teacher of this classroom',
      );
    }

    await this.attendanceBlockingService.manualBlock(
      classroomId,
      studentId,
      dto.reason,
      user.sub,
    );

    this.logger.log(
      `Student ${studentId} blocked in classroom ${classroomId} by ${user.sub}: ${dto.reason}`,
    );

    return {
      success: true,
      message: 'Student blocked successfully',
    };
  }
}







