import { JwtPayload, PayloadToken } from '@app/shared';
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiConsumes,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Response } from 'express';
import {
  CreateAssignmentDto,
  GradeAssignmentDto,
  ImportAssignmentDto,
  QueryAssignmentsDto,
  SubmitAssignmentDto,
  UpdateAssignmentDto,
} from '../dto';
import { AssignmentService } from '../service';
import { AssignmentImportService } from '../services/assignment-import.service';
import { AssignmentPdfService } from '../services/assignment-pdf.service';

@ApiTags('Assignments - Private')
@ApiBearerAuth()
@Controller('private/v1/assignments')
export class PrivateAssignmentController {
  constructor(
    private readonly assignmentService: AssignmentService,
    private readonly importService: AssignmentImportService,
    private readonly pdfService: AssignmentPdfService,
  ) {}

  @Get('import/template')
  @ApiOperation({
    summary: 'Download assignment import template (Teacher only)',
  })
  @ApiResponse({
    status: 200,
    description: 'Template downloaded successfully',
    headers: {
      'Content-Type': {
        description:
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      },
      'Content-Disposition': {
        description: 'attachment; filename=assignment-import-template.xlsx',
      },
    },
  })
  async downloadImportTemplate(@Res() res: Response) {
    const buffer = this.importService.generateTemplate();

    res.set({
      'Content-Type':
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition':
        'attachment; filename=assignment-import-template.xlsx',
      'Content-Length': buffer.length.toString(),
    });

    res.send(buffer);
  }

  @Post('import/preview')
  @ApiOperation({
    summary: 'Preview assignment import data (Teacher only)',
  })
  @ApiConsumes('multipart/form-data')
  @ApiResponse({
    status: 200,
    description: 'Import preview generated successfully',
  })
  @ApiResponse({ status: 400, description: 'Invalid file format or data' })
  @UseInterceptors(FileInterceptor('file'))
  async previewImport(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new Error('File is required');
    }

    if (!file.originalname.match(/\.(xlsx|xls)$/)) {
      throw new Error('Only Excel files (.xlsx, .xls) are supported');
    }

