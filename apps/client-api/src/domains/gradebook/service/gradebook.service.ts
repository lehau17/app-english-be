import {
  CACHE_TTL,
  GRADEBOOK_CACHE,
  RedisCacheService,
} from '@app/shared';
import { Injectable, Logger } from '@nestjs/common';
import { AssignmentType } from '@prisma/client';
import {
  ActivityDetailDto,
  AssignmentDetailDto,
  ClassroomGradebookDto,
  GradeCalculationResult,
  ParentChildrenGradesDto,
  StudentGradeDetailsDto,
  StudentGradeDto,
  StudentTranscriptDto,
} from '../dto';
import { GradebookRepository } from '../repository';

@Injectable()
export class GradebookService {
  private readonly logger = new Logger(GradebookService.name);
  private readonly CACHE_TTL = CACHE_TTL.VERY_SHORT; // 30 seconds

  constructor(
    private readonly repository: GradebookRepository,
    private readonly cacheService: RedisCacheService,
  ) {}

  /**
   * Calculate student grade for a classroom
   */
  async calculateStudentGrade(
    studentId: string,
    classroomId: string,
  ): Promise<GradeCalculationResult> {
    const cachePrefix = GRADEBOOK_CACHE.STUDENT_GRADE;
    const cacheKey = `${classroomId}:${studentId}`;

    // Try cache first
    const cached = await this.cacheService.get<GradeCalculationResult>(
      cachePrefix,
      cacheKey,
    );
    if (cached) {
      this.logger.debug(`Cache hit for ${cachePrefix}:${cacheKey}`);
      return cached;
    }

    // Get classroom to find courseId
    const classroom = await this.repository.getClassroomWithCourse(
      classroomId,
    );
    if (!classroom) {
      throw new Error(`Classroom ${classroomId} not found`);
    }

    // Get all scores
    const [midterm, final, tests, activities] = await Promise.all([
      this.repository.getMidtermScore(studentId, classroomId),
      this.repository.getFinalScore(studentId, classroomId),
      this.repository.getTestScoresAverage(studentId, classroomId),
      this.repository.getActivityScoresAverage(studentId, classroom.courseId),
    ]);

    // Calculate final grade with weighted formula
    const finalGrade = this.calculateWeightedGrade(midterm, final, tests, activities);

    const result: GradeCalculationResult = {
      midterm,
      final,
      tests,
      activities,
      finalGrade,
    };

    // Cache result
    await this.cacheService.set(cachePrefix, cacheKey, result, this.CACHE_TTL);

    return result;
  }

  /**
   * Calculate weighted final grade
   * Formula: Midterm(30%) + Final(40%) + Tests(20%) + Activities(10%)
   */
  private calculateWeightedGrade(
    midterm: number | null,
    final: number | null,
    tests: number | null,
    activities: number | null,
  ): number {
    const weights = {
      midterm: 0.3,
      final: 0.4,
      tests: 0.2,
      activities: 0.1,
    };

    let totalWeight = 0;
    let weightedSum = 0;

    if (midterm !== null) {
      weightedSum += midterm * weights.midterm;
      totalWeight += weights.midterm;
    }

    if (final !== null) {
      weightedSum += final * weights.final;
      totalWeight += weights.final;
    }

    if (tests !== null) {
      weightedSum += tests * weights.tests;
      totalWeight += weights.tests;
    }

    if (activities !== null) {
      weightedSum += activities * weights.activities;
      totalWeight += weights.activities;
    }

    // If no scores available, return 0
    if (totalWeight === 0) {
      return 0;
    }

    // Normalize if some components are missing
    const normalizedGrade = totalWeight < 1
      ? weightedSum / totalWeight
      : weightedSum;

    return Math.round(normalizedGrade * 10) / 10;
  }

  /**
   * Calculate grades for all students in a classroom
   */
  async calculateClassroomGrades(
    classroomId: string,
  ): Promise<ClassroomGradebookDto> {
    const classroom = await this.repository.getClassroomWithCourse(
      classroomId,
    );
    if (!classroom) {
      throw new Error(`Classroom ${classroomId} not found`);
    }

    const students = await this.repository.getClassroomStudents(classroomId);

    const studentGrades: StudentGradeDto[] = await Promise.all(
      students.map(async (cs) => {
        const grade = await this.calculateStudentGrade(
          cs.studentId,
          classroomId,
        );

        const studentName =
          cs.student.displayName ||
          `${cs.student.firstName || ''} ${cs.student.lastName || ''}`.trim() ||
          cs.student.email ||
          'Unknown';

        return {
          studentId: cs.studentId,
          studentName,
          midterm: grade.midterm,
          final: grade.final,
          tests: grade.tests,
          activities: grade.activities,
          finalGrade: grade.finalGrade,
        };
      }),
    );

    return {
      classroomId,
      classroomName: classroom.name,
      students: studentGrades,
    };
  }

