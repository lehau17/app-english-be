import { PageResponseDto } from '@app/shared/payload/response/page-response.dto';
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { User } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import {
  CreateStudentDto,
  FilterStudentRequestDto,
  UpdateStudentDto,
} from '../dto/student.dto';
import { StudentRepository } from '../repository';

@Injectable()
export class StudentService {
  constructor(private readonly studentRepository: StudentRepository) {}

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

  private async ensureExists(id: string): Promise<void> {
    const exists = await this.studentRepository.findById(id);
    if (!exists) {
      throw new NotFoundException(`Student with id ${id} not found`);
    }
  }
}
