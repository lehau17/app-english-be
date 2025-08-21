import { RequestPagingDto } from '@app/shared';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsOptional, IsString, IsUUID, Min } from 'class-validator';

export class CreateClassroomDto {
    @ApiProperty({ example: 'Lop hoc 1' })
    @IsString()
    name: string;

    @ApiPropertyOptional({ example: 'Mo ta lop hoc 1' })
    @IsOptional()
    @IsString()
    description?: string;

    @ApiProperty({ example: 'f8a8b8e0-5b7a-4b0e-8b0a-0b8b8b8b8b8b' })
    @IsUUID()
    teacherId: string;


    toCreateTeacherPayloadDB() {
        return {
            name: this.name,
            description: this.description,
            teacher: {
                connect: {
                    id: this.teacherId
                }
            },
            classCode: new Date().getTime().toString()
        }
    }
}

export class UpdateClassroomDto {
    @ApiPropertyOptional({ example: 'Lop hoc 1' })
    @IsOptional()
    @IsString()
    name?: string;

    @ApiPropertyOptional({ example: 'Mo ta lop hoc 1' })
    @IsOptional()
    @IsString()
    description?: string;

    @ApiPropertyOptional({ example: true })
    @IsOptional()
    @IsBoolean()
    isActive?: boolean;

    @ApiPropertyOptional({ example: 30 })
    @IsOptional()
    @IsInt()
    @Min(1)
    maxStudents?: number;
}

export class FilterClassroomRequestDto extends RequestPagingDto {
    @ApiPropertyOptional({ description: 'Search by name', example: 'Lop hoc' })
    @IsOptional()
    @IsString()
    search?: string;

    @ApiPropertyOptional({ description: 'Filter by teacherId', example: 'f8a8b8e0-5b7a-4b0e-8b0a-0b8b8b8b8b8b' })
    @IsOptional()
    @IsUUID()
    teacherId?: string;
}

export class AddStudentToClassroomDto {
    @ApiProperty({ example: 'f8a8b8e0-5b7a-4b0e-8b0a-0b8b8b8b8b8b' })
    @IsUUID()
    studentId: string;
}

export class AssignTeacherToClassroomDto {
    @ApiProperty({ example: 'f8a8b8e0-5b7a-4b0e-8b0a-0b8b8b8b8b8b' })
    @IsUUID()
    teacherId: string;
}
