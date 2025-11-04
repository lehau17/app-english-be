import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { CourseService } from './course.service';

// Minimal mock implementations for dependencies
const makeMocks = () => {
  const courseRepository: any = {
    create: jest.fn(),
    findById: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    list: jest.fn(),
  };

  const prisma: any = {
    user: {
      findUnique: jest.fn(),
    },
    course: {
      findFirst: jest.fn(),
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
      findMany: jest.fn(),
    },
    lesson: {
      create: jest.fn(),
    },
    activity: {
      create: jest.fn(),
    },
    sessionSchedule: {
      create: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  const googleTranslateFreeService: any = {
    createAudioWithUrl: jest.fn(),
  };

  const kafkaService: any = {
    send: jest.fn(),
  };

  const sessionScheduleService: any = {
    createSessionSchedules: jest.fn(),
  };

  return {
    courseRepository,
    prisma,
    googleTranslateFreeService,
    kafkaService,
    sessionScheduleService,
  };
};

describe('CourseService', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  describe('findById', () => {
    it('should return course with all relations when found', async () => {
      const {
        courseRepository,
        prisma,
        googleTranslateFreeService,
        kafkaService,
        sessionScheduleService,
      } = makeMocks();

      const mockCourse = {
        id: 'course-1',
        title: 'Test Course',
        description: 'Test Description',
        difficulty: 'beginner',
        instructor: {
          id: 'instructor-1',
          firstName: 'John',
          lastName: 'Doe',
          email: 'john@example.com',
          displayName: 'John Doe',
          avatarUrl: null,
        },
        lessons: [],
        sessionSchedules: [],
      };

      prisma.course.findUnique.mockResolvedValue(mockCourse);

      const service = new CourseService(
        courseRepository,
        prisma,
        googleTranslateFreeService,
        kafkaService,
        sessionScheduleService,
      );

      const result = await service.findById('course-1');

      expect(result).toEqual(mockCourse);
      expect(prisma.course.findUnique).toHaveBeenCalledWith({
        where: { id: 'course-1' },
        include: expect.any(Object),
      });
    });

    it('should throw NotFoundException when course not found', async () => {
      const {
        courseRepository,
        prisma,
        googleTranslateFreeService,
        kafkaService,
        sessionScheduleService,
      } = makeMocks();

      prisma.course.findUnique.mockResolvedValue(null);

      const service = new CourseService(
        courseRepository,
        prisma,
        googleTranslateFreeService,
        kafkaService,
        sessionScheduleService,
      );

      await expect(service.findById('non-existent')).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.findById('non-existent')).rejects.toThrow(
        'Course with id non-existent not found',
      );
    });
  });

  describe('delete', () => {
    it('should delete course when it exists', async () => {
      const {
        courseRepository,
        prisma,
        googleTranslateFreeService,
        kafkaService,
        sessionScheduleService,
      } = makeMocks();

      const mockCourse = { id: 'course-1', title: 'Test Course' };
      courseRepository.findById.mockResolvedValue(mockCourse);
      courseRepository.delete.mockResolvedValue(mockCourse);

      const service = new CourseService(
        courseRepository,
        prisma,
        googleTranslateFreeService,
        kafkaService,
        sessionScheduleService,
      );

      const result = await service.delete('course-1');

      expect(result).toEqual(mockCourse);
      expect(courseRepository.findById).toHaveBeenCalledWith('course-1');
      expect(courseRepository.delete).toHaveBeenCalledWith('course-1');
    });

    it('should throw NotFoundException when course does not exist', async () => {
      const {
        courseRepository,
        prisma,
        googleTranslateFreeService,
        kafkaService,
        sessionScheduleService,
      } = makeMocks();

      courseRepository.findById.mockResolvedValue(null);

      const service = new CourseService(
        courseRepository,
        prisma,
        googleTranslateFreeService,
        kafkaService,
        sessionScheduleService,
      );

      await expect(service.delete('non-existent')).rejects.toThrow(
        NotFoundException,
      );
      expect(courseRepository.delete).not.toHaveBeenCalled();
    });
  });

  describe('list', () => {
    it('should return paginated courses', async () => {
      const {
        courseRepository,
        prisma,
        googleTranslateFreeService,
        kafkaService,
        sessionScheduleService,
      } = makeMocks();

      const mockPageResponse = {
        data: [
          { id: 'course-1', title: 'Course 1' },
          { id: 'course-2', title: 'Course 2' },
        ],
        meta: {
          page: 1,
          limit: 10,
          totalItems: 2,
          totalPages: 1,
        },
      };

      courseRepository.list.mockResolvedValue(mockPageResponse);

      const service = new CourseService(
        courseRepository,
        prisma,
        googleTranslateFreeService,
        kafkaService,
        sessionScheduleService,
      );

      const params = { page: 1, limit: 10 };
      const result = await service.list(params);

      expect(result).toEqual(mockPageResponse);
      expect(courseRepository.list).toHaveBeenCalledWith(params);
    });
  });

  describe('publish', () => {
    it('should publish course when it exists', async () => {
      const {
        courseRepository,
        prisma,
        googleTranslateFreeService,
        kafkaService,
        sessionScheduleService,
      } = makeMocks();

      const mockCourse = { id: 'course-1', isPublished: false };
      const publishedCourse = { ...mockCourse, isPublished: true };

      courseRepository.findById.mockResolvedValue(mockCourse);
      courseRepository.update.mockResolvedValue(publishedCourse);

      const service = new CourseService(
        courseRepository,
        prisma,
        googleTranslateFreeService,
        kafkaService,
        sessionScheduleService,
      );

      const result = await service.publish('course-1');

      expect(result).toEqual(publishedCourse);
      expect(courseRepository.update).toHaveBeenCalledWith('course-1', {
        isPublished: true,
      });
    });

    it('should throw NotFoundException when course does not exist', async () => {
      const {
        courseRepository,
        prisma,
        googleTranslateFreeService,
        kafkaService,
        sessionScheduleService,
      } = makeMocks();

      courseRepository.findById.mockResolvedValue(null);

      const service = new CourseService(
        courseRepository,
        prisma,
        googleTranslateFreeService,
        kafkaService,
        sessionScheduleService,
      );

      await expect(service.publish('non-existent')).rejects.toThrow(
        NotFoundException,
      );
      expect(courseRepository.update).not.toHaveBeenCalled();
    });
  });

  describe('unpublish', () => {
    it('should unpublish course when it exists', async () => {
      const {
        courseRepository,
        prisma,
        googleTranslateFreeService,
        kafkaService,
        sessionScheduleService,
      } = makeMocks();

      const mockCourse = { id: 'course-1', isPublished: true };
      const unpublishedCourse = { ...mockCourse, isPublished: false };

      courseRepository.findById.mockResolvedValue(mockCourse);
      courseRepository.update.mockResolvedValue(unpublishedCourse);

      const service = new CourseService(
        courseRepository,
        prisma,
        googleTranslateFreeService,
        kafkaService,
        sessionScheduleService,
      );

      const result = await service.unpublish('course-1');

      expect(result).toEqual(unpublishedCourse);
      expect(courseRepository.update).toHaveBeenCalledWith('course-1', {
        isPublished: false,
      });
    });

    it('should throw NotFoundException when course does not exist', async () => {
      const {
        courseRepository,
        prisma,
        googleTranslateFreeService,
        kafkaService,
        sessionScheduleService,
      } = makeMocks();

      courseRepository.findById.mockResolvedValue(null);

      const service = new CourseService(
        courseRepository,
        prisma,
        googleTranslateFreeService,
        kafkaService,
        sessionScheduleService,
      );

      await expect(service.unpublish('non-existent')).rejects.toThrow(
        NotFoundException,
      );
      expect(courseRepository.update).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('should update course when valid data is provided', async () => {
      const {
        courseRepository,
        prisma,
        googleTranslateFreeService,
        kafkaService,
        sessionScheduleService,
      } = makeMocks();

      const mockCourse = { id: 'course-1', title: 'Old Title' };
      const updatedCourse = { ...mockCourse, title: 'New Title' };

      courseRepository.findById.mockResolvedValue(mockCourse);
      courseRepository.update.mockResolvedValue(updatedCourse);

      const service = new CourseService(
        courseRepository,
        prisma,
        googleTranslateFreeService,
        kafkaService,
        sessionScheduleService,
      );

      const dto = { title: 'New Title' };
      const result = await service.update('course-1', dto);

      expect(result).toEqual(updatedCourse);
      expect(courseRepository.update).toHaveBeenCalled();
    });

    it('should throw BadRequestException when price is negative', async () => {
      const {
        courseRepository,
        prisma,
        googleTranslateFreeService,
        kafkaService,
        sessionScheduleService,
      } = makeMocks();

      courseRepository.findById.mockResolvedValue({ id: 'course-1' });

      const service = new CourseService(
        courseRepository,
        prisma,
        googleTranslateFreeService,
        kafkaService,
        sessionScheduleService,
      );

      const dto = { price: -100 };

      await expect(service.update('course-1', dto)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.update('course-1', dto)).rejects.toThrow(
        'Giá không được âm',
      );
    });

    it('should throw ConflictException when orderNo is already used', async () => {
      const {
        courseRepository,
        prisma,
        googleTranslateFreeService,
        kafkaService,
        sessionScheduleService,
      } = makeMocks();

      courseRepository.findById.mockResolvedValue({ id: 'course-1' });
      prisma.course.findFirst.mockResolvedValue({ id: 'course-2', orderNo: 5 });

      const service = new CourseService(
        courseRepository,
        prisma,
        googleTranslateFreeService,
        kafkaService,
        sessionScheduleService,
      );

      const dto = { orderNo: 5 };

      await expect(service.update('course-1', dto)).rejects.toThrow(
        ConflictException,
      );
      await expect(service.update('course-1', dto)).rejects.toThrow(
        'orderNo đã được dùng cho khóa học khác',
      );
    });

    it('should throw NotFoundException when course does not exist', async () => {
      const {
        courseRepository,
        prisma,
        googleTranslateFreeService,
        kafkaService,
        sessionScheduleService,
      } = makeMocks();

      courseRepository.findById.mockResolvedValue(null);

      const service = new CourseService(
        courseRepository,
        prisma,
        googleTranslateFreeService,
        kafkaService,
        sessionScheduleService,
      );

      await expect(
        service.update('non-existent', { title: 'New Title' }),
      ).rejects.toThrow(NotFoundException);
      expect(courseRepository.update).not.toHaveBeenCalled();
    });
  });

  describe('create', () => {
    it('should throw BadRequestException when instructor does not exist', async () => {
      const {
        courseRepository,
        prisma,
        googleTranslateFreeService,
        kafkaService,
        sessionScheduleService,
      } = makeMocks();

      prisma.user.findUnique.mockResolvedValue(null);

      const service = new CourseService(
        courseRepository,
        prisma,
        googleTranslateFreeService,
        kafkaService,
        sessionScheduleService,
      );

      const dto: any = {
        title: 'Test Course',
        difficulty: 'beginner',
        instructorId: 'non-existent-instructor',
        lessons: [],
      };

      await expect(service.create(dto)).rejects.toThrow(BadRequestException);
      await expect(service.create(dto)).rejects.toThrow(
        'Instructor không tồn tại',
      );
    });

    it('should throw BadRequestException when instructor is not teacher or admin', async () => {
      const {
        courseRepository,
        prisma,
        googleTranslateFreeService,
        kafkaService,
        sessionScheduleService,
      } = makeMocks();

      prisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        role: UserRole.student,
      });

      const service = new CourseService(
        courseRepository,
        prisma,
        googleTranslateFreeService,
        kafkaService,
        sessionScheduleService,
      );

      const dto: any = {
        title: 'Test Course',
        difficulty: 'beginner',
        instructorId: 'user-1',
        lessons: [],
      };

      await expect(service.create(dto)).rejects.toThrow(BadRequestException);
      await expect(service.create(dto)).rejects.toThrow(
        'Instructor phải có vai trò TEACHER hoặc ADMIN',
      );
    });

    it('should throw BadRequestException when price is negative', async () => {
      const {
        courseRepository,
        prisma,
        googleTranslateFreeService,
        kafkaService,
        sessionScheduleService,
      } = makeMocks();

      prisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        role: UserRole.teacher,
      });

      const service = new CourseService(
        courseRepository,
        prisma,
        googleTranslateFreeService,
        kafkaService,
        sessionScheduleService,
      );

      const dto: any = {
        title: 'Test Course',
        difficulty: 'beginner',
        instructorId: 'user-1',
        price: -100,
        lessons: [],
      };

      await expect(service.create(dto)).rejects.toThrow(BadRequestException);
      await expect(service.create(dto)).rejects.toThrow('Giá không được âm');
    });

    it('should throw ConflictException when orderNo is already used', async () => {
      const {
        courseRepository,
        prisma,
        googleTranslateFreeService,
        kafkaService,
        sessionScheduleService,
      } = makeMocks();

      prisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        role: UserRole.teacher,
      });

      prisma.course.findFirst.mockResolvedValue({
        id: 'existing-course',
        orderNo: 1,
      });

      const service = new CourseService(
        courseRepository,
        prisma,
        googleTranslateFreeService,
        kafkaService,
        sessionScheduleService,
      );

      const dto: any = {
        title: 'Test Course',
        difficulty: 'beginner',
        instructorId: 'user-1',
        orderNo: 1,
        lessons: [],
      };

      await expect(service.create(dto)).rejects.toThrow(ConflictException);
      await expect(service.create(dto)).rejects.toThrow(
        'orderNo đã được dùng cho khóa học khác',
      );
    });

    it('should throw BadRequestException when lesson orderNo is duplicated', async () => {
      const {
        courseRepository,
        prisma,
        googleTranslateFreeService,
        kafkaService,
        sessionScheduleService,
      } = makeMocks();

      prisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        role: UserRole.teacher,
      });

      prisma.course.findFirst.mockResolvedValue(null);

      const service = new CourseService(
        courseRepository,
        prisma,
        googleTranslateFreeService,
        kafkaService,
        sessionScheduleService,
      );

      const dto: any = {
        title: 'Test Course',
        difficulty: 'beginner',
        instructorId: 'user-1',
        lessons: [
          {
            title: 'Lesson 1',
            orderNo: 1,
            activities: [],
          },
          {
            title: 'Lesson 2',
            orderNo: 1, // duplicate
            activities: [],
          },
        ],
      };

      await expect(service.create(dto)).rejects.toThrow(BadRequestException);
      await expect(service.create(dto)).rejects.toThrow(
        'Trùng orderNo giữa các lesson: 1',
      );
    });

    it('should throw BadRequestException when activity orderNo is duplicated within a lesson', async () => {
      const {
        courseRepository,
        prisma,
        googleTranslateFreeService,
        kafkaService,
        sessionScheduleService,
      } = makeMocks();

      prisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        role: UserRole.teacher,
      });

      prisma.course.findFirst.mockResolvedValue(null);

      const service = new CourseService(
        courseRepository,
        prisma,
        googleTranslateFreeService,
        kafkaService,
        sessionScheduleService,
      );

      const dto: any = {
        title: 'Test Course',
        difficulty: 'beginner',
        instructorId: 'user-1',
        lessons: [
          {
            title: 'Lesson 1',
            orderNo: 1,
            activities: [
              {
                type: 'vocab',
                title: 'Activity 1',
                orderNo: 1,
                content: {},
              },
              {
                type: 'vocab',
                title: 'Activity 2',
                orderNo: 1, // duplicate
                content: {},
              },
            ],
          },
        ],
      };

      await expect(service.create(dto)).rejects.toThrow(BadRequestException);
      await expect(service.create(dto)).rejects.toThrow(
        'Trùng orderNo trong activities của lesson "Lesson 1": 1',
      );
    });
  });
});
