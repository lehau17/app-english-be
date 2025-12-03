import { PageResponseDto } from '@app/shared/payload/response/page-response.dto';
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { User } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { UploadService } from '../../upload/upload.service';
import {
  CreateStudentDto,
  FilterStudentRequestDto,
  UpdateStudentDto,
} from '../dto/student.dto';
import { StudentRepository } from '../repository';

@Injectable()
export class StudentService {
  constructor(
    private readonly studentRepository: StudentRepository,
    private readonly uploadService: UploadService,
  ) {}

  /**
   * Creates a new student record in the database.
   *
   * @param dto - The data transfer object containing the information needed to create a student.
   * @returns A promise that resolves to the created User object.
   */

  async create(dto: CreateStudentDto): Promise<User> {
    const exists = await this.studentRepository.checkExistContrants(
      dto.email,
      dto.phone,
    );
    if (exists) {
      throw new BadRequestException('Email/Phone already exists');
    }
    const passwordHash = await bcrypt.hash(dto.password, 10);
    delete dto.password;
    return this.studentRepository.create({
      ...dto,
      passwordHash: passwordHash,
    });
  }

  async findById(id: string): Promise<User> {
    const student = await this.studentRepository.findById(id);
    if (!student) {
      throw new NotFoundException(`Student with id ${id} not found`);
    }
    return student;
  }

  async update(id: string, dto: UpdateStudentDto): Promise<User> {
    await this.ensureExists(id);

    const updateData: any = { ...dto };
    if (dto.password) {
      updateData.passwordHash = await bcrypt.hash(dto.password, 10);
      delete updateData.password;
    }

    return this.studentRepository.update(id, updateData);
  }

  async delete(id: string): Promise<User> {
    await this.ensureExists(id);
    return this.studentRepository.delete(id);
  }

  async list(params: FilterStudentRequestDto): Promise<PageResponseDto<User>> {
    return this.studentRepository.list(params);
  }

  async uploadAvatar(id: string, file: Express.Multer.File): Promise<User> {
    await this.ensureExists(id);

    // Upload to S3/MinIO
    const avatarUrl = await this.uploadService.uploadFile(file);

    // Update student with new avatar URL
    return this.studentRepository.update(id, { avatarUrl });
  }

  async exportStudents(query: FilterStudentRequestDto): Promise<string> {
    const students = await this.studentRepository.listAll(query);
    if (students.length === 0) {
      return '';
    }

    const header = 'email,phone,firstName,lastName,displayName,gender,status,createdAt\n';
    const rows = students
      .map(
        (s) =>
          `${s.email || ''},${s.phone || ''},${s.firstName || ''},${s.lastName || ''},${s.displayName || ''},${s.gender || ''},${s.status || ''},${s.createdAt.toISOString()}`,
      )
      .join('\n');

    return header + rows;
  }

  async importStudents(
    fileBuffer: Buffer,
  ): Promise<{ created: number; errors: any[] }> {
    const fileContent = fileBuffer.toString('utf-8');
    const rows = fileContent
      .split('\n')
      .map((row) => row.trim())
      .filter((row) => row);
    if (rows.length < 2) {
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

    const studentsToCreate: CreateStudentDto[] = [];
    const errors = [];

    for (let i = 1; i < rows.length; i++) {
      const values = rows[i].split(',');
      const email = values[emailIndex]?.trim();
      const password = values[passwordIndex]?.trim();
      const firstName = values[firstNameIndex]?.trim();
      const lastName = values[lastNameIndex]?.trim();
      const gender = values[genderIndex]?.trim();
      const displayName = values[displayNameIndex]?.trim() || `${firstName} ${lastName}`.trim();
      const phone = values[phoneIndex]?.trim();

      if (email && password && firstName && lastName && phone) {
        studentsToCreate.push({
          email,
          password,
          firstName,
          lastName,
          gender: gender as any,
          displayName,
          phone,
        });
      } else {
        errors.push({ row: i + 1, error: 'Missing required fields' });
      }
    }

    let createdCount = 0;
    for (const studentDto of studentsToCreate) {
      try {
        await this.create(studentDto);
        createdCount++;
      } catch (error) {
        errors.push({ student: studentDto.email, error: error.message });
      }
    }

    return { created: createdCount, errors };
  }

  async bulkDelete(ids: string[]): Promise<{ count: number }> {
    if (!ids || ids.length === 0) {
      throw new BadRequestException('Student IDs are required');
    }
    return this.studentRepository.bulkDelete(ids);
  }

  async getStats(): Promise<{
    total: number;
    active: number;
    inactive: number;
    byGender: Record<string, number>;
  }> {
    return this.studentRepository.getStats();
  }

  async resetPassword(id: string, newPassword: string): Promise<User> {
    await this.ensureExists(id);
    const passwordHash = await bcrypt.hash(newPassword, 10);
    return this.studentRepository.update(id, { passwordHash });
  }

  async activate(id: string): Promise<User> {
    await this.ensureExists(id);
    return this.studentRepository.update(id, { status: 'active' });
  }

  async deactivate(id: string): Promise<User> {
    await this.ensureExists(id);
    return this.studentRepository.update(id, { status: 'inactive' });
  }

  private async ensureExists(id: string): Promise<void> {
    const exists = await this.studentRepository.findById(id);
    if (!exists) {
      throw new NotFoundException(`Student with id ${id} not found`);
    }
  }
}
