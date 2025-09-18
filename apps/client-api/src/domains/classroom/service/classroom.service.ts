import { PageResponseDto } from '@app/shared/payload/response/page-response.dto';
import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Classroom, Prisma, UserRole } from '@prisma/client';
import { JwtPayload } from '@app/shared';
import * as bcrypt from 'bcrypt';
import { Readable } from 'stream';
import * as XLSX from 'xlsx';
import {
    AddStudentToClassroomDto,
    AssignTeacherToClassroomDto,
    ClassroomAnnouncementQueryDto,
    CreateClassroomDto,
    FilterClassroomRequestDto,
    ImportStudentsResultDto,
    UpdateClassroomDto
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

  async myClassrooms(user: JwtPayload) {
    if (user.role === UserRole.teacher) {
      return this.classroomRepository.findClassroomsByTeacherId(user.sub);
    }

    if (user.role === UserRole.student) {
      return this.classroomRepository.findClassroomsByStudentId(user.sub);
    }

    return [];
  }

  async getClassroomAnnouncements(
    classroomId: string,
    user: JwtPayload,
    params: ClassroomAnnouncementQueryDto,
  ) {
    if (user.role === UserRole.teacher) {
      const allowed = await this.classroomRepository.isTeacherOfClassroom(
        classroomId,
        user.sub,
      );
      if (!allowed) {
        throw new ForbiddenException('You do not have access to this classroom');
      }
    } else if (user.role === UserRole.student) {
      const allowed = await this.classroomRepository.isStudentInClassroom(
        classroomId,
        user.sub,
      );
      if (!allowed) {
        throw new ForbiddenException('You do not have access to this classroom');
      }
    } else {
      throw new ForbiddenException('You do not have access to this classroom');
    }

    return this.classroomRepository.findAnnouncementsByClassroomId(
      classroomId,
      params,
    );
  }

  async createClassroomAnnouncement(
    classroomId: string,
    user: JwtPayload,
    payload: {
      title: string;
      content: string;
      priority?: string;
    },
  ) {
    if (user.role !== UserRole.teacher) {
      throw new ForbiddenException('Only teacher can create announcements');
    }

    const isTeacher = await this.classroomRepository.isTeacherOfClassroom(
      classroomId,
      user.sub,
    );
    if (!isTeacher) {
      throw new ForbiddenException('You do not manage this classroom');
    }

    return this.classroomRepository.createAnnouncement(classroomId, payload);
  }

  async getClassroomDetail(classroomId: string) {
    return this.classroomRepository.getClassroomDetail(classroomId);
  }

  async importStudentsFromExcel(
    classroomId: string,
    file: Express.Multer.File,
  ): Promise<ImportStudentsResultDto> {
    // Verify classroom exists
    await this.findById(classroomId);

    // Parse Excel file
    const workbook = XLSX.read(file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const jsonData = XLSX.utils.sheet_to_json(worksheet) as any[];

    const result: ImportStudentsResultDto = {
      totalProcessed: jsonData.length,
      successfullyImported: 0,
      failedImports: 0,
      errors: [],
      createdStudents: [],
      existingStudents: [],
    };

    const studentIdsToAdd: string[] = [];

    for (let i = 0; i < jsonData.length; i++) {
      const row = jsonData[i];
      const rowNumber = i + 2; // Excel rows start from 1, plus header row

      try {
        // Validate required fields
        const email = row['Email'] || row['email'];
        const phone = row['Phone'] || row['phone'];
        const firstName = row['First Name'] || row['firstName'] || row['FirstName'];
        const lastName = row['Last Name'] || row['lastName'] || row['LastName'];
        const displayName = row['Display Name'] || row['displayName'] || row['DisplayName'] || `${firstName} ${lastName}`;
        const gender = row['Gender'] || row['gender'];

        if (!email || !phone || !firstName || !lastName) {
          result.errors.push({
            row: rowNumber,
            email: email || 'N/A',
            error: 'Missing required fields: Email, Phone, First Name, Last Name',
          });
          result.failedImports++;
          continue;
        }

        // Check if student already exists by email
        let existingStudent = await this.classroomRepository.findStudentByEmail(email);

        if (existingStudent) {
          // Student exists, add to existing list
          result.existingStudents.push({
            id: existingStudent.id,
            email: existingStudent.email,
            firstName: existingStudent.firstName,
            lastName: existingStudent.lastName,
          });
          studentIdsToAdd.push(existingStudent.id);
        } else {
          // Create new student
          const passwordHash = await bcrypt.hash('TempPass123!', 10); // Default password

          const newStudent = await this.classroomRepository.createStudent({
            email,
            phone,
            firstName,
            lastName,
            displayName,
            gender: gender === 'male' ? 'male' : gender === 'female' ? 'female' : 'other',
            passwordHash,
            role: 'student',
            language: 'vi',
            timezone: 'Asia_Ho_Chi_Minh',
          });

          result.createdStudents.push({
            id: newStudent.id,
            email: newStudent.email,
            firstName: newStudent.firstName,
            lastName: newStudent.lastName,
          });
          studentIdsToAdd.push(newStudent.id);
        }

        result.successfullyImported++;
      } catch (error) {
        result.errors.push({
          row: rowNumber,
          email: row['Email'] || row['email'] || 'N/A',
          error: error.message || 'Unknown error',
        });
        result.failedImports++;
      }
    }

    // Add all students to classroom
    if (studentIdsToAdd.length > 0) {
      await this.classroomRepository.addStudents(classroomId, studentIdsToAdd);
    }

    return result;
  }
}
