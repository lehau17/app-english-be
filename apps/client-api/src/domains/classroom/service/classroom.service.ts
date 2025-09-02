import { PageResponseDto } from '@app/shared/payload/response/page-response.dto';
import { Injectable, NotFoundException } from '@nestjs/common';
import { Classroom, Prisma } from '@prisma/client';
import { Readable } from 'stream';
import {
  AddStudentToClassroomDto,
  AssignTeacherToClassroomDto,
  CreateClassroomDto,
  FilterClassroomRequestDto,
  UpdateClassroomDto,
} from '../dto/classroom.dto';
import { ClassroomRepository } from '../repository/classroom.repository';
import {
  generateClassCode,
  getCsvTransformStream,
} from '../utils/classroom.util';

@Injectable()
export class ClassroomService {
  constructor(private readonly classroomRepository: ClassroomRepository) {}

  async create(dto: CreateClassroomDto): Promise<Classroom> {
    const createPayload: Prisma.ClassroomCreateInput = {
      name: dto.name,
      description: dto.description,
      teacher: {
        connect: {
          id: dto.teacherId,
        },
      },
      course: {
        connect: {
          id: dto.courseId,
        },
      },
      classCode: generateClassCode(6),
      maxStudents: dto.maxStudents,
      isActive: dto.isActive || true,
      periodStart: dto.periodStart,
      periodEnd: dto.periodEnd,
      plannedHours: dto.plannedHours,
      sessionDurationHours: dto.sessionDurationHours,
      plannedSessions: Math.ceil(dto.plannedHours / dto.sessionDurationHours),
    };
    return this.classroomRepository.create(createPayload);
  }

  async findById(id: string): Promise<Classroom> {
    const classroom = await this.classroomRepository.findById(id);
    if (!classroom) {
      throw new NotFoundException(`Classroom with id ${id} not found`);
    }
    return classroom;
  }

  async update(id: string, dto: UpdateClassroomDto): Promise<Classroom> {
    await this.findById(id);
    return this.classroomRepository.update(id, dto);
  }

  async delete(id: string): Promise<Classroom> {
    await this.findById(id);
    return this.classroomRepository.delete(id);
  }

  async list(
    params: FilterClassroomRequestDto,
  ): Promise<PageResponseDto<Classroom>> {
    return this.classroomRepository.list(params);
  }

  async addStudentToClassroom(
    classroomId: string,
    dto: AddStudentToClassroomDto,
  ): Promise<void> {
    await this.findById(classroomId);
    const { studentIds } = dto;

    await this.classroomRepository.addStudents(classroomId, studentIds);
  }

  async removeStudentFromClassroom(
    classroomId: string,
    studentId: string,
  ): Promise<void> {
    await this.classroomRepository.removeStudent(classroomId, studentId);
  }

  async assignTeacherToClassroom(
    classroomId: string,
    dto: AssignTeacherToClassroomDto,
  ): Promise<Classroom> {
    await this.findById(classroomId);
    // You might want to check if the teacher exists as well
    return this.classroomRepository.update(classroomId, {
      teacher: { connect: { id: dto.teacherId } },
    });
  }

  exportToCsv(params: FilterClassroomRequestDto): Readable {
    const dataStream = this.classroomRepository.streamAll(params);
    const csvTransform = getCsvTransformStream();
    return dataStream.pipe(csvTransform);
  }
}
