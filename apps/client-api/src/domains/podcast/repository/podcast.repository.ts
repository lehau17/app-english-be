import { PrismaRepository } from '@app/database';
import { Injectable } from '@nestjs/common';

@Injectable()
export class PodcastRepository {
  constructor(private readonly prisma: PrismaRepository) {}

  // TODO: Add repository methods when needed
  // Repository pattern methods would go here for data access abstraction
}
