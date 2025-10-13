import { GeminiService } from '@app/shared/ai/gemini.service';
import { Injectable, Logger } from '@nestjs/common';
import { Prisma, SuggestionType } from '@prisma/client';
import { PrismaService } from 'nestjs-prisma';
import * as dayjs from 'dayjs';

interface AISuggestion {
  type: 'CLASS_WIDE' | 'INDIVIDUAL_STUDENT';
  suggestion: string;
  studentId?: string;
}

@Injectable()
export class SuggestionEngineService {
  private readonly logger = new Logger(SuggestionEngineService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly geminiService: GeminiService,
  ) {}

  async analyzeAndGenerateSuggestions(): Promise<void> {
    this.logger.log('Starting analysis and suggestion generation for all active classrooms...');

    const classrooms = await this.prisma.classroom.findMany({
      where: { isActive: true },
      include: {
        students: { include: { student: true } },
      },
    });

    for (const classroom of classrooms) {
      try {
        await this.processClassroom(classroom);
      } catch (error) {
        this.logger.error(`Failed to process classroom ${classroom.id}`, error.stack);
      }
    }

    this.logger.log('Finished analysis and suggestion generation.');
  }

  private async processClassroom(
    classroom: Prisma.ClassroomGetPayload<{
      include: { students: { include: { student: true } } };
    }>,
  ) {
    this.logger.log(`Processing classroom: ${classroom.name} (${classroom.id})`);

    const studentIds = classroom.students.map((s) => s.studentId);
    if (studentIds.length === 0) {
      this.logger.log(`Skipping classroom ${classroom.id} as it has no students.`);
      return;
    }

    const sevenDaysAgo = dayjs().subtract(7, 'day').toDate();

    // 1. Aggregate assignment submissions and progress
    const submissions = await this.prisma.assignmentSubmission.findMany({
      where: {
        studentId: { in: studentIds },
        submittedAt: { gte: sevenDaysAgo },
      },
      include: {
        assignment: {
          include: {
            assignmentActivities: true,
          },
        },
      },
    });

    const progress = await this.prisma.progress.findMany({
        where: {
            userId: { in: studentIds },
            updatedAt: { gte: sevenDaysAgo },
        },
        include: {
            activity: true,
        },
    });

    // 2. Find common errors (simplified)
    const attempts = await this.prisma.attempt.findMany({
        where: {
            userId: { in: studentIds },
            createdAt: { gte: sevenDaysAgo },
            feedback: { not: null },
        },
        select: { feedback: true },
        take: 50, // Limit to recent 50 attempts to avoid overload
    });

    const commonErrors = this.extractCommonErrors(attempts.map(a => a.feedback));

    // 3. Identify students needing attention
    const { lowPerformingStudents, lowSubmissionStudents } = this.calculateStudentMetrics(
      classroom.students.map(s => s.student),
      submissions,
    );

    // 4. Build prompt for AI
    const prompt = this.buildAIPrompt(
      classroom,
      submissions,
      progress,
      commonErrors,
      lowPerformingStudents,
      lowSubmissionStudents,
    );

    if (!prompt) {
        this.logger.log(`Not enough data to generate suggestions for classroom ${classroom.id}`);
        return;
    }

    // 5. Call AI service
    const aiResponse = await this.geminiService.generateResponse(prompt);

    // 6. Parse and save suggestions
    await this.saveSuggestions(classroom.id, aiResponse);
  }

