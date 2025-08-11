
import { Module } from '@nestjs/common';
import { CourseController } from './controller/private-course.controller';
import { CourseRepository } from './repository/course.repository';
import { CourseService } from './service/course.service';

@Module({
    controllers: [CourseController],
    providers: [CourseService, CourseRepository],
})
export class CourseModule { }
