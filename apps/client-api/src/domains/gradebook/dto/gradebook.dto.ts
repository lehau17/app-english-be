export interface StudentGradeDto {
  studentId: string;
  studentName: string;
  midterm?: number | null;
  final?: number | null;
  tests?: number | null;
  activities?: number | null;
  finalGrade: number;
}

export interface ClassroomGradebookDto {
  classroomId: string;
  classroomName: string;
  students: StudentGradeDto[];
}

export interface StudentTranscriptDto {
  studentId: string;
  studentName: string;
  classrooms: ClassroomGradeItemDto[];
}

export interface ClassroomGradeItemDto {
  classroomId: string;
  classroomName: string;
  courseName: string;
  midterm?: number | null;
  final?: number | null;
  tests?: number | null;
  activities?: number | null;
  finalGrade: number;
}

export interface ParentChildrenGradesDto {
  children: {
    childId: string;
    childName: string;
    classrooms: ClassroomGradeItemDto[];
  }[];
}

export interface GradeCalculationResult {
  midterm: number | null;
  final: number | null;
  tests: number | null;
  activities: number | null;
  finalGrade: number;
}

export interface AssignmentDetailDto {
  assignmentId: string;
  title: string;
  type: string;
  totalPoints: number;
  weight: number;
  score: number | null;
  maxScore: number;
  submissionId: string | null;
  submittedAt: Date | null;
  gradedAt: Date | null;
  feedback: string | null;
  attemptCount: number;
}

export interface ActivityDetailDto {
  activityId: string;
  title: string;
  type: string;
  lessonTitle: string;
  bestScore: number | null;
  currentScore: number | null;
  attemptsCount: number;
  state: string;
  timeSpentSec: number;
}

export interface StudentGradeDetailsDto {
  studentId: string;
  studentName: string;
  classroomId: string;
  classroomName: string;
  assignments: {
    midterm: AssignmentDetailDto[];
    final: AssignmentDetailDto[];
    tests: AssignmentDetailDto[];
  };
  activities: ActivityDetailDto[];
}













