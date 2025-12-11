
import { extractMediaFromActivity, GeminiService } from '@app/shared';
import { AutoCertificateIssuerService } from '@app/shared/certificate';
import {
    BadRequestException,
    ForbiddenException,
    forwardRef,
    Inject,
    Injectable,
    Logger,
    NotFoundException,
} from '@nestjs/common';
import { AssignmentStatus, AssignmentType } from '@prisma/client';
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';
import { EventsGateway } from '../../../events/events.gateway';
import { EvaluationService } from '../../evaluation/service/evaluation.service';
import { GradebookService } from '../../gradebook/service';
import { MediaService } from '../../media/service/media.service';
import {
    CloneAssignmentDto,
    CreateAssignmentDto,
    GradeAssignmentDto,
    QueryAssignmentsDto,
    QueryBankActivitiesDto,
    QueryBankAssignmentsDto,
    SubmitAssignmentDto,
    UpdateAssignmentDto,
} from '../dto';
import { AssignmentActivityDto } from '../dto/create-assignment.dto';
import {
    AssignmentActivityModel,
    AssignmentRepository,
    AssignmentSubmissionWithStudent,
    AssignmentWithDetails,
    BankActivityWithAssignment,
} from '../repository';

@Injectable()
export class AssignmentService {
  private readonly logger = new Logger(AssignmentService.name);

  constructor(
    private readonly assignmentRepository: AssignmentRepository,
    private readonly geminiService: GeminiService,
    private readonly evaluationService: EvaluationService,
    private readonly eventsGateway: EventsGateway,
    private readonly gradebookService?: GradebookService,
    @Inject(forwardRef(() => AutoCertificateIssuerService))
    private readonly autoCertificateIssuer?: AutoCertificateIssuerService,
    private readonly mediaService?: MediaService,
  ) {}

