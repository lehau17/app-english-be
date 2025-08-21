import { PageResponseDto } from '@app/shared/payload/response/page-response.dto';
import { Injectable, NotFoundException } from '@nestjs/common';
import { Classroom } from '@prisma/client';
import { Readable, Transform } from 'stream';
import { AddStudentToClassroomDto, AssignTeacherToClassroomDto, CreateClassroomDto, FilterClassroomRequestDto, UpdateClassroomDto } from '../dto/classroom.dto';
import { ClassroomRepository } from '../repository/classroom.repository';

@Injectable()
export class ClassroomService {
    constructor(private readonly classroomRepository: ClassroomRepository) { }

    async create(dto: CreateClassroomDto): Promise<Classroom> {
        return this.classroomRepository.create(dto.toCreateTeacherPayloadDB());
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

    async list(params: FilterClassroomRequestDto): Promise<PageResponseDto<Classroom>> {
        return this.classroomRepository.list(params);
    }

    async addStudentToClassroom(classroomId: string, dto: AddStudentToClassroomDto): Promise<void> {
        await this.findById(classroomId);
        // You might want to check if the student exists as well
        await this.classroomRepository.addStudent(classroomId, dto.studentId);
    }

    async removeStudentFromClassroom(classroomId: string, studentId: string): Promise<void> {
        await this.classroomRepository.removeStudent(classroomId, studentId);
    }

    async assignTeacherToClassroom(classroomId: string, dto: AssignTeacherToClassroomDto): Promise<Classroom> {
        await this.findById(classroomId);
        // You might want to check if the teacher exists as well
        return this.classroomRepository.update(classroomId, { teacher: { connect: { id: dto.teacherId } } });
    }

    exportToCsv(params: FilterClassroomRequestDto): Readable {
        const dataStream = this.classroomRepository.streamAll(params);

        let headerWritten = false;

        const csvTransform = new Transform({
            objectMode: true,
            transform(chunk, encoding, callback) {
                let output = '';
                if (!headerWritten) {
                    output += 'id,name,teacher,students\n';
                    headerWritten = true;
                }
                const teacherName = chunk.teacher ? `${chunk.teacher.firstName} ${chunk.teacher.lastName}` : '';
                const studentCount = chunk.students ? chunk.students.length : 0;
                const row = `"${chunk.id}","${chunk.name}","${teacherName}","${studentCount}"\n`;
                output += row;

                callback(null, output);
            },
        });

        return dataStream.pipe(csvTransform);
    }
}