    return this.importService.parseImportFile(file.buffer);
  }

  @Post('classroom/:classroomId/import')
  @ApiOperation({
    summary: 'Import assignment from Excel file (Teacher only)',
  })
  @ApiConsumes('multipart/form-data')
  @ApiResponse({
    status: 201,
    description: 'Assignment imported and created successfully',
  })
  @ApiResponse({ status: 400, description: 'Invalid file format or data' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Teacher access required',
  })
  @UseInterceptors(FileInterceptor('file'))
  async importAssignment(
    @PayloadToken() payload: JwtPayload,
    @Param('classroomId') classroomId: string,
    @UploadedFile() file: Express.Multer.File,
    @Body() importDto?: ImportAssignmentDto,
  ) {
    if (!file) {
      throw new Error('File is required');
    }

    if (!file.originalname.match(/\.(xlsx|xls)$/)) {
      throw new Error('Only Excel files (.xlsx, .xls) are supported');
    }

    // Parse the Excel file
    const importResult = await this.importService.parseImportFile(file.buffer);

    if (importResult.errors.length > 0) {
      throw new Error(`Import failed: ${importResult.errors.join(', ')}`);
    }

    // Convert imported data to CreateAssignmentDto
    const createDto: CreateAssignmentDto = {
      title: importResult.assignment.title,
      description: importResult.assignment.description,
      instructions: importResult.assignment.instructions,
      dueDate: importResult.assignment.dueDate,
      totalPoints: importResult.assignment.totalPoints,
      timeLimit: importResult.assignment.timeLimit,
      maxAttempts: importResult.assignment.maxAttempts,
      isPublished: importResult.assignment.isPublished,
      assignedTo: importResult.assignment.assignedTo,
      activities: importResult.activities.map((activity) => ({
        id: `activity-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        type: activity.type as any,
        title: activity.title,
        instructions: activity.instructions,
        content: activity.content,
        points: activity.points,
        timeLimit: activity.timeLimit,
        maxAttempts: activity.maxAttempts,
        passingScore: activity.passingScore,
        difficulty: activity.difficulty as any,
        hints: activity.hints,
      })),
    };

    // Create the assignment
    const result = await this.assignmentService.createAssignment(
      payload.sub,
      createDto,
      classroomId,
    );

    return {
      ...result,
      importSummary: {
        importedActivities: importResult.activities.length,
        warnings: importResult.warnings,
      },
    };
  }

  @Post('classroom/:classroomId')
  @ApiOperation({
    summary: 'Create new assignment in a classroom (Teacher only)',
  })
  @ApiResponse({ status: 201, description: 'Assignment created successfully' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Teacher access required',
  })
  async createAssignment(
    @PayloadToken() payload: JwtPayload,
    @Body() dto: CreateAssignmentDto,
    @Param('classroomId') classroomId: string,
  ) {
    const cid = classroomId || (dto as any)?.classroomId;
    if (!cid) {
      throw new Error('classroomId is required to create assignment');
    }
    return this.assignmentService.createAssignment(payload.sub, dto, cid);
  }

  @Get('my-assignments')
  @ApiOperation({ summary: 'Get assignments created by current teacher' })
  @ApiResponse({
    status: 200,
    description: 'Teacher assignments retrieved successfully',
  })
  async getMyAssignments(
    @PayloadToken() payload: JwtPayload,
    @Query() query: QueryAssignmentsDto,
  ) {
    return this.assignmentService.getAssignmentsByTeacher(payload.sub, query);
  }

  @Get('classroom/:classroomId')
  @ApiOperation({ summary: 'Get all assignments in a classroom' })
  @ApiResponse({
    status: 200,
    description: 'Classroom assignments retrieved successfully',
  })
  @ApiResponse({ status: 404, description: 'Classroom not found' })
  async getClassroomAssignments(
    @Param('classroomId') classroomId: string,
    @Query() query: QueryAssignmentsDto,
  ) {
    return this.assignmentService.getAssignmentsByClassroom(classroomId, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get assignment by ID' })
  @ApiResponse({
    status: 200,
    description: 'Assignment retrieved successfully',
  })
  @ApiResponse({ status: 404, description: 'Assignment not found' })
  async getAssignment(
    @Param('id') assignmentId: string,
    @Query('includeSubmissions') includeSubmissions?: boolean,
  ) {
    return this.assignmentService.getAssignmentById(
      assignmentId,
      includeSubmissions,
    );
  }

  @Get(':id/pdf')
  @ApiOperation({ summary: 'Download assignment as PDF (Teacher only)' })
  @ApiResponse({
    status: 200,
    description: 'PDF downloaded successfully',
    headers: {
      'Content-Type': {
        description: 'application/pdf',
      },
      'Content-Disposition': {
        description: 'attachment; filename=assignment.pdf',
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Assignment not found' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Can only download own assignments',
  })
  async downloadAssignmentPdf(
    @Param('id') assignmentId: string,
    @PayloadToken() payload: JwtPayload,
    @Res() res: Response,
  ) {
    // Get assignment with full details
    const assignment = await this.assignmentService.getAssignmentById(
      assignmentId,
      false,
    );



    try {
      // Generate PDF
      const pdfBuffer = await this.pdfService.generateAssignmentPdf(assignment);

      // Set response headers
      res.set({
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename=assignment-${assignment.title.replace(/[^a-zA-Z0-9]/g, '-')}.pdf`,
        'Content-Length': pdfBuffer.length.toString(),
      });

      res.send(pdfBuffer);
    } catch (error) {
      console.error('Error generating PDF:', error);
      res.status(500).json({
        statusCode: 500,
        message: 'Error generating PDF',
      });
    }
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update assignment (Teacher only)' })
  @ApiResponse({ status: 200, description: 'Assignment updated successfully' })
  @ApiResponse({ status: 404, description: 'Assignment not found' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Can only update own assignments',
  })
  async updateAssignment(
    @Param('id') assignmentId: string,
    @PayloadToken() payload: JwtPayload,
    @Body() dto: UpdateAssignmentDto,
  ) {
    return this.assignmentService.updateAssignment(
      assignmentId,
      payload.sub,
      dto,
    );
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete assignment (Teacher only)' })
  @ApiResponse({ status: 200, description: 'Assignment deleted successfully' })
  @ApiResponse({
    status: 400,
    description: 'Cannot delete assignment with submissions',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Can only delete own assignments',
  })
  @ApiResponse({ status: 404, description: 'Assignment not found' })
  async deleteAssignment(
    @Param('id') assignmentId: string,
    @PayloadToken() payload: JwtPayload,
  ) {
    await this.assignmentService.deleteAssignment(assignmentId, payload.sub);
    return { message: 'Assignment deleted successfully' };
  }

  @Patch(':id/publish')
  @ApiOperation({ summary: 'Publish assignment (Teacher only)' })
  @ApiResponse({
    status: 200,
    description: 'Assignment published successfully',
  })
  @ApiResponse({ status: 400, description: 'Assignment already published' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Can only publish own assignments',
  })
  @ApiResponse({ status: 404, description: 'Assignment not found' })
  async publishAssignment(
    @Param('id') assignmentId: string,
    @PayloadToken() payload: JwtPayload,
  ) {
    return this.assignmentService.publishAssignment(assignmentId, payload.sub);
  }

  // Student endpoints
  @Post(':id/submit')
  @ApiOperation({ summary: 'Submit assignment (Student only)' })
  @ApiResponse({
    status: 201,
    description: 'Assignment submitted successfully',
  })
  @ApiResponse({ status: 400, description: 'Bad request or deadline passed' })
  @ApiResponse({ status: 403, description: 'Not assigned to this assignment' })
  @ApiResponse({ status: 404, description: 'Assignment not found' })
  async submitAssignment(
    @Param('id') assignmentId: string,
    @PayloadToken() payload: JwtPayload,
    @Body() dto: SubmitAssignmentDto,
  ) {
    return this.assignmentService.submitAssignment(
      assignmentId,
      payload.sub,
      dto,
    );
  }

  @Get(':id/my-submission')
  @ApiOperation({ summary: 'Get current user submission for assignment' })
  @ApiResponse({
    status: 200,
    description: 'Submission retrieved successfully',
  })
  @ApiResponse({ status: 404, description: 'Submission not found' })
  async getMySubmission(
    @Param('id') assignmentId: string,
    @PayloadToken() payload: JwtPayload,
  ) {
    return this.assignmentService.getStudentSubmission(
      assignmentId,
      payload.sub,
    );
  }

  @Get(':id/my-submission-history')
  @ApiOperation({ summary: 'Get all submission history for current user' })
  @ApiResponse({
    status: 200,
    description: 'Submission history retrieved successfully',
  })
  @ApiResponse({ status: 404, description: 'No submissions found' })
  async getMySubmissionHistory(
    @Param('id') assignmentId: string,
    @PayloadToken() payload: JwtPayload,
  ) {
    return this.assignmentService.getStudentSubmissionHistory(
      assignmentId,
      payload.sub,
    );
  }

  // Teacher grading endpoints
  @Get(':id/submissions')
  @ApiOperation({
    summary: 'Get all submissions for assignment (Teacher only)',
  })
  @ApiResponse({
    status: 200,
    description: 'Submissions retrieved successfully',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Can only view own assignment submissions',
  })
  @ApiResponse({ status: 404, description: 'Assignment not found' })
  async getAssignmentSubmissions(
    @Param('id') assignmentId: string,
    @PayloadToken() payload: JwtPayload,
  ) {
    return this.assignmentService.getSubmissionsByAssignment(
      assignmentId,
      payload.sub,
    );
  }

  @Patch('submissions/:submissionId/grade')
  @ApiOperation({ summary: 'Grade a submission (Teacher only)' })
  @ApiResponse({ status: 200, description: 'Submission graded successfully' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Can only grade own assignment submissions',
  })
  @ApiResponse({ status: 404, description: 'Submission not found' })
  async gradeSubmission(
    @Param('submissionId') submissionId: string,
    @PayloadToken() payload: JwtPayload,
    @Body() dto: GradeAssignmentDto,
  ) {
    return this.assignmentService.gradeSubmission(
      submissionId,
      payload.sub,
      dto,
    );
  }
}