  async createAssignment(
    teacherId: string,
    dto: CreateAssignmentDto,
    classroomId: string,
  ): Promise<AssignmentWithDetails> {
    // Validate classroom belongs to teacher - should add this check

    // Validate startTime < dueDate
    if (dto.startTime && dto.dueDate) {
      const startTime = new Date(dto.startTime);
      const dueDate = new Date(dto.dueDate);
      if (startTime >= dueDate) {
        throw new BadRequestException(
          'Start time must be before due date',
        );
      }
    }

    const assignmentData = {
      teacherId,
      classroomId: classroomId,
      title: dto.title,
      description: dto.description,
      instructions: dto.instructions,
      startTime: dto.startTime ? new Date(dto.startTime) : undefined,
      dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
      totalPoints: 100, // Fixed at 100, not user input
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
      type: dto.type ?? AssignmentType.HOMEWORK,
      weight: dto.weight ?? 0,
    };

    const assignment = await this.assignmentRepository.createAssignment(assignmentData);

    // Extract media from activities and create MediaFile records (async, non-blocking)
    if (this.mediaService && assignment.assignmentActivities) {
      this.extractMediaFromAssignmentActivities(assignment, dto.activities).catch(
        (error) => {
          this.logger.error(
            `Failed to extract media from assignment ${assignment.id}: ${error.message}`,
            error,
          );
        },
      );
    }

    return assignment;
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

  async getBankAssignments(
    query: QueryBankAssignmentsDto,
  ): Promise<{
    assignments: AssignmentWithDetails[];
    total: number;
    page: number;
    limit: number;
  }> {
    const { page = 1, limit = 20 } = query;

    const result = await this.assignmentRepository.findBankAssignments({
      teacherId: query.teacherId,
      activityType: query.activityType,
      difficulty: query.difficulty,
      search: query.search,
      page,
      limit,
    });

    return {
      ...result,
      page,
      limit,
    };
  }

  async getBankActivities(
    query: QueryBankActivitiesDto,
  ): Promise<{
    activities: BankActivityWithAssignment[];
    total: number;
    page: number;
    limit: number;
  }> {
    const { page = 1, limit = 20 } = query;

    const result = await this.assignmentRepository.findBankActivities({
      type: query.type,
      difficulty: query.difficulty,
      teacherId: query.teacherId,
      search: query.search,
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
    dto: UpdateAssignmentDto,
  ): Promise<AssignmentWithDetails> {
    const assignment = await this.getAssignmentById(assignmentId);

    // Check if teacher owns this assignment
    if (assignment.teacherId !== teacherId) {
      throw new ForbiddenException('You can only update your own assignments');
    }

    // Check if assignment has started (cannot edit after startTime)
    if (assignment.startTime) {
      const now = new Date();
      const startTime = new Date(assignment.startTime);
      if (now >= startTime) {
        throw new BadRequestException(
          'Cannot edit assignment after start time has passed',
        );
      }
    }

    // Validate startTime < dueDate
    if (dto.startTime && dto.dueDate) {
      const startTime = new Date(dto.startTime);
      const dueDate = new Date(dto.dueDate);
      if (startTime >= dueDate) {
        throw new BadRequestException(
          'Start time must be before due date',
        );
      }
    }

    const updateData: any = {
      ...dto,
      startTime: dto.startTime ? new Date(dto.startTime) : undefined,
      dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
      totalPoints: 100, // Fixed at 100, not user input
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

  async cloneAssignment(
    teacherId: string,
    assignmentId: string,
    dto: CloneAssignmentDto,
  ): Promise<AssignmentWithDetails> {
    const source = await this.getAssignmentById(assignmentId);

    if (source.teacherId !== teacherId) {
      throw new ForbiddenException(
        'You can only clone assignments that you created',
      );
    }

    const activities = source.assignmentActivities || [];
    if (activities.length === 0) {
      throw new BadRequestException(
        'Source assignment does not contain any activities to clone',
      );
    }

    let selectedActivities = activities;
    if (dto.activityIds && dto.activityIds.length > 0) {
      const allowedIds = new Set(dto.activityIds);
      selectedActivities = activities.filter((activity) =>
        allowedIds.has(activity.id),
      );
    }

    if (selectedActivities.length === 0) {
      throw new BadRequestException(
        'Please select at least one activity to clone',
      );
    }

    const clonedActivities = selectedActivities.map((activity) => ({
      id: uuidv4(),
      type: activity.type,
      title: activity.title,
      instructions: activity.instructions ?? undefined,
      content: JSON.parse(JSON.stringify(activity.content ?? {})),
      points: activity.points ?? 10,
      passingScore: activity.passingScore ?? undefined,
      difficulty: activity.difficulty ?? undefined,
      hints: activity.hints ?? [],
    }));

    // Use cloned activities as-is (no normalization)
    const finalActivities = clonedActivities;

    const dueDate =
      dto.dueDate !== undefined
        ? dto.dueDate
          ? new Date(dto.dueDate)
          : undefined
        : (source.dueDate ?? undefined);

    const isPublished = dto.isPublished ?? false;

    return this.assignmentRepository.createAssignment({
      teacherId,
      classroomId: dto.targetClassroomId,
      title: dto.title ?? source.title,
      description: dto.description ?? source.description ?? undefined,
      instructions: dto.instructions ?? source.instructions ?? undefined,
      dueDate,
      totalPoints: 100, // Fixed at 100, not user input
      timeLimit: dto.timeLimit ?? source.timeLimit ?? undefined,
      maxAttempts: dto.maxAttempts ?? source.maxAttempts ?? 1,
      status: isPublished ? AssignmentStatus.published : AssignmentStatus.draft,
      isPublished,
      assignedTo: [],
      activities: finalActivities,
      customContent: dto.customContent ?? source.customContent ?? undefined,
      weight: dto.weight ?? source.weight ?? 0,
      type: source.type,
    });
  }

  // Student methods
  async submitAssignment(
    assignmentId: string,
    studentId: string,
    dto: SubmitAssignmentDto,
  ) {
    const assignment = await this.getAssignmentById(assignmentId);

    if (!assignment.isPublished) {
      throw new BadRequestException('Assignment is not published yet');
    }

    const now = new Date();

    // Check start time
    if (assignment.startTime && now < assignment.startTime) {
      throw new BadRequestException('Assignment has not started yet');
    }

    // Check due date
    if (assignment.dueDate && now > assignment.dueDate) {
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
            activities: assignment.assignmentActivities.map((activity) => ({
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

      const graded = await this.assignmentRepository.gradeSubmission(submission.id, {
        score,
        feedback,
      });

      // Invalidate gradebook cache
      if (this.gradebookService) {
        await this.gradebookService.invalidateCache(studentId, assignment.classroomId).catch((err) => {
          this.logger.warn(`Failed to invalidate gradebook cache: ${err.message}`);
        });
      }

      // Check course completion and trigger certificate issuance (async, non-blocking)
      if (assignment.classroomId) {
        this.checkCourseCompletionForCertificate(
          studentId,
          assignment.classroomId,
        ).catch((error) => {
          this.logger.warn(
            `Failed to check course completion for certificate: ${error.message}`,
          );
        });
      }

      return graded;
    }

    return submission;
  }

  async gradeSubmission(
    submissionId: string,
    teacherId: string,
    dto: GradeAssignmentDto,
  ) {
    // Should add validation that teacher owns the assignment
    const submission = await this.assignmentRepository.gradeSubmission(submissionId, {
      score: dto.score,
      feedback: dto.feedback,
    });

    // Invalidate gradebook cache
    if (this.gradebookService && submission.assignment?.classroomId) {
      await this.gradebookService.invalidateCache(
        submission.studentId,
        submission.assignment.classroomId,
      ).catch((err) => {
        this.logger.warn(`Failed to invalidate gradebook cache: ${err.message}`);
      });
    }

    // Check course completion and trigger certificate issuance (async, non-blocking)
    if (submission.assignment?.classroomId) {
      this.checkCourseCompletionForCertificate(
        submission.studentId,
        submission.assignment.classroomId,
      ).catch((error) => {
        this.logger.warn(
          `Failed to check course completion for certificate: ${error.message}`,
        );
      });
    }

    return submission;
  }

  async getSubmissionsByAssignment(
    assignmentId: string,
    teacherId: string,
  ): Promise<AssignmentSubmissionWithStudent[]> {
    const assignment = await this.getAssignmentById(assignmentId);

    // Check if user is admin
    const user = await this.assignmentRepository.findTeacherById(teacherId);
    const isAdmin = user?.role === 'admin';

    // Allow access for admin or teacher who owns the assignment
    if (!isAdmin && assignment.teacherId !== teacherId) {
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
            // Handle both single question and multiple questions formats
            if (content?.questions && Array.isArray(content.questions)) {
              // Multiple questions format (AI-generated)
              let correctCount = 0;
              content.questions.forEach((q: any, qIndex: number) => {
                const userAnswer = activityAnswers?.[qIndex];
                if (typeof userAnswer === 'number' && userAnswer === q.correctIndex) {
                  correctCount++;
                  console.log(`Quiz Q${qIndex} correct: user=${userAnswer}, correct=${q.correctIndex}`);
                } else {
                  console.log(`Quiz Q${qIndex} incorrect: user=${userAnswer}, correct=${q.correctIndex}`);
                }
              });
              activityScore = Math.round((correctCount / content.questions.length) * activityPoints);
            } else if (content?.options && typeof content.correctIndex === 'number') {
              // Single question format (legacy)
              if (activityAnswers === content.correctIndex) {
                activityScore = activityPoints;
                console.log(`Quiz correct: user=${activityAnswers}, correct=${content.correctIndex}`);
              } else {
                console.log(`Quiz incorrect: user=${activityAnswers}, correct=${content.correctIndex}`);
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
            // Handle both old and new reading formats
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
                    `Reading Q${qIndex} correct: user=${userAnswer}, correct=${q.correctIndex}`,
                  );
                } else {
                  console.log(
                    `Reading Q${qIndex} incorrect: user=${userAnswer}, correct=${q.correctIndex}`,
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
            // Handle both single question and multiple questions formats
            if (content?.questions && Array.isArray(content.questions)) {
              // Multiple questions format (AI-generated)
              let correctCount = 0;
              content.questions.forEach((q: any, qIndex: number) => {
                const userAnswer = activityAnswers?.[qIndex];
                if (typeof userAnswer === 'number' && userAnswer === q.correctIndex) {
                  correctCount++;
                  console.log(`Grammar Q${qIndex} correct: user=${userAnswer}, correct=${q.correctIndex}`);
                } else {
                  console.log(`Grammar Q${qIndex} incorrect: user=${userAnswer}, correct=${q.correctIndex}`);
                }
              });
              activityScore = Math.round((correctCount / content.questions.length) * activityPoints);
            } else if (content?.exercises && Array.isArray(content.exercises)) {
              // Exercises format with rule
              let correctCount = 0;
              content.exercises.forEach((ex: any, exIndex: number) => {
                const userAnswer = activityAnswers?.[exIndex];
                if (typeof userAnswer === 'number' && userAnswer === ex.correctIndex) {
                  correctCount++;
                }
              });
              activityScore = Math.round((correctCount / content.exercises.length) * activityPoints);
            } else if (content?.options && typeof content.correctIndex === 'number') {
              // Single question format (legacy)
              if (activityAnswers === content.correctIndex) {
                activityScore = activityPoints;
                console.log(`Grammar correct: user=${activityAnswers}, correct=${content.correctIndex}`);
              } else {
                console.log(`Grammar incorrect: user=${activityAnswers}, correct=${content.correctIndex}`);
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
            // Matching - support both pairs format and leftItems/rightItems format
            if (typeof activityAnswers === 'object') {
              let correctCount = 0;
              let totalPairs = 0;

              if (content?.pairs && Array.isArray(content.pairs)) {
                // Format 1: pairs array with index-based answers
                // activityAnswers: { 0: 0, 1: 2, 2: 1 } (leftIndex -> rightIndex)
                totalPairs = content.pairs.length;
                content.pairs.forEach((pair: any, pairIndex: number) => {
                  const userRightIndex = activityAnswers[pairIndex];
                  // Correct when user matches leftIndex to rightIndex (which should be same for correct pair)
                  if (typeof userRightIndex === 'number' && userRightIndex === pairIndex) {
                    correctCount++;
                    console.log(
                      `Matching correct (pairs format): "${pair.left}" -> "${pair.right}"`,
                    );
                  } else {
                    console.log(
                      `Matching incorrect (pairs format): "${pair.left}" -> user selected index ${userRightIndex}, correct index is ${pairIndex}`,
                    );
                  }
                });
              } else if (content?.leftItems && content?.rightItems) {
                // Format 2: leftItems/rightItems arrays
                // activityAnswers: { 0: 0, 1: 1, 2: 2 } (leftIndex -> rightIndex)
                // Correct answer: leftItems[i] matches rightItems[i]
                totalPairs = content.leftItems.length;
                content.leftItems.forEach((leftItem: string, leftIndex: number) => {
                  const userRightIndex = activityAnswers[leftIndex];
                  // Correct when user matches leftIndex to the same rightIndex
                  if (typeof userRightIndex === 'number' && userRightIndex === leftIndex) {
                    correctCount++;
                    console.log(
                      `Matching correct (leftItems/rightItems format): "${leftItem}" -> "${content.rightItems[leftIndex]}"`,
                    );
                  } else {
                    const userAnswer = userRightIndex !== undefined ? content.rightItems[userRightIndex] : 'none';
                    console.log(
                      `Matching incorrect: "${leftItem}" -> user="${userAnswer}", correct="${content.rightItems[leftIndex]}"`,
                    );
                  }
                });
              }

              if (totalPairs > 0) {
                activityScore = Math.round(
                  (correctCount / totalPairs) * activityPoints,
                );
              }
            }
            break;

          case 'speaking':
            // Frontend submits: { audioUrl: string }
            if (activityAnswers?.audioUrl) {
              try {
                const audioBase64 = await this.downloadAudioAsBase64(activityAnswers.audioUrl);
                const result = await this.evaluationService.evaluateSpeaking('system', {
                  audioBase64,
                  mimeType: 'audio/webm',
                  prompt: content?.prompt,
                  minSeconds: content?.minSeconds,
                });
                activityScore = Math.round((result.score / 100) * activityPoints);
                console.log(`Speaking: AI score ${result.score}/100 → ${activityScore}/${activityPoints}`);
              } catch (error) {
                console.error('Speaking evaluation failed:', error);
                activityScore = Math.round(activityPoints * 0.5);
              }
            }
            break;

          case 'writing':
            // Frontend submits: { text: string } or string directly
            const writingText = activityAnswers?.text || (typeof activityAnswers === 'string' ? activityAnswers : null);
            if (writingText && writingText.trim().length > 0) {
              try {
                const result = await this.evaluationService.evaluateWriting('system', {
                  submission: writingText,
                  prompt: content?.prompt,
                  minWords: content?.minWords,
                });
                activityScore = Math.round((result.score / 100) * activityPoints);
                console.log(`Writing: AI score ${result.score}/100 → ${activityScore}/${activityPoints}`);
              } catch (error) {
                console.error('Writing evaluation failed:', error);
                activityScore = Math.round(activityPoints * 0.5);
              }
            }
            break;

          case 'pronunciation':
            // Frontend submits: { [index]: "audioUrl" }
            // Example: { "0": "http://...", "2": "http://..." }
            const phases = content?.phrases || [];
            let totalPronunciationScore = 0;

            if (typeof activityAnswers === 'object' && activityAnswers !== null) {
              const phraseDetails = []; // To store details for the attempt

              for (let i = 0; i < phases.length; i++) {
                const audioUrl = activityAnswers[i];
                if (audioUrl && typeof audioUrl === 'string') {
                  try {
                    const audioBase64 = await this.downloadAudioAsBase64(audioUrl);
                    const targetPhrase = phases[i]?.text || '';

                    const result = await this.evaluationService.evaluatePronunciation('system', {
                      audioBase64,
                      mimeType: 'audio/webm',
                      phrase: targetPhrase,
                    });

                    totalPronunciationScore += result.score;
                    console.log(`Pronunciation phrase ${i}: ${result.score}/100`);

                    // Store detail (optional, if we want to return per-phrase feedback)
                    phraseDetails.push({
                      index: i,
                      phrase: targetPhrase,
                      score: result.score,
                      feedback: result.feedback
                    });
                  } catch (error) {
                    console.error(`Pronunciation evaluation failed for phrase ${i}:`, error);
                  }
                }
              }

              // Score = (Sum of scores) / (Total phrases) * ActivityPoints
              // Unsubmitted phrases count as 0
              if (phases.length > 0) {
                activityScore = Math.round((totalPronunciationScore / phases.length / 100) * activityPoints);
              }
            }
            break;

          case 'dictation':
            // Frontend submits: string (typed text by user)
            if (activityAnswers && content?.transcript) {
              const userText = String(activityAnswers).toLowerCase().trim();
              const correctText = content.transcript.toLowerCase().trim();
              const similarity = this.calculateTextSimilarity(userText, correctText);
              activityScore = Math.round(similarity * activityPoints);
              console.log(`Dictation: ${(similarity * 100).toFixed(1)}% match → ${activityScore}/${activityPoints}`);
            }
            break;

          case 'vocab':
          case 'flashcard':
          case 'conversation':
          case 'mini_game':
            // Completion-based: full points if attempted
            if (activityAnswers !== null && activityAnswers !== undefined && activityAnswers !== '') {
              activityScore = activityPoints;
              console.log(`${activity.type}: completed → ${activityScore}/${activityPoints}`);
            }
            break;

          default:
            // Unknown activity type - award points if attempted
            if (activityAnswers !== null && activityAnswers !== undefined && activityAnswers !== '') {
              activityScore = activityPoints;
              console.log(`Activity ${activity.type} attempted, awarded full points`);
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

  /**
   * Normalize activity points to sum = 100
   * Formula: scaleFactor = 100 / sumOfPoints
   * Maintains relative weights between activities
   */
  private normalizeActivityPoints(
    activities: AssignmentActivityDto[],
  ): AssignmentActivityDto[] {
    if (!activities || activities.length === 0) {
      return activities;
    }

    // Calculate sum of activity points
    const sumOfPoints = activities.reduce(
      (sum, a) => sum + (a.points || 10),
      0,
    );

    // If sum is 0 or already 100, return as-is
    if (sumOfPoints === 0 || sumOfPoints === 100) {
      return activities;
    }

    // Calculate scale factor
    const scaleFactor = 100 / sumOfPoints;

    // Scale each activity's points proportionally
    return activities.map((activity) => ({
      ...activity,
      points: Math.round((activity.points || 10) * scaleFactor),
    }));
  }

  /**
   * Normalize activity points from any activity-like object
   * Used for clone operations where activities may not be DTOs
   */
  private normalizeActivityPointsGeneric(
    activities: Array<{ points?: number }>,
  ): Array<{ points: number }> {
    if (!activities || activities.length === 0) {
      return activities as Array<{ points: number }>;
    }

    // Calculate sum of activity points
    const sumOfPoints = activities.reduce(
      (sum, a) => sum + (a.points || 10),
      0,
    );

    // If sum is 0 or already 100, return as-is
    if (sumOfPoints === 0 || sumOfPoints === 100) {
      return activities.map((a) => ({ ...a, points: a.points || 10 }));
    }

    // Calculate scale factor
    const scaleFactor = 100 / sumOfPoints;

    // Scale each activity's points proportionally
    return activities.map((activity) => ({
      ...activity,
      points: Math.round((activity.points || 10) * scaleFactor),
    }));
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
      passingScore: activity.passingScore,
      difficulty: activity.difficulty,
      hints: activity.hints ?? [],
    };
  }

  // ==================== SUBMISSION GRADING ====================

  /**
   * Get submission details with permission check
   * @param submissionId ID của bài nộp
   * @param teacherUserId ID của giáo viên hoặc admin
   * @returns Chi tiết bài nộp
   */
  async getSubmissionDetails(
    submissionId: string,
    teacherUserId: string,
  ): Promise<any> {
    const submission =
      await this.assignmentRepository.findSubmissionWithDetails(submissionId);

    if (!submission) {
      throw new NotFoundException(
        `Submission with ID ${submissionId} not found`,
      );
    }

    // Check permission: teacher of classroom or admin
    const teacher =
      await this.assignmentRepository.findTeacherById(teacherUserId);

    if (!teacher) {
      throw new NotFoundException(`Teacher with ID ${teacherUserId} not found`);
    }

    const isAdmin = teacher.role === 'admin';
    const isTeacherOfClassroom =
      submission.assignment.classroom.teacherId === teacherUserId;

    if (!isAdmin && !isTeacherOfClassroom) {
      throw new ForbiddenException(
        'You do not have permission to view this submission',
      );
    }

    return submission;
  }

  /**
   * Grade a submission (new implementation for teacher UI)
   * @param submissionId ID của bài nộp
   * @param grade Điểm số
   * @param feedback Nhận xét
   * @param teacherUserId ID của giáo viên chấm bài
   * @returns Bài nộp đã được chấm
   */
  async gradeSubmissionNew(
    submissionId: string,
    grade: number,
    feedback: string | null,
    teacherUserId: string,
  ): Promise<any> {
    // 1. Get submission with permission check
    const submission = await this.getSubmissionDetails(
      submissionId,
      teacherUserId,
    );

    // 2. Validate grade against assignment's totalPoints
    const assignment = submission.assignment;
    if (grade > assignment.totalPoints) {
      throw new BadRequestException(
        `Grade (${grade}) cannot exceed assignment's total points (${assignment.totalPoints})`,
      );
    }

    // 3. Update submission
    const gradedSubmission = await this.assignmentRepository.updateSubmission(
      submissionId,
      {
        score: grade,
        feedback: feedback || null,
        gradedAt: new Date(),
        gradedById: teacherUserId,
        status: 'GRADED',
      },
    );

    // Invalidate gradebook cache
    if (this.gradebookService && assignment.classroomId) {
      await this.gradebookService.invalidateCache(
        submission.studentId,
        assignment.classroomId,
      ).catch((err) => {
        this.logger.warn(`Failed to invalidate gradebook cache: ${err.message}`);
      });
    }

    // Check course completion and trigger certificate issuance (async, non-blocking)
    if (assignment.classroomId) {
      this.checkCourseCompletionForCertificate(
        submission.studentId,
        assignment.classroomId,
      ).catch((error) => {
        this.logger.warn(
          `Failed to check course completion for certificate: ${error.message}`,
        );
      });
    }

    // TODO: Optional - Send notification to student about graded assignment
    // TODO: Optional - Update student progress/stats

    console.log(
      `Submission ${submissionId} graded by teacher ${teacherUserId}: ${grade}/${assignment.totalPoints}`,
    );

    return gradedSubmission;
  }

  /**
   * Download audio from URL and convert to base64
   */
  private async downloadAudioAsBase64(url: string): Promise<string> {
    try {
      const response = await axios.get(url, {
        responseType: 'arraybuffer',
        timeout: 30000,
      });
      return Buffer.from(response.data).toString('base64');
    } catch (error) {
      this.logger.error(`Failed to download audio from ${url}:`, error);
      throw error;
    }
  }

  /**
   * Calculate text similarity for dictation scoring
   */
  private calculateTextSimilarity(a: string, b: string): number {
    const wordsA = a.toLowerCase().trim().split(/\s+/).filter((w) => w);
    const wordsB = b.toLowerCase().trim().split(/\s+/).filter((w) => w);
    if (wordsB.length === 0) return wordsA.length === 0 ? 1 : 0;

    let matches = 0;
    const maxLen = Math.max(wordsA.length, wordsB.length);

    wordsA.forEach((word, i) => {
      if (i < wordsB.length && wordsB[i] === word) matches++;
    });

    return maxLen > 0 ? matches / maxLen : 0;
  }

  // ==================== STREAMING GRADING ====================

  /**
   * Submit assignment with streaming grading via WebSocket
   * Returns immediately after saving, grades in background
   */
  async submitAssignmentStreaming(
    assignmentId: string,
    studentId: string,
    dto: SubmitAssignmentDto,
  ): Promise<{ id: string; status: string; message: string }> {
    const assignment = await this.getAssignmentById(assignmentId);

    // Validation (same as submitAssignment)
    if (!assignment.isPublished) {
      throw new BadRequestException('Assignment is not published yet');
    }

    if (assignment.dueDate && new Date() > assignment.dueDate) {
      throw new BadRequestException('Assignment deadline has passed');
    }

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

    // Save submission
    const submission = await this.assignmentRepository.submitAssignment({
      assignmentId,
      studentId,
      answers: dto.answers,
      timeSpent: dto.timeSpent,
      attemptCount,
    });

    // Spawn background grading (non-blocking)
    setImmediate(() => {
      this.gradeWithWebSocket(
        submission.id,
        studentId,
        assignment,
        dto.answers,
      ).catch((err) => {
        this.logger.error(`Background grading failed for ${submission.id}:`, err);
        this.eventsGateway.emitToUser(studentId, 'grading:error', {
          submissionId: submission.id,
          error: 'Có lỗi khi chấm bài. Vui lòng tải lại trang để xem kết quả.',
        });
      });
    });

    // Return immediately
    return {
      id: submission.id,
      status: 'GRADING',
      message: 'Bài đã được nộp. Đang chấm điểm...',
    };
  }

  /**
   * Grade assignment in background and emit WebSocket events
   */
  private async gradeWithWebSocket(
    submissionId: string,
    studentId: string,
    assignment: AssignmentWithDetails,
    answers: Record<string, any>,
  ): Promise<void> {
    const activities = assignment.assignmentActivities;

    this.logger.log(
      `Starting streaming grading for submission ${submissionId} with ${activities.length} activities`,
    );

    // Emit start event
    this.eventsGateway.emitToUser(studentId, 'grading:start', {
      submissionId,
      totalActivities: activities.length,
      assignmentTitle: assignment.title,
    });

    let totalPoints = 0;
    let earnedPoints = 0;
    const activityScores: Record<string, { score: number; maxScore: number }> = {};

    // Grade each activity
    for (let i = 0; i < activities.length; i++) {
      const activity = activities[i];
      const activityPoints = activity.points || 10;
      totalPoints += activityPoints;

      // Get answer for this activity
      const activityAnswers = answers[activity.id] || answers[`activity${i}`];

      let activityScore = 0;

      try {
        activityScore = await this.gradeActivityForStreaming(
          activity,
          activityAnswers,
          activityPoints,
        );
      } catch (error) {
        this.logger.error(`Error grading activity ${activity.id}:`, error);
        activityScore = 0;
      }

      earnedPoints += activityScore;
      activityScores[activity.id] = {
        score: activityScore,
        maxScore: activityPoints,
      };

      // Emit activity graded event
      this.eventsGateway.emitToUser(studentId, 'grading:activity', {
        submissionId,
        activityId: activity.id,
        activityIndex: i,
        activityType: activity.type,
        activityTitle: activity.title,
        score: activityScore,
        maxScore: activityPoints,
        totalGraded: i + 1,
        totalActivities: activities.length,
      });

      this.logger.log(
        `Graded activity ${i + 1}/${activities.length}: ${activity.type} = ${activityScore}/${activityPoints}`,
      );
    }

    // Calculate final score
    const finalScore =
      totalPoints > 0 ? Math.round((earnedPoints / totalPoints) * 100) : 0;

    // Generate feedback
    let feedback = 'Hoàn thành chấm bài!';
    if (finalScore < 90) {
      try {
        feedback = await this.geminiService.generateAttemptFeedback({
          score: finalScore,
          maxScore: 100,
          activityType: 'Assignment',
          userAnswers: answers,
          correctAnswers: this.getCorrectAnswers(activities),
          assignmentTitle: assignment.title,
          assignmentDescription: assignment.description,
          activities: activities.map((a) => ({
            id: a.id,
            type: a.type,
            title: a.title,
            content: a.content,
            points: a.points,
          })),
          maxWords: 100,
        });
      } catch (e) {
        this.logger.error('Error generating feedback:', e);
        feedback = `Bạn đạt được ${finalScore}% điểm số. Hãy xem lại các câu trả lời để cải thiện kết quả!`;
      }
    } else {
      feedback = 'Xuất sắc! Bạn đã hoàn thành bài tập với kết quả rất tốt. Tiếp tục phát huy!';
    }

    // Update database
    await this.assignmentRepository.gradeSubmission(submissionId, {
      score: finalScore,
      feedback,
    });

    // Check course completion and trigger certificate issuance (async, non-blocking)
    if (assignment.classroomId) {
      this.checkCourseCompletionForCertificate(
        studentId,
        assignment.classroomId,
      ).catch((error) => {
        this.logger.warn(
          `Failed to check course completion for certificate: ${error.message}`,
        );
      });
    }

    // Emit complete event
    this.eventsGateway.emitToUser(studentId, 'grading:complete', {
      submissionId,
      totalScore: finalScore,
      earnedPoints,
      totalPoints,
      feedback,
      activityScores,
    });

    this.logger.log(
      `Completed streaming grading for ${submissionId}: ${finalScore}%`,
    );
  }

  /**
   * Grade a single activity (used by streaming grading)
   */
  private async gradeActivityForStreaming(
    activity: AssignmentActivityModel,
    activityAnswers: any,
    activityPoints: number,
  ): Promise<number> {
    if (!activityAnswers) {
      return 0;
    }

    const content = activity.content as Record<string, any>;
    let activityScore = 0;

    switch (activity.type) {
      case 'quiz':
        if (content?.questions && Array.isArray(content.questions)) {
          let correctCount = 0;
          content.questions.forEach((q: any, qIndex: number) => {
            const userAnswer = activityAnswers?.[qIndex];
            if (typeof userAnswer === 'number' && userAnswer === q.correctIndex) {
              correctCount++;
            }
          });
          activityScore = Math.round((correctCount / content.questions.length) * activityPoints);
        } else if (content?.options && typeof content.correctIndex === 'number') {
          if (activityAnswers === content.correctIndex) {
            activityScore = activityPoints;
          }
        }
        break;

      case 'grammar':
        if (content?.questions && Array.isArray(content.questions)) {
          let correctCount = 0;
          content.questions.forEach((q: any, qIndex: number) => {
            const userAnswer = activityAnswers?.[qIndex];
            if (typeof userAnswer === 'number' && userAnswer === q.correctIndex) {
              correctCount++;
            }
          });
          activityScore = Math.round((correctCount / content.questions.length) * activityPoints);
        } else if (content?.exercises && Array.isArray(content.exercises)) {
          let correctCount = 0;
          content.exercises.forEach((ex: any, exIndex: number) => {
            const userAnswer = activityAnswers?.[exIndex];
            if (typeof userAnswer === 'number' && userAnswer === ex.correctIndex) {
              correctCount++;
            }
          });
          activityScore = Math.round((correctCount / content.exercises.length) * activityPoints);
        } else if (content?.options && typeof content.correctIndex === 'number') {
          if (activityAnswers === content.correctIndex) {
            activityScore = activityPoints;
          }
        }
        break;

      case 'listening':
      case 'reading':
        if (content?.questions && Array.isArray(content.questions)) {
          let correctCount = 0;
          content.questions.forEach((q: any, qIndex: number) => {
            const userAnswer = activityAnswers?.[qIndex];
            if (typeof userAnswer === 'number' && userAnswer === q.correctIndex) {
              correctCount++;
            }
          });
          activityScore = Math.round((correctCount / content.questions.length) * activityPoints);
        } else if (content?.options && typeof content.correctIndex === 'number') {
          if (activityAnswers === content.correctIndex) {
            activityScore = activityPoints;
          }
        }
        break;

      case 'fill_blank':
        if (content?.correctAnswers && Array.isArray(content.correctAnswers)) {
          let correctCount = 0;
          if (Array.isArray(activityAnswers)) {
            content.correctAnswers.forEach((correctAnswer: string, index: number) => {
              const userAnswer = activityAnswers[index];
              if (userAnswer?.toLowerCase().trim() === correctAnswer.toLowerCase().trim()) {
                correctCount++;
              }
            });
            activityScore = Math.round((correctCount / content.correctAnswers.length) * activityPoints);
          }
        } else if (content?.correctAnswer && typeof activityAnswers === 'string') {
          if (activityAnswers.toLowerCase().trim() === content.correctAnswer.toLowerCase().trim()) {
            activityScore = activityPoints;
          }
        }
        break;

      case 'matching':
        // Matching - support both pairs format and leftItems/rightItems format
        if (typeof activityAnswers === 'object') {
          let correctCount = 0;
          let totalPairs = 0;

          if (content?.pairs && Array.isArray(content.pairs)) {
            // Format 1: pairs array with index-based answers
            totalPairs = content.pairs.length;
            content.pairs.forEach((pair: any, pairIndex: number) => {
              const userRightIndex = activityAnswers[pairIndex];
              if (typeof userRightIndex === 'number' && userRightIndex === pairIndex) {
                correctCount++;
              }
            });
          } else if (content?.leftItems && content?.rightItems) {
            // Format 2: leftItems/rightItems arrays
            totalPairs = content.leftItems.length;
            content.leftItems.forEach((_leftItem: string, leftIndex: number) => {
              const userRightIndex = activityAnswers[leftIndex];
              if (typeof userRightIndex === 'number' && userRightIndex === leftIndex) {
                correctCount++;
              }
            });
          }

          if (totalPairs > 0) {
            activityScore = Math.round((correctCount / totalPairs) * activityPoints);
          }
        }
        break;

      case 'speaking':
        if (activityAnswers?.audioUrl) {
          try {
            const audioBase64 = await this.downloadAudioAsBase64(activityAnswers.audioUrl);
            const result = await this.evaluationService.evaluateSpeaking('system', {
              audioBase64,
              mimeType: 'audio/webm',
              prompt: content?.prompt,
              minSeconds: content?.minSeconds,
            });
            activityScore = Math.round((result.score / 100) * activityPoints);
          } catch (error) {
            this.logger.error('Speaking evaluation failed:', error);
            activityScore = Math.round(activityPoints * 0.5);
          }
        }
        break;

      case 'writing':
        const writingText = activityAnswers?.text || (typeof activityAnswers === 'string' ? activityAnswers : null);
        if (writingText && writingText.trim().length > 0) {
          try {
            const result = await this.evaluationService.evaluateWriting('system', {
              submission: writingText,
              prompt: content?.prompt,
              minWords: content?.minWords,
            });
            activityScore = Math.round((result.score / 100) * activityPoints);
          } catch (error) {
            this.logger.error('Writing evaluation failed:', error);
            activityScore = Math.round(activityPoints * 0.5);
          }
        }
        break;

      case 'pronunciation':
        // Frontend submits: { [index]: "audioUrl" }
        const phrases = content?.phrases || [];
        let totalStreamingScore = 0;

        if (typeof activityAnswers === 'object' && activityAnswers !== null) {
          for (let i = 0; i < phrases.length; i++) {
            const audioUrl = activityAnswers[i];
            if (audioUrl && typeof audioUrl === 'string') {
              try {
                const audioBase64 = await this.downloadAudioAsBase64(audioUrl);
                const targetPhrase = phrases[i]?.text || '';

                const result = await this.evaluationService.evaluatePronunciation('system', {
                  audioBase64,
                  mimeType: 'audio/webm',
                  phrase: targetPhrase,
                });

                totalStreamingScore += result.score;
              } catch (error) {
                this.logger.error(`Pronunciation evaluation failed for phrase ${i}:`, error);
              }
            }
          }

          if (phrases.length > 0) {
            activityScore = Math.round((totalStreamingScore / phrases.length / 100) * activityPoints);
          }
        }
        break;

      case 'dictation':
        if (activityAnswers && content?.transcript) {
          const userText = String(activityAnswers).toLowerCase().trim();
          const correctText = content.transcript.toLowerCase().trim();
          const similarity = this.calculateTextSimilarity(userText, correctText);
          activityScore = Math.round(similarity * activityPoints);
        }
        break;

      case 'vocab':
      case 'flashcard':
      case 'conversation':
      case 'mini_game':
        if (activityAnswers !== null && activityAnswers !== undefined && activityAnswers !== '') {
          activityScore = activityPoints;
        }
        break;

      default:
        if (activityAnswers !== null && activityAnswers !== undefined && activityAnswers !== '') {
          activityScore = activityPoints;
        }
        break;
    }

    return activityScore;
  }

  /**
   * Check course completion and trigger certificate issuance if eligible
   */
  private async checkCourseCompletionForCertificate(
    studentId: string,
    classroomId: string,
  ): Promise<void> {
    if (!this.autoCertificateIssuer) {
      return; // Service not available
    }

    try {
      // Get classroom with course info via repository's prisma client
      const prisma = (this.assignmentRepository as any).prisma || (this.assignmentRepository as any).$;
      if (!prisma) {
        this.logger.warn('Cannot access Prisma client from repository');
        return;
      }

      const classroom = await prisma.classroom.findUnique({
        where: { id: classroomId },
        select: {
          id: true,
          courseId: true,
        },
      });

      if (!classroom) {
        return;
      }

      // Check and issue certificate (async, non-blocking)
      await this.autoCertificateIssuer.checkAndIssueCertificate(
        studentId,
        classroom.courseId,
        classroomId,
      );
    } catch (error) {
      // Silently fail - don't break assignment grading
      this.logger.warn(
        `Error checking course completion for certificate: ${error.message}`,
      );
    }
  }

  /**
   * Extract media from assignment activities and create MediaFile records
   */
  private async extractMediaFromAssignmentActivities(
    assignment: AssignmentWithDetails,
    activityDtos: AssignmentActivityDto[],
  ): Promise<void> {
    if (!this.mediaService || !assignment.assignmentActivities) {
      return;
    }

    this.logger.log(
      `Extracting media from ${assignment.assignmentActivities.length} assignment activities`,
    );

    // Map activity DTOs to created activities by order
    const activityMap = new Map<number, AssignmentActivityDto>();
    activityDtos.forEach((dto, index) => {
      activityMap.set(index, dto);
    });

    // Process all activities in parallel
    const results = await Promise.allSettled(
      assignment.assignmentActivities.map(async (activity, index) => {
        const activityDto = activityMap.get(index);
        if (!activityDto) return;

        // Extract media URLs from activity
        const media = extractMediaFromActivity({
          type: activityDto.type,
          mediaUrls: activityDto.mediaUrls || (typeof activityDto.mediaUrls === 'object' ? Object.values(activityDto.mediaUrls) : []),
          content: activityDto.content,
        });

        // Create MediaFile for each media URL
        for (const url of media.all) {
          try {
            await this.mediaService.createFromContext(url, {
              source: 'assignment_activity',
              sourceId: activity.id,
              assignmentTitle: assignment.title,
              activityTitle: activityDto.title,
              activityType: activityDto.type,
            });
          } catch (error) {
            this.logger.warn(
              `Failed to create MediaFile for URL ${url} in assignment activity ${activity.id}: ${error.message}`,
            );
            // Continue with other URLs
          }
        }
      }),
    );

    // Log results
    const successful = results.filter((r) => r.status === 'fulfilled').length;
    const failed = results.filter((r) => r.status === 'rejected').length;
    this.logger.log(
      `Media extraction completed: ${successful} succeeded, ${failed} failed`,
    );
  }
}
