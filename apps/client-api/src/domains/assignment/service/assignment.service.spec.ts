import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { AssignmentStatus } from '@prisma/client';

// Mock shared module imports to avoid initialization errors
jest.mock('@app/shared', () => ({
  GeminiService: class MockGeminiService {},
  SharedModule: class MockSharedModule {},
}));

import { AssignmentService } from './assignment.service';

// Minimal mock implementations for dependencies
const makeMocks = () => {
  const assignmentRepository: any = {
    createAssignment: jest.fn(),
    findAssignmentById: jest.fn(),
    updateAssignment: jest.fn(),
    deleteAssignment: jest.fn(),
    publishAssignment: jest.fn(),
    findAssignmentsByClassroom: jest.fn(),
    findAssignmentsByTeacher: jest.fn(),
    submitAssignment: jest.fn(),
    gradeSubmission: jest.fn(),
    getSubmissionsByAssignment: jest.fn(),
    findSubmissionByAssignmentAndStudent: jest.fn(),
    findAllSubmissionsByAssignmentAndStudent: jest.fn(),
  };

  const geminiService: any = {
    generateAttemptFeedback: jest.fn(),
  };

  return { assignmentRepository, geminiService };
};

describe('AssignmentService', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  describe('createAssignment', () => {
    test('should create a new assignment with draft status when not published', async () => {
      const { assignmentRepository, geminiService } = makeMocks();

      const dto = {
        title: 'Test Assignment',
        description: 'Test description',
        instructions: 'Test instructions',
        totalPoints: 100,
        maxAttempts: 1,
        isPublished: false,
        assignedTo: [],
        activities: [
          {
            id: 'activity-1',
            type: 'quiz' as any,
            title: 'Quiz Activity',
            content: {
              question: 'What is 2+2?',
              options: ['3', '4', '5'],
              correctIndex: 1,
            },
            points: 10,
          },
        ],
      };

      const expectedAssignment = {
        id: 'assignment-1',
        teacherId: 'teacher-1',
        classroomId: 'classroom-1',
        title: dto.title,
        status: AssignmentStatus.draft,
        isPublished: false,
        assignmentActivities: [],
        _count: { submissions: 0 },
      };

      assignmentRepository.createAssignment.mockResolvedValue(
        expectedAssignment,
      );

      const service = new AssignmentService(
        assignmentRepository,
        geminiService,
      );
      const result = await service.createAssignment(
        'teacher-1',
        dto,
        'classroom-1',
      );

      expect(result).toEqual(expectedAssignment);
      expect(assignmentRepository.createAssignment).toHaveBeenCalledWith(
        expect.objectContaining({
          teacherId: 'teacher-1',
          classroomId: 'classroom-1',
          title: dto.title,
          status: AssignmentStatus.draft,
          isPublished: false,
        }),
      );
    });

    test('should create a new assignment with published status when isPublished is true', async () => {
      const { assignmentRepository, geminiService } = makeMocks();

      const dto = {
        title: 'Published Assignment',
        description: 'Test description',
        isPublished: true,
        activities: [],
      };

      const expectedAssignment = {
        id: 'assignment-2',
        status: AssignmentStatus.published,
        isPublished: true,
      };

      assignmentRepository.createAssignment.mockResolvedValue(
        expectedAssignment,
      );

      const service = new AssignmentService(
        assignmentRepository,
        geminiService,
      );
      await service.createAssignment('teacher-1', dto, 'classroom-1');

      expect(assignmentRepository.createAssignment).toHaveBeenCalledWith(
        expect.objectContaining({
          status: AssignmentStatus.published,
          isPublished: true,
        }),
      );
    });
  });

  describe('getAssignmentById', () => {
    test('should return assignment when it exists', async () => {
      const { assignmentRepository, geminiService } = makeMocks();

      const assignment = {
        id: 'assignment-1',
        title: 'Test Assignment',
        teacherId: 'teacher-1',
      };

      assignmentRepository.findAssignmentById.mockResolvedValue(assignment);

      const service = new AssignmentService(
        assignmentRepository,
        geminiService,
      );
      const result = await service.getAssignmentById('assignment-1');

      expect(result).toEqual(assignment);
      expect(assignmentRepository.findAssignmentById).toHaveBeenCalledWith(
        'assignment-1',
        false,
      );
    });

    test('should throw NotFoundException when assignment does not exist', async () => {
      const { assignmentRepository, geminiService } = makeMocks();

      assignmentRepository.findAssignmentById.mockResolvedValue(null);

      const service = new AssignmentService(
        assignmentRepository,
        geminiService,
      );

      await expect(service.getAssignmentById('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('updateAssignment', () => {
    test('should update assignment when teacher owns it', async () => {
      const { assignmentRepository, geminiService } = makeMocks();

      const existingAssignment = {
        id: 'assignment-1',
        teacherId: 'teacher-1',
        title: 'Old Title',
        status: AssignmentStatus.draft,
      };

      const updateDto = {
        title: 'New Title',
        description: 'Updated description',
      };

      const updatedAssignment = {
        ...existingAssignment,
        ...updateDto,
      };

      assignmentRepository.findAssignmentById.mockResolvedValue(
        existingAssignment,
      );
      assignmentRepository.updateAssignment.mockResolvedValue(
        updatedAssignment,
      );

      const service = new AssignmentService(
        assignmentRepository,
        geminiService,
      );
      const result = await service.updateAssignment(
        'assignment-1',
        'teacher-1',
        updateDto,
      );

      expect(result).toEqual(updatedAssignment);
      expect(assignmentRepository.updateAssignment).toHaveBeenCalled();
    });

    test('should throw ForbiddenException when teacher does not own the assignment', async () => {
      const { assignmentRepository, geminiService } = makeMocks();

      const existingAssignment = {
        id: 'assignment-1',
        teacherId: 'teacher-1',
        title: 'Test Assignment',
      };

      assignmentRepository.findAssignmentById.mockResolvedValue(
        existingAssignment,
      );

      const service = new AssignmentService(
        assignmentRepository,
        geminiService,
      );

      await expect(
        service.updateAssignment('assignment-1', 'teacher-2', {
          title: 'New Title',
        }),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('deleteAssignment', () => {
    test('should delete assignment when teacher owns it and no submissions exist', async () => {
      const { assignmentRepository, geminiService } = makeMocks();

      const existingAssignment = {
        id: 'assignment-1',
        teacherId: 'teacher-1',
        _count: { submissions: 0 },
      };

      assignmentRepository.findAssignmentById.mockResolvedValue(
        existingAssignment,
      );
      assignmentRepository.deleteAssignment.mockResolvedValue(undefined);

      const service = new AssignmentService(
        assignmentRepository,
        geminiService,
      );
      await service.deleteAssignment('assignment-1', 'teacher-1');

      expect(assignmentRepository.deleteAssignment).toHaveBeenCalledWith(
        'assignment-1',
      );
    });

    test('should throw ForbiddenException when teacher does not own the assignment', async () => {
      const { assignmentRepository, geminiService } = makeMocks();

      const existingAssignment = {
        id: 'assignment-1',
        teacherId: 'teacher-1',
        _count: { submissions: 0 },
      };

      assignmentRepository.findAssignmentById.mockResolvedValue(
        existingAssignment,
      );

      const service = new AssignmentService(
        assignmentRepository,
        geminiService,
      );

      await expect(
        service.deleteAssignment('assignment-1', 'teacher-2'),
      ).rejects.toThrow(ForbiddenException);
    });

    test('should throw BadRequestException when assignment has submissions', async () => {
      const { assignmentRepository, geminiService } = makeMocks();

      const existingAssignment = {
        id: 'assignment-1',
        teacherId: 'teacher-1',
        _count: { submissions: 5 },
      };

      assignmentRepository.findAssignmentById.mockResolvedValue(
        existingAssignment,
      );

      const service = new AssignmentService(
        assignmentRepository,
        geminiService,
      );

      await expect(
        service.deleteAssignment('assignment-1', 'teacher-1'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('publishAssignment', () => {
    test('should publish assignment when teacher owns it and it is not already published', async () => {
      const { assignmentRepository, geminiService } = makeMocks();

      const existingAssignment = {
        id: 'assignment-1',
        teacherId: 'teacher-1',
        isPublished: false,
      };

      const publishedAssignment = {
        ...existingAssignment,
        isPublished: true,
        status: AssignmentStatus.published,
      };

      assignmentRepository.findAssignmentById.mockResolvedValue(
        existingAssignment,
      );
      assignmentRepository.publishAssignment.mockResolvedValue(
        publishedAssignment,
      );

      const service = new AssignmentService(
        assignmentRepository,
        geminiService,
      );
      const result = await service.publishAssignment(
        'assignment-1',
        'teacher-1',
      );

      expect(result).toEqual(publishedAssignment);
      expect(assignmentRepository.publishAssignment).toHaveBeenCalledWith(
        'assignment-1',
      );
    });

    test('should throw ForbiddenException when teacher does not own the assignment', async () => {
      const { assignmentRepository, geminiService } = makeMocks();

      const existingAssignment = {
        id: 'assignment-1',
        teacherId: 'teacher-1',
        isPublished: false,
      };

      assignmentRepository.findAssignmentById.mockResolvedValue(
        existingAssignment,
      );

      const service = new AssignmentService(
        assignmentRepository,
        geminiService,
      );

      await expect(
        service.publishAssignment('assignment-1', 'teacher-2'),
      ).rejects.toThrow(ForbiddenException);
    });

    test('should throw BadRequestException when assignment is already published', async () => {
      const { assignmentRepository, geminiService } = makeMocks();

      const existingAssignment = {
        id: 'assignment-1',
        teacherId: 'teacher-1',
        isPublished: true,
      };

      assignmentRepository.findAssignmentById.mockResolvedValue(
        existingAssignment,
      );

      const service = new AssignmentService(
        assignmentRepository,
        geminiService,
      );

      await expect(
        service.publishAssignment('assignment-1', 'teacher-1'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('submitAssignment', () => {
    test('should submit assignment successfully when all conditions are met', async () => {
      const { assignmentRepository, geminiService } = makeMocks();

      const assignment = {
        id: 'assignment-1',
        isPublished: true,
        dueDate: new Date(Date.now() + 86400000), // Tomorrow
        assignedTo: ['student-1'],
        maxAttempts: 3,
        totalPoints: 100,
        assignmentActivities: [
          {
            id: 'activity-1',
            type: 'quiz',
            content: { correctIndex: 1 },
            points: 10,
          },
        ],
      };

      const submitDto = {
        answers: { 'activity-1': 1 },
        timeSpent: 300,
      };

      const expectedSubmission = {
        id: 'submission-1',
        assignmentId: 'assignment-1',
        studentId: 'student-1',
        score: 100,
        attemptCount: 1,
      };

      assignmentRepository.findAssignmentById.mockResolvedValue(assignment);
      assignmentRepository.findSubmissionByAssignmentAndStudent.mockResolvedValue(
        null,
      );
      assignmentRepository.submitAssignment.mockResolvedValue(
        expectedSubmission,
      );
      assignmentRepository.gradeSubmission.mockResolvedValue(
        expectedSubmission,
      );
      geminiService.generateAttemptFeedback.mockResolvedValue('Great job!');

      const service = new AssignmentService(
        assignmentRepository,
        geminiService,
      );
      const result = await service.submitAssignment(
        'assignment-1',
        'student-1',
        submitDto,
      );

      expect(result).toBeDefined();
      expect(assignmentRepository.submitAssignment).toHaveBeenCalled();
    });

    test('should throw BadRequestException when assignment is not published', async () => {
      const { assignmentRepository, geminiService } = makeMocks();

      const assignment = {
        id: 'assignment-1',
        isPublished: false,
      };

      assignmentRepository.findAssignmentById.mockResolvedValue(assignment);

      const service = new AssignmentService(
        assignmentRepository,
        geminiService,
      );

      await expect(
        service.submitAssignment('assignment-1', 'student-1', {
          answers: {},
          timeSpent: 0,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    test('should throw BadRequestException when deadline has passed', async () => {
      const { assignmentRepository, geminiService } = makeMocks();

      const assignment = {
        id: 'assignment-1',
        isPublished: true,
        dueDate: new Date(Date.now() - 86400000), // Yesterday
      };

      assignmentRepository.findAssignmentById.mockResolvedValue(assignment);

      const service = new AssignmentService(
        assignmentRepository,
        geminiService,
      );

      await expect(
        service.submitAssignment('assignment-1', 'student-1', {
          answers: {},
          timeSpent: 0,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    test('should throw ForbiddenException when student is not assigned to the assignment', async () => {
      const { assignmentRepository, geminiService } = makeMocks();

      const assignment = {
        id: 'assignment-1',
        isPublished: true,
        dueDate: null,
        assignedTo: ['student-2', 'student-3'],
      };

      assignmentRepository.findAssignmentById.mockResolvedValue(assignment);

      const service = new AssignmentService(
        assignmentRepository,
        geminiService,
      );

      await expect(
        service.submitAssignment('assignment-1', 'student-1', {
          answers: {},
          timeSpent: 0,
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    test('should throw BadRequestException when maximum attempts exceeded', async () => {
      const { assignmentRepository, geminiService } = makeMocks();

      const assignment = {
        id: 'assignment-1',
        isPublished: true,
        dueDate: null,
        assignedTo: [],
        maxAttempts: 2,
      };

      const existingSubmission = {
        id: 'submission-1',
        attemptCount: 2,
      };

      assignmentRepository.findAssignmentById.mockResolvedValue(assignment);
      assignmentRepository.findSubmissionByAssignmentAndStudent.mockResolvedValue(
        existingSubmission,
      );

      const service = new AssignmentService(
        assignmentRepository,
        geminiService,
      );

      await expect(
        service.submitAssignment('assignment-1', 'student-1', {
          answers: {},
          timeSpent: 0,
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('gradeSubmission', () => {
    test('should grade submission successfully', async () => {
      const { assignmentRepository, geminiService } = makeMocks();

      const gradeDto = {
        score: 85,
        feedback: 'Good work!',
      };

      const gradedSubmission = {
        id: 'submission-1',
        score: 85,
        feedback: 'Good work!',
        status: 'graded',
      };

      assignmentRepository.gradeSubmission.mockResolvedValue(gradedSubmission);

      const service = new AssignmentService(
        assignmentRepository,
        geminiService,
      );
      const result = await service.gradeSubmission(
        'submission-1',
        'teacher-1',
        gradeDto,
      );

      expect(result).toEqual(gradedSubmission);
      expect(assignmentRepository.gradeSubmission).toHaveBeenCalledWith(
        'submission-1',
        {
          score: 85,
          feedback: 'Good work!',
        },
      );
    });
  });

  describe('getSubmissionsByAssignment', () => {
    test('should return submissions when teacher owns the assignment', async () => {
      const { assignmentRepository, geminiService } = makeMocks();

      const assignment = {
        id: 'assignment-1',
        teacherId: 'teacher-1',
      };

      const submissions = [
        { id: 'submission-1', studentId: 'student-1' },
        { id: 'submission-2', studentId: 'student-2' },
      ];

      assignmentRepository.findAssignmentById.mockResolvedValue(assignment);
      assignmentRepository.getSubmissionsByAssignment.mockResolvedValue(
        submissions,
      );

      const service = new AssignmentService(
        assignmentRepository,
        geminiService,
      );
      const result = await service.getSubmissionsByAssignment(
        'assignment-1',
        'teacher-1',
      );

      expect(result).toEqual(submissions);
      expect(
        assignmentRepository.getSubmissionsByAssignment,
      ).toHaveBeenCalledWith('assignment-1');
    });

    test('should throw ForbiddenException when teacher does not own the assignment', async () => {
      const { assignmentRepository, geminiService } = makeMocks();

      const assignment = {
        id: 'assignment-1',
        teacherId: 'teacher-1',
      };

      assignmentRepository.findAssignmentById.mockResolvedValue(assignment);

      const service = new AssignmentService(
        assignmentRepository,
        geminiService,
      );

      await expect(
        service.getSubmissionsByAssignment('assignment-1', 'teacher-2'),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('getAssignmentsByClassroom', () => {
    test('should return paginated assignments for a classroom', async () => {
      const { assignmentRepository, geminiService } = makeMocks();

      const mockResult = {
        assignments: [
          { id: 'assignment-1', title: 'Test 1' },
          { id: 'assignment-2', title: 'Test 2' },
        ],
        total: 2,
      };

      assignmentRepository.findAssignmentsByClassroom.mockResolvedValue(
        mockResult,
      );

      const service = new AssignmentService(
        assignmentRepository,
        geminiService,
      );
      const result = await service.getAssignmentsByClassroom('classroom-1', {
        page: 1,
        limit: 20,
      });

      expect(result.assignments).toEqual(mockResult.assignments);
      expect(result.total).toBe(2);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
    });
  });

  describe('getAssignmentsByTeacher', () => {
    test('should return paginated assignments for a teacher', async () => {
      const { assignmentRepository, geminiService } = makeMocks();

      const mockResult = {
        assignments: [{ id: 'assignment-1', title: 'Test 1' }],
        total: 1,
      };

      assignmentRepository.findAssignmentsByTeacher.mockResolvedValue(
        mockResult,
      );

      const service = new AssignmentService(
        assignmentRepository,
        geminiService,
      );
      const result = await service.getAssignmentsByTeacher('teacher-1', {
        page: 1,
        limit: 20,
      });

      expect(result.assignments).toEqual(mockResult.assignments);
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
    });
  });
});