  /**
   * Get student transcript (all classrooms)
   */
  async getStudentTranscript(
    studentId: string,
  ): Promise<StudentTranscriptDto> {
    const classrooms = await this.repository.getStudentClassrooms(studentId);

    const student = classrooms[0]?.student;
    if (!student) {
      throw new Error(`Student ${studentId} not found`);
    }

    const studentName =
      student.displayName ||
      `${student.firstName || ''} ${student.lastName || ''}`.trim() ||
      student.email ||
      'Unknown';

    const classroomGrades = await Promise.all(
      classrooms.map(async (cs) => {
        const grade = await this.calculateStudentGrade(
          studentId,
          cs.classroomId,
        );

        return {
          classroomId: cs.classroomId,
          classroomName: cs.classroom.name,
          courseName: cs.classroom.course.title,
          midterm: grade.midterm,
          final: grade.final,
          tests: grade.tests,
          activities: grade.activities,
          finalGrade: grade.finalGrade,
        };
      }),
    );

    return {
      studentId,
      studentName,
      classrooms: classroomGrades,
    };
  }

  /**
   * Get grades for all children of a parent
   */
  async getParentChildrenGrades(
    parentId: string,
  ): Promise<ParentChildrenGradesDto> {
    const parentChildren = await this.repository.getParentChildren(parentId);

    const children = await Promise.all(
      parentChildren.map(async (pc) => {
        const classrooms = await this.repository.getStudentClassrooms(
          pc.childId,
        );

        const childName =
          pc.child.displayName ||
          `${pc.child.firstName || ''} ${pc.child.lastName || ''}`.trim() ||
          pc.child.email ||
          'Unknown';

        const classroomGrades = await Promise.all(
          classrooms.map(async (cs) => {
            const grade = await this.calculateStudentGrade(
              pc.childId,
              cs.classroomId,
            );

            return {
              classroomId: cs.classroomId,
              classroomName: cs.classroom.name,
              courseName: cs.classroom.course.title,
              midterm: grade.midterm,
              final: grade.final,
              tests: grade.tests,
              activities: grade.activities,
              finalGrade: grade.finalGrade,
            };
          }),
        );

        return {
          childId: pc.childId,
          childName,
          classrooms: classroomGrades,
        };
      }),
    );

    return { children };
  }

  /**
   * Invalidate cache for a student's grade in a classroom
   * This invalidates all cache entries for the gradebook prefix
   */
  async invalidateCache(studentId: string, classroomId: string): Promise<void> {
    const cachePrefix = GRADEBOOK_CACHE.STUDENT_GRADE;
    await this.cacheService.invalidate(cachePrefix);
    this.logger.debug(
      `Cache invalidated for ${cachePrefix} (student: ${studentId}, classroom: ${classroomId})`,
    );
  }

  /**
   * Get detailed grade breakdown for a student in a classroom
   */
  async getStudentGradeDetails(
    studentId: string,
    classroomId: string,
  ): Promise<StudentGradeDetailsDto> {
    const classroom = await this.repository.getClassroomWithCourse(
      classroomId,
    );
    if (!classroom) {
      throw new Error(`Classroom ${classroomId} not found`);
    }

    // Get student info
    const classroomStudents = await this.repository.getClassroomStudents(
      classroomId,
    );
    const studentRecord = classroomStudents.find(
      (cs) => cs.studentId === studentId,
    );
    if (!studentRecord) {
      throw new Error(
        `Student ${studentId} not found in classroom ${classroomId}`,
      );
    }

    const studentName =
      studentRecord.student.displayName ||
      `${studentRecord.student.firstName || ''} ${studentRecord.student.lastName || ''}`.trim() ||
      studentRecord.student.email ||
      'Unknown';

    // Get assignments and activities
    const [assignmentsData, activitiesData] = await Promise.all([
      this.repository.getStudentAssignments(studentId, classroomId),
      this.repository.getStudentActivities(studentId, classroom.courseId),
    ]);

    // Group assignments by type
    const midterm: AssignmentDetailDto[] = [];
    const final: AssignmentDetailDto[] = [];
    const tests: AssignmentDetailDto[] = [];

    assignmentsData.forEach((item) => {
      const assignmentDetail: AssignmentDetailDto = {
        assignmentId: item.assignment.id,
        title: item.assignment.title,
        type: item.assignment.type,
        totalPoints: item.assignment.totalPoints,
        weight: item.assignment.weight,
        score: item.submission?.score ?? null,
        maxScore: item.assignment.totalPoints,
        submissionId: item.submission?.id ?? null,
        submittedAt: item.submission?.submittedAt ?? null,
        gradedAt: item.submission?.gradedAt ?? null,
        feedback: item.submission?.feedback ?? null,
        attemptCount: item.submission?.attemptCount ?? 0,
      };

      if (item.assignment.type === AssignmentType.MIDTERM_EXAM) {
        midterm.push(assignmentDetail);
      } else if (item.assignment.type === AssignmentType.FINAL_EXAM) {
        final.push(assignmentDetail);
      } else {
        tests.push(assignmentDetail);
      }
    });

    // Map activities
    const activities: ActivityDetailDto[] = activitiesData.map((item) => ({
      activityId: item.activity.id,
      title: item.activity.title,
      type: item.activity.type,
      lessonTitle: item.lesson.title,
      bestScore: item.progress?.bestScore ?? null,
      currentScore: item.progress?.score ?? null,
      attemptsCount: item.progress?.attemptsCount ?? 0,
      state: item.progress?.state ?? 'not_started',
      timeSpentSec: item.progress?.timeSpentSec ?? 0,
    }));

    return {
      studentId,
      studentName,
      classroomId,
      classroomName: classroom.name,
      assignments: {
        midterm,
        final,
        tests,
      },
      activities,
    };
  }
}













