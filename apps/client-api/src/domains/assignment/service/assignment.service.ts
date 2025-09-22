import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { AssignmentStatus } from '@prisma/client';
import { CreateAssignmentDto, GradeAssignmentDto, QueryAssignmentsDto, SubmitAssignmentDto, UpdateAssignmentDto } from '../dto';
import { AssignmentActivityDto } from '../dto/create-assignment.dto';
import { AssignmentActivityModel, AssignmentRepository, AssignmentSubmissionWithStudent, AssignmentWithDetails } from '../repository';

@Injectable()
export class AssignmentService {
  constructor(private readonly assignmentRepository: AssignmentRepository) {}

  async createAssignment(teacherId: string, dto: CreateAssignmentDto, classroomId: string): Promise<AssignmentWithDetails> {
    // Validate classroom belongs to teacher - should add this check
    const assignmentData = {
      teacherId,
      classroomId: classroomId,
      title: dto.title,
      description: dto.description,
      instructions: dto.instructions,
      dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
      totalPoints: dto.totalPoints || 100,
      timeLimit: dto.timeLimit,
      maxAttempts: dto.maxAttempts || 1,
      status: dto.isPublished ? AssignmentStatus.published : AssignmentStatus.draft,
      isPublished: dto.isPublished || false,
      assignedTo: dto.assignedTo || [],
      activities: dto.activities.map((activity, index) => this.mapActivityDto(activity, index)),
      customContent: dto.customContent,
    };

    return this.assignmentRepository.createAssignment(assignmentData);
  }

  async getAssignmentById(assignmentId: string, includeSubmissions = false): Promise<AssignmentWithDetails> {
    const assignment = await this.assignmentRepository.findAssignmentById(assignmentId, includeSubmissions);

    if (!assignment) {
      throw new NotFoundException(`Assignment with ID ${assignmentId} not found`);
    }

    return assignment;
  }

  async getAssignmentsByClassroom(
    classroomId: string,
    query: QueryAssignmentsDto
  ): Promise<{ assignments: AssignmentWithDetails[]; total: number; page: number; limit: number }> {
    const { page = 1, limit = 20 } = query;

    const result = await this.assignmentRepository.findAssignmentsByClassroom(classroomId, {
      status: query.status as AssignmentStatus,
      page,
      limit,
    });

    return {
      ...result,
      page,
      limit,
    };
  }

  async getAssignmentsByTeacher(
    teacherId: string,
    query: QueryAssignmentsDto
  ): Promise<{ assignments: AssignmentWithDetails[]; total: number; page: number; limit: number }> {
    const { page = 1, limit = 20 } = query;

    const result = await this.assignmentRepository.findAssignmentsByTeacher(teacherId, {
      classroomId: query.classroomId,
      status: query.status as AssignmentStatus,
      page,
      limit,
    });

    return {
      ...result,
      page,
      limit,
    };
  }

  async updateAssignment(
    assignmentId: string,
    teacherId: string,
    dto: UpdateAssignmentDto
  ): Promise<AssignmentWithDetails> {
    const assignment = await this.getAssignmentById(assignmentId);

    // Check if teacher owns this assignment
    if (assignment.teacherId !== teacherId) {
      throw new ForbiddenException('You can only update your own assignments');
    }

    const updateData : any = {
      ...dto,
      dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
    };

    if (dto.activities) {
      updateData.activities = dto.activities.map((activity, index) =>
        this.mapActivityDto(activity, index)
      )
    }

    // If publishing, update status
    if (dto.isPublished === true && assignment.status === AssignmentStatus.draft) {
      updateData.status = AssignmentStatus.published;
    } else if (dto.isPublished === false) {
      updateData.status = AssignmentStatus.draft;
    }

    return this.assignmentRepository.updateAssignment(assignmentId, updateData);
  }

  async deleteAssignment(assignmentId: string, teacherId: string): Promise<void> {
    const assignment = await this.getAssignmentById(assignmentId);

    // Check if teacher owns this assignment
    if (assignment.teacherId !== teacherId) {
      throw new ForbiddenException('You can only delete your own assignments');
    }

    // Don't allow deletion if there are submissions
    if (assignment._count.submissions > 0) {
      throw new BadRequestException('Cannot delete assignment with existing submissions');
    }

    await this.assignmentRepository.deleteAssignment(assignmentId);
  }

  async publishAssignment(assignmentId: string, teacherId: string): Promise<AssignmentWithDetails> {
    const assignment = await this.getAssignmentById(assignmentId);

    // Check if teacher owns this assignment
    if (assignment.teacherId !== teacherId) {
      throw new ForbiddenException('You can only publish your own assignments');
    }

    if (assignment.isPublished) {
      throw new BadRequestException('Assignment is already published');
    }

    return this.assignmentRepository.publishAssignment(assignmentId);
  }

