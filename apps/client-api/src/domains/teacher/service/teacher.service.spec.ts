import { Test, TestingModule } from '@nestjs/testing';
import { TeacherService } from './teacher.service';
import { TeacherRepository } from '../repository/teacher.repository';
import { UploadService } from '../../upload/upload.service';
import { User, UserRole, Gender } from '@prisma/client';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PageResponseDto } from '@app/shared/payload/response/page-response.dto';

jest.mock('bcrypt');

describe('TeacherService', () => {
  let service: TeacherService;
  let repository: TeacherRepository;
  let uploadService: UploadService;

  const mockUser: User = {
    id: '1',
    email: 'teacher@test.com',
    passwordHash: 'hashedpassword',
    firstName: 'Test',
    lastName: 'Teacher',
    role: UserRole.teacher,
    createdAt: new Date(),
    updatedAt: new Date(),
    phone: '1234567890',
    gender: Gender.MALE,
    displayName: 'Test Teacher',
    avatarUrl: null,
    deletedAt: null,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TeacherService,
        {
          provide: TeacherRepository,
          useValue: {
            create: jest.fn(),
            findByEmail: jest.fn(),
            findById: jest.fn(),
            update: jest.fn(),
            delete: jest.fn(),
            list: jest.fn(),
            listAll: jest.fn(),
          },
        },
        {
          provide: UploadService,
          useValue: {
            uploadFile: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<TeacherService>(TeacherService);
    repository = module.get<TeacherRepository>(TeacherRepository);
    uploadService = module.get<UploadService>(UploadService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create a new teacher', async () => {
      const dto = {
        email: 'new@test.com',
        password: 'password',
        firstName: 'New',
        lastName: 'Teacher',
        phone: '123',
      };
      const hashedPassword = 'hashedpassword';
      const createdUser = {
        ...mockUser,
        ...dto,
        id: '2',
        passwordHash: hashedPassword,
      };

      jest.spyOn(repository, 'findByEmail').mockResolvedValue(null);
      (bcrypt.hash as jest.Mock).mockResolvedValue(hashedPassword);
      jest.spyOn(repository, 'create').mockResolvedValue(createdUser as any);

      const result = await service.create(dto as any);

      expect(result).toEqual(createdUser);
      expect(repository.findByEmail).toHaveBeenCalledWith(dto.email);
      expect(bcrypt.hash).toHaveBeenCalledWith(dto.password, 10);
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { password, ...expectedPayload } = dto;
      expect(repository.create).toHaveBeenCalledWith({
        ...expectedPayload,
        passwordHash: hashedPassword,
        role: UserRole.teacher,
      });
    });

    it('should throw BadRequestException if teacher already exists', async () => {
      const dto = {
        email: 'teacher@test.com',
        password: 'password',
        firstName: 'Test',
        lastName: 'Teacher',
        phone: '123',
      };
      jest.spyOn(repository, 'findByEmail').mockResolvedValue(mockUser as any);
      await expect(service.create(dto as any)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('findById', () => {
    it('should find a teacher by id', async () => {
      jest.spyOn(repository, 'findById').mockResolvedValue(mockUser as any);
      const result = await service.findById('1');
      expect(result).toEqual(mockUser);
      expect(repository.findById).toHaveBeenCalledWith('1');
    });

    it('should throw NotFoundException if teacher not found', async () => {
      jest.spyOn(repository, 'findById').mockResolvedValue(null);
      await expect(service.findById('1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('should update a teacher', async () => {
      const dto = { firstName: 'Updated' };
      const updatedUser = { ...mockUser, ...dto };

      jest.spyOn(service, 'findById').mockResolvedValue(mockUser as any);
      jest.spyOn(repository, 'update').mockResolvedValue(updatedUser as any);
      const result = await service.update('1', dto);
      expect(result).toEqual(updatedUser);
      expect(service.findById).toHaveBeenCalledWith('1');
      expect(repository.update).toHaveBeenCalledWith('1', dto);
    });
  });

  describe('uploadAvatar', () => {
    it('should upload an avatar and update the teacher', async () => {
      const file = { originalname: 'avatar.jpg' } as any;
      const avatarUrl = 'http://example.com/avatar.jpg';
      const updatedUser = { ...mockUser, avatarUrl };

      jest.spyOn(service, 'findById').mockResolvedValue(mockUser as any);
      jest.spyOn(uploadService, 'uploadFile').mockResolvedValue(avatarUrl);
      jest.spyOn(repository, 'update').mockResolvedValue(updatedUser as any);

      const result = await service.uploadAvatar('1', file);

      expect(result).toEqual(updatedUser);
      expect(service.findById).toHaveBeenCalledWith('1');
      expect(uploadService.uploadFile).toHaveBeenCalledWith(file);
      expect(repository.update).toHaveBeenCalledWith('1', { avatarUrl });
    });
  });

  describe('delete', () => {
    it('should delete a teacher', async () => {
      jest.spyOn(service, 'findById').mockResolvedValue(mockUser as any);
      jest.spyOn(repository, 'delete').mockResolvedValue(mockUser as any);
      const result = await service.delete('1');

      expect(result).toEqual(mockUser);
      expect(service.findById).toHaveBeenCalledWith('1');
      expect(repository.delete).toHaveBeenCalledWith('1');
    });
  });

  describe('list', () => {
    it('should return a paginated list of teachers', async () => {
      const params = { page: 1, limit: 10 };
      const pagedResponse = PageResponseDto.of(
        [mockUser],
        params.page,
        params.limit,
        1,
      );
      jest.spyOn(repository, 'list').mockResolvedValue(pagedResponse as any);
      const result = await service.list(params);

      expect(result).toEqual(pagedResponse);
      expect(repository.list).toHaveBeenCalledWith(params);
    });
  });

  describe('exportTeachers', () => {
    it('should export teachers to a CSV string', async () => {
      const teachers = [mockUser];
      jest.spyOn(repository, 'listAll').mockResolvedValue(teachers as any);
      const result = await service.exportTeachers({});

      expect(result).toContain('email,firstName,lastName');
      expect(result).toContain(mockUser.email);
    });

    it('should return empty string if no teachers found', async () => {
      jest.spyOn(repository, 'listAll').mockResolvedValue([]);
      const result = await service.exportTeachers({});
      expect(result).toEqual('');
    });
  });

  describe('importTeachers', () => {
    it('should import teachers from a CSV buffer', async () => {
      const csv =
        'email,password,firstName,lastName,phone\nnew@test.com,pass,New,User,12345';
      const buffer = Buffer.from(csv);

      jest.spyOn(service, 'create').mockResolvedValue(mockUser as any);
      const result = await service.importTeachers(buffer);

      expect(result.created).toEqual(1);
      expect(result.errors.length).toEqual(0);
      expect(service.create).toHaveBeenCalled();
    });

    it('should throw BadRequestException for invalid CSV header', async () => {
      const csv = 'invalid,header\n';
      const buffer = Buffer.from(csv);
      await expect(service.importTeachers(buffer)).rejects.toThrow(
        BadRequestException,
      );
    });
  });
});
