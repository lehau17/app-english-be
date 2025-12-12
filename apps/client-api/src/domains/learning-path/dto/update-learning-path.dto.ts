import { PartialType } from '@nestjs/swagger';
import { CreateLearningPathDto } from './create-learning-path.dto';

export class UpdateLearningPathDto extends PartialType(CreateLearningPathDto) {}
