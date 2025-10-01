import { GeminiService } from '@app/shared';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AssignmentStatus } from '@prisma/client';
import {
  CreateAssignmentDto,
  GradeAssignmentDto,
  QueryAssignmentsDto,
  SubmitAssignmentDto,
  UpdateAssignmentDto,
} from '../dto';
import { AssignmentActivityDto } from '../dto/create-assignment.dto';
import {
  AssignmentActivityModel,
  AssignmentRepository,
  AssignmentSubmissionWithStudent,
  AssignmentWithDetails,
} from '../repository';

@Injectable()
export class AssignmentService {
  constructor(
    private readonly assignmentRepository: AssignmentRepository,
    private readonly geminiService: GeminiService,
  ) {}

  async createAssignment(
    teacherId: string,
    dto: CreateAssignmentDto,
    classroomId: string,
  ): Promise<AssignmentWithDetails> {
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
      status: dto.isPublished
        ? AssignmentStatus.published
        : AssignmentStatus.draft,
      isPublished: dto.isPublished || false,
      assignedTo: dto.assignedTo || [],
      activities: dto.activities.map((activity, index) =>
        this.mapActivityDto(activity, index),
      ),
      customContent: dto.customContent,
    };

    return this.assignmentRepository.createAssignment(assignmentData);
  }

  async getAssignmentById(
    assignmentId: string,
    includeSubmissions = false,
  ): Promise<AssignmentWithDetails> {
    const assignment = await this.assignmentRepository.findAssignmentById(
      assignmentId,
      includeSubmissions,
    );

    if (!assignment) {
      throw new NotFoundException(
        `Assignment with ID ${assignmentId} not found`,
      );
    }

    return assignment;
  }

  async getAssignmentsByClassroom(
    classroomId: string,
    query: QueryAssignmentsDto,
  ): Promise<{
    assignments: AssignmentWithDetails[];
    total: number;
    page: number;
    limit: number;
  }> {
    const { page = 1, limit = 20 } = query;

    const result = await this.assignmentRepository.findAssignmentsByClassroom(
      classroomId,
      {
        status: query.status as AssignmentStatus,
        page,
        limit,
      },
    );

    return {
      ...result,
      page,
      limit,
    };
  }

  async getAssignmentsByTeacher(
    teacherId: string,
    query: QueryAssignmentsDto,
  ): Promise<{
    assignments: AssignmentWithDetails[];
    total: number;
    page: number;
    limit: number;
  }> {
    const { page = 1, limit = 20 } = query;

    const result = await this.assignmentRepository.findAssignmentsByTeacher(
      teacherId,
      {
        classroomId: query.classroomId,
        status: query.status as AssignmentStatus,
        page,
        limit,
      },
    );

    return {
      ...result,
      page,
      limit,
    };
  }

  async updateAssignment(
    assignmentId: string,
    teacherId: string,
    dto: UpdateAssignmentDto,
  ): Promise<AssignmentWithDetails> {
    const assignment = await this.getAssignmentById(assignmentId);

    // Check if teacher owns this assignment
    if (assignment.teacherId !== teacherId) {
      throw new ForbiddenException('You can only update your own assignments');
    }

    const updateData: any = {
      ...dto,
      dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
    };

    if (dto.activities) {
      updateData.activities = dto.activities.map((activity, index) =>
        this.mapActivityDto(activity, index),
      );
    }

    // If publishing, update status
    if (
      dto.isPublished === true &&
      assignment.status === AssignmentStatus.draft
    ) {
      updateData.status = AssignmentStatus.published;
    } else if (dto.isPublished === false) {
      updateData.status = AssignmentStatus.draft;
    }

    return this.assignmentRepository.updateAssignment(assignmentId, updateData);
  }

  async deleteAssignment(
    assignmentId: string,
    teacherId: string,
  ): Promise<void> {
    const assignment = await this.getAssignmentById(assignmentId);

    // Check if teacher owns this assignment
    if (assignment.teacherId !== teacherId) {
      throw new ForbiddenException('You can only delete your own assignments');
    }

    // Don't allow deletion if there are submissions
    if (assignment._count.submissions > 0) {
      throw new BadRequestException(
        'Cannot delete assignment with existing submissions',
      );
    }

    await this.assignmentRepository.deleteAssignment(assignmentId);
  }

  async publishAssignment(
    assignmentId: string,
    teacherId: string,
  ): Promise<AssignmentWithDetails> {
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
    dto: SubmitAssignmentDto,
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
    if (
      assignment.assignedTo.length > 0 &&
      !assignment.assignedTo.includes(studentId)
    ) {
      throw new ForbiddenException('You are not assigned to this assignment');
    }

    // Check existing submissions and attempt limits
    const existingSubmission =
      await this.assignmentRepository.findSubmissionByAssignmentAndStudent(
        assignmentId,
        studentId,
      );

    let attemptCount = 1;
    if (existingSubmission) {
      attemptCount = existingSubmission.attemptCount + 1;

      if (attemptCount > assignment.maxAttempts) {
        throw new BadRequestException(
          `Maximum attempts (${assignment.maxAttempts}) exceeded`,
        );
      }
    }

    // Calculate score automatically (basic implementation)
    // This would need more sophisticated scoring logic based on activity types
    const score = await this.calculateScore(
      assignment.assignmentActivities,
      dto.answers,
    );

    const submission = await this.assignmentRepository.submitAssignment({
      assignmentId,
      studentId,
      answers: dto.answers,
      timeSpent: dto.timeSpent,
      attemptCount,
    });

    // Auto-grade if scoring is available
    if (score !== null) {
      let feedback = 'Auto-graded submission';

      // Generate AI feedback if score < 90%
      if (score < 90) {
        try {
          const aiResponse = await this.geminiService.generateAttemptFeedback({
            score,
            maxScore: assignment.totalPoints || 100,
            activityType: 'Assignment',
            userAnswers: dto.answers,
            correctAnswers: this.getCorrectAnswers(
              assignment.assignmentActivities,
            ),
            timeSpent: dto.timeSpent,
            assignmentTitle: assignment.title,
            assignmentDescription: assignment.description,
            activities: assignment.assignmentActivities.map(activity => ({
              id: activity.id,
              type: activity.type,
              title: activity.title,
              content: activity.content,
              points: activity.points,
            })),
            maxWords: 100, // Giới hạn feedback trong 100 từ
          });
          feedback = aiResponse;
        } catch (error) {
          console.error('Error generating AI feedback:', error);
          feedback = `Bạn đạt được ${score}% điểm số. Hãy xem lại các câu trả lời để cải thiện kết quả!`;
        }
      } else {
        feedback =
          'Xuất sắc! Bạn đã hoàn thành bài tập với kết quả rất tốt. Tiếp tục phát huy!';
      }

      return this.assignmentRepository.gradeSubmission(submission.id, {
        score,
        feedback,
      });
    }

    return submission;
  }

  async gradeSubmission(
    submissionId: string,
    teacherId: string,
    dto: GradeAssignmentDto,
  ): Promise<AssignmentSubmissionWithStudent> {
    // Should add validation that teacher owns the assignment
    return this.assignmentRepository.gradeSubmission(submissionId, {
      score: dto.score,
      feedback: dto.feedback,
    });
  }

  async getSubmissionsByAssignment(
    assignmentId: string,
    teacherId: string,
  ): Promise<AssignmentSubmissionWithStudent[]> {
    const assignment = await this.getAssignmentById(assignmentId);

    // Check if teacher owns this assignment
    if (assignment.teacherId !== teacherId) {
      throw new ForbiddenException(
        'You can only view submissions for your own assignments',
      );
    }

    return this.assignmentRepository.getSubmissionsByAssignment(assignmentId);
  }

  async getStudentSubmission(
    assignmentId: string,
    studentId: string,
  ): Promise<AssignmentSubmissionWithStudent | null> {
    return this.assignmentRepository.findSubmissionByAssignmentAndStudent(
      assignmentId,
      studentId,
    );
  }

  async getStudentSubmissionHistory(
    assignmentId: string,
    studentId: string,
  ): Promise<AssignmentSubmissionWithStudent[]> {
    return this.assignmentRepository.findAllSubmissionsByAssignmentAndStudent(
      assignmentId,
      studentId,
    );
  }

  // Private helper methods
  private async calculateScore(
    activities: AssignmentActivityModel[],
    answers: any,
  ): Promise<number | null> {
    try {
      let totalPoints = 0;
      let earnedPoints = 0;

      console.log('Calculating score for activities:', activities.length);
      console.log('User answers:', JSON.stringify(answers, null, 2));

      for (const activity of activities) {
        const activityAnswers = answers?.[activity.id];
        const content = activity.content as any;
        const activityPoints = activity.points || 10;

        totalPoints += activityPoints;

        console.log(
          `Processing activity ${activity.id} (${activity.type}) with ${activityPoints} points`,
        );
        console.log('Activity content:', JSON.stringify(content, null, 2));
        console.log(
          'User answer for this activity:',
          JSON.stringify(activityAnswers, null, 2),
        );

        if (!activityAnswers) {
          console.log(`No answer provided for activity ${activity.id}`);
          continue;
        }

        let activityScore = 0;

        switch (activity.type) {
          case 'quiz':
            // Quiz: single question with options
            if (content?.options && typeof content.correctIndex === 'number') {
              if (activityAnswers === content.correctIndex) {
                activityScore = activityPoints;
                console.log(
                  `Quiz correct: user=${activityAnswers}, correct=${content.correctIndex}`,
                );
              } else {
                console.log(
                  `Quiz incorrect: user=${activityAnswers}, correct=${content.correctIndex}`,
                );
              }
            }
            break;

          case 'listening':
            // Handle both old and new listening formats
            if (content?.questions && Array.isArray(content.questions)) {
              // New format: multiple questions
              let correctCount = 0;
              content.questions.forEach((q: any, qIndex: number) => {
                const userAnswer = activityAnswers[qIndex];
                if (
                  typeof userAnswer === 'number' &&
                  userAnswer === q.correctIndex
                ) {
                  correctCount++;
                  console.log(
                    `Listening Q${qIndex} correct: user=${userAnswer}, correct=${q.correctIndex}`,
                  );
                } else {
                  console.log(
                    `Listening Q${qIndex} incorrect: user=${userAnswer}, correct=${q.correctIndex}`,
                  );
                }
              });
              activityScore = Math.round(
                (correctCount / content.questions.length) * activityPoints,
              );
            } else if (
              content?.options &&
              typeof content.correctIndex === 'number'
            ) {
              // Old format: single question
              if (activityAnswers === content.correctIndex) {
                activityScore = activityPoints;
                console.log(
                  `Listening correct: user=${activityAnswers}, correct=${content.correctIndex}`,
                );
              } else {
                console.log(
                  `Listening incorrect: user=${activityAnswers}, correct=${content.correctIndex}`,
                );
              }
            }
            break;

          case 'reading':
            // Reading comprehension: single question with options
            if (content?.options && typeof content.correctIndex === 'number') {
              if (activityAnswers === content.correctIndex) {
                activityScore = activityPoints;
                console.log(
                  `Reading correct: user=${activityAnswers}, correct=${content.correctIndex}`,
                );
              } else {
                console.log(
                  `Reading incorrect: user=${activityAnswers}, correct=${content.correctIndex}`,
                );
              }
            }
            break;

          case 'grammar':
            // Grammar: single question with options
            if (content?.options && typeof content.correctIndex === 'number') {
              if (activityAnswers === content.correctIndex) {
                activityScore = activityPoints;
                console.log(
                  `Grammar correct: user=${activityAnswers}, correct=${content.correctIndex}`,
                );
              } else {
                console.log(
                  `Grammar incorrect: user=${activityAnswers}, correct=${content.correctIndex}`,
                );
              }
            }
            break;

          case 'fill_blank':
            // Fill in the blank - can be single or multiple blanks
            if (
              content?.passage &&
              content?.correctAnswers &&
              Array.isArray(content.correctAnswers)
            ) {
              // Multiple blanks format
              let correctCount = 0;
              if (Array.isArray(activityAnswers)) {
                content.correctAnswers.forEach(
                  (correctAnswer: string, index: number) => {
                    const userAnswer = activityAnswers[index];
                    if (
                      userAnswer &&
                      userAnswer.toLowerCase().trim() ===
                        correctAnswer.toLowerCase().trim()
                    ) {
                      correctCount++;
                      console.log(
                        `Fill blank ${index} correct: user="${userAnswer}", correct="${correctAnswer}"`,
                      );
                    } else {
                      console.log(
                        `Fill blank ${index} incorrect: user="${userAnswer}", correct="${correctAnswer}"`,
                      );
                    }
                  },
                );
                activityScore = Math.round(
                  (correctCount / content.correctAnswers.length) *
                    activityPoints,
                );
              }
            } else if (
              content?.correctAnswer &&
              typeof activityAnswers === 'string'
            ) {
              // Single blank format
              if (
                activityAnswers.toLowerCase().trim() ===
                content.correctAnswer.toLowerCase().trim()
              ) {
                activityScore = activityPoints;
                console.log(
                  `Fill blank correct: user="${activityAnswers}", correct="${content.correctAnswer}"`,
                );
              } else {
                console.log(
                  `Fill blank incorrect: user="${activityAnswers}", correct="${content.correctAnswer}"`,
                );
              }
            }
            break;

          case 'matching':
            // Matching pairs
            if (
              content?.pairs &&
              Array.isArray(content.pairs) &&
              typeof activityAnswers === 'object'
            ) {
              let correctCount = 0;
              content.pairs.forEach((pair: any) => {
                const userMatch = activityAnswers[pair.left];
                if (userMatch === pair.right) {
                  correctCount++;
                  console.log(
                    `Matching correct: "${pair.left}" -> "${pair.right}"`,
                  );
                } else {
                  console.log(
                    `Matching incorrect: "${pair.left}" -> user="${userMatch}", correct="${pair.right}"`,
                  );
                }
              });
              activityScore = Math.round(
                (correctCount / content.pairs.length) * activityPoints,
              );
            }
            break;

          default:
            // For other activity types (writing, speaking, etc.), award full points if attempted
            if (
              activityAnswers !== null &&
              activityAnswers !== undefined &&
              activityAnswers !== ''
            ) {
              activityScore = activityPoints;
              console.log(
                `Activity ${activity.type} attempted, awarded full points`,
              );
            }
            break;
        }

        earnedPoints += activityScore;
        console.log(
          `Activity ${activity.id} scored ${activityScore}/${activityPoints} points`,
        );
      }

      if (totalPoints === 0) {
        console.log(
          'No scorable activities found, returning null for manual grading',
        );
        return null;
      }

      const finalScore = Math.round((earnedPoints / totalPoints) * 100);
      console.log(
        `Final score: ${earnedPoints}/${totalPoints} = ${finalScore}%`,
      );

      return finalScore;
    } catch (error) {
      console.error('Error calculating score:', error);
      return null; // Return null instead of 0 to indicate manual grading needed
    }
  }

  private getCorrectAnswers(activities: AssignmentActivityModel[]): any {
    const correctAnswers: any = {};

    try {
      activities.forEach((activity, activityIndex) => {
        const content = activity.content as any;

        if (activity.type === 'quiz' && content?.questions) {
          const activityAnswers: any = {};
          content.questions.forEach((q: any, qIndex: number) => {
            activityAnswers[`q${qIndex}`] = q.correctAnswer;
          });
          correctAnswers[`activity${activityIndex}`] = activityAnswers;
        } else if (activity.type === 'listening' && content?.questions) {
          const activityAnswers: any = {};
          content.questions.forEach((q: any, qIndex: number) => {
            activityAnswers[qIndex] = q.correctIndex;
          });
          correctAnswers[`activity${activityIndex}`] = activityAnswers;
        } else if (activity.type === 'vocab' && content?.questions) {
          const activityAnswers: any = {};
          content.questions.forEach((q: any, qIndex: number) => {
            activityAnswers[`q${qIndex}`] = q.correctAnswer;
          });
          correctAnswers[`activity${activityIndex}`] = activityAnswers;
        } else if (content?.correctAnswer !== undefined) {
          correctAnswers[`activity${activityIndex}`] = content.correctAnswer;
        }
      });

      return correctAnswers;
    } catch (error) {
      console.error('Error extracting correct answers:', error);
      return {};
    }
  }

  private mapActivityDto(activity: AssignmentActivityDto, index: number) {
    // Extract the actual content from the wrapper format { kind, data }
    let processedContent: any = activity.content;
    if (
      activity.content &&
      typeof activity.content === 'object' &&
      'kind' in activity.content &&
      'data' in activity.content
    ) {
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
    };
  }
}
