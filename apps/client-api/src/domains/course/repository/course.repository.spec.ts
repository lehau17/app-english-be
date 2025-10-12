import { CourseRepository } from './course.repository';
import { PageResponseDto } from '@app/shared/payload/response/page-response.dto';

// Minimal mock implementations for dependencies
const makeMocks = () => {
  const prisma: any = {
    course: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
    },
  };

  return { prisma };
};

describe('CourseRepository', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  describe('create', () => {
    it('should create a course with provided data', async () => {
      const { prisma } = makeMocks();

      const courseData = {
        title: 'Test Course',
        description: 'Test Description',
        difficulty: 'beginner',
        instructor: { connect: { id: 'instructor-1' } },
      };

      const createdCourse = {
        id: 'course-1',
        title: 'Test Course',
        description: 'Test Description',
        difficulty: 'beginner',
        instructorId: 'instructor-1',
      };

      prisma.course.create.mockResolvedValue(createdCourse);

      const repository = new CourseRepository(prisma);
      const result = await repository.create(courseData as any);

      expect(result).toEqual(createdCourse);
      expect(prisma.course.create).toHaveBeenCalledWith({ data: courseData });
    });
  });

  describe('findById', () => {
    it('should return course when found', async () => {
      const { prisma } = makeMocks();

      const mockCourse = {
        id: 'course-1',
        title: 'Test Course',
      };

      prisma.course.findUnique.mockResolvedValue(mockCourse);

      const repository = new CourseRepository(prisma);
      const result = await repository.findById('course-1');

      expect(result).toEqual(mockCourse);
      expect(prisma.course.findUnique).toHaveBeenCalledWith({
        where: { id: 'course-1' },
      });
    });

    it('should return null when course not found', async () => {
      const { prisma } = makeMocks();

      prisma.course.findUnique.mockResolvedValue(null);

      const repository = new CourseRepository(prisma);
      const result = await repository.findById('non-existent');

      expect(result).toBeNull();
      expect(prisma.course.findUnique).toHaveBeenCalledWith({
        where: { id: 'non-existent' },
      });
    });
  });

  describe('update', () => {
    it('should update course with provided data', async () => {
      const { prisma } = makeMocks();

      const updateData = {
        title: 'Updated Title',
        description: 'Updated Description',
      };

      const updatedCourse = {
        id: 'course-1',
        title: 'Updated Title',
        description: 'Updated Description',
      };

      prisma.course.update.mockResolvedValue(updatedCourse);

      const repository = new CourseRepository(prisma);
      const result = await repository.update('course-1', updateData);

      expect(result).toEqual(updatedCourse);
      expect(prisma.course.update).toHaveBeenCalledWith({
        where: { id: 'course-1' },
        data: updateData,
      });
    });
  });

  describe('delete', () => {
    it('should delete course by id', async () => {
      const { prisma } = makeMocks();

      const deletedCourse = {
        id: 'course-1',
        title: 'Deleted Course',
      };

      prisma.course.delete.mockResolvedValue(deletedCourse);

      const repository = new CourseRepository(prisma);
      const result = await repository.delete('course-1');

      expect(result).toEqual(deletedCourse);
      expect(prisma.course.delete).toHaveBeenCalledWith({
        where: { id: 'course-1' },
      });
    });
  });

  describe('list', () => {
    it('should return paginated courses with default parameters', async () => {
      const { prisma } = makeMocks();

      const mockCourses = [
        { id: 'course-1', title: 'Course 1', orderNo: 1 },
        { id: 'course-2', title: 'Course 2', orderNo: 2 },
      ];

      prisma.course.count.mockResolvedValue(2);
      prisma.course.findMany.mockResolvedValue(mockCourses);

      const repository = new CourseRepository(prisma);
      const result = await repository.list({});

      expect(result).toBeInstanceOf(PageResponseDto);
      const expectedResult = PageResponseDto.of(mockCourses, 1, 10, 2);
      expect(result).toEqual(expectedResult);

      expect(prisma.course.count).toHaveBeenCalled();
      expect(prisma.course.findMany).toHaveBeenCalledWith({
        where: {},
        skip: 0,
        take: 10,
        orderBy: { orderNo: 'asc' },
      });
    });

    it('should filter courses by search term', async () => {
      const { prisma } = makeMocks();

      const mockCourses = [{ id: 'course-1', title: 'English Grammar' }];

      prisma.course.count.mockResolvedValue(1);
      prisma.course.findMany.mockResolvedValue(mockCourses);

      const repository = new CourseRepository(prisma);
      const result = await repository.list({ search: 'English' });

      expect(result.data).toEqual(mockCourses);
      expect(prisma.course.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            OR: [
              { title: { contains: 'English', mode: 'insensitive' } },
              { description: { contains: 'English', mode: 'insensitive' } },
            ],
          },
        }),
      );
    });

    it('should filter courses by difficulty', async () => {
      const { prisma } = makeMocks();

      const mockCourses = [
        { id: 'course-1', title: 'Beginner Course', difficulty: 'beginner' },
      ];

      prisma.course.count.mockResolvedValue(1);
      prisma.course.findMany.mockResolvedValue(mockCourses);

      const repository = new CourseRepository(prisma);
      const result = await repository.list({ difficulty: 'beginner' as any });

      expect(result.data).toEqual(mockCourses);
      expect(prisma.course.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { difficulty: 'beginner' },
        }),
      );
    });

    it('should filter courses by isPublished', async () => {
      const { prisma } = makeMocks();

      const mockCourses = [
        { id: 'course-1', title: 'Published Course', isPublished: true },
      ];

      prisma.course.count.mockResolvedValue(1);
      prisma.course.findMany.mockResolvedValue(mockCourses);

      const repository = new CourseRepository(prisma);
      const result = await repository.list({ isPublished: true });

      expect(result.data).toEqual(mockCourses);
      expect(prisma.course.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { isPublished: true },
        }),
      );
    });

    it('should filter courses by price range', async () => {
      const { prisma } = makeMocks();

      const mockCourses = [
        { id: 'course-1', title: 'Mid-priced Course', price: 50 },
      ];

      prisma.course.count.mockResolvedValue(1);
      prisma.course.findMany.mockResolvedValue(mockCourses);

      const repository = new CourseRepository(prisma);
      const result = await repository.list({ minPrice: 30, maxPrice: 100 });

      expect(result.data).toEqual(mockCourses);
      expect(prisma.course.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            price: {
              gte: 30,
              lte: 100,
            },
          },
        }),
      );
    });

    it('should filter courses by language', async () => {
      const { prisma } = makeMocks();

      const mockCourses = [
        { id: 'course-1', title: 'English Course', language: 'en' },
      ];

      prisma.course.count.mockResolvedValue(1);
      prisma.course.findMany.mockResolvedValue(mockCourses);

      const repository = new CourseRepository(prisma);
      const result = await repository.list({ language: 'en' as any });

      expect(result.data).toEqual(mockCourses);
      expect(prisma.course.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { language: 'en' },
        }),
      );
    });

    it('should filter courses by instructorId', async () => {
      const { prisma } = makeMocks();

      const mockCourses = [
        {
          id: 'course-1',
          title: 'Instructor Course',
          instructorId: 'instructor-1',
        },
      ];

      prisma.course.count.mockResolvedValue(1);
      prisma.course.findMany.mockResolvedValue(mockCourses);

      const repository = new CourseRepository(prisma);
      const result = await repository.list({ instructorId: 'instructor-1' });

      expect(result.data).toEqual(mockCourses);
      expect(prisma.course.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { instructorId: 'instructor-1' },
        }),
      );
    });

    it('should filter courses by tag', async () => {
      const { prisma } = makeMocks();

      const mockCourses = [
        { id: 'course-1', title: 'Grammar Course', tags: ['grammar'] },
      ];

      prisma.course.count.mockResolvedValue(1);
      prisma.course.findMany.mockResolvedValue(mockCourses);

      const repository = new CourseRepository(prisma);
      const result = await repository.list({ tag: 'grammar' });

      expect(result.data).toEqual(mockCourses);
      expect(prisma.course.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { tags: { has: 'grammar' } },
        }),
      );
    });

    it('should sort courses by specified field', async () => {
      const { prisma } = makeMocks();

      const mockCourses = [
        { id: 'course-1', title: 'Course A', price: 100 },
        { id: 'course-2', title: 'Course B', price: 50 },
      ];

      prisma.course.count.mockResolvedValue(2);
      prisma.course.findMany.mockResolvedValue(mockCourses);

      const repository = new CourseRepository(prisma);
      const result = await repository.list({
        sortBy: 'price' as any,
        sortOrder: 'desc' as any,
      });

      expect(result.data).toEqual(mockCourses);
      expect(prisma.course.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { price: 'desc' },
        }),
      );
    });

    it('should use default sortBy when invalid sortBy is provided', async () => {
      const { prisma } = makeMocks();

      const mockCourses = [{ id: 'course-1', title: 'Course 1' }];

      prisma.course.count.mockResolvedValue(1);
      prisma.course.findMany.mockResolvedValue(mockCourses);

      const repository = new CourseRepository(prisma);
      const result = await repository.list({ sortBy: 'invalid' as any });

      expect(result.data).toEqual(mockCourses);
      expect(prisma.course.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { orderNo: 'asc' },
        }),
      );
    });

    it('should handle pagination correctly', async () => {
      const { prisma } = makeMocks();

      const mockCourses = [
        { id: 'course-3', title: 'Course 3' },
        { id: 'course-4', title: 'Course 4' },
      ];

      prisma.course.count.mockResolvedValue(10);
      prisma.course.findMany.mockResolvedValue(mockCourses);

      const repository = new CourseRepository(prisma);
      const result = await repository.list({ page: 2, limit: 2 });

      const expectedResult = PageResponseDto.of(mockCourses, 2, 2, 10);
      expect(result).toEqual(expectedResult);

      expect(prisma.course.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 2, // (page 2 - 1) * limit 2 = 2
          take: 2,
        }),
      );
    });

    it('should handle multiple filters at once', async () => {
      const { prisma } = makeMocks();

      const mockCourses = [
        {
          id: 'course-1',
          title: 'Advanced English',
          difficulty: 'advanced',
          isPublished: true,
          language: 'en',
        },
      ];

      prisma.course.count.mockResolvedValue(1);
      prisma.course.findMany.mockResolvedValue(mockCourses);

      const repository = new CourseRepository(prisma);
      const result = await repository.list({
        search: 'English',
        difficulty: 'advanced' as any,
        isPublished: true,
        language: 'en' as any,
      });

      expect(result.data).toEqual(mockCourses);
      expect(prisma.course.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            OR: [
              { title: { contains: 'English', mode: 'insensitive' } },
              { description: { contains: 'English', mode: 'insensitive' } },
            ],
            difficulty: 'advanced',
            isPublished: true,
            language: 'en',
          },
        }),
      );
    });
  });
});
