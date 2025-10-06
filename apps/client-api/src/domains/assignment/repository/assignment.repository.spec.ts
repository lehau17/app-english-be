import { AssignmentStatus } from '@prisma/client';
import { AssignmentRepository } from './assignment.repository';

// Mock PrismaRepository base class
jest.mock('@app/database', () => {
  return {
    PrismaRepository: class {
      protected assignment: any;
      protected assignmentActivity: any;
      protected assignmentSubmission: any;
      protected $transaction: any;

      constructor() {
        // Will be overridden in tests
      }
    },
  };
});

// Mock PrismaRepository methods
class MockPrismaClient {
  assignment = {
    create: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
  };

  assignmentActivity = {
    deleteMany: jest.fn(),
    createMany: jest.fn(),
  };

  assignmentSubmission = {
    create: jest.fn(),
    update: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
  };

  $transaction = jest.fn((callback) => {
    return callback({
      assignment: this.assignment,
      assignmentActivity: this.assignmentActivity,
      assignmentSubmission: this.assignmentSubmission,
    });
  });
}

describe('AssignmentRepository', () => {
  let repository: AssignmentRepository;
  let mockPrisma: MockPrismaClient;

  beforeEach(() => {
    mockPrisma = new MockPrismaClient();
    repository = new AssignmentRepository();
    // Inject mock prisma client
    (repository as any).assignment = mockPrisma.assignment;
    (repository as any).assignmentActivity = mockPrisma.assignmentActivity;
    (repository as any).assignmentSubmission = mockPrisma.assignmentSubmission;
    (repository as any).$transaction = mockPrisma.$transaction;
    jest.clearAllMocks();
  });

  describe('createAssignment', () => {
    test('should create assignment with activities', async () => {
      const assignmentData = {
        teacherId: 'teacher-1',
        classroomId: 'classroom-1',
        title: 'Test Assignment',
        description: 'Test description',
        instructions: 'Test instructions',
        totalPoints: 100,
        maxAttempts: 1,
        status: AssignmentStatus.draft,
        isPublished: false,
        assignedTo: [],
        activities: [
          {
            id: 'activity-1',
            type: 'quiz' as any,
            title: 'Quiz Activity',
            content: { question: 'Test?', options: ['A', 'B'], correctIndex: 0 },
            points: 10,
          },
        ],
      };

      const expectedResult = {
        id: 'assignment-1',
        ...assignmentData,
        assignmentActivities: [],
        teacher: { id: 'teacher-1', displayName: 'Teacher' },
        classroom: { id: 'classroom-1', name: 'Class 1', classCode: 'ABC123' },
        _count: { submissions: 0 },
      };

      mockPrisma.assignment.create.mockResolvedValue(expectedResult);

      const result = await repository.createAssignment(assignmentData);

      expect(result).toEqual(expectedResult);
      expect(mockPrisma.assignment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            teacherId: 'teacher-1',
            classroomId: 'classroom-1',
            title: 'Test Assignment',
          }),
        }),
      );
    });
  });

  describe('findAssignmentById', () => {
    test('should find assignment by id without submissions', async () => {
      const assignment = {
        id: 'assignment-1',
        title: 'Test Assignment',
        teacherId: 'teacher-1',
        assignmentActivities: [],
        teacher: { id: 'teacher-1', displayName: 'Teacher' },
        classroom: { id: 'classroom-1', name: 'Class 1', classCode: 'ABC123' },
        _count: { submissions: 0 },
      };

      mockPrisma.assignment.findUnique.mockResolvedValue(assignment);

      const result = await repository.findAssignmentById('assignment-1', false);

      expect(result).toEqual(assignment);
      expect(mockPrisma.assignment.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'assignment-1' },
        }),
      );
    });

    test('should find assignment by id with submissions', async () => {
      const assignment = {
        id: 'assignment-1',
        title: 'Test Assignment',
        submissions: [
          { id: 'submission-1', studentId: 'student-1' },
        ],
      };

      mockPrisma.assignment.findUnique.mockResolvedValue(assignment);

      const result = await repository.findAssignmentById('assignment-1', true);

      expect(result).toEqual(assignment);
    });

    test('should return null when assignment does not exist', async () => {
      mockPrisma.assignment.findUnique.mockResolvedValue(null);

      const result = await repository.findAssignmentById('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('findAssignmentsByClassroom', () => {
    test('should find assignments by classroom with pagination', async () => {
      const assignments = [
        { id: 'assignment-1', title: 'Test 1' },
        { id: 'assignment-2', title: 'Test 2' },
      ];

      mockPrisma.assignment.findMany.mockResolvedValue(assignments);
      mockPrisma.assignment.count.mockResolvedValue(2);

      const result = await repository.findAssignmentsByClassroom('classroom-1', {
        page: 1,
        limit: 20,
      });

      expect(result.assignments).toEqual(assignments);
      expect(result.total).toBe(2);
      expect(mockPrisma.assignment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { classroomId: 'classroom-1' },
        }),
      );
    });

    test('should filter by status when provided', async () => {
      mockPrisma.assignment.findMany.mockResolvedValue([]);
      mockPrisma.assignment.count.mockResolvedValue(0);

      await repository.findAssignmentsByClassroom('classroom-1', {
        status: AssignmentStatus.published,
        page: 1,
        limit: 20,
      });

      expect(mockPrisma.assignment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            classroomId: 'classroom-1',
            status: AssignmentStatus.published,
          }),
        }),
      );
    });
  });

  describe('findAssignmentsByTeacher', () => {
    test('should find assignments by teacher with pagination', async () => {
      const assignments = [{ id: 'assignment-1', title: 'Test 1' }];

      mockPrisma.assignment.findMany.mockResolvedValue(assignments);
      mockPrisma.assignment.count.mockResolvedValue(1);

      const result = await repository.findAssignmentsByTeacher('teacher-1', {
        page: 1,
        limit: 20,
      });

      expect(result.assignments).toEqual(assignments);
      expect(result.total).toBe(1);
    });

    test('should filter by classroomId and status when provided', async () => {
      mockPrisma.assignment.findMany.mockResolvedValue([]);
      mockPrisma.assignment.count.mockResolvedValue(0);

      await repository.findAssignmentsByTeacher('teacher-1', {
        classroomId: 'classroom-1',
        status: AssignmentStatus.draft,
        page: 1,
        limit: 20,
      });

      expect(mockPrisma.assignment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            teacherId: 'teacher-1',
            classroomId: 'classroom-1',
            status: AssignmentStatus.draft,
          }),
        }),
      );
    });
  });

  describe('updateAssignment', () => {
    test('should update assignment without activities', async () => {
      const updateData = {
        title: 'Updated Title',
        description: 'Updated description',
      };

      const updatedAssignment = {
        id: 'assignment-1',
        ...updateData,
      };

      mockPrisma.assignment.update.mockResolvedValue(updatedAssignment);
      mockPrisma.assignment.findUnique.mockResolvedValue(updatedAssignment);

      const result = await repository.updateAssignment('assignment-1', updateData);

      expect(result).toEqual(updatedAssignment);
      expect(mockPrisma.$transaction).toHaveBeenCalled();
    });

    test('should update assignment with activities', async () => {
      const updateData = {
        title: 'Updated Title',
        activities: [
          {
            id: 'activity-1',
            type: 'quiz' as any,
            title: 'New Quiz',
            content: { question: 'Test?' },
            points: 10,
          },
        ],
      };

      const updatedAssignment = {
        id: 'assignment-1',
        title: 'Updated Title',
        assignmentActivities: [{ id: 'activity-1', title: 'New Quiz' }],
      };

      mockPrisma.assignment.update.mockResolvedValue({});
      mockPrisma.assignmentActivity.deleteMany.mockResolvedValue({ count: 1 });
      mockPrisma.assignmentActivity.createMany.mockResolvedValue({ count: 1 });
      mockPrisma.assignment.findUnique.mockResolvedValue(updatedAssignment);

      const result = await repository.updateAssignment('assignment-1', updateData);

      expect(mockPrisma.$transaction).toHaveBeenCalled();
      expect(result).toEqual(updatedAssignment);
    });
  });

  describe('deleteAssignment', () => {
    test('should delete assignment', async () => {
      mockPrisma.assignment.delete.mockResolvedValue({ id: 'assignment-1' });

      await repository.deleteAssignment('assignment-1');

      expect(mockPrisma.assignment.delete).toHaveBeenCalledWith({
        where: { id: 'assignment-1' },
      });
    });
  });

  describe('publishAssignment', () => {
    test('should publish assignment by updating status', async () => {
      const publishedAssignment = {
        id: 'assignment-1',
        isPublished: true,
        status: AssignmentStatus.published,
      };

      mockPrisma.assignment.update.mockResolvedValue({});
      mockPrisma.assignment.findUnique.mockResolvedValue(publishedAssignment);

      const result = await repository.publishAssignment('assignment-1');

      expect(mockPrisma.$transaction).toHaveBeenCalled();
      expect(result).toEqual(publishedAssignment);
    });
  });

  describe('submitAssignment', () => {
    test('should create assignment submission', async () => {
      const submissionData = {
        assignmentId: 'assignment-1',
        studentId: 'student-1',
        answers: { 'activity-1': 'answer' },
        timeSpent: 300,
        attemptCount: 1,
      };

      const expectedSubmission = {
        id: 'submission-1',
        ...submissionData,
        status: 'submitted',
        student: {
          id: 'student-1',
          displayName: 'Student',
          firstName: 'Test',
          lastName: 'Student',
          email: 'student@test.com',
        },
      };

      mockPrisma.assignmentSubmission.create.mockResolvedValue(expectedSubmission);

      const result = await repository.submitAssignment(submissionData);

      expect(result).toEqual(expectedSubmission);
      expect(mockPrisma.assignmentSubmission.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            assignmentId: 'assignment-1',
            studentId: 'student-1',
            status: 'submitted',
          }),
        }),
      );
    });
  });

  describe('gradeSubmission', () => {
    test('should grade submission with score and feedback', async () => {
      const gradeData = {
        score: 85,
        feedback: 'Good work!',
      };

      const gradedSubmission = {
        id: 'submission-1',
        score: 85,
        feedback: 'Good work!',
        status: 'graded',
        student: { id: 'student-1', displayName: 'Student' },
      };

      mockPrisma.assignmentSubmission.update.mockResolvedValue(gradedSubmission);

      const result = await repository.gradeSubmission('submission-1', gradeData);

      expect(result).toEqual(gradedSubmission);
      expect(mockPrisma.assignmentSubmission.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'submission-1' },
          data: expect.objectContaining({
            score: 85,
            feedback: 'Good work!',
            status: 'graded',
          }),
        }),
      );
    });
  });

  describe('findSubmissionByAssignmentAndStudent', () => {
    test('should find submission by assignment and student', async () => {
      const submission = {
        id: 'submission-1',
        assignmentId: 'assignment-1',
        studentId: 'student-1',
        student: { id: 'student-1', displayName: 'Student' },
      };

      mockPrisma.assignmentSubmission.findFirst.mockResolvedValue(submission);

      const result = await repository.findSubmissionByAssignmentAndStudent(
        'assignment-1',
        'student-1',
      );

      expect(result).toEqual(submission);
      expect(mockPrisma.assignmentSubmission.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            assignmentId: 'assignment-1',
            studentId: 'student-1',
          }),
        }),
      );
    });

    test('should return null when submission does not exist', async () => {
      mockPrisma.assignmentSubmission.findFirst.mockResolvedValue(null);

      const result = await repository.findSubmissionByAssignmentAndStudent(
        'assignment-1',
        'student-1',
      );

      expect(result).toBeNull();
    });
  });

  describe('findAllSubmissionsByAssignmentAndStudent', () => {
    test('should find all submissions for a student and assignment', async () => {
      const submissions = [
        { id: 'submission-1', attemptCount: 1 },
        { id: 'submission-2', attemptCount: 2 },
      ];

      mockPrisma.assignmentSubmission.findMany.mockResolvedValue(submissions);

      const result = await repository.findAllSubmissionsByAssignmentAndStudent(
        'assignment-1',
        'student-1',
      );

      expect(result).toEqual(submissions);
      expect(mockPrisma.assignmentSubmission.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            assignmentId: 'assignment-1',
            studentId: 'student-1',
          },
        }),
      );
    });
  });

  describe('getSubmissionsByAssignment', () => {
    test('should get all submissions for an assignment', async () => {
      const submissions = [
        { id: 'submission-1', studentId: 'student-1' },
        { id: 'submission-2', studentId: 'student-2' },
      ];

      mockPrisma.assignmentSubmission.findMany.mockResolvedValue(submissions);

      const result = await repository.getSubmissionsByAssignment('assignment-1');

      expect(result).toEqual(submissions);
      expect(mockPrisma.assignmentSubmission.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { assignmentId: 'assignment-1' },
        }),
      );
    });
  });
});