  // Student methods
  async submitAssignment(
    assignmentId: string,
    studentId: string,
    dto: SubmitAssignmentDto
  ): Promise<AssignmentSubmissionWithStudent> {
    const assignment = await this.getAssignmentById(assignmentId);

    if (!assignment.isPublished) {
      throw new BadRequestException('Assignment is not published yet');
    }

    // Check due date
    if (assignment.dueDate && new Date() > assignment.dueDate) {
      throw new BadRequestException('Assignment deadline has passed');
    }

    // Check if student is assigned to this assignment
    if (assignment.assignedTo.length > 0 && !assignment.assignedTo.includes(studentId)) {
      throw new ForbiddenException('You are not assigned to this assignment');
    }

    // Check existing submissions and attempt limits
    const existingSubmission = await this.assignmentRepository.findSubmissionByAssignmentAndStudent(
      assignmentId,
      studentId
    );

    let attemptCount = 1;
    if (existingSubmission) {
      attemptCount = existingSubmission.attemptCount + 1;

      if (attemptCount > assignment.maxAttempts) {
        throw new BadRequestException(`Maximum attempts (${assignment.maxAttempts}) exceeded`);
      }
    }

    // Calculate score automatically (basic implementation)
    // This would need more sophisticated scoring logic based on activity types
    const score = await this.calculateScore(assignment.assignmentActivities, dto.answers);

    const submission = await this.assignmentRepository.submitAssignment({
      assignmentId,
      studentId,
      answers: dto.answers,
      timeSpent: dto.timeSpent,
      attemptCount,
    });

    // Auto-grade if scoring is available
    if (score !== null) {
      return this.assignmentRepository.gradeSubmission(submission.id, {
        score,
        feedback: 'Auto-graded submission',
      });
    }

    return submission;
  }

  async gradeSubmission(
    submissionId: string,
    teacherId: string,
    dto: GradeAssignmentDto
  ): Promise<AssignmentSubmissionWithStudent> {
    // Should add validation that teacher owns the assignment
    return this.assignmentRepository.gradeSubmission(submissionId, {
      score: dto.score,
      feedback: dto.feedback,
    });
  }

  async getSubmissionsByAssignment(
    assignmentId: string,
    teacherId: string
  ): Promise<AssignmentSubmissionWithStudent[]> {
    const assignment = await this.getAssignmentById(assignmentId);

    // Check if teacher owns this assignment
    if (assignment.teacherId !== teacherId) {
      throw new ForbiddenException('You can only view submissions for your own assignments');
    }

    return this.assignmentRepository.getSubmissionsByAssignment(assignmentId);
  }

  async getStudentSubmission(
    assignmentId: string,
    studentId: string
  ): Promise<AssignmentSubmissionWithStudent | null> {
    return this.assignmentRepository.findSubmissionByAssignmentAndStudent(assignmentId, studentId);
  }

  // Private helper methods
  private async calculateScore(activities: AssignmentActivityModel[], answers: any): Promise<number | null> {
    // Basic implementation - would need more sophisticated logic
    // For now, return null to indicate manual grading needed
    try {
      let totalQuestions = 0;
      let correctAnswers = 0;

      // This is a simplified calculation
      // Real implementation would depend on activity types and content structure
      for (const activity of activities) {
        const activityAnswers = answers?.[activity.id];
        if (!activityAnswers) continue;

        // Example for fill_blank type
        const content = activity.content as any;

        if (activity.type === 'fill_blank' && content?.questions) {
          const questions = content.questions;
          totalQuestions += questions.length;

          questions.forEach((q: any, index: number) => {
            const userAnswer = activityAnswers[`q${index}`];
            if (userAnswer && userAnswer.toLowerCase().trim() === q.correctAnswer.toLowerCase().trim()) {
              correctAnswers++;
            }
          });
        }

        // Example for quiz type
        if (activity.type === 'quiz' && content?.questions) {
          const questions = content.questions;
          totalQuestions += questions.length;

          questions.forEach((q: any, index: number) => {
            const userAnswer = activityAnswers[`q${index}`];
            if (userAnswer === q.correctAnswer) {
              correctAnswers++;
            }
          });
        }
      }

      if (totalQuestions === 0) return null;

      return Math.round((correctAnswers / totalQuestions) * 100);
    } catch (error) {
      console.error('Error calculating score:', error);
      return null; // Fall back to manual grading
    }
  }

  private mapActivityDto(activity: AssignmentActivityDto, index: number) {
    // Extract the actual content from the wrapper format { kind, data }
    let processedContent:any = activity.content;
    if (activity.content && typeof activity.content === 'object' && 'kind' in activity.content && 'data' in activity.content) {
      // If content is wrapped in { kind, data } format, extract the data
      processedContent = activity.content.data || activity.content;
    }

    return {
      id: activity.id || `activity-${index + 1}`,
      type: activity.type,
      title: activity.title,
      instructions: activity.instructions,
      content: processedContent,
      points: activity.points ?? 10,
      timeLimit: activity.timeLimit,
      maxAttempts: activity.maxAttempts,
      passingScore: activity.passingScore,
      difficulty: activity.difficulty,
      hints: activity.hints ?? [],
    }
  }
}
