import { Test, TestingModule } from '@nestjs/testing';
import { PrismaRepository } from '@app/database';
import { TeacherRepository } from './teacher.repository';
import { User, UserRole } from '@prisma/client';
import { PageResponseDto } from '@app/shared/payload/response/page-response.dto';

describe('TeacherRepository', () => {
  let repository: TeacherRepository;
  let prisma: PrismaRepository;

  const mockUser: User = {
    id: '1',
    email: 'teacher@test.com',
    passwordHash: 'hashedpassword',
    firstName: 'Test',
    lastName: 'Teacher',
    role: UserRole.teacher,
    createdAt: new Date(),
    updatedAt: new Date(),
    phone: null,
    gender: null,
    displayName: null,
    avatarUrl: null,
    deletedAt: null,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TeacherRepository,
        {
          provide: PrismaRepository,
          useValue: {
            user: {
              create: jest.fn(),
              findUnique: jest.fn(),
              findFirst: jest.fn(),
              update: jest.fn(),
              delete: jest.fn(),
              count: jest.fn(),
              findMany: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    repository = module.get<TeacherRepository>(TeacherRepository);
    prisma = module.get<PrismaRepository>(PrismaRepository);
  });

  it('should be defined', () => {
    expect(repository).toBeDefined();
  });

  describe('create', () => {
    it('should create a new teacher', async () => {
      const createData = { email: 'new@test.com', passwordHash: 'newpassword' };
      const expectedUser = { ...mockUser, ...createData, id: '2' };
      jest.spyOn(prisma.user, 'create').mockResolvedValue(expectedUser as any);

      const result = await repository.create(createData as any);
      expect(result).toEqual(expectedUser);
      expect(prisma.user.create).toHaveBeenCalledWith({ data: createData });
    });
  });

  describe('findByEmail', () => {
    it('should find a teacher by email', async () => {
      jest.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockUser as any);
      const result = await repository.findByEmail('teacher@test.com');
      expect(result).toEqual(mockUser);
      expect(prisma.user.findUnique).toHaveBeenCalledWith({ where: { email: 'teacher@test.com' } });
    });
  });

  describe('findById', () => {
    it('should find a teacher by id', async () => {
      jest.spyOn(prisma.user, 'findFirst').mockResolvedValue(mockUser as any);
      const result = await repository.findById('1');
      expect(result).toEqual(mockUser);
      expect(prisma.user.findFirst).toHaveBeenCalledWith({ where: { id: '1', role: UserRole.teacher } });
    });
  });

  describe('update', () => {
    it('should update a teacher', async () => {
      const updateData = { firstName: 'Updated' };
      const expectedUser = { ...mockUser, ...updateData };
      jest.spyOn(prisma.user, 'update').mockResolvedValue(expectedUser as any);

      const result = await repository.update('1', updateData);
      expect(result).toEqual(expectedUser);
      expect(prisma.user.update).toHaveBeenCalledWith({ where: { id: '1' }, data: updateData });
    });
  });

  describe('delete', () => {
    it('should delete a teacher', async () => {
      jest.spyOn(prisma.user, 'delete').mockResolvedValue(mockUser as any);
      const result = await repository.delete('1');
      expect(result).toEqual(mockUser);
      expect(prisma.user.delete).toHaveBeenCalledWith({ where: { id: '1' } });
    });
  });

  describe('list', () => {
    it('should return a paginated list of teachers', async () => {
        const users = [mockUser];
        const total = 1;
        const params = { page: 1, limit: 10 };
        jest.spyOn(prisma.user, 'count').mockResolvedValue(total);
        jest.spyOn(prisma.user, 'findMany').mockResolvedValue(users as any);

        const result = await repository.list(params);
        const expectedResult = PageResponseDto.of(users, params.page, params.limit, total);

        expect(result).toEqual(expectedResult);
        expect(prisma.user.count).toHaveBeenCalled();
        expect(prisma.user.findMany).toHaveBeenCalled();
    });
  });

  describe('listAll', () => {
    it('should return all teachers matching the criteria', async () => {
        const users = [mockUser];
        jest.spyOn(prisma.user, 'findMany').mockResolvedValue(users as any);

        const result = await repository.listAll({});
        expect(result).toEqual(users);
        expect(prisma.user.findMany).toHaveBeenCalled();
    });
  });
});