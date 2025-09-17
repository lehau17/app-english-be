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
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import {
  CreateAssignmentDto,
  GradeAssignmentDto,
  QueryAssignmentsDto,
  SubmitAssignmentDto,
  UpdateAssignmentDto,
} from '../dto';
import { AssignmentService } from '../service';

@ApiTags('Assignments - Private')
@ApiBearerAuth()
@Controller('private/v1/assignments')
export class PrivateAssignmentController {
  constructor(private readonly assignmentService: AssignmentService) {}

  @Post()
  @ApiOperation({ summary: 'Create new assignment (Teacher only)' })
  @ApiResponse({ status: 201, description: 'Assignment created successfully' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 403, description: 'Forbidden - Teacher access required' })
  async createAssignment(
    @PayloadToken() payload: JwtPayload,
    @Body() dto: CreateAssignmentDto,
  ) {
    return this.assignmentService.createAssignment(payload.sub, dto);
  }

  @Get('my-assignments')
  @ApiOperation({ summary: 'Get assignments created by current teacher' })
  @ApiResponse({ status: 200, description: 'Teacher assignments retrieved successfully' })
  async getMyAssignments(
    @PayloadToken() payload: JwtPayload,
    @Query() query: QueryAssignmentsDto,
  ) {
    return this.assignmentService.getAssignmentsByTeacher(payload.sub, query);
  }

  @Get('classroom/:classroomId')
  @ApiOperation({ summary: 'Get all assignments in a classroom' })
  @ApiResponse({ status: 200, description: 'Classroom assignments retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Classroom not found' })
  async getClassroomAssignments(
    @Param('classroomId') classroomId: string,
    @Query() query: QueryAssignmentsDto,
  ) {
    return this.assignmentService.getAssignmentsByClassroom(classroomId, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get assignment by ID' })
  @ApiResponse({ status: 200, description: 'Assignment retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Assignment not found' })
  async getAssignment(
    @Param('id') assignmentId: string,
    @Query('includeSubmissions') includeSubmissions?: boolean,
  ) {
    return this.assignmentService.getAssignmentById(assignmentId, includeSubmissions);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update assignment (Teacher only)' })
  @ApiResponse({ status: 200, description: 'Assignment updated successfully' })
  @ApiResponse({ status: 404, description: 'Assignment not found' })
  @ApiResponse({ status: 403, description: 'Forbidden - Can only update own assignments' })
  async updateAssignment(
    @Param('id') assignmentId: string,
    @PayloadToken() payload: JwtPayload,
    @Body() dto: UpdateAssignmentDto,
  ) {
    return this.assignmentService.updateAssignment(assignmentId, payload.sub, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete assignment (Teacher only)' })
  @ApiResponse({ status: 200, description: 'Assignment deleted successfully' })
  @ApiResponse({ status: 400, description: 'Cannot delete assignment with submissions' })
  @ApiResponse({ status: 403, description: 'Forbidden - Can only delete own assignments' })
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
  @ApiResponse({ status: 200, description: 'Assignment published successfully' })
  @ApiResponse({ status: 400, description: 'Assignment already published' })
  @ApiResponse({ status: 403, description: 'Forbidden - Can only publish own assignments' })
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
  @ApiResponse({ status: 201, description: 'Assignment submitted successfully' })
  @ApiResponse({ status: 400, description: 'Bad request or deadline passed' })
  @ApiResponse({ status: 403, description: 'Not assigned to this assignment' })
  @ApiResponse({ status: 404, description: 'Assignment not found' })
  async submitAssignment(
    @Param('id') assignmentId: string,
    @PayloadToken() payload: JwtPayload,
    @Body() dto: SubmitAssignmentDto,
  ) {
    return this.assignmentService.submitAssignment(assignmentId, payload.sub, dto);
  }

  @Get(':id/my-submission')
  @ApiOperation({ summary: 'Get current user submission for assignment' })
  @ApiResponse({ status: 200, description: 'Submission retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Submission not found' })
  async getMySubmission(
    @Param('id') assignmentId: string,
    @PayloadToken() payload: JwtPayload,
  ) {
    return this.assignmentService.getStudentSubmission(assignmentId, payload.sub);
  }

  // Teacher grading endpoints
  @Get(':id/submissions')
  @ApiOperation({ summary: 'Get all submissions for assignment (Teacher only)' })
  @ApiResponse({ status: 200, description: 'Submissions retrieved successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden - Can only view own assignment submissions' })
  @ApiResponse({ status: 404, description: 'Assignment not found' })
  async getAssignmentSubmissions(
    @Param('id') assignmentId: string,
    @PayloadToken() payload: JwtPayload,
  ) {
    return this.assignmentService.getSubmissionsByAssignment(assignmentId, payload.sub);
  }

  @Patch('submissions/:submissionId/grade')
  @ApiOperation({ summary: 'Grade a submission (Teacher only)' })
  @ApiResponse({ status: 200, description: 'Submission graded successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden - Can only grade own assignment submissions' })
  @ApiResponse({ status: 404, description: 'Submission not found' })
  async gradeSubmission(
    @Param('submissionId') submissionId: string,
    @PayloadToken() payload: JwtPayload,
    @Body() dto: GradeAssignmentDto,
  ) {
    return this.assignmentService.gradeSubmission(submissionId, payload.sub, dto);
  }
}