  private extractCommonErrors(feedbacks: string[]): { error: string, count: number }[] {
    const errorCounts = new Map<string, number>();
    feedbacks.forEach((feedback) => {
        // This is a simplified extraction. A more robust solution would involve NLP.
        const errors = feedback.match(/Error: [^.]+/g) || [];
        errors.forEach(error => {
            const normalizedError = error.trim();
            errorCounts.set(normalizedError, (errorCounts.get(normalizedError) || 0) + 1);
        });
    });
    return Array.from(errorCounts.entries())
        .map(([error, count]) => ({ error, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 3);
  }

  private calculateStudentMetrics(students, submissions) {
    const studentScores = new Map<string, { totalScore: number; count: number }>();
    const submissionCounts = new Map<string, number>();

    submissions.forEach(sub => {
        if(sub.score) {
            const scores = studentScores.get(sub.studentId) || { totalScore: 0, count: 0 };
            scores.totalScore += sub.score;
            scores.count++;
            studentScores.set(sub.studentId, scores);
        }
        submissionCounts.set(sub.studentId, (submissionCounts.get(sub.studentId) || 0) + 1);
    });

    const studentAverages = students.map(student => {
        const scores = studentScores.get(student.id);
        const average = scores && scores.count > 0 ? scores.totalScore / scores.count : 0;
        return { studentId: student.id, name: student.displayName, average };
    });

    const lowPerformingStudents = studentAverages.sort((a, b) => a.average - b.average).slice(0, 3);

    const lowSubmissionStudents = students.map(student => ({
        studentId: student.id,
        name: student.displayName,
        count: submissionCounts.get(student.id) || 0,
    })).sort((a,b) => a.count - b.count).slice(0,3);

    return { lowPerformingStudents, lowSubmissionStudents };
  }

  private buildAIPrompt(
    classroom,
    submissions,
    progress,
    commonErrors,
    lowPerformingStudents,
    lowSubmissionStudents,
  ): string | null {
    if (submissions.length === 0 && progress.length === 0) {
        return null;
    }

    const avgScore = submissions.length > 0 ? submissions.reduce((acc, s) => acc + (s.score || 0), 0) / submissions.length : 0;
    const skillScores = new Map<string, { total: number, count: number }>();

    progress.forEach(p => {
        if (p.score && p.activity.type) {
            const skill = p.activity.type;
            const current = skillScores.get(skill) || { total: 0, count: 0 };
            current.total += p.score;
            current.count++;
            skillScores.set(skill, current);
        }
    });

    const avgSkillScores = Array.from(skillScores.entries()).map(([skill, data]) =>
        `${skill}: ${(data.total / data.count).toFixed(2)}%`
    ).join(', ');

    let prompt = `Analyze the following data for the classroom "${classroom.name}" and provide intervention suggestions for the teacher.

    Data Summary (last 7 days):
    - Overall average score on assignments: ${avgScore.toFixed(2)}%
    - Average scores by skill: ${avgSkillScores || 'No skill data available'}
    - Top 3 most common errors from feedback: ${commonErrors.length > 0 ? commonErrors.map(e => `"${e.error}" (${e.count} times)`).join(', ') : 'None'}

    Students needing attention:
    - Top 3 students with lowest average scores: ${lowPerformingStudents.map(s => `${s.name} (Avg: ${s.average.toFixed(2)}%)`).join(', ')}
    - Top 3 students with lowest submission rates: ${lowSubmissionStudents.map(s => `${s.name} (${s.count} submissions)`).join(', ')}

    Based on this data, generate a list of actionable suggestions. The suggestions should be categorized as either for the whole class ('CLASS_WIDE') or for a specific student ('INDIVIDUAL_STUDENT').

    Return the output as a JSON array of objects in the following format, and nothing else. Do not include any introductory text.
    [
      {
        "type": "CLASS_WIDE" | "INDIVIDUAL_STUDENT",
        "suggestion": "The specific, actionable suggestion for the teacher.",
        "studentId": "user_id_of_the_student_if_type_is_INDIVIDUAL_STUDENT_or_null"
      }
    ]

    Example for an individual student:
    {
      "type": "INDIVIDUAL_STUDENT",
      "suggestion": "Student ${lowPerformingStudents[0]?.name} seems to be struggling with ${'a specific skill'}. Consider assigning targeted exercises.",
      "studentId": "${lowPerformingStudents[0]?.studentId}"
    }

    Example for the whole class:
    {
        "type": "CLASS_WIDE",
        "suggestion": "The class average for WRITING is low. Plan a group activity focusing on essay structure.",
        "studentId": null
    }
    `;

    return prompt;
  }

  private async saveSuggestions(classroomId: string, aiResponse: string) {
    this.logger.log(`Saving suggestions for classroom ${classroomId}`);
    let suggestions: AISuggestion[];

    try {
      suggestions = JSON.parse(aiResponse);
      if (!Array.isArray(suggestions)) {
        throw new Error('AI response is not an array.');
      }
    } catch (error) {
      this.logger.error(`Failed to parse AI response for classroom ${classroomId}. Response: ${aiResponse}`, error.stack);
      return;
    }

    const suggestionsToCreate = suggestions.map(s => ({
      classroomId,
      suggestion: s.suggestion,
      type: s.type === 'CLASS_WIDE' ? SuggestionType.CLASS_WIDE : SuggestionType.INDIVIDUAL_STUDENT,
      studentId: s.studentId || null,
    }));

    // Transaction to ensure atomicity
    await this.prisma.$transaction(async (tx) => {
      // 1. Delete old suggestions
      await tx.classroomSuggestion.deleteMany({
        where: { classroomId },
      });

      // 2. Create new ones
      if(suggestionsToCreate.length > 0) {
        await tx.classroomSuggestion.createMany({
          data: suggestionsToCreate,
        });
      }
    });

    this.logger.log(`Successfully saved ${suggestions.length} new suggestions for classroom ${classroomId}.`);
  }
}