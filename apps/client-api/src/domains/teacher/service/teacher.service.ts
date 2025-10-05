import { PageResponseDto } from '@app/shared/payload/response/page-response.dto';
import {
    BadRequestException,
    Injectable,
    NotFoundException,
} from '@nestjs/common';
import { Gender, User, UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { UploadService } from '../../upload/upload.service';
import {
    CreateTeacherDto,
    FilterTeacherRequestDto,
    UpdateTeacherDto,
} from '../dto/teacher.dto';
import { TeacherRepository } from '../repository/teacher.repository';

@Injectable()
export class TeacherService {
  constructor(
    private readonly teacherRepository: TeacherRepository,
    private readonly uploadService: UploadService,
  ) {}

  async create(dto: CreateTeacherDto): Promise<User> {
    const existingTeacher = await this.teacherRepository.findByEmail(dto.email);
    if (existingTeacher) {
      throw new BadRequestException('Teacher with this email already exists');
    }
    const { password, ...rest } = dto;

    const passwordHash = await bcrypt.hash(password, 10);
    return this.teacherRepository.create({
      ...rest,
      passwordHash,
      role: UserRole.teacher,
    });
  }

  async findById(id: string): Promise<User> {
    const teacher = await this.teacherRepository.findById(id);
    if (!teacher || teacher.role !== UserRole.teacher) {
      throw new NotFoundException(`Teacher with id ${id} not found`);
    }
    return teacher;
  }

  async update(id: string, dto: UpdateTeacherDto): Promise<User> {
    await this.findById(id);
    return this.teacherRepository.update(id, dto);
  }

  async uploadAvatar(id: string, file: Express.Multer.File): Promise<User> {
    await this.findById(id);
    const avatarUrl = await this.uploadService.uploadFile(file);
    return this.teacherRepository.update(id, { avatarUrl });
  }

  async delete(id: string): Promise<User> {
    await this.findById(id);
    return this.teacherRepository.delete(id);
  }

  async list(params: FilterTeacherRequestDto): Promise<PageResponseDto<User>> {
    return this.teacherRepository.list(params);
  }

  async exportTeachers(query: FilterTeacherRequestDto): Promise<string> {
    const teachers = await this.teacherRepository.listAll(query);
    if (teachers.length === 0) {
      return '';
    }

    const header = 'email,firstName,lastName\n';
    const rows = teachers
      .map((t) => `${t.email},${t.firstName},${t.lastName}`)
      .join('\n');

    return header + rows;
  }

  async importTeachers(
    fileBuffer: Buffer,
  ): Promise<{ created: number; errors: any[] }> {
    const fileContent = fileBuffer.toString('utf-8');
    const rows = fileContent
      .split('\n')
      .map((row) => row.trim())
      .filter((row) => row);
    if (rows.length < 2) {
      // at least one header and one data row
      throw new BadRequestException(
        'CSV file must have a header and at least one data row.',
      );
    }

    const header = rows[0].split(',').map((h) => h.trim());
    const emailIndex = header.indexOf('email');
    const passwordIndex = header.indexOf('password');
    const firstNameIndex = header.indexOf('firstName');
    const lastNameIndex = header.indexOf('lastName');
    const genderIndex = header.indexOf('gender');
    const displayNameIndex = header.indexOf('displayName');
    const phoneIndex = header.indexOf('phone');

    if (
      emailIndex === -1 ||
      passwordIndex === -1 ||
      firstNameIndex === -1 ||
      lastNameIndex === -1 ||
      phoneIndex === -1
    ) {
      throw new BadRequestException(
        'CSV header must contain email, password, firstName, lastName, phone',
      );
    }

    const teachersToCreate: CreateTeacherDto[] = [];
    const errors = [];

    for (let i = 1; i < rows.length; i++) {
      const values = rows[i].split(',');
      const email = values[emailIndex]?.trim();
      const password = values[passwordIndex]?.trim();
      const firstName = values[firstNameIndex]?.trim();
      const lastName = values[lastNameIndex]?.trim();
      const gender = values[genderIndex]?.trim() as Gender;
      const displayName = values[displayNameIndex]?.trim();
      const phone = values[phoneIndex]?.trim();

      if (email && password && firstName && lastName && phone) {
        teachersToCreate.push({
          email,
          password,
          firstName,
          lastName,
          gender,
          displayName,
          phone,
        });
      } else {
        errors.push({ row: i + 1, error: 'Missing required fields' });
      }
    }

    let createdCount = 0;
    for (const teacherDto of teachersToCreate) {
      try {
        await this.create(teacherDto);
        createdCount++;
      } catch (error) {
        errors.push({ teacher: teacherDto.email, error: error.message });
      }
    }

    return { created: createdCount, errors };
  }
}
