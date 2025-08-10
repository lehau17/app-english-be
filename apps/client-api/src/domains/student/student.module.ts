import { Module } from '@nestjs/common';
import { StudentController } from './controller/private-student.controller';
import { StudentRepository } from './repository';
import { StudentService } from './service/student.service';

@Module({
    controllers: [StudentController,],
    providers: [StudentService, StudentRepository],
})
export class StudentModule { }
