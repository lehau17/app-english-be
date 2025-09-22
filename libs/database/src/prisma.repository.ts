import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaRepository
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor() {
    super({
      // Optimize connection pool to prevent memory leaks
      datasources: {
        db: {
          url: process.env.DATABASE_URL,
        },
      },
      // Log only errors to reduce memory usage
      log: process.env.NODE_ENV === 'development' ? ['error'] : [],
    });
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
