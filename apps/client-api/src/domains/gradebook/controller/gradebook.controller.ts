import { ResponseMessage } from '@app/shared';
import { RequestContext } from '@app/shared/request-context';
import {
  Controller,
  ForbiddenException,
  Get,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Res,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { Response } from 'express';
import {
  ClassroomGradebookDto,
  StudentGradeDetailsDto,
  StudentTranscriptDto,
} from '../dto';
import { GradebookRepository } from '../repository';
import { GradebookExportService, GradebookService } from '../service';

@ApiTags('Gradebook')
@ApiBearerAuth('Authorization')
@Controller('/private/v1/gradebook')
export class GradebookController {
  constructor(
    private readonly gradebookService: GradebookService,
    private readonly gradebookExportService: GradebookExportService,
    private readonly gradebookRepository: GradebookRepository,
  ) {}

  /**
   * Sanitize filename to remove invalid characters for HTTP headers
   */
  private sanitizeFilename(name: string): string {
    if (!name) return 'unknown';
    return name
      .replace(/[<>:"/\\|?*\x00-\x1F]/g, '') // Remove invalid chars
      .replace(/\s+/g, '-') // Replace spaces with dashes
      .replace(/[^\w\-._]/g, '') // Keep only alphanumeric, dash, dot, underscore
      .substring(0, 100); // Limit length
  }

  @Get('classrooms/:classroomId')
  @ApiOperation({ summary: 'Get classroom gradebook' })
  @ResponseMessage('Classroom gradebook fetched successfully')
  async getClassroomGradebook(
    @Param('classroomId', ParseUUIDPipe) classroomId: string,
  ): Promise<ClassroomGradebookDto> {
    const user = RequestContext.getValue('user');
    if (!user || !user.sub) {
      throw new ForbiddenException('User not authenticated');
    }

    // Check if user is admin or teacher of this classroom
    const classroom = await this.gradebookRepository.getClassroomWithCourse(
      classroomId,
    );
    if (!classroom) {
      throw new NotFoundException(`Classroom ${classroomId} not found`);
    }

    // Allow admin or teacher
    if (user.role !== UserRole.admin && user.role !== UserRole.teacher) {
      throw new ForbiddenException(
        'Only admin or teacher can access classroom gradebook',
      );
    }

    // If teacher, verify they own the classroom
    if (user.role === UserRole.teacher && classroom.teacherId !== user.sub) {
      throw new ForbiddenException(
        'You can only access gradebook for your own classrooms',
      );
    }

    return this.gradebookService.calculateClassroomGrades(classroomId);
  }

  @Get('students/me/transcript')
  @ApiOperation({ summary: 'Get my transcript (current student)' })
  @ResponseMessage('My transcript fetched successfully')
  async getMyTranscript(): Promise<StudentTranscriptDto> {
    const user = RequestContext.getValue('user');
    if (!user || !user.sub) {
      throw new ForbiddenException('User not authenticated');
    }

    if (user.role !== UserRole.student) {
      throw new ForbiddenException('This endpoint is for students only');
    }

    return this.gradebookService.getStudentTranscript(user.sub);
  }

  @Get('students/:studentId/transcript')
  @ApiOperation({ summary: 'Get student transcript' })
  @ResponseMessage('Student transcript fetched successfully')
  async getStudentTranscript(
    @Param('studentId', ParseUUIDPipe) studentId: string,
  ): Promise<StudentTranscriptDto> {
    const user = RequestContext.getValue('user');
    if (!user || !user.sub) {
      throw new ForbiddenException('User not authenticated');
    }

    // Students can only access their own transcript
    // Admin and teachers can access any student's transcript
    if (user.role === UserRole.student     && user.sub !== studentId) {
      throw new ForbiddenException(
        'You can only access your own transcript',
      );
    }

    return this.gradebookService.getStudentTranscript(studentId);
  }

  @Get('classrooms/:classroomId/export')
  @ApiOperation({ summary: 'Export classroom gradebook to Excel' })
  @ResponseMessage('Gradebook exported successfully')
  async exportClassroomGradebook(
    @Param('classroomId', ParseUUIDPipe) classroomId: string,
    @Res() res: Response,
  ): Promise<void> {
    const user = RequestContext.getValue('user');
    if (!user || !user.sub) {
      throw new ForbiddenException('User not authenticated');
    }

    const classroom = await this.gradebookRepository.getClassroomWithCourse(
      classroomId,
    );
    if (!classroom) {
      throw new NotFoundException(`Classroom ${classroomId} not found`);
    }

    if (user.role !== UserRole.admin && user.role !== UserRole.teacher) {
      throw new ForbiddenException(
        'Only admin or teacher can export classroom gradebook',
      );
    }

    if (user.role === UserRole.teacher && classroom.teacherId !== user.sub) {
      throw new ForbiddenException(
        'You can only export gradebook for your own classrooms',
      );
    }

    const buffer = await this.gradebookExportService.exportClassroomGradebook(
      classroomId,
    );

    const sanitizedName = this.sanitizeFilename(classroom.name);
    const filename = `bang-diem-${sanitizedName}-${Date.now()}.xlsx`;
    const encodedFilename = encodeURIComponent(filename);

    res.set({
      'Content-Type':
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"; filename*=UTF-8''${encodedFilename}`,
    });

    res.send(buffer);
  }

  @Get('students/me/transcript/export')
  @ApiOperation({ summary: 'Export my transcript to Excel (current student)' })
  @ResponseMessage('Transcript exported successfully')
  async exportMyTranscript(@Res() res: Response): Promise<void> {
    const user = RequestContext.getValue('user');
    if (!user || !user.sub) {
      throw new ForbiddenException('User not authenticated');
    }

    if (user.role !== UserRole.student) {
      throw new ForbiddenException('This endpoint is for students only');
    }

    const transcript = await this.gradebookService.getStudentTranscript(
      user.sub,
    );
    const buffer = await this.gradebookExportService.exportStudentTranscript(
      user.sub,
    );

    const sanitizedName = this.sanitizeFilename(transcript.studentName);
    const filename = `bang-diem-${sanitizedName}-${Date.now()}.xlsx`;
    const encodedFilename = encodeURIComponent(filename);

    res.set({
      'Content-Type':
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"; filename*=UTF-8''${encodedFilename}`,
    });

    res.send(buffer);
  }

  @Get('students/:studentId/transcript/export')
  @ApiOperation({ summary: 'Export student transcript to Excel' })
  @ResponseMessage('Transcript exported successfully')
  async exportStudentTranscript(
    @Param('studentId', ParseUUIDPipe) studentId: string,
    @Res() res: Response,
  ): Promise<void> {
    const user = RequestContext.getValue('user');
    if (!user || !user.sub) {
      throw new ForbiddenException('User not authenticated');
    }

    if (user.role === UserRole.student && user.sub !== studentId) {
      throw new ForbiddenException(
        'You can only export your own transcript',
      );
    }

    const transcript = await this.gradebookService.getStudentTranscript(
      studentId,
    );
    const buffer = await this.gradebookExportService.exportStudentTranscript(
      studentId,
    );

    const sanitizedName = this.sanitizeFilename(transcript.studentName);
    const filename = `bang-diem-${sanitizedName}-${Date.now()}.xlsx`;
    const encodedFilename = encodeURIComponent(filename);

    res.set({
      'Content-Type':
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"; filename*=UTF-8''${encodedFilename}`,
    });

    res.send(buffer);
  }

  @Get('classrooms/:classroomId/students/:studentId/details')
  @ApiOperation({
    summary: 'Get detailed grade breakdown for a student in a classroom',
  })
  @ResponseMessage('Student grade details fetched successfully')
  async getStudentGradeDetails(
    @Param('classroomId', ParseUUIDPipe) classroomId: string,
    @Param('studentId', ParseUUIDPipe) studentId: string,
  ): Promise<StudentGradeDetailsDto> {
    const user = RequestContext.getValue('user');
    if (!user || !user.sub) {
      throw new ForbiddenException('User not authenticated');
    }

    const classroom = await this.gradebookRepository.getClassroomWithCourse(
      classroomId,
    );
    if (!classroom) {
      throw new NotFoundException(`Classroom ${classroomId} not found`);
    }

    // Role-based access control
    if (user.role === UserRole.student) {
      // Students can only access their own details
      if (user.sub !== studentId) {
        throw new ForbiddenException(
          'You can only access your own grade details',
        );
      }
    } else if (user.role === UserRole.teacher) {
      // Teachers can only access students in their classrooms
      if (classroom.teacherId !== user.sub) {
        throw new ForbiddenException(
          'You can only access grade details for students in your classrooms',
        );
      }
    } else if (user.role !== UserRole.admin) {
      // Only admin, teacher, or student can access
      throw new ForbiddenException(
        'Only admin, teacher, or student can access grade details',
      );
    }

    return this.gradebookService.getStudentGradeDetails(
      studentId,
      classroomId,
    );
  }

  @Get('students/:studentId/classrooms/:classroomId/details')
  @ApiOperation({
    summary: 'Get detailed grade breakdown (student access pattern)',
  })
  @ResponseMessage('Student grade details fetched successfully')
  async getStudentGradeDetailsByStudent(
    @Param('studentId', ParseUUIDPipe) studentId: string,
    @Param('classroomId', ParseUUIDPipe) classroomId: string,
  ): Promise<StudentGradeDetailsDto> {
    // Alias endpoint for student-friendly URL pattern
    return this.getStudentGradeDetails(classroomId, studentId);
  }
}












